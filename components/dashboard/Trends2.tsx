/**
 * Trends 2 — Editorial Intelligence View
 *
 * Alternative visualisation for the trends page, inspired by the Stitch
 * "Digital Curator" design language (docs/DESIGN.md in stitch_fmcg_trend_navigator-3).
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

import React, { useMemo, useState, useEffect, useRef, useCallback, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, TrendingUp, TrendingDown, Users, Store, Cpu, Landmark,
  Leaf, Swords, Sparkles, ChevronDown,
  FileText, BarChart3, Clock, Zap, MapPin, Layers, Newspaper,
  Globe, ExternalLink, AlertTriangle,
  ArrowUp, ArrowDown, ArrowUpDown,
  Plus, Trash2, Info, Lock, Check, PenLine,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import { getTrendProposals, saveMyProposal } from '@/api/client';
import { CATEGORIES, fmtPct, fmtShift, shortCat } from '@/lib/format';
import type {
  Trend, ForceName, CategoryId, TrendSource, TrendUpdate,
  TrendProposalPatch, TrendProposalsResponse,
} from '@/types';

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

// ─── Editorial design tokens (from docs/DESIGN.md) ────────────────────
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

// ═══════════════════════════════════════════════════════════════════
// Multi-expert scoring — 3-mode layer (June 2026)
//
// One editorial table, three modes (the table layout is unchanged — only the
// behaviour of the cells / trend tab changes):
//   • list   — the agreed truth that feeds the model (read-only). A trend whose
//              endorsed truth deviates from the AI baseline shows its dots in
//              green; the AI suggestion is on hover.
//   • input  — every signed-in expert scores from a blank slate in the trend
//              tab; changes auto-save; the AI suggestion is on hover of a grey
//              dot / blank field.
//   • review — admin-only: the expert average vs the AI suggestion with the
//              delta and the named "who scored what"; the admin endorses one
//              trend at a time, which writes the new truth through the normal
//              (validated, audited) trend PUT.
//
// The engine only ever consumes the trend's own columns; proposals are a
// parallel, named, advisory store — never auto-applied.
// ═══════════════════════════════════════════════════════════════════

type ScoringMode = 'list' | 'input' | 'review';

const EXPERT_COLOR   = '#6b4fc4';   // expert aggregate — violet
const REVIEWED_COLOR = '#1f7a3d';   // reviewed truth that deviates from AI — green
const DELTA_COLOR    = '#b07d2b';   // delta chip — gold

const pctI = (v: number | null | undefined): string =>
  v == null ? '—' : `${Math.round(v * 100)}%`;

// AI baseline reads. An un-overridden trend still holds its AI value, so the
// current value IS the AI suggestion when there is no snapshot and no override.
const aiProb = (t: Trend): number | undefined =>
  t.ai_suggestion?.probability ?? (t.user_override ? undefined : (t.probability ?? undefined));
const aiGp1 = (t: Trend): number | undefined => {
  const g = (t as Trend & { gp1_pct_affected?: number }).gp1_pct_affected;
  return t.ai_suggestion?.gp1_pct_affected ?? (t.user_override ? undefined : g);
};

/** A trend is "reviewed & changed" (→ green dots, "Reviewed" chip) when it
 *  carries an admin override AND its truth differs from the AI baseline.
 *  Without a snapshot we treat any override as a change. */
const reviewedDeviates = (t: Trend): boolean => {
  if (!t.user_override) return false;
  const ap = aiProb(t);
  const ag = aiGp1(t);
  const curG = (t as Trend & { gp1_pct_affected?: number }).gp1_pct_affected;
  if (ap == null && ag == null) return true;
  const pDev = ap != null && Math.round(t.probability ?? 0) !== Math.round(ap);
  const gDev = ag != null && curG != null && Math.round(curG * 100) !== Math.round(ag * 100);
  return pDev || gDev;
};

/** Colourable, read-only 1–5 dot bar (mirrors DotBar's geometry). */
const ColorDots: FC<{ value: number; color: string; title?: string; muted?: boolean }> = ({ value, color, title, muted }) => (
  <div className="flex gap-1.5" title={title} aria-label={`${value} of 5`} style={{ cursor: title ? 'help' : undefined }}>
    {[1, 2, 3, 4, 5].map((d) => (
      <span key={d} className="inline-block w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: d <= value ? color : S.surfaceHigh, opacity: muted ? 0.5 : 1 }} />
    ))}
  </div>
);

const DeltaChip: FC<{ value: number; unit?: string; digits?: number }> = ({ value, unit = '', digits = 1 }) => {
  const zero = Math.abs(value) < (digits === 0 ? 0.5 : 0.05);
  const sign = value > 0 ? '+' : '−';
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 999, whiteSpace: 'nowrap',
      backgroundColor: zero ? S.surfaceLow : 'rgba(176,125,43,0.15)',
      color: zero ? S.mutedText : DELTA_COLOR,
    }}>
      {zero ? '=' : `${sign}${Math.abs(value).toFixed(digits)}${unit}`}
    </span>
  );
};

const Dash: FC = () => <span style={{ color: S.mutedText, fontSize: 12 }}>—</span>;
const Val: FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 14, color: S.onSurface }}>{children}</span>
);

