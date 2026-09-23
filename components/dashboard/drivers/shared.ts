/**
 * Values and small helpers the Drivers page's parts share: the diffusion-curve
 * and value-chain labels, the uncertainty label, the colours of the scoring
 * modes and a driver's baseline.
 */
import { CATEGORY_NAMES, EXPANSION, REGIONS } from '@/lib/format';
import { S } from '@/lib/theme';
import { UNCERTAINTY_LABELS } from '@/lib/uncertainty';
import { VC_STEPS } from '@/lib/valueChain';
import type { Driver, DriverProposal, DriverScores, ExposureMap } from '@/types';

// ─── Diffusion curves ─────────────────────────────────────────────
export const DIFFUSION_LABELS: Record<string, { label: string; description: string }> = {
  s_curve:       { label: 'S-Curve',       description: 'Logistic: slow start, fast middle, plateau.' },
  linear:        { label: 'Linear',        description: 'Steady, constant rate of materialization.' },
  front_loaded:  { label: 'Front-Loaded',  description: 'Fast early impact, flattens over time (√t).' },
  back_loaded:   { label: 'Back-Loaded',   description: 'Slow start, accelerates late (t²).' },
  step_function: { label: 'Step Function', description: 'Near-zero until ~80%, then sudden jump.' },
};
export const curveLabel = (curve: string): string => DIFFUSION_LABELS[curve]?.label ?? curve;

// ─── Value chain epicentre ─────────────────────────────────────────
// A driver's value chain is entered and read as one stage, the epicentre of
// its impact (lib/valueChain.ts). Review & Endorse treats the stage as a
// category: expert picks are counted as votes, never averaged, since a
// Supply Chain vote and two Commercial votes must not blend into Marketing.

const vcZone = (stage: number): string =>
  stage <= 4 ? 'upstream' : stage === 5 ? 'mid-chain' : 'downstream';
export const vcStageLabel = (stage: number | null): string =>
  stage == null ? 'unscored' : `${VC_STEPS[stage - 1]} · ${vcZone(stage)}`;
/** A stage's pin position on the rail: the centre of its eighth. */
export const vcPos = (stage: number): string => `${(((stage - 0.5) / 8) * 100).toFixed(2)}%`;

/** The table's mode: Driver List, Expert Rating or Review & Endorse (Drivers.tsx
 *  describes them). */
export type ScoringMode = 'list' | 'input' | 'review';

export const EXPERT_COLOR   = S.expert;    // the expert aggregate: violet
export const REVIEWED_COLOR = EXPANSION;   // an edited or endorsed value, a finished review: green
export const DELTA_COLOR    = S.delta;     // the delta chip: gold

/** The scores a driver is compared with: its baseline, or its own scores
 *  while no admin has edited it. Null for an edited driver without a baseline. */
export const baselineOf = (d: Driver): DriverScores | null => d.baseline ?? (d.scores_edited ? null : d);

// Uncertainty: the labels of the six scores; lib/uncertainty.ts also holds
// what the engine makes of them (the Beta concentration, the peak-year jitter).
export const uncLabel = (v: number | null | undefined): string =>
  v == null ? 'unscored' : `${v} · ${UNCERTAINTY_LABELS[Math.max(0, Math.min(5, Math.round(v)))]}`;

const TAXONOMY: Record<'category_exposure' | 'regional_exposure' | 'vc_exposure', ReadonlySet<string>> = {
  category_exposure: new Set(CATEGORY_NAMES),
  regional_exposure: new Set(REGIONS),
  vc_exposure: new Set<string>(VC_STEPS),
};

/** A proposal whose exposure maps keep only the taxonomy's names: the API
 *  refuses any other name, so a draft taken from a stored proposal that holds
 *  one could never be saved. */
export function proposalOnTaxonomy(p: DriverProposal): DriverProposal {
  const out: DriverProposal = { ...p };
  for (const field of Object.keys(TAXONOMY) as Array<keyof typeof TAXONOMY>) {
    const map = p[field];
    if (map) {
      out[field] = Object.fromEntries(Object.entries(map).filter(([k]) => TAXONOMY[field].has(k))) as ExposureMap;
    }
  }
  return out;
}
