/**
 * cellWeights.ts — helpers for the 13 × 4 cell gross-profit-share matrix
 * (2.11.0, owner ruling O6; 13 categories since 2.12.0 / O13 split Toilet
 * Care out of Hard-Surface Cleaner). Single source for the marginals and the
 * basis checks the Config sheet grid and the About footer show.
 *
 * The engine contract: cell_weights[category][region] is the share of the
 * HCB gross-profit pool in that cell; the 52 shares sum to 1. Row sums are
 * the category weights, column sums the region weights (both derived, never
 * edited). PUT /api/v1/config accepts a total within ±0.01 of 1.
 *
 * 2.12.0 (owner ruling O14): the engine default is no longer the equal 1/52
 * placeholder, it is an ESTIMATE of the HCB gross-profit mix built from
 * public reporting and category knowledge. The estimate and its graded
 * inputs live in lib/cellWeightProvenance.ts (generated from
 * data/cell_weights_estimated_v1.json), and the equal grid survives as the
 * neutral basis, one click away on the Config sheet. So a live matrix has
 * three bases to report: `matchesEstimate` (the O14 default), `equal` (the
 * 1/n grid) or neither (loaded or edited shares).
 */
import { ESTIMATED_CELL_WEIGHTS } from '@/lib/cellWeightProvenance';

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
  /** every cell equals 1 / cellCount (the neutral basis). */
  equal: boolean;
  /** every cell equals the O14 estimated HCB mix (the engine default). */
  matchesEstimate: boolean;
}

export const CELL_SUM_TOLERANCE = 0.01;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);

/** True when every cell sits within 1e-6 of the estimate AND the keys line
 *  up exactly — a matrix over different categories or regions is not the
 *  estimate however close its numbers are. */
const isEstimate = (cells: CellWeights | null | undefined, categories: string[], regions: string[]): boolean => {
  const estCats = Object.keys(ESTIMATED_CELL_WEIGHTS);
  if (categories.length !== estCats.length) return false;
  for (const c of categories) {
    const estRow = ESTIMATED_CELL_WEIGHTS[c];
    if (!estRow) return false;
    if (regions.length !== Object.keys(estRow).length) return false;
    for (const r of regions) {
      const e = estRow[r];
      if (e === undefined) return false;
      if (Math.abs(num(cells?.[c]?.[r]) - e) >= 1e-6) return false;
    }
  }
  return true;
};

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
  const matchesEstimate = cellCount > 0 && isEstimate(cells, categories, regions);
  return { categories, regions, rowSums, colSums, total, cellCount, ok: Math.abs(total - 1) <= CELL_SUM_TOLERANCE, equal, matchesEstimate };
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

/** The estimated HCB gross-profit mix (owner ruling O14) the engine defaults
 *  to, over its own 13 × 4 keys. Returned as a fresh copy so the generated
 *  constant can never be mutated through a draft the Config sheet holds. */
export function estimatedCellWeights(): CellWeights {
  const out: CellWeights = {};
  for (const [c, row] of Object.entries(ESTIMATED_CELL_WEIGHTS)) out[c] = { ...row };
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
