/**
 * OnboardingTooltips — First-time user guided tour
 * Step-by-step introduction to Profit Pool Shift Model interface
 * Apple-style, light mode
 */

import { useState, useEffect, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────

interface TourStep {
  id: string;
  title: string;
  description: string;
  target: string;
}

interface OnboardingTooltipsProps {
  isOpen?: boolean;
  onComplete?: () => void;
}

// ─── Tour Steps ────────────────────────────────────────────────────────────

const TOUR_STEPS: TourStep[] = [
  {
    id: 'kpi',
    title: 'Portfolio Overview',
    description: 'These KPI cards show your portfolio shift, top opportunities, and model quality.',
    target: '[data-onboarding="kpi"]',
  },
  {
    id: 'heatmap',
    title: 'Force × Category Heatmap',
    description: 'Click any cell to see which forces are driving shifts in each category.',
    target: '[data-onboarding="heatmap"]',
  },
  {
    id: 'timeline',
    title: 'Continuous Path Timeline',
    description: 'Visualize how shifts evolve over time. Watch for velocity changes and triggers.',
    target: '[data-onboarding="timeline"]',
  },
  {
    id: 'scenario',
    title: 'Scenario Selector',
    description: 'Compare different strategic scenarios and their impacts on your portfolio.',
    target: '[data-onboarding="scenario"]',
  },
  {
    id: 'export',
    title: 'Export & Action',
    description: 'Export results to Excel, PowerPoint, or push to Power BI dashboards.',
    target: '[data-onboarding="export"]',
  },
];

// ─── OnboardingTooltips ────────────────────────────────────────────────────

const OnboardingTooltips: FC<OnboardingTooltipsProps> = ({ isOpen = true, onComplete = () => {} }) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [visible, setVisible] = useState<boolean>(isOpen);
  const [hasSeenTour, setHasSeenTour] = useState<boolean>(false);

  // Check localStorage on mount
  useEffect(() => {
    try {
      const seen = localStorage?.getItem('pulse-tour-completed');
      if (seen) {
        setHasSeenTour(true);
        setVisible(false);
      }
    } catch (e) {
      // localStorage not available, continue with tour
    }
  }, []);

  const handleNext = (): void => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = (): void => {
    handleComplete();
  };

  const handleComplete = (): void => {
    try {
      localStorage?.setItem('pulse-tour-completed', 'true');
    } catch (e) {
      // localStorage not available
    }
    setVisible(false);
    setHasSeenTour(true);
    onComplete();
  };

  if (!visible || hasSeenTour) return null;

  const step = TOUR_STEPS[currentStep];
  const targetEl = step ? (document.querySelector(step.target) as HTMLElement | null) : null;
  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100;

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleSkip}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.3)',
              zIndex: 999,
            }}
          />

          {/* Spotlight effect on target */}
          {targetEl && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: 'none',
                zIndex: 1000,
              }}
            >
              <svg
                width="100%"
                height="100%"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                }}
              >
                <defs>
                  <mask id="tour-mask">
                    <rect width="100%" height="100%" fill="white" />
                    {targetEl && (
                      <rect
                        x={targetEl.offsetLeft - 8}
                        y={targetEl.offsetTop - 8}
                        width={targetEl.offsetWidth + 16}
                        height={targetEl.offsetHeight + 16}
                        rx={12}
                        fill="black"
                      />
                    )}
                  </mask>
                </defs>
                <rect
                  width="100%"
                  height="100%"
                  fill="rgba(0,0,0,0.4)"
                  mask="url(#tour-mask)"
                />
              </svg>
            </motion.div>
          )}

          {/* Tooltip */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              bottom: 32,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1001,
              maxWidth: 400,
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
              border: '1px solid rgba(0,0,0,0.08)',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Close button */}
            <button
              onClick={handleSkip}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.04)',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)';
              }}
            >
              <X size={16} color="#1D1D1F" />
            </button>

            {/* Title & Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h3
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  color: '#1D1D1F',
                  margin: 0,
                }}
              >
                {step?.title}
              </h3>
              <p
                style={{
                  fontSize: 15,
                  color: '#6E6E73',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {step?.description}
              </p>
            </div>

            {/* Progress bar */}
            <div
              style={{
                width: '100%',
                height: 3,
                backgroundColor: '#F5F5F7',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                style={{
                  height: '100%',
                  backgroundColor: '#0071E3',
                }}
              />
            </div>

            {/* Step counter & buttons */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: '#6E6E73',
                }}
              >
                {currentStep + 1} of {TOUR_STEPS.length}
              </span>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={handleSkip}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#F5F5F7',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 15,
                    fontWeight: 500,
                    color: '#1D1D1F',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#EFEFEF';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#F5F5F7';
                  }}
                >
                  Skip
                </button>
                <button
                  onClick={handleNext}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 16px',
                    backgroundColor: '#0071E3',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 15,
                    fontWeight: 500,
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#0066CC';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#0071E3';
                  }}
                >
                  {currentStep === TOUR_STEPS.length - 1 ? 'Done' : 'Next'}
                  {currentStep < TOUR_STEPS.length - 1 && <ChevronRight size={16} />}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default OnboardingTooltips;
