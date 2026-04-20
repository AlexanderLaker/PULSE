/**
 * Profit Pool Analysis 2 — Editorial Shift Matrix View
 *
 * A lean, focused view of the Shift Matrix with four lenses:
 *   • Time Path     — category × year, from simulation shifts
 *   • Force         — category × 6 forces, derived from trend exposures
 *   • Value Chain   — category × 8 value-chain steps
 *   • Region        — category × 4 regions
 *
 * Styled to match the Trends 2 + Trend Explorer "Digital Curator" design
 * language: maritime blue palette, Manrope headlines + Inter body, tonal
 * layering (no 1px borders), rounded cards, pill controls, soft shadows.
 *
 * All data is real and comes from the usePrism hook. No mock fallback.
 */

'use client';

import React, { useMemo, useState, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Layers, Globe2, Zap, Play, Loader2, AlertTriangle,
  ChevronRight, Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import { CATEGORIES, YEARS, fmtShift } from '@/lib/format';
import {
  BASE_ATTENUATION,
  ATTENUATION_SOURCE,
  effectiveAttenuation,
  withinForceDampening,
  materializationAt,
} from '@/lib/calibration';
import type {
  Trend, ForceName, Scenario,
  PercentileDistribution, ShiftPath,
} from '@/types';

// ─── Value-chain steps — must match backend VC_KEYS in pulse/config.py ──
// Keys are the display-string form used by the Python engine and seed_trends.
// (Frontend Trends2 uses snake_case locally, but for real data we go to the
// source of truth: the backend keys.)
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
  time:   { label: 'Time Path',   description: 'Shifts by projection year',       Icon: Calendar },
  force:  { label: 'Force',       description: 'Contribution by strategic force', Icon: Zap },
  vc:     { label: 'Value Chain', description: 'Exposure along the value chain',  Icon: Layers },
  region: { label: 'Region',      description: 'Impact across regional markets',  Icon: Globe2 },
};

// ─── Helpers ─────────────────────────────────────────────────────
const clamp = (x: number, lo = 0, hi = 5): number => Math.max(lo, Math.min(hi, x));

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

/** Read a category-exposure value — tolerates both backend display keys
 *  ("Hair: Color") and the snake_case CategoryId ("hair_color"). */
function readCatExposure(t: Trend, key: string, fallbackId?: string): number {
  const ce = (t.category_exposure as Record<string, number> | undefined) ?? {};
  if (typeof ce[key] === 'number') return ce[key]!;
  if (fallbackId && typeof ce[fallbackId] === 'number') return ce[fallbackId]!;
  return 0;
}

/** Effective per-trend severity at the terminal year:
 *     normalized_score × materialization(trend, terminalYear)
 *
 *  `normalized_score` = E[prob_mean] × gp1_pct_affected × direction_sign
 *  comes from the Bayesian trend model (see pulse/ingestion/models.py).
 *  `gp1_shift` is the API-returned alias — either field may arrive.
 *  The materialization factor is the trend's own diffusion curve at the
 *  given year (s_curve / front_loaded / …), with a force-specific legacy
 *  fallback when a trend doesn't carry diffusion metadata. */
function trendSeverityAt(t: Trend, year: number): number {
  const raw = t.gp1_shift ?? t.normalized_score ?? 0;
  if (raw === 0) return 0;
  return raw * materializationAt(t, year);
}

/** Compute the pre-calibration contribution of each trend to a category,
 *  keyed by Force. Each trend belongs to exactly one force. We also
 *  track n_active per force so we can apply within-force overlap
 *  dampening downstream. */
function computeForceContributionRaw(
  catKey: string, catFallbackId: string, trends: Trend[], year: number,
): { sums: Record<ForceName, number>; counts: Record<ForceName, number> } {
  const sums: Record<ForceName, number> = {
    Consumer: 0, Customer: 0, Technology: 0,
    Government: 0, Environmental: 0, Competitive: 0,
  };
  const counts: Record<ForceName, number> = {
    Consumer: 0, Customer: 0, Technology: 0,
    Government: 0, Environmental: 0, Competitive: 0,
  };
  trends.forEach((t) => {
    const catExp = clamp(readCatExposure(t, catKey, catFallbackId)) / 5;
    if (catExp <= 0) return;
    const severity = trendSeverityAt(t, year);
    if (severity === 0) return;
    sums[t.force] += severity * catExp;
    counts[t.force] += 1;
  });
  return { sums, counts };
}

/** Apply the calibrated per-force pipeline:
 *   1. Within-force overlap dampening (n_active-aware).
 *   2. Per-force effective attenuation from the overlap matrix.
 *  Returns one value per force. */
