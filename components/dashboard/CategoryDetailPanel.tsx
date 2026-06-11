/**
 * CategoryDetailPanel — Editorial Intelligence drill-down drawer.
 *
 * Redesign (April 2026) — palette, typography and card rhythm now match
 * `ProfitPoolAnalysis2.tsx` exactly, so clicking a category row and landing
 * in the drawer feels like the same surface, not a dark pop-out.
 *
 * Design language:
 *   • Soft blue-on-white palette (S tokens, mirrored from ProfitPoolAnalysis2)
 *   • Manrope headline + Inter body, JetBrains Mono for numbers
 *   • White rounded-2xl surfaces on a light surfaceLow drawer background
 *   • Soft editorial shadows (0 4px 60px -15px rgba(0,52,94,0.08))
 *   • Green rgba(34,197,94) / Red rgba(239,68,68) for expansion / contraction
 *     — identical to matrix cell palette
 *   • Backdrop: soft navy overlay (rgba(0,52,94,0.22)) with backdrop blur,
 *     replacing the old black 50% backdrop that felt jarring on a light page
 *
 * Content (unchanged from v1):
 *   • Fan chart — p10/p90 band + median line across 2026–2035
 *   • Force decomposition — horizontal bars at the selected year
 *   • Contributing trends — list with force tag and direction
 */
import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Activity, Zap, Layers, LineChart, ArrowUpRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Area, Line, ComposedChart, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { FORCES, FORCE_COLORS, YEARS, fmtShift, fmtPct } from '@/lib/format';
import type { ForceName, ProjectionYear } from '@/types';

// ─── Editorial design tokens — identical to ProfitPoolAnalysis2 ──────
const S = {
  bg:                 '#f8f9ff',
  surface:            '#ffffff',
  surfaceLow:         '#eff4ff',
  surfaceContainer:   '#e5eeff',
  surfaceHigh:        '#dce9ff',
  surfaceHighest:     '#d2e4ff',
  primary:            '#005db5',
  primaryDim:         '#0052a0',
  primaryContainer:   '#d6e3ff',
  onPrimaryContainer: '#00519e',
  onBg:               '#00345e',
  onSurface:          '#00345e',
  onSurfaceVariant:   '#26619d',
  secondaryContainer: '#d5e3fc',
  onSecondaryContainer:'#455367',
  tertiaryContainer:  '#dae2fd',
  onTertiaryContainer:'#4a5167',
  error:              '#9f403d',
  errorContainer:     '#fde2e1',
  onErrorContainer:   '#752121',
  outline:            '#477dbb',
  outlineVariant:     '#81b5f6',
  cardBorder:         'rgba(0, 52, 94, 0.10)',
  cardBorderStrong:   'rgba(0, 52, 94, 0.16)',
  mutedText:          '#64748B',
  // Semantic accents — matched to ProfitPoolAnalysis2 cell fills
  expansion:          'rgb(31, 122, 61)',
  expansionDim:       'rgba(31, 122, 61, 0.14)',
  expansionInk:       '#0f5132',
  contraction:        'rgb(159, 64, 61)',
  contractionDim:     'rgba(159, 64, 61, 0.14)',
  contractionInk:     '#6a2a27',
  amber:              '#b45309',
  amberDim:           'rgba(180, 83, 9, 0.12)',
};

const HEADLINE_FONT = "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const BODY_FONT     = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO_FONT     = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

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
  /** Scaled contribution to the MC terminal shift (percentage points, signed). */
  contribution?: number;
  /** Pre-scaling contribution = gp1_shift x (exposure/5), for auditing. */
  raw_contribution?: number;
  /** Absolute share of the category's explained movement (0..1). */
  attribution_share?: number;
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
  /** Drill-through to the Trends tab: receives the trend NAME (used as the
      Trends search query — same contract as the Consumer Journey evidence
      cards). When provided, every contributing-trend row becomes a link. */
  onOpenTrend?: (name: string) => void;
}

interface ChartDataPoint {
  year: ProjectionYear;
  median: number;
  p10: number;
  p90: number;
}

// ─── Section — Editorial card wrapper with uppercase header ──────────

interface SectionProps {
  title: string;
  icon?: LucideIcon;
  trailing?: React.ReactNode;
  children: React.ReactNode;
  noPadding?: boolean;
}

