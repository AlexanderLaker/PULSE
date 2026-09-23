/**
 * Parity lock for lib/driverAttribution.ts.
 *
 * The PRISM Analysis readings on the Drivers page are written on the Python
 * decomposition in prism/attribution.py; the category drill-down ranks the
 * contributing drivers with this TypeScript port. The two must give the same
 * numbers, so scripts/build_driver_analysis.py writes a fixture with the inputs
 * and its unscaled outputs and this test replays it: every driver's
 * contribution to the portfolio and to every category, in every path year,
 * must agree to floating-point precision, and the drivers of a category must
 * add up to the category shift at the means.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  computeDriverAttribution, computeMaterializationSchedule, expectedMaterialization,
  peakJitterFor, signSplit, type AttributionResult,
} from '@/lib/driverAttribution';
import { BASE_YEAR, YEARS } from '@/lib/format';

const FIXTURE = path.resolve(__dirname, 'fixtures', 'driverAttribution.fixture.json');

type Fixture = {
  inputs: Parameters<typeof computeDriverAttribution>[0];
  expected: {
    byDriver: Record<string, { portfolio: Record<string, number>; category: Record<string, Record<string, number>> }>;
    portfolioShift: Record<string, number>;
    categoryShift: Record<string, Record<string, number>>;
  };
};

const load = (): Fixture => JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

const close = (a: number, b: number) => {
  const tol = 1e-12 + 1e-9 * Math.max(Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= tol;
};

describe('lib/driverAttribution parity with prism/attribution.py', () => {
  const fx = load();
  const result = computeDriverAttribution(fx.inputs);

  it('replays every driver, category and year of the fixture', () => {
    const ids = Object.keys(fx.expected.byDriver);
    expect(ids.length).toBe(51);
    let compared = 0;
    for (const id of ids) {
      const exp = fx.expected.byDriver[id];
      const got = result.byDriver[id];
      expect(got, id).toBeDefined();
      for (const [year, v] of Object.entries(exp.portfolio)) {
        expect(close(got.portfolio[Number(year)], v), `${id} portfolio ${year}: ${got.portfolio[Number(year)]} vs ${v}`).toBe(true);
        compared++;
      }
      for (const [cat, row] of Object.entries(exp.category)) {
        for (const [year, v] of Object.entries(row)) {
          expect(close(got.category[cat][Number(year)], v), `${id} ${cat} ${year}`).toBe(true);
          compared++;
        }
      }
    }
    expect(compared).toBe(51 * 10 * 14);
  });

  it('reproduces the category and portfolio shifts at the means', () => {
    for (const [year, v] of Object.entries(fx.expected.portfolioShift)) {
      expect(close(result.portfolioShift[Number(year)], v), `portfolio ${year}`).toBe(true);
    }
    for (const [cat, row] of Object.entries(fx.expected.categoryShift)) {
      for (const [year, v] of Object.entries(row)) {
        expect(close(result.categoryShift[cat][Number(year)], v), `${cat} ${year}`).toBe(true);
      }
    }
  });

  it('adds the drivers of a category up to the category shift (the spread closes the cross-terms)', () => {
    for (const cat of fx.inputs.categories) {
      for (const year of result.years) {
        const sum = Object.values(result.byDriver).reduce((acc, d) => acc + d.category[cat][year], 0);
        expect(close(sum, result.categoryShift[cat][year]), `${cat} ${year}`).toBe(true);
      }
    }
    for (const year of result.years) {
      const sum = Object.values(result.byDriver).reduce((acc, d) => acc + d.portfolio[year], 0);
      expect(close(sum, result.portfolioShift[year]), `portfolio ${year}`).toBe(true);
    }
  });

  it('ranks the 2035 headwinds as the record does (X-15, C-01, C-06, K-13, G-04 first)', () => {
    const last = result.years[result.years.length - 1];
    const ranked = Object.entries(result.byDriver)
      .sort((a, b) => a[1].portfolio[last] - b[1].portfolio[last])
      .slice(0, 5).map(([id]) => id);
    expect(ranked).toEqual(['competitive_r15', 'consumer_r01', 'consumer_r06', 'customer_r13', 'government_r04']);
  });
});

describe('materialisation schedule and jitter (ports of prism/config.py)', () => {
  it('matches the engine\'s curve values on the fixture drivers', () => {
    // s-curve 2025 -> 2030 (onset 2025): the engine rounds to 4 decimals.
    const s = computeMaterializationSchedule(2030, 's_curve', YEARS, BASE_YEAR, 2025);
    expect(s[2026]).toBe(0.0242);
    expect(s[2027]).toBe(0.2301);
    expect(s[2028]).toBe(0.7699);
    expect(s[2029]).toBe(0.9758);
    expect(s[2030]).toBe(1);
    expect(s[2035]).toBe(1);
    const lin = computeMaterializationSchedule(2029, 'linear', YEARS, BASE_YEAR, 2025);
    expect(lin[2027]).toBe(0.5);
    const fl = computeMaterializationSchedule(2027, 'front_loaded', YEARS, BASE_YEAR, 2025);
    expect(fl[2026]).toBe(0.7071);
    const step = computeMaterializationSchedule(2030, 'step_function', YEARS, BASE_YEAR, 2025);
    expect(step[2028]).toBe(0.05);
  });

  it('gates the onset by start_year and saturates a jittered peak at onset + 1', () => {
    const late = computeMaterializationSchedule(2035, 'linear', YEARS, BASE_YEAR, 2028);
    expect(late[2028]).toBe(0);
    expect(late[2029]).toBe(0.1429);
    expect(late[2034]).toBe(0.8571);
    const m = expectedMaterialization(
      { uncertainty: 5, peak_year: 2026, diffusion_curve: 'linear', start_year: 2025 }, YEARS, BASE_YEAR, true,
    );
    // width 4: offsets -4..+4 all clamp at onset + 1 = 2026 or later; 2026 is
    // fully materialised only for the clamped draws, so the expectation lies
    // strictly between 0 and 1 and reaches 1 by 2030.
    expect(m[0]).toBeGreaterThan(0);
    expect(m[0]).toBeLessThan(1);
    expect(m[4]).toBe(1);
  });

  it('reads the jitter width from the uncertainty score and honours the switch', () => {
    expect(peakJitterFor(0, true)).toBe(0);
    expect(peakJitterFor(2, true)).toBe(1);
    expect(peakJitterFor(3, true)).toBe(2);
    expect(peakJitterFor(5, true)).toBe(4);
    expect(peakJitterFor(5, false)).toBe(0);
  });

  it('refuses what the engine refuses: a peak not after the onset, an unknown curve', () => {
    expect(() => computeMaterializationSchedule(2027, 'linear', YEARS, BASE_YEAR, 2027)).toThrow('after the onset 2027');
    expect(() => computeMaterializationSchedule(2030, 'jump', YEARS, BASE_YEAR, 2025)).toThrow('unknown diffusion curve');
  });
});

describe('signSplit: the expansion and contraction parts of a category in a year', () => {
  const result = (parts: number[]): AttributionResult => ({
    years: [2035],
    byDriver: Object.fromEntries(parts.map((v, i) => [`d${i}`, { portfolio: {}, category: { 'Hair: Color': { 2035: v } } }])),
    categoryShift: {},
    portfolioShift: {},
  });

  it('gives signed fractions of the net that add up to 1', () => {
    const f = signSplit(result([0.3, -0.1]), 'Hair: Color', 2035);
    expect(f.expansion + f.contraction).toBeCloseTo(1, 12);
    expect(f.expansion).toBeCloseTo(1.5, 12);
    expect(f.contraction).toBeCloseTo(-0.5, 12);
  });

  it('falls back to shares of the gross movement where the parts cancel', () => {
    const f = signSplit(result([0.2, -0.2]), 'Hair: Color', 2035);
    expect(f.expansion).toBeCloseTo(0.5, 12);
    expect(f.contraction).toBeCloseTo(-0.5, 12);
  });

  it('is zero where no driver contributes', () => {
    expect(signSplit(result([0, 0]), 'Hair: Color', 2035)).toEqual({ expansion: 0, contraction: 0 });
    expect(signSplit(result([0.1]), 'LHC: FCN', 2035)).toEqual({ expansion: 0, contraction: 0 });
  });

  it('splits the fixture category by category, year by year, into parts that add up to the net', () => {
    const fx = load();
    const r = computeDriverAttribution(fx.inputs);
    for (const cat of fx.inputs.categories) {
      for (const year of r.years) {
        const net = Object.values(r.byDriver).reduce((a, d) => a + d.category[cat][year], 0);
        const f = signSplit(r, cat, year);
        expect(net * f.expansion + net * f.contraction).toBeCloseTo(net, 12);
        expect(net * f.expansion).toBeGreaterThanOrEqual(-1e-15);
        expect(net * f.contraction).toBeLessThanOrEqual(1e-15);
      }
    }
  });
});
