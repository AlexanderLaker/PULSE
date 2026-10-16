/**
 * A headline figure above the matrix: a median with its P10 to P90 band in
 * text and as a thin range bar on a scale the three tiles share; what the
 * band covers opens on hover, focus or tap.
 */
import React, { useState, type FC } from 'react';
import { fmtShift, shiftColor } from '@/lib/format';
import { S, SHADOW, HEADLINE_FONT, BODY_FONT, FIGURES } from '@/lib/theme';
import ShiftValue from './ShiftValue';
import type { PercentileDistribution } from '@/types';

/** A headline figure above the matrix. Its P10 to P90 band is under the
 *  figure in text and as a range bar; the note on what the band covers opens
 *  on hover, keyboard focus and tap, so it never depends on a mouse; a
 *  category tile opens the same drill-down as its matrix row. */
export const KpiTile: FC<{
  label: string;
  band: PercentileDistribution;
  /** The category's label; the portfolio tile has none. */
  name?: string;
  /** Appended to the band: what it covers. */
  bandNote: string;
  /** The ends of the range bar's scale, shared by the tiles of one strip. */
  scaleMin: number;
  scaleMax: number;
  onOpen?: () => void;
}> = ({ label, band, name, bandNote, scaleMin, scaleMax, onOpen }) => {
  const [hovered, setHovered] = useState(false);
  const bandText = `P10 ${fmtShift(band.p10, 1)} to P90 ${fmtShift(band.p90, 1)}`;

  // The range bar: the band as a segment on the shared scale, the median as
  // a tick in the shift's colour, zero as a hairline where it is inside the
  // scale. Decorative: the figures are in the text above it.
  const span = scaleMax - scaleMin;
  const at = (v: number) => (span > 0 ? Math.min(100, Math.max(0, ((v - scaleMin) / span) * 100)) : 50);
  const colour = shiftColor(band.median);
  const zeroInside = scaleMin < 0 && scaleMax > 0;

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
      <div
        className="mt-1.5 text-[11.5px] font-semibold"
        style={{ color: S.onSurfaceVariant, ...FIGURES, fontVariantNumeric: 'tabular-nums' }}
      >
        {bandText}
      </div>
      <div
        aria-hidden
        className="relative mt-1.5 rounded-full"
        style={{ height: 4, backgroundColor: S.surfaceLow }}
      >
        <div
          className="absolute top-0 bottom-0 rounded-full"
          style={{
            left: `${at(band.p10)}%`,
            width: `${Math.max(0.5, at(band.p90) - at(band.p10))}%`,
            backgroundColor: colour,
            opacity: 0.45,
          }}
        />
        <div
          className="absolute"
          style={{
            left: `calc(${at(band.median)}% - 1px)`, top: -2, width: 2, height: 8,
            borderRadius: 1, backgroundColor: colour,
          }}
        />
        {zeroInside && (
          <div
            className="absolute"
            style={{
              left: `${at(0)}%`, top: -3, width: 1, height: 10,
              backgroundColor: S.onSurface, opacity: 0.55,
            }}
          />
        )}
      </div>
      {hovered && (
        <div
          // As wide as the tile and wrapped inside it, so it stays on the
          // screen whichever column the tile is in.
          className="absolute inset-x-0 bottom-full mb-2 z-20 rounded-lg px-3 py-1.5 pointer-events-none"
          style={{
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
          {bandText}
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
  const figures = `median ${fmtShift(band.median, 1)}, ${bandText}, ${bandNote}`;
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
