/**
 * PRISM — Configuration types.
 * Maps to ModelConfig and application settings.
 */

import type { ForceName, AIProvider, ProjectionYear } from './index';

/** Force metadata for display. */
export interface ForceDefinition {
  color: string;
  label: string;
  emoji: string;
}

/** Category metadata for display. */
export interface CategoryDefinition {
  id: string;
  name: string;
  short: string;
  group: 'Hair' | 'LHC';
  color: string;
}

/** Design token set. */
export interface DesignTokens {
  bg: string;
  bg1: string;
  bg2: string;
  bg3: string;
  bg4: string;
  border: string;
  border1: string;
  border2: string;
  accent: string;
  accentDim: string;
  gold: string;
  goldDim: string;
  green: string;
  greenDim: string;
  red: string;
  redDim: string;
  amber: string;
  amberDim: string;
  purple: string;
  purpleDim: string;
  cyan: string;
  cyanDim: string;
  text: string;
  text2: string;
  text3: string;
  text4: string;
  mono: string;
  sans: string;
}

/** Application health status from GET /health. */
export interface HealthStatus {
  status: string;
  version: string;
  db_stats?: {
    trends: number;
    simulations: number;
  };
  backtest_accuracy?: number;
  has_simulation?: boolean;
  /** When has_simulation is false, explains WHY the dashboard is empty. */
  simulation_reason?: 'ok' | 'no_rows' | 'malformed' | 'db_error';
  simulation_error?: string | null;
  latest_run_id?: number | null;
  model_loaded?: boolean;
  trend_count?: number;
  categories?: number;
}

/** Diagnostic snapshot from GET /api/v1/diagnostics.
 *
 * Used by the dashboard's differentiated empty-state banner and by the
 * `scripts/diagnose_prism.py` CLI tool. No credentials or €M values are
 * ever returned — only the DB hostname (no user/password).
 */
export interface DiagnosticsResult {
  db_mode: 'postgres' | 'sqlite' | 'unknown';
  db_host: string | null;
  db_url_env: 'POSTGRES_URL' | 'DATABASE_URL' | null;
  db_reachable: boolean;
  simulation_run_count: number;
  latest_run_id: number | null;
  latest_run_date: string | null;
  latest_iterations: number | null;
  latest_has_shift_matrix: boolean;
  latest_has_decompositions: boolean;
  latest_has_totals: boolean;
  latest_has_vc_decomposition: boolean;
  error: string | null;
  simulation_reason: 'ok' | 'no_rows' | 'malformed' | 'db_error';
  in_memory_simulation: boolean;
  version: string;
}

/** Model configuration from GET /config. */
export interface ModelConfig {
  region?: string;
  aggregation_method?: string;
  /** v3.2: per-force calibrated attenuation. The legacy scalar
   *  `attenuation` was removed entirely — there is no flat 0.5 default
   *  anywhere. Six values (one per force) sourced from
   *  data/Attenuation_Calibration.xlsx (Cross-Force_Matrix sheet). */
  per_force_attenuation?: Record<ForceName, number>;
  attenuation_source?: 'calibrated_v3.11_september2026' | 'calibrated_v3.5_april2026' | 'calibrated_v3.1_april2026' | 'admin_override';
  // neutral_threshold deleted (July 2026): engine-inert, removed end-to-end.
  base_year?: number;
  path_years?: ProjectionYear[];
  maturity_schedule?: Record<number, number>;
  force_weights?: Record<ForceName, number>;
  // vc_weights deleted (2.9.0, July 2026): the VC attribution lens is a
  // categorical epicentre partition — no per-step weight dial exists.
  /** 2.11.0 (owner ruling O6): the 12 × 4 matrix of HCB gross-profit SHARES
   *  per category × region cell (sums to 1). The engine rolls the 48 composite
   *  cells up with it: category shift = share-weighted mean of the row,
   *  portfolio = Σ share × cell. Editable on the Config sheet (admin) and via
   *  `--cell-weights FILE` on the production CLI; the default is the equal
   *  1/48 placeholder until the actual P&L shares are loaded. Keyed
   *  cell_weights[category][region]. */
  cell_weights?: Record<string, Record<string, number>>;
  /** Provenance label of the cell weights (shown in the About footer). */
  cell_weights_source?: string;
  /** The backend's placeholder label (what "reset to equal" writes). */
  cell_weights_source_default?: string;
  /** Names of the weight vectors GET /config derives from cell_weights
   *  (read-only; PUT rejects them). */
  derived_weights?: string[];
  /** DERIVED (2.11.0): column sums of cell_weights — the region shares.
   *  Read-only; kept on the contract for the region lens and the drill-down. */
  region_weights?: Record<string, number>;
  /** DERIVED (2.11.0): row sums of cell_weights — the category shares that
   *  drive the Shift-Matrix column totals and grand total (lib/shiftMatrix.ts
   *  takes category-weighted averages, never raw sums). Read-only. */
  category_weights?: Record<string, number>;
  category_names?: string[];
  ai_provider?: AIProvider;
}

/** Force summary from GET /forces. */
export interface ForceSummary {
  name: ForceName;
  trend_count?: number;
  avg_impact?: number;
  net_direction?: string;
}

/** Audit log entry. */
export interface AuditEntry {
  id: number;
  timestamp: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  old_value?: string;
  new_value?: string;
  reason?: string;
  user_id?: string;
}
