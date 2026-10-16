/**
 * Values and small helpers the Drivers page's parts share: the diffusion-curve
 * and value-chain labels, the uncertainty label and the colours of the
 * scoring modes.
 */
import { DRIVER_CODE_MAP, codeForDriverId } from '@/data/driverCodeMap';
import { EXPANSION } from '@/lib/format';
import { S } from '@/lib/theme';
import { UNCERTAINTY_LABELS } from '@/lib/uncertainty';
import { VC_STAGES, stageIndex } from '@/lib/valueChain';
import type { DriverProposal } from '@/types';

// ─── Display codes ─────────────────────────────────────────────────
/** A driver's display code ("C-01") from the generated code map: by its id,
 *  else by its name (a database seeded from an older base may carry an id the
 *  map does not know); undefined when neither matches. */
export const driverCode = (d: { id: string; name: string }): string | undefined =>
  codeForDriverId(d.id) ?? Object.entries(DRIVER_CODE_MAP).find(([, v]) => v.name === d.name)?.[0];

// ─── A proposal counts as a rating ─────────────────────────────────
/** The rule behind the Rated pill and the rating progress: a proposal with a
 *  probability, a GP1 share and at least one category exposure. */
export const isRated = (my: DriverProposal | null | undefined): boolean =>
  my?.probability != null && my.gp1_pct_affected != null
  && !!my.category_exposure && Object.keys(my.category_exposure).length > 0;

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

/** The plain reading of each score (docs/DRIVERS.md, the uncertainty table). */
const UNCERTAINTY_READINGS: readonly string[] = [
  'fixed by law or contract, no material dispersion',
  'size within about 25 percent either way, timing dated or within a year',
  'well-evidenced mechanism, size within about 50 percent, timing within one to two years',
  'size could be half or double, or the onset depends on an undated trigger',
  'size could be near zero or more than double',
  'the sign could differ across scenarios, or the effect may not materialise at all',
];
/** "Uncertainty 3: size could be half or double, or the onset depends on an undated trigger". */
export const uncReading = (v: number | null | undefined): string =>
  v == null ? 'Uncertainty unscored' : `Uncertainty ${Math.round(v)}: ${UNCERTAINTY_READINGS[Math.round(v)]}`;
