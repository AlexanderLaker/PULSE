/**
 * The Profit Pool Explorer (Beta, open to every signed-in user): Bain-style
 * profit pool views over public data, one chart per view.
 *
 *   Chart: bar width = revenue share, bar height = GP1 margin, bar area = the
 *   profit pool; rows keep their authored order (value chain raw to retail,
 *   categories by logic).
 *   Arrows: the development of the pool area (revenue × GP1), derived in
 *   lib/profitPoolData.ts as (1 + revenue CAGR) × (1 + margin CAGR) − 1;
 *   not revenue growth alone, and not the GP1 level.
 *   Drill-down: a bar opens a panel that splits the pool trajectory into its
 *   two factors, the revenue CAGR and the GP1 margin drift (a graded
 *   estimate), with € pools today and in 2030 and every source linked and
 *   graded.
 *   Navigation: Laundry | Hair, then Value Chain | Sub-Segments | Core + Adjacent.
 *
 * Every indicator runs over the same horizon, FY2025 → 2030.
 */

'use client';

import { useCallback, useMemo, useState, type FC } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Info, Lightbulb, Loader2 } from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import {
  PROFIT_POOL_VIEWS, POOL_CAGR_THRESHOLDS, POOL_HORIZON_LABEL, viewPoolSummary, toPoolRating,
  type PoolItem, type PoolViewKind, type PoolGroup,
} from '@/lib/profitPoolData';
import { S, SHADOW, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';
import { arrowColorFor, ArrowLegend, ArrowsHTML, fmtEurBn } from './explorer/arrows';
import { GradeChip } from './explorer/sources';
import { HoverTip, PoolChart } from './explorer/PoolChart';
import { DetailPanel } from './explorer/DetailPanel';
import { GroupToggle, KindPills, KINDS } from './explorer/controls';
import { ExplorerBetaNotice, NOTICE_ACK_KEY, noticeAcked } from './explorer/BetaNotice';

const ProfitPoolExplorer: FC = () => {
  const { loading } = usePrism();
  const [group, setGroup] = useState<PoolGroup>('LHC');
  const [kind, setKind] = useState<PoolViewKind>('ValueChain');
  const [hover, setHover] = useState<{ item: PoolItem; x: number; y: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The Beta notice opens once per browser: on the first Explorer visit
  // (the tab stays mounted once visited) and never again once acknowledged.
  // "Got it" stores the acknowledgment; Escape or a backdrop click only
  // dismisses. The acknowledgment is read in the state initializer: this tab
  // renders on the client only (`ssr: false` in page.tsx) and
  // `noticeAcked()` is SSR-safe anyway, so there is nothing to hydrate
  // against and no effect is needed to reach the open state.
  const [noticeOpen, setNoticeOpen] = useState(() => !noticeAcked());
  const closeNotice = useCallback(() => setNoticeOpen(false), []);
  const ackNotice = useCallback(() => {
    try { window.localStorage.setItem(NOTICE_ACK_KEY, '1'); } catch { /* storage unavailable: dismiss only */ }
    setNoticeOpen(false);
  }, []);

  const view = useMemo(
    () =>
      PROFIT_POOL_VIEWS.find(s => s.group === group && s.kind === kind)
      ?? PROFIT_POOL_VIEWS[0],
    [group, kind],
  );

  const selectedItem = useMemo(
    () => view.items.find(it => it.id === selectedId) ?? null,
    [view, selectedId],
  );

  const summary = useMemo(() => viewPoolSummary(view), [view]);
  const viewPoolRating = toPoolRating(summary.weightedPoolCagr);

  const closePanel = useCallback(() => setSelectedId(null), []);

  return (
    <div
      className="min-h-screen"
      style={{
        // The page shell every dashboard tab shares: centred, max 1440px wide,
        // 40px / 32px padding.
        maxWidth: 1440,
        margin: '0 auto',
        padding: '40px 32px',
        fontFamily: BODY_FONT,
        color: S.onBg,
        background: S.bg,
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div className="pl-5" style={{ borderLeft: `4px solid ${S.primary}` }}>
          <div className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: S.onSurfaceVariant, marginBottom: 6 }}>
            Beta · Profit Pool Explorer
          </div>
          <h1 className="font-extrabold tracking-tight" style={{ fontFamily: HEADLINE_FONT, fontSize: '2.4rem', lineHeight: 1.15, color: S.onBg, margin: 0 }}>
            Industry Profit Pools: HCB Lens
          </h1>
          <p style={{ color: S.mutedText, fontSize: 13, margin: '6px 0 0', maxWidth: 780 }}>
            Bain-classic pool views. Arrows show the development of the
            <b> profit pool</b> (revenue × GP1 proxy, {POOL_HORIZON_LABEL}). Click any bar for the
            revenue / margin decomposition, € pool sizes and clickable sources.
            Y-axis = <b>GP1 proxy</b> (estimated). Market sizing: <b>Euromonitor</b> (consumer hair · laundry/home care),
            <b> Kline</b> (professional hair).
          </p>
        </div>

        {/* Horizon badge (view selection lives in the Group/Kind toggles below) */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div
            style={{
              padding: '8px 14px', borderRadius: 10,
              background: S.surface, border: `1px solid ${S.cardBorder}`,
              fontFamily: HEADLINE_FONT, fontWeight: 700, fontSize: 12, color: S.onSurfaceVariant,
            }}
            title="All development indicators compound over this horizon"
          >
            Horizon · {POOL_HORIZON_LABEL}
          </div>
        </div>
      </div>

      {/* Hierarchical navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        <GroupToggle group={group} onSelect={(g) => { setGroup(g); setSelectedId(null); }} />
        <div style={{ width: 1, height: 26, background: S.cardBorderStrong }} aria-hidden />
        <KindPills kind={kind} onSelect={(k) => { setKind(k); setSelectedId(null); }} />
      </div>

      {/* Main card: borderless, rounded, soft shadow */}
      <div
        className="rounded-2xl"
        style={{
          background: S.surface,
          padding: 28,
          boxShadow: SHADOW.card,
        }}
      >
        {/* Card title + pool summary */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: S.onSurfaceVariant, marginBottom: 4 }}>
              {group === 'Hair' ? 'Hair' : 'Laundry'} · {KINDS.find(k => k.id === kind)?.label} · revenue pool {view.poolSize}
            </div>
            <div style={{ fontFamily: HEADLINE_FONT, fontSize: 22, fontWeight: 800, color: S.onBg, lineHeight: 1.2 }}>
              {view.title}
            </div>
            <div style={{ fontSize: 12, color: S.mutedText, marginTop: 4 }}>
              {view.subtitle}
            </div>
          </div>

          {/* GP1 pool trajectory badge: area-weighted, not revenue-weighted */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '10px 14px', borderRadius: 12,
              background: S.surfaceLow,
              border: `1px solid ${S.cardBorder}`,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: S.onSurfaceVariant }}>
                GP1 pool · {POOL_HORIZON_LABEL}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, fontFamily: HEADLINE_FONT, color: S.onBg, fontVariantNumeric: 'tabular-nums' }}>
                {fmtEurBn(summary.gp1PoolNowEurBn)} → {fmtEurBn(summary.gp1PoolTerminalEurBn)}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: arrowColorFor(viewPoolRating.tone), fontVariantNumeric: 'tabular-nums' }}>
                {viewPoolRating.label} p.a. pool-weighted
              </div>
            </div>
            <ArrowsHTML rating={viewPoolRating} size={20} />
          </div>
        </div>

        {/* Chart */}
        <div style={{ position: 'relative', marginTop: 18 }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: S.veil, zIndex: 5, borderRadius: 12 }}>
              <Loader2 size={24} className="animate-spin" color={S.primary} />
            </div>
          )}
          <PoolChart
            view={view}
            selectedId={selectedId}
            onHover={(item, x, y) => { if (!selectedId) setHover({ item, x, y }); }}
            onLeave={() => setHover(null)}
            onSelect={(item) => { setHover(null); setSelectedId(item.id); }}
          />
        </div>

        {/* Legend: pool ladder and evidence grades */}
        <div
          style={{
            display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center',
            padding: '14px 0 4px', borderTop: `1px solid ${S.surfaceHigh}`,
            marginTop: 18,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: S.onSurfaceVariant }}>
            Pool development p.a.
          </span>
          <ArrowLegend rating={toPoolRating(0.08)}  label={`≥ ${(POOL_CAGR_THRESHOLDS.two * 100).toFixed(0)}% growth`} />
          <ArrowLegend rating={toPoolRating(0.045)} label={`${(POOL_CAGR_THRESHOLDS.one * 100).toFixed(0)}–${(POOL_CAGR_THRESHOLDS.two * 100).toFixed(0)}%`} />
          <ArrowLegend rating={toPoolRating(0.015)} label={`${(POOL_CAGR_THRESHOLDS.flat * 100).toFixed(1)}–${(POOL_CAGR_THRESHOLDS.one * 100).toFixed(0)}%`} />
          <ArrowLegend rating={toPoolRating(0)}     label={`flat (< ${(POOL_CAGR_THRESHOLDS.flat * 100).toFixed(1)}%)`} />
          <ArrowLegend rating={toPoolRating(-0.02)} label="decline (mirrored)" />
          <div style={{ width: 1, height: 16, background: S.cardBorderStrong }} aria-hidden />
          <GradeChip grade="reported" />
          <GradeChip grade="derived" />
          <GradeChip grade="estimate" />
          <div style={{ marginLeft: 'auto', fontSize: 11, color: S.mutedText }}>
            Nominal terms · € at 1.15 · click any bar for the full assessment
          </div>
        </div>

        {/* How-to-read key and the caveat on the development arrows */}
        <div
          style={{
            marginTop: 12, padding: '10px 12px', borderRadius: 10,
            background: S.surfaceLow, border: `1px solid ${S.cardBorder}`,
            fontSize: 11, color: S.onSurfaceVariant, lineHeight: 1.55,
          }}
        >
          <b style={{ color: S.onBg }}>How to read this chart:</b>{' '}
          bar <b>width</b> = revenue share · bar <b>height</b> = GP1 proxy ·
          bar <b>area</b> = GP1 profit pool · <b>arrow</b> = pool development p.a.
          <span style={{ color: S.mutedText }}>
            {' '}The arrow combines a verified revenue CAGR with a <b>structured margin-drift estimate</b>{' '}
            (the drift is judgment, graded Estimate in the drill-down; treat the arrow as directional, not a forecast).
            Sub-1% pools render as slim slivers: hover or click a bar to inspect them.
            {view.kind === 'ValueChain' && (
              <> Value-chain tiers <b>overlap</b> (the same end-consumer euro is counted at brand-owner and again at retail), so total chain revenue exceeds the headline consumer pool; areas show where margin sits, not additive pools.</>
            )}
          </span>
        </div>
      </div>

      {/* Key insights and how the view is built */}
      <div style={{ marginTop: 18, padding: 20, background: S.surface, border: `1px solid ${S.cardBorder}`, borderRadius: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Lightbulb size={16} color={S.primary} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: S.primary }}>
            Profit Pool Architecture · Key Insights
          </span>
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {view.insights.map((text, i) => (
            <li
              key={i}
              style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                fontSize: 13, color: S.onSurface, lineHeight: 1.5,
              }}
            >
              <Info size={14} color={S.primary} style={{ flexShrink: 0, marginTop: 3 }} />
              <span>{text}</span>
            </li>
          ))}
        </ul>

        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${S.surfaceHigh}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: S.onSurfaceVariant, marginBottom: 5 }}>
            How this view is built
          </div>
          <div style={{ fontSize: 11, color: S.mutedText, lineHeight: 1.55, maxWidth: 980 }}>
            {view.construction}
          </div>
        </div>

      </div>

      {/* About this view: the methodology footnote */}
      <div style={{ marginTop: 18, fontSize: 11, color: S.mutedText, lineHeight: 1.6, maxWidth: 980 }}>
        <b style={{ color: S.onSurfaceVariant }}>About this view.</b>{' '}
        The Y-axis is a <b>GP1 proxy</b>: GP1 / CM1 is not separately disclosed at tier level by any
        player, so tier values are structured estimates calibrated against the linked, verified company
        gross margins (grades shown). Where a company-level figure is itself the anchor it is used exactly
        as disclosed. Market sizing: <b>Euromonitor</b> (consumer hair · laundry/home care),
        <b> Kline</b> (professional hair). Nominal terms; € at planning rate 1.15.
      </div>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hover && !selectedItem && (
          <HoverTip item={hover.item} view={view} x={hover.x} y={hover.y} />
        )}
      </AnimatePresence>

      {/* Drill-down panel */}
      <AnimatePresence>
        {selectedItem && (
          <DetailPanel view={view} item={selectedItem} onClose={closePanel} />
        )}
      </AnimatePresence>

      {/* Beta notice, shown on the first visit */}
      <ExplorerBetaNotice open={noticeOpen} onAck={ackNotice} onClose={closeNotice} />
    </div>
  );
};

export default ProfitPoolExplorer;
