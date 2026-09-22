/**
 * lib/shiftMatrix: the arithmetic behind every total of the Shift Matrix.
 */
import { describe, it, expect } from 'vitest';
import { categoryShares, computeImpactFractions, getYearPercentiles, weightedAvg } from '@/lib/shiftMatrix';
import { CATEGORIES } from '@/lib/format';
import { distribution, makeDriver } from './fixtures/prism';

describe('weightedAvg', () => {
  it('divides by the weights, which need not add up to 1', () => {
    expect(weightedAvg([1, 3], [2, 2])).toBe(2);
    expect(weightedAvg([1, 3], [200, 200])).toBe(2);
    expect(weightedAvg([-0.01, -0.03], [3, 1])).toBeCloseTo(-0.015, 12);
  });

  it('skips missing and non-finite values and non-positive weights', () => {
    expect(weightedAvg([1, null, 3], [1, 1, 1])).toBe(2);
    expect(weightedAvg([1, NaN, 3], [1, 1, 1])).toBe(2);
    expect(weightedAvg([1, 100, 3], [1, 0, 1])).toBe(2);
    expect(weightedAvg([1, 100, 3], [1, -5, 1])).toBe(2);
  });

  it('is null when nothing contributes', () => {
    expect(weightedAvg([], [])).toBeNull();
    expect(weightedAvg([null, null], [1, 1])).toBeNull();
    expect(weightedAvg([1, 2], [0, 0])).toBeNull();
  });
});

describe('categoryShares', () => {
  it("reads the run's shares in the given order, 0 for a category the run lacks", () => {
    expect(categoryShares({ 'Hair: Color': 0.2, 'LHC: FCN': 0.3 }, ['LHC: FCN', 'Hair: Care', 'Hair: Color']))
      .toEqual([0.3, 0, 0.2]);
  });
});

describe('getYearPercentiles', () => {
  const shifts = { 'Hair: Color': { '2030': distribution(-0.03) } };

  it("reads a category's distribution in a year", () => {
    expect(getYearPercentiles(shifts, 'Hair: Color', 2030)).toEqual(distribution(-0.03));
  });

  it('is null where the run has no value', () => {
    expect(getYearPercentiles(undefined, 'Hair: Color', 2030)).toBeNull();
    expect(getYearPercentiles(shifts, 'LHC: FCN', 2030)).toBeNull();
    expect(getYearPercentiles(shifts, 'Hair: Color', 2029)).toBeNull();
  });
});

describe('computeImpactFractions', () => {
  const colour = CATEGORIES.filter((c) => c.name === 'Hair: Color');
  const driver = (score: number, exposure = 5) =>
    makeDriver({ normalized_score: score, category_exposure: { 'Hair: Color': exposure } });

  it('splits a category into its expanding and contracting part, which add up to 1', () => {
    const f = computeImpactFractions([driver(0.3), driver(-0.1)], colour)['Hair: Color'];
    expect(f.expansion + f.contraction).toBeCloseTo(1, 12);
    expect(f.expansion).toBeCloseTo(1.5, 12);
    expect(f.contraction).toBeCloseTo(-0.5, 12);
  });

  it('weights each driver by its exposure / 5', () => {
    const f = computeImpactFractions([driver(0.3, 5), driver(-0.3, 1)], colour)['Hair: Color'];
    expect(f.expansion).toBeCloseTo(0.3 / 0.24, 12);
  });

  it('falls back to magnitude shares when the two parts cancel', () => {
    const f = computeImpactFractions([driver(0.2), driver(-0.2)], colour)['Hair: Color'];
    expect(f.expansion).toBeCloseTo(0.5, 12);
    expect(f.contraction).toBeCloseTo(-0.5, 12);
  });

  it('is zero for a category no driver touches', () => {
    expect(computeImpactFractions([driver(0.3, 0)], colour)['Hair: Color']).toEqual({ expansion: 0, contraction: 0 });
  });
});
