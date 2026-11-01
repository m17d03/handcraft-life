// Reine Gesten-Mathematik (Ticket 011): Zonen, Stick, Tippen/Halten, Raster. Kein DOM.

/** Sperrzone links/rechts gegen Safaris Rand-Wischgesten (pt), zusätzlich zur Safe Area. */
export const RANDZONE_PT = 20;
/** Stick-Radius (pt). */
export const STICK_RADIUS_PT = 50;
/** Bewegung, ab der ein Finger nicht mehr als Tippen/Halten gilt (pt). */
export const TIPP_TOLERANZ_PT = 10;
/** Haltedauer für den Befehl `halten` (ms). */
export const HALTEN_MS = 300;
/** Raster des Massbands (mm). */
export const MASSBAND_RASTER_MM = 0.5;
/** Grenze des seitlichen Blattversatzes (mm). */
export const BLATT_VERSATZ_MAX_MM = 3;
/** Raster des Blattversatzes (mm). */
export const BLATT_RASTER_MM = 0.1;

export interface SafeArea {
  links: number;
  rechts: number;
  oben: number;
  unten: number;
}

export const KEINE_SAFE_AREA: SafeArea = { links: 0, rechts: 0, oben: 0, unten: 0 };

export type Zone = 'links' | 'rechts' | 'rand';

/** Welche Erkunden-Zone ein Aufsetzpunkt trifft. Rand = gehört Safari, wird ignoriert. */
export function zoneFuer(x: number, breite: number, safe: SafeArea, randPt = RANDZONE_PT): Zone {
  if (x < safe.links + randPt || x > breite - safe.rechts - randPt) return 'rand';
  return x < breite / 2 ? 'links' : 'rechts';
}

export interface StickWert {
  vorwaerts: number;
  seitwaerts: number;
  /** Knopfversatz in pt (auf den Radius begrenzt), für die Anzeige. */
  knopfX: number;
  knopfY: number;
}

/** Fingerversatz zum Aufsetzpunkt → Bewegung −1..1 (oben = vorwärts). */
export function stickWert(dx: number, dy: number, radius = STICK_RADIUS_PT): StickWert {
  const d = Math.hypot(dx, dy);
  const k = d > radius ? radius / d : 1;
  const knopfX = dx * k;
  const knopfY = dy * k;
  return { vorwaerts: runde3(-knopfY / radius), seitwaerts: runde3(knopfX / radius), knopfX, knopfY };
}

/** Tippen wird über den Weg erkannt, nicht über eine enge Zeitgrenze (QA-Befund 350 ms). */
export function istOhneBewegung(dx: number, dy: number, toleranz = TIPP_TOLERANZ_PT): boolean {
  return Math.hypot(dx, dy) <= toleranz;
}

/** Wert auf ein Raster runden (z. B. 0,5 mm), ohne Fliesskomma-Reste. */
export function aufRaster(wert: number, raster: number): number {
  const r = Math.round(wert / raster) * raster;
  return Math.round(r * 1000) / 1000 + 0; // +0: −0 vermeiden
}

/**
 * Ziehen in px → neue Rasterposition in mm; gibt das Delta zur zuletzt gemeldeten Position zurück.
 * So summieren sich die gemeldeten Deltas immer exakt zur Rasterposition des Fingers.
 */
export function rasterDelta(wegPx: number, pxProMm: number, bisherMm: number, raster: number): number {
  const ziel = aufRaster(wegPx / Math.max(1e-6, pxProMm), raster);
  return aufRaster(ziel - bisherMm, raster);
}

export function begrenze(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function runde3(v: number): number {
  return Math.round(v * 1000) / 1000 + 0;
}

