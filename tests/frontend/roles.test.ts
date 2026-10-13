/**
 * lib/roles.ts.
 *
 *   - upsertUserRole: the first user becomes admin, everyone after that
 *     viewer, and a known user keeps the role the table holds (an update from
 *     Clerk refreshes the email only). It returns the stored role and whether
 *     the row is new, which the webhook writes to the audit log.
 *   - deleteUserRole returns the role the removed row held.
 *   - The table is created once per server instance, again after a failure,
 *     and a collision with another instance creating it is no failure.
 *
 * The fake database below plays the statement it is sent: an insert adds a
 * row unless the id is known, and an update applies only the assignments its
 * SET clause names, as PostgreSQL does.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    if (query.startsWith('SELECT COUNT(*)')) return Promise.resolve([{ n: db.table.size }]);
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
    return Promise.resolve([]);
  },
}));
vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn(), currentUser: vi.fn() }));

import { deleteUserRole, upsertUserRole } from '@/lib/roles';

beforeEach(() => { db.table.clear(); });

describe('upsertUserRole', () => {
  it('makes the first user admin and stores the email in lower case', async () => {
    await expect(upsertUserRole('user_1', 'First@Example.com')).resolves.toEqual({ role: 'admin', created: true });
    expect(db.table.get('user_1')).toEqual({ email: 'first@example.com', role: 'admin' });
  });

  it('makes a later user viewer', async () => {
    await upsertUserRole('user_1', 'first@example.com');
    await expect(upsertUserRole('user_2', 'second@example.com')).resolves.toEqual({ role: 'viewer', created: true });
  });

  it('keeps the role of a known user and refreshes the email only', async () => {
    await upsertUserRole('user_1', 'first@example.com');
    await upsertUserRole('user_2', 'second@example.com');
    db.table.get('user_2')!.role = 'admin';   // promoted in Settings
    await expect(upsertUserRole('user_2', 'New-Address@Example.com'))
      .resolves.toEqual({ role: 'admin', created: false });
    expect(db.table.get('user_2')).toEqual({ email: 'new-address@example.com', role: 'admin' });
  });
});

describe('deleteUserRole', () => {
  it('removes the row and returns the role it held, or null for an unknown user', async () => {
    await upsertUserRole('user_1', 'first@example.com');
    await expect(deleteUserRole('user_1')).resolves.toBe('admin');
    expect(db.table.has('user_1')).toBe(false);
    await expect(deleteUserRole('user_1')).resolves.toBeNull();
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
    await roles.upsertUserRole('user_3', 'c@example.com');
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
