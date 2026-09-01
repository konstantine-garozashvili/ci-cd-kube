import { NextResponse, type NextRequest } from 'next/server';

/**
 * Same-origin proxy to the backend API.
 *
 * This lives in middleware rather than in `next.config.mjs` rewrites on
 * purpose: rewrite destinations are serialised into the routes manifest at
 * *build* time, so a containerised app would keep proxying to whatever the URL
 * was when the image was built and ignore API_PROXY_TARGET entirely. Middleware
 * is evaluated per request, so the same image works in development, in compose
 * and in production without a rebuild.
 */
const API_TARGET = process.env.API_PROXY_TARGET || 'http://localhost:3000';

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  return NextResponse.rewrite(new URL(`${pathname}${search}`, API_TARGET));
}

export const config = {
  matcher: ['/api/:path*', '/healthz', '/ready', '/live'],
};
