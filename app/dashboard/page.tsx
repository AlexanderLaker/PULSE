/**
 * /dashboard: the dashboard, for a user with a role, told whether they are
 * admin or viewer.
 *
 * proxy.ts has already sent visitors without a session to /sign-in, and
 * signed-in users without a role to /pending, before this page renders: a
 * redirect from here would come too late to keep the addresses of the
 * dashboard's code from them, because the App Router sends a page's scripts
 * along with the page. This page renders for every request, never from a
 * cache, and reads the role from user_roles again (lib/roles.ts): it hands
 * the role to the dashboard (DashboardApp.tsx), and it is the second check.
 * A user who has no role by now (taken away in the moment between the two
 * checks), or whose access could not be checked (the database or Clerk did
 * not answer, as the log line says), goes to /pending all the same.
 */
import { redirect } from 'next/navigation';
import { requireAuth, UnauthorizedError } from '@/lib/roles';
import type { Access } from '@/types';
import DashboardApp from './DashboardApp';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let access: Access | null = null;
  try {
    access = (await requireAuth()).role;
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/sign-in');
    console.error('[/dashboard] access check failed:', err);
  }
  if (access !== 'admin' && access !== 'viewer') redirect('/pending');
  return <DashboardApp role={access} />;
}
