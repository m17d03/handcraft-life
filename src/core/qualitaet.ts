/**
 * Qualitätsbewertung aus Daten (`Bewertung` pro Produkt), holz-brett-zuschnitt §4.2 und modul-vertrag §4.4.
 * Stufen und Preisfaktoren sind Kern (Wirtschaft ist Kern, core-loop §5).
 */
import type { Bewertung, InhaltsId, Qualitaet, Stufe, Ursache } from './typen';

export const STUFEN: readonly { stufe: Exclude<Stufe, 'ausschuss'>; abQ: number; preisfaktor: number }[] = [
  { stufe: 'A', abQ: 90, preisfaktor: 1.3 },
  { stufe: 'B', abQ: 75, preisfaktor: 1.0 },
  { stufe: 'C', abQ: 55, preisfaktor: 0.7 },
  { stufe: 'D', abQ: 35, preisfaktor: 0.4 },
];

const RANG: Record<Stufe, number> = { A: 4, B: 3, C: 2, D: 1, ausschuss: 0 };

export const URSACHE_SAUBER: InhaltsId = 'kern.text.sauber';

export function stufeAusQ(q: number): Stufe {
  for (const s of STUFEN) if (q >= s.abQ) return s.stufe;
  return 'ausschuss';
}

export function preisfaktor(stufe: Stufe): number {
  return STUFEN.find((s) => s.stufe === stufe)?.preisfaktor ?? 0;
}

/** Ist Stufe `x` mindestens so gut wie `y`? */
export function mindestens(x: Stufe, y: Stufe): boolean {
  return RANG[x] >= RANG[y];
}

/** Lineare Rampe: volle Punkte bis `vollBis`, null ab `nullAb`. */
export function rampe(punkte: number, wert: number, vollBis: number, nullAb: number): number {
  const anteil = 1 - (wert - vollBis) / (nullAb - vollBis);
  return punkte * Math.min(Math.max(anteil, 0), 1);
}

export interface BewertungEingabe {
  messwerte: Record<string, number>;
  /** Merkmal-IDs, die im fertigen Teil liegen (Fläche und Enden). */
  merkmale: ReadonlySet<InhaltsId>;
  /** Auftragstoleranz: Schlüssel = Messwert, Wert = erlaubte Abweichung. */
  toleranz: Record<string, number>;
  /** Ursachen des Prozesses, wichtigste zuerst. */
  ursachen: readonly Ursache[];
  auftragId: string;
}

export function bewerten(b: Bewertung, e: BewertungEingabe): Qualitaet {
  const punkte: Record<string, number> = {};
  const verluste: { verlust: number; ursache: InhaltsId; messwert: string | null; wert: number }[] = [];
  let summe = 0;

  for (const k of b.kriterien) {
    const wert = e.messwerte[k.messwert] ?? 0;
    const p = rampe(k.punkte, wert, k.voll_bis, k.null_ab);
    punkte[k.messwert] = Math.round(p * 100) / 100;
    summe += p;
    verluste.push({ verlust: k.punkte - p, ursache: k.ursache, messwert: k.messwert, wert });
  }
  for (const f of b.feste) {
    const vorhanden = e.merkmale.has(f.merkmal);
    const p = vorhanden ? f.punkte - f.abzug : f.punkte;
    punkte[f.merkmal] = p;
    summe += p;
    if (vorhanden) verluste.push({ verlust: f.abzug, ursache: f.merkmal, messwert: null, wert: 0 });
  }

  const q = Math.round(summe);
  let stufe = stufeAusQ(q);
  let hauptursache: { id: InhaltsId; wert: number } | null = null;

  // Sonderregeln: Ausschuss unabhängig von Q.
  const ausschussMerkmal = b.ausschuss_wenn.find((id) => e.merkmale.has(id));
  if (ausschussMerkmal !== undefined) {
    stufe = 'ausschuss';
    hauptursache = { id: ausschussMerkmal, wert: 0 };
  }
  for (const g of b.ausschuss_wenn_messwert ?? []) {
    const wert = e.messwerte[g.messwert];
    if (hauptursache === null && wert !== undefined && wert <= g.kleinerGleich) {
      stufe = 'ausschuss';
      hauptursache = { id: g.ursache, wert };
    }
  }

  // Auftragstoleranz kappt die Stufe (Director: höchstens C).
  const verletzt = Object.entries(e.toleranz).find(([messwert, tol]) => (e.messwerte[messwert] ?? 0) > tol);
  if (verletzt !== undefined && b.toleranz_kappt_auf !== undefined && !mindestens(b.toleranz_kappt_auf, stufe)) {
    stufe = b.toleranz_kappt_auf;
  }

  if (hauptursache === null) {
    const messwertUrsache = (messwert: string): { id: InhaltsId; wert: number } | null => {
      const u = e.ursachen.find((x) => x.messwert === messwert);
      return u === undefined ? null : { id: u.id, wert: u.wert };
    };
    if (verletzt !== undefined) {
      const [messwert] = verletzt;
      const k = b.kriterien.find((x) => x.messwert === messwert);
      hauptursache = messwertUrsache(messwert) ?? {
        id: k?.ursache ?? URSACHE_SAUBER,
        wert: e.messwerte[messwert] ?? 0,
      };
    } else {
      const groesster = verluste.reduce<(typeof verluste)[number] | null>(
        (max, v) => (v.verlust > (max?.verlust ?? 0) ? v : max),
        null,
      );
      if (groesster === null) {
        hauptursache = { id: URSACHE_SAUBER, wert: 0 };
      } else {
        hauptursache = (groesster.messwert === null ? null : messwertUrsache(groesster.messwert)) ?? {
          id: groesster.ursache,
          wert: groesster.wert,
        };
      }
    }
  }

  return { q, stufe, punkte, hauptursache: hauptursache.id, hauptursacheWert: hauptursache.wert, auftragId: e.auftragId };
}
