/**
 * The model configuration and the service's own status
 * (prism/api/routers/config.py and system.py).
 */
import type { ForceName } from './index';

/** GET /api/v1/config: the parameters production runs use. Read-only. */
export interface ModelConfig {
  /** Weight of each force in the compounding (sums to 1). */
  force_weights: Record<ForceName, number>;
  /** Share of a force's signal that passes through after the overlap correction. */
  per_force_attenuation: Record<ForceName, number>;
  /** Overlap correction among the drivers of one force. */
  within_force_overlap: Record<ForceName, number>;
  /** [i][j]: share of force i's signal already carried by force j. */
  force_overlap_matrix: Record<ForceName, Record<ForceName, number>>;
  /** Copula correlation between forces (latent scale). */
  force_correlation_matrix: Record<ForceName, Record<ForceName, number>>;
  /** Copula correlation between two drivers of the same force. */
  within_force_rho: number;
  /** Label of the overlap-correction record the attenuation comes from. */
  attenuation_source: string;
  /** Engine-wide switch for the per-driver peak-year jitter (0 switches it off). */
  peak_year_jitter: number;
  base_year: number;
  path_years: number[];
  /** Default iterations per chain. */
  iterations: number;
  /** The default cell weights (the estimated HCB mix); a run records the weights it used. */
  cell_weights: Record<string, Record<string, number>>;
  cell_weights_source: string;
}

/** GET /api/v1/health: cheap liveness and the two facts the dashboard needs. */
export interface HealthStatus {
  status: 'ok' | 'degraded';
  version: string;
  driver_count: number;
  categories: number;
  has_simulation: boolean;
  simulation_reason: 'ok' | 'no_rows' | 'db_error';
  latest_run_id: number | null;
}

/** Why a run cannot be shown: no run yet, a run missing part of its contract, or no database. */
export type SimulationReason = 'ok' | 'no_rows' | 'malformed' | 'db_error';

/** GET /api/v1/diagnostics: what the service sees of its database. No credentials. */
export interface DiagnosticsResult {
  db_mode: 'postgres' | 'sqlite';
  /** Host name only, never a credential. */
  db_host: string;
  db_url_env: 'POSTGRES_URL' | 'DATABASE_URL' | null;
  db_reachable: boolean;
  simulation_run_count: number;
  latest_run_id: number | null;
  latest_run_date: string | null;
  error: string | null;
  simulation_reason: SimulationReason;
  version: string;
}
