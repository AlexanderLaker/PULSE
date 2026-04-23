/**
 * Innovation Explorer 3 — Editorial List View
 *
 * Alternative overview for the Innovation Explorer, visually aligned with
 * Trends2 (the editorial "Digital Curator" list layout). Each row represents
 * one innovation concept; clicking a row opens the unchanged
 * InnovationDeepDive page (identical to the current Innovation Explorer
 * deep dive — we only swap the overview, never the detail).
 *
 * Design principles (shared with Trends2):
 *   • Maritime blue palette, tonal layering (no 1px hairline borders)
 *   • Manrope headlines + Inter body pairing
 *   • Pill-shaped category filter chips
 *   • Icon tile + name + by-line rows
 *   • Sortable column headers with asc/desc indicators
 *   • Editorial "insight rail" accent on the section header
 *
 * Data source: the static INNOVATIONS array from data/innovations.ts (same
 * source the card-grid Innovation Explorer uses). No backend call.
 */

'use client';

import React, { useMemo, useState, FC } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Sparkles,
  Target,
  Layers,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Star,
  Droplet,
  Scissors,
  Palette,
  ShowerHead,
  Shirt,
  WashingMachine,
  UtensilsCrossed,
  SprayCan,
  Bug,
  Boxes,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  INNOVATIONS,
  INNOVATION_CATEGORIES,
  getFilteredInnovations,
  getTypeColor,
} from '@/data/innovations';
import type { Innovation } from '@/data/innovations';
import InnovationDeepDive from './InnovationDeepDive';

// ─── Editorial design tokens (mirrors Trends2 / DESIGN.md) ───────────
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

// ─── Category → icon + tonal container mapping ───────────────────────
// Innovations carry a short category label (Color, Care, Styling, Body,
// FCN, FCA, FFI, LAD, HDW, ADW, HSC, IC) or belong to Cross-Category. We
// map each to a domain-appropriate icon with the editorial tonal palette.
const CATEGORY_TILE: Record<string, { Icon: LucideIcon; bg: string; fg: string }> = {
  Color:     { Icon: Palette,           bg: S.primaryContainer,   fg: S.primary },
  Care:      { Icon: Droplet,           bg: S.secondaryContainer, fg: S.onSecondaryContainer },
  Styling:   { Icon: Scissors,          bg: S.tertiaryContainer,  fg: S.onTertiaryContainer },
  Body:      { Icon: ShowerHead,        bg: S.surfaceHighest,     fg: S.onSurface },
  FCN:       { Icon: Shirt,             bg: S.primaryContainer,   fg: S.primary },
  FCA:       { Icon: Shirt,             bg: S.secondaryContainer, fg: S.onSecondaryContainer },
  FFI:       { Icon: WashingMachine,    bg: S.tertiaryContainer,  fg: S.onTertiaryContainer },
  LAD:       { Icon: WashingMachine,    bg: S.surfaceHighest,     fg: S.onSurface },
  HDW:       { Icon: UtensilsCrossed,   bg: S.primaryContainer,   fg: S.primary },
  ADW:       { Icon: UtensilsCrossed,   bg: S.secondaryContainer, fg: S.onSecondaryContainer },
  HSC:       { Icon: SprayCan,          bg: S.tertiaryContainer,  fg: S.onTertiaryContainer },
  IC:        { Icon: Bug,               bg: S.surfaceHigh,        fg: S.primary },
  Cross:     { Icon: Boxes,             bg: S.surfaceContainer,   fg: S.primaryDim },
};

// Resolve tile from innovation.categoryShort (e.g. "Color") with
// Cross-Category fallback and a final editorial default.
const getCategoryTile = (innovation: Innovation) => {
  if (innovation.categoryGroup === 'Cross-Category') return CATEGORY_TILE.Cross;
  return CATEGORY_TILE[innovation.categoryShort] ?? {
    Icon: Layers, bg: S.surfaceContainer, fg: S.primaryDim,
  };
};

// ─── Score bar — normalized 0–100 horizontal fill ────────────────────
const ScoreBar: FC<{ value: number; tone?: 'emerald' | 'purple' }> = ({ value, tone = 'emerald' }) => {
  const filled = tone === 'emerald' ? S.primary : S.onTertiaryContainer;
  const clamp = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2" aria-label={`Score ${value} of 100`}>
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 4,
          backgroundColor: S.surfaceHigh,
          position: 'relative',
          minWidth: 60,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: `${clamp}%`,
            backgroundColor: filled,
            borderRadius: 4,
          }}
        />
      </div>
      <span
        style={{
          fontFamily: HEADLINE_FONT,
          fontSize: 13,
          fontWeight: 800,
          color: S.onSurface,
          minWidth: 32,
          textAlign: 'right',
        }}
      >
        {clamp}
      </span>
    </div>
  );
};

