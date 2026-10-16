/**
 * The CSV helpers quote as RFC 4180 says, and the Shift Matrix export carries
 * the header block, the band sentence and the same formatted figures as the
 * cells: medians with P10 and P90 per year on the Time path, the attribution
 * with a Total column on the other lenses, the Total row last.
 */
import { describe, it, expect } from 'vitest';
import { csvField, csvLine, csvText, rowsToCsv, safeFilename, tablesToCsv } from '@/lib/exportCsv';
import { CATEGORY_NAMES, FORCES } from '@/lib/format';
import { categoryShares } from '@/lib/shiftMatrix';
import { LENS_META } from '@/components/dashboard/shift/controls';
import { bandCoverageSentence, buildMatrix, matrixToCsv } from '@/components/dashboard/shift/matrixModel';
import { makeSimulation } from './fixtures/prism';

const lines = (csv: string) => csv.split('\r\n');

describe('rowsToCsv', () => {
  it('quotes a field with a comma, a quote or a line break, doubling the quotes, and leaves the rest bare', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a, b')).toBe('"a, b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('two\nlines')).toBe('"two\nlines"');
    expect(csvField('')).toBe('');
    expect(csvField(null)).toBe('');
    expect(csvField(-0.5)).toBe('-0.5');
    expect(csvLine(['a', 'b,c', '"d"'])).toBe('a,"b,c","""d"""');
  });

  it('keeps a free text that a spreadsheet would run as a formula as text', () => {
    expect(csvText('=HYPERLINK("x")')).toBe("'=HYPERLINK(\"x\")");
    expect(csvText('+1 private label')).toBe("'+1 private label");
    expect(csvText('-ish')).toBe("'-ish");
    expect(csvText('@me')).toBe("'@me");
    expect(csvText('\tlead')).toBe("'\tlead");
    expect(csvText('Private label scale-up')).toBe('Private label scale-up');
    expect(csvText(null)).toBe('');
  });

  it('ends every line with CRLF and puts an empty row between the preamble and the header', () => {
    expect(rowsToCsv(['h1', 'h2'], [['1', '2'], ['3', '4']])).toBe('h1,h2\r\n1,2\r\n3,4\r\n');
    expect(rowsToCsv(['h'], [['v']], [['Title'], ['Note', 'with, comma']]))
      .toBe('Title\r\nNote,"with, comma"\r\n\r\nh\r\nv\r\n');
  });

  it('writes several tables with an empty row between them', () => {
    expect(tablesToCsv([['T']], [{ header: ['a'], rows: [['1']] }, { header: ['b', 'c'], rows: [] }]))
      .toBe('T\r\n\r\na\r\n1\r\n\r\nb,c\r\n');
  });

  it('builds a file name from letters, digits, dots and dashes only', () => {
    expect(safeFilename('PRISM-shift-matrix-Time path, 2026 to 2035', 'csv')).toBe('PRISM-shift-matrix-Time-path-2026-to-2035.csv');
    expect(safeFilename('Hard-Surface Cleaner (LHC: HSC)', 'png')).toBe('Hard-Surface-Cleaner-LHC-HSC.png');
    expect(safeFilename('***', 'csv')).toBe('export.csv');
  });
});

