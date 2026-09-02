import { serve } from '@hono/node-server';
import { app } from './app.js';
import { config } from './config.js';
import { connectDatabase, disconnectDatabase } from './db/index.js';

try {
  await connectDatabase();
} catch (err) {
  // Fail fast in production; keep serving in development so you can work on
  // routes without Docker running. /ready reports DOWN either way.
  if (config.env === 'production') {
    console.error(`❌ Database connection failed: ${err.message}`);
    process.exit(1);
  }
  console.warn(`⚠️  Database unavailable: ${err.message}`);
  console.warn('   Continuing anyway — /ready will report DOWN until it is up.');
}

const server = serve({ fetch: app.fetch, port: config.port }, () => {
  console.log(`⚡ [${config.appName}] listening on port ${config.port} (${config.env})`);
  console.log(`🩺 Liveness:  http://localhost:${config.port}/healthz`);
  console.log(`✅ Readiness: http://localhost:${config.port}/ready`);
});

/**
 * Drain in-flight requests before exiting so orchestrators can roll pods
 * without dropping responses.
 */
function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}, draining connections...`);

  const forceExit = setTimeout(() => {
    console.error('⚠️  Shutdown timed out after 10s, forcing exit.');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async () => {
    await disconnectDatabase();
    console.log('✅ Server closed and database disconnected.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
