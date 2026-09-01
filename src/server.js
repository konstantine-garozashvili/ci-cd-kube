const app = require('./app');
const config = require('./config');

const server = app.listen(config.port, () => {
  console.log(`🚀 [${config.appName}] running on port ${config.port} (${config.env})`);
  console.log(`🩺 Healthcheck: http://localhost:${config.port}/healthz`);
  console.log(`📖 API Info:    http://localhost:${config.port}/api/info`);
});

// Graceful Shutdown Handler for Container Environments (SIGTERM, SIGINT)
function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}, initiating graceful shutdown...`);
  server.close(() => {
    console.log('✅ HTTP server closed. Process terminating cleanly.');
    process.exit(0);
  });

  // Force shutdown if connections do not close within 10 seconds
  setTimeout(() => {
    console.error('⚠️ Forcefully terminating after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = server;
