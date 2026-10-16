/**
 * One row of the Drivers table: the collapsed cells for the current mode and,
 * when the row is open, the panel of that mode (the Driver List panel, Expert
 * Rating or Review & Endorse).
 *
 * The table is a CSS grid with ARIA table semantics (Drivers.tsx holds the
 * `table` and the header row). From the `xl` breakpoint the cells sit in the
 * mode's column template (`--row-grid`); below it the row is a card: the
 * identity and the direction on the first line, then the figures with their
 * own small labels. The expanded panel is a row of its own with one cell
 * across every column.
 */
import React, { useId, useState, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Store, Cpu, Landmark, Leaf, Swords, ChevronDown, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EXPANSION_SOFT, FORCE_COLORS, NO_VALUE, fmtPct, fmtShift, shiftColor } from '@/lib/format';
import { S, SHADOW, HEADLINE_FONT, FIGURES, BODY_FONT } from '@/lib/theme';
import { driverNames } from '@/lib/driverNames';
import Chip from '@/components/dashboard/Chip';
import type { Driver, DriverProposal, DriverUpdate, ForceName } from '@/types';
import { EXPERT_COLOR, REVIEWED_COLOR, isRated, type ScoringMode } from './shared';
import { ColorDots, DeltaChip } from './scales';
import { Dash, EditedChip } from './cards';
import { CopyLinkButton } from './CopyLink';
import { ExpertRatingPanel, type NextUnrated } from './ExpertRating';
import { ReviewPanel } from './ReviewEndorse';
import { DriverPanel } from './DriverPanel';

// A force's icon and its tonal tile (editorial palette)
const FORCE_TILE: Record<ForceName, { Icon: LucideIcon; bg: string; fg: string }> = {
  Consumer:      { Icon: Users,    bg: S.primaryContainer,   fg: S.primary },
  Customer:      { Icon: Store,    bg: S.secondaryContainer, fg: S.onSecondaryContainer },
  Technology:    { Icon: Cpu,      bg: S.tertiaryContainer,  fg: S.onTertiaryContainer },
  Government:    { Icon: Landmark, bg: S.surfaceHighest,     fg: S.onSurface },
  Environmental: { Icon: Leaf,     bg: S.surfaceHigh,        fg: S.primary },
  Competitive:   { Icon: Swords,   bg: S.surfaceContainer,   fg: S.primaryDim },
};

// Column templates per mode, from the xl breakpoint. The header and the rows
// read the same template, so the columns align. Driver is the one flexible
// column (min-width 0): the short name and its code over the long name, each
// wrapping to two lines at most while collapsed; Probability fits the five
// dots and widens in Review for the expert mean and its delta. The last
// column is the Edited chip (list), the expert's own review status (rating)
// or the number of proposals (review).
export const ROW_GRID: Record<ScoringMode, string> = {
  list:   'minmax(0, 1fr) 130px 128px 170px 100px 110px',
  rating: 'minmax(0, 1fr) 130px 128px 170px 100px 130px',
  review: 'minmax(0, 1fr) 130px 180px 170px 100px 110px',
};

/** The label over the last column, per mode. */
export const LAST_COLUMN_LABEL: Record<ScoringMode, string> = {
  list: 'Edited', rating: 'Your rating', review: 'Proposals',
};

/** The row's six cells in the card layout, below xl: a grid of auto-fit columns. */
const CARD_FIGURES = 'grid-cols-[repeat(auto-fit,minmax(140px,1fr))]';

/** A driver's display code as a small monospace chip. */
export const CodeChip: FC<{ code: string; size?: 'row' | 'panel' }> = ({ code, size = 'row' }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', flexShrink: 0,
    padding: size === 'row' ? '1px 6px' : '2px 8px', borderRadius: 6,
    ...FIGURES, fontSize: size === 'row' ? 11 : 12, fontWeight: 700, letterSpacing: '0.02em',
    backgroundColor: S.surfaceContainer, color: S.onSurfaceVariant, lineHeight: 1.5,
  }}>
    {code}
  </span>
);

