/**
 * One row of the Drivers table: the collapsed cells for the current mode and,
 * when the row is open, the panel of that mode (the Driver List panel, Expert
 * Rating or Review & Endorse).
 */
import React, { useState, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Store, Cpu, Landmark, Leaf, Swords, ChevronDown, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EXPANSION_SOFT, NO_VALUE, fmtPct, fmtShift, shiftColor } from '@/lib/format';
import { S, SHADOW, HEADLINE_FONT, MONO_FONT, BODY_FONT } from '@/lib/theme';
import Chip from '@/components/dashboard/Chip';
import type { Driver, DriverProposal, DriverUpdate, ForceName } from '@/types';
import { EXPERT_COLOR, REVIEWED_COLOR, type ScoringMode } from './shared';
import { ColorDots, DeltaChip } from './scales';
import { Dash, EditedChip } from './cards';
import { ExpertInputPanel } from './ExpertRating';
import { ReviewPanel } from './ReviewEndorse';
import { ExpandedPanel } from './DriverPanel';

// A force's icon and its tonal tile (editorial palette)
const FORCE_TILE: Record<ForceName, { Icon: LucideIcon; bg: string; fg: string }> = {
  Consumer:      { Icon: Users,    bg: S.primaryContainer,   fg: S.primary },
  Customer:      { Icon: Store,    bg: S.secondaryContainer, fg: S.onSecondaryContainer },
  Technology:    { Icon: Cpu,      bg: S.tertiaryContainer,  fg: S.onTertiaryContainer },
  Government:    { Icon: Landmark, bg: S.surfaceHighest,     fg: S.onSurface },
  Environmental: { Icon: Leaf,     bg: S.surfaceHigh,        fg: S.primary },
  Competitive:   { Icon: Swords,   bg: S.surfaceContainer,   fg: S.primaryDim },
};

// Column templates per mode. The header and the rows read the same template,
// so the columns align. Driver is the one flexible column (min-width 0; the
// name truncates and shows in full on hover); Probability fits the five dots
// and widens in Review for the expert mean and its delta. The last column is
// the Edited chip (list), the expert's own review status (rating) or the
// number of proposals (review).
export const ROW_GRID: Record<ScoringMode, string> = {
  list:   'minmax(0, 1fr) 130px 128px 170px 100px 110px',
  rating: 'minmax(0, 1fr) 130px 128px 170px 100px 130px',
  review: 'minmax(0, 1fr) 130px 180px 170px 100px 110px',
};

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
  const delta = agg.avg - base;
  return (
    <div className="flex items-center gap-2">
      <ColorDots value={Math.round(agg.avg)} color={EXPERT_COLOR} title={`Expert average ${agg.avg.toFixed(1)} / 5 · ${agg.count} scored`} />
      <span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 12, color: EXPERT_COLOR }}>{agg.avg.toFixed(1)}</span>
      <DeltaChip value={delta} />
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
      <span style={{ ...big, color: edited ? REVIEWED_COLOR : S.onSurface, cursor: 'help' }}
        title={`Baseline ${fmtPct(base, 0)}${edited ? ` · edited to ${fmtPct(cur, 0)}` : ''}`}>
        {fmtPct(cur)}
      </span>
    );
  }
  if (mode === 'rating') {
    const my = myProposal?.gp1_pct_affected ?? driver.proposal_summary.my?.gp1_pct_affected;
    return (
      <span style={{ ...big, color: my != null ? S.onSurface : S.onSurfaceVariant, cursor: 'help' }}
        title={`Baseline ${fmtPct(base, 0)} · open the driver to score`}>
        {fmtPct(my, 0)}
      </span>
    );
  }
  const agg = driver.proposal_summary.gp1_pct_affected;
  if (!agg) return <Dash />;
  const delta = (agg.avg - base) * 100;
  return (
    <div className="flex items-center gap-2 justify-end">
      <span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: '1.05rem', color: EXPERT_COLOR }}
        title={`Expert average ${fmtPct(agg.avg, 0)} · ${agg.count} scored`}>{fmtPct(agg.avg, 0)}</span>
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
        title={`Your expected effect = (your prob / 6) × your GP1% × direction = (${Math.round(p)}/6) × ${fmtPct(g, 0)} × ${dirSign > 0 ? '+1' : '−1'}`}
        style={{ color: shiftColor(myEffect), cursor: 'help' }}>
        {fmtShift(myEffect)}
      </span>
    );
  }

  // Driver List and Review: the driver's expected effect, with the arithmetic on hover.
  const effect = driver.expected_effect;
  return (
    <div className="text-right" style={{ position: 'relative' }}
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
          fontFamily: MONO_FONT, fontSize: 11, lineHeight: 1.5, textAlign: 'left',
          boxShadow: SHADOW.tip, pointerEvents: 'none',
        }}>
          Expected effect = (prob/6) × GP1% × direction
          <br />= ({driver.probability}/6) × {(driver.gp1_pct_affected * 100).toFixed(1)}% × {dirSign > 0 ? '+1' : '−1'} = {fmtShift(effect)}
          <br /><span style={{ fontFamily: BODY_FONT }}>Before the force weight, the overlap correction, the timing and the
          exposures: the Shift Matrix carries a small fraction of it.</span>
        </div>
      )}
    </div>
  );
};

