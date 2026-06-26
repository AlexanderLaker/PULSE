/**
 * Profit Pool Explorer — Bain-classic pool views over verified public data
 * (admin-only; gating enforced at page level).
 *
 * v2 (2026-06-11):
 *   • ARROWS = POOL DEVELOPMENT. The indicator above each bar encodes the
 *     growth of the profit pool AREA (revenue × GP1), derived in
 *     `lib/profitPoolData.ts` as (1+revenueCAGR)×(1+marginCAGR)−1 — not
 *     revenue CAGR alone, and not GP1 level.
 *   • CLICK DRILL-DOWN. Clicking a bar opens an assessment panel that
 *     decomposes the pool trajectory into its two factors — revenue CAGR
 *     (verified) and GP1 margin development (graded estimate) — plus € pool
 *     sizes today → 2030, the Henkel read, and clickable sources.
 *   • HIERARCHICAL NAVIGATION. Group toggle (Laundry | Hair) with view
 *     sub-pills (Value Chain | Sub-Segments | Core + Adjacent).
 *   • CLICKABLE, GRADED SOURCES. Every figure links to a page where the
 *     cited number is visible (verified 2026-06-11); evidence grades use
 *     the Consumer-Journey grammar: ✅ reported · ⚡ derived · ⚠️ estimate.
 *   • The former year selector (2027/2030/2032/2035) was removed — it
 *     altered no data. The horizon is stated honestly: FY2025 → 2030.
 *
 * Chart grammar (Bain pool chart): X = revenue share · Y = GP1 margin ·
 * Area = profit pool · order locked as authored (chain / format logic).
 */

'use client';

import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Info, ChevronLeft, ChevronRight, Loader2, Sparkles, X, ExternalLink,
} from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import {
  PROFIT_POOL_SLIDES,
  POOL_CAGR_THRESHOLDS,
  POOL_HORIZON_LABEL,
  poolCagr,
  gp1Terminal,
  itemRevenueEurBn,
  itemGp1PoolEurBn,
  itemGp1PoolEurBnTerminal,
  slidePoolSummary,
  toPoolRating,
  toCagrRating,
  toGp1Rating,
  type ProfitPoolSlide,
  type SlideItem,
  type SlideKind,
  type PoolGroup,
  type CagrRating,
  type SourceRef,
  type EvidenceGrade,
} from '@/lib/profitPoolData';

// ─── Editorial design tokens (Maritime light) ────────────────────
const S = {
  bg:                  '#f8f9ff',
  surface:             '#ffffff',
  surfaceLow:          '#eff4ff',
  surfaceHigh:         '#dce9ff',
  primary:             '#005db5',
  primaryDim:          '#0052a0',
  onBg:                '#00345e',
  onSurface:           '#00345e',
  onSurfaceVariant:    '#26619d',
  outline:             '#477dbb',
  cardBorder:          'rgba(0, 52, 94, 0.10)',
  cardBorderStrong:    'rgba(0, 52, 94, 0.16)',
  mutedText:           '#64748B',
  greenStrong:         '#0F7A3D',
  redStrong:           '#7F1D1D',
  neutral:             '#94A3B8',
  amber:               '#B45309',
  amberSoft:           '#FEF3C7',
  greenSoft:           '#D1FAE5',
  blueSoft:            '#DBEAFE',
};

const HEADLINE_FONT = "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const BODY_FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

const BAR_FILL = 'rgba(214, 227, 255, 0.85)';
const BAR_FILL_ACTIVE = 'rgba(178, 205, 255, 0.95)';
const BAR_STROKE = S.primaryDim;

const arrowColorFor = (tone: CagrRating['tone']): string =>
  tone === 'green' ? S.greenStrong : tone === 'red' ? S.redStrong : S.neutral;

const arrowGlyphs = (rating: CagrRating): string =>
  rating.direction === 'flat' ? '↔' :
  rating.direction === 'up'   ? '↑'.repeat(rating.arrows) :
                                '↓'.repeat(rating.arrows);

const fmtEurBn = (bn: number): string =>
  `€${bn >= 10 ? bn.toFixed(0) : bn.toFixed(1)}bn`;

const fmtPct = (v: number, dp = 1): string =>
  `${v > 0 ? '+' : ''}${(v * 100).toFixed(dp)}%`;

