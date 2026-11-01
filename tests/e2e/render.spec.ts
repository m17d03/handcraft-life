import { expect, test, type Page } from '@playwright/test';
// Typen bringen die globalen Deklarationen window.__perf / window.__view mit.
import type {} from '../../src/perf/perf-snapshot';
import type { WerkstattViewDebug } from '../../src/render/view-api';

declare global {
  interface Window {
    __view?: WerkstattViewDebug;
  }
}

// Ticket 010: Spielseite /spiel/. Robust für WebKit ohne GPU in CI: keine Bildinhalte, keine
// Zeitgrenzen-abhängigen Taps (QA-Befund 005) – die View wird direkt über window.__view angesteuert,
// gewartet wird nur per Polling auf Zustände.
const SPIEL = './spiel/?debug=1';
const LANG = { timeout: 60_000 };

// Warnungen über GL-Objekte eines fremden/alten Kontexts zählen ebenfalls als Fehler (QA 010).
const GL_WARNUNG = /does not belong to this context|object does not belong/i;

function sammleFehler(page: Page): string[] {
  const probleme: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || (msg.type() === 'warning' && GL_WARNUNG.test(msg.text()))) probleme.push(msg.text());
  });
  page.on('pageerror', (err) => { probleme.push(err.message); });
  return probleme;
}

/** Wartet, bis die Szene steht; false, wenn der Browser kein WebGL 2 hat. */
async function bereit(page: Page): Promise<boolean> {
  await page.waitForFunction(() => ['ready', 'no-webgl2', 'error'].includes(document.body.dataset['state'] ?? ''), null, LANG);
  const state = await page.evaluate(() => document.body.dataset['state']);
  expect(state).not.toBe('error');
  return state === 'ready';
}

