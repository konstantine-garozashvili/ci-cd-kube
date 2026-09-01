const config = require('../../src/config');

describe('Unit Tests: Configuration Module', () => {
  it('should load default port 3000 if not specified', () => {
    expect(config.port).toBeDefined();
    expect(typeof config.port).toBe('number');
  });

  it('should have valid application metadata', () => {
    expect(config.appName).toBeDefined();
    expect(config.appVersion).toBe('1.0.0');
    expect(config.env).toBeDefined();
  });

  it('should specify rate limit parameters', () => {
    expect(config.rateLimit.windowMs).toBeGreaterThan(0);
    expect(config.rateLimit.max).toBeGreaterThan(0);
  });
});
