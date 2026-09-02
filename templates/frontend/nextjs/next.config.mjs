/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emits a self-contained server bundle so the runtime image can skip
  // node_modules entirely.
  output: 'standalone',
  reactStrictMode: true,
  // Playwright and local tooling reach the dev server over 127.0.0.1 rather
  // than localhost; Next.js 16 blocks cross-origin dev resources by default.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
};

// The API proxy lives in proxy.ts, not in rewrites: rewrite destinations are
// baked into the build output, which would ignore API_PROXY_TARGET at runtime
// and break the container.
export default nextConfig;
