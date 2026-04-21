/**
 * Clerk middleware.
 *
 * Runs on every request (except static assets). Authenticates the session
 * cookie and redirects unauthenticated users to /sign-in when they hit a
 * protected route.
 *
 * Public routes: the sign-in / sign-up pages themselves, and the Clerk
 * webhook (which authenticates via svix signature, not session cookie).
 * Everything else — dashboard, API routes, root page — requires auth.
 */
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/(.*)', // Clerk webhooks verify via svix signature
]);

export default clerkMiddleware(async (auth, request) => {
  // Public routes skip auth entirely.
  if (isPublicRoute(request)) return;

  // Clerk v6: `auth()` is async.
  const { userId, redirectToSignIn } = await auth();

  // API routes: return 401 JSON instead of redirecting (so fetch() gets
  // a useful error rather than a 302 to an HTML page).
  if (!userId && request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Everything else: redirect to sign-in, preserving the intended
  // destination as a returnBackUrl so the user lands where they were going.
  if (!userId) {
    return redirectToSignIn({ returnBackUrl: request.url });
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files unless found in search params.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes.
    '/(api|trpc)(.*)',
  ],
};
