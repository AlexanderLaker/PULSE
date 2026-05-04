/**
 * Profit Pool Explorer — PPTX-aligned Slide View (admin-only)
 *
 * Each toggle = one slide from the "Profit Pool Henkel Design" deck:
 *   1. Hair Care — Industry Value Chain
 *   2. Laundry Care — Industry Value Chain
 *   3. Hair Care — Sub-Segment Profit Pools
 *   4. Hair Care — Core + Adjacent Profit Pools
 *   5. Laundry Care — Sub-Segment Profit Pools
 *   6. Laundry Care — Core + Adjacent Profit Pools
 *
 * Bain-classic pool chart:
 *   X = revenue share           |   Y = GP1 / Contribution Margin 1
 *   Area = profit pool           |   Order = descending GP1 margin
 *
 * Trend indicator:
 *   Bars are rendered in a single neutral palette — the growth signal
 *   above each bar is conveyed by CAGR arrows (1–3 green ▲ for positive,
 *   1–3 red ▼ for negative, single grey ↔ for flat). The thresholds
 *   that map a CAGR magnitude to 1, 2 or 3 arrows are defined once in
 *   `lib/profitPoolData.ts` (CAGR_THRESHOLDS) so every view stays
 *   consistent.
 *
 * Admin gating is enforced at the page level — this component assumes
 * the caller has already verified admin role.
 */

'use client';

import React, { FC, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Info, ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  Minus, Loader2, Sparkles,
} from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import {
  PROFIT_POOL_SLIDES,
  CAGR_THRESHOLDS,
  toCagrRating,
  type ProfitPoolSlide,
  type SlideItem,
  type CagrRating,
} from '@/lib/profitPoolData';
import type { SimulationResult } from '@/types';

// ─── Editorial design tokens ─────────────────────────────────────
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
  onBg:                '#00345e',
  onSurface:           '#00345e',
  onSurfaceVariant:    '#26619d',
  outline:             '#477dbb',
  outlineVariant:      '#81b5f6',
  cardBorder:          'rgba(0, 52, 94, 0.10)',
  cardBorderStrong:    'rgba(0, 52, 94, 0.16)',
  mutedText:           '#64748B',
  // PRISM tones
  greenStrong:         '#0F7A3D',
  green:               '#1F9D55',
  greenSoft:           '#D1FAE5',
  red:                 '#B3261E',
  redStrong:           '#7F1D1D',
  redSoft:             '#FEE2E2',
  neutral:             '#94A3B8',
  neutralSoft:         '#E2E8F0',
};

const HEADLINE_FONT = "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const BODY_FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

const YEARS = [2027, 2030, 2033, 2036] as const;
type Year = (typeof YEARS)[number];

// Single neutral bar palette — direction is conveyed by CAGR arrows,
// not by bar color anymore.
const BAR_FILL = 'rgba(214, 227, 255, 0.85)';
const BAR_STROKE = S.primaryDim;

// Resolve a CagrRating tone to a concrete color.
const arrowColorFor = (tone: CagrRating['tone']): string =>
  tone === 'green' ? S.greenStrong : tone === 'red' ? S.redStrong : S.neutral;

// Unicode arrow vocabulary — same glyphs the Consumer Journey detail
// slides use for direction × intensity. Single-line text rendering
// avoids the overlap issues of stacked SVG chevrons.
//   • Positive CAGR → '↑'.repeat(arrows)
//   • Negative CAGR → '↓'.repeat(arrows)
//   • Flat          → '↔'
const arrowGlyphs = (rating: CagrRating): string =>
  rating.direction === 'flat' ? '↔' :
  rating.direction === 'up'   ? '↑'.repeat(rating.arrows) :
                                '↓'.repeat(rating.arrows);

