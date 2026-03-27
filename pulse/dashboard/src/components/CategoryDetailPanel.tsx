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
import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import {
  AreaChart, Area, Line, ComposedChart, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { T, FORCES, FORCE_COLORS, FORCE_ICONS, YEARS, fmtShift, fmtPct, shortCat } from '../lib/format';
import type { ForceName, ProjectionYear } from '../types';

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
  impact?: number;
  probability?: number;
  description?: string;
  strategic_implication?: string;
  sources?: Array<{ title: string; url: string; data?: string }>;
  category_exposure?: Record<string, number>;
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

// ─── ContributingTrendItem (Clickable / Expandable) ───────────────────────

interface ContributingTrendItemProps {
  trend: Trend;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}

const ContributingTrendItem: React.FC<ContributingTrendItemProps> = ({ trend, index, isExpanded, onToggle }) => {
  const trendColor = trend.direction === 'Expansion' ? T.green : T.red;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      style={{
        backgroundColor: T.bg1,
        borderRadius: '8px',
        border: `1px solid ${isExpanded ? T.accent + '40' : T.border1}`,
        overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Clickable header */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '10px 12px',
          textAlign: 'left',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = T.bg3 + '60'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
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
            color: (trend.score || 0) > 0 ? T.green : (trend.score || 0) < 0 ? T.red : T.text2,
          }}>
            {fmtPct((trend.score || 0) / 25, 1)}
          </div>
          <div style={{
            fontSize: '8px',
            color: T.text3,
          }}>
            {trend.exposure_level ? `Exp: ${trend.exposure_level}/5` : '—'}
          </div>
        </div>

        {/* Chevron */}
        <div style={{ color: T.text3 }}>
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '0 12px 12px',
              borderTop: `1px solid ${T.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              paddingTop: '10px',
            }}>
              {/* Impact × Probability */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{
                  flex: 1,
                  padding: '6px 8px',
                  backgroundColor: T.bg3 + '60',
                  borderRadius: '4px',
                }}>
                  <div style={{ fontSize: '8px', color: T.text3, marginBottom: '2px' }}>Impact</div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: T.text, fontFamily: T.mono }}>
                    {trend.impact || '—'}/5
                  </div>
                </div>
                <div style={{
                  flex: 1,
                  padding: '6px 8px',
                  backgroundColor: T.bg3 + '60',
                  borderRadius: '4px',
                }}>
                  <div style={{ fontSize: '8px', color: T.text3, marginBottom: '2px' }}>Probability</div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: T.text, fontFamily: T.mono }}>
                    {trend.probability || '—'}/5
                  </div>
                </div>
                <div style={{
                  flex: 1,
                  padding: '6px 8px',
                  backgroundColor: T.bg3 + '60',
                  borderRadius: '4px',
                }}>
                  <div style={{ fontSize: '8px', color: T.text3, marginBottom: '2px' }}>Direction</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: trendColor }}>
                    {trend.direction}
                  </div>
                </div>
              </div>

              {/* Description */}
              {trend.description && (
                <div>
                  <div style={{ fontSize: '9px', fontWeight: 600, color: T.text2, marginBottom: '4px', textTransform: 'uppercase' }}>
                    Evidence
                  </div>
                  <p style={{ fontSize: '10px', color: T.text2, lineHeight: 1.5, margin: 0 }}>
                    {trend.description}
                  </p>
                </div>
              )}

              {/* Strategic Implication */}
              {trend.strategic_implication && (
                <div>
                  <div style={{ fontSize: '9px', fontWeight: 600, color: T.text2, marginBottom: '4px', textTransform: 'uppercase' }}>
                    Strategic Implication
                  </div>
                  <p style={{ fontSize: '10px', color: T.accent, lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                    {trend.strategic_implication}
                  </p>
                </div>
              )}

              {/* Sources */}
              {trend.sources && trend.sources.length > 0 && (
                <div>
                  <div style={{ fontSize: '9px', fontWeight: 600, color: T.text2, marginBottom: '4px', textTransform: 'uppercase' }}>
                    Sources
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {trend.sources.map((src, i) => (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '9px',
                          color: T.accent,
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                      >
                        <ExternalLink size={9} />
                        {src.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── CategoryDetailPanel ───────────────────────────────────────────────────

const CategoryDetailPanel: React.FC<CategoryDetailPanelProps> = ({ data, categoryId, onClose }) => {
  const [expandedTrend, setExpandedTrend] = useState<string | null>(null);

  const category = useMemo(() => {
    if (!categoryId || !data) return null;
    return data.categories?.find(c => c.id === categoryId) || {
      id: categoryId,
      name: categoryId,
    };
  }, [categoryId, data]);

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
                  <ContributingTrendItem
                    key={trend.id}
                    trend={trend}
                    index={idx}
                    isExpanded={expandedTrend === trend.id}
                    onToggle={() => setExpandedTrend(expandedTrend === trend.id ? null : trend.id)}
                  />
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
