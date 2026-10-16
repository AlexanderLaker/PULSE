/**
 * The Drivers list as a CSV file: the rows as filtered and sorted on the page,
 * one line per driver with its scores as the model reads them. Four lines of
 * preamble come first (the title, the date, the filter in force and what the
 * figures are), then the column names and the rows (lib/exportCsv.ts).
 */
import { csvText, rowsToCsv } from '@/lib/exportCsv';
import { CATEGORIES, REGIONS, fmtDate, fmtPct, fmtShift } from '@/lib/format';
import { driverNames } from '@/lib/driverNames';
import type { Driver } from '@/types';
import { curveLabel } from './shared';

/** A category's filter label: the label with its code for Laundry & Home
 *  Care ("Fabric Clean (FCN)"), the label alone for Hair ("Care"). */
export const categoryChipLabel = (c: { label: string; code?: string }): string =>
  c.code ? `${c.label} (${c.code})` : c.label;

export const CSV_NOTE =
  "Scores are the model's inputs; the expected effect is before force weight, overlap correction, timing and exposure";

export interface DriversCsvParts {
  /** The lines before the table: the title, the date, the filter, the note. */
  preamble: string[][];
  header: string[];
  rows: string[][];
}

/** The preamble, the columns and the rows of the Drivers export. */
export function driversCsvParts(drivers: readonly Driver[], filterText: string, now: Date = new Date()): DriversCsvParts {
  const header = [
    'id', 'code', 'short name', 'long name', 'technical scope', 'force', 'direction', 'confidence', 'probability', 'GP1 % affected', 'expected effect',
    'peak year', 'diffusion curve', 'uncertainty',
    ...CATEGORIES.map((c) => `${categoryChipLabel(c)} exposure`),
    ...REGIONS.map((r) => `${r} exposure`),
    'value-chain epicentre', 'sources', 'edited',
  ];
  const rows = drivers.map((d) => {
    const names = driverNames(d);
    return [
      d.id,
      names.code,
      csvText(names.shortName),
      csvText(names.longName),
      csvText(names.technicalScope),
      d.force,
      d.direction,
      d.confidence,
      String(d.probability),
      fmtPct(d.gp1_pct_affected),
      fmtShift(d.expected_effect),
      String(d.peak_year),
      curveLabel(d.diffusion_curve),
      String(d.uncertainty),
      ...CATEGORIES.map((c) => String(d.category_exposure[c.name] ?? '')),
      ...REGIONS.map((r) => String(d.regional_exposure[r] ?? '')),
      d.vc_epicentre,
      String(d.sources.length),
      d.scores_edited ? 'yes' : 'no',
    ];
  });
  return {
    preamble: [['PRISM drivers'], [fmtDate(now)], [csvText(filterText)], [CSV_NOTE]],
    header,
    rows,
  };
}

/** The whole file as text. */
export function driversCsvText(drivers: readonly Driver[], filterText: string, now?: Date): string {
  const { preamble, header, rows } = driversCsvParts(drivers, filterText, now);
  return rowsToCsv(header, rows, preamble);
}
