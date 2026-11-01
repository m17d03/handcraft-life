import { expect, test, type Page } from '@playwright/test';
import type {} from '../../src/perf/perf-snapshot';
import type { WerkstattViewDebug } from '../../src/render/view-api';
import type { SpielDebug } from '../../src/spiel/spiel';

declare global {
  interface Window {
    __view?: WerkstattViewDebug;
    __spiel?: SpielDebug;
  }
}

// Ticket 013: Vertical Slice 0.1 – kompletter Ablauf mit Touch, Neuladen mitten im Sägen, Speichern bei
// App-Wechsel, Spielstand-Hinweise. WebKit-tauglich: Tasten per touchscreen.tap, Gesten auf Flächen als
// synthetische Pointer-Events (wie tests/e2e/hud.spec.ts). Keine Zeitgrenzen-abhängigen Taps: Tippen wird
// über den Weg erkannt, Züge über die Richtungsumkehr; gewartet wird nur per Polling auf Zustände.
// Der Spielzustand wird über window.__spiel (nur ?debug=1) gelesen, nie gesetzt.

const SPIEL = './spiel/?debug=1&saat=7';
const LANG = { timeout: 60_000 };

type Schritt = { t: 'down' | 'move' | 'up'; id: number; x: number; y: number } | { t: 'warte'; ms: number };

/** Spielt Zeiger-Schritte ab; Ziel ist das Element unter dem Aufsetzpunkt (wie Pointer Capture). */
async function zeiger(page: Page, schritte: Schritt[]): Promise<void> {
  await page.evaluate(async (s) => {
    const ziele = new Map<number, Element>();
    for (const k of s) {
      if (k.t === 'warte') {
        await new Promise((r) => setTimeout(r, k.ms));
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
  }, schritte);
}

function ziehe(id: number, a: { x: number; y: number }, b: { x: number; y: number }, n = 8): Schritt[] {
  const s: Schritt[] = [{ t: 'down', id, x: a.x, y: a.y }];
  for (let i = 1; i <= n; i++) s.push({ t: 'move', id, x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n });
  s.push({ t: 'up', id, x: b.x, y: b.y });
  return s;
}

/** Tippen auf die Spielfläche (ohne Bewegung → Tippen, unabhängig von der Dauer). */
const tippen = (page: Page, p: { x: number; y: number }): Promise<void> =>
  zeiger(page, [
    { t: 'down', id: 3, x: p.x, y: p.y },
    { t: 'up', id: 3, x: p.x, y: p.y },
  ]);

async function mitte(page: Page, sel: string): Promise<{ x: number; y: number; w: number; h: number; top: number }> {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error(`${sel} nicht sichtbar`);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height, top: b.y };
}

function sammleFehler(page: Page): string[] {
  const p: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') p.push(m.text());
  });
  page.on('pageerror', (e) => p.push(e.message));
  page.on('requestfailed', (r) => p.push(`Ressource fehlgeschlagen: ${r.url()}`));
  return p;
}

/** Wartet auf die spielbare Seite; false ohne WebGL 2. */
async function bereit(page: Page): Promise<boolean> {
  await page.waitForFunction(() => ['ready', 'no-webgl2', 'error'].includes(document.body.dataset['state'] ?? ''), null, LANG);
  const state = await page.evaluate(() => document.body.dataset['state']);
  expect(state).not.toBe('error');
  return state === 'ready';
}

const zustand = (page: Page) => page.evaluate(() => window.__spiel?.zustand() ?? null);
const ui = (page: Page) => page.evaluate(() => window.__spiel?.ui() ?? null);
const phase = (page: Page) => page.evaluate(() => window.__spiel?.zustand().arbeit?.phase ?? null);

const hochkant = (page: Page): boolean => {
  const v = page.viewportSize();
  return !!v && v.height > v.width;
};

