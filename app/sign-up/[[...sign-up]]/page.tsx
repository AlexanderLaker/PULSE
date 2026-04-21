/**
 * Sign-up page — clean editorial surface, zero decorative overlays.
 *
 * Mirrors app/sign-in/[[...sign-in]]/page.tsx exactly so the two
 * auth surfaces feel identical. PRISM wordmark above the card,
 * single flat white card below, Clerk's inner frame + stripes
 * neutralised.
 *
 * Role assignment happens server-side via the Clerk webhook
 * (app/api/webhooks/clerk/route.ts) — first user in user_roles becomes
 * admin, everyone else viewer.
 */
import { SignUp } from '@clerk/nextjs';

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

export default function SignUpPage() {
  return (
    <>
      {/*
        Strip every frame, shadow, border and background Clerk would
        otherwise draw around its own form — we render the card chrome
        ourselves. Also kills the orange diagonal-stripe "Development
        mode" watermark that Clerk paints on the footer when using
        pk_test_* keys, and any stray masks / clip-paths that could
        reintroduce the lens bug.
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
              Keeps .cl-footerAction ("Already have an account? Sign in")
              visible because that renders as a separate node. */
        .cl-footerPages,
        .cl-badge,
        [class*="devModeNotice"],
        [data-localization-key*="development"],
        [data-localization-key="footer.pages"] {
          display: none !important;
        }

        /* 3. Belt-and-suspenders: nuke any mask/clip-path that could
              reintroduce the circular "lens" artefact. */
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
        {/* ─── PRISM wordmark — matches dashboard top-nav brand ───── */}
        <div className="mb-10">
          <div
            className="text-2xl font-extrabold tracking-tighter uppercase"
            style={{ fontFamily: HEADLINE_FONT, color: S.onBg }}
          >
            PRISM
          </div>
        </div>

        {/* ─── Sign-up surface — single clean card, no nested panels */}
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
              Request access
            </div>
            <div
              className="mt-2 text-2xl font-extrabold tracking-tight"
              style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}
            >
              Create account
            </div>
          </div>

          {/* Clerk form — frame/shadow/stripes all suppressed above */}
          <div className="flex justify-center">
            <SignUp
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
