/**
 * PATCH /api/users/{userId}/role: an admin changes another user's role.
 *
 *   - Only an admin may, and never their own role.
 *   - A user the webhook has not added yet gets their row first, with the
 *     email Clerk holds for them; an id Clerk does not know is refused, and
 *     so is a user without an email address, whom the webhook skips too.
 *   - The change is written to the audit log.
 *
 * Clerk and the database are mocked at the module boundary; the fake
 * database keeps the user_roles rows and the audit entries it is sent.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const clerk = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock('@clerk/nextjs/server', () => ({
  auth: clerk.auth,
  currentUser: clerk.currentUser,
  clerkClient: async () => ({ users: { getUser: clerk.getUser } }),
}));

type Row = { email: string; role: string };
const db = vi.hoisted(() => ({ roles: new Map<string, Row>(), audit: [] as unknown[][] }));
vi.mock('@/lib/db', () => ({
  getSQL: () => (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join('?').replace(/\s+/g, ' ').trim();
    if (query.startsWith('SELECT role')) {
      const row = db.roles.get(values[0] as string);
      return Promise.resolve(row ? [{ role: row.role }] : []);
    }
    if (query.startsWith('SELECT COUNT(*)')) return Promise.resolve([{ n: db.roles.size }]);
    if (query.startsWith('INSERT INTO user_roles')) {
      const [id, email, role] = values as [string, string, string];
      if (!db.roles.has(id)) db.roles.set(id, { email, role });
      else db.roles.get(id)!.email = email;
      return Promise.resolve([{ role: db.roles.get(id)!.role }]);
    }
    if (query.startsWith('UPDATE user_roles')) {
      const [role, id] = values as [string, string];
      if (db.roles.has(id)) db.roles.get(id)!.role = role;
      return Promise.resolve([]);
    }
    if (query.startsWith('INSERT INTO audit_log')) db.audit.push(values);
    return Promise.resolve([]);
  },
}));

import { PATCH } from '@/app/api/users/[userId]/role/route';

const patch = (userId: string, body: unknown) =>
  PATCH(new Request(`https://prism.test/api/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify(body) }),
    { params: Promise.resolve({ userId }) });

const signedInAs = (userId: string) => {
  clerk.auth.mockResolvedValue({ userId });
  clerk.currentUser.mockResolvedValue({ primaryEmailAddress: { emailAddress: `${userId}@example.com` } });
};

beforeEach(() => {
  vi.clearAllMocks();
  db.roles.clear();
  db.audit = [];
  db.roles.set('admin_1', { email: 'admin_1@example.com', role: 'admin' });
  db.roles.set('viewer_1', { email: 'viewer_1@example.com', role: 'viewer' });
});

describe('PATCH /api/users/{userId}/role', () => {
  it('answers 401 without a session and 403 for a viewer', async () => {
    clerk.auth.mockResolvedValue({ userId: null });
    expect((await patch('viewer_1', { role: 'admin' })).status).toBe(401);
    signedInAs('viewer_1');
    expect((await patch('viewer_1', { role: 'admin' })).status).toBe(403);
    expect(db.roles.get('viewer_1')!.role).toBe('viewer');
  });

  it("refuses a role that is not admin or viewer, and an admin's change of their own role", async () => {
    signedInAs('admin_1');
    expect((await patch('viewer_1', { role: 'owner' })).status).toBe(400);
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

  it('adds a user the webhook has not reached with the email Clerk holds', async () => {
    signedInAs('admin_1');
    clerk.getUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: 'New.User@Example.com' }, emailAddresses: [],
    });
    const res = await patch('user_new', { role: 'admin' });
    expect(res.status).toBe(200);
    expect(clerk.getUser).toHaveBeenCalledWith('user_new');
    expect(db.roles.get('user_new')).toEqual({ email: 'new.user@example.com', role: 'admin' });
    expect(db.audit).toEqual([['user_new', null, 'admin', 'via /api/users/[userId]/role', 'admin_1']]);
  });

  it('refuses an id Clerk does not know, and adds nothing', async () => {
    signedInAs('admin_1');
    clerk.getUser.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));
    const res = await patch('user_unknown', { role: 'viewer' });
    expect(res.status).toBe(404);
    expect(db.roles.has('user_unknown')).toBe(false);
    expect(db.audit).toEqual([]);
  });

  it('refuses a user without an email address, as the webhook does, and adds nothing', async () => {
    signedInAs('admin_1');
    clerk.getUser.mockResolvedValue({ primaryEmailAddress: null, emailAddresses: [] });
    const res = await patch('user_no_email', { role: 'viewer' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/no email address/);
    expect(db.roles.has('user_no_email')).toBe(false);
    expect(db.audit).toEqual([]);
  });
});
