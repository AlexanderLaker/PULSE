/**
 * lib/shiftMatrix.ts — Pure business math for the Shift-Matrix views.
 *
 * Extracted verbatim from ProfitPoolAnalysis2.tsx (June 2026) so the
 * Layer-C aggregation rules live in one tested, framework-free module
 * instead of inside a 1.7k-line component. These functions are the
 * executable specification of how PRISM turns per-category MC output
 * into the portfolio-level numbers leadership sees:
 *
 *   • Column totals / grand totals are CATEGORY-WEIGHTED AVERAGES using
 *     `config.category_weights` — never raw sums.
 *   • Row totals stay anchored to the MC median per (cat, year), so the
 *     Force / VC / Region lenses reconcile cell-by-cell with Time Path.
 *   • If the config endpoint returns no category_weights, every category
 *     falls back to weight 1 (equal-weighted) — and ONLY then.
 *
 * No React, no fetch, no Date/RNG — keep it that way: this module is
 * unit-tested (tests/frontend/shiftMatrix.test.ts) and is meant to be
 * lifted unchanged into any future rewrite.
 */

import type { PercentileDistribution, ShiftPath, Trend, CategoryDefinition } from '@/types';

/** Get the full percentile distribution (median + p10/p25/p75/p90) for a
 *  category at a given year. Returns `null` if the cell has no data. If the
 *  backend only stored a scalar median for this cell, returns `{ median }`
 *  with no percentile bands — the tooltip will gracefully omit P10/P90.
 *  Tolerates both backend display keys ("Hair: Color") and snake_case IDs
 *  ("hair_color"), and both numeric (2030) and string ("2030") year keys. */
export function getYearPercentiles(
  shifts: Record<string, ShiftPath> | undefined,
  catKey: string,
  catFallbackId: string,
  year: number,
): PercentileDistribution | null {
  if (!shifts) return null;
  const path = shifts[catKey] ?? shifts[catFallbackId];
  if (!path) return null;
  const v = (path as Record<string | number, unknown>)[year]
         ?? (path as Record<string | number, unknown>)[String(year)];
  if (v == null) return null;
  if (typeof v === 'number') return { median: v };
  return v as PercentileDistribution;
}

/** Category-weighted average helper — Layer C aggregation primitive.
 *
 * Returns  Σᵢ wᵢ·vᵢ / Σᵢ wᵢ   over the indices where vᵢ is finite and
 * wᵢ > 0. Returns null if no cat contributes (all values missing, or all
 * weights zero). Normalization is built in, so callers can pass raw
 * weights from `config.category_weights` without pre-normalizing — if
 * an admin sets weights that don't sum to 1.0, we still get a correct
 * weighted average. */
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
  if (den <= 0) return null;
  return num / den;
}

/** Resolve the business-importance weight for one category.
 *
 * Keyed by display name ("Hair: Color") to match backend
 * DEFAULT_CATEGORY_WEIGHTS; falls back to the snake_case id
 * ("hair_color") in case a future backend persists either shape, and
 * ultimately to 1.0 (equal-weighted) if the config endpoint didn't
 * return category_weights at all. A weights map that exists but lacks
 * the category yields 0 — explicit exclusion from the weighted average. */
export function catWeightFor(
  catWeightsRaw: Record<string, number> | undefined,
  catName: string,
  fallbackId: string,
): number {
  if (!catWeightsRaw) return 1; // equal-weight fallback
  const byName = catWeightsRaw[catName];
  if (typeof byName === 'number' && isFinite(byName)) return byName;
  const byId = catWeightsRaw[fallbackId];
  if (typeof byId === 'number' && isFinite(byId)) return byId;
  return 0; // explicit zero → excluded from the weighted average
}

/** Per-category expansion / contraction fractions.
 *
 * For each category c:
 *   rawPos_c = Σ(gp1_shift × exposure/5) over trends touching c, where >0
 *   rawNeg_c = Σ(gp1_shift × exposure/5) over trends touching c, where <0
 *   rawTotal_c = rawPos_c + rawNeg_c
 *   expansionFrac_c   = rawPos_c / rawTotal_c
 *   contractionFrac_c = rawNeg_c / rawTotal_c
 * Sum to 1 by construction (when rawTotal ≠ 0). Multiplying every
 * backend cell, row total, and col total by this fraction yields
 * the expansion-only / contraction-only matrix while preserving
 * the cell-shape the backend produced. Year-independent because
 * gp1_shift × exposure scales the year-shape proportionally.
 *
 * Edge case: when positives exactly cancel negatives (or no trends touch
 * the category) we fall back to magnitude shares so the filter is still
 * meaningful. */
export function computeImpactFractions(
  trends: Trend[],
  categories: CategoryDefinition[],
): Record<string, { expansion: number; contraction: number }> {
  const out: Record<string, { expansion: number; contraction: number }> = {};
  categories.forEach((cat) => {
    const cidName = cat.name;
    const cidSnake = cat.id;
    let rawPos = 0;
    let rawNeg = 0;
    (trends ?? []).forEach((t) => {
      const exposureRaw = (t.category_exposure ?? {}) as Record<string, number>;
      const exp = exposureRaw[cidName] ?? exposureRaw[cidSnake] ?? 0;
      if (!(exp > 0)) return;
      const gp1 = (t as { gp1_shift?: number; normalized_score?: number }).gp1_shift
        ?? t.normalized_score
        ?? 0;
      const contrib = gp1 * (Math.max(0, Math.min(5, exp)) / 5);
      if (contrib > 0) rawPos += contrib;
      else if (contrib < 0) rawNeg += contrib;
    });
    const rawTotal = rawPos + rawNeg;
    if (Math.abs(rawTotal) < 1e-9) {
      // Edge: positives exactly cancel negatives, or no trends touch
      // the category. Fall back to magnitude shares so the filter is
      // still meaningful.
      const mag = rawPos + Math.abs(rawNeg);
      const eFrac = mag > 1e-9 ? rawPos / mag : 0;
      const cFrac = mag > 1e-9 ? -Math.abs(rawNeg) / mag : 0;
      out[cidName] = { expansion: eFrac, contraction: cFrac };
    } else {
      out[cidName] = {
        expansion:   rawPos / rawTotal,
        contraction: rawNeg / rawTotal,
      };
    }
  });
  return out;
}
