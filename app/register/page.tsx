/**
 * Legacy /register route.
 *
 * Superseded by Clerk's /sign-up. Preserves bookmarked links.
 */
import { redirect } from 'next/navigation';

export default function LegacyRegisterPage() {
  redirect('/sign-up');
}
