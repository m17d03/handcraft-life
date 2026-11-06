/**
 * Budget-Prüfung Vertical Slice /spiel/ (Ticket 015, Skill perf-budget-check, QUALITY_STANDARDS P3–P7, P10).
 *
 * Standardrunde (ein Durchlauf, frischer Spielstand, Saat 7):
 *   1. Erkunden: laden bis spielbar, 1 s stehen, einmal rundum umsehen (rechte Bildhälfte ziehen) und zurück.
 *   2. Werkbank: an die Bank, Bezugsende wählen, messen, anreissen, „Sägen ›“, 4 Sägezüge (Sägen-Zustand).
 * Gemessen wird über `window.__perf()` (PerfSnapshot v1) nach jedem Frame in der Seite (`budgetSammler`);
 * Draw Calls und Dreiecke = Maximum je Ansicht. Bei 0 Draw Calls/Dreiecken: MESSFEHLER statt „eingehalten“.
 *
 * Harte Grenzen = Testfehler (P4 Draw Calls ≤ 120, P5 Dreiecke ≤ 300 000, P6 Texturspeicher ≤ 200 MB,
 * P7 Download bis spielbar ≤ 25 MB). Ziele (80 / 150 000 / 120 MB / 15 MB) nur als Warnung im Bericht.
 * Frame-Zeit und Ladezeit nur als Bericht (Emulation mit Software-GPU, kein iPhone).
 *
 * Texturspeicher: Die Emulation hat kein ASTC → KTX2 wird unkomprimiert (RGBA8, 4 B/px) hochgeladen.
 * P6 verlangt die Rechnung im iPhone-Zielformat. Daher: iPhone-Schätzung = Emulationswert
 * − KTX2-Texturen in RGBA8 + dieselben Texturen in ASTC 4×4 (1 B/px), Mipmaps je × 4/3.
 * Die KTX2-Grössen stammen aus den Kopfdaten der geladenen .ktx2-Dateien und der in GLB eingebetteten KTX2-Bilder.
 * Die harte Grenze gilt für die iPhone-Schätzung; der Emulationswert (obere Schranke) ist nur Bericht/Warnung.
 *
 * Download: alle Antworten bis „spielbar“, Textdateien (JS/CSS/HTML/JSON/SVG/WASM) gzip-komprimiert gezählt
 * (wie GitHub Pages ausliefert), Binärdateien (GLB/KTX2/PNG) roh. `vite preview` komprimiert selbst nicht,
 * deshalb ist `__perf().transferredKB` hier ungzipped und steht nur als Gegenprobe im Bericht.
 *
 * Bericht: test-results/perf-budget/budget.md (+ budget.json); CI hängt ihn an die Zusammenfassung.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';
import type { PerfSnapshot } from '../../src/perf/perf-snapshot';
import type { WerkstattViewDebug } from '../../src/render/view-api';
import type { SpielDebug } from '../../src/spiel/spiel';

declare global {
  interface Window {
    __view?: WerkstattViewDebug;
    __spiel?: SpielDebug;
    /** Sammler der Budget-Prüfung (Init-Skript `budgetSammler`). */
    __budget?: { ansicht: string; proben: number; dc: number; tri: number; texMB: number; compressedTexImage2D: number };
  }
}

const SPIEL = './spiel/?debug=1&saat=7&test=1&dpr=1';
const LANG = { timeout: 60_000 };
const MB = 1024 * 1024;
const BERICHT = join(import.meta.dirname, '../../test-results/perf-budget');

/** QUALITY_STANDARDS „Budgets“: Ziel (strikt kleiner) und harte Grenze (kleiner gleich). */
export const BUDGET = {
  drawCalls: { ziel: 80, grenze: 120 },
  dreiecke: { ziel: 150_000, grenze: 300_000 },
  texturMB: { ziel: 120, grenze: 200 },
  downloadMB: { ziel: 15, grenze: 25 },
} as const;

// ------------------------------------------------------------------ Eingabe (wie tests/e2e/vertical-slice.spec.ts)

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

const zustand = (page: Page) => page.evaluate(() => window.__spiel?.zustand() ?? null);
const ui = (page: Page) => page.evaluate(() => window.__spiel?.ui() ?? null);
const phase = (page: Page) => page.evaluate(() => window.__spiel?.zustand().arbeit?.phase ?? null);

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

// ------------------------------------------------------------------ Messung