// ─── Arrow stacks (shared glyph treatment) ───────────────────────
const ArrowsSVG: FC<{ rating: CagrRating; cx: number; cy: number; ariaPrefix: string }> = ({
  rating, cx, cy, ariaPrefix,
}) => (
  <text
    x={cx} y={cy - 5}
    fontSize={14} fontWeight={800}
    fill={arrowColorFor(rating.tone)}
    textAnchor="middle" fontFamily={HEADLINE_FONT}
    style={{ letterSpacing: -1 }}
    aria-label={`${ariaPrefix}: ${rating.label} (${rating.direction}${rating.arrows ? ` ${rating.arrows}/3` : ''})`}
  >
    {arrowGlyphs(rating)}
  </text>
);

const ArrowsHTML: FC<{ rating: CagrRating; size?: number }> = ({ rating, size = 15 }) => (
  <span
    style={{
      fontSize: size, fontWeight: 800, color: arrowColorFor(rating.tone),
      letterSpacing: -1, fontFamily: HEADLINE_FONT, lineHeight: 1,
    }}
    aria-hidden
  >
    {arrowGlyphs(rating)}
  </span>
);

// ─── Evidence grade chip — same grammar as the Consumer Journey ──
const GRADE_META: Record<EvidenceGrade, { glyph: string; label: string; fg: string; bg: string }> = {
  reported: { glyph: '✅', label: 'Reported', fg: S.greenStrong, bg: S.greenSoft },
  derived:  { glyph: '⚡', label: 'Derived',  fg: S.primaryDim,  bg: S.blueSoft },
  estimate: { glyph: '⚠️', label: 'Estimate', fg: S.amber,       bg: S.amberSoft },
};

