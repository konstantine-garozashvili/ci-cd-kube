import 'dotenv/config';

function integer(value, fallback) {
  const parsed = parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: integer(process.env.PORT, 3000),
  appName: process.env.APP_NAME || 'backend',
  appVersion: process.env.APP_VERSION || '1.0.0',
  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : '*',
  rateLimit: {
    windowMs: integer(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: integer(process.env.RATE_LIMIT_MAX_REQUESTS, 100),
  },
  startTime: new Date().toISOString(),
};
