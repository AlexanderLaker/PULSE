/**
 * The Drivers page: the Profit Pool Drivers behind the Shift Matrix, with
 * their scores and evidence, the experts' proposals and the admin editor.
 *
 * One table in three modes (see "Scoring modes" below): Driver List shows the
 * scores that feed the model, Expert Rating collects each expert's proposal,
 * and Review & Endorse, for admins, sets the expert aggregate against the
 * baseline. Admins edit a driver in its expanded Driver List panel. The PRISM
 * Analysis card is read-only for every role.
 *
 * Visual language: tonal layering rather than borders, Manrope
 * headlines over Inter body text, pill filter chips, a force icon tile on
 * every row, dot scales for probability and exposure.
 */

'use client';

import React, { useMemo, useState, useCallback, type FC } from 'react';
import { motion } from 'framer-motion';
import { Search, Layers, AlertTriangle, ArrowUp, ArrowDown, ArrowUpDown, Info } from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import { CATEGORIES, HORIZON } from '@/lib/format';
import { S, SHADOW, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';
import type { Driver, DriverProposal } from '@/types';
import { EXPERT_COLOR, REVIEWED_COLOR, type ScoringMode } from './drivers/shared';
import { DriverRow, ROW_GRID } from './drivers/DriverRow';

// ─── Sort helpers ──────────────────────────────────────────────────
type SortKey = 'name' | 'direction' | 'probability' | 'gp1' | 'shift';
type SortDir = 'asc' | 'desc';

// The direction a column sorts in when first chosen: numbers biggest first,
// text A to Z.
const SORT_DEFAULT_DIR: Record<SortKey, SortDir> = {
  name:        'asc',
  direction:   'asc',
  probability: 'desc',
  gp1:         'desc',
  shift:       'desc',
};

function sortValue(d: Driver, key: SortKey): string | number {
  switch (key) {
    case 'name':        return d.name;
    case 'direction':   return d.direction;
    case 'probability': return d.probability;
    case 'gp1':         return d.gp1_pct_affected;
    case 'shift':       return d.normalized_score;
  }
}

// ═══════════════════════════════════════════════════════════════════
// Scoring modes
//
// One table in three modes; the layout stays, the cells and the expanded
// panel change:
//   list    the scores that feed the model, read-only. A score an admin has
//           changed from the driver's baseline shows in green; hover a score
//           for its baseline.
//   input   any signed-in expert scores a driver from a blank slate in the
//           expanded panel, with the baseline on hover; changes save as they
//           are made.
//   review  admins only: the expert aggregate against the baseline, with the
//           delta and who scored what. The admin endorses one driver at a
//           time, which writes the chosen values through the validated,
//           audited driver edit.
// The model reads only a driver's own scores. Proposals are advisory and are
// never applied on their own.
// ═══════════════════════════════════════════════════════════════════

// The mode toggle; Review & Endorse is for admins.
const ModeToggle: FC<{ mode: ScoringMode; onChange: (m: ScoringMode) => void; isAdmin: boolean }> = ({ mode, onChange, isAdmin }) => {
  const opts: Array<{ id: ScoringMode; label: string; dot: string }> = [
    { id: 'list', label: 'Driver List', dot: REVIEWED_COLOR },
    { id: 'rating', label: 'Expert Rating', dot: S.primary },
    ...(isAdmin ? [{ id: 'review' as ScoringMode, label: 'Review & Endorse', dot: EXPERT_COLOR }] : []),
  ];
  return (
    <div role="tablist" aria-label="Scoring mode" style={{
      display: 'inline-flex', gap: 4, padding: 5, borderRadius: 999, backgroundColor: S.surface, border: `1px solid ${S.cardBorder}`,
    }}>
      {opts.map((o) => {
        const active = mode === o.id;
        return (
          <button type="button" key={o.id} role="tab" aria-selected={active} onClick={() => onChange(o.id)}
            className="inline-flex items-center gap-2 transition-colors"
            style={{
              padding: '9px 18px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontFamily: HEADLINE_FONT, fontSize: 13, fontWeight: 700,
              backgroundColor: active ? S.primary : 'transparent', color: active ? S.onPrimary : S.onSurfaceVariant,
            }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: active ? S.onPrimary : o.dot }} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
};

// ─── The page ──────────────────────────────────────────────────────
/** A search another view opens the page with; `seq` goes up with every
 *  opening, so opening the same driver twice counts twice. */
export interface DriverSearch {
  query: string;
  seq: number;
}

interface DriversProps {
  /** A search to apply on arrival: the drill-through from the Consumer
   *  Journey and the Shift Analysis hands down a driver name. */
  search?: DriverSearch | null;
  /** Admins get the driver editor and the Review & Endorse mode. */
  isAdmin?: boolean;
}

const Drivers: FC<DriversProps> = ({ search: opened, isAdmin = false }) => {
  const { drivers, driversError, loading, backendAvailable, updateDriver, reload } = usePrism();
  // The category a driver must be exposed to, by its API name; null shows all.
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [search, setSearch] = useState(opened?.query ?? '');

  // Adopt a drill-through whenever a new one arrives: its query replaces the
  // search and the category filter is cleared, so the driver is never hidden
  // by a filter left from an earlier visit. Adjusted during render against
  // the last one adopted, so the list is already filtered in the pass that
  // follows the navigation.
  const [adoptedSeq, setAdoptedSeq] = useState(opened?.seq ?? 0);
  if (opened && opened.seq !== adoptedSeq) {
    setAdoptedSeq(opened.seq);
    setSearch(opened.query);
    setCategoryFilter(null);
  }
  // The driver whose row is expanded.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [mode, setMode] = useState<ScoringMode>('list');
  // Review & Endorse is for admins. The rule is applied during render rather
  // than corrected after the commit, so the toggle never paints a mode the
  // user may not use.
  if (!isAdmin && mode === 'review') setMode('list');

  // Each driver's "my proposal", kept live so a collapsed row shows what the
  // expert just entered in the Expert Rating panel (the driver list carries
  // the proposal as of its load). Seeded during render whenever the store
  // hands down a new drivers array, with `seededFrom` holding the array last
  // seeded from; entries already in the map, the live edits, always win.
  const [myMap, setMyMap] = useState<Record<string, DriverProposal>>({});
  const [seededFrom, setSeededFrom] = useState(drivers);
  const seedMyMap = (prev: Record<string, DriverProposal>) => {
    let changed = false;
    const next = { ...prev };
    for (const d of drivers) {
      const m = d.proposal_summary.my;
      if (next[d.id] === undefined && m) { next[d.id] = m; changed = true; }
    }
    return changed ? next : prev;
  };
  if (seededFrom !== drivers) {
    setSeededFrom(drivers);
    setMyMap(seedMyMap);
  }
  const setMyProposal = useCallback((driverId: string, my: DriverProposal) => {
    setMyMap((prev) => ({ ...prev, [driverId]: my }));
  }, []);

  // Sort state: no key keeps the API's order. Clicking a header sorts by that
  // column, clicking it again flips the direction, and a different column
  // starts from its own default direction.
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

  const filtered = useMemo<Driver[]>(() => {
    const q = search.trim().toLowerCase();
    return drivers.filter((d) => {
      if (categoryFilter != null && (d.category_exposure[categoryFilter] ?? 0) <= 0) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.force.toLowerCase().includes(q)
      );
    });
  }, [drivers, categoryFilter, search]);

  // The sort applies on top of the filter; without a sort key the API's order
  // (by driver id, which groups the forces) stays.
  const sorted = useMemo<Driver[]>(() => {
    if (!sortKey) return filtered;
    const cmp = (a: Driver, b: Driver): number => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      const order = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).toLowerCase().localeCompare(String(bv).toLowerCase());
      return sortDir === 'asc' ? order : -order;
    };
    return [...filtered].sort(cmp);
  }, [filtered, sortKey, sortDir]);

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: S.bg, color: S.onBg, fontFamily: BODY_FONT }}
    >
      <main className="max-w-[1440px] mx-auto px-8 py-10">
        {/* Editorial header with the insight-rail accent */}
        <header className="mb-8 flex items-start justify-between gap-8">
          <div
            className="pl-5"
            style={{ borderLeft: `4px solid ${S.primary}` }}
          >
            <div
              className="text-xs font-semibold uppercase tracking-[0.18em] mb-2"
              style={{ color: S.onSurfaceVariant }}
            >
              Drivers
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
              {drivers.length ? `The ${drivers.length} Profit Pool Drivers` : 'The Profit Pool Drivers'} behind each category&apos;s
              shift to {HORIZON}.
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
              placeholder="Search drivers…"
              className="w-full pl-11 pr-4 py-2.5 rounded-full text-sm focus:outline-none focus:ring-2"
              style={{
                backgroundColor: S.surfaceLow,
                color: S.onSurface,
                border: 'none',
              }}
            />
          </div>
        </header>

        {/* Scoring mode toggle and what the mode shows */}
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <ModeToggle mode={mode} onChange={setMode} isAdmin={isAdmin} />
          <p style={{ fontSize: 13, color: S.onSurfaceVariant, maxWidth: '42rem', lineHeight: 1.5 }}>
            {mode === 'list'
              ? 'The scores that feed the model. Scores an admin has changed from the baseline show in green; hover a score for its baseline.'
              : mode === 'rating'
              ? 'Score any driver from a blank slate: open a row and your changes auto-save. Hover a grey dot or blank field to see the baseline.'
              : 'Compare the expert average with the baseline and endorse one driver at a time. Hover an expert score to see who scored what.'}
          </p>
        </div>

        {/* Category filter chips */}
        <section className="mb-8">
          <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            <FilterChip
              label="All"
              active={categoryFilter == null}
              onClick={() => setCategoryFilter(null)}
            />
            {CATEGORIES.map((c) => (
              <FilterChip
                key={c.name}
                label={c.short}
                active={categoryFilter === c.name}
                onClick={() => setCategoryFilter(c.name)}
              />
            ))}
          </div>
        </section>

        {/* Editorial "paper" card holding the driver list */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-2xl overflow-hidden"
          style={{
            backgroundColor: S.surface,
            boxShadow: SHADOW.card,
          }}
        >
          {/* Column header: every column sorts */}
          <div
            className="grid items-center px-8 py-2.5 text-[11px] font-bold uppercase tracking-[0.15em]"
            style={{
              gridTemplateColumns: ROW_GRID[mode],
              backgroundColor: S.surfaceLow,
              color: S.onSurfaceVariant,
            }}
          >
            <SortHeader label="Driver"          sortKey="name"        currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
            <SortHeader label="Direction"      sortKey="direction"   currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
            <SortHeader label="Probability"    sortKey="probability" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
            <span className="inline-flex items-center justify-end w-full">
              <SortHeader label="GP1 % Affected" sortKey="gp1"         currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} align="right" />
              <Gp1InfoTip />
            </span>
            <SortHeader label="Shift"          sortKey="shift"       currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} align="right" />
            <span className="inline-flex items-center justify-end w-full text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: S.onSurfaceVariant }}>
              {mode === 'rating' ? 'Your review' : mode === 'review' ? 'Proposals' : 'Edited'}
            </span>
          </div>

          {/* Rows */}
          <div>
            {loading && drivers.length === 0 && (
              <EmptyRow text="Loading drivers…" icon={<Layers size={20} />} />
            )}
            {!loading && !backendAvailable && drivers.length === 0 && (
              <EmptyRow text="The PRISM service cannot be reached; the drivers show once it answers." icon={<AlertTriangle size={20} />} />
            )}
            {!loading && backendAvailable && driversError && drivers.length === 0 && (
              <EmptyRow text={`The drivers could not be loaded: ${driversError}`} icon={<AlertTriangle size={20} />}
                action={{ label: 'Try again', onClick: () => { void reload(); } }} />
            )}
            {!loading && drivers.length > 0 && sorted.length === 0 && (
              <EmptyRow text="No drivers match the current search and filter." icon={<Search size={20} />}
                action={{ label: 'Clear search and filter', onClick: () => { setSearch(''); setCategoryFilter(null); } }} />
            )}
            {sorted.map((d, idx) => {
              const expanded = expandedId === d.id;
              return (
                <DriverRow
                  key={d.id}
                  driver={d}
                  isLast={idx === sorted.length - 1}
                  expanded={expanded}
                  onToggle={() => setExpandedId(expanded ? null : d.id)}
                  mode={mode}
                  myProposal={myMap[d.id]}
                  onMyChange={setMyProposal}
                  isAdmin={isAdmin}
                  updateDriver={updateDriver}
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
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className="flex-shrink-0 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 hover:scale-[0.97]"
    style={{
      backgroundColor: active ? S.primaryContainer : S.surfaceLow,
      color:           active ? S.onPrimaryContainer : S.onSurfaceVariant,
    }}
  >
    {label}
  </button>
);

// ─── Sort header: a clickable column header with its sort direction ──
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
      // aria-sort is valid only on a column header, and this header row is a
      // CSS grid rather than a table, so the sort state is in the name.
      aria-label={`Sort by ${label}${isActive ? `, currently ${currentDir === 'asc' ? 'ascending' : 'descending'}` : ''}`}
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

// ─── GP1 column header tooltip ─────────────────────────────────────
const Gp1InfoTip: FC = () => {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button type="button" aria-label="What does GP1 % Affected mean?"
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', padding: 0, marginLeft: 6,
          color: S.onSurfaceVariant, cursor: 'help' }}>
        <Info size={11} strokeWidth={2.4} />
      </button>
      {open && (
        <span role="tooltip" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 40,
          width: 280, padding: '10px 12px', borderRadius: 8, backgroundColor: S.onSurface, color: S.surface,
          fontFamily: BODY_FONT, fontSize: 11.5, lineHeight: 1.5, fontWeight: 500, textTransform: 'none',
          letterSpacing: 0, textAlign: 'left', boxShadow: SHADOW.tip,
          pointerEvents: 'none', whiteSpace: 'normal' }}>
          <b>GP1 % Affected</b>: the share of a category&apos;s GP1 (gross profit after cost of goods)
          that this driver can realistically move at full materialisation. Multiplied by probability and
          direction, it produces the Shift column.
        </span>
      )}
    </span>
  );
};

// ─── Empty and loading row ─────────────────────────────────────────
const EmptyRow: FC<{ text: string; icon: React.ReactNode; action?: { label: string; onClick: () => void } }> = ({
  text, icon, action,
}) => (
  <div
    className="px-8 py-16 flex flex-col items-center justify-center gap-3"
    style={{ color: S.onSurfaceVariant }}
  >
    <div style={{ color: S.primary }}>{icon}</div>
    <div className="text-sm">{text}</div>
    {action && (
      <button type="button" onClick={action.onClick} style={{
        padding: '7px 16px', borderRadius: 999, border: `1px solid ${S.cardBorder}`, background: S.surface,
        color: S.primary, fontFamily: HEADLINE_FONT, fontSize: 12, fontWeight: 700, cursor: 'pointer',
      }}>
        {action.label}
      </button>
    )}
  </div>
);

export default Drivers;
