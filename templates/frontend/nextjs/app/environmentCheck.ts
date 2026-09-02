/**
 * Runs the checks that answer "is my environment actually working?".
 *
 * The landing page used to assert "Connected" and "System Operational" as
 * static text, which said the same thing whether or not anything was running.
 * This probes the real endpoints and reports what came back, so a broken
 * database or an unreachable API is visible on the page instead of hidden
 * behind a green badge.
 */

export type CheckRow = {
  label: string;
  ok: boolean;
  detail: string;
};

export type EnvironmentReport = {
  ok: boolean;
  rows: CheckRow[];
};

export async function runEnvironmentCheck(apiBase = ''): Promise<EnvironmentReport> {
  const rows: CheckRow[] = [];
  let ok = true;

  // Liveness — is the process up and serving?
  try {
    const res = await fetch(`${apiBase}/healthz`);
    const body = await res.json();
    rows.push({
      label: 'API server',
      ok: res.ok,
      detail: res.ok
        ? `HTTP ${res.status} · ${body.service ?? 'api'} v${body.version ?? '?'} · up ${Math.round(body.uptime ?? 0)}s`
        : `HTTP ${res.status}`,
    });
    if (!res.ok) ok = false;
  } catch (err) {
    rows.push({
      label: 'API server',
      ok: false,
      detail: `unreachable — ${(err as Error).message}`,
    });
    ok = false;
  }

  // Readiness — is it able to serve traffic, including its dependencies?
  try {
    const res = await fetch(`${apiBase}/ready`);
    const body = await res.json();

    rows.push({
      label: 'Readiness probe',
      ok: res.ok,
      detail: `HTTP ${res.status} · ${body.status ?? 'unknown'}`,
    });
    if (!res.ok) ok = false;

    const db = body.checks?.database;
    if (db) {
      // A project scaffolded without a database is healthy with no database;
      // that is a pass, not a warning.
      const configured = db.status !== 'NOT_CONFIGURED';
      const dbOk = !configured || db.status === 'UP';
      rows.push({
        label: 'Database',
        ok: dbOk,
        detail: configured
          ? `${db.status}${db.latencyMs != null ? ` · ${db.latencyMs}ms` : ''}`
          : 'not configured for this project',
      });
      if (!dbOk) ok = false;
    }

    const mem = body.checks?.memory;
    if (mem) {
      rows.push({
        label: 'Memory',
        ok: true,
        detail: `${mem.usedMb}MB used of ${mem.totalMb}MB heap`,
      });
    }
  } catch (err) {
    rows.push({
      label: 'Readiness probe',
      ok: false,
      detail: `unreachable — ${(err as Error).message}`,
    });
    ok = false;
  }

  // The API surface the frontend actually consumes.
  try {
    const res = await fetch(`${apiBase}/api/info`);
    rows.push({
      label: 'API routes',
      ok: res.ok,
      detail: `GET /api/info → HTTP ${res.status}`,
    });
    if (!res.ok) ok = false;
  } catch (err) {
    rows.push({
      label: 'API routes',
      ok: false,
      detail: `unreachable — ${(err as Error).message}`,
    });
    ok = false;
  }

  return { ok, rows };
}
