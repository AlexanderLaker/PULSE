/**
 * lib/roles.ts.
 *
 *   - upsertUserRole: the first user becomes admin, everyone after that
 *     viewer, and a known user keeps the role the table holds (an update from
 *     Clerk refreshes the email only). It returns the stored role.
 *   - The table is created once per server instance, again after a failure,
 *     and a collision with another instance creating it is no failure.
 *
 * The fake database below plays the statement it is sent: an insert adds the
 * row, and on a conflict it applies only the assignments the statement's
 * DO UPDATE SET clause names, as PostgreSQL does.
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
      const [id, email, role] = values as [string, string, string];
      const existing = db.table.get(id);
      if (!existing) {
        db.table.set(id, { email, role });
      } else {
        const assignments = query.split(/DO UPDATE SET/i)[1]?.split(/RETURNING/i)[0] ?? '';
        if (/\bemail\s*=/.test(assignments)) existing.email = email;
        if (/\brole\s*=/.test(assignments)) existing.role = role;
      }
      return Promise.resolve(/RETURNING role/i.test(query) ? [{ role: db.table.get(id)!.role }] : []);
    }
    return Promise.resolve([]);
  },
}));
vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn(), currentUser: vi.fn() }));

import { upsertUserRole } from '@/lib/roles';

beforeEach(() => { db.table.clear(); });

describe('upsertUserRole', () => {
  it('makes the first user admin and stores the email in lower case', async () => {
    await expect(upsertUserRole('user_1', 'First@Example.com')).resolves.toBe('admin');
    expect(db.table.get('user_1')).toEqual({ email: 'first@example.com', role: 'admin' });
  });

  it('makes a later user viewer', async () => {
    await upsertUserRole('user_1', 'first@example.com');
    await expect(upsertUserRole('user_2', 'second@example.com')).resolves.toBe('viewer');
  });

  it('keeps the role of a known user and refreshes the email only', async () => {
    await upsertUserRole('user_1', 'first@example.com');
    await upsertUserRole('user_2', 'second@example.com');
    db.table.get('user_2')!.role = 'admin';   // promoted in Settings
    await expect(upsertUserRole('user_2', 'New-Address@Example.com')).resolves.toBe('admin');
    expect(db.table.get('user_2')).toEqual({ email: 'new-address@example.com', role: 'admin' });
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
