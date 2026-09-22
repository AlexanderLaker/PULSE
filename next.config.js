/**
 * Next.js configuration.
 *
 * On Vercel, vercel.json sends /api/v1/* to the Python function. In local
 * development the API runs as its own server (uvicorn, port 8000), so the
 * same path is rewritten to it here; PRISM_BACKEND_URL points elsewhere if
 * needed. A production build leaves the rewrite to vercel.json.
 *
 * @type {import('next').NextConfig}
 */
const BACKEND_URL = process.env.PRISM_BACKEND_URL || 'http://127.0.0.1:8000';

const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  async rewrites() {
    if (process.env.NODE_ENV === 'production') return [];
    return [{ source: '/api/v1/:path*', destination: `${BACKEND_URL}/api/v1/:path*` }];
  },
};

module.exports = nextConfig;
