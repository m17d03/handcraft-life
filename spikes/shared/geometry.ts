/**
 * Gemeinsame Geometrie: alle drei Engines bekommen identische Vertex-/Indexdaten, damit Dreiecke,
 * UV-Ausrichtung (Holzmaserung entlang der Länge) und Tangenten exakt gleich sind.
 * Front-Faces gegen den Uhrzeigersinn (OpenGL-Konvention).
 */
import { cross, type Vec3 } from './math';

export interface MeshData {
  readonly positions: Float32Array; // xyz
  readonly normals: Float32Array; // xyz
  readonly tangents: Float32Array; // xyzw
  readonly uvs: Float32Array; // uv
  readonly indices: Uint16Array;
}

const FACES: readonly { n: Vec3; u: Vec3; v: Vec3 }[] = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
];

const extent = (a: Vec3, h: Vec3): number => Math.abs(a[0]) * h[0] + Math.abs(a[1]) * h[1] + Math.abs(a[2]) * h[2];

/**
 * Quader um den Ursprung. UVs in Metern / `uvMeters` (weltbezogen, gekachelt), u entlang der
 * X-Achse auf allen Seiten, die X enthalten → Maserung läuft entlang der Länge.
 */
export function box(w: number, h: number, d: number, uvMeters = 1): MeshData {
  const half: Vec3 = [w / 2, h / 2, d / 2];
  const positions: number[] = [];
  const normals: number[] = [];
  const tangents: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const { n, u, v } of FACES) {
    const hu = extent(u, half);
    const hv = extent(v, half);
    const hn = extent(n, half);
    const base = positions.length / 3;
    for (const [su, sv] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      const p: Vec3 = [
        n[0] * hn + u[0] * hu * su + v[0] * hv * sv,
        n[1] * hn + u[1] * hu * su + v[1] * hv * sv,
        n[2] * hn + u[2] * hu * su + v[2] * hv * sv,
      ];
      positions.push(...p);
      normals.push(...n);
      tangents.push(u[0], u[1], u[2], 1);
      uvs.push((hu * su) / uvMeters, (hv * sv) / uvMeters);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return pack(positions, normals, tangents, uvs, indices);
}

/** Zylinder entlang Y um den Ursprung, mit Deckeln. */
export function cylinder(radius: number, height: number, segments = 12): MeshData {
  const positions: number[] = [];
  const normals: number[] = [];
  const tangents: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const hh = height / 2;
  // Mantel
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    for (const y of [-hh, hh]) {
      positions.push(radius * c, y, radius * s);
      normals.push(c, 0, s);
      tangents.push(-s, 0, c, 1);
      uvs.push(i / segments, y > 0 ? 1 : 0);
    }
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    // a: unten i, a+1: oben i, a+2: unten i+1, a+3: oben i+1 – CCW von aussen
    indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  // Deckel
  for (const [y, ny] of [
    [hh, 1],
    [-hh, -1],
  ] as const) {
    const center = positions.length / 3;
    positions.push(0, y, 0);
    normals.push(0, ny, 0);
    tangents.push(1, 0, 0, 1);
    uvs.push(0.5, 0.5);
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      positions.push(radius * Math.cos(a), y, radius * Math.sin(a));
      normals.push(0, ny, 0);
      tangents.push(1, 0, 0, 1);
      uvs.push(0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a));
    }
    for (let i = 0; i < segments; i++) {
      const p = center + 1 + i;
      if (ny > 0) indices.push(center, p + 1, p);
      else indices.push(center, p, p + 1);
    }
  }
  return pack(positions, normals, tangents, uvs, indices);
}

function pack(p: number[], n: number[], t: number[], uv: number[], idx: number[]): MeshData {
  return {
    positions: new Float32Array(p),
    normals: new Float32Array(n),
    tangents: new Float32Array(t),
    uvs: new Float32Array(uv),
    indices: new Uint16Array(idx),
  };
}

export const triangleCount = (m: MeshData): number => m.indices.length / 3;

/** Prüfhilfe: Dreieck i zeigt mit seiner Windung in Richtung der gespeicherten Normale. */
export function faceAgreesWithNormal(m: MeshData, tri: number): boolean {
  const i0 = m.indices[tri * 3] ?? 0;
  const i1 = m.indices[tri * 3 + 1] ?? 0;
  const i2 = m.indices[tri * 3 + 2] ?? 0;
  const p = (i: number): Vec3 => [m.positions[i * 3] ?? 0, m.positions[i * 3 + 1] ?? 0, m.positions[i * 3 + 2] ?? 0];
  const a = p(i0);
  const b = p(i1);
  const c = p(i2);
  const fn = cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]);
  const nn: Vec3 = [m.normals[i0 * 3] ?? 0, m.normals[i0 * 3 + 1] ?? 0, m.normals[i0 * 3 + 2] ?? 0];
  return fn[0] * nn[0] + fn[1] * nn[1] + fn[2] * nn[2] > 0;
}
