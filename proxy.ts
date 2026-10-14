/**
 * The Clerk session check on every request except static assets, and the
 * role check in front of the dashboard. Next.js runs proxy.ts before the
 * routes (Next.js 16's name for middleware.ts).
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
 * deployment still sets them.
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
 *     page whose session has ended can still clear it.
 */
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getRole } from '@/lib/roles';

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

export default clerkMiddleware(
  async (auth, request) => {
    if (isPublicRoute(request) || expiresTheCookie(request)) return;
    const { userId, redirectToSignIn } = await auth();
    if (userId) {
      if (isDashboard(request) && !(await hasRole(userId))) {
        return NextResponse.redirect(new URL('/pending', request.url));
      }
      return;
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
