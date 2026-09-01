const path = require('path');

require('dotenv').config();

/**
 * Falls back to the package name so a freshly scaffolded project reports a
 * sensible identity even before anyone edits .env.
 */
function packageField(field, fallback) {
  try {
    return require(path.join(__dirname, '..', '..', 'package.json'))[field] || fallback;
  } catch {
    return fallback;
  }
}

function integer(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: integer(process.env.PORT, 3000),
  appName: process.env.APP_NAME || packageField('name', 'backend'),
  appVersion: process.env.APP_VERSION || packageField('version', '1.0.0'),
  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
      : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  },
  rateLimit: {
    windowMs: integer(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: integer(process.env.RATE_LIMIT_MAX_REQUESTS, 100),
  },
  startTime: new Date().toISOString(),
};

module.exports = config;
