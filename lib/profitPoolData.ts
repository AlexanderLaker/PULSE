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
