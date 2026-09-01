import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';

const app = new Hono();

// Security Middleware
app.use('*', secureHeaders());
app.use('*', cors({ origin: '*' }));
app.use('*', logger());

// Health & Readiness Probes
app.get('/healthz', (c) => c.json({ status: 'UP', service: 'hono-api', uptime: process.uptime() }));
app.get('/ready', (c) => c.json({ status: 'READY', checks: { api: 'OK' } }));
app.get('/live', (c) => c.text('OK'));

// API Routes
app.get('/api/info', (c) => c.json({
  service: 'hono-api',
  version: '1.0.0',
  framework: 'Hono Web Standards',
  environment: process.env.NODE_ENV || 'development'
}));

app.get('/api/metrics', (c) => c.json({
  uptime: process.uptime(),
  memory: process.memoryUsage(),
  timestamp: new Date().toISOString()
}));

app.post('/api/echo', async (c) => {
  const body = await c.req.json();
  return c.json({ received: body, timestamp: new Date().toISOString() });
});

const port = Number(process.env.PORT) || 3000;
console.log(`⚡ Hono Microservice listening on http://localhost:${port}`);

serve({ fetch: app.fetch, port });
