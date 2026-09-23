/**
 * lib/roles.ts upsertUserRole: the first user becomes admin, everyone after
 * that viewer, and a known user keeps the role the table holds (an update
 * from Clerk refreshes the email only). It returns the stored role.
 *
 * The fake database below plays the statement it is sent: an insert adds the
 * row, and on a conflict it applies only the assignments the statement's
 * DO UPDATE SET clause names, as PostgreSQL does.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

type Row = { email: string; role: string };
const db = vi.hoisted(() => ({ table: new Map<string, Row>() }));

vi.mock('@/lib/db', () => ({
  getSQL: () => (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join('?').replace(/\s+/g, ' ').trim();
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
