/**
 * Profit Pool Analysis 2 — Editorial Shift Matrix View
 *
 * A lean, focused view of the Shift Matrix with four lenses:
 *   • Time Path     — category × year (MC median shifts)
 *   • Force         — category × 6 forces, at a selected year
 *   • Value Chain   — category × 8 value-chain steps, at a selected year
 *   • Region        — category × 4 regions, at a selected year
 *
 * Decomposition (Layer B) is produced by the backend (bayesian_mc v2.5+)
 * and arrives on `simulation.decompositions`. By construction each lens's
 * row total equals the MC median shift for that (cat, year), so the three
 * lenses reconcile cell-by-cell to the same per-category per-year shift.
 *
 * Totals (Layer C, Apr 2026 rewrite) — column totals, grand totals and
 * Time-Path per-year totals are computed in the frontend as CATEGORY-WEIGHTED
 * AVERAGES using `config.category_weights`, NOT as raw sums. This makes the
 * bottom-right cell a single, interpretable portfolio-level shift per year:
 *
 *   grand[y]         = Σ_c cw[c] × mc_median[c][y]   /   Σ_c cw[c]
 *   col_total[d][y]  = Σ_c cw[c] × decomp[c][d][y]   /   Σ_c cw[c]
 *   row_total[c][y]  = mc_median[c][y]               (matches Time Path cell)
 *
 * Identity: Σ_d col_total[d][y] = grand[y] (shares sum to 1 per cat),
 * so Force / VC / Region / Time Path all show the same grand total at a
 * given year.
 *
 * Why cw only (not force/vc/region weights on rows)? Per-category row
 * totals are anchored to the MC median — that's the one number the
 * simulation produces per (cat, year), and the lens decomposition is
 * exhaustive (shares sum to 1). Using force/vc/region weights on rows
 * would rescale that anchor away from the Time Path figure the user
 * already trusts. Those weights still live INSIDE the backend share
 * computation (they shape which force/step/region gets what fraction
 * of each cat shift), so business importance of a force / step / region
 * is already baked into the cell values.
 */

'use client';

import React, { useMemo, useState, useEffect, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Layers, Globe2, Zap, Loader2, AlertTriangle,
  Sparkles, Info, Database, ChevronDown, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, Activity,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import * as api from '@/api/client';
import {
  CATEGORIES, YEARS, fmtShift, fmtPct, shiftArrow, shiftColor,
  heatFill, heatText, heatScaleFor, fmtDate, fmtDateTime,
  categoryDisplay, categoryCode, groupDisplay,
  EXPANSION_RGB, CONTRACTION_RGB,
} from '@/lib/format';
import { S, HEADLINE_FONT, BODY_FONT, MONO_FONT } from '@/lib/theme';
import ShiftValue from '@/components/dashboard/ShiftValue';
import {
  getYearPercentiles, weightedAvg,
  catWeightFor as resolveCatWeight, computeImpactFractions,
} from '@/lib/shiftMatrix';
import type {
  ForceName,
  PercentileDistribution, ShiftPath,
  DiagnosticsResult,
  Trend,
} from '@/types';
import CategoryDetailPanel from './CategoryDetailPanel';

// ─── Value-chain steps — must match backend VC_STEPS in pulse/config.py ──
const VC_STEPS: Array<{ id: string; label: string }> = [
  { id: 'Raw Materials', label: 'Raw Materials' },
  { id: 'Formulation',   label: 'Formulation' },
  { id: 'Manufacturing', label: 'Manufacturing' },
  { id: 'Packaging',     label: 'Packaging' },
  { id: 'Supply Chain',  label: 'Supply Chain' },
  { id: 'Marketing',     label: 'Marketing' },
  { id: 'Commercial',    label: 'Commercial' },
  { id: 'Consumer',      label: 'Consumer' },
];

// ─── Regions ─────────────────────────────────────────────────────
const REGIONS: Array<{ id: string; label: string }> = [
  { id: 'Europe',        label: 'Europe' },
  { id: 'North America', label: 'North America' },
  { id: 'Asia',          label: 'Asia' },
  { id: 'High Growth',   label: 'High Growth' },
];

// ─── Forces ──────────────────────────────────────────────────────
const FORCE_NAMES: ForceName[] = [
  'Consumer', 'Customer', 'Technology', 'Government', 'Environmental', 'Competitive',
];

// ─── View mode ───────────────────────────────────────────────────
type ViewMode = 'time' | 'force' | 'vc' | 'region';

const VIEW_META: Record<ViewMode, { label: string; description: string; Icon: LucideIcon }> = {
  time:   { label: 'Time Path',   description: 'MC median shifts 2026→2035, cumulative vs 2025', Icon: Calendar },
  force:  { label: 'Force attribution',       description: 'Distributes each category shift across forces by exposure — attribution, not an independent simulation', Icon: Zap },
  vc:     { label: 'Value chain epicentre attribution', description: 'Assigns each trend\'s contribution wholly to the single stage where its impact centres (its epicentre) — propagation up/down the chain is not modelled. Attribution, not an independent simulation', Icon: Layers },
  region: { label: 'Region attribution',      description: 'Distributes each category shift across regions by exposure — attribution, not an independent simulation', Icon: Globe2 },
};

// ─── Impact filter ───────────────────────────────────────────────
// Subdivides the matrix into the expansion-only / contraction-only
// portion of each cell. Implementation re-uses the same per-trend
// contribution math the row-detail panel already runs (gp1_shift ×
// exposure/5), then sums by sign per category and applies the
// resulting fraction to the backend-computed cells. Total is the
// default (no transformation — backend MC numbers as-is).
type ImpactFilter = 'total' | 'expansion' | 'contraction';

const IMPACT_META: Record<ImpactFilter, { label: string; description: string; Icon: LucideIcon }> = {
  total:       { label: 'Net',             description: 'Net shift — positive and negative trend impacts combined.', Icon: Activity },
  expansion:   { label: 'Positive-trend',  description: 'Positive-trend contribution — the share of each year\'s net shift from upside trends. Year-shape inherits from the net simulation; not a positive-only re-run.', Icon: TrendingUp },
  contraction: { label: 'Negative-trend',  description: 'Negative-trend contribution — the share of each year\'s net shift from downside trends. Year-shape inherits from the net simulation; not a negative-only re-run.', Icon: TrendingDown },
};

// ─── Helpers ─────────────────────────────────────────────────────

/** Extract median from a ShiftPath entry (may be number or PercentileDistribution). */
function extractMedian(v: PercentileDistribution | number | undefined): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  return v.median ?? null;
}

/** Get the median shift for a category at a given year.
 *  Tolerates both backend display keys ("Hair: Color") and snake_case IDs
 *  ("hair_color"), and tolerates both numeric (2030) and string ("2030")
 *  year keys in the shift path. */
function getYearShift(
  shifts: Record<string, ShiftPath> | undefined,
  catKey: string,
  catFallbackId: string,
  year: number,
): number | null {
  if (!shifts) return null;
  const path = shifts[catKey] ?? shifts[catFallbackId];
  if (!path) return null;
  const v = (path as Record<string | number, unknown>)[year]
         ?? (path as Record<string | number, unknown>)[String(year)];
  return extractMedian(v as PercentileDistribution | number | undefined);
}

// Heat ramp + text colour now live in lib/format.ts as the single source of
// truth (U3, June 2026) — imported as `heatFill` / `heatText` above. The Total
// row/column no longer carry conditional shading (U2): they read as flat,
// labelled figures so colour saturation never implies a scale the legend
// doesn't define.

// ─── UI Primitives ───────────────────────────────────────────────
/** Segmented control — a connected set of options that reads as ONE control
 *  (the view lens, or the trend-impact toggle). The bordered container + raised
 *  active segment make it unmistakably distinct from the year stepper and the
 *  info affordance, so the toolbar's three jobs never blur into one strip of
 *  look-alike pills (Compact Command Bar restructure, July 2026). */
