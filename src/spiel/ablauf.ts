/**
 * Reine Ablauf-Regeln des Vertical Slice (Ticket 013): welches Brett auf die Bank kommt, welcher HUD-Modus
 * zu welcher Phase gehört, welche Hinweise der geführte erste Durchgang zeigt und was die Ergebniskarte sagt.
 * Kein DOM, keine Engine – die Spielregeln selbst stehen in `src/core` (Fassade `ausfuehren`).
 */
import { SOLL_LAENGE } from '../core/auftraege';
import { textFuer, type Katalog } from '../core/modul';
import { angenommenerAuftrag, MARKIERUNG_RAND_MM } from '../core/zuschnitt';
import type { Auftrag, EndeId, Stufe, Werkstueck } from '../core/typen';
import type { Spielzustand, ZuschnittZustand } from '../core/zustand';
import { MERKMAL_ENDRISS } from '../modules/holz/data/stammdaten';
import type { ErgebnisDaten, HudModus } from '../ui/hud-typen';

/** Erster Kontakt geführt (holz-brett-zuschnitt §5: Auftrag 1–2). */
export const GEFUEHRTE_AUFTRAEGE = 2;

export const istGefuehrt = (z: Spielzustand): boolean => z.tutorial < GEFUEHRTE_AUFTRAEGE;

/** Der Auftrag, für den gerade gearbeitet wird bzw. als Nächstes gearbeitet würde. */
export function aktuellerAuftrag(z: Spielzustand): Auftrag | undefined {
  if (z.arbeit) {
    const id = z.arbeit.auftragId;
    const a = z.auftraege.find((x) => x.id === id);
    if (a) return a;
  }
  return angenommenerAuftrag(z) ?? z.auftraege.find((a) => a.status === 'angeboten');
}

export const sollMm = (a: Auftrag | undefined): number | null => a?.soll[SOLL_LAENGE] ?? null;

/** Mindestlänge eines Stücks für den Auftrag (wie `hatBrauchbaresMaterial` im Kern: Soll + 2 mm). */
export const bedarfMm = (a: Auftrag | undefined): number => (sollMm(a) ?? 0) + 2;

/**
 * Stück für den nächsten Zuschnitt: das kürzeste, das für den Bedarf reicht (Reststücke zuerst verbrauchen);
 * undefined = neues Brett kaufen.
 */
export function stueckWaehlen(z: Spielzustand, bedarf: number): Werkstueck | undefined {
  let bestes: Werkstueck | undefined;
  for (const w of z.inventar.werkstuecke) {
    if (w.masse_mm.l < bedarf) continue;
    if (!bestes || w.masse_mm.l < bestes.masse_mm.l) bestes = w;
  }
  return bestes;
}

/** Endrisslänge (mm) an jedem Ende eines Werkstücks; null = kein Riss. */
export function endrisse(w: Werkstueck | undefined): { a: number | null; b: number | null } {
  const an = (e: EndeId): number | null => {
    const m = w?.enden[e].merkmale.find((x) => x.id === MERKMAL_ENDRISS);
    return m ? (m.laenge_mm ?? 30) : null;
  };
  return { a: an('a'), b: an('b') };
}

/** Getipptes Brettende aus der Position (mm ab Ende a) auf einem Brett der Länge `laenge`. */
export const endeAusMm = (mmAbA: number, laenge: number): EndeId => (mmAbA < laenge / 2 ? 'a' : 'b');

/**
 * HUD-Modus zur Phase. `saegenFreigegeben`: Spieler hat beim Ansetzen „Sägen ›“ getippt (die Phase im Kern
 * wechselt erst mit dem ersten Zug). Nach Neuladen ist das Flag aus → sauber zurück beim Ansetzen.
 */
export function hudModusFuer(arbeit: ZuschnittZustand | null, anDerBank: boolean, saegenFreigegeben: boolean): HudModus {
  if (!arbeit || !anDerBank) return 'erkunden';
  switch (arbeit.phase) {
    case 'bezugsende':
    case 'messen':
    case 'anreissen':
      return 'werkbank-messen';
    case 'ansetzen':
      return saegenFreigegeben ? 'werkbank-saegen' : 'werkbank-ansetzen';
    case 'saegen':
      return 'werkbank-saegen';
    case 'ergebnis':
      return 'ergebnis';
  }
}

const zahl = (v: number, nachkomma = 1): string => {
  const t = (Math.round(v * 10 ** nachkomma) / 10 ** nachkomma).toFixed(nachkomma).replace('.', ',');
  return t.endsWith(',0') ? t.slice(0, -2) : t;
};

export function auftragText(a: Auftrag | undefined): string | null {
  const soll = sollMm(a);
  if (!a || soll === null) return null;
  const tol = a.toleranz['delta_l_mm'];
  return `Regalbrett ${zahl(soll)} mm${tol === undefined ? '' : ` ± ${zahl(tol)}`} · Lohn ${String(a.basispreis)} G`;
}

export const STUFEN_TEXT: Readonly<Record<Stufe, string>> = {
  A: 'A – Meisterhaft',
  B: 'B – Sauber',
  C: 'C – Brauchbar',
  D: 'D – Mangelhaft',
  ausschuss: 'Ausschuss',
};

