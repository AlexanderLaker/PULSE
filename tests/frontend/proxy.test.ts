/**
 * proxy.ts: which requests need a Clerk session, the role check in front of
 * the dashboard, and the Content Security Policy on every response that
 * passes. Pages without a session go to the sign-in page, the waiting page
 * included, and dashboard routes answer 401; the sign-in pages, the webhook,
 * the bootstrap route and the PRISM API are left to their own checks, and so
 * is expiring the viewer cookie, which a page whose session has ended must
 * still be able to do. /dashboard also needs a role: a signed-in user without
 * one, and everyone while user_roles cannot be read, is redirected to
 * /pending before the App Router renders anything. No other route reads the
 * role here. A request that passes gets a response with the policy and a
 * fresh nonce, and the request headers handed to Next.js carry the same
 * policy (where Next.js reads the nonce) and the nonce as x-nonce; a redirect
 * and the 401 carry none. PRISM_CSP_REPORT_ONLY=1 renames the response header
 * to report-only, and the request header keeps its name. Clerk's redirects
 * and links lead to PRISM's own sign-in and sign-up pages, which the proxy
 * and the root layout name.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AsyncLocalStorage } from 'node:async_hooks';
import { existsSync } from 'fs';
import path from 'path';
import type { ReactElement } from 'react';
import { NextRequest } from 'next/server';
import { NONCE_HEADER, POLICY_HEADER, REPORT_ONLY_HEADER, REQUEST_POLICY_HEADER } from '@/lib/csp';

const clerk = vi.hoisted(() => ({ options: undefined as unknown }));
vi.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: (handler: unknown, options: unknown) => {
    clerk.options = options;
    return handler;
  },
  createRouteMatcher: (patterns: string[]) => (req: NextRequest) =>
    patterns.some((p) => new RegExp(`^${p}$`).test(req.nextUrl.pathname)),
}));
// The root layout, read for the props it gives Clerk; nothing is rendered.
vi.mock('@clerk/nextjs', () => ({ ClerkProvider: () => null }));
vi.mock('next/font/google', () => {
  const font = () => ({ variable: 'font' });
  return { Inter: font, Manrope: font };
});

const roles = vi.hoisted(() => ({ getRole: vi.fn() }));
vi.mock('@/lib/roles', () => roles);

import proxy, { config } from '@/proxy';

type Handler = (auth: () => Promise<unknown>, req: NextRequest) => Promise<Response | undefined>;
const handler = proxy as unknown as Handler;

function run(path: string, method = 'GET', userId: string | null = null, headers: Record<string, string> = {}) {
  const redirectToSignIn = vi.fn(() => new Response(null, { status: 307 }));
  const auth = vi.fn(async () => ({ userId, redirectToSignIn }));
  const result = handler(auth, new NextRequest(`https://prism.test${path}`, { method, headers }));
  return { result, auth, redirectToSignIn };
}

/** The response that lets the request through to Next.js, as NextResponse.next() marks it. */
function passesThrough(res: Response | undefined): Response {
  expect(res?.status).toBe(200);
  expect(res?.headers.get('x-middleware-next')).toBe('1');
  return res!;
}

/** The request header the proxy forwards to Next.js, as NextResponse.next({ request }) carries it. */
const forwarded = (res: Response, name: string) => res.headers.get(`x-middleware-request-${name}`);

const NONCE_SOURCE = /'nonce-([A-Za-z0-9+/]{22}==)'/;

