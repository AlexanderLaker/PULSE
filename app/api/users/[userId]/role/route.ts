/**
 * PATCH /api/users/[userId]/role — admin-only role change.
 *
 * Body: { role: 'admin' | 'viewer' }.
 *
 * Safeguards:
 *   - Caller must be admin (requireAdmin).
 *   - Admins cannot demote themselves — this prevents a lone admin from
 *     accidentally locking everyone out. To demote yourself, another
 *     admin must do it.
 *   - Role must be a valid enum value; anything else → 400.
 *
 * Side effects:
 *   - Writes to `user_roles` via `setRole` in lib/roles.ts.
 *   - Appends an audit_log row so the change is traceable.
 *
 * The target must already exist in `user_roles` (otherwise the webhook
 * hasn't fired). If they don't, we upsert a viewer row first so the
 * UPDATE has something to hit.
 */
import { NextResponse } from 'next/server';
import {
  requireAdmin, setRole, getRole,
  ForbiddenError, UnauthorizedError,
} from '@/lib/roles';
import { getSQL } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: { userId: string };
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const admin = await requireAdmin();
    const targetUserId = params.userId;

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

    // Ensure the row exists. If the webhook hasn't fired yet, create a
    // minimal row so the subsequent UPDATE lands. We pass the admin's
    // email as a placeholder — the webhook (or a later /api/me call)
    // will correct it.
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

    // Audit entry — best effort. A failure here shouldn't roll back the
    // role change, but we log it so ops notice.
    try {
      await sql`
        INSERT INTO audit_log (action, entity_type, entity_id, old_value, new_value, reason, user_id)
        VALUES (
          'role_change',
          'user',
          ${targetUserId},
          ${existing ?? 'null'},
          ${nextRole},
          'via /api/users/[userId]/role',
          ${admin.clerkUserId}
        )
      `;
    } catch (auditErr) {
      console.warn('[/api/users/:id/role] audit write failed:', auditErr);
    }

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
