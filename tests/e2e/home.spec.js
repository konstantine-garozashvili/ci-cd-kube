const { test, expect } = require('@playwright/test');

test.describe('Playwright E2E: Home Landing Page Scenarios', () => {
  test('should load the homepage and display correct title and status badge', async ({ page }) => {
    await page.goto('/');

    // Verify Title
    await expect(page).toHaveTitle(/La Plateforme/i);

    // Verify App Header
    const heading = page.locator('#app-title');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('La Plateforme Starter');

    // Verify System Status Badge
    const statusBadge = page.locator('#status-badge');
    await expect(statusBadge).toBeVisible();
    await expect(statusBadge).toContainText('System Operational');

    // Verify Health Status Tile
    const healthTile = page.locator('#health-status');
    await expect(healthTile).toBeVisible();
    await expect(healthTile).toContainText('UP (200 OK)');
  });

  test('should test interactive route explorer buttons', async ({ page }) => {
    await page.goto('/');
    
    // Check buttons exist
    const btnInfo = page.locator('#btn-info');
    await expect(btnInfo).toBeVisible();
    await expect(btnInfo).toContainText('GET /api/info');

    // Click GET /api/info and verify JSON output updates
    await btnInfo.click();
    const output = page.locator('#response-output');
    await expect(output).toContainText('HTTP 200 OK');
  });

  test('should verify health endpoint responds with JSON UP status directly in browser context', async ({ request }) => {
    const response = await request.get('/healthz');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('UP');
  });
});
