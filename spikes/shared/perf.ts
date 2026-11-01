/**
 * Engine-neutrale Messung nach Vorschlag docs/qa/quality-standards-entwurf.md §8:
 * `window.__perf(): PerfSnapshot`, `window.__perfReset()`.
 * Draw Calls und Dreiecke werden NICHT aus Engine-Statistiken gelesen, sondern über eine dünne Hülle
 * um `WebGL2RenderingContext.prototype.draw*` gezählt (alle Pässe inkl. Schatten/Post).
 * Texturspeicher wird aus den Upload-Aufrufen geschätzt (siehe textureBytes).
 */

export type AaMode = 'none' | 'msaa' | 'fxaa' | 'smaa' | 'taa';

export interface PerfSnapshot {
  schema: 1;
  engine: string;
  engineVersion: string;
  scene: string;
  timeToFirstFrameMs: number | null;
  timeToPlayableMs: number | null;
  windowMs: number;
  frames: number;
  fps: number;
  frameTimeMsAvg: number;
  frameTimeMsP50: number;
  frameTimeMsP95: number;
  frameTimeMsMax: number;
  longFrames: number;
  drawCalls: number;
  triangles: number;
  textureMemoryMB: number;
  textureMemoryEstimated: boolean;
  textureCount: number;
  geometryCount: number;
  bufferMemoryMB: number | null;
  heapMB: number | null;
  canvasCssWidth: number;
  canvasCssHeight: number;
  renderWidth: number;
  renderHeight: number;
  devicePixelRatio: number;
  renderScale: number;
  aa: AaMode;
  msaaSamples: number;
  transferredKB: number | null;
  inputLatencyMsLast: number | null;
  contextLostCount: number;
  errorCount: number;
}

// ---------------------------------------------------------------- reine Hilfsfunktionen (getestet)

/** Nearest-Rank-Perzentil auf aufsteigend sortierten Werten (p in 0..100). */
export function percentileNearestRank(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[Math.min(sorted.length, rank) - 1] ?? 0;
}

const GL_TRIANGLES = 0x0004;
const GL_TRIANGLE_STRIP = 0x0005;
const GL_TRIANGLE_FAN = 0x0006;

/** Dreiecke eines Draw-Aufrufs: count/3 bei TRIANGLES, count−2 bei Strip/Fan, × Instanzen. */
export function trianglesForDraw(mode: number, count: number, instances = 1): number {
  let t = 0;
  if (mode === GL_TRIANGLES) t = Math.floor(count / 3);
  else if (mode === GL_TRIANGLE_STRIP || mode === GL_TRIANGLE_FAN) t = Math.max(0, count - 2);
  return t * Math.max(0, instances);
}

const SIZED_BPP: Readonly<Record<number, number>> = {
  0x8058: 4, // RGBA8
  0x8c43: 4, // SRGB8_ALPHA8
  0x8051: 3, // RGB8
  0x8c41: 3, // SRGB8
  0x881a: 8, // RGBA16F
  0x8814: 16, // RGBA32F
  0x881b: 6, // RGB16F
  0x8815: 12, // RGB32F
  0x8229: 1, // R8
  0x822b: 2, // RG8
  0x822d: 2, // R16F
  0x822e: 4, // R32F
  0x822f: 4, // RG16F
  0x8230: 8, // RG32F
  0x8c3a: 4, // R11F_G11F_B10F
  0x8059: 4, // RGB10_A2
  0x81a5: 2, // DEPTH_COMPONENT16
  0x81a6: 4, // DEPTH_COMPONENT24
  0x8cac: 4, // DEPTH_COMPONENT32F
  0x88f0: 4, // DEPTH24_STENCIL8
  0x8cad: 8, // DEPTH32F_STENCIL8
};

/** Bytes pro Pixel aus (internes) Format + Typ; unbekannt → 4. */
export function bytesPerPixel(internalFormat: number, type?: number): number {
  const sized = SIZED_BPP[internalFormat];
  if (sized !== undefined) return sized;
  const comps = internalFormat === 0x1907 ? 3 : internalFormat === 0x1909 || internalFormat === 0x1906 ? 1 : internalFormat === 0x190a ? 2 : 4;
  const perComp = type === 0x1406 ? 4 : type === 0x140b || type === 0x8d61 ? 2 : 1; // FLOAT, HALF_FLOAT
  if (internalFormat === 0x1902) return 4; // DEPTH_COMPONENT
  return comps * perComp;
}

