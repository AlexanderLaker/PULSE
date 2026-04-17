/**
 * Trends 2 — Editorial Intelligence View
 *
 * Alternative visualisation for the trends page, inspired by the Stitch
 * "Digital Curator" design language (DESIGN.md in stitch_fmcg_trend_navigator-3).
 *
 * Design principles applied:
 *   • Maritime blue palette with tonal layering (no 1px borders)
 *   • Manrope headlines + Inter body pairing
 *   • Pill-shaped category filter chips ("selection chips")
 *   • Icon tile + name + by-line trend rows
 *   • Dot-based probability bar, pill direction badge, big GP1% number
 *   • Editorial "insight rail" accent on the section header
 *
 * Data: real trends from the usePrism hook (same source as TrendExplorer).
 * No content is taken from the Stitch mockup — only the visual language.
 */

'use client';

import React, { useMemo, useState, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, TrendingUp, TrendingDown, Users, Store, Cpu, Landmark,
  Leaf, Swords, Sparkles, ChevronDown,
} from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import { CATEGORIES, fmtPct, fmtShift, shortCat } from '@/lib/format';
import type { Trend, ForceName, CategoryId } from '@/types';

// ─── Value-chain steps — 1:1 mirror of TrendExplorer.tsx ─────────
// IMPORTANT: ids and order must match TrendExplorer's ValueChainExposureGrid
// exactly so exposure values (0–5) line up with the same step for every trend.
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

// ─── Editorial design tokens (from DESIGN.md) ────────────────────
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
};

const HEADLINE_FONT = "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const BODY_FONT     = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

// Force → icon + tonal container mapping (editorial palette)
const FORCE_TILE: Record<ForceName, { Icon: FC<{ size?: number; strokeWidth?: number }>; bg: string; fg: string }> = {
  Consumer:      { Icon: Users,    bg: S.primaryContainer,   fg: S.primary },
  Customer:      { Icon: Store,    bg: S.secondaryContainer, fg: S.onSecondaryContainer },
  Technology:    { Icon: Cpu,      bg: S.tertiaryContainer,  fg: S.onTertiaryContainer },
  Government:    { Icon: Landmark, bg: S.surfaceHighest,     fg: S.onSurface },
  Environmental: { Icon: Leaf,     bg: S.surfaceHigh,        fg: S.primary },
  Competitive:   { Icon: Swords,   bg: S.surfaceContainer,   fg: S.primaryDim },
};

// ─── Probability dot bar ──────────────────────────────────────────
const DotBar: FC<{ value: number }> = ({ value }) => (
  <div className="flex gap-1.5" aria-label={`Probability ${value} of 5`}>
    {[1, 2, 3, 4, 5].map((d) => (
      <span
        key={d}
        className="inline-block w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: d <= value ? S.primary : S.surfaceHigh }}
      />
    ))}
  </div>
);

