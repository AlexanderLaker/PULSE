/**
 * Shift Analysis: the Shift Matrix of the served run, read through four
 * lenses.
 *
 *   Time Path     category x year: the Monte Carlo median shift
 *   Force         category x the six forces, at a selected year
 *   Value chain   category x the eight value-chain stages, at a selected year
 *   Region        category x the four regions, at a selected year
 *
 * The engine writes the lens decompositions (simulation.decompositions). Each
 * splits a category's median shift in a year across its dimension, so every
 * lens row adds up to the Time Path cell and the four lenses reconcile cell by
 * cell.
 *
 * The totals are computed here as category-weighted averages with the run's
 * own category shares (category_weights_used, the row sums of the cell
 * weights the run rolled up with), never as sums:
 *
 *   grand[y]         = sum_c w[c] x median[c][y]    / sum_c w[c]
 *   col_total[d][y]  = sum_c w[c] x decomp[c][d][y] / sum_c w[c]
 *   row_total[c][y]  = median[c][y]                 (the Time Path cell)
 *
 * Each category's lens shares add up to 1, so the column totals add up to the
 * grand total and all four lenses show the same grand total in a year. Rows
 * carry no weights of their own: a row total is the one number the simulation
 * produces per (category, year), and the force and cell weights already shape
 * how a row is split. The run's totals.by_force, by_vc and by_region are plain
 * sums over the categories and are not shown.
 *
 * Above the matrix a KPI strip shows the portfolio band and the most resilient
 * and most exposed categories; a row or a category tile opens the drill-down
 * (CategoryDetailPanel). Without a run the page says why, from the service's
 * own diagnosis. The "About this model" footer carries the run's provenance
 * and the method.
 */

'use client';

import React, { useEffect, useMemo, useState, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Layers, Globe2, Zap, Loader2, AlertTriangle,
  Info, Database, ChevronDown, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, Activity,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import { getDiagnostics } from '@/api/client';
import {
  CATEGORIES, FORCES, NO_VALUE, REGIONS, YEARS, fmtShift, fmtPct, shiftArrow, shiftColor,
  heatFill, heatText, heatScaleFor, fmtDate, fmtDateTime,
  categoryDisplay, groupDisplay,
  EXPANSION_RGB, CONTRACTION_RGB,
} from '@/lib/format';
import { S, HEADLINE_FONT, BODY_FONT, MONO_FONT } from '@/lib/theme';
import { cellMarginals } from '@/lib/cellWeights';
import { VC_STEPS } from '@/lib/valueChain';
import { categoryShares, computeImpactFractions, getYearPercentiles, weightedAvg } from '@/lib/shiftMatrix';
import ShiftValue from '@/components/dashboard/ShiftValue';
import CategoryDetailPanel from '@/components/dashboard/CategoryDetailPanel';
import type {
  DiagnosticsResult, ForceName, ModelConfig, PercentileDistribution, SimulationResult,
} from '@/types';

// ─── Lenses ──────────────────────────────────────────────────────────────

type ViewMode = 'time' | 'force' | 'vc' | 'region';
type Lens = Exclude<ViewMode, 'time'>;

const VIEW_META: Record<ViewMode, { label: string; description: string; Icon: LucideIcon }> = {
  time:   { label: 'Time Path',   description: 'MC median shifts 2026→2035, cumulative vs 2025', Icon: Calendar },
  force:  { label: 'Force attribution',       description: 'Distributes each category shift across forces by exposure: attribution, not an independent simulation', Icon: Zap },
  vc:     { label: 'Value chain epicentre attribution', description: 'Assigns each driver\'s contribution wholly to the single stage where its impact centres (its epicentre); propagation up or down the chain is not modelled. Attribution, not an independent simulation', Icon: Layers },
  region: { label: 'Region attribution',      description: 'Distributes each category shift across regions by exposure: attribution, not an independent simulation', Icon: Globe2 },
};

/** The columns of each attribution lens, in the engine's order. */
const LENS_COLUMNS: Record<Lens, string[]> = {
  force: FORCES,
  vc: [...VC_STEPS],
  region: REGIONS,
};

// ─── Impact filter (Time Path) ───────────────────────────────────────────
// Shows the expansion or the contraction drivers' part of each cell: the net
// cell times its category's fraction from computeImpactFractions (the
// drivers' signed weight x exposure / 5, summed by sign). The year shape
// stays the net simulation's; it splits the net run rather than running a
// separate one.
type ImpactFilter = 'total' | 'expansion' | 'contraction';

const IMPACT_META: Record<ImpactFilter, { label: string; description: string; Icon: LucideIcon }> = {
  total:       { label: 'Net',                 description: 'Net shift: expansion and contraction drivers combined.', Icon: Activity },
  expansion:   { label: 'Expansion drivers',   description: 'Their share of each year\'s net shift; the year shape follows the net simulation, not a separate run.', Icon: TrendingUp },
  contraction: { label: 'Contraction drivers', description: 'Their share of each year\'s net shift; the year shape follows the net simulation, not a separate run.', Icon: TrendingDown },
};

// ─── The matrix model ────────────────────────────────────────────────────

interface MatrixRow {
  /** The category's API key, e.g. "LHC: FCN". */
  id: string;
  label: string;
  group: string;
  /** Acronym chip for a Laundry & Home Care row. */
  code?: string;
}

const CATEGORY_NAMES = CATEGORIES.map((c) => c.name);
const ROWS: MatrixRow[] = CATEGORIES.map((c) => ({
  id: c.name, label: c.label, code: c.code, group: groupDisplay(c.group),
}));
const HORIZON = YEARS[YEARS.length - 1];

/** category -> column -> value; null where the run has none. */
type CellMap = Record<string, Record<string, number | null>>;

interface MatrixModel {
  columns: string[];
  data: CellMap;
  /** Each category's median at the lens year; the attribution lenses only. */
  rowTotals?: Record<string, number | null>;
  colTotals: Record<string, number | null>;
  /** The weighted average of the row totals; the attribution lenses only. */
  grandTotal: number | null;
  /** Each cell's distribution, for the P10–P90 hover; the unfiltered Time Path only. */
  cellDetails?: Record<string, Record<string, PercentileDistribution | null>>;
}

/** Each column's category-weighted average. */
function columnTotals(data: CellMap, columns: string[], weights: number[]): Record<string, number | null> {
  return Object.fromEntries(columns.map((col) => [col, weightedAvg(CATEGORY_NAMES.map((c) => data[c][col]), weights)]));
}

function buildMatrix(simulation: SimulationResult, view: ViewMode, year: number, weights: number[]): MatrixModel {
  if (view === 'time') {
    const columns = YEARS.map(String);
    const data: CellMap = {};
    const cellDetails: Record<string, Record<string, PercentileDistribution | null>> = {};
    for (const c of CATEGORY_NAMES) {
      data[c] = {};
      cellDetails[c] = {};
      for (const y of YEARS) {
        const band = getYearPercentiles(simulation.shifts, c, y);
        cellDetails[c][String(y)] = band;
        data[c][String(y)] = band?.median ?? null;
      }
    }
    return { columns, data, colTotals: columnTotals(data, columns, weights), grandTotal: null, cellDetails };
  }

  const yearKey = String(year);
  const columns = LENS_COLUMNS[view];
  const decomposition = simulation.decompositions[view][yearKey];
  const data: CellMap = {};
  const rowTotals: Record<string, number | null> = {};
  for (const c of CATEGORY_NAMES) {
    data[c] = Object.fromEntries(columns.map((d) => [d, decomposition?.[c]?.[d] ?? null]));
    rowTotals[c] = simulation.totals.category_path[c]?.[yearKey] ?? null;
  }
  return {
    columns,
    data,
    rowTotals,
    colTotals: columnTotals(data, columns, weights),
    grandTotal: weightedAvg(CATEGORY_NAMES.map((c) => rowTotals[c]), weights),
  };
}

// ─── Controls ────────────────────────────────────────────────────────────

/** A connected set of options that reads as one control (the lens, or the
 *  impact filter). The bordered track and the raised active segment keep it
 *  distinct from the year stepper and the info button beside it. */
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

/** The measurement year of the attribution lenses: one compact control that
 *  steps through the path years; the arrows disable at the ends. */
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

// ─── KPI tile ────────────────────────────────────────────────────────────

/** A headline figure above the matrix. Its P10–P90 band opens on hover,
 *  keyboard focus and tap, so it never depends on a mouse; a category tile
 *  opens the same drill-down as its matrix row. */
const KpiTile: FC<{
  label: string;
  band: PercentileDistribution;
  /** The category's label; the portfolio tile has none. */
  name?: string;
  /** Appended to the band, e.g. "80% of outcomes". */
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
          P10 {fmtShift(band.p10, 1)} … P90 {fmtShift(band.p90, 1)}
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
  const bandLabel = `, P10 ${fmtShift(band.p10, 1)} to P90 ${fmtShift(band.p90, 1)}, ${bandNote}`;
  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-label={`Open ${name ?? label} drill-down: fan chart and contributing drivers${bandLabel}`}
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
      aria-label={`${label}${bandLabel}`}
      className="relative rounded-2xl px-5 py-3.5"
      style={surface}
    >
      {inner}
    </div>
  );
};

