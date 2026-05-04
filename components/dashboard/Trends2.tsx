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

import React, { useMemo, useState, useEffect, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, TrendingUp, TrendingDown, Users, Store, Cpu, Landmark,
  Leaf, Swords, Sparkles, ChevronDown,
  FileText, BarChart3, Clock, Zap, MapPin, Layers, Newspaper,
  Globe, ExternalLink, AlertTriangle,
  ArrowUp, ArrowDown, ArrowUpDown,
  Plus, Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import { CATEGORIES, fmtPct, fmtShift, shortCat } from '@/lib/format';
import type { Trend, ForceName, CategoryId, TrendSource, TrendUpdate } from '@/types';

// ─── Value-chain steps — must match backend VC_KEYS in pulse/config.py ──
// The Python engine (seed_trends / config) keys vc_exposure by the display-
// string form: "Raw Materials", "Formulation", "Manufacturing", "Packaging",
// "Supply Chain", "Marketing", "Commercial", "Consumer". We key off those
// (with snake_case fallbacks so we stay resilient if the API ever normalizes).
interface VCStep { id: string; label: string; fallback: string[] }
const VC_STEPS: VCStep[] = [
  { id: 'Raw Materials', label: 'Raw Materials', fallback: ['raw_materials'] },
  { id: 'Formulation',   label: 'Formulation',   fallback: ['formulation'] },
  { id: 'Manufacturing', label: 'Manufacturing', fallback: ['manufacturing'] },
  { id: 'Packaging',     label: 'Packaging',     fallback: ['packaging'] },
  { id: 'Supply Chain',  label: 'Supply Chain',  fallback: ['supply_chain', 'logistics'] },
  { id: 'Marketing',     label: 'Marketing',     fallback: ['marketing'] },
  { id: 'Commercial',    label: 'Commercial',    fallback: ['commercial', 'trade'] },
  { id: 'Consumer',      label: 'Consumer',      fallback: ['consumer', 'after_sales'] },
];

// ─── Regions — mirror of TrendExplorer / Vite Trends2 ────────────
const REGIONS: Array<{ id: string; label: string }> = [
  { id: 'Europe',        label: 'Europe' },
  { id: 'North America', label: 'North America' },
  { id: 'Asia',          label: 'Asia' },
  { id: 'High Growth',   label: 'High Growth' },
];

// ─── Diffusion curve metadata ────────────────────────────────────
const DIFFUSION_LABELS: Record<string, { label: string; description: string }> = {
  s_curve:       { label: 'S-Curve',       description: 'Logistic — slow start, fast middle, plateau.' },
  linear:        { label: 'Linear',        description: 'Steady, constant rate of materialization.' },
  front_loaded:  { label: 'Front-Loaded',  description: 'Fast early impact, flattens over time (√t).' },
  back_loaded:   { label: 'Back-Loaded',   description: 'Slow start, accelerates late (t²).' },
  step_function: { label: 'Step Function', description: 'Near-zero until ~80%, then sudden jump.' },
};

// ─── Source classification (read-only display) ──────────────────
function classifySource(url: string): string {
  const u = (url || '').toLowerCase();
  if (u.includes('eur-lex') || u.includes('europa.eu')) return 'EUR-Lex';
  if (u.includes('echa')) return 'ECHA';
  if (u.includes('sec.gov') || u.includes('edgar')) return 'SEC EDGAR';
  if (u.includes('trends.google')) return 'Google Trends';
  if (u.includes('reddit')) return 'Reddit';
  if (u.includes('youtube')) return 'YouTube';
  if (u.includes('scholar') || u.includes('doi.org') || u.includes('nature.com') || u.includes('pubmed')) return 'Semantic Scholar';
  if (u.includes('gdelt')) return 'GDELT';
  if (u.includes('mckinsey') || u.includes('bain') || u.includes('bcg')) return 'Consulting';
  if (u.includes('cosmetics') || u.includes('happi') || u.includes('retaildetail') || u.includes('grocery') || u.includes('packaging')) return 'Trade Press';
  return 'Press';
}

const SOURCE_ICON: Record<string, LucideIcon> = {
  GDELT: Globe, 'Google Trends': TrendingUp, ECHA: AlertTriangle, 'EUR-Lex': FileText,
  'SEC EDGAR': BarChart3, Reddit: Globe, YouTube: Globe, 'Semantic Scholar': FileText,
  Consulting: FileText, 'Trade Press': Newspaper, Press: Newspaper,
};

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
  cardBorder:         'rgba(0, 52, 94, 0.10)',
  cardBorderStrong:   'rgba(0, 52, 94, 0.16)',
  mutedText:          '#64748B',
};

const HEADLINE_FONT = "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const BODY_FONT     = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

// Force → icon + tonal container mapping (editorial palette)
const FORCE_TILE: Record<ForceName, { Icon: LucideIcon; bg: string; fg: string }> = {
  Consumer:      { Icon: Users,    bg: S.primaryContainer,   fg: S.primary },
  Customer:      { Icon: Store,    bg: S.secondaryContainer, fg: S.onSecondaryContainer },
  Technology:    { Icon: Cpu,      bg: S.tertiaryContainer,  fg: S.onTertiaryContainer },
  Government:    { Icon: Landmark, bg: S.surfaceHighest,     fg: S.onSurface },
  Environmental: { Icon: Leaf,     bg: S.surfaceHigh,        fg: S.primary },
  Competitive:   { Icon: Swords,   bg: S.surfaceContainer,   fg: S.primaryDim },
};

