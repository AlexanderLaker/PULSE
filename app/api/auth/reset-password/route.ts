/**
 * Legacy /api/auth/reset-password — removed with the Clerk migration.
 * Password reset flows through Clerk's /sign-in page.
 */
import { NextResponse } from 'next/server';

export function POST() {
  return NextResponse.json(
    {
      error: 'Gone',
      message:
        'Password reset confirmation is handled by Clerk. No application endpoint is needed.',
    },
    { status: 410 }
  );
}