/** The small uppercase label over a figure in the card layout (below xl). */
const CardLabel: FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="xl:hidden block text-[11px] font-bold uppercase tracking-[0.12em] mb-1"
    style={{ color: S.onSurfaceVariant }}>
    {children}
  </span>
);

/** The figure under its label in the card layout: one height for dots, numbers
 *  and chips, so the four figures sit on one line. From xl the wrapper is gone
 *  and the figure is the cell's content. */
const CardValue: FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center min-h-7 xl:contents">{children}</div>
);

// ── Collapsed-row cells: read-only in every mode; scoring and editing
//    happen in the expanded panel ──
const ProbCell: FC<{ driver: Driver; mode: ScoringMode; myProposal?: DriverProposal }> = ({ driver, mode, myProposal }) => {
  const base = driver.baseline.probability;
  if (mode === 'list') {
    const edited = driver.scores_edited && driver.probability !== base;
    return (
      <ColorDots value={driver.probability} color={edited ? REVIEWED_COLOR : S.primary}
        title={`Baseline ${base} / 5${edited ? ` · edited to ${driver.probability} / 5` : ''}`} />
    );
  }
  if (mode === 'rating') {
    const my = myProposal?.probability ?? driver.proposal_summary.my?.probability;
    return (
      <ColorDots value={my != null ? Math.round(my) : 0} color={S.primary} muted={my == null}
        title={`Baseline ${base} / 5 · open the driver to score`} />
    );
  }
  const agg = driver.proposal_summary.probability;
  if (!agg) return <Dash />;
  // The delta of what an endorsement would write: the mean rounded to a score.
  const delta = Math.round(agg.avg) - base;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <ColorDots value={Math.round(agg.avg)} color={EXPERT_COLOR} title={`Expert mean ${agg.avg.toFixed(1)} / 5 · ${agg.count} scored`} />
      <span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 12, color: EXPERT_COLOR }}>{agg.avg.toFixed(1)}</span>
      <DeltaChip value={delta} digits={0} />
    </div>
  );
};

const Gp1Cell: FC<{ driver: Driver; mode: ScoringMode; myProposal?: DriverProposal }> = ({ driver, mode, myProposal }) => {
  const base = driver.baseline.gp1_pct_affected;
  const big: React.CSSProperties = { fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: '1.15rem' };
  if (mode === 'list') {
    const cur = driver.gp1_pct_affected;
    const edited = driver.scores_edited && Math.round(cur * 100) !== Math.round(base * 100);
    return (
      <span style={{ ...big, color: edited ? REVIEWED_COLOR : S.onSurface }}
        title={`Baseline ${fmtPct(base, 0)}${edited ? ` · edited to ${fmtPct(cur, 0)}` : ''}`}>
        {fmtPct(cur)}
      </span>
    );
  }
  if (mode === 'rating') {
    const my = myProposal?.gp1_pct_affected ?? driver.proposal_summary.my?.gp1_pct_affected;
    return (
      <span style={{ ...big, color: my != null ? S.onSurface : S.onSurfaceVariant }}
        title={`Baseline ${fmtPct(base, 0)} · open the driver to score`}>
        {fmtPct(my, 0)}
      </span>
    );
  }
  const agg = driver.proposal_summary.gp1_pct_affected;
  if (!agg) return <Dash />;
  const delta = (agg.avg - base) * 100;
  return (
    <div className="flex items-center gap-2 xl:justify-end">
      <span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: '1.05rem', color: EXPERT_COLOR }}
        title={`Expert mean ${fmtPct(agg.avg, 0)} · ${agg.count} scored`}>{fmtPct(agg.avg, 0)}</span>
      <DeltaChip value={delta} unit="pp" digits={0} />
    </div>
  );
};

