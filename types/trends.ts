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

/** Consumer-journey exposure mapping (v3.6 journey layer). Keys are
 *  namespaced "<journey>:<stage_id>" (e.g. "lhc:add_products",
 *  "hair:diagnose") matching data/consumerJourney.ts stage ids and
 *  pulse/config.py JOURNEY_STAGES. Values 0-5. */
export type JourneyExposure = Partial<Record<string, number>>;

/** Full trend object as returned by the API. */
export interface Trend {
  id: string;
  force: ForceName;
  sub_category?: string;
  name: string;
  description: string;
  direction: Direction;
  // (M8, July 2026 review: the phantom `impact`, `score` and
  //  `weighted_score` fields were removed — the backend never sent them;
  //  the model retired the 1–5 impact input in favour of gp1_pct_affected.)
  probability: number;   // 1-5
  start_year?: number;
  normalized_score?: number;
  /** Backend alias of normalized_score (probability-mean × gp1 × direction). */
  gp1_shift?: number;
  /** % of GP1 realistically exposed at full materialization (0.0-1.0). */
  gp1_pct_affected?: number;
  /** Year by which 100% of impact has materialized (0 = default). */
  peak_year?: number;
  /** MECE diffusion curve shape — see pulse/config.py (diffusion curves). */
  diffusion_curve?: string;
  strategic_implication?: string;
  category_exposure?: CategoryExposure;
  vc_exposure?: VCExposure;
  regional_exposure?: RegionalExposure;
  journey_exposure?: JourneyExposure;
  data_source?: string;
  source_type?: string;
  confidence?: Confidence;
  last_updated?: string;
  ai_suggested?: boolean;
  user_override?: boolean;
  /** Snapshot of the originally AI-suggested scores (captured at seed time).
   *  Lets the UI show the AI suggestion on hover and flag an endorsed trend
   *  whose truth now deviates from the AI baseline. Absent on legacy rows. */
  ai_suggestion?: TrendScoreSnapshot;
  /** Lightweight per-trend rollup of expert proposals, returned inline with the
   *  trend list so a collapsed row can show scorer counts and the caller's own
   *  score without a per-row round-trip. Full detail (named scorers, per-cell
   *  aggregates) comes from GET /trends/{id}/proposals. */
  proposal_summary?: ProposalSummary;
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
  journey_exposure?: JourneyExposure;
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

// ─── Multi-expert scoring (proposals layer) ─────────────────────────
// Non-admin experts propose scores for the seven scoreable fields; the
// AI-suggested value remains the "truth" that feeds the model until an admin
// endorses. The model only ever consumes the trend's own columns — proposals
// are a parallel, named, advisory store.

/** A snapshot of the seven scoreable fields. Used for the AI baseline and as
 *  the shape of a single expert's proposal. */
export interface TrendScoreSnapshot {
  probability?: number;        // 1-5
  gp1_pct_affected?: number;   // 0.0-1.0
  peak_year?: number;
  diffusion_curve?: string;
  category_exposure?: CategoryExposure;
  regional_exposure?: RegionalExposure;
  vc_exposure?: VCExposure;
}

/** The subset of fields a non-admin expert may propose (PUT
 *  /trends/{id}/proposals). The seven scoreable fields plus an optional
 *  free-text comment (not part of the AI snapshot). */
export interface TrendProposalPatch extends TrendScoreSnapshot {
  /** Free-text expert note attached to the proposal. */
  comment?: string;
}

/** Aggregate of expert proposals for one field. */
export interface ProposalAgg {
  /** Mean — probability, GP1%, per-cell exposures. */
  avg?: number;
  /** Median — peak year. */
  median?: number;
  /** Mode — diffusion curve (categorical). */
  mode?: string;
  /** Vote distribution — diffusion curve. */
  distribution?: Record<string, number>;
  /** How many experts scored this field. */
  count: number;
}

/** One expert's headline proposal, for the "who scored what" breakdown. */
export interface ProposalScorer {
  user_id: string;
  name: string;
  role: string;
  probability?: number;
  gp1_pct_affected?: number;
  peak_year?: number;
  diffusion_curve?: string;
  /** Free-text note this expert left with their proposal. */
  comment?: string;
}

/** Per-cell aggregate map (category / region / value-chain exposure). */
export type ProposalCellAgg = Record<string, ProposalAgg>;

/** Full proposals payload for a single trend (GET /trends/{id}/proposals). */
export interface TrendProposalsResponse {
  trend_id: string;
  /** The calling user's own current proposal (null if they haven't scored). */
  my: TrendProposalPatch | null;
  aggregate: {
    probability?: ProposalAgg | null;
    gp1_pct_affected?: ProposalAgg | null;
    peak_year?: ProposalAgg | null;
    diffusion_curve?: ProposalAgg | null;
    category_exposure?: ProposalCellAgg;
    regional_exposure?: ProposalCellAgg;
    vc_exposure?: ProposalCellAgg;
  };
  scorers: ProposalScorer[];
}

/** Lightweight rollup returned inline with each trend in the list. */
export interface ProposalSummary {
  count: number;
  probability?: ProposalAgg | null;
  gp1_pct_affected?: ProposalAgg | null;
  peak_year?: ProposalAgg | null;
  diffusion_curve?: ProposalAgg | null;
  my?: TrendProposalPatch | null;
}
