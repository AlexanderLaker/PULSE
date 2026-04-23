/**
 * CategoryDetailPanel — Slide-in right panel showing deep detail for a selected category.
 * Apple × Bain × Goldman Sachs: glassmorphism, generous whitespace, micro-interactions.
 *
 * Props: { data, categoryId, onClose }
 * data: { shifts_path: {...}, force_decomposition: {...}, contributing_trends: [...] }
 *
 * Features:
 * - Animated slide-in from right with backdrop blur
 * - Mini area chart (p10/p90 band + median line)
 * - Force decomposition horizontal bars
 * - Contributing trends list with scores and exposures
 */
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Bell, BellOff, AlertCircle, TrendingUp, Shield, ArrowDownCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  AreaChart, Area, Line, ComposedChart, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { T, FORCES, FORCE_COLORS, FORCE_ICONS, YEARS, fmtShift, fmtPct, shortCat } from '@/lib/format';
import type { ForceName, ProjectionYear, TriggerStatus, AllocationRecommendation } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────

interface PathDataPoint {
  median?: number;
  p10?: number;
  p90?: number;
}

interface PathData {
  [key: string]: PathDataPoint;
}

interface Trend {
  id: string;
  name: string;
  force: ForceName;
  direction: 'Expansion' | 'Contraction';
  score?: number;
  exposure_level?: number;
}

interface CategoryDetailPanelData {
  shifts_path?: { [categoryId: string]: PathData };
  force_decomposition?: { [categoryId: string]: Record<ForceName, number> };
  contributing_trends?: { [categoryId: string]: Trend[] };
  categories?: Array<{ id: string; name: string; group?: string }>;
}

interface CategoryDetailPanelProps {
  data: CategoryDetailPanelData;
  categoryId: string;
  onClose: () => void;
  /** Optional: early-warning triggers. Panel filters them by category and
   *  renders one row per trigger with status, year, threshold, and action text.
   *  Pass the full trigger list from /api/v1/triggers; filtering happens here. */
  triggers?: TriggerStatus[];
  /** Optional: allocation recommendation from the mean-variance optimizer.
   *  Panel infers this category's stance (invest / defend / harvest) from
   *  the lists and surfaces the optimizer's rationale. */
  allocation?: AllocationRecommendation | null;
}

interface ChartDataPoint {
  year: ProjectionYear;
  median: number;
  p10: number;
  p90: number;
}

// ─── MiniPathChart ────────────────────────────────────────────────────────

interface MiniPathChartProps {
  pathData: PathData;
}

