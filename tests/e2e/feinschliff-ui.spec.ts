import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type {} from '../../src/hud-demo/demo-api';
import type { WerkstattViewDebug } from '../../src/render/view-api';
import type { SpielDebug } from '../../src/spiel/spiel';

declare global {
  interface Window {
    __view?: WerkstattViewDebug;
    __spiel?: SpielDebug;
  }
}

// Ticket 016: Nahansicht und Hinweise auf allen iPhones quer (QA N1, N2, N4) und Debug-Schalter in der
// Home-Bildschirm-App (5× Geldanzeige). Gesten als synthetische Pointer-Events wie in hud.spec.ts.

const LANG = { timeout: 60_000 };
// Dokumentations-Screenshots nur mit DOKU_SCREENSHOTS=1 nach docs/ schreiben, sonst in test-results/
// (Tests dürfen versionierte Dateien nicht verändern).
const SCREENSHOTS = process.env['DOKU_SCREENSHOTS'] === '1'
  ? resolve(import.meta.dirname, '../../docs/screenshots/016')
  : resolve(import.meta.dirname, '../../test-results/screenshots-016');

/** Längste echte Texte (src/spiel/ablauf.ts, endpruefung.ts) – Worst Case für Umbruch und Platz. */
const RISS_HINWEIS = 'Schritt 1/6 · Riss am rechten Ende! Prüfe beide Enden – miss vom rechtwinkligen.';
const LANGE_HINWEISE: Record<string, string> = {
  'werkbank-messen': 'Schritt 2/6 · Massband auf 600,0 mm ziehen, mit −0,5 / +0,5 fein einstellen.',
  'werkbank-ansetzen': 'Schritt 4/6 · Blatt auf die Abfallseite schieben (≈ +0,8 mm), dann „Sägen ›“.',
  'werkbank-saegen': 'Schritt 5/6 · Rechts auf und ab wischen, links „Abfall stützen“ halten.',
  erkunden: 'Tippe „An die Werkbank“ – dort wartet dein Auftrag.',
};

type Schritt = { t: 'down' | 'move' | 'up'; id: number; x: number; y: number; warte?: number };

async function zeiger(page: Page, schritte: Schritt[]): Promise<void> {
  await page.evaluate(async (s) => {
    const ziele = new Map<number, Element>();
    for (const k of s) {
      if (k.warte) await new Promise((r) => setTimeout(r, k.warte));
      if (k.t === 'down') ziele.set(k.id, document.elementFromPoint(k.x, k.y) ?? document.body);
      const el = ziele.get(k.id) ?? document.body;
      el.dispatchEvent(
        new PointerEvent(`pointer${k.t}`, { pointerId: k.id, pointerType: 'touch', isPrimary: true, clientX: k.x, clientY: k.y, bubbles: true, cancelable: true }),
      );
    }
  }, schritte);
}

const hochkant = (page: Page): boolean => {
  const v = page.viewportSize();
  return !!v && v.height > v.width;
};

async function bereit(page: Page): Promise<boolean> {
  await page.waitForFunction(() => ['ready', 'no-webgl2', 'error'].includes(document.body.dataset['state'] ?? ''), null, LANG);
  const state = await page.evaluate(() => document.body.dataset['state']);
  expect(state).not.toBe('error');
  return state === 'ready';
}

