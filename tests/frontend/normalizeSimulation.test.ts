/**
 * Unit tests for api/client.ts normalizeSimulation — the shape adapter
 * between the engine's result contract and the frontend SimulationResult.
 * Pins the three accepted input shapes (engine bundle with .path wrap,
 * legacy flat year-map, already-normalized) and idempotence.
 */
import { describe, it, expect } from 'vitest';
import { normalizeSimulation } from '@/api/client';

const cell = { median: -0.01, p10: -0.02, p90: -0.001 };

describe('normalizeSimulation', () => {
  it('unwraps shift_matrix[cat].path into shifts[cat]', () => {
    const r = normalizeSimulation({
      shift_matrix: { 'Hair: Color': { path: { 2030: cell }, velocity: { 2030: -0.002 } } },
      allocation: { invest_more: ['Hair: Care'] },
      convergence: { 'Hair: Color': { r_hat: 1.0 } },
      iterations: 500,
    });
    expect(r.shifts['Hair: Color']).toEqual({ 2030: cell });
    expect(r.allocation_recommendation).toEqual({ invest_more: ['Hair: Care'] });
  });

  it('accepts a shift_matrix whose values are already year-maps (legacy flat)', () => {
    const r = normalizeSimulation({ shift_matrix: { 'Hair: Color': { 2030: cell } } });
    expect(r.shifts['Hair: Color']).toEqual({ 2030: cell });
  });

  it('prefers allocation_recommendation over allocation when both exist', () => {
    const r = normalizeSimulation({
      shifts: {},
      allocation_recommendation: { defend: ['LHC: FCN'] },
      allocation: { defend: ['WRONG'] },
    });
    expect(r.allocation_recommendation).toEqual({ defend: ['LHC: FCN'] });
  });

  it('is idempotent: normalize(normalize(x)) === normalize(x) structurally', () => {
    const once = normalizeSimulation({
      shift_matrix: { 'Hair: Color': { path: { 2030: cell } } },
      decompositions: { force: {} },
      totals: { grand: {} },
    });
    const twice = normalizeSimulation(once);
    expect(twice).toEqual(once);
  });

  it('degrades to empty shifts on garbage input', () => {
    expect(normalizeSimulation(null).shifts).toEqual({});
    expect(normalizeSimulation({}).shifts).toEqual({});
  });
});
