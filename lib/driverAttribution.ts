/**
 * Per-driver attribution of the shift: the engine's own arithmetic evaluated
 * at the score means and taken apart driver by driver.
 *
 * This is the TypeScript port of the decomposition in prism/attribution.py
 * (docs/DRIVER_ANALYSIS.md), which the PRISM Analysis readings on the Drivers
 * page are written on. The category drill-down ranks its contributing drivers
 * with it, so a driver's rank there and its reading state the same numbers.
 * scripts/build_driver_analysis.py writes a parity fixture
 * (tests/frontend/fixtures/driverAttribution.fixture.json) that
 * tests/frontend/driverAttribution.test.ts replays, so the two cannot drift
 * apart.
 *
 * Per driver j, composite cell (category c, region r) and path year y the
 * additive term of the compounding factor is
 *
 *   a[j,c,r,y] = forceWeight[f] * attenuation[f] * dampening[f,c,r]
 *              * expectedEffect[j] * E[materialisation_j(y)]
 *              * categoryExposure[j,c]/5 * regionalExposure[j,r]/5
 *
 * with expectedEffect = Beta-prior mean (probability/6) x GP1 share x
 * direction (the value the API serves) and the materialisation averaged over
 * the driver's own peak-year jitter grid. The force sums compound
 * multiplicatively per cell; the second-order cross-terms are spread over
 * the drivers of the cell in proportion to their additive terms, so the
 * drivers of a cell add up to the cell shift at the means. The roll-up is the
 * engine's: a category is the share-weighted mean of its row of the run's
 * cell weights, the portfolio the share-weighted sum over all cells.
 *
 * Read the result as attribution, never as a second simulation: the Monte
 * Carlo medians of the persisted run stay the published numbers. The
 * drill-down scales the drivers of a category to that median, and the
 * matrix's Expansion and Contraction filters split it (reconciliationFactor,
 * signParts).
 */
import { FORCES, REGIONS } from '@/lib/format';
import { UNCERTAINTY_PEAK_JITTER } from '@/lib/uncertainty';
import type { ForceName } from '@/types';

/** A driver as the decomposition reads it: the scores GET /api/v1/drivers serves. */
export interface AttributionDriver {
  id: string;
  force: ForceName;
  /** Beta-prior mean x GP1 share x direction sign, as the API serves it. */
  expected_effect: number;
  /** A score 0 to 5 for every category and every region. */
  category_exposure: Record<string, number>;
  regional_exposure: Record<string, number>;
  uncertainty: number;
  peak_year: number;
  diffusion_curve: string;
  start_year: number;
}

/** The parameters the decomposition reads, as GET /api/v1/config serves them. */
export interface AttributionConfig {
  force_weights: Record<string, number>;
  per_force_attenuation: Record<string, number>;
  within_force_overlap: Record<string, number>;
  base_year: number;
  path_years: number[];
  /** The per-iteration peak-year jitter. */
  peak_year_jitter: boolean;
}

export interface AttributionInputs {
  drivers: AttributionDriver[];
  categories: string[];
  config: AttributionConfig;
  /** cellWeights[category][region]: the gross-profit share matrix the run used (any scale). */
  cellWeights: Record<string, Record<string, number>>;
}

export interface DriverAttribution {
  /** Contribution to the portfolio shift by year (fraction, signed). */
  portfolio: Record<number, number>;
  /** Contribution to each category's shift by year (fraction, signed). */
  category: Record<string, Record<number, number>>;
}

export interface AttributionResult {
  years: number[];
  byDriver: Record<string, DriverAttribution>;
  /** The cell shifts at the means, rolled up: category and portfolio by year. */
  categoryShift: Record<string, Record<number, number>>;
  portfolioShift: Record<number, number>;
}

/**
 * Python's round(x, 4) on the schedule values. Python rounds the exact
 * binary value of x * 1e4 and breaks a true tie half to even; the two agree
 * on every value a diffusion curve can produce here (the only exact tie, the
 * step curve at t = 7/8, evaluates below the tie in both), which the parity
 * fixture replays.
 */
