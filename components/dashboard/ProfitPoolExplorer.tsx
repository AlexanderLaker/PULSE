/**
 * Profit Pool Explorer — Bain Classic View (admin-only)
 *
 * Revives the original Bain Profit Pool logic (Gadiesh & Gilbert, HBR 1998):
 *
 *   X axis  = cumulative revenue share (% of total pool)
 *   Y axis  = EBIT margin (profitability)
 *   Area    = profit pool (€bn)
 *
 * Each bar is a stacked-order rectangle whose WIDTH equals the category's share
 * of total revenue and whose HEIGHT equals its EBIT margin. Area is therefore
 * proportional to profit — the Bain-classic "fishbone" map (see
 * Profit_Pool_Explorer_Concept.docx, Sections 1–3).
 *
 * Toggles:
 *   • BU filter — Both | Hair | LHC
 *   • View mode — Category view only in v1; Value Chain / Region ready for v2
 *   • Year      — drives the PRISM-shift direction overlay in the tooltip
 *
 * Tooltip on hover: for each category area the user sees
 *   1. Revenue (€bn)            + contributing sources
 *   2. Profitability (EBIT %)   + contributing sources
 *   3. Profit pool size (€bn)   + Henkel footprint
 *   4. PRISM direction of change — median MC shift at selected year + 2030
 *      pulled from simulation.shifts; arrow / label color-coded
 *
 * Admin gating is enforced at the page level (app/dashboard/page.tsx) — this
 * component itself assumes the caller has already verified admin role.
 */

'use client';

import React, { FC, useMemo, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Layers, Info, TrendingUp, TrendingDown, Minus,
  Database, Sparkles, Loader2,
} from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import {
  PROFIT_POOL_DATA,
  profitBn, totalRevenueBn, totalProfitBn,
  filterByBu, prismShiftFor, classifyDirection,
  type CategoryProfitPool, type BuFilter,
} from '@/lib/profitPoolData';
import { CATEGORIES, fmtShift } from '@/lib/format';
import type { SimulationResult } from '@/types';

// ─── Editorial design tokens — mirror Trends2 / ProfitPoolAnalysis2 ──
const S = {
  bg:                  '#f8f9ff',
  surface:             '#ffffff',
  surfaceLow:          '#eff4ff',
  surfaceContainer:    '#e5eeff',
  surfaceHigh:         '#dce9ff',
  surfaceHighest:      '#d2e4ff',
  primary:             '#005db5',
  primaryDim:          '#0052a0',
  primaryContainer:    '#d6e3ff',
  onPrimaryContainer:  '#00519e',
  onBg:                '#00345e',
  onSurface:           '#00345e',
  onSurfaceVariant:    '#26619d',
  outline:             '#477dbb',
  outlineVariant:      '#81b5f6',
  cardBorder:          'rgba(0, 52, 94, 0.10)',
  cardBorderStrong:    'rgba(0, 52, 94, 0.16)',
  mutedText:           '#64748B',
  greenStrong:         '#0F7A3D',
  green:               '#1F9D55',
  red:                 '#B3261E',
  redStrong:           '#7F1D1D',
  neutral:             '#64748B',
};

const HEADLINE_FONT = "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const BODY_FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO_FONT = "'JetBrains Mono', 'SF Mono', monospace";

// Color by tone
const toneColor: Record<string, string> = {
  'green-strong': S.greenStrong,
  'green':        S.green,
  'neutral':      S.neutral,
  'red':          S.red,
  'red-strong':   S.redStrong,
  'muted':        S.mutedText,
};

// Map CategoryId -> display color from the authoritative CATEGORIES table
const COLOR_BY_ID: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.color]),
);

// ─── Local types ──────────────────────────────────────────────────
interface HoverState {
  cat: CategoryProfitPool;
  /** Viewport-relative pointer position for positioning the floating tooltip */
  x: number;
  y: number;
}

interface PoolBar {
  cat: CategoryProfitPool;
  /** Starting X in data units (cumulative revenue share 0–1) */
  x0: number;
  /** Ending X in data units */
  x1: number;
  /** Height in data units = EBIT margin (decimal) */
  y: number;
}

