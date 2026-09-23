/**
 * The body of the tile dialog: a top bar with the breadcrumb, the previous
 * and next tile and the close button; the tile's header with its provenance;
 * the why-chain; the Strategist Read and the stage context; and, for admins,
 * the editor.
 */
import type { CSSProperties, FC } from 'react';
import { TrendingUp, TrendingDown, X, Edit3, PenLine, ChevronLeft, ChevronRight } from 'lucide-react';
import type { JourneyKey } from '@/data/consumerJourney';
import type { Driver } from '@/types';
import { S, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';
import Chip from '@/components/dashboard/Chip';
import { displayTileName, GRADE_CHIP, type SelectedTile, type TileEdits, TYPE_STYLES } from './shared';
import { DetailSection, MarkdownBlock, StageContextBlock } from './tiles';
import { WhyChain } from './WhyChain';
import { TileEditor } from './TileEditor';

export const PanelBody: FC<{
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
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 18px', backgroundColor: S.headerGlass, backdropFilter: 'blur(8px)', borderBottom: `1px solid ${S.cardBorder}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: HEADLINE_FONT, fontWeight: 700, fontSize: 12, color: S.onSurfaceVariant, minWidth: 0 }}>
          <span style={{ whiteSpace: 'nowrap' }}>{journeyKey === 'lhc' ? 'Laundry' : 'Hair'}</span>
          <ChevronRight size={13} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          <span style={{ color: S.onBg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stageLabel}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10.5, color: S.mutedText, fontFamily: HEADLINE_FONT, fontWeight: 700, marginRight: 2 }}>Esc to close</span>
          <button type="button" onClick={onPrev} disabled={!canPrev} style={canPrev ? iconBtn : iconBtnOff} aria-label="Previous tile" title="Previous tile"><ChevronLeft size={16} strokeWidth={2.5} /></button>
          <button type="button" onClick={onNext} disabled={!canNext} style={canNext ? iconBtn : iconBtnOff} aria-label="Next tile" title="Next tile"><ChevronRight size={16} strokeWidth={2.5} /></button>
          <button type="button" onClick={onClose} style={iconBtn} aria-label="Close" title="Close"><X size={16} strokeWidth={2.5} /></button>
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
            <DetailSection
              title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><PenLine size={12} strokeWidth={2.5} /> Strategist Read</span>}
              accent={S.primaryDim}
              subtitle="Authored analysis, not simulated"
            >
              <div style={{ padding: '12px 14px', borderRadius: 10, backgroundColor: S.surfaceLow }}>
                {tile.analysis
                  ? <MarkdownBlock text={tile.analysis} />
                  : <p style={{ fontSize: 12.5, color: S.mutedText, fontStyle: 'italic', margin: 0 }}>No authored analysis for this tile yet.</p>}
              </div>
            </DetailSection>

            <StageContextBlock stageLabel={stageLabel} journeyKey={journeyKey} />

            {canEdit && !editing && (
              <button type="button"
                onClick={onEdit}
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-full text-sm font-bold uppercase tracking-[0.08em]"
                style={{ backgroundColor: S.primaryContainer, color: S.onPrimaryContainer, border: 'none', cursor: 'pointer', fontFamily: HEADLINE_FONT }}
              >
                <Edit3 size={13} strokeWidth={2.5} /> Edit tile
              </button>
            )}
            {canEdit && editing && (
              <DetailSection title="Edit tile" accent={S.primary}>
                <TileEditor
                  initial={tile}
                  onSave={onApplyEdits}
                  onCancel={onCancelEdit}
                  onRemove={onRemove}
                />
              </DetailSection>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
