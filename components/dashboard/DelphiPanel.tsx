/**
 * DelphiPanel — Expert Elicitation UI
 * 5 tabs: Sessions Overview | Scoring Interface | Round Summary | Consensus & Results | Calibration
 * Slides in from the right as a contextual panel in the Profit Pool Shift Model
 * Includes:
 * - Multi-round scoring interface with anonymized previous round distributions
 * - Calibration exercise section with accuracy feedback
 * - Inter-rater reliability display (Krippendorff's alpha gauge)
 * - Consensus view with final weighted median scores
 * - Animated round transitions via Framer Motion
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Plus, ChevronRight, AlertCircle, CheckCircle2, Clock,
  Download, Play, Zap, Users, BarChart3, Award, Target,
} from 'lucide-react';
import { T, FORCES, FORCE_COLORS } from '@/lib/format';
import * as api from '@/api/client';
import DelphiScoreCard from './DelphiScoreCard';
import DelphiDistribution from './DelphiDistribution';
import LoadingSkeleton from './LoadingSkeleton';

// Type definitions for internal component props
interface DelphiSessionSummaryData {
  id: string;
  name: string;
  status: 'Round 1' | 'Round 2' | 'Round 3' | 'Completed';
  current_round?: number;
  scorer_count?: number;
  trend_count?: number;
  reliability_alpha?: number;
}

interface TrendData {
  id: string;
  name: string;
  description: string;
  force: string;
  direction: 'Expansion' | 'Contraction';
  impact?: number;
  probability?: number;
  strategic_implication?: string;
  user_score?: boolean;
  previous_round_scores?: {
    impact?: number[];
    probability?: number[];
    impact_alpha?: number;
    probability_alpha?: number;
  };
}

interface SessionOverviewTabProps {
  sessions?: DelphiSessionSummaryData[];
  onSelectSession: (session: DelphiSessionSummaryData) => void;
  loading?: boolean;
}

interface ScoringInterfaceTabProps {
  session?: DelphiSessionSummaryData | null;
  trends?: TrendData[];
  scorerName?: string;
  onScorerNameChange: (name: string) => void;
  onSubmitScore: (data: any) => Promise<void>;
  loading?: boolean;
  submitting?: boolean;
}

interface RoundSummaryTabProps {
  session?: DelphiSessionSummaryData | null;
  scores?: any[];
  loading?: boolean;
}

interface ConsensusResultsTabProps {
  session?: DelphiSessionSummaryData | null;
  consensus?: any | null;
  loading?: boolean;
}

interface CalibrationExerciseTabProps {
  session?: DelphiSessionSummaryData | null;
  scorerName?: string;
  loading?: boolean;
}

interface DelphiPanelProps {
  onClose: () => void;
}

// ─── Helper: Krippendorff's Alpha Gauge ─────────────────────────
interface ReliabilityGaugeProps {
  alpha: number | null;
}

function ReliabilityGauge({ alpha }: ReliabilityGaugeProps) {
  if (alpha === null || alpha === undefined) return null;

  let color = T.red;
  let status = 'Poor Agreement';
  if (alpha >= 0.8) {
    color = T.green;
    status = 'Excellent Agreement';
  } else if (alpha >= 0.67) {
    color = T.amber;
    status = 'Acceptable Agreement';
  }

  const percentage = Math.max(0, Math.min(100, alpha * 100));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: T.text2 }}>
          Krippendorff's Alpha
        </span>
        <span style={{ fontSize: '13px', fontWeight: 700, color }}>{alpha.toFixed(2)}</span>
      </div>
      <div
        style={{
          width: '100%',
          height: '8px',
          backgroundColor: T.bg3,
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{
            height: '100%',
            backgroundColor: color,
            borderRadius: '4px',
          }}
        />
      </div>
      <span style={{ fontSize: '9px', color: T.text3 }}>{status}</span>
    </div>
  );
}

// ─── Tab 1: Sessions Overview ─────────────────────────────
function SessionsOverviewTab({ sessions = [], onSelectSession, loading = false }: SessionOverviewTabProps) {
  const [showNewSession, setShowNewSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');

  const handleCreateSession = async () => {
    if (!newSessionName.trim()) return;
    try {
      const session = await api.createDelphiSession({
        name: newSessionName.trim(),
        trend_ids: [],
        scorer_ids: [],
      });
      const sessionData = session as any;
      onSelectSession({
        id: sessionData.session_id || sessionData.id || '',
        name: sessionData.name || newSessionName.trim(),
        status: 'Round 1',
        current_round: 1,
        scorer_count: 0,
        trend_count: 0,
      });
      setNewSessionName('');
      setShowNewSession(false);
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2, 3].map((i) => (
          <LoadingSkeleton key={i} height={100} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* New Session Button */}
      <button
        onClick={() => setShowNewSession(!showNewSession)}
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: T.accent,
          color: T.bg,
          border: 'none',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
      >
        <Plus size={16} />
        New Session
      </button>

      {/* New Session Form */}
      {showNewSession && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '12px',
            backgroundColor: T.bg3,
            borderRadius: '8px',
            border: `1px solid ${T.border1}`,
          }}
        >
          <input
            type="text"
            placeholder="e.g., Q2 2026 Trend Calibration"
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
            style={{
              padding: '8px',
              fontSize: '12px',
              border: `1px solid ${T.border1}`,
              borderRadius: '6px',
              outline: 'none',
              color: T.text,
              backgroundColor: T.bg,
            }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleCreateSession}
              disabled={!newSessionName.trim()}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: T.green,
                color: T.bg,
                border: 'none',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: !newSessionName.trim() ? 'not-allowed' : 'pointer',
                opacity: !newSessionName.trim() ? 0.5 : 1,
              }}
            >
              Create
            </button>
            <button
              onClick={() => setShowNewSession(false)}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: T.border1,
                color: T.text,
                border: 'none',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* Session Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sessions.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: T.text3,
              fontSize: '12px',
            }}
          >
            No sessions yet. Create one to begin.
          </div>
        ) : (
          sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session)}
              style={{
                padding: '12px',
                backgroundColor: T.bg2,
                border: `1px solid ${T.border1}`,
                borderRadius: '8px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = T.bg1)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = T.bg2)}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px',
                }}
              >
                <h4 style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: T.text }}>
                  {session.name}
                </h4>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: T.text3,
                    backgroundColor: T.bg4,
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  {session.status === 'Round 1'
                    ? 'Round 1 of 3'
                    : session.status === 'Round 2'
                      ? 'Round 2 of 3'
                      : session.status === 'Round 3'
                        ? 'Round 3 of 3'
                        : 'Completed'}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  fontSize: '11px',
                  color: T.text3,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Users size={14} />
                  {session.scorer_count || 0} scorers
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Zap size={14} />
                  {session.trend_count || 0} trends
                </div>
                {session.reliability_alpha != null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor:
                          session.reliability_alpha >= 0.8
                            ? T.green
                            : session.reliability_alpha >= 0.67
                              ? T.amber
                              : T.red,
                      }}
                    />
                    α {session.reliability_alpha.toFixed(2)}
                  </div>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Tab 2: Scoring Interface ─────────────────────────────
