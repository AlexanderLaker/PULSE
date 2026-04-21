/**
 * Legacy /forgot-password route.
 *
 * Clerk handles password reset as part of its /sign-in flow (a
 * "Forgot password?" link on the SignIn component triggers the
 * verification-code email). Redirecting to /sign-in drops the user
 * right where they can kick off the reset.
 */
import { redirect } from 'next/navigation';

export default function LegacyForgotPasswordPage() {
  redirect('/sign-in');
}
