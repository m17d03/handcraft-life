// Debug-Schalter (Ticket 016): 5× schnell auf die Geldanzeige tippen schaltet das Overlay ein/aus –
// auch in der Home-Bildschirm-App, wo kein ?debug=1 in der Adresse steht. Zustand gilt für die Sitzung.
// Gegen versehentliches Auslösen: nur kurze Tipps ohne Bewegung zählen, und alle fünf müssen dicht
// aufeinander folgen (Abstand ≤ 400 ms). Normales Spielen tippt die Geldanzeige nie so.

export interface MehrfachTippOptionen {
  /** Anzahl Tipps bis zum Auslösen. */
  anzahl: number;
  /** Grösster Abstand zwischen zwei Tipps (ms, Aufsetzen zu Aufsetzen). */
  maxAbstandMs: number;
  /** Längste Berührung, die noch als Tipp zählt (ms). */
  maxDauerMs: number;
  /** Grösster Weg während der Berührung (pt). */
  maxWegPt: number;
}

export const DEBUG_SCHALTER: MehrfachTippOptionen = { anzahl: 5, maxAbstandMs: 400, maxDauerMs: 350, maxWegPt: 12 };

/** Reine Zähllogik ohne DOM (testbar). */
export class MehrfachTipp {
  private zahl = 0;
  private letzter = Number.NEGATIVE_INFINITY;

  constructor(private readonly o: MehrfachTippOptionen = DEBUG_SCHALTER) {}

  /** Ein Tipp (Zeitpunkt des Aufsetzens, Dauer, Weg). true = Auslösen; danach beginnt die Zählung neu. */
  tipp(t: number, dauerMs: number, wegPt: number): boolean {
    if (dauerMs > this.o.maxDauerMs || wegPt > this.o.maxWegPt) {
      this.zahl = 0;
      this.letzter = Number.NEGATIVE_INFINITY;
      return false;
    }
    this.zahl = t - this.letzter <= this.o.maxAbstandMs ? this.zahl + 1 : 1;
    this.letzter = t;
    if (this.zahl < this.o.anzahl) return false;
    this.zahl = 0;
    this.letzter = Number.NEGATIVE_INFINITY;
    return true;
  }

  /** Bisher gezählte Tipps der laufenden Folge. */
  get gezaehlt(): number {
    return this.zahl;
  }
}

const SITZUNG_SCHLUESSEL = 'hcl.debug';

/** Debug-Zustand dieser Sitzung (sessionStorage; ohne Speicher: null). */
export function debugInSitzung(speicher: Pick<Storage, 'getItem'> | null = sitzung()): boolean | null {
  const v = speicher?.getItem(SITZUNG_SCHLUESSEL) ?? null;
  return v === null ? null : v === '1';
}

export function debugInSitzungMerken(an: boolean, speicher: Pick<Storage, 'setItem'> | null = sitzung()): void {
  try {
    speicher?.setItem(SITZUNG_SCHLUESSEL, an ? '1' : '0');
  } catch {
    // privater Modus o. Ä.: Zustand gilt dann nur bis zum Neuladen
  }
}

function sitzung(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Bindet den Schalter an ein Element (die Geldanzeige). Jede Berührung gibt sofort sichtbares Feedback
 * (Klasse `tipp` beim Aufsetzen, ≤ 100 ms); nach dem fünften schnellen Tipp wird `umschalten` gerufen.
 */
export function bindeDebugSchalter(el: HTMLElement, umschalten: () => void, o: MehrfachTippOptionen = DEBUG_SCHALTER): () => void {
  const zaehler = new MehrfachTipp(o);
  let start: { id: number; t: number; x: number; y: number; weg: number } | null = null;
  let tippTimer = 0;
  const unten = (e: PointerEvent): void => {
    e.stopPropagation();
    start = { id: e.pointerId, t: e.timeStamp, x: e.clientX, y: e.clientY, weg: 0 };
    el.classList.remove('tipp');
    void el.offsetWidth; // Animation neu starten
    el.classList.add('tipp');
    window.clearTimeout(tippTimer);
    tippTimer = window.setTimeout(() => {
      el.classList.remove('tipp');
    }, 200);
  };
  const bewegt = (e: PointerEvent): void => {
    if (start?.id !== e.pointerId) return;
    start.weg = Math.max(start.weg, Math.hypot(e.clientX - start.x, e.clientY - start.y));
  };
  const oben = (e: PointerEvent): void => {
    if (start?.id !== e.pointerId) return;
    e.stopPropagation();
    const s = start;
    start = null;
    const weg = Math.max(s.weg, Math.hypot(e.clientX - s.x, e.clientY - s.y));
    if (zaehler.tipp(s.t, e.timeStamp - s.t, weg)) umschalten();
  };
  const abbruch = (): void => {
    start = null;
  };
  el.addEventListener('pointerdown', unten);
  el.addEventListener('pointermove', bewegt);
  el.addEventListener('pointerup', oben);
  el.addEventListener('pointercancel', abbruch);
  return () => {
    window.clearTimeout(tippTimer);
    el.removeEventListener('pointerdown', unten);
    el.removeEventListener('pointermove', bewegt);
    el.removeEventListener('pointerup', oben);
    el.removeEventListener('pointercancel', abbruch);
  };
}
