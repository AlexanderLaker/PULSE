/**
 * The root forwards to the dashboard. proxy.ts has already sent signed-out
 * visitors to /sign-in, so a server-side redirect is all this page does.
 */
import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/dashboard');
}
