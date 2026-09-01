const express = require('express');
const router = express.Router();
const config = require('../config');
const { checkDatabaseHealth } = require('../db');

/**
 * GET /healthz — Liveness probe.
 *
 * Answers "is this process alive?" only. It deliberately performs no dependency
 * checks: a liveness probe that fails on a database blip makes Kubernetes
 * restart a perfectly healthy container.
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
 * GET /ready — Readiness probe.
 *
 * Answers "can this instance serve traffic?" and therefore *does* check
 * dependencies. Returns 503 when a required dependency is down so the load
 * balancer removes this pod from rotation instead of sending it live traffic.
 */
router.get('/ready', async (_req, res) => {
  const database = await checkDatabaseHealth();
  const isReady = database.status === 'UP' || database.status === 'NOT_CONFIGURED';
  const memory = process.memoryUsage();

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'READY' : 'NOT_READY',
    checks: {
      database,
      memory: {
        usedMb: Math.round(memory.heapUsed / 1024 / 1024),
        totalMb: Math.round(memory.heapTotal / 1024 / 1024),
      },
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /live — Minimal plaintext ping for uptime checkers.
 */
router.get('/live', (_req, res) => {
  res.status(200).send('OK');
});

module.exports = router;
