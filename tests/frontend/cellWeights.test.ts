/**
 * lib/cellWeights — the 12 × 4 gross-profit-share matrix helpers (2.11.0,
 * owner ruling O6): marginals (row = category weight, column = region
 * weight), the ±0.01 sum badge, the equal-placeholder detection and the
 * per-category row shares the drill-down shows.
 */
import { describe, it, expect } from 'vitest';
import { cellMarginals, equalCellWeights, rowShares, CELL_SUM_TOLERANCE } from '@/lib/cellWeights';

const CATS = ['Hair: Color', 'Hair: Care', 'LHC: FCN'];
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
    expect(W['LHC: FCN']!['High Growth']).toBeCloseTo(1 / 12, 15);
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
