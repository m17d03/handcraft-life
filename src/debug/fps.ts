/**
 * Gleitende fps-Messung über ein Zeitfenster. Reine Logik ohne DOM, damit sie testbar ist.
 */
export class FpsMeter {
  private readonly frames: number[] = [];

  constructor(private readonly windowMs = 1000) {}

  /** Zeitstempel eines Frames (ms, z. B. aus requestAnimationFrame) erfassen. */
  tick(nowMs: number): void {
    this.frames.push(nowMs);
    const cutoff = nowMs - this.windowMs;
    while (this.frames.length > 0 && (this.frames[0] ?? 0) < cutoff) {
      this.frames.shift();
    }
  }

  /** Frames pro Sekunde im Fenster; 0 solange weniger als zwei Frames vorliegen. */
  get fps(): number {
    const first = this.frames[0];
    const last = this.frames[this.frames.length - 1];
    if (first === undefined || last === undefined || last <= first) return 0;
    return ((this.frames.length - 1) * 1000) / (last - first);
  }

  /** Längste Pause zwischen zwei Frames im Fenster (ms) – zeigt Ruckler. */
  get worstFrameMs(): number {
    let worst = 0;
    for (let i = 1; i < this.frames.length; i++) {
      const gap = (this.frames[i] ?? 0) - (this.frames[i - 1] ?? 0);
      if (gap > worst) worst = gap;
    }
    return worst;
  }
}

/** true, wenn die URL den Debug-Schalter enthält (?debug=1 oder ?debug). */
export function isDebugEnabled(search: string): boolean {
  const value = new URLSearchParams(search).get('debug');
  return value !== null && value !== '0' && value !== 'false';
}