// ─── Probability dot bar ──────────────────────────────────────────
interface DotBarProps {
  value: number;
  editable?: boolean;
  onChange?: (next: number) => void;
}
const DotBar: FC<DotBarProps> = ({ value, editable = false, onChange }) => (
  <div
    className="flex gap-1.5"
    role={editable ? 'radiogroup' : undefined}
    aria-label={`Probability ${value} of 5`}
  >
    {[1, 2, 3, 4, 5].map((d) => {
      const filled = d <= value;
      return (
        <span
          key={d}
          role={editable ? 'radio' : undefined}
          aria-checked={editable ? filled : undefined}
          tabIndex={editable ? 0 : -1}
          onClick={editable && onChange ? (e) => { e.stopPropagation(); onChange(d); } : undefined}
          onKeyDown={editable && onChange ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(d); }
          } : undefined}
          className="inline-block w-2.5 h-2.5 rounded-full"
          style={{
            backgroundColor: filled ? S.primary : S.surfaceHigh,
            cursor: editable ? 'pointer' : 'default',
            transition: 'background-color 140ms',
            outline: 'none',
          }}
        />
      );
    })}
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
//
// IMPORTANT: the backend keys `category_exposure` by display names
// ("Hair: Color"), not by the frontend snake_case id ("hair_color").
// We try the display name first, then fall back to the snake_case id so
// the grid is resilient to either schema.
const readExposure = (
  exposures: Record<string, number> | undefined,
  primary: string,
  fallback?: string,
): number => {
  if (!exposures) return 0;
  if (typeof exposures[primary] === 'number') return exposures[primary]!;
  if (fallback && typeof exposures[fallback] === 'number') return exposures[fallback]!;
  return 0;
};

const CategoryExposureGrid: FC<{ exposures: Record<string, number> }> = ({ exposures }) => {
  const grouped = {
    Hair: CATEGORIES.filter((c) => c.group === 'Hair'),
    LHC:  CATEGORIES.filter((c) => c.group === 'LHC'),
  };
  return (
    <div className="space-y-4">
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
                <ExposureDots value={readExposure(exposures, cat.name, cat.id)} tone="emerald" />
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
// 8 steps matched against the backend's display-name keys, with
// snake_case/legacy fallbacks so old trend payloads still render.
const readVCExposure = (
  exposures: Record<string, number> | undefined,
  step: VCStep,
): number => {
  if (!exposures) return 0;
  if (typeof exposures[step.id] === 'number') return exposures[step.id]!;
  for (const alt of step.fallback) {
    if (typeof exposures[alt] === 'number') return exposures[alt]!;
  }
  return 0;
};

const ValueChainExposureGrid: FC<{ exposures: Record<string, number> }> = ({ exposures }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
      {VC_STEPS.map((step) => (
        <div key={step.id} className="flex flex-col gap-1.5">
          <div
            className="text-[11px] font-medium"
            style={{ color: S.onSurface }}
          >
            {step.label}
          </div>
          <ExposureDots value={readVCExposure(exposures, step)} tone="purple" />
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

// ─── Section Card — boxed card for each sub-section in the expanded panel ─
interface SectionCardProps {
  title: string;
  icon: LucideIcon;
  accent?: string;
  footnote?: React.ReactNode;
  children: React.ReactNode;
}
const SectionCard: FC<SectionCardProps> = ({ title, icon: Icon, accent, footnote, children }) => (
  <div style={{
    backgroundColor: S.surface,
    border: `1px solid ${S.cardBorder}`,
    borderRadius: 12,
    padding: '14px 16px 16px',
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
    }}>
      <span style={{
        width: 26, height: 26, borderRadius: 8,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: S.surfaceLow,
        color: accent ?? S.onSurfaceVariant,
      }}>
        <Icon size={14} strokeWidth={2.25} />
      </span>
      <div style={{
        fontFamily: HEADLINE_FONT,
        fontSize: 12, fontWeight: 800, letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: S.onSurface,
      }}>
        {title}
      </div>
    </div>
    {children}
    {footnote && (
      <div style={{
        marginTop: 10, fontSize: 11, lineHeight: 1.5, color: S.mutedText,
      }}>
        {footnote}
      </div>
    )}
  </div>
);

// ─── Meta chip (direction/confidence/data-source pill) ─────────────
const MetaChip: FC<{ label: string }> = ({ label }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center',
    padding: '4px 12px', borderRadius: 999,
    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
    backgroundColor: S.surfaceLow,
    color: S.onSurfaceVariant,
    textTransform: 'uppercase',
  }}>
    {label}
  </span>
);

// ─── Source tier rating (editorial credibility scale) ──────────────
// Mirrors pulse/dashboard/src/components/Trends2.tsx. S = official regulator /
// statistical authority; E = unverified social. Tooltip explains the meaning
// on hover.
const TIER_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  'S':  { label: 'S',  color: '#22c55e', description: 'Official regulatory / statistical authority' },
  'A':  { label: 'A',  color: '#3b82f6', description: 'Tier-1 consulting or analyst primary research' },
  'A-': { label: 'A-', color: '#60a5fa', description: 'Investment-bank equity research' },
  'B+': { label: 'B+', color: '#a78bfa', description: 'Specialist market-research firm' },
  'B':  { label: 'B',  color: '#c084fc', description: 'Industry trade press' },
  'B-': { label: 'B-', color: '#e879f9', description: 'Company first-party source' },
  'C':  { label: 'C',  color: '#f59e0b', description: 'General business press' },
  'D':  { label: 'D',  color: '#ef4444', description: 'Aggregator / forecast' },
  'E':  { label: 'E',  color: '#991b1b', description: 'Social / unverified' },
};
const TIER_OPTIONS: Array<TrendSource['tier']> = ['S','A','A-','B+','B','B-','C','D','E'];

// ─── Source item ──────────────────────────────────────────────────
const SourceItem: FC<{ src: TrendSource }> = ({ src }) => {
  const cls = classifySource(src.url);
  const Icon = SOURCE_ICON[cls] ?? Newspaper;
  const tierCfg = src.tier ? TIER_CONFIG[src.tier] : undefined;
  return (
    <a
      href={src.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', gap: 10, alignItems: 'flex-start',
        padding: '10px 12px',
        backgroundColor: S.surfaceLow,
        borderRadius: 10,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <span style={{
        flexShrink: 0, width: 28, height: 28, borderRadius: 8,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: S.surface, color: S.primary,
      }}>
        <Icon size={14} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          fontSize: 13, fontWeight: 600,
          color: S.onSurface, lineHeight: 1.35,
        }}>
          <span style={{ fontWeight: 600 }}>{src.title}</span>
          {tierCfg && (
            <span
              title={`Source rating ${tierCfg.label} — ${tierCfg.description}`}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 22, height: 18, padding: '0 6px',
                borderRadius: 4,
                fontFamily: HEADLINE_FONT,
                fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
                backgroundColor: `${tierCfg.color}22`,
                color: tierCfg.color,
                border: `1px solid ${tierCfg.color}55`,
                textTransform: 'none',
              }}
            >
              {tierCfg.label}
            </span>
          )}
        </span>
        <span style={{
          display: 'block', fontSize: 11, color: S.mutedText, marginTop: 2,
        }}>
          {cls}{src.data ? ` · ${src.data}` : ''}
        </span>
      </span>
      <ExternalLink size={12} style={{ color: S.mutedText, marginTop: 4 }} />
    </a>
  );
};

