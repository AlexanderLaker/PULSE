/**
 * /api/prism-cookie: the cookie the PRISM API reads need.
 *
 * GET sets it:
 *   - The user comes from the Clerk session; without one the answer is 401
 *     and no cookie is set.
 *   - Only a user with a role in user_roles gets one: a pending user, whom
 *     no admin has approved yet, is answered 403 (lib/roles.ts). When the
 *     role cannot be read (the database or Clerk does not answer) the answer
 *     is 500 and no cookie is set either.
 *   - The token in the cookie always says viewer, admins included. The
 *     cookie authorises reads and the user's own expert proposals, never an
 *     admin write: admin writes go through the dashboard routes with a
 *     separate admin token (lib/adminWrite.ts).
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
import { ForbiddenError, requireRole, UnauthorizedError } from '@/lib/roles';
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
  let me: Awaited<ReturnType<typeof requireRole>>;
  try {
    me = await requireRole();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error('[/api/prism-cookie] access check failed:', err);
    return NextResponse.json({ error: 'Access could not be checked' }, { status: 500 });
  }
  // Viewer only, whatever the user's role (see above).
  const token = signPrismJwt(
    { sub: me.clerkUserId, email: me.email, name: me.name, role: 'viewer' },
    TTL_SECONDS,
  );
  if (!token) {
    // The deployment has no PRISM_JWT_SECRET of at least 32 characters.
    return NextResponse.json({ ok: false, error: 'PRISM_JWT_SECRET is not configured' }, { status: 503 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set('prism-token', token, { ...COOKIE, maxAge: TTL_SECONDS });
  return res;
}

export function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('prism-token', '', { ...COOKIE, maxAge: 0 });
  return res;
}