/** Ergebniskarte aus dem Kern-Ergebnis: Stufe, Q, die eine wichtigste Ursache mit Ist-Länge, Preis. */
export function ergebnisKarte(katalog: Katalog, z: Spielzustand): ErgebnisDaten | null {
  const e = z.arbeit?.ergebnis;
  if (!e) return null;
  const soll = sollMm(aktuellerAuftrag(z));
  const ursache = textFuer(katalog, e.qualitaet.hauptursache, e.qualitaet.hauptursacheWert);
  const ist = `Ist ${zahl(e.laenge_ist_mm)} mm${soll === null ? '' : ` (Soll ${zahl(soll)})`}`;
  return { stufe: STUFEN_TEXT[e.qualitaet.stufe], q: e.qualitaet.q, hauptursache: `${ist} · ${ursache}`, preis: e.preis };
}

export interface HinweisKontext {
  /** Spieler steht an der Werkbank (Arbeitsansicht). */
  anDerBank: boolean;
  /** Aktueller Wert des Massbands (mm ab Bezugsende). */
  massMm: number;
  saegenFreigegeben: boolean;
  /** Stück auf der Bank (für die Endriss-Prüfung). */
  stueck?: Werkstueck | undefined;
  /** Fadenkreuz liegt auf der Werkbank (Aktionstaste sichtbar). */
  zielWerkbank?: boolean;
}

const ENDE_TEXT: Readonly<Record<EndeId, string>> = { a: 'linken', b: 'rechten' };

/**
 * Hinweis zum aktuellen Schritt. Geführt (erste Aufträge): kurze Anleitung „Schritt n/6“ für jeden Schritt.
 * Danach nur noch, was man nicht sehen kann (Riss am Ende) oder was gerade zu tun ist, ganz knapp.
 */
export function schrittHinweis(z: Spielzustand, k: HinweisKontext): string | null {
  const gefuehrt = istGefuehrt(z);
  const a = z.arbeit;
  const soll = sollMm(aktuellerAuftrag(z));
  if (!k.anDerBank || !a) {
    if (a) return a.phase === 'ergebnis' ? 'Dein Ergebnis liegt an der Werkbank.' : 'Dein Brett wartet an der Werkbank.';
    if (!gefuehrt) return null;
    return k.zielWerkbank === true
      ? 'Tippe „An die Werkbank“ – dort wartet dein Auftrag.'
      : 'Schau zur Werkbank: rechts auf dem Bildschirm ziehen.';
  }
  switch (a.phase) {
    case 'bezugsende': {
      const r = endrisse(k.stueck);
      const riss: EndeId | null = r.a !== null ? 'a' : r.b !== null ? 'b' : null;
      if (riss) {
        const anders = riss === 'a' ? 'b' : 'a';
        return gefuehrt
          ? `Schritt 1/6 · Brett prüfen: Am ${ENDE_TEXT[riss]} Ende ist ein Riss. Tippe auf das ${ENDE_TEXT[anders]} Ende – von dort wird gemessen.`
          : `Riss am ${ENDE_TEXT[riss]} Ende – Bezugsende antippen.`;
      }
      return gefuehrt ? 'Schritt 1/6 · Tippe auf ein Brettende – von dort wird gemessen.' : 'Bezugsende antippen.';
    }
    case 'messen':
    case 'anreissen': {
      if (soll !== null && Math.abs(k.massMm - soll) < 1e-6) {
        return gefuehrt ? `Schritt 3/6 · ✓ ${zahl(soll)} mm – jetzt „Anreissen“ tippen.` : `✓ ${zahl(soll)} mm`;
      }
      if (!gefuehrt) return null;
      const ziel = soll === null ? '' : ` auf ${zahl(soll)} mm`;
      return `Schritt 2/6 · Massband-Griff${ziel} ziehen, mit −0,5 / +0,5 fein einstellen.`;
    }
    case 'ansetzen':
      if (k.saegenFreigegeben) {
        return gefuehrt ? 'Schritt 5/6 · Rechts auf der Spur auf und ab wischen. Am Ende langsamer, links „Abfall stützen“ halten.' : null;
      }
      return gefuehrt ? 'Schritt 4/6 · Blatt neben den Strich auf die Abfallseite schieben (etwa +0,8 mm), dann „Sägen ›“.' : null;
    case 'saegen': {
      const drift = a.drift_grad;
      if (Math.abs(drift) >= 0.5) return `Schnitt läuft schief (${drift > 0 ? '+' : '−'}${zahl(Math.abs(drift))}°) – seitlich gegensteuern.`;
      return gefuehrt ? 'Schritt 5/6 · Gleichmässig weiter, am Ende langsamer.' : null;
    }
    case 'ergebnis': {
      const e = a.ergebnis;
      if (!e) return null;
      if (e.qualitaet.stufe === 'ausschuss') return 'Ausschuss – „Neues Brett“ tippen und es noch einmal versuchen.';
      return gefuehrt ? `Schritt 6/6 · Abliefern bringt ${String(e.preis)} G.` : null;
    }
  }
}

/** Kurzer Text, warum eine Aktion nicht ging (Gründe aus der Fassade). */
export function grundText(grund: string): string {
  switch (grund) {
    case 'markierung-ausserhalb':
      return `Zu nah am Brettende – mindestens ${String(MARKIERUNG_RAND_MM)} mm Abstand.`;
    case 'ausschuss':
      return 'Ausschuss kann nicht abgeliefert werden.';
    case 'geld-reicht-nicht':
      return 'Das Geld reicht nicht für ein neues Brett.';
    default:
      return 'Das geht gerade nicht.';
  }
}
