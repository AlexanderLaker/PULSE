/**
 * The drill-down of one bar, a drawer from the right: the pool trajectory
 * split into the revenue CAGR and the GP1 margin drift, the euro pools today
 * and in 2030, and every source, linked and graded.
 */
import { useRef, type FC, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import useOverlay from '@/hooks/useOverlay';
import {
  POOL_HORIZON_LABEL, POOL_HORIZON_YEARS, poolCagr, gp1Terminal, itemRevenueEurBn,
  itemGp1PoolEurBn, itemGp1PoolEurBnTerminal, toPoolRating, toCagrRating, toGp1Rating,
  type PoolView, type PoolItem, type CagrRating, type EvidenceGrade,
} from '@/lib/profitPoolData';
import { S, SHADOW, INK_RGB, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';
import { NO_VALUE } from '@/lib/format';
import { arrowColorFor, fmtEurBn, fmtShare } from './arrows';
import { GradeChip, SourceChip, sourceParts, taggedSources } from './sources';

export const DetailPanel: FC<{
  view: PoolView;
  item: PoolItem;
  onClose: () => void;
}> = ({ view, item, onClose }) => {
  const reduceMotion = useReducedMotion();
  const pool = poolCagr(item);
  const poolRating = toPoolRating(pool);
  const revRating = toCagrRating(item.revenueCAGR);
  const gp1Rating = toGp1Rating(item.gp1DeltaBps);
  const name = item.sublabel ? `${item.label} ${item.sublabel}`.trim() : item.label;

  const revEur = itemRevenueEurBn(view, item);
  const revEnd = revEur * Math.pow(1 + item.revenueCAGR, POOL_HORIZON_YEARS);
  const gp1Now = itemGp1PoolEurBn(view, item);
  const gp1End = itemGp1PoolEurBnTerminal(view, item);
  const gp1PoolShare = gp1Now / (view.items.reduce((s, it) => s + itemGp1PoolEurBn(view, it), 0) || 1);
  const panelRef = useRef<HTMLElement>(null);

  // Every figure in the panel explains its calculation and its source on hover.
  const revSrc = item.sources.revenue[0];
  const revSrcNames = item.sources.revenue.map((s) => sourceParts(s).name).join(' · ') || NO_VALUE;
  const mgnSrcNames = item.sources.margin.map((s) => sourceParts(s).name).join(' · ') || NO_VALUE;
  const revBasis = revSrc ? `${revSrc.label}${revSrc.detail ? `\nDerivation: ${revSrc.detail}` : ''}` : NO_VALUE;
  const gp1EndPct = gp1Terminal(item);
  const marginCagr = Math.pow(gp1EndPct / item.gp1Margin, 1 / POOL_HORIZON_YEARS) - 1;
  const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
  const tips = {
    revShare: `Revenue share = this row's revenue ÷ sum of all rows on this view (shares normalized per view).\n\nRow size basis: ${revBasis}`,
    gp1Share: `GP1 pool share = this row's GP1 pool (${fmtEurBn(gp1Now)}) ÷ the sum of all rows' GP1 pools on this view.\n\nGP1 pool = revenue × GP1 margin per row (see the trajectory table).`,
    revToday: `${fmtEurBn(revEur)} = ${fmtShare(item.revenueShare)} share × ${fmtEurBn(view.poolSizeEurBn)} view revenue pool (€ at planning rate 1.15).\n\nSize basis: ${revBasis}`,
    revPa: `Forward revenue CAGR ${revRating.label} p.a. (nominal).\n\nRationale: ${item.revenueDriver}\nSource: ${revSrcNames} (grade: ${revSrc?.grade ?? 'estimate'}).`,
    revEnd: `2030 revenue = today × (1 + CAGR)^${POOL_HORIZON_YEARS}:\n${fmtEurBn(revEur)} × (1 ${item.revenueCAGR >= 0 ? '+' : '−'} ${pct(Math.abs(item.revenueCAGR))})^${POOL_HORIZON_YEARS} = ${fmtEurBn(revEnd)} (nominal).`,
    gp1Today: `GP1/CM1 proxy ${pct(item.gp1Margin)}: a PRISM structured estimate CALIBRATED against reported FY2025 gross margins (GP1 is not separately disclosed at this level, so it is never graded 'reported').\n\nCalibration anchors: ${mgnSrcNames}.`,
    gp1Pa: `Margin drift ${gp1Rating.label} over ${POOL_HORIZON_LABEL}: structured judgment, graded Estimate.\n\nRationale: ${item.marginDriver}`,
    gp1End: `2030 GP1 = today + drift:\n${pct(item.gp1Margin)} ${item.gp1DeltaBps >= 0 ? '+' : '−'} ${Math.abs(item.gp1DeltaBps)}bps = ${pct(gp1EndPct)}.`,
    poolToday: `${fmtEurBn(gp1Now)} = revenue ${fmtEurBn(revEur)} × GP1 ${pct(item.gp1Margin)}.\n\nSources: size from ${revSrcNames}; margin calibration from ${mgnSrcNames}.`,
    poolPa: `Pool CAGR = (1 + revenue CAGR) × (1 + margin CAGR) − 1\n= (1 ${item.revenueCAGR >= 0 ? '+' : '−'} ${pct(Math.abs(item.revenueCAGR))}) × (1 ${marginCagr >= 0 ? '+' : '−'} ${pct(Math.abs(marginCagr), 2)}) − 1 = ${poolRating.label} p.a.\n\nMargin CAGR is the ${item.gp1DeltaBps >= 0 ? '+' : ''}${item.gp1DeltaBps}bps drift spread over ${POOL_HORIZON_YEARS} years.`,
    poolEnd: `2030 GP1 pool = today × (1 + pool CAGR)^${POOL_HORIZON_YEARS}:\n${fmtEurBn(gp1Now)} × (1 ${pool >= 0 ? '+' : '−'} ${pct(Math.abs(pool))})^${POOL_HORIZON_YEARS} = ${fmtEurBn(gp1End)}, which equals 2030 revenue × 2030 GP1 (${fmtEurBn(revEnd)} × ${pct(gp1EndPct)}).`,
  };

  // The shared overlay behaviour (Escape, focus trap, initial focus, focus
  // return, scroll lock). The panel is mounted only while open, so `open` is
  // simply true for its lifetime.
  useOverlay(true, onClose, panelRef);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: S.scrim, zIndex: 1090 }}
        aria-hidden
      />
      {/* Drawer */}
      <motion.aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label={`${name}: profit pool assessment`}
        initial={reduceMotion ? { opacity: 0 } : { x: 440, opacity: 0.6 }}
        animate={reduceMotion ? { opacity: 1 } : { x: 0, opacity: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { x: 440, opacity: 0.6 }}
        transition={{ type: 'tween', duration: 0.22, ease: [0.32, 0.72, 0.25, 1] }}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(420px, 94vw)',
          background: S.surface, zIndex: 1100, overflowY: 'auto',
          borderLeft: `1px solid ${S.cardBorderStrong}`,
          boxShadow: SHADOW.sheet,
          fontFamily: BODY_FONT, color: S.onSurface,
        }}
      >
        <div style={{ padding: '20px 22px 28px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: S.onSurfaceVariant, marginBottom: 4 }}>
                {view.kind === 'ValueChain' ? 'Value chain tier' : view.kind === 'SubSegment' ? 'Sub-segment' : 'Core / adjacent pool'}
                {' · '}{view.group === 'Hair' ? 'Hair' : 'Laundry'}
              </div>
              <h2 style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 20, color: S.onBg, margin: 0, lineHeight: 1.2 }}>
                {name}
              </h2>
              {item.note && (
                <div style={{ fontSize: 11, color: S.mutedText, marginTop: 3, lineHeight: 1.4 }}>{item.note}</div>
              )}
            </div>
            <button type="button"
              onClick={onClose}
              aria-label="Close assessment panel"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                background: S.surfaceLow, border: `1px solid ${S.cardBorder}`,
                cursor: 'pointer', color: S.onBg,
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Key figures: where this pool sits in the view */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            <KeyInfo label="Revenue share" value={fmtShare(item.revenueShare)} sub="of view" tip={tips.revShare} />
            <KeyInfo label="GP1 pool share" value={fmtShare(gp1PoolShare)} sub="of view pool" tip={tips.gp1Share} />
          </div>

          {/* Profit pool trajectory, one row per metric: today → rate → 2030 */}
          <div style={{ marginBottom: 16 }}>
            <SectionLabel>Profit pool trajectory · {POOL_HORIZON_LABEL}</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: TRAJ_GRID, gap: 6, padding: '6px 4px 7px' }}>
              <span />
              <span style={{ textAlign: 'right', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: S.onSurfaceVariant }}>Today</span>
              <span style={{ textAlign: 'right', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: S.onSurfaceVariant }}>p.a.</span>
              <span style={{ textAlign: 'right', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: S.onSurfaceVariant }}>2030</span>
            </div>
            <TrajRow
              metric="Revenue pool"
              today={fmtEurBn(revEur)}
              change={revRating.label}
              changeTone={revRating.tone}
              end={fmtEurBn(revEnd)}
              driver={item.revenueDriver}
              grade={item.sources.revenue[0]?.grade ?? 'estimate'}
              todayTip={tips.revToday}
              changeTip={tips.revPa}
              endTip={tips.revEnd}
            />
            <TrajRow
              metric="GP1 margin (proxy)"
              today={`${(item.gp1Margin * 100).toFixed(1)}%`}
              change={gp1Rating.label}
              changeTone={gp1Rating.tone}
              end={`${(gp1Terminal(item) * 100).toFixed(1)}%`}
              driver={item.marginDriver}
              grade="estimate"
              todayTip={tips.gp1Today}
              changeTip={tips.gp1Pa}
              endTip={tips.gp1End}
            />
            <TrajRow
              metric="GP1 profit pool"
              today={fmtEurBn(gp1Now)}
              change={poolRating.label}
              changeTone={poolRating.tone}
              end={fmtEurBn(gp1End)}
              emphasis
              todayTip={tips.poolToday}
              changeTip={tips.poolPa}
              endTip={tips.poolEnd}
            />
            <div style={{ fontSize: 11, color: S.mutedText, lineHeight: 1.5, margin: '9px 4px 0' }}>
              Pool = revenue × GP1 margin: the bottom row is the top two combined. Margin drift is a structured estimate; the pool rate inherits it. Hover any figure for its calculation and source.
            </div>
          </div>

          {/* Sources: compact "Name (value)" hyperlinks; colour = grade */}
          <div style={{ marginBottom: 4 }}>
            <SectionLabel>Sources</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 14px', marginTop: 5, lineHeight: 1.5 }}>
              {taggedSources(item.sources.revenue, item.sources.margin).map(({ src, kind }) => (
                <SourceChip key={src.url} src={src} kind={kind} />
              ))}
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
};

