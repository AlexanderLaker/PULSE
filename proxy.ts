/**
 * The Clerk session check on every request except static assets, the role
 * check in front of the dashboard, and the Content Security Policy on every
 * response that passes. Next.js runs proxy.ts before the routes (Next.js
 * 16's name for middleware.ts).
 *
 * A page without a session redirects to /sign-in; an /api/* route answers
 * 401 JSON instead, so fetch() gets an error rather than a redirect to HTML.
 *
 * /dashboard also needs a role: a signed-in user without one, and everyone
 * while user_roles cannot be read, is sent to /pending here, before the App
 * Router renders anything. The router sends a page's script addresses along
 * with the page, ahead of the page's own code, so a redirect from inside
 * app/dashboard/page.tsx (the second check, which also hands the dashboard
 * its role) would still tell such a user where the dashboard's code is. The
 * database is read for /dashboard only; every other route checks the role
 * itself, where it needs one.
 *
 * The redirect goes to PRISM's own sign-in page because clerkMiddleware is
 * told its path below, as the root layout (app/layout.tsx) tells Clerk's
 * components; without them Clerk would send visitors to its hosted pages.
 * These paths need no environment variable and win over Clerk's
 * NEXT_PUBLIC_CLERK_SIGN_IN_URL and NEXT_PUBLIC_CLERK_SIGN_UP_URL where a
 * deployment sets them.
 *
 * Public here:
 *   - /sign-in and /sign-up;
 *   - /api/webhooks/*, which authenticates by Svix signature;
 *   - /api/admin/bootstrap, which authenticates by a shared secret;
 *   - /api/v1/*, the PRISM API. It authenticates every data request itself
 *     (the viewer cookie or an admin token; /health and /diagnostics are
 *     anonymous), and the dashboard's own routes call it server to server
 *     without a Clerk session;
 *   - DELETE /api/prism-cookie, which only expires the viewer cookie, so a
 *     page whose session has ended can still clear it;
 *   - the static files the matcher leaves out, Next.js's chunks among them.
 *     The sign-in page needs its chunks before anyone has a session, and
 *     the chunks carry code only: the Consumer Journey's tiles, the
 *     Explorer's figures and the drivers' names are served by the API, to a
 *     user with a role.
 *
 * Every response that passes through carries a Content Security Policy
 * (lib/csp.ts): a fresh nonce per request, scripts allowed by the nonce and
 * 'strict-dynamic', frames and connections limited to Clerk's hosts. Next.js
 * reads the nonce from the request's content-security-policy header, so the
 * policy also goes on the request headers handed to the router, with the
 * nonce as x-nonce. A redirect and the 401 carry no policy; they render no
 * script. PRISM_CSP_REPORT_ONLY=1 sends the policy as
 * Content-Security-Policy-Report-Only, for a first deployment that watches
 * the browser console before enforcing; the request header keeps its name
 * either way. vercel.json carries no policy of its own; its X-Frame-Options:
 * DENY covers the responses the proxy never sees.
 */
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest } from 'next/server';
import { getRole } from '@/lib/roles';
import {
  buildContentSecurityPolicy, clerkFrontendApi, cspHeaderName, newNonce, NONCE_HEADER, REQUEST_POLICY_HEADER,
} from '@/lib/csp';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/(.*)',
  '/api/admin/bootstrap',
  '/api/v1/(.*)',
]);

const isDashboard = createRouteMatcher(['/dashboard', '/dashboard/(.*)']);

const expiresTheCookie = (request: Request) =>
  request.method === 'DELETE' && new URL(request.url).pathname === '/api/prism-cookie';

/** Whether the user has a role; false while they are pending, and while user_roles cannot be read. */
async function hasRole(userId: string): Promise<boolean> {
  try {
    return (await getRole(userId)) !== null;
  } catch (err) {
    console.error('[proxy] access check failed:', err);
    return false;
  }
}

/**
 * The pass-through response: the policy on the response, and on the request
 * headers Next.js renders with, where it reads the nonce.
 */
function passThrough(request: NextRequest): NextResponse {
  const nonce = newNonce();
  const policy = buildContentSecurityPolicy({
    nonce,
    clerkHost: clerkFrontendApi(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
    development: process.env.NODE_ENV !== 'production',
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_POLICY_HEADER, policy);
  requestHeaders.set(NONCE_HEADER, nonce);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(cspHeaderName(process.env.PRISM_CSP_REPORT_ONLY === '1'), policy);
  return response;
}

export default clerkMiddleware(
  async (auth, request) => {
    if (isPublicRoute(request) || expiresTheCookie(request)) return passThrough(request);
    const { userId, redirectToSignIn } = await auth();
    if (userId) {
      if (isDashboard(request) && !(await hasRole(userId))) {
        return NextResponse.redirect(new URL('/pending', request.url));
      }
      return passThrough(request);
    }
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return redirectToSignIn({ returnBackUrl: request.url });
  },
  { signInUrl: '/sign-in', signUpUrl: '/sign-up' },
);

export const config = {
  matcher: [
    // Everything except Next.js internals and static files (unless named in the query string).
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // API routes always.
    '/api/(.*)',
  ],
};
