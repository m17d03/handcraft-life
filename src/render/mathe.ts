/**
 * Vektor-, Strahl- und Projektionsrechnung ohne Engine (übernommen aus spikes/shared/math.ts).
 * Rechtshändig, Y oben, Meter; yaw = 0 und pitch = 0 blickt nach −Z – exakt wie eine
 * Three.js-PerspectiveCamera mit `lookAt(eye + forward)` und Up = +Y. Dadurch stimmen Picking und
 * Projektion mit dem Bild überein, ohne dass `three` geladen sein muss (Unit-Tests ohne WebGL).
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
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const grad = (deg: number): number => (deg * Math.PI) / 180;

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

/** Perspektivkamera, wie sie das Bild zeichnet (Grösse in CSS-Pixeln). */
export interface Projektion {
  readonly eye: Vec3;
  readonly forward: Vec3;
  readonly fovY: number; // Radiant, vertikal
  readonly breite: number;
  readonly hoehe: number;
}

function basis(forward: Vec3): { f: Vec3; right: Vec3; up: Vec3 } {
  const f = normalize(forward);
  const right = normalize(cross(f, [0, 1, 0]));
  return { f, right, up: cross(right, f) };
}

/** Strahl durch einen Bildschirmpunkt (CSS-Pixel). */
export function screenRay(p: Projektion, x: number, y: number): Ray {
  const { f, right, up } = basis(p.forward);
  const t = Math.tan(p.fovY / 2);
  const aspect = p.breite / p.hoehe;
  const ndcX = (x / p.breite) * 2 - 1;
  const ndcY = 1 - (y / p.hoehe) * 2;
  const dir = normalize(add(add(f, scale(right, ndcX * t * aspect)), scale(up, ndcY * t)));
  return { origin: p.eye, dir };
}

/** Weltpunkt → CSS-Pixel; null, wenn der Punkt hinter oder auf der Kamera liegt. */
export function projectToScreen(p: Projektion, w: Vec3): { x: number; y: number } | null {
  const { f, right, up } = basis(p.forward);
  const d = sub(w, p.eye);
  const z = dot(d, f);
  if (z <= 1e-6) return null;
  const t = Math.tan(p.fovY / 2);
  const ndcX = dot(d, right) / (z * t * (p.breite / p.hoehe));
  const ndcY = dot(d, up) / (z * t);
  return { x: ((ndcX + 1) / 2) * p.breite, y: ((1 - ndcY) / 2) * p.hoehe };
}

/** Slab-Test Strahl gegen Quader; Abstand t ≥ 0 oder null. */
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

/** Kürzeste Winkeldifferenz b − a in (−π, π]. */
export function winkelDiff(a: number, b: number): number {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Weiche Kurve 0..1 → 0..1 (ruhiger Start und Halt der Kamerafahrt). */
export const smoothstep01 = (t: number): number => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
