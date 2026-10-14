/**
 * /api/prism-cookie: the cookie the API reads need. It carries a viewer token
 * for every user with a role, admins included, in an httpOnly SameSite=Lax
 * cookie scoped to /api/v1 that lasts thirty minutes, so a request riding on
 * it can never authorise an admin write. Callers without a session get no
 * cookie, a pending user (no row in user_roles) gets 403 and none, and so
 * does everyone while the role cannot be read (500). DELETE expires the
 * cookie.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const clerk = vi.hoisted(() => ({ auth: vi.fn(), currentUser: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => clerk);
const db = vi.hoisted(() => ({ roleRows: [] as Array<{ role: string }>, down: false }));
vi.mock('@/lib/db', () => ({
  getSQL: () => (strings: TemplateStringsArray, ..._v: unknown[]) => {
    if (db.down) return Promise.reject(new Error('connection refused'));
    return Promise.resolve(strings.join('?').includes('SELECT role') ? db.roleRows : []);
  },
}));

import { DELETE as cookieDELETE, GET as cookieGET } from '@/app/api/prism-cookie/route';

const signedIn = (role: 'admin' | 'viewer' | null) => {
  clerk.auth.mockResolvedValue({ userId: 'user_1' });
  clerk.currentUser.mockResolvedValue({ primaryEmailAddress: { emailAddress: 'a@b.de' } });
  db.roleRows = role ? [{ role }] : [];
};

beforeEach(() => {
  vi.clearAllMocks();
  db.down = false;
  process.env.PRISM_JWT_SECRET = 'y'.repeat(48);
});

describe('/api/prism-cookie', () => {
  it('401 anonymous, no cookie set', async () => {
    clerk.auth.mockResolvedValue({ userId: null });
    const res = await cookieGET();
    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('mints viewer-only httpOnly SameSite=Lax cookie for signed-in ADMIN', async () => {
    clerk.auth.mockResolvedValue({ userId: 'user_admin' });
    clerk.currentUser.mockResolvedValue({ primaryEmailAddress: { emailAddress: 'a@b.de' }, fullName: 'Ana Admin' });
    db.roleRows = [{ role: 'admin' }]; // even admins get a viewer cookie
    const res = await cookieGET();
    expect(res.status).toBe(200);
    const sc = res.headers.get('set-cookie')!;
    expect(sc).toContain('prism-token=');
    expect(sc.toLowerCase()).toContain('httponly');
    expect(sc.toLowerCase()).toContain('samesite=lax');
    expect(sc).toContain('Path=/api/v1');
    expect(sc).toContain('Max-Age=1800');
    const token = /prism-token=([^;]+)/.exec(sc)![1];
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    expect(payload.role).toBe('viewer');
    expect(payload.sub).toBe('user_admin');
    expect(payload.name).toBe('Ana Admin');   // shown with the user's expert proposals
    const left = payload.exp - Math.floor(Date.now() / 1000);
    expect(left).toBeGreaterThan(1790);
    expect(left).toBeLessThanOrEqual(1800);
  });

  it('mints the same viewer cookie for a viewer', async () => {
    signedIn('viewer');
    const res = await cookieGET();
    expect(res.status).toBe(200);
    const token = /prism-token=([^;]+)/.exec(res.headers.get('set-cookie')!)![1];
    expect(JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).role).toBe('viewer');
  });

  it('403 for a pending user, whom no admin has approved: no cookie set', async () => {
    signedIn(null);
    const res = await cookieGET();
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('Access awaits approval');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('500 and no cookie while the role cannot be read, naming the failed check', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    signedIn('viewer');
    db.down = true;
    const res = await cookieGET();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Access could not be checked');
    expect(res.headers.get('set-cookie')).toBeNull();
    vi.mocked(console.error).mockRestore();
  });

  it('DELETE expires the cookie on its path', async () => {
    const res = cookieDELETE();
    expect(res.status).toBe(200);
    const sc = res.headers.get('set-cookie')!;
    expect(sc).toMatch(/^prism-token=;/);
    expect(sc).toContain('Max-Age=0');
    expect(sc).toContain('Path=/api/v1');
    expect(sc.toLowerCase()).toContain('httponly');
  });

  it('503 when PRISM_JWT_SECRET is missing, naming the setting', async () => {
    delete process.env.PRISM_JWT_SECRET;
    clerk.auth.mockResolvedValue({ userId: 'user_1' });
    clerk.currentUser.mockResolvedValue({ primaryEmailAddress: { emailAddress: 'a@b.de' } });
    db.roleRows = [{ role: 'viewer' }];
    const res = await cookieGET();
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('PRISM_JWT_SECRET is not configured');
  });
});
