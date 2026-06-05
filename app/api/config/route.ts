/**
 * GET/PUT /api/config — model configuration.
 *
 * Proxies to the Python FastAPI backend at /api/v1/config. We keep the
 * proxy in Next.js (rather than hitting /api/v1/config directly from the
 * browser) for three reasons:
 *
 *   1. Authorization — `PUT` must be admin-only. Enforcing that here
 *      means the Python serverless function can safely trust any request
 *      that reaches it (the rewrite path), and we don't have to ship
 *      Clerk verification logic into the Python layer.
 *   2. Audit — we capture who made the change (Clerk user ID + email)
 *      before forwarding, so the Python layer can write a proper audit
 *      entry keyed to a real user rather than "system".
 *   3. Content-type normalization — the frontend always talks JSON.
 *
 * The /api/v1/config endpoint lives in pulse/api/app.py. Vercel's
 * rewrite (vercel.json) sends /api/v1/* to the Python serverless
 * adapter. For local dev with `npm run dev`, the fetch goes to the same
 * path and Next.js proxies via its own rewrite.
 */
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { requireAuth, requireAdmin, ForbiddenError, UnauthorizedError } from '@/lib/roles';
import { signPrismJwt } from '@/lib/prismJwt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Resolve the backend base URL. In production this is the same origin
 *  (Vercel rewrites /api/v1/* to the Python function). Locally it falls
 *  back to BACKEND_URL (typically http://localhost:8000) so developers
 *  can run FastAPI on a different port during npm run dev. */
async function resolveBackendUrl(path: string): Promise<string> {
  const override = process.env.BACKEND_URL;
  if (override) return `${override.replace(/\/$/, '')}${path}`;
  // Same-origin — rely on Vercel's rewrite from /api/v1/* → api/index.py.
  const hdrs = await headers();
  const host = hdrs.get('host') ?? 'localhost:3000';
  const proto = hdrs.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}${path}`;
}

export async function GET() {
  try {
    const me = await requireAuth();
    const backendUrl = await resolveBackendUrl('/api/v1/config');
    // GET /api/v1/config is public on the Python side, but we still send
    // a bearer token so the backend's access log attributes the read to
    // the right user when it's later tightened.
    const token = signPrismJwt({ sub: me.clerkUserId, email: me.email, role: me.role });
    const res = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return NextResponse.json(
        { error: `Backend returned ${res.status}: ${text}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('[/api/config GET] error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch configuration' },
      { status: 502 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
    }

    // Mint a short-lived PRISM backend JWT so the Python side's
    // `require_admin` dependency passes. See lib/prismJwt.ts — we
    // bridge Clerk auth → PRISM JWT because the Python layer still
    // uses its pre-Clerk auth for admin gating.
    const token = signPrismJwt({
      sub: admin.clerkUserId,
      email: admin.email,
      role: 'admin',
    });
    if (!token) {
      return NextResponse.json(
        { error: 'PRISM_JWT_SECRET is not configured — admin changes are disabled until the backend secret is set.' },
        { status: 500 }
      );
    }

    const backendUrl = await resolveBackendUrl('/api/v1/config');
    const res = await fetch(backendUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-PRISM-User-Id': admin.clerkUserId,
        'X-PRISM-User-Email': admin.email,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return NextResponse.json(
        { error: `Backend returned ${res.status}: ${text}` },
        { status: res.status }
      );
    }
    const data = await res.json().catch(() => ({ ok: true }));
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error('[/api/config PUT] error:', err);
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 502 }
    );
  }
}
