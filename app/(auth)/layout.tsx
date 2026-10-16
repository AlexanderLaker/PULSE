/**
 * The frame of the sign-in, sign-up and waiting pages: the PRISM wordmark in
 * the top navigation's brand treatment over one plain card, and "Authorised
 * users only" under it. The pages fill the card (app/(auth)/shared.tsx has
 * what they share). Clerk's form inside it takes the ClerkProvider appearance
 * of app/layout.tsx, and app/globals.css flattens Clerk's own frames, since
 * the card is drawn here.
 */
import type { ReactNode } from 'react';
import { S, SHADOW, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-16"
      style={{ backgroundColor: S.bg, color: S.onBg, fontFamily: BODY_FONT }}
    >
      <div
        className="mb-10 text-2xl font-extrabold tracking-tighter uppercase"
        style={{ fontFamily: HEADLINE_FONT, color: S.onBg }}
      >
        PRISM
      </div>

      {/* One card, no nested panels */}
      <div
        className="w-full max-w-md rounded-3xl"
        style={{ backgroundColor: S.surface, boxShadow: SHADOW.authCard, padding: '40px 32px 32px' }}
      >
        {children}
      </div>

      <div
        className="mt-10 text-[11px] font-semibold uppercase tracking-[0.22em]"
        style={{ color: S.onSurfaceVariant }}
      >
        Authorised users only
      </div>
    </div>
  );
}
