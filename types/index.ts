/**
 * PRISM Profit Pool Shift Model — Master Type Definitions
 * All domain types for the Profit Pool Risk & Intelligence Simulation Model.
 *
 * Design principle: Types mirror the Python backend's data contracts exactly.
 * Every API response has a corresponding TypeScript type.
 */

// ── Re-exports ────────────────────────────────────────────────────
// analytics.ts removed (D14 + Sobol rider, June 2026) — the advanced
// analytics suite (CVaR / Sobol / tipping points / reverse stress) was
// deleted end-to-end.
export type * from './trends';
export type * from './simulation';
export type * from './config';
export type * from './api';

// ── Core Enums ────────────────────────────────────────────────────

/** The 6 strategic forces that drive profit pool shifts. */
export type ForceName =
  | 'Consumer'
  | 'Customer'
  | 'Technology'
  | 'Government'
  | 'Environmental'
  | 'Competitive';

/** Direction of a trend's impact on the profit pool. */
export type Direction = 'Expansion' | 'Contraction';

/** Confidence level assigned to a trend's evidence base. */
export type Confidence = 'High' | 'Medium' | 'Low';

/** AI provider options for the LLM abstraction layer. */
export type AIProvider = 'claude' | 'azure' | 'ollama' | 'none';

/** Scenario type identifiers. */
export type ScenarioId =
  | 'base'
  | 'green_squeeze'
  | 'tech_disruption'
  | 'price_war'
  | 'regulatory_cascade'
  | 'perfect_storm'
  | string; // custom scenarios

/** Simulation model types. */
export type ModelType = 'deterministic' | 'bayesian_mc' | 'copula_mc';

/** The 13 FMCG categories in the Henkel Consumer Brands portfolio. */
export type CategoryId =
  | 'hair_color'
  | 'hair_care'
  | 'hair_styling'
  | 'hair_body'
  | 'lhc_fcn'
  | 'lhc_fca'
  | 'lhc_ffi'
  | 'lhc_lad'
  | 'lhc_hdw'
  | 'lhc_adw'
  | 'lhc_hsc'
  | 'lhc_ic'
  | string; // extensible for future categories

/** Category group (Hair or Laundry & Home Care). */
export type CategoryGroup = 'Hair' | 'LHC';

/** Projection years for continuous path modeling. */
export type ProjectionYear = 2026 | 2027 | 2028 | 2029 | 2030;

/** Value chain steps in the FMCG value chain. */
export type ValueChainStep =
  | 'raw_materials'
  | 'formulation'
  | 'packaging'
  | 'manufacturing'
  | 'logistics'
  | 'marketing'
  | 'trade'
  | 'after_sales';

// ── Utility Types ─────────────────────────────────────────────────

/** A record keyed by year with numeric values. */
export type YearRecord<T = number> = Partial<Record<ProjectionYear, T>>;

/** A record keyed by category ID. */
export type CategoryRecord<T> = Partial<Record<CategoryId, T>>;

/** A record keyed by force name. */
export type ForceRecord<T> = Partial<Record<ForceName, T>>;
