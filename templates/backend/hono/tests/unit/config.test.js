import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../../src/config.js';

describe('Unit: configuration module', () => {
  test('exposes a numeric port', () => {
    assert.equal(typeof config.port, 'number');
    assert.ok(config.port > 0);
  });

  test('exposes application metadata', () => {
    assert.ok(config.appName);
    assert.match(config.appVersion, /^\d+\.\d+\.\d+/);
  });

  test('defines positive rate-limit parameters', () => {
    assert.ok(config.rateLimit.windowMs > 0);
    assert.ok(config.rateLimit.max > 0);
  });
});
