import type { EndeId, ErzeugungsRegel, InhaltsId, MaterialDef, Werkstueck, Zufall } from './typen';
import { zwischen } from './zufall';

/** Rundet auf 1/1000 (mm, Grad), damit Gleitkomma-Reste nicht in Anzeige und Vergleiche durchschlagen. */
export function runden3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

/**
 * Neues Rohstück aus Stammdaten. Generisch: unbearbeitete Enden haben einen Winkelfehler, der am
 * Massband-Haken einen Bezugsfehler von höchstens `werte.ende_fehler_max_mm` ergibt (holz-brett-zuschnitt §4.1).
 * Materialtypische Fehler (Endriss, Ast …) setzen die Erzeugungsregeln der Module.
 */
export function werkstueckErzeugen(
  material: MaterialDef,
  id: string,
  zufall: Zufall,
  regeln: readonly ErzeugungsRegel[],
): Werkstueck {
  const fehlerMax = material.werte['ende_fehler_max_mm'] ?? 0;
  // Ein Ende ist sauber (Bezugsfehler ≤ ende_gut_max_mm), das andere sichtbar schief
  // (ende_schlecht_min_mm … ende_fehler_max_mm). Die Wahl des Bezugsendes ist damit eine echte Entscheidung
  // (holz-brett-zuschnitt §2, Director-Entscheid 2026-11-01). Ohne die beiden Werte: beide Enden zufällig.
  const gutMax = material.werte['ende_gut_max_mm'] ?? fehlerMax;
  const schlechtMin = Math.min(material.werte['ende_schlecht_min_mm'] ?? 0, fehlerMax);
  const halbeBreite = material.masse_mm.b / 2;
  const alsWinkel = (fehlerMm: number): number => (Math.atan(fehlerMm / halbeBreite) * 180) / Math.PI;
  const vorzeichen = (): number => (zufall() < 0.5 ? -1 : 1);
  const gutesEnde: EndeId = zufall() < 0.5 ? 'a' : 'b';
  const gut = alsWinkel(zwischen(zufall, -gutMax, gutMax));
  const schlecht = alsWinkel(vorzeichen() * zwischen(zufall, schlechtMin, fehlerMax));
  const endwinkel = (ende: EndeId): number => (ende === gutesEnde ? gut : schlecht);
  let ws: Werkstueck = {
    id,
    materialId: material.id,
    masse_mm: { ...material.masse_mm },
    enden: { a: { winkel_grad: endwinkel('a'), merkmale: [] }, b: { winkel_grad: endwinkel('b'), merkmale: [] } },
    merkmale: [],
    herkunft: 'roh',
  };
  for (const regel of regeln) {
    if (regel.klasse === material.klasse) ws = regel.anwenden(ws, material, zufall);
  }
  return ws;
}

/** Bezugsfehler (mm) beim Messen vom Ende `ende`: Versatz der Haken-Kante gegenüber der Brettmitte. */
export function bezugsfehler(ws: Werkstueck, ende: EndeId): number {
  const winkel = ws.enden[ende].winkel_grad;
  return runden3(Math.tan((winkel * Math.PI) / 180) * (ws.masse_mm.b / 2));
}

/** Alle Merkmal-IDs eines Stücks (Fläche + beide Enden). */
export function merkmalIds(ws: Werkstueck): Set<InhaltsId> {
  const ids = new Set<InhaltsId>();
  for (const m of ws.merkmale) ids.add(m.id);
  for (const m of ws.enden.a.merkmale) ids.add(m.id);
  for (const m of ws.enden.b.merkmale) ids.add(m.id);
  return ids;
}

export function anderesEnde(ende: EndeId): EndeId {
  return ende === 'a' ? 'b' : 'a';
}
