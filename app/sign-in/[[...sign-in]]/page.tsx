/**
 * Sign-in: the PRISM wordmark over one plain card that holds Clerk's
 * <SignIn />. Clerk runs the whole flow; the ClerkProvider appearance in
 * app/layout.tsx styles its controls, and app/globals.css flattens Clerk's
 * own frames, since the page draws the card.
 */
import { SignIn } from '@clerk/nextjs';
import { S, SHADOW, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';

export default function SignInPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-16"
      style={{
        backgroundColor: S.bg,
        color: S.onBg,
        fontFamily: BODY_FONT,
      }}
    >
      {/* The PRISM wordmark in the top nav's brand treatment. */}
      <div className="mb-10">
        <div
          className="text-2xl font-extrabold tracking-tighter uppercase"
          style={{ fontFamily: HEADLINE_FONT, color: S.onBg }}
        >
          PRISM
        </div>
      </div>

      {/* One card, no nested panels */}
      <div
        className="w-full max-w-md rounded-3xl"
        style={{
          backgroundColor: S.surface,
          boxShadow: SHADOW.authCard,
          padding: '40px 32px 32px',
        }}
      >
        <div className="text-center mb-8">
          <div
            className="text-[10px] font-bold uppercase tracking-[0.22em]"
            style={{ color: S.onSurfaceVariant }}
          >
            Secure access
          </div>
          <div
            className="mt-2 text-2xl font-extrabold tracking-tight"
            style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}
          >
            Sign in
          </div>
        </div>

        {/* Clerk's form without its own card, header or logo */}
        <div className="flex justify-center">
          <SignIn
            appearance={{
              elements: {
                rootBox:     'w-full',
                cardBox:     'shadow-none bg-transparent border-none p-0 w-full',
                card:        'shadow-none bg-transparent border-none p-0 w-full',
                main:        'gap-4',
                header:      'hidden',
                logoBox:     'hidden',
                footerPages: 'hidden',
                badge:       'hidden',
              },
            }}
          />
        </div>
      </div>

      <div
        className="mt-10 text-[10px] font-semibold uppercase tracking-[0.22em]"
        style={{ color: S.onSurfaceVariant }}
      >
        Authorised users only
      </div>
    </div>
  );
}
