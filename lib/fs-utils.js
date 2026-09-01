'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage']);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/** Recursive copy that preserves dotfiles and executable bits. */
function copyDir(src, dest, { skip = [] } = {}) {
  ensureDir(dest);

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip.includes(entry.name)) {
      continue;
    }

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      copyDir(srcPath, destPath, { skip });
    } else if (entry.isFile()) {
      ensureDir(path.dirname(destPath));
      fs.copyFileSync(srcPath, destPath);
      // Hooks and scripts are useless without the executable bit.
      fs.chmodSync(destPath, fs.statSync(srcPath).mode & 0o777);
    }
  }
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function writeFile(dest, contents) {
  ensureDir(path.dirname(dest));
  const text = contents.endsWith('\n') ? contents : `${contents}\n`;
  fs.writeFileSync(dest, text, 'utf-8');
}

function writeJson(dest, value) {
  writeFile(dest, JSON.stringify(value, null, 2));
}

/** True when the directory does not exist or holds nothing but noise. */
function isEffectivelyEmpty(dir) {
  if (!fs.existsSync(dir)) {
    return true;
  }
  const ignorable = new Set(['.git', '.DS_Store', 'Thumbs.db']);
  return fs.readdirSync(dir).every((entry) => ignorable.has(entry));
}

/**
 * Runs a command and reports what actually happened.
 *
 * `spawnSync` does not throw on a non-zero exit — it returns a status code — so
 * wrapping it in try/catch silently reports failures as successes. This checks
 * both the spawn error (command missing) and the exit status.
 *
 * @returns {{ ok: boolean, reason?: string }}
 */
function run(command, args, cwd, { stdio = 'inherit', env } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio,
    env: env ? { ...process.env, ...env } : process.env,
    shell: process.platform === 'win32',
  });

  if (result.error) {
    const reason =
      result.error.code === 'ENOENT'
        ? `"${command}" is not installed or not on your PATH`
        : result.error.message;
    return { ok: false, reason };
  }

  if (result.status !== 0) {
    return { ok: false, reason: `${command} ${args.join(' ')} exited with code ${result.status}` };
  }

  return { ok: true };
}

function commandExists(command) {
  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], {
    stdio: 'ignore',
  });
  return probe.status === 0;
}

module.exports = {
  ensureDir,
  copyDir,
  copyFile,
  writeFile,
  writeJson,
  isEffectivelyEmpty,
  run,
  commandExists,
};
