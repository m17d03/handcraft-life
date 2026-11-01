/**
 * Masse und Lage der Werkstatt in Metern (Welt) – ohne Engine, damit Picking, Koordinaten und Tests
 * dieselben Zahlen verwenden wie das Bild. Brett-Masse aus `docs/design/holz-brett-zuschnitt.md` §1
 * (Fichte 2000 × 140 × 18 mm).
 */
import { grad, yawPitchTowards, type Aabb, type Vec3 } from './mathe';

export const RAUM = { breite: 6, tiefe: 5, hoehe: 2.8, wand: 0.12 } as const;

export const WERKBANK = {
  x: 0,
  z: -2.0,
  // Masse der Werkbank aus werkbank.glb (1,5 × 0,6 m), beim Einbau auf 1,8 × 0,66 m gestreckt (Ticket 013):
  // das 2-m-Rohbrett steht links und rechts je 10 cm über – wie beim echten Ablängen.
  laenge: 1.8,
  tiefe: 0.66,
  hoehe: 0.9, // Oberkante Platte
  platte: 0.06,
} as const;

export const BRETT = {
  standardLaengeMm: 2000,
  breiteMm: 140,
  dickeMm: 18,
  /** Brettmitte (z) auf der Werkbank – vorne, nah am Spieler */
  z: -1.8,
  /** Mitte des Bretts in x; Ende 'a' liegt links (−x), Ende 'b' rechts (+x) */
  x: 0,
  faseMm: 0.8,
  /** Schnittfuge der Säge */
  fugeMm: 1.2,
  /** Reststück: nach hinten geschoben und leicht abgerückt */
  restVersatzZ: -0.22,
  restAbstandM: 0.04,
} as const;

export const BRETT_OBEN_Y = WERKBANK.hoehe + BRETT.dickeMm / 1000;

export const WERKBANK_AABB: Aabb = {
  min: [WERKBANK.x - WERKBANK.laenge / 2, 0, WERKBANK.z - WERKBANK.tiefe / 2],
  max: [WERKBANK.x + WERKBANK.laenge / 2, WERKBANK.hoehe, WERKBANK.z + WERKBANK.tiefe / 2],
};

/** Grundfläche der Werkbank (xz) für die Kollision der Ich-Kamera. */
export const WERKBANK_GRUNDFLAECHE = {
  minX: WERKBANK_AABB.min[0],
  maxX: WERKBANK_AABB.max[0],
  minZ: WERKBANK_AABB.min[2],
  maxZ: WERKBANK_AABB.max[2],
} as const;

const AUGENHOEHE = 1.65;
const START_AUGE: Vec3 = [0.45, AUGENHOEHE, -0.25];
const START_BLICK = yawPitchTowards(START_AUGE, [0.0, WERKBANK.hoehe + 0.12, BRETT.z - 0.1]);

export const KAMERA = {
  fovY: grad(50),
  near: 0.03,
  far: 30,
  augenhoehe: AUGENHOEHE,
  start: { position: START_AUGE, yaw: START_BLICK.yaw, pitch: START_BLICK.pitch },
} as const;

export const ARBEITSANSICHT = {
  /** Blick schräg von oben auf das Brett */
  neigung: grad(-52),
  /** Dauer der Kamerafahrt (Abnahme: ≤ 600 ms) */
  fahrtMs: 450,
  /** Rand links/rechts neben dem Brett */
  randM: 0.2, // Brettenden bleiben ausserhalb von Notch/Randzone (Bezugsende antippen)
  minAbstand: 0.55,
  maxAbstand: 1.6,
} as const;

/** Raumgrenzen für die Ich-Kamera. */
export const BEGEHBAR = {
  minX: -RAUM.breite / 2,
  maxX: RAUM.breite / 2,
  minZ: -RAUM.tiefe / 2,
  maxZ: RAUM.tiefe / 2,
  hindernisse: [WERKBANK_GRUNDFLAECHE],
} as const;
