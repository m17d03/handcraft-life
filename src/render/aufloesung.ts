/**
 * Renderauflösung: Pixeldichte höchstens 2 (ADR 0001) und dynamische Auflösung aus dem Spike
 * (spikes/shared/params.ts). Reine Logik, testbar.
 */

export const PIXELDICHTE_MAX = 2;

/**
 * URL-Schalter der Spielseite: ?dyn=0 schaltet die dynamische Auflösung ab, ?dpr=0.5..2 deckelt,
 * ?aa=0 schaltet MSAA ab (Messung/Tests auf Rechnern ohne GPU, Ticket 018).
 */
export interface AufloesungsParameter {
  readonly dynamisch: boolean;
  readonly pixeldichteDeckel: number;
  /** MSAA anfordern (Standard true) */
  readonly msaa?: boolean;
}

export function leseAufloesungsParameter(search: string): AufloesungsParameter {
  const q = new URLSearchParams(search);
  const dyn = q.get('dyn');
  const aa = q.get('aa');
  const dprRoh = Number(q.get('dpr') ?? String(PIXELDICHTE_MAX));
  const deckel = Number.isFinite(dprRoh) && dprRoh > 0 ? Math.min(PIXELDICHTE_MAX, Math.max(0.5, dprRoh)) : PIXELDICHTE_MAX;
  return { dynamisch: dyn === null || (dyn !== '0' && dyn !== 'false'), pixeldichteDeckel: deckel, msaa: aa !== '0' && aa !== 'false' };
}

/** Untergrenze der Pixeldichte auf Geräten (Qualitätsgrenze G3); tiefer nur per Deckel (Software-Renderer, ?dpr). */
export const GERAET_MIN_DICHTE = 1.5;

/**
 * Grenzen der dynamischen Auflösung: max = min(dpr, Deckel, 2), min = 60 % davon, aber nicht unter
 * GERAET_MIN_DICHTE (bzw. max, wenn das kleiner ist – z. B. dpr 1, ?dpr=0.5 oder Software-Renderer mit Deckel 1).
 */
export function aufloesungsGrenzen(devicePixelRatio: number, deckel = PIXELDICHTE_MAX): { min: number; max: number } {
  const max = Math.min(Math.max(0.5, devicePixelRatio || 1), deckel, PIXELDICHTE_MAX);
  return { min: Math.min(max, Math.max(GERAET_MIN_DICHTE, max * 0.6)), max };
}

/** Frames über dieser Dauer (ms) zählen für die Notbremse (unter 4 fps). */
export const NOTBREMSE_MS = 250;
/** So viele solcher Frames in Folge senken die Auflösung sofort auf das Minimum. */
export const NOTBREMSE_FRAMES = 3;
/** Sperre (in Stichproben) nach einem Absenken, das direkt auf ein Anheben folgt; verdoppelt sich bis zum Deckel. */
const SPERRE_START = 2;
const SPERRE_MAX = 64;

/**
 * Dynamische Renderauflösung: Faktor (Pixel pro CSS-px) zwischen min und max, gesteuert über die
 * Frame-Zeiten von `stichprobe` Frames.
 * - Senkt in 0,25er-Schritten, wenn das Mittel > 115 % des Ziels liegt UND mindestens ein Viertel der Frames
 *   (≥ 3) so langsam ist – anhaltend langsam, nicht ein einzelner Hänger (CPU-Spitze: Senken brächte nichts).
 * - Hebt, wenn das Mittel < 70 % des Ziels liegt ODER jeder Frame im Takt der Anzeige kam (Mittel ≤ 110 % und
 *   längster ≤ 150 % des kürzesten Abstands = gemessene Bildwiederholrate). So erholt sie sich auch bei
 *   30 Hz (Low Power Mode), wo 23 ms nie erreichbar sind.
 * - Pendeln (heben → senken) sperrt weiteres Heben für eine wachsende Zahl Stichproben; jede ruhige
 *   Stichprobe (keine Änderung) halbiert die nächste Sperrdauer wieder.
 * - Notbremse: NOTBREMSE_FRAMES Frames über NOTBREMSE_MS in Folge → sofort min.
 * - `pause()` nach Hintergrund/Kontextverlust: Zähler zurück, die nächste Lücke wird nicht gewertet.
 */
