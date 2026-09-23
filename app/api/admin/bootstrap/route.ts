/**
 * POST /api/admin/bootstrap: make a signed-up user admin with a shared secret.
 *
 * This is how the first admin is set up when nobody can promote anyone yet.
 * The route is not behind the Clerk session; the header x-bootstrap-secret
 * must equal ADMIN_BOOTSTRAP_SECRET instead.
 *
 *   - secret unset: the route answers 404, as if it did not exist
 *   - wrong or missing header: 403
 *   - no user_roles row for the email (the Clerk webhook adds one when a
 *     user signs up; it has not added this user): 404
 *
 * Set the secret in the Vercel project, call the route with
 * { "email": "..." }, then remove the secret again. scripts/promote_admin.py
 * does the same with direct database access. Every promotion is written to
 * the audit log.
 */
import { NextResponse } from 'next/server';
import { getSQL } from '@/lib/db';
import { ensureUserRolesTable } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface BootstrapBody {
  email?: unknown;
}

export async function POST(req: Request) {
  const expected = process.env.ADMIN_BOOTSTRAP_SECRET;
  if (!expected) {
    // Disabled here: do not reveal that the route exists.
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const provided = req.headers.get('x-bootstrap-secret');
  if (!provided || provided !== expected) {
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
  `) as Array<{ clerk_user_id: string; role: string }>;

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

  // Best effort: the promotion stands even if the audit entry fails.
  try {
    await sql`
      INSERT INTO audit_log (action, entity_type, entity_id, old_value, new_value, reason, user_id)
      VALUES (
        'role_change',
        'user',
        ${clerkUserId},
        ${previousRole},
        'admin',
        'via /api/admin/bootstrap (shared-secret)',
        'bootstrap'
      )
    `;
  } catch (auditErr) {
    console.warn('[/api/admin/bootstrap] audit write failed:', auditErr);
  }

  return NextResponse.json({
    clerkUserId,
    email,
    role: 'admin',
    changed: true,
    previousRole,
  });
}
