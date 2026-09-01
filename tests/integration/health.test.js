const request = require('supertest');
const app = require('../../src/app');

describe('Integration Tests: Health & Security Headers', () => {
  describe('GET /healthz', () => {
    it('should return 200 OK with UP status', async () => {
      const res = await request(app).get('/healthz');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.service).toBe('ci-cd-kube');
      expect(res.body.uptime).toBeDefined();
    });

    it('should include Helmet OWASP security headers', async () => {
      const res = await request(app).get('/healthz');
      expect(res.headers['x-dns-prefetch-control']).toBe('off');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('GET /ready', () => {
    it('should return 200 READY with check details', async () => {
      const res = await request(app).get('/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('READY');
      expect(res.body.checks.database).toBe('UP');
    });
  });

  describe('GET /live', () => {
    it('should return 200 OK string', async () => {
      const res = await request(app).get('/live');
      expect(res.status).toBe(200);
      expect(res.text).toBe('OK');
    });
  });
});
