/**
 * The matrix toolbar's controls: the lens and impact-filter labels, the
 * segmented control and the year stepper of the attribution lenses.
 */
import type { FC } from 'react';
import {
  Calendar, Layers, Globe2, Zap, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Activity,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BASE_YEAR, FIRST_YEAR, HORIZON, YEARS } from '@/lib/format';
import { S, SHADOW, BODY_FONT } from '@/lib/theme';
import type { ImpactFilter, Lens } from './matrixModel';

export const LENS_META: Record<Lens, { label: string; description: string; Icon: LucideIcon }> = {
  time:   { label: 'Time Path',   description: `MC median shifts ${FIRST_YEAR}→${HORIZON}, cumulative vs ${BASE_YEAR}`, Icon: Calendar },
  force:  { label: 'Force attribution',       description: 'Splits each category\'s median across the forces by the size of their drivers\' effects (expected effect × exposure × force weight), not by their direction: every force takes a share in the median\'s direction. Attribution, not an independent simulation', Icon: Zap },
  vc:     { label: 'Value-chain epicentre attribution', description: 'Splits each category\'s median by the size of the drivers\' effects and gives each driver\'s share wholly to the stage where its impact centres (its epicentre); effects are not passed up or down the chain. Attribution, not an independent simulation', Icon: Layers },
  region: { label: 'Region attribution',      description: 'Splits each category\'s median across the regions by the size of the drivers\' effects there (expected effect × exposure × regional exposure × the region\'s share of the category\'s gross profit), not by their direction. Attribution, not an independent simulation', Icon: Globe2 },
};

export const IMPACT_META: Record<ImpactFilter, { label: string; description: string; Icon: LucideIcon }> = {
  total:       { label: 'Net',                 description: 'Net shift: expansion and contraction drivers combined.', Icon: Activity },
  expansion:   { label: 'Expansion drivers',   description: 'The part of each year\'s net shift the expanding drivers carry: their contributions at the score means, scaled to the net. A split of the net run, not a separate one.', Icon: TrendingUp },
  contraction: { label: 'Contraction drivers', description: 'The part of each year\'s net shift the contracting drivers carry: their contributions at the score means, scaled to the net. A split of the net run, not a separate one.', Icon: TrendingDown },
};

// ─── Controls ────────────────────────────────────────────────────────────

/** A connected set of options that reads as one control (the lens, or the
 *  impact filter). The bordered track and the raised active segment keep it
 *  distinct from the year stepper and the info button beside it. */
export const SegControl: FC<{
  /** An item with a `disabledReason` cannot be chosen; the reason is its tooltip. */
  items: Array<{ id: string; label: string; Icon?: LucideIcon; disabledReason?: string }>;
  activeId: string;
  onSelect: (id: string) => void;
  ariaLabel: string;
  size?: 'md' | 'sm';
}> = ({ items, activeId, onSelect, ariaLabel, size = 'md' }) => {
  const sm = size === 'sm';
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-center"
      style={{
        backgroundColor: S.surfaceLow,
        border: `1px solid ${S.cardBorder}`,
        borderRadius: 10,
        padding: 3,
        gap: 2,
        maxWidth: '100%',
        overflowX: 'auto',
      }}
    >
      {items.map(({ id, label, Icon, disabledReason }) => {
        const active = id === activeId;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            disabled={disabledReason != null}
            title={disabledReason}
            onClick={() => onSelect(id)}
            className={`inline-flex items-center transition-all ${sm
              ? 'gap-1.5 px-2.5 py-1.5 text-[12px]'
              : 'gap-2 px-3.5 py-2 text-[13px]'}`}
            style={{
              borderRadius: 7,
              border: 'none',
              backgroundColor: active ? S.surface : 'transparent',
              color: active ? S.primary : S.onSurfaceVariant,
              fontWeight: active ? 700 : 600,
              boxShadow: active ? SHADOW.raised : 'none',
              fontFamily: BODY_FONT,
              cursor: disabledReason != null ? 'not-allowed' : 'pointer',
              opacity: disabledReason != null ? 0.45 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {Icon && <Icon size={sm ? 13 : 14} strokeWidth={2.3} />}
            {label}
          </button>
        );
      })}
    </div>
  );
};

/** The measurement year of the attribution lenses: one compact control that
 *  steps through the path years; the arrows disable at the ends. */
export const YearStepper: FC<{
  year: number;
  onChange: (year: number) => void;
}> = ({ year, onChange }) => {
  const idx = YEARS.indexOf(year);
  const atMin = idx <= 0;
  const atMax = idx < 0 || idx >= YEARS.length - 1;
  const step = (dir: -1 | 1) => {
    const next = YEARS[idx + dir];
    if (next != null) onChange(next);
  };
  const arrow = (dir: -1 | 1, disabled: boolean, Icon: LucideIcon, label: string) => (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={() => step(dir)}
      className="inline-flex items-center justify-center transition-all"
      style={{
        width: 32,
        height: 32,
        border: 'none',
        backgroundColor: 'transparent',
        color: disabled ? S.mutedText : S.onSurfaceVariant,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <Icon size={16} strokeWidth={2.3} />
    </button>
  );
  return (
    <div
      role="group"
      aria-label="Measurement year"
      className="inline-flex items-center"
      style={{
        backgroundColor: S.surface,
        border: `1px solid ${S.cardBorder}`,
        borderRadius: 9,
        height: 34,
        overflow: 'hidden',
      }}
    >
      {arrow(-1, atMin, ChevronLeft, 'Earlier year')}
      <span
        aria-live="polite"
        style={{
          minWidth: 58,
          textAlign: 'center',
          fontWeight: 700,
          fontSize: 13,
          fontVariantNumeric: 'tabular-nums',
          color: S.onSurface,
          borderLeft: `1px solid ${S.cardBorder}`,
          borderRight: `1px solid ${S.cardBorder}`,
          height: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: BODY_FONT,
        }}
      >
        {year}
      </span>
      {arrow(1, atMax, ChevronRight, 'Later year')}
    </div>
  );
};