const GradeChip: FC<{ grade: EvidenceGrade; compact?: boolean }> = ({ grade, compact }) => {
  const m = GRADE_META[grade];
  return (
    <span
      title={`${m.label} — ${grade === 'reported'
        ? 'figure as published at the linked page'
        : grade === 'derived'
          ? 'arithmetic on published figures (basis stated)'
          : 'structured judgment (basis stated)'}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 9, fontWeight: 700, color: m.fg, background: m.bg,
        padding: compact ? '1px 6px' : '2px 8px', borderRadius: 999,
        whiteSpace: 'nowrap', lineHeight: 1.5,
      }}
    >
      <span aria-hidden>{m.glyph}</span>{m.label}
    </span>
  );
};

// ─── Clickable source line ───────────────────────────────────────
const SourceLink: FC<{ src: SourceRef }> = ({ src }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
      <a
        href={src.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: 11, fontWeight: 600, color: S.primaryDim, lineHeight: 1.45,
          textDecoration: 'underline', textDecorationColor: 'rgba(0,93,181,0.35)',
          textUnderlineOffset: 2, wordBreak: 'break-word',
        }}
      >
        {src.label}
        <ExternalLink size={10} style={{ display: 'inline', marginLeft: 4, verticalAlign: 'baseline' }} aria-hidden />
      </a>
      <span style={{ flexShrink: 0 }}><GradeChip grade={src.grade} compact /></span>
    </div>
    {src.detail && (
      <div style={{ fontSize: 10, color: S.mutedText, lineHeight: 1.45 }}>{src.detail}</div>
    )}
  </div>
);

// ─── Hover tooltip (slim — click carries the depth) ──────────────
const HoverTip: FC<{ item: SlideItem; slide: ProfitPoolSlide; x: number; y: number }> = ({
  item, slide, x, y,
}) => {
  const pool = poolCagr(item);
  const rating = toPoolRating(pool);
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const placeLeft = x > vw - 300;
  const name = item.sublabel ? `${item.label} ${item.sublabel}`.trim() : item.label;
  const gp1PoolShare = itemGp1PoolEurBn(slide, item) /
    (slide.items.reduce((s, it) => s + itemGp1PoolEurBn(slide, it), 0) || 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.12 }}
      style={{
        position: 'fixed', left: placeLeft ? x - 280 : x + 18, top: Math.max(12, y - 92),
        width: 264, background: S.surface, borderRadius: 12,
        border: `1px solid ${S.cardBorderStrong}`,
        boxShadow: '0 20px 50px -18px rgba(0,52,94,0.28)',
        padding: 14, fontFamily: BODY_FONT, color: S.onSurface,
        zIndex: 1000, pointerEvents: 'none',
      }}
    >
      <div style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 14, color: S.onBg, marginBottom: 6 }}>
        {name}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: S.surfaceLow, borderRadius: 8, padding: '7px 10px', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: S.outline }}>
            Pool development · {POOL_HORIZON_LABEL}
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, fontFamily: HEADLINE_FONT, color: arrowColorFor(rating.tone), fontVariantNumeric: 'tabular-nums' }}>
            {rating.label} p.a.
          </div>
        </div>
        <ArrowsHTML rating={rating} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
        <MiniMetric label="Revenue" value={`${(item.revenueShare * 100).toFixed(1)}%`} />
        <MiniMetric label="GP1" value={`${(item.gp1Margin * 100).toFixed(1)}%`} />
        <MiniMetric label="Pool share" value={`${(gp1PoolShare * 100).toFixed(1)}%`} />
      </div>
      <div style={{ fontSize: 10, color: S.primaryDim, fontWeight: 700 }}>
        Click the bar for the full assessment →
      </div>
    </motion.div>
  );
};

const MiniMetric: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: S.outline, marginBottom: 1 }}>
      {label}
    </div>
    <div style={{ fontSize: 13, fontWeight: 800, color: S.onBg, fontFamily: HEADLINE_FONT, fontVariantNumeric: 'tabular-nums' }}>
      {value}
    </div>
  </div>
);

// ─── Drill-down assessment panel (right drawer) ──────────────────
const DetailPanel: FC<{
  slide: ProfitPoolSlide;
  item: SlideItem;
  onClose: () => void;
}> = ({ slide, item, onClose }) => {
  const reduceMotion = useReducedMotion();
  const pool = poolCagr(item);
  const poolRating = toPoolRating(pool);
  const revRating = toCagrRating(item.revenueCAGR);
  const gp1Rating = toGp1Rating(item.gp1DeltaBps);
  const name = item.sublabel ? `${item.label} ${item.sublabel}`.trim() : item.label;

  const revEur = itemRevenueEurBn(slide, item);
  const gp1Now = itemGp1PoolEurBn(slide, item);
  const gp1End = itemGp1PoolEurBnTerminal(slide, item);
  const gp1PoolShare = gp1Now / (slide.items.reduce((s, it) => s + itemGp1PoolEurBn(slide, it), 0) || 1);
  const marginCagr = (1 + pool) / (1 + item.revenueCAGR) - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,32,62,0.32)', zIndex: 1090 }}
        aria-hidden
      />
      {/* Drawer */}
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={`${name} — profit pool assessment`}
        initial={reduceMotion ? { opacity: 0 } : { x: 440, opacity: 0.6 }}
        animate={reduceMotion ? { opacity: 1 } : { x: 0, opacity: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { x: 440, opacity: 0.6 }}
        transition={{ type: 'tween', duration: 0.22, ease: [0.32, 0.72, 0.25, 1] }}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(420px, 94vw)',
          background: S.surface, zIndex: 1100, overflowY: 'auto',
          borderLeft: `1px solid ${S.cardBorderStrong}`,
          boxShadow: '-32px 0 80px -32px rgba(0,52,94,0.35)',
          fontFamily: BODY_FONT, color: S.onSurface,
        }}
      >
        <div style={{ padding: '20px 22px 28px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: S.outline, marginBottom: 4 }}>
                {slide.kind === 'ValueChain' ? 'Value chain tier' : slide.kind === 'SubSegment' ? 'Sub-segment' : 'Core / adjacent pool'}
                {' · '}{slide.group === 'Hair' ? 'Hair' : 'Laundry'}
              </div>
              <h2 style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 20, color: S.onBg, margin: 0, lineHeight: 1.2 }}>
                {name}
              </h2>
              {item.note && (
                <div style={{ fontSize: 11, color: S.mutedText, marginTop: 3, lineHeight: 1.4 }}>{item.note}</div>
              )}
            </div>
            <button
              onClick={onClose}
              autoFocus
              aria-label="Close assessment panel"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                background: S.surfaceLow, border: `1px solid ${S.cardBorder}`,
                cursor: 'pointer', color: S.onBg,
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Hero — profit pool development */}
          <div
            style={{
              background: S.surfaceLow, borderRadius: 14, padding: '14px 16px',
              border: `1px solid ${S.cardBorder}`, marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: S.outline, marginBottom: 6 }}>
              Profit pool development · {POOL_HORIZON_LABEL}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontSize: 26, fontWeight: 800, fontFamily: HEADLINE_FONT, color: arrowColorFor(poolRating.tone), fontVariantNumeric: 'tabular-nums' }}>
                {poolRating.label} <span style={{ fontSize: 13, fontWeight: 700 }}>p.a.</span>
              </div>
              <ArrowsHTML rating={poolRating} size={24} />
            </div>
            <div style={{ fontSize: 12, color: S.onSurfaceVariant, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
              GP1 pool {fmtEurBn(gp1Now)} → <b>{fmtEurBn(gp1End)}</b> by 2030
            </div>
            <div style={{ fontSize: 10, color: S.mutedText, marginTop: 6, lineHeight: 1.5 }}>
              Pool = revenue × GP1. Composition: ({fmtPct(item.revenueCAGR)} revenue) × ({fmtPct(marginCagr, 2)} margin drift) = {fmtPct(pool)} pool p.a.
            </div>
          </div>

          {/* Decomposition — the two factors */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            <FactorRow
              title="Revenue CAGR"
              rating={revRating}
              valueLabel={`${revRating.label} p.a.`}
              driver={item.revenueDriver}
            />
            <FactorRow
              title={`GP1 margin development (${(item.gp1Margin * 100).toFixed(1)}% → ${(gp1Terminal(item) * 100).toFixed(1)}%)`}
              rating={gp1Rating}
              valueLabel={gp1Rating.label}
              driver={item.marginDriver}
            />
          </div>

          {/* Position metrics */}
          <div
            style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
              padding: '12px 0', borderTop: `1px solid ${S.surfaceHigh}`,
              borderBottom: `1px solid ${S.surfaceHigh}`, marginBottom: 14,
            }}
          >
            <PanelMetric label="Revenue pool" value={fmtEurBn(revEur)} sub={`${(item.revenueShare * 100).toFixed(1)}% of view`} />
            <PanelMetric label="GP1 margin" value={`${(item.gp1Margin * 100).toFixed(1)}%`} sub={`→ ${(gp1Terminal(item) * 100).toFixed(1)}% by 2030`} />
            <PanelMetric label="GP1 profit pool" value={fmtEurBn(gp1Now)} sub={`${(gp1PoolShare * 100).toFixed(1)}% of view GP1 pool`} />
            <PanelMetric label="Pool by 2030" value={fmtEurBn(gp1End)} sub={`${fmtPct(pool)} p.a. compounded`} />
          </div>

          {/* Henkel read */}
          {item.henkelAngle && (
            <div
              style={{
                background: '#FFFFFF', border: `1px solid ${S.cardBorderStrong}`,
                borderLeft: `3px solid ${S.primary}`, borderRadius: 10,
                padding: '10px 12px', marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: S.primary, marginBottom: 4 }}>
                Henkel read — qualitative
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.55, color: S.onSurface }}>{item.henkelAngle}</div>
            </div>
          )}

          {/* Sources */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: S.outline, marginBottom: 8 }}>
              Sources — revenue / size
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {item.sources.revenue.map((s, i) => <SourceLink key={`r${i}`} src={s} />)}
            </div>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: S.outline, marginBottom: 8 }}>
              Sources — margin calibration
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {item.sources.margin.map((s, i) => <SourceLink key={`m${i}`} src={s} />)}
            </div>
          </div>

          <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${S.surfaceHigh}`, fontSize: 10, color: S.mutedText, lineHeight: 1.55 }}>
            GP1 / CM1 is not separately disclosed at tier level by any player; tier margins are
            structured estimates calibrated against the linked, verified company gross margins
            (grades shown). Nominal terms; € at planning rate 1.15. Verified 2026-06-11.
          </div>
        </div>
      </motion.aside>
    </>
  );
};

