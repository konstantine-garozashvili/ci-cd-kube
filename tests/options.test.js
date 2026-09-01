const path = require('path');
const { validateProjectName, normaliseProjectName, buildOptions } = require('../lib/options');

describe('validateProjectName', () => {
  it.each([
    ['my-app', 'my-app'],
    ['My App', 'my-app'],
    ['My_Cool_API', 'my-cool-api'],
    ['app123', 'app123'],
  ])('normalises %s to a valid npm name', (input, expected) => {
    expect(validateProjectName(input)).toEqual({ ok: true, name: expected });
  });

  it('accepts "." as the current directory', () => {
    expect(validateProjectName('.')).toEqual({ ok: true, name: '.' });
  });

  it.each(['../evil', 'foo/bar', 'a\\b'])('rejects the path-like name %s', (input) => {
    expect(validateProjectName(input).ok).toBe(false);
  });

  it.each(['', '   ', '!!!', 'node_modules'])('rejects %p', (input) => {
    expect(validateProjectName(input).ok).toBe(false);
  });

  it('truncates absurdly long names to npm’s 214 character limit', () => {
    expect(normaliseProjectName('a'.repeat(500))).toHaveLength(214);
  });
});

describe('buildOptions', () => {
  const base = { targetPath: '/tmp/demo', name: 'demo' };

  it('treats a project with a frontend as a monorepo', () => {
    const options = buildOptions({
      ...base,
      backend: 'express',
      frontend: 'react',
      database: 'postgres',
    });

    expect(options.isFullstack).toBe(true);
    expect(options.backendDir).toBe('backend');
    expect(options.dockerTargets.map((t) => t.dockerfile)).toEqual([
      'backend/Dockerfile',
      'frontend/Dockerfile',
    ]);
  });

  it('keeps an API-only project as a single package', () => {
    const options = buildOptions({
      ...base,
      backend: 'hono',
      frontend: 'none',
      database: 'none',
    });

    expect(options.isFullstack).toBe(false);
    expect(options.backendDir).toBe('.');
    expect(options.dockerTargets).toEqual([{ service: 'backend', dockerfile: 'Dockerfile' }]);
    expect(options.sastPaths).toBe('src');
  });

  it('points Semgrep at directories that the chosen frontend actually creates', () => {
    const forNext = buildOptions({
      ...base,
      backend: 'nestjs',
      frontend: 'nextjs',
      database: 'none',
    });
    expect(forNext.sastPaths).toBe('backend/src frontend/app');

    const forVanilla = buildOptions({
      ...base,
      backend: 'express',
      frontend: 'vanilla',
      database: 'none',
    });
    expect(forVanilla.sastPaths).toBe('backend/src frontend');
  });

  it('derives the package name from the directory when scaffolding into "."', () => {
    const options = buildOptions({
      targetPath: path.join('/tmp', 'My Project'),
      name: '.',
      backend: 'express',
      frontend: 'none',
      database: 'none',
    });

    expect(options.projectName).toBe('my-project');
  });

  it('rejects unknown choices rather than silently falling back', () => {
    expect(() =>
      buildOptions({ ...base, backend: 'rails', frontend: 'react', database: 'none' })
    ).toThrow(/Unknown backend/);
  });

  it('refuses to scaffold nothing at all', () => {
    expect(() =>
      buildOptions({ ...base, backend: 'none', frontend: 'none', database: 'none' })
    ).toThrow(/at least a backend or a frontend/);
  });
});
