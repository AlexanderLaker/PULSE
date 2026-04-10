/**
 * CategoryDeepDive — Full-screen modal showing exhaustive category intelligence.
 * Opened via double-click on category in heatmap.
 *
 * Layout:
 * - Shift path (2026-2030) with percentile bands
 * - Force decomposition (% contribution by force)
 * - Contributing trends (sorted by leverage)
 * - Allocation recommendations
 * - Early-warning triggers
 */

import React, { FC, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend,
} from 'recharts';
import { X, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';

import type {
  ShiftMatrix, Trend, ForceName, ForceContribution,
  AllocationRecommendation, PercentileDistribution,
} from '../types';
import { T, CATEGORIES, YEARS, fmtShift, fmtPct, FORCES, FORCE_COLORS } from '../lib/format';

interface CategoryDeepDiveProps {
  categoryId: string;
  shifts: ShiftMatrix | null;
  trends: Trend[];
  forceContributions: Record<string, ForceContribution[]>;
  allocation: AllocationRecommendation | AllocationRecommendation[];
  onClose: () => void;
}

interface PathChartData {
  year: number;
  median: number;
  p10: number;
  p90: number;
  velocity?: number;
}

/**
 * Extract value from nested shift structure (same logic as Heatmap).
 */
function extractVal(path: unknown, year: number): number {
  if (!path) return 0;
  if (typeof path === 'number') return path;

  const pathObj = path as Record<string, unknown>;

  if (pathObj[year] != null) {
    const val = pathObj[year];
    if (typeof val === 'object' && val !== null) {
      const obj = val as Record<string, unknown>;
      return (obj.median ?? obj.p50 ?? 0) as number;
    }
    return val as number;
  }

  if (
    pathObj.p50 &&
    typeof pathObj.p50 === 'object' &&
    (pathObj.p50 as Record<string, unknown>)[year] != null
  ) {
    return ((pathObj.p50 as Record<string, number>)[year] as number) || 0;
  }

  if (
    pathObj.median &&
    typeof pathObj.median === 'object' &&
    (pathObj.median as Record<string, unknown>)[year] != null
  ) {
    return ((pathObj.median as Record<string, number>)[year] as number) || 0;
  }

  return 0;
}

/**
 * Extract percentile value (p10, p25, p75, p90) from nested structure.
 */
function extractPercentile(
  path: unknown,
  year: number,
  percentile: 'p10' | 'p25' | 'p75' | 'p90'
): number {
  if (!path) return 0;
  const pathObj = path as Record<string, unknown>;

  if (pathObj[year] != null) {
    const val = pathObj[year];
    if (typeof val === 'object' && val !== null) {
      const obj = val as Record<string, unknown>;
      return (obj[percentile] ?? obj.median ?? 0) as number;
    }
  }

  if (
    pathObj.percentiles &&
    typeof pathObj.percentiles === 'object'
  ) {
    const percObj = (pathObj.percentiles as Record<string, Record<string, number> | undefined>)[percentile];
    if (percObj && percObj[year] != null) return percObj[year];
  }

  return extractVal(path, year);
}

/**
 * Compute velocity (year-over-year rate of change).
 */
function computeVelocity(year: number, prevVal: number, currVal: number): number | undefined {
  if (year === 2026) return undefined; // No velocity for first year
  return currVal - prevVal;
}

const CategoryDeepDive: FC<CategoryDeepDiveProps> = ({
  categoryId,
  shifts,
  trends,
  forceContributions,
  allocation,
  onClose,
}) => {
  // Category metadata
  const catMeta = CATEGORIES.find(c => c.id === categoryId);
  const catName = catMeta?.name || categoryId;
  const catGroup = catMeta?.group || 'Unknown';
  const catColor = catMeta?.color || T.text3;

  // Extract shift path for this category
  const shiftPath = shifts?.[categoryId] || null;
  const val2030 = shiftPath ? extractVal(shiftPath, 2030) : 0;

  // Build chart data for shift path
  const pathChartData: PathChartData[] = YEARS.map((year, idx) => {
    const median = shiftPath ? extractVal(shiftPath, year) : 0;
    const p10 = shiftPath ? extractPercentile(shiftPath, year, 'p10') : median;
    const p90 = shiftPath ? extractPercentile(shiftPath, year, 'p90') : median;
    const prevMedian = idx > 0 ? YEARS[idx - 1] : undefined;
    const prevVal = prevMedian ? (shiftPath ? extractVal(shiftPath, prevMedian) : 0) : median;
    const velocity = computeVelocity(year, prevVal, median);

    return { year, median, p10, p90, velocity };
  });

  // Get force contributions for this category
  const forceContrib = forceContributions[categoryId] || [];
  const forceChartData = forceContrib.map(fc => ({
    force: fc.force,
    value: fc.normalized || fc.value,
  }));

  // Filter trends that affect this category
  const relatedTrends = trends
    .filter(t => {
      const exp = t.category_exposure || {};
      return exp[categoryId] && exp[categoryId] > 0;
    })
    .sort((a, b) => {
      const aScore = (a.probability || 0);
      const bScore = (b.probability || 0);
      return bScore - aScore;
    });

  // Get allocation recommendation for this category
  let allocRec: AllocationRecommendation | undefined;
  let allocWeight: number | undefined;

  if (Array.isArray(allocation)) {
    allocRec = allocation[0];
  } else {
    allocRec = allocation;
  }

  if (allocRec?.weights) {
    allocWeight = allocRec.weights[categoryId];
  }

  // Mock triggers for this category
  const triggers =
    val2030 < -0.02
      ? [
          {
            id: 1,
            condition: `Shift exceeds ${fmtShift(val2030)} by 2030`,
            alert: `Initiate ${catName} portfolio review — contraction accelerating`,
            target_year: 2030,
          },
        ]
      : [];

  // Close on Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Custom tooltip for shift path chart
  const PathTooltip = (props: any) => {
    const { active, payload } = props;
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload as PathChartData;
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          background: T.bg1,
          border: `1px solid ${T.border2}`,
          borderRadius: 8,
          padding: '10px 12px',
          fontSize: 11,
          color: T.text2,
          fontFamily: T.mono,
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
        } as React.CSSProperties}
      >
        <div>{data.year}</div>
        <div>Median: {fmtShift(data.median, 2)}</div>
        <div>P10: {fmtShift(data.p10, 2)}</div>
        <div>P90: {fmtShift(data.p90, 2)}</div>
      </motion.div>
    );
  };

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
        } as React.CSSProperties}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90vw',
          maxWidth: 1200,
          maxHeight: '90vh',
          background: T.bg,
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          zIndex: 1001,
          overflow: 'auto',
        } as React.CSSProperties}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px 32px',
            borderBottom: `1px solid ${T.border}`,
            background: T.bg2,
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 4,
                height: 32,
                borderRadius: 2,
                background: catColor,
              }}
            />
            <div>
              <h1
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: T.text,
                  margin: 0,
                }}
              >
                {catName}
              </h1>
              <p
                style={{
                  fontSize: 12,
                  color: T.text3,
                  margin: '2px 0 0 0',
                }}
              >
                {catGroup} Group — Net Shift {fmtShift(val2030)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 8,
              color: T.text2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Close (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            padding: '32px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 32,
          }}
        >
          {/* ─── LEFT COLUMN: Shift Path & Force Decomposition ─── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {/* Shift Path Chart */}
            <div
              style={{
                borderRadius: 12,
                border: `1px solid ${T.border}`,
                background: T.bg3,
                padding: 20,
              }}
            >
              <h2
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: T.text3,
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                  margin: '0 0 16px 0',
                }}
              >
                Shift Path (2026–2030)
              </h2>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={pathChartData}>
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={catColor} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={catColor} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                  <XAxis
                    dataKey="year"
                    tick={{ fontSize: 11, fill: T.text3 }}
                    axisLine={{ stroke: T.border }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: T.text3 }}
                    axisLine={{ stroke: T.border }}
                    label={{ value: 'Shift %', angle: -90, position: 'insideLeft', offset: 8 }}
                  />
                  <Tooltip content={<PathTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="median"
                    stroke={catColor}
                    strokeWidth={2}
                    fill="url(#areaGradient)"
                  />
                  <Line
                    type="monotone"
                    dataKey="p10"
                    stroke={catColor}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="p90"
                    stroke={catColor}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
              {/* Velocity annotations */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 8,
                  marginTop: 16,
                  paddingTop: 16,
                  borderTop: `1px solid ${T.border}`,
                  fontSize: 10,
                  color: T.text3,
                  fontFamily: T.mono,
                }}
              >
                {pathChartData.slice(1).map((d, i) => (
                  <div key={d.year}>
                    <div>{d.year}</div>
                    <div style={{ color: (d.velocity ?? 0) < 0 ? T.red : T.green }}>
                      {d.velocity != null ? `Δ ${fmtShift(d.velocity, 2)}` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Force Decomposition */}
            {forceChartData.length > 0 && (
              <div
                style={{
                  borderRadius: 12,
                  border: `1px solid ${T.border}`,
                  background: T.bg3,
                  padding: 20,
                }}
              >
                <h2
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: T.text3,
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                    margin: '0 0 16px 0',
                  }}
                >
                  Force Contribution
                </h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart layout="vertical" data={forceChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: T.text3 }} />
                    <YAxis
                      dataKey="force"
                      type="category"
                      tick={{ fontSize: 10, fill: T.text3 }}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{
                        background: T.bg1,
                        border: `1px solid ${T.border2}`,
                        borderRadius: 8,
                        fontSize: 10,
                      }}
                      formatter={(v: unknown) => fmtPct(Number(v) || 0, 1)}
                    />
                    <Bar dataKey="value" fill={catColor} radius={4}>
                      {forceChartData.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={FORCE_COLORS[entry.force as ForceName] || catColor}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ─── RIGHT COLUMN: Trends, Allocation, Triggers ─── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {/* Allocation Recommendation */}
            {allocRec && (
              <div
                style={{
                  borderRadius: 12,
                  border: `1px solid ${T.border}`,
                  background: T.bg3,
                  padding: 20,
                }}
              >
                <h2
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: T.text3,
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                    margin: '0 0 16px 0',
                  }}
                >
                  Allocation
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {allocWeight !== undefined && (
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: T.text2,
                          marginBottom: 4,
                        }}
                      >
                        Recommended Weight
                      </div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: catColor,
                          fontFamily: T.mono,
                        }}
                      >
                        {fmtPct(allocWeight, 1)}
                      </div>
                    </div>
                  )}
                  {allocRec.invest_more?.includes(categoryId) && (
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'flex-start',
                        padding: 12,
                        borderRadius: 8,
                        background: T.greenDim,
                        borderLeft: `3px solid ${T.green}`,
                      }}
                    >
                      <TrendingUp size={16} style={{ color: T.green, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: T.text, lineHeight: 1.4 }}>
                        Increase investment — expansion opportunity
                      </span>
                    </div>
                  )}
                  {allocRec.defend?.includes(categoryId) && (
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'flex-start',
                        padding: 12,
                        borderRadius: 8,
                        background: T.amberDim,
                        borderLeft: `3px solid ${T.amber}`,
                      }}
                    >
                      <AlertTriangle size={16} style={{ color: T.amber, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: T.text, lineHeight: 1.4 }}>
                        Maintain investment — defend market share
                      </span>
                    </div>
                  )}
                  {allocRec.harvest?.includes(categoryId) && (
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'flex-start',
                        padding: 12,
                        borderRadius: 8,
                        background: T.redDim,
                        borderLeft: `3px solid ${T.red}`,
                      }}
                    >
                      <TrendingDown size={16} style={{ color: T.red, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: T.text, lineHeight: 1.4 }}>
                        Harvest cash — decline phase
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Contributing Trends */}
            {relatedTrends.length > 0 && (
              <div
                style={{
                  borderRadius: 12,
                  border: `1px solid ${T.border}`,
                  background: T.bg3,
                  padding: 20,
                }}
              >
                <h2
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: T.text3,
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                    margin: '0 0 12px 0',
                  }}
                >
                  Contributing Trends
                </h2>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    maxHeight: 320,
                    overflowY: 'auto',
                  }}
                >
                  {relatedTrends.slice(0, 6).map(trend => {
                    const score = (trend.probability || 0);
                    const forceColor = FORCE_COLORS[trend.force as ForceName] || T.text3;
                    return (
                      <motion.div
                        key={trend.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        style={{
                          padding: 10,
                          borderRadius: 8,
                          background: T.bg,
                          border: `1px solid ${T.border}`,
                          fontSize: 10,
                          color: T.text2,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: 4,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: T.text,
                              flex: 1,
                            }}
                          >
                            {trend.name}
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              gap: 6,
                              alignItems: 'center',
                            }}
                          >
                            <div
                              style={{
                                fontSize: 9,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: forceColor + '20',
                                color: forceColor,
                                fontWeight: 600,
                              }}
                            >
                              {trend.force}
                            </div>
                            <div
                              style={{
                                fontSize: 9,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background:
                                  trend.direction === 'Expansion' ? T.greenDim : T.redDim,
                                color:
                                  trend.direction === 'Expansion' ? T.green : T.red,
                                fontWeight: 600,
                              }}
                            >
                              {trend.direction === 'Expansion' ? '+' : '−'}
                            </div>
                          </div>
                        </div>
                        <div style={{ color: T.text3, lineHeight: 1.3 }}>
                          {trend.strategic_implication ||
                            trend.description?.slice(0, 60)}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Early-Warning Triggers */}
            {triggers.length > 0 && (
              <div
                style={{
                  borderRadius: 12,
                  border: `1px solid ${T.border}`,
                  background: T.redDim,
                  padding: 16,
                  borderLeft: `4px solid ${T.red}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}
                >
                  <AlertTriangle
                    size={18}
                    style={{ color: T.red, flexShrink: 0, marginTop: 2 }}
                  />
                  <div>
                    <h3
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: T.red,
                        margin: '0 0 6px 0',
                      }}
                    >
                      Trigger Alert
                    </h3>
                    {triggers.map(t => (
                      <p
                        key={t.id}
                        style={{
                          fontSize: 11,
                          color: T.text,
                          margin: 0,
                          lineHeight: 1.4,
                        }}
                      >
                        {t.alert}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CategoryDeepDive;
