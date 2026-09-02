'use strict';

// Colour codes are disabled when output is piped or NO_COLOR is set, so logs
// and CI transcripts stay readable.
const enabled = process.stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== 'dumb';

const code = (value) => (enabled ? value : '');

const colors = {
  reset: code('\x1b[0m'),
  bright: code('\x1b[1m'),
  dim: code('\x1b[2m'),
  red: code('\x1b[31m'),
  green: code('\x1b[32m'),
  yellow: code('\x1b[33m'),
  blue: code('\x1b[34m'),
  magenta: code('\x1b[35m'),
  cyan: code('\x1b[36m'),
};

function banner() {
  return `
${colors.cyan}${colors.bright}┌──────────────────────────────────────────────────────────────────┐
│  🏛️  LA PLATEFORME — DevSecOps Project Scaffolder                 │
│  Security, CI/CD, tests and containers, working from commit one  │
└──────────────────────────────────────────────────────────────────┘${colors.reset}
`;
}

const success = (message) => `  ${colors.green}✔${colors.reset} ${message}`;
const warning = (message) => `  ${colors.yellow}⚠${colors.reset} ${message}`;
const failure = (message) => `  ${colors.red}✗${colors.reset} ${message}`;

module.exports = { colors, banner, success, warning, failure };
