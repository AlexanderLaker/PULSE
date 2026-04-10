/**
 * PULSE War Room — API client
 */

const BASE = '/api/v1';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API ${res.status}`);
  }
  return res.json();
}

// ── Health & config ─────────────────────────────────────────────
export const getHealth = () => request('/health');
export const getConfig = () => request('/config');

// ── Trends ──────────────────────────────────────────────────────
export const getTrends = (force) =>
  request(`/trends${force ? `?force=${encodeURIComponent(force)}` : ''}`);
export const getTrend = (id) => request(`/trends/${id}`);
export const updateTrend = (id, data) =>
  request(`/trends/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// ── Simulation ──────────────────────────────────────────────────
export const getSimulation = () => request('/simulation');
export const runSimulation = (params = {}) =>
  request('/simulate', { method: 'POST', body: JSON.stringify(params) });
export const runDeterministic = () =>
  request('/simulate/deterministic', { method: 'POST' });

// ── Causal DAG ──────────────────────────────────────────────────
export const getDAG = () => request('/causal/dag');
export const propagateShock = (data) =>
  request('/causal/propagate', { method: 'POST', body: JSON.stringify(data) });

// ── Scenarios ───────────────────────────────────────────────────
export const getScenarios = () => request('/scenarios');
export const createScenario = (data) =>
  request('/scenarios', { method: 'POST', body: JSON.stringify(data) });

// ── Sensitivity ─────────────────────────────────────────────────
export const getTornado = (category) =>
  request(`/sensitivity/tornado${category ? `?category=${encodeURIComponent(category)}` : ''}`);

// ── Optimizer ───────────────────────────────────────────────────
export const optimizeAllocation = (data) =>
  request('/optimize/allocation', { method: 'POST', body: JSON.stringify(data) });

// ── Forces ──────────────────────────────────────────────────────
export const getForces = () => request('/forces');

// ── Audit ───────────────────────────────────────────────────────
export const getAuditLog = (limit = 50) => request(`/audit/log?limit=${limit}`);