const Section: React.FC<SectionProps> = ({ title, icon: Icon, trailing, children, noPadding }) => (
  <section
    style={{
      backgroundColor: S.surface,
      borderRadius: 16,
      boxShadow: '0 4px 60px -15px rgba(0, 52, 94, 0.08)',
      overflow: 'hidden',
    }}
  >
    <header
      style={{
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        backgroundColor: S.surfaceLow,
        color: S.onSurfaceVariant,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        fontFamily: HEADLINE_FONT,
      }}
    >
      {Icon && <Icon size={13} strokeWidth={2.4} />}
      <span>{title}</span>
      {trailing && <div style={{ marginLeft: 'auto' }}>{trailing}</div>}
    </header>
    <div style={{ padding: noPadding ? 0 : '16px 18px' }}>{children}</div>
  </section>
);

// ─── MiniPathChart ────────────────────────────────────────────────────────

interface MiniPathChartProps {
  pathData: PathData;
}

const MiniPathChart: React.FC<MiniPathChartProps> = ({ pathData }) => {
  if (!pathData || Object.keys(pathData).length === 0) {
    return (
      <div
        style={{
          height: 280,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: S.mutedText,
          fontSize: 12,
          fontFamily: BODY_FONT,
          backgroundColor: S.surfaceLow,
          borderRadius: 10,
        }}
      >
        No path data available
      </div>
    );
  }

  const chartData: ChartDataPoint[] = YEARS.map((year) => ({
    year: year as ProjectionYear,
    median: pathData[year]?.median ?? 0,
    p10: pathData[year]?.p10 ?? pathData[year]?.median ?? 0,
    p90: pathData[year]?.p90 ?? pathData[year]?.median ?? 0,
  }));

  const maxAbs = Math.max(
    ...chartData.map((d) => Math.max(Math.abs(d.p10), Math.abs(d.p90), Math.abs(d.median))),
    0.01,
  );
  const yAxisDomain: [number, number] = [-maxAbs * 1.15, maxAbs * 1.15];

  return (
    <div style={{ height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ left: 0, right: 8, top: 6, bottom: 0 }}>
          <defs>
            <linearGradient id="confidenceBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={S.primary} stopOpacity={0.28} />
              <stop offset="100%" stopColor={S.primary} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="2 3"
            stroke={S.cardBorder}
            horizontal
            vertical={false}
          />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 10, fill: S.onSurfaceVariant, fontFamily: BODY_FONT }}
            axisLine={{ stroke: S.cardBorder }}
            tickLine={false}
            interval={0}
          />
          <YAxis
            domain={yAxisDomain}
            tick={{ fontSize: 10, fill: S.onSurfaceVariant, fontFamily: MONO_FONT }}
            axisLine={{ stroke: S.cardBorder }}
            tickLine={false}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            width={38}
          />
          <Tooltip
            cursor={{ stroke: S.primary, strokeDasharray: '2 3', strokeOpacity: 0.5 }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0]?.payload as ChartDataPoint;
              const medColor = d.median > 0 ? S.expansion : d.median < 0 ? S.contraction : S.onSurfaceVariant;
              return (
                <div
                  style={{
                    backgroundColor: S.onSurface,
                    color: '#fff',
                    borderRadius: 10,
                    padding: '9px 12px',
                    fontSize: 11,
                    fontFamily: BODY_FONT,
                    boxShadow: '0 12px 32px -8px rgba(0, 52, 94, 0.32)',
                    minWidth: 148,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      opacity: 0.7,
                      fontFamily: HEADLINE_FONT,
                      fontWeight: 700,
                      marginBottom: 5,
                    }}
                  >
                    {d.year}
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr',
                      columnGap: 12,
                      rowGap: 2,
                      alignItems: 'baseline',
                    }}
                  >
                    <span style={{ opacity: 0.72 }}>Median</span>
                    <span
                      style={{
                        fontFamily: MONO_FONT,
                        fontWeight: 700,
                        textAlign: 'right',
                        color: medColor,
                      }}
                    >
                      {fmtShift(d.median, 1)}
                    </span>
                    <span style={{ opacity: 0.72 }}>P10</span>
                    <span style={{ fontFamily: MONO_FONT, textAlign: 'right' }}>
                      {fmtShift(d.p10, 1)}
                    </span>
                    <span style={{ opacity: 0.72 }}>P90</span>
                    <span style={{ fontFamily: MONO_FONT, textAlign: 'right' }}>
                      {fmtShift(d.p90, 1)}
                    </span>
                  </div>
                </div>
              );
            }}
          />
          {/* Confidence band: p10 to p90 */}
          <Area
            type="monotone"
            dataKey="p10"
            stackId="band"
            stroke="none"
            fill={S.primary}
            fillOpacity={0.05}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey={(d: ChartDataPoint) => d.p90 - d.p10}
            stackId="band"
            stroke="none"
            fill="url(#confidenceBand)"
            isAnimationActive={false}
          />
          {/* Median line */}
          <Line
            type="monotone"
            dataKey="median"
            stroke={S.primary}
            strokeWidth={2.4}
            dot={{ r: 2.5, fill: S.primary, strokeWidth: 0 }}
            activeDot={{ r: 4, fill: S.primary, stroke: '#fff', strokeWidth: 2 }}
            isAnimationActive
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
      <div style={{ fontSize: 12, color: S.mutedText, fontFamily: BODY_FONT }}>
        No decomposition data available
      </div>
    );
  }

  const forces = Object.keys(decomposition)
    .filter((f): f is ForceName => (decomposition[f as ForceName] ?? 0) !== 0)
    .sort(
      (a, b) =>
        Math.abs(decomposition[b as ForceName]) - Math.abs(decomposition[a as ForceName]),
    );

  if (forces.length === 0) {
    return (
      <div style={{ fontSize: 12, color: S.mutedText, fontFamily: BODY_FONT }}>
        No force contributions detected
      </div>
    );
  }

  const maxAbs = Math.max(...forces.map((f) => Math.abs(decomposition[f])));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {forces.map((force) => {
        const value = decomposition[force];
        const pct = maxAbs > 0 ? Math.abs(value) / maxAbs : 0;
        const isPositive = value > 0;
        const barColor = isPositive ? S.expansion : S.contraction;
        const valueInk = isPositive ? S.expansionInk : S.contractionInk;
        const forceDef = FORCES[force];

        return (
          <div
            key={force}
            style={{
              display: 'grid',
              gridTemplateColumns: '110px 1fr 62px',
              alignItems: 'center',
              columnGap: 10,
            }}
          >
            {/* Force label */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                color: S.onSurface,
                fontFamily: BODY_FONT,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: FORCE_COLORS[force] ?? forceDef?.color ?? S.primary,
                  flexShrink: 0,
                }}
              />
              {force}
            </div>

            {/* Bar */}
            <div
              style={{
                height: 8,
                backgroundColor: S.surfaceLow,
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct * 100}%` }}
                transition={{ delay: 0.15, duration: 0.55, ease: 'easeOut' }}
                style={{
                  height: '100%',
                  backgroundColor: barColor,
                  borderRadius: 4,
                  opacity: 0.88,
                }}
              />
            </div>

            {/* Value */}
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                fontFamily: MONO_FONT,
                color: valueInk,
                textAlign: 'right',
              }}
            >
              {fmtShift(value, 1)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ─── TrendCard — Bain-grade attribution row ──────────────────────────────
//
// Each card answers one question a Bain partner would ask in a matrix read-out:
//
//   "This trend — in one glance — how big is it, which way, and does it matter?"
//
// Hero metric is attribution_share (|scaled| / Σ|scaled|, sums to 100% across
// the category's contributing trends). This is what turns a wall of 0.0% noise
// into a decision-ready ranking. Secondary metric is the signed contribution in
// percentage points of MC terminal shift — same units as the matrix cell.
interface TrendCardProps {
  trend: Trend;
  index: number;
  rank: number;
  /** When provided, the card is a link into the Trends explorer. */
  onOpen?: () => void;
}

const TrendCard: React.FC<TrendCardProps> = ({ trend, index, rank, onOpen }) => {
  const [hovered, setHovered] = useState(false);
  const contribution = trend.contribution ?? 0;
  const share = trend.attribution_share ?? 0;
  const isExpansion = contribution !== 0
    ? contribution > 0
    : trend.direction === 'Expansion';
  const dirColor = isExpansion ? S.expansion : S.contraction;
  const dirBg = isExpansion ? S.expansionDim : S.contractionDim;
  const dirInk = isExpansion ? S.expansionInk : S.contractionInk;
  const forceColor = FORCE_COLORS[trend.force] ?? S.primary;

  // Width of the inline share bar (cap at 100%, floor at 2% so non-zero trends
  // are still visible even when they're tiny relative to the top driver).
  const barWidth = share > 0 ? Math.max(2, Math.min(100, share * 100)) : 0;
  const shareLabel = share > 0 ? fmtPct(share, share >= 0.1 ? 0 : 1) : '—';
  const contribLabel = contribution !== 0 ? fmtShift(contribution, 1) : '—';

  const interactive = !!onOpen;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25, ease: 'easeOut' }}
      onClick={onOpen}
      onMouseEnter={interactive ? () => setHovered(true) : undefined}
      onMouseLeave={interactive ? () => setHovered(false) : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `Open "${trend.name}" in the Trends explorer` : undefined}
      onKeyDown={interactive ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(); }
      } : undefined}
      style={{
        padding: '12px 14px',
        backgroundColor: S.surface,
        borderRadius: 12,
        border: `1px solid ${hovered ? S.primary : S.cardBorder}`,
        boxShadow: hovered ? '0 6px 20px -8px rgba(0, 93, 181, 0.35)' : 'none',
        display: 'grid',
        gridTemplateColumns: interactive ? '28px 1fr auto 18px' : '28px 1fr auto',
        columnGap: 12,
        alignItems: 'center',
        cursor: interactive ? 'pointer' : 'default',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      {/* Rank */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          backgroundColor: rank <= 5 ? S.primaryContainer : S.surfaceLow,
          color: rank <= 5 ? S.onPrimaryContainer : S.onSurfaceVariant,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: MONO_FONT,
          fontSize: 11.5,
          fontWeight: 700,
        }}
      >
        {rank}
      </div>

      {/* Body */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: S.onSurface,
            fontFamily: BODY_FONT,
            lineHeight: 1.3,
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
          }}
          title={trend.name}
        >
          {trend.name}
        </div>

        {/* Meta row: force tag + exposure chip + direction pill */}
        <div
          style={{
            marginTop: 4,
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            fontSize: 10.5,
            color: S.onSurfaceVariant,
            fontFamily: BODY_FONT,
          }}
        >
          <span style={{ color: forceColor, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: forceColor, display: 'inline-block', flexShrink: 0 }} />
            {trend.force}
          </span>
          {trend.exposure_level != null && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '1px 7px',
                borderRadius: 999,
                backgroundColor: S.surfaceLow,
                color: S.onSurfaceVariant,
                fontSize: 9.5,
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Exposure {trend.exposure_level}/5
            </span>
          )}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '1px 7px',
              borderRadius: 999,
              backgroundColor: dirBg,
              color: dirInk,
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {isExpansion ? '▲' : '▼'} {isExpansion ? 'Expansion' : 'Contraction'}
          </span>
        </div>

        {/* Share bar */}
        <div
          style={{
            marginTop: 8,
            height: 4,
            borderRadius: 2,
            backgroundColor: S.surfaceLow,
            overflow: 'hidden',
          }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${barWidth}%` }}
            transition={{ delay: 0.08 + index * 0.02, duration: 0.5, ease: 'easeOut' }}
            style={{
              height: '100%',
              backgroundColor: dirColor,
              opacity: 0.82,
              borderRadius: 2,
            }}
          />
        </div>
      </div>

      {/* Hero metrics */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 2,
          minWidth: 68,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            fontFamily: MONO_FONT,
            color: dirColor,
            lineHeight: 1,
            letterSpacing: '-0.01em',
          }}
        >
          {shareLabel}
        </div>
        <div
          style={{
            fontSize: 10,
            color: S.mutedText,
            fontFamily: MONO_FONT,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          of movement
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 10.5,
            color: S.onSurfaceVariant,
            fontFamily: MONO_FONT,
            fontWeight: 600,
          }}
        >
          {contribLabel}
        </div>
      </div>

      {/* Link affordance — the card opens this trend in the Trends explorer */}
      {interactive && (
        <ArrowUpRight
          size={15}
          strokeWidth={2.4}
          aria-hidden
          style={{
            color: S.primary,
            opacity: hovered ? 1 : 0.4,
            transition: 'opacity 0.15s ease',
            flexShrink: 0,
          }}
        />
      )}
    </motion.div>
  );
};

