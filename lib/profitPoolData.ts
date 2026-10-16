/**
 * The Profit Pool Explorer's shape and arithmetic: the profit pool views of
 * the Hair and the Laundry & Home Care industries on a GP1 basis, every
 * figure sourced and graded.
 *
 * The views themselves are not in the bundle. They live in
 * data/content/profit_pools.json (the hand-authored source), which the API
 * serves to a signed-in user with a role (GET /api/v1/explorer); the Explorer
 * fetches them on its first open and runs the functions below on what it
 * fetched. This module holds the types, the horizon, the rating ladders and
 * the pool arithmetic.
 *
 * Pool development is the headline. Each row carries a revenue CAGR and a
 * structured GP1 margin drift over the horizon (gp1DeltaBps), and the growth
 * of the pool (the bar's area, revenue × GP1) derives from both:
 *    poolCAGR = (1 + revenueCAGR) × (1 + marginCAGR) − 1
 * where marginCAGR = (GP1_end / GP1_now)^(1/H) − 1 over the H-year horizon
 * (FY2025 base → 2030). The chart arrows encode poolCAGR: the development of
 * the pool, not revenue alone.
 *
 * Every source is a clickable URL whose page shows the cited figure, and every
 * figure carries an evidence grade: 'reported' (the figure as published at the
 * URL), 'derived' (arithmetic on published figures, basis stated) or
 * 'estimate' (structured judgment, basis stated).
 *
 * GP1 is not reported gross margin. GP1 / CM1 (net sales − direct COGS) is not
 * disclosed by any player at tier level, so tier GP1 values are PRISM
 * structured estimates calibrated against the verified company-level gross
 * margins linked on each row: graded 'derived' or 'estimate', never
 * 'reported', unless the company-level figure itself is shown. L'Oréal
 * discloses division operating margins, not segment gross margins, so its
 * group gross margin is the anchor.
 *
 * The category views follow Euromonitor Passport's category tree, so an
 * internal Passport extract drops in 1:1: Hair (Shampoos, Conditioners &
 * Treatments, Colourants, Styling Agents, Salon Professional, 2-in-1, Hair
 * Loss Treatments, Perms & Relaxants) and Home Care (Laundry Detergents /
 * Fabric Softeners / Laundry Aids, Hand & Auto Dishwashing, Surface, Toilet,
 * Bleach, Polishes, Home Insecticides, Air Care). Passport values are
 * licence-restricted, so every category size is a public triangulation at
 * RSP, graded derived or estimate (never reported), with its full derivation
 * in the source label and `detail`, which the source-chip hover shows. Once
 * the sizes are confirmed against Passport internally, updating the market
 * anchors in the JSON flips those grades to reported.
 *
 * Source ladder: 1 Euromonitor (RSP), 2 Kline for professional hair
 * (manufacturer-level salon sales), 3 Circana / NielsenIQ (scanner POS,
 * tracked channels), 4 company filings (MSP), 5 tier-2 firms only where all
 * of the above are silent.
 *
 * Denominations: SourceRef.denomination is RSP, MSP, scanner-POS, salon-mfr
 * or model. Pools are stated at RSP; filings are MSP (RSP ≈ 1.8–2.2× MSP,
 * which is the value-chain views' "brand-owner net sales ≈ 50% of retail
 * value" bridge); Kline's professional-hair values are salon-manufacturer
 * level and are never summed with RSP bars.
 *
 * Currency: display figures are EUR, converted from USD sources at a planning
 * rate of EUR/USD 1.15. Source citations keep the original USD figures exactly
 * as published: converting a quote would misquote it.
 *
 * Base years: public market reports mix 2023–2026 bases; each source label
 * carries its base year. The horizon for all development arrows is ~5 years
 * (≈2025 → 2030).
 *
 * The Explorer is the one view built on amounts of money; elsewhere an amount
 * appears only as quoted evidence in a text (a driver's description or
 * sources, a Consumer Journey tile), and the Shift Analysis stays relative
 * (percent only).
 */

import { NO_VALUE, type CategoryGroup } from '@/lib/format';

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export type PoolViewId =
  | 'hair_value_chain'
  | 'laundry_value_chain'
  | 'hair_categories'
  | 'hair_core_adjacent'
  | 'home_care_categories'
  | 'laundry_core_adjacent';