// ---------------------------------------------------------------- WebGL-Hülle

interface TexInfo {
  levels: Map<string, number>; // "face:level" → Bytes
  mip: boolean;
  storage: number; // texStorage-Bytes (inkl. Mips)
}

interface GlCounters {
  drawCalls: number;
  triangles: number;
}

const cur: GlCounters = { drawCalls: 0, triangles: 0 };
const textures = new Map<WebGLTexture, TexInfo>();
const buffers = new Map<WebGLBuffer, number>();
let activeUnit = 0;
const bound = new Map<string, WebGLTexture | null>(); // "unit:target"
const boundBuffer = new Map<number, WebGLBuffer | null>();
let hooksInstalled = false;

const CUBE_FACE_MIN = 0x8515;
const CUBE_FACE_MAX = 0x851a;
const GL_TEXTURE_CUBE_MAP = 0x8513;

const bindingTarget = (target: number): number =>
  target >= CUBE_FACE_MIN && target <= CUBE_FACE_MAX ? GL_TEXTURE_CUBE_MAP : target;

function texFor(target: number): TexInfo | null {
  const tex = bound.get(`${String(activeUnit)}:${String(bindingTarget(target))}`);
  if (!tex) return null;
  let info = textures.get(tex);
  if (!info) {
    info = { levels: new Map(), mip: false, storage: 0 };
    textures.set(tex, info);
  }
  return info;
}

function sourceSize(src: unknown): { w: number; h: number } | null {
  if (src === null || typeof src !== 'object') return null;
  const o = src as Record<string, unknown>;
  const w = o['videoWidth'] ?? o['naturalWidth'] ?? o['displayWidth'] ?? o['width'];
  const h = o['videoHeight'] ?? o['naturalHeight'] ?? o['displayHeight'] ?? o['height'];
  return typeof w === 'number' && typeof h === 'number' ? { w, h } : null;
}

type AnyFn = (this: WebGL2RenderingContext, ...args: never[]) => unknown;

function wrap(proto: object, name: string, before: (args: unknown[]) => void, after?: (result: unknown, args: unknown[]) => void): void {
  const desc = Object.getOwnPropertyDescriptor(proto, name);
  const orig = desc?.value as AnyFn | undefined;
  if (typeof orig !== 'function') return;
  Object.defineProperty(proto, name, {
    ...desc,
    value: function (this: WebGL2RenderingContext, ...args: unknown[]): unknown {
      before(args);
      const r = (orig as (...a: unknown[]) => unknown).apply(this, args);
      after?.(r, args);
      return r;
    },
  });
}

const num = (v: unknown): number => (typeof v === 'number' ? v : 0);

