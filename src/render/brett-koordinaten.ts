/**
 * Umrechnung Brett-mm ↔ Welt ↔ Bildschirm, ohne Engine (Unit-Tests ohne WebGL).
 *
 * Das Brett liegt längs der x-Achse auf der Werkbank. Ende 'a' liegt links (−x), Ende 'b' rechts (+x).
 * mm zählen vom Bezugsende entlang der Brettmitte (Bezugsende null = 'a'). Nach dem Schnitt bleibt das
 * Stück am Bezugsende liegen (ID 'brett'); das Reststück (ID 'reststueck') wird nach hinten geschoben.
 */
import { clamp, projectToScreen, rayHorizontalPlane, screenRay, type Aabb, type Projektion, type Ray, type Vec3 } from './mathe';
import { BRETT, BRETT_OBEN_Y, WERKBANK } from './werkstatt-layout';

export type Bezugsende = 'a' | 'b';

export interface BrettLage {
  readonly laengeMm: number;
  readonly bezugsende: Bezugsende | null;
  /** Ist-Länge des Stücks am Bezugsende nach dem Schnitt; null = ungeschnitten */
  readonly schnittIstMm: number | null;
}

export interface BrettStueck {
  readonly id: 'brett' | 'reststueck';
  readonly laengeMm: number;
  readonly mitte: Vec3; // Mitte des Quaders
  readonly box: Aabb;
}

const BREITE_M = BRETT.breiteMm / 1000;
const DICKE_M = BRETT.dickeMm / 1000;

/** Richtung (+1/−1 in x), in der die mm vom Bezugsende aus wachsen, und x des Bezugsendes. */
export function bezug(lage: BrettLage): { richtung: 1 | -1; ursprungX: number } {
  const halb = lage.laengeMm / 2000;
  return (lage.bezugsende ?? 'a') === 'a'
    ? { richtung: 1, ursprungX: BRETT.x - halb }
    : { richtung: -1, ursprungX: BRETT.x + halb };
}

/** Länge des Stücks am Bezugsende (ganzes Brett, solange ungeschnitten). */
export function hauptLaengeMm(lage: BrettLage): number {
  return lage.schnittIstMm === null ? lage.laengeMm : clamp(lage.schnittIstMm, 0, lage.laengeMm);
}

/** Weltpunkt auf der Brett-Oberseite bei `mm` vom Bezugsende; `querMm` > 0 Richtung Spieler (+z). */
export function mmNachWelt(lage: BrettLage, mm: number, querMm = 0, ueberOberseiteM = 0): Vec3 {
  const { richtung, ursprungX } = bezug(lage);
  return [ursprungX + (richtung * mm) / 1000, BRETT_OBEN_Y + ueberOberseiteM, BRETT.z + querMm / 1000];
}

/** Welt-x → mm vom Bezugsende (ohne Begrenzung). */
export function weltXNachMm(lage: BrettLage, x: number): number {
  const { richtung, ursprungX } = bezug(lage);
  return (x - ursprungX) * richtung * 1000;
}

function quader(x0: number, x1: number, z: number): Aabb {
  return {
    min: [Math.min(x0, x1), WERKBANK.hoehe, z - BREITE_M / 2],
    max: [Math.max(x0, x1), WERKBANK.hoehe + DICKE_M, z + BREITE_M / 2],
  };
}

function stueck(id: BrettStueck['id'], box: Aabb): BrettStueck {
  return {
    id,
    laengeMm: (box.max[0] - box.min[0]) * 1000,
    mitte: [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2],
    box,
  };
}

/** Brett und (nach dem Schnitt) Reststück als Quader in Weltkoordinaten. */
export function brettStuecke(lage: BrettLage): BrettStueck[] {
  const { richtung, ursprungX } = bezug(lage);
  const ist = hauptLaengeMm(lage);
  const teile: BrettStueck[] = [stueck('brett', quader(ursprungX, ursprungX + (richtung * ist) / 1000, BRETT.z))];
  if (lage.schnittIstMm !== null) {
    const startMm = ist + BRETT.fugeMm;
    const restMm = lage.laengeMm - startMm;
    if (restMm > 1) {
      const x0 = ursprungX + (richtung * startMm) / 1000 + richtung * BRETT.restAbstandM;
      teile.push(stueck('reststueck', quader(x0, x0 + (richtung * restMm) / 1000, BRETT.z + BRETT.restVersatzZ)));
    }
  }
  return teile;
}

/**
 * mm vom Bezugsende für einen Strahl, der die Oberseite des Bretts (Stück am Bezugsende) trifft.
 * `toleranzM` erlaubt Wischen knapp neben dem Brett; Ergebnis auf 0..Länge begrenzt.
 */
export function strahlNachBrettMm(lage: BrettLage, ray: Ray, toleranzM = 0.03): number | null {
  const p = rayHorizontalPlane(ray, BRETT_OBEN_Y);
  if (!p) return null;
  const haupt = brettStuecke(lage)[0];
  if (!haupt) return null;
  const b = haupt.box;
  if (p[0] < b.min[0] - toleranzM || p[0] > b.max[0] + toleranzM) return null;
  if (p[2] < b.min[2] - toleranzM || p[2] > b.max[2] + toleranzM) return null;
  return clamp(weltXNachMm(lage, p[0]), 0, haupt.laengeMm);
}

/** Bildschirmpunkt (CSS-px) → mm auf dem Brett. */
export function bildschirmNachBrettMm(proj: Projektion, lage: BrettLage, x: number, y: number): number | null {
  return strahlNachBrettMm(lage, screenRay(proj, x, y));
}

/** mm auf dem Brett (Mittellinie der Oberseite) → Bildschirmpunkt (CSS-px); null, wenn hinter der Kamera. */
export function brettMmNachBildschirm(proj: Projektion, lage: BrettLage, mm: number): { x: number; y: number } | null {
  return projectToScreen(proj, mmNachWelt(lage, mm));
}
