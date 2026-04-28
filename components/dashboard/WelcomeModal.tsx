/**
 * WelcomeModal — Two-step welcome / orientation popup shown on every login.
 *
 * Step 1: MVP disclaimer + feedback channel (Alexander Laker).
 * Step 2: Brief explainer of the four views, in header order:
 *           Trends (input) -> Consumer Journey -> Profit Pool Shift Analysis
 *           -> Innovation Explorer.
 *
 * Design language mirrors SettingsModal / Trends2 / ProfitPoolAnalysis2
 * (Maritime blue editorial tokens, Manrope headlines, pill-shaped CTAs).
 *
 * Visibility model:
 *   Shown on every fresh login. We key sessionStorage by the active Clerk
 *   session ID — once the user dismisses it, the same session won't show it
 *   again (so a tab refresh inside an active session is silent), but a new
 *   sign-in produces a new session ID and the modal re-appears.
 */

'use client';

import React, { FC, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronRight,
  Sparkles,
  Activity,
  Route,
  TrendingUp,
  Lightbulb,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ─── Editorial design tokens (mirror SettingsModal / Trends2) ───────
const S = {
  bg:                 '#f8f9ff',
  surface:            '#ffffff',
  surfaceLow:         '#eff4ff',
  surfaceContainer:   '#e5eeff',
  surfaceHigh:        '#dce9ff',
  primary:            '#005db5',
  primaryDim:         '#0052a0',
  onBg:               '#00345e',
  onSurface:          '#00345e',
  onSurfaceVariant:   '#26619d',
  outlineVariant:     '#81b5f6',
  cardBorder:         'rgba(0, 52, 94, 0.10)',
};

const HEADLINE_FONT =
  "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const BODY_FONT =
  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

const WelcomeModal: FC<WelcomeModalProps> = ({ open, onClose }) => {
  const [step, setStep] = useState<1 | 2>(1);

  // Reset to step 1 every time the modal opens.
  useEffect(() => {
    if (open) setStep(1);
  }, [open]);

  // Esc closes the modal at any step.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 200,
              backgroundColor: 'rgba(0, 52, 94, 0.35)',
              backdropFilter: 'blur(4px)',
            }}
          />

          {/* Modal card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            role="dialog"
            aria-modal="true"
            aria-label="Welcome to PRISM"
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(620px, 92vw)',
              maxHeight: '90vh',
              zIndex: 201,
              backgroundColor: S.surface,
              borderRadius: 20,
              boxShadow: '0 32px 96px -20px rgba(0, 52, 94, 0.45)',
              overflow: 'hidden',
              fontFamily: BODY_FONT,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'transparent',
                border: 'none',
                padding: 6,
                borderRadius: 999,
                cursor: 'pointer',
                color: S.onSurfaceVariant,
                zIndex: 2,
              }}
            >
              <X size={18} />
            </button>

            {/* Step indicator dots */}
            <div
              style={{
                position: 'absolute',
                top: 22,
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                gap: 6,
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  width: step === 1 ? 22 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: step === 1 ? S.primary : S.surfaceHigh,
                  transition: 'all 0.2s ease',
                }}
              />
              <span
                style={{
                  width: step === 2 ? 22 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: step === 2 ? S.primary : S.surfaceHigh,
                  transition: 'all 0.2s ease',
                }}
              />
            </div>

            {/* Body — switch by step */}
            <div
              style={{
                padding: '56px 40px 28px',
                overflowY: 'auto',
                flex: 1,
              }}
            >
              {step === 1 ? <Step1Welcome /> : <Step2Views />}
            </div>

            {/* Footer with primary CTA */}
            <div
              style={{
                padding: '20px 40px 28px',
                borderTop: `1px solid ${S.cardBorder}`,
                backgroundColor: S.surface,
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 12,
              }}
            >
              {step === 2 && (
                <button
                  onClick={() => setStep(1)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '10px 16px',
                    fontFamily: HEADLINE_FONT,
                    fontWeight: 600,
                    fontSize: 14,
                    color: S.onSurfaceVariant,
                    cursor: 'pointer',
                    borderRadius: 999,
                  }}
                >
                  Back
                </button>
              )}
              <button
                onClick={() => {
                  if (step === 1) setStep(2);
                  else onClose();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '11px 22px',
                  borderRadius: 999,
                  border: 'none',
                  backgroundColor: S.primary,
                  color: 'white',
                  fontFamily: HEADLINE_FONT,
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: '-0.01em',
                  cursor: 'pointer',
                  boxShadow: '0 6px 18px -6px rgba(0, 93, 181, 0.45)',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = S.primaryDim;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = S.primary;
                }}
              >
                {step === 1 ? (
                  <>
                    Next
                    <ChevronRight size={16} />
                  </>
                ) : (
                  <>Got it — let&rsquo;s go</>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ─── Step 1: MVP welcome / disclaimer ───────────────────────────────
const Step1Welcome: FC = () => (
  <div>
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: 999,
        backgroundColor: S.surfaceLow,
        color: S.primary,
        fontFamily: HEADLINE_FONT,
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        marginBottom: 16,
      }}
    >
      <Sparkles size={12} />
      Early Access
    </div>

    <h2
      style={{
        fontFamily: HEADLINE_FONT,
        fontSize: 28,
        fontWeight: 800,
        letterSpacing: '-0.02em',
        color: S.onBg,
        margin: 0,
        lineHeight: 1.15,
      }}
    >
      Welcome to the Profit Pool Engine
    </h2>

    <p
      style={{
        marginTop: 18,
        fontSize: 15,
        lineHeight: 1.6,
        color: S.onSurface,
      }}
    >
      You&rsquo;re one of our early access users — thanks for being here.
    </p>

    <p
      style={{
        marginTop: 14,
        fontSize: 15,
        lineHeight: 1.6,
        color: S.onSurface,
      }}
    >
      This is an{' '}
      <strong style={{ color: S.onBg }}>MVP (Minimum Viable Product)</strong>.
      The focus right now is on validating the{' '}
      <strong style={{ color: S.onBg }}>logic and functionality</strong> of the
      tool, not on the specific insights or details you&rsquo;ll see in the views.
      Note that the{' '}
      <strong style={{ color: S.onBg }}>underlying data may still change</strong>{' '}
      as the project progresses and sources are reviewed.
    </p>

    <p
      style={{
        marginTop: 14,
        fontSize: 15,
        lineHeight: 1.6,
        color: S.onSurface,
      }}
    >
      Your feedback matters: please share what works, what&rsquo;s confusing, and
      what&rsquo;s missing directly with{' '}
      <strong style={{ color: S.primary }}>Alexander Laker</strong>.
    </p>
  </div>
);

