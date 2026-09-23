/**
 * Test data shaped exactly like the API's, for the view tests: a driver, a
 * run, the configuration and a store. Each maker returns a complete object;
 * pass overrides for what a test needs.
 */
import { vi } from 'vitest';
import type {
  Driver, DriverScores, ForceName, HealthStatus, ModelConfig, PercentileDistribution, ShiftPath, SimulationResult,
} from '@/types';
import type { PrismStore } from '@/hooks/usePrism';
import { CATEGORY_NAMES, FORCES, REGIONS, YEARS } from '@/lib/format';
import { ESTIMATED_CELL_WEIGHTS, ESTIMATE_SOURCE } from '@/lib/cellWeightProvenance';
import { VC_STEPS, canonicalVcProfile } from '@/lib/valueChain';

/** A distribution around a median. */
export function distribution(median: number, spread = 0.01): PercentileDistribution {
  return {
    p10: median - spread, p25: median - spread / 2, median,
    p75: median + spread / 2, p90: median + spread, mean: median, std: spread / 1.28,
  };
}

/** A path that ramps linearly to `terminal` in the last path year. */
export function linearPath(terminal: number): ShiftPath {
  return Object.fromEntries(YEARS.map((y, i) => [String(y), distribution((terminal * (i + 1)) / YEARS.length)]));
}

const ANALYSIS = [
  'Weight in the answer: The driver carries 0.76 of the 5.6 points.',
  'Where it lands: Fabric clean Europe carries a fifth of the effect.',
  'When it lands: An s-curve to 2030.',
  'What the band hinges on: The series to watch is the private-label share.',
  'Figures: model attribution on the estimated HCB gross-profit mix. Read as exposure if nobody acts, not as a forecast.',
].join('\n\n');

export function makeDriver(overrides: Partial<Driver> = {}): Driver {
  const scores: DriverScores = {
    probability: 5,
    gp1_pct_affected: 0.22,
    peak_year: 2030,
    diffusion_curve: 's_curve',
    uncertainty: 2,
    category_exposure: Object.fromEntries(CATEGORY_NAMES.map((c) => [c, 3])),
    regional_exposure: Object.fromEntries(REGIONS.map((r) => [r, 5])),
    vc_exposure: canonicalVcProfile(VC_STEPS.indexOf('Commercial') + 1),
  };
  return {
    id: 'consumer_r01',
    force: 'Consumer',
    name: 'Private label structural penetration',
    description: 'Private label keeps gaining share in European grocery.',
    direction: 'Contraction',
    start_year: 2025,
    confidence: 'Medium',
    normalized_score: -(5 / 6) * 0.22,
    analysis: ANALYSIS,
    sources: [{ title: 'Circana: private label reaches a record share', url: 'https://example.org/circana', tier: 'A', note: 'Apr 2026' }],
    ...scores,
    baseline: { ...scores },
    scores_edited: false,
    revision: 1,
    proposal_summary: {
      count: 0, probability: null, gp1_pct_affected: null, peak_year: null, diffusion_curve: null, uncertainty: null, my: null,
    },
    ...overrides,
  };
}

/** A run over all 13 categories: category i ends at -2 % - 0.4 % x i. */
export function makeSimulation(overrides: Partial<SimulationResult> = {}): SimulationResult {
  const terminal = (i: number) => -0.02 - 0.004 * i;
  const shifts = Object.fromEntries(CATEGORY_NAMES.map((c, i) => [c, linearPath(terminal(i))]));
  const categoryWeights = Object.fromEntries(CATEGORY_NAMES.map((c) => [
    c, REGIONS.reduce((a, r) => a + ESTIMATED_CELL_WEIGHTS[c][r], 0),
  ]));
  const regionWeights = Object.fromEntries(REGIONS.map((r) => [
    r, CATEGORY_NAMES.reduce((a, c) => a + ESTIMATED_CELL_WEIGHTS[c][r], 0),
  ]));
  const median = (c: string, y: number) => shifts[c][String(y)].median;
  const split = (dims: readonly string[]) => Object.fromEntries(YEARS.map((y) => [String(y), Object.fromEntries(
    CATEGORY_NAMES.map((c) => [c, Object.fromEntries(dims.map((d) => [d, median(c, y) / dims.length]))]),
  )]));
  const portfolioTerminal = CATEGORY_NAMES.reduce((a, c, i) => a + categoryWeights[c] * terminal(i), 0);
  return {
    shifts,
    velocity: Object.fromEntries(CATEGORY_NAMES.map((c, i) => [c, Object.fromEntries(YEARS.slice(1).map((y) => [
      String(y), { median: terminal(i) / YEARS.length, p10: (terminal(i) * 1.5) / YEARS.length, p90: (terminal(i) * 0.5) / YEARS.length },
    ]))])),
    regional_shift_matrix: Object.fromEntries(CATEGORY_NAMES.map((c, i) => [c, Object.fromEntries(REGIONS.map((r, k) => [
      r, { path: linearPath(terminal(i) * (1.2 - 0.15 * k)), velocity: {} },
    ]))])),
    decompositions: {
      force: split(FORCES),
      vc: split(VC_STEPS),
      region: split(REGIONS),
      dimensions: { forces: FORCES, vc_steps: [...VC_STEPS], regions: REGIONS, categories: CATEGORY_NAMES, years: YEARS },
    },
    totals: {
      category_path: Object.fromEntries(CATEGORY_NAMES.map((c) => [c, Object.fromEntries(YEARS.map((y) => [String(y), median(c, y)]))])),
      portfolio: linearPath(portfolioTerminal),
    },
    cell_weights_used: ESTIMATED_CELL_WEIGHTS,
    category_weights_used: categoryWeights,
    region_weights_used: regionWeights,
    cell_weights_source: ESTIMATE_SOURCE,
    mc_standard_error: Object.fromEntries(CATEGORY_NAMES.map((c) => [c, {
      median_se_pp: 0.001, p10_se_pp: 0.002, p90_se_pp: 0.002, terminal_year: 2035, n: 150000, method: 'bootstrap_terminal_year',
    }])),
    integrity_events: [{
      type: 'input_drift', severity: 'info',
      message: "Input drift vs run #98, 2026-09-10 21:12:03: no changes; the driver inputs are identical to that run's.",
      detail: { scores_changed: 0 },
    }],
    seed_stability: {
      metric: 'terminal_year_portfolio_median', terminal_year: 2035, per_chain_medians: [-0.0558, -0.0558, -0.0559],
      spread_pp: 0.01, n_chains: 3, iterations_per_chain: 50000, pooled_iterations: 150000,
    },
    run_meta: {
      run_id: 99, run_date: '2026-09-13T23:04:39+00:00', iterations: 50000, seed: 42, chain_seeds: [42, 1000045, 2000048],
      chains: 3, model_version: '2.12.0', engine_name: 'bayesian_copula', numerics_backend: 'scipy 1.17.1 · numpy 2.4.6',
      driver_count: 51, attenuation_source: 'overlap-correction-2026-09', persisted_at_utc: '2026-09-13T23:04:39+00:00',
    },
    inputs_since_run: { changed: [], added: [], removed: [] },
    ...overrides,
  };
}

