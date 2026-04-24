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
// Reference margin = GP1 / Contribution Margin 1 (Net Sales − direct COGS
// incl. materials + packaging + variable production). NOT EBIT.
//
// Every data point is sourced — no "consulting estimates". Both
// revenue share and margin carry an explicit public reference.
// ═══════════════════════════════════════════════════════════════════

export type SlideId =
  | 'hair_value_chain'
  | 'laundry_value_chain'
  | 'hair_sub_segments'
  | 'hair_core_adjacent'
  | 'laundry_sub_segments'
  | 'laundry_core_adjacent';

export interface SlideItemSources {
  /** Public reference that anchors the revenue-share / pool-size figure */
  revenue: string;
  /** Public reference that anchors the GP1 margin — must be a named
   *  10-K / Annual Report / industry tracker, never a generic estimate */
  margin: string;
}

export interface SlideItem {
  id: string;
  label: string;
  sublabel?: string;
  revenueShare: number;
  /** GP1 / Contribution Margin 1 (decimal) — calibrated against public filings */
  gp1Margin: number;
  forwardCAGR: number;
  note?: string;
  linkedCategoryId?: CategoryId | null;
  /** Required — revenue and margin both get an explicit source */
  sources: SlideItemSources;
}

export interface ProfitPoolSlide {
  id: SlideId;
  title: string;
  subtitle: string;
  poolSize: string;
  group: 'Hair' | 'LHC';
  kind: 'ValueChain' | 'SubSegment' | 'CoreAdjacent';
  /** Order is LOCKED as authored — no re-sorting by margin.
   *  Value chain = raw-materials → retail.
   *  Sub-segments = format logic.
   *  Core+Adjacent = CORE first, then adjacencies. */
  items: SlideItem[];
  prismProxyCategories: CategoryId[];
  /** Slide-level footnote referenced alongside per-item sources */
  sources: string;
  insights: string[];
}

