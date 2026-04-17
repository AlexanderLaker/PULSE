/**
 * Trends 2 — Editorial Intelligence View (Vite dashboard)
 *
 * Alternative visualisation for the trends page, inspired by the Stitch
 * "Digital Curator" design language (see stitch_fmcg_trend_navigator-3/DESIGN.md):
 *   • Maritime blue palette with tonal layering (no 1px borders)
 *   • Manrope headlines + Inter body pairing
 *   • Pill category filter chips, dot-probability bar, pill direction badges
 *   • Editorial "insight rail" accent on section headers
 *
 * Functionality mirrors the original TrendExplorer expandable row:
 *   — click a row to reveal description, PRISM analysis, sources with tier
 *     badges, GP1 % Affected rationale, materialization timing, and
 *     category / value-chain / regional exposure grids.
 *
 * Data is wired to real trends from usePrism — no mock content.
 */

import React, { useMemo, useState, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, TrendingUp, TrendingDown, Users, Store, Cpu, Landmark,
  Leaf, Swords, Sparkles, ArrowLeft, ChevronDown, BarChart3, Clock,
  Globe, Newspaper, FileText, AlertTriangle, ExternalLink, MapPin,
  Layers, Zap,
} from 'lucide-react';
import usePrism from '../hooks/usePrism';
import { CATEGORIES, fmtPct, fmtShift } from '../lib/format';
import type { Trend, ForceName, CategoryId } from '../types';

// ─── Editorial Palette ────────────────────────────────────────────────
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
};

const HEADLINE_FONT = "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const BODY_FONT     = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

// ─── Force Tile Mapping ──────────────────────────────────────────────
const FORCE_TILE: Record<ForceName, { Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; bg: string; fg: string }> = {
  Consumer:      { Icon: Users,    bg: S.primaryContainer,   fg: S.primary },
  Customer:      { Icon: Store,    bg: S.secondaryContainer, fg: S.onSecondaryContainer },
  Technology:    { Icon: Cpu,      bg: S.tertiaryContainer,  fg: S.onTertiaryContainer },
  Government:    { Icon: Landmark, bg: S.surfaceHighest,     fg: S.onSurface },
  Environmental: { Icon: Leaf,     bg: S.surfaceHigh,        fg: S.primary },
  Competitive:   { Icon: Swords,   bg: S.surfaceContainer,   fg: S.primaryDim },
};

// ─── Source Tier Config (mirrors TrendExplorer) ───────────────────────
const TIER_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  'S':  { label: 'S',  color: '#22c55e', description: 'Official regulatory / statistical authority' },
  'A':  { label: 'A',  color: '#3b82f6', description: 'Tier-1 consulting or analyst primary research' },
  'A-': { label: 'A-', color: '#60a5fa', description: 'Investment-bank equity research' },
  'B+': { label: 'B+', color: '#a78bfa', description: 'Specialist market-research firm' },
  'B':  { label: 'B',  color: '#c084fc', description: 'Industry trade press — editorially vetted' },
  'B-': { label: 'B-', color: '#e879f9', description: 'Company first-party source — cross-validate' },
  'C':  { label: 'C',  color: '#f59e0b', description: 'General business press — directional' },
  'D':  { label: 'D',  color: '#ef4444', description: 'Aggregator / forecast — methodology opaque' },
  'E':  { label: 'E',  color: '#991b1b', description: 'Social / unverified — weak signal only' },
};

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

const SOURCE_ICON: Record<string, React.ComponentType<{ size?: number }>> = {
  GDELT: Globe, 'Google Trends': TrendingUp, ECHA: AlertTriangle, 'EUR-Lex': FileText,
  'SEC EDGAR': BarChart3, Reddit: Globe, YouTube: Globe, 'Semantic Scholar': FileText,
  Consulting: FileText, 'Trade Press': Newspaper, Press: Newspaper,
};

