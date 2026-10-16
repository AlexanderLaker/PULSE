/**
 * The journey board's small parts: the journey switch and type filter, a
 * stage's roll-up, a tile in the stage rail, the sections of the tile dialog,
 * the text of a Strategist Read, a cited driver's card and the stage context.
 * The stage contexts arrive with the journey the API serves and reach the
 * context block as a prop; nothing here imports content.
 */
import type { FC, ReactNode } from 'react';
import { TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import type { JourneyTile, PoolImpactGrade, StageContext, TileType } from '@/data/consumerJourney';
import { S, SHADOW, HEADLINE_FONT, BODY_FONT, FIGURES } from '@/lib/theme';
import Chip from '@/components/dashboard/Chip';
import {
  type CitedDriver, displayTileName, forceColor, gradeBarOpacity, gradeTint, impactWords, type Side,
  sideWord, TYPE_STYLES,
} from './shared';

/** Renders a Strategist Read: **bold** spans and blank-line paragraph breaks. */
export const MarkdownBlock: FC<{ text: string }> = ({ text }) => {
  // Paragraphs are separated by a blank line.
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
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

// ════════════════════════════════════════════════════════════════════════
// Small presentational atoms
// ════════════════════════════════════════════════════════════════════════

/** The Laundry / Hair switch: one journey at a time. */
export const JourneySwitch: FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className="px-4 py-1.5 rounded-full text-sm font-bold transition-all duration-200"
    style={{
      backgroundColor: active ? S.primary : S.surfaceLow,
      color: active ? S.onPrimary : S.onSurfaceVariant,
      border: 'none', cursor: 'pointer', fontFamily: HEADLINE_FONT,
    }}
  >
    {label}
  </button>
);

/** A type filter: pressed shows its tint, unpressed its outline; neither is dimmed, because an unpressed filter is not disabled. */
export const TypeChip: FC<{ typeKey: TileType; active: boolean; onClick: () => void }> = ({ typeKey, active, onClick }) => {
  const st = TYPE_STYLES[typeKey];
  return (
    <button type="button"
      onClick={onClick}
      className="px-2.5 py-1 rounded-full text-[11px] font-bold transition-all duration-150"
      style={{
        backgroundColor: active ? st.bg : S.surface,
        color: active ? st.fg : S.onSurfaceVariant,
        border: `1px solid ${active ? st.fg : S.cardBorderStrong}`,
        minHeight: 24, cursor: 'pointer', fontFamily: HEADLINE_FONT,
      }}
      aria-pressed={active}
    >
      {st.label}
    </button>
  );
};

/**
 * The key to the tiles' tint: the pool-impact grade an author gave a tile sets
 * how dark it is. The board shows the grade by colour alone otherwise; each
 * pill also says it in its accessible name.
 */
const LEGEND_GRADES: PoolImpactGrade[] = ['Low', 'Med', 'High'];
export const ImpactLegend: FC = () => (
  <div className="flex items-center gap-2 flex-wrap" style={{ fontFamily: HEADLINE_FONT }}>
    <span className="inline-flex items-center gap-1.5">
      {LEGEND_GRADES.map(grade => (
        <span key={grade} className="inline-flex items-center gap-1">
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block', width: 12, height: 12, borderRadius: 3,
              backgroundColor: gradeTint(true, grade), border: `1px solid ${S.cardBorder}`,
            }}
          />
          <span style={{ fontSize: 11, fontWeight: 700, color: S.onSurfaceVariant }}>{grade}</span>
        </span>
      ))}
    </span>
    <span style={{ fontSize: 11, color: S.mutedText, fontFamily: BODY_FONT }}>
      darker = higher authored profit-pool impact
    </span>
  </div>
);

/**
 * Stage header rollup, so the board shows which stage matters most at a
 * glance: a split bar weighted by the tiles' authored intensity (1–3) and the
 * tile count per side. Both follow the type filter, so they match the tiles
 * below. Qualitative arithmetic, not engine output; the tooltip says so.
 */
