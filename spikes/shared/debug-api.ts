/** Test-/Debug-Schnittstelle der Spike-Seiten (window.__spike), ohne DOM-/CSS-Abhängigkeit typisierbar. */
export interface SpikeDebugApi {
  state(): { ready: boolean; selected: boolean; cutMm: number | null; yaw: number; pitch: number };
  /** Bildschirmposition (CSS-px) eines Punkts auf dem Balken, u = 0…1 entlang der Länge. */
  beamScreenPoint(u?: number): { x: number; y: number } | null;
}

declare global {
  interface Window {
    __spike?: SpikeDebugApi;
  }
}
