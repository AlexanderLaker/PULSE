/**
 * lib/roles.ts.
 *
 *   - A user who signs up has no row and is pending: requireAuth says
 *     'pending', requireRole and requireAdmin refuse them.
 *   - changeAccess approves a pending user (their row, the email in lower
 *     case), changes a role or takes it away, each in one statement of a
 *     serializable transaction, and only while the user's access is still the
 *     one the admin saw and the admin is still admin; a serialization failure
 *     (two admins at the same moment) is a change not made.
 *   - refreshUserEmail stores a known user's new email and returns their
 *     role; it adds no row for a pending user.
 *   - deleteUserRole returns the role the removed row held.
 *   - PRISM_ALLOWED_EMAIL_DOMAINS: exact domains, any domain while unset.
 *   - The table is created once per server instance, again after a failure,
 *     and a collision with another instance creating it is no failure.
 *
 * The fake database below plays each statement it is sent on a table of its
 * own, as PostgreSQL would, when the statement is awaited (as the Neon
 * driver's are), so a transaction that fails runs nothing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fake = vi.hoisted(() => {
  type Row = { email: string; role: string };
  const db = {
    table: new Map<string, Row>(),
    creates: 0,
    createError: null as null | (Error & { code?: string }),
    transactions: [] as Array<{ isolationLevel?: string } | undefined>,
    /** What the next transaction throws instead of committing, as PostgreSQL does for the loser of a race. */
    conflict: null as null | { code: string },
  };
  const isAdmin = (id: unknown) => db.table.get(id as string)?.role === 'admin';
  const ACTOR_IS_ADMIN = "EXISTS (SELECT 1 FROM user_roles WHERE clerk_user_id = ? AND role = 'admin')";
  function run(query: string, values: unknown[]): unknown[] {
    if (query.startsWith('CREATE TABLE')) {
      db.creates += 1;
      const error = db.createError;
      db.createError = null;
      if (error) throw error;
      return [];
    }
    if (query === 'SELECT role FROM user_roles WHERE clerk_user_id = ?') {
      const row = db.table.get(values[0] as string);
      return row ? [{ role: row.role }] : [];
    }
    if (query === `INSERT INTO user_roles (clerk_user_id, email, role) SELECT ?, ?, ? WHERE ${ACTOR_IS_ADMIN} `
      + 'ON CONFLICT (clerk_user_id) DO NOTHING RETURNING clerk_user_id') {
      const [user, email, role, actor] = values as string[];
      if (!isAdmin(actor) || db.table.has(user)) return [];
      db.table.set(user, { email, role });
      return [{ clerk_user_id: user }];
    }
    if (query === `UPDATE user_roles SET role = ?, updated_at = NOW() WHERE clerk_user_id = ? AND role = ? AND ${ACTOR_IS_ADMIN} `
      + 'RETURNING clerk_user_id') {
      const [role, user, from, actor] = values as string[];
      const row = db.table.get(user);
      if (!isAdmin(actor) || row?.role !== from) return [];
      row.role = role;
      return [{ clerk_user_id: user }];
    }
    if (query === `DELETE FROM user_roles WHERE clerk_user_id = ? AND role = ? AND ${ACTOR_IS_ADMIN} RETURNING clerk_user_id`) {
      const [user, from, actor] = values as string[];
      if (!isAdmin(actor) || db.table.get(user)?.role !== from) return [];
      db.table.delete(user);
      return [{ clerk_user_id: user }];
    }
    if (query === 'UPDATE user_roles SET email = ?, updated_at = NOW() WHERE clerk_user_id = ? RETURNING role') {
      const [email, user] = values as string[];
      const row = db.table.get(user);
      if (!row) return [];
      row.email = email;
      return [{ role: row.role }];
    }
    if (query === 'DELETE FROM user_roles WHERE clerk_user_id = ? RETURNING role') {
      const row = db.table.get(values[0] as string);
      db.table.delete(values[0] as string);
      return row ? [{ role: row.role }] : [];
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
    sql.transaction = async (statements: unknown[], opts?: { isolationLevel?: string }) => {
      fake.db.transactions.push(opts);
      const conflict = fake.db.conflict;
      fake.db.conflict = null;
      if (conflict) throw conflict;
      return Promise.all(statements);
    };
    return sql;
  },
}));
const clerk = vi.hoisted(() => ({ auth: vi.fn(), currentUser: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => clerk);

import {
  allowedEmailDomains, changeAccess, deleteUserRole, ForbiddenError, mayBeApproved, refreshUserEmail,
  requireAdmin, requireAuth, requireRole, UnauthorizedError,
} from '@/lib/roles';

const signedIn = (id: string | null) => {
  clerk.auth.mockResolvedValue({ userId: id });
  clerk.currentUser.mockResolvedValue(
    id ? { primaryEmailAddress: { emailAddress: 'ana@example.com' }, fullName: ' Ana Lima ' } : null);
};

beforeEach(() => {
  db.table.clear();
  db.transactions = [];
  db.conflict = null;
});

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

describe('changeAccess', () => {
  beforeEach(() => {
    db.table.set('admin_1', { email: 'admin_1@example.com', role: 'admin' });
    db.table.set('admin_2', { email: 'admin_2@example.com', role: 'admin' });
    db.table.set('viewer_1', { email: 'viewer_1@example.com', role: 'viewer' });
  });

  it('approves a pending user with the email in lower case, in a serializable transaction', async () => {
    await expect(changeAccess({ actor: 'admin_1', user: 'user_new', from: 'pending', to: 'viewer', email: 'Ana@Example.com' }))
      .resolves.toBe(true);
    expect(db.table.get('user_new')).toEqual({ email: 'ana@example.com', role: 'viewer' });
    expect(db.transactions).toEqual([{ isolationLevel: 'Serializable' }]);
  });

  it('changes a role, and takes one away', async () => {
    await expect(changeAccess({ actor: 'admin_1', user: 'viewer_1', from: 'viewer', to: 'admin' })).resolves.toBe(true);
    expect(db.table.get('viewer_1')!.role).toBe('admin');
    await expect(changeAccess({ actor: 'admin_1', user: 'viewer_1', from: 'admin', to: 'pending' })).resolves.toBe(true);
    expect(db.table.has('viewer_1')).toBe(false);
    expect(db.transactions).toHaveLength(2);
  });

  it('makes no change once the user\'s access is no longer what the admin saw', async () => {
    // Approved by someone else in the meantime.
    db.table.set('user_new', { email: 'new@example.com', role: 'admin' });
    await expect(changeAccess({ actor: 'admin_1', user: 'user_new', from: 'pending', to: 'viewer', email: 'new@example.com' }))
      .resolves.toBe(false);
    expect(db.table.get('user_new')!.role).toBe('admin');
    // Promoted, or removed, in the meantime.
    await expect(changeAccess({ actor: 'admin_1', user: 'admin_2', from: 'viewer', to: 'pending' })).resolves.toBe(false);
    expect(db.table.get('admin_2')!.role).toBe('admin');
    await expect(changeAccess({ actor: 'admin_1', user: 'user_gone', from: 'viewer', to: 'admin' })).resolves.toBe(false);
    expect(db.table.has('user_gone')).toBe(false);
  });

  it('makes no change for an admin who is admin no longer', async () => {
    db.table.get('admin_2')!.role = 'viewer';
    await expect(changeAccess({ actor: 'admin_2', user: 'admin_1', from: 'admin', to: 'viewer' })).resolves.toBe(false);
    await expect(changeAccess({ actor: 'admin_2', user: 'viewer_1', from: 'viewer', to: 'pending' })).resolves.toBe(false);
    await expect(changeAccess({ actor: 'admin_2', user: 'user_new', from: 'pending', to: 'admin', email: 'x@example.com' }))
      .resolves.toBe(false);
    expect(db.table.get('admin_1')!.role).toBe('admin');
    expect(db.table.has('viewer_1')).toBe(true);
    expect(db.table.has('user_new')).toBe(false);
  });

  it('reports the loser of two changes at the same moment as not made, and lets any other failure through', async () => {
    db.conflict = { code: '40001' };
    await expect(changeAccess({ actor: 'admin_1', user: 'admin_2', from: 'admin', to: 'viewer' })).resolves.toBe(false);
    expect(db.table.get('admin_2')!.role).toBe('admin');
    db.conflict = { code: '08006' };
    await expect(changeAccess({ actor: 'admin_1', user: 'admin_2', from: 'admin', to: 'viewer' }))
      .rejects.toEqual({ code: '08006' });
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
    expect(mayBeApproved('ana@henkel.com@evil.example')).toBe(false);
    expect(mayBeApproved('henkel.com')).toBe(false);
    expect(mayBeApproved('@henkel.com')).toBe(false);
  });

  it('takes the domain after the last @, so a quoted local part with an @ in it still counts', () => {
    process.env.PRISM_ALLOWED_EMAIL_DOMAINS = 'henkel.com';
    expect(mayBeApproved('"a@b"@henkel.com')).toBe(true);
    expect(mayBeApproved('"a@henkel.com"@evil.example')).toBe(false);
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
    await roles.refreshUserEmail('user_3', 'c@example.com');
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
