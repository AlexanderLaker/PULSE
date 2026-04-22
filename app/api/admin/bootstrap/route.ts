/**
 * POST /api/admin/bootstrap — one-shot admin promotion.
 *
 * This route solves the chicken-and-egg problem of "I need to be admin to
 * promote myself, but nobody is admin yet." It accepts an email, looks up
 * the matching `user_roles` row, and sets `role = 'admin'`.
 *
 * Security model: this endpoint is NOT gated by Clerk auth — the sandbox
 * can't reach Neon directly to run a migration, so we need something
 * Alex (or another trusted operator) can hit from anywhere that can
 * reach the Vercel deployment. Instead, authorization comes from a
 * shared secret (`ADMIN_BOOTSTRAP_SECRET`) set as a Vercel env var.
 *
 *   - If the secret env var is unset → endpoint is disabled (404-style).
 *   - If the secret env var is set but the header doesn't match → 403.
 *   - If the target email has no row in `user_roles` → 404.
 *
 * Intended workflow:
 *   1. Set `ADMIN_BOOTSTRAP_SECRET=<random>` in the Vercel project env.
 *   2. Redeploy (happens automatically after `git push`).
 *   3. curl with `x-bootstrap-secret: <random>` and `{ "email": "..." }`.
 *   4. UNSET the env var once promotion is confirmed.
 *
 * Every promotion writes an `audit_log` row so the action is traceable
 * even after the secret is rotated away.
 */
import { NextResponse } from 'next/server';
import { getSQL } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface BootstrapBody {
  email?: unknown;
}

export async function POST(req: Request) {
  const expected = process.env.ADMIN_BOOTSTRAP_SECRET;
  if (!expected) {
    // Disabled in this environment — refuse to acknowledge existence.
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

  const sql = getSQL();

  // Ensure the table exists (idempotent) — matches lib/roles.ts.
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

  // Look up the existing row. We don't create one here — if the email
  // isn't in user_roles yet, the Clerk webhook hasn't fired, which means
  // the user hasn't signed up. Better to surface that as 404 than to
  // insert a ghost row with no clerk_user_id.
  const rows = (await sql`
    SELECT clerk_user_id, role
      FROM user_roles
     WHERE lower(email) = ${email}
     LIMIT 1
  `) as Array<{ clerk_user_id: string; role: string }>;

  if (rows.length === 0) {
    return NextResponse.json(
      { error: `No user with email ${email} has signed in yet` },
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

  // Audit entry — best effort. The promotion still succeeds if this fails.
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
