/**
 * Per-driver attribution of the shift: the engine's own arithmetic evaluated
 * at the score means and taken apart driver by driver.
 *
 * This is the TypeScript port of the decomposition in
 * scripts/build_driver_analysis.py (docs/DRIVER_ANALYSIS.md), which the PRISM
 * Analysis readings on the Drivers page are written on. The category
 * drill-down ranks its contributing drivers with it, so a driver's rank there
 * and its reading state the same numbers. The Python script writes a parity
 * fixture (tests/frontend/fixtures/driverAttribution.fixture.json) that
 * tests/frontend/driverAttribution.test.ts replays, so the two cannot drift
 * apart.
 *
 * Per driver j, composite cell (category c, region r) and path year y the
 * additive term of the compounding factor is
 *
 *   a[j,c,r,y] = forceWeight[f] * attenuation[f] * dampening[f,c,r]
 *              * normalizedScore[j] * E[materialisation_j(y)]
 *              * categoryExposure[j,c]/5 * regionalExposure[j,r]/5
 *
 * with normalizedScore = Beta-prior mean (probability/6) x GP1 share x
 * direction (the value the API serves) and the materialisation averaged over
 * the driver's own peak-year jitter grid. The force sums compound
 * multiplicatively per cell; the second-order cross-terms are spread over
 * the drivers of the cell in proportion to their additive terms, so the
 * drivers of a cell add up to the cell shift at the means. The roll-up is the
 * engine's: a category is the share-weighted mean of its row of the run's
 * cell weights, the portfolio the share-weighted sum over all cells.
 *
 * Read the result as attribution, never as a second simulation: the Monte
 * Carlo medians of the persisted run stay the published numbers, and the
 * drill-down scales the drivers of a category to that median.
 */
import { BASE_YEAR, FORCES, REGIONS, YEARS } from '@/lib/format';
import { UNCERTAINTY_PEAK_JITTER } from '@/lib/uncertainty';
import type { ForceName } from '@/types';

/** prism/config.py DEFAULT_PEAK_YEAR_JITTER: the engine-wide width when the configuration names none. */
const DEFAULT_PEAK_YEAR_JITTER = 1;

export interface AttributionDriver {
  id: string;
  force: ForceName;
  /** Beta-prior mean x GP1 share x direction sign (the API's normalized_score). */
  normalized_score: number;
  category_exposure: Record<string, number>;
  regional_exposure?: Record<string, number>;
  uncertainty?: number | null;
  peak_year?: number | null;
  diffusion_curve?: string | null;
  start_year?: number | null;
}

