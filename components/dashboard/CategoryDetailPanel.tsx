/**
 * The drill-down of one category, opened from a Shift Matrix row or a KPI
 * tile: its shift path with the P10–P90 band, the force attribution and the
 * regional shifts at the selected year, and the drivers behind its
 * terminal-year shift, ranked by their share of it.
 *
 * The contributing drivers are attributed at the score means with
 * lib/driverAttribution.ts, the decomposition the PRISM Analysis on the
 * Drivers page is written on, so a driver's rank here and its reading agree.
 * When the model configuration did not load, the ranking falls back to an
 * exposure proxy; the footer names the basis in use.
 *
 * The panel shares the Shift Analysis surface (S tokens, Manrope headlines,
 * JetBrains Mono figures, white cards on the light page background), so the
 * drill-down reads as the same page rather than a pop-out.
 */
import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Activity, Zap, Layers, LineChart, ArrowUpRight, Globe,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Area, Line, ComposedChart, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  CATEGORIES, FLAT_EPS, FORCE_COLORS, NO_VALUE, YEARS,
  fmtShift, fmtPct, categoryDisplay, groupDisplay,
} from '@/lib/format';
import { S, HEADLINE_FONT, BODY_FONT, MONO_FONT } from '@/lib/theme';
import { rowShares } from '@/lib/cellWeights';
import { computeDriverAttribution, type AttributionResult } from '@/lib/driverAttribution';
import useOverlay from '@/hooks/useOverlay';
import type { Driver, ForceName, ModelConfig, ShiftPath, SimulationResult } from '@/types';

const CATEGORY_NAMES = CATEGORIES.map((c) => c.name);
const HORIZON_START = YEARS[0];
const HORIZON_END = YEARS[YEARS.length - 1];

interface CategoryDetailPanelProps {
  /** The category's API key, e.g. "LHC: FCN". */
  category: string;
  /** The year the force and regional sections show. */
  year: number;
  simulation: SimulationResult;
  drivers: Driver[];
  /** The model configuration; null when it did not load, which leaves the exposure proxy. */
  config: ModelConfig | null;
  onClose: () => void;
  /** Opens the Drivers page searched for a driver's name; makes every driver card a link. */
  onOpenDriver?: (name: string) => void;
}

// ─── Contributing drivers ──────────────────────────────────────────────────

/** One driver's part in the category's terminal-year shift. */
interface Contributor {
  driver: Driver;
  /** The driver's exposure score for the category: 0 to 5, and above 0 for every contributor. */
  exposure: number;
  /** Signed, in shift units; the category's contributors add up to its terminal-year median. */
  contribution: number;
  /** |contribution| over the category's total |contribution|. */
  share: number;
}

/**
 * The drivers that touch the category, largest part first. With an
 * attribution a driver's part is its contribution at the score means;
 * without one it is the exposure proxy, the driver's Shift (normalized_score)
 * x category exposure / 5. One basis for every driver of the list, rescaled
 * so the parts add up to the median the matrix shows.
 */
function rankContributors(
  category: string, drivers: Driver[], attribution: AttributionResult | null, median: number,
): Contributor[] {
  const exposed = drivers.filter((d) => (d.category_exposure[category] ?? 0) > 0);
  const raw = exposed.map((d) => (attribution
    ? attribution.byDriver[d.id].category[category][HORIZON_END]
    : d.normalized_score * (Math.min(5, d.category_exposure[category]) / 5)));
  const rawTotal = raw.reduce((a, b) => a + b, 0);
  const scale = Math.abs(rawTotal) > 1e-9 && Math.abs(median) > 1e-9 ? median / rawTotal : 1;
  const scaled = raw.map((v) => v * scale);
  const totalAbs = scaled.reduce((a, b) => a + Math.abs(b), 0);
  return exposed
    .map((driver, i) => ({
      driver,
      exposure: driver.category_exposure[category],
      contribution: scaled[i],
      share: totalAbs > 1e-9 ? Math.abs(scaled[i]) / totalAbs : 0,
    }))
    .sort((a, b) => {
      const gap = Math.abs(b.contribution) - Math.abs(a.contribution);
      return Math.abs(gap) > 1e-9
        ? gap
        : Math.abs(b.driver.normalized_score) - Math.abs(a.driver.normalized_score);
    });
}