function applyForcePipeline(
  sums: Record<ForceName, number>,
  counts: Record<ForceName, number>,
): Record<ForceName, number> {
  const out: Record<ForceName, number> = {
    Consumer: 0, Customer: 0, Technology: 0,
    Government: 0, Environmental: 0, Competitive: 0,
  };
  (Object.keys(sums) as ForceName[]).forEach((f) => {
    const dampened = sums[f] * withinForceDampening(f, counts[f]);
    out[f] = dampened * effectiveAttenuation(f);
  });
  return out;
}

/** Distribute each trend's category impact (severity × catExp) proportionally
 *  across a set of dimension keys, using the trend's dimension-exposure
 *  vector as weights. Each trend's distributed impact is first multiplied
 *  by its force's own effective attenuation, and aggregated alongside
 *  a per-force active count so within-force dampening can be applied
 *  after proportional distribution. A trend with vc_exposure
 *  {Raw:4, Marketing:3} gives 4/7 of its impact to Raw Materials and
 *  3/7 to Marketing. */
function computeDimContributionRaw(
  catKey: string, catFallbackId: string,
  trends: Trend[],
  dimKeys: string[],
  getExpMap: (t: Trend) => Record<string, number>,
  year: number,
): { sums: Record<string, number>; perForceSums: Record<string, Record<ForceName, number>>; perForceCounts: Record<string, Record<ForceName, number>> } {
  const sums: Record<string, number> = {};
  const perForceSums: Record<string, Record<ForceName, number>> = {};
  const perForceCounts: Record<string, Record<ForceName, number>> = {};
  const emptyForceMap = (): Record<ForceName, number> => ({
    Consumer: 0, Customer: 0, Technology: 0,
    Government: 0, Environmental: 0, Competitive: 0,
  });
  dimKeys.forEach((k) => {
    sums[k] = 0;
    perForceSums[k] = emptyForceMap();
    perForceCounts[k] = emptyForceMap();
  });
  trends.forEach((t) => {
    const catExp = clamp(readCatExposure(t, catKey, catFallbackId)) / 5;
    if (catExp <= 0) return;
    const severity = trendSeverityAt(t, year);
    if (severity === 0) return;
    const expMap = getExpMap(t) ?? {};
    let totalExp = 0;
    dimKeys.forEach((k) => {
      const e = clamp(expMap[k] ?? 0);
      if (e > 0) totalExp += e;
    });
    if (totalExp <= 0) return;
    const trendContribution = severity * catExp;
    dimKeys.forEach((k) => {
      const e = clamp(expMap[k] ?? 0);
      if (e <= 0) return;
      const share = trendContribution * (e / totalExp);
      sums[k]! += share;
      perForceSums[k]![t.force] += share;
      perForceCounts[k]![t.force] += 1;
    });
  });
  return { sums, perForceSums, perForceCounts };
}

/** Apply within-force dampening and per-force attenuation to each
 *  dimension cell. A cell receives contributions from multiple forces;
 *  we dampen and attenuate each force slice separately, then sum them. */
function applyDimPipeline(
  perForceSums: Record<string, Record<ForceName, number>>,
  perForceCounts: Record<string, Record<ForceName, number>>,
): Record<string, number> {
  const out: Record<string, number> = {};
  Object.keys(perForceSums).forEach((k) => {
    let total = 0;
    (Object.keys(perForceSums[k]!) as ForceName[]).forEach((f) => {
      const raw = perForceSums[k]![f];
      if (raw === 0) return;
      const n = perForceCounts[k]![f];
      total += raw * withinForceDampening(f, n) * effectiveAttenuation(f);
    });
    out[k] = total;
  });
  return out;
}

/** Anchor the calibrated contributions to the simulation's terminal-year
 *  shift when available. The calibrated chain already produces figures
 *  in the same units as the Bayesian MC output; anchoring simply
 *  reconciles residual mismatch so the lenses add up to the Time Path
 *  end-state exactly. If no simulation is available we leave the
 *  calibrated values as-is — no flat fallback multiplier. */
function anchorToSimulation(
  calibrated: Record<string, number>,
  terminalShift: number | null,
): Record<string, number> {
  const signedTotal = Object.values(calibrated).reduce((s, x) => s + x, 0);
  if (terminalShift == null || !isFinite(terminalShift) || Math.abs(signedTotal) < 1e-9) {
    return calibrated;
  }
  // Anchor only if both point the same direction; a sign flip would
  // mean the trend-level decomposition and the full MC disagree, and
  // silently inverting the decomposition would be misleading.
  if (Math.sign(signedTotal) !== Math.sign(terminalShift)) {
    return calibrated;
  }
  const factor = terminalShift / signedTotal;
  const out: Record<string, number> = {};
  Object.entries(calibrated).forEach(([k, v]) => { out[k] = v * factor; });
  return out;
}

