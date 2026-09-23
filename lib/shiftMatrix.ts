/**
 * The arithmetic of the Shift Matrix, kept out of the components so it can be
 * tested on its own (tests/frontend/shiftMatrix.test.ts). No React, no fetch.
 *
 *   - A column total (all categories in one year, or one force, stage or
 *     region) is the category-weighted average with the run's own category
 *     shares (category_weights_used), never a raw sum.
 *   - A row total is the category's Monte Carlo median, so the force,
 *     value-chain and region lenses add up, cell by cell, to the time path.
 *
 * scripts/check_single_source.sh (part of npm run lint) keeps these rules
 * from being re-implemented inside a component.
 */
import type { PercentileDistribution, ShiftPath } from '@/types';

/** A category's distribution in one year, or null where the run has none. */
export function getYearPercentiles(
  shifts: Record<string, ShiftPath> | undefined,
  category: string,
  year: number,
): PercentileDistribution | null {
  return shifts?.[category]?.[String(year)] ?? null;
}

/** The run's category shares (category_weights_used) in the given order; 0 for a category the run lacks. */
export function categoryShares(weights: Record<string, number>, categories: string[]): number[] {
  return categories.map((c) => weights[c] ?? 0);
}

/**
 * Sum of w * v over sum of w, over the entries with a finite value and a
 * positive weight; null when none contributes. The weights need not add up
 * to 1.
 */
export function weightedAvg(values: Array<number | null>, weights: number[]): number | null {
  let num = 0;
  let den = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const w = weights[i] ?? 0;
    if (v == null || !isFinite(v) || !isFinite(w) || w <= 0) continue;
    num += w * v;
    den += w;
  }
  return den > 0 ? num / den : null;
}