// ─── Regional Exposure Grid (read-only, mirrors VC grid) ──────────
const RegionExposureGrid: FC<{ exposures: Record<string, number> }> = ({ exposures }) => (
  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
    {REGIONS.map((r) => (
      <div key={r.id} className="flex flex-col gap-1.5">
        <div className="text-[11px] font-medium" style={{ color: S.onSurface }}>
          {r.label}
        </div>
        <ExposureDots value={exposures?.[r.id] ?? 0} tone="emerald" />
      </div>
    ))}
  </div>
);

// ─── Sort helpers ──────────────────────────────────────────────────
type SortKey = 'name' | 'direction' | 'probability' | 'gp1' | 'shift';
type SortDir = 'asc' | 'desc';

// Per-column default direction when the user first activates the sort.
// Numeric columns default to "biggest first" (desc), strings to A→Z (asc).
const SORT_DEFAULT_DIR: Record<SortKey, SortDir> = {
  name:        'asc',
  direction:   'asc',
  probability: 'desc',
  gp1:         'desc',
  shift:       'desc',
};

function sortValue(t: Trend, key: SortKey): string | number | null | undefined {
  switch (key) {
    case 'name':        return t.name;
    case 'direction':   return t.direction;
    case 'probability': return t.probability;
    case 'gp1':         return (t as Trend & { gp1_pct_affected?: number }).gp1_pct_affected;
    case 'shift':       return t.gp1_shift;
  }
}

