/**
 * Role management for PRISM.
 *
 * Clerk owns identity (email, password, sessions, MFA). We own authorization —
 * specifically the admin/viewer role that gates configuration changes, user
 * administration, and audit access.
 *
 * Design choice: a single `user_roles` table keyed on Clerk's user ID. We
 * deliberately do NOT store roles in Clerk's `publicMetadata` because:
 *   1. PRISM's audit log already uses Postgres user_id as a foreign key
 *   2. Role changes need to be atomic with audit entries (transactions)
 *   3. We want roles to survive a future auth-provider swap
 *
 * First user to sign up is auto-promoted to admin. All subsequent users
 * default to viewer. Admins can promote others via a dedicated endpoint.
 */
import { auth, currentUser } from '@clerk/nextjs/server';
import { getSQL } from './db';

export type Role = 'admin' | 'viewer';

/**
 * Idempotent table creation. Safe to call on every request — `IF NOT EXISTS`
 * makes this free after the first call.
 */
async function ensureUserRolesTable(): Promise<void> {
  const sql = getSQL();
  await sql`
    CREATE TABLE IF NOT EXISTS user_roles (
      clerk_user_id TEXT PRIMARY KEY,
      email         TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'viewer'
                    CHECK (role IN ('admin', 'viewer')),
      created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
}

/**
 * Look up a user's role by Clerk ID. Returns `null` if the user has no row
 * yet — typically because the Clerk webhook hasn't synced them. Callers
 * should treat `null` as "untrusted" and refuse access.
 */
export async function getRole(clerkUserId: string): Promise<Role | null> {
  await ensureUserRolesTable();
  const sql = getSQL();
  const rows = (await sql`
    SELECT role FROM user_roles WHERE clerk_user_id = ${clerkUserId}
  `) as Array<{ role: Role }>;
  return rows[0]?.role ?? null;
}

/**
 * Upsert a user's role. Used by the Clerk webhook on user.created events.
 * First user in the database becomes admin; everyone else is viewer.
 */
export async function upsertUserRole(
  clerkUserId: string,
  email: string
): Promise<Role> {
  await ensureUserRolesTable();
  const sql = getSQL();

  // Count existing users. If zero, this user is the first → admin.
  // Otherwise → viewer. Not perfectly race-free, but the window is tiny
  // and the worst case (two admins) is recoverable.
  const existing = (await sql`SELECT COUNT(*)::int AS n FROM user_roles`) as Array<{ n: number }>;
  const role: Role = existing[0].n === 0 ? 'admin' : 'viewer';

  await sql`
    INSERT INTO user_roles (clerk_user_id, email, role)
    VALUES (${clerkUserId}, ${email.toLowerCase()}, ${role})
    ON CONFLICT (clerk_user_id) DO UPDATE
      SET email = EXCLUDED.email,
          updated_at = NOW()
  `;

  return role;
}

/**
 * Promote or demote a user. Only callable from server-side code that has
 * already verified the caller is an admin.
 */
export async function setRole(clerkUserId: string, role: Role): Promise<void> {
  await ensureUserRolesTable();
  const sql = getSQL();
  await sql`
    UPDATE user_roles
       SET role = ${role}, updated_at = NOW()
     WHERE clerk_user_id = ${clerkUserId}
  `;
}

/**
 * Delete a user's role row. Called by the Clerk webhook on user.deleted.
 */
export async function deleteUserRole(clerkUserId: string): Promise<void> {
  await ensureUserRolesTable();
  const sql = getSQL();
  await sql`DELETE FROM user_roles WHERE clerk_user_id = ${clerkUserId}`;
}

/**
 * Server-side helper for API routes and server components. Returns the
 * current user's identity plus role, or throws `UnauthorizedError` if
 * they aren't signed in.
 */
export async function requireAuth(): Promise<{
  clerkUserId: string;
  email: string;
  role: Role;
}> {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError('Not signed in');

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const role = (await getRole(userId)) ?? 'viewer';

  return { clerkUserId: userId, email, role };
}

/**
 * Gate admin-only routes. Throws `ForbiddenError` if the caller isn't admin.
 */
export async function requireAdmin(): Promise<{
  clerkUserId: string;
  email: string;
}> {
  const { clerkUserId, email, role } = await requireAuth();
  if (role !== 'admin') throw new ForbiddenError('Admin role required');
  return { clerkUserId, email };
}

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}
