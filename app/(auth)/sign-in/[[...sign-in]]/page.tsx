/**
 * Sign-in: Clerk's <SignIn /> in the card of app/(auth)/layout.tsx. Clerk
 * runs the whole flow, "Forgot password?" and the verification steps
 * included.
 */
import { SignIn } from '@clerk/nextjs';
import { CardHeading, EMBEDDED_FORM } from '@/app/(auth)/shared';

export default function SignInPage() {
  return (
    <>
      <CardHeading label="Secure access" title="Sign in" />
      <div className="flex justify-center">
        <SignIn appearance={EMBEDDED_FORM} />
      </div>
    </>
  );
}