const SectionLabel: FC<{ children: ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: S.onSurfaceVariant, marginBottom: 2 }}>
    {children}
  </div>
);

// A key figure: the share of the view this pool holds; `tip` explains on
// hover how the figure is derived and where it comes from.
const KeyInfo: FC<{ label: string; value: string; sub: string; tip?: string }> = ({ label, value, sub, tip }) => (
  <div
    title={tip}
    style={{ background: S.surfaceLow, borderRadius: 10, padding: '9px 12px', border: `1px solid ${S.cardBorder}`, cursor: tip ? 'help' : undefined }}
  >
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: S.onSurfaceVariant }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 800, fontFamily: HEADLINE_FONT, color: S.onBg, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
      {value} <span style={{ fontSize: 11, fontWeight: 600, color: S.mutedText }}>{sub}</span>
    </div>
  </div>
);

const TRAJ_GRID = '1.4fr 1fr 1fr 1fr';

// One trajectory row: metric · today · change (colour = direction) · 2030,
// with an optional driver and grade beneath. Each figure carries its own
// calculation and source on hover (the dotted underline marks it).
const TrajRow: FC<{
  metric: string; today: string; change: string; changeTone: CagrRating['tone']; end: string;
  emphasis?: boolean; driver?: string; grade?: EvidenceGrade;
  todayTip?: string; changeTip?: string; endTip?: string;
}> = ({ metric, today, change, changeTone, end, emphasis, driver, grade, todayTip, changeTip, endTip }) => {
  const num = (color: string, tip?: string) => ({
    textAlign: 'right' as const, fontFamily: HEADLINE_FONT, fontWeight: 800,
    fontSize: emphasis ? 16 : 14, color, fontVariantNumeric: 'tabular-nums' as const,
    ...(tip ? {
      cursor: 'help' as const,
      textDecoration: 'underline dotted' as const,
      textDecorationColor: `rgba(${INK_RGB}, 0.25)`,
      textUnderlineOffset: 3,
    } : null),
  });
  return (
    <>
      <div
        style={{
          display: 'grid', gridTemplateColumns: TRAJ_GRID, gap: 6, alignItems: 'baseline',
          padding: emphasis ? '12px' : '9px 4px 0',
          ...(emphasis ? { background: S.surfaceLow, border: `1px solid ${S.cardBorder}`, borderRadius: 12, marginTop: 8 } : null),
        }}
      >
        <span style={{ fontSize: emphasis ? 13.5 : 12.5, fontWeight: emphasis ? 800 : 700, fontFamily: emphasis ? HEADLINE_FONT : BODY_FONT, color: S.onBg }}>{metric}</span>
        <span style={num(S.onBg, todayTip)} title={todayTip}>{today}</span>
        <span style={num(arrowColorFor(changeTone), changeTip)} title={changeTip}>{change}</span>
        <span style={num(emphasis ? arrowColorFor(changeTone) : S.onBg, endTip)} title={endTip}>{end}</span>
      </div>
      {driver && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '3px 4px 9px', borderBottom: `1px solid ${S.surfaceHigh}` }}>
          <span style={{ flex: 1, fontSize: 11, color: S.onSurfaceVariant, lineHeight: 1.45 }}>{driver}</span>
          {grade && <GradeChip grade={grade} />}
        </div>
      )}
    </>
  );
};
