/**
 * DelphiPanel — Expert Elicitation UI (Redesigned)
 *
 * Card-by-card scoring wizard with Next/Previous navigation.
 * Trends grouped by force category.
 * 3-round structure:
 *   Round 1 — Independent blind scoring (no group context)
 *   Round 2 — Calibrated re-scoring (see anonymized Round 1 distributions)
 *   Round 3 — Outlier resolution (focus on low-agreement trends, final lock)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Plus, ChevronRight, ChevronLeft, AlertCircle, CheckCircle2, Clock,
  Download, Play, Zap, Users, BarChart3, Send, ArrowRight, ArrowLeft,
  Eye, Lock, RefreshCw,
} from 'lucide-react';
import { T, FORCES, FORCE_COLORS } from '../lib/format';
import * as api from '../api/client';
import DelphiDistribution from './DelphiDistribution';
import LoadingSkeleton from './LoadingSkeleton';

// ── Types ──────────────────────────────────────────────────────

interface TrendData {
  id: string;
  name: string;
  description: string;
  force: string;
  direction: 'Expansion' | 'Contraction';
  impact?: number;
  probability?: number;
  strategic_implication?: string;
  previous_round_scores?: {
    impact?: number[];
    probability?: number[];
    impact_alpha?: number;
    probability_alpha?: number;
  };
}

interface TrendScore {
  trend_id: string;
  impact: number;
  probability: number;
  rationale: string;
}

interface SessionData {
  id: string;
  name: string;
  status: string;
  current_round: number;
  scorer_count: number;
  trend_count: number;
  reliability_alpha?: number;
}

interface DelphiPanelProps {
  onClose: () => void;
}

// Force ordering for structured progression
const FORCE_ORDER = ['Consumer', 'Customer', 'Technology', 'Government', 'Environmental', 'Competitive'];

// Round descriptions
const ROUND_INFO: Record<number, { title: string; subtitle: string; icon: React.ReactNode }> = {
  1: {
    title: 'Round 1 — Independent Scoring',
    subtitle: 'Score each trend independently. No group context is shown. Trust your own judgment.',
    icon: <Eye size={16} />,
  },
  2: {
    title: 'Round 2 — Calibrated Re-Scoring',
    subtitle: 'Review anonymized Round 1 distributions from all scorers. Adjust your scores with group context.',
    icon: <RefreshCw size={16} />,
  },
  3: {
    title: 'Round 3 — Final Resolution',
    subtitle: 'Focus on trends with low agreement (α < 0.67). Provide final scores and rationale.',
    icon: <Lock size={16} />,
  },
};

// ── Score Slider Component ────────────────────────────────────

interface ScoreSliderProps {
  label: 'Impact' | 'Probability';
  value: number;
  onChange: (v: number) => void;
  previousScores?: number[];
  previousAlpha?: number;
  showPrevious?: boolean;
}

function ScoreSlider({ label, value, onChange, previousScores, previousAlpha, showPrevious = false }: ScoreSliderProps) {
  const labels = label === 'Impact'
    ? ['Negligible', 'Low', 'Moderate', 'High', 'Transformative']
    : ['Very Unlikely', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.text2 }}>{label}</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: value > 0 ? T.accent : T.text4, fontFamily: T.mono }}>
          {value > 0 ? `${value}/5 — ${labels[value - 1]}` : 'Not scored yet'}
        </span>
      </div>

      {/* Dot selector */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {[1, 2, 3, 4, 5].map((dot) => (
          <button
            key={dot}
            onClick={() => onChange(dot)}
            style={{
              width: 48, height: 48,
              borderRadius: 12,
              border: dot === value ? `2px solid ${T.accent}` : `1px solid ${T.border1}`,
              backgroundColor: dot === value ? T.accentDim : T.bg,
              color: dot === value ? T.accent : T.text3,
              fontSize: 16, fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 2,
            }}
          >
            <span>{dot}</span>
            <span style={{ fontSize: 7, fontWeight: 500, lineHeight: 1 }}>{labels[dot - 1]}</span>
          </button>
        ))}
      </div>

      {/* Previous round distribution (Round 2+) */}
      {showPrevious && previousScores && previousScores.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <DelphiDistribution
            scores={previousScores}
            median={previousScores.reduce((a, b) => a + b, 0) / previousScores.length}
            alpha={previousAlpha ?? null}
            label={`Previous Round (${previousScores.length} scorers)`}
          />
        </div>
      )}
    </div>
  );
}

// ── Scoring Wizard (Card-by-Card) ─────────────────────────────

interface ScoringWizardProps {
  session: SessionData;
  trends: TrendData[];
  scorerName: string;
  onScorerNameChange: (name: string) => void;
  onSubmitAll: (scores: TrendScore[]) => Promise<void>;
  submitting: boolean;
}

