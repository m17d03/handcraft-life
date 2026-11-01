import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Budget-Prüfung Vertical Slice (Ticket 015, Skill perf-budget-check):
//   npx playwright test -c tests/perf/budget.config.ts
// Standard und CI: WebKit, iPhone 15 quer (ADR 0004). Lokal ohne WebKit: PW_LOCAL_CHROMIUM=1.
// PW_PORT: eigener Port je Worktree. In CI ist dist/ aus dem E2E-Schritt schon gebaut → nur `vite preview`.
const localChromium = process.env['PW_LOCAL_CHROMIUM'] === '1';
const port = Number(process.env['PW_PORT'] ?? '4173');
const ci = !!process.env['CI'];
const preview = `npx vite preview --port ${String(port)} --strictPort`;

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: 'budget.spec.ts',
  // eigener Ausgabeordner: Bericht liegt neben Traces, die E2E-Ergebnisse bleiben unberührt
  outputDir: join(import.meta.dirname, '../../test-results/perf-budget'),
  fullyParallel: false,
  workers: 1,
  retries: 0, // Grenzwerte sind deterministisch; ein zweiter Versuch verdeckt nur Fehler
  forbidOnly: ci,
  reporter: 'list',
  timeout: 240_000,
  use: {
    baseURL: `http://localhost:${String(port)}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: localChromium ? 'perf-iphone-quer-chromium' : 'perf-iphone-quer-webkit',
      use: localChromium
        ? { ...devices['iPhone 15 landscape'], browserName: 'chromium', launchOptions: { executablePath: '/opt/pw-browsers/chromium' } }
        : { ...devices['iPhone 15 landscape'] },
    },
  ],
  webServer: {
    command: ci ? preview : `npm run build && ${preview}`,
    cwd: join(import.meta.dirname, '../..'),
    url: `http://localhost:${String(port)}`,
    reuseExistingServer: !ci && process.env['PW_PORT'] === undefined,
    timeout: 120_000,
  },
});
