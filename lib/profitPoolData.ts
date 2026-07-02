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
 *
 * v3 PASSPORT-TAXONOMY REBUILD (2026-07-02) — owner rulings:
 *  1. ROWS = EUROMONITOR PASSPORT CATEGORIES. The former format-patchwork
 *     sub-segment views (8+ tier-2 firms, mixed scopes, base years 2022–26)
 *     are replaced by Passport's category tree: Hair (Shampoos, Conditioners
 *     & Treatments, Colourants, Styling Agents, Salon Professional, 2-in-1,
 *     Hair Loss Treatments, Perms & Relaxants) and Home Care (Laundry
 *     Detergents / Fabric Softeners / Laundry Aids, Hand & Auto Dishwashing,
 *     Surface, Toilet, Bleach, Polishes, Home Insecticides, Air Care).
 *     Audit trail: 2026-07-02_profit-pool-explorer_passport-alignment-audit_v1.md.
 *  2. SOURCE LADDER (owner, 2026-07-02): 1 Euromonitor (RSP) → 2 Kline for
 *     professional hair (manufacturer-level salon sales) → 3 Circana /
 *     NielsenIQ (scanner POS, tracked channels) → 4 company filings (MSP) →
 *     5 tier-2 firms only where all of the above are silent.
 *  3. PASSPORT VALUES ARE NOT SHAREABLE (licence). Every category size is
 *     therefore a PUBLIC TRIANGULATION at RSP, graded ⚡ derived / ⚠️
 *     estimate — never ✅ — with the full derivation recipe carried in the
 *     source label + `detail` (shown to viewers in the source-chip hover).
 *     Swap-in path: fill 2026-07-02_PRISM_market-size_validation_list_v2_
 *     passport-aligned.xlsx from Passport, update the MKT anchors here,
 *     and grades flip to reported.
 *  4. DENOMINATION TAGS. SourceRef carries `denomination` (RSP | MSP |
 *     scanner-POS | salon-mfr | model). Pools are stated at RSP; filings
 *     are MSP (RSP ≈ 1.8–2.2× MSP — this is the value-chain views'
 *     "brand-owner net sales ≈ 50% of retail value" bridge); Kline
 *     professional-hair values are salon-manufacturer level and are NEVER
 *     summed with RSP bars.
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

/** Value basis of a cited figure (v3). RSP = retail selling price
 *  (Euromonitor basis: consumer prices incl. sales tax, all channels);
 *  MSP = manufacturer net sales; scanner-POS = Circana/NIQ tracked-channel
 *  retail; salon-mfr = Kline professional manufacturer-level; model =
 *  modelled market (e.g. Statista CMO). Mixed denominations must never
 *  be summed in one view. */
export type Denomination = 'RSP' | 'MSP' | 'scanner-POS' | 'salon-mfr' | 'model';