describe('the Shift Matrix as CSV', () => {
  const simulation = makeSimulation();
  const weights = categoryShares(simulation.category_weights_used, CATEGORY_NAMES);

  it('on the Time path: a header block, then the categories with median, P10 and P90 per year', () => {
    const model = buildMatrix(simulation, 'time', 2035, weights);
    const csv = matrixToCsv({ model, lens: 'time', lensLabel: LENS_META.time.label, year: 2035, simulation, onEstimate: true });
    const rows = lines(csv);
    expect(rows.slice(0, 8)).toEqual([
      'PRISM Shift Matrix',
      'Lens,Time path',
      'Year,2026 to 2035',
      'Run,#99,"13 Sep 2026, 23:04 UTC"',
      'Values,"signed % vs 2025, one decimal; medians (P10 and P90 for the Time path)"',
      `Bands,"${bandCoverageSentence(true)}"`,
      'Weights,"Categories and the portfolio are weighted with an estimated HCB gross-profit mix built from public reporting, not Henkel P&L."',
      '',
    ]);
    expect(rows[8]).toBe('Category,Group,Code,2026,2026 P10,2026 P90,2027,2027 P10,2027 P90,2028,2028 P10,2028 P90,'
      + '2029,2029 P10,2029 P90,2030,2030 P10,2030 P90,2031,2031 P10,2031 P90,2032,2032 P10,2032 P90,'
      + '2033,2033 P10,2033 P90,2034,2034 P10,2034 P90,2035,2035 P10,2035 P90');
    // Hair Colour ends at -2.0% with a 1 pt band each side; 2026 is a tenth of the way there.
    expect(rows[9]).toBe('Colour,Hair,,-0.2%,-1.2%,+0.8%,-0.4%,-1.4%,+0.6%,-0.6%,-1.6%,+0.4%,-0.8%,-1.8%,+0.2%,'
      + '-1.0%,-2.0%,0.0%,-1.2%,-2.2%,-0.2%,-1.4%,-2.4%,-0.4%,-1.6%,-2.6%,-0.6%,-1.8%,-2.8%,-0.8%,-2.0%,-3.0%,-1.0%');
    expect(rows[13]).toMatch(/^Fabric Clean,Laundry & Home Care,FCN,/);
    const total = rows[rows.length - 2];
    expect(total).toMatch(/^Total,,,-\d\.\d%,,,/);
    expect(rows[rows.length - 1]).toBe('');
    expect(rows).toHaveLength(9 + 13 + 1 + 1);
  });

  it('on an attribution lens: one column per force, the Total column and no Weights row for a run on real shares', () => {
    const finance = makeSimulation({ cell_weights_source: 'Finance GP1 shares FY2025' });
    const model = buildMatrix(finance, 'force', 2031, weights);
    const csv = matrixToCsv({ model, lens: 'force', lensLabel: LENS_META.force.label, year: 2031, simulation: finance, onEstimate: false });
    const rows = lines(csv);
    expect(rows[1]).toBe('Lens,Force attribution');
    expect(rows[2]).toBe('Year,2031');
    expect(rows[4]).toBe('Values,"signed % vs 2025, one decimal; attribution of each category\'s median in 2031, adding up to it"');
    expect(rows[5]).toBe(`Bands,${csvField(bandCoverageSentence(false))}`);
    expect(rows[5]).not.toContain('estimate');
    expect(rows[6]).toBe('');
    expect(rows[7]).toBe(`Category,Group,Code,${FORCES.join(',')},Total 2031`);
    // Hair Colour in 2031: -1.2% split evenly across six forces.
    expect(rows[8]).toBe('Colour,Hair,,-0.2%,-0.2%,-0.2%,-0.2%,-0.2%,-0.2%,-1.2%');
    expect(rows[rows.length - 2]).toMatch(/^Total,,,(-\d\.\d%,){6}-\d\.\d%$/);
  });

  it('names the filter on a filtered Time path and drops the bands', () => {
    const model = { ...buildMatrix(simulation, 'time', 2035, weights), cellDetails: undefined };
    const csv = matrixToCsv({
      model, lens: 'time', lensLabel: LENS_META.time.label, year: 2035, simulation, onEstimate: true,
      filterLabel: 'Contraction drivers',
    });
    const rows = lines(csv);
    expect(rows[1]).toBe('Lens,Time path: Contraction drivers');
    expect(rows[4]).toBe('Values,"signed % vs 2025, one decimal; the part of each year\'s median the contraction drivers carry"');
    expect(rows[8]).toBe('Category,Group,Code,2026,2027,2028,2029,2030,2031,2032,2033,2034,2035');
  });
});
