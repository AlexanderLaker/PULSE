/**
 * Sign-in page — clean editorial surface, zero decorative overlays.
 *
 * Rebuilt from scratch (April 2026) to:
 *   1. Eliminate any stray circular / lens / shimmer effect from
 *      Clerk's default skeleton + dev-mode UI by aggressively
 *      stripping masks, clip-paths, backdrop-filters and pseudo-elements
 *      from inside the Clerk root.
 *   2. Hoist the PRISM wordmark to the top of the page in the exact
 *      typographic treatment used by the dashboard's upper-left brand
 *      (Manrope 800, tracking tighter, uppercase, maritime navy).
 *
 * Design tokens are identical to Trends 2 / Profit Pool Analysis 2.
 * Clerk's `<SignIn />` still handles the auth flow end-to-end; the
 * ClerkProvider in app/layout.tsx controls the inner control styling.
 */
import { SignIn } from '@clerk/nextjs';

// ─── Editorial design tokens ──────────────────────────────────────
const S = {
  bg:                 '#f8f9ff',
  surface:            '#ffffff',
  surfaceLow:         '#eff4ff',
  primary:            '#005db5',
  onBg:               '#00345e',
  onSurface:          '#00345e',
  onSurfaceVariant:   '#26619d',
};

const HEADLINE_FONT =
  "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const BODY_FONT =
  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

export default function SignInPage() {
  return (
    <>
      {/*
        Global neutralizer for any Clerk-internal mask / clip-path /
        backdrop-filter / pseudo-element shimmer that can manifest as a
        circular "lens" over the form in dev mode. Scoped strictly to
        Clerk's own DOM via the `cl-*` class prefix, so it can't leak
        into the rest of the app.
      */}
      <style>{`
        .cl-rootBox,
        .cl-rootBox *,
        .cl-card,
        .cl-card *,
        .cl-internal-b3fm6y,
        .cl-internal-b3fm6y * {
          mask: none !important;
          -webkit-mask: none !important;
          mask-image: none !important;
          -webkit-mask-image: none !important;
          clip-path: none !important;
          -webkit-clip-path: none !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          filter: none !important;
        }
        .cl-rootBox::before,
        .cl-rootBox::after,
        .cl-card::before,
        .cl-card::after,
        .cl-main::before,
        .cl-main::after {
          content: none !important;
          display: none !important;
        }
        /* Kill the dev-mode striped watermark banner that shows under
           "Secured by Clerk" when using pk_test_* keys — keep the tiny
           text label, lose the noisy stripes. */
        .cl-badge,
        .cl-internal-dev-mode-banner,
        [class*="devMode"],
        [class*="DevMode"] {
          background-image: none !important;
          box-shadow: none !important;
        }
      `}</style>

      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 py-16"
        style={{
          backgroundColor: S.bg,
          color: S.onBg,
          fontFamily: BODY_FONT,
        }}
      >
        {/* ─── PRISM wordmark ─────────────────────────────────────
            Exact match for the dashboard top-nav brand treatment:
            Manrope 800, text-2xl, tracking-tighter, uppercase, onBg.
        */}
        <div className="mb-10">
          <div
            className="text-2xl font-extrabold tracking-tighter uppercase"
            style={{ fontFamily: HEADLINE_FONT, color: S.onBg }}
          >
            PRISM
          </div>
        </div>

        {/* ─── Sign-in surface — single clean card, no nested panels */}
        <div
          className="w-full max-w-md rounded-3xl"
          style={{
            backgroundColor: S.surface,
            boxShadow: '0 24px 80px -24px rgba(0, 52, 94, 0.18)',
            padding: '40px 32px 32px',
          }}
        >
          {/* Compact header */}
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

          {/* Clerk form — no inner card, no header, stripped to essentials */}
          <div className="flex justify-center">
            <SignIn
              appearance={{
                elements: {
                  rootBox:   'w-full',
                  card:      'shadow-none bg-transparent p-0 w-full border-none',
                  header:    'hidden',
                  logoBox:   'hidden',
                  main:      'gap-4',
                },
              }}
            />
          </div>
        </div>

        {/* Footer label */}
        <div
          className="mt-10 text-[10px] font-semibold uppercase tracking-[0.22em]"
          style={{ color: S.onSurfaceVariant }}
        >
          Authorised users only
        </div>
      </div>
    </>
  );
}