export interface SourceRef {
  /** Short label, e.g. "P&G FY2025 8-K — gross margin 51.2%" */
  label: string;
  /** Clickable URL. The cited figure is visible on this page (verified 2026-06-11 / 2026-07-02). */
  url: string;
  /** Optional basis note: what was taken from the page / how it was used.
   *  For v3 triangulated category sizes this carries the FULL derivation
   *  recipe and is rendered to viewers in the source-chip hover. */
  detail?: string;
  grade: EvidenceGrade;
  /** Value basis of the cited figure (v3, optional on legacy anchors). */
  denomination?: Denomination;
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
    label: 'PRISM triangulation — global Hair Care ~$94bn (2025, RSP, incl. Salon Professional); Euromonitor-anchored',
    url: 'https://www.happi.com/haircare-market-sees-shift-towards-multi-step-routines/',
    detail: 'DERIVATION (Passport values not shareable — licence): Europe hair care $23.2bn 2025, +3.3% (Euromonitor via Happi, Mar-2026) at Europe ≈ 25% of world ⇒ ~$93bn; prior anchor $88–90bn (2024) grown 3–4% ⇒ ~$92–94bn; Statista retail-only model $99.9bn (2026F) EXCLUDES salon professional, so scopes reconcile. Circana US pulse FY2025: hair +8% prestige / +4% mass. Confirm level in Passport; grades flip to reported when internal RSP value replaces this.',
    grade: 'estimate',
    denomination: 'RSP',
  } as SourceRef,
  // v3: the FBI/GVR/Mordor/IMARC hair-format anchors (shampoo $38.2bn,
  // conditioner $5.3bn, colour $26.1bn incl. professional, styling, masks,
  // serums, oils) are RETIRED — mixed scopes vs. Passport; their role and
  // the deltas are documented in the Passport-category anchors below and in
  // the 2026-07-02 audit report.
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
    label: 'Kline — Salon Professional Hair Care ~$17bn (2024, salon channel, manufacturer-level; ~4% growth)',
    url: 'https://klinegroup.com/beauty-and-wellbeing/professional-hair-care-industry-a-decade-of-change/',
    detail: 'AUTHORITY for professional hair = Kline (owner ruling 2026-07-02). Kline 2025/26 reads: global professional growth ~4% average; US pro market $5.3bn; China salon sales −20% in 2025 (recovering H2); NA e-commerce ≈ 25% of pro sales, salon back-bar down to ~40%. DENOMINATION: Kline reports MANUFACTURER-LEVEL salon sales — Passport’s "Salon Professional Hair Care" line (RSP-equivalent) will read higher on the same market; the two bases must never be summed. Replaces AMR’s $34.8bn all-channel aggregation (retired 2026-06). Confirm exact figure in Kline’s Professional Hair Care Global Series.',
    grade: 'derived',
    denomination: 'salon-mfr',
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
    label: 'PRISM triangulation — global Laundry Care ~$100bn (2025, RSP); Euromonitor-anchored',
    url: 'https://www.statista.com/statistics/1449847/revenue-laundry-care-home-laundry-care-market-worldwide',
    detail: 'DERIVATION (Passport values not shareable — licence): US Laundry Care $18.5bn (Euromonitor, 2025; ~$18bn 2024 confirmed via the EMI US country report) at a US world-share of 18–19% ⇒ ~$98–103bn; Statista model ~$103bn; 46–48% of Home Care ~$213bn. Supply-side check: P&G Fabric & Home Care FY2025 net sales $29.6bn (MSP ≈ half of RSP). Replaces the prior ~$85bn (2024 est. rolled from EMI 2020) — ~15% low. Confirm in Passport.',
    grade: 'estimate',
    denomination: 'RSP',
  } as SourceRef,
  // v3: the laundry format-patchwork anchors (liquid ~$42bn, pods $11.3bn,
  // softener $14.6bn, stain $22.3bn scope-inflated, boosters, baby-specialty
  // proxy, Market.us ADW $19.2bn, BRI hand-dish $22.7bn, Mordor household
  // cleaners $170.5bn, Precedence air freshener $17.2bn) are RETIRED —
  // replaced by the Passport-category triangulations below; deltas
  // documented in the 2026-07-02 audit report.
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
    label: 'PRISM triangulation — global Home Care ~$213bn (2025, RSP); Euromonitor-anchored',
    url: 'https://www.euromonitor.com/article/home-care-industry-overview',
    detail: 'DERIVATION (Passport values not shareable — licence): Euromonitor $167bn (2020, RSP; via KDC/ONE SEC S-1) rolled forward ~5%/yr nominal ⇒ ~$210–220bn 2025; Statista model $193bn (2024) / $208.9bn (2026F); US $40.2bn (Euromonitor 2025, +2%) ≈ 19% of world. Category sum-check: the 8 Passport categories on the Home Care view total $213.5bn. EMI growth ranking to 2029 (linked infographic): dishwashing (+12% constant 2024–29) > laundry care > surface care; industry adds +$17.4bn by 2029. Home Care = laundry + dishwashing + surface + toilet + bleach + polishes + air care + insecticides. Confirm in Passport.',
    grade: 'estimate',
    denomination: 'RSP',
  } as SourceRef,
  klineRank: {
    label: 'Kline & Company (Apr 2026) — global professional hair share: L’Oréal #1; post-Olaplex Henkel #2 at ~12%, ahead of Wella ~10%. Henkel #1 in styling, #3 in colour.',
    url: 'https://klinegroup.com/beauty-and-wellbeing/henkels-potential-olaplex-acquisition/',
    grade: 'reported',
  } as SourceRef,

  // ── v3 Passport-category triangulations (2025, RSP) ────────────────
  // Each label/detail carries the FULL derivation recipe — Passport
  // internal values are not shareable, so these are the "next best"
  // public triangulations, graded ⚡/⚠️ until replaced from Passport.
  circanaBeauty: {
    label: 'Circana (scanner POS, US) — FY2025: mass beauty $72.7bn (+5%), prestige $36bn (+4%); hair +8% prestige / +4% mass',
    url: 'https://www.circana.com/post/us-prestige-and-mass-beauty-retail-deliver-a-positive-performance-in-2025-circana-reports',
    detail: 'Circana tracked-channel POS (not RSP; misses parts of discounters/DTC/salons). Hair = fastest-growing prestige category FY2025, led by treatments & styling; scalp care in its 3rd straight year of double-digit growth. Used as US growth pulse, never as a global level.',
    grade: 'reported',
    denomination: 'scanner-POS',
  } as SourceRef,
  circanaLaundry: {
    label: 'Circana Home Care Evolution (US, Jan-2025) — laundry care +4.7% y/y; regular detergent +2.6%',
    url: 'https://www.modernretail.co/marketing/brands-briefing-why-specialty-laundry-care-products-are-the-next-big-home-care-category/',
    detail: 'Circana scanner POS: US laundry care incl. additives/odour care grew +4.7% y/y vs. +2.6% for regular detergent — additives structurally outgrow base detergent. Used as growth pulse for the detergents-vs-aids mix.',
    grade: 'reported',
    denomination: 'scanner-POS',
  } as SourceRef,
  shampoos: {
    label: 'PRISM triangulation — Shampoos ~$29.5bn (2025, RSP); Euromonitor-anchored',
    url: 'https://www.happi.com/haircare-market-sees-shift-towards-multi-step-routines/',
    detail: 'DERIVATION: Europe shampoos $7.6bn = 33% of Europe hair $23.2bn (Euromonitor via Happi, Mar-2026); share applied to the ~$94bn world total ⇒ ~$29–31bn. Replaces FBI $38.2bn (~30% above the Passport-consistent level; scope/denomination unstated). Confirm in Passport.',
    grade: 'derived',
    denomination: 'RSP',
  } as SourceRef,
  condTreat: {
    label: 'PRISM triangulation — Conditioners & Treatments ~$18bn (2025, RSP)',
    url: 'https://www.circana.com/post/us-prestige-and-mass-beauty-retail-deliver-a-positive-performance-in-2025-circana-reports',
    detail: 'DERIVATION: Passport C&T bundles rinse-off conditioner + masks + serums/leave-in + oils. The v2 tool carried them as 4 tier-2 fragments summing $12.0bn (FBI conditioner 5.3 + Mordor masks 0.7 + GVR serums 1.3 + IMARC oils 4.7 — mixed scopes) ⇒ public fragments under-cover the category ~35%. Sized at ~19% of the hair total, consistent with EMI multi-step-routine momentum and Circana FY2025 (US prestige hair +8%, led by treatments). Confirm in Passport.',
    grade: 'estimate',
    denomination: 'RSP',
  } as SourceRef,
  colourants: {
    label: 'PRISM triangulation — Colourants ~$15.5bn (2025, RSP, retail only)',
    url: 'https://www.grandviewresearch.com/industry-analysis/hair-color-market-report',
    detail: 'DERIVATION: GVR $26.1bn (2024, linked) INCLUDES professional colour and would double-count the salon channel shown as its own row — retail-only Passport-consistent level ≈ 16–17% of the hair total ⇒ ~$15–16bn. Confirm in Passport.',
    grade: 'estimate',
    denomination: 'RSP',
  } as SourceRef,
  stylingAgents: {
    label: 'PRISM triangulation — Styling Agents ~$9bn (2025, RSP)',
    url: 'https://www.mordorintelligence.com/industry-reports/hair-styling-products-market',
    detail: 'DERIVATION: Mordor $10.0bn (2026, linked) is near-consistent with a Passport-style scope; ~10% of the hair total. Growth: Euromonitor (via Happi) forecasts Europe styling agents +5.1% in 2026 — consumers wash less, style more. Confirm in Passport.',
    grade: 'derived',
    denomination: 'RSP',
  } as SourceRef,
  twoInOne: {
    label: 'PRISM structured estimate — 2-in-1 Products ~$2bn (2025, RSP)',
    url: 'https://www.happi.com/haircare-market-sees-shift-towards-multi-step-routines/',
    detail: 'DERIVATION: no public source sizes Passport’s 2-in-1 line; sized ~2% of the hair total. Declining legacy format — multi-step routines (EMI via Happi) pull usage the other way. Passport-only number; confirm internally.',
    grade: 'estimate',
    denomination: 'RSP',
  } as SourceRef,
  hairLoss: {
    label: 'PRISM triangulation — Hair Loss Treatments ~$1.8bn (2025, RSP)',
    url: 'https://www.happi.com/haircare-market-sees-shift-towards-multi-step-routines/',
    detail: 'DERIVATION: Euromonitor (via Happi, Mar-2026) flags hair loss treatments as dynamic growth from a low base, with younger consumers buying proactively; sized ~2% of the hair total. Retail treatments only — hair-growth SUPPLEMENTS (GVR $0.83bn, 15.5% CAGR) sit in Passport Consumer Health/VMS, outside this line. Confirm in Passport.',
    grade: 'estimate',
    denomination: 'RSP',
  } as SourceRef,
  perms: {
    label: 'PRISM structured estimate — Perms & Relaxants ~$0.8bn (2025, RSP)',
    url: 'https://www.happi.com/haircare-market-sees-shift-towards-multi-step-routines/',
    detail: 'DERIVATION: no public sizing with Passport scope; ~1% of the hair total, structurally declining. Passport-only number; confirm internally.',
    grade: 'estimate',
    denomination: 'RSP',
  } as SourceRef,
  laundryDetergents: {
    label: 'PRISM triangulation — Laundry Detergents ~$80bn (2025, RSP, all formats)',
    url: 'https://www.statista.com/statistics/1449847/revenue-laundry-care-home-laundry-care-market-worldwide',
    detail: 'DERIVATION: ≈80% of Laundry Care ~$100bn (Passport-typical detergent share). Passport’s format tree (powder / liquid / tabs × standard / concentrate) is the drill-down level — format mix (triangulated, 2023–25 bases): liquid ≈ half, powder ≈ ⅓ (GVR: >32% of laundry care, 2023), unit-dose ≈ 10–14% (GVR pods $11.3bn, 2023). NOTE: the FCN vs FCA (heavy-duty vs fine-fabric) split is NOT derivable from public data — Passport carries fine-fabric inside Laundry Detergents; apply the internal split. Circana US: regular detergent +2.6% y/y (Jan-2025).',
    grade: 'estimate',
    denomination: 'RSP',
  } as SourceRef,
  fabricSofteners: {
    label: 'PRISM triangulation — Fabric Softeners ~$13.5bn (2025, RSP)',
    url: 'https://www.grandviewresearch.com/press-release/global-fabric-softener-market',
    detail: 'DERIVATION: GVR $14.59bn (2023, linked; denomination unstated) moderated to an RSP-consistent 13–14% of Laundry Care. Scent boosters typically sit in Passport LAUNDRY AIDS, not softeners — confirm placement internally (Henkel steers Vernel boosters with FFI).',
    grade: 'derived',
    denomination: 'RSP',
  } as SourceRef,
  laundryAids: {
    label: 'PRISM triangulation — Laundry Aids ~$6.5bn (2025, RSP, incl. scent boosters + carpet cleaners)',
    url: 'https://www.modernretail.co/marketing/brands-briefing-why-specialty-laundry-care-products-are-the-next-big-home-care-category/',
    detail: 'DERIVATION: Passport Laundry Aids (stain removers, whiteners, water softeners, boosters) ≈ 5–7% of Laundry Care ⇒ ~$6–7bn; Carpet Cleaners (<$1bn, a Passport sub-category) folded in. REPLACES GVR stain removers $22.3bn whose scope includes surface-stain products (~3× the Passport category — the v2 view overweighted LAD by ~2–3×). Growth: Circana (Jan-2025) shows US additives/odour care at +4.7% vs. +2.6% for base detergent. Confirm in Passport.',
    grade: 'estimate',
    denomination: 'RSP',
  } as SourceRef,
  dishTotal: {
    label: 'PRISM triangulation — Dishwashing ~$33bn (2025, RSP; hand + automatic)',
    url: 'https://www.euromonitor.com/article/home-care-industry-overview',
    detail: 'DERIVATION: Home Care ~$213bn less the other 7 categories ⇒ ~$33bn; Statista detergents-only model $26.6bn is the floor (narrower scope). Euromonitor (May-2025, linked): dishwashing is the FASTEST-growing home care category, +12% constant value 2024–29. Confirm in Passport.',
    grade: 'estimate',
    denomination: 'RSP',
  } as SourceRef,
  handDishNew: {
    label: 'PRISM triangulation — Hand Dishwashing ~$19bn (2025, RSP)',
    url: 'https://www.businessresearchinsights.com/market-reports/dishwashing-liquid-market-101360',
    detail: 'DERIVATION: ~55–60% of Dishwashing ~$33bn (hand skews EM/volume). BRI $22.7bn (2026, linked) is a mixed hand+auto “dishwashing liquid” scope used as ceiling. Confirm split in Passport.',
    grade: 'estimate',
    denomination: 'RSP',
  } as SourceRef,
  adwNew: {
    label: 'PRISM triangulation — Automatic Dishwashing ~$14bn (2025, RSP)',
    url: 'https://www.euromonitor.com/article/home-care-industry-overview',
    detail: 'DERIVATION: ~40–45% of Dishwashing ~$33bn. REPLACES Market.us $19.2bn (2024; ~35% above the Passport-consistent level, denomination unstated). Growth: EMI’s +12% constant 2024–29 for total dishwashing skews to ADW (machine penetration + premium tabs); nominal ADW ~6–7%. Confirm in Passport.',
    grade: 'estimate',
    denomination: 'RSP',
  } as SourceRef,
  surfaceCare: {
    label: 'PRISM triangulation — Surface Care ~$30bn (2025, RSP)',
    url: 'https://www.euromonitor.com/article/home-care-industry-overview',
    detail: 'DERIVATION: ~14% of Home Care ~$213bn; EMI (May-2025, linked) ranks surface care 3rd-fastest growth to 2029 after dishwashing and laundry. REPLACES the v2 “~$55bn surface cleaners” blob (Mordor household-cleaners $170.5bn minus laundry), which silently mixed Surface + Toilet + Bleach + Polishes. Confirm in Passport.',
    grade: 'estimate',
    denomination: 'RSP',
  } as SourceRef,
  toiletCare: {
    label: 'Toilet Care ~$10.5bn (2025, RSP-consistent) — IMARC-anchored triangulation',
    url: 'https://www.imarcgroup.com/toilet-care-market',
    detail: 'DERIVATION: IMARC $10.4bn (2025, linked); regional 2024 splits: APAC $4.8bn / NA $3.2bn / EU $2.9bn. Tier-2 source used because no EMI/Circana public figure exists — scope matches Passport Toilet Care closely. Confirm in Passport.',
    grade: 'derived',
    denomination: 'RSP',
  } as SourceRef,
  bleach: {
    label: 'PRISM structured estimate — Bleach ~$7bn (2025, RSP)',
    url: 'https://www.euromonitor.com/article/home-care-industry-overview',
    detail: 'DERIVATION: no reliable public source with Passport-consistent scope; sized as residual ≈ 3% of Home Care ~$213bn. Structurally declining in DM (surface-care substitution), habitual in EM/LatAm. Passport-only number; confirm internally.',
    grade: 'estimate',
    denomination: 'RSP',
  } as SourceRef,
  polishes: {
    label: 'PRISM structured estimate — Polishes ~$4.5bn (2025, RSP)',
    url: 'https://www.euromonitor.com/article/home-care-industry-overview',
    detail: 'DERIVATION: no reliable public source with Passport-consistent scope; sized ≈ 2% of Home Care ~$213bn (shoe/floor/furniture polish; structurally declining). Passport-only number; confirm internally.',
    grade: 'estimate',
    denomination: 'RSP',
  } as SourceRef,
  insecticides: {
    label: 'PRISM triangulation — Home Insecticides ~$14.5bn (2025, RSP)',
    url: 'https://www.factmr.com/report/127/home-insecticides-market',
    detail: 'DERIVATION: tier-2 sources span $12.6bn (Fact.MR 2025, linked) to $20.9bn (CMI 2026F) with Reanin at ~$18.4bn (2024) — the WIDEST public uncertainty in the set; low-mid point chosen for RSP consistency. No EMI/Circana public figure exists. This is the row where a Passport value adds most. Confirm in Passport.',
    grade: 'estimate',
    denomination: 'RSP',
  } as SourceRef,
  airCareNew: {
    label: 'PRISM triangulation — Air Care ~$14bn (2025, RSP)',
    url: 'https://www.precedenceresearch.com/air-care-market',
    detail: 'DERIVATION: Precedence $17.19bn (2025, linked) is an air-freshener-plus scope; Passport-definition air care runs ~$13–15bn on comparable bases. Supply-side context: Reckitt Essential Home (Air Wick + surface/pest/laundry tail) had £2.0bn net revenue 2024 (MSP) — sold to Advent (“Vestacy”), completed 31-Dec-2025. Confirm in Passport.',
    grade: 'estimate',
    denomination: 'RSP',
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
    subtitle: 'GP1 proxy (anchored to FY2025 filings, not separately reported) | End-consumer pool ~€82bn (triangulated ~$94bn, 2025 RSP — Passport-unconfirmed) | € at 1.15',
    poolSize: '~€82bn',
    poolSizeEurBn: 81.7,
    group: 'Hair',
    kind: 'ValueChain',
    prismProxyCategories: ['hair_color', 'hair_care', 'hair_styling', 'hair_body'],
    construction:
      'Chain revenue per tier, normalized to 100%: retail value ~$94bn (2025 RSP, PRISM triangulation — Europe $23.2bn (EMI via Happi) ≈ 25% of world; recipe in the source hover; Passport-unconfirmed) split store/online; brand-owner net sales ≈ 50% of retail value (the RSP→MSP denomination bridge); professional products per Kline (~$17bn salon channel at MANUFACTURER level — never summed with RSP tiers; AMR’s $34.8bn all-channel figure retired); upstream tiers sized from input-cost shares.',
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
          revenue: [asDerived(MKT.hairTotal, 'Retail value ~$94bn (2025 RSP triangulation) less online share; store retail carries shelf price = largest single revenue tier.')],
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
      'Brand owner (53% GP1) and professional products (58% GP1) hold the richest tiers of a ~€82bn end-consumer pool growing ~4% nominal (Euromonitor-anchored triangulation) — both backed by FY2025 filings (P&G 51.2%, L’Oréal 74.3% group GM).',
      'Store retail moves the most revenue (≈37% of chain) at 24% GP1 and is the only tier with a clearly shrinking margin trajectory — the pool migrates to e-com/DTC (+11% revenue, +150bps margin drift).',
      'Upstream is small but not poor: specialty ingredients earn 44% GP1 (Croda FY2025: 43.9% reported) — the "boring chemicals" stereotype only holds for the commodity tier.',
      'Henkel angle: HCB group GM 50.8% (FY2025) sits ~2pts below the calibrated brand-owner tier — the gap is mix (treatments/scalp under-index), not conversion cost.',
    ],
  },

  // ═════════ Laundry — Value Chain (raw → retail) ═════════
  {
    id: 'laundry_value_chain',
    title: 'Laundry Care — Industry Value Chain Profit Pool',
    subtitle: 'GP1 proxy (anchored to FY2025 filings) | End-consumer Laundry Care pool ~€87bn (triangulated ~$100bn, 2025 RSP — Passport-unconfirmed) | € at 1.15',
    poolSize: '~€87bn',
    poolSizeEurBn: 87.0,
    group: 'LHC',
    kind: 'ValueChain',
    prismProxyCategories: ['lhc_fcn', 'lhc_fca', 'lhc_ffi', 'lhc_lad'],
    construction:
      'Chain revenue per tier, normalized to 100%: Laundry Care retail value ~$100bn (2025 RSP, PRISM triangulation — US $18.5bn (EMI 2025) at 18–19% world share; recipe in the source hover; replaces the prior ~$85bn rolled from EMI 2020, which ran ~15% low) split store/online; brand-owner net sales ≈ 50% of retail value (the RSP→MSP denomination bridge; check: P&G Fabric & Home Care FY2025 $29.6bn MSP); adjacent flows (appliances $66.9bn FBI, services $78.2bn GVR) shown as own tiers.',
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

  // ═════════ Hair — Passport Categories (Euromonitor taxonomy, v3) ═════════
  {
    id: 'hair_sub_segments',
    title: 'Hair Care — Passport Category Profit Pools',
    subtitle: 'Brand-owner GP1 proxy by Euromonitor Passport category | Total ~$94bn (2025, RSP — triangulated, Passport-unconfirmed) | € at 1.15',
    poolSize: '~€82bn',
    poolSizeEurBn: 81.7,
    group: 'Hair',
    kind: 'SubSegment',
    prismProxyCategories: ['hair_care', 'hair_color', 'hair_styling'],
    construction:
      'v3 (2026-07-02): rows = Euromonitor Passport’s 8 hair care categories (2-in-1, Colourants, Conditioners & Treatments, Hair Loss Treatments, Perms & Relaxants, Salon Professional, Shampoos, Styling Agents) so an internal Passport extract drops in 1:1. Passport values are not shareable (licence) — every size is a PUBLIC TRIANGULATION at 2025 RSP (recipes in each source hover), normalized over their $93.1bn sum vs. the ~$94bn triangulated total. Replaces the v2 format patchwork (8 tier-2 firms) whose total coincidentally reconciled while every slice deviated from Passport: shampoo ran ~30% high, C&T fragments ~35% low, colour ~65% high (professional double-count), salon professional missing. HCB mapping: Shampoos/C&T/2-in-1/Hair Loss → Hair: Care; Colourants → Hair: Colour; Styling Agents (+ Perms, folded conceptually) → Hair: Styling; Salon Professional = in-total adjacency (Schwarzkopf Professional; no PRISM category). Hair: Body (Fa) lives in Passport Bath & Shower + Deodorants — outside this view.',
    items: [
      {
        id: 'h_sub_1', label: 'Shampoos',
        revenueShare: 0.317, gp1Margin: 0.44, revenueCAGR: 0.045, gp1DeltaBps: -50,
        revenueDriver: 'Euromonitor: Europe +3.3% (2025) on unit price + premiumization; EM volume lifts world to ~4–5% nominal.',
        marginDriver: 'Private label + price anchoring grind the category’s floor.',
        note: 'Share corrected 43% → ~32% vs. v2 (FBI scope retired).',
        linkedCategoryId: 'hair_care',
        sources: {
          revenue: [MKT.shampoos],
          margin: [asDerived(SRC.pg, 'Volume category set below the brand-owner blend: P&G 51.2%, Unilever 46.9%, Kao 39.6% group GMs.'), SRC.unilever, SRC.kao],
        },
      },
      {
        id: 'h_sub_2', label: 'Conditioners', sublabel: '& Treatments',
        revenueShare: 0.193, gp1Margin: 0.52, revenueCAGR: 0.060, gp1DeltaBps: 100,
        revenueDriver: 'Multi-step routines + bond/mask momentum; Circana FY2025: US prestige hair +8%, led by treatments.',
        marginDriver: 'Masks/serums/leave-in mix shift builds margin inside the Passport line.',
        note: 'Passport line absorbs the v2 fragments (conditioner, masks, serums, oils — which summed to only $12bn).',
        linkedCategoryId: 'hair_care',
        sources: {
          revenue: [MKT.condTreat, MKT.circanaBeauty],
          margin: [asDerived(SRC.unilever, 'Weighted blend of the retired v2 fragments (rinse-off 48% → treatments 62%): Unilever 46.9% / Beiersdorf 57.7% / Olaplex 69.4% bracket ~52%.'), SRC.beiersdorf, SRC.olaplex],
        },
      },
      {
        id: 'h_sub_3', label: 'Colourants',
        revenueShare: 0.166, gp1Margin: 0.58, revenueCAGR: 0.045, gp1DeltaBps: 100,
        revenueDriver: 'Root touch-up frequency + fashion shades; retail-only scope grows ~4–5% nominal.',
        marginDriver: 'Chemistry IP + low private-label credibility = strongest pricing in hair.',
        note: 'Retail colour only — professional colour sits in the Salon Professional row (v2 double-count fixed).',
        linkedCategoryId: 'hair_color',
        sources: {
          revenue: [MKT.colourants],
          margin: [asDerived(SRC.loreal, 'Colour skews to the L’Oréal end of the blend (group GM 74.3%); Henkel 50.8% anchors the floor.'), SRC.henkel],
        },
      },
      {
        id: 'h_sub_4', label: 'Salon', sublabel: 'Professional',
        revenueShare: 0.177, gp1Margin: 0.58, revenueCAGR: 0.040, gp1DeltaBps: 50,
        revenueDriver: 'Kline: ~4% average growth; US $5.3bn resilient, China salon −20% in 2025 (recovering H2).',
        marginDriver: 'Salon exclusivity + education moat hold price; e-com channel shift (NA ≈25%) is margin-neutral-to-positive.',
        note: 'AUTHORITY: Kline (mfr-level ~$17bn 2024). Sits INSIDE the Passport hair total — shown here so the category tree is complete; no PRISM category (Schwarzkopf Professional).',
        linkedCategoryId: null,
        sources: {
          revenue: [MKT.proHair],
          margin: [asDerived(SRC.loreal, 'L’Oréal group GM 74.3% with PPD op. margin 22.9% implies professional GP1 in the high-50s after salon trade terms.')],
        },
      },
      {
        id: 'h_sub_5', label: 'Styling', sublabel: 'Agents',
        revenueShare: 0.097, gp1Margin: 0.52, revenueCAGR: 0.050, gp1DeltaBps: 0,
        revenueDriver: 'Euromonitor: Europe styling +5.1% forecast 2026 — wash less, style more; texture looks offset spray decline.',
        marginDriver: 'Stable: aerosol cost pass-through balances premium texturizers.',
        linkedCategoryId: 'hair_styling',
        sources: {
          revenue: [MKT.stylingAgents],
          margin: [asDerived(SRC.henkel, 'Henkel group GM 50.8% as floor for its strongest-share category (Taft/got2b; Kline: Henkel #1 in professional styling); modest premium.')],
        },
      },
      {
        id: 'h_sub_6', label: '2-in-1', sublabel: 'Products',
        revenueShare: 0.021, gp1Margin: 0.42, revenueCAGR: -0.010, gp1DeltaBps: -50,
        revenueDriver: 'Declining legacy format — multi-step routines pull usage the other way.',
        marginDriver: 'Value positioning; no premium tier to migrate into.',
        linkedCategoryId: 'hair_care',
        sources: {
          revenue: [MKT.twoInOne],
          margin: [asEstimate(SRC.unilever, 'Value format set below the shampoo floor; Unilever 46.9% / Kao 39.6% as bounds.'), SRC.kao],
        },
      },
      {
        id: 'h_sub_7', label: 'Hair Loss', sublabel: 'Treatments',
        revenueShare: 0.019, gp1Margin: 0.62, revenueCAGR: 0.080, gp1DeltaBps: 100,
        revenueDriver: 'Euromonitor: dynamic growth from a low base — younger consumers buy proactively; scalp/longevity narrative.',
        marginDriver: 'Clinical claims price like dermo; low PL credibility.',
        note: 'Retail treatments only; hair-growth supplements are Consumer Health in Passport (out of this line).',
        linkedCategoryId: 'hair_care',
        sources: {
          revenue: [MKT.hairLoss],
          margin: [asDerived(SRC.olaplex, 'Premium-treatment comp 69.4% (Olaplex) vs. Beiersdorf dermo 57.7% bracket the low-60s.'), SRC.beiersdorf],
        },
      },
      {
        id: 'h_sub_8', label: 'Perms', sublabel: '& Relaxants',
        revenueShare: 0.009, gp1Margin: 0.50, revenueCAGR: -0.020, gp1DeltaBps: -50,
        revenueDriver: 'Structural decline; texture services migrate to salons and softer chemistry.',
        marginDriver: 'Shrinking niche holds price but loses volume leverage.',
        note: 'Immaterial (~1% of pool); conceptually folded with Hair: Styling for HCB mapping.',
        linkedCategoryId: 'hair_styling',
        sources: {
          revenue: [MKT.perms],
          margin: [asEstimate(SRC.henkel, 'No public comp files perm-category margins; set at the Henkel 50.8% group anchor.')],
        },
      },
    ],
    insights: [
      'The view now mirrors Passport 1:1 — and the corrected shares change the story: shampoos are ~32% of the pool (not 43%), colourants ~17% retail-only (not 30% with professional double-counted), and Conditioners & Treatments — invisible at $12bn in the v2 fragments — are the #2 category at ~19% with the strongest margin build (+100bps).',
      'Colourants + Salon Professional together still make colour-led hair ~34% of the pool at 58% GP1 — Henkel remains structurally long the right pools (Kline: #2 professional globally post-Olaplex, #1 styling, #3 colour).',
      'Every size is a flagged public triangulation (recipe in each source hover) because Passport values cannot be republished — treat levels as ±10–15% until the internal worklist confirms them; the SHAPE (ranks, growth, margins) is robust to that error band.',
      'Hair Loss Treatments: ~2% of pool, ~8% growth, 62% GP1, +100bps — the smallest row is the fastest compounder; scalp/longevity positioning (Circana: scalp care 3 straight years of double-digit US growth) is the entry chemistry Henkel already owns.',
    ],
  },

  // ═════════ Hair — Core + Adjacent (CORE first) ═════════
  {
    id: 'hair_core_adjacent',
    title: 'Hair Care — Core + Adjacent Profit Pools',
    subtitle: 'Core branded products vs. adjacent pools | Combined ~€254bn ($292bn) | € at 1.15',
    poolSize: '~€254bn',
    poolSizeEurBn: 253.5,
    group: 'Hair',
    kind: 'CoreAdjacent',
    prismProxyCategories: ['hair_color', 'hair_care', 'hair_styling', 'hair_body'],
    construction:
      'v3 (2026-07-02) pool sizes side by side, normalized over $291.6bn: core retail hair ~$77.5bn (= triangulated Passport hair total ~$94bn MINUS Salon Professional ~$16.5bn — the professional row is shown separately, fixing the v2 overlap), salon services ~$150bn (triangulated — no tier-1 source sizes salon SERVICES; FBI’s $203.8bn treated as a scope-inflated ceiling), professional products ~$16.5bn (Kline authority, salon-manufacturer level — not RSP; flagged), tools $29.4bn (FBI 2025), scalp care $15.8bn (CMI 2026 — cross-cuts retail formats, flagged), beauty subscriptions $1.6bn (FMI 2025), supplements $0.8bn (GVR 2024; Consumer Health in Passport). Men’s grooming and beauty-tech dropped vs. v1: published scopes too broad to slot honestly.',
    items: [
      {
        id: 'h_ca_1', label: 'CORE', sublabel: 'Branded Hair (Retail)',
        revenueShare: 0.266, gp1Margin: 0.53, revenueCAGR: 0.045, gp1DeltaBps: 75,
        revenueDriver: 'Euromonitor-anchored: ~4–5% nominal on the ~$77.5bn retail pool (ex-professional).',
        marginDriver: 'Premiumization + treatment mix outpace PL drag.',
        note: 'Core = Passport hair total ~$94bn minus Salon Professional ~$16.5bn (shown as its own bar).',
        linkedCategoryId: 'hair_care',
        sources: {
          revenue: [asDerived(MKT.hairTotal, 'Core retail = triangulated Passport hair total ~$94bn (2025 RSP) minus the Salon Professional row ~$16.5bn ⇒ ~$77.5bn.')],
          margin: [asDerived(SRC.pg, 'Calibrated vs. P&G 51.2% / Henkel 50.8% / L’Oréal 74.3% / Beiersdorf 57.7% FY2025 reported.'), SRC.henkel, SRC.loreal],
        },
      },
      {
        id: 'h_ca_2', label: 'Salon', sublabel: 'Services',
        revenueShare: 0.514, gp1Margin: 0.42, revenueCAGR: 0.060, gp1DeltaBps: 0,
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
        revenueShare: 0.057, gp1Margin: 0.58, revenueCAGR: 0.040, gp1DeltaBps: 50,
        revenueDriver: 'Kline: ~4% average growth; US $5.3bn resilient, China −20% in 2025; bond/colour services pull back-bar demand.',
        marginDriver: 'Salon exclusivity + education moat hold price.',
        note: 'Kline authority (owner ruling): manufacturer-level salon sales — Passport’s RSP-equivalent line reads higher; bases never summed.',
        linkedCategoryId: null,
        sources: {
          revenue: [MKT.proHair],
          margin: [asDerived(SRC.loreal, 'L’Oréal 74.3% group GM / PPD 22.9% op. margin imply high-50s professional GP1.')],
        },
      },
      {
        id: 'h_ca_4', label: 'Hair Tools', sublabel: '& Appliances',
        revenueShare: 0.101, gp1Margin: 0.46, revenueCAGR: 0.053, gp1DeltaBps: -50,
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
        revenueShare: 0.054, gp1Margin: 0.58, revenueCAGR: 0.073, gp1DeltaBps: 100,
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
        revenueShare: 0.0053, gp1Margin: 0.50, revenueCAGR: 0.259, gp1DeltaBps: 100,
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
        revenueShare: 0.0028, gp1Margin: 0.68, revenueCAGR: 0.155, gp1DeltaBps: 50,
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
      'The adjacency map redraws the category: salon services (~€130bn, ~51% of the combined pool) dwarf core retail (~€67bn ex-professional) — hair is a services category with a products attach, not the reverse. (Salon sized on the triangulated ~$150bn estimate — no tier-1 source sizes salon SERVICES — not FBI’s $203.8bn ceiling.)',
      'Henkel’s monetization route into the biggest pool is indirect: professional products (~€14bn, 58% GP1; Kline manufacturer-level salon basis) ride the ~6%-growing services pool — back-bar share is the lever, not salon ownership.',
      'Scalp care (€14bn, 58% GP1, +100bps drift) is the richest adjacency Henkel can enter from existing chemistry — supplements and subscriptions are options, scalp is the move.',
      'Tools at 46% GP1 (Helen of Troy 45.7% reported FY2026) lose margin as premium hardware commoditizes — partner, don’t build.',
    ],
  },

  // ═════════ Home Care — Passport Categories (Euromonitor taxonomy, v3) ═════════
  {
    id: 'laundry_sub_segments',
    title: 'Home Care — Passport Category Profit Pools',
    subtitle: 'Brand-owner GP1 proxy by Euromonitor Passport category | Home Care ~$213bn (2025, RSP — triangulated, Passport-unconfirmed) | € at 1.15',
    poolSize: '~€186bn',
    poolSizeEurBn: 185.7,
    group: 'LHC',
    kind: 'SubSegment',
    prismProxyCategories: ['lhc_fcn', 'lhc_fca', 'lhc_ffi', 'lhc_lad', 'lhc_hdw', 'lhc_adw', 'lhc_hsc', 'lhc_ic'],
    construction:
      'v3 (2026-07-02): rows = Euromonitor Passport’s Home Care tree (Laundry Care split into Detergents / Fabric Softeners / Laundry Aids; Dishwashing split Hand / Automatic; Surface, Toilet, Bleach, Polishes, Home Insecticides, Air Care) so an internal Passport extract drops in 1:1 — and, for the first time, EVERY PRISM LHC category has a pool row (Toilet Care for Bref and Home Insecticides for IC were previously invisible). Passport values are not shareable (licence) — every size is a PUBLIC TRIANGULATION at 2025 RSP (recipes in each source hover); the 11 rows sum to $213.5bn ≈ the triangulated Home Care total. Replaces the v2 laundry format view whose bars mixed hierarchy levels (detergent formats next to categories) and overweighted stain removers ~3× via a surface-stain-inflated scope; detergent format mix (liquid ≈ half, powder ≈ ⅓, unit-dose ≈ 10–14%) now lives inside the Laundry Detergents row note, matching Passport’s drill-down level. HCB mapping: Detergents → FCN+FCA (internal split — Passport has no fine-fabric category); Softeners → FFI; Aids (+ Carpet Cleaners, folded) → LAD; Hand/Auto Dishwashing → HDW/ADW; Surface+Toilet+Bleach+Polishes → HSC cluster; Home Insecticides → IC; Air Care → no HCB category (white-space adjacency).',
    items: [
      {
        id: 'l_sub_1', label: 'Laundry', sublabel: 'Detergents',
        revenueShare: 0.375, gp1Margin: 0.43, revenueCAGR: 0.045, gp1DeltaBps: -50,
        revenueDriver: 'EM volume + DM price/mix ≈ 4–5% nominal (EMI: laundry = #2 growth category to 2029); Circana US: base detergent +2.6% (Jan-25).',
        marginDriver: 'PL battleground; unit-dose mix accretion nets against powder decline (formats: liquid ≈ ½, powder ≈ ⅓ and fading, pods ≈ 10–14% compounding).',
        note: 'Maps to FCN + FCA — the heavy-duty vs. fine-fabric split needs INTERNAL data; Passport keeps fine-fabric inside this line.',
        linkedCategoryId: 'lhc_fcn',
        sources: {
          revenue: [MKT.laundryDetergents, MKT.circanaLaundry],
          margin: [asDerived(SRC.unilever, 'Unilever 46.9% / P&G 51.2% / Henkel 50.8% / C&D 44.7% group GMs bracket the blended format mix at ~43%.'), SRC.pg, SRC.henkel],
        },
      },
      {
        id: 'l_sub_2', label: 'Fabric', sublabel: 'Softeners',
        revenueShare: 0.063, gp1Margin: 0.46, revenueCAGR: 0.034, gp1DeltaBps: -50,
        revenueDriver: 'Sensorial habit compounds ~3–4%; skip-the-rinse and dryer-sheet decline cap DM.',
        marginDriver: 'Concentrates help; PL share rises slowly.',
        linkedCategoryId: 'lhc_ffi',
        sources: {
          revenue: [MKT.fabricSofteners],
          margin: [asDerived(SRC.unilever, 'Unilever 46.9% group GM as the anchor for its strongest fabric-enhancer portfolio.')],
        },
      },
      {
        id: 'l_sub_3', label: 'Laundry', sublabel: 'Aids',
        revenueShare: 0.030, gp1Margin: 0.50, revenueCAGR: 0.055, gp1DeltaBps: 50,
        revenueDriver: 'Circana: US additives/odour care +4.7% vs. +2.6% base detergent; boosters ride the fragrance supercycle.',
        marginDriver: 'Specialist branding (Vanish/Sil) holds price; fragrance-bead economics accrete.',
        note: 'Incl. stain removers, whiteners, water softeners, scent boosters + Carpet Cleaners (folded, <$1bn). v2 overweighted this ~3× via a surface-stain-inflated source.',
        linkedCategoryId: 'lhc_lad',
        sources: {
          revenue: [MKT.laundryAids],
          margin: [asDerived(SRC.reckitt, 'Reckitt group GM 60.8% (Vanish-class specialists) calibrates the category at ~50%.')],
        },
      },
      {
        id: 'l_sub_4', label: 'Hand', sublabel: 'Dishwashing',
        revenueShare: 0.089, gp1Margin: 0.48, revenueCAGR: 0.035, gp1DeltaBps: -50,
        revenueDriver: 'Mature DM habit; EM growth in bars→liquid conversion keeps the line at ~3–4%.',
        marginDriver: 'Heavy promo intensity; brand premiums (Fairy/Dawn/Pril) defend the top.',
        linkedCategoryId: 'lhc_hdw',
        sources: {
          revenue: [MKT.handDishNew],
          margin: [asDerived(SRC.colgate, 'Colgate 60.1% (Palmolive) and Unilever 46.9% reported bracket the category.'), SRC.unilever],
        },
      },
      {
        id: 'l_sub_5', label: 'Automatic', sublabel: 'Dishwashing',
        revenueShare: 0.066, gp1Margin: 0.50, revenueCAGR: 0.065, gp1DeltaBps: 50,
        revenueDriver: 'EMI: dishwashing is the FASTEST-growing home care category (+12% constant 2024–29) — machine penetration + premium multi-chamber tabs; ADW carries the growth.',
        marginDriver: 'Tech-format premium holds; PL tabs improve but lag on claims.',
        note: 'Somat. Growth honest-based vs. Market.us’ 8%: nominal ~6–7%.',
        linkedCategoryId: 'lhc_adw',
        sources: {
          revenue: [MKT.adwNew],
          margin: [asDerived(SRC.reckitt, 'Reckitt (Finish) 60.8% reported group GM anchors the ceiling; category set at 50%.')],
        },
      },
      {
        id: 'l_sub_6', label: 'Surface', sublabel: 'Care',
        revenueShare: 0.141, gp1Margin: 0.46, revenueCAGR: 0.045, gp1DeltaBps: -50,
        revenueDriver: 'EMI: 3rd-fastest home care category to 2029; hygiene habit + multi-purpose formats.',
        marginDriver: 'Reckitt-class specialists hold 60%+; PL erodes the middle.',
        linkedCategoryId: 'lhc_hsc',
        sources: {
          revenue: [MKT.surfaceCare],
          margin: [asDerived(SRC.reckitt, 'Reckitt 60.8% / Unilever 46.9% / Clorox 45.2% reported bracket the category.'), SRC.clorox, SRC.unilever],
        },
      },
      {
        id: 'l_sub_7', label: 'Toilet', sublabel: 'Care',
        revenueShare: 0.049, gp1Margin: 0.52, revenueCAGR: 0.040, gp1DeltaBps: 0,
        revenueDriver: 'Habitual replenishment; rim/gel format innovation prices above liquid bleach substitutes.',
        marginDriver: 'Specialist premium (Bref/Harpic duopoly in many markets) holds against PL.',
        note: 'NEW ROW — Bref’s core category was previously invisible in the explorer. HSC cluster.',
        linkedCategoryId: 'lhc_hsc',
        sources: {
          revenue: [MKT.toiletCare],
          margin: [asDerived(SRC.reckitt, 'Reckitt (Harpic) 60.8% reported group GM as ceiling; Henkel (Bref) 50.8% as floor ⇒ ~52%.'), SRC.henkel],
        },
      },
      {
        id: 'l_sub_8', label: 'Bleach',
        revenueShare: 0.033, gp1Margin: 0.35, revenueCAGR: 0.015, gp1DeltaBps: -50,
        revenueDriver: 'DM substitution by surface care; EM/LatAm habit keeps volume alive — net ~1–2%.',
        marginDriver: 'Commodity chemistry; price-led PL competition.',
        note: 'NEW ROW — HSC cluster; marginal Henkel play, shown for pool completeness.',
        linkedCategoryId: 'lhc_hsc',
        sources: {
          revenue: [MKT.bleach],
          margin: [asDerived(SRC.clorox, 'Clorox group GM 45.2% is the BRANDED ceiling; the commodity bleach tier sits well below ⇒ ~35%.')],
        },
      },
      {
        id: 'l_sub_9', label: 'Polishes',
        revenueShare: 0.021, gp1Margin: 0.48, revenueCAGR: 0.005, gp1DeltaBps: -50,
        revenueDriver: 'Structurally flat-to-declining; hard-floor care and shoe-care niches persist.',
        marginDriver: 'Shrinking niche holds price but loses scale leverage.',
        note: 'NEW ROW — HSC cluster; no Henkel play.',
        linkedCategoryId: 'lhc_hsc',
        sources: {
          revenue: [MKT.polishes],
          margin: [asEstimate(SRC.clorox, 'No pure-play comp files polish margins (SC Johnson is private); niche-specialist economics set at ~48%.')],
        },
      },
      {
        id: 'l_sub_10', label: 'Home', sublabel: 'Insecticides',
        revenueShare: 0.068, gp1Margin: 0.55, revenueCAGR: 0.050, gp1DeltaBps: 50,
        revenueDriver: 'EM penetration + vector-borne disease pressure (dengue expansion); climate lengthens seasons.',
        marginDriver: 'Efficacy claims + regulatory moats support specialist pricing (SCJ/Godrej-class).',
        note: 'NEW ROW — PRISM’s IC category finally has a pool row. Widest public uncertainty ($12.6–20.9bn) — the highest-value Passport confirmation.',
        linkedCategoryId: 'lhc_ic',
        sources: {
          revenue: [MKT.insecticides],
          margin: [asEstimate(SRC.reckitt, 'Specialist pest brands sat inside Reckitt’s 60.8% group GM until Mortein moved to Vestacy (Dec-2025); Godrej/SCJ comps support ~55%.')],
        },
      },
      {
        id: 'l_sub_11', label: 'Air', sublabel: 'Care',
        revenueShare: 0.066, gp1Margin: 0.55, revenueCAGR: 0.050, gp1DeltaBps: 50,
        revenueDriver: 'Fragrance supercycle + wellness framing; premium formats (diffusers) lift value ~5% nominal (moderated from Precedence’s 9%).',
        marginDriver: 'Fragrance-led COGS economics; format mix accretes.',
        note: 'No HCB category — white-space adjacency; the Vestacy carve-out (Air Wick) keeps the entry window open.',
        linkedCategoryId: null,
        sources: {
          revenue: [MKT.airCareNew],
          margin: [asDerived(SRC.reckitt, 'Air Wick sat inside Reckitt’s 60.8% reported GM before the Essential Home divestment (Vestacy, completed 31-Dec-2025); category set at 55%.'), asEstimate(SRC.pg, 'Febreze inside P&G 51.2% group GM.')],
        },
      },
    ],
    insights: [
      'The explorer finally shows PRISM’s whole LHC footprint: Toilet Care (~€9bn, 52% GP1 — Bref) and Home Insecticides (~€13bn, 55% GP1 — IC) were invisible in v2; together they are ~12% of Home Care and carry two of its richest specialist margins.',
      'Laundry Detergents at ~38% of Home Care remain the volume anchor at the GP1 floor (43%, −50bps): scale funds the portfolio, specialists build it — Aids, Toilet, Insecticides and ADW all sit ≥50% GP1 with flat-to-positive drift.',
      'Dishwashing is the growth engine of the tree (EMI: +12% constant 2024–29, the fastest category) and ADW is its compounding half (~6.5% nominal, 50% GP1, +50bps) — the "fund Somat first" conclusion survives the honest re-basing that cut ADW’s size ~35% vs. the retired Market.us figure.',
      'Every size is a flagged public triangulation at RSP (recipe in each source hover) — Passport values are licence-restricted, so treat levels as ±10–15% (insecticides ±25%) until internally confirmed; ranks, growth ordering and margin structure are robust to that band.',
    ],
  },

  // ═════════ Laundry — Core + Adjacent (CORE first) ═════════
  {
    id: 'laundry_core_adjacent',
    title: 'Laundry Care — Core + Adjacent Profit Pools',
    subtitle: 'Core branded products vs. adjacent pools | Combined ~€315bn ($363bn) | € at 1.15',
    poolSize: '~€315bn',
    poolSizeEurBn: 315.3,
    group: 'LHC',
    kind: 'CoreAdjacent',
    prismProxyCategories: ['lhc_fcn', 'lhc_fca', 'lhc_ffi', 'lhc_adw', 'lhc_hsc'],
    construction:
      'v3 (2026-07-02) pool sizes side by side, normalized over $362.6bn: core Laundry Care ~$100bn (2025 RSP triangulation — recipe in the source hover; prior ~$85bn ran ~15% low), laundry services $78.2bn (GVR 2024), washing machines $66.9bn (FBI 2025), Surface Care ~$30bn (Passport-consistent — the v2 “~$55bn surface cleaners” blob silently mixed Surface + Toilet + Bleach + Polishes and is retired; those categories now live on the Home Care category view), on-demand laundry $28.5bn (GVR 2023, definition flagged), Hand Dishwashing ~$19bn and Automatic Dishwashing ~$14bn (Passport-consistent splits of Dishwashing ~$33bn; Market.us’ $19.2bn ADW retired ~35% high), Air Care ~$14bn (Passport-consistent; Precedence $17.2bn scope-inflated), smart washers $12.0bn (GVR 2024).',
    items: [
      {
        id: 'l_ca_1', label: 'CORE', sublabel: 'Laundry (Branded)',
        revenueShare: 0.276, gp1Margin: 0.46, revenueCAGR: 0.045, gp1DeltaBps: -50,
        revenueDriver: 'Euromonitor-anchored: ~4–5% nominal on the ~$100bn Laundry Care pool (EMI: #2 growth category to 2029).',
        marginDriver: 'PL + retailer pressure slightly outweigh RGM.',
        linkedCategoryId: 'lhc_fcn',
        sources: {
          revenue: [MKT.laundryTotal],
          margin: [asDerived(SRC.unilever, 'Unilever 46.9% / C&D 44.7% / Henkel 50.8% FY2025 reported bracket the tier.'), SRC.chd, SRC.henkel],
        },
      },
      {
        id: 'l_ca_2', label: 'Laundry', sublabel: 'Services',
        revenueShare: 0.216, gp1Margin: 0.40, revenueCAGR: 0.073, gp1DeltaBps: 50,
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
        revenueShare: 0.185, gp1Margin: 0.16, revenueCAGR: 0.086, gp1DeltaBps: -100,
        revenueDriver: 'FBI: 8.6% CAGR — EM penetration + connected replacement cycle.',
        marginDriver: 'Whirlpool 15.4% reported FY2025; Asian price war continues.',
        linkedCategoryId: null,
        sources: {
          revenue: [MKT.washingMachines],
          margin: [SRC.whirlpool],
        },
      },
      {
        id: 'l_ca_4', label: 'Surface', sublabel: 'Care',
        revenueShare: 0.083, gp1Margin: 0.46, revenueCAGR: 0.045, gp1DeltaBps: -50,
        revenueDriver: 'EMI: 3rd-fastest home care category to 2029; hygiene habit + multi-purpose formats.',
        marginDriver: 'Reckitt-class specialists hold 60%+; PL erodes the middle.',
        note: 'Passport-consistent Surface Care only — Toilet/Bleach/Polishes moved to the Home Care category view (v2’s $55bn blob retired).',
        linkedCategoryId: 'lhc_hsc',
        sources: {
          revenue: [MKT.surfaceCare],
          margin: [asDerived(SRC.reckitt, 'Reckitt 60.8% / Unilever 46.9% / Clorox 45.2% reported bracket the tier.'), SRC.clorox, SRC.unilever],
        },
      },
      {
        id: 'l_ca_5', label: 'On-Demand', sublabel: 'Laundry Apps',
        revenueShare: 0.079, gp1Margin: 0.35, revenueCAGR: 0.150, gp1DeltaBps: 200,
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
        revenueShare: 0.052, gp1Margin: 0.48, revenueCAGR: 0.035, gp1DeltaBps: -50,
        revenueDriver: 'Mature DM habit; EM bars→liquid conversion keeps ~3–4%.',
        marginDriver: 'Heavy promo intensity; brand premiums (Fairy/Dawn/Pril) defend the top.',
        linkedCategoryId: 'lhc_hdw',
        sources: {
          revenue: [MKT.handDishNew],
          margin: [asDerived(SRC.colgate, 'Colgate 60.1% (Palmolive) and Unilever 46.9% reported bracket the format.'), SRC.unilever],
        },
      },
      {
        id: 'l_ca_7', label: 'Auto-Dish', sublabel: '(ADW)',
        revenueShare: 0.039, gp1Margin: 0.50, revenueCAGR: 0.065, gp1DeltaBps: 50,
        revenueDriver: 'EMI: dishwashing = fastest-growing home care category (+12% constant 2024–29); ADW carries it — penetration + premium tabs, ~6–7% nominal.',
        marginDriver: 'Tech-format premium holds; PL tabs improve but lag on claims.',
        note: 'Re-based: Market.us $19.2bn / 8% retired (~35% high); Passport-consistent ~$14bn.',
        linkedCategoryId: 'lhc_adw',
        sources: {
          revenue: [MKT.adwNew],
          margin: [asDerived(SRC.reckitt, 'Reckitt (Finish) 60.8% reported group GM anchors the ceiling; format set at 50%.')],
        },
      },
      {
        id: 'l_ca_8', label: 'Air', sublabel: 'Care',
        revenueShare: 0.039, gp1Margin: 0.55, revenueCAGR: 0.050, gp1DeltaBps: 50,
        revenueDriver: 'Fragrance supercycle + wellness framing, ~5% nominal (Precedence’s 9% treated as scope-inflated ceiling).',
        marginDriver: 'Fragrance-led COGS economics; premium formats (diffusers) lift mix.',
        linkedCategoryId: null,
        sources: {
          revenue: [MKT.airCareNew],
          margin: [asDerived(SRC.reckitt, 'Air Wick sat inside Reckitt’s 60.8% reported GM before the 2025 Essential Home divestment to Advent (Vestacy, completed 31-Dec-2025); format set at 55%.'), asEstimate(SRC.pg, 'Febreze inside P&G 51.2% group GM.')],
        },
      },
      {
        id: 'l_ca_9', label: 'Smart /', sublabel: 'Connected Wash',
        revenueShare: 0.033, gp1Margin: 0.28, revenueCAGR: 0.246, gp1DeltaBps: -100,
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
      'The combined laundry universe is ~€315bn (Euromonitor-anchored core + adjacencies, v3 re-based), and margin quality is inversely distributed: the biggest adjacencies (services ~22%, appliances ~19%) earn just 40% and 16% GP1, while branded core laundry (~28%) carries the richest mass margin — adjacency size ≠ adjacency attractiveness.',
      'ADW stays the asymmetric bet after the honest re-basing (size cut ~35%, growth moderated 8%→6.5%): 50% GP1, +50bps drift on the fastest-growing home care category (EMI), and Henkel already holds the #2 European franchise (Somat) — pool math still says fund it before any new adjacency.',
      'Air care (~5% growth, 55% GP1 — resized to the Passport-consistent ~$14bn) just changed hands: Reckitt’s Essential Home divestment (Air Wick → Vestacy/Advent, completed 31-Dec-2025) opens the first structural entry window in a decade.',
      'v3 note: this view now shows Passport-consistent categories only — Toilet Care, Bleach, Polishes and Home Insecticides live on the Home Care category view, where every PRISM LHC category finally has a pool row.',
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
