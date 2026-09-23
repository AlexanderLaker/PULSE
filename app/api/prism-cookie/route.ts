/**
 * /api/prism-cookie: the cookie the PRISM API reads need.
 *
 * GET sets it:
 *   - The user comes from the Clerk session; without one the answer is 401
 *     and no cookie is set.
 *   - The token in the cookie always says viewer, admins included, so the
 *     role is not looked up. The cookie authorises reads and the user's own
 *     expert proposals, never an admin write: admin writes go through the
 *     dashboard routes with a separate admin token (lib/backend.ts).
 *   - httpOnly, Secure in production, SameSite=Lax and Path=/api/v1: script
 *     cannot read it and it is sent to the API only.
 *   - It lasts 30 minutes, so a session ended on another device loses its
 *     reads within that time. The dashboard asks for a fresh one whenever it
 *     loads, and lib/apiClient.ts asks again when an /api/v1 request is
 *     answered 401, then repeats the request once.
 *
 * DELETE expires it, with or without a session (proxy.ts lets it through):
 * the dashboard calls it before signing out and when the session has ended.
 */
import { NextResponse } from 'next/server';
import { requireSignedIn, UnauthorizedError } from '@/lib/roles';
import { signPrismJwt } from '@/lib/prismJwt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TTL_SECONDS = 30 * 60;

const COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/v1',
};

export async function GET() {
  const configured = Boolean(
    process.env.PRISM_JWT_SECRET && process.env.PRISM_JWT_SECRET.length >= 32,
  );
  try {
    const me = await requireSignedIn();
    if (!configured) {
      return NextResponse.json(
        { ok: false, configured, error: 'PRISM_JWT_SECRET not configured' },
        { status: 503 },
      );
    }
    // Viewer only, whatever the user's role (see above).
    const token = signPrismJwt(
      { sub: me.clerkUserId, email: me.email, name: me.name, role: 'viewer' },
      TTL_SECONDS,
    );
    if (!token) {
      return NextResponse.json(
        { ok: false, configured, error: 'The API token could not be signed' },
        { status: 503 },
      );
    }
    const res = NextResponse.json({ ok: true, configured });
    res.cookies.set('prism-token', token, { ...COOKIE, maxAge: TTL_SECONDS });
    return res;
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message, configured }, { status: 401 });
    }
    console.error('[/api/prism-cookie] error:', err);
    return NextResponse.json({ error: 'Failed to sign the API token', configured }, { status: 500 });
  }
}

export function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('prism-token', '', { ...COOKIE, maxAge: 0 });
  return res;
}
