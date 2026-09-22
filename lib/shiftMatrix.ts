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
import type { Driver, PercentileDistribution, ShiftPath } from '@/types';
import type { CategoryDefinition } from '@/lib/format';

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

/**
 * Each category's split into its expanding and contracting part, for the
 * matrix's Expansion and Contraction filters.
 *
 * For category c, with every driver's signed weight (normalized_score) times
 * its exposure / 5:
 *   pos = sum of the positive terms, neg = sum of the negative terms,
 *   expansion = pos / (pos + neg), contraction = neg / (pos + neg).
 * The two add up to 1, so scaling a cell, row or column by one of them keeps
 * the shape the run produced. Where pos and neg cancel (or no driver touches
 * the category) the split falls back to magnitude shares.
 */
export function computeImpactFractions(
  drivers: Driver[],
  categories: CategoryDefinition[],
): Record<string, { expansion: number; contraction: number }> {
  const out: Record<string, { expansion: number; contraction: number }> = {};
  for (const { name } of categories) {
    let pos = 0;
    let neg = 0;
    for (const d of drivers) {
      const exposure = Math.max(0, Math.min(5, d.category_exposure[name] ?? 0));
      if (exposure === 0) continue;
      const term = d.normalized_score * (exposure / 5);
      if (term > 0) pos += term;
      else neg += term;
    }
    const total = pos + neg;
    if (Math.abs(total) < 1e-9) {
      const magnitude = pos - neg;
      out[name] = magnitude > 1e-9
        ? { expansion: pos / magnitude, contraction: neg / magnitude }
        : { expansion: 0, contraction: 0 };
    } else {
      out[name] = { expansion: pos / total, contraction: neg / total };
    }
  }
  return out;
}
