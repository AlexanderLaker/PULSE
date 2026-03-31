/**
 * PRISM — Simulation & Shift Matrix types.
 * Maps to the core Shift Matrix output contract (CLAUDE.md §2).
 */

import type {
  CategoryId, ForceName, ModelType, ProjectionYear,
  YearRecord, CategoryRecord,
} from './index';

/** Percentile distribution for a single year. */
export interface PercentileDistribution {
  median: number;
  p10?: number;
  p25?: number;
  p75?: number;
  p90?: number;
}

/** Shift path for a single category across all projection years. */
export type ShiftPath = Record<number, PercentileDistribution | number>;

/** Full shifts object: category → year → percentile data. */
export type ShiftMatrix = Record<string, ShiftPath>;

/** Velocity data: year-over-year rate of change. */
export type VelocityPath = YearRecord<number>;

/** Early-warning trigger definition. */
export interface ShiftTrigger {
  condition: string;
  alert: string;
  year?: number;
  threshold?: number;
}

/** Trigger status from the API. */
export interface TriggerStatus {
  id: number;
  category: string;
  condition_type: string;
  threshold: number;
  target_year: number;
  action_text: string;
  status: 'active' | 'fired' | 'dismissed';
  fired_date?: string;
}

/** Causal decomposition: how forces drive category shifts. */
export interface CausalDecomposition {
  direct_effects?: Record<string, number>;
  propagated_effects?: Record<string, number>;
}

/** Allocation recommendation from the optimizer. */
export interface AllocationRecommendation {
  invest_more?: string[];
  defend?: string[];
  harvest?: string[];
  rationale?: string;
  weights?: Record<string, number>;
}

/** Convergence diagnostics from Monte Carlo simulation. */
export interface ConvergenceDiagnostics {
  converged: boolean;
  r_hat?: number;
  ess?: number;
  backtestingAccuracy?: number;
  backtesting_accuracy?: number;
  iterations?: number;
  model_type?: ModelType;
}

/** Full simulation result from POST /simulate. */
export interface SimulationResult {
  shifts: ShiftMatrix;
  shift_matrix?: ShiftMatrix;
  causal_decomposition?: CategoryRecord<CausalDecomposition>;
  allocation_recommendation?: AllocationRecommendation;
  allocation?: AllocationRecommendation;
  convergence?: ConvergenceDiagnostics;
  generated?: string;
  model_version?: string;
  iterations?: number;
}

/** Parameters for running a simulation. */
export interface SimulationParams {
  iterations?: number;
  include_allocation?: boolean;
  include_sensitivity?: boolean;
}

/** Sensitivity tornado bar data. */
export interface TornadoBar {
  trend_id: string;
  trend_name: string;
  force: ForceName;
  low_value: number;
  high_value: number;
  base_value: number;
  range: number;
}

/** Sensitivity analysis result. */
export interface SensitivityResult {
  tornado: TornadoBar[];
  category?: string;
}

/** Causal DAG edge. */
export interface CausalEdge {
  from: ForceName;
  to: ForceName;
  weight: number;
  lag: number;
  mechanism?: string;
  evidence_strength?: string;
}

/** Full DAG structure from GET /causal/dag. */
export interface CausalDAG {
  edges: CausalEdge[];
  forces: ForceName[];
}

/** Shock propagation result from POST /causal/propagate. */
export interface PropagationResult {
  impacts: Record<ForceName, Record<number, number>>;
  shocked_force: ForceName;
  magnitude: number;
}
