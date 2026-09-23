/**
 * The journey board's small parts: the journey switch and type filter, a
 * stage's roll-up, a tile in the stage rail, the sections of the tile dialog,
 * the text of a Strategist Read, a cited driver's card and the stage context.
 */
import type { FC, ReactNode } from 'react';
import { TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import { LHC_CTX, HAIR_CTX, type JourneyKey, type JourneyTile, type TileType } from '@/data/consumerJourney';
import { S, SHADOW, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';
import {
  type CitedDriver, displayTileName, forceColor, gradeBarOpacity, gradeTint, type Side,
  TYPE_STYLES, unescapeBreaks,
} from './shared';

/** Renders a Strategist Read: **bold** spans and blank-line paragraph breaks. */
export const MarkdownBlock: FC<{ text: string }> = ({ text }) => {
  // Paragraphs are separated by a blank line (unescapeBreaks covers a text
  // saved with escaped ones).
  const paragraphs = unescapeBreaks(text).split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
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

export const TypeChip: FC<{ typeKey: TileType; active: boolean; onClick: () => void }> = ({ typeKey, active, onClick }) => {
  const st = TYPE_STYLES[typeKey];
  return (
    <button type="button"
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
export const StageRollup: FC<{ benefiting: JourneyTile[]; negativelyImpacted: JourneyTile[] }> = ({ benefiting, negativelyImpacted }) => {
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

/** A tile in the rail: the pool-impact grade sets its tint depth and the opacity of its accent bar. */
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
export const DriverForceCard: FC<{
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
          style={{ fontSize: 10, padding: '1px 7px', backgroundColor: c, color: S.onPrimary, fontFamily: HEADLINE_FONT }}
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
        <button type="button"
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
export const StageContextBlock: FC<{ stageLabel: string; journeyKey: JourneyKey }> = ({ stageLabel, journeyKey }) => {
  const ctx = (journeyKey === 'lhc' ? LHC_CTX : HAIR_CTX)[stageLabel];
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
            <div className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT, marginBottom: 2 }}>
              {r.label}
            </div>
            <p style={{ fontSize: 12, color: S.onSurface, lineHeight: 1.55, margin: 0 }}>{r.value}</p>
          </div>
        ))}
      </div>
    </DetailSection>
  );
};
