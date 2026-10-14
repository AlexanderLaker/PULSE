/**
 * lib/roles.ts.
 *
 *   - A user who signs up has no row and is pending: requireAuth says
 *     'pending', requireRole and requireAdmin refuse them.
 *   - addUserRole approves a pending user (their row, the email in lower
 *     case); a row that appeared in the meantime gets the role instead.
 *   - refreshUserEmail stores a known user's new email and returns their
 *     role; it adds no row for a pending user.
 *   - deleteUserRole returns the role the removed row held.
 *   - PRISM_ALLOWED_EMAIL_DOMAINS: exact domains, any domain while unset.
 *   - The table is created once per server instance, again after a failure,
 *     and a collision with another instance creating it is no failure.
 *
 * The fake database below plays the statement it is sent: an insert adds a
 * row unless the id is known, and an update applies only the assignments its
 * SET clause names, as PostgreSQL does.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type Row = { email: string; role: string };
const db = vi.hoisted(() => ({
  table: new Map<string, Row>(),
  creates: 0,
  createError: null as null | (Error & { code?: string }),
}));

vi.mock('@/lib/db', () => ({
  getSQL: () => (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join('?').replace(/\s+/g, ' ').trim();
    if (query.startsWith('CREATE TABLE')) {
      db.creates += 1;
      const error = db.createError;
      db.createError = null;
      return error ? Promise.reject(error) : Promise.resolve([]);
    }
    if (query.startsWith('SELECT role')) {
      return Promise.resolve(db.table.has(values[0] as string) ? [{ role: db.table.get(values[0] as string)!.role }] : []);
    }
    if (query.startsWith('INSERT INTO user_roles')) {
      // ON CONFLICT DO NOTHING: a known id is left as it is and returns no row.
      if (!query.includes('ON CONFLICT (clerk_user_id) DO NOTHING')) throw new Error(`unexpected insert: ${query}`);
      const [id, email, role] = values as [string, string, string];
      if (db.table.has(id)) return Promise.resolve([]);
      db.table.set(id, { email, role });
      return Promise.resolve([{ role }]);
    }
    if (query.startsWith('UPDATE user_roles SET')) {
      // Only the assignments the statement names change, as in PostgreSQL.
      const assignments = query.split(/\bSET\b/i)[1].split(/\bWHERE\b/i)[0];
      const id = values[values.length - 1] as string;
      const row = db.table.get(id);
      if (!row) return Promise.resolve([]);
      if (/\bemail\s*=/.test(assignments)) row.email = values[0] as string;
      if (/\brole\s*=/.test(assignments)) row.role = values[0] as string;
      return Promise.resolve(/RETURNING role/i.test(query) ? [{ role: row.role }] : []);
    }
    if (query.startsWith('DELETE FROM user_roles')) {
      const id = values[0] as string;
      const row = db.table.get(id);
      db.table.delete(id);
      return Promise.resolve(row ? [{ role: row.role }] : []);
    }
    throw new Error(`unexpected statement: ${query}`);
  },
}));
const clerk = vi.hoisted(() => ({ auth: vi.fn(), currentUser: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => clerk);

import {
  addUserRole, allowedEmailDomains, deleteUserRole, ForbiddenError, mayBeApproved, refreshUserEmail,
  requireAdmin, requireAuth, requireRole, UnauthorizedError,
} from '@/lib/roles';

const signedIn = (id: string | null) => {
  clerk.auth.mockResolvedValue({ userId: id });
  clerk.currentUser.mockResolvedValue(
    id ? { primaryEmailAddress: { emailAddress: 'ana@example.com' }, fullName: ' Ana Lima ' } : null);
};

beforeEach(() => { db.table.clear(); });

describe('a user without a row', () => {
  it('is pending: requireAuth says so, and requireRole and requireAdmin refuse them', async () => {
    signedIn('user_1');
    await expect(requireAuth()).resolves.toEqual({
      clerkUserId: 'user_1', email: 'ana@example.com', name: 'Ana Lima', role: 'pending',
    });
    await expect(requireRole()).rejects.toThrow(ForbiddenError);
    await expect(requireAdmin()).rejects.toThrow(ForbiddenError);
  });

  it('has access once the row exists, and only an admin passes requireAdmin', async () => {
    signedIn('user_1');
    db.table.set('user_1', { email: 'ana@example.com', role: 'viewer' });
    await expect(requireRole()).resolves.toMatchObject({ clerkUserId: 'user_1', role: 'viewer' });
    await expect(requireAdmin()).rejects.toThrow('Admin role required');
    db.table.get('user_1')!.role = 'admin';
    await expect(requireAdmin()).resolves.toMatchObject({ clerkUserId: 'user_1' });
  });

  it('is no user at all without a session', async () => {
    signedIn(null);
    await expect(requireAuth()).rejects.toThrow(UnauthorizedError);
    await expect(requireRole()).rejects.toThrow(UnauthorizedError);
  });
});

describe('addUserRole', () => {
  it('adds the row of a pending user with the email in lower case', async () => {
    await addUserRole('user_1', 'Ana@Example.com', 'viewer');
    expect(db.table.get('user_1')).toEqual({ email: 'ana@example.com', role: 'viewer' });
  });

  it('sets the role of a row that appeared in the meantime instead', async () => {
    db.table.set('user_1', { email: 'ana@example.com', role: 'viewer' });
    await addUserRole('user_1', 'ana@example.com', 'admin');
    expect(db.table.get('user_1')).toEqual({ email: 'ana@example.com', role: 'admin' });
  });
});

describe('refreshUserEmail', () => {
  it("stores a known user's new email and returns their role", async () => {
    db.table.set('user_1', { email: 'ana@example.com', role: 'admin' });
    await expect(refreshUserEmail('user_1', 'New-Address@Example.com')).resolves.toBe('admin');
    expect(db.table.get('user_1')).toEqual({ email: 'new-address@example.com', role: 'admin' });
  });

  it('adds no row for a pending user', async () => {
    await expect(refreshUserEmail('user_2', 'bo@example.com')).resolves.toBeNull();
    expect(db.table.size).toBe(0);
  });
});

describe('deleteUserRole', () => {
  it('removes the row and returns the role it held, or null for a user without one', async () => {
    db.table.set('user_1', { email: 'ana@example.com', role: 'admin' });
    await expect(deleteUserRole('user_1')).resolves.toBe('admin');
    expect(db.table.has('user_1')).toBe(false);
    await expect(deleteUserRole('user_1')).resolves.toBeNull();
  });
});

describe('PRISM_ALLOWED_EMAIL_DOMAINS', () => {
  afterEach(() => { delete process.env.PRISM_ALLOWED_EMAIL_DOMAINS; });

  it('lets any address be approved while it is unset or empty', () => {
    expect(allowedEmailDomains()).toEqual([]);
    expect(mayBeApproved('anyone@anywhere.example')).toBe(true);
    process.env.PRISM_ALLOWED_EMAIL_DOMAINS = ' , ';
    expect(mayBeApproved('anyone@anywhere.example')).toBe(true);
  });

  it('reads a comma-separated list in lower case, with or without a leading @', () => {
    process.env.PRISM_ALLOWED_EMAIL_DOMAINS = ' Henkel.com, @consultancy.example ,';
    expect(allowedEmailDomains()).toEqual(['henkel.com', 'consultancy.example']);
  });

  it('matches the domain exactly: a subdomain, a lookalike or an address without a domain is refused', () => {
    process.env.PRISM_ALLOWED_EMAIL_DOMAINS = 'henkel.com';
    expect(mayBeApproved('ana@henkel.com')).toBe(true);
    expect(mayBeApproved('Ana@HENKEL.COM')).toBe(true);
    expect(mayBeApproved('ana@mail.henkel.com')).toBe(false);
    expect(mayBeApproved('ana@henkel.com.example')).toBe(false);
    expect(mayBeApproved('ana@not-henkel.com')).toBe(false);
    expect(mayBeApproved('henkel.com')).toBe(false);
    expect(mayBeApproved('@henkel.com')).toBe(false);
  });
});

describe('the user_roles table', () => {
  beforeEach(() => {
    vi.resetModules();
    db.creates = 0;
  });

  it('is created once per server instance', async () => {
    const roles = await import('@/lib/roles');
    await roles.getRole('user_1');
    await roles.getRole('user_2');
    await roles.addUserRole('user_3', 'c@example.com', 'viewer');
    expect(db.creates).toBe(1);
  });

  it('is created again after a failure', async () => {
    const roles = await import('@/lib/roles');
    db.createError = Object.assign(new Error('connection reset'), { code: '08006' });
    await expect(roles.getRole('user_1')).rejects.toThrow('connection reset');
    await expect(roles.getRole('user_1')).resolves.toBeNull();
    expect(db.creates).toBe(2);
  });

  it('exists when another instance created it at the same moment', async () => {
    const roles = await import('@/lib/roles');
    db.createError = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
    await expect(roles.getRole('user_1')).resolves.toBeNull();
    await roles.getRole('user_1');
    expect(db.creates).toBe(1);
  });
});
