/**
 * The welcome dialog: two steps of orientation, shown once per sign-in
 * (app/dashboard/DashboardApp.tsx keeps the per-session flag).
 *
 *   Step 1: the early-access note and a request for feedback.
 *   Step 2: the three production views in header order: Drivers (the input),
 *           Consumer Journey, Profit Pool Shift Analysis. The Profit Pool
 *           Explorer (Beta) is left out; it sits at the right of the top nav.
 */

'use client';

import { useEffect, useRef, useState, type CSSProperties, type FC, type ReactNode, type RefObject } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronRight,
  Sparkles,
  Activity,
  Route,
  TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import useOverlay from '@/hooks/useOverlay';
import FeedbackLink from '@/components/dashboard/FeedbackLink';
import { HORIZON } from '@/lib/format';
import { S, SHADOW, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

const WelcomeModal: FC<WelcomeModalProps> = ({ open, onClose }) => {
  const [step, setStep] = useState<1 | 2>(1);

  // Every opening starts at step 1. The step resets during the render in
  // which `open` turns true (React's pattern for state that follows a prop),
  // so opening costs no extra commit.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setStep(1);
  }

  const modalRef = useRef<HTMLDivElement | null>(null);
  useOverlay(open, onClose, modalRef);

  // Focus starts on the step's heading, and moves to the new heading on Next
  // and Back, so a screen reader hears the step from its title. The frame's
  // delay lets useOverlay's own move to the first control run first (its
  // effect is declared above, so its frame comes first).
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(raf);
  }, [open, step]);

  return (
    <AnimatePresence>
      {open && (
        <>
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
              backgroundColor: S.scrim,
              backdropFilter: 'blur(4px)',
            }}
          />

          {/* A flex wrapper centres the card. translate(-50%, -50%) on the
              card itself would not hold: Framer Motion's animated transform
              (scale, y) replaces it. */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 201,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              pointerEvents: 'none',
            }}
          >
            <motion.div
              ref={modalRef}
              initial={{ opacity: 0, scale: 0.97, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              role="dialog"
              aria-modal="true"
              aria-label="Welcome to PRISM"
              tabIndex={-1}
              style={{
                position: 'relative',
                width: 'min(620px, 92vw)',
                maxHeight: '90vh',
                backgroundColor: S.surface,
                borderRadius: 20,
                boxShadow: SHADOW.dialog,
                overflow: 'hidden',
                fontFamily: BODY_FONT,
                display: 'flex',
                flexDirection: 'column',
                pointerEvents: 'auto',
              }}
            >
            {/* The step dots; their hidden text says the step, and the
                change is announced when Next or Back is pressed. */}
            <div
              role="status"
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
                aria-hidden
                style={{
                  width: step === 1 ? 22 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: step === 1 ? S.primary : S.surfaceHigh,
                  transition: 'all 0.2s ease',
                }}
              />
              <span
                aria-hidden
                style={{
                  width: step === 2 ? 22 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: step === 2 ? S.primary : S.surfaceHigh,
                  transition: 'all 0.2s ease',
                }}
              />
              <span className="sr-only">Step {step} of 2</span>
            </div>

            <div
              className="px-5 pt-14 pb-6 md:px-10 md:pb-7"
              style={{
                overflowY: 'auto',
                flex: 1,
              }}
            >
              {step === 1 ? <Step1Welcome headingRef={headingRef} /> : <Step2Views headingRef={headingRef} />}
            </div>

            <div
              className="px-5 pt-4 pb-5 md:px-10 md:pt-5 md:pb-7"
              style={{
                borderTop: `1px solid ${S.cardBorder}`,
                backgroundColor: S.surface,
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 12,
              }}
            >
              {step === 2 && (
                <button type="button"
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
              <button type="button"
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
                  color: S.onPrimary,
                  fontFamily: HEADLINE_FONT,
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: '-0.01em',
                  cursor: 'pointer',
                  boxShadow: SHADOW.primaryButton,
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
                  <>Got it, let&rsquo;s go</>
                )}
              </button>
            </div>

            {/* Last in the dialog, so the step's own controls come first in
                the tab order; its place is the top right corner. */}
            <button type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: 'transparent',
                border: 'none',
                width: 34,
                height: 34,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 999,
                cursor: 'pointer',
                color: S.onSurfaceVariant,
                zIndex: 2,
              }}
            >
              <X size={18} aria-hidden />
            </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

type StepProps = { headingRef: RefObject<HTMLHeadingElement | null> };

// ─── Step 1: early access ───────────────────────────────────────────
const Step1Welcome: FC<StepProps> = ({ headingRef }) => (
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
      ref={headingRef}
      tabIndex={-1}
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
      Welcome to PRISM
    </h2>

    <p
      style={{
        marginTop: 18,
        fontSize: 15,
        lineHeight: 1.6,
        color: S.onSurface,
      }}
    >
      You are an early-access user. We are testing whether PRISM&rsquo;s logic and workflow hold up; the
      numbers may still change as sources are checked.
    </p>

    <p
      style={{
        marginTop: 14,
        fontSize: 15,
        lineHeight: 1.6,
        color: S.onSurface,
      }}
    >
      Tell us what works, what confuses and what is missing: <FeedbackLink />.
    </p>
  </div>
);

// ─── Step 2: the three views ────────────────────────────────────────
const Step2Views: FC<StepProps> = ({ headingRef }) => (
  <div>
    <h2
      ref={headingRef}
      tabIndex={-1}
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
      Three views, left to right in the header.{' '}
      <strong style={{ color: S.onBg }}>Start with Drivers:</strong>{' '}
      everything the model computes comes from their scores.
    </p>

    <SectionLabel>Input</SectionLabel>
    <ViewCard
      number="1"
      icon={Activity}
      title="Drivers"
      body="Lists each Profit Pool Driver with its scores: probability, share of GP1 affected, timing, uncertainty, and exposure by category and region."
    />

    <SectionLabel style={{ marginTop: 18 }}>Context</SectionLabel>
    <ViewCard
      number="2"
      icon={Route}
      title="Consumer Journey"
      body="Maps the moments of the consumer journey and the drivers linked to them. Its tiles are strategists' hypotheses, not findings; they do not feed the model."
    />

    <SectionLabel style={{ marginTop: 18 }}>Output</SectionLabel>
    <ViewCard
      number="3"
      icon={TrendingUp}
      title="Profit Pool Shift Analysis"
      body={`Shows how the drivers shift each category's gross profit to ${HORIZON}, by time path, force, region and value-chain stage.`}
      note="Values are the drivers' effect on HCB's current business if nobody responds: no price moves, innovation or competitive reaction by Henkel or anyone else. Read them as exposure, not as a forecast."
    />
  </div>
);

// ─── Building blocks of step 2 ──────────────────────────────────────
const SectionLabel: FC<{ children: ReactNode; style?: CSSProperties }> = ({
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
          color: S.onPrimary,
          width: 18,
          height: 18,
          borderRadius: 999,
          fontSize: 11,
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
