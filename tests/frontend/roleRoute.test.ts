/**
 * The admin's user management: GET /api/users lists every Clerk user with
 * their access, pending users first; /api/users/{userId}/role gives a user a
 * role, changes it, or takes it away.
 *
 *   - Only an admin may, and never for their own role.
 *   - PATCH on a pending user (no row) is the approval: the row is added with
 *     the email Clerk holds for them (the primary address, else the first).
 *     An id Clerk does not know is refused, and so is a user without an email
 *     address or with one Clerk has not verified. While
 *     PRISM_ALLOWED_EMAIL_DOMAINS is set, a pending user at another domain is
 *     refused; a user who has a role keeps it.
 *   - DELETE removes the row: the user is pending again.
 *   - A request that would change nothing changes and logs nothing; a change
 *     the database refuses because the user's access, or the admin's own
 *     role, changed in the meantime answers 409 and logs nothing.
 *   - Every change is written to the audit log.
 *
 * Clerk and the database are mocked at the module boundary. The fake
 * database plays each statement on a table of its own when the statement is
 * awaited, as the Neon driver's are, and keeps the audit entries it is sent;
 * `meanwhile` changes the table when a transaction starts, as another admin
 * would between the route's read and its write.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const clerk = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  getUser: vi.fn(),
  getUserList: vi.fn(),
}));
vi.mock('@clerk/nextjs/server', () => ({
  auth: clerk.auth,
  currentUser: clerk.currentUser,
  clerkClient: async () => ({ users: { getUser: clerk.getUser, getUserList: clerk.getUserList } }),
}));

const fake = vi.hoisted(() => {
  type Row = { email: string; role: string };
  const db = {
    roles: new Map<string, Row>(),
    audit: [] as unknown[][],
    transactions: 0,
    /** Run when a transaction starts, before its statement. */
    meanwhile: null as null | (() => void),
    /** What the next transaction throws instead of committing, as PostgreSQL does for the loser of a race. */
    conflict: null as null | { code: string },
  };
  const isAdmin = (id: unknown) => db.roles.get(id as string)?.role === 'admin';
  const ACTOR_IS_ADMIN = "EXISTS (SELECT 1 FROM user_roles WHERE clerk_user_id = ? AND role = 'admin')";
  function run(query: string, values: unknown[]): unknown[] {
    if (query.startsWith('CREATE TABLE')) return [];
    if (query === 'SELECT role FROM user_roles WHERE clerk_user_id = ?') {
      const row = db.roles.get(values[0] as string);
      return row ? [{ role: row.role }] : [];
    }
    if (query === 'SELECT clerk_user_id, role FROM user_roles') {
      return [...db.roles].map(([clerk_user_id, row]) => ({ clerk_user_id, role: row.role }));
    }
    if (query === `INSERT INTO user_roles (clerk_user_id, email, role) SELECT ?, ?, ? WHERE ${ACTOR_IS_ADMIN} `
      + 'ON CONFLICT (clerk_user_id) DO NOTHING RETURNING clerk_user_id') {
      const [user, email, role, actor] = values as string[];
      if (!isAdmin(actor) || db.roles.has(user)) return [];
      db.roles.set(user, { email, role });
      return [{ clerk_user_id: user }];
    }
    if (query === `UPDATE user_roles SET role = ?, updated_at = NOW() WHERE clerk_user_id = ? AND role = ? AND ${ACTOR_IS_ADMIN} `
      + 'RETURNING clerk_user_id') {
      const [role, user, from, actor] = values as string[];
      const row = db.roles.get(user);
      if (!isAdmin(actor) || row?.role !== from) return [];
      row.role = role;
      return [{ clerk_user_id: user }];
    }
    if (query === `DELETE FROM user_roles WHERE clerk_user_id = ? AND role = ? AND ${ACTOR_IS_ADMIN} RETURNING clerk_user_id`) {
      const [user, from, actor] = values as string[];
      if (!isAdmin(actor) || db.roles.get(user)?.role !== from) return [];
      db.roles.delete(user);
      return [{ clerk_user_id: user }];
    }
    if (query.startsWith('INSERT INTO audit_log')) {
      db.audit.push(values);
      return [];
    }
    throw new Error(`unexpected statement: ${query}`);
  }
  return { db, run };
});
const { db } = fake;

