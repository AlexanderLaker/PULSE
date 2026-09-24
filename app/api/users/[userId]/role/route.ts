/**
 * PATCH /api/users/{userId}/role: an admin changes a user's role.
 *
 * Body { role: 'admin' | 'viewer' }. An admin cannot demote themselves, so
 * the last admin can never lock everyone out; another admin has to do it. A
 * user the webhook has not added yet gets their row first, with the email
 * Clerk holds for them (404 for an id Clerk does not know, 409 while Clerk
 * holds no email address for the user, whom the webhook skips too). The
 * change is written to the audit log where possible: a failed audit write is
 * logged and the change stands. Response: { role }.
 */
import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import {
  requireAdmin, setRole, getRole, upsertUserRole,
  ForbiddenError, UnauthorizedError,
} from '@/lib/roles';
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

    // A user the webhook has not reached yet is added now, as the webhook
    // would: the calling admin's row means the table is not empty, so the
    // user starts as viewer.
    const existing = await getRole(targetUserId);
    if (existing === null) {
      const email = await clerkEmail(targetUserId);
      if (email === null) {
        return NextResponse.json({ error: 'Clerk has no user with this id' }, { status: 404 });
      }
      if (email === '') {
        return NextResponse.json(
          { error: 'Clerk holds no email address for this user yet; try again once they have one.' },
          { status: 409 },
        );
      }
      await upsertUserRole(targetUserId, email);
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

/** The user's primary email address in Clerk (else the first one, else ''), or null when Clerk has no such user. */
async function clerkEmail(userId: string): Promise<string | null> {
  const client = await clerkClient();
  try {
    const user = await client.users.getUser(userId);
    return (user.primaryEmailAddress ?? user.emailAddresses[0])?.emailAddress ?? '';
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}
