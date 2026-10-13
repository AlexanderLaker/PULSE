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
  /** [i][j]: share of force i's signal already carried by force j; the
   *  derivation input of the attenuation, which the engine reads instead. */
  force_overlap_matrix: Record<ForceName, Record<ForceName, number>>;
  /** Copula correlation between forces (latent scale). */
  force_correlation_matrix: Record<ForceName, Record<ForceName, number>>;
  /** Copula correlation between two drivers of the same force. */
  within_force_rho: number;
  /** Label of the overlap-correction record the attenuation comes from. */
  overlap_correction_source: string;
  /** The per-iteration peak-year jitter, each driver within the width its uncertainty score sets; off, every driver peaks in its own year. */
  peak_year_jitter: boolean;
  path_years: number[];
}

/** GET /api/v1/health: cheap liveness and the two facts the dashboard needs. */
export interface HealthStatus {
  status: 'ok' | 'degraded';
  version: string;
  /** The commit the deployment was built from (first 12 characters); null outside Vercel. */
  commit: string | null;
  driver_count: number;
  has_simulation: boolean;
  /** 'degraded' comes with migration_pending (the database needs a migration
   *  from migrations/), no_database (no database URL configured),
   *  drivers_missing (a database in use lost its drivers) or db_error. */
  simulation_reason: 'ok' | 'no_rows' | DatabaseFailure;
  latest_run_id: number | null;
}

/** Why the database cannot be used: it needs a migration, none is configured, it lost its drivers, or
 *  anything else. */
export type DatabaseFailure = 'migration_pending' | 'no_database' | 'drivers_missing' | 'db_error';

/** Why a run cannot be shown: no run yet, a run missing part of its contract, or a database failure. */
export type SimulationReason = 'ok' | 'no_rows' | 'malformed' | DatabaseFailure;

/** GET /api/v1/diagnostics: whether the service reaches its database and can serve a run. Anonymous, so it
 *  names nothing about the database itself. */
export interface DiagnosticsResult {
  db_reachable: boolean;
  simulation_run_count: number;
  latest_run_id: number | null;
  /** The failure in words that name no host, user or password. */
  error: string | null;
  simulation_reason: SimulationReason;
  version: string;
}
