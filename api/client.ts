/**
 * PULSE War Room — Typed API Client
 * Fully typed interface to the FastAPI backend.
 * Zero `any` types. Every request and response is typed.
 */

import type {
  Trend, TrendUpdate,
  SimulationResult, SimulationParams,
  CausalDAG, PropagationResult,
  Scenario,
  SensitivityResult,
  CVaRResult, SobolResult, TippingPointsResult, ReverseStressResult, ReverseStressParams,
  AISuggestion, TriggerStatus,
  HealthStatus, ModelConfig, AuditEntry, ForceSummary,
  DelphiSessionSummary, DelphiSession, DelphiScoreSubmission, DelphiScore,
  DelphiRoundSummary, CalibrationResult, DelphiConsensus, ScorerView,
  CreateDelphiSessionPayload,
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
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText })) as { detail?: string };
    throw new ApiError(res.status, err.detail ?? `API ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Health & Config ──────────────────────────────────────────────

export const getHealth = (): Promise<HealthStatus> =>
  request('/health');

export const getConfig = (): Promise<ModelConfig> =>
  request('/config');

// ── Trends ───────────────────────────────────────────────────────

export const getTrends = (force?: string): Promise<Trend[]> =>
  request(`/trends${force ? `?force=${encodeURIComponent(force)}` : ''}`);

export const getTrend = (id: string): Promise<Trend> =>
  request(`/trends/${id}`);

export const updateTrend = (id: string, data: TrendUpdate): Promise<Trend> =>
  request(`/trends/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// ── Simulation ───────────────────────────────────────────────────

export const getSimulation = (): Promise<SimulationResult> =>
  request('/simulation');

export const runSimulation = (params: SimulationParams = {}): Promise<SimulationResult> =>
  request('/simulate', { method: 'POST', body: JSON.stringify(params) });

export const runDeterministic = (): Promise<SimulationResult> =>
  request('/simulate/deterministic', { method: 'POST' });

// ── Causal DAG ───────────────────────────────────────────────────

export const getDAG = (): Promise<CausalDAG> =>
  request('/causal/dag');

export const propagateShock = (data: {
  shocked_force: string;
  magnitude: number;
  years?: number;
}): Promise<PropagationResult> =>
  request('/causal/propagate', { method: 'POST', body: JSON.stringify(data) });

// ── Scenarios ────────────────────────────────────────────────────

export const getScenarios = (): Promise<Scenario[]> =>
  request('/scenarios');

export const createScenario = (data: Partial<Scenario>): Promise<Scenario> =>
  request('/scenarios', { method: 'POST', body: JSON.stringify(data) });

// ── Sensitivity ──────────────────────────────────────────────────

export const getTornado = (category?: string): Promise<SensitivityResult> =>
  request(`/sensitivity/tornado${category ? `?category=${encodeURIComponent(category)}` : ''}`);

// ── Optimizer ────────────────────────────────────────────────────

export const optimizeAllocation = (data: {
  risk_aversion?: number;
  constraints?: Record<string, { min?: number; max?: number }>;
}): Promise<{ weights: Record<string, number>; frontier?: Array<{ risk: number; return: number }> }> =>
  request('/optimize/allocation', { method: 'POST', body: JSON.stringify(data) });

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

// ── AI & Insights ────────────────────────────────────────────────

export const getAIInsights = (): Promise<AISuggestion[]> =>
  request('/ai/suggestions');

export const scanTrends = (): Promise<{ status: string; new_trends: number }> =>
  request('/ai/scan', { method: 'POST' });

export const getTriggers = (): Promise<TriggerStatus[]> =>
  request('/triggers');

export const createTrigger = (data: {
  category: string;
  condition_type: string;
  threshold: number;
  target_year: number;
  action_text: string;
}): Promise<TriggerStatus> =>
  request('/triggers', { method: 'POST', body: JSON.stringify(data) });

// ── Delphi Expert Elicitation ────────────────────────────────────

export const getDelphiSessions = (): Promise<DelphiSessionSummary[]> =>
  request('/delphi/sessions');

export const createDelphiSession = (data: CreateDelphiSessionPayload): Promise<{ session_id: string }> =>
  request('/delphi/sessions', { method: 'POST', body: JSON.stringify(data) });

export const getDelphiSession = (id: string): Promise<DelphiSession> =>
  request(`/delphi/sessions/${id}`);

export const advanceDelphiRound = (id: string): Promise<DelphiRoundSummary> =>
  request(`/delphi/sessions/${id}/advance`, { method: 'POST' });

export const completeDelphiSession = (id: string): Promise<DelphiConsensus> =>
  request(`/delphi/sessions/${id}/complete`, { method: 'POST' });

export const submitDelphiScore = (sessionId: string, data: DelphiScoreSubmission): Promise<{ status: string }> =>
  request(`/delphi/sessions/${sessionId}/score`, { method: 'POST', body: JSON.stringify(data) });

export const getDelphiScores = (sessionId: string, params: Record<string, string> = {}): Promise<DelphiScore[]> => {
  const qs = new URLSearchParams(params).toString();
  return request(`/delphi/sessions/${sessionId}/scores${qs ? '?' + qs : ''}`);
};

export const calibrateScorer = (sessionId: string, data: { scorer_id: string }): Promise<CalibrationResult> =>
  request(`/delphi/sessions/${sessionId}/calibrate`, { method: 'POST', body: JSON.stringify(data) });

export const getDelphiSummary = (sessionId: string): Promise<DelphiRoundSummary> =>
  request(`/delphi/sessions/${sessionId}/summary`);

export const getDelphiConsensus = (sessionId: string): Promise<DelphiConsensus> =>
  request(`/delphi/sessions/${sessionId}/consensus`);

export const getDelphiScorerView = (sessionId: string, scorerId: string): Promise<ScorerView> =>
  request(`/delphi/sessions/${sessionId}/scorer/${scorerId}/view`);

export const getDelphiScorers = (sessionId: string): Promise<string[]> =>
  request(`/delphi/sessions/${sessionId}/scorers`);

export const getDelphiCalibration = (sessionId: string): Promise<CalibrationResult[]> =>
  request(`/delphi/sessions/${sessionId}/calibration`);

export const getDelphiAudit = (sessionId: string): Promise<AuditEntry[]> =>
  request(`/delphi/sessions/${sessionId}/audit`);
