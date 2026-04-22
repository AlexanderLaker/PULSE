/**
 * GET /api/me — the current caller's authorization context.
 *
 * This is the single endpoint the SettingsModal hits on open to decide
 * whether to render the admin-only sections (Config Sheet, User
 * Management). Clerk hooks already give us identity on the client; we
 * deliberately do NOT trust a client-side role claim — authorization
 * always comes from Postgres `user_roles`.
 *
 * Response: { clerkUserId, email, role }.
 *
 * Returns 401 if not signed in (middleware will usually intercept first,
 * but we handle it defensively so a direct fetch without cookies still
 * gets a JSON error instead of an HTML redirect page).
 */
import { NextResponse } from 'next/server';
import { requireAuth, UnauthorizedError } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const me = await requireAuth();
    return NextResponse.json({
      clerkUserId: me.clerkUserId,
      email: me.email,
      role: me.role,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('[/api/me] error:', err);
    return NextResponse.json({ error: 'Failed to resolve identity' }, { status: 500 });
  }
}