const FORCE_OVERLAP: Record<ForceName, Record<ForceName, number>> = {
  Consumer: { Consumer: 0, Customer: 0.05, Technology: 0, Government: 0.03, Environmental: 0, Competitive: 0.05 },
  Customer: { Consumer: 0.05, Customer: 0, Technology: 0.245, Government: 0.206, Environmental: 0.223, Competitive: 0.11 },
  Technology: { Consumer: 0, Customer: 0.272, Technology: 0, Government: 0.232, Environmental: 0.345, Competitive: 0.03 },
  Government: { Consumer: 0.03, Customer: 0.153, Technology: 0.159, Government: 0, Environmental: 0.2, Competitive: 0 },
  Environmental: { Consumer: 0, Customer: 0.367, Technology: 0.45, Government: 0.405, Environmental: 0, Competitive: 0 },
  Competitive: { Consumer: 0.05, Customer: 0.133, Technology: 0.03, Government: 0, Environmental: 0, Competitive: 0 },
};

const FORCE_CORRELATION: Record<ForceName, Record<ForceName, number>> = {
  Consumer: { Consumer: 1, Customer: 0.18, Technology: 0.11, Government: 0.04, Environmental: 0.15, Competitive: 0.15 },
  Customer: { Consumer: 0.18, Customer: 1, Technology: 0.11, Government: 0.15, Environmental: 0.04, Competitive: 0.18 },
  Technology: { Consumer: 0.11, Customer: 0.11, Technology: 1, Government: 0.22, Environmental: 0.11, Competitive: 0.18 },
  Government: { Consumer: 0.04, Customer: 0.15, Technology: 0.22, Government: 1, Environmental: 0.22, Competitive: 0.04 },
  Environmental: { Consumer: 0.15, Customer: 0.04, Technology: 0.11, Government: 0.22, Environmental: 1, Competitive: 0.04 },
  Competitive: { Consumer: 0.15, Customer: 0.18, Technology: 0.18, Government: 0.04, Environmental: 0.04, Competitive: 1 },
};

/** GET /api/v1/config with the engine's defaults. */
export function makeConfig(overrides: Partial<ModelConfig> = {}): ModelConfig {
  return {
    force_weights: Object.fromEntries(FORCES.map((f) => [f, 1 / 6])) as Record<ForceName, number>,
    per_force_attenuation: {
      Consumer: 0.487, Customer: 0.417, Technology: 0.412, Government: 0.446, Environmental: 0.378, Competitive: 0.479,
    },
    within_force_overlap: {
      Consumer: 0.1, Customer: 0.221, Technology: 0.384, Government: 0.123, Environmental: 0.401, Competitive: 0.1,
    },
    force_overlap_matrix: FORCE_OVERLAP,
    force_correlation_matrix: FORCE_CORRELATION,
    within_force_rho: 0.3,
    attenuation_source: 'overlap-correction-2026-09',
    peak_year_jitter: 1,
    base_year: 2025,
    path_years: YEARS,
    cell_weights: ESTIMATED_CELL_WEIGHTS,
    cell_weights_source: ESTIMATE_SOURCE,
    ...overrides,
  };
}

export function makeHealth(overrides: Partial<HealthStatus> = {}): HealthStatus {
  return {
    status: 'ok', version: '2.12.0', driver_count: 51, categories: 13,
    has_simulation: true, simulation_reason: 'ok', latest_run_id: 99, ...overrides,
  };
}

/** The usePrism() store of a loaded, connected dashboard. */
export function makeStore(overrides: Partial<PrismStore> = {}): PrismStore {
  return {
    health: makeHealth(),
    drivers: [makeDriver()],
    simulation: makeSimulation(),
    config: makeConfig(),
    driversError: null,
    configError: null,
    simulationError: null,
    databaseFailure: null,
    loading: false,
    error: null,
    backendAvailable: true,
    updateDriver: vi.fn(async () => {}),
    reload: vi.fn(async () => {}),
    ...overrides,
  };
}
