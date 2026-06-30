/**
 * PRISM — Profit Pool Explorer data (GP1 basis).
 *
 * v2 REBUILD (2026-06-11) — "pool development" data model + verified sources.
 *
 * What changed vs. v1:
 *  1. POOL DEVELOPMENT IS THE HEADLINE. Each item now carries a verified
 *     `revenueCAGR` AND a structured `gp1DeltaBps` margin-drift estimate;
 *     the profit-pool growth rate is DERIVED from both:
 *        poolCAGR = (1 + revenueCAGR) × (1 + marginCAGR) − 1
 *     where marginCAGR = (GP1_end / GP1_now)^(1/H) − 1 over the H-year
 *     horizon (FY2025 base → 2030). The chart arrows encode poolCAGR —
 *     the development of the pool (area), not revenue alone.
 *  2. EVERY SOURCE IS A CLICKABLE URL whose page visibly contains the
 *     cited figure (verified by fetch on 2026-06-11). The v1 citations
 *     that could not be verified (e.g. "Henkel AR 2024 Powder GP1 37.6%
 *     p. 52", "L'Oréal PPD gross margin 58.4%", "Whirlpool Laundry GM
 *     25.9%", Kline/Euromonitor paywalled references) were REMOVED and
 *     replaced with verifiable anchors. Notable corrections: L'Oréal
 *     discloses division OPERATING margins (PPD 22.9%), not segment
 *     gross margins — its group gross margin is 74.3%; Whirlpool's real
 *     FY2025 gross margin is 15.4%; Ecolab's is 44.5%; Reckitt divested
 *     Essential Home (Air Wick → "Vestacy") in 2025.
 *  3. EVIDENCE GRADES on every figure, same vocabulary as the Consumer
 *     Journey layer: 'reported' (✅ figure as published at the URL),
 *     'derived' (⚡ arithmetic on published figures, basis stated),
 *     'estimate' (⚠️ structured judgment, basis stated).
 *  4. GP1 ≠ reported gross margin. GP1 / CM1 (net sales − direct COGS)
 *     is not separately disclosed by any player at tier level. Tier GP1
 *     values are therefore PRISM structured estimates CALIBRATED against
 *     the verified company-level gross margins linked on each item —
 *     they are graded 'derived' or 'estimate', never 'reported', unless
 *     the company-level figure itself is shown.
 *
 * CURRENCY (owner decision, June 2026): tool-authored display figures
 * are EUR, converted from USD sources at a planning rate of EUR/USD
 * 1.15. Source citations keep the original USD figures exactly as
 * published — converting a quote would misquote it.
 *
 * BASE YEARS: public market reports mix 2023–2026 bases; each source
 * label carries its base year. Horizon for all development arrows:
 * ~5 years (≈2025 → 2030).
 *
 * D5 status unchanged: this file is the one owner-sanctioned place for
 * absolute € figures; the Shift Analysis remains relative-% only.
 */

import type { CategoryId } from '@/types';

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export type SlideId =
  | 'hair_value_chain'
  | 'laundry_value_chain'
  | 'hair_sub_segments'
  | 'hair_core_adjacent'
  | 'laundry_sub_segments'
  | 'laundry_core_adjacent';

export type PoolGroup = 'Hair' | 'LHC';
export type SlideKind = 'ValueChain' | 'SubSegment' | 'CoreAdjacent';

/** Evidence grade — same ✅/⚡/⚠️ grammar as the Consumer Journey layer. */
export type EvidenceGrade = 'reported' | 'derived' | 'estimate';

export interface SourceRef {
  /** Short label, e.g. "P&G FY2025 8-K — gross margin 51.2%" */
  label: string;
  /** Clickable URL. The cited figure is visible on this page (verified 2026-06-11). */
  url: string;
  /** Optional basis note: what was taken from the page / how it was used. */
  detail?: string;
  grade: EvidenceGrade;
}

export interface SlideItem {
  id: string;
  label: string;
  sublabel?: string;
  /** Share of the slide's revenue pool (decimal). Normalized per slide. */
  revenueShare: number;
  /** GP1 / Contribution Margin 1 today (decimal) — calibrated vs. linked filings. */
  gp1Margin: number;
  /** Forward revenue CAGR (decimal), verified per the revenue sources. */
  revenueCAGR: number;
  /** Expected GP1 drift over the horizon, in basis points (+150 = +1.5 pp by 2030). */
  gp1DeltaBps: number;
  /** One-line driver behind the revenue trajectory. */
  revenueDriver: string;
  /** One-line driver behind the margin trajectory. */
  marginDriver: string;
  note?: string;
  linkedCategoryId?: CategoryId | null;
  sources: {
    revenue: SourceRef[];
    margin: SourceRef[];
  };
}

export interface ProfitPoolSlide {
  id: SlideId;
  title: string;
  subtitle: string;
  /** Display label for the revenue pool, e.g. "~€77bn". */
  poolSize: string;
  /** Numeric revenue pool in €bn (planning rate 1.15) for € math in the UI. */
  poolSizeEurBn: number;
  group: PoolGroup;
  kind: SlideKind;
  /** Order is LOCKED as authored — value chain raw→retail; formats by logic; CORE first. */
  items: SlideItem[];
  prismProxyCategories: CategoryId[];
  /** How the shares/pool of this view were constructed — the audit trail. */
  construction: string;
  insights: string[];
}

// ═══════════════════════════════════════════════════════════════════
// Shared, verified margin anchors (FY2025 filings unless noted)
// — single definition so every slide cites the identical fact.
// T13 (June 2026): every URL points at the COMPANY'S OWN primary source
//   (its IR results page / annual report / SEC filing) — the third-party
//   aggregator links (stockanalysis.com, eulerpool.com) were replaced and
//   each figure re-confirmed against the primary document. GAAP gross
//   margins are used throughout (not the higher "adjusted" headlines).
// ═══════════════════════════════════════════════════════════════════