// ─── Type pill (WHITE_SPOT / TRANSFORMATIONAL / ...) ─────────────────
const TypePill: FC<{ type: Innovation['type']; label: string }> = ({ type, label }) => {
  const tc = getTypeColor(type);
  return (
    <span
      className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase"
      style={{
        backgroundColor: tc.bg,
        color: tc.text,
      }}
    >
      {label}
    </span>
  );
};

// ─── Tier badge (only rendered for Tier 1) ───────────────────────────
const TierBadge: FC<{ level: Innovation['tierLevel'] }> = ({ level }) => {
  if (level !== 1) return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full text-[10px] font-bold uppercase tracking-wide"
      style={{
        backgroundColor: '#fde68a',
        color: '#92400e',
      }}
    >
      <Star size={10} strokeWidth={2.5} /> Tier 1
    </span>
  );
};

// ─── Sort helpers ────────────────────────────────────────────────────
type SortKey = 'name' | 'category' | 'type' | 'marketScore' | 'fitScore' | 'horizon';
type SortDir = 'asc' | 'desc';

const SORT_DEFAULT_DIR: Record<SortKey, SortDir> = {
  name:        'asc',
  category:    'asc',
  type:        'asc',
  marketScore: 'desc',
  fitScore:    'desc',
  horizon:     'asc',
};

function sortValue(i: Innovation, key: SortKey): string | number {
  switch (key) {
    case 'name':        return i.name;
    case 'category':    return i.category;
    case 'type':        return i.typeLabel;
    case 'marketScore': return i.marketScore;
    case 'fitScore':    return i.fitScore;
    case 'horizon':     return i.horizon;
  }
}

// ─── Filter chip ─────────────────────────────────────────────────────
const FilterChip: FC<{ label: string; count: number; active: boolean; onClick: () => void }> = ({
  label, count, active, onClick,
}) => (
  <button
    onClick={onClick}
    className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 hover:scale-[0.97]"
    style={{
      backgroundColor: active ? S.primaryContainer : S.surfaceLow,
      color:           active ? S.onPrimaryContainer : S.onSurfaceVariant,
      border: 'none',
    }}
  >
    {label}
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        opacity: active ? 0.8 : 0.55,
        background: active ? 'rgba(0, 81, 158, 0.12)' : 'rgba(0, 52, 94, 0.06)',
        padding: '2px 6px',
        borderRadius: 999,
        lineHeight: 1,
      }}
    >
      {count}
    </span>
  </button>
);

// ─── Sortable column header ──────────────────────────────────────────
const SortHeader: FC<{
  label: string;
  sortKey: SortKey;
  currentKey: SortKey | null;
  currentDir: SortDir;
  onToggle: (key: SortKey) => void;
  align?: 'left' | 'right';
}> = ({ label, sortKey, currentKey, currentDir, onToggle, align = 'left' }) => {
  const isActive = currentKey === sortKey;
  const Icon = !isActive ? ArrowUpDown : currentDir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onToggle(sortKey)}
      aria-sort={isActive ? (currentDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] transition-colors"
      style={{
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        color: isActive ? S.onSurface : S.onSurfaceVariant,
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        width: '100%',
        textAlign: align,
      }}
    >
      <span>{label}</span>
      <Icon size={12} style={{ opacity: isActive ? 1 : 0.45 }} />
    </button>
  );
};

// ─── Empty / loading row ─────────────────────────────────────────────
const EmptyRow: FC<{ text: string; icon: React.ReactNode }> = ({ text, icon }) => (
  <div
    className="px-8 py-16 flex flex-col items-center justify-center gap-3"
    style={{ color: S.onSurfaceVariant }}
  >
    <div style={{ color: S.primary }}>{icon}</div>
    <div className="text-sm">{text}</div>
  </div>
);

// ─── Main props ──────────────────────────────────────────────────────
interface InnovationExplorer3Props {
  onNavigateToTrend?: (trendCode: string) => void;
  onNavigateToConsumerJourney?: (stage: string) => void;
}

