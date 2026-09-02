const { test, expect } = require('@playwright/test');

/**
 * Contract tests for the backend, driven through the same origin the browser
 * uses. In a fullstack project these calls pass through the frontend's proxy,
 * which means this suite also proves the proxy is wired correctly.
 */
test.describe('E2E: API contract', () => {
  test('GET /healthz reports the service as UP', async ({ request }) => {
    const res = await request.get('/healthz');
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body.status).toBe('UP');
    expect(body.service).toBeTruthy();
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  test('GET /ready returns a real dependency report', async ({ request }) => {
    const res = await request.get('/ready');
    expect([200, 503]).toContain(res.status());

    const body = await res.json();
    expect(['UP', 'DOWN', 'NOT_CONFIGURED']).toContain(body.checks.database.status);
  });

  test('GET /live answers the plaintext ping', async ({ request }) => {
    const res = await request.get('/live');
    expect(res.ok()).toBeTruthy();
    expect(await res.text()).toBe('OK');
  });

  test('GET /api/info returns application metadata', async ({ request }) => {
    const res = await request.get('/api/info');
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body.name).toBeTruthy();
    expect(body.version).toBeTruthy();
    expect(body.nodeVersion).toBeTruthy();
  });

  test('POST /api/echo round-trips a payload', async ({ request }) => {
    const res = await request.post('/api/echo', { data: { message: 'ping' } });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).received.message).toBe('ping');
  });

  test('POST /api/echo rejects an empty body with a JSON error', async ({ request }) => {
    const res = await request.post('/api/echo', { data: {} });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe('Bad Request');
  });

  test('unknown routes return a JSON 404, never an HTML error page', async ({ request }) => {
    const res = await request.get('/api/definitely-not-a-route');
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toBe('Not Found');
  });
});