// ─── Diffusion curve descriptions ────────────────────────────────────
const DIFFUSION_DESCRIPTIONS: Record<string, string> = {
  s_curve:       'Logistic — slow start, fast middle, plateau.',
  linear:        'Steady, constant rate of materialization.',
  front_loaded:  'Fast early impact, flattens over time (√t).',
  back_loaded:   'Slow start, accelerates late (t²).',
  step_function: 'Near-zero until ~80%, then sudden jump.',
};

const DIFFUSION_LABELS: Record<string, string> = {
  s_curve: 'S-Curve', linear: 'Linear', front_loaded: 'Front-Loaded',
  back_loaded: 'Back-Loaded', step_function: 'Step Function',
};

// ─── VC + Region label tables ────────────────────────────────────────
const VC_STEPS = [
  { id: 'raw_materials',  label: 'Raw Materials' },
  { id: 'formulation',    label: 'Formulation' },
  { id: 'packaging',      label: 'Packaging' },
  { id: 'manufacturing',  label: 'Manufacturing' },
  { id: 'logistics',      label: 'Logistics' },
  { id: 'marketing',      label: 'Marketing' },
  { id: 'trade',          label: 'Trade' },
  { id: 'after_sales',    label: 'After-Sales' },
];

const REGIONS = [
  { id: 'Europe',        label: 'Europe' },
  { id: 'North America', label: 'North America' },
  { id: 'Asia',          label: 'Asia' },
  { id: 'High Growth',   label: 'High Growth' },
];

// ─── Small presentational components ─────────────────────────────────

const DotBar: FC<{ value: number; max?: number; color?: string }> = ({ value, max = 5, color = S.primary }) => (
  <div style={{ display: 'flex', gap: 6 }} aria-label={`Value ${value} of ${max}`}>
    {Array.from({ length: max }).map((_, i) => (
      <span
        key={i}
        style={{
          display: 'inline-block',
          width: 10, height: 10, borderRadius: 999,
          backgroundColor: i < value ? color : S.surfaceHigh,
        }}
      />
    ))}
  </div>
);

const DirectionPill: FC<{ direction: 'Expansion' | 'Contraction' }> = ({ direction }) => {
  const isExp = direction === 'Expansion';
  const Icon = isExp ? TrendingUp : TrendingDown;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
      backgroundColor: isExp ? S.primaryContainer : S.errorContainer,
      color:           isExp ? S.onPrimaryContainer : S.onErrorContainer,
    }}>
      <Icon size={13} strokeWidth={2.5} />
      {direction}
    </span>
  );
};

const InsightLabel: FC<{ icon?: React.ComponentType<{ size?: number }>; children: React.ReactNode }> = ({ icon: Icon, children }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.16em', color: S.onSurfaceVariant,
    marginBottom: 12,
  }}>
    {Icon && (
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 22, height: 22, borderRadius: 6,
        backgroundColor: S.surfaceHigh, color: S.primary,
      }}>
        <Icon size={12} />
      </span>
    )}
    {children}
  </div>
);

const StatTile: FC<{
  label: string;
  value: React.ReactNode;
  sublabel?: string;
  accent?: string;
}> = ({ label, value, sublabel, accent = S.primary }) => (
  <div style={{
    flex: 1, minWidth: 0,
    padding: '18px 20px', borderRadius: 16,
    backgroundColor: S.surfaceLow,
  }}>
    <div style={{
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.14em', color: S.onSurfaceVariant,
      marginBottom: 8,
    }}>
      {label}
    </div>
    <div style={{
      fontFamily: HEADLINE_FONT, color: accent,
      fontSize: '1.6rem', fontWeight: 800, lineHeight: 1,
      letterSpacing: '-0.02em',
    }}>
      {value}
    </div>
    {sublabel && (
      <div style={{ marginTop: 8, fontSize: 12, color: S.onSurfaceVariant, lineHeight: 1.45 }}>
        {sublabel}
      </div>
    )}
  </div>
);

