/**
 * DelphiScoreCard — Reusable card for scoring a single trend
 * Includes impact & probability sliders, rationale textarea, anonymized previous scores
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { T, FORCES } from '../lib/format';
import DelphiDistribution from './DelphiDistribution';

interface TrendData {
  id: string;
  name: string;
  description: string;
  force: string;
  direction: 'Expansion' | 'Contraction';
  impact?: number;
  probability?: number;
  strategic_implication?: string;
}

interface PreviousScoresData {
  impact?: number[];
  probability?: number[];
  impact_alpha?: number;
  probability_alpha?: number;
}

interface DelphiScoreCardProps {
  trend: TrendData;
  currentRound?: number;
  previousScores?: PreviousScoresData | null;
  onSubmit: (data: any) => void;
  isSubmitting?: boolean;
}

interface ScoreSliderProps {
  label: 'Impact' | 'Probability';
  value: number;
  onChange: (value: number) => void;
  previousScores?: number[] | null;
  previousAlpha?: number | null;
}

const ScoreSlider: React.FC<ScoreSliderProps> = ({
  label,
  value,
  onChange,
  previousScores = null,
  previousAlpha = null,
}) => {
  const labels = {
    impact: ['Negligible', 'Low', 'Moderate', 'High', 'Transformative'],
    probability: ['Very Unlikely', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'],
  };

  const scoreType = label === 'Impact' ? 'impact' : 'probability';
  const scoreLabels = labels[scoreType];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <label style={{ fontSize: '12px', fontWeight: 600, color: T.text2 }}>
          {label}
        </label>
        <span style={{ fontSize: '14px', fontWeight: 600, color: T.accent }}>
          {value}/5
        </span>
      </div>

      {/* Slider */}
      <input
        type="range"
        min="1"
        max="5"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        style={{
          width: '100%',
          height: '6px',
          borderRadius: '3px',
          background: `linear-gradient(to right, ${T.amber}, ${T.amber} ${((value - 1) / 4) * 100}%, ${T.bg4} ${((value - 1) / 4) * 100}%, ${T.bg4})`,
          outline: 'none',
          cursor: 'pointer',
          WebkitAppearance: 'none',
        } as React.CSSProperties}
      />

      {/* Labels and dots */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {[1, 2, 3, 4, 5].map((dot) => (
          <div
            key={dot}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              opacity: dot === value ? 1 : 0.5,
              transition: 'opacity 0.2s',
            }}
            onClick={() => onChange(dot)}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: dot === value ? T.amber : T.bg4,
                transition: 'all 0.2s',
              }}
            />
            <span style={{ fontSize: '9px', color: T.text3, textAlign: 'center', maxWidth: '50px' }}>
              {scoreLabels[dot - 1]}
            </span>
          </div>
        ))}
      </div>

      {/* Show previous distribution if this is Round 2+ */}
      {previousScores && previousScores.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <DelphiDistribution
            scores={previousScores}
            median={previousScores.reduce((a, b) => a + b, 0) / previousScores.length}
            alpha={previousAlpha}
            label={`Round 1 Distribution (${previousScores.length} scorers)`}
          />
        </div>
      )}
    </div>
  );
};

export default function DelphiScoreCard({
  trend,
  currentRound = 1,
  previousScores = null,
  onSubmit,
  isSubmitting = false,
}: DelphiScoreCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [impact, setImpact] = useState(trend.impact || 3);
  const [probability, setProbability] = useState(trend.probability || 3);
  const [rationale, setRationale] = useState('');
  const [touched, setTouched] = useState(false);

  const forceColor = FORCES[trend.force as keyof typeof FORCES]?.color || T.text3;
  const canSubmit = rationale.trim().length >= 20;
  const charCount = rationale.trim().length;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setTouched(true);
    onSubmit({
      trend_id: trend.id,
      impact,
      probability,
      rationale: rationale.trim(),
      round: currentRound,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      style={{
        backgroundColor: T.bg2,
        borderRadius: '12px',
        border: `1px solid ${T.border1}`,
        overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
      className="row-hover"
    >
      {/* Header / Collapsed view */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          padding: '12px',
          textAlign: 'left',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
        className="row-hover"
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              marginBottom: '4px',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                padding: '2px 6px',
                backgroundColor: forceColor + '20',
                color: forceColor,
                fontSize: '9px',
                fontWeight: 600,
                borderRadius: '4px',
              }}
            >
              {trend.force}
            </span>
            <span
              style={{
                display: 'inline-block',
                padding: '2px 6px',
                backgroundColor: T.bg4,
                color: T.text3,
                fontSize: '9px',
                fontWeight: 500,
                borderRadius: '4px',
              }}
            >
              {trend.direction}
            </span>
          </div>

          <h4
            style={{
              margin: '0 0 4px 0',
              fontSize: '13px',
              fontWeight: 600,
              color: T.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {trend.name}
          </h4>

          <p
            style={{
              margin: '0',
              fontSize: '12px',
              color: T.text3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {trend.description}
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: T.text2,
          }}
        >
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {/* Expanded detail view */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            borderTop: `1px solid ${T.border}`,
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Full description */}
          <div>
            <h5
              style={{
                margin: '0 0 6px 0',
                fontSize: '11px',
                fontWeight: 600,
                color: T.text2,
                textTransform: 'uppercase',
              }}
            >
              Background
            </h5>
            <p style={{ margin: '0', fontSize: '12px', color: T.text2, lineHeight: '1.5' }}>
              {trend.description}
            </p>
          </div>

          {/* Strategic implication */}
          {trend.strategic_implication && (
            <div>
              <h5
                style={{
                  margin: '0 0 6px 0',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: T.text2,
                  textTransform: 'uppercase',
                }}
              >
                Strategic Implication
              </h5>
              <p style={{ margin: '0', fontSize: '12px', color: T.text2, lineHeight: '1.5' }}>
                {trend.strategic_implication}
              </p>
            </div>
          )}

          {/* Scoring section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <ScoreSlider
              label="Impact"
              value={impact}
              onChange={setImpact}
              previousScores={previousScores?.impact}
              previousAlpha={previousScores?.impact_alpha}
            />

            <ScoreSlider
              label="Probability"
              value={probability}
              onChange={setProbability}
              previousScores={previousScores?.probability}
              previousAlpha={previousScores?.probability_alpha}
            />
          </div>

          {/* Rationale textarea */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <label style={{ fontSize: '12px', fontWeight: 600, color: T.text2 }}>
                Rationale
              </label>
              <span
                style={{
                  fontSize: '10px',
                  color:
                    charCount < 20 && touched
                      ? T.red
                      : charCount >= 20
                        ? T.green
                        : T.text3,
                }}
              >
                {charCount}/20 min
              </span>
            </div>

            <textarea
              value={rationale}
              onChange={(e) => {
                setRationale(e.target.value);
                setTouched(true);
              }}
              placeholder="Why this score? What evidence supports it? (minimum 20 characters)"
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '8px',
                fontSize: '12px',
                fontFamily: T.sans,
                color: T.text,
                backgroundColor: T.bg,
                border: `1px solid ${charCount < 20 && touched ? T.red : T.border1}`,
                borderRadius: '8px',
                resize: 'vertical',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />
          </div>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            style={{
              padding: '10px 16px',
              fontSize: '12px',
              fontWeight: 600,
              color: canSubmit ? T.bg : T.text3,
              backgroundColor: canSubmit ? T.accent : T.bg4,
              border: 'none',
              borderRadius: '8px',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Score'}
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