// SVG arrow text drawn just above a chart bar — one compact text
// element, no overlap with adjacent bars or the in-bar margin label.
const CagrArrowsSVG: FC<{
  rating: CagrRating;
  cx: number;
  cy: number;  // y where the bar TOP sits — arrows render just above
}> = ({ rating, cx, cy }) => (
  <text
    x={cx}
    y={cy - 5}
    fontSize={14}
    fontWeight={800}
    fill={arrowColorFor(rating.tone)}
    textAnchor="middle"
    fontFamily={HEADLINE_FONT}
    style={{ letterSpacing: -1 }}
    aria-label={
      rating.direction === 'flat'
        ? 'Flat CAGR'
        : `CAGR ${rating.direction} ${rating.arrows}/3`
    }
  >
    {arrowGlyphs(rating)}
  </text>
);

// HTML version — for the tooltip and the slide-level summary badge.
// Mirrors the Consumer Journey detail-slide treatment exactly:
// `fontSize: 15, letterSpacing: -1`, weight 700+, tone-colored.
const CagrArrowsHTML: FC<{ rating: CagrRating; size?: number }> = ({
  rating,
  size = 15,
}) => (
  <span
    style={{
      fontSize: size,
      fontWeight: 800,
      color: arrowColorFor(rating.tone),
      letterSpacing: -1,
      fontFamily: HEADLINE_FONT,
      lineHeight: 1,
    }}
    aria-label={
      rating.direction === 'flat'
        ? 'Flat CAGR'
        : `CAGR ${rating.direction} ${rating.arrows}/3`
    }
  >
    {arrowGlyphs(rating)}
  </span>
);

// ─── Tooltip ─────────────────────────────────────────────────────
interface TooltipProps {
  item: SlideItem;
  slide: ProfitPoolSlide;
  cagrRating: CagrRating;
  x: number;
  y: number;
}
const PoolTooltip: FC<TooltipProps> = ({ item, slide, cagrRating, x, y }) => {
  const profitShare = item.revenueShare * item.gp1Margin;
  const revPct = (item.revenueShare * 100).toFixed(1);
  const gp1Pct = (item.gp1Margin * 100).toFixed(1);
  const slidePoolTotal = slide.items.reduce(
    (s, it) => s + it.revenueShare * it.gp1Margin, 0,
  ) || 1;
  const profitShareOfPool = (profitShare / slidePoolTotal) * 100;
  const profitShareLbl = `${profitShareOfPool.toFixed(1)}%`;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const placeLeft = x > vw - 340;

  const name = item.sublabel ? `${item.label} ${item.sublabel}`.trim() : item.label;
  const cagrPct = (item.forwardCAGR * 100).toFixed(1);
  const cagrSign = item.forwardCAGR >= 0 ? '+' : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.15 }}
      style={{
        position: 'fixed',
        left: placeLeft ? x - 320 : x + 20,
        top: Math.max(12, y - 120),
        width: 320,
        background: S.surface,
        borderRadius: 14,
        border: `1px solid ${S.cardBorderStrong}`,
        boxShadow: '0 24px 60px -20px rgba(0,52,94,0.25)',
        padding: 18,
        fontFamily: BODY_FONT,
        color: S.onSurface,
        zIndex: 1000,
        pointerEvents: 'none',
      }}
    >
      {/* Name + slide kind */}
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
            textTransform: 'uppercase', color: S.outline, marginBottom: 4,
          }}
        >
          {slide.kind === 'ValueChain' ? 'Value Chain Tier'
           : slide.kind === 'SubSegment' ? 'Sub-Segment' : 'Core / Adjacent'}
        </div>
        <div
          style={{
            fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 17,
            color: S.onBg, lineHeight: 1.2,
          }}
        >
          {name}
        </div>
        {item.note && (
          <div style={{ fontSize: 11, color: S.mutedText, marginTop: 2 }}>
            {item.note}
          </div>
        )}
      </div>

      {/* Metrics row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 8,
          padding: '10px 0',
          borderTop: `1px solid ${S.surfaceHigh}`,
          borderBottom: `1px solid ${S.surfaceHigh}`,
          marginBottom: 12,
        }}
      >
        <Metric label="Revenue" value={`${revPct}%`} />
        <Metric label="GP1 margin" value={`${gp1Pct}%`} />
        <Metric label="Profit share" value={profitShareLbl} />
      </div>

      {/* Forward CAGR — single growth signal, with shared-threshold arrows */}
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
            textTransform: 'uppercase', color: S.outline, marginBottom: 6,
          }}
        >
          Forward CAGR
        </div>
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: S.surfaceLow,
            padding: '8px 12px', borderRadius: 10,
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div
              style={{
                fontSize: 13, fontWeight: 800,
                color: arrowColorFor(cagrRating.tone),
                fontFamily: HEADLINE_FONT,
              }}
            >
              {cagrSign}{cagrPct}%
            </div>
            <div style={{ fontSize: 10, color: S.mutedText }}>
              Market CAGR · {cagrRating.direction === 'flat'
                ? 'flat (< 0.5 %)'
                : cagrRating.direction === 'up'
                  ? `growth · ${cagrRating.arrows}/3`
                  : `decline · ${cagrRating.arrows}/3`}
            </div>
          </div>
          <CagrArrowsHTML rating={cagrRating} />
        </div>
      </div>

      {/* Per-item sources — revenue + margin, both publicly referenced */}
      <div
        style={{
          borderTop: `1px solid ${S.surfaceHigh}`,
          paddingTop: 10,
          marginTop: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <SourceLine label="Revenue src" value={item.sources.revenue} />
        <SourceLine label="Margin src"  value={item.sources.margin} />
      </div>
    </motion.div>
  );
};

