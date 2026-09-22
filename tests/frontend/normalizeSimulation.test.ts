/**
 * normalizeSimulation (api/client.ts): the served run with each category's
 * percentile path lifted into `shifts`, everything else passed through.
 */
import { describe, it, expect } from 'vitest';
import { normalizeSimulation } from '@/api/client';
import type { SimulationPayload } from '@/types';
import { linearPath, makeSimulation } from './fixtures/prism';

function payload(): SimulationPayload {
  const { shifts, ...rest } = makeSimulation();
  return {
    ...rest,
    shift_matrix: Object.fromEntries(Object.entries(shifts).map(([cat, path]) => [cat, { path, velocity: {} }])),
  };
}

describe('normalizeSimulation', () => {
  it("lifts each category's path into shifts and drops shift_matrix", () => {
    const raw = payload();
    const run = normalizeSimulation(raw);
    expect(run.shifts['LHC: FCN']).toEqual(raw.shift_matrix['LHC: FCN'].path);
    expect(Object.keys(run.shifts)).toEqual(Object.keys(raw.shift_matrix));
    expect('shift_matrix' in run).toBe(false);
  });

  it('passes every other part of the run through unchanged', () => {
    const raw = payload();
    const run = normalizeSimulation(raw);
    for (const key of ['regional_shift_matrix', 'decompositions', 'totals', 'cell_weights_used', 'category_weights_used',
      'region_weights_used', 'cell_weights_source', 'mc_standard_error', 'integrity_events', 'seed_stability',
      'run_meta'] as const) {
      expect(run[key]).toEqual(raw[key]);
    }
  });

  it('keeps the string year keys of the API', () => {
    const run = normalizeSimulation({ ...payload(), shift_matrix: { 'Hair: Color': { path: linearPath(-0.05), velocity: {} } } });
    expect(Object.keys(run.shifts['Hair: Color'])[0]).toBe('2026');
    expect(run.shifts['Hair: Color']['2035'].median).toBeCloseTo(-0.05, 12);
  });
});