// ── Collapsed-row cells (mode-aware, read-only — editing lives in the tab) ──
const ProbCell: FC<{ trend: Trend; mode: ScoringMode; myProposal?: TrendProposalPatch }> = ({ trend, mode, myProposal }) => {
  const ai = aiProb(trend);
  if (mode === 'list') {
    const dev = !!trend.user_override && ai != null && Math.round(trend.probability ?? 0) !== Math.round(ai);
    return (
      <ColorDots value={Math.round(trend.probability ?? 0)} color={dev ? REVIEWED_COLOR : S.primary}
        title={ai != null ? `AI suggested ${Math.round(ai)} / 5${trend.user_override ? ` · endorsed ${Math.round(trend.probability ?? 0)} / 5` : ''}` : undefined} />
    );
  }
  if (mode === 'input') {
    const my = myProposal?.probability ?? trend.proposal_summary?.my?.probability;
    return (
      <ColorDots value={my != null ? Math.round(my) : 0} color={S.primary} muted={my == null}
        title={ai != null ? `AI suggests ${Math.round(ai)} / 5 — open the trend to score` : 'Open the trend to score'} />
    );
  }
  const agg = trend.proposal_summary?.probability;
  if (!agg || agg.avg == null) return <Dash />;
  const d = ai != null ? agg.avg - ai : null;
  return (
    <div className="flex items-center gap-2">
      <ColorDots value={Math.round(agg.avg)} color={EXPERT_COLOR} title={`Expert average ${agg.avg.toFixed(1)} / 5 · ${agg.count} scored`} />
      <span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 12, color: EXPERT_COLOR }}>{agg.avg.toFixed(1)}</span>
      {d != null && <DeltaChip value={d} />}
    </div>
  );
};

const Gp1Cell: FC<{ trend: Trend; mode: ScoringMode; myProposal?: TrendProposalPatch }> = ({ trend, mode, myProposal }) => {
  const ai = aiGp1(trend);
  const cur = (trend as Trend & { gp1_pct_affected?: number }).gp1_pct_affected;
  const big: React.CSSProperties = { fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: '1.15rem' };
  if (mode === 'list') {
    const dev = !!trend.user_override && ai != null && cur != null && Math.round(cur * 100) !== Math.round(ai * 100);
    return (
      <span style={{ ...big, color: dev ? REVIEWED_COLOR : S.onSurface, cursor: ai != null ? 'help' : undefined }}
        title={ai != null ? `AI suggested ${pctI(ai)}${trend.user_override ? ` · endorsed ${pctI(cur)}` : ''}` : undefined}>
        {cur != null ? fmtPct(cur) : '—'}
      </span>
    );
  }
  if (mode === 'input') {
    const my = myProposal?.gp1_pct_affected ?? trend.proposal_summary?.my?.gp1_pct_affected;
    return (
      <span style={{ ...big, color: my != null ? S.onSurface : S.onSurfaceVariant, cursor: 'help' }}
        title={ai != null ? `AI suggests ${pctI(ai)} — open the trend to score` : 'Open the trend to score'}>
        {my != null ? pctI(my) : '—'}
      </span>
    );
  }
  const agg = trend.proposal_summary?.gp1_pct_affected;
  if (!agg || agg.avg == null) return <Dash />;
  const d = ai != null ? (agg.avg - ai) * 100 : null;
  return (
    <div className="flex items-center gap-2 justify-end">
      <span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: '1.05rem', color: EXPERT_COLOR }}
        title={`Expert average ${pctI(agg.avg)} · ${agg.count} scored`}>{pctI(agg.avg)}</span>
      {d != null && <DeltaChip value={d} unit="pp" digits={0} />}
    </div>
  );
};

const RowEndCell: FC<{ trend: Trend; mode: ScoringMode; myProposal?: TrendProposalPatch }> = ({ trend, mode, myProposal }) => {
  const [tip, setTip] = useState(false);
  const dirSign = trend.direction === 'Contraction' ? -1 : 1;

  // Expert Input — the user's OWN shift from their own probability × GP1%.
  if (mode === 'input') {
    const my = myProposal ?? trend.proposal_summary?.my ?? undefined;
    const p = my?.probability;
    const g = my?.gp1_pct_affected;
    if (p == null || g == null) {
      return <span style={{ color: S.onSurfaceVariant, fontSize: 13, fontWeight: 700 }}>—</span>;
    }
    const myShift = dirSign * (Math.max(1, Math.min(5, p)) / 6) * g;
    return (
      <span className="font-bold text-[14px]"
        title={`Your shift = (your prob / 6) × your GP1% × direction = (${Math.round(p)}/6) × ${pctI(g)} × ${dirSign > 0 ? '+1' : '−1'}`}
        style={{ color: myShift < 0 ? S.error : S.onPrimaryContainer, cursor: 'help' }}>
        {fmtShift(myShift)}
      </span>
    );
  }

  // Trend List & Review — the model's current (truth) shift, calc on hover.
  const shift = trend.gp1_shift;
  const probClamped = Math.max(1, Math.min(5, Math.round(trend.probability ?? 0)));
  const gp1 = (trend as Trend & { gp1_pct_affected?: number }).gp1_pct_affected ?? 0;
  return (
    <div className="text-right" style={{ position: 'relative' }}
      onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)}>
      <span className="font-bold text-[14px]" style={{
        color: shift != null && shift < 0 ? S.error : S.onPrimaryContainer,
        borderBottom: `1px dotted ${S.onSurfaceVariant}66`, cursor: 'help',
      }}>
        {shift != null ? fmtShift(shift) : '—'}
      </span>
      {tip && shift != null && (
        <div role="tooltip" onClick={(e) => e.stopPropagation()} style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 40, minWidth: 240, maxWidth: 320,
          padding: '10px 12px', borderRadius: 8, backgroundColor: S.onSurface, color: S.surface,
          fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, lineHeight: 1.5, textAlign: 'left',
          boxShadow: '0 10px 24px rgba(0,52,94,0.28)', pointerEvents: 'none',
        }}>
          Shift = (prob/6) × GP1% × direction
          <br />= ({probClamped}/6) × {(gp1 * 100).toFixed(1)}% × {dirSign > 0 ? '+1' : '−1'} = {fmtShift(shift)}
        </div>
      )}
    </div>
  );
};