// The variables the policy reads, as the tests found them.
const ENV = ['PRISM_CSP_REPORT_ONLY', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'] as const;
const found = Object.fromEntries(ENV.map((name) => [name, process.env[name]]));

beforeEach(() => {
  vi.clearAllMocks();
  roles.getRole.mockResolvedValue('viewer');
});

afterEach(() => {
  for (const name of ENV) {
    if (found[name] === undefined) delete process.env[name];
    else process.env[name] = found[name];
  }
});

describe('proxy.ts', () => {
  it('lets a signed-in user through, and a user with a role on to the dashboard', async () => {
    passesThrough(await run('/dashboard', 'GET', 'user_1').result);
    expect(roles.getRole).toHaveBeenCalledWith('user_1');
    passesThrough(await run('/pending', 'GET', 'user_1').result);
    passesThrough(await run('/api/users', 'GET', 'user_1').result);
  });

  it('sends a signed-in user without a role from the dashboard to the waiting page, before anything renders', async () => {
    roles.getRole.mockResolvedValue(null);
    const requests: Array<Record<string, string>> = [{}, { RSC: '1' }];   // a page load, and a client-side navigation
    for (const path of ['/dashboard', '/dashboard/x']) {
      for (const headers of requests) {
        const res = await run(path, 'GET', 'user_pending', headers).result;
        expect(res?.status).toBe(307);
        expect(res?.headers.get('location')).toBe('https://prism.test/pending');
        expect(await res?.text()).toBe('');
      }
    }
  });

  it('sends everyone to the waiting page while the role cannot be read', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    roles.getRole.mockRejectedValue(new Error('connection refused'));
    const res = await run('/dashboard', 'GET', 'user_1').result;
    expect(res?.status).toBe(307);
    expect(res?.headers.get('location')).toBe('https://prism.test/pending');
    expect(error).toHaveBeenCalledWith('[proxy] access check failed:', expect.any(Error));
    error.mockRestore();
  });

  it('reads the role for the dashboard only', async () => {
    roles.getRole.mockResolvedValue(null);
    for (const path of ['/pending', '/api/users', '/api/prism-cookie', '/dashboards']) {
      passesThrough(await run(path, 'GET', 'user_pending').result);
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
      passesThrough(await result);
      expect(auth).not.toHaveBeenCalled();
    }
  });
});

describe('the Content Security Policy', () => {
  it('goes on every response that passes through, with a nonce of its own', async () => {
    const nonces = new Set<string>();
    for (const [path, userId] of [['/dashboard', 'user_1'], ['/pending', 'user_1'], ['/api/users', 'user_1'],
      ['/sign-in', null], ['/api/v1/drivers', null]] as const) {
      const res = passesThrough(await run(path, 'GET', userId).result);
      const policy = res.headers.get(POLICY_HEADER);
      expect(policy, path).toMatch(/^default-src 'self'; script-src 'self' 'nonce-[^']+' 'strict-dynamic' https: 'unsafe-inline'/);
      expect(policy).toContain("; frame-ancestors 'none'");
      expect(policy).not.toMatch(/;$/);
      expect(res.headers.get(REPORT_ONLY_HEADER)).toBeNull();
      nonces.add(NONCE_SOURCE.exec(policy!)![1]!);
    }
    expect(nonces.size).toBe(5);
  });

  it('forwards the same policy and the nonce on the request headers Next.js renders with', async () => {
    const res = passesThrough(await run('/dashboard', 'GET', 'user_1', { accept: 'text/html' }).result);
    const policy = res.headers.get(POLICY_HEADER)!;
    const nonce = NONCE_SOURCE.exec(policy)![1]!;
    expect(forwarded(res, REQUEST_POLICY_HEADER)).toBe(policy);
    expect(forwarded(res, NONCE_HEADER)).toBe(nonce);
    expect(forwarded(res, 'accept')).toBe('text/html');   // the incoming headers are kept
    const overridden = res.headers.get('x-middleware-override-headers')!.split(',');
    expect(overridden).toEqual(expect.arrayContaining([REQUEST_POLICY_HEADER, NONCE_HEADER, 'accept']));
  });

  it('names the Clerk frontend API from the publishable key', async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = `pk_test_${btoa('clerk.example.com$')}`;
    const withClerk = passesThrough(await run('/sign-in').result).headers.get(POLICY_HEADER)!;
    expect(withClerk).toContain("connect-src 'self' https://clerk.example.com https://clerk-telemetry.com");
    expect(withClerk).toContain("frame-src 'self' https://challenges.cloudflare.com https://clerk.example.com;");
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const without = passesThrough(await run('/sign-in').result).headers.get(POLICY_HEADER)!;
    expect(without).toContain("connect-src 'self' https://clerk-telemetry.com");
    expect(without).not.toContain('clerk.example.com');
  });

  it('is left off a redirect and the 401, which render no script', async () => {
    roles.getRole.mockResolvedValue(null);
    const pending = await run('/dashboard', 'GET', 'user_pending').result;
    expect(pending?.status).toBe(307);
    const signIn = await run('/dashboard').result;
    expect(signIn?.status).toBe(307);
    const unauthorised = await run('/api/users').result;
    expect(unauthorised?.status).toBe(401);
    for (const res of [pending, signIn, unauthorised]) {
      expect(res?.headers.get(POLICY_HEADER)).toBeNull();
      expect(res?.headers.get(REPORT_ONLY_HEADER)).toBeNull();
      expect(res?.headers.get('x-middleware-override-headers')).toBeNull();
    }
  });

  it('is sent as report-only with PRISM_CSP_REPORT_ONLY=1, while the request header keeps its name', async () => {
    process.env.PRISM_CSP_REPORT_ONLY = '1';
    const res = passesThrough(await run('/dashboard', 'GET', 'user_1').result);
    const policy = res.headers.get(REPORT_ONLY_HEADER);
    expect(policy).toMatch(NONCE_SOURCE);
    expect(res.headers.get(POLICY_HEADER)).toBeNull();
    expect(forwarded(res, REQUEST_POLICY_HEADER)).toBe(policy);
    expect(forwarded(res, 'content-security-policy-report-only')).toBeNull();
    expect(forwarded(res, NONCE_HEADER)).toBe(NONCE_SOURCE.exec(policy!)![1]);
    process.env.PRISM_CSP_REPORT_ONLY = '0';
    expect(passesThrough(await run('/dashboard', 'GET', 'user_1').result).headers.get(POLICY_HEADER)).toMatch(NONCE_SOURCE);
  });
});

