/**
 * Roles: Clerk owns identity (sign-in, sessions, MFA); PRISM owns the role.
 *
 * The role lives in the user_roles table of PRISM's database, keyed by the
 * Clerk user id, so role changes sit next to the audit log they are written
 * to and would survive a change of identity provider. The Clerk webhook adds
 * a row when a user signs up: the first user ever becomes admin, everyone
 * after that viewer. Admins change roles in Settings (or with
 * scripts/promote_admin.py).
 *
 * Server-side only.
 */
import { auth, currentUser } from '@clerk/nextjs/server';
import type { Role } from '@/types';
import { getSQL } from './db';

export type { Role };

/** Create the table if it does not exist yet; cheap after the first call. */
export async function ensureUserRolesTable(): Promise<void> {
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

/** The user's role, or null when the webhook has not added the user yet. */
export async function getRole(clerkUserId: string): Promise<Role | null> {
  await ensureUserRolesTable();
  const sql = getSQL();
  const rows = (await sql`
    SELECT role FROM user_roles WHERE clerk_user_id = ${clerkUserId}
  `) as Array<{ role: Role }>;
  return rows[0]?.role ?? null;
}

/**
 * Add a user (or refresh the email of a known one) and return the role. The
 * first user becomes admin. Two sign-ups in the same instant could both see an
 * empty table; the worst case is two admins, which an admin can undo.
 */
export async function upsertUserRole(clerkUserId: string, email: string): Promise<Role> {
  await ensureUserRolesTable();
  const sql = getSQL();
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

/** Change a user's role. The caller must already have checked that it is an admin. */
export async function setRole(clerkUserId: string, role: Role): Promise<void> {
  await ensureUserRolesTable();
  const sql = getSQL();
  await sql`
    UPDATE user_roles
       SET role = ${role}, updated_at = NOW()
     WHERE clerk_user_id = ${clerkUserId}
  `;
}

/** Remove a deleted user's row (Clerk webhook). */
export async function deleteUserRole(clerkUserId: string): Promise<void> {
  await ensureUserRolesTable();
  const sql = getSQL();
  await sql`DELETE FROM user_roles WHERE clerk_user_id = ${clerkUserId}`;
}

/** The signed-in user with their role (viewer until the webhook has added them). */
export async function requireAuth(): Promise<{ clerkUserId: string; email: string; role: Role }> {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError('Not signed in');
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const role = (await getRole(userId)) ?? 'viewer';
  return { clerkUserId: userId, email, role };
}

/** The signed-in user if they are an admin; ForbiddenError otherwise. */
export async function requireAdmin(): Promise<{ clerkUserId: string; email: string }> {
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
