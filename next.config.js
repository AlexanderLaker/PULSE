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
  // Next.js would otherwise write a block of agent rules into the tracked
  // CLAUDE.md on every `next dev`, which leaves the tree dirty and fails the
  // repository's own copy tests.
  agentRules: false,
  // The dashboard uses no next/image, so the image optimiser stays off and
  // its endpoint offers nothing to fetch.
  images: { unoptimized: true },
  async rewrites() {
    if (process.env.NODE_ENV === 'production') return [];
    return [{ source: '/api/v1/:path*', destination: `${LOCAL_API_URL}/api/v1/:path*` }];
  },
};

module.exports = nextConfig;
