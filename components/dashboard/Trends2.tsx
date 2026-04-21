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
  FileText, BarChart3, Clock, Zap, MapPin, Layers, Newspaper,
  Globe, ExternalLink, AlertTriangle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import { CATEGORIES, fmtPct, fmtShift, shortCat } from '@/lib/format';
import type { Trend, ForceName, CategoryId } from '@/types';

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

// ─── Source item ──────────────────────────────────────────────────
const SourceItem: FC<{ src: { title: string; url: string; data?: string } }> = ({ src }) => {
  const cls = classifySource(src.url);
  const Icon = SOURCE_ICON[cls] ?? Newspaper;
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
          display: 'block', fontSize: 13, fontWeight: 600,
          color: S.onSurface, lineHeight: 1.35,
        }}>
          {src.title}
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

// ─── Main component ────────────────────────────────────────────────
const Trends2: FC = () => {
  const { trends, loading, backendAvailable } = usePrism();
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | 'all'>('all');
  const [search, setSearch] = useState('');
  // Which trend row is currently expanded to show category + VC exposure.
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
            <ExpandedPanel trend={trend} />
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
// The exposure grids are only rendered here (not inline) so the trend list
// stays scannable by default; click-to-expand surfaces the full detail.
const ExpandedPanel: FC<{ trend: Trend }> = ({ trend }) => {
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
        <DirectionPill direction={trend.direction} />
        {confidence && <MetaChip label={`Confidence · ${confidence}`} />}
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
        {dataSource && <MetaChip label={dataSource} />}
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
            <p style={{
              margin: 0, fontSize: 14, lineHeight: 1.6, color: S.onSurface,
              whiteSpace: 'pre-wrap',
            }}>
              {trend.description || <em style={{ color: S.mutedText }}>No description documented.</em>}
            </p>
          </SectionCard>

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
          </SectionCard>

          <SectionCard
            title="GP1 % Affected — Economic Anchoring"
            icon={BarChart3}
            footnote={
              <>
                What fraction of a category's GP1 can this trend realistically affect at full
                materialization? A 5/5 probability trend with {Math.round(gp1Pct * 100)}% GP1 affected
                means: maximum-severity trend, but only touches {Math.round(gp1Pct * 100)}% of the pool.
              </>
            }
          >
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
              <DotBar value={Math.round(probability)} />
              <div style={{
                padding: '6px 12px', borderRadius: 8,
                backgroundColor: S.surfaceLow,
                border: `1px solid ${S.cardBorder}`,
                fontFamily: HEADLINE_FONT,
                fontWeight: 800, fontSize: 15, color: S.primary,
              }}>
                {Math.round(probability)} / 5
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
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: S.mutedText, marginBottom: 6 }}>
                  Peak Year
                </div>
                <div style={{
                  padding: '8px 10px', borderRadius: 8,
                  fontSize: 13, fontWeight: 700, color: S.onSurface,
                  backgroundColor: S.surfaceLow,
                  border: `1px solid ${S.cardBorder}`,
                }}>
                  {peakYear}
                </div>
                <div style={{ fontSize: 11, color: S.mutedText, marginTop: 4 }}>
                  Year when 100% of impact materializes
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: S.mutedText, marginBottom: 6 }}>
                  Diffusion Curve
                </div>
                <div style={{
                  padding: '8px 10px', borderRadius: 8,
                  fontSize: 13, fontWeight: 700, color: S.onSurface,
                  backgroundColor: S.surfaceLow,
                  border: `1px solid ${S.cardBorder}`,
                }}>
                  {diffusionMeta.label}
                </div>
                <div style={{ fontSize: 11, color: S.mutedText, marginTop: 4 }}>
                  {diffusionMeta.description}
                </div>
              </div>
            </div>
          </SectionCard>

          {sources.length > 0 && (
            <SectionCard title={`Sources · ${sources.length}`} icon={Newspaper}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sources.map((src, i) => <SourceItem key={i} src={src} />)}
              </div>
            </SectionCard>
          )}
        </div>

        {/* RIGHT column — exposure grids, ordered Category → Region → Value Chain */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionCard title="Category Exposure" icon={Layers}>
            <CategoryExposureGrid exposures={catExp} />
          </SectionCard>
          <SectionCard title="Regional Exposure" icon={MapPin} accent={S.onSecondaryContainer}>
            <RegionExposureGrid exposures={regExp} />
          </SectionCard>
          <SectionCard title="Value Chain Exposure" icon={Cpu} accent={S.onTertiaryContainer}>
            <ValueChainExposureGrid exposures={vcExp} />
          </SectionCard>
        </div>
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
