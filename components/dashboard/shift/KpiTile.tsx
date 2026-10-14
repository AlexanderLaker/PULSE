/**
 * A headline figure above the matrix: a median with its P10 to P90 band on
 * hover, focus or tap.
 */
import React, { useState, type FC } from 'react';
import { fmtShift } from '@/lib/format';
import { S, SHADOW, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';
import ShiftValue from './ShiftValue';
import type { PercentileDistribution } from '@/types';

/** A headline figure above the matrix. Its P10–P90 band opens on hover,
 *  keyboard focus and tap, so it never depends on a mouse; a category tile
 *  opens the same drill-down as its matrix row. */
export const KpiTile: FC<{
  label: string;
  band: PercentileDistribution;
  /** The category's label; the portfolio tile has none. */
  name?: string;
  /** Appended to the band: what it covers. */
  bandNote: string;
  onOpen?: () => void;
}> = ({ label, band, name, bandNote, onOpen }) => {
  const [hovered, setHovered] = useState(false);
  const inner = (
    <>
      <div className="text-[11px] font-bold uppercase tracking-[0.12em]"
        style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>
        {label}
      </div>
      {/* One anatomy for every tile: the label on top, then the name on the
          left and the figure on the right on a shared baseline; the portfolio
          tile keeps the figure at the right edge without a name. */}
      <div className="flex items-baseline justify-between gap-3 mt-1.5">
        {name ? (
          <span className="text-[13px] font-semibold truncate"
            style={{ color: onOpen && hovered ? S.primary : S.onSurface, transition: 'color 0.15s ease' }}>
            {name}
          </span>
        ) : (
          <span aria-hidden />
        )}
        <ShiftValue value={band.median} size={24} fontFamily={HEADLINE_FONT} />
      </div>
      {hovered && (
        <div
          className="absolute left-1/2 bottom-full mb-2 z-20 rounded-lg px-3 py-1.5 w-max pointer-events-none"
          style={{
            transform: 'translateX(-50%)',
            // As wide as its text, and wrapped within the screen on a phone.
            maxWidth: 'min(340px, calc(100vw - 32px))',
            backgroundColor: S.surface,
            color: S.onSurface,
            border: `1px solid ${S.cardBorderStrong}`,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: BODY_FONT,
            fontVariantNumeric: 'tabular-nums',
            boxShadow: SHADOW.popover,
          }}
        >
          P10 {fmtShift(band.p10, 1)} to P90 {fmtShift(band.p90, 1)}
          <span style={{ color: S.onSurfaceVariant }}> · {bandNote}</span>
        </div>
      )}
    </>
  );
  const surface: React.CSSProperties = {
    backgroundColor: S.surface,
    border: `1px solid ${S.cardBorder}`,
    fontFamily: BODY_FONT,
  };
  // The accessible name carries everything the tile shows: its label, the
  // category, the median and the band.
  const figures = `median ${fmtShift(band.median, 1)}, P10 ${fmtShift(band.p10, 1)} to P90 ${fmtShift(band.p90, 1)}, ${bandNote}`;
  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-label={`${label}: ${name ?? ''}, ${figures}. Opens the drill-down`}
      className="relative rounded-2xl px-5 py-3.5 text-left"
      style={{ ...surface, cursor: 'pointer' }}
    >
      {inner}
    </button>
  ) : (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onClick={() => setHovered((h) => !h)}
      tabIndex={0}
      role="group"
      aria-label={`${label}: ${figures}`}
      className="relative rounded-2xl px-5 py-3.5"
      style={surface}
    >
      {inner}
    </div>
  );
};