// ─── CategoryDetailPanel ───────────────────────────────────────────────────

const CategoryDetailPanel: React.FC<CategoryDetailPanelProps> = ({
  data, categoryId, onClose, onOpenTrend,
}) => {
  const category = useMemo(() => {
    if (!categoryId || !data) return null;
    return (
      data.categories?.find((c) => c.id === categoryId) ?? { id: categoryId, name: categoryId }
    );
  }, [categoryId, data]);

  // ─── Path Δ hover tooltip state ──────────────────────────────────
  // Mirrors the Matrix cell-tooltip pattern in ProfitPoolAnalysis2: track
  // the cursor anchor (top-center of the KPI tile) and render a fixed-
  // positioned, navy/white tooltip with the same shadow + arrow language
  // so the design is consistent across the dashboard.
  const [pathHover, setPathHover] = useState<{ x: number; y: number } | null>(null);

  const pathData: PathData = useMemo(() => {
    if (!data?.shifts_path?.[categoryId]) return {};
    return data.shifts_path[categoryId];
  }, [data, categoryId]);

  const forceDecomposition = useMemo<Record<ForceName, number>>(() => {
    const empty: Record<ForceName, number> = {
      Consumer: 0, Customer: 0, Technology: 0,
      Government: 0, Environmental: 0, Competitive: 0,
    };
    if (!data?.force_decomposition?.[categoryId]) return empty;
    return data.force_decomposition[categoryId] as Record<ForceName, number>;
  }, [data, categoryId]);

  const trendList = useMemo<Trend[]>(() => {
    if (!data?.contributing_trends?.[categoryId]) return [];
    // Rank by |scaled contribution| primarily; fall back to |score| when
    // the scaled attribution field isn't populated (legacy data).
    return [...data.contributing_trends[categoryId]].sort((a, b) => {
      const ca = Math.abs(a.contribution ?? 0);
      const cb = Math.abs(b.contribution ?? 0);
      if (Math.abs(ca - cb) > 1e-9) return cb - ca;
      return Math.abs(b.score ?? 0) - Math.abs(a.score ?? 0);
    });
  }, [data, categoryId]);

  // Aggregates for the Contributing Trends section header and narrative.
  const totalAttribution = useMemo(() => {
    return trendList.reduce((acc, t) => acc + Math.abs(t.contribution ?? 0), 0);
  }, [trendList]);
  const topShare = useMemo(() => {
    const topN = Math.min(5, trendList.length);
    if (totalAttribution <= 1e-9) return 0;
    const sumTop = trendList.slice(0, topN).reduce(
      (acc, t) => acc + Math.abs(t.contribution ?? 0),
      0,
    );
    return sumTop / totalAttribution;
  }, [trendList, totalAttribution]);
  // Horizon endpoints — summary KPIs
  const horizonEnd = YEARS[YEARS.length - 1];
  const horizonStart = YEARS[0];
  const shiftEnd = pathData[horizonEnd!]?.median ?? 0;
  const shiftStart = pathData[horizonStart!]?.median ?? 0;
  const velocity = shiftEnd - shiftStart;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        // top = 64px keeps the global sticky nav (h-16) visible and
        // interactive while the full-screen drill-down is open.
        position: 'fixed',
        top: 64,
        right: 0,
        bottom: 0,
        left: 0,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: 'rgba(0, 52, 94, 0.34)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 40,
        fontFamily: BODY_FONT,
      }}
    >
      {/* Full-page modal — fills the viewport below the global nav.
          The drill-down is a destination, not a side drawer. */}
      <motion.aside
        initial={{ opacity: 0, scale: 0.985, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.985, y: 8 }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${category?.name ?? 'Category'} drill-down`}
        style={{
          // The aside IS the scroll container; the header below is
          // position:sticky so it stays pinned while the body scrolls.
          // Fills the full viewport below the global sticky nav (h-16).
          position: 'relative',
          width: '100%',
          height: '100%',
          backgroundColor: S.bg,
          border: `1px solid ${S.cardBorder}`,
          borderRadius: 20,
          boxShadow: '0 40px 120px -30px rgba(0, 52, 94, 0.45)',
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          zIndex: 45,
        }}
      >
        {/* ─── Header (sticky) ─────────────────────────────────────── */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 2,
            padding: '22px 24px 18px',
            backgroundColor: S.surface,
            borderBottom: `1px solid ${S.cardBorder}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: S.onSurfaceVariant,
                  fontFamily: HEADLINE_FONT,
                }}
              >
                {category?.group ?? 'Shift Matrix'} · Drill-down
              </div>
              <h2
                style={{
                  marginTop: 4,
                  fontSize: 26,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: S.onBg,
                  fontFamily: HEADLINE_FONT,
                  lineHeight: 1.15,
                }}
              >
                {category?.name ?? 'Category'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                backgroundColor: S.surfaceLow,
                color: S.onSurfaceVariant,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.15s ease, color 0.15s ease',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = S.primaryContainer;
                e.currentTarget.style.color = S.onPrimaryContainer;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = S.surfaceLow;
                e.currentTarget.style.color = S.onSurfaceVariant;
              }}
            >
              <X size={16} strokeWidth={2.4} />
            </button>
          </div>

          {/* KPI strip */}
          <div
            style={{
              marginTop: 18,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
            }}
          >
            {/* Shift at horizon end */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                backgroundColor: S.surfaceLow,
                border: `1px solid ${S.cardBorder}`,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: S.onSurfaceVariant,
                  fontFamily: HEADLINE_FONT,
                }}
              >
                {horizonEnd} Shift
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 19,
                  fontWeight: 800,
                  fontFamily: MONO_FONT,
                  color: shiftEnd > 0 ? S.expansionInk : shiftEnd < 0 ? S.contractionInk : S.onSurface,
                  lineHeight: 1,
                }}
              >
                {fmtShift(shiftEnd, 1)}
              </div>
            </div>

            {/* Velocity (horizon-end minus horizon-start) */}
            <div
              onMouseEnter={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setPathHover({ x: r.left + r.width / 2, y: r.bottom });
              }}
              onMouseLeave={() => setPathHover(null)}
              style={{
                position: 'relative',
                padding: '12px 14px',
                borderRadius: 12,
                backgroundColor: S.surfaceLow,
                border: `1px solid ${S.cardBorder}`,
                cursor: 'help',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: S.onSurfaceVariant,
                  fontFamily: HEADLINE_FONT,
                }}
              >
                Path Δ
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 19,
                  fontWeight: 800,
                  fontFamily: MONO_FONT,
                  color: velocity > 0 ? S.expansionInk : velocity < 0 ? S.contractionInk : S.onSurface,
                  lineHeight: 1,
                }}
              >
                {fmtShift(velocity, 1)}
              </div>
            </div>

            {/* Trend count */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                backgroundColor: S.surfaceLow,
                border: `1px solid ${S.cardBorder}`,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: S.onSurfaceVariant,
                  fontFamily: HEADLINE_FONT,
                }}
              >
                Trends
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 19,
                  fontWeight: 800,
                  color: S.onBg,
                  fontFamily: HEADLINE_FONT,
                  lineHeight: 1,
                }}
              >
                {trendList.length}
              </div>
            </div>
          </div>
        </header>

        {/* ─── Scrollable content ──────────────────────────────────
            Full-page layout: two columns on large screens — simulation
            evidence (fan chart + force decomposition) on the left, the
            ranked contributing-trend drivers on the right. Stacks to a
            single column below lg. */}
        <div
          className="grid gap-4 items-start lg:grid-cols-2"
          style={{
            padding: '20px 20px 28px',
            backgroundColor: S.bg,
          }}
        >
          {/* Left column — what the simulation says */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* Fan chart */}
          <Section
            title={`Shift Path · ${horizonStart}–${horizonEnd}`}
            icon={LineChart}
            trailing={
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 10px',
                  borderRadius: 999,
                  backgroundColor: S.primaryContainer,
                  color: S.onPrimaryContainer,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'none',
                  fontFamily: BODY_FONT,
                }}
              >
                P10 – P90
              </span>
            }
          >
            <MiniPathChart pathData={pathData} />
          </Section>

          {/* Force decomposition */}
          <Section title="Force Decomposition" icon={Zap}>
            <ForceDecomposition decomposition={forceDecomposition} />
          </Section>
          </div>

          {/* Right column — the drivers behind the shift */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* Contributing trends — ranked by scaled attribution share */}
          {trendList.length > 0 && (
            <Section
              title="Contributing Trends"
              icon={Layers}
              trailing={
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: S.onSurfaceVariant,
                    letterSpacing: '0.06em',
                    fontFamily: HEADLINE_FONT,
                  }}
                >
                  {trendList.length} TOTAL
                  {topShare > 0 ? ' \u00B7 TOP-5 ' + fmtPct(topShare, 0) : ''}
                </span>
              }
            >
              {/* Concentration strip — share of movement captured by top 5 */}
              {topShare > 0 && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: '10px 12px',
                    borderRadius: 10,
                    backgroundColor: S.surfaceLow,
                    border: `1px solid ${S.cardBorder}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                      fontSize: 10.5,
                      color: S.onSurfaceVariant,
                      fontFamily: BODY_FONT,
                      letterSpacing: '0.02em',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>Top 5 drivers</span>
                    <span style={{ fontFamily: MONO_FONT, fontWeight: 700, color: S.onBg }}>
                      {fmtPct(topShare, 0)} of movement
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: S.surface,
                      overflow: 'hidden',
                      border: `1px solid ${S.cardBorder}`,
                    }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, topShare * 100)}%` }}
                      transition={{ delay: 0.1, duration: 0.6, ease: 'easeOut' }}
                      style={{
                        height: '100%',
                        backgroundColor: S.primary,
                        opacity: 0.82,
                      }}
                    />
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {trendList.map((trend, idx) => (
                  <TrendCard
                    key={trend.id}
                    trend={trend}
                    index={idx}
                    rank={idx + 1}
                    onOpen={onOpenTrend ? () => onOpenTrend(trend.name) : undefined}
                  />
                ))}
              </div>
            </Section>
          )}
          </div>

          {/* Footer methodology line — mirrors ProfitPoolAnalysis2 footer */}
          <footer
            className="lg:col-span-2"
            style={{
              marginTop: 4,
              padding: '0 4px',
              fontSize: 10.5,
              color: S.mutedText,
              lineHeight: 1.55,
              fontFamily: BODY_FONT,
            }}
          >
            <Activity
              size={10}
              style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }}
            />
            Shifts are cumulative vs 2025 from the Bayesian MC engine. Force shares sum to
            the row&rsquo;s MC median at the selected year.
          </footer>
        </div>
      </motion.aside>

      {/* ── Path Δ hover tooltip ─────────────────────────────────
          Visual language is identical to the Matrix cell tooltip in
          ProfitPoolAnalysis2 — fixed position, navy fill, white text,
          uppercase eyebrow, downward arrow. */}
      {pathHover && (
        <div
          className="fixed z-50 pointer-events-none rounded-xl shadow-2xl"
          style={{
            left: pathHover.x,
            top: pathHover.y + 10,
            transform: 'translate(-50%, 0)',
            backgroundColor: S.onSurface,
            color: '#ffffff',
            padding: '10px 14px',
            fontFamily: BODY_FONT,
            fontSize: 12,
            maxWidth: 280,
            boxShadow: '0 16px 40px -8px rgba(0, 52, 94, 0.35)',
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              opacity: 0.75,
              marginBottom: 6,
              fontFamily: HEADLINE_FONT,
            }}
          >
            Path Δ · What this means
          </div>
          <div style={{ lineHeight: 1.5, opacity: 0.92 }}>
            Velocity of the profit-pool shift across the horizon —
            <span style={{ fontFamily: MONO_FONT, fontWeight: 600, opacity: 0.95 }}>
              {' '}horizon-end − horizon-start{' '}
            </span>
            of the MC median path.
          </div>
          <div style={{ marginTop: 6, opacity: 0.65, fontSize: 10.5 }}>
            Positive = accelerating expansion · Negative = accelerating contraction
          </div>
          {/* Pointer arrow — points up because the bubble sits below the tile */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: -5,
              width: 10,
              height: 10,
              backgroundColor: S.onSurface,
              transform: 'translateX(-50%) rotate(45deg)',
            }}
          />
        </div>
      )}
    </motion.div>
  );
};

export default CategoryDetailPanel;
