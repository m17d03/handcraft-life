import type { Werkstueck } from '../../../src/core/typen';
import { ausfuehren, type Aktion, type AktionsErgebnis } from '../../../src/core/zuschnitt';
import { neuerSpielzustand, type Spielzustand } from '../../../src/core/zustand';
import { standardKatalog } from '../../../src/modules';

export const katalog = standardKatalog();

/** Fehlerfreies Rohbrett mit exakt rechtwinkligen Enden (für Formeltests). */
export function sauberesBrett(id = 'ws_test', aenderung: Partial<Werkstueck> = {}): Werkstueck {
  return {
    id,
    materialId: 'holz.material.fichte-brett-2000',
    masse_mm: { l: 2000, b: 140, d: 18 },
    enden: { a: { winkel_grad: 0, merkmale: [] }, b: { winkel_grad: 0, merkmale: [] } },
    merkmale: [],
    herkunft: 'roh',
    ...aenderung,
  };
}

/** Neuer Zustand mit angenommenem Auftrag und einem sauberen Brett im Lager. */
export function bereit(brett: Werkstueck = sauberesBrett()): Spielzustand {
  const z = neuerSpielzustand(katalog, 42);
  const auftrag = z.auftraege[0];
  if (auftrag === undefined) throw new Error('kein Auftrag');
  auftrag.status = 'angenommen';
  z.inventar.werkstuecke.push(brett);
  return z;
}

/** Führt Aktionen nacheinander aus; schlägt fehl, wenn eine davon abgelehnt wird. */
export function folge(z: Spielzustand, aktionen: Aktion[]): AktionsErgebnis {
  let ergebnis: AktionsErgebnis = { zustand: z, ereignisse: [] };
  for (const a of aktionen) {
    ergebnis = ausfuehren(katalog, ergebnis.zustand, a);
    if (ergebnis.grund !== undefined) throw new Error(`${a.art} abgelehnt: ${ergebnis.grund}`);
  }
  return ergebnis;
}

export function zuege(n: number, seitenabweichung = 0, tempo = 1): Aktion[] {
  return Array.from({ length: n }, () => ({ art: 'saegezug', seitenabweichung, tempo }) as const);
}

/** Kompletter Zuschnitt bis zum Ergebnis. */
export function zuschnitt(
  z: Spielzustand,
  opt: { ende?: 'a' | 'b'; mm?: number; versatz?: number; zuege?: Aktion[]; werkstueckId?: string } = {},
): AktionsErgebnis {
  return folge(z, [
    { art: 'zuschnittBeginnen', werkstueckId: opt.werkstueckId ?? 'ws_test' },
    { art: 'bezugsendeWaehlen', ende: opt.ende ?? 'a' },
    { art: 'markierungSetzen', mm: opt.mm ?? 600 },
    { art: 'anreissen' },
    { art: 'blattVersatzSetzen', mm: opt.versatz ?? 0.8 },
    ...(opt.zuege ?? zuege(8)),
  ]);
}
