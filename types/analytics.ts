/**
 * PULSE — Analytics types (Amendment M).
 * CVaR, Sobol sensitivity, tipping points, reverse stress testing.
 */

import type { ForceName } from './index';

/** Conditional Value at Risk result. */
export interface CVaRResult {
  cvar_5: number;       // 5th percentile CVaR
  cvar_10: number;      // 10th percentile CVaR
  var_5: number;        // 5th percentile VaR
  var_10: number;       // 10th percentile VaR
  expected_shortfall: number;
  tail_distribution?: number[];
  categories?: Record<string, {
    cvar_5: number;
    var_5: number;
  }>;
}

/** Sobol sensitivity index for a single parameter. */
export interface SobolIndex {
  parameter: string;
  force?: ForceName;
  S1: number;           // First-order
  ST: number;           // Total-order
  S1_conf?: number;     // Confidence interval
  ST_conf?: number;
}

/** Full Sobol analysis result. */
export interface SobolResult {
  indices: SobolIndex[];
  total_variance: number;
  convergence_metric?: number;
}

/** Tipping point for a category. */
export interface TippingPoint {
  category: string;
  trigger_force: ForceName;
  trigger_trend?: string;
  threshold_score: number;
  current_score: number;
  distance_to_tip: number;
  consequence: string;
  severity: 'critical' | 'warning' | 'watch';
}

/** Tipping points analysis result. */
export interface TippingPointsResult {
  tipping_points: TippingPoint[];
  most_vulnerable_category?: string;
}

/** Reverse stress test parameters. */
export interface ReverseStressParams {
  target_shift: number;
  category?: string;
}

/** Reverse stress test result. */
export interface ReverseStressResult {
  required_changes: Array<{
    trend_id: string;
    trend_name: string;
    force: ForceName;
    current_score: number;
    required_score: number;
    change_needed: number;
  }>;
  feasibility: 'plausible' | 'unlikely' | 'extreme';
  narrative?: string;
}

/** Aggregated analytics state for the dashboard. */
export interface AnalyticsState {
  cvar: CVaRResult | null;
  sobol: SobolResult | null;
  tips: TippingPointsResult | null;
}

/** AI suggestion from the scanner. */
export interface AISuggestion {
  id: number;
  suggestion_date: string;
  suggestion_type: string;
  content: string;
  source_urls?: string;
  status: 'pending' | 'accepted' | 'rejected';
  user_decision_date?: string;
  user_notes?: string;
}