function ScoringInterfaceTab({
  session = null,
  trends = [],
  scorerName = '',
  onScorerNameChange = () => {},
  onSubmitScore = async () => {},
  loading = false,
  submitting = false,
}: ScoringInterfaceTabProps) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const elem = e.currentTarget;
    const progress = (elem.scrollLeft / (elem.scrollWidth - elem.clientWidth)) * 100 || 0;
    setScrollProgress(progress);
  };

  if (!session) {
    return (
      <div
        style={{
          padding: '24px 16px',
          textAlign: 'center',
          color: T.text3,
          fontSize: '12px',
        }}
      >
        Select a session from the Sessions tab to begin scoring.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2, 3].map((i) => (
          <LoadingSkeleton key={i} height={80} />
        ))}
      </div>
    );
  }

  const scoredCount = trends.filter((t) => t.user_score).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${T.border}`,
          backgroundColor: T.bg1,
        }}
      >
        <div style={{ marginBottom: '8px' }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 600, color: T.text }}>
            {session.name}
          </h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '10px',
                backgroundColor: T.bg,
                color: T.text2,
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 500,
              }}
            >
              Round {session.current_round || 1} of 3
            </span>
            <span
              style={{
                fontSize: '10px',
                color: T.text3,
              }}
            >
              {scoredCount} of {trends.length} trends scored
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: '100%',
            height: '2px',
            backgroundColor: T.bg3,
            borderRadius: '1px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              backgroundColor: T.accent,
              width: `${(scoredCount / Math.max(trends.length, 1)) * 100}%`,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Scorer name input */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
        <label style={{ fontSize: '11px', fontWeight: 600, color: T.text2 }}>Your Name</label>
        <input
          type="text"
          placeholder="e.g., Sarah Chen"
          value={scorerName}
          onChange={(e) => onScorerNameChange(e.target.value)}
          style={{
            width: '100%',
            marginTop: '4px',
            padding: '6px 8px',
            fontSize: '12px',
            border: `1px solid ${T.border1}`,
            borderRadius: '6px',
            outline: 'none',
            color: T.text,
            backgroundColor: T.bg,
          }}
        />
      </div>

      {/* Score cards */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <AnimatePresence>
          {trends.map((trend) => (
            <DelphiScoreCard
              key={trend.id}
              trend={trend}
              currentRound={session.current_round || 1}
              previousScores={trend.previous_round_scores}
              onSubmit={(data) => onSubmitScore(data)}
              isSubmitting={submitting}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Tab 3: Round Summary ─────────────────────────────────
function RoundSummaryTab({ session = null, scores = [], loading = false }: RoundSummaryTabProps) {
  if (!session) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center', color: T.text3, fontSize: '12px' }}>
        Select a session to view round summary.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2, 3].map((i) => (
          <LoadingSkeleton key={i} height={100} />
        ))}
      </div>
    );
  }

  // Group scores by trend
  const scoresByTrend: Record<string, { impact: number[]; probability: number[] }> = {};
  if (scores && Array.isArray(scores)) {
    scores.forEach((score) => {
      if (score && score.trend_id) {
        if (!scoresByTrend[score.trend_id]) {
          scoresByTrend[score.trend_id] = { impact: [], probability: [] };
        }
        const entry = scoresByTrend[score.trend_id];
        if (entry && score.impact != null) entry.impact?.push(score.impact);
        if (entry && score.probability != null) entry.probability?.push(score.probability);
      }
    });
  }

  // Calculate overall inter-rater reliability (Krippendorff's alpha mockup)
  const allImpactScores = Object.values(scoresByTrend)
    .flatMap(t => t.impact)
    .sort((a, b) => a - b);
  const allProbabilityScores = Object.values(scoresByTrend)
    .flatMap(t => t.probability)
    .sort((a, b) => a - b);

  const calculateAlpha = (values: number[]): number | null => {
    if (values.length < 2) return null;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, x) => a + (x - mean) ** 2, 0) / values.length;
    const pairedVariance = values.reduce((sum, _, i) => {
      if (i === 0) return sum;
      return sum + Math.abs(values[i] - values[i - 1]) ** 2;
    }, 0);
    return 1 - (pairedVariance / (2 * values.length * variance) || 0);
  };

  const overallAlpha = calculateAlpha([...allImpactScores, ...allProbabilityScores]);

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: T.text2,
          textTransform: 'uppercase',
          paddingBottom: '8px',
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <BarChart3 size={12} />
        Round {session.current_round || 1} Results
      </div>

      {/* Inter-rater Reliability Gauge */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          padding: '12px',
          backgroundColor: T.bg2,
          borderRadius: '8px',
          border: `1px solid ${T.border1}`,
        }}
      >
        <ReliabilityGauge alpha={overallAlpha} />
        {overallAlpha && overallAlpha < 0.67 && (
          <div
            style={{
              marginTop: '8px',
              padding: '6px 8px',
              backgroundColor: T.amber + '15',
              borderRadius: '4px',
              border: `1px solid ${T.amber}30`,
              fontSize: '9px',
              color: T.amber,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AlertCircle size={12} />
            <span>Low agreement detected. Consider another round or discussion.</span>
          </div>
        )}
      </motion.div>

      {Object.entries(scoresByTrend).map(([trendId, trendScores]) => {
        const impactArray = trendScores?.impact || [];
        const probArray = trendScores?.probability || [];
        const impactMedian = impactArray.length
          ? impactArray.sort((a, b) => a - b)[Math.floor(impactArray.length / 2)]
          : null;
        const probMedian = probArray.length
          ? probArray.sort((a, b) => a - b)[
              Math.floor(probArray.length / 2)
            ]
          : null;

        // Simple α calculation (placeholder)
        const calcAlpha = (values: number[]): number | null => {
          if (values.length < 2) return null;
          const mean = values.reduce((a, b) => a + b, 0) / values.length;
          const variance = values.reduce((a, x) => a + (x - mean) ** 2, 0) / values.length;
          return variance > 0 ? 0.8 : 0.5; // Simplified
        };

        const impactAlpha = calcAlpha(impactArray);
        const probAlpha = calcAlpha(probArray);

        return (
          <div
            key={trendId}
            style={{
              padding: '12px',
              backgroundColor: T.bg2,
              borderRadius: '8px',
              border: `1px solid ${T.border1}`,
            }}
          >
            <div style={{ marginBottom: '12px' }}>
              <h5
                style={{
                  margin: '0 0 4px 0',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: T.text,
                }}
              >
                {trendId}
              </h5>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <DelphiDistribution
                scores={impactArray}
                median={impactMedian}
                alpha={impactAlpha}
                label="Impact Scores"
              />
              <DelphiDistribution
                scores={probArray}
                median={probMedian}
                alpha={probAlpha}
                label="Probability Scores"
              />
            </div>

            {impactAlpha && impactAlpha < 0.67 && (
              <div
                style={{
                  marginTop: '8px',
                  padding: '8px',
                  backgroundColor: T.amber + '20',
                  color: T.amber,
                  fontSize: '10px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <AlertCircle size={12} />
                Needs Discussion — Low agreement
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab 4: Calibration Exercise ──────────────────────────────
function CalibrationExerciseTab({
  session = null,
  scorerName = '',
  loading = false,
}: CalibrationExerciseTabProps) {
  const [calibrationScore, setCalibrationScore] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<{
    accuracy: number;
    bias: string;
    message: string;
  } | null>(null);

  // Mock calibration trend: "Clean Beauty Movement" from 2020
  // Actual outcome: became mainstream, impact score should have been 4-5
  const calibrationTrend = {
    id: 'calibration_001',
    name: 'Clean Beauty Movement (Historical 2020)',
    description:
      'In 2020, the clean beauty movement was emerging. How would you have scored this trend\'s IMPACT back then? (Knowing now it became a major market force.)',
    direction: 'Expansion' as const,
    impact: 4, // Actual outcome
    probability: 4,
  };

  const handleSubmitCalibration = () => {
    if (calibrationScore === null) return;

    const error = Math.abs(calibrationScore - calibrationTrend.impact);
    const accuracy = Math.max(0, 100 - error * 20); // 20% accuracy loss per point error

    let bias = 'Accurate';
    if (calibrationScore < calibrationTrend.impact - 1) {
      bias = 'Conservative (underestimating)';
    } else if (calibrationScore > calibrationTrend.impact + 1) {
      bias = 'Optimistic (overestimating)';
    }

    setFeedback({
      accuracy,
      bias,
      message:
        accuracy > 80
          ? 'Excellent calibration! Your scores are reliable.'
          : accuracy > 60
            ? 'Good calibration with slight bias. Consider this in your scoring.'
            : 'Notable bias detected. Review your assumptions.',
    });
    setSubmitted(true);
  };

  if (!session) {
    return (
      <div
        style={{
          padding: '24px 16px',
          textAlign: 'center',
          color: T.text3,
          fontSize: '12px',
        }}
      >
        Select a session to begin calibration exercise.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2].map((i) => (
          <LoadingSkeleton key={i} height={100} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header */}
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: T.text2,
          textTransform: 'uppercase',
          paddingBottom: '8px',
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <Target size={12} />
        Calibration Exercise
      </div>

      {/* Calibration Trend Card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          padding: '12px',
          backgroundColor: T.bg2,
          borderRadius: '8px',
          border: `1px solid ${T.border1}`,
        }}
      >
        <div style={{ marginBottom: '12px' }}>
          <h5
            style={{
              margin: '0 0 4px 0',
              fontSize: '12px',
              fontWeight: 600,
              color: T.text,
            }}
          >
            {calibrationTrend.name}
          </h5>
          <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: T.text2, lineHeight: 1.5 }}>
            {calibrationTrend.description}
          </p>
          <div
            style={{
              fontSize: '10px',
              color: T.text3,
              fontStyle: 'italic',
            }}
          >
            Actual outcome: Impact 4/5 (Mainstream market force)
          </div>
        </div>

        {!submitted ? (
          <>
            {/* Impact Slider */}
            <div style={{ marginBottom: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: '6px',
                }}
              >
                <label style={{ fontSize: '11px', fontWeight: 600, color: T.text2 }}>
                  Your Score
                </label>
                <span style={{ fontSize: '13px', fontWeight: 600, color: T.accent }}>
                  {calibrationScore}/5
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={calibrationScore || 3}
                onChange={(e) => setCalibrationScore(parseInt(e.target.value, 10))}
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  background: `linear-gradient(to right, ${T.amber}, ${T.amber} ${((calibrationScore || 3) - 1) / 4 * 100}%, ${T.bg4} ${((calibrationScore || 3) - 1) / 4 * 100}%, ${T.bg4})`,
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                } as React.CSSProperties}
              />
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmitCalibration}
              disabled={calibrationScore === null}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: T.accent,
                color: T.bg,
                border: 'none',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: calibrationScore === null ? 'not-allowed' : 'pointer',
                opacity: calibrationScore === null ? 0.5 : 1,
              }}
            >
              Check Accuracy
            </button>
          </>
        ) : (
          <>
            {/* Feedback */}
            {feedback && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    padding: '8px',
                    backgroundColor:
                      feedback.accuracy > 80 ? T.green + '15' : T.amber + '15',
                    borderRadius: '6px',
                    border: `1px solid ${feedback.accuracy > 80 ? T.green + '30' : T.amber + '30'}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: feedback.accuracy > 80 ? T.green : T.amber,
                      marginBottom: '4px',
                    }}
                  >
                    Calibration Accuracy: {feedback.accuracy.toFixed(0)}%
                  </div>
                  <div style={{ fontSize: '10px', color: T.text2, marginBottom: '4px' }}>
                    Bias: <strong>{feedback.bias}</strong>
                  </div>
                  <div style={{ fontSize: '10px', color: T.text2 }}>{feedback.message}</div>
                </div>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setCalibrationScore(null);
                    setFeedback(null);
                  }}
                  style={{
                    padding: '6px',
                    backgroundColor: T.bg3,
                    color: T.text,
                    border: `1px solid ${T.border1}`,
                    borderRadius: '6px',
                    fontSize: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Try Another
                </button>
              </motion.div>
            )}
          </>
        )}
      </motion.div>

      {/* Info */}
      <div
        style={{
          padding: '8px 12px',
          backgroundColor: T.bg3,
          borderRadius: '6px',
          fontSize: '9px',
          color: T.text3,
          lineHeight: 1.6,
        }}
      >
        <strong>Purpose:</strong> Calibration exercises detect systematic biases (anchoring, optimism, recency effect).
        Your calibration factor is applied to all scores in this round.
      </div>
    </div>
  );
}

