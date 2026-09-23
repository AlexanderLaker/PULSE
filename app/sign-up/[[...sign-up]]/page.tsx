/**
 * Sign-up: the same surface as the sign-in page (wordmark, one plain card,
 * Clerk's frames flattened), with an access-code gate in front of Clerk's
 * <SignUp />.
 *
 * Clerk has no shared invite code for self-service sign-up, so the page asks
 * for the code the early-access cohort received (NEXT_PUBLIC_SIGNUP_CODE,
 * 'HCB2026' by default) before it shows the form. It is a soft gate: the
 * code sits in the client bundle, which is enough for an internal MVP. A
 * stronger gate would check the code in a server route that issues a signed,
 * short-lived cookie.
 *
 * The Clerk webhook (app/api/webhooks/clerk/route.ts) assigns the role: the
 * first user becomes admin, everyone after that viewer.
 */
'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { SignUp } from '@clerk/nextjs';
import { S, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';

// NEXT_PUBLIC_* variables are baked into the client bundle at build time.
const REQUIRED_CODE =
  (process.env.NEXT_PUBLIC_SIGNUP_CODE || 'HCB2026').trim();

const UNLOCK_KEY = 'prism.signupCodeOk.v1';

/** Whether this browser session has passed the gate. Unreadable storage
 *  (private mode) reads as locked, so the gate stays up. */
function unlockedInStorage(): boolean {
  try { return window.sessionStorage.getItem(UNLOCK_KEY) === '1'; } catch { return false; }
}

/** Only the gate's own onUnlock writes the flag, and it re-renders through
 *  `codeAccepted`: nothing to subscribe to. */
const subscribeToUnlockFlag = () => () => {};

export default function SignUpPage() {
  // Unlocked once the code is accepted here or an earlier unlock is stored.
  // The stored flag is read with useSyncExternalStore; its server snapshot
  // says "locked", so the gate is what the server and hydration render.
  const [codeAccepted, setCodeAccepted] = useState(false);
  const storedUnlock = useSyncExternalStore(
    subscribeToUnlockFlag,
    unlockedInStorage,
    () => false,
  );
  const unlocked = codeAccepted || storedUnlock;

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
              Keeps .cl-footerAction ("Already have an account? Sign in")
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
          {!unlocked ? (
            <AccessCodeGate
              onUnlock={() => {
                try {
                  window.sessionStorage.setItem(UNLOCK_KEY, '1');
                } catch {
                  /* noop */
                }
                setCodeAccepted(true);
              }}
            />
          ) : (
            <>
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

              {/* Clerk's form without its own card, header or logo */}
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

// ─── Access-code gate ──────────────────────────────────────────────
const AccessCodeGate = ({ onUnlock }: { onUnlock: () => void }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Case-insensitive, ignoring surrounding whitespace.
    if (code.trim().toLowerCase() !== REQUIRED_CODE.toLowerCase()) {
      setError('That code is not valid. Please double-check and try again.');
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
          border: `1px solid ${error ? S.error : S.cardBorder}`,
          color: S.onSurface,
          fontFamily: BODY_FONT,
          letterSpacing: '0.04em',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = error ? S.error : S.outlineVariant;
          e.currentTarget.style.boxShadow = `0 0 0 3px ${
            error ? 'rgba(179, 38, 30, 0.12)' : 'rgba(0, 93, 181, 0.12)'
          }`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? S.error : S.cardBorder;
          e.currentTarget.style.boxShadow = 'none';
        }}
      />

      {error && (
        <div
          id="prism-access-code-error"
          role="alert"
          className="mt-2 text-xs leading-relaxed"
          style={{ color: S.error }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!code.trim()}
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
        <Link
          href="/sign-in"
          className="font-semibold underline"
          style={{ color: S.primary }}
        >
          Sign in
        </Link>
      </div>
    </form>
  );
};