interface Ansicht {
  name: string;
  erreicht: boolean;
  proben: number;
  drawCallsMax: number;
  dreieckeMax: number;
  fps: number;
  frameAvg: number;
  frameP95: number;
  frameMax: number;
  hinweis: string;
  t0: number;
  dauerMs: number;
}

const neueAnsicht = (name: string): Ansicht => ({
  name,
  erreicht: false,
  proben: 0,
  drawCallsMax: 0,
  dreieckeMax: 0,
  fps: 0,
  frameAvg: 0,
  frameP95: 0,
  frameMax: 0,
  hinweis: '',
  t0: 0,
  dauerMs: 0,
});

/** Höchster Texturspeicher (Emulation) und letzter Snapshot über die ganze Runde. */
const gesamt: { texturMBEmulation: number; letzter: PerfSnapshot | null } = { texturMBEmulation: 0, letzter: null };

/**
 * Init-Skript (läuft in der Seite): liest nach jedem Frame `__perf()` und hält das Maximum der laufenden Ansicht.
 * Die Software-GPU blockiert den Seiten-Thread (Frames bis > 1 s) – jede Playwright-Rundreise kostet Sekunden,
 * daher wird in der Seite gesammelt und nur am Ende einer Ansicht gelesen. Zählt ausserdem
 * `compressedTexImage2D`-Aufrufe (echte komprimierte Bytes → ASTC-Korrektur unten wäre falsch).
 */
function budgetSammler(): void {
  const b = { ansicht: '', proben: 0, dc: 0, tri: 0, texMB: 0, compressedTexImage2D: 0 };
  window.__budget = b;
  const tick = (): void => {
    const s = b.ansicht ? window.__perf?.() : undefined;
    if (s && s.frames > 0) {
      b.proben++;
      b.dc = Math.max(b.dc, s.drawCalls);
      b.tri = Math.max(b.tri, s.triangles);
      b.texMB = Math.max(b.texMB, s.textureMemoryMB);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  for (const proto of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype] as object[]) {
    const desc = Object.getOwnPropertyDescriptor(proto, 'compressedTexImage2D');
    const orig: unknown = desc?.value;
    if (typeof orig !== 'function') continue;
    const fn = orig as (...a: unknown[]) => unknown;
    Object.defineProperty(proto, 'compressedTexImage2D', {
      ...desc,
      value: function (this: unknown, ...a: unknown[]): unknown {
        b.compressedTexImage2D++;
        return fn.apply(this, a);
      },
    });
  }
}

async function beginne(page: Page, a: Ansicht): Promise<void> {
  a.erreicht = true;
  a.t0 = Date.now();
  await page.evaluate((name) => {
    window.__perfReset?.();
    const b = window.__budget;
    if (!b) return;
    b.ansicht = name;
    b.proben = 0;
    b.dc = 0;
    b.tri = 0;
  }, a.name);
}

async function beende(page: Page, a: Ansicht): Promise<void> {
  const r = await page.evaluate(() => {
    const b = window.__budget;
    const s = window.__perf?.() ?? null;
    const kopie = b ? { ...b } : null;
    if (b) b.ansicht = '';
    return { b: kopie, s };
  });
  a.dauerMs = Date.now() - a.t0;
  if (r.b) {
    a.proben = r.b.proben;
    a.drawCallsMax = r.b.dc;
    a.dreieckeMax = r.b.tri;
    gesamt.texturMBEmulation = Math.max(gesamt.texturMBEmulation, r.b.texMB);
  }
  if (r.s) {
    a.fps = r.s.fps;
    a.frameAvg = r.s.frameTimeMsAvg;
    a.frameP95 = r.s.frameTimeMsP95;
    a.frameMax = r.s.frameTimeMsMax;
    gesamt.texturMBEmulation = Math.max(gesamt.texturMBEmulation, r.s.textureMemoryMB);
    gesamt.letzter = r.s;
  }
}

/**
 * Rundum umsehen (rechte Bildhälfte, Wische à 180 px) bis ≥ 360° Gierwinkel, dann genauso viele Wische zurück –
 * der Blick steht danach wieder auf der Werkbank. Alles in einer Rundreise; liefert die Drehung in Grad.
 */
async function rundumUmsehen(page: Page): Promise<number> {
  const v = page.viewportSize() ?? { width: 852, height: 393 };
  return page.evaluate(async ({ w, h }) => {
    const frame = (): Promise<void> => new Promise((r) => { requestAnimationFrame(() => { r(); }); });
    const yaw = (): number => window.__view?.zustand().kamera.yaw ?? 0;
    const y = h * 0.45;
    const x0 = w * 0.58;
    let ziel: Element = document.body;
    const sende = (t: 'down' | 'move' | 'up', x: number): void => {
      if (t === 'down') ziel = document.elementFromPoint(x, y) ?? document.body;
      ziel.dispatchEvent(new PointerEvent(`pointer${t}`, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true }));
    };
    const wisch = async (richtung: 1 | -1): Promise<void> => {
      const start = richtung === 1 ? x0 : x0 + 180;
      sende('down', start);
      for (let i = 1; i <= 3; i++) {
        sende('move', start + richtung * 60 * i);
        await frame();
      }
      sende('up', start + richtung * 180);
      await frame();
    };
    let gedreht = 0;
    let vorher = yaw();
    let n = 0;
    while (gedreht < 2 * Math.PI && n < 24) {
      await wisch(1);
      const jetzt = yaw();
      gedreht += Math.abs(Math.atan2(Math.sin(jetzt - vorher), Math.cos(jetzt - vorher)));
      vorher = jetzt;
      n++;
      if (n === 2 && gedreht < 1e-3) break; // Umsehen wirkt nicht – nicht endlos wischen
    }
    for (let i = 0; i < n; i++) await wisch(-1);
    return (gedreht * 180) / Math.PI;
  }, { w: v.width, h: v.height });
}

