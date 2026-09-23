/**
 * PATCH /api/users/{userId}/role: an admin changes a user's role.
 *
 * Body { role: 'admin' | 'viewer' }. An admin cannot demote themselves, so
 * the last admin can never lock everyone out; another admin has to do it. A
 * user the webhook has not added yet gets a viewer row first. The change is
 * written to the audit log where possible: a failed audit write is logged and
 * the change stands. Response: { role }.
 */
import { NextResponse } from 'next/server';
import {
  requireAdmin, setRole, getRole,
  ForbiddenError, UnauthorizedError,
} from '@/lib/roles';
import { getSQL } from '@/lib/db';
import { recordRoleChange } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ userId: string }>;
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const admin = await requireAdmin();
    const { userId: targetUserId } = await params;

    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as { role?: unknown } | null;
    const nextRole = body?.role;
    if (nextRole !== 'admin' && nextRole !== 'viewer') {
      return NextResponse.json(
        { error: "Role must be 'admin' or 'viewer'" },
        { status: 400 }
      );
    }

    if (targetUserId === admin.clerkUserId && nextRole !== 'admin') {
      return NextResponse.json(
        { error: "You can't change your own role. Ask another admin." },
        { status: 400 }
      );
    }

    // A user the webhook has not reached yet gets a viewer row first, with a
    // placeholder email the next user.updated event replaces.
    const existing = await getRole(targetUserId);
    const sql = getSQL();
    if (existing === null) {
      await sql`
        INSERT INTO user_roles (clerk_user_id, email, role)
        VALUES (${targetUserId}, ${'pending-webhook@prism'}, 'viewer')
        ON CONFLICT (clerk_user_id) DO NOTHING
      `;
    }

    await setRole(targetUserId, nextRole);

    await recordRoleChange({
      userId: targetUserId, from: existing, to: nextRole, via: 'via /api/users/[userId]/role',
      actor: admin.clerkUserId,
    });

    return NextResponse.json({ role: nextRole });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error('[/api/users/:id/role PATCH] error:', err);
    return NextResponse.json(
      { error: 'Failed to update role' },
      { status: 500 }
    );
  }
}
