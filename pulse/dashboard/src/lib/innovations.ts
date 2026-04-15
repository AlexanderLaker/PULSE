/**
 * PRISM Innovation Explorer — Full Innovation Portfolio Data
 * 16 Strategic Product Innovation Concepts
 * Source: PRISM Innovation Explorer Report, April 2026
 * Methodology: Bain Senior Partner-Grade Trend Convergence Analysis
 */

export type InnovationTier = 'WHITE_SPOT' | 'TRANSFORMATIONAL' | 'ADJACENT_INNOVATION' | 'BRAND_EXTENSION' | 'CORE_INNOVATION' | 'CATEGORY_EXPANSION' | 'CHANNEL_CROSSOVER' | 'REGULATORY_PROACTIVE' | 'MARKET_EXPANSION' | 'PREMIUMIZATION';

export type InnovationTierLevel = 1 | 2;

export interface EvaluationMetric {
  label: string;
  score: number;
  rating: string;
}

export interface RegionalReadiness {
  region: string;
  readiness: 'OPTIMAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface TrendConnection {
  code: string;
  name: string;
  direction: 'Expansion' | 'Contraction';
  rationale: string;
}

export interface TechSpec {
  title: string;
  description: string;
  icon: string; // material symbol name
}

export interface InnovationSource {
  title: string;
  url: string;
  tier: 'S' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C';
}

export interface Innovation {
  id: string;
  number: number;
  name: string;
  subtitle: string;
  category: string;
  categoryShort: string;
  categoryGroup: 'Hair' | 'LHC' | 'Cross-Category';
  type: InnovationTier;
  typeLabel: string;
  tierLevel: InnovationTierLevel;
  marketScore: number;
  fitScore: number;
  horizon: string;
  consumerNeed: string;
  techSpecs: TechSpec[];
  portfolioFit: string;
  evaluation: EvaluationMetric[];
  regionalReadiness: RegionalReadiness[];
  trendConnections: TrendConnection[];
  sources: InnovationSource[];
  consumerJourneyStages: string[];
  imageGradient: string; // CSS gradient for card background
  imageAccent: string;   // accent color for the innovation
}

// Category filter options matching PRISM's taxonomy
export const INNOVATION_CATEGORIES = [
  { id: 'all', label: 'All', short: 'All' },
  { id: 'hair_color', label: 'Hair: Color', short: 'Color' },
  { id: 'hair_care', label: 'Hair: Care', short: 'Care' },
  { id: 'hair_styling', label: 'Hair: Styling', short: 'Styling' },
  { id: 'hair_body', label: 'Hair: Body', short: 'Body' },
  { id: 'lhc_fcn', label: 'LHC: FCN', short: 'FCN' },
  { id: 'lhc_fca', label: 'LHC: FCA', short: 'FCA' },
  { id: 'lhc_ffi', label: 'LHC: FFI', short: 'FFI' },
  { id: 'lhc_lad', label: 'LHC: LAD', short: 'LAD' },
  { id: 'lhc_hdw', label: 'LHC: HDW', short: 'HDW' },
  { id: 'lhc_adw', label: 'LHC: ADW', short: 'ADW' },
  { id: 'lhc_hsc', label: 'LHC: HSC', short: 'HSC' },
  { id: 'lhc_ic', label: 'LHC: IC', short: 'IC' },
  { id: 'cross', label: 'Cross-Category', short: 'Cross' },
];