// ─── Main component ────────────────────────────────────────────────
const Trends2: FC = () => {
  const { trends, loading, backendAvailable, updateTrend } = usePrism();
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | 'all'>('all');
  const [search, setSearch] = useState('');
  // Which trend row is currently expanded to show category + VC exposure.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Admin-gated row editing — source of truth is our Postgres (via /api/me),
  // not Clerk metadata. Matches the pattern used in SettingsModal.tsx.
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'include' });
        if (!res.ok) return;
        const data = (await res.json()) as { role?: 'admin' | 'viewer' };
        if (!cancelled) setIsAdmin(data.role === 'admin');
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Sort state — null means "backend order" (initial state).
  // Clicking a header sorts by that column; clicking the same column again
  // flips direction; clicking a different column resets to its default dir.
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

  const filtered = useMemo<Trend[]>(() => {
    const q = search.trim().toLowerCase();
    // Map the selected snake_case CategoryId to its backend display name
    // (e.g. 'hair_color' → 'Hair: Color') so the filter matches real data.
    const selectedCat = categoryFilter !== 'all'
      ? CATEGORIES.find((c) => c.id === categoryFilter)
      : null;
    return (trends || []).filter((t) => {
      if (selectedCat) {
        const ce = (t.category_exposure as Record<string, number> | undefined) ?? {};
        const exposure = ce[selectedCat.name] ?? ce[selectedCat.id] ?? 0;
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

  // Apply sort on top of filter. When no sortKey is set we preserve the
  // backend's order (which is a stable editorial sequence by force group).
  const sorted = useMemo<Trend[]>(() => {
    if (!sortKey) return filtered;
    const cmp = (a: Trend, b: Trend): number => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      // Nulls / NaN always sink to the bottom regardless of direction
      const aNull = av == null || (typeof av === 'number' && !isFinite(av));
      const bNull = bv == null || (typeof bv === 'number' && !isFinite(bv));
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const as = String(av).toLowerCase();
      const bs = String(bv).toLowerCase();
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    };
    return [...filtered].sort(cmp);
  }, [filtered, sortKey, sortDir]);

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
              profit-pool reallocation across categories through 2035.
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
          {/* Column header — all columns clickable, sort state in local hook */}
          <div
            className="grid items-center px-8 py-2.5 text-[11px] font-bold uppercase tracking-[0.15em]"
            style={{
              gridTemplateColumns: '2.3fr 1fr 1fr 0.9fr 0.8fr',
              backgroundColor: S.surfaceLow,
              color: S.onSurfaceVariant,
            }}
          >
            <SortHeader label="Trend"          sortKey="name"        currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
            <SortHeader label="Direction"      sortKey="direction"   currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
            <SortHeader label="Probability"    sortKey="probability" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
            <SortHeader label="GP1 % Affected" sortKey="gp1"         currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} align="right" />
            <SortHeader label="Shift"          sortKey="shift"       currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} align="right" />
          </div>

          {/* Rows */}
          <div>
            {loading && (
              <EmptyRow text="Loading trend intelligence…" icon={<Sparkles size={20} />} />
            )}
            {!loading && !backendAvailable && (
              <EmptyRow text="Backend unavailable — reconnect to view live trend data." icon={<Sparkles size={20} />} />
            )}
            {!loading && backendAvailable && sorted.length === 0 && (
              <EmptyRow text="No trends match the current filter." icon={<Sparkles size={20} />} />
            )}
            {sorted.map((t, idx) => {
              const key = t.id ?? String(idx);
              const expanded = expandedId === key;
              return (
                <TrendRow
                  key={key}
                  trend={t}
                  isLast={idx === sorted.length - 1}
                  expanded={expanded}
                  onToggle={() => setExpandedId(expanded ? null : key)}
                  isAdmin={isAdmin}
                  updateTrend={updateTrend}
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

// ─── Sort header (clickable column header with asc/desc indicator) ────
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

// ─── Trend row ─────────────────────────────────────────────────────
interface TrendRowProps {
  trend: Trend;
  isLast: boolean;
  expanded: boolean;
  onToggle: () => void;
  isAdmin?: boolean;
  updateTrend?: (trendId: string, updates: Partial<Trend>) => Promise<void>;
}

const TrendRow: FC<TrendRowProps> = ({
  trend, isLast, expanded, onToggle, isAdmin = false, updateTrend,
}) => {
  const tile = FORCE_TILE[trend.force] ?? FORCE_TILE.Consumer;
  const { Icon } = tile;
  const gp1 = (trend as Trend & { gp1_pct_affected?: number }).gp1_pct_affected;
  const shift = trend.gp1_shift;

  // Inline-edit state for GP1% (admin-only). Kept as a string so the user can
  // clear the field while typing without the parent snapping the value back.
  const [editingGp1, setEditingGp1] = useState(false);
  const [gp1Draft, setGp1Draft] = useState<string>(
    gp1 != null ? String(Math.round(gp1 * 100)) : ''
  );
  useEffect(() => {
    setGp1Draft(gp1 != null ? String(Math.round(gp1 * 100)) : '');
  }, [gp1]);

  // Shift tooltip hover state
  const [showShiftTip, setShowShiftTip] = useState(false);

  // Bayesian posterior mean for probability: p / 6 (NOT p / 5).
  // Matches the backend formula in pulse/ingestion/models.py:
  //   α = max(p,1),  β = max(6-p,1),  prob_mean = α / (α + β).
  // For p ∈ [1..5] this simplifies to p / 6.
  const probClamped = Math.max(1, Math.min(5, Math.round(trend.probability ?? 0)));
  const probMean    = probClamped / 6;
  const gp1PctNum   = gp1 ?? 0;
  const dirSign     = trend.direction === 'Contraction' ? -1 : 1;

  const canEdit = isAdmin && !!updateTrend;

  const commitGp1 = () => {
    setEditingGp1(false);
    if (!canEdit) return;
    const raw = parseInt(gp1Draft, 10);
    if (!isNaN(raw) && raw >= 1 && raw <= 100) {
      const next = raw / 100;
      if (next !== gp1) {
        updateTrend!(trend.id, { gp1_pct_affected: next } as Partial<Trend>)
          .catch(() => { /* handled in hook */ });
      }
    } else {
      setGp1Draft(gp1 != null ? String(Math.round(gp1 * 100)) : '');
    }
  };

  const handleProbChange = (val: number) => {
    if (!canEdit) return;
    updateTrend!(trend.id, { probability: val } as Partial<Trend>)
      .catch(() => { /* handled in hook */ });
  };

  return (
    <div style={{ boxShadow: isLast && !expanded ? 'none' : `inset 0 -1px 0 ${S.surfaceLow}` }}>
      {/* Header row — click to toggle the exposure detail panel. Note: we use a
          div+role=button instead of a <button> so that the admin inline
          controls (DotBar radios, GP1 input) can sit inside without producing
          invalid nested-interactive HTML. */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); }
        }}
        aria-expanded={expanded}
        className="w-full grid items-center px-8 py-2 text-left transition-colors"
        style={{
          gridTemplateColumns: '2.3fr 1fr 1fr 0.9fr 0.8fr',
          backgroundColor: expanded ? S.surfaceLow : S.surface,
          cursor: 'pointer',
          border: 'none',
        }}
      >
        {/* Trend identity */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: tile.bg, color: tile.fg }}
          >
            <Icon size={16} strokeWidth={2} />
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
          </div>
        </div>

        {/* Direction */}
        <div><DirectionPill direction={trend.direction} /></div>

        {/* Probability — inline editable for admin */}
        <div onClick={(e) => { if (canEdit) e.stopPropagation(); }}>
          <DotBar
            value={Math.round(trend.probability ?? 0)}
            editable={canEdit}
            onChange={handleProbChange}
          />
        </div>

        {/* GP1 % — inline editable for admin (click to edit) */}
        <div
          className="text-right"
          onClick={(e) => { if (canEdit) e.stopPropagation(); }}
        >
          {canEdit && editingGp1 ? (
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              autoFocus
              value={gp1Draft}
              onChange={(e) => setGp1Draft(e.target.value)}
              onBlur={commitGp1}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitGp1(); }
                if (e.key === 'Escape') {
                  setGp1Draft(gp1 != null ? String(Math.round(gp1 * 100)) : '');
                  setEditingGp1(false);
                }
              }}
              style={{
                width: 64,
                padding: '3px 6px',
                borderRadius: 6,
                border: `1px solid ${S.primary}`,
                backgroundColor: S.surface,
                color: S.onSurface,
                fontFamily: HEADLINE_FONT,
                fontWeight: 800,
                fontSize: '1rem',
                textAlign: 'right',
                outline: 'none',
              }}
            />
          ) : (
            <span
              onClick={(e) => {
                if (!canEdit) return;
                e.stopPropagation();
                setEditingGp1(true);
              }}
              title={canEdit ? 'Click to edit (admin)' : undefined}
              className="font-extrabold"
              style={{
                fontFamily: HEADLINE_FONT,
                color: S.onSurface,
                fontSize: '1.15rem',
                cursor: canEdit ? 'text' : 'default',
                padding: canEdit ? '2px 6px' : 0,
                borderRadius: 4,
                borderBottom: canEdit ? `1px dashed ${S.onSurfaceVariant}55` : 'none',
              }}
            >
              {gp1 != null ? fmtPct(gp1) : '—'}
            </span>
          )}
        </div>

        {/* Shift — read-only, with calculation tooltip on hover */}
        <div
          className="text-right"
          style={{ position: 'relative' }}
          onMouseEnter={() => setShowShiftTip(true)}
          onMouseLeave={() => setShowShiftTip(false)}
        >
          <span
            className="font-bold text-[14px]"
            style={{
              color: shift != null && shift < 0 ? S.error : S.onPrimaryContainer,
              borderBottom: `1px dotted ${S.onSurfaceVariant}66`,
              cursor: 'help',
            }}
          >
            {shift != null ? fmtShift(shift) : '—'}
          </span>

          {showShiftTip && shift != null && (
            <div
              role="tooltip"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 6px)',
                zIndex: 40,
                minWidth: 280,
                maxWidth: 340,
                padding: '10px 12px',
                borderRadius: 8,
                backgroundColor: S.onSurface,
                color: S.surface,
                fontFamily: HEADLINE_FONT,
                fontSize: 11.5,
                lineHeight: 1.45,
                fontWeight: 500,
                textAlign: 'left',
                boxShadow: '0 10px 24px rgba(0, 52, 94, 0.28)',
                pointerEvents: 'none',
                whiteSpace: 'normal',
              }}
            >
              <div style={{
                fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                fontSize: 10, opacity: 0.75, marginBottom: 6,
              }}>
                Shift Calculation
              </div>
              <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 }}>
                Shift = Probability × GP1% Affected × Direction
              </div>
              <div style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 11, marginTop: 4,
              }}>
                = ({probClamped}/6) × {(gp1PctNum * 100).toFixed(1)}% × {dirSign > 0 ? '+1' : '−1'}
              </div>
              <div style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 11, marginTop: 4, fontWeight: 700,
              }}>
                = {fmtShift(shift)} (≈ {(probMean * gp1PctNum * dirSign * 100).toFixed(2)} pp)
              </div>
              <div style={{
                marginTop: 8, paddingTop: 8,
                borderTop: '1px solid rgba(255,255,255,0.15)',
                opacity: 0.9,
              }}>
                <strong style={{ opacity: 1 }}>Why 4/5 is not 0.80×:</strong>{' '}
                Probability is normalized via the Bayesian Beta posterior mean
                (α = p, β = 6 − p), giving <em>p / 6</em> — not p / 5.
                So a 4/5 rating contributes <strong>4/6 ≈ 0.667×</strong>,
                and 5/5 contributes 5/6 ≈ 0.833× (the model never asserts full certainty).
                {' '}Chosen over a linear <em>p / 5</em> mapping so the Monte Carlo stays
                probabilistic at both tails — a 5/5 is highly likely, not deterministic,
                and a 1/5 remains non-trivially possible rather than zero.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expanded detail panel — read-only port of Vite Trends2 ExpandedPanel.
          Two-column layout: Description / PRISM Analysis / GP1% / Probability /
          Materialization / Sources on the left; Category / Region / Value Chain
          exposure grids stacked vertically on the right. */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden', backgroundColor: S.surfaceLow }}
          >
            <ExpandedPanel trend={trend} isAdmin={isAdmin} updateTrend={updateTrend} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Expanded detail panel ─────────────────────────────────────────
