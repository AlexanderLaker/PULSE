/**
 * PRISM — Profit Pool Explorer data (Bain-style: X = revenue, Y = profitability, area = profit)
 *
 * Source philosophy (see Profit_Pool_Explorer_Concept.docx, Section 5 "Source Library"):
 *   • Tier A (HIGH):  Henkel Annual Report 2025, capital-markets slides, HCB segment disclosure
 *   • Tier B (MED):   Euromonitor (2024/25), Nielsen, Kantar Worldpanel, Circana
 *   • Tier C (MED-LO):Company filings of peers (P&G, Unilever, L'Oréal, Reckitt, Church & Dwight)
 *   • Tier D (LO):    Triangulation / Bain-internal benchmarks / expert interviews
 *
 * All numbers are INDICATIVE model values for the dashboard narrative — they are
 * the output of a triangulation across Tier A/B/C/D sources (see `sources` array
 * on each category). Final numbers should be reconciled with Henkel MTP.
 *
 * Units:
 *   • revenueBn   — global category revenue in €bn (end-consumer / RSP basis)
 *   • ebitMargin  — category EBIT margin (decimal). Proxy for "profitability" on Y-axis.
 *                   This is INDUSTRY POOL profitability, not Henkel's realized margin.
 *   • henkelShare — Henkel's estimated global value share in the category (decimal)
 *
 * Derived:
 *   • profitBn  = revenueBn × ebitMargin          → area on the Bain chart
 *   • henkelRevenueBn  = revenueBn × henkelShare  → Henkel footprint overlay
 */

import type { CategoryId } from '@/types';

// ─── Source citation type ─────────────────────────────────────────
export interface ProfitPoolSource {
  /** Short handle shown in tooltip — e.g. "Henkel AR 2025" */
  label: string;
  /** A | B | C | D confidence tier (per concept doc §5) */
  tier: 'A' | 'B' | 'C' | 'D';
  /** What this source contributed — "revenue", "margin", "share", "triangulation" */
  contributes: 'revenue' | 'margin' | 'share' | 'triangulation';
  /** Optional public reference */
  ref?: string;
}

// ─── Per-category profit-pool datum ───────────────────────────────
export interface CategoryProfitPool {
  id: CategoryId;
  /** Full display label — "Hair: Color" */
  name: string;
  /** One-liner for tooltip */
  shortDescription: string;
  /** Business unit — drives Hair/Laundry toggle */
  group: 'Hair' | 'LHC';
  /** X axis — global category revenue in €bn (2025 basis) */
  revenueBn: number;
  /** Y axis — industry EBIT margin proxy (decimal) */
  ebitMargin: number;
  /** Henkel global value share (decimal) — for Henkel footprint overlay */
  henkelShare: number;
  /** 5y CAGR historical (decimal) — context only */
  historical5yCAGR: number;
  /** Forward-looking CAGR point estimate (decimal) — narrative only, NOT used for shift */
  forwardCAGR: number;
  /** Stack of sources behind this cell */
  sources: ProfitPoolSource[];
}

// Default source refs — reused across many categories
const SRC = {
  henkelAR:    { label: 'Henkel AR 2025',        tier: 'A' as const, ref: 'Henkel Annual Report 2025 (HCB segment)' },
  henkelCMS:   { label: 'Henkel CMD 2025',       tier: 'A' as const, ref: 'Henkel Capital Markets Day 2025' },
  euromonitor: { label: 'Euromonitor 2024/25',   tier: 'B' as const, ref: 'Euromonitor International — global category sizing, 2024/25 release' },
  nielsen:     { label: 'Nielsen 2024',          tier: 'B' as const, ref: 'NielsenIQ — global track, 2024' },
  kantar:      { label: 'Kantar Worldpanel 2024',tier: 'B' as const, ref: 'Kantar Worldpanel — household panel 2024' },
  circana:     { label: 'Circana 2024',          tier: 'B' as const, ref: 'Circana — US retail scan, 2024' },
  pgAR:        { label: 'P&G AR 2025',           tier: 'C' as const, ref: 'Procter & Gamble 10-K FY25' },
  ulAR:        { label: 'Unilever AR 2024',      tier: 'C' as const, ref: 'Unilever Annual Report 2024' },
  lorealAR:    { label: "L'Oréal AR 2024",       tier: 'C' as const, ref: "L'Oréal Annual Financial Report 2024" },
  reckittAR:   { label: 'Reckitt AR 2024',       tier: 'C' as const, ref: 'Reckitt Benckiser Annual Report 2024' },
  colgateAR:   { label: 'Colgate AR 2024',       tier: 'C' as const, ref: 'Colgate-Palmolive 10-K 2024' },
  churchAR:    { label: 'Church & Dwight AR',    tier: 'C' as const, ref: 'Church & Dwight 10-K 2024' },
  bain:        { label: 'Bain triangulation',    tier: 'D' as const, ref: 'Bain internal benchmark & expert interviews, Apr 2026' },
};

