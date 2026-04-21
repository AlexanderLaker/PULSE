/**
 * Legacy /login route.
 *
 * Superseded by Clerk's /sign-in. Redirect preserves any bookmarked
 * links, docs, or emails that still point at the old URL.
 */
import { redirect } from 'next/navigation';

export default function LegacyLoginPage() {
  redirect('/sign-in');
}
