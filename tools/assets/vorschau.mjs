// Asset-Vorschau: rendert die erzeugten GLB/KTX2 mit three in Chromium (Playwright) und speichert PNGs
// nach docs/art/assets-phase1/. Aufruf: node tools/assets/vorschau.mjs [ansicht …]
// Hinweis: Software-Rendering (SwiftShader) – Farben/Licht entsprechen nicht exakt dem iPhone.
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { chromium } from '@playwright/test';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ZIEL = join(WURZEL, 'docs', 'art', 'assets-phase1');
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.ktx2': 'image/ktx2' };
const ALLE = ['saege', 'saegeNah', 'massband', 'bleistift', 'werkbank', 'texturen'];
const dateiname = { saege: 'saege', saegeNah: 'saege-nah', massband: 'massband', bleistift: 'bleistift', werkbank: 'werkbank', texturen: 'texturen' };

const ansichten = process.argv.slice(2).length ? process.argv.slice(2) : ALLE;
mkdirSync(ZIEL, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const seite = await browser.newPage({ viewport: { width: 800, height: 500 } });
await seite.route('http://vorschau.test/**', (route) => {
  const pfad = new URL(route.request().url()).pathname;
  const datei = normalize(join(WURZEL, pfad === '/' ? 'tools/assets/vorschau.html' : pfad));
  if (!datei.startsWith(WURZEL) || !existsSync(datei)) return route.fulfill({ status: 404 });
  return route.fulfill({ status: 200, contentType: TYPEN[extname(datei)] ?? 'application/octet-stream', body: readFileSync(datei) });
});
seite.on('pageerror', (e) => console.error('Seitenfehler:', e.message));
seite.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.error(`[${m.type()}]`, m.text());
});
// Detailreiche Gesamtansicht kleiner rendern, damit das PNG ≤ 300 kB bleibt
const groesse = { werkbank: { width: 680, height: 425 } };
for (const a of ansichten) {
  await seite.setViewportSize(groesse[a] ?? { width: 800, height: 500 });
  await seite.goto(`http://vorschau.test/?ansicht=${a}`);
  await seite.waitForFunction(() => window.__fertig === true, null, { timeout: 120000 });
  const datei = join(ZIEL, `${dateiname[a] ?? a}.png`);
  await seite.screenshot({ path: datei });
  const kb = statSync(datei).size / 1024;
  console.log(`${datei.slice(WURZEL.length + 1)}  ${kb.toFixed(0)} kB${kb > 300 ? '  ÜBER 300 kB' : ''}`);
}
await browser.close();