function roundHalfEven4(x: number): number {
  const scaled = x * 1e4;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  let r: number;
  if (diff > 0.5) r = floor + 1;
  else if (diff < 0.5) r = floor;
  else r = floor % 2 === 0 ? floor : floor + 1;
  return r / 1e4;
}

/**
 * The port of prism/config.py compute_materialization_schedule: the share of
 * a driver's full effect present in each path year, year -> fraction in [0, 1].
 * The onset is the later of the base year and the start year; the peak comes
 * after it.
 */
export function computeMaterializationSchedule(
  peakYear: number, diffusionCurve: string, years: number[], baseYear: number, startYear: number,
): Record<number, number> {
  const onset = Math.max(baseYear, startYear);
  if (peakYear <= onset) throw new Error(`peak year ${peakYear} does not come after the onset ${onset}`);
  const schedule: Record<number, number> = {};
  for (const year of years) {
    if (year >= peakYear) { schedule[year] = 1.0; continue; }
    if (year <= onset) { schedule[year] = 0.0; continue; }
    const t = (year - onset) / (peakYear - onset);
    let frac: number;
    if (diffusionCurve === 'linear') frac = t;
    else if (diffusionCurve === 'front_loaded') frac = Math.sqrt(t);
    else if (diffusionCurve === 'back_loaded') frac = t * t;
    else if (diffusionCurve === 'step_function') frac = t < 0.8 ? 0.05 : 0.05 + ((t - 0.8) / 0.2) * 0.95;
    else if (diffusionCurve === 's_curve') {
      frac = 1.0 / (1.0 + Math.exp(-12 * (t - 0.5)));
      const f0 = 1.0 / (1.0 + Math.exp(-12 * (0 - 0.5)));
      const f1 = 1.0 / (1.0 + Math.exp(-12 * (1 - 0.5)));
      frac = (frac - f0) / (f1 - f0);
    } else throw new Error(`unknown diffusion curve ${diffusionCurve}`);
    schedule[year] = roundHalfEven4(Math.max(0.0, Math.min(1.0, frac)));
  }
  return schedule;
}

/** The port of prism/config.py peak_jitter_for: the width the uncertainty score sets, 0 with the jitter off. */
export function peakJitterFor(uncertainty: number, jitterOn: boolean): number {
  return jitterOn ? UNCERTAINTY_PEAK_JITTER[uncertainty] : 0;
}

/**
 * The expected materialisation of one driver per path year: its schedule
 * averaged over the symmetric triangular peak-jitter grid, with the jittered
 * peak clamped at onset + 1 exactly as the engine's peak_schedule_table does.
 */
export function expectedMaterialization(
  d: Pick<AttributionDriver, 'uncertainty' | 'peak_year' | 'diffusion_curve' | 'start_year'>,
  years: number[], baseYear: number, jitterOn: boolean,
): number[] {
  const jt = peakJitterFor(d.uncertainty, jitterOn);
  const offsets: number[] = [];
  for (let o = -jt; o <= jt; o++) offsets.push(o);
  const weights = offsets.map((o) => (jt <= 0 ? 1 : Math.max(0, jt + 1 - Math.abs(o))));
  const wsum = weights.reduce((a, b) => a + b, 0);
  const onset = Math.max(baseYear, d.start_year);
  const byYear = years.map(() => 0);
  offsets.forEach((off, k) => {
    const w = weights[k] / wsum;
    if (w === 0) return;
    const pk = Math.max(d.peak_year + off, onset + 1);
    const sched = computeMaterializationSchedule(pk, d.diffusion_curve, years, baseYear, d.start_year);
    years.forEach((yr, i) => { byYear[i] += w * sched[yr]; });
  });
  return byYear;
}

/**
 * The decomposition. Every driver's additive term is exact at the means; the
 * cross-terms of the multiplicative compounding are spread proportionally.
 */
