/**
 * Sign-up: Clerk's <SignUp /> in the card of app/(auth)/layout.tsx.
 *
 * Who may create an account is decided in Clerk, where sign-up is by
 * invitation only (docs/OPERATIONS.md); the form completes the invitation's
 * link. An account opens nothing by itself: it is pending, and sees only the
 * waiting page, until an admin gives it a role in Settings (lib/roles.ts).
 */
import { SignUp } from '@clerk/nextjs';
import { CardHeading, EMBEDDED_FORM } from '@/app/(auth)/shared';

export default function SignUpPage() {
  return (
    <>
      <CardHeading label="By invitation" title="Create account">
        Use the address your invitation went to. An admin approves the account before the dashboard opens.
      </CardHeading>
      <div className="flex justify-center">
        <SignUp appearance={EMBEDDED_FORM} />
      </div>
    </>
  );
}
