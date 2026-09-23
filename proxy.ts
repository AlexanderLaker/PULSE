/**
 * The Clerk session check on every request except static assets. Next.js
 * runs proxy.ts before the routes (Next.js 16's name for middleware.ts).
 *
 * A page without a session redirects to /sign-in; an /api/* route answers
 * 401 JSON instead, so fetch() gets an error rather than a redirect to HTML.
 *
 * Public here:
 *   - /sign-in and /sign-up;
 *   - /api/webhooks/*, which authenticates by Svix signature;
 *   - /api/admin/bootstrap, which authenticates by a shared secret;
 *   - /api/v1/*, the PRISM API. It authenticates every data request itself
 *     (the viewer cookie or an admin token; /health and /diagnostics are
 *     anonymous), and the dashboard's own routes call it server to server
 *     without a Clerk session.
 */
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/(.*)',
  '/api/admin/bootstrap',
  '/api/v1/(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return;
  const { userId, redirectToSignIn } = await auth();
  if (userId) return;
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return redirectToSignIn({ returnBackUrl: request.url });
});

export const config = {
  matcher: [
    // Everything except Next.js internals and static files (unless named in the query string).
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // API routes always.
    '/api/(.*)',
  ],
};
