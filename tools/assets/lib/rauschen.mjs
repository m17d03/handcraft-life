// Deterministisches, kachelbares Rauschen (fester Seed). Keine Abhängigkeiten.

/** Mulberry32: kleiner, reproduzierbarer PRNG. Liefert [0, 1). */
export function zufall(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ganzzahl-Hash → [0, 1). Für Werte pro Jahrring, Diele usw. */
export function hash01(n, seed = 0) {
  let h = Math.imul((n | 0) ^ Math.imul(seed | 0, 0x9e3779b1), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const mod = (a, n) => ((a % n) + n) % n;
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/**
 * Periodisches Gradientenrauschen (Perlin) mit eigenem Seed.
 * `periodisch(x, y, px, py)`: Gitterkoordinaten, Periode px × py (ganzzahlig) → kachelbar.
 * `fbm(u, v, fx, fy, oktaven, gain)`: u, v ∈ [0, 1) Texturkoordinaten, fx/fy Grundfrequenzen
 * (ganzzahlig, dürfen verschieden sein = anisotrop, z. B. Holzfasern). Ergebnis ca. [-1, 1].
 */
export function erzeugeRauschen(seed) {
  const rnd = zufall(seed);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const gx = new Float32Array(256);
  const gy = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const w = rnd() * Math.PI * 2;
    gx[i] = Math.cos(w);
    gy[i] = Math.sin(w);
  }
  const g = (ix, iy, x, y) => {
    const h = perm[perm[ix & 255] + (iy & 255)];
    return gx[h] * x + gy[h] * y;
  };
  function periodisch(x, y, px, py) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const ix0 = mod(x0, px);
    const ix1 = mod(x0 + 1, px);
    const iy0 = mod(y0, py);
    const iy1 = mod(y0 + 1, py);
    const u = fade(fx);
    const v = fade(fy);
    const a = g(ix0, iy0, fx, fy) + u * (g(ix1, iy0, fx - 1, fy) - g(ix0, iy0, fx, fy));
    const b = g(ix0, iy1, fx, fy - 1) + u * (g(ix1, iy1, fx - 1, fy - 1) - g(ix0, iy1, fx, fy - 1));
    return (a + v * (b - a)) * 1.41;
  }
  function fbm(u, v, fx, fy, oktaven = 4, gain = 0.5) {
    let summe = 0;
    let amp = 1;
    let norm = 0;
    let f = 1;
    for (let o = 0; o < oktaven; o++) {
      summe += amp * periodisch(u * fx * f, v * fy * f, fx * f, fy * f);
      norm += amp;
      amp *= gain;
      f *= 2;
    }
    return summe / norm;
  }
  return { periodisch, fbm };
}

export const klemmen = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const glatt = (a, b, x) => {
  const t = klemmen((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const mischen = (a, b, t) => a + (b - a) * t;
export const frac = (x) => x - Math.floor(x);
