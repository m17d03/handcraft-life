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
  const halbeBreite = material.masse_mm.b / 2;
  const endwinkel = (): number => {
    const fehler = zwischen(zufall, -fehlerMax, fehlerMax);
    return (Math.atan(fehler / halbeBreite) * 180) / Math.PI;
  };
  let ws: Werkstueck = {
    id,
    materialId: material.id,
    masse_mm: { ...material.masse_mm },
    enden: { a: { winkel_grad: endwinkel(), merkmale: [] }, b: { winkel_grad: endwinkel(), merkmale: [] } },
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
