/**
 * Sign-up page — clean editorial surface, gated by a shared access code.
 *
 * Mirrors app/sign-in/[[...sign-in]]/page.tsx exactly so the two
 * auth surfaces feel identical. PRISM wordmark above the card,
 * single flat white card below, Clerk's inner frame + stripes
 * neutralised.
 *
 * ─── Access-code gate ──────────────────────────────────────────────
 * Clerk does not natively support a shared "invite code" for self
 * service sign-up. We add a thin gate in front of <SignUp>: the user
 * must enter the code we've shared with the early-access cohort
 * (default 'HCB2026', overridable via NEXT_PUBLIC_SIGNUP_CODE) before
 * the Clerk form appears.
 *
 * Note this is a soft gate — anyone who reads the bundled JS could
 * still find the literal code. For internal MVP gating that's fine;
 * if we need stronger guarantees we can move the check to a server
 * route that issues a signed, short-lived cookie.
 *
 * Role assignment happens server-side via the Clerk webhook
 * (app/api/webhooks/clerk/route.ts) — first user in user_roles becomes
 * admin, everyone else viewer.
 */
'use client';

import { useEffect, useState, FormEvent } from 'react';
import { SignUp } from '@clerk/nextjs';

// ─── Editorial design tokens ──────────────────────────────────────
const S = {
  bg:                 '#f8f9ff',
  surface:            '#ffffff',
  surfaceLow:         '#eff4ff',
  surfaceContainer:   '#e5eeff',
  primary:            '#005db5',
  primaryDim:         '#0052a0',
  onBg:               '#00345e',
  onSurface:          '#00345e',
  onSurfaceVariant:   '#26619d',
  outlineVariant:     '#81b5f6',
  cardBorder:         'rgba(0, 52, 94, 0.10)',
  danger:             '#b3261e',
};

const HEADLINE_FONT =
  "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const BODY_FONT =
  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

// Build-time injected — NEXT_PUBLIC_* envs are baked into the client
// bundle. Default to 'HCB2026' for the current cohort.
const REQUIRED_CODE =
  (process.env.NEXT_PUBLIC_SIGNUP_CODE || 'HCB2026').trim();

const UNLOCK_KEY = 'prism.signupCodeOk.v1';

export default function SignUpPage() {
  // Gate state — start locked; flip to true once the code is verified
  // (or once we read a prior unlock flag from sessionStorage).
  const [unlocked, setUnlocked] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    try {
      if (window.sessionStorage.getItem(UNLOCK_KEY) === '1') {
        setUnlocked(true);
      }
    } catch {
      /* sessionStorage unavailable — keep gate active */
    }
  }, []);

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
          {!hydrated || !unlocked ? (
            <AccessCodeGate
              onUnlock={() => {
                try {
                  window.sessionStorage.setItem(UNLOCK_KEY, '1');
                } catch {
                  /* noop */
                }
                setUnlocked(true);
              }}
            />
          ) : (
            <>
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
            </>
          )}
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

// ─── Access code gate ──────────────────────────────────────────────
const AccessCodeGate = ({ onUnlock }: { onUnlock: () => void }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    // Case-insensitive, whitespace-tolerant comparison.
    const ok =
      code.trim().toLowerCase() === REQUIRED_CODE.toLowerCase();
    if (!ok) {
      setError('That code is not valid. Please double-check and try again.');
      setSubmitting(false);
      return;
    }
    setError(null);
    onUnlock();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="text-center mb-7">
        <div
          className="text-[10px] font-bold uppercase tracking-[0.22em]"
          style={{ color: S.onSurfaceVariant }}
        >
          Early access
        </div>
        <div
          className="mt-2 text-2xl font-extrabold tracking-tight"
          style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}
        >
          Enter access code
        </div>
        <p
          className="mt-3 text-sm leading-relaxed"
          style={{ color: S.onSurfaceVariant }}
        >
          PRISM is currently invite-only. Please enter the access code
          you received to continue.
        </p>
      </div>

      <label
        htmlFor="prism-access-code"
        className="block text-[11px] font-semibold uppercase tracking-[0.18em] mb-2"
        style={{ color: S.onSurfaceVariant }}
      >
        Access code
      </label>
      <input
        id="prism-access-code"
        type="text"
        autoFocus
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          if (error) setError(null);
        }}
        placeholder="Enter your access code"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'prism-access-code-error' : undefined}
        className="w-full px-4 py-3 rounded-xl text-base outline-none transition-all"
        style={{
          backgroundColor: S.surfaceLow,
          border: `1px solid ${error ? S.danger : S.cardBorder}`,
          color: S.onSurface,
          fontFamily: BODY_FONT,
          letterSpacing: '0.04em',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = error ? S.danger : S.outlineVariant;
          e.currentTarget.style.boxShadow = `0 0 0 3px ${
            error ? 'rgba(179, 38, 30, 0.12)' : 'rgba(0, 93, 181, 0.12)'
          }`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? S.danger : S.cardBorder;
          e.currentTarget.style.boxShadow = 'none';
        }}
      />

      {error && (
        <div
          id="prism-access-code-error"
          role="alert"
          className="mt-2 text-xs leading-relaxed"
          style={{ color: S.danger }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!code.trim() || submitting}
        className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-full py-3 text-sm font-bold tracking-tight transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: S.primary,
          color: '#fff',
          fontFamily: HEADLINE_FONT,
          boxShadow: '0 6px 18px -6px rgba(0, 93, 181, 0.45)',
        }}
        onMouseEnter={(e) => {
          if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = S.primaryDim;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = S.primary;
        }}
      >
        Continue
      </button>

      <div
        className="mt-5 text-center text-xs"
        style={{ color: S.onSurfaceVariant }}
      >
        Already have an account?{' '}
        <a
          href="/sign-in"
          className="font-semibold underline"
          style={{ color: S.primary }}
        >
          Sign in
        </a>
      </div>
    </form>
  );
};
