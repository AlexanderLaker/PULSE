/**
 * proxy.ts: which requests need a Clerk session. Pages without one go to the
 * sign-in page, the waiting page included, and dashboard routes answer 401;
 * the sign-in pages, the webhook, the bootstrap route and the PRISM API are
 * left to their own checks, and so is expiring the viewer cookie, which a
 * page whose session has ended must still be able to do. Whether a signed-in
 * user has a role is for the pages and routes to check, not for proxy.ts.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: (handler: unknown) => handler,
  createRouteMatcher: (patterns: string[]) => (req: NextRequest) =>
    patterns.some((p) => new RegExp(`^${p}$`).test(req.nextUrl.pathname)),
}));

import proxy from '@/proxy';

type Handler = (auth: () => Promise<unknown>, req: NextRequest) => Promise<Response | undefined>;
const handler = proxy as unknown as Handler;

function run(path: string, method = 'GET', userId: string | null = null) {
  const redirectToSignIn = vi.fn(() => new Response(null, { status: 307 }));
  const auth = vi.fn(async () => ({ userId, redirectToSignIn }));
  const result = handler(auth, new NextRequest(`https://prism.test${path}`, { method }));
  return { result, auth, redirectToSignIn };
}

describe('proxy.ts', () => {
  it('lets a signed-in user through', async () => {
    expect(await run('/dashboard', 'GET', 'user_1').result).toBeUndefined();
    expect(await run('/pending', 'GET', 'user_1').result).toBeUndefined();
    expect(await run('/api/users', 'GET', 'user_1').result).toBeUndefined();
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
