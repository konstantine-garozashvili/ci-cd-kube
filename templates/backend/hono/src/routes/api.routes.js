import { Hono } from 'hono';
import { config } from '../config.js';

export const apiRoutes = new Hono();

apiRoutes.get('/info', (c) =>
  c.json({
    name: config.appName,
    version: config.appVersion,
    environment: config.env,
    nodeVersion: process.version,
    platform: process.platform,
    startedAt: config.startTime,
  })
);

apiRoutes.get('/metrics', (c) => {
  const memory = process.memoryUsage();
  return c.json({
    uptimeSeconds: Math.floor(process.uptime()),
    memory: {
      rssMb: Math.round(memory.rss / 1024 / 1024),
      heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
      heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
    },
    cpuUsage: process.cpuUsage(),
    timestamp: new Date().toISOString(),
  });
});

apiRoutes.post('/echo', async (c) => {
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    payload = null;
  }

  if (!payload || Object.keys(payload).length === 0) {
    return c.json(
      { status: 400, error: 'Bad Request', message: 'Request body must not be empty' },
      400
    );
  }

  return c.json({ received: payload, timestamp: new Date().toISOString() });
});