// ── Last column: the Edited chip (list), the expert's own review status
//    (rating), the number of experts who scored the driver (review) ──
const ReviewStatusCell: FC<{ driver: Driver; mode: ScoringMode; myProposal?: DriverProposal }> = ({ driver, mode, myProposal }) => {
  const pill: React.CSSProperties = {
    fontFamily: HEADLINE_FONT, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
    textTransform: 'uppercase', padding: '4px 11px', borderRadius: 999,
  };
  if (mode === 'rating') {
    const my = myProposal ?? driver.proposal_summary.my;
    const hasProb = my?.probability != null;
    const hasGp1 = my?.gp1_pct_affected != null;
    const hasCat = !!my?.category_exposure && Object.keys(my.category_exposure).length > 0;
    const done = hasProb && hasGp1 && hasCat;
    return (
      <div className="flex justify-end">
        <span className="inline-flex items-center gap-1.5"
          title={done
            ? 'Reviewed: you rated probability, GP1% and at least one category exposure'
            : 'To complete: rate probability, GP1% and at least one category exposure'}
          style={{ ...pill, backgroundColor: done ? EXPANSION_SOFT : S.surfaceLow, color: done ? REVIEWED_COLOR : S.onSurfaceVariant }}>
          {done ? <><Check size={11} strokeWidth={2.6} /> Reviewed</> : 'Not reviewed'}
        </span>
      </div>
    );
  }
  if (mode === 'review') {
    const count = driver.proposal_summary.count;
    return (
      <div className="flex justify-end">
        <span style={{ ...pill, backgroundColor: count > 0 ? S.expertSoft : S.surfaceLow, color: count > 0 ? EXPERT_COLOR : S.onSurfaceVariant }}>
          {count > 0 ? `◆ ${count}` : NO_VALUE}
        </span>
      </div>
    );
  }
  // List: a driver an admin has edited carries the Edited chip; the others stay blank.
  return (
    <div className="flex justify-end">
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
}

export const DriverRow: FC<DriverRowProps> = ({
  driver, isLast, expanded, onToggle, mode, myProposal, onMyChange, isAdmin, updateDriver,
}) => {
  const tile = FORCE_TILE[driver.force];
  const { Icon } = tile;

  return (
    <div style={{ boxShadow: isLast && !expanded ? 'none' : `inset 0 -1px 0 ${S.surfaceLow}` }}>
      {/* The row toggles the expanded panel. It is a div with role=button
          rather than a <button> because it lays out block content in a
          grid, which a button may not contain. */}
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
          gridTemplateColumns: ROW_GRID[mode],
          backgroundColor: expanded ? S.surfaceLow : S.surface,
          cursor: 'pointer',
          border: 'none',
        }}
      >
        {/* Driver identity */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: tile.bg, color: tile.fg }}
          >
            <Icon size={16} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="font-bold text-[15px] flex items-center gap-2 min-w-0"
              style={{ fontFamily: HEADLINE_FONT, color: S.onSurface }}
            >
              {/* The ellipsis sits on the name span (truncate on a flex
                  container never ellipsizes); the title shows the full name. */}
              <span className="truncate" title={driver.name}>{driver.name}</span>
              <ChevronDown
                size={14}
                style={{
                  flexShrink: 0,
                  color: S.onSurfaceVariant,
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 180ms ease',
                }}
              />
            </div>
          </div>
        </div>

        {/* Direction */}
        <div><Chip kind={driver.direction === 'Expansion' ? 'expansion' : 'contraction'} compact /></div>

        {/* Probability, GP1 % and the expected effect: read-only here */}
        <div><ProbCell driver={driver} mode={mode} myProposal={myProposal} /></div>

        <div className="text-right">
          <Gp1Cell driver={driver} mode={mode} myProposal={myProposal} />
        </div>

        <div className="text-right">
          <ExpectedEffectCell driver={driver} mode={mode} myProposal={myProposal} />
        </div>

        {/* The Edited chip, your review status or the proposal count */}
        <div className="text-right">
          <ReviewStatusCell driver={driver} mode={mode} myProposal={myProposal} />
        </div>
      </div>

      {/* Expanded panel: your proposal (Expert Rating), the review (Review &
          Endorse) or the driver's detail and editor (Driver List). */}
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
            {mode === 'rating' ? (
              <ExpertInputPanel driver={driver} onMyChange={onMyChange} />
            ) : mode === 'review' ? (
              <ReviewPanel driver={driver} updateDriver={updateDriver} />
            ) : (
              <ExpandedPanel driver={driver} isAdmin={isAdmin} updateDriver={updateDriver} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
