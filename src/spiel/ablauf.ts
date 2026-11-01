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


const vorzeichenZahl = (v: number, nachkomma: number): string =>
  `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(nachkomma).replace('.', ',')}`;

/**
 * Ergebniskarte aus dem Kern-Ergebnis: Stufe, Q, die eine wichtigste Ursache mit Ist-Länge, Preis.
 * Liegt die Länge ausserhalb der Auftragstoleranz (Stufe gekappt), steht das zuerst da (QA F3).
 */
export function ergebnisKarte(katalog: Katalog, z: Spielzustand): ErgebnisDaten | null {
  const e = z.arbeit?.ergebnis;
  if (!e) return null;
  const auftrag = aktuellerAuftrag(z);
  const soll = sollMm(auftrag);
  const ursache = textFuer(katalog, e.qualitaet.hauptursache, e.qualitaet.hauptursacheWert);
  const ist = `Ist ${zahl(e.laenge_ist_mm)} mm${soll === null ? '' : ` (Soll ${zahl(soll)})`}`;
  const tol = auftrag?.toleranz['delta_l_mm'];
  const abw = e.messwerte['abweichung_l_mm'];
  const ausserhalb =
    tol !== undefined && abw !== undefined && Math.abs(abw) > tol && e.qualitaet.stufe !== 'ausschuss'
      ? `Ausserhalb der Toleranz: ${vorzeichenZahl(abw, 2)} mm (erlaubt ±${zahl(tol)}) · `
      : '';
  return { stufe: STUFEN_TEXT[e.qualitaet.stufe], q: e.qualitaet.q, hauptursache: `${ist} · ${ausserhalb}${ursache}`, preis: e.preis };
}

/** Spalt (mm) am Anschlagwinkel, ab dem ein Ende als schief gilt. Gute Werksenden: ≤ 0,6 mm (Kern ±0,3 mm). */
export const RECHTWINKLIG_BIS_MM = 0.8;

export interface EndBefund {
  /** Spalt zwischen Anschlagwinkel und Stirn über die ganze Brettbreite (mm). */
  spaltMm: number;
  rechtwinklig: boolean;
  rissMm: number | null;
}

/** Was die Prüfung eines Endes mit dem Anschlagwinkel zeigt (aus dem Endwinkel im Kern). */
export function endPruefen(w: Werkstueck, ende: EndeId): EndBefund {
  const spaltMm = Math.round(Math.abs(Math.tan((w.enden[ende].winkel_grad * Math.PI) / 180)) * w.masse_mm.b * 10) / 10;
  return { spaltMm, rechtwinklig: spaltMm <= RECHTWINKLIG_BIS_MM, rissMm: endrisse(w)[ende] };
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

export interface Hinweis {
  text: string;
  /** Warnungen haben Vorrang vor Meldungen (QA F4). */
  warnung: boolean;
}

/** „am linken Ende“ (Dativ). */
const ENDE_DATIV: Readonly<Record<EndeId, string>> = { a: 'linken', b: 'rechten' };

const info = (text: string): Hinweis => ({ text, warnung: false });
const warnung = (text: string): Hinweis => ({ text, warnung: true });

/**
 * Hinweis zum aktuellen Schritt – eine Zeile, oben. Geführt (erste Aufträge): „Schritt n/6“ für jeden Schritt.
 * Danach nur noch, was man nicht sehen kann (Riss am Ende) oder was gerade zu tun ist, ganz knapp.
 */
export function schrittHinweis(z: Spielzustand, k: HinweisKontext): Hinweis | null {
  const gefuehrt = istGefuehrt(z);
  const a = z.arbeit;
  const soll = sollMm(aktuellerAuftrag(z));
  if (!k.anDerBank || !a) {
    if (a) return info(a.phase === 'ergebnis' ? 'Dein Ergebnis liegt an der Werkbank.' : 'Dein Brett wartet an der Werkbank.');
    if (!gefuehrt) return null;
    return info(k.zielWerkbank === true ? 'Tippe „An die Werkbank“ – dort wartet dein Auftrag.' : 'Schau zur Werkbank: rechts auf dem Bildschirm ziehen.');
  }
  switch (a.phase) {
    case 'bezugsende': {
      const r = endrisse(k.stueck);
      const riss: EndeId | null = r.a !== null ? 'a' : r.b !== null ? 'b' : null;
      const pruefen = 'Prüfe beide Enden – miss vom rechtwinkligen.';
      if (riss) return warnung(`${gefuehrt ? 'Schritt 1/6 · ' : ''}Riss am ${ENDE_DATIV[riss]} Ende! ${pruefen}`);
      return info(gefuehrt ? `Schritt 1/6 · ${pruefen.replace('Prüfe beide Enden', 'Prüfe beide Enden (antippen)')}` : 'Bezugsende prüfen und wählen.');
    }
    case 'messen':
    case 'anreissen': {
      if (soll !== null && Math.abs(k.massMm - soll) < 1e-6) {
        return info(gefuehrt ? `Schritt 3/6 · ✓ ${zahl(soll)} mm – jetzt „Anreissen“ tippen.` : `✓ ${zahl(soll)} mm`);
      }
      if (!gefuehrt) return null;
      const ziel = soll === null ? '' : ` auf ${zahl(soll)} mm`;
      return info(`Schritt 2/6 · Massband${ziel} ziehen, mit −0,5 / +0,5 fein einstellen.`);
    }
    case 'ansetzen':
      if (k.saegenFreigegeben) return gefuehrt ? info('Schritt 5/6 · Rechts auf und ab wischen, links „Abfall stützen“ halten.') : null;
      return gefuehrt ? info('Schritt 4/6 · Blatt auf die Abfallseite schieben (≈ +0,8 mm), dann „Sägen ›“.') : null;
    case 'saegen': {
      const drift = a.drift_grad;
      if (Math.abs(drift) >= 0.5) return warnung(`Schnitt läuft schief (${vorzeichenZahl(drift, 1)}°) – seitlich gegensteuern.`);
      return gefuehrt ? info('Schritt 5/6 · Gleichmässig weiter, am Ende langsamer.') : null;
    }
    case 'ergebnis':
      // Die Ergebniskarte erklärt alles; kein Hinweis darüber (QA F2)
      return null;
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
