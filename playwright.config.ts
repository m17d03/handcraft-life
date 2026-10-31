import { defineConfig, devices, type Project } from '@playwright/test';

// Emulation prüft Abläufe und Layout, nicht echte iPhone-Leistung (siehe perf-budget-check).
// Standard (und in CI): WebKit mit iPhone-Profil.
// PW_LOCAL_CHROMIUM=1: Notlösung für Umgebungen ohne WebKit-Download (Cloud-Sitzung) –
// gleiches iPhone-Profil, aber Chromium-Engine. Ersetzt den WebKit-Lauf in CI nicht.
const localChromium = process.env['PW_LOCAL_CHROMIUM'] === '1';

const iphone = (name: string, device: keyof typeof devices): Project =>
  localChromium
    ? {
        name: `${name}-chromium`,
        use: {
          ...devices[device],
          browserName: 'chromium',
          launchOptions: { executablePath: '/opt/pw-browsers/chromium' },
        },
      }
    : { name, use: { ...devices[device] } };

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [iphone('iphone-webkit', 'iPhone 15'), iphone('iphone-webkit-quer', 'iPhone 15 landscape')],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