const FactorRow: FC<{ title: string; rating: CagrRating; valueLabel: string; driver: string }> = ({
  title, rating, valueLabel, driver,
}) => (
  <div style={{ background: S.surface, border: `1px solid ${S.cardBorder}`, borderRadius: 12, padding: '10px 12px' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: S.outline }}>
        {title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800, fontFamily: HEADLINE_FONT, color: arrowColorFor(rating.tone), fontVariantNumeric: 'tabular-nums' }}>
          {valueLabel}
        </span>
        <ArrowsHTML rating={rating} size={13} />
      </div>
    </div>
    <div style={{ fontSize: 11.5, color: S.onSurfaceVariant, lineHeight: 1.5 }}>{driver}</div>
  </div>
);

const PanelMetric: FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div>
    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: S.outline, marginBottom: 2 }}>
      {label}
    </div>
    <div style={{ fontSize: 16, fontWeight: 800, color: S.onBg, fontFamily: HEADLINE_FONT, fontVariantNumeric: 'tabular-nums' }}>
      {value}
    </div>
    {sub && <div style={{ fontSize: 10, color: S.mutedText, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{sub}</div>}
  </div>
);

// ─── Pool Chart (SVG) ────────────────────────────────────────────
interface PoolChartProps {
  slide: ProfitPoolSlide;
  selectedId: string | null;
  onHover: (item: SlideItem, x: number, y: number) => void;
  onLeave: () => void;
  onSelect: (item: SlideItem) => void;
}

interface BarGeom {
  item: SlideItem;
  xPx0: number;
  xPx1: number;
  hPx: number;
  poolRating: CagrRating;
}

/** Pure geometry — outside the component so render never reassigns. */
function computeBars(
  items: SlideItem[], ml: number, plotW: number, plotH: number, yMax: number,
): BarGeom[] {
  const totalShare = items.reduce((s, it) => s + it.revenueShare, 0) || 1;
  const out: BarGeom[] = [];
  let cum = 0;
  for (const it of items) {
    const x0 = cum;
    cum += it.revenueShare / totalShare;
    out.push({
      item: it,
      xPx0: ml + x0 * plotW,
      xPx1: ml + cum * plotW,
      hPx: (it.gp1Margin / yMax) * plotH,
      poolRating: toPoolRating(poolCagr(it)),
    });
  }
  return out;
}

const PoolChart: FC<PoolChartProps> = ({ slide, selectedId, onHover, onLeave, onSelect }) => {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const ordered = slide.items;
  const W = 960;
  const H = 420;
  const ML = 56, MR = 20, MT = 32, MB = 104;
  const plotW = W - ML - MR;
  const plotH = H - MT - MB;

  const yMax = Math.max(0.40, Math.ceil(
    Math.max(...ordered.map(it => it.gp1Margin)) * 100 / 5,
  ) / 20);
  const yTicks = [0, 0.10, 0.20, 0.30, 0.40];

  const bars = useMemo(
    () => computeBars(ordered, ML, plotW, plotH, yMax),
    [ordered, ML, plotW, plotH, yMax],
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', fontFamily: BODY_FONT }}
      role="group"
      aria-label={`${slide.title} — pool chart; arrows show profit-pool development ${POOL_HORIZON_LABEL}`}
    >
      {yTicks.map(t => {
        const y = MT + plotH - (t / yMax) * plotH;
        return (
          <g key={t}>
            <line
              x1={ML} x2={ML + plotW} y1={y} y2={y}
              stroke={S.surfaceHigh} strokeWidth={1}
              strokeDasharray={t === 0 ? '' : '3 3'}
            />
            <text
              x={ML - 10} y={y + 4}
              fontSize={11} fill={S.outline}
              textAnchor="end" fontFamily={HEADLINE_FONT} fontWeight={600}
            >
              {(t * 100).toFixed(0)}%
            </text>
          </g>
        );
      })}

      <text
        x={ML - 48} y={MT + plotH / 2}
        fontSize={11} fill={S.outline} textAnchor="middle"
        fontFamily={HEADLINE_FONT} fontWeight={700}
        transform={`rotate(-90, ${ML - 48}, ${MT + plotH / 2})`}
      >
        GP1 / Contribution Margin 1 — ⚠️ estimated (not company-reported)
      </text>
      <text
        x={ML + plotW / 2} y={H - 6}
        fontSize={11} fill={S.outline} textAnchor="middle"
        fontFamily={HEADLINE_FONT} fontWeight={700}
      >
        Revenue share (% of view) — order: value chain / format logic · arrows = pool development {POOL_HORIZON_LABEL}
      </text>

      {bars.map((b) => {
        const y = MT + plotH - b.hPx;
        const w = Math.max(2, b.xPx1 - b.xPx0);
        const cx = b.xPx0 + w / 2;
        const isSelected = selectedId === b.item.id;
        const isFocused = focusedId === b.item.id;
        // Micro-pools (<14px) keep their honest area but drop decoration —
        // labels/arrows would collide; hover & click carry their identity.
        const labeled = w >= 14;
        const name = b.item.sublabel ? `${b.item.label} ${b.item.sublabel}` : b.item.label;
        return (
          <g
            key={b.item.id}
            style={{ cursor: 'pointer', outline: 'none' }}
            role="button"
            tabIndex={0}
            onFocus={() => setFocusedId(b.item.id)}
            onBlur={() => setFocusedId(null)}
            aria-label={`${name}: ${(b.item.revenueShare * 100).toFixed(1)}% revenue share, ${(b.item.gp1Margin * 100).toFixed(1)}% GP1, pool development ${b.poolRating.label} per year. Press Enter for the full assessment.`}
            onMouseEnter={(e) => onHover(b.item, e.clientX, e.clientY)}
            onMouseMove={(e) => onHover(b.item, e.clientX, e.clientY)}
            onMouseLeave={onLeave}
            onClick={() => onSelect(b.item)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(b.item); }
            }}
          >
            <rect
              x={b.xPx0} y={y} width={w} height={b.hPx}
              fill={isSelected || isFocused ? BAR_FILL_ACTIVE : BAR_FILL}
              stroke={isSelected || isFocused ? S.primary : BAR_STROKE}
              strokeWidth={isSelected || isFocused ? 2 : 1.25}
              strokeDasharray={isFocused && !isSelected ? '4 2' : undefined}
              rx={2}
            />
            {b.hPx > 22 && w > 28 && (
              <text
                x={cx} y={y + 15}
                fontSize={11} fontWeight={800}
                fill={S.onBg}
                textAnchor="middle" fontFamily={HEADLINE_FONT}
              >
                {(b.item.gp1Margin * 100).toFixed(0)}%
              </text>
            )}
            {labeled && (
              <text
                x={cx} y={MT + plotH + 14}
                fontSize={11} fill={S.primaryDim} fontWeight={700}
                textAnchor="middle" fontFamily={HEADLINE_FONT}
              >
                {(b.item.revenueShare * 100) >= 1
                  ? (b.item.revenueShare * 100).toFixed(0)
                  : (b.item.revenueShare * 100).toFixed(1)}%
              </text>
            )}
            {labeled && (
              <text
                x={cx} y={MT + plotH + 26}
                fontSize={11} fill={S.onSurface} fontWeight={600}
                textAnchor="end" fontFamily={BODY_FONT}
                transform={`rotate(-35, ${cx}, ${MT + plotH + 26})`}
              >
                {name}
              </text>
            )}
            {/* Pool-development arrows — revenue × GP1, not revenue alone */}
            {labeled && (
              <ArrowsSVG rating={b.poolRating} cx={cx} cy={y} ariaPrefix="Pool development" />
            )}
          </g>
        );
      })}
    </svg>
  );
};

