import { Hono } from 'hono';
import { config } from '../config.js';
import { checkDatabaseHealth } from '../db/index.js';

export const healthRoutes = new Hono();

/**
 * Liveness probe — process-only. A liveness probe that fails on a database
 * blip makes Kubernetes restart a perfectly healthy container.
 */
healthRoutes.get('/healthz', (c) =>
  c.json({
    status: 'UP',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: config.appName,
    version: config.appVersion,
  })
);

/**
 * Readiness probe — checks dependencies and answers 503 when this instance
 * cannot serve traffic, so the load balancer drains it.
 */
healthRoutes.get('/ready', async (c) => {
  const database = await checkDatabaseHealth();
  const isReady = database.status === 'UP' || database.status === 'NOT_CONFIGURED';
  const memory = process.memoryUsage();

  return c.json(
    {
      status: isReady ? 'READY' : 'NOT_READY',
      checks: {
        database,
        memory: {
          usedMb: Math.round(memory.heapUsed / 1024 / 1024),
          totalMb: Math.round(memory.heapTotal / 1024 / 1024),
        },
      },
      timestamp: new Date().toISOString(),
    },
    isReady ? 200 : 503
  );
});

healthRoutes.get('/live', (c) => c.text('OK'));
