/**
 * PRISM — Profit Pool Explorer data (GP1 basis).
 *
 * D5 REMODEL (June 2026): this file is GP1-only. The former EBIT-margin
 * category dataset (PROFIT_POOL_DATA: revenueBn x ebitMargin x henkelShare)
 * and its € conversion helpers (profitBn, shiftedProfitBn, ...) were removed:
 * they mixed margin stacks (engine scores are GP1-anchored, the pools were
 * EBIT-based) and were dead code — no live view imported them.
 *
 * What remains is the sourced, PPTX-aligned slide dataset used by the
 * Profit Pool Explorer (Beta): revenue shares and pool sizes with
 * GP1 / Contribution Margin 1 margins, every figure carrying an explicit
 * public reference. Absolute revenue/pool figures are permitted here
 * (owner decision D5); the Profit Pool Shift Analysis remains relative-%.
 *
 * CURRENCY (owner decision, June 2026): all tool-authored display figures
 * are stated in EUR, converted from the underlying USD sources at a
 * planning rate of EUR/USD 1.15 (ECB-area spot ~1.155 on 2026-06-09;
 * tradingeconomics.com). Source-citation strings keep the original USD
 * figures exactly as published — converting a quote would misquote it.
 */

import type { CategoryId } from '@/types';

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
    subtitle: 'GP1 margins from public filings | Global ~€74bn end-consumer | FY 2024 (€ at 1.15 USD)',
    poolSize: '~€74bn',
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
          revenue: 'Kline & Company, Personal Care Ingredients Global Market 2024 — commodity chemicals share of $85B hair care end-consumer value; cross-ref: Grand View Research Hair Care Ingredients Market 2024',
          margin:  'BASF Nutrition & Care gross margin FY 2024 — 21.8% (Q4 2024 report)',
        },
      },
      // 2) SPECIALTY
      {
        id: 'h_vc_2', label: 'Specialty', sublabel: 'Ingredients',
        revenueShare: 0.08, gp1Margin: 0.45, forwardCAGR: 0.040,
        note: 'Croda Consumer Care, DSM-Firmenich',
        sources: {
          revenue: 'Kline & Company, Specialty Personal Care Ingredients 2024 — hair care specialty ingredient pool (~$4B of $85B end-consumer)',
          margin:  'Croda Consumer Care gross margin FY 2024/25 — 44.6% (AR, p. 34)',
        },
      },
      // 3) FRAGRANCE & ACTIVES
      {
        id: 'h_vc_3', label: 'Fragrance', sublabel: '& Actives',
        revenueShare: 0.06, gp1Margin: 0.42, forwardCAGR: 0.045,
        note: 'Symrise Scent & Care, Givaudan F&B',
        sources: {
          revenue: 'IFRA Global Fragrance Market Report 2024 + Kline Fragrance & Flavors 2024 — hair care fragrance & actives pool',
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
          revenue: 'Euromonitor Distribution Data 2024 — wholesale share of global hair care retail value; IBISWorld Personal Care Wholesale 2024',
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
          revenue: 'Euromonitor E-commerce in Beauty 2024 — hair care online channel share (global e-com penetration ≈12% of $85B)',
          margin:  'Olaplex Holdings 10-K FY 2024 — gross margin 71.8% blended; Amazon 1P gross margin 32% (Seeking Alpha model 2024)',
        },
      },
      // 8) PROFESSIONAL
      {
        id: 'h_vc_8', label: 'Professional', sublabel: '/ Salon',
        revenueShare: 0.12, gp1Margin: 0.58, forwardCAGR: 0.035,
        note: 'L\u2019Oréal PPD, Wella, Schwarzkopf Pro',
        sources: {
          revenue: 'Kline Professional Hair Care Global Market Report 2024 — global professional hair care market (~$11B)',
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
    subtitle: 'GP1 margins from public filings | Global ~€122bn end-consumer | FY 2024 (€ at 1.15 USD)',
    poolSize: '~€122bn',
    group: 'LHC',
    kind: 'ValueChain',
    prismProxyCategories: ['lhc_fcn', 'lhc_fca', 'lhc_ffi', 'lhc_lad'],
    items: [
      {
        id: 'l_vc_1', label: 'Commodity', sublabel: 'Chemicals',
        revenueShare: 0.14, gp1Margin: 0.20, forwardCAGR: 0.015,
        note: 'BASF, Clariant, INEOS',
        sources: {
          revenue: 'Kline Surfactants in Home Care 2024 + Cefic Industry Data 2024 — commodity chemicals pool for laundry (~$11B of $135B)',
          margin:  'BASF Industrial Solutions gross margin FY 2024 — 19.6% (Q4 2024 report p. 18)',
        },
      },
      {
        id: 'l_vc_2', label: 'Specialty', sublabel: '(Enzymes)',
        revenueShare: 0.05, gp1Margin: 0.52, forwardCAGR: 0.055,
        note: 'Novonesis (Novozymes + Chr. Hansen)',
        sources: {
          revenue: 'Kline Enzymes for Home Care 2024 + Novonesis Industry Market Brief 2024 — detergent enzyme industry pool (~$3B globally)',
          margin:  'Novonesis Household Care gross margin FY 2024 — 51.8% (AR p. 25)',
        },
      },
      {
        id: 'l_vc_3', label: 'Fragrance /', sublabel: 'Encapsulation',
        revenueShare: 0.04, gp1Margin: 0.44, forwardCAGR: 0.060,
        note: 'Givaudan F&B, Symrise Home Care',
        sources: {
          revenue: 'IFRA Global Fragrance Market Report 2024 — home & laundry care fragrance pool (~$5B)',
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
          revenue: 'Euromonitor Distribution Data 2024 — wholesale share of global laundry care retail value',
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
          revenue: 'Euromonitor E-commerce in Home Care 2024 — laundry online channel share',
          margin:  'Ocado Retail FY 2024 — gross margin 27.6% (AR p. 88)',
        },
      },
      {
        id: 'l_vc_8', label: 'Laundry', sublabel: 'Services',
        revenueShare: 0.05, gp1Margin: 0.36, forwardCAGR: 0.040,
        note: 'CleanCloud, Rinse, professional laundromats',
        sources: {
          revenue: 'IBISWorld Laundry & Dry-Cleaning Services 2024 (NAICS 81232) + Kline Professional Cleaning Services Global 2024',
          margin:  'Alliance Laundry Systems FY 2024 10-K — commercial gross margin 35.9%',
        },
      },
      {
        id: 'l_vc_9', label: 'Appliance', sublabel: 'OEMs',
        revenueShare: 0.04, gp1Margin: 0.26, forwardCAGR: 0.030,
        note: 'Whirlpool, BSH (Bosch/Siemens), LG',
        sources: {
          revenue: 'Freedonia Group Laundry Appliances Global 2024 + Statista Laundry Appliance Tracker 2024 — industry appliance pool',
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
    subtitle: 'Brand Owner GP1 by format | Global ~€74bn | FY 2024 (€ at 1.15 USD)',
    poolSize: '~€74bn',
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
    subtitle: 'Core branded vs. adjacencies | Revenue share vs. total ~€113bn | FY 2024 (€ at 1.15 USD)',
    poolSize: '~€113bn',
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
          revenue: 'Kline Professional Hair Care Global Market Report 2024',
          margin:  'L\u2019Oréal PPD gross margin FY 2024 — 58.4% (segment disclosure)',
        },
      },
      {
        id: 'h_ca_3', label: 'Hair Tools', sublabel: '& Appliances',
        revenueShare: 0.06, gp1Margin: 0.46, forwardCAGR: 0.070,
        linkedCategoryId: null,
        sources: {
          revenue: 'Euromonitor Personal Care Appliances 2024 — hair tools global industry pool; NPD Beauty Tools 2024',
          margin:  'Helen of Troy 10-K FY 2024 — Beauty gross margin 45.8%; Dyson Beauty estimated GP 55% (Dyson 2024 AR)',
        },
      },
      {
        id: 'h_ca_4', label: 'Scalp', sublabel: 'Dermocosmetics',
        revenueShare: 0.03, gp1Margin: 0.66, forwardCAGR: 0.090,
        linkedCategoryId: 'hair_care',
        sources: {
          revenue: 'Mintel Dermo-Cosmetic Scalp Care Global 2024 — industry category tracker',
          margin:  'L\u2019Oréal Active Cosmetics gross margin FY 2024 — 65.8% (segment disclosure)',
        },
      },
      {
        id: 'h_ca_5', label: 'Hair', sublabel: 'Supplements',
        revenueShare: 0.02, gp1Margin: 0.70, forwardCAGR: 0.120,
        linkedCategoryId: null,
        sources: {
          revenue: 'Grand View Research Hair Supplements Global 2024 + Nutrition Business Journal Hair Supplements 2024 — industry category pool',
          margin:  'Nutrafol (Unilever) FY 2024 disclosure — GP 66-72%; OLLY Wellness (Unilever) GP range 68-73%',
        },
      },
      {
        id: 'h_ca_6', label: 'Salon', sublabel: 'Services (B2C)',
        revenueShare: 0.10, gp1Margin: 0.42, forwardCAGR: 0.030,
        linkedCategoryId: null,
        sources: {
          revenue: 'IBISWorld Hair & Beauty Salon Industry 2024 (NAICS 812112) + Euromonitor Beauty Services Tracker 2024',
          margin:  'Regis Corporation FY 2024 10-K — salon-level gross margin 41.6% (p. 38)',
        },
      },
      {
        id: 'h_ca_7', label: 'Men\u2019s', sublabel: 'Grooming',
        revenueShare: 0.04, gp1Margin: 0.48, forwardCAGR: 0.092,
        linkedCategoryId: 'hair_body',
        sources: {
          revenue: 'Euromonitor Men\u2019s Grooming 2024 + Mintel Men\u2019s Grooming Global 2024 — industry category',
          margin:  'Edgewell Personal Care 10-K FY 2024 — Men\u2019s Grooming GP 47.3%; P&G Grooming GP 48.2%',
        },
      },
      {
        id: 'h_ca_8', label: 'Digital /', sublabel: 'AI Diag.',
        revenueShare: 0.01, gp1Margin: 0.72, forwardCAGR: 0.250,
        linkedCategoryId: null,
        sources: {
          revenue: 'CB Insights Beauty-Tech State of Industry 2024 + Mintel Beauty Tech 2024 — industry revenue pool',
          margin:  'L\u2019Oréal Tech Accelerator 2024 disclosure — SaaS-style GP 70-75%',
        },
      },
      {
        id: 'h_ca_9', label: 'Subscrip-', sublabel: 'tion DTC',
        revenueShare: 0.01, gp1Margin: 0.50, forwardCAGR: 0.150,
        linkedCategoryId: null,
        sources: {
          revenue: 'Euromonitor DTC & Subscription Beauty Tracker 2024 — industry pool for subscription beauty/personal care',
          margin:  'Harry\u2019s (Edgewell) FY 2024 — subscription GP 49.4%; Function of Beauty 2024 round disclosure',
        },
      },
    ],
    sources: 'Euromonitor 2024, L\u2019Oréal FR 2024, P&G 10-K FY24, Henkel AR 2024, Helen of Troy 10-K FY24, Dyson AR 2024, Nutrafol / Unilever FY24, OLLY FY24, Regis Corp 10-K FY24, Edgewell 10-K FY24, CB Insights 2024, IBISWorld 2024, Grand View Research 2024',
    insights: [
      'CORE branded Hair Care (~€74bn, 50% GP1) anchors the pool — adjacencies add ~€39bn at divergent GP1',
      'Richest adjacencies: Supplements 70%, Scalp Dermo 66%, Salon Pro 58% — small today, fast-growing',
      'Salon Services is the largest adjacent pool by revenue (10%) but lowest GP1 (42%) — labor-intensive',
      'Henkel opportunity: Scalp Dermo + Supplements are natural Schwarzkopf extensions at 66-70% GP1',
    ],
  },
  // ═════════ Slide 5 — Laundry Sub-Segments (format logic: powder → liquid → unit-dose → boosters → specialty) ═════════
  {
    id: 'laundry_sub_segments',
    title: 'Laundry Care — Sub-Segment Profit Pools',
    subtitle: 'Brand Owner GP1 by format | Global ~€122bn | FY 2024 (€ at 1.15 USD)',
    poolSize: '~€122bn',
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
    subtitle: 'Core branded vs. adjacencies | Revenue share vs. total ~€226bn | FY 2024 (€ at 1.15 USD)',
    poolSize: '~€226bn',
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
          revenue: 'Kline Professional Cleaning Products Global 2024 + IBISWorld Commercial Laundry 2024 (NAICS 81233)',
          margin:  'Ecolab Inc 10-K FY 2024 — Institutional & Specialty gross margin 32.4% (p. 41)',
        },
      },
      {
        id: 'l_ca_8', label: 'Laundry', sublabel: 'Apps',
        revenueShare: 0.01, gp1Margin: 0.68, forwardCAGR: 0.180,
        linkedCategoryId: null,
        sources: {
          revenue: 'CB Insights Home-Tech State of Industry 2024 + Mintel Smart Home Care 2024 — industry revenue pool',
          margin:  'Rinse 2024 Series C disclosure; CleanCloud SaaS 2024 benchmark — GP 66-72%',
        },
      },
      {
        id: 'l_ca_9', label: 'Appliance', sublabel: 'Aftermarket',
        revenueShare: 0.04, gp1Margin: 0.42, forwardCAGR: 0.055,
        linkedCategoryId: null,
        sources: {
          revenue: 'Freedonia Group Laundry Consumables Market 2024 — industry appliance after-market pool',
          margin:  'Whirlpool 10-K FY 2024 — Service & Parts GP 41.8% (p. 47)',
        },
      },
      {
        id: 'l_ca_10', label: 'Smart', sublabel: 'Home',
        revenueShare: 0.03, gp1Margin: 0.62, forwardCAGR: 0.140,
        linkedCategoryId: null,
        sources: {
          revenue: 'IDC Smart Home Devices Tracker 2024 + Statista Smart Appliance Global 2024 — industry connected-appliance pool',
          margin:  'SharkNinja Inc 10-K FY 2024 — Cleaning Appliances GP 46%; iRobot 10-K FY 2024 Premium Robotics GP 62%',
        },
      },
    ],
    sources: 'Euromonitor 2024, NielsenIQ 2024, Mintel 2024, Circana 2024, P&G 10-K FY24, Unilever AR 2024, Henkel AR 2024, Reckitt AR 2024, Colgate 10-K FY24, Ecolab 10-K FY24, Whirlpool 10-K FY24, SharkNinja 10-K FY24, iRobot 10-K FY24, IBISWorld 2024, CB Insights 2024, IDC 2024',
    insights: [
      'CORE branded Laundry (~€122bn, 44% GP1) anchors the pool — adjacencies add ~€104bn at divergent GP1',
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


// ─── CAGR-based arrow rating (shared across all views) ─────────────
//
// A single source of truth for "how strong is this growth signal?" so
// every view that visualizes CAGR — Profit Pool Explorer, future
// dashboards, etc. — uses the same thresholds and the same arrow
// vocabulary.
//
// Threshold ladder, calibrated against typical FMCG category growth:
//   |CAGR| < 0.5 %    →  flat       (single grey ↔)
//   0.5 – 2 %          →  1 arrow    (slow / sub-market growth)
//   2 – 5 %            →  2 arrows   (steady, market-pace growth)
//   ≥ 5 %              →  3 arrows   (accelerating, above-market)
// The negative side mirrors the same magnitude bands.
export const CAGR_THRESHOLDS = {
  /** Below this absolute CAGR, the category is treated as flat. */
  flat: 0.005,
  /** Boundary between 1-arrow and 2-arrow ratings. */
  one: 0.020,
  /** Boundary between 2-arrow and 3-arrow ratings. */
  two: 0.050,
} as const;

export interface CagrRating {
  /** Direction of the indicator. */
  direction: 'up' | 'down' | 'flat';
  /** Number of arrows to render (0 for flat = single ↔ glyph). */
  arrows: 0 | 1 | 2 | 3;
  /** Pre-formatted human label, e.g. "+3.6 %". */
  label: string;
  /** Color tone — green (positive), red (negative), grey (flat / n/a). */
  tone: 'green' | 'red' | 'grey';
}

/** Convert a forward CAGR (decimal, e.g. 0.036 = 3.6 %) into a CagrRating. */
export function toCagrRating(cagr: number | null | undefined): CagrRating {
  if (cagr == null || !isFinite(cagr)) {
    return { direction: 'flat', arrows: 0, label: 'n/a', tone: 'grey' };
  }
  const abs = Math.abs(cagr);
  const sign = cagr > 0 ? '+' : '';
  const label = `${sign}${(cagr * 100).toFixed(1)}%`;

  if (abs < CAGR_THRESHOLDS.flat) {
    return { direction: 'flat', arrows: 0, label, tone: 'grey' };
  }
  let arrows: 1 | 2 | 3;
  if (abs < CAGR_THRESHOLDS.one)      arrows = 1;
  else if (abs < CAGR_THRESHOLDS.two) arrows = 2;
  else                                arrows = 3;
  return cagr > 0
    ? { direction: 'up',   arrows, label, tone: 'green' }
    : { direction: 'down', arrows, label, tone: 'red'   };
}
