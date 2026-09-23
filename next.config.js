/**
 * Next.js configuration.
 *
 * On Vercel, vercel.json sends /api/v1/* to the Python function. In local
 * development the API runs as its own server (uvicorn, port 8000), so the
 * same path is rewritten to it here; PRISM_LOCAL_API_URL points elsewhere if
 * needed. A production build leaves the rewrite to vercel.json.
 *
 * @type {import('next').NextConfig}
 */
const LOCAL_API_URL = process.env.PRISM_LOCAL_API_URL || 'http://127.0.0.1:8000';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    if (process.env.NODE_ENV === 'production') return [];
    return [{ source: '/api/v1/:path*', destination: `${LOCAL_API_URL}/api/v1/:path*` }];
  },
};

module.exports = nextConfig;
