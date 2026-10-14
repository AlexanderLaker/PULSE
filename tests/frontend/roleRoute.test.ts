/**
 * The admin's user management: GET /api/users lists every Clerk user with
 * their access, pending users first; /api/users/{userId}/role gives a user a
 * role, changes it, or takes it away.
 *
 *   - Only an admin may, and never for their own role.
 *   - PATCH on a pending user (no row) is the approval: the row is added with
 *     the email Clerk holds for them. An id Clerk does not know is refused,
 *     and so is a user without an email address or with one Clerk has not
 *     verified. While PRISM_ALLOWED_EMAIL_DOMAINS is set, a pending user at
 *     another domain is refused; a user who has a role keeps it.
 *   - DELETE removes the row: the user is pending again.
 *   - Every change is written to the audit log.
 *
 * Clerk and the database are mocked at the module boundary; the fake
 * database keeps the user_roles rows and the audit entries it is sent.
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

type Row = { email: string; role: string };
const db = vi.hoisted(() => ({ roles: new Map<string, Row>(), audit: [] as unknown[][] }));
vi.mock('@/lib/db', () => ({
  getSQL: () => (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join('?').replace(/\s+/g, ' ').trim();
    if (query.startsWith('CREATE TABLE')) return Promise.resolve([]);
    if (query.startsWith('SELECT role')) {
      const row = db.roles.get(values[0] as string);
      return Promise.resolve(row ? [{ role: row.role }] : []);
    }
    if (query.startsWith('SELECT clerk_user_id, role FROM user_roles')) {
      return Promise.resolve([...db.roles].map(([clerk_user_id, row]) => ({ clerk_user_id, role: row.role })));
    }
    if (query.startsWith('INSERT INTO user_roles')) {
      // ON CONFLICT (clerk_user_id) DO NOTHING ... RETURNING role
      const [id, email, role] = values as [string, string, string];
      if (db.roles.has(id)) return Promise.resolve([]);
      db.roles.set(id, { email, role });
      return Promise.resolve([{ role }]);
    }
    if (query.startsWith('UPDATE user_roles SET role')) {
      const [role, id] = values as [string, string];
      if (db.roles.has(id)) db.roles.get(id)!.role = role;
      return Promise.resolve([]);
    }
    if (query.startsWith('DELETE FROM user_roles')) {
      const id = values[0] as string;
      const row = db.roles.get(id);
      db.roles.delete(id);
      return Promise.resolve(row ? [{ role: row.role }] : []);
    }
    if (query.startsWith('INSERT INTO audit_log')) {
      db.audit.push(values);
      return Promise.resolve([]);
    }
    throw new Error(`unexpected statement: ${query}`);
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

const clerkEmail = (address: string | null, status = 'verified') =>
  clerk.getUser.mockResolvedValue({
    primaryEmailAddress: address ? { emailAddress: address, verification: { status } } : null, emailAddresses: [],
  });

beforeEach(() => {
  vi.clearAllMocks();
  db.roles.clear();
  db.audit = [];
  db.roles.set('admin_1', { email: 'admin_1@example.com', role: 'admin' });
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

  it('approves a pending user: their row, with the email Clerk holds, and the approval in the audit log', async () => {
    signedInAs('admin_1');
    clerkEmail('New.User@Example.com');
    const res = await patch('user_new', { role: 'viewer' });
    expect(res.status).toBe(200);
    expect(clerk.getUser).toHaveBeenCalledWith('user_new');
    expect(db.roles.get('user_new')).toEqual({ email: 'new.user@example.com', role: 'viewer' });
    expect(db.audit).toEqual([['user_new', null, 'viewer', 'via /api/users/[userId]/role', 'admin_1']]);
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

  it('refuses a user whose address Clerk has not verified, and adds nothing', async () => {
    signedInAs('admin_1');
    clerkEmail('ana@henkel.com', 'unverified');
    const res = await patch('user_unverified', { role: 'viewer' });
    expect(res.status).toBe(409);
    expect((await res.json()).error)
      .toBe('Clerk has not verified ana@henkel.com yet; approve the user once they have confirmed it.');
    expect(db.roles.has('user_unverified')).toBe(false);
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
    expect(db.audit).toEqual([]);
  });
});
