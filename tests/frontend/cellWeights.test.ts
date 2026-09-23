/**
 * The cell weights (lib/cellWeights.ts) and the generated record behind the
 * estimated HCB mix (lib/cellWeightProvenance.ts): the marginals, the
 * detection of the estimate, the per-category row shares the drill-down
 * shows, and the record's consistency with its own derivation.
 */
import { describe, it, expect } from 'vitest';
import { ESTIMATE_SOURCE_PREFIX, cellMarginals, cellWeightsBasis, rowShares, type CellWeights } from '@/lib/cellWeights';
import {
  BLOCK_SPLIT, CATEGORY_MIX, ESTIMATE_MARGINALS, ESTIMATE_SOURCE, ESTIMATED_CELL_WEIGHTS,
  GRADE_LEGEND, MARGIN_INDEX, REGION_MIX,
} from '@/lib/cellWeightProvenance';
import { CATEGORIES, CATEGORY_NAMES as CATS, REGIONS, categoryDisplay } from '@/lib/format';

const copyOfEstimate = (): CellWeights =>
  Object.fromEntries(Object.entries(ESTIMATED_CELL_WEIGHTS).map(([c, row]) => [c, { ...row }]));

describe('cellMarginals', () => {
  it('sums the rows (category shares) and the columns (region shares)', () => {
    const W = {
      'Hair: Color': { Europe: 0.2, 'North America': 0.1, Asia: 0.0, 'High Growth': 0.1 },
      'Hair: Care': { Europe: 0.3, 'North America': 0.1, Asia: 0.1, 'High Growth': 0.1 },
    };
    const m = cellMarginals(W, CATS, REGIONS);
    expect(m.categories).toEqual(['Hair: Color', 'Hair: Care']);
    expect(m.regions).toEqual(REGIONS);
    expect(m.rowSums['Hair: Color']).toBeCloseTo(0.4, 12);
    expect(m.rowSums['Hair: Care']).toBeCloseTo(0.6, 12);
    expect(m.colSums.Europe).toBeCloseTo(0.5, 12);
    expect(m.colSums.Asia).toBeCloseTo(0.1, 12);
    expect(m.total).toBeCloseTo(1, 12);
    expect(m.cellCount).toBe(8);
    expect(m.matchesEstimate).toBe(false);
  });

  it('treats a missing cell as zero', () => {
    const m = cellMarginals({ 'Hair: Color': { Europe: 0.5 }, 'Hair: Care': { Europe: 0.45, Asia: 0.05 } });
    expect(m.regions).toEqual(['Europe', 'Asia']);
    expect(m.rowSums['Hair: Color']).toBeCloseTo(0.5, 12);
    expect(m.total).toBeCloseTo(1, 12);
    expect(cellMarginals({}).cellCount).toBe(0);
  });

  it('puts the known keys in the given order and keeps unknown ones after them', () => {
    const m = cellMarginals({ Zeta: { 'High Growth': 0.5, Europe: 0.5 } }, CATS, REGIONS);
    expect(m.categories).toEqual(['Zeta']);
    expect(m.regions).toEqual(['Europe', 'High Growth']);
  });
});

describe('matchesEstimate', () => {
  it('recognises the estimated HCB mix over its 13 x 4 cells', () => {
    const m = cellMarginals(copyOfEstimate(), CATS, REGIONS);
    expect(m.matchesEstimate).toBe(true);
    expect(m.cellCount).toBe(52);
    expect(m.total).toBeCloseTo(1, 9);
  });

  it('is false after a one-cell change and true inside the 1e-6 tolerance', () => {
    const changed = copyOfEstimate();
    changed['LHC: FCN'].Europe += 1e-5;
    expect(cellMarginals(changed, CATS, REGIONS).matchesEstimate).toBe(false);
    const rounded = copyOfEstimate();
    rounded['LHC: FCN'].Europe += 1e-9;
    expect(cellMarginals(rounded, CATS, REGIONS).matchesEstimate).toBe(true);
  });

  it('is false for finance figures, however close, over other keys', () => {
    const equal = Object.fromEntries(CATS.map((c) => [c, Object.fromEntries(REGIONS.map((r) => [r, 1 / 52]))]));
    expect(cellMarginals(equal, CATS, REGIONS).matchesEstimate).toBe(false);

    const missingCategory = copyOfEstimate();
    delete missingCategory['LHC: IC'];
    expect(cellMarginals(missingCategory, CATS, REGIONS).matchesEstimate).toBe(false);

    const extraCategory = { ...copyOfEstimate(), Zeta: { Europe: 0, 'North America': 0, Asia: 0, 'High Growth': 0 } };
    expect(cellMarginals(extraCategory, CATS, REGIONS).matchesEstimate).toBe(false);

    const renamedRegion = copyOfEstimate();
    for (const row of Object.values(renamedRegion)) {
      row.EMEA = row.Europe;
      delete row.Europe;
    }
    expect(cellMarginals(renamedRegion, CATS, REGIONS).matchesEstimate).toBe(false);
    expect(cellMarginals({}, CATS, REGIONS).matchesEstimate).toBe(false);
  });
});

describe('cellWeightsBasis', () => {
  it("reads the estimate from its exact label, and any other label as a file's", () => {
    expect(ESTIMATE_SOURCE.startsWith(ESTIMATE_SOURCE_PREFIX)).toBe(true);
    expect(cellWeightsBasis(ESTIMATE_SOURCE)).toBe('estimate');
    expect(cellWeightsBasis('Estimated GP1 mix FY2025 (Finance)')).toBe('file');
    expect(cellWeightsBasis('HCB finance, gross profit FY2025')).toBe('file');
    expect(cellWeightsBasis(null)).toBe('file');
  });
});

