/**
 * lib/roles.ts upsertUserRole: the first user becomes admin, everyone after
 * that viewer, and a known user keeps the role the table holds (an update
 * from Clerk refreshes the email only). It returns the stored role.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({ users: 0, stored: null as string | null, inserted: [] as unknown[][] }));
vi.mock('@/lib/db', () => ({
  getSQL: () => (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join('?').replace(/\s+/g, ' ').trim();
    if (query.startsWith('SELECT COUNT(*)')) return Promise.resolve([{ n: db.users }]);
    if (query.startsWith('INSERT INTO user_roles')) {
      db.inserted.push(values);
      return Promise.resolve([{ role: db.stored ?? values[2] }]);
    }
    return Promise.resolve([]);
  },
}));
vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn(), currentUser: vi.fn() }));

import { upsertUserRole } from '@/lib/roles';

beforeEach(() => {
  db.users = 0;
  db.stored = null;
  db.inserted = [];
});

describe('upsertUserRole', () => {
  it('makes the first user admin and stores the email in lower case', async () => {
    await expect(upsertUserRole('user_1', 'First@Example.com')).resolves.toBe('admin');
    expect(db.inserted[0]).toEqual(['user_1', 'first@example.com', 'admin']);
  });

  it('makes a later user viewer', async () => {
    db.users = 3;
    await expect(upsertUserRole('user_4', 'four@example.com')).resolves.toBe('viewer');
  });

  it('returns the role a known user already has', async () => {
    db.users = 3;
    db.stored = 'admin';   // the row exists; the upsert refreshes the email only
    await expect(upsertUserRole('user_1', 'new-address@example.com')).resolves.toBe('admin');
  });
});
