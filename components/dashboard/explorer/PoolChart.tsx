/**
 * The Explorer's chart: bar width is the revenue share, bar height the GP1
 * margin, bar area the profit pool, with the pool's development as arrows and
 * a hover card per bar.
 */
import { useMemo, useState, type FC } from 'react';
import { motion } from 'framer-motion';
import {
  POOL_HORIZON_LABEL, poolCagr, itemGp1PoolEurBn, toPoolRating, type ProfitPoolSlide,
  type SlideItem, type CagrRating,
} from '@/lib/profitPoolData';
import { S, SHADOW, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';
import { arrowColorFor, ArrowsSVG } from './arrows';
import { MiniMetric } from './DetailPanel';

const BAR_FILL = 'rgba(214, 227, 255, 0.85)';
const BAR_FILL_ACTIVE = 'rgba(178, 205, 255, 0.95)';
const BAR_STROKE = S.primaryDim;

// Below ~34 CSS px of rendered bar width (≈26 viewBox units at the ~1250px
// card width) the in-bar % text and the arrow glyphs above the bar are left
// out: they would clip or collide on 1–2%-share slivers. The bar itself, its
// aria-label and the hover tooltip still carry the data.
const DECOR_MIN_W = 26;

// ─── Hover tooltip (slim: the click carries the depth) ───────────
export const HoverTip: FC<{ item: SlideItem; slide: ProfitPoolSlide; x: number; y: number }> = ({
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
        boxShadow: SHADOW.popover,
        padding: 14, fontFamily: BODY_FONT, color: S.onSurface,
        zIndex: 1000, pointerEvents: 'none',
      }}
    >
      <div style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 14, color: S.onBg, marginBottom: 6 }}>
        {name}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: S.surfaceLow, borderRadius: 8, padding: '7px 10px', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: S.onSurfaceVariant }}>
            Pool development · {POOL_HORIZON_LABEL}
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, fontFamily: HEADLINE_FONT, color: arrowColorFor(rating.tone), fontVariantNumeric: 'tabular-nums' }}>
            {rating.label} p.a.
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
        <MiniMetric label="Revenue" value={`${(item.revenueShare * 100).toFixed(1)}%`} />
        <MiniMetric label="GP1" value={`${(item.gp1Margin * 100).toFixed(1)}%`} />
        <MiniMetric label="Pool share" value={`${(gp1PoolShare * 100).toFixed(1)}%`} />
      </div>
      <div style={{ fontSize: 11, color: S.primaryDim, fontWeight: 700 }}>
        Click the bar for the full assessment →
      </div>
    </motion.div>
  );
};

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

/** Pure geometry, outside the component so render never reassigns. */
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

export const PoolChart: FC<PoolChartProps> = ({ slide, selectedId, onHover, onLeave, onSelect }) => {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const ordered = slide.items;
  const W = 960;
  // The margins leave room for the rotated (−35°) x-labels: the longest
  // ("Brand Owner CPG (Retail)", "Conditioners & Treatments") and the first
  // tier's ("Commodity Chemicals") render in full at ~1200px card width.
  const H = 448;
  const ML = 96, MR = 20, MT = 32, MB = 132;
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
      aria-label={`${slide.title}, pool chart; arrows show profit-pool development ${POOL_HORIZON_LABEL}`}
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
              fontSize={11} fill={S.onSurfaceVariant}
              textAnchor="end" fontFamily={HEADLINE_FONT} fontWeight={600}
            >
              {(t * 100).toFixed(0)}%
            </text>
          </g>
        );
      })}

      <text
        x={ML - 48} y={MT + plotH / 2}
        fontSize={11.5} fill={S.onSurfaceVariant} textAnchor="middle"
        fontFamily={HEADLINE_FONT} fontWeight={700}
        transform={`rotate(-90, ${ML - 48}, ${MT + plotH / 2})`}
      >
        GP1 proxy (est.)
      </text>
      <text
        x={ML + plotW / 2} y={H - 6}
        fontSize={11.5} fill={S.onSurfaceVariant} textAnchor="middle"
        fontFamily={HEADLINE_FONT} fontWeight={700}
      >
        Revenue share (% of view) · arrows = pool development {POOL_HORIZON_LABEL}
      </text>

      {bars.map((b) => {
        const y = MT + plotH - b.hPx;
        const w = Math.max(2, b.xPx1 - b.xPx0);
        const cx = b.xPx0 + w / 2;
        const isSelected = selectedId === b.item.id;
        const isFocused = focusedId === b.item.id;
        // Micro-pools keep their honest area but drop the decoration, which
        // would collide; hover and click carry their identity. The axis name
        // and % labels need ≥14 units, the in-bar % and the arrows need
        // DECOR_MIN_W.
        const labeled = w >= 14;
        const decorated = w >= DECOR_MIN_W;
        const name = b.item.sublabel ? `${b.item.label} ${b.item.sublabel}` : b.item.label;
        return (
          <g
            key={b.item.id}
            // outline: 'none' is safe here because keyboard focus draws its
            // own indicator: the <rect> below switches to a 2px S.primary
            // stroke (dashed when focused but not selected) plus the active
            // fill.
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
            {b.hPx > 22 && decorated && (
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
            {/* Pool-development arrows: revenue × GP1, not revenue alone */}
            {decorated && (
              <ArrowsSVG rating={b.poolRating} cx={cx} cy={y} ariaPrefix="Pool development" />
            )}
          </g>
        );
      })}
    </svg>
  );
};
