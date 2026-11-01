/**
 * Gesamter Spielzustand – die EINE Stelle, an der sein Typ steht (Grundlage für Ticket 009).
 *
 * Regeln:
 * - Rein JSON-serialisierbar: nur Zahlen, Strings, Booleans, null, Arrays, einfache Objekte.
 *   `JSON.parse(JSON.stringify(z))` ergibt einen gleichwertigen Zustand (Unit-Test).
 * - Kein Verweis auf Stammdaten-Objekte, nur Inhalts-IDs; Stammdaten liegen im `Katalog`.
 * - `arbeit` ist der laufende Arbeitsschritt. Nach Neuladen `nachNeuladen()` anwenden:
 *   mitten im Sägen → Brett ungeschnitten, Markierung bleibt (holz-brett-zuschnitt §6).
 * - Zuordnung zur SpielstandDatei (ADR 0003): alles hier gehört in den Abschnitt `kern`.
 */
import type { Katalog } from './modul';
import type { Zug } from './prozesse';
import type { Auftrag, EndeId, InhaltsId, Inventar, Qualitaet } from './typen';
import { STARTGELD } from './wirtschaft';
import { auftragErzeugen } from './auftraege';
import { zufallsquelle } from './zufall';

export type Phase = 'bezugsende' | 'messen' | 'anreissen' | 'ansetzen' | 'saegen' | 'ergebnis';

export interface ZuschnittErgebnis {
  teilId: string;
  restId: string | null;
  laenge_ist_mm: number;
  qualitaet: Qualitaet;
  /** Verkaufspreis bei Ablieferung (0 bei Ausschuss). */
  preis: number;
  messwerte: Record<string, number>;
}

/** Laufender Zuschnitt (ein Schnitt, Bezugsende wählbar; kein Kappschnitt im Slice). */
export interface ZuschnittZustand {
  phase: Phase;
  werkstueckId: string;
  auftragId: string;
  werkzeugId: InhaltsId;
  messzeugId: InhaltsId;
  bezugsende: EndeId | null;
  markierung_mm: number | null;
  blattversatz_mm: number;
  stuetzen: boolean;
  zuege: Zug[];
  drift_grad: number;
  ergebnis: ZuschnittErgebnis | null;
}

export interface Spielzustand {
  inventar: Inventar;
  auftraege: Auftrag[];
  /** Skill-Bereich → Fortschritt. Im Slice nur XP zählen, keine Knoten. */
  skills: Record<InhaltsId, { xp: number; knoten: InhaltsId[] }>;
  zaehler: Record<InhaltsId, number>;
  /** Fortschritt der Lernkurve (abgelieferte Aufträge); UI entscheidet über Hilfen. */
  tutorial: number;
  /** Zustand des gesäten Zufalls (32 Bit). */
  zufallSaat: number;
  /** Zähler für Instanz-IDs (`ws_1`, `af_2` …), deterministisch. */
  naechsteNr: number;
  arbeit: ZuschnittZustand | null;
}

/**
 * Neuer Spielstand: Startgeld, alle kostenlosen Werkzeuge des Katalogs, leeres Lager und ein angebotener
 * Auftrag aus der ersten Vorlage (mit deren Startwerten, z. B. 600 mm ± 1 mm).
 */
export function neuerSpielzustand(katalog: Katalog, saat: number): Spielzustand {
  const z: Spielzustand = {
    inventar: {
      geld: STARTGELD,
      schulden: 0,
      werkstuecke: [],
      gegenstaende: [],
      werkzeuge: Object.values(katalog.werkzeuge)
        .filter((w) => w.preis === 0)
        .map((w) => ({ werkzeugId: w.id })),
    },
    auftraege: [],
    skills: {},
    zaehler: {},
    tutorial: 0,
    zufallSaat: saat >>> 0,
    naechsteNr: 1,
    arbeit: null,
  };
  const vorlage = Object.values(katalog.auftragVorlagen)[0];
  if (vorlage !== undefined) {
    const rng = zufallsquelle(z.zufallSaat);
    z.auftraege.push(auftragErzeugen(katalog, vorlage, `af_${String(z.naechsteNr)}`, rng.zufall, true));
    z.naechsteNr += 1;
    z.zufallSaat = rng.saat();
  }
  return z;
}

/** Nach Neuladen: ein unterbrochener Sägevorgang beginnt wieder beim Ansetzen; Markierung bleibt. */
export function nachNeuladen(z: Spielzustand): Spielzustand {
  if (z.arbeit?.phase !== 'saegen') return z;
  return { ...z, arbeit: { ...z.arbeit, phase: 'ansetzen', zuege: [], drift_grad: 0 } };
}