const SRC = {
  henkel: {
    label: 'Henkel FY2025 (2025 Annual Report) — group gross margin 50.8% (€10,421m / €20,495m)',
    url: 'https://www.henkel.com/press-and-media/press-releases-and-kits/2026-03-11-publication-of-2025-annual-report-2129200',
    detail: 'Gross-margin % is derived from the reported P&L lines (€10,421m ÷ €20,495m = 50.8%); Henkel does not headline a gross-margin ratio.',
    grade: 'reported',
  } as SourceRef,
  henkelHcb: {
    label: 'Henkel IR (11 Mar 2026) — Consumer Brands FY2025 sales €9,677m, adj. EBIT margin 14.5%',
    url: 'https://www.henkel.com/investors-and-analysts/investor-relations-news/2026-03-11-henkel-delivers-organic-growth-in-2025-and-increases-profitability-through-innovation-and-more-efficiency-2132482',
    grade: 'reported',
  } as SourceRef,
  pg: {
    label: 'P&G FY2025 8-K (SEC, year ended Jun-2025) — gross margin 51.2%; Beauty $14,964m, Fabric & Home Care $29,617m net sales',
    url: 'https://www.sec.gov/Archives/edgar/data/0000080424/000008042425000067/fy2425q4amj8-kexhibit991.htm',
    grade: 'reported',
  } as SourceRef,
  loreal: {
    label: "L'Oréal FY2025 results — group gross profit 74.3% of sales; CPD op. margin 21.4%, PPD op. margin 22.9%",
    url: 'https://www.loreal-finance.com/eng/press-release/2025-annual-results',
    grade: 'reported',
  } as SourceRef,
  unilever: {
    label: 'Unilever FY2025 announcement — gross margin 46.9%; Home Care underlying op. margin 14.9%',
    url: 'https://www.unilever.com/files/ir-q4-2025-full-announcement.pdf',
    grade: 'reported',
  } as SourceRef,
  reckitt: {
    label: 'Reckitt FY2025 results — gross margin 60.8% (£8,634m / £14,205m)',
    url: 'https://www.reckitt.com/media/pkomsyoc/reckitt-fy-2025-results-announcement.pdf',
    grade: 'reported',
  } as SourceRef,
  colgate: {
    label: 'Colgate-Palmolive FY2025 — gross margin 60.1% ($12,251m / $20,382m)',
    url: 'https://investor.colgatepalmolive.com/news-releases/news-release-details/colgate-palmolive-company-announces-4th-quarter-and-full-year/',
    grade: 'reported',
  } as SourceRef,
  clorox: {
    label: 'Clorox FY2025 (June FYE) — gross margin 45.2% ($3,213m / $7,104m)',
    url: 'https://investors.thecloroxcompany.com/news/news-details/2025/Clorox-Reports-Q4-and-FY25-Results-Provides-FY26-Outlook/',
    grade: 'reported',
  } as SourceRef,
  chd: {
    label: 'Church & Dwight FY2025 — GAAP gross margin 44.7% ($2,775m / $6,203m)',
    url: 'https://investor.churchdwight.com/Investors/news/news-details/2026/Church--Dwight-Reports-Q4-2025-and-2025-Results-and-Provides-2026-Outlook/default.aspx',
    grade: 'reported',
  } as SourceRef,
  kao: {
    label: 'Kao FY2025 — gross margin 39.6% (¥668.2bn / ¥1,688.6bn)',
    url: 'https://www.kao.com/content/dam/sites/kao/www-kao-com/global/en/investor-relations/pdf/kao-earnings-fy2025-en.pdf',
    grade: 'reported',
  } as SourceRef,
  beiersdorf: {
    label: 'Beiersdorf FY2025 (group, incl. tesa) — gross margin 57.7% (€5,686m / €9,852m)',
    url: 'https://reports.beiersdorf.com/annual-report/2025/consolidated-financial-statements/consolidated-financial-statements/income-statement.html',
    grade: 'reported',
  } as SourceRef,
  olaplex: {
    label: 'Olaplex FY2025 — gross margin 69.4% ($293.6m / $423.0m)',
    url: 'https://ir.olaplex.com/news/detail/66/olaplex-reports-fourth-quarter-and-fiscal-year-2025-results',
    detail: 'Independent in FY2025, but Henkel agreed to acquire Olaplex on 26-Mar-2026 (~$1.4bn, close expected H2-2026) — treat as a soon-to-be-Henkel comp, not a clean external benchmark, once the deal closes.',
    grade: 'reported',
  } as SourceRef,
  basf: {
    label: 'BASF FY2025 — group gross margin 24.1% (€14,359m / €59,657m)',
    url: 'https://report.basf.com/2025/en/financial-statements/statement-of-income.html',
    grade: 'reported',
  } as SourceRef,
  croda: {
    label: 'Croda FY2025 results — gross margin 43.9% (£745.7m / £1,699.4m)',
    url: 'https://www.croda.com/mediaassets/files/corporate/full-year-2025/croda-full-year-2025-results-and-financial-framework-final.pdf',
    grade: 'reported',
  } as SourceRef,
  givaudan: {
    label: 'Givaudan FY2025 — gross margin 43.5% (CHF 3,252m / 7,472m)',
    url: 'https://www.givaudan.com/files/giv-2025-fyr-en.pdf',
    grade: 'reported',
  } as SourceRef,
  symrise: {
    label: 'Symrise FY2025 (consolidated financial statements) — gross margin 37.6% (€1,855m / €4,929m)',
    url: 'https://symrise.com/corporatereport/2025/home/Symrise_GB25_Konzernabschluss_EN_geschuetzt.pdf',
    grade: 'reported',
  } as SourceRef,
  novonesis: {
    label: 'Novonesis FY2025 — gross margin 53.9% IFRS (adj. 59.1% excl. PPA)',
    url: 'https://backend.novonesis.com/sites/default/files/document/2026-02/2026_01_12M%202025__Highlights.pdf',
    grade: 'reported',
  } as SourceRef,
  metro: {
    label: 'Metro AG FY2023/24 (Sep FYE; last audited year, taken private May 2025) — gross margin 16.3% (€5,052m / €31,029m)',
    url: 'https://reports.metroag.de/annual-report/2023-2024/consolidated-financial-statements/income-statement.html',
    grade: 'reported',
  } as SourceRef,
  walmart: {
    label: 'Walmart FY2026 (Jan-2026 FYE) — gross margin 24.2% on net sales (Walmart’s own metric); 24.9% if computed on total revenue ($177.8bn / $713.2bn, folds in membership/other income)',
    url: 'https://stock.walmart.com/_assets/_461d6b46a29d437b51015f942ff9bb4e/walmart/db/938/9972/earnings_release/Earnings+Release+(FY26+Q4).pdf',
    grade: 'reported',
  } as SourceRef,
  carrefour: {
    label: 'Carrefour FY2025 — gross margin 19.5% (€16,024m / €82,102m)',
    url: 'https://www.carrefour.com/sites/default/files/2026-02/VEN_Comptes%20consolide%CC%81s%202025%20incluant%20le%20rapport%20des%20CAC.pdf',
    grade: 'reported',
  } as SourceRef,
  whirlpool: {
    label: 'Whirlpool FY2025 — gross margin 15.4% ($2,386m / $15,524m)',
    url: 'https://investors.whirlpoolcorp.com/news-and-events/news/news-details/2026/Whirlpool-Corporation-Announces-Fourth-Quarter-and-Full-Year-Results-Provides-2026-Guidance/default.aspx',
    grade: 'reported',
  } as SourceRef,
  ecolab: {
    label: 'Ecolab FY2025 — gross margin 44.5% ($7,150m / $16,081m)',
    url: 'https://www.ecolab.com/news/2026/02/ecolab-announces-record-fourth-quarter-and-strong-2026-outlook-reported-diluted-eps-1-98-adjusted-d',
    grade: 'reported',
  } as SourceRef,
  helenOfTroy: {
    label: 'Helen of Troy FY2026 (Feb FYE) — gross margin 45.7% ($815.7m / $1,786m)',
    url: 'https://investor.helenoftroy.com/press-releases/press-release-details/2026/Helen-of-Troy-Reports-Fourth-Quarter-Fiscal-2026-Results/default.aspx',
    grade: 'reported',
  } as SourceRef,
  edgewell: {
    label: 'Edgewell FY2025 (Sep FYE) — gross margin 41.6% ($924.9m / $2,224m)',
    url: 'https://ir.edgewell.com/news-and-events/press-releases/2025/11-13-2025-110044688?sc_lang=en',
    grade: 'reported',
  } as SourceRef,
  sharkninja: {
    label: 'SharkNinja FY2025 (Dec FYE) — GAAP gross margin 49.0% ($3,136m / $6,399m)',
    url: 'https://ir.sharkninja.com/news/news-details/2026/SharkNinja-Reports-Fourth-Quarter-and-Full-Year-2025-Results/default.aspx',
    grade: 'reported',
  } as SourceRef,
  allianceLaundry: {
    label: 'Alliance Laundry FY2025 — gross margin 37.6% ($642.1m / $1,709.2m)',
    url: 'https://ir.alliancelaundry.com/news-events/press-releases/detail/138/alliance-reports-fourth-quarter-and-full-year-2025-results',
    grade: 'reported',
  } as SourceRef,
} as const;