const SegControl: FC<{
  items: Array<{ id: string; label: string; Icon?: LucideIcon }>;
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
      {items.map(({ id, label, Icon }) => {
        const active = id === activeId;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
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
              boxShadow: active ? '0 1px 2px rgba(0, 52, 94, 0.12)' : 'none',
              fontFamily: BODY_FONT,
              cursor: 'pointer',
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

/** Year stepper — replaces the 2026–2035 pill strip on the attribution lenses
 *  with one compact control, retiring the ten-pill overflow that was the row's
 *  worst crowding. Steps within YEARS; the arrows disable at the ends
 *  (Compact Command Bar restructure, July 2026). */
const YearStepper: FC<{
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

// ─── KPI tile — compact headline stat above the matrix ───────────
// Lean replacement for the old hero block (June 2026 declutter): one
// figure per tile, P10–P90 band revealed on hover only. Category
// tiles open the same full-page drill-down as the matrix rows.
const KpiTile: FC<{
  label: string;
  value: number;
  /** Category name (omitted on the portfolio tile). */
  name?: string;
  p10?: number | null;
  p90?: number | null;
  /** Short caption appended to the hover band, e.g. "80% of outcomes". */
  bandNote?: string;
  onOpen?: () => void;
}> = ({ label, value, name, p10, p90, bandNote, onOpen }) => {
  const [hovered, setHovered] = useState(false);
  const hasBand = p10 != null && p90 != null;
  const inner = (
    <>
      <div className="text-[11px] font-bold uppercase tracking-[0.12em]"
        style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>
        {label}
      </div>
      {/* R-21: one tile anatomy — label top, then name (left) + value (right)
          on a shared baseline; the value sits at the right edge on every tile
          even when there is no category name (portfolio tile). */}
      <div className="flex items-baseline justify-between gap-3 mt-1.5">
        {name ? (
          <span className="text-[13px] font-semibold truncate"
            style={{ color: onOpen && hovered ? S.primary : S.onSurface, transition: 'color 0.15s ease' }}>
            {name}
          </span>
        ) : (
          <span aria-hidden />
        )}
        <ShiftValue value={value} size={24} fontFamily={HEADLINE_FONT} />
      </div>
      {hovered && hasBand && (
        <div
          className="absolute left-1/2 bottom-full mb-2 z-20 rounded-lg px-3 py-1.5 whitespace-nowrap pointer-events-none"
          style={{
            transform: 'translateX(-50%)',
            backgroundColor: S.surface,
            color: S.onSurface,
            border: `1px solid ${S.cardBorderStrong}`,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: BODY_FONT,
            fontVariantNumeric: 'tabular-nums',
            boxShadow: '0 12px 32px -10px rgba(0, 52, 94, 0.22)',
          }}
        >
          P10 {fmtShift(p10, 1)} … P90 {fmtShift(p90, 1)}
          {bandNote ? <span style={{ color: S.onSurfaceVariant }}> · {bandNote}</span> : null}
        </div>
      )}
    </>
  );
  const surface: React.CSSProperties = {
    backgroundColor: S.surface,
    border: `1px solid ${S.cardBorder}`,
    fontFamily: BODY_FONT,
  };
  // R-04: the P10–P90 band is decision content — it opens on keyboard focus
  // and on tap, not just on mouse hover (iPad / keyboard parity; placement
  // unchanged per the owner's 2026-06-11 declutter ruling).
  const bandLabel = hasBand
    ? ` — P10 ${fmtShift(p10, 1)} to P90 ${fmtShift(p90, 1)}${bandNote ? `, ${bandNote}` : ''}`
    : '';
  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-label={`Open ${name ?? label} drill-down — fan chart and contributing trends${bandLabel}`}
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
      onClick={hasBand ? () => setHovered((h) => !h) : undefined}
      tabIndex={hasBand ? 0 : undefined}
      aria-label={hasBand ? `${label}${bandLabel}` : undefined}
      className="relative rounded-2xl px-5 py-3.5"
      style={surface}
    >
      {inner}
    </div>
  );
};

// ─── Matrix Table Component ──────────────────────────────────────
interface MatrixProps {
  columns: Array<{ id: string; label: string }>;
  rows: Array<{ id: string; label: string; group?: string; code?: string }>;
  /** Row-major data: rows[rowId][colId] = shift */
  data: Record<string, Record<string, number | null>>;
  subtitle?: string;
  emptyMessage?: string;
  /** Optional: per-row totals (sums across the dimension axis). */
  rowTotals?: Record<string, number | null>;
  /** Optional: per-column totals (sums across categories). */
  colTotals?: Record<string, number | null>;
  /** Optional: grand total cell at bottom-right. */
  grandTotal?: number | null;
  /** Whether to render row-total column and column-total row. */
  showTotals?: boolean;
  /** Optional: label for the rightmost row-total column header.
      Force / VC / Region lens views pass "Total 2030" etc. so the user
      always sees which measurement year the row total refers to. Time Path
      doesn't show a row-total column at all. Defaults to "Total". */
  rowTotalLabel?: string;
  /** Optional: per-cell percentile distribution, keyed [rowId][colId].
      When provided, hovering a cell shows a tooltip with the MC median plus
      the P10 and P90 percentile bands. Time Path view supplies this from the
      Bayesian MC shift matrix; the Force / VC / Region lens decompositions
      are scalar per cell so cellDetails is omitted for those views. */
  cellDetails?: Record<string, Record<string, PercentileDistribution | null>>;
  /** Optional: drill-down handler. When provided, every cell in the row
      (including the % values) is clickable and opens the Category Detail
      Panel with the fan chart, force decomposition and contributing
      trends for that single category. */
  onRowClick?: (rowId: string) => void;
  /** Shown in the hover tooltip when no per-cell bands exist. */
  noBandsNote?: string;
  /** Control strip rendered as the card's top bar (lens pills, impact
      filter / year selector) — keeps every control attached to the
      evidence it manipulates instead of floating above the card. */
  toolbar?: React.ReactNode;
}

const Matrix: FC<MatrixProps> = ({
  columns, rows, data, subtitle, emptyMessage,
  rowTotals, colTotals, grandTotal, showTotals = false,
  rowTotalLabel = 'Total',
  cellDetails,
  onRowClick,
  noBandsNote,
  toolbar,
}) => {
  // Group rows by group (Hair / LHC) for subtle sectioning
  const grouped = useMemo(() => {
    const map: Record<string, typeof rows> = {};
    rows.forEach((r) => {
      const g = r.group ?? 'All';
      if (!map[g]) map[g] = [];
      map[g].push(r);
    });
    return map;
  }, [rows]);

  // ─── Hover tooltip state ─────────────────────────────────────────
  // Tracks which data cell the cursor is over, plus the viewport-anchor
  // point (cell top-center). Uses `position: fixed` so the tooltip is
  // never clipped by the horizontally-scrolling table wrapper.
  const [hover, setHover] = useState<{
    rowId: string;
    colId: string;
    rowLabel: string;
    colLabel: string;
    x: number;
    y: number;
  } | null>(null);

  const onCellEnter = (
    e: React.MouseEvent<HTMLTableCellElement>,
    rowId: string,
    colId: string,
    rowLabel: string,
    colLabel: string,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHover({
      rowId, colId, rowLabel, colLabel,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  };
  const onCellLeave = () => setHover(null);

  // Row-level hover — signals the whole row is an interactive drill-down
  // target (any cell opens the Category Detail Panel) and powers the
  // "View details →" reveal on the category label.
  const [hoverRow, setHoverRow] = useState<string | null>(null);

  const hasAnyData = rows.some((r) => columns.some((c) => (data[r.id]?.[c.id] ?? null) !== null));

  // U2 (June 2026): the Total row/column are no longer heat-shaded, so there is
  // no separate data-driven colour scale to compute. Totals read as flat,
  // labelled figures (bold ▲/▼ + sign carries direction) — colour intensity is
  // reserved for the grid cells.

  // R-06 (design review 2026-07-01): the heat ramp scales to the values in
  // THIS view (P95 of |cell|, min 2%) instead of a fixed ±5%, so within-view
  // structure stays visible; the legend displays the scale in use.
  const viewScale = useMemo(
    () => heatScaleFor(rows.flatMap((r) => columns.map((c) => data[r.id]?.[c.id] ?? null))),
    [rows, columns, data],
  );

  // R-05: the per-row Total column only exists where row totals exist
  // (attribution lenses). Time Path passes none — previously this rendered
  // a full column of "—" that read as broken data.
  const showTotalCol = showTotals && !!rowTotals
    && Object.values(rowTotals).some((v) => v != null);

  if (!hasAnyData && emptyMessage) {
    return (
      <div
        className="flex flex-col items-center justify-center py-20 px-8 text-center rounded-2xl"
        style={{ backgroundColor: S.surfaceLow, color: S.mutedText }}
      >
        <Sparkles size={24} style={{ color: S.primary, opacity: 0.6 }} />
        <p className="mt-3 text-[14px] font-medium" style={{ color: S.onSurface, fontFamily: BODY_FONT }}>
          {emptyMessage}
        </p>
      </div>
    );
  }

  const totalColSpan = columns.length + (showTotalCol ? 1 : 0) + 1; // +1 for Category column

  return (
    <div
      className="rounded-2xl"
      style={{
        backgroundColor: S.surface,
        boxShadow: '0 4px 60px -15px rgba(0, 52, 94, 0.08)',
      }}
    >
      {toolbar && (
        <div
          className="rounded-t-2xl px-6 py-4 flex items-center justify-between gap-x-6 gap-y-3 flex-wrap"
          style={{
            backgroundColor: S.surface,
            borderBottom: `1px solid ${S.cardBorder}`,
          }}
        >
          {toolbar}
        </div>
      )}
      {subtitle && (
        <div
          className={`px-6 py-4 ${toolbar ? '' : 'rounded-t-2xl'}`}
          style={{
            backgroundColor: S.surfaceLow,
            color: S.onSurfaceVariant,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontFamily: HEADLINE_FONT,
          }}
        >
          {subtitle}
        </div>
      )}

      <div className="overflow-x-auto">
        <table
          className="w-full"
          style={{
            borderCollapse: 'separate',
            borderSpacing: 0,
            fontFamily: BODY_FONT,
          }}
        >
          <thead>
            <tr>
              <th
                className="text-left px-6 py-4 text-[11px] font-bold uppercase tracking-[0.12em] sticky left-0 z-10"
                style={{
                  backgroundColor: S.surface,
                  color: S.onSurfaceVariant,
                  minWidth: 180,
                }}
              >
                Category
              </th>
              {columns.map((col) => (
                <th
                  key={col.id}
                  className="px-3 py-4 text-[11px] font-bold uppercase tracking-[0.08em] text-center"
                  style={{ color: S.onSurfaceVariant, minWidth: 96 }}
                >
                  {col.label}
                </th>
              ))}
              {showTotalCol && (
                <th
                  className="px-3 py-4 text-[11px] font-bold uppercase tracking-[0.12em] text-center"
                  style={{
                    color: S.onSurface,
                    minWidth: 104,
                    backgroundColor: S.surfaceContainer,
                    borderLeft: `2px solid ${S.cardBorderStrong}`,
                  }}
                >
                  {rowTotalLabel}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([groupName, groupRows], gIdx) => (
              <React.Fragment key={groupName}>
                {groupName !== 'All' && (
                  <tr>
                    <td
                      colSpan={totalColSpan}
                      className="px-6 py-1 text-[11px] font-bold uppercase tracking-[0.14em]"
                      style={{
                        backgroundColor: gIdx === 0 ? S.surfaceLow : S.surfaceContainer,
                        color: S.onSurfaceVariant,
                        fontFamily: HEADLINE_FONT,
                      }}
                    >
                      {groupName}
                    </td>
                  </tr>
                )}
                {groupRows.map((row) => {
                  const isRowHover = hoverRow === row.id;
                  const rt = rowTotals?.[row.id] ?? null;
                  return (
                  <tr
                    key={row.id}
                    onClick={onRowClick ? () => onRowClick(row.id) : undefined}
                    onMouseEnter={onRowClick ? () => setHoverRow(row.id) : undefined}
                    onMouseLeave={onRowClick ? () => setHoverRow(null) : undefined}
                    style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                  >
                    <td
                      className="px-6 py-1 text-[13px] font-semibold sticky left-0 z-10"
                      style={{
                        backgroundColor: isRowHover ? S.surfaceLow : S.surface,
                        color: onRowClick ? S.primary : S.onSurface,
                        fontFamily: BODY_FONT,
                        transition: 'color 0.15s ease, background-color 0.15s ease',
                        boxShadow: isRowHover && onRowClick ? `inset 3px 0 0 ${S.primary}` : 'none',
                      }}
                    >
                      {onRowClick ? (
                        <span style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8 }}>
                          {/* L18 (July 2026 review): the drill-down's keyboard/AT
                              entry point is a REAL button inside the first cell.
                              The old `<tr role="button">` overrode the row role
                              and broke cell semantics for screen readers (cells
                              were no longer announced as table cells). Mouse
                              users keep the whole-row click via the tr handler;
                              focus lands here for everyone else. */}
                          <button
                            type="button"
                            className="ppa2-row-open"
                            onClick={(e) => { e.stopPropagation(); onRowClick(row.id); }}
                            onFocus={() => setHoverRow(row.id)}
                            onBlur={() => setHoverRow(null)}
                            aria-label={`Open ${row.label} detail — fan chart and contributing trends`}
                            style={{
                              all: 'unset', cursor: 'pointer',
                              textDecoration: isRowHover ? 'underline' : 'none',
                              textUnderlineOffset: '3px',
                            }}
                          >
                            {row.label}
                          </button>
                          {row.code && (
                            <span
                              style={{
                                fontFamily: MONO_FONT,
                                fontSize: 11, fontWeight: 600, letterSpacing: '0.02em',
                                color: S.mutedText, backgroundColor: S.surfaceLow,
                                padding: '1px 6px', borderRadius: 5, whiteSpace: 'nowrap',
                              }}
                            >
                              {row.code}
                            </span>
                          )}
                          {/* Persistent drill-down affordance (U4) — always visible,
                              not a hover-only reveal, so the drill-down is discoverable. */}
                          <span
                            aria-hidden
                            style={{
                              marginLeft: 'auto', color: S.primary,
                              fontWeight: 800, fontSize: 16, lineHeight: 1,
                              opacity: isRowHover ? 1 : 0.4, transition: 'opacity 0.15s ease',
                            }}
                          >
                            ›
                          </span>
                        </span>
                      ) : (
                        row.label
                      )}
                    </td>
                    {columns.map((col) => {
                      const v = data[row.id]?.[col.id] ?? null;
                      const isCellHover = hover?.rowId === row.id && hover?.colId === col.id;
                      // L16 (July 2026 review): the P10–P90 band is a governance
                      // feature and must not be pointer-only. Screen readers get
                      // the full band via the cell's aria-label (announced in
                      // table navigation, no tab-stop pollution across 130+
                      // cells); sighted keyboard users reach the same band via
                      // the row drill-down button (fan chart).
                      const det = cellDetails?.[row.id]?.[col.id] ?? null;
                      const bandLabel = v == null ? undefined
                        : det && det.p10 != null && det.p90 != null
                          ? `${row.label}, ${col.label}: median ${fmtShift(v, 1)}, P10 ${fmtShift(det.p10, 1)}, P90 ${fmtShift(det.p90, 1)}`
                          : `${row.label}, ${col.label}: ${fmtShift(v, 1)}`;
                      return (
                        <td
                          key={col.id}
                          className="px-3 py-1 text-center text-[13px] tabular-nums"
                          aria-label={bandLabel}
                          style={{
                            backgroundColor: heatFill(v, viewScale),
                            color: heatText(v),
                            fontWeight: v != null && Math.abs(v) > 0.02 ? 700 : 600,
                            fontFamily: MONO_FONT,
                            transition: 'background-color 0.25s ease, box-shadow 0.15s ease',
                            // Click affordance — the hovered % value reads as a
                            // button (drill-down opens on click via the row handler).
                            boxShadow: isCellHover && onRowClick
                              ? `inset 0 0 0 2px ${S.primary}`
                              : 'none',
                          }}
                          onMouseEnter={v != null ? (e) => onCellEnter(e, row.id, col.id, row.label, col.label) : undefined}
                          onMouseLeave={v != null ? onCellLeave : undefined}
                        >
                          {v == null ? '—' : fmtShift(v, 1)}
                        </td>
                      );
                    })}
                    {showTotalCol && (
                        <td
                          className="px-3 py-1 text-center text-[13px] tabular-nums"
                          style={{
                            backgroundColor: S.surfaceContainer,
                            color: shiftColor(rt),
                            fontWeight: 700,
                            fontFamily: MONO_FONT,
                            borderLeft: `2px solid ${S.cardBorderStrong}`,
                          }}
                          title={rt != null ? `${row.label} — row total (MC median): ${fmtShift(rt, 1)}` : undefined}
                        >
                          {rt == null ? '—' : `${shiftArrow(rt)} ${fmtShift(rt, 1)}`.trim()}
                        </td>
                    )}
                  </tr>
                  );
                })}
              </React.Fragment>
            ))}
            {showTotals && (
              <tr>
                <td
                  className="px-6 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] sticky left-0 z-10"
                  style={{
                    backgroundColor: S.surfaceContainer,
                    color: S.onSurface,
                    fontFamily: HEADLINE_FONT,
                    borderTop: `2px solid ${S.cardBorderStrong}`,
                  }}
                >
                  Total
                </td>
                {columns.map((col) => {
                  const ct = colTotals?.[col.id] ?? null;
                  return (
                    <td
                      key={col.id}
                      className="px-3 py-1.5 text-center text-[13px] tabular-nums"
                      style={{
                        backgroundColor: S.surfaceContainer,
                        color: shiftColor(ct),
                        fontWeight: 700,
                        fontFamily: MONO_FONT,
                        borderTop: `2px solid ${S.cardBorderStrong}`,
                      }}
                      title={ct != null ? `${col.label} — column total: ${fmtShift(ct, 1)}` : undefined}
                    >
                      {ct == null ? '—' : `${shiftArrow(ct)} ${fmtShift(ct, 1)}`.trim()}
                    </td>
                  );
                })}
                {showTotalCol && (
                  <td
                    className="px-3 py-1.5 text-center text-[13px] tabular-nums"
                    style={{
                      backgroundColor: S.surfaceHigh,
                      color: shiftColor(grandTotal ?? null),
                      fontWeight: 800,
                      fontFamily: MONO_FONT,
                      borderLeft: `2px solid ${S.cardBorderStrong}`,
                      borderTop: `2px solid ${S.cardBorderStrong}`,
                    }}
                    title={grandTotal != null ? `Grand total: ${fmtShift(grandTotal, 1)}` : undefined}
                  >
                    {grandTotal == null ? '—' : `${shiftArrow(grandTotal)} ${fmtShift(grandTotal, 1)}`.trim()}
                  </td>
                )}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend — short read; the full aggregation rules live in
          "About this model" below (P4 declutter, June 2026). */}
      <div
        className="rounded-b-2xl flex items-center justify-between px-6 py-4 flex-wrap gap-3"
        style={{ backgroundColor: S.surfaceLow, color: S.mutedText, fontSize: 11 }}
      >
        <span style={{ fontFamily: BODY_FONT }}>
          Signed % vs 2025 · positive = expansion · negative = contraction
          {showTotals && ' · totals are category-weighted averages (labelled, not shaded)'}
        </span>
        {/* R-06: the ramp is scaled to this view (P95 of |values|), so the
            labels state the actual scale in use — never an implied ±5%. */}
        <div className="flex items-center gap-3">
          <span title="Shading scaled to the values in this view">−{fmtPct(viewScale, 1)}</span>
          {/* L10 (July 2026 review): ramp swatches built from lib/format's
              semantic rgb channels (alphas mirror heatFill's 0.42 cap). */}
          <div className="flex h-2 rounded-full overflow-hidden" style={{ width: 120 }}>
            <div style={{ flex: 1, background: `rgba(${CONTRACTION_RGB}, 0.42)` }} />
            <div style={{ flex: 1, background: `rgba(${CONTRACTION_RGB}, 0.22)` }} />
            <div style={{ flex: 0.2, background: S.surfaceLow }} />
            <div style={{ flex: 1, background: `rgba(${EXPANSION_RGB}, 0.22)` }} />
            <div style={{ flex: 1, background: `rgba(${EXPANSION_RGB}, 0.42)` }} />
          </div>
          <span title="Shading scaled to the values in this view">+{fmtPct(viewScale, 1)}</span>
          <span style={{ fontSize: 11 }}>· shading scaled to this view</span>
        </div>
      </div>

      {/* ── Cell hover tooltip ────────────────────────────────────
          Fixed-positioned so it escapes the horizontally-scrolling
          table wrapper. Shows the MC median plus the P10 / P90
          percentile bands when `cellDetails` is supplied (Time Path
          view); decomposition lenses show just the median because
          the backend stores per-cell scalars for those views. */}
      {hover && (() => {
        const v = data[hover.rowId]?.[hover.colId];
        if (v == null) return null;
        const d = cellDetails?.[hover.rowId]?.[hover.colId] ?? null;
        const p10 = d?.p10 ?? null;
        const p90 = d?.p90 ?? null;
        const hasBands = p10 != null || p90 != null;
        return (
          <div
            className="fixed z-50 pointer-events-none rounded-xl shadow-2xl"
            style={{
              left: hover.x,
              top: hover.y - 10,
              transform: 'translate(-50%, -100%)',
              backgroundColor: S.surface,
              color: S.onSurface,
              border: `1px solid ${S.cardBorderStrong}`,
              padding: '10px 14px',
              fontFamily: BODY_FONT,
              fontSize: 12,
              minWidth: 176,
              boxShadow: '0 16px 40px -10px rgba(0, 52, 94, 0.22)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                opacity: 0.75,
                marginBottom: 6,
                fontFamily: HEADLINE_FONT,
              }}
            >
              {hover.rowLabel} · {hover.colLabel}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                columnGap: 14,
                rowGap: 2,
                alignItems: 'baseline',
              }}
            >
              <span style={{ opacity: 0.7, fontSize: 11 }}>Median</span>
              <span
                style={{
                  fontFamily: MONO_FONT,
                  fontWeight: 700,
                  textAlign: 'right',
                }}
              >
                {fmtShift(v, 1)}
              </span>
              {p10 != null && (
                <>
                  <span style={{ opacity: 0.7, fontSize: 11 }}>P10</span>
                  <span
                    style={{
                      fontFamily: MONO_FONT,
                      fontWeight: 600,
                      textAlign: 'right',
                    }}
                  >
                    {fmtShift(p10, 1)}
                  </span>
                </>
              )}
              {p90 != null && (
                <>
                  <span style={{ opacity: 0.7, fontSize: 11 }}>P90</span>
                  <span
                    style={{
                      fontFamily: MONO_FONT,
                      fontWeight: 600,
                      textAlign: 'right',
                    }}
                  >
                    {fmtShift(p90, 1)}
                  </span>
                </>
              )}
            </div>
            {hasBands && (
              <div style={{ opacity: 0.55, fontSize: 11, marginTop: 6, lineHeight: 1.4 }}>
                Band = magnitude uncertainty of the listed trends only.
              </div>
            )}
            {!hasBands && cellDetails && (
              <div style={{ opacity: 0.55, fontSize: 11, marginTop: 6 }}>
                P10 / P90 not available for this cell
              </div>
            )}
            {!cellDetails && noBandsNote && (
              <div style={{ opacity: 0.55, fontSize: 11, marginTop: 6 }}>
                {noBandsNote}
              </div>
            )}
            {onRowClick && (
              <div style={{ opacity: 0.6, fontSize: 11, marginTop: 6, fontWeight: 600 }}>
                Click → {hover.rowLabel} drill-down
              </div>
            )}
            {/* Pointer arrow — light fill + border on the two downward edges
                so it reads as one piece with the light tooltip body. */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                bottom: -6,
                width: 10,
                height: 10,
                backgroundColor: S.surface,
                borderRight: `1px solid ${S.cardBorderStrong}`,
                borderBottom: `1px solid ${S.cardBorderStrong}`,
                transform: 'translateX(-50%) rotate(45deg)',
              }}
            />
          </div>
        );
      })()}
    </div>
  );
};

// ─── Peak-Stress Tooltip ─────────────────────────────────────────
const PeakStressTooltip: FC = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center justify-center transition-all"
        style={{
          width: 28,
          height: 28,
          color: open ? S.primary : S.onSurfaceVariant,
          backgroundColor: open ? S.surfaceLow : S.surface,
          border: `1px solid ${open ? S.cardBorderStrong : S.cardBorder}`,
          borderRadius: 999,
          cursor: 'help',
          fontFamily: BODY_FONT,
        }}
        aria-label="Why aren't the worst years at the end?"
      >
        <Info size={15} strokeWidth={2.3} />
      </button>
      {open && (
        <div
          className="absolute top-full right-0 mt-2 z-20 rounded-xl p-4 shadow-lg"
          style={{
            backgroundColor: S.surface,
            border: `1px solid ${S.cardBorderStrong}`,
            boxShadow: '0 12px 40px -8px rgba(0, 52, 94, 0.22)',
            maxWidth: 360,
            fontSize: 12,
            lineHeight: 1.55,
            color: S.onSurface,
            fontFamily: BODY_FONT,
          }}
        >
          <div
            className="text-[11px] font-bold uppercase tracking-[0.12em] mb-2"
            style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}
          >
            Peak stress is not always terminal
          </div>
          <p className="mb-2">
            Each trend has its own diffusion curve (<em>s_curve, linear, front-loaded,
            back-loaded, step-function</em>) and its own peak year. The 99 v3.5 trends
            are spread across 2027–2035 peak years and five curve shapes.
          </p>
          <p className="mb-2">
            That means the category grand total can be <strong>non-monotonic</strong>:
            front-loaded consumer shifts and step-function regulation compound hardest
            mid-horizon (H1→H2), while later-maturing longevity and biotech trends
            only pick up in H3 — sometimes in the opposite direction, partially
            offsetting the stress.
          </p>
          <p className="mb-0" style={{ color: S.onSurfaceVariant }}>
            Read a cell as the <strong>cumulative level vs 2025</strong> at that
            year — the compounded impact up to that measurement point, not a
            year-over-year delta.
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────
const ProfitPoolAnalysis2: FC<{
  isAdmin?: boolean;
  /** Drill-through to the Trends tab (same contract as ConsumerJourney2):
      receives a trend NAME, applied as the Trends-tab search query. Used by
      the Category Detail Panel's contributing-trend rows. */
  onNavigateToTrend?: (query: string) => void;
}> = ({ isAdmin = false, onNavigateToTrend }) => {
  const {
    simulation, config, trends,
    loading, error, backendAvailable,
    reconnect,
  } = usePrism();

  const [view, setView] = useState<ViewMode>('time');
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>('total');
  const [selectedYear, setSelectedYear] = useState<number>(YEARS[YEARS.length - 1]!);

  // ── Drill-down state ─────────────────────────────────────────────
  // Null until the user clicks a category row or KPI tile; then the
  // Category Detail Panel slides in from the right with the full
  // percentile fan chart, force decomposition and contributing trends
  // for that one category.
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // ── Collapsible methodology footer ───────────────────────────────
  const [aboutOpen, setAboutOpen] = useState(false);

  // ─── Diagnostics — fetched only when the dashboard is empty so
  // we can show the user *why* (no rows in DB vs DB unreachable vs
  // malformed row), not a generic "No simulation persisted yet".
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null>(null);
  useEffect(() => {
    if (loading || simulation || !backendAvailable) return;
    let cancelled = false;
    void api.getDiagnostics().then((d) => { if (!cancelled) setDiagnostics(d); });
    return () => { cancelled = true; };
  }, [loading, simulation, backendAvailable]);

  // ─── Build matrix data ────────────────────────────────────────
  // rows use cat.name as the id so lookups against the backend (which keys
  // shift_matrix and category_exposure by display names like "Hair: Color")
  // just work.
  //
  // All column totals, grand totals and Time-Path per-year totals are
  // CATEGORY-WEIGHTED AVERAGES using `config.category_weights` from the
  // config page. We deliberately IGNORE `simulation.totals.by_force`,
  // `by_vc`, `by_region` and `grand` — those are raw sums written by the
  // backend and are superseded by the frontend weighted-avg computation.
  // Row totals remain the MC median per (cat, year) so they reconcile
  // cell-by-cell with the Time Path view.
  // ── Per-category expansion / contraction fractions ─────────────
  // For each category c:
  //   rawPos_c = Σ(gp1_shift × exposure/5) over trends touching c, where >0
  //   rawNeg_c = Σ(gp1_shift × exposure/5) over trends touching c, where <0
  //   rawTotal_c = rawPos_c + rawNeg_c
  //   expansionFrac_c   = rawPos_c / rawTotal_c
  //   contractionFrac_c = rawNeg_c / rawTotal_c
  // Sum to 1 by construction (when rawTotal ≠ 0). Multiplying every
  // backend cell, row total, and col total by this fraction yields
  // the expansion-only / contraction-only matrix while preserving
  // the cell-shape the backend produced. Year-independent because
  // gp1_shift × exposure scales the year-shape proportionally.
  const impactFractions = useMemo(
    () => computeImpactFractions(trends ?? [], CATEGORIES),
    [trends],
  );

  const matrixData = useMemo(() => {
    const rows = CATEGORIES.map((c) => ({
      id: c.name,                       // canonical key — drives every backend lookup
      label: categoryDisplay(c.name),   // S1: plain-English label, no brand refs
      code: categoryCode(c.name),       // S1: muted acronym chip for LHC rows
      group: groupDisplay(c.group),     // "LHC" → "Laundry & Home Care" in the section header
      fallbackId: c.id,
    }));

    // ── Category weights (source: config page) ──────────────────────
    // Keyed by display name ("Hair: Color") to match backend DEFAULT_CATEGORY_WEIGHTS
    // and the row.id we use above. Falls back to the snake_case id (e.g. "hair_color")
    // in case a future backend persists either shape, and ultimately to 1.0
    // (equal-weighted) if the config endpoint didn't return category_weights
    // at all.
    const catWeightsRaw = config?.category_weights as Record<string, number> | undefined;
    const catWeightFor = (catName: string, fallbackId: string): number =>
      resolveCatWeight(catWeightsRaw, catName, fallbackId);
    const rowWeights = rows.map((r) => catWeightFor(r.id, r.fallbackId));

    if (view === 'time') {
      const columns = YEARS.map((y) => ({ id: String(y), label: String(y) }));
      const data: Record<string, Record<string, number | null>> = {};
      // Per-cell percentile distribution for the hover tooltip — the
      // Bayesian MC shift matrix carries median + p10/p25/p75/p90 per
      // (cat, year), so we preserve the full band here. Decomposition
      // lenses (Force / VC / Region) are scalar per cell and skip this.
      const cellDetails: Record<string, Record<string, PercentileDistribution | null>> = {};
      rows.forEach((r) => {
        data[r.id] = {};
        cellDetails[r.id] = {};
        YEARS.forEach((y) => {
          const pct = getYearPercentiles(simulation?.shifts, r.id, r.fallbackId, y);
          cellDetails[r.id][String(y)] = pct;
          data[r.id][String(y)] = pct?.median ?? null;
        });
      });

      // Column totals for Time Path: per-year CATEGORY-WEIGHTED AVERAGE of
      // the MC-median category shifts. This replaces the old raw-sum behaviour
      // (`simulation.totals.grand[y]`) so the portfolio headline reflects each
      // category's configured business importance, not just its count.
      const colTotals: Record<string, number | null> = {};
      YEARS.forEach((y) => {
        const vals = rows.map((r) => data[r.id]![String(y)] ?? null);
        colTotals[String(y)] = weightedAvg(vals, rowWeights);
      });

      return {
        columns, rows, data,
        rowTotals: undefined,
        colTotals,
        grandTotal: null,
        showTotals: !!simulation?.shifts,
        // Time Path only renders column totals — per-year grand across
        // cats. A row total (sum/avg across years for one cat) isn't a
        // meaningful portfolio identity, so we keep it off.
        showRowTotals: false,
        cellDetails,
      };
    }

    // ── Force / VC / Region — read backend decomposition cells, ───────
    // compute totals as category-weighted averages in the frontend.
    const yearKey = String(selectedYear);
    const decompositions = simulation?.decompositions;
    const totals = simulation?.totals;

    const makeDecompView = (
      axisKeys: string[],
      lens: 'force' | 'vc' | 'region',
    ): { data: Record<string, Record<string, number | null>>;
         rowTotals: Record<string, number | null>;
         colTotals: Record<string, number | null>;
         grandTotal: number | null; } => {
      const data: Record<string, Record<string, number | null>> = {};
      const rowTotals: Record<string, number | null> = {};
      rows.forEach((r) => {
        data[r.id] = {};
        const cell = (decompositions?.[lens] as Record<string, Record<string, Record<string, number>>> | undefined)
          ?.[yearKey]?.[r.id] ?? {};
        axisKeys.forEach((k) => {
          const v = cell[k];
          data[r.id][k] = typeof v === 'number' ? v : null;
        });
        // Row total = MC median for (cat, year). Anchors row to the Time Path
        // cell; identical across all three lenses by construction.
        rowTotals[r.id] = totals?.category_path?.[r.id]?.[yearKey] ?? null;
      });

      // Column totals: per lens-dim, category-weighted avg of the
      // decomposition cells across all 12 categories.
      const colTotals: Record<string, number | null> = {};
      axisKeys.forEach((k) => {
        const vals = rows.map((r) => data[r.id]![k] ?? null);
        colTotals[k] = weightedAvg(vals, rowWeights);
      });

      // Grand total: category-weighted avg of the per-cat MC medians at
      // this year. Identity check — since shares sum to 1 per cat, this
      // equals Σ_d colTotals[d]. Identical across Force/VC/Region/Time
      // Path for the same year, so all four views reconcile.
      const rowTotalVals = rows.map((r) => rowTotals[r.id] ?? null);
      const grandTotal = weightedAvg(rowTotalVals, rowWeights);

      return { data, rowTotals, colTotals, grandTotal };
    };

    if (view === 'force') {
      const columns = FORCE_NAMES.map((f) => ({ id: f, label: f }));
      const { data, rowTotals, colTotals, grandTotal } = makeDecompView(
        FORCE_NAMES as unknown as string[], 'force',
      );
      return { columns, rows, data, rowTotals, colTotals, grandTotal, showTotals: !!decompositions, showRowTotals: true, cellDetails: undefined };
    }

    if (view === 'vc') {
      const columns = VC_STEPS;
      const axisKeys = VC_STEPS.map((s) => s.id);
      const { data, rowTotals, colTotals, grandTotal } = makeDecompView(
        axisKeys, 'vc',
      );
      return { columns, rows, data, rowTotals, colTotals, grandTotal, showTotals: !!decompositions, showRowTotals: true, cellDetails: undefined };
    }

    // region
    const columns = REGIONS;
    const axisKeys = REGIONS.map((r) => r.id);
    const { data, rowTotals, colTotals, grandTotal } = makeDecompView(
      axisKeys, 'region',
    );
    return { columns, rows, data, rowTotals, colTotals, grandTotal, showTotals: !!decompositions, showRowTotals: true, cellDetails: undefined };
  }, [view, simulation, selectedYear, config]);

  // ── Apply impact filter to the matrix ──────────────────────────
  // Multiplies every cell, row total, and col total by the chosen
  // category-level fraction. Total → identity (backend numbers as-is).
  // Expansion → backend × expansionFrac. Contraction → backend × contractionFrac.
  // Cell-detail percentile bands are dropped in non-Total mode because
  // they're MC artifacts of the unfiltered distribution and don't
  // translate cleanly to a sign-filtered view.
  const filteredMatrix = useMemo(() => {
    // Restricted to the Time Path lens. Force / VC / Region views
    // would require per-trend × per-axis attribution we don't have at
    // the frontend, so we deliberately bypass the filter there.
    if (impactFilter === 'total' || view !== 'time') return matrixData;
    const fracKey = impactFilter; // 'expansion' | 'contraction'
    const fracFor = (rowId: string): number => {
      const f = impactFractions[rowId];
      if (!f) return 1;
      return f[fracKey];
    };
    const scaled = (v: number | null | undefined, frac: number): number | null => {
      if (v == null || !isFinite(v)) return null;
      return v * frac;
    };

    const newData: Record<string, Record<string, number | null>> = {};
    matrixData.rows.forEach((r) => {
      const frac = fracFor(r.id);
      const rowSrc = matrixData.data[r.id] ?? {};
      newData[r.id] = {};
      Object.keys(rowSrc).forEach((k) => {
        newData[r.id][k] = scaled(rowSrc[k], frac);
      });
    });

    const newRowTotals: Record<string, number | null> | undefined =
      matrixData.rowTotals
        ? Object.fromEntries(
            matrixData.rows.map((r) => [r.id, scaled(matrixData.rowTotals![r.id], fracFor(r.id))]),
          )
        : undefined;

    // M5 (July 2026 review): this block used to RE-IMPLEMENT the weight
    // resolution rule inline — a divergent copy the single-source guard
    // couldn't see. Delegate to lib/shiftMatrix like everywhere else.
    const catWeightsRaw = config?.category_weights as Record<string, number> | undefined;
    const rowWeights = matrixData.rows.map((r) =>
      resolveCatWeight(catWeightsRaw, r.id, r.fallbackId));
    const newColTotals: Record<string, number | null> = {};
    Object.keys(matrixData.colTotals ?? {}).forEach((k) => {
      const vals = matrixData.rows.map((r) => newData[r.id]![k] ?? null);
      newColTotals[k] = weightedAvg(vals, rowWeights);
    });

    let newGrand: number | null = null;
    if (newRowTotals) {
      const vals = matrixData.rows.map((r) => newRowTotals[r.id] ?? null);
      newGrand = weightedAvg(vals, rowWeights);
    } else {
      newGrand = matrixData.grandTotal ?? null;
    }

    return {
      ...matrixData,
      data: newData,
      rowTotals: newRowTotals,
      colTotals: newColTotals,
      grandTotal: newGrand,
      cellDetails: undefined as typeof matrixData.cellDetails,
    };
  }, [matrixData, impactFilter, impactFractions, config, view]);

    // ── Category Detail Panel data ─────────────────────────────────
  // Rebuilds only when the underlying simulation / trends / selected year
  // changes. Category keys follow the display-name convention
  // ("Hair: Color") to match `simulation.shifts` and the row.id used in the
  // matrix. For the force decomposition we snapshot at `selectedYear`
  // (Time Path view defaults to the horizon end so the user sees peak
  // exposure). Contributing trends are filtered by the trend's category
  // exposure map and sorted by score magnitude inside the panel itself.
  const panelData = useMemo(() => {
    const cats = CATEGORIES.map((c) => ({ id: c.name, name: c.name, group: c.group }));
    const shifts_path: { [cat: string]: Record<string, { median?: number; p10?: number; p90?: number }> } = {};
    const force_decomposition: { [cat: string]: Record<ForceName, number> } = {};
    const contributing_trends: { [cat: string]: Trend[] } = {};
    // F1 (2.10.0): per-category regional shift at the selected year — the 3D
    // drill-down. region → {median, p10, p90}.
    const regional_shift: { [cat: string]: Record<string, { median?: number; p10?: number; p90?: number }> } = {};

    cats.forEach((c) => {
      // Regional breakdown at selectedYear from the 3D regional_shift_matrix.
      const rsmCat = simulation?.regional_shift_matrix?.[c.id];
      if (rsmCat) {
        const byRegion: Record<string, { median?: number; p10?: number; p90?: number }> = {};
        Object.entries(rsmCat).forEach(([region, cell]) => {
          const p = (cell as { path?: Record<string | number, unknown> })?.path;
          const v = p?.[selectedYear] ?? p?.[String(selectedYear)];
          if (v && typeof v === 'object') {
            const pd = v as PercentileDistribution;
            byRegion[region] = { median: pd.median, p10: pd.p10, p90: pd.p90 };
          }
        });
        if (Object.keys(byRegion).length) regional_shift[c.id] = byRegion;
      }

      // Fan-chart path: pass median + p10/p90 for every projection year.
      const raw = simulation?.shifts?.[c.id] as ShiftPath | undefined;
      if (raw) {
        const path: Record<string, { median?: number; p10?: number; p90?: number }> = {};
        YEARS.forEach((y) => {
          const v = (raw as Record<string | number, unknown>)[y]
                 ?? (raw as Record<string | number, unknown>)[String(y)];
          if (v == null) return;
          if (typeof v === 'number') {
            path[String(y)] = { median: v };
          } else {
            const pd = v as PercentileDistribution;
            path[String(y)] = { median: pd.median, p10: pd.p10, p90: pd.p90 };
          }
        });
        shifts_path[c.id] = path;
      }

      // Force decomposition at selectedYear. Falls back to horizon-end when
      // the selected year doesn't carry a block for this category.
      const yearKey = String(selectedYear);
      const forceCell = simulation?.decompositions?.force?.[yearKey]?.[c.id]
        ?? simulation?.decompositions?.force?.[String(YEARS[YEARS.length - 1])]?.[c.id];
      if (forceCell) {
        // Pad any missing force with 0 so the panel's bars render a complete set.
        const rec: Record<ForceName, number> = {
          Consumer: 0, Customer: 0, Technology: 0,
          Government: 0, Environmental: 0, Competitive: 0,
        };
        (Object.keys(forceCell) as ForceName[]).forEach((k) => {
          const val = forceCell[k];
          if (typeof val === 'number' && isFinite(val)) rec[k] = val;
        });
        force_decomposition[c.id] = rec;
      }

      // ------ Contributing trends -- Bain-grade scaled attribution ------
      // Raw per-trend contribution = gp1_shift × (exposure/5). We rescale
      // so the sum matches the MC terminal median shift for this category,
      // making each trend's contribution readable as 'pp of final shift'.
      // attribution_share = |scaled| / sum(|scaled|) across contributing
      // trends -- the denominator a Bain partner wants to see.
      const cid = CATEGORIES.find((x) => x.name === c.id)?.id ?? c.id;

      // Prefilter: trends that actually touch this category.
      const filtered = (trends ?? []).filter((t) => {
        const exposureRaw = (t.category_exposure ?? {}) as Record<string, number>;
        const exp = exposureRaw[c.id] ?? exposureRaw[cid] ?? 0;
        return exp > 0;
      });

      // Raw directional contribution per trend.
      const rawContribs = filtered.map((t) => {
        const exposureRaw = (t.category_exposure ?? {}) as Record<string, number>;
        const exp = exposureRaw[c.id] ?? exposureRaw[cid] ?? 0;
        const gp1Shift = (t as { gp1_shift?: number; normalized_score?: number }).gp1_shift
          ?? t.normalized_score
          ?? 0;
        return gp1Shift * (Math.max(0, Math.min(5, exp)) / 5);
      });
      const rawTotal = rawContribs.reduce((a, b) => a + b, 0);

      // MC terminal shift for this category (horizon end).
      const horizonEndKey = String(YEARS[YEARS.length - 1]);
      let mcTotal = 0;
      const pathPts = shifts_path[c.id];
      if (pathPts && pathPts[horizonEndKey]) {
        mcTotal = pathPts[horizonEndKey]?.median ?? 0;
      }

      const scale = (Math.abs(rawTotal) > 1e-9 && Math.abs(mcTotal) > 1e-9)
        ? mcTotal / rawTotal
        : 1;
      const scaled = rawContribs.map((v) => v * scale);
      const totalAbs = scaled.reduce((a, b) => a + Math.abs(b), 0);

      const trendsForCat = filtered.map((t, i): Trend => {
        const exposureRaw = (t.category_exposure ?? {}) as Record<string, number>;
        const exp = exposureRaw[c.id] ?? exposureRaw[cid] ?? 0;
        const contribution = scaled[i] ?? 0;
        const raw_contribution = rawContribs[i] ?? 0;
        const attribution_share = totalAbs > 1e-9 ? Math.abs(contribution) / totalAbs : 0;
        return {
          ...t,
          exposure_level: exp,
          contribution,
          raw_contribution,
          attribution_share,
        } as unknown as Trend;
      });
      if (trendsForCat.length > 0) contributing_trends[c.id] = trendsForCat;
    });

    return {
      shifts_path,
      force_decomposition,
      contributing_trends,
      regional_shift,
      region_weights: simulation?.region_weights_used,
      categories: cats,
    };
  }, [simulation, trends, selectedYear]);

  const meta = VIEW_META[view];

  // ── Headline KPIs ──────────────────────────────────────────────
  // Feeds the lean KPI strip above the matrix: portfolio-weighted shift
  // at horizon end (joint P10–P90 band on hover) plus the least- and
  // most-contracting categories with their own bands.
  const headline = useMemo(() => {
    const shifts = simulation?.shifts;
    if (!shifts) return null;
    const horizon = YEARS[YEARS.length - 1]!;
    // M5 (July 2026 review): weight resolution delegates to lib/shiftMatrix
    // (this was the third inline re-implementation in this file).
    const catWeightsRaw = config?.category_weights as Record<string, number> | undefined;
    const wFor = (name: string, id: string): number =>
      resolveCatWeight(catWeightsRaw, name, id);
    const meds: Array<number | null> = [];
    const p10s: Array<number | null> = [];
    const p90s: Array<number | null> = [];
    const ws: number[] = [];
    const catVals: Array<{ name: string; v: number; p10: number | null; p90: number | null }> = [];
    CATEGORIES.forEach((c) => {
      const pct = getYearPercentiles(shifts, c.name, c.id, horizon);
      const m = pct?.median ?? null;
      meds.push(m);
      p10s.push(pct?.p10 ?? null);
      p90s.push(pct?.p90 ?? null);
      ws.push(wFor(c.name, c.id));
      if (m != null && isFinite(m)) {
        catVals.push({ name: c.name, v: m, p10: pct?.p10 ?? null, p90: pct?.p90 ?? null });
      }
    });
    const med = weightedAvg(meds, ws);
    if (med == null) return null;
    const maxCat = catVals.length ? catVals.reduce((a, b) => (b.v > a.v ? b : a)) : null;
    const minCat = catVals.length ? catVals.reduce((a, b) => (b.v < a.v ? b : a)) : null;

    // D3 / audit F-16 (June 2026): prefer the TRUE joint portfolio band the
    // engine computes per-iteration from raw samples (totals.portfolio,
    // 2.8.0+ runs). The category-weighted average of per-category bands is
    // narrower than the truth by construction and remains only as the
    // fallback for pre-2.8.0 persisted runs — labeled as such.
    const port = simulation?.totals?.portfolio?.[String(horizon)]
      ?? simulation?.totals?.portfolio?.[horizon as unknown as string];
    if (port && typeof port === 'object' && port.p10 != null && port.p90 != null) {
      return {
        horizon,
        med: port.median ?? med,
        p10: port.p10, p90: port.p90,
        joint: true as const,
        maxCat, minCat,
      };
    }
    return { horizon, med, p10: weightedAvg(p10s, ws), p90: weightedAvg(p90s, ws), joint: false as const, maxCat, minCat };
  }, [simulation, config]);

  // ─── Empty / error banners ────────────────────────────────────
  const showBackendOffline = !loading && !backendAvailable;
  const needsSimulation = !simulation;
  const decompositionsMissing = view !== 'time' && simulation != null
    && simulation.decompositions == null;

  // ─── Matrix toolbar — Compact Command Bar (P1 restructure, July 2026) ──
  // Every control that manipulates the matrix lives ON the matrix card, but
  // the row's three jobs now speak three distinct vocabularies so they never
  // blur into one strip of look-alike pills:
  //   • LEFT  — the view lens as a connected segmented control.
  //   • RIGHT — a labelled contextual control: on Time Path a small segmented
  //     impact toggle ("Show"); on the attribution lenses a compact year
  //     stepper ("Year"), retiring the old ten-pill overflow.
  //   • END   — the peak-stress explainer, demoted to an info icon so a help
  //     affordance no longer mimics a selected filter.
  // The impact-filter / year semantics stay captioned in the subtitle strip
  // directly below, so no floating description rows are needed.
  const matrixToolbar = (
    <>
      <SegControl
        ariaLabel="Matrix view lens"
        items={(Object.keys(VIEW_META) as ViewMode[]).map((v) => ({
          id: v,
          label: VIEW_META[v].label,
          Icon: VIEW_META[v].Icon,
        }))}
        activeId={view}
        onSelect={(id) => setView(id as ViewMode)}
      />
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span
          style={{
            fontFamily: HEADLINE_FONT,
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: S.mutedText,
          }}
        >
          {view === 'time' ? 'Show' : 'Year'}
        </span>
        {view === 'time' ? (
          <SegControl
            size="sm"
            ariaLabel="Trend-impact filter"
            items={(Object.keys(IMPACT_META) as ImpactFilter[]).map((f) => ({
              id: f,
              label: IMPACT_META[f].label,
              Icon: IMPACT_META[f].Icon,
            }))}
            activeId={impactFilter}
            onSelect={(id) => setImpactFilter(id as ImpactFilter)}
          />
        ) : (
          <YearStepper year={selectedYear} onChange={setSelectedYear} />
        )}
        <PeakStressTooltip />
      </div>
    </>
  );

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: S.bg, color: S.onBg, fontFamily: BODY_FONT }}
    >
      {/* U6 (June 2026) / L18 (July 2026): visible keyboard focus on the
          matrix drill-down buttons and KPI tiles, so the drill-down is
          reachable without a mouse. (The focus target moved from the old
          `tr[role="button"]` — which broke table semantics — to a real
          button inside the row's first cell.) */}
      <style>{`
        .ppa2-row-open:focus-visible { outline: 2px solid ${S.primary}; outline-offset: 2px; border-radius: 4px; }
        .ppa2-row-open:focus:not(:focus-visible) { outline: none; }
      `}</style>
      <main className="max-w-[1440px] mx-auto px-8 py-10">

        {/* ── Error / offline banners ──────────────────────────── */}
        <AnimatePresence>
          {showBackendOffline && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6 flex items-center justify-between gap-4 px-5 py-4 rounded-2xl"
              style={{ backgroundColor: S.errorContainer, color: S.onErrorContainer }}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle size={18} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  Backend unavailable. The matrix is empty until the simulation engine reconnects.
                </span>
              </div>
              <button
                type="button"
                onClick={() => { void reconnect(); }}
                className="px-4 py-1.5 rounded-full text-[12px] font-semibold"
                style={{ backgroundColor: S.onErrorContainer, color: S.errorContainer, border: 'none', cursor: 'pointer' }}
              >
                Reconnect
              </button>
            </motion.div>
          )}
          {error && backendAvailable && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6 px-5 py-4 rounded-2xl"
              style={{ backgroundColor: S.errorContainer, color: S.onErrorContainer, fontSize: 13, fontWeight: 600 }}
            >
              {error}
            </motion.div>
          )}
          {decompositionsMissing && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6 px-5 py-4 rounded-2xl flex items-center gap-3"
              style={{ backgroundColor: S.surfaceContainer, color: S.onSurfaceVariant, fontSize: 13 }}
            >
              <AlertTriangle size={16} style={{ color: S.primary }} />
              <span>
                {isAdmin ? (
                  <>This simulation was generated before the v2.5 engine update and doesn&apos;t
                  carry the per-year Force / VC / Region decomposition blocks yet. Re-run the
                  simulation to populate these lenses.</>
                ) : (
                  <>This run doesn&apos;t include the Force / Value Chain / Region breakdowns
                  yet — they&apos;ll appear with the next published simulation run.</>
                )}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── The evidence: the shift matrix ─────────────────────── */}
        {/* R-13: page title is an h1 (matches Trends / Journey / Explorer). */}
        <div className="mb-5 pl-5" style={{ borderLeft: `4px solid ${S.primary}` }}>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] mb-2"
            style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>
            Profit Pool Shift Analysis
          </div>
          <h1 className="font-extrabold tracking-tight"
            style={{ fontFamily: HEADLINE_FONT, color: S.onBg, fontSize: '2.4rem', lineHeight: 1.15 }}>
            Where Profit Pools Shift
          </h1>
          {/* Reduced header (owner request, June 2026): the relative-exposure /
              ceteris-paribus framing is carried once here; the full D16 wording
              still lives in "About this model" below. */}
          <p className="mt-1.5 max-w-3xl text-[13.5px]" style={{ color: S.onSurfaceVariant, lineHeight: 1.55 }}>
            Relative exposure if no one acts — not a forecast. Four lenses, one set of totals;{' '}
            <span style={{ fontWeight: 600, color: S.onSurface }}>click any value to drill in.</span>
          </p>
        </div>

        {/* ── KPI strip — the three headline numbers (June 2026 declutter,
            replaces the hero block). P10–P90 bands appear on hover only;
            the portfolio band is the engine's joint percentile (2.8.0+),
            falling back labeled for pre-2.8 runs (D3/F-16). */}
        {headline && (
          <div
            className="mb-5 grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}
          >
            <KpiTile
              label={`Portfolio exposure (if no action) · by ${headline.horizon}`}
              value={headline.med}
              p10={headline.p10}
              p90={headline.p90}
              bandNote={headline.joint
                ? '80% of outcomes (joint portfolio)'
                : 'cat-weighted (pre-2.8 run)'}
            />
            {headline.maxCat && (
              <KpiTile
                label="Most resilient category"
                name={categoryDisplay(headline.maxCat.name)}
                value={headline.maxCat.v}
                p10={headline.maxCat.p10}
                p90={headline.maxCat.p90}
                bandNote="80% of outcomes"
                onOpen={() => setSelectedCategoryId(headline.maxCat!.name)}
              />
            )}
            {headline.minCat && (
              <KpiTile
                label="Most exposed category"
                name={categoryDisplay(headline.minCat.name)}
                value={headline.minCat.v}
                p10={headline.minCat.p10}
                p90={headline.minCat.p90}
                bandNote="80% of outcomes"
                onOpen={() => setSelectedCategoryId(headline.minCat!.name)}
              />
            )}
          </div>
        )}

        {/* ── Matrix ──────────────────────────────────────────── */}
        <motion.section
          key={view + ':' + selectedYear}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {loading ? (
            <div
              className="flex items-center justify-center py-24 rounded-2xl"
              style={{ backgroundColor: S.surface, color: S.mutedText }}
            >
              <Loader2 size={20} className="animate-spin" style={{ color: S.primary }} />
              <span className="ml-3 text-[14px]">Loading shift matrix…</span>
            </div>
          ) : needsSimulation ? (
            (() => {
              // Differentiated empty state driven by /api/v1/diagnostics.
              // Three real failure modes require three different user actions:
              //   db_error   → Ops fix (POSTGRES_URL in Vercel env)
              //   malformed  → Re-run on v2.5+ engine
              //   no_rows    → Run the CLI
              const reason = diagnostics?.simulation_reason;
              const isDbError = reason === 'db_error';
              const isMalformed = reason === 'malformed';

              const EmptyIcon = isDbError || isMalformed ? AlertTriangle : Info;
              const iconBg = isDbError || isMalformed ? S.errorContainer ?? S.primaryContainer : S.primaryContainer;
              const iconFg = isDbError || isMalformed ? S.error ?? S.primary : S.primary;

              // Viewers get plain-language titles; operational phrasing is
              // reserved for admins, who can act on it.
              const title = !isAdmin
                ? (isDbError
                  ? 'Data connection issue'
                  : isMalformed
                  ? 'Latest run needs a refresh'
                  : 'No simulation available yet')
                : isDbError
                ? 'Backend cannot reach the database'
                : isMalformed
                ? 'Latest run has incompatible shape'
                : 'No simulation persisted yet';

              return (
                <div
                  className="flex flex-col items-center justify-center py-20 px-8 text-center rounded-2xl"
                  style={{ backgroundColor: S.surface, boxShadow: '0 4px 60px -15px rgba(0, 52, 94, 0.08)' }}
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: iconBg, color: iconFg }}
                  >
                    <EmptyIcon size={22} />
                  </div>
                  <h3
                    className="text-[20px] font-extrabold mb-2"
                    style={{ fontFamily: HEADLINE_FONT, color: S.onSurface }}
                  >
                    {title}
                  </h3>
                  <div
                    className="max-w-xl text-[14px] space-y-3"
                    style={{ color: S.onSurfaceVariant, lineHeight: 1.5 }}
                  >
                    {!isAdmin ? (
                      <p>
                        {reason === 'no_rows' || reason == null
                          ? 'No simulation run has been published yet. Results appear here automatically as soon as the PRISM team publishes the first run.'
                          : 'The simulation engine isn\u2019t serving results right now. Please check back shortly — if this persists, contact the PRISM team (Alexander Laker).'}
                      </p>
                    ) : isDbError ? (
                      <>
                        <p>
                          The FastAPI backend is running but cannot query the Neon
                          database. This is almost always a Vercel environment
                          issue — check that <code style={{ fontFamily: 'monospace', fontSize: '0.92em' }}>POSTGRES_URL</code> (or
                          {' '}<code style={{ fontFamily: 'monospace', fontSize: '0.92em' }}>DATABASE_URL</code>)
                          in the Vercel dashboard points to the same Neon branch
                          you persist to from the CLI.
                        </p>
                        {diagnostics?.error && (
                          <p style={{ fontFamily: 'monospace', fontSize: '12px', color: S.error ?? S.onSurfaceVariant }}>
                            {diagnostics.error}
                          </p>
                        )}
                        <p className="text-[12px]" style={{ color: S.onSurfaceVariant }}>
                          Run <code style={{ fontFamily: 'monospace' }}>python3 scripts/diagnose_prism.py</code> locally
                          for a full read-out of which env var and host are in use on each side.
                        </p>
                      </>
                    ) : isMalformed ? (
                      <>
                        <p>
                          Run{' '}
                          <strong style={{ color: S.onSurface }}>
                            #{diagnostics?.latest_run_id ?? '—'}
                          </strong>{' '}
                          exists in the database but is missing one of the required
                          blocks ({' '}
                          <code style={{ fontFamily: 'monospace', fontSize: '0.92em' }}>shift_matrix</code>,{' '}
                          <code style={{ fontFamily: 'monospace', fontSize: '0.92em' }}>decompositions</code>,{' '}
                          <code style={{ fontFamily: 'monospace', fontSize: '0.92em' }}>totals</code>
                          ). It was likely persisted by an older engine version.
                        </p>
                        <p>
                          Re-run <code style={{ fontFamily: 'monospace', fontSize: '0.92em' }}>python3 scripts/run_50k_prod.py</code>{' '}
                          on the v2.5+ engine — the new runner verifies the
                          persisted row has the full bundle before exiting
                          successfully.
                        </p>
                      </>
                    ) : (
                      <>
                        <p>
                          Simulations are triggered from the CLI
                          (<code style={{ fontFamily: 'monospace', fontSize: '0.92em' }}>scripts/run_50k_prod.py</code>).
                          Once a run has been persisted to Neon, all four lenses
                          — Time Path, Force, Value Chain and Region — will
                          populate here automatically.
                        </p>
                        {diagnostics?.db_host && (
                          <p className="text-[12px]" style={{ color: S.onSurfaceVariant }}>
                            Connected to{' '}
                            <code style={{ fontFamily: 'monospace' }}>{diagnostics.db_host}</code>
                            {' · '}
                            <strong>{diagnostics.simulation_run_count ?? 0}</strong>{' '}
                            runs in this database.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })()
          ) : (
            <Matrix
              toolbar={matrixToolbar}
              columns={filteredMatrix.columns}
              rows={filteredMatrix.rows}
              data={filteredMatrix.data}
              subtitle={
                view === 'time'
                  ? (impactFilter !== 'total'
                      ? `${meta.label} · ${IMPACT_META[impactFilter].label} — ${IMPACT_META[impactFilter].description}`
                      : `${meta.label} · ${meta.description}`)
                  : `${meta.label} · ${selectedYear} · ${meta.description}`
              }
              emptyMessage={
                view === 'time'
                  ? 'Simulation result contains no shift data for these years.'
                  : isAdmin
                  ? 'No decomposition data for this year. Re-run the simulation on the v2.5+ engine.'
                  : 'No breakdown data for this year yet — it will appear with the next published run.'
              }
              rowTotals={filteredMatrix.showRowTotals ? filteredMatrix.rowTotals : undefined}
              colTotals={filteredMatrix.colTotals}
              grandTotal={filteredMatrix.grandTotal}
              showTotals={filteredMatrix.showTotals}
              rowTotalLabel={view === 'time' ? 'Total' : `Total ${selectedYear}`}
              cellDetails={filteredMatrix.cellDetails}
              onRowClick={setSelectedCategoryId}
              noBandsNote={
                view !== 'time'
                  ? 'Switch to Time Path for P10 / P90 bands'
                  : impactFilter !== 'total'
                  ? 'Ranges unavailable in Upside/Downside view — bands describe the unfiltered distribution'
                  : undefined
              }
            />
          )}
        </motion.section>

        {/* ── Category Detail Panel (drill-down) ────────────────────
            Slides in from the right when a category row is clicked.
            Shows fan chart, force decomposition, and contributing
            trends for the single selected category. */}
        <AnimatePresence>
          {selectedCategoryId && (
            <CategoryDetailPanel
              data={panelData}
              categoryId={selectedCategoryId}
              onClose={() => setSelectedCategoryId(null)}
              onOpenTrend={onNavigateToTrend}
            />
          )}
        </AnimatePresence>

        {/* ── About this model — collapsible methodology + glossary +
            run provenance (run #, seed, integrity — moved here from the
            page header, June 2026 declutter) ── */}
        <footer className="mt-8">
          <button type="button" onClick={() => setAboutOpen((v) => !v)} aria-expanded={aboutOpen}
            className="w-full flex items-center justify-between gap-4 px-5 py-3.5 rounded-2xl text-left"
            style={{ backgroundColor: S.surface, border: `1px solid ${S.cardBorder}`, cursor: 'pointer' }}>
            <span className="flex items-center gap-3">
              <Info size={14} style={{ color: S.primary }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: S.onSurface, fontFamily: HEADLINE_FONT }}>About this model</span>
              <span className="hidden sm:inline" style={{ fontSize: 12, color: S.mutedText }}>
                Bayesian Monte Carlo · 50,000 iterations · 99 trends · run details &amp; methodology
              </span>
            </span>
            <span className="flex items-center gap-3">
              {simulation?.run_meta?.run_id != null ? (
                <span className="hidden sm:inline" style={{ fontSize: 12, color: S.mutedText }}>
                  Run #{simulation.run_meta.run_id}
                  {simulation.run_meta.run_date
                    ? ` · ${fmtDate(simulation.run_meta.run_date)}`
                    : ''}
                </span>
              ) : simulation?.generated ? (
                <span className="hidden sm:inline" style={{ fontSize: 12, color: S.mutedText }}>
                  Last run · {fmtDate(simulation.generated)}
                </span>
              ) : null}
              <ChevronDown size={16} style={{ color: S.onSurfaceVariant,
                transform: aboutOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
            </span>
          </button>
          {aboutOpen && (
            <div className="mt-2 px-5 py-5 rounded-2xl" style={{ backgroundColor: S.surface, border: `1px solid ${S.cardBorder}` }}>
              {/* ── This run — provenance + audit metadata + integrity events.
                  Flat layout replaces the old header ribbon's popovers
                  (RunDetailsPopover / IntegrityChip). M2 (owner re-ruling
                  2026-07-06 of T18): seed stability is BACK — the spread of
                  the terminal-year portfolio median across independently-
                  seeded chains; honest framing: it measures MC sampling
                  noise only (≈0 pp expected at 50k × 3). D13: numerics
                  backend on the audit trail. D19: integrity events surfaced
                  with the run. */}
              {simulation?.run_meta?.run_id != null && (() => {
                const m = simulation.run_meta;
                const events = simulation.integrity_events ?? [];
                const ss = simulation.seed_stability;
                const rows: Array<[string, string]> = [];
                if (m.iterations != null) {
                  rows.push(['Iterations', `${(m.iterations / 1000).toFixed(0)}k${m.chains != null ? ` × ${m.chains} chains` : ''}`]);
                }
                if (m.seed != null) rows.push(['Seed', String(m.seed)]);
                rows.push(['Seed stability', ss
                  ? `±${ss.spread_pp.toFixed(2)} pp across ${ss.n_chains} seeds (${ss.terminal_year} portfolio median)`
                  : 'not recorded (pre-2.8.1 run)']);
                if (m.numerics_backend) rows.push(['Numerics', m.numerics_backend]);
                // 2.9.0: VC-lens basis. Epicentre partition on 2.9+ runs;
                // older persisted runs used profile×weight shares and are
                // labeled honestly until the next CLI run replaces them.
                rows.push(['VC attribution', m.vc_attribution_basis === 'epicentre'
                  ? 'epicentre partition'
                  : 'profile-weighted (pre-2.9 run)']);
                // F1 (2.10.0): the region GP1-share weights used in the roll-up.
                if (m.region_weights_used) {
                  rows.push(['Region weights', Object.entries(m.region_weights_used)
                    .map(([r, w]) => `${r} ${(Number(w) * 100).toFixed(0)}%`).join(' · ')]);
                }
                if (m.git_sha && m.git_sha !== 'unknown') rows.push(['Engine build', m.git_sha]);
                if (m.model_version) rows.push(['Model', m.model_version]);
                return (
                  <div className="mb-5 pb-5" style={{ borderBottom: `1px solid ${S.cardBorder}` }}>
                    <div className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2"
                      style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>This run</div>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                        style={{ backgroundColor: S.surfaceContainer, color: S.onPrimaryContainer,
                          fontSize: 11, fontWeight: 600, letterSpacing: '0.04em' }}>
                        <Database size={12} />
                        <span>Run #{m.run_id}</span>
                        {m.scenario && <span style={{ opacity: 0.75 }}>· {m.scenario}</span>}
                      </span>
                      <span style={{ color: S.mutedText, fontSize: 11.5 }}>
                        {m.run_date
                          ? fmtDateTime(m.run_date)
                          : simulation.generated
                          ? fmtDateTime(simulation.generated)
                          : '—'}
                      </span>
                    </div>
                    {rows.length > 0 && (
                      <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                        {rows.map(([k, v]) => (
                          <span key={k} className="inline-flex items-baseline gap-2">
                            <span style={{ fontSize: 11.5, color: S.mutedText }}>{k}</span>
                            <span style={{ fontSize: 11.5, fontWeight: 600, color: S.onSurface,
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{v}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {events.length > 0 && (
                      <div className="mt-3">
                        <div className="text-[11px] font-bold uppercase tracking-[0.14em] mb-1.5"
                          style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>
                          Run integrity · {events.length} {events.length === 1 ? 'event' : 'events'}
                        </div>
                        <ul style={{ display: 'grid', rowGap: 6, margin: 0, padding: 0, listStyle: 'none' }}>
                          {events.map((e, i) => (
                            <li key={`${e.type}-${i}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                              <span style={{ marginTop: 4, width: 6, height: 6, flexShrink: 0, borderRadius: 9999,
                                backgroundColor: e.severity === 'warning' || e.severity === 'error' ? '#D97706' : S.primary }} />
                              <span style={{ fontSize: 11.5, lineHeight: 1.5, color: S.onSurface }}>{e.message}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] mb-3"
                style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>Glossary</div>
              <div className="grid gap-2 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              <div className="rounded-xl px-4 py-3" style={{ backgroundColor: S.surfaceLow }}>
                <div className="text-[11px] font-bold mb-1" style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}>GP1</div>
                <div className="text-[11.5px]" style={{ color: S.onSurfaceVariant, lineHeight: 1.5 }}>Gross Profit 1 (contribution after cost of goods) — the profit layer whose shifts the model projects.</div>
              </div>
              <div className="rounded-xl px-4 py-3" style={{ backgroundColor: S.surfaceLow }}>
                <div className="text-[11px] font-bold mb-1" style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}>MC median</div>
                <div className="text-[11.5px]" style={{ color: S.onSurfaceVariant, lineHeight: 1.5 }}>The middle outcome of the 50,000 Monte Carlo paths — the central estimate shown in every cell.</div>
              </div>
              <div className="rounded-xl px-4 py-3" style={{ backgroundColor: S.surfaceLow }}>
                <div className="text-[11px] font-bold mb-1" style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}>P10 / P90</div>
                <div className="text-[11.5px]" style={{ color: S.onSurfaceVariant, lineHeight: 1.5 }}>The range covering 80% of simulated outcomes: 10% of runs land below P10, 10% above P90.</div>
              </div>
              <div className="rounded-xl px-4 py-3" style={{ backgroundColor: S.surfaceLow }}>
                <div className="text-[11px] font-bold mb-1" style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}>Category codes</div>
                <div className="text-[11.5px]" style={{ color: S.onSurfaceVariant, lineHeight: 1.5 }}>LHC = Laundry &amp; Home Care. FCN Fabric Clean · FCA Fabric Care · FFI Fabric Finishers · LAD Laundry Additives · HDW Hand Dishwash · ADW Auto Dishwash · HSC Hard-Surface Cleaner · IC Insect Control.</div>
              </div>
              <div className="rounded-xl px-4 py-3" style={{ backgroundColor: S.surfaceLow }}>
                <div className="text-[11px] font-bold mb-1" style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}>Attenuation</div>
                <div className="text-[11.5px]" style={{ color: S.onSurfaceVariant, lineHeight: 1.5 }}>Dampening factor applied to overlapping trends so co-occurring effects are not double-counted.</div>
              </div>
              <div className="rounded-xl px-4 py-3" style={{ backgroundColor: S.surfaceLow }}>
                <div className="text-[11px] font-bold mb-1" style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}>Cumulative shift</div>
                <div className="text-[11.5px]" style={{ color: S.onSurfaceVariant, lineHeight: 1.5 }}>Each cell is the compounded level vs 2025 at that year — not a year-over-year change.</div>
              </div>
              </div>
              {/* F1 (2.10.0): the structural scale chain — put the level's
                  provenance on the record so a reader who compares a cell
                  against intuition about a single trend understands the ~13×
                  gap (audit F1). */}
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2"
                style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>Reading the level</div>
              <p className="text-[12px] mb-2" style={{ color: S.mutedText, lineHeight: 1.6, fontFamily: BODY_FONT }}>
                Each trend&rsquo;s elicited &ldquo;share of GP1 it could touch&rdquo; is deliberately
                scaled down before it reaches a category: a trend belongs to 1 of 6 forces
                (&divide;6 averaging) and each force is attenuated (~0.4&ndash;0.5) so overlapping
                trends aren&rsquo;t double-counted. Net <strong>structural pass-through &asymp; 7%</strong>.
                So a near-certain trend that could touch 20% of a category&rsquo;s GP1 moves that
                category <strong>&asymp;1.4%</strong> at full materialization &mdash; not 20%. Read cells as a
                conservative, comparable index and apply them with the formula
                (GP1<sub>projected</sub> = GP1<sub>actual</sub> &times; (1 + shift)); don&rsquo;t read one cell
                as the raw elicited magnitude. The impact is applied per <strong>category &times; region</strong>:
                a trend only moves the categories and regions it is scored on, and the category
                number is the region-GP1-weighted roll-up (weights above).
              </p>
              <div className="rounded-xl px-4 py-3 mb-5" style={{ backgroundColor: S.surfaceLow }}>
                <div className="text-[11px] font-bold mb-1.5" style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}>
                  Structural pass-through per force <span style={{ fontWeight: 400, color: S.mutedText }}>(force weight 1/6 &times; attenuation; before probability, materialization, exposure &amp; overlap)</span>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                  {[['Consumer','8.3%'],['Competitive','8.0%'],['Technology','7.2%'],['Environmental','7.0%'],['Government','6.9%'],['Customer','6.7%']].map(([f,v]) => (
                    <span key={f} className="inline-flex items-baseline gap-1.5">
                      <span style={{ fontSize: 11.5, color: S.onSurfaceVariant }}>{f}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: S.onSurface, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{v}</span>
                    </span>
                  ))}
                </div>
                <div className="text-[11px] mt-1.5" style={{ color: S.mutedText, lineHeight: 1.5 }}>
                  Shown at default attenuation (admin-editable in the Config sheet). Timing: P10&ndash;P90 bands are magnitude uncertainty from the Monte&nbsp;Carlo (fixed Beta concentration); per-iteration peak-year jitter (&plusmn;1yr) gives velocity bands their timing spread. Confidence is AI-scored display metadata &mdash; it does not drive the bands.
                </div>
              </div>
              {/* F5 (2.10.0): publish what a 1–5 probability score means as a
                  Beta prior — the scale deliberately shrinks against
                  overconfidence (a "5" ≈ five-in-six, not certainty). */}
              <div className="rounded-xl px-4 py-3 mb-5" style={{ backgroundColor: S.surfaceLow }}>
                <div className="text-[11px] font-bold mb-1.5" style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}>
                  What a probability score means <span style={{ fontWeight: 400, color: S.mutedText }}>(1&ndash;5 &rarr; Beta prior; the sole stochastic driver)</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="text-[11.5px]" style={{ borderCollapse: 'collapse', fontFamily: MONO_FONT, minWidth: 300 }}>
                    <thead>
                      <tr style={{ color: S.mutedText }}>
                        {['Score', 'Beta(α,β)', 'Mean', 'P10', 'P90'].map((h) => (
                          <th key={h} style={{ textAlign: 'right', padding: '2px 10px 4px', fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody style={{ color: S.onSurface }}>
                      {[['1','(1,5)','0.167','0.021','0.369'],['2','(2,4)','0.333','0.112','0.584'],['3','(3,3)','0.500','0.247','0.753'],['4','(4,2)','0.667','0.416','0.888'],['5','(5,1)','0.833','0.631','0.979']].map((row) => (
                        <tr key={row[0]}>
                          {row.map((v, i) => (
                            <td key={i} style={{ textAlign: 'right', padding: '2px 10px' }}>{v}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-[11px] mt-1.5" style={{ color: S.mutedText, lineHeight: 1.5 }}>
                  The scale never reaches 0 or 1 &mdash; a deliberate shrinkage against overconfidence (a &ldquo;5&rdquo; materialises at mean 0.83, not certainty). The band width comes from the fixed Beta concentration (&alpha;+&beta;=6).
                </div>
              </div>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2"
                style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>What the model holds constant</div>
              {/* D16 (owner decision, June 2026) — exact owner wording. */}
              <p className="text-[12px] mb-4" style={{ color: S.mutedText, lineHeight: 1.6, fontFamily: BODY_FONT }}>
                PRISM holds strategy constant. The simulation propagates external trends only and
                deliberately excludes management response — price increases, innovation launches,
                mix shifts, competitive reaction. A negative total therefore means &ldquo;headwind to
                today&rsquo;s business if nothing changes&rdquo;, not &ldquo;this pool will shrink&rdquo;.
                Strategic response belongs to the reader, not the engine.
              </p>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2"
                style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>Methodology</div>
              {/* U10 (June 2026): a three-line plain read precedes the full
                  technical prose so the curious reader gets the gist first. */}
              <ul className="text-[12px] mb-3" style={{ color: S.onSurfaceVariant, lineHeight: 1.55, fontFamily: BODY_FONT, margin: '0 0 12px', paddingLeft: 18 }}>
                <li style={{ marginBottom: 3 }}>Each cell is the cumulative % shift vs 2025 at that year — a compounded level, not a year-over-year change.</li>
                <li style={{ marginBottom: 3 }}>Totals are category-weighted averages (not sums), so the portfolio number reads as one interpretable shift.</li>
                <li>The model holds Henkel and competitor strategy constant — it propagates external trends only.</li>
              </ul>
              <p className="text-[12px]" style={{ color: S.mutedText, lineHeight: 1.6, fontFamily: BODY_FONT }}>
                          <span style={{ fontWeight: 600, color: S.onSurfaceVariant }}>Methodology:</span>{' '}
          All cell values in this matrix are produced by the Bayesian Monte Carlo engine
          (<code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{simulation?.model_version ?? 'bayesian_copula'}</code>,
          50,000 iterations, Gaussian-copula dependencies, 99 v3.5 trends). The trend
          probability priors are <strong>structured expert judgement</strong> (Beta shapes set
          from analyst 1–5 scores); the model expresses uncertainty in those judgements — it
          does not learn or update from data. Each cell is a{' '}
          <strong>cumulative shift level vs 2025</strong> at that measurement year — i.e. the
          compounded impact from {YEARS[0]} up to that year, not a year-over-year delta.
          The Force, Value Chain and Region lenses are per-year decompositions written by
          the engine. <strong>Since 2.10.0 (F1) region also enters the shift math itself</strong>:
          the engine solves a 3D category × region × year tensor (each trend weighted by
          category exposure × regional exposure) and rolls the regional shifts up to the
          category level by each region&rsquo;s GP1 share (the Region-weights above) — so a
          regionally-concentrated trend only moves its regions&rsquo; slice of the pool. The
          Region lens is therefore now shift-based, not attribution-only; the full 3D detail
          is available in the region drill-down. The Force and Region shares use the trend
          0–5 ratings (category, force/region exposure) and the Config-sheet dimension weights; the{' '}
          <strong>Value Chain lens is a categorical epicentre partition</strong> (2.9.0) —
          each trend's contribution is assigned wholly to the single stage where experts
          located its impact epicentre, with no per-step weights and no modelled
          propagation up or down the chain (holding responses constant, propagation would
          be a management/market story, not a trend property). Every row total equals the
          MC median shift for that (category, year)
          and is therefore identical across all four lenses. <strong>Column and grand totals
          are category-weighted averages</strong> of the per-category values, using the
          admin-editable category business-importance weights from the Config sheet —
          so totals reflect the portfolio mix rather than simple sums of 12 categories.
          Because the decomposition shares sum to 1 per category, the grand total for any
          given year is identical across Time Path, Force, Value Chain and Region views.
          No frontend calibration or anchoring of cells — only the portfolio-weighted
          aggregation is computed client-side from the Config weights.
              </p>
            </div>
          )}
        </footer>
      </main>
    </div>
  );
};

export default ProfitPoolAnalysis2;
