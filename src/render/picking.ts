/**
 * Picking ohne Engine: Strahl gegen achsenparallele Quader, nächster Treffer gewinnt.
 * Bei gleichem Abstand gewinnt das zuerst gelistete Ziel (Werkstücke vor Werkbank listen).
 */
import { rayAabb, type Aabb, type Ray } from './mathe';

export interface PickZiel {
  readonly id: string;
  readonly box: Aabb;
}

export function pickNaechstes(ray: Ray, ziele: readonly PickZiel[]): string | null {
  let best: string | null = null;
  let bestT = Number.POSITIVE_INFINITY;
  for (const z of ziele) {
    const t = rayAabb(ray, z.box);
    if (t !== null && t < bestT - 1e-9) {
      bestT = t;
      best = z.id;
    }
  }
  return best;
}
