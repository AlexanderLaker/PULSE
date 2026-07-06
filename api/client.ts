/**
 * PRISM Profit Pool Shift Model — Typed API Client
 * Fully typed interface to the FastAPI backend.
 * Zero `any` types. Every request and response is typed.
 */

import type {
  Trend, TrendUpdate,
  TrendProposalPatch, TrendProposalsResponse,
  SimulationResult,
  HealthStatus, DiagnosticsResult, ModelConfig, AuditEntry, ForceSummary,
} from '@/types';

// ── Base Request ─────────────────────────────────────────────────

const BASE = '/api/v1';

/** L25 (July 2026 review): no request may hang forever — a stalled proxy
 *  used to leave the dashboard in a permanent skeleton. 20s covers Neon
 *  cold starts with margin. */
const REQUEST_TIMEOUT_MS = 20_000;

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
      signal: options.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError(0, `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
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

// ── Trend score proposals (multi-expert scoring) ─────────────────
// Any authenticated user may read aggregates and write THEIR OWN proposal.
// Endorsement is a normal admin updateTrend() with the chosen values, so it
// flows through the existing validated, audited PUT /trends/{id} path.

/** GET /api/v1/trends/{id}/proposals — the caller's own proposal, the expert
 *  aggregate, and the named "who scored what" breakdown. */
export const getTrendProposals = (id: string): Promise<TrendProposalsResponse> =>
  request(`/trends/${id}/proposals`);

/** PUT /api/v1/trends/{id}/proposals — upsert the caller's own proposal.
 *  Partial patch: only the provided fields are written. Returns the refreshed
 *  proposals payload. */
export const saveMyProposal = (
  id: string,
  patch: TrendProposalPatch,
): Promise<TrendProposalsResponse> =>
  request(`/trends/${id}/proposals`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });

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
    // v3.6 journey layer: terminal-year journey-stage attribution.
    // Absent on pre-journey runs — consumers show an empty state.
    journey_decomposition: r.journey_decomposition as SimulationResult['journey_decomposition'],
    // M2 (2.8.1): cross-seed stability of the terminal-year portfolio
    // median. Null/absent on pre-2.8.1 runs — the footer says "not recorded".
    seed_stability: r.seed_stability as SimulationResult['seed_stability'],
  } as SimulationResult;
}

export const getSimulation = async (): Promise<SimulationResult> =>
  normalizeSimulation(await request<unknown>('/simulation'));

// (runSimulation removed, L25/July 2026 review: it had no callers — F2: the
//  deployed service never simulates; runs are produced by the offline CLI.)

// ── Forces ───────────────────────────────────────────────────────

export const getForces = (): Promise<ForceSummary[] | { forces: string[] }> =>
  request('/forces');

// ── Audit ────────────────────────────────────────────────────────

export const getAuditLog = (limit = 50): Promise<AuditEntry[]> =>
  request(`/audit/log?limit=${limit}`);

// ── Analytics client removed (D14 + Sobol rider, June 2026) ─────
// CVaR / Sobol / tipping-points / reverse-stress were deleted end-to-end:
// they rendered nowhere in the live UI and their fetches were silently
// swallowed. See audit/strategy-review/06, Part A addendum.
// ── Delphi client removed (D10, June 2026) ──────────────────────

