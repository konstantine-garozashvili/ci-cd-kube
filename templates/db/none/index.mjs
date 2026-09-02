/**
 * Database adapter — no database configured.
 *
 * Every adapter exposes the same three functions so the server bootstrap and
 * readiness probe stay identical regardless of which database was selected.
 */
export async function connectDatabase() {
  return null;
}

export async function disconnectDatabase() {
  return null;
}

export async function checkDatabaseHealth() {
  return { status: 'NOT_CONFIGURED' };
}
