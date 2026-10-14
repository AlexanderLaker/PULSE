'use client';

/**
 * The waiting page's two buttons: Check again, which goes to /dashboard,
 * where proxy.ts opens the dashboard once an admin has approved the account
 * and otherwise sends the user back here, with a line saying so; and Sign
 * out.
 *
 * When the page loads it also expires any viewer cookie left in this browser:
 * a user whose role was just taken away may still hold one, and it would
 * otherwise authorise reads until it ran out (30 minutes at most).
 */
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { HEADLINE_FONT, S } from '@/lib/theme';

const BUTTON = 'w-full inline-flex items-center justify-center rounded-full py-3 text-sm font-bold tracking-tight '
  + 'transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

const expireViewerCookie = () =>
  fetch('/api/prism-cookie', { method: 'DELETE' }).then(() => undefined, () => undefined);

/** `checkFailed`: the page could not check the user's access, rather than finding none. */
export default function PendingActions({ checkFailed }: { checkFailed: boolean }) {
  const { signOut } = useClerk();
  const router = useRouter();
  const [checking, startCheck] = useTransition();
  // Set by Check again: once the page is back with no access, it says so.
  const [checkedAgain, setCheckedAgain] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  // Why the last sign-out failed, without closing punctuation.
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useEffect(() => { void expireViewerCookie(); }, []);

  const checkAgain = () => startCheck(() => {
    setCheckedAgain(true);
    router.push('/dashboard');
  });

  const handleSignOut = async () => {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await expireViewerCookie();
      await signOut({ redirectUrl: '/sign-in' });
    } catch (error) {
      setSignOutError(((error as Error)?.message || 'Clerk did not answer').replace(/[\s.]+$/, ''));
      setSigningOut(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <button type="button"
        onClick={checkAgain}
        disabled={checking}
        className={`${BUTTON} bg-theme-primary hover:bg-theme-primary-dim text-theme-on-primary shadow-primary-button`}
        style={{ fontFamily: HEADLINE_FONT }}
      >
        {checking ? 'Checking…' : 'Check again'}
      </button>
      <button type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className={`${BUTTON} bg-theme-surface-low hover:bg-theme-surface-high text-theme-primary`}
        style={{ fontFamily: HEADLINE_FONT }}
      >
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
      {checkedAgain && !checking && (
        <p role="status" className="text-xs leading-relaxed text-center" style={{ color: S.onSurfaceVariant }}>
          {checkFailed ? 'Your access still could not be checked.' : 'Still no access: an admin has to approve this account.'}
        </p>
      )}
      {signOutError && (
        <p role="alert" className="text-xs leading-relaxed text-center" style={{ color: S.error }}>
          Signing out failed ({signOutError}). You are still signed in; try again.
        </p>
      )}
    </div>
  );
}
