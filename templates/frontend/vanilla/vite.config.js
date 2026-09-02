import { defineConfig } from 'vite';

/**
 * Every backend route is proxied through the dev server, so the browser only
 * ever talks to one origin. That keeps CORS out of local development and makes
 * the dev setup match the nginx container, where the same paths are proxied.
 */
const API_TARGET = process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000';
const proxied = ['/api', '/healthz', '/ready', '/live'];

export default defineConfig({
  server: {
    port: Number(process.env.PORT) || 5173,
    host: true,
    proxy: Object.fromEntries(
      proxied.map((route) => [route, { target: API_TARGET, changeOrigin: true }])
    ),
  },
  preview: {
    port: Number(process.env.PORT) || 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
