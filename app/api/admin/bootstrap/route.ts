/**
 * POST /api/admin/bootstrap: make the named address the first admin with a
 * shared secret.
 *
 * This is how the first admin of a new database is set up, when nobody can
 * give anyone a role yet. The route is not behind the Clerk session; the
 * header x-bootstrap-secret must equal ADMIN_BOOTSTRAP_SECRET instead, and
 * only the address in ADMIN_BOOTSTRAP_EMAIL can be made admin.
 *
 *   - secret unset: the route answers 404, as if it did not exist
 *   - secret shorter than MIN_SECRET_LENGTH (lib/prismJwt.ts), the minimum
 *     of PRISM_JWT_SECRET too: 503, and nothing is compared (the route has no
 *     rate limit; the length is what keeps guessing hopeless)
 *   - wrong or missing header: 403
 *   - ADMIN_BOOTSTRAP_EMAIL unset: 503
 *   - a body { email } that is not ADMIN_BOOTSTRAP_EMAIL: 403
 *   - no Clerk user signs in with that address (they have not signed up):
 *     404; Clerk has not verified it for that user: 409
 *   - an admin exists already: 409, and nothing changes. Once there is an
 *     admin, roles are set in Settings (User management) or with
 *     scripts/promote_admin.py, so a forgotten secret cannot make anyone else
 *     admin
 *
 * Set both variables in the Vercel project and redeploy (Vercel applies a
 * changed variable to new deployments only), sign up with that address, call
 * the route with { "email": "..." }, then remove both and redeploy again. The
 * user's row is added as admin (a user who signs up has none until approved).
 * A promotion is written to the audit log; if that write fails (a database
 * the API has not started on has no audit log yet) the promotion stands and
 * the failure is logged as a warning.
 */
import { createHash, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { getSQL } from '@/lib/db';
import { MIN_SECRET_LENGTH } from '@/lib/prismJwt';
import { ensureUserRolesTable } from '@/lib/roles';
import { recordRoleChange } from '@/lib/audit';
import type { Role } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface BootstrapBody {
  email?: unknown;
}

/** Compares the secrets in constant time: both are hashed to the same length first. */
function sameSecret(provided: string, expected: string): boolean {
  const digest = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(digest(provided), digest(expected));
}

export async function POST(req: Request) {
  const expected = process.env.ADMIN_BOOTSTRAP_SECRET;
  if (!expected) {
    // Disabled here: do not reveal that the route exists.
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (expected.length < MIN_SECRET_LENGTH) {
    return NextResponse.json(
      { error: `ADMIN_BOOTSTRAP_SECRET is shorter than ${MIN_SECRET_LENGTH} characters; set a longer one` },
      { status: 503 },
    );
  }

  const provided = req.headers.get('x-bootstrap-secret');
  if (!provided || !sameSecret(provided, expected)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const named = (process.env.ADMIN_BOOTSTRAP_EMAIL ?? '').trim().toLowerCase();
  if (!named) {
    return NextResponse.json(
      { error: 'ADMIN_BOOTSTRAP_EMAIL is not set: name the address that becomes the first admin' },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => null)) as BootstrapBody | null;
  const rawEmail = typeof body?.email === 'string' ? body.email.trim() : '';
  if (!rawEmail) {
    return NextResponse.json(
      { error: "Body must include { email: string }" },
      { status: 400 }
    );
  }
  const email = rawEmail.toLowerCase();
  if (email !== named) {
    return NextResponse.json(
      { error: 'Only the address in ADMIN_BOOTSTRAP_EMAIL can become the first admin' },
      { status: 403 },
    );
  }

  // The Clerk user who signs in with the address (a row without one would be
  // a ghost), and who has proved to own it.
  const client = await clerkClient();
  const { data: matches } = await client.users.getUserList({ emailAddress: [email], limit: 1 });
  const user = matches[0];
  if (!user) {
    return NextResponse.json(
      { error: `No Clerk user signs in with ${email}: sign up with it first` },
      { status: 404 }
    );
  }
  const owned = user.emailAddresses.find((e) => e.emailAddress.toLowerCase() === email);
  if (owned?.verification?.status !== 'verified') {
    return NextResponse.json(
      { error: `Clerk has not verified ${email} for this user yet: confirm it first` },
      { status: 409 }
    );
  }
  const clerkUserId = user.id;

  await ensureUserRolesTable();
  const sql = getSQL();

  const rows = (await sql`
    SELECT role FROM user_roles WHERE clerk_user_id = ${clerkUserId}
  `) as Array<{ role: Role }>;
  const previousRole = rows[0]?.role ?? null;

  if (previousRole === 'admin') {
    return NextResponse.json({
      clerkUserId,
      email,
      role: 'admin',
      changed: false,
      note: 'User was already admin',
    });
  }

  // One statement checks that no admin exists and adds or promotes the row,
  // in a serializable transaction: two calls at the same moment cannot both
  // make an admin, as PostgreSQL lets one through and fails the other
  // (SQLSTATE 40001).
  const adminExists = NextResponse.json(
    { error: 'An admin exists already: set roles in Settings (User management) or with scripts/promote_admin.py' },
    { status: 409 },
  );
  let promoted: unknown[];
  try {
    [promoted] = (await sql.transaction([sql`
      INSERT INTO user_roles (clerk_user_id, email, role)
      SELECT ${clerkUserId}, ${email}, 'admin'
       WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE role = 'admin')
      ON CONFLICT (clerk_user_id) DO UPDATE
         SET role = 'admin', email = EXCLUDED.email, updated_at = NOW()
      RETURNING clerk_user_id
    `], { isolationLevel: 'Serializable' })) as unknown[][];
  } catch (err) {
    if ((err as { code?: unknown } | null)?.code === '40001') return adminExists;
    throw err;
  }
  if (promoted.length === 0) return adminExists;

  await recordRoleChange({
    userId: clerkUserId, from: previousRole, to: 'admin',
    via: 'via /api/admin/bootstrap (shared-secret)', actor: 'bootstrap',
  });

  return NextResponse.json({
    clerkUserId,
    email,
    role: 'admin',
    changed: true,
    previousRole,
  });
}