// ─── Hierarchical navigation: group toggle + view pills ──────────
const GROUPS: { id: PoolGroup; label: string }[] = [
  { id: 'LHC', label: 'Laundry' },
  { id: 'Hair', label: 'Hair' },
];
const KINDS: { id: SlideKind; label: string }[] = [
  { id: 'ValueChain', label: 'Value Chain' },
  { id: 'SubSegment', label: 'Sub-Segments' },
  { id: 'CoreAdjacent', label: 'Core + Adjacent' },
];

const GroupToggle: FC<{ group: PoolGroup; onSelect: (g: PoolGroup) => void }> = ({ group, onSelect }) => (
  <div
    role="tablist"
    aria-label="Category"
    style={{
      display: 'inline-flex', gap: 4, padding: 4,
      background: S.surfaceLow, borderRadius: 12,
      border: `1px solid ${S.cardBorder}`,
    }}
  >
    {GROUPS.map(g => {
      const active = g.id === group;
      return (
        <button
          key={g.id}
          role="tab"
          aria-selected={active}
          onClick={() => onSelect(g.id)}
          style={{
            padding: '9px 22px', borderRadius: 9, border: 'none',
            background: active ? S.primary : 'transparent',
            color: active ? '#fff' : S.onBg,
            fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 13,
            cursor: 'pointer', transition: 'all 0.15s', letterSpacing: -0.2,
          }}
        >
          {g.label}
        </button>
      );
    })}
  </div>
);

