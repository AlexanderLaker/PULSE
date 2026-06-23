/**
 * ConsumerJourney2.tsx — Consumer Journey layer (rebuilt 2026-06-10).
 *
 * WHAT THIS IS (post-audit, PRISM_Consumer_Journey_Audit_2026-06-10.md):
 * a QUALITATIVE strategist overlay that maps trends to consumer moments.
 * It is authored content — it does NOT feed the Shift Matrix. Per the audit
 * (§3, §5 fixes #1-#7/#9, §7) this rebuild is honest about what it is:
 *
 *   • This component holds ZERO hard-coded journey content. All tiles, stage
 *     definitions and stage contexts come from data/consumerJourney.ts (the
 *     bundled seed) or, when an admin has saved edits, from GET /api/journey.
 *     It is pure view + interaction logic over those modules.
 *   • Every analysis is labelled "Strategist Read — authored, not simulated"
 *     (fix #1, C4) — never "PRISM Analysis". Provenance + evidence-grade chips
 *     ride every tile and are never stripped.
 *   • Trend-code chips resolve through data/trendCodeMap.ts to the LIVE trend
 *     in usePrism().trends, with working "View in Trends →" drill-through
 *     (fix #3, B1/B3). Retired codes render muted, with no live-driver styling.
 *   • Per-stage QUANTITATIVE attribution (fix #7) reads the computed
 *     journey_decomposition off the latest persisted run (same pattern as
 *     vc_decomposition); when a run lacks it, the chip is honest about the
 *     empty state rather than faking numbers.
 *   • The "Laundry" tab is labelled honestly — it is laundry-only; a caption
 *     notes the Home Care journey is pending (fix #9 / A2).
 *
 * The contrast that matters: this view sits one tab away from genuinely
 * computed outputs. It must read as restrained, sourced, and clearly authored
 * — never as if its prose were model output.
 */

'use client';

import React, {
  useState, useEffect, useMemo, useCallback, FC,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, ExternalLink, ArrowRight, X, Edit3, Check,
  Info, PenLine, Sparkles, CircleCheck, Zap, TriangleAlert, Cloud,
  Plus, Trash2, Save, ChevronDown, ChevronRight,
} from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import {
  LHC_JOURNEY, HAIR_JOURNEY, LHC_CTX, HAIR_CTX, JOURNEY_CONTENT_VERSION,
  type JourneyKey, type JourneyStageDef, type JourneyTile, type TileType,
  type TileProvenance, type ProvenanceGrade,
} from '@/data/consumerJourney';
import {
  TREND_CODE_MAP, RETIRED_CODES, trendIdForCode,
} from '@/data/trendCodeMap';
import type { Trend } from '@/types/trends';
import type { SimulationResult } from '@/types/simulation';

// ════════════════════════════════════════════════════════════════════════
// Style tokens — intentional local copy of the Maritime light editorial
// system. Values match docs/DESIGN.md.
// ════════════════════════════════════════════════════════════════════════
const S = {
  bg: '#f8f9ff', surface: '#ffffff', surfaceLow: '#eff4ff',
  surfaceContainer: '#e5eeff', surfaceHigh: '#dce9ff', surfaceHighest: '#d2e4ff',
  primary: '#005db5', primaryDim: '#0052a0', primaryContainer: '#d6e3ff',
  onPrimaryContainer: '#00519e', onBg: '#00345e', onSurface: '#00345e',
  onSurfaceVariant: '#26619d',
  expansionContainer: '#d6ecdb', onExpansionContainer: '#1e5f2e', expansion: '#1f7a3d',
  error: '#9f403d', errorContainer: '#fee3e1', onErrorContainer: '#752121',
  amberContainer: '#fdf0d5', onAmberContainer: '#7a5200',
  outline: '#477dbb', cardBorder: 'rgba(0, 52, 94, 0.10)',
  cardBorderStrong: 'rgba(0, 52, 94, 0.16)', mutedText: '#64748B',
};
const HEADLINE_FONT = "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const BODY_FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

/** Force colors — per the PRISM spec / CLAUDE.md §9 (data palette, charts
 *  & chips only). Deliberately specified here so the trend-code chips force-
 *  color consistently regardless of the lib/format.ts series palette. */
const FORCE_COLOR: Record<string, string> = {
  Consumer: '#3B82F6',
  Customer: '#8B5CF6',
  Technology: '#06B6D4',
  Government: '#F59E0B',
  Environmental: '#22C55E',
  Competitive: '#EF4444',
};
const forceColor = (force?: string): string => (force ? FORCE_COLOR[force] ?? S.primary : S.primary);

// ── Tile type chip palette ──────────────────────────────────────────────
const TYPE_STYLES: Record<TileType, { label: string; bg: string; fg: string }> = {
  product: { label: 'Product', bg: '#d6e3ff', fg: '#00519e' },
  tech: { label: 'Tech', bg: '#dce9ff', fg: '#0052a0' },
  service: { label: 'Service', bg: '#e5eeff', fg: '#26619d' },
};

// ── Provenance grade chip palette ───────────────────────────────────────
const GRADE_META: Record<ProvenanceGrade, { label: string; icon: typeof CircleCheck; bg: string; fg: string }> = {
  verified: { label: 'verified', icon: CircleCheck, bg: '#d6ecdb', fg: '#1e5f2e' },
  estimate: { label: 'estimate', icon: Zap, bg: '#fdf0d5', fg: '#7a5200' },
  hypothesis: { label: 'hypothesis', icon: TriangleAlert, bg: '#fee3e1', fg: '#752121' },
};

const CURRENT_YYYYMM = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();

// ════════════════════════════════════════════════════════════════════════
// Types — local view state
// ════════════════════════════════════════════════════════════════════════
interface ConsumerJourney2Props {
  onNavigateProfitPoolShiftModel?: () => void;
  onNavigateTrends?: () => void;
  /** Receives a trend NAME, used as a Trends-tab search query. */
  onNavigateToTrend?: (query: string) => void;
  isAdmin?: boolean;
}

type Direction = 'benefiting' | 'negativelyImpacted';

interface SelectedTile {
  tile: JourneyTile;
  stageId: string;
  stageLabel: string;
  direction: Direction;
}

/** Editable subset of a tile (admin editor). */
interface TileEdits {
  name: string;
  intensity: 1 | 2 | 3;
  driverNote: string;
  trendCodes: string[];
  analysis: string;
}

