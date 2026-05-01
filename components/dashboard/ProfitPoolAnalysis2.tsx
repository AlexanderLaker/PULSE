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
  Sparkles, Info, Database,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import * as api from '@/api/client';
import { CATEGORIES, YEARS, fmtShift } from '@/lib/format';
import type {
  ForceName, Scenario,
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

// ─── Editorial design tokens — identical to Trends2 ──────────────
const S = {
  bg:                 '#f8f9ff',
  surface:            '#ffffff',
  surfaceLow:         '#eff4ff',
  surfaceContainer:   '#e5eeff',
  surfaceHigh:        '#dce9ff',
  surfaceHighest:     '#d2e4ff',
  primary:            '#005db5',
  primaryDim:         '#0052a0',
  primaryContainer:   '#d6e3ff',
  onPrimaryContainer: '#00519e',
  onBg:               '#00345e',
  onSurface:          '#00345e',
  onSurfaceVariant:   '#26619d',
  secondaryContainer: '#d5e3fc',
  onSecondaryContainer:'#455367',
  tertiaryContainer:  '#dae2fd',
  onTertiaryContainer:'#4a5167',
  error:              '#9f403d',
  errorContainer:     '#fe8983',
  onErrorContainer:   '#752121',
  outline:            '#477dbb',
  outlineVariant:     '#81b5f6',
  cardBorder:         'rgba(0, 52, 94, 0.10)',
  cardBorderStrong:   'rgba(0, 52, 94, 0.16)',
  mutedText:          '#64748B',
};

const HEADLINE_FONT = "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const BODY_FONT     = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

// ─── View mode ───────────────────────────────────────────────────
type ViewMode = 'time' | 'force' | 'vc' | 'region';

const VIEW_META: Record<ViewMode, { label: string; description: string; Icon: LucideIcon }> = {
  time:   { label: 'Time Path',   description: 'MC median shifts 2026→2036, cumulative vs 2025', Icon: Calendar },
  force:  { label: 'Force',       description: 'Force decomposition at the selected year',       Icon: Zap },
  vc:     { label: 'Value Chain', description: 'Value-chain decomposition at the selected year', Icon: Layers },
  region: { label: 'Region',      description: 'Regional decomposition at the selected year',    Icon: Globe2 },
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

/** Get the full percentile distribution (median + p10/p25/p75/p90) for a
 *  category at a given year. Returns `null` if the cell has no data. If the
 *  backend only stored a scalar median for this cell, returns `{ median }`
 *  with no percentile bands — the tooltip will gracefully omit P10/P90. */
function getYearPercentiles(
  shifts: Record<string, ShiftPath> | undefined,
  catKey: string,
  catFallbackId: string,
  year: number,
): PercentileDistribution | null {
  if (!shifts) return null;
  const path = shifts[catKey] ?? shifts[catFallbackId];
  if (!path) return null;
  const v = (path as Record<string | number, unknown>)[year]
         ?? (path as Record<string | number, unknown>)[String(year)];
  if (v == null) return null;
  if (typeof v === 'number') return { median: v };
  return v as PercentileDistribution;
}

/** Category-weighted average helper — Layer C aggregation primitive.
 *
 * Returns  Σᵢ wᵢ·vᵢ / Σᵢ wᵢ   over the indices where vᵢ is finite and
 * wᵢ > 0. Returns null if no cat contributes (all values missing, or all
 * weights zero). Normalization is built in, so callers can pass raw
 * weights from `config.category_weights` without pre-normalizing — if
 * an admin sets weights that don't sum to 1.0, we still get a correct
 * weighted average. */
function weightedAvg(values: Array<number | null>, weights: number[]): number | null {
  let num = 0;
  let den = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const w = weights[i] ?? 0;
    if (v == null || !isFinite(v) || !isFinite(w) || w <= 0) continue;
    num += w * v;
    den += w;
  }
  if (den <= 0) return null;
  return num / den;
}

/** Heatmap cell color — signed diverging palette.
 *  Green (#22C55E) = expansion, Red (#EF4444) = contraction.
 *  `scale` is the absolute value at which the gradient saturates.
 *  Main grid cells use a fixed 5% scale; the Total column uses its own
 *  data-driven scale so row totals don't get washed out against per-
 *  dimension cells that are an order of magnitude smaller. */
function heatFillScaled(v: number | null, scale: number): string {
  if (v == null || !isFinite(v)) return S.surfaceLow;
  if (Math.abs(v) < 0.0005) return S.surfaceLow;
  const s = Math.max(scale, 0.005);
  const mag = Math.min(Math.abs(v) / s, 1);
  if (v > 0) {
    const a = 0.14 + mag * 0.62;
    return `rgba(34, 197, 94, ${a.toFixed(2)})`;
  }
  const a = 0.14 + mag * 0.62;
  return `rgba(239, 68, 68, ${a.toFixed(2)})`;
}

function heatTextColorScaled(v: number | null, scale: number): string {
  if (v == null || !isFinite(v)) return S.onSurfaceVariant;
  const s = Math.max(scale, 0.005);
  const mag = Math.min(Math.abs(v) / s, 1);
  if (mag > 0.45) return '#ffffff';
  return v > 0 ? '#14532d' : '#7f1d1d';
}

// Default 5% scale for the main grid cells and the bottom-row column totals
// (same unit as data cells — per-dimension decomposition shares).
function heatFill(v: number | null): string {
  return heatFillScaled(v, 0.05);
}
function heatTextColor(v: number | null): string {
  return heatTextColorScaled(v, 0.05);
}

// ─── UI Primitives ───────────────────────────────────────────────
const PillButton: FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: LucideIcon;
}> = ({ active, onClick, children, icon: Icon }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-semibold transition-all"
    style={{
      backgroundColor: active ? S.primary : S.surfaceLow,
      color: active ? '#ffffff' : S.onSurfaceVariant,
      boxShadow: active ? '0 4px 16px -6px rgba(0, 93, 181, 0.45)' : 'none',
      fontFamily: BODY_FONT,
      border: 'none',
      cursor: 'pointer',
    }}
  >
    {Icon && <Icon size={14} strokeWidth={2.3} />}
    {children}
  </button>
);

