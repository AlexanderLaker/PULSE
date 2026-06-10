/**
 * Clerk proxy (Next.js 16: ehemals middleware.ts — siehe
 * https://nextjs.org/docs/messages/middleware-to-proxy).
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
  '/api/webhooks/(.*)',   // Clerk webhooks verify via svix signature
  '/api/admin/bootstrap', // Shared-secret bootstrap for first admin
  // Python FastAPI backend — the Next.js proxy routes under /api/* do a
  // same-origin fetch to /api/v1/*, which re-enters this middleware. Without
  // a Clerk session cookie on that server-side hop, it would 401 before the
  // PRISM JWT Bearer reaches the Python adapter. Public at the EDGE only:
  // since F3 (June 2026) the Python layer itself authenticates every data
  // endpoint — reads need the httpOnly viewer cookie minted by
  // /api/prism-cookie, mutations need an admin Bearer JWT. Only /health and
  // /diagnostics are intentionally anonymous.
  '/api/v1/(.*)',
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
