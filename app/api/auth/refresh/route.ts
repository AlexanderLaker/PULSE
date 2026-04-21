/**
 * Legacy /api/auth/refresh — removed with the Clerk migration.
 * Clerk handles session refresh automatically via its own SDK.
 */
import { NextResponse } from 'next/server';

export function POST() {
  return NextResponse.json(
    {
      error: 'Gone',
      message:
        'Token refresh is now managed by Clerk client-side. No application endpoint is needed.',
    },
    { status: 410 }
  );
}
