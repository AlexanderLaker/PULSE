'use client';

/**
 * ShiftValue — the single, consistent way PRISM renders a profit-pool shift.
 *
 * Every shift number in the product (hero, headline cards, matrix totals,
 * drill-down, Executive Summary) goes through this component so the encoding is
 * uniform and accessible:
 *   • a directional ▲ / ▼ arrow + a sign, so grow-vs-shrink never relies on
 *     colour alone (red-green colour deficiency, projector, greyscale print);
 *   • one unified expansion/contraction colour pair (lib/format);
 *   • tabular figures so columns of numbers align;
 *   • at most one decimal (enforced by fmtShift).
 *
 * An optional low…high range (e.g. P10…P90) renders beneath the headline value.
 */

import React, { type CSSProperties, type FC } from 'react';
import { fmtShift, shiftColor, shiftArrow, NEUTRAL } from '@/lib/format';

export interface ShiftValueProps {
  value: number | null | undefined;
  /** Font size of the value in px (arrow scales to ~0.62×). Default 15. */
  size?: number;
  /** Font weight of the value. Default 800. */
  weight?: number;
  /** Render the ▲/▼ arrow. Default true. */
  arrow?: boolean;
  /** Optional range shown beneath the value, e.g. P10…P90. */
  range?: { low: number | null | undefined; high: number | null | undefined } | null;
  /** Caption appended after the range, e.g. "P10–P90". */
  rangeLabel?: string;
  /** Size of the range line in px. Default 11. */
  rangeSize?: number;
  /** Colour override (defaults to the semantic expansion/contraction colour). */
  color?: string;
  /** Horizontal alignment of the stacked value + range. Default 'start'. */
  align?: 'start' | 'center' | 'end';
  fontFamily?: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

const ShiftValue: FC<ShiftValueProps> = ({
  value,
  size = 15,
  weight = 800,
  arrow = true,
  range = null,
  rangeLabel,
  rangeSize = 11,
  color,
  align = 'start',
  fontFamily,
  className,
  style,
  title,
}) => {
  const c = color ?? shiftColor(value);
  const glyph = arrow ? shiftArrow(value) : '';
  const hasRange =
    range != null && range.low != null && range.high != null;

  const alignItems =
    align === 'center' ? 'center' : align === 'end' ? 'flex-end' : 'flex-start';
  const textAlign = align === 'center' ? 'center' : align === 'end' ? 'right' : 'left';

  return (
    <span
      className={className}
      title={title}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems,
        lineHeight: 1.05,
        ...style,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: Math.max(2, Math.round(size * 0.16)),
          color: c,
          fontFamily,
          fontSize: size,
          fontWeight: weight,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
        }}
      >
        {glyph && (
          <span
            aria-hidden="true"
            style={{ fontSize: Math.round(size * 0.62), lineHeight: 1, transform: 'translateY(-0.04em)' }}
          >
            {glyph}
          </span>
        )}
        <span>{fmtShift(value)}</span>
      </span>
      {hasRange && (
        <span
          style={{
            marginTop: Math.max(1, Math.round(size * 0.08)),
            fontSize: rangeSize,
            fontWeight: 600,
            color: NEUTRAL,
            fontVariantNumeric: 'tabular-nums',
            textAlign,
            whiteSpace: 'nowrap',
          }}
        >
          {fmtShift(range!.low)} … {fmtShift(range!.high)}
          {rangeLabel ? <span style={{ opacity: 0.7 }}>{`  ${rangeLabel}`}</span> : null}
        </span>
      )}
    </span>
  );
};

export default ShiftValue;
