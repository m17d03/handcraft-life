import { expect, test, type Page } from '@playwright/test';
// Typen bringen die globalen Deklarationen window.__perf / window.__spike mit.
import type {} from '../../spikes/shared/perf';
import type {} from '../../spikes/shared/debug-api';

// Engine-Spikes (Ticket 005). Bewusst robust für WebKit ohne GPU in CI: geprüft werden Laden,
// Fehlerfreiheit, __perf()-Felder und der Ablauf Antippen → Hervorheben → Schnittlinie wischen –
// keine Bildinhalte und keine Zeiten.
const ENGINES = ['babylon', 'playcanvas', 'three'] as const;

function collectProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') problems.push(msg.text()); });
  page.on('pageerror', (err) => { problems.push(err.message); });
  return problems;
}

/** Wartet bis die Szene steht; liefert false, wenn der Browser kein WebGL 2 hat. */
async function waitReady(page: Page): Promise<boolean> {
  await page.waitForFunction(() => ['ready', 'no-webgl2', 'error'].includes(document.body.dataset['state'] ?? ''), null, {
    timeout: 60_000,
  });
  const state = await page.evaluate(() => document.body.dataset['state']);
  expect(state).not.toBe('error');
  return state === 'ready';
}

for (const engine of ENGINES) {
  test.describe(`Spike ${engine}`, () => {
    test.setTimeout(90_000);

    test('lädt ohne Fehler und liefert __perf()', async ({ page }) => {
      const problems = collectProblems(page);
      await page.goto(`./spikes/${engine}/?perf=1`);
      await expect(page.locator('canvas#scene')).toHaveCount(1);
      const ready = await waitReady(page);
      if (!ready) {
        await expect(page.locator('.hud-status')).toContainText('WebGL 2 nicht verfügbar');
        test.skip(true, 'Browser ohne WebGL 2');
        return;
      }
      await page.waitForFunction(() => (window.__perf?.().drawCalls ?? 0) > 0, null, { timeout: 30_000 });
      const perf = await page.evaluate(() => window.__perf?.());
      expect(perf).toBeDefined();
      if (!perf) return;
      expect(perf.schema).toBe(1);
      expect(perf.engine).toBe(engine);
      expect(perf.scene).toBe('spike-werkstatt');
      expect(perf.timeToPlayableMs).not.toBeNull();
      for (const key of ['drawCalls', 'triangles', 'textureMemoryMB', 'frameTimeMsAvg', 'frameTimeMsP95'] as const) {
        expect(typeof perf[key]).toBe('number');
      }
      expect(perf.drawCalls).toBeLessThan(80);
      expect(perf.triangles).toBeLessThan(150_000);
      expect(perf.textureMemoryEstimated).toBe(true);
      expect(perf.renderScale).toBeLessThanOrEqual(2.01);
      expect(problems).toEqual([]);
    });

    test('Balken antippen hebt hervor, Wischen setzt Schnittlinie', async ({ page }) => {
      const problems = collectProblems(page);
      await page.goto(`./spikes/${engine}/?perf=1`);
      if (!(await waitReady(page))) {
        test.skip(true, 'Browser ohne WebGL 2');
        return;
      }
      const p = await page.evaluate(() => window.__spike?.beamScreenPoint(0.5) ?? null);
      expect(p).not.toBeNull();
      if (!p) return;
      await page.touchscreen.tap(p.x, p.y);
      await expect.poll(() => page.evaluate(() => window.__spike?.state().selected)).toBe(true);
      await expect(page.locator('.hud-status')).toContainText('Balken ausgewählt');

      // Wischen auf dem Balken (Pointer Events wie vom Finger)
      const a = await page.evaluate(() => window.__spike?.beamScreenPoint(0.3) ?? null);
      const b = await page.evaluate(() => window.__spike?.beamScreenPoint(0.6) ?? null);
      if (!a || !b) throw new Error('Balken nicht im Bild');
      const yawBefore = await page.evaluate(() => window.__spike?.state().yaw);
      await page.evaluate(
        ([from, to]) => {
          const el = document.querySelector('.touch');
          if (!el) throw new Error('keine Touch-Fläche');
          const fire = (type: string, x: number, y: number): void => {
            el.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
          };
          fire('pointerdown', from.x, from.y);
          for (let i = 1; i <= 5; i++) fire('pointermove', from.x + ((to.x - from.x) * i) / 5, from.y + ((to.y - from.y) * i) / 5);
          fire('pointerup', to.x, to.y);
        },
        [a, b] as const,
      );
      const cut = await page.evaluate(() => window.__spike?.state().cutMm ?? null);
      expect(cut).not.toBeNull();
      // 0,6 der Balkenlänge (1200 mm) ≈ 720 mm, Toleranz für Perspektive/Raster
      expect(Math.abs((cut ?? 0) - 720)).toBeLessThan(40);
      await expect(page.locator('.hud-status')).toContainText('Schnitt bei');
      // Wischen auf dem ausgewählten Balken dreht die Kamera nicht
      expect(await page.evaluate(() => window.__spike?.state().yaw)).toBe(yawBefore);
      expect(problems).toEqual([]);
    });
  });
}

test('Startseite verlinkt die drei Engine-Spikes', async ({ page }) => {
  await page.goto('./');
  for (const e of ENGINES) {
    await expect(page.locator(`a[href="spikes/${e}/"]`)).toHaveCount(1);
  }
});
