const request = require('supertest');
const app = require('../../src/app');
const config = require('../../src/config');

describe('Integration: health & security headers', () => {
  describe('GET /healthz', () => {
    it('returns 200 with UP status and this service identity', async () => {
      const res = await request(app).get('/healthz');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.service).toBe(config.appName);
      expect(res.body.uptime).toBeDefined();
    });

    it('sets the Helmet OWASP security headers', async () => {
      const res = await request(app).get('/healthz');
      expect(res.headers['x-dns-prefetch-control']).toBe('off');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('GET /ready', () => {
    it('reports the real database check result', async () => {
      const res = await request(app).get('/ready');
      expect([200, 503]).toContain(res.status);
      expect(res.body.checks.database.status).toBeDefined();
      expect(['UP', 'DOWN', 'NOT_CONFIGURED']).toContain(res.body.checks.database.status);
      expect(res.body.checks.memory.usedMb).toBeGreaterThan(0);
    });
  });

  describe('GET /live', () => {
    it('returns the plaintext OK ping', async () => {
      const res = await request(app).get('/live');
      expect(res.status).toBe(200);
      expect(res.text).toBe('OK');
    });
  });
});
