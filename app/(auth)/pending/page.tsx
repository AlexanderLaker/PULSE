/**
 * /pending: the waiting page. A signed-in user without a role sees it instead
 * of the dashboard: proxy.ts sends them here before the dashboard renders, so
 * nothing of the dashboard reaches their browser. It says that an admin has
 * to approve the account (Settings, User management) and offers to check
 * again or sign out (PendingActions.tsx).
 *
 * The page checks again on the server for every request: a user who has a
 * role by now goes on to the dashboard, and a check that failed (the
 * database or Clerk did not answer, as the log line says) is reported as
 * such, not as a missing approval. proxy.ts has already sent visitors
 * without a session to /sign-in.
 */
import { redirect } from 'next/navigation';
import { requireAuth, UnauthorizedError } from '@/lib/roles';
import { CardHeading } from '@/app/(auth)/shared';
import PendingActions from './PendingActions';

export const dynamic = 'force-dynamic';

export default async function PendingPage() {
  let checked: { email: string; approved: boolean } | null = null;
  try {
    const me = await requireAuth();
    checked = { email: me.email, approved: me.role !== 'pending' };
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/sign-in');
    console.error('[/pending] access check failed:', err);
  }
  if (checked?.approved) redirect('/dashboard');

  return (
    <>
      {checked ? (
        <CardHeading label="Access pending" title="Waiting for approval">
          You are signed in{checked.email ? ` as ${checked.email}` : ''}. This account has no access to PRISM
          until an admin approves it in PRISM&rsquo;s settings. Once they have, choose Check again.
        </CardHeading>
      ) : (
        <CardHeading label="Access" title="Access could not be checked">
          PRISM could not check your access just now. Try again in a moment.
        </CardHeading>
      )}
      <PendingActions checkFailed={!checked} />
    </>
  );
}