vi.mock('@/lib/db', () => ({
  getSQL: () => {
    const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join('?').replace(/\s+/g, ' ').trim();
      return {
        then: (resolve: (rows: unknown[]) => unknown, reject: (err: unknown) => unknown) => {
          try { return Promise.resolve(fake.run(query, values)).then(resolve, reject); } catch (err) { return reject(err); }
        },
      };
    };
    sql.transaction = async (statements: unknown[]) => {
      fake.db.transactions += 1;
      fake.db.meanwhile?.();
      const conflict = fake.db.conflict;
      fake.db.conflict = null;
      if (conflict) throw conflict;
      return Promise.all(statements);
    };
    return sql;
  },
}));

import { DELETE, PATCH } from '@/app/api/users/[userId]/role/route';
import { GET as listUsers } from '@/app/api/users/route';

const patch = (userId: string, body: unknown) =>
  PATCH(new Request(`https://prism.test/api/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify(body) }),
    { params: Promise.resolve({ userId }) });

const revoke = (userId: string) =>
  DELETE(new Request(`https://prism.test/api/users/${userId}/role`, { method: 'DELETE' }),
    { params: Promise.resolve({ userId }) });

const signedInAs = (userId: string) => {
  clerk.auth.mockResolvedValue({ userId });
  clerk.currentUser.mockResolvedValue({ primaryEmailAddress: { emailAddress: `${userId}@example.com` } });
};

/** Clerk's user: a primary address with this verification status (null: none recorded), or none. */
const clerkEmail = (address: string | null, status: string | null = 'verified') =>
  clerk.getUser.mockResolvedValue({
    primaryEmailAddress: address ? { emailAddress: address, verification: status ? { status } : null } : null,
    emailAddresses: [],
  });

const CHANGED_MEANWHILE = "This user's access, or your own role, changed in the meantime: reload the list and try again.";

beforeEach(() => {
  vi.clearAllMocks();
  db.roles.clear();
  db.audit = [];
  db.transactions = 0;
  db.meanwhile = null;
  db.conflict = null;
  db.roles.set('admin_1', { email: 'admin_1@example.com', role: 'admin' });
  db.roles.set('admin_2', { email: 'admin_2@example.com', role: 'admin' });
  db.roles.set('viewer_1', { email: 'viewer_1@example.com', role: 'viewer' });
});
afterEach(() => { delete process.env.PRISM_ALLOWED_EMAIL_DOMAINS; });

describe('GET /api/users', () => {
  /** A Clerk user as getUserList returns it, newest first. */
  const clerkUser = (id: string, email: string) => ({
    id, firstName: null, lastName: null, primaryEmailAddressId: `${id}_e`,
    emailAddresses: [{ id: `${id}_e`, emailAddress: email }], lastSignInAt: null, createdAt: null,
  });

  it('answers 403 for a viewer and lists nobody', async () => {
    signedInAs('viewer_1');
    expect((await listUsers()).status).toBe(403);
    expect(clerk.getUserList).not.toHaveBeenCalled();
  });

  it('lists a user without a row as pending, pending users first, in Clerk\'s order within each group', async () => {
    signedInAs('admin_1');
    clerk.getUserList.mockResolvedValue({
      data: [
        clerkUser('user_new2', 'new2@example.com'),
        clerkUser('viewer_1', 'viewer_1@example.com'),
        clerkUser('user_new1', 'new1@example.com'),
        clerkUser('admin_1', 'admin_1@example.com'),
      ],
    });
    const res = await listUsers();
    expect(res.status).toBe(200);
    const { users } = await res.json() as { users: Array<{ id: string; role: string }> };
    expect(users.map((u) => [u.id, u.role])).toEqual([
      ['user_new2', 'pending'], ['user_new1', 'pending'], ['viewer_1', 'viewer'], ['admin_1', 'admin'],
    ]);
    expect(clerk.getUserList).toHaveBeenCalledWith({ limit: 500, orderBy: '-created_at' });
  });
});

describe('PATCH /api/users/{userId}/role', () => {
  it('answers 401 without a session, and 403 for a viewer and for a pending user', async () => {
    clerk.auth.mockResolvedValue({ userId: null });
    expect((await patch('viewer_1', { role: 'admin' })).status).toBe(401);
    signedInAs('viewer_1');
    expect((await patch('viewer_1', { role: 'admin' })).status).toBe(403);
    signedInAs('user_pending');
    expect((await patch('user_pending', { role: 'admin' })).status).toBe(403);
    expect(db.roles.get('viewer_1')!.role).toBe('viewer');
    expect(db.roles.has('user_pending')).toBe(false);
  });

  it("refuses a role that is not admin or viewer, and an admin's change of their own role", async () => {
    signedInAs('admin_1');
    expect((await patch('viewer_1', { role: 'owner' })).status).toBe(400);
    expect((await patch('viewer_1', { role: 'pending' })).status).toBe(400);
    const own = await patch('admin_1', { role: 'viewer' });
    expect(own.status).toBe(400);
    expect((await own.json()).error).toBe("You can't change your own role. Ask another admin.");
    expect(db.roles.get('admin_1')!.role).toBe('admin');
  });

  it('changes the role and records who changed it', async () => {
    signedInAs('admin_1');
    const res = await patch('viewer_1', { role: 'admin' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ role: 'admin' });
    expect(db.roles.get('viewer_1')!.role).toBe('admin');
    expect(db.audit).toEqual([['viewer_1', 'viewer', 'admin', 'via /api/users/[userId]/role', 'admin_1']]);
  });

  it('changes and logs nothing when the user has that role already', async () => {
    signedInAs('admin_1');
    for (const [user, role] of [['viewer_1', 'viewer'], ['admin_1', 'admin']]) {
      const res = await patch(user!, { role });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ role });
    }
    expect(db.transactions).toBe(0);
    expect(db.audit).toEqual([]);
  });

  it('approves a pending user: their row, with the email Clerk holds, and the approval in the audit log', async () => {
    signedInAs('admin_1');
    clerkEmail('New.User@Example.com');
    const res = await patch('user_new', { role: 'viewer' });
    expect(res.status).toBe(200);
    expect(clerk.getUser).toHaveBeenCalledWith('user_new');
    expect(db.roles.get('user_new')).toEqual({ email: 'new.user@example.com', role: 'viewer' });
    expect(db.audit).toEqual([['user_new', null, 'viewer', 'via /api/users/[userId]/role', 'admin_1']]);
  });

  it('judges the primary address, not the first one Clerk lists', async () => {
    signedInAs('admin_1');
    clerk.getUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: 'ana@example.com', verification: { status: 'verified' } },
      emailAddresses: [
        { emailAddress: 'old@example.com', verification: { status: 'unverified' } },
        { emailAddress: 'ana@example.com', verification: { status: 'verified' } },
      ],
    });
    expect((await patch('user_new', { role: 'viewer' })).status).toBe(200);
    expect(db.roles.get('user_new')!.email).toBe('ana@example.com');
  });

  it('refuses an id Clerk does not know, and adds nothing', async () => {
    signedInAs('admin_1');
    clerk.getUser.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));
    const res = await patch('user_unknown', { role: 'viewer' });
    expect(res.status).toBe(404);
    expect(db.roles.has('user_unknown')).toBe(false);
    expect(db.audit).toEqual([]);
  });

  it('refuses a user without an email address, and adds nothing', async () => {
    signedInAs('admin_1');
    clerkEmail(null);
    const res = await patch('user_no_email', { role: 'viewer' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/no email address/);
    expect(db.roles.has('user_no_email')).toBe(false);
    expect(db.audit).toEqual([]);
  });

  it('refuses a user whose address Clerk has not verified, whatever the reason, and adds nothing', async () => {
    signedInAs('admin_1');
    for (const status of ['unverified', 'expired', 'failed', null]) {
      clerkEmail('ana@henkel.com', status);
      const res = await patch('user_unverified', { role: 'viewer' });
      expect(res.status).toBe(409);
      expect((await res.json()).error)
        .toBe('Clerk has not verified ana@henkel.com yet; approve the user once they have confirmed it.');
    }
    expect(db.roles.has('user_unverified')).toBe(false);
    expect(db.audit).toEqual([]);
  });

  it('answers 409 and logs nothing when the user was approved, changed or removed in the meantime', async () => {
    signedInAs('admin_1');
    clerkEmail('new@example.com');
    db.meanwhile = () => { db.roles.set('user_new', { email: 'new@example.com', role: 'admin' }); };
    const approval = await patch('user_new', { role: 'viewer' });
    expect(approval.status).toBe(409);
    expect((await approval.json()).error).toBe(CHANGED_MEANWHILE);
    expect(db.roles.get('user_new')!.role).toBe('admin');

    db.meanwhile = () => { db.roles.delete('viewer_1'); };
    expect((await patch('viewer_1', { role: 'admin' })).status).toBe(409);
    expect(db.roles.has('viewer_1')).toBe(false);
    expect(db.audit).toEqual([]);
  });

  it('answers 409 when the admin lost their own role in the meantime', async () => {
    signedInAs('admin_2');
    db.meanwhile = () => { db.roles.get('admin_2')!.role = 'viewer'; };
    const res = await patch('admin_1', { role: 'viewer' });
    expect(res.status).toBe(409);
    expect(db.roles.get('admin_1')!.role).toBe('admin');
    expect(db.audit).toEqual([]);
  });

  it('answers 409 to the loser of two changes at the same moment, so two admins cannot demote each other', async () => {
    signedInAs('admin_2');
    db.conflict = { code: '40001' };
    const res = await patch('admin_1', { role: 'viewer' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe(CHANGED_MEANWHILE);
    expect(db.roles.get('admin_1')!.role).toBe('admin');
    expect(db.audit).toEqual([]);
  });

  describe('while PRISM_ALLOWED_EMAIL_DOMAINS is set', () => {
    beforeEach(() => { process.env.PRISM_ALLOWED_EMAIL_DOMAINS = 'henkel.com, consultancy.example'; });

    it('refuses to approve an address at another domain, and adds nothing', async () => {
      signedInAs('admin_1');
      clerkEmail('someone@gmail.com');
      const res = await patch('user_outside', { role: 'viewer' });
      expect(res.status).toBe(403);
      expect((await res.json()).error)
        .toBe('Only addresses at henkel.com, consultancy.example can be given a role here (PRISM_ALLOWED_EMAIL_DOMAINS).');
      expect(db.roles.has('user_outside')).toBe(false);
      expect(db.audit).toEqual([]);
    });

    it('approves an address at a listed domain', async () => {
      signedInAs('admin_1');
      clerkEmail('Ana@Henkel.com');
      expect((await patch('user_inside', { role: 'viewer' })).status).toBe(200);
      expect(db.roles.get('user_inside')).toEqual({ email: 'ana@henkel.com', role: 'viewer' });
    });

    it('still changes the role of a user who has one, whatever their domain', async () => {
      signedInAs('admin_1');
      expect((await patch('viewer_1', { role: 'admin' })).status).toBe(200);
      expect(db.roles.get('viewer_1')!.role).toBe('admin');
      expect(clerk.getUser).not.toHaveBeenCalled();
    });
  });
});

describe('DELETE /api/users/{userId}/role', () => {
  it('answers 401 without a session and 403 for a viewer, removing nothing', async () => {
    clerk.auth.mockResolvedValue({ userId: null });
    expect((await revoke('viewer_1')).status).toBe(401);
    signedInAs('viewer_1');
    expect((await revoke('admin_1')).status).toBe(403);
    expect(db.roles.get('admin_1')!.role).toBe('admin');
  });

  it("refuses an admin's removal of their own role", async () => {
    signedInAs('admin_1');
    const own = await revoke('admin_1');
    expect(own.status).toBe(400);
    expect((await own.json()).error).toBe("You can't change your own role. Ask another admin.");
    expect(db.roles.get('admin_1')!.role).toBe('admin');
  });

  it('takes the role away, so the user is pending again, and records who did it', async () => {
    signedInAs('admin_1');
    const res = await revoke('viewer_1');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ role: 'pending' });
    expect(db.roles.has('viewer_1')).toBe(false);
    expect(db.audit).toEqual([['viewer_1', 'viewer', null, 'via /api/users/[userId]/role', 'admin_1']]);
  });

  it('changes nothing for a user who is pending already, and writes no audit entry', async () => {
    signedInAs('admin_1');
    const res = await revoke('user_pending');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ role: 'pending' });
    expect(db.transactions).toBe(0);
    expect(db.audit).toEqual([]);
  });

  it('answers 409 and removes nothing when the role changed in the meantime, or two admins act at once', async () => {
    signedInAs('admin_1');
    db.meanwhile = () => { db.roles.get('viewer_1')!.role = 'admin'; };
    expect((await revoke('viewer_1')).status).toBe(409);
    expect(db.roles.get('viewer_1')!.role).toBe('admin');

    db.meanwhile = null;
    db.conflict = { code: '40001' };
    expect((await revoke('admin_2')).status).toBe(409);
    expect(db.roles.get('admin_2')!.role).toBe('admin');
    expect(db.audit).toEqual([]);
  });
});
