/**
 * Database adapter — no database configured.
 *
 * Every adapter in this project exposes the same three functions so that
 * `src/server.js` and the readiness probe stay identical regardless of which
 * database (if any) was selected at scaffold time.
 */

async function connectDatabase() {
  return null;
}

async function disconnectDatabase() {
  return null;
}

async function checkDatabaseHealth() {
  return { status: 'NOT_CONFIGURED' };
}

module.exports = { connectDatabase, disconnectDatabase, checkDatabaseHealth };
