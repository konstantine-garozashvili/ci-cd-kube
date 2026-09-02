import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { config } from './config.js';
import { healthRoutes } from './routes/health.routes.js';
import { apiRoutes } from './routes/api.routes.js';

export const app = new Hono();

app.use('*', secureHeaders());
app.use('*', cors({ origin: config.corsOrigin }));
if (config.env !== 'test') {
  app.use('*', logger());
}

// Health probes are mounted at the root and stay ahead of any API middleware.
app.route('/', healthRoutes);
app.route('/api', apiRoutes);

app.notFound((c) =>
  c.json(
    {
      status: 404,
      error: 'Not Found',
      message: `Cannot ${c.req.method} ${new URL(c.req.url).pathname}`,
      timestamp: new Date().toISOString(),
    },
    404
  )
);

app.onError((err, c) => {
  const status = err.status || 500;
  const isDev = config.env !== 'production';
  return c.json(
    {
      status,
      error: err.name || 'Internal Server Error',
      message: err.message || 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      ...(isDev && err.stack ? { stack: err.stack } : {}),
    },
    status
  );
});