// ─── Small read-only dot bar for exposure scales (0–5) ────────────
// Mirrors TrendExplorer's <DotBar size="xs" /> density, but tinted to fit
// the editorial palette and without the editable click handlers.
interface ExposureDotsProps {
  value: number;
  tone?: 'emerald' | 'purple';
}
const ExposureDots: FC<ExposureDotsProps> = ({ value, tone = 'emerald' }) => {
  // Editorial tone tokens; kept inline so they're colocated with usage.
  const FILLED = tone === 'emerald' ? S.primary : S.onTertiaryContainer;
  const EMPTY  = S.surfaceHigh;
  return (
    <div className="flex gap-1" aria-label={`Exposure ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((d) => (
        <span
          key={d}
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: d <= value ? FILLED : EMPTY, opacity: d <= value ? 1 : 0.55 }}
        />
      ))}
    </div>
  );
};

// ─── Category Exposure Grid (read-only, 1:1 with TrendExplorer) ───
// Groups categories into Hair / LHC just like TrendExplorer does, so
// the exposure readout is identical across both pages.
const CategoryExposureGrid: FC<{ exposures: Partial<Record<CategoryId, number>> }> = ({ exposures }) => {
  const grouped = {
    Hair: CATEGORIES.filter((c) => c.group === 'Hair'),
    LHC:  CATEGORIES.filter((c) => c.group === 'LHC'),
  };
  return (
    <div className="space-y-4">
      <div
        className="text-[11px] font-bold uppercase tracking-[0.15em]"
        style={{ color: S.onSurfaceVariant }}
      >
        Category Exposure (0–5)
      </div>
      {Object.entries(grouped).map(([group, cats]) => (
        <div key={group}>
          <div
            className="text-[10px] font-semibold mb-2"
            style={{ color: S.onSurfaceVariant, letterSpacing: '0.08em' }}
          >
            {group.toUpperCase()}
          </div>
          <div className="grid grid-cols-4 gap-3">
            {cats.map((cat) => (
              <div key={cat.id} className="flex flex-col items-center gap-1.5">
                <ExposureDots value={exposures?.[cat.id as CategoryId] ?? 0} tone="emerald" />
                <div
                  className="text-[10px] font-medium text-center"
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

// ─── Value-chain Exposure Grid (read-only, 1:1 with TrendExplorer) ─
// Same 8 steps in the same order as TrendExplorer's ValueChainExposureGrid.
const ValueChainExposureGrid: FC<{ exposures: Record<string, number> }> = ({ exposures }) => (
  <div className="space-y-4">
    <div
      className="text-[11px] font-bold uppercase tracking-[0.15em]"
      style={{ color: S.onSurfaceVariant }}
    >
      Value Chain Exposure (0–5)
    </div>
    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
      {VC_STEPS.map((step) => (
        <div key={step.id} className="flex flex-col gap-1.5">
          <div
            className="text-[11px] font-medium"
            style={{ color: S.onSurface }}
          >
            {step.label}
          </div>
          <ExposureDots value={exposures?.[step.id] ?? 0} tone="purple" />
        </div>
      ))}
    </div>
  </div>
);

// ─── Direction pill ────────────────────────────────────────────────
const DirectionPill: FC<{ direction: 'Expansion' | 'Contraction' }> = ({ direction }) => {
  const isExp = direction === 'Expansion';
  const Icon = isExp ? TrendingUp : TrendingDown;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase"
      style={{
        backgroundColor: isExp ? S.primaryContainer : S.errorContainer,
        color:           isExp ? S.onPrimaryContainer : S.onErrorContainer,
      }}
    >
      <Icon size={13} strokeWidth={2.5} />
      {direction}
    </span>
  );
};

// ─── Main component ────────────────────────────────────────────────
const Trends2: FC = () => {
  const { trends, loading, backendAvailable } = usePrism();
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | 'all'>('all');
  const [search, setSearch] = useState('');
  // Which trend row is currently expanded to show category + VC exposure.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo<Trend[]>(() => {
    const q = search.trim().toLowerCase();
    return (trends || []).filter((t) => {
      if (categoryFilter !== 'all') {
        const exposure = t.category_exposure?.[categoryFilter] ?? 0;
        if (exposure <= 0) return false;
      }
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false) ||
        t.force.toLowerCase().includes(q)
      );
    });
  }, [trends, categoryFilter, search]);

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: S.bg, color: S.onBg, fontFamily: BODY_FONT }}
    >
      <main className="max-w-[1440px] mx-auto px-8 py-10">
        {/* Editorial header with insight-rail accent */}
        <header className="mb-8 flex items-start justify-between gap-8">
          <div
            className="pl-5"
            style={{ borderLeft: `4px solid ${S.primary}` }}
          >
            <div
              className="text-xs font-semibold uppercase tracking-[0.18em] mb-2"
              style={{ color: S.onSurfaceVariant }}
            >
              Trend Intelligence · Editorial View
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
              The Forces Shaping FMCG
            </h1>
            <p
              className="mt-2 max-w-2xl text-[15px]"
              style={{ color: S.onSurfaceVariant, lineHeight: 1.55 }}
            >
              A curated lens on the {trends?.length ?? 0} signals driving
              profit-pool reallocation across categories through 2036.
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full max-w-xs">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2"
              style={{ color: S.onSurfaceVariant }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search trends…"
              className="w-full pl-11 pr-4 py-2.5 rounded-full text-sm focus:outline-none focus:ring-2"
              style={{
                backgroundColor: S.surfaceLow,
                color: S.onSurface,
                border: 'none',
              }}
            />
          </div>
        </header>

        {/* Category filter chips */}
        <section className="mb-8">
          <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            <FilterChip
              label="All"
              active={categoryFilter === 'all'}
              onClick={() => setCategoryFilter('all')}
            />
            {CATEGORIES.map((c) => (
              <FilterChip
                key={c.id}
                label={c.short}
                active={categoryFilter === c.id}
                onClick={() => setCategoryFilter(c.id as CategoryId)}
              />
            ))}
          </div>
        </section>

        {/* Editorial "paper" card hosting the trend list */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-2xl overflow-hidden"
          style={{
            backgroundColor: S.surface,
            boxShadow: '0 4px 60px -15px rgba(0, 52, 94, 0.08)',
          }}
        >
          {/* Column header */}
          <div
            className="grid items-center px-8 py-5 text-[11px] font-bold uppercase tracking-[0.15em]"
            style={{
              gridTemplateColumns: '2.3fr 1fr 1fr 0.9fr 0.8fr',
              backgroundColor: S.surfaceLow,
              color: S.onSurfaceVariant,
            }}
          >
            <span>Trend</span>
            <span>Direction</span>
            <span>Probability</span>
            <span className="text-right">GP1 % Affected</span>
            <span className="text-right">Shift</span>
          </div>

          {/* Rows */}
          <div>
            {loading && (
              <EmptyRow text="Loading trend intelligence…" icon={<Sparkles size={20} />} />
            )}
            {!loading && !backendAvailable && (
              <EmptyRow text="Backend unavailable — reconnect to view live trend data." icon={<Sparkles size={20} />} />
            )}
            {!loading && backendAvailable && filtered.length === 0 && (
              <EmptyRow text="No trends match the current filter." icon={<Sparkles size={20} />} />
            )}
            {filtered.map((t, idx) => {
              const key = t.id ?? String(idx);
              const expanded = expandedId === key;
              return (
                <TrendRow
                  key={key}
                  trend={t}
                  isLast={idx === filtered.length - 1}
                  expanded={expanded}
                  onToggle={() => setExpandedId(expanded ? null : key)}
                />
              );
            })}
          </div>
        </motion.div>
      </main>
    </div>
  );
};

// ─── Filter chip ───────────────────────────────────────────────────
const FilterChip: FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className="flex-shrink-0 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 hover:scale-[0.97]"
    style={{
      backgroundColor: active ? S.primaryContainer : S.surfaceLow,
      color:           active ? S.onPrimaryContainer : S.onSurfaceVariant,
    }}
  >
    {label}
  </button>
);

// ─── Trend row ─────────────────────────────────────────────────────
interface TrendRowProps {
  trend: Trend;
  isLast: boolean;
  expanded: boolean;
  onToggle: () => void;
}

const TrendRow: FC<TrendRowProps> = ({ trend, isLast, expanded, onToggle }) => {
  const tile = FORCE_TILE[trend.force] ?? FORCE_TILE.Consumer;
  const { Icon } = tile;
  const gp1 = (trend as Trend & { gp1_pct_affected?: number }).gp1_pct_affected;
  const shift = trend.gp1_shift;

  // Pull the exact same fields TrendExplorer reads — preserves 1:1 parity.
  const catExposure: Partial<Record<CategoryId, number>> = trend.category_exposure ?? {};
  const vcExposure: Record<string, number> = (trend.vc_exposure ?? {}) as Record<string, number>;

  return (
    <div style={{ boxShadow: isLast && !expanded ? 'none' : `inset 0 -1px 0 ${S.surfaceLow}` }}>
      {/* Header row — click to toggle the exposure detail panel */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full grid items-center px-8 py-6 text-left transition-colors"
        style={{
          gridTemplateColumns: '2.3fr 1fr 1fr 0.9fr 0.8fr',
          backgroundColor: expanded ? S.surfaceLow : S.surface,
          cursor: 'pointer',
          border: 'none',
        }}
      >
        {/* Trend identity */}
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="w-11 h-11 flex-shrink-0 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: tile.bg, color: tile.fg }}
          >
            <Icon size={20} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div
              className="font-bold text-[15px] truncate flex items-center gap-2"
              style={{ fontFamily: HEADLINE_FONT, color: S.onSurface }}
            >
              {trend.name}
              <ChevronDown
                size={14}
                style={{
                  color: S.onSurfaceVariant,
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 180ms ease',
                }}
              />
            </div>
            <div
              className="text-[13px] truncate"
              style={{ color: S.onSurfaceVariant }}
            >
              {trend.description || trend.strategic_implication || `${trend.force} signal`}
            </div>
          </div>
        </div>

        {/* Direction */}
        <div><DirectionPill direction={trend.direction} /></div>

        {/* Probability */}
        <div><DotBar value={Math.round(trend.probability ?? 0)} /></div>

        {/* GP1 % */}
        <div className="text-right">
          <span
            className="font-extrabold"
            style={{ fontFamily: HEADLINE_FONT, color: S.onSurface, fontSize: '1.15rem' }}
          >
            {gp1 != null ? fmtPct(gp1) : '—'}
          </span>
        </div>

        {/* Shift */}
        <div className="text-right">
          <span
            className="font-bold text-[14px]"
            style={{
              color: shift != null && shift < 0 ? S.error : S.onPrimaryContainer,
            }}
          >
            {shift != null ? fmtShift(shift) : '—'}
          </span>
        </div>
      </button>

      {/* Expanded exposure panel — 1:1 port of TrendExplorer's
          CategoryExposureGrid + ValueChainExposureGrid */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ overflow: 'hidden', backgroundColor: S.surfaceLow }}
          >
            <div
              className="px-8 py-7 grid gap-10"
              style={{ gridTemplateColumns: '1fr 1fr' }}
            >
              <CategoryExposureGrid exposures={catExposure} />
              <ValueChainExposureGrid exposures={vcExposure} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Empty / loading row ───────────────────────────────────────────
const EmptyRow: FC<{ text: string; icon: React.ReactNode }> = ({ text, icon }) => (
  <div
    className="px-8 py-16 flex flex-col items-center justify-center gap-3"
    style={{ color: S.onSurfaceVariant }}
  >
    <div style={{ color: S.primary }}>{icon}</div>
    <div className="text-sm">{text}</div>
  </div>
);

export default Trends2;
