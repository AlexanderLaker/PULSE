/**
 * GET /api/me: the signed-in user and their role, { clerkUserId, email, role }.
 *
 * The dashboard asks once and shows admin controls from the answer. The role
 * always comes from user_roles, never from anything the browser holds, and
 * every write is checked again on the server. 401 without a session.
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