export function computeDriverAttribution(inputs: AttributionInputs): AttributionResult {
  const { drivers, categories, config, cellWeights } = inputs;
  const years = config.path_years.map(Number);
  const baseYear = config.base_year;
  const jitterOn = config.peak_year_jitter;
  const nCat = categories.length, nReg = REGIONS.length, nCell = nCat * nReg, nYear = years.length;
  const n = drivers.length;

  const fw = FORCES.map((f) => config.force_weights[f]);
  const att = FORCES.map((f) => config.per_force_attenuation[f]);
  const fidx = drivers.map((d) => FORCES.indexOf(d.force));

  // Composite cell exposure: (category exposure / 5) x (regional exposure / 5).
  const E: number[][] = drivers.map((d) => {
    const rv = REGIONS.map((r) => d.regional_exposure[r] / 5);
    const row = new Array<number>(nCell).fill(0);
    categories.forEach((cat, c) => {
      const ce = d.category_exposure[cat] / 5;
      for (let r = 0; r < nReg; r++) row[c * nReg + r] = ce * rv[r];
    });
    return row;
  });

  // Within-force dampening per (force, cell), from the magnitude-weighted
  // effective number of drivers (the participation ratio).
  const absEffect = drivers.map((d) => Math.abs(d.expected_effect));
  const damp: number[][] = FORCES.map(() => new Array<number>(nCell).fill(1));
  FORCES.forEach((force, f) => {
    const ov = config.within_force_overlap[force];
    if (ov <= 0) return;
    for (let cell = 0; cell < nCell; cell++) {
      let s1 = 0, s2 = 0;
      drivers.forEach((_, j) => {
        if (fidx[j] !== f) return;
        const m = absEffect[j] * E[j][cell];
        s1 += m; s2 += m * m;
      });
      const nEff = s2 > 0 ? (s1 * s1) / s2 : 0;
      const factor = nEff > 1 ? 1 - ov * (nEff - 1) / Math.max(nEff, 1) : 1;
      damp[f][cell] = Math.min(1, Math.max(0.1, factor));
    }
  });

  // Expected materialisation per driver and year (onset, curve, peak jitter).
  const mats = drivers.map((d) => expectedMaterialization(d, years, baseYear, jitterOn));

  // Additive terms, force sums, compounding and the proportional spread.
  const effect = drivers.map((d) => d.expected_effect);
  const A: number[][][] = drivers.map((_, j) => {
    const f = fidx[j];
    const k = fw[f] * att[f] * effect[j];
    return Array.from({ length: nCell }, (__, cell) =>
      years.map((___, y) => k * damp[f][cell] * E[j][cell] * mats[j][y]));
  });
  const cellShift: number[][] = Array.from({ length: nCell }, () => new Array<number>(nYear).fill(0));
  const spread: number[][] = Array.from({ length: nCell }, () => new Array<number>(nYear).fill(1));
  for (let cell = 0; cell < nCell; cell++) {
    for (let y = 0; y < nYear; y++) {
      const forceSum = new Array<number>(FORCES.length).fill(0);
      for (let j = 0; j < n; j++) forceSum[fidx[j]] += A[j][cell][y];
      let prod = 1, additive = 0;
      forceSum.forEach((s) => { prod *= Math.max(0, 1 + s); additive += s; });
      cellShift[cell][y] = prod - 1;
      spread[cell][y] = Math.abs(additive) > 1e-15 ? cellShift[cell][y] / additive : 1;
    }
  }

  // Roll-up weights: w over all cells (portfolio), wn within each category's
  // row; a category without gross profit in any region averages its cells, as
  // the engine's row_normalized_cell_weights does.
  const W = new Array<number>(nCell).fill(0);
  categories.forEach((cat, c) => REGIONS.forEach((r, ri) => { W[c * nReg + ri] = cellWeights[cat][r]; }));
  const wTotal = W.reduce((a, b) => a + b, 0);
  const w = W.map((v) => v / wTotal);
  const wn = new Array<number>(nCell).fill(0);
  categories.forEach((_, c) => {
    let rowSum = 0;
    for (let r = 0; r < nReg; r++) rowSum += w[c * nReg + r];
    for (let r = 0; r < nReg; r++) wn[c * nReg + r] = rowSum > 0 ? w[c * nReg + r] / rowSum : 1 / nReg;
  });

  const byDriver: Record<string, DriverAttribution> = {};
  drivers.forEach((d, j) => {
    const portfolio: Record<number, number> = {};
    const category: Record<string, Record<number, number>> = {};
    years.forEach((yr, y) => {
      let p = 0;
      for (let cell = 0; cell < nCell; cell++) p += A[j][cell][y] * spread[cell][y] * w[cell];
      portfolio[yr] = p;
    });
    categories.forEach((cat, c) => {
      const row: Record<number, number> = {};
      years.forEach((yr, y) => {
        let v = 0;
        for (let r = 0; r < nReg; r++) {
          const cell = c * nReg + r;
          v += A[j][cell][y] * spread[cell][y] * wn[cell];
        }
        row[yr] = v;
      });
      category[cat] = row;
    });
    byDriver[d.id] = { portfolio, category };
  });

  const categoryShift: Record<string, Record<number, number>> = {};
  const portfolioShift: Record<number, number> = {};
  years.forEach((yr, y) => {
    let p = 0;
    for (let cell = 0; cell < nCell; cell++) p += cellShift[cell][y] * w[cell];
    portfolioShift[yr] = p;
  });
  categories.forEach((cat, c) => {
    const row: Record<number, number> = {};
    years.forEach((yr, y) => {
      let v = 0;
      for (let r = 0; r < nReg; r++) v += cellShift[c * nReg + r][y] * wn[c * nReg + r];
      row[yr] = v;
    });
    categoryShift[cat] = row;
  });

  return { years, byDriver, categoryShift, portfolioShift };
}

