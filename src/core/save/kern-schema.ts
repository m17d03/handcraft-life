/**
 * Abschnitt `kern` der SpielstandDatei (ADR 0003): aktuelle Schema-Version, Migrationskette und
 * Laufzeitprüfung. Reine Funktionen auf JSON, ohne Browser.
 *
 * Regel (ADR 0003): Migrationen werden nie gelöscht und nie nachträglich geändert. Jede Formatänderung
 * am `Spielzustand` → `KERN_SCHEMA + 1`, neue Migration hier, neue Fixture in `tests/fixtures/saves/`.
 */
import type { Spielzustand } from '../zustand';

/** Kern-Speicherabschnitt = der gesamte Spielzustand aus Ticket 008 (siehe Kommentar in `zustand.ts`). */
export type KernSpeicher = Spielzustand;

export const KERN_SCHEMA = 1;

/** Migration `n-1 → n` unter Schlüssel `n`. Schema 1 ist das erste Format, daher noch leer. */
export const kernMigrationen: Readonly<Record<number, (alt: unknown) => unknown>> = {};

type Obj = Record<string, unknown>;

const istObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const istZahl = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const istText = (x: unknown): x is string => typeof x === 'string';
const istZahlenMap = (x: unknown): boolean => istObj(x) && Object.values(x).every(istZahl);
const optional = (x: unknown, pruef: (y: unknown) => boolean): boolean => x === undefined || pruef(x);

function istMerkmal(x: unknown): boolean {
  return (
    istObj(x) && istText(x.id) && optional(x.pos_mm, istZahl) && optional(x.laenge_mm, istZahl) && optional(x.wert, istZahl)
  );
}

function istEnde(x: unknown): boolean {
  return istObj(x) && istZahl(x.winkel_grad) && Array.isArray(x.merkmale) && x.merkmale.every(istMerkmal);
}

const STUFEN = ['A', 'B', 'C', 'D', 'ausschuss'];

function istQualitaet(x: unknown): boolean {
  return (
    istObj(x) &&
    istZahl(x.q) &&
    STUFEN.includes(x.stufe as string) &&
    istZahlenMap(x.punkte) &&
    istText(x.hauptursache) &&
    istZahl(x.hauptursacheWert) &&
    istText(x.auftragId)
  );
}

function istWerkstueck(x: unknown): boolean {
  if (!istObj(x) || !istText(x.id) || !istText(x.materialId)) return false;
  const m = x.masse_mm;
  if (!istObj(m) || !istZahl(m.l) || !istZahl(m.b) || !istZahl(m.d)) return false;
  const e = x.enden;
  if (!istObj(e) || !istEnde(e.a) || !istEnde(e.b)) return false;
  return (
    Array.isArray(x.merkmale) &&
    x.merkmale.every(istMerkmal) &&
    ['roh', 'rest', 'schnitt'].includes(x.herkunft as string) &&
    optional(x.qualitaet, istQualitaet)
  );
}

function istAuftrag(x: unknown): boolean {
  return (
    istObj(x) &&
    istText(x.id) &&
    istText(x.vorlageId) &&
    istZahlenMap(x.soll) &&
    istZahlenMap(x.toleranz) &&
    istZahl(x.basispreis) &&
    istText(x.kundeId) &&
    ['angeboten', 'angenommen', 'abgeliefert', 'abgelehnt'].includes(x.status as string) &&
    optional(x.werkstueckId, istText)
  );
}

function istInventar(x: unknown): boolean {
  return (
    istObj(x) &&
    istZahl(x.geld) &&
    istZahl(x.schulden) &&
    Array.isArray(x.werkstuecke) &&
    x.werkstuecke.every(istWerkstueck) &&
    Array.isArray(x.gegenstaende) &&
    x.gegenstaende.every((g) => istObj(g) && istText(g.itemId) && istZahl(g.anzahl)) &&
    Array.isArray(x.werkzeuge) &&
    x.werkzeuge.every((w) => istObj(w) && istText(w.werkzeugId))
  );
}

const PHASEN = ['bezugsende', 'messen', 'anreissen', 'ansetzen', 'saegen', 'ergebnis'];

function istArbeit(x: unknown): boolean {
  if (x === null) return true;
  if (!istObj(x)) return false;
  const e = x.ergebnis;
  const ergebnisOk =
    e === null ||
    (istObj(e) &&
      istText(e.teilId) &&
      (e.restId === null || istText(e.restId)) &&
      istZahl(e.laenge_ist_mm) &&
      istQualitaet(e.qualitaet) &&
      istZahl(e.preis) &&
      istZahlenMap(e.messwerte));
  return (
    PHASEN.includes(x.phase as string) &&
    istText(x.werkstueckId) &&
    istText(x.auftragId) &&
    istText(x.werkzeugId) &&
    istText(x.messzeugId) &&
    (x.bezugsende === null || x.bezugsende === 'a' || x.bezugsende === 'b') &&
    (x.markierung_mm === null || istZahl(x.markierung_mm)) &&
    istZahl(x.blattversatz_mm) &&
    typeof x.stuetzen === 'boolean' &&
    Array.isArray(x.zuege) &&
    x.zuege.every((z) => istObj(z) && Object.values(z).every((w) => istZahl(w) || typeof w === 'boolean')) &&
    istZahl(x.drift_grad) &&
    ergebnisOk
  );
}

/** Laufzeitprüfung des Kern-Abschnitts (aktuelles Schema). Strukturell, nicht inhaltlich (IDs werden nicht gegen den Katalog geprüft). */
export function istKernSpeicher(x: unknown): x is KernSpeicher {
  return (
    istObj(x) &&
    istInventar(x.inventar) &&
    Array.isArray(x.auftraege) &&
    x.auftraege.every(istAuftrag) &&
    istObj(x.skills) &&
    Object.values(x.skills).every(
      (s) => istObj(s) && istZahl(s.xp) && Array.isArray(s.knoten) && s.knoten.every(istText),
    ) &&
    istZahlenMap(x.zaehler) &&
    istZahl(x.tutorial) &&
    istZahl(x.zufallSaat) &&
    istZahl(x.naechsteNr) &&
    istArbeit(x.arbeit)
  );
}
