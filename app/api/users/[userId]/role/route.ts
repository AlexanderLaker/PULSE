/**
 * /api/users/{userId}/role: an admin gives a user a role, changes it, or takes
 * it away.
 *
 * PATCH { role: 'admin' | 'viewer', from } sets the role. For a pending user,
 * who has no row yet, that is the approval: the row is added with the email
 * Clerk holds for them (404 for an id Clerk does not know; 409 while Clerk
 * holds no email address for the user, or has not verified it, since an
 * address nobody has proved to own says nothing about who the user is).
 * While PRISM_ALLOWED_EMAIL_DOMAINS is set, a pending user whose address is
 * at another domain is refused (403); a user who has a role keeps it.
 * Response: { role }.
 *
 * DELETE ?from= takes the role away: the row goes, the user is pending again
 * and sees only the waiting page on their next page load, and their viewer
 * cookie runs out within 30 minutes. Response: { role: 'pending' }.
 *
 * `from` is the access the admin's list shows ('admin', 'viewer' or
 * 'pending'; 400 without it). A change is made only while the user's access
 * is still that, and the admin is still admin, up to the moment it is
 * written (lib/roles.ts changeAccess); otherwise the answer is 409 with
 * `code: 'changed'`, which tells it from the 409s above, and nothing
 * changes, so two admins working in Settings at the same moment cannot undo
 * each other's changes unseen, nor leave PRISM without an admin. An admin
 * cannot change or remove their own role. A request that would change
 * nothing changes and logs nothing. Every change is written to the audit log
 * where possible: a failed audit write is logged and the change stands.
 */
import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import {
  allowedEmailDomains, changeAccess, getRole, mayBeApproved, requireAdmin,
  ForbiddenError, UnauthorizedError, type Access,
} from '@/lib/roles';
import { recordRoleChange } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ userId: string }>;
}

const OWN_ROLE = "You can't change your own role. Ask another admin.";
const CHANGED_MEANWHILE = "This user's access, or your own role, changed in the meantime.";

const isAccess = (value: unknown): value is Access => value === 'admin' || value === 'viewer' || value === 'pending';
const WHAT_THE_LIST_SHOWS = "Say which access the list shows: from 'admin', 'viewer' or 'pending'";

export async function PATCH(req: Request, { params }: Params) {
  try {
    const admin = await requireAdmin();
    const { userId: targetUserId } = await params;

    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as { role?: unknown; from?: unknown } | null;
    const nextRole = body?.role;
    if (nextRole !== 'admin' && nextRole !== 'viewer') {
      return NextResponse.json(
        { error: "Role must be 'admin' or 'viewer'" },
        { status: 400 }
      );
    }
    const shown = body?.from;
    if (!isAccess(shown)) return NextResponse.json({ error: WHAT_THE_LIST_SHOWS }, { status: 400 });

    if (targetUserId === admin.clerkUserId && nextRole !== 'admin') {
      return NextResponse.json({ error: OWN_ROLE }, { status: 400 });
    }

    const existing: Access = (await getRole(targetUserId)) ?? 'pending';
    if (existing !== shown) return NextResponse.json({ error: CHANGED_MEANWHILE, code: 'changed' }, { status: 409 });
    if (existing === nextRole) return NextResponse.json({ role: nextRole });

    let email: string | undefined;
    if (existing === 'pending') {
      // The approval, with the email Clerk holds for the user.
      const held = await clerkEmail(targetUserId);
      if (held === null) {
        return NextResponse.json({ error: 'Clerk has no user with this id' }, { status: 404 });
      }
      if (!held.address) {
        return NextResponse.json(
          { error: 'Clerk holds no email address for this user yet; try again once they have one.' },
          { status: 409 },
        );
      }
      if (!held.verified) {
        return NextResponse.json(
          { error: `Clerk has not verified ${held.address} yet; approve the user once they have confirmed it.` },
          { status: 409 },
        );
      }
      if (!mayBeApproved(held.address)) {
        return NextResponse.json(
          { error: `Only addresses at ${allowedEmailDomains().join(', ')} can be given a role here (PRISM_ALLOWED_EMAIL_DOMAINS).` },
          { status: 403 },
        );
      }
      email = held.address;
    }

    const changed = await changeAccess({
      actor: admin.clerkUserId, user: targetUserId, from: existing, to: nextRole, email,
    });
    if (!changed) return NextResponse.json({ error: CHANGED_MEANWHILE, code: 'changed' }, { status: 409 });

    await recordRoleChange({
      userId: targetUserId, from: existing === 'pending' ? null : existing, to: nextRole,
      via: 'via /api/users/[userId]/role', actor: admin.clerkUserId,
    });

    return NextResponse.json({ role: nextRole });
  } catch (err) {
    return failure(err, 'Failed to update role', 'PATCH');
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const admin = await requireAdmin();
    const { userId: targetUserId } = await params;

    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }
    const shown = new URL(req.url).searchParams.get('from');
    if (!isAccess(shown)) return NextResponse.json({ error: WHAT_THE_LIST_SHOWS }, { status: 400 });
    if (targetUserId === admin.clerkUserId) {
      return NextResponse.json({ error: OWN_ROLE }, { status: 400 });
    }

    const existing = await getRole(targetUserId);
    if ((existing ?? 'pending') !== shown) return NextResponse.json({ error: CHANGED_MEANWHILE, code: 'changed' }, { status: 409 });
    if (existing === null) return NextResponse.json({ role: 'pending' });

    const changed = await changeAccess({ actor: admin.clerkUserId, user: targetUserId, from: existing, to: 'pending' });
    if (!changed) return NextResponse.json({ error: CHANGED_MEANWHILE, code: 'changed' }, { status: 409 });

    await recordRoleChange({
      userId: targetUserId, from: existing, to: null, via: 'via /api/users/[userId]/role',
      actor: admin.clerkUserId,
    });

    return NextResponse.json({ role: 'pending' });
  } catch (err) {
    return failure(err, 'Failed to remove the role', 'DELETE');
  }
}

/** The answer to a failed call: 401 and 403 as the role check decided, 500 otherwise. */
function failure(err: unknown, message: string, method: string): NextResponse {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  console.error(`[/api/users/:id/role ${method}] error:`, err);
  return NextResponse.json({ error: message }, { status: 500 });
}

/** The user's primary email address in Clerk (else the first one, else '') and whether Clerk has verified
 *  it, or null when Clerk has no such user. */
async function clerkEmail(userId: string): Promise<{ address: string; verified: boolean } | null> {
  const client = await clerkClient();
  try {
    const user = await client.users.getUser(userId);
    const email = user.primaryEmailAddress ?? user.emailAddresses[0];
    return { address: email?.emailAddress ?? '', verified: email?.verification?.status === 'verified' };
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}
