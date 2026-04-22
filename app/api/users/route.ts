/**
 * GET /api/users — admin-only directory of all users.
 *
 * Joins Clerk (identity — email, names, sign-in activity) with our own
 * `user_roles` table (authorization — role). If a Clerk user has no
 * row in `user_roles` yet (i.e. the webhook hasn't fired for them),
 * we default their role to 'viewer' in the response rather than
 * omitting them from the list.
 *
 * Response: { users: ManagedUser[] }.
 *
 * ManagedUser shape matches the SettingsModal's UsersSection.
 */
import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { requireAdmin, ForbiddenError, UnauthorizedError } from '@/lib/roles';
import { getSQL } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ManagedUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: 'admin' | 'viewer';
  lastSignInAt: string | null;
  createdAt: string | null;
}

export async function GET() {
  try {
    await requireAdmin();

    // Pull every role row up front — cheap (<<1000 users) and avoids
    // issuing one SQL query per Clerk user.
    const sql = getSQL();
    const roleRows = (await sql`
      SELECT clerk_user_id, role FROM user_roles
    `) as Array<{ clerk_user_id: string; role: 'admin' | 'viewer' }>;
    const roleById = new Map(roleRows.map((r) => [r.clerk_user_id, r.role]));

    // Clerk v6: clerkClient is an async factory (returns the client).
    const client = await clerkClient();
    const response = await client.users.getUserList({
      limit: 500,
      orderBy: '-created_at',
    });

    // The SDK returns either a plain array (older signature) or a
    // paginated `{ data, totalCount }` object (v5+). Handle both.
    const rawUsers: Array<Record<string, unknown>> = Array.isArray(response)
      ? (response as Array<Record<string, unknown>>)
      : ((response as { data?: unknown[] }).data as Array<Record<string, unknown>>) ?? [];

    const users: ManagedUser[] = rawUsers.map((u) => {
      const id = u.id as string;
      const primaryId = (u.primaryEmailAddressId ?? u.primary_email_address_id) as string | undefined;
      const emails = (u.emailAddresses ?? u.email_addresses ?? []) as Array<{
        id: string;
        emailAddress?: string;
        email_address?: string;
      }>;
      const primary = emails.find((e) => e.id === primaryId) ?? emails[0];
      const email = primary?.emailAddress ?? primary?.email_address ?? '';
      const firstName = (u.firstName ?? u.first_name ?? null) as string | null;
      const lastName = (u.lastName ?? u.last_name ?? null) as string | null;
      const lastSignInRaw = (u.lastSignInAt ?? u.last_sign_in_at ?? null) as number | string | null;
      const createdRaw = (u.createdAt ?? u.created_at ?? null) as number | string | null;

      return {
        id,
        email,
        firstName,
        lastName,
        role: roleById.get(id) ?? 'viewer',
        lastSignInAt: lastSignInRaw
          ? new Date(typeof lastSignInRaw === 'number' ? lastSignInRaw : lastSignInRaw).toISOString()
          : null,
        createdAt: createdRaw
          ? new Date(typeof createdRaw === 'number' ? createdRaw : createdRaw).toISOString()
          : null,
      };
    });

    return NextResponse.json({ users });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error('[/api/users GET] error:', err);
    return NextResponse.json(
      { error: 'Failed to list users' },
      { status: 500 }
    );
  }
}
