/**
 * PULSE — Trend data types.
 * Maps to pulse/ingestion/models.py Trend dataclass.
 */

import type {
  ForceName, Direction, Confidence, CategoryId, ValueChainStep,
} from './index';

/** A single external evidence source for a trend. */
export interface TrendSource {
  title: string;
  url: string;
  data: string;
}

/** Bayesian posterior parameters (Beta distribution). */
export interface BetaPosterior {
  alpha: number;
  beta: number;
}

/** Category exposure mapping (category → 0-5 score). */
export type CategoryExposure = Partial<Record<CategoryId, number>>;

/** Value chain exposure mapping (step → 0-5 score). */
export type VCExposure = Partial<Record<ValueChainStep, number>>;

/** Regional exposure regions. */
export type Region = 'Europe' | 'North America' | 'Asia' | 'High Growth';

/** Regional exposure mapping (region → 0-5 score). */
export type RegionalExposure = Partial<Record<Region, number>>;

/** Full trend object as returned by the API. */
export interface Trend {
  id: string;
  force: ForceName;
  sub_category?: string;
  name: string;
  description: string;
  direction: Direction;
  impact: number;        // 1-5
  probability: number;   // 1-5
  start_year?: number;
  weighted_score?: number;
  normalized_score?: number;
  score?: number;        // impact × probability (for display)
  gp1_shift?: number;    // computed shift
  gp1_pct_affected?: number;  // 0.0-1.0: fraction of category GP1 exposed
  strategic_implication?: string;
  category_exposure?: CategoryExposure;
  vc_exposure?: VCExposure;
  regional_exposure?: RegionalExposure;
  data_source?: string;
  source_type?: string;
  confidence?: Confidence;
  last_updated?: string;
  ai_suggested?: boolean;
  user_override?: boolean;
  sources?: TrendSource[];

  // Delphi metadata
  scorer_count?: number;
  score_variance?: number;
  debiasing_applied?: boolean;

  // Bayesian posteriors
  impact_posterior?: BetaPosterior;
  probability_posterior?: BetaPosterior;

  // Materialization timing
  peak_year?: number;       // Year when 100% impact materializes (0 = default 2030)
  diffusion_curve?: string; // s_curve | linear | front_loaded | back_loaded | step_function
}

/** Subset of Trend fields that can be updated via PUT /trends/{id}. */
export interface TrendUpdate {
  impact?: number;
  probability?: number;
  direction?: Direction;
  gp1_pct_affected?: number;
  description?: string;
  strategic_implication?: string;
  confidence?: Confidence;
  category_exposure?: CategoryExposure;
  vc_exposure?: VCExposure;
  regional_exposure?: RegionalExposure;
}

/** Force contribution to a category shift. */
export interface ForceContribution {
  force: ForceName;
  value: number;
  normalized: number;
}
