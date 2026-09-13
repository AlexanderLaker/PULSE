/**
 * lib/cellWeights — the 13 × 4 gross-profit-share matrix helpers (2.11.0,
 * owner ruling O6; 13 categories since 2.12.0 / O13 split Toilet Care out of
 * Hard-Surface Cleaner): marginals (row = category weight, column = region
 * weight), the ±0.01 sum badge, the two basis detections and the per-category
 * row shares the drill-down shows.
 *
 * Since 2.12.0 (owner ruling O14) there are two bases to detect, not one: the
 * ESTIMATED HCB gross-profit mix the engine now defaults to (`matchesEstimate`)
 * and the neutral equal 1/n grid (`equal`). The last block guards the
 * generated record behind the estimate (lib/cellWeightProvenance.ts) against a
 * bad regeneration: the three graded input tables must cover exactly the
 * estimate's categories, each block's category shares must sum to 1, each
 * category's region mix must sum to 1, and the documented derivation must
 * still reproduce the matrix.
 */
import { describe, it, expect } from 'vitest';
import { cellMarginals, equalCellWeights, estimatedCellWeights, rowShares, CELL_SUM_TOLERANCE } from '@/lib/cellWeights';
import {
  BLOCK_SPLIT, CATEGORY_MIX, ESTIMATE_MARGINALS, ESTIMATED_CELL_WEIGHTS,
  GRADE_LEGEND, MARGIN_INDEX, REGION_MIX,
} from '@/lib/cellWeightProvenance';
import { CATEGORIES, categoryDisplay } from '@/lib/format';

// The canonical grid, in pulse/config.py::CATEGORIES order — LHC: TOI sits
// between HSC and IC, making the matrix 13 × 4 = 52 cells.
const CATS = [
  'Hair: Color', 'Hair: Care', 'Hair: Styling', 'Hair: Body',
  'LHC: FCN', 'LHC: FCA', 'LHC: FFI', 'LHC: LAD',
  'LHC: HDW', 'LHC: ADW', 'LHC: HSC', 'LHC: TOI', 'LHC: IC',
];
const REGS = ['Europe', 'North America', 'Asia', 'High Growth'];

describe('cellMarginals', () => {
  it('computes row and column sums, the total and the tolerance badge', () => {
    const W = {
      'Hair: Color': { Europe: 0.2, 'North America': 0.1, Asia: 0.0, 'High Growth': 0.1 },
      'Hair: Care': { Europe: 0.3, 'North America': 0.1, Asia: 0.1, 'High Growth': 0.1 },
    };
    const m = cellMarginals(W, CATS, REGS);
    expect(m.categories).toEqual(['Hair: Color', 'Hair: Care']);
    expect(m.regions).toEqual(REGS);
    expect(m.rowSums['Hair: Color']).toBeCloseTo(0.4, 12);
    expect(m.rowSums['Hair: Care']).toBeCloseTo(0.6, 12);
    expect(m.colSums['Europe']).toBeCloseTo(0.5, 12);
    expect(m.colSums['Asia']).toBeCloseTo(0.1, 12);
    expect(m.total).toBeCloseTo(1, 12);
    expect(m.ok).toBe(true);
    expect(m.equal).toBe(false);
    expect(m.cellCount).toBe(8);
  });

  it('flags a total outside ±0.01 and tolerates missing cells', () => {
    const W = { 'Hair: Color': { Europe: 0.5 }, 'Hair: Care': { Europe: 0.45 } };
    const m = cellMarginals(W);
    expect(m.total).toBeCloseTo(0.95, 12);
    expect(m.ok).toBe(false);
    expect(CELL_SUM_TOLERANCE).toBe(0.01);
    expect(cellMarginals(undefined).cellCount).toBe(0);
    expect(cellMarginals(undefined).ok).toBe(false);
  });

  it('recognises the equal placeholder and equalCellWeights builds it', () => {
    const W = equalCellWeights(CATS, REGS);
    const m = cellMarginals(W, CATS, REGS);
    expect(m.equal).toBe(true);
    expect(m.total).toBeCloseTo(1, 12);
    expect(m.cellCount).toBe(52);                      // 13 categories × 4 regions
    expect(W['LHC: FCN']!['High Growth']).toBeCloseTo(1 / 52, 15);
    W['LHC: FCN']!['High Growth'] = 0.2;
    expect(cellMarginals(W, CATS, REGS).equal).toBe(false);
  });

  it('keeps unknown keys and orders known ones canonically', () => {
    const W = { 'Zeta': { 'High Growth': 0.5, Europe: 0.5 } };
    const m = cellMarginals(W, CATS, REGS);
    expect(m.categories).toEqual(['Zeta']);
    expect(m.regions).toEqual(['Europe', 'High Growth']);
  });
});

