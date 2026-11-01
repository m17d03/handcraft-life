/**
 * Eine Szenenbeschreibung für alle drei Engines (Ticket 005): Raum 6 × 4 m, Werkbank, Holzbalken,
 * Säge, 20 Kleinteile als Instanzen, 1 Richtungslicht mit Schatten + Umgebungslicht.
 * Farben als sRGB-Hex, Lichtstärken in "Albedo-Multiplikator"-Einheiten (Lambert ohne 1/π);
 * die Adapter rechnen in die Konvention ihrer Engine um (Three und Babylon-PBR: × π, PlayCanvas: × 1;
 * per Screenshot-Vergleich abgeglichen).
 */
import { box, cylinder, type MeshData } from './geometry';
import { composeMatrix, normalize, yawPitchTowards, type Aabb, type Vec3 } from './math';

export type MaterialId = 'wood' | 'beam' | 'floor' | 'wall' | 'steel' | 'handle' | 'tool' | 'cutLine';

export interface MaterialSpec {
  readonly color: string; // sRGB-Hex; bei Holz Multiplikator für die Textur
  readonly roughness: number;
  readonly metalness: number;
  readonly woodTexture: boolean;
}

export const MATERIALS: Readonly<Record<MaterialId, MaterialSpec>> = {
  wood: { color: '#ffffff', roughness: 1, metalness: 0, woodTexture: true },
  beam: { color: '#ffffff', roughness: 1, metalness: 0, woodTexture: true },
  floor: { color: '#77706a', roughness: 0.9, metalness: 0, woodTexture: false },
  wall: { color: '#cfc2ad', roughness: 0.95, metalness: 0, woodTexture: false },
  steel: { color: '#b4b8bd', roughness: 0.4, metalness: 0.8, woodTexture: false },
  handle: { color: '#8a3320', roughness: 0.6, metalness: 0, woodTexture: false },
  tool: { color: '#3d5a48', roughness: 0.5, metalness: 0.2, woodTexture: false },
  cutLine: { color: '#14100c', roughness: 0.9, metalness: 0, woodTexture: false },
};

/**
 * Hervorhebung des ausgewählten Balkens (sRGB-Hex): Albedo-Tönung + leichtes Eigenleuchten.
 * Nur Eigenleuchten ging im hellen Holz unter ACES unter (im Spike per Screenshot geprüft).
 */
export const HIGHLIGHT_TINT = '#ff8c3a';
export const HIGHLIGHT_EMISSIVE = '#4a1e00';

export interface PartSpec {
  readonly id: string;
  readonly mesh: MeshData;
  readonly material: MaterialId;
  readonly position: Vec3;
  readonly castShadow: boolean;
  readonly receiveShadow: boolean;
}

export interface InstancedSpec {
  readonly id: string;
  readonly mesh: MeshData;
  readonly material: MaterialId;
  readonly matrices: readonly Float32Array[]; // je 16 Werte, spaltenweise
}

export const ROOM = { width: 6, depth: 4, height: 2.8, wall: 0.1 } as const;

const BENCH_TOP_Y = 0.9;
const BENCH = { x: 0, z: -1.45, w: 2.0, d: 0.7 } as const;
export const BEAM_SIZE = { length: 1.2, height: 0.1, depth: 0.08 } as const;
export const BEAM_CENTER: Vec3 = [-0.15, BENCH_TOP_Y + BEAM_SIZE.height / 2, -1.4];

export const BEAM_AABB: Aabb = {
  min: [BEAM_CENTER[0] - BEAM_SIZE.length / 2, BEAM_CENTER[1] - BEAM_SIZE.height / 2, BEAM_CENTER[2] - BEAM_SIZE.depth / 2],
  max: [BEAM_CENTER[0] + BEAM_SIZE.length / 2, BEAM_CENTER[1] + BEAM_SIZE.height / 2, BEAM_CENTER[2] + BEAM_SIZE.depth / 2],
};

/** Werkbank-Grundfläche (xz) für die Kollision der Kamera. */
export const BENCH_FOOTPRINT = { minX: BENCH.x - BENCH.w / 2, maxX: BENCH.x + BENCH.w / 2, minZ: BENCH.z - BENCH.d / 2, maxZ: BENCH.z + BENCH.d / 2 } as const;

/** Schnittlinie: dünne Scheibe, etwas grösser als der Balkenquerschnitt, wird entlang X verschoben. */
export const CUT_LINE_MESH = box(0.003, BEAM_SIZE.height + 0.003, BEAM_SIZE.depth + 0.003);

export const LIGHT = {
  sunDirection: normalize([-0.35, -1, -0.45]), // Richtung, in die das Licht fällt
  sunColor: '#ffe2bd',
  sunIntensity: 2.4,
  ambientColor: '#cdbba5',
  ambientIntensity: 0.45,
  shadowMapSize: 2048,
  clearColor: '#2a221b',
} as const;

