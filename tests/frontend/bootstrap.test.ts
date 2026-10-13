/**
 * POST /api/admin/bootstrap: the first admin, set up with a shared secret. The
 * route does not exist while ADMIN_BOOTSTRAP_SECRET is unset, does not work
 * with a secret under 32 characters, refuses a wrong secret, never creates a
 * user, refuses once an admin exists, and writes the promotion to the audit
 * log.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const db = vi.hoisted(() => ({
  rows: [] as Array<{ clerk_user_id: string; role: string }>,
  admins: [] as unknown[],
  queries: [] as string[],
  transactions: [] as Array<{ isolationLevel?: string }>,
  /** What the transaction throws instead of committing, as PostgreSQL does for the loser of a race. */
  conflict: null as null | { code: string },
}));
vi.mock('@/lib/db', () => ({
  getSQL: () => {
    const sql = (strings: TemplateStringsArray) => {
      const query = strings.join('?').replace(/\s+/g, ' ').trim();
      db.queries.push(query);
      if (query.startsWith('SELECT clerk_user_id')) return Promise.resolve(db.rows);
      // The conditional promotion: no row changes while an admin exists.
      if (query.startsWith("UPDATE user_roles SET role = 'admin'")) {
        return Promise.resolve(db.admins.length > 0 ? [] : [{ clerk_user_id: db.rows[0]?.clerk_user_id }]);
      }
      return Promise.resolve([]);
    };
    sql.transaction = async (queries: Array<Promise<unknown>>, opts: { isolationLevel?: string }) => {
      db.transactions.push(opts);
      if (db.conflict) throw db.conflict;
      return Promise.all(queries);
    };
    return sql;
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
  db.admins = [];
  db.queries = [];
  db.transactions = [];
  db.conflict = null;
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

  it('checks for an admin and promotes in one statement of a serializable transaction', async () => {
    db.rows = [{ clerk_user_id: 'user_7', role: 'viewer' }];
    await call(SECRET);
    const [update] = db.queries.filter((q) => q.startsWith('UPDATE user_roles'));
    expect(update).toContain("AND NOT EXISTS (SELECT 1 FROM user_roles WHERE role = 'admin')");
    expect(db.transactions).toEqual([{ isolationLevel: 'Serializable' }]);
    expect(db.queries.some((q) => q.startsWith('SELECT 1 FROM user_roles'))).toBe(false);
  });

  it('refuses once an admin exists, and writes no audit entry', async () => {
    db.rows = [{ clerk_user_id: 'user_8', role: 'viewer' }];
    db.admins = [{ '?column?': 1 }];
    const res = await call(SECRET);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain('An admin exists already');
    expect(db.queries.some((q) => q.startsWith('INSERT INTO audit_log'))).toBe(false);
  });

  it('refuses the loser of two calls at the same moment', async () => {
    db.rows = [{ clerk_user_id: 'user_9', role: 'viewer' }];
    db.conflict = { code: '40001' };
    const res = await call(SECRET);
    expect(res.status).toBe(409);
    expect(db.queries.some((q) => q.startsWith('INSERT INTO audit_log'))).toBe(false);
  });

  it('lets any other database failure through', async () => {
    db.rows = [{ clerk_user_id: 'user_9', role: 'viewer' }];
    db.conflict = { code: '08006' };
    await expect(call(SECRET)).rejects.toEqual({ code: '08006' });
  });
});
