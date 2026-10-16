/**
 * The Shift Matrix as the page shows it: the lenses and their columns, the
 * rows, the matrix of one lens and year built from the served run, with the
 * category-weighted totals from lib/shiftMatrix.ts, the sentence that says
 * what a band covers, and the matrix as CSV rows.
 */
import {
  BASE_YEAR, CATEGORIES, CATEGORY_NAMES, FIRST_YEAR, FORCES, HORIZON, NO_VALUE, REGIONS, YEARS, fmtDateTimeUtc,
  fmtShift, groupDisplay,
} from '@/lib/format';
import { VC_STAGES } from '@/lib/valueChain';
import { getYearPercentiles, weightedAvg } from '@/lib/shiftMatrix';
import { rowsToCsv } from '@/lib/exportCsv';
import type { PercentileDistribution, SimulationResult } from '@/types';

// ─── Lenses ──────────────────────────────────────────────────────────────

export type Lens = 'time' | 'force' | 'vc' | 'region';
type AttributionLens = Exclude<Lens, 'time'>;

/** The columns of each attribution lens, in the engine's order. */
const LENS_COLUMNS: Record<AttributionLens, string[]> = {
  force: FORCES,
  vc: [...VC_STAGES],
  region: REGIONS,
};

// ─── Impact filter (Time path) ───────────────────────────────────────────
// Shows the expansion or the contraction drivers' part of each cell: the
// drivers' contributions at the score means summed by sign and scaled to the
// cell's median (signParts in lib/driverAttribution.ts). It splits the net
// run rather than running a separate one.
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
  /** Each cell's distribution, for the P10–P90 hover; the unfiltered Time path only. */
  cellDetails?: Record<string, Record<string, PercentileDistribution | null>>;
}

/** Each column's category-weighted average. */
export function columnTotals(data: CellMap, columns: string[], weights: number[]): Record<string, number | null> {
  return Object.fromEntries(columns.map((col) => [col, weightedAvg(CATEGORY_NAMES.map((c) => data[c][col]), weights)]));
}

export function buildMatrix(simulation: SimulationResult, lens: Lens, year: number, weights: number[]): MatrixModel {
  if (lens === 'time') {
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

  // The API serves a run only with every category's attribution, in every
  // column of the lens, and its total in every year (prism/api/runs.py); a
  // category no driver reaches has shares of zero.
  const yearKey = String(year);
  const columns = LENS_COLUMNS[lens];
  const decomposition = simulation.decompositions[lens][yearKey]!;
  const data: CellMap = {};
  const rowTotals: Record<string, number | null> = {};
  for (const c of CATEGORY_NAMES) {
    data[c] = Object.fromEntries(columns.map((d) => [d, decomposition[c]![d]!]));
    rowTotals[c] = simulation.totals.category_path[c]![yearKey]!;
  }
  return {
    columns,
    data,
    rowTotals,
    colTotals: columnTotals(data, columns, weights),
    grandTotal: weightedAvg(CATEGORY_NAMES.map((c) => rowTotals[c]), weights),
  };
}

// ─── What a band covers ──────────────────────────────────────────────────

/**
 * The one sentence under the KPI strip (and in every export) that says what
 * a P10 to P90 band covers and what it leaves out. The Monte Carlo iterations
 * vary each driver's size and timing only (docs/adr/0007-honest-display.md);
 * on a run weighted with the estimated cell weights the estimate is named
 * among the things outside the band.
 */
export function bandCoverageSentence(onEstimate: boolean): string {
  const outside = onEstimate
    ? 'the scores themselves, the cell-weight estimate or drivers not yet listed'
    : 'the scores themselves or drivers not yet listed';
  return `Bands cover 80% of simulated outcomes for each driver's size and timing. They do not cover ${outside}.`;
}

/** The note a run on the estimated cell weights carries into an export. */
export const ESTIMATE_EXPORT_NOTE =
  'Categories and the portfolio are weighted with an estimated HCB gross-profit mix built from public reporting, not Henkel P&L.';

// ─── The matrix as CSV ───────────────────────────────────────────────────

export interface MatrixCsvOptions {
  model: MatrixModel;
  lens: Lens;
  lensLabel: string;
  year: number;
  /** The impact filter's label on the Time path, where one is active. */
  filterLabel?: string;
  simulation: SimulationResult;
  onEstimate: boolean;
}

/** The title of a matrix export: the lens, and the year on an attribution lens. */
export function matrixExportTitle(lens: Lens, lensLabel: string, year: number): string {
  return lens === 'time' ? `${lensLabel}, ${FIRST_YEAR} to ${HORIZON}` : `${lensLabel}, ${year}`;
}

/**
 * The matrix as the screen shows it, as CSV: a header block (what the file
 * is, the lens and year, the run, how to read the values, what a band
 * covers), an empty row, then the table with the same formatted figures as
 * the cells. On the unfiltered Time path every year also carries its P10 and
 * P90; the Total row and, on an attribution lens, the Total column are the
 * category-weighted averages the matrix shows.
 */
export function matrixToCsv({ model, lens, lensLabel, year, filterLabel, simulation, onEstimate }: MatrixCsvOptions): string {
  const timePath = lens === 'time';
  const withBands = timePath && !!model.cellDetails;
  const showTotalCol = !!model.rowTotals && Object.values(model.rowTotals).some((v) => v != null);
  const meta = simulation.run_meta;
  const values = timePath
    ? (filterLabel
        ? `signed % vs ${BASE_YEAR}, one decimal; the part of each year's median the ${filterLabel.toLowerCase()} carry`
        : `signed % vs ${BASE_YEAR}, one decimal; medians (P10 and P90 for the Time path)`)
    : `signed % vs ${BASE_YEAR}, one decimal; attribution of each category's median in ${year}, adding up to it`;
  const preamble: string[][] = [
    ['PRISM Shift Matrix'],
    ['Lens', filterLabel ? `${lensLabel}: ${filterLabel}` : lensLabel],
    ['Year', timePath ? `${FIRST_YEAR} to ${HORIZON}` : String(year)],
    ['Run', `#${meta.run_id}`, fmtDateTimeUtc(meta.run_date)],
    ['Values', values],
    ['Bands', bandCoverageSentence(onEstimate)],
    ...(onEstimate ? [['Weights', ESTIMATE_EXPORT_NOTE]] : []),
  ];

  const header = ['Category', 'Group', 'Code'];
  for (const col of model.columns) {
    header.push(col);
    if (withBands) header.push(`${col} P10`, `${col} P90`);
  }
  if (showTotalCol) header.push(`Total ${year}`);

  const cell = (v: number | null | undefined) => (v == null ? NO_VALUE : fmtShift(v, 1));
  const rows: string[][] = ROWS.map((row) => {
    const out = [row.label, row.group, row.code ?? ''];
    for (const col of model.columns) {
      out.push(cell(model.data[row.id]?.[col]));
      if (withBands) {
        const band = model.cellDetails?.[row.id]?.[col] ?? null;
        out.push(band ? fmtShift(band.p10, 1) : NO_VALUE, band ? fmtShift(band.p90, 1) : NO_VALUE);
      }
    }
    if (showTotalCol) out.push(cell(model.rowTotals?.[row.id]));
    return out;
  });
  const total = ['Total', '', ''];
  for (const col of model.columns) {
    total.push(cell(model.colTotals[col]));
    if (withBands) total.push('', '');
  }
  if (showTotalCol) total.push(cell(model.grandTotal));
  rows.push(total);

  return rowsToCsv(header, rows, preamble);
}
