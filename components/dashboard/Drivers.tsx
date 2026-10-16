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
 * The address bar carries the page's state (hooks/useViewUrl.tsx): the mode,
 * the expanded driver, the search and the force and category filters, so a
 * driver can be linked and Back returns to the list as it was.
 *
 * Visual language: tonal layering rather than borders, Manrope
 * headlines over Inter body text, pill filter chips, a force icon tile on
 * every row, dot scales for probability and exposure.
 */

'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback, type FC } from 'react';
import { motion } from 'framer-motion';
import { Search, Layers, AlertTriangle, ArrowUp, ArrowDown, ArrowUpDown, Info, Download } from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import useOverlay from '@/hooks/useOverlay';
import { useViewParams } from '@/hooks/useViewUrl';
import { sessionEnding } from '@/lib/session';
import { CATEGORIES, FORCES, FORCE_COLORS, HORIZON } from '@/lib/format';
import { S, SHADOW, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';
import type { Driver, DriverProposal, ForceName } from '@/types';
import { EXPERT_COLOR, REVIEWED_COLOR, driverCode, isRated, type ScoringMode } from './drivers/shared';
import { FIELD_HELP } from './drivers/cards';
import { DriverRow, LAST_COLUMN_LABEL, ROW_GRID } from './drivers/DriverRow';
import { downloadText, safeFilename } from '@/lib/exportCsv';
import { categoryChipLabel, driversCsvText } from './drivers/driversCsv';

// ─── Sort helpers ──────────────────────────────────────────────────
type SortKey = 'name' | 'direction' | 'probability' | 'gp1' | 'effect';
type SortDir = 'asc' | 'desc';

// The direction a column sorts in when first chosen: numbers biggest first,
// text A to Z.
const SORT_DEFAULT_DIR: Record<SortKey, SortDir> = {
  name:        'asc',
  direction:   'asc',
  probability: 'desc',
  gp1:         'desc',
  effect:      'desc',
};

const SORT_LABELS: Record<SortKey, string> = {
  name: 'Driver', direction: 'Direction', probability: 'Probability', gp1: 'GP1 % affected', effect: 'Expected effect',
};

/** The options of the compact "Sort by" select (below xl): the base order,
 *  then each column in both directions. */
const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Base order' },
  { value: 'name:asc', label: 'Driver, A to Z' },
  { value: 'name:desc', label: 'Driver, Z to A' },
  { value: 'direction:asc', label: 'Direction, contraction first' },
  { value: 'direction:desc', label: 'Direction, expansion first' },
  { value: 'probability:desc', label: 'Probability, high to low' },
  { value: 'probability:asc', label: 'Probability, low to high' },
  { value: 'gp1:desc', label: 'GP1 % affected, high to low' },
  { value: 'gp1:asc', label: 'GP1 % affected, low to high' },
  { value: 'effect:desc', label: 'Expected effect, high to low' },
  { value: 'effect:asc', label: 'Expected effect, low to high' },
];

function sortValue(d: Driver, key: SortKey): string | number {
  switch (key) {
    case 'name':        return d.name;
    case 'direction':   return d.direction;
    case 'probability': return d.probability;
    case 'gp1':         return d.gp1_pct_affected;
    case 'effect':      return d.expected_effect;
  }
}

const isForce = (v: string | undefined): v is ForceName => v != null && (FORCES as string[]).includes(v);
const isMode = (v: string | undefined): v is ScoringMode => v === 'list' || v === 'rating' || v === 'review';