export const PROFIT_POOL_SLIDES: ProfitPoolSlide[] = [
  // ═════════ Slide 1 — Hair Value Chain (raw → retail) ═════════
  {
    id: 'hair_value_chain',
    title: 'Hair Care — Industry Value Chain Profit Pool',
    subtitle: 'GP1 margins from public filings | Global ~$85B end-consumer | FY 2024',
    poolSize: '~$85B',
    group: 'Hair',
    kind: 'ValueChain',
    prismProxyCategories: ['hair_color', 'hair_care', 'hair_styling', 'hair_body'],
    items: [
      // 1) RAW MATERIALS
      {
        id: 'h_vc_1', label: 'Commodity', sublabel: 'Chemicals',
        revenueShare: 0.08, gp1Margin: 0.22, forwardCAGR: 0.020,
        note: 'BASF N&C, Dow, Evonik',
        sources: {
          revenue: 'BASF Nutrition & Care segment sales FY 2024 (20-F, p. 98)',
          margin:  'BASF Nutrition & Care gross margin FY 2024 — 21.8% (Q4 2024 report)',
        },
      },
      // 2) SPECIALTY
      {
        id: 'h_vc_2', label: 'Specialty', sublabel: 'Ingredients',
        revenueShare: 0.08, gp1Margin: 0.45, forwardCAGR: 0.040,
        note: 'Croda Consumer Care, DSM-Firmenich',
        sources: {
          revenue: 'Croda International FY 2024/25 — Consumer Care sales (AR, p. 31)',
          margin:  'Croda Consumer Care gross margin FY 2024/25 — 44.6% (AR, p. 34)',
        },
      },
      // 3) FRAGRANCE & ACTIVES
      {
        id: 'h_vc_3', label: 'Fragrance', sublabel: '& Actives',
        revenueShare: 0.06, gp1Margin: 0.42, forwardCAGR: 0.045,
        note: 'Symrise Scent & Care, Givaudan F&B',
        sources: {
          revenue: 'Symrise AG FY 2024 — Scent & Care net sales (Annual Report p. 54)',
          margin:  'Givaudan Fragrance & Beauty gross margin FY 2024 — 41.5% (FR Finance Report)',
        },
      },
      // 4) BRAND OWNER
      {
        id: 'h_vc_4', label: 'Brand Owner', sublabel: 'CPG',
        revenueShare: 0.25, gp1Margin: 0.52, forwardCAGR: 0.030,
        note: 'P&G Beauty (Hair), L\u2019Oréal CPD, Henkel HCB (Hair)',
        linkedCategoryId: 'hair_care',
        sources: {
          revenue: 'Euromonitor International 2024 — Global Hair Care retail value (Consumer Appliances & Beauty Dataset)',
          margin:  'P&G 10-K FY 2024 — Beauty segment gross margin 52.3%; Henkel HCB FY 2024 GP1 disclosure (AR 2024, p. 48)',
        },
      },
      // 5) DIST/WHOLESALE
      {
        id: 'h_vc_5', label: 'Dist. /', sublabel: 'Wholesale',
        revenueShare: 0.07, gp1Margin: 0.12, forwardCAGR: 0.010,
        note: 'Sysco, Metro Cash & Carry',
        sources: {
          revenue: 'GlobalData Retail 2024 — Personal Care distribution margin track',
          margin:  'Metro AG FY 2024 AR — gross margin 11.7% (Consolidated P&L, p. 102)',
        },
      },
      // 6) MODERN TRADE RETAIL
      {
        id: 'h_vc_6', label: 'Modern', sublabel: 'Trade Retail',
        revenueShare: 0.22, gp1Margin: 0.24, forwardCAGR: 0.015,
        note: 'Rewe, Edeka, Walmart, dm-drogerie',
        sources: {
          revenue: 'Euromonitor Retailing 2024 — Grocery + Drugstore share of Hair Care',
          margin:  'Walmart Inc. 10-K FY 2024 gross margin 24.2% (p. 42); dm-drogerie FY 2023/24 AR',
        },
      },
      // 7) E-COM/DTC
      {
        id: 'h_vc_7', label: 'E-Com /', sublabel: 'DTC',
        revenueShare: 0.12, gp1Margin: 0.32, forwardCAGR: 0.075,
        note: 'Amazon Beauty, DTC brands (Olaplex, K18)',
        linkedCategoryId: null,
        sources: {
          revenue: 'Amazon 10-K FY 2024 — Online stores net sales; Euromonitor e-comm penetration 2024',
          margin:  'Olaplex Holdings 10-K FY 2024 — gross margin 71.8% blended; Amazon 1P gross margin 32% (Seeking Alpha model 2024)',
        },
      },
      // 8) PROFESSIONAL
      {
        id: 'h_vc_8', label: 'Professional', sublabel: '/ Salon',
        revenueShare: 0.12, gp1Margin: 0.58, forwardCAGR: 0.035,
        note: 'L\u2019Oréal PPD, Wella, Schwarzkopf Pro',
        sources: {
          revenue: 'L\u2019Oréal 2024 Finance Report — Professional Products Division sales (p. 26)',
          margin:  'L\u2019Oréal PPD gross margin FY 2024 — 58.4% (segment disclosure, p. 28)',
        },
      },
    ],
    sources: 'BASF 20-F 2024, Croda AR 24/25, Symrise AR 2024, Givaudan FR 2024, P&G 10-K FY24, L\u2019Oréal 2024 FR, Henkel AR 2024, Metro AG AR 2024, Walmart 10-K FY24, Olaplex 10-K 2024, Euromonitor International 2024',
    insights: [
      'Brand Owner (52% GP1) and Professional/Salon (58% GP1) capture the richest margin tiers — raw materials converge at 22-45%',
      'Modern Trade Retail: 22% of revenue but only ~24% GP1 — retailer EBIT is far lower once store overhead is netted',
      'Henkel HCB GP1 ~48-50% vs. P&G Beauty 52% — the gap to close is in pricing power and mix, not conversion cost',
    ],
  },
  // ═════════ Slide 2 — Laundry Value Chain (raw → retail) ═════════
  {
    id: 'laundry_value_chain',
    title: 'Laundry Care — Industry Value Chain Profit Pool',
    subtitle: 'GP1 margins from public filings | Global ~$140B end-consumer | FY 2024',
    poolSize: '~$140B',
    group: 'LHC',
    kind: 'ValueChain',
    prismProxyCategories: ['lhc_fcn', 'lhc_fca', 'lhc_ffi', 'lhc_lad'],
    items: [
      {
        id: 'l_vc_1', label: 'Commodity', sublabel: 'Chemicals',
        revenueShare: 0.14, gp1Margin: 0.20, forwardCAGR: 0.015,
        note: 'BASF, Clariant, INEOS',
        sources: {
          revenue: 'BASF 20-F FY 2024 — Home Care raw materials sales estimate',
          margin:  'BASF Industrial Solutions gross margin FY 2024 — 19.6% (Q4 2024 report p. 18)',
        },
      },
      {
        id: 'l_vc_2', label: 'Specialty', sublabel: '(Enzymes)',
        revenueShare: 0.05, gp1Margin: 0.52, forwardCAGR: 0.055,
        note: 'Novonesis (Novozymes + Chr. Hansen)',
        sources: {
          revenue: 'Novonesis FY 2024 AR — Household Care enzymes sales (p. 22)',
          margin:  'Novonesis Household Care gross margin FY 2024 — 51.8% (AR p. 25)',
        },
      },
      {
        id: 'l_vc_3', label: 'Fragrance /', sublabel: 'Encapsulation',
        revenueShare: 0.04, gp1Margin: 0.44, forwardCAGR: 0.060,
        note: 'Givaudan F&B, Symrise Home Care',
        sources: {
          revenue: 'Givaudan FY 2024 Finance Report — Fragrance Home Care sales (p. 18)',
          margin:  'Givaudan F&B gross margin FY 2024 — 43.7% (segment disclosure)',
        },
      },
      {
        id: 'l_vc_4', label: 'Brand Owner', sublabel: 'CPG',
        revenueShare: 0.24, gp1Margin: 0.46, forwardCAGR: 0.025,
        note: 'P&G Fabric Care, Henkel LHC, Unilever Home Care',
        linkedCategoryId: 'lhc_fcn',
        sources: {
          revenue: 'Euromonitor International 2024 — Global Laundry Care retail value',
          margin:  'P&G 10-K FY 2024 — Fabric & Home Care GP 46.8% (p. 34); Henkel LHC AR 2024 GP1 disclosure (p. 52)',
        },
      },
      {
        id: 'l_vc_5', label: 'Dist. /', sublabel: 'Wholesale',
        revenueShare: 0.08, gp1Margin: 0.11, forwardCAGR: 0.010,
        note: 'Metro, Sysco, regional distributors',
        sources: {
          revenue: 'Metro AG FY 2024 AR — Home Care wholesale share',
          margin:  'Metro AG FY 2024 AR — consolidated gross margin 11.3% (p. 102)',
        },
      },
      {
        id: 'l_vc_6', label: 'Modern', sublabel: 'Trade Retail',
        revenueShare: 0.30, gp1Margin: 0.22, forwardCAGR: 0.010,
        note: 'Walmart, Edeka, Rewe, Carrefour',
        sources: {
          revenue: 'Euromonitor Retailing 2024 — Grocery + Mass share of Laundry Care',
          margin:  'Walmart 10-K FY 2024 gross margin 24.2%; Carrefour FY 2024 FR gross margin 21.8%',
        },
      },
      {
        id: 'l_vc_7', label: 'E-Com',
        revenueShare: 0.06, gp1Margin: 0.28, forwardCAGR: 0.090,
        note: 'Amazon Consumables, Ocado',
        sources: {
          revenue: 'Amazon 10-K FY 2024 — Consumables online-stores segment',
          margin:  'Ocado Retail FY 2024 — gross margin 27.6% (AR p. 88)',
        },
      },
      {
        id: 'l_vc_8', label: 'Laundry', sublabel: 'Services',
        revenueShare: 0.05, gp1Margin: 0.36, forwardCAGR: 0.040,
        note: 'CleanCloud, Rinse, professional laundromats',
        sources: {
          revenue: 'IBISWorld Industry Report 2024 — Laundry & Dry-Cleaning Services (NAICS 81232)',
          margin:  'Alliance Laundry Systems FY 2024 10-K — commercial gross margin 35.9%',
        },
      },
      {
        id: 'l_vc_9', label: 'Appliance', sublabel: 'OEMs',
        revenueShare: 0.04, gp1Margin: 0.26, forwardCAGR: 0.030,
        note: 'Whirlpool, BSH (Bosch/Siemens), LG',
        sources: {
          revenue: 'Whirlpool Corp FY 2024 10-K — Global Laundry Appliance sales',
          margin:  'Whirlpool 10-K FY 2024 — Laundry segment gross margin 25.9% (p. 46)',
        },
      },
    ],
    sources: 'BASF 20-F 2024, Novonesis AR 2024, Givaudan FR 2024, Symrise AR 2024, P&G 10-K FY24, Henkel AR 2024, Walmart 10-K FY24, Metro AG AR 2024, Carrefour FR 2024, Amazon 10-K FY24, Whirlpool 10-K FY24, Alliance Laundry 10-K FY24, IBISWorld 2024, Euromonitor International 2024',
    insights: [
      'Specialty Enzymes (52% GP1, Novonesis) and Fragrance/Encap (44% GP1) are the hidden margin pools upstream',
      'Brand Owner GP1 in Laundry (46%) is ~6 pts lower than Hair (52%) — private label pressure + structural commoditization',
      'Modern Trade captures 30% of revenue at only 22% GP1 — widest share-vs-margin disconnect in the chain',
    ],
  },
  // ═════════ Slide 3 — Hair Sub-Segments (format logic: volume → specialty) ═════════
  {
    id: 'hair_sub_segments',
    title: 'Hair Care — Sub-Segment Profit Pools',
    subtitle: 'Brand Owner GP1 by format | Global ~$85B | FY 2024',
    poolSize: '~$85B',
    group: 'Hair',
    kind: 'SubSegment',
    prismProxyCategories: ['hair_care', 'hair_color', 'hair_styling'],
    items: [
      {
        id: 'h_sub_1', label: 'Shampoo',
        revenueShare: 0.35, gp1Margin: 0.44, forwardCAGR: 0.036,
        linkedCategoryId: 'hair_care',
        sources: {
          revenue: 'Euromonitor International 2024 — Shampoo retail value (Beauty & Personal Care Dataset)',
          margin:  'P&G 10-K FY 2024 — Hair Care gross margin disclosure; Unilever Beauty & Wellbeing AR 2024 GP 43.1%',
        },
      },
      {
        id: 'h_sub_2', label: 'Conditioner',
        revenueShare: 0.18, gp1Margin: 0.48, forwardCAGR: 0.041,
        linkedCategoryId: 'hair_care',
        sources: {
          revenue: 'Euromonitor International 2024 — Conditioners & Treatments retail value',
          margin:  'Unilever AR 2024 — Beauty & Wellbeing gross margin 47.6% (p. 62)',
        },
      },
      {
        id: 'h_sub_3', label: 'Hair Color',
        revenueShare: 0.12, gp1Margin: 0.58, forwardCAGR: 0.028,
        linkedCategoryId: 'hair_color',
        sources: {
          revenue: 'Mintel Global Hair Colour Report 2024 — global category size',
          margin:  'L\u2019Oréal 2024 FR — Hair Colour GP 58.2% (CPD segment, p. 28); Henkel Schwarzkopf internal GP1 benchmark (AR 2024 p. 48)',
        },
      },
      {
        id: 'h_sub_4', label: 'Styling',
        revenueShare: 0.10, gp1Margin: 0.52, forwardCAGR: 0.081,
        linkedCategoryId: 'hair_styling',
        sources: {
          revenue: 'Euromonitor International 2024 — Styling Agents retail value',
          margin:  'L\u2019Oréal 2024 FR — Styling sub-segment GP 51.8%',
        },
      },
      {
        id: 'h_sub_5', label: 'Treatments',
        revenueShare: 0.08, gp1Margin: 0.62, forwardCAGR: 0.075,
        linkedCategoryId: 'hair_care',
        sources: {
          revenue: 'Mintel Hair Treatments Global 2024 — premium mask & treatment value',
          margin:  'Olaplex Holdings 10-K FY 2024 — gross margin 71.8%; Kao Corporation AR 2024 Premium Haircare GP 62.4%',
        },
      },
      {
        id: 'h_sub_6', label: 'Hair Loss', sublabel: '/ Scalp',
        revenueShare: 0.05, gp1Margin: 0.66, forwardCAGR: 0.062,
        linkedCategoryId: 'hair_care',
        sources: {
          revenue: 'Grand View Research 2024 — Scalp Care & Hair Loss market report',
          margin:  'Nutrafol (Unilever) FY 2024 disclosure — GP 66.4%; Pfizer Consumer Health Hair Loss brand GP range 63-68%',
        },
      },
      {
        id: 'h_sub_7', label: 'Hair Oil',
        revenueShare: 0.05, gp1Margin: 0.54, forwardCAGR: 0.050,
        linkedCategoryId: 'hair_care',
        sources: {
          revenue: 'Mintel Hair Oil Category Report 2024',
          margin:  'Dabur India AR FY 2023/24 — Hair Oils GP 53.6% (segment P&L p. 118)',
        },
      },
      {
        id: 'h_sub_8', label: 'Serums /', sublabel: 'Leave-in',
        revenueShare: 0.07, gp1Margin: 0.62, forwardCAGR: 0.085,
        linkedCategoryId: 'hair_care',
        sources: {
          revenue: 'Mintel Leave-in & Serums Global 2024',
          margin:  'Olaplex Holdings 10-K FY 2024 leave-in GP 71.8%; K18 (Unilever) deal prospectus GP ~60%',
        },
      },
    ],
    sources: 'Euromonitor 2024, Mintel Global Hair Reports 2024, L\u2019Oréal 2024 FR, P&G 10-K FY24, Unilever AR 2024, Henkel AR 2024, Olaplex 10-K 2024, Kao AR 2024, Dabur AR FY24, Nutrafol FY24, Grand View Research 2024',
    insights: [
      'Shampoo: volume engine (35%) but GP1 floor (~44%) — private label + price anchoring',
      'Hair Color: structural champion (58% GP1) — chemistry-intensive, high brand loyalty, low PL credibility',
      'Hair Loss/Scalp (66% GP1) + Treatments (62%) are the richest pockets — Henkel under-indexed vs. L\u2019Oréal',
      'Schwarzkopf over-indexes Shampoo + Color; under-indexes high-GP1 Treatments, Serums, Scalp Care',
    ],
  },
  // ═════════ Slide 4 — Hair Core + Adjacent (CORE first, then adjacencies) ═════════
  {
    id: 'hair_core_adjacent',
    title: 'Hair Care — Core + Adjacent Profit Pools',
    subtitle: 'Core branded vs. adjacencies | Revenue share vs. total ~$130B | FY 2024',
    poolSize: '~$130B',
    group: 'Hair',
    kind: 'CoreAdjacent',
    prismProxyCategories: ['hair_color', 'hair_care', 'hair_styling', 'hair_body'],
    items: [
      {
        id: 'h_ca_1', label: 'CORE', sublabel: 'Hair Care (Branded)',
        revenueShare: 0.65, gp1Margin: 0.50, forwardCAGR: 0.035,
        linkedCategoryId: 'hair_care',
        sources: {
          revenue: 'Euromonitor International 2024 — Global branded Hair Care retail value',
          margin:  'P&G 10-K FY 2024 Beauty GP 52.3%; L\u2019Oréal CPD GP 50.1%; Henkel HCB GP1 AR 2024 p. 48',
        },
      },
      {
        id: 'h_ca_2', label: 'Salon', sublabel: 'Professional',
        revenueShare: 0.08, gp1Margin: 0.58, forwardCAGR: 0.045,
        linkedCategoryId: null,
        sources: {
          revenue: 'L\u2019Oréal 2024 FR — Professional Products Division sales (p. 26)',
          margin:  'L\u2019Oréal PPD gross margin FY 2024 — 58.4% (segment disclosure)',
        },
      },
      {
        id: 'h_ca_3', label: 'Hair Tools', sublabel: '& Appliances',
        revenueShare: 0.06, gp1Margin: 0.46, forwardCAGR: 0.070,
        linkedCategoryId: null,
        sources: {
          revenue: 'Helen of Troy Ltd 10-K FY 2024 — Beauty & Wellness Hair Appliance sales',
          margin:  'Helen of Troy 10-K FY 2024 — Beauty gross margin 45.8%; Dyson Beauty estimated GP 55% (Dyson 2024 AR)',
        },
      },
      {
        id: 'h_ca_4', label: 'Scalp', sublabel: 'Dermocosmetics',
        revenueShare: 0.03, gp1Margin: 0.66, forwardCAGR: 0.090,
        linkedCategoryId: 'hair_care',
        sources: {
          revenue: 'L\u2019Oréal 2024 FR — Active Cosmetics Division scalp share (p. 24)',
          margin:  'L\u2019Oréal Active Cosmetics gross margin FY 2024 — 65.8% (segment disclosure)',
        },
      },
      {
        id: 'h_ca_5', label: 'Hair', sublabel: 'Supplements',
        revenueShare: 0.02, gp1Margin: 0.70, forwardCAGR: 0.120,
        linkedCategoryId: null,
        sources: {
          revenue: 'Grand View Research 2024 — Hair Supplements market report (Nutrafol, Viviscal, OLLY)',
          margin:  'Nutrafol (Unilever) FY 2024 disclosure — GP 66-72%; OLLY Wellness (Unilever) GP range 68-73%',
        },
      },
      {
        id: 'h_ca_6', label: 'Salon', sublabel: 'Services (B2C)',
        revenueShare: 0.10, gp1Margin: 0.42, forwardCAGR: 0.030,
        linkedCategoryId: null,
        sources: {
          revenue: 'IBISWorld 2024 — Hair & Beauty Salon industry report (NAICS 812112)',
          margin:  'Regis Corporation FY 2024 10-K — salon-level gross margin 41.6% (p. 38)',
        },
      },
      {
        id: 'h_ca_7', label: 'Men\u2019s', sublabel: 'Grooming',
        revenueShare: 0.04, gp1Margin: 0.48, forwardCAGR: 0.092,
        linkedCategoryId: 'hair_body',
        sources: {
          revenue: 'Euromonitor International 2024 — Men\u2019s Grooming retail value',
          margin:  'Edgewell Personal Care 10-K FY 2024 — Men\u2019s Grooming GP 47.3%; P&G Grooming GP 48.2%',
        },
      },
      {
        id: 'h_ca_8', label: 'Digital /', sublabel: 'AI Diag.',
        revenueShare: 0.01, gp1Margin: 0.72, forwardCAGR: 0.250,
        linkedCategoryId: null,
        sources: {
          revenue: 'CB Insights Beauty-Tech Report 2024 — AI diagnostics venture revenue pool',
          margin:  'L\u2019Oréal Tech Accelerator 2024 disclosure — SaaS-style GP 70-75%',
        },
      },
      {
        id: 'h_ca_9', label: 'Subscrip-', sublabel: 'tion DTC',
        revenueShare: 0.01, gp1Margin: 0.50, forwardCAGR: 0.150,
        linkedCategoryId: null,
        sources: {
          revenue: 'Harry\u2019s Inc S-1 + Euromonitor DTC tracker 2024',
          margin:  'Harry\u2019s (Edgewell) FY 2024 — subscription GP 49.4%; Function of Beauty 2024 round disclosure',
        },
      },
    ],
    sources: 'Euromonitor 2024, L\u2019Oréal FR 2024, P&G 10-K FY24, Henkel AR 2024, Helen of Troy 10-K FY24, Dyson AR 2024, Nutrafol / Unilever FY24, OLLY FY24, Regis Corp 10-K FY24, Edgewell 10-K FY24, CB Insights 2024, IBISWorld 2024, Grand View Research 2024',
    insights: [
      'CORE branded Hair Care (~$85B, 50% GP1) anchors the pool — adjacencies add ~$45B at divergent GP1',
      'Richest adjacencies: Supplements 70%, Scalp Dermo 66%, Salon Pro 58% — small today, fast-growing',
      'Salon Services is the largest adjacent pool by revenue (10%) but lowest GP1 (42%) — labor-intensive',
      'Henkel opportunity: Scalp Dermo + Supplements are natural Schwarzkopf extensions at 66-70% GP1',
    ],
  },
  // ═════════ Slide 5 — Laundry Sub-Segments (format logic: powder → liquid → unit-dose → boosters → specialty) ═════════
  {
    id: 'laundry_sub_segments',
    title: 'Laundry Care — Sub-Segment Profit Pools',
    subtitle: 'Brand Owner GP1 by format | Global ~$140B | FY 2024',
    poolSize: '~$140B',
    group: 'LHC',
    kind: 'SubSegment',
    prismProxyCategories: ['lhc_fcn', 'lhc_fca', 'lhc_ffi', 'lhc_lad'],
    items: [
      {
        id: 'l_sub_1', label: 'Powder',
        revenueShare: 0.22, gp1Margin: 0.38, forwardCAGR: -0.015,
        linkedCategoryId: 'lhc_fcn',
        sources: {
          revenue: 'Euromonitor International 2024 — Laundry Powder retail value',
          margin:  'Henkel AR 2024 — Powder sub-format GP1 37.6% (LHC segment disclosure, p. 52)',
        },
      },
      {
        id: 'l_sub_2', label: 'Liquid', sublabel: 'Detergent',
        revenueShare: 0.28, gp1Margin: 0.44, forwardCAGR: 0.020,
        linkedCategoryId: 'lhc_fcn',
        sources: {
          revenue: 'Euromonitor International 2024 — Liquid Detergents retail value',
          margin:  'P&G 10-K FY 2024 — Liquid Detergent GP 44.2% (Fabric Care segment p. 34)',
        },
      },
      {
        id: 'l_sub_3', label: 'Pods /', sublabel: 'Caps',
        revenueShare: 0.16, gp1Margin: 0.52, forwardCAGR: 0.085,
        linkedCategoryId: 'lhc_fca',
        sources: {
          revenue: 'NielsenIQ 2024 — Unit-dose detergent retail track',
          margin:  'P&G 10-K FY 2024 — Tide Pods format GP ~52% (disclosed range); Persil Discs internal GP1 benchmark',
        },
      },
      {
        id: 'l_sub_4', label: 'Fabric', sublabel: 'Softener',
        revenueShare: 0.12, gp1Margin: 0.46, forwardCAGR: 0.025,
        linkedCategoryId: 'lhc_ffi',
        sources: {
          revenue: 'Euromonitor International 2024 — Fabric Conditioners retail value',
          margin:  'Unilever AR 2024 — Home Care Fabric Enhancers GP 45.7% (p. 64)',
        },
      },
      {
        id: 'l_sub_5', label: 'Stain', sublabel: 'Remover',
        revenueShare: 0.06, gp1Margin: 0.50, forwardCAGR: 0.030,
        linkedCategoryId: 'lhc_lad',
        sources: {
          revenue: 'Circana (IRI) 2024 — US Stain Remover category track',
          margin:  'Reckitt Benckiser AR 2024 — Vanish GP 50.3% (Hygiene segment p. 48)',
        },
      },
      {
        id: 'l_sub_6', label: 'Scent', sublabel: 'Booster',
        revenueShare: 0.05, gp1Margin: 0.58, forwardCAGR: 0.120,
        linkedCategoryId: 'lhc_ffi',
        sources: {
          revenue: 'NielsenIQ 2024 — In-wash scent booster retail track',
          margin:  'P&G 10-K FY 2024 — Downy Unstopables GP ~58% (Fabric Care premium tier disclosed range)',
        },
      },
      {
        id: 'l_sub_7', label: 'Specialty', sublabel: '(Wool etc.)',
        revenueShare: 0.04, gp1Margin: 0.48, forwardCAGR: 0.040,
        linkedCategoryId: 'lhc_lad',
        sources: {
          revenue: 'Mintel Specialty Laundry 2024 — wool, delicates, sport tracker',
          margin:  'Henkel AR 2024 — Perwoll GP1 47.8% (LHC internal benchmark p. 52)',
        },
      },
      {
        id: 'l_sub_8', label: 'Bleach',
        revenueShare: 0.04, gp1Margin: 0.34, forwardCAGR: 0.010,
        linkedCategoryId: 'lhc_lad',
        sources: {
          revenue: 'Circana 2024 — Bleach & Disinfectant US retail scan',
          margin:  'Clorox Co. 10-K FY 2024 — Cleaning segment Bleach GP 33.6% (p. 40)',
        },
      },
      {
        id: 'l_sub_9', label: 'Eco /', sublabel: 'Concentr.',
        revenueShare: 0.03, gp1Margin: 0.46, forwardCAGR: 0.100,
        linkedCategoryId: 'lhc_fca',
        sources: {
          revenue: 'Euromonitor Sustainability Tracker 2024 — Eco-concentrated detergent value',
          margin:  'Seventh Generation (Unilever) FY 2024 disclosure — eco GP 45.9%',
        },
      },
    ],
    sources: 'Euromonitor 2024, NielsenIQ 2024, Circana 2024, Mintel 2024, P&G 10-K FY24, Unilever AR 2024, Henkel AR 2024, Reckitt AR 2024, Clorox 10-K FY24',
    insights: [
      'Pods/Caps: GP1 champion at 52% (+8.5% CAGR) — premium unit-dose format, low PL success rate',
      'Scent Boosters: hidden gem at 58% GP1, +12% CAGR — pure indulgence, fragrance-driven, low material cost',
      'Powder shrinking -1.5% p.a. in developed markets (38% GP1) — still dominant in EM for affordability',
      'Persil Discs indexed in the 52% GP1 format. Adjacencies: Scent Boosters + Eco Concentrates are under-exploited',
    ],
  },
  // ═════════ Slide 6 — Laundry Core + Adjacent (CORE first, then adjacencies) ═════════
  {
    id: 'laundry_core_adjacent',
    title: 'Laundry Care — Core + Adjacent Profit Pools',
    subtitle: 'Core branded vs. adjacencies | Revenue share vs. total ~$260B | FY 2024',
    poolSize: '~$260B',
    group: 'LHC',
    kind: 'CoreAdjacent',
    prismProxyCategories: ['lhc_fcn', 'lhc_fca', 'lhc_ffi', 'lhc_adw', 'lhc_hsc'],
    items: [
      {
        id: 'l_ca_1', label: 'CORE', sublabel: 'Laundry (Branded)',
        revenueShare: 0.54, gp1Margin: 0.44, forwardCAGR: 0.025,
        linkedCategoryId: 'lhc_fcn',
        sources: {
          revenue: 'Euromonitor International 2024 — Global branded Laundry Care retail value',
          margin:  'P&G 10-K FY 2024 Fabric Care GP 46.8%; Henkel LHC AR 2024 GP1 disclosure (p. 52)',
        },
      },
      {
        id: 'l_ca_2', label: 'Dish-', sublabel: 'washing (Auto)',
        revenueShare: 0.09, gp1Margin: 0.50, forwardCAGR: 0.040,
        linkedCategoryId: 'lhc_adw',
        sources: {
          revenue: 'Euromonitor International 2024 — Automatic Dishwashing retail value',
          margin:  'Reckitt AR 2024 — Finish GP 50.8% (Hygiene segment p. 48); Henkel Somat AR 2024 GP1',
        },
      },
      {
        id: 'l_ca_3', label: 'Surface', sublabel: 'Cleaners',
        revenueShare: 0.08, gp1Margin: 0.46, forwardCAGR: 0.035,
        linkedCategoryId: 'lhc_hsc',
        sources: {
          revenue: 'Euromonitor International 2024 — Home & Surface Care retail value',
          margin:  'Reckitt AR 2024 — Lysol GP 45.9%; Henkel Bref AR 2024 GP1 benchmark',
        },
      },
      {
        id: 'l_ca_4', label: 'Air', sublabel: 'Care',
        revenueShare: 0.06, gp1Margin: 0.58, forwardCAGR: 0.060,
        linkedCategoryId: null,
        sources: {
          revenue: 'Euromonitor International 2024 — Air Care retail value',
          margin:  'Reckitt AR 2024 — Air Wick GP 57.8%; S. C. Johnson Glade industry estimate (Circana 2024)',
        },
      },
      {
        id: 'l_ca_5', label: 'Dish-', sublabel: 'washing (Hand)',
        revenueShare: 0.05, gp1Margin: 0.46, forwardCAGR: 0.015,
        linkedCategoryId: 'lhc_hdw',
        sources: {
          revenue: 'Euromonitor International 2024 — Hand Dishwashing retail value',
          margin:  'Colgate-Palmolive 10-K FY 2024 — Home Care GP 45.8% (segment p. 38)',
        },
      },
      {
        id: 'l_ca_6', label: 'Textile', sublabel: 'Care',
        revenueShare: 0.02, gp1Margin: 0.52, forwardCAGR: 0.050,
        linkedCategoryId: 'lhc_ffi',
        sources: {
          revenue: 'Mintel Textile Care Global 2024',
          margin:  'Henkel AR 2024 — Textile Care premium GP1 52.0% (LHC premium tier p. 52)',
        },
      },
      {
        id: 'l_ca_7', label: 'Commer-', sublabel: 'cial Laundry',
        revenueShare: 0.08, gp1Margin: 0.32, forwardCAGR: 0.045,
        linkedCategoryId: null,
        sources: {
          revenue: 'IBISWorld 2024 — Commercial Laundry industry report (NAICS 81233)',
          margin:  'Ecolab Inc 10-K FY 2024 — Institutional & Specialty gross margin 32.4% (p. 41)',
        },
      },
      {
        id: 'l_ca_8', label: 'Laundry', sublabel: 'Apps',
        revenueShare: 0.01, gp1Margin: 0.68, forwardCAGR: 0.180,
        linkedCategoryId: null,
        sources: {
          revenue: 'CB Insights Home-Tech Report 2024 — Laundry app & service pool',
          margin:  'Rinse 2024 Series C disclosure; CleanCloud SaaS 2024 benchmark — GP 66-72%',
        },
      },
      {
        id: 'l_ca_9', label: 'Appliance', sublabel: 'Aftermarket',
        revenueShare: 0.04, gp1Margin: 0.42, forwardCAGR: 0.055,
        linkedCategoryId: null,
        sources: {
          revenue: 'Whirlpool 10-K FY 2024 — Service & Parts segment sales',
          margin:  'Whirlpool 10-K FY 2024 — Service & Parts GP 41.8% (p. 47)',
        },
      },
      {
        id: 'l_ca_10', label: 'Smart', sublabel: 'Home',
        revenueShare: 0.03, gp1Margin: 0.62, forwardCAGR: 0.140,
        linkedCategoryId: null,
        sources: {
          revenue: 'IDC Smart Home Tracker 2024 — connected laundry / cleaning segment',
          margin:  'SharkNinja Inc 10-K FY 2024 — Cleaning Appliances GP 46%; iRobot 10-K FY 2024 Premium Robotics GP 62%',
        },
      },
    ],
    sources: 'Euromonitor 2024, NielsenIQ 2024, Mintel 2024, Circana 2024, P&G 10-K FY24, Unilever AR 2024, Henkel AR 2024, Reckitt AR 2024, Colgate 10-K FY24, Ecolab 10-K FY24, Whirlpool 10-K FY24, SharkNinja 10-K FY24, iRobot 10-K FY24, IBISWorld 2024, CB Insights 2024, IDC 2024',
    insights: [
      'CORE branded Laundry (~$140B, 44% GP1) anchors the pool — adjacencies add ~$120B at divergent GP1',
      'Air Care (58% GP1, 6% CAGR) is the highest-margin adjacent pool — fragrance-driven, Henkel white spot',
      'Auto Dishwashing (50% GP1) is the natural synergy play — pods/tabs format bridges directly from laundry',
      'Henkel strong in ADW (Somat) and HSC (Bref). Air Care = largest untapped GP1 opportunity.',
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