const KindPills: FC<{ kind: SlideKind; onSelect: (k: SlideKind) => void }> = ({ kind, onSelect }) => (
  <div role="tablist" aria-label="View" style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
    {KINDS.map(k => {
      const active = k.id === kind;
      return (
        <button
          key={k.id}
          role="tab"
          aria-selected={active}
          onClick={() => onSelect(k.id)}
          style={{
            padding: '7px 14px', borderRadius: 999,
            border: `1px solid ${active ? S.primary : S.cardBorder}`,
            background: active ? 'rgba(0,93,181,0.08)' : S.surface,
            color: active ? S.primary : S.onSurfaceVariant,
            fontFamily: HEADLINE_FONT, fontWeight: 700, fontSize: 12,
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          {k.label}
        </button>
      );
    })}
  </div>
);

// ─── Main component ──────────────────────────────────────────────
const ProfitPoolExplorer: FC = () => {
  const { loading } = usePrism();
  const [group, setGroup] = useState<PoolGroup>('LHC');
  const [kind, setKind] = useState<SlideKind>('ValueChain');
  const [hover, setHover] = useState<{ item: SlideItem; x: number; y: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const slide = useMemo(
    () =>
      PROFIT_POOL_SLIDES.find(s => s.group === group && s.kind === kind)
      ?? PROFIT_POOL_SLIDES[0],
    [group, kind],
  );

  const selectedItem = useMemo(
    () => slide.items.find(it => it.id === selectedId) ?? null,
    [slide, selectedId],
  );

  const summary = useMemo(() => slidePoolSummary(slide), [slide]);
  const slidePoolRating = toPoolRating(summary.weightedPoolCagr);

  // Unique clickable sources across the slide (deduped by URL).
  const slideSources = useMemo(() => {
    const seen = new Map<string, SourceRef>();
    slide.items.forEach(it =>
      [...it.sources.revenue, ...it.sources.margin].forEach(s => {
        if (!seen.has(s.url)) seen.set(s.url, s);
      }),
    );
    return Array.from(seen.values());
  }, [slide]);

  const closePanel = useCallback(() => setSelectedId(null), []);

  const slideIdx = PROFIT_POOL_SLIDES.findIndex(s => s.id === slide.id);
  const go = (delta: number) => {
    const next = PROFIT_POOL_SLIDES[(slideIdx + delta + PROFIT_POOL_SLIDES.length) % PROFIT_POOL_SLIDES.length];
    setGroup(next.group);
    setKind(next.kind);
    setSelectedId(null);
  };

  return (
    <div
      style={{
        padding: '0 8px',
        fontFamily: BODY_FONT,
        color: S.onBg,
        background: S.bg,
        minHeight: '100%',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase', color: S.primary, marginBottom: 4 }}>
            Admin · Profit Pool Explorer
          </div>
          <h1 style={{ fontFamily: HEADLINE_FONT, fontSize: 28, fontWeight: 800, color: S.onBg, margin: 0, letterSpacing: -0.5 }}>
            Industry Profit Pools — HCB Lens
          </h1>
          <p style={{ color: S.mutedText, fontSize: 13, margin: '6px 0 0', maxWidth: 760 }}>
            Bain-classic pool views over verified public data. Arrows show the development of the
            <b> profit pool</b> (revenue × GP1, {POOL_HORIZON_LABEL}) — click any bar for the
            revenue / margin decomposition, € pool sizes and clickable sources.
            Y-axis = <b>GP1 / Contribution Margin 1</b>.
          </p>
        </div>

        {/* Horizon badge + slide nav */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div
            style={{
              padding: '8px 14px', borderRadius: 10,
              background: S.surface, border: `1px solid ${S.cardBorder}`,
              fontFamily: HEADLINE_FONT, fontWeight: 700, fontSize: 12, color: S.onSurfaceVariant,
            }}
            title="All development indicators compound over this horizon"
          >
            Horizon · {POOL_HORIZON_LABEL}
          </div>
          <button
            onClick={() => go(-1)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: 10, background: S.surface,
              border: `1px solid ${S.cardBorder}`, cursor: 'pointer', color: S.onBg,
            }}
            title="Previous view"
            aria-label="Previous view"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => go(+1)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: 10, background: S.surface,
              border: `1px solid ${S.cardBorder}`, cursor: 'pointer', color: S.onBg,
            }}
            title="Next view"
            aria-label="Next view"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Hierarchical navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        <GroupToggle group={group} onSelect={(g) => { setGroup(g); setSelectedId(null); }} />
        <div style={{ width: 1, height: 26, background: S.cardBorderStrong }} aria-hidden />
        <KindPills kind={kind} onSelect={(k) => { setKind(k); setSelectedId(null); }} />
      </div>

      {/* Main card */}
      <div
        style={{
          background: S.surface,
          border: `1px solid ${S.cardBorder}`,
          borderRadius: 20,
          padding: 28,
          boxShadow: '0 24px 60px -30px rgba(0,52,94,0.18)',
        }}
      >
        {/* Card title + pool summary */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: S.outline, marginBottom: 4 }}>
              {group === 'Hair' ? 'Hair' : 'Laundry'} · {KINDS.find(k => k.id === kind)?.label} · revenue pool {slide.poolSize}
            </div>
            <div style={{ fontFamily: HEADLINE_FONT, fontSize: 22, fontWeight: 800, color: S.onBg, lineHeight: 1.2 }}>
              {slide.title}
            </div>
            <div style={{ fontSize: 12, color: S.mutedText, marginTop: 4 }}>
              {slide.subtitle}
            </div>
          </div>

          {/* GP1 pool trajectory badge — area-weighted, not revenue-weighted */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '10px 14px', borderRadius: 12,
              background: S.surfaceLow,
              border: `1px solid ${S.cardBorder}`,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: S.outline }}>
                GP1 pool · {POOL_HORIZON_LABEL}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, fontFamily: HEADLINE_FONT, color: S.onBg, fontVariantNumeric: 'tabular-nums' }}>
                {fmtEurBn(summary.gp1PoolNowEurBn)} → {fmtEurBn(summary.gp1PoolTerminalEurBn)}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: arrowColorFor(slidePoolRating.tone), fontVariantNumeric: 'tabular-nums' }}>
                {slidePoolRating.label} p.a. pool-weighted
              </div>
            </div>
            <ArrowsHTML rating={slidePoolRating} size={20} />
          </div>
        </div>

        {/* Chart */}
        <div style={{ position: 'relative', marginTop: 18 }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.6)', zIndex: 5, borderRadius: 12 }}>
              <Loader2 size={24} className="animate-spin" color={S.primary} />
            </div>
          )}
          <PoolChart
            slide={slide}
            selectedId={selectedId}
            onHover={(item, x, y) => { if (!selectedId) setHover({ item, x, y }); }}
            onLeave={() => setHover(null)}
            onSelect={(item) => { setHover(null); setSelectedId(item.id); }}
          />
        </div>

        {/* Legend — pool ladder + evidence grades */}
        <div
          style={{
            display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center',
            padding: '14px 0 4px', borderTop: `1px solid ${S.surfaceHigh}`,
            marginTop: 18,
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: S.outline }}>
            Pool development p.a.
          </span>
          <ArrowLegend rating={toPoolRating(0.08)}  label={`≥ ${(POOL_CAGR_THRESHOLDS.two * 100).toFixed(0)}% growth`} />
          <ArrowLegend rating={toPoolRating(0.045)} label={`${(POOL_CAGR_THRESHOLDS.one * 100).toFixed(0)}–${(POOL_CAGR_THRESHOLDS.two * 100).toFixed(0)}%`} />
          <ArrowLegend rating={toPoolRating(0.015)} label={`${(POOL_CAGR_THRESHOLDS.flat * 100).toFixed(1)}–${(POOL_CAGR_THRESHOLDS.one * 100).toFixed(0)}%`} />
          <ArrowLegend rating={toPoolRating(0)}     label={`flat (< ${(POOL_CAGR_THRESHOLDS.flat * 100).toFixed(1)}%)`} />
          <ArrowLegend rating={toPoolRating(-0.02)} label="decline (mirrored)" />
          <div style={{ width: 1, height: 16, background: S.cardBorderStrong }} aria-hidden />
          <GradeChip grade="reported" compact />
          <GradeChip grade="derived" compact />
          <GradeChip grade="estimate" compact />
          <div style={{ marginLeft: 'auto', fontSize: 10, color: S.mutedText }}>
            Nominal terms · € at 1.15 · click any bar for the full assessment
          </div>
        </div>
      </div>

      {/* Insights + construction + sources */}
      <div style={{ marginTop: 18, padding: 20, background: S.surface, border: `1px solid ${S.cardBorder}`, borderRadius: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Sparkles size={16} color={S.primary} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: S.primary }}>
            Profit Pool Architecture · Key Insights
          </span>
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {slide.insights.map((text, i) => (
            <li
              key={i}
              style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                fontSize: 13, color: S.onSurface, lineHeight: 1.5,
              }}
            >
              <Info size={14} color={S.primary} style={{ flexShrink: 0, marginTop: 3 }} />
              <span>{text}</span>
            </li>
          ))}
        </ul>

        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${S.surfaceHigh}` }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: S.outline, marginBottom: 5 }}>
            How this view is built
          </div>
          <div style={{ fontSize: 11, color: S.mutedText, lineHeight: 1.55, maxWidth: 980 }}>
            {slide.construction}
          </div>
        </div>

        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${S.surfaceHigh}` }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: S.outline, marginBottom: 7 }}>
            Sources used in this view — every link shows the cited figure (verified 2026-06-11)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {slideSources.map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                title={s.label}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 10, fontWeight: 600, color: S.primaryDim,
                  background: S.surfaceLow, border: `1px solid ${S.cardBorder}`,
                  padding: '4px 9px', borderRadius: 999, textDecoration: 'none',
                  maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.label.split(' — ')[0]}
                </span>
                <ExternalLink size={9} style={{ flexShrink: 0 }} aria-hidden />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hover && !selectedItem && (
          <HoverTip item={hover.item} slide={slide} x={hover.x} y={hover.y} />
        )}
      </AnimatePresence>

      {/* Drill-down panel */}
      <AnimatePresence>
        {selectedItem && (
          <DetailPanel slide={slide} item={selectedItem} onClose={closePanel} />
        )}
      </AnimatePresence>
    </div>
  );
};

const ArrowLegend: FC<{ rating: CagrRating; label: string }> = ({ rating, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <ArrowsHTML rating={rating} size={11} />
    <span style={{ fontSize: 11, color: S.onSurfaceVariant, fontWeight: 600 }}>{label}</span>
  </div>
);

export default ProfitPoolExplorer;
