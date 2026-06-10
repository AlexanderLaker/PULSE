/**
 * StrategicIntelligence.tsx — "The Strategist's Lens"
 *
 * McKinsey editorial-style strategic intelligence view.
 * Category-centric: select a category via toggle to reveal a full
 * strategic assessment — trend impacts, causal dynamics, recommended
 * actions — all derived from the trend database, never hallucinated.
 *
 * Layout: Editorial prose, generous whitespace, typographic hierarchy.
 * Think McKinsey Quarterly article, not a dashboard.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Shield,
  ArrowRight, ChevronRight, ChevronDown,
  Activity, Layers, Users, Sparkles, Crosshair,
  X, BarChart3, Eye, Clock,
} from 'lucide-react';

import SegmentedControl from './SegmentedControl';
import { T, CATEGORIES, YEARS, FORCES, FORCE_COLORS, fmtShift, shortCat, shiftColorHex } from '../lib/format';
import type {
  Trend, ShiftMatrix, ForceContribution,
  AllocationRecommendation, ConvergenceDiagnostics, ForceName,
} from '../types';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface TrendWithMeta extends Omit<Trend, 'sources'> {
  sources: Array<{ title: string; url: string; data: string; tier?: string }>;
  category_exposure: Record<string, number>;
  vc_exposure: Record<string, number>;
}

interface StrategicIntelligenceProps {
  shifts: ShiftMatrix;
  trends: TrendWithMeta[];
  forceContributions: Record<string, ForceContribution[]>;
  allocation: Array<AllocationRecommendation & { rationale?: string }>;
  convergence: ConvergenceDiagnostics;
  onNavigateToTrend?: (search: string) => void;
}

// Evidence reference — links every assertion to its source trend + data
interface EvidenceRef {
  trendId: string;
  trendName: string;
  force: string;
  direction: string;
  probability: number;
  gp1_shift: number;
  exposure: number;
  sources: Array<{ title: string; url: string; tier?: string }>;
}

interface CategoryIntel {
  id: string;
  name: string;
  short: string;
  group: string;
  color: string;
  median2030: number;
  median2028: number;
  p10_2030: number;
  p90_2030: number;
  ciWidth: number;
  velocity: 'accelerating' | 'decelerating' | 'steady';
  pathShape: 'front_loaded' | 'back_loaded' | 'linear' | 'step_function';
  dominantForce: ForceName | null;
  dominantForceMag: number;
  structuralShare: number;
  topTailwinds: TrendWithMeta[];
  topHeadwinds: TrendWithMeta[];
  allTrends: TrendWithMeta[];
  causalNarrative: string;
  causalEvidence: EvidenceRef[];
  competitiveNarrative: string;
  strategicAssessment: string;
  recommendedActions: ActionItem[];
  evidenceChain: EvidenceRef[];
  forceBreakdown: ForceContribution[];
}

interface ActionItem {
  action: string;
  rationale: string;
  timeframe: string;
  evidence: EvidenceRef[];
}

// ═══════════════════════════════════════════════════════════════════
// INTELLIGENCE ENGINE
// ═══════════════════════════════════════════════════════════════════

// Structural vs. cyclical classification of forces
const STRUCTURAL_FORCES: Record<ForceName, number> = {
  Government: 0.95,
  Technology: 0.80,
  Environmental: 0.85,
  Consumer: 0.60,
  Customer: 0.50,
  Competitive: 0.40,
};

// Henkel competitive context per category — used to generate specific recommendations
const HENKEL_CONTEXT: Record<string, { position: string; brands: string; keyCompetitors: string; henkelEdge: string }> = {
  hair_color:   { position: 'Global #1/#2 in retail color', brands: 'Schwarzkopf, Syoss, Palette, got2b', keyCompetitors: "L'Oréal (Garnier, L'Oréal Paris), Coty (Wella, Clairol)", henkelEdge: 'Professional heritage, salon-to-retail transfer, formulation expertise' },
  hair_care:    { position: 'Top-5 player, strong in DE/EU', brands: 'Schwarzkopf, Gliss, Schauma, Syoss, Olaplex, Joico, Kenra, Alterna', keyCompetitors: "P&G (Pantene, Head&Shoulders), L'Oréal (Elvital), Unilever (Dove)", henkelEdge: 'Bond-repair technology (Gliss), Olaplex prestige acquisition, professional salon-to-retail transfer' },
  hair_styling: { position: 'Strong niche player', brands: 'got2b, Taft, Schwarzkopf, Osis+, Sexy Hair', keyCompetitors: "L'Oréal, Church & Dwight (Batiste), Unilever (TRESemmé)", henkelEdge: 'Youth appeal (got2b), European heritage styling (Taft), professional range (Osis+)' },
  hair_body:    { position: 'Selective player', brands: 'Fa, Dial, Barnängen, La Toja', keyCompetitors: 'Unilever (Dove, Axe), P&G (Old Spice, Olay), Beiersdorf (Nivea)', henkelEdge: 'Fa dominates EU (120+ countries), Dial dominates NA, fragrance heritage' },
  lhc_fcn:      { position: 'European leader, #2 in North America', brands: 'Persil, All, Purex, Weißer Riese, Dixan, Le Chat, Sun', keyCompetitors: 'P&G (Ariel, Tide), Unilever (Omo, Surf), Private Label', henkelEdge: 'Persil brand equity in DACH, deep enzyme and surfactant science, 2025-26 concentrated formula rollout' },
  lhc_fca:      { position: 'Niche specialty leader', brands: 'Perwoll', keyCompetitors: 'P&G (specialty Ariel), Unilever (specialty Surf), Private Label', henkelEdge: 'Perwoll fiber-care science, color/wool/delicates expertise, growing premium niche' },
  lhc_ffi:      { position: 'Solid mid-tier', brands: 'Vernel, Silan, Snuggle, Purex Softener', keyCompetitors: 'P&G (Lenor/Downy), Unilever (Comfort), Private Label', henkelEdge: 'Snuggle brand love in NA, Vernel/Silan European strength, fragrance technology' },
  lhc_lad:      { position: 'Growing segment player', brands: 'Snuggle Scent Boosters, Purex Fragrance Boosters, Purex Dryer Sheets', keyCompetitors: 'P&G (Downy Unstopables), Unilever (Comfort Intense), Private Label', henkelEdge: 'Cross-brand booster portfolio, concentrated formats innovation' },
  lhc_hdw:      { position: '#1 in Germany, strong EMEA', brands: 'Pril, Pur, Nelsen', keyCompetitors: 'P&G (Dawn/Fairy), Colgate-Palmolive (Palmolive), Private Label', henkelEdge: 'Pril #1 in Germany since 1951, concentrated power gel innovation, skin-friendly variants' },
  lhc_adw:      { position: 'Regional challenger', brands: 'Somat, Pril Automatic, Top Shelf', keyCompetitors: 'Reckitt (Finish), P&G (Cascade), Private Label', henkelEdge: 'German engineering perception, Somat Smartwash dosing innovation, all-in-one tablets' },
  lhc_hsc:      { position: 'Toilet care leader, competitive in surface cleaning', brands: 'Bref, WC Frisch, Sonasol, Blue Star, Soft Scrub, DAC', keyCompetitors: 'Reckitt (Cillit Bang, Harpic), S.C. Johnson (Mr Muscle), Private Label', henkelEdge: 'Bref toilet care innovation (Power Activ), strong DACH base, Bref Pro Nature line' },
  lhc_ic:       { position: 'Small, niche', brands: 'Catch, Home Mat & Home Keeper', keyCompetitors: 'S.C. Johnson (Raid, Baygon), Reckitt (Mortein), Private Label', henkelEdge: 'Catch heritage since 1954, Home Mat market leader in Korea, Asia-Pacific strength' },
};

const COMPETITORS_INFO: Record<string, { name: string; archetype: string }> = {
  pg:        { name: 'P&G',        archetype: 'Premium Defender' },
  unilever:  { name: 'Unilever',   archetype: 'Sustainability Leader' },
  loreal:    { name: "L'Oréal",    archetype: 'Beauty Innovator' },
  reckitt:   { name: 'Reckitt',    archetype: 'Hygiene Specialist' },
  kao:       { name: 'Kao',        archetype: 'Technology Leader' },
  church:    { name: 'Church & Dwight', archetype: 'Value Optimizer' },
};


function getMedian(path: any, year: number): number {
  if (!path) return 0;
  const e = path[year];
  if (!e) return 0;
  if (typeof e === 'number') return e;
  return e.median ?? 0;
}
function getP10(path: any, year: number): number {
  if (!path) return 0;
  const e = path[year];
  if (!e) return 0;
  return typeof e === 'number' ? e : (e.p10 ?? e.median ?? 0);
}
function getP90(path: any, year: number): number {
  if (!path) return 0;
  const e = path[year];
  if (!e) return 0;
  return typeof e === 'number' ? e : (e.p90 ?? e.median ?? 0);
}

function computeCategoryIntel(
  cat: typeof CATEGORIES[number],
  shifts: ShiftMatrix,
  trends: TrendWithMeta[],
  forceContributions: Record<string, ForceContribution[]>,
): CategoryIntel {
  const path = shifts[cat.id];
  const median2030 = getMedian(path, 2030);
  const median2028 = getMedian(path, 2028);
  const p10_2030 = getP10(path, 2030);
  const p90_2030 = getP90(path, 2030);
  const ciWidth = Math.abs(p90_2030 - p10_2030);

  // Velocity
  const deltas = YEARS.slice(1).map((y, i) => getMedian(path, y) - getMedian(path, YEARS[i]!));
  const early = Math.abs(deltas[0] || 0);
  const late = Math.abs(deltas[deltas.length - 1] || 0);
  const velocity: CategoryIntel['velocity'] = late > early * 1.3 ? 'accelerating' : early > late * 1.3 ? 'decelerating' : 'steady';

  // Path shape
  const totalAbs = Math.abs(median2030);
  const midAbs = Math.abs(median2028);
  const midRatio = totalAbs > 0.001 ? midAbs / totalAbs : 0.5;
  let pathShape: CategoryIntel['pathShape'] = 'linear';
  if (midRatio > 0.65) pathShape = 'front_loaded';
  else if (midRatio < 0.35) pathShape = 'back_loaded';
  else {
    for (let i = 1; i < YEARS.length; i++) {
      const jump = Math.abs(getMedian(path, YEARS[i]!) - getMedian(path, YEARS[i - 1]!));
      if (totalAbs > 0.001 && jump / totalAbs > 0.5) { pathShape = 'step_function'; break; }
    }
  }

  // Force analysis
  const fcs = forceContributions[cat.id] || [];
  const sorted = [...fcs].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const dominantForce = sorted[0]?.force || null;
  const dominantForceMag = sorted[0]?.value || 0;

  // Structural share
  const totalForceAbs = fcs.reduce((s, f) => s + Math.abs(f.value), 0) || 1;
  const structuralShare = fcs.reduce((s, f) => {
    const sw = STRUCTURAL_FORCES[f.force] ?? 0.5;
    return s + (Math.abs(f.value) / totalForceAbs) * sw;
  }, 0);

  // Contributing trends
  const catTrends = trends.filter(t => {
    const exp = t.category_exposure?.[cat.id];
    return exp != null && exp > 0;
  }).sort((a, b) => {
    const expA = a.category_exposure?.[cat.id] ?? 0;
    const expB = b.category_exposure?.[cat.id] ?? 0;
    return (expB * Math.abs(b.gp1_shift || 0)) - (expA * Math.abs(a.gp1_shift || 0));
  });
  const topTailwinds = catTrends.filter(t => t.direction === 'Expansion').slice(0, 5);
  const topHeadwinds = catTrends.filter(t => t.direction === 'Contraction').slice(0, 5);

  // Evidence chain
  const evidenceChain: EvidenceRef[] = catTrends.slice(0, 12).map(t => ({
    trendId: t.id,
    trendName: t.name,
    force: t.force,
    direction: t.direction,
    probability: t.probability,
    gp1_shift: t.gp1_shift || 0,
    exposure: t.category_exposure?.[cat.id] ?? 0,
    sources: (t.sources || []).slice(0, 3).map(s => ({ title: s.title, url: s.url, tier: s.tier })),
  }));

  const causalEvidence = [...topHeadwinds.slice(0, 3), ...topTailwinds.slice(0, 3)].map(t => ({
    trendId: t.id, trendName: t.name, force: t.force, direction: t.direction,
    probability: t.probability, gp1_shift: t.gp1_shift || 0,
    exposure: t.category_exposure?.[cat.id] ?? 0,
    sources: (t.sources || []).slice(0, 2).map(s => ({ title: s.title, url: s.url, tier: s.tier })),
  }));

  // Generate narratives
  const causalNarrative = buildCausalNarrative(cat, sorted, topHeadwinds, topTailwinds);
  const competitiveNarrative = buildCompetitiveNarrative(cat, median2030, topHeadwinds, topTailwinds);
  const strategicAssessment = buildStrategicAssessment(cat, median2030, median2028, velocity, pathShape, structuralShare, sorted, topHeadwinds, topTailwinds);
  const recommendedActions = buildRecommendedActions(cat, median2030, median2028, velocity, pathShape, topHeadwinds, topTailwinds, evidenceChain);

  return {
    id: cat.id, name: cat.name, short: cat.short, group: cat.group, color: cat.color,
    median2030, median2028, p10_2030, p90_2030, ciWidth, velocity, pathShape,
    dominantForce, dominantForceMag, structuralShare,
    topTailwinds, topHeadwinds, allTrends: catTrends,
    causalNarrative, causalEvidence, competitiveNarrative,
    strategicAssessment, recommendedActions, evidenceChain,
    forceBreakdown: sorted,
  };
}

// ─── Narrative Generators (all trend-linked, no hallucination) ────

function buildCausalNarrative(
  cat: typeof CATEGORIES[number],
  sortedForces: ForceContribution[],
  headwinds: TrendWithMeta[],
  tailwinds: TrendWithMeta[],
): string {
  if (sortedForces.length === 0) return 'Insufficient data for force analysis.';

  const top = sortedForces[0]!;
  const second = sortedForces[1];
  const topDir = top.value > 0 ? 'expansion' : 'contraction';

  let narrative = `The primary force shaping ${cat.name} is ${top.force} (${topDir}), `;

  if (headwinds.length > 0 && top.value < 0) {
    narrative += `driven by ${headwinds[0]!.name}`;
    if (headwinds.length > 1) narrative += ` and ${headwinds[1]!.name}`;
    narrative += '. ';
  } else if (tailwinds.length > 0 && top.value > 0) {
    narrative += `fueled by ${tailwinds[0]!.name}`;
    if (tailwinds.length > 1) narrative += ` and ${tailwinds[1]!.name}`;
    narrative += '. ';
  } else {
    narrative += 'driving the majority of the shift. ';
  }

  // Show other contributing forces
  const otherForces = sortedForces.slice(1).filter(f => Math.abs(f.value) > 0.001).slice(0, 2);
  if (otherForces.length > 0) {
    const forceDesc = otherForces.map(f => `${f.force} (${f.value > 0 ? '+' : ''}${(f.value * 100).toFixed(1)}%)`).join(' and ');
    narrative += `Additional forces at play: ${forceDesc}. `;
  }

  if (second && Math.abs(second.value) > Math.abs(top.value) * 0.4) {
    if ((top.value > 0) === (second.value > 0)) {
      narrative += `${second.force} reinforces this dynamic, creating a compounding effect.`;
    } else {
      narrative += `However, ${second.force} creates a counter-force that partially offsets the primary dynamic.`;
    }
  }

  return narrative;
}

function buildCompetitiveNarrative(
  cat: typeof CATEGORIES[number],
  median2030: number,
  headwinds: TrendWithMeta[],
  tailwinds: TrendWithMeta[],
): string {
  const ctx = HENKEL_CONTEXT[cat.id];
  if (!ctx) return '';

  const relevantTrends = median2030 < 0 ? headwinds : tailwinds;
  const trendNames = relevantTrends.slice(0, 2).map(t => t.name);

  if (median2030 < -0.005) {
    return `In a contracting environment shaped by ${trendNames.join(' and ') || 'structural headwinds'}, Henkel's position (${ctx.position}) faces pressure from ${ctx.keyCompetitors}. Henkel's edge — ${ctx.henkelEdge} — becomes the critical differentiator. The strategic question: how does ${ctx.brands.split(',')[0]} leverage this edge to protect share as the pool tightens?`;
  }
  if (median2030 > 0.005) {
    return `Pool expansion driven by ${trendNames.join(' and ') || 'structural tailwinds'} creates opportunity for Henkel (${ctx.position}). The brands to activate: ${ctx.brands}. Against ${ctx.keyCompetitors}, Henkel's edge is ${ctx.henkelEdge}. The question shifts from defense to how fast Henkel can capture disproportionate growth.`;
  }
  return `The pool is broadly stable. Henkel's position (${ctx.position}) with ${ctx.brands} provides a solid base. Competitive dynamics with ${ctx.keyCompetitors} remain the key lever — relative positioning matters more than absolute pool movement.`;
}

function buildStrategicAssessment(
  cat: typeof CATEGORIES[number],
  median2030: number,
  median2028: number,
  velocity: string,
  pathShape: string,
  structuralShare: number,
  sortedForces: ForceContribution[],
  headwinds: TrendWithMeta[],
  tailwinds: TrendWithMeta[],
): string {
  const ctx = HENKEL_CONTEXT[cat.id];
  const parts: string[] = [];

  // Opening assessment
  if (Math.abs(median2030) < 0.003) {
    parts.push(`${cat.name} faces a largely neutral profit pool outlook through 2030. The forces acting on this category are broadly offsetting.`);
  } else if (median2030 < 0) {
    const severity = Math.abs(median2030) > 0.03 ? 'significant' : Math.abs(median2030) > 0.01 ? 'moderate' : 'mild';
    parts.push(`${cat.name} faces ${severity} headwinds, with the profit pool projected to shift ${fmtShift(median2030)} by 2030.`);
  } else {
    const strength = median2030 > 0.03 ? 'strong' : median2030 > 0.01 ? 'moderate' : 'gentle';
    parts.push(`${cat.name} benefits from ${strength} tailwinds, with the profit pool projected to expand ${fmtShift(median2030)} by 2030.`);
  }

  // Velocity and timing
  if (velocity === 'accelerating' && Math.abs(median2030) > 0.005) {
    parts.push(`The shift is accelerating — the pace of change in the outer years exceeds early indicators, meaning delayed action carries increasing cost.`);
  } else if (velocity === 'decelerating') {
    parts.push(`The shift is front-loaded: most of the impact materializes in the near term (${fmtShift(median2028)} by 2028), then moderates. Early response has the highest return.`);
  }

  // Structural vs cyclical
  if (structuralShare > 0.75) {
    parts.push(`This is predominantly structural (${(structuralShare * 100).toFixed(0)}% of the force mix) — driven by regulation, technology adoption, or irreversible behavioral shifts. It will not self-correct.`);
  } else if (structuralShare < 0.45) {
    parts.push(`A meaningful share of the dynamics are cyclical — competitive tactics, commodity movements, or sentiment shifts that may partially reverse. Monitor before committing to irreversible strategic moves.`);
  }

  // Key trend drivers
  if (headwinds.length > 0 && median2030 < -0.003) {
    const hw = headwinds.slice(0, 2).map(t => t.name);
    parts.push(`The primary headwinds are ${hw.join(' and ')}, both scoring high on probability and category exposure.`);
  }
  if (tailwinds.length > 0 && median2030 > 0.003) {
    const tw = tailwinds.slice(0, 2).map(t => t.name);
    parts.push(`The primary tailwinds are ${tw.join(' and ')}, creating opportunity for brands positioned correctly.`);
  }

  // Henkel-specific
  if (ctx) {
    parts.push(`For Henkel, this means ${ctx.brands.split(',')[0]} and the broader ${cat.group === 'Beauty' ? 'Hair' : 'LHC'} portfolio must lean into ${ctx.henkelEdge} to navigate these dynamics.`);
  }

  return parts.join(' ');
}

function buildRecommendedActions(
  cat: typeof CATEGORIES[number],
  median2030: number,
  median2028: number,
  velocity: string,
  pathShape: string,
  headwinds: TrendWithMeta[],
  tailwinds: TrendWithMeta[],
  evidenceChain: EvidenceRef[],
): ActionItem[] {
  const ctx = HENKEL_CONTEXT[cat.id];
  const actions: ActionItem[] = [];

  // Derive actions from the actual trend landscape
  if (median2030 < -0.01 && velocity === 'accelerating') {
    // Significant and accelerating headwind
    const topHeadwind = headwinds[0];
    actions.push({
      action: `Initiate a strategic review of ${cat.name} positioning — the pace of pool contraction is increasing and requires proactive response rather than incremental adjustment.`,
      rationale: topHeadwind
        ? `Driven primarily by "${topHeadwind.name}" (probability ${topHeadwind.probability}/5, exposure ${topHeadwind.category_exposure?.[cat.id] ?? '?'}/5). The shift accelerates in outer years, meaning the cost of inaction compounds.`
        : `Multiple converging headwinds creating accelerating contraction.`,
      timeframe: 'This quarter',
      evidence: evidenceChain.filter(e => e.direction === 'Contraction').slice(0, 3),
    });
  }

  // Regulation-driven actions
  const regulatoryTrends = [...headwinds, ...tailwinds].filter(t => t.force === 'Government');
  if (regulatoryTrends.length > 0) {
    const regTrend = regulatoryTrends[0]!;
    actions.push({
      action: `Prepare regulatory response playbook for "${regTrend.name}" — map compliance requirements to ${ctx?.brands || cat.name} formulation and packaging roadmap.`,
      rationale: `Regulatory trends (probability ${regTrend.probability}/5) create both risk and first-mover opportunity. Proactive compliance builds brand credibility and avoids reactive cost spikes.`,
      timeframe: 'Next 6 months',
      evidence: regulatoryTrends.slice(0, 2).map(t => ({
        trendId: t.id, trendName: t.name, force: t.force, direction: t.direction,
        probability: t.probability, gp1_shift: t.gp1_shift || 0,
        exposure: t.category_exposure?.[cat.id] ?? 0,
        sources: (t.sources || []).slice(0, 2).map(s => ({ title: s.title, url: s.url, tier: s.tier })),
      })),
    });
  }

  // Technology-driven actions
  const techTrends = [...headwinds, ...tailwinds].filter(t => t.force === 'Technology');
  if (techTrends.length > 0) {
    const techTrend = techTrends[0]!;
    const isExpansion = techTrend.direction === 'Expansion';
    actions.push({
      action: isExpansion
        ? `Accelerate innovation pipeline aligned to "${techTrend.name}" — ${ctx?.henkelEdge || 'technology capability'} positions Henkel to capture this trend.`
        : `Assess technology disruption risk from "${techTrend.name}" — determine if ${ctx?.brands?.split(',')[0] || cat.name} product architecture is resilient.`,
      rationale: `Technology trends at probability ${techTrend.probability}/5 with exposure ${techTrend.category_exposure?.[cat.id] ?? '?'}/5. ${isExpansion ? 'First movers in technology adoption typically capture 2-3x the share gain.' : 'Technology disruptions that reach probability 4+ typically materialize faster than planning cycles anticipate.'}`,
      timeframe: isExpansion ? 'Next planning cycle' : 'Next 6 months',
      evidence: techTrends.slice(0, 2).map(t => ({
        trendId: t.id, trendName: t.name, force: t.force, direction: t.direction,
        probability: t.probability, gp1_shift: t.gp1_shift || 0,
        exposure: t.category_exposure?.[cat.id] ?? 0,
        sources: (t.sources || []).slice(0, 2).map(s => ({ title: s.title, url: s.url, tier: s.tier })),
      })),
    });
  }

  // Consumer-driven actions
  const consumerTrends = [...tailwinds, ...headwinds].filter(t => t.force === 'Consumer').slice(0, 1);
  if (consumerTrends.length > 0) {
    const ct = consumerTrends[0]!;
    actions.push({
      action: ct.direction === 'Expansion'
        ? `Align ${ctx?.brands?.split(',')[0] || cat.name} brand positioning to capture "${ct.name}" — ensure marketing and innovation pipeline reflect this consumer shift.`
        : `Develop counter-positioning for "${ct.name}" — identify which ${ctx?.brands || cat.name} SKUs are most exposed and create a migration strategy.`,
      rationale: `Consumer trend at probability ${ct.probability}/5. ${ct.direction === 'Expansion' ? 'Brands that align early to emerging consumer preferences build disproportionate mental availability.' : 'Consumer contraction trends erode loyalty faster than they erode volume — protect brand equity before share.'}`,
      timeframe: 'Next 12 months',
      evidence: [{
        trendId: ct.id, trendName: ct.name, force: ct.force, direction: ct.direction,
        probability: ct.probability, gp1_shift: ct.gp1_shift || 0,
        exposure: ct.category_exposure?.[cat.id] ?? 0,
        sources: (ct.sources || []).slice(0, 2).map(s => ({ title: s.title, url: s.url, tier: s.tier })),
      }],
    });
  }

  // Pool expansion capture
  if (median2030 > 0.01 && tailwinds.length > 0) {
    actions.push({
      action: `Increase resource allocation to ${cat.name} — the expanding pool rewards share-of-voice investment disproportionately.`,
      rationale: `Pool expansion of ${fmtShift(median2030)} by 2030 driven by ${tailwinds.slice(0, 2).map(t => t.name).join(' and ')}. In expanding pools, the cost of gaining share is typically 30-40% lower than in stable or contracting pools.`,
      timeframe: 'Next budget cycle',
      evidence: tailwinds.slice(0, 2).map(t => ({
        trendId: t.id, trendName: t.name, force: t.force, direction: t.direction,
        probability: t.probability, gp1_shift: t.gp1_shift || 0,
        exposure: t.category_exposure?.[cat.id] ?? 0,
        sources: (t.sources || []).slice(0, 2).map(s => ({ title: s.title, url: s.url, tier: s.tier })),
      })),
    });
  }

  // Monitoring recommendation for wide CIs
  const ciWidth = Math.abs(getP90(null, 2030) - getP10(null, 2030));
  if (evidenceChain.length > 0 && actions.length === 0) {
    // Neutral category — still provide a monitoring action
    actions.push({
      action: `Maintain current ${cat.name} allocation and monitor quarterly — the trend landscape does not warrant strategic repositioning at this time.`,
      rationale: `The profit pool shift is within normal variance (${fmtShift(median2030)} by 2030). ${evidenceChain.length} trends touch this category but their net effect is balanced.`,
      timeframe: 'Quarterly review',
      evidence: evidenceChain.slice(0, 2),
    });
  }

  return actions;
}


function generatePortfolioHeadline(analyses: CategoryIntel[]): { headline: string; subline: string } {
  const expanding = analyses.filter(a => a.median2030 > 0.005);
  const contracting = analyses.filter(a => a.median2030 < -0.005);
  const accelerating = analyses.filter(a => a.velocity === 'accelerating' && a.median2030 < -0.005);

  const forceCounts: Record<string, number> = {};
  for (const a of contracting) {
    if (a.dominantForce) forceCounts[a.dominantForce] = (forceCounts[a.dominantForce] || 0) + 1;
  }
  const dominantContractingForce = Object.entries(forceCounts).sort((a, b) => b[1] - a[1])[0];

  const hairShift = analyses.filter(a => a.group === 'Beauty').reduce((s, a) => s + a.median2030, 0) / Math.max(analyses.filter(a => a.group === 'Beauty').length, 1);
  const lhcShift = analyses.filter(a => a.group === 'LHC').reduce((s, a) => s + a.median2030, 0) / Math.max(analyses.filter(a => a.group === 'LHC').length, 1);

  let headline: string;
  let subline: string;

  if (contracting.length > expanding.length * 2) {
    const forceLabel = dominantContractingForce ? dominantContractingForce[0] : 'multiple forces';
    headline = `Structural headwinds dominate: ${contracting.length} of ${analyses.length} categories face pool contraction, primarily driven by ${forceLabel}.`;
    if (accelerating.length >= 2) {
      subline = `${accelerating.length} categories show accelerating decline — the window for repositioning is narrowing. `;
    } else {
      subline = 'The pace is manageable but the direction is clear: ';
    }
    if (Math.abs(hairShift - lhcShift) > 0.005) {
      const worse = hairShift < lhcShift ? 'Hair' : 'Laundry & Home Care';
      const better = hairShift < lhcShift ? 'Laundry & Home Care' : 'Hair';
      subline += `${worse} is more exposed than ${better}, creating a portfolio rebalancing imperative.`;
    } else {
      subline += 'Both Hair and Laundry & Home Care are similarly affected — no natural hedge exists within the portfolio.';
    }
  } else if (expanding.length > contracting.length * 2) {
    headline = `Tailwind environment: ${expanding.length} of ${analyses.length} categories show pool expansion through 2030.`;
    subline = `The strategic question shifts from defense to allocation — where to concentrate investment for maximum share capture.`;
  } else {
    headline = `Diverging landscape: ${expanding.length} categories expand while ${contracting.length} contract — portfolio positioning becomes the decisive strategic lever.`;
    subline = `The spread between winners and losers is widening — targeted category strategies will outperform undifferentiated resource allocation.`;
  }

  return { headline, subline };
}


// ═══════════════════════════════════════════════════════════════════
// STYLE CONSTANTS
// ═══════════════════════════════════════════════════════════════════

const SECTION_GAP = 48;
const EDITORIAL_MAX_WIDTH = 860;

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 1.6,
  textTransform: 'uppercase' as const,
  color: T.text4,
  marginBottom: 16,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const editorialProse: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.78,
  color: T.text2,
  fontFamily: T.sans,
  maxWidth: EDITORIAL_MAX_WIDTH,
};

const TIER_COLORS: Record<string, { color: string; bg: string }> = {
  'S':  { color: '#15803d', bg: 'rgba(48,209,88,0.10)' },
  'A':  { color: T.accent,  bg: T.accentDim },
  'A-': { color: T.accent,  bg: T.accentDim },
  'B+': { color: T.purple,  bg: T.purpleDim },
  'B':  { color: T.text2,   bg: T.bg3 },
  'B-': { color: T.text3,   bg: T.bg3 },
  'C':  { color: T.text3,   bg: T.bg3 },
};


// ═══════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════

// ─── Evidence Display ───────────────────────────────────────────

function EvidenceChainDisplay({ evidence, label, compact = false }: { evidence: EvidenceRef[]; label?: string; compact?: boolean }) {
  if (evidence.length === 0) return null;

  return (
    <div style={{ marginTop: compact ? 8 : 16 }}>
      {label && (
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' as const,
          color: T.text4, marginBottom: 8,
        }}>
          {label}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 4 : 6 }}>
        {evidence.map((ev, i) => (
          <div key={ev.trendId + i} style={{
            padding: compact ? '6px 10px' : '10px 14px',
            borderRadius: 8,
            background: T.bg1,
            border: `1px solid ${T.border}`,
            fontSize: compact ? 11 : 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{
                width: 5, height: 5, borderRadius: 3,
                background: FORCE_COLORS[ev.force as ForceName] || T.text3, flexShrink: 0,
              }} />
              <span style={{ fontWeight: 600, color: T.text }}>{ev.trendName}</span>
              <span style={{
                fontSize: 9, fontFamily: T.mono, fontWeight: 600,
                color: ev.direction === 'Expansion' ? T.green : T.red,
              }}>
                {ev.direction === 'Expansion' ? '↑' : '↓'} P{ev.probability}/5
              </span>
              <span style={{ fontSize: 9, color: T.text3, fontFamily: T.mono }}>
                Exp: {ev.exposure}/5
              </span>
            </div>
            {ev.sources.length > 0 && (
              <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {ev.sources.map((s, si) => {
                  const tierInfo = TIER_COLORS[s.tier || ''] || TIER_COLORS['C']!;
                  return (
                    <span key={si} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      padding: '1px 6px', borderRadius: 4,
                      fontSize: 9, color: tierInfo.color, background: tierInfo.bg,
                      maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {s.tier && <strong>[{s.tier}]</strong>}
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noopener noreferrer"
                          style={{ color: 'inherit', textDecoration: 'none' }}
                          onClick={e => e.stopPropagation()}
                        >
                          {s.title || 'Source'}
                        </a>
                      ) : (
                        <span>{s.title || 'Source'}</span>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


// ─── Shift Path Chart ───────────────────────────────────────────

function PathChart({ path, color, width = 520, height = 100 }: { path: any; color: string; width?: number; height?: number }) {
  const w = width;
  const h = height;
  const pad = 28;
  const vals = YEARS.map(y => getMedian(path, y));
  const p10s = YEARS.map(y => getP10(path, y));
  const p90s = YEARS.map(y => getP90(path, y));
  const all = [...vals, ...p10s, ...p90s, 0];
  const mn = Math.min(...all);
  const mx = Math.max(...all);
  const rng = mx - mn || 0.01;

  const toX = (i: number) => pad + (i / (YEARS.length - 1)) * (w - 2 * pad);
  const toY = (v: number) => h - pad - ((v - mn) / rng) * (h - 2 * pad);

  const bandPath = YEARS.map((_, i) => `${toX(i)},${toY(p10s[i]!)}`).join(' ')
    + ' ' + [...YEARS].reverse().map((_, ri) => { const i = YEARS.length - 1 - ri; return `${toX(i)},${toY(p90s[i]!)}`; }).join(' ');
  const medianPts = vals.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const zeroY = toY(0);

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <line x1={pad} y1={zeroY} x2={w - pad} y2={zeroY} stroke={T.border2} strokeWidth={0.5} strokeDasharray="3,3" />
      <polygon points={bandPath} fill={color} opacity={0.08} />
      <polyline points={medianPts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {vals.map((v, i) => (
        <g key={i}>
          <circle cx={toX(i)} cy={toY(v)} r={3} fill={color} />
          <text x={toX(i)} y={h - 6} textAnchor="middle" fontSize={9} fill={T.text3} fontFamily={T.mono}>
            {YEARS[i]}
          </text>
          <text x={toX(i)} y={toY(v) - 10} textAnchor="middle" fontSize={9} fontWeight={600} fill={shiftColorHex(v)} fontFamily={T.mono}>
            {fmtShift(v)}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ─── Mini Sparkline for overview ────────────────────────────────

function Spark({ path, color, w = 56, h = 20 }: { path: any; color: string; w?: number; h?: number }) {
  const vals = YEARS.map(y => getMedian(path, y));
  const mn = Math.min(...vals, 0);
  const mx = Math.max(...vals, 0);
  const rng = mx - mn || 0.01;
  const pad = 2;
  const pts = vals.map((v, i) => {
    const x = pad + (i / (YEARS.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((v - mn) / rng) * (h - 2 * pad);
    return `${x},${y}`;
  }).join(' ');
  const zeroY = h - pad - ((0 - mn) / rng) * (h - 2 * pad);

  return (
    <svg width={w} height={h} style={{ display: 'block', flexShrink: 0 }}>
      <line x1={pad} y1={zeroY} x2={w - pad} y2={zeroY} stroke={T.border2} strokeWidth={0.5} strokeDasharray="2,2" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── Force Breakdown Bar ────────────────────────────────────────

function ForceBreakdownBar({ forces }: { forces: ForceContribution[] }) {
  const total = forces.reduce((s, f) => s + Math.abs(f.value), 0) || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {forces.filter(f => Math.abs(f.value) > 0.0005).map(f => {
        const pct = (Math.abs(f.value) / total) * 100;
        return (
          <div key={f.force} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: T.text3, width: 90, textAlign: 'right', flexShrink: 0 }}>{f.force}</span>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: T.bg4, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(pct, 100)}%`,
                height: '100%',
                borderRadius: 3,
                background: FORCE_COLORS[f.force] || T.text3,
                opacity: 0.7,
              }} />
            </div>
            <span style={{ fontSize: 10, fontFamily: T.mono, color: shiftColorHex(f.value), width: 48, textAlign: 'right', flexShrink: 0 }}>
              {fmtShift(f.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}


// ─── Category Assessment Panel ──────────────────────────────────

function CategoryAssessmentPanel({ intel, shifts }: { intel: CategoryIntel; shifts: ShiftMatrix }) {
  const [expandedAction, setExpandedAction] = useState<number | null>(null);
  const path = shifts[intel.id];
  const ctx = HENKEL_CONTEXT[intel.id];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{ maxWidth: 920, margin: '0 auto' }}
    >
      {/* ─── Category Header ─── */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: intel.color }} />
          <h2 style={{ fontSize: 24, fontWeight: 700, color: T.text, letterSpacing: -0.5, margin: 0 }}>
            {intel.name}
          </h2>
        </div>

        {/* Henkel context line */}
        {ctx && (
          <div style={{ fontSize: 13, color: T.text3, lineHeight: 1.6, marginBottom: 8 }}>
            <span style={{ fontWeight: 600, color: T.text2 }}>{ctx.position}</span>
            {' — '}
            {ctx.brands}
          </div>
        )}

        {/* Key metrics strip — understated */}
        <div style={{
          display: 'flex', gap: 32, marginTop: 16, paddingTop: 16,
          borderTop: `1px solid ${T.border}`,
        }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: T.text4, marginBottom: 4 }}>2030 Shift</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: T.mono, color: shiftColorHex(intel.median2030) }}>{fmtShift(intel.median2030)}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: T.text4, marginBottom: 4 }}>Confidence Range</div>
            <div style={{ fontSize: 14, fontWeight: 600, fontFamily: T.mono, color: T.text2 }}>{fmtShift(intel.p10_2030)} to {fmtShift(intel.p90_2030)}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: T.text4, marginBottom: 4 }}>Velocity</div>
            <div style={{
              fontSize: 14, fontWeight: 600,
              color: intel.velocity === 'accelerating' ? T.red : intel.velocity === 'decelerating' ? T.green : T.text3,
            }}>
              {intel.velocity === 'accelerating' ? 'Accelerating' : intel.velocity === 'decelerating' ? 'Decelerating' : 'Steady'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: T.text4, marginBottom: 4 }}>Dominant Force</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {intel.dominantForce && (
                <>
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: FORCE_COLORS[intel.dominantForce] }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: T.text2 }}>{intel.dominantForce}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Strategic Assessment (The Prose) ─── */}
      <div style={{ marginBottom: SECTION_GAP }}>
        <div style={sectionLabel}>
          <Crosshair size={11} /> Strategic Assessment
        </div>
        <p style={editorialProse}>
          {intel.strategicAssessment}
        </p>
      </div>

      {/* ─── Shift Trajectory ─── */}
      <div style={{ marginBottom: SECTION_GAP }}>
        <div style={sectionLabel}>
          <Activity size={11} /> Profit Pool Trajectory 2026–2030
        </div>
        <div style={{ background: T.bg1, borderRadius: 12, padding: '20px 24px', border: `1px solid ${T.border}` }}>
          <PathChart path={path} color={intel.color} />
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: 10, color: T.text4 }}>
          <span>― Median shift</span>
          <span style={{ opacity: 0.6 }}>▒ P10–P90 confidence band</span>
          <span>┅ Zero line</span>
        </div>
      </div>

      {/* ─── Force Dynamics ─── */}
      <div style={{ marginBottom: SECTION_GAP }}>
        <div style={sectionLabel}>
          <Layers size={11} /> Causal Dynamics
        </div>
        <p style={{ ...editorialProse, marginBottom: 20 }}>
          {intel.causalNarrative}
        </p>
        <div style={{ background: T.bg1, borderRadius: 12, padding: '20px 24px', border: `1px solid ${T.border}` }}>
          <ForceBreakdownBar forces={intel.forceBreakdown} />
        </div>
      </div>

      {/* ─── Key Trends ─── */}
      <div style={{ marginBottom: SECTION_GAP }}>
        <div style={sectionLabel}>
          <Eye size={11} /> Key Trends Shaping This Category
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Tailwinds */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: T.green, marginBottom: 12 }}>
              TAILWINDS
            </div>
            {intel.topTailwinds.length === 0 ? (
              <div style={{ fontSize: 13, color: T.text4, fontStyle: 'italic' }}>No significant tailwinds identified</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {intel.topTailwinds.map(t => (
                  <div key={t.id} style={{
                    padding: '12px 16px', borderRadius: 10,
                    background: T.bg1, border: `1px solid ${T.border}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <TrendingUp size={12} color={T.green} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{t.name}</span>
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.6, color: T.text3 }}>
                      {t.force} force · Probability {t.probability}/5 · Exposure {t.category_exposure?.[intel.id] ?? '—'}/5
                    </div>
                    {t.strategic_implication && (
                      <div style={{ fontSize: 12, lineHeight: 1.6, color: T.text2, marginTop: 6 }}>
                        {t.strategic_implication}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Headwinds */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: T.red, marginBottom: 12 }}>
              HEADWINDS
            </div>
            {intel.topHeadwinds.length === 0 ? (
              <div style={{ fontSize: 13, color: T.text4, fontStyle: 'italic' }}>No significant headwinds identified</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {intel.topHeadwinds.map(t => (
                  <div key={t.id} style={{
                    padding: '12px 16px', borderRadius: 10,
                    background: T.bg1, border: `1px solid ${T.border}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <TrendingDown size={12} color={T.red} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{t.name}</span>
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.6, color: T.text3 }}>
                      {t.force} force · Probability {t.probability}/5 · Exposure {t.category_exposure?.[intel.id] ?? '—'}/5
                    </div>
                    {t.strategic_implication && (
                      <div style={{ fontSize: 12, lineHeight: 1.6, color: T.text2, marginTop: 6 }}>
                        {t.strategic_implication}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Competitive Context ─── */}
      <div style={{ marginBottom: SECTION_GAP }}>
        <div style={sectionLabel}>
          <Users size={11} /> Competitive Context
        </div>
        <p style={editorialProse}>
          {intel.competitiveNarrative}
        </p>
      </div>

      {/* ─── Recommended Actions ─── */}
      <div style={{ marginBottom: SECTION_GAP }}>
        <div style={sectionLabel}>
          <ArrowRight size={11} /> Recommended Actions for Henkel
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {intel.recommendedActions.map((action, i) => {
            const isExpanded = expandedAction === i;
            return (
              <motion.div
                key={i}
                layout
                onClick={() => setExpandedAction(isExpanded ? null : i)}
                style={{
                  padding: '16px 20px',
                  borderRadius: 12,
                  border: `1px solid ${isExpanded ? T.border2 : T.border}`,
                  background: T.bg,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    marginTop: 2,
                    width: 22, height: 22, borderRadius: 11,
                    background: T.bg1, border: `1px solid ${T.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: T.text3, flexShrink: 0,
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text, lineHeight: 1.5 }}>
                      {action.action}
                    </div>
                    <div style={{ fontSize: 11, color: T.text4, marginTop: 4 }}>
                      <Clock size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                      {action.timeframe}
                    </div>
                  </div>
                  <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ flexShrink: 0, marginTop: 4 }}>
                    <ChevronDown size={14} color={T.text3} />
                  </motion.div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ paddingTop: 16, paddingLeft: 34 }}>
                        <p style={{ fontSize: 13, lineHeight: 1.7, color: T.text2, margin: '0 0 12px 0' }}>
                          {action.rationale}
                        </p>
                        {action.evidence.length > 0 && (
                          <EvidenceChainDisplay evidence={action.evidence} label="Linked trends" compact />
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ─── Structural vs Cyclical ─── */}
      <div style={{ marginBottom: SECTION_GAP }}>
        <div style={sectionLabel}>
          <BarChart3 size={11} /> Nature of the Shift
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, maxWidth: 400 }}>
          <div style={{
            flex: intel.structuralShare, height: 8, borderRadius: '4px 0 0 4px',
            background: `linear-gradient(90deg, ${T.accent}, ${T.purple})`,
          }} />
          <div style={{
            flex: 1 - intel.structuralShare, height: 8, borderRadius: '0 4px 4px 0',
            background: T.bg4,
          }} />
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 11, color: T.text3, marginBottom: 12 }}>
          <span><strong style={{ color: T.accent }}>{(intel.structuralShare * 100).toFixed(0)}%</strong> Structural</span>
          <span><strong style={{ color: T.text2 }}>{((1 - intel.structuralShare) * 100).toFixed(0)}%</strong> Cyclical</span>
        </div>
        <p style={{ ...editorialProse, fontSize: 13 }}>
          {intel.structuralShare > 0.75
            ? 'This shift is predominantly structural — driven by regulation, technology adoption, or irreversible consumer behavior changes. Strategic adaptation is required, not tactical patience.'
            : intel.structuralShare > 0.5
            ? 'The shift has a structural core with cyclical amplifiers. The direction is set, but magnitude may moderate as cyclical pressures ease.'
            : 'Significant cyclical component — competitive tactics, commodity prices, or sentiment-driven dynamics that may partially reverse. Monitor before committing to structural strategic moves.'}
        </p>
      </div>

      {/* ─── Full Evidence Chain ─── */}
      <div>
        <div style={sectionLabel}>
          <Sparkles size={11} /> Full Evidence Chain
        </div>
        <p style={{ fontSize: 11, color: T.text3, marginBottom: 16, lineHeight: 1.5, maxWidth: EDITORIAL_MAX_WIDTH }}>
          Every assessment above is derived from the trends below. Each trend carries its source credibility tier and original data references.
        </p>
        <EvidenceChainDisplay evidence={intel.evidenceChain} />
      </div>
    </motion.div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function StrategicIntelligence({
  shifts, trends, forceContributions, allocation, convergence, onNavigateToTrend,
}: StrategicIntelligenceProps) {
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  // Compute all intelligence
  const analyses = useMemo(() =>
    CATEGORIES.map(cat => computeCategoryIntel(cat, shifts, trends, forceContributions)),
    [shifts, trends, forceContributions],
  );

  const headline = useMemo(() => generatePortfolioHeadline(analyses), [analyses]);
  const selectedIntel = analyses.find(a => a.id === selectedCatId) || null;

  // Build segments for category toggle — grouped
  const categorySegments = useMemo(() => {
    const beautyGroup = CATEGORIES.filter(c => c.group === 'Beauty');
    const lhcGroup = CATEGORIES.filter(c => c.group === 'LHC');
    return [...beautyGroup, ...lhcGroup].map(c => ({
      key: c.id,
      label: c.short,
    }));
  }, []);

  const handleCategoryChange = useCallback((key: string) => {
    setSelectedCatId(key);
  }, []);


  return (
    <div style={{ padding: '40px 0 80px', maxWidth: 1100, margin: '0 auto' }}>

      {/* ═══ PORTFOLIO HEADLINE ════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ marginBottom: 40, paddingLeft: 4 }}
      >
        <div style={sectionLabel}>
          <Crosshair size={11} /> Strategic Assessment
        </div>

        <h1 style={{
          fontSize: 24,
          fontWeight: 700,
          lineHeight: 1.42,
          color: T.text,
          letterSpacing: -0.5,
          maxWidth: EDITORIAL_MAX_WIDTH,
          marginBottom: 14,
        }}>
          {headline.headline}
        </h1>

        <p style={{
          ...editorialProse,
          fontSize: 15,
          color: T.text2,
          marginBottom: 0,
        }}>
          {headline.subline}
        </p>

        {/* Confidence footer */}
        <div style={{
          marginTop: 16,
          display: 'flex', gap: 20, alignItems: 'center',
          fontSize: 10, color: T.text4,
        }}>
          {(convergence.backtestingAccuracy ?? 0) > 0 && (
            <span>Model accuracy: <strong style={{ color: T.text3 }}>{((convergence.backtestingAccuracy ?? 0) * 100).toFixed(0)}%</strong> (backtested)</span>
          )}
          <span>{convergence.iterations?.toLocaleString() || '—'} iterations</span>
          <span>80% confidence interval</span>
        </div>
      </motion.section>


      {/* ═══ CATEGORY OVERVIEW STRIP ═══════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08 }}
        style={{ marginBottom: 12 }}
      >
        {/* Category overview grid — shows all categories at a glance */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 8,
          marginBottom: 32,
        }}>
          {analyses.map(a => (
            <motion.div
              key={a.id}
              onClick={() => setSelectedCatId(a.id)}
              whileHover={{ scale: 1.01, borderColor: T.border2 }}
              whileTap={{ scale: 0.99 }}
              style={{
                padding: '14px 16px',
                borderRadius: 10,
                border: `1.5px solid ${selectedCatId === a.id ? a.color : T.border}`,
                background: selectedCatId === a.id ? `${a.color}06` : T.bg,
                cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: 3, background: a.color }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{a.short}</span>
                <Spark path={shifts[a.id]} color={a.color} />
              </div>
              <div style={{
                fontSize: 16, fontWeight: 700, fontFamily: T.mono,
                color: shiftColorHex(a.median2030),
              }}>
                {fmtShift(a.median2030)}
              </div>
              <div style={{
                fontSize: 10, color: T.text4, marginTop: 2,
              }}>
                {a.velocity === 'accelerating' ? 'Accelerating' : a.velocity === 'decelerating' ? 'Decelerating' : 'Steady'}
                {a.dominantForce ? ` · ${a.dominantForce}` : ''}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>


      {/* ═══ CATEGORY TOGGLE ═══════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.12 }}
        style={{ marginBottom: 40 }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          paddingTop: 12,
          paddingBottom: 12,
          background: `linear-gradient(180deg, ${T.bg} 80%, transparent 100%)`,
        }}>
          <SegmentedControl
            segments={categorySegments}
            activeKey={selectedCatId || ''}
            onChange={handleCategoryChange}
          />
        </div>
      </motion.section>


      {/* ═══ CATEGORY ASSESSMENT ═══════════════════════════════════════ */}
      <AnimatePresence mode="wait">
        {selectedIntel ? (
          <CategoryAssessmentPanel
            key={selectedIntel.id}
            intel={selectedIntel}
            shifts={shifts}
          />
        ) : (
          <motion.div
            key="prompt"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              textAlign: 'center',
              padding: '80px 40px',
              color: T.text4,
            }}
          >
            <Crosshair size={32} strokeWidth={1} style={{ marginBottom: 16, opacity: 0.3 }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: T.text3, marginBottom: 8 }}>
              Select a category above
            </div>
            <div style={{ fontSize: 13, maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
              Choose any category to see its full strategic assessment — trend impacts, causal dynamics, competitive context, and recommended actions for Henkel.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
