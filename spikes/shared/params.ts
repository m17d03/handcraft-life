/**
 * URL-Parameter der Spike-Seiten (gleich für alle Engines):
 *  ?aa=msaa|fxaa|none   Kantenglättung (Standard msaa; PlayCanvas: fxaa → taa, weil kein FXAA eingebaut)
 *  ?dpr=2               Deckel für devicePixelRatio (1…3, Standard 2)
 *  ?dyn=1               dynamische Renderauflösung (senkt den Faktor bei langen Frames)
 *  ?tex=1024|2048|512   Kantenlänge der Holztextur
 *  ?auto=1              Standard-Kamerafahrt für Messungen (keine Eingabe nötig)
 *  ?debug=1 / ?perf=1   Overlay bzw. nur window.__perf()
 */
export type AaRequest = 'msaa' | 'fxaa' | 'none';

export interface SpikeParams {
  readonly aa: AaRequest;
  readonly dprCap: number;
  readonly dynamicResolution: boolean;
  readonly textureSize: number;
  readonly autoCamera: boolean;
  readonly debug: boolean;
  readonly perf: boolean;
}

const flag = (q: URLSearchParams, name: string): boolean => {
  const v = q.get(name);
  return v !== null && v !== '0' && v !== 'false';
};

export function parseSpikeParams(search: string): SpikeParams {
  const q = new URLSearchParams(search);
  const aaRaw = q.get('aa');
  const aa: AaRequest = aaRaw === 'fxaa' || aaRaw === 'none' ? aaRaw : 'msaa';
  const dprRaw = Number(q.get('dpr') ?? '2');
  const dprCap = Number.isFinite(dprRaw) && dprRaw > 0 ? Math.min(3, Math.max(0.5, dprRaw)) : 2;
  const texRaw = Number(q.get('tex') ?? '1024');
  const textureSize = [256, 512, 1024, 2048].includes(texRaw) ? texRaw : 1024;
  const debug = flag(q, 'debug');
  return {
    aa,
    dprCap,
    dynamicResolution: flag(q, 'dyn'),
    textureSize,
    autoCamera: flag(q, 'auto'),
    debug,
    perf: debug || flag(q, 'perf'),
  };
}

/**
 * Dynamische Renderauflösung: Faktor (Pixel pro CSS-px) zwischen min und max, gesteuert über die
 * mittlere Frame-Zeit. Reine Logik, testbar.
 */
export class DynamicResolution {
  private value: number;
  private acc = 0;
  private n = 0;

  constructor(
    private readonly min: number,
    private readonly max: number,
    private readonly targetMs = 33.3,
    private readonly sampleFrames = 30,
  ) {
    this.value = max;
  }

  get ratio(): number {
    return this.value;
  }

  /** Frame-Zeit melden; liefert true, wenn sich der Faktor geändert hat. */
  sample(frameMs: number): boolean {
    this.acc += frameMs;
    this.n++;
    if (this.n < this.sampleFrames) return false;
    const avg = this.acc / this.n;
    this.acc = 0;
    this.n = 0;
    const before = this.value;
    if (avg > this.targetMs * 1.15) this.value = Math.max(this.min, this.value - 0.25);
    else if (avg < this.targetMs * 0.7) this.value = Math.min(this.max, this.value + 0.25);
    return this.value !== before;
  }
}
