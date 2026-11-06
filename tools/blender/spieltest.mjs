// Ticket 019: Lädt das Spiel mit den neuen GLB (Chromium, Software-GPU), prüft „assets = modelle“ und Konsolenfehler,
// geht an die Werkbank und speichert einen Screenshot.
// Voraussetzung: npm run build -- --base=/handcraft-life/ && npx vite preview --port 4591 --strictPort
// Aufruf: node tools/blender/spieltest.mjs [url] [ausgabe.jpg]
import process from 'node:process';
import { chromium, devices } from '@playwright/test';

const url = process.argv[2] ?? 'http://localhost:4591/handcraft-life/spiel/?debug=1&saat=7&test=1&dpr=1';
const aus = process.argv[3] ?? 'docs/art/assets-blender/spiel-werkbank.jpg';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ ...devices['iPhone 15 landscape'] });
const page = await ctx.newPage();
const fehler = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') fehler.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => fehler.push(`pageerror: ${e.message}`));
page.on('requestfailed', (r) => fehler.push(`requestfailed: ${r.url()}`));
await page.goto(url);
await page.waitForFunction(() => ['ready', 'no-webgl2', 'error'].includes(document.body.dataset['state'] ?? ''), null, { timeout: 90_000 });
const state = await page.evaluate(() => document.body.dataset['state']);
const assets = await page.evaluate(() => window.__view?.zustand().assets);
console.log('Seitenzustand:', state, '· Assets:', assets);
const taste = page.locator('.hud-aktionstaste');
await taste.waitFor({ state: 'visible', timeout: 60_000 });
await taste.tap();
await page.waitForFunction(() => window.__spiel?.ui().anDerBank === true && window.__view?.zustand().fahrt === false, null, { timeout: 60_000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: aus, type: 'jpeg', quality: 88 });
console.log('Screenshot:', aus);
const perf = await page.evaluate(() => {
  const f = /** @type {any} */ (window).__perf;
  if (typeof f !== 'function') return null;
  const p = f();
  return { textureMemoryMB: p.textureMemoryMB, drawCalls: p.drawCalls ?? p.calls, triangles: p.triangles };
});
console.log('Perf:', JSON.stringify(perf));
const debug = await page.locator('.debug-overlay, #debug, [data-debug]').first().textContent().catch(() => null);
if (debug) console.log('Debug-Overlay:', debug.replace(/\s+/g, ' ').slice(0, 300));
console.log(fehler.length ? `Konsole (${fehler.length}):\n  ${fehler.join('\n  ')}` : 'Konsole: keine Fehler/Warnungen');
await browser.close();
process.exit(state === 'ready' && assets === 'modelle' && !fehler.some((f) => !f.startsWith('warning')) ? 0 : 1);
