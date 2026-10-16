/**
 * The Explorer's chart: bar width is the revenue share, bar height the GP1
 * margin, bar area the profit pool, with the pool's development as arrows and
 * a hover card per bar.
 *
 * The chart lays out in CSS pixels: it measures its container and draws at
 * that width, so a label is 11 px at every width instead of a fraction of a
 * fixed viewBox. Below 720 px the drawing keeps 720 px and scrolls sideways.
 * A visually hidden table carries the same figures as text.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FC, type KeyboardEvent, type RefObject } from 'react';
import { motion } from 'framer-motion';
import {
  POOL_HORIZON_LABEL, poolCagr, itemGp1PoolEurBn, toPoolRating, type PoolView,
  type PoolItem, type CagrRating,
} from '@/lib/profitPoolData';
import { S, SHADOW, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';
import { arrowColorFor, ArrowsSVG, fmtPercent, fmtShare } from './arrows';

const BAR_FILL = 'rgba(214, 227, 255, 0.85)';
const BAR_FILL_ACTIVE = 'rgba(178, 205, 255, 0.95)';
const BAR_STROKE = S.primaryDim;

/** The drawing's width when the container cannot be measured (no ResizeObserver, as in jsdom). */
const FALLBACK_WIDTH = 960;
/** Below this the drawing keeps its width and scrolls sideways. */
const MIN_WIDTH = 720;

// Below 34 px of bar width the in-bar % text and the arrow glyphs above the
// bar are left out: they would clip or collide on 1 to 2 percent slivers.
// Below 18 px the axis name and the % label go too. The bar itself, its
// aria-label, the hover card and the table still carry the data.
const DECOR_MIN_W = 34;
const LABEL_MIN_W = 18;

/** The width of a container, kept up to date by a ResizeObserver; the fallback where there is none. */
function useMeasuredWidth(ref: RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  // A layout effect, so the first measurement lands before the first paint
  // and the chart never shows a frame at the fallback width. The Explorer
  // renders on the client only, so the effect always has a window.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const first = el.getBoundingClientRect().width;
    if (first > 0) setWidth(Math.round(first));
    // The observer reports the element's size on observe and on every change.
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setWidth(Math.round(w));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

// Whether the last input came from the keyboard: a focus that follows a key
// press opens the hover card, a focus that follows a pointer (or focus given
// back after a click closed the drawer) does not. One pair of listeners per
// page, added by the first chart.
let keyboardLast = false;
let modalityWatched = false;
function watchModality() {
  if (modalityWatched || typeof window === 'undefined') return;
  modalityWatched = true;
  window.addEventListener('keydown', () => { keyboardLast = true; }, true);
  window.addEventListener('pointerdown', () => { keyboardLast = false; }, true);
  window.addEventListener('mousedown', () => { keyboardLast = false; }, true);
}

// ─── Hover tooltip (slim: the click carries the depth) ───────────
/** One figure of the hover card, with its label above. */
const MiniMetric: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: S.onSurfaceVariant, marginBottom: 1 }}>
      {label}
    </div>
    <div style={{ fontSize: 13, fontWeight: 800, color: S.onBg, fontFamily: HEADLINE_FONT, fontVariantNumeric: 'tabular-nums' }}>
      {value}
    </div>
  </div>
);

export const HoverTip: FC<{ item: PoolItem; view: PoolView; x: number; y: number }> = ({
  item, view, x, y,
}) => {
  const pool = poolCagr(item);
  const rating = toPoolRating(pool);
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const placeLeft = x > vw - 300;
  const name = item.sublabel ? `${item.label} ${item.sublabel}`.trim() : item.label;
  const gp1PoolShare = itemGp1PoolEurBn(view, item) /
    (view.items.reduce((s, it) => s + itemGp1PoolEurBn(view, it), 0) || 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.12 }}
      role="tooltip"
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
        <MiniMetric label="Revenue" value={fmtPercent(item.revenueShare)} />
        <MiniMetric label="GP1" value={fmtPercent(item.gp1Margin)} />
        <MiniMetric label="Pool share" value={fmtPercent(gp1PoolShare)} />
      </div>
      <div style={{ fontSize: 11, color: S.primaryDim, fontWeight: 700 }}>
        Click the bar, or press Enter on it, for the full assessment
      </div>
    </motion.div>
  );
};

// ─── Pool Chart (SVG) ────────────────────────────────────────────
interface PoolChartProps {
  view: PoolView;
  selectedId: string | null;
  onHover: (item: PoolItem, x: number, y: number) => void;
  onLeave: () => void;
  onSelect: (item: PoolItem) => void;
}

interface BarGeom {
  item: PoolItem;
  xPx0: number;
  xPx1: number;
  hPx: number;
  poolRating: CagrRating;
}

