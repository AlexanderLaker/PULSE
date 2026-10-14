/**
 * POST /api/admin/bootstrap: the first admin, set up with a shared secret for
 * the address in ADMIN_BOOTSTRAP_EMAIL. The route does not exist while
 * ADMIN_BOOTSTRAP_SECRET is unset, does not work with a secret under 32
 * characters, refuses a wrong secret, works for the named address only and
 * only once it has signed up in Clerk and Clerk has verified it, refuses once
 * an admin exists, and writes the promotion to the audit log.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const clerk = vi.hoisted(() => ({ getUserList: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: async () => ({ users: { getUserList: clerk.getUserList } }),
}));

const db = vi.hoisted(() => ({
  /** The role row the named user has, if any. */
  existingRole: null as string | null,
  admins: [] as unknown[],
  queries: [] as string[],
  transactions: [] as Array<{ isolationLevel?: string }>,
  /** What the transaction throws instead of committing, as PostgreSQL does for the loser of a race. */
  conflict: null as null | { code: string },
}));
vi.mock('@/lib/db', () => ({
  getSQL: () => {
    const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join('?').replace(/\s+/g, ' ').trim();
      db.queries.push(query);
      if (query.startsWith('SELECT role FROM user_roles')) {
        return Promise.resolve(db.existingRole ? [{ role: db.existingRole }] : []);
      }
      // The conditional insert or promotion: no row changes while an admin exists.
      if (query.startsWith('INSERT INTO user_roles')) {
        return Promise.resolve(db.admins.length > 0 ? [] : [{ clerk_user_id: values[0] }]);
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
const NAMED = 'first.admin@example.com';

const call = (secret: string | null, body: unknown = { email: 'First.Admin@Example.com' }) =>
  POST(new Request('https://prism.test/api/admin/bootstrap', {
    method: 'POST',
    headers: secret == null ? {} : { 'x-bootstrap-secret': secret },
    body: JSON.stringify(body),
  }));

const wrote = (start: string) => db.queries.some((q) => q.startsWith(start));

/** The Clerk user who signs in with the named address, as getUserList returns them. */
const clerkUser = (status: string) => ({
  id: 'user_7',
  emailAddresses: [
    { emailAddress: 'other@example.com', verification: { status: 'verified' } },
    { emailAddress: 'First.Admin@Example.com', verification: { status } },
  ],
});

beforeEach(() => {
  db.existingRole = null;
  db.admins = [];
  db.queries = [];
  db.transactions = [];
  db.conflict = null;
  clerk.getUserList.mockReset();
  clerk.getUserList.mockResolvedValue({ data: [clerkUser('verified')] });
  process.env.ADMIN_BOOTSTRAP_SECRET = SECRET;
  process.env.ADMIN_BOOTSTRAP_EMAIL = ` ${NAMED.toUpperCase()} `;
});
afterEach(() => {
  delete process.env.ADMIN_BOOTSTRAP_SECRET;
  delete process.env.ADMIN_BOOTSTRAP_EMAIL;
});

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
    expect(clerk.getUserList).not.toHaveBeenCalled();
  });

  it('does not work while ADMIN_BOOTSTRAP_EMAIL is unset', async () => {
    delete process.env.ADMIN_BOOTSTRAP_EMAIL;
    const res = await call(SECRET);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain('ADMIN_BOOTSTRAP_EMAIL is not set');
    expect(db.queries).toEqual([]);
  });

  it('refuses a body without an email, and any address but the named one', async () => {
    expect((await call(SECRET, {})).status).toBe(400);
    const other = await call(SECRET, { email: 'someone.else@example.com' });
    expect(other.status).toBe(403);
    expect((await other.json()).error).toBe('Only the address in ADMIN_BOOTSTRAP_EMAIL can become the first admin');
    expect(db.queries).toEqual([]);
    expect(clerk.getUserList).not.toHaveBeenCalled();
  });

  it('refuses while no Clerk user signs in with the address, and writes nothing', async () => {
    clerk.getUserList.mockResolvedValue({ data: [] });
    const res = await call(SECRET);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe(`No Clerk user signs in with ${NAMED}: sign up with it first`);
    expect(clerk.getUserList).toHaveBeenCalledWith({ emailAddress: [NAMED], limit: 1 });
    expect(wrote('INSERT INTO user_roles')).toBe(false);
  });

  it('refuses while Clerk has not verified the address for that user, and writes nothing', async () => {
    clerk.getUserList.mockResolvedValue({ data: [clerkUser('unverified')] });
    const res = await call(SECRET);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe(`Clerk has not verified ${NAMED} for this user yet: confirm it first`);
    expect(wrote('INSERT INTO user_roles')).toBe(false);
  });

  it('adds the pending user as admin and writes the approval to the audit log', async () => {
    const res = await call(SECRET);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      clerkUserId: 'user_7', email: NAMED, role: 'admin', changed: true, previousRole: null,
    });
    expect(wrote('INSERT INTO user_roles')).toBe(true);
    expect(wrote('INSERT INTO audit_log')).toBe(true);
  });

  it('promotes the named user from viewer', async () => {
    db.existingRole = 'viewer';
    const res = await call(SECRET);
    expect(res.status).toBe(200);
    expect((await res.json()).previousRole).toBe('viewer');
  });

  it('checks for an admin and adds or promotes in one statement of a serializable transaction', async () => {
    await call(SECRET);
    const [insert] = db.queries.filter((q) => q.startsWith('INSERT INTO user_roles'));
    expect(insert).toContain("WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE role = 'admin')");
    expect(insert).toContain("ON CONFLICT (clerk_user_id) DO UPDATE SET role = 'admin'");
    expect(db.transactions).toEqual([{ isolationLevel: 'Serializable' }]);
    expect(wrote('SELECT 1 FROM user_roles')).toBe(false);
  });

  it('changes nothing for a user who is admin already', async () => {
    db.existingRole = 'admin';
    const res = await call(SECRET);
    expect(res.status).toBe(200);
    expect((await res.json()).changed).toBe(false);
    expect(db.transactions).toEqual([]);
  });

  it('refuses once an admin exists, and writes no audit entry', async () => {
    db.admins = [{ '?column?': 1 }];
    const res = await call(SECRET);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain('An admin exists already');
    expect(wrote('INSERT INTO audit_log')).toBe(false);
  });

  it('refuses the loser of two calls at the same moment', async () => {
    db.conflict = { code: '40001' };
    const res = await call(SECRET);
    expect(res.status).toBe(409);
    expect(wrote('INSERT INTO audit_log')).toBe(false);
  });

  it('lets any other database failure through', async () => {
    db.conflict = { code: '08006' };
    await expect(call(SECRET)).rejects.toEqual({ code: '08006' });
  });
});
