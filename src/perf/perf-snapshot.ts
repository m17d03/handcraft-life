/**
 * PerfSnapshot v1 nach docs/qa/quality-standards-entwurf.md §8 (`window.__perf()`).
 * Einheiten: Zeiten in ms, Speicher in MB (1024² Byte), Download in kB (1024 Byte), Auflösung in Pixel.
 */
export type AaMode = 'none' | 'msaa' | 'fxaa' | 'smaa' | 'taa';

export interface PerfSnapshot {
  schema: 1;
  engine: string;
  engineVersion: string;
  scene: string;
  timeToFirstFrameMs: number | null;
  timeToPlayableMs: number | null;
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
  textureMemoryMB: number;
  textureMemoryEstimated: boolean;
  textureCount: number;
  geometryCount: number;
  bufferMemoryMB: number | null;
  heapMB: number | null;
  canvasCssWidth: number;
  canvasCssHeight: number;
  renderWidth: number;
  renderHeight: number;
  devicePixelRatio: number;
  renderScale: number;
  aa: AaMode;
  msaaSamples: number;
  transferredKB: number | null;
  inputLatencyMsLast: number | null;
  contextLostCount: number;
  errorCount: number;
}

/** Engine-spezifische Angaben, die der Render-Adapter einspeist (src/perf kennt keine Engine). */
export interface PerfMeta {
  engine: string;
  engineVersion: string;
  scene: string;
  aa: AaMode;
  msaaSamples: number;
}

/**
 * Schmale Schnittstelle, über die src/render Frames und Metadaten meldet.
 * Ablauf je Frame: frameBeginn(rAF-Zeit) → Rendern → frameEnde() → ggf. feedbackGezeichnet().
 */
export interface PerfMelder {
  setzeMeta(meta: Partial<PerfMeta>): void;
  frameBeginn(jetztMs: number): void;
  frameEnde(): void;
  /** Im gerade gezeichneten Frame ist sichtbares Feedback auf eine Eingabe enthalten. */
  feedbackGezeichnet(): void;
  /** Szene geladen und Eingabe aktiv. */
  spielbar(): void;
}

declare global {
  interface Window {
    __perf?: () => PerfSnapshot;
    __perfReset?: () => void;
  }
}