// ─── Sub-component: floating tooltip ──────────────────────────────
interface TooltipProps {
  cat: CategoryProfitPool;
  year: number;
  simulation: SimulationResult | null;
  x: number;
  y: number;
}
const PoolTooltip: FC<TooltipProps> = ({ cat, year, simulation, x, y }) => {
  const shifts = simulation?.shifts as
    | Record<string, Record<string | number, unknown>>
    | undefined;
  const shiftSel = prismShiftFor(shifts, cat, year);
  const shift2030 = prismShiftFor(shifts, cat, 2030);
  const dirSel  = classifyDirection(shiftSel);
  const dir2030 = classifyDirection(shift2030);

  const profit = profitBn(cat);
  const henkelRev = cat.revenueBn * cat.henkelShare;

  // Group sources by what they contribute
  const revSources = cat.sources.filter(s => s.contributes === 'revenue');
  const mgnSources = cat.sources.filter(s => s.contributes === 'margin');
  const shareSources = cat.sources.filter(s => s.contributes === 'share');
  const triSources = cat.sources.filter(s => s.contributes === 'triangulation');

  // Keep tooltip inside viewport
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
  const tipW = 380;
  const tipH = 440;
  const left = Math.min(vw - tipW - 12, Math.max(12, x + 14));
  const top  = Math.min(vh - tipH - 12, Math.max(12, y + 14));

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.12 }}
      style={{
        position: 'fixed',
        left,
        top,
        width: tipW,
        maxHeight: tipH,
        overflowY: 'auto',
        backgroundColor: S.surface,
        border: `1px solid ${S.cardBorderStrong}`,
        borderRadius: 14,
        boxShadow: '0 24px 64px -15px rgba(0, 52, 94, 0.22)',
        padding: 14,
        fontFamily: BODY_FONT,
        pointerEvents: 'none',
        zIndex: 60,
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: 3,
          backgroundColor: COLOR_BY_ID[cat.id] ?? S.primary,
        }} />
        <div style={{
          fontFamily: HEADLINE_FONT, fontWeight: 700, fontSize: 13,
          color: S.onBg, letterSpacing: '-0.01em', flex: 1,
        }}>
          {cat.name}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 600, color: S.onSurfaceVariant,
          padding: '2px 8px', backgroundColor: S.surfaceContainer,
          borderRadius: 20,
        }}>
          {cat.group}
        </div>
      </div>
      <div style={{
        fontSize: 11, color: S.mutedText, marginBottom: 12, lineHeight: 1.4,
      }}>
        {cat.shortDescription}
      </div>

      {/* Numbers block */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
        marginBottom: 12,
      }}>
        <MetricTile label="Revenue (€bn)"       value={cat.revenueBn.toFixed(1)} />
        <MetricTile label="EBIT margin"          value={`${(cat.ebitMargin * 100).toFixed(1)}%`} />
        <MetricTile label="Profit pool (€bn)"    value={profit.toFixed(2)} highlight />
        <MetricTile label="Henkel rev (€bn)"     value={henkelRev.toFixed(2)} />
      </div>

      {/* Sources block */}
      <div style={{
        borderTop: `1px solid ${S.cardBorder}`,
        paddingTop: 10, marginBottom: 10,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
        }}>
          <Database size={11} color={S.onSurfaceVariant} />
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
            textTransform: 'uppercase', color: S.onSurfaceVariant,
          }}>
            Sources
          </span>
        </div>
        <SourceRow label="Revenue"       sources={revSources} />
        <SourceRow label="Margin"        sources={mgnSources} />
        <SourceRow label="Henkel share"  sources={shareSources} />
        {triSources.length > 0 && (
          <SourceRow label="Triangulation" sources={triSources} />
        )}
      </div>

      {/* PRISM direction of change */}
      <div style={{
        borderTop: `1px solid ${S.cardBorder}`, paddingTop: 10,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
        }}>
          <Sparkles size={11} color={S.primary} />
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
            textTransform: 'uppercase', color: S.primary,
          }}>
            PRISM direction of change
          </span>
        </div>
        <ShiftRow
          year={year} shift={shiftSel} dir={dirSel} label={`${year} (selected)`}
        />
        {year !== 2030 && (
          <ShiftRow
            year={2030} shift={shift2030} dir={dir2030} label="2030 (horizon)"
          />
        )}
        {!simulation?.shifts && (
          <div style={{
            marginTop: 6, fontSize: 10, color: S.mutedText, fontStyle: 'italic',
          }}>
            Run a simulation on the Profit Pool tab to populate PRISM shifts.
          </div>
        )}
      </div>
    </motion.div>
  );
};