const SourceLine: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
    <div
      style={{
        fontSize: 9, fontWeight: 700, letterSpacing: 1,
        textTransform: 'uppercase', color: S.outline,
        minWidth: 72, flexShrink: 0, paddingTop: 1,
      }}
    >
      {label}
    </div>
    <div style={{ fontSize: 10, color: S.onSurfaceVariant, lineHeight: 1.4 }}>
      {value}
    </div>
  </div>
);

const Metric: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div
      style={{
        fontSize: 9, fontWeight: 700, letterSpacing: 1,
        textTransform: 'uppercase', color: S.outline, marginBottom: 2,
      }}
    >
      {label}
    </div>
    <div style={{ fontSize: 15, fontWeight: 800, color: S.onBg, fontFamily: HEADLINE_FONT }}>
      {value}
    </div>
  </div>
);

// ─── Pool Chart (SVG) ────────────────────────────────────────────
interface PoolChartProps {
  slide: ProfitPoolSlide;
  onHover: (item: SlideItem, cagrRating: CagrRating, x: number, y: number) => void;
  onLeave: () => void;
}

const PoolChart: FC<PoolChartProps> = ({ slide, onHover, onLeave }) => {
  // Order is authored: ValueChain runs raw→retail; Sub-segments follow format
  // logic (volume → specialty); Core+Adjacent keeps CORE first.
  const ordered = slide.items;

  // Compact canvas — keeps the whole chart visible on a 768-900 px tall
  // viewport without forcing the page to scroll. MT carries enough room
  // for the CAGR arrow stack above the tallest bar; MB leaves space for
  // rotated category labels and a single x-axis caption.
  const W = 960;
  const H = 420;
  const ML = 56, MR = 20, MT = 32, MB = 104;
  const plotW = W - ML - MR;
  const plotH = H - MT - MB;

  const totalShare = ordered.reduce((s, it) => s + it.revenueShare, 0) || 1;
  // Y axis max — pick 0-45% for value chain, 0-40% for others (pad top)
  const yMax = Math.max(0.40, Math.ceil(
    Math.max(...ordered.map(it => it.gp1Margin)) * 100 / 5,
  ) / 20);

  const yTicks = [0, 0.10, 0.20, 0.30, 0.40];

  let cum = 0;
  const bars = ordered.map(it => {
    const x0 = cum;
    cum += it.revenueShare / totalShare;
    const x1 = cum;
    const cagrRating = toCagrRating(it.forwardCAGR);
    return {
      item: it,
      xPx0: ML + x0 * plotW,
      xPx1: ML + x1 * plotW,
      hPx:  (it.gp1Margin / yMax) * plotH,
      cagrRating,
    };
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', fontFamily: BODY_FONT }}
    >
      {/* Grid */}
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

      {/* Axis labels */}
      <text
        x={ML - 48} y={MT + plotH / 2}
        fontSize={11} fill={S.outline} textAnchor="middle"
        fontFamily={HEADLINE_FONT} fontWeight={700}
        transform={`rotate(-90, ${ML - 48}, ${MT + plotH / 2})`}
      >
        GP1 / Contribution Margin 1
      </text>
      <text
        x={ML + plotW / 2} y={H - 6}
        fontSize={11} fill={S.outline} textAnchor="middle"
        fontFamily={HEADLINE_FONT} fontWeight={700}
      >
        Revenue share (% of category pool) — ordered by value chain / format sequence
      </text>

      {/* Bars */}
      {bars.map((b) => {
        const y = MT + plotH - b.hPx;
        const w = Math.max(2, b.xPx1 - b.xPx0);
        const cx = b.xPx0 + w / 2;
        return (
          <g
            key={b.item.id}
            style={{ cursor: 'pointer' }}
            onMouseEnter={(e) => onHover(b.item, b.cagrRating, e.clientX, e.clientY)}
            onMouseMove={(e) => onHover(b.item, b.cagrRating, e.clientX, e.clientY)}
            onMouseLeave={onLeave}
          >
            <rect
              x={b.xPx0} y={y} width={w} height={b.hPx}
              fill={BAR_FILL} stroke={BAR_STROKE} strokeWidth={1.25}
              rx={2}
            />
            {/* Margin label inside bar */}
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
            {/* Revenue share % — just below the axis */}
            <text
              x={cx} y={MT + plotH + 14}
              fontSize={11} fill={S.primaryDim} fontWeight={700}
              textAnchor="middle" fontFamily={HEADLINE_FONT}
            >
              {(b.item.revenueShare * 100).toFixed(0)}%
            </text>
            {/* Bar name — rotated −35° so long names stay legible */}
            {(() => {
              const anchorX = cx;
              const anchorY = MT + plotH + 26;
              const full = b.item.sublabel
                ? `${b.item.label} ${b.item.sublabel}`
                : b.item.label;
              return (
                <text
                  x={anchorX} y={anchorY}
                  fontSize={11} fill={S.onSurface} fontWeight={600}
                  textAnchor="end" fontFamily={BODY_FONT}
                  transform={`rotate(-35, ${anchorX}, ${anchorY})`}
                >
                  {full}
                </text>
              );
            })()}
            {/* CAGR arrow stack — shared thresholds in CAGR_THRESHOLDS */}
            <CagrArrowsSVG rating={b.cagrRating} cx={cx} cy={y} />
          </g>
        );
      })}

    </svg>
  );
};

// ─── Slide toggle strip ──────────────────────────────────────────
const SlideToggle: FC<{
  slides: ProfitPoolSlide[];
  activeId: string;
  onSelect: (id: string) => void;
}> = ({ slides, activeId, onSelect }) => (
  <div
    style={{
      display: 'flex', gap: 8, flexWrap: 'wrap',
      padding: 6, background: S.surfaceLow, borderRadius: 14,
      border: `1px solid ${S.cardBorder}`,
    }}
  >
    {slides.map((s, i) => {
      const active = s.id === activeId;
      return (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 10,
            fontSize: 12, fontWeight: 700, fontFamily: HEADLINE_FONT,
            background: active ? S.primary : 'transparent',
            color: active ? '#fff' : S.onBg,
            border: active ? 'none' : `1px solid ${S.cardBorder}`,
            cursor: 'pointer', transition: 'all 0.15s',
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 10, fontWeight: 800,
              background: active ? 'rgba(255,255,255,0.22)' : S.surfaceHigh,
              color: active ? '#fff' : S.primaryDim,
              padding: '2px 6px', borderRadius: 6,
            }}
          >
            {String(i + 1).padStart(2, '0')}
          </span>
          <span>
            {s.group === 'Hair' ? 'Hair' : 'Laundry'}
            {' · '}
            {s.kind === 'ValueChain' ? 'Value Chain'
              : s.kind === 'SubSegment' ? 'Sub-Segments' : 'Core + Adjacent'}
          </span>
        </button>
      );
    })}
  </div>
);