const ExpectedEffectCell: FC<{ driver: Driver; mode: ScoringMode; myProposal?: DriverProposal }> = ({ driver, mode, myProposal }) => {
  const [tip, setTip] = useState(false);
  const dirSign = driver.direction === 'Contraction' ? -1 : 1;

  // Expert Rating: the expert's own expected effect, from their own probability and GP1 %.
  if (mode === 'rating') {
    const my = myProposal ?? driver.proposal_summary.my;
    const p = my?.probability;
    const g = my?.gp1_pct_affected;
    if (p == null || g == null) {
      return <span style={{ color: S.onSurfaceVariant, fontSize: 13, fontWeight: 700 }}>{NO_VALUE}</span>;
    }
    const myEffect = dirSign * (p / 6) * g;
    return (
      <span className="font-bold text-[14px]"
        title={`Your expected effect = (your prob / 6) × your GP1% × direction = (${Math.round(p)}/6) × ${fmtPct(g, 0)} × ${dirSign > 0 ? '+1' : '-1'}`}
        style={{ color: shiftColor(myEffect) }}>
        {fmtShift(myEffect)}
      </span>
    );
  }

  // Driver List and Review: the driver's expected effect, with the arithmetic on hover.
  const effect = driver.expected_effect;
  return (
    <div className="xl:text-right" style={{ position: 'relative' }}
      onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)}>
      <span className="font-bold text-[14px]" style={{
        color: shiftColor(effect),
        borderBottom: `1px dotted ${S.onSurfaceVariant}66`, cursor: 'help',
      }}>
        {fmtShift(effect)}
      </span>
      {tip && (
        <div role="tooltip" onClick={(e) => e.stopPropagation()} style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 40, minWidth: 240, maxWidth: 320,
          padding: '10px 12px', borderRadius: 8, backgroundColor: S.onSurface, color: S.surface,
          ...FIGURES, fontSize: 11, lineHeight: 1.5, textAlign: 'left',
          boxShadow: SHADOW.tip, pointerEvents: 'none',
        }}>
          Expected effect = (prob/6) × GP1% × direction
          <br />= ({driver.probability}/6) × {(driver.gp1_pct_affected * 100).toFixed(1)}% × {dirSign > 0 ? '+1' : '-1'} = {fmtShift(effect)}
          <br /><span style={{ fontFamily: BODY_FONT }}>Before the force weight, the overlap correction, the timing and the
          exposures: the Shift Matrix carries a small fraction of it.</span>
        </div>
      )}
    </div>
  );
};

// ── Last column: the Edited chip (list), the expert's own rating status
//    (rating), the number of experts who scored the driver (review) ──
const ReviewStatusCell: FC<{ driver: Driver; mode: ScoringMode; myProposal?: DriverProposal }> = ({ driver, mode, myProposal }) => {
  const pill: React.CSSProperties = {
    fontFamily: HEADLINE_FONT, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
    textTransform: 'uppercase', padding: '4px 11px', borderRadius: 999,
  };
  if (mode === 'rating') {
    const done = isRated(myProposal ?? driver.proposal_summary.my);
    return (
      <div className="flex xl:justify-end">
        <span className="inline-flex items-center gap-1.5"
          title={done
            ? 'Rated: you scored the probability, the GP1% and at least one category exposure'
            : 'To complete: score the probability, the GP1% and at least one category exposure'}
          style={{ ...pill, backgroundColor: done ? EXPANSION_SOFT : S.surfaceLow, color: done ? REVIEWED_COLOR : S.onSurfaceVariant }}>
          {done ? <><Check size={11} strokeWidth={2.6} /> Rated</> : 'Not rated'}
        </span>
      </div>
    );
  }
  if (mode === 'review') {
    const count = driver.proposal_summary.count;
    return (
      <div className="flex xl:justify-end">
        <span style={{ ...pill, backgroundColor: count > 0 ? S.expertSoft : S.surfaceLow, color: count > 0 ? EXPERT_COLOR : S.onSurfaceVariant }}>
          {count > 0 ? `${count} ${count === 1 ? 'expert' : 'experts'}` : NO_VALUE}
        </span>
      </div>
    );
  }
  // List: a driver an admin has edited carries the Edited chip; the others stay blank.
  return (
    <div className="flex xl:justify-end">
      <EditedChip driver={driver} />
    </div>
  );
};