// ─── Category data ────────────────────────────────────────────────
//
// Revenue figures are global industry pool sizes (RSP basis). EBIT margins
// are industry-average — they are the Y-axis value for the Bain pool chart.
// Henkel's realized margin differs; we show Henkel footprint as an overlay.

export const PROFIT_POOL_DATA: CategoryProfitPool[] = [
  // ── HAIR (4 cats) ──────────────────────────────────────────────
  {
    id: 'hair_color',
    name: 'Hair: Color',
    shortDescription: 'Permanent, semi-perm, root touch-up — consumer & professional',
    group: 'Hair',
    revenueBn: 24.5,
    ebitMargin: 0.185,
    henkelShare: 0.235,
    historical5yCAGR: 0.028,
    forwardCAGR: 0.036,
    sources: [
      { ...SRC.henkelAR,    contributes: 'share' },
      { ...SRC.euromonitor, contributes: 'revenue' },
      { ...SRC.lorealAR,    contributes: 'margin' },
      { ...SRC.bain,        contributes: 'triangulation' },
    ],
  },
  {
    id: 'hair_care',
    name: 'Hair: Care',
    shortDescription: 'Shampoo, conditioner, treatments, scalp care',
    group: 'Hair',
    revenueBn: 38.2,
    ebitMargin: 0.168,
    henkelShare: 0.076,
    historical5yCAGR: 0.041,
    forwardCAGR: 0.048,
    sources: [
      { ...SRC.euromonitor, contributes: 'revenue' },
      { ...SRC.henkelAR,    contributes: 'share' },
      { ...SRC.pgAR,        contributes: 'margin' },
      { ...SRC.ulAR,        contributes: 'margin' },
      { ...SRC.bain,        contributes: 'triangulation' },
    ],
  },
  {
    id: 'hair_styling',
    name: 'Hair: Styling',
    shortDescription: 'Mousse, gel, spray, wax — finishing & hold products',
    group: 'Hair',
    revenueBn: 9.8,
    ebitMargin: 0.152,
    henkelShare: 0.115,
    historical5yCAGR: -0.008,
    forwardCAGR: 0.012,
    sources: [
      { ...SRC.euromonitor, contributes: 'revenue' },
      { ...SRC.henkelAR,    contributes: 'share' },
      { ...SRC.lorealAR,    contributes: 'margin' },
      { ...SRC.bain,        contributes: 'triangulation' },
    ],
  },
  {
    id: 'hair_body',
    name: 'Hair: Body (Shower & Bath)',
    shortDescription: 'Body wash, shower gel, bar soap',
    group: 'Hair',
    revenueBn: 28.6,
    ebitMargin: 0.145,
    henkelShare: 0.062,
    historical5yCAGR: 0.032,
    forwardCAGR: 0.037,
    sources: [
      { ...SRC.euromonitor, contributes: 'revenue' },
      { ...SRC.henkelAR,    contributes: 'share' },
      { ...SRC.ulAR,        contributes: 'margin' },
      { ...SRC.colgateAR,   contributes: 'margin' },
      { ...SRC.bain,        contributes: 'triangulation' },
    ],
  },

  // ── LHC (8 cats) ───────────────────────────────────────────────
  {
    id: 'lhc_fcn',
    name: 'LHC: Fabric Cleaning — Non-concentrated (Liquid)',
    shortDescription: 'Mainstream liquid laundry detergent (non-compacted)',
    group: 'LHC',
    revenueBn: 34.8,
    ebitMargin: 0.165,
    henkelShare: 0.112,
    historical5yCAGR: -0.014,
    forwardCAGR: -0.008,
    sources: [
      { ...SRC.euromonitor, contributes: 'revenue' },
      { ...SRC.henkelAR,    contributes: 'share' },
      { ...SRC.pgAR,        contributes: 'margin' },
      { ...SRC.bain,        contributes: 'triangulation' },
    ],
  },
  {
    id: 'lhc_fca',
    name: 'LHC: Fabric Cleaning — Advanced (Pods/Capsules)',
    shortDescription: 'Unit-dose laundry — pods, capsules, sheets',
    group: 'LHC',
    revenueBn: 13.4,
    ebitMargin: 0.225,
    henkelShare: 0.098,
    historical5yCAGR: 0.082,
    forwardCAGR: 0.076,
    sources: [
      { ...SRC.euromonitor, contributes: 'revenue' },
      { ...SRC.henkelAR,    contributes: 'share' },
      { ...SRC.pgAR,        contributes: 'margin' },
      { ...SRC.circana,     contributes: 'revenue' },
      { ...SRC.bain,        contributes: 'triangulation' },
    ],
  },
  {
    id: 'lhc_ffi',
    name: 'LHC: Fabric Finishing (Softener, Boosters, Scents)',
    shortDescription: 'Fabric softener, scent boosters, in-wash boosters',
    group: 'LHC',
    revenueBn: 15.2,
    ebitMargin: 0.178,
    henkelShare: 0.058,
    historical5yCAGR: 0.018,
    forwardCAGR: 0.024,
    sources: [
      { ...SRC.euromonitor, contributes: 'revenue' },
      { ...SRC.henkelAR,    contributes: 'share' },
      { ...SRC.pgAR,        contributes: 'margin' },
      { ...SRC.ulAR,        contributes: 'margin' },
      { ...SRC.bain,        contributes: 'triangulation' },
    ],
  },
  {
    id: 'lhc_lad',
    name: 'LHC: Laundry Additives',
    shortDescription: 'Stain removers, bleach, pre-wash, boosters (non-softener)',
    group: 'LHC',
    revenueBn: 7.6,
    ebitMargin: 0.192,
    henkelShare: 0.125,
    historical5yCAGR: 0.022,
    forwardCAGR: 0.028,
    sources: [
      { ...SRC.euromonitor, contributes: 'revenue' },
      { ...SRC.henkelAR,    contributes: 'share' },
      { ...SRC.churchAR,    contributes: 'margin' },
      { ...SRC.reckittAR,   contributes: 'margin' },
      { ...SRC.bain,        contributes: 'triangulation' },
    ],
  },
  {
    id: 'lhc_hdw',
    name: 'LHC: Hand Dishwash',
    shortDescription: 'Manual dishwashing liquid',
    group: 'LHC',
    revenueBn: 14.8,
    ebitMargin: 0.158,
    henkelShare: 0.048,
    historical5yCAGR: 0.015,
    forwardCAGR: 0.012,
    sources: [
      { ...SRC.euromonitor, contributes: 'revenue' },
      { ...SRC.henkelAR,    contributes: 'share' },
      { ...SRC.colgateAR,   contributes: 'margin' },
      { ...SRC.pgAR,        contributes: 'margin' },
      { ...SRC.bain,        contributes: 'triangulation' },
    ],
  },
  {
    id: 'lhc_adw',
    name: 'LHC: Automatic Dishwash (ADW)',
    shortDescription: 'Dishwasher tabs, gels, rinse aid, salt',
    group: 'LHC',
    revenueBn: 7.8,
    ebitMargin: 0.235,
    henkelShare: 0.215,
    historical5yCAGR: 0.048,
    forwardCAGR: 0.052,
    sources: [
      { ...SRC.euromonitor, contributes: 'revenue' },
      { ...SRC.henkelAR,    contributes: 'share' },
      { ...SRC.reckittAR,   contributes: 'margin' },
      { ...SRC.pgAR,        contributes: 'margin' },
      { ...SRC.bain,        contributes: 'triangulation' },
    ],
  },
  {
    id: 'lhc_hsc',
    name: 'LHC: Home & Surface Care',
    shortDescription: 'All-purpose cleaners, bathroom, kitchen, glass, floor',
    group: 'LHC',
    revenueBn: 18.4,
    ebitMargin: 0.175,
    henkelShare: 0.038,
    historical5yCAGR: 0.026,
    forwardCAGR: 0.030,
    sources: [
      { ...SRC.euromonitor, contributes: 'revenue' },
      { ...SRC.henkelAR,    contributes: 'share' },
      { ...SRC.reckittAR,   contributes: 'margin' },
      { ...SRC.churchAR,    contributes: 'margin' },
      { ...SRC.bain,        contributes: 'triangulation' },
    ],
  },
  {
    id: 'lhc_ic',
    name: 'LHC: Insect Control',
    shortDescription: 'Repellents, sprays, traps (household)',
    group: 'LHC',
    revenueBn: 5.2,
    ebitMargin: 0.218,
    henkelShare: 0.032,
    historical5yCAGR: 0.038,
    forwardCAGR: 0.045,
    sources: [
      { ...SRC.euromonitor, contributes: 'revenue' },
      { ...SRC.henkelAR,    contributes: 'share' },
      { ...SRC.reckittAR,   contributes: 'margin' },
      { ...SRC.bain,        contributes: 'triangulation' },
    ],
  },
];

