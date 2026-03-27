/**
 * CVaRDisplay — Conditional Value at Risk visualization
 * Shows per-category CVaR and portfolio CVaR with risk contribution breakdown
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingDown, BarChart3 } from 'lucide-react';
import { T, CATEGORIES, fmtPct, fmtShift } from '../../lib/format';
import type { CVaRResult } from '../../types/analytics';

interface CVaRDisplayProps {
  cvarData?: CVaRResult | null;
  isLoading?: boolean;
}

export default function CVaRDisplay({
  cvarData = null,
  isLoading = false,
}: CVaRDisplayProps) {
  const [viewMode, setViewMode] = useState<'portfolio' | 'category'>('portfolio');

  if (!cvarData) {
    return (
      <div
        style={{
          padding: 24,
          backgroundColor: T.bg2,
          borderRadius: 12,
          border: `1px solid ${T.border}`,
          textAlign: 'center',
          color: T.text3,
        }}
      >
        {isLoading ? 'Computing CVaR...' : 'No CVaR data available'}
      </div>
    );
  }

  const portfolioCVaR = (cvarData as any).portfolio_cvar ?? 0;
  const categoryCVaR = (cvarData as any).category_cvar ?? {};
  const riskContribution = (cvarData as any).risk_contribution ?? {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
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
          Conditional Value at Risk
        </h3>
        <p
          style={{
            fontSize: 13,
            color: T.text3,
            margin: 0,
          }}
        >
          95th percentile worst-case loss scenario
        </p>
      </div>

      {/* Portfolio CVaR Card */}
      <div
        style={{
          padding: 20,
          backgroundColor: 'rgba(255,69,58,0.05)',
          borderRadius: 12,
          border: `1px solid rgba(255,69,58,0.15)`,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: 'rgba(255,69,58,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TrendingDown size={24} color={T.red} />
        </div>
        <div style={{ flex: 1 }}>
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: T.text3,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              margin: '0 0 6px 0',
            }}
          >
            Portfolio CVaR
          </p>
          <p
            style={{
              fontSize: 24,
              fontWeight: 300,
              fontFamily: T.mono,
              color: T.red,
              margin: 0,
              letterSpacing: -0.5,
            }}
          >
            {fmtShift(portfolioCVaR)}
          </p>
        </div>
      </div>

      {/* View Toggle */}
      <div style={{ display: 'flex', gap: 8, borderBottom: `1px solid ${T.border}` }}>
        {(['portfolio', 'category'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            style={{
              padding: '12px 16px',
              backgroundColor: viewMode === mode ? T.accentDim : 'transparent',
              border: 'none',
              borderBottom: viewMode === mode ? `2px solid ${T.accent}` : 'none',
              color: viewMode === mode ? T.text : T.text2,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (viewMode !== mode) {
                e.currentTarget.style.color = T.text;
              }
            }}
            onMouseLeave={(e) => {
              if (viewMode !== mode) {
                e.currentTarget.style.color = T.text2;
              }
            }}
          >
            {mode === 'portfolio' ? 'Risk Contribution' : 'By Category'}
          </button>
        ))}
      </div>

      {/* Risk Contribution Breakdown */}
      {viewMode === 'portfolio' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(riskContribution)
            .sort(([, a], [, b]) => Math.abs((b as number) || 0) - Math.abs((a as number) || 0))
            .slice(0, 8)
            .map(([catId, contribution]) => {
              const category = CATEGORIES.find((c) => c.id === catId);
              if (!category) return null;
              const pct = Math.abs((contribution as number) || 0) * 100;

              return (
                <motion.div
                  key={catId}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 100,
                      fontSize: 12,
                      fontWeight: 500,
                      color: T.text2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {category.short}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      height: 6,
                      backgroundColor: T.bg4,
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      style={{
                        height: '100%',
                        backgroundColor: category.color,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      width: 60,
                      textAlign: 'right',
                      fontSize: 12,
                      fontFamily: T.mono,
                      color: T.text,
                      fontWeight: 500,
                    }}
                  >
                    {fmtPct(contribution as number)}
                  </div>
                </motion.div>
              );
            })}
        </div>
      )}

      {/* By Category View */}
      {viewMode === 'category' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CATEGORIES.filter((c) => (categoryCVaR as Record<string, number>)[c.id] !== undefined)
              .sort(
                (a, b) =>
                  Math.abs(((categoryCVaR as Record<string, number>)[b.id] || 0)) -
                  Math.abs(((categoryCVaR as Record<string, number>)[a.id] || 0))
              )
              .slice(0, 8)
              .map((category) => (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 0',
                    borderBottom: `1px solid ${T.border}`,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      color: T.text,
                      fontWeight: 500,
                    }}
                  >
                    {category.short}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontFamily: T.mono,
                      color:
                        ((categoryCVaR as Record<string, number>)[category.id] || 0) < 0
                          ? T.red
                          : T.green,
                      fontWeight: 500,
                    }}
                  >
                    {fmtShift((categoryCVaR as Record<string, number>)[category.id])}
                  </span>
                </motion.div>
              ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