describe('matchesEstimate — the O14 estimated HCB mix', () => {
  it('recognises the generated estimate, which is not the equal grid', () => {
    const W = estimatedCellWeights();
    expect(W).toEqual(ESTIMATED_CELL_WEIGHTS);
    const m = cellMarginals(W, CATS, REGS);
    expect(m.matchesEstimate).toBe(true);
    expect(m.equal).toBe(false);
    expect(m.ok).toBe(true);
    expect(m.cellCount).toBe(52);                    // 13 categories × 4 regions
  });

  it('estimatedCellWeights sums to 1 within 1e-9 and is a detached copy', () => {
    const W = estimatedCellWeights();
    const total = Object.values(W).reduce((a, row) => a + Object.values(row).reduce((x, y) => x + y, 0), 0);
    expect(Math.abs(total - 1)).toBeLessThan(1e-9);
    W['Hair: Color']!['Europe'] = 0.5;               // mutating the copy must not
    expect(estimatedCellWeights()['Hair: Color']!['Europe'])   // touch the record
      .toBeCloseTo(ESTIMATED_CELL_WEIGHTS['Hair: Color']!['Europe']!, 15);
  });

  it('is false for the equal placeholder', () => {
    const m = cellMarginals(equalCellWeights(CATS, REGS), CATS, REGS);
    expect(m.equal).toBe(true);
    expect(m.matchesEstimate).toBe(false);
  });

  it('is false after a one-cell perturbation, true inside the 1e-6 tolerance', () => {
    const nudged = estimatedCellWeights();
    nudged['LHC: FCN']!['Europe'] += 1e-5;
    expect(cellMarginals(nudged, CATS, REGS).matchesEstimate).toBe(false);
    const negligible = estimatedCellWeights();
    negligible['LHC: FCN']!['Europe'] += 1e-9;
    expect(cellMarginals(negligible, CATS, REGS).matchesEstimate).toBe(true);
  });

  it('is false for a matrix whose keys do not match the estimate', () => {
    const missingCategory = estimatedCellWeights();
    delete missingCategory['LHC: IC'];
    expect(cellMarginals(missingCategory, CATS, REGS).matchesEstimate).toBe(false);

    const extraCategory = { ...estimatedCellWeights(), Zeta: { Europe: 0, 'North America': 0, Asia: 0, 'High Growth': 0 } };
    expect(cellMarginals(extraCategory, CATS, REGS).matchesEstimate).toBe(false);

    const renamedRegion = estimatedCellWeights();
    for (const row of Object.values(renamedRegion)) {
      row['EMEA'] = row['Europe']!;
      delete row['Europe'];
    }
    expect(cellMarginals(renamedRegion, CATS, REGS).matchesEstimate).toBe(false);

    expect(cellMarginals({}, CATS, REGS).matchesEstimate).toBe(false);
    expect(cellMarginals(undefined).matchesEstimate).toBe(false);
  });
});

