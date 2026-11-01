/**
 * Kleine Vektor-/Strahlenmathematik für die Spikes – ohne Engine-Import, damit alle drei Engines
 * exakt dieselbe Kamera, denselben Pick-Strahl und dieselbe Schnittposition rechnen.
 * Koordinaten: rechtshändig, Y oben, Meter, Kamera blickt bei yaw = 0 nach −Z (wie Three/PlayCanvas;
 * Babylon läuft dafür mit `useRightHandedSystem`).
 */
export type Vec3 = readonly [number, number, number];

export interface Aabb {
  readonly min: Vec3;
  readonly max: Vec3;
}

export interface Ray {
  readonly origin: Vec3;
  readonly dir: Vec3; // normiert
}

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const normalize = (a: Vec3): Vec3 => {
  const l = length(a);
  return l === 0 ? [0, 0, 0] : scale(a, 1 / l);
};
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Blickrichtung aus Gieren (um Y) und Neigen (um X); yaw = 0, pitch = 0 → −Z. */
export function forwardFromYawPitch(yaw: number, pitch: number): Vec3 {
  const c = Math.cos(pitch);
  return [-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c];
}

/** yaw/pitch, die von `from` auf `to` blicken (Umkehrung von forwardFromYawPitch). */
export function yawPitchTowards(from: Vec3, to: Vec3): { yaw: number; pitch: number } {
  const d = normalize(sub(to, from));
  return { yaw: Math.atan2(-d[0], -d[2]), pitch: Math.asin(clamp(d[1], -1, 1)) };
}

/**
 * Strahl durch einen Bildschirmpunkt (CSS-Pixel) einer Perspektivkamera mit vertikalem Sichtfeld.
 */
export function screenRay(
  eye: Vec3,
  forward: Vec3,
  fovY: number,
  width: number,
  height: number,
  x: number,
  y: number,
): Ray {
  const f = normalize(forward);
  const right = normalize(cross(f, [0, 1, 0]));
  const up = cross(right, f);
  const t = Math.tan(fovY / 2);
  const aspect = width / height;
  const ndcX = (x / width) * 2 - 1;
  const ndcY = 1 - (y / height) * 2;
  const dir = normalize(add(add(f, scale(right, ndcX * t * aspect)), scale(up, ndcY * t)));
  return { origin: eye, dir };
}

/** Projektion eines Weltpunkts in CSS-Pixel (null, wenn hinter der Kamera). */
export function projectToScreen(
  eye: Vec3,
  forward: Vec3,
  fovY: number,
  width: number,
  height: number,
  p: Vec3,
): { x: number; y: number } | null {
  const f = normalize(forward);
  const right = normalize(cross(f, [0, 1, 0]));
  const up = cross(right, f);
  const d = sub(p, eye);
  const z = dot(d, f);
  if (z <= 1e-6) return null;
  const t = Math.tan(fovY / 2);
  const ndcX = dot(d, right) / (z * t * (width / height));
  const ndcY = dot(d, up) / (z * t);
  return { x: ((ndcX + 1) / 2) * width, y: ((1 - ndcY) / 2) * height };
}

/** Slab-Test Strahl gegen Quader; liefert Abstand t ≥ 0 oder null. */
export function rayAabb(ray: Ray, box: Aabb): number | null {
  let tMin = 0;
  let tMax = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 3; i++) {
    const o = ray.origin[i] ?? 0;
    const d = ray.dir[i] ?? 0;
    const lo = box.min[i] ?? 0;
    const hi = box.max[i] ?? 0;
    if (Math.abs(d) < 1e-12) {
      if (o < lo || o > hi) return null;
      continue;
    }
    let t1 = (lo - o) / d;
    let t2 = (hi - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  return tMin;
}

/** Schnittpunkt Strahl mit waagrechter Ebene y = h (null, wenn parallel oder dahinter). */
export function rayHorizontalPlane(ray: Ray, h: number): Vec3 | null {
  const d = ray.dir[1];
  if (Math.abs(d) < 1e-9) return null;
  const t = (h - ray.origin[1]) / d;
  if (t < 0) return null;
  return add(ray.origin, scale(ray.dir, t));
}

export const pointOnRay = (ray: Ray, t: number): Vec3 => add(ray.origin, scale(ray.dir, t));

/** Quaternion (x, y, z, w), die den Einheitsvektor `from` auf `to` dreht. */
export function quatFromUnitVectors(from: Vec3, to: Vec3): [number, number, number, number] {
  const r = dot(from, to) + 1;
  if (r < 1e-6) {
    // entgegengesetzt: beliebige Achse senkrecht zu from
    const axis = Math.abs(from[0]) > Math.abs(from[2]) ? normalize([-from[1], from[0], 0]) : normalize([0, -from[2], from[1]]);
    return [axis[0], axis[1], axis[2], 0];
  }
  const c = cross(from, to);
  const l = Math.hypot(c[0], c[1], c[2], r);
  return [c[0] / l, c[1] / l, c[2] / l, r / l];
}

/**
 * 4×4-Matrix (spaltenweise, Translation in 12..14 – Layout passt für Three, Babylon und PlayCanvas)
 * aus Position, Drehung um Y und anschliessend um Z (Kleinteile liegen auf der Seite).
 */
export function composeMatrix(pos: Vec3, yaw: number, roll: number): Float32Array {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cz = Math.cos(roll);
  const sz = Math.sin(roll);
  // R = Ry * Rz
  const m = new Float32Array(16);
  m[0] = cy * cz;
  m[1] = sz;
  m[2] = -sy * cz;
  m[4] = -cy * sz;
  m[5] = cz;
  m[6] = sy * sz;
  m[8] = sy;
  m[9] = 0;
  m[10] = cy;
  m[12] = pos[0];
  m[13] = pos[1];
  m[14] = pos[2];
  m[15] = 1;
  return m;
}

/** sRGB-Hex ('#rrggbb') → [r, g, b] in 0..1 (sRGB). */
export function hexToSrgb(hex: string): Vec3 {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export const srgbToLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const linearToSrgb = (c: number): number => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
export const hexToLinear = (hex: string): Vec3 => {
  const s = hexToSrgb(hex);
  return [srgbToLinear(s[0]), srgbToLinear(s[1]), srgbToLinear(s[2])];
};
