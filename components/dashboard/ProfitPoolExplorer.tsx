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
 * PRISM integration:
 *   Each bar is colored RED (declining) or GREEN (increasing) based on
 *   the Monte Carlo median shift for the linked category at the selected
 *   year. Hover reveals a 0–3 intensity rating in the same visual
 *   style as the Innovation Explorer evaluation (Stable / Increasing +N
 *   / Declining –N), plus the source stack.
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
  itemPrismShiftFor,
  slidePrismShiftFor,
  toTrendRating,
  type ProfitPoolSlide,
  type SlideItem,
  type TrendRating,
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

// Map rating → bar fill & border
function barFillFor(rating: TrendRating): { fill: string; stroke: string } {
  if (rating.tone === 'green') {
    const intensity = 0.55 + rating.score * 0.12;
    return {
      fill: `rgba(31, 157, 85, ${intensity.toFixed(2)})`,
      stroke: S.greenStrong,
    };
  }
  if (rating.tone === 'red') {
    const intensity = 0.55 + rating.score * 0.12;
    return {
      fill: `rgba(179, 38, 30, ${intensity.toFixed(2)})`,
      stroke: S.redStrong,
    };
  }
  if (rating.tone === 'neutral') {
    return { fill: 'rgba(148, 163, 184, 0.55)', stroke: '#475569' };
  }
  // muted — no PRISM signal
  return { fill: 'rgba(214, 227, 255, 0.80)', stroke: S.primaryDim };
}

// Small 0–3 dot indicator, mirrors Innovation Explorer rating dots
const ScoreDots: FC<{ score: 0 | 1 | 2 | 3; tone: TrendRating['tone'] }> = ({ score, tone }) => {
  const active =
    tone === 'green' ? S.green :
    tone === 'red'   ? S.red :
    tone === 'neutral' ? S.neutral : S.outlineVariant;
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {[1, 2, 3].map(i => (
        <span
          key={i}
          style={{
            width: 8, height: 8, borderRadius: '50%',
            background: i <= score ? active : S.surfaceHigh,
            border: `1px solid ${i <= score ? active : S.outlineVariant}`,
            transition: 'background 0.2s',
          }}
        />
      ))}
    </span>
  );
};

// ─── Tooltip ─────────────────────────────────────────────────────
interface TooltipProps {
  item: SlideItem;
  slide: ProfitPoolSlide;
  rating: TrendRating;
  x: number;
  y: number;
}
const PoolTooltip: FC<TooltipProps> = ({ item, slide, rating, x, y }) => {
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

      {/* PRISM trend rating — 0-3 scale */}
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
            textTransform: 'uppercase', color: S.outline, marginBottom: 6,
          }}
        >
          PRISM Trend (0-3)
        </div>
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background:
              rating.tone === 'green' ? S.greenSoft :
              rating.tone === 'red'   ? S.redSoft :
              rating.tone === 'neutral' ? S.neutralSoft : S.surfaceLow,
            padding: '8px 12px', borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div
              style={{
                fontSize: 13, fontWeight: 800,
                color:
                  rating.tone === 'green' ? S.greenStrong :
                  rating.tone === 'red'   ? S.redStrong :
                  rating.tone === 'neutral' ? '#475569' : S.mutedText,
              }}
            >
              {rating.label}
            </div>
            <div style={{ fontSize: 10, color: S.mutedText }}>
              Monte Carlo median vs. baseline
            </div>
          </div>
          <ScoreDots score={rating.score} tone={rating.tone} />
        </div>
      </div>

      {/* Forward CAGR */}
      <div style={{ fontSize: 11, color: S.onSurfaceVariant, marginBottom: 4 }}>
        Forward CAGR (market): <b>{cagrSign}{cagrPct}%</b>
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
  shifts: Record<string, Record<string | number, unknown>> | undefined;
  year: number;
  onHover: (item: SlideItem, rating: TrendRating, x: number, y: number) => void;
  onLeave: () => void;
}

