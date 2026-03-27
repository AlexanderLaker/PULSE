/**
 * TippingPointsPanel — Early-warning tipping points visualization
 * Shows detected inflection points where categories cross critical thresholds
 */

import { motion } from 'framer-motion';
import { AlertTriangle, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { T, CATEGORIES, YEARS, fmtShift } from '../../lib/format';
import type { TippingPointsResult, TippingPoint } from '../../types/analytics';

interface TippingPointsPanelProps {
  tippingData?: TippingPointsResult | null;
  isLoading?: boolean;
}

export default function TippingPointsPanel({
  tippingData = null,
  isLoading = false,
}: TippingPointsPanelProps) {
  if (!tippingData) {
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
        {isLoading ? 'Detecting tipping points...' : 'No tipping points detected'}
      </div>
    );
  }

  const tippingPoints = (tippingData as any).points ?? [];
  const systemicYears = (tippingData as any).systemic_years ?? {};

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
          Tipping Points & Inflection Zones
        </h3>
        <p
          style={{
            fontSize: 13,
            color: T.text3,
            margin: 0,
          }}
        >
          Years where shifts exceed critical thresholds or acceleration occurs
        </p>
      </div>

      {/* Systemic Risk Years (across multiple categories) */}
      {Object.keys(systemicYears).length > 0 && (
        <div>
          <h4
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: T.text,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              margin: '0 0 12px 0',
            }}
          >
            Systemic Risk Years
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {YEARS.map((year) => {
              const riskLevel = (systemicYears as Record<number, number>)[year];
              if (!riskLevel) return null;

              const severity =
                riskLevel > 5 ? 'high' : riskLevel > 2 ? 'medium' : 'low';
              const colors = {
                high: { bg: 'rgba(255,69,58,0.08)', border: 'rgba(255,69,58,0.2)', icon: T.red },
                medium: {
                  bg: 'rgba(255,159,10,0.08)',
                  border: 'rgba(255,159,10,0.2)',
                  icon: T.amber,
                },
                low: { bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)', icon: T.green },
              };
              const color = colors[severity];

              return (
                <motion.div
                  key={year}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    backgroundColor: color.bg,
                    borderRadius: 8,
                    border: `1px solid ${color.border}`,
                  }}
                >
                  <AlertTriangle size={16} color={color.icon} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: T.text,
                        margin: 0,
                      }}
                    >
                      {year}
                    </p>
                    <p
                      style={{
                        fontSize: 12,
                        color: T.text2,
                        margin: 0,
                      }}
                    >
                      {riskLevel} categories at risk
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category-Specific Tipping Points */}
      {tippingPoints.length > 0 && (
        <div>
          <h4
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: T.text,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              margin:
                Object.keys(systemicYears).length > 0 ? '16px 0 12px 0' : '0 0 12px 0',
            }}
          >
            Category Tipping Points
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tippingPoints.slice(0, 8).map((point: any, idx: number) => {
              const category = CATEGORIES.find((c) => c.id === point.category_id);
              const severity = (point?.severity || 'medium') as 'high' | 'medium' | 'low';
              const severityColors: Record<
                'high' | 'medium' | 'low',
                { icon: string; bg: string }
              > = {
                high: { icon: T.red, bg: 'rgba(255,69,58,0.05)' },
                medium: { icon: T.amber, bg: 'rgba(255,159,10,0.05)' },
                low: { icon: T.green, bg: 'rgba(52,211,153,0.05)' },
              };

              const colors = severityColors[severity] || severityColors.medium;

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    backgroundColor: colors.bg,
                    borderRadius: 8,
                    border: `1px solid rgba(0,0,0,0.06)`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Zap size={14} color={colors.icon} />
                    <div>
                      <p
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: T.text,
                          margin: 0,
                        }}
                      >
                        {category?.short || point.category_id}
                      </p>
                      <p
                        style={{
                          fontSize: 12,
                          color: T.text2,
                          margin: 0,
                        }}
                      >
                        {point.description}
                      </p>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: point.shift < 0 ? T.red : T.green,
                        fontFamily: T.mono,
                      }}
                    >
                      {fmtShift(point.shift)}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: T.text3,
                      }}
                    >
                      {point.year}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {tippingPoints.length === 0 && Object.keys(systemicYears).length === 0 && (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            color: T.text3,
          }}
        >
          <p style={{ fontSize: 14, margin: 0 }}>
            No critical tipping points detected in current scenario
          </p>
        </div>
      )}
    </motion.div>
  );
}
