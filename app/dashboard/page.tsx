/**
 * /dashboard: the access check in front of the dashboard, on the server.
 *
 * The page renders for every request, never from a cache, and reads the
 * signed-in user's access from user_roles (lib/roles.ts) before anything of
 * the dashboard is sent. A user with a role gets the dashboard
 * (DashboardApp.tsx), told whether they are admin or viewer. Anyone else is
 * sent to /pending, a page of its own, so their browser never receives the
 * dashboard's page or the addresses of its code: a pending user, whom no
 * admin has approved yet, and a user whose access could not be checked (the
 * database did not answer), which /pending reports. proxy.ts has already
 * sent visitors without a session to /sign-in.
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