const MiniPathChart: React.FC<MiniPathChartProps> = ({ pathData }) => {
  if (!pathData || Object.keys(pathData).length === 0) {
    return (
      <div style={{
        height: '120px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: T.text2,
        fontSize: '11px',
      }}>
        No path data available
      </div>
    );
  }

  // Format data for Recharts
  const chartData: ChartDataPoint[] = YEARS.map(year => ({
    year: year as ProjectionYear,
    median: pathData[year]?.median || 0,
    p10: pathData[year]?.p10 || 0,
    p90: pathData[year]?.p90 || 0,
  }));

  const maxAbs = Math.max(
    ...chartData.map(d => Math.max(Math.abs(d.p10), Math.abs(d.p90)))
  );
  const yAxisDomain: [number, number] = [-maxAbs * 1.1, maxAbs * 1.1];

  return (
    <div style={{ height: '120px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="confidenceBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={T.accent} stopOpacity={0.15} />
              <stop offset="100%" stopColor={T.accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 2" stroke={T.border} horizontal={true} vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 9, fill: T.text2 }}
            axisLine={{ stroke: T.border }}
            tickLine={false}
          />
          <YAxis
            domain={yAxisDomain}
            tick={{ fontSize: 9, fill: T.text2 }}
            axisLine={{ stroke: T.border }}
            tickLine={false}
            tickFormatter={v => `${(v * 100).toFixed(0)}%`}
            width={40}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = (payload[0]?.payload) as ChartDataPoint;
              return (
                <div style={{
                  backgroundColor: T.bg1,
                  border: `1px solid ${T.border2}`,
                  borderRadius: '6px',
                  padding: '8px 10px',
                  fontSize: '10px',
                }}>
                  <div style={{ color: T.text2, marginBottom: '2px' }}>{d.year}</div>
                  <div style={{ color: T.accent, fontWeight: 600 }}>
                    {fmtShift(d.median, 2)}
                  </div>
                  <div style={{ color: T.text3, fontSize: '8px', marginTop: '2px' }}>
                    {fmtShift(d.p10, 2)} to {fmtShift(d.p90, 2)}
                  </div>
                </div>
              );
            }}
            cursor={{ fill: `${T.accent}10` }}
          />

          {/* Confidence band: p10 to p90 */}
          <Area
            type="monotone"
            dataKey="p10"
            stackId="band"
            stroke="none"
            fill={T.accent}
            fillOpacity={0.08}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey={(d: ChartDataPoint) => (d.p90 - d.p10)}
            stackId="band"
            stroke="none"
            fill="url(#confidenceBand)"
            isAnimationActive={false}
          />

          {/* Median line */}
          <Line
            type="monotone"
            dataKey="median"
            stroke={T.accent}
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── ForceDecomposition ────────────────────────────────────────────────────

interface ForceDecompositionProps {
  decomposition: Record<ForceName, number>;
}

const ForceDecomposition: React.FC<ForceDecompositionProps> = ({ decomposition }) => {
  if (!decomposition || Object.keys(decomposition).length === 0) {
    return (
      <div style={{ fontSize: '11px', color: T.text2 }}>
        No decomposition data available
      </div>
    );
  }

  const forces = Object.keys(decomposition)
    .filter((f): f is ForceName => decomposition[f as ForceName] !== 0)
    .sort((a, b) => Math.abs(decomposition[b as ForceName]) - Math.abs(decomposition[a as ForceName]));

  if (forces.length === 0) {
    return (
      <div style={{ fontSize: '11px', color: T.text2 }}>
        No force contributions detected
      </div>
    );
  }

  const maxAbs = Math.max(...forces.map(f => Math.abs(decomposition[f])));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {forces.map(force => {
        const value = decomposition[force];
        const pct = maxAbs > 0 ? Math.abs(value) / maxAbs : 0;
        const color = value > 0 ? T.green : T.red;
        const forceColor = FORCE_COLORS[force] || T.text2;

        return (
          <div key={force} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            {/* Force label + icon */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              minWidth: '80px',
              fontSize: '10px',
              fontWeight: 500,
              color: T.text2,
            }}>
              <span style={{ fontSize: '12px' }}>{FORCE_ICONS[force]}</span>
              {force}
            </div>

            {/* Horizontal bar */}
            <div style={{
              flex: 1,
              height: '5px',
              backgroundColor: T.bg3,
              borderRadius: '2px',
              overflow: 'hidden',
            }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct * 100}%` }}
                transition={{ delay: 0.2, duration: 0.5, ease: 'easeOut' }}
                style={{
                  height: '100%',
                  backgroundColor: color,
                  opacity: 0.8,
                }}
              />
            </div>

            {/* Value label */}
            <span style={{
              fontSize: '9px',
              fontWeight: 600,
              fontFamily: T.mono,
              color: color,
              minWidth: '50px',
              textAlign: 'right',
            }}>
              {fmtShift(value, 2)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ─── ContributingTrendItem ─────────────────────────────────────────────────

interface ContributingTrendItemProps {
  trend: Trend;
  index: number;
}

const ContributingTrendItem: React.FC<ContributingTrendItemProps> = ({ trend, index }) => {
  const trendColor = trend.direction === 'Expansion' ? T.green : T.red;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      style={{
        padding: '10px 12px',
        backgroundColor: T.bg1,
        borderRadius: '6px',
        border: `1px solid ${T.border1}`,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}
    >
      {/* Trend name + direction */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '11px',
          fontWeight: 500,
          color: T.text,
          marginBottom: '2px',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
        }}>
          {trend.name}
        </div>
        <div style={{
          fontSize: '9px',
          color: T.text2,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <span style={{ color: FORCE_COLORS[trend.force] }}>
            {FORCE_ICONS[trend.force]} {trend.force}
          </span>
          <span style={{ color: trendColor }}>
            {trend.direction === 'Expansion' ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* Score badge */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '4px',
        minWidth: '45px',
      }}>
        <div style={{
          fontSize: '10px',
          fontWeight: 600,
          fontFamily: T.mono,
          color: trend.score! > 0 ? T.green : trend.score! < 0 ? T.red : T.text2,
        }}>
          {fmtPct((trend.score || 0) / 25, 1)}
        </div>
        <div style={{
          fontSize: '8px',
          color: T.text3,
        }}>
          {trend.exposure_level ? `Exp: ${trend.exposure_level}` : '—'}
        </div>
      </div>
    </motion.div>
  );
};

// ─── CategoryDetailPanel ───────────────────────────────────────────────────

const CategoryDetailPanel: React.FC<CategoryDetailPanelProps> = ({
  data, categoryId, onClose, triggers, allocation,
}) => {
  const category = useMemo(() => {
    if (!categoryId || !data) return null;
    return data.categories?.find(c => c.id === categoryId) || {
      id: categoryId,
      name: categoryId,
    };
  }, [categoryId, data]);

  // ── Filter triggers to this category ─────────────────────────────
  // Triggers persist with `category` either as the display name
  // ("Hair: Color") or the snake_case id ("hair_color") depending on how
  // the CLI script wrote them. Match both shapes so nothing is silently
  // dropped.
  const catTriggers = useMemo(() => {
    if (!triggers || triggers.length === 0) return [];
    const displayName = category?.name;
    return triggers
      .filter((t) => t.category === displayName || t.category === categoryId)
      .sort((a, b) => {
        // Fired first (most urgent), then active by target_year ascending,
        // then dismissed at the bottom.
        const statusRank = (s: string): number =>
          s === 'fired' ? 0 : s === 'active' ? 1 : 2;
        const dr = statusRank(a.status) - statusRank(b.status);
        if (dr !== 0) return dr;
        return (a.target_year ?? 0) - (b.target_year ?? 0);
      });
  }, [triggers, category, categoryId]);

  // ── Resolve allocation stance for this category ───────────────────
  // The optimizer produces three disjoint lists — invest_more / defend /
  // harvest. A category may appear in exactly one (or none if the
  // optimizer didn't weight it). Matches both display name and id to
  // survive either persistence style.
  const allocStance = useMemo(() => {
    if (!allocation) return null;
    const key = category?.name ?? categoryId;
    const inList = (xs?: string[]): boolean =>
      !!xs && (xs.includes(key) || xs.includes(categoryId));
    if (inList(allocation.invest_more)) return 'invest_more';
    if (inList(allocation.defend)) return 'defend';
    if (inList(allocation.harvest)) return 'harvest';
    return null;
  }, [allocation, category, categoryId]);

  const allocWeight = useMemo(() => {
    if (!allocation?.weights) return null;
    const key = category?.name ?? categoryId;
    const w = allocation.weights[key] ?? allocation.weights[categoryId];
    return typeof w === 'number' && isFinite(w) ? w : null;
  }, [allocation, category, categoryId]);

  const pathData = useMemo(() => {
    if (!data?.shifts_path?.[categoryId]) return {};
    return data.shifts_path[categoryId];
  }, [data, categoryId]);

  const forceDecomposition = useMemo(() => {
    if (!data?.force_decomposition?.[categoryId]) {
      const emptyRecord: Record<ForceName, number> = {
        Consumer: 0,
        Customer: 0,
        Technology: 0,
        Government: 0,
        Environmental: 0,
        Competitive: 0,
      };
      return emptyRecord;
    }
    return (data.force_decomposition[categoryId] || {}) as Record<ForceName, number>;
  }, [data, categoryId]);

  const trendList = useMemo(() => {
    if (!data?.contributing_trends?.[categoryId]) return [];
    return data.contributing_trends[categoryId].sort((a, b) => Math.abs((b.score || 0)) - Math.abs((a.score || 0)));
  }, [data, categoryId]);

  // Compute 2030 shift
  const shift2030 = pathData[2030]?.median || 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 40,
      }}
    >
      {/* Panel slide-in from right */}
      <motion.div
        initial={{ x: 500, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 500, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '420px',
          height: '100vh',
          backgroundColor: T.bg2,
          borderLeft: `1px solid ${T.border1}`,
          boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 50,
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${T.border1}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 600,
              color: T.text,
            }}>
              {category?.name || 'Category'}
            </h3>
            <div style={{
              fontSize: '10px',
              color: T.text2,
              marginTop: '2px',
            }}>
              {category?.group || 'Detail View'}
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: T.bg3,
              border: `1px solid ${T.border1}`,
              color: T.text2,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 120ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = T.bg4;
              e.currentTarget.style.color = T.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = T.bg3;
              e.currentTarget.style.color = T.text2;
            }}
          >
            <X size={16} />
          </motion.button>
        </div>

        {/* KPI stats */}
        <div style={{
          padding: '16px 24px',
          borderBottom: `1px solid ${T.border1}`,
          display: 'flex',
          gap: '12px',
          flexShrink: 0,
        }}>
          <div style={{
            flex: 1,
            padding: '12px',
            backgroundColor: T.bg1,
            borderRadius: '6px',
            border: `1px solid ${T.border1}`,
          }}>
            <div style={{ fontSize: '9px', color: T.text2, marginBottom: '4px' }}>
              2030 Shift
            </div>
            <div style={{
              fontSize: '16px',
              fontWeight: 600,
              fontFamily: T.mono,
              color: shift2030 > 0 ? T.green : shift2030 < 0 ? T.red : T.text2,
            }}>
              {fmtShift(shift2030, 2)}
            </div>
          </div>
          <div style={{
            flex: 1,
            padding: '12px',
            backgroundColor: T.bg1,
            borderRadius: '6px',
            border: `1px solid ${T.border1}`,
          }}>
            <div style={{ fontSize: '9px', color: T.text2, marginBottom: '4px' }}>
              Contributing Trends
            </div>
            <div style={{
              fontSize: '16px',
              fontWeight: 600,
              color: T.text,
            }}>
              {trendList.length}
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}>
          {/* Mini path chart */}
          <div>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              color: T.text2,
              marginBottom: '10px',
            }}>
              Shift Path (2026–2030)
            </div>
            <MiniPathChart pathData={pathData} />
          </div>

          {/* Force decomposition */}
          <div>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              color: T.text2,
              marginBottom: '10px',
            }}>
              Force Decomposition
            </div>
            <ForceDecomposition decomposition={forceDecomposition} />
          </div>

          {/* Allocation recommendation — optional; surfaces the optimizer's
              stance (invest / defend / harvest) plus the weight if present. */}
          {(allocStance || allocWeight != null || allocation?.rationale) && (() => {
            const stanceMeta: Record<
              'invest_more' | 'defend' | 'harvest',
              { label: string; color: string; bg: string; Icon: LucideIcon }
            > = {
              invest_more: { label: 'Invest more', color: T.green, bg: T.greenDim, Icon: TrendingUp },
              defend:      { label: 'Defend',      color: T.accent, bg: T.accentDim, Icon: Shield },
              harvest:     { label: 'Harvest',     color: T.amber, bg: T.amberDim, Icon: ArrowDownCircle },
            };
            const meta = allocStance ? stanceMeta[allocStance] : null;
            const StanceIcon = meta?.Icon;
            return (
              <div>
                <div style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: T.text2,
                  marginBottom: '10px',
                }}>
                  Allocation Recommendation
                </div>
                <div style={{
                  padding: '12px 14px',
                  backgroundColor: T.bg1,
                  borderRadius: '8px',
                  border: `1px solid ${T.border1}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}>
                    {meta && StanceIcon ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '999px',
                        backgroundColor: meta.bg,
                        color: meta.color,
                        fontSize: '11px',
                        fontWeight: 600,
                      }}>
                        <StanceIcon size={12} />
                        {meta.label}
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '11px',
                        color: T.text3,
                        fontStyle: 'italic',
                      }}>
                        Not assigned by the optimizer
                      </span>
                    )}
                    {allocWeight != null && (
                      <span style={{
                        fontFamily: T.mono,
                        fontSize: '12px',
                        fontWeight: 600,
                        color: T.text,
                      }}>
                        {fmtPct(allocWeight, 1)}
                        <span style={{
                          fontSize: '9px',
                          color: T.text3,
                          fontWeight: 400,
                          marginLeft: '4px',
                        }}>
                          weight
                        </span>
                      </span>
                    )}
                  </div>
                  {allocation?.rationale && (
                    <p style={{
                      fontSize: '11px',
                      color: T.text2,
                      lineHeight: 1.5,
                      margin: 0,
                    }}>
                      {allocation.rationale}
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Trigger status — early-warning conditions wired to this category.
              Three states: fired (red), active (amber), dismissed (muted). */}
          {triggers && (
            <div>
              <div style={{
                fontSize: '11px',
                fontWeight: 600,
                color: T.text2,
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <Bell size={12} />
                Trigger Status
                {catTriggers.length > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: '9px',
                    color: T.text3,
                    fontWeight: 400,
                  }}>
                    {catTriggers.length} wired
                  </span>
                )}
              </div>
              {catTriggers.length === 0 ? (
                <div style={{
                  padding: '10px 12px',
                  backgroundColor: T.bg1,
                  borderRadius: '6px',
                  border: `1px dashed ${T.border1}`,
                  color: T.text3,
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <BellOff size={12} />
                  No triggers wired for this category
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {catTriggers.map((trig) => {
                    const isFired = trig.status === 'fired';
                    const isActive = trig.status === 'active';
                    const statusColor = isFired ? T.red : isActive ? T.amber : T.text3;
                    const statusBg = isFired ? T.redDim : isActive ? T.amberDim : T.bg3;
                    return (
                      <div
                        key={trig.id}
                        style={{
                          padding: '10px 12px',
                          backgroundColor: T.bg1,
                          borderRadius: '6px',
                          border: `1px solid ${T.border1}`,
                          borderLeft: `3px solid ${statusColor}`,
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          marginBottom: '4px',
                        }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 7px',
                            borderRadius: '999px',
                            backgroundColor: statusBg,
                            color: statusColor,
                            fontSize: '9px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}>
                            <AlertCircle size={9} />
                            {trig.status}
                          </span>
                          <span style={{
                            fontFamily: T.mono,
                            fontSize: '10px',
                            color: T.text2,
                          }}>
                            {trig.condition_type} {fmtShift(trig.threshold, 1)} · {trig.target_year}
                          </span>
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: T.text,
                          lineHeight: 1.5,
                        }}>
                          {trig.action_text}
                        </div>
                        {trig.fired_date && (
                          <div style={{
                            marginTop: '4px',
                            fontSize: '9px',
                            color: T.text3,
                            fontFamily: T.mono,
                          }}>
                            Fired {new Date(trig.fired_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Contributing trends */}
          {trendList.length > 0 && (
            <div>
              <div style={{
                fontSize: '11px',
                fontWeight: 600,
                color: T.text2,
                marginBottom: '10px',
              }}>
                Contributing Trends
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {trendList.map((trend, idx) => (
                  <ContributingTrendItem key={trend.id} trend={trend} index={idx} />
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CategoryDetailPanel;
