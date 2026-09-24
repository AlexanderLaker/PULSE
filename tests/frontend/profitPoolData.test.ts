/**
 * The Profit Pool Explorer's data (lib/profitPoolData.ts): every view's
 * shares add up, every figure has a clickable source with a grade, and the
 * pool arithmetic is the one the explorer states.
 */
import { describe, it, expect } from 'vitest';
import {
  PROFIT_POOL_VIEWS, POOL_HORIZON_YEARS, gp1Terminal, poolCagr, itemRevenueEurBn,
  viewPoolSummary, toPoolRating, toGp1Rating,
} from '@/lib/profitPoolData';

const GRADES = ['reported', 'derived', 'estimate'];
const DENOMINATIONS = ['RSP', 'MSP', 'scanner-POS', 'salon-mfr', 'model'];

describe('the views', () => {
  it('are the six views, Hair and Laundry & Home Care, once each', () => {
    expect(PROFIT_POOL_VIEWS.map((s) => s.id).sort()).toEqual([
      'hair_categories', 'hair_core_adjacent', 'hair_value_chain',
      'home_care_categories', 'laundry_core_adjacent', 'laundry_value_chain',
    ]);
  });

  it("each view's revenue shares add up to 1 (to their three-decimal rounding)", () => {
    for (const view of PROFIT_POOL_VIEWS) {
      const total = view.items.reduce((a, it) => a + it.revenueShare, 0);
      expect(Math.abs(total - 1), view.id).toBeLessThanOrEqual(0.002 + 1e-12);
      const items = view.items.reduce((a, it) => a + itemRevenueEurBn(view, it), 0);
      expect(items).toBeCloseTo(view.poolSizeEurBn, 6);
    }
  });

  it('every row has a plausible margin and growth, a unique id and an explained construction', () => {
    for (const view of PROFIT_POOL_VIEWS) {
      expect(view.construction.length, view.id).toBeGreaterThan(100);
      expect(new Set(view.items.map((it) => it.id)).size).toBe(view.items.length);
      for (const it of view.items) {
        expect(it.gp1Margin, it.id).toBeGreaterThan(0);
        expect(it.gp1Margin, it.id).toBeLessThan(1);
        expect(Math.abs(it.revenueCAGR), it.id).toBeLessThan(0.3);
        expect(Math.abs(it.gp1DeltaBps), it.id).toBeLessThanOrEqual(1000);
      }
    }
  });

  it('every figure cites a clickable source with a grade and a known denomination', () => {
    for (const view of PROFIT_POOL_VIEWS) {
      for (const it of view.items) {
        const refs = [...it.sources.revenue, ...it.sources.margin];
        expect(it.sources.revenue.length, it.id).toBeGreaterThan(0);
        expect(it.sources.margin.length, it.id).toBeGreaterThan(0);
        for (const ref of refs) {
          expect(ref.url, `${it.id}: ${ref.label}`).toMatch(/^https:\/\//);
          expect(ref.label, it.id).toContain(': ');
          expect(GRADES, it.id).toContain(ref.grade);
          if (ref.denomination) expect(DENOMINATIONS, it.id).toContain(ref.denomination);
        }
      }
    }
  });
});

describe('the pool arithmetic', () => {
  const item = { revenueCAGR: 0.04, gp1Margin: 0.40, gp1DeltaBps: 100 };

  it('grows the pool by revenue growth and margin drift together', () => {
    expect(gp1Terminal(item)).toBeCloseTo(0.41, 12);
    const marginCagr = Math.pow(0.41 / 0.40, 1 / POOL_HORIZON_YEARS) - 1;
    expect(poolCagr(item)).toBeCloseTo((1.04) * (1 + marginCagr) - 1, 12);
    expect(gp1Terminal({ gp1Margin: 0.05, gp1DeltaBps: -1000 })).toBe(0.01);
  });

  it("a view's weighted pool growth lies between its rows' own growth rates", () => {
    for (const view of PROFIT_POOL_VIEWS) {
      const rates = view.items.map((it) => poolCagr(it));
      const { gp1PoolNowEurBn, gp1PoolTerminalEurBn, weightedPoolCagr } = viewPoolSummary(view);
      expect(gp1PoolTerminalEurBn).toBeGreaterThan(0);
      expect(gp1PoolNowEurBn).toBeGreaterThan(0);
      expect(weightedPoolCagr).toBeGreaterThanOrEqual(Math.min(...rates) - 1e-12);
      expect(weightedPoolCagr).toBeLessThanOrEqual(Math.max(...rates) + 1e-12);
    }
  });

  it('rates growth and margin drift on the stated ladders', () => {
    expect(toPoolRating(0.004)).toMatchObject({ direction: 'flat', arrows: 0 });
    expect(toPoolRating(0.02)).toMatchObject({ direction: 'up', arrows: 1 });
    expect(toPoolRating(-0.045)).toMatchObject({ direction: 'down', arrows: 2 });
    expect(toPoolRating(0.07)).toMatchObject({ direction: 'up', arrows: 3 });
    expect(toGp1Rating(20)).toMatchObject({ direction: 'flat', arrows: 0 });
    expect(toGp1Rating(-130)).toMatchObject({ direction: 'down', arrows: 3, label: '-130bps' });
  });
});
