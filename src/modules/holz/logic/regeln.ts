/**
 * Holztypische Regeln zu den Kern-Prozessen (modul-vertrag §4.3): Endriss/Ast beim Erzeugen,
 * Ausriss an der Unterkante bei zu hohem Tempo am Schnittende. „Endriss → Ausschuss“ steht als Daten
 * in der Bewertung des Produkts.
 */
import { datenwert, PROZESS_TRENNEN } from '../../../core/prozesse';
import type { EndeId, ErzeugungsRegel, MaterialRegel } from '../../../core/typen';
import { zwischen } from '../../../core/zufall';
import { MERKMAL_AST, MERKMAL_AUSRISS, MERKMAL_ENDRISS, TEXT_AUSRISS } from '../data/stammdaten';

/** Ausriss-Stufe aus Tempo / Grenzwert: > 1 klein, > 1,5 gross (holz-brett-zuschnitt §4.1). */
export function ausrissStufe(tempoVerhaeltnis: number): 0 | 1 | 2 {
  if (tempoVerhaeltnis > 1.5) return 2;
  if (tempoVerhaeltnis > 1) return 1;
  return 0;
}

export const ausrissRegel: MaterialRegel = {
  klasse: 'holz',
  prozess: PROZESS_TRENNEN,
  anwenden(_ctx, e) {
    const ausriss = ausrissStufe(e.messwerte['tempo_verhaeltnis'] ?? 0);
    const messwerte = { ...e.messwerte, ausriss };
    const [teil, ...rest] = e.werkstuecke;
    if (ausriss === 0 || teil === undefined) return { ...e, messwerte };
    const schnittEnde = { ...teil.enden.b, merkmale: [...teil.enden.b.merkmale, { id: MERKMAL_AUSRISS, wert: ausriss }] };
    return {
      ...e,
      werkstuecke: [{ ...teil, enden: { ...teil.enden, b: schnittEnde } }, ...rest],
      messwerte,
      ursachen: [...e.ursachen, { id: TEXT_AUSRISS, messwert: 'ausriss', wert: ausriss }],
    };
  },
};

export const rohbrettFehlerRegel: ErzeugungsRegel = {
  klasse: 'holz',
  anwenden(ws, material, zufall) {
    const neu = { ...ws, enden: { a: { ...ws.enden.a }, b: { ...ws.enden.b } }, merkmale: [...ws.merkmale] };
    if (zufall() < datenwert(material.werte, 'endriss_p', material.id)) {
      const ende: EndeId = zufall() < 0.5 ? 'a' : 'b';
      const min = datenwert(material.werte, 'endriss_min_mm', material.id);
      const max = datenwert(material.werte, 'endriss_max_mm', material.id);
      const laenge = Math.round(zwischen(zufall, min, max));
      neu.enden[ende] = { ...neu.enden[ende], merkmale: [...neu.enden[ende].merkmale, { id: MERKMAL_ENDRISS, wert: laenge }] };
    }
    if (zufall() < datenwert(material.werte, 'ast_p', material.id)) {
      const rand = 100;
      neu.merkmale.push({ id: MERKMAL_AST, pos_mm: Math.round(zwischen(zufall, rand, ws.masse_mm.l - rand)) });
    }
    return neu;
  },
};
