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
 *   • Fan chart — p10/p90 band + median line across 2026–2036
 *   • Force decomposition — horizontal bars at the selected year
 *   • Allocation recommendation — stance pill + weight + optimizer rationale
 *   • Trigger status — per-category triggers sorted fired → active → dismissed
 *   • Contributing trends — list with force tag and direction
 */
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  X, Bell, BellOff, AlertCircle, TrendingUp, Shield, ArrowDownCircle,
  Activity, Zap, Layers, LineChart, Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Area, Line, ComposedChart, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { FORCES, FORCE_COLORS, FORCE_ICONS, YEARS, fmtShift, fmtPct } from '@/lib/format';
import type { ForceName, ProjectionYear, TriggerStatus, AllocationRecommendation } from '@/types';

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
  expansion:          'rgb(34, 197, 94)',
  expansionDim:       'rgba(34, 197, 94, 0.14)',
  expansionInk:       '#14532d',
  contraction:        'rgb(239, 68, 68)',
  contractionDim:     'rgba(239, 68, 68, 0.14)',
  contractionInk:     '#7f1d1d',
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
   *  renders one row per trigger with status, year, threshold, and action text. */
  triggers?: TriggerStatus[];
  /** Optional: allocation recommendation from the mean-variance optimizer. */
  allocation?: AllocationRecommendation | null;
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
          height: 144,
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
    <div style={{ height: 160 }}>
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
            interval={1}
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
                      {fmtShift(d.median, 2)}
                    </span>
                    <span style={{ opacity: 0.72 }}>P10</span>
                    <span style={{ fontFamily: MONO_FONT, textAlign: 'right' }}>
                      {fmtShift(d.p10, 2)}
                    </span>
                    <span style={{ opacity: 0.72 }}>P90</span>
                    <span style={{ fontFamily: MONO_FONT, textAlign: 'right' }}>
                      {fmtShift(d.p90, 2)}
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
  const isExpansion = trend.direction === 'Expansion';
  const dirColor = isExpansion ? S.expansion : S.contraction;
  const dirBg = isExpansion ? S.expansionDim : S.contractionDim;
  const dirInk = isExpansion ? S.expansionInk : S.contractionInk;
  const forceColor = FORCE_COLORS[trend.force] ?? S.primary;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25, ease: 'easeOut' }}
      style={{
        padding: '10px 12px',
        backgroundColor: S.surface,
        borderRadius: 10,
        border: `1px solid ${S.cardBorder}`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      {/* Force swatch */}
      <span
        aria-hidden
        style={{
          width: 4,
          alignSelf: 'stretch',
          backgroundColor: forceColor,
          borderRadius: 2,
          flexShrink: 0,
        }}
      />

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
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
        <div
          style={{
            marginTop: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 10.5,
            color: S.onSurfaceVariant,
            fontFamily: BODY_FONT,
          }}
        >
          <span style={{ color: forceColor, fontWeight: 600 }}>
            {FORCE_ICONS[trend.force]} {trend.force}
          </span>
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
            {isExpansion ? '▲' : '▼'} {trend.direction}
          </span>
        </div>
      </div>

      {/* Score + exposure */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 2,
          minWidth: 52,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            fontFamily: MONO_FONT,
            color: dirColor,
          }}
        >
          {fmtPct((trend.score ?? 0) / 25, 1)}
        </div>
        {trend.exposure_level != null && (
          <div
            style={{
              fontSize: 9.5,
              color: S.mutedText,
              fontFamily: MONO_FONT,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            Exp {trend.exposure_level}
          </div>
        )}
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
    return (
      data.categories?.find((c) => c.id === categoryId) ?? { id: categoryId, name: categoryId }
    );
  }, [categoryId, data]);

  // ── Filter triggers to this category ─────────────────────────────
  // Triggers persist with `category` either as the display name or snake_case
  // id. Match both shapes so nothing is silently dropped.
  const catTriggers = useMemo(() => {
    if (!triggers || triggers.length === 0) return [];
    const displayName = category?.name;
    return triggers
      .filter((t) => t.category === displayName || t.category === categoryId)
      .sort((a, b) => {
        const statusRank = (s: string): number =>
          s === 'fired' ? 0 : s === 'active' ? 1 : 2;
        const dr = statusRank(a.status) - statusRank(b.status);
        if (dr !== 0) return dr;
        return (a.target_year ?? 0) - (b.target_year ?? 0);
      });
  }, [triggers, category, categoryId]);

  // ── Resolve allocation stance for this category ──────────────────
  const allocStance = useMemo<'invest_more' | 'defend' | 'harvest' | null>(() => {
    if (!allocation) return null;
    const key = category?.name ?? categoryId;
    const inList = (xs?: string[]): boolean =>
      !!xs && (xs.includes(key) || xs.includes(categoryId));
    if (inList(allocation.invest_more)) return 'invest_more';
    if (inList(allocation.defend)) return 'defend';
    if (inList(allocation.harvest)) return 'harvest';
    return null;
  }, [allocation, category, categoryId]);

  const allocWeight = useMemo<number | null>(() => {
    if (!allocation?.weights) return null;
    const key = category?.name ?? categoryId;
    const w = allocation.weights[key] ?? allocation.weights[categoryId];
    return typeof w === 'number' && isFinite(w) ? w : null;
  }, [allocation, category, categoryId]);

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
    return [...data.contributing_trends[categoryId]].sort(
      (a, b) => Math.abs(b.score ?? 0) - Math.abs(a.score ?? 0),
    );
  }, [data, categoryId]);

  // Horizon endpoints — summary KPIs
  const horizonEnd = YEARS[YEARS.length - 1];
  const horizonStart = YEARS[0];
  const shiftEnd = pathData[horizonEnd!]?.median ?? 0;
  const shiftStart = pathData[horizonStart!]?.median ?? 0;
  const velocity = shiftEnd - shiftStart;

  // Stance pill meta — soft editorial palette mirroring pill buttons on the page
  const stanceMeta: Record<
    'invest_more' | 'defend' | 'harvest',
    { label: string; color: string; bg: string; Icon: LucideIcon }
  > = {
    invest_more: { label: 'Invest more', color: S.expansionInk,  bg: S.expansionDim,    Icon: TrendingUp },
    defend:      { label: 'Defend',      color: S.onPrimaryContainer, bg: S.primaryContainer, Icon: Shield },
    harvest:     { label: 'Harvest',     color: S.amber,         bg: S.amberDim,        Icon: ArrowDownCircle },
  };
  const sMeta = allocStance ? stanceMeta[allocStance] : null;
  const StanceIcon = sMeta?.Icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 52, 94, 0.22)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 40,
        fontFamily: BODY_FONT,
      }}
    >
      {/* Drawer — slides in from the right */}
      <motion.aside
        initial={{ x: 480, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 480, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`${category?.name ?? 'Category'} drill-down`}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 'min(480px, 100vw)',
          height: '100vh',
          backgroundColor: S.bg,
          borderLeft: `1px solid ${S.cardBorder}`,
          boxShadow: '-24px 0 60px -15px rgba(0, 52, 94, 0.24)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 50,
        }}
      >
        {/* ─── Header ────────────────────────────────────────────── */}
        <header
          style={{
            padding: '22px 24px 18px',
            backgroundColor: S.surface,
            borderBottom: `1px solid ${S.cardBorder}`,
            flexShrink: 0,
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
                {fmtShift(shiftEnd, 2)}
              </div>
            </div>

            {/* Velocity (horizon-end minus horizon-start) */}
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
                {fmtShift(velocity, 2)}
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

        {/* ─── Scrollable content ────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 20px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            backgroundColor: S.bg,
          }}
        >
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

          {/* Allocation recommendation */}
          {(allocStance || allocWeight != null || allocation?.rationale) && (
            <Section
              title="Allocation Recommendation"
              icon={Sparkles}
              trailing={
                allocWeight != null ? (
                  <span
                    style={{
                      fontFamily: MONO_FONT,
                      fontSize: 12,
                      fontWeight: 700,
                      color: S.onBg,
                      textTransform: 'none',
                      letterSpacing: 0,
                    }}
                  >
                    {fmtPct(allocWeight, 1)}
                    <span
                      style={{
                        marginLeft: 4,
                        fontSize: 10,
                        color: S.mutedText,
                        fontWeight: 500,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        fontFamily: HEADLINE_FONT,
                      }}
                    >
                      weight
                    </span>
                  </span>
                ) : null
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {sMeta && StanceIcon ? (
                  <span
                    style={{
                      alignSelf: 'flex-start',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 999,
                      backgroundColor: sMeta.bg,
                      color: sMeta.color,
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                      fontFamily: BODY_FONT,
                    }}
                  >
                    <StanceIcon size={13} strokeWidth={2.4} />
                    {sMeta.label}
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 12,
                      color: S.mutedText,
                      fontStyle: 'italic',
                      fontFamily: BODY_FONT,
                    }}
                  >
                    Not assigned by the optimizer
                  </span>
                )}
                {allocation?.rationale && (
                  <p
                    style={{
                      fontSize: 12.5,
                      color: S.onSurfaceVariant,
                      lineHeight: 1.55,
                      margin: 0,
                      fontFamily: BODY_FONT,
                    }}
                  >
                    {allocation.rationale}
                  </p>
                )}
              </div>
            </Section>
          )}

          {/* Trigger status */}
          {triggers && (
            <Section
              title="Trigger Status"
              icon={Bell}
              trailing={
                catTriggers.length > 0 ? (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: S.onSurfaceVariant,
                      letterSpacing: '0.06em',
                      fontFamily: HEADLINE_FONT,
                    }}
                  >
                    {catTriggers.length} WIRED
                  </span>
                ) : null
              }
            >
              {catTriggers.length === 0 ? (
                <div
                  style={{
                    padding: '14px 16px',
                    backgroundColor: S.surfaceLow,
                    borderRadius: 10,
                    border: `1px dashed ${S.outlineVariant}`,
                    color: S.mutedText,
                    fontSize: 12.5,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    fontFamily: BODY_FONT,
                  }}
                >
                  <BellOff size={14} />
                  No triggers wired for this category
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {catTriggers.map((trig) => {
                    const isFired = trig.status === 'fired';
                    const isActive = trig.status === 'active';
                    const statusColor = isFired
                      ? S.contractionInk
                      : isActive
                      ? S.amber
                      : S.mutedText;
                    const statusBg = isFired
                      ? S.contractionDim
                      : isActive
                      ? S.amberDim
                      : S.surfaceLow;
                    const leftBorder = isFired
                      ? S.contraction
                      : isActive
                      ? S.amber
                      : S.outlineVariant;

                    return (
                      <div
                        key={trig.id}
                        style={{
                          padding: '12px 14px',
                          backgroundColor: S.surface,
                          borderRadius: 10,
                          border: `1px solid ${S.cardBorder}`,
                          borderLeft: `3px solid ${leftBorder}`,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            marginBottom: 6,
                          }}
                        >
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '3px 9px',
                              borderRadius: 999,
                              backgroundColor: statusBg,
                              color: statusColor,
                              fontSize: 9.5,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              fontFamily: HEADLINE_FONT,
                            }}
                          >
                            <AlertCircle size={10} strokeWidth={2.4} />
                            {trig.status}
                          </span>
                          <span
                            style={{
                              fontFamily: MONO_FONT,
                              fontSize: 11,
                              color: S.onSurfaceVariant,
                              fontWeight: 600,
                            }}
                          >
                            {trig.condition_type} {fmtShift(trig.threshold, 1)} · {trig.target_year}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 12.5,
                            color: S.onSurface,
                            lineHeight: 1.5,
                            fontFamily: BODY_FONT,
                          }}
                        >
                          {trig.action_text}
                        </div>
                        {trig.fired_date && (
                          <div
                            style={{
                              marginTop: 6,
                              fontSize: 10,
                              color: S.mutedText,
                              fontFamily: MONO_FONT,
                            }}
                          >
                            Fired {new Date(trig.fired_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          )}

          {/* Contributing trends */}
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
                </span>
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {trendList.map((trend, idx) => (
                  <ContributingTrendItem key={trend.id} trend={trend} index={idx} />
                ))}
              </div>
            </Section>
          )}

          {/* Footer methodology line — mirrors ProfitPoolAnalysis2 footer */}
          <footer
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
    </motion.div>
  );
};

export default CategoryDetailPanel;