/** Layout-Prüfung im Browser: Überlauf/„…“, Touch-Ziele, Abstände, Überdeckung der Nahansicht. */
async function layoutFehler(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const fehler: string[] = [];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const sichtbar = (el: Element): boolean => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    };
    const name = (el: Element): string => (typeof el.className === 'string' && el.className ? el.className : el.tagName);
    // N2: kein abgeschnittener Text, nichts ausserhalb des Bildschirms
    for (const el of document.querySelectorAll('.hud-hinweis, .hud-auftrag, .hud-endpruefung, .hud-endpruefung *')) {
      if (!sichtbar(el) || el.tagName === 'svg' || el.closest('svg')) continue;
      const h = el as HTMLElement;
      if (h.scrollWidth > h.clientWidth + 1 && getComputedStyle(h).overflowX !== 'visible') fehler.push(`Überlauf ${name(el)}`);
      if (getComputedStyle(h).textOverflow === 'ellipsis' && h.scrollWidth > h.clientWidth + 1) fehler.push(`„…“ ${name(el)}`);
      const r = el.getBoundingClientRect();
      if (r.left < 0 || r.top < 0 || r.right > vw + 0.5 || r.bottom > vh + 0.5) fehler.push(`ausserhalb ${name(el)}`);
    }
    // N1: Tasten der Nahansicht ≥ 44 pt, Abstand ≥ 8 pt, einzeilig, innerhalb der Tafel
    const tafel = document.querySelector('.hud-endpruefung');
    if (tafel) {
      const t = tafel.getBoundingClientRect();
      const tasten = [...tafel.querySelectorAll('button')];
      for (const b of tasten) {
        const r = b.getBoundingClientRect();
        if (r.width < 44 || r.height < 44) fehler.push(`Taste zu klein ${b.textContent}: ${String(Math.round(r.width))}×${String(Math.round(r.height))}`);
        if (r.left < t.left || r.right > t.right || r.bottom > t.bottom) fehler.push(`Taste ragt aus Tafel: ${b.textContent}`);
        if (b.scrollWidth > b.clientWidth + 1) fehler.push(`Tastentext abgeschnitten: ${b.textContent}`);
      }
      for (let i = 0; i < tasten.length; i++)
        for (let j = i + 1; j < tasten.length; j++) {
          const a = tasten[i]?.getBoundingClientRect();
          const b = tasten[j]?.getBoundingClientRect();
          if (!a || !b) continue;
          const d = Math.max(b.left - a.right, a.left - b.right, b.top - a.bottom, a.top - b.bottom);
          if (d < 8) fehler.push(`Tastenabstand ${String(Math.round(d))} pt`);
        }
      // N4: Kopfzeile der Nahansicht nie unter Hinweis oder HUD-Kopfzeile
      const kopf = tafel.querySelector('strong')?.getBoundingClientRect();
      for (const o of document.querySelectorAll('.hud-hinweis, .hud-schritte, .hud-auftrag, .hud-zurueck, .hud-geld')) {
        if (!sichtbar(o) || !kopf) continue;
        const r = o.getBoundingClientRect();
        if (r.left < t.right && r.right > t.left && t.top < r.bottom + 8) fehler.push(`Nahansicht unter ${name(o)} (${String(Math.round(r.bottom))} > ${String(Math.round(t.top))})`);
      }
    }
    return fehler;
  });
}

const GROESSEN = [
  { width: 667, height: 375, notch: false }, // iPhone SE
  { width: 734, height: 343, notch: true }, // iPhone 12/13 mini (Safari mit Leisten)
  { width: 852, height: 393, notch: true }, // iPhone 15/16
  { width: 932, height: 430, notch: true }, // iPhone 15 Pro Max (Referenzgerät)
  { width: 932, height: 300, notch: true }, // N4: Safari-Leisten sichtbar
  { width: 667, height: 300, notch: false },
];

