/**
 * PRISM — Trend data types.
 * Maps to pulse/ingestion/models.py Trend dataclass.
 */

import type {
  ForceName, Direction, Confidence, CategoryId, ValueChainStep,
} from './index';

/** Source tier — editorial credibility rating assigned to a single evidence
 *  source. Mirrors the backend classification (S=official regulator → E=social). */
export type SourceTier = 'S' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C' | 'D' | 'E';

/** A single external evidence source for a trend. */
export interface TrendSource {
  title: string;
  url: string;
  data: string;
  /** Credibility tier — optional so legacy sources without a rating still render. */
  tier?: SourceTier;
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

/** Regional exposure mapping (region → 0-5 score). Keys are backend
 *  display names ("Europe", "North America", "Asia", "High Growth"). */
export type RegionalExposure = Partial<Record<string, number>>;

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
  /** % of GP1 realistically exposed at full materialization (0.0-1.0). */
  gp1_pct_affected?: number;
  /** Year by which 100% of impact has materialized (0 = default). */
  peak_year?: number;
  /** MECE diffusion curve shape — see lib/calibration.ts. */
  diffusion_curve?: string;
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
}

/** Subset of Trend fields that can be updated via PUT /trends/{id}. */
export interface TrendUpdate {
  impact?: number;
  probability?: number;
  direction?: Direction;
  description?: string;
  strategic_implication?: string;
  confidence?: Confidence;
  category_exposure?: CategoryExposure;
  vc_exposure?: VCExposure;
  regional_exposure?: RegionalExposure;
  gp1_pct_affected?: number;
  peak_year?: number;
  diffusion_curve?: string;
  sources?: TrendSource[];
  name?: string;
}

/** Force contribution to a category shift. */
export interface ForceContribution {
  force: ForceName;
  value: number;
  normalized: number;
}
