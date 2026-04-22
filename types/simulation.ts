/**
 * PRISM — Simulation & Shift Matrix types.
 * Maps to the core Shift Matrix output contract (CLAUDE.md §2).
 */

import type {
  CategoryId, ForceName, ScenarioId, ModelType, ProjectionYear,
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

/** Force attribution: how forces drive category shifts. */
export interface ForceAttribution {
  direct_effects?: Record<string, number>;
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
  iterations?: number;
  model_type?: ModelType;
}

/**
 * Per-year Decomposition Matrix — backend-computed (bayesian_mc v2.5+).
 *
 * The backend produces three lenses (Force, Value Chain, Region) that each
 * decompose the SAME MC-median category shift for every (category, year).
 * By construction the row total (sum across the lens dimension) equals
 * the MC median per category per year — so row totals are identical across
 * all three lenses, and column totals aggregate across categories to the
 * same per-year grand total.
 *
 *   sum over force   of force[y][cat][f]  === mc_median[cat][y]
 *   sum over vc_step of vc[y][cat][s]     === mc_median[cat][y]
 *   sum over region  of region[y][cat][r] === mc_median[cat][y]
 */
export interface DecompositionMatrix {
  force:  Record<string, Record<string, Record<string, number>>>;   // year → cat → force → shift
  vc:     Record<string, Record<string, Record<string, number>>>;   // year → cat → vc_step → shift
  region: Record<string, Record<string, Record<string, number>>>;   // year → cat → region → shift
  dimensions?: {
    forces: string[];
    vc_steps: string[];
    regions: string[];
    categories: string[];
    years: number[];
  };
}

/** Per-year totals block — row totals, column totals, grand totals. */
export interface TotalsMatrix {
  /** Row totals: per-category MC median at each year (identical across the 3 lenses by construction). */
  category_path: Record<string, Record<string, number>>;         // cat → year → total
  /** Column totals under the Force lens: aggregated across categories. */
  by_force:      Record<string, Record<string, number>>;         // year → force → total
  by_vc:         Record<string, Record<string, number>>;         // year → vc_step → total
  by_region:     Record<string, Record<string, number>>;         // year → region → total
  /** Grand total per year (sum of category row totals; same as sum of any lens's column totals). */
  grand:         Record<string, number>;                         // year → total
}

/** Per-run audit metadata attached to every persisted simulation.
 *
 * Populated by the `run_50k_prod.py` script (v3.2+) and rehydrated by
 * the FastAPI /api/v1/simulation endpoint. Surfaced in the dashboard's
 * "Showing run #N · date · scenario" ribbon so users can tell which
 * persisted run they're looking at.
 */
export interface RunMeta {
  run_id: number | null;
  run_date: string | null;
  iterations: number | null;
  model_type: string | null;
  scenario?: string | null;
  notes?: string | null;
  seed?: number | null;
  chains?: number | null;
  git_sha?: string | null;
  model_version?: string | null;
  engine_name?: string | null;
  converged_categories?: number | null;
  total_categories?: number | null;
  persisted_at_utc?: string | null;
}

/** Full simulation result from POST /simulate. */
export interface SimulationResult {
  shifts: ShiftMatrix;
  force_attribution?: CategoryRecord<ForceAttribution>;
  /** Per-year Force/VC/Region decompositions — source of truth for the Shift-Matrix lenses. */
  decompositions?: DecompositionMatrix;
  /** Per-year row/column/grand totals — matching the decompositions. */
  totals?: TotalsMatrix;
  allocation_recommendation?: AllocationRecommendation;
  convergence?: ConvergenceDiagnostics;
  scenario?: ScenarioId;
  generated?: string;
  model_version?: string;
  /** Audit metadata about the persisted run — drives the dashboard ribbon. */
  run_meta?: RunMeta | null;
}

/** Parameters for running a simulation. */
export interface SimulationParams {
  scenario?: ScenarioId;
  iterations?: number;
  include_allocation?: boolean;
  include_sensitivity?: boolean;
}

/** Scenario definition. */
export interface Scenario {
  id: ScenarioId;
  name: string;
  description: string;
  shocks?: Record<ForceName, number>;
  force_overrides?: Record<ForceName, number>;
}

