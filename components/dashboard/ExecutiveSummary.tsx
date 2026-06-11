'use client';

/**
 * ExecutiveSummary — the landing view (S4).
 *
 * Leads with the answer, not the instrument: one dominant figure (portfolio
 * profit-pool shift to the horizon, with its band), a plain-language read, the
 * trajectory, the categories that move most (each drills straight into the
 * full-screen Category Detail Panel), an at-a-glance strip, and signposted
 * links into the matrix, trends, journey and innovation views.
 *
 * All figures come from the latest persisted run via usePrism — the same MC
 * output the Shift Matrix renders, aggregated here for a leadership read.
 */

import React, { useMemo, FC } from 'react';
import {
  Clock, GitBranch, ArrowUpRight, BarChart3, Activity, Map as MapIcon,
  Lightbulb, Database, Info, Loader2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import { CATEGORIES, YEARS, fmtShift, shiftColor, EXPANSION, CONTRACTION } from '@/lib/format';
import ShiftValue from '@/components/dashboard/ShiftValue';
import { getYearPercentiles, weightedAvg } from '@/lib/shiftMatrix';

// ─── Maritime tokens (shared system) ────────────────────────────────
const S = {
  bg:                 '#f8f9ff',
  surface:            '#ffffff',
  surfaceLow:         '#eff4ff',
  surfaceContainer:   '#e5eeff',
  surfaceHigh:        '#dce9ff',
  primary:            '#005db5',
  primaryDim:         '#0052a0',
  primaryContainer:   '#d6e3ff',
  onPrimaryContainer: '#00519e',
  onBg:               '#00345e',
  onSurface:          '#00345e',
  onSurfaceVariant:   '#26619d',
  mutedText:          '#64748B',
  cardBorder:         'rgba(0, 52, 94, 0.10)',
  cardBorderStrong:   'rgba(0, 52, 94, 0.16)',
};
const HEADLINE_FONT = "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const BODY_FONT     = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

interface CatRow { id: string; name: string; group?: string; med: number; p10: number | null; p90: number | null; }
interface PathPoint { year: number; median: number | null; p10: number | null; p90: number | null; }

export interface ExecutiveSummaryProps {
  onNavigateMatrix?: () => void;
  onNavigateTrends?: () => void;
  onNavigateJourney?: () => void;
  onNavigateInnovation?: () => void;
  /** Open the full-screen drill-down for a category (routes via the matrix). */
  onOpenCategory?: (categoryId: string) => void;
}

const ExecutiveSummary: FC<ExecutiveSummaryProps> = ({
  onNavigateMatrix, onNavigateTrends, onNavigateJourney, onNavigateInnovation, onOpenCategory,
}) => {
  const { simulation, config, trends, loading } = usePrism();

  const summary = useMemo(() => {
    const shifts = simulation?.shifts;
    if (!shifts) return null;
    const horizon = YEARS[YEARS.length - 1]!;
    const weights = config?.category_weights as Record<string, number> | undefined;
    const wFor = (name: string, id: string): number => {
      if (!weights) return 1;
      const byName = weights[name];
      if (typeof byName === 'number' && isFinite(byName)) return byName;
      const byId = weights[id];
      if (typeof byId === 'number' && isFinite(byId)) return byId;
      return 0;
    };

    const cats: CatRow[] = [];
    CATEGORIES.forEach((c) => {
      const d = getYearPercentiles(shifts, c.name, c.id, horizon);
      const m = d?.median ?? null;
      if (m == null || !isFinite(m)) return;
      cats.push({ id: c.id, name: c.name, group: c.group, med: m, p10: d?.p10 ?? null, p90: d?.p90 ?? null });
    });
    if (cats.length === 0) return null;

    // Portfolio weighted path (median + band) across the horizon.
    const path: PathPoint[] = YEARS.map((y) => {
      const meds: Array<number | null> = [], p10s: Array<number | null> = [], p90s: Array<number | null> = [], ws: number[] = [];
      CATEGORIES.forEach((c) => {
        const d = getYearPercentiles(shifts, c.name, c.id, y);
        meds.push(d?.median ?? null); p10s.push(d?.p10 ?? null); p90s.push(d?.p90 ?? null); ws.push(wFor(c.name, c.id));
      });
      return { year: y, median: weightedAvg(meds, ws), p10: weightedAvg(p10s, ws), p90: weightedAvg(p90s, ws) };
    });

    // D3/F-16 (June 2026): prefer the engine's TRUE joint portfolio band
    // (totals.portfolio, computed per-iteration from raw samples, 2.8.0+
    // runs) over the category-weighted average of per-category bands —
    // the latter is narrower than the truth by construction and remains
    // only as the labeled fallback for pre-2.8 persisted runs. Applied
    // per year, so the trajectory band is the joint band too.
    const portfolio = simulation?.totals?.portfolio;
    let joint = false;
    if (portfolio) {
      path.forEach((pt) => {
        const jp = portfolio[String(pt.year)];
        if (jp && typeof jp === 'object' && jp.p10 != null && jp.p90 != null) {
          pt.p10 = jp.p10;
          pt.p90 = jp.p90;
          if (jp.median != null) pt.median = jp.median;
          if (pt.year === horizon) joint = true;
        }
      });
    }
    const term = path[path.length - 1]!;

    const sorted = [...cats].sort((a, b) => b.med - a.med);
    const topUp = sorted.filter((c) => c.med > 0).slice(0, 4);
    const topDown = sorted.filter((c) => c.med < 0).slice(-4).reverse();
    const expanding = cats.filter((c) => c.med > 0).length;
    const contracting = cats.filter((c) => c.med < 0).length;

    return {
      horizon, joint,
      med: term.median, p10: term.p10, p90: term.p90,
      path, topUp, topDown, expanding, contracting, total: cats.length,
    };
  }, [simulation, config]);

  // Run metadata for the freshness / reproducibility chips.
  const asOf = (() => {
    const d = simulation?.run_meta?.persisted_at_utc
      ?? simulation?.run_meta?.run_date
      ?? simulation?.generated;
    if (!d) return null;
    const parsed = new Date(d);
    return isNaN(parsed.getTime())
      ? null
      : parsed.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  })();
  // Seed stability (D3, June 2026): the honest reproducibility quantity —
  // headline spread across independently-seeded chains. Deliberately NOT a
  // "Converged ✓" claim: R̂ on i.i.d. MC draws is ≈1.0 by construction.
  const seedStability = simulation?.seed_stability ?? null;
  const runId = simulation?.run_meta?.run_id ?? null;
  const iterations = simulation?.run_meta?.iterations ?? null;

  // ─── Loading / empty states ───────────────────────────────────────
  if (loading && !summary) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: S.bg }}>
        <main className="max-w-[1180px] mx-auto px-8 py-16 flex items-center gap-3" style={{ color: S.mutedText }}>
          <Loader2 size={20} className="animate-spin" style={{ color: S.primary }} />
          <span style={{ fontSize: 14, fontFamily: BODY_FONT }}>Loading the executive summary…</span>
        </main>
      </div>
    );
  }
  if (!summary) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: S.bg }}>
        <main className="max-w-[1180px] mx-auto px-8 py-16">
          <div className="rounded-3xl px-8 py-16 text-center"
            style={{ backgroundColor: S.surface, border: `1px solid ${S.cardBorder}` }}>
            <Info size={26} style={{ color: S.primary, opacity: 0.7, margin: '0 auto' }} />
            <h2 className="mt-4 text-[20px] font-extrabold" style={{ color: S.onBg, fontFamily: HEADLINE_FONT }}>
              No published simulation yet
            </h2>
            <p className="mt-2 text-[14px] max-w-md mx-auto" style={{ color: S.onSurfaceVariant, lineHeight: 1.55 }}>
              The executive summary appears here automatically as soon as the PRISM team publishes a run.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const moversAll = [...summary.topUp, ...summary.topDown];

  const MoverRow: FC<{ c: CatRow; rank: number }> = ({ c, rank }) => (
    <button
      type="button"
      onClick={onOpenCategory ? () => onOpenCategory(c.id) : onNavigateMatrix}
      className="group w-full flex items-center justify-between gap-4 px-4 py-3 rounded-2xl text-left transition-colors"
      style={{ backgroundColor: S.surfaceLow, border: `1px solid ${S.cardBorder}`, cursor: 'pointer' }}
    >
      <span className="flex items-center gap-3 min-w-0">
        <span className="inline-flex items-center justify-center rounded-full shrink-0"
          style={{ width: 22, height: 22, backgroundColor: S.surface, color: S.mutedText,
            fontSize: 11, fontWeight: 700, border: `1px solid ${S.cardBorder}`, fontFamily: HEADLINE_FONT }}>
          {rank}
        </span>
        <span className="truncate">
          <span className="block text-[13.5px] font-semibold truncate" style={{ color: S.onSurface }}>{c.name}</span>
          <span className="block text-[11px]" style={{ color: S.mutedText }}>{c.group}</span>
        </span>
      </span>
      <span className="flex items-center gap-2 shrink-0">
        <ShiftValue
          value={c.med}
          size={19}
          fontFamily={HEADLINE_FONT}
          align="end"
          range={c.p10 != null && c.p90 != null ? { low: c.p10, high: c.p90 } : null}
          rangeSize={10.5}
        />
        <ArrowUpRight size={15} style={{ color: S.primary, opacity: 0.55 }}
          className="transition-opacity group-hover:opacity-100" />
      </span>
    </button>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: S.bg, color: S.onBg, fontFamily: BODY_FONT }}>
      <main className="max-w-[1180px] mx-auto px-6 md:px-8 py-10">

        {/* ── Masthead ──────────────────────────────────────────── */}
        <header className="flex items-start justify-between gap-6 flex-wrap mb-7">
          <div className="pl-5" style={{ borderLeft: `4px solid ${S.primary}` }}>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: S.onSurfaceVariant }}>
              Henkel Consumer Brands
            </div>
            <h1 className="font-extrabold tracking-tight mt-1"
              style={{ fontFamily: HEADLINE_FONT, color: S.onBg, fontSize: '2rem', lineHeight: 1.1 }}>
              Profit Pool — Executive Summary
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            {asOf && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ backgroundColor: S.surface, border: `1px solid ${S.cardBorder}`, color: S.onSurfaceVariant, fontSize: 11.5, fontWeight: 600 }}>
                <Clock size={12} /> As of {asOf}
              </span>
            )}
            {seedStability && seedStability.headline_median_spread != null && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ backgroundColor: S.surface, border: `1px solid ${S.cardBorder}`, color: S.onSurfaceVariant, fontSize: 11.5, fontWeight: 600 }}
                title={`Headline median spread across ${seedStability.n_chains} independently-seeded chains`}>
                <GitBranch size={12} /> Seed-stable ±{(seedStability.headline_median_spread * 100 / 2).toFixed(2)}pp
              </span>
            )}
            {runId != null && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ backgroundColor: S.surfaceContainer, color: S.onPrimaryContainer, fontSize: 11.5, fontWeight: 600 }}>
                <Database size={12} /> Run #{runId}
              </span>
            )}
          </div>
        </header>

        {/* ── Hero answer ───────────────────────────────────────── */}
        <section
          className="rounded-3xl px-7 py-8 md:px-10 md:py-9 mb-6"
          style={{ backgroundColor: S.surface, border: `1px solid ${S.cardBorder}`,
            boxShadow: '0 22px 70px -26px rgba(0, 52, 94, 0.26)' }}
        >
          <div className="flex flex-wrap items-start justify-between gap-x-12 gap-y-7">
            <div className="min-w-[280px]">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] mb-2"
                style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>
                Portfolio profit-pool shift · by {summary.horizon}
              </div>
              <ShiftValue
                value={summary.med}
                size={80}
                fontFamily={HEADLINE_FONT}
                range={summary.p10 != null && summary.p90 != null ? { low: summary.p10, high: summary.p90 } : null}
                rangeLabel={summary.joint
                  ? 'P10–P90 · 80% of outcomes (joint portfolio)'
                  : 'P10–P90 · cat-weighted (pre-2.8 run)'}
                rangeSize={14}
              />
            </div>

            {/* Portfolio trajectory */}
            <div className="flex-1 min-w-[320px]">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2"
                style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>
                Weighted portfolio path · {YEARS[0]}–{summary.horizon}
              </div>
              <Trajectory path={summary.path} />
            </div>
          </div>

          <p className="text-[14.5px] mt-7 pt-6" style={{ color: S.onSurfaceVariant, lineHeight: 1.6, borderTop: `1px solid ${S.cardBorder}` }}>
            By {summary.horizon}, the weighted Henkel Consumer Brands profit pool is projected to{' '}
            {summary.med != null && summary.med >= 0 ? 'expand' : 'contract'} by{' '}
            <strong style={{ color: summary.med != null && summary.med >= 0 ? EXPANSION : CONTRACTION }}>{fmtShift(summary.med)}</strong>{' '}
            versus 2025
            {summary.p10 != null && summary.p90 != null && (
              <> — with 80% of simulated outcomes between{' '}
              <strong style={{ color: S.onSurface }}>{fmtShift(summary.p10)}</strong> and{' '}
              <strong style={{ color: S.onSurface }}>{fmtShift(summary.p90)}</strong></>
            )}
            . {summary.expanding} of {summary.total} categories expand, {summary.contracting} contract.
            Figures are Monte-Carlo medians;{' '}
            {summary.joint
              ? 'the band is the joint portfolio P10–P90, computed per-iteration from raw samples.'
              : 'the band is the category-weighted P10–P90 of a pre-2.8 run — an indicative portfolio range, not a joint percentile.'}
            {' '}Ceteris paribus: assumes no management response — totals read as exposure if nobody
            acts, not as forecast outcomes.
          </p>
        </section>

        {/* ── Where the pool moves ──────────────────────────────── */}
        <section className="grid gap-5 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))' }}>
          <div className="rounded-3xl px-6 py-6" style={{ backgroundColor: S.surface, border: `1px solid ${S.cardBorder}` }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center justify-center rounded-lg" style={{ width: 26, height: 26, backgroundColor: 'rgba(31,122,61,0.10)', color: EXPANSION }}>
                <ArrowUpRight size={15} />
              </span>
              <h2 className="text-[13px] font-bold uppercase tracking-[0.12em]" style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}>
                Where the pool grows
              </h2>
            </div>
            <div className="flex flex-col gap-2.5">
              {summary.topUp.length > 0
                ? summary.topUp.map((c, i) => <MoverRow key={c.id} c={c} rank={i + 1} />)
                : <p className="text-[13px]" style={{ color: S.mutedText }}>No category expands at the horizon.</p>}
            </div>
          </div>
          <div className="rounded-3xl px-6 py-6" style={{ backgroundColor: S.surface, border: `1px solid ${S.cardBorder}` }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center justify-center rounded-lg" style={{ width: 26, height: 26, backgroundColor: 'rgba(159,64,61,0.10)', color: CONTRACTION }}>
                <ArrowUpRight size={15} style={{ transform: 'rotate(90deg)' }} />
              </span>
              <h2 className="text-[13px] font-bold uppercase tracking-[0.12em]" style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}>
                Where it shrinks
              </h2>
            </div>
            <div className="flex flex-col gap-2.5">
              {summary.topDown.length > 0
                ? summary.topDown.map((c, i) => <MoverRow key={c.id} c={c} rank={i + 1} />)
                : <p className="text-[13px]" style={{ color: S.mutedText }}>No category contracts at the horizon.</p>}
            </div>
          </div>
        </section>

        {/* ── At a glance ───────────────────────────────────────── */}
        <section className="grid gap-3 mb-7" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <StatTile label="Horizon" value={`${YEARS[0]}–${summary.horizon}`} />
          <StatTile label="Categories expanding" value={`${summary.expanding} / ${summary.total}`} valueColor={EXPANSION} />
          <StatTile label="Categories contracting" value={`${summary.contracting} / ${summary.total}`} valueColor={CONTRACTION} />
          <StatTile label="Trends modelled" value={String(trends?.length || 99)} />
          <StatTile label="MC iterations" value={iterations != null ? `${Math.round(iterations / 1000)}k` : '50k'} />
        </section>

        {/* ── Explore further ───────────────────────────────────── */}
        <section className="mb-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] mb-3" style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>
            Explore the analysis
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
            <ExploreCard icon={BarChart3} title="The shift matrix" desc="12 categories × 10 years, four lenses. Drill into any category." onClick={onNavigateMatrix} />
            <ExploreCard icon={Activity} title="Trends & forces" desc="The 99 trends across 6 strategic forces that drive the shifts." onClick={onNavigateTrends} />
            <ExploreCard icon={MapIcon} title="Consumer journey" desc="White-space and where the pool is migrating along the journey." onClick={onNavigateJourney} />
            <ExploreCard icon={Lightbulb} title="Innovation ideas" desc="Directional concepts synthesised from the signals. Beta." onClick={onNavigateInnovation} beta />
          </div>
        </section>

        {/* ── Footnote ──────────────────────────────────────────── */}
        <p className="text-[11.5px] mt-6" style={{ color: S.mutedText, lineHeight: 1.6 }}>
          Source: latest persisted PRISM run{runId != null ? ` (#${runId})` : ''}{asOf ? ` · as of ${asOf}` : ''}. Bayesian Monte-Carlo engine,
          {iterations != null ? ` ${Math.round(iterations / 1000)}k` : ' 50k'} iterations. Values are cumulative shifts vs 2025 at the
          measurement year. Figures shown to one decimal;{' '}
          {summary.joint
            ? 'the portfolio band is the joint P10–P90 (per-iteration, 2.8.0+).'
            : 'the portfolio band is the category-weighted P10–P90 (pre-2.8 run).'}
        </p>
      </main>
    </div>
  );
};