// ─── Tab 5: Consensus & Results ───────────────────────────
function ConsensusResultsTab({
  session = null,
  consensus = null,
  loading = false,
}: ConsensusResultsTabProps) {
  const [applying, setApplying] = useState(false);

  const handleApplyConsensus = async () => {
    if (!session) return;
    setApplying(true);
    try {
      await api.completeDelphiSession(session.id);
      // Optionally refresh
    } catch (err) {
      console.error('Failed to apply consensus:', err);
    } finally {
      setApplying(false);
    }
  };

  if (!session) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center', color: T.text3, fontSize: '12px' }}>
        Select a session to view consensus results.
      </div>
    );
  }

  if (loading || !consensus) {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2, 3].map((i) => (
          <LoadingSkeleton key={i} height={100} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: T.text2,
          textTransform: 'uppercase',
          paddingBottom: '8px',
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        Consensus Results
      </div>

      {consensus?.consensus_scores && Object.entries(consensus.consensus_scores).map(([trendId, trendData]: [string, any]) => {
        const confidence = trendData?.confidence || 'Medium';
        return (
          <div
            key={trendId}
            style={{
              padding: '12px',
              backgroundColor: T.bg2,
              borderRadius: '8px',
              border: `1px solid ${T.border1}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '8px',
              }}
            >
              <h5 style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: T.text }}>
                {trendId}
              </h5>
              <CheckCircle2 size={16} style={{ color: T.green }} />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginBottom: '8px',
              }}
            >
              {/* Impact */}
              <div>
                <div style={{ fontSize: '10px', color: T.text3, marginBottom: '4px' }}>
                  Impact
                </div>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: 600,
                    color: T.accent,
                  }}
                >
                  {trendData?.impact || 3}/5
                </div>
                <div style={{ fontSize: '9px', color: T.text3 }}>
                  (α {(trendData?.confidence_score || 0.75).toFixed(2)})
                </div>
              </div>

              {/* Probability */}
              <div>
                <div style={{ fontSize: '10px', color: T.text3, marginBottom: '4px' }}>
                  Probability
                </div>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: 600,
                    color: T.accent,
                  }}
                >
                  {trendData?.probability || 3}/5
                </div>
                <div style={{ fontSize: '9px', color: T.text3 }}>
                  (α {(trendData?.confidence_score || 0.75).toFixed(2)})
                </div>
              </div>
            </div>

            {/* Confidence badge */}
            <div
              style={{
                display: 'inline-block',
                fontSize: '9px',
                fontWeight: 600,
                padding: '3px 6px',
                borderRadius: '4px',
                backgroundColor:
                  confidence === 'High'
                    ? T.green + '20'
                    : confidence === 'Medium'
                      ? T.amber + '20'
                      : T.red + '20',
                color:
                  confidence === 'High'
                    ? T.green
                    : confidence === 'Medium'
                      ? T.amber
                      : T.red,
              }}
            >
              {confidence} Confidence
            </div>
          </div>
        );
      })}

      {/* Action buttons */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: `1px solid ${T.border}`,
        }}
      >
        <button
          onClick={handleApplyConsensus}
          disabled={applying}
          style={{
            flex: 1,
            padding: '10px 16px',
            backgroundColor: T.green,
            color: T.bg,
            border: 'none',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: applying ? 'not-allowed' : 'pointer',
            opacity: applying ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <CheckCircle2 size={14} />
          Apply Consensus
        </button>
        <button
          style={{
            flex: 1,
            padding: '10px 16px',
            backgroundColor: T.bg3,
            color: T.text,
            border: `1px solid ${T.border1}`,
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <Download size={14} />
          Export
        </button>
      </div>
    </div>
  );
}

// ─── Main DelphiPanel Component ────────────────────────────
export default function DelphiPanel({ onClose }: DelphiPanelProps) {
  const [activeTab, setActiveTab] = useState<'sessions' | 'scoring' | 'summary' | 'calibration' | 'consensus'>('sessions');
  const [sessions, setSessions] = useState<DelphiSessionSummaryData[]>([]);
  const [selectedSession, setSelectedSession] = useState<DelphiSessionSummaryData | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [scorerName, setScorerName] = useState('');
  const [scores, setScores] = useState<any[]>([]);
  const [consensus, setConsensus] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load sessions on mount
  useEffect(() => {
    const loadSessions = async () => {
      setLoading(true);
      try {
        const data = await api.getDelphiSessions() as any;
        const sessionsList = Array.isArray(data) ? data : (data?.sessions || []);
        setSessions(sessionsList.map((s: any) => ({
          id: s.session_id || s.id || '',
          name: s.name || '',
          status: s.status || 'Round 1',
          current_round: s.current_round || 1,
          scorer_count: s.scorer_count || 0,
          trend_count: s.trend_count || 0,
        })));
      } catch (err) {
        console.error('Failed to load sessions:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSessions();
  }, []);

  // Load session details when selected
  useEffect(() => {
    if (!selectedSession) return;

    const loadSessionDetails = async () => {
      setLoading(true);
      try {
        const sessionData = await api.getDelphiSession(selectedSession.id);
        setTrends((sessionData as any)?.trend_ids || []);

        if (activeTab === 'summary') {
          const scoresData = await api.getDelphiScores(selectedSession.id);
          const scoresList = Array.isArray(scoresData) ? scoresData : (scoresData as any)?.scores || [];
          setScores(scoresList);
        }

        if (activeTab === 'consensus') {
          const consensusData = await api.getDelphiConsensus(selectedSession.id);
          setConsensus(consensusData);
        }
      } catch (err) {
        console.error('Failed to load session details:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSessionDetails();
  }, [selectedSession, activeTab]);

  const handleSelectSession = (session: DelphiSessionSummaryData) => {
    setSelectedSession(session);
    setActiveTab('scoring');
  };

  const handleSubmitScore = async (data: any) => {
    if (!selectedSession) return;
    setSubmitting(true);
    try {
      await api.submitDelphiScore(selectedSession.id, data);
      // Refresh trends
      const sessionData = await api.getDelphiSession(selectedSession.id);
      setTrends((sessionData as any)?.trend_ids || []);
    } catch (err) {
      console.error('Failed to submit score:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const tabs = [
    { id: 'sessions', label: 'Sessions', icon: Users },
    { id: 'scoring', label: 'Scoring', icon: Zap },
    { id: 'summary', label: 'Summary', icon: BarChart3 },
    { id: 'calibration', label: 'Calibrate', icon: Target },
    { id: 'consensus', label: 'Consensus', icon: CheckCircle2 },
  ] as const;

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        width: '420px',
        height: '100vh',
        backgroundColor: T.bg,
        borderLeft: `1px solid ${T.border1}`,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        boxShadow: '0 20px 25px rgba(0,0,0,0.1)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: `1px solid ${T.border1}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: T.text }}>
          Delphi Expert Elicitation
        </h2>
        <button
          onClick={onClose}
          style={{
            padding: '6px',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: T.text3,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: `1px solid ${T.border1}`,
          backgroundColor: T.bg1,
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '12px 8px',
                backgroundColor: isActive ? T.bg : 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid ${T.accent}` : 'none',
                fontSize: '11px',
                fontWeight: 600,
                color: isActive ? T.accent : T.text3,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                transition: 'all 0.2s',
              }}
              title={tab.label}
            >
              <Icon size={14} />
              <span style={{ display: 'none' }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', backgroundColor: T.bg }}>
        <AnimatePresence mode="wait">
          {activeTab === 'sessions' && (
            <SessionsOverviewTab
              key="sessions"
              sessions={sessions}
              onSelectSession={handleSelectSession}
              loading={loading}
            />
          )}
          {activeTab === 'scoring' && (
            <ScoringInterfaceTab
              key="scoring"
              session={selectedSession}
              trends={trends}
              scorerName={scorerName}
              onScorerNameChange={setScorerName}
              onSubmitScore={handleSubmitScore}
              loading={loading}
              submitting={submitting}
            />
          )}
          {activeTab === 'summary' && (
            <RoundSummaryTab key="summary" session={selectedSession} scores={scores} loading={loading} />
          )}
          {activeTab === 'calibration' && (
            <CalibrationExerciseTab
              key="calibration"
              session={selectedSession}
              scorerName={scorerName}
              loading={loading}
            />
          )}
          {activeTab === 'consensus' && (
            <ConsensusResultsTab
              key="consensus"
              session={selectedSession}
              consensus={consensus}
              loading={loading}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
