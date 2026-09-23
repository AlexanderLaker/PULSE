/**
 * Drivers as GET /api/v1/drivers returns them, the admin edit and the expert
 * proposals (prism/api/routers/drivers.py, prism/api/proposals.py).
 */
import type { Confidence, Direction, ForceName } from './index';

/** Credibility tier of a source, from S (official statistics, regulators) to E (social media). */
export type SourceTier = 'S' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C' | 'D' | 'E';

/** One piece of evidence behind a driver. `note` usually holds the publication date. */
export interface DriverSource {
  title: string;
  url: string;
  tier: SourceTier | '';
  note: string;
}

/** Scores 0 to 5 keyed by category, region or value-chain stage. */
export type ExposureMap = Record<string, number>;

/** The inputs the model reads from a driver. */
export interface DriverScores {
  /** Likelihood 1 to 5; the Beta prior's mean is probability / 6. */
  probability: number;
  /** Share of the exposed gross profit affected at full materialisation, 0 to 1. */
  gp1_pct_affected: number;
  /** Year by which the effect is fully present. */
  peak_year: number;
  diffusion_curve: string;
  /** Spread around the modelled size and timing, 0 to 5. Null only for a driver
   *  stored without a score, which the production run refuses until it has one. */
  uncertainty: number | null;
  category_exposure: ExposureMap;
  regional_exposure: ExposureMap;
  vc_exposure: ExposureMap;
}

/** One row of GET /api/v1/drivers. */
export interface Driver extends DriverScores {
  id: string;
  force: ForceName;
  name: string;
  description: string;
  direction: Direction;
  /** Year the effect starts to materialise. */
  start_year: number;
  confidence: Confidence;
  /** Beta mean x GP1 share x direction sign: the driver's signed weight before exposures. */
  normalized_score: number;
  /** The generated PRISM Analysis text; read-only everywhere. */
  analysis: string;
  sources: DriverSource[];
  /** The scores the driver was seeded with; null for a driver added without them. */
  baseline: DriverScores | null;
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
  /** null clears the score. */
  uncertainty?: number | null;
  confidence?: Confidence;
  category_exposure?: ExposureMap;
  regional_exposure?: ExposureMap;
  vc_exposure?: ExposureMap;
  sources?: DriverSource[];
}

// ── Expert proposals ────────────────────────────────────────────────────────
// Any signed-in expert may propose scores for a driver. A proposal never
// changes the driver; an admin endorses it by editing the driver.

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
  vc_exposure?: ExposureMap | null;
  comment?: string | null;
}

/** Aggregate of one field across experts. */
export interface ProposalAgg {
  /** Mean: probability, GP1 share, exposure cells. */
  avg?: number;
  /** Median: peak year, uncertainty. */
  median?: number;
  /** Most frequent value: diffusion curve. */
  mode?: string;
  /** Votes per value: diffusion curve. */
  distribution?: Record<string, number>;
  /** Number of experts who scored the field. */
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
  /** Read for the expert's value-chain epicentre vote. */
  vc_exposure: ExposureMap | null;
  comment: string | null;
}

/** Body of GET and PUT /api/v1/drivers/{id}/proposals. */
export interface DriverProposalsResponse {
  driver_id: string;
  my: DriverProposal | null;
  aggregate: {
    probability: ProposalAgg | null;
    gp1_pct_affected: ProposalAgg | null;
    peak_year: ProposalAgg | null;
    diffusion_curve: ProposalAgg | null;
    uncertainty: ProposalAgg | null;
    category_exposure: Record<string, ProposalAgg>;
    regional_exposure: Record<string, ProposalAgg>;
    vc_exposure: Record<string, ProposalAgg>;
  };
  scorers: ProposalScorer[];
}

/** The per-driver summary that comes with the driver list. */
export interface ProposalSummary {
  count: number;
  probability: ProposalAgg | null;
  gp1_pct_affected: ProposalAgg | null;
  peak_year: ProposalAgg | null;
  diffusion_curve: ProposalAgg | null;
  uncertainty: ProposalAgg | null;
  my: DriverProposal | null;
}
