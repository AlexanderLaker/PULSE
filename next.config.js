/** @type {import('next').NextConfig} */
//
// In production (Vercel) the `/api/v1/*` paths are rewritten to the
// Python serverless handler by `vercel.json`. In local development
// `npm run dev` runs Next.js on :3000 but the FastAPI engine runs
// separately on :8000, so we need a matching rewrite in Next.js so
// the dashboard's `fetch('/api/v1/...')` calls resolve. The target
// is configurable via PRISM_BACKEND_URL (default http://127.0.0.1:8000).
const BACKEND_URL =
  process.env.PRISM_BACKEND_URL || 'http://127.0.0.1:8000';

const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  async rewrites() {
    // Only proxy in dev — on Vercel `vercel.json` takes precedence.
    if (process.env.NODE_ENV === 'production' && !process.env.FORCE_DEV_PROXY) {
      return [];
    }
    return [
      { source: '/api/v1/:path*', destination: `${BACKEND_URL}/api/v1/:path*` },
      { source: '/api/py/:path*', destination: `${BACKEND_URL}/api/v1/:path*` },
    ];
  },
};

module.exports = nextConfig;