/** The industry a view covers: Hair, or Laundry & Home Care. */
export type PoolGroup = CategoryGroup;
export type PoolViewKind = 'ValueChain' | 'Categories' | 'CoreAdjacent';

/** Evidence grade of a figure: reported, derived or estimate (see the header). */
export type EvidenceGrade = 'reported' | 'derived' | 'estimate';

/** Value basis of a cited figure. RSP = retail selling price
 *  (Euromonitor basis: consumer prices incl. sales tax, all channels);
 *  MSP = manufacturer net sales; scanner-POS = Circana/NIQ tracked-channel
 *  retail; salon-mfr = Kline professional manufacturer-level; model =
 *  modelled market (e.g. Statista CMO). Mixed denominations must never
 *  be summed in one view. */
export type Denomination = 'RSP' | 'MSP' | 'scanner-POS' | 'salon-mfr' | 'model';

export interface SourceRef {
  /** The source, a colon, then the cited figure: "P&G FY2025 8-K: gross margin 51.2%".
   *  The explorer's source chip reads the name before the first ": ". */
  label: string;
  /** Clickable URL; the cited figure is visible on this page. */
  url: string;
  /** Optional basis note: what was taken from the page and how it is used.
   *  For a triangulated category size, the full derivation, shown in the
   *  source-chip hover. */
  detail?: string;
  grade: EvidenceGrade;
  /** Value basis of the cited figure, where it matters for the sizing. */
  denomination?: Denomination;
}

export interface PoolItem {
  id: string;
  label: string;
  sublabel?: string;
  /** Share of the view's revenue pool (decimal), normalised per view. */
  revenueShare: number;
  /** GP1 / Contribution Margin 1 today (decimal), calibrated against the linked filings. */
  gp1Margin: number;
  /** Forward revenue CAGR (decimal), per the revenue sources. */
  revenueCAGR: number;
  /** Expected GP1 drift over the horizon, in basis points (+150 = +1.5 pp by 2030). */
  gp1DeltaBps: number;
  /** One-line driver behind the revenue trajectory. */
  revenueDriver: string;
  /** One-line driver behind the margin trajectory. */
  marginDriver: string;
  note?: string;
  sources: {
    revenue: SourceRef[];
    margin: SourceRef[];
  };
}

export interface PoolView {
  id: PoolViewId;
  title: string;
  subtitle: string;
  /** Display label for the revenue pool, e.g. "~€77bn". */
  poolSize: string;
  /** Numeric revenue pool in €bn (planning rate 1.15) for the € math in the UI. */
  poolSizeEurBn: number;
  group: PoolGroup;
  kind: PoolViewKind;
  /** Rows in the authored order: value chain raw to retail, categories by logic, CORE first. */
  items: PoolItem[];
  /** How the shares and the pool of this view are built: the audit trail. */
  construction: string;
  insights: string[];
}

// ═══════════════════════════════════════════════════════════════════
// Horizon and derived pool math, shared by every view
// ═══════════════════════════════════════════════════════════════════

/** Development horizon in years (FY2025 base → 2030 outlook). */
export const POOL_HORIZON_YEARS = 5;
export const POOL_HORIZON_LABEL = 'FY2025 → 2030';

/** GP1 margin at the end of the horizon (decimal). */
export function gp1Terminal(item: Pick<PoolItem, 'gp1Margin' | 'gp1DeltaBps'>): number {
  return Math.max(0.01, item.gp1Margin + item.gp1DeltaBps / 10000);
}

/**
 * Profit-pool CAGR, the growth rate of the pool AREA (revenue × GP1):
 *   poolCAGR = (1 + revenueCAGR) × (1 + marginCAGR) − 1
 * with marginCAGR = (GP1_end / GP1_now)^(1/H) − 1.
 */
export function poolCagr(
  item: Pick<PoolItem, 'revenueCAGR' | 'gp1Margin' | 'gp1DeltaBps'>,
  years: number = POOL_HORIZON_YEARS,
): number {
  const marginCagr = Math.pow(gp1Terminal(item) / item.gp1Margin, 1 / years) - 1;
  return (1 + item.revenueCAGR) * (1 + marginCagr) - 1;
}

/** Revenue pool of one item in €bn (view pool × share). */
export function itemRevenueEurBn(view: PoolView, item: PoolItem): number {
  const total = view.items.reduce((s, it) => s + it.revenueShare, 0) || 1;
  return view.poolSizeEurBn * (item.revenueShare / total);
}

