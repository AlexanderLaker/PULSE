/**
 * Legacy /api/auth/logout — removed with the Clerk migration.
 * Use Clerk's `signOut()` (from `useClerk()`) or `<SignOutButton>`.
 */
import { NextResponse } from 'next/server';

export function POST() {
  return NextResponse.json(
    {
      error: 'Gone',
      message:
        'Custom logout was replaced by Clerk. Call signOut() from useClerk(), or render <SignOutButton />.',
    },
    { status: 410 }
  );
}
