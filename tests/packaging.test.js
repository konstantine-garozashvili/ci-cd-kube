const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

/**
 * npm quietly drops some filenames from a published tarball — most notably any
 * file called ".gitignore". A template that survives locally but vanishes on
 * publish produces broken projects for everyone who installs from npm and
 * nobody who runs from a clone, so assert the packed contents directly.
 */
describe('published package contents', () => {
  const packed = JSON.parse(
    execFileSync('npm', ['pack', '--dry-run', '--json'], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  );

  const shipped = new Set(packed[0].files.map((file) => file.path));

  function listTemplateFiles(dir, prefix) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const relative = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        return listTemplateFiles(path.join(dir, entry.name), relative);
      }
      return [relative];
    });
  }

  const templateFiles = listTemplateFiles(path.join(REPO_ROOT, 'templates'), 'templates');

  it('ships the brand asset the landing pages reference', () => {
    expect(shipped.has('templates/shared/brand/logo.png')).toBe(true);
  });

  it('ships every file under templates/', () => {
    const missing = templateFiles.filter((file) => !shipped.has(file));
    expect(missing).toEqual([]);
  });

  it('ships the CLI, the library and the licence', () => {
    for (const file of ['bin/cli.js', 'lib/scaffold.js', 'lib/generators/ci.js', 'LICENSE']) {
      expect(shipped.has(file)).toBe(true);
    }
  });

  it('does not ship the scaffolder’s own tests or smoke script', () => {
    for (const file of [...shipped]) {
      expect(file).not.toMatch(/^tests\//);
      expect(file).not.toMatch(/^scripts\//);
    }
  });
});