// ─── Main component ──────────────────────────────────────────────────
const InnovationExplorer3: FC<InnovationExplorer3Props> = ({
  onNavigateToTrend,
  onNavigateToConsumerJourney,
}) => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedInnovation, setSelectedInnovation] = useState<Innovation | null>(null);

  // Sort state — null means "portfolio order" (initial order from data file).
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(SORT_DEFAULT_DIR[key]);
    }
  };

  // Filter by category pill (reuses the helper from data/innovations.ts)
  // then by free-text search across name / subtitle / category / type.
  const filtered = useMemo<Innovation[]>(() => {
    let items = getFilteredInnovations(activeCategory);
    const q = search.trim().toLowerCase();
    if (q) {
      items = items.filter((i) =>
        i.name.toLowerCase().includes(q) ||
        i.subtitle.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        i.typeLabel.toLowerCase().includes(q)
      );
    }
    return items;
  }, [activeCategory, search]);

  // Apply sort on top of filter. Null sortKey preserves portfolio order.
  const sorted = useMemo<Innovation[]>(() => {
    if (!sortKey) return filtered;
    const cmp = (a: Innovation, b: Innovation): number => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const as = String(av).toLowerCase();
      const bs = String(bv).toLowerCase();
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    };
    return [...filtered].sort(cmp);
  }, [filtered, sortKey, sortDir]);

  // Active category list (hide empty categories to avoid dead pills).
  const activeCats = useMemo(() => {
    return INNOVATION_CATEGORIES.filter((c) => {
      if (c.id === 'all') return true;
      return getFilteredInnovations(c.id).length > 0;
    });
  }, []);

  // Deep-dive hand-off — this is intentionally identical to the current
  // Innovation Explorer (card-grid) behavior so the task's "page that
  // opens should remain as it is now" constraint is honored.
  if (selectedInnovation) {
    return (
      <InnovationDeepDive
        innovation={selectedInnovation}
        onBack={() => setSelectedInnovation(null)}
        onNavigateToTrend={onNavigateToTrend}
        onNavigateToConsumerJourney={onNavigateToConsumerJourney}
      />
    );
  }

  // Portfolio-level rollup stats shown in the header (mirrors the
  // existing Innovation Explorer but computed from live filter state).
  const tier1Count = filtered.filter((i) => i.tierLevel === 1).length;
  const avgMarketScore = filtered.length
    ? Math.round(
        filtered.reduce((sum, i) => sum + i.marketScore, 0) / filtered.length
      )
    : 0;

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
              Innovation Intelligence · Editorial View
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
              The Innovation Portfolio
            </h1>
            <p
              className="mt-2 max-w-2xl text-[15px]"
              style={{ color: S.onSurfaceVariant, lineHeight: 1.55 }}
            >
              A curated list of the {INNOVATIONS.length} strategic product
              concepts shaping Henkel Consumer Brands through 2036.
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
              placeholder="Search innovations…"
              className="w-full pl-11 pr-4 py-2.5 rounded-full text-sm focus:outline-none focus:ring-2"
              style={{
                backgroundColor: S.surfaceLow,
                color: S.onSurface,
                border: 'none',
              }}
            />
          </div>
        </header>

        {/* Portfolio stats bar (mirrors the card-grid explorer) */}
        <section
          className="mb-6 flex flex-wrap gap-x-10 gap-y-4"
          aria-label="Portfolio statistics"
        >
          {[
            { label: 'Concepts',         value: String(filtered.length),   Icon: Sparkles },
            { label: 'Tier 1 Priority',  value: String(tier1Count),        Icon: Target },
            { label: 'Avg. Market Score', value: `${avgMarketScore}%`,     Icon: Star },
            { label: 'Horizon',          value: '2026–2036',               Icon: Layers },
          ].map((stat) => {
            const Icon = stat.Icon;
            return (
              <div key={stat.label} className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: S.primaryContainer, color: S.primary }}
                >
                  <Icon size={14} />
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: HEADLINE_FONT,
                      fontWeight: 800,
                      fontSize: 16,
                      color: S.onBg,
                      lineHeight: 1,
                    }}
                  >
                    {stat.value}
                  </div>
                  <div
                    className="text-[10px] font-semibold uppercase tracking-[0.08em] mt-0.5"
                    style={{ color: S.onSurfaceVariant }}
                  >
                    {stat.label}
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Category filter chips */}
        <section className="mb-8">
          <div
            className="flex gap-2 overflow-x-auto pb-2"
            style={{ scrollbarWidth: 'none' }}
          >
            {activeCats.map((c) => {
              const count =
                c.id === 'all'
                  ? INNOVATIONS.length
                  : getFilteredInnovations(c.id).length;
              return (
                <FilterChip
                  key={c.id}
                  label={c.short}
                  count={count}
                  active={activeCategory === c.id}
                  onClick={() => setActiveCategory(c.id)}
                />
              );
            })}
          </div>
        </section>

        {/* Editorial "paper" card hosting the innovation list */}
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
          {/* Column header row */}
          <div
            className="grid items-center px-8 py-2.5 text-[11px] font-bold uppercase tracking-[0.15em]"
            style={{
              gridTemplateColumns: '2.6fr 1.1fr 1.3fr 1.2fr 1.2fr 0.9fr',
              backgroundColor: S.surfaceLow,
              color: S.onSurfaceVariant,
            }}
          >
            <SortHeader label="Innovation"   sortKey="name"        currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
            <SortHeader label="Category"     sortKey="category"    currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
            <SortHeader label="Type"         sortKey="type"        currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
            <SortHeader label="Market Score" sortKey="marketScore" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
            <SortHeader label="Portfolio Fit" sortKey="fitScore"   currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
            <SortHeader label="Horizon"      sortKey="horizon"     currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} align="right" />
          </div>

          {/* Rows */}
          <div>
            {sorted.length === 0 && (
              <EmptyRow
                text="No innovations match the current filter."
                icon={<Sparkles size={20} />}
              />
            )}
            {sorted.map((innovation, idx) => (
              <InnovationRow
                key={innovation.id}
                innovation={innovation}
                isLast={idx === sorted.length - 1}
                onOpen={() => setSelectedInnovation(innovation)}
              />
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
};

// ─── Innovation row ──────────────────────────────────────────────────
const InnovationRow: FC<{
  innovation: Innovation;
  isLast: boolean;
  onOpen: () => void;
}> = ({ innovation, isLast, onOpen }) => {
  const tile = getCategoryTile(innovation);
  const { Icon } = tile;

  return (
    <div
      style={{
        boxShadow: isLast ? 'none' : `inset 0 -1px 0 ${S.surfaceLow}`,
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="w-full grid items-center px-8 py-2 text-left transition-colors hover:bg-[rgba(0,93,181,0.035)]"
        style={{
          gridTemplateColumns: '2.6fr 1.1fr 1.3fr 1.2fr 1.2fr 0.9fr',
          backgroundColor: S.surface,
          cursor: 'pointer',
          border: 'none',
        }}
      >
        {/* Innovation identity: icon tile + number + name (title-only, single line) */}
        <div className="flex items-center gap-3 min-w-0 pr-4">
          <div
            className="w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: tile.bg, color: tile.fg }}
          >
            <Icon size={16} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex items-center gap-2">
            <span
              style={{
                fontFamily: HEADLINE_FONT,
                fontSize: 11,
                fontWeight: 800,
                color: S.onSurfaceVariant,
                letterSpacing: '0.08em',
                flexShrink: 0,
              }}
            >
              {String(innovation.number).padStart(2, '0')}
            </span>
            <div
              className="font-bold text-[14px] truncate"
              style={{ fontFamily: HEADLINE_FONT, color: S.onSurface }}
              title={innovation.subtitle ? `${innovation.name} — ${innovation.subtitle}` : innovation.name}
            >
              {innovation.name}
            </div>
            <TierBadge level={innovation.tierLevel} />
          </div>
        </div>

        {/* Category short label */}
        <div
          className="text-[13px] font-semibold"
          style={{ color: S.onSurface }}
        >
          {innovation.categoryShort}
          <div
            className="text-[11px] font-medium"
            style={{ color: S.onSurfaceVariant }}
          >
            {innovation.categoryGroup}
          </div>
        </div>

        {/* Type pill */}
        <div>
          <TypePill type={innovation.type} label={innovation.typeLabel} />
        </div>

        {/* Market Score bar */}
        <div className="pr-4">
          <ScoreBar value={innovation.marketScore} tone="emerald" />
        </div>

        {/* Portfolio Fit bar */}
        <div className="pr-4">
          <ScoreBar value={innovation.fitScore} tone="purple" />
        </div>

        {/* Horizon */}
        <div className="text-right">
          <span
            className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide"
            style={{
              backgroundColor: S.surfaceLow,
              color: S.onSurfaceVariant,
            }}
          >
            {innovation.horizon}
          </span>
        </div>
      </button>
    </div>
  );
};

export default InnovationExplorer3;
