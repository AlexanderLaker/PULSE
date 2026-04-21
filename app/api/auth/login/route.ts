/**
 * Legacy /api/auth/login — removed with the Clerk migration.
 * Authentication now happens via Clerk's hosted sign-in flow at /sign-in.
 */
import { NextResponse } from 'next/server';

export function POST() {
  return NextResponse.json(
    {
      error: 'Gone',
      message: 'Custom login was replaced by Clerk. Redirect users to /sign-in.',
    },
    { status: 410 }
  );
}
