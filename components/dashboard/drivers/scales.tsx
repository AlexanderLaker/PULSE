/**
 * The Drivers page's scales and pickers: the probability and exposure dots,
 * the uncertainty and diffusion-curve pickers, the value-chain epicentre rail
 * and slider, and the category and regional exposure grids, read-only and
 * editable.
 */
import type { FC } from 'react';
import { CATEGORIES, NO_VALUE, REGIONS, shortCat } from '@/lib/format';
import { UNCERTAINTY_LABELS } from '@/lib/uncertainty';
import { S, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';
import { VC_STEPS, VC_SHORT_LABELS } from '@/lib/valueChain';
import type { ExposureMap } from '@/types';
import { DELTA_COLOR, DIFFUSION_LABELS, EXPERT_COLOR, uncLabel, vcPos, vcStageLabel } from './shared';

// ─── Probability dot bar ──────────────────────────────────────────
interface DotBarProps {
  value: number;
  editable?: boolean;
  onChange?: (next: number) => void;
}
export const DotBar: FC<DotBarProps> = ({ value, editable = false, onChange }) => (
  <div
    className="flex gap-1.5"
    role={editable ? 'radiogroup' : undefined}
    aria-label={`Probability ${value} of 5`}
  >
    {[1, 2, 3, 4, 5].map((d) => {
      const filled = d <= value;
      // A 24px hit area around the 10px dot: padding 7 with margin -7 keeps
      // the dot-and-gap layout, background-clip paints only the dot, and the
      // global :focus-visible ring marks keyboard focus.
      return (
        <span
          key={d}
          role={editable ? 'radio' : undefined}
          // One radio in the group is checked: the selected value.
          aria-checked={editable ? d === value : undefined}
          aria-label={editable ? `${d} of 5` : undefined}
          tabIndex={editable ? 0 : -1}
          onClick={editable && onChange ? (e) => { e.stopPropagation(); onChange(d); } : undefined}
          onKeyDown={editable && onChange ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(d); }
          } : undefined}
          className="inline-block rounded-full"
          style={{
            width: 24, height: 24, padding: 7, margin: -7,
            boxSizing: 'border-box', backgroundClip: 'content-box',
            backgroundColor: filled ? S.primary : S.surfaceHigh,
            cursor: editable ? 'pointer' : 'default',
            transition: 'background-color 140ms',
          }}
        />
      );
    })}
  </div>
);