/** The full content blob shape persisted via PUT /api/journey. */
interface JourneyContent {
  lhc: JourneyStageDef[];
  hair: JourneyStageDef[];
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'forbidden';

// ════════════════════════════════════════════════════════════════════════
// Pure helpers
// ════════════════════════════════════════════════════════════════════════

/** Deep-clone the seed so admin edits never mutate the imported module. */
function cloneStages(stages: JourneyStageDef[]): JourneyStageDef[] {
  return stages.map(s => ({
    ...s,
    benefiting: s.benefiting.map(t => ({ ...t, trendCodes: [...t.trendCodes], provenance: { ...t.provenance } })),
    negativelyImpacted: s.negativelyImpacted.map(t => ({ ...t, trendCodes: [...t.trendCodes], provenance: { ...t.provenance } })),
  }));
}

/** Minimal markdown renderer for tile analyses: **bold** spans + \n\n
 *  paragraph breaks. No new dependency — a deliberately small parser. */
const MarkdownBlock: FC<{ text: string }> = ({ text }) => {
  // The seed stores escaped "\\n\\n"; normalise both real and escaped breaks.
  const normalised = text.replace(/\\n/g, '\n');
  const paragraphs = normalised.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  return (
    <>
      {paragraphs.map((para, i) => (
        <p
          key={i}
          style={{
            fontSize: 12.5, color: S.onSurface, lineHeight: 1.65,
            margin: i === 0 ? '0 0 10px' : '10px 0 0', fontFamily: BODY_FONT,
          }}
        >
          {para.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={j} style={{ fontWeight: 800, color: S.onBg, fontFamily: HEADLINE_FONT }}>{part.slice(2, -2)}</strong>
              : <span key={j}>{part.replace(/\n/g, ' ')}</span>,
          )}
        </p>
      ))}
    </>
  );
};

const fmtPct = (fraction: number): string => {
  const pct = fraction * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
};

// ════════════════════════════════════════════════════════════════════════
// Small presentational atoms
// ════════════════════════════════════════════════════════════════════════

const FilterChip: FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className="px-4 py-1.5 rounded-full text-sm font-bold transition-all duration-200"
    style={{
      backgroundColor: active ? S.primary : S.surfaceLow,
      color: active ? '#fff' : S.onSurfaceVariant,
      border: 'none', cursor: 'pointer', fontFamily: HEADLINE_FONT,
    }}
  >
    {label}
  </button>
);

const TypeChip: FC<{ typeKey: TileType; active: boolean; onClick: () => void }> = ({ typeKey, active, onClick }) => {
  const st = TYPE_STYLES[typeKey];
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-full text-[11px] font-bold transition-all duration-150"
      style={{
        backgroundColor: active ? st.bg : S.surfaceLow,
        color: active ? st.fg : S.mutedText,
        opacity: active ? 1 : 0.65,
        border: 'none', cursor: 'pointer', fontFamily: HEADLINE_FONT,
      }}
      aria-pressed={active}
    >
      {st.label}
    </button>
  );
};

/** Intensity dots: filled = intensity, hollow = remainder up to 3. */
const IntensityDots: FC<{ intensity: 1 | 2 | 3; color: string }> = ({ intensity, color }) => (
  <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }} aria-label={`Intensity ${intensity} of 3`}>
    {[1, 2, 3].map(n => (
      <span
        key={n}
        style={{
          width: 5, height: 5, borderRadius: 999,
          backgroundColor: n <= intensity ? color : 'transparent',
          border: `1px solid ${color}`, opacity: n <= intensity ? 1 : 0.4,
        }}
      />
    ))}
  </span>
);

/** Provenance chip — ✍️ strategist / ✨ AI + date. Never stripped (fix #1). */
const ProvenanceChip: FC<{ provenance: TileProvenance; compact?: boolean }> = ({ provenance, compact }) => {
  const isAi = provenance.author === 'ai';
  const Icon = isAi ? Sparkles : PenLine;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full font-bold"
      style={{
        fontSize: compact ? 9.5 : 10.5,
        padding: compact ? '1px 6px' : '2px 8px',
        backgroundColor: isAi ? S.amberContainer : S.surfaceLow,
        color: isAi ? S.onAmberContainer : S.onSurfaceVariant,
        fontFamily: HEADLINE_FONT, whiteSpace: 'nowrap',
      }}
      title={isAi ? `AI-suggested mapping (${provenance.date}) — pending strategist review` : `Strategist-authored (${provenance.date})`}
    >
      <Icon size={compact ? 9 : 10} strokeWidth={2.5} />
      {isAi ? 'AI' : 'Strategist'} · {provenance.date}
    </span>
  );
};

const GradeChip: FC<{ grade: ProvenanceGrade; compact?: boolean }> = ({ grade, compact }) => {
  const meta = GRADE_META[grade];
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full font-bold"
      style={{
        fontSize: compact ? 9.5 : 10.5,
        padding: compact ? '1px 6px' : '2px 8px',
        backgroundColor: meta.bg, color: meta.fg,
        fontFamily: HEADLINE_FONT, whiteSpace: 'nowrap',
      }}
      title={`Evidence grade: ${meta.label}`}
    >
      <Icon size={compact ? 9 : 10} strokeWidth={2.5} />
      {meta.label}
    </span>
  );
};

/** Section header card used in the detail panel. */
const SectionCard: FC<{ title: React.ReactNode; accent: string; children: React.ReactNode; subtitle?: React.ReactNode }> = ({ title, accent, children, subtitle }) => (
  <div className="rounded-2xl p-4" style={{ backgroundColor: S.surface, boxShadow: '0 4px 60px -15px rgba(0,52,94,0.08)' }}>
    <h3
      className="text-[11px] font-extrabold uppercase tracking-[0.14em] pl-2.5"
      style={{ color: S.onSurfaceVariant, borderLeft: `3px solid ${accent}`, fontFamily: HEADLINE_FONT, margin: 0 }}
    >
      {title}
    </h3>
    {subtitle && (
      <div className="pl-2.5 mt-1 mb-3 text-[11px] italic" style={{ color: S.mutedText, fontFamily: BODY_FONT }}>
        {subtitle}
      </div>
    )}
    <div style={{ marginTop: subtitle ? 0 : 12 }}>{children}</div>
  </div>
);

// ════════════════════════════════════════════════════════════════════════
// Tile pill (in the stage rail)
// ════════════════════════════════════════════════════════════════════════
const TilePill: FC<{
  tile: JourneyTile;
  direction: Direction;
  selected: boolean;
  onClick: () => void;
}> = ({ tile, direction, selected, onClick }) => {
  const isExp = direction === 'benefiting';
  const accent = isExp ? S.expansion : S.error;
  const accentBg = isExp ? 'rgba(45,125,63,0.06)' : 'rgba(159,64,61,0.06)';
  const ts = TYPE_STYLES[tile.type];
  const isAi = tile.provenance.author === 'ai';
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl transition-all duration-150"
      style={{
        display: 'block', padding: '7px 8px', marginBottom: 5,
        backgroundColor: selected ? S.surface : accentBg,
        border: `1px solid ${selected ? accent : S.cardBorder}`,
        boxShadow: selected ? `0 2px 12px -4px ${accent}66` : 'none',
        cursor: 'pointer', fontFamily: BODY_FONT,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: S.onSurface, lineHeight: 1.3, fontFamily: HEADLINE_FONT }}>
          {tile.name}
        </span>
        <IntensityDots intensity={tile.intensity} color={accent} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
        <span
          className="inline-flex items-center rounded-full font-bold"
          style={{ fontSize: 9, padding: '0px 6px', backgroundColor: ts.bg, color: ts.fg, fontFamily: HEADLINE_FONT }}
        >
          {ts.label}
        </span>
        {/* Trend-code chips intentionally omitted from the tile (declutter,
            2026-06-14). Linked trends remain on the detail panel's Evidence
            cards; the tile stays scannable and the rail fits on one screen. */}
      </div>
      {isAi && (
        <div style={{ marginTop: 5 }}>
          <span
            className="inline-flex items-center gap-1 rounded-full font-bold"
            style={{ fontSize: 9, padding: '0px 6px', backgroundColor: S.amberContainer, color: S.onAmberContainer, fontFamily: HEADLINE_FONT }}
          >
            <Sparkles size={8} strokeWidth={2.5} /> AI · pending review
          </span>
        </div>
      )}
    </button>
  );
};

