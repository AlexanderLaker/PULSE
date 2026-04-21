/**
 * Sign-in page — minimal, neutral surface.
 *
 * Intentionally reveals nothing about the application: no product name,
 * taxonomy, scope or marketing copy. Just a sign-in card styled with the
 * same editorial tokens used by Trends 2 / Profit Pool Analysis 2
 * (maritime blue palette, Manrope + Inter, paper card with soft tonal
 * shadow, no harsh 1px borders).
 *
 * Clerk's <SignIn /> continues to handle the full auth flow — email /
 * password, SSO, reset, MFA. The global appearance config in
 * app/layout.tsx (ClerkProvider) styles the inner controls; this page
 * only dresses the surrounding card.
 *
 * Catch-all segment [[...sign-in]] lets Clerk handle sub-routes like
 * /sign-in/factor-one, /sign-in/verify-email-address, etc.
 */
import { SignIn } from '@clerk/nextjs';

// ─── Editorial design tokens (identical to Trends2 / ProfitPoolAnalysis2) ──
const S = {
  bg:                 '#f8f9ff',
  surface:            '#ffffff',
  surfaceLow:         '#eff4ff',
  primary:            '#005db5',
  onBg:               '#00345e',
  onSurface:          '#00345e',
  onSurfaceVariant:   '#26619d',
  cardBorder:         'rgba(0, 52, 94, 0.10)',
};

const HEADLINE_FONT = "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const BODY_FONT     = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

export default function SignInPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-12"
      style={{
        backgroundColor: S.bg,
        color: S.onBg,
        fontFamily: BODY_FONT,
      }}
    >
      <div className="w-full max-w-md">
        {/* Small brand mark — just a tonal square, no wordmark */}
        <div className="flex justify-center mb-8">
          <div
            className="rounded-2xl"
            style={{
              width: 48,
              height: 48,
              backgroundColor: S.primary,
              boxShadow: '0 10px 30px -10px rgba(0, 93, 181, 0.55)',
            }}
          />
        </div>

        {/* Sign-in card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            backgroundColor: S.surface,
            boxShadow: '0 20px 80px -20px rgba(0, 52, 94, 0.18)',
          }}
        >
          <div
            className="px-8 py-6 text-center"
            style={{
              backgroundColor: S.surfaceLow,
              borderBottom: `1px solid ${S.cardBorder}`,
            }}
          >
            <div
              className="text-[11px] font-bold uppercase tracking-[0.18em]"
              style={{ color: S.onSurfaceVariant }}
            >
              Secure access
            </div>
            <div
              className="mt-1 text-xl font-extrabold tracking-tight"
              style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}
            >
              Sign in
            </div>
          </div>

          <div className="px-4 py-6 sm:px-6 sm:py-8 flex justify-center">
            <SignIn
              appearance={{
                elements: {
                  rootBox: 'w-full',
                  card: 'shadow-none bg-transparent p-0 w-full',
                  header: 'hidden',
                },
              }}
            />
          </div>
        </div>

        <div
          className="mt-8 text-center text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: S.onSurfaceVariant }}
        >
          Authorised users only
        </div>
      </div>
    </div>
  );
}