const EYE_HEIGHT = 1.65;
const START_EYE: Vec3 = [0.75, EYE_HEIGHT, 0.55];
const START_LOOK = yawPitchTowards(START_EYE, BEAM_CENTER);

export const CAMERA = {
  fovY: (50 * Math.PI) / 180,
  near: 0.05,
  far: 30,
  eyeHeight: EYE_HEIGHT,
  start: { position: START_EYE, yaw: START_LOOK.yaw, pitch: START_LOOK.pitch },
} as const;

function buildParts(): PartSpec[] {
  const parts: PartSpec[] = [];
  const part = (id: string, mesh: MeshData, material: MaterialId, position: Vec3, cast = true): void => {
    parts.push({ id, mesh, material, position, castShadow: cast, receiveShadow: true });
  };
  const { width: W, depth: D, height: H, wall: T } = ROOM;
  // Raum: Wände werfen keine Schatten (offene Decke, Licht wie durch ein Oberlicht).
  part('floor', box(W, 0.1, D, 2), 'floor', [0, -0.05, 0], false);
  part('wall-back', box(W, H, T, 2), 'wall', [0, H / 2, -D / 2 - T / 2], false);
  part('wall-front', box(W, H, T, 2), 'wall', [0, H / 2, D / 2 + T / 2], false);
  part('wall-left', box(T, H, D, 2), 'wall', [-W / 2 - T / 2, H / 2, 0], false);
  part('wall-right', box(T, H, D, 2), 'wall', [W / 2 + T / 2, H / 2, 0], false);
  // Werkbank
  const topT = 0.06;
  part('bench-top', box(BENCH.w, topT, BENCH.d), 'wood', [BENCH.x, BENCH_TOP_Y - topT / 2, BENCH.z]);
  const legH = BENCH_TOP_Y - topT;
  const lx = BENCH.w / 2 - 0.1;
  const lz = BENCH.d / 2 - 0.08;
  for (const [i, sx, sz] of [
    [1, -1, -1],
    [2, 1, -1],
    [3, -1, 1],
    [4, 1, 1],
  ] as const) {
    part(`bench-leg-${String(i)}`, box(0.08, legH, 0.08), 'wood', [BENCH.x + sx * lx, legH / 2, BENCH.z + sz * lz]);
  }
  part('bench-shelf', box(BENCH.w - 0.2, 0.03, BENCH.d - 0.12), 'wood', [BENCH.x, 0.25, BENCH.z]);
  // Balken (Werkstück)
  part('beam', box(BEAM_SIZE.length, BEAM_SIZE.height, BEAM_SIZE.depth), 'beam', BEAM_CENTER);
  // Säge: Blatt + Griff, liegt flach rechts auf der Bank
  part('saw-blade', box(0.45, 0.002, 0.11), 'steel', [0.6, BENCH_TOP_Y + 0.001, -1.62]);
  part('saw-handle', box(0.13, 0.03, 0.1), 'handle', [0.885, BENCH_TOP_Y + 0.015, -1.62]);
  return parts;
}

/** Deterministischer Pseudozufall, damit alle Engines dieselben Positionen bekommen. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function buildInstances(): InstancedSpec[] {
  const r = rng(5);
  const screws: Float32Array[] = [];
  for (let i = 0; i < 12; i++) {
    const x = 0.45 + r() * 0.5;
    const z = -1.35 + r() * 0.2;
    screws.push(composeMatrix([x, BENCH_TOP_Y + 0.005, z], r() * Math.PI, Math.PI / 2));
  }
  const tools: Float32Array[] = [];
  for (let i = 0; i < 8; i++) {
    const onShelf = i >= 4;
    const x = -0.85 + (i % 4) * 0.22 + r() * 0.05;
    const y = onShelf ? 0.25 + 0.015 + 0.015 : BENCH_TOP_Y + 0.015;
    const z = (onShelf ? -1.5 : -1.65) + r() * 0.08;
    tools.push(composeMatrix([x, y, z], (r() - 0.5) * 0.8, 0));
  }
  return [
    { id: 'screws', mesh: cylinder(0.004, 0.045, 10), material: 'steel', matrices: screws },
    { id: 'tools', mesh: box(0.14, 0.03, 0.04), material: 'tool', matrices: tools },
  ];
}

export const PARTS: readonly PartSpec[] = buildParts();
export const INSTANCES: readonly InstancedSpec[] = buildInstances();

/** Dreiecke der Szene ohne Schattenpass (Kontrollwert für die Messung). */
export function sceneTriangleCount(withCutLine: boolean): number {
  let n = 0;
  for (const p of PARTS) n += p.mesh.indices.length / 3;
  for (const g of INSTANCES) n += (g.mesh.indices.length / 3) * g.matrices.length;
  if (withCutLine) n += CUT_LINE_MESH.indices.length / 3;
  return n;
}
