/**
 * PRISM Profit Pool Shift Model — Typed API Client
 * Fully typed interface to the FastAPI backend.
 * Zero `any` types. Every request and response is typed.
 */

import type {
  Trend, TrendUpdate,
  SimulationResult, SimulationParams,
  CVaRResult, SobolResult, TippingPointsResult, ReverseStressResult, ReverseStressParams,
  HealthStatus, DiagnosticsResult, ModelConfig, AuditEntry, ForceSummary,
} from '@/types';

// ── Base Request ─────────────────────────────────────────────────

const BASE = '/api/v1';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText })) as { detail?: string };
      throw new ApiError(res.status, err.detail ?? `API ${res.status}`);
    }
    return res.json() as Promise<T>;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new ApiError(0, 'Backend unavailable or network error');
    }
    throw error;
  }
}

// ── Health & Config ──────────────────────────────────────────────

export const getHealth = (): Promise<HealthStatus> =>
  request('/health');

export const getConfig = (): Promise<ModelConfig> =>
  request('/config');

/** GET /api/v1/diagnostics — backend's view of its own DB state.
 *  Drives the differentiated empty-state banner in ProfitPoolAnalysis2.tsx.
 *  Never throws — returns a default "unreachable" shape on network error so
 *  the UI can still say something useful. */
export const getDiagnostics = async (): Promise<DiagnosticsResult> => {
  try {
    return await request<DiagnosticsResult>('/diagnostics');
  } catch {
    return {
      db_mode: 'unknown',
      db_host: null,
      db_url_env: null,
      db_reachable: false,
      simulation_run_count: 0,
      latest_run_id: null,
      latest_run_date: null,
      latest_iterations: null,
      latest_has_shift_matrix: false,
      latest_has_decompositions: false,
      latest_has_totals: false,
      latest_has_vc_decomposition: false,
      error: 'diagnostics endpoint unreachable',
      simulation_reason: 'db_error',
      in_memory_simulation: false,
      version: 'unknown',
    };
  }
};

// ── Trends ───────────────────────────────────────────────────────

export const getTrends = (force?: string): Promise<Trend[]> =>
  request(`/trends${force ? `?force=${encodeURIComponent(force)}` : ''}`);

export const getTrend = (id: string): Promise<Trend> =>
  request(`/trends/${id}`);

export const updateTrend = (id: string, data: TrendUpdate): Promise<Trend> =>
  request(`/trends/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// ── Simulation ───────────────────────────────────────────────────

/**
 * Normalize the backend simulation payload to the shape the frontend expects.
 *
 * Backend response shape (FastAPI):
 *   {
 *     shift_matrix: { [cat]: { path: { [year]: {p10,p25,median,p75,p90,mean,std} }, velocity: {...} } },
 *     convergence: {...},
 *     force_attribution?: {...},
 *     iterations, model_type, ...
 *   }
 *
 * Frontend type `SimulationResult` expects:
 *   {
 *     shifts: { [cat]: { [year]: PercentileDistribution } },    // flat, no `.path`
 *     convergence: {...},
 *     force_attribution: {...}
 *   }
 *
 * This normalizer accepts either shape (idempotent).
 */
// Exported so the normalization rules can be unit-tested (tests/frontend/normalizeSimulation.test.ts).
export function normalizeSimulation(raw: unknown): SimulationResult {
  const r = (raw ?? {}) as Record<string, unknown>;

  // shifts: prefer `shifts` if already normalized, else unwrap `shift_matrix[cat].path`
  let shifts = r.shifts as Record<string, unknown> | undefined;
  if (!shifts && r.shift_matrix && typeof r.shift_matrix === 'object') {
    const matrix = r.shift_matrix as Record<string, unknown>;
    shifts = {};
    for (const [cat, val] of Object.entries(matrix)) {
      if (val && typeof val === 'object') {
        const v = val as Record<string, unknown>;
        // Unwrap `.path` if present; otherwise assume it's already a year-map
        shifts[cat] = (v.path && typeof v.path === 'object') ? v.path : v;
      }
    }
  }

  return {
    ...(r as Partial<SimulationResult>),
    shifts: (shifts ?? {}) as SimulationResult['shifts'],
    convergence: r.convergence as SimulationResult['convergence'],
    force_attribution: r.force_attribution as SimulationResult['force_attribution'],
    // v3.1: pass through the per-year decompositions and totals blocks.
    // Already JSON-serializable (backend stringified int year keys).
    decompositions: r.decompositions as SimulationResult['decompositions'],
    totals: r.totals as SimulationResult['totals'],
  } as SimulationResult;
}

export const getSimulation = async (): Promise<SimulationResult> =>
  normalizeSimulation(await request<unknown>('/simulation'));

export const runSimulation = async (params: SimulationParams = {}): Promise<SimulationResult> =>
  normalizeSimulation(await request<unknown>('/simulate', { method: 'POST', body: JSON.stringify(params) }));

// ── Forces ───────────────────────────────────────────────────────

export const getForces = (): Promise<ForceSummary[] | { forces: string[] }> =>
  request('/forces');

// ── Audit ────────────────────────────────────────────────────────

export const getAuditLog = (limit = 50): Promise<AuditEntry[]> =>
  request(`/audit/log?limit=${limit}`);

// ── Analytics (Amendment M) ──────────────────────────────────────

export const getCVaR = (): Promise<CVaRResult> =>
  request('/analytics/cvar');

export const getSobol = (): Promise<SobolResult> =>
  request('/analytics/sobol');

export const getTippingPoints = (): Promise<TippingPointsResult> =>
  request('/analytics/tipping-points');

export const reverseStress = (data: ReverseStressParams): Promise<ReverseStressResult> =>
  request('/analytics/reverse-stress', { method: 'POST', body: JSON.stringify(data) });
// ── Delphi client removed (D10, June 2026) ──────────────────────

