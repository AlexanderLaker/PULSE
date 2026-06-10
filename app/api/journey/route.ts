/**
 * GET/PUT /api/journey — Consumer Journey content (tiles + stage data).
 *
 * Same proxy pattern as /api/config: Clerk auth enforced here, then the
 * request is forwarded to the Python backend (/api/v1/journey) with a
 * short-lived PRISM JWT. GET returns the server-managed journey content
 * (admin edits); 404 from the backend means "no server content yet" and
 * the frontend falls back to the seed module (data/consumerJourney.ts).
 * PUT is admin-only and stores the full {lhc, hair} content blob.
 */
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { requireAuth, requireAdmin, ForbiddenError, UnauthorizedError } from '@/lib/roles';
import { signPrismJwt } from '@/lib/prismJwt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    const backendUrl = await resolveBackendUrl('/api/v1/journey');
    const token = signPrismJwt({ sub: me.clerkUserId, email: me.email, role: me.role });
    const res = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    });
    if (res.status === 404) {
      // No server-managed content yet — frontend uses the seed module.
      return NextResponse.json(null, { status: 200 });
    }
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
    console.error('[/api/journey GET] error:', err);
    return NextResponse.json({ error: 'Failed to fetch journey content' }, { status: 502 });
  }
}

export async function PUT(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || !Array.isArray((body as Record<string, unknown>).lhc) || !Array.isArray((body as Record<string, unknown>).hair)) {
      return NextResponse.json({ error: 'Body must be a JSON object with lhc[] and hair[] journeys' }, { status: 400 });
    }

    const token = signPrismJwt({ sub: admin.clerkUserId, email: admin.email, role: 'admin' });
    if (!token) {
      return NextResponse.json(
        { error: 'PRISM_JWT_SECRET is not configured — admin changes are disabled until the backend secret is set.' },
        { status: 500 }
      );
    }

    const backendUrl = await resolveBackendUrl('/api/v1/journey');
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
    console.error('[/api/journey PUT] error:', err);
    return NextResponse.json({ error: 'Failed to update journey content' }, { status: 502 });
  }
}
