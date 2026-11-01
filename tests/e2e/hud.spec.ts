import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Befehl } from '../../src/input/befehle';
import type {} from '../../src/hud-demo/demo-api';

// HUD-Testseite (Ticket 011). WebKit-tauglich: Mehrfinger-Gesten als synthetische Pointer-Events
// (in WebKit ohne CDP nicht anders möglich), Tasten per echtem touchscreen.tap. Keine engen Zeitgrenzen:
// Tippen wird über den Weg erkannt, Sägezüge über Richtungsumkehr; Wartezeiten sind nur Untergrenzen.

type Schritt =
  | { t: 'down' | 'move' | 'up' | 'cancel'; id: number; x: number; y: number }
  | { t: 'warte'; ms: number }
  | { t: 'pruefe'; sel: string; name: string };

/** Spielt Zeiger-Schritte im Browser ab. Ziel ist das Element unter dem Aufsetzpunkt (wie Pointer Capture). */
async function zeiger(page: Page, schritte: Schritt[]): Promise<Record<string, boolean>> {
  return page.evaluate(async (s) => {
    const ziele = new Map<number, Element>();
    const befund: Record<string, boolean> = {};
    for (const k of s) {
      if (k.t === 'warte') {
        await new Promise((r) => setTimeout(r, k.ms));
        continue;
      }
      if (k.t === 'pruefe') {
        // Synchron direkt nach dem letzten Ereignis: Feedback ist im DOM, bevor der nächste Frame malt.
        befund[k.name] = document.querySelector(k.sel) !== null;
        continue;
      }
      if (k.t === 'down') ziele.set(k.id, document.elementFromPoint(k.x, k.y) ?? document.body);
      const el = ziele.get(k.id) ?? document.body;
      el.dispatchEvent(
        new PointerEvent(`pointer${k.t}`, {
          pointerId: k.id,
          pointerType: 'touch',
          isPrimary: k.id === 1,
          clientX: k.x,
          clientY: k.y,
          bubbles: true,
          cancelable: true,
        }),
      );
    }
    return befund;
  }, schritte);
}

/** Ziehen von a nach b in n Schritten. */
function ziehe(id: number, a: { x: number; y: number }, b: { x: number; y: number }, n = 8, warteMs = 0): Schritt[] {
  const s: Schritt[] = [{ t: 'down', id, x: a.x, y: a.y }];
  for (let i = 1; i <= n; i++) {
    s.push({ t: 'move', id, x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n });
    if (warteMs) s.push({ t: 'warte', ms: warteMs });
  }
  s.push({ t: 'up', id, x: b.x, y: b.y });
  return s;
}

async function befehle(page: Page): Promise<Befehl[]> {
  return page.evaluate(() => window.__hudDemo?.befehle.slice() ?? []);
}
async function leeren(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__hudDemo?.befehle.splice(0);
  });
}
async function mitte(l: Locator): Promise<{ x: number; y: number; w: number; h: number; left: number; top: number }> {
  const b = await l.boundingBox();
  if (!b) throw new Error('Element nicht sichtbar');
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height, left: b.x, top: b.y };
}

function sammleFehler(page: Page): string[] {
  const p: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') p.push(m.text());
  });
  page.on('pageerror', (e) => p.push(e.message));
  return p;
}

async function laden(page: Page): Promise<void> {
  await page.goto('./hud-demo/');
  await page.waitForFunction(() => document.body.dataset['state'] === 'ready');
}

const hochkant = (page: Page): boolean => {
  const v = page.viewportSize();
  return !!v && v.height > v.width;
};

test('Hochformat: Hinweis „Bitte quer halten“, Querformat: kein Hinweis (ADR 0004)', async ({ page }) => {
  const fehler = sammleFehler(page);
  await laden(page);
  const hinweis = page.getByRole('heading', { name: 'Bitte quer halten' });
  if (hochkant(page)) await expect(hinweis).toBeVisible();
  else await expect(hinweis).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  expect(fehler).toEqual([]);
});

test('Drehen mitten im Werkbank-Modus: Zustand bleibt, Hinweis kommt und geht', async ({ page }) => {
  await laden(page);
  await page.evaluate(() => window.__hudDemo?.hud.modus('werkbank-messen'));
  await page.setViewportSize({ width: 393, height: 734 });
  await expect(page.getByRole('heading', { name: 'Bitte quer halten' })).toBeVisible();
  await page.setViewportSize({ width: 734, height: 343 });
  await expect(page.getByRole('heading', { name: 'Bitte quer halten' })).toBeHidden();
  await expect(page.locator('.hud')).toHaveAttribute('data-modus', 'werkbank-messen');
  await expect(page.locator('.hud-massband-griff')).toBeVisible();
});

