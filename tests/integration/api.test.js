const request = require('supertest');
const app = require('../../src/app');

describe('Integration Tests: API Routes', () => {
  describe('GET /api/info', () => {
    it('should return application metadata with status 200', async () => {
      const res = await request(app).get('/api/info');
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('ci-cd-kube');
      expect(res.body.version).toBe('1.0.0');
      expect(res.body.nodeVersion).toBeDefined();
    });
  });

  describe('GET /api/metrics', () => {
    it('should return memory and uptime metrics', async () => {
      const res = await request(app).get('/api/metrics');
      expect(res.status).toBe(200);
      expect(res.body.uptimeSeconds).toBeDefined();
      expect(res.body.memory.heapUsedMb).toBeDefined();
    });
  });

  describe('POST /api/echo', () => {
    it('should echo payload when request body is provided', async () => {
      const payload = { message: 'Hello DevSecOps' };
      const res = await request(app).post('/api/echo').send(payload);
      expect(res.status).toBe(200);
      expect(res.body.received.message).toBe('Hello DevSecOps');
    });

    it('should return 400 Bad Request when body is empty', async () => {
      const res = await request(app).post('/api/echo').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
    });
  });

  describe('Handling Non-existent Routes (404)', () => {
    it('should return 404 JSON response', async () => {
      const res = await request(app).get('/non-existent-endpoint');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });
  });
});
