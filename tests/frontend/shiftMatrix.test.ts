/**
 * Unit tests for lib/shiftMatrix.ts — the Layer-C aggregation rules
 * behind every portfolio total on the Profit Pool Analysis page.
 *
 * These pin the exact behaviours the June 2026 review found silently
 * degraded (finding 1): the equal-weight fallback fires ONLY when no
 * category_weights exist at all; a present-but-incomplete weights map
 * excludes unknown categories instead of silently up-weighting them.
 */
import { describe, it, expect } from 'vitest';
import {
  weightedAvg, catWeightFor, getYearPercentiles, computeImpactFractions,
} from '@/lib/shiftMatrix';
import type { Trend, CategoryDefinition } from '@/types';

describe('weightedAvg', () => {
  it('computes a normalized weighted average (weights need not sum to 1)', () => {
    expect(weightedAvg([1, 3], [2, 2])).toBe(2);
    expect(weightedAvg([1, 3], [200, 200])).toBe(2); // built-in normalization
    expect(weightedAvg([-0.01, -0.03], [3, 1])).toBeCloseTo(-0.015, 12);
  });
  it('skips null / non-finite values and non-positive weights', () => {
    expect(weightedAvg([1, null, 3], [1, 1, 1])).toBe(2);
    expect(weightedAvg([1, NaN, 3], [1, 1, 1])).toBe(2);
    expect(weightedAvg([1, 100, 3], [1, 0, 1])).toBe(2);
    expect(weightedAvg([1, 100, 3], [1, -5, 1])).toBe(2);
  });
  it('returns null when nothing contributes', () => {
    expect(weightedAvg([], [])).toBeNull();
    expect(weightedAvg([null, null], [1, 1])).toBeNull();
    expect(weightedAvg([1, 2], [0, 0])).toBeNull();
  });
});

describe('catWeightFor', () => {
  const weights = { 'Hair: Color': 2, hair_care: 0.5 };
  it('resolves by display name first, then snake_case id', () => {
    expect(catWeightFor(weights, 'Hair: Color', 'hair_color')).toBe(2);
    expect(catWeightFor(weights, 'Hair: Care', 'hair_care')).toBe(0.5);
  });
  it('falls back to 1 (equal weight) ONLY when no weights map exists', () => {
    expect(catWeightFor(undefined, 'Hair: Color', 'hair_color')).toBe(1);
  });
  it('returns 0 (excluded) when the map exists but lacks the category', () => {
    expect(catWeightFor(weights, 'LHC: FCN', 'lhc_fcn')).toBe(0);
  });
});

describe('getYearPercentiles', () => {
  const shifts = {
    'Hair: Color': { 2030: { median: -0.03, p10: -0.05, p90: -0.01 } },
    hair_care: { '2030': -0.02 }, // snake id + string year + scalar cell
  } as never;
  it('resolves display name with numeric year keys', () => {
    expect(getYearPercentiles(shifts, 'Hair: Color', 'hair_color', 2030)).toEqual(
      { median: -0.03, p10: -0.05, p90: -0.01 },
    );
  });
  it('falls back to snake id, tolerates string year keys and scalar cells', () => {
    expect(getYearPercentiles(shifts, 'Hair: Care', 'hair_care', 2030)).toEqual(
      { median: -0.02 },
    );
  });
  it('returns null for missing data', () => {
    expect(getYearPercentiles(undefined, 'x', 'x', 2030)).toBeNull();
    expect(getYearPercentiles(shifts, 'LHC: FCN', 'lhc_fcn', 2030)).toBeNull();
    expect(getYearPercentiles(shifts, 'Hair: Color', 'hair_color', 2029)).toBeNull();
  });
});

describe('computeImpactFractions', () => {
  const cats: CategoryDefinition[] = [
    { id: 'hair_color', name: 'Hair: Color', short: 'Color', group: 'Hair', color: '#fff' },
  ];
  const trend = (gp1: number, exp = 5): Trend => ({
    id: 't', force: 'Consumer', name: 't', description: '', direction: 'Expansion',
    probability: 3, start_year: 2025,
    gp1_shift: gp1,
    category_exposure: { 'Hair: Color': exp },
  } as unknown as Trend);

  it('splits expansion vs contraction so the fractions sum to 1', () => {
    const f = computeImpactFractions([trend(0.3), trend(-0.1)], cats)['Hair: Color'];
    expect(f.expansion + f.contraction).toBeCloseTo(1, 12);
    expect(f.expansion).toBeCloseTo(1.5, 12);     // 0.3 / 0.2
    expect(f.contraction).toBeCloseTo(-0.5, 12);  // -0.1 / 0.2
  });
  it('falls back to magnitude shares when pos and neg cancel exactly', () => {
    const f = computeImpactFractions([trend(0.2), trend(-0.2)], cats)['Hair: Color'];
    expect(f.expansion).toBeCloseTo(0.5, 12);
    expect(f.contraction).toBeCloseTo(-0.5, 12);
  });
  it('yields zeros when no trend touches the category', () => {
    const f = computeImpactFractions([trend(0.3, 0)], cats)['Hair: Color'];
    expect(f).toEqual({ expansion: 0, contraction: 0 });
  });
});
