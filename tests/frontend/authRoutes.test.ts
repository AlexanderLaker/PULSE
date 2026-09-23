/**
 * The dashboard's server routes around the PRISM API: who may call them and
 * what they forward.
 *
 *   /api/me            the signed-in user and the role from user_roles
 *   /api/drivers/{id}  an admin edit of a driver, forwarded with an admin token
 *   /api/journey       an admin save of the journey content, forwarded likewise
 *
 * Clerk and the database are mocked at the module boundary; the forwarded
 * request is captured from a stubbed fetch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const clerk = vi.hoisted(() => ({ auth: vi.fn(), currentUser: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => clerk);

const db = vi.hoisted(() => ({ roleRows: [] as Array<{ role: string }> }));
vi.mock('@/lib/db', () => ({
  getSQL: () => (strings: TemplateStringsArray) =>
    Promise.resolve(strings.join('?').includes('SELECT role') ? db.roleRows : []),
}));

vi.mock('next/headers', () => ({
  headers: () => new Map([['host', 'prism.test'], ['x-forwarded-proto', 'https']]),
}));

import { GET as meGET } from '@/app/api/me/route';
import { PUT as driverPUT } from '@/app/api/drivers/[id]/route';
import { PUT as journeyPUT } from '@/app/api/journey/route';

const signedOut = () => clerk.auth.mockResolvedValue({ userId: null });
const signedIn = (role: 'admin' | 'viewer') => {
  clerk.auth.mockResolvedValue({ userId: 'user_1' });
  clerk.currentUser.mockResolvedValue({ primaryEmailAddress: { emailAddress: 'a@b.de' } });
  db.roleRows = [{ role }];
};
const answer = (status: number, body: unknown) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  })));
const forwarded = () => {
  const [url, init] = vi.mocked(fetch).mock.calls[0];
  const headers = (init as RequestInit).headers as Record<string, string>;
  const token = headers.Authorization.replace(/^Bearer /, '');
  return {
    url: String(url),
    method: (init as RequestInit).method,
    body: JSON.parse(String((init as RequestInit).body)),
    claims: JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()),
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  db.roleRows = [];
  process.env.PRISM_JWT_SECRET = 'x'.repeat(48);
  answer(200, { status: 'updated', driver_id: 'consumer_r01', changed: ['probability'], revision: 2 });
});

describe('/api/me', () => {
  it('answers 401 without a session', async () => {
    signedOut();
    expect((await meGET()).status).toBe(401);
  });

  it('returns the user with the role from user_roles', async () => {
    signedIn('viewer');
    const res = await meGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ clerkUserId: 'user_1', email: 'a@b.de', role: 'viewer' });
  });
});

describe('/api/drivers/{id}', () => {
  const params = { params: Promise.resolve({ id: 'consumer_r01' }) };
  const edit = (body: unknown = { revision: 1, probability: 4 }) =>
    new Request('https://prism.test/api/drivers/consumer_r01', { method: 'PUT', body: JSON.stringify(body) });

  it('answers 401 without a session and 403 for a viewer, forwarding nothing', async () => {
    signedOut();
    expect((await driverPUT(edit(), params)).status).toBe(401);
    signedIn('viewer');
    expect((await driverPUT(edit(), params)).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards an admin's edit to the API on the same origin with an admin token", async () => {
    signedIn('admin');
    const res = await driverPUT(edit(), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'updated', driver_id: 'consumer_r01', changed: ['probability'], revision: 2 });
    const call = forwarded();
    expect(call.url).toBe('https://prism.test/api/v1/drivers/consumer_r01');
    expect(call.method).toBe('PUT');
    expect(call.body).toEqual({ revision: 1, probability: 4 });
    expect(call.claims).toMatchObject({ sub: 'user_1', email: 'a@b.de', role: 'admin' });
    expect(call.claims.exp - Date.now() / 1000).toBeLessThanOrEqual(300);
  });

  it('calls the API on PRISM_API_ORIGIN when that is set', async () => {
    signedIn('admin');
    process.env.PRISM_API_ORIGIN = 'https://prism-hcb.vercel.app/';
    try {
      await driverPUT(edit(), params);
      expect(forwarded().url).toBe('https://prism-hcb.vercel.app/api/v1/drivers/consumer_r01');
    } finally {
      delete process.env.PRISM_API_ORIGIN;
    }
  });

  it('passes a refusal of a stale edit through as 409', async () => {
    signedIn('admin');
    answer(409, { detail: 'This driver was changed after you opened it.' });
    const res = await driverPUT(edit(), params);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('This driver was changed after you opened it.');
  });

  it('answers 502 with an unknown outcome when the API gives no answer to a forwarded edit', async () => {
    signedIn('admin');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('socket hang up'); }));
    const res = await driverPUT(edit(), params);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('The PRISM API gave no answer, so the change may or may not have been saved.');
  });

  it('refuses a body that is not a JSON object', async () => {
    signedIn('admin');
    const res = await driverPUT(edit([1, 2]), params);
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("turns the API's validation list into one readable line", async () => {
    signedIn('admin');
    answer(422, { detail: [{ loc: ['body', 'peak_year'], msg: 'Input should be greater than or equal to 2025' }] });
    const res = await driverPUT(edit({ peak_year: 2020 }), params);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('peak_year: Input should be greater than or equal to 2025');
  });

  it('answers 503 when the token secret is missing', async () => {
    signedIn('admin');
    delete process.env.PRISM_JWT_SECRET;
    const res = await driverPUT(edit(), params);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain('PRISM_JWT_SECRET');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('/api/journey', () => {
  const save = (body: unknown) =>
    new Request('https://prism.test/api/journey', { method: 'PUT', body: JSON.stringify(body) });
  const empty = { lhc: [], hair: [] };

  it('answers 403 for a viewer', async () => {
    signedIn('viewer');
    expect((await journeyPUT(save({ base_version: 0, content: empty }))).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses a body without the version it was edited from, or without both journeys', async () => {
    signedIn('admin');
    const noVersion = await journeyPUT(save({ content: empty }));
    expect(noVersion.status).toBe(400);
    expect((await noVersion.json()).error).toMatch(/^base_version must be/);
    const oneJourney = await journeyPUT(save({ base_version: 3, content: { lhc: [] } }));
    expect(oneJourney.status).toBe(400);
    expect((await oneJourney.json()).error).toBe('content must hold the lhc and hair journeys as arrays');
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards an admin's save to PUT /api/v1/journey", async () => {
    signedIn('admin');
    answer(200, { status: 'saved', version: 4, tiles: 0 });
    const res = await journeyPUT(save({ base_version: 3, content: empty }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'saved', version: 4, tiles: 0 });
    expect(forwarded().url).toBe('https://prism.test/api/v1/journey');
    expect(forwarded().body).toEqual({ base_version: 3, content: empty });
  });

  it('passes a conflict through as 409 with its message', async () => {
    signedIn('admin');
    answer(409, { detail: 'The journey content was saved by someone else after you opened it.' });
    const res = await journeyPUT(save({ base_version: 3, content: empty }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('The journey content was saved by someone else after you opened it.');
  });
});
