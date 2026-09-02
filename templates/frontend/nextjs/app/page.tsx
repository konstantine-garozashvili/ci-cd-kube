'use client';

import { useCallback, useEffect, useState } from 'react';
import { runEnvironmentCheck, type EnvironmentReport } from './environmentCheck';

type Route = { id: string; path: string; method: 'GET' | 'POST'; label: string };

// Requests are relative: next.config.mjs rewrites them to the backend.
const ROUTES: Route[] = [
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
async function requestRoute(route: Route): Promise<string> {
  try {
    const init: RequestInit = { method: route.method };
    if (route.method === 'POST') {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify({
        message: 'Hello from the Next.js frontend!',
        timestamp: new Date().toISOString(),
      });
    }
    const res = await fetch(route.path, init);
    const data = await res.json();
    return `// HTTP ${res.status} OK\n${JSON.stringify(data, null, 2)}`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `// Connection error on ${route.path}:\n${message}`;
  }
}

export default function Home() {
  const [activeRoute, setActiveRoute] = useState(ROUTES[0].path);
  const [response, setResponse] = useState('Loading endpoint data...');
  const [loading, setLoading] = useState(true);
  const [env, setEnv] = useState<EnvironmentReport | null>(null);

  useEffect(() => {
    let cancelled = false;

    runEnvironmentCheck().then((result) => {
      if (!cancelled) {
        setEnv(result);
      }
    });

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

  const fetchRoute = useCallback(async (route: Route) => {
    setActiveRoute(route.path);
    setLoading(true);
    setResponse(await requestRoute(route));
    setLoading(false);
  }, []);

  return (
    <div className="container">
      <div className="card" id="app-card">
        <div className="header">
          {/* eslint-disable-next-line @next/next/no-img-element -- a static
              7KB logo does not need the Image component's optimisation
              pipeline, which would pull in a loader for one asset. */}
          <img className="brand-logo" src="/logo.png" alt="La Plateforme" />
          <h1 id="app-title">Fullstack Starter</h1>
          <p className="subtitle">Next.js App Router frontend, API proxied same-origin</p>
          <div
            className={`status-badge ${env ? (env.ok ? 'is-ok' : 'is-bad') : 'is-pending'}`}
            id="status-badge"
          >
            {env ? (
              env.ok ? (
                <>
                  <span className="pulse" /> Environment is working
                </>
              ) : (
                <>⚠ Environment needs attention</>
              )
            ) : (
              <>Checking environment…</>
            )}
          </div>
        </div>

        <div className="grid" id="env-checks">
          {(env ? env.rows : []).map((row) => (
            <div className={`item ${row.ok ? 'ok' : 'bad'}`} key={row.label}>
              <label>
                {row.ok ? '✅' : '❌'} {row.label}
              </label>
              <div>{row.detail}</div>
            </div>
          ))}
          {!env && (
            <div className="item">
              <label>Running checks…</label>
              <div>probing /healthz, /ready and /api/info</div>
            </div>
          )}
        </div>

        <div className="tester-section">
          <div className="tester-header">
            <div className="tester-title">⚡ Live Backend Endpoint Explorer</div>
            <span className="tester-subtitle">Test live API calls from Next.js</span>
          </div>

          <div className="route-buttons">
            {ROUTES.map((route) => (
              <button
                key={route.id}
                id={route.id}
                className={`route-btn ${activeRoute === route.path ? 'active' : ''}`}
                onClick={() => fetchRoute(route)}
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
