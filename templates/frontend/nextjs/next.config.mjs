/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emits a self-contained server bundle so the runtime image can skip
  // node_modules entirely.
  output: 'standalone',
  reactStrictMode: true,
};

// The API proxy lives in middleware.ts, not in rewrites: rewrite destinations
// are baked into the build output, which would ignore API_PROXY_TARGET at
// runtime and break the container.
export default nextConfig;
