/**
 * The Explorer's arrows and number formats: the arrow stack of a pool rating
 * in SVG and in text, its legend, and euro and share formatting.
 */
import type { FC } from 'react';
import type { CagrRating } from '@/lib/profitPoolData';
import { S, HEADLINE_FONT } from '@/lib/theme';

export const arrowColorFor = (tone: CagrRating['tone']): string =>
  tone === 'green' ? S.expansion : tone === 'red' ? S.contraction : S.neutral;

const arrowGlyphs = (rating: CagrRating): string =>
  rating.direction === 'flat' ? '↔' :
  rating.direction === 'up'   ? '↑'.repeat(rating.arrows) :
                                '↓'.repeat(rating.arrows);

export const fmtEurBn = (bn: number): string =>
  `€${bn >= 10 ? bn.toFixed(0) : bn.toFixed(1)}bn`;

/** A fraction as a percentage at the given precision: the derivations show
 *  their arithmetic at the precision of their inputs (docs/DESIGN.md). */
export const fmtPercent = (v: number, decimals = 1): string => `${(v * 100).toFixed(decimals)}%`;

/** Share as a clean %: whole number ≥1%, one decimal below 1% (so micro-pools don't read "0%"). */
export const fmtShare = (v: number): string => fmtPercent(v, v * 100 >= 1 ? 0 : 1);

// ─── Arrow stacks (shared glyph treatment) ───────────────────────
export const ArrowsSVG: FC<{ rating: CagrRating; cx: number; cy: number; ariaPrefix: string }> = ({
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

export const ArrowsHTML: FC<{ rating: CagrRating; size?: number }> = ({ rating, size = 15 }) => (
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

export const ArrowLegend: FC<{ rating: CagrRating; label: string }> = ({ rating, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <ArrowsHTML rating={rating} size={11} />
    <span style={{ fontSize: 11, color: S.onSurfaceVariant, fontWeight: 600 }}>{label}</span>
  </div>
);
