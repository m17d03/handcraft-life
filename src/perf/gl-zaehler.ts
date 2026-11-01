/**
 * Engine-neutrale Zählung (QS-Entwurf §8): dünne Hülle um `WebGL2RenderingContext.prototype.draw*`
 * und die Upload-Aufrufe (aus spikes/shared/perf.ts). Draw Calls/Dreiecke zählen alle Pässe inkl.
 * Schatten. Texturspeicher wird aus den Upload-Aufrufen geschätzt (RGBA8 = 4 Byte/Pixel, Mipmaps +1/3).
 * Nur aktiv, wenn `installiereGlHuelle()` VOR dem Erzeugen des Kontexts lief (Debug/Perf-Modus).
 */

const GL_TRIANGLES = 0x0004;
const GL_TRIANGLE_STRIP = 0x0005;
const GL_TRIANGLE_FAN = 0x0006;

/** Dreiecke eines Draw-Aufrufs: count/3 bei TRIANGLES, count−2 bei Strip/Fan, × Instanzen. */
export function dreieckeJeAufruf(mode: number, count: number, instanzen = 1): number {
  let t = 0;
  if (mode === GL_TRIANGLES) t = Math.floor(count / 3);
  else if (mode === GL_TRIANGLE_STRIP || mode === GL_TRIANGLE_FAN) t = Math.max(0, count - 2);
  return t * Math.max(0, instanzen);
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

/** Bytes pro Pixel aus (internem) Format + Typ; unbekannt → 4. */
export function bytesProPixel(internalFormat: number, type?: number): number {
  const sized = SIZED_BPP[internalFormat];
  if (sized !== undefined) return sized;
  if (internalFormat === 0x1902) return 4; // DEPTH_COMPONENT
  const komp = internalFormat === 0x1907 ? 3 : internalFormat === 0x1909 || internalFormat === 0x1906 ? 1 : internalFormat === 0x190a ? 2 : 4;
  const jeKomp = type === 0x1406 ? 4 : type === 0x140b || type === 0x8d61 ? 2 : 1; // FLOAT, HALF_FLOAT
  return komp * jeKomp;
}

interface TexInfo {
  stufen: Map<string, number>; // "face:level" → Bytes
  mip: boolean;
  storage: number; // texStorage-Bytes (inkl. Mips)
}

const frame = { drawCalls: 0, triangles: 0 };
const texturen = new Map<WebGLTexture, TexInfo>();
const puffer = new Map<WebGLBuffer, number>();
let aktiveEinheit = 0;
const gebunden = new Map<string, WebGLTexture | null>(); // "unit:target"
const gebundenerPuffer = new Map<number, WebGLBuffer | null>();
let installiert = false;

const CUBE_FACE_MIN = 0x8515;
const CUBE_FACE_MAX = 0x851a;
const GL_TEXTURE_CUBE_MAP = 0x8513;

const bindeZiel = (target: number): number => (target >= CUBE_FACE_MIN && target <= CUBE_FACE_MAX ? GL_TEXTURE_CUBE_MAP : target);

function texFuer(target: number): TexInfo | null {
  const tex = gebunden.get(`${String(aktiveEinheit)}:${String(bindeZiel(target))}`);
  if (!tex) return null;
  let info = texturen.get(tex);
  if (!info) {
    info = { stufen: new Map(), mip: false, storage: 0 };
    texturen.set(tex, info);
  }
  return info;
}

function quellGroesse(src: unknown): { w: number; h: number } | null {
  if (src === null || typeof src !== 'object') return null;
  const o = src as Record<string, unknown>;
  const w = o['videoWidth'] ?? o['naturalWidth'] ?? o['displayWidth'] ?? o['width'];
  const h = o['videoHeight'] ?? o['naturalHeight'] ?? o['displayHeight'] ?? o['height'];
  return typeof w === 'number' && typeof h === 'number' ? { w, h } : null;
}

function huelle(proto: object, name: string, vorher: (args: unknown[]) => void, nachher?: (ergebnis: unknown) => void): void {
  const desc = Object.getOwnPropertyDescriptor(proto, name);
  const orig: unknown = desc?.value;
  if (typeof orig !== 'function') return;
  const fn = orig as (...a: unknown[]) => unknown;
  Object.defineProperty(proto, name, {
    ...desc,
    value: function (this: WebGL2RenderingContext, ...args: unknown[]): unknown {
      vorher(args);
      const r = fn.apply(this, args);
      nachher?.(r);
      return r;
    },
  });
}

const zahl = (v: unknown): number => (typeof v === 'number' ? v : 0);

/** Muss VOR dem Erzeugen des WebGL-Kontexts aufgerufen werden. Mehrfachaufruf ist harmlos. */
export function installiereGlHuelle(): void {
  if (installiert || typeof WebGL2RenderingContext === 'undefined') return;
  installiert = true;
  for (const proto of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype] as object[]) {
    const draw = (modeIdx: number, countIdx: number, instIdx: number | null) => (a: unknown[]) => {
      frame.drawCalls++;
      frame.triangles += dreieckeJeAufruf(zahl(a[modeIdx]), zahl(a[countIdx]), instIdx === null ? 1 : zahl(a[instIdx]));
    };
    huelle(proto, 'drawArrays', draw(0, 2, null));
    huelle(proto, 'drawElements', draw(0, 1, null));
    huelle(proto, 'drawArraysInstanced', draw(0, 2, 3));
    huelle(proto, 'drawElementsInstanced', draw(0, 1, 4));
    huelle(proto, 'drawRangeElements', draw(0, 3, null));

    huelle(proto, 'activeTexture', (a) => { aktiveEinheit = zahl(a[0]) - 0x84c0; });
    huelle(proto, 'bindTexture', (a) => { gebunden.set(`${String(aktiveEinheit)}:${String(zahl(a[0]))}`, (a[1] ?? null)); });
    huelle(proto, 'deleteTexture', (a) => {
      const t = a[0] as WebGLTexture | null;
      if (t) texturen.delete(t);
    });
    huelle(proto, 'texImage2D', (a) => {
      const target = zahl(a[0]);
      const info = texFuer(target);
      if (!info) return;
      let w: number;
      let h: number;
      let bpp: number;
      if (a.length >= 8) {
        w = zahl(a[3]);
        h = zahl(a[4]);
        bpp = bytesProPixel(zahl(a[2]), zahl(a[7]));
      } else {
        const s = quellGroesse(a[5]);
        if (!s) return;
        w = s.w;
        h = s.h;
        bpp = bytesProPixel(zahl(a[2]), zahl(a[4]));
      }
      info.stufen.set(`${String(target)}:${String(zahl(a[1]))}`, w * h * bpp);
    });
    huelle(proto, 'compressedTexImage2D', (a) => {
      const info = texFuer(zahl(a[0]));
      const daten = a[6];
      if (!info) return;
      const bytes = ArrayBuffer.isView(daten) ? daten.byteLength : zahl(daten);
      info.stufen.set(`${String(zahl(a[0]))}:${String(zahl(a[1]))}`, bytes);
    });
    huelle(proto, 'texStorage2D', (a) => {
      const target = zahl(a[0]);
      const info = texFuer(target);
      if (!info) return;
      const stufen = zahl(a[1]);
      const seiten = target === GL_TEXTURE_CUBE_MAP ? 6 : 1;
      info.storage = zahl(a[3]) * zahl(a[4]) * bytesProPixel(zahl(a[2])) * seiten * (stufen > 1 ? 4 / 3 : 1);
    });
    huelle(proto, 'texStorage3D', (a) => {
      const info = texFuer(zahl(a[0]));
      if (!info) return;
      const stufen = zahl(a[1]);
      info.storage = zahl(a[3]) * zahl(a[4]) * zahl(a[5]) * bytesProPixel(zahl(a[2])) * (stufen > 1 ? 4 / 3 : 1);
    });
    huelle(proto, 'generateMipmap', (a) => {
      const info = texFuer(zahl(a[0]));
      if (info) info.mip = true;
    });

    huelle(proto, 'bindBuffer', (a) => { gebundenerPuffer.set(zahl(a[0]), (a[1] ?? null)); });
    huelle(proto, 'bindVertexArray', () => { gebundenerPuffer.delete(0x8893); });
    huelle(proto, 'createBuffer', () => undefined, (r) => { if (r) puffer.set(r, 0); });
    huelle(proto, 'deleteBuffer', (a) => {
      const b = a[0] as WebGLBuffer | null;
      if (b) puffer.delete(b);
    });
    huelle(proto, 'bufferData', (a) => {
      const b = gebundenerPuffer.get(zahl(a[0]));
      if (!b) return;
      const d = a[1];
      puffer.set(b, typeof d === 'number' ? d : ArrayBuffer.isView(d) || d instanceof ArrayBuffer ? d.byteLength : 0);
    });
  }
}

