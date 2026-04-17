/**
 * Trends 2 — Editorial Intelligence View (Vite dashboard)
 *
 * Alternative visualisation for the trends page, inspired by the Stitch
 * "Digital Curator" design language. Now with click-to-expand rows that
 * mirror the exact information and editable controls from the original
 * Trend page's ExpandedTrendRow — restyled with a calm, paper-white
 * layout where each section sits in its own boxed card for legibility.
 *
 * Editable fields (wired to usePrism.updateTrend, admin-only):
 *   • GP1 % Affected — range slider (1–50 %)
 *   • Probability — 1–5 dot selector
 *   • Peak Year — 2026–2035 select
 *   • Diffusion Curve — s_curve / linear / front_loaded / back_loaded / step_function
 *
 * Exposures (Category, Value Chain, Region) match the Trend page 1:1:
 *   • Categories grouped Beauty / LHC, short labels (Color, Care, FCN…)
 *   • Same VC_STEPS and REGIONS as TrendExplorer
 */

import React, { useMemo, useState, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, TrendingUp, TrendingDown, Users, Store, Cpu, Landmark,
  Leaf, Swords, Sparkles, ArrowLeft, ChevronDown, ChevronUp, ChevronsUpDown,
  BarChart3, Clock, Globe, Newspaper, FileText, AlertTriangle, ExternalLink,
  MapPin, Layers, Zap, Pencil, Check, X as XIcon,
} from 'lucide-react';
import usePrism from '../hooks/usePrism';
import { CATEGORIES, fmtPct, fmtShift, shortCat } from '../lib/format';
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
  cardBorder:         'rgba(0, 52, 94, 0.10)',
  cardBorderStrong:   'rgba(0, 52, 94, 0.16)',
  mutedText:          '#64748B',
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

// ─── Diffusion curve metadata ─────────────────────────────────────────
const DIFFUSION_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: 's_curve',       label: 'S-Curve',       description: 'Logistic — slow start, fast middle, plateau.' },
  { value: 'linear',        label: 'Linear',        description: 'Steady, constant rate of materialization.' },
  { value: 'front_loaded',  label: 'Front-Loaded',  description: 'Fast early impact, flattens over time (√t).' },
  { value: 'back_loaded',   label: 'Back-Loaded',   description: 'Slow start, accelerates late (t²).' },
  { value: 'step_function', label: 'Step Function', description: 'Near-zero until ~80%, then sudden jump.' },
];

const PEAK_YEAR_OPTIONS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035];

// ─── VC + Region label tables (match TrendExplorer 1:1) ───────────────
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

const DotBar: FC<{
  value: number;
  max?: number;
  color?: string;
  editable?: boolean;
  onChange?: (v: number) => void;
  size?: number;
}> = ({ value, max = 5, color = S.primary, editable = false, onChange, size = 10 }) => (
  <div style={{ display: 'inline-flex', gap: 6 }} role={editable ? 'radiogroup' : undefined}>
    {Array.from({ length: max }).map((_, i) => {
      const filled = i < value;
      const handle = editable && onChange
        ? (e: React.SyntheticEvent) => { e.stopPropagation(); onChange(i + 1); }
        : undefined;
      return (
        <span
          key={i}
          onClick={handle}
          role={editable ? 'radio' : undefined}
          aria-checked={editable ? filled : undefined}
          tabIndex={editable ? 0 : -1}
          onKeyDown={editable ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange?.(i + 1); }
          } : undefined}
          style={{
            display: 'inline-block',
            width: size, height: size, borderRadius: 999,
            backgroundColor: filled ? color : S.surfaceHigh,
            cursor: editable ? 'pointer' : 'default',
            transition: 'background-color 140ms, transform 140ms',
            outline: 'none',
          }}
        />
      );
    })}
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

