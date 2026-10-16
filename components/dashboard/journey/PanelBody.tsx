/**
 * The body of the tile dialog: a top bar with the breadcrumb, the previous
 * and next tile and the close button; the tile's header with its provenance;
 * the why-chain; the Strategist Read and the stage context; and, for admins,
 * the editor. While the editor holds a draft that differs from the tile, a
 * close asks first; the question sits under the top bar, where it stays in
 * view however far the body is scrolled.
 */
import { useEffect, useRef, useSyncExternalStore, type CSSProperties, type FC } from 'react';
import { TrendingUp, TrendingDown, X, Edit3, PenLine, ChevronLeft, ChevronRight } from 'lucide-react';
import type { JourneyKey } from '@/data/consumerJourney';
import type { Driver } from '@/types';
import { S, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';
import Chip from '@/components/dashboard/Chip';
import {
  displayTileName, formatMonth, GRADE_CHIP, INTENSITY_LABELS, type SelectedTile, type TileEdits, tileNameSubtitle,
  TYPE_STYLES,
} from './shared';
import { DetailSection, MarkdownBlock, StageContextBlock } from './tiles';
import { WhyChain } from './WhyChain';
import { TileEditor } from './TileEditor';

/** A question the dialog asks before it drops or removes something. */
export interface PanelQuestion {
  question: string;
  /** The button that goes ahead. */
  confirmLabel: string;
  /** The button that keeps things as they are. */
  keepLabel: string;
  onConfirm: () => void;
  onKeep: () => void;
}

// The keyboard hint is for keyboard users: it appears once a key has been
// pressed anywhere on the page, and stays for the rest of the session. The
// board starts the watch when it mounts, so the key that opens the first tile
// counts too.
let keyboardUsed = false;
let keyboardWatched = false;
const keyboardSubscribers = new Set<() => void>();
export function watchKeyboard(): void {
  if (keyboardWatched || typeof window === 'undefined') return;
  keyboardWatched = true;
  window.addEventListener('keydown', () => {
    if (keyboardUsed) return;
    keyboardUsed = true;
    keyboardSubscribers.forEach((notify) => notify());
  }, true);
}
const subscribeKeyboard = (notify: () => void) => {
  watchKeyboard();
  keyboardSubscribers.add(notify);
  return () => { keyboardSubscribers.delete(notify); };
};
const useKeyboardSeen = (): boolean =>
  useSyncExternalStore(subscribeKeyboard, () => keyboardUsed, () => false);

export const PanelBody: FC<{
  selected: SelectedTile;
  journeyKey: JourneyKey;
  driversById: Map<string, Driver>;
  driversLoaded: boolean;
  canEdit: boolean;
  editing: boolean;
  position: { index: number; total: number } | null;
  question: PanelQuestion | null;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onApplyEdits: (edits: TileEdits) => void;
  onRemove: () => void;
  onDraftDirty: (dirty: boolean) => void;
  onNavigateToDriver?: (query: string) => void;
}> = ({
  selected, journeyKey, driversById, driversLoaded,
  canEdit, editing, position, question, onPrev, onNext, onClose, onEdit, onCancelEdit, onApplyEdits, onRemove,
  onDraftDirty, onNavigateToDriver,
}) => {
  const { tile, stageId, stageLabel, side } = selected;
  const isExp = side === 'benefiting';
  const ts = TYPE_STYLES[tile.type];
  const canPrev = !!position && position.index > 0;
  const canNext = !!position && position.index < position.total - 1;
  const subtitle = tileNameSubtitle(tile.name);
  const keyboardSeen = useKeyboardSeen();

  const iconBtn: CSSProperties = {
    width: 34, height: 34, borderRadius: 999, border: 'none', backgroundColor: S.surfaceLow,
    color: S.onSurfaceVariant, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  };
  const iconBtnOff: CSSProperties = { ...iconBtn, opacity: 0.4, cursor: 'default' };
  const chipLike: CSSProperties = {
    fontSize: 11, padding: '2px 9px', fontFamily: HEADLINE_FONT, lineHeight: 1.5,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, width: '100%', fontFamily: BODY_FONT }}>
      {/* ── Sticky top bar: breadcrumb, neighbour navigation, close ── */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 18px', backgroundColor: S.headerGlass, backdropFilter: 'blur(8px)', borderBottom: `1px solid ${S.cardBorder}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: HEADLINE_FONT, fontWeight: 700, fontSize: 12, color: S.onSurfaceVariant, minWidth: 0 }}>
          <span style={{ whiteSpace: 'nowrap' }}>{journeyKey === 'lhc' ? 'Laundry' : 'Hair'}</span>
          <ChevronRight size={13} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          <span style={{ color: S.onBg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stageLabel}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }} data-print-hide>
          {keyboardSeen && (
            <span className="hidden sm:inline" style={{ fontSize: 11, color: S.mutedText, fontFamily: HEADLINE_FONT, fontWeight: 700, marginRight: 2 }}>
              Esc to close, left and right arrows for the next tile
            </span>
          )}
          <button type="button" onClick={onPrev} disabled={!canPrev} style={canPrev ? iconBtn : iconBtnOff} aria-label="Previous tile" title="Previous tile" data-print-hide><ChevronLeft size={16} strokeWidth={2.5} /></button>
          <button type="button" onClick={onNext} disabled={!canNext} style={canNext ? iconBtn : iconBtnOff} aria-label="Next tile" title="Next tile" data-print-hide><ChevronRight size={16} strokeWidth={2.5} /></button>
          <button type="button" onClick={onClose} style={iconBtn} aria-label="Close" title="Close" data-print-hide><X size={16} strokeWidth={2.5} /></button>
        </div>
      </div>

      {question && <QuestionStrip question={question} />}

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
          {subtitle && (
            <p style={{ fontSize: 15, fontWeight: 600, color: S.onSurfaceVariant, lineHeight: 1.4, margin: '4px 0 0', fontFamily: HEADLINE_FONT }}>
              {subtitle}
            </p>
          )}
          {tile.driverNote && (
            <p style={{ fontSize: 14.5, color: S.onSurfaceVariant, lineHeight: 1.55, margin: '9px 0 0', maxWidth: '52rem' }}>{tile.driverNote}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 13 }}>
            <Chip
              kind={GRADE_CHIP[tile.provenance.grade].kind}
              label={`Grade: ${GRADE_CHIP[tile.provenance.grade].label}`}
              title={`Evidence grade: ${tile.provenance.grade}`}
            />
            <Chip
              kind="authored"
              label={`Strategist-authored · ${formatMonth(tile.provenance.date)}`}
              title={`Strategist-authored, last revised ${formatMonth(tile.provenance.date)}`}
            />
            <span className="inline-flex items-center rounded-full font-bold" style={{ ...chipLike, backgroundColor: ts.bg, color: ts.fg }}>{ts.label}</span>
            <span className="inline-flex items-center rounded-full font-bold" style={{ ...chipLike, backgroundColor: S.surfaceLow, color: S.onSurfaceVariant }}>
              Intensity: {INTENSITY_LABELS[tile.intensity]} ({tile.intensity} of 3)
            </span>
          </div>
          <p style={{ fontSize: 11.5, color: S.mutedText, lineHeight: 1.5, margin: '8px 0 0', maxWidth: '52rem' }}>
            Grade: how well the tile is evidenced. Intensity: how hard it hits this moment. Impact: the authored
            size of the pool at stake.
          </p>
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

            <StageContextBlock stageId={stageId} stageLabel={stageLabel} journeyKey={journeyKey} />

            {canEdit && !editing && (
              <button type="button"
                onClick={onEdit}
                data-print-hide
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-full text-sm font-bold uppercase tracking-[0.08em]"
                style={{ backgroundColor: S.primaryContainer, color: S.onPrimaryContainer, border: 'none', cursor: 'pointer', fontFamily: HEADLINE_FONT }}
              >
                <Edit3 size={13} strokeWidth={2.5} /> Edit tile
              </button>
            )}
            {canEdit && editing && (
              <div data-print-hide>
                <DetailSection title="Edit tile" accent={S.primary}>
                  <TileEditor
                    initial={tile}
                    onSave={onApplyEdits}
                    onCancel={onCancelEdit}
                    onRemove={onRemove}
                    onDirtyChange={onDraftDirty}
                  />
                </DetailSection>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/** The question under the top bar; focus lands on the button that keeps things as they are. */
const QuestionStrip: FC<{ question: PanelQuestion }> = ({ question }) => {
  const keepRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { keepRef.current?.focus(); }, []);
  const btn: CSSProperties = {
    padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
    fontFamily: HEADLINE_FONT, fontWeight: 700, fontSize: 12.5, minHeight: 32,
  };
  return (
    <div
      role="alertdialog"
      aria-label={question.question}
      data-print-hide
      style={{
        flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        padding: '10px 18px', backgroundColor: S.amberContainer, color: S.onAmberContainer,
        borderBottom: `1px solid ${S.cardBorder}`,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{question.question}</span>
      <span style={{ display: 'inline-flex', gap: 8 }}>
        <button type="button" ref={keepRef} onClick={question.onKeep}
          style={{ ...btn, backgroundColor: S.surface, color: S.onSurface }}>
          {question.keepLabel}
        </button>
        <button type="button" onClick={question.onConfirm}
          style={{ ...btn, backgroundColor: S.error, color: S.onPrimary }}>
          {question.confirmLabel}
        </button>
      </span>
    </div>
  );
};
