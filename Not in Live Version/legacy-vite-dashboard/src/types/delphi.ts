/**
 * PRISM — Delphi Expert Elicitation types.
 * Maps to pulse/elicitation/delphi.py and API routes.
 */

/** Delphi session overview (list view). */
export interface DelphiSessionSummary {
  session_id: string;
  name: string;
  status: 'active' | 'completed';
  current_round: number;
  scorer_count: number;
  trend_count: number;
  created_at: string;
}

/** Full Delphi session detail. */
export interface DelphiSession {
  session_id: string;
  name: string;
  status: 'active' | 'completed';
  current_round: number;
  trend_ids: string[];
  scorer_ids: string[];
  rounds: DelphiRoundDetail[];
  calibration_applied: boolean;
  created_at: string;
}

/** Detail for a single scoring round. */
export interface DelphiRoundDetail {
  round_number: number;
  scores_submitted: number;
  total_expected: number;
  completed: boolean;
}

/** Score submission payload. */
export interface DelphiScoreSubmission {
  scorer_id: string;
  trend_id: string;
  probability: number;  // 1-5
  rationale: string;    // min 20 chars
  round_number?: number;
}

/** Score entry returned from API. */
export interface DelphiScore {
  scorer_id: string;
  trend_id: string;
  probability: number;
  rationale: string;
  round_number: number;
  calibration_factor?: number;
  bias_flags?: string[];
  submitted_at: string;
}

/** Distribution statistics for a single dimension. */
export interface ScoreDistribution {
  scores: number[];
  median: number;
  mean: number;
  std: number;
  min: number;
  max: number;
}

/** Trend-level score distribution in a round summary. */
export interface TrendScoreDistribution {
  probability: ScoreDistribution;
  score_count: number;
}

/** Round summary with anonymized distributions. */
export interface DelphiRoundSummary {
  session_id: string;
  round_number: number;
  trend_distributions: Record<string, TrendScoreDistribution>;
}

/** Calibration result for a scorer. */
export interface CalibrationResult {
  scorer_id: string;
  calibration_factor: number;
  bias_detected: string[];
  accuracy_score: number;
  historical_comparisons?: Array<{
    trend: string;
    predicted: number;
    actual: number;
    error: number;
  }>;
}

/** Consensus result after session completion. */
export interface DelphiConsensus {
  session_id: string;
  consensus_scores: Record<string, {
    probability: number;
    confidence: number;
    agreement_level: string;
  }>;
  krippendorff_alpha?: number;
  rounds_completed: number;
}

/** Scorer view: one scorer's scores across all trends. */
export interface ScorerView {
  scorer_id: string;
  scores: DelphiScore[];
  calibration?: CalibrationResult;
}

/** Session creation payload. */
export interface CreateDelphiSessionPayload {
  name: string;
  trend_ids: string[];
  scorer_ids: string[];
}
