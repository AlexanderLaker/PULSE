/**
 * PRISM Profit Pool Shift Model — Mock Data Generation
 * All mock data generators extracted from ProfitPoolShiftModel.tsx
 * Used when API is unavailable or for testing.
 *
 * Exports:
 * - generateMockShifts() → ShiftMatrix
 * - generateMockTrends() → Trend[]
 * - generateMockScenarios() → Scenario[]
 * - generateMockAllocation() → AllocationRecommendation[]
 * - generateMockConvergence() → ConvergenceDiagnostics
 * - MOCK_AI_INSIGHTS → AIInsight[]
 * - generateMockForceContributions() → ForceContribution[]
 * - generateMockData() → Complete MockDataResult
 */

import type {
  Trend,
  Scenario,
  ConvergenceDiagnostics,
  ShiftMatrix,
  ForceContribution,
  ForceName,
} from '@/types';
import { CATEGORIES, YEARS, FORCES } from '@/lib/format';

// ─── Type Definitions ────────────────────────────────────────────

/** Extended Trend with sources for realistic mock data. */
export interface TrendWithSources extends Trend {
  sources: Array<{
    title: string;
    url: string;
    data: string;
  }>;
  category_exposure: Record<string, number>;
  vc_exposure: Record<string, number>;
}

/** Allocation with rationale for display. */
// Local copy — the optimizer (and its shared type) were removed in June 2026 (D4);
// this DEPRECATED mock file keeps a private equivalent so it still compiles.
interface AllocationRecommendation {
  invest_more?: string[];
  defend?: string[];
  harvest?: string[];
  rationale?: string;
  weights?: Record<string, number>;
}

export interface AllocationWithRationale extends AllocationRecommendation {
  category: string;
  currentWeight: number;
  recommendedWeight: number;
  rationale: string;
}

/** AI insight for the insights bar. */
export interface AIInsight {
  id: number;
  type: 'signal' | 'trigger';
  title: string;
  description: string;
  text?: string;
  count?: number;
  severity?: 'warning' | 'critical';
}

/** Complete mock data result. */
export interface MockDataResult {
  shifts: ShiftMatrix;
  forceContributions: Record<string, ForceContribution[]>;
  trends: TrendWithSources[];
  scenarios: Scenario[];
  allocation: AllocationWithRationale[];
  convergence: ConvergenceDiagnostics;
}

// ─── Mock Data Generation Functions ────────────────────────────────

/**
 * Generate realistic shift paths (2026-2030) with percentiles.
 * Each category gets a base shift and velocity applied across years.
 */
export function generateMockShifts(): ShiftMatrix {
  const categoryIds = CATEGORIES.map(c => c.id);
  const shifts: ShiftMatrix = {};

  categoryIds.forEach(catId => {
    shifts[catId] = {};
    const baseShift = (Math.random() - 0.5) * 0.10; // -5% to +5%
    const velocity = (Math.random() - 0.5) * 0.02;

    YEARS.forEach((year, idx) => {
      const median = baseShift + velocity * idx;
      const std = Math.abs(median) * 0.4 + 0.01;

      const shiftPath = shifts[catId];
      if (shiftPath) {
        shiftPath[year] = {
          median: median || 0,
          p10: (median - std * 1.28) || 0,
          p25: (median - std * 0.67) || 0,
          p75: (median + std * 0.67) || 0,
          p90: (median + std * 1.28) || 0,
        };
      }
    });
  });

  return shifts;
}

/**
 * Generate force contributions by category.
 * Normalizes so each category's force weights sum to 1.0.
 */
export function generateMockForceContributions(): Record<string, ForceContribution[]> {
  const categoryIds = CATEGORIES.map(c => c.id);
  const forceNames = Object.keys(FORCES) as ForceName[];
  const forceContributions: Record<string, ForceContribution[]> = {};

  categoryIds.forEach(catId => {
    const total = forceNames.reduce((sum) => sum + Math.random(), 0);
    forceContributions[catId] = forceNames.map((force: ForceName) => ({
      force: force as ForceName,
      value: Math.random() / total,
      normalized: 0,
    }));
    const sum = forceContributions[catId].reduce((s, x) => s + (x?.value || 0), 0);
    forceContributions[catId] = forceContributions[catId].map(fc => ({
      ...fc,
      normalized: (fc?.value || 0) / sum,
    }));
  });

  return forceContributions;
}

