import { useCallback, useEffect, useState } from 'react';
import './App.css';

// Empty by default: requests go to this origin and Vite (dev) or nginx (prod)
// proxies them to the API.
const API_BASE = import.meta.env.VITE_API_URL ?? '';
const API_LABEL = API_BASE || 'same-origin proxy';

const ROUTES = [
  { id: 'btn-health', path: '/healthz', method: 'GET', label: 'GET /healthz' },
  { id: 'btn-ready', path: '/ready', method: 'GET', label: 'GET /ready' },
  { id: 'btn-info', path: '/api/info', method: 'GET', label: 'GET /api/info' },
  { id: 'btn-metrics', path: '/api/metrics', method: 'GET', label: 'GET /api/metrics' },
  { id: 'btn-echo', path: '/api/echo', method: 'POST', label: 'POST /api/echo' },
];

/**
 * Plain async function that touches no React state, so the mount effect can
 * await it and update state once instead of calling setState synchronously in
 * the effect body — which triggers cascading renders.
 */
async function requestRoute(route) {
  try {
    const init = { method: route.method };
    if (route.method === 'POST') {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify({
        message: 'Hello from the React frontend!',
        timestamp: new Date().toISOString(),
      });
    }

    const res = await fetch(`${API_BASE}${route.path}`, init);
    const data = await res.json();
    return `// HTTP ${res.status} OK\n${JSON.stringify(data, null, 2)}`;
  } catch (err) {
    return `// Connection error on ${route.path}:\n${err.message}`;
  }
}

export default function App() {
  const [activeRoute, setActiveRoute] = useState(ROUTES[0].path);
  const [response, setResponse] = useState('Loading endpoint data...');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    requestRoute(ROUTES[0]).then((body) => {
      if (!cancelled) {
        setResponse(body);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleClick = useCallback(async (route) => {
    setActiveRoute(route.path);
    setLoading(true);
    setResponse(await requestRoute(route));
    setLoading(false);
  }, []);

  return (
    <div className="container">
      <div className="card" id="app-card">
        <div className="header">
          <h1 id="app-title">🏛️ La Plateforme Fullstack Starter</h1>
          <p className="subtitle">React + Vite frontend connected to Backend API ({API_LABEL})</p>
          <div className="status-badge" id="status-badge">
            <span className="pulse" /> System Operational
          </div>
        </div>

        <div className="grid">
          <div className="item">
            <label>Backend API</label>
            <div id="backend-status">Connected</div>
          </div>
          <div className="item">
            <label>Frontend Client</label>
            <div id="frontend-status">React + Vite SPA</div>
          </div>
          <div className="item">
            <label>Security</label>
            <div id="security-status">Helmet + CORS</div>
          </div>
          <div className="item">
            <label>Testing Suite</label>
            <div id="testing-status">Unit + Integ + E2E</div>
          </div>
        </div>

        <div className="tester-section">
          <div className="tester-header">
            <div className="tester-title">⚡ Live Backend Endpoint Explorer</div>
            <span className="tester-subtitle">Test live API calls from React</span>
          </div>

          <div className="route-buttons">
            {ROUTES.map((route) => (
              <button
                key={route.id}
                id={route.id}
                className={`route-btn ${activeRoute === route.path ? 'active' : ''}`}
                onClick={() => handleClick(route)}
              >
                {route.label}
              </button>
            ))}
          </div>

          <pre className="response-box" id="response-output">
            {loading ? 'Fetching...' : response}
          </pre>
        </div>
      </div>
    </div>
  );
}
