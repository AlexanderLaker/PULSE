/**
 * ForceWeightSliders — Interactive force weight adjustment
 * Extracted from ProfitPoolShiftModel for modularity
 */

import { useState, FC } from 'react';
import { motion } from 'framer-motion';
import { T, FORCES, fmtPct } from '../lib/format';
import type { ForceName } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

interface ForceWeights {
  [key: string]: number;
}

interface ForceWeightSlidersProps {
  onWeightsChange?: (weights: ForceWeights) => void;
}

// ─── ForceWeightSliders ────────────────────────────────────────────────────

const ForceWeightSliders: FC<ForceWeightSlidersProps> = ({ onWeightsChange = () => {} }) => {
  const initialWeights: ForceWeights = Object.fromEntries(
    Object.keys(FORCES).map((force) => [force, 1.0 / Object.keys(FORCES).length])
  );

  const [weights, setWeights] = useState<ForceWeights>(initialWeights);

  const handleWeightChange = (force: string, newWeight: number): void => {
    const adjustment = newWeight - (weights[force] || 0);
    const otherForces = Object.keys(weights).filter((f) => f !== force);

    const newWeights: ForceWeights = { ...weights, [force]: newWeight };
    if (otherForces.length > 0) {
      const perForce = adjustment / otherForces.length;
      otherForces.forEach((f) => {
        newWeights[f] = Math.max(0.1, (newWeights[f] || 0) - perForce);
      });
    }

    // Normalize to sum to 1
    const sum = Object.values(newWeights).reduce((s, w) => s + (w || 0), 0);
    Object.keys(newWeights).forEach((f) => {
      newWeights[f] = (newWeights[f] || 0) / sum;
    });

    setWeights(newWeights);
    onWeightsChange(newWeights);
  };

  const sum = Object.values(weights).reduce((s, w) => s + w, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 24,
        backgroundColor: T.bg2,
        borderRadius: 12,
        border: `1px solid ${T.border}`,
      }}
    >
      {/* Header */}
      <div>
        <h3
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: T.text,
            margin: '0 0 8px 0',
          }}
        >
          Force Weights
        </h3>
        <p
          style={{
            fontSize: 13,
            color: T.text3,
            margin: 0,
          }}
        >
          Adjust the relative importance of each strategic force
        </p>
      </div>

      {/* Weight Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {Object.entries(FORCES).map(([forceName, forceData]) => (
          <div key={forceName} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Label */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: T.text,
                }}
              >
                {forceData.emoji} {forceData.label}
              </label>
              <span
                style={{
                  fontSize: 12,
                  fontFamily: T.mono,
                  color: forceData.color,
                  fontWeight: 600,
                }}
              >
                {fmtPct(weights[forceName])}
              </span>
            </div>

            {/* Slider */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input
                type="range"
                min="0.1"
                max="0.4"
                step="0.01"
                value={weights[forceName]}
                onChange={(e) => handleWeightChange(forceName, parseFloat(e.target.value))}
                style={{
                  flex: 1,
                  height: 6,
                  cursor: 'pointer',
                  accentColor: forceData.color,
                } as React.CSSProperties}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Normalization Note */}
      <div
        style={{
          padding: 12,
          backgroundColor: T.bg3,
          borderRadius: 8,
          border: `1px solid ${T.border}`,
          fontSize: 12,
          color: T.text2,
        }}
      >
        Sum: <span style={{ fontFamily: T.mono, fontWeight: 600 }}>{fmtPct(sum)}</span> (weights are automatically normalized)
      </div>
    </motion.div>
  );
};

export default ForceWeightSliders;
