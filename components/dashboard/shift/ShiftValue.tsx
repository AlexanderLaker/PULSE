'use client';

/**
 * A headline shift figure: sign, arrow and colour together, so growth and
 * shrinkage never rely on colour alone (colour-vision deficiency, a
 * projector, greyscale print). Tabular figures keep stacked values aligned,
 * and fmtShift rounds to one decimal.
 */

import type { FC } from 'react';
import { fmtShift, shiftColor, shiftArrow } from '@/lib/format';

export interface ShiftValueProps {
  value: number;
  /** Font size of the figure in px; the arrow is drawn at about 0.62 of it. Default 15. */
  size?: number;
  fontFamily?: string;
}

const ShiftValue: FC<ShiftValueProps> = ({ value, size = 15, fontFamily }) => {
  const arrow = shiftArrow(value);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: Math.max(2, Math.round(size * 0.16)),
        color: shiftColor(value),
        fontFamily,
        fontSize: size,
        fontWeight: 800,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.01em',
        lineHeight: 1.05,
        whiteSpace: 'nowrap',
      }}
    >
      {arrow && (
        <span
          aria-hidden="true"
          style={{ fontSize: Math.round(size * 0.62), lineHeight: 1, transform: 'translateY(-0.04em)' }}
        >
          {arrow}
        </span>
      )}
      <span>{fmtShift(value)}</span>
    </span>
  );
};

export default ShiftValue;
