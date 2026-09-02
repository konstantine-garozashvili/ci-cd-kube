import { configuration } from '../../src/config/configuration';

describe('Unit: configuration factory', () => {
  it('exposes a numeric port', () => {
    const config = configuration();
    expect(typeof config.port).toBe('number');
    expect(config.port).toBeGreaterThan(0);
  });

  it('falls back to safe defaults when env values are unparseable', () => {
    const previous = process.env.RATE_LIMIT_MAX_REQUESTS;
    process.env.RATE_LIMIT_MAX_REQUESTS = 'not-a-number';
    expect(configuration().rateLimit.max).toBe(100);
    process.env.RATE_LIMIT_MAX_REQUESTS = previous;
  });

  it('splits a comma separated CORS allowlist', () => {
    const previous = process.env.CORS_ORIGIN;
    process.env.CORS_ORIGIN = 'https://a.example, https://b.example';
    expect(configuration().corsOrigin).toEqual(['https://a.example', 'https://b.example']);
    process.env.CORS_ORIGIN = previous;
  });
});