test.describe('Ticket 016 – Nahansicht und Hinweise (N1, N2, N4)', () => {
  test.setTimeout(240_000);
  for (const g of GROESSEN) {
    test(`Nahansicht ${String(g.width)}×${String(g.height)}${g.notch ? ' mit Notch' : ''}`, async ({ page }) => {
      test.skip(hochkant(page), 'Querformat (ADR 0004); läuft einmal im Querformat-Projekt');
      await page.setViewportSize({ width: g.width, height: g.height });
      await page.goto(`./spiel/?debug=1&saat=7&test=1&dpr=1${g.notch ? '&notch=1' : ''}`);
      if (!(await bereit(page))) {
        test.skip(true, 'Browser ohne WebGL 2');
        return;
      }
      const taste = page.locator('.hud-aktionstaste');
      await expect(taste).toBeVisible(LANG);
      await taste.tap();
      await expect.poll(() => page.evaluate(() => window.__spiel?.zustand().arbeit?.phase ?? null), LANG).toBe('bezugsende');
      await expect.poll(() => page.evaluate(() => window.__view?.zustand().fahrt), LANG).toBe(false);
      const tipp = await page.evaluate(() => {
        const z = window.__spiel?.zustand();
        const ws = z?.inventar.werkstuecke.find((w) => w.id === z.arbeit?.werkstueckId);
        const L = ws?.masse_mm.l ?? 2000;
        // Nahe am rechten Ende, aber ausserhalb der Randzone (Safe Area + 20 pt), die Tippen ignoriert
        const grenze = window.innerWidth - (document.querySelector('.hud-sim-notch') ? 59 : 0) - 30;
        for (const mm of [40, 120, 200, 300, 400]) {
          const p = window.__view?.weltNachBildschirm(L - mm) ?? null;
          if (p && p.x < grenze) return p;
        }
        return null;
      });
      expect(tipp).not.toBeNull();
      if (!tipp) return;
      await zeiger(page, [{ t: 'down', id: 3, x: tipp.x, y: tipp.y }, { t: 'up', id: 3, x: tipp.x, y: tipp.y }]);
      const pruefung = page.getByRole('dialog', { name: 'Brettende prüfen' });
      await expect(pruefung).toBeVisible();
      // Worst Case: längster Warnhinweis und Riss-Zeile in der Tafel (Inhalte hängen sonst von der Saat ab)
      await page.evaluate((text) => {
        const h = document.querySelector<HTMLElement>('.hud-hinweis');
        if (h) {
          h.hidden = false;
          h.classList.add('warnung');
          h.textContent = text;
        }
        const t = document.querySelector('.hud-endpruefung-text');
        if (t && !t.querySelector('.riss')) {
          const p = document.createElement('p');
          p.className = 'riss';
          p.textContent = 'Endriss 35 mm – davon nicht messen.';
          t.querySelector('strong')?.after(p);
        }
        window.dispatchEvent(new Event('resize'));
      }, RISS_HINWEIS);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      expect(await layoutFehler(page)).toEqual([]);
      const stufe = await pruefung.getAttribute('data-stufe');
      mkdirSync(SCREENSHOTS, { recursive: true });
      await page.screenshot({ path: resolve(SCREENSHOTS, `nahansicht-${String(g.width)}x${String(g.height)}.jpg`), type: 'jpeg', quality: 70, scale: 'css' });
      test.info().annotations.push({ type: 'stufe', description: stufe ?? '' });
      // Bedienbar: „Anderes Ende“ wechselt, ✕ schliesst
      await pruefung.getByRole('button', { name: 'Anderes Ende' }).tap();
      await expect(pruefung).toContainText('Linkes Ende');
      await pruefung.getByRole('button', { name: 'Schliessen' }).tap();
      await expect(pruefung).toHaveCount(0);
    });
  }
});

test.describe('Ticket 016 – Hinweise in allen Modi (HUD-Testseite)', () => {
  for (const g of [GROESSEN[0], GROESSEN[1], GROESSEN[5]]) {
    if (!g) continue;
    test(`lange Hinweise brechen um, verdecken keine Arbeitsfläche – ${String(g.width)}×${String(g.height)}`, async ({ page }) => {
      test.skip(hochkant(page), 'Querformat (ADR 0004)');
      await page.setViewportSize({ width: g.width, height: g.height });
      await page.goto(`./hud-demo/${g.notch ? '?notch=1' : ''}`);
      await page.waitForFunction(() => document.body.dataset['state'] === 'ready');
      for (const [modus, text] of Object.entries(LANGE_HINWEISE)) {
        const befund = await page.evaluate(
          ([m, t]) => {
            const hud = window.__hudDemo?.hud;
            if (!hud || !m || !t) throw new Error('kein HUD');
            hud.modus(m as Parameters<typeof hud.modus>[0]);
            hud.hinweis(t, 'warnung');
            const h = document.querySelector<HTMLElement>('.hud-hinweis');
            if (!h) throw new Error('kein Hinweis');
            const r = h.getBoundingClientRect();
            const fehler: string[] = [];
            if (h.scrollWidth > h.clientWidth + 1) fehler.push('Überlauf');
            if (r.left < 0 || r.right > window.innerWidth) fehler.push('ausserhalb');
            for (const sel of ['.hud-ansetzen', '.hud-saegespur', '.hud-stuetzen', '.hud-saegeanzeige', '.hud-zurueck', '.hud-schritte', '.hud-auftrag', '.hud-aktionstaste']) {
              const el = document.querySelector(sel);
              if (!el) continue;
              const b = el.getBoundingClientRect();
              if (b.width === 0 || b.height === 0) continue;
              if (b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top) fehler.push(`überdeckt ${sel}`);
            }
            return fehler;
          },
          [modus, text],
        );
        expect(befund, modus).toEqual([]);
      }
    });
  }
});

