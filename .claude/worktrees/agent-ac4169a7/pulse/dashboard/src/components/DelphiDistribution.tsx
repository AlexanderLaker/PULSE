/**
 * DelphiDistribution — Reusable score distribution visualization
 * Shows scores as a horizontal dot strip with median line
 * Color-coded by Krippendorff's α (inter-rater reliability)
 */

import React from 'react';
import { T } from '../lib/format';

interface DelphiDistributionProps {
  scores?: number[];
  median?: number | null;
  alpha?: number | null;
  label?: string;
}

export default function DelphiDistribution({
  scores = [],
  median = null,
  alpha = null,
  label = '',
}: DelphiDistributionProps) {
  // Calculate color based on reliability
  const getAlphaColor = (): string => {
    if (alpha == null) return T.text3;
    if (alpha >= 0.8) return T.green;
    if (alpha >= 0.67) return T.amber;
    return T.red;
  };

  const getAlphaLabel = (): string => {
    if (alpha == null) return 'α unknown';
    if (alpha >= 0.8) return 'Excellent';
    if (alpha >= 0.67) return 'Acceptable';
    return 'Poor';
  };

  const alphaColor = getAlphaColor();
  const alphaLabel = getAlphaLabel();

  // Calculate distribution for display
  const scoreCounts: Record<number, number> = {};
  scores.forEach((s) => {
    scoreCounts[s] = (scoreCounts[s] || 0) + 1;
  });

  const min = 1;
  const max = 5;
  const range = max - min;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '12px',
        backgroundColor: T.bg3,
        borderRadius: '12px',
        border: `1px solid ${T.border}`,
      }}
    >
      {label && (
        <div style={{ fontSize: '11px', fontWeight: 600, color: T.text2 }}>
          {label}
        </div>
      )}

      {/* Score dots */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          height: '40px',
          position: 'relative',
          gap: '4px',
        }}
      >
        {/* Grid background */}
        {[1, 2, 3, 4, 5].map((score) => (
          <div
            key={score}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-end',
              position: 'relative',
            }}
          >
            {/* Vertical gridline */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '-4px',
                width: '1px',
                height: 'calc(100% + 8px)',
                backgroundColor: T.border,
              }}
            />

            {/* Dots for this score */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {Array.from({ length: scoreCounts[score] || 0 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: alphaColor,
                    opacity: 0.8,
                  }}
                  title={`Score: ${score}`}
                />
              ))}
            </div>

            {/* Score label */}
            <div
              style={{
                marginTop: '4px',
                fontSize: '10px',
                fontWeight: 500,
                color: T.text3,
              }}
            >
              {score}
            </div>
          </div>
        ))}

        {/* Median line (if provided) */}
        {median != null && (
          <div
            style={{
              position: 'absolute',
              left: `calc((${median - 1} / ${range}) * 100%)`,
              top: '-6px',
              width: '2px',
              height: 'calc(100% + 12px)',
              backgroundColor: T.accent,
              boxShadow: `0 0 8px ${T.accent}4D`,
            }}
            title={`Median: ${median.toFixed(2)}`}
          />
        )}
      </div>

      {/* Stats footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '10px',
          color: T.text2,
          borderTop: `1px solid ${T.border}`,
          paddingTop: '8px',
          marginTop: '4px',
        }}
      >
        <span>n = {scores.length} scorers</span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>α {alpha != null ? alpha.toFixed(2) : '—'}</span>
          <span
            style={{
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: alphaColor,
            }}
          />
          <span style={{ fontSize: '9px', color: T.text3 }}>({alphaLabel})</span>
        </div>
      </div>
    </div>
  );
}
