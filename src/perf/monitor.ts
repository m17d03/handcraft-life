/**
 * `window.__perf()` / `window.__perfReset()` (PerfSnapshot v1). Aktiv nur im Debug-/Perf-Modus
 * (`?debug=1`, `?perf=1` oder Vite-Dev) – sonst kein Messaufwand im Spiel.
 * Kennt keine Engine: Engine-Name, AA usw. speist src/render über `PerfMelder` ein.
 */
import { FrameStatistik } from './frame-statistik';
import { glFrameBeginn, glFrameZaehler, glKontextVergessen, glSpeicher, installiereGlHuelle } from './gl-zaehler';
import type { PerfMelder, PerfMeta, PerfSnapshot } from './perf-snapshot';

const MB = 1024 * 1024;

export class PerfMonitor implements PerfMelder {
  private readonly statistik = new FrameStatistik();
  private meta: PerfMeta;
  private spielbarMs: number | null = null;
  private uebertragenKB: number | null = null;
  private kontextVerluste = 0;
  private fehler = 0;
  private canvas: HTMLCanvasElement | null = null;

  constructor(meta: PerfMeta) {
    this.meta = meta;
    window.addEventListener('error', () => { this.fehler++; }, true);
    window.addEventListener('unhandledrejection', () => { this.fehler++; });
  }

  setzeMeta(meta: Partial<PerfMeta>): void {
    this.meta = { ...this.meta, ...meta };
  }

  beobachteCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    canvas.addEventListener('webglcontextlost', () => {
      this.kontextVerluste++;
      glKontextVergessen();
    });
  }

  frameBeginn(jetztMs: number): void {
    this.statistik.frameBeginn(jetztMs);
    glFrameBeginn();
  }

  frameEnde(): void {
    this.statistik.frameEnde(performance.now(), glFrameZaehler());
  }

  feedbackGezeichnet(): void {
    this.statistik.feedbackGezeichnet();
  }

  /** Eingabe mit sichtbarem Feedback (event.timeStamp); Eingabe-Schicht ruft das über `perfEingabe` auf. */
  eingabe(zeitstempelMs: number): void {
    this.statistik.eingabe(zeitstempelMs);
  }

  spielbar(): void {
    if (this.spielbarMs !== null) return;
    this.spielbarMs = performance.now();
    let bytes = 0;
    let bekannt = false;
    for (const e of performance.getEntriesByType('navigation').concat(performance.getEntriesByType('resource'))) {
      const groesse = (e as PerformanceResourceTiming).transferSize;
      if (groesse > 0) bekannt = true;
      bytes += groesse;
    }
    this.uebertragenKB = bekannt ? bytes / 1024 : null;
  }

  reset(): void {
    this.statistik.reset();
  }

  snapshot(): PerfSnapshot {
    const f = this.statistik.auswerten(performance.now());
    const sp = glSpeicher();
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
      timeToFirstFrameMs: f.timeToFirstFrameMs,
      timeToPlayableMs: this.spielbarMs,
      windowMs: f.windowMs,
      frames: f.frames,
      fps: f.fps,
      frameTimeMsAvg: f.frameTimeMsAvg,
      frameTimeMsP50: f.frameTimeMsP50,
      frameTimeMsP95: f.frameTimeMsP95,
      frameTimeMsMax: f.frameTimeMsMax,
      longFrames: f.longFrames,
      drawCalls: f.drawCalls,
      triangles: f.triangles,
      textureMemoryMB: sp.texturBytes / MB,
      textureMemoryEstimated: true,
      textureCount: sp.texturAnzahl,
      geometryCount: sp.pufferAnzahl,
      bufferMemoryMB: sp.pufferBytes / MB,
      heapMB: mem ? mem.usedJSHeapSize / MB : null,
      canvasCssWidth: cssW,
      canvasCssHeight: cssH,
      renderWidth: rw,
      renderHeight: rh,
      devicePixelRatio: window.devicePixelRatio,
      renderScale: cssW > 0 ? rw / cssW : 0,
      aa: this.meta.aa,
      msaaSamples: this.meta.msaaSamples,
      transferredKB: this.uebertragenKB,
      inputLatencyMsLast: f.inputLatencyMsLast,
      contextLostCount: this.kontextVerluste,
      errorCount: this.fehler,
    };
  }
}

let aktiv: PerfMonitor | null = null;

/** Installiert GL-Hülle und `window.__perf`; VOR dem Erzeugen des WebGL-Kontexts aufrufen. */
export function installierePerf(meta: PerfMeta): PerfMonitor {
  if (aktiv) return aktiv;
  installiereGlHuelle();
  const m = new PerfMonitor(meta);
  window.__perf = () => m.snapshot();
  window.__perfReset = () => { m.reset(); };
  aktiv = m;
  return m;
}

/** Für die Eingabe-Schicht (011/013): Zeitstempel einer Eingabe mit sichtbarem Feedback melden. */
export function perfEingabe(zeitstempelMs: number): void {
  aktiv?.eingabe(zeitstempelMs);
}

/** true bei `?debug=1`, `?perf=1` (oder im Vite-Dev-Server). */
export function perfGewuenscht(search: string, dev: boolean): boolean {
  const q = new URLSearchParams(search);
  const an = (n: string): boolean => {
    const v = q.get(n);
    return v !== null && v !== '0' && v !== 'false';
  };
  return dev || an('debug') || an('perf');
}