const MetricTile: FC<{ label: string; value: string; highlight?: boolean }> = ({
  label, value, highlight,
}) => (
  <div style={{
    padding: '8px 10px',
    backgroundColor: highlight ? S.primaryContainer : S.surfaceLow,
    border: `1px solid ${highlight ? S.outlineVariant : S.cardBorder}`,
    borderRadius: 8,
  }}>
    <div style={{
      fontSize: 9, fontWeight: 600, letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: highlight ? S.onPrimaryContainer : S.onSurfaceVariant,
      marginBottom: 3,
    }}>
      {label}
    </div>
    <div style={{
      fontFamily: MONO_FONT, fontSize: 14, fontWeight: 700,
      color: highlight ? S.primaryDim : S.onBg,
    }}>
      {value}
    </div>
  </div>
);

const SourceRow: FC<{ label: string; sources: { label: string; tier: string }[] }> = ({
  label, sources,
}) => {
  if (sources.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 4, fontSize: 10.5 }}>
      <span style={{
        minWidth: 80, color: S.mutedText, fontWeight: 600,
      }}>
        {label}
      </span>
      <span style={{ flex: 1, color: S.onBg, lineHeight: 1.4 }}>
        {sources.map((s, i) => (
          <span key={`${s.label}-${i}`}>
            {i > 0 && ' · '}
            {s.label}
            <span style={{
              marginLeft: 3, fontSize: 9, fontWeight: 700,
              color: tierColor(s.tier),
            }}>
              [{s.tier}]
            </span>
          </span>
        ))}
      </span>
    </div>
  );
};

function tierColor(tier: string): string {
  switch (tier) {
    case 'A': return S.greenStrong;
    case 'B': return S.primary;
    case 'C': return '#8a5a00';
    case 'D': return S.mutedText;
    default:  return S.mutedText;
  }
}

interface ShiftRowProps {
  year: number;
  shift: number | null;
  dir: ReturnType<typeof classifyDirection>;
  label: string;
}
const ShiftRow: FC<ShiftRowProps> = ({ year: _year, shift, dir, label }) => {
  const color = toneColor[dir.tone] ?? S.mutedText;
  let Icon = Minus;
  if (dir.tone.startsWith('green')) Icon = TrendingUp;
  if (dir.tone.startsWith('red'))   Icon = TrendingDown;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
      fontSize: 11,
    }}>
      <span style={{
        minWidth: 120, color: S.onSurfaceVariant, fontWeight: 600,
      }}>
        {label}
      </span>
      <Icon size={12} color={color} />
      <span style={{ color, fontWeight: 700, minWidth: 60 }}>
        {dir.label}
      </span>
      <span style={{
        color: S.onBg, fontFamily: MONO_FONT, fontSize: 10.5,
      }}>
        {shift != null ? fmtShift(shift) : '—'}
      </span>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────
