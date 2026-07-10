/**
 * Auth-seam pins for the Next API routes (review #7):
 *   /api/me      — 401 anonymous, 200 with role from Postgres
 *   /api/config  — GET requires auth; PUT requires admin (403 viewer,
 *                  401 anonymous, 200 admin forwards Bearer JWT)
 *   /api/trends/[id] — PUT requires admin (403 viewer, 401 anonymous,
 *                  200 admin forwards a role=admin Bearer JWT). This is the
 *                  proxy that makes Review & Endorse work: a direct /api/v1
 *                  call carries only the viewer cookie and would 403.
 * Clerk and Neon are mocked at module boundary; the backend fetch is
 * stubbed so PUT/GET forwarding (incl. Authorization header) is pinned.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const clerk = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));
vi.mock('@clerk/nextjs/server', () => clerk);

const db = vi.hoisted(() => ({
  roleRows: [] as Array<{ role: string }>,
  calls: [] as string[],
}));
vi.mock('@/lib/db', () => ({
  getSQL: () => (strings: TemplateStringsArray, ..._v: unknown[]) => {
    const q = strings.join('?');
    db.calls.push(q);
    if (q.includes('SELECT role')) return Promise.resolve(db.roleRows);
    return Promise.resolve([]);
  },
}));

vi.mock('next/headers', () => ({
  headers: () => new Map([['host', 'localhost:3000'], ['x-forwarded-proto', 'http']]),
}));

import { GET as meGET } from '@/app/api/me/route';
import { GET as cfgGET, PUT as cfgPUT } from '@/app/api/config/route';
import { PUT as trendPUT } from '@/app/api/trends/[id]/route';

const signedOut = () => clerk.auth.mockResolvedValue({ userId: null });
const signedIn = (role: 'admin' | 'viewer') => {
  clerk.auth.mockResolvedValue({ userId: 'user_1' });
  clerk.currentUser.mockResolvedValue({
    primaryEmailAddress: { emailAddress: 'a@b.de' },
  });
  db.roleRows = [{ role }];
};

beforeEach(() => {
  vi.clearAllMocks();
  db.roleRows = [];
  db.calls = [];
  process.env.PRISM_JWT_SECRET = 'x'.repeat(48);
  process.env.BACKEND_URL = 'http://backend.test';
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })));
});

describe('/api/me', () => {
  it('401 when not signed in', async () => {
    signedOut();
    const res = await meGET();
    expect(res.status).toBe(401);
  });
  it('200 with role from Postgres when signed in', async () => {
    signedIn('viewer');
    const res = await meGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ clerkUserId: 'user_1', email: 'a@b.de', role: 'viewer' });
  });
});

describe('/api/config', () => {
  it('GET: 401 anonymous', async () => {
    signedOut();
    const res = await cfgGET();
    expect(res.status).toBe(401);
  });
  it('GET: 200 signed-in, forwards Bearer token to backend', async () => {
    signedIn('viewer');
    const res = await cfgGET();
    expect(res.status).toBe(200);
    const call = vi.mocked(fetch).mock.calls[0];
    expect(String(call[0])).toBe('http://backend.test/api/v1/config');
    const hdrs = (call[1] as RequestInit).headers as Record<string, string>;
    expect(hdrs.Authorization).toMatch(/^Bearer /);
  });
  it('PUT: 401 anonymous', async () => {
    signedOut();
    const res = await cfgPUT(new Request('http://x/api/config', { method: 'PUT', body: '{}' }));
    expect(res.status).toBe(401);
  });
  it('PUT: 403 for viewer (admin-only gate lives here, not the client)', async () => {
    signedIn('viewer');
    const res = await cfgPUT(new Request('http://x/api/config', { method: 'PUT', body: '{}' }));
    expect(res.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('PUT: 200 for admin — forwards with Bearer JWT', async () => {
    signedIn('admin');
    const res = await cfgPUT(new Request('http://x/api/config', {
      method: 'PUT', body: JSON.stringify({ iterations: 5000 }),
    }));
    expect(res.status).toBe(200);
    const call = vi.mocked(fetch).mock.calls[0];
    const hdrs = (call[1] as RequestInit).headers as Record<string, string>;
    expect(hdrs.Authorization).toMatch(/^Bearer /);
    expect((call[1] as RequestInit).method).toBe('PUT');
  });
});

describe('/api/trends/[id] (endorse / admin trend edit)', () => {
  const params = { params: Promise.resolve({ id: 'trend_42' }) };
  const putReq = () => new Request('http://x/api/trends/trend_42', {
    method: 'PUT', body: JSON.stringify({ probability: 4 }),
  });

  it('PUT: 401 anonymous', async () => {
    signedOut();
    const res = await trendPUT(putReq(), params);
    expect(res.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('PUT: 403 for viewer — the admin gate is the proxy, not the client', async () => {
    signedIn('viewer');
    const res = await trendPUT(putReq(), params);
    expect(res.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('PUT: 200 for admin — forwards to /api/v1/trends/{id} with a Bearer JWT', async () => {
    signedIn('admin');
    const res = await trendPUT(putReq(), params);
    expect(res.status).toBe(200);
    const call = vi.mocked(fetch).mock.calls[0];
    expect(String(call[0])).toBe('http://backend.test/api/v1/trends/trend_42');
    const hdrs = (call[1] as RequestInit).headers as Record<string, string>;
    expect(hdrs.Authorization).toMatch(/^Bearer /);
    expect((call[1] as RequestInit).method).toBe('PUT');
  });
});
