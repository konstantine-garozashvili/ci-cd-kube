const express = require('express');
const router = express.Router();
const config = require('../config');

/**
 * GET /api/info
 * Application information and metadata
 */
router.get('/info', (_req, res) => {
  res.status(200).json({
    name: config.appName,
    version: config.appVersion,
    environment: config.env,
    nodeVersion: process.version,
    platform: process.platform,
    startedAt: config.startTime,
  });
});

/**
 * GET /api/metrics
 * Basic system & request metrics
 */
router.get('/metrics', (_req, res) => {
  const memory = process.memoryUsage();
  res.status(200).json({
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

/**
 * POST /api/echo
 * Echo endpoint with payload validation for integration & E2E testing
 */
router.post('/echo', (req, res) => {
  const payload = req.body;
  if (!payload || Object.keys(payload).length === 0) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: 'Request body must not be empty',
    });
  }

  res.status(200).json({
    received: payload,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
