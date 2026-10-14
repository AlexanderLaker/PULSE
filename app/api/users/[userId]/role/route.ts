/**
 * /api/users/{userId}/role: an admin gives a user a role, changes it, or takes
 * it away.
 *
 * PATCH { role: 'admin' | 'viewer' } sets the role. For a pending user, who
 * has no row yet, that is the approval: the row is added with the email Clerk
 * holds for them (404 for an id Clerk does not know; 409 while Clerk holds no
 * email address for the user, or has not verified it, since an address
 * nobody has proved to own says nothing about who the user is). While
 * PRISM_ALLOWED_EMAIL_DOMAINS is set, a pending user whose address is at
 * another domain is refused (403); a user who has a role keeps it. Response:
 * { role }.
 *
 * DELETE takes the role away: the row goes, the user is pending again and
 * sees only the waiting page on their next page load, and their viewer cookie
 * runs out within 30 minutes. Response: { role: 'pending' }.
 *
 * An admin cannot change or remove their own role, so the last admin can
 * never lock everyone out; another admin has to do it. Every change is
 * written to the audit log where possible: a failed audit write is logged and
 * the change stands.
 */
import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import {
  addUserRole, allowedEmailDomains, deleteUserRole, getRole, mayBeApproved, requireAdmin, setRole,
  ForbiddenError, UnauthorizedError,
} from '@/lib/roles';
import { recordRoleChange } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ userId: string }>;
}

const OWN_ROLE = "You can't change your own role. Ask another admin.";

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
      return NextResponse.json({ error: OWN_ROLE }, { status: 400 });
    }

    const existing = await getRole(targetUserId);
    if (existing === null) {
      // A pending user: approved now, with the email Clerk holds for them.
      const email = await clerkEmail(targetUserId);
      if (email === null) {
        return NextResponse.json({ error: 'Clerk has no user with this id' }, { status: 404 });
      }
      if (!email.address) {
        return NextResponse.json(
          { error: 'Clerk holds no email address for this user yet; try again once they have one.' },
          { status: 409 },
        );
      }
      if (!email.verified) {
        return NextResponse.json(
          { error: `Clerk has not verified ${email.address} yet; approve the user once they have confirmed it.` },
          { status: 409 },
        );
      }
      if (!mayBeApproved(email.address)) {
        return NextResponse.json(
          { error: `Only addresses at ${allowedEmailDomains().join(', ')} can be given a role here (PRISM_ALLOWED_EMAIL_DOMAINS).` },
          { status: 403 },
        );
      }
      await addUserRole(targetUserId, email.address, nextRole);
    } else {
      await setRole(targetUserId, nextRole);
    }

    await recordRoleChange({
      userId: targetUserId, from: existing, to: nextRole, via: 'via /api/users/[userId]/role',
      actor: admin.clerkUserId,
    });

    return NextResponse.json({ role: nextRole });
  } catch (err) {
    return failure(err, 'Failed to update role', 'PATCH');
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const admin = await requireAdmin();
    const { userId: targetUserId } = await params;

    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }
    if (targetUserId === admin.clerkUserId) {
      return NextResponse.json({ error: OWN_ROLE }, { status: 400 });
    }

    // Removing the role of a user who is already pending changes nothing.
    const removed = await deleteUserRole(targetUserId);
    if (removed !== null) {
      await recordRoleChange({
        userId: targetUserId, from: removed, to: null, via: 'via /api/users/[userId]/role',
        actor: admin.clerkUserId,
      });
    }

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
