/**
 * Gleitende fps-Messung über ein Zeitfenster. Reine Logik ohne DOM, damit sie testbar ist.
 */
export class FpsMeter {
  /** Zeitstempel und Abstand zum Vorgänger-Frame (ms). */
  private readonly frames: { t: number; gap: number }[] = [];
  private last: number | undefined;

  constructor(private readonly windowMs = 1000) {}

  /** Zeitstempel eines Frames (ms, z. B. aus requestAnimationFrame) erfassen. */
  tick(nowMs: number): void {
    const gap = this.last === undefined ? 0 : nowMs - this.last;
    this.last = nowMs;
    this.frames.push({ t: nowMs, gap });
    const cutoff = nowMs - this.windowMs;
    while (this.frames.length > 0 && (this.frames[0]?.t ?? 0) < cutoff) {
      this.frames.shift();
    }
  }

  /** Messung verwerfen (z. B. nach einer Pause, damit sie nicht als Ruckler zählt). */
  reset(): void {
    this.frames.length = 0;
    this.last = undefined;
  }

  /** Frames pro Sekunde im Fenster; 0 solange weniger als zwei Frames vorliegen. */
  get fps(): number {
    const first = this.frames[0];
    const last = this.frames[this.frames.length - 1];
    if (first === undefined || last === undefined || last.t <= first.t) return 0;
    return ((this.frames.length - 1) * 1000) / (last.t - first.t);
  }

  /**
   * Längster Abstand zwischen zwei Frames, dessen Ende im Fenster liegt (ms) – zeigt Ruckler,
   * auch Hänger, die länger als das Fenster dauern.
   */
  get worstFrameMs(): number {
    let worst = 0;
    for (const f of this.frames) if (f.gap > worst) worst = f.gap;
    return worst;
  }
}

/** true, wenn die URL den Debug-Schalter enthält (?debug=1 oder ?debug). */
export function isDebugEnabled(search: string): boolean {
  const value = new URLSearchParams(search).get('debug');
  return value !== null && value !== '0' && value !== 'false';
}