// Market-size / CAGR anchors (each URL displays the quoted figure).
const MKT = {
  hairTotal: {
    label: 'Euromonitor International — global hair care ~$90bn (2024, retail value RSP; incl. colourants + salon professional), category ~3% CAGR 2023–28 (current value)',
    url: 'https://www.euromonitor.com/hair-care',
    detail: 'Primary source = Euromonitor (Henkel-licensed). Exact global $ sits in Passport — confirm internally; corroborated by Euromonitor per-capita $11 × world population (~$89–90bn) and GVR $88.2bn (2025). Euromonitor’s ~3% all-category current-value CAGR is below the segment-specialist rates shown on the sub-segment view.',
    grade: 'derived',
  } as SourceRef,
  shampoo: {
    label: 'Fortune Business Insights — shampoo $38.23bn (2025), 5.9% CAGR 2026–2034',
    url: 'https://www.fortunebusinessinsights.com/shampoo-market-103432',
    grade: 'reported',
  } as SourceRef,
  conditioner: {
    label: 'Fortune Business Insights — conditioner $5.30bn (2026) → $9.62bn 2034, 7.7% CAGR',
    url: 'https://www.fortunebusinessinsights.com/hair-conditioner-market-113198',
    grade: 'reported',
  } as SourceRef,
  hairColor: {
    label: 'Grand View Research — hair color $26.1bn (2024), 5.9% CAGR 2025–2033',
    url: 'https://www.grandviewresearch.com/industry-analysis/hair-color-market-report',
    grade: 'reported',
  } as SourceRef,
  styling: {
    label: 'Mordor Intelligence — hair styling products $10.04bn (2026), 4.4% CAGR 2026–2031',
    url: 'https://www.mordorintelligence.com/industry-reports/hair-styling-products-market',
    grade: 'reported',
  } as SourceRef,
  masks: {
    label: 'Mordor Intelligence — hair masks $702m (2025), ~5.6% CAGR to 2031',
    url: 'https://www.mordorintelligence.com/industry-reports/hair-mask-market',
    grade: 'reported',
  } as SourceRef,
  serum: {
    label: 'Grand View Research — hair serum $1.32bn (2024), 7.1% CAGR 2025–2033',
    url: 'https://www.grandviewresearch.com/industry-analysis/hair-serum-market-report',
    grade: 'reported',
  } as SourceRef,
  hairOil: {
    label: 'IMARC — hair oil $4.7bn (2025), 3.5% CAGR to 2034',
    url: 'https://www.imarcgroup.com/hair-oil-market',
    grade: 'reported',
  } as SourceRef,
  scalp: {
    label: 'Coherent Market Insights — scalp care $15.81bn (2026), 7.3% CAGR to 2033',
    url: 'https://www.coherentmarketinsights.com/market-insight/scalp-care-market-5132',
    grade: 'reported',
  } as SourceRef,
  supplements: {
    label: 'Grand View Research — hair growth supplements $830.6m (2024), 15.5% CAGR 2025–2030',
    url: 'https://www.grandviewresearch.com/industry-analysis/hair-growth-supplements-market-report',
    grade: 'reported',
  } as SourceRef,
  proHair: {
    label: 'Kline & Company — global professional (salon) hair-care products ~$17bn (2024, ~4% growth; salon/back-bar level)',
    url: 'https://klinegroup.com/beauty-and-wellbeing/henkels-potential-olaplex-acquisition/',
    detail: 'Primary source = Kline (the professional-hair authority). Replaces AMR’s $34.8bn, which is a ~2× broader all-channel aggregation (spans hypermarket/e-comm/pharmacy “professional-grade” product), not the salon channel. Confirm exact figure in Kline’s Professional Hair Care Global Series.',
    grade: 'derived',
  } as SourceRef,
  hairTools: {
    label: 'Fortune Business Insights — haircare tools $29.38bn (2025), 5.3% CAGR 2026–2034',
    url: 'https://www.fortunebusinessinsights.com/haircare-tools-market-113424',
    grade: 'reported',
  } as SourceRef,
  salonServices: {
    label: 'Salon hair-care SERVICES ~$150bn (2025) — triangulated estimate; NO tier-1 source (Kline/Euromonitor) sizes salon SERVICES, only products. Range: IBISWorld US hair salons $60.6bn (2024) / GMI $71.5bn floor / AMR $160bn / FBI $203.8bn ceiling. Bottom-up (US $60bn ÷ ~⅓ of world) ⇒ ~$180bn, so ~$150bn is reasonable-to-conservative.',
    url: 'https://www.fortunebusinessinsights.com/salon-hair-care-services-market-113322',
    grade: 'estimate',
  } as SourceRef,
  beautySub: {
    label: 'Future Market Insights — beauty subscription $1.55bn (2025), 25.9% CAGR to 2035',
    url: 'https://www.futuremarketinsights.com/reports/beauty-subscription-market',
    grade: 'reported',
  } as SourceRef,
  laundryTotal: {
    label: 'Euromonitor International — global Laundry Care (detergents + softeners + aids) ~$85bn (2024 est., retail value RSP). Anchored to Euromonitor Home Care $167bn (2020 RSP, 6.4% CAGR ⇒ ~$185–195bn by 2024), of which Laundry Care is the largest sub-category (~45%); cross-check US Laundry Care $18.5bn (2025). Confirm in Passport.',
    url: 'https://www.euromonitor.com/article/home-care-industry-overview',
    detail: 'Primary source = Euromonitor (Henkel-licensed). The prior GVR "$185bn laundry detergent" figure ≈ the ENTIRE Home Care universe (laundry+dish+surface+air+toilet), not laundry alone — which is why the headline was ~2× too big.',
    grade: 'estimate',
  } as SourceRef,
  liquid: {
    label: 'Liquid laundry detergent ~$42bn (2025), ~5% CAGR — expert estimate (3 sources span $28–50bn: FBI $28.08bn low / Mordor $45.78bn / MRFR $50.22bn; midpoint ~$42bn). The previously-cited FBI $28bn is the low end of the range.',
    url: 'https://www.fortunebusinessinsights.com/liquid-laundry-detergent-market-102962',
    grade: 'estimate',
  } as SourceRef,
  pods: {
    label: 'Grand View Research — laundry detergent pods $11.27bn (2023), 6.5% CAGR 2024–2030',
    url: 'https://www.grandviewresearch.com/press-release/global-laundry-detergent-pods-market',
    grade: 'reported',
  } as SourceRef,
  softener: {
    label: 'Grand View Research — fabric softener $14.59bn (2023), 3.4% CAGR 2024–2030',
    url: 'https://www.grandviewresearch.com/press-release/global-fabric-softener-market',
    grade: 'reported',
  } as SourceRef,
  stain: {
    label: 'Grand View Research — stain remover $22.27bn (2023), 5.1% CAGR 2024–2030 (scope incl. surface stain products)',
    url: 'https://www.grandviewresearch.com/press-release/global-stain-remover-market',
    grade: 'reported',
  } as SourceRef,
  boosters: {
    label: 'Persistence MR via openPR — laundry scent boosters $495m (2024), 9.3% CAGR to 2031 (lower-tier source)',
    url: 'https://www.openpr.com/news/3901308/laundry-scent-booster-market',
    grade: 'reported',
  } as SourceRef,
  babySpecialty: {
    label: 'Precedence Research — baby cleaning products $5.37bn (2024), 5.1% CAGR (proxy for delicates/specialty)',
    url: 'https://www.precedenceresearch.com/baby-cleaning-products-market',
    grade: 'reported',
  } as SourceRef,
  adw: {
    label: 'Market.us — dishwasher detergent $19.2bn (2024), 8.0% CAGR to 2034 (scope sanity: Finish + Cascade are $1bn+ brands)',
    url: 'https://market.us/report/global-dishwasher-detergent-market/',
    grade: 'reported',
  } as SourceRef,
  handDish: {
    label: 'Business Research Insights — dishwashing liquid $22.74bn (2026), 3.2% CAGR (scope: ~70% hand dish)',
    url: 'https://www.businessresearchinsights.com/market-reports/dishwashing-liquid-market-101360',
    grade: 'reported',
  } as SourceRef,
  householdCleaners: {
    label: 'Mordor Intelligence — household cleaners $170.47bn (2026), 4.6% CAGR 2026–2031 (broad scope incl. laundry care)',
    url: 'https://www.mordorintelligence.com/industry-reports/household-cleaners-market',
    grade: 'reported',
  } as SourceRef,
  airCare: {
    label: 'Precedence Research — air freshener $17.19bn (2025), 9.0% CAGR 2026–2035 (this is the air-freshener slice; total "air care" incl. purifiers/odour-control peers run ~$13–15bn on a narrower 2025 base — scope flagged)',
    url: 'https://www.precedenceresearch.com/air-care-market',
    grade: 'reported',
  } as SourceRef,
  laundryServices: {
    label: 'Grand View Research — dry-cleaning & laundry services $78.2bn (2024), 7.3% CAGR (commercial segment 8.0%)',
    url: 'https://www.grandviewresearch.com/industry-analysis/dry-cleaning-laundry-services-market',
    grade: 'reported',
  } as SourceRef,
  onDemand: {
    label: 'Grand View Research — online on-demand laundry $28.48bn (2023), 37.3% CAGR 2025–2030 (platform-market definition; treat as upper bound)',
    url: 'https://www.grandviewresearch.com/press-release/online-on-demand-laundry-service-market',
    grade: 'reported',
  } as SourceRef,
  smartWashers: {
    label: 'Grand View Research — smart washing machines $12.02bn (2024), 24.6% CAGR 2025–2030',
    url: 'https://www.grandviewresearch.com/press-release/global-smart-washing-machine-market',
    grade: 'reported',
  } as SourceRef,
  washingMachines: {
    label: 'Fortune Business Insights — washing machines $66.91bn (2025), 8.6% CAGR 2026–2034',
    url: 'https://www.fortunebusinessinsights.com/washing-machine-market-106532',
    grade: 'reported',
  } as SourceRef,
  enzymes: {
    label: 'Grand View Research — detergent enzymes $1.29bn (2024), 6.8% CAGR 2024–2033',
    url: 'https://www.grandviewresearch.com/horizon/statistics/detergent-enzymes-market-size',
    grade: 'reported',
  } as SourceRef,
  fragranceIngr: {
    label: 'Straits Research — fragrance ingredients $15.16bn (2022), 3.8% CAGR to 2031 (total market; home-care slice derived)',
    url: 'https://www.globenewswire.com/news-release/2023/05/02/2659189/0/en/Fragrance-Ingredients-Market-Size-Worth-USD-21-20-Billion-by-2031.html',
    grade: 'reported',
  } as SourceRef,
  euHomeCare: {
    label: 'Euromonitor International — global Home Care $167bn (2020, retail value RSP; 6.4% CAGR to 2025 ⇒ ~$185–195bn by 2024). Home Care = laundry + dishwashing + surface + bleach + toilet + polishes + air care + insecticides.',
    url: 'https://www.euromonitor.com/article/home-care-industry-overview',
    detail: 'Figure attributed to Euromonitor in the KDC/ONE SEC S-1 (2021); category total — confirm current-year value in Passport.',
    grade: 'reported',
  } as SourceRef,
  klineRank: {
    label: 'Kline & Company (Apr 2026) — global professional hair share: L’Oréal #1; post-Olaplex Henkel #2 at ~12%, ahead of Wella ~10%. Henkel #1 in styling, #3 in colour.',
    url: 'https://klinegroup.com/beauty-and-wellbeing/henkels-potential-olaplex-acquisition/',
    grade: 'reported',
  } as SourceRef,
} as const;

// Helper to mark a derived/estimated use of a reported anchor.
const asDerived = (s: SourceRef, detail: string): SourceRef => ({ ...s, grade: 'derived', detail });
const asEstimate = (s: SourceRef, detail: string): SourceRef => ({ ...s, grade: 'estimate', detail });

// ═══════════════════════════════════════════════════════════════════
// Slides
// ═══════════════════════════════════════════════════════════════════

