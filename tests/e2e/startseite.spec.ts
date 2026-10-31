import { expect, test } from '@playwright/test';

test('Startseite lädt ohne Konsolenfehler, Overlay standardmässig aus', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') problems.push(msg.text()); });
  page.on('pageerror', (err) => { problems.push(err.message); });

  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Handcraft Life' })).toBeVisible();
  await expect(page.locator('#webgl-status')).not.toHaveText(/geprüft/);
  await expect(page.locator('#debug-overlay')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('?debug=1 zeigt fps und fängt Fehler', async ({ page }) => {
  await page.goto('./?debug=1');
  const overlay = page.locator('#debug-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('.debug-stats')).toHaveText(/fps [1-9]\d*/);

  await page.evaluate(() => {
    setTimeout(() => { throw new Error('Testfehler-Sync'); }, 0);
    void Promise.reject(new Error('Testfehler-Async'));
  });
  await expect(overlay.locator('.debug-errors')).toContainText('Testfehler-Sync');
  await expect(overlay.locator('.debug-errors')).toContainText('Testfehler-Async');
});

test('kein horizontales Scrollen auf dem iPhone', async ({ page }) => {
  await page.goto('./');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('?debug=1 meldet Ladefehler von Ressourcen', async ({ page }) => {
  await page.goto('./?debug=1');
  await page.evaluate(() => {
    const img = document.createElement('img');
    img.src = 'gibt-es-nicht.png';
    document.body.append(img);
  });
  await expect(page.locator('#debug-overlay .debug-errors')).toContainText('Ladefehler: gibt-es-nicht.png');
});