// ------------------------------------------------------------------ Download und Texturen (aus den Antworten)

interface Datei { pfad: string; bytes: number; gezaehlt: number; gzip: boolean; vorSpielbar: boolean }

/** Kopfdaten einer KTX2-Datei ab `off`: Pixel (alle Schichten/Seiten der Basisstufe) und Mip-Stufen. */
function ktx2Kopf(b: Buffer, off = 0): { w: number; h: number; px: number; stufen: number } | null {
  const id = [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < off + 44 || id.some((v, i) => b[off + i] !== v)) return null;
  const w = b.readUInt32LE(off + 20);
  const h = Math.max(1, b.readUInt32LE(off + 24));
  const schichten = Math.max(1, b.readUInt32LE(off + 32));
  const seiten = Math.max(1, b.readUInt32LE(off + 36));
  return { w, h, px: w * h * schichten * seiten, stufen: b.readUInt32LE(off + 40) };
}

/** KTX2-Bilder in einer GLB (KHR_texture_basisu, Bild als bufferView im BIN-Chunk). */
function glbKtx2(b: Buffer): NonNullable<ReturnType<typeof ktx2Kopf>>[] {
  if (b.length < 20 || b.readUInt32LE(0) !== 0x46546c67) return [];
  const jsonLaenge = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jsonLaenge).toString('utf8')) as {
    images?: { mimeType?: string; bufferView?: number }[];
    bufferViews?: { byteOffset?: number }[];
  };
  const binStart = 20 + jsonLaenge + 8;
  const out: NonNullable<ReturnType<typeof ktx2Kopf>>[] = [];
  for (const bild of json.images ?? []) {
    if (bild.mimeType !== 'image/ktx2' || bild.bufferView === undefined) continue;
    const k = ktx2Kopf(b, binStart + (json.bufferViews?.[bild.bufferView]?.byteOffset ?? 0));
    if (k) out.push(k);
  }
  return out;
}

// ------------------------------------------------------------------ Standardrunde

async function zurWerkbank(page: Page): Promise<void> {
  const taste = page.locator('.hud-aktionstaste');
  await expect(taste).toBeVisible(LANG);
  await taste.tap();
  await expect.poll(async () => (await ui(page))?.anDerBank, LANG).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__view?.zustand().fahrt), LANG).toBe(false);
}

