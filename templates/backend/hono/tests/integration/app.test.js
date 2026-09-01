import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Set before importing the app so its config picks this up and the request
// logger stays quiet. A "NODE_ENV=test node ..." prefix in the npm script
// would not run on Windows, so the environment is set here instead.
process.env.NODE_ENV = 'test';
const { app } = await import('../../src/app.js');

describe('Integration: health and API routes', () => {
  test('GET /healthz returns UP', async () => {
    const res = await app.request('/healthz');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'UP');
    assert.ok(body.uptime !== undefined);
  });

  test('GET /ready reports the real database check result', async () => {
    const res = await app.request('/ready');
    assert.ok([200, 503].includes(res.status));
    const body = await res.json();
    assert.ok(['UP', 'DOWN', 'NOT_CONFIGURED'].includes(body.checks.database.status));
  });

  test('GET /live returns the plaintext ping', async () => {
    const res = await app.request('/live');
    assert.equal(res.status, 200);
    assert.equal(await res.text(), 'OK');
  });

  test('GET /api/info returns application metadata', async () => {
    const res = await app.request('/api/info');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.name);
    assert.ok(body.nodeVersion);
  });

  test('POST /api/echo echoes the payload', async () => {
    const res = await app.request('/api/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello DevSecOps' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.received.message, 'Hello DevSecOps');
  });

  test('POST /api/echo rejects an empty body', async () => {
    const res = await app.request('/api/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, 'Bad Request');
  });

  test('returns a JSON 404 for unknown routes', async () => {
    const res = await app.request('/no-such-endpoint');
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'Not Found');
  });
});
