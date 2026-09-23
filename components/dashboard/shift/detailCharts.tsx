/**
 * The drill-down's sections: the card they sit in, the category's shift path
 * with its P10 to P90 band, the force attribution and the regional shifts in
 * the year the panel names.
 */
import React from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
  Area, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { FLAT_EPS, FORCE_COLORS, YEARS, fmtShift, fmtPct, heatText, shiftColor } from '@/lib/format';
import { S, SHADOW, HEADLINE_FONT, BODY_FONT, MONO_FONT } from '@/lib/theme';
import type { ForceName, ShiftPath } from '@/types';

// ─── Section: card with an uppercase header ────────────────────────────────

interface SectionProps {
  title: string;
  icon?: LucideIcon;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}

export const Section: React.FC<SectionProps> = ({ title, icon: Icon, trailing, children }) => (
  <section
    style={{
      backgroundColor: S.surface,
      borderRadius: 16,
      boxShadow: SHADOW.card,
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

export const MiniPathChart: React.FC<{ path: ShiftPath }> = ({ path }) => {
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
  const fanTint = Math.abs(termMedian) < FLAT_EPS ? S.primary : shiftColor(termMedian);

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
            tickFormatter={(v: number) => fmtShift(v, 1)}
            width={48}
          />
          <Tooltip
            cursor={{ stroke: S.primary, strokeDasharray: '2 3', strokeOpacity: 0.5 }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0]?.payload as ChartDataPoint;
              const medColor = heatText(d.median);
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
                    boxShadow: SHADOW.popover,
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
            activeDot={{ r: 4, fill: fanTint, stroke: S.surface, strokeWidth: 2 }}
            isAnimationActive
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── ForceDecomposition ────────────────────────────────────────────────────

/** The category's median in one year split by force, largest part first. */
export const ForceDecomposition: React.FC<{ decomposition: Record<string, number> }> = ({ decomposition }) => {
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
        const barColor = shiftColor(value);
        const valueInk = heatText(value);

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
// The category's own shift in each region in one year. Unlike the
// attribution lenses, which split the category median, these are the
// regional shifts the engine computes; the category number is their roll-up
// with the category's row of the cell weights (the percentages shown).

export interface RegionalRow {
  region: string;
  median: number;
  /** The region's share of this category's gross profit; undefined when the row carries none. */
  share: number | undefined;
}

export const RegionalDecomposition: React.FC<{ rows: RegionalRow[] }> = ({ rows }) => {
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.median)), 1e-9);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((r) => {
        const pct = Math.abs(r.median) / maxAbs;
        const barColor = shiftColor(r.median);
        const valueInk = heatText(r.median);
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
        % = the region&rsquo;s share of this category&rsquo;s gross profit (its row of the run&rsquo;s cell weights). In every draw the category&rsquo;s shift is the share-weighted average of its regional shifts; the medians shown need not average exactly to the category&rsquo;s median.
      </div>
    </div>
  );
};
