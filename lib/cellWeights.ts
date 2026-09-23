/**
 * The cell weights: each (category, region) cell's share of HCB gross profit,
 * 13 x 4 = 52 shares that sum to 1. A run rolls its cell shifts up to the
 * categories and the portfolio with them and records the weights it used
 * (cell_weights_used): a category's shift is the share-weighted mean of its
 * row, the portfolio's the share-weighted sum of all cells. Row sums are the
 * category shares, column sums the region shares.
 *
 * The default is the estimated HCB mix (lib/cellWeightProvenance.ts), an
 * estimate from public reporting, not Henkel P&L; a finance file passed to
 * the production run replaces it.
 */
import { ESTIMATED_CELL_WEIGHTS } from '@/lib/cellWeightProvenance';
import { CATEGORY_NAMES, REGIONS } from '@/lib/format';

/** category -> region -> share. */
export type CellWeights = Record<string, Record<string, number>>;

/** How the estimate's source label opens (prism/config.py ESTIMATE_SOURCE_PREFIX);
 *  the production run refuses a finance file whose label does. */
export const ESTIMATE_SOURCE_PREFIX = 'ESTIMATE, not Henkel P&L';

/**
 * What a run's cell weights are, read from the source label the run stored:
 * the estimate, whose label opens with ESTIMATE_SOURCE_PREFIX, or the
 * weights of a file given to the production run, whose label is the file's
 * own.
 */
export type CellWeightsBasis = 'estimate' | 'file';

export function cellWeightsBasis(source: string | null | undefined): CellWeightsBasis {
  return (source ?? '').trimStart().startsWith(ESTIMATE_SOURCE_PREFIX) ? 'estimate' : 'file';
}

export interface CellMarginals {
  /** category -> its share (row sum). */
  rowSums: Record<string, number>;
  /** region -> its share (column sum). */
  colSums: Record<string, number>;
  total: number;
  /** Every cell within 1e-6 of the estimated HCB mix. */
  matchesEstimate: boolean;
}

/**
 * Row and column sums of a run's cell weights, over the taxonomy
 * (CATEGORY_NAMES x REGIONS). The API serves a run only with a share for
 * every cell (prism/api/runs.py).
 */
export function cellMarginals(cells: CellWeights): CellMarginals {
  const rowSums: Record<string, number> = {};
  const colSums: Record<string, number> = Object.fromEntries(REGIONS.map((r) => [r, 0]));
  let total = 0;
  let matchesEstimate = true;
  for (const c of CATEGORY_NAMES) {
    rowSums[c] = 0;
    for (const r of REGIONS) {
      const w = cells[c]![r]!;
      rowSums[c] += w;
      colSums[r]! += w;
      total += w;
      if (Math.abs(w - ESTIMATED_CELL_WEIGHTS[c]![r]!) >= 1e-6) matchesEstimate = false;
    }
  }
  return { rowSums, colSums, total, matchesEstimate };
}

/** A category's row divided by its own sum: the weights that rolled that
 *  category's regional shifts up. Undefined for a row of zeros, which the run
 *  reports as an integrity event. */
export function rowShares(cells: CellWeights, category: string): Record<string, number> | undefined {
  const row = cells[category]!;
  const sum = REGIONS.reduce((acc, r) => acc + row[r]!, 0);
  if (sum <= 0) return undefined;
  return Object.fromEntries(REGIONS.map((r) => [r, row[r]! / sum]));
}