// ── Review-status cell (6th column) ──
// list   → admin-endorsed indicator (truth differs from AI)
// input  → "reviewed by you": probability + GP1% + ≥1 category exposure rated
// review → how many experts have scored this trend
const ReviewStatusCell: FC<{ trend: Trend; mode: ScoringMode; myProposal?: TrendProposalPatch }> = ({ trend, mode, myProposal }) => {
  const pill: React.CSSProperties = {
    fontFamily: HEADLINE_FONT, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em',
    textTransform: 'uppercase', padding: '4px 11px', borderRadius: 999,
  };
  if (mode === 'input') {
    const my = myProposal ?? trend.proposal_summary?.my ?? undefined;
    const hasProb = my?.probability != null;
    const hasGp1 = my?.gp1_pct_affected != null;
    const hasCat = !!my?.category_exposure && Object.keys(my.category_exposure).length > 0;
    const done = hasProb && hasGp1 && hasCat;
    return (
      <div className="flex justify-end">
        <span className="inline-flex items-center gap-1.5"
          title={done
            ? 'Reviewed — you rated probability, GP1% and at least one category exposure'
            : 'To complete: rate probability, GP1% and at least one category exposure'}
          style={{ ...pill, backgroundColor: done ? 'rgba(31,122,61,0.10)' : S.surfaceLow, color: done ? REVIEWED_COLOR : S.onSurfaceVariant }}>
          {done ? <><Check size={11} strokeWidth={2.6} /> Reviewed</> : 'In progress'}
        </span>
      </div>
    );
  }
  if (mode === 'review') {
    const count = trend.proposal_summary?.count ?? 0;
    return (
      <div className="flex justify-end">
        <span style={{ ...pill, backgroundColor: count > 0 ? 'rgba(107,79,196,0.10)' : S.surfaceLow, color: count > 0 ? EXPERT_COLOR : S.onSurfaceVariant }}>
          {count > 0 ? `◆ ${count}` : '—'}
        </span>
      </div>
    );
  }
  const reviewed = reviewedDeviates(trend);
  return (
    <div className="flex justify-end">
      {reviewed ? (
        <span className="inline-flex items-center gap-1" title="Reviewed by an admin — differs from the AI baseline"
          style={{ ...pill, color: REVIEWED_COLOR, backgroundColor: 'rgba(31,122,61,0.10)' }}>
          <Check size={11} strokeWidth={2.6} /> Reviewed
        </span>
      ) : <span style={{ color: S.onSurfaceVariant, fontSize: 12 }}>—</span>}
    </div>
  );
};

