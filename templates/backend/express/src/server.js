const app = require('./app');
const config = require('./config');
const { connectDatabase, disconnectDatabase } = require('./db');

let server;

async function start() {
  try {
    await connectDatabase();
  } catch (err) {
    // In production an unreachable database means this instance cannot do its
    // job, so fail fast and let the orchestrator retry. In development, keep
    // serving: /ready honestly reports DOWN, and you can work on routes
    // without starting Docker first.
    if (config.env === 'production') {
      console.error(`❌ Database connection failed: ${err.message}`);
      process.exit(1);
    }
    console.warn(`⚠️  Database unavailable: ${err.message}`);
    console.warn('   Continuing anyway — /ready will report DOWN until it is up.');
  }

  server = app.listen(config.port, () => {
    console.log(`🚀 [${config.appName}] listening on port ${config.port} (${config.env})`);
    console.log(`🩺 Liveness:  http://localhost:${config.port}/healthz`);
    console.log(`✅ Readiness: http://localhost:${config.port}/ready`);
    console.log(`📖 API info:  http://localhost:${config.port}/api/info`);
  });
}

/**
 * Drain in-flight requests before exiting so container orchestrators can roll
 * pods without dropping responses. The timer is unref'd so it never keeps the
 * process alive on its own.
 */
function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}, draining connections...`);

  const forceExit = setTimeout(() => {
    console.error('⚠️  Shutdown timed out after 10s, forcing exit.');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  const close = server ? new Promise((resolve) => server.close(resolve)) : Promise.resolve();

  close
    .then(() => disconnectDatabase())
    .then(() => {
      console.log('✅ HTTP server closed and database disconnected.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('⚠️  Error during shutdown:', err.message);
      process.exit(1);
    });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('⚠️  Unhandled promise rejection:', reason);
});

start();

module.exports = { start };
