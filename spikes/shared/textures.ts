/**
 * Prozedurale PBR-Holztextur (Fichte, Maserung entlang u), kachelbar in u und v.
 * Quelle: selbst erzeugt in diesem Code (periodisches Value-Noise + Jahresringe), keine externen
 * Assets – Asset-Downloads (z. B. Poly Haven) sind in der Cloud-Umgebung gesperrt.
 * Ausgabe als rohe RGBA8-Daten, damit alle Engines dieselben Bytes hochladen:
 *  - albedo: sRGB
 *  - orm:    R = Okklusion (1), G = Rauheit, B = Metall (0) – glTF-Packung, linear
 *  - normal: Tangentenraum, OpenGL-Konvention (+Y), linear
 */
export interface WoodTextures {
  readonly size: number;
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
function noise(u: number, v: number, px: number, py: number, seed: number): number {
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

const RINGS = 24; // Jahresringe pro Kachel (über v)
const EARLY = [214, 168, 112] as const; // Frühholz, sRGB
const LATE = [150, 99, 52] as const; // Spätholz, sRGB

/** Erzeugt die drei Karten. size: Kantenlänge in Pixeln (Zweierpotenz, Standard 1024). */
export function generateWoodTextures(size = 1024): WoodTextures {
  const n = size * size;
  const height = new Float32Array(n);
  const albedo = new Uint8Array(n * 4);
  const orm = new Uint8Array(n * 4);
  const normal = new Uint8Array(n * 4);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // Ringverlauf: Grundfrequenz über v, wellig durch grobes Noise (lang entlang u)
      const wobble = noise(u, v, 3, 6, 1) * 1.6 + noise(u, v, 7, 12, 2) * 0.35;
      const ring = (v * RINGS + wobble) % 1;
      const late = smoothstep(0.62, 0.9, ring) * (1 - smoothstep(0.93, 1, ring));
      // feine Fasern: hochfrequent über v, gestreckt entlang u
      const fiber = noise(u, v, 16, 256, 3) * 0.6 + noise(u, v, 32, 512, 4) * 0.4;
      const tone = 0.92 + noise(u, v, 2, 3, 5) * 0.16;
      const t = Math.min(1, late * 0.85 + (fiber - 0.5) * 0.25);
      const i = y * size + x;
      const o = i * 4;
      for (let c = 0; c < 3; c++) {
        const e = EARLY[c] ?? 0;
        const l = LATE[c] ?? 0;
        albedo[o + c] = Math.max(0, Math.min(255, (e + (l - e) * Math.max(0, t)) * tone));
      }
      albedo[o + 3] = 255;
      const rough = 0.62 + late * 0.12 + (fiber - 0.5) * 0.12;
      orm[o] = 255;
      orm[o + 1] = Math.round(Math.min(1, Math.max(0, rough)) * 255);
      orm[o + 2] = 0;
      orm[o + 3] = 255;
      height[i] = -late * 0.6 + fiber * 0.4;
    }
  }
  // Normalen aus Höhenfeld (zentrale Differenzen, gekachelt)
  const strength = 2.0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xl = (x - 1 + size) % size;
      const xr = (x + 1) % size;
      const yu = (y - 1 + size) % size;
      const yd = (y + 1) % size;
      const dx = ((height[y * size + xr] ?? 0) - (height[y * size + xl] ?? 0)) * strength;
      const dy = ((height[yd * size + x] ?? 0) - (height[yu * size + x] ?? 0)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const o = (y * size + x) * 4;
      normal[o] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      normal[o + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      normal[o + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      normal[o + 3] = 255;
    }
  }
  return { size, albedo, orm, normal };
}

/** Speicher der drei Karten im iPhone-Zielformat (unkomprimiert RGBA8, Mipmaps × 4/3), MB. */
export function woodTextureMemoryMB(size: number): number {
  return (3 * size * size * 4 * (4 / 3)) / (1024 * 1024);
}