/**
 * Generate realistic trends with sources, scoring, and exposure mappings.
 * Returns 35 trends across 6 forces with realistic force assignments.
 */
export function generateMockTrends(): TrendWithSources[] {
  const trends: TrendWithSources[] = [
    // ─── Consumer Force (6 trends) ───
    {
      id: 'con_01',
      force: 'Consumer',
      name: 'Natural / Clean Beauty Movement',
      direction: 'Expansion',
      impact: 5,
      probability: 4,
      score: 20,
      gp1_shift: 0.032,
      description:
        'Global clean beauty market projected to reach $22B by 2030 at 12% CAGR. Consumer demand for paraben-free, sulfate-free, and vegan formulations is accelerating across all hair and home care categories.',
      strategic_implication:
        'Reformulate core SKUs to clean standards. Launch Schwarzkopf Nature Moments extension.',
      category_exposure: {
        hair_color: 3,
        hair_care: 4,
        hair_styling: 2,
        hair_body: 3,
        lhc_hdw: 1,
      },
      vc_exposure: {
        raw_materials: 4,
        formulation: 5,
        packaging: 3,
        manufacturing: 2,
        logistics: 1,
        marketing: 4,
        trade: 2,
        after_sales: 1,
      },
      sources: [
        {
          title: 'Grand View Research — Clean Beauty Market Size Report',
          url: 'https://www.grandviewresearch.com/industry-analysis/clean-beauty-products-market-report',
          data: 'Market size $11.6B (2023), CAGR 12.07% to 2030',
        },
        {
          title: 'McKinsey — The Beauty Market in 2025',
          url: 'https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights/the-beauty-market-in-2025',
          data: '42% of consumers willing to pay premium for clean ingredients',
        },
      ],
    },
    {
      id: 'con_02',
      force: 'Consumer',
      name: 'Premiumization & Masstige Growth',
      direction: 'Expansion',
      impact: 4,
      probability: 4,
      score: 16,
      gp1_shift: 0.025,
      description:
        'Prestige beauty grew 2x mass market rate in 2024. Masstige (mass + prestige) is the fastest-growing segment in hair care across Europe.',
      strategic_implication:
        'Extend Gliss Kur into masstige positioning. Accelerate salon-quality claims.',
      category_exposure: { hair_color: 4, hair_care: 4, hair_styling: 3 },
      vc_exposure: {
        raw_materials: 3,
        formulation: 4,
        packaging: 4,
        manufacturing: 2,
        logistics: 1,
        marketing: 5,
        trade: 3,
        after_sales: 2,
      },
      sources: [
        {
          title: 'Circana — 2024 Beauty Industry Report',
          url: 'https://www.circana.com/intelligence/press-releases/2024/us-prestige-beauty-industry-revenue/',
          data: 'Prestige beauty +8% YoY vs mass +3% in 2024',
        },
        {
          title: 'Euromonitor — Premium Hair Care Outlook',
          url: 'https://www.euromonitor.com/hair-care',
          data: 'Premium hair care grew 9.2% globally in 2024',
        },
      ],
    },
    {
      id: 'con_03',
      force: 'Consumer',
      name: 'Silver Economy & Aging Hair Care',
      direction: 'Expansion',
      impact: 3,
      probability: 5,
      score: 15,
      gp1_shift: 0.018,
      description:
        'EU population 65+ will reach 130M by 2030 (28% of total). Hair color usage among 50+ consumers is the most defensible category position in the Henkel portfolio.',
      strategic_implication:
        'Protect Color category with age-specific innovation. Launch gentle/low-ammonia line.',
      category_exposure: { hair_color: 5, hair_care: 3 },
      vc_exposure: {
        raw_materials: 2,
        formulation: 4,
        packaging: 2,
        manufacturing: 1,
        logistics: 1,
        marketing: 4,
        trade: 3,
        after_sales: 2,
      },
      sources: [
        {
          title: 'Eurostat — Population Projections 2025-2100',
          url: 'https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Population_projections_in_the_EU',
          data: 'EU-27 population 65+: 21.1% (2023) → 28.5% (2050)',
        },
      ],
    },
    {
      id: 'con_04',
      force: 'Consumer',
      name: 'Gen Z DIY & Salon-Skip Trend',
      direction: 'Contraction',
      impact: 4,
      probability: 3,
      score: -12,
      gp1_shift: -0.019,
      description:
        'TikTok-driven DIY hair coloring views surpassed 12B in 2024. Gen Z consumers increasingly skip salons in favor of at-home treatments.',
      strategic_implication: 'Launch TikTok-native product formats. Create tutorial-first marketing.',
      category_exposure: { hair_color: 4, hair_styling: 3 },
      vc_exposure: {
        raw_materials: 1,
        formulation: 2,
        packaging: 3,
        manufacturing: 1,
        logistics: 2,
        marketing: 5,
        trade: 2,
        after_sales: 1,
      },
      sources: [
        {
          title: 'TikTok Business — Beauty Trends Report 2024',
          url: 'https://www.tiktok.com/business/en-US/blog/beauty-trends-2024',
          data: '#DIYhaircolor: 12.3B views, +180% YoY',
        },
      ],
    },
    {
      id: 'con_05',
      force: 'Consumer',
      name: 'Sustainability-Driven Brand Switching',
      direction: 'Contraction',
      impact: 3,
      probability: 4,
      score: -12,
      gp1_shift: -0.015,
      description:
        '67% of EU consumers say they have switched brands due to sustainability concerns. Laundry care is the category most affected.',
      strategic_implication: 'Accelerate Persil Green Power line. Publish LCA data per SKU.',
      category_exposure: { lhc_fcn: 3, lhc_fca: 2, lhc_adw: 2 },
      vc_exposure: {
        raw_materials: 4,
        formulation: 3,
        packaging: 5,
        manufacturing: 3,
        logistics: 2,
        marketing: 3,
        trade: 2,
        after_sales: 1,
      },
      sources: [
        {
          title: 'Simon-Kucher — Global Sustainability Study 2024',
          url: 'https://www.simon-kucher.com/en/insights/global-sustainability-study-2024',
          data: '67% of consumers switched brands for sustainability',
        },
      ],
    },
    {
      id: 'con_06',
      force: 'Consumer',
      name: 'Private Label Acceptance in Laundry',
      direction: 'Contraction',
      impact: 4,
      probability: 4,
      score: -16,
      gp1_shift: -0.028,
      description:
        'Private label share in EU laundry detergent reached 42.1% in 2024, up from 38.7% in 2022.',
      strategic_implication:
        'Defend Persil with innovation that PL cannot replicate. Consider value-tier fighter brand.',
      category_exposure: { lhc_fcn: 5, lhc_fca: 3, lhc_hdw: 4 },
      vc_exposure: {
        raw_materials: 2,
        formulation: 3,
        packaging: 2,
        manufacturing: 2,
        logistics: 2,
        marketing: 4,
        trade: 5,
        after_sales: 1,
      },
      sources: [
        {
          title: 'PLMA — Private Label Yearbook 2024',
          url: 'https://www.plmainternational.com/industry-news/private-label-today',
          data: 'EU private label laundry share: 42.1% (2024)',
        },
      ],
    },

    // ─── Customer Force (3 sample trends) ───
    {
      id: 'cus_01',
      force: 'Customer',
      name: 'Retailer Private Label Expansion',
      direction: 'Contraction',
      impact: 5,
      probability: 4,
      score: -20,
      gp1_shift: -0.035,
      description:
        'Major EU retailers expanded PL SKU count by 18% in HPC in 2024. Shelf space allocation shifting.',
      strategic_implication:
        'Negotiate JBPs with innovation exclusivity windows. Defend shelf with category captain data.',
      category_exposure: { lhc_fcn: 5, lhc_fca: 4, lhc_hdw: 4, lhc_adw: 3 },
      vc_exposure: {
        raw_materials: 1,
        formulation: 2,
        packaging: 1,
        manufacturing: 1,
        logistics: 2,
        marketing: 3,
        trade: 5,
        after_sales: 1,
      },
      sources: [
        {
          title: 'IGD — European Private Label Report 2024',
          url: 'https://www.igd.com/articles/article-viewer/t/european-grocery-private-label/i/30686',
          data: 'HPC private label SKU growth: +18% YoY',
        },
      ],
    },
    {
      id: 'cus_02',
      force: 'Customer',
      name: 'D2C & Subscription Models Rise',
      direction: 'Contraction',
      impact: 3,
      probability: 3,
      score: -9,
      gp1_shift: -0.011,
      description:
        'Hair care subscription services grew 24% in 2024. DTC brands bypass traditional retail.',
      strategic_implication: 'Explore Schwarzkopf DTC pilot. Build first-party consumer data.',
      category_exposure: { hair_care: 3, hair_color: 2 },
      vc_exposure: {
        raw_materials: 1,
        formulation: 2,
        packaging: 2,
        manufacturing: 1,
        logistics: 4,
        marketing: 4,
        trade: 1,
        after_sales: 3,
      },
      sources: [
        {
          title: 'eMarketer — DTC Beauty Market 2024',
          url: 'https://www.emarketer.com/content/dtc-beauty-brands',
          data: 'Hair care subscription revenue +24% YoY',
        },
      ],
    },
    {
      id: 'cus_03',
      force: 'Customer',
      name: 'E-Commerce Margin Pressure',
      direction: 'Contraction',
      impact: 3,
      probability: 4,
      score: -12,
      gp1_shift: -0.014,
      description:
        'Online HPC margins are 3-5pp lower than offline due to last-mile costs.',
      strategic_implication: 'Optimize pack sizes for e-commerce. Negotiate Amazon co-op terms.',
      category_exposure: { hair_care: 3, hair_styling: 2, lhc_fcn: 3 },
      vc_exposure: {
        raw_materials: 1,
        formulation: 1,
        packaging: 3,
        manufacturing: 1,
        logistics: 5,
        marketing: 3,
        trade: 4,
        after_sales: 2,
      },
      sources: [
        {
          title: 'Profitero — E-Commerce Economics in CPG',
          url: 'https://www.profitero.com/resources/ecommerce-economics',
          data: 'Online HPC GP margin: 3-5pp below offline',
        },
      ],
    },

    // ─── Technology Force (3 sample trends) ───
    {
      id: 'tec_01',
      force: 'Technology',
      name: 'AI-Powered Personalization',
      direction: 'Expansion',
      impact: 4,
      probability: 3,
      score: 12,
      gp1_shift: 0.018,
      description:
        'AI beauty diagnostics market growing at 29% CAGR. Personalized product recommendations increase basket size by 35%.',
      strategic_implication:
        'Deploy AI shade-matching for Schwarzkopf Color. Build recommendation engine.',
      category_exposure: { hair_color: 4, hair_care: 4, hair_styling: 3 },
      vc_exposure: {
        raw_materials: 1,
        formulation: 2,
        packaging: 1,
        manufacturing: 2,
        logistics: 1,
        marketing: 5,
        trade: 3,
        after_sales: 4,
      },
      sources: [
        {
          title: 'Markets & Markets — AI in Beauty Market 2024',
          url: 'https://www.marketsandmarkets.com/Market-Reports/ai-in-beauty-cosmetics-market.html',
          data: 'AI beauty diagnostics CAGR: 29.1%',
        },
      ],
    },
    {
      id: 'tec_02',
      force: 'Technology',
      name: 'Biotech Ingredient Innovation',
      direction: 'Expansion',
      impact: 4,
      probability: 3,
      score: 12,
      gp1_shift: 0.016,
      description:
        'Fermentation-derived surfactants reaching price parity with petrochemical alternatives by 2027.',
      strategic_implication:
        'Partner with Evonik/BASF on bio-surfactant supply for Persil reformulation.',
      category_exposure: { hair_care: 5, lhc_fcn: 3, lhc_fca: 3 },
      vc_exposure: {
        raw_materials: 5,
        formulation: 5,
        packaging: 1,
        manufacturing: 3,
        logistics: 1,
        marketing: 2,
        trade: 1,
        after_sales: 0,
      },
      sources: [
        {
          title: 'Lux Research — Bio-Surfactants Price Parity Timeline',
          url: 'https://www.luxresearchinc.com/research/bio-based-surfactants',
          data: 'Bio-surfactant cost: $2.80/kg (2024) → $1.90/kg (2027)',
        },
      ],
    },
    {
      id: 'tec_03',
      force: 'Technology',
      name: 'Green Chemistry Reformulation',
      direction: 'Expansion',
      impact: 4,
      probability: 4,
      score: 16,
      gp1_shift: 0.022,
      description:
        'EU Green Deal mandates are forcing reformulation across 60%+ of HPC product lines by 2028.',
      strategic_implication:
        'Front-load reformulation investment. Position as compliance leader.',
      category_exposure: { lhc_fcn: 4, lhc_fca: 4, lhc_hdw: 3 },
      vc_exposure: {
        raw_materials: 5,
        formulation: 5,
        packaging: 3,
        manufacturing: 4,
        logistics: 1,
        marketing: 2,
        trade: 1,
        after_sales: 0,
      },
      sources: [
        {
          title: 'ECHA — REACH Restriction Roadmap 2024-2030',
          url: 'https://echa.europa.eu/restrictions-under-consideration',
          data: '478 substance groups under evaluation',
        },
      ],
    },

    // ─── Government Force (3 sample trends) ───
    {
      id: 'gov_01',
      force: 'Government',
      name: 'EU Green Deal Chemical Regulation',
      direction: 'Contraction',
      impact: 5,
      probability: 5,
      score: -25,
      gp1_shift: -0.048,
      description:
        'CSS will restrict 5,000+ substances by 2030. PFAS universal restriction alone affects 35% of HPC formulations.',
      strategic_implication: 'Establish regulatory task force. Pre-emptive reformulation of top 50 SKUs.',
      category_exposure: { lhc_fcn: 5, lhc_fca: 4, lhc_ic: 5, lhc_hsc: 3 },
      vc_exposure: {
        raw_materials: 5,
        formulation: 5,
        packaging: 3,
        manufacturing: 3,
        logistics: 1,
        marketing: 2,
        trade: 2,
        after_sales: 1,
      },
      sources: [
        {
          title: 'European Commission — Chemicals Strategy for Sustainability',
          url: 'https://environment.ec.europa.eu/strategy/chemicals-strategy_en',
          data: 'CSS targets 5,000+ substances for restriction by 2030',
        },
      ],
    },
    {
      id: 'gov_02',
      force: 'Government',
      name: 'PFAS Restriction Proposal',
      direction: 'Contraction',
      impact: 4,
      probability: 4,
      score: -16,
      gp1_shift: -0.028,
      description:
        'Universal PFAS restriction expected 2026-2027. Reformulation costs estimated at €50-100M.',
      strategic_implication:
        'Accelerate PFAS-free formulation R&D. Build competitive moat through early compliance.',
      category_exposure: { lhc_fcn: 4, lhc_fca: 3, lhc_adw: 3 },
      vc_exposure: {
        raw_materials: 5,
        formulation: 5,
        packaging: 1,
        manufacturing: 2,
        logistics: 0,
        marketing: 1,
        trade: 1,
        after_sales: 0,
      },
      sources: [
        {
          title: 'ChemicalWatch — PFAS Restriction Timeline',
          url: 'https://www.chemicalwatch.com/pfas',
          data: 'ECHA opinion expected Q3 2026',
        },
      ],
    },
    {
      id: 'gov_03',
      force: 'Government',
      name: 'EPR Packaging Mandates',
      direction: 'Contraction',
      impact: 3,
      probability: 5,
      score: -15,
      gp1_shift: -0.018,
      description:
        'PPWR mandates 30% recycled content by 2030 and 65% recyclability. Increases packaging cost 8-15%.',
      strategic_implication: 'Transition to mono-material packaging. Invest in PCR supply chain.',
      category_exposure: { lhc_fcn: 3, hair_care: 2, lhc_hdw: 3 },
      vc_exposure: {
        raw_materials: 2,
        formulation: 0,
        packaging: 5,
        manufacturing: 3,
        logistics: 2,
        marketing: 1,
        trade: 1,
        after_sales: 0,
      },
      sources: [
        {
          title: 'European Parliament — PPWR Final Text',
          url: 'https://www.europarl.europa.eu/doceo/document/TA-9-2024-0215_EN.html',
          data: '30% recycled content mandate by 2030',
        },
      ],
    },

    // ─── Environmental Force (3 sample trends) ───
    {
      id: 'env_01',
      force: 'Environmental',
      name: 'Water Scarcity Impact on Formulation',
      direction: 'Contraction',
      impact: 4,
      probability: 4,
      score: -16,
      gp1_shift: -0.021,
      description:
        'EU water stress areas expanded 15% since 2020. Mediterranean manufacturing sites face restrictions.',
      strategic_implication:
        'Develop low-water formulations. Relocate water-intensive production from Southern EU.',
      category_exposure: { lhc_fcn: 4, lhc_fca: 3, hair_care: 3 },
      vc_exposure: {
        raw_materials: 4,
        formulation: 5,
        packaging: 1,
        manufacturing: 5,
        logistics: 1,
        marketing: 1,
        trade: 0,
        after_sales: 0,
      },
      sources: [
        {
          title: 'EEA — Water Scarcity in Europe 2024',
          url: 'https://www.eea.europa.eu/en/topics/in-depth/water',
          data: 'EU water-stressed areas: +15% expansion since 2020',
        },
      ],
    },
    {
      id: 'env_02',
      force: 'Environmental',
      name: 'Biodegradability Demand Surge',
      direction: 'Expansion',
      impact: 3,
      probability: 4,
      score: 12,
      gp1_shift: 0.013,
      description:
        '78% of EU consumers now check biodegradability claims. Certified biodegradable products command 8-12% price premium.',
      strategic_implication:
        'Obtain OECD 301B certification for all Persil variants. Communicate on-pack.',
      category_exposure: { lhc_fcn: 4, lhc_fca: 3, lhc_hdw: 3 },
      vc_exposure: {
        raw_materials: 4,
        formulation: 5,
        packaging: 2,
        manufacturing: 1,
        logistics: 0,
        marketing: 4,
        trade: 2,
        after_sales: 0,
      },
      sources: [
        {
          title: 'Mintel — Sustainability in Household Care EU 2024',
          url: 'https://www.mintel.com/press-centre/sustainability-household-care',
          data: '78% check biodegradability; premium of 8-12%',
        },
      ],
    },
    {
      id: 'env_03',
      force: 'Environmental',
      name: 'Circular Economy Packaging Innovation',
      direction: 'Expansion',
      impact: 3,
      probability: 3,
      score: 9,
      gp1_shift: 0.007,
      description:
        'Refill stations in EU grocery growing 35% annually. Cost savings of 20% on packaging per unit.',
      strategic_implication: 'Scale refill infrastructure to 2,000 stores by 2027.',
      category_exposure: { lhc_fcn: 3, lhc_fca: 2, hair_care: 2 },
      vc_exposure: {
        raw_materials: 1,
        formulation: 0,
        packaging: 5,
        manufacturing: 2,
        logistics: 4,
        marketing: 3,
        trade: 4,
        after_sales: 2,
      },
      sources: [
        {
          title: 'Ellen MacArthur Foundation — Reuse in FMCG 2024',
          url: 'https://www.ellenmacarthurfoundation.org/topics/plastics/reuse',
          data: 'EU refill station count: +35% YoY',
        },
      ],
    },

    // ─── Competitive Force (3 sample trends) ───
    {
      id: 'com_01',
      force: 'Competitive',
      name: 'P&G Innovation Acceleration',
      direction: 'Contraction',
      impact: 5,
      probability: 4,
      score: -20,
      gp1_shift: -0.038,
      description:
        'P&G increased R&D spend to 3.1% of sales ($2.4B) in FY2024. Head & Shoulders reformulation and Ariel Pods 5-in-1 launch capturing share.',
      strategic_implication:
        'Match innovation velocity. Focus R&D on areas where P&G is structurally weaker (color, value formats).',
      category_exposure: { hair_care: 5, lhc_fcn: 4, lhc_fca: 3 },
      vc_exposure: {
        raw_materials: 2,
        formulation: 4,
        packaging: 3,
        manufacturing: 2,
        logistics: 1,
        marketing: 4,
        trade: 3,
        after_sales: 1,
      },
      sources: [
        {
          title: 'P&G — FY2024 Annual Report',
          url: 'https://pginvestor.com/financial-reporting/annual-reports',
          data: 'R&D spend: $2.4B (3.1% of sales), +7% YoY',
        },
      ],
    },
    {
      id: 'com_02',
      force: 'Competitive',
      name: 'Unilever Sustainability First-Mover',
      direction: 'Contraction',
      impact: 4,
      probability: 4,
      score: -16,
      gp1_shift: -0.026,
      description:
        'Unilever Clean Future program achieved 100% biodegradable formulations in EU laundry by 2024, 2 years ahead of regulation.',
      strategic_implication:
        'Close sustainability perception gap. Benchmark Persil against Unilever Clean Future claims.',
      category_exposure: { lhc_fcn: 4, hair_care: 3, lhc_adw: 3 },
      vc_exposure: {
        raw_materials: 3,
        formulation: 4,
        packaging: 3,
        manufacturing: 2,
        logistics: 1,
        marketing: 5,
        trade: 3,
        after_sales: 1,
      },
      sources: [
        {
          title: 'Unilever — Clean Future Progress Report 2024',
          url: 'https://www.unilever.com/planet-and-society/clean-future/',
          data: '100% biodegradable EU laundry portfolio achieved 2024',
        },
      ],
    },
    {
      id: 'com_03',
      force: 'Competitive',
      name: 'DTC Indie Brand Proliferation',
      direction: 'Contraction',
      impact: 3,
      probability: 4,
      score: -12,
      gp1_shift: -0.017,
      description:
        'Indie beauty brands captured 33% of US hair care growth in 2024. European entry accelerating via Amazon and social commerce.',
      strategic_implication:
        'Acquire or partner with 2-3 high-growth indie brands. Launch Henkel Ventures arm.',
      category_exposure: { hair_color: 4, hair_care: 4, hair_styling: 3 },
      vc_exposure: {
        raw_materials: 1,
        formulation: 2,
        packaging: 2,
        manufacturing: 1,
        logistics: 2,
        marketing: 5,
        trade: 3,
        after_sales: 2,
      },
      sources: [
        {
          title: 'Circana — US Beauty Industry Indie Report 2024',
          url: 'https://www.circana.com/intelligence/press-releases/2024/indie-beauty-growth/',
          data: 'Indie brands: 33% of US hair care category growth',
        },
      ],
    },
  ];

  // Compute score and gp1_shift for trends that don't have them
  trends.forEach(t => {
    if (!t.score)
      t.score = t.impact * t.probability * (t.direction === 'Expansion' ? 1 : -1);
    if (!t.gp1_shift) t.gp1_shift = (t.score / 25) * 0.05;
  });

  return trends;
}

