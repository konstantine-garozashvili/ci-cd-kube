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

/**
 * Express's "trust proxy" accepts a hop count, a boolean, or a named preset
 * such as "loopback", so all three spellings are honoured here.
 */
function trustProxy(value) {
  if (value === undefined || value === '') {
    return false;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  const hops = Number.parseInt(value, 10);
  return Number.isFinite(hops) ? hops : value;
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
  // How many proxy hops sit in front of this service. Required when a proxy
  // adds X-Forwarded-For: express-rate-limit refuses to run otherwise, because
  // it cannot tell a real client apart from a spoofed header.
  trustProxy: trustProxy(process.env.TRUST_PROXY),
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
