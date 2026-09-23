/**
 * POST /api/admin/bootstrap: make a signed-up user admin with a shared secret.
 *
 * This is how the first admin is set up when nobody can promote anyone yet.
 * The route is not behind the Clerk session; the header x-bootstrap-secret
 * must equal ADMIN_BOOTSTRAP_SECRET instead.
 *
 *   - secret unset: the route answers 404, as if it did not exist
 *   - secret shorter than 32 characters: 503, and nothing is compared (the
 *     route has no rate limit; the length is what keeps guessing hopeless)
 *   - wrong or missing header: 403
 *   - no user_roles row for the email (the Clerk webhook adds one when a
 *     user signs up; it has not added this user): 404
 *
 * Set the secret in the Vercel project and redeploy (Vercel applies a changed
 * variable to new deployments only), call the route with { "email": "..." },
 * then remove the secret and redeploy again. scripts/promote_admin.py
 * does the same with direct database access. A promotion is written to the
 * audit log; if that write fails (a database the API has not started on has
 * no audit log yet) the promotion stands and the failure is logged as a
 * warning.
 */
import { createHash, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { getSQL } from '@/lib/db';
import { ensureUserRolesTable } from '@/lib/roles';
import { recordRoleChange } from '@/lib/audit';
import type { Role } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The shortest secret the route works with, as for PRISM_JWT_SECRET. */
const MIN_SECRET_LENGTH = 32;

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

  const body = (await req.json().catch(() => null)) as BootstrapBody | null;
  const rawEmail = typeof body?.email === 'string' ? body.email.trim() : '';
  if (!rawEmail) {
    return NextResponse.json(
      { error: "Body must include { email: string }" },
      { status: 400 }
    );
  }
  const email = rawEmail.toLowerCase();

  await ensureUserRolesTable();
  const sql = getSQL();

  // No row is created here: the Clerk webhook adds a user's row when they sign
  // up, and a row without a Clerk user id would be a ghost.
  const rows = (await sql`
    SELECT clerk_user_id, role
      FROM user_roles
     WHERE lower(email) = ${email}
     LIMIT 1
  `) as Array<{ clerk_user_id: string; role: Role }>;

  if (rows.length === 0) {
    return NextResponse.json(
      { error: `No user with email ${email}: the Clerk webhook adds a user when they sign up` },
      { status: 404 }
    );
  }

  const { clerk_user_id: clerkUserId, role: previousRole } = rows[0];

  if (previousRole === 'admin') {
    return NextResponse.json({
      clerkUserId,
      email,
      role: 'admin',
      changed: false,
      note: 'User was already admin',
    });
  }

  await sql`
    UPDATE user_roles
       SET role = 'admin', updated_at = NOW()
     WHERE clerk_user_id = ${clerkUserId}
  `;

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
