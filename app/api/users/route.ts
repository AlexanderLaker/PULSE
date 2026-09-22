/**
 * GET /api/users: every user with their role, for the admin's user list.
 *
 * Joins Clerk (email, names, sign-in activity) with user_roles (the role). A
 * Clerk user without a row yet, whom the webhook has not reached, is listed
 * as viewer rather than left out. Admin only. Response: { users }.
 */
import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { requireAdmin, ForbiddenError, UnauthorizedError, type Role } from '@/lib/roles';
import { getSQL } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
    const sql = getSQL();
    const roleRows = (await sql`SELECT clerk_user_id, role FROM user_roles`) as Array<{
      clerk_user_id: string;
      role: Role;
    }>;
    const roleById = new Map(roleRows.map((r) => [r.clerk_user_id, r.role]));

    const client = await clerkClient();
    const { data } = await client.users.getUserList({ limit: 500, orderBy: '-created_at' });
    const users = data.map((u) => {
      const primary = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId) ?? u.emailAddresses[0];
      return {
        id: u.id,
        email: primary?.emailAddress ?? '',
        firstName: u.firstName,
        lastName: u.lastName,
        role: roleById.get(u.id) ?? 'viewer',
        lastSignInAt: u.lastSignInAt ? new Date(u.lastSignInAt).toISOString() : null,
        createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
      };
    });
    return NextResponse.json({ users });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error('[/api/users GET]', err);
    return NextResponse.json({ error: 'Failed to list users' }, { status: 500 });
  }
}
