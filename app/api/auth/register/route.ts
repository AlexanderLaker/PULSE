/**
 * Legacy /api/auth/register — removed with the Clerk migration.
 * New accounts are created via Clerk's hosted /sign-up flow.
 */
import { NextResponse } from 'next/server';

export function POST() {
  return NextResponse.json(
    {
      error: 'Gone',
      message: 'Custom registration was replaced by Clerk. Redirect users to /sign-up.',
    },
    { status: 410 }
  );
}