function ScoringWizard({ session, trends, scorerName, onScorerNameChange, onSubmitAll, submitting }: ScoringWizardProps) {
  // Sort trends by force order
  const sortedTrends = useMemo(() => {
    return [...trends].sort((a, b) => {
      const ai = FORCE_ORDER.indexOf(a.force);
      const bi = FORCE_ORDER.indexOf(b.force);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [trends]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [scores, setScores] = useState<Record<string, TrendScore>>({});
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward

  const current = sortedTrends[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === sortedTrends.length - 1;
  const currentRound = session.current_round || 1;
  const roundInfo = ROUND_INFO[currentRound] || ROUND_INFO[1];
  const showPreviousDistributions = currentRound >= 2;

  // Get current score or defaults (0 = not yet scored)
  const currentScore = scores[current?.id] || {
    trend_id: current?.id || '',
    impact: 0,
    probability: 0,
    rationale: '',
  };

  const updateScore = (field: keyof TrendScore, value: any) => {
    setScores(prev => ({
      ...prev,
      [current.id]: { ...currentScore, trend_id: current.id, [field]: value },
    }));
  };

  // Initialize score when navigating to a new trend (0 = unscored)
  useEffect(() => {
    if (current && !scores[current.id]) {
      setScores(prev => ({
        ...prev,
        [current.id]: {
          trend_id: current.id,
          impact: 0,
          probability: 0,
          rationale: '',
        },
      }));
    }
  }, [currentIndex, current]);

  const goNext = () => {
    if (!isLast) {
      setDirection(1);
      setCurrentIndex(i => i + 1);
    }
  };

  const goPrev = () => {
    if (!isFirst) {
      setDirection(-1);
      setCurrentIndex(i => i - 1);
    }
  };

  // Check if all trends have been scored (impact + probability > 0)
  const allScored = sortedTrends.every(t => {
    const s = scores[t.id];
    return s && s.impact > 0 && s.probability > 0;
  });

  const handleSubmit = async () => {
    if (!allScored) return;
    const allScores: TrendScore[] = sortedTrends.map(t => ({
      trend_id: t.id,
      impact: scores[t.id]?.impact || 3,
      probability: scores[t.id]?.probability || 3,
      rationale: scores[t.id]?.rationale ?? '',
    }));
    await onSubmitAll(allScores);
  };

  // Count scored trends (those with rationale)
  const scoredCount = sortedTrends.filter(t => (scores[t.id]?.rationale?.length || 0) >= 10).length;

  // Detect force group transition
  const currentForce = current?.force || '';
  const prevForce = currentIndex > 0 ? sortedTrends[currentIndex - 1]?.force : null;
  const isNewForceGroup = currentForce !== prevForce;

  // Count trends per force for progress
  const forceCounts = useMemo(() => {
    const counts: Record<string, { total: number; scored: number }> = {};
    sortedTrends.forEach(t => {
      if (!counts[t.force]) counts[t.force] = { total: 0, scored: 0 };
      counts[t.force].total++;
      if ((scores[t.id]?.rationale?.length || 0) >= 10) counts[t.force].scored++;
    });
    return counts;
  }, [sortedTrends, scores]);

  if (!current) return null;

  const forceColor = FORCES[current.force as keyof typeof FORCES]?.color || T.text3;
  const forceEmoji = FORCES[current.force as keyof typeof FORCES]?.emoji || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Round Header ────────────────────────────── */}
      <div style={{
        padding: '16px 28px',
        borderBottom: `1px solid ${T.border1}`,
        backgroundColor: T.bg1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 8,
            backgroundColor: T.accentDim, color: T.accent,
          }}>
            {roundInfo.icon}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{roundInfo.title}</div>
            <div style={{ fontSize: 11, color: T.text3, marginTop: 1 }}>{roundInfo.subtitle}</div>
          </div>
        </div>

        {/* Force progress chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {FORCE_ORDER.filter(f => forceCounts[f]).map(force => {
            const fc = forceCounts[force];
            const isCurrent = force === currentForce;
            const color = FORCES[force as keyof typeof FORCES]?.color || T.text3;
            return (
              <div key={force} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 6,
                fontSize: 10, fontWeight: 600,
                backgroundColor: isCurrent ? color + '18' : T.bg3,
                color: isCurrent ? color : T.text3,
                border: isCurrent ? `1px solid ${color}30` : `1px solid transparent`,
                transition: 'all 0.2s',
              }}>
                {force}
                <span style={{ fontFamily: T.mono, fontSize: 9 }}>
                  {fc?.scored || 0}/{fc?.total || 0}
                </span>
              </div>
            );
          })}
        </div>

        {/* Overall progress bar */}
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: T.text3 }}>
              Trend {currentIndex + 1} of {sortedTrends.length}
            </span>
            <span style={{ fontSize: 10, color: T.text3 }}>
              {scoredCount} scored
            </span>
          </div>
          <div style={{
            width: '100%', height: 3, backgroundColor: T.bg4,
            borderRadius: 2, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', backgroundColor: T.accent,
              width: `${((currentIndex + 1) / sortedTrends.length) * 100}%`,
              transition: 'width 0.3s ease',
              borderRadius: 2,
            }} />
          </div>
        </div>
      </div>

      {/* ── Scorer Name (if not set) ────────────────── */}
      {!scorerName && (
        <div style={{
          padding: '12px 28px', borderBottom: `1px solid ${T.border1}`,
          backgroundColor: T.amberDim,
        }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.text2, display: 'block', marginBottom: 4 }}>
            Your Name (required to submit)
          </label>
          <input
            type="text"
            placeholder="e.g., Sarah Chen"
            value={scorerName}
            onChange={(e) => onScorerNameChange(e.target.value)}
            style={{
              width: '100%', padding: '8px 10px', fontSize: 13,
              border: `1px solid ${T.border2}`, borderRadius: 8,
              outline: 'none', color: T.text, backgroundColor: T.bg,
              fontFamily: T.sans,
            }}
          />
        </div>
      )}

      {/* ── Trend Card (single, full-visibility) ────── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
          >
            {/* Force group header (shown on first trend of each force) */}
            {isNewForceGroup && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                paddingBottom: 8, borderBottom: `2px solid ${forceColor}20`,
              }}>
                <span style={{ fontSize: 22 }}>{forceEmoji}</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: forceColor }}>{current.force}</div>
                  <div style={{ fontSize: 11, color: T.text3 }}>
                    {forceCounts[current.force]?.total || 0} trends in this category
                  </div>
                </div>
              </div>
            )}

            {/* Trend header */}
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <span style={{
                  display: 'inline-block', padding: '3px 8px',
                  backgroundColor: forceColor + '15', color: forceColor,
                  fontSize: 10, fontWeight: 600, borderRadius: 6,
                }}>{current.force}</span>
                <span style={{
                  display: 'inline-block', padding: '3px 8px',
                  backgroundColor: current.direction === 'Expansion' ? T.greenDim : T.redDim,
                  color: current.direction === 'Expansion' ? T.green : T.red,
                  fontSize: 10, fontWeight: 600, borderRadius: 6,
                }}>{current.direction}</span>
              </div>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.text, lineHeight: 1.3 }}>
                {current.name}
              </h3>
            </div>

            {/* Description */}
            <div style={{
              padding: 16, borderRadius: 12,
              backgroundColor: T.bg1, border: `1px solid ${T.border1}`,
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.text3, textTransform: 'uppercase', marginBottom: 6 }}>
                Background & Evidence
              </div>
              <p style={{ margin: 0, fontSize: 13, color: T.text2, lineHeight: 1.6 }}>
                {current.description}
              </p>
            </div>

            {/* Scoring */}
            <div style={{
              padding: 20, borderRadius: 12,
              backgroundColor: T.bg2, border: `1px solid ${T.border2}`,
              display: 'flex', flexDirection: 'column', gap: 20,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Your Assessment
              </div>

              <ScoreSlider
                label="Impact"
                value={currentScore.impact}
                onChange={(v) => updateScore('impact', v)}
                previousScores={current.previous_round_scores?.impact}
                previousAlpha={current.previous_round_scores?.impact_alpha}
                showPrevious={showPreviousDistributions}
              />

              <ScoreSlider
                label="Probability"
                value={currentScore.probability}
                onChange={(v) => updateScore('probability', v)}
                previousScores={current.previous_round_scores?.probability}
                previousAlpha={current.previous_round_scores?.probability_alpha}
                showPrevious={showPreviousDistributions}
              />

              {/* Rationale */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.text2 }}>Rationale</span>
                  <span style={{
                    fontSize: 11, fontFamily: T.mono,
                    color: (currentScore.rationale?.length || 0) >= 20 ? T.green : T.text3,
                  }}>
                    {currentScore.rationale?.length || 0}/20 min
                  </span>
                </div>
                <textarea
                  value={currentScore.rationale || ''}
                  onChange={(e) => updateScore('rationale', e.target.value)}
                  placeholder={currentRound === 1
                    ? 'Why this score? What evidence supports your assessment?'
                    : currentRound === 2
                      ? 'Has the group distribution changed your view? Why or why not?'
                      : 'Final rationale — why does your assessment differ from the group (if it does)?'}
                  style={{
                    width: '100%', minHeight: 80, padding: 12, fontSize: 13,
                    fontFamily: T.sans, color: T.text, backgroundColor: T.bg,
                    border: `1px solid ${T.border2}`, borderRadius: 10,
                    resize: 'vertical', outline: 'none', lineHeight: 1.5,
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = T.accent}
                  onBlur={(e) => e.currentTarget.style.borderColor = T.border2 as string}
                />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Navigation Footer ────────────────────────── */}
      <div style={{
        padding: '16px 28px',
        borderTop: `1px solid ${T.border1}`,
        backgroundColor: T.bg1,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        {/* Previous */}
        <button
          onClick={goPrev}
          disabled={isFirst}
          style={{
            padding: '10px 20px', borderRadius: 10,
            border: `1px solid ${T.border2}`,
            backgroundColor: T.bg,
            color: isFirst ? T.text4 : T.text2,
            fontSize: 13, fontWeight: 600,
            cursor: isFirst ? 'default' : 'pointer',
            opacity: isFirst ? 0.4 : 1,
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 0.15s',
          }}
        >
          <ArrowLeft size={16} />
          Previous
        </button>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 3 }}>
          {sortedTrends.map((t, i) => {
            const scored = (scores[t.id]?.rationale?.length || 0) >= 10;
            const isCurrent = i === currentIndex;
            return (
              <button
                key={t.id}
                onClick={() => { setDirection(i > currentIndex ? 1 : -1); setCurrentIndex(i); }}
                title={`${t.name} (${t.force})`}
                style={{
                  width: isCurrent ? 18 : 8, height: 8,
                  borderRadius: 4, border: 'none',
                  backgroundColor: isCurrent ? T.accent : scored ? T.green : T.bg4,
                  cursor: 'pointer', transition: 'all 0.2s',
                  opacity: isCurrent ? 1 : 0.7,
                }}
              />
            );
          })}
        </div>

        {/* Next or Submit */}
        {isLast ? (
          <button
            onClick={handleSubmit}
            disabled={submitting || !scorerName || !allScored}
            style={{
              padding: '10px 24px', borderRadius: 10,
              border: 'none',
              backgroundColor: (allScored && scorerName) ? T.green : T.bg4,
              color: (allScored && scorerName) ? '#fff' : T.text3,
              fontSize: 13, fontWeight: 700,
              cursor: (submitting || !scorerName || !allScored) ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.5 : 1,
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.15s',
              boxShadow: (allScored && scorerName) ? '0 2px 8px rgba(48,209,88,0.3)' : 'none',
            }}
          >
            <Send size={16} />
            {submitting ? 'Submitting...' : !allScored ? `Score all trends first` : 'Submit All Scores'}
          </button>
        ) : (
          <button
            onClick={goNext}
            style={{
              padding: '10px 24px', borderRadius: 10,
              border: 'none',
              backgroundColor: T.accent,
              color: '#fff',
              fontSize: 13, fontWeight: 700,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.15s',
              boxShadow: '0 2px 8px rgba(0,113,227,0.3)',
            }}
          >
            Next
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Sessions Overview ─────────────────────────────────────────

function SessionsOverview({
  sessions, loading, onSelect, onCreateSession,
}: {
  sessions: SessionData[];
  loading: boolean;
  onSelect: (s: SessionData) => void;
  onCreateSession: (name: string) => Promise<void>;
}) {
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await onCreateSession(newName.trim());
      setNewName('');
      setShowNew(false);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3].map(i => <LoadingSkeleton key={i} height={80} />)}
      </div>
    );
  }

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* New Session */}
      <button
        onClick={() => setShowNew(!showNew)}
        style={{
          padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 8,
          backgroundColor: T.accent, color: '#fff', border: 'none', borderRadius: 12,
          fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        <Plus size={16} /> New Delphi Session
      </button>

      {showNew && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          style={{
            display: 'flex', flexDirection: 'column', gap: 10,
            padding: 16, backgroundColor: T.bg1, borderRadius: 12,
            border: `1px solid ${T.border2}`,
          }}
        >
          <input
            type="text"
            placeholder="e.g., Q2 2026 Trend Calibration"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            style={{
              padding: '10px 12px', fontSize: 13, fontFamily: T.sans,
              border: `1px solid ${T.border2}`, borderRadius: 8,
              outline: 'none', color: T.text, backgroundColor: T.bg,
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              style={{
                flex: 1, padding: 10, backgroundColor: T.green, color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: !newName.trim() ? 'not-allowed' : 'pointer',
                opacity: !newName.trim() ? 0.5 : 1,
              }}
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => setShowNew(false)}
              style={{
                flex: 1, padding: 10, backgroundColor: T.bg3, color: T.text2,
                border: `1px solid ${T.border1}`, borderRadius: 8, fontSize: 12,
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* 3-Round Explanation */}
      <div style={{
        padding: 20, borderRadius: 14, backgroundColor: T.bg1,
        border: `1px solid ${T.border1}`,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>
          How Delphi Works — 3 Rounds
        </div>
        {[1, 2, 3].map(round => {
          const info = ROUND_INFO[round];
          return (
            <div key={round} style={{
              display: 'flex', gap: 12, marginBottom: round < 3 ? 12 : 0,
              paddingBottom: round < 3 ? 12 : 0,
              borderBottom: round < 3 ? `1px solid ${T.border}` : 'none',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                backgroundColor: T.accentDim, color: T.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700,
              }}>{round}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{info.title.split(' — ')[1]}</div>
                <div style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>{info.subtitle}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Session list */}
      {sessions.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: T.text3, fontSize: 13 }}>
          No sessions yet. Create one to begin the Delphi process.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sessions.map(session => {
            const roundLabel = session.status === 'Completed'
              ? 'Completed'
              : `Round ${session.current_round} of 3`;
            const statusColor = session.status === 'Completed' ? T.green : T.accent;
            return (
              <button
                key={session.id}
                onClick={() => onSelect(session)}
                style={{
                  padding: 16, backgroundColor: T.bg, textAlign: 'left',
                  border: `1px solid ${T.border1}`, borderRadius: 12,
                  cursor: 'pointer', transition: 'all 0.15s',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = T.accent;
                  e.currentTarget.style.backgroundColor = T.bg1;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = T.border1 as string;
                  e.currentTarget.style.backgroundColor = T.bg;
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>
                    {session.name}
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: T.text3 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Users size={12} /> {session.scorer_count} scorers
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Zap size={12} /> {session.trend_count} trends
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: statusColor,
                    backgroundColor: statusColor + '15',
                    padding: '3px 8px', borderRadius: 6,
                  }}>
                    {roundLabel}
                  </span>
                  <ChevronRight size={16} style={{ color: T.text3 }} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Round Summary ─────────────────────────────────────────────

function RoundSummaryView({
  session, scores, loading, onAdvanceRound,
}: {
  session: SessionData;
  scores: any[];
  loading: boolean;
  onAdvanceRound: () => Promise<void>;
}) {
  const [advancing, setAdvancing] = useState(false);

  if (loading) {
    return (
      <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3].map(i => <LoadingSkeleton key={i} height={100} />)}
      </div>
    );
  }

  // Group scores by trend
  const byTrend: Record<string, { impact: number[]; probability: number[]; name?: string }> = {};
  if (Array.isArray(scores)) {
    scores.forEach((s: any) => {
      if (!s?.trend_id) return;
      if (!byTrend[s.trend_id]) byTrend[s.trend_id] = { impact: [], probability: [], name: s.trend_name };
      if (s.impact != null) byTrend[s.trend_id].impact.push(s.impact);
      if (s.probability != null) byTrend[s.trend_id].probability.push(s.probability);
    });
  }

  const handleAdvance = async () => {
    setAdvancing(true);
    try { await onAdvanceRound(); } finally { setAdvancing(false); }
  };

  const canAdvance = session.current_round < 3 && session.status !== 'Completed';

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        fontSize: 14, fontWeight: 700, color: T.text,
        paddingBottom: 12, borderBottom: `1px solid ${T.border1}`,
      }}>
        Round {session.current_round} Summary — {Object.keys(byTrend).length} trends scored
      </div>

      {Object.entries(byTrend).map(([trendId, data]) => {
        const impactMedian = data.impact.length
          ? [...data.impact].sort((a, b) => a - b)[Math.floor(data.impact.length / 2)]
          : null;
        const probMedian = data.probability.length
          ? [...data.probability].sort((a, b) => a - b)[Math.floor(data.probability.length / 2)]
          : null;

        // Simplified α
        const calcAlpha = (vals: number[]): number | null => {
          if (vals.length < 2) return null;
          const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
          const variance = vals.reduce((a, x) => a + (x - mean) ** 2, 0) / vals.length;
          const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
          return Math.max(0, 1 - cv);
        };

        return (
          <div key={trendId} style={{
            padding: 16, backgroundColor: T.bg1, borderRadius: 12,
            border: `1px solid ${T.border1}`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 12 }}>
              {data.name || trendId}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <DelphiDistribution scores={data.impact} median={impactMedian} alpha={calcAlpha(data.impact)} label="Impact" />
              <DelphiDistribution scores={data.probability} median={probMedian} alpha={calcAlpha(data.probability)} label="Probability" />
            </div>
          </div>
        );
      })}

      {canAdvance && (
        <button
          onClick={handleAdvance}
          disabled={advancing}
          style={{
            padding: '12px 20px', borderRadius: 12, border: 'none',
            backgroundColor: T.accent, color: '#fff',
            fontSize: 13, fontWeight: 700, cursor: advancing ? 'not-allowed' : 'pointer',
            opacity: advancing ? 0.5 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Play size={16} />
          {advancing ? 'Advancing...' : `Advance to Round ${session.current_round + 1}`}
        </button>
      )}
    </div>
  );
}

// ── Consensus Results ─────────────────────────────────────────

function ConsensusView({
  session, consensus, loading, onComplete,
}: {
  session: SessionData;
  consensus: any;
  loading: boolean;
  onComplete: () => Promise<void>;
}) {
  const [completing, setCompleting] = useState(false);

  if (loading || !consensus) {
    return (
      <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3].map(i => <LoadingSkeleton key={i} height={80} />)}
      </div>
    );
  }

  const handleComplete = async () => {
    setCompleting(true);
    try { await onComplete(); } finally { setCompleting(false); }
  };

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        fontSize: 14, fontWeight: 700, color: T.text,
        paddingBottom: 12, borderBottom: `1px solid ${T.border1}`,
      }}>
        Consensus Results
      </div>

      {consensus?.consensus_scores && Object.entries(consensus.consensus_scores).map(([trendId, data]: [string, any]) => {
        const confidence = data?.confidence || 'Medium';
        return (
          <div key={trendId} style={{
            padding: 16, backgroundColor: T.bg1, borderRadius: 12,
            border: `1px solid ${T.border1}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                {trendId}
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: T.text3 }}>Impact</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: T.accent, fontFamily: T.mono }}>
                    {data?.impact || 3}/5
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: T.text3 }}>Probability</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: T.accent, fontFamily: T.mono }}>
                    {data?.probability || 3}/5
                  </div>
                </div>
              </div>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 600,
              padding: '4px 10px', borderRadius: 6,
              backgroundColor: confidence === 'High' ? T.greenDim : confidence === 'Medium' ? T.amberDim : T.redDim,
              color: confidence === 'High' ? T.green : confidence === 'Medium' ? T.amber : T.red,
            }}>
              {confidence}
            </span>
          </div>
        );
      })}

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button
          onClick={handleComplete}
          disabled={completing}
          style={{
            flex: 1, padding: '12px 20px', borderRadius: 12, border: 'none',
            backgroundColor: T.green, color: '#fff',
            fontSize: 13, fontWeight: 700,
            cursor: completing ? 'not-allowed' : 'pointer',
            opacity: completing ? 0.5 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <CheckCircle2 size={16} />
          Apply Consensus to PULSE
        </button>
        <button
          style={{
            flex: 1, padding: '12px 20px', borderRadius: 12,
            border: `1px solid ${T.border2}`, backgroundColor: T.bg,
            color: T.text2, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Download size={16} />
          Export
        </button>
      </div>
    </div>
  );
}

// ── Mock Trends ───────────────────────────────────────────────

const MOCK_TRENDS: TrendData[] = [
  { id: 'con_01', name: 'Natural / Clean Beauty Movement', description: 'Global clean beauty market projected to reach $22B by 2030 at 12% CAGR. Consumers increasingly demanding transparent, "free-from" formulations across hair care, skin care and laundry products.', force: 'Consumer', direction: 'Expansion', impact: 5, probability: 4, strategic_implication: 'Reformulate core SKUs to clean standards. Invest in DBA communication for "pure" positioning.' },
  { id: 'con_02', name: 'Premiumization in Hair Care', description: 'Premium hair care segment growing at 2x mass market rate. Salon-quality at-home products driving trade-up behavior, particularly in damage repair and color protection.', force: 'Consumer', direction: 'Expansion', impact: 4, probability: 4, strategic_implication: 'Expand Schwarzkopf Professional retail range. Launch premium tier within Gliss.' },
  { id: 'con_03', name: 'Private Label Acceptance in Laundry', description: 'Private label share in EU laundry detergent reached 42.1% in 2024, accelerating in discount channel. Quality perception gap narrowing across mainstream segments.', force: 'Consumer', direction: 'Contraction', impact: 4, probability: 4, strategic_implication: 'Defend Persil with innovation that PL cannot replicate. Protect distribution in NKA.' },
  { id: 'cus_01', name: 'Discount Channel Expansion (Aldi/Lidl)', description: 'Discounters now control 35%+ of FMCG volume in key EU markets. Expanding into premium tiers with curated brand partnerships.', force: 'Customer', direction: 'Contraction', impact: 4, probability: 5, strategic_implication: 'Develop dedicated discounter strategy. Create exclusive formats that protect margin.' },
  { id: 'cus_02', name: 'D2C & Social Commerce Growth', description: 'Direct-to-consumer beauty sales growing at 25% CAGR. TikTok Shop and Instagram Checkout bypassing traditional retail channels.', force: 'Customer', direction: 'Expansion', impact: 3, probability: 4, strategic_implication: 'Launch DTC pilot for Schwarzkopf. Build creator partnerships for social commerce.' },
  { id: 'tec_01', name: 'AI-Powered Personalization', description: 'AI beauty diagnostics market growing at 29% CAGR. Hair/skin analysis tools driving personalized product recommendations and increased basket size.', force: 'Technology', direction: 'Expansion', impact: 4, probability: 3, strategic_implication: 'Deploy AI shade-matching for Schwarzkopf Color. Launch personalization engine for DTC.' },
  { id: 'tec_02', name: 'Green Chemistry / Bio-based Ingredients', description: 'Enzymatic cleaning and bio-surfactant technologies reaching price parity with petrochemical alternatives. Regulatory tailwind accelerating adoption.', force: 'Technology', direction: 'Expansion', impact: 4, probability: 4, strategic_implication: 'Invest in bio-surfactant sourcing. Patent key green formulation innovations.' },
  { id: 'gov_01', name: 'EU Green Deal Chemical Regulation (CSS)', description: 'EU Chemicals Strategy for Sustainability will restrict 5,000+ substances by 2030. Affects formulations across beauty, laundry, and home care categories.', force: 'Government', direction: 'Contraction', impact: 5, probability: 5, strategic_implication: 'Establish cross-BU regulatory task force. Begin reformulation pipeline for at-risk SKUs.' },
  { id: 'gov_02', name: 'Packaging Extended Producer Responsibility', description: 'EPR fees increasing 30-50% across EU markets. Single-use packaging taxes expanding from plastic to multi-material formats.', force: 'Government', direction: 'Contraction', impact: 3, probability: 5, strategic_implication: 'Accelerate refill/concentrate formats. Invest in mono-material packaging redesign.' },
  { id: 'env_01', name: 'Water Scarcity & Concentrated Formats', description: 'Water stress affecting 40% of global population by 2030. Driving demand for waterless, concentrated, and solid format products.', force: 'Environmental', direction: 'Expansion', impact: 3, probability: 4, strategic_implication: 'Fast-track concentrated detergent and solid shampoo formats. Communicate water-saving benefits.' },
  { id: 'env_02', name: 'Microplastics Ban', description: 'EU microplastics restriction (Oct 2023) phasing out synthetic polymers in cosmetics and detergents. Full compliance required by 2029-2035 depending on category.', force: 'Environmental', direction: 'Contraction', impact: 4, probability: 5, strategic_implication: 'Complete microplastic-free reformulation across all SKUs. Communicate proactive compliance.' },
  { id: 'com_01', name: 'P&G Innovation Acceleration', description: 'P&G increased R&D spend to 3.1% of sales ($2.4B). Launching AI-driven formulation platforms and 50+ new patents/year in beauty/HPC.', force: 'Competitive', direction: 'Contraction', impact: 5, probability: 4, strategic_implication: 'Match innovation velocity. Strengthen patent portfolio in key technology domains.' },
  { id: 'com_02', name: 'Unilever Portfolio Rationalization', description: 'Unilever divesting underperforming brands, focusing resources on "power brands." Creating white space opportunities in divested categories.', force: 'Competitive', direction: 'Expansion', impact: 3, probability: 3, strategic_implication: 'Monitor Unilever divestiture pipeline. Evaluate acquisition or market-share capture opportunities.' },
];

// ── Main DelphiPanel Component ────────────────────────────────

export default function DelphiPanel({ onClose }: DelphiPanelProps) {
  const [view, setView] = useState<'sessions' | 'scoring' | 'summary' | 'consensus'>('sessions');
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [consensus, setConsensus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scorerName, setScorerName] = useState(() => {
    try { return localStorage.getItem('pulse_scorer_name') || ''; } catch { return ''; }
  });
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Persist scorer name
  useEffect(() => {
    if (scorerName) {
      try { localStorage.setItem('pulse_scorer_name', scorerName); } catch { /* noop */ }
    }
  }, [scorerName]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Load sessions
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.getDelphiSessions() as any;
        const list = Array.isArray(data) ? data : (data?.sessions || []);
        setSessions(list.map((s: any) => ({
          id: s.session_id || s.id || '',
          name: s.name || '',
          status: s.status || 'Round 1',
          current_round: s.current_round || 1,
          scorer_count: s.scorer_count || 0,
          trend_count: s.trend_count || 0,
        })));
      } catch {
        setSessions([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Load session details
  const loadSessionDetails = useCallback(async (session: SessionData, targetView: string) => {
    setLoading(true);
    try {
      const sessionData = await api.getDelphiSession(session.id);
      const trendIds = (sessionData as any)?.trend_ids || [];

      let trendsToSet: TrendData[] = [];
      if (trendIds.length > 0 && typeof trendIds[0] === 'string') {
        try {
          const allTrends = await api.getTrends();
          const trendList = Array.isArray(allTrends) ? allTrends : (allTrends as any)?.trends || [];
          const trendMap: Record<string, any> = {};
          trendList.forEach((t: any) => { trendMap[t.id] = t; });
          trendsToSet = trendIds.map((id: string) => trendMap[id] || MOCK_TRENDS.find(m => m.id === id)).filter(Boolean);
        } catch {
          trendsToSet = MOCK_TRENDS;
        }
      } else if (trendIds.length > 0) {
        trendsToSet = trendIds;
      } else {
        trendsToSet = MOCK_TRENDS;
      }

      // For Round 2+, load previous round scores as distributions
      if (session.current_round >= 2) {
        try {
          const prevScores = await api.getDelphiScores(session.id, { round: String(session.current_round - 1) });
          const scoreList = Array.isArray(prevScores) ? prevScores : (prevScores as any)?.scores || [];
          const byTrend: Record<string, { impact: number[]; probability: number[] }> = {};
          scoreList.forEach((s: any) => {
            if (!byTrend[s.trend_id]) byTrend[s.trend_id] = { impact: [], probability: [] };
            if (s.impact != null) byTrend[s.trend_id].impact.push(s.impact);
            if (s.probability != null) byTrend[s.trend_id].probability.push(s.probability);
          });
          trendsToSet = trendsToSet.map(t => ({
            ...t,
            previous_round_scores: byTrend[t.id] ? {
              impact: byTrend[t.id].impact,
              probability: byTrend[t.id].probability,
              impact_alpha: byTrend[t.id].impact.length > 1 ? 0.75 : null,
              probability_alpha: byTrend[t.id].probability.length > 1 ? 0.75 : null,
            } : undefined,
          }));
        } catch { /* no previous scores available */ }
      }

      setTrends(trendsToSet);

      if (targetView === 'summary') {
        try {
          const scoresData = await api.getDelphiScores(session.id);
          setScores(Array.isArray(scoresData) ? scoresData : (scoresData as any)?.scores || []);
        } catch { setScores([]); }
      }

      if (targetView === 'consensus') {
        try {
          const c = await api.getDelphiConsensus(session.id);
          setConsensus(c);
        } catch { setConsensus(null); }
      }
    } catch {
      setTrends(MOCK_TRENDS);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectSession = (session: SessionData) => {
    setSelectedSession(session);
    setView('scoring');
    loadSessionDetails(session, 'scoring');
  };

  const handleCreateSession = async (name: string) => {
    try {
      const result = await api.createDelphiSession({ name, trend_ids: [], scorer_ids: [] });
      const newSession: SessionData = {
        id: (result as any).session_id || (result as any).id || `session_${Date.now()}`,
        name,
        status: 'Round 1',
        current_round: 1,
        scorer_count: 0,
        trend_count: MOCK_TRENDS.length,
      };
      setSessions(prev => [newSession, ...prev]);
      handleSelectSession(newSession);
      setToast({ msg: 'Session created successfully', type: 'success' });
    } catch {
      // Fallback mock session
      const mockSession: SessionData = {
        id: `mock_${Date.now()}`,
        name,
        status: 'Round 1',
        current_round: 1,
        scorer_count: 0,
        trend_count: MOCK_TRENDS.length,
      };
      setSessions(prev => [mockSession, ...prev]);
      handleSelectSession(mockSession);
      setToast({ msg: 'Session created (offline mode)', type: 'success' });
    }
  };

  const handleSubmitAllScores = async (allScores: TrendScore[]) => {
    if (!selectedSession || !scorerName) return;
    setSubmitting(true);

    const submitToSession = async (sessionId: string) => {
      for (const score of allScores) {
        await api.submitDelphiScore(sessionId, {
          scorer_id: scorerName,
          trend_id: score.trend_id,
          impact_score: score.impact,
          probability_score: score.probability,
          rationale: score.rationale,
        });
      }
    };

    try {
      await submitToSession(selectedSession.id);
      setToast({ msg: `${allScores.length} scores submitted successfully!`, type: 'success' });
      setView('summary');
      loadSessionDetails(selectedSession, 'summary');
    } catch (err: any) {
      // If session not found (Vercel cold start), create a new one and retry
      const isNotFound = err?.message?.includes('not found') || err?.status === 404;
      if (isNotFound) {
        console.warn('Session lost (cold start), creating new session and retrying...');
        try {
          const result = await api.createDelphiSession({
            name: selectedSession.name || 'Recovered Session',
            trend_ids: [],
            scorer_ids: [],
          });
          const newId = (result as any).session_id || (result as any).id;
          if (newId) {
            const updated = { ...selectedSession, id: newId };
            setSelectedSession(updated);
            await submitToSession(newId);
            setToast({ msg: `${allScores.length} scores submitted successfully!`, type: 'success' });
            setView('summary');
            loadSessionDetails(updated, 'summary');
            return;
          }
        } catch (retryErr) {
          console.error('Retry also failed:', retryErr);
        }
      }
      console.error('Failed to submit scores:', err);
      setToast({ msg: 'Failed to submit scores. Please try again.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdvanceRound = async () => {
    if (!selectedSession) return;
    try {
      await api.advanceDelphiRound(selectedSession.id);
      const updated = { ...selectedSession, current_round: selectedSession.current_round + 1 };
      setSelectedSession(updated);
      setToast({ msg: `Advanced to Round ${updated.current_round}`, type: 'success' });
      setView('scoring');
      loadSessionDetails(updated, 'scoring');
    } catch (err) {
      setToast({ msg: 'Failed to advance round', type: 'error' });
    }
  };

  const handleComplete = async () => {
    if (!selectedSession) return;
    try {
      await api.completeDelphiSession(selectedSession.id);
      setToast({ msg: 'Consensus applied to PULSE!', type: 'success' });
    } catch {
      setToast({ msg: 'Failed to complete session', type: 'error' });
    }
  };

  const tabs = [
    { id: 'sessions' as const, label: 'Sessions', icon: Users },
    { id: 'scoring' as const, label: 'Scoring', icon: Zap },
    { id: 'summary' as const, label: 'Summary', icon: BarChart3 },
    { id: 'consensus' as const, label: 'Consensus', icon: CheckCircle2 },
  ];

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(6px)',
          zIndex: 999,
        }}
      />

      {/* Main panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        style={{
          position: 'fixed',
          top: 20, left: 20, right: 20, bottom: 20,
          backgroundColor: T.bg,
          borderRadius: 18,
          border: `1px solid ${T.border1}`,
          display: 'flex', flexDirection: 'column',
          zIndex: 1000,
          boxShadow: '0 25px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 28px',
          borderBottom: `1px solid ${T.border1}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: T.bg1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${T.accent}, ${T.purple})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Users size={18} style={{ color: '#fff' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: T.text }}>
                Delphi Expert Elicitation
              </h2>
              <div style={{ fontSize: 11, color: T.text3, marginTop: 1 }}>
                {selectedSession ? `${selectedSession.name} — Round ${selectedSession.current_round} of 3` : 'Structured scoring with calibration'}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: 8, backgroundColor: T.bg3, border: `1px solid ${T.border1}`,
              borderRadius: 8, cursor: 'pointer', color: T.text2,
              display: 'flex', alignItems: 'center', transition: 'all 120ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = T.bg4 || T.bg3; e.currentTarget.style.color = T.text; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = T.bg3; e.currentTarget.style.color = T.text2; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', borderBottom: `1px solid ${T.border1}`,
          backgroundColor: T.bg1, padding: '0 28px',
        }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = view === tab.id;
            const disabled = (tab.id !== 'sessions' && !selectedSession);
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (disabled) return;
                  setView(tab.id);
                  if (selectedSession && (tab.id === 'summary' || tab.id === 'consensus')) {
                    loadSessionDetails(selectedSession, tab.id);
                  }
                }}
                style={{
                  padding: '14px 20px', backgroundColor: 'transparent', border: 'none',
                  borderBottom: isActive ? `2px solid ${T.accent}` : '2px solid transparent',
                  fontSize: 12, fontWeight: 600,
                  color: disabled ? T.text4 : isActive ? T.accent : T.text3,
                  cursor: disabled ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'all 0.2s',
                  opacity: disabled ? 0.4 : 1,
                }}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <AnimatePresence mode="wait">
            {view === 'sessions' && (
              <motion.div key="sessions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ flex: 1, overflow: 'auto' }}>
                <SessionsOverview
                  sessions={sessions}
                  loading={loading}
                  onSelect={handleSelectSession}
                  onCreateSession={handleCreateSession}
                />
              </motion.div>
            )}
            {view === 'scoring' && selectedSession && (
              <motion.div key="scoring" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {loading ? (
                  <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[1, 2, 3].map(i => <LoadingSkeleton key={i} height={100} />)}
                  </div>
                ) : (
                  <ScoringWizard
                    session={selectedSession}
                    trends={trends}
                    scorerName={scorerName}
                    onScorerNameChange={setScorerName}
                    onSubmitAll={handleSubmitAllScores}
                    submitting={submitting}
                  />
                )}
              </motion.div>
            )}
            {view === 'summary' && selectedSession && (
              <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ flex: 1, overflow: 'auto' }}>
                <RoundSummaryView
                  session={selectedSession}
                  scores={scores}
                  loading={loading}
                  onAdvanceRound={handleAdvanceRound}
                />
              </motion.div>
            )}
            {view === 'consensus' && selectedSession && (
              <motion.div key="consensus" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ flex: 1, overflow: 'auto' }}>
                <ConsensusView
                  session={selectedSession}
                  consensus={consensus}
                  loading={loading}
                  onComplete={handleComplete}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
              zIndex: 1100,
              padding: '12px 24px', borderRadius: 12,
              backgroundColor: toast.type === 'success' ? T.green : T.red,
              color: '#fff', fontSize: 13, fontWeight: 600,
              boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