// ═══════════════════════════════════════════════════════════════════
// Scoring modes
//
// One table in three modes; the layout stays, the cells and the expanded
// panel change:
//   list    the scores that feed the model, read-only. A score an admin has
//           changed from the driver's baseline shows in green; hover a score
//           for its baseline.
//   rating  any expert, viewer or admin, scores a driver from a blank slate
//           in the expanded panel, with the baseline marked; changes save
//           as they are made.
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
    <div role="tablist" aria-label="Scoring mode" data-print-hide className="inline-flex flex-wrap" style={{
      gap: 4, padding: 5, borderRadius: 999, backgroundColor: S.surface, border: `1px solid ${S.cardBorder}`,
    }}>
      {opts.map((o) => {
        const active = mode === o.id;
        return (
          <button type="button" key={o.id} role="tab" aria-selected={active} onClick={() => onChange(o.id)}
            className="inline-flex items-center gap-2 transition-colors"
            style={{
              padding: '9px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
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

/** What the page would unmount while an editor holds unsaved edits. */
type PendingAction =
  | { kind: 'toggle'; id: string | null }
  | { kind: 'mode'; mode: ScoringMode }
  /** Back, Forward or a drill-through moved the address away from the dirty editor. */
  | { kind: 'address'; driver: string | null; mode: ScoringMode };

/** How long the search waits before it reaches the address bar. */
const SEARCH_URL_DELAY_MS = 300;

const Drivers: FC<DriversProps> = ({ search: opened, isAdmin = false }) => {
  const { drivers, driversError, databaseFailure, loading, apiAvailable, updateDriver, reload } = usePrism();
  const [params, setParams] = useViewParams('drivers');
  const allowedMode = useCallback(
    (m: string | undefined): ScoringMode => (isMode(m) && (m !== 'review' || isAdmin) ? m : 'list'),
    [isAdmin]);
  // The address as it stands: the state the page adopts on mount and again
  // whenever the address changes under it (Back, Forward, a pasted link).
  const urlDriver = params.driver ?? null;
  const urlMode = allowedMode(params.mode);
  const urlQ = params.q ?? '';
  const urlForce: ForceName | null = isForce(params.force) ? params.force : null;
  const urlCategory = params.category ?? null;

  // The category a driver must be exposed to, by its API name; null shows all.
  const [categoryFilter, setCategoryFilter] = useState<string | null>(opened ? null : urlCategory);
  const [forceFilter, setForceFilter] = useState<ForceName | null>(opened ? null : urlForce);
  const [search, setSearch] = useState(opened?.query ?? urlQ);
  // In Expert Rating: show only the drivers not yet rated.
  const [notRatedOnly, setNotRatedOnly] = useState(false);
  // The driver whose row is expanded.
  const [expandedId, setExpandedId] = useState<string | null>(urlDriver);
  const [mode, setMode] = useState<ScoringMode>(urlMode);
  // Review & Endorse is for admins. The rule is applied during render rather
  // than corrected after the commit, so the toggle never paints a mode the
  // user may not use.
  if (!isAdmin && mode === 'review') setMode('list');

  // Adopt a drill-through whenever a new one arrives: its query replaces the
  // search and the filters are cleared, so the driver is never hidden by a
  // filter left from an earlier visit. Adjusted during render against the
  // last one adopted, so the list is already filtered in the pass that
  // follows the navigation.
  const [adoptedSeq, setAdoptedSeq] = useState(opened?.seq ?? 0);
  if (opened && opened.seq !== adoptedSeq) {
    setAdoptedSeq(opened.seq);
    setSearch(opened.query);
    setCategoryFilter(null);
    setForceFilter(null);
  }
  // The setter as of the latest render, for the effects below: its identity
  // follows the address, and neither effect should run again for that.
  const setParamsRef = useRef(setParams);
  useEffect(() => { setParamsRef.current = setParams; });
  // The address follows the drill-through: the filters it cleared leave it too.
  const openedSeq = opened?.seq;
  useEffect(() => {
    if (openedSeq != null) setParamsRef.current({ category: null, force: null });
  }, [openedSeq]);

  // ── Unsaved edits: the editors that hold some, and the action waiting on
  //    the admin's answer before it unmounts one. The editor is in the Driver
  //    List panel, so only that mode can hold one. ──
  const [dirtyIds, setDirtyIds] = useState<ReadonlySet<string>>(() => new Set());
  const onDirtyChange = useCallback((driverId: string, dirty: boolean) => {
    setDirtyIds((prev) => {
      if (prev.has(driverId) === dirty) return prev;
      const next = new Set(prev);
      if (dirty) next.add(driverId); else next.delete(driverId);
      return next;
    });
  }, []);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const editorDirty = expandedId != null && mode === 'list' && dirtyIds.has(expandedId);

  // The address changed under the page: adopt what differs from what it last
  // saw. The page's own writes arrive here too and change nothing: the search
  // is written only after typing has paused, with the value the field holds.
  // A change that would unmount a dirty editor (another driver, no driver,
  // another mode) waits for the admin's answer instead; meanwhile the
  // address is written back to the editor (the effect below).
  const [seen, setSeen] = useState({ driver: urlDriver, mode: urlMode, q: urlQ, force: urlForce, category: urlCategory });
  if (seen.driver !== urlDriver || seen.mode !== urlMode) {
    setSeen((prev) => ({ ...prev, driver: urlDriver, mode: urlMode }));
    if (editorDirty && (urlDriver !== expandedId || urlMode !== 'list')) {
      setPending({ kind: 'address', driver: urlDriver, mode: urlMode });
    } else {
      if (urlDriver !== expandedId) setExpandedId(urlDriver);
      if (urlMode !== mode) setMode(urlMode);
    }
  }
  if (seen.q !== urlQ) {
    setSeen((prev) => ({ ...prev, q: urlQ }));
    setSearch(urlQ);
  }
  if (seen.force !== urlForce) {
    setSeen((prev) => ({ ...prev, force: urlForce }));
    setForceFilter(urlForce);
  }
  if (seen.category !== urlCategory) {
    setSeen((prev) => ({ ...prev, category: urlCategory }));
    setCategoryFilter(urlCategory);
  }
  // The search reaches the address after a pause in typing.
  useEffect(() => {
    const t = setTimeout(() => { setParamsRef.current({ q: search || null }); }, SEARCH_URL_DELAY_MS);
    return () => clearTimeout(t);
  }, [search]);
  // While the admin decides, the address names the editor they are still in
  // (again after every further change of address, hence keyed on `pending`).
  useEffect(() => {
    if (pending?.kind === 'address') setParamsRef.current({ driver: expandedId, mode: null });
  }, [pending, expandedId]);

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
  const myProposalOf = useCallback(
    (d: Driver): DriverProposal | null | undefined => myMap[d.id] ?? d.proposal_summary.my,
    [myMap]);

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

  // Whether a driver passes the search and the filters.
  const matches = useCallback((d: Driver): boolean => {
    const q = search.trim().toLowerCase();
    if (forceFilter != null && d.force !== forceFilter) return false;
    if (categoryFilter != null && d.category_exposure[categoryFilter] === 0) return false;
    if (mode === 'rating' && notRatedOnly && isRated(myProposalOf(d))) return false;
    if (!q) return true;
    return (
      d.name.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q) ||
      d.force.toLowerCase().includes(q) ||
      (driverCode(d)?.toLowerCase().includes(q) ?? false)
    );
  }, [search, forceFilter, categoryFilter, mode, notRatedOnly, myProposalOf]);

  // The open row stays in the list while it is in use, whatever the filter
  // says: the driver being scored under "Not rated" would otherwise vanish
  // the moment its first scores make it rated, and an editor with unsaved
  // edits would be unmounted by a search without the question below.
  const pinnedId = expandedId != null && ((mode === 'rating' && notRatedOnly) || editorDirty) ? expandedId : null;
  const filtered = useMemo<Driver[]>(
    () => drivers.filter((d) => d.id === pinnedId || matches(d)),
    [drivers, pinnedId, matches]);

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

  // The rating progress, over every driver.
  const ratedCount = useMemo(() => drivers.filter((d) => isRated(myProposalOf(d))).length, [drivers, myProposalOf]);

  // Where "Next unrated" scrolls once the rows have settled (see openNextUnrated).
  const scrollAfterExit = useRef<string | null>(null);
  const scrollAfterCommit = useRef<string | null>(null);

  // ── The question before an action drops unsaved edits ──
  const dirtyDriver = editorDirty ? drivers.find((d) => d.id === expandedId) ?? null : null;
  // A save that lands while the question is open takes its reason away: the
  // question goes, and the admin's next action is their own.
  if (pending != null && dirtyDriver == null) setPending(null);
  const asking = pending != null && dirtyDriver != null;
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const keepEditing = useCallback(() => setPending(null), []);
  useOverlay(asking, keepEditing, dialogRef);
  // Leaving the page with unsaved edits asks first; not while the session is
  // ending (sign out, or a session that expired), when staying would protect
  // nothing.
  const hasDirty = dirtyIds.size > 0;
  useEffect(() => {
    if (!hasDirty) return undefined;
    const warn = (e: BeforeUnloadEvent) => { if (!sessionEnding()) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasDirty]);

  const applyToggle = (id: string | null) => {
    setExpandedId(id);
    setParams({ driver: id });
  };
  const applyMode = (m: ScoringMode) => {
    setMode(m);
    setParams({ mode: m === 'list' ? null : m });
  };
  // A toggle or a mode change that would unmount a dirty editor waits for the
  // admin's answer.
  const requestToggle = (id: string | null) => {
    // The admin's own click outranks a scroll still waiting on a collapse.
    scrollAfterExit.current = null;
    if (dirtyDriver) { setPending({ kind: 'toggle', id }); return; }
    applyToggle(id);
  };
  const requestMode = (m: ScoringMode) => {
    if (m === mode) return;
    if (dirtyDriver) { setPending({ kind: 'mode', mode: m }); return; }
    applyMode(m);
  };
  const discardAndContinue = () => {
    const action = pending;
    setPending(null);
    if (!action) return;
    if (action.kind === 'toggle') applyToggle(action.id);
    else if (action.kind === 'mode') applyMode(action.mode);
    else {
      setExpandedId(action.driver);
      setMode(action.mode);
      setParams({ driver: action.driver, mode: action.mode === 'list' ? null : action.mode });
    }
  };

  // Expert Rating: the next unrated driver after the open one, in the list's
  // order, wrapping round to the top; opening it brings its row into view.
  const nextUnratedId = useMemo<string | null>(() => {
    if (mode !== 'rating' || expandedId == null) return null;
    const i = sorted.findIndex((d) => d.id === expandedId);
    const after = i < 0 ? sorted : [...sorted.slice(i + 1), ...sorted.slice(0, i)];
    return after.find((d) => d.id !== expandedId && !isRated(myProposalOf(d)))?.id ?? null;
  }, [mode, expandedId, sorted, myProposalOf]);
  // The row comes to the top of the viewport, under the sticky top bar.
  const scrollToRow = (id: string) => {
    const row = document.getElementById(`driver-row-${id}`);
    if (!row) return;
    const top = row.getBoundingClientRect().top + window.scrollY - 88;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    window.scrollTo({ top: Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' });
  };
  // The next row is scrolled to once the rows have settled: after the open
  // panel has collapsed when its row stays in the list (onPanelExit), or
  // after the commit when the row leaves the list (it is rated and "Not
  // rated" is on), as nothing then animates.
  useEffect(() => {
    const id = scrollAfterCommit.current;
    if (id == null) return;
    scrollAfterCommit.current = null;
    scrollToRow(id);
  }, [expandedId]);
  const onPanelExit = useCallback(() => {
    const id = scrollAfterExit.current;
    if (id == null) return;
    scrollAfterExit.current = null;
    scrollToRow(id);
  }, []);
  const openNextUnrated = () => {
    if (!nextUnratedId || expandedId == null) return;
    const current = drivers.find((d) => d.id === expandedId);
    const currentStays = current != null && matches(current);
    if (currentStays) scrollAfterExit.current = nextUnratedId;
    else scrollAfterCommit.current = nextUnratedId;
    applyToggle(nextUnratedId);
  };

  const clearAll = () => {
    setSearch('');
    setCategoryFilter(null);
    setForceFilter(null);
    setNotRatedOnly(false);
    setParams({ q: null, category: null, force: null });
  };
  const filterActive = search.trim() !== '' || categoryFilter != null || forceFilter != null || (mode === 'rating' && notRatedOnly);
  const countText = filterActive
    ? `${sorted.length} of ${drivers.length} ${drivers.length === 1 ? 'driver' : 'drivers'}`
    : `${drivers.length} ${drivers.length === 1 ? 'driver' : 'drivers'}`;

  const exportCsv = () => {
    const parts: string[] = [];
    if (search.trim()) parts.push(`search "${search.trim()}"`);
    if (forceFilter) parts.push(`force ${forceFilter}`);
    if (categoryFilter) {
      const c = CATEGORIES.find((x) => x.name === categoryFilter);
      parts.push(`category ${c ? categoryChipLabel(c) : categoryFilter}`);
    }
    if (mode === 'rating' && notRatedOnly) parts.push('not rated only');
    const order = sortKey
      ? `sorted by ${SORT_LABELS[sortKey].toLowerCase()}, ${sortDir === 'asc' ? 'ascending' : 'descending'}`
      : 'in the base order';
    const filterText = `Filter: ${parts.length ? parts.join('; ') : 'none'}; ${order}`;
    const now = new Date();
    downloadText(safeFilename(`prism-drivers-${now.toISOString().slice(0, 10)}`, 'csv'), driversCsvText(sorted, filterText, now));
  };

  const sortSelectValue = sortKey ? `${sortKey}:${sortDir}` : '';
  const onSortSelect = (value: string) => {
    if (!value) { setSortKey(null); return; }
    const [key, dir] = value.split(':') as [SortKey, SortDir];
    setSortKey(key);
    setSortDir(dir);
  };

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: S.bg, color: S.onBg, fontFamily: BODY_FONT }}
    >
      <main className="max-w-[1440px] mx-auto px-4 md:px-8 py-6 md:py-10">
        {/* Editorial header with the insight-rail accent */}
        <header className="mb-8 flex flex-col md:flex-row md:items-start md:justify-between gap-6 md:gap-8">
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
              className="font-extrabold tracking-tight text-[1.75rem] md:text-[2.5rem]"
              style={{
                fontFamily: HEADLINE_FONT,
                color: S.onBg,
                lineHeight: 1.1,
              }}
            >
              What Moves HCB&rsquo;s Profit Pools
            </h1>
            <p
              className="mt-2 max-w-2xl text-[15px]"
              style={{ color: S.onSurfaceVariant, lineHeight: 1.55 }}
            >
              {drivers.length ? `The ${drivers.length} Profit Pool Drivers` : 'The Profit Pool Drivers'} behind each category&apos;s
              shift to {HORIZON}.
            </p>
          </div>

          {/* Search, the result count, Clear and the export */}
          <div className="w-full md:max-w-xs flex flex-col gap-2 md:items-end">
            <div className="relative w-full" data-print-hide>
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2"
                style={{ color: S.onSurfaceVariant }}
              />
              <input
                type="search"
                aria-label="Search drivers"
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
            <div className="flex items-center gap-3 flex-wrap px-1" style={{ fontSize: 12, color: S.onSurfaceVariant }}>
              <span style={{ fontWeight: 700 }}>{countText}</span>
              {filterActive && (
                <button type="button" onClick={clearAll} data-print-hide style={{
                  background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                  color: S.primary, fontWeight: 700, fontSize: 12, textDecoration: 'underline', minHeight: 24,
                }}>
                  Clear
                </button>
              )}
              <button type="button" onClick={exportCsv} data-print-hide disabled={sorted.length === 0}
                className="inline-flex items-center gap-1.5"
                style={{
                  padding: '4px 12px', borderRadius: 999, border: `1px solid ${S.cardBorder}`,
                  background: S.surface, color: S.primary, fontFamily: HEADLINE_FONT, fontSize: 11, fontWeight: 700,
                  cursor: sorted.length === 0 ? 'not-allowed' : 'pointer', opacity: sorted.length === 0 ? 0.5 : 1, minHeight: 24,
                }}>
                <Download size={12} strokeWidth={2.4} aria-hidden />
                Export CSV
              </button>
            </div>
          </div>
        </header>

        {/* Scoring mode toggle and what the mode shows; in Expert Rating, the progress */}
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <ModeToggle mode={mode} onChange={requestMode} isAdmin={isAdmin} />
          {mode === 'rating' ? (
            <div className="flex items-center gap-3 flex-wrap" style={{ fontSize: 13, color: S.onSurfaceVariant }}>
              <span role="status" style={{ fontWeight: 700 }}>
                {ratedCount} of {drivers.length} rated
              </span>
              <FilterChip label="Not rated" active={notRatedOnly} onClick={() => setNotRatedOnly((v) => !v)} />
              <span className="hidden sm:inline">Open a row to score it; changes save as you make them.</span>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: S.onSurfaceVariant, maxWidth: '42rem', lineHeight: 1.5 }}>
              {mode === 'list'
                ? 'The scores that feed the model. Scores an admin has changed from the baseline show in green; hover a score for its baseline.'
                : 'Compare the expert mean with the baseline and endorse one driver at a time. Who scored what is listed under each driver.'}
            </p>
          )}
        </div>

        {/* Filter chips: the force, then the category */}
        <section className="mb-8 flex flex-col gap-2" data-print-hide>
          <div role="group" aria-label="Filter by force" className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            <FilterChip label="All" active={forceFilter == null} onClick={() => { setForceFilter(null); setParams({ force: null }); }} />
            {FORCES.map((f) => (
              <FilterChip
                key={f}
                label={f}
                dot={FORCE_COLORS[f]}
                active={forceFilter === f}
                onClick={() => { setForceFilter(f); setParams({ force: f }); }}
              />
            ))}
          </div>
          <div role="group" aria-label="Filter by category" className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            <FilterChip
              label="All"
              active={categoryFilter == null}
              onClick={() => { setCategoryFilter(null); setParams({ category: null }); }}
            />
            {CATEGORIES.map((c) => (
              <FilterChip
                key={c.name}
                label={categoryChipLabel(c)}
                active={categoryFilter === c.name}
                onClick={() => { setCategoryFilter(c.name); setParams({ category: c.name }); }}
              />
            ))}
          </div>
        </section>

        {/* A reload that fails keeps the drivers as last loaded, perhaps from
            before the latest save. While the database cannot be used, the
            service notice says so for every view. */}
        {apiAvailable && !databaseFailure && driversError && drivers.length > 0 && (
          <div role="status" className="mb-4 px-5 py-2.5 rounded-xl flex items-center gap-2.5 text-[13px]"
            style={{ backgroundColor: S.amberContainer, color: S.onAmberContainer, lineHeight: 1.5 }}>
            <AlertTriangle size={15} strokeWidth={2.4} style={{ flexShrink: 0 }} />
            <span className="flex-1">
              The drivers could not be reloaded: {driversError}. The list shows them as they were last loaded.
            </span>
            <button type="button" onClick={() => { void reload(); }} style={{
              padding: '5px 14px', borderRadius: 999, border: `1px solid ${S.onAmberContainer}`,
              background: 'transparent', color: S.onAmberContainer, fontFamily: HEADLINE_FONT,
              fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
            }}>
              Try again
            </button>
          </div>
        )}

        {/* Below xl the column header is gone: a compact sort control instead */}
        <div className="xl:hidden mb-3 flex items-center justify-end gap-2" data-print-hide>
          <label className="inline-flex items-center gap-2" style={{ fontSize: 12, fontWeight: 700, color: S.onSurfaceVariant }}>
            Sort by
            <select value={sortSelectValue} onChange={(e) => onSortSelect(e.target.value)} style={{
              padding: '6px 10px', borderRadius: 8, border: `1px solid ${S.cardBorder}`,
              backgroundColor: S.surface, color: S.onSurface, fontSize: 12, fontWeight: 600,
            }}>
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>

        {/* Editorial "paper" card holding the driver list. Clipped, not
            hidden, so the editor's sticky bar can stick to the viewport. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          role="table"
          aria-label="Profit Pool Drivers"
          className="rounded-2xl overflow-clip"
          style={{
            backgroundColor: S.surface,
            boxShadow: SHADOW.card,
          }}
        >
          {/* Column header, from xl: every column but the last sorts */}
          <div role="rowgroup" className="hidden xl:block">
            <div
              role="row"
              className="grid items-center gap-x-3 px-8 py-2.5 text-[11px] font-bold uppercase tracking-[0.15em]"
              style={{
                gridTemplateColumns: ROW_GRID[mode],
                backgroundColor: S.surfaceLow,
                color: S.onSurfaceVariant,
              }}
            >
              <SortHeader label="Driver"          sortKey="name"        currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
              <SortHeader label="Direction"      sortKey="direction"   currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
              <SortHeader label="Probability"    sortKey="probability" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
              <SortHeader label="GP1 % affected" sortKey="gp1"         currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} align="right"
                extra={<Gp1InfoTip />} />
              <SortHeader label="Expected effect" sortKey="effect"     currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} align="right" />
              <div role="columnheader" className="inline-flex items-center justify-end w-full text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: S.onSurfaceVariant }}>
                {LAST_COLUMN_LABEL[mode]}
              </div>
            </div>
          </div>

          {/* Rows */}
          <div role="rowgroup">
            {loading && drivers.length === 0 && (
              <EmptyRow text="Loading drivers…" icon={<Layers size={20} />} status />
            )}
            {!loading && !apiAvailable && drivers.length === 0 && (
              <EmptyRow text="The PRISM service cannot be reached; the drivers show once it answers." icon={<AlertTriangle size={20} />} />
            )}
            {!loading && apiAvailable && driversError && drivers.length === 0 && (
              <EmptyRow text={`The drivers could not be loaded: ${driversError}`} icon={<AlertTriangle size={20} />}
                action={{ label: 'Try again', onClick: () => { void reload(); } }} />
            )}
            {!loading && drivers.length > 0 && sorted.length === 0 && (
              <EmptyRow text="No drivers match the current search and filter." icon={<Search size={20} />}
                action={{ label: 'Clear search and filter', onClick: clearAll }} />
            )}
            {sorted.map((d, idx) => {
              const expanded = expandedId === d.id;
              return (
                <DriverRow
                  key={d.id}
                  driver={d}
                  isLast={idx === sorted.length - 1}
                  expanded={expanded}
                  onToggle={() => requestToggle(expanded ? null : d.id)}
                  mode={mode}
                  myProposal={myMap[d.id]}
                  onMyChange={setMyProposal}
                  isAdmin={isAdmin}
                  updateDriver={updateDriver}
                  onDirtyChange={onDirtyChange}
                  onPanelExit={onPanelExit}
                  nextUnrated={expanded && mode === 'rating' ? {
                    id: nextUnratedId,
                    reason: nextUnratedId ? null : 'Every other driver in this list is rated',
                    go: openNextUnrated,
                  } : undefined}
                />
              );
            })}
          </div>
        </motion.div>
      </main>

      {/* The question before an action would drop unsaved edits */}
      {asking && dirtyDriver && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: S.scrim }}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="discard-edits-title"
            tabIndex={-1}
            className="w-full max-w-md rounded-2xl p-6"
            style={{ backgroundColor: S.surface, boxShadow: SHADOW.dialog, color: S.onSurface }}
          >
            <h2 id="discard-edits-title" style={{ margin: 0, fontFamily: HEADLINE_FONT, fontSize: 17, fontWeight: 800, lineHeight: 1.3 }}>
              Discard the edits to {dirtyDriver.name}?
            </h2>
            <p style={{ margin: '10px 0 0', fontSize: 13.5, lineHeight: 1.55, color: S.onSurfaceVariant }}>
              The editor holds changes that have not been saved. Keep editing to save them first, or discard them.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2.5 flex-wrap">
              <button type="button" onClick={keepEditing} style={{
                padding: '9px 18px', borderRadius: 999, border: `1px solid ${S.cardBorder}`, background: S.surface,
                color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>
                Keep editing
              </button>
              <button type="button" onClick={discardAndContinue} style={{
                padding: '9px 18px', borderRadius: 999, border: 'none', background: S.error,
                color: S.onPrimary, fontFamily: HEADLINE_FONT, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Filter chip ───────────────────────────────────────────────────
const FilterChip: FC<{ label: string; active: boolean; onClick: () => void; dot?: string }> = ({ label, active, onClick, dot }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 hover:scale-[0.97]"
    style={{
      backgroundColor: active ? S.primaryContainer : S.surfaceLow,
      color:           active ? S.onPrimaryContainer : S.onSurfaceVariant,
    }}
  >
    {dot && <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: dot, flexShrink: 0 }} />}
    {label}
  </button>
);

// ─── Sort header: a column header with a button that sorts by it ──
const SortHeader: FC<{
  label: string;
  sortKey: SortKey;
  currentKey: SortKey | null;
  currentDir: SortDir;
  onToggle: (key: SortKey) => void;
  align?: 'left' | 'right';
  /** Something beside the button, such as the GP1 help. */
  extra?: React.ReactNode;
}> = ({ label, sortKey, currentKey, currentDir, onToggle, align = 'left', extra }) => {
  const isActive = currentKey === sortKey;
  const Icon = !isActive ? ArrowUpDown : currentDir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <div
      role="columnheader"
      aria-sort={isActive ? (currentDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className="inline-flex items-center w-full"
      style={{ justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}
    >
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        aria-label={`Sort by ${label}`}
        className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] transition-colors"
        style={{
          justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
          color: isActive ? S.onSurface : S.onSurfaceVariant,
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: align,
          minHeight: 24,
        }}
      >
        <span>{label}</span>
        <Icon size={12} style={{ opacity: isActive ? 1 : 0.45 }} aria-hidden />
      </button>
      {extra}
    </div>
  );
};

// ─── GP1 column header tooltip ─────────────────────────────────────
const Gp1InfoTip: FC = () => {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button type="button" aria-label="What does GP1 % affected mean?" aria-expanded={open}
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 24, height: 24, background: 'transparent', border: 'none', padding: 0, marginLeft: 2,
          color: S.onSurfaceVariant, cursor: 'help' }}>
        <Info size={11} strokeWidth={2.4} />
      </button>
      {open && (
        <span role="tooltip" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 40,
          width: 280, padding: '10px 12px', borderRadius: 8, backgroundColor: S.onSurface, color: S.surface,
          fontFamily: BODY_FONT, fontSize: 11.5, lineHeight: 1.5, fontWeight: 500, textTransform: 'none',
          letterSpacing: 0, textAlign: 'left', boxShadow: SHADOW.tip,
          pointerEvents: 'none', whiteSpace: 'normal' }}>
          <b>GP1 % affected.</b> {FIELD_HELP.gp1}
        </span>
      )}
    </span>
  );
};

// ─── Empty and loading row ─────────────────────────────────────────
const EmptyRow: FC<{ text: string; icon: React.ReactNode; action?: { label: string; onClick: () => void }; status?: boolean }> = ({
  text, icon, action, status,
}) => (
  <div
    role="row"
  >
    <div
      role="cell"
      aria-colspan={6}
      className="px-8 py-16 flex flex-col items-center justify-center gap-3"
      style={{ color: S.onSurfaceVariant }}
    >
      <div style={{ color: S.primary }}>{icon}</div>
      <div className="text-sm" role={status ? 'status' : undefined}>{text}</div>
      {action && (
        <button type="button" onClick={action.onClick} style={{
          padding: '7px 16px', borderRadius: 999, border: `1px solid ${S.cardBorder}`, background: S.surface,
          color: S.primary, fontFamily: HEADLINE_FONT, fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}>
          {action.label}
        </button>
      )}
    </div>
  </div>
);

export default Drivers;
