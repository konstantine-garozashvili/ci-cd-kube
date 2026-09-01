const { test, expect } = require('@playwright/test');

test.describe('Playwright E2E: Home Landing Page Scenarios', () => {
  test('should load the homepage and display correct title and status badge', async ({ page }) => {
    await page.goto('/');

    // Verify Title
    await expect(page).toHaveTitle(/DevSecOps Golden Starter/i);

    // Verify App Header
    const heading = page.locator('#app-title');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('DevSecOps Golden Starter');

    // Verify System Status Badge
    const statusBadge = page.locator('#status-badge');
    await expect(statusBadge).toBeVisible();
    await expect(statusBadge).toContainText('System Operational');

    // Verify Health Status Tile
    const healthTile = page.locator('#health-status');
    await expect(healthTile).toBeVisible();
    await expect(healthTile).toContainText('UP (HTTP 200)');
  });

  test('should navigate to API info endpoint from button', async ({ page }) => {
    await page.goto('/');
    const btnInfo = page.locator('#btn-info');
    await expect(btnInfo).toBeVisible();
    await expect(btnInfo).toHaveAttribute('href', '/api/info');
  });

  test('should verify health endpoint responds with JSON UP status directly in browser context', async ({ request }) => {
    const response = await request.get('/healthz');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('UP');
  });
});