/**
 * The attribution of the served run, or the input it could not be computed
 * without. The Shift Analysis computes it once; the drill-down and the impact
 * filter use the result or name what is missing.
 */
export type RunAttribution =
  | { result: AttributionResult; missing: null }
  | { result: null; missing: 'the model configuration' | 'the drivers' };

/** The attribution of a run over these drivers, with its cell weights and
 *  the model configuration; which of the two inputs is missing, if one is. */
export function attributeRun(
  drivers: AttributionDriver[], config: AttributionConfig | null, categories: string[],
  cellWeights: Record<string, Record<string, number>>,
): RunAttribution {
  if (!config) return { result: null, missing: 'the model configuration' };
  if (drivers.length === 0) return { result: null, missing: 'the drivers' };
  return { result: computeDriverAttribution({ drivers, categories, config, cellWeights }), missing: null };
}

/**
 * The factor that takes a category's contributions at the score means to the
 * run's median in the same year: median / net, so the contributions add up to
 * the number the matrix shows. The Monte Carlo median and the net at the
 * means agree closely (on the published base the factor lies within one
 * percent of 1 in every category and year), but where expanding and
 * contracting drivers nearly cancel, or the drivers were edited after the
 * run, they can differ in size or even in sign. Scaling by such a factor would
 * turn every contribution around or inflate it, so a factor that is not
 * positive or lies outside 1/2 to 2 is not applied: the contributions keep
 * their values at the means (factor 1) and add up to the net at the means
 * instead of the median.
 */
export function reconciliationFactor(net: number, median: number): number {
  const k = median / net;
  return Number.isFinite(k) && k >= 0.5 && k <= 2 ? k : 1;
}

/**
 * The parts of a category's shift in one year that its expanding and its
 * contracting drivers carry, for the matrix's Expansion and Contraction
 * filters: the sums of the drivers' positive and of their negative
 * contributions at the score means, both multiplied by the category's
 * reconciliationFactor, so they add up to the run's median. The expansion
 * part is never negative and the contraction part never positive.
 */
export function signParts(
  result: AttributionResult, category: string, year: number, median: number,
): { expansion: number; contraction: number } {
  let pos = 0;
  let neg = 0;
  for (const d of Object.values(result.byDriver)) {
    const v = d.category[category][year];
    if (v > 0) pos += v;
    else neg += v;
  }
  const k = reconciliationFactor(pos + neg, median);
  return { expansion: k * pos, contraction: k * neg };
}