// ════════════════════════════════════════════════════════════════════════
// Evidence card (in the detail panel) — resolves a code to the LIVE trend.
// ════════════════════════════════════════════════════════════════════════
const EvidenceCard: FC<{
  code: string;
  trendsById: Map<string, Trend>;
  trendsLoaded: boolean;
  onNavigateToTrend?: (query: string) => void;
}> = ({ code, trendsById, trendsLoaded, onNavigateToTrend }) => {
  // Retired codes get a muted card with NO live-driver styling (fix B3).
  const retired = RETIRED_CODES[code];
  if (retired) {
    return (
      <div
        className="rounded-xl p-3"
        style={{ backgroundColor: S.surfaceLow, border: `1px dashed ${S.cardBorder}`, opacity: 0.85 }}
        title={retired}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            className="inline-flex items-center rounded-full font-bold"
            style={{ fontSize: 10, padding: '1px 7px', backgroundColor: S.surfaceContainer, color: S.mutedText, textDecoration: 'line-through', fontFamily: HEADLINE_FONT }}
          >
            {code}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: S.mutedText, fontFamily: HEADLINE_FONT }}>retired trend</span>
        </div>
        <p style={{ fontSize: 11, color: S.mutedText, lineHeight: 1.5, margin: '6px 0 0', fontStyle: 'italic' }}>
          {retired} — kept for reference; not a live driver.
        </p>
      </div>
    );
  }

  const info = TREND_CODE_MAP[code];
  if (!info) {
    return (
      <div className="rounded-xl p-3" style={{ backgroundColor: S.surfaceLow, border: `1px solid ${S.cardBorder}` }}>
        <span style={{ fontSize: 11, color: S.mutedText, fontFamily: HEADLINE_FONT }}>{code} — unmapped code</span>
      </div>
    );
  }

  const trendId = trendIdForCode(code);
  const live = trendId ? trendsById.get(trendId) : undefined;
  const c = forceColor(info.force);

  const name = live?.name ?? info.name;
  const direction = live?.direction ?? info.direction;
  // fallbackDescription only when trends haven't loaded (fix #3 wording).
  const description = live?.description ?? (trendsLoaded ? '' : info.fallbackDescription);
  const probability = live?.probability;
  const confidence = live?.confidence;
  const sourceCount = live?.sources?.length;

  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: S.surfaceLow, border: `1px solid ${S.cardBorder}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span
          className="inline-flex items-center rounded-full font-bold"
          style={{ fontSize: 10, padding: '1px 7px', backgroundColor: `${c}1a`, color: c, fontFamily: HEADLINE_FONT }}
        >
          {code}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: S.onSurface, fontFamily: HEADLINE_FONT, lineHeight: 1.3 }}>{name}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
        <span
          className="inline-flex items-center rounded-full font-bold"
          style={{ fontSize: 9.5, padding: '1px 7px', backgroundColor: `${c}14`, color: c, fontFamily: HEADLINE_FONT }}
        >
          {info.force}
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-full font-bold"
          style={{
            fontSize: 9.5, padding: '1px 7px',
            backgroundColor: direction === 'Expansion' ? S.expansionContainer : S.errorContainer,
            color: direction === 'Expansion' ? S.onExpansionContainer : S.onErrorContainer,
            fontFamily: HEADLINE_FONT,
          }}
        >
          {direction === 'Expansion' ? <TrendingUp size={9} strokeWidth={2.5} /> : <TrendingDown size={9} strokeWidth={2.5} />}
          {direction}
        </span>
        {typeof probability === 'number' && (
          <span style={{ fontSize: 10, color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT, fontWeight: 700 }} className="tabular-nums">
            P {probability.toFixed(1)}/5
          </span>
        )}
        {confidence && (
          <span style={{ fontSize: 10, color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT, fontWeight: 700 }}>
            {confidence} confidence
          </span>
        )}
        {typeof sourceCount === 'number' && (
          <span style={{ fontSize: 10, color: S.mutedText, fontFamily: HEADLINE_FONT, fontWeight: 700 }} className="tabular-nums">
            {sourceCount} source{sourceCount === 1 ? '' : 's'}
          </span>
        )}
      </div>
      {description && (
        <p style={{ fontSize: 11.5, color: S.onSurfaceVariant, lineHeight: 1.5, margin: '7px 0 0' }}>
          {description}
          {!live && !trendsLoaded && (
            <span style={{ color: S.mutedText, fontStyle: 'italic' }}> (offline fallback)</span>
          )}
        </p>
      )}
      <button
        onClick={() => onNavigateToTrend?.(live?.name ?? info.name)}
        className="inline-flex items-center gap-1.5 mt-2"
        style={{
          fontSize: 11, fontWeight: 700, color: S.primary, background: 'none',
          border: 'none', cursor: 'pointer', padding: 0, fontFamily: HEADLINE_FONT,
        }}
        onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline'; }}
        onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none'; }}
      >
        <ExternalLink size={11} strokeWidth={2.5} />
        View in Trends
      </button>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════
// Stage context block (collapsible) — from LHC_CTX / HAIR_CTX (keyed by label).
// ════════════════════════════════════════════════════════════════════════
const StageContextBlock: FC<{ stageLabel: string; journeyKey: JourneyKey }> = ({ stageLabel, journeyKey }) => {
  const [open, setOpen] = useState(false);
  const ctxMap = journeyKey === 'lhc' ? LHC_CTX : HAIR_CTX;
  const ctx = ctxMap[stageLabel];
  if (!ctx) return null;
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Henkel brands', value: ctx.henkelBrands },
    { label: 'Competitors', value: ctx.competitors },
    { label: 'Opportunity', value: ctx.opportunity },
  ];
  return (
    <div className="rounded-2xl" style={{ backgroundColor: S.surface, boxShadow: '0 4px 60px -15px rgba(0,52,94,0.08)', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] pl-2.5" style={{ color: S.onSurfaceVariant, borderLeft: `3px solid ${S.primaryDim}`, fontFamily: HEADLINE_FONT }}>
          Stage context — {stageLabel}
        </span>
        {open ? <ChevronDown size={15} strokeWidth={2.5} style={{ color: S.onSurfaceVariant }} /> : <ChevronRight size={15} strokeWidth={2.5} style={{ color: S.onSurfaceVariant }} />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pb-4 flex flex-col gap-2.5">
              {rows.map(r => (
                <div key={r.label}>
                  <div className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT, marginBottom: 2 }}>
                    {r.label}
                  </div>
                  <p style={{ fontSize: 12, color: S.onSurface, lineHeight: 1.55, margin: 0 }}>{r.value}</p>
                </div>
              ))}
              <p style={{ fontSize: 10.5, color: S.mutedText, margin: '2px 0 0', fontStyle: 'italic' }}>
                Authored stage context — same provenance rules as the tile reads.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════
// Attribution chip (fix #7) — computed terminal-year stage attribution.
// ════════════════════════════════════════════════════════════════════════
const AttributionChip: FC<{ value: number | null }> = ({ value }) => {
  if (value === null) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full font-bold"
        style={{ fontSize: 9.5, padding: '1px 7px', backgroundColor: S.surfaceLow, color: S.mutedText, fontFamily: HEADLINE_FONT, whiteSpace: 'nowrap' }}
        title="No journey attribution in the latest persisted run — arrives with the next production run."
      >
        <Cloud size={9} strokeWidth={2.5} />
        attribution pending
      </span>
    );
  }
  const positive = value >= 0;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full font-bold tabular-nums"
      style={{
        fontSize: 9.5, padding: '1px 7px',
        backgroundColor: positive ? S.expansionContainer : S.errorContainer,
        color: positive ? S.onExpansionContainer : S.onErrorContainer,
        fontFamily: HEADLINE_FONT, whiteSpace: 'nowrap',
      }}
      title="Computed stage attribution — per-stage share of the terminal-year median shift (journey-exposure weighted)."
    >
      {positive ? <TrendingUp size={9} strokeWidth={2.5} /> : <TrendingDown size={9} strokeWidth={2.5} />}
      {fmtPct(value)}
    </span>
  );
};

// ════════════════════════════════════════════════════════════════════════
// Admin tile editor (compact, inline in the detail panel) — fix #6.
// ════════════════════════════════════════════════════════════════════════
const TileEditor: FC<{
  initial: JourneyTile;
  onSave: (edits: TileEdits) => void;
  onCancel: () => void;
  onRemove: () => void;
}> = ({ initial, onSave, onCancel, onRemove }) => {
  const [edits, setEdits] = useState<TileEdits>({
    name: initial.name,
    intensity: initial.intensity,
    driverNote: initial.driverNote,
    trendCodes: initial.trendCodes.length ? [...initial.trendCodes] : [''],
    analysis: initial.analysis ?? '',
  });

  const allCodes = useMemo(() => Object.keys(TREND_CODE_MAP).sort((a, b) => a.localeCompare(b)), []);
  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: S.onSurfaceVariant, display: 'block',
    marginBottom: 5, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: HEADLINE_FONT,
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 8, backgroundColor: '#fff',
    border: `1px solid ${S.cardBorder}`, color: S.onSurface, fontSize: 12, fontFamily: BODY_FONT, outline: 'none',
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label style={labelStyle}>Tile name</label>
        <input style={inputStyle} value={edits.name} onChange={e => setEdits(p => ({ ...p, name: e.target.value }))} />
      </div>

      <div>
        <label style={labelStyle}>Intensity</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {([1, 2, 3] as const).map(n => (
            <button
              key={n}
              onClick={() => setEdits(p => ({ ...p, intensity: n }))}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-bold"
              style={{
                backgroundColor: edits.intensity === n ? S.primaryContainer : S.surfaceLow,
                color: edits.intensity === n ? S.onPrimaryContainer : S.mutedText,
                border: 'none', cursor: 'pointer', fontFamily: HEADLINE_FONT,
              }}
            >
              {n} — {n === 1 ? 'Mild' : n === 2 ? 'Moderate' : 'Strong'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Driver note</label>
        <input style={inputStyle} value={edits.driverNote} onChange={e => setEdits(p => ({ ...p, driverNote: e.target.value }))} />
      </div>

      <div>
        <label style={labelStyle}>Linked trend codes</label>
        {edits.trendCodes.map((code, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <select
              value={code}
              onChange={e => setEdits(p => {
                const next = [...p.trendCodes]; next[idx] = e.target.value; return { ...p, trendCodes: next };
              })}
              style={{ ...inputStyle, backgroundColor: S.surfaceLow }}
            >
              <option value="">Select trend…</option>
              {allCodes.map(c => (
                <option key={c} value={c}>{c}: {TREND_CODE_MAP[c].name}</option>
              ))}
            </select>
            {edits.trendCodes.length > 1 && (
              <button
                onClick={() => setEdits(p => ({ ...p, trendCodes: p.trendCodes.filter((_, i) => i !== idx) }))}
                style={{ padding: '0 10px', borderRadius: 8, backgroundColor: S.errorContainer, border: 'none', color: S.onErrorContainer, cursor: 'pointer', flexShrink: 0 }}
                title="Remove trend"
                aria-label="Remove trend"
              >
                <Trash2 size={13} strokeWidth={2.5} />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() => setEdits(p => ({ ...p, trendCodes: [...p.trendCodes, ''] }))}
          className="inline-flex items-center gap-1.5 rounded-full font-bold"
          style={{ marginTop: 2, padding: '5px 12px', backgroundColor: S.primaryContainer, color: S.onPrimaryContainer, border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: HEADLINE_FONT }}
        >
          <Plus size={12} strokeWidth={2.5} /> Add trend
        </button>
      </div>

      <div>
        <label style={labelStyle}>Strategist Read (authored analysis)</label>
        <textarea
          value={edits.analysis}
          onChange={e => setEdits(p => ({ ...p, analysis: e.target.value }))}
          rows={7}
          placeholder="**1. Summary.** …  **2. Strategic Evaluation.** …"
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
        />
        <p style={{ fontSize: 10, color: S.mutedText, margin: '4px 0 0', fontStyle: 'italic' }}>
          Supports **bold** and blank-line paragraph breaks. Saving stamps this tile {CURRENT_YYYYMM}.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onSave({ ...edits, trendCodes: edits.trendCodes.filter(Boolean) })}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-full text-sm font-bold"
          style={{ backgroundColor: S.primary, color: '#fff', border: 'none', cursor: 'pointer', fontFamily: HEADLINE_FONT }}
        >
          <Check size={13} strokeWidth={2.5} /> Apply
        </button>
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-full text-sm font-bold"
          style={{ backgroundColor: S.surfaceLow, color: S.onSurfaceVariant, border: 'none', cursor: 'pointer', fontFamily: HEADLINE_FONT }}
        >
          Cancel
        </button>
        <button
          onClick={onRemove}
          className="px-3 py-2 rounded-full"
          style={{ backgroundColor: S.errorContainer, color: S.onErrorContainer, border: 'none', cursor: 'pointer' }}
          title="Remove this tile"
          aria-label="Remove this tile"
        >
          <Trash2 size={14} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════
const ConsumerJourney2: FC<ConsumerJourney2Props> = ({
  onNavigateProfitPoolShiftModel,
  onNavigateTrends,
  onNavigateToTrend,
  isAdmin = false,
}) => {
  const { trends, simulation } = usePrism();

  // ── Content: seed → replaced by server blob on mount (fix #6) ──
  const [content, setContent] = useState<JourneyContent>(() => ({
    lhc: cloneStages(LHC_JOURNEY),
    hair: cloneStages(HAIR_JOURNEY),
  }));
  const [contentSource, setContentSource] = useState<'seed' | 'server'>('seed');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/journey', { credentials: 'include' });
        if (!res.ok) return; // 404/401/etc → keep seed silently
        const data: unknown = await res.json();
        if (cancelled || !data || typeof data !== 'object') return;
        const blob = data as Partial<JourneyContent>;
        if (Array.isArray(blob.lhc) && Array.isArray(blob.hair)) {
          setContent({ lhc: cloneStages(blob.lhc), hair: cloneStages(blob.hair) });
          setContentSource('server');
        }
      } catch {
        /* keep seed silently */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── View state ──
  const [tab, setTab] = useState<JourneyKey>('lhc');
  const [typeFilter, setTypeFilter] = useState<Set<TileType>>(new Set(['product', 'tech', 'service']));
  const [selected, setSelected] = useState<SelectedTile | null>(null);
  const [editing, setEditing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const stages = tab === 'lhc' ? content.lhc : content.hair;

  // ── Live trend index for evidence cards ──
  const trendsLoaded = trends.length > 0;
  const trendsById = useMemo(() => {
    const m = new Map<string, Trend>();
    for (const t of trends) m.set(t.id, t);
    return m;
  }, [trends]);

  // ── Computed stage attribution (fix #7) ──
  //   Σ over the journey's categories of journey_decomposition[cat][`${tab}:${stageId}`]
  const stageAttribution = useMemo<Record<string, number> | null>(() => {
    const decomp = (simulation as SimulationResult | null)?.journey_decomposition;
    if (!decomp) return null;
    const prefix = tab === 'lhc' ? 'LHC' : 'Hair';
    const nsPrefix = `${tab}:`;
    const sums: Record<string, number> = {};
    let any = false;
    for (const [cat, stageMap] of Object.entries(decomp)) {
      if (!cat.startsWith(prefix)) continue;
      for (const [stageKey, v] of Object.entries(stageMap)) {
        if (!stageKey.startsWith(nsPrefix)) continue;
        const sid = stageKey.slice(nsPrefix.length);
        sums[sid] = (sums[sid] ?? 0) + (typeof v === 'number' ? v : 0);
        any = true;
      }
    }
    return any ? sums : null;
  }, [simulation, tab]);
  const attributionFor = useCallback(
    (stageId: string): number | null => (stageAttribution ? (stageAttribution[stageId] ?? 0) : null),
    [stageAttribution],
  );

  // ── Counters ──
  const totals = useMemo(() => {
    let benefiting = 0, declining = 0, ai = 0;
    for (const s of stages) {
      benefiting += s.benefiting.length;
      declining += s.negativelyImpacted.length;
      ai += s.benefiting.filter(t => t.provenance.author === 'ai').length;
      ai += s.negativelyImpacted.filter(t => t.provenance.author === 'ai').length;
    }
    return { benefiting, declining, ai };
  }, [stages]);

  // ── Selection helpers ──
  const openTile = useCallback((tile: JourneyTile, stageId: string, stageLabel: string, direction: Direction) => {
    setSelected({ tile, stageId, stageLabel, direction });
    setEditing(false);
  }, []);
  const closePanel = useCallback(() => { setSelected(null); setEditing(false); }, []);

  // ── Admin mutations (local state first; persisted on "Save to server") ──
  const mutateTile = useCallback((
    journeyKey: JourneyKey,
    stageId: string,
    direction: Direction,
    tileId: string,
    updater: (tiles: JourneyTile[]) => JourneyTile[],
  ) => {
    setContent(prev => {
      const next: JourneyContent = { lhc: cloneStages(prev.lhc), hair: cloneStages(prev.hair) };
      const arr = journeyKey === 'lhc' ? next.lhc : next.hair;
      const stage = arr.find(s => s.id === stageId);
      if (stage) {
        if (direction === 'benefiting') stage.benefiting = updater(stage.benefiting);
        else stage.negativelyImpacted = updater(stage.negativelyImpacted);
      }
      return next;
    });
    setSaveState('idle');
    setSaveMsg(null);
    // touch tileId to satisfy the linter on closures that only filter by id
    void tileId;
  }, []);

  const applyEdits = useCallback((sel: SelectedTile, edits: TileEdits) => {
    const updatedTile: JourneyTile = {
      ...sel.tile,
      name: edits.name.trim() || sel.tile.name,
      intensity: edits.intensity,
      driverNote: edits.driverNote,
      trendCodes: edits.trendCodes,
      analysis: edits.analysis.trim() ? edits.analysis : sel.tile.analysis,
      provenance: { ...sel.tile.provenance, date: CURRENT_YYYYMM }, // bump date (fix #6)
    };
    mutateTile(tab, sel.stageId, sel.direction, sel.tile.id, tiles =>
      tiles.map(t => (t.id === sel.tile.id ? updatedTile : t)));
    setSelected({ ...sel, tile: updatedTile });
    setEditing(false);
  }, [mutateTile, tab]);

  // ── Approve an AI-suggested tile (promote ✨ AI → ✍️ strategist) ──
  //   The reviewer accepts the mapping: the tile loses its "pending review"
  //   treatment and becomes a regular strategist-authored read. Grade is
  //   left as-is (review ≠ new hard evidence); the date is stamped now.
  //   Persisted with the rest of the blob via "Save to server".
  const approveAiTile = useCallback((sel: SelectedTile) => {
    const updatedTile: JourneyTile = {
      ...sel.tile,
      provenance: { ...sel.tile.provenance, author: 'strategist', date: CURRENT_YYYYMM },
    };
    mutateTile(tab, sel.stageId, sel.direction, sel.tile.id, tiles =>
      tiles.map(t => (t.id === sel.tile.id ? updatedTile : t)));
    setSelected({ ...sel, tile: updatedTile });
    setEditing(false);
  }, [mutateTile, tab]);

  const removeTile = useCallback((sel: SelectedTile) => {
    mutateTile(tab, sel.stageId, sel.direction, sel.tile.id, tiles =>
      tiles.filter(t => t.id !== sel.tile.id));
    closePanel();
  }, [mutateTile, tab, closePanel]);

  const addTile = useCallback((stageId: string, direction: Direction) => {
    const slug = Math.random().toString(36).slice(2, 8);
    const newTile: JourneyTile = {
      id: `${tab}.${stageId}.${direction === 'benefiting' ? 'exp' : 'con'}.new-${slug}`,
      name: 'New tile',
      type: 'product',
      trendCodes: [],
      driverNote: '',
      intensity: 2,
      // admin-authored ⇒ strategist (NOT ai), current month, estimate grade (fix #6)
      provenance: { author: 'strategist', date: CURRENT_YYYYMM, grade: 'estimate' },
      analysis: '',
    };
    mutateTile(tab, stageId, direction, newTile.id, tiles => [...tiles, newTile]);
    const stageLabel = stages.find(s => s.id === stageId)?.label ?? stageId;
    setSelected({ tile: newTile, stageId, stageLabel, direction });
    setEditing(true);
  }, [mutateTile, tab, stages]);

  // ── Persist the FULL {lhc, hair} blob (fix #6) ──
  const saveToServer = useCallback(async () => {
    setSaveState('saving');
    setSaveMsg(null);
    try {
      const res = await fetch('/api/journey', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lhc: content.lhc, hair: content.hair }),
      });
      if (res.status === 403) {
        setSaveState('forbidden');
        setSaveMsg('Admin required — your account cannot save journey content.');
        return;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        setSaveState('error');
        setSaveMsg(`Save failed (${res.status}). ${text.slice(0, 160)}`);
        return;
      }
      setSaveState('saved');
      setContentSource('server');
      setSaveMsg(null);
    } catch (e) {
      setSaveState('error');
      setSaveMsg(`Save failed. ${(e as Error).message}`);
    }
  }, [content]);

  // ════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen" style={{ backgroundColor: S.bg, color: S.onBg, fontFamily: BODY_FONT }}>
      <main className="max-w-[1720px] mx-auto px-8 py-10">

        {/* ─── Header (insight-rail accent) ─── */}
        <header className="mb-5 flex items-start justify-between gap-8 flex-wrap">
          <div className="pl-5" style={{ borderLeft: `4px solid ${S.primary}` }}>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] mb-2" style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>
              Consumer Journey · Strategist Overlay
            </div>
            <h1 className="font-extrabold tracking-tight" style={{ fontFamily: HEADLINE_FONT, color: S.onBg, fontSize: '2.4rem', lineHeight: 1.1 }}>
              Where Profit Pools Shift Along the Journey
            </h1>
            <p className="mt-2 max-w-2xl text-[15px]" style={{ color: S.onSurfaceVariant, lineHeight: 1.55 }}>
              Trends mapped to consumer moments, tile by tile. Each tile is an authored
              strategist read with visible provenance; click any tile for its evidence and analysis.
            </p>
          </div>

          {/* Header actions — keep the cross-tab navigation hooks alive */}
          <div className="flex items-center gap-2 flex-wrap">
            {onNavigateTrends && (
              <button
                onClick={onNavigateTrends}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-bold"
                style={{ backgroundColor: S.surfaceLow, color: S.onSurfaceVariant, border: 'none', cursor: 'pointer', fontFamily: HEADLINE_FONT }}
              >
                Trends <ArrowRight size={12} strokeWidth={2.5} />
              </button>
            )}
            {onNavigateProfitPoolShiftModel && (
              <button
                onClick={onNavigateProfitPoolShiftModel}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-bold"
                style={{ backgroundColor: S.surfaceLow, color: S.onSurfaceVariant, border: 'none', cursor: 'pointer', fontFamily: HEADLINE_FONT }}
              >
                Shift Matrix <ArrowRight size={12} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </header>

        {/* ─── Scope banner (fix #1) — exact sentiment, always visible ─── */}
        <div className="mb-5 flex items-start gap-2.5 rounded-xl px-4 py-3" style={{ backgroundColor: S.surfaceLow, border: `1px solid ${S.cardBorder}` }}>
          <Info size={14} strokeWidth={2.5} style={{ color: S.onSurfaceVariant, flexShrink: 0, marginTop: 2 }} />
          <p className="text-[12.5px]" style={{ color: S.onSurfaceVariant, lineHeight: 1.55, margin: 0 }}>
            <strong style={{ fontFamily: HEADLINE_FONT }}>Qualitative overlay mapping trends to consumer moments — authored content does not feed the Shift Matrix.</strong>{' '}
            Reads are strategist-authored, graded and dated; the per-stage attribution chips are the only computed
            figures here (terminal-year journey decomposition, when a run carries it).
            <span style={{ color: S.mutedText }}>
              {' '}Content version {JOURNEY_CONTENT_VERSION}
              {contentSource === 'server' && ' · edited content · server'}.
            </span>
          </p>
        </div>

        {/* ─── Tabs + filters ─── */}
        <section className="mb-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <FilterChip label="Laundry" active={tab === 'lhc'} onClick={() => { setTab('lhc'); closePanel(); }} />
            <FilterChip label="Hair" active={tab === 'hair'} onClick={() => { setTab('hair'); closePanel(); }} />
            {tab === 'lhc' && (
              <span className="text-[11px]" style={{ color: S.mutedText, fontStyle: 'italic', fontFamily: BODY_FONT }}>
                Laundry only — the Home Care (dish / surface / WC) journey is pending.
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: S.expansion, fontFamily: HEADLINE_FONT }}>
                <TrendingUp size={12} strokeWidth={2.5} /> Benefiting {totals.benefiting}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: S.error, fontFamily: HEADLINE_FONT }}>
                <TrendingDown size={12} strokeWidth={2.5} /> Declining {totals.declining}
              </span>
              {totals.ai > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: S.onAmberContainer, fontFamily: HEADLINE_FONT }}>
                  <Sparkles size={12} strokeWidth={2.5} /> {totals.ai} AI · pending review
                </span>
              )}
            </div>
            <div className="h-5 w-px" style={{ backgroundColor: S.cardBorder }} aria-hidden="true" />
            <div className="flex gap-1.5">
              {(Object.keys(TYPE_STYLES) as TileType[]).map(key => (
                <TypeChip
                  key={key}
                  typeKey={key}
                  active={typeFilter.has(key)}
                  onClick={() => setTypeFilter(prev => {
                    const next = new Set(prev);
                    if (next.has(key)) next.delete(key); else next.add(key);
                    return next;
                  })}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ─── Attribution lens caption (fix #7) ─── */}
        <p className="mb-4 text-[11.5px]" style={{ color: S.mutedText, lineHeight: 1.5 }}>
          {stageAttribution
            ? 'Computed stage attribution — per-stage share of the terminal-year median shift (journey-exposure weighted).'
            : 'Computed stage attribution arrives with the next production run — no numbers are shown until then.'}
        </p>

        {/* ─── Stage rail (horizontal scroll) ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: S.surface, boxShadow: '0 4px 60px -15px rgba(0,52,94,0.08)' }}
        >
          <div>
            <div
              className="grid"
              style={{
                // All stages fit on screen, no horizontal scroll (2026-06-14):
                // minmax(0,1fr) lets the columns shrink to share the available
                // width equally (Laundry 13 / Hair 8). Tiles are width:100% and
                // their text wraps, so columns compress cleanly.
                gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))`,
                width: '100%', gap: 0,
              }}
            >
              {/* Stage headers */}
              {stages.map((stage, i) => (
                <div
                  key={stage.id + '_h'}
                  style={{
                    padding: '14px 9px 12px', backgroundColor: S.surfaceLow,
                    borderRight: i < stages.length - 1 ? `1px solid ${S.cardBorder}` : 'none',
                    borderBottom: `1px solid ${S.cardBorder}`,
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 800, color: S.onSurfaceVariant, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: HEADLINE_FONT }}>
                    Stage {i + 1}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: S.onSurface, marginTop: 3, lineHeight: 1.25, fontFamily: HEADLINE_FONT, letterSpacing: '-0.01em' }}>
                    {stage.label}
                  </div>
                  <div style={{ marginTop: 7 }}>
                    <AttributionChip value={attributionFor(stage.id)} />
                  </div>
                </div>
              ))}

              {/* Benefiting row */}
              {stages.map((stage, i) => {
                const tiles = stage.benefiting.filter(t => typeFilter.has(t.type)).sort((a, b) => b.intensity - a.intensity);
                return (
                  <div
                    key={stage.id + '_b'}
                    style={{
                      backgroundColor: 'rgba(45,125,63,0.04)', padding: '9px 6px',
                      borderRight: i < stages.length - 1 ? `1px solid ${S.cardBorder}` : 'none',
                      borderBottom: `1px solid ${S.cardBorder}`, minHeight: 160,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, fontWeight: 800, color: S.expansion, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: HEADLINE_FONT }}>
                        <TrendingUp size={10} strokeWidth={2.5} /> Benefiting
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => addTile(stage.id, 'benefiting')}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.expansion, padding: 0, display: 'inline-flex' }}
                          title="Add benefiting tile"
                          aria-label="Add benefiting tile"
                        >
                          <Plus size={13} strokeWidth={2.5} />
                        </button>
                      )}
                    </div>
                    {tiles.map(tile => (
                      <TilePill
                        key={tile.id}
                        tile={tile}
                        direction="benefiting"
                        selected={selected?.tile.id === tile.id}
                        onClick={() => openTile(tile, stage.id, stage.label, 'benefiting')}
                      />
                    ))}
                  </div>
                );
              })}

              {/* Declining row */}
              {stages.map((stage, i) => {
                const tiles = stage.negativelyImpacted.filter(t => typeFilter.has(t.type)).sort((a, b) => b.intensity - a.intensity);
                return (
                  <div
                    key={stage.id + '_n'}
                    style={{
                      backgroundColor: 'rgba(159,64,61,0.04)', padding: '9px 6px',
                      borderRight: i < stages.length - 1 ? `1px solid ${S.cardBorder}` : 'none',
                      minHeight: 130,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, fontWeight: 800, color: S.error, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: HEADLINE_FONT }}>
                        <TrendingDown size={10} strokeWidth={2.5} /> Declining
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => addTile(stage.id, 'negativelyImpacted')}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.error, padding: 0, display: 'inline-flex' }}
                          title="Add declining tile"
                          aria-label="Add declining tile"
                        >
                          <Plus size={13} strokeWidth={2.5} />
                        </button>
                      )}
                    </div>
                    {tiles.map(tile => (
                      <TilePill
                        key={tile.id}
                        tile={tile}
                        direction="negativelyImpacted"
                        selected={selected?.tile.id === tile.id}
                        onClick={() => openTile(tile, stage.id, stage.label, 'negativelyImpacted')}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Flow indicator */}
          <div className="px-8 py-3.5 flex items-center gap-3" style={{ borderTop: `1px solid ${S.cardBorder}` }}>
            <span className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>
              Consumer flow
            </span>
            <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${S.primary}, ${S.outline})` }} />
            <ArrowRight size={14} strokeWidth={2.5} style={{ color: S.outline }} />
          </div>
        </motion.div>

        {/* ─── Admin save bar (fix #6) ─── */}
        {isAdmin && (
          <div className="mt-5 flex items-center justify-between gap-4 flex-wrap rounded-2xl px-5 py-3.5" style={{ backgroundColor: S.surface, boxShadow: '0 4px 60px -15px rgba(0,52,94,0.08)' }}>
            <div className="flex items-center gap-2">
              <Edit3 size={14} strokeWidth={2.5} style={{ color: S.onSurfaceVariant }} />
              <span className="text-[12px]" style={{ color: S.onSurfaceVariant, fontFamily: BODY_FONT }}>
                Admin editing on. Tile edits update this view; <strong style={{ fontFamily: HEADLINE_FONT }}>Save to server</strong> persists the full Laundry + Hair blob.
              </span>
            </div>
            <div className="flex items-center gap-3">
              {saveMsg && (
                <span className="text-[11.5px] font-bold" style={{ color: saveState === 'error' || saveState === 'forbidden' ? S.error : S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>
                  {saveMsg}
                </span>
              )}
              {saveState === 'saved' && !saveMsg && (
                <span className="inline-flex items-center gap-1 text-[11.5px] font-bold" style={{ color: S.expansion, fontFamily: HEADLINE_FONT }}>
                  <CircleCheck size={13} strokeWidth={2.5} /> Saved
                </span>
              )}
              <button
                onClick={saveToServer}
                disabled={saveState === 'saving'}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold"
                style={{
                  backgroundColor: saveState === 'saving' ? S.surfaceHigh : S.primary,
                  color: saveState === 'saving' ? S.onSurfaceVariant : '#fff',
                  border: 'none', cursor: saveState === 'saving' ? 'default' : 'pointer', fontFamily: HEADLINE_FONT,
                }}
              >
                <Save size={13} strokeWidth={2.5} />
                {saveState === 'saving' ? 'Saving…' : 'Save to server'}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ════════════════════════════════════════════════════════════════
          Detail panel (drawer) — Strategist Read + evidence + context
      ════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closePanel}
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,52,94,0.45)', zIndex: 40 }}
            />
            <motion.aside
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 280 }}
              style={{
                position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(560px, 100vw)',
                backgroundColor: S.bg, zIndex: 50, overflowY: 'auto',
                boxShadow: '-12px 0 60px -20px rgba(0,52,94,0.3)',
              }}
            >
              <PanelBody
                selected={selected}
                journeyKey={tab}
                trendsById={trendsById}
                trendsLoaded={trendsLoaded}
                attribution={attributionFor(selected.stageId)}
                isAdmin={isAdmin}
                editing={editing}
                onClose={closePanel}
                onEdit={() => setEditing(true)}
                onCancelEdit={() => setEditing(false)}
                onApplyEdits={edits => applyEdits(selected, edits)}
                onRemove={() => removeTile(selected)}
                onApprove={() => approveAiTile(selected)}
                onNavigateToTrend={onNavigateToTrend}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════
// Detail panel body (split out to keep the main render legible)
// ════════════════════════════════════════════════════════════════════════
const PanelBody: FC<{
  selected: SelectedTile;
  journeyKey: JourneyKey;
  trendsById: Map<string, Trend>;
  trendsLoaded: boolean;
  attribution: number | null;
  isAdmin: boolean;
  editing: boolean;
  onClose: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onApplyEdits: (edits: TileEdits) => void;
  onRemove: () => void;
  onApprove: () => void;
  onNavigateToTrend?: (query: string) => void;
}> = ({
  selected, journeyKey, trendsById, trendsLoaded, attribution,
  isAdmin, editing, onClose, onEdit, onCancelEdit, onApplyEdits, onRemove, onApprove, onNavigateToTrend,
}) => {
  const { tile, stageLabel, direction } = selected;
  const isExp = direction === 'benefiting';
  const accent = isExp ? S.expansion : S.error;
  const ts = TYPE_STYLES[tile.type];

  return (
    <div className="flex flex-col gap-4 p-5">
      {/* Header strip */}
      <div className="flex items-start justify-between gap-3">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>
              {journeyKey === 'lhc' ? 'Laundry' : 'Hair'} · {stageLabel}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full font-bold"
              style={{ fontSize: 9.5, padding: '1px 7px', backgroundColor: isExp ? S.expansionContainer : S.errorContainer, color: isExp ? S.onExpansionContainer : S.onErrorContainer, fontFamily: HEADLINE_FONT }}
            >
              {isExp ? <TrendingUp size={9} strokeWidth={2.5} /> : <TrendingDown size={9} strokeWidth={2.5} />}
              {isExp ? 'Benefiting' : 'Declining'}
            </span>
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: S.onBg, lineHeight: 1.15, fontFamily: HEADLINE_FONT, margin: 0 }}>
            {tile.name}
          </h2>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="inline-flex items-center rounded-full font-bold" style={{ fontSize: 10, padding: '1px 8px', backgroundColor: ts.bg, color: ts.fg, fontFamily: HEADLINE_FONT }}>
              {ts.label}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <IntensityDots intensity={tile.intensity} color={accent} />
              <span style={{ fontSize: 10, color: S.mutedText, fontFamily: HEADLINE_FONT, fontWeight: 700 }}>
                intensity {tile.intensity}/3
              </span>
            </span>
            <ProvenanceChip provenance={tile.provenance} />
            <GradeChip grade={tile.provenance.grade} />
          </div>
          {tile.driverNote && (
            <p style={{ fontSize: 12, color: S.onSurfaceVariant, lineHeight: 1.5, margin: '8px 0 0' }}>
              {tile.driverNote}
            </p>
          )}
          <div style={{ marginTop: 8 }}>
            <AttributionChip value={attribution} />
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1.5"
          style={{ backgroundColor: S.surfaceLow, border: 'none', cursor: 'pointer', color: S.onSurfaceVariant, flexShrink: 0 }}
          aria-label="Close"
        >
          <X size={16} strokeWidth={2.5} />
        </button>
      </div>

      {tile.provenance.author === 'ai' && (
        <div className="rounded-xl px-3.5 py-2.5" style={{ backgroundColor: S.amberContainer }}>
          <div className="flex items-start gap-2">
            <Sparkles size={13} strokeWidth={2.5} style={{ color: S.onAmberContainer, flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 11.5, color: S.onAmberContainer, lineHeight: 1.5, margin: 0 }}>
              AI-suggested mapping ({tile.provenance.date}) — <strong style={{ fontFamily: HEADLINE_FONT }}>pending strategist review</strong>. Treat as a hypothesis until verified.
            </p>
          </div>
          {isAdmin && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={onApprove}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-full text-[12.5px] font-bold"
                  style={{ backgroundColor: S.expansion, color: '#fff', border: 'none', cursor: 'pointer', fontFamily: HEADLINE_FONT }}
                  title="Approve — promote this AI suggestion to a regular strategist-reviewed read"
                >
                  <Check size={13} strokeWidth={2.5} /> Approve
                </button>
                <button
                  onClick={onRemove}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-full text-[12.5px] font-bold"
                  style={{ backgroundColor: S.errorContainer, color: S.onErrorContainer, border: 'none', cursor: 'pointer', fontFamily: HEADLINE_FONT }}
                  title="Discard — remove this AI suggestion from the journey"
                >
                  <Trash2 size={13} strokeWidth={2.5} /> Discard
                </button>
              </div>
              <p style={{ fontSize: 10, color: S.onAmberContainer, margin: '6px 0 0', fontStyle: 'italic' }}>
                Approve clears the review flag and makes it a regular read; Discard removes it. Either way, <strong style={{ fontFamily: HEADLINE_FONT }}>Save to server</strong> to persist.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Strategist Read */}
      <SectionCard
        title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><PenLine size={12} strokeWidth={2.5} /> Strategist Read</span>}
        accent={S.primaryDim}
        subtitle="Authored analysis — not simulated"
      >
        <div style={{ padding: '12px 14px', borderRadius: 10, backgroundColor: S.surfaceLow }}>
          {tile.analysis
            ? <MarkdownBlock text={tile.analysis} />
            : <p style={{ fontSize: 12.5, color: S.mutedText, fontStyle: 'italic', margin: 0 }}>No authored analysis for this tile yet.</p>}
        </div>
      </SectionCard>

      {/* Evidence cards */}
      <SectionCard
        title="Evidence — linked trends"
        accent={S.primary}
        subtitle="Live from the trend database (drill through to Trends)"
      >
        {tile.trendCodes.length === 0 ? (
          <p style={{ fontSize: 12, color: S.mutedText, fontStyle: 'italic', margin: 0 }}>No trend codes linked to this tile.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {tile.trendCodes.map(code => (
              <EvidenceCard
                key={code}
                code={code}
                trendsById={trendsById}
                trendsLoaded={trendsLoaded}
                onNavigateToTrend={onNavigateToTrend}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {/* Stage context */}
      <StageContextBlock stageLabel={stageLabel} journeyKey={journeyKey} />

      {/* Admin editing (fix #6) */}
      {isAdmin && !editing && (
        <button
          onClick={onEdit}
          className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-full text-sm font-bold uppercase tracking-[0.08em]"
          style={{ backgroundColor: S.primaryContainer, color: S.onPrimaryContainer, border: 'none', cursor: 'pointer', fontFamily: HEADLINE_FONT }}
        >
          <Edit3 size={13} strokeWidth={2.5} /> Edit tile
        </button>
      )}
      {isAdmin && editing && (
        <SectionCard title="Edit tile" accent={S.primary}>
          <TileEditor
            initial={tile}
            onSave={onApplyEdits}
            onCancel={onCancelEdit}
            onRemove={onRemove}
          />
        </SectionCard>
      )}
    </div>
  );
};

export default ConsumerJourney2;
