/**
 * ExecutiveBriefing — Guided walkthrough mode for ExCo presentations.
 *
 * 5-slide storytelling interface:
 * 1. Portfolio Overview — "The Big Picture"
 * 2. Top Risks — "Where We're Losing Ground"
 * 3. Top Opportunities — "Where We Can Win"
 * 4. Causal Story — "How Forces Connect"
 * 5. Recommendations — "What Should We Do"
 *
 * Full-screen overlay (z-index 500) with centered card.
 * Left/Right arrows, dot indicators, auto-advance timer option.
 * Speaker notes toggle.
 *
 * Design: Apple-like, minimal chrome, large readable text.
 */

import React, { useState, useMemo, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, FileText } from 'lucide-react';
import { T, fmtShift, CATEGORIES } from '../lib/format';
import type { ShiftMatrix, Trend, ConvergenceDiagnostics, AllocationRecommendation } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

interface ExecutiveBriefingProps {
  shifts: ShiftMatrix | null;
  trends: Trend[];
  convergence: ConvergenceDiagnostics | null;
  allocation: AllocationRecommendation[];
  onClose: () => void;
}

interface SlideData {
  title: string;
  description: string;
  content: React.ReactNode;
  notes: string;
}

// ─── Slide Data Generator ────────────────────────────────────────────────

