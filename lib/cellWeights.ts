/**
 * cellWeights.ts — helpers for the 12 × 4 cell gross-profit-share matrix
 * (2.11.0, owner ruling O6). Single source for the marginals and the
 * sum/equality checks the Config sheet grid and the About footer show.
 *
 * The engine contract: cell_weights[category][region] is the share of the
 * HCB gross-profit pool in that cell; the 48 shares sum to 1. Row sums are
 * the category weights, column sums the region weights (both derived, never
 * edited). PUT /api/v1/config accepts a total within ±0.01 of 1.
 */

export type CellWeights = Record<string, Record<string, number>>;

export interface CellMarginals {
  categories: string[];
  regions: string[];
  rowSums: Record<string, number>;
  colSums: Record<string, number>;
  total: number;
  cellCount: number;
  /** total within the backend tolerance (±0.01 of 1). */
  ok: boolean;
  /** every cell equals 1 / cellCount (the owner's placeholder). */
  equal: boolean;
}

export const CELL_SUM_TOLERANCE = 0.01;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);

/** Marginals of a cell-weight matrix in the given (or discovered) key order. */
export function cellMarginals(
  cells: CellWeights | null | undefined,
  categoryOrder: string[] = [],
  regionOrder: string[] = [],
): CellMarginals {
  const catsRaw = Object.keys(cells ?? {});
  const categories = [...categoryOrder.filter((c) => catsRaw.includes(c)), ...catsRaw.filter((c) => !categoryOrder.includes(c))];
  const regionsRaw = Array.from(new Set(categories.flatMap((c) => Object.keys(cells?.[c] ?? {}))));
  const regions = [...regionOrder.filter((r) => regionsRaw.includes(r)), ...regionsRaw.filter((r) => !regionOrder.includes(r))];
  const rowSums: Record<string, number> = {};
  const colSums: Record<string, number> = {};
  let total = 0;
  for (const c of categories) {
    rowSums[c] = 0;
    for (const r of regions) {
      const w = num(cells?.[c]?.[r]);
      rowSums[c] += w;
      colSums[r] = (colSums[r] ?? 0) + w;
      total += w;
    }
  }
  const cellCount = categories.length * regions.length;
  const equal = cellCount > 0 && categories.every((c) => regions.every((r) => Math.abs(num(cells?.[c]?.[r]) - 1 / cellCount) < 1e-6));
  return { categories, regions, rowSums, colSums, total, cellCount, ok: Math.abs(total - 1) <= CELL_SUM_TOLERANCE, equal };
}

/** The equal 1/n placeholder matrix over the given keys. */
export function equalCellWeights(categories: string[], regions: string[]): CellWeights {
  const n = categories.length * regions.length;
  const out: CellWeights = {};
  for (const c of categories) {
    out[c] = {};
    for (const r of regions) out[c][r] = n > 0 ? 1 / n : 0;
  }
  return out;
}

/** A category's row normalised to its own sum — the weights that rolled
 *  THAT category's regional shifts up (undefined when the row sums to 0). */
export function rowShares(cells: CellWeights | null | undefined, category: string): Record<string, number> | undefined {
  const row = cells?.[category];
  if (!row) return undefined;
  const sum = Object.values(row).reduce((a, b) => a + num(b), 0);
  if (sum <= 0) return undefined;
  return Object.fromEntries(Object.entries(row).map(([r, w]) => [r, num(w) / sum]));
}