/** Heatmap cell color — signed diverging palette.
 *  Green (#22C55E / rgba(34,197,94)) = expansion, Red (#EF4444 /
 *  rgba(239,68,68)) = contraction — matches the PRISM design-system
 *  tokens from CLAUDE.md (--expansion / --contraction). */
function heatFill(v: number | null): string {
  if (v == null || !isFinite(v)) return S.surfaceLow;
  if (Math.abs(v) < 0.0005) return S.surfaceLow;
  const mag = Math.min(Math.abs(v) / 0.05, 1);
  if (v > 0) {
    // Positive → expansion green
    const a = 0.14 + mag * 0.62;
    return `rgba(34, 197, 94, ${a.toFixed(2)})`;
  }
  // Negative → contraction red
  const a = 0.14 + mag * 0.62;
  return `rgba(239, 68, 68, ${a.toFixed(2)})`;
}

function heatTextColor(v: number | null): string {
  if (v == null || !isFinite(v)) return S.onSurfaceVariant;
  const mag = Math.min(Math.abs(v) / 0.05, 1);
  if (mag > 0.45) return '#ffffff';
  // Deep green / deep red for readable low-intensity tints
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
}

const Matrix: FC<MatrixProps> = ({ columns, rows, data, subtitle, emptyMessage }) => {
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
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([groupName, groupRows], gIdx) => (
              <React.Fragment key={groupName}>
                {groupName !== 'All' && (
                  <tr>
                    <td
                      colSpan={columns.length + 1}
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
                  </tr>
                ))}
              </React.Fragment>
            ))}
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