// ─── Exposure row (for categories, VC, regions) ──────────────────────
const ExposureRow: FC<{ label: string; value: number; color?: string; max?: number }> = ({ label, value, color, max = 5 }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 14px', borderRadius: 10,
    backgroundColor: value > 0 ? S.surface : 'transparent',
    boxShadow: value > 0 ? `inset 0 0 0 1px ${S.surfaceLow}` : 'none',
  }}>
    <div style={{ fontSize: 13, fontWeight: 600, color: value > 0 ? S.onSurface : S.onSurfaceVariant }}>
      {label}
    </div>
    <DotBar value={value} color={color ?? S.primary} max={max} />
  </div>
);

const ExposureBlock: FC<{
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  items: { id: string; label: string }[];
  values: Record<string, number>;
  color: string;
}> = ({ title, icon, items, values, color }) => (
  <div>
    <InsightLabel icon={icon}>{title}</InsightLabel>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((it) => (
        <ExposureRow
          key={it.id}
          label={it.label}
          value={values[it.id] ?? 0}
          color={color}
        />
      ))}
    </div>
  </div>
);

// ─── Sources list ────────────────────────────────────────────────────
type TrendSource = { title?: string; url?: string; data?: string; tier?: string };

const SourceItem: FC<{ src: TrendSource }> = ({ src }) => {
  const apiName = classifySource(src.url || '');
  const Icon = SOURCE_ICON[apiName] ?? Globe;
  const tierCfg = src.tier ? TIER_CONFIG[src.tier] : undefined;

  return (
    <a
      href={src.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center', columnGap: 12, rowGap: 4,
        padding: '12px 16px', borderRadius: 12,
        backgroundColor: S.surface,
        boxShadow: `inset 0 0 0 1px ${S.surfaceLow}`,
        textDecoration: 'none',
        transition: 'background-color 160ms, transform 160ms',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = S.surfaceLow; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = S.surface; }}
    >
      <span style={{
        width: 32, height: 32, borderRadius: 8,
        backgroundColor: S.surfaceHigh, color: S.primary,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={15} />
      </span>

      <div style={{ minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.12em', color: S.onSurfaceVariant,
          marginBottom: 2,
        }}>
          <span>{apiName}</span>
          {tierCfg && (
            <span
              title={tierCfg.description}
              style={{
                padding: '2px 6px', borderRadius: 4,
                backgroundColor: `${tierCfg.color}20`,
                color: tierCfg.color,
                fontSize: 10, fontWeight: 800, letterSpacing: 0,
              }}
            >
              {tierCfg.label}
            </span>
          )}
        </div>
        <div style={{
          fontFamily: HEADLINE_FONT, color: S.onSurface,
          fontWeight: 600, fontSize: 13, lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {src.title || 'Source'}
        </div>
        {src.data && (
          <div style={{
            gridColumn: '2 / span 2',
            marginTop: 4, fontSize: 12, color: S.onSurfaceVariant, lineHeight: 1.5,
          }}>
            {src.data}
          </div>
        )}
      </div>

      <ExternalLink size={14} color={S.onSurfaceVariant} />
    </a>
  );
};

// ─── Expanded Panel ──────────────────────────────────────────────────
const ExpandedPanel: FC<{ trend: Trend }> = ({ trend }) => {
  const gp1Pct     = trend.gp1_pct_affected;
  const shift      = trend.gp1_shift;
  const peakYear   = (trend as Trend & { peak_year?: number }).peak_year ?? 2030;
  const diffusion  = (trend as Trend & { diffusion_curve?: string }).diffusion_curve ?? 's_curve';
  const sources    = (trend as Trend & { sources?: TrendSource[] }).sources ?? [];
  const confidence = trend.confidence;
  const dataSource = trend.data_source;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      style={{ overflow: 'hidden' }}
    >
      <div style={{
        padding: '32px 32px 40px',
        background: `linear-gradient(180deg, ${S.surfaceLow} 0%, ${S.surface} 100%)`,
      }}>
        {/* Meta row — direction, probability, category touchpoints, confidence */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
          marginBottom: 28,
        }}>
          <DirectionPill direction={trend.direction} />
          <MetaChip
            label={`Probability ${trend.probability}/5`}
            icon={Zap}
          />
          {confidence && (
            <MetaChip label={`Confidence · ${confidence}`} />
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
          {dataSource && (
            <MetaChip label={dataSource} />
          )}
        </div>

        {/* Two-column layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)',
          gap: 48,
        }}>
          {/* ─── LEFT — narrative ────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {/* Description */}
            <section>
              <InsightLabel icon={FileText}>Description</InsightLabel>
              <p style={{
                margin: 0, fontSize: 16, lineHeight: 1.6,
                color: S.onSurface, fontWeight: 400,
              }}>
                {trend.description || <em style={{ color: S.onSurfaceVariant }}>No description documented.</em>}
              </p>
            </section>

            {/* PRISM Analysis */}
            <section>
              <InsightLabel icon={Sparkles}>PRISM Analysis</InsightLabel>
              <blockquote style={{
                margin: 0,
                padding: '16px 20px',
                borderRadius: 14,
                borderLeft: `4px solid ${S.primary}`,
                backgroundColor: S.surfaceLow,
                fontFamily: HEADLINE_FONT,
                fontSize: 15, lineHeight: 1.55,
                color: S.onSurface,
                fontWeight: 500,
                fontStyle: 'normal',
              }}>
                {trend.strategic_implication || (
                  <span style={{ color: S.onSurfaceVariant, fontWeight: 400, fontStyle: 'italic' }}>
                    No strategic implication documented.
                  </span>
                )}
              </blockquote>
            </section>

            {/* Sources */}
            {sources.length > 0 && (
              <section>
                <InsightLabel icon={Newspaper}>
                  Sources &nbsp;·&nbsp; {sources.length}
                </InsightLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sources.map((src, i) => (
                    <SourceItem key={i} src={src} />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ─── RIGHT — metrics & exposure ──────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {/* GP1 + Shift + Timing stat band */}
            <section>
              <InsightLabel icon={BarChart3}>Economic Anchoring</InsightLabel>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <StatTile
                  label="GP1 % Affected"
                  value={gp1Pct != null ? fmtPct(gp1Pct) : '—'}
                  sublabel="Maximum fraction of category GP1 this trend can touch at full materialization."
                />
                <StatTile
                  label="Projected Shift"
                  value={shift != null ? fmtShift(shift) : '—'}
                  sublabel="Expected aggregate direction on the profit pool."
                  accent={shift != null && shift < 0 ? S.error : S.primary}
                />
              </div>
            </section>

            {/* Materialization Timing */}
            <section>
              <InsightLabel icon={Clock}>Materialization Timing</InsightLabel>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <StatTile
                  label="Peak Year"
                  value={peakYear}
                  sublabel="Year when 100% of impact is realized."
                />
                <StatTile
                  label="Diffusion Curve"
                  value={DIFFUSION_LABELS[diffusion] ?? diffusion}
                  sublabel={DIFFUSION_DESCRIPTIONS[diffusion] ?? ''}
                />
              </div>
            </section>

            {/* Category Exposure */}
            <ExposureBlock
              title="Category Exposure"
              icon={Layers}
              items={CATEGORIES.map((c) => ({ id: c.id, label: c.name }))}
              values={(trend.category_exposure ?? {}) as Record<string, number>}
              color={S.primary}
            />

            {/* Value Chain Exposure */}
            <ExposureBlock
              title="Value Chain Exposure"
              icon={Cpu}
              items={VC_STEPS}
              values={(trend.vc_exposure ?? {}) as Record<string, number>}
              color={S.onTertiaryContainer}
            />

            {/* Regional Exposure */}
            <ExposureBlock
              title="Regional Exposure"
              icon={MapPin}
              items={REGIONS}
              values={(trend.regional_exposure ?? {}) as Record<string, number>}
              color={S.onSecondaryContainer}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const MetaChip: FC<{ label: string; icon?: React.ComponentType<{ size?: number }> }> = ({ label, icon: Icon }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '4px 12px', borderRadius: 999,
    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
    backgroundColor: S.surfaceLow,
    color: S.onSurfaceVariant,
    textTransform: 'uppercase',
  }}>
    {Icon && <Icon size={12} />}
    {label}
  </span>
);

// ─── Page ────────────────────────────────────────────────────────────
interface Trends2Props {
  onBack?: () => void;
}

const Trends2: FC<Trends2Props> = ({ onBack }) => {
  const { trends, loading, backendAvailable } = usePrism();
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | 'all'>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo<Trend[]>(() => {
    const q = search.trim().toLowerCase();
    return (trends || []).filter((t) => {
      if (categoryFilter !== 'all') {
        const exposure = t.category_exposure?.[categoryFilter as CategoryId] ?? 0;
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
    <div style={{ minHeight: '100vh', backgroundColor: S.bg, color: S.onBg, fontFamily: BODY_FONT }}>
      <main style={{ maxWidth: 1440, margin: '0 auto', padding: '40px 32px 40px 72px' }}>
        {/* Back button */}
        {onBack && (
          <button
            onClick={onBack}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', marginBottom: 24,
              borderRadius: 999, border: 'none',
              backgroundColor: S.surfaceLow, color: S.primary,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <ArrowLeft size={14} /> Back
          </button>
        )}

        {/* Editorial header with insight rail */}
        <header style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 32 }}>
          <div style={{ paddingLeft: 20, borderLeft: `4px solid ${S.primary}` }}>
            <div style={{
              fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.18em', color: S.onSurfaceVariant, marginBottom: 8,
            }}>
              Trend Intelligence · Editorial View
            </div>
            <h1 style={{
              fontFamily: HEADLINE_FONT, color: S.onBg,
              fontSize: '2.5rem', lineHeight: 1.1, fontWeight: 800,
              letterSpacing: '-0.02em', margin: 0,
            }}>
              The Forces Shaping FMCG
            </h1>
            <p style={{
              marginTop: 8, maxWidth: 640, fontSize: 15,
              color: S.onSurfaceVariant, lineHeight: 1.55,
            }}>
              A curated lens on the {trends?.length ?? 0} signals driving
              profit-pool reallocation across categories through 2036.
              Select any row to explore the full strategic reading.
            </p>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
            <Search size={16} style={{
              position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
              color: S.onSurfaceVariant,
            }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search trends…"
              style={{
                width: '100%', padding: '10px 16px 10px 42px',
                borderRadius: 999, fontSize: 14,
                backgroundColor: S.surfaceLow, color: S.onSurface,
                border: 'none', outline: 'none',
              }}
            />
          </div>
        </header>

        {/* Category filter chips */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
            <FilterChip label="All" active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')} />
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

        {/* Trend list card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          style={{
            borderRadius: 20, overflow: 'hidden', backgroundColor: S.surface,
            boxShadow: '0 4px 60px -15px rgba(0, 52, 94, 0.08)',
          }}
        >
          {/* Column header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2.3fr 1fr 1fr 0.9fr 0.8fr 32px',
            alignItems: 'center', padding: '20px 32px',
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em',
            backgroundColor: S.surfaceLow, color: S.onSurfaceVariant,
          }}>
            <span>Trend</span>
            <span>Direction</span>
            <span>Probability</span>
            <span style={{ textAlign: 'right' }}>GP1 % Affected</span>
            <span style={{ textAlign: 'right' }}>Shift</span>
            <span />
          </div>

          {loading && <EmptyRow text="Loading trend intelligence…" />}
          {!loading && !backendAvailable && <EmptyRow text="Backend unavailable — reconnect to view live trend data." />}
          {!loading && backendAvailable && filtered.length === 0 && <EmptyRow text="No trends match the current filter." />}

          <AnimatePresence initial={false}>
            {filtered.map((t, idx) => {
              const isExpanded = expandedId === t.id;
              return (
                <React.Fragment key={t.id ?? idx}>
                  <TrendRow
                    trend={t}
                    isLast={idx === filtered.length - 1 && !isExpanded}
                    isExpanded={isExpanded}
                    onToggle={() => setExpandedId(isExpanded ? null : (t.id ?? String(idx)))}
                  />
                  {isExpanded && <ExpandedPanel trend={t} />}
                </React.Fragment>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </main>
    </div>
  );
};

// ─── Filter chips ────────────────────────────────────────────────────
const FilterChip: FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      flexShrink: 0, padding: '8px 20px', borderRadius: 999,
      fontSize: 14, fontWeight: 600,
      border: 'none', cursor: 'pointer', transition: 'all 0.2s',
      backgroundColor: active ? S.primaryContainer : S.surfaceLow,
      color:           active ? S.onPrimaryContainer : S.onSurfaceVariant,
    }}
  >
    {label}
  </button>
);

// ─── Trend Row ───────────────────────────────────────────────────────
const TrendRow: FC<{
  trend: Trend;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ trend, isLast, isExpanded, onToggle }) => {
  const tile = FORCE_TILE[trend.force] ?? FORCE_TILE.Consumer;
  const { Icon } = tile;
  const gp1 = (trend as Trend & { gp1_pct_affected?: number }).gp1_pct_affected;
  const shift = trend.gp1_shift;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isExpanded}
      style={{
        display: 'grid', width: '100%',
        gridTemplateColumns: '2.3fr 1fr 1fr 0.9fr 0.8fr 32px',
        alignItems: 'center', padding: '24px 32px',
        backgroundColor: isExpanded ? S.surfaceLow : S.surface,
        border: 'none', textAlign: 'left',
        cursor: 'pointer',
        transition: 'background-color 180ms',
        // Tonal divider instead of 1px border, per DESIGN.md "No-Line Rule"
        boxShadow: isLast ? 'none' : `inset 0 -1px 0 ${S.surfaceLow}`,
      }}
      onMouseEnter={(e) => {
        if (!isExpanded) (e.currentTarget as HTMLButtonElement).style.backgroundColor = S.surfaceLow;
      }}
      onMouseLeave={(e) => {
        if (!isExpanded) (e.currentTarget as HTMLButtonElement).style.backgroundColor = S.surface;
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
        <div style={{
          width: 44, height: 44, flexShrink: 0, borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: tile.bg, color: tile.fg,
        }}>
          <Icon size={20} strokeWidth={2} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: HEADLINE_FONT, color: S.onSurface,
            fontWeight: 700, fontSize: 15,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {trend.name}
          </div>
          <div style={{
            color: S.onSurfaceVariant, fontSize: 13,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {trend.description || trend.strategic_implication || `${trend.force} signal`}
          </div>
        </div>
      </div>

      <div><DirectionPill direction={trend.direction} /></div>
      <div><DotBar value={Math.round(trend.probability ?? 0)} /></div>

      <div style={{ textAlign: 'right' }}>
        <span style={{ fontFamily: HEADLINE_FONT, color: S.onSurface, fontWeight: 800, fontSize: '1.15rem' }}>
          {gp1 != null ? fmtPct(gp1) : '—'}
        </span>
      </div>

      <div style={{ textAlign: 'right' }}>
        <span style={{ fontWeight: 700, fontSize: 14,
          color: shift != null && shift < 0 ? S.error : S.onPrimaryContainer,
        }}>
          {shift != null ? fmtShift(shift) : '—'}
        </span>
      </div>

      <span
        aria-hidden
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, borderRadius: 999,
          color: S.primary,
          backgroundColor: isExpanded ? S.primaryContainer : 'transparent',
          transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), background-color 160ms',
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
        }}
      >
        <ChevronDown size={16} strokeWidth={2.5} />
      </span>
    </button>
  );
};

const EmptyRow: FC<{ text: string }> = ({ text }) => (
  <div style={{
    padding: '64px 32px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 12,
    color: S.onSurfaceVariant,
  }}>
    <Sparkles size={20} color={S.primary} />
    <div style={{ fontSize: 14 }}>{text}</div>
  </div>
);

export default Trends2;