/**
 * Generate scenario definitions with causal descriptions.
 */
export function generateMockScenarios(): Scenario[] {
  return [
    {
      id: 'base',
      name: 'Base Case',
      description: 'Current scores, simulation active',
    },
    {
      id: 'green',
      name: 'Green Squeeze',
      description: 'Environmental force shock',
    },
    {
      id: 'tech',
      name: 'Tech Disruption',
      description: 'Technology force acceleration',
    },
    {
      id: 'price',
      name: 'Price War',
      description: 'Competitive pricing pressure',
    },
    {
      id: 'storm',
      name: 'Perfect Storm',
      description: 'Correlated tail events',
    },
  ];
}

/**
 * Generate allocation recommendations with weights and rationale.
 */
export function generateMockAllocation(): AllocationWithRationale[] {
  const categoryIds = CATEGORIES.map(c => c.id);
  const allocation: AllocationWithRationale[] = categoryIds.map((catId) => {
    const baseWeight = 1 / categoryIds.length;
    const recommendation = baseWeight + (Math.random() - 0.5) * 0.05;
    return {
      category: catId,
      currentWeight: baseWeight,
      recommendedWeight: Math.max(0.02, Math.min(0.20, recommendation)),
      rationale: 'Based on shift magnitude and diversification.',
    };
  });

  return allocation;
}

/**
 * Generate convergence diagnostics showing model accuracy.
 */
export function generateMockConvergence(): ConvergenceDiagnostics {
  return {
    r_hat: 1.03,
    converged: true,
    iterations: 5000,
  };
}

/**
 * AI insights for the insights bar.
 */
export const MOCK_AI_INSIGHTS: AIInsight[] = [
  {
    id: 1,
    type: 'signal',
    title: 'New Signals',
    description: '3 new signals detected',
    count: 3,
  },
  {
    id: 2,
    type: 'trigger',
    title: 'Trigger Alert',
    description: 'FCN trigger breached',
    severity: 'warning',
  },
];

/**
 * Generate all mock data at once.
 * Called as fallback when API is unavailable.
 */
export function generateMockData(): MockDataResult {
  return {
    shifts: generateMockShifts(),
    forceContributions: generateMockForceContributions(),
    trends: generateMockTrends(),
    scenarios: generateMockScenarios(),
    allocation: generateMockAllocation(),
    convergence: generateMockConvergence(),
  };
}
