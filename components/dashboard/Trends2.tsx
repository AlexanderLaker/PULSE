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
import { motion } from 'framer-motion';
import {
  Search, TrendingUp, TrendingDown, Users, Store, Cpu, Landmark,
  Leaf, Swords, Sparkles,
} from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import { CATEGORIES, fmtPct, fmtShift } from '@/lib/format';
import type { Trend, ForceName, CategoryId } from '@/types';

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
            {filtered.map((t, idx) => (
              <TrendRow key={t.id ?? idx} trend={t} isLast={idx === filtered.length - 1} />
            ))}
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
const TrendRow: FC<{ trend: Trend; isLast: boolean }> = ({ trend, isLast }) => {
  const tile = FORCE_TILE[trend.force] ?? FORCE_TILE.Consumer;
  const { Icon } = tile;
  const gp1 = (trend as Trend & { gp1_pct_affected?: number }).gp1_pct_affected;
  const shift = trend.gp1_shift;

  return (
    <div
      className="grid items-center px-8 py-6 transition-colors hover:bg-opacity-70"
      style={{
        gridTemplateColumns: '2.3fr 1fr 1fr 0.9fr 0.8fr',
        // Tonal layering instead of 1px divider, per DESIGN.md "No-Line Rule"
        backgroundColor: S.surface,
        boxShadow: isLast ? 'none' : `inset 0 -1px 0 ${S.surfaceLow}`,
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
            className="font-bold text-[15px] truncate"
            style={{ fontFamily: HEADLINE_FONT, color: S.onSurface }}
          >
            {trend.name}
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