export const INNOVATIONS: Innovation[] = [
  {
    id: 'inn_01',
    number: 1,
    name: 'Microbiome-Powered Scalp Care System',
    subtitle: 'A clinically-validated, microbiome-powered scalp care ecosystem bridging professional diagnostics with consumer-grade treatment protocols.',
    category: 'Hair: Care (Scalp)',
    categoryShort: 'Care',
    categoryGroup: 'Hair',
    type: 'WHITE_SPOT',
    typeLabel: 'White Spot',
    tierLevel: 1,
    marketScore: 92,
    fitScore: 95,
    horizon: '2027–2028',
    consumerNeed: 'The scalp care market has emerged as the fastest-growing segment within hair care, projected to exceed $15B globally by 2030. Consumers increasingly recognize that healthy hair starts with a healthy scalp — mirroring the \'skinification-of-hair\' macro-trend. Despite this, most major FMCG portfolios lack a dedicated scalp care brand, leaving the space to dermatological specialists (The Ordinary, Nioxin) and indie entrants (The Inkey List). This concept fills the gap by translating professional salon diagnostic technology into a consumer-accessible system that combines AI-powered scalp assessment with a personalized treatment regimen.',
    techSpecs: [
      { title: 'Microbiome Technology', description: 'Probiotic lysate complexes (Lactobacillus ferment) and prebiotic inulin to rebalance scalp flora. Clinically tested for sebum regulation and barrier repair.', icon: 'biotech' },
      { title: 'Consumer Diagnostic Bridge', description: 'Simplified scalp analysis via smartphone camera + AI classification. Personalized protocol recommendation engine trained on 100K+ salon outcomes.', icon: 'smartphone' },
      { title: 'Treatment Architecture', description: '4-step system: Exfoliate (salicylic acid scalp scrub) > Balance (probiotic tonic) > Treat (targeted serum) > Protect (lightweight SPF scalp shield).', icon: 'science' },
      { title: 'Clean Formulation', description: 'PFAS-free, microplastic-free, EU Cosmetics Regulation Omnibus VII/VIII compliant. Vegan. Dermatologically tested at pH 5.5.', icon: 'eco' },
    ],
    portfolioFit: 'Requires a credible professional hair science heritage — ideally a parent brand with both salon-professional and consumer retail presence. Sub-brand positioning: clinical, dermatological, science-led. Price positioning: Premium (price index 180-220 vs. mass shampoo). Channel: Pharmacy, online DTC, selective retail (not mass grocery).',
    evaluation: [
      { label: 'Market Potential', score: 92, rating: 'EXCEPTIONAL' },
      { label: 'Consumer Sentiment', score: 88, rating: 'HIGH' },
      { label: 'Strategic Fit', score: 95, rating: 'EXCEPTIONAL' },
    ],
    regionalReadiness: [
      { region: 'Europe', readiness: 'OPTIMAL' },
      { region: 'North America', readiness: 'HIGH' },
      { region: 'High Growth', readiness: 'MEDIUM' },
      { region: 'Asia', readiness: 'MEDIUM' },
    ],
    trendConnections: [
      { code: 'C-07', name: 'Scalp Care Emerges as Standalone Category', direction: 'Expansion', rationale: 'Direct — this IS the white spot response' },
      { code: 'T-04', name: 'Microbiome Science for Hair and Skin', direction: 'Expansion', rationale: 'Core technology platform' },
      { code: 'C-03', name: 'Premiumization Acceleration in Hair Care', direction: 'Expansion', rationale: 'Premium price architecture justified by clinical positioning' },
      { code: 'K-07', name: 'Professional Salon Channel to Consumer Crossover', direction: 'Expansion', rationale: 'Technology bridge from professional to consumer' },
      { code: 'G-03', name: 'EU Cosmetics Regulation Omnibus VII/VIII', direction: 'Contraction', rationale: 'Pre-compliant formulation as competitive moat' },
    ],
    sources: [
      { title: 'Euromonitor International — Global Scalp Care Market Sizing 2025', url: 'https://www.euromonitor.com/haircare', tier: 'A' },
      { title: 'Mintel — Haircare Innovation Trends Q1 2026', url: 'https://www.mintel.com/beauty-and-personal-care-market-research/', tier: 'A' },
      { title: 'McKinsey Beauty Practice — Skinification of Hair', url: 'https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights', tier: 'A' },
      { title: 'PRISM Trend Database: C-07, T-04, K-07', url: '#prism-trends', tier: 'B+' },
    ],
    consumerJourneyStages: ['Awareness', 'Consideration', 'Purchase', 'Usage', 'Repurchase'],
    imageGradient: 'linear-gradient(135deg, #0891b2 0%, #065f46 100%)',
    imageAccent: '#0891b2',
  },
  {
    id: 'inn_02',
    number: 2,
    name: 'Anti-Thinning Hair Density Platform',
    subtitle: 'A gender-inclusive, multi-modal hair density platform addressing the $3B+ thinning/loss consumer segment — a major gap in most mainstream FMCG hair portfolios.',
    category: 'Hair: Care (Thinning/Loss)',
    categoryShort: 'Care',
    categoryGroup: 'Hair',
    type: 'WHITE_SPOT',
    typeLabel: 'White Spot',
    tierLevel: 1,
    marketScore: 94,
    fitScore: 88,
    horizon: '2027–2029',
    consumerNeed: 'Hair thinning and loss affects over 50% of men by age 50 and 40% of women at some point in their lives, yet the consumer treatment market remains dominated by pharmaceutical-adjacent brands (Regaine/Rogaine, Nioxin) and DTC insurgents (Nutrafol, Hims/Hers, Vegamour). Most mainstream hair care portfolios have no dedicated thinning/loss brand — one of the most significant white spots in the industry. The opportunity is to create a cosmetic-grade (not pharmaceutical) density system that targets the 80% of thinning consumers who want visible results without prescription commitments.',
    techSpecs: [
      { title: 'Density Complex', description: 'Caffeine + Biotin + Zinc PCA + Redensyl (DHQG + EGCG2) targeting hair follicle stem cells. Clinical studies showing 17% increase in hair density over 12 weeks.', icon: 'science' },
      { title: 'Multi-Modal System', description: '5-product architecture: Densifying Shampoo > Thickening Conditioner > Scalp Activation Serum > Overnight Root Treatment > Volume Finishing Spray.', icon: 'layers' },
      { title: 'Gender-Inclusive Design', description: 'Unisex core system with gender-specific serum variants (DHT-modulating for male-pattern, hormone-balancing for female). Packaging deliberately avoids medicalized aesthetics.', icon: 'diversity_3' },
      { title: 'AI Progress Tracking', description: 'Progress tracking via smartphone photos + AI hair density measurement. Monthly \'density score\' motivates continued usage and subscription retention.', icon: 'monitoring' },
    ],
    portfolioFit: 'Requires credible hair science heritage — professional salon bond/treatment technology is the ideal foundation. New sub-brand or brand extension positioning: confidence, vitality, scientific authority without pharmaceutical coldness. Price positioning: Super-premium (full system EUR 60-90). DTC subscription model with 20% discount for recurring delivery. Channel: Pharmacy (primary), online DTC, Amazon Premium Beauty, selective retail. NOT mass grocery.',
    evaluation: [
      { label: 'Market Potential', score: 94, rating: 'EXCEPTIONAL' },
      { label: 'Consumer Sentiment', score: 85, rating: 'HIGH' },
      { label: 'Strategic Fit', score: 88, rating: 'HIGH' },
    ],
    regionalReadiness: [
      { region: 'Europe', readiness: 'OPTIMAL' },
      { region: 'North America', readiness: 'HIGH' },
      { region: 'High Growth', readiness: 'MEDIUM' },
      { region: 'Asia', readiness: 'HIGH' },
    ],
    trendConnections: [
      { code: 'C-10', name: 'Hair Loss and Thinning Treatments Enter Consumer Mainstream', direction: 'Expansion', rationale: 'Direct white spot response — $3B+ market' },
      { code: 'C-05', name: 'Silver Economy — Aging Population Shifts Category Demand', direction: 'Expansion', rationale: 'Structural demand driver from demographics' },
      { code: 'C-03', name: 'Premiumization Acceleration in Hair Care', direction: 'Expansion', rationale: 'Super-premium price architecture' },
      { code: 'T-04', name: 'Microbiome Science for Hair and Skin', direction: 'Expansion', rationale: 'Scalp microbiome health supports follicle function' },
      { code: 'T-07', name: 'AI-Powered Personalization at Scale', direction: 'Expansion', rationale: 'AI progress tracking drives subscription retention' },
      { code: 'K-07', name: 'Professional Salon Crossover', direction: 'Expansion', rationale: 'Professional treatment credibility transferred to consumer' },
    ],
    sources: [
      { title: 'Grand View Research — Hair Loss Treatment Market Report 2025-2030', url: 'https://www.grandviewresearch.com/industry-analysis/hair-loss-treatment-products-market', tier: 'A' },
      { title: 'McKinsey Beauty Practice — The $3B Thinning Hair Opportunity', url: 'https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights', tier: 'A' },
      { title: 'Induchem AG — Redensyl Clinical Efficacy Dossier', url: 'https://www.givaudan.com/active-beauty/products/redensyl', tier: 'B+' },
      { title: 'PRISM Trend Database: C-10, C-05, T-04', url: '#prism-trends', tier: 'B+' },
    ],
    consumerJourneyStages: ['Awareness', 'Consideration', 'Purchase', 'Usage', 'Loyalty'],
    imageGradient: 'linear-gradient(135deg, #7c3aed 0%, #4338ca 100%)',
    imageAccent: '#7c3aed',
  },
  {
    id: 'inn_03',
    number: 3,
    name: 'Bio-Logic Concentrated Laundry Sheets',
    subtitle: 'Ultra-concentrated, plastic-free laundry sheets powered by enzyme-optimized bio-chemistry — redefining the detergent format for the post-PPWR regulatory era.',
    category: 'LHC: FCN (Fabric Cleaning)',
    categoryShort: 'FCN',
    categoryGroup: 'LHC',
    type: 'ADJACENT_INNOVATION',
    typeLabel: 'Adjacent Innovation',
    tierLevel: 1,
    marketScore: 90,
    fitScore: 94,
    horizon: '2027–2028',
    consumerNeed: 'The concentrated/solid laundry format segment is the fastest-growing format in fabric cleaning, driven by a triple convergence: EU PPWR packaging regulation mandating 15% packaging reduction by 2030, consumer demand for plastic-free alternatives (42% surge per Euromonitor), and the logistics/sustainability advantage of 95% reduction in shipping volume. Current market leaders — Earth Breeze, Tru Earth, Blueland — are DTC insurgents with limited retail distribution. P&G and Unilever have been slow to respond at scale. This represents a first-mover opportunity for any mainstream laundry brand to bring mass-market scale, R&D superiority in bio-chemistry, and trusted efficacy positioning to a format segment that currently lacks a premium mainstream player.',
    techSpecs: [
      { title: 'Biodegradable Matrix', description: 'FSC-certified cellulose substrate that dissolves in under 30 seconds at any temperature. Zero microplastic residue. Marine-biodegradable.', icon: 'eco' },
      { title: 'Enzyme Technology', description: 'Quad-action bio-enzyme system: protease (protein stains), lipase (grease), amylase (starch), cellulase (pilling/fabric refresh). Optimized for cold-water cycles (20 degrees C).', icon: 'biotech' },
      { title: 'Ultra-Compact Format', description: '50-sheet pack replaces 2L liquid bottle. 95% reduction in shipping volume, 85% reduction in packaging weight. Compatible with front-load and top-load machines.', icon: 'inventory_2' },
      { title: 'Zero-Water Formula', description: 'Anhydrous delivery eliminates preservative requirements. Extended 24-month shelf life. No sulfates, no phosphates, no optical brighteners in \'Pure\' variant.', icon: 'water_drop' },
    ],
    portfolioFit: 'Best deployed under a premium laundry power brand with strong efficacy trust. Requires strong enzyme R&D capability and cold-water formulation expertise. Price positioning: Premium (price-per-wash at parity with liquid/caps premium, 30% premium vs. DTC sheet brands). Channel: Mass retail, e-commerce, subscription DTC. Regional variants: Premium sub-line for EU markets, value-tier follower for US/EM 12 months later.',
    evaluation: [
      { label: 'Market Potential', score: 90, rating: 'EXCEPTIONAL' },
      { label: 'Consumer Sentiment', score: 92, rating: 'EXCEPTIONAL' },
      { label: 'Strategic Fit', score: 94, rating: 'EXCEPTIONAL' },
    ],
    regionalReadiness: [
      { region: 'Europe', readiness: 'OPTIMAL' },
      { region: 'North America', readiness: 'HIGH' },
      { region: 'High Growth', readiness: 'MEDIUM' },
      { region: 'Asia', readiness: 'MEDIUM' },
    ],
    trendConnections: [
      { code: 'T-03', name: 'Concentrated and Solid Formats Innovation', direction: 'Expansion', rationale: 'Core format innovation trend' },
      { code: 'T-02', name: 'Bio-Based and Green Chemistry Alternatives', direction: 'Expansion', rationale: 'Enzyme technology platform' },
      { code: 'G-04', name: 'EU PPWR — Packaging and Packaging Waste Regulation', direction: 'Contraction', rationale: 'Regulatory tailwind — sheets pre-comply with 2030 mandates' },
      { code: 'E-02', name: 'Water Scarcity Drives Low-Water Formulations', direction: 'Expansion', rationale: 'Anhydrous format reduces water footprint' },
      { code: 'C-13', name: 'Refill and Reuse Economy in Household Care', direction: 'Expansion', rationale: 'Plastic-free aligns with circular economy demand' },
      { code: 'G-05', name: 'EU Green Claims Directive', direction: 'Contraction', rationale: 'Substantiable environmental claims (vs. greenwashing risk)' },
    ],
    sources: [
      { title: 'Euromonitor International — Concentrated Laundry Formats Forecast 2025-2030', url: 'https://www.euromonitor.com/home-care', tier: 'A' },
      { title: 'EU PPWR — Packaging & Packaging Waste Regulation (2024/3012)', url: 'https://eur-lex.europa.eu/eli/reg/2024/3012/oj', tier: 'A-' },
      { title: 'Novozymes — Cold-Water Enzyme Performance Study', url: 'https://www.novonesis.com/en/solutions/household-care', tier: 'B+' },
      { title: 'PRISM Trend Database: T-03, T-02, G-04, E-02', url: '#prism-trends', tier: 'B+' },
    ],
    consumerJourneyStages: ['Awareness', 'Trial', 'Purchase', 'Usage', 'Advocacy'],
    imageGradient: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
    imageAccent: '#059669',
  },
  {
    id: 'inn_04',
    number: 4,
    name: 'Premium Fabric Refresh Ecosystem',
    subtitle: 'A premium fabric refresh system addressing the most critical LHC white spot — the between-wash occasion dominated by a single $1B+ incumbent.',
    category: 'LHC: FCA / FFI (Between-Wash)',
    categoryShort: 'FCA',
    categoryGroup: 'LHC',
    type: 'WHITE_SPOT',
    typeLabel: 'White Spot',
    tierLevel: 1,
    marketScore: 95,
    fitScore: 92,
    horizon: '2027',
    consumerNeed: 'The between-wash fabric care occasion represents one of the largest untapped profit pools in household care. P&G\'s Febreze generates over $1B in annual revenue with minimal competition. Most mainstream LHC portfolios have zero brand presence in this space — it is consistently identified as the #1 white spot. Consumer behavior data shows that 67% of garments worn between washes receive no treatment, and 78% of consumers express interest in \'refresh without rewash\' solutions. The trend convergence is powerful: C-14 (Between-Wash Fabric Care as Standalone Occasion), C-09 (Fragrance Premiumization in Home Care), and E-08 (Textile Longevity) all point toward a premium, multi-format fabric refresh ecosystem.',
    techSpecs: [
      { title: 'Odor Neutralization', description: 'Cyclodextrin-based molecular trapping technology (superior to masking). Eliminates cooking, smoke, and body odor molecules at the structural level.', icon: 'air' },
      { title: 'Premium Fragrance', description: '3-tier fragrance architecture: Fresh (citrus/aquatic), Luxe (amber/sandalwood/oud), Garden (botanical/floral). Fine-fragrance grade ingredients from major fragrance house partnership.', icon: 'spa' },
      { title: 'Multi-Format System', description: 'Fabric Refresh Mist (trigger spray, 500ml) > Travel Mini (100ml, on-the-go) > Wardrobe Sachets (closet freshening) > Steam Refresh Pods (compatible with garment steamers).', icon: 'category' },
      { title: 'Textile Care Additives', description: 'Anti-static, anti-wrinkle, and fiber-smoothing agents extend garment life between washes. UV protectant variant for outdoor/activewear.', icon: 'checkroom' },
    ],
    portfolioFit: 'Ideal extension for an existing fabric softener/conditioner brand with fragrance equity. Extends brand positioning from \'in-the-wash softener\' to \'between-wash fabric care\'. Price positioning: Premium (60% price premium vs. Febreze on per-use basis — justified by fine-fragrance quality and textile care benefits). Channel: Mass retail, pharmacy beauty sections, online DTC. Gift sets for premium occasions.',
    evaluation: [
      { label: 'Market Potential', score: 95, rating: 'EXCEPTIONAL' },
      { label: 'Consumer Sentiment', score: 90, rating: 'EXCEPTIONAL' },
      { label: 'Strategic Fit', score: 92, rating: 'EXCEPTIONAL' },
    ],
    regionalReadiness: [
      { region: 'Europe', readiness: 'OPTIMAL' },
      { region: 'North America', readiness: 'OPTIMAL' },
      { region: 'High Growth', readiness: 'MEDIUM' },
      { region: 'Asia', readiness: 'HIGH' },
    ],
    trendConnections: [
      { code: 'C-14', name: 'Between-Wash Fabric Care as Standalone Occasion', direction: 'Expansion', rationale: 'Direct white spot fill — #1 priority' },
      { code: 'C-09', name: 'Fragrance and Sensory Premiumization in Home Care', direction: 'Expansion', rationale: 'Premium fragrance justifies price architecture' },
      { code: 'E-08', name: 'Textile Longevity and Garment Life Extension', direction: 'Expansion', rationale: 'Extends garment life = sustainability narrative' },
      { code: 'C-03', name: 'Premiumization Acceleration', direction: 'Expansion', rationale: 'Premium positioning in commoditizing category' },
      { code: 'G-05', name: 'EU Green Claims Directive', direction: 'Contraction', rationale: 'Textile longevity claims must be substantiated' },
    ],
    sources: [
      { title: 'P&G Annual Report FY2025 — Fabric & Home Care Segment', url: 'https://www.pginvestor.com/financial-reporting/annual-reports', tier: 'A-' },
      { title: 'Euromonitor — Air Care and Fabric Freshener Market 2025', url: 'https://www.euromonitor.com/home-care', tier: 'A' },
      { title: 'NielsenIQ — Between-Wash Consumer Behavior Panel', url: 'https://nielseniq.com/global/en/insights/', tier: 'A' },
      { title: 'PRISM Trend Database: C-14, C-09, E-08', url: '#prism-trends', tier: 'B+' },
    ],
    consumerJourneyStages: ['Between Washes', 'Wearing', 'Taking Out', 'Sorting'],
    imageGradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    imageAccent: '#6366f1',
  },
  {
    id: 'inn_05',
    number: 5,
    name: 'Smart Auto-Dosing Laundry Cartridge System',
    subtitle: 'A closed-loop auto-dosing ecosystem partnering with leading appliance manufacturers to own the \'Select Wash Settings\' and \'Add Products\' journey stages in the smart home era.',
    category: 'LHC: FCN / LAD (Smart Laundry)',
    categoryShort: 'FCN',
    categoryGroup: 'LHC',
    type: 'TRANSFORMATIONAL',
    typeLabel: 'Transformational',
    tierLevel: 1,
    marketScore: 85,
    fitScore: 90,
    horizon: '2028–2030',
    consumerNeed: 'Connected washing machines with auto-dosing capabilities are projected to reach 35% penetration in premium European households by 2030. Samsung, LG, Bosch, and Miele are all shipping machines with proprietary cartridge systems — and the first detergent brand to establish a standard wins the recurring revenue lock-in. The strategic threat is existential: if appliance manufacturers own the dosing decision, the detergent brand becomes invisible, commoditized, and auto-reordered by algorithm. This concept inverts the threat by making a detergent brand the preferred cartridge partner across multiple appliance platforms — the \'Nespresso of laundry\'.',
    techSpecs: [
      { title: 'Universal Cartridge', description: 'Standardized cartridge design compatible with major auto-dose platforms via adapter rings. NFC chip for machine recognition and dosing optimization.', icon: 'precision_manufacturing' },
      { title: 'Smart Formulation', description: 'Three-compartment cartridge: main detergent (concentrated gel), enzyme booster (activated by temperature sensor), fabric conditioner (optional). Auto-adjusts dose based on load weight, soil level, and water hardness.', icon: 'tune' },
      { title: 'Connected App', description: 'Usage tracking, reorder alerts, sustainability dashboard (water/energy savings per load), wash history with stain-specific recommendations.', icon: 'phone_iphone' },
      { title: 'Subscription Model', description: 'Monthly cartridge delivery subscription. 3/6/12-month plans. Smart reorder triggered by cartridge fill sensor. Loyalty program integration.', icon: 'autorenew' },
    ],
    portfolioFit: 'Requires a premium laundry power brand — premium positioning makes it natural for connected-appliance owners who skew affluent. Value brands follow later as the technology diffuses to mid-range appliances. Price positioning: Super-premium (30-40% above standard on cost-per-wash, offset by zero-waste precision dosing and convenience premium). Partnership model: Revenue share with appliance OEMs (10-15% of cartridge revenue for integration). Channel: Appliance retailer bundling, brand DTC, Amazon Subscribe & Save.',
    evaluation: [
      { label: 'Market Potential', score: 85, rating: 'HIGH' },
      { label: 'Consumer Sentiment', score: 78, rating: 'STRONG' },
      { label: 'Strategic Fit', score: 90, rating: 'EXCEPTIONAL' },
    ],
    regionalReadiness: [
      { region: 'Europe', readiness: 'OPTIMAL' },
      { region: 'North America', readiness: 'MEDIUM' },
      { region: 'High Growth', readiness: 'MEDIUM' },
      { region: 'Asia', readiness: 'HIGH' },
    ],
    trendConnections: [
      { code: 'T-08', name: 'Connected Appliances and Auto-Dosing Transform Detergent Economics', direction: 'Expansion', rationale: 'Core trend — existential for laundry P&L' },
      { code: 'T-01', name: 'AI-Driven Formulation and Speed-to-Market', direction: 'Expansion', rationale: 'AI dosing optimization per load' },
      { code: 'K-06', name: 'FMCG Subscription and Loyalty Ecosystem Lock-in', direction: 'Contraction', rationale: 'Turns subscription threat into brand advantage' },
      { code: 'T-05', name: 'Manufacturing Automation and Industry 4.0', direction: 'Expansion', rationale: 'Smart manufacturing enables precision cartridge filling' },
      { code: 'C-03', name: 'Premiumization Acceleration', direction: 'Expansion', rationale: 'Premium tech ecosystem justifies price premium' },
    ],
    sources: [
      { title: 'Strategy Analytics — Connected Appliance Penetration Forecast 2025-2030', url: 'https://www.strategyanalytics.com/access-services/devices/connected-home-devices', tier: 'A' },
      { title: 'BCG — The Smart Home FMCG Revenue Model', url: 'https://www.bcg.com/industries/consumer-products', tier: 'A' },
      { title: 'Miele / Bosch Auto-Dose Technology Partnership Briefings', url: 'https://www.miele.com/en/m/auto-dosing-10395.htm', tier: 'B+' },
      { title: 'PRISM Trend Database: T-08, T-01, K-06', url: '#prism-trends', tier: 'B+' },
    ],
    consumerJourneyStages: ['Select Wash Settings', 'Add Products', 'Usage', 'Reorder'],
    imageGradient: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
    imageAccent: '#0284c7',
  },
  {
    id: 'inn_06',
    number: 6,
    name: 'Garment Lifetime Protection Platform',
    subtitle: 'Evolving a specialist detergent brand into a full garment longevity ecosystem — from wash to wardrobe — anchored in the textile sustainability mega-trend.',
    category: 'LHC: FCA (Fabric Care Specialist)',
    categoryShort: 'FCA',
    categoryGroup: 'LHC',
    type: 'BRAND_EXTENSION',
    typeLabel: 'Brand Extension',
    tierLevel: 1,
    marketScore: 82,
    fitScore: 96,
    horizon: '2027–2028',
    consumerNeed: 'The average European consumer discards 11kg of textiles annually. The EU Strategy for Sustainable Textiles (2022) and consumer awareness of fashion waste are converging to create a \'garment longevity\' category that barely exists today. Any brand already positioned for \'gentle fabric care\' has a natural extension path — but currently stops at the washing machine door. The opportunity is to extend into a full garment lifecycle platform: Pre-Wash Protection (fabric shields before first wear) > Specialized Washing (existing core) > Post-Wash Care (de-pilling, fiber repair) > Storage Protection (anti-moth, shape preservation) > Refresh & Extend (between-wash care for delicates). This transforms a EUR 5/bottle detergent into a EUR 25-40 garment care system with 5x the spend-per-consumer.',
    techSpecs: [
      { title: 'Fiber Repair Technology', description: 'Keratin and cellulose micro-patch technology that fills damaged fiber surfaces during the wash cycle. Measurably reduces pilling by 60% after 10 washes.', icon: 'healing' },
      { title: 'Color Shield Complex', description: 'UV-absorbing polymer coating applied during wash. Extends color vibrancy by 40% vs. standard detergent. Specific formulas for darks, colors, and whites.', icon: 'palette' },
      { title: 'Shape Memory Agents', description: 'Elastic fiber restoration complex for knitwear and activewear. Restores garment shape post-wash by re-crosslinking stretched elastic fibers.', icon: 'straighten' },
      { title: 'Garment Care Kit', description: 'Physical toolkit: de-pilling comb, cashmere brush, garment storage bags with cedar/lavender inserts, travel-size refresh spray. Premium unboxing experience.', icon: 'inventory' },
    ],
    portfolioFit: 'Ideal for an existing fabric care specialist brand already positioned for gentle/delicate washing. Extension from \'gentle wash\' to \'garment lifetime partner\'. Sub-lines: Renew (fiber repair), Shield (protection), Closet (storage care). Price positioning: Premium system (EUR 25-40 for full kit). Individual products at existing premium price index. Channel: Selective retail, pharmacy, online DTC, fashion retailer partnerships. Sustainability angle: Every garment life extension by 9 months reduces its carbon footprint by 20-30% (WRAP data).',
    evaluation: [
      { label: 'Market Potential', score: 82, rating: 'HIGH' },
      { label: 'Consumer Sentiment', score: 86, rating: 'HIGH' },
      { label: 'Strategic Fit', score: 96, rating: 'EXCEPTIONAL' },
    ],
    regionalReadiness: [
      { region: 'Europe', readiness: 'OPTIMAL' },
      { region: 'North America', readiness: 'MEDIUM' },
      { region: 'High Growth', readiness: 'HIGH' },
      { region: 'Asia', readiness: 'MEDIUM' },
    ],
    trendConnections: [
      { code: 'E-08', name: 'Textile Longevity and Garment Life Extension Economy', direction: 'Expansion', rationale: 'Core positioning — garment longevity' },
      { code: 'C-04', name: 'Conscious Consumption and Cleanical Beauty', direction: 'Expansion', rationale: 'Mindful consumption drives willingness to invest in garment care' },
      { code: 'G-04', name: 'EU PPWR — Packaging Regulation', direction: 'Contraction', rationale: 'Refill pouches pre-comply' },
      { code: 'G-05', name: 'EU Green Claims Directive', direction: 'Contraction', rationale: 'Substantiated longevity claims backed by clinical garment testing' },
      { code: 'C-13', name: 'Refill and Reuse Economy', direction: 'Expansion', rationale: 'Refill station compatibility for concentrates' },
    ],
    sources: [
      { title: 'WRAP — Valuing Our Clothes: The Cost of UK Fashion', url: 'https://www.wrap.ngo/resources/report/valuing-our-clothes-cost-uk-fashion', tier: 'A' },
      { title: 'EU Strategy for Sustainable and Circular Textiles', url: 'https://environment.ec.europa.eu/strategy/textiles-strategy_en', tier: 'A-' },
      { title: 'Ellen MacArthur Foundation — A New Textiles Economy', url: 'https://www.ellenmacarthurfoundation.org/a-new-textiles-economy', tier: 'A' },
      { title: 'PRISM Trend Database: E-08, C-04, G-04', url: '#prism-trends', tier: 'B+' },
    ],
    consumerJourneyStages: ['Pre-Wash', 'Washing', 'Post-Wash', 'Storage', 'Between Washes'],
    imageGradient: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
    imageAccent: '#0d9488',
  },
  {
    id: 'inn_07',
    number: 7,
    name: 'Premium Men\'s Grooming Ecosystem',
    subtitle: 'A premium men\'s grooming ecosystem filling the gap between mass (Axe/Old Spice) and prestige (Aesop/Byredo) in a structurally growing $115B global market.',
    category: 'Hair: Styling + Body',
    categoryShort: 'Styling',
    categoryGroup: 'Hair',
    type: 'WHITE_SPOT',
    typeLabel: 'White Spot',
    tierLevel: 2,
    marketScore: 80,
    fitScore: 78,
    horizon: '2027–2028',
    consumerNeed: 'The global men\'s grooming market is projected to reach $115B by 2030 (CAGR 6.5%). Most major FMCG hair portfolios lack a dedicated men\'s grooming master brand — one of the most significant portfolio gaps given structural growth. The opportunity is to create a premium men\'s line spanning hair styling, hair care, beard care, and body wash — that bridges the gap between mass (Axe/Old Spice) and prestige (Aesop/Byredo). Target: 25-45 year-old men who have outgrown youth brands but find prestige inaccessible. Youth-oriented styling brands with male equity are the ideal launchpad — extending from \'styling product for young men\' to \'grooming ecosystem for adult men\'.',
    techSpecs: [
      { title: 'Hair Styling Range', description: '5-product core: Matte Clay, Texture Paste, Slick Pomade, Sea Salt Spray, Invisible Hold Spray. All water-soluble, no flaking, humidity-resistant.', icon: 'brush' },
      { title: 'Hair + Scalp Care', description: '2-in-1 Thickening Shampoo + Conditioner, Caffeine Scalp Tonic, Charcoal Detox Scrub. Cross-sells with scalp care system for thinning concerns.', icon: 'spa' },
      { title: 'Beard & Face', description: 'Beard Oil, Beard Balm, Face + Beard Wash. Clean formulation, subtle masculine fragrance (cedarwood/vetiver).', icon: 'face' },
      { title: 'Body Care', description: 'Body Wash (3 fragrance variants), Antiperspirant (aluminum-free option), Post-Workout Refresh Spray.', icon: 'fitness_center' },
    ],
    portfolioFit: 'Requires a brand with existing male consumer equity — ideally youth-styling heritage that can be \'elevated\' for adult men. Sub-brand creates premium tier while retaining creative edge. Design language: Matte black packaging, minimalist typography, magazine-editorial aesthetic. Price positioning: Masstige (premium mass, price index 140-170 vs. standard male grooming). Below Aesop, above Old Spice. Channel: Drugstore premium shelves, e-commerce, TikTok Shop. US-first launch (largest male grooming market) with EU rollout in year 2.',
    evaluation: [
      { label: 'Market Potential', score: 80, rating: 'HIGH' },
      { label: 'Consumer Sentiment', score: 82, rating: 'HIGH' },
      { label: 'Strategic Fit', score: 78, rating: 'STRONG' },
    ],
    regionalReadiness: [
      { region: 'Europe', readiness: 'HIGH' },
      { region: 'North America', readiness: 'OPTIMAL' },
      { region: 'High Growth', readiness: 'MEDIUM' },
      { region: 'Asia', readiness: 'MEDIUM' },
    ],
    trendConnections: [
      { code: 'C-08', name: 'Male Grooming Structural Growth', direction: 'Expansion', rationale: 'Direct white spot response' },
      { code: 'C-03', name: 'Premiumization Acceleration in Hair Care', direction: 'Expansion', rationale: 'Masstige positioning in growing premium segment' },
      { code: 'K-04', name: 'Social Commerce and TikTok Shop', direction: 'Expansion', rationale: 'TikTok-native marketing for male grooming discovery' },
      { code: 'C-11', name: 'Gen Z Dupe Culture and Ingredient Literacy', direction: 'Contraction', rationale: 'Transparent ingredient lists, clinical claims to counter dupe risk' },
      { code: 'T-10', name: 'Generative AI Marketing Efficiency', direction: 'Expansion', rationale: 'AI-generated content for rapid social media iteration' },
    ],
    sources: [
      { title: "Allied Market Research — Men's Grooming Market Outlook 2025-2030", url: 'https://www.alliedmarketresearch.com/men-personal-care-market', tier: 'A' },
      { title: "Circana (NPD) — US Prestige Men's Grooming Trends Q4 2025", url: 'https://www.circana.com/industry-expertise/beauty/', tier: 'A' },
      { title: 'Euromonitor — Global Men\'s Grooming Category Deep Dive', url: 'https://www.euromonitor.com/mens-grooming', tier: 'A' },
      { title: 'PRISM Trend Database: C-08, C-03, K-04', url: '#prism-trends', tier: 'B+' },
    ],
    consumerJourneyStages: ['Discovery', 'Trial', 'Daily Routine', 'Repurchase', 'Advocacy'],
    imageGradient: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
    imageAccent: '#475569',
  },
  {
    id: 'inn_08',
    number: 8,
    name: 'AI-Personalized Home Hair Color Platform',
    subtitle: 'An AI-powered hair color customization platform that delivers salon-grade personalized shades to consumers at home — the \'Prose for hair color\'.',
    category: 'Hair: Color',
    categoryShort: 'Color',
    categoryGroup: 'Hair',
    type: 'TRANSFORMATIONAL',
    typeLabel: 'Transformational',
    tierLevel: 1,
    marketScore: 88,
    fitScore: 92,
    horizon: '2028–2030',
    consumerNeed: 'Home hair color faces structural pressure: professional salon crossover (K-07), Gen Z preference for salon visits, and DTC disruption (Madison Reed, eSalon) are eroding the traditional \'one-shade-fits-all\' box model. This concept uses AI-driven shade matching (smartphone camera analysis of current hair color, skin tone, eye color, and desired result) to create a custom-blended color formula delivered to the consumer\'s door. This transforms hair color from a guesswork-prone, anxiety-inducing purchase into a confidence-backed, personalized experience.',
    techSpecs: [
      { title: 'AI Shade Matching', description: 'Computer vision model trained on 500K+ salon color outcomes. Analyzes 14 variables: base color, gray percentage, undertones, skin tone, eye color, lifestyle exposure (sun, chlorine).', icon: 'visibility' },
      { title: 'Custom Blending', description: 'Micro-batch blending at regional fulfillment centers. 2,000+ possible shade combinations vs. 40-60 shades in traditional retail. Ships within 72 hours.', icon: 'blender' },
      { title: 'Bond Protection Built-In', description: 'Every formula includes professional bond-protecting technology. Reduces hair damage by 94% vs. standard box color.', icon: 'shield' },
      { title: 'AR Try-On', description: 'Real-time augmented reality shade preview via app before ordering. Virtual try-on of custom shade plus 50 trending styles.', icon: 'view_in_ar' },
    ],
    portfolioFit: 'Requires a brand with genuine professional colorist heritage — a salon shade library and color analysis technology are non-negotiable assets. DTC sub-brand positioning: intelligent, personalized, premium. Price positioning: Super-premium DTC (EUR 25-35 per application vs. EUR 8-12 for box color). Subscription for regular touch-ups. Channel: Pure DTC. No retail — digital-native product. Salon referral partnerships.',
    evaluation: [
      { label: 'Market Potential', score: 88, rating: 'HIGH' },
      { label: 'Consumer Sentiment', score: 84, rating: 'HIGH' },
      { label: 'Strategic Fit', score: 92, rating: 'EXCEPTIONAL' },
    ],
    regionalReadiness: [
      { region: 'Europe', readiness: 'HIGH' },
      { region: 'North America', readiness: 'OPTIMAL' },
      { region: 'High Growth', readiness: 'MEDIUM' },
      { region: 'Asia', readiness: 'HIGH' },
    ],
    trendConnections: [
      { code: 'T-07', name: 'AI-Powered Personalization at Scale', direction: 'Expansion', rationale: 'Core innovation platform — AI is the product' },
      { code: 'T-01', name: 'AI-Driven Formulation and Speed-to-Market', direction: 'Expansion', rationale: 'AI formulation of custom shade blends' },
      { code: 'K-07', name: 'Professional Salon Channel to Consumer Crossover', direction: 'Expansion', rationale: 'Professional tech in consumer hands' },
      { code: 'X-04', name: 'DTC and Indie Brand Disruption in Hair', direction: 'Contraction', rationale: 'Beats DTC brands at their own game' },
      { code: 'T-09', name: 'Generative AI Disrupts Product Discovery', direction: 'Contraction', rationale: 'AI-native discovery model bypasses traditional shelf' },
    ],
    sources: [
      { title: "L'Oréal Perso Technology — Annual Investor Briefing", url: 'https://www.loreal-finance.com/en/annual-report-2024', tier: 'A-' },
      { title: 'Madison Reed / eSalon DTC Color Model Analysis', url: 'https://www.madison-reed.com/', tier: 'B' },
      { title: 'Mintel — AI Personalization in Beauty 2025', url: 'https://www.mintel.com/beauty-and-personal-care-market-research/', tier: 'A' },
      { title: 'PRISM Trend Database: T-07, T-01, K-07, X-04', url: '#prism-trends', tier: 'B+' },
    ],
    consumerJourneyStages: ['Discovery', 'AI Consultation', 'Custom Order', 'Application', 'Maintenance'],
    imageGradient: 'linear-gradient(135deg, #db2777 0%, #9333ea 100%)',
    imageAccent: '#db2777',
  },
  {
    id: 'inn_09',
    number: 9,
    name: 'PFAS-Free Premium Dish Care System',
    subtitle: 'A regulatory-proactive premium dish care system eliminating PFAS and harmful surfactants ahead of 2027 EU restrictions — turning compliance into competitive advantage.',
    category: 'LHC: ADW / HDW (Dish Care)',
    categoryShort: 'ADW',
    categoryGroup: 'LHC',
    type: 'REGULATORY_PROACTIVE',
    typeLabel: 'Regulatory Proactive',
    tierLevel: 1,
    marketScore: 86,
    fitScore: 94,
    horizon: '2027',
    consumerNeed: 'EU PFAS restriction (expected 2027) will force reformulation across the dish care category. Proactive brands that launch PFAS-free, plant-based surfactant formulations before regulation takes effect gain first-mover advantage in consumer trust. The dish care category is ripe for premiumization — consumers are willing to pay more for clean, skin-safe formulations especially in hand dish wash where skin contact is direct.',
    techSpecs: [
      { title: 'Plant-Based Surfactants', description: 'APG (Alkyl Polyglucoside) surfactant system derived from coconut and corn glucose. Equal degreasing power to conventional sulfate systems. Skin-friendly pH 5.5.', icon: 'eco' },
      { title: 'PFAS-Free Rinse Aid', description: 'Bio-based rinse aid using modified sugar esters for spot-free drying. Zero fluorinated compounds. Compatible with all automatic dishwasher brands.', icon: 'water_drop' },
      { title: 'Concentrated Tabs', description: 'Single-dose wrapped tabs with water-soluble film (PVA-free alternative). 3-chamber system: detergent, rinse aid, glass protection.', icon: 'science' },
      { title: 'Dermatological Certification', description: 'Hand dish wash variants certified by dermatological institutes. Hypoallergenic, fragrance-free option for sensitive skin.', icon: 'verified' },
    ],
    portfolioFit: 'Best deployed under an existing premium dish care brand. First-mover advantage in regulatory compliance creates trust barrier for followers. Price positioning: Premium (15-25% above standard). Messaging: "Clean for your dishes, clean for the planet, clean for you." Channel: Mass retail premium shelf, pharmacy, online.',
    evaluation: [
      { label: 'Market Potential', score: 86, rating: 'HIGH' },
      { label: 'Consumer Sentiment', score: 82, rating: 'HIGH' },
      { label: 'Strategic Fit', score: 94, rating: 'EXCEPTIONAL' },
    ],
    regionalReadiness: [
      { region: 'Europe', readiness: 'OPTIMAL' },
      { region: 'North America', readiness: 'HIGH' },
      { region: 'High Growth', readiness: 'MEDIUM' },
      { region: 'Asia', readiness: 'MEDIUM' },
    ],
    trendConnections: [
      { code: 'G-03', name: 'EU Cosmetics & Chemical Regulation', direction: 'Contraction', rationale: 'Regulatory first-mover advantage' },
      { code: 'E-02', name: 'Water Scarcity and Clean Formulations', direction: 'Expansion', rationale: 'Clean water-safe formulations' },
      { code: 'C-04', name: 'Conscious Consumption', direction: 'Expansion', rationale: 'Consumer demand for transparency' },
      { code: 'T-02', name: 'Bio-Based Chemistry', direction: 'Expansion', rationale: 'Plant-based surfactant technology' },
    ],
    sources: [
      { title: 'ECHA — Universal PFAS Restriction Proposal Dossier', url: 'https://echa.europa.eu/registry-of-restriction-intentions/-/dislist/details/0b0236e18663449b', tier: 'A-' },
      { title: 'Euromonitor — Dish Care Premium Segment Forecast 2025-2030', url: 'https://www.euromonitor.com/dishwashing', tier: 'A' },
      { title: 'BASF / Clariant — Plant-Based Surfactant Benchmarking', url: 'https://www.basf.com/global/en/who-we-are/sustainability/we-source-responsibly/renewable-raw-materials.html', tier: 'B+' },
      { title: 'PRISM Trend Database: G-03, E-02, C-04', url: '#prism-trends', tier: 'B+' },
    ],
    consumerJourneyStages: ['Awareness', 'Trust Building', 'Purchase', 'Usage', 'Advocacy'],
    imageGradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    imageAccent: '#2563eb',
  },
  {
    id: 'inn_10',
    number: 10,
    name: 'Biotech-Powered Hair Repair System',
    subtitle: 'Next-generation hair repair powered by biotech-engineered proteins — translating professional bond repair science into an affordable daily care system.',
    category: 'Hair: Care',
    categoryShort: 'Care',
    categoryGroup: 'Hair',
    type: 'CORE_INNOVATION',
    typeLabel: 'Core Innovation',
    tierLevel: 1,
    marketScore: 84,
    fitScore: 92,
    horizon: '2027–2028',
    consumerNeed: 'The bond repair revolution (Olaplex) has created a $2B+ market but pricing remains premium-professional. 72% of consumers want bond repair benefits at accessible price points. The opportunity is to democratize professional-grade repair technology through biotech-engineered keratin peptides that work within standard wash routines — no salon step required.',
    techSpecs: [
      { title: 'Biotech Keratin', description: 'Recombinant keratin peptides produced via precision fermentation. Identical to human hair keratin. Penetrates cortex layer vs. surface-only coating of conventional treatments.', icon: 'biotech' },
      { title: 'Smart Repair System', description: '3-step daily system: Repair Shampoo > Rebuild Mask (2-minute, not overnight) > Seal Serum. Professional-grade results in consumer-friendly format.', icon: 'build' },
      { title: 'Damage Detection', description: 'Color-changing strand test included in packaging. Shows damage level before and after treatment — visual proof of efficacy drives repurchase.', icon: 'colorize' },
      { title: 'Heat Protection', description: 'Integrated thermal protection up to 230°C in the Seal Serum. Eliminates need for separate heat protectant product.', icon: 'thermostat' },
    ],
    portfolioFit: 'Core innovation for an existing hair care brand with repair/strength positioning. Positions the brand as the mass-market alternative to Olaplex. Price positioning: Premium mass (EUR 8-15 per product). Channel: Mass retail, drugstore, Amazon. Key advantage: Olaplex stumble (2023-2024 brand challenges) creates timing window.',
    evaluation: [
      { label: 'Market Potential', score: 84, rating: 'HIGH' },
      { label: 'Consumer Sentiment', score: 88, rating: 'HIGH' },
      { label: 'Strategic Fit', score: 92, rating: 'EXCEPTIONAL' },
    ],
    regionalReadiness: [
      { region: 'Europe', readiness: 'OPTIMAL' },
      { region: 'North America', readiness: 'HIGH' },
      { region: 'High Growth', readiness: 'MEDIUM' },
      { region: 'Asia', readiness: 'HIGH' },
    ],
    trendConnections: [
      { code: 'T-04', name: 'Microbiome and Biotech Science for Hair', direction: 'Expansion', rationale: 'Biotech protein platform' },
      { code: 'K-07', name: 'Professional to Consumer Crossover', direction: 'Expansion', rationale: 'Democratizing salon technology' },
      { code: 'C-03', name: 'Premiumization in Hair Care', direction: 'Expansion', rationale: 'Premium positioning with mass accessibility' },
      { code: 'T-01', name: 'AI-Driven Formulation', direction: 'Expansion', rationale: 'Precision fermentation optimization' },
    ],
    sources: [
      { title: 'Olaplex Holdings — Q4 2025 Investor Presentation', url: 'https://ir.olaplex.com/financial-information/annual-reports', tier: 'A-' },
      { title: 'Good Food Institute — Precision Fermentation Cost Curves 2025', url: 'https://gfi.org/science/the-science-of-fermentation/', tier: 'A' },
      { title: 'Mintel — Bond Repair Consumer Willingness-to-Pay', url: 'https://www.mintel.com/beauty-and-personal-care-market-research/', tier: 'A' },
      { title: 'PRISM Trend Database: T-04, K-07, C-03', url: '#prism-trends', tier: 'B+' },
    ],
    consumerJourneyStages: ['Problem Awareness', 'Solution Discovery', 'Trial', 'Daily Routine', 'Repurchase'],
    imageGradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    imageAccent: '#f59e0b',
  },
  {
    id: 'inn_11',
    number: 11,
    name: 'Climate-Adaptive Insect Defense System',
    subtitle: 'A climate-responsive insect control platform expanding the category beyond seasonal pest control into year-round home protection — powered by changing insect migration patterns.',
    category: 'LHC: IC (Insect Control)',
    categoryShort: 'IC',
    categoryGroup: 'LHC',
    type: 'CATEGORY_EXPANSION',
    typeLabel: 'Category Expansion',
    tierLevel: 1,
    marketScore: 72,
    fitScore: 80,
    horizon: '2028–2030',
    consumerNeed: 'Climate change is fundamentally reshaping insect populations in Europe and North America. Previously seasonal pests (mosquitoes, ticks, wasps) are now active 2-3 months longer. Tropical species (tiger mosquitoes, Asian hornets) are establishing in Southern Europe. The insect control category has not adapted — still marketed as seasonal, still using the same active ingredients, still positioned as reactive. This concept creates a year-round, climate-adaptive insect defense system that evolves with changing pest patterns.',
    techSpecs: [
      { title: 'Climate-Responsive Formulas', description: 'Regional formulations calibrated to local pest profiles. Updated annually based on entomological monitoring data. QR-code links to regional pest forecasts.', icon: 'thermostat_auto' },
      { title: 'Multi-Vector Defense', description: 'Indoor barrier spray + outdoor perimeter treatment + personal repellent + trap system. Integrated ecosystem approach vs. single-product reactivity.', icon: 'security' },
      { title: 'Bio-Active Ingredients', description: 'Geraniol and PMD (p-Menthane-3,8-diol) based formulations. DEET-free, safe for children and pets. EU Biocidal Products Regulation compliant.', icon: 'eco' },
      { title: 'Smart Monitoring', description: 'Connected UV trap with insect identification camera. App alerts for peak activity periods. Community pest mapping for neighborhood awareness.', icon: 'sensors' },
    ],
    portfolioFit: 'Natural extension for existing insect control brands. Repositions from seasonal category to year-round home protection. Creates premium tier above commodity sprays. Price positioning: System pricing (EUR 30-50 for seasonal kit, EUR 15-20/month subscription for year-round). Channel: Mass retail, garden centers, online DTC.',
    evaluation: [
      { label: 'Market Potential', score: 72, rating: 'STRONG' },
      { label: 'Consumer Sentiment', score: 68, rating: 'MODERATE' },
      { label: 'Strategic Fit', score: 80, rating: 'HIGH' },
    ],
    regionalReadiness: [
      { region: 'Europe', readiness: 'OPTIMAL' },
      { region: 'North America', readiness: 'HIGH' },
      { region: 'High Growth', readiness: 'MEDIUM' },
      { region: 'Asia', readiness: 'MEDIUM' },
    ],
    trendConnections: [
      { code: 'E-01', name: 'Climate Change Reshapes Seasonal Categories', direction: 'Expansion', rationale: 'Core driver — extended pest seasons' },
      { code: 'E-03', name: 'Biodiversity and Ecosystem Awareness', direction: 'Contraction', rationale: 'Must balance pest control with pollinator safety' },
      { code: 'T-07', name: 'AI and IoT Integration', direction: 'Expansion', rationale: 'Smart monitoring enables predictive pest control' },
      { code: 'G-06', name: 'EU Biocidal Products Regulation', direction: 'Contraction', rationale: 'Pre-compliant bio-active formulations' },
    ],
    sources: [
      { title: 'ECDC — Mosquito and Tick Surveillance Reports 2024-2025', url: 'https://www.ecdc.europa.eu/en/disease-vectors/surveillance-and-disease-data', tier: 'S' },
      { title: 'Euromonitor — Home Insecticides Market Post-Climate Shift', url: 'https://www.euromonitor.com/home-care', tier: 'A' },
      { title: 'EU Biocidal Products Regulation (EU 528/2012)', url: 'https://echa.europa.eu/regulations/biocidal-products-regulation', tier: 'A-' },
      { title: 'PRISM Trend Database: E-01, E-03, T-07', url: '#prism-trends', tier: 'B+' },
    ],
    consumerJourneyStages: ['Seasonal Preparation', 'Prevention', 'Active Control', 'Monitoring'],
    imageGradient: 'linear-gradient(135deg, #65a30d 0%, #4d7c0f 100%)',
    imageAccent: '#65a30d',
  },
  {
    id: 'inn_12',
    number: 12,
    name: 'Professional-to-Consumer Bond Repair Technology',
    subtitle: 'Bringing professional-grade bond repair directly to mass-market consumers through a channel crossover strategy — capitalizing on the Olaplex stumble.',
    category: 'Hair: Color + Care',
    categoryShort: 'Color',
    categoryGroup: 'Hair',
    type: 'CHANNEL_CROSSOVER',
    typeLabel: 'Channel Crossover',
    tierLevel: 1,
    marketScore: 90,
    fitScore: 94,
    horizon: '2027',
    consumerNeed: 'Olaplex\'s stumble (2023-2024: declining growth, consumer trust issues, social media backlash) has created a timing window in the $2B+ bond repair market. The professional-to-consumer bridge — where salon credibility meets retail accessibility — is the key strategic battleground. Consumers want salon-grade bond repair but increasingly distrust premium DTC claims. A brand with genuine professional salon heritage can fill this gap with credibility that pure consumer brands cannot replicate.',
    techSpecs: [
      { title: 'Professional Bond Technology', description: 'Bis-aminopropyl diglycol dimaleate and maleic acid complex. Identical active system used in salon treatments, reformulated for home use.', icon: 'science' },
      { title: 'Color Bond Protection', description: 'Integrated bond repair into hair color formulations. Reduces color-induced damage by 90%. Extends color vibrancy by 8+ weeks.', icon: 'palette' },
      { title: 'Salon-at-Home Kit', description: 'Professional application tools included: sectioning clips, precision applicator, timing guide. Replicates salon experience at home.', icon: 'content_cut' },
      { title: 'Professional Endorsement', description: 'Stylist recommendation program. QR code links to video tutorials by professional colorists. Salon-exclusive products drive consumer awareness.', icon: 'star' },
    ],
    portfolioFit: 'Requires a brand with genuine professional salon heritage and an integrated professional color franchise. The salon channel provides credibility that consumer-only brands cannot match. Price positioning: Premium (EUR 15-25 per treatment). Channel: Salon launch first, mass retail 6 months later. Key timing: Olaplex vulnerability creates 12-18 month window.',
    evaluation: [
      { label: 'Market Potential', score: 90, rating: 'EXCEPTIONAL' },
      { label: 'Consumer Sentiment', score: 86, rating: 'HIGH' },
      { label: 'Strategic Fit', score: 94, rating: 'EXCEPTIONAL' },
    ],
    regionalReadiness: [
      { region: 'Europe', readiness: 'OPTIMAL' },
      { region: 'North America', readiness: 'OPTIMAL' },
      { region: 'High Growth', readiness: 'MEDIUM' },
      { region: 'Asia', readiness: 'HIGH' },
    ],
    trendConnections: [
      { code: 'K-07', name: 'Professional Salon to Consumer Crossover', direction: 'Expansion', rationale: 'Core strategy — salon credibility to retail' },
      { code: 'C-03', name: 'Premiumization in Hair Care', direction: 'Expansion', rationale: 'Premium positioning justified by professional tech' },
      { code: 'X-04', name: 'DTC and Indie Brand Disruption', direction: 'Contraction', rationale: 'Professional heritage as competitive moat vs. DTC' },
      { code: 'T-04', name: 'Biotech Science for Hair', direction: 'Expansion', rationale: 'Bond repair technology advancement' },
    ],
    sources: [
      { title: 'Olaplex Holdings Inc. — SEC 10-K Filings 2023-2025', url: 'https://ir.olaplex.com/financial-information/sec-filings', tier: 'A-' },
      { title: 'Kline Group — Professional Hair Care Channel Dynamics', url: 'https://www.klinegroup.com/reports/professional-hair-care-global-services/', tier: 'A' },
      { title: "L'Oréal Professionnel — Salon Channel Outlook 2026", url: 'https://www.loreal-professionnel.com/', tier: 'B+' },
      { title: 'PRISM Trend Database: K-07, C-03, X-04', url: '#prism-trends', tier: 'B+' },
    ],
    consumerJourneyStages: ['Salon Experience', 'Discovery', 'Home Trial', 'Color Routine', 'Repurchase'],
    imageGradient: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
    imageAccent: '#e11d48',
  },
  {
    id: 'inn_13',
    number: 13,
    name: 'Emerging Markets Affordable Innovation System',
    subtitle: 'A purpose-built innovation platform for emerging markets — delivering advanced FMCG technology at local price points through radical format and distribution innovation.',
    category: 'Cross-Category (Hair + LHC)',
    categoryShort: 'Cross',
    categoryGroup: 'Cross-Category',
    type: 'MARKET_EXPANSION',
    typeLabel: 'Market Expansion',
    tierLevel: 1,
    marketScore: 92,
    fitScore: 88,
    horizon: '2027–2029',
    consumerNeed: 'Emerging markets represent 60%+ of global population but receive adapted-down versions of developed-market products rather than purpose-built innovation. The opportunity is to create a cross-category innovation platform designed from the ground up for emerging market constraints: sachet economics, limited water access, high humidity environments, and price-sensitive consumers who still want premium efficacy.',
    techSpecs: [
      { title: 'Sachet-First Design', description: 'Single-use sachets with compostable packaging (PHA bioplastic). Designed for affordability: EUR 0.10-0.30 per use. No format adaptation — designed as sachet from day one.', icon: 'shopping_bag' },
      { title: 'Low-Water Formulations', description: 'Concentrated formulas optimized for low-water environments. Laundry detergent works with 1 bucket of water. Shampoo rinses clean in 1 liter.', icon: 'water_drop' },
      { title: 'Climate-Adapted Products', description: 'Hair care for high humidity (anti-frizz, anti-fungal). Laundry detergent with UV protection for line-drying. Insect repellent integrated into fabric care.', icon: 'wb_sunny' },
      { title: 'Local Distribution', description: 'Partnerships with mobile money platforms for digital-first purchasing. Kiosk-compatible display units. WhatsApp-based reorder system.', icon: 'local_shipping' },
    ],
    portfolioFit: 'Cross-category platform spanning Hair and LHC. Requires dedicated emerging markets innovation team (not adaptation of developed-market products). Manufacturing localization critical for cost structure. Price positioning: Mass-market with premium efficacy. Channel: Traditional trade, kiosks, mobile commerce. Initial markets: India, Nigeria, Indonesia, Brazil.',
    evaluation: [
      { label: 'Market Potential', score: 92, rating: 'EXCEPTIONAL' },
      { label: 'Consumer Sentiment', score: 85, rating: 'HIGH' },
      { label: 'Strategic Fit', score: 88, rating: 'HIGH' },
    ],
    regionalReadiness: [
      { region: 'Europe', readiness: 'MEDIUM' },
      { region: 'North America', readiness: 'MEDIUM' },
      { region: 'High Growth', readiness: 'OPTIMAL' },
      { region: 'Asia', readiness: 'HIGH' },
    ],
    trendConnections: [
      { code: 'C-12', name: 'Emerging Market Middle Class Expansion', direction: 'Expansion', rationale: 'Structural demand growth' },
      { code: 'G-04', name: 'Packaging Regulation (Global)', direction: 'Contraction', rationale: 'Compostable sachets as solution' },
      { code: 'E-02', name: 'Water Scarcity', direction: 'Expansion', rationale: 'Low-water formulations address real constraint' },
      { code: 'T-05', name: 'Manufacturing Innovation', direction: 'Expansion', rationale: 'Local manufacturing enables cost structure' },
    ],
    sources: [
      { title: 'McKinsey — Emerging Market FMCG Growth Corridors 2025-2035', url: 'https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights', tier: 'A' },
      { title: 'Euromonitor — Sachet Economy and Format Innovation in FMCG', url: 'https://www.euromonitor.com/home-care', tier: 'A' },
      { title: 'World Bank — Water Scarcity and Consumer Behavior Shifts', url: 'https://www.worldbank.org/en/topic/water/publication/high-and-dry-climate-change-water-and-the-economy', tier: 'S' },
      { title: 'PRISM Trend Database: C-12, G-04, E-02', url: '#prism-trends', tier: 'B+' },
    ],
    consumerJourneyStages: ['Need Recognition', 'Availability', 'Affordability', 'Trial', 'Habitual Purchase'],
    imageGradient: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
    imageAccent: '#ea580c',
  },
  {
    id: 'inn_14',
    number: 14,
    name: 'Day-2 Hair Revival System',
    subtitle: 'A dedicated product system for the day-2 (and day-3) hair occasion — reducing wash frequency while maintaining styled, fresh-looking hair.',
    category: 'Hair: Styling',
    categoryShort: 'Styling',
    categoryGroup: 'Hair',
    type: 'WHITE_SPOT',
    typeLabel: 'White Spot',
    tierLevel: 2,
    marketScore: 78,
    fitScore: 82,
    horizon: '2027',
    consumerNeed: 'Consumers are washing hair less frequently (average down from 4.2x to 3.1x per week since 2019), driven by hair health awareness and sustainability. Yet the \'day-2 hair\' occasion — reviving yesterday\'s style without rewashing — has zero dedicated products. Dry shampoo is the only adjacent product, but it\'s positioned as oil absorption, not full style revival. The opportunity is to create a complete day-2 system: refresh, reshape, revive.',
    techSpecs: [
      { title: 'Refresh Mist', description: 'Lightweight spray that neutralizes odors and adds shine without weighing hair down. Contains micro-encapsulated fragrance for all-day freshness.', icon: 'water_drop' },
      { title: 'Reshape Cream', description: 'Flexible hold cream that reactivates with heat (blow dryer or hands) to reshape previous-day styles. No crunchiness, no residue.', icon: 'gesture' },
      { title: 'Root Revival Powder', description: 'Targeted root volumizer that absorbs oil at roots while adding texture and lift. Color-matched variants to avoid white cast.', icon: 'spa' },
      { title: 'Sleep Protection', description: 'Overnight silk-peptide treatment that reduces pillow friction and preserves curl/wave structure. Wakes up with better hair than evening before.', icon: 'bedtime' },
    ],
    portfolioFit: 'Natural extension for styling brands. Fills the gap between wash-day styling products and dry shampoo. Positioning: "Between-wash hair care" (mirrors fabric refresh concept). Price positioning: Mass premium (EUR 6-10 per product). Channel: Mass retail, drugstore, e-commerce.',
    evaluation: [
      { label: 'Market Potential', score: 78, rating: 'STRONG' },
      { label: 'Consumer Sentiment', score: 80, rating: 'HIGH' },
      { label: 'Strategic Fit', score: 82, rating: 'HIGH' },
    ],
    regionalReadiness: [
      { region: 'Europe', readiness: 'HIGH' },
      { region: 'North America', readiness: 'OPTIMAL' },
      { region: 'High Growth', readiness: 'MEDIUM' },
      { region: 'Asia', readiness: 'MEDIUM' },
    ],
    trendConnections: [
      { code: 'C-06', name: 'Reduced Wash Frequency', direction: 'Expansion', rationale: 'Core driver — less washing = more day-2 occasions' },
      { code: 'C-03', name: 'Premiumization in Hair Care', direction: 'Expansion', rationale: 'Willingness to pay for hair health preservation' },
      { code: 'E-02', name: 'Water Scarcity Awareness', direction: 'Expansion', rationale: 'Sustainability narrative supports less washing' },
      { code: 'K-04', name: 'TikTok and Social Commerce', direction: 'Expansion', rationale: 'Day-2 hair content is massive on social media' },
    ],
    sources: [
      { title: 'Mintel — Hair Washing Frequency Tracker 2019-2026', url: 'https://www.mintel.com/beauty-and-personal-care-market-research/', tier: 'A' },
      { title: 'Kantar Worldpanel — Hair Care Routine Usage Report', url: 'https://www.kantarworldpanel.com/global', tier: 'A' },
      { title: 'Circana — Dry Shampoo Market Growth & Limitations', url: 'https://www.circana.com/industry-expertise/beauty/', tier: 'A' },
      { title: 'PRISM Trend Database: C-06, C-03, E-02', url: '#prism-trends', tier: 'B+' },
    ],
    consumerJourneyStages: ['Evening Routine', 'Sleep', 'Morning Revival', 'Day-2 Styling', 'Repeat'],
    imageGradient: 'linear-gradient(135deg, #f472b6 0%, #ec4899 100%)',
    imageAccent: '#ec4899',
  },
  {
    id: 'inn_15',
    number: 15,
    name: 'Premium Aromatherapy Home Care Collection',
    subtitle: 'A premium aromatherapy-infused home care collection positioned at the intersection of household cleaning and sensory wellness — premiumizing commoditized categories.',
    category: 'LHC: HSC / FFI (Home Care + Softeners)',
    categoryShort: 'HSC',
    categoryGroup: 'LHC',
    type: 'PREMIUMIZATION',
    typeLabel: 'Premiumization',
    tierLevel: 1,
    marketScore: 76,
    fitScore: 84,
    horizon: '2027–2028',
    consumerNeed: 'Home care categories (hard surface cleaners, fabric softeners) are among the most commoditized in FMCG. Price pressure from private label is intense. The opportunity is to create a premium tier by repositioning household care as \'home wellness\' — using aromatherapy-grade essential oil blends to transform cleaning from chore to sensory ritual. Mrs. Meyer\'s and Method proved the concept exists; the opportunity is to bring true premium fragrance architecture to the space.',
    techSpecs: [
      { title: 'Essential Oil Blending', description: 'Therapeutic-grade essential oils (lavender, eucalyptus, bergamot, ylang ylang). Master perfumer-designed fragrance profiles. No synthetic fragrance.', icon: 'local_florist' },
      { title: 'Multi-Surface Formulas', description: 'Hard surface cleaner, bathroom spray, kitchen degreaser, glass cleaner. Plant-based surfactants with aromatherapy-grade fragrance. Streak-free, residue-free.', icon: 'cleaning_services' },
      { title: 'Fabric Wellness', description: 'Aromatherapy fabric softener and dryer sachets. Sleep-promoting lavender blend for bedding. Energizing citrus blend for workout clothes.', icon: 'local_laundry_service' },
      { title: 'Ritual Design', description: 'Beautiful packaging (recycled glass bottles, bamboo triggers). Designed to stay on display, not hidden under sink. Premium unboxing for gift potential.', icon: 'auto_awesome' },
    ],
    portfolioFit: 'Creates premium tier above existing home care ranges. Not a replacement for mass products — an incremental premium line. Positioning: "Home wellness, not just home cleaning." Price positioning: Super-premium (200-300% above standard). Channel: Pharmacy, selective retail, online DTC, home decor stores. Key risk: Must deliver genuine cleaning efficacy — fragrance alone is not enough.',
    evaluation: [
      { label: 'Market Potential', score: 76, rating: 'STRONG' },
      { label: 'Consumer Sentiment', score: 80, rating: 'HIGH' },
      { label: 'Strategic Fit', score: 84, rating: 'HIGH' },
    ],
    regionalReadiness: [
      { region: 'Europe', readiness: 'HIGH' },
      { region: 'North America', readiness: 'OPTIMAL' },
      { region: 'High Growth', readiness: 'MEDIUM' },
      { region: 'Asia', readiness: 'MEDIUM' },
    ],
    trendConnections: [
      { code: 'C-09', name: 'Fragrance Premiumization in Home Care', direction: 'Expansion', rationale: 'Core positioning — premium fragrance' },
      { code: 'C-03', name: 'Premiumization Acceleration', direction: 'Expansion', rationale: 'Premium tier creation in commodity category' },
      { code: 'C-04', name: 'Conscious Consumption', direction: 'Expansion', rationale: 'Natural ingredients, beautiful packaging' },
      { code: 'G-05', name: 'EU Green Claims Directive', direction: 'Contraction', rationale: 'Natural claims must be substantiated' },
    ],
    sources: [
      { title: 'Euromonitor — Premium Home Care and Air Care 2025-2030', url: 'https://www.euromonitor.com/home-care', tier: 'A' },
      { title: "Mrs. Meyer's / Method (SC Johnson) Brand Positioning", url: 'https://www.mrsmeyers.com/', tier: 'B' },
      { title: 'Mintel — Essential Oils in Home Care 2025', url: 'https://www.mintel.com/household-care-market-research/', tier: 'A' },
      { title: 'PRISM Trend Database: C-09, C-03, C-04', url: '#prism-trends', tier: 'B+' },
    ],
    consumerJourneyStages: ['Lifestyle Aspiration', 'Discovery', 'Premium Purchase', 'Ritual Usage', 'Gifting'],
    imageGradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
    imageAccent: '#a855f7',
  },
  {
    id: 'inn_16',
    number: 16,
    name: 'Circular Refill Station Network',
    subtitle: 'A transformational refill infrastructure system creating a circular economy platform across Hair and LHC — owning the \'refill occasion\' before competitors.',
    category: 'Cross-Category (LHC + Hair)',
    categoryShort: 'Cross',
    categoryGroup: 'Cross-Category',
    type: 'TRANSFORMATIONAL',
    typeLabel: 'Transformational',
    tierLevel: 1,
    marketScore: 74,
    fitScore: 86,
    horizon: '2028–2030',
    consumerNeed: 'EU PPWR regulation mandates packaging reduction and refill infrastructure by 2030. Rather than treating regulation as a compliance cost, this concept turns refill into a revenue-generating platform. In-store refill stations for laundry detergent, fabric softener, dish soap, shampoo, and conditioner — creating a direct consumer relationship, real-time usage data, and a subscription-like recurring revenue model in physical retail.',
    techSpecs: [
      { title: 'Smart Dispensing', description: 'IoT-connected dispensing stations with RFID bottle recognition. Precise dosing by weight/volume. Anti-contamination single-use nozzles. Cloud-connected inventory management.', icon: 'precision_manufacturing' },
      { title: 'Premium Reusable Bottles', description: 'Branded aluminum bottles with lifetime guarantee. Magnetic label system for product switching. Beautiful design intended for bathroom/kitchen display.', icon: 'recycling' },
      { title: 'Digital Integration', description: 'App-based loyalty program. Scan-to-refill with automatic payment. Usage analytics. Carbon footprint tracking per refill vs. new bottle.', icon: 'qr_code_2' },
      { title: 'Retail Partnership Model', description: 'Station-as-a-service model for retailers. PRISM-branded or white-label options. Revenue share on dispensed volume. Reduces retailer shelf space needs.', icon: 'store' },
    ],
    portfolioFit: 'Cross-category platform spanning Hair and LHC. First-mover advantage in owned refill infrastructure creates switching costs. Requires significant capex for station rollout (co-funded with retail partners). Price positioning: 20-30% discount vs. new bottle (consumer saving drives trial) while maintaining margin via packaging cost elimination. Channel: Major retail partners (dm, Rossmann, Rewe, Tesco). Pilot 500 locations in Year 1, scale to 5,000 by Year 3.',
    evaluation: [
      { label: 'Market Potential', score: 74, rating: 'STRONG' },
      { label: 'Consumer Sentiment', score: 78, rating: 'STRONG' },
      { label: 'Strategic Fit', score: 86, rating: 'HIGH' },
    ],
    regionalReadiness: [
      { region: 'Europe', readiness: 'OPTIMAL' },
      { region: 'North America', readiness: 'MEDIUM' },
      { region: 'High Growth', readiness: 'HIGH' },
      { region: 'Asia', readiness: 'MEDIUM' },
    ],
    trendConnections: [
      { code: 'C-13', name: 'Refill and Reuse Economy', direction: 'Expansion', rationale: 'Core trend — owning the refill infrastructure' },
      { code: 'G-04', name: 'EU PPWR Packaging Regulation', direction: 'Contraction', rationale: 'Regulatory mandate creates urgency' },
      { code: 'T-05', name: 'Smart Manufacturing and IoT', direction: 'Expansion', rationale: 'IoT-connected station management' },
      { code: 'E-02', name: 'Sustainability as Purchase Driver', direction: 'Expansion', rationale: 'Visible sustainability action builds brand equity' },
      { code: 'K-06', name: 'Subscription and Lock-in Models', direction: 'Contraction', rationale: 'Physical refill creates analog subscription behavior' },
    ],
    sources: [
      { title: 'EU PPWR — Refill Infrastructure Requirements (2024/3012)', url: 'https://eur-lex.europa.eu/eli/reg/2024/3012/oj', tier: 'A-' },
      { title: 'Loop / TerraCycle — Reuse Platform Pilot Learnings', url: 'https://www.terracycle.com/en-US/about-terracycle/loop', tier: 'B+' },
      { title: 'Ellen MacArthur Foundation — Reuse Rethinking Packaging', url: 'https://www.ellenmacarthurfoundation.org/reuse-rethinking-packaging', tier: 'A' },
      { title: 'PRISM Trend Database: C-13, G-04, T-05', url: '#prism-trends', tier: 'B+' },
    ],
    consumerJourneyStages: ['First Bottle Purchase', 'In-Store Refill', 'App Tracking', 'Habitual Refill', 'Advocacy'],
    imageGradient: 'linear-gradient(135deg, #0f766e 0%, #115e59 100%)',
    imageAccent: '#0f766e',
  },
];

