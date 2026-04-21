/**
 * Legacy /reset-password route.
 *
 * Clerk performs password reset in-flow on /sign-in. Users land
 * here from stale reset emails issued by the old custom-auth
 * system; redirecting to /sign-in gets them back on the happy path.
 */
import { redirect } from 'next/navigation';

export default function LegacyResetPasswordPage() {
  redirect('/sign-in');
}
