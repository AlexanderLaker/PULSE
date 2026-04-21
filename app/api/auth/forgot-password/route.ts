/**
 * Legacy /api/auth/forgot-password — removed with the Clerk migration.
 * Password reset flows through Clerk's /sign-in page.
 */
import { NextResponse } from 'next/server';

export function POST() {
  return NextResponse.json(
    {
      error: 'Gone',
      message:
        'Password reset is handled by Clerk. Users should click "Forgot password?" on /sign-in.',
    },
    { status: 410 }
  );
}
