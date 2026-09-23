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

/** category -> region -> share. */
export type CellWeights = Record<string, Record<string, number>>;

/**
 * What a run's cell weights are, read from the source label the run stored:
 * the estimate, whose label starts with "ESTIMATE" (prism/config.py
 * DEFAULT_CELL_WEIGHTS_SOURCE), or the weights of a file given to the
 * production run, whose label is the file's own.
 */
export type CellWeightsBasis = 'estimate' | 'file';

export function cellWeightsBasis(source: string | null | undefined): CellWeightsBasis {
  return (source ?? '').trimStart().toUpperCase().startsWith('ESTIMATE') ? 'estimate' : 'file';
}

export interface CellMarginals {
  categories: string[];
  regions: string[];
  /** category -> its share (row sum). */
  rowSums: Record<string, number>;
  /** region -> its share (column sum). */
  colSums: Record<string, number>;
  total: number;
  cellCount: number;
  /** Every cell equals the estimated HCB mix, over exactly its keys. */
  matchesEstimate: boolean;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** The estimate's keys and every cell within 1e-6 of it. */
function isEstimate(cells: CellWeights, categories: string[], regions: string[]): boolean {
  if (categories.length !== Object.keys(ESTIMATED_CELL_WEIGHTS).length) return false;
  return categories.every((c) => {
    const row = ESTIMATED_CELL_WEIGHTS[c];
    return !!row && regions.length === Object.keys(row).length
      && regions.every((r) => row[r] !== undefined && Math.abs(num(cells[c]?.[r]) - row[r]) < 1e-6);
  });
}

/** Row and column sums of a matrix, keys in the given order first, then any others. */
export function cellMarginals(cells: CellWeights, categoryOrder: string[] = [], regionOrder: string[] = []): CellMarginals {
  const ordered = (keys: string[], order: string[]) =>
    [...order.filter((k) => keys.includes(k)), ...keys.filter((k) => !order.includes(k))];
  const categories = ordered(Object.keys(cells), categoryOrder);
  const regions = ordered(Array.from(new Set(categories.flatMap((c) => Object.keys(cells[c] ?? {})))), regionOrder);
  const rowSums: Record<string, number> = {};
  const colSums: Record<string, number> = {};
  let total = 0;
  for (const c of categories) {
    rowSums[c] = 0;
    for (const r of regions) {
      const w = num(cells[c]?.[r]);
      rowSums[c] += w;
      colSums[r] = (colSums[r] ?? 0) + w;
      total += w;
    }
  }
  const cellCount = categories.length * regions.length;
  return {
    categories, regions, rowSums, colSums, total, cellCount,
    matchesEstimate: cellCount > 0 && isEstimate(cells, categories, regions),
  };
}

/** A category's row divided by its own sum: the weights that rolled that
 *  category's regional shifts up. Undefined when the row is missing or zero. */
export function rowShares(cells: CellWeights, category: string): Record<string, number> | undefined {
  const row = cells[category];
  if (!row) return undefined;
  const sum = Object.values(row).reduce((a, b) => a + num(b), 0);
  if (sum <= 0) return undefined;
  return Object.fromEntries(Object.entries(row).map(([r, w]) => [r, num(w) / sum]));
}
