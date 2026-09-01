import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/http-exception.filter';

describe('Integration: health and API routes', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /healthz returns UP', async () => {
    const res = await request(app.getHttpServer()).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(res.body.uptime).toBeDefined();
  });

  it('GET /ready reports the real database check result', async () => {
    const res = await request(app.getHttpServer()).get('/ready');
    expect([200, 503]).toContain(res.status);
    expect(['UP', 'DOWN', 'NOT_CONFIGURED']).toContain(res.body.checks.database.status);
  });

  it('GET /live returns the plaintext ping', async () => {
    const res = await request(app.getHttpServer()).get('/live');
    expect(res.status).toBe(200);
    expect(res.text).toBe('OK');
  });

  it('GET /api/info returns application metadata', async () => {
    const res = await request(app.getHttpServer()).get('/api/info');
    expect(res.status).toBe(200);
    expect(res.body.name).toBeTruthy();
    expect(res.body.nodeVersion).toBeDefined();
  });

  it('POST /api/echo echoes the payload', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/echo')
      .send({ message: 'Hello DevSecOps' });
    expect(res.status).toBe(200);
    expect(res.body.received.message).toBe('Hello DevSecOps');
  });

  it('POST /api/echo rejects an empty body', async () => {
    const res = await request(app.getHttpServer()).post('/api/echo').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Bad Request');
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app.getHttpServer()).get('/no-such-endpoint');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });
});
