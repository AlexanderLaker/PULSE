/**
 * Root entry point.
 *
 * The Clerk middleware (middleware.ts) already gates this route:
 * unauthenticated users are bounced to /sign-in before this component
 * renders. So by the time we get here, the visitor is signed in and
 * we just forward them to the dashboard.
 *
 * Using Next.js server-side redirect avoids the "flash of loading
 * spinner + client-side fetch" that the old custom-auth version had.
 */
import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/dashboard');
}