export const StageRollup: FC<{ benefiting: JourneyTile[]; negativelyImpacted: JourneyTile[] }> = ({ benefiting, negativelyImpacted }) => {
  const tw = benefiting.reduce((n, t) => n + t.intensity, 0);
  const hw = negativelyImpacted.reduce((n, t) => n + t.intensity, 0);
  const total = tw + hw;
  return (
    <div title="Tiles weighted by their authored intensity (1 to 3): qualitative overlay, not simulated">
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

/** A section of the tile detail: a heading with an accent bar, an optional subtitle and the content. */
export const DetailSection: FC<{ title: ReactNode; accent: string; children: ReactNode; subtitle?: ReactNode }> = ({ title, accent, children, subtitle }) => (
  <div className="rounded-2xl p-4" style={{ backgroundColor: S.surface, boxShadow: SHADOW.card }}>
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

/**
 * A tile in the rail: the pool-impact grade sets its tint depth and the
 * opacity of its accent bar, and its accessible name says the side and the
 * grade the tint shows ("Detergent sheets & pods, tailwind, high impact").
 */
export const TilePill: FC<{
  tile: JourneyTile;
  side: Side;
  selected: boolean;
  onClick: () => void;
}> = ({ tile, side, selected, onClick }) => {
  const isExp = side === 'benefiting';
  const accent = isExp ? S.expansion : S.error;
  return (
    <button type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg transition-all duration-150"
      style={{
        position: 'relative', display: 'block', padding: '3px 8px 3px 11px', marginBottom: 2, minHeight: 24,
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
        // The name is never clamped; the tight line height keeps wrapped
        // lines close together, and a word longer than the column is
        // hyphenated (the page is en-GB) or, failing that, broken, rather
        // than running into the next stage.
        style={{
          display: 'block', fontSize: 11.5, fontWeight: 700, color: S.onSurface, lineHeight: 1.15,
          fontFamily: HEADLINE_FONT, overflowWrap: 'anywhere', hyphens: 'auto',
        }}
        title={tile.name}
      >
        {displayTileName(tile.name)}
        {/* Inside the name's span, so the accessible name runs on without a gap before the comma. */}
        <span className="sr-only">, {sideWord(side)}, {impactWords(tile.poolImpact?.grade)}</span>
      </span>
    </button>
  );
};

// ════════════════════════════════════════════════════════════════════════
// Driver card (in the detail panel)
// ════════════════════════════════════════════════════════════════════════

/**
 * A driver behind the moment: its code and force from the code map and, once
 * the drivers have loaded, the live driver's name, direction chip, what that
 * direction means for this moment and its description; until then the code
 * and the force only. A link opens the Drivers page searched for the driver
 * (its name, or its code while the name is not known).
 */
export const DriverForceCard: FC<{
  driver: CitedDriver;
  driversLoaded: boolean;
  onNavigateToDriver?: (query: string) => void;
}> = ({ driver: { code, force, live }, driversLoaded, onNavigateToDriver }) => {
  const c = forceColor(force);
  const isExp = live?.direction === 'Expansion';
  const sourceCount = live?.sources.length ?? 0;

  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: S.surfaceLow, border: `1px solid ${S.cardBorder}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {/* The force colour is a dot and a tint, never the text: the force
            palette does not reach 4.5:1 at 11 px. */}
        <span
          className="inline-flex items-center rounded-full font-bold"
          style={{ fontSize: 11, padding: '1px 7px', backgroundColor: S.surface, color: S.onSurface, border: `1px solid ${S.cardBorderStrong}`, ...FIGURES }}
        >
          {code}
        </span>
        {live && (
          <span style={{ fontSize: 12, fontWeight: 700, color: S.onSurface, fontFamily: HEADLINE_FONT, lineHeight: 1.3, flex: 1, minWidth: 0 }}>{live.name}</span>
        )}
        <span
          className="inline-flex items-center gap-1.5 rounded-full font-bold"
          style={{ fontSize: 11, padding: '1px 7px', backgroundColor: `${c}14`, color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT, whiteSpace: 'nowrap', marginLeft: live ? undefined : 'auto' }}
        >
          <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: c, display: 'inline-block' }} />
          {force}
        </span>
      </div>
      {live ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
            <Chip kind={isExp ? 'expansion' : 'contraction'} compact />
            <span className="inline-flex items-center gap-1" style={{ fontSize: 11, color: isExp ? S.expansionInk : S.contractionInk, fontWeight: 600 }}>
              {isExp ? <TrendingUp size={11} strokeWidth={2.5} aria-hidden="true" /> : <TrendingDown size={11} strokeWidth={2.5} aria-hidden="true" />}
              {isExp ? 'tailwind for this moment' : 'headwind for this moment'}
            </span>
          </div>
          {live.description && (
            <p style={{ fontSize: 11.5, color: S.onSurfaceVariant, lineHeight: 1.5, margin: '9px 0 0' }}>
              {live.description}
            </p>
          )}
        </>
      ) : (
        <p style={{ fontSize: 11.5, color: S.mutedText, fontStyle: 'italic', lineHeight: 1.5, margin: '9px 0 0' }}>
          {driversLoaded
            ? 'The service holds no driver with this code.'
            : 'The drivers have not loaded yet: the name, direction and description follow.'}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 9, flexWrap: 'wrap' }}>
        <button type="button"
          onClick={() => onNavigateToDriver?.(live?.name ?? code)}
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
          <span style={{ fontSize: 11, color: S.mutedText, fontFamily: HEADLINE_FONT, fontWeight: 700 }} className="tabular-nums">
            driver has {sourceCount} source{sourceCount === 1 ? '' : 's'}
          </span>
        )}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════
// Stage context (always visible): the stage's entry of the contexts the API
// served with the journey; a stage without one shows no block
// ════════════════════════════════════════════════════════════════════════
export const StageContextBlock: FC<{ context: StageContext | undefined; stageLabel: string }> = ({
  context: ctx, stageLabel,
}) => {
  if (!ctx) return null;
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Henkel brands', value: ctx.henkelBrands },
    { label: 'Competitors', value: ctx.competitors },
    { label: 'Opportunity', value: ctx.opportunity },
  ];
  return (
    <DetailSection
      title={`Stage context: ${stageLabel}`}
      accent={S.primary}
      subtitle="Authored stage context, same provenance rules as the tile reads"
    >
      <div className="flex flex-col gap-2.5">
        {rows.map(r => (
          <div key={r.label}>
            <div className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT, marginBottom: 2 }}>
              {r.label}
            </div>
            <p style={{ fontSize: 12, color: S.onSurface, lineHeight: 1.55, margin: 0 }}>{r.value}</p>
          </div>
        ))}
      </div>
    </DetailSection>
  );
};
