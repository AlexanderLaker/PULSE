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

/** Per-category MC diagnostics (detail only).
 *  T2 (June 2026): the synthetic top-level R̂ / "converged" headline badge was
 *  removed — R̂ on i.i.d. MC draws is ≈1.0 by construction and could never
 *  fail, so it is no longer surfaced. Per-category detail remains under
 *  `categories`. */
export interface ConvergenceDiagnostics {
  categories?: Record<string, { ess?: number; converged?: boolean }>;
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
  /**
   * Joint portfolio percentiles (D3 / audit F-16, June 2026): true joint
   * band of the category-weighted portfolio shift, computed per iteration
   * from the raw MC samples — NOT an average of per-category bands. The
   * headline band reads this when present (2.8.0+ runs).
   */
  portfolio?:    Record<string, PercentileDistribution & { mean?: number; std?: number }>;
}

/**
 * Consumer-journey decomposition (v3.6 journey layer): per category, the
 * terminal-year MC-median shift redistributed across the stages of that
 * category's journey (Hair categories → 8 hair stages, LHC categories →
 * 13 laundry stages). Stage keys are namespaced "<journey>:<stage_id>"
 * matching data/consumerJourney.ts ids. Same construction as the VC
 * decomposition — stage sums reconcile with the category's terminal-year
 * median; the lens redistributes, it never changes totals.
 */
export type JourneyDecomposition = Record<string, Record<string, number>>;

/** Integrity event emitted by the engine or the run orchestrator (D19). */
export interface IntegrityEvent {
  type: string;            // e.g. 'input_drift', 'correlation_pd_repair'
  severity: 'info' | 'warning' | 'error' | string;
  message: string;
  detail?: Record<string, unknown>;
}

/**
 * Cross-seed stability of the terminal-year portfolio median (M2, 2.8.1 —
 * owner re-ruling 2026-07-06 of the June T18 removal). Measures MC sampling
 * noise at the configured iteration count ONLY — it cannot detect model
 * error; at 50k × 3 chains a spread of ≈0 pp is the expected result.
 * Replaces the misleading R̂ badge (D3).
 */
export interface SeedStability {
  metric: 'terminal_year_portfolio_median' | string;
  terminal_year: number;
  per_chain_medians: number[];
  /** max − min across chains, in percentage points. */
  spread_pp: number;
  n_chains: number;
  iterations_per_chain: number;
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
  /** L8 (2.8.1): derived per-chain seeds; `seed` is the reproducible master. */
  chain_seeds?: number[] | null;
  chains?: number | null;
  git_sha?: string | null;
  model_version?: string | null;
  engine_name?: string | null;
  /** D13: 'scipy' — only the exact-numerics engine may produce runs. */
  engine_fidelity?: string | null;
  /** D13: exact library versions, e.g. 'scipy 1.15.3 · numpy 2.2.6'. */
  numerics_backend?: string | null;
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
  /** Terminal-year journey-stage attribution (v3.6 journey layer) — drives
   *  the Consumer Journey attribution chips.
   *  Absent on pre-journey runs: the UI shows an honest empty state. */
  journey_decomposition?: JourneyDecomposition;
  convergence?: ConvergenceDiagnostics;
  scenario?: ScenarioId;
  generated?: string;
  model_version?: string;
  /** Audit metadata about the persisted run — drives the dashboard ribbon. */
  run_meta?: RunMeta | null;
  /** D19: integrity events (input drift, runtime repairs) persisted with the run. */
  integrity_events?: IntegrityEvent[];
  /** M2 (2.8.1): cross-seed stability block; null/absent on older runs. */
  seed_stability?: SeedStability | null;
}

// (SimulationParams removed with runSimulation, L25/July 2026 review —
//  the deployed service never simulates; runs come from the offline CLI.)

/** Scenario definition. */
export interface Scenario {
  id: ScenarioId;
  name: string;
  description: string;
  shocks?: Record<ForceName, number>;
  force_overrides?: Record<ForceName, number>;
}