// ─── Stat tile ───────────────────────────────────────────────────────
const StatTile: FC<{ label: string; value: string; valueColor?: string }> = ({ label, value, valueColor }) => (
  <div className="rounded-2xl px-4 py-3.5" style={{ backgroundColor: S.surface, border: `1px solid ${S.cardBorder}` }}>
    <div className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>{label}</div>
    <div className="text-[20px] font-extrabold tabular-nums mt-1" style={{ color: valueColor ?? S.onBg, fontFamily: HEADLINE_FONT, lineHeight: 1.1 }}>{value}</div>
  </div>
);

// ─── Explore card ────────────────────────────────────────────────────
const ExploreCard: FC<{ icon: LucideIcon; title: string; desc: string; onClick?: () => void; beta?: boolean }> = ({ icon: Icon, title, desc, onClick, beta }) => (
  <button type="button" onClick={onClick}
    className="group flex flex-col items-start text-left rounded-2xl px-5 py-5 transition-all"
    style={{ backgroundColor: S.surface, border: `1px solid ${S.cardBorder}`, cursor: 'pointer' }}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = S.cardBorderStrong; e.currentTarget.style.boxShadow = '0 12px 36px -16px rgba(0,52,94,0.20)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = S.cardBorder; e.currentTarget.style.boxShadow = 'none'; }}
  >
    <span className="flex items-center justify-between w-full mb-3">
      <span className="inline-flex items-center justify-center rounded-xl" style={{ width: 34, height: 34, backgroundColor: S.surfaceLow, color: S.primary }}>
        <Icon size={17} />
      </span>
      <ArrowUpRight size={16} style={{ color: S.primary, opacity: 0.5 }} className="transition-opacity group-hover:opacity-100" />
    </span>
    <span className="flex items-center gap-2">
      <span className="text-[14.5px] font-bold" style={{ color: S.onBg, fontFamily: HEADLINE_FONT }}>{title}</span>
      {beta && <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: S.surfaceLow, color: S.mutedText }}>Beta</span>}
    </span>
    <span className="text-[12.5px] mt-1" style={{ color: S.onSurfaceVariant, lineHeight: 1.5 }}>{desc}</span>
  </button>
);