// ─── Derived helpers ──────────────────────────────────────────────

/** Profit pool (€bn) for a category = revenue × EBIT margin. */
export function profitBn(cat: CategoryProfitPool): number {
  return cat.revenueBn * cat.ebitMargin;
}

/** Henkel revenue footprint (€bn) = global revenue × Henkel share. */
export function henkelRevenueBn(cat: CategoryProfitPool): number {
  return cat.revenueBn * cat.henkelShare;
}

/** Henkel profit footprint (€bn) — indicative, assumes industry avg margin. */
export function henkelProfitBn(cat: CategoryProfitPool): number {
  return henkelRevenueBn(cat) * cat.ebitMargin;
}

/** Total BU profit pool. */
export function totalProfitBn(cats: CategoryProfitPool[]): number {
  return cats.reduce((s, c) => s + profitBn(c), 0);
}

/** Total BU revenue pool. */
export function totalRevenueBn(cats: CategoryProfitPool[]): number {
  return cats.reduce((s, c) => s + c.revenueBn, 0);
}

// ─── View / toggle types ──────────────────────────────────────────

export type BuFilter = 'Both' | 'Hair' | 'LHC';
export type ViewMode = 'Category' | 'ValueChain' | 'Region';

/** Filter categories by business unit toggle. */
export function filterByBu(
  cats: CategoryProfitPool[],
  bu: BuFilter,
): CategoryProfitPool[] {
  if (bu === 'Both') return cats;
  if (bu === 'Hair') return cats.filter(c => c.group === 'Hair');
  return cats.filter(c => c.group === 'LHC');
}

