import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Messlauf der Engine-Spikes (Ticket 005): `npx playwright test -c tests/perf/playwright.config.ts`
// Lokal (Cloud-Sitzung ohne WebKit): PW_LOCAL_CHROMIUM=1 → Chromium mit iPhone-15-Profil quer.
// Frame-Zeiten nur als Relativvergleich zwischen den Engines (Software-Rendering, kein iPhone).
const localChromium = process.env['PW_LOCAL_CHROMIUM'] === '1';

export default defineConfig({
  testDir: '.',
  testMatch: 'spikes.spec.ts',
  fullyParallel: false,
  workers: 1, // nacheinander messen, damit sich die Engines die CPU nicht teilen
  reporter: 'list',
  timeout: 300_000,
  use: { baseURL: 'http://localhost:4173' },
  projects: [
    {
      name: localChromium ? 'perf-iphone-quer-chromium' : 'perf-iphone-quer-webkit',
      use: localChromium
        ? { ...devices['iPhone 15 landscape'], browserName: 'chromium', launchOptions: { executablePath: '/opt/pw-browsers/chromium' } }
        : { ...devices['iPhone 15 landscape'] },
    },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    cwd: join(import.meta.dirname, '../..'),
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
