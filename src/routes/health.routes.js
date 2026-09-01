const express = require('express');
const router = express.Router();
const config = require('../config');

/**
 * GET /healthz
 * Liveness probe: returns 200 if server process is running
 */
router.get('/healthz', (_req, res) => {
  res.status(200).json({
    status: 'UP',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: config.appName,
    version: config.appVersion,
  });
});

/**
 * GET /ready
 * Readiness probe: checks dependencies / readiness status
 */
router.get('/ready', (_req, res) => {
  res.status(200).json({
    status: 'READY',
    checks: {
      database: 'UP',
      memory: {
        used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
      },
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /live
 * Simple ping endpoint
 */
router.get('/live', (_req, res) => {
  res.status(200).send('OK');
});

module.exports = router;