export const PROFIT_POOL_SLIDES: ProfitPoolSlide[] = [
  // ═════════ Hair — Value Chain (raw → retail) ═════════
  {
    id: 'hair_value_chain',
    title: 'Hair Care — Industry Value Chain Profit Pool',
    subtitle: 'GP1 proxy (anchored to FY2025 filings, not separately reported) | End-consumer pool ~€77bn (Euromonitor ~$88–90bn, 2024 RSP) | € at 1.15',
    poolSize: '~€77bn',
    poolSizeEurBn: 76.7,
    group: 'Hair',
    kind: 'ValueChain',
    prismProxyCategories: ['hair_color', 'hair_care', 'hair_styling', 'hair_body'],
    construction:
      'Chain revenue per tier, normalized to 100%: retail value ~$88–90bn (Euromonitor 2024 RSP; GVR $88.2bn cross-check) split store/online; brand-owner net sales ≈ 50% of retail value; professional products per Kline (~$17bn salon channel — AMR’s $34.8bn all-channel figure retired; professional overlaps consumer retail, flagged); upstream tiers sized from input-cost shares.',
    items: [
      {
        id: 'h_vc_1', label: 'Commodity', sublabel: 'Chemicals',
        revenueShare: 0.03, gp1Margin: 0.22, revenueCAGR: 0.030, gp1DeltaBps: -50,
        revenueDriver: 'Volume tracks category; pricing capped by surfactant overcapacity.',
        marginDriver: 'Energy-cost normalization passed through; commodity tiers cede pricing first.',
        note: 'BASF, Dow, Evonik',
        sources: {
          revenue: [asEstimate(MKT.hairTotal, 'Tier sized at ~6% of retail value (input-cost share), shown as share of chain revenue.')],
          margin: [asDerived(SRC.basf, 'Group gross margin 24.1% as ceiling; commodity surfactant tier set slightly below blend.')],
        },
      },
      {
        id: 'h_vc_2', label: 'Specialty', sublabel: 'Ingredients',
        revenueShare: 0.02, gp1Margin: 0.44, revenueCAGR: 0.055, gp1DeltaBps: 50,
        revenueDriver: 'Actives & sensorial ingredients outgrow base chemistry on premiumization.',
        marginDriver: 'Mix shift to patented actives; innovation pricing holds.',
        note: 'Croda Consumer Care, DSM-Firmenich',
        sources: {
          revenue: [asEstimate(MKT.hairTotal, 'Tier sized at ~4% of retail value; specialty growth premium vs. category structured estimate.')],
          margin: [SRC.croda],
        },
      },
      {
        id: 'h_vc_3', label: 'Fragrance', sublabel: '& Actives',
        revenueShare: 0.01, gp1Margin: 0.41, revenueCAGR: 0.038, gp1DeltaBps: 50,
        revenueDriver: 'Fragrance ingredients market grows 3.8% (Straits, 2022 base).',
        marginDriver: 'Encapsulation/biotech actives lift mix.',
        note: 'Givaudan, Symrise',
        sources: {
          revenue: [MKT.fragranceIngr],
          margin: [asDerived(SRC.givaudan, 'Blend of Givaudan 43.5% and Symrise 37.6% FY2025 gross margins.'), SRC.symrise],
        },
      },
      {
        id: 'h_vc_4', label: 'Brand Owner', sublabel: 'CPG (Retail)',
        revenueShare: 0.24, gp1Margin: 0.53, revenueCAGR: 0.045, gp1DeltaBps: 75,
        revenueDriver: 'Category ~4–5% (Euromonitor ~3% all-category current value + branded premium/treatment-mix lift).',
        marginDriver: 'Premiumization and RGM outpace private-label drag in beauty-adjacent hair.',
        note: 'P&G Beauty, L’Oréal CPD, Henkel HCB Hair',
        linkedCategoryId: 'hair_care',
        sources: {
          revenue: [MKT.hairTotal],
          margin: [
            asDerived(SRC.pg, 'P&G group GM 51.2% (Beauty $15.0bn net sales); tier GP1 calibrated between P&G/Henkel (~51%) and L’Oréal/Beiersdorf (58–74%).'),
            SRC.henkel,
            SRC.loreal,
            SRC.beiersdorf,
          ],
        },
      },
      {
        id: 'h_vc_5', label: 'Professional', sublabel: 'Products',
        revenueShare: 0.10, gp1Margin: 0.58, revenueCAGR: 0.040, gp1DeltaBps: 50,
        revenueDriver: 'Kline: ~4% growth (salon channel); premium colour & bond services pull through.',
        marginDriver: 'Salon-exclusive positioning protects price; education moat.',
        note: 'L’Oréal Pro, Wella, Schwarzkopf Pro. Sized on Kline’s salon-channel ~$17bn (not AMR’s broader $34.8bn all-channel figure); the salon-products tier overlaps consumer retail.',
        sources: {
          revenue: [MKT.proHair],
          margin: [asDerived(SRC.loreal, 'L’Oréal group GM 74.3% with PPD op. margin 22.9% implies professional GP1 in the high-50s after salon trade terms.')],
        },
      },
      {
        id: 'h_vc_6', label: 'Wholesale /', sublabel: 'Distribution',
        revenueShare: 0.04, gp1Margin: 0.16, revenueCAGR: 0.030, gp1DeltaBps: -50,
        revenueDriver: 'Disintermediation: brands ship direct to large retail and DTC.',
        marginDriver: 'Thin spreads compress further as retail consolidates.',
        note: 'Metro, regional distributors',
        sources: {
          revenue: [asEstimate(MKT.hairTotal, 'Tier sized at ~8% of retail value flowing via wholesale.')],
          margin: [SRC.metro],
        },
      },
      {
        id: 'h_vc_7', label: 'Store', sublabel: 'Retail',
        revenueShare: 0.46, gp1Margin: 0.24, revenueCAGR: 0.045, gp1DeltaBps: -100,
        revenueDriver: 'Category growth minus online share shift (~1.5pp/yr drag).',
        marginDriver: 'Discounter share gains; retail media only partly offsets.',
        note: 'Walmart, dm, Rossmann, Boots',
        sources: {
          revenue: [asDerived(MKT.hairTotal, 'Retail value $88.2bn less online share; store retail carries shelf price = largest single revenue tier.')],
          margin: [SRC.walmart, SRC.carrefour],
        },
      },
      {
        id: 'h_vc_8', label: 'E-Com /', sublabel: 'DTC',
        revenueShare: 0.10, gp1Margin: 0.32, revenueCAGR: 0.110, gp1DeltaBps: 150,
        revenueDriver: 'Online beauty keeps gaining ~2–4pp over category; DTC premium brands scale.',
        marginDriver: 'Mix shifts toward high-margin DTC + retail-media monetization.',
        note: 'Amazon Beauty, DTC (bond/treatment brands)',
        linkedCategoryId: null,
        sources: {
          revenue: [asEstimate(MKT.hairTotal, 'Online share of hair retail ~20% growing above category; tier CAGR = category +4pp, structured estimate.')],
          margin: [asEstimate(SRC.olaplex, 'Pure-DTC premium comp at 69.4% GM; blended marketplace economics dilute the tier to ~low-30s GP1.')],
        },
      },
    ],
    insights: [
      'Brand owner (53% GP1) and professional products (58% GP1) hold the richest tiers of a ~€77bn end-consumer pool growing ~4% nominal (Euromonitor) — both backed by FY2025 filings (P&G 51.2%, L’Oréal 74.3% group GM).',
      'Store retail moves the most revenue (≈37% of chain) at 24% GP1 and is the only tier with a clearly shrinking margin trajectory — the pool migrates to e-com/DTC (+11% revenue, +150bps margin drift).',
      'Upstream is small but not poor: specialty ingredients earn 44% GP1 (Croda FY2025: 43.9% reported) — the "boring chemicals" stereotype only holds for the commodity tier.',
      'Henkel angle: HCB group GM 50.8% (FY2025) sits ~2pts below the calibrated brand-owner tier — the gap is mix (treatments/scalp under-index), not conversion cost.',
    ],
  },

  // ═════════ Laundry — Value Chain (raw → retail) ═════════
  {
    id: 'laundry_value_chain',
    title: 'Laundry Care — Industry Value Chain Profit Pool',
    subtitle: 'GP1 proxy (anchored to FY2025 filings) | End-consumer Laundry Care pool ~€74bn (Euromonitor ~$85bn, 2024 RSP — confirm in Passport) | € at 1.15',
    poolSize: '~€74bn',
    poolSizeEurBn: 73.9,
    group: 'LHC',
    kind: 'ValueChain',
    prismProxyCategories: ['lhc_fcn', 'lhc_fca', 'lhc_ffi', 'lhc_lad'],
    construction:
      'Chain revenue per tier, normalized to 100%: Laundry Care retail value ~$85bn (Euromonitor 2024 RSP; the prior GVR "$185bn laundry detergent" figure ≈ the entire Home Care universe, retired) split store/online; brand-owner net sales ≈ 50% of retail value; adjacent flows (appliances $66.9bn FBI, services $78.2bn GVR) shown as own tiers.',
    items: [
      {
        id: 'l_vc_1', label: 'Commodity', sublabel: 'Chemicals',
        revenueShare: 0.04, gp1Margin: 0.22, revenueCAGR: 0.025, gp1DeltaBps: -50,
        revenueDriver: 'Surfactant volumes track category; pricing power stays weak.',
        marginDriver: 'Overcapacity in LAB/AES chains keeps spreads compressed.',
        note: 'BASF, Clariant, INEOS',
        sources: {
          revenue: [asEstimate(MKT.laundryTotal, 'Tier sized at ~10% of retail value (input-cost share of detergent COGS).')],
          margin: [asDerived(SRC.basf, 'BASF group GM 24.1% as ceiling for the commodity tier.')],
        },
      },
      {
        id: 'l_vc_2', label: 'Enzymes /', sublabel: 'Specialty',
        revenueShare: 0.01, gp1Margin: 0.54, revenueCAGR: 0.068, gp1DeltaBps: 100,
        revenueDriver: 'Detergent enzymes 6.8% CAGR (GVR) — cold-wash & concentration tailwinds.',
        marginDriver: 'Patented strains price on performance; Novonesis margin already 53.9% reported.',
        note: 'Novonesis',
        sources: {
          revenue: [MKT.enzymes],
          margin: [SRC.novonesis],
        },
      },
      {
        id: 'l_vc_3', label: 'Fragrance /', sublabel: 'Encapsulation',
        revenueShare: 0.01, gp1Margin: 0.41, revenueCAGR: 0.038, gp1DeltaBps: 50,
        revenueDriver: 'Scent is the #1 sensory purchase driver; encapsulation grows above base fragrance.',
        marginDriver: 'Encapsulation tech mix improves.',
        note: 'Givaudan, Symrise',
        sources: {
          revenue: [asDerived(MKT.fragranceIngr, 'Home-care slice of the $15.16bn fragrance-ingredients market (~1/3), grown at the reported 3.8% CAGR.')],
          margin: [asDerived(SRC.givaudan, 'Blend of Givaudan 43.5% / Symrise 37.6% FY2025.'), SRC.symrise],
        },
      },
      {
        id: 'l_vc_4', label: 'Brand Owner', sublabel: 'CPG',
        revenueShare: 0.20, gp1Margin: 0.46, revenueCAGR: 0.045, gp1DeltaBps: -50,
        revenueDriver: 'Category ~4–5% nominal (Euromonitor) — EM volume + DM price/mix.',
        marginDriver: 'Private label + retailer pressure outweigh RGM in laundry (unlike hair).',
        note: 'P&G Fabric Care, Henkel LHC, Unilever Home Care',
        linkedCategoryId: 'lhc_fcn',
        sources: {
          revenue: [MKT.laundryTotal],
          margin: [
            asDerived(SRC.unilever, 'Unilever group GM 46.9% (Home Care op. margin 14.9%) as primary anchor; cross-checked vs. C&D 44.7% and Henkel 50.8%.'),
            SRC.chd,
            SRC.henkel,
            SRC.henkelHcb,
          ],
        },
      },
      {
        id: 'l_vc_5', label: 'Wholesale /', sublabel: 'Distribution',
        revenueShare: 0.03, gp1Margin: 0.16, revenueCAGR: 0.020, gp1DeltaBps: -50,
        revenueDriver: 'Big-box direct supply bypasses wholesale.',
        marginDriver: 'Spread compression continues.',
        note: 'Metro, regional distributors',
        sources: {
          revenue: [asEstimate(MKT.laundryTotal, 'Tier sized at ~7% of retail value flowing via wholesale.')],
          margin: [SRC.metro],
        },
      },
      {
        id: 'l_vc_6', label: 'Store', sublabel: 'Retail',
        revenueShare: 0.35, gp1Margin: 0.22, revenueCAGR: 0.040, gp1DeltaBps: -100,
        revenueDriver: 'Category growth minus online shift; discounters gain share within store.',
        marginDriver: 'Laundry is a known-value-item battleground — retailers invest margin here.',
        note: 'Walmart, Lidl, Carrefour, Edeka',
        sources: {
          revenue: [asDerived(MKT.laundryTotal, 'Retail value less online share; store retail = largest revenue tier.')],
          margin: [SRC.walmart, SRC.carrefour],
        },
      },
      {
        id: 'l_vc_7', label: 'E-Com',
        revenueShare: 0.05, gp1Margin: 0.28, revenueCAGR: 0.090, gp1DeltaBps: 100,
        revenueDriver: 'Subscribe & save + quick commerce lift heavy/bulky replenishment online.',
        marginDriver: 'Retail media and private-fleet density improve unit economics.',
        note: 'Amazon Consumables, retailer apps',
        sources: {
          revenue: [asEstimate(MKT.laundryTotal, 'Online share of laundry ~10–12% growing above category; structured estimate.')],
          margin: [asEstimate(SRC.walmart, 'Online consumables typically 200–400bps above store gross margin before fulfillment; Walmart 24.9% FY2026 as base.')],
        },
      },
      {
        id: 'l_vc_8', label: 'Laundry', sublabel: 'Services',
        revenueShare: 0.17, gp1Margin: 0.36, revenueCAGR: 0.073, gp1DeltaBps: 50,
        revenueDriver: 'Dry-cleaning & laundry services 7.3% CAGR (GVR 2024); urbanization + outsourcing.',
        marginDriver: 'Route density and automation lift service gross margins slowly.',
        note: 'GVR scope incl. residential (~60%); commercial segment grows 8.0%.',
        sources: {
          revenue: [MKT.laundryServices],
          margin: [asEstimate(SRC.allianceLaundry, 'Service-level GP1 estimated mid-30s; equipment comp Alliance Laundry 37.6% reported FY2025.')],
        },
      },
      {
        id: 'l_vc_9', label: 'Appliance', sublabel: 'OEMs',
        revenueShare: 0.14, gp1Margin: 0.16, revenueCAGR: 0.086, gp1DeltaBps: -100,
        revenueDriver: 'Washing machines $66.9bn growing 8.6% (FBI) on EM penetration + replacement.',
        marginDriver: 'Asian OEM price competition; Whirlpool FY2025 GM is just 15.4% reported.',
        note: 'Whirlpool, BSH, LG, Haier',
        sources: {
          revenue: [MKT.washingMachines],
          margin: [SRC.whirlpool],
        },
      },
    ],
    insights: [
      'The chain’s margin geography inverts the hair picture: brand owner GP1 is ~46% (vs. 53% in hair) while Reckitt-class specialists keep 60%+ — laundry brand economics are real but private-label-pressured (Unilever 46.9%, C&D 44.7% FY2025 reported).',
      'Corrected this release: appliance OEMs earn 16% GP1, not the ~26% previously claimed — Whirlpool’s reported FY2025 gross margin is 15.4%. Hardware is a revenue giant (~14% of chain) and a margin dwarf.',
      'Enzymes are the chain’s hidden champion: 54% GP1 reported at Novonesis, 6.8% growth, +100bps drift — a richer pool than the brand-owner tier it supplies.',
      'Services (~17% of chain revenue, 7.3% growth) are the fastest-compounding mid-margin tier — relevant as a demand signal for professional-grade formats, not as a Henkel play.',
    ],
  },

  // ═════════ Hair — Sub-Segments (format logic: volume → specialty) ═════════
  {
    id: 'hair_sub_segments',
    title: 'Hair Care — Sub-Segment Profit Pools',
    subtitle: 'Brand-owner GP1 proxy by format | Segment sizes sum to ~Euromonitor $88–90bn hair-care total | € at 1.15',
    poolSize: '~€77bn',
    poolSizeEurBn: 76.7,
    group: 'Hair',
    kind: 'SubSegment',
    prismProxyCategories: ['hair_care', 'hair_color', 'hair_styling'],
    construction:
      'Per-format splits triangulated from specialist reports pending Passport confirmation. Shares = per-segment sizes normalized over their sum ($87.1bn ≈ Euromonitor ~$88–90bn — independent reports reconcile within ~1%): shampoo $38.2bn, colour $26.1bn, styling $10.0bn, conditioner $5.3bn, oil $4.7bn, serums $1.3bn, supplements $0.8bn, masks $0.7bn. Base years 2024–2026 as published. Scope flag: hair colour includes professional colourants — wider than retail-only colour. NB Euromonitor’s ~3% all-category current-value CAGR is below several segment-specialist growth rates shown here.',
    items: [
      {
        id: 'h_sub_1', label: 'Shampoo',
        revenueShare: 0.43, gp1Margin: 0.44, revenueCAGR: 0.059, gp1DeltaBps: -50,
        revenueDriver: 'FBI: 5.9% CAGR — EM premiumization carries a mature DM base.',
        marginDriver: 'Private label + price anchoring grind the format’s floor.',
        linkedCategoryId: 'hair_care',
        sources: {
          revenue: [MKT.shampoo],
          margin: [asDerived(SRC.pg, 'Volume format set below the brand-owner blend: P&G 51.2%, Unilever 46.9%, Kao 39.6% group GMs.'), SRC.unilever, SRC.kao],
        },
      },
      {
        id: 'h_sub_2', label: 'Conditioner',
        revenueShare: 0.06, gp1Margin: 0.48, revenueCAGR: 0.077, gp1DeltaBps: 50,
        revenueDriver: 'FBI: 7.7% CAGR — routine-stacking (condition + treat) expands usage.',
        marginDriver: 'Attach-rate premium vs. shampoo persists.',
        linkedCategoryId: 'hair_care',
        sources: {
          revenue: [MKT.conditioner],
          margin: [asDerived(SRC.unilever, 'Set between volume formats and treatments; Unilever 46.9% / Beiersdorf 57.7% as bounds.'), SRC.beiersdorf],
        },
      },
      {
        id: 'h_sub_3', label: 'Hair Color',
        revenueShare: 0.30, gp1Margin: 0.58, revenueCAGR: 0.059, gp1DeltaBps: 100,
        revenueDriver: 'GVR: 5.9% CAGR — root touch-up frequency + fashion shades.',
        marginDriver: 'Chemistry IP + low private-label credibility = strongest pricing in hair.',
        note: 'GVR scope includes professional colorants.',
        linkedCategoryId: 'hair_color',
        sources: {
          revenue: [MKT.hairColor],
          margin: [asDerived(SRC.loreal, 'Color skews to the L’Oréal end of the blend (group GM 74.3%); Henkel 50.8% anchors the floor.'), SRC.henkel],
        },
      },
      {
        id: 'h_sub_4', label: 'Styling',
        revenueShare: 0.12, gp1Margin: 0.52, revenueCAGR: 0.044, gp1DeltaBps: 0,
        revenueDriver: 'Mordor: 4.4% CAGR — texture/social-media looks offset spray decline.',
        marginDriver: 'Stable: aerosol cost pass-through balances premium texturizers.',
        linkedCategoryId: 'hair_styling',
        sources: {
          revenue: [MKT.styling],
          margin: [asDerived(SRC.henkel, 'Henkel group GM 50.8% as floor for its strongest-share format; modest format premium.')],
        },
      },
      {
        id: 'h_sub_5', label: 'Masks /', sublabel: 'Treatments',
        revenueShare: 0.01, gp1Margin: 0.62, revenueCAGR: 0.056, gp1DeltaBps: 150,
        revenueDriver: 'Mordor: ~5.6% CAGR; bond-repair positioning keeps price points high.',
        marginDriver: 'Premium/prestige mix shift — fastest margin build in hair.',
        linkedCategoryId: 'hair_care',
        sources: {
          revenue: [MKT.masks],
          margin: [asDerived(SRC.olaplex, 'Olaplex 69.4% reported FY2025 as premium ceiling; mass treatments dilute the format to low-60s.')],
        },
      },
      {
        id: 'h_sub_6', label: 'Hair Oil',
        revenueShare: 0.05, gp1Margin: 0.54, revenueCAGR: 0.035, gp1DeltaBps: 0,
        revenueDriver: 'IMARC: 3.5% CAGR — large South-Asia ritual base, slower DM adoption.',
        marginDriver: 'Stable: commodity oils vs. prestige blends offset.',
        linkedCategoryId: 'hair_care',
        sources: {
          revenue: [MKT.hairOil],
          margin: [asEstimate(SRC.kao, 'No public oil-format margin; set between volume and treatment formats. Kao 39.6% / Beiersdorf 57.7% as wide bounds.')],
        },
      },
      {
        id: 'h_sub_7', label: 'Serums /', sublabel: 'Leave-in',
        revenueShare: 0.02, gp1Margin: 0.62, revenueCAGR: 0.071, gp1DeltaBps: 150,
        revenueDriver: 'GVR: 7.1% CAGR — skinification of hair routines.',
        marginDriver: 'Prestige-adjacent pricing; DTC share rich.',
        linkedCategoryId: 'hair_care',
        sources: {
          revenue: [MKT.serum],
          margin: [asDerived(SRC.olaplex, 'Olaplex 69.4% reported as the pure-play comp; format blend set at 62%.')],
        },
      },
      {
        id: 'h_sub_8', label: 'Hair', sublabel: 'Supplements',
        revenueShare: 0.01, gp1Margin: 0.68, revenueCAGR: 0.155, gp1DeltaBps: 100,
        revenueDriver: 'GVR: 15.5% CAGR — ingestible beauty rides GLP-1-era hair-loss anxiety.',
        marginDriver: 'Supplement economics: low COGS, brand-driven pricing.',
        linkedCategoryId: null,
        sources: {
          revenue: [MKT.supplements],
          margin: [asEstimate(SRC.olaplex, 'No supplement pure-play files GP1; premium beauty comp 69.4% (Olaplex) and C&D 44.7% (mass VMS) bracket the estimate.'), SRC.chd],
        },
      },
    ],
    insights: [
      'Independent segment reports reconcile to Euromonitor’s ~$88–90bn hair-care total within ~1% — rare cross-source consistency; the share base is unusually solid for public data.',
      'Hair color is 30% of the pool at 58% GP1 with +100bps drift — on this scope (incl. professional colorants) it, not shampoo, is the category’s profit engine. Henkel is structurally long the right pool.',
      'The margin build is at the small end: masks, serums and supplements (1–2% shares) carry 62–68% GP1 and the fastest pool growth (6–16%) — portfolio question is speed of entry, not whether.',
      'Shampoo: 43% of revenue, GP1 floor (44%), negative drift — the classic volume anchor that funds, but does not create, the next pool.',
    ],
  },

  // ═════════ Hair — Core + Adjacent (CORE first) ═════════
  {
    id: 'hair_core_adjacent',
    title: 'Hair Care — Core + Adjacent Profit Pools',
    subtitle: 'Core branded products vs. adjacent pools | Combined ~€263bn ($303bn) | € at 1.15',
    poolSize: '~€263bn',
    poolSizeEurBn: 263.3,
    group: 'Hair',
    kind: 'CoreAdjacent',
    prismProxyCategories: ['hair_color', 'hair_care', 'hair_styling', 'hair_body'],
    construction:
      'Pool sizes side by side, normalized: core retail hair care $88.2bn (Euromonitor ~$88–90bn), salon services ~$150bn (triangulated — no tier-1 source sizes salon SERVICES; FBI’s $203.8bn treated as a scope-inflated ceiling), professional products ~$17bn (Kline 2024, salon channel — AMR’s $34.8bn all-channel figure retired), tools $29.4bn (FBI 2025), scalp care $15.8bn (CMI 2026 — cross-cuts retail formats, flagged), beauty subscriptions $1.6bn (FMI 2025), supplements $0.8bn (GVR 2024). Men’s grooming and beauty-tech dropped vs. v1: published scopes too broad to slot honestly.',
    items: [
      {
        id: 'h_ca_1', label: 'CORE', sublabel: 'Branded Hair (Retail)',
        revenueShare: 0.291, gp1Margin: 0.53, revenueCAGR: 0.045, gp1DeltaBps: 75,
        revenueDriver: 'Euromonitor: ~4–5% on the ~$90bn retail pool (~3% all-category + branded premium lift).',
        marginDriver: 'Premiumization + treatment mix outpace PL drag.',
        linkedCategoryId: 'hair_care',
        sources: {
          revenue: [MKT.hairTotal],
          margin: [asDerived(SRC.pg, 'Calibrated vs. P&G 51.2% / Henkel 50.8% / L’Oréal 74.3% / Beiersdorf 57.7% FY2025 reported.'), SRC.henkel, SRC.loreal],
        },
      },
      {
        id: 'h_ca_2', label: 'Salon', sublabel: 'Services',
        revenueShare: 0.495, gp1Margin: 0.42, revenueCAGR: 0.060, gp1DeltaBps: 0,
        revenueDriver: '~6% CAGR (triangulated, not FBI’s 7.6% ceiling) — services inflation + premium treatments.',
        marginDriver: 'Labor 50–60% of revenue caps service GP1 structurally.',
        note: 'Largest hair pool by far; labor-intensive economics.',
        linkedCategoryId: null,
        sources: {
          revenue: [MKT.salonServices],
          margin: [asEstimate(MKT.salonServices, 'Salon-level GP after stylist labor typically ~40–45%; pure franchisors (Regis: 100% GM on fees) are not representative — structured estimate.')],
        },
      },
      {
        id: 'h_ca_3', label: 'Professional', sublabel: 'Products',
        revenueShare: 0.056, gp1Margin: 0.58, revenueCAGR: 0.040, gp1DeltaBps: 50,
        revenueDriver: 'Kline: ~4% growth (salon channel); bond/colour services pull back-bar demand.',
        marginDriver: 'Salon exclusivity + education moat hold price.',
        linkedCategoryId: null,
        sources: {
          revenue: [MKT.proHair],
          margin: [asDerived(SRC.loreal, 'L’Oréal 74.3% group GM / PPD 22.9% op. margin imply high-50s professional GP1.')],
        },
      },
      {
        id: 'h_ca_4', label: 'Hair Tools', sublabel: '& Appliances',
        revenueShare: 0.097, gp1Margin: 0.46, revenueCAGR: 0.053, gp1DeltaBps: -50,
        revenueDriver: 'FBI: 5.3% CAGR — premium dryers/stylers replace cycle.',
        marginDriver: 'Fast-follower commoditization of premium hardware.',
        linkedCategoryId: null,
        sources: {
          revenue: [MKT.hairTools],
          margin: [SRC.helenOfTroy],
        },
      },
      {
        id: 'h_ca_5', label: 'Scalp', sublabel: 'Care',
        revenueShare: 0.052, gp1Margin: 0.58, revenueCAGR: 0.073, gp1DeltaBps: 100,
        revenueDriver: 'CMI: 7.3% CAGR — dermo positioning, hair-loss anxiety, skinification.',
        marginDriver: 'Dermo/active claims justify prestige pricing.',
        note: 'CMI scope cross-cuts shampoo/treatment formats — overlay, not strictly additive.',
        linkedCategoryId: 'hair_care',
        sources: {
          revenue: [MKT.scalp],
          margin: [asDerived(SRC.beiersdorf, 'Dermo comp: Beiersdorf 57.7% reported FY2025; L’Oréal dermo skews higher.'), SRC.loreal],
        },
      },
      {
        id: 'h_ca_6', label: 'Subscription', sublabel: '/ DTC Beauty',
        revenueShare: 0.005, gp1Margin: 0.50, revenueCAGR: 0.259, gp1DeltaBps: 100,
        revenueDriver: 'FMI: 25.9% CAGR — personalization + replenishment lock-in.',
        marginDriver: 'Scale leverage on fulfillment; churn is the margin risk.',
        linkedCategoryId: null,
        sources: {
          revenue: [MKT.beautySub],
          margin: [asEstimate(SRC.olaplex, 'DTC comp bracket: Olaplex 69.4% product GM less fulfillment/churn economics → ~50% GP1 estimate.')],
        },
      },
      {
        id: 'h_ca_7', label: 'Hair', sublabel: 'Supplements',
        revenueShare: 0.0025, gp1Margin: 0.68, revenueCAGR: 0.155, gp1DeltaBps: 50,
        revenueDriver: 'GVR: 15.5% CAGR from a small base.',
        marginDriver: 'Ingestible-beauty economics hold while category professionalizes.',
        linkedCategoryId: null,
        sources: {
          revenue: [MKT.supplements],
          margin: [asEstimate(SRC.olaplex, 'Bracketed by Olaplex 69.4% (premium beauty) and C&D 44.7% (mass VMS).'), SRC.chd],
        },
      },
    ],
    insights: [
      'The verified adjacency map redraws the category: salon services (~€130bn, ~50% of the combined pool) still dwarf core retail (~€77bn) — hair is a services category with a products attach, not the reverse. (Salon sized on the triangulated ~$150bn estimate — no tier-1 source sizes salon SERVICES — not FBI’s $203.8bn ceiling.)',
      'Henkel’s monetization route into the biggest pool is indirect: professional products (~€15bn, 58% GP1; Kline salon-channel basis) ride the ~6%-growing services pool — back-bar share is the lever, not salon ownership.',
      'Scalp care (€14bn, 58% GP1, +100bps drift) is the richest adjacency Henkel can enter from existing chemistry — supplements and subscriptions are options, scalp is the move.',
      'Tools at 46% GP1 (Helen of Troy 45.7% reported FY2026) lose margin as premium hardware commoditizes — partner, don’t build.',
    ],
  },

  // ═════════ Laundry — Sub-Segments (format logic) ═════════
  {
    id: 'laundry_sub_segments',
    title: 'Laundry Care — Sub-Segment Profit Pools',
    subtitle: 'Brand-owner GP1 proxy by format | Euromonitor Laundry Care ~$85bn (2024 RSP); format mix triangulated | € at 1.15',
    poolSize: '~€74bn',
    poolSizeEurBn: 73.9,
    group: 'LHC',
    kind: 'SubSegment',
    prismProxyCategories: ['lhc_fcn', 'lhc_fca', 'lhc_ffi', 'lhc_lad'],
    construction:
      'Format MIX (the shares) triangulated from specialist reports: powder >32% (GVR), pods/softener/stain from GVR sister reports, boosters (PMR), specialty proxied by baby cleaning (Precedence); liquid & gels = residual (~40%). Absolute € is rebased onto the Euromonitor Laundry Care total (~$85bn, 2024 RSP; confirm in Passport); the bars are the format mix, not separate single-source markets. Eco/concentrates excluded as a bar: cross-cutting, not a MECE format.',
    items: [
      {
        id: 'l_sub_1', label: 'Liquid', sublabel: '& Gels',
        revenueShare: 0.40, gp1Margin: 0.44, revenueCAGR: 0.059, gp1DeltaBps: -50,
        revenueDriver: 'FBI liquid report: 5.9% CAGR — DM workhorse format, EM trade-up target.',
        marginDriver: 'Heaviest private-label battleground after powder.',
        note: 'Share = residual of the GVR family (derived).',
        linkedCategoryId: 'lhc_fcn',
        sources: {
          revenue: [asDerived(MKT.laundryTotal, 'Residual: $185.3bn total minus published powder/pods/softener/stain/boosters/specialty.'), MKT.liquid],
          margin: [asDerived(SRC.pg, 'P&G 51.2% / Unilever 46.9% / Henkel 50.8% group GMs bracket the format at ~44% after PL drag.'), SRC.unilever],
        },
      },
      {
        id: 'l_sub_2', label: 'Powder',
        revenueShare: 0.31, gp1Margin: 0.38, revenueCAGR: 0.000, gp1DeltaBps: -150,
        revenueDriver: 'DM decline offsets EM affordability growth — net flat (structured estimate; GVR states powder still >32% share).',
        marginDriver: 'Price-fighter tier + EM mix: the steepest margin erosion in laundry.',
        linkedCategoryId: 'lhc_fcn',
        sources: {
          revenue: [asDerived(MKT.laundryTotal, '">32% of total revenue in 2023" stated on-page; growth split DM/EM is a structured estimate.')],
          margin: [asEstimate(SRC.unilever, 'Volume format set ~6pts below the brand-owner blend (Unilever 46.9%, Kao 39.6% reported).'), SRC.kao],
        },
      },
      {
        id: 'l_sub_3', label: 'Stain', sublabel: 'Removers',
        revenueShare: 0.12, gp1Margin: 0.50, revenueCAGR: 0.051, gp1DeltaBps: 0,
        revenueDriver: 'GVR: 5.1% CAGR (scope incl. surface stain products — flagged).',
        marginDriver: 'Specialist branding (Vanish) holds price; PL nibbles the edges.',
        linkedCategoryId: 'lhc_lad',
        sources: {
          revenue: [MKT.stain],
          margin: [asDerived(SRC.reckitt, 'Reckitt group GM 60.8% reported — specialist premium over base detergent calibrates the format at ~50%.')],
        },
      },
      {
        id: 'l_sub_4', label: 'Fabric', sublabel: 'Softener',
        revenueShare: 0.08, gp1Margin: 0.46, revenueCAGR: 0.034, gp1DeltaBps: -50,
        revenueDriver: 'GVR: 3.4% CAGR — sensorial habit, but skip-the-rinse trends cap it.',
        marginDriver: 'Concentrates help; PL share rises slowly.',
        linkedCategoryId: 'lhc_ffi',
        sources: {
          revenue: [MKT.softener],
          margin: [asDerived(SRC.unilever, 'Unilever 46.9% group GM as the anchor for its strongest fabric-enhancer portfolio.')],
        },
      },
      {
        id: 'l_sub_5', label: 'Pods /', sublabel: 'Discs',
        revenueShare: 0.06, gp1Margin: 0.52, revenueCAGR: 0.065, gp1DeltaBps: 100,
        revenueDriver: 'GVR: 6.5% CAGR — convenience premium keeps converting liquid users.',
        marginDriver: 'Unit-dose premium + weak PL replication = best margin build in laundry.',
        linkedCategoryId: 'lhc_fca',
        sources: {
          revenue: [MKT.pods],
          margin: [asDerived(SRC.pg, 'Unit-dose carries the top of the P&G 51.2% / Henkel 50.8% brand-owner range.'), SRC.henkel],
        },
      },
      {
        id: 'l_sub_6', label: 'Specialty', sublabel: '(Delicates etc.)',
        revenueShare: 0.03, gp1Margin: 0.48, revenueCAGR: 0.051, gp1DeltaBps: 50,
        revenueDriver: 'Care-for-clothes positioning grows with garment-longevity trend (proxy: baby/specialty 5.1%).',
        marginDriver: 'Niche claims (wool, sport, black) price above base.',
        note: 'Sized via baby/specialty proxy — flagged.',
        linkedCategoryId: 'lhc_lad',
        sources: {
          revenue: [asDerived(MKT.babySpecialty, 'Baby cleaning products used as the closest verified specialty proxy.')],
          margin: [asDerived(SRC.henkel, 'Henkel group GM 50.8% reported; Perwoll positioned above the laundry blend.')],
        },
      },
      {
        id: 'l_sub_7', label: 'Scent', sublabel: 'Boosters',
        revenueShare: 0.003, gp1Margin: 0.58, revenueCAGR: 0.093, gp1DeltaBps: 50,
        revenueDriver: 'PMR: 9.3% CAGR — pure-indulgence add-on rides the fragrance supercycle.',
        marginDriver: 'Fragrance beads: low COGS, brand-led pricing.',
        note: 'Lower-tier source — treat size as indicative.',
        linkedCategoryId: 'lhc_ffi',
        sources: {
          revenue: [MKT.boosters],
          margin: [asEstimate(SRC.pg, 'No format disclosure exists; fragrance-led add-ons set above unit-dose, below supplements. P&G 51.2% group GM as base.')],
        },
      },
    ],
    insights: [
      'The laundry pool is barbelled: 71% of revenue sits in liquid + powder at ≤44% GP1 and flat-to-negative margin drift; nearly all margin build concentrates in pods, specialty and boosters (9% of revenue).',
      'Powder is the honest decline story: ~31% share, 38% GP1, −150bps drift, ~0% growth — a pool to harvest, not defend. Persil Discs migration is the value-preserving exit ramp.',
      'Pods at 6.5% growth and +100bps drift are the only format where revenue AND margin compound — the pool grows ~7% p.a. all-in (GVR 2023 base).',
      'Scent boosters: a ~€0.2bn rounding error today, but the fastest-compounding pool on the slide (~9.5% all-in) — cheap optionality for Vernel’s fragrance equity.',
    ],
  },

  // ═════════ Laundry — Core + Adjacent (CORE first) ═════════
  {
    id: 'laundry_core_adjacent',
    title: 'Laundry Care — Core + Adjacent Profit Pools',
    subtitle: 'Core branded products vs. adjacent pools | Combined ~€335bn ($385bn) | € at 1.15',
    poolSize: '~€335bn',
    poolSizeEurBn: 334.5,
    group: 'LHC',
    kind: 'CoreAdjacent',
    prismProxyCategories: ['lhc_fcn', 'lhc_fca', 'lhc_ffi', 'lhc_adw', 'lhc_hsc'],
    construction:
      'Pool sizes side by side, normalized: core Laundry Care ~$85bn (Euromonitor 2024 RSP — the prior GVR $185.3bn was ~the whole Home Care universe, retired; Euromonitor Home Care $167bn 2020 RSP for context), washing machines $66.9bn (FBI 2025), laundry services $78.2bn (GVR 2024), surface cleaners ~$55bn (derived: Mordor household cleaners $170.5bn minus laundry-care overlap — flagged), on-demand laundry $28.5bn (GVR 2023, definition flagged), hand dish $22.7bn (BRI 2026), ADW $19.2bn (Market.us 2024), air freshener $17.2bn (Precedence 2025), smart washers $12.0bn (GVR 2024).',
    items: [
      {
        id: 'l_ca_1', label: 'CORE', sublabel: 'Laundry (Branded)',
        revenueShare: 0.221, gp1Margin: 0.46, revenueCAGR: 0.045, gp1DeltaBps: -50,
        revenueDriver: 'Euromonitor: ~4–5% nominal on the ~$85bn Laundry Care pool.',
        marginDriver: 'PL + retailer pressure slightly outweigh RGM.',
        linkedCategoryId: 'lhc_fcn',
        sources: {
          revenue: [MKT.laundryTotal],
          margin: [asDerived(SRC.unilever, 'Unilever 46.9% / C&D 44.7% / Henkel 50.8% FY2025 reported bracket the tier.'), SRC.chd, SRC.henkel],
        },
      },
      {
        id: 'l_ca_2', label: 'Laundry', sublabel: 'Services',
        revenueShare: 0.203, gp1Margin: 0.40, revenueCAGR: 0.073, gp1DeltaBps: 50,
        revenueDriver: 'GVR: 7.3% CAGR (commercial segment 8.0%).',
        marginDriver: 'Automation + route density lift service margins slowly.',
        note: 'Scope incl. residential (~60%).',
        linkedCategoryId: null,
        sources: {
          revenue: [MKT.laundryServices],
          margin: [asEstimate(SRC.ecolab, 'Ecolab 44.5% reported FY2025 is the products+service comp; pure services set below it.')],
        },
      },
      {
        id: 'l_ca_3', label: 'Appliance', sublabel: 'OEMs',
        revenueShare: 0.174, gp1Margin: 0.16, revenueCAGR: 0.086, gp1DeltaBps: -100,
        revenueDriver: 'FBI: 8.6% CAGR — EM penetration + connected replacement cycle.',
        marginDriver: 'Whirlpool 15.4% reported FY2025; Asian price war continues.',
        linkedCategoryId: null,
        sources: {
          revenue: [MKT.washingMachines],
          margin: [SRC.whirlpool],
        },
      },
      {
        id: 'l_ca_4', label: 'Surface', sublabel: 'Cleaners',
        revenueShare: 0.143, gp1Margin: 0.46, revenueCAGR: 0.046, gp1DeltaBps: -50,
        revenueDriver: 'Mordor household-cleaners family: 4.6% CAGR.',
        marginDriver: 'Reckitt-class specialists hold 60%+; PL erodes the middle.',
        note: 'Size derived by subtracting laundry overlap from Mordor’s broad scope.',
        linkedCategoryId: 'lhc_hsc',
        sources: {
          revenue: [asDerived(MKT.householdCleaners, 'Mordor $170.5bn (2026, scope incl. laundry care) minus GVR-implied laundry ≈ $55bn surface/other.')],
          margin: [asDerived(SRC.reckitt, 'Reckitt 60.8% / Unilever 46.9% / Clorox 45.2% reported bracket the tier.'), SRC.clorox, SRC.unilever],
        },
      },
      {
        id: 'l_ca_5', label: 'On-Demand', sublabel: 'Laundry Apps',
        revenueShare: 0.074, gp1Margin: 0.35, revenueCAGR: 0.150, gp1DeltaBps: 200,
        revenueDriver: 'GVR publishes 37.3% CAGR on a platform-wide definition — we plan on a conservative ~15% (estimate; verified figure linked).',
        marginDriver: 'Platform take-rates scale with density; loss-making today at unit level.',
        linkedCategoryId: null,
        sources: {
          revenue: [asEstimate(MKT.onDemand, 'GVR $28.5bn (2023) / 37.3% CAGR taken as upper bound; planning CAGR moderated to 15%.')],
          margin: [asEstimate(MKT.onDemand, 'No platform files GP1; marketplace take-rate economics → mid-30s structured estimate.')],
        },
      },
      {
        id: 'l_ca_6', label: 'Hand', sublabel: 'Dishwash',
        revenueShare: 0.059, gp1Margin: 0.48, revenueCAGR: 0.032, gp1DeltaBps: -50,
        revenueDriver: 'BRI: 3.2% CAGR — mature DM habit; EM growth in bars→liquid conversion.',
        marginDriver: 'Heavy promo intensity; brand premiums (Fairy/Dawn) defend the top.',
        linkedCategoryId: 'lhc_hdw',
        sources: {
          revenue: [MKT.handDish],
          margin: [asDerived(SRC.colgate, 'Colgate 60.1% (Palmolive) and Unilever 46.9% reported bracket the format.'), SRC.unilever],
        },
      },
      {
        id: 'l_ca_7', label: 'Auto-Dish', sublabel: '(ADW)',
        revenueShare: 0.050, gp1Margin: 0.50, revenueCAGR: 0.080, gp1DeltaBps: 50,
        revenueDriver: 'Market.us: 8.0% CAGR — dishwasher penetration + premium multi-chamber tabs.',
        marginDriver: 'Tech-format premium holds; PL tabs improve but lag on claims.',
        linkedCategoryId: 'lhc_adw',
        sources: {
          revenue: [MKT.adw],
          margin: [asDerived(SRC.reckitt, 'Reckitt (Finish) 60.8% reported group GM anchors the ceiling; format set at 50%.')],
        },
      },
      {
        id: 'l_ca_8', label: 'Air', sublabel: 'Care',
        revenueShare: 0.045, gp1Margin: 0.55, revenueCAGR: 0.090, gp1DeltaBps: 50,
        revenueDriver: 'Precedence: 9.0% CAGR — fragrance supercycle, wellness framing.',
        marginDriver: 'Fragrance-led COGS economics; premium formats (diffusers) lift mix.',
        linkedCategoryId: null,
        sources: {
          revenue: [MKT.airCare],
          margin: [asDerived(SRC.reckitt, 'Air Wick sat inside Reckitt’s 60.8% reported GM before the 2025 Essential Home divestment to Advent (Vestacy); format set at 55%.'), asEstimate(SRC.pg, 'Febreze inside P&G 51.2% group GM.')],
        },
      },
      {
        id: 'l_ca_9', label: 'Smart /', sublabel: 'Connected Wash',
        revenueShare: 0.031, gp1Margin: 0.28, revenueCAGR: 0.246, gp1DeltaBps: -100,
        revenueDriver: 'GVR: 24.6% CAGR — connected washers mainstream by 2030.',
        marginDriver: 'Hardware margins thin even with software claims (SharkNinja 49% is small-appliance, not white goods).',
        linkedCategoryId: null,
        sources: {
          revenue: [MKT.smartWashers],
          margin: [asEstimate(SRC.whirlpool, 'White-goods base 15.4% reported + connected-premium uplift → high-20s estimate.'), SRC.sharkninja],
        },
      },
    ],
    insights: [
      'The combined laundry universe is ~€335bn (Euromonitor-anchored core + adjacencies), and margin quality is inversely distributed: the biggest adjacencies (services ~20%, appliances ~17%) earn just 40% and 16% GP1, while branded core laundry (~22%) carries the richest mass margin — adjacency size ≠ adjacency attractiveness.',
      'ADW is the asymmetric bet: 8% growth, 50% GP1, +50bps drift, and Henkel already holds the #2 European franchise (Somat) — pool math says fund it before any new adjacency.',
      'Air care (9% growth, 55% GP1) just changed hands: Reckitt’s 2025 Essential Home divestment (Air Wick → Vestacy/Advent) opens the first structural entry window in a decade.',
      'Corrected this release: commercial cleaning margins were understated — Ecolab reports 44.5% GM (FY2025), not the ~32% previously cited; the B2B pool is richer than assumed, though it remains outside HCB scope.',
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
// Horizon & derived pool math — single source of truth for every view
// ═══════════════════════════════════════════════════════════════════

/** Development horizon in years (FY2025 base → 2030 outlook). */
export const POOL_HORIZON_YEARS = 5;
export const POOL_HORIZON_LABEL = 'FY2025 → 2030';

/** GP1 margin at the end of the horizon (decimal). */
export function gp1Terminal(item: Pick<SlideItem, 'gp1Margin' | 'gp1DeltaBps'>): number {
  return Math.max(0.01, item.gp1Margin + item.gp1DeltaBps / 10000);
}

/**
 * Profit-pool CAGR — the growth rate of the pool AREA (revenue × GP1):
 *   poolCAGR = (1 + revenueCAGR) × (1 + marginCAGR) − 1
 * with marginCAGR = (GP1_end / GP1_now)^(1/H) − 1.
 */
export function poolCagr(
  item: Pick<SlideItem, 'revenueCAGR' | 'gp1Margin' | 'gp1DeltaBps'>,
  years: number = POOL_HORIZON_YEARS,
): number {
  const end = Math.max(0.01, item.gp1Margin + item.gp1DeltaBps / 10000);
  const marginCagr = Math.pow(end / item.gp1Margin, 1 / years) - 1;
  return (1 + item.revenueCAGR) * (1 + marginCagr) - 1;
}

/** Revenue pool of one item in €bn (slide pool × share). */
export function itemRevenueEurBn(slide: ProfitPoolSlide, item: SlideItem): number {
  const total = slide.items.reduce((s, it) => s + it.revenueShare, 0) || 1;
  return slide.poolSizeEurBn * (item.revenueShare / total);
}

/** GP1 profit pool of one item in €bn today. */
export function itemGp1PoolEurBn(slide: ProfitPoolSlide, item: SlideItem): number {
  return itemRevenueEurBn(slide, item) * item.gp1Margin;
}

/** GP1 profit pool of one item in €bn at the end of the horizon. */
export function itemGp1PoolEurBnTerminal(slide: ProfitPoolSlide, item: SlideItem): number {
  return itemGp1PoolEurBn(slide, item) * Math.pow(1 + poolCagr(item), POOL_HORIZON_YEARS);
}

/** Slide-level GP1 pool (€bn) today and at horizon end, plus the weighted pool CAGR. */
export function slidePoolSummary(slide: ProfitPoolSlide): {
  gp1PoolNowEurBn: number;
  gp1PoolTerminalEurBn: number;
  weightedPoolCagr: number;
} {
  const now = slide.items.reduce((s, it) => s + itemGp1PoolEurBn(slide, it), 0);
  const terminal = slide.items.reduce((s, it) => s + itemGp1PoolEurBnTerminal(slide, it), 0);
  const weightedPoolCagr = now > 0 ? Math.pow(terminal / now, 1 / POOL_HORIZON_YEARS) - 1 : 0;
  return { gp1PoolNowEurBn: now, gp1PoolTerminalEurBn: terminal, weightedPoolCagr };
}

// ═══════════════════════════════════════════════════════════════════
// Rating ladders — shared arrow vocabulary (↑ / ↓ / ↔, 1–3 glyphs)
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
 * REVENUE CAGR ladder (kept from v1 for the drill-down decomposition):
 *   |CAGR| < 0.5% flat · 0.5–2% one · 2–5% two · ≥5% three.
 */
export const CAGR_THRESHOLDS = { flat: 0.005, one: 0.020, two: 0.050 } as const;

function rate(
  value: number | null | undefined,
  t: { flat: number; one: number; two: number },
  fmt: (v: number) => string,
): CagrRating {
  if (value == null || !isFinite(value)) {
    return { direction: 'flat', arrows: 0, label: 'n/a', tone: 'grey' };
  }
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
export function toPoolRating(cagr: number | null | undefined): CagrRating {
  return rate(cagr, POOL_CAGR_THRESHOLDS, pctFmt);
}

/** Rating for a REVENUE CAGR (drill-down decomposition row). */
export function toCagrRating(cagr: number | null | undefined): CagrRating {
  return rate(cagr, CAGR_THRESHOLDS, pctFmt);
}

/**
 * Rating for a GP1 margin drift in basis points over the horizon:
 *   |Δ| < 25bps flat · 25–75 one · 75–125 two · ≥125 three.
 */
export function toGp1Rating(deltaBps: number | null | undefined): CagrRating {
  if (deltaBps == null || !isFinite(deltaBps)) {
    return { direction: 'flat', arrows: 0, label: 'n/a', tone: 'grey' };
  }
  const abs = Math.abs(deltaBps);
  const label = `${deltaBps > 0 ? '+' : ''}${Math.round(deltaBps)}bps`;
  if (abs < 25) return { direction: 'flat', arrows: 0, label, tone: 'grey' };
  const arrows: 1 | 2 | 3 = abs < 75 ? 1 : abs < 125 ? 2 : 3;
  return deltaBps > 0
    ? { direction: 'up', arrows, label, tone: 'green' }
    : { direction: 'down', arrows, label, tone: 'red' };
}

// ─── 0-3 Rating (PRISM-driven, red/green) — unchanged from v1 ──────

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