// ─── Main Component ──────────────────────────────────────────────
const ProfitPoolAnalysis2: FC = () => {
  const {
    simulation, trends, scenarios,
    loading, simulating, error, backendAvailable,
    activeScenario, setActiveScenario, simulate, reconnect,
  } = usePrism();

  const [view, setView] = useState<ViewMode>('time');

  // ─── Build matrix data ────────────────────────────────────────
  // rows use cat.name as the id so lookups against the backend (which keys
  // shift_matrix and category_exposure by display names like "Hair: Color")
  // just work. `fallbackId` is the frontend snake_case id, kept so we stay
  // resilient if the API ever normalizes to snake_case.
  const matrixData = useMemo(() => {
    const rows = CATEGORIES.map((c) => ({
      id: c.name,
      label: c.name,
      group: c.group,
      fallbackId: c.id,
    }));

    const trendList = trends ?? [];
    // Terminal year for anchoring derived views to the simulation.
    const terminalYear = YEARS[YEARS.length - 1]!;

    if (view === 'time') {
      // Time Path uses the same calibrated per-force pipeline as the other
      // lenses, evaluated at each year with that year's materialization
      // fraction. Because materialization schedules are monotone
      // non-decreasing on [0, 1], the resulting per-year shift is
      // cumulative by construction — shift[2036] captures the full
      // trend impact, shift[2026] only the fraction that has
      // materialized by then.
      //
      // When the simulation is available we anchor the TERMINAL-year
      // calibrated total to the simulation's terminal median, then
      // apply the same anchor factor uniformly across years. This keeps
      // the monotone shape of the calibrated path while rescaling it to
      // agree with the Bayesian MC at 2036. If the sim's terminal shift
      // flips sign relative to the calibrated total, we leave the
      // calibrated path as-is (silent sign flip would be misleading).
      const columns = YEARS.map((y) => ({ id: String(y), label: String(y) }));
      const data: Record<string, Record<string, number | null>> = {};
      rows.forEach((r) => {
        const perYear: Record<number, number> = {};
        YEARS.forEach((y) => {
          const { sums, counts } = computeForceContributionRaw(
            r.id, r.fallbackId, trendList, y,
          );
          const calibrated = applyForcePipeline(sums, counts);
          perYear[y] = (Object.values(calibrated) as number[])
            .reduce((s, x) => s + x, 0);
        });

        const terminalCalibrated = perYear[terminalYear] ?? 0;
        const terminalSim = getYearShift(
          simulation?.shifts, r.id, r.fallbackId, terminalYear,
        );
        let scale = 1;
        if (
          terminalSim != null &&
          isFinite(terminalSim) &&
          Math.abs(terminalCalibrated) > 1e-9 &&
          Math.sign(terminalCalibrated) === Math.sign(terminalSim)
        ) {
          scale = terminalSim / terminalCalibrated;
        }

        data[r.id] = {};
        YEARS.forEach((y) => {
          data[r.id][String(y)] = perYear[y] != null ? perYear[y]! * scale : null;
        });
      });
      return { columns, rows, data };
    }

    if (view === 'force') {
      const columns = FORCE_NAMES.map((f) => ({ id: f, label: f }));
      const data: Record<string, Record<string, number | null>> = {};
      rows.forEach((r) => {
        const { sums, counts } = computeForceContributionRaw(
          r.id, r.fallbackId, trendList, terminalYear,
        );
        const calibrated = applyForcePipeline(sums, counts);
        const anchor = getYearShift(simulation?.shifts, r.id, r.fallbackId, terminalYear);
        const anchored = anchorToSimulation(
          calibrated as unknown as Record<string, number>,
          anchor,
        );
        data[r.id] = {};
        FORCE_NAMES.forEach((f) => { data[r.id][f] = anchored[f] ?? null; });
      });
      return { columns, rows, data };
    }

    if (view === 'vc') {
      const columns = VC_STEPS;
      const dimKeys = VC_STEPS.map((s) => s.id);
      const data: Record<string, Record<string, number | null>> = {};
      rows.forEach((r) => {
        const { perForceSums, perForceCounts } = computeDimContributionRaw(
          r.id, r.fallbackId, trendList, dimKeys,
          (t) => (t.vc_exposure as Record<string, number> | undefined) ?? {},
          terminalYear,
        );
        const calibrated = applyDimPipeline(perForceSums, perForceCounts);
        const anchor = getYearShift(simulation?.shifts, r.id, r.fallbackId, terminalYear);
        const anchored = anchorToSimulation(calibrated, anchor);
        data[r.id] = {};
        VC_STEPS.forEach((s) => { data[r.id][s.id] = anchored[s.id] ?? null; });
      });
      return { columns, rows, data };
    }

    // region
    const columns = REGIONS;
    const dimKeys = REGIONS.map((r) => r.id);
    const data: Record<string, Record<string, number | null>> = {};
    rows.forEach((r) => {
      const { perForceSums, perForceCounts } = computeDimContributionRaw(
        r.id, r.fallbackId, trendList, dimKeys,
        (t) => (t.regional_exposure as Record<string, number> | undefined) ?? {},
        terminalYear,
      );
      const calibrated = applyDimPipeline(perForceSums, perForceCounts);
      const anchor = getYearShift(simulation?.shifts, r.id, r.fallbackId, terminalYear);
      const anchored = anchorToSimulation(calibrated, anchor);
      data[r.id] = {};
      REGIONS.forEach((rg) => { data[r.id][rg.id] = anchored[rg.id] ?? null; });
    });
    return { columns, rows, data };
  }, [view, simulation, trends]);

  const scenarioList: Scenario[] = scenarios ?? [];
  const meta = VIEW_META[view];
  const MetaIcon = meta.Icon;

  // ─── Empty / error banners ────────────────────────────────────
  const showBackendOffline = !loading && !backendAvailable;
  // All four lenses now render from the trend database via the calibrated
  // pipeline (Time Path evaluates it per year). The simulation is used
  // only as a terminal-year anchor when available — no longer a hard
  // requirement for Time Path to render.
  const needsSimulation = false;

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
              read the same underlying data across time, strategic force,
              value-chain step, and regional market.
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
            className="flex items-center gap-2 text-[12px]"
            style={{ color: S.mutedText }}
          >
            <MetaIcon size={14} style={{ color: S.primary }} />
            <span>{meta.description}</span>
          </div>
        </section>

        {/* ── Matrix ──────────────────────────────────────────── */}
        <motion.section
          key={view}
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
                Run the simulation to populate the Time Path view.
                Force, Value Chain and Region lenses are already
                populated from the trend database.
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
              subtitle={meta.label + ' · ' + meta.description}
              emptyMessage={'Trend database has no exposure data to compute this view.'}
            />
          )}
        </motion.section>

        {/* ── Footer note ─────────────────────────────────────── */}
        <footer
          className="mt-8 text-[12px]"
          style={{ color: S.mutedText, lineHeight: 1.6, fontFamily: BODY_FONT }}
        >
          <span style={{ fontWeight: 600, color: S.onSurfaceVariant }}>Methodology:</span>{' '}
          All four lenses share the same calibrated attenuation chain
          (<code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{ATTENUATION_SOURCE}</code>):
          per trend, <code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>normalized_score × materialization(diffusion_curve, peak_year) × category_exposure</code>,
          dampened by each force's within-force overlap and attenuated by the per-force effective attenuation
          (<code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>base {BASE_ATTENUATION.toFixed(2)} × (1 − mean cross-force overlap)</code>).
          Time Path evaluates the chain at each year, so the path is cumulative by construction —
          materialization grows monotonically from 2026 to {YEARS[YEARS.length - 1]}, producing a
          monotone shift trajectory anchored to the Bayesian MC terminal median when a simulation
          is available. Force, Value Chain and Region views decompose the {YEARS[YEARS.length - 1]} end-state
          through the dimension's exposure weights. No flat multipliers — every dampening factor is
          empirically calibrated from the 82-trend April 2026 analysis.
        </footer>
      </main>
    </div>
  );
};

export default ProfitPoolAnalysis2;