test.describe('Spielseite /spiel/', () => {
  test.setTimeout(120_000);

  test('Startseite verlinkt „Spielen“ als ersten Eintrag', async ({ page }) => {
    await page.goto('./');
    const erster = page.locator('main nav.links a').first();
    await expect(erster).toHaveText('Spielen');
    await expect(erster).toHaveAttribute('href', 'spiel/');
  });

  test('lädt ohne Fehler, Canvas da, __perf() liefert Werte innerhalb der Budgets', async ({ page }) => {
    const probleme = sammleFehler(page);
    await page.goto(SPIEL);
    await expect(page.locator('canvas#scene')).toHaveCount(1);
    await expect(page.locator('#debug-overlay')).toBeVisible();
    if (!(await bereit(page))) {
      await expect(page.locator('#spiel-status')).toContainText('WebGL 2 nicht verfügbar');
      test.skip(true, 'Browser ohne WebGL 2');
      return;
    }
    await page.waitForFunction(() => (window.__perf?.().drawCalls ?? 0) > 0, null, LANG);
    const perf = await page.evaluate(() => window.__perf?.());
    expect(perf).toBeDefined();
    if (!perf) return;
    expect(perf.schema).toBe(1);
    expect(perf.engine).toBe('three');
    expect(perf.engineVersion).toBe('187');
    expect(perf.scene).toBe('werkstatt');
    expect(perf.timeToPlayableMs).not.toBeNull();
    expect(perf.timeToFirstFrameMs).not.toBeNull();
    expect(perf.drawCalls).toBeLessThan(80);
    expect(perf.triangles).toBeGreaterThan(0);
    expect(perf.triangles).toBeLessThan(150_000);
    expect(perf.renderScale).toBeLessThanOrEqual(2.01);
    expect(['msaa', 'none']).toContain(perf.aa);
    if (perf.aa === 'msaa') expect(perf.msaaSamples).toBeGreaterThan(0);
    expect(perf.contextLostCount).toBe(0);
    expect(perf.errorCount).toBe(0);
    expect(probleme).toEqual([]);
  });

  test('pick auf Brett-Mitte → brett; mm-Umrechnung stimmt; alle View-Methoden laufen', async ({ page }) => {
    const probleme = sammleFehler(page);
    await page.goto(SPIEL);
    if (!(await bereit(page))) {
      test.skip(true, 'Browser ohne WebGL 2');
      return;
    }
    const mitte = await page.evaluate(() => {
      const v = window.__view;
      if (!v) throw new Error('__view fehlt');
      const p = v.weltNachBildschirm(1000);
      return p && { p, id: v.pick(p.x, p.y), mm: v.bildschirmNachBrettMm(p.x, p.y) };
    });
    expect(mitte).not.toBeNull();
    expect(mitte?.id).toBe('brett');
    expect(Math.abs((mitte?.mm ?? 0) - 1000)).toBeLessThan(0.5);
    // Ecke oben links: Wand → kein Werkstück
    expect(await page.evaluate(() => window.__view?.pick(5, 5))).not.toBe('brett');

    // Ablauf Messen → Anreissen → Sägen → Ergebnis (nur Darstellung)
    const nachSchnitt = await page.evaluate(() => {
      const v = window.__view;
      if (!v) throw new Error('__view fehlt');
      v.brettZeigen(2000, 'b');
      v.massbandZeigen(600);
      v.markierungZeigen(600);
      v.hervorheben('brett');
      v.saegeZeigen({ versatzMm: 0.8, tiefe01: 0.5, driftGrad: 1.5 });
      v.saegeZeigen(null);
      v.massbandZeigen(null);
      v.schnittErgebnisZeigen(599.2);
      const rest = v.bildschirmpunktVon('reststueck');
      const z = v.zustand();
      return { rest, restId: rest ? v.pick(rest.x, rest.y) : null, brett: z.brett, hervor: z.hervorgehoben };
    });
    expect(nachSchnitt.brett).toEqual({ laengeMm: 2000, bezugsende: 'b', schnittIstMm: 599.2 });
    expect(nachSchnitt.restId).toBe('reststueck');
    expect(nachSchnitt.hervor).toBe('brett');

    // Hervorhebung nur am Zielobjekt (QA 010: Werkbank teilte Material mit Regal/Holzlager)
    for (const id of ['werkbank', 'brett', 'saege', 'massband', 'bleistift']) {
      const leuchtend = await page.evaluate((i) => {
        window.__view?.hervorheben(i);
        return window.__view?.zustand().leuchtend ?? [];
      }, id);
      expect(leuchtend.length).toBeGreaterThan(0);
      for (const name of leuchtend) expect(name === id || name.startsWith(`${id}.`)).toBe(true);
    }
    expect(await page.evaluate(() => { window.__view?.hervorheben(null); return window.__view?.zustand().leuchtend; })).toEqual([]);

    // Messen → Anreissen: Massband verdeckt den Bleistiftstrich nicht (beide Bezugsenden)
    for (const ende of ['a', 'b'] as const) {
      const id = await page.evaluate((e) => {
        const v = window.__view;
        if (!v) throw new Error('__view fehlt');
        v.schnittErgebnisZeigen(null);
        v.brettZeigen(2000, e);
        v.massbandZeigen(600);
        v.markierungZeigen(600);
        const p = v.weltNachBildschirm(600);
        return p ? v.pick(p.x, p.y) : null;
      }, ende);
      expect(id).toBe('brett');
    }
    await page.evaluate(() => { window.__view?.massbandZeigen(null); window.__view?.markierungZeigen(null); });

    // Arbeitsansicht: Fahrt endet (≤ 600 ms, hier nur auf Zustand gewartet), Brett weiterhin pickbar
    await page.evaluate(() => {
      window.__view?.schnittErgebnisZeigen(null);
      window.__view?.arbeitsansicht(true);
    });
    await expect.poll(() => page.evaluate(() => window.__view?.zustand().fahrt), LANG).toBe(false);
    const arbeit = await page.evaluate(() => {
      const v = window.__view;
      if (!v) throw new Error('__view fehlt');
      const p = v.weltNachBildschirm(1000);
      return { z: v.zustand(), id: p ? v.pick(p.x, p.y) : null, w: window.innerWidth, h: window.innerHeight, p };
    });
    expect(arbeit.z.arbeitsansicht).toBe(true);
    expect(arbeit.id).toBe('brett');
    // in der Arbeitsansicht liegt die Brettmitte in der Bildmitte
    expect(Math.abs((arbeit.p?.x ?? 0) - arbeit.w / 2)).toBeLessThan(2);
    await page.evaluate(() => { window.__view?.arbeitsansicht(false); });
    await expect.poll(() => page.evaluate(() => window.__view?.zustand().fahrt), LANG).toBe(false);
    expect(await page.evaluate(() => window.__view?.zustand().arbeitsansicht)).toBe(false);

    // Bewegen/Umschauen verändern die Kamera
    const vorher = await page.evaluate(() => window.__view?.zustand().kamera.yaw);
    await page.evaluate(() => { window.__view?.umschauen(40, 0); });
    await expect.poll(() => page.evaluate(() => window.__view?.zustand().kamera.yaw), LANG).not.toBe(vorher);
    expect(probleme).toEqual([]);
  });

  test('Kontextverlust (WEBGL_lose_context) → Szene stellt sich wieder her', async ({ page }) => {
    const probleme = sammleFehler(page);
    await page.goto(SPIEL);
    if (!(await bereit(page))) {
      test.skip(true, 'Browser ohne WebGL 2');
      return;
    }
    const hatErweiterung = await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('#scene');
      const ext = c?.getContext('webgl2')?.getExtension('WEBGL_lose_context');
      if (!ext) return false;
      (window as unknown as { __lose: WEBGL_lose_context }).__lose = ext;
      ext.loseContext();
      return true;
    });
    if (!hatErweiterung) {
      test.skip(true, 'WEBGL_lose_context nicht verfügbar');
      return;
    }
    await expect.poll(() => page.evaluate(() => window.__view?.zustand().kontextVerloren), LANG).toBe(true);
    expect(await page.evaluate(() => window.__perf?.().contextLostCount)).toBe(1);
    await expect.poll(() => page.evaluate(() => window.__perf?.().drawCalls), LANG).toBe(0);
    const framesVorher = await page.evaluate(() => window.__view?.zustand().frames ?? 0);

    await page.evaluate(() => { (window as unknown as { __lose: WEBGL_lose_context }).__lose.restoreContext(); });
    await expect.poll(() => page.evaluate(() => window.__view?.zustand().kontextVerloren), LANG).toBe(false);
    await expect.poll(() => page.evaluate(() => window.__view?.zustand().frames ?? 0), LANG).toBeGreaterThan(framesVorher + 1);
    await expect.poll(() => page.evaluate(() => window.__perf?.().drawCalls ?? 0), LANG).toBeGreaterThan(0);
    const id = await page.evaluate(() => {
      const p = window.__view?.weltNachBildschirm(1000);
      return p ? window.__view?.pick(p.x, p.y) : null;
    });
    expect(id).toBe('brett');
    // dispose nach der Wiederherstellung löscht nur eigene GL-Objekte (keine Fremdkontext-Warnungen)
    await page.evaluate(() => { window.__view?.dispose(); });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    // Konsolenmeldungen des Browsers zum absichtlichen Verlust sind kein Fehler der Seite
    expect(probleme.filter((p) => !/CONTEXT_LOST|context lost|loseContext/i.test(p))).toEqual([]);
  });

  test('Hochformat zeigt „Bitte quer halten“, Querformat nicht', async ({ page }) => {
    await page.goto(SPIEL);
    const vp = page.viewportSize();
    const hinweis = page.locator('.quer-hinweis');
    if (vp && vp.height > vp.width) {
      await expect(hinweis).toBeVisible();
      await expect(hinweis).toContainText('Bitte quer halten');
    } else {
      await expect(hinweis).toBeHidden();
    }
  });

  test('ohne ?debug=1 kein __view und kein Overlay', async ({ page }) => {
    await page.goto('./spiel/');
    await bereit(page);
    expect(await page.evaluate(() => typeof window.__view)).toBe('undefined');
    expect(await page.evaluate(() => typeof window.__perf)).toBe('undefined');
    await expect(page.locator('#debug-overlay')).toHaveCount(0);
  });
});
