/**
 * PathTimeline — Continuous shift paths 2026→2030 with confidence bands.
 * Shows median ± 80% CI (p10/p90) for selected category or top 5–6 by magnitude.
 * Apple × Bain aesthetic: glass card, subtle grid, smooth curves, intentional whitespace.
 */

import { useMemo, FC } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { ShiftMatrix } from '@/types';
import { T, YEARS, CATEGORIES, fmtShift, shortCat, tooltipStyle } from '@/lib/format';

interface PathTimelineProps {
  shifts?: ShiftMatrix | null;
  selectedCategory?: string | null;
  triggers?: Array<{ category: string; target_year: number; threshold: number; action_text: string; status: string }>;
  competitiveOverlay?: Record<string, Record<string, number>> | null;
}

interface ChartDataPoint {
  year: string;
  [key: string]: string | number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    color: string;
    name: string;
  }>;
  label?: string | number;
}

/**
 * Custom tooltip matching design system tokens.
 */
function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const tooltipContent = payload.map((entry, i) => {
    const { value, color, name } = entry;
    return (
      <div key={i} style={{ fontSize: 11, marginBottom: i < payload.length - 1 ? 4 : 0 }}>
        <span style={{ color: T.text2 }}>{name}: </span>
        <span style={{ color, fontFamily: T.mono, fontWeight: 600 }}>
          {fmtShift(value, 2)}
        </span>
      </div>
    );
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15 }}
      style={{
        ...tooltipStyle,
        background: T.bg1,
        borderColor: T.border2,
      } as React.CSSProperties}
    >
      <div style={{ fontSize: 10, color: T.text2, marginBottom: 6, fontWeight: 500 }}>
        FY {label}
      </div>
      {tooltipContent}
    </motion.div>
  );
}

/**
 * Extract path data from various structures: { year: shift } or { p50: { year: shift } }.
 */
function extractPath(
  catData: unknown
): Record<number, number> {
  const result: Record<number, number> = {};
  if (!catData) return result;

  YEARS.forEach(y => {
    const key = String(y);

    // Direct value
    if (typeof catData === 'number') {
      result[y] = catData;
      return;
    }

    const dataObj = catData as Record<string, unknown>;

    // Nested structure: catData[year] or catData.p50[year] or catData.median[year]
    if (dataObj[key] != null) {
      result[y] = dataObj[key] as number;
      return;
    }

    if (dataObj.p50 && typeof dataObj.p50 === 'object') {
      const p50 = dataObj.p50 as Record<string, number>;
      if (p50[key] != null) {
        result[y] = p50[key];
        return;
      }
    }

    if (dataObj.median && typeof dataObj.median === 'object') {
      const median = dataObj.median as Record<string, number>;
      if (median[key] != null) {
        result[y] = median[key];
        return;
      }
    }

    // Fallback
    result[y] = 0;
  });

  return result;
}

/**
 * Extract confidence band (p10/p90) from shift data.
 */
function extractBand(
  catData: unknown,
  percentile: 'p10' | 'p90' = 'p90'
): Record<number, number> {
  const result: Record<number, number> = {};
  if (!catData) return result;

  const dataObj = catData as Record<string, unknown>;

  YEARS.forEach(y => {
    const key = String(y);

    if (dataObj[percentile] && typeof dataObj[percentile] === 'object') {
      const band = dataObj[percentile] as Record<string, number>;
      if (band[key] != null) {
        result[y] = band[key];
      } else {
        result[y] = 0;
      }
    } else {
      result[y] = 0;
    }
  });

  return result;
}

