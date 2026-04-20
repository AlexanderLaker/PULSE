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
import type {
  Trend, ForceName, CategoryId, Scenario,
  PercentileDistribution, ShiftPath,
} from '@/types';

// ─── Value-chain steps — mirror of Trends2 / TrendExplorer ──────
const VC_STEPS: Array<{ id: string; label: string }> = [
  { id: 'raw_materials', label: 'Raw Materials' },
  { id: 'formulation',   label: 'Formulation' },
  { id: 'packaging',     label: 'Packaging' },
  { id: 'manufacturing', label: 'Manufacturing' },
  { id: 'logistics',     label: 'Logistics' },
  { id: 'marketing',     label: 'Marketing' },
  { id: 'trade',         label: 'Trade' },
  { id: 'after_sales',   label: 'After-Sales' },
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

/** Get the median shift for a category at a given year. */
function getYearShift(shifts: Record<string, ShiftPath> | undefined, catId: string, year: number): number | null {
  if (!shifts) return null;
  const path = shifts[catId];
  if (!path) return null;
  return extractMedian(path[year]);
}

/** Compute force contribution for a category, derived from trend exposures. */
function computeForceContribution(catId: string, trends: Trend[]): Record<ForceName, number> {
  const out: Record<ForceName, number> = {
    Consumer: 0, Customer: 0, Technology: 0,
    Government: 0, Environmental: 0, Competitive: 0,
  };
  trends.forEach((t) => {
    const base = (t.gp1_shift ?? t.normalized_score ?? 0);
    const catExp = clamp(t.category_exposure?.[catId as CategoryId] ?? 0) / 5;
    if (catExp <= 0 || base === 0) return;
    out[t.force] += base * catExp;
  });
  return out;
}

/** Compute VC contribution for a category, derived from trend category × VC exposures. */
function computeVCContribution(catId: string, trends: Trend[]): Record<string, number> {
  const out: Record<string, number> = {};
  VC_STEPS.forEach((s) => { out[s.id] = 0; });
  trends.forEach((t) => {
    const base = (t.gp1_shift ?? t.normalized_score ?? 0);
    const catExp = clamp(t.category_exposure?.[catId as CategoryId] ?? 0) / 5;
    if (catExp <= 0 || base === 0) return;
    VC_STEPS.forEach((step) => {
      const vcExp = clamp((t.vc_exposure as Record<string, number> | undefined)?.[step.id] ?? 0) / 5;
      if (vcExp <= 0) return;
      out[step.id] += base * catExp * vcExp;
    });
  });
  return out;
}

/** Compute regional contribution for a category, derived from category × region exposures. */
function computeRegionContribution(catId: string, trends: Trend[]): Record<string, number> {
  const out: Record<string, number> = {};
  REGIONS.forEach((r) => { out[r.id] = 0; });
  trends.forEach((t) => {
    const base = (t.gp1_shift ?? t.normalized_score ?? 0);
    const catExp = clamp(t.category_exposure?.[catId as CategoryId] ?? 0) / 5;
    if (catExp <= 0 || base === 0) return;
    // regional_exposure is present in seed data but not in the Next.js Trend type yet.
    const regionalExposure = ((t as unknown) as { regional_exposure?: Record<string, number> }).regional_exposure ?? {};
    REGIONS.forEach((r) => {
      const regExp = clamp(regionalExposure[r.id] ?? 0) / 5;
      if (regExp <= 0) return;
      out[r.id] += base * catExp * regExp;
    });
  });
  return out;
}

/** Heatmap cell color — maritime-blue diverging palette (editorial). */
function heatFill(v: number | null): string {
  if (v == null || !isFinite(v)) return S.surfaceLow;
  const mag = Math.min(Math.abs(v) / 0.05, 1);
  if (Math.abs(v) < 0.0005) return S.surfaceLow;
  if (v > 0) {
    // Positive → primary blue
    const a = 0.12 + mag * 0.62;
    return `rgba(0, 93, 181, ${a.toFixed(2)})`;
  }
  // Negative → muted coral / error tone
  const a = 0.14 + mag * 0.58;
  return `rgba(159, 64, 61, ${a.toFixed(2)})`;
}

function heatTextColor(v: number | null): string {
  if (v == null || !isFinite(v)) return S.onSurfaceVariant;
  const mag = Math.min(Math.abs(v) / 0.05, 1);
  if (mag > 0.45) return '#ffffff';
  return v > 0 ? S.onPrimaryContainer : S.onErrorContainer;
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
            <div style={{ flex: 1, background: 'rgba(159, 64, 61, 0.72)' }} />
            <div style={{ flex: 1, background: 'rgba(159, 64, 61, 0.34)' }} />
            <div style={{ flex: 0.2, background: S.surfaceLow }} />
            <div style={{ flex: 1, background: 'rgba(0, 93, 181, 0.34)' }} />
            <div style={{ flex: 1, background: 'rgba(0, 93, 181, 0.72)' }} />
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
  const matrixData = useMemo(() => {
    const rows = CATEGORIES.map((c) => ({ id: c.id, label: c.name, group: c.group }));

    if (view === 'time') {
      const columns = YEARS.map((y) => ({ id: String(y), label: String(y) }));
      const data: Record<string, Record<string, number | null>> = {};
      rows.forEach((r) => {
        data[r.id] = {};
        YEARS.forEach((y) => {
          data[r.id][String(y)] = getYearShift(simulation?.shifts, r.id, y);
        });
      });
      return { columns, rows, data };
    }

    if (view === 'force') {
      const columns = FORCE_NAMES.map((f) => ({ id: f, label: f }));
      const data: Record<string, Record<string, number | null>> = {};
      rows.forEach((r) => {
        const contrib = computeForceContribution(r.id, trends ?? []);
        data[r.id] = {};
        FORCE_NAMES.forEach((f) => { data[r.id][f] = contrib[f] ?? null; });
      });
      return { columns, rows, data };
    }

    if (view === 'vc') {
      const columns = VC_STEPS;
      const data: Record<string, Record<string, number | null>> = {};
      rows.forEach((r) => {
        const contrib = computeVCContribution(r.id, trends ?? []);
        data[r.id] = {};
        VC_STEPS.forEach((s) => { data[r.id][s.id] = contrib[s.id] ?? null; });
      });
      return { columns, rows, data };
    }

    // region
    const columns = REGIONS;
    const data: Record<string, Record<string, number | null>> = {};
    rows.forEach((r) => {
      const contrib = computeRegionContribution(r.id, trends ?? []);
      data[r.id] = {};
      REGIONS.forEach((rg) => { data[r.id][rg.id] = contrib[rg.id] ?? null; });
    });
    return { columns, rows, data };
  }, [view, simulation, trends]);

  const scenarioList: Scenario[] = scenarios ?? [];
  const meta = VIEW_META[view];
  const MetaIcon = meta.Icon;

  // ─── Empty / error banners ────────────────────────────────────
  const showBackendOffline = !loading && !backendAvailable;
  const needsSimulation = view === 'time' && !simulation;

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
              emptyMessage={
                view === 'time'
                  ? 'Simulation result contains no shift data for these years.'
                  : 'Trend database has no exposure data to compute this view.'
              }
            />
          )}
        </motion.section>

        {/* ── Footer note ─────────────────────────────────────── */}
        <footer
          className="mt-8 text-[12px]"
          style={{ color: S.mutedText, lineHeight: 1.6, fontFamily: BODY_FONT }}
        >
          <span style={{ fontWeight: 600, color: S.onSurfaceVariant }}>Methodology:</span>{' '}
          Time Path values are median shifts from the Bayesian Monte Carlo engine (10K+ iterations,
          Gaussian copula dependencies). Force, Value Chain and Region views are computed from the
          trend database as{' '}
          <code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            gp1_shift × category_exposure × dimension_exposure
          </code>
          {' '}(each 0–5 scale normalised to 0–1).
        </footer>
      </main>
    </div>
  );
};

export default ProfitPoolAnalysis2;