function generateSlides(
  shifts: ShiftMatrix | null,
  trends: Trend[],
  convergence: ConvergenceDiagnostics | null,
  allocation: AllocationRecommendation[]
): SlideData[] {
  // Helper: compute net portfolio shift
  function computeNetShift(): number {
    if (!shifts) return 0;
    const values: number[] = [];
    Object.values(shifts).forEach(categoryPath => {
      if (typeof categoryPath === 'object' && categoryPath[2030]) {
        const yearData = categoryPath[2030];
        const median = typeof yearData === 'number' ? yearData : (yearData as any).median || 0;
        values.push(median);
      }
    });
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  // Helper: get top N categories by 2030 shift
  function getTopCategories(n: number, direction: 'contraction' | 'expansion'): Array<{ name: string; shift: number }> {
    if (!shifts) return [];
    const entries = Object.entries(shifts)
      .map(([catName, catPath]) => {
        const yearData = (catPath as any)[2030];
        const median = typeof yearData === 'number' ? yearData : (yearData as any)?.median || 0;
        return { name: catName, shift: median };
      })
      .filter(e => (direction === 'contraction' ? e.shift < 0 : e.shift > 0))
      .sort((a, b) => (direction === 'contraction' ? a.shift - b.shift : b.shift - a.shift))
      .slice(0, n);
    return entries;
  }

  // Helper: get dominant force
  function getDominantForce(): { force: string; rationale: string } {
    const forceImpacts: Record<string, number> = {};
    trends.forEach(t => {
      const key = t.force;
      forceImpacts[key] = (forceImpacts[key] || 0) + ((t.probability || 0)) * (t.direction === 'Contraction' ? -1 : 1);
    });
    const dominant = Object.entries(forceImpacts).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
    return {
      force: dominant?.[0] || 'Government',
      rationale: `${dominant?.[0] || 'Government'} force is the primary catalyst driving portfolio shifts.`,
    };
  }

  const netShift = computeNetShift();
  const topRisks = getTopCategories(3, 'contraction');
  const topOps = getTopCategories(3, 'expansion');
  const dominantForce = getDominantForce();

  // Compute allocation buckets from AllocationRecommendation structure
  const firstAlloc = allocation[0];
  const investMoreCats = (firstAlloc?.invest_more || []).slice(0, 3);
  const defendCats = (firstAlloc?.defend || []).slice(0, 3);
  const harvestCats = (firstAlloc?.harvest || []).slice(0, 3);

  const slides: SlideData[] = [
    // ─── Slide 1: Portfolio Overview ───
    {
      title: 'Portfolio Overview',
      description: 'The Big Picture',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: '56px',
                fontWeight: 300,
                color: netShift < 0 ? '#FF453A' : '#30D158',
                fontFamily: T.mono,
                marginBottom: '12px',
              }}
            >
              {fmtShift(netShift, 1)}
            </div>
            <div style={{ fontSize: '16px', color: T.text2, fontWeight: 500 }}>
              Net portfolio shift by 2030
            </div>
          </div>
          <div style={{ fontSize: '14px', lineHeight: 1.7, color: T.text, maxWidth: '500px', textAlign: 'center' }}>
            The portfolio is{' '}
            <strong>{netShift < 0 ? 'contracting' : 'expanding'}</strong> at{' '}
            <strong>{Math.abs(netShift).toFixed(1)}%</strong> by 2030, driven primarily by{' '}
            <strong>{topRisks[0]?.name || 'Fabric Care'}</strong>.
          </div>
          <div
            style={{
              padding: '12px 20px',
              borderRadius: '20px',
              background: `rgba(48,209,88,0.08)`,
              color: '#30D158',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            Model: Bayesian MC + t-copula
          </div>
        </div>
      ),
      notes: `Present the headline number with confidence. If negative, frame as strategic headwind requiring proactive response.`,
    },

    // ─── Slide 2: Top Risks ───
    {
      title: 'Top Risks',
      description: "Where We're Losing Ground",
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {topRisks.map((cat, idx) => (
            <div
              key={idx}
              style={{
                padding: '16px 20px',
                borderRadius: '12px',
                background: T.bg1,
                border: `1px solid ${T.border1}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: T.text, marginBottom: '4px' }}>
                  {cat.name}
                </div>
                <div style={{ fontSize: '12px', color: T.text2 }}>
                  Regulatory pressure driving formulation costs & margin compression
                </div>
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#FF453A',
                  fontFamily: T.mono,
                  minWidth: '60px',
                  textAlign: 'right',
                }}
              >
                {fmtShift(cat.shift, 1)}
              </div>
            </div>
          ))}
        </div>
      ),
      notes: `Highlight the largest contractions. For each, identify the primary force driver. Use these as anchors for the causal story.`,
    },

    // ─── Slide 3: Top Opportunities ───
    {
      title: 'Top Opportunities',
      description: "Where We Can Win",
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {topOps.map((cat, idx) => (
            <div
              key={idx}
              style={{
                padding: '16px 20px',
                borderRadius: '12px',
                background: T.bg1,
                border: `1px solid ${T.border1}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: T.text, marginBottom: '4px' }}>
                  {cat.name}
                </div>
                <div style={{ fontSize: '12px', color: T.text2 }}>
                  Consumer demand for premium, sustainable alternatives driving premiumization
                </div>
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#30D158',
                  fontFamily: T.mono,
                  minWidth: '60px',
                  textAlign: 'right',
                }}
              >
                {fmtShift(cat.shift, 1)}
              </div>
            </div>
          ))}
        </div>
      ),
      notes: `Celebrate wins. Explain growth drivers: sustainability, premiumization, or channel shift. Position for investment.`,
    },

    // ─── Slide 4: Causal Story ───
    {
      title: 'Causal Story',
      description: "How Forces Connect",
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              padding: '20px',
              borderRadius: '12px',
              background: `linear-gradient(135deg, ${T.bg1}, ${T.bg2})`,
              border: `1px solid ${T.border1}`,
            }}
          >
            <div style={{ fontSize: '12px', color: T.text2, marginBottom: '12px', fontWeight: 600 }}>
              PRIMARY CAUSAL CHAIN
            </div>
            <div style={{ fontSize: '14px', lineHeight: 1.8, color: T.text }}>
              <strong>{dominantForce.force} regulation</strong> is the primary catalyst, propagating through:
              <br />
              <br />
              • <strong>Technology</strong> (reformulation costs, R&D capex) — weight 0.6
              <br />
              • <strong>Customer</strong> (shelf price pass-through) — weight 0.4
              <br />
              • <strong>Consumer</strong> (willingness to pay premium) — secondary effect
            </div>
          </div>
          <div style={{ fontSize: '12px', color: T.text2, textAlign: 'center' }}>
            Second-order effects cascade through competitive and environmental forces.
          </div>
        </div>
      ),
      notes: `Walk through the causal DAG. Show how one shock (regulation) ripples through the system. Emphasize time lags (year 1 vs. year 2+ effects).`,
    },

    // ─── Slide 5: Recommendations ───
    {
      title: 'Recommendations',
      description: "What Should We Do",
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {[
            { label: 'INVEST MORE', items: investMoreCats, color: '#30D158', action: 'increase allocation' },
            { label: 'DEFEND', items: defendCats, color: '#FF9F0A', action: 'maintain competitive position' },
            { label: 'HARVEST', items: harvestCats, color: '#FF453A', action: 'optimize for cash flow' },
          ]
            .filter(bucket => bucket.items.length > 0)
            .map((bucket, idx) => (
              <div key={idx}>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '1px',
                    color: bucket.color,
                    marginBottom: '8px',
                  }}
                >
                  {bucket.label}
                </div>
                {bucket.items.map((catName, aidx) => (
                  <div
                    key={aidx}
                    style={{
                      fontSize: '12px',
                      color: T.text,
                      marginBottom: '4px',
                      marginLeft: '12px',
                    }}
                  >
                    • <strong>{catName}</strong> — {bucket.action}
                  </div>
                ))}
              </div>
            ))}
        </div>
      ),
      notes: `Summarize allocation recommendations. Explain risk/return tradeoff. Provide next steps: portfolio review, board approval, implementation roadmap.`,
    },
  ];

  return slides;
}