describe("proxy.ts's matcher", () => {
  it('runs the proxy for every request to the dashboard, which the role check depends on', async () => {
    // Next.js's own matcher logic, as `next build` applies it; it expects AsyncLocalStorage on the global.
    (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage ??= AsyncLocalStorage;
    const { unstable_doesMiddlewareMatch: matches } = await import('next/experimental/testing/server');
    for (const url of ['/dashboard', '/dashboard?_rsc=abc', '/dashboard/x', '/pending', '/sign-in', '/api/users']) {
      expect(matches({ config, url }), url).toBe(true);
    }
    expect(matches({ config, url: '/_next/static/chunks/app.js' })).toBe(false);
  });
});

describe("Clerk's pages", () => {
  it("are PRISM's own sign-in and sign-up pages, for the proxy's redirects and for Clerk's components", async () => {
    expect(clerk.options).toEqual({ signInUrl: '/sign-in', signUpUrl: '/sign-up' });
    const { default: RootLayout } = await import('@/app/layout');
    const provider = RootLayout({ children: null }) as ReactElement<Record<string, unknown>>;
    // Every address the provider gives Clerk, so that no other redirect can be added unseen.
    const addresses = Object.fromEntries(Object.entries(provider.props).filter(([name]) => /Url$/.test(name)));
    expect(addresses).toEqual({
      signInUrl: '/sign-in',
      signUpUrl: '/sign-up',
      signInFallbackRedirectUrl: '/dashboard',
      signUpFallbackRedirectUrl: '/dashboard',
    });
    const root = path.resolve(__dirname, '../..');
    for (const page of ['app/(auth)/sign-in/[[...sign-in]]/page.tsx', 'app/(auth)/sign-up/[[...sign-up]]/page.tsx', 'app/dashboard/page.tsx']) {
      expect(existsSync(path.join(root, page)), page).toBe(true);
    }
  });
});