export interface AttributionConfig {
  force_weights: Record<string, number>;
  per_force_attenuation: Record<string, number>;
  within_force_overlap: Record<string, number>;
  base_year?: number;
  path_years?: number[];
  peak_year_jitter?: number;
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
  /** True when the driver has no peak year or curve and full materialisation is assumed. */
  approximate: boolean;
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
 */
export function computeMaterializationSchedule(
  peakYear: number, diffusionCurve: string, years: number[], baseYear: number, startYear?: number | null,
): Record<number, number> {
  const onset = startYear == null ? baseYear : Math.max(baseYear, Math.trunc(startYear));
  const last = years[years.length - 1];
  const py = peakYear && peakYear > onset ? peakYear : (last > onset ? last : onset + 1);
  const schedule: Record<number, number> = {};
  for (const year of years) {
    if (year >= py) { schedule[year] = 1.0; continue; }
    if (year <= onset) { schedule[year] = 0.0; continue; }
    const span = Math.max(py - onset, 1);
    const t = Math.max(0.0, Math.min(1.0, (year - onset) / span));
    let frac: number;
    if (diffusionCurve === 'linear') frac = t;
    else if (diffusionCurve === 'front_loaded') frac = Math.sqrt(t);
    else if (diffusionCurve === 'back_loaded') frac = t * t;
    else if (diffusionCurve === 'step_function') frac = t < 0.8 ? 0.05 : 0.05 + ((t - 0.8) / 0.2) * 0.95;
    else {
      frac = 1.0 / (1.0 + Math.exp(-12 * (t - 0.5)));
      const f0 = 1.0 / (1.0 + Math.exp(-12 * (0 - 0.5)));
      const f1 = 1.0 / (1.0 + Math.exp(-12 * (1 - 0.5)));
      frac = (frac - f0) / (f1 - f0);
    }
    schedule[year] = roundHalfEven4(Math.max(0.0, Math.min(1.0, frac)));
  }
  return schedule;
}

/** The port of prism/config.py peak_jitter_for: the driver's own width, else the global one; 0 switches jitter off. */
export function peakJitterFor(uncertainty: number | null | undefined, globalJitter: number): number {
  const g = Math.trunc(globalJitter || 0);
  if (g <= 0) return 0;
  if (uncertainty == null) return g;
  const u = Math.max(0, Math.min(5, Math.trunc(uncertainty)));
  return UNCERTAINTY_PEAK_JITTER[u];
}

/**
 * The expected materialisation of one driver per path year: its schedule
 * averaged over the symmetric triangular peak-jitter grid, with the jittered
 * peak clamped at onset + 1 exactly as the engine's peak_schedule_table does.
 */
export function expectedMaterialization(
  d: AttributionDriver, years: number[], baseYear: number, globalJitter: number,
): { byYear: number[]; approximate: boolean } {
  const jt = peakJitterFor(d.uncertainty, globalJitter);
  const offsets: number[] = [];
  for (let o = -jt; o <= jt; o++) offsets.push(o);
  const weights = offsets.map((o) => (jt <= 0 ? 1 : Math.max(0, jt + 1 - Math.abs(o))));
  const wsum = weights.reduce((a, b) => a + b, 0);
  const sy = d.start_year == null ? null : Math.trunc(d.start_year);
  const onset = sy == null ? baseYear : Math.max(baseYear, sy);
  const basePk = d.peak_year ?? 0;
  const dc = d.diffusion_curve ?? '';
  const byYear = years.map(() => 0);
  let approximate = false;
  offsets.forEach((off, k) => {
    const w = weights[k] / wsum;
    if (w === 0) return;
    let sched: Record<number, number>;
    if (basePk > 0 && dc) {
      const pk = Math.max(basePk + off, onset + 1);
      sched = computeMaterializationSchedule(pk, dc, years, baseYear, sy);
    } else {
      // The engine gives such a driver its force's default schedule; here it
      // is taken at full materialisation after the onset and flagged.
      approximate = true;
      sched = {};
      years.forEach((yr) => { sched[yr] = yr > onset ? 1.0 : 0.0; });
    }
    years.forEach((yr, i) => { byYear[i] += w * (sched[yr] ?? 1.0); });
  });
  return { byYear, approximate };
}

/** An exposure score as the engine reads it: min(x, 5) / 5, a missing or
 *  non-numeric score as 0 (the engine does not floor a negative score either;
 *  scores are validated to 0..5 before they reach it). */
function clamp5(v: number | undefined): number {
  const x = Number(v ?? 0);
  if (!isFinite(x)) return 0;
  return Math.min(x, 5) / 5;
}

/**
 * The decomposition. Every driver's additive term is exact at the means; the
 * cross-terms of the multiplicative compounding are spread proportionally.
 */
export function computeDriverAttribution(inputs: AttributionInputs): AttributionResult {
  const { drivers, categories, config, cellWeights } = inputs;
  const years = config.path_years?.length ? config.path_years.map(Number) : YEARS;
  const baseYear = config.base_year ?? BASE_YEAR;
  const globalJitter = config.peak_year_jitter ?? DEFAULT_PEAK_YEAR_JITTER;
  const nCat = categories.length, nReg = REGIONS.length, nCell = nCat * nReg, nYear = years.length;
  const n = drivers.length;

  const fw = FORCES.map((f) => config.force_weights?.[f] ?? 1 / FORCES.length);
  const att = FORCES.map((f) => config.per_force_attenuation?.[f] ?? 0);
  const fidx = drivers.map((d) => Math.max(0, FORCES.indexOf(d.force)));

  // Composite cell exposure; a driver without regional scores counts as
  // present in every region, as in the engine.
  const E: number[][] = drivers.map((d) => {
    const reg = d.regional_exposure ?? {};
    let rv = REGIONS.map((r) => clamp5(reg[r]));
    if (rv.reduce((a, b) => a + b, 0) <= 0) rv = REGIONS.map(() => 1);
    const row = new Array<number>(nCell).fill(0);
    categories.forEach((cat, c) => {
      const ce = clamp5(d.category_exposure?.[cat]);
      if (ce <= 0) return;
      for (let r = 0; r < nReg; r++) row[c * nReg + r] = ce * rv[r];
    });
    return row;
  });

  // Within-force dampening per (force, cell), from the magnitude-weighted
  // effective number of drivers (the participation ratio).
  const absScore = drivers.map((d) => Math.abs(Number(d.normalized_score ?? 0)));
  const damp: number[][] = FORCES.map(() => new Array<number>(nCell).fill(1));
  FORCES.forEach((force, f) => {
    const ov = config.within_force_overlap?.[force] ?? 0;
    if (ov <= 0) return;
    for (let cell = 0; cell < nCell; cell++) {
      let s1 = 0, s2 = 0;
      drivers.forEach((_, j) => {
        if (fidx[j] !== f) return;
        const m = absScore[j] * E[j][cell];
        s1 += m; s2 += m * m;
      });
      const nEff = s2 > 0 ? (s1 * s1) / s2 : 0;
      const factor = nEff > 1 ? 1 - ov * (nEff - 1) / Math.max(nEff, 1) : 1;
      damp[f][cell] = Math.min(1, Math.max(0.1, factor));
    }
  });

  // Expected materialisation per driver and year (onset, curve, peak jitter).
  const mats = drivers.map((d) => expectedMaterialization(d, years, baseYear, globalJitter));

  // Additive terms, force sums, compounding and the proportional spread.
  const score = drivers.map((d) => Number(d.normalized_score ?? 0));
  const A: number[][][] = drivers.map((_, j) => {
    const f = fidx[j];
    const k = fw[f] * att[f] * score[j];
    return Array.from({ length: nCell }, (__, cell) =>
      years.map((___, y) => k * damp[f][cell] * E[j][cell] * mats[j].byYear[y]));
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

  // Roll-up weights: w over all cells (portfolio), wn within each category's row.
  const W = new Array<number>(nCell).fill(0);
  categories.forEach((cat, c) => REGIONS.forEach((r, ri) => {
    W[c * nReg + ri] = Math.max(0, Number(cellWeights?.[cat]?.[r] ?? 0));
  }));
  const wTotal = W.reduce((a, b) => a + b, 0);
  const w = wTotal > 0 ? W.map((v) => v / wTotal) : W.map(() => 1 / nCell);
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
    byDriver[d.id] = { portfolio, category, approximate: mats[j].approximate };
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