/** GP1 profit pool of one item in €bn today. */
export function itemGp1PoolEurBn(view: PoolView, item: PoolItem): number {
  return itemRevenueEurBn(view, item) * item.gp1Margin;
}

/** GP1 profit pool of one item in €bn at the end of the horizon. */
export function itemGp1PoolEurBnTerminal(view: PoolView, item: PoolItem): number {
  return itemGp1PoolEurBn(view, item) * Math.pow(1 + poolCagr(item), POOL_HORIZON_YEARS);
}

/** View-level GP1 pool (€bn) today and at horizon end, plus the weighted pool CAGR. */
export function viewPoolSummary(view: PoolView): {
  gp1PoolNowEurBn: number;
  gp1PoolTerminalEurBn: number;
  weightedPoolCagr: number;
} {
  const now = view.items.reduce((s, it) => s + itemGp1PoolEurBn(view, it), 0);
  const terminal = view.items.reduce((s, it) => s + itemGp1PoolEurBnTerminal(view, it), 0);
  const weightedPoolCagr = now > 0 ? Math.pow(terminal / now, 1 / POOL_HORIZON_YEARS) - 1 : 0;
  return { gp1PoolNowEurBn: now, gp1PoolTerminalEurBn: terminal, weightedPoolCagr };
}

// ═══════════════════════════════════════════════════════════════════
// Rating ladders: the shared arrow vocabulary (↑ / ↓ / ↔, 1–3 glyphs)
// ═══════════════════════════════════════════════════════════════════

export interface CagrRating {
  direction: 'up' | 'down' | 'flat';
  arrows: 0 | 1 | 2 | 3;
  label: string;
  tone: 'green' | 'red' | 'grey';
}

/**
 * POOL development ladder (nominal USD/EUR terms). Calibrated so the
 * three bands separate harvest / hold / invest conversations:
 *   |CAGR| < 0.5%   → flat
 *   0.5 – 3%        → 1 arrow
 *   3 – 6%          → 2 arrows
 *   ≥ 6%            → 3 arrows
 */
export const POOL_CAGR_THRESHOLDS = { flat: 0.005, one: 0.030, two: 0.060 } as const;

/**
 * REVENUE CAGR ladder (the drill-down decomposition):
 *   |CAGR| < 0.5% flat · 0.5–2% one · 2–5% two · ≥5% three.
 */
const CAGR_THRESHOLDS = { flat: 0.005, one: 0.020, two: 0.050 } as const;

function rate(
  value: number,
  t: { flat: number; one: number; two: number },
  fmt: (v: number) => string,
): CagrRating {
  if (!isFinite(value)) return { direction: 'flat', arrows: 0, label: NO_VALUE, tone: 'grey' };
  const abs = Math.abs(value);
  const label = fmt(value);
  if (abs < t.flat) return { direction: 'flat', arrows: 0, label, tone: 'grey' };
  const arrows: 1 | 2 | 3 = abs < t.one ? 1 : abs < t.two ? 2 : 3;
  return value > 0
    ? { direction: 'up', arrows, label, tone: 'green' }
    : { direction: 'down', arrows, label, tone: 'red' };
}

const pctFmt = (v: number) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;

/** Rating for a POOL development CAGR (chart arrows use this). */
export function toPoolRating(cagr: number): CagrRating {
  return rate(cagr, POOL_CAGR_THRESHOLDS, pctFmt);
}

/** Rating for a REVENUE CAGR (drill-down decomposition row). */
export function toCagrRating(cagr: number): CagrRating {
  return rate(cagr, CAGR_THRESHOLDS, pctFmt);
}

/**
 * GP1 margin drift ladder, in basis points over the horizon:
 *   |Δ| < 25bps flat · 25–75 one · 75–125 two · ≥125 three.
 */
const GP1_DRIFT_THRESHOLDS = { flat: 25, one: 75, two: 125 } as const;

const bpsFmt = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v)}bps`;

/** Rating for a GP1 margin drift in basis points (drill-down decomposition row). */
export function toGp1Rating(deltaBps: number): CagrRating {
  return rate(deltaBps, GP1_DRIFT_THRESHOLDS, bpsFmt);
}
