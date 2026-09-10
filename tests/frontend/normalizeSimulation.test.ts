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
      convergence: { 'Hair: Color': { r_hat: 1.0 } },
      iterations: 500,
    });
    expect(r.shifts['Hair: Color']).toEqual({ 2030: cell });
  });

  it('accepts a shift_matrix whose values are already year-maps (legacy flat)', () => {
    const r = normalizeSimulation({ shift_matrix: { 'Hair: Color': { 2030: cell } } });
    expect(r.shifts['Hair: Color']).toEqual({ 2030: cell });
  });

  it('is idempotent: normalize(normalize(x)) === normalize(x) structurally', () => {
    const once = normalizeSimulation({
      shift_matrix: { 'Hair: Color': { path: { 2030: cell } } },
      regional_shift_matrix: { 'Hair: Color': { Europe: { path: { 2030: cell } } } },
      region_weights_used: { Europe: 0.38, 'North America': 0.26, Asia: 0.17, 'High Growth': 0.19 },
      decompositions: { force: {} },
      totals: { portfolio: {} },
    });
    const twice = normalizeSimulation(once);
    expect(twice).toEqual(once);
  });

  it('carries the 2.11.0 cell-weight block (O6) and tolerates its absence on old runs', () => {
    const W = { 'Hair: Color': { Europe: 0.5, 'North America': 0.5, Asia: 0, 'High Growth': 0 } };
    const r = normalizeSimulation({
      shift_matrix: { 'Hair: Color': { path: { 2030: cell } } },
      cell_weights_used: W,
      category_weights_used: { 'Hair: Color': 1 },
      region_weights_used: { Europe: 0.5, 'North America': 0.5, Asia: 0, 'High Growth': 0 },
      cell_weights_source: 'Equal placeholder',
    });
    expect(r.cell_weights_used).toEqual(W);
    expect(r.category_weights_used).toEqual({ 'Hair: Color': 1 });
    expect(r.cell_weights_source).toBe('Equal placeholder');
    const old = normalizeSimulation({ shift_matrix: { 'Hair: Color': { path: { 2030: cell } } } });
    expect(old.cell_weights_used).toBeUndefined();
    expect(old.category_weights_used).toBeUndefined();
  });

  it('degrades to empty shifts on garbage input', () => {
    expect(normalizeSimulation(null).shifts).toEqual({});
    expect(normalizeSimulation({}).shifts).toEqual({});
  });
});
