/**
 * PRISM — Configuration types.
 * Maps to ModelConfig and application settings.
 */

import type { ForceName, ValueChainStep, AIProvider, ProjectionYear } from './index';

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
  group: 'Beauty' | 'LHC';
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
}

/** Model configuration from GET /config. */
export interface ModelConfig {
  region?: string;
  aggregation_method?: string;
  attenuation?: number;
  neutral_threshold?: number;
  base_year?: number;
  path_years?: ProjectionYear[];
  maturity_schedule?: Record<number, number>;
  force_weights?: Record<ForceName, number>;
  vc_weights?: Record<ValueChainStep, number>;
  category_names?: string[];
  iterations?: number;
  backtesting_accuracy?: number;
  ai_provider?: AIProvider;
}

/** Force summary from GET /forces. */
export interface ForceSummary {
  name: ForceName;
  trend_count?: number;
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
