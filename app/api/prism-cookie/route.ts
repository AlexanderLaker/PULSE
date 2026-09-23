/**
 * GET /api/prism-cookie: give the browser the cookie the PRISM API reads need.
 *
 *   - The user comes from the Clerk session; without one the answer is 401
 *     and no cookie is set.
 *   - The token in the cookie always says viewer, admins included. The cookie
 *     authorises reads and the user's own expert proposals, never an admin
 *     write: admin writes go through the dashboard routes with a separate
 *     admin token (lib/backend.ts).
 *   - httpOnly, Secure in production, SameSite=Lax and Path=/api/v1: script
 *     cannot read it and it is sent to the API only.
 *   - It lasts 12 hours. The dashboard asks for a fresh one whenever it
 *     loads, and lib/apiClient.ts asks again when an /api/v1 request is answered
 *     401, then repeats the request once.
 */
import { NextResponse } from 'next/server';
import { requireAuth, UnauthorizedError } from '@/lib/roles';
import { signPrismJwt } from '@/lib/prismJwt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TTL_SECONDS = 12 * 60 * 60;

export async function GET() {
  const configured = Boolean(
    process.env.PRISM_JWT_SECRET && process.env.PRISM_JWT_SECRET.length >= 32,
  );
  try {
    const me = await requireAuth();
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
    res.cookies.set('prism-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1',
      maxAge: TTL_SECONDS,
    });
    return res;
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message, configured }, { status: 401 });
    }
    console.error('[/api/prism-cookie] error:', err);
    return NextResponse.json({ error: 'Failed to sign the API token', configured }, { status: 500 });
  }
}