/** Bezugsende wählen (das rechtwinklige), 600 mm messen, anreissen, „Sägen ›“ – wie der E2E-Ablauf. */
async function bisZumSaegen(page: Page): Promise<void> {
  const z = await zustand(page);
  const ws = z?.inventar.werkstuecke.find((w) => w.id === z.arbeit?.werkstueckId);
  if (!ws) throw new Error('Kein Werkstück an der Werkbank');
  const L = ws.masse_mm.l;
  const ende = Math.abs(ws.enden.a.winkel_grad) <= Math.abs(ws.enden.b.winkel_grad) ? 'a' : 'b';
  const tipp = await page.evaluate((mm) => window.__view?.weltNachBildschirm(mm) ?? null, ende === 'a' ? L - 40 : 40);
  if (!tipp) throw new Error('Brettende nicht im Bild');
  await tippen(page, tipp);
  const pruefung = page.getByRole('dialog', { name: 'Brettende prüfen' });
  await expect(pruefung).toBeVisible(LANG);
  await pruefung.getByRole('button', { name: 'Anderes Ende' }).tap();
  await pruefung.getByRole('button', { name: 'Von hier messen' }).tap();
  await expect.poll(() => phase(page), LANG).toBe('messen');

  const soll = 600;
  const griff = await mitte(page, '.hud-massband-griff');
  const pxProMm = await page.evaluate(() => {
    const a = window.__view?.weltNachBildschirm(0);
    const b = window.__view?.weltNachBildschirm(100);
    return a && b ? (b.x - a.x) / 100 : 0;
  });
  await zeiger(page, ziehe(1, griff, { x: griff.x + soll * pxProMm, y: griff.y }, 12));
  // Genau 600 mm ist für die Messung unnötig (kostet in WebKit ohne GPU Minuten) – angerissen wird, wo der Griff steht.
  await page.locator('.hud-anreissen').tap();
  await expect.poll(() => phase(page), LANG).toBe('ansetzen');
  await page.getByRole('button', { name: 'Sägen ›' }).tap();
  await expect(page.locator('.hud')).toHaveAttribute('data-modus', 'werkbank-saegen', LANG);
}

// ------------------------------------------------------------------ Bericht

/** Zahl im Format der Projektberichte: Tausender mit Leerzeichen, Dezimalkomma. */
const f = (n: number, d = 0): string => {
  const [ganz = '', teil] = n.toFixed(d).split('.');
  return `${ganz.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}${teil ? `,${teil}` : ''}`;
};

type Status = 'ok' | 'warnung' | 'grenze' | 'messfehler';
const STATUS_TEXT: Record<Status, string> = {
  ok: '✓ eingehalten',
  warnung: '⚠ Ziel überschritten (Warnung)',
  grenze: '✗ harte Grenze überschritten',
  messfehler: '✗ MESSFEHLER',
};

const bewerte = (wert: number, b: { ziel: number; grenze: number }): Status => (wert > b.grenze ? 'grenze' : wert >= b.ziel ? 'warnung' : 'ok');

