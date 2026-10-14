/**
 * Drivers as GET /api/v1/drivers returns them, the admin edit and the expert
 * proposals (prism/api/routers/drivers.py, prism/api/proposals.py).
 */
import type { SOURCE_TIERS } from '@/lib/format';
import type { Confidence, Direction, ForceName } from './index';

/** Credibility tier of a source, from S (official statistics, regulators) to E (social media). */
export type SourceTier = (typeof SOURCE_TIERS)[number];

/** One piece of evidence behind a driver: a title, a link or both, its tier
 *  ('' when unrated) and when it was published ("Apr 2026"). */
export interface DriverSource {
  title: string;
  url: string;
  tier: SourceTier | '';
  published: string;
}

/** Scores 0 to 5 keyed by category or by region. */
export type ExposureMap = Record<string, number>;

/** The inputs the model reads from a driver. */
export interface DriverScores {
  /** Likelihood 1 to 5; the Beta prior's mean is probability / 6. */
  probability: number;
  /** Share of the category's GP1 the driver moves at full materialisation, 0 to 1. */
  gp1_pct_affected: number;
  /** Year by which the effect is fully present. */
  peak_year: number;
  diffusion_curve: string;
  /** Spread around the modelled size and timing, 0 to 5. */
  uncertainty: number;
  /** A score 0 to 5 for every category and every region. */
  category_exposure: ExposureMap;
  regional_exposure: ExposureMap;
  /** The value-chain stage where the impact centres (a VC_STAGES name). */
  vc_epicentre: string;
}

/** One row of GET /api/v1/drivers. */
export interface Driver extends DriverScores {
  id: string;
  force: ForceName;
  name: string;
  description: string;
  direction: Direction;
  /** The onset: no effect up to and including this year. */
  start_year: number;
  confidence: Confidence;
  /** Beta-prior mean x GP1 share x direction sign: the driver's expected signed effect before exposures
   *  (the Drivers page's Expected effect column). */
  expected_effect: number;
  /** The generated PRISM Analysis text; read-only everywhere. */
  analysis: string;
  sources: DriverSource[];
  /** The scores the driver was seeded with: the reference edits and proposals are compared with. */
  baseline: DriverScores;
  /** True once an admin has changed a model input. */
  scores_edited: boolean;
  /** Goes up with every stored change; an admin edit names the revision it was made on. */
  revision: number;
  proposal_summary: ProposalSummary;
}

/**
 * Body of an admin edit (PUT /api/drivers/{id}). `revision` is the revision the
 * edit was made on: if the driver has changed since, the edit is refused (409).
 * Only the other fields sent change; an exposure map may name only the cells
 * that change.
 */
export interface DriverUpdate {
  revision: number;
  description?: string;
  direction?: Direction;
  probability?: number;
  gp1_pct_affected?: number;
  peak_year?: number;
  diffusion_curve?: string;
  uncertainty?: number;
  confidence?: Confidence;
  category_exposure?: ExposureMap;
  regional_exposure?: ExposureMap;
  vc_epicentre?: string;
  sources?: DriverSource[];
}

// ── Expert proposals ────────────────────────────────────────────────────────
// Any expert with a role, viewer or admin, may propose scores for a driver.
// A proposal never changes the driver; an admin endorses it by editing the
// driver.

/** The caller's own proposal: any subset of the scores, plus a comment. Sent as
 *  an update, a field set to null is cleared and an exposure map replaces the
 *  caller's whole map for that field. */
export interface DriverProposal {
  probability?: number | null;
  gp1_pct_affected?: number | null;
  peak_year?: number | null;
  diffusion_curve?: string | null;
  uncertainty?: number | null;
  category_exposure?: ExposureMap | null;
  regional_exposure?: ExposureMap | null;
  vc_epicentre?: string | null;
  comment?: string | null;
}

// The aggregates across experts. `count` is the number of experts who scored
// the field; a field nobody scored aggregates to null.

/** The mean, to two decimals: probability, GP1 share, an exposure cell. */
export interface MeanAggregate {
  avg: number;
  count: number;
}

/** The median: the peak year; the uncertainty, rounded half up to a whole score. */
export interface MedianAggregate {
  median: number;
  count: number;
}

/** The votes on a choice: the diffusion curve, the value-chain epicentre. */
export interface VoteAggregate {
  /** The value with more votes than any other; null on a tie, which leaves
   *  the choice to the admin. */
  mode: string | null;
  /** Votes per value. */
  distribution: Record<string, number>;
  count: number;
}

/** One expert's proposal in the "who scored what" list. */
export interface ProposalScorer {
  user_id: string;
  name: string;
  probability: number | null;
  gp1_pct_affected: number | null;
  peak_year: number | null;
  diffusion_curve: string | null;
  uncertainty: number | null;
  vc_epicentre: string | null;
  comment: string | null;
}

/** Body of GET and PUT /api/v1/drivers/{id}/proposals. */
export interface DriverProposalsResponse {
  driver_id: string;
  my: DriverProposal | null;
  aggregate: {
    probability: MeanAggregate | null;
    gp1_pct_affected: MeanAggregate | null;
    peak_year: MedianAggregate | null;
    diffusion_curve: VoteAggregate | null;
    uncertainty: MedianAggregate | null;
    vc_epicentre: VoteAggregate | null;
    /** Only the cells at least one expert scored. */
    category_exposure: Record<string, MeanAggregate>;
    regional_exposure: Record<string, MeanAggregate>;
  };
  scorers: ProposalScorer[];
}

/** The per-driver summary that comes with the driver list: what the table shows. */
export interface ProposalSummary {
  /** Number of experts with a proposal for the driver. */
  count: number;
  probability: MeanAggregate | null;
  gp1_pct_affected: MeanAggregate | null;
  my: DriverProposal | null;
}