// ─── Driver row ────────────────────────────────────────────────────
interface DriverRowProps {
  driver: Driver;
  isLast: boolean;
  expanded: boolean;
  onToggle: () => void;
  mode: ScoringMode;
  myProposal?: DriverProposal;
  onMyChange: (driverId: string, my: DriverProposal) => void;
  isAdmin: boolean;
  updateDriver: (driverId: string, update: DriverUpdate) => Promise<void>;
  /** Told whether the admin editor of this row holds unsaved edits. */
  onDirtyChange: (driverId: string, dirty: boolean) => void;
  /** In Expert Rating, the next unrated driver in the list's order, or why there is none. */
  nextUnrated?: NextUnrated;
  /** Called once this row's panel has finished collapsing, when the rows below have moved up. */
  onPanelExit?: () => void;
  /** Opens another driver by its code (a code cited in the boundary sentence). */
  onOpenCode?: (code: string) => void;
}

export const DriverRow: FC<DriverRowProps> = ({
  driver, isLast, expanded, onToggle, mode, myProposal, onMyChange, isAdmin, updateDriver, onDirtyChange, nextUnrated,
  onPanelExit, onOpenCode,
}) => {
  const tile = FORCE_TILE[driver.force];
  const { Icon } = tile;
  const names = driverNames(driver);
  const code = names.code;
  const panelId = useId();
  const rowStyle = { '--row-grid': ROW_GRID[mode] } as React.CSSProperties;

  // The list's last column carries the Edited chip, which most drivers do not
  // have; the card layout leaves the empty slot out rather than show a label
  // over nothing. From xl the cell stays, so the columns keep their template.
  const lastCellEmpty = mode === 'list' && !driver.scores_edited;

  return (
    <div role="presentation" id={`driver-row-${driver.id}`}
      // The line between rows: a visible one between the tall cards below xl,
      // the faint one between the dense table rows from xl; none after the last.
      className={isLast && !expanded ? '' : 'border-b border-theme-card-border xl:border-theme-surface-low'}>
      {/* The whole row toggles the panel on click; the name is the button
          that does it for the keyboard and the screen reader. */}
      <div
        role="row"
        onClick={onToggle}
        className="grid items-center gap-x-3 gap-y-3 px-4 md:px-8 py-4 xl:py-2 text-left transition-colors grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] xl:[grid-template-columns:var(--row-grid)]"
        style={{
          ...rowStyle,
          backgroundColor: expanded ? S.surfaceLow : S.surface,
          cursor: 'pointer',
        }}
      >
        {/* Driver identity: the force tile, the code, the name, the force */}
        <div role="cell" className="flex items-start gap-3 min-w-0">
          <div
            className="w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center mt-0.5"
            style={{ backgroundColor: tile.bg, color: tile.fg }}
          >
            <Icon size={16} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            {/* On a phone the button wraps: the code and the chevron on the
                first line, the short name on its own lines below, so a short
                line is not shared with the chip; from sm the code follows the
                short name. */}
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={expanded ? panelId : undefined}
              className="flex flex-wrap sm:flex-nowrap items-start gap-2 min-w-0 w-full text-left font-bold text-[15px]"
              style={{
                fontFamily: HEADLINE_FONT, color: S.onSurface, background: 'transparent',
                border: 'none', padding: 0, cursor: 'pointer', lineHeight: 1.3,
              }}
            >
              {/* The short name people quote, then the code. While collapsed,
                  two lines at most (three on a phone, where it has its own
                  lines under the code); hovering the name shows the descriptor. */}
              <span className={`min-w-0 basis-full order-3 sm:basis-auto sm:order-none ${expanded ? '' : 'line-clamp-3 sm:line-clamp-2'}`}
                title={names.descriptor || names.shortName}>{names.shortName}</span>
              {code && <span className="mt-[2px] inline-flex shrink-0"><CodeChip code={code} /></span>}
              <ChevronDown
                size={14}
                aria-hidden
                className="ml-auto sm:ml-0"
                style={{
                  flexShrink: 0, marginTop: 3,
                  color: S.onSurfaceVariant,
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 180ms ease',
                }}
              />
            </button>
            {/* The long name: the line that explains the short name. */}
            {names.longName && (
              <div className={expanded ? 'mt-0.5' : 'mt-0.5 line-clamp-2'} title={names.longName}
                style={{ fontFamily: BODY_FONT, fontSize: 13, lineHeight: 1.4, color: S.onSurfaceVariant }}>
                {names.longName}
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-1" style={{ fontSize: 11, fontWeight: 600, color: S.onSurfaceVariant }}>
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, flexShrink: 0, backgroundColor: FORCE_COLORS[driver.force] }} />
              {driver.force}
            </div>
          </div>
        </div>

        {/* Direction */}
        <div role="cell" className="justify-self-start sm:justify-self-end xl:justify-self-start">
          <Chip kind={driver.direction === 'Expansion' ? 'expansion' : 'contraction'} compact />
        </div>

        {/* The figures: four cells of the row grid from xl, a labelled grid of
            their own below it. */}
        <div role="presentation" className={`col-span-1 sm:col-span-2 grid gap-3 ${CARD_FIGURES} xl:contents`}>
          <div role="cell">
            <CardLabel>Probability</CardLabel>
            <CardValue><ProbCell driver={driver} mode={mode} myProposal={myProposal} /></CardValue>
          </div>
          <div role="cell" className="xl:text-right">
            <CardLabel>GP1 % affected</CardLabel>
            <CardValue><Gp1Cell driver={driver} mode={mode} myProposal={myProposal} /></CardValue>
          </div>
          <div role="cell" className="xl:text-right">
            <CardLabel>Expected effect</CardLabel>
            <CardValue><ExpectedEffectCell driver={driver} mode={mode} myProposal={myProposal} /></CardValue>
          </div>
          <div role="cell" className={lastCellEmpty ? 'hidden xl:block xl:text-right' : 'xl:text-right'}>
            <CardLabel>{LAST_COLUMN_LABEL[mode]}</CardLabel>
            <CardValue><ReviewStatusCell driver={driver} mode={mode} myProposal={myProposal} /></CardValue>
          </div>
        </div>
      </div>

      {/* Expanded panel: your proposal (Expert Rating), the review (Review &
          Endorse) or the driver's detail and editor (Driver List). Clipped
          rather than hidden, so a sticky bar inside can stick to the viewport. */}
      <AnimatePresence initial={false} onExitComplete={onPanelExit}>
        {expanded && (
          <motion.div
            key="panel"
            role="row"
            id={panelId}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'clip', backgroundColor: S.surfaceLow }}
          >
            <div role="cell" aria-colspan={6}>
              {/* The panel's head: the code and the link to this driver */}
              <div className="flex items-center gap-3 flex-wrap px-4 md:px-8 py-2.5"
                style={{ backgroundColor: S.surface, borderTop: `1px solid ${S.cardBorder}` }}
                onClick={(e) => e.stopPropagation()}>
                {code && <CodeChip code={code} size="panel" />}
                <span style={{ fontSize: 11, color: S.mutedText }}>{code ? 'Driver code' : 'No code in the current base'}</span>
                <span className="ml-auto"><CopyLinkButton /></span>
              </div>
              {mode === 'rating' ? (
                <ExpertRatingPanel driver={driver} onMyChange={onMyChange} nextUnrated={nextUnrated} onOpenCode={onOpenCode} />
              ) : mode === 'review' ? (
                <ReviewPanel driver={driver} updateDriver={updateDriver} onOpenCode={onOpenCode} />
              ) : (
                <DriverPanel driver={driver} isAdmin={isAdmin} updateDriver={updateDriver} onDirtyChange={onDirtyChange}
                  onOpenCode={onOpenCode} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
