/**
 * Legacy /api/auth/check endpoint — removed with the Clerk migration.
 *
 * The old custom-auth frontend polled this on every dashboard load to
 * decide whether to show the login page. With Clerk, authentication is
 * resolved server-side by middleware.ts before any page renders, and
 * the client reads session state via Clerk hooks (`useUser`, `useAuth`)
 * without hitting a PRISM endpoint.
 *
 * We return 410 Gone rather than deleting the route outright so any
 * stale client build or external probe gets an unambiguous signal
 * instead of a silent 404.
 */
import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json(
    {
      error: 'Gone',
      message:
        'This endpoint was removed in the Clerk migration. Use Clerk hooks (useUser, useAuth) on the client, or `auth()` from @clerk/nextjs/server on the server.',
    },
    { status: 410 }
  );
}