const ProfitPoolExplorer: FC = () => {
  const { simulation, loading } = usePrism();
  const [bu,   setBu]   = useState<BuFilter>('Both');
  const [year, setYear] = useState<number>(2030);
  const [hover, setHover] = useState<HoverState | null>(null);

  // Filter categories by BU toggle
  const cats = useMemo<CategoryProfitPool[]>(
    () => filterByBu(PROFIT_POOL_DATA, bu),
    [bu],
  );

  // Sort descending by margin (Bain-classic: high-margin cats on the left)
  const sorted = useMemo(
    () => [...cats].sort((a, b) => b.ebitMargin - a.ebitMargin),
    [cats],
  );

  const totalRev = useMemo(() => totalRevenueBn(sorted), [sorted]);
  const totalPrf = useMemo(() => totalProfitBn(sorted),  [sorted]);

  // Build stacked bars in cumulative-revenue-share units (0..1 on X)
  const bars = useMemo<PoolBar[]>(() => {
    let cum = 0;
    return sorted.map((c) => {
      const w = c.revenueBn / (totalRev || 1);
      const bar: PoolBar = { cat: c, x0: cum, x1: cum + w, y: c.ebitMargin };
      cum += w;
      return bar;
    });
  }, [sorted, totalRev]);

  const maxMargin = useMemo(
    () => Math.max(0.25, ...sorted.map(c => c.ebitMargin) , 0),
    [sorted],
  );

  // SVG geometry
  const W = 1040;
  const H = 460;
  const PAD = { top: 28, right: 28, bottom: 54, left: 68 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const xScale = useCallback((v: number) => PAD.left + v * innerW, [innerW]);
  const yScale = useCallback(
    (m: number) => PAD.top + innerH - (m / maxMargin) * innerH,
    [innerH, maxMargin, PAD.top],
  );

  const onBarMove = (cat: CategoryProfitPool, e: React.MouseEvent) => {
    setHover({ cat, x: e.clientX, y: e.clientY });
  };
  const onBarLeave = () => setHover(null);

  // Y-axis ticks — multiples of 5%
  const yTicks = useMemo(() => {
    const step = 0.05;
    const out: number[] = [];
    for (let v = 0; v <= maxMargin + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
    return out;
  }, [maxMargin]);

  // ──── Render ────────────────────────────────────────────────────
  return (
    <div
      style={{
        backgroundColor: S.bg, fontFamily: BODY_FONT,
        minHeight: 'calc(100vh - 64px)', padding: '24px 32px 48px',
      }}
    >
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>

        {/* ── Headline ─────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          gap: 24, marginBottom: 24, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', backgroundColor: S.primaryContainer,
              color: S.onPrimaryContainer, borderRadius: 20,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', marginBottom: 8,
            }}>
              <Layers size={11} />
              Admin view · Bain classic
            </div>
            <h1 style={{
              fontFamily: HEADLINE_FONT, fontSize: 32, fontWeight: 800,
              color: S.onBg, letterSpacing: '-0.02em', lineHeight: 1.1,
              margin: 0,
            }}>
              HCB Profit Pool Explorer
            </h1>
            <p style={{
              fontSize: 13, color: S.onSurfaceVariant, marginTop: 6,
              maxWidth: 760, lineHeight: 1.5,
            }}>
              Bain original profit-pool logic: <b>X = revenue share</b>,
              <b> Y = EBIT margin</b>, <b>area = profit pool</b>. Twelve HCB
              categories sorted by profitability, width scaled to revenue.
              Hover any area for sources and the PRISM-driven direction of
              change.
            </p>
          </div>

          {/* Totals block */}
          <div style={{
            display: 'flex', gap: 12,
            padding: '12px 16px',
            backgroundColor: S.surface, border: `1px solid ${S.cardBorder}`,
            borderRadius: 14,
          }}>
            <StatBlock label="Categories" value={String(sorted.length)} />
            <Divider />
            <StatBlock label="Total revenue" value={`€${totalRev.toFixed(0)}bn`} />
            <Divider />
            <StatBlock label="Total profit"  value={`€${totalPrf.toFixed(1)}bn`} tone="primary" />
          </div>
        </div>

        {/* ── Controls ────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 12, alignItems: 'center',
          marginBottom: 20, flexWrap: 'wrap',
        }}>
          <ControlGroup label="Business unit">
            {(['Both', 'Hair', 'LHC'] as BuFilter[]).map((v) => (
              <ToggleBtn key={v} active={bu === v} onClick={() => setBu(v)}>
                {v}
              </ToggleBtn>
            ))}
          </ControlGroup>
          <ControlGroup label="Shift year">
            {[2027, 2030, 2033, 2036].map((y) => (
              <ToggleBtn key={y} active={year === y} onClick={() => setYear(y)}>
                {y}
              </ToggleBtn>
            ))}
          </ControlGroup>
          <div style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 11, color: S.onSurfaceVariant,
          }}>
            {loading && <Loader2 size={13} className="animate-spin" />}
            {simulation?.shifts
              ? <><Sparkles size={11} color={S.primary}/> <span>PRISM simulation loaded</span></>
              : <><Info size={11}/> <span>No PRISM simulation — run one on the Profit Pool tab</span></>
            }
          </div>
        </div>

        {/* ── Chart card ──────────────────────────────────── */}
        <div style={{
          backgroundColor: S.surface, border: `1px solid ${S.cardBorder}`,
          borderRadius: 16, padding: 24, position: 'relative',
        }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            style={{ display: 'block', overflow: 'visible' }}
            role="img"
            aria-label="HCB profit pool — Bain classic chart"
          >
            {/* Y-axis gridlines */}
            {yTicks.map((t) => {
              const y = yScale(t);
              return (
                <g key={`gy-${t}`}>
                  <line
                    x1={PAD.left} x2={PAD.left + innerW} y1={y} y2={y}
                    stroke={S.cardBorder} strokeDasharray="2 4" strokeWidth={1}
                  />
                  <text
                    x={PAD.left - 10} y={y + 3} textAnchor="end"
                    fontSize={10.5} fontFamily={MONO_FONT}
                    fill={S.mutedText}
                  >
                    {(t * 100).toFixed(0)}%
                  </text>
                </g>
              );
            })}

            {/* X-axis baseline */}
            <line
              x1={PAD.left} x2={PAD.left + innerW}
              y1={PAD.top + innerH} y2={PAD.top + innerH}
              stroke={S.outline} strokeWidth={1.5}
            />

            {/* X-axis ticks at 25/50/75/100 */}
            {[0, 0.25, 0.5, 0.75, 1.0].map((t) => {
              const x = xScale(t);
              return (
                <g key={`gx-${t}`}>
                  <line
                    x1={x} x2={x} y1={PAD.top + innerH} y2={PAD.top + innerH + 5}
                    stroke={S.outline} strokeWidth={1}
                  />
                  <text
                    x={x} y={PAD.top + innerH + 18} textAnchor="middle"
                    fontSize={10.5} fontFamily={MONO_FONT}
                    fill={S.mutedText}
                  >
                    {(t * 100).toFixed(0)}%
                  </text>
                </g>
              );
            })}

            {/* Bars */}
            {bars.map((b) => {
              const xA = xScale(b.x0);
              const xB = xScale(b.x1);
              const yT = yScale(b.y);
              const yB = yScale(0);
              const w  = Math.max(0, xB - xA);
              const h  = Math.max(0, yB - yT);
              const fill = COLOR_BY_ID[b.cat.id] ?? S.primary;

              // Label visible if bar is wide enough
              const showLabel = w > 34;

              // PRISM shift band color for subtle top-edge indicator
              const shifts = simulation?.shifts as
                | Record<string, Record<string | number, unknown>>
                | undefined;
              const sh = prismShiftFor(shifts, b.cat, year);
              const edge = toneColor[classifyDirection(sh).tone] ?? S.mutedText;

              return (
                <g
                  key={b.cat.id}
                  onMouseMove={(e) => onBarMove(b.cat, e)}
                  onMouseLeave={onBarLeave}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Fill */}
                  <rect
                    x={xA} y={yT} width={w} height={h}
                    fill={fill} fillOpacity={0.82}
                    stroke={S.surface} strokeWidth={1.5}
                  />
                  {/* PRISM direction edge */}
                  <rect
                    x={xA} y={yT - 3} width={w} height={3}
                    fill={edge} opacity={sh != null ? 0.9 : 0.25}
                  />
                  {/* Category short label */}
                  {showLabel && (
                    <text
                      x={xA + w / 2}
                      y={yT + 14}
                      textAnchor="middle"
                      fontSize={10.5}
                      fontWeight={700}
                      fontFamily={HEADLINE_FONT}
                      fill="#fff"
                      style={{ pointerEvents: 'none' }}
                    >
                      {shortLabel(b.cat)}
                    </text>
                  )}
                  {/* Transparent hover-capture on top */}
                  <rect
                    x={xA} y={PAD.top} width={w} height={innerH}
                    fill="transparent"
                  />
                </g>
              );
            })}

            {/* Axis titles */}
            <text
              x={PAD.left + innerW / 2} y={H - 12}
              textAnchor="middle" fontSize={11.5}
              fontFamily={HEADLINE_FONT} fontWeight={700} fill={S.onSurfaceVariant}
            >
              Cumulative revenue share (sorted by margin, descending)
            </text>
            <text
              x={14} y={PAD.top + innerH / 2}
              textAnchor="middle" fontSize={11.5}
              fontFamily={HEADLINE_FONT} fontWeight={700} fill={S.onSurfaceVariant}
              transform={`rotate(-90 14 ${PAD.top + innerH / 2})`}
            >
              Profitability — EBIT margin (%)
            </text>
          </svg>

          {/* Legend */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 10,
            marginTop: 16, paddingTop: 14,
            borderTop: `1px solid ${S.cardBorder}`,
          }}>
            {sorted.map((c) => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11, color: S.onBg,
              }}>
                <span style={{
                  width: 10, height: 10, borderRadius: 2,
                  backgroundColor: COLOR_BY_ID[c.id] ?? S.primary,
                }} />
                {c.name}
              </div>
            ))}
          </div>
        </div>

        {/* ── Reading guide ──────────────────────────────── */}
        <div style={{
          marginTop: 16, padding: 14,
          backgroundColor: S.surfaceLow, border: `1px solid ${S.cardBorder}`,
          borderRadius: 12, display: 'flex', gap: 10,
          fontSize: 11.5, color: S.onSurfaceVariant, lineHeight: 1.5,
        }}>
          <Info size={14} color={S.primary} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <b style={{ color: S.onBg }}>How to read:</b> Each bar's
            <i> width</i> is the category's share of global revenue, its
            <i> height</i> is EBIT margin; the <i>area</i> is the profit
            pool (€bn). A thin coloured stripe above each bar shows the
            PRISM direction of change for the selected year (green = tailwind,
            red = headwind). <b>Hover any bar</b> for sources, size, and a
            detailed 2030 outlook.
          </div>
        </div>

      </div>

      {/* ── Floating tooltip ─────────────────────────────── */}
      <AnimatePresence>
        {hover && (
          <PoolTooltip
            cat={hover.cat}
            year={year}
            simulation={simulation}
            x={hover.x}
            y={hover.y}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Shared UI primitives ─────────────────────────────────────────
const StatBlock: FC<{ label: string; value: string; tone?: 'primary' | 'default' }> = ({
  label, value, tone,
}) => (
  <div>
    <div style={{
      fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
      textTransform: 'uppercase', color: S.onSurfaceVariant,
    }}>
      {label}
    </div>
    <div style={{
      fontFamily: HEADLINE_FONT, fontSize: 18, fontWeight: 800,
      color: tone === 'primary' ? S.primary : S.onBg, letterSpacing: '-0.01em',
    }}>
      {value}
    </div>
  </div>
);

const Divider: FC = () => (
  <div style={{ width: 1, backgroundColor: S.cardBorder }} />
);

const ControlGroup: FC<{ label: string; children: React.ReactNode }> = ({
  label, children,
}) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '4px 6px', backgroundColor: S.surface,
    border: `1px solid ${S.cardBorder}`, borderRadius: 24,
  }}>
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
      textTransform: 'uppercase', color: S.onSurfaceVariant,
      padding: '0 8px',
    }}>
      {label}
    </span>
    {children}
  </div>
);

const ToggleBtn: FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active, onClick, children,
}) => (
  <button
    onClick={onClick}
    style={{
      padding: '5px 12px', borderRadius: 20, border: 'none',
      fontFamily: BODY_FONT, fontSize: 12, fontWeight: 600, cursor: 'pointer',
      backgroundColor: active ? S.primary : 'transparent',
      color: active ? '#fff' : S.onSurfaceVariant,
      transition: 'background-color 120ms ease',
    }}
  >
    {children}
  </button>
);

// ─── Helpers ─────────────────────────────────────────────────────
function shortLabel(cat: CategoryProfitPool): string {
  // Drop "Hair: " / "LHC: " prefix and trim
  const base = cat.name.replace(/^Hair:\s*/i, '').replace(/^LHC:\s*/i, '');
  return base.length > 18 ? base.slice(0, 17) + '…' : base;
}

export default ProfitPoolExplorer;