export const glHuelleAktiv = (): boolean => installiert;

/** Zähler für den nächsten Frame auf 0 setzen. */
export function glFrameBeginn(): void {
  frame.drawCalls = 0;
  frame.triangles = 0;
}

/** Zähler seit glFrameBeginn(). */
export function glFrameZaehler(): { drawCalls: number; triangles: number } {
  return { drawCalls: frame.drawCalls, triangles: frame.triangles };
}

/** Nach Kontextverlust: alle GPU-Objekte sind ungültig; nach Wiederherstellung wird neu gezählt. */
export function glKontextVergessen(): void {
  texturen.clear();
  puffer.clear();
  gebunden.clear();
  gebundenerPuffer.clear();
  aktiveEinheit = 0;
}

export function glSpeicher(): { texturBytes: number; texturAnzahl: number; pufferBytes: number; pufferAnzahl: number } {
  let texturBytes = 0;
  for (const info of texturen.values()) {
    let t = info.storage;
    let basis = 0;
    let nurBasis = true;
    for (const [key, b] of info.stufen) {
      t += b;
      if (key.endsWith(':0')) basis += b;
      else nurBasis = false;
    }
    // generateMipmap ohne explizite Stufen: + 1/3 der Basisstufe
    if (info.mip && info.stufen.size > 0 && nurBasis) t += basis / 3;
    texturBytes += t;
  }
  let pufferBytes = 0;
  for (const b of puffer.values()) pufferBytes += b;
  return { texturBytes, texturAnzahl: texturen.size, pufferBytes, pufferAnzahl: puffer.size };
}
