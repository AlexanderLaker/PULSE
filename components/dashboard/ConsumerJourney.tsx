/**
 * The Consumer Journey: a qualitative overlay that maps the Profit Pool
 * Drivers to the moments of the Laundry and Hair consumer journeys.
 *
 * Every tile is authored content with visible provenance (revision month and
 * evidence grade). Its dialog shows the drivers behind the moment, resolved to
 * the live drivers and linked to the Drivers page, the net effect, the
 * Strategist Read (authored, not simulated) and the stage context. Nothing
 * here feeds or reads the Shift Matrix.
 *
 * The tiles come from data/consumerJourney.ts until an admin saves an edit;
 * from then on the newest saved version replaces them. The stage contexts
 * always come from the module.
 *
 * This view sits one tab away from computed output, so it has to read as
 * authored judgment, never as model output.
 */

'use client';

import {
  useCallback, useEffect, useMemo, useRef, useState,
  type CSSProperties, type FC, type ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, ExternalLink, ArrowRight, X, Edit3, Check,
  Info, PenLine, CircleCheck, Plus, Trash2, Save, ChevronLeft, ChevronRight,
} from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import useOverlay from '@/hooks/useOverlay';
import { ApiError, getJourneyContent, saveJourneyContent } from '@/api/client';
import {
  LHC_JOURNEY, HAIR_JOURNEY, LHC_CTX, HAIR_CTX,
  type JourneyContent, type JourneyKey, type JourneyStageDef, type JourneyTile, type TileType,
  type PoolImpactGrade, type ProvenanceGrade,
} from '@/data/consumerJourney';
import { DRIVER_CODE_MAP, type DriverCodeInfo } from '@/data/driverCodeMap';
import type { Driver, ForceName } from '@/types';
import { S, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';
import { FORCE_COLORS, EXPANSION_RGB, CONTRACTION_RGB } from '@/lib/format';
import Chip, { type ChipKind } from '@/components/dashboard/Chip';

/** Force chips use the one force palette of lib/format, so a force has the same colour on every tab. */
const forceColor = (force: string): string => FORCE_COLORS[force as ForceName] ?? S.primary;

const TYPE_STYLES: Record<TileType, { label: string; bg: string; fg: string }> = {
  product: { label: 'Product', bg: '#d6e3ff', fg: '#00519e' },
  tech: { label: 'Tech', bg: '#dce9ff', fg: '#0052a0' },
  service: { label: 'Service', bg: '#e5eeff', fg: '#26619d' },
};

/** Evidence grade as a shared Chip. 'hypothesis' has no Chip kind of its own and renders neutral; its label carries the meaning. */
const GRADE_CHIP: Record<ProvenanceGrade, { kind: ChipKind; label: string }> = {
  verified: { kind: 'reported', label: 'Verified' },
  estimate: { kind: 'estimate', label: 'Estimate' },
  hypothesis: { kind: 'neutral', label: 'Hypothesis' },
};

/** The month an edit stamps on a tile, YYYY-MM. */
const CURRENT_YYYYMM = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();

// ════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════
interface ConsumerJourneyProps {
  /** Opens the Drivers page searched for this driver name. */
  onNavigateToDriver?: (query: string) => void;
  /** Shows the editing controls; the save route checks the role again. */
  isAdmin?: boolean;
}

/** The side of a stage a tile sits on: tailwind (benefiting) or headwind (negativelyImpacted). */
type Side = 'benefiting' | 'negativelyImpacted';

interface SelectedTile {
  tile: JourneyTile;
  stageId: string;
  stageLabel: string;
  side: Side;
}

/** The fields the admin editor changes. */
interface TileEdits {
  name: string;
  intensity: 1 | 2 | 3;
  driverNote: string;
  driverCodes: string[];
  analysis: string;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'forbidden';

/** A cited driver: its code-map entry and, once the drivers have loaded, the live row. */
interface CitedDriver {
  code: string;
  info: DriverCodeInfo;
  live: Driver | undefined;
}

// ════════════════════════════════════════════════════════════════════════
// Pure helpers
// ════════════════════════════════════════════════════════════════════════

/** Renders a Strategist Read: **bold** spans and blank-line paragraph breaks. */
const MarkdownBlock: FC<{ text: string }> = ({ text }) => {
  // The content stores its breaks escaped ("\\n\\n"); real breaks work too.
  const paragraphs = text.replace(/\\n/g, '\n').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
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

/** A tile's name without a trailing parenthetical; the full name stays in the content and in the tooltip. */
const displayTileName = (name: string): string => name.replace(/\s*\([^()]*\)\s*$/, '').trim();

/** Pool-impact grade to tile tint: High is notably dark, Low much lighter; `up` picks green (tailwind) or red (headwind). */
const gradeTint = (up: boolean, grade?: PoolImpactGrade): string => {
  const a = grade === 'High' ? 0.36 : grade === 'Med' ? 0.17 : 0.06;
  return `rgba(${up ? EXPANSION_RGB : CONTRACTION_RGB},${a})`;
};

/** Pool-impact grade to the opacity of the tile's accent bar (High solid, Low faint). */
const gradeBarOpacity = (grade?: PoolImpactGrade): number =>
  grade === 'High' ? 1 : grade === 'Med' ? 0.6 : 0.3;

/**
 * Display order on a stage side: pool-impact grade first (the tint, darkest on
 * top), then intensity; ties keep the content order. Sorts a copy, so the
 * saved content keeps its own order.
 */
const GRADE_RANK: Record<PoolImpactGrade, number> = { High: 3, Med: 2, Low: 1 };
const impactRank = (t: JourneyTile): number => (t.poolImpact ? GRADE_RANK[t.poolImpact.grade] : 0);
const sortTilesForDisplay = (tiles: JourneyTile[]): JourneyTile[] =>
  [...tiles].sort((a, b) => (impactRank(b) - impactRank(a)) || (b.intensity - a.intensity));

/**
 * A Laundry stage with more than ten tiles on a side spans two grid columns,
 * so its tiles wrap less and the rail stays short; Hair stages stay one column
 * wide. The count ignores the type filter, so a stage keeps its width when the
 * filter changes.
 */
const WIDE_STAGE_TILE_THRESHOLD = 10;
const stageSpan = (s: JourneyStageDef, journeyKey: JourneyKey): 1 | 2 =>
  (journeyKey === 'lhc' && Math.max(s.benefiting.length, s.negativelyImpacted.length) > WIDE_STAGE_TILE_THRESHOLD ? 2 : 1);

/** The drivers a tile cites, each once; a code outside the code map is not a driver. */
const citedDrivers = (tile: JourneyTile, driversById: Map<string, Driver>): CitedDriver[] =>
  Array.from(new Set(tile.driverCodes))
    .filter(code => Object.hasOwn(DRIVER_CODE_MAP, code))
    .map(code => {
      const info = DRIVER_CODE_MAP[code];
      return { code, info, live: driversById.get(info.driverId) };
    });

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

/**
 * Stage header rollup, so the board shows which stage matters most at a
 * glance: a split bar weighted by the tiles' authored intensity (1–3) and the
 * tile count per side. Both follow the type filter, so they match the tiles
 * below. Qualitative arithmetic, not engine output; the tooltip says so.
 */
const StageRollup: FC<{ benefiting: JourneyTile[]; negativelyImpacted: JourneyTile[] }> = ({ benefiting, negativelyImpacted }) => {
  const tw = benefiting.reduce((n, t) => n + t.intensity, 0);
  const hw = negativelyImpacted.reduce((n, t) => n + t.intensity, 0);
  const total = tw + hw;
  return (
    <div title="Tile count weighted by authored grades: qualitative overlay, not simulated">
      <div style={{ display: 'flex', width: '100%', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: S.surfaceHigh }} aria-hidden="true">
        {tw > 0 && <span style={{ display: 'block', width: `${(tw / total) * 100}%`, backgroundColor: S.expansion, opacity: 0.55 }} />}
        {hw > 0 && <span style={{ display: 'block', width: `${(hw / total) * 100}%`, backgroundColor: S.contraction, opacity: 0.55 }} />}
      </div>
      <div className="tabular-nums" style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: S.mutedText, fontFamily: HEADLINE_FONT, lineHeight: 1 }}>
        {benefiting.length}<span style={{ color: S.expansionInk }}>↗</span>
        {' · '}
        {negativelyImpacted.length}<span style={{ color: S.contractionInk }}>↘</span>
      </div>
    </div>
  );
};

/** Section header card used in the detail panel. */
const SectionCard: FC<{ title: ReactNode; accent: string; children: ReactNode; subtitle?: ReactNode }> = ({ title, accent, children, subtitle }) => (
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

/** A tile in the rail: the pool-impact grade sets its tint depth and the opacity of its accent bar. */
const TilePill: FC<{
  tile: JourneyTile;
  side: Side;
  selected: boolean;
  onClick: () => void;
}> = ({ tile, side, selected, onClick }) => {
  const isExp = side === 'benefiting';
  const accent = isExp ? S.expansion : S.error;
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg transition-all duration-150"
      style={{
        position: 'relative', display: 'block', padding: '2px 8px 2px 11px', marginBottom: 2,
        backgroundColor: selected ? S.surface : gradeTint(isExp, tile.poolImpact?.grade),
        border: `1px solid ${selected ? accent : S.cardBorder}`,
        boxShadow: selected ? `0 2px 12px -4px ${accent}66` : 'none',
        cursor: 'pointer', fontFamily: BODY_FONT,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', left: 0, top: 2, bottom: 2, width: 3, borderRadius: 3,
          backgroundColor: accent, opacity: gradeBarOpacity(tile.poolImpact?.grade),
        }}
      />
      <span
        // The name is never clamped; the tight line height keeps wrapped lines close together.
        style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: S.onSurface, lineHeight: 1.1, fontFamily: HEADLINE_FONT }}
        title={tile.name}
      >
        {displayTileName(tile.name)}
      </span>
    </button>
  );
};