const SectionCard: FC<{
  title: string;
  icon?: React.ComponentType<{ size?: number }>;
  accent?: string;
  children: React.ReactNode;
  footnote?: React.ReactNode;
}> = ({ title, icon: Icon, accent = S.primary, children, footnote }) => (
  <section style={{
    backgroundColor: S.surface,
    borderRadius: 14,
    border: `1px solid ${S.cardBorder}`,
    boxShadow: '0 1px 2px rgba(0, 52, 94, 0.03)',
    padding: 20,
    display: 'flex', flexDirection: 'column', gap: 12,
  }}>
    <header style={{
      display: 'flex', alignItems: 'center', gap: 10,
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.16em', color: S.onSurfaceVariant,
    }}>
      {Icon && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 22, height: 22, borderRadius: 6,
          backgroundColor: `${accent}14`, color: accent,
        }}>
          <Icon size={12} />
        </span>
      )}
      <span>{title}</span>
    </header>
    <div>{children}</div>
    {footnote && (
      <div style={{ fontSize: 11, color: S.mutedText, lineHeight: 1.5 }}>{footnote}</div>
    )}
  </section>
);

// ─── Source item ─────────────────────────────────────────────────────
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
      onClick={(e) => e.stopPropagation()}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center', columnGap: 12, rowGap: 4,
        padding: '10px 12px', borderRadius: 10,
        backgroundColor: S.surface,
        border: `1px solid ${S.cardBorder}`,
        textDecoration: 'none',
        transition: 'background-color 160ms, border-color 160ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = S.surfaceLow;
        e.currentTarget.style.borderColor = S.cardBorderStrong;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = S.surface;
        e.currentTarget.style.borderColor = S.cardBorder;
      }}
    >
      <span style={{
        width: 28, height: 28, borderRadius: 8,
        backgroundColor: S.surfaceLow, color: S.primary,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={14} />
      </span>

      <div style={{ minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.12em', color: S.mutedText,
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
                border: `1px solid ${tierCfg.color}40`,
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
            marginTop: 4, fontSize: 12, color: S.mutedText, lineHeight: 1.5,
          }}>
            {src.data}
          </div>
        )}
      </div>

      <ExternalLink size={14} color={S.mutedText} />
    </a>
  );
};