// ─── Section: card with an uppercase header ────────────────────────────────

interface SectionProps {
  title: string;
  icon?: LucideIcon;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, icon: Icon, trailing, children }) => (
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
    <div style={{ padding: '16px 18px' }}>{children}</div>
  </section>
);

// ─── MiniPathChart ─────────────────────────────────────────────────────────

interface ChartDataPoint {
  year: number;
  median: number;
  p10: number;
  p90: number;
}

const MiniPathChart: React.FC<{ path: ShiftPath }> = ({ path }) => {
  const chartData: ChartDataPoint[] = YEARS.map((year) => {
    const d = path[String(year)];
    return { year, median: d.median, p10: d.p10, p90: d.p90 };
  });

  const maxAbs = Math.max(
    ...chartData.map((d) => Math.max(Math.abs(d.p10), Math.abs(d.p90), Math.abs(d.median))),
    0.01,
  );
  const yAxisDomain: [number, number] = [-maxAbs * 1.15, maxAbs * 1.15];

  // The band and the median line take the terminal direction's colour, so a
  // contracting category reads red and an expanding one green, like the
  // matrix cell the drill-down was opened from.
  const termMedian = chartData[chartData.length - 1].median;
  const fanTint = termMedian < 0 ? S.contraction : termMedian > 0 ? S.expansion : S.primary;

  return (
    <div style={{ height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ left: 0, right: 8, top: 6, bottom: 0 }}>
          <defs>
            <linearGradient id="confidenceBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fanTint} stopOpacity={0.26} />
              <stop offset="100%" stopColor={fanTint} stopOpacity={0.04} />
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
            tick={{ fontSize: 11, fill: S.onSurfaceVariant, fontFamily: BODY_FONT }}
            axisLine={{ stroke: S.cardBorder }}
            tickLine={false}
            interval={0}
          />
          <YAxis
            domain={yAxisDomain}
            tick={{ fontSize: 11, fill: S.onSurfaceVariant, fontFamily: MONO_FONT }}
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
                    backgroundColor: S.surface,
                    color: S.onSurface,
                    border: `1px solid ${S.cardBorderStrong}`,
                    borderRadius: 10,
                    padding: '9px 12px',
                    fontSize: 11,
                    fontFamily: BODY_FONT,
                    boxShadow: '0 12px 32px -10px rgba(0, 52, 94, 0.22)',
                    minWidth: 148,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
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
          {/* The P10–P90 band: P10 as an invisible base, the band stacked on it. */}
          <Area
            type="monotone"
            dataKey="p10"
            stackId="band"
            stroke="none"
            fill={fanTint}
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
          <Line
            type="monotone"
            dataKey="median"
            stroke={fanTint}
            strokeWidth={2.4}
            dot={{ r: 2.5, fill: fanTint, strokeWidth: 0 }}
            activeDot={{ r: 4, fill: fanTint, stroke: '#fff', strokeWidth: 2 }}
            isAnimationActive
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── ForceDecomposition ────────────────────────────────────────────────────

/** The category's median at the selected year split by force, largest part first. */
const ForceDecomposition: React.FC<{ decomposition: Record<string, number> }> = ({ decomposition }) => {
  const forces = Object.keys(decomposition)
    .filter((f) => decomposition[f] !== 0)
    .sort((a, b) => Math.abs(decomposition[b]) - Math.abs(decomposition[a]));

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
                  backgroundColor: FORCE_COLORS[force as ForceName] ?? S.primary,
                  flexShrink: 0,
                }}
              />
              {force}
            </div>

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

// ─── RegionalDecomposition ─────────────────────────────────────────────────
// The category's own shift in each region at the selected year. Unlike the
// attribution lenses, which split the category median, these are the
// regional shifts the engine computes; the category number is their roll-up
// with the category's row of the cell weights (the percentages shown).

interface RegionalRow {
  region: string;
  median: number;
  /** The region's share of this category's gross profit; undefined when the row carries none. */
  share: number | undefined;
}

const RegionalDecomposition: React.FC<{ rows: RegionalRow[] }> = ({ rows }) => {
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.median)), 1e-9);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((r) => {
        const pct = Math.abs(r.median) / maxAbs;
        const isPositive = r.median > 0;
        const barColor = isPositive ? S.expansion : S.contraction;
        const valueInk = isPositive ? S.expansionInk : S.contractionInk;
        return (
          <div key={r.region} style={{ display: 'grid', gridTemplateColumns: '132px 1fr 62px', alignItems: 'center', columnGap: 10 }}>
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, fontSize: 12, fontWeight: 600, color: S.onSurface, fontFamily: BODY_FONT }}>
              <span>{r.region}</span>
              {r.share != null && (
                <span style={{ fontSize: 10, color: S.mutedText, fontFamily: MONO_FONT }}>
                  {fmtPct(r.share, 0)}
                </span>
              )}
            </div>
            <div style={{ height: 8, backgroundColor: S.surfaceLow, borderRadius: 4, overflow: 'hidden' }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${pct * 100}%` }}
                transition={{ delay: 0.15, duration: 0.55, ease: 'easeOut' }}
                style={{ height: '100%', backgroundColor: barColor, borderRadius: 4, opacity: 0.88 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: MONO_FONT, color: valueInk, textAlign: 'right' }}>
              {fmtShift(r.median, 1)}
            </span>
          </div>
        );
      })}
      <div style={{ fontSize: 10.5, color: S.mutedText, fontFamily: BODY_FONT, lineHeight: 1.5, marginTop: 2 }}>
        % = the region&rsquo;s share of this category&rsquo;s gross profit (its row of the run&rsquo;s cell weights). The category shift above is the share-weighted average of these regional shifts.
      </div>
    </div>
  );
};

// ─── DriverCard ────────────────────────────────────────────────────────────
// One ranked row: how big the driver's part is, which way it points and
// whether it matters. The hero figure is its share of the category's
// movement (the shares add up to 100% across the list), which turns a wall
// of near-zero contributions into a ranking; beneath it the signed
// contribution in the matrix's own units.

interface DriverCardProps {
  contributor: Contributor;
  /** Position in the ranking, from 0. */
  index: number;
  /** When provided, the card is a link into the Drivers page. */
  onOpen?: () => void;
}

const DriverCard: React.FC<DriverCardProps> = ({ contributor, index, onOpen }) => {
  const { driver, exposure, contribution, share } = contributor;
  const [hovered, setHovered] = useState(false);
  const rank = index + 1;
  const isExpansion = contribution !== 0
    ? contribution > 0
    : driver.direction === 'Expansion';
  const dirColor = isExpansion ? S.expansion : S.contraction;
  const dirBg = isExpansion ? S.expansionDim : S.contractionDim;
  const dirInk = isExpansion ? S.expansionInk : S.contractionInk;
  const forceColor = FORCE_COLORS[driver.force];

  // The share bar: capped at 100%, and at least 2% wide for any non-zero
  // share, so a small driver stays visible next to the largest.
  const barWidth = share > 0 ? Math.max(2, Math.min(100, share * 100)) : 0;
  const shareLabel = share > 0 ? fmtPct(share, share >= 0.1 ? 0 : 1) : NO_VALUE;
  const contribLabel = contribution !== 0 ? fmtShift(contribution, 1) : NO_VALUE;

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
      aria-label={interactive ? `Open "${driver.name}" on the Drivers page` : undefined}
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
          title={driver.name}
        >
          {driver.name}
        </div>

        {/* Force, exposure and direction */}
        <div
          style={{
            marginTop: 4,
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            fontSize: 11,
            color: S.onSurfaceVariant,
            fontFamily: BODY_FONT,
          }}
        >
          <span style={{ color: forceColor, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: forceColor, display: 'inline-block', flexShrink: 0 }} />
            {driver.force}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '1px 7px',
              borderRadius: 999,
              backgroundColor: S.surfaceLow,
              color: S.onSurfaceVariant,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Exposure {exposure}/5
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
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {isExpansion ? '▲' : '▼'} {isExpansion ? 'Expansion' : 'Contraction'}
          </span>
        </div>

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

      {/* Share of movement, then the signed contribution */}
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
            fontSize: 11,
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
            fontSize: 11,
            color: S.onSurfaceVariant,
            fontFamily: MONO_FONT,
            fontWeight: 600,
          }}
        >
          {contribLabel}
        </div>
      </div>

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
  category, year, simulation, drivers, config, onClose, onOpenDriver,
}) => {
  const group = CATEGORIES.find((c) => c.name === category)?.group;
  const path = simulation.shifts[category];

  // Anchor of the momentum explainer (the tile's bottom centre); it is
  // fixed-positioned like the matrix cell tooltip.
  const [pathHover, setPathHover] = useState<{ x: number; y: number } | null>(null);

  // Escape closes, focus stays inside, the page behind does not scroll, and
  // focus returns to the row or tile that opened the panel.
  const panelRef = useRef<HTMLElement | null>(null);
  useOverlay(true, onClose, panelRef);

  const forceDecomposition = simulation.decompositions.force[String(year)][category];

  const regionalShift = useMemo<RegionalRow[]>(() => {
    const shares = rowShares(simulation.cell_weights_used, category);
    return Object.entries(simulation.regional_shift_matrix[category])
      .map(([region, cell]) => ({ region, median: cell.path[String(year)].median, share: shares?.[region] }))
      .sort((a, b) => Math.abs(b.median) - Math.abs(a.median));
  }, [simulation, category, year]);

  const attribution = useMemo(() => (config
    ? computeDriverAttribution({ drivers, categories: CATEGORY_NAMES, config, cellWeights: simulation.cell_weights_used })
    : null), [drivers, config, simulation.cell_weights_used]);

  const shiftEnd = path[String(HORIZON_END)].median;
  const shiftStart = path[String(HORIZON_START)].median;
  const velocity = shiftEnd - shiftStart;

  const contributors = useMemo(
    () => rankContributors(category, drivers, attribution, shiftEnd),
    [category, drivers, attribution, shiftEnd],
  );
  const approximateCount = attribution
    ? contributors.filter((c) => attribution.byDriver[c.driver.id].approximate).length
    : 0;

  // Share of the category's movement carried by its five largest drivers.
  const topShare = useMemo(() => {
    const total = contributors.reduce((acc, c) => acc + Math.abs(c.contribution), 0);
    if (total <= 1e-9) return 0;
    const top = contributors.slice(0, 5).reduce((acc, c) => acc + Math.abs(c.contribution), 0);
    return top / total;
  }, [contributors]);

  // Momentum is said in words, because "+1.2 pt" in green under a red
  // headline reads as good news when it means "still shrinking, more
  // slowly". The colour follows the message: deepening in contraction ink,
  // easing in calm navy, accelerating in expansion ink, slowing in amber. The
  // value is in percentage points: a difference of two percentages.
  const momentum = useMemo(() => {
    const pts = `${velocity >= FLAT_EPS ? '+' : ''}${(velocity * 100).toFixed(1)} pt`;
    if (shiftEnd < -FLAT_EPS && velocity > FLAT_EPS)
      return { msg: 'Contraction easing', pts, color: S.onSurface };
    if (shiftEnd < -FLAT_EPS && velocity < -FLAT_EPS)
      return { msg: 'Contraction deepening', pts, color: S.contractionInk };
    if (shiftEnd > FLAT_EPS && velocity > FLAT_EPS)
      return { msg: 'Expansion accelerating', pts, color: S.expansionInk };
    if (shiftEnd > FLAT_EPS && velocity < -FLAT_EPS)
      return { msg: 'Expansion slowing', pts, color: S.amber };
    return { msg: 'Broadly flat', pts, color: S.onSurface };
  }, [shiftEnd, velocity]);

  const showMomentumHelp = (e: React.SyntheticEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPathHover({ x: r.left + r.width / 2, y: r.bottom });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        // top = 64px keeps the sticky top navigation (h-16) visible and
        // usable while the drill-down is open.
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
      {/* A full-page destination below the navigation, not a side drawer. */}
      <motion.aside
        ref={panelRef}
        initial={{ opacity: 0, scale: 0.985, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.985, y: 8 }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${categoryDisplay(category)} drill-down`}
        tabIndex={-1}
        style={{
          // The aside is the scroll container; the sticky header stays
          // pinned while the body scrolls.
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
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: S.onSurfaceVariant,
                  fontFamily: HEADLINE_FONT,
                }}
              >
                {groupDisplay(group)} · Drill-down
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
                {categoryDisplay(category)}
              </h2>
            </div>
            <span
              aria-hidden
              style={{
                fontSize: 11, fontWeight: 600, color: S.mutedText,
                fontFamily: BODY_FONT, alignSelf: 'center', marginRight: 8,
                whiteSpace: 'nowrap',
              }}
            >
              Esc to close
            </span>
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
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: S.onSurfaceVariant,
                  fontFamily: HEADLINE_FONT,
                }}
              >
                {HORIZON_END} Shift
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

            {/* Momentum: the explainer opens on hover, keyboard focus and tap. */}
            <div
              onMouseEnter={showMomentumHelp}
              onMouseLeave={() => setPathHover(null)}
              onFocus={showMomentumHelp}
              onBlur={() => setPathHover(null)}
              onClick={(e) => {
                if (pathHover) { setPathHover(null); return; }
                showMomentumHelp(e);
              }}
              tabIndex={0}
              aria-label={`Momentum: ${momentum.msg}, ${momentum.pts} between ${HORIZON_START} and ${HORIZON_END}`}
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
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: S.onSurfaceVariant,
                  fontFamily: HEADLINE_FONT,
                }}
              >
                Momentum
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 19,
                  fontWeight: 800,
                  fontFamily: MONO_FONT,
                  color: momentum.color,
                  lineHeight: 1,
                }}
              >
                {momentum.pts}
              </div>
              <div style={{ marginTop: 3, fontSize: 11, fontWeight: 600, color: momentum.color, fontFamily: BODY_FONT, lineHeight: 1.25 }}>
                {momentum.msg}{' '}
                <span style={{ color: S.mutedText, fontWeight: 400 }}>· {HORIZON_START} → {HORIZON_END}</span>
              </div>
            </div>

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
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: S.onSurfaceVariant,
                  fontFamily: HEADLINE_FONT,
                }}
              >
                Drivers
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
                {contributors.length}
              </div>
            </div>
          </div>
        </header>

        {/* Two columns on large screens: what the simulation says on the
            left, the ranked drivers behind it on the right; one column below lg. */}
        <div
          className="grid gap-4 items-start lg:grid-cols-2"
          style={{
            padding: '20px 20px 28px',
            backgroundColor: S.bg,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <Section
              title={`Shift Path · ${HORIZON_START}–${HORIZON_END}`}
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
                    fontSize: 11,
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
              <MiniPathChart path={path} />
            </Section>

            <Section title="Force Decomposition" icon={Zap}>
              <ForceDecomposition decomposition={forceDecomposition} />
            </Section>

            <Section title="Regional Shift" icon={Globe}>
              <RegionalDecomposition rows={regionalShift} />
            </Section>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            {contributors.length > 0 && (
              <Section
                title="Contributing Drivers"
                icon={Layers}
                trailing={
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: S.onSurfaceVariant,
                      letterSpacing: '0.06em',
                      fontFamily: HEADLINE_FONT,
                    }}
                  >
                    {contributors.length} TOTAL
                    {topShare > 0 ? ' · TOP-5 ' + fmtPct(topShare, 0) : ''}
                  </span>
                }
              >
                {/* Concentration: the share of movement the top five carry */}
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
                        fontSize: 11,
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
                  {contributors.map((contributor, idx) => (
                    <DriverCard
                      key={contributor.driver.id}
                      contributor={contributor}
                      index={idx}
                      onOpen={onOpenDriver ? () => onOpenDriver(contributor.driver.name) : undefined}
                    />
                  ))}
                </div>
              </Section>
            )}
          </div>

          <footer
            className="lg:col-span-2"
            style={{
              marginTop: 4,
              padding: '0 4px',
              fontSize: 11,
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
            {contributors.length > 0 && (attribution
              ? ' Contributing drivers: the same decomposition as the PRISM Analysis on the Drivers page (force weight × attenuation × overlap correction × expected materialisation × category and regional exposure, rolled up with the run’s cell weights), rescaled here to the row’s terminal-year median where the readings are reconciled to the portfolio median, so shares agree and points can differ by the row’s own factor.'
              : ' Contributing drivers: exposure proxy (Shift × category exposure), because the model configuration did not load; the PRISM Analysis on the Drivers page is attributed at the score means.')}
            {approximateCount > 0 && (approximateCount === 1
              ? ' 1 driver without a peak year or curve is taken at full materialisation.'
              : ` ${approximateCount} drivers without a peak year or curve are taken at full materialisation.`)}
          </footer>
        </div>
      </motion.aside>

      {/* The momentum explainer, in the matrix cell tooltip's style: fixed
          position, light card, uppercase eyebrow, pointer arrow. */}
      {pathHover && (
        <div
          className="fixed z-50 pointer-events-none rounded-xl shadow-2xl"
          style={{
            left: pathHover.x,
            top: pathHover.y + 10,
            transform: 'translate(-50%, 0)',
            backgroundColor: S.surface,
            color: S.onSurface,
            border: `1px solid ${S.cardBorderStrong}`,
            padding: '10px 14px',
            fontFamily: BODY_FONT,
            fontSize: 12,
            maxWidth: 280,
            boxShadow: '0 16px 40px -10px rgba(0, 52, 94, 0.22)',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              opacity: 0.75,
              marginBottom: 6,
              fontFamily: HEADLINE_FONT,
            }}
          >
            Momentum · What this means
          </div>
          <div style={{ lineHeight: 1.5, opacity: 0.92 }}>
            Velocity of the profit-pool shift across the horizon:
            <span style={{ fontFamily: MONO_FONT, fontWeight: 600, opacity: 0.95 }}>
              {' '}horizon-end − horizon-start{' '}
            </span>
            of the MC median path.
          </div>
          <div style={{ marginTop: 6, opacity: 0.65, fontSize: 11 }}>
            Contraction easing / deepening · Expansion accelerating / slowing: the label names the direction of travel
          </div>
          {/* Points up, because the card sits below the tile. */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: -6,
              width: 10,
              height: 10,
              backgroundColor: S.surface,
              borderTop: `1px solid ${S.cardBorderStrong}`,
              borderLeft: `1px solid ${S.cardBorderStrong}`,
              transform: 'translateX(-50%) rotate(45deg)',
            }}
          />
        </div>
      )}
    </motion.div>
  );
};

export default CategoryDetailPanel;
