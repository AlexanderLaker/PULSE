/**
 * F3: /api/prism-cookie must mint a VIEWER-ONLY engine token into an
 * httpOnly, SameSite=Lax cookie scoped to /api/v1 — and refuse anonymous
 * callers. The viewer-only claim is the CSRF backstop: the cookie can
 * never satisfy require_admin on the engine.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const clerk = vi.hoisted(() => ({ auth: vi.fn(), currentUser: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => clerk);
const db = vi.hoisted(() => ({ roleRows: [] as Array<{ role: string }> }));
vi.mock('@/lib/db', () => ({
  getSQL: () => (strings: TemplateStringsArray, ..._v: unknown[]) =>
    Promise.resolve(strings.join('?').includes('SELECT role') ? db.roleRows : []),
}));

import { GET as cookieGET } from '@/app/api/prism-cookie/route';

beforeEach(() => {
  vi.clearAllMocks();
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
    clerk.currentUser.mockResolvedValue({ primaryEmailAddress: { emailAddress: 'a@b.de' } });
    db.roleRows = [{ role: 'admin' }]; // even admins get a viewer cookie
    const res = await cookieGET();
    expect(res.status).toBe(200);
    const sc = res.headers.get('set-cookie')!;
    expect(sc).toContain('pulse-token=');
    expect(sc.toLowerCase()).toContain('httponly');
    expect(sc.toLowerCase()).toContain('samesite=lax');
    expect(sc).toContain('Path=/api/v1');
    const token = /pulse-token=([^;]+)/.exec(sc)![1];
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    expect(payload.role).toBe('viewer');
    expect(payload.sub).toBe('user_admin');
  });

  it('503 when PRISM_JWT_SECRET is missing (configured:false surfaced)', async () => {
    delete process.env.PRISM_JWT_SECRET;
    clerk.auth.mockResolvedValue({ userId: 'user_1' });
    clerk.currentUser.mockResolvedValue({ primaryEmailAddress: { emailAddress: 'a@b.de' } });
    db.roleRows = [{ role: 'viewer' }];
    const res = await cookieGET();
    expect(res.status).toBe(503);
    expect((await res.json()).configured).toBe(false);
  });
});
