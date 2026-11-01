import type { Zufall } from './typen';

/**
 * Gesäter Zufall (mulberry32). Der Zustand ist eine einzige 32-Bit-Zahl, die im Spielstand liegt
 * (`zufallSaat`) → jeder Ablauf ist mit derselben Saat exakt wiederholbar.
 */
export function zufallsquelle(saat: number): { zufall: Zufall; saat: () => number } {
  let s = saat >>> 0;
  return {
    zufall: () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    saat: () => s,
  };
}

/** Gleichverteilt in [min, max). */
export function zwischen(zufall: Zufall, min: number, max: number): number {
  return min + (max - min) * zufall();
}
