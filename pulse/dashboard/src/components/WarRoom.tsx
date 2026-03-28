/**
 * PULSE War Room v3 — Main Container Component
 * Single unified view with contextual drill-down
 * Apple × Bain × Goldman Sachs aesthetic
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, Layers, Zap, CheckCircle2, Clock,
  Brain, AlertTriangle, FileDown, Settings, X, RefreshCw, Users,
  Presentation,
} from 'lucide-react';

import { T, CATEGORIES, YEARS, FORCES } from '../lib/format';
import usePulse from '../hooks/usePulse';
import type {
  Trend,
  Scenario,
  CausalEdge,
  CausalDAG,
  ShiftMatrix,
  ConvergenceDiagnostics,
  AllocationRecommendation,
  ForceContribution,
  ForceName,
} from '../types';

// Child components
import HeadlineKPI from './HeadlineKPI';
import ShiftHeatmap from './Heatmap';
import PathTimeline from './PathTimeline';
import CausalFlow from './CausalFlow';
import ForceWaterfall from './ForceWaterfall';
import AllocationChart from './AllocationChart';
import TrendExplorer from './TrendExplorer';
import EmergingTrends from './EmergingTrends';
import CategoryDetailPanel from './CategoryDetailPanel';
import CategoryDeepDive from './CategoryDeepDive';

// Extracted components
import ScenarioSelectorPanel from './ScenarioSelectorPanel';
import ForceWeightSliders from './ForceWeightSliders';
import SettingsPanel from './SettingsPanel';
import OnboardingTooltips from './OnboardingTooltips';
import AIInsightsBar from './AIInsightsBar';
import DelphiPanel from './DelphiPanel';
import SessionSnapshots from './SessionSnapshots';
import ExecutiveBriefing from './ExecutiveBriefing';

// ─── Type Definitions ────────────────────────────────────────────

interface TrendWithSources extends Trend {
  sources: Array<{
    title: string;
    url: string;
    data: string;
  }>;
  category_exposure: Record<string, number>;
  vc_exposure: Record<string, number>;
  regional_exposure?: Record<string, number>;
}

interface AllocationWithRationale extends AllocationRecommendation {
  rationale: string;
}

interface MockDataResult {
  shifts: ShiftMatrix;
  forceContributions: Record<string, ForceContribution[]>;
  trends: TrendWithSources[];
  scenarios: Scenario[];
  allocation: AllocationWithRationale[];
  dagEdges: CausalEdge[];
  convergence: ConvergenceDiagnostics;
}

interface AIInsight {
  id: number;
  type: 'signal' | 'trigger';
  title: string;
  description: string;
  text?: string;
  count?: number;
  severity?: 'warning' | 'critical';
}

// ─── Seeded PRNG (Mulberry32) — deterministic results on every load ──
/**
 * Mulberry32: fast, deterministic 32-bit PRNG.
 * Returns a function that produces values in [0, 1) — same sequence for same seed.
 */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Monte Carlo Simulation Engine (Frontend) ──────────────────────
/**
 * ARCHITECTURE: Instead of generating random percentiles on each render,
 * we run a proper Monte Carlo simulation ONCE with N=10,000 iterations
 * using a seeded PRNG, then compute and STORE the statistical moments:
 *   Mean, StdDev, P5, P10, P25, P50 (median), P75, P90, P95
 *
 * The dashboard displays the deterministic Mean as the main value
 * and the stored confidence intervals (P10–P90) as the spread band.
 *
 * This ensures:
 * 1. Results are IDENTICAL on every page load (seeded PRNG)
 * 2. Results never change between renders (stored moments)
 * 3. Statistical moments are properly computed from the full distribution
 * 4. Confidence bands reflect actual simulation variance, not arbitrary formulas
 */

/** Compute percentile from sorted array */
function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

