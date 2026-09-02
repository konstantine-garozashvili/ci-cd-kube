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

  test('renders the header and the brand logo', async ({ page }) => {
    await expect(page.locator('#app-title')).toBeVisible();
    await expect(page.locator('.brand-logo')).toBeVisible();
  });

  /**
   * The badge reports a real probe rather than a fixed string, so this asserts
   * the probe ran and produced a verdict.
   *
   * It deliberately does not require the verdict to be green: `npm run test:e2e`
   * starts the application but not a database, so a project configured with one
   * will correctly report it as DOWN. Demanding "Environment is working" here
   * would be asserting that the page lies when the database is absent.
   */
  test('completes its environment probe and reports a verdict', async ({ page }) => {
    await expect(page.locator('#status-badge')).not.toContainText('Checking environment', {
      timeout: 15_000,
    });
  });

  test('reports the API as reachable in the environment checks', async ({ page }) => {
    const checks = page.locator('#env-checks .item');
    await expect(checks.first()).toBeVisible({ timeout: 15_000 });

    // The API is definitely up while these tests run, so its row must be green
    // — that is what proves the rows carry measured state and not placeholders.
    await expect(checks.filter({ hasText: 'API server' })).toHaveClass(/\bok\b/, {
      timeout: 15_000,
    });
    await expect(checks.filter({ hasText: 'Readiness probe' })).toHaveCount(1);
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
