/**
 * Messskript Engine-Spike (Ticket 005, Skill perf-budget-check).
 * Je Engine und AA-Variante: Seite laden, bis spielbar warten, 5 s Aufwärmen, __perfReset(),
 * 10 s Standard-Kamerafahrt (?auto=1), dabei alle 500 ms __perf() lesen.
 * Ergebnis: Tabelle auf der Konsole und in test-results/perf-spikes.md.
 * Bundle = gzip-Grösse (zlib, Stufe 9) aller von der Seite geladenen JS/CSS/HTML-Dateien aus dist/.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';
import type { PerfSnapshot } from '../../spikes/shared/perf';

const ENGINES = ['babylon', 'playcanvas', 'three'] as const;
const VARIANTS = [
  { name: 'msaa', query: 'aa=msaa' },
  { name: 'fxaa/taa', query: 'aa=fxaa' },
] as const;
const DIST = join(import.meta.dirname, '../../dist');

interface Row {
  engine: string;
  variant: string;
  gzipKB: number;
  files: number;
  ttpMs: number | null;
  drawCallsMax: number;
  trianglesMax: number;
  textureMB: number;
  frameAvg: number;
  frameP95: number;
  renderScale: number;
  aa: string;
}

const rows: Row[] = [];

function trackBundle(page: Page): () => { kb: number; files: number } {
  const paths = new Set<string>();
  page.on('response', (r) => {
    const url = new URL(r.url());
    if (url.hostname === 'localhost' && /\.(js|css|html)$|\/$/.test(url.pathname)) paths.add(url.pathname);
  });
  return () => {
    let bytes = 0;
    let files = 0;
    for (const p of paths) {
      const file = join(DIST, p.endsWith('/') ? `${p}index.html` : p);
      if (!existsSync(file)) continue;
      bytes += gzipSync(readFileSync(file), { level: 9 }).length;
      files++;
    }
    return { kb: bytes / 1024, files };
  };
}

for (const engine of ENGINES) {
  for (const v of VARIANTS) {
    test(`${engine} ${v.name}`, async ({ page }) => {
      const bundle = trackBundle(page);
      await page.goto(`./spikes/${engine}/?perf=1&auto=1&${v.query}`);
      await page.waitForFunction(() => document.body.dataset['state'] === 'ready', null, { timeout: 120_000 });
      await page.waitForTimeout(5000);
      await page.evaluate(() => { window.__perfReset?.(); });
      let dcMax = 0;
      let triMax = 0;
      for (let i = 0; i < 20; i++) {
        await page.waitForTimeout(500);
        const s = await page.evaluate(() => window.__perf?.());
        if (s) {
          dcMax = Math.max(dcMax, s.drawCalls);
          triMax = Math.max(triMax, s.triangles);
        }
      }
      const s = (await page.evaluate(() => window.__perf?.())) as PerfSnapshot;
      const b = bundle();
      rows.push({
        engine,
        variant: v.name,
        gzipKB: b.kb,
        files: b.files,
        ttpMs: s.timeToPlayableMs,
        drawCallsMax: dcMax,
        trianglesMax: triMax,
        textureMB: s.textureMemoryMB,
        frameAvg: s.frameTimeMsAvg,
        frameP95: s.frameTimeMsP95,
        renderScale: s.renderScale,
        aa: s.msaaSamples > 0 ? `${s.aa}×${String(s.msaaSamples)}` : s.aa,
      });
      expect(dcMax).toBeLessThan(80);
      expect(triMax).toBeLessThan(150_000);
    });
  }
}

test('Startseite (ohne 3D) bleibt klein', async ({ page }) => {
  const bundle = trackBundle(page);
  await page.goto('./');
  await expect(page.locator('#webgl-status')).not.toHaveText(/geprüft/);
  const b = bundle();
  rows.push({ engine: 'startseite', variant: '-', gzipKB: b.kb, files: b.files, ttpMs: null, drawCallsMax: 0, trianglesMax: 0, textureMB: 0, frameAvg: 0, frameP95: 0, renderScale: 0, aa: '-' });
  expect(b.kb).toBeLessThan(100);
});

test.afterAll(({ browserName }) => {
  const f = (n: number, d = 1): string => n.toFixed(d);
  const lines = [
    `Messlauf ${new Date().toISOString()} · ${browserName} · iPhone 15 quer · Frame-Zeiten NUR relativ (Software-Rendering)`,
    '',
    '| Engine | AA | Bundle gzip (kB) | Dateien | spielbar nach (ms) | Draw Calls max | Dreiecke max | Textur MB (Schätzung) | Frame Ø ms | Frame p95 ms | renderScale |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.engine} | ${r.aa} | ${f(r.gzipKB)} | ${String(r.files)} | ${r.ttpMs === null ? '-' : f(r.ttpMs, 0)} | ${String(r.drawCallsMax)} | ${String(r.trianglesMax)} | ${f(r.textureMB)} | ${f(r.frameAvg)} | ${f(r.frameP95)} | ${f(r.renderScale, 2)} |`,
    ),
  ];
  const text = lines.join('\n');
  console.log(`\n${text}\n`);
  mkdirSync(join(import.meta.dirname, '../../test-results'), { recursive: true });
  writeFileSync(join(import.meta.dirname, '../../test-results/perf-spikes.md'), `${text}\n`);
});
