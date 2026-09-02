/**
 * Live endpoint explorer.
 *
 * Handlers are attached with addEventListener rather than inline `onclick`
 * attributes: Helmet's Content-Security-Policy sets `script-src-attr 'none'`,
 * which blocks inline handlers outright. Wiring them up here keeps the strict
 * policy intact instead of loosening it to make the page work.
 */
const ROUTES = [
  { id: 'btn-health', path: '/healthz', method: 'GET' },
  { id: 'btn-ready', path: '/ready', method: 'GET' },
  { id: 'btn-info', path: '/api/info', method: 'GET' },
  { id: 'btn-metrics', path: '/api/metrics', method: 'GET' },
  { id: 'btn-echo', path: '/api/echo', method: 'POST' },
];

const output = document.getElementById('response-output');

function setActive(button) {
  document.querySelectorAll('.route-btn').forEach((el) => el.classList.remove('active'));
  button.classList.add('active');
}

async function callRoute(route, button) {
  if (button) {
    setActive(button);
  }
  output.innerText = `// ${route.method} ${route.path}…`;

  try {
    const init = { method: route.method };
    if (route.method === 'POST') {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify({
        message: 'Hello from the La Plateforme starter UI!',
        timestamp: new Date().toISOString(),
      });
    }

    const res = await fetch(route.path, init);
    const data = await res.json();
    output.innerText = `// HTTP ${res.status} OK\n${JSON.stringify(data, null, 2)}`;
  } catch (err) {
    output.innerText = `// Connection error on ${route.path}:\n${err.message}`;
  }
}

for (const route of ROUTES) {
  const button = document.getElementById(route.id);
  if (button) {
    button.addEventListener('click', () => callRoute(route, button));
  }
}

// Show the health payload on first paint.
callRoute(ROUTES[0], document.getElementById(ROUTES[0].id));

/**
 * Environment self-check.
 *
 * The header used to claim "System Operational (HTTP 200)" as static markup,
 * which said the same thing whether or not the server was reachable. These
 * rows are built from real responses, so a stopped database shows as DOWN.
 */
async function probe(label, path, describe) {
  try {
    const res = await fetch(path);
    const body = await res.json();
    return { label, ok: res.ok, detail: describe(res, body), body };
  } catch (err) {
    return { label, ok: false, detail: 'unreachable — ' + err.message, body: null };
  }
}

async function runEnvironmentCheck() {
  const rows = [];

  const live = await probe('API server', '/healthz', (res, body) =>
    res.ok
      ? 'HTTP ' + res.status + ' · ' + (body.service || 'api') + ' v' + (body.version || '?')
      : 'HTTP ' + res.status
  );
  rows.push(live);

  const ready = await probe(
    'Readiness probe',
    '/ready',
    (res, body) => 'HTTP ' + res.status + ' · ' + (body.status || 'unknown')
  );
  rows.push(ready);

  const db = ready.body && ready.body.checks && ready.body.checks.database;
  if (db) {
    // No database configured is a pass, not a warning.
    const configured = db.status !== 'NOT_CONFIGURED';
    rows.push({
      label: 'Database',
      ok: !configured || db.status === 'UP',
      detail: configured
        ? db.status + (db.latencyMs != null ? ' · ' + db.latencyMs + 'ms' : '')
        : 'not configured for this project',
    });
  }

  rows.push(
    await probe('API routes', '/api/info', (res) => 'GET /api/info → HTTP ' + res.status)
  );

  return { ok: rows.every((r) => r.ok), rows };
}

function renderEnvironmentCheck({ ok, rows }) {
  const badge = document.getElementById('status-badge');
  badge.className = 'status-badge ' + (ok ? 'is-ok' : 'is-bad');
  badge.textContent = ok ? '✅ Environment is working' : '⚠ Environment needs attention';

  const grid = document.getElementById('env-checks');
  grid.textContent = '';

  for (const row of rows) {
    const item = document.createElement('div');
    item.className = 'item ' + (row.ok ? 'ok' : 'bad');

    const label = document.createElement('label');
    label.textContent = (row.ok ? '✅ ' : '❌ ') + row.label;

    const detail = document.createElement('div');
    detail.textContent = row.detail;

    item.append(label, detail);
    grid.append(item);
  }
}

runEnvironmentCheck().then(renderEnvironmentCheck);