// ─── PRISM shift integration ──────────────────────────────────────

type Shiftish = { median?: number } | number | undefined;

/** Pull the MC median shift (decimal) for a category at `year` from
 *  SimulationResult.shifts — tolerates string|number year keys and the
 *  dual "Hair: Color" / "hair_color" lookup convention used elsewhere
 *  in the codebase (see ProfitPoolAnalysis2.tsx::getYearShift). */
export function prismShiftFor(
  shifts: Record<string, Record<string | number, unknown>> | undefined,
  cat: CategoryProfitPool,
  year: number,
): number | null {
  if (!shifts) return null;
  const path = shifts[cat.name] ?? shifts[cat.id];
  if (!path) return null;
  const raw = (path[year] ?? path[String(year)]) as Shiftish;
  if (raw == null) return null;
  if (typeof raw === 'number') return raw;
  return typeof raw.median === 'number' ? raw.median : null;
}

/** Classify a shift into a qualitative direction label. */
export function classifyDirection(shift: number | null): {
  label: 'Strong tailwind' | 'Tailwind' | 'Neutral' | 'Headwind' | 'Strong headwind' | 'n/a';
  arrow: '↑↑' | '↑' | '→' | '↓' | '↓↓' | '—';
  tone: 'green-strong' | 'green' | 'neutral' | 'red' | 'red-strong' | 'muted';
} {
  if (shift == null || !isFinite(shift)) {
    return { label: 'n/a', arrow: '—', tone: 'muted' };
  }
  if (shift >=  0.030) return { label: 'Strong tailwind',  arrow: '↑↑', tone: 'green-strong' };
  if (shift >=  0.010) return { label: 'Tailwind',         arrow: '↑',  tone: 'green' };
  if (shift <= -0.030) return { label: 'Strong headwind',  arrow: '↓↓', tone: 'red-strong' };
  if (shift <= -0.010) return { label: 'Headwind',         arrow: '↓',  tone: 'red' };
  return { label: 'Neutral', arrow: '→', tone: 'neutral' };
}

/** Apply a PRISM shift (decimal) to today's profit pool to get the
 *  forward pool in €bn. `shift` is the relative change vs. today's baseline. */
export function shiftedProfitBn(cat: CategoryProfitPool, shift: number | null): number {
  const base = profitBn(cat);
  if (shift == null || !isFinite(shift)) return base;
  return base * (1 + shift);
}

// ═══════════════════════════════════════════════════════════════════
// PPTX-Aligned Slide Views  (6 toggles, one per slide in the deck)
// ───────────────────────────────────────────────────────────────────
// Reference margin = GP1 / Contribution Margin 1 (Net Sales - COGS),
// NOT EBIT. This is the lens Henkel HCB Category strategy uses.
// ═══════════════════════════════════════════════════════════════════

export type SlideId =
  | 'hair_value_chain'
  | 'laundry_value_chain'
  | 'hair_sub_segments'
  | 'hair_core_adjacent'
  | 'laundry_sub_segments'
  | 'laundry_core_adjacent';

export interface SlideItem {
  id: string;
  label: string;
  sublabel?: string;
  revenueShare: number;
  gp1Margin: number;
  forwardCAGR: number;
  note?: string;
  linkedCategoryId?: CategoryId | null;
}

export interface ProfitPoolSlide {
  id: SlideId;
  title: string;
  subtitle: string;
  poolSize: string;
  group: 'Hair' | 'LHC';
  kind: 'ValueChain' | 'SubSegment' | 'CoreAdjacent';
  items: SlideItem[];
  prismProxyCategories: CategoryId[];
  sources: string;
  insights: string[];
}