// Helper function to get innovations by category filter
export function getFilteredInnovations(categoryFilter: string): Innovation[] {
  if (categoryFilter === 'all') return INNOVATIONS;
  if (categoryFilter === 'cross') return INNOVATIONS.filter(i => i.categoryGroup === 'Cross-Category');

  const catMap: Record<string, string[]> = {
    'hair_color': ['Color'],
    'hair_care': ['Care'],
    'hair_styling': ['Styling'],
    'hair_body': ['Body'],
    'lhc_fcn': ['FCN'],
    'lhc_fca': ['FCA'],
    'lhc_ffi': ['FFI'],
    'lhc_lad': ['LAD'],
    'lhc_hdw': ['HDW'],
    'lhc_adw': ['ADW'],
    'lhc_hsc': ['HSC'],
    'lhc_ic': ['IC'],
  };

  const shorts = catMap[categoryFilter] || [];
  return INNOVATIONS.filter(i => {
    // Match by categoryShort or check if category string contains the filter keyword
    if (shorts.includes(i.categoryShort)) return true;
    // Also check the full category string for multi-category innovations
    const catLower = i.category.toLowerCase();
    for (const s of shorts) {
      if (catLower.includes(s.toLowerCase())) return true;
    }
    return false;
  });
}

// Get type color for badges
export function getTypeColor(type: InnovationTier): { bg: string; text: string; border: string } {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    'WHITE_SPOT': { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
    'TRANSFORMATIONAL': { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
    'ADJACENT_INNOVATION': { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
    'BRAND_EXTENSION': { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc' },
    'CORE_INNOVATION': { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' },
    'CATEGORY_EXPANSION': { bg: '#dcfce7', text: '#166534', border: '#86efac' },
    'CHANNEL_CROSSOVER': { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
    'REGULATORY_PROACTIVE': { bg: '#dbeafe', text: '#1e3a8a', border: '#93c5fd' },
    'MARKET_EXPANSION': { bg: '#fed7aa', text: '#9a3412', border: '#fdba74' },
    'PREMIUMIZATION': { bg: '#f3e8ff', text: '#6b21a8', border: '#c4b5fd' },
  };
  return colors[type] || colors['WHITE_SPOT'];
}

// Get tier label with level
export function getTierLabel(tierLevel: InnovationTierLevel): string {
  return tierLevel === 1 ? 'TIER 1 — Invest Immediately' : 'TIER 2 — Develop Next';
}
