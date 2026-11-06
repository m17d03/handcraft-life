/** Ticket 017 (Befund 016): Arbeitsansicht rahmt beide Brettenden ausserhalb Randzone + Safe Area. */
import { describe, expect, it } from 'vitest';
import { arbeitsPose } from '../../../src/render/ich-kamera';
import { forwardFromYawPitch, projectToScreen, type Vec3 } from '../../../src/render/mathe';
import { ARBEITSANSICHT, BRETT, BRETT_OBEN_Y, KAMERA } from '../../../src/render/werkstatt-layout';

const GROESSEN = [
  { w: 667, h: 375, safe: 0 },
  { w: 734, h: 343, safe: 59 },
  { w: 852, h: 393, safe: 59 },
  { w: 932, h: 430, safe: 59 },
  { w: 932, h: 300, safe: 59 },
  { w: 1280, h: 720, safe: 0 },
] as const;

describe('Arbeitsansicht – Rahmung der Brettenden', () => {
  for (const g of GROESSEN) {
    for (const laengeMm of [2000, 1400, 600]) {
      it(`${String(g.w)}×${String(g.h)} Safe Area ${String(g.safe)} pt, Brett ${String(laengeMm)} mm`, () => {
        const ziel: Vec3 = [BRETT.x, BRETT_OBEN_Y, BRETT.z];
        const px = g.safe + ARBEITSANSICHT.randzonePt + ARBEITSANSICHT.fingerReservePt;
        const pose = arbeitsPose(ziel, laengeMm / 1000, g.w / g.h, KAMERA.fovY, ARBEITSANSICHT, {
          breitePx: g.w,
          px,
          tiefeM: BRETT.breiteMm / 1000,
          ueberstandM: ARBEITSANSICHT.ueberstandM,
        });
        const proj = { eye: pose.eye, forward: forwardFromYawPitch(pose.yaw, pose.pitch), fovY: KAMERA.fovY, breite: g.w, hoehe: g.h };
        const sperre = g.safe + ARBEITSANSICHT.randzonePt;
        for (const sx of [-1, 1]) {
          for (const dz of [-BRETT.breiteMm / 2000, BRETT.breiteMm / 2000]) {
            const p = projectToScreen(proj, [BRETT.x + (sx * laengeMm) / 2000, BRETT_OBEN_Y, BRETT.z + dz]);
            expect(p).not.toBeNull();
            // Ende ausserhalb der Sperrzone, mit Fingerreserve
            expect(p?.x ?? -1).toBeGreaterThanOrEqual(sperre + ARBEITSANSICHT.fingerReservePt - 0.01);
            expect(p?.x ?? 1e9).toBeLessThanOrEqual(g.w - sperre - ARBEITSANSICHT.fingerReservePt + 0.01);
            expect(p?.y ?? -1).toBeGreaterThan(0);
            expect(p?.y ?? 1e9).toBeLessThan(g.h);
          }
        }
        // Rahmung nutzt die Breite: das 2-m-Brett wird nicht unnötig klein (Ende höchstens 60 pt innerhalb)
        if (laengeMm === 2000) {
          const rechts = projectToScreen(proj, [BRETT.x + 1 + ARBEITSANSICHT.ueberstandM, BRETT_OBEN_Y, BRETT.z + BRETT.breiteMm / 2000]);
          expect(rechts?.x ?? 0).toBeGreaterThan(g.w - px - 1);
        }
      });
    }
  }
});
