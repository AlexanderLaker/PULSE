/**
 * POST /api/admin/bootstrap: the first admin, set up with a shared secret. The
 * route does not exist while ADMIN_BOOTSTRAP_SECRET is unset, does not work
 * with a secret under 32 characters, refuses a wrong secret, never creates a
 * user, and writes the promotion to the audit log.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const db = vi.hoisted(() => ({ rows: [] as Array<{ clerk_user_id: string; role: string }>, queries: [] as string[] }));
vi.mock('@/lib/db', () => ({
  getSQL: () => (strings: TemplateStringsArray) => {
    const query = strings.join('?').replace(/\s+/g, ' ').trim();
    db.queries.push(query);
    return Promise.resolve(query.startsWith('SELECT clerk_user_id') ? db.rows : []);
  },
}));
vi.mock('@/lib/roles', () => ({ ensureUserRolesTable: vi.fn(async () => undefined) }));

import { POST } from '@/app/api/admin/bootstrap/route';

/** A made-up secret of forty characters. */
const SECRET = 'x'.repeat(40);

const call = (secret: string | null, body: unknown = { email: 'First.Admin@Example.com' }) =>
  POST(new Request('https://prism.test/api/admin/bootstrap', {
    method: 'POST',
    headers: secret == null ? {} : { 'x-bootstrap-secret': secret },
    body: JSON.stringify(body),
  }));

beforeEach(() => {
  db.rows = [];
  db.queries = [];
  process.env.ADMIN_BOOTSTRAP_SECRET = SECRET;
});
afterEach(() => { delete process.env.ADMIN_BOOTSTRAP_SECRET; });

describe('/api/admin/bootstrap', () => {
  it('does not exist while the secret is unset', async () => {
    delete process.env.ADMIN_BOOTSTRAP_SECRET;
    expect((await call('anything')).status).toBe(404);
    expect(db.queries).toEqual([]);
  });

  it('does not work with a secret shorter than 32 characters', async () => {
    process.env.ADMIN_BOOTSTRAP_SECRET = 'short-secret';
    const res = await call('short-secret');
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain('shorter than 32 characters');
    expect(db.queries).toEqual([]);
  });

  it('refuses a missing or wrong secret, including one that only starts right', async () => {
    for (const secret of [null, 'wrong', SECRET.slice(0, 30), `${SECRET}-and-more`]) {
      expect((await call(secret)).status).toBe(403);
    }
    expect(db.queries).toEqual([]);
  });

  it('never creates a user the Clerk webhook has not added', async () => {
    const res = await call(SECRET);
    expect(res.status).toBe(404);
    expect(db.queries.some((q) => q.startsWith('INSERT INTO user_roles'))).toBe(false);
  });

  it('promotes an existing user and writes the audit log', async () => {
    db.rows = [{ clerk_user_id: 'user_7', role: 'viewer' }];
    const res = await call(SECRET);
    expect(res.status).toBe(200);
    expect(db.queries.some((q) => q.startsWith("UPDATE user_roles SET role = 'admin'"))).toBe(true);
    expect(db.queries.some((q) => q.startsWith('INSERT INTO audit_log'))).toBe(true);
  });
});