// Two-column layout:
//   LEFT  — editorial detail (description, PRISM analysis, GP1%, probability,
//           materialization timing, sources).
//   RIGHT — exposure grids stacked vertically in the order requested by
//           the strategy team: Category → Region → Value Chain.
//
// ADMIN-EDITABLE: when isAdmin is true an "Edit" button appears in the top
// right. Clicking it swaps every field (except PRISM Analysis — which is
// always read-only) into an editable form and shows Cancel / Save buttons.
// Save sends a single TrendUpdate through usePrism.updateTrend.
interface ExpandedPanelProps {
  trend: Trend;
  isAdmin?: boolean;
  updateTrend?: (trendId: string, updates: TrendUpdate) => Promise<void>;
}

// Small wrapper for a labeled edit control (keeps the form tidy)
const FieldLabel: FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: S.mutedText, marginBottom: 6,
  }}>
    {children}
  </div>
);

// Editable 0-5 dot bar used for category / region / value-chain exposure.
const EditableDots: FC<{
  value: number;
  onChange: (next: number) => void;
  tone?: 'emerald' | 'purple';
}> = ({ value, onChange, tone = 'emerald' }) => {
  const FILLED = tone === 'emerald' ? S.primary : S.onTertiaryContainer;
  const EMPTY  = S.surfaceHigh;
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={`Exposure ${value} of 5`}>
      {[0, 1, 2, 3, 4, 5].map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          aria-checked={d === value}
          role="radio"
          title={`${d} / 5`}
          style={{
            width: 14, height: 14, borderRadius: 999,
            border: 'none', padding: 0, cursor: 'pointer',
            backgroundColor: d === 0
              ? (value === 0 ? FILLED : EMPTY)
              : (d <= value ? FILLED : EMPTY),
            opacity: d === 0 ? 0.35 : 1,
            transition: 'background-color 120ms',
          }}
        />
      ))}
    </div>
  );
};