// ─── Step 2: The 4 views ────────────────────────────────────────────
const Step2Views: FC = () => (
  <div>
    <h2
      style={{
        fontFamily: HEADLINE_FONT,
        fontSize: 26,
        fontWeight: 800,
        letterSpacing: '-0.02em',
        color: S.onBg,
        margin: 0,
        lineHeight: 1.15,
      }}
    >
      What&rsquo;s inside
    </h2>

    <p
      style={{
        marginTop: 12,
        fontSize: 14,
        lineHeight: 1.55,
        color: S.onSurfaceVariant,
      }}
    >
      Four views, in the order shown in the header.{' '}
      <strong style={{ color: S.onBg }}>Trends is the main input page</strong>{' '}
      — the other three are output views built on top of it.
    </p>

    {/* INPUT */}
    <SectionLabel>Input</SectionLabel>
    <ViewCard
      number="1"
      icon={Activity}
      title="Trends"
      body="The main input page. All categories, signals, and assumptions are set here and feed into the output views."
    />

    {/* OUTPUTS */}
    <SectionLabel style={{ marginTop: 18 }}>Outputs</SectionLabel>
    <ViewCard
      number="2"
      icon={Route}
      title="Consumer Journey"
      body="Maps how consumers move through the category and translates each stage into its impact on the profit pool shift."
    />
    <ViewCard
      number="3"
      icon={TrendingUp}
      title="Profit Pool Shift Analysis"
      body="Visualizes where value is migrating, sliced by time path, force, region, and value chain step."
      note="Values reflect the isolated trend impact on HCB's current business — excluding price moves, innovations, or competitor actions."
    />
    <ViewCard
      number="4"
      icon={Lightbulb}
      title="Innovation Explorer"
      body="Explores innovation white spaces and opportunities derived from the shifts above."
    />
  </div>
);

// ─── Small building blocks for Step 2 ───────────────────────────────
const SectionLabel: FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <div
    style={{
      marginTop: 22,
      marginBottom: 10,
      fontFamily: HEADLINE_FONT,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: S.onSurfaceVariant,
      ...style,
    }}
  >
    {children}
  </div>
);

interface ViewCardProps {
  number: string;
  icon: LucideIcon;
  title: string;
  body: string;
  note?: string;
}

const ViewCard: FC<ViewCardProps> = ({ number, icon: Icon, title, body, note }) => (
  <div
    style={{
      display: 'flex',
      gap: 14,
      padding: '14px 16px',
      backgroundColor: S.surfaceLow,
      border: `1px solid ${S.cardBorder}`,
      borderRadius: 14,
      marginBottom: 10,
      alignItems: 'flex-start',
    }}
  >
    <div
      style={{
        flex: '0 0 36px',
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: S.surfaceHigh,
        color: S.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: HEADLINE_FONT,
        fontWeight: 800,
        fontSize: 14,
        position: 'relative',
      }}
    >
      <Icon size={16} color={S.primary} />
      <span
        style={{
          position: 'absolute',
          top: -6,
          right: -6,
          backgroundColor: S.primary,
          color: 'white',
          width: 18,
          height: 18,
          borderRadius: 999,
          fontSize: 10,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {number}
      </span>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontFamily: HEADLINE_FONT,
          fontWeight: 700,
          fontSize: 15,
          color: S.onBg,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 13.5,
          lineHeight: 1.5,
          color: S.onSurface,
        }}
      >
        {body}
      </div>
      {note && (
        <div
          style={{
            marginTop: 8,
            padding: '8px 10px',
            borderLeft: `3px solid ${S.outlineVariant}`,
            backgroundColor: S.surface,
            borderRadius: 6,
            fontSize: 12.5,
            lineHeight: 1.5,
            color: S.onSurfaceVariant,
            fontStyle: 'italic',
          }}
        >
          {note}
        </div>
      )}
    </div>
  </div>
);

export default WelcomeModal;
