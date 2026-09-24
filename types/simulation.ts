/**
 * The persisted run as GET /api/v1/simulation serves it (prism/api/runs.py).
 *
 * `SimulationPayload` is the JSON as it arrives; lib/apiClient.ts lifts each
 * category's percentile path into `shifts`, which is the `SimulationResult`
 * every view reads. Keys are strings: "2035", "Hair: Color", "Europe".
 */

/** The distribution of a shift in one year. */
export interface PercentileDistribution {
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  mean: number;
  std: number;
}

/** A shift path: year -> distribution. */
export type ShiftPath = Record<string, PercentileDistribution>;

/** Distribution of each iteration's change from the previous year. */
export interface VelocityBand {
  median: number;
  p10: number;
  p90: number;
}

/** One category's (or one category and region's) simulated shift. */
export interface CellShift {
  path: ShiftPath;
  /** year -> change from the previous year; starts at the second path year. */
  velocity: Record<string, VelocityBand>;
}

/** year -> category -> lens dimension (force, value-chain stage, region) -> part of the median shift. */
export type Decomposition = Record<string, Record<string, Record<string, number>>>;

/** The three attribution lenses. Each splits the same median shift, so every lens adds up to it. */
export interface Decompositions {
  force: Decomposition;
  vc: Decomposition;
  region: Decomposition;
}

export interface Totals {
  /** category -> year -> median shift (the row totals of every lens). */
  category_path: Record<string, Record<string, number>>;
  /** The portfolio band: the joint percentiles of the gross-profit-weighted portfolio shift. */
  portfolio: ShiftPath;
}

/** Bootstrap standard error of the terminal-year percentiles, in percentage points. */
export interface McStandardError {
  median_se_pp: number;
  p10_se_pp: number;
  p90_se_pp: number;
  terminal_year: number;
  n: number;
  method: string;
}

/** Something the engine repaired, assumed or measured, recorded with the run (input drift among them). */
export interface IntegrityEvent {
  type: string;
  severity: 'info' | 'warning';
  message: string;
  detail?: Record<string, unknown> | null;
}

/** Spread of the terminal-year portfolio median across the independently seeded chains. */
export interface SeedStability {
  metric: string;
  terminal_year: number;
  per_chain_medians: number[];
  /** Largest minus smallest chain median, in percentage points: Monte Carlo noise only. */
  spread_pp: number;
  n_chains: number;
  iterations_per_chain: number;
  pooled_iterations: number;
}

/** Which run this is and how it was computed. */
export interface RunMeta {
  run_id: number;
  /** When the run was stored, ISO 8601 with its UTC offset. */
  run_date: string;
  /** Iterations per chain. */
  iterations: number;
  seed: number;
  chain_seeds: number[];
  chains: number;
  model_version: string;
  engine_name: string;
  numerics_backend: string;
  driver_count: number;
  overlap_correction_source: string;
}

/** GET /api/v1/simulation as it arrives. */
export interface SimulationPayload {
  shift_matrix: Record<string, CellShift>;
  /** category -> region -> shift of that cell. */
  regional_shift_matrix: Record<string, Record<string, CellShift>>;
  decompositions: Decompositions;
  totals: Totals;
  /** category -> region -> gross-profit share the run rolled up with (sums to 1). */
  cell_weights_used: Record<string, Record<string, number>>;
  /** Row sums of cell_weights_used: each category's share. */
  category_weights_used: Record<string, number>;
  /** Column sums of cell_weights_used: each region's share. */
  region_weights_used: Record<string, number>;
  /** Where the cell weights come from (the estimate's label, or the finance file's). */
  cell_weights_source: string;
  /** category -> standard error of its terminal-year percentiles. */
  mc_standard_error: Record<string, McStandardError>;
  integrity_events: IntegrityEvent[];
  seed_stability: SeedStability;
  run_meta: RunMeta;
  /** The drivers edited since the run was computed. */
  inputs_since_run: InputsSinceRun;
}

/** How the current drivers differ from the ones the run was computed on (driver ids). */
export interface InputsSinceRun {
  changed: string[];
  added: string[];
  removed: string[];
}

/** The run as the views read it: `shifts[category]` is that category's path,
 *  `velocity[category]` its year-on-year change bands. */
export interface SimulationResult extends Omit<SimulationPayload, 'shift_matrix'> {
  shifts: Record<string, ShiftPath>;
  velocity: Record<string, Record<string, VelocityBand>>;
}
