const config = require('../../src/config');

describe('Unit: configuration module', () => {
  it('exposes a numeric port', () => {
    expect(typeof config.port).toBe('number');
    expect(config.port).toBeGreaterThan(0);
  });

  it('derives application metadata without requiring a .env file', () => {
    expect(config.appName).toBeTruthy();
    expect(config.appVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(config.env).toBeTruthy();
  });

  it('defines positive rate-limit parameters', () => {
    expect(config.rateLimit.windowMs).toBeGreaterThan(0);
    expect(config.rateLimit.max).toBeGreaterThan(0);
  });

  it('falls back to safe defaults when env values are unparseable', () => {
    jest.resetModules();
    const previous = process.env.RATE_LIMIT_MAX_REQUESTS;
    process.env.RATE_LIMIT_MAX_REQUESTS = 'not-a-number';
    const reloaded = require('../../src/config');
    expect(reloaded.rateLimit.max).toBe(100);
    process.env.RATE_LIMIT_MAX_REQUESTS = previous;
  });
});
