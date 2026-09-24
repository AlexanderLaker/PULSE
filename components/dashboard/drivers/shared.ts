/**
 * Values and small helpers the Drivers page's parts share: the diffusion-curve
 * and value-chain labels, the uncertainty label and the colours of the
 * scoring modes.
 */
import { EXPANSION } from '@/lib/format';
import { S } from '@/lib/theme';
import { UNCERTAINTY_LABELS } from '@/lib/uncertainty';
import { VC_STAGES, stageIndex } from '@/lib/valueChain';

// ─── Diffusion curves ─────────────────────────────────────────────
// The shapes of prism/config.py compute_materialization_schedule.
export const DIFFUSION_LABELS: Record<string, { label: string; description: string }> = {
  s_curve:       { label: 'S-Curve',       description: 'Logistic: slow start, fast middle, plateau.' },
  linear:        { label: 'Linear',        description: 'Steady, constant rate of materialisation.' },
  front_loaded:  { label: 'Front-Loaded',  description: 'Fast early impact, flattens over time (√t).' },
  back_loaded:   { label: 'Back-Loaded',   description: 'Slow start, accelerates late (t²).' },
  step_function: { label: 'Step Function', description: 'Near zero until 80 percent of the way to the peak, then a steep rise.' },
};
export const curveLabel = (curve: string): string => DIFFUSION_LABELS[curve]?.label ?? curve;

// ─── Value-chain epicentre ─────────────────────────────────────────
// A driver's value chain is one stage, the epicentre of its impact
// (lib/valueChain.ts). Review & Endorse treats the stage as a category:
// expert picks are counted as votes, never averaged, since a Supply Chain
// vote and two Commercial votes must not blend into Marketing.

const vcZone = (index: number): string =>
  index <= 3 ? 'upstream' : index === 4 ? 'mid-chain' : 'downstream';
/** A stage with its part of the chain ("Marketing · downstream"), or "unscored"
 *  for a proposal that names none. */
export const vcStageLabel = (stage: string | null | undefined): string => {
  const i = stageIndex(stage);
  return i < 0 ? 'unscored' : `${VC_STAGES[i]} · ${vcZone(i)}`;
};
/** A stage's pin position on the rail: the centre of its eighth. */
export const vcPos = (stage: string): string => `${(((stageIndex(stage) + 0.5) / 8) * 100).toFixed(2)}%`;

/** The table's mode: Driver List, Expert Rating or Review & Endorse (Drivers.tsx
 *  describes them). */
export type ScoringMode = 'list' | 'rating' | 'review';

export const EXPERT_COLOR   = S.expert;    // the expert aggregate: violet
export const REVIEWED_COLOR = EXPANSION;   // an edited or endorsed value, a finished review: green
export const DELTA_COLOR    = S.delta;     // the delta chip: gold

// Uncertainty: the labels of the six scores; lib/uncertainty.ts also holds
// what the engine makes of them (the Beta concentration, the peak-year jitter).
// A proposal may leave the score empty ("unscored").
export const uncLabel = (v: number | null | undefined): string =>
  v == null ? 'unscored' : `${v} · ${UNCERTAINTY_LABELS[Math.round(v)]}`;