// ─── Main component ──────────────────────────────────────────────
const ProfitPoolExplorer: FC = () => {
  const { loading } = usePrism();
  const [slideId, setSlideId] = useState<string>(PROFIT_POOL_SLIDES[0].id);
  const [year, setYear] = useState<Year>(2030);
  const [hover, setHover] = useState<{
    item: SlideItem;
    cagrRating: CagrRating;
    x: number;
    y: number;
  } | null>(null);

  const slide = useMemo(
    () => PROFIT_POOL_SLIDES.find(s => s.id === slideId) ?? PROFIT_POOL_SLIDES[0],
    [slideId],
  );

  // Slide-level CAGR signal — revenue-share-weighted average of item
  // forward CAGRs. Same threshold ladder as the per-bar arrows.
  const slideCagrRating = useMemo(() => {
    const total = slide.items.reduce((s, it) => s + it.revenueShare, 0);
    if (total === 0) return toCagrRating(0);
    const weighted =
      slide.items.reduce((s, it) => s + it.forwardCAGR * it.revenueShare, 0) /
      total;
    return toCagrRating(weighted);
  }, [slide]);

  const activeIdx = PROFIT_POOL_SLIDES.findIndex(s => s.id === slide.id);
  const go = (delta: number) => {
    const next = PROFIT_POOL_SLIDES[(activeIdx + delta + PROFIT_POOL_SLIDES.length) % PROFIT_POOL_SLIDES.length];
    setSlideId(next.id);
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
          <p style={{ color: S.mutedText, fontSize: 13, margin: '6px 0 0', maxWidth: 720 }}>
            Six aligned views from the Henkel Profit Pool deck. Each bar carries
            a CAGR arrow indicator (1-3 ▲ growth, 1-3 ▼ decline, ↔ flat) using a
            single threshold ladder shared across all views.
            Y-axis = <b>GP1 / Contribution Margin 1</b>.
          </p>
        </div>

        {/* Year selector + slide nav */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: S.surface, borderRadius: 10, padding: 4, border: `1px solid ${S.cardBorder}` }}>
            {YEARS.map(y => (
              <button
                key={y}
                onClick={() => setYear(y)}
                style={{
                  padding: '6px 12px', borderRadius: 8, border: 'none',
                  background: year === y ? S.primary : 'transparent',
                  color: year === y ? '#fff' : S.onBg,
                  fontFamily: HEADLINE_FONT, fontWeight: 700, fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {y}
              </button>
            ))}
          </div>
          <button
            onClick={() => go(-1)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: 10, background: S.surface,
              border: `1px solid ${S.cardBorder}`, cursor: 'pointer', color: S.onBg,
            }}
            title="Previous slide"
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
            title="Next slide"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Slide toggle */}
      <div style={{ marginBottom: 20 }}>
        <SlideToggle
          slides={PROFIT_POOL_SLIDES}
          activeId={slide.id}
          onSelect={setSlideId}
        />
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
        {/* Card title + slide-level rating */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: S.outline, marginBottom: 4 }}>
              Slide {activeIdx + 1} of {PROFIT_POOL_SLIDES.length} · {slide.poolSize}
            </div>
            <div style={{ fontFamily: HEADLINE_FONT, fontSize: 22, fontWeight: 800, color: S.onBg, lineHeight: 1.2 }}>
              {slide.title}
            </div>
            <div style={{ fontSize: 12, color: S.mutedText, marginTop: 4 }}>
              {slide.subtitle}
            </div>
          </div>

          {/* Slide-level CAGR badge — revenue-weighted average of items */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 12,
              background: S.surfaceLow,
              border: `1px solid ${S.cardBorder}`,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: S.outline }}>
                Slide avg CAGR (rev-weighted)
              </div>
              <div
                style={{
                  fontSize: 14, fontWeight: 800, fontFamily: HEADLINE_FONT,
                  color: arrowColorFor(slideCagrRating.tone),
                }}
              >
                {slideCagrRating.label}
              </div>
            </div>
            <CagrArrowsHTML rating={slideCagrRating} />
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
            onHover={(item, cagrRating, x, y) => setHover({ item, cagrRating, x, y })}
            onLeave={() => setHover(null)}
          />
        </div>

        {/* Legend — CAGR arrow ladder, identical thresholds across views */}
        <div
          style={{
            display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center',
            padding: '14px 0 4px', borderTop: `1px solid ${S.surfaceHigh}`,
            marginTop: 18,
          }}
        >
          <span
            style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
              textTransform: 'uppercase', color: S.outline,
            }}
          >
            Forward CAGR
          </span>
          <ArrowLegend rating={toCagrRating(0.07)}  label={`≥ ${(CAGR_THRESHOLDS.two * 100).toFixed(0)}% growth`} />
          <ArrowLegend rating={toCagrRating(0.03)}  label={`${(CAGR_THRESHOLDS.one * 100).toFixed(0)}–${(CAGR_THRESHOLDS.two * 100).toFixed(0)}% growth`} />
          <ArrowLegend rating={toCagrRating(0.01)}  label={`${(CAGR_THRESHOLDS.flat * 100).toFixed(1)}–${(CAGR_THRESHOLDS.one * 100).toFixed(0)}% growth`} />
          <ArrowLegend rating={toCagrRating(0)}     label={`Flat (< ${(CAGR_THRESHOLDS.flat * 100).toFixed(1)}%)`} />
          <ArrowLegend rating={toCagrRating(-0.01)} label={`${(CAGR_THRESHOLDS.flat * 100).toFixed(1)}–${(CAGR_THRESHOLDS.one * 100).toFixed(0)}% decline`} />
          <ArrowLegend rating={toCagrRating(-0.03)} label={`${(CAGR_THRESHOLDS.one * 100).toFixed(0)}–${(CAGR_THRESHOLDS.two * 100).toFixed(0)}% decline`} />
          <ArrowLegend rating={toCagrRating(-0.07)} label={`≥ ${(CAGR_THRESHOLDS.two * 100).toFixed(0)}% decline`} />
          <div style={{ marginLeft: 'auto', fontSize: 10, color: S.mutedText }}>
            Hover bars for sources, metrics & exact CAGR.
          </div>
        </div>
      </div>

      {/* Insights strip */}
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
        <div style={{ marginTop: 12, fontSize: 10, color: S.mutedText, borderTop: `1px solid ${S.surfaceHigh}`, paddingTop: 10 }}>
          Sources: {slide.sources}
        </div>
      </div>

      {/* Floating tooltip */}
      <AnimatePresence>
        {hover && (
          <PoolTooltip
            item={hover.item}
            slide={slide}
            cagrRating={hover.cagrRating}
            x={hover.x}
            y={hover.y}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const ArrowLegend: FC<{ rating: CagrRating; label: string }> = ({ rating, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <CagrArrowsHTML rating={rating} size={11} />
    <span style={{ fontSize: 11, color: S.onSurfaceVariant, fontWeight: 600 }}>{label}</span>
  </div>
);

// Unused icon-import guard — kept here so existing lucide imports stay
// part of the bundle if other parts of the file want to reference them.
void TrendingUp; void TrendingDown; void Minus;

export default ProfitPoolExplorer;