// ─── Portfolio trajectory (band + median, responsive SVG) ────────────
const Trajectory: FC<{ path: Array<{ year: number; median: number | null; p10: number | null; p90: number | null }> }> = ({ path }) => {
  const pts = path.filter((p) => p.median != null) as Array<{ year: number; median: number; p10: number | null; p90: number | null }>;
  const W = 560, H = 150, padX = 8, padTop = 12, padBot = 22;
  if (pts.length < 2) return null;

  const lows = pts.map((p) => (p.p10 != null ? p.p10 : p.median));
  const highs = pts.map((p) => (p.p90 != null ? p.p90 : p.median));
  let yMin = Math.min(0, ...lows, ...pts.map((p) => p.median));
  let yMax = Math.max(0, ...highs, ...pts.map((p) => p.median));
  if (yMin === yMax) { yMin -= 0.01; yMax += 0.01; }
  const pad = (yMax - yMin) * 0.12; yMin -= pad; yMax += pad;

  const x = (i: number) => padX + (i * (W - padX * 2)) / (pts.length - 1);
  const y = (v: number) => padTop + (1 - (v - yMin) / (yMax - yMin)) * (H - padTop - padBot);
  const term = pts[pts.length - 1]!.median;
  const lineColor = shiftColor(term);

  const hasBand = pts.every((p) => p.p10 != null && p.p90 != null);
  const bandPath = hasBand
    ? `M ${pts.map((p, i) => `${x(i).toFixed(1)},${y(p.p90 as number).toFixed(1)}`).join(' L ')} `
      + `L ${pts.map((p, i) => `${x(pts.length - 1 - i).toFixed(1)},${y(pts[pts.length - 1 - i]!.p10 as number).toFixed(1)}`).join(' L ')} Z`
    : '';
  const medianLine = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.median).toFixed(1)}`).join(' ');
  const zeroY = y(0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img"
      aria-label="Portfolio profit-pool trajectory with P10–P90 band">
      {/* zero baseline */}
      <line x1={padX} x2={W - padX} y1={zeroY} y2={zeroY} stroke={S.cardBorderStrong} strokeWidth={1} strokeDasharray="3 3" />
      <text x={padX} y={zeroY - 4} fill={S.mutedText} fontSize={9} fontFamily={BODY_FONT}>0%</text>
      {/* band */}
      {hasBand && <path d={bandPath} fill={lineColor} opacity={0.12} />}
      {/* median line */}
      <polyline points={medianLine} fill="none" stroke={lineColor} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {/* endpoint dot */}
      <circle cx={x(pts.length - 1)} cy={y(term)} r={3.5} fill={lineColor} />
      {/* year ticks (first / mid / last) */}
      {[0, Math.floor((pts.length - 1) / 2), pts.length - 1].map((i) => (
        <text key={i} x={x(i)} y={H - 6} fill={S.mutedText} fontSize={9} fontFamily={BODY_FONT}
          textAnchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}>{pts[i]!.year}</text>
      ))}
    </svg>
  );
};

export default ExecutiveSummary;
