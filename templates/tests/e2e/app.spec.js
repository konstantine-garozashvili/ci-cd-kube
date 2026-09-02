const { test, expect } = require('@playwright/test');

/**
 * Browser journey through the landing page. Asserts only on IDs that every
 * frontend template shares, so one suite covers React, Vue, Next.js and the
 * vanilla page.
 */
test.describe('E2E: landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders the header and operational status badge', async ({ page }) => {
    await expect(page.locator('#app-title')).toBeVisible();
    await expect(page.locator('#status-badge')).toContainText('System Operational');
  });

  test('loads the health endpoint into the explorer on first paint', async ({ page }) => {
    await expect(page.locator('#response-output')).toContainText('"status": "UP"', {
      timeout: 15_000,
    });
  });

  test('fetches /api/info when the explorer button is clicked', async ({ page }) => {
    await page.locator('#btn-info').click();

    const output = page.locator('#response-output');
    await expect(output).toContainText('HTTP 200 OK');
    await expect(output).toContainText('nodeVersion');
  });

  test('surfaces the 400 response from POST /api/echo without crashing the UI', async ({
    page,
  }) => {
    await page.locator('#btn-echo').click();
    await expect(page.locator('#response-output')).toContainText('received');
    await expect(page.locator('#app-title')).toBeVisible();
  });
});
