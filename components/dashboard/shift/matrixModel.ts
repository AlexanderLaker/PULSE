/**
 * The Shift Matrix as the page shows it: the lenses and their columns, the
 * rows, and the matrix of one lens and year built from the served run, with
 * the category-weighted totals from lib/shiftMatrix.ts.
 */
import { CATEGORIES, CATEGORY_NAMES, FORCES, REGIONS, YEARS, groupDisplay } from '@/lib/format';
import { VC_STEPS } from '@/lib/valueChain';
import { getYearPercentiles, weightedAvg } from '@/lib/shiftMatrix';
import type { PercentileDistribution, SimulationResult } from '@/types';

// ─── Lenses ──────────────────────────────────────────────────────────────

export type ViewMode = 'time' | 'force' | 'vc' | 'region';
type Lens = Exclude<ViewMode, 'time'>;

/** The columns of each attribution lens, in the engine's order. */
const LENS_COLUMNS: Record<Lens, string[]> = {
  force: FORCES,
  vc: [...VC_STEPS],
  region: REGIONS,
};

// ─── Impact filter (Time Path) ───────────────────────────────────────────
// Shows the expansion or the contraction drivers' part of each cell: the net
// cell times its category's fraction from computeImpactFractions (the
// drivers' signed weight x exposure / 5, summed by sign). The year shape
// stays the net simulation's; it splits the net run rather than running a
// separate one.
export type ImpactFilter = 'total' | 'expansion' | 'contraction';

// ─── The matrix model ────────────────────────────────────────────────────

export interface MatrixRow {
  /** The category's API key, e.g. "LHC: FCN". */
  id: string;
  label: string;
  group: string;
  /** Acronym chip for a Laundry & Home Care row. */
  code?: string;
}

export const ROWS: MatrixRow[] = CATEGORIES.map((c) => ({
  id: c.name, label: c.label, code: c.code, group: groupDisplay(c.group),
}));

/** category -> column -> value; null where the run has none. */
export type CellMap = Record<string, Record<string, number | null>>;

export interface MatrixModel {
  columns: string[];
  data: CellMap;
  /** Each category's median at the lens year; the attribution lenses only. */
  rowTotals?: Record<string, number | null>;
  colTotals: Record<string, number | null>;
  /** The weighted average of the row totals; the attribution lenses only. */
  grandTotal: number | null;
  /** Each cell's distribution, for the P10–P90 hover; the unfiltered Time Path only. */
  cellDetails?: Record<string, Record<string, PercentileDistribution | null>>;
}

/** Each column's category-weighted average. */
export function columnTotals(data: CellMap, columns: string[], weights: number[]): Record<string, number | null> {
  return Object.fromEntries(columns.map((col) => [col, weightedAvg(CATEGORY_NAMES.map((c) => data[c][col]), weights)]));
}

export function buildMatrix(simulation: SimulationResult, view: ViewMode, year: number, weights: number[]): MatrixModel {
  if (view === 'time') {
    const columns = YEARS.map(String);
    const data: CellMap = {};
    const cellDetails: Record<string, Record<string, PercentileDistribution | null>> = {};
    for (const c of CATEGORY_NAMES) {
      data[c] = {};
      cellDetails[c] = {};
      for (const y of YEARS) {
        const band = getYearPercentiles(simulation.shifts, c, y);
        cellDetails[c][String(y)] = band;
        data[c][String(y)] = band?.median ?? null;
      }
    }
    return { columns, data, colTotals: columnTotals(data, columns, weights), grandTotal: null, cellDetails };
  }

  const yearKey = String(year);
  const columns = LENS_COLUMNS[view];
  const decomposition = simulation.decompositions[view][yearKey];
  const data: CellMap = {};
  const rowTotals: Record<string, number | null> = {};
  for (const c of CATEGORY_NAMES) {
    data[c] = Object.fromEntries(columns.map((d) => [d, decomposition?.[c]?.[d] ?? null]));
    rowTotals[c] = simulation.totals.category_path[c]?.[yearKey] ?? null;
  }
  return {
    columns,
    data,
    rowTotals,
    colTotals: columnTotals(data, columns, weights),
    grandTotal: weightedAvg(CATEGORY_NAMES.map((c) => rowTotals[c]), weights),
  };
}
