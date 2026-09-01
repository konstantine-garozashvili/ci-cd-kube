/** @type {import('next').NextConfig} */

// Same-origin proxy to the API, so the browser never needs CORS and the
// frontend has no absolute backend URL baked into its bundle.
const API_TARGET = process.env.API_PROXY_TARGET || 'http://localhost:3000';

const nextConfig = {
  // Emits a self-contained server bundle so the runtime image can skip
  // node_modules entirely.
  output: 'standalone',
  reactStrictMode: true,
  async rewrites() {
    return ['/api/:path*', '/healthz', '/ready', '/live'].map((source) => ({
      source,
      destination: `${API_TARGET}${source}`,
    }));
  },
};

export default nextConfig;