/** Wartet, bis kein Stand mehr aufs Schreiben wartet und mindestens einmal gespeichert wurde. */
async function gespeichert(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => {
      const s = window.__spiel?.speicher();
      return s ? !s.ausstehend && s.zuletztGespeichert !== null : false;
    }), LANG)
    .toBe(true);
  // Schreibkette abwarten (sofortSpeichern ohne neuen Stand liefert die laufende Kette)
  await page.evaluate(() => new Promise((r) => setTimeout(r, 50)));
}

async function zurWerkbank(page: Page): Promise<void> {
  const taste = page.locator('.hud-aktionstaste');
  await expect(taste).toBeVisible(LANG);
  await taste.tap();
  await expect.poll(async () => (await ui(page))?.anDerBank, LANG).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__view?.zustand().fahrt), LANG).toBe(false);
}

/** Sägt `anzahl` Züge auf der Führungsspur, links „Abfall stützen“ gehalten. */
async function saegen(page: Page, anzahl: number): Promise<void> {
  const spur = await mitte(page, '.hud-saegespur');
  const stuetzen = await mitte(page, '.hud-stuetzen');
  const oben = spur.top + 30;
  const unten = spur.top + spur.h - 30;
  const s: Schritt[] = [
    { t: 'down', id: 5, x: stuetzen.x, y: stuetzen.y },
    { t: 'down', id: 6, x: spur.x, y: oben },
  ];
  for (let haelfte = 0; haelfte < anzahl * 2; haelfte++) {
    const [von, nach] = haelfte % 2 === 0 ? [oben, unten] : [unten, oben];
    for (let i = 1; i <= 6; i++) s.push({ t: 'move', id: 6, x: spur.x + 4, y: von + ((nach - von) * i) / 6 }, { t: 'warte', ms: 25 });
  }
  s.push({ t: 'up', id: 6, x: spur.x + 4, y: oben }, { t: 'up', id: 5, x: stuetzen.x, y: stuetzen.y });
  await zeiger(page, s);
}

