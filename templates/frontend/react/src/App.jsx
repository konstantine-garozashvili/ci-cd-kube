import React, { useState, useEffect } from 'react';
import './App.css';

// Empty by default: requests go to this origin and Vite (dev) or nginx (prod) proxies them to the API.
const API_BASE = import.meta.env.VITE_API_URL ?? '';
const API_LABEL = API_BASE || 'same-origin proxy';

export default function App() {
  const [activeRoute, setActiveRoute] = useState('/healthz');
  const [response, setResponse] = useState('Loading endpoint data...');
  const [loading, setLoading] = useState(false);

  const fetchRoute = async (path, method = 'GET', body = null) => {
    setActiveRoute(path);
    setLoading(true);
    setResponse(`// Requesting ${method} ${API_BASE}${path}...`);
    try {
      const opts = { method, headers: { 'Content-Type': 'application/json' } };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(`${API_BASE}${path}`, opts);
      const data = await res.json();
      setResponse(`// HTTP ${res.status} OK\n` + JSON.stringify(data, null, 2));
    } catch (err) {
      setResponse(`// Connection Error to ${API_BASE}${path}:\n` + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoute('/healthz');
  }, []);

  return (
    <div className="container">
      <div className="card" id="app-card">
        <div className="header">
          <h1 id="app-title">🏛️ La Plateforme Fullstack Starter</h1>
          <p className="subtitle">React + Vite Frontend connected to Backend API ({API_LABEL})</p>
          <div className="status-badge" id="status-badge">
            <span className="pulse"></span> System Operational
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
            <button
              className={`route-btn ${activeRoute === '/healthz' ? 'active' : ''}`}
              id="btn-health"
              onClick={() => fetchRoute('/healthz')}
            >
              GET /healthz
            </button>
            <button
              className={`route-btn ${activeRoute === '/ready' ? 'active' : ''}`}
              id="btn-ready"
              onClick={() => fetchRoute('/ready')}
            >
              GET /ready
            </button>
            <button
              className={`route-btn ${activeRoute === '/api/info' ? 'active' : ''}`}
              id="btn-info"
              onClick={() => fetchRoute('/api/info')}
            >
              GET /api/info
            </button>
            <button
              className={`route-btn ${activeRoute === '/api/metrics' ? 'active' : ''}`}
              id="btn-metrics"
              onClick={() => fetchRoute('/api/metrics')}
            >
              GET /api/metrics
            </button>
            <button
              className={`route-btn ${activeRoute === '/api/echo' ? 'active' : ''}`}
              id="btn-echo"
              onClick={() =>
                fetchRoute('/api/echo', 'POST', {
                  message: 'Hello from React Frontend!',
                  timestamp: new Date().toISOString(),
                })
              }
            >
              POST /api/echo
            </button>
          </div>

          <pre className="response-box" id="response-output">
            {loading ? 'Fetching...' : response}
          </pre>
        </div>
      </div>
    </div>
  );
}