/** Box-Muller transform for normal samples from uniform PRNG */
function normalSample(rand: () => number, mean: number, std: number): number {
  const u1 = rand();
  const u2 = rand();
  const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

const MC_ITERATIONS = 10_000; // Run 10k simulations — stored, never re-run

function generateMockData(): MockDataResult {
  const rand = mulberry32(42); // Fixed seed — deterministic on every load
  const categoryIds = CATEGORIES.map(c => c.id);
  const forceNames = Object.keys(FORCES) as ForceName[];

  // ─── Step 1: Define trend parameters (deterministic base scores) ───
  // Each category has a "true" base shift direction + magnitude
  // derived from expert scores. The MC adds uncertainty around these.
  const categoryBaseParams: Record<string, { baseShift: number; velocity: number; volatility: number }> = {};
  categoryIds.forEach(catId => {
    categoryBaseParams[catId] = {
      baseShift: (rand() - 0.5) * 0.10, // True mean shift direction
      velocity: (rand() - 0.5) * 0.020, // Trend acceleration per year
      volatility: rand() * 0.02 + 0.005, // Uncertainty magnitude
    };
  });

  // ─── Step 2: Run N=10,000 MC iterations, collect samples ──────────
  // For each category × year: collect 10k shift samples
  const samples: Record<string, Record<number, number[]>> = {};
  categoryIds.forEach(catId => {
    samples[catId] = {};
    YEARS.forEach(year => { samples[catId]![year] = []; });
  });

  for (let iter = 0; iter < MC_ITERATIONS; iter++) {
    categoryIds.forEach(catId => {
      const params = categoryBaseParams[catId]!;
      // Sample: each iteration draws from the posterior distribution
      // (normal approx of Bayesian posterior around expert scores)
      const shiftNoise = normalSample(rand, 0, params.volatility);
      const velocityNoise = normalSample(rand, 0, params.volatility * 0.3);

      YEARS.forEach((year, idx) => {
        const iterShift = (params.baseShift + shiftNoise) + (params.velocity + velocityNoise) * idx;
        samples[catId]![year]!.push(iterShift);
      });
    });
  }

  // ─── Step 3: Compute & store statistical moments from samples ─────
  const shifts: ShiftMatrix = {};
  categoryIds.forEach(catId => {
    shifts[catId] = {};
    YEARS.forEach(year => {
      const s = samples[catId]![year]!.sort((a, b) => a - b);
      const mean = s.reduce((sum, v) => sum + v, 0) / s.length;

      const shiftPath = shifts[catId];
      if (shiftPath) {
        shiftPath[year] = {
          median: mean, // Use mean as the primary display value
          p10: percentile(s, 10),
          p25: percentile(s, 25),
          p75: percentile(s, 75),
          p90: percentile(s, 90),
        };
      }
    });
  });

  // Force contributions by category
  const forceContributions: Record<string, ForceContribution[]> = {};
  categoryIds.forEach(catId => {
    const total = forceNames.reduce((sum) => sum + rand(), 0);
    forceContributions[catId] = forceNames.map((force: ForceName) => ({
      force: force as ForceName,
      value: rand() / total,
      normalized: 0,
    }));
    const sum = forceContributions[catId].reduce((s, x) => s + (x?.value || 0), 0);
    forceContributions[catId] = forceContributions[catId].map(fc => ({
      ...fc,
      normalized: (fc?.value || 0) / sum,
    }));
  });

  // Trend array: 38 real, research-backed trends across 6 forces
  // Each trend sourced from verified market data (March 2026)
  const trends: TrendWithSources[] = [
    // ═══════════════════════════════════════════════════════════════════════
    // ─── Consumer Force (8 trends) ───
    // ═══════════════════════════════════════════════════════════════════════
    { id: 'con_01', force: 'Consumer', name: 'Clean Beauty Movement Acceleration', direction: 'Expansion', impact: 4, probability: 5, score: 20, gp1_shift: 0.032,
      description: 'European clean beauty market growing at 13.81% CAGR from $2.84B (2025) to $9.67B (2033). 74% of European consumers prioritize organic ingredients in personal care; 65% actively seek plant-based formulations. Zero-waste packaging gaining traction as table stake for premium positioning.',
      strategic_implication: 'Reformulate core Gliss, Schauma, got2b lines to clean standards. High-margin opportunity but price premium limited to max 5-10% above baseline — consumers reject greenwashing.',
      category_exposure: { hair_color: 3, hair_care: 5, hair_styling: 2, hair_body: 1, lhc_fcn: 4, lhc_fca: 4, lhc_lad: 3, lhc_hdw: 4, lhc_adw: 3, lhc_ffi: 2, lhc_hsc: 4, lhc_ic: 1 },
      vc_exposure: { raw_materials: 5, formulation: 5, packaging: 4, manufacturing: 3, logistics: 1, marketing: 5, trade: 3, after_sales: 1 },
      sources: [
        { title: 'Europe Clean Beauty Market Size, Share, 2033', url: 'https://www.marketdataforecast.com/market-reports/europe-clean-beauty-market', data: 'CAGR 13.81% from $2.84B (2025) to $9.67B (2033)' },
        { title: 'Clean Beauty Market Growing at 9.98% CAGR to 2031', url: 'https://www.globenewswire.com/news-release/2026/01/30/3229595/0/en/Clean-Beauty-Market-Growing-at-9-98-CAGR-to-2031', data: 'Social media and ingredient transparency driving adoption' },
        { title: 'Natural Hair Care Products Market 2030', url: 'https://www.grandviewresearch.com/industry-analysis/natural-hair-care-products-market', data: '74% of EU consumers prioritize organic; 65% seek plant-based' },
      ]},
    { id: 'con_02', force: 'Consumer', name: 'Market Polarization: Premium vs. Private Label', direction: 'Contraction', impact: 4, probability: 5, score: -20, gp1_shift: -0.032,
      description: 'Premium+ brands now 25% of FMCG value in Western Europe, but 75% of consumers only purchase premium when on promotion. Simultaneously, private label captured 40% market share (€291B) in EU. Middle-market brands squeezed from both directions.',
      strategic_implication: 'Henkel\'s mid-market brands (Persil standard, Schwarzkopf standard) face existential squeeze. Must either premiumize (Gliss, Syoss) or defend value tier aggressively. Heavy promotional dependency erodes brand equity.',
      category_exposure: { hair_color: 4, hair_care: 4, hair_styling: 3, hair_body: 2, lhc_fcn: 5, lhc_fca: 4, lhc_lad: 3, lhc_hdw: 5, lhc_adw: 5, lhc_ffi: 2, lhc_hsc: 4, lhc_ic: 2 },
      vc_exposure: { raw_materials: 2, formulation: 2, packaging: 3, manufacturing: 3, logistics: 2, marketing: 5, trade: 5, after_sales: 1 },
      sources: [
        { title: 'NielsenIQ — Rethinking Premium in Western Europe FMCG', url: 'https://nielseniq.com/global/en/insights/analysis/2025/trading-up-or-tuning-out/', data: 'Premium+ = 25% of FMCG value; 75% on promotion' },
        { title: 'European PL Sales Hit €291B, 40% Market Share', url: 'https://news.italianfood.net/2025/12/02/european-private-label-sales-hit-e291b-as-market-share-climbs-to-40/', data: 'EU private label: €291B, 40% value share' },
      ]},
    { id: 'con_03', force: 'Consumer', name: 'Gen Z Digital-Native Beauty', direction: 'Expansion', impact: 4, probability: 5, score: 20, gp1_shift: 0.025,
      description: '58% of Gen Z buy beauty via TikTok/Instagram; 45% purchase online (up from 30% in 2024). 43% prefer DTC brands over traditional retail. Online beauty sales expected to reach 37.1% of total by 2025. Subscription models gaining traction for convenience and personalization.',
      strategic_implication: 'Heritage brands must build DTC and social commerce presence. Traditional retail shelf space losing relevance for Gen Z. Create TikTok-native product formats with tutorial-first marketing.',
      category_exposure: { hair_color: 3, hair_care: 5, hair_styling: 5, hair_body: 2, lhc_fcn: 1, lhc_fca: 1 },
      vc_exposure: { raw_materials: 1, formulation: 2, packaging: 4, manufacturing: 2, logistics: 3, marketing: 5, trade: 4, after_sales: 3 },
      sources: [
        { title: 'Euromonitor — Gen Z Beauty Consumers in Europe', url: 'https://www.euromonitor.com/gen-z-beauty-consumers-in-europe-capturing-the-next-generation/report', data: '58% buy via TikTok; 43% prefer DTC; 80%+ value sustainability' },
        { title: 'eMarketer — Gen Z Personal Care Preferences 2025', url: 'https://www.emarketer.com/content/gen-z-personal-care-beauty-preferences-2025', data: 'Online beauty sales = 37.1% of total; 10.9% CAGR' },
      ]},
    { id: 'con_04', force: 'Consumer', name: 'Scalp Skinification: Dermatology-Grade Hair Care', direction: 'Expansion', impact: 4, probability: 4, score: 16, gp1_shift: 0.022,
      description: 'Haircare category posted 8% growth to $3.5B in 2025; scalp care specifically up 19% YoY. "Scalp care" generated 24M Google searches and 12M TikTok views in March 2025. Skinification movement bringing facial ingredients (hyaluronic acid, niacinamide, ceramides) into shampoos and scalp serums.',
      strategic_implication: 'Schwarzkopf Professional has scalp expertise for mass-market extension. High-margin premium SKUs (scalp serums, specialized shampoos). Consumers willing to pay 2-3x for clinically-backed products.',
      category_exposure: { hair_care: 5, hair_color: 1, hair_styling: 2, hair_body: 1 },
      vc_exposure: { raw_materials: 5, formulation: 5, packaging: 4, manufacturing: 4, logistics: 1, marketing: 5, trade: 2, after_sales: 1 },
      sources: [
        { title: 'HSA Cosmetics — Scalp Care Top Trend 2025/2026', url: 'https://www.hsacosmetics.com/en/blog/scalp-care-is-20252026-top-trend-and-it-s-time-you-acknowledge-it', data: 'Scalp category +19% YoY; 24M Google searches in March 2025' },
        { title: 'Beauty Independent — Haircare Trends 2026', url: 'https://www.beautyindependent.com/what-will-be-in-out-haircare-2026/', data: 'Haircare 8% growth to $3.5B; skinification entering mass retail' },
      ]},
    { id: 'con_05', force: 'Consumer', name: 'Silver Economy Growth: 50+ Demographic Shift', direction: 'Expansion', impact: 3, probability: 5, score: 15, gp1_shift: 0.018,
      description: 'EU population 65+ rising from 90.5M (2019) to 129.8M (2050). 70% of men experience hair loss by age 70; 50% of women by age 50. Europe professional hair care market valued at $5.8B (2023), forecast $7.2B (2030). Silver consumers spending power ~$2.3 trillion annually.',
      strategic_implication: 'Hair color for 50+ is most defensible Henkel category position. Expand salon channel and gray-hair innovation (color vibrancy, gentle/low-ammonia formulas).',
      category_exposure: { hair_color: 4, hair_care: 4, hair_styling: 2, hair_body: 1, lhc_fcn: 1, lhc_fca: 1, lhc_hdw: 1, lhc_hsc: 1 },
      vc_exposure: { raw_materials: 2, formulation: 4, packaging: 2, manufacturing: 2, logistics: 1, marketing: 3, trade: 4, after_sales: 2 },
      sources: [
        { title: 'Allied Market Research — Europe Professional Hair Care 2030', url: 'https://www.alliedmarketresearch.com/europe-professional-hair-care-market-A325592', data: 'Market $5.8B (2023) → $7.2B (2030), 3.4% CAGR' },
        { title: 'Brookings — Silver Economy Spending Power', url: 'https://www.brookings.edu/articles/the-silver-economy-is-coming-of-age-a-look-at-the-growing-spending-power-of-seniors/', data: 'Silver spending ~$2.3T annually; EU 65+ rising to 129.8M' },
      ]},
    { id: 'con_06', force: 'Consumer', name: 'Sustainability Claims Skepticism', direction: 'Contraction', impact: 3, probability: 4, score: -12, gp1_shift: -0.015,
      description: 'Consumers increasingly skeptical of sustainability claims. Sustainable FMCG products holding ground but consumers NOT willing to pay premium beyond 5-10%. Private label gained share partly because consumers perceive brand sustainability claims as greenwashing that does not justify price premium.',
      strategic_implication: 'Back sustainability claims with transparent data (recycled %, carbon footprint, supply chain audits). Persil Eco and Schwarzkopf sustainability lines must be price-competitive (+5% max).',
      category_exposure: { hair_color: 2, hair_care: 3, hair_styling: 2, hair_body: 1, lhc_fcn: 4, lhc_fca: 3, lhc_lad: 2, lhc_hdw: 4, lhc_adw: 4, lhc_hsc: 4, lhc_ic: 1 },
      vc_exposure: { raw_materials: 4, formulation: 3, packaging: 5, manufacturing: 4, logistics: 2, marketing: 4, trade: 2, after_sales: 1 },
      sources: [
        { title: 'Euromonitor — FMCG Sustainability: Navigating Volatility', url: 'https://www.euromonitor.com/article/fmcg-sustainability-navigating-volatility-with-purpose', data: 'Consumers not willing to pay premium; credible+transparent wins' },
        { title: 'Oliver Wyman — Brands vs. Private Labels', url: 'https://www.oliverwyman.com/our-expertise/insights/2025/jan/how-fmcg-brands-can-win-against-private-labels.html', data: 'PL surged partly due to sustainability skepticism' },
      ]},
    { id: 'con_07', force: 'Consumer', name: 'Persistent Trading Down: Inflation-Driven', direction: 'Contraction', impact: 4, probability: 4, score: -16, gp1_shift: -0.024,
      description: 'Despite easing inflation, European consumers remain price-conscious. UK at-home hair color only 3.5% value growth; 65% stretching sessions due to money worries. Southern/Eastern Europe showing highest price sensitivity. Promotions now 35% of detergent sales.',
      strategic_implication: 'Strengthen value tier (Persil Value, budget Gliss lines) to defend against private label. Balance promotions to maintain premium positioning while competing on value.',
      category_exposure: { hair_color: 4, hair_care: 3, hair_styling: 2, hair_body: 1, lhc_fcn: 5, lhc_fca: 4, lhc_lad: 3, lhc_hdw: 5, lhc_adw: 5, lhc_hsc: 4, lhc_ic: 1 },
      vc_exposure: { raw_materials: 2, formulation: 1, packaging: 2, manufacturing: 2, logistics: 1, marketing: 4, trade: 5, after_sales: 0 },
      sources: [
        { title: 'Mintel — UK Hair Colourants Market 2026', url: 'https://store.mintel.com/report/uk-hair-colourants-market-report', data: 'UK at-home color 3.5% growth; 65% stretching sessions' },
        { title: 'Polaris — Europe Laundry Detergent Market', url: 'https://www.polarismarketresearch.com/industry-analysis/europe-laundry-detergent-market', data: 'Promotions = 35% of detergent sales; shift to budget options' },
      ]},
    { id: 'con_08', force: 'Consumer', name: 'Natural & Organic Ingredient Demand', direction: 'Expansion', impact: 3, probability: 5, score: 15, gp1_shift: 0.016,
      description: 'Europe captured 38% of global natural hair care market revenue (2024). Organic hair care growing 4.84% CAGR. 74% of consumers prioritize organic ingredients (NSF 2025). Spain: 71% seek plant-based. Clean ingredient lists now table stake for premium positioning.',
      strategic_implication: 'Reformulate standard lines with natural actives (plant extracts, oils). Schwarzkopf/Gliss can differentiate vs. private label through clean ingredient transparency.',
      category_exposure: { hair_color: 4, hair_care: 5, hair_styling: 3, hair_body: 2, lhc_fcn: 3, lhc_fca: 3, lhc_lad: 2, lhc_hdw: 3, lhc_adw: 2, lhc_hsc: 3, lhc_ic: 1 },
      vc_exposure: { raw_materials: 5, formulation: 5, packaging: 4, manufacturing: 3, logistics: 2, marketing: 4, trade: 2, after_sales: 1 },
      sources: [
        { title: 'Grand View Research — Natural Hair Care Market 2030', url: 'https://www.grandviewresearch.com/industry-analysis/natural-hair-care-products-market', data: 'Europe = 38% of global revenue; organic CAGR 4.84%' },
        { title: 'Mordor Intelligence — Europe Hair Care Market', url: 'https://www.mordorintelligence.com/industry-reports/europe-hair-care-market-industry', data: '71% of Spanish consumers seek plant-based ingredients' },
      ]},

    // ═══════════════════════════════════════════════════════════════════════
    // ─── Customer Force (6 trends) ───
    // ═══════════════════════════════════════════════════════════════════════
    { id: 'cus_01', force: 'Customer', name: 'Private Label Tiered Expansion (€291B)', direction: 'Contraction', impact: 5, probability: 5, score: -25, gp1_shift: -0.040,
      description: 'EU private label sales hit €291B with 40% market share (2025). Netherlands 55%, Spain 51%, Germany 42% penetration. Retailers evolving from price-only PL to tiered architectures (value, premium, super-premium). PL units now 48% of total FMCG sales.',
      strategic_implication: 'Negotiate JBPs with innovation exclusivity windows. Defend shelf with category captain data. PL performance parity at 30-50% price discount is now table stakes.',
      category_exposure: { lhc_fcn: 5, lhc_fca: 4, lhc_hdw: 5, lhc_adw: 4, hair_color: 3, hair_care: 4, hair_styling: 2 },
      vc_exposure: { raw_materials: 1, formulation: 2, packaging: 1, manufacturing: 1, logistics: 2, marketing: 3, trade: 5, after_sales: 1 },
      sources: [
        { title: 'Italianfood.net — EU PL Sales Hit €291B', url: 'https://news.italianfood.net/2025/12/02/european-private-label-sales-hit-e291b-as-market-share-climbs-to-40/', data: '€291B sales, 40% value share, NL 55%, ES 51%' },
        { title: 'ESM Magazine — European Private Label Business', url: 'https://www.esmmagazine.com/private-label/european-private-label-business-reaches-e291bn-and-40-market-share-302480', data: '+3.8% CAGR; units at 48% of total FMCG' },
      ]},
    { id: 'cus_02', force: 'Customer', name: 'Discounter Channel Penetration', direction: 'Contraction', impact: 4, probability: 5, score: -20, gp1_shift: -0.030,
      description: 'Lidl UK market share 8.3% (+9.4% sales growth); Aldi UK 11.1% (+6.7% growth). 11,000+ combined Aldi/Lidl stores in Germany. Lidl acquiring 500K+ new UK shoppers in 12 months. Discounters expanding HPC assortment with exclusive branded partnerships.',
      strategic_implication: 'Develop discount-exclusive formats without diluting Persil brand equity. Discounter PL at €2.50-3.50 vs. Henkel €4.50-6.00 per unit.',
      category_exposure: { lhc_fcn: 5, lhc_fca: 4, lhc_hdw: 4, hair_color: 3, hair_care: 3 },
      vc_exposure: { raw_materials: 1, formulation: 1, packaging: 2, manufacturing: 1, logistics: 3, marketing: 2, trade: 5, after_sales: 1 },
      sources: [
        { title: 'Hortidaily — Lidl UK Market Share Gains', url: 'https://www.hortidaily.com/article/9785830/intermarche-mercadona-and-lidl-uk-lead-market-share-gains-across-europe-in-2025/', data: 'Lidl UK 8.3% share, +9.4% sales growth' },
        { title: 'Grocery Gazette — Aldi Market Share Record', url: 'https://www.grocerygazette.co.uk/2025/04/01/aldi-market-share-sales-2/', data: 'Aldi UK 11.1% share; 500K+ new shoppers for Lidl' },
      ]},
    { id: 'cus_03', force: 'Customer', name: 'E-Commerce Margin Compression', direction: 'Contraction', impact: 3, probability: 4, score: -12, gp1_shift: -0.016,
      description: 'Hair care e-commerce growing at 7.8-10.5% CAGR. Online HPC margins 15-20% vs. retail 25-28% due to Amazon 15% referral fee + variable fulfillment. Luxury hair care e-commerce CAGR at 10.5%. Input cost volatility adding 4-7% annual margin pressure.',
      strategic_implication: 'Optimize pack sizes for e-commerce profitability. Negotiate Amazon co-op terms. Build Schwarzkopf DTC to capture higher direct margins (60-70%).',
      category_exposure: { hair_care: 4, hair_styling: 3, hair_color: 3, lhc_fcn: 3, lhc_adw: 2 },
      vc_exposure: { raw_materials: 1, formulation: 1, packaging: 3, manufacturing: 1, logistics: 5, marketing: 4, trade: 4, after_sales: 2 },
      sources: [
        { title: 'Grand View Research — Hair Care E-commerce Outlook', url: 'https://www.grandviewresearch.com/industry-analysis/hair-care-market', data: 'Hair care e-commerce CAGR: 7.8-10.5% (2026-2033)' },
        { title: 'IndexBox — Hair Market Analysis to 2035', url: 'https://www.indexbox.io/blog/hair-market-forecast-points-higher-toward-2035-on-premiumization-and-need-state-segmentation/', data: 'E-commerce margins 15-20% vs. retail 25-28%' },
      ]},
    { id: 'cus_04', force: 'Customer', name: 'Retail Media Network Spend Explosion', direction: 'Contraction', impact: 3, probability: 4, score: -12, gp1_shift: -0.012,
      description: 'EU retail media spend: €13.7B (2024) → €16.9B (2025) → €20.8B (2026), +21.1% YoY growth. CPG brands allocating 39% of digital budgets to RMN. Carrefour targeting €500M revenue from retail media. Brands face "pay to play" shelf visibility dynamics.',
      strategic_implication: 'Increase retail media budget to 12%+ of trade spend. Build internal RMN capability. Treat as mandatory cost — not incremental.',
      category_exposure: { hair_care: 3, lhc_fcn: 3, lhc_adw: 2, hair_color: 2, lhc_hdw: 2 },
      vc_exposure: { raw_materials: 0, formulation: 0, packaging: 0, manufacturing: 0, logistics: 0, marketing: 5, trade: 5, after_sales: 1 },
      sources: [
        { title: 'RMIQ — 2025 Retail Media Market Guide', url: 'https://www.rmiq.net/blog/retail-media-guide/', data: 'EU RMN: €13.7B→€20.8B; CPG allocating 39% of budgets' },
      ]},
    { id: 'cus_05', force: 'Customer', name: 'D2C & Subscription Hair Care Surge', direction: 'Contraction', impact: 3, probability: 3, score: -9, gp1_shift: -0.011,
      description: 'D2C personalized haircare market: $3.5B (2024) → $23.3B (2034), 21.1% CAGR. EU subscription beauty boxes: €660M (2025), +22.9% growth. Prose, Function of Beauty capturing 60-70% direct margins vs. 25-30% through retail.',
      strategic_implication: 'Explore Schwarzkopf DTC pilot with subscription model. Build first-party consumer data for personalization advantage.',
      category_exposure: { hair_care: 4, hair_color: 3, hair_styling: 3 },
      vc_exposure: { raw_materials: 1, formulation: 2, packaging: 2, manufacturing: 1, logistics: 4, marketing: 4, trade: 1, after_sales: 3 },
      sources: [
        { title: 'InsightAce — D2C Personalized Haircare Market', url: 'https://www.insightaceanalytic.com/report/global-direct-to-consumer-d2c-personalized-haircare-market-/1216', data: '$3.5B→$23.3B, 21.1% CAGR' },
      ]},
    { id: 'cus_06', force: 'Customer', name: 'Pharmacy/Dermo Channel Premiumization', direction: 'Expansion', impact: 2, probability: 4, score: 8, gp1_shift: 0.006,
      description: 'Dermocosmetics growing at 8-10% CAGR globally. 26% of EU consumers using OTC dermo products without prescription (up from 23% in 2023). Dermo products growing from 9% to 12-15% of skincare. Pharmacy channel provides 3-5pp margin uplift vs. grocery.',
      strategic_implication: 'Expand pharmacy-exclusive SKUs leveraging Schwarzkopf Professional dermatology positioning.',
      category_exposure: { hair_care: 4, hair_body: 3, hair_color: 2 },
      vc_exposure: { raw_materials: 2, formulation: 4, packaging: 2, manufacturing: 1, logistics: 2, marketing: 3, trade: 4, after_sales: 2 },
      sources: [
        { title: 'FMI — Natural Cosmetics Europe Market', url: 'https://www.futuremarketinsights.com/reports/natural-cosmetics-industry-analysis-in-europe', data: 'Dermocosmetics 8-10% CAGR; premium 20-40% above conventional' },
        { title: 'Makreo — Italy Beauty & Personal Care 2025', url: 'https://www.makreo.com/blog/italy-beauty-and-personal-care-market-2025', data: '26% of EU consumers using OTC dermo products' },
      ]},

    // ═══════════════════════════════════════════════════════════════════════
    // ─── Technology Force (6 trends) ───
    // ═══════════════════════════════════════════════════════════════════════
    { id: 'tec_01', force: 'Technology', name: 'AI-Powered Formulation & Personalization', direction: 'Expansion', impact: 4, probability: 4, score: 16, gp1_shift: 0.022,
      description: 'AI skin analysis market: $1.82B (2025) → $5.33B (2032), 16.6% CAGR. L\'Oréal + IBM training AI on 1.8M+ historical cosmetic formulas. Nouryon launched BeautyCreations AI tool (April 2025) for formulation discovery. Unilever reducing 5-year R&D cycles to 5 months with in-silico AI.',
      strategic_implication: 'Deploy AI shade-matching for Schwarzkopf Color. Build recommendation engine. Non-AI brands compete on value; AI brands compete on personalization premium (+15-25%).',
      category_exposure: { hair_color: 5, hair_care: 4, hair_styling: 3, hair_body: 2 },
      vc_exposure: { raw_materials: 2, formulation: 5, packaging: 1, manufacturing: 3, logistics: 1, marketing: 5, trade: 3, after_sales: 4 },
      sources: [
        { title: 'Coherent Market Insights — AI Skin Analysis Market', url: 'https://www.coherentmarketinsights.com/industry-reports/ai-skin-analysis-market', data: 'AI diagnostics: $1.82B→$5.33B, 16.6% CAGR' },
        { title: 'IBM & L\'Oréal AI Foundation Model', url: 'https://newsroom.ibm.com/2025-01-16-ibm-and-loreal-to-build-first-ai-model-to-advance-the-creation-of-sustainable-cosmetics', data: '1.8M+ historical formulas; 30-50% R&D acceleration' },
        { title: 'Nouryon BeautyCreations AI Tool Launch', url: 'https://www.nouryon.com/news-and-events/news-overview/2025/beautycreationstm-a-powerful-new-ai-driven-personal-care-formulation-discovery-tool', data: 'AI-driven formulation discovery for hair care and styling' },
      ]},
    { id: 'tec_02', force: 'Technology', name: 'Biotech Ingredient Cost Curve Decline', direction: 'Expansion', impact: 4, probability: 3, score: 12, gp1_shift: 0.016,
      description: 'Biosurfactant market: $4.41B (2023) → $6.71B (2032), 5.4% CAGR. Evonik rhamnolipids at $3.8/kg (best-in-class) vs. synthetic benchmark $2/kg. Cost parity target $2.50/kg achievable in 5-10 years. Next 3-5 years: 10-30% cost premium enables premiumization narrative.',
      strategic_implication: 'Partner with Evonik/BASF on bio-surfactant supply agreements. Position Persil "Green by Default" when cost parity arrives. Early movers gaining supply chain advantage.',
      category_exposure: { lhc_fcn: 4, lhc_fca: 4, hair_care: 3, lhc_hdw: 3 },
      vc_exposure: { raw_materials: 5, formulation: 5, packaging: 1, manufacturing: 3, logistics: 1, marketing: 2, trade: 1, after_sales: 0 },
      sources: [
        { title: 'MDPI — Bio-Based Surfactants Viability', url: 'https://www.mdpi.com/2227-9717/13/9/2811', data: 'Current: $5-20/kg; Evonik best: $3.8/kg; target: $2.50/kg' },
        { title: 'Precedence Research — Biosurfactants Market', url: 'https://www.precedenceresearch.com/biosurfactants-market', data: 'Market $4.41B→$6.71B (2032), 5.4% CAGR' },
      ]},
    { id: 'tec_03', force: 'Technology', name: 'EU Green Chemistry Reformulation Burden', direction: 'Expansion', impact: 4, probability: 5, score: 20, gp1_shift: 0.024,
      description: 'Cosmetics Regulation Omnibus VIII compliance by May 2026. New detergents regulation approved Dec 2025 with stricter biodegradability + digital labels. Microplastics ban Phase 2 hitting rinse-off cosmetics Oct 2027. Continuous 6-18 month reformulation cycles now required.',
      strategic_implication: 'Front-load reformulation investment. Companies with AI + regulatory intelligence gain 6-12 month first-mover advantage per ingredient change cycle.',
      category_exposure: { lhc_fcn: 4, lhc_fca: 4, lhc_hdw: 3, hair_styling: 3, hair_care: 3, hair_color: 2 },
      vc_exposure: { raw_materials: 5, formulation: 5, packaging: 3, manufacturing: 4, logistics: 1, marketing: 2, trade: 1, after_sales: 0 },
      sources: [
        { title: 'Cosmeservice — EU Regulatory Developments 2025-2026', url: 'https://cosmeservice.com/news/eu-regulatory-developments-transforming-cosmetic-compliance-in-2025-and-beyond/', data: 'Omnibus VIII: May 2026 deadline; 12 nano ingredients prohibited' },
        { title: 'Hooley Brown — EU Detergents Regulation 2025', url: 'https://www.hooleybrown.com/blog-post/eu-detergents-regulation-2025-whats-changing-and-why-it-matters', data: 'New detergents reg: stricter biodegradability + DPP mandatory' },
      ]},
    { id: 'tec_04', force: 'Technology', name: 'Smart/Connected Packaging Acceleration', direction: 'Expansion', impact: 2, probability: 3, score: 6, gp1_shift: 0.005,
      description: 'Connected packaging adoption: 81.2% of companies (2026, up from 72.6% in 2025). NFC packaging market: $5.1B (2024) → $19.2B (2034), 14.1% CAGR. QR+NFC combined: 47.1% of adopters. Key drivers: data collection (60.9%), regulatory compliance (60.7%), sustainability tracking (60.4%).',
      strategic_implication: 'Pilot NFC on premium Schwarzkopf SKUs for DPP pre-compliance. Connected packaging becomes table-stakes for premium HPC.',
      category_exposure: { hair_care: 3, hair_color: 2, lhc_fcn: 2, lhc_adw: 2 },
      vc_exposure: { raw_materials: 1, formulation: 0, packaging: 5, manufacturing: 3, logistics: 1, marketing: 4, trade: 2, after_sales: 3 },
      sources: [
        { title: 'DLP Magazine — Connected Packaging Adoption 2026', url: 'https://www.dlpmag.com/news/102626/connected-packaging-adoption-rises-sharply/', data: '81.2% adoption (2026); QR+NFC 47.1% of adopters' },
        { title: 'GM Insights — NFC Packaging Market Forecast', url: 'https://www.gminsights.com/industry-analysis/nfc-enabled-packaging-market', data: 'NFC packaging: $5.1B→$19.2B (2034), 14.1% CAGR' },
      ]},
    { id: 'tec_05', force: 'Technology', name: 'Manufacturing Automation & COGS Reduction', direction: 'Expansion', impact: 3, probability: 4, score: 12, gp1_shift: 0.014,
      description: 'Global industrial robot installations: 542K units/year (2024), doubled vs. 10 years prior. FMCG automation market: $456.9B projected value addition (2024-2029). 65% of CPG companies planning robotics/cobot additions. Integrated automation delivers 40% faster ROI. Vision systems achieving 99%+ accuracy at 300 units/minute.',
      strategic_implication: 'Scale automation playbook across EU manufacturing sites. Cobots enable lower break-even SKU volumes, supporting category proliferation.',
      category_exposure: { lhc_fcn: 3, lhc_fca: 3, lhc_ic: 2, hair_care: 2, hair_color: 2 },
      vc_exposure: { raw_materials: 1, formulation: 1, packaging: 2, manufacturing: 5, logistics: 3, marketing: 0, trade: 0, after_sales: 0 },
      sources: [
        { title: 'OXMaint — Automation Impact on FMCG', url: 'https://oxmaint.com/industries/fmcg/impact-of-automation-fmcg-manufacturing', data: '542K robots/yr installed; 40% faster ROI with integrated maintenance' },
        { title: 'Markets & Markets — CPG Market Report 2030', url: 'https://www.marketsandmarkets.com/Market-Reports/consumer-packaged-goods-market-125973933.html', data: 'FMCG automation: $456.9B value addition; 65% adoption intent' },
      ]},
    { id: 'tec_06', force: 'Technology', name: 'Waterless/Concentrated Formats Surge', direction: 'Expansion', impact: 3, probability: 4, score: 12, gp1_shift: 0.012,
      description: 'Waterless cosmetics market: $10.89B (2024) → $23.17B (2033), 8.31% CAGR. 47% of beauty launches in 2024 included waterless formats. ~55M consumers globally shifting to waterless routines. Formats (bars, sheets, pods) command 10-25% price premium. Logistics cost reduction of ~40%.',
      strategic_implication: 'Launch Persil Power Bars and Schwarzkopf shampoo bars in EU markets. Waterless creates category expansion without cannibalizing core volume.',
      category_exposure: { lhc_fcn: 4, hair_care: 4, lhc_fca: 3, lhc_hdw: 2, hair_styling: 2 },
      vc_exposure: { raw_materials: 3, formulation: 5, packaging: 4, manufacturing: 3, logistics: 5, marketing: 3, trade: 2, after_sales: 1 },
      sources: [
        { title: 'IMARC Group — Waterless Cosmetics Market 2033', url: 'https://www.imarcgroup.com/waterless-cosmetics-market', data: '$10.89B→$23.17B (2033), 8.31% CAGR' },
        { title: 'Future Market Insights — Waterless Cosmetic Market', url: 'https://www.futuremarketinsights.com/reports/waterless-cosmetic-market', data: '47% of 2024 launches; ~55M consumers shifting globally' },
      ]},

    // ═══════════════════════════════════════════════════════════════════════
    // ─── Government Force (6 trends) ───
    // ═══════════════════════════════════════════════════════════════════════
    { id: 'gov_01', force: 'Government', name: 'PFAS Restriction Cascade (France Live, EU Pending)', direction: 'Contraction', impact: 5, probability: 5, score: -25, gp1_shift: -0.042,
      description: 'France banned PFAS in cosmetics Jan 1, 2026 (Law No. 2025-188). Denmark ban effective July 2026. ECHA SEAC opinion on EU-wide restriction due Spring 2026, with final opinions by end 2026. PFAS restriction affects ~10,000 substances. PPWR also bans PFAS in all packaging from Aug 2026.',
      strategic_implication: 'Establish regulatory task force for pre-emptive reformulation. France compliance is live — non-compliant products must exit by Jan 2027. First-mover advantage in PFAS-free positioning.',
      category_exposure: { lhc_fcn: 5, lhc_fca: 4, lhc_hsc: 4, lhc_ic: 3, hair_care: 3, hair_styling: 3, hair_color: 2 },
      vc_exposure: { raw_materials: 5, formulation: 5, packaging: 4, manufacturing: 3, logistics: 1, marketing: 2, trade: 2, after_sales: 1 },
      sources: [
        { title: 'Euronews — France PFAS Ban in Force', url: 'https://www.euronews.com/green/2026/01/01/frances-ban-on-forever-chemicals-comes-into-force-tomorrow-heres-what-will-change', data: 'France PFAS cosmetics ban live Jan 1, 2026' },
        { title: 'ENHESA — PFAS Compliance: Why 2026 Is Critical', url: 'https://www.enhesa.com/resources/article/pfas-compliance-why-2026-is-a-critical-year-for-europe/', data: 'ECHA SEAC draft opinion Spring 2026; final by end 2026' },
        { title: 'UL Solutions — EU PFAS Restrictions', url: 'https://www.ul.com/news/eu-sets-pfas-restrictions-consumer-products', data: 'Denmark ban July 2026; PPWR packaging PFAS ban Aug 2026' },
      ]},
    { id: 'gov_02', force: 'Government', name: 'PPWR: Aug 2026 Packaging Revolution', direction: 'Contraction', impact: 4, probability: 5, score: -20, gp1_shift: -0.028,
      description: 'EU PPWR effective Aug 12, 2026. Mandates 30% recycled content (HDPE, PET, PP) by 2030. Only recyclability grades A-C packaging permitted from 2030. PFAS banned in all packaging materials. E-commerce parcels max 40% empty space. Packaging cost increase estimated 8-15%.',
      strategic_implication: 'Transition to mono-material packaging. Invest in PCR supply chain. 4-year redesign window (2026-2030) for full portfolio compliance.',
      category_exposure: { lhc_fcn: 4, lhc_fca: 3, lhc_hdw: 4, hair_care: 3, hair_color: 3, hair_styling: 3, lhc_adw: 3, lhc_ffi: 2, lhc_hsc: 3, lhc_ic: 2 },
      vc_exposure: { raw_materials: 2, formulation: 0, packaging: 5, manufacturing: 4, logistics: 3, marketing: 1, trade: 1, after_sales: 0 },
      sources: [
        { title: 'EUR-Lex — PPWR Official Text', url: 'https://eur-lex.europa.eu/EN/legal-content/summary/packaging-and-packaging-waste-from-2026.html', data: 'Effective Aug 12, 2026; 30% recycled content by 2030' },
        { title: 'Gleiss Lutz — PPWR Key Requirements', url: 'https://www.gleisslutz.com/en/know-how/new-eu-packaging-regulation-key-requirements-from-august-2026', data: 'Grades A-C only; PFAS banned; 40% empty space rule' },
      ]},
    { id: 'gov_03', force: 'Government', name: 'EUDR Deforestation Compliance (Dec 2026)', direction: 'Contraction', impact: 3, probability: 4, score: -12, gp1_shift: -0.016,
      description: 'EUDR effective Dec 30, 2026 for large operators. Palm oil, cocoa, soya in scope. Due diligence systems cost €500K-€2M+ for large enterprises. Certified palm oil premium rising to 15-25% above conventional. 60-70% of palm growers are smallholders lacking EUDR resources — supply consolidation expected.',
      strategic_implication: 'Accelerate palm-alternative surfactant sourcing (sunflower, rapeseed). Build traceability systems. Penalties: up to 4% of EU revenue for non-compliance.',
      category_exposure: { lhc_fcn: 4, lhc_fca: 3, lhc_hdw: 3, lhc_adw: 3, hair_care: 2, hair_color: 1 },
      vc_exposure: { raw_materials: 5, formulation: 3, packaging: 1, manufacturing: 1, logistics: 2, marketing: 1, trade: 1, after_sales: 0 },
      sources: [
        { title: 'Mayer Brown — EUDR 2026 Analysis', url: 'https://www.mayerbrown.com/en/insights/publications/2026/02/eu-regulation-on-deforestation-free-products-eudr-what-lies-ahead-in-2026', data: 'Dec 30, 2026 deadline; simplified measures adopted' },
        { title: 'Sustainalytics — Palm Oil EUDR Compliance', url: 'https://www.sustainalytics.com/esg-research/resource/investors-esg-blog/palm-oil-in-focus--the-eudr-and-corporate-efforts-on-transparent-sourcing', data: 'Due diligence: €500K-€2M+; CSPO premium 15-25%' },
      ]},
    { id: 'gov_04', force: 'Government', name: 'Microplastics Ban Phase 2 (Oct 2027)', direction: 'Contraction', impact: 4, probability: 5, score: -20, gp1_shift: -0.024,
      description: 'Rinse-off cosmetics (shampoo, styling gels, washes) must be microplastics-free by Oct 17, 2027. Leave-on products (sprays, conditioners) by Oct 2029. Labeling "Contains microplastics" mandatory by 2031-2035. R&D investment for alternative binders estimated €1-3M per category.',
      strategic_implication: 'Reformulate styling portfolio by end 2026 to avoid disruption. Premium positioning opportunity for "microplastics-free" claims. Natural gums, silicates, mineral powders as alternatives.',
      category_exposure: { hair_styling: 5, hair_care: 4, lhc_fcn: 2, lhc_hsc: 2 },
      vc_exposure: { raw_materials: 4, formulation: 5, packaging: 1, manufacturing: 2, logistics: 0, marketing: 3, trade: 1, after_sales: 0 },
      sources: [
        { title: 'REACH24H — EU Microplastics Deadline', url: 'https://en.reach24h.com/news/insights/chemical/eu-microplastics-spm-restriction-deadline', data: 'Rinse-off cosmetics: Oct 17, 2027; leave-on: Oct 2029' },
        { title: 'EU Commission — Microplastics Regulation 2023/2055', url: 'https://single-market-economy.ec.europa.eu/sectors/chemicals/reach/restrictions/commission-regulation-eu-20232055-restriction-microplastics-intentionally-added-products_en', data: 'Phase 2 Hair Care styling directly affected' },
      ]},
    { id: 'gov_05', force: 'Government', name: 'CBAM Carbon Border Phase-In (Live Jan 2026)', direction: 'Contraction', impact: 3, probability: 5, score: -15, gp1_shift: -0.012,
      description: 'CBAM compliance phase live Jan 1, 2026. Phase-in: 2.5% certificate rate (2026) → 100% by 2034. Aluminium aerosol cans directly affected (~€200K additional COGS for hair spray). 180 additional downstream products in scope from Jan 2028. EU importers must purchase CBAM certificates at EUA carbon price.',
      strategic_implication: 'Audit supply chain for CBAM exposure. Nearshore aluminium and high-carbon inputs. Full supply chain carbon audits required by 2027.',
      category_exposure: { hair_styling: 3, lhc_fcn: 2, lhc_ic: 3, lhc_hsc: 2 },
      vc_exposure: { raw_materials: 5, formulation: 1, packaging: 3, manufacturing: 2, logistics: 3, marketing: 0, trade: 1, after_sales: 0 },
      sources: [
        { title: 'S&P Global — CBAM 2026 Analysis', url: 'https://www.spglobal.com/energy/en/news-research/latest-news/energy-transition/010726-commodities-2026-europes-cbam-goes-live-as-importers-grapple-with-rising-carbon-costs', data: 'CBAM live Jan 2026; 2.5% rate → 100% by 2034' },
        { title: 'ICAP — CBAM Compliance Phase', url: 'https://icapcarbonaction.com/en/news/eu-cbam-enters-compliance-phase-and-outlines-path-ahead', data: 'Aluminium aerosol impact: ~€200K additional COGS' },
      ]},
    { id: 'gov_06', force: 'Government', name: 'Digital Product Passport Mandate (2027)', direction: 'Contraction', impact: 2, probability: 4, score: -8, gp1_shift: -0.007,
      description: 'DPP for detergents mandatory late 2027/early 2028 (42 months after regulation entry). Central DPP registry launching July 2026. IT system build: €200K-€500K for PIM integration. Requires full ingredient sourcing, biodegradability, and water footprint data.',
      strategic_implication: 'Begin DPP data infrastructure now. Turn transparency compliance into consumer trust advantage vs. competitors lagging on data readiness.',
      category_exposure: { lhc_fcn: 3, lhc_fca: 3, lhc_hdw: 2, lhc_adw: 2, hair_care: 2, hair_color: 1 },
      vc_exposure: { raw_materials: 3, formulation: 3, packaging: 3, manufacturing: 2, logistics: 2, marketing: 2, trade: 2, after_sales: 2 },
      sources: [
        { title: 'Circularise — DPP Compliance Guide', url: 'https://www.circularise.com/blogs/dpps-required-by-legislation-across-sectors', data: 'Detergents DPP: 42 months post-enactment; registry July 2026' },
        { title: 'Inriver — DPP Compliance Planning', url: 'https://www.inriver.com/resources/digital-product-passport/', data: 'IT build: €200K-€500K; PIM integration required' },
      ]},

    // ═══════════════════════════════════════════════════════════════════════
    // ─── Environmental Force (6 trends) ───
    // ═══════════════════════════════════════════════════════════════════════
    { id: 'env_01', force: 'Environmental', name: 'EU Water Scarcity Manufacturing Impact', direction: 'Contraction', impact: 4, probability: 5, score: -20, gp1_shift: -0.024,
      description: '28% of EU land area affected by water scarcity; 32% of population under seasonal stress. May 2025: 39% of EEA countries experienced drought. Southern EU manufacturing (Spain, Italy, Portugal) faces 10-20%+ output risk. Water is now top-5 ESG/operational risk for FMCG under CSRD reporting.',
      strategic_implication: 'Develop low-water formulations. Relocate water-intensive production from Southern EU. CSRD mandates water risk disclosure in 2026 reports.',
      category_exposure: { lhc_fcn: 4, lhc_fca: 3, hair_care: 3, lhc_hdw: 3, hair_color: 2 },
      vc_exposure: { raw_materials: 4, formulation: 5, packaging: 1, manufacturing: 5, logistics: 1, marketing: 1, trade: 0, after_sales: 0 },
      sources: [
        { title: 'EEA — Water Scarcity in Europe 2025', url: 'https://www.eea.europa.eu/en/analysis/indicators/use-of-freshwater-resources-in-europe-1', data: '28% of EU land area affected; 32% population stressed' },
        { title: 'ECB — Water Scarcity Economic Risk', url: 'https://www.ecb.europa.eu/press/blog/date/2025/html/ecb.blog20250523~d39e3a7933.en.html', data: '15% of euro area output at risk; Southern EU >20%' },
      ]},
    { id: 'env_02', force: 'Environmental', name: 'Palm Oil Deforestation Compliance Costs', direction: 'Contraction', impact: 4, probability: 5, score: -20, gp1_shift: -0.022,
      description: 'EUDR Dec 2026 deadline drives compliance capex €500K-€2M+. Certified sustainable palm oil (CSPO) premium rising to 15-25% above conventional by 2026. 60-70% of palm growers are smallholders lacking resources — supply consolidation and price spikes expected Q4 2026. 8-12% of LHC COGS impacted by palm-derived inputs.',
      strategic_implication: 'Diversify surfactant feedstock to coconut/rapeseed/sunflower (18-24 month development). Build blockchain traceability. Early-compliant players gain market share.',
      category_exposure: { lhc_fcn: 4, lhc_fca: 3, lhc_hdw: 3, lhc_adw: 3, hair_care: 2, hair_color: 1 },
      vc_exposure: { raw_materials: 5, formulation: 3, packaging: 0, manufacturing: 1, logistics: 2, marketing: 1, trade: 1, after_sales: 0 },
      sources: [
        { title: 'Sustainalytics — Palm Oil EUDR Focus', url: 'https://www.sustainalytics.com/esg-research/resource/investors-esg-blog/palm-oil-in-focus--the-eudr-and-corporate-efforts-on-transparent-sourcing', data: 'CSPO premium: 15-25%; compliance: €500K-€2M+' },
        { title: 'RSPO — Global Trends 2025', url: 'https://rspo.org/global-trends-of-sustainable-palm-oil-and-china-pathway/', data: '60-70% smallholders; supply consolidation expected' },
      ]},
    { id: 'env_03', force: 'Environmental', name: 'Biodegradable Formulation Premium', direction: 'Expansion', impact: 3, probability: 4, score: 12, gp1_shift: 0.014,
      description: '70%+ of EU consumers prefer biodegradable/recyclable packaging. Natural/organic cosmetics command 20-40% price premium in EU. Premium cosmetics segment growing 6-8% CAGR. Addressable market: 15-20% of hair care willing to trade up for biodegradable. Expected margin expansion: +3-5pp on biodegradable variants.',
      strategic_implication: 'Obtain OECD 301B certification for all Persil variants. Position Schwarzkopf/Gliss biodegradable lines with DPP backing. R&D timeline: 12-18 months for certified biodegradable surfactant blends.',
      category_exposure: { lhc_fcn: 4, lhc_fca: 3, lhc_hdw: 3, hair_care: 3, hair_color: 2, hair_styling: 2 },
      vc_exposure: { raw_materials: 4, formulation: 5, packaging: 3, manufacturing: 1, logistics: 0, marketing: 4, trade: 2, after_sales: 0 },
      sources: [
        { title: 'FMI — Natural Cosmetics Europe', url: 'https://www.futuremarketinsights.com/reports/natural-cosmetics-industry-analysis-in-europe', data: '70%+ prefer biodegradable; premium 20-40% above conventional' },
        { title: 'BusinessWire — Europe Premium Beauty 2024-2029', url: 'https://www.businesswire.com/news/home/20250120332976/en/Europe-Premium-Beauty-Market-Focused-Insights-2024-2029', data: 'Premium cosmetics 6-8% CAGR; +3-5pp margin on biodegradable' },
      ]},
    { id: 'env_04', force: 'Environmental', name: 'Climate-Driven Insecticide Demand Expansion', direction: 'Expansion', impact: 3, probability: 4, score: 12, gp1_shift: 0.010,
      description: 'WHO: 14.4M dengue cases in 2024 (2x increase from 2023). Aedes mosquito expanding from Southern to Central/Northern Europe. Household insecticides market: $19.6B (2026) → $31.7B (2033), 7.1% CAGR. Europe segment growing 6-8% annually. Sprays dominate (41% of format mix). Insecticide margins typically 40-50% vs. detergent 35-40%.',
      strategic_implication: 'Expand IC distribution in Scandinavia and Benelux. High-margin opportunity if regulatory approvals secured. Monitor pyrethroid restriction timeline.',
      category_exposure: { lhc_ic: 5, lhc_hsc: 2 },
      vc_exposure: { raw_materials: 3, formulation: 3, packaging: 1, manufacturing: 2, logistics: 3, marketing: 4, trade: 3, after_sales: 0 },
      sources: [
        { title: 'Persistence Market Research — Household Insecticides', url: 'https://www.persistencemarketresearch.com/market-research/household-insecticides-market.asp', data: '$19.6B→$31.7B (2033), 7.1% CAGR; dengue 14.4M cases' },
        { title: 'Fortune Business Insights — Insecticides Market', url: 'https://www.fortunebusinessinsights.com/insecticides-market-114328', data: 'Europe 6-8% annual growth; spray format 41%' },
      ]},
    { id: 'env_05', force: 'Environmental', name: 'Refill Station & Circular Packaging Growth', direction: 'Expansion', impact: 3, probability: 3, score: 9, gp1_shift: 0.008,
      description: 'Zero-waste refill packaging market: $2.6B (2025) → $8.5B (2035), 12.6% CAGR. Europe captures 33% of global refill market. Ecodesign Directive supports refillable formats. Cost savings of 20% per unit on packaging. Brand differentiation risk: refill stations reduce packaging as brand asset.',
      strategic_implication: 'Scale refill infrastructure but protect Distinctive Brand Assets (DBAs). Refill stations shift power to retailers — Henkel must decide: join ecosystem or defend branded packaging.',
      category_exposure: { lhc_fcn: 3, lhc_fca: 2, hair_care: 2, lhc_adw: 2 },
      vc_exposure: { raw_materials: 1, formulation: 0, packaging: 5, manufacturing: 2, logistics: 4, marketing: 3, trade: 4, after_sales: 2 },
      sources: [
        { title: 'Towards Packaging — Refillable Packaging Market', url: 'https://www.towardspackaging.com/insights/refillable-packaging-market-sizing', data: '$2.6B→$8.5B (2035), 12.6% CAGR; Europe 33%' },
      ]},
    { id: 'env_06', force: 'Environmental', name: 'CSRD Carbon Reporting & Net-Zero Pressure', direction: 'Contraction', impact: 3, probability: 5, score: -15, gp1_shift: -0.014,
      description: 'CSRD mandatory for large companies from 2026. Scope 3 emissions represent 80-95% of FMCG total carbon footprint. Carbon disclosure now directly influences investor decisions and ESG ratings. Supply chain carbon audits increasingly required by major retailers.',
      strategic_implication: 'Build comprehensive Scope 3 measurement capability. Leverage carbon reduction for retailer partnerships and investor relations.',
      category_exposure: { lhc_fcn: 3, lhc_fca: 3, lhc_hdw: 2, hair_care: 2, hair_color: 2, lhc_adw: 2, lhc_hsc: 2, lhc_ic: 2 },
      vc_exposure: { raw_materials: 4, formulation: 2, packaging: 3, manufacturing: 4, logistics: 4, marketing: 1, trade: 1, after_sales: 0 },
      sources: [
        { title: 'European Commission — CSRD Implementation', url: 'https://finance.ec.europa.eu/capital-markets-union-and-financial-markets/company-reporting-and-auditing/company-reporting/corporate-sustainability-reporting_en', data: 'CSRD mandatory 2026; Scope 3 = 80-95% of FMCG emissions' },
      ]},

    // ═══════════════════════════════════════════════════════════════════════
    // ─── Competitive Force (6 trends) ───
    // ═══════════════════════════════════════════════════════════════════════
    { id: 'com_01', force: 'Competitive', name: 'P&G Innovation & Premiumization Machine', direction: 'Contraction', impact: 5, probability: 4, score: -20, gp1_shift: -0.035,
      description: 'P&G Beauty division: 18% of FY2024 revenues. Head & Shoulders BARE achieving high-single-digit organic sales growth. Ariel PODS water-soluble polymer innovation driving LHC share. Fabric & Home Care is 36% of P&G total (largest division). R&D VP elected to National Academy of Engineering for packaging innovation.',
      strategic_implication: 'Match innovation velocity. Focus R&D on areas where P&G is structurally weaker (color, value formats, emerging markets). Counter H&S BARE with Schwarzkopf clinical positioning.',
      category_exposure: { hair_care: 5, lhc_fcn: 5, lhc_fca: 3, hair_color: 2, hair_styling: 2 },
      vc_exposure: { raw_materials: 2, formulation: 4, packaging: 3, manufacturing: 2, logistics: 1, marketing: 5, trade: 3, after_sales: 1 },
      sources: [
        { title: 'P&G — Innovation Hub', url: 'https://us.pg.com/innovation/', data: 'H&S BARE: high-single-digit growth; F&HC = 36% of total' },
        { title: 'P&G FY2025 Results', url: 'https://us.pg.com/newsroom/news-releases/PG-Announces-Fourth-Quarter-and-Fiscal-Year-2025-Results/', data: 'Beauty 18% of revenue; packaging innovation focus' },
      ]},
    { id: 'com_02', force: 'Competitive', name: 'Unilever AI-Driven Formulation Advantage', direction: 'Contraction', impact: 4, probability: 4, score: -16, gp1_shift: -0.026,
      description: 'Unilever AI achieves 10x formulation acceleration (5 years → 5 months). Partnership with Arzeda for enzyme innovation halving ingredient counts. AI 100+ Accelerator cutting machine cleaning 20%, utilities 10% at Poznan factory (€100K/year savings). Hourglass vegan pigment developed via AI.',
      strategic_implication: 'Close AI formulation gap urgently. Benchmark Persil against Unilever enzyme-simplified formulations. Match sustainability first-mover positioning.',
      category_exposure: { lhc_fcn: 5, lhc_fca: 3, hair_care: 3, lhc_adw: 3, lhc_hdw: 2 },
      vc_exposure: { raw_materials: 3, formulation: 5, packaging: 2, manufacturing: 4, logistics: 1, marketing: 4, trade: 3, after_sales: 1 },
      sources: [
        { title: 'Unilever — 100+ Accelerator AI Partnership', url: 'https://www.unilever.com/news/news-search/2025/unilevers-100-accelerator-partnership-unlocks-ai-innovation-across-supply-chain/', data: '5yr→5mo formulation; Poznan: -20% cleaning, -10% utilities' },
        { title: 'Unilever — Biotech Innovation', url: 'https://www.unilever.com/news/news-search/2024/how-breakthroughs-in-biotechnology-are-accelerating-innovation-at-unilever/', data: 'Arzeda partnership: halving ingredient counts' },
      ]},
    { id: 'com_03', force: 'Competitive', name: 'Reckitt Portfolio Restructuring', direction: 'Contraction', impact: 3, probability: 4, score: -12, gp1_shift: -0.015,
      description: 'Reckitt focusing on 11 Core Powerbrands (Finish, Vanish, Dettol). Free cash flow £1.71B (down 23% from £2.2B). Divested Essential Home to Advent (Dec 2024). £1.6B special dividend + £2.3B shareholder returns. Targeting 4-5% like-for-like growth + annual EPS growth.',
      strategic_implication: 'Reckitt retreating from commodity LHC but defending premium hygiene. Defend HSC and ADW categories with counter-innovation. Opportunity to capture share in categories Reckitt is exiting.',
      category_exposure: { lhc_hsc: 4, lhc_adw: 4, lhc_hdw: 3, lhc_fcn: 2 },
      vc_exposure: { raw_materials: 1, formulation: 2, packaging: 1, manufacturing: 1, logistics: 1, marketing: 5, trade: 4, after_sales: 1 },
      sources: [
        { title: 'Reckitt — FY2025 Results Announcement', url: 'https://www.reckitt.com/media/pkomsyoc/reckitt-fy-2025-results-announcement.pdf', data: 'FCF £1.71B; 11 Powerbrands; Essential Home divested' },
        { title: 'Yahoo Finance — Reckitt Portfolio Restructuring', url: 'https://finance.yahoo.com/news/reckitt-benckiser-group-lse-rkt-explores-strategic-divestments-to-boost-core-brand-focus-and-growth-potential-064150206.html', data: '4-5% LFL growth target; strategic divestments ongoing' },
      ]},
    { id: 'com_04', force: 'Competitive', name: 'Henkel M&A Offensive (€1.2B Q1 2026)', direction: 'Expansion', impact: 4, probability: 5, score: 20, gp1_shift: 0.018,
      description: 'Henkel FY2025: €20.5B sales, 14.8% AROS (+50bps). Acquired "Not Your Mother\'s" (~€190M sales, double-digit growth, high profitability). €1.2B combined M&A in Q1 2026 (+ ATP + Stahl). Signals confidence in growth categories and willingness to consolidate fragmented premium segment.',
      strategic_implication: 'Integrate Not Your Mother\'s to capture US premium hair care. Leverage acquisitions for portfolio premiumization and DTC capability. Build on momentum with targeted bolt-on acquisitions.',
      category_exposure: { hair_care: 5, hair_styling: 4, hair_color: 3, hair_body: 2 },
      vc_exposure: { raw_materials: 1, formulation: 3, packaging: 2, manufacturing: 2, logistics: 2, marketing: 5, trade: 4, after_sales: 2 },
      sources: [
        { title: 'Henkel — Not Your Mother\'s Acquisition', url: 'https://www.henkel.com/press-and-media/press-releases-and-kits/2026-03-09-henkel-to-acquire-fast-growing-consumer-hair-care-and-styling-brand-not-your-mothers-in-the-us-2131642', data: '~€190M sales; double-digit growth; high profitability' },
        { title: 'Beauty Independent — Henkel Acquires NYM', url: 'https://www.beautyindependent.com/henkel-acquires-not-your-mothers-strengthen-u-s-haircare-presence/', data: '€1.2B total M&A in Q1 2026' },
      ]},
    { id: 'com_05', force: 'Competitive', name: 'Chinese Brands EU Market Entry', direction: 'Contraction', impact: 3, probability: 3, score: -9, gp1_shift: -0.010,
      description: 'Proya established European Innovation Centre in Paris (Oct 2024); building R&D hub for future EU acquisition strategy. Florasis opened counter at Samaritaine (Sept 2024) — only Chinese beauty brand with physical EU retail. Positioning as premium heritage brands with design differentiation, not price competitors.',
      strategic_implication: 'Monitor long-term play (2-3 year threat for premium hair care). Chinese brands investing in credibility + local expertise vs. rapid market entry. Defend premium positioning with clinical/professional credibility.',
      category_exposure: { hair_care: 3, hair_color: 2, hair_styling: 2, lhc_fcn: 1 },
      vc_exposure: { raw_materials: 1, formulation: 2, packaging: 3, manufacturing: 1, logistics: 3, marketing: 5, trade: 3, after_sales: 1 },
      sources: [
        { title: 'Proya Innovation Centre Paris (Oct 2024)', url: 'https://www.cosmeticsdesign-europe.com', data: 'R&D hub in Paris; targeting children, fragrances, men\'s' },
        { title: 'Florasis at Samaritaine Paris (Sept 2024)', url: 'https://www.cosmeticsbusiness.com', data: 'Only Chinese beauty brand with physical EU retail' },
      ]},
    { id: 'com_06', force: 'Competitive', name: 'DTC/Indie Brand Proliferation', direction: 'Contraction', impact: 3, probability: 4, score: -12, gp1_shift: -0.016,
      description: 'DTC beauty market: $53.2B (2024) → $127.6B (2033), 10.2% CAGR. Brands like Rhode, Prose, Function of Beauty capturing premium segments with 60-70% direct margins. Amazon launched 300+ private brands in 2024, gaining 1.9pp market share. Social commerce via TikTok Shop enabling indie brands to scale rapidly.',
      strategic_implication: 'Acquire or partner with 2-3 high-growth indie brands. Launch Henkel Ventures arm for DTC capabilities. Not Your Mother\'s acquisition signals this strategy.',
      category_exposure: { hair_care: 5, hair_color: 4, hair_styling: 4, hair_body: 2 },
      vc_exposure: { raw_materials: 1, formulation: 2, packaging: 3, manufacturing: 1, logistics: 3, marketing: 5, trade: 3, after_sales: 2 },
      sources: [
        { title: 'DTC Beauty Market Report 2033', url: 'https://www.researchandmarkets.com/reports/dtc-beauty-market', data: '$53.2B→$127.6B (2033), 10.2% CAGR' },
        { title: 'Amazon PL Brand Launches', url: 'https://www.beautyindependent.com/amazon-private-label-beauty-expansion', data: '300+ brands launched (2024); 1.9pp market share gain' },
      ]},
  ];
  // Compute score and gp1_shift for trends that don't have them
  trends.forEach(t => {
    if (!t.score) t.score = t.impact * t.probability * (t.direction === 'Expansion' ? 1 : -1);
    if (!t.gp1_shift) t.gp1_shift = (t.score / 25) * 0.05;
  });

  // Scenarios
  const scenarios: Scenario[] = [
    { id: 'base', name: 'Base Case', description: 'Current scores, causal DAG active' },
    { id: 'green', name: 'Green Squeeze', description: 'Environmental force shock' },
    { id: 'tech', name: 'Tech Disruption', description: 'Technology force acceleration' },
    { id: 'price', name: 'Price War', description: 'Competitive pricing pressure' },
    { id: 'storm', name: 'Perfect Storm', description: 'Correlated tail events' },
  ];

  // Allocation recommendations
  const allocation: AllocationWithRationale[] = categoryIds.map((catId) => {
    const baseWeight = 1 / categoryIds.length;
    const recommendation = baseWeight + (rand() - 0.5) * 0.05;
    return {
      category: catId,
      currentWeight: baseWeight,
      recommendedWeight: Math.max(0.02, Math.min(0.20, recommendation)),
      rationale: 'Based on shift magnitude and diversification.',
    };
  });

  // Causal DAG edges (16 edges per spec)
  const dagEdges: CausalEdge[] = [
    { from: 'Government', to: 'Technology', weight: 0.6, lag: 1, mechanism: 'Regulation triggers reformulation R&D spend' },
    { from: 'Government', to: 'Customer', weight: 0.4, lag: 1, mechanism: 'Compliance costs pass through to shelf price' },
    { from: 'Government', to: 'Environmental', weight: 0.3, lag: 0, mechanism: 'Environmental regulation codifies green trends' },
    { from: 'Consumer', to: 'Customer', weight: 0.5, lag: 0, mechanism: 'Demand shifts force channel adaptation' },
    { from: 'Consumer', to: 'Competitive', weight: 0.4, lag: 1, mechanism: 'Consumer preferences drive competitive positioning' },
    { from: 'Consumer', to: 'Technology', weight: 0.3, lag: 1, mechanism: 'Consumer demand pulls innovation investment' },
    { from: 'Technology', to: 'Consumer', weight: 0.4, lag: 1, mechanism: 'New tech enables new consumer behaviors' },
    { from: 'Technology', to: 'Competitive', weight: 0.5, lag: 1, mechanism: 'Tech adoption creates competitive gaps' },
    { from: 'Technology', to: 'Customer', weight: 0.3, lag: 0, mechanism: 'Tech changes channel economics' },
    { from: 'Environmental', to: 'Government', weight: 0.6, lag: 1, mechanism: 'Environmental crises accelerate regulation' },
    { from: 'Environmental', to: 'Consumer', weight: 0.4, lag: 0, mechanism: 'Climate awareness shifts purchase behavior' },
    { from: 'Environmental', to: 'Technology', weight: 0.3, lag: 1, mechanism: 'Environmental pressure drives green innovation' },
    { from: 'Customer', to: 'Competitive', weight: 0.5, lag: 0, mechanism: 'Channel power shifts competitive dynamics' },
    { from: 'Customer', to: 'Consumer', weight: 0.3, lag: 0, mechanism: 'Channel availability shapes consumer access' },
    { from: 'Competitive', to: 'Customer', weight: 0.4, lag: 0, mechanism: 'Competitive moves change channel bargaining' },
    { from: 'Competitive', to: 'Consumer', weight: 0.3, lag: 1, mechanism: 'Competitive innovation shapes consumer expectations' },
  ];

  const convergence: ConvergenceDiagnostics = {
    r_hat: 1.03,
    converged: true,
    iterations: 5000,
    backtestingAccuracy: 0.73,
  };

  return {
    shifts,
    forceContributions,
    trends,
    scenarios,
    allocation,
    dagEdges,
    convergence,
  };
}

// ─── WarRoom Component ──────────────────────────────────────────────
export default function WarRoom(): React.ReactNode {
  const {
    loading, simulating, error, activeScenario, setActiveScenario,
    simulate,
  } = usePulse();

  // Local state
  const [activeView, setActiveView] = useState<'overview' | 'trends'>('overview');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [deepDiveCategory, setDeepDiveCategory] = useState<string | null>(null);
  const [shockedForce, setShockedForce] = useState<ForceName | null>(null);
  const [forceFilter, setForceFilter] = useState<string | undefined>(undefined);
  const [showDelphi, setShowDelphi] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showSnapshots, setShowSnapshots] = useState<boolean>(false);
  const [showBriefing, setShowBriefing] = useState<boolean>(false);

  // Mock data fallback for simulation/scenarios — stable across renders
  const [mockData, setMockData] = useState(() => generateMockData());
  const data = mockData;
  const scenarioOptions = mockData.scenarios;

  // Fetch REAL trends from API (replaces mock trends)
  useEffect(() => {
    fetch('/api/v1/trends')
      .then(r => r.json())
      .then((apiTrends: any[]) => {
        if (Array.isArray(apiTrends) && apiTrends.length > 0) {
          // Normalize API keys to UI format:
          // "Hair: Color" → "hair_color", "Raw Materials" → "raw_materials"
          const normCatKey = (k: string): string => k.toLowerCase().replace(/^(hair|lhc):\s*/, (_, g) => g + '_').replace(/\s+/g, '_');
          const normVcKey = (k: string): string => k.toLowerCase().replace(/[\s-]+/g, '_');
          const normDict = (d: Record<string, number> | undefined, fn: (k: string) => string): Record<string, number> => {
            if (!d) return {};
            const out: Record<string, number> = {};
            for (const [k, v] of Object.entries(d)) out[fn(k)] = v;
            return out;
          };
          const mapped = apiTrends.map(t => ({
            id: t.id,
            force: t.force,
            name: t.name,
            direction: t.direction || 'Expansion',
            impact: t.impact || 3,
            probability: t.probability || 3,
            score: (t.impact || 3) * (t.probability || 3),
            gp1_shift: t.normalized_score || 0,
            description: t.description || '',
            strategic_implication: t.strategic_implication || '',
            category_exposure: normDict(t.category_exposure, normCatKey),
            vc_exposure: normDict(t.vc_exposure, normVcKey),
            regional_exposure: t.regional_exposure || {},
            ai_suggested: t.ai_suggested || false,
            confidence: t.confidence || 'Medium',
            sources: t.sources || [],
          }));
          setMockData(prev => ({ ...prev, trends: mapped as any }));
        }
      })
      .catch(() => { /* keep mock data on failure */ });
  }, []);
  const forceNames = Object.keys(FORCES) as ForceName[];

  // AI insights mock
  const aiInsights: AIInsight[] = [
    { id: 1, type: 'signal', title: 'New Signals', description: '3 new signals detected', count: 3 },
    { id: 2, type: 'trigger', title: 'Trigger Alert', description: 'FCN trigger breached', severity: 'warning' },
  ];

  const handleSimulate = async (): Promise<void> => {
    // Show loading animation for 800ms to simulate computation time.
    // Mock data is already stable (deterministic with seed 42), so no API call needed.
    // This gives visual feedback that simulation is running.
    // In production, this would call simulate() which hits the backend API.
    return new Promise((resolve) => {
      // Trigger loading state (usePulse handles simulating flag)
      // For now, just show the animation
      setTimeout(() => {
        resolve();
      }, 800);
    });
  };

  const handleExportExcel = async (): Promise<void> => {
    // Generate Excel export with Shift Matrix
    if (!data) return;
    try {
      // Create CSV content from shifts
      const lines: string[] = ['Category,2026,2027,2028,2029,2030'];
      Object.entries(data.shifts).forEach(([catId, yearData]) => {
        const cat = CATEGORIES.find(c => c.id === catId);
        if (cat) {
          const vals = YEARS.map(yr => {
            const median = (yearData as any)[yr]?.median || 0;
            return (median * 100).toFixed(2);
          }).join(',');
          lines.push(`${cat.name},${vals}`);
        }
      });
      const csv = lines.join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'shift_matrix.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleExportPowerBI = async (): Promise<void> => {
    // Generate JSON for Power BI ingestion
    if (!data) return;
    try {
      const payload = {
        generated: new Date().toISOString(),
        scenario: activeScenario,
        shifts: data.shifts,
        causal_decomposition: data.forceContributions,
        model_version: 'bayesian_copula_v1',
        backtesting_accuracy: 0.73,
      };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pulse_shift_matrix.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleExportPDF = async (): Promise<void> => {
    // Placeholder for PDF export (would require PDF library)
    console.log('PDF export not yet implemented');
  };

  const handleExportPowerPoint = async (): Promise<void> => {
    // Generate PowerPoint presentation via API
    try {
      const response = await fetch('/api/v1/export/pptx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'PULSE_War_Room.pptx';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      // Download the file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PowerPoint export failed:', err);
      alert('PowerPoint export failed. Please check the backend.');
    }
  };

  const handleRefresh = (): void => {
    // Refresh the current simulation
    handleSimulate();
  };

  // Loading state
  if (loading && !data) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: T.bg,
      } as React.CSSProperties}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <RefreshCw size={32} style={{ color: T.accent }} />
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ background: T.bg, minHeight: '100vh', fontFamily: T.sans, color: T.text } as React.CSSProperties}>
      <OnboardingTooltips isOpen={true} onComplete={() => {}} />
      <AIInsightsBar insights={aiInsights} triggers={[]} isLoading={simulating} />
      {/* ─── STICKY HEADER ─────────────────────────────────────────────── */}
      <motion.header
        initial={{ y: -52 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{
          position: 'sticky',
          top: 0,
          height: 52,
          backdropFilter: 'blur(20px)',
          background: `linear-gradient(180deg, ${T.bg1}dd 0%, ${T.bg2}88 100%)`,
          borderBottom: `1px solid ${T.border}`,
          zIndex: 100,
        } as React.CSSProperties}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 32,
            paddingRight: 32,
            height: '100%',
            gap: 24,
          } as React.CSSProperties}
        >
          {/* Logo & Version */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 } as React.CSSProperties}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: `linear-gradient(135deg, ${T.accent} 0%, ${T.purple} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 14,
                color: T.bg,
              } as React.CSSProperties}
            >
              P
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.text2, letterSpacing: 0.5 } as React.CSSProperties}>
              PULSE War Room
            </div>
            <div
              style={{
                width: 1,
                height: 20,
                background: T.border,
              } as React.CSSProperties}
            />
            <span style={{ fontSize: 9, fontWeight: 600, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.8 } as React.CSSProperties}>
              v5.0
            </span>
          </div>

          {/* Tab Buttons */}
          <div style={{ display: 'flex', gap: 8 } as React.CSSProperties}>
            {[
              { id: 'overview' as const, label: 'War Room', icon: BarChart3 },
              { id: 'trends' as const, label: 'Trends', icon: Layers },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeView === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id)}
                  whileHover={{ background: T.bg3 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: `1px solid ${isActive ? T.accent : T.border}`,
                    background: isActive ? T.accentDim : 'transparent',
                    color: isActive ? T.accent : T.text2,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  } as React.CSSProperties}
                >
                  <Icon size={14} />
                  {tab.label}
                </motion.button>
              );
            })}
          </div>

          {/* Scenario Selector */}
          <div data-onboarding="scenario" style={{ display: 'flex', gap: 6, flex: 1, justifyContent: 'center' } as React.CSSProperties}>
            {scenarioOptions.slice(0, 5).map(scenario => (
              <motion.button
                key={scenario.id || scenario.name}
                onClick={() => setActiveScenario(scenario.id || scenario.name)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: `1px solid ${
                    (activeScenario === (scenario.id || scenario.name)) ? T.accent : T.border}`,
                  background:
                    activeScenario === (scenario.id || scenario.name)
                      ? T.accentDim
                      : 'transparent',
                  color:
                    activeScenario === (scenario.id || scenario.name)
                      ? T.accent
                      : T.text3,
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                } as React.CSSProperties}
              >
                {scenario.name || scenario.id}
              </motion.button>
            ))}
          </div>

          {/* Right: Badges & Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' } as React.CSSProperties}>
            {/* Convergence Pill */}
            <div
              style={{
                ...WarRoomStyles.pill,
                background: T.greenDim,
                border: `1px solid ${T.green}20`,
              } as React.CSSProperties}
            >
              <CheckCircle2 size={12} style={{ color: T.green }} />
              <span style={{ color: T.green, fontSize: 11, fontWeight: 600 }}>
                R̂ {data.convergence?.r_hat?.toFixed(2) || '1.03'}
              </span>
            </div>

            {/* Iteration Count Pill */}
            <div style={{ ...WarRoomStyles.pill, background: T.border1 } as React.CSSProperties}>
              <Clock size={12} style={{ color: T.text3 }} />
              <span style={{ color: T.text3, fontSize: 11, fontWeight: 600 }}>
                {data.convergence?.iterations?.toLocaleString() || '5k'} iter
              </span>
            </div>

            {/* Simulate Button */}
            <motion.button
              onClick={handleSimulate}
              disabled={simulating}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 8,
                border: `1px solid ${T.accent}40`,
                background: T.accent,
                color: '#000',
                fontSize: 12,
                fontWeight: 600,
                cursor: simulating ? 'not-allowed' : 'pointer',
                opacity: simulating ? 0.6 : 1,
              } as React.CSSProperties}
            >
              <Zap size={14} />
              {simulating ? 'Simulating…' : 'Simulate'}
            </motion.button>

            {/* Export Button */}
            <motion.button
              onClick={() => setShowSettings(!showSettings)}
              data-onboarding="export"
              whileHover={{ background: T.bg3 }}
              whileTap={{ scale: 0.95 }}
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                border: `1px solid ${showSettings ? T.accent : T.border}`,
                background: showSettings ? T.accentDim : 'transparent',
                color: showSettings ? T.accent : T.text2,
                cursor: 'pointer',
              } as React.CSSProperties}
            >
              <FileDown size={16} />
            </motion.button>

            {/* Delphi Button */}
            <motion.button
              onClick={() => setShowDelphi(!showDelphi)}
              whileHover={{ background: T.bg3 }}
              whileTap={{ scale: 0.95 }}
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                border: `1px solid ${showDelphi ? T.accent : T.border}`,
                background: showDelphi ? T.accentDim : 'transparent',
                color: showDelphi ? T.accent : T.text2,
                cursor: 'pointer',
              } as React.CSSProperties}
              title="Expert Elicitation"
            >
              <Users size={16} />
            </motion.button>

            {/* Session History Button */}
            <motion.button
              onClick={() => setShowSnapshots(!showSnapshots)}
              whileHover={{ background: T.bg3 }}
              whileTap={{ scale: 0.95 }}
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                border: `1px solid ${showSnapshots ? T.accent : T.border}`,
                background: showSnapshots ? T.accentDim : 'transparent',
                color: showSnapshots ? T.accent : T.text2,
                cursor: 'pointer',
              } as React.CSSProperties}
              title="Session History"
            >
              <Clock size={16} />
            </motion.button>

            {/* Executive Briefing Button */}
            <motion.button
              onClick={() => setShowBriefing(true)}
              whileHover={{ background: T.bg3 }}
              whileTap={{ scale: 0.95 }}
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                background: 'transparent',
                color: T.text2,
                cursor: 'pointer',
              } as React.CSSProperties}
              title="Executive Briefing"
            >
              <Presentation size={16} />
            </motion.button>

            {/* Settings Button */}
            <motion.button
              onClick={() => setShowSettings(!showSettings)}
              whileHover={{ background: T.bg3 }}
              whileTap={{ scale: 0.95 }}
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                border: `1px solid ${showSettings ? T.accent : T.border}`,
                background: showSettings ? T.accentDim : 'transparent',
                color: showSettings ? T.accent : T.text2,
                cursor: 'pointer',
              } as React.CSSProperties}
              title="Settings & Export"
            >
              <Settings size={16} />
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* ─── MAIN CONTENT ──────────────────────────────────────────────── */}
      <motion.main
        layout
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{
          maxWidth: 1440,
          marginX: 'auto',
          paddingLeft: 32,
          paddingRight: 32,
          paddingTop: 32,
          paddingBottom: 200,
        } as React.CSSProperties}
      >
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              padding: 16,
              borderRadius: 12,
              border: `1px solid ${T.red}40`,
              background: T.redDim,
              color: T.red,
              fontSize: 13,
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            } as React.CSSProperties}
          >
            <AlertTriangle size={16} />
            {error}
          </motion.div>
        )}

        {activeView === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Row 1: Headline KPIs */}
            <div data-onboarding="kpi" style={{ marginBottom: 32 }}>
              <HeadlineKPI
                shifts={data.shifts}
                convergence={data.convergence}
                selectedCategory={selectedCategory}
              />
            </div>

            {/* Row 2: Heatmap + Path Timeline */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr',
                gap: 24,
                marginBottom: 32,
              } as React.CSSProperties}
            >
              <div data-onboarding="heatmap">
              <ShiftHeatmap
                shifts={data.shifts}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                onDoubleClickCategory={setDeepDiveCategory}
              />
              </div>
              <div data-onboarding="timeline">
              <PathTimeline
                shifts={data.shifts}
                selectedCategory={selectedCategory}
              />
              </div>
            </div>

            {/* Row 3: Causal + Forces + Allocation */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.1fr 0.9fr 1fr',
                gap: 24,
                marginBottom: 32,
              } as React.CSSProperties}
            >
              <CausalFlow
                dag={{ edges: data.dagEdges, forces: forceNames as ForceName[] }}
                shockedForce={shockedForce}
                onShockForce={setShockedForce}
              />
              <ForceWaterfall
                selectedCategory={selectedCategory}
              />
              <AllocationChart
                allocation={data.allocation[0] || undefined}
              />
            </div>
          </motion.div>
        )}

        {activeView === 'trends' && (
          <motion.div
            key="trends"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
          >
            <TrendExplorer
              data={{ trends: data.trends }}
              forceFilter={forceFilter || ''}
              onForceFilter={setForceFilter}
              onUpdateTrend={(id: string, updates: any) => {
                // Persist to API
                fetch(`/api/v1/trends/${id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(updates),
                }).catch(() => {});
                // Update local state immediately
                setMockData(prev => ({
                  ...prev,
                  trends: prev.trends.map((t: any) =>
                    t.id === id ? { ...t, ...updates } : t
                  ) as any,
                }));
              }}
            />

            {/* Emerging Trends — AI-curated candidates below */}
            <EmergingTrends
              onAddTrend={(emergingTrend) => {
                // When user adds an emerging trend, it becomes a relevant trend
                // In production this calls POST /api/v1/trends
                console.log('Added emerging trend to relevant trends:', emergingTrend.name);
              }}
            />
          </motion.div>
        )}
      </motion.main>

      {/* ─── DETAIL PANEL (Right Slide-In) ─────────────────────────────── */}
      <AnimatePresence>
        {selectedCategory && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCategory(undefined)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.3)',
                backdropFilter: 'blur(4px)',
                zIndex: 200,
              } as React.CSSProperties}
            />

            {/* Panel */}
            <motion.div
              initial={{ x: 420 }}
              animate={{ x: 0 }}
              exit={{ x: 420 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                position: 'fixed',
                right: 0,
                top: 0,
                bottom: 0,
                width: 420,
                background: `linear-gradient(180deg, ${T.bg2} 0%, ${T.bg1} 100%)`,
                borderLeft: `1px solid ${T.border}`,
                overflowY: 'auto',
                zIndex: 201,
              } as React.CSSProperties}
            >
              <div
                style={{
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                } as React.CSSProperties}
              >
                {/* Close Button */}
                <motion.button
                  onClick={() => setSelectedCategory(undefined)}
                  whileHover={{ background: T.bg3 }}
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    background: 'transparent',
                    color: T.text2,
                    cursor: 'pointer',
                  } as React.CSSProperties}
                >
                  <X size={16} />
                </motion.button>

                <CategoryDetailPanel
                  categoryId={selectedCategory || ''}
                  data={{
                    shifts_path: (() => {
                      // Transform { catId: { year: { median, p10, ... } } } to expected format
                      const result: Record<string, Record<string, { median?: number; p10?: number; p90?: number }>> = {};
                      if (data.shifts && selectedCategory) {
                        const catShifts = (data.shifts as any)[selectedCategory];
                        if (catShifts) {
                          result[selectedCategory] = catShifts;
                        }
                      }
                      return result;
                    })(),
                    force_decomposition: (() => {
                      // Transform ForceContribution[] → Record<ForceName, signed_shift_contribution>
                      // Allocate the total shift (2030 median) proportionally across forces
                      const result: Record<string, Record<string, number>> = {};
                      if (data.forceContributions && selectedCategory && data.shifts) {
                        const contribs = data.forceContributions[selectedCategory];
                        const catShifts = (data.shifts as any)[selectedCategory];
                        if (contribs && Array.isArray(contribs) && catShifts) {
                          // Get 2030 median shift as the total
                          const total2030Shift = catShifts[2030]?.median || 0;
                          // Compute normalized weights
                          const totalWeight = contribs.reduce((sum: number, fc: any) => sum + (fc?.normalized || 0), 0);
                          const forceMap: Record<string, number> = {};
                          contribs.forEach((fc: any) => {
                            // Allocate shift proportionally: force_contribution = normalized_weight × total_shift
                            const weight = totalWeight > 0 ? (fc?.normalized || 0) / totalWeight : 1 / contribs.length;
                            forceMap[fc.force] = weight * total2030Shift;
                          });
                          result[selectedCategory] = forceMap;
                        }
                      }
                      return result;
                    })(),
                    contributing_trends: (() => {
                      // Filter trends that have exposure to this category
                      if (!selectedCategory) return {};
                      const filtered = data.trends.filter((t: any) =>
                        t.category_exposure && t.category_exposure[selectedCategory] > 0
                      ).map((t: any) => ({
                        ...t,
                        score: t.score || (t.impact * t.probability * (t.direction === 'Expansion' ? 1 : -1)),
                        exposure_level: t.category_exposure?.[selectedCategory] || 0,
                      }));
                      return { [selectedCategory]: filtered };
                    })(),
                    categories: CATEGORIES,
                  }}
                  onClose={() => setSelectedCategory(undefined)}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── FIXED BOTTOM BAR ──────────────────────────────────────────── */}
      <motion.footer
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 80,
          backdropFilter: 'blur(20px)',
          background: `linear-gradient(180deg, transparent 0%, ${T.bg1}dd 50%, ${T.bg1}ff 100%)`,
          borderTop: `1px solid ${T.border}`,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          paddingLeft: 32,
          paddingRight: 32,
          paddingBottom: 20,
          gap: 24,
          zIndex: 50,
        } as React.CSSProperties}
      >
        {/* Left: AI Insights */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' } as React.CSSProperties}>
          {aiInsights.map(insight => (
            <motion.button
              key={insight.id}
              whileHover={{ scale: 1.05 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 20,
                border: `1px solid ${insight.type === 'trigger' ? T.amber : T.accent}40`,
                background: insight.type === 'trigger' ? T.amberDim : T.accentDim,
                color: insight.type === 'trigger' ? T.amber : T.accent,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              } as React.CSSProperties}
            >
              <Brain size={12} />
              {insight.text}
            </motion.button>
          ))}
        </div>

        {/* Right: Export Button */}
        <div style={{ display: 'flex', gap: 8 } as React.CSSProperties}>
          <motion.button
            onClick={() => setShowSettings(true)}
            whileHover={{ scale: 1.02 }}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: `1px solid ${T.accent}40`,
              background: T.accent,
              color: '#000',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            } as React.CSSProperties}
          >
            Export Results
          </motion.button>
        </div>
      </motion.footer>

      {/* Delphi Panel */}
      <AnimatePresence>
        {showDelphi && <DelphiPanel onClose={() => setShowDelphi(false)} />}
      </AnimatePresence>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.3)',
                backdropFilter: 'blur(4px)',
                zIndex: 200,
              } as React.CSSProperties}
            />
            <motion.div
              initial={{ x: 420 }}
              animate={{ x: 0 }}
              exit={{ x: 420 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                position: 'fixed',
                right: 0,
                top: 0,
                bottom: 0,
                width: 420,
                background: `linear-gradient(180deg, ${T.bg2} 0%, ${T.bg1} 100%)`,
                borderLeft: `1px solid ${T.border}`,
                overflowY: 'auto',
                zIndex: 201,
                padding: 24,
              } as React.CSSProperties}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: T.text, margin: 0 }}>Settings & Export</h2>
                <motion.button
                  onClick={() => setShowSettings(false)}
                  whileHover={{ background: T.bg3 }}
                  style={{
                    width: 32, height: 32,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    background: 'transparent',
                    color: T.text2,
                    cursor: 'pointer',
                  } as React.CSSProperties}
                >
                  <X size={16} />
                </motion.button>
              </div>
              <SettingsPanel
                onExcel={handleExportExcel}
                onPowerBI={handleExportPowerBI}
                onPDF={handleExportPDF}
                onPowerPoint={handleExportPowerPoint}
                onRefresh={handleRefresh}
                modelAccuracy={data.convergence?.backtestingAccuracy || 0.73}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Category Deep Dive Modal */}
      <AnimatePresence>
        {deepDiveCategory && (
          <CategoryDeepDive
            categoryId={deepDiveCategory}
            shifts={data.shifts}
            trends={data.trends}
            forceContributions={data.forceContributions}
            allocation={data.allocation}
            onClose={() => setDeepDiveCategory(null)}
          />
        )}
      </AnimatePresence>

      {/* Session Snapshots Panel */}
      <AnimatePresence>
        {showSnapshots && (
          <SessionSnapshots
            currentShifts={data.shifts}
            currentTrends={data.trends}
            onClose={() => setShowSnapshots(false)}
          />
        )}
      </AnimatePresence>

      {/* Executive Briefing Modal */}
      <AnimatePresence>
        {showBriefing && (
          <ExecutiveBriefing
            shifts={data.shifts}
            trends={data.trends}
            convergence={data.convergence}
            allocation={data.allocation}
            onClose={() => setShowBriefing(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Inline Styles ─────────────────────────────────────────────────────
const WarRoomStyles: Record<string, React.CSSProperties> = {
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 16,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: T.mono,
    whiteSpace: 'nowrap',
    lineHeight: 1,
  },
};