// ════════════════════════════════════════════════════════════════════════
// Driver card (in the detail panel)
// ════════════════════════════════════════════════════════════════════════

/**
 * A driver behind the moment: the live driver once the drivers have loaded
 * (the code map's name and first sentence until then), read as a tailwind or
 * headwind by its own direction, with a link to the Drivers page.
 */
const DriverForceCard: FC<{
  driver: CitedDriver;
  driversLoaded: boolean;
  onNavigateToDriver?: (query: string) => void;
}> = ({ driver: { code, info, live }, driversLoaded, onNavigateToDriver }) => {
  const c = forceColor(info.force);
  const name = live?.name ?? info.name;
  const isExp = (live?.direction ?? info.direction) === 'Expansion';
  const description = live?.description ?? (driversLoaded ? '' : info.fallbackDescription);
  const sourceCount = live?.sources.length ?? 0;

  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: S.surfaceLow, border: `1px solid ${S.cardBorder}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span
          className="inline-flex items-center rounded-full font-bold"
          style={{ fontSize: 10, padding: '1px 7px', backgroundColor: c, color: '#fff', fontFamily: HEADLINE_FONT }}
        >
          {code}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: S.onSurface, fontFamily: HEADLINE_FONT, lineHeight: 1.3, flex: 1, minWidth: 0 }}>{name}</span>
        <span
          className="inline-flex items-center rounded-full font-bold"
          style={{ fontSize: 9.5, padding: '1px 7px', backgroundColor: `${c}14`, color: c, fontFamily: HEADLINE_FONT, whiteSpace: 'nowrap' }}
        >
          {info.force}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 9, flexWrap: 'wrap' }}>
        <span
          className="inline-flex items-center gap-1 rounded-full font-bold"
          style={{
            fontSize: 10.5, padding: '2px 9px',
            backgroundColor: isExp ? S.expansionContainer : S.errorContainer,
            color: isExp ? S.onExpansionContainer : S.onErrorContainer,
            fontFamily: HEADLINE_FONT, whiteSpace: 'nowrap',
          }}
          title={isExp ? 'Expansion driver: a tailwind for this moment' : 'Contraction driver: a headwind for this moment'}
        >
          {isExp ? <TrendingUp size={11} strokeWidth={2.5} /> : <TrendingDown size={11} strokeWidth={2.5} />}
          {isExp ? 'Tailwind' : 'Headwind'}
        </span>
      </div>
      {description && (
        <p style={{ fontSize: 11.5, color: S.onSurfaceVariant, lineHeight: 1.5, margin: '9px 0 0' }}>
          {description}
          {!live && !driversLoaded && (
            <span style={{ color: S.mutedText, fontStyle: 'italic' }}> (offline fallback)</span>
          )}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 9, flexWrap: 'wrap' }}>
        <button
          onClick={() => onNavigateToDriver?.(name)}
          className="inline-flex items-center gap-1.5"
          style={{
            fontSize: 11, fontWeight: 700, color: S.primary, background: 'none',
            border: 'none', cursor: 'pointer', padding: 0, fontFamily: HEADLINE_FONT,
          }}
          onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline'; }}
          onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none'; }}
        >
          <ExternalLink size={11} strokeWidth={2.5} />
          View in Drivers
        </button>
        {sourceCount > 0 && (
          <span style={{ fontSize: 10, color: S.mutedText, fontFamily: HEADLINE_FONT, fontWeight: 700 }} className="tabular-nums">
            {sourceCount} source{sourceCount === 1 ? '' : 's'}
          </span>
        )}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════
// Stage context (always visible), looked up by stage label
// ════════════════════════════════════════════════════════════════════════
const StageContextBlock: FC<{ stageLabel: string; journeyKey: JourneyKey }> = ({ stageLabel, journeyKey }) => {
  const ctx = (journeyKey === 'lhc' ? LHC_CTX : HAIR_CTX)[stageLabel];
  if (!ctx) return null;
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Henkel brands', value: ctx.henkelBrands },
    { label: 'Competitors', value: ctx.competitors },
    { label: 'Opportunity', value: ctx.opportunity },
  ];
  return (
    <SectionCard
      title={`Stage context: ${stageLabel}`}
      accent={S.primary}
      subtitle="Authored stage context, same provenance rules as the tile reads"
    >
      <div className="flex flex-col gap-2.5">
        {rows.map(r => (
          <div key={r.label}>
            <div className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT, marginBottom: 2 }}>
              {r.label}
            </div>
            <p style={{ fontSize: 12, color: S.onSurface, lineHeight: 1.55, margin: 0 }}>{r.value}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
};

// ════════════════════════════════════════════════════════════════════════
// Why-chain: the drivers behind a moment, then the net effect. It shows the
// reasoning behind the authored classification without claiming that the
// classification is simulated: the drivers are real, the read is judgment.
// ════════════════════════════════════════════════════════════════════════
const StepDot: FC<{ n: number }> = ({ n }) => (
  <span style={{
    position: 'absolute', left: 0, top: 0, width: 24, height: 24, borderRadius: 999,
    backgroundColor: S.primary, color: '#fff', fontFamily: HEADLINE_FONT, fontWeight: 800,
    fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
  }}>{n}</span>
);

const WhyChain: FC<{
  tile: JourneyTile;
  side: Side;
  driversById: Map<string, Driver>;
  driversLoaded: boolean;
  onNavigateToDriver?: (query: string) => void;
}> = ({ tile, side, driversById, driversLoaded, onNavigateToDriver }) => {
  const isExp = side === 'benefiting';
  const accent = isExp ? S.expansion : S.error;

  // The net effect counts each cited driver by its own direction, independent of the tile's side.
  const drivers = citedDrivers(tile, driversById);
  const up = drivers.filter(d => (d.live?.direction ?? d.info.direction) === 'Expansion').length;
  const down = drivers.length - up;
  const forceCounts: Record<string, number> = {};
  drivers.forEach(d => {
    const force = d.live?.force ?? d.info.force;
    forceCounts[force] = (forceCounts[force] ?? 0) + 1;
  });
  const dominant = Object.entries(forceCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  const stepWrap: CSSProperties = { position: 'relative', paddingLeft: 38, paddingBottom: 18 };
  const connector: CSSProperties = {
    position: 'absolute', left: 11.5, top: 24, bottom: 0, width: 1.5,
    background: `linear-gradient(${S.outline}, rgba(71,125,187,0.2))`,
  };
  const stepLabel: CSSProperties = {
    fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
    color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT,
  };

  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: S.surface, boxShadow: '0 4px 60px -15px rgba(0,52,94,0.08)' }}>
      <h3 style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.01em', margin: 0, color: S.onBg }}>
        {isExp ? 'Why this moment is expanding' : 'Why this moment is under pressure'}
      </h3>

      <div style={{ marginTop: 14 }}>
        {/* 1: the drivers behind this moment, each linked to the Drivers page */}
        <div style={stepWrap}>
          <StepDot n={1} /><span style={connector} />
          <div style={stepLabel}>Drivers behind this moment</div>
          <div style={{ marginTop: 8 }}>
            {drivers.length === 0 ? (
              <p style={{ fontSize: 12, color: S.mutedText, fontStyle: 'italic', margin: 0 }}>
                {tile.driverNote.startsWith('No modelled driver')
                  ? `${tile.driverNote}. The Strategist Read below stands as authored judgment; nothing here feeds the Shift Matrix.`
                  : 'No drivers linked to this tile.'}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {drivers.map(d => (
                  <DriverForceCard
                    key={d.code} driver={d} driversLoaded={driversLoaded} onNavigateToDriver={onNavigateToDriver}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 2: net effect */}
        <div style={{ ...stepWrap, paddingBottom: 0 }}>
          <StepDot n={2} />
          <div style={stepLabel}>Net effect</div>
          <div className="rounded-xl" style={{ marginTop: 8, backgroundColor: S.surfaceContainer, padding: '12px 14px' }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="inline-flex items-center gap-1" style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 13, color: S.expansion }}>
                <TrendingUp size={14} strokeWidth={2.5} /> {up} tailwind
              </span>
              <span className="inline-flex items-center gap-1" style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 13, color: S.error }}>
                <TrendingDown size={14} strokeWidth={2.5} /> {down} headwind
              </span>
            </div>
            <p style={{ fontSize: 12.5, color: S.onSurface, lineHeight: 1.5, margin: '9px 0 0' }}>
              {dominant ? <>Dominant force <strong style={{ fontFamily: HEADLINE_FONT }}>{dominant}</strong>. </> : null}
              The strategist classifies this moment as <strong style={{ fontFamily: HEADLINE_FONT, color: accent }}>{isExp ? 'a tailwind (benefiting)' : 'a headwind (declining)'}</strong>.
            </p>
            {tile.poolImpact && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>
                  Profit-pool impact
                </span>
                <span className="inline-flex items-center gap-1 rounded-full" style={{ fontSize: 11, fontWeight: 800, padding: '1px 10px', color: '#fff', backgroundColor: accent, fontFamily: HEADLINE_FONT }}>
                  {isExp ? '▲' : '▼'} {tile.poolImpact.grade}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════
// Admin tile editor, inline in the detail panel
// ════════════════════════════════════════════════════════════════════════
const INTENSITY_LABELS: Record<1 | 2 | 3, string> = { 1: 'Mild', 2: 'Moderate', 3: 'Strong' };

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
    driverCodes: initial.driverCodes.length ? [...initial.driverCodes] : [''],
    analysis: initial.analysis ?? '',
  });

  const allCodes = useMemo(() => Object.keys(DRIVER_CODE_MAP).sort((a, b) => a.localeCompare(b)), []);
  const labelStyle: CSSProperties = {
    fontSize: 10, fontWeight: 700, color: S.onSurfaceVariant, display: 'block',
    marginBottom: 5, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: HEADLINE_FONT,
  };
  const inputStyle: CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 8, backgroundColor: '#fff',
    border: `1px solid ${S.cardBorder}`, color: S.onSurface, fontSize: 12, fontFamily: BODY_FONT,
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
              {n} · {INTENSITY_LABELS[n]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Driver note</label>
        <input style={inputStyle} value={edits.driverNote} onChange={e => setEdits(p => ({ ...p, driverNote: e.target.value }))} />
      </div>

      <div>
        <label style={labelStyle}>Linked driver codes</label>
        {edits.driverCodes.map((code, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <select
              value={code}
              onChange={e => setEdits(p => {
                const next = [...p.driverCodes]; next[idx] = e.target.value; return { ...p, driverCodes: next };
              })}
              style={{ ...inputStyle, backgroundColor: S.surfaceLow }}
            >
              <option value="">Select driver…</option>
              {allCodes.map(c => (
                <option key={c} value={c}>{c}: {DRIVER_CODE_MAP[c].name}</option>
              ))}
            </select>
            {edits.driverCodes.length > 1 && (
              <button
                onClick={() => setEdits(p => ({ ...p, driverCodes: p.driverCodes.filter((_, i) => i !== idx) }))}
                style={{ padding: '0 10px', borderRadius: 8, backgroundColor: S.errorContainer, border: 'none', color: S.onErrorContainer, cursor: 'pointer', flexShrink: 0 }}
                title="Remove driver"
                aria-label="Remove driver"
              >
                <Trash2 size={13} strokeWidth={2.5} />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() => setEdits(p => ({ ...p, driverCodes: [...p.driverCodes, ''] }))}
          className="inline-flex items-center gap-1.5 rounded-full font-bold"
          style={{ marginTop: 2, padding: '5px 12px', backgroundColor: S.primaryContainer, color: S.onPrimaryContainer, border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: HEADLINE_FONT }}
        >
          <Plus size={12} strokeWidth={2.5} /> Add driver
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
          onClick={() => onSave({ ...edits, driverCodes: edits.driverCodes.filter(Boolean) })}
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
const ConsumerJourney: FC<ConsumerJourneyProps> = ({
  onNavigateToDriver,
  isAdmin = false,
}) => {
  const { drivers } = usePrism();

  // The bundled content, replaced by the newest saved version once it arrives.
  const [content, setContent] = useState<JourneyContent>({ lhc: LHC_JOURNEY, hair: HAIR_JOURNEY });
  useEffect(() => {
    let cancelled = false;
    getJourneyContent()
      .then((stored) => {
        if (stored && !cancelled) setContent({ lhc: stored.lhc, hair: stored.hair });
      })
      .catch(() => { /* the bundled content stays */ });
    return () => { cancelled = true; };
  }, []);

  const [tab, setTab] = useState<JourneyKey>('lhc');
  const [typeFilter, setTypeFilter] = useState<Set<TileType>>(() => new Set(['product', 'tech', 'service']));
  const [selected, setSelected] = useState<SelectedTile | null>(null);
  const [editing, setEditing] = useState(false);
  // The editing controls stay hidden until an admin turns them on.
  const [editMode, setEditMode] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const stages = content[tab];

  const driversLoaded = drivers.length > 0;
  const driversById = useMemo(() => new Map(drivers.map(d => [d.id, d])), [drivers]);

  const totals = useMemo(() => ({
    benefiting: stages.reduce((n, s) => n + s.benefiting.length, 0),
    declining: stages.reduce((n, s) => n + s.negativelyImpacted.length, 0),
  }), [stages]);

  const openTile = useCallback((tile: JourneyTile, stageId: string, stageLabel: string, side: Side) => {
    setSelected({ tile, stageId, stageLabel, side });
    setEditing(false);
  }, []);
  const closePanel = useCallback(() => { setSelected(null); setEditing(false); }, []);

  // The tile dialog shares the overlay behaviour: Escape closes it, focus stays
  // inside and returns to the tile, and the page behind does not scroll.
  const panelRef = useRef<HTMLDivElement | null>(null);
  useOverlay(!!selected, closePanel, panelRef);

  // The visible tiles in rail order (stage by stage, tailwind before headwind,
  // filtered and sorted as rendered), so ◀ ▶ step through neighbours you can see.
  const flatTiles = useMemo<SelectedTile[]>(() => {
    const out: SelectedTile[] = [];
    for (const s of stages) {
      for (const side of ['benefiting', 'negativelyImpacted'] as const) {
        sortTilesForDisplay(s[side].filter(t => typeFilter.has(t.type)))
          .forEach(t => out.push({ tile: t, stageId: s.id, stageLabel: s.label, side }));
      }
    }
    return out;
  }, [stages, typeFilter]);
  const selectedIndex = useMemo(
    () => (selected ? flatTiles.findIndex(f => f.tile.id === selected.tile.id) : -1),
    [flatTiles, selected],
  );
  const stepSelection = useCallback((delta: number) => {
    if (selectedIndex < 0) return;
    const ni = selectedIndex + delta;
    if (ni < 0 || ni >= flatTiles.length) return;
    setSelected(flatTiles[ni]);
    setEditing(false);
  }, [selectedIndex, flatTiles]);

  // ← and → step to the neighbouring tiles while the dialog is open.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') stepSelection(-1);
      else if (e.key === 'ArrowRight') stepSelection(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, stepSelection]);

  // ── Admin edits: local until "Save to server" ──
  const mutateTiles = useCallback((stageId: string, side: Side, update: (tiles: JourneyTile[]) => JourneyTile[]) => {
    setContent(prev => ({
      ...prev,
      [tab]: prev[tab].map(s => (s.id === stageId ? { ...s, [side]: update(s[side]) } : s)),
    }));
    setSaveState('idle');
    setSaveMsg(null);
  }, [tab]);

  const applyEdits = useCallback((sel: SelectedTile, edits: TileEdits) => {
    const updated: JourneyTile = {
      ...sel.tile,
      name: edits.name.trim() || sel.tile.name,
      intensity: edits.intensity,
      driverNote: edits.driverNote,
      driverCodes: edits.driverCodes,
      analysis: edits.analysis.trim() ? edits.analysis : sel.tile.analysis,
      provenance: { ...sel.tile.provenance, date: CURRENT_YYYYMM },   // an edit re-dates the tile
    };
    mutateTiles(sel.stageId, sel.side, tiles => tiles.map(t => (t.id === sel.tile.id ? updated : t)));
    setSelected({ ...sel, tile: updated });
    setEditing(false);
  }, [mutateTiles]);

  const removeTile = useCallback((sel: SelectedTile) => {
    mutateTiles(sel.stageId, sel.side, tiles => tiles.filter(t => t.id !== sel.tile.id));
    closePanel();
  }, [mutateTiles, closePanel]);

  const addTile = useCallback((stageId: string, side: Side) => {
    const slug = Math.random().toString(36).slice(2, 8);
    const tile: JourneyTile = {
      id: `${tab}.${stageId}.${side === 'benefiting' ? 'exp' : 'con'}.new-${slug}`,
      name: 'New tile',
      type: 'product',
      driverCodes: [],
      driverNote: '',
      intensity: 2,
      provenance: { author: 'strategist', date: CURRENT_YYYYMM, grade: 'estimate' },
      analysis: '',
    };
    mutateTiles(stageId, side, tiles => [...tiles, tile]);
    const stageLabel = stages.find(s => s.id === stageId)?.label ?? stageId;
    setSelected({ tile, stageId, stageLabel, side });
    setEditing(true);
  }, [mutateTiles, tab, stages]);

  /** Saves the whole tile map for every user; the route answers 403 unless the caller is an admin. */
  const saveToServer = useCallback(async () => {
    setSaveState('saving');
    setSaveMsg(null);
    try {
      await saveJourneyContent(content);
      setSaveState('saved');
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setSaveState('forbidden');
        setSaveMsg('Admin required: your account cannot save journey content.');
        return;
      }
      const status = e instanceof ApiError && e.status > 0 ? ` (${e.status})` : '';
      setSaveState('error');
      setSaveMsg(`Save failed${status}. ${(e as Error).message.slice(0, 160)}`);
    }
  }, [content]);

  // ════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen" style={{ backgroundColor: S.bg, color: S.onBg, fontFamily: BODY_FONT }}>
      <main className="max-w-[1440px] mx-auto px-8 py-10">

        {/* ─── Header ─── */}
        <header className="mb-5 flex items-start justify-between gap-8 flex-wrap">
          <div className="pl-5" style={{ borderLeft: `4px solid ${S.primary}` }}>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] mb-2" style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>
              Consumer Journey
            </div>
            <h1 className="font-extrabold tracking-tight" style={{ fontFamily: HEADLINE_FONT, color: S.onBg, fontSize: '2.4rem', lineHeight: 1.1 }}>
              Where Profit Pools Shift Along the Journey
            </h1>
            <p className="mt-2 max-w-2xl text-[15px]" style={{ color: S.onSurfaceVariant, lineHeight: 1.55 }}>
              Profit Pool Drivers mapped to consumer moments, tile by tile. Each tile is an authored
              strategist read with visible provenance; click any tile for its evidence and analysis.
            </p>
          </div>
        </header>

        {/* ─── Scope banner, always visible ─── */}
        <div className="mb-5 flex items-start gap-2.5 rounded-xl px-4 py-3" style={{ backgroundColor: S.surfaceLow, border: `1px solid ${S.cardBorder}` }}>
          <Info size={14} strokeWidth={2.5} style={{ color: S.onSurfaceVariant, flexShrink: 0, marginTop: 2 }} />
          <p className="text-[12.5px]" style={{ color: S.onSurfaceVariant, lineHeight: 1.55, margin: 0 }}>
            <strong style={{ fontFamily: HEADLINE_FONT }}>Qualitative overlay mapping drivers to consumer moments. Authored content does not feed the Shift Matrix.</strong>
          </p>
        </div>

        {/* ─── Tabs and filters ─── */}
        <section className="mb-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <FilterChip label="Laundry" active={tab === 'lhc'} onClick={() => { setTab('lhc'); closePanel(); }} />
            <FilterChip label="Hair" active={tab === 'hair'} onClick={() => { setTab('hair'); closePanel(); }} />
            {isAdmin && (
              <button
                onClick={() => { if (editMode) setEditing(false); setEditMode(v => !v); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all duration-200"
                style={{
                  backgroundColor: editMode ? S.primaryContainer : S.surfaceLow,
                  color: editMode ? S.onPrimaryContainer : S.onSurfaceVariant,
                  border: 'none', cursor: 'pointer', fontFamily: HEADLINE_FONT,
                }}
                aria-pressed={editMode}
                title={editMode
                  ? 'Editing is on: click to hide the add / edit / save controls'
                  : 'Show the editing controls (add tiles, edit tiles, save to server)'}
              >
                <Edit3 size={11} strokeWidth={2.5} /> Edit board
              </button>
            )}
            {tab === 'lhc' && (
              <span className="text-[11px]" style={{ color: S.mutedText, fontStyle: 'italic', fontFamily: BODY_FONT }}>
                Laundry only: the Home Care (dish / surface / WC) journey is not built yet.
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: S.expansion, fontFamily: HEADLINE_FONT }}>
                <TrendingUp size={12} strokeWidth={2.5} /> Tailwind {totals.benefiting}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: S.error, fontFamily: HEADLINE_FONT }}>
                <TrendingDown size={12} strokeWidth={2.5} /> Headwind {totals.declining}
              </span>
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

        {/* ─── Stage rail ─── */}
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
                // Every stage fits the width: minmax(0, 1fr) lets the columns
                // shrink equally. A wide stage takes two units, so the unit
                // count is the number of stages plus the wide ones; the header,
                // tailwind and headwind rows each add up to that count, which
                // keeps the three rows aligned.
                gridTemplateColumns: `repeat(${stages.reduce((n, s) => n + stageSpan(s, tab), 0)}, minmax(0, 1fr))`,
                width: '100%', gap: 0,
              }}
            >
              {/* Stage headers with the tailwind / headwind rollup */}
              {stages.map((stage, i) => (
                <div
                  key={stage.id + '_h'}
                  style={{
                    gridColumn: stageSpan(stage, tab) === 2 ? 'span 2' : undefined,
                    padding: '10px 9px 9px', backgroundColor: S.surfaceLow,
                    borderRight: i < stages.length - 1 ? `1px solid ${S.cardBorder}` : 'none',
                    borderBottom: `1px solid ${S.cardBorder}`,
                    // A flex column pins the rollup to the bottom of the cell
                    // (the grid gives every header the same height), so the
                    // bars line up whether a title takes one line or two.
                    display: 'flex', flexDirection: 'column',
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 800, color: S.onSurfaceVariant, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: HEADLINE_FONT }}>
                    Stage {i + 1}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: S.onSurface, marginTop: 3, lineHeight: 1.25, fontFamily: HEADLINE_FONT, letterSpacing: '-0.01em' }}>
                    {stage.label}
                  </div>
                  {/* marginTop auto pushes the rollup to the bottom edge; the padding keeps it clear of a two-line title. */}
                  <div style={{ marginTop: 'auto', paddingTop: 7 }}>
                    <StageRollup
                      benefiting={stage.benefiting.filter(t => typeFilter.has(t.type))}
                      negativelyImpacted={stage.negativelyImpacted.filter(t => typeFilter.has(t.type))}
                    />
                  </div>
                </div>
              ))}

              {/* Tailwind row */}
              {stages.map((stage, i) => {
                const tiles = sortTilesForDisplay(stage.benefiting.filter(t => typeFilter.has(t.type)));
                return (
                  <div
                    key={stage.id + '_b'}
                    style={{
                      gridColumn: stageSpan(stage, tab) === 2 ? 'span 2' : undefined,
                      backgroundColor: `rgba(${EXPANSION_RGB},0.04)`, padding: '7px 6px',
                      borderRight: i < stages.length - 1 ? `1px solid ${S.cardBorder}` : 'none',
                      borderBottom: `1px solid ${S.cardBorder}`, minHeight: 56,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, fontWeight: 800, color: S.expansion, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: HEADLINE_FONT }}>
                        <TrendingUp size={10} strokeWidth={2.5} /> Tailwind
                      </span>
                      {isAdmin && editMode && (
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
                        side="benefiting"
                        selected={selected?.tile.id === tile.id}
                        onClick={() => openTile(tile, stage.id, stage.label, 'benefiting')}
                      />
                    ))}
                  </div>
                );
              })}

              {/* Headwind row */}
              {stages.map((stage, i) => {
                const tiles = sortTilesForDisplay(stage.negativelyImpacted.filter(t => typeFilter.has(t.type)));
                return (
                  <div
                    key={stage.id + '_n'}
                    style={{
                      gridColumn: stageSpan(stage, tab) === 2 ? 'span 2' : undefined,
                      backgroundColor: `rgba(${CONTRACTION_RGB},0.04)`, padding: '7px 6px',
                      borderRight: i < stages.length - 1 ? `1px solid ${S.cardBorder}` : 'none',
                      minHeight: 56,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, fontWeight: 800, color: S.error, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: HEADLINE_FONT }}>
                        <TrendingDown size={10} strokeWidth={2.5} /> Headwind
                      </span>
                      {isAdmin && editMode && (
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
                        side="negativelyImpacted"
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

        {/* ─── Admin save bar, shown in edit mode ─── */}
        {isAdmin && editMode && (
          <div className="mt-5 flex items-center justify-between gap-4 flex-wrap rounded-2xl px-5 py-3.5" style={{ backgroundColor: S.surface, boxShadow: '0 4px 60px -15px rgba(0,52,94,0.08)' }}>
            <div className="flex items-center gap-2">
              <Edit3 size={14} strokeWidth={2.5} style={{ color: S.onSurfaceVariant }} />
              <span className="text-[12px]" style={{ color: S.onSurfaceVariant, fontFamily: BODY_FONT }}>
                Editing on: tile edits update this view. <strong style={{ fontFamily: HEADLINE_FONT }}>Save to server</strong> saves the journey content for all users.
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
          Detail dialog: Why-chain, Strategist Read and stage context
      ════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              key="cj-scrim"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,52,94,0.55)', backdropFilter: 'blur(2px)', zIndex: 40 }}
            />
            <motion.div
              key="cj-dialog"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              onClick={closePanel}
              style={{
                position: 'fixed', inset: 0, zIndex: 50, overflowY: 'auto',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 20px',
              }}
            >
              <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                aria-label={`${displayTileName(selected.tile.name)}: detail`}
                onClick={e => e.stopPropagation()}
                style={{
                  width: 'min(1120px, 100%)', margin: 'auto', maxHeight: '92vh',
                  display: 'flex', flexDirection: 'column',
                  backgroundColor: S.bg, borderRadius: 20,
                  boxShadow: '0 2px 4px rgba(0,52,94,0.05), 0 12px 32px -8px rgba(0,52,94,0.16), 0 28px 60px -14px rgba(0,52,94,0.20)',
                  overflow: 'hidden',
                }}
              >
                <PanelBody
                  selected={selected}
                  journeyKey={tab}
                  driversById={driversById}
                  driversLoaded={driversLoaded}
                  canEdit={isAdmin && editMode}
                  editing={editing}
                  position={selectedIndex >= 0 ? { index: selectedIndex, total: flatTiles.length } : null}
                  onPrev={() => stepSelection(-1)}
                  onNext={() => stepSelection(1)}
                  onClose={closePanel}
                  onEdit={() => setEditing(true)}
                  onCancelEdit={() => setEditing(false)}
                  onApplyEdits={edits => applyEdits(selected, edits)}
                  onRemove={() => removeTile(selected)}
                  onNavigateToDriver={onNavigateToDriver}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════
// Detail panel body
// ════════════════════════════════════════════════════════════════════════
const PanelBody: FC<{
  selected: SelectedTile;
  journeyKey: JourneyKey;
  driversById: Map<string, Driver>;
  driversLoaded: boolean;
  canEdit: boolean;
  editing: boolean;
  position: { index: number; total: number } | null;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onApplyEdits: (edits: TileEdits) => void;
  onRemove: () => void;
  onNavigateToDriver?: (query: string) => void;
}> = ({
  selected, journeyKey, driversById, driversLoaded,
  canEdit, editing, position, onPrev, onNext, onClose, onEdit, onCancelEdit, onApplyEdits, onRemove, onNavigateToDriver,
}) => {
  const { tile, stageLabel, side } = selected;
  const isExp = side === 'benefiting';
  const ts = TYPE_STYLES[tile.type];
  const canPrev = !!position && position.index > 0;
  const canNext = !!position && position.index < position.total - 1;

  const iconBtn: CSSProperties = {
    width: 34, height: 34, borderRadius: 999, border: 'none', backgroundColor: S.surfaceLow,
    color: S.onSurfaceVariant, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  };
  const iconBtnOff: CSSProperties = { ...iconBtn, opacity: 0.4, cursor: 'default' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, width: '100%', fontFamily: BODY_FONT }}>
      {/* ── Sticky top bar: breadcrumb, neighbour navigation, close ── */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 18px', backgroundColor: 'rgba(248,249,255,0.92)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${S.cardBorder}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: HEADLINE_FONT, fontWeight: 700, fontSize: 12, color: S.onSurfaceVariant, minWidth: 0 }}>
          <span style={{ whiteSpace: 'nowrap' }}>{journeyKey === 'lhc' ? 'Laundry' : 'Hair'}</span>
          <ChevronRight size={13} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          <span style={{ color: S.onBg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stageLabel}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10.5, color: S.mutedText, fontFamily: HEADLINE_FONT, fontWeight: 700, marginRight: 2 }}>Esc to close</span>
          <button onClick={onPrev} disabled={!canPrev} style={canPrev ? iconBtn : iconBtnOff} aria-label="Previous tile" title="Previous tile"><ChevronLeft size={16} strokeWidth={2.5} /></button>
          <button onClick={onNext} disabled={!canNext} style={canNext ? iconBtn : iconBtnOff} aria-label="Next tile" title="Next tile"><ChevronRight size={16} strokeWidth={2.5} /></button>
          <button onClick={onClose} style={iconBtn} aria-label="Close" title="Close"><X size={16} strokeWidth={2.5} /></button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {/* Hero */}
        <div style={{ padding: '22px 26px 18px', borderBottom: `1px solid ${S.cardBorder}` }}>
          <span
            className="inline-flex items-center gap-1 rounded-full font-bold"
            style={{ fontSize: 11, padding: '3px 11px', backgroundColor: isExp ? S.expansionContainer : S.errorContainer, color: isExp ? S.onExpansionContainer : S.onErrorContainer, fontFamily: HEADLINE_FONT }}
          >
            {isExp ? <TrendingUp size={11} strokeWidth={2.5} /> : <TrendingDown size={11} strokeWidth={2.5} />}
            {isExp ? 'Tailwind' : 'Headwind'}
          </span>
          <h2 style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: '1.7rem', lineHeight: 1.12, letterSpacing: '-0.02em', margin: '11px 0 0', color: S.onBg }} title={tile.name}>
            {displayTileName(tile.name)}
          </h2>
          {tile.driverNote && (
            <p style={{ fontSize: 14.5, color: S.onSurfaceVariant, lineHeight: 1.55, margin: '9px 0 0', maxWidth: '52rem' }}>{tile.driverNote}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 13 }}>
            <Chip
              kind={GRADE_CHIP[tile.provenance.grade].kind}
              label={GRADE_CHIP[tile.provenance.grade].label}
              title={`Evidence grade: ${tile.provenance.grade}`}
            />
            <Chip
              kind="authored"
              label={`Strategist-authored · ${tile.provenance.date}`}
              title={`Strategist-authored (${tile.provenance.date})`}
            />
            <span className="inline-flex items-center rounded-full font-bold" style={{ fontSize: 10.5, padding: '2px 9px', backgroundColor: ts.bg, color: ts.fg, fontFamily: HEADLINE_FONT }}>{ts.label}</span>
            <span className="inline-flex items-center rounded-full font-bold" style={{ fontSize: 10.5, padding: '2px 9px', backgroundColor: S.surfaceLow, color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>Intensity {tile.intensity}/3</span>
          </div>
        </div>

        {/* Two columns: Why-chain on the left, Strategist Read and stage context on the right */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-5" style={{ padding: '20px 26px 30px' }}>
          <div>
            <WhyChain
              tile={tile}
              side={side}
              driversById={driversById}
              driversLoaded={driversLoaded}
              onNavigateToDriver={onNavigateToDriver}
            />
          </div>

          <div className="flex flex-col gap-4">
            <SectionCard
              title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><PenLine size={12} strokeWidth={2.5} /> Strategist Read</span>}
              accent={S.primaryDim}
              subtitle="Authored analysis, not simulated"
            >
              <div style={{ padding: '12px 14px', borderRadius: 10, backgroundColor: S.surfaceLow }}>
                {tile.analysis
                  ? <MarkdownBlock text={tile.analysis} />
                  : <p style={{ fontSize: 12.5, color: S.mutedText, fontStyle: 'italic', margin: 0 }}>No authored analysis for this tile yet.</p>}
              </div>
            </SectionCard>

            <StageContextBlock stageLabel={stageLabel} journeyKey={journeyKey} />

            {canEdit && !editing && (
              <button
                onClick={onEdit}
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-full text-sm font-bold uppercase tracking-[0.08em]"
                style={{ backgroundColor: S.primaryContainer, color: S.onPrimaryContainer, border: 'none', cursor: 'pointer', fontFamily: HEADLINE_FONT }}
              >
                <Edit3 size={13} strokeWidth={2.5} /> Edit tile
              </button>
            )}
            {canEdit && editing && (
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
        </div>
      </div>
    </div>
  );
};

export default ConsumerJourney;
