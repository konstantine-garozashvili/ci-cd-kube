<template>
  <div class="container">
    <div class="card" id="app-card">
      <div class="header">
        <img class="brand-logo" src="/logo.png" alt="La Plateforme" />
        <h1 id="app-title">Fullstack Starter</h1>
        <p class="subtitle">Vue 3 + Vite Frontend connected to Backend API ({{ apiLabel }})</p>
        <div
          class="status-badge"
          :class="env ? (env.ok ? 'is-ok' : 'is-bad') : 'is-pending'"
          id="status-badge"
        >
          <template v-if="!env">Checking environment…</template>
          <template v-else-if="env.ok"><span class="pulse"></span> Environment is working</template>
          <template v-else>⚠ Environment needs attention</template>
        </div>
      </div>

      <div class="grid" id="env-checks">
        <div
          v-for="row in env ? env.rows : []"
          :key="row.label"
          class="item"
          :class="row.ok ? 'ok' : 'bad'"
        >
          <label>{{ row.ok ? '✅' : '❌' }} {{ row.label }}</label>
          <div>{{ row.detail }}</div>
        </div>
        <div v-if="!env" class="item">
          <label>Running checks…</label>
          <div>probing /healthz, /ready and /api/info</div>
        </div>
      </div>

      <div class="tester-section">
        <div class="tester-header">
          <div class="tester-title">⚡ Live Backend Endpoint Explorer</div>
          <span class="tester-subtitle">Test live API calls from Vue 3</span>
        </div>

        <div class="route-buttons">
          <button
            :class="['route-btn', { active: activeRoute === '/healthz' }]"
            id="btn-health"
            @click="fetchRoute('/healthz')"
          >
            GET /healthz
          </button>
          <button
            :class="['route-btn', { active: activeRoute === '/ready' }]"
            id="btn-ready"
            @click="fetchRoute('/ready')"
          >
            GET /ready
          </button>
          <button
            :class="['route-btn', { active: activeRoute === '/api/info' }]"
            id="btn-info"
            @click="fetchRoute('/api/info')"
          >
            GET /api/info
          </button>
          <button
            :class="['route-btn', { active: activeRoute === '/api/metrics' }]"
            id="btn-metrics"
            @click="fetchRoute('/api/metrics')"
          >
            GET /api/metrics
          </button>
          <button
            :class="['route-btn', { active: activeRoute === '/api/echo' }]"
            id="btn-echo"
            @click="fetchPostRoute('/api/echo')"
          >
            POST /api/echo
          </button>
        </div>

        <pre class="response-box" id="response-output">{{
          loading ? 'Fetching...' : response
        }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { runEnvironmentCheck } from './environmentCheck';

// Empty by default: requests go to this origin and Vite (dev) or nginx (prod) proxies them to the API.
const apiBase = import.meta.env.VITE_API_URL ?? '';
const apiLabel = apiBase || 'same-origin proxy';
const activeRoute = ref('/healthz');
const response = ref('Loading endpoint data...');
const loading = ref(false);

const fetchRoute = async (path) => {
  activeRoute.value = path;
  loading.value = true;
  try {
    const res = await fetch(`${apiBase}${path}`);
    const data = await res.json();
    response.value = `// HTTP ${res.status} OK\n` + JSON.stringify(data, null, 2);
  } catch (err) {
    response.value = `// Connection Error to ${apiBase}${path}:\n` + err.message;
  } finally {
    loading.value = false;
  }
};

const fetchPostRoute = async (path) => {
  activeRoute.value = path;
  loading.value = true;
  try {
    const res = await fetch(`${apiBase}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Hello from Vue 3 Frontend!',
        timestamp: new Date().toISOString(),
      }),
    });
    const data = await res.json();
    response.value = `// HTTP ${res.status} OK\n` + JSON.stringify(data, null, 2);
  } catch (err) {
    response.value = `// Connection Error to ${apiBase}${path}:\n` + err.message;
  } finally {
    loading.value = false;
  }
};

const env = ref(null);

onMounted(() => {
  runEnvironmentCheck(apiBase).then((result) => {
    env.value = result;
  });
  fetchRoute('/healthz');
});
</script>

<style>
:root {
  --bg-dark: #080c14;
  --card-bg: #0f172a;
  --border-color: #1e293b;
  --accent-blue: #38bdf8;
  --accent-green: #22c55e;
  --text-main: #f8fafc;
  --text-muted: #94a3b8;
}
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
body {
  font-family: 'Inter', sans-serif;
  background: var(--bg-dark);
  color: var(--text-main);
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 2rem 1.5rem;
}
.container {
  max-width: 780px;
  width: 100%;
}
.card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 2.2rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
}
.header {
  text-align: center;
  margin-bottom: 2rem;
}
h1 {
  font-family: 'Outfit', sans-serif;
  font-size: 2.2rem;
  font-weight: 800;
  background: linear-gradient(135deg, #38bdf8, #818cf8, #c084fc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 0.5rem;
}
.subtitle {
  color: var(--text-muted);
  font-size: 1rem;
}
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(34, 197, 94, 0.1);
  color: var(--accent-green);
  border: 1px solid rgba(34, 197, 94, 0.25);
  padding: 0.35rem 0.9rem;
  border-radius: 9999px;
  font-family: 'Fira Code', monospace;
  font-size: 0.85rem;
  margin-top: 0.85rem;
}
.pulse {
  width: 8px;
  height: 8px;
  background: var(--accent-green);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--accent-green);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.85rem;
  margin-bottom: 2rem;
}
.item {
  background: #1e293b;
  padding: 0.85rem 1rem;
  border-radius: 10px;
  border: 1px solid #334155;
}
.brand-logo {
  display: block;
  height: 48px;
  width: auto;
  max-width: 100%;
  margin: 0 auto 1rem;
}
.status-badge.is-ok {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}
.status-badge.is-bad {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}
.status-badge.is-pending {
  background: rgba(100, 116, 139, 0.15);
  color: #94a3b8;
}
.item.ok {
  border-left: 3px solid #22c55e;
}
.item.bad {
  border-left: 3px solid #ef4444;
}
.item label {
  font-size: 0.72rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}
.item div {
  font-family: 'Fira Code', monospace;
  font-size: 0.9rem;
  color: #f1f5f9;
  margin-top: 0.2rem;
}
.tester-section {
  background: #020617;
  border: 1px solid #1e293b;
  border-radius: 12px;
  padding: 1.25rem;
  margin-top: 1rem;
}
.tester-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.tester-title {
  font-family: 'Outfit', sans-serif;
  font-weight: 600;
  font-size: 1.1rem;
  color: #f8fafc;
}
.tester-subtitle {
  font-size: 0.8rem;
  color: var(--text-muted);
}
.route-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.route-btn {
  background: #1e293b;
  border: 1px solid #334155;
  color: #e2e8f0;
  padding: 0.45rem 0.85rem;
  border-radius: 6px;
  font-family: 'Fira Code', monospace;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.15s ease;
}
.route-btn:hover {
  background: #334155;
  color: var(--accent-blue);
  border-color: var(--accent-blue);
}
.route-btn.active {
  background: rgba(56, 189, 248, 0.15);
  border-color: var(--accent-blue);
  color: var(--accent-blue);
}
.response-box {
  background: #090d16;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 1rem;
  font-family: 'Fira Code', monospace;
  font-size: 0.82rem;
  color: #38bdf8;
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
}
</style>