/** Pure geometry, outside the component so render never reassigns. */
function computeBars(
  items: PoolItem[], ml: number, plotW: number, plotH: number, yMax: number,
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

/** The top of the y axis: the tallest bar rounded up to the next 10 percent, at least 40. */
export function yAxisMax(items: PoolItem[]): number {
  const tallest = Math.max(0, ...items.map(it => it.gp1Margin));
  return Math.max(0.40, Math.ceil(tallest * 10 - 1e-9) / 10);
}

export const PoolChart: FC<PoolChartProps> = ({ view, selectedId, onHover, onLeave, onSelect }) => {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const ordered = view.items;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const measured = useMeasuredWidth(containerRef);
  // Whether the scroller (below MIN_WIDTH) still has drawing to its right.
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  useEffect(watchModality, []);
  const W = Math.max(MIN_WIDTH, measured);
  // The margins leave room for the rotated (−35°) x-labels: the longest
  // ("Brand Owner CPG (Retail)", "Conditioners & Treatments") and the first
  // tier's ("Commodity Chemicals") render in full from about 1000 px.
  const H = 448;
  const ML = 96, MR = 20, MT = 32, MB = 132;
  const plotW = W - ML - MR;
  const plotH = H - MT - MB;

  const yMax = yAxisMax(ordered);
  const yTicks = useMemo(
    () => Array.from({ length: Math.round(yMax * 10) + 1 }, (_, i) => i / 10),
    [yMax],
  );

  const bars = useMemo(
    () => computeBars(ordered, ML, plotW, plotH, yMax),
    [ordered, ML, plotW, plotH, yMax],
  );

  const chartLabel = `${view.title}, pool chart; arrows show profit-pool development ${POOL_HORIZON_LABEL}`;

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      {/* Narrower than MIN_WIDTH the drawing scrolls sideways; a fade on the right edge shows there is more. */}
      {measured < MIN_WIDTH && !scrolledToEnd && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: 36, pointerEvents: 'none', zIndex: 1,
            background: `linear-gradient(to right, transparent, ${S.surface})`,
          }}
        />
      )}
      <div
        className="overflow-x-auto"
        style={{ width: '100%' }}
        onScroll={(e) => {
          const el = e.currentTarget;
          setScrolledToEnd(el.scrollWidth - el.clientWidth - el.scrollLeft <= 1);
        }}
      >
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ display: 'block', width: W, height: H, maxWidth: 'none', fontFamily: BODY_FONT }}
          role="group"
          aria-label={chartLabel}
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
                  {fmtPercent(t, 0)}
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
            // would collide; hover, focus and click carry their identity.
            const labeled = w >= LABEL_MIN_W;
            const decorated = w >= DECOR_MIN_W;
            const name = b.item.sublabel ? `${b.item.label} ${b.item.sublabel}` : b.item.label;
            const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(b.item); }
              else if (e.key === 'Escape') onLeave();
            };
            return (
              <g
                key={b.item.id}
                // outline: 'none' is safe here because keyboard focus draws its
                // own indicator: the <rect> below switches to a 2px S.primary
                // stroke (dashed when focused but not selected) plus the active
                // fill, and the hover card opens anchored to the bar.
                style={{ cursor: 'pointer', outline: 'none' }}
                role="button"
                tabIndex={0}
                onFocus={(e) => {
                  setFocusedId(b.item.id);
                  if (!keyboardLast) return;
                  const box = e.currentTarget.querySelector('rect')?.getBoundingClientRect();
                  if (box) onHover(b.item, box.right, box.top + box.height / 2);
                }}
                onBlur={() => { setFocusedId(null); onLeave(); }}
                aria-label={`${name}: ${fmtPercent(b.item.revenueShare)} revenue share, ${fmtPercent(b.item.gp1Margin)} GP1, pool development ${b.poolRating.label} per year. Press Enter for the full assessment.`}
                onMouseEnter={(e) => onHover(b.item, e.clientX, e.clientY)}
                onMouseMove={(e) => onHover(b.item, e.clientX, e.clientY)}
                onMouseLeave={onLeave}
                onClick={() => onSelect(b.item)}
                onKeyDown={onKeyDown}
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
                    {fmtPercent(b.item.gp1Margin, 0)}
                  </text>
                )}
                {labeled && (
                  <text
                    x={cx} y={MT + plotH + 14}
                    fontSize={11} fill={S.primaryDim} fontWeight={700}
                    textAnchor="middle" fontFamily={HEADLINE_FONT}
                  >
                    {fmtShare(b.item.revenueShare)}
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
      </div>

      {/* The same figures as text, for a reader who cannot see the drawing.
          The wrapper, not the table, is the hidden box: a table keeps its
          content width and would add to the page's scroll width. */}
      <div className="sr-only">
      <table>
        <caption>{chartLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Pool</th>
            <th scope="col">Revenue share</th>
            <th scope="col">GP1 proxy</th>
            <th scope="col">Pool development per year</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((b) => (
            <tr key={b.item.id}>
              <th scope="row">{b.item.sublabel ? `${b.item.label} ${b.item.sublabel}` : b.item.label}</th>
              <td>{fmtPercent(b.item.revenueShare)}</td>
              <td>{fmtPercent(b.item.gp1Margin)}</td>
              <td>{b.poolRating.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
};
