/**
 * GET /api/prism-cookie — primes the browser with a short-lived PRISM
 * engine token so the FastAPI read endpoints can require authentication
 * (review F3).
 *
 * Design:
 *   - Identity comes from the Clerk session (requireAuth) — anonymous
 *     callers get 401 and no cookie.
 *   - The minted JWT is ALWAYS role=viewer, even for admins. Reads are
 *     the only thing the cookie can authorize; admin mutations keep
 *     going through the Next.js proxy routes with a Bearer token, so a
 *     cross-site request riding the cookie can never reach an admin
 *     gate (CSRF defense in depth, on top of SameSite=Lax).
 *   - httpOnly + Secure + SameSite=Lax + Path=/api/v1: invisible to JS,
 *     never sent cross-site on non-navigation requests, never sent to
 *     anything but the engine API.
 *   - TTL 12h; usePrism re-primes on every dashboard load / reconnect,
 *     so expiry self-heals on the next visit.
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
    // Viewer-only by design — see header comment.
    const token = signPrismJwt(
      { sub: me.clerkUserId, email: me.email, role: 'viewer' },
      TTL_SECONDS,
    );
    if (!token) {
      return NextResponse.json(
        { ok: false, configured, error: 'token mint failed' },
        { status: 503 },
      );
    }
    const res = NextResponse.json({ ok: true, configured });
    res.cookies.set('pulse-token', token, {
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
    return NextResponse.json({ error: 'Failed to mint engine token', configured }, { status: 500 });
  }
}