// ── Mode toggle (Review tab is admin-only) ──
const ModeToggle: FC<{ mode: ScoringMode; onChange: (m: ScoringMode) => void; isAdmin: boolean }> = ({ mode, onChange, isAdmin }) => {
  const opts: Array<{ id: ScoringMode; label: string; dot: string }> = [
    { id: 'list', label: 'Trend List', dot: REVIEWED_COLOR },
    { id: 'input', label: 'Expert Input', dot: S.primary },
    ...(isAdmin ? [{ id: 'review' as ScoringMode, label: 'Review & Endorse', dot: EXPERT_COLOR }] : []),
  ];
  return (
    <div role="tablist" aria-label="Scoring mode" style={{
      display: 'inline-flex', gap: 4, padding: 5, borderRadius: 999, backgroundColor: S.surface, border: `1px solid ${S.cardBorder}`,
    }}>
      {opts.map((o) => {
        const active = mode === o.id;
        return (
          <button key={o.id} role="tab" aria-selected={active} onClick={() => onChange(o.id)}
            className="inline-flex items-center gap-2 transition-colors"
            style={{
              padding: '9px 18px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontFamily: HEADLINE_FONT, fontSize: 13, fontWeight: 700,
              backgroundColor: active ? S.primary : 'transparent', color: active ? '#fff' : S.onSurfaceVariant,
            }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: active ? '#ffffff' : o.dot }} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
};

// ── Diffusion-curve visualization (kept from the expert-input mockup) ──
const CURVE_PATHS: Record<string, string> = {
  s_curve: 'M2,16 C9,15 11,3 26,2',
  linear: 'M2,16 L26,2',
  front_loaded: 'M2,16 Q6,3 26,2',
  back_loaded: 'M2,16 Q22,15 26,2',
  step_function: 'M2,16 L18,16 L18,2 L26,2',
};
const DiffusionGlyph: FC<{ curve: string; color: string }> = ({ curve, color }) => (
  <svg width="30" height="18" viewBox="0 0 28 18" aria-hidden="true">
    <path d={CURVE_PATHS[curve] ?? CURVE_PATHS.s_curve} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
  </svg>
);
const DiffusionPicker: FC<{ value?: string; ai?: string; distribution?: Record<string, number>; onChange?: (c: string) => void }> = ({ value, ai, distribution, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {Object.entries(DIFFUSION_LABELS).map(([key, meta]) => {
      const selected = value === key;
      const n = distribution?.[key];
      return (
        <button key={key} type="button" onClick={() => onChange?.(key)} title={meta.description}
          aria-pressed={selected} style={{
            position: 'relative', minWidth: 78, textAlign: 'center', padding: '8px 10px 6px', borderRadius: 9, cursor: 'pointer',
            backgroundColor: S.surface, border: `1px solid ${selected ? S.primary : S.cardBorder}`,
            boxShadow: selected ? `inset 0 0 0 1px ${S.primary}` : 'none',
          }}>
          {ai === key && <Sparkles size={11} style={{ position: 'absolute', top: 5, right: 5, color: S.primary }} />}
          <DiffusionGlyph curve={key} color={selected ? S.primary : S.onSurfaceVariant} />
          <div style={{ fontSize: 11, fontWeight: 700, color: S.onSurface, marginTop: 3 }}>{meta.label}</div>
          {n != null && n > 0 && <div style={{ fontSize: 10, fontWeight: 800, color: EXPERT_COLOR, marginTop: 2 }}>×{n}</div>}
        </button>
      );
    })}
  </div>
);

const AiRef: FC<{ label: string }> = ({ label }) => (
  <span title="AI suggestion (applies if you don't score this field)" style={{
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999,
    backgroundColor: S.surfaceLow, color: S.onSurfaceVariant, fontSize: 11, fontWeight: 700, fontFamily: HEADLINE_FONT, whiteSpace: 'nowrap', cursor: 'help',
  }}>
    <Sparkles size={11} /> {label}
  </span>
);

/** Lazily fetch the per-trend proposals payload. Degrades to null (the UI shows
 *  honest empty states) if the endpoint isn't deployed yet. */
function useTrendProposals(trendId: string): { data: TrendProposalsResponse | null; loaded: boolean } {
  const [data, setData] = useState<TrendProposalsResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    getTrendProposals(trendId)
      .then((r) => { if (!cancelled) { setData(r); setLoaded(true); } })
      .catch(() => { if (!cancelled) { setData(null); setLoaded(true); } });
    return () => { cancelled = true; };
  }, [trendId]);
  return { data, loaded };
}

// ── Expert Input panel (trend tab) — blank scoring, auto-save, AI on hover ──
const ExpertInputPanel: FC<{ trend: Trend; onMyChange?: (trendId: string, my: TrendProposalPatch) => void }> = ({ trend, onMyChange }) => {
  const { data, loaded } = useTrendProposals(trend.id);
  const [draft, setDraft] = useState<TrendProposalPatch>({});
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const draftRef = useRef<TrendProposalPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (loaded && !hydrated) {
      const my = (data?.my ?? {}) as TrendProposalPatch;
      setDraft(my); draftRef.current = my; setHydrated(true);
      onMyChange?.(trend.id, my);
    }
  }, [loaded, hydrated, data, onMyChange, trend.id]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const flush = useCallback(() => {
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveMyProposal(trend.id, draftRef.current).then(() => setStatus('saved')).catch(() => setStatus('error'));
    }, 600);
  }, [trend.id]);
  const patch = useCallback((p: Partial<TrendProposalPatch>) => {
    const next = { ...draftRef.current, ...p };
    draftRef.current = next;
    setDraft(next);
    onMyChange?.(trend.id, next);
    flush();
  }, [flush, onMyChange, trend.id]);

  const ai = trend.ai_suggestion ?? {};
  const gp1Int = draft.gp1_pct_affected != null ? Math.round(draft.gp1_pct_affected * 100) : undefined;
  const dist = data?.aggregate?.diffusion_curve?.distribution;
  const statusText = status === 'saving' ? 'Saving…'
    : status === 'saved' ? '✓ All changes saved'
    : status === 'error' ? '⚠ Save failed — retries on next change'
    : 'Changes auto-save';

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ padding: '24px 32px 32px', backgroundColor: S.surface, borderTop: `1px solid ${S.cardBorder}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <span className="inline-flex items-center gap-2" style={{ fontFamily: HEADLINE_FONT, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: S.primary }}>
          <PenLine size={13} strokeWidth={2.4} /> Expert Input · your proposal
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: status === 'error' ? S.error : status === 'saved' ? REVIEWED_COLOR : S.onSurfaceVariant }}>{statusText}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,1fr)', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionCard title="Context" icon={FileText}>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: S.onSurface, whiteSpace: 'pre-wrap' }}>
              {trend.description || <em style={{ color: S.mutedText }}>No description documented.</em>}
            </p>
          </SectionCard>

          <SectionCard title="Probability" icon={Zap} footnote="1 = Very Unlikely · 3 = Possible · 5 = Almost Certain. Hover the dots for the AI suggestion.">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <span title={ai.probability != null ? `AI suggests ${ai.probability} / 5` : undefined}>
                <DotBar value={draft.probability ?? 0} editable onChange={(v) => patch({ probability: v })} />
              </span>
              <AiRef label={ai.probability != null ? `AI ${ai.probability}/5` : 'AI —'} />
            </div>
          </SectionCard>

          <SectionCard title="Impact — GP1 % exposed" icon={BarChart3} footnote="Share of category GP1 this trend can move at full materialization.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="range" min={0} max={100} step={1} value={gp1Int ?? 0}
                onChange={(e) => patch({ gp1_pct_affected: parseInt(e.target.value, 10) / 100 })}
                title={ai.gp1_pct_affected != null ? `AI suggests ${pctI(ai.gp1_pct_affected)}` : undefined} style={{ flex: 1 }} />
              <input type="number" min={0} max={100} step={1} value={gp1Int ?? ''} placeholder="—"
                onChange={(e) => { const n = e.target.value === '' ? undefined : Math.max(0, Math.min(100, parseInt(e.target.value, 10))); patch({ gp1_pct_affected: n == null ? undefined : n / 100 }); }}
                style={{ width: 70, padding: '6px 8px', borderRadius: 8, border: `1px solid ${S.cardBorder}`, backgroundColor: S.surfaceLow, color: S.onSurface, fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 15, textAlign: 'right' }} />
              <span style={{ color: S.mutedText, fontSize: 12 }}>%</span>
              <AiRef label={ai.gp1_pct_affected != null ? `AI ${pctI(ai.gp1_pct_affected)}` : 'AI —'} />
            </div>
          </SectionCard>

          <SectionCard title="Materialization timing" icon={Clock}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <FieldLabel>Peak Year</FieldLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="number" min={2026} max={2035} step={1} value={draft.peak_year ?? ''} placeholder="—"
                    onChange={(e) => patch({ peak_year: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })}
                    style={{ width: 110, padding: '8px 10px', borderRadius: 8, border: `1px solid ${S.cardBorder}`, backgroundColor: S.surfaceLow, color: S.onSurface, fontSize: 13, fontWeight: 700 }} />
                  <AiRef label={ai.peak_year != null ? `AI ${ai.peak_year}` : 'AI —'} />
                </div>
              </div>
              <div>
                <FieldLabel>Diffusion Curve</FieldLabel>
                <DiffusionPicker value={draft.diffusion_curve} ai={ai.diffusion_curve} distribution={dist} onChange={(c) => patch({ diffusion_curve: c })} />
              </div>
            </div>
          </SectionCard>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionCard title="Category Exposure" icon={Layers} footnote="Grey = unscored. If you leave a field blank, the AI baseline applies.">
            <EditableCategoryGrid exposures={(draft.category_exposure ?? {}) as Record<string, number>} onChange={(e) => patch({ category_exposure: e })} />
          </SectionCard>
          <SectionCard title="Regional Exposure" icon={MapPin} accent={S.onSecondaryContainer}>
            <EditableRegionGrid exposures={(draft.regional_exposure ?? {}) as Record<string, number>} onChange={(e) => patch({ regional_exposure: e })} />
          </SectionCard>
          <SectionCard title="Value Chain Exposure" icon={Cpu} accent={S.onTertiaryContainer}>
            <EditableValueChainGrid exposures={(draft.vc_exposure ?? {}) as Record<string, number>} onChange={(e) => patch({ vc_exposure: e })} />
          </SectionCard>
        </div>
      </div>

      <div className="inline-flex items-center gap-1.5" style={{ marginTop: 18, padding: '8px 14px', borderRadius: 10, backgroundColor: S.surfaceLow, color: S.onSurfaceVariant, fontSize: 12.5, lineHeight: 1.5 }}>
        <Sparkles size={13} style={{ flexShrink: 0, color: S.primary }} />
        <span>Your scores are a proposal. The AI suggestion stays the model&apos;s value until an admin endorses it.</span>
      </div>
    </div>
  );
};

// ── Review compare row (expert ø over AI, with delta + who-scored) ──
// Per-cell exposure comparison (expert ø vs AI) for the Review panel.
const ExposureCompareBlock: FC<{ title: string; aiMap?: Record<string, number>; aggMap?: Record<string, { avg?: number; count: number }> }> = ({ title, aiMap, aggMap }) => {
  const keys = aggMap ? Object.keys(aggMap) : [];
  if (keys.length === 0) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: S.onSurfaceVariant, margin: '8px 0 6px' }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))', gap: 8 }}>
        {keys.map((k) => {
          const e = aggMap![k]?.avg;
          const a = aiMap?.[k];
          const d = (e != null && a != null) ? e - a : null;
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 10px', border: `1px solid ${S.cardBorder}`, borderRadius: 8 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: S.onSurface }}>{shortCat(k)}</span>
              <span className="inline-flex items-center gap-2">
                <span style={{ fontSize: 12, fontWeight: 800, color: EXPERT_COLOR }} title={`${aggMap![k].count} scored`}>ø{e != null ? e.toFixed(1) : '—'}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: S.primary }}>AI {a ?? '—'}</span>
                {d != null && <DeltaChip value={d} />}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CompareRow: FC<{ label: string; sub?: string; expert: React.ReactNode; ai: React.ReactNode; delta?: React.ReactNode; who?: string }> = ({ label, sub, expert, ai, delta, who }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr auto', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: `1px solid ${S.surfaceLow}` }}>
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: S.onSurface }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: S.mutedText }}>{sub}</div>}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }} title={who}>
      <div className="flex items-center gap-2" style={{ cursor: who ? 'help' : undefined }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: EXPERT_COLOR, width: 22 }}>ø</span>{expert}
      </div>
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 9, fontWeight: 800, color: S.primary, width: 22 }}>AI</span>{ai}
      </div>
    </div>
    <div style={{ justifySelf: 'end' }}>{delta}</div>
  </div>
);

// ── Review & Endorse panel (admin only) ──
const ReviewPanel: FC<{ trend: Trend; updateTrend?: (trendId: string, updates: TrendUpdate) => Promise<void> }> = ({ trend, updateTrend }) => {
  const { data, loaded } = useTrendProposals(trend.id);
  const [choice, setChoice] = useState<'experts' | 'ai'>('experts');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const agg = data?.aggregate;
  const scorers = data?.scorers ?? [];
  const ai = trend.ai_suggestion ?? {};
  const count = scorers.length || (trend.proposal_summary?.count ?? 0);

  const whoFor = (field: 'probability' | 'gp1_pct_affected' | 'peak_year' | 'diffusion_curve'): string | undefined => {
    const rows = scorers.filter((s) => s[field] != null);
    if (rows.length === 0) return undefined;
    return rows.map((s) => `${s.name}${s.role ? ` (${s.role})` : ''}: ${field === 'gp1_pct_affected' ? pctI(s[field] as number) : s[field]}`).join('\n');
  };

  const mapCells = (m?: Record<string, { avg?: number }>): Record<string, number> | undefined => {
    if (!m) return undefined;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(m)) if (v.avg != null) out[k] = Math.round(v.avg);
    return Object.keys(out).length ? out : undefined;
  };
  const buildExperts = (): TrendUpdate => {
    const u: TrendUpdate = {};
    if (agg?.probability?.avg != null) u.probability = Math.round(agg.probability.avg);
    if (agg?.gp1_pct_affected?.avg != null) u.gp1_pct_affected = Math.max(0, Math.min(1, agg.gp1_pct_affected.avg));
    if (agg?.peak_year?.median != null) u.peak_year = Math.round(agg.peak_year.median);
    if (agg?.diffusion_curve?.mode) u.diffusion_curve = agg.diffusion_curve.mode;
    const c = mapCells(agg?.category_exposure); if (c) u.category_exposure = c;
    const r = mapCells(agg?.regional_exposure); if (r) u.regional_exposure = r;
    const vc = mapCells(agg?.vc_exposure); if (vc) u.vc_exposure = vc;
    return u;
  };
  const buildAi = (): TrendUpdate => ({
    probability: ai.probability, gp1_pct_affected: ai.gp1_pct_affected, peak_year: ai.peak_year,
    diffusion_curve: ai.diffusion_curve, category_exposure: ai.category_exposure,
    regional_exposure: ai.regional_exposure, vc_exposure: ai.vc_exposure,
  });
  const endorse = async () => {
    if (!updateTrend) return;
    setErr(null); setSaving(true);
    try { await updateTrend(trend.id, choice === 'experts' ? buildExperts() : buildAi()); setDone(true); }
    catch (e) { setErr((e as Error)?.message ?? 'Endorse failed'); }
    finally { setSaving(false); }
  };

  const eProb = agg?.probability?.avg, aProb = ai.probability;
  const eGp1 = agg?.gp1_pct_affected?.avg, aGp1 = ai.gp1_pct_affected;
  const ePeak = agg?.peak_year?.median, aPeak = ai.peak_year;
  const eCurve = agg?.diffusion_curve?.mode, aCurve = ai.diffusion_curve;

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ padding: '24px 32px 30px', backgroundColor: S.surface, borderTop: `1px solid ${S.cardBorder}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <span className="inline-flex items-center gap-2" style={{ fontFamily: HEADLINE_FONT, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: EXPERT_COLOR }}>
          <Users size={13} strokeWidth={2.4} /> Review &amp; Endorse · {count} expert{count === 1 ? '' : 's'} scored
        </span>
      </div>

      {loaded && count === 0 ? (
        <div style={{ padding: '26px 0', textAlign: 'center', color: S.onSurfaceVariant }}>
          <Sparkles size={20} style={{ color: S.primary }} />
          <div style={{ marginTop: 8, fontSize: 14 }}>No expert proposals yet for this trend.</div>
        </div>
      ) : (
        <>
          <div style={{ border: `1px solid ${S.cardBorder}`, borderRadius: 12, padding: '2px 16px 6px', backgroundColor: S.surface }}>
            <CompareRow label="Probability" sub="1–5"
              expert={eProb != null ? <ColorDots value={Math.round(eProb)} color={EXPERT_COLOR} /> : <Dash />}
              ai={aProb != null ? <ColorDots value={Math.round(aProb)} color={S.primary} /> : <Dash />}
              delta={eProb != null && aProb != null ? <DeltaChip value={eProb - aProb} /> : undefined}
              who={whoFor('probability')} />
            <CompareRow label="Impact — GP1 %"
              expert={<Val>{eGp1 != null ? pctI(eGp1) : '—'}</Val>} ai={<Val>{aGp1 != null ? pctI(aGp1) : '—'}</Val>}
              delta={eGp1 != null && aGp1 != null ? <DeltaChip value={(eGp1 - aGp1) * 100} unit="pp" digits={0} /> : undefined}
              who={whoFor('gp1_pct_affected')} />
            <CompareRow label="Peak year"
              expert={<Val>{ePeak != null ? Math.round(ePeak) : '—'}</Val>} ai={<Val>{aPeak != null ? aPeak : '—'}</Val>}
              delta={ePeak != null && aPeak != null ? <DeltaChip value={ePeak - aPeak} unit="y" digits={0} /> : undefined}
              who={whoFor('peak_year')} />
            <CompareRow label="Diffusion curve" sub="mode of expert votes"
              expert={<Val>{eCurve ? (DIFFUSION_LABELS[eCurve]?.label ?? eCurve) : '—'}</Val>}
              ai={<Val>{aCurve ? (DIFFUSION_LABELS[aCurve]?.label ?? aCurve) : '—'}</Val>}
              delta={eCurve ? <DeltaChip value={eCurve === aCurve ? 0 : 1} digits={0} /> : undefined}
              who={whoFor('diffusion_curve')} />
          </div>

          {/* Exposure comparison — expert ø vs AI, per cell */}
          {(agg && (
            (agg.category_exposure && Object.keys(agg.category_exposure).length > 0) ||
            (agg.regional_exposure && Object.keys(agg.regional_exposure).length > 0) ||
            (agg.vc_exposure && Object.keys(agg.vc_exposure).length > 0)
          )) ? (
            <div style={{ border: `1px solid ${S.cardBorder}`, borderRadius: 12, padding: '4px 16px 12px', backgroundColor: S.surface, marginTop: 12 }}>
              <ExposureCompareBlock title="Category exposure" aiMap={ai.category_exposure as Record<string, number> | undefined} aggMap={agg.category_exposure} />
              <ExposureCompareBlock title="Regional exposure" aiMap={ai.regional_exposure as Record<string, number> | undefined} aggMap={agg.regional_exposure} />
              <ExposureCompareBlock title="Value-chain exposure" aiMap={ai.vc_exposure as Record<string, number> | undefined} aggMap={agg.vc_exposure} />
            </div>
          ) : null}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginTop: 16 }}>
            <div style={{ display: 'inline-flex', border: `1px solid ${S.cardBorder}`, borderRadius: 999, overflow: 'hidden' }}>
              {(['experts', 'ai'] as const).map((c) => (
                <button key={c} type="button" onClick={() => setChoice(c)} aria-pressed={choice === c}
                  style={{ border: 'none', cursor: 'pointer', fontFamily: HEADLINE_FONT, fontSize: 12, fontWeight: 700, padding: '8px 16px',
                    backgroundColor: choice === c ? (c === 'experts' ? EXPERT_COLOR : S.primary) : S.surface, color: choice === c ? '#fff' : S.onSurfaceVariant }}>
                  {c === 'experts' ? 'Adopt experts ø' : 'Keep AI'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {err && <span style={{ color: S.error, fontSize: 12 }}>{err}</span>}
              {done && !err && <span style={{ color: REVIEWED_COLOR, fontSize: 12, fontWeight: 700 }}>✓ Endorsed</span>}
              <button type="button" onClick={endorse} disabled={saving || !updateTrend}
                style={{ padding: '9px 20px', borderRadius: 999, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                  fontFamily: HEADLINE_FONT, fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
                  backgroundColor: S.onSurface, color: '#fff', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Endorsing…' : done ? 'Endorse again' : 'Endorse trend →'}
              </button>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5" style={{ marginTop: 14, padding: '8px 14px', borderRadius: 10, backgroundColor: S.surfaceLow, color: S.onSurfaceVariant, fontSize: 12.5, lineHeight: 1.5 }}>
            <Check size={13} style={{ flexShrink: 0, color: REVIEWED_COLOR }} />
            <span>Endorsing writes the selected values as the trend&apos;s truth (validated &amp; audited) and flags the run stale. Shifts refresh after the next model run.</span>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Main component ────────────────────────────────────────────────
interface Trends2Props {
  /** Drill-through search seed (v3.6 journey layer): when the Consumer
   *  Journey navigates here with a trend name/code, the parent passes it
   *  down and Trends2 adopts it as the active search query. */
  initialSearch?: string | null;
}

const Trends2: FC<Trends2Props> = ({ initialSearch }) => {
  const { trends, loading, backendAvailable, updateTrend } = usePrism();
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | 'all'>('all');
  const [search, setSearch] = useState('');

  // Adopt drill-through queries from the Consumer Journey whenever the
  // parent hands down a new value (including re-navigations to the same
  // trend — page.tsx resets state between navigations).
  useEffect(() => {
    if (initialSearch != null && initialSearch !== '') setSearch(initialSearch);
  }, [initialSearch]);
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

  // Scoring mode (June 2026): Trend List (truth) · Expert Input · Review &
  // Endorse. Review is admin-only; a viewer can never land on it.
  const [mode, setMode] = useState<ScoringMode>('list');
  useEffect(() => {
    if (!isAdmin && mode === 'review') setMode('list');
  }, [isAdmin, mode]);

  // Live "my proposal" per trend so a collapsed row reflects what the user just
  // entered in the Expert Input tab (the trends-list payload only carries the
  // proposal as of page load). Seeded from the server, updated on each edit.
  const [myMap, setMyMap] = useState<Record<string, TrendProposalPatch>>({});
  useEffect(() => {
    setMyMap((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const t of trends) {
        const m = t.proposal_summary?.my;
        if (next[t.id] === undefined && m) { next[t.id] = m; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [trends]);
  const setMyProposal = useCallback((trendId: string, my: TrendProposalPatch) => {
    setMyMap((prev) => ({ ...prev, [trendId]: my }));
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

        {/* Scoring mode toggle + per-mode helper */}
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <ModeToggle mode={mode} onChange={setMode} isAdmin={isAdmin} />
          <p style={{ fontSize: 13, color: S.onSurfaceVariant, maxWidth: '42rem', lineHeight: 1.5 }}>
            {mode === 'list'
              ? 'The agreed truth that feeds the model. Reviewed trends that differ from the AI baseline show green dots; hover any score for the AI suggestion.'
              : mode === 'input'
              ? 'Score any trend from a blank slate — open a row and your changes auto-save. Hover a grey dot or blank field to see the AI suggestion.'
              : 'Compare the expert average against the AI suggestion and endorse one trend at a time. Hover an expert score to see who scored what.'}
          </p>
        </div>

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
              gridTemplateColumns: '2.2fr 0.9fr 1fr 0.9fr 0.8fr 0.95fr',
              backgroundColor: S.surfaceLow,
              color: S.onSurfaceVariant,
            }}
          >
            <SortHeader label="Trend"          sortKey="name"        currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
            <SortHeader label="Direction"      sortKey="direction"   currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
            <SortHeader label="Probability"    sortKey="probability" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
            <span className="inline-flex items-center justify-end w-full">
              <SortHeader label="GP1 % Affected" sortKey="gp1"         currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} align="right" />
              <Gp1InfoTip />
            </span>
            <SortHeader label="Shift"          sortKey="shift"       currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} align="right" />
            <span className="inline-flex items-center justify-end w-full text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: S.onSurfaceVariant }}>
              {mode === 'input' ? 'Your review' : mode === 'review' ? 'Proposals' : 'Reviewed'}
            </span>
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
                  mode={mode}
                  myProposal={myMap[t.id]}
                  onMyChange={setMyProposal}
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
          letterSpacing: 0, textAlign: 'left', boxShadow: '0 10px 24px rgba(0, 52, 94, 0.28)',
          pointerEvents: 'none', whiteSpace: 'normal' }}>
          <b>GP1 % Affected</b> — the share of a category&apos;s GP1 (gross profit after cost of goods)
          that this trend can realistically move at full materialization. Multiplied by probability and
          direction, it produces the Shift column.
        </span>
      )}
    </span>
  );
};

// ─── Trend row ─────────────────────────────────────────────────────
interface TrendRowProps {
  trend: Trend;
  isLast: boolean;
  expanded: boolean;
  onToggle: () => void;
  mode: ScoringMode;
  myProposal?: TrendProposalPatch;
  onMyChange?: (trendId: string, my: TrendProposalPatch) => void;
  isAdmin?: boolean;
  updateTrend?: (trendId: string, updates: Partial<Trend>) => Promise<void>;
}

const TrendRow: FC<TrendRowProps> = ({
  trend, isLast, expanded, onToggle, mode, myProposal, onMyChange, isAdmin = false, updateTrend,
}) => {
  const tile = FORCE_TILE[trend.force] ?? FORCE_TILE.Consumer;
  const { Icon } = tile;

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
          gridTemplateColumns: '2.2fr 0.9fr 1fr 0.9fr 0.8fr 0.95fr',
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

        {/* Probability — read-only here; scoring/endorsing happens in the trend tab */}
        <div><ProbCell trend={trend} mode={mode} myProposal={myProposal} /></div>

        {/* GP1 % — read-only here; editing happens in the trend tab */}
        <div className="text-right">
          <Gp1Cell trend={trend} mode={mode} myProposal={myProposal} />
        </div>

        {/* Shift — truth (list/review) or your own shift (input) */}
        <div className="text-right">
          <RowEndCell trend={trend} mode={mode} myProposal={myProposal} />
        </div>

        {/* Review status (6th column) */}
        <div className="text-right">
          <ReviewStatusCell trend={trend} mode={mode} myProposal={myProposal} />
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
            {mode === 'input' ? (
              <ExpertInputPanel trend={trend} onMyChange={onMyChange} />
            ) : mode === 'review' ? (
              <ReviewPanel trend={trend} updateTrend={updateTrend} />
            ) : (
              <ExpandedPanel trend={trend} isAdmin={isAdmin} updateTrend={updateTrend} />
            )}
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
        {/* D7 (June 2026): score provenance. Baseline values are AI-preset;
            an admin edit via this editor marks the trend expert-reviewed. */}
        <span
          title={trend.user_override
            ? 'Scores were AI-preset and have been reviewed/adjusted by an expert via the Trend editor.'
            : 'Scores are AI-preset from the evidence base — not yet expert-reviewed.'}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 999,
            fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
            backgroundColor: S.tertiaryContainer,
            color: S.onTertiaryContainer,
            textTransform: 'uppercase',
          }}>
          <Sparkles size={12} />
          {trend.user_override ? 'AI suggestion · expert-reviewed' : 'AI suggestion'}
        </span>
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

      {/* Viewer affordance — values above are admin-editable; make the
          read-only state explicit instead of silently inert. */}
      {!canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 24 }}>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ backgroundColor: S.surfaceLow, color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT,
              fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}
            title="Trend inputs are maintained by PRISM admins. Ask an administrator for changes.">
            <Lock size={11} strokeWidth={2.4} />
            Read-only · admin-maintained
          </span>
        </div>
      )}

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
