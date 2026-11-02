import { test, expect } from '@playwright/test';

const obj = 'o CrossBrowser\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n';

test('studio UI, ad placeholders and accessible controls survive this browser profile', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('./');
  await expect(page).toHaveTitle(/Model View/);
  await expect(page.locator('#dropZone')).toBeVisible();
  await expect(page.locator('#openFiles')).toBeVisible();
  await expect(page.locator('#modelSearch')).toBeAttached();
  await expect(page.locator('[data-ad-slot="leaderboard"]')).toBeVisible();
  await expect(page.locator('[data-ad-slot="below-workspace"]')).toBeVisible();
  await expect(page.locator('script[src*="adsbygoogle"]')).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 3),
    'Horizontal overflow must not break smaller browser screens').toBeTruthy();
  expect(pageErrors).toEqual([]);
});

test('model import either renders or reports unsupported WebGL clearly', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('./');
  await page.locator('#filesInput').setInputFiles({
    name:'crossbrowser.obj', mimeType:'text/plain', buffer:Buffer.from(obj)
  });
  await expect(page.locator('#importStatus')).toContainText('1 standard model(s)');
  await expect.poll(async () => {
    const loaded = await page.locator('#activeName').textContent();
    const status = await page.locator('#statusLine').textContent();
    return loaded === 'crossbrowser.obj' || /WebGL|rendering is unavailable|Could not load|Import failed/i.test(status||'');
  }, { timeout:20000 }).toBeTruthy();
  const loaded = await page.locator('#activeName').textContent();
  const details = await page.locator('#statusLine').textContent();
  if (loaded === 'crossbrowser.obj') {
    await expect(page.locator('#statTriangles')).toHaveText('1');
    await expect(page.locator('#exportReport')).toBeEnabled();
  } else {
    expect(details, 'The app must clearly explain why the model cannot render').toMatch(/WebGL|rendering is unavailable/i);
  }
  expect(pageErrors).toEqual([]);
});