/** Muss VOR dem Erzeugen des WebGL-Kontexts aufgerufen werden. */
export function installGlHooks(): void {
  if (hooksInstalled || typeof WebGL2RenderingContext === 'undefined') return;
  hooksInstalled = true;
  for (const proto of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype] as object[]) {
    const draw = (modeIdx: number, countIdx: number, instIdx: number | null) => (a: unknown[]) => {
      cur.drawCalls++;
      cur.triangles += trianglesForDraw(num(a[modeIdx]), num(a[countIdx]), instIdx === null ? 1 : num(a[instIdx]));
    };
    wrap(proto, 'drawArrays', draw(0, 2, null));
    wrap(proto, 'drawElements', draw(0, 1, null));
    wrap(proto, 'drawArraysInstanced', draw(0, 2, 3));
    wrap(proto, 'drawElementsInstanced', draw(0, 1, 4));
    wrap(proto, 'drawRangeElements', draw(0, 3, null));

    wrap(proto, 'activeTexture', (a) => { activeUnit = num(a[0]) - 0x84c0; });
    wrap(proto, 'bindTexture', (a) => { bound.set(`${String(activeUnit)}:${String(num(a[0]))}`, (a[1] ?? null)); });
    wrap(proto, 'deleteTexture', (a) => {
      const t = a[0] as WebGLTexture | null;
      if (t) textures.delete(t);
    });
    wrap(proto, 'texImage2D', (a) => {
      const target = num(a[0]);
      const level = num(a[1]);
      const info = texFor(target);
      if (!info) return;
      let w: number;
      let h: number;
      let bpp: number;
      if (a.length >= 8) {
        w = num(a[3]);
        h = num(a[4]);
        bpp = bytesPerPixel(num(a[2]), num(a[7]));
      } else {
        const s = sourceSize(a[5]);
        if (!s) return;
        w = s.w;
        h = s.h;
        bpp = bytesPerPixel(num(a[2]), num(a[4]));
      }
      info.levels.set(`${String(target)}:${String(level)}`, w * h * bpp);
    });
    wrap(proto, 'compressedTexImage2D', (a) => {
      const info = texFor(num(a[0]));
      const data = a[6];
      if (!info) return;
      const bytes = ArrayBuffer.isView(data) ? data.byteLength : num(data);
      info.levels.set(`${String(num(a[0]))}:${String(num(a[1]))}`, bytes);
    });
    wrap(proto, 'texStorage2D', (a) => {
      const target = num(a[0]);
      const info = texFor(target);
      if (!info) return;
      const levels = num(a[1]);
      const faces = target === GL_TEXTURE_CUBE_MAP ? 6 : 1;
      info.storage = num(a[3]) * num(a[4]) * bytesPerPixel(num(a[2])) * faces * (levels > 1 ? 4 / 3 : 1);
    });
    wrap(proto, 'texStorage3D', (a) => {
      const info = texFor(num(a[0]));
      if (!info) return;
      const levels = num(a[1]);
      info.storage = num(a[3]) * num(a[4]) * num(a[5]) * bytesPerPixel(num(a[2])) * (levels > 1 ? 4 / 3 : 1);
    });
    wrap(proto, 'generateMipmap', (a) => {
      const info = texFor(num(a[0]));
      if (info) info.mip = true;
    });

    wrap(proto, 'bindBuffer', (a) => { boundBuffer.set(num(a[0]), (a[1] ?? null)); });
    wrap(proto, 'bindVertexArray', () => { boundBuffer.delete(0x8893); });
    wrap(
      proto,
      'createBuffer',
      () => undefined,
      (r) => { if (r) buffers.set(r, 0); },
    );
    wrap(proto, 'deleteBuffer', (a) => {
      const b = a[0] as WebGLBuffer | null;
      if (b) buffers.delete(b);
    });
    wrap(proto, 'bufferData', (a) => {
      const b = boundBuffer.get(num(a[0]));
      if (!b) return;
      const d = a[1];
      buffers.set(b, typeof d === 'number' ? d : ArrayBuffer.isView(d) || d instanceof ArrayBuffer ? d.byteLength : 0);
    });
  }
}

function textureTotals(): { bytes: number; count: number } {
  let bytes = 0;
  for (const info of textures.values()) {
    let t = info.storage;
    let level0 = 0;
    for (const [key, b] of info.levels) {
      t += b;
      if (key.endsWith(':0')) level0 += b;
    }
    // generateMipmap ohne explizite Stufen: + 1/3 der Basisstufe
    if (info.mip && info.levels.size > 0 && ![...info.levels.keys()].some((k) => !k.endsWith(':0'))) t += level0 / 3;
    bytes += t;
  }
  return { bytes, count: textures.size };
}

// ---------------------------------------------------------------- Monitor

export interface PerfMeta {
  engine: string;
  engineVersion: string;
  scene: string;
  aa: AaMode;
  msaaSamples: number;
}

const WINDOW_MS = 5000;
const MB = 1024 * 1024;

export class PerfMonitor {
  private readonly gaps: { t: number; gap: number }[] = [];
  private last: number | undefined;
  private maxGap = 0;
  private longFrames = 0;
  private lastFrame: GlCounters = { drawCalls: 0, triangles: 0 };
  private firstFrameMs: number | null = null;
  private playableMs: number | null = null;
  private transferredKB: number | null = null;
  private pendingInput: number | null = null;
  private inputLatency: number | null = null;
  private contextLost = 0;
  private errors = 0;
  private canvas: HTMLCanvasElement | null = null;