export const PROFIT_POOL_SLIDES: ProfitPoolSlide[] = [
  {
    id: 'hair_value_chain',
    title: 'Hair Care — Industry Value Chain Profit Pool',
    subtitle: 'AI-enhanced: margins sourced from public filings | Global ~$85B | FY 2024/25',
    poolSize: '~$85B',
    group: 'Hair',
    kind: 'ValueChain',
    prismProxyCategories: ['hair_color', 'hair_care', 'hair_styling', 'hair_body'],
    items: [
      { id: 'h_vc_1', label: 'Commodity',    sublabel: 'Chemicals',     revenueShare: 0.08, gp1Margin: 0.20, forwardCAGR: 0.020, note: 'BASF N&C' },
      { id: 'h_vc_2', label: 'Specialty',    sublabel: 'Ingredients',   revenueShare: 0.08, gp1Margin: 0.22, forwardCAGR: 0.040, note: 'Croda CC' },
      { id: 'h_vc_3', label: 'Fragrance',    sublabel: '& Actives',     revenueShare: 0.06, gp1Margin: 0.20, forwardCAGR: 0.045, note: 'Symrise' },
      { id: 'h_vc_4', label: 'Brand Owner',  sublabel: 'CPG',           revenueShare: 0.25, gp1Margin: 0.20, forwardCAGR: 0.030, note: 'P&G / Henkel' },
      { id: 'h_vc_5', label: 'Dist. /',      sublabel: 'Wholesale',     revenueShare: 0.07, gp1Margin: 0.04, forwardCAGR: 0.010 },
      { id: 'h_vc_6', label: 'Modern',       sublabel: 'Trade Retail',  revenueShare: 0.22, gp1Margin: 0.03, forwardCAGR: 0.015, note: 'Rewe / Edeka' },
      { id: 'h_vc_7', label: 'E-Com /',      sublabel: 'DTC',           revenueShare: 0.12, gp1Margin: 0.05, forwardCAGR: 0.075, linkedCategoryId: null },
      { id: 'h_vc_8', label: 'Professional', sublabel: '/ Salon',       revenueShare: 0.12, gp1Margin: 0.12, forwardCAGR: 0.035 },
    ],
    sources: 'BASF Q3 2024, Croda FY 24/25, Symrise FY 25, Henkel FY 24, P&G FY 24, S&P Grocery Peer Review 24, Edeka FY 24',
    insights: [
      'Brand Owners (~20%) and Specialty/Fragrance (17-22%) capture the lion\u2019s share — Retail is the margin desert at 3%',
      'Croda Consumer Care targets 25%+ op. margin — upstream specialty ingredients are a growing profit pool',
      'Henkel HCB adj. EBIT margin 13-14% vs. P&G ~22% — closing this gap is the transformation priority',
    ],
  },
  {
    id: 'laundry_value_chain',
    title: 'Laundry Care — Industry Value Chain Profit Pool',
    subtitle: 'AI-enhanced: margins sourced from public filings | Global ~$140B | FY 2024/25',
    poolSize: '~$140B',
    group: 'LHC',
    kind: 'ValueChain',
    prismProxyCategories: ['lhc_fcn', 'lhc_fca', 'lhc_ffi', 'lhc_lad'],
    items: [
      { id: 'l_vc_1', label: 'Commodity',   sublabel: 'Chemicals',      revenueShare: 0.14, gp1Margin: 0.10, forwardCAGR: 0.015 },
      { id: 'l_vc_2', label: 'Specialty',   sublabel: '(Enzymes)',      revenueShare: 0.05, gp1Margin: 0.20, forwardCAGR: 0.055, note: 'Novozymes' },
      { id: 'l_vc_3', label: 'Fragrance /', sublabel: 'Encapsulation',  revenueShare: 0.04, gp1Margin: 0.22, forwardCAGR: 0.060 },
      { id: 'l_vc_4', label: 'Brand Owner', sublabel: 'CPG',            revenueShare: 0.24, gp1Margin: 0.16, forwardCAGR: 0.025, note: 'Henkel / P&G' },
      { id: 'l_vc_5', label: 'Dist. /',     sublabel: 'Wholesale',      revenueShare: 0.08, gp1Margin: 0.06, forwardCAGR: 0.010 },
      { id: 'l_vc_6', label: 'Modern',      sublabel: 'Trade Retail',   revenueShare: 0.30, gp1Margin: 0.03, forwardCAGR: 0.010 },
      { id: 'l_vc_7', label: 'E-Com',                                    revenueShare: 0.06, gp1Margin: 0.05, forwardCAGR: 0.090 },
      { id: 'l_vc_8', label: 'Laundry',     sublabel: 'Services',       revenueShare: 0.05, gp1Margin: 0.10, forwardCAGR: 0.040 },
      { id: 'l_vc_9', label: 'Appliance',   sublabel: 'OEMs',           revenueShare: 0.04, gp1Margin: 0.08, forwardCAGR: 0.030 },
    ],
    sources: 'BASF FY 24, Novozymes FY 24 (est.), Symrise FY 25, Henkel FY 24, P&G FY 24, S&P Grocery Peer Review 24',
    insights: [
      'Structurally lower Brand Owner margins (16%) vs. Hair (20%) — higher PL pressure, more commoditized',
      'Specialty Enzymes (Novozymes) and Encapsulated Fragrance are hidden 20%+ margin pools upstream',
      'Modern Trade captures 30% of revenue but only ~7% of absolute profit — widest disconnect in the chain',
    ],
  },
  {
    id: 'hair_sub_segments',
    title: 'Hair Care — Sub-Segment Profit Pools',
    subtitle: 'Brand Owner deep dive | Revenue share & margin by product type | Global ~$85B',
    poolSize: '~$85B',
    group: 'Hair',
    kind: 'SubSegment',
    prismProxyCategories: ['hair_care', 'hair_color', 'hair_styling'],
    items: [
      { id: 'h_sub_1', label: 'Shampoo',                                       revenueShare: 0.35, gp1Margin: 0.13, forwardCAGR: 0.036, linkedCategoryId: 'hair_care' },
      { id: 'h_sub_2', label: 'Conditioner',                                   revenueShare: 0.18, gp1Margin: 0.14, forwardCAGR: 0.041, linkedCategoryId: 'hair_care' },
      { id: 'h_sub_3', label: 'Hair Color',                                    revenueShare: 0.12, gp1Margin: 0.23, forwardCAGR: 0.028, linkedCategoryId: 'hair_color' },
      { id: 'h_sub_4', label: 'Styling',                                       revenueShare: 0.10, gp1Margin: 0.17, forwardCAGR: 0.081, linkedCategoryId: 'hair_styling' },
      { id: 'h_sub_5', label: 'Treatments',                                    revenueShare: 0.08, gp1Margin: 0.26, forwardCAGR: 0.075, linkedCategoryId: 'hair_care' },
      { id: 'h_sub_6', label: 'Hair Loss',  sublabel: '/ Scalp',               revenueShare: 0.05, gp1Margin: 0.30, forwardCAGR: 0.062, linkedCategoryId: 'hair_care' },
      { id: 'h_sub_7', label: 'Hair Oil',                                      revenueShare: 0.05, gp1Margin: 0.16, forwardCAGR: 0.050, linkedCategoryId: 'hair_care' },
      { id: 'h_sub_8', label: 'Serums /',   sublabel: 'Leave-in',              revenueShare: 0.07, gp1Margin: 0.24, forwardCAGR: 0.085, linkedCategoryId: 'hair_care' },
    ],
    sources: 'Rev shares: Mordor Intelligence, Fortune BI, GM Insights 24/25 | Margins: Consulting Estimates',
    insights: [
      'Shampoo: volume engine (35%) but margin floor (~13%) — high PL penetration, price-anchored',
      'Hair Color: hidden champion (23% margin) — chemistry-intensive, high brand loyalty, low PL credibility',
      'Hair Loss/Scalp at 30% margin — fastest-expanding niche, quasi-OTC premium',
      'Schwarzkopf overweights Shampoo + Color. Underweight in high-margin Treatments, Serums, Scalp Care.',
    ],
  },
  {
    id: 'hair_core_adjacent',
    title: 'Hair Care — Core + Adjacent Profit Pools',
    subtitle: 'Core branded business vs. adjacent categories | Revenue shares relative to total market (~$130B)',
    poolSize: '~$130B',
    group: 'Hair',
    kind: 'CoreAdjacent',
    prismProxyCategories: ['hair_color', 'hair_care', 'hair_styling', 'hair_body'],
    items: [
      { id: 'h_ca_1', label: 'CORE',       sublabel: 'Hair Care (Branded)', revenueShare: 0.65, gp1Margin: 0.20, forwardCAGR: 0.035, linkedCategoryId: 'hair_care' },
      { id: 'h_ca_2', label: 'Salon',      sublabel: 'Professional',        revenueShare: 0.08, gp1Margin: 0.12, forwardCAGR: 0.045, linkedCategoryId: null },
      { id: 'h_ca_3', label: 'Hair Tools', sublabel: '& Appliances',        revenueShare: 0.06, gp1Margin: 0.28, forwardCAGR: 0.070, linkedCategoryId: null },
      { id: 'h_ca_4', label: 'Scalp',      sublabel: 'Dermocosmetics',      revenueShare: 0.03, gp1Margin: 0.30, forwardCAGR: 0.090, linkedCategoryId: 'hair_care' },
      { id: 'h_ca_5', label: 'Hair',       sublabel: 'Supplements',         revenueShare: 0.02, gp1Margin: 0.35, forwardCAGR: 0.120, linkedCategoryId: null },
      { id: 'h_ca_6', label: 'Salon',      sublabel: 'Services (B2C)',      revenueShare: 0.10, gp1Margin: 0.12, forwardCAGR: 0.030, linkedCategoryId: null },
      { id: 'h_ca_7', label: 'Men\u2019s',      sublabel: 'Grooming',            revenueShare: 0.04, gp1Margin: 0.20, forwardCAGR: 0.092, linkedCategoryId: 'hair_body' },
      { id: 'h_ca_8', label: 'Digital /',  sublabel: 'AI Diag.',            revenueShare: 0.01, gp1Margin: 0.40, forwardCAGR: 0.250, linkedCategoryId: null },
      { id: 'h_ca_9', label: 'Subscrip-',  sublabel: 'tion DTC',            revenueShare: 0.01, gp1Margin: 0.18, forwardCAGR: 0.150, linkedCategoryId: null },
    ],
    sources: 'Core: ~$85B (Euromonitor/GM Insights) | Adjacent: ~$45B est. | All adjacent margins: Consulting Estimates',
    insights: [
      'Core branded Hair Care (~$85B, 20% margin) dominates the total pool — adjacencies add ~$45B but at divergent margins',
      'Highest-margin adjacencies (Supplements 35%, Scalp Dermo 30%, Tools 28%) are small but fast-growing pools',
      'Salon Services is the largest adjacent pool by revenue but lowest margin (12%) — fragmented, labor-intensive',
      'Henkel opportunity: Adjacent high-margin pools (Scalp Dermo, Supplements) are natural Schwarzkopf extensions',
    ],
  },
  {
    id: 'laundry_sub_segments',
    title: 'Laundry Care — Sub-Segment Profit Pools',
    subtitle: 'Brand Owner deep dive | Revenue share & margin by format | Global ~$140B',
    poolSize: '~$140B',
    group: 'LHC',
    kind: 'SubSegment',
    prismProxyCategories: ['lhc_fcn', 'lhc_fca', 'lhc_ffi', 'lhc_lad'],
    items: [
      { id: 'l_sub_1', label: 'Powder',                                 revenueShare: 0.22, gp1Margin: 0.09, forwardCAGR: -0.015, linkedCategoryId: 'lhc_fcn' },
      { id: 'l_sub_2', label: 'Liquid',    sublabel: 'Detergent',       revenueShare: 0.28, gp1Margin: 0.14, forwardCAGR: 0.020,  linkedCategoryId: 'lhc_fcn' },
      { id: 'l_sub_3', label: 'Pods /',    sublabel: 'Caps',            revenueShare: 0.16, gp1Margin: 0.24, forwardCAGR: 0.085,  linkedCategoryId: 'lhc_fca' },
      { id: 'l_sub_4', label: 'Fabric',    sublabel: 'Softener',        revenueShare: 0.12, gp1Margin: 0.16, forwardCAGR: 0.025,  linkedCategoryId: 'lhc_ffi' },
      { id: 'l_sub_5', label: 'Stain',     sublabel: 'Remover',         revenueShare: 0.06, gp1Margin: 0.20, forwardCAGR: 0.030,  linkedCategoryId: 'lhc_lad' },
      { id: 'l_sub_6', label: 'Scent',     sublabel: 'Booster',         revenueShare: 0.05, gp1Margin: 0.28, forwardCAGR: 0.120,  linkedCategoryId: 'lhc_ffi' },
      { id: 'l_sub_7', label: 'Specialty', sublabel: '(Wool etc.)',     revenueShare: 0.04, gp1Margin: 0.20, forwardCAGR: 0.040,  linkedCategoryId: 'lhc_lad' },
      { id: 'l_sub_8', label: 'Bleach',                                 revenueShare: 0.04, gp1Margin: 0.07, forwardCAGR: 0.010,  linkedCategoryId: 'lhc_lad' },
      { id: 'l_sub_9', label: 'Eco /',     sublabel: 'Concentr.',       revenueShare: 0.03, gp1Margin: 0.15, forwardCAGR: 0.100,  linkedCategoryId: 'lhc_fca' },
    ],
    sources: 'Rev shares: Euromonitor proxied | Margins: Consulting Estimates via P&G/Henkel segment mix',
    insights: [
      'Pods/Caps: margin champion (24%, +8.5% CAGR) — premium format, low PL success rate',
      'Scent Boosters: hidden gem (28% margin, +12% CAGR) — pure indulgence, fragrance-driven, low material cost',
      'Powder shrinking at -1.5%/yr in dev. markets — still dominant in EM for affordability',
      'Persil Discs in highest-margin format. Opportunity: Scent Boosters + Eco Concentrates.',
    ],
  },
  {
    id: 'laundry_core_adjacent',
    title: 'Laundry Care — Core + Adjacent Profit Pools',
    subtitle: 'Core branded business vs. adjacent categories | Revenue shares relative to total market (~$260B)',
    poolSize: '~$260B',
    group: 'LHC',
    kind: 'CoreAdjacent',
    prismProxyCategories: ['lhc_fcn', 'lhc_fca', 'lhc_ffi', 'lhc_adw', 'lhc_hsc'],
    items: [
      { id: 'l_ca_1',  label: 'CORE',      sublabel: 'Laundry (Branded)',   revenueShare: 0.54, gp1Margin: 0.16, forwardCAGR: 0.025, linkedCategoryId: 'lhc_fcn' },
      { id: 'l_ca_2',  label: 'Dish-',     sublabel: 'washing (Auto)',      revenueShare: 0.09, gp1Margin: 0.18, forwardCAGR: 0.040, linkedCategoryId: 'lhc_adw' },
      { id: 'l_ca_3',  label: 'Surface',   sublabel: 'Cleaners',            revenueShare: 0.08, gp1Margin: 0.14, forwardCAGR: 0.035, linkedCategoryId: 'lhc_hsc' },
      { id: 'l_ca_4',  label: 'Air',       sublabel: 'Care',                revenueShare: 0.06, gp1Margin: 0.25, forwardCAGR: 0.060, linkedCategoryId: null },
      { id: 'l_ca_5',  label: 'Dish-',     sublabel: 'washing (Hand)',      revenueShare: 0.05, gp1Margin: 0.14, forwardCAGR: 0.015, linkedCategoryId: 'lhc_hdw' },
      { id: 'l_ca_6',  label: 'Textile',   sublabel: 'Care',                revenueShare: 0.02, gp1Margin: 0.20, forwardCAGR: 0.050, linkedCategoryId: 'lhc_ffi' },
      { id: 'l_ca_7',  label: 'Commer-',   sublabel: 'cial Laundry',        revenueShare: 0.08, gp1Margin: 0.10, forwardCAGR: 0.045, linkedCategoryId: null },
      { id: 'l_ca_8',  label: 'Laundry',   sublabel: 'Apps',                revenueShare: 0.01, gp1Margin: 0.22, forwardCAGR: 0.180, linkedCategoryId: null },
      { id: 'l_ca_9',  label: 'Appliance', sublabel: 'Aftermarket',         revenueShare: 0.04, gp1Margin: 0.15, forwardCAGR: 0.055, linkedCategoryId: null },
      { id: 'l_ca_10', label: 'Smart',     sublabel: 'Home',                revenueShare: 0.03, gp1Margin: 0.30, forwardCAGR: 0.140, linkedCategoryId: null },
    ],
    sources: 'Core: ~$140B (Euromonitor) | Adjacent: ~$120B est. | All adjacent margins: Consulting Estimates',
    insights: [
      'Core branded Laundry (~$140B, 16% margin) is the anchor — adjacencies add ~$120B at mixed margins',
      'Air Care (25% margin, 6% CAGR) is the highest-margin adjacent pool — fragrance-driven, Henkel white spot',
      'Auto Dishwashing (18% margin) is the natural synergy play — pods/tabs format bridges directly from laundry',
      'Henkel strong in DW (Somat) and Surface (Bref). Air Care = largest untapped margin opportunity.',
    ],
  },
];

