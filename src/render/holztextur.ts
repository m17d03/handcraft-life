/**
 * Prozedurale PBR-Holztextur Fichte (aus spikes/shared/textures.ts, Farben auf Stil A abgestimmt:
 * Fichte hell #E3C08D). Maserung entlang u, kachelbar in u und v. Selbst erzeugt, keine externen Assets.
 * Ausgabe als RGBA8:
 *  - albedo: sRGB
 *  - orm:    R = Okklusion (1), G = Rauheit, B = Metall (0) – glTF-Packung, linear
 *  - normal: Tangentenraum, OpenGL-Konvention (+Y), linear
 * Andere Hölzer (Eiche, Boden) tönen dieselbe Textur über die Materialfarbe ab.
 */
export interface HolzTexturen {
  readonly groesse: number;
  readonly albedo: Uint8Array;
  readonly orm: Uint8Array;
  readonly normal: Uint8Array;
}

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Periodisches Value-Noise: Gitter (px × py) wiederholt sich, u, v in [0, 1). */
function rauschen(u: number, v: number, px: number, py: number, seed: number): number {
  const x = u * px;
  const y = v * py;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const ix0 = ((x0 % px) + px) % px;
  const iy0 = ((y0 % py) + py) % py;
  const ix1 = (ix0 + 1) % px;
  const iy1 = (iy0 + 1) % py;
  const a = hash(ix0, iy0, seed);
  const b = hash(ix1, iy0, seed);
  const c = hash(ix0, iy1, seed);
  const d = hash(ix1, iy1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const RINGE = 44; // Jahresringe pro Kachel (über v)
const FRUEHHOLZ = [230, 205, 165] as const; // sRGB, nahe #E3C08D
const SPAETHOLZ = [178, 134, 88] as const; // sRGB

/** Erzeugt die drei Karten; `groesse` = Kantenlänge in Pixeln (Zweierpotenz). */
export function erzeugeHolzTexturen(groesse = 1024): HolzTexturen {
  const n = groesse * groesse;
  const hoehe = new Float32Array(n);
  const albedo = new Uint8Array(n * 4);
  const orm = new Uint8Array(n * 4);
  const normal = new Uint8Array(n * 4);
  for (let y = 0; y < groesse; y++) {
    const v = y / groesse;
    for (let x = 0; x < groesse; x++) {
      const u = x / groesse;
      const welle = rauschen(u, v, 2, 3, 1) * 1.4 + rauschen(u, v, 5, 8, 2) * 0.3 + rauschen(u, v, 1, 16, 6) * 0.8;
      const ring = (v * RINGE + welle) % 1;
      // Ringbreite schwankt (Jahre mit mehr/weniger Zuwachs), Spätholz unterschiedlich kräftig
      const kraft = 0.55 + rauschen(u, v, 1, 24, 7) * 0.45;
      const spaet = smoothstep(0.7, 0.9, ring) * (1 - smoothstep(0.93, 1, ring)) * kraft;
      const faser = rauschen(u, v, 16, 256, 3) * 0.6 + rauschen(u, v, 32, 512, 4) * 0.4;
      const ton = 0.93 + rauschen(u, v, 2, 3, 5) * 0.14;
      const t = Math.min(1, spaet * 0.8 + (faser - 0.5) * 0.22);
      const i = y * groesse + x;
      const o = i * 4;
      for (let c = 0; c < 3; c++) {
        const e = FRUEHHOLZ[c] ?? 0;
        const l = SPAETHOLZ[c] ?? 0;
        albedo[o + c] = Math.max(0, Math.min(255, (e + (l - e) * Math.max(0, t)) * ton));
      }
      albedo[o + 3] = 255;
      const rauh = 0.66 + spaet * 0.1 + (faser - 0.5) * 0.12;
      orm[o] = 255;
      orm[o + 1] = Math.round(Math.min(1, Math.max(0, rauh)) * 255);
      orm[o + 2] = 0;
      orm[o + 3] = 255;
      hoehe[i] = -spaet * 0.6 + faser * 0.4;
    }
  }
  const staerke = 1.6;
  for (let y = 0; y < groesse; y++) {
    for (let x = 0; x < groesse; x++) {
      const xl = (x - 1 + groesse) % groesse;
      const xr = (x + 1) % groesse;
      const yu = (y - 1 + groesse) % groesse;
      const yd = (y + 1) % groesse;
      const dx = ((hoehe[y * groesse + xr] ?? 0) - (hoehe[y * groesse + xl] ?? 0)) * staerke;
      const dy = ((hoehe[yd * groesse + x] ?? 0) - (hoehe[yu * groesse + x] ?? 0)) * staerke;
      const len = Math.hypot(dx, dy, 1);
      const o = (y * groesse + x) * 4;
      normal[o] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      normal[o + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      normal[o + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      normal[o + 3] = 255;
    }
  }
  return { groesse, albedo, orm, normal };
}