const ExpandedPanel: FC<ExpandedPanelProps> = ({ trend, isAdmin = false, updateTrend }) => {
  const gp1Pct      = (trend as Trend & { gp1_pct_affected?: number }).gp1_pct_affected ?? 0.10;
  const probability = trend.probability ?? 0;
  const peakYear    = (trend as Trend & { peak_year?: number }).peak_year ?? 2030;
  const diffusion   = (trend as Trend & { diffusion_curve?: string }).diffusion_curve ?? 's_curve';
  const sources     = trend.sources ?? [];
  const confidence  = trend.confidence;
  const dataSource  = trend.data_source;
  const diffusionMeta = DIFFUSION_LABELS[diffusion] ?? DIFFUSION_LABELS.s_curve;

  // Exposure data for the right column. Backend keys by display name
  // ("Hair: Color", "Raw Materials", "Europe"); readers inside each grid
  // fall back to snake_case ids where applicable.
  const catExp = (trend.category_exposure ?? {}) as Record<string, number>;
  const vcExp  = (trend.vc_exposure ?? {}) as Record<string, number>;
  const regExp = ((trend as Trend & { regional_exposure?: Record<string, number> })
    .regional_exposure ?? {}) as Record<string, number>;

  // ─── Admin edit state ────────────────────────────────────────────
  const canEdit = isAdmin && !!updateTrend;
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Editable drafts — hydrated from the trend on entering edit mode.
  const [draftDesc, setDraftDesc]           = useState(trend.description || '');
  const [draftProb, setDraftProb]           = useState<number>(Math.round(probability));
  const [draftDir, setDraftDir]             = useState<Trend['direction']>(trend.direction);
  const [draftGp1, setDraftGp1]             = useState<number>(Math.round(gp1Pct * 100));
  const [draftPeak, setDraftPeak]           = useState<number>(peakYear);
  const [draftCurve, setDraftCurve]         = useState<string>(diffusion);
  const [draftConfidence, setDraftConfidence] = useState<string>(confidence ?? '');
  const [draftCatExp, setDraftCatExp]       = useState<Record<string, number>>({ ...catExp });
  const [draftVcExp, setDraftVcExp]         = useState<Record<string, number>>({ ...vcExp });
  const [draftRegExp, setDraftRegExp]       = useState<Record<string, number>>({ ...regExp });
  const [draftSources, setDraftSources]     = useState<TrendSource[]>(
    sources.map((s) => ({ ...s }))
  );

  // Re-hydrate drafts every time the trend data changes (e.g. after save).
  useEffect(() => {
    setDraftDesc(trend.description || '');
    setDraftProb(Math.round(trend.probability ?? 0));
    setDraftDir(trend.direction);
    setDraftGp1(Math.round(((trend as Trend & { gp1_pct_affected?: number }).gp1_pct_affected ?? 0.10) * 100));
    setDraftPeak((trend as Trend & { peak_year?: number }).peak_year ?? 2030);
    setDraftCurve((trend as Trend & { diffusion_curve?: string }).diffusion_curve ?? 's_curve');
    setDraftConfidence((trend.confidence as string) ?? '');
    setDraftCatExp({ ...((trend.category_exposure ?? {}) as Record<string, number>) });
    setDraftVcExp({ ...((trend.vc_exposure ?? {}) as Record<string, number>) });
    setDraftRegExp({ ...((trend as Trend & { regional_exposure?: Record<string, number> }).regional_exposure ?? {}) });
    setDraftSources((trend.sources ?? []).map((s) => ({ ...s })));
  }, [trend]);

  const handleCancel = () => {
    // Reset drafts back to the persisted trend values
    setDraftDesc(trend.description || '');
    setDraftProb(Math.round(trend.probability ?? 0));
    setDraftDir(trend.direction);
    setDraftGp1(Math.round(gp1Pct * 100));
    setDraftPeak(peakYear);
    setDraftCurve(diffusion);
    setDraftConfidence((confidence as string) ?? '');
    setDraftCatExp({ ...catExp });
    setDraftVcExp({ ...vcExp });
    setDraftRegExp({ ...regExp });
    setDraftSources(sources.map((s) => ({ ...s })));
    setSaveError(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!canEdit || !updateTrend) return;
    setSaving(true);
    setSaveError(null);
    const updates: TrendUpdate = {
      description: draftDesc,
      probability: Math.max(1, Math.min(5, Math.round(draftProb))),
      direction: draftDir,
      gp1_pct_affected: Math.max(0, Math.min(1, draftGp1 / 100)),
      peak_year: Math.max(2025, Math.min(2035, Math.round(draftPeak))),
      diffusion_curve: draftCurve,
      category_exposure: draftCatExp,
      vc_exposure: draftVcExp,
      regional_exposure: draftRegExp,
      // Filter out empty rows before sending
      sources: draftSources
        .filter((s) => (s.title && s.title.trim()) || (s.url && s.url.trim()))
        .map((s) => ({
          title: s.title || '',
          url: s.url || '',
          data: s.data || '',
          ...(s.tier ? { tier: s.tier } : {}),
        })),
    };
    // Only send confidence if the value is a valid enum member
    if (
      draftConfidence === 'High' ||
      draftConfidence === 'Medium' ||
      draftConfidence === 'Low'
    ) {
      updates.confidence = draftConfidence;
    }
    try {
      await updateTrend(trend.id, updates);
      setIsEditing(false);
    } catch (e) {
      setSaveError((e as Error)?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addSource = () =>
    setDraftSources((arr) => [...arr, { title: '', url: '', data: '', tier: undefined }]);
  const removeSource = (idx: number) =>
    setDraftSources((arr) => arr.filter((_, i) => i !== idx));
  const patchSource = (idx: number, patch: Partial<TrendSource>) =>
    setDraftSources((arr) => arr.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        padding: '28px 32px 36px',
        backgroundColor: S.surface,
        borderTop: `1px solid ${S.cardBorder}`,
      }}
    >
      {/* Meta row: Direction + Confidence + AI badge + Data source */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
        marginBottom: 24,
      }}>
        {isEditing ? (
          <>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <FieldLabel>Direction</FieldLabel>
              <select
                value={draftDir}
                onChange={(e) => setDraftDir(e.target.value as Trend['direction'])}
                style={{
                  padding: '4px 10px', borderRadius: 999, fontSize: 11,
                  fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                  backgroundColor: S.surfaceLow, color: S.onSurface,
                  border: `1px solid ${S.cardBorder}`,
                }}
              >
                <option value="Expansion">Expansion</option>
                <option value="Contraction">Contraction</option>
              </select>
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <FieldLabel>Confidence</FieldLabel>
              <select
                value={draftConfidence}
                onChange={(e) => setDraftConfidence(e.target.value)}
                style={{
                  padding: '4px 10px', borderRadius: 999, fontSize: 11,
                  fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                  backgroundColor: S.surfaceLow, color: S.onSurface,
                  border: `1px solid ${S.cardBorder}`,
                }}
              >
                <option value="">—</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </label>
          </>
        ) : (
          <>
            <DirectionPill direction={trend.direction} />
            {confidence && <MetaChip label={`Confidence · ${confidence}`} />}
          </>
        )}
        {trend.ai_suggested && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 999,
            fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
            backgroundColor: S.tertiaryContainer,
            color: S.onTertiaryContainer,
            textTransform: 'uppercase',
          }}>
            <Sparkles size={12} /> AI Suggested
          </span>
        )}
        {!isEditing && dataSource && <MetaChip label={dataSource} />}
      </div>

      {/* Two-column editorial detail layout.
          LEFT column — editorial narrative (description, analysis, GP1, probability,
          timing, sources). RIGHT column — exposure grids stacked in the order
          Category → Region → Value Chain. */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1fr)',
        gap: 20,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionCard title="Description" icon={FileText}>
            {isEditing ? (
              <textarea
                value={draftDesc}
                onChange={(e) => setDraftDesc(e.target.value)}
                rows={6}
                style={{
                  width: '100%', padding: '10px 12px',
                  borderRadius: 8, border: `1px solid ${S.cardBorder}`,
                  backgroundColor: S.surfaceLow, color: S.onSurface,
                  fontSize: 14, lineHeight: 1.6, fontFamily: BODY_FONT,
                  resize: 'vertical',
                }}
              />
            ) : (
              <p style={{
                margin: 0, fontSize: 14, lineHeight: 1.6, color: S.onSurface,
                whiteSpace: 'pre-wrap',
              }}>
                {trend.description || <em style={{ color: S.mutedText }}>No description documented.</em>}
              </p>
            )}
          </SectionCard>

          {/* PRISM Analysis is ALWAYS read-only — never editable by the admin */}
          <SectionCard title="PRISM Analysis" icon={Sparkles} accent={S.primary}>
            <blockquote style={{
              margin: 0,
              padding: '12px 16px',
              borderRadius: 10,
              borderLeft: `3px solid ${S.primary}`,
              backgroundColor: S.surfaceLow,
              fontSize: 14, lineHeight: 1.55,
              color: S.onSurface,
              fontStyle: 'normal',
              fontWeight: 500,
            }}>
              {trend.strategic_implication || (
                <span style={{ color: S.mutedText, fontWeight: 400, fontStyle: 'italic' }}>
                  No strategic implication documented.
                </span>
              )}
            </blockquote>
            {isEditing && (
              <div style={{
                marginTop: 8, fontSize: 10, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: S.mutedText, fontWeight: 700,
              }}>
                PRISM Analysis is generated by the engine and is not editable.
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="GP1 % Affected — Economic Anchoring"
            icon={BarChart3}
            footnote={
              <>
                What fraction of a category&apos;s GP1 can this trend realistically affect at full
                materialization?
              </>
            }
          >
            {isEditing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="range"
                  min={0} max={100} step={1}
                  value={draftGp1}
                  onChange={(e) => setDraftGp1(parseInt(e.target.value, 10))}
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  min={0} max={100} step={1}
                  value={draftGp1}
                  onChange={(e) => setDraftGp1(Math.max(0, Math.min(100, parseInt(e.target.value || '0', 10))))}
                  style={{
                    width: 72, padding: '6px 8px', borderRadius: 8,
                    border: `1px solid ${S.cardBorder}`, backgroundColor: S.surfaceLow,
                    color: S.onSurface, fontFamily: HEADLINE_FONT, fontWeight: 800,
                    fontSize: 15, textAlign: 'right',
                  }}
                />
                <span style={{ color: S.mutedText, fontSize: 12 }}>%</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  flex: 1, height: 6, borderRadius: 4,
                  backgroundColor: S.surfaceHigh, position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute', inset: 0,
                    width: `${Math.min(100, Math.round(gp1Pct * 100 * 2))}%`,
                    backgroundColor: S.primary, borderRadius: 4,
                  }} />
                </div>
                <div style={{
                  minWidth: 64,
                  padding: '6px 12px', borderRadius: 8,
                  backgroundColor: S.surfaceLow,
                  border: `1px solid ${S.cardBorder}`,
                  textAlign: 'center',
                  fontFamily: HEADLINE_FONT,
                  fontWeight: 800, fontSize: 15, color: S.primary,
                }}>
                  {Math.round(gp1Pct * 100)}%
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Probability"
            icon={Zap}
            footnote={
              <>Likelihood this trend materialises at the stated severity.
              Scale: 1 = Very Unlikely, 3 = Possible, 5 = Almost Certain.</>
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
              <DotBar
                value={isEditing ? draftProb : Math.round(probability)}
                editable={isEditing}
                onChange={isEditing ? (v) => setDraftProb(v) : undefined}
              />
              <div style={{
                padding: '6px 12px', borderRadius: 8,
                backgroundColor: S.surfaceLow,
                border: `1px solid ${S.cardBorder}`,
                fontFamily: HEADLINE_FONT,
                fontWeight: 800, fontSize: 15, color: S.primary,
              }}>
                {(isEditing ? draftProb : Math.round(probability))} / 5
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Materialization Timing"
            icon={Clock}
            footnote="When does this trend reach full impact, and how does it build over time?"
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <FieldLabel>Peak Year</FieldLabel>
                {isEditing ? (
                  <input
                    type="number"
                    min={2025} max={2035} step={1}
                    value={draftPeak}
                    onChange={(e) => setDraftPeak(parseInt(e.target.value || '2030', 10))}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 8,
                      border: `1px solid ${S.cardBorder}`,
                      backgroundColor: S.surfaceLow, color: S.onSurface,
                      fontSize: 13, fontWeight: 700,
                    }}
                  />
                ) : (
                  <div style={{
                    padding: '8px 10px', borderRadius: 8,
                    fontSize: 13, fontWeight: 700, color: S.onSurface,
                    backgroundColor: S.surfaceLow,
                    border: `1px solid ${S.cardBorder}`,
                  }}>
                    {peakYear}
                  </div>
                )}
                <div style={{ fontSize: 11, color: S.mutedText, marginTop: 4 }}>
                  Year when 100% of impact materializes
                </div>
              </div>
              <div>
                <FieldLabel>Diffusion Curve</FieldLabel>
                {isEditing ? (
                  <select
                    value={draftCurve}
                    onChange={(e) => setDraftCurve(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 8,
                      border: `1px solid ${S.cardBorder}`,
                      backgroundColor: S.surfaceLow, color: S.onSurface,
                      fontSize: 13, fontWeight: 700,
                    }}
                  >
                    {Object.entries(DIFFUSION_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                ) : (
                  <div style={{
                    padding: '8px 10px', borderRadius: 8,
                    fontSize: 13, fontWeight: 700, color: S.onSurface,
                    backgroundColor: S.surfaceLow,
                    border: `1px solid ${S.cardBorder}`,
                  }}>
                    {diffusionMeta.label}
                  </div>
                )}
                <div style={{ fontSize: 11, color: S.mutedText, marginTop: 4 }}>
                  {(DIFFUSION_LABELS[isEditing ? draftCurve : diffusion] ?? diffusionMeta).description}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Sources — edit mode reveals per-row title / url / data / tier controls */}
          {(isEditing || sources.length > 0) && (
            <SectionCard title={`Sources · ${isEditing ? draftSources.length : sources.length}`} icon={Newspaper}>
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {draftSources.map((s, i) => (
                    <div key={i} style={{
                      padding: 10, borderRadius: 10,
                      backgroundColor: S.surfaceLow,
                      border: `1px solid ${S.cardBorder}`,
                      display: 'flex', flexDirection: 'column', gap: 8,
                    }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="Source title"
                          value={s.title}
                          onChange={(e) => patchSource(i, { title: e.target.value })}
                          style={{
                            flex: 2, padding: '6px 10px', borderRadius: 6,
                            border: `1px solid ${S.cardBorder}`,
                            backgroundColor: S.surface, color: S.onSurface,
                            fontSize: 13, fontWeight: 600,
                          }}
                        />
                        <select
                          value={s.tier ?? ''}
                          onChange={(e) =>
                            patchSource(i, { tier: (e.target.value || undefined) as TrendSource['tier'] })}
                          title="Source rating"
                          style={{
                            padding: '6px 10px', borderRadius: 6,
                            border: `1px solid ${S.cardBorder}`,
                            backgroundColor: S.surface, color: S.onSurface,
                            fontSize: 12, fontWeight: 700,
                          }}
                        >
                          <option value="">Rating…</option>
                          {TIER_OPTIONS.map((t) => (
                            <option key={t} value={t ?? ''}>{t} · {TIER_CONFIG[t ?? '']?.description}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeSource(i)}
                          title="Remove source"
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 30, height: 30, borderRadius: 6,
                            border: `1px solid ${S.cardBorder}`,
                            backgroundColor: S.surface, color: S.error,
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="url"
                          placeholder="https://…"
                          value={s.url}
                          onChange={(e) => patchSource(i, { url: e.target.value })}
                          style={{
                            flex: 2, padding: '6px 10px', borderRadius: 6,
                            border: `1px solid ${S.cardBorder}`,
                            backgroundColor: S.surface, color: S.onSurface,
                            fontSize: 12,
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Data / quote / metric"
                          value={s.data}
                          onChange={(e) => patchSource(i, { data: e.target.value })}
                          style={{
                            flex: 3, padding: '6px 10px', borderRadius: 6,
                            border: `1px solid ${S.cardBorder}`,
                            backgroundColor: S.surface, color: S.onSurface,
                            fontSize: 12,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addSource}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      alignSelf: 'flex-start',
                      padding: '6px 12px', borderRadius: 999,
                      fontFamily: HEADLINE_FONT, fontSize: 11, fontWeight: 700,
                      letterSpacing: '0.04em', textTransform: 'uppercase',
                      backgroundColor: S.primaryContainer,
                      color: S.onPrimaryContainer,
                      border: 'none', cursor: 'pointer',
                    }}
                  >
                    <Plus size={12} strokeWidth={2.5} />
                    Add source
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sources.map((src, i) => <SourceItem key={i} src={src} />)}
                </div>
              )}
            </SectionCard>
          )}
        </div>

        {/* RIGHT column — exposure grids, ordered Category → Region → Value Chain */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionCard title="Category Exposure" icon={Layers}>
            {isEditing ? (
              <EditableCategoryGrid exposures={draftCatExp} onChange={setDraftCatExp} />
            ) : (
              <CategoryExposureGrid exposures={catExp} />
            )}
          </SectionCard>
          <SectionCard title="Regional Exposure" icon={MapPin} accent={S.onSecondaryContainer}>
            {isEditing ? (
              <EditableRegionGrid exposures={draftRegExp} onChange={setDraftRegExp} />
            ) : (
              <RegionExposureGrid exposures={regExp} />
            )}
          </SectionCard>
          <SectionCard title="Value Chain Exposure" icon={Cpu} accent={S.onTertiaryContainer}>
            {isEditing ? (
              <EditableValueChainGrid exposures={draftVcExp} onChange={setDraftVcExp} />
            ) : (
              <ValueChainExposureGrid exposures={vcExp} />
            )}
          </SectionCard>
        </div>
      </div>

      {/* Admin toolbar — lower-right pill buttons matching the editorial
          language of FilterChip / DirectionPill / MetaChip. No icons. */}
      {canEdit && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          gap: 10, marginTop: 24,
        }}>
          {saveError && isEditing && (
            <span style={{ color: S.error, fontSize: 12, marginRight: 4 }}>
              {saveError}
            </span>
          )}
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              style={{
                padding: '8px 20px',
                borderRadius: 999,
                fontFamily: HEADLINE_FONT,
                fontSize: 11, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                backgroundColor: S.primaryContainer,
                color: S.onPrimaryContainer,
                border: 'none', cursor: 'pointer',
              }}
            >
              Edit
            </button>
          )}
          {isEditing && (
            <>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                style={{
                  padding: '8px 20px',
                  borderRadius: 999,
                  fontFamily: HEADLINE_FONT,
                  fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  backgroundColor: S.surfaceLow,
                  color: S.onSurfaceVariant,
                  border: 'none',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '8px 20px',
                  borderRadius: 999,
                  fontFamily: HEADLINE_FONT,
                  fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  backgroundColor: S.primary,
                  color: '#ffffff',
                  border: 'none',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Editable exposure grids (used in ExpandedPanel edit mode) ─────
const EditableCategoryGrid: FC<{
  exposures: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}> = ({ exposures, onChange }) => {
  const grouped = {
    Hair: CATEGORIES.filter((c) => c.group === 'Hair'),
    LHC:  CATEGORIES.filter((c) => c.group === 'LHC'),
  };
  const set = (key: string, val: number) => onChange({ ...exposures, [key]: val });
  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([group, cats]) => (
        <div key={group}>
          <div
            className="text-[10px] font-semibold mb-2"
            style={{ color: S.onSurfaceVariant, letterSpacing: '0.08em' }}
          >
            {group.toUpperCase()}
          </div>
          <div className="grid grid-cols-4 gap-3">
            {cats.map((cat) => {
              const current = readExposure(exposures, cat.name, cat.id);
              return (
                <div key={cat.id} className="flex flex-col items-center gap-1.5">
                  <EditableDots
                    value={current}
                    onChange={(v) => set(cat.name, v)}
                    tone="emerald"
                  />
                  <div
                    className="text-[10px] font-medium text-center"
                    style={{ color: S.onSurface }}
                  >
                    {shortCat(cat.name)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

const EditableRegionGrid: FC<{
  exposures: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}> = ({ exposures, onChange }) => (
  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
    {REGIONS.map((r) => (
      <div key={r.id} className="flex flex-col gap-1.5">
        <div className="text-[11px] font-medium" style={{ color: S.onSurface }}>
          {r.label}
        </div>
        <EditableDots
          value={exposures?.[r.id] ?? 0}
          onChange={(v) => onChange({ ...exposures, [r.id]: v })}
          tone="emerald"
        />
      </div>
    ))}
  </div>
);

const EditableValueChainGrid: FC<{
  exposures: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}> = ({ exposures, onChange }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
      {VC_STEPS.map((step) => (
        <div key={step.id} className="flex flex-col gap-1.5">
          <div
            className="text-[11px] font-medium"
            style={{ color: S.onSurface }}
          >
            {step.label}
          </div>
          <EditableDots
            value={readVCExposure(exposures, step)}
            onChange={(v) => onChange({ ...exposures, [step.id]: v })}
            tone="purple"
          />
        </div>
      ))}
    </div>
  </div>
);

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