const PoolChart: FC<PoolChartProps> = ({ slide, shifts, year, onHover, onLeave }) => {
  // Order is authored: ValueChain runs raw→retail; Sub-segments follow format
  // logic (volume → specialty); Core+Adjacent keeps CORE first.
  const ordered = slide.items;

  const W = 960;
  const H = 500;
  const ML = 60, MR = 24, MT = 24, MB = 135;
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
    const rating = toTrendRating(itemPrismShiftFor(shifts, slide, it, year));
    return {
      item: it,
      xPx0: ML + x0 * plotW,
      xPx1: ML + x1 * plotW,
      hPx:  (it.gp1Margin / yMax) * plotH,
      rating,
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
        x={ML + plotW / 2} y={H - 10}
        fontSize={10} fill={S.outline} textAnchor="middle"
        fontFamily={HEADLINE_FONT} fontWeight={700}
        style={{ textTransform: 'uppercase', letterSpacing: 1.2 }}
      >
        Revenue share (% of category pool) — ordered by value chain / format sequence
      </text>

      {/* Bars */}
      {bars.map((b, i) => {
        const { fill, stroke } = barFillFor(b.rating);
        const y = MT + plotH - b.hPx;
        const w = Math.max(2, b.xPx1 - b.xPx0);
        return (
          <g
            key={b.item.id}
            style={{ cursor: 'pointer' }}
            onMouseEnter={(e) => onHover(b.item, b.rating, e.clientX, e.clientY)}
            onMouseMove={(e) => onHover(b.item, b.rating, e.clientX, e.clientY)}
            onMouseLeave={onLeave}
          >
            <rect
              x={b.xPx0} y={y} width={w} height={b.hPx}
              fill={fill} stroke={stroke} strokeWidth={1.25}
              rx={2}
            />
            {/* Margin label inside bar */}
            {b.hPx > 22 && w > 28 && (
              <text
                x={b.xPx0 + w / 2} y={y + 15}
                fontSize={11} fontWeight={800}
                fill="#fff"
                textAnchor="middle" fontFamily={HEADLINE_FONT}
              >
                {(b.item.gp1Margin * 100).toFixed(0)}%
              </text>
            )}
            {/* Revenue share % — just below the axis */}
            <text
              x={b.xPx0 + w / 2} y={MT + plotH + 14}
              fontSize={11} fill={S.primaryDim} fontWeight={700}
              textAnchor="middle" fontFamily={HEADLINE_FONT}
            >
              {(b.item.revenueShare * 100).toFixed(0)}%
            </text>
            {/* Bar name — rotated −35° so long names stay legible */}
            {(() => {
              const anchorX = b.xPx0 + w / 2;
              const anchorY = MT + plotH + 30;
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
            {/* 0-3 dots marker */}
            {b.rating.score > 0 && (
              <g transform={`translate(${b.xPx0 + w / 2 - 12}, ${y - 12})`}>
                {[1, 2, 3].map(d => (
                  <circle
                    key={d}
                    cx={d * 8} cy={0} r={3.5}
                    fill={
                      d <= b.rating.score
                        ? (b.rating.tone === 'green' ? S.greenStrong : S.redStrong)
                        : '#fff'
                    }
                    stroke={b.rating.tone === 'green' ? S.greenStrong : S.redStrong}
                    strokeWidth={1}
                  />
                ))}
              </g>
            )}
          </g>
        );
      })}

      {/* X-axis caption */}
      <text
        x={ML + plotW / 2} y={H - 16}
        fontSize={11} fill={S.outline}
        textAnchor="middle" fontFamily={HEADLINE_FONT} fontWeight={700}
      >
        Revenue share (% of pool)
      </text>
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
  const { simulation, loading } = usePrism();
  const [slideId, setSlideId] = useState<string>(PROFIT_POOL_SLIDES[0].id);
  const [year, setYear] = useState<Year>(2030);
  const [hover, setHover] = useState<{
    item: SlideItem;
    rating: TrendRating;
    x: number;
    y: number;
  } | null>(null);

  const slide = useMemo(
    () => PROFIT_POOL_SLIDES.find(s => s.id === slideId) ?? PROFIT_POOL_SLIDES[0],
    [slideId],
  );

  const shifts = simulation?.shifts as
    | Record<string, Record<string | number, unknown>>
    | undefined;

  const slideAvgShift = slidePrismShiftFor(shifts, slide, year);
  const slideRating = toTrendRating(slideAvgShift);

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
            Six aligned views from the Henkel Profit Pool deck. Bars are colored red/green by PRISM
            Monte Carlo direction at the selected year — hover for the 0–3 trend rating.
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

          {/* Slide-level PRISM rating badge */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 12,
              background:
                slideRating.tone === 'green' ? S.greenSoft :
                slideRating.tone === 'red'   ? S.redSoft :
                slideRating.tone === 'neutral' ? S.neutralSoft : S.surfaceLow,
              border: `1px solid ${
                slideRating.tone === 'green' ? S.green :
                slideRating.tone === 'red'   ? S.red :
                S.cardBorder
              }`,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: S.outline }}>
                Slide avg · {year}
              </div>
              <div
                style={{
                  fontSize: 14, fontWeight: 800, fontFamily: HEADLINE_FONT,
                  color:
                    slideRating.tone === 'green' ? S.greenStrong :
                    slideRating.tone === 'red'   ? S.redStrong :
                    slideRating.tone === 'neutral' ? '#475569' : S.mutedText,
                }}
              >
                {slideRating.label}
              </div>
            </div>
            <ScoreDots score={slideRating.score} tone={slideRating.tone} />
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
            shifts={shifts}
            year={year}
            onHover={(item, rating, x, y) => setHover({ item, rating, x, y })}
            onLeave={() => setHover(null)}
          />
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '14px 0 4px', borderTop: `1px solid ${S.surfaceHigh}`, marginTop: 18 }}>
          <LegendSwatch color={S.green} label="Increasing — PRISM tailwind" />
          <LegendSwatch color={S.red} label="Declining — PRISM headwind" />
          <LegendSwatch color={S.neutral} label="Stable" />
          <LegendSwatch color={S.primaryDim} label="No PRISM signal (adjacency / infra tier)" />
          <div style={{ marginLeft: 'auto', fontSize: 10, color: S.mutedText }}>
            Hover bars for sources, metrics & 0–3 trend rating.
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
            rating={hover.rating}
            x={hover.x}
            y={hover.y}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const LegendSwatch: FC<{ color: string; label: string }> = ({ color, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <span style={{ width: 12, height: 12, borderRadius: 3, background: color, display: 'inline-block' }} />
    <span style={{ fontSize: 11, color: S.onSurfaceVariant, fontWeight: 600 }}>{label}</span>
  </div>
);

// Unused icon imports guard
void TrendingUp; void TrendingDown; void Minus;

export default ProfitPoolExplorer;
