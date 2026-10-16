/**
 * Sign-up: Clerk's <SignUp /> in the card of app/(auth)/layout.tsx.
 *
 * Who may create an account is decided in Clerk, where sign-up is restricted
 * to invited addresses or to an allowlist (docs/OPERATIONS.md). An account
 * opens nothing by itself: it is pending, and sees only the waiting page,
 * until an admin gives it a role in Settings (lib/roles.ts).
 */
import { SignUp } from '@clerk/nextjs';
import { CardHeading, EMBEDDED_FORM } from '@/app/(auth)/shared';

export default function SignUpPage() {
  return (
    <>
      <CardHeading label="Restricted access" title="Create account">
        Only invited addresses, or addresses on the allowed list, can create an account; an admin approves each
        account before the dashboard opens.
      </CardHeading>
      <div className="flex justify-center">
        <SignUp appearance={EMBEDDED_FORM} />
      </div>
    </>
  );
}
