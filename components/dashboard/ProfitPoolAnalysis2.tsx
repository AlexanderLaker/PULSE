/**
 * Profit Pool Analysis 2 — Editorial Shift Matrix View
 *
 * A lean, focused view of the Shift Matrix with four lenses:
 *   • Time Path     — category × year (MC median shifts)
 *   • Force         — category × 6 forces, at a selected year
 *   • Value Chain   — category × 8 value-chain steps, at a selected year
 *   • Region        — category × 4 regions, at a selected year
 *
 * v3.1 change: the Force / VC / Region decompositions are NO LONGER
 * synthesized in the frontend from trend exposures. They are produced by
 * the backend (bayesian_mc v2.5+) per year and arrive on the
 * `simulation.decompositions` + `simulation.totals` blocks. By construction
 * each lens's row total equals the MC median shift for that (cat, year),
 * which is also the row total of the other two lenses — so the three
 * lenses reconcile to the same per-category per-year shift. The column
 * totals aggregate across categories to the same grand total per year.
 *
 * All data is real. No frontend calibration chain, no flat multipliers,
 * no anchoring: the numbers you see here are literally the numbers the
 * simulation engine wrote to the DB.
 */

'use client';

import React, { useMemo, useState, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Layers, Globe2, Zap, Play, Loader2, AlertTriangle,
  ChevronRight, Sparkles, Info,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import { CATEGORIES, YEARS, fmtShift } from '@/lib/format';
import type {
  ForceName, Scenario,
  PercentileDistribution, ShiftPath,
} from '@/types';

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

/** Heatmap cell color — signed diverging palette.
 *  Green (#22C55E) = expansion, Red (#EF4444) = contraction. */
function heatFill(v: number | null): string {
  if (v == null || !isFinite(v)) return S.surfaceLow;
  if (Math.abs(v) < 0.0005) return S.surfaceLow;
  const mag = Math.min(Math.abs(v) / 0.05, 1);
  if (v > 0) {
    const a = 0.14 + mag * 0.62;
    return `rgba(34, 197, 94, ${a.toFixed(2)})`;
  }
  const a = 0.14 + mag * 0.62;
  return `rgba(239, 68, 68, ${a.toFixed(2)})`;
}

function heatTextColor(v: number | null): string {
  if (v == null || !isFinite(v)) return S.onSurfaceVariant;
  const mag = Math.min(Math.abs(v) / 0.05, 1);
  if (mag > 0.45) return '#ffffff';
  return v > 0 ? '#14532d' : '#7f1d1d';
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
}

const Matrix: FC<MatrixProps> = ({
  columns, rows, data, subtitle, emptyMessage,
  rowTotals, colTotals, grandTotal, showTotals = false,
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

  const hasAnyData = rows.some((r) => columns.some((c) => (data[r.id]?.[c.id] ?? null) !== null));

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
                  Total
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
                      className="px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em]"
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
                      className="px-6 py-3 text-[13px] font-semibold sticky left-0 z-10"
                      style={{
                        backgroundColor: S.surface,
                        color: S.onSurface,
                        fontFamily: BODY_FONT,
                      }}
                    >
                      {row.label}
                    </td>
                    {columns.map((col) => {
                      const v = data[row.id]?.[col.id] ?? null;
                      return (
                        <td
                          key={col.id}
                          className="px-3 py-3 text-center text-[13px] tabular-nums"
                          style={{
                            backgroundColor: heatFill(v),
                            color: heatTextColor(v),
                            fontWeight: v != null && Math.abs(v) > 0.02 ? 700 : 600,
                            fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                            transition: 'background-color 0.25s ease',
                          }}
                          title={v != null ? `${row.label} · ${col.label}: ${fmtShift(v, 2)}` : undefined}
                        >
                          {v == null ? '—' : fmtShift(v, 1)}
                        </td>
                      );
                    })}
                    {showTotals && (() => {
                      const rt = rowTotals?.[row.id] ?? null;
                      return (
                        <td
                          className="px-3 py-3 text-center text-[13px] tabular-nums"
                          style={{
                            backgroundColor: heatFill(rt),
                            color: heatTextColor(rt),
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
                  className="px-6 py-3 text-[11px] font-bold uppercase tracking-[0.12em] sticky left-0 z-10"
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
                      className="px-3 py-3 text-center text-[13px] tabular-nums"
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
                  className="px-3 py-3 text-center text-[13px] tabular-nums"
                  style={{
                    backgroundColor: heatFill(grandTotal ?? null),
                    color: heatTextColor(grandTotal ?? null),
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
          {showTotals && ' Row totals equal the MC median shift per category (identical across the three lenses by construction).'}
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
            back-loaded, step-function</em>) and its own peak year. The 82 v3.1 trends
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
    simulation, scenarios,
    loading, simulating, error, backendAvailable,
    activeScenario, setActiveScenario, simulate, reconnect,
  } = usePrism();

  const [view, setView] = useState<ViewMode>('time');
  const [selectedYear, setSelectedYear] = useState<number>(YEARS[YEARS.length - 1]!);

  // ─── Build matrix data ────────────────────────────────────────
  // rows use cat.name as the id so lookups against the backend (which keys
  // shift_matrix and category_exposure by display names like "Hair: Color")
  // just work.
  const matrixData = useMemo(() => {
    const rows = CATEGORIES.map((c) => ({
      id: c.name,
      label: c.name,
      group: c.group,
      fallbackId: c.id,
    }));

    if (view === 'time') {
      const columns = YEARS.map((y) => ({ id: String(y), label: String(y) }));
      const data: Record<string, Record<string, number | null>> = {};
      rows.forEach((r) => {
        data[r.id] = {};
        YEARS.forEach((y) => {
          data[r.id][String(y)] = getYearShift(simulation?.shifts, r.id, r.fallbackId, y);
        });
      });
      // Column totals for Time Path: per-year grand total across categories
      // (from backend totals.grand, which matches the sum of MC medians).
      const colTotals: Record<string, number | null> = {};
      YEARS.forEach((y) => {
        colTotals[String(y)] = simulation?.totals?.grand?.[String(y)] ?? null;
      });
      return {
        columns, rows, data,
        rowTotals: undefined,
        colTotals,
        grandTotal: null,
        showTotals: !!simulation?.totals,
        // Time Path only renders column totals (row totals would be sums
        // across time, which aren't a meaningful decomposition identity).
        showRowTotals: false,
      };
    }

    // ── Force / VC / Region — read from backend decompositions ──────
    const yearKey = String(selectedYear);
    const decompositions = simulation?.decompositions;
    const totals = simulation?.totals;

    const makeDecompView = (
      axisKeys: string[],
      lens: 'force' | 'vc' | 'region',
      colTotalSrc: Record<string, Record<string, number>> | undefined,
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
        rowTotals[r.id] = totals?.category_path?.[r.id]?.[yearKey] ?? null;
      });
      const colTotals: Record<string, number | null> = {};
      const colSrc = colTotalSrc?.[yearKey] ?? {};
      axisKeys.forEach((k) => {
        colTotals[k] = typeof colSrc[k] === 'number' ? colSrc[k]! : null;
      });
      const grandTotal = totals?.grand?.[yearKey] ?? null;
      return { data, rowTotals, colTotals, grandTotal };
    };

    if (view === 'force') {
      const columns = FORCE_NAMES.map((f) => ({ id: f, label: f }));
      const { data, rowTotals, colTotals, grandTotal } = makeDecompView(
        FORCE_NAMES as unknown as string[], 'force', totals?.by_force,
      );
      return { columns, rows, data, rowTotals, colTotals, grandTotal, showTotals: !!decompositions, showRowTotals: true };
    }

    if (view === 'vc') {
      const columns = VC_STEPS;
      const axisKeys = VC_STEPS.map((s) => s.id);
      const { data, rowTotals, colTotals, grandTotal } = makeDecompView(
        axisKeys, 'vc', totals?.by_vc,
      );
      return { columns, rows, data, rowTotals, colTotals, grandTotal, showTotals: !!decompositions, showRowTotals: true };
    }

    // region
    const columns = REGIONS;
    const axisKeys = REGIONS.map((r) => r.id);
    const { data, rowTotals, colTotals, grandTotal } = makeDecompView(
      axisKeys, 'region', totals?.by_region,
    );
    return { columns, rows, data, rowTotals, colTotals, grandTotal, showTotals: !!decompositions, showRowTotals: true };
  }, [view, simulation, selectedYear]);

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
              all three lenses by construction.
            </p>
          </div>

          {/* Simulate button */}
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => { void simulate(); }}
              disabled={simulating || !backendAvailable}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-semibold transition-all"
              style={{
                backgroundColor: simulating || !backendAvailable ? S.surfaceHigh : S.primary,
                color: simulating || !backendAvailable ? S.mutedText : '#ffffff',
                cursor: simulating || !backendAvailable ? 'not-allowed' : 'pointer',
                border: 'none',
                boxShadow: !simulating && backendAvailable ? '0 6px 18px -6px rgba(0, 93, 181, 0.45)' : 'none',
                fontFamily: BODY_FONT,
              }}
            >
              {simulating ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Running simulation…
                </>
              ) : (
                <>
                  <Play size={14} strokeWidth={2.3} />
                  Run simulation
                </>
              )}
            </button>
            {simulation?.generated && (
              <span style={{ color: S.mutedText, fontSize: 11 }}>
                Last run · {new Date(simulation.generated).toLocaleString()}
                {simulation.model_version && ` · ${simulation.model_version}`}
              </span>
            )}
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
            <div
              className="flex flex-col items-center justify-center py-20 px-8 text-center rounded-2xl"
              style={{ backgroundColor: S.surface, boxShadow: '0 4px 60px -15px rgba(0, 52, 94, 0.08)' }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ backgroundColor: S.primaryContainer, color: S.primary }}
              >
                <Play size={22} />
              </div>
              <h3
                className="text-[20px] font-extrabold mb-2"
                style={{ fontFamily: HEADLINE_FONT, color: S.onSurface }}
              >
                No simulation yet
              </h3>
              <p
                className="max-w-md text-[14px] mb-5"
                style={{ color: S.onSurfaceVariant, lineHeight: 1.5 }}
              >
                Run the Bayesian Monte Carlo to populate all four lenses.
                Force, Value Chain and Region decompositions are produced
                by the engine (v2.5+) alongside the Time Path.
              </p>
              <button
                type="button"
                onClick={() => { void simulate(); }}
                disabled={!backendAvailable || simulating}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-semibold"
                style={{
                  backgroundColor: S.primary,
                  color: '#ffffff',
                  border: 'none',
                  cursor: backendAvailable ? 'pointer' : 'not-allowed',
                  fontFamily: BODY_FONT,
                }}
              >
                <Play size={14} strokeWidth={2.3} />
                Run simulation
                <ChevronRight size={14} />
              </button>
            </div>
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
            />
          )}
        </motion.section>

        {/* ── Footer note ─────────────────────────────────────── */}
        <footer
          className="mt-8 text-[12px]"
          style={{ color: S.mutedText, lineHeight: 1.6, fontFamily: BODY_FONT }}
        >
          <span style={{ fontWeight: 600, color: S.onSurfaceVariant }}>Methodology:</span>{' '}
          All values in this matrix are produced by the Bayesian Monte Carlo engine
          (<code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{simulation?.model_version ?? 'bayesian_copula_v2.5'}</code>,
          10K+ iterations, Gaussian / t-copula dependencies, 82 v3.1 trends). Each cell is a{' '}
          <strong>cumulative shift level vs 2025</strong> at that measurement year — i.e. the
          compounded impact from {YEARS[0]} up to that year, not a year-over-year delta.
          The Force, Value Chain and Region lenses are per-year decompositions written by
          the engine: every row total equals the MC median shift for that (category, year),
          and is therefore identical across the three lenses by construction. Column totals
          aggregate to the same grand total per year. No frontend calibration or anchoring —
          the numbers you see here are the numbers the simulation wrote to the database.
        </footer>
      </main>
    </div>
  );
};

export default ProfitPoolAnalysis2;