test.describe('Querformat', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(hochkant(page), 'Vertical Slice nur quer (ADR 0004); hochkant nur Hinweis');
    await laden(page);
  });

  test('U4/U6: viewport-fit=cover, Safe-Area-Variablen, touch-action none, keine Textauswahl', async ({ page }) => {
    const vp = await page.locator('meta[name=viewport]').getAttribute('content');
    expect(vp).toContain('viewport-fit=cover');
    expect(vp).toContain('user-scalable=no');
    const css = readFileSync(resolve(import.meta.dirname, '../../src/ui/hud.css'), 'utf8');
    for (const s of ['left', 'right', 'top', 'bottom']) expect(css).toContain(`env(safe-area-inset-${s}`);
    const stil = await page.evaluate(() => {
      const f = (sel: string): { ta: string; us: string } => {
        const el = document.querySelector(sel);
        if (!el) return { ta: '', us: '' };
        const cs = getComputedStyle(el);
        return { ta: cs.touchAction, us: cs.userSelect || cs.getPropertyValue('-webkit-user-select') };
      };
      return { szene: f('#szene'), flaeche: f('.hud-flaeche') };
    });
    expect(stil.szene.ta).toBe('none');
    expect(stil.flaeche.ta).toBe('none');
    expect(stil.flaeche.us).toBe('none');
  });

  test('U1/U3: Touch-Ziele ≥ 44 pt, Text ≥ 15 pt in allen Modi', async ({ page }) => {
    const modi = ['erkunden', 'werkbank-messen', 'werkbank-ansetzen', 'werkbank-saegen', 'ergebnis'] as const;
    for (const m of modi) {
      const pruefung = await page.evaluate((modus) => {
        const hud = window.__hudDemo?.hud;
        if (!hud) throw new Error('kein HUD');
        hud.modus(modus);
        hud.messwertAnzeigen(450);
        hud.hinweis('Prüfhinweis');
        hud.ergebnisKarte(modus === 'ergebnis' ? { stufe: 'B – Sauber', q: 80, hauptursache: 'Test', preis: 14 } : null);
        hud.lupe(modus === 'werkbank-messen' ? { xCss: 400, yCss: 200 } : null);
        const sichtbar = (el: Element): boolean => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
        };
        const ziele = [...document.querySelectorAll('.hud button, .hud [role=slider], .hud [data-touch]')]
          .filter(sichtbar)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return { n: el.className || el.tagName, w: r.width, h: r.height };
          });
        const klein: string[] = [];
        for (const el of document.querySelectorAll('.hud *')) {
          if (!sichtbar(el)) continue;
          const eigenerText = [...el.childNodes].some((c) => c.nodeType === Node.TEXT_NODE && (c.textContent ?? '').trim() !== '');
          if (eigenerText && parseFloat(getComputedStyle(el).fontSize) < 15) klein.push(el.className || el.tagName);
        }
        return { ziele, klein };
      }, m);
      expect(pruefung.ziele.length, m).toBeGreaterThan(0);
      for (const z of pruefung.ziele) {
        expect(z.w, `${m}: ${z.n}`).toBeGreaterThanOrEqual(44);
        expect(z.h, `${m}: ${z.n}`).toBeGreaterThanOrEqual(44);
      }
      expect(pruefung.klein, m).toEqual([]);
    }
  });

  test('Erkunden: Stick links + Umschauen rechts gleichzeitig, Feedback sofort', async ({ page }) => {
    const w = page.viewportSize()?.width ?? 734;
    const h = page.viewportSize()?.height ?? 343;
    const L = { x: w * 0.25, y: h * 0.6 };
    const R = { x: w * 0.7, y: h * 0.5 };
    await leeren(page);
    const befund = await zeiger(page, [
      { t: 'down', id: 1, x: L.x, y: L.y },
      { t: 'pruefe', sel: '.hud-stick .hud-stick-knopf', name: 'stickSofort' },
      { t: 'down', id: 2, x: R.x, y: R.y },
      { t: 'pruefe', sel: '.hud-finger', name: 'fingerSofort' },
      { t: 'move', id: 1, x: L.x, y: L.y - 20 },
      { t: 'move', id: 2, x: R.x + 20, y: R.y },
      { t: 'move', id: 1, x: L.x + 10, y: L.y - 40 },
      { t: 'move', id: 2, x: R.x + 50, y: R.y + 6 },
      { t: 'warte', ms: 120 },
      { t: 'pruefe', sel: '.hud-stick', name: 'stickNochDa' },
      { t: 'up', id: 2, x: R.x + 50, y: R.y + 6 },
      { t: 'up', id: 1, x: L.x + 10, y: L.y - 40 },
      { t: 'pruefe', sel: '.hud-stick', name: 'stickNachLoslassen' },
    ]);
    expect(befund).toEqual({ stickSofort: true, fingerSofort: true, stickNochDa: true, stickNachLoslassen: false });
    const b = await befehle(page);
    const bewegen = b.filter((x): x is Extract<Befehl, { art: 'bewegen' }> => x.art === 'bewegen');
    expect(bewegen.some((x) => x.vorwaerts > 0.5 && x.seitwaerts > 0)).toBe(true);
    expect(bewegen.at(-1)).toEqual({ art: 'bewegen', vorwaerts: 0, seitwaerts: 0 });
    const schauen = b.filter((x): x is Extract<Befehl, { art: 'umschauen' }> => x.art === 'umschauen');
    expect(schauen.reduce((s, x) => s + x.dxPx, 0)).toBeCloseTo(50);
    expect(b.some((x) => x.art === 'tippen')).toBe(false);
  });

  test('Erkunden: Randzone 20 pt ignoriert, Tippen und Halten', async ({ page }) => {
    const w = page.viewportSize()?.width ?? 734;
    const h = page.viewportSize()?.height ?? 343;
    await leeren(page);
    const rand = await zeiger(page, [
      { t: 'down', id: 1, x: 10, y: h / 2 },
      { t: 'pruefe', sel: '.hud-stick', name: 'stick' },
      { t: 'move', id: 1, x: 60, y: h / 2 },
      { t: 'up', id: 1, x: 60, y: h / 2 },
      { t: 'down', id: 2, x: w - 8, y: h / 2 },
      { t: 'up', id: 2, x: w - 8, y: h / 2 },
    ]);
    expect(rand['stick']).toBe(false);
    expect(await befehle(page)).toEqual([]);

    // Echtes Tippen (Touchscreen) rechts → tippen + Ring
    await page.touchscreen.tap(w * 0.65, h * 0.35);
    await expect.poll(async () => (await befehle(page)).filter((x) => x.art === 'tippen').length).toBe(1);

    // Halten ≥ 300 ms ohne Bewegung → halten, danach kein tippen
    await leeren(page);
    await zeiger(page, [{ t: 'down', id: 3, x: w * 0.6, y: h * 0.4 }, { t: 'pruefe', sel: '.hud-haltering', name: 'ring' }, { t: 'warte', ms: 450 }, { t: 'up', id: 3, x: w * 0.6 + 3, y: h * 0.4 }]);
    const b = await befehle(page);
    expect(b.filter((x) => x.art === 'halten')).toHaveLength(1);
    expect(b.filter((x) => x.art === 'tippen')).toHaveLength(0);

    // Langsames Tippen (Hauptthread träge, 250 ms) bleibt ein Tippen, solange der Finger stillhält
    await leeren(page);
    await zeiger(page, [{ t: 'down', id: 4, x: 200, y: h * 0.4 }, { t: 'warte', ms: 250 }, { t: 'up', id: 4, x: 204, y: h * 0.4 }]);
    expect((await befehle(page)).filter((x) => x.art === 'tippen')).toHaveLength(1);
  });

  test('Werkbank: Massband, Feintasten, Anreissen, Ansetzen, Sägen mit Stützen, Ergebnis, Abliefern', async ({ page }) => {
    test.setTimeout(60_000);
    const h = page.viewportSize()?.height ?? 343;

    // Aktionstaste mit echtem Tippen; Druck-Feedback beim Aufsetzen
    const taste = page.getByRole('button', { name: 'Werkbank benutzen' });
    const t = await mitte(taste);
    const gedrueckt = await zeiger(page, [{ t: 'down', id: 9, x: t.x, y: t.y }, { t: 'pruefe', sel: '.hud-aktionstaste.gedrueckt', name: 'p' }, { t: 'up', id: 9, x: t.x, y: t.y }]);
    expect(gedrueckt['p']).toBe(true);
    await taste.tap();
    await expect(page.locator('.hud')).toHaveAttribute('data-modus', 'werkbank-messen');

    // Massband-Griff ziehen: Lupe neben dem Daumen, Deltas im 0,5-mm-Raster
    await leeren(page);
    const griff = await mitte(page.locator('.hud-massband-griff'));
    const zielPx = 279; // 279 px / 0,62 px/mm = 450 mm
    const lupe = await zeiger(page, [
      { t: 'down', id: 1, x: griff.x, y: griff.y },
      { t: 'pruefe', sel: '.hud-lupe.sichtbar', name: 'lupeSofort' },
      ...ziehe(1, griff, { x: griff.x + zielPx, y: griff.y }, 10).slice(1),
    ]);
    expect(lupe['lupeSofort']).toBe(true);
    const mb = (await befehle(page)).filter((x): x is Extract<Befehl, { art: 'massband' }> => x.art === 'massband');
    expect(mb.length).toBeGreaterThan(1);
    for (const x of mb) expect(Math.abs(x.deltaMm * 2 - Math.round(x.deltaMm * 2))).toBeLessThan(1e-9);
    expect(mb.reduce((s, x) => s + x.deltaMm, 0)).toBeCloseTo(450, 5);
    await expect(page.locator('.hud-messwert')).toHaveText('450,0 mm');

    await page.getByRole('button', { name: '0,5 mm länger' }).tap();
    await expect(page.locator('.hud-messwert')).toHaveText('450,5 mm');
    await page.getByRole('button', { name: '0,5 mm kürzer' }).tap();
    await expect(page.locator('.hud-messwert')).toHaveText('450,0 mm');

    // Tippen auf die Fläche setzt das Massband direkt
    await leeren(page);
    await page.touchscreen.tap(400, h * 0.75);
    await expect.poll(async () => (await befehle(page)).map((x) => x.art)).toContain('massbandSetzen');
    await page.getByRole('button', { name: '✎ Anreissen' }).tap();
    await expect(page.locator('.hud')).toHaveAttribute('data-modus', 'werkbank-ansetzen');

    // Blatt seitlich ziehen: 16 px = +0,8 mm, Begrenzung ±3 mm
    await leeren(page);
    const blatt = await mitte(page.locator('.hud-ansetzen'));
    await zeiger(page, ziehe(2, blatt, { x: blatt.x + 16, y: blatt.y }, 4));
    let bv = (await befehle(page)).filter((x): x is Extract<Befehl, { art: 'blattVersatz' }> => x.art === 'blattVersatz');
    expect(bv.reduce((s, x) => s + x.deltaMm, 0)).toBeCloseTo(0.8, 5);
    await expect(page.locator('.hud-ansetzen-text')).toContainText('+0,8 mm');
    await zeiger(page, ziehe(2, blatt, { x: blatt.x + 400, y: blatt.y }, 6));
    bv = (await befehle(page)).filter((x): x is Extract<Befehl, { art: 'blattVersatz' }> => x.art === 'blattVersatz');
    expect(bv.reduce((s, x) => s + x.deltaMm, 0)).toBeCloseTo(3, 5);
    await zeiger(page, ziehe(2, blatt, { x: blatt.x - 44, y: blatt.y }, 4));
    await expect(page.locator('.hud-ansetzen-text')).toContainText('+0,8 mm');

    await page.getByRole('button', { name: 'Sägen ›' }).tap();
    await expect(page.locator('.hud')).toHaveAttribute('data-modus', 'werkbank-saegen');

    // Sägen: links „Abfall stützen“ halten, rechts auf der Führungsspur auf und ab (8 Züge = 16 Hälften)
    await leeren(page);
    const spur = await mitte(page.locator('.hud-saegespur'));
    const stuetzen = await mitte(page.getByRole('button', { name: /Abfall\s*stützen/ }));
    const oben = spur.top + 30;
    const unten = spur.top + spur.h - 30;
    const saegen: Schritt[] = [
      { t: 'down', id: 5, x: stuetzen.x, y: stuetzen.y },
      { t: 'pruefe', sel: '.hud-stuetzen.gehalten', name: 'stuetzenSofort' },
      { t: 'down', id: 6, x: spur.x, y: oben },
      { t: 'pruefe', sel: '.hud-saegespur.aktiv', name: 'spurSofort' },
    ];
    for (let hälfte = 0; hälfte < 16; hälfte++) {
      const [von, nach] = hälfte % 2 === 0 ? [oben, unten] : [unten, oben];
      for (let i = 1; i <= 6; i++) {
        saegen.push({ t: 'move', id: 6, x: spur.x + 6, y: von + ((nach - von) * i) / 6 }, { t: 'warte', ms: 12 });
      }
      if (hälfte === 3) saegen.push({ t: 'pruefe', sel: '.hud-saegespur.zug', name: 'zugFeedback' });
    }
    saegen.push({ t: 'up', id: 6, x: spur.x + 6, y: oben }, { t: 'up', id: 5, x: stuetzen.x, y: stuetzen.y });
    const sb = await zeiger(page, saegen);
    expect(sb).toEqual({ stuetzenSofort: true, spurSofort: true, zugFeedback: true });
    const b = await befehle(page);
    const zuege = b.filter((x): x is Extract<Befehl, { art: 'sägezug' }> => x.art === 'sägezug');
    expect(zuege).toHaveLength(8);
    for (const z of zuege) {
      expect(z.seitenabweichung).toBeGreaterThan(0);
      expect(z.seitenabweichung).toBeLessThan(0.2);
      expect(z.tempo).toBeGreaterThanOrEqual(0);
      expect(z.tempo).toBeLessThanOrEqual(2);
    }
    expect(b.filter((x) => x.art === 'stuetzen')).toEqual([{ art: 'stuetzen', an: true }, { art: 'stuetzen', an: false }]);

    // Ergebniskarte
    const karte = page.getByRole('dialog', { name: 'Ergebnis' });
    await expect(karte).toBeVisible();
    await expect(karte.locator('.hud-stufe')).not.toBeEmpty();
    await expect(karte.locator('.hud-q')).toContainText('Qualität');
    await expect(karte.locator('.hud-ursache')).not.toBeEmpty();
    await expect(karte.locator('.hud-preis')).toContainText(/Preis \d+ G|Abliefern nicht möglich/);
    await expect(page.getByRole('button', { name: 'Neues Brett' })).toBeVisible();
    const geldVorher = await page.evaluate(() => window.__hudDemo?.zustand().geld ?? 0);
    const abliefern = page.getByRole('button', { name: 'Abliefern' });
    if (await abliefern.isEnabled()) {
      await abliefern.tap();
      await expect(page.locator('.hud')).toHaveAttribute('data-modus', 'erkunden');
      expect(await page.evaluate(() => window.__hudDemo?.zustand().geld ?? 0)).toBeGreaterThan(geldVorher);
    }
  });

  test('Zurück-Taste verlässt die Werkbank; Stützen wird beim Moduswechsel gelöst', async ({ page }) => {
    await page.evaluate(() => window.__hudDemo?.hud.modus('werkbank-saegen'));
    const st = await mitte(page.getByRole('button', { name: /Abfall\s*stützen/ }));
    await leeren(page);
    await zeiger(page, [{ t: 'down', id: 7, x: st.x, y: st.y }]);
    await page.getByRole('button', { name: '‹ Zurück' }).tap();
    await expect(page.locator('.hud')).toHaveAttribute('data-modus', 'erkunden');
    const b = await befehle(page);
    expect(b).toContainEqual({ art: 'aktion', id: 'zurueck' });
    expect(b.filter((x) => x.art === 'stuetzen').at(-1)).toEqual({ art: 'stuetzen', an: false });
  });

  test('echte Mehrfinger-Berührung (CDP, nur Chromium): Stick + Umschauen', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'CDP-Touch nur in Chromium; WebKit nutzt die synthetischen Pointer-Tests oben');
    const w = page.viewportSize()?.width ?? 734;
    const h = page.viewportSize()?.height ?? 343;
    const cdp = await page.context().newCDPSession(page);
    await leeren(page);
    const p = (x: number, y: number, id: number): { x: number; y: number; id: number } => ({ x, y, id });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p(w * 0.25, h * 0.6, 1)] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p(w * 0.25, h * 0.6, 1), p(w * 0.7, h * 0.5, 2)] });
    await expect(page.locator('.hud-stick')).toHaveCount(1);
    for (let i = 1; i <= 5; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p(w * 0.25, h * 0.6 - i * 8, 1), p(w * 0.7 + i * 10, h * 0.5, 2)] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('.hud-stick')).toHaveCount(0);
    const b = await befehle(page);
    expect(b.some((x) => x.art === 'bewegen' && x.vorwaerts > 0.5)).toBe(true);
    expect(b.some((x) => x.art === 'umschauen' && x.dxPx > 0), JSON.stringify(b.filter((x) => x.art !== 'bewegen'))).toBe(true);
  });
});