  constructor(private meta: PerfMeta) {
    window.addEventListener('error', () => { this.errors++; }, true);
    window.addEventListener('unhandledrejection', () => { this.errors++; });
    const loop = (now: number): void => {
      this.tick(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  setMeta(meta: Partial<PerfMeta>): void {
    this.meta = { ...this.meta, ...meta };
  }

  attachCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    canvas.addEventListener('webglcontextlost', () => { this.contextLost++; });
  }

  /** Szene geladen und Eingabe aktiv. */
  markPlayable(): void {
    if (this.playableMs !== null) return;
    this.playableMs = performance.now();
    let bytes = 0;
    let known = false;
    for (const e of performance.getEntriesByType('navigation').concat(performance.getEntriesByType('resource'))) {
      const size = (e as PerformanceResourceTiming).transferSize;
      if (size > 0) known = true;
      bytes += size;
    }
    this.transferredKB = known ? bytes / 1024 : null;
  }

  /** Eingabe-Zeitstempel (event.timeStamp) einer Aktion mit sichtbarem Feedback. */
  noteInput(eventTimeStamp: number): void {
    this.pendingInput = eventTimeStamp;
  }

  /** Vom Adapter im Frame aufgerufen, in dem das Feedback gezeichnet wird. */
  noteFeedbackFrame(): void {
    if (this.pendingInput === null) return;
    this.inputLatency = performance.now() - this.pendingInput;
    this.pendingInput = null;
  }

  private tick(now: number): void {
    // Zwischen zwei eigenen rAF-Aufrufen liegt genau ein Engine-Frame → Zähler übernehmen.
    if (cur.drawCalls > 0) {
      this.lastFrame = { ...cur };
      if (this.firstFrameMs === null) this.firstFrameMs = now;
    }
    cur.drawCalls = 0;
    cur.triangles = 0;
    if (this.last !== undefined) {
      const gap = now - this.last;
      this.gaps.push({ t: now, gap });
      if (gap > this.maxGap) this.maxGap = gap;
      if (gap > 50) this.longFrames++;
    }
    this.last = now;
    const cutoff = now - WINDOW_MS;
    while (this.gaps.length > 0 && (this.gaps[0]?.t ?? 0) < cutoff) this.gaps.shift();
  }

  reset(): void {
    this.gaps.length = 0;
    this.maxGap = 0;
    this.longFrames = 0;
  }

  /** Zeichnungsdaten des letzten vollständigen Frames (für das Overlay). */
  get frame(): Readonly<GlCounters> {
    return this.lastFrame;
  }

  snapshot(): PerfSnapshot {
    const sorted = this.gaps.map((g) => g.gap).sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const span = this.gaps.length > 1 ? (this.gaps[this.gaps.length - 1]?.t ?? 0) - (this.gaps[0]?.t ?? 0) + (this.gaps[0]?.gap ?? 0) : 0;
    const tex = textureTotals();
    let bufBytes = 0;
    for (const b of buffers.values()) bufBytes += b;
    const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    const c = this.canvas;
    const cssW = c?.clientWidth ?? 0;
    const cssH = c?.clientHeight ?? 0;
    const rw = c?.width ?? 0;
    const rh = c?.height ?? 0;
    return {
      schema: 1,
      engine: this.meta.engine,
      engineVersion: this.meta.engineVersion,
      scene: this.meta.scene,
      timeToFirstFrameMs: this.firstFrameMs,
      timeToPlayableMs: this.playableMs,
      windowMs: WINDOW_MS,
      frames: this.gaps.length + (this.gaps.length > 0 ? 1 : 0),
      fps: span > 0 ? (this.gaps.length * 1000) / span : 0,
      frameTimeMsAvg: sorted.length > 0 ? sum / sorted.length : 0,
      frameTimeMsP50: percentileNearestRank(sorted, 50),
      frameTimeMsP95: percentileNearestRank(sorted, 95),
      frameTimeMsMax: this.maxGap,
      longFrames: this.longFrames,
      drawCalls: this.lastFrame.drawCalls,
      triangles: this.lastFrame.triangles,
      textureMemoryMB: tex.bytes / MB,
      textureMemoryEstimated: true,
      textureCount: tex.count,
      geometryCount: buffers.size,
      bufferMemoryMB: bufBytes / MB,
      heapMB: mem ? mem.usedJSHeapSize / MB : null,
      canvasCssWidth: cssW,
      canvasCssHeight: cssH,
      renderWidth: rw,
      renderHeight: rh,
      devicePixelRatio: window.devicePixelRatio,
      renderScale: cssW > 0 ? rw / cssW : 0,
      aa: this.meta.aa,
      msaaSamples: this.meta.msaaSamples,
      transferredKB: this.transferredKB,
      inputLatencyMsLast: this.inputLatency,
      contextLostCount: this.contextLost,
      errorCount: this.errors,
    };
  }
}

declare global {
  interface Window {
    __perf?: () => PerfSnapshot;
    __perfReset?: () => void;
  }
}

/** Hängt __perf/__perfReset an window. */
export function exposePerf(monitor: PerfMonitor): void {
  window.__perf = () => monitor.snapshot();
  window.__perfReset = () => { monitor.reset(); };
}