test.describe('Ticket 016 – Debug-Schalter (5× Geldanzeige)', () => {
  test.setTimeout(120_000);
  test('schaltet das Overlay ein/aus, bleibt in der Sitzung, langsames Tippen löst nicht aus', async ({ page }) => {
    test.skip(hochkant(page), 'Querformat (ADR 0004)');
    await page.goto('./spiel/?dpr=1'); // wie die Home-Bildschirm-App: ohne ?debug=1
    await bereit(page);
    const geld = page.locator('.hud-geld');
    await expect(geld).toBeVisible(LANG);
    await expect(page.locator('#debug-overlay')).toHaveCount(0);
    const b = await geld.boundingBox();
    if (!b) throw new Error('Geldanzeige fehlt');
    const p = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    // Trefferfläche ≥ 44 pt (Pseudo-Element) – Tippen knapp darunter trifft noch die Geldanzeige
    expect(await page.evaluate(([x, y]) => document.elementFromPoint(x ?? 0, y ?? 0)?.className, [p.x, b.y + b.height + 4])).toContain('hud-geld');
    const tippen = (n: number, abstandMs: number): Schritt[] =>
      Array.from({ length: n }, (_, i) => [
        // Schnelle Folge ohne setTimeout: die Software-GPU der CI verzögert Timer um Hunderte ms
        { t: 'down' as const, id: 9, x: p.x, y: p.y, warte: i === 0 ? 0 : abstandMs },
        { t: 'up' as const, id: 9, x: p.x, y: p.y },
      ]).flat();

    // Feedback ≤ 100 ms: Klasse „tipp“ liegt direkt nach dem Aufsetzen an
    const sofort = await page.evaluate((q) => {
      const { x, y } = q;
      const el = document.elementFromPoint(x, y);
      el?.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 8, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
      const an = document.querySelector('.hud-geld')?.classList.contains('tipp') ?? false;
      el?.dispatchEvent(new PointerEvent('pointerup', { pointerId: 8, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
      return an;
    }, p);
    expect(sofort).toBe(true);
    await page.waitForTimeout(600);

    // Gelegentliches Antippen (Pausen > 400 ms) und vier schnelle Tipps lösen nicht aus
    await zeiger(page, tippen(6, 600));
    await page.waitForTimeout(600);
    await zeiger(page, tippen(4, 0));
    await page.waitForTimeout(600);
    await expect(page.locator('#debug-overlay')).toHaveCount(0);

    // Fünf schnelle Tipps: Overlay an, kompakt, ohne Berührungen, unter der HUD-Ebene
    await zeiger(page, tippen(5, 0));
    const overlay = page.locator('#debug-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay.locator('.debug-stats')).toHaveText(/fps ([1-9]\d*|0,[1-9])/, LANG);
    await expect(overlay).toContainText('Speicher:', LANG);
    const stil = await page.evaluate(() => {
      const o = document.querySelector('#debug-overlay');
      const h = document.querySelector('.hud');
      if (!o || !h) return null;
      const r = o.getBoundingClientRect();
      const zurueck = document.querySelector('.hud-zurueck')?.getBoundingClientRect();
      return {
        pe: getComputedStyle(o).pointerEvents,
        z: Number(getComputedStyle(o).zIndex),
        hudZ: Number(getComputedStyle(h).zIndex),
        oben: r.top,
        breite: r.width / window.innerWidth,
        zurueckUnten: zurueck && zurueck.height > 0 ? zurueck.bottom : 0,
      };
    });
    expect(stil?.pe).toBe('none');
    expect(stil?.z).toBeLessThan(stil?.hudZ ?? 0);
    expect(stil?.breite).toBeLessThanOrEqual(0.4);
    expect(stil?.oben).toBeGreaterThan(70); // nicht oben links bei der Zurück-Taste
    await page.screenshot({ path: resolve(SCREENSHOTS, 'debug-overlay.jpg'), type: 'jpeg', quality: 70, scale: 'css' });

    // Sitzung: nach Neuladen weiter an
    await page.reload();
    await bereit(page);
    await expect(page.locator('#debug-overlay')).toBeVisible(LANG);
    await expect(geld).toBeVisible(LANG);
    // Wieder 5× → aus, auch nach Neuladen
    await zeiger(page, tippen(5, 0));
    await expect(page.locator('#debug-overlay')).toBeHidden();
    await page.reload();
    await bereit(page);
    await expect(geld).toBeVisible(LANG);
    await expect(page.locator('#debug-overlay')).toHaveCount(0);
  });
});
