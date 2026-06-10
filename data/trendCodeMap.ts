/**
 * trendCodeMap.ts — canonical display-code ↔ trend-ID mapping.
 *
 * GENERATED from pulse/seed_trends.py (2026-06-10). Single source of truth
 * for the short trend codes used across the Consumer Journey layer:
 *   code  = force letter (C/T/G/K/E/X) + the rNN number of the seed trend id
 *   e.g.  'C-08' ↔ consumer_r08, 'X-01' ↔ competitive_r01.
 * Names/forces/directions are verbatim from the seed DB — do NOT hand-edit;
 * regenerate when the trend base changes (see scripts note in CLAUDE.md).
 *
 * RETIRED_CODES: display codes whose underlying trends were retired from the
 * trend base (v3.1/v3.3) and must not be cited as live drivers.
 */

export type TrendDirection = 'Expansion' | 'Contraction';

export interface TrendCodeInfo {
  trendId: string;
  name: string;
  force: string;
  direction: TrendDirection;
  /** First sentence of the seed description — offline fallback only;
   *  the live description should come from the trends API. */
  fallbackDescription: string;
}

export const TREND_CODE_MAP: Record<string, TrendCodeInfo> = {
  'C-01': {"trendId":"consumer_r01","name":"Private Label Structural Penetration in Europe","force":"Consumer","direction":"Contraction","fallbackDescription":"Private label hit 42% value share in EU6, €317B in total PL sales (Circana 52w to Sep 2025)."},
  'C-02': {"trendId":"consumer_r02","name":"GLP-1 Drugs Reshape Consumer Spending Patterns","force":"Consumer","direction":"Expansion","fallbackDescription":"GLP-1 adoption accelerating dramatically: 30M Americans projected on GLP-1 by 2030."},
  'C-03': {"trendId":"consumer_r03","name":"Premiumization Acceleration in Hair Care","force":"Consumer","direction":"Expansion","fallbackDescription":"Premium hair care growing 2-3x mass rate confirmed."},
  'C-04': {"trendId":"consumer_r04","name":"Conscious Consumption and Cleanical Beauty","force":"Consumer","direction":"Expansion","fallbackDescription":"Cleanical convergence confirmed as dominant Beauty trend, now entering mass retail aisles (2026)."},
  'C-05': {"trendId":"consumer_r05","name":"Silver Economy — Aging Population Shifts Category Demand","force":"Consumer","direction":"Expansion","fallbackDescription":"Eurostat projections confirmed."},
  'C-06': {"trendId":"consumer_r06","name":"Cost-of-Living Squeeze and Persistent Trading Down","force":"Consumer","direction":"Contraction","fallbackDescription":"Trading-down persists but stabilizing in 2026."},
  'C-07': {"trendId":"consumer_r07","name":"Scalp Care Emerges as Standalone Category","force":"Consumer","direction":"Expansion","fallbackDescription":"Scalp care category grew 19% YoY in H1 2025."},
  'C-08': {"trendId":"consumer_r08","name":"Male Grooming Structural Growth","force":"Consumer","direction":"Expansion","fallbackDescription":"European male grooming: $23.6B in 2025, 7.65% CAGR confirmed."},
  'C-09': {"trendId":"consumer_r09","name":"Fragrance and Sensory Premiumization in Home Care","force":"Consumer","direction":"Expansion","fallbackDescription":"Fragrance premiumization accelerating: laundry scent boosters/perfume products growing 15%+ in Southern Europe, now expanding to Germany/Northern Europe."},
  'C-10': {"trendId":"consumer_r10","name":"Hair Loss and Thinning Treatments Enter Consumer Mainstream","force":"Consumer","direction":"Expansion","fallbackDescription":"Hair loss market confirmed at $2.93B, 7.77% CAGR."},
  'C-11': {"trendId":"consumer_r11","name":"Gen Z Dupe Culture and Ingredient Literacy","force":"Consumer","direction":"Contraction","fallbackDescription":"Dupe culture confirmed as structural shift."},
  'C-13': {"trendId":"consumer_r13","name":"Refill and Reuse Economy in Household Care","force":"Consumer","direction":"Expansion","fallbackDescription":"PPWR refill targets confirmed for 2030."},
  'C-14': {"trendId":"consumer_r14","name":"Between-Wash Fabric Care as Standalone Consumption Occasion","force":"Consumer","direction":"Expansion","fallbackDescription":"Between-wash fabric care confirmed as fastest-growing LHC occasion."},
  'C-15': {"trendId":"consumer_r15","name":"Hair Styling and Maintenance Between Washes","force":"Consumer","direction":"Expansion","fallbackDescription":"Dry shampoo/texture spray growth confirmed."},
  'C-16': {"trendId":"consumer_r16","name":"China C-Beauty Nationalism and Domestic Brand Preference","force":"Consumer","direction":"Contraction","fallbackDescription":"C-Beauty nationalism confirmed — domestic brands 56% of China beauty value."},
  'C-17': {"trendId":"consumer_r17","name":"India Premium Affordability and Middle-Class Expansion","force":"Consumer","direction":"Expansion","fallbackDescription":"India BPC market $30B, 11% CAGR confirmed as fastest-growing top-10 market."},
  'C-18': {"trendId":"consumer_r18","name":"US Hispanic/Latino Consumers Drive Hair and LHC Category Growth","force":"Consumer","direction":"Expansion","fallbackDescription":"Demographics and spending data confirmed."},
  'C-19': {"trendId":"consumer_r19","name":"Southeast Asia Digital-First Beauty Market","force":"Consumer","direction":"Expansion","fallbackDescription":"600M consumers with the world's highest e-commerce growth rates."},
  'C-20': {"trendId":"consumer_r20","name":"Brazil/Mexico Premiumization and Nearshoring Beneficiary","force":"Consumer","direction":"Expansion","fallbackDescription":"Latin America BPC market $60B+ and growing."},
  'C-21': {"trendId":"consumer_r21","name":"Longevity Medicine Crossover into Beauty and Hair Care","force":"Consumer","direction":"Expansion","fallbackDescription":"Global anti-aging market reaching $120B by 2030 (7% CAGR from $85B in 2025)."},
  'C-22': {"trendId":"consumer_r22","name":"Laundry Sheet/Strip Format Disruption","force":"Consumer","direction":"Contraction","fallbackDescription":"Detergent sheets and ultra-concentrated strips gaining traction: Earth Breeze, Tru Earth, Blueland leading."},
  'C-23': {"trendId":"consumer_r23","name":"Wellness-to-Beauty Convergence: Ingestibles + Topicals","force":"Consumer","direction":"Expansion","fallbackDescription":"Supplement + topical regimens combining for holistic beauty outcomes."},
  'C-24': {"trendId":"consumer_r24","name":"Natural/Textured Hair as Mainstream Global Category","force":"Consumer","direction":"Expansion","fallbackDescription":"65% of the world's population has textured, curly, or coily hair — yet mainstream hair care portfolios are designed primarily for straight/wavy hair types."},
  'C-25': {"trendId":"consumer_r25","name":"Birth Rate Collapse and Household Atomisation","force":"Consumer","direction":"Contraction","fallbackDescription":"Sub-replacement fertility is now structural across Europe (TFR 1.38), East Asia (Korea 0.72, Japan 1.20), and North America (1.62)."},
  'C-26': {"trendId":"consumer_r26","name":"Gen Alpha (2010+) Enters Personal-Care Category","force":"Consumer","direction":"Expansion","fallbackDescription":"Gen Alpha (born 2010-2024) begins entering the personal-care category in earnest 2026-2030 as the oldest cohort turns 14-16."},
  'C-27': {"trendId":"consumer_r27","name":"Hand-Dish to Auto-Dish Conversion in Emerging Markets","force":"Consumer","direction":"Expansion","fallbackDescription":"Dishwasher penetration in India (4%), China (12%), Brazil (9%), Mexico (15%) remains far below developed-market levels (Germany 71%, US 68%)."},
  'C-28': {"trendId":"consumer_r28","name":"Laundry Scent Boosters as Structural Premium Category","force":"Consumer","direction":"Expansion","fallbackDescription":"Laundry scent boosters (P&G Lenor Unstoppables archetype) have graduated from category novelty to structural premium LAD segment."},
  'C-29': {"trendId":"consumer_r29","name":"Delicates & Performance Fabric Care Revival (Perwoll Occasion)","force":"Consumer","direction":"Expansion","fallbackDescription":"Technical-fabric ownership (athleisure, merino, performance synthetics) now represents 35%+ of the average European wardrobe vs."},
  'C-30': {"trendId":"consumer_r30","name":"Longevity Economy — LHC / Home Hygiene Split","force":"Consumer","direction":"Expansion","fallbackDescription":"consumer_r21 (Longevity Economy) correctly captures the Hair/Beauty side of the longevity wave but the LHC-specific dimension has been missed."},
  'C-31': {"trendId":"consumer_r31","name":"Cleaning-Fluency Generational Decline (Gen Z Home-Care Literacy)","force":"Consumer","direction":"Contraction","fallbackDescription":"Gen Z enters adult household formation (2026-2030) with materially lower 'cleaning fluency' than prior generations — only 34% know when to use specialty cleaners, versus 68% of Gen X (NielsenIQ 2025)."},
  'C-32': {"trendId":"consumer_r32","name":"Beauty-as-Medicine / Tele-Derm DTC (Hair & Scalp)","force":"Consumer","direction":"Contraction","fallbackDescription":"Direct-to-consumer tele-dermatology services (Hims Hair, Hers, Ro, Nurx) have built $2B+ run-rates in hair/scalp treatment prescriptions (finasteride, minoxidil, spironolactone)."},
  'C-33': {"trendId":"consumer_r33","name":"Ultra-Fast-Fashion Beauty: Shein/Temu-Style Price Floor Collapse","force":"Consumer","direction":"Contraction","fallbackDescription":"Shein, Temu and Pinduoduo-owned beauty lines are replicating the ultra-fast-fashion model in mass hair and body care: direct-from-Guangzhou shipping, <€3 hero SKUs, creator-driven virality."},
  'E-01': {"trendId":"environmental_r01","name":"Palm Oil Supply Chain Disruption (Indonesia B50)","force":"Environmental","direction":"Contraction","fallbackDescription":"Indonesia B50 mandate impact confirmed."},
  'E-02': {"trendId":"environmental_r02","name":"Water Scarcity Drives Low-Water Formulations","force":"Environmental","direction":"Expansion","fallbackDescription":"Water scarcity intensifying in Southern Europe, MENA, Asia."},
  'E-03': {"trendId":"environmental_r03","name":"Carbon Border Adjustment and Scope 3 Reporting","force":"Environmental","direction":"Contraction","fallbackDescription":"CBAM and CSRD timeline confirmed."},
  'E-04': {"trendId":"environmental_r04","name":"EPR Fee Escalation and Eco-Modulation","force":"Environmental","direction":"Contraction","fallbackDescription":"EPR eco-modulation confirmed and expanding across EU member states."},
  'E-05': {"trendId":"environmental_r05","name":"Climate-Driven Pest Pattern Shifts (Insecticide Demand)","force":"Environmental","direction":"Expansion","fallbackDescription":"Climate-driven pest expansion confirmed."},
  'E-06': {"trendId":"environmental_r06","name":"Supply Chain Nearshoring and Geopolitical Diversification","force":"Environmental","direction":"Contraction","fallbackDescription":"Supply chain diversification confirmed and accelerating post-tariff escalation (G-08)."},
  'E-07': {"trendId":"environmental_r07","name":"Energy Cost Volatility and European Manufacturing Competitiveness","force":"Environmental","direction":"Contraction","fallbackDescription":"European energy cost disadvantage confirmed at 2-3x US levels."},
  'E-08': {"trendId":"environmental_r08","name":"Textile Longevity and Garment Life Extension Economy","force":"Environmental","direction":"Expansion","fallbackDescription":"EU Circular Textiles Strategy confirmed."},
  'E-09': {"trendId":"environmental_r09","name":"Climate Adaptation Costs for European Manufacturing","force":"Environmental","direction":"Contraction","fallbackDescription":"Extreme weather events disrupting European supply chains with increasing frequency."},
  'E-10': {"trendId":"environmental_r10","name":"Freshwater Crisis Accelerates Waterless Formulation Mandate","force":"Environmental","direction":"Contraction","fallbackDescription":"Global freshwater demand will exceed supply by 40% by 2030 (UNEP)."},
  'E-11': {"trendId":"environmental_r11","name":"Scope 3+ Value Chain Decarbonization Mandates","force":"Environmental","direction":"Contraction","fallbackDescription":"CBAM expansion to downstream products proposed Dec 2025, decision pending."},
  'G-01': {"trendId":"government_r01","name":"EU PFAS Universal Restriction","force":"Government","direction":"Contraction","fallbackDescription":"PFAS restriction accelerating: as of January 1, 2026, cosmetic products containing PFAS already prohibited in EU."},
  'G-02': {"trendId":"government_r02","name":"EU Microplastics Ban — Phase 2 Implementation","force":"Government","direction":"Contraction","fallbackDescription":"Phase 2 timeline confirmed 2027-2029."},
  'G-03': {"trendId":"government_r03","name":"EU Cosmetics Regulation Omnibus VII/VIII Revision","force":"Government","direction":"Contraction","fallbackDescription":"Rolling restriction of UV filters, preservatives, fragrances, colorants under EC 1223/2009 amendments."},
  'G-04': {"trendId":"government_r04","name":"EU PPWR — Packaging and Packaging Waste Regulation","force":"Government","direction":"Contraction","fallbackDescription":"PPWR applies from August 12, 2026 confirmed."},
  'G-05': {"trendId":"government_r05","name":"EU Green Claims Directive / EmpCo Enforcement","force":"Government","direction":"Contraction","fallbackDescription":"EmpCo Directive applying September 2026 confirmed."},
  'G-06': {"trendId":"government_r06","name":"EU Deforestation Regulation (EUDR)","force":"Government","direction":"Contraction","fallbackDescription":"EUDR December 2026 application confirmed."},
  'G-07': {"trendId":"government_r07","name":"EU Digital Product Passport (DPP)","force":"Government","direction":"Contraction","fallbackDescription":"PPWR mandates digital identifiers (QR codes) from 2027."},
  'G-08': {"trendId":"government_r08","name":"Tariffs, Trade Wars, and Deglobalization (US-EU-China)","force":"Government","direction":"Contraction","fallbackDescription":"Trade tension escalated significantly."},
  'G-09': {"trendId":"government_r09","name":"US Tariffs and Reshoring Pressure on Imported FMCG Inputs","force":"Government","direction":"Contraction","fallbackDescription":"US tariff escalation confirmed."},
  'G-10': {"trendId":"government_r10","name":"EU AI Act Compliance Costs and Speed-to-Market Friction","force":"Government","direction":"Contraction","fallbackDescription":"EU AI Act fully applicable August 2, 2026; high-risk AI in regulated products extended to August 2, 2027."},
  'G-11': {"trendId":"government_r11","name":"Biodiversity Regulation and Nature-Related Supply Chain Mandates","force":"Government","direction":"Contraction","fallbackDescription":"Kunming-Montreal Global Biodiversity Framework mandates halting biodiversity loss by 2030: 30% land/marine protection, 30% restoration."},
  'G-12': {"trendId":"government_r12","name":"EU Textile Strategy and Circular Fashion Mandates","force":"Government","direction":"Expansion","fallbackDescription":"EU Strategy for Sustainable and Circular Textiles imposes garment longevity requirements and textile waste reduction targets."},
  'G-13': {"trendId":"government_r13","name":"MoCRA + US State Cosmetics Regulation (CA Prop 65, NY, WA)","force":"Government","direction":"Contraction","fallbackDescription":"MoCRA (Modernization of Cosmetics Regulation Act, 2022) enforcement phases fully in through 2028 — FDA registration, GMP, adverse-event reporting, fragrance-allergen disclosure all now binding."},
  'G-14': {"trendId":"government_r14","name":"Biodegradability Standards Tighten Around PVA Unit-Dose Films","force":"Government","direction":"Contraction","fallbackDescription":"Polyvinyl alcohol (PVA/PVOH) is the water-soluble polymer film used in virtually all liquid laundry and dishwasher pods."},
  'K-01': {"trendId":"customer_r01","name":"Discount Retail Channel Expansion in Europe","force":"Customer","direction":"Contraction","fallbackDescription":"Discount expansion confirmed."},
  'K-02': {"trendId":"customer_r02","name":"E-Commerce Profit Pool Maturation","force":"Customer","direction":"Contraction","fallbackDescription":"E-commerce stabilization at 12-15% confirmed."},
  'K-03': {"trendId":"customer_r03","name":"Retailer Consolidation and Power Concentration","force":"Customer","direction":"Contraction","fallbackDescription":"Retailer consolidation accelerating."},
  'K-04': {"trendId":"customer_r04","name":"TikTok Shop Becomes Top-5 FMCG Channel","force":"Customer","direction":"Expansion","fallbackDescription":"TikTok Shop US projected $23.4B in 2026 ecommerce sales (+48% YoY) — larger than Target, Costco, or Best Buy."},
  'K-06': {"trendId":"customer_r06","name":"FMCG Subscription and Loyalty Ecosystem Lock-in","force":"Customer","direction":"Contraction","fallbackDescription":"Subscription lock-in expanding — now encompasses Amazon S&S, Walmart+, European retailer apps (dm app, Rossmann app, REWE Payback)."},
  'K-07': {"trendId":"customer_r07","name":"Professional Salon Channel to Consumer Crossover","force":"Customer","direction":"Expansion","fallbackDescription":"Salon-to-consumer crossover accelerating: L'Oréal Professional Products +15% in 2025, Kérastase double-digit."},
  'K-08': {"trendId":"customer_r08","name":"US Retail Media Networks Reshape Brand-Customer Economics","force":"Customer","direction":"Contraction","fallbackDescription":"US retail media: $58.8B in 2025 (revised up from $55B), $69.3B forecast 2026."},
  'K-09': {"trendId":"customer_r09","name":"Agentic Commerce Reshapes Retailer-Brand Power Dynamics","force":"Customer","direction":"Contraction","fallbackDescription":"Retailer-side mirror of NEW-01 (technology_r11)."},
  'K-10': {"trendId":"customer_r10","name":"Chinese Live-Commerce / Douyin Model Exports","force":"Customer","direction":"Contraction","fallbackDescription":"Live-commerce (livestream shopping with immediate cart integration) captured 10-12% of Chinese FMCG retail by 2024 and is now exporting at speed: TikTok Shop Live in SEA (Indonesia 8% by 2025), Europe (UK live-commerce +"},
  'K-11': {"trendId":"customer_r11","name":"Retailer Loyalty Program Cannibalisation of Trade Spend","force":"Customer","direction":"Contraction","fallbackDescription":"Retailer loyalty programs (Tesco Clubcard, Kroger, Carrefour Rewards, dm App) are evolving from marketing vehicles into data-brokerage platforms that capture first-party consumer data and monetise it back to brands at a "},
  'T-01': {"trendId":"technology_r01","name":"AI-Driven Formulation and Speed-to-Market","force":"Technology","direction":"Expansion","fallbackDescription":"AI formulation accelerated beyond initial projections."},
  'T-02': {"trendId":"technology_r02","name":"Bio-Based and Green Chemistry Alternatives","force":"Technology","direction":"Expansion","fallbackDescription":"Bio-based chemistry progressing rapidly."},
  'T-03': {"trendId":"technology_r03","name":"Concentrated and Solid Formats Innovation","force":"Technology","direction":"Expansion","fallbackDescription":"Format innovation crossing early-adopter threshold confirmed."},
  'T-04': {"trendId":"technology_r04","name":"Microbiome Science for Hair and Skin","force":"Technology","direction":"Expansion","fallbackDescription":"Microbiome market accelerating (14.6% CAGR, scalp care 19% in H1 2025)."},
  'T-05': {"trendId":"technology_r05","name":"Manufacturing Automation and Industry 4.0","force":"Technology","direction":"Expansion","fallbackDescription":"Manufacturing AI adoption confirmed."},
  'T-06': {"trendId":"technology_r06","name":"Retail Media Networks as Primary FMCG Channel","force":"Technology","direction":"Contraction","fallbackDescription":"Retail media surging: US alone $58.8B in 2025, $69.3B forecast 2026 (+17.8% YoY)."},
  'T-07': {"trendId":"technology_r07","name":"AI-Powered Personalization at Scale","force":"Technology","direction":"Expansion","fallbackDescription":"L'Oréal K-SCAN (AI camera for personalized hair recommendations) proved +23% salon sales uplift — validating commercial case."},
  'T-08': {"trendId":"technology_r08","name":"Connected Appliances and Auto-Dosing Transform Detergent Economics","force":"Technology","direction":"Expansion","fallbackDescription":"Henkel Smartwash launched for sale in Europe 2025 (Persil Smartwash + Somat Smartwash)."},
  'T-10': {"trendId":"technology_r10","name":"Generative AI Content and Marketing Efficiency Revolution","force":"Technology","direction":"Expansion","fallbackDescription":"Gen AI marketing efficiency confirmed at 40-60% content production cost reduction."},
  'T-11': {"trendId":"technology_r11","name":"Agentic Commerce: AI Agents Make Autonomous Purchase Decisions","force":"Technology","direction":"Contraction","fallbackDescription":"By 2030, Morgan Stanley estimates AI shopping agents will capture $190-385B of US e-commerce spending (10-20% of online retail)."},
  'T-12': {"trendId":"technology_r12","name":"AI Agent Brand Invisibility in Low-Consideration Categories","force":"Technology","direction":"Contraction","fallbackDescription":"When AI agents make autonomous replenishment decisions, brand equity is bypassed for functional categories."},
  'T-13': {"trendId":"technology_r13","name":"Generative Search (GEO) Replaces Traditional Product Discovery — Expanded","force":"Technology","direction":"Contraction","fallbackDescription":"Expands M-01 (technology_r09)."},
  'T-14': {"trendId":"technology_r14","name":"Peptide and Bioactive Hair Science","force":"Technology","direction":"Expansion","fallbackDescription":"GHK-Cu peptides, NAD+ precursors, and bioactive compounds entering consumer hair formulation."},
  'T-15': {"trendId":"technology_r15","name":"Precision Fermentation Disrupts FMCG Ingredient Supply Chains","force":"Technology","direction":"Expansion","fallbackDescription":"Precision fermentation market projected at $36B by 2030 (43-48% CAGR)."},
  'T-16': {"trendId":"technology_r16","name":"Synthetic Biology Enables Novel Surfactants and Fragrances","force":"Technology","direction":"Expansion","fallbackDescription":"Synthetic biology enables bio-identical production of aroma molecules, specialty surfactants, and functional proteins without agricultural extraction."},
  'T-17': {"trendId":"technology_r17","name":"Neurocosmetics and Sensory-Science Hair Care","force":"Technology","direction":"Expansion","fallbackDescription":"Neurocosmetics — the science of topical ingredients acting on nerve endings to produce measurable sensory/wellbeing outcomes — has moved from claim to mechanism with peer-reviewed evidence in 2024-2025 (IFSCC, JCD public"},
  'T-18': {"trendId":"technology_r18","name":"Bathroom and Laundry-Room IoT — Connected Dispensers, Smart Mirrors","force":"Technology","direction":"Expansion","fallbackDescription":"Distinct from Smartwash (technology_r08, in-machine dosing)."},
  'T-19': {"trendId":"technology_r19","name":"Neuro-Scents: Functional Fragrance with Measured Neuro-Benefit","force":"Technology","direction":"Expansion","fallbackDescription":"A new class of fragrance formulation backed by EEG and fMRI validation: scents engineered and clinically tested for stated cognitive/emotional outcomes (focus, calm, sleep onset, stress reduction)."},
  'X-01': {"trendId":"competitive_r01","name":"Reckitt Essential Home Divestiture","force":"Competitive","direction":"Expansion","fallbackDescription":"Completion confirmed December 31, 2025."},
  'X-02': {"trendId":"competitive_r02","name":"Unilever Beauty and Wellbeing Pivot","force":"Competitive","direction":"Contraction","fallbackDescription":"Unilever B&W FY2025: +4.3% underlying sales confirmed."},
  'X-03': {"trendId":"competitive_r03","name":"P&G Superiority Framework and Innovation Fortress","force":"Competitive","direction":"Contraction","fallbackDescription":"P&G superiority framework confirmed and strengthening."},
  'X-04': {"trendId":"competitive_r04","name":"Indie Brand Omnichannel Pivot via TikTok Shop","force":"Competitive","direction":"Contraction","fallbackDescription":"The DTC-only indie-brand threat has mutated rather than disappeared."},
  'X-05': {"trendId":"competitive_r05","name":"Chinese FMCG Brands Enter European Market","force":"Competitive","direction":"Contraction","fallbackDescription":"Chinese brand EU penetration <2% but monitoring warranted."},
  'X-06': {"trendId":"competitive_r06","name":"Emerging Markets Growth Divergence — IMEA Leads","force":"Competitive","direction":"Expansion","fallbackDescription":"Henkel IMEA 12.1% organic growth confirmed, vastly outperforming 0.3% Consumer Brands organic average."},
  'X-07': {"trendId":"competitive_r07","name":"L'Oreal Tech-Beauty Platform Strategy","force":"Competitive","direction":"Contraction","fallbackDescription":"L'Oréal FY2025: €44.05B sales (+4% LfL), 725 patents filed, 4,000+ scientists."},
  'X-08': {"trendId":"competitive_r08","name":"K-Beauty and J-Beauty Export Wave into NA and EU Hair Care","force":"Competitive","direction":"Contraction","fallbackDescription":"K-beauty expansion confirmed: Europe market $2.7B (2025), 6.4% CAGR."},
  'X-09': {"trendId":"competitive_r09","name":"Sub-Saharan Africa: $200B FMCG Frontier by 2030","force":"Competitive","direction":"Expansion","fallbackDescription":"Africa's FMCG market projected at $200B by 2030, driven by 1.7B consumers."},
  'X-10': {"trendId":"competitive_r10","name":"Amazon/Platform Vertical Integration into FMCG","force":"Competitive","direction":"Contraction","fallbackDescription":"Amazon's private label operation is qualitatively different from traditional retail PL."},
  'X-11': {"trendId":"competitive_r11","name":"L'Oreal NVIDIA AI Molecule Discovery Partnership","force":"Competitive","direction":"Contraction","fallbackDescription":"L'Oreal partnered with NVIDIA for atomic-scale AI-powered molecule discovery."},
  'X-12': {"trendId":"competitive_r12","name":"DTC/Indie Brand Acquisition Arms Race Intensifies","force":"Competitive","direction":"Contraction","fallbackDescription":"Major acquisitions 2025-26: Rhode (e.l.f., $1B+), Medik8 (L'Oreal, $1.1B), Color Wow (L'Oreal), Dr Squatch (Unilever, $1.5B)."},
  'X-13': {"trendId":"competitive_r13","name":"Walmart / Costco / Aldi Vertical Integration into FMCG Supply","force":"Competitive","direction":"Contraction","fallbackDescription":"Top retailers are moving beyond traditional PL into full vertical integration."},
  'X-14': {"trendId":"competitive_r14","name":"AfCFTA Implementation Unlocks Pan-African Competitive Pressure","force":"Competitive","direction":"Expansion","fallbackDescription":"The African Continental Free Trade Area (AfCFTA) is moving from ratification (2019-22) to operational tariff-harmonisation (2026-28)."},
};

/** Trends retired from the base (v3.1: C-12 Post-COVID Hygiene, K-05 Quick
 *  Commerce; v3.3: T-09 superseded by T-13). Kept for reference/validation. */
export const RETIRED_CODES: Record<string, string> = {
  'C-12': 'Post-COVID Hygiene Habits Persistence (retired v3.1 — normalized)',
  'K-05': 'Quick Commerce Consolidation (retired v3.1 — structurally failed)',
  'T-09': 'Generic ML formulation / GEO discovery v1 (retired v3.3 — superseded by T-13)',
};

const ID_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(TREND_CODE_MAP).map(([code, v]) => [v.trendId, code]),
);

export const trendIdForCode = (code: string): string | undefined => TREND_CODE_MAP[code]?.trendId;
export const codeForTrendId = (trendId: string): string | undefined => ID_TO_CODE[trendId];
