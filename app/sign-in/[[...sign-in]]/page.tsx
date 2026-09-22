/**
 * Sign-in: the PRISM wordmark over one plain card that holds Clerk's
 * <SignIn />. Clerk runs the whole flow; the ClerkProvider appearance in
 * app/layout.tsx styles its controls.
 *
 * The style block flattens Clerk's own frames and strips masks, clip-paths,
 * filters and pseudo-elements inside its root, any of which can paint a
 * circular "lens" artefact over the form, and it hides the development-mode
 * watermark.
 */
import { SignIn } from '@clerk/nextjs';
import { S, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';

export default function SignInPage() {
  return (
    <>
      {/*
        The page draws the card, so Clerk's frames, shadows, borders and
        backgrounds go. The block also hides the striped "Development mode"
        watermark Clerk paints with pk_test_* keys and removes any mask or
        clip-path that could bring the lens artefact back.
      */}
      <style>{`
        /* 1. Flatten all Clerk container layers */
        .cl-rootBox,
        .cl-cardBox,
        .cl-card,
        .cl-main,
        .cl-footer,
        .cl-footerAction,
        .cl-footerPages {
          background: transparent !important;
          background-image: none !important;
          box-shadow: none !important;
          border: none !important;
          border-radius: 0 !important;
        }

        /* 2. Hide Clerk's own branding footer + dev-mode watermark.
              Keeps .cl-footerAction ("Don't have an account? Sign up")
              visible because that renders as a separate node. */
        .cl-footerPages,
        .cl-badge,
        [class*="devModeNotice"],
        [data-localization-key*="development"],
        [data-localization-key="footer.pages"] {
          display: none !important;
        }

        /* 3. No mask, clip-path or filter anywhere inside Clerk's root:
              any of them can paint the circular "lens" artefact. */
        .cl-rootBox,
        .cl-rootBox *,
        .cl-cardBox,
        .cl-cardBox * {
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
        .cl-main::after,
        .cl-footer::before,
        .cl-footer::after {
          content: none !important;
          display: none !important;
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
            boxShadow: '0 24px 80px -24px rgba(0, 52, 94, 0.18)',
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
    </>
  );
}
