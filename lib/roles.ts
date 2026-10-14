/**
 * Roles: Clerk owns identity (sign-in, sessions, MFA); PRISM owns the role.
 *
 * The role lives in the user_roles table of PRISM's database, keyed by the
 * Clerk user id, so role changes sit next to the audit log they are written
 * to and would survive a change of identity provider. A user who signs up
 * gets no row: they are pending, and see nothing of PRISM, until an admin
 * gives them a role in Settings, which adds the row. The Clerk webhook keeps
 * a known user's email current and removes a deleted user's row. The first
 * admin of a new database comes from /api/admin/bootstrap, for the address
 * in ADMIN_BOOTSTRAP_EMAIL; scripts/promote_admin.py changes the role of a
 * user who has a row.
 *
 * Server-side only.
 */
import { auth, currentUser } from '@clerk/nextjs/server';
import type { Access, Role } from '@/types';
import { getSQL } from './db';

export type { Access, Role };

let tableReady: Promise<void> | null = null;

/** Create the table if it does not exist yet: once per server instance, again after a failure. */
export function ensureUserRolesTable(): Promise<void> {
  tableReady ??= createUserRolesTable().catch((err: unknown) => {
    tableReady = null;
    throw err;
  });
  return tableReady;
}

async function createUserRolesTable(): Promise<void> {
  const sql = getSQL();
  try {
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
  } catch (err) {
    // Two instances creating the table at the same moment collide in
    // PostgreSQL's catalogue (unique_violation); the table then exists.
    if ((err as { code?: string }).code !== '23505') throw err;
  }
}

/** The user's role, or null while they are pending (no row). */
export async function getRole(clerkUserId: string): Promise<Role | null> {
  await ensureUserRolesTable();
  const sql = getSQL();
  const rows = (await sql`
    SELECT role FROM user_roles WHERE clerk_user_id = ${clerkUserId}
  `) as Array<{ role: Role }>;
  return rows[0]?.role ?? null;
}

/**
 * Give a pending user a role: their row, with the email Clerk holds for them.
 * A row that appeared in the meantime (another admin approving at the same
 * moment) is set to the role instead.
 */
export async function addUserRole(clerkUserId: string, email: string, role: Role): Promise<void> {
  await ensureUserRolesTable();
  const sql = getSQL();
  const inserted = (await sql`
    INSERT INTO user_roles (clerk_user_id, email, role)
    VALUES (${clerkUserId}, ${email.toLowerCase()}, ${role})
    ON CONFLICT (clerk_user_id) DO NOTHING
    RETURNING role
  `) as Array<{ role: Role }>;
  if (inserted.length === 0) await setRole(clerkUserId, role);
}

/**
 * Store the new email of a known user (Clerk reported a change) and return
 * their role; a pending user gets no row from this, and the answer is null.
 */
export async function refreshUserEmail(clerkUserId: string, email: string): Promise<Role | null> {
  await ensureUserRolesTable();
  const sql = getSQL();
  const updated = (await sql`
    UPDATE user_roles
       SET email = ${email.toLowerCase()}, updated_at = NOW()
     WHERE clerk_user_id = ${clerkUserId}
    RETURNING role
  `) as Array<{ role: Role }>;
  return updated[0]?.role ?? null;
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

/** Remove a user's row (a deleted user, or access taken away in Settings); the role it held, or null when there was none. */
export async function deleteUserRole(clerkUserId: string): Promise<Role | null> {
  await ensureUserRolesTable();
  const sql = getSQL();
  const rows = (await sql`
    DELETE FROM user_roles WHERE clerk_user_id = ${clerkUserId} RETURNING role
  `) as Array<{ role: Role }>;
  return rows[0]?.role ?? null;
}

/** The signed-in user from the Clerk session alone; UnauthorizedError without one. */
export async function requireSignedIn(): Promise<{ clerkUserId: string; email: string; name: string }> {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError('Not signed in');
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const name = user?.fullName?.trim() ?? '';
  return { clerkUserId: userId, email, name };
}

/** The signed-in user with their access: their role, or 'pending' while they have no row. */
export async function requireAuth(): Promise<{ clerkUserId: string; email: string; name: string; role: Access }> {
  const me = await requireSignedIn();
  const role = (await getRole(me.clerkUserId)) ?? 'pending';
  return { ...me, role };
}

/** The signed-in user if they have a role; ForbiddenError while they are pending. */
export async function requireRole(): Promise<{ clerkUserId: string; email: string; name: string; role: Role }> {
  const me = await requireAuth();
  if (me.role === 'pending') throw new ForbiddenError('Access awaits approval');
  return { ...me, role: me.role };
}

/** The email domains a user may be approved from: PRISM_ALLOWED_EMAIL_DOMAINS, comma-separated, in lower
 *  case and without a leading @; empty when any domain may be approved. */
export function allowedEmailDomains(): string[] {
  return (process.env.PRISM_ALLOWED_EMAIL_DOMAINS ?? '')
    .split(',')
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
}

/** Whether an address may be given a role: its domain is one of allowedEmailDomains() exactly (a
 *  subdomain is a domain of its own), or that list is empty. */
export function mayBeApproved(email: string): boolean {
  const domains = allowedEmailDomains();
  if (domains.length === 0) return true;
  const at = email.lastIndexOf('@');
  return at > 0 && domains.includes(email.slice(at + 1).trim().toLowerCase());
}

/** The signed-in user if they are an admin; ForbiddenError otherwise. */
export async function requireAdmin(): Promise<{ clerkUserId: string; email: string; name: string }> {
  const { clerkUserId, email, name, role } = await requireAuth();
  if (role !== 'admin') throw new ForbiddenError('Admin role required');
  return { clerkUserId, email, name };
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
