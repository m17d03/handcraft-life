/**
 * Frame-Statistik für `__perf()` – reine Logik, ohne DOM und WebGL (Vitest).
 *
 * Behobene QA-Befunde aus Ticket 005:
 * 1. Ohne gerenderten Frame fallen Draw Calls und Dreiecke auf 0 (vorher blieben alte Werte stehen):
 *    Ein Frame ohne Zeichenaufrufe meldet 0, und liegt das letzte Frame-Ende länger als
 *    max(`veraltetMs`, 3 × letzter Frame-Abstand) zurück (Schleife steht), meldet die Auswertung ebenfalls 0.
 * 2. `inputLatencyMsLast` wird erst NACH dem Present gestempelt: Feedback-Frame gezeichnet → beim Beginn
 *    des nächsten Frames (rAF-Zeit = Anzeige des vorigen Bildes) wird die Latenz genommen.
 */

export interface FrameZaehler {
  readonly drawCalls: number;
  readonly triangles: number;
}

export interface FrameAuswertung {
  windowMs: number;
  frames: number;
  fps: number;
  frameTimeMsAvg: number;
  frameTimeMsP50: number;
  frameTimeMsP95: number;
  frameTimeMsMax: number;
  longFrames: number;
  drawCalls: number;
  triangles: number;
  timeToFirstFrameMs: number | null;
  inputLatencyMsLast: number | null;
}

/** Nearest-Rank-Perzentil auf aufsteigend sortierten Werten (p in 0..100). */
export function perzentilNearestRank(sortiert: readonly number[], p: number): number {
  if (sortiert.length === 0) return 0;
  const rang = Math.max(1, Math.ceil((p / 100) * sortiert.length));
  return sortiert[Math.min(sortiert.length, rang) - 1] ?? 0;
}

const LANGER_FRAME_MS = 50;

export class FrameStatistik {
  private readonly abstaende: { t: number; gap: number }[] = [];
  private letzterBeginn: number | undefined;
  private maxGap = 0;
  private lange = 0;
  private letzterFrame: FrameZaehler = { drawCalls: 0, triangles: 0 };
  private letztesEnde: number | null = null;
  private ersterFrame: number | null = null;
  private offeneEingabe: number | null = null;
  private wartetAufPresent: number | null = null;
  private latenz: number | null = null;

  constructor(
    readonly fensterMs = 5000,
    readonly veraltetMs = 250,
  ) {}

  /** Beginn eines Frames (rAF-Zeitstempel). */
  frameBeginn(jetztMs: number): void {
    if (this.wartetAufPresent !== null) {
      this.latenz = Math.max(0, jetztMs - this.wartetAufPresent);
      this.wartetAufPresent = null;
    }
    if (this.letzterBeginn !== undefined) {
      const gap = jetztMs - this.letzterBeginn;
      this.abstaende.push({ t: jetztMs, gap });
      if (gap > this.maxGap) this.maxGap = gap;
      if (gap > LANGER_FRAME_MS) this.lange++;
    }
    this.letzterBeginn = jetztMs;
    this.kuerzen(jetztMs);
  }

  /** Ende eines Frames mit den gezählten Zeichenaufrufen. */
  frameEnde(jetztMs: number, z: FrameZaehler): void {
    this.letzterFrame = { drawCalls: z.drawCalls, triangles: z.triangles };
    this.letztesEnde = jetztMs;
    if (this.ersterFrame === null && z.drawCalls > 0) this.ersterFrame = jetztMs;
  }

  /** Eingabe-Zeitstempel (event.timeStamp) einer Aktion mit sichtbarem Feedback. */
  eingabe(zeitstempelMs: number): void {
    this.offeneEingabe = zeitstempelMs;
  }

  /** Der eben beendete Frame enthält das Feedback; gemessen wird beim nächsten Frame-Beginn. */
  feedbackGezeichnet(): void {
    if (this.offeneEingabe === null) return;
    this.wartetAufPresent = this.offeneEingabe;
    this.offeneEingabe = null;
  }

  /** Leert Fenster, Maximum und lange Frames (`__perfReset`). */
  reset(): void {
    this.abstaende.length = 0;
    this.maxGap = 0;
    this.lange = 0;
  }

  private kuerzen(jetztMs: number): void {
    const grenze = jetztMs - this.fensterMs;
    while (this.abstaende.length > 0 && (this.abstaende[0]?.t ?? 0) < grenze) this.abstaende.shift();
  }

  auswerten(jetztMs: number): FrameAuswertung {
    this.kuerzen(jetztMs);
    const a = this.abstaende;
    const sortiert = a.map((g) => g.gap).sort((x, y) => x - y);
    const summe = sortiert.reduce((x, y) => x + y, 0);
    const erster = a[0];
    const letzter = a[a.length - 1];
    const spanne = erster && letzter ? letzter.t - erster.t + erster.gap : 0;
    // Langsame Geräte (z. B. Emulation ohne GPU) nicht fälschlich als "kein Frame" werten.
    const grenze = Math.max(this.veraltetMs, 3 * (letzter?.gap ?? 0));
    const aktuell = this.letztesEnde !== null && jetztMs - this.letztesEnde <= grenze;
    return {
      windowMs: this.fensterMs,
      frames: a.length + (a.length > 0 ? 1 : 0),
      fps: spanne > 0 ? (a.length * 1000) / spanne : 0,
      frameTimeMsAvg: sortiert.length > 0 ? summe / sortiert.length : 0,
      frameTimeMsP50: perzentilNearestRank(sortiert, 50),
      frameTimeMsP95: perzentilNearestRank(sortiert, 95),
      frameTimeMsMax: this.maxGap,
      longFrames: this.lange,
      drawCalls: aktuell ? this.letzterFrame.drawCalls : 0,
      triangles: aktuell ? this.letzterFrame.triangles : 0,
      timeToFirstFrameMs: this.ersterFrame,
      inputLatencyMsLast: this.latenz,
    };
  }
}