// ─── Category Exposure Grid (grouped Beauty / LHC) ────────────────────
const CategoryExposureGrid: FC<{
  values: Record<string, number>;
  editable: boolean;
  onChange: (catId: string, v: number) => void;
}> = ({ values, editable, onChange }) => {
  const grouped = {
    'Beauty': CATEGORIES.filter(c => c.group === 'Beauty'),
    'LHC':    CATEGORIES.filter(c => c.group === 'LHC'),
  };

  return (
    <div style={{
      borderRadius: 10, overflow: 'hidden',
      border: `1px solid ${S.cardBorder}`,
      backgroundColor: S.surface,
    }}>
      {Object.entries(grouped).map(([group, cats], gi) => (
        <React.Fragment key={group}>
          <div style={{
            padding: '3px 10px', fontSize: 9, fontWeight: 800,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: S.onSurfaceVariant, backgroundColor: S.surfaceLow,
            borderTop: gi > 0 ? `1px solid ${S.cardBorder}` : 'none',
          }}>
            {group}
          </div>
          {cats.map((c, idx) => (
            <div
              key={c.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 10px', minHeight: 26,
                borderTop: idx > 0 ? `1px solid ${S.cardBorder}` : 'none',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: S.onSurface, minWidth: 80 }}>
                {shortCat(c.name)}
              </span>
              <DotBar
                value={values[c.id] ?? 0}
                color={c.color || S.primary}
                editable={editable}
                size={9}
                onChange={(v) => onChange(c.id, v)}
              />
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
};

// ─── Value-chain / Region Exposure Grid (flat) ───────────────────────
const FlatExposureGrid: FC<{
  items: { id: string; label: string }[];
  values: Record<string, number>;
  color: string;
  editable: boolean;
  onChange: (id: string, v: number) => void;
}> = ({ items, values, color, editable, onChange }) => (
  <div style={{
    borderRadius: 10, overflow: 'hidden',
    border: `1px solid ${S.cardBorder}`,
    backgroundColor: S.surface,
  }}>
    {items.map((it, idx) => (
      <div
        key={it.id}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 10px', minHeight: 26,
          borderTop: idx > 0 ? `1px solid ${S.cardBorder}` : 'none',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: S.onSurface, minWidth: 100 }}>
          {it.label}
        </span>
        <DotBar
          value={values[it.id] ?? 0}
          color={color}
          editable={editable}
          size={9}
          onChange={(v) => onChange(it.id, v)}
        />
      </div>
    ))}
  </div>
);

// ─── Expanded Panel ──────────────────────────────────────────────────
const ExpandedPanel: FC<{
  trend: Trend;
  isAdmin: boolean;
  updateTrend: (id: string, updates: Partial<Trend>) => Promise<void>;
}> = ({ trend, isAdmin, updateTrend }) => {
  const sources    = (trend as Trend & { sources?: TrendSource[] }).sources ?? [];
  const confidence = trend.confidence;
  const dataSource = trend.data_source;

  // Edit mode — gates description / PRISM analysis / exposures for explicit Save
  const [isEditing, setIsEditing] = useState(false);

  // Local editable state — syncs to backend live for GP1/Probability/Peak/Diffusion,
  // and on Save for description/implication/exposures.
  const [gp1Pct, setGp1Pct]           = useState<number>(trend.gp1_pct_affected ?? 0.10);
  const [probability, setProbability] = useState<number>(trend.probability ?? 3);
  const [peakYear, setPeakYear]       = useState<number>(
    (trend as Trend & { peak_year?: number }).peak_year ?? 2030
  );
  const [diffusion, setDiffusion]     = useState<string>(
    (trend as Trend & { diffusion_curve?: string }).diffusion_curve ?? 's_curve'
  );
  const [editDesc, setEditDesc]       = useState<string>(trend.description || '');
  const [editImpl, setEditImpl]       = useState<string>(trend.strategic_implication || '');
  const [catExp, setCatExp]           = useState<Record<string, number>>(
    (trend.category_exposure ?? {}) as Record<string, number>
  );
  const [vcExp, setVcExp]             = useState<Record<string, number>>(
    (trend.vc_exposure ?? {}) as Record<string, number>
  );
  const [regExp, setRegExp]           = useState<Record<string, number>>(
    (trend.regional_exposure ?? {}) as Record<string, number>
  );

  const handleSave = () => {
    if (!isAdmin) return;
    const updates: Partial<Trend> = {
      description: editDesc,
      strategic_implication: editImpl,
      gp1_pct_affected: gp1Pct,
      probability,
      peak_year: peakYear,
      diffusion_curve: diffusion,
      category_exposure: catExp as Record<CategoryId, number>,
      vc_exposure: vcExp,
      regional_exposure: regExp,
    } as Partial<Trend>;
    updateTrend(trend.id, updates).catch(() => { /* handled by hook */ });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditDesc(trend.description || '');
    setEditImpl(trend.strategic_implication || '');
    setGp1Pct(trend.gp1_pct_affected ?? 0.10);
    setProbability(trend.probability ?? 3);
    setPeakYear((trend as Trend & { peak_year?: number }).peak_year ?? 2030);
    setDiffusion((trend as Trend & { diffusion_curve?: string }).diffusion_curve ?? 's_curve');
    setCatExp((trend.category_exposure ?? {}) as Record<string, number>);
    setVcExp((trend.vc_exposure ?? {}) as Record<string, number>);
    setRegExp((trend.regional_exposure ?? {}) as Record<string, number>);
    setIsEditing(false);
  };

  const diffusionMeta = DIFFUSION_OPTIONS.find(d => d.value === diffusion) ?? DIFFUSION_OPTIONS[0];

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      style={{ overflow: 'hidden' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          padding: '28px 32px 36px',
          backgroundColor: S.surface,
          borderTop: `1px solid ${S.cardBorder}`,
        }}
      >
        {/* Meta row + Edit toggle */}
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

          {/* Edit / Save / Cancel — admin only */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {!isAdmin && (
              <span style={{ fontSize: 11, color: S.mutedText, fontStyle: 'italic', alignSelf: 'center' }}>
                Editing is admin-only.
              </span>
            )}
            {isAdmin && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 999,
                  fontSize: 12, fontWeight: 600,
                  backgroundColor: S.primaryContainer, color: S.onPrimaryContainer,
                  border: 'none', cursor: 'pointer',
                }}
              >
                <Pencil size={12} /> Edit
              </button>
            )}
            {isAdmin && isEditing && (
              <>
                <button
                  onClick={handleCancel}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', borderRadius: 999,
                    fontSize: 12, fontWeight: 600,
                    backgroundColor: S.surfaceLow, color: S.onSurfaceVariant,
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  <XIcon size={12} /> Cancel
                </button>
                <button
                  onClick={handleSave}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', borderRadius: 999,
                    fontSize: 12, fontWeight: 700,
                    backgroundColor: S.primary, color: '#fff',
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  <Check size={12} /> Save
                </button>
              </>
            )}
          </div>
        </div>

        {/* Two-column layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1fr)',
          gap: 20,
          alignItems: 'start',
        }}>
          {/* ─── LEFT column ────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionCard title="Description" icon={FileText}>
              {isEditing ? (
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={4}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '10px 12px', fontSize: 14, lineHeight: 1.6,
                    color: S.onSurface, backgroundColor: S.surfaceLow,
                    border: `1px solid ${S.cardBorderStrong}`, borderRadius: 8,
                    resize: 'vertical', outline: 'none',
                    fontFamily: BODY_FONT,
                  }}
                />
              ) : (
                <p style={{
                  margin: 0, fontSize: 14, lineHeight: 1.6, color: S.onSurface,
                  whiteSpace: 'pre-wrap',
                }}>
                  {editDesc || trend.description || <em style={{ color: S.mutedText }}>No description documented.</em>}
                </p>
              )}
            </SectionCard>

            <SectionCard title="PRISM Analysis" icon={Sparkles} accent={S.primary}>
              {isEditing ? (
                <textarea
                  value={editImpl}
                  onChange={(e) => setEditImpl(e.target.value)}
                  rows={4}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '10px 12px', fontSize: 14, lineHeight: 1.55,
                    color: S.onSurface, backgroundColor: S.surfaceLow,
                    border: `1px solid ${S.cardBorderStrong}`, borderRadius: 8,
                    resize: 'vertical', outline: 'none',
                    fontFamily: BODY_FONT,
                  }}
                />
              ) : (
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
                  {editImpl || trend.strategic_implication || (
                    <span style={{ color: S.mutedText, fontWeight: 400, fontStyle: 'italic' }}>
                      No strategic implication documented.
                    </span>
                  )}
                </blockquote>
              )}
            </SectionCard>

            {/* GP1 % Affected — slider */}
            <SectionCard
              title="GP1 % Affected — Economic Anchoring"
              icon={BarChart3}
              footnote={
                <>
                  What fraction of a category's GP1 can this trend realistically affect at full
                  materialization? A 5/5 probability trend with {Math.round(gp1Pct * 100)}% GP1 affected means:
                  maximum-severity trend, but only touches {Math.round(gp1Pct * 100)}% of the pool.
                  {isAdmin && !isEditing && ' Click Edit to adjust.'}
                  {!isAdmin && ' (Admin only)'}
                </>
              }
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <input
                  type="range" min={1} max={50} step={1}
                  value={Math.round(gp1Pct * 100)}
                  disabled={!(isAdmin && isEditing)}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10) / 100;
                    setGp1Pct(v);
                  }}
                  style={{
                    flex: 1, height: 4, accentColor: S.primary,
                    cursor: isAdmin && isEditing ? 'pointer' : 'not-allowed',
                    opacity: isAdmin && isEditing ? 1 : 0.6,
                  }}
                />
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

            {/* Probability — editable dot selector */}
            <SectionCard
              title="Probability"
              icon={Zap}
              footnote={
                <>
                  Likelihood this trend materialises at the stated severity.
                  Scale: 1 = Very Unlikely, 3 = Possible, 5 = Almost Certain.
                  {isAdmin && !isEditing && ' Click Edit to adjust.'}
                  {!isAdmin && ' (Admin only)'}
                </>
              }
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
                <DotBar
                  value={probability}
                  color={S.primary}
                  editable={isAdmin && isEditing}
                  size={14}
                  onChange={(v) => setProbability(v)}
                />
                <div style={{
                  padding: '6px 12px', borderRadius: 8,
                  backgroundColor: S.surfaceLow,
                  border: `1px solid ${S.cardBorder}`,
                  fontFamily: HEADLINE_FONT,
                  fontWeight: 800, fontSize: 15, color: S.primary,
                }}>
                  {probability} / 5
                </div>
              </div>
            </SectionCard>

            {/* Materialization Timing — Peak Year + Diffusion */}
            <SectionCard
              title="Materialization Timing"
              icon={Clock}
              footnote="When does this trend reach full impact, and how does it build over time?"
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {/* Peak Year */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: S.mutedText, marginBottom: 6 }}>
                    Peak Year
                  </div>
                  <select
                    value={peakYear}
                    disabled={!(isAdmin && isEditing)}
                    onChange={(e) => setPeakYear(parseInt(e.target.value, 10))}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 8,
                      fontSize: 13, fontWeight: 600, color: S.onSurface,
                      backgroundColor: S.surface,
                      border: `1px solid ${S.cardBorder}`,
                      outline: 'none',
                      cursor: isAdmin && isEditing ? 'pointer' : 'not-allowed',
                      opacity: isAdmin && isEditing ? 1 : 0.8,
                    }}
                  >
                    {PEAK_YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <div style={{ fontSize: 11, color: S.mutedText, marginTop: 4 }}>
                    Year when 100% of impact materializes
                  </div>
                </div>

                {/* Diffusion Curve */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: S.mutedText, marginBottom: 6 }}>
                    Diffusion Curve
                  </div>
                  <select
                    value={diffusion}
                    disabled={!(isAdmin && isEditing)}
                    onChange={(e) => setDiffusion(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 8,
                      fontSize: 13, fontWeight: 600, color: S.onSurface,
                      backgroundColor: S.surface,
                      border: `1px solid ${S.cardBorder}`,
                      outline: 'none',
                      cursor: isAdmin && isEditing ? 'pointer' : 'not-allowed',
                      opacity: isAdmin && isEditing ? 1 : 0.8,
                    }}
                  >
                    {DIFFUSION_OPTIONS.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, color: S.mutedText, marginTop: 4 }}>
                    {diffusionMeta.description}
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Sources */}
            {sources.length > 0 && (
              <SectionCard title={`Sources · ${sources.length}`} icon={Newspaper}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sources.map((src, i) => <SourceItem key={i} src={src} />)}
                </div>
              </SectionCard>
            )}
          </div>

          {/* ─── RIGHT column — exposure grids ─────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>
            <SectionCard title="Category Exposure" icon={Layers}>
              <CategoryExposureGrid
                values={catExp}
                editable={isAdmin && isEditing}
                onChange={(id, v) => setCatExp({ ...catExp, [id]: v })}
              />
            </SectionCard>

            <SectionCard title="Value Chain Exposure" icon={Cpu} accent={S.onTertiaryContainer}>
              <FlatExposureGrid
                items={VC_STEPS}
                values={vcExp}
                color={S.onTertiaryContainer}
                editable={isAdmin && isEditing}
                onChange={(id, v) => setVcExp({ ...vcExp, [id]: v })}
              />
            </SectionCard>

            <SectionCard title="Regional Exposure" icon={MapPin} accent={S.onSecondaryContainer}>
              <FlatExposureGrid
                items={REGIONS}
                values={regExp}
                color={S.onSecondaryContainer}
                editable={isAdmin && isEditing}
                onChange={(id, v) => setRegExp({ ...regExp, [id]: v })}
              />
            </SectionCard>
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
  isAdmin?: boolean;
}

type SortKey = 'name' | 'direction' | 'probability' | 'gp1_pct_affected' | 'gp1_shift';
type SortDir = 'asc' | 'desc';

const Trends2: FC<Trends2Props> = ({ onBack, isAdmin = true }) => {
  const { trends, loading, backendAvailable, updateTrend } = usePrism();
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | 'all'>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      // Text columns default to ascending, numerical columns default to descending.
      setSortDir(key === 'name' || key === 'direction' ? 'asc' : 'desc');
    }
  };

  const filtered = useMemo<Trend[]>(() => {
    const q = search.trim().toLowerCase();
    const rows = (trends || []).filter((t) => {
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

    if (!sortKey) return rows;

    const dir = sortDir === 'asc' ? 1 : -1;
    const compare = (a: Trend, b: Trend): number => {
      if (sortKey === 'name')       return a.name.localeCompare(b.name) * dir;
      if (sortKey === 'direction')  return a.direction.localeCompare(b.direction) * dir;
      const av = (a as Trend & Record<string, unknown>)[sortKey];
      const bv = (b as Trend & Record<string, unknown>)[sortKey];
      const an = typeof av === 'number' ? av : Number.NEGATIVE_INFINITY;
      const bn = typeof bv === 'number' ? bv : Number.NEGATIVE_INFINITY;
      if (an === bn) return 0;
      return (an < bn ? -1 : 1) * dir;
    };
    return [...rows].sort(compare);
  }, [trends, categoryFilter, search, sortKey, sortDir]);

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
            border: `1px solid ${S.cardBorder}`,
          }}
        >
          {/* Column header — maritime blue surface (the sole headline-blue band) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2.3fr 1fr 1fr 0.9fr 0.8fr 32px',
            alignItems: 'center', padding: '20px 32px',
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em',
            backgroundColor: S.primaryContainer, color: S.onPrimaryContainer,
          }}>
            <SortHeader label="Trend"           sortKey="name"             current={sortKey} dir={sortDir} onSort={handleSort} />
            <SortHeader label="Direction"       sortKey="direction"        current={sortKey} dir={sortDir} onSort={handleSort} />
            <SortHeader label="Probability"     sortKey="probability"      current={sortKey} dir={sortDir} onSort={handleSort} />
            <SortHeader label="GP1 % Affected"  sortKey="gp1_pct_affected" current={sortKey} dir={sortDir} onSort={handleSort} align="right" />
            <SortHeader label="Shift"           sortKey="gp1_shift"        current={sortKey} dir={sortDir} onSort={handleSort} align="right" />
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
                  {isExpanded && (
                    <ExpandedPanel
                      trend={t}
                      isAdmin={isAdmin}
                      updateTrend={updateTrend as (id: string, u: Partial<Trend>) => Promise<void>}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </main>
    </div>
  );
};

// ─── Sortable column header ──────────────────────────────────────────
const SortHeader: FC<{
  label: string;
  sortKey: SortKey;
  current: SortKey | null;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}> = ({ label, sortKey, current, dir, onSort, align = 'left' }) => {
  const active = current === sortKey;
  const Icon = !active ? ChevronsUpDown : dir === 'asc' ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        width: '100%',
        padding: 0, border: 'none', background: 'transparent',
        color: 'inherit',
        fontSize: 'inherit', fontWeight: 'inherit',
        letterSpacing: 'inherit', textTransform: 'inherit',
        cursor: 'pointer',
        opacity: active ? 1 : 0.85,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = active ? '1' : '0.85'; }}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span>{label}</span>
      <Icon size={13} strokeWidth={active ? 2.75 : 2} />
    </button>
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
