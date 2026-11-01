import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { build } from 'vite';
import type * as InstallHinweisModul from '../../src/ui/installhinweis';

// Ticket 014: Manifest, Icons, Head-Tags, Installationshinweis im (emulierten) iPhone-Safari.

declare global {
  interface Window {
    InstallHinweis: typeof InstallHinweisModul;
  }
}

interface Manifest {
  id: string;
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  display_override?: string[];
  orientation: string;
  theme_color: string;
  background_color: string;
  icons: { src: string; sizes: string; type: string }[];
}

/** PNG-Breite/-Höhe aus dem IHDR-Block. */
function pngGroesse(b: Buffer): { w: number; h: number } {
  expect(b.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(b.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

test('Manifest erreichbar und gültig: Vollbild quer, start_url/scope unter spiel/, Stil-A-Farben', async ({ request, baseURL }) => {
  const res = await request.get('./manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const m = (await res.json()) as Manifest;
  const manifestUrl = new URL('./manifest.webmanifest', baseURL);
  const start = new URL(m.start_url, manifestUrl);
  const scope = new URL(m.scope, manifestUrl);
  expect(start.pathname.endsWith('/spiel/')).toBe(true);
  expect(scope.pathname.endsWith('/spiel/')).toBe(true);
  expect(start.href.startsWith(scope.href)).toBe(true); // start_url liegt im scope, sonst ignoriert der Browser ihn
  expect(start.origin).toBe(manifestUrl.origin);
  expect(m.name).toBe('Handcraft Life');
  expect(m.short_name.length).toBeLessThanOrEqual(12); // passt unter das Icon
  expect(m.display).toBe('fullscreen');
  expect(m.display_override).toEqual(['fullscreen', 'standalone']);
  expect(m.orientation).toBe('landscape');
  expect(m.theme_color).toBe('#1f1a15');
  expect(m.background_color).toBe('#1f1a15');
  const groessen = m.icons.filter((i) => i.type === 'image/png').map((i) => i.sizes);
  expect(groessen).toEqual(expect.arrayContaining(['180x180', '192x192', '512x512']));
});

test('Icons laden in der angegebenen Grösse', async ({ request, baseURL }) => {
  const manifestUrl = new URL('./manifest.webmanifest', baseURL);
  const m = (await (await request.get(manifestUrl.href)).json()) as Manifest;
  for (const icon of m.icons) {
    const res = await request.get(new URL(icon.src, manifestUrl).href);
    expect(res.ok(), icon.src).toBe(true);
    if (icon.type !== 'image/png') continue;
    const { w, h } = pngGroesse(await res.body());
    expect(`${String(w)}x${String(h)}`).toBe(icon.sizes);
  }
});

test('Startseite: Manifest-Link, apple-touch-icon (180 px), Web-App-Meta-Tags', async ({ page, request }) => {
  await page.goto('./');
  const kopf = await page.evaluate(() => {
    const href = (sel: string): string | null => document.querySelector<HTMLLinkElement>(sel)?.href ?? null;
    const meta = (name: string): string | null => document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content ?? null;
    return {
      manifest: href('link[rel="manifest"]'),
      touchIcon: href('link[rel="apple-touch-icon"]'),
      capable: meta('apple-mobile-web-app-capable'),
      capableStd: meta('mobile-web-app-capable'),
      statusleiste: meta('apple-mobile-web-app-status-bar-style'),
      titel: meta('apple-mobile-web-app-title'),
      theme: meta('theme-color'),
      viewport: meta('viewport'),
    };
  });
  expect(kopf.manifest).not.toBeNull();
  expect((await request.get(kopf.manifest ?? '')).ok()).toBe(true);
  expect(kopf.touchIcon).not.toBeNull();
  const icon = await request.get(kopf.touchIcon ?? '');
  expect(icon.ok()).toBe(true);
  expect(pngGroesse(await icon.body())).toEqual({ w: 180, h: 180 });
  expect(kopf.capable).toBe('yes');
  expect(kopf.capableStd).toBe('yes');
  expect(kopf.statusleiste).toBe('black-translucent');
  expect(kopf.titel).toBe('Handcraft');
  expect(kopf.theme).toBe('#1f1a15');
  expect(kopf.viewport).toContain('viewport-fit=cover');
});

// ---------- Installationshinweis: echtes Modul, für den Browser gebündelt ----------

let modulJs = '';
test.beforeAll(async () => {
  const ergebnis = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: { entry: resolve(import.meta.dirname, '../../src/ui/installhinweis.ts'), formats: ['iife'], name: 'InstallHinweis' },
    },
  });
  const ausgaben = Array.isArray(ergebnis) ? ergebnis : [ergebnis];
  for (const a of ausgaben) {
    if (!('output' in a)) continue;
    for (const teil of a.output) if (teil.type === 'chunk') modulJs += teil.code;
  }
  expect(modulJs).toContain('installHinweisPruefen');
});

async function mitModul(page: Page): Promise<void> {
  await page.goto('./');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.addScriptTag({ content: modulJs });
}

test('Hinweis: im emulierten iPhone-Safari erst nach dem ersten Auftrag, schliessbar, gemerkt', async ({ page }) => {
  await mitModul(page);
  const erkennung = await page.evaluate(() => {
    const u = window.InstallHinweis.leseUmgebung();
    return { safari: window.InstallHinweis.istIosSafari(u.userAgent, u.maxTouchPoints), app: window.InstallHinweis.istStandalone(u) };
  });
  expect(erkennung).toEqual({ safari: true, app: false });

  expect(await page.evaluate(() => window.InstallHinweis.installHinweisPruefen({ ersterAuftragAbgeliefert: false }))).toBe('auftrag-fehlt');
  await expect(page.locator('.install-hinweis')).toHaveCount(0);

  expect(await page.evaluate(() => window.InstallHinweis.installHinweisPruefen({ ersterAuftragAbgeliefert: true }))).toBe('zeigen');
  // Zweiter Aufruf erzeugt keinen zweiten Hinweis.
  await page.evaluate(() => window.InstallHinweis.installHinweisPruefen({ ersterAuftragAbgeliefert: true }));
  const hinweis = page.locator('.install-hinweis');
  await expect(hinweis).toHaveCount(1);
  await expect(hinweis).toBeVisible();
  await expect(hinweis).toContainText('Zum Home-Bildschirm');

  // Layout: vollständig im Bild, Schliessen-Taste ≥ 44 × 44 pt, Text ≥ 15 pt.
  const vp = page.viewportSize() ?? { width: 0, height: 0 };
  const box = await hinweis.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
  }
  const zu = page.getByRole('button', { name: 'Hinweis schliessen' });
  const zuBox = await zu.boundingBox();
  expect(zuBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(zuBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  const schrift = await hinweis.locator('p').first().evaluate((p) => parseFloat(getComputedStyle(p).fontSize));
  expect(schrift).toBeGreaterThanOrEqual(15);

  // Feedback sofort bei Berührung (synchron im selben Ereignis, also vor dem nächsten Frame).
  const gedrueckt = await zu.evaluate((b) => {
    b.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }));
    const an = b.classList.contains('gedrueckt');
    b.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', bubbles: true }));
    return { an, ausNachLoslassen: !b.classList.contains('gedrueckt') };
  });
  expect(gedrueckt).toEqual({ an: true, ausNachLoslassen: true });

  await zu.tap();
  await expect(hinweis).toHaveCount(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), 'hcl.installhinweis.geschlossen.v1')).not.toBeNull();

  // Nach Neuladen bleibt er weg.
  await page.reload();
  await page.addScriptTag({ content: modulJs });
  expect(await page.evaluate(() => window.InstallHinweis.installHinweisPruefen({ ersterAuftragAbgeliefert: true }))).toBe('geschlossen');
  await expect(page.locator('.install-hinweis')).toHaveCount(0);
});

test('Hinweis: nicht als Home-Bildschirm-App und nicht in Chrome auf dem iPhone', async ({ page }) => {
  await mitModul(page);
  const ergebnis = await page.evaluate(() => {
    const u = window.InstallHinweis.leseUmgebung();
    return {
      app: window.InstallHinweis.installHinweisPruefen({ ersterAuftragAbgeliefert: true, umgebung: { ...u, navigatorStandalone: true } }),
      chrome: window.InstallHinweis.installHinweisPruefen({
        ersterAuftragAbgeliefert: true,
        umgebung: { ...u, userAgent: u.userAgent.replace(/Version\/[\d.]+/, 'CriOS/138.0') },
      }),
    };
  });
  expect(ergebnis).toEqual({ app: 'schon-installiert', chrome: 'kein-ios-safari' });
  await expect(page.locator('.install-hinweis')).toHaveCount(0);
});
