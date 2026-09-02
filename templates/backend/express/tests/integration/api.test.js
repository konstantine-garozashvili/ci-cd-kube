const request = require('supertest');
const app = require('../../src/app');
const config = require('../../src/config');

describe('Integration: API routes', () => {
  describe('GET /api/info', () => {
    it('returns application metadata with status 200', async () => {
      const res = await request(app).get('/api/info');
      expect(res.status).toBe(200);
      expect(res.body.name).toBe(config.appName);
      expect(res.body.version).toBe(config.appVersion);
      expect(res.body.nodeVersion).toBeDefined();
    });
  });

  describe('GET /api/metrics', () => {
    it('returns memory and uptime metrics', async () => {
      const res = await request(app).get('/api/metrics');
      expect(res.status).toBe(200);
      expect(res.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(res.body.memory.heapUsedMb).toBeGreaterThan(0);
    });
  });

  describe('POST /api/echo', () => {
    it('echoes the payload when a body is provided', async () => {
      const res = await request(app).post('/api/echo').send({ message: 'Hello DevSecOps' });
      expect(res.status).toBe(200);
      expect(res.body.received.message).toBe('Hello DevSecOps');
    });

    it('returns 400 when the body is empty', async () => {
      const res = await request(app).post('/api/echo').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
    });
  });

  describe('unknown routes', () => {
    it('returns a JSON 404 rather than an HTML error page', async () => {
      const res = await request(app).get('/no-such-endpoint');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });
  });
});