// ─── Category exposure grid (read-only), grouped Hair / LHC ───────
export const CategoryExposureGrid: FC<{ exposures: ExposureMap }> = ({ exposures }) => {
  const grouped = {
    Hair: CATEGORIES.filter((c) => c.group === 'Hair'),
    LHC:  CATEGORIES.filter((c) => c.group === 'LHC'),
  };
  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([group, cats]) => (
        <div key={group}>
          <div
            className="text-[11px] font-semibold mb-2"
            style={{ color: S.onSurfaceVariant, letterSpacing: '0.08em' }}
          >
            {group.toUpperCase()}
          </div>
          <div className="grid grid-cols-4 gap-3">
            {cats.map((cat) => (
              <div key={cat.name} className="flex flex-col items-center gap-1.5">
                <ReadDots value={exposures[cat.name] ?? 0} color={S.primary} />
                <div
                  className="text-[11px] font-medium text-center"
                  style={{ color: S.onSurface }}
                >
                  {shortCat(cat.name)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

/** The baseline's mark: an outlined diamond, as on the value-chain rails. */
export const BaselineMark: FC<{ size?: number }> = ({ size = 9 }) => (
  <span aria-hidden style={{
    display: 'inline-block', flexShrink: 0, width: size, height: size, boxSizing: 'border-box',
    backgroundColor: S.bg, border: `2px solid ${S.onSurface}`, transform: 'rotate(45deg)',
  }} />
);

/** Read-only epicentre rail with its stage labels, for the expanded panel
 *  only: the collapsed rows carry no value-chain cell. A diamond marks the
 *  baseline stage where it differs. */
export const EpicentreRail: FC<{ stage: number | null; baseline?: number | null }> = ({ stage, baseline }) => {
  const title = stage == null
    ? 'Value chain: unscored'
    : `Value chain epicentre: ${vcStageLabel(stage)}${baseline != null && baseline !== stage ? ` · baseline: ${VC_STEPS[baseline - 1]}` : ''}`;
  return (
    <div title={title} aria-label={title} style={{ cursor: 'help' }}>
      <div style={{ position: 'relative', height: 40 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 17, height: 6, borderRadius: 6, backgroundColor: S.surfaceHigh }} />
        {VC_STEPS.map((step, i) => (
          <span key={step} style={{
            position: 'absolute', top: 16, left: vcPos(i + 1),
            width: 8, height: 8, borderRadius: 999,
            backgroundColor: S.surfaceHighest, transform: 'translateX(-50%)',
          }} />
        ))}
        {baseline != null && baseline !== stage && (
          <span style={{
            position: 'absolute', top: 15, left: vcPos(baseline),
            width: 10, height: 10, backgroundColor: S.bg, border: `2px solid ${S.onSurface}`,
            transform: 'translateX(-50%) rotate(45deg)',
          }} />
        )}
        {stage != null && (
          <span style={{
            position: 'absolute', top: 11, left: vcPos(stage),
            width: 18, height: 18, borderRadius: 999,
            backgroundColor: S.primary, border: '3px solid #ffffff',
            outline: `1px solid ${S.cardBorderStrong}`, transform: 'translateX(-50%)',
          }} />
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', marginTop: 2 }}>
        {VC_SHORT_LABELS.map((l, i) => (
          <span key={l} style={{
            fontSize: 11, textAlign: 'center', lineHeight: 1.25,
            color: i + 1 === stage ? S.primary : S.mutedText,
            fontWeight: i + 1 === stage ? 800 : 400,
          }}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
};

/** Editable epicentre slider (Expert Rating and the admin editor): drag the
 *  pin or click a stage; the value snaps to one of the eight stages. */
export const EpicentreSlider: FC<{
  value: number | null;
  baseline?: number | null;
  onChange: (stage: number) => void;
}> = ({ value, baseline, onChange }) => (
  <div>
    <div style={{ position: 'relative', height: 44 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 19, height: 6, borderRadius: 6, backgroundColor: S.surfaceHigh }} />
      {VC_STEPS.map((step, i) => (
        <span key={step} style={{
          position: 'absolute', top: 17, left: vcPos(i + 1), width: 10, height: 10,
          borderRadius: 999, backgroundColor: S.surfaceHighest, transform: 'translateX(-50%)',
        }} />
      ))}
      {baseline != null && baseline !== value && (
        <span title={`Baseline: ${VC_STEPS[baseline - 1]}`} style={{
          position: 'absolute', top: 17, left: vcPos(baseline), width: 10, height: 10,
          backgroundColor: S.bg, border: `2px solid ${S.onSurface}`,
          transform: 'translateX(-50%) rotate(45deg)', cursor: 'help',
        }} />
      )}
      {value != null && (
        <span style={{
          position: 'absolute', top: 12, left: vcPos(value), width: 20, height: 20,
          borderRadius: 999, backgroundColor: S.primary, border: '3px solid #ffffff',
          outline: `1px solid ${S.cardBorderStrong}`, transform: 'translateX(-50%)',
          pointerEvents: 'none',
        }} />
      )}
      <input
        type="range" min={1} max={8} step={1}
        value={value ?? baseline ?? 5}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        aria-label="Value chain epicentre"
        aria-valuetext={value != null ? vcStageLabel(value) : 'unscored'}
        style={{ position: 'absolute', left: 0, right: 0, top: 8, width: '100%', height: 28, opacity: 0, cursor: 'grab', margin: 0 }}
      />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', marginTop: 2 }}>
      {VC_STEPS.map((step, i) => (
        <button
          key={step} type="button" onClick={() => onChange(i + 1)}
          aria-pressed={i + 1 === value}
          title={baseline === i + 1 ? `${step} (baseline)` : step}
          style={{
            border: 'none', background: 'transparent', padding: '4px 0', cursor: 'pointer',
            fontFamily: BODY_FONT, fontSize: 11, textAlign: 'center', lineHeight: 1.25,
            color: i + 1 === value ? S.primary : S.mutedText,
            fontWeight: i + 1 === value ? 800 : 400,
          }}
        >
          {VC_SHORT_LABELS[i]}
        </button>
      ))}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: S.neutral, fontWeight: 700 }}>Upstream</span>
      <span title="The driver's baseline stage" style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999,
        backgroundColor: S.surfaceLow, color: S.onSurfaceVariant, fontSize: 11, fontWeight: 700,
        fontFamily: HEADLINE_FONT, whiteSpace: 'nowrap', cursor: 'help',
      }}>
        <BaselineMark /> {baseline != null ? `Baseline: ${VC_STEPS[baseline - 1]}` : `Baseline ${NO_VALUE}`}
      </span>
      <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: S.neutral, fontWeight: 700 }}>Downstream</span>
    </div>
  </div>
);

// ─── Regional exposure grid (read-only) ───────────────────────────
export const RegionExposureGrid: FC<{ exposures: ExposureMap }> = ({ exposures }) => (
  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
    {REGIONS.map((region) => (
      <div key={region} className="flex flex-col gap-1.5">
        <div className="text-[11px] font-medium" style={{ color: S.onSurface }}>
          {region}
        </div>
        <ReadDots value={exposures[region] ?? 0} color={S.primary} />
      </div>
    ))}
  </div>
);

/** Uncertainty picker: six labelled buttons, 0 to 5 (0 is a real score,
 *  unlike probability), with the baseline score outlined. */
export const UncertaintyPicker: FC<{
  value: number | null | undefined;
  baseline?: number | null;
  onChange: (v: number) => void;
  /** Clicking the selected score again clears it (Expert Rating). */
  onClear?: () => void;
}> = ({ value, baseline, onChange, onClear }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div role="radiogroup" aria-label="Uncertainty score" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
      title={baseline != null ? `Baseline ${baseline} / 5 (${UNCERTAINTY_LABELS[baseline]})` : undefined}>
      {[0, 1, 2, 3, 4, 5].map((v) => {
        const on = value != null && Math.round(value) === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => (on && onClear ? onClear() : onChange(v))}
            title={`${v}: ${UNCERTAINTY_LABELS[v]}${baseline === v ? ' (baseline)' : ''}${on && onClear ? ', click again to clear' : ''}`}
            style={{
              minWidth: 44, padding: '6px 8px', borderRadius: 8,
              border: `1px solid ${baseline === v && !on ? S.primary : 'transparent'}`,
              backgroundColor: on ? S.primary : S.surfaceLow,
              color: on ? '#fff' : S.onSurface,
              fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 12, cursor: 'pointer',
            }}
          >
            {v}
          </button>
        );
      })}
    </div>
    <span style={{ fontSize: 11, color: S.mutedText }}>{uncLabel(value)}</span>
  </div>
);

/** The hover on an exposure cell: its baseline score; undefined without a
 *  baseline, so the dots keep their own "N / 5" labels. */
const baselineHint = (v: number | undefined): string | undefined =>
  v == null ? undefined : `Baseline ${v} / 5`;

// Dot fill for a fractional score: a full dot is solid, a partial one fills
// from the left (a mean of 3.2 fills a fifth of the fourth dot), an empty one
// is grey.
const dotFill = (frac: number, color: string): string => {
  if (frac >= 0.999) return color;
  if (frac <= 0.001) return S.surfaceHigh;
  const p = Math.round(frac * 100);
  return `linear-gradient(90deg, ${color} ${p}%, ${S.surfaceHigh} ${p}%)`;
};

/** A read-only 1–5 dot scale in any colour, with DotBar's geometry. */
export const ColorDots: FC<{ value: number; color: string; title?: string; muted?: boolean }> = ({ value, color, title, muted }) => (
  <div className="flex gap-1.5" title={title} aria-label={`${value} of 5`} style={{ cursor: title ? 'help' : undefined }}>
    {[1, 2, 3, 4, 5].map((d) => (
      <span key={d} className="inline-block w-2.5 h-2.5 rounded-full"
        style={{ background: dotFill(Math.max(0, Math.min(1, value - (d - 1))), color), opacity: muted ? 0.5 : 1 }} />
    ))}
  </div>
);

export const DeltaChip: FC<{ value: number; unit?: string; digits?: number }> = ({ value, unit = '', digits = 1 }) => {
  const zero = Math.abs(value) < (digits === 0 ? 0.5 : 0.05);
  const sign = value > 0 ? '+' : '−';
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 999, whiteSpace: 'nowrap',
      backgroundColor: zero ? S.surfaceLow : 'rgba(176,125,43,0.15)',
      color: zero ? S.mutedText : DELTA_COLOR,
    }}>
      {zero ? '=' : `${sign}${Math.abs(value).toFixed(digits)}${unit}`}
    </span>
  );
};

// ── Diffusion-curve glyphs and the curve picker ──
const CURVE_PATHS: Record<string, string> = {
  s_curve: 'M2,16 C9,15 11,3 26,2',
  linear: 'M2,16 L26,2',
  front_loaded: 'M2,16 Q6,3 26,2',
  back_loaded: 'M2,16 Q22,15 26,2',
  step_function: 'M2,16 L18,16 L18,2 L26,2',
};
export const DiffusionGlyph: FC<{ curve: string; color: string }> = ({ curve, color }) => (
  <svg width="30" height="18" viewBox="0 0 28 18" aria-hidden="true">
    <path d={CURVE_PATHS[curve] ?? CURVE_PATHS.s_curve} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
  </svg>
);
export const DiffusionPicker: FC<{
  value?: string | null;
  baseline?: string;
  distribution?: Record<string, number>;
  onChange: (curve: string) => void;
  /** Clicking the selected curve again clears it (Expert Rating). */
  onClear?: () => void;
}> = ({ value, baseline, distribution, onChange, onClear }) => (
  <div className="flex flex-wrap gap-2">
    {Object.entries(DIFFUSION_LABELS).map(([key, meta]) => {
      const selected = value === key;
      const n = distribution?.[key];
      return (
        <button key={key} type="button" onClick={() => (selected && onClear ? onClear() : onChange(key))}
          title={`${baseline === key ? `${meta.label} (baseline): ` : ''}${meta.description}${selected && onClear ? ' (click again to clear)' : ''}`}
          aria-pressed={selected} style={{
            position: 'relative', minWidth: 78, textAlign: 'center', padding: '8px 10px 6px', borderRadius: 9, cursor: 'pointer',
            backgroundColor: S.surface, border: `1px solid ${selected ? S.primary : S.cardBorder}`,
            boxShadow: selected ? `inset 0 0 0 1px ${S.primary}` : 'none',
          }}>
          {baseline === key && (
            <span style={{ position: 'absolute', top: 6, right: 6, display: 'inline-flex' }}><BaselineMark size={8} /></span>
          )}
          <DiffusionGlyph curve={key} color={selected ? S.primary : S.onSurfaceVariant} />
          <div style={{ fontSize: 11, fontWeight: 700, color: S.onSurface, marginTop: 3 }}>{meta.label}</div>
          {n != null && n > 0 && <div style={{ fontSize: 11, fontWeight: 800, color: EXPERT_COLOR, marginTop: 2 }}>×{n}</div>}
        </button>
      );
    })}
  </div>
);

// ── Read-only 0–5 dot scale: six dots including the 0 dot, like EditableDots ──
export const ReadDots: FC<{ value?: number; color: string }> = ({ value, color }) => (
  <div className="flex gap-1" aria-label={value != null ? `${value} of 5` : 'unscored'}>
    {[0, 1, 2, 3, 4, 5].map((d) => {
      const bg = d === 0
        ? (value === 0 ? color : S.surfaceHigh)
        : dotFill(value == null ? 0 : Math.max(0, Math.min(1, value - (d - 1))), color);
      return (
        <span key={d} className="inline-block rounded-full"
          style={{ width: 14, height: 14, background: bg, opacity: d === 0 ? 0.4 : 1 }} />
      );
    })}
  </div>
);

// Editable 0–5 dot scale for the category, regional and manual exposure cells.
// An unscored cell (value undefined) shows no dot at all, never a 0.
export const EditableDots: FC<{
  value: number | undefined;
  /** The value chosen; undefined when a clearable cell's selected dot is clicked again. */
  onChange: (next: number | undefined) => void;
  /** What the cell scores, for screen readers ("Hair: Care exposure"). */
  label: string;
  /** Clicking the selected dot again clears the cell (Expert Rating). */
  clearable?: boolean;
  /** When set (e.g. "Baseline 3 / 5"), hovering the dots shows it, the same
   *  plain hover the Probability and GP1 % fields use, instead of the
   *  per-dot "N / 5" label. */
  hint?: string;
}> = ({ value, onChange, label, clearable = false, hint }) => (
  <div className="flex gap-1" role="radiogroup"
    aria-label={`${label}: ${value == null ? 'not scored' : `${value} of 5`}`}
    title={hint} style={{ cursor: hint ? 'help' : undefined }}>
    {/* A 24px hit area per dot: padding and background-clip keep the painted
        dot at 14px, the negative margin keeps the 4px gap, and the global
        :focus-visible ring marks keyboard focus. */}
    {[0, 1, 2, 3, 4, 5].map((d) => (
      <button
        key={d}
        type="button"
        onClick={() => onChange(clearable && d === value ? undefined : d)}
        aria-checked={d === value}
        aria-label={`${d} of 5`}
        role="radio"
        title={hint ?? (clearable && d === value ? `${d} / 5, click again to clear` : `${d} / 5`)}
        style={{
          width: 24, height: 24, borderRadius: 999,
          border: 'none', padding: 5, margin: -5,
          boxSizing: 'border-box', backgroundClip: 'content-box',
          cursor: hint ? 'help' : 'pointer',
          backgroundColor: value == null
            ? S.surfaceHigh
            : d === 0
              ? (value === 0 ? S.primary : S.surfaceHigh)
              : (d <= value ? S.primary : S.surfaceHigh),
          opacity: d === 0 ? 0.35 : 1,
          transition: 'background-color 120ms',
        }}
      />
    ))}
  </div>
);

// ─── Editable exposure grids (the admin editor and Expert Rating) ──
/** The map with one cell set, or removed when `val` is undefined. */
const withCell = (exposures: ExposureMap, key: string, val: number | undefined): ExposureMap => {
  const next = { ...exposures };
  if (val == null) delete next[key]; else next[key] = val;
  return next;
};

export const EditableCategoryGrid: FC<{
  exposures: ExposureMap;
  onChange: (next: ExposureMap) => void;
  baseline?: ExposureMap;
  /** Cells may be left unscored and cleared again (Expert Rating). */
  clearable?: boolean;
}> = ({ exposures, onChange, baseline, clearable = false }) => {
  const grouped = {
    Hair: CATEGORIES.filter((c) => c.group === 'Hair'),
    LHC:  CATEGORIES.filter((c) => c.group === 'LHC'),
  };
  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([group, cats]) => (
        <div key={group}>
          <div
            className="text-[11px] font-semibold mb-2"
            style={{ color: S.onSurfaceVariant, letterSpacing: '0.08em' }}
          >
            {group.toUpperCase()}
          </div>
          <div className="grid grid-cols-4 gap-3">
            {cats.map((cat) => (
              <div key={cat.name} className="flex flex-col items-center gap-1.5">
                <EditableDots
                  value={clearable ? exposures[cat.name] : (exposures[cat.name] ?? 0)}
                  onChange={(v) => onChange(withCell(exposures, cat.name, v))}
                  label={`${cat.name} exposure`}
                  clearable={clearable}
                  hint={baselineHint(baseline == null ? undefined : (baseline[cat.name] ?? 0))}
                />
                <div
                  className="text-[11px] font-medium text-center"
                  style={{ color: S.onSurface }}
                >
                  {shortCat(cat.name)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export const EditableRegionGrid: FC<{
  exposures: ExposureMap;
  onChange: (next: ExposureMap) => void;
  baseline?: ExposureMap;
  /** Cells may be left unscored and cleared again (Expert Rating). */
  clearable?: boolean;
}> = ({ exposures, onChange, baseline, clearable = false }) => (
  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
    {REGIONS.map((region) => (
      <div key={region} className="flex flex-col gap-1.5">
        <div className="text-[11px] font-medium" style={{ color: S.onSurface }}>
          {region}
        </div>
        <EditableDots
          value={clearable ? exposures[region] : (exposures[region] ?? 0)}
          onChange={(v) => onChange(withCell(exposures, region, v))}
          label={`${region} exposure`}
          clearable={clearable}
          hint={baselineHint(baseline == null ? undefined : (baseline[region] ?? 0))}
        />
      </div>
    ))}
  </div>
);