const ScenarioPill: FC<{
  active: boolean;
  onClick: () => void;
  label: string;
}> = ({ active, onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    className="px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all"
    style={{
      backgroundColor: active ? S.primaryContainer : S.surface,
      color: active ? S.onPrimaryContainer : S.mutedText,
      border: active ? 'none' : `1px solid ${S.cardBorder}`,
      fontFamily: BODY_FONT,
      cursor: 'pointer',
      letterSpacing: '0.02em',
    }}
  >
    {label}
  </button>
);

// ─── Matrix Table Component ──────────────────────────────────────
interface MatrixProps {
  columns: Array<{ id: string; label: string }>;
  rows: Array<{ id: string; label: string; group?: string }>;
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
  /** Optional: drill-down handler. When provided, the sticky-left category
      label cell becomes an interactive button that opens the Category
      Detail Panel with the fan chart, trigger status, and allocation
      recommendation for that single category. */
  onRowClick?: (rowId: string) => void;
}

const Matrix: FC<MatrixProps> = ({
  columns, rows, data, subtitle, emptyMessage,
  rowTotals, colTotals, grandTotal, showTotals = false,
  rowTotalLabel = 'Total',
  cellDetails,
  onRowClick,
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

  const hasAnyData = rows.some((r) => columns.some((c) => (data[r.id]?.[c.id] ?? null) !== null));

  // Total column gets its own conditional-formatting scale — the row totals
  // (and the grand total) are typically much larger in magnitude than the
  // per-force / per-VC / per-region cells in the main grid, so sharing the
  // fixed 5% scale would either saturate them all or wash out the grid.
  // Scale to the max |rowTotal| (with a defensive floor) so the Total
  // column is independently legible.
  const totalScale = useMemo(() => {
    const vals: number[] = [];
    if (rowTotals) {
      Object.values(rowTotals).forEach((v) => {
        if (v != null && isFinite(v)) vals.push(Math.abs(v));
      });
    }
    if (grandTotal != null && isFinite(grandTotal)) vals.push(Math.abs(grandTotal));
    const maxAbs = vals.length ? Math.max(...vals) : 0;
    return Math.max(maxAbs, 0.02); // floor avoids blow-up when totals are near zero
  }, [rowTotals, grandTotal]);

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

  const totalColSpan = columns.length + (showTotals ? 1 : 0) + 1; // +1 for Category column

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: S.surface,
        boxShadow: '0 4px 60px -15px rgba(0, 52, 94, 0.08)',
      }}
    >
      {subtitle && (
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
              {showTotals && (
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
                      className="px-6 py-1 text-[10px] font-bold uppercase tracking-[0.14em]"
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
                {groupRows.map((row) => (
                  <tr key={row.id}>
                    <td
                      className="px-6 py-1 text-[13px] font-semibold sticky left-0 z-10"
                      style={{
                        backgroundColor: S.surface,
                        color: onRowClick ? S.primary : S.onSurface,
                        fontFamily: BODY_FONT,
                        cursor: onRowClick ? 'pointer' : 'default',
                        transition: 'color 0.15s ease, background-color 0.15s ease',
                      }}
                      onClick={onRowClick ? () => onRowClick(row.id) : undefined}
                      onMouseEnter={onRowClick ? (e) => {
                        e.currentTarget.style.backgroundColor = S.surfaceLow;
                        e.currentTarget.style.color = S.primaryDim;
                      } : undefined}
                      onMouseLeave={onRowClick ? (e) => {
                        e.currentTarget.style.backgroundColor = S.surface;
                        e.currentTarget.style.color = S.primary;
                      } : undefined}
                      title={onRowClick ? `Open ${row.label} detail — fan chart and contributing trends` : undefined}
                      role={onRowClick ? 'button' : undefined}
                      tabIndex={onRowClick ? 0 : undefined}
                      onKeyDown={onRowClick ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onRowClick(row.id);
                        }
                      } : undefined}
                    >
                      {onRowClick ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {row.label}
                          <span aria-hidden style={{ opacity: 0.5, fontSize: 11 }}>›</span>
                        </span>
                      ) : (
                        row.label
                      )}
                    </td>
                    {columns.map((col) => {
                      const v = data[row.id]?.[col.id] ?? null;
                      return (
                        <td
                          key={col.id}
                          className="px-3 py-1 text-center text-[13px] tabular-nums"
                          style={{
                            backgroundColor: heatFill(v),
                            color: heatTextColor(v),
                            fontWeight: v != null && Math.abs(v) > 0.02 ? 700 : 600,
                            fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                            transition: 'background-color 0.25s ease',
                            cursor: v != null ? 'default' : 'inherit',
                          }}
                          onMouseEnter={v != null ? (e) => onCellEnter(e, row.id, col.id, row.label, col.label) : undefined}
                          onMouseLeave={v != null ? onCellLeave : undefined}
                        >
                          {v == null ? '—' : fmtShift(v, 1)}
                        </td>
                      );
                    })}
                    {showTotals && (() => {
                      const rt = rowTotals?.[row.id] ?? null;
                      return (
                        <td
                          className="px-3 py-1 text-center text-[13px] tabular-nums"
                          style={{
                            backgroundColor: heatFillScaled(rt, totalScale),
                            color: heatTextColorScaled(rt, totalScale),
                            fontWeight: 700,
                            fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                            borderLeft: `2px solid ${S.cardBorderStrong}`,
                            transition: 'background-color 0.25s ease',
                          }}
                          title={rt != null ? `${row.label} — row total (MC median): ${fmtShift(rt, 2)}` : undefined}
                        >
                          {rt == null ? '—' : fmtShift(rt, 1)}
                        </td>
                      );
                    })()}
                  </tr>
                ))}
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
                        backgroundColor: heatFill(ct),
                        color: heatTextColor(ct),
                        fontWeight: 700,
                        fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                        borderTop: `2px solid ${S.cardBorderStrong}`,
                      }}
                      title={ct != null ? `${col.label} — column total: ${fmtShift(ct, 2)}` : undefined}
                    >
                      {ct == null ? '—' : fmtShift(ct, 1)}
                    </td>
                  );
                })}
                <td
                  className="px-3 py-1.5 text-center text-[13px] tabular-nums"
                  style={{
                    backgroundColor: heatFillScaled(grandTotal ?? null, totalScale),
                    color: heatTextColorScaled(grandTotal ?? null, totalScale),
                    fontWeight: 800,
                    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                    borderLeft: `2px solid ${S.cardBorderStrong}`,
                    borderTop: `2px solid ${S.cardBorderStrong}`,
                  }}
                  title={grandTotal != null ? `Grand total: ${fmtShift(grandTotal, 2)}` : undefined}
                >
                  {grandTotal == null ? '—' : fmtShift(grandTotal, 1)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div
        className="flex items-center justify-between px-6 py-4 flex-wrap gap-3"
        style={{ backgroundColor: S.surfaceLow, color: S.mutedText, fontSize: 11 }}
      >
        <span style={{ fontFamily: BODY_FONT }}>
          Signed percentages. Positive → profit-pool expansion. Negative → contraction.
          {showTotals && ' Row totals equal the MC median shift per category (identical across all four lenses). Column and grand totals are category-weighted averages using the business-importance weights from the Config sheet.'}
        </span>
        <div className="flex items-center gap-3">
          <span>−5%</span>
          <div className="flex h-2 rounded-full overflow-hidden" style={{ width: 120 }}>
            <div style={{ flex: 1, background: 'rgba(239, 68, 68, 0.76)' }} />
            <div style={{ flex: 1, background: 'rgba(239, 68, 68, 0.36)' }} />
            <div style={{ flex: 0.2, background: S.surfaceLow }} />
            <div style={{ flex: 1, background: 'rgba(34, 197, 94, 0.36)' }} />
            <div style={{ flex: 1, background: 'rgba(34, 197, 94, 0.76)' }} />
          </div>
          <span>+5%</span>
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
              backgroundColor: S.onSurface,
              color: '#ffffff',
              padding: '10px 14px',
              fontFamily: BODY_FONT,
              fontSize: 12,
              minWidth: 176,
              boxShadow: '0 16px 40px -8px rgba(0, 52, 94, 0.35)',
            }}
          >
            <div
              style={{
                fontSize: 10.5,
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
                  fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontWeight: 700,
                  textAlign: 'right',
                }}
              >
                {fmtShift(v, 2)}
              </span>
              {p10 != null && (
                <>
                  <span style={{ opacity: 0.7, fontSize: 11 }}>P10</span>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontWeight: 600,
                      textAlign: 'right',
                    }}
                  >
                    {fmtShift(p10, 2)}
                  </span>
                </>
              )}
              {p90 != null && (
                <>
                  <span style={{ opacity: 0.7, fontSize: 11 }}>P90</span>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontWeight: 600,
                      textAlign: 'right',
                    }}
                  >
                    {fmtShift(p90, 2)}
                  </span>
                </>
              )}
            </div>
            {!hasBands && cellDetails && (
              <div style={{ opacity: 0.55, fontSize: 10.5, marginTop: 6 }}>
                P10 / P90 not available for this cell
              </div>
            )}
            {!cellDetails && (
              <div style={{ opacity: 0.55, fontSize: 10.5, marginTop: 6 }}>
                Switch to Time Path for P10 / P90 bands
              </div>
            )}
            {/* Pointer arrow */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                bottom: -5,
                width: 10,
                height: 10,
                backgroundColor: S.onSurface,
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
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold"
        style={{
          color: S.onPrimaryContainer,
          backgroundColor: S.primaryContainer,
          border: 'none',
          padding: '4px 10px',
          borderRadius: 999,
          cursor: 'help',
          fontFamily: BODY_FONT,
        }}
        aria-label="Why is peak stress not always in the final year?"
      >
        <Info size={12} strokeWidth={2.3} />
        Why aren&apos;t the worst years at the end?
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
const ProfitPoolAnalysis2: FC = () => {
  const {
    simulation, scenarios, config, trends,
    loading, error, backendAvailable,
    activeScenario, setActiveScenario, reconnect,
  } = usePrism();

  const [view, setView] = useState<ViewMode>('time');
  const [selectedYear, setSelectedYear] = useState<number>(YEARS[YEARS.length - 1]!);

  // ── Drill-down state ─────────────────────────────────────────────
  // Null until the user clicks a category row; then the Category Detail
  // Panel slides in from the right with the full percentile fan chart,
  // force decomposition, contributing trends, trigger status, and
  // allocation recommendation for that one category.
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

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
  const matrixData = useMemo(() => {
    const rows = CATEGORIES.map((c) => ({
      id: c.name,
      label: c.name,
      group: c.group,
      fallbackId: c.id,
    }));

    // ── Category weights (source: config page) ──────────────────────
    // Keyed by display name ("Hair: Color") to match backend DEFAULT_CATEGORY_WEIGHTS
    // and the row.id we use above. Falls back to the snake_case id (e.g. "hair_color")
    // in case a future backend persists either shape, and ultimately to 1.0
    // (equal-weighted) if the config endpoint didn't return category_weights
    // at all.
    const catWeightsRaw = config?.category_weights as Record<string, number> | undefined;
    const catWeightFor = (catName: string, fallbackId: string): number => {
      if (!catWeightsRaw) return 1; // equal-weight fallback
      const byName = catWeightsRaw[catName];
      if (typeof byName === 'number' && isFinite(byName)) return byName;
      const byId = catWeightsRaw[fallbackId];
      if (typeof byId === 'number' && isFinite(byId)) return byId;
      return 0; // explicit zero → excluded from the weighted average
    };
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

    cats.forEach((c) => {
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
      categories: cats,
    };
  }, [simulation, trends, selectedYear]);

  const scenarioList: Scenario[] = scenarios ?? [];
  const meta = VIEW_META[view];
  const MetaIcon = meta.Icon;

  // ─── Empty / error banners ────────────────────────────────────
  const showBackendOffline = !loading && !backendAvailable;
  const needsSimulation = !simulation;
  const decompositionsMissing = view !== 'time' && simulation != null
    && simulation.decompositions == null;

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: S.bg, color: S.onBg, fontFamily: BODY_FONT }}
    >
      <main className="max-w-[1440px] mx-auto px-8 py-10">
        {/* ── Editorial Header ─────────────────────────────────── */}
        <header className="mb-8 flex items-start justify-between gap-8 flex-wrap">
          <div
            className="pl-5"
            style={{ borderLeft: `4px solid ${S.primary}` }}
          >
            <div
              className="text-xs font-semibold uppercase tracking-[0.18em] mb-2"
              style={{ color: S.onSurfaceVariant }}
            >
              Profit Pool Analysis · Shift Matrix
            </div>
            <h1
              className="font-extrabold tracking-tight"
              style={{
                fontFamily: HEADLINE_FONT,
                color: S.onBg,
                fontSize: '2.5rem',
                lineHeight: 1.1,
              }}
            >
              The Shift Matrix, Four Lenses
            </h1>
            <p
              className="mt-2 max-w-2xl text-[15px]"
              style={{ color: S.onSurfaceVariant, lineHeight: 1.55 }}
            >
              How the 12 Henkel Consumer Brands categories are projected to move —
              read the same underlying MC output across time, strategic force,
              value-chain step, and regional market. Row totals reconcile across
              all four lenses; column and grand totals are category-weighted
              averages using the Config-sheet weights.
            </p>
          </div>

          {/* Run ribbon — tells the user exactly which persisted run is
              on screen. Simulations are CLI-only (scripts/run_50k_prod.py),
              so this is the only place the run_id, scenario tag, seed and
              convergence count are surfaced to end users. */}
          <div className="flex flex-col items-end gap-1 text-right">
            {simulation?.run_meta?.run_id != null ? (
              <>
                <span
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                  style={{
                    backgroundColor: S.surfaceContainer,
                    color: S.onPrimaryContainer,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                  }}
                >
                  <Database size={12} />
                  <span>Run #{simulation.run_meta.run_id}</span>
                  {simulation.run_meta.scenario && (
                    <span style={{ opacity: 0.75 }}>· {simulation.run_meta.scenario}</span>
                  )}
                </span>
                <span style={{ color: S.mutedText, fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                  {simulation.run_meta.run_date
                    ? new Date(simulation.run_meta.run_date).toLocaleString()
                    : simulation.generated
                    ? new Date(simulation.generated).toLocaleString()
                    : '—'}
                  {simulation.run_meta.iterations != null &&
                    ` · ${(simulation.run_meta.iterations / 1000).toFixed(0)}k iter`}
                  {simulation.run_meta.chains != null &&
                    ` × ${simulation.run_meta.chains}`}
                  {simulation.run_meta.converged_categories != null &&
                    simulation.run_meta.total_categories != null &&
                    ` · R̂<1.05 ${simulation.run_meta.converged_categories}/${simulation.run_meta.total_categories}`}
                </span>
                {simulation.run_meta.git_sha && simulation.run_meta.git_sha !== 'unknown' && (
                  <span style={{ color: S.mutedText, fontSize: 10, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                    {simulation.run_meta.git_sha}
                    {simulation.run_meta.seed != null && ` · seed ${simulation.run_meta.seed}`}
                    {simulation.run_meta.model_version && ` · ${simulation.run_meta.model_version}`}
                  </span>
                )}
              </>
            ) : simulation?.generated ? (
              <span style={{ color: S.mutedText, fontSize: 11 }}>
                Last run · {new Date(simulation.generated).toLocaleString()}
                {simulation.model_version && ` · ${simulation.model_version}`}
              </span>
            ) : null}
          </div>
        </header>

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
                This simulation was generated before the v2.5 engine update and doesn&apos;t
                carry the per-year Force / VC / Region decomposition blocks yet. Re-run the
                simulation to populate these lenses.
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Scenario row ─────────────────────────────────────── */}
        {scenarioList.length > 0 && (
          <section className="mb-6">
            <div
              className="text-[10px] font-bold uppercase tracking-[0.14em] mb-3"
              style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}
            >
              Scenario
            </div>
            <div className="flex flex-wrap gap-2">
              {scenarioList.map((s) => (
                <ScenarioPill
                  key={s.id}
                  active={activeScenario === s.id}
                  onClick={() => setActiveScenario(s.id)}
                  label={s.name}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── View toggle ─────────────────────────────────────── */}
        <section className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(VIEW_META) as ViewMode[]).map((v) => (
              <PillButton
                key={v}
                active={view === v}
                onClick={() => setView(v)}
                icon={VIEW_META[v].Icon}
              >
                {VIEW_META[v].label}
              </PillButton>
            ))}
          </div>
          <div
            className="flex items-center gap-3 flex-wrap"
            style={{ color: S.mutedText }}
          >
            <div className="flex items-center gap-2 text-[12px]">
              <MetaIcon size={14} style={{ color: S.primary }} />
              <span>{meta.description}</span>
            </div>
            <PeakStressTooltip />
          </div>
        </section>

        {/* ── Year selector (lens views only) ───────────────────── */}
        {view !== 'time' && (
          <section className="mb-6">
            <div
              className="text-[10px] font-bold uppercase tracking-[0.14em] mb-3"
              style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}
            >
              Measurement year · cumulative level vs 2025
            </div>
            <div className="flex flex-wrap gap-2">
              {YEARS.map((y) => (
                <ScenarioPill
                  key={y}
                  active={selectedYear === y}
                  onClick={() => setSelectedYear(y)}
                  label={String(y)}
                />
              ))}
            </div>
          </section>
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

              const title = isDbError
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
                    {isDbError ? (
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
              columns={matrixData.columns}
              rows={matrixData.rows}
              data={matrixData.data}
              subtitle={
                view === 'time'
                  ? `${meta.label} · ${meta.description}`
                  : `${meta.label} · ${selectedYear} · ${meta.description}`
              }
              emptyMessage={
                view === 'time'
                  ? 'Simulation result contains no shift data for these years.'
                  : 'No decomposition data for this year. Re-run the simulation on the v2.5+ engine.'
              }
              rowTotals={matrixData.showRowTotals ? matrixData.rowTotals : undefined}
              colTotals={matrixData.colTotals}
              grandTotal={matrixData.grandTotal}
              showTotals={matrixData.showTotals}
              rowTotalLabel={view === 'time' ? 'Total' : `Total ${selectedYear}`}
              cellDetails={matrixData.cellDetails}
              onRowClick={setSelectedCategoryId}
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
            />
          )}
        </AnimatePresence>

        {/* ── Footer note ─────────────────────────────────────── */}
        <footer
          className="mt-8 text-[12px]"
          style={{ color: S.mutedText, lineHeight: 1.6, fontFamily: BODY_FONT }}
        >
          <span style={{ fontWeight: 600, color: S.onSurfaceVariant }}>Methodology:</span>{' '}
          All cell values in this matrix are produced by the Bayesian Monte Carlo engine
          (<code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{simulation?.model_version ?? 'bayesian_copula_v2.6'}</code>,
          50,000 iterations, Gaussian / t-copula dependencies, 99 v3.5 trends). Each cell is a{' '}
          <strong>cumulative shift level vs 2025</strong> at that measurement year — i.e. the
          compounded impact from {YEARS[0]} up to that year, not a year-over-year delta.
          The Force, Value Chain and Region lenses are per-year decompositions written by
          the engine; within each lens, the per-category shares use both the trend 0–5
          ratings (category, force/VC/region exposure) and the Config-sheet dimension
          weights, so both the strength of the trend's link and its business importance
          are reflected. Every row total equals the MC median shift for that (category, year)
          and is therefore identical across all four lenses. <strong>Column and grand totals
          are category-weighted averages</strong> of the per-category values, using the
          admin-editable category business-importance weights from the Config sheet —
          so totals reflect the portfolio mix rather than simple sums of 12 categories.
          Because the decomposition shares sum to 1 per category, the grand total for any
          given year is identical across Time Path, Force, Value Chain and Region views.
          No frontend calibration or anchoring of cells — only the portfolio-weighted
          aggregation is computed client-side from the Config weights.
        </footer>
      </main>
    </div>
  );
};

export default ProfitPoolAnalysis2;