test('Budget Vertical Slice /spiel/ (Erkunden, Werkbank Sägen)', async ({ page, browserName, baseURL }) => {
  const start = Date.now();
  const erkunden = neueAnsicht('Erkunden (stehen + rundum umsehen)');
  const saegenA = neueAnsicht('Werkbank, Sägen');
  const ansichten = [erkunden, saegenA];

  // Antworten mitschneiden: Download bis spielbar und KTX2-Kopfdaten (auch in GLB eingebettet)
  let spielbar = false;
  const dateien: Promise<Datei | null>[] = [];
  const ktx2: { pfad: string; px: number; stufen: number }[] = [];
  const herkunft = new URL(baseURL ?? 'http://localhost:4173').host;
  const ktxGesehen = new Set<string>();
  page.on('response', (r) => {
    const url = new URL(r.url());
    if (url.host !== herkunft) return;
    const vorSpielbar = !spielbar;
    const typ = r.headers()['content-type'] ?? '';
    dateien.push(
      r.body().then(
        (b): Datei => {
          const gzip = /text|javascript|json|svg|wasm|xml|manifest/.test(typ) || /\.(js|mjs|css|html|json|svg|wasm|webmanifest)$/.test(url.pathname);
          const neu = !ktxGesehen.has(url.pathname);
          ktxGesehen.add(url.pathname);
          for (const k of !neu ? [] : url.pathname.endsWith('.ktx2') ? [ktx2Kopf(b)] : url.pathname.endsWith('.glb') ? glbKtx2(b) : []) {
            if (k) ktx2.push({ pfad: url.pathname, px: k.px, stufen: k.stufen });
          }
          return { pfad: url.pathname, bytes: b.length, gezaehlt: gzip ? gzipSync(b, { level: 9 }).length : b.length, gzip, vorSpielbar };
        },
        () => null,
      ),
    );
  });
  const seitenFehler: string[] = [];
  page.on('pageerror', (e) => seitenFehler.push(e.message));
  await page.addInitScript(budgetSammler);

  let abbruch: string | null = null;
  let assets = '?';
  let compressedUploads = 0;
  let komprimierteFormate: string[] = [];
  try {
    await page.goto(SPIEL);
    await page.waitForFunction(() => ['ready', 'no-webgl2', 'error'].includes(document.body.dataset['state'] ?? ''), null, LANG);
    spielbar = true;
    const state = await page.evaluate(() => document.body.dataset['state']);
    if (state !== 'ready') throw new Error(`Seite nicht spielbar: data-state=${String(state)}`);
    assets = (await page.evaluate(() => window.__view?.zustand().assets)) ?? '?';
    komprimierteFormate = await page.evaluate(() =>
      (document.createElement('canvas').getContext('webgl2')?.getSupportedExtensions() ?? []).filter((e) => e.includes('compressed_texture')),
    );

    // 1) Erkunden: stehen, dann einmal rundum umsehen und genauso weit zurück (Blick wieder auf die Werkbank)
    await beginne(page, erkunden);
    await page.waitForTimeout(1000);
    const grad = await rundumUmsehen(page);
    await beende(page, erkunden);
    erkunden.hinweis = grad > 0.1 ? `umgesehen ${f(grad)}° und zurück` : 'Umsehen ohne Wirkung';

    // 2) Werkbank bis zum Sägen, dann sägen (Messung während der Züge)
    const wegStart = Date.now();
    await zurWerkbank(page);
    await bisZumSaegen(page);
    saegenA.hinweis = `Weg bis „Sägen“ ${f((Date.now() - wegStart) / 1000)} s`;
    await beginne(page, saegenA);
    // 4 Züge (2 × 2). Ein ganzer Schnitt bis zur Ergebniskarte dauert mit Software-GPU (Frames 0,5–1,3 s) Minuten
    // und sprengt das 5-min-Ziel des CI-Schritts; die Ergebnis-Ansicht hat zudem weniger Dreiecke (gemessen 8 460).
    await saegen(page, 2);
    await saegen(page, 2);
    await beende(page, saegenA);
    saegenA.hinweis += `, ${String((await zustand(page))?.arbeit?.zuege.length ?? 0)} Züge`;
    compressedUploads = (await page.evaluate(() => window.__budget?.compressedTexImage2D)) ?? 0;
  } catch (e) {
    abbruch = e instanceof Error ? e.message.split('\n')[0] ?? e.message : String(e);
  }

  // ---------------------------------------------------------------- Auswertung
  const alle = (await Promise.all(dateien)).filter((d): d is Datei => d !== null);
  const eindeutig = new Map<string, Datei>();
  for (const d of alle) if (d.vorSpielbar && !eindeutig.has(d.pfad)) eindeutig.set(d.pfad, d);
  const download = [...eindeutig.values()];
  const downloadMB = download.reduce((s, d) => s + d.gezaehlt, 0) / MB;
  const downloadRohMB = download.reduce((s, d) => s + d.bytes, 0) / MB;


  // Texturspeicher: KTX2 in der Emulation als RGBA8 (4 B/px), auf dem iPhone ASTC 4×4 (1 B/px); Mipmaps × 4/3
  const mip = (stufen: number): number => (stufen === 1 ? 1 : 4 / 3);
  const ktxRgbaMB = ktx2.reduce((s, k) => s + k.px * 4 * mip(k.stufen), 0) / MB;
  const ktxAstcMB = ktx2.reduce((s, k) => s + k.px * mip(k.stufen), 0) / MB;
  const texEmu = gesamt.texturMBEmulation;
  let texIphone = texEmu - ktxRgbaMB + ktxAstcMB;
  let texHinweis = `${String(ktx2.length)} KTX2-Bilder: RGBA8 ${f(ktxRgbaMB, 1)} MB → ASTC ${f(ktxAstcMB, 1)} MB; übrige (Schatten, Ziele, Rückfall) ${f(texEmu - ktxRgbaMB, 1)} MB`;
  if (compressedUploads > 0 || ktxRgbaMB > texEmu) {
    // Emulation hat bereits komprimiert hochgeladen (oder Korrektur unplausibel) → Emulationswert verwenden
    texIphone = texEmu;
    texHinweis = `keine Korrektur (compressedTexImage2D: ${String(compressedUploads)}, KTX2 RGBA8 ${f(ktxRgbaMB, 1)} MB) – Emulationswert`;
  }

  // Messfehler: ohne gezeichnete Frames ist „Budget eingehalten“ wertlos (Ticket 018: WebKit ohne GPU meldet 0)
  const messfehler: string[] = [];
  if (abbruch) messfehler.push(`Runde abgebrochen: ${abbruch}`);
  if (assets !== 'modelle' && !abbruch) messfehler.push(`Assets = '${assets}' (Platzhalter statt Modelle aus Ticket 012)`);
  for (const a of ansichten) {
    if (!a.erreicht) continue;
    if (a.proben === 0) messfehler.push(`${a.name}: kein gezeichneter Frame gemeldet (__perf() fehlt oder frames = 0 – vgl. Ticket 018)`);
    else if (a.drawCallsMax === 0 || a.dreieckeMax === 0)
      messfehler.push(`${a.name}: __perf() meldet ${String(a.drawCallsMax)} Draw Calls / ${String(a.dreieckeMax)} Dreiecke – Szene nicht gezeichnet oder GL-Zählhülle greift nicht (vgl. Ticket 018)`);
  }
  if (!erkunden.erreicht || !saegenA.erreicht) messfehler.push('Pflicht-Ansicht nicht erreicht (Erkunden und Werkbank-Sägen sind Pflicht)');
  if (texEmu === 0) messfehler.push('Texturspeicher 0 MB – Upload-Zählung greift nicht');
  if (download.length === 0) messfehler.push('keine Antworten bis „spielbar“ mitgeschnitten');

  const gemessen = ansichten.filter((a) => a.erreicht && a.proben > 0);
  const dcMax = Math.max(0, ...gemessen.map((a) => a.drawCallsMax));
  const triMax = Math.max(0, ...gemessen.map((a) => a.dreieckeMax));
  const renderMessfehler = gemessen.length === 0 || dcMax === 0 || triMax === 0 || messfehler.some((m) => m.includes('Draw Calls'));
  const st = {
    dc: renderMessfehler ? 'messfehler' : bewerte(dcMax, BUDGET.drawCalls),
    tri: renderMessfehler ? 'messfehler' : bewerte(triMax, BUDGET.dreiecke),
    tex: texEmu === 0 ? 'messfehler' : bewerte(texIphone, BUDGET.texturMB),
    dl: download.length === 0 ? 'messfehler' : bewerte(downloadMB, BUDGET.downloadMB),
  } satisfies Record<string, Status>;
  const jeAnsicht = (w: (a: Ansicht) => string, trenner = ' / '): string => ansichten.map((a) => (a.erreicht && a.proben > 0 ? w(a) : '–')).join(trenner);
  const s = gesamt.letzter;
  const browserVersion = page.context().browser()?.version() ?? '?';
  const gesamtStatus = messfehler.length > 0 ? 'MESSFEHLER' : Object.values(st).includes('grenze') ? 'GRENZE ÜBERSCHRITTEN' : Object.values(st).includes('warnung') ? 'eingehalten, mit Warnung' : 'eingehalten';

  const zeilen = [
    `## Performance-Budget /spiel/ – ${gesamtStatus}`,
    '',
    `${new Date().toISOString()} · Commit ${(process.env['GITHUB_SHA'] ?? 'lokal').slice(0, 7)} · ${browserName} ${browserVersion} · iPhone 15 quer, dpr=1 · Software-GPU, **kein iPhone** · Laufzeit ${f((Date.now() - start) / 1000)} s`,
    '',
    `Ansichten: ${ansichten.map((a) => a.name).join(' / ')}`,
    '',
    '| Grösse | Messwert | Ziel | Grenze | Status |',
    '|---|---|---|---|---|',
    `| Draw Calls / Frame (max je Ansicht) | ${jeAnsicht((a) => String(a.drawCallsMax))} | < 80 | ≤ 120 | ${STATUS_TEXT[st.dc]} |`,
    `| Dreiecke im Bild (max je Ansicht) | ${jeAnsicht((a) => f(a.dreieckeMax))} | < 150 000 | ≤ 300 000 | ${STATUS_TEXT[st.tri]} |`,
    `| Download bis spielbar (Text gzip, Binär roh) | ${f(downloadMB, 2)} MB (${String(download.length)} Dateien) | < 15 MB | ≤ 25 MB | ${STATUS_TEXT[st.dl]} |`,
    `| GPU-Texturspeicher iPhone (ASTC-Schätzung) | ${f(texIphone, 1)} MB | < 120 MB | ≤ 200 MB | ${STATUS_TEXT[st.tex]} |`,
    `| GPU-Texturspeicher Emulation (unkomprimiert, obere Schranke) | ${f(texEmu, 1)} MB | – | – | Bericht${texEmu > BUDGET.texturMB.grenze ? ' (⚠ > 200 MB)' : ''} |`,
    `| Frame-Zeit Ø / p95 / max ms (je Ansicht) | ${jeAnsicht((a) => `${f(a.frameAvg, 1)} / ${f(a.frameP95, 1)} / ${f(a.frameMax)}`, ' · ')} | (Gerät) ≤ 33,3 p95 | (Gerät) ≤ 40 p95 | Bericht (Emulation) |`,
    `| fps Emulation (je Ansicht) | ${jeAnsicht((a) => f(a.fps, 1))} | (Gerät) ≥ 30 | (Gerät) ≥ 25 | Bericht (Emulation) |`,
    `| Zeit bis spielbar (Emulation) | ${s?.timeToPlayableMs == null ? '–' : `${f(s.timeToPlayableMs)} ms`} | – | – | Bericht |`,
    `| Übertragen laut __perf (vite preview, ungzipped) | ${s?.transferredKB == null ? '–' : `${f(s.transferredKB / 1024, 2)} MB`} (roh ${f(downloadRohMB, 2)} MB) | – | – | Gegenprobe |`,
    '',
    `Hinweise: ${ansichten.map((a) => `${a.name}: ${a.erreicht ? `${String(a.proben)} Proben in ${f(a.dauerMs / 1000)} s` : 'nicht gemessen'}${a.hinweis ? `, ${a.hinweis}` : ''}`).join(' · ')}`,
    '',
    `Texturen: ${texHinweis}. Komprimierte Formate im Browser: ${komprimierteFormate.length > 0 ? komprimierteFormate.join(', ') : 'keine'}.`,
    `Seitenfehler: ${seitenFehler.length > 0 ? seitenFehler.slice(0, 5).join(' | ') : 'keine'}. Kontextverluste: ${String(s?.contextLostCount ?? '–')}.`,
    ...(messfehler.length > 0 ? ['', '**Messfehler (Budget NICHT bestätigt):**', ...messfehler.map((m) => `- ${m}`)] : []),
    '',
    '<details><summary>Download bis spielbar je Datei</summary>',
    '',
    '| Datei | gezählt kB | roh kB |',
    '|---|---|---|',
    ...download.sort((a, b) => b.gezaehlt - a.gezaehlt).map((d) => `| ${d.pfad} | ${f(d.gezaehlt / 1024, 1)}${d.gzip ? ' (gzip)' : ''} | ${f(d.bytes / 1024, 1)} |`),
    '',
    '</details>',
  ];
  const text = `${zeilen.join('\n')}\n`;
  console.log(`\n${text}`);
  mkdirSync(BERICHT, { recursive: true });
  writeFileSync(join(BERICHT, 'budget.md'), text);
  writeFileSync(
    join(BERICHT, 'budget.json'),
    `${JSON.stringify({ status: st, messfehler, ansichten, downloadMB, downloadDateien: download.length, texturMBEmulation: texEmu, texturMBIphone: texIphone, ktx2Bilder: ktx2.length, letzterSnapshot: s }, null, 2)}\n`,
  );
  for (const [k, v] of Object.entries(st)) if (v === 'warnung') test.info().annotations.push({ type: 'warning', description: `Ziel überschritten: ${k}` });

  // ---------------------------------------------------------------- Urteil
  expect(messfehler, 'Messfehler – Budget nicht bestätigt (siehe Bericht)').toEqual([]);
  expect.soft(dcMax, 'Draw Calls ≤ 120').toBeLessThanOrEqual(BUDGET.drawCalls.grenze);
  expect.soft(triMax, 'Dreiecke ≤ 300 000').toBeLessThanOrEqual(BUDGET.dreiecke.grenze);
  expect.soft(downloadMB, 'Download bis spielbar ≤ 25 MB').toBeLessThanOrEqual(BUDGET.downloadMB.grenze);
  expect.soft(texIphone, 'Texturspeicher iPhone (ASTC) ≤ 200 MB').toBeLessThanOrEqual(BUDGET.texturMB.grenze);
});