test.describe('Vertical Slice 0.1 (/spiel/)', () => {
  test.setTimeout(420_000);

  test('kompletter Ablauf mit Touch: Auftrag → Messen → Anreissen → Ansetzen → Sägen (Neuladen mittendrin) → Ergebnis → Abliefern', async ({ page }) => {
    test.skip(hochkant(page), 'Querformat-Ablauf (ADR 0004); Hochformat zeigt nur den Hinweis');
    const fehler = sammleFehler(page);
    await page.goto(SPIEL);
    if (!(await bereit(page))) {
      test.skip(true, 'Browser ohne WebGL 2');
      return;
    }
    // Assets aus Ticket 012 sind eingebaut (keine Platzhalter)
    expect(await page.evaluate(() => window.__view?.zustand().assets)).toBe('modelle');
    const start = await zustand(page);
    expect(start?.inventar.geld).toBe(40);
    expect(start?.tutorial).toBe(0);
    await expect(page.locator('.hud-geld')).toHaveText('40 G');
    await expect(page.locator('.hud-auftrag')).toContainText('600 mm');
    // Geführt: Hinweis zum ersten Schritt
    await expect(page.locator('.hud-hinweis')).toContainText('Werkbank');

    // 1) An die Werkbank: Auftrag wird angenommen, Brett gekauft (Autosave nach Kauf), Zuschnitt beginnt
    await zurWerkbank(page);
    let z = await zustand(page);
    expect(z?.arbeit?.phase).toBe('bezugsende');
    expect(z?.inventar.geld).toBe(28);
    expect(z?.auftraege[0]?.status).toBe('angenommen');
    await expect(page.locator('.hud')).toHaveAttribute('data-modus', 'werkbank-messen');
    await expect(page.locator('.hud-hinweis')).toContainText('Schritt 1/6');
    await gespeichert(page);

    // 2) Bezugsende: Ende ohne Riss antippen
    const ws = z?.inventar.werkstuecke.find((w) => w.id === z?.arbeit?.werkstueckId);
    expect(ws).toBeDefined();
    const L = ws?.masse_mm.l ?? 2000;
    const rissA = (ws?.enden.a.merkmale ?? []).some((m) => m.id === 'holz.merkmal.endriss');
    const ende = rissA ? 'b' : 'a';
    const tipp = await page.evaluate((mm) => window.__view?.weltNachBildschirm(mm) ?? null, ende === 'a' ? 40 : L - 40);
    expect(tipp).not.toBeNull();
    if (!tipp) return;
    await tippen(page, tipp);
    await expect.poll(() => phase(page), LANG).toBe('messen');
    expect((await zustand(page))?.arbeit?.bezugsende).toBe(ende);
    await expect(page.locator('.hud-hinweis')).toContainText('Schritt 2/6');

    // 3) Messen: Griff ziehen (Richtung folgt dem Bezugsende), dann mit ±0,5 genau auf 600 mm
    const soll = 600;
    const griff = await mitte(page, '.hud-massband-griff');
    const pxProMm = await page.evaluate(() => {
      const v = window.__view;
      const a = v?.weltNachBildschirm(0);
      const b = v?.weltNachBildschirm(100);
      return a && b ? (b.x - a.x) / 100 : 0;
    });
    expect(Math.abs(pxProMm)).toBeGreaterThan(0.1);
    await zeiger(page, ziehe(1, griff, { x: griff.x + soll * pxProMm, y: griff.y }, 12));
    let mass = (await ui(page))?.massMm ?? 0;
    expect(Math.abs(mass - soll)).toBeLessThan(15);
    for (let i = 0; i < 80 && mass !== soll; i++) {
      await page.locator(mass < soll ? '.hud-fein[data-fein="0.5"]' : '.hud-fein[data-fein="-0.5"]').tap();
      mass = (await ui(page))?.massMm ?? 0;
    }
    expect(mass).toBe(soll);
    await expect(page.locator('.hud-messwert')).toHaveText('600,0 mm');
    await expect(page.locator('.hud-hinweis')).toContainText('Anreissen');
    // Massband ist im Bild ausgezogen
    expect(await page.evaluate(() => window.__view?.pick(window.innerWidth / 2, 5))).not.toBe('massband');

    // 4) Anreissen (Autosave)
    await page.locator('.hud-anreissen').tap();
    await expect.poll(() => phase(page), LANG).toBe('ansetzen');
    z = await zustand(page);
    expect(z?.arbeit?.markierung_mm).toBe(soll);
    await expect(page.locator('.hud')).toHaveAttribute('data-modus', 'werkbank-ansetzen');
    await expect(page.locator('.hud-hinweis')).toContainText('Schritt 4/6');
    await gespeichert(page);

    // 5) Ansetzen: Blatt +0,8 mm auf die Abfallseite (20 px/mm)
    const blatt = await mitte(page, '.hud-ansetzen');
    await zeiger(page, ziehe(2, blatt, { x: blatt.x + 16, y: blatt.y }, 4));
    await expect.poll(async () => (await zustand(page))?.arbeit?.blattversatz_mm, LANG).toBeCloseTo(0.8, 5);
    await page.getByRole('button', { name: 'Sägen ›' }).tap();
    await expect(page.locator('.hud')).toHaveAttribute('data-modus', 'werkbank-saegen');

    // 6) Sägen: 3 Züge, dann Neuladen mitten im Sägen (S2/S3)
    await saegen(page, 3);
    await expect.poll(() => phase(page), LANG).toBe('saegen');
    z = await zustand(page);
    expect(z?.arbeit?.zuege.length).toBe(3);
    await gespeichert(page);
    const vorReload = await zustand(page);
    await page.reload();
    expect(await bereit(page)).toBe(true);
    const nach = await zustand(page);
    // Schritt sauber zurückgesetzt: wieder beim Ansetzen, keine Züge; Markierung, Geld, Lager erhalten
    expect(nach?.arbeit?.phase).toBe('ansetzen');
    expect(nach?.arbeit?.zuege).toEqual([]);
    expect(nach?.arbeit?.drift_grad).toBe(0);
    expect(nach?.arbeit?.markierung_mm).toBe(soll);
    expect(nach?.arbeit?.bezugsende).toBe(ende);
    expect(nach?.inventar).toEqual(vorReload?.inventar);
    expect(nach?.auftraege).toEqual(vorReload?.auftraege);
    expect((await ui(page))?.anDerBank).toBe(false);
    await expect(page.locator('.hud-hinweis')).toContainText('wartet an der Werkbank');

    // Zurück an die Bank: Ansetzen-Ansicht, dann vollständig sägen
    await zurWerkbank(page);
    await expect(page.locator('.hud')).toHaveAttribute('data-modus', 'werkbank-ansetzen');
    await page.getByRole('button', { name: 'Sägen ›' }).tap();
    await expect(page.locator('.hud')).toHaveAttribute('data-modus', 'werkbank-saegen');
    await saegen(page, 8);
    await expect.poll(() => phase(page), LANG).toBe('ergebnis');
    await gespeichert(page);

    // 7) Ergebniskarte = Ergebnis aus src/core
    z = await zustand(page);
    const e = z?.arbeit?.ergebnis;
    expect(e).toBeTruthy();
    if (!e) return;
    const karte = page.getByRole('dialog', { name: 'Ergebnis' });
    await expect(karte).toBeVisible();
    const stufen: Record<string, string> = { A: 'A – Meisterhaft', B: 'B – Sauber', C: 'C – Brauchbar', D: 'D – Mangelhaft', ausschuss: 'Ausschuss' };
    await expect(karte.locator('.hud-stufe')).toHaveText(stufen[e.qualitaet.stufe] ?? '?');
    await expect(karte.locator('.hud-q')).toHaveText(`Qualität ${String(Math.round(e.qualitaet.q))} / 100`);
    const ursache = await page.evaluate(([id, w]) => window.__spiel?.text(id, w) ?? '', [e.qualitaet.hauptursache, e.qualitaet.hauptursacheWert] as const);
    await expect(karte.locator('.hud-ursache')).toContainText(ursache);
    // Karte zeigt die Ist-Länge auf 0,1 mm gerundet
    const ist = (Math.round(e.laenge_ist_mm * 10) / 10).toFixed(1).replace('.', ',').replace(/,0$/, '');
    await expect(karte.locator('.hud-ursache')).toContainText(`Ist ${ist} mm (Soll 600)`);
    const teil = z?.inventar.werkstuecke.find((w) => w.id === e.teilId);
    expect(teil?.masse_mm.l).toBe(e.laenge_ist_mm);
    expect(await page.evaluate(() => window.__view?.zustand().brett.schnittIstMm)).toBeCloseTo(e.laenge_ist_mm, 3);

    if (e.qualitaet.stufe === 'ausschuss') {
      // Ausschuss: Abliefern gesperrt, „Neues Brett“ beginnt einen neuen Zuschnitt
      await expect(karte.locator('.hud-abliefern')).toBeDisabled();
      await karte.getByRole('button', { name: 'Neues Brett' }).tap();
      await expect.poll(() => phase(page), LANG).toBe('bezugsende');
    } else {
      await expect(karte.locator('.hud-preis')).toHaveText(`Preis ${String(e.preis)} G`);
      // 8) Abliefern (Autosave): Geld = vorher + Preis, nächster Auftrag, geführter Zähler +1
      const geldVorher = z?.inventar.geld ?? 0;
      await karte.locator('.hud-abliefern').tap();
      await expect.poll(async () => (await zustand(page))?.tutorial, LANG).toBe(1);
      z = await zustand(page);
      expect(z?.inventar.geld).toBe(geldVorher + e.preis);
      expect(z?.arbeit).toBeNull();
      expect(z?.auftraege[0]?.status).toBe('abgeliefert');
      expect(z?.auftraege.some((a) => a.status === 'angeboten')).toBe(true);
      expect(z?.inventar.werkstuecke.some((w) => w.id === e.teilId)).toBe(false);
      await expect(page.locator('.hud-geld')).toHaveText(`${String(geldVorher + e.preis)} G`);
      await expect(page.locator('.hud')).toHaveAttribute('data-modus', 'erkunden');
      await gespeichert(page);
      // Neuladen: alles erhalten (S2)
      const vorher = await zustand(page);
      await page.reload();
      expect(await bereit(page)).toBe(true);
      expect(await zustand(page)).toEqual(vorher);
    }
    expect(fehler).toEqual([]);
  });

  test('App-Wechsel: visibilitychange „hidden“ speichert sofort (S4)', async ({ page }) => {
    test.skip(hochkant(page), 'Querformat-Ablauf');
    await page.goto(SPIEL);
    if (!(await bereit(page))) {
      test.skip(true, 'Browser ohne WebGL 2');
      return;
    }
    await zurWerkbank(page);
    await gespeichert(page);
    // Massband-Tipp ändert keinen gespeicherten Zustand → Bezugsende wählen (entprelltes Autosave wartet ≤ 1 s)
    const p = await page.evaluate(() => window.__view?.weltNachBildschirm(40) ?? null);
    if (!p) throw new Error('Brett nicht im Bild');
    const ergebnis = await page.evaluate(async (pt) => {
      const flaeche = document.elementFromPoint(pt.x, pt.y) ?? document.body;
      for (const t of ['pointerdown', 'pointerup']) {
        flaeche.dispatchEvent(new PointerEvent(t, { pointerId: 4, pointerType: 'touch', clientX: pt.x, clientY: pt.y, bubbles: true, cancelable: true }));
      }
      const wartetVorher = window.__spiel?.speicher().ausstehend ?? false;
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      // synchron nach dem Ereignis: der wartende Stand ist bereits unterwegs (nicht erst nach 1 s)
      const wartetNachher = window.__spiel?.speicher().ausstehend ?? true;
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      await new Promise((r) => setTimeout(r, 300));
      return { wartetVorher, wartetNachher, phase: window.__spiel?.zustand().arbeit?.phase };
    }, p);
    expect(ergebnis).toEqual({ wartetVorher: true, wartetNachher: false, phase: 'messen' });
    await page.reload();
    expect(await bereit(page)).toBe(true);
    expect((await zustand(page))?.arbeit?.phase).toBe('messen');
  });

  test('beschädigter Spielstand: klarer Hinweis, Spiel startet neu, „Neu beginnen“ hebt die Sperre auf (S7/S8)', async ({ page }) => {
    test.skip(hochkant(page), 'Querformat-Ablauf');
    const fehler = sammleFehler(page);
    await page.goto('./');
    await page.evaluate(
      () =>
        new Promise<void>((ok, nein) => {
          const r = indexedDB.open('handcraft-life', 1);
          r.onupgradeneeded = () => {
            r.result.createObjectStore('spielstand');
            r.result.createObjectStore('sicherung');
          };
          r.onerror = () => { nein(new Error('IndexedDB')); };
          r.onsuccess = () => {
            const tx = r.result.transaction('spielstand', 'readwrite');
            tx.objectStore('spielstand').put('{"kaputt":', 'aktuell');
            tx.oncomplete = () => {
              r.result.close();
              ok();
            };
          };
        }),
    );
    await page.goto(SPIEL);
    if (!(await bereit(page))) {
      test.skip(true, 'Browser ohne WebGL 2');
      return;
    }
    const banner = page.locator('.spiel-speicherhinweis');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('beschädigt');
    expect((await page.evaluate(() => window.__spiel?.speicher().modus))).toBe('gesperrt');
    expect((await zustand(page))?.inventar.geld).toBe(40);
    await banner.getByRole('button', { name: 'Neu beginnen' }).tap();
    await expect(banner).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.__spiel?.speicher().modus), LANG).toBe('normal');
    await gespeichert(page);
    expect(fehler).toEqual([]);
  });

  test('Hochformat: Hinweis „Bitte quer halten“', async ({ page }) => {
    test.skip(!hochkant(page), 'nur Hochformat');
    await page.goto(SPIEL);
    await bereit(page);
    await expect(page.getByRole('heading', { name: 'Bitte quer halten' })).toBeVisible();
  });
});