const PathTimeline: FC<PathTimelineProps> = ({ shifts = null, selectedCategory = null, triggers = [], competitiveOverlay = null }) => {
  const { chartData, visibleCategories, categoryName } = useMemo(() => {
    if (!shifts || !shifts || typeof shifts !== 'object') {
      return { chartData: [], visibleCategories: [], categoryName: null };
    }

    const shiftsObj = shifts as Record<string, unknown>;
    const allCats = Object.keys(shiftsObj);

    // Determine which categories to show
    let catsToShow = allCats;
    if (selectedCategory) {
      catsToShow = [selectedCategory];
    } else {
      // Top 5–6 by absolute shift magnitude at 2030
      const byMagnitude = allCats
        .map(cat => {
          const path = extractPath(shiftsObj[cat]);
          const val2030 = path[2030] || 0;
          return { cat, magnitude: Math.abs(val2030) };
        })
        .sort((a, b) => b.magnitude - a.magnitude)
        .slice(0, 6)
        .map(x => x.cat);
      catsToShow = byMagnitude;
    }

    // Build chart data points: year → { year, [cat_median]: val, [cat_p10]: val, [cat_p90]: val }
    const points: ChartDataPoint[] = YEARS.map(year => {
      const point: ChartDataPoint = { year: String(year) };
      catsToShow.forEach(cat => {
        const path = extractPath(shiftsObj[cat]);
        const p10Band = extractBand(shiftsObj[cat], 'p10');
        const p90Band = extractBand(shiftsObj[cat], 'p90');

        point[`${cat}_median`] = path[year] || 0;
        point[`${cat}_p10`] = p10Band[year] || 0;
        point[`${cat}_p90`] = p90Band[year] || 0;
      });
      return point;
    });

    const selectedCatObj = selectedCategory
      ? CATEGORIES.find(c => c.id === selectedCategory)
      : null;

    return {
      chartData: points,
      visibleCategories: catsToShow,
      categoryName: selectedCatObj?.name || null,
    };
  }, [shifts, selectedCategory]);

  if (chartData.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          background: T.bg2,
          border: `1px solid ${T.border1}`,
          borderRadius: 16,
          backdropFilter: 'blur(20px)',
          padding: 32,
          textAlign: 'center',
        } as React.CSSProperties}
      >
        <p style={{ color: T.text2, fontSize: 13 }}>
          Run a simulation to see path trajectories
        </p>
      </motion.div>
    );
  }

  // Color palette for categories
  const catColors = [
    '#3B82F6',
    '#A78BFA',
    '#22D3EE',
    '#FBBF24',
    '#34D399',
    '#F87171',
    '#FB923C',
    '#8B5CF6',
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        background: T.bg2,
        border: `1px solid ${T.border1}`,
        borderRadius: 16,
        backdropFilter: 'blur(20px)',
        padding: '24px 20px',
      } as React.CSSProperties}
    >
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: T.text2,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 4,
          }}
        >
          Path — {categoryName ? shortCat(categoryName) : 'Material Categories'}
        </div>
        <div
          style={{
            fontSize: 11,
            color: T.text3,
            fontFamily: T.mono,
          }}
        >
          median ± 80% CI (p10 – p90)
          {!selectedCategory &&
            visibleCategories.length < Object.keys(shifts || {}).length && (
              <span style={{ marginLeft: 8 }}>
                · {visibleCategories.length} of {Object.keys(shifts || {}).length} shown
              </span>
            )}
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: 220, marginBottom: 12 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 4, right: 16, bottom: 4, left: 40 }}
          >
            <defs>
              {visibleCategories.map((cat, i) => {
                const color = catColors[i % catColors.length];
                return (
                  <linearGradient
                    key={`grad-${cat}`}
                    id={`gradArea-${cat}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.01} />
                  </linearGradient>
                );
              })}
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke={T.border}
              vertical={true}
              horizontalPoints={[0]}
            />

            <XAxis
              dataKey="year"
              tick={{ fill: T.text3, fontSize: 11 }}
              axisLine={{ stroke: T.border1 }}
              style={{ fontFamily: T.mono }}
            />

            <YAxis
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              tick={{ fill: T.text3, fontSize: 11 }}
              axisLine={{ stroke: T.border1 }}
              width={40}
              style={{ fontFamily: T.mono }}
            />

            {/* Zero reference line */}
            <ReferenceLine y={0} stroke={T.border1} strokeDasharray="2 2" />

            {/* Render areas and lines for each visible category */}
            {visibleCategories.map((cat, i) => {
              const color = catColors[i % catColors.length];
              const catLabel = shortCat(
                CATEGORIES.find(c => c.id === cat)?.name || cat
              );

              return (
                <g key={`group-${cat}`}>
                  {/* Lower bound (invisible base for stacking) */}
                  <Area
                    type="monotone"
                    dataKey={`${cat}_p10`}
                    stackId={`band-${cat}`}
                    fill="transparent"
                    stroke="none"
                    isAnimationActive={true}
                    dot={false}
                  />
                  {/* Upper bound minus lower = visible band between p10 and p90 */}
                  <Area
                    type="monotone"
                    dataKey={(d: Record<string, number>) => {
                      const p90 = d[`${cat}_p90`] || 0;
                      const p10 = d[`${cat}_p10`] || 0;
                      return p90 - p10;
                    }}
                    stackId={`band-${cat}`}
                    fill={color}
                    fillOpacity={0.12}
                    stroke="none"
                    isAnimationActive={true}
                    dot={false}
                    name={`${catLabel} CI`}
                  />
                  {/* p10 dashed line */}
                  <Line
                    type="monotone"
                    dataKey={`${cat}_p10`}
                    stroke={color}
                    strokeWidth={1}
                    strokeDasharray="4 3"
                    dot={false}
                    isAnimationActive={true}
                    legendType="none"
                  />
                  {/* p90 dashed line */}
                  <Line
                    type="monotone"
                    dataKey={`${cat}_p90`}
                    stroke={color}
                    strokeWidth={1}
                    strokeDasharray="4 3"
                    dot={false}
                    isAnimationActive={true}
                    legendType="none"
                  />
                  {/* Median line (solid) */}
                  <Line
                    type="monotone"
                    dataKey={`${cat}_median`}
                    name={catLabel}
                    stroke={color}
                    strokeWidth={selectedCategory === cat ? 3 : 2}
                    dot={false}
                    activeDot={{ r: 5, fill: color, stroke: T.bg, strokeWidth: 2 }}
                    isAnimationActive={true}
                  />
                </g>
              );
            })}

            <Tooltip content={<CustomTooltip />} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          paddingTop: 8,
          borderTop: `1px solid ${T.border}`,
        }}
      >
        {visibleCategories.map((cat, i) => {
          const color = catColors[i % catColors.length];
          const catLabel = shortCat(CATEGORIES.find(c => c.id === cat)?.name || cat);
          return (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: color,
                }}
              />
              <span style={{ fontSize: 10, color: T.text2, fontFamily: T.mono }}>
                {catLabel}
              </span>
            </div>
          );
        })}
      </div>

      {/* Velocity Indicators */}
      {visibleCategories.length > 0 && (
        <div style={{
          display: 'flex', gap: 16, paddingTop: 12, marginTop: 8,
          borderTop: `1px solid ${T.border}`,
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: T.text3 }}>
            Velocity (YoY Δ)
          </div>
          {visibleCategories.slice(0, 4).map((cat, i) => {
            const path = extractPath((shifts as Record<string, unknown>)?.[cat]);
            const v2029 = (path[2030] || 0) - (path[2029] || 0);
            const accel = v2029 - ((path[2029] || 0) - (path[2028] || 0));
            const color = catColors[i % catColors.length];
            const catLabel = shortCat(CATEGORIES.find(c => c.id === cat)?.name || cat);
            return (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: 10, color: T.text2, fontFamily: T.mono }}>
                  {catLabel}: {v2029 >= 0 ? '+' : ''}{(v2029 * 100).toFixed(1)}%
                  <span style={{ color: accel > 0 ? T.red : T.green, marginLeft: 2 }}>
                    {accel > 0.001 ? '↑' : accel < -0.001 ? '↓' : '→'}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Early-Warning Triggers */}
      {triggers && triggers.length > 0 && (
        <div style={{
          marginTop: 12, padding: '8px 12px',
          background: 'rgba(255, 159, 10, 0.06)',
          border: '1px solid rgba(255, 159, 10, 0.15)',
          borderRadius: 8,
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#FF9F0A', marginBottom: 4 }}>
            TRIGGER ALERTS
          </div>
          {triggers.filter(t => t.status === 'fired' || t.status === 'active').slice(0, 3).map((t, i) => (
            <div key={i} style={{ fontSize: 10, color: T.text2, marginTop: 2 }}>
              {t.status === 'fired' ? '🔴' : '🟡'} {t.category}: {t.action_text} (by {t.target_year})
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default PathTimeline;
