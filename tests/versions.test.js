const { BASELINE, CONSTRAINED, majorOf, isPrerelease, resolveVersions } = require('../lib/versions');
const { buildOptions } = require('../lib/options');
const {
  generateRootPackageJson,
  generateBackendPackageJson,
  generateFrontendPackageJson,
} = require('../lib/generators/manifest');
const { BACKENDS, FRONTENDS, DATABASES } = require('../lib/constants');

describe('version helpers', () => {
  it.each([
    ['19.2.8', 19],
    ['^9.39.5', 9],
    ['~6.0.3', 6],
  ])('majorOf(%s) is %i', (input, expected) => {
    expect(majorOf(input)).toBe(expected);
  });

  it.each(['8.0.0-rc.12', '7.0.0-beta.1', '19.0.0-canary-abc'])(
    'treats %s as a prerelease',
    (version) => {
      expect(isPrerelease(version)).toBe(true);
    }
  );

  it.each(['19.2.8', '6.0.3', '1.62.1'])('treats %s as stable', (version) => {
    expect(isPrerelease(version)).toBe(false);
  });
});

describe('BASELINE', () => {
  it('gives every package a concrete semver range', () => {
    for (const [name, range] of Object.entries(BASELINE)) {
      expect(`${name}: ${range}`).toMatch(/: [~^]\d+\.\d+\.\d+$/);
    }
  });

  it('never ships a prerelease', () => {
    const prereleases = Object.entries(BASELINE)
      .filter(([, range]) => isPrerelease(range))
      .map(([name]) => name);
    expect(prereleases).toEqual([]);
  });

  it('stays within every declared ceiling', () => {
    const violations = Object.entries(CONSTRAINED)
      .filter(([name, ceiling]) => majorOf(BASELINE[name]) > ceiling.max)
      .map(([name]) => name);
    expect(violations).toEqual([]);
  });

  it('documents a reason for every ceiling, so pins can be revisited', () => {
    for (const [name, ceiling] of Object.entries(CONSTRAINED)) {
      expect(BASELINE[name]).toBeDefined();
      expect(typeof ceiling.max).toBe('number');
      expect(ceiling.reason.length).toBeGreaterThan(20);
    }
  });
});

describe('resolveVersions', () => {
  it('returns the baseline untouched when latest is not requested', async () => {
    const result = await resolveVersions({ latest: false });
    expect(result.versions).toEqual(BASELINE);
    expect(result.updated).toEqual([]);
  });
});

/**
 * The point of routing every version through one map is that no generator can
 * reintroduce a hardcoded version behind its back.
 */
describe('generated manifests source every version from the map', () => {
  const combinations = BACKENDS.filter((b) => b !== 'none').flatMap((backend) =>
    FRONTENDS.flatMap((frontend) =>
      DATABASES.map((database) => ({ backend, frontend, database }))
    )
  );

  const sentinel = Object.fromEntries(
    Object.keys(BASELINE).map((name) => [name, '^0.0.0-sentinel'])
  );

  it.each(combinations)(
    '$backend + $frontend + $database uses no literal versions',
    (combination) => {
      const options = {
        ...buildOptions({ targetPath: '/tmp/demo', name: 'demo', ...combination }),
        versions: sentinel,
      };

      const manifests = [generateRootPackageJson(options)];
      if (options.isFullstack) {
        manifests.push(generateBackendPackageJson(options), generateFrontendPackageJson(options));
      }

      for (const manifest of manifests) {
        const declared = { ...manifest.dependencies, ...manifest.devDependencies };
        for (const [name, range] of Object.entries(declared)) {
          expect(`${name}=${range}`).toBe(`${name}=^0.0.0-sentinel`);
        }
      }
    }
  );
});
