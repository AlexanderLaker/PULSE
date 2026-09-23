/**
 * lib/shiftMatrix: the arithmetic behind every total of the Shift Matrix.
 */
import { describe, it, expect } from 'vitest';
import { categoryShares, getYearPercentiles, weightedAvg } from '@/lib/shiftMatrix';
import { distribution } from './fixtures/prism';

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