// ─── Matrix ──────────────────────────────────────────────────────────────

interface MatrixProps {
  columns: string[];
  rows: MatrixRow[];
  data: CellMap;
  subtitle: string;
  /** With row totals the matrix gets a total column and a grand total. */
  rowTotals?: Record<string, number | null>;
  colTotals: Record<string, number | null>;
  grandTotal: number | null;
  /** Header of the total column; it names the lens year, e.g. "Total 2035". */
  rowTotalLabel: string;
  /** Per-cell distributions; with them the hover shows the P10 and P90 band. */
  cellDetails?: Record<string, Record<string, PercentileDistribution | null>>;
  /** Opens the drill-down of a row; any cell of the row does. */
  onRowClick: (rowId: string) => void;
  /** Shown in the hover where a cell has no band. */
  noBandsNote?: string;
  /** The controls, drawn as the card's top bar so they sit on the evidence they change. */
  toolbar: React.ReactNode;
}

const Matrix: FC<MatrixProps> = ({
  columns, rows, data, subtitle,
  rowTotals, colTotals, grandTotal, rowTotalLabel,
  cellDetails, onRowClick, noBandsNote, toolbar,
}) => {
  const grouped = useMemo(() => {
    const map: Record<string, MatrixRow[]> = {};
    rows.forEach((r) => {
      (map[r.group] ??= []).push(r);
    });
    return map;
  }, [rows]);

  // The hovered cell and its anchor (top centre). The tooltip is
  // fixed-positioned, so the horizontally scrolling table cannot clip it.
  const [hover, setHover] = useState<{
    rowId: string;
    colId: string;
    rowLabel: string;
    x: number;
    y: number;
  } | null>(null);

  const onCellEnter = (e: React.MouseEvent<HTMLTableCellElement>, rowId: string, colId: string, rowLabel: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHover({ rowId, colId, rowLabel, x: rect.left + rect.width / 2, y: rect.top });
  };
  const onCellLeave = () => setHover(null);

  // The hovered row: any of its cells opens the drill-down, so the whole row
  // lights up.
  const [hoverRow, setHoverRow] = useState<string | null>(null);

  // The heat ramp saturates at the 95th percentile of |value| in this view
  // (at least 2%), so structure within the view stays visible; the legend
  // states the scale.
  const viewScale = useMemo(
    () => heatScaleFor(rows.flatMap((r) => columns.map((c) => data[r.id]?.[c] ?? null))),
    [rows, columns, data],
  );

  const showTotalCol = !!rowTotals && Object.values(rowTotals).some((v) => v != null);
  const totalColSpan = columns.length + (showTotalCol ? 1 : 0) + 1;

  return (
    <div
      className="rounded-2xl"
      style={{
        backgroundColor: S.surface,
        boxShadow: '0 4px 60px -15px rgba(0, 52, 94, 0.08)',
      }}
    >
      <div
        className="rounded-t-2xl px-6 py-4 flex items-center justify-between gap-x-6 gap-y-3 flex-wrap"
        style={{
          backgroundColor: S.surface,
          borderBottom: `1px solid ${S.cardBorder}`,
        }}
      >
        {toolbar}
      </div>
      <div
        className="px-6 py-4"
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
                  key={col}
                  className="px-3 py-4 text-[11px] font-bold uppercase tracking-[0.08em] text-center"
                  style={{ color: S.onSurfaceVariant, minWidth: 96 }}
                >
                  {col}
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
                {groupRows.map((row) => {
                  const isRowHover = hoverRow === row.id;
                  const rt = rowTotals?.[row.id] ?? null;
                  return (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick(row.id)}
                    onMouseEnter={() => setHoverRow(row.id)}
                    onMouseLeave={() => setHoverRow(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td
                      className="px-6 py-1 text-[13px] font-semibold sticky left-0 z-10"
                      style={{
                        backgroundColor: isRowHover ? S.surfaceLow : S.surface,
                        color: S.primary,
                        fontFamily: BODY_FONT,
                        transition: 'color 0.15s ease, background-color 0.15s ease',
                        boxShadow: isRowHover ? `inset 3px 0 0 ${S.primary}` : 'none',
                      }}
                    >
                      <span style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8 }}>
                        {/* The keyboard and screen-reader entry to the drill-down
                            is a real button in the first cell, so the row keeps
                            its table semantics; the mouse can click anywhere on
                            the row. */}
                        <button
                          type="button"
                          className="shift-row-open"
                          onClick={(e) => { e.stopPropagation(); onRowClick(row.id); }}
                          onFocus={() => setHoverRow(row.id)}
                          onBlur={() => setHoverRow(null)}
                          aria-label={`Open ${row.label} detail: fan chart and contributing drivers`}
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
                        {/* An always-visible chevron, so the drill-down is discoverable without hovering. */}
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
                    </td>
                    {columns.map((col) => {
                      const v = data[row.id]?.[col] ?? null;
                      const isCellHover = hover?.rowId === row.id && hover?.colId === col;
                      // Screen readers get the cell's band in its label, read
                      // during table navigation without a tab stop per cell;
                      // keyboard users reach the same band in the drill-down.
                      const band = cellDetails?.[row.id]?.[col] ?? null;
                      const cellLabel = v == null ? undefined
                        : band
                          ? `${row.label}, ${col}: median ${fmtShift(v, 1)}, P10 ${fmtShift(band.p10, 1)}, P90 ${fmtShift(band.p90, 1)}`
                          : `${row.label}, ${col}: ${fmtShift(v, 1)}`;
                      return (
                        <td
                          key={col}
                          className="px-3 py-1 text-center text-[13px] tabular-nums"
                          aria-label={cellLabel}
                          style={{
                            backgroundColor: heatFill(v, viewScale),
                            color: heatText(v),
                            fontWeight: v != null && Math.abs(v) > 0.02 ? 700 : 600,
                            fontFamily: MONO_FONT,
                            transition: 'background-color 0.25s ease, box-shadow 0.15s ease',
                            boxShadow: isCellHover ? `inset 0 0 0 2px ${S.primary}` : 'none',
                          }}
                          onMouseEnter={v != null ? (e) => onCellEnter(e, row.id, col, row.label) : undefined}
                          onMouseLeave={v != null ? onCellLeave : undefined}
                        >
                          {v == null ? NO_VALUE : fmtShift(v, 1)}
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
                          title={rt != null ? `${row.label}, row total (MC median): ${fmtShift(rt, 1)}` : undefined}
                        >
                          {rt == null ? NO_VALUE : `${shiftArrow(rt)} ${fmtShift(rt, 1)}`.trim()}
                        </td>
                    )}
                  </tr>
                  );
                })}
              </React.Fragment>
            ))}
            {/* Totals are labelled figures without heat shading: the arrow and
                sign carry direction, and colour intensity stays reserved for
                the grid cells. */}
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
                const ct = colTotals[col] ?? null;
                return (
                  <td
                    key={col}
                    className="px-3 py-1.5 text-center text-[13px] tabular-nums"
                    style={{
                      backgroundColor: S.surfaceContainer,
                      color: shiftColor(ct),
                      fontWeight: 700,
                      fontFamily: MONO_FONT,
                      borderTop: `2px solid ${S.cardBorderStrong}`,
                    }}
                    title={ct != null ? `${col}, column total: ${fmtShift(ct, 1)}` : undefined}
                  >
                    {ct == null ? NO_VALUE : `${shiftArrow(ct)} ${fmtShift(ct, 1)}`.trim()}
                  </td>
                );
              })}
              {showTotalCol && (
                <td
                  className="px-3 py-1.5 text-center text-[13px] tabular-nums"
                  style={{
                    backgroundColor: S.surfaceHigh,
                    color: shiftColor(grandTotal),
                    fontWeight: 800,
                    fontFamily: MONO_FONT,
                    borderLeft: `2px solid ${S.cardBorderStrong}`,
                    borderTop: `2px solid ${S.cardBorderStrong}`,
                  }}
                  title={grandTotal != null ? `Grand total: ${fmtShift(grandTotal, 1)}` : undefined}
                >
                  {grandTotal == null ? NO_VALUE : `${shiftArrow(grandTotal)} ${fmtShift(grandTotal, 1)}`.trim()}
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>

      {/* The legend gives the short read; the aggregation rules are in "About this model". */}
      <div
        className="rounded-b-2xl flex items-center justify-between px-6 py-4 flex-wrap gap-3"
        style={{ backgroundColor: S.surfaceLow, color: S.mutedText, fontSize: 11 }}
      >
        <span style={{ fontFamily: BODY_FONT }}>
          Signed % vs 2025 · positive = expansion · negative = contraction · totals are
          category-weighted averages (labelled, not shaded)
        </span>
        <div className="flex items-center gap-3">
          <span title="Shading scaled to the values in this view">−{fmtPct(viewScale, 1)}</span>
          {/* Swatches from lib/format's shift colours; the alphas follow heatFill's 0.42 cap. */}
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

      {/* The cell tooltip: the median, and the P10 and P90 band where the cell
          has one (the unfiltered Time Path); the attribution lenses carry one
          number per cell. */}
      {hover && (() => {
        const v = data[hover.rowId]?.[hover.colId];
        if (v == null) return null;
        const band = cellDetails?.[hover.rowId]?.[hover.colId] ?? null;
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
              {hover.rowLabel} · {hover.colId}
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
              {band && (
                <>
                  <span style={{ opacity: 0.7, fontSize: 11 }}>P10</span>
                  <span
                    style={{
                      fontFamily: MONO_FONT,
                      fontWeight: 600,
                      textAlign: 'right',
                    }}
                  >
                    {fmtShift(band.p10, 1)}
                  </span>
                  <span style={{ opacity: 0.7, fontSize: 11 }}>P90</span>
                  <span
                    style={{
                      fontFamily: MONO_FONT,
                      fontWeight: 600,
                      textAlign: 'right',
                    }}
                  >
                    {fmtShift(band.p90, 1)}
                  </span>
                </>
              )}
            </div>
            {band && (
              <div style={{ opacity: 0.55, fontSize: 11, marginTop: 6, lineHeight: 1.4 }}>
                Band = magnitude uncertainty of the listed drivers only.
              </div>
            )}
            {!band && noBandsNote && (
              <div style={{ opacity: 0.55, fontSize: 11, marginTop: 6 }}>
                {noBandsNote}
              </div>
            )}
            <div style={{ opacity: 0.6, fontSize: 11, marginTop: 6, fontWeight: 600 }}>
              Click → {hover.rowLabel} drill-down
            </div>
            {/* The pointer: light fill with a border on its two lower edges, so
                it reads as one piece with the card. */}
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

// ─── Peak-stress explainer ───────────────────────────────────────────────

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
            Each driver has its own diffusion curve (<em>s_curve, linear, front-loaded,
            back-loaded, step-function</em>) and its own peak year, and the drivers&rsquo;
            peak years spread across the horizon.
          </p>
          <p className="mb-2">
            That means the category grand total can be <strong>non-monotonic</strong>:
            front-loaded consumer shifts and step-function regulation compound hardest
            mid-horizon (H1→H2), while later-maturing longevity and biotech drivers
            only pick up in H3, sometimes in the opposite direction, partially
            offsetting the stress.
          </p>
          <p className="mb-0" style={{ color: S.onSurfaceVariant }}>
            Read a cell as the <strong>cumulative level vs 2025</strong> at that
            year: the compounded impact up to that measurement point, not a
            year-over-year delta.
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Without a run ───────────────────────────────────────────────────────

/** Why the page has no run to show. */
type NoRunReason = 'unreachable' | 'no_database' | 'unservable' | 'no_run';

/** The reason from the service's diagnosis; undefined while the diagnosis is still loading. */
function noRunReason(
  backendAvailable: boolean, diagnostics: DiagnosticsResult | null | undefined,
): NoRunReason | undefined {
  if (!backendAvailable || diagnostics === null) return 'unreachable';
  if (diagnostics === undefined) return undefined;
  if (!diagnostics.db_reachable || diagnostics.simulation_reason === 'db_error') return 'no_database';
  if (diagnostics.simulation_reason === 'malformed') return 'unservable';
  if (diagnostics.simulation_reason === 'no_rows') return 'no_run';
  // "ok": the service holds a run, but the dashboard's request for it failed.
  return 'unreachable';
}

/** Viewers get plain titles; admins, who can act on it, the operational one. */
const NO_RUN_TITLE: Record<NoRunReason, { viewer: string; admin: string }> = {
  unreachable: { viewer: 'Results unavailable right now', admin: 'The run cannot be loaded' },
  no_database: { viewer: 'Data connection issue', admin: 'Backend cannot reach the database' },
  unservable:  { viewer: 'Latest run needs a refresh', admin: 'Latest run cannot be served' },
  no_run:      { viewer: 'No simulation available yet', admin: 'No simulation persisted yet' },
};

const CODE: React.CSSProperties = { fontFamily: 'monospace', fontSize: '0.92em' };

const NoRunState: FC<{
  reason: NoRunReason;
  isAdmin: boolean;
  diagnostics: DiagnosticsResult | null | undefined;
}> = ({ reason, isAdmin, diagnostics }) => {
  const problem = reason !== 'no_run';
  const Icon = problem ? AlertTriangle : Info;
  return (
    <div
      className="flex flex-col items-center justify-center py-20 px-8 text-center rounded-2xl"
      style={{ backgroundColor: S.surface, boxShadow: '0 4px 60px -15px rgba(0, 52, 94, 0.08)' }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{
          backgroundColor: problem ? S.errorContainer : S.primaryContainer,
          color: problem ? S.error : S.primary,
        }}
      >
        <Icon size={22} />
      </div>
      <h3
        className="text-[20px] font-extrabold mb-2"
        style={{ fontFamily: HEADLINE_FONT, color: S.onSurface }}
      >
        {NO_RUN_TITLE[reason][isAdmin ? 'admin' : 'viewer']}
      </h3>
      <div
        className="max-w-xl text-[14px] space-y-3"
        style={{ color: S.onSurfaceVariant, lineHeight: 1.5 }}
      >
        {!isAdmin ? (
          <p>
            {reason === 'no_run'
              ? 'No simulation run has been published yet. Results appear here automatically as soon as the PRISM team publishes the first run.'
              : 'The simulation engine isn’t serving results right now. Please check back shortly; if this persists, contact the PRISM team (Alexander Laker).'}
          </p>
        ) : reason === 'unreachable' ? (
          <p>
            The dashboard gets no run from the PRISM API under{' '}
            <code style={CODE}>/api/v1</code>. Check that the Python service is deployed
            and answering, then reload the page.
          </p>
        ) : reason === 'no_database' ? (
          <>
            <p>
              The FastAPI backend is running but cannot query the Neon
              database. This is almost always a Vercel environment
              issue: check that <code style={CODE}>POSTGRES_URL</code> (or
              {' '}<code style={CODE}>DATABASE_URL</code>)
              in the Vercel dashboard points to the same Neon branch
              you persist to from the CLI.
            </p>
            {diagnostics?.error && (
              <p style={{ fontFamily: 'monospace', fontSize: '12px', color: S.error }}>
                {diagnostics.error}
              </p>
            )}
            <p className="text-[12px]" style={{ color: S.onSurfaceVariant }}>
              The service&rsquo;s own read-out (database mode, host and the variable in use)
              is at <code style={{ fontFamily: 'monospace' }}>/api/v1/diagnostics</code>.
            </p>
          </>
        ) : reason === 'unservable' ? (
          <>
            <p>
              Run{' '}
              <strong style={{ color: S.onSurface }}>
                #{diagnostics?.latest_run_id ?? NO_VALUE}
              </strong>{' '}
              exists in the database but lacks part of what the dashboard reads.
            </p>
            {diagnostics?.error && (
              <p style={{ fontFamily: 'monospace', fontSize: '12px', color: S.error }}>
                {diagnostics.error}
              </p>
            )}
            <p>
              Re-run <code style={CODE}>python3 scripts/run_production.py</code>{' '}
              to persist a complete run.
            </p>
          </>
        ) : (
          <>
            <p>
              Simulations are triggered from the CLI
              (<code style={CODE}>scripts/run_production.py</code>).
              Once a run has been persisted to the database, all four lenses
              (Time Path, Force, Value Chain and Region) populate here
              automatically.
            </p>
            {diagnostics?.db_host && (
              <p className="text-[12px]" style={{ color: S.onSurfaceVariant }}>
                Connected to{' '}
                <code style={{ fontFamily: 'monospace' }}>{diagnostics.db_host}</code>
                {' · '}
                <strong>{diagnostics.simulation_run_count}</strong>{' '}
                runs in this database.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ─── About this model ────────────────────────────────────────────────────

/** The served run's provenance and audit metadata, and the integrity events recorded with it. */
const RunDetails: FC<{ simulation: SimulationResult }> = ({ simulation }) => {
  const m = simulation.run_meta;
  const ss = simulation.seed_stability;
  const events = simulation.integrity_events;
  const cells = cellMarginals(simulation.cell_weights_used);
  const rows: Array<[string, string]> = [
    ['Iterations', `${(m.iterations / 1000).toFixed(0)}k × ${m.chains} chains`],
    ['Seed', String(m.seed)],
    // The spread of the terminal-year portfolio median across the
    // independently seeded chains: Monte Carlo sampling noise only.
    ['Seed stability', `±${ss.spread_pp.toFixed(2)} pp across ${ss.n_chains} seeds (${ss.terminal_year} portfolio median)`],
    ['Numerics', m.numerics_backend],
    // A run stands on the estimated HCB mix or on a finance file; the source
    // label says which file.
    ['Cell weights', cells.matchesEstimate
      ? `estimated HCB mix, not Henkel P&L (${cells.cellCount} cells)`
      : `finance figures (${cells.cellCount} cells)`],
    ['Weights source', simulation.cell_weights_source],
    ['Region shares', Object.entries(simulation.region_weights_used)
      .map(([r, w]) => `${r} ${fmtPct(w, 0)}`).join(' · ')],
    ['Category shares', 'row sums of the cell weights'],
    ['Driver base', `${m.driver_count} drivers`],
    ['Calibration', m.attenuation_source],
    ['Engine', m.engine_name],
    ['Model', m.model_version],
  ];
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
        </span>
        <span style={{ color: S.mutedText, fontSize: 11.5 }}>
          {fmtDateTime(m.run_date)}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1.5">
        {rows.map(([k, v]) => (
          <span key={k} className="inline-flex items-baseline gap-2">
            <span style={{ fontSize: 11.5, color: S.mutedText }}>{k}</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: S.onSurface,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{v}</span>
          </span>
        ))}
      </div>
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
};

/** Force weight x attenuation per force, largest first: how much of a
 *  driver's signal reaches a category before probability, materialisation,
 *  exposure and overlap. */
function passThrough(config: ModelConfig): Array<[ForceName, number]> {
  return FORCES
    .map((f): [ForceName, number] => [f, config.force_weights[f] * config.per_force_attenuation[f]])
    .sort((a, b) => b[1] - a[1]);
}

// ─── Shift Analysis ──────────────────────────────────────────────────────

const ShiftAnalysis: FC<{
  /** Admins see the operational reason when there is no run to show. */
  isAdmin?: boolean;
  /** Opens the Drivers page searched for a driver's name; the drill-down's driver cards use it. */
  onNavigateToDriver?: (query: string) => void;
}> = ({ isAdmin = false, onNavigateToDriver }) => {
  const {
    simulation, config, drivers,
    loading, error, backendAvailable,
    reload,
  } = usePrism();

  const [view, setView] = useState<ViewMode>('time');
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>('total');
  const [selectedYear, setSelectedYear] = useState<number>(HORIZON);
  /** The category whose drill-down is open, by its API key. */
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);

  // The service's own diagnosis, fetched only while there is no run to show,
  // so the page can say why: undefined until it answers, null when the
  // service cannot be reached.
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null | undefined>(undefined);
  useEffect(() => {
    if (loading || simulation || !backendAvailable) return;
    let cancelled = false;
    void getDiagnostics().then((d) => { if (!cancelled) setDiagnostics(d); });
    return () => { cancelled = true; };
  }, [loading, simulation, backendAvailable]);

  const categoryWeights = useMemo(
    () => (simulation ? categoryShares(simulation.category_weights_used, CATEGORY_NAMES) : []),
    [simulation],
  );
  const impactFractions = useMemo(() => computeImpactFractions(drivers, CATEGORIES), [drivers]);

  const matrix = useMemo<MatrixModel | null>(() => {
    if (!simulation) return null;
    const model = buildMatrix(simulation, view, selectedYear, categoryWeights);
    if (view !== 'time' || impactFilter === 'total') return model;
    // The filter scales each row by its category's fraction. The P10–P90
    // bands describe the unfiltered distribution, so they are dropped.
    const data: CellMap = Object.fromEntries(CATEGORY_NAMES.map((c) => {
      const fraction = impactFractions[c][impactFilter];
      return [c, Object.fromEntries(model.columns.map((col) => {
        const v = model.data[c][col];
        return [col, v == null || !isFinite(v) ? null : v * fraction];
      }))];
    }));
    return { ...model, data, colTotals: columnTotals(data, model.columns, categoryWeights), cellDetails: undefined };
  }, [simulation, view, selectedYear, categoryWeights, impactFilter, impactFractions]);

  // The KPI strip: the joint portfolio band at the horizon, and the most
  // resilient and most exposed categories with their own bands.
  const headline = useMemo(() => {
    if (!simulation) return null;
    const terminal = CATEGORIES.flatMap((c) => {
      const band = getYearPercentiles(simulation.shifts, c.name, HORIZON);
      return band ? [{ name: c.name, band }] : [];
    });
    const categoryTiles = terminal.length ? [
      { label: 'Most resilient category', ...terminal.reduce((a, b) => (b.band.median > a.band.median ? b : a)) },
      { label: 'Most exposed category', ...terminal.reduce((a, b) => (b.band.median < a.band.median ? b : a)) },
    ] : [];
    return { portfolio: simulation.totals.portfolio[String(HORIZON)], categoryTiles };
  }, [simulation]);

  const run = simulation?.run_meta ?? null;
  const meta = VIEW_META[view];
  const noRun = simulation ? undefined : noRunReason(backendAvailable, diagnostics);
  const showOffline = !loading && !backendAvailable;

  // The matrix card's toolbar speaks three distinct vocabularies, so its jobs
  // never blur into one strip of look-alike pills: the lens as a segmented
  // control on the left; on the right a labelled contextual control (the
  // impact filter on Time Path, the year stepper on the attribution lenses);
  // and the peak-stress explainer as an info button.
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
            ariaLabel="Driver-impact filter"
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

  const loadingState = (
    <div
      className="flex items-center justify-center py-24 rounded-2xl"
      style={{ backgroundColor: S.surface, color: S.mutedText }}
    >
      <Loader2 size={20} className="animate-spin" style={{ color: S.primary }} />
      <span className="ml-3 text-[14px]">Loading shift matrix…</span>
    </div>
  );

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: S.bg, color: S.onBg, fontFamily: BODY_FONT }}
    >
      {/* Visible keyboard focus on the matrix's drill-down buttons, whose
          `all: unset` removes the browser's own focus ring. */}
      <style>{`
        .shift-row-open:focus-visible { outline: 2px solid ${S.primary}; outline-offset: 2px; border-radius: 4px; }
        .shift-row-open:focus:not(:focus-visible) { outline: none; }
      `}</style>
      <main className="max-w-[1440px] mx-auto px-8 py-10">

        <AnimatePresence>
          {showOffline && (
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
                  The PRISM service cannot be reached. The dashboard reloads its data as soon as it answers again.
                </span>
              </div>
              <button
                type="button"
                onClick={() => { void reload(); }}
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
        </AnimatePresence>

        <div className="mb-5 pl-5" style={{ borderLeft: `4px solid ${S.primary}` }}>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] mb-2"
            style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>
            Profit Pool Shift Analysis
          </div>
          <h1 className="font-extrabold tracking-tight"
            style={{ fontFamily: HEADLINE_FONT, color: S.onBg, fontSize: '2.4rem', lineHeight: 1.15 }}>
            Where Profit Pools Shift
          </h1>
          {/* The page carries the relative-exposure framing once, here; the
              full reading note is in "About this model". */}
          <p className="mt-1.5 max-w-3xl text-[13.5px]" style={{ color: S.onSurfaceVariant, lineHeight: 1.55 }}>
            Relative exposure if no one acts, not a forecast. Four lenses, one set of totals;{' '}
            <span style={{ fontWeight: 600, color: S.onSurface }}>click any value to drill in.</span>
          </p>
        </div>

        {/* The three headline numbers; each band opens on hover, focus or tap.
            The portfolio band is the engine's joint percentile of the
            portfolio shift. */}
        {headline && (
          <div
            className="mb-5 grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}
          >
            <KpiTile
              label={`Portfolio exposure (if no action) · by ${HORIZON}`}
              band={headline.portfolio}
              bandNote="80% of outcomes (joint portfolio)"
            />
            {headline.categoryTiles.map((tile) => (
              <KpiTile
                key={tile.label}
                label={tile.label}
                name={categoryDisplay(tile.name)}
                band={tile.band}
                bandNote="80% of outcomes"
                onOpen={() => setSelectedCategory(tile.name)}
              />
            ))}
          </div>
        )}

        <motion.section
          key={view + ':' + selectedYear}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {loading ? loadingState : matrix ? (
            <Matrix
              toolbar={matrixToolbar}
              columns={matrix.columns}
              rows={ROWS}
              data={matrix.data}
              subtitle={
                view === 'time'
                  ? (impactFilter !== 'total'
                      ? `${meta.label} · ${IMPACT_META[impactFilter].label}: ${IMPACT_META[impactFilter].description}`
                      : `${meta.label} · ${meta.description}`)
                  : `${meta.label} · ${selectedYear} · ${meta.description}`
              }
              rowTotals={matrix.rowTotals}
              colTotals={matrix.colTotals}
              grandTotal={matrix.grandTotal}
              rowTotalLabel={`Total ${selectedYear}`}
              cellDetails={matrix.cellDetails}
              onRowClick={setSelectedCategory}
              noBandsNote={
                view !== 'time'
                  ? 'Switch to Time Path for P10 / P90 bands'
                  : 'Ranges unavailable when filtered to expansion or contraction drivers; bands describe the unfiltered distribution'
              }
            />
          ) : noRun ? (
            <NoRunState reason={noRun} isAdmin={isAdmin} diagnostics={diagnostics} />
          ) : loadingState}
        </motion.section>

        <AnimatePresence>
          {selectedCategory && simulation && (
            <CategoryDetailPanel
              category={selectedCategory}
              year={selectedYear}
              simulation={simulation}
              drivers={drivers}
              config={config}
              onClose={() => setSelectedCategory(null)}
              onOpenDriver={onNavigateToDriver}
            />
          )}
        </AnimatePresence>

        <footer className="mt-8">
          <button type="button" onClick={() => setAboutOpen((v) => !v)} aria-expanded={aboutOpen}
            className="w-full flex items-center justify-between gap-4 px-5 py-3.5 rounded-2xl text-left"
            style={{ backgroundColor: S.surface, border: `1px solid ${S.cardBorder}`, cursor: 'pointer' }}>
            <span className="flex items-center gap-3">
              <Info size={14} style={{ color: S.primary }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: S.onSurface, fontFamily: HEADLINE_FONT }}>About this model</span>
              <span className="hidden sm:inline" style={{ fontSize: 12, color: S.mutedText }}>
                Bayesian Monte Carlo · {run
                  ? `${run.iterations.toLocaleString('en-US')} iterations × ${run.chains} chains · ${run.driver_count} drivers · `
                  : ''}run details &amp; methodology
              </span>
            </span>
            <span className="flex items-center gap-3">
              {run && (
                <span className="hidden sm:inline" style={{ fontSize: 12, color: S.mutedText }}>
                  Run #{run.run_id} · {fmtDate(run.run_date)}
                </span>
              )}
              <ChevronDown size={16} style={{ color: S.onSurfaceVariant,
                transform: aboutOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
            </span>
          </button>
          {aboutOpen && (
            <div className="mt-2 px-5 py-5 rounded-2xl" style={{ backgroundColor: S.surface, border: `1px solid ${S.cardBorder}` }}>
              {simulation && <RunDetails simulation={simulation} />}
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] mb-3"
                style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>Glossary</div>
              <div className="grid gap-2 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              <div className="rounded-xl px-4 py-3" style={{ backgroundColor: S.surfaceLow }}>
                <div className="text-[11px] font-bold mb-1" style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}>GP1</div>
                <div className="text-[11.5px]" style={{ color: S.onSurfaceVariant, lineHeight: 1.5 }}>Gross Profit 1 (contribution after cost of goods): the profit layer whose shifts the model projects.</div>
              </div>
              <div className="rounded-xl px-4 py-3" style={{ backgroundColor: S.surfaceLow }}>
                <div className="text-[11px] font-bold mb-1" style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}>MC median</div>
                <div className="text-[11.5px]" style={{ color: S.onSurfaceVariant, lineHeight: 1.5 }}>The middle outcome of all simulated Monte Carlo paths: the central estimate shown in every cell.</div>
              </div>
              <div className="rounded-xl px-4 py-3" style={{ backgroundColor: S.surfaceLow }}>
                <div className="text-[11px] font-bold mb-1" style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}>P10 / P90</div>
                <div className="text-[11.5px]" style={{ color: S.onSurfaceVariant, lineHeight: 1.5 }}>The range covering 80% of simulated outcomes: 10% of runs land below P10, 10% above P90.</div>
              </div>
              <div className="rounded-xl px-4 py-3" style={{ backgroundColor: S.surfaceLow }}>
                <div className="text-[11px] font-bold mb-1" style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}>Category codes</div>
                <div className="text-[11.5px]" style={{ color: S.onSurfaceVariant, lineHeight: 1.5 }}>LHC = Laundry &amp; Home Care. FCN Fabric Clean · FCA Fabric Care · FFI Fabric Finishers · LAD Laundry Additives · HDW Hand Dishwash · ADW Auto Dishwash · HSC Hard-Surface Cleaner · TOI Toilet Care · IC Insect Control.</div>
              </div>
              <div className="rounded-xl px-4 py-3" style={{ backgroundColor: S.surfaceLow }}>
                <div className="text-[11px] font-bold mb-1" style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}>Attenuation</div>
                <div className="text-[11.5px]" style={{ color: S.onSurfaceVariant, lineHeight: 1.5 }}>Dampening factor applied to overlapping drivers so co-occurring effects are not double-counted.</div>
              </div>
              <div className="rounded-xl px-4 py-3" style={{ backgroundColor: S.surfaceLow }}>
                <div className="text-[11px] font-bold mb-1" style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}>Cumulative shift</div>
                <div className="text-[11.5px]" style={{ color: S.onSurfaceVariant, lineHeight: 1.5 }}>Each cell is the compounded level vs 2025 at that year, not a year-over-year change.</div>
              </div>
              </div>
              {/* Why a cell is much smaller than a driver's elicited GP1 share:
                  the structural scale chain, so a reader comparing a cell with
                  intuition about one driver understands the gap. */}
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2"
                style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>Reading the level</div>
              <p className="text-[12px] mb-2" style={{ color: S.mutedText, lineHeight: 1.6, fontFamily: BODY_FONT }}>
                Each driver&rsquo;s elicited &ldquo;share of GP1 it could touch&rdquo; is deliberately
                scaled down before it reaches a category: a driver belongs to 1 of 6 forces
                (&divide;6 averaging) and each force is attenuated (~0.4&ndash;0.5) so overlapping
                drivers aren&rsquo;t double-counted. Net <strong>structural pass-through &asymp; 7%</strong>.
                So a near-certain driver that could touch 20% of a category&rsquo;s GP1 moves that
                category <strong>&asymp;1.4%</strong> at full materialization, not 20%. Read cells as a
                conservative, comparable index and apply them with the formula
                (GP1<sub>projected</sub> = GP1<sub>actual</sub> &times; (1 + shift)); don&rsquo;t read one cell
                as the raw elicited magnitude. The impact is applied per <strong>category &times; region</strong>:
                a driver only moves the categories and regions it is scored on, and the category
                number is the roll-up of its regions by gross-profit share (weights above).
              </p>
              <div className="rounded-xl px-4 py-3 mb-5" style={{ backgroundColor: S.surfaceLow }}>
                <div className="text-[11px] font-bold mb-1.5" style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}>
                  Structural pass-through per force <span style={{ fontWeight: 400, color: S.mutedText }}>(force weight &times; attenuation; before probability, materialization, exposure &amp; overlap)</span>
                </div>
                {config && (
                  <div className="flex flex-wrap gap-x-5 gap-y-1">
                    {passThrough(config).map(([f, v]) => (
                      <span key={f} className="inline-flex items-baseline gap-1.5">
                        <span style={{ fontSize: 11.5, color: S.onSurfaceVariant }}>{f}</span>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: S.onSurface, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{fmtPct(v, 1)}</span>
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-[11px] mt-1.5" style={{ color: S.mutedText, lineHeight: 1.5 }}>
                  Shown at the attenuation production runs use; changing it is a code change followed by a new production run. Timing: P10&ndash;P90 bands are magnitude uncertainty from the Monte&nbsp;Carlo, with each driver&rsquo;s spread set by its uncertainty score; per-iteration peak-year jitter of &plusmn;0 to &plusmn;4 years, also set by that score (&plusmn;1 year by default for an unscored driver), gives velocity bands their timing spread. Confidence describes the evidence and is shown with the driver; it does not drive the bands.
                </div>
              </div>
              {/* What a 1–5 probability score means as a Beta prior: the scale
                  deliberately shrinks against overconfidence (a "5" is about
                  five in six, not certainty). */}
              <div className="rounded-xl px-4 py-3 mb-5" style={{ backgroundColor: S.surfaceLow }}>
                <div className="text-[11px] font-bold mb-1.5" style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}>
                  What a probability score means <span style={{ fontWeight: 400, color: S.mutedText }}>(1&ndash;5 &rarr; Beta prior)</span>
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
                  The scale never reaches 0 or 1: a deliberate shrinkage against overconfidence (a &ldquo;5&rdquo; materialises at mean 0.83, not certainty). The table shows the prior at uncertainty score 3, the same as for an unscored driver (&alpha;+&beta;=6). Other uncertainty scores keep the mean and narrow or widen the band, from &alpha;+&beta;=24 at score 0 to 3 at score 5.
                </div>
              </div>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2"
                style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>What the model holds constant</div>
              {/* The model's ceteris-paribus framing, in its agreed wording. */}
              <p className="text-[12px] mb-4" style={{ color: S.mutedText, lineHeight: 1.6, fontFamily: BODY_FONT }}>
                PRISM holds strategy constant. The simulation propagates external drivers only and
                deliberately excludes management response: price increases, innovation launches,
                mix shifts, competitive reaction. A negative total therefore means &ldquo;headwind to
                today&rsquo;s business if nothing changes&rdquo;, not &ldquo;this pool will shrink&rdquo;.
                Strategic response belongs to the reader, not the engine.
              </p>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2"
                style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>Methodology</div>
              {/* A three-line plain read first, so the curious reader gets the gist before the technical prose. */}
              <ul className="text-[12px] mb-3" style={{ color: S.onSurfaceVariant, lineHeight: 1.55, fontFamily: BODY_FONT, margin: '0 0 12px', paddingLeft: 18 }}>
                <li style={{ marginBottom: 3 }}>Each cell is the cumulative % shift vs 2025 at that year: a compounded level, not a year-over-year change.</li>
                <li style={{ marginBottom: 3 }}>Totals are category-weighted averages (not sums), so the portfolio number reads as one interpretable shift.</li>
                <li>The model holds Henkel and competitor strategy constant: it propagates external drivers only.</li>
              </ul>
              <p className="text-[12px]" style={{ color: S.mutedText, lineHeight: 1.6, fontFamily: BODY_FONT }}>
                <span style={{ fontWeight: 600, color: S.onSurfaceVariant }}>Methodology:</span>{' '}
                All cell values in this matrix are produced by the Bayesian Monte Carlo engine
                {run ? (
                  <>
                    {' '}(<code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{run.engine_name}</code>,{' '}
                    {run.iterations.toLocaleString('en-US')} iterations &times; {run.chains} chains, Gaussian-copula
                    dependencies, {run.driver_count} drivers)
                  </>
                ) : ' (Gaussian-copula dependencies)'}. The driver
                probability priors are <strong>structured expert judgement</strong> (Beta shapes set
                from analyst 1&ndash;5 scores); the model expresses uncertainty in those judgements and
                does not learn or update from data. Each cell is a{' '}
                <strong>cumulative shift level vs 2025</strong> at that measurement year, i.e. the
                compounded impact from {YEARS[0]} up to that year, not a year-over-year delta.
                The Force, Value Chain and Region lenses are per-year decompositions written by
                the engine. <strong>Region also enters the shift itself</strong>: the engine solves
                a category &times; region &times; year tensor (each driver weighted by category
                exposure &times; regional exposure) and rolls a category&rsquo;s regional shifts up
                with its own row of the cell weights, so a regionally concentrated driver only
                moves its regions&rsquo; slice of the pool; each category&rsquo;s drill-down shows
                its regional shifts. The Force and Region shares use the drivers&rsquo; 0&ndash;5
                exposure scores with the force weights and the run&rsquo;s cell weights; the{' '}
                <strong>Value Chain lens is a categorical epicentre partition</strong>: each
                driver&rsquo;s contribution is assigned wholly to the single stage where experts
                located its impact epicentre, with no per-step weights and no modelled
                propagation up or down the chain (holding responses constant, propagation would
                be a management or market story, not a driver property). Every row total equals
                the MC median shift for that (category, year) and is therefore identical across
                all four lenses. <strong>Column and grand totals are category-weighted
                averages</strong> of the per-category values, using the run&rsquo;s category
                shares (the row sums of its cell weights), so totals reflect the portfolio mix
                rather than simple sums of 13 categories. Because the decomposition shares sum
                to 1 per category, the grand total for any given year is identical across Time
                Path, Force, Value Chain and Region views. The dashboard neither calibrates nor
                anchors any cell; it computes only the portfolio-weighted totals, from the
                run&rsquo;s own weights.
              </p>
            </div>
          )}
        </footer>
      </main>
    </div>
  );
};

export default ShiftAnalysis;