describe('rowShares', () => {
  it("divides a category's row by its own sum", () => {
    const W = {
      'Hair: Color': { Europe: 0.3, 'North America': 0.1, Asia: 0, 'High Growth': 0 },
      'LHC: FCN': { Europe: 0, 'North America': 0, Asia: 0, 'High Growth': 0 },
    };
    const shares = rowShares(W, 'Hair: Color')!;
    expect(shares.Europe).toBeCloseTo(0.75, 12);
    expect(shares['North America']).toBeCloseTo(0.25, 12);
    expect(shares.Asia).toBe(0);
    expect(rowShares(W, 'LHC: FCN')).toBeUndefined();
    expect(rowShares(W, 'missing')).toBeUndefined();
  });
});

describe('the estimate record agrees with its own derivation', () => {
  const ESTIMATE_CATS = Object.keys(ESTIMATED_CELL_WEIGHTS);
  const sorted = (keys: string[]): string[] => [...keys].sort();
  const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);

  it('the three input tables cover exactly the categories of the estimate', () => {
    expect(ESTIMATE_CATS).toHaveLength(13);
    for (const table of [CATEGORY_MIX, MARGIN_INDEX, REGION_MIX, ESTIMATE_MARGINALS.category]) {
      expect(sorted(Object.keys(table))).toEqual(sorted(ESTIMATE_CATS));
    }
  });

  it("each block's category shares sum to 1, and so do the blocks", () => {
    const byBlock: Record<string, number> = {};
    for (const [category, graded] of Object.entries(CATEGORY_MIX)) {
      expect(Object.keys(BLOCK_SPLIT.shares)).toContain(graded.block);
      expect(graded.note.length).toBeGreaterThan(0);
      expect(Object.keys(GRADE_LEGEND)).toContain(graded.grade);
      expect(Object.keys(GRADE_LEGEND)).toContain(MARGIN_INDEX[category].grade);
      byBlock[graded.block] = (byBlock[graded.block] ?? 0) + graded.shareOfBlock;
    }
    expect(sorted(Object.keys(byBlock))).toEqual(sorted(Object.keys(BLOCK_SPLIT.shares)));
    for (const share of Object.values(byBlock)) expect(share).toBeCloseTo(1, 9);
    expect(sum(Object.values(BLOCK_SPLIT.shares))).toBeCloseTo(1, 9);
    expect(Object.keys(GRADE_LEGEND)).toContain(BLOCK_SPLIT.grade);
  });

  it("each category's region mix covers the four regions and sums to 1", () => {
    for (const [category, graded] of Object.entries(REGION_MIX)) {
      expect(sorted(Object.keys(graded.mix))).toEqual(sorted(REGIONS));
      expect(sum(Object.values(graded.mix))).toBeCloseTo(1, 9);
      expect(graded.note.length).toBeGreaterThan(0);
      expect(Object.keys(GRADE_LEGEND)).toContain(graded.grade);
      expect(sorted(Object.keys(ESTIMATED_CELL_WEIGHTS[category]))).toEqual(sorted(REGIONS));
    }
  });

  it('the derivation reproduces the matrix and its marginals', () => {
    // share = category share of its block x the block's share of HCB x GP1 margin index
    //         x the category's own regional mix, normalised to 1
    const raw: Record<string, Record<string, number>> = {};
    let total = 0;
    for (const [category, graded] of Object.entries(CATEGORY_MIX)) {
      const blockShare = (BLOCK_SPLIT.shares as Record<string, number>)[graded.block];
      const base = graded.shareOfBlock * blockShare * MARGIN_INDEX[category].index;
      raw[category] = {};
      for (const [region, w] of Object.entries(REGION_MIX[category].mix)) {
        raw[category][region] = base * w;
        total += base * w;
      }
    }
    const m = cellMarginals(ESTIMATED_CELL_WEIGHTS, CATS, REGIONS);
    for (const category of ESTIMATE_CATS) {
      for (const region of REGIONS) {
        expect(Math.abs(raw[category][region] / total - ESTIMATED_CELL_WEIGHTS[category][region])).toBeLessThan(1e-8);
      }
      expect(m.rowSums[category]).toBeCloseTo(ESTIMATE_MARGINALS.category[category as keyof typeof ESTIMATE_MARGINALS.category], 9);
    }
    for (const region of REGIONS) {
      expect(m.colSums[region]).toBeCloseTo(ESTIMATE_MARGINALS.region[region as keyof typeof ESTIMATE_MARGINALS.region], 9);
    }
  });
});

describe('the category list', () => {
  it("follows the engine's order, Toilet Care between Hard-Surface Cleaner and Insect Control", () => {
    expect(CATS).toEqual([
      'Hair: Color', 'Hair: Care', 'Hair: Styling', 'Hair: Body',
      'LHC: FCN', 'LHC: FCA', 'LHC: FFI', 'LHC: LAD',
      'LHC: HDW', 'LHC: ADW', 'LHC: HSC', 'LHC: TOI', 'LHC: IC',
    ]);
    expect(CATS).toEqual(Object.keys(ESTIMATED_CELL_WEIGHTS));
  });

  it('gives every category a plain-English label and its own colour', () => {
    for (const c of CATEGORIES) expect(categoryDisplay(c.name)).not.toBe(c.name);
    expect(new Set(CATEGORIES.map((c) => c.color)).size).toBe(CATEGORIES.length);
  });
});