export class DynamischeAufloesung {
  private wert: number;
  private summe = 0;
  private n = 0;
  private kuerzester = Infinity;
  private laengster = 0;
  /** Frames der Stichprobe über 115 % des Ziels */
  private langsame = 0;
  private langsamInFolge = 0;
  private ignorieren = false;
  private letzteAenderung: 'hoch' | 'runter' | null = null;
  private sperre = 0;
  private sperreDauer = SPERRE_START;

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

  /** Nach Hintergrund, `pagehide` oder Kontextverlust: nichts von vorher zählt, die nächste Lücke auch nicht. */
  pause(): void {
    this.langsamInFolge = 0;
    this.ignorieren = true;
    this.stichprobeLeeren();
  }

  /** Frame-Zeit melden; true, wenn sich der Faktor geändert hat. */
  messe(frameMs: number): boolean {
    if (this.ignorieren) {
      this.ignorieren = false;
      return false;
    }
    if (!(frameMs > 0)) return false;
    // Notbremse (Ticket 018): mehrere sehr lange Frames in Folge (ohne GPU: Sekunden je Frame) → sofort auf min.
    // Einzelne lange Abstände (Shader-Übersetzung, verpasste Pause) lösen sie nicht aus.
    if (frameMs > NOTBREMSE_MS) {
      this.langsamInFolge++;
      if (this.langsamInFolge >= NOTBREMSE_FRAMES && this.wert > this.min) {
        this.langsamInFolge = 0;
        this.stichprobeLeeren();
        return this.setze(this.min);
      }
    } else {
      this.langsamInFolge = 0;
    }
    if (frameMs > 1000) return false; // einzelne Riesenlücke (Hintergrund ohne Pause-Meldung) nicht mitteln
    this.summe += frameMs;
    this.n++;
    this.kuerzester = Math.min(this.kuerzester, frameMs);
    this.laengster = Math.max(this.laengster, frameMs);
    if (frameMs > this.zielMs * 1.15) this.langsame++;
    if (this.n < this.stichprobe) return false;
    const mittel = this.summe / this.n;
    const takt = this.kuerzester;
    const imTakt = mittel <= takt * 1.1 && this.laengster <= takt * 1.5;
    const anhaltendLangsam = mittel > this.zielMs * 1.15 && this.langsame >= Math.max(3, Math.ceil(this.n / 4));
    this.stichprobeLeeren();
    if (this.sperre > 0) this.sperre--;
    let geaendert = false;
    if (anhaltendLangsam) geaendert = this.setze(Math.max(this.min, this.wert - 0.25));
    else if (this.sperre === 0 && (mittel < this.zielMs * 0.7 || imTakt)) geaendert = this.setze(Math.min(this.max, this.wert + 0.25));
    // Ruhige Phase: Sperre klingt ab
    if (!geaendert) this.sperreDauer = Math.max(SPERRE_START, Math.floor(this.sperreDauer / 2));
    return geaendert;
  }

  private setze(neu: number): boolean {
    if (neu === this.wert) return false;
    const richtung = neu > this.wert ? 'hoch' : 'runter';
    if (richtung === 'runter' && this.letzteAenderung === 'hoch') {
      // Pendeln: nach dem Heben wurde es zu langsam → länger warten, bevor wieder gehoben wird
      this.sperre = this.sperreDauer;
      this.sperreDauer = Math.min(SPERRE_MAX, this.sperreDauer * 2);
    }
    this.letzteAenderung = richtung;
    this.wert = neu;
    return true;
  }

  private stichprobeLeeren(): void {
    this.summe = 0;
    this.n = 0;
    this.kuerzester = Infinity;
    this.laengster = 0;
    this.langsame = 0;
  }
}

/**
 * Software-Rendering (keine GPU: SwiftShader, llvmpipe, …) erkennt man am GL-Renderer-Namen. Dort kostet jedes
 * Pixel CPU-Zeit: Die Werkstatt zeichnet dann mit Pixeldichte 1 und ohne MSAA (Ticket 018), sonst dauert ein
 * Frame Sekunden. Echte Geräte (Ziel-iPhone) sind nicht betroffen.
 */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|lavapipe|software|basic render/i;

export function istSoftwareRenderer(name: string): boolean {
  return SOFTWARE_RENDERER.test(name);
}
