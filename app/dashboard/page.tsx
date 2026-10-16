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
 * not answer, as the log line says), goes to /pending all the same. The
 * query string names the view and its parameters (lib/viewUrl.ts), parsed
 * here so the first render shows the linked view.
 */
import { redirect } from 'next/navigation';
import { requireAuth, UnauthorizedError } from '@/lib/roles';
import { parseViewUrl } from '@/lib/viewUrl';
import type { Access } from '@/types';
import DashboardApp from './DashboardApp';

type SearchParams = Record<string, string | string[] | undefined>;

export const dynamic = 'force-dynamic';

export default async function DashboardPage(props?: { searchParams?: Promise<SearchParams> | SearchParams }) {
  let access: Access | null = null;
  try {
    access = (await requireAuth()).role;
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/sign-in');
    console.error('[/dashboard] access check failed:', err);
  }
  if (access !== 'admin' && access !== 'viewer') redirect('/pending');
  // The address names the view to open (lib/viewUrl.ts); the server reads it
  // so the first render already shows that view rather than the gate.
  const initialView = parseViewUrl(await props?.searchParams);
  return <DashboardApp role={access} initialView={initialView} />;
}
