/**
 * Renderauflösung: Pixeldichte höchstens 2 (ADR 0001) und dynamische Auflösung aus dem Spike
 * (spikes/shared/params.ts). Reine Logik, testbar.
 */

export const PIXELDICHTE_MAX = 2;

/** URL-Schalter der Spielseite: ?dyn=0 schaltet die dynamische Auflösung ab, ?dpr=1..2 deckelt. */
export interface AufloesungsParameter {
  readonly dynamisch: boolean;
  readonly pixeldichteDeckel: number;
}

export function leseAufloesungsParameter(search: string): AufloesungsParameter {
  const q = new URLSearchParams(search);
  const dyn = q.get('dyn');
  const dprRoh = Number(q.get('dpr') ?? String(PIXELDICHTE_MAX));
  const deckel = Number.isFinite(dprRoh) && dprRoh > 0 ? Math.min(PIXELDICHTE_MAX, Math.max(0.5, dprRoh)) : PIXELDICHTE_MAX;
  return { dynamisch: dyn === null || (dyn !== '0' && dyn !== 'false'), pixeldichteDeckel: deckel };
}

/** Grenzen der dynamischen Auflösung für ein Gerät: max = min(dpr, Deckel), min = 60 % davon, nicht unter 1. */
export function aufloesungsGrenzen(devicePixelRatio: number, deckel = PIXELDICHTE_MAX): { min: number; max: number } {
  const max = Math.min(Math.max(0.5, devicePixelRatio || 1), deckel, PIXELDICHTE_MAX);
  return { min: Math.min(max, Math.max(1, max * 0.6)), max };
}

/**
 * Dynamische Renderauflösung: Faktor (Pixel pro CSS-px) zwischen min und max, gesteuert über die
 * mittlere Frame-Zeit von `stichprobe` Frames. Senkt in 0,25er-Schritten bei > 115 % des Ziels,
 * hebt bei < 70 %.
 */
export class DynamischeAufloesung {
  private wert: number;
  private summe = 0;
  private n = 0;

  constructor(
    private readonly min: number,
    private readonly max: number,
    private readonly zielMs = 33.3,
    private readonly stichprobe = 30,
  ) {
    this.wert = max;
  }

  get faktor(): number {
    return this.wert;
  }

  /** Frame-Zeit melden; true, wenn sich der Faktor geändert hat. */
  messe(frameMs: number): boolean {
    if (!(frameMs > 0) || frameMs > 1000) return false; // Hintergrund-Tab o. Ä. nicht werten
    this.summe += frameMs;
    this.n++;
    if (this.n < this.stichprobe) return false;
    const mittel = this.summe / this.n;
    this.summe = 0;
    this.n = 0;
    const vorher = this.wert;
    if (mittel > this.zielMs * 1.15) this.wert = Math.max(this.min, this.wert - 0.25);
    else if (mittel < this.zielMs * 0.7) this.wert = Math.min(this.max, this.wert + 0.25);
    return this.wert !== vorher;
  }
}