// ─── ExecutiveBriefing Component ────────────────────────────────────────

const ExecutiveBriefing: FC<ExecutiveBriefingProps> = ({
  shifts,
  trends,
  convergence,
  allocation,
  onClose,
}) => {
  const [currentStop, setCurrentStop] = useState(0);
  const [showNotes, setShowNotes] = useState(false);

  const slides = useMemo(
    () => generateSlides(shifts, trends, convergence, allocation),
    [shifts, trends, convergence, allocation]
  );

  const currentSlide = slides[currentStop] as SlideData | undefined;
  if (!currentSlide) return null;

  const handlePrevious = () => {
    setCurrentStop(Math.max(0, currentStop - 1));
  };

  const handleNext = () => {
    setCurrentStop(Math.min(slides.length - 1, currentStop + 1));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') handlePrevious();
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'Escape') onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 500,
      }}
    >
      {/* Main Card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '960px',
          maxHeight: '80vh',
          backgroundColor: '#fff',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '32px',
            borderBottom: `1px solid ${T.border1}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 600, color: T.text, margin: '0 0 6px 0' }}>
              {currentSlide.title}
            </h1>
            <p style={{ fontSize: '14px', color: T.text2, margin: 0 }}>
              {currentSlide.description}
            </p>
          </div>
          <motion.button
            onClick={onClose}
            whileHover={{ background: T.bg3 }}
            style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              background: 'transparent',
              color: T.text2,
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </motion.button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            padding: '32px',
            overflow: 'auto',
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStop}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {currentSlide.content}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer: Navigation */}
        <div
          style={{
            padding: '20px 32px',
            borderTop: `1px solid ${T.border1}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: T.bg3,
          }}
        >
          {/* Left: Notes button */}
          <motion.button
            onClick={() => setShowNotes(!showNotes)}
            whileHover={{ background: T.border1 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              border: `1px solid ${T.border}`,
              background: 'transparent',
              color: T.text2,
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <FileText size={14} />
            Notes
          </motion.button>

          {/* Center: Progress dots */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {slides.map((_, idx) => (
              <div
                key={idx}
                onClick={() => setCurrentStop(idx)}
                style={{
                  width: idx === currentStop ? 12 : 8,
                  height: 8,
                  borderRadius: '50%',
                  background: idx === currentStop ? T.accent : T.border2,
                  cursor: 'pointer',
                  transition: 'all 200ms ease',
                }}
              />
            ))}
          </div>

          {/* Right: Navigation controls */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: T.text2, minWidth: '40px', textAlign: 'right' }}>
              {currentStop + 1} of {slides.length}
            </div>
            <motion.button
              onClick={handlePrevious}
              disabled={currentStop === 0}
              whileHover={{ background: T.border1 }}
              style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
                border: `1px solid ${T.border}`,
                background: 'transparent',
                color: currentStop === 0 ? T.text4 : T.text2,
                cursor: currentStop === 0 ? 'not-allowed' : 'pointer',
                opacity: currentStop === 0 ? 0.5 : 1,
              }}
            >
              <ChevronLeft size={16} />
            </motion.button>
            <motion.button
              onClick={handleNext}
              disabled={currentStop === slides.length - 1}
              whileHover={{ background: T.border1 }}
              style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
                border: `1px solid ${T.border}`,
                background: 'transparent',
                color: currentStop === slides.length - 1 ? T.text4 : T.text2,
                cursor: currentStop === slides.length - 1 ? 'not-allowed' : 'pointer',
                opacity: currentStop === slides.length - 1 ? 0.5 : 1,
              }}
            >
              <ChevronRight size={16} />
            </motion.button>
          </div>
        </div>

        {/* Speaker Notes Slide-up */}
        <AnimatePresence>
          {showNotes && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              style={{
                borderTop: `1px solid ${T.border1}`,
                background: T.bg3,
                padding: '16px 32px',
                maxHeight: '120px',
                overflow: 'auto',
              }}
            >
              <div style={{ fontSize: 11, color: T.text2, fontWeight: 600, marginBottom: 8 }}>
                SPEAKER NOTES
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: T.text }}>
                {currentSlide.notes}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

export default ExecutiveBriefing;