describe('cellWeightProvenance — the generated record is consistent with itself', () => {
  const ESTIMATE_CATS = Object.keys(ESTIMATED_CELL_WEIGHTS);
  const sorted = (keys: string[]): string[] => [...keys].sort();
  const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);

  it('the three input tables cover exactly the categories of the estimate', () => {
    expect(ESTIMATE_CATS).toHaveLength(13);
    expect(sorted(Object.keys(CATEGORY_MIX))).toEqual(sorted(ESTIMATE_CATS));
    expect(sorted(Object.keys(MARGIN_INDEX))).toEqual(sorted(ESTIMATE_CATS));
    expect(sorted(Object.keys(REGION_MIX))).toEqual(sorted(ESTIMATE_CATS));
    expect(sorted(Object.keys(ESTIMATE_MARGINALS.category))).toEqual(sorted(ESTIMATE_CATS));
  });

  it("each block's category shares sum to 1 and the blocks sum to 1", () => {
    const byBlock: Record<string, number> = {};
    for (const [category, graded] of Object.entries(CATEGORY_MIX)) {
      expect(Object.keys(BLOCK_SPLIT.shares)).toContain(graded.block);
      expect(graded.note.length).toBeGreaterThan(0);
      expect(Object.keys(GRADE_LEGEND)).toContain(graded.grade);
      expect(Object.keys(GRADE_LEGEND)).toContain(MARGIN_INDEX[category]!.grade);
      byBlock[graded.block] = (byBlock[graded.block] ?? 0) + graded.shareOfBlock;
    }
    expect(sorted(Object.keys(byBlock))).toEqual(sorted(Object.keys(BLOCK_SPLIT.shares)));
    for (const share of Object.values(byBlock)) expect(share).toBeCloseTo(1, 9);
    expect(sum(Object.values(BLOCK_SPLIT.shares))).toBeCloseTo(1, 9);
    expect(Object.keys(GRADE_LEGEND)).toContain(BLOCK_SPLIT.grade);
  });

  it("each category's region mix covers the four regions and sums to 1", () => {
    for (const [category, graded] of Object.entries(REGION_MIX)) {
      expect(sorted(Object.keys(graded.mix))).toEqual(sorted(REGS));
      expect(sum(Object.values(graded.mix))).toBeCloseTo(1, 9);
      expect(graded.note.length).toBeGreaterThan(0);
      expect(Object.keys(GRADE_LEGEND)).toContain(graded.grade);
      expect(sorted(Object.keys(ESTIMATED_CELL_WEIGHTS[category]!))).toEqual(sorted(REGS));
    }
  });

  it('the documented derivation still reproduces the matrix and its marginals', () => {
    // share = (category share of block × block share of HCB) × GP1 index
    //         × that category's own regional mix, normalised to 1.
    const raw: Record<string, Record<string, number>> = {};
    let total = 0;
    for (const [category, graded] of Object.entries(CATEGORY_MIX)) {
      const blockShare = (BLOCK_SPLIT.shares as Record<string, number>)[graded.block]!;
      const base = graded.shareOfBlock * blockShare * MARGIN_INDEX[category]!.index;
      raw[category] = {};
      for (const [region, w] of Object.entries(REGION_MIX[category]!.mix)) {
        raw[category]![region] = base * w;
        total += base * w;
      }
    }
    const m = cellMarginals(ESTIMATED_CELL_WEIGHTS, CATS, REGS);
    for (const category of ESTIMATE_CATS) {
      for (const region of REGS) {
        expect(Math.abs(raw[category]![region]! / total - ESTIMATED_CELL_WEIGHTS[category]![region]!)).toBeLessThan(1e-8);
      }
      expect(m.rowSums[category]).toBeCloseTo(ESTIMATE_MARGINALS.category[category as keyof typeof ESTIMATE_MARGINALS.category], 9);
    }
    for (const region of REGS) {
      expect(m.colSums[region]).toBeCloseTo(ESTIMATE_MARGINALS.region[region as keyof typeof ESTIMATE_MARGINALS.region], 9);
    }
    expect(m.total).toBeCloseTo(1, 9);
  });
});

describe('canonical category taxonomy', () => {
  it('lib/format CATEGORIES mirrors the backend order — TOI between HSC and IC', () => {
    expect(CATEGORIES.map((c) => c.name)).toEqual(CATS);
  });

  it('every category carries a plain-English label and its own colour', () => {
    for (const c of CATEGORIES) expect(categoryDisplay(c.name)).not.toBe(c.name);
    expect(new Set(CATEGORIES.map((c) => c.color)).size).toBe(CATEGORIES.length);
  });
});

describe('rowShares', () => {
  it('normalises a category row to its own sum and returns undefined for a zero row', () => {
    const W = {
      'Hair: Color': { Europe: 0.3, 'North America': 0.1, Asia: 0, 'High Growth': 0 },
      'LHC: FCN': { Europe: 0, 'North America': 0, Asia: 0, 'High Growth': 0 },
    };
    const r = rowShares(W, 'Hair: Color')!;
    expect(r.Europe).toBeCloseTo(0.75, 12);
    expect(r['North America']).toBeCloseTo(0.25, 12);
    expect(r.Asia).toBe(0);
    expect(r['High Growth']).toBe(0);
    expect(rowShares(W, 'LHC: FCN')).toBeUndefined();
    expect(rowShares(W, 'missing')).toBeUndefined();
    expect(rowShares(undefined, 'Hair: Color')).toBeUndefined();
  });
});
