/**
 * The Profit Pool Explorer (Beta, open to every user with a role): profit pool
 * views over public data, one chart per view.
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
 *   Navigation: Laundry & Home Care | Hair, then Value Chain | Categories | Core + Adjacent.
 *
 * Every indicator runs over the same horizon, FY2025 → 2030.
 *
 * The views are not in the bundle: the Explorer fetches them from the API on
 * its first open (GET /api/v1/explorer, which a signed-in user with a role
 * may read; the figures live in data/content/profit_pools.json) and runs the
 * arithmetic of lib/profitPoolData.ts on what arrived. Until they arrive the
 * pane keeps the skeleton it opened with; when the API cannot be reached it
 * shows a notice with "Try again" and no chart.
 *
 * The address carries the group, the kind of view and the open pool
 * (hooks/useViewUrl.tsx): a link opens the same chart and drawer once the
 * views have arrived, and Back closes the drawer.
 */

'use client';

import { useCallback, useEffect, useMemo, useState, type FC } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Info, Lightbulb } from 'lucide-react';
import {
  POOL_CAGR_THRESHOLDS, POOL_HORIZON_LABEL, viewPoolSummary, toPoolRating,
  type PoolItem, type PoolView, type PoolViewKind, type PoolGroup,
} from '@/lib/profitPoolData';
import { getExplorerViews } from '@/lib/apiClient';
import { useViewParams } from '@/hooks/useViewUrl';
import { S, SHADOW, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';
import { PaneSkeleton } from './LoadingSkeleton';
import { arrowColorFor, ArrowLegend, ArrowsHTML, fmtEurBn } from './explorer/arrows';
import { GradeChip } from './explorer/sources';
import { HoverTip, PoolChart } from './explorer/PoolChart';
import { DetailPanel } from './explorer/DetailPanel';
import { GroupToggle, KindPills, KINDS } from './explorer/controls';
import { ExplorerBetaNotice, NOTICE_ACK_KEY, noticeAcked } from './explorer/BetaNotice';

/** The group and kind an address names; the Laundry value chain when it names none. */
const groupOf = (param: string | undefined): PoolGroup => (param === 'Hair' ? 'Hair' : 'LHC');
const kindOf = (param: string | undefined): PoolViewKind =>
  (param === 'Categories' || param === 'CoreAdjacent' ? param : 'ValueChain');

/** The views as the API answered: on their way, arrived, or not to be had. */
type ViewsState =
  | { status: 'loading' }
  | { status: 'ready'; views: PoolView[] }
  | { status: 'unavailable' };

const ProfitPoolExplorer: FC = () => {
  const [params, setParams] = useViewParams('profit-pool-explorer');

  // The views, fetched when the pane first opens and again on "Try again".
  // Nothing of them is shown before the answer; an answer without views is
  // treated as no answer.
  const [viewsState, setViewsState] = useState<ViewsState>({ status: 'loading' });
  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    getExplorerViews()
      .then(({ views }) => {
        if (cancelled) return;
        setViewsState(views.length ? { status: 'ready', views } : { status: 'unavailable' });
      })
      .catch(() => {
        if (cancelled) return;
        setViewsState({ status: 'unavailable' });
      });
    return () => { cancelled = true; };
  }, [loadAttempt]);
  const loadViews = useCallback(() => {
    setViewsState({ status: 'loading' });
    setLoadAttempt((n) => n + 1);
  }, []);
  const views = viewsState.status === 'ready' ? viewsState.views : null;

  const [group, setGroupState] = useState<PoolGroup>(() => groupOf(params.group));
  const [kind, setKindState] = useState<PoolViewKind>(() => kindOf(params.kind));
  const [hover, setHover] = useState<{ item: PoolItem; x: number; y: number } | null>(null);
  const [selectedId, setSelectedIdState] = useState<string | null>(() => params.pool ?? null);

  // The view writes every change to the address and adopts the address when
  // it changes under it (Back, Forward, a pasted link). The adoption compares
  // the address with the state, during render as React documents for state
  // that follows a prop; a value the view wrote itself already matches, and a
  // view without a provider (its parameters always empty) sees no change.
  const setGroup = useCallback((g: PoolGroup) => {
    setGroupState(g);
    setSelectedIdState(null);
    setParams({ group: g, pool: null });
  }, [setParams]);
  const setKind = useCallback((k: PoolViewKind) => {
    setKindState(k);
    setSelectedIdState(null);
    setParams({ kind: k, pool: null });
  }, [setParams]);
  /** Opens a pool's drawer (pushing a history entry, so Back closes it) or closes it. */
  const setSelectedId = useCallback((id: string | null) => {
    setSelectedIdState(id);
    setParams({ pool: id }, { push: !!id });
  }, [setParams]);
  const [prevParams, setPrevParams] = useState({ group: params.group, kind: params.kind, pool: params.pool });
  if (params.group !== prevParams.group || params.kind !== prevParams.kind || params.pool !== prevParams.pool) {
    setPrevParams({ group: params.group, kind: params.kind, pool: params.pool });
    if (groupOf(params.group) !== group) setGroupState(groupOf(params.group));
    if (kindOf(params.kind) !== kind) setKindState(kindOf(params.kind));
    if ((params.pool ?? null) !== selectedId) setSelectedIdState(params.pool ?? null);
  }

  // The Beta notice opens once per browser: on the first Explorer visit
  // (the tab stays mounted once visited) and never again once acknowledged.
  // "Got it" stores the acknowledgement; Escape or a backdrop click only
  // dismisses. The acknowledgement is read when the state is initialised: this
  // tab renders on the client only (`ssr: false` in page.tsx) and
  // `noticeAcked()` is SSR-safe anyway, so there is nothing to hydrate
  // against and no effect is needed to reach the open state.
  const [noticeOpen, setNoticeOpen] = useState(() => !noticeAcked());
  const closeNotice = useCallback(() => setNoticeOpen(false), []);
  const openNotice = useCallback(() => setNoticeOpen(true), []);
  const ackNotice = useCallback(() => {
    try { window.localStorage.setItem(NOTICE_ACK_KEY, '1'); } catch { /* storage unavailable: dismiss only */ }
    setNoticeOpen(false);
  }, []);

  // The view the controls (or the address) name, once the views have arrived.
  const view = useMemo(
    () => (views ? views.find(s => s.group === group && s.kind === kind) ?? views[0] ?? null : null),
    [views, group, kind],
  );

  const selectedItem = useMemo(
    () => view?.items.find(it => it.id === selectedId) ?? null,
    [view, selectedId],
  );

  const summary = useMemo(() => (view ? viewPoolSummary(view) : null), [view]);

  const closePanel = useCallback(() => setSelectedId(null), [setSelectedId]);

  // Until the views arrive the pane keeps the skeleton the first visit opened
  // with (app/dashboard/DashboardApp.tsx shows the same one while the code
  // loads), so the reader sees one skeleton from the click to the chart.
  if (viewsState.status === 'loading') return <PaneSkeleton />;

  const viewPoolRating = summary ? toPoolRating(summary.weightedPoolCagr) : null;

  return (
    <main
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
            Profit pool views. Arrows show the development of the
            <b> profit pool</b> (revenue × GP1 proxy, {POOL_HORIZON_LABEL}). Click any bar for the
            revenue / margin decomposition, € pool sizes and clickable sources.
            Y-axis = <b>GP1 proxy</b> (estimated).
          </p>
          <p style={{ color: S.onSurfaceVariant, fontSize: 13, margin: '6px 0 0', maxWidth: 780 }}>
            These are published industry figures and PRISM&rsquo;s own estimates on them; nothing here comes
            from the simulation and nothing feeds the Shift Matrix.{' '}
            <button type="button"
              onClick={openNotice}
              data-print-hide
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit',
                color: S.primary, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 2,
              }}
            >
              About this data
            </button>
          </p>
        </div>

        {/* Horizon badge (view selection lives in the Group/Kind toggles below) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
          <div
            style={{
              padding: '8px 14px', borderRadius: 10,
              background: S.surface, border: `1px solid ${S.cardBorder}`,
              fontFamily: HEADLINE_FONT, fontWeight: 700, fontSize: 12, color: S.onSurfaceVariant,
            }}
          >
            Horizon · {POOL_HORIZON_LABEL}
          </div>
          <div style={{ fontSize: 11, color: S.mutedText, paddingLeft: 2 }}>
            Every development rate compounds over these five years.
          </div>
        </div>
      </div>

      {/* The views could not be loaded: the notice stands in for the controls,
          the chart and everything built on the views. */}
      {!view || !summary || !viewPoolRating ? (
        <div role="status" className="flex items-center justify-between gap-3 flex-wrap rounded-xl px-4 py-3"
          style={{ backgroundColor: S.amberContainer, color: S.onAmberContainer }}>
          <p className="text-[12.5px]" style={{ lineHeight: 1.55, margin: 0 }}>
            The profit pool views could not be loaded from the PRISM service, so there is no chart to show; the
            chart and its sources appear once it answers.
          </p>
          <button type="button" onClick={loadViews} className="px-3 py-1.5 rounded-full text-[12px] font-bold"
            style={{ backgroundColor: S.surface, color: S.primary, border: 'none', cursor: 'pointer', fontFamily: HEADLINE_FONT }}>
            Try again
          </button>
        </div>
      ) : (
      <>
      {/* Hierarchical navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 20 }} data-print-hide>
        <GroupToggle group={group} onSelect={setGroup} />
        <div style={{ width: 1, height: 26, background: S.cardBorderStrong }} aria-hidden />
        <KindPills kind={kind} onSelect={setKind} />
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
        {/* Card title + pool summary. The title names the view's scope (Laundry
            Care, Home Care or Hair Care), which can be narrower than the group
            selected above, so the eyebrow does not repeat the group. */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: S.onSurfaceVariant, marginBottom: 4 }}>
              {KINDS.find(k => k.id === kind)?.label} · revenue pool {view.poolSize}
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
        <div style={{ fontSize: 11, color: S.mutedText, lineHeight: 1.5, marginTop: 4 }}>
          Reported = as published; Derived = arithmetic on published figures; Estimate = structured judgment.
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
            {' '}The arrow combines a sourced revenue CAGR with a <b>structured margin-drift estimate</b>{' '}
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
        as disclosed. Market sizing: public triangulations on the <b>Euromonitor</b> (consumer hair ·
        laundry/home care) and <b>Kline</b> (professional hair) category trees. Nominal terms; € at
        planning rate 1.15.
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
      </>
      )}

      {/* Beta notice, shown on the first visit; "About this data" reopens it */}
      <ExplorerBetaNotice open={noticeOpen} onAck={ackNotice} onClose={closeNotice} />
    </main>
  );
};

export default ProfitPoolExplorer;