// ─── 0-3 Rating (PRISM-driven, red/green) ─────────────────────────

export interface TrendRating {
  direction: 'increasing' | 'declining' | 'stable' | 'n/a';
  score: 0 | 1 | 2 | 3;
  label: string;
  tone: 'green' | 'red' | 'neutral' | 'muted';
}

export function toTrendRating(shift: number | null | undefined): TrendRating {
  if (shift == null || !isFinite(shift)) {
    return { direction: 'n/a', score: 0, label: 'No PRISM signal', tone: 'muted' };
  }
  const abs = Math.abs(shift);
  let score: 0 | 1 | 2 | 3;
  if (abs < 0.005)      score = 0;
  else if (abs < 0.015) score = 1;
  else if (abs < 0.030) score = 2;
  else                  score = 3;
  if (score === 0) {
    return { direction: 'stable', score: 0, label: 'Stable', tone: 'neutral' };
  }
  if (shift > 0) {
    return { direction: 'increasing', score, label: `Increasing +${score}`, tone: 'green' };
  }
  return { direction: 'declining', score, label: `Declining -${score}`, tone: 'red' };
}

export function slidePrismShiftFor(
  shifts: Record<string, Record<string | number, unknown>> | undefined,
  slide: ProfitPoolSlide,
  year: number,
): number | null {
  if (!shifts || !slide.prismProxyCategories.length) return null;
  const values: number[] = [];
  for (const catId of slide.prismProxyCategories) {
    const dummy: CategoryProfitPool = {
      id: catId,
      name: catId,
      shortDescription: '',
      group: slide.group,
      revenueBn: 0, ebitMargin: 0, henkelShare: 0,
      historical5yCAGR: 0, forwardCAGR: 0, sources: [],
    };
    const raw = prismShiftFor(shifts, dummy, year);
    if (raw != null) values.push(raw);
  }
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function itemPrismShiftFor(
  shifts: Record<string, Record<string | number, unknown>> | undefined,
  slide: ProfitPoolSlide,
  item: SlideItem,
  year: number,
): number | null {
  if (item.linkedCategoryId) {
    const cat = PROFIT_POOL_DATA.find(c => c.id === item.linkedCategoryId);
    if (cat) {
      const direct = prismShiftFor(shifts, cat, year);
      if (direct != null) return direct;
    }
  }
  return slidePrismShiftFor(shifts, slide, year);
}
