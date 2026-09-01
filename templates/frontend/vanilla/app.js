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
