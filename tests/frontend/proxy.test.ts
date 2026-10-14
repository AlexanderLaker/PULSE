/**
 * proxy.ts: which requests need a Clerk session, and the role check in front
 * of the dashboard. Pages without a session go to the sign-in page, the
 * waiting page included, and dashboard routes answer 401; the sign-in pages,
 * the webhook, the bootstrap route and the PRISM API are left to their own
 * checks, and so is expiring the viewer cookie, which a page whose session
 * has ended must still be able to do. /dashboard also needs a role: a
 * signed-in user without one, and everyone while user_roles cannot be read,
 * is redirected to /pending before the App Router renders anything. No other
 * route reads the role here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: (handler: unknown) => handler,
  createRouteMatcher: (patterns: string[]) => (req: NextRequest) =>
    patterns.some((p) => new RegExp(`^${p}$`).test(req.nextUrl.pathname)),
}));

const roles = vi.hoisted(() => ({ getRole: vi.fn() }));
vi.mock('@/lib/roles', () => roles);

import proxy from '@/proxy';

type Handler = (auth: () => Promise<unknown>, req: NextRequest) => Promise<Response | undefined>;
const handler = proxy as unknown as Handler;

function run(path: string, method = 'GET', userId: string | null = null, headers: Record<string, string> = {}) {
  const redirectToSignIn = vi.fn(() => new Response(null, { status: 307 }));
  const auth = vi.fn(async () => ({ userId, redirectToSignIn }));
  const result = handler(auth, new NextRequest(`https://prism.test${path}`, { method, headers }));
  return { result, auth, redirectToSignIn };
}

beforeEach(() => {
  vi.clearAllMocks();
  roles.getRole.mockResolvedValue('viewer');
});

describe('proxy.ts', () => {
  it('lets a signed-in user through, and a user with a role on to the dashboard', async () => {
    expect(await run('/dashboard', 'GET', 'user_1').result).toBeUndefined();
    expect(roles.getRole).toHaveBeenCalledWith('user_1');
    expect(await run('/pending', 'GET', 'user_1').result).toBeUndefined();
    expect(await run('/api/users', 'GET', 'user_1').result).toBeUndefined();
  });

  it('sends a signed-in user without a role from the dashboard to the waiting page, before anything renders', async () => {
    roles.getRole.mockResolvedValue(null);
    const requests: Array<Record<string, string>> = [{}, { RSC: '1' }];   // a page load, and a client-side navigation
    for (const headers of requests) {
      const res = await run('/dashboard', 'GET', 'user_pending', headers).result;
      expect(res?.status).toBe(307);
      expect(res?.headers.get('location')).toBe('https://prism.test/pending');
      expect(await res?.text()).toBe('');
    }
  });

  it('sends everyone to the waiting page while the role cannot be read', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    roles.getRole.mockRejectedValue(new Error('connection refused'));
    const res = await run('/dashboard', 'GET', 'user_1').result;
    expect(res?.status).toBe(307);
    expect(res?.headers.get('location')).toBe('https://prism.test/pending');
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('reads the role for the dashboard only', async () => {
    roles.getRole.mockResolvedValue(null);
    for (const path of ['/pending', '/api/users', '/api/prism-cookie', '/dashboards']) {
      expect(await run(path, 'GET', 'user_pending').result).toBeUndefined();
    }
    expect(roles.getRole).not.toHaveBeenCalled();
  });

  it('sends a page without a session to sign in, and answers a dashboard route 401', async () => {
    for (const path of ['/dashboard', '/pending']) {
      const page = run(path);
      expect((await page.result)?.status).toBe(307);
      expect(page.redirectToSignIn).toHaveBeenCalledTimes(1);
    }
    for (const [path, method] of [['/api/users', 'GET'], ['/api/prism-cookie', 'GET'], ['/api/drivers/consumer_r01', 'PUT']]) {
      const res = await run(path!, method).result;
      expect(res?.status).toBe(401);
    }
    expect(roles.getRole).not.toHaveBeenCalled();
  });

  it('leaves the public routes and the expiry of the viewer cookie to their own checks', async () => {
    for (const [path, method] of [
      ['/sign-in', 'GET'], ['/sign-up/verify', 'GET'], ['/api/webhooks/clerk', 'POST'],
      ['/api/admin/bootstrap', 'POST'], ['/api/v1/drivers', 'GET'], ['/api/prism-cookie', 'DELETE'],
    ]) {
      const { result, auth } = run(path!, method);
      expect(await result).toBeUndefined();
      expect(auth).not.toHaveBeenCalled();
    }
  });
});
