/**
 * PUT /api/trends/[id] — admin-only trend mutation (edit truth values,
 * endorse expert scores).
 *
 * Why this proxy exists
 * ---------------------
 * The Python FastAPI backend gates `PUT /api/v1/trends/{id}` with
 * `require_admin`, which reads the `role` claim out of the PRISM JWT. But
 * browser calls to `/api/v1/*` are statically rewritten straight to the
 * backend carrying only the `pulse-token` cookie — and that cookie is
 * minted ALWAYS as role=viewer (see app/api/prism-cookie/route.ts, a CSRF
 * defense). So a direct browser PUT can never present admin authority and
 * the backend correctly answers 403 "Admin access required" — even for a
 * real admin. That broke every admin trend write, including the Review &
 * Endorse action.
 *
 * The fix mirrors app/api/config/route.ts and app/api/journey/route.ts:
 * enforce admin HERE (Clerk identity → Postgres user_roles), then forward
 * to the backend with a short-lived Bearer token carrying role=admin, so
 * the Python layer's `require_admin` passes and the audit log is keyed to
 * the real Clerk user.
 *
 * Reads (GET /trends, GET /trends/{id}) and the expert-proposals endpoints
 * are require_auth on the backend and keep working over the viewer cookie,
 * so they are deliberately NOT proxied here.
 */
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { requireAdmin, ForbiddenError, UnauthorizedError } from '@/lib/roles';
import { signPrismJwt } from '@/lib/prismJwt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Resolve the backend base URL. In production this is the same origin
 *  (Vercel rewrites /api/v1/* to the Python function). Locally it falls
 *  back to BACKEND_URL (typically http://localhost:8000) so developers can
 *  run FastAPI on a different port during npm run dev. Matches the helper
 *  in app/api/config/route.ts. */
async function resolveBackendUrl(path: string): Promise<string> {
  const override = process.env.BACKEND_URL;
  if (override) return `${override.replace(/\/$/, '')}${path}`;
  const hdrs = await headers();
  const host = hdrs.get('host') ?? 'localhost:3000';
  const proto = hdrs.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}${path}`;
}

interface Params {
  params: Promise<{ id: string }>;
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing trend id' }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
    }

    // Mint a short-lived PRISM backend JWT so the Python side's
    // `require_admin` dependency passes. See lib/prismJwt.ts.
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

    const backendUrl = await resolveBackendUrl(`/api/v1/trends/${encodeURIComponent(id)}`);
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
      // Relay the backend's own error detail so the client surfaces a
      // useful message (e.g. validation errors from TrendUpdate).
      const text = await res.text().catch(() => res.statusText);
      let detail = text;
      try {
        const parsed = JSON.parse(text);
        detail = parsed?.detail ?? parsed?.error ?? text;
      } catch {
        /* not JSON — use the raw text */
      }
      return NextResponse.json({ error: detail }, { status: res.status });
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
    console.error('[/api/trends/:id PUT] error:', err);
    return NextResponse.json({ error: 'Failed to update trend' }, { status: 502 });
  }
}
