/**
 * PRISM — Frontend mirror of the backend's calibrated attenuation system.
 *
 * Single source of truth: pulse/config.py (v3.1, April 2026). Do NOT
 * change any of the constants here without also updating config.py, and
 * vice-versa. The calibration methodology (82-trend empirical analysis,
 * S-curve materialization, per-force effective attenuation) is documented
 * inline in config.py.
 *
 * Why this exists: the deterministic lenses in ProfitPoolAnalysis2
 * (Force / Value Chain / Region decomposition) need to reproduce the
 * backend's per-force attenuation and per-trend materialization without
 * running the full Bayesian Monte Carlo. Before v3.1 we used a flat
 * "pauschal" 0.5 × 0.6 multiplier as a calibration backstop; that is no
 * longer acceptable. Everything here is calibrated — no flat constants.
 */

import type { ForceName, Trend } from '@/types';

// ─── Per-force calibrated attenuation ──────────────────────────
/** v3.2 (April 2026): the legacy scalar BASE_ATTENUATION = 0.5 has
 *  been removed. The frontend now mirrors the backend's
 *  DEFAULT_PER_FORCE_ATTENUATION dict directly — six calibrated
 *  values, one per force. There is no flat 0.5 anywhere.
 *
 *  Source-of-truth: data/Attenuation_Calibration.xlsx
 *  (Cross-Force_Matrix sheet, 95-trend v3.4 recalibration (April 2026)).
 *
 *  These six values must stay in lock-step with
 *  pulse/config.py::DEFAULT_PER_FORCE_ATTENUATION. */
export const DEFAULT_PER_FORCE_ATTENUATION: Record<ForceName, number> = {
  Consumer:      0.495,   // v3.1 was 0.482  (Δ +0.013)
  Customer:      0.402,   // v3.1 was 0.418  (Δ −0.016)
  Technology:    0.432,   // v3.1 was 0.435  (Δ −0.003)
  Government:    0.397,   // v3.1 was 0.403  (Δ −0.006)
  Environmental: 0.416,   // v3.1 was 0.413  (Δ +0.003)
  Competitive:   0.479,   // v3.1 was 0.486  (Δ −0.007)
};

/** Calibration provenance string — matches attenuation_source in
 *  the backend config. */
export const ATTENUATION_SOURCE = 'calibrated_v3.4_april2026';

export const BASE_YEAR = 2025;

/** Full 11-year projection horizon (2026–2036). Matches
 *  DEFAULT_PATH_YEARS in pulse/config.py. */
export const PATH_YEARS: readonly number[] = [
  2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036,
];

// ─── Default materialization schedules ─────────────────────────
/** Default S-curve schedule. Mirror of DEFAULT_MATERIALIZATION. */
export const DEFAULT_MATERIALIZATION: Record<number, number> = {
  2026: 0.08, 2027: 0.18, 2028: 0.32, 2029: 0.48, 2030: 0.62,
  2031: 0.74, 2032: 0.84, 2033: 0.91, 2034: 0.96, 2035: 0.99, 2036: 1.00,
};

/** Regulatory force override — Government trends materialize slower
 *  in early years but catch up fast (back-loaded). */
export const REGULATORY_MATERIALIZATION: Record<number, number> = {
  2026: 0.05, 2027: 0.15, 2028: 0.40, 2029: 0.60, 2030: 0.75,
  2031: 0.85, 2032: 0.92, 2033: 0.97, 2034: 0.99, 2035: 1.00, 2036: 1.00,
};

/** Technology force override — even slower early, steeper finish. */
export const TECHNOLOGY_MATERIALIZATION: Record<number, number> = {
  2026: 0.04, 2027: 0.10, 2028: 0.22, 2029: 0.40, 2030: 0.58,
  2031: 0.72, 2032: 0.83, 2033: 0.91, 2034: 0.96, 2035: 0.99, 2036: 1.00,
};

/** Consumer force override — more front-loaded than the default. */
export const CONSUMER_MATERIALIZATION: Record<number, number> = {
  2026: 0.10, 2027: 0.22, 2028: 0.38, 2029: 0.54, 2030: 0.68,
  2031: 0.79, 2032: 0.87, 2033: 0.93, 2034: 0.97, 2035: 0.99, 2036: 1.00,
};

/** Legacy fallback when a trend has no diffusion_curve. */
export const FORCE_MATERIALIZATION_OVERRIDES: Partial<Record<ForceName, Record<number, number>>> = {
  Government: REGULATORY_MATERIALIZATION,
  Technology: TECHNOLOGY_MATERIALIZATION,
  Consumer: CONSUMER_MATERIALIZATION,
};

// ─── MECE diffusion curves ──────────────────────────────────────
export type DiffusionCurve =
  | 's_curve' | 'linear' | 'front_loaded' | 'back_loaded' | 'step_function';

export const VALID_DIFFUSION_CURVES: readonly DiffusionCurve[] = [
  's_curve', 'linear', 'front_loaded', 'back_loaded', 'step_function',
];

/**
 * Compute the year → materialization fraction schedule for a single trend.
 *
 * Faithful port of pulse/config.py::compute_materialization_schedule.
 * Every supported curve is monotone non-decreasing on [0, 1]; rounding to
 * 4 decimals preserves that. The function throws on a non-monotone
 * schedule — same defensive guarantee as the Python version.
 */
export function computeMaterializationSchedule(
  peakYear: number | undefined | null,
  diffusionCurve: DiffusionCurve | string | undefined | null,
  pathYears: readonly number[] = PATH_YEARS,
  baseYear: number = BASE_YEAR,
): Record<number, number> {
  const py = peakYear && peakYear > baseYear ? peakYear : pathYears[pathYears.length - 1]!;
  const curve = (diffusionCurve ?? 's_curve') as DiffusionCurve;
  const schedule: Record<number, number> = {};

  for (const year of pathYears) {
    if (year >= py) {
      schedule[year] = 1.0;
      continue;
    }
    const span = Math.max(py - baseYear, 1);
    const t = Math.max(0, Math.min(1, (year - baseYear) / span));
    let frac: number;
    switch (curve) {
      case 'linear':
        frac = t; break;
      case 'front_loaded':
        frac = Math.sqrt(t); break;
      case 'back_loaded':
        frac = t * t; break;
      case 'step_function':
        frac = t < 0.8 ? 0.05 : 0.05 + ((t - 0.8) / 0.2) * 0.95;
        break;
      default: {
        // Logistic S-curve, normalized so f(0)≈0 and f(1)≈1.
        const raw = 1 / (1 + Math.exp(-12 * (t - 0.5)));
        const f0  = 1 / (1 + Math.exp(-12 * (0 - 0.5)));
        const f1  = 1 / (1 + Math.exp(-12 * (1 - 0.5)));
        frac = (raw - f0) / (f1 - f0);
      }
    }
    schedule[year] = Math.round(Math.max(0, Math.min(1, frac)) * 10000) / 10000;
  }

  // Defensive monotonicity guarantee (same as Python implementation).
  const sorted = [...pathYears].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    if (schedule[curr]! < schedule[prev]!) {
      throw new Error(
        `computeMaterializationSchedule produced a non-monotonic schedule for ` +
        `diffusion_curve='${curve}', peak_year=${peakYear}: year ${curr} ` +
        `(${schedule[curr]}) < year ${prev} (${schedule[prev]}).`,
      );
    }
  }
  return schedule;
}

/**
 * Materialization fraction for a given trend at a given year.
 *
 * Resolution priority:
 *   1. If the trend carries both peak_year and diffusion_curve, compute
 *      an exact per-trend schedule (same maths as the backend).
 *   2. Else fall back to the force-specific override when one exists
 *      (Government → regulatory, Technology → technology, Consumer →
 *      consumer). This is the legacy path used by trends that have not
 *      yet been enriched with per-trend diffusion metadata.
 *   3. Else the default S-curve.
 */
export function materializationAt(
  trend: Pick<Trend, 'force'> & {
    peak_year?: number | null;
    diffusion_curve?: string | null;
  },
  year: number,
): number {
  if (trend.peak_year && trend.diffusion_curve) {
    const schedule = computeMaterializationSchedule(
      trend.peak_year,
      trend.diffusion_curve,
    );
    return schedule[year] ?? DEFAULT_MATERIALIZATION[year] ?? 1;
  }
  const override = FORCE_MATERIALIZATION_OVERRIDES[trend.force];
  if (override && override[year] != null) return override[year]!;
  return DEFAULT_MATERIALIZATION[year] ?? 1;
}

// ─── Force overlap matrix (cross-force attenuation) ─────────────
/**
 * CALIBRATED cross-force mechanism overlap, v3.1 April 2026.
 *
 * `DEFAULT_FORCE_OVERLAP_MATRIX[i][j]` is the fraction of force i's
 * signal already captured by force j. Asymmetric — see pulse/config.py
 * for the full calibration methodology (excess-overlap-above-baseline
 * + force-size asymmetry + mechanism adjustment).
 *
 * v3.2: this matrix is retained for analytical / reporting purposes
 * (Config sheet "Cross-Force Matrix" section, dependency visualizations).
 * The engine no longer derives effective attenuation from it at runtime —
 * the calibrated per-force values now live in DEFAULT_PER_FORCE_ATTENUATION
 * and are consumed directly.
 */
export const DEFAULT_FORCE_OVERLAP_MATRIX: Record<ForceName, Record<ForceName, number>> = {
  Consumer:      { Consumer: 0.0,   Customer: 0.050, Technology: 0.000, Government: 0.000, Environmental: 0.050, Competitive: 0.080 },
  Customer:      { Consumer: 0.000, Customer: 0.0,   Technology: 0.266, Government: 0.300, Environmental: 0.163, Competitive: 0.090 },
  Technology:    { Consumer: 0.000, Customer: 0.183, Technology: 0.0,   Government: 0.237, Environmental: 0.148, Competitive: 0.080 },
  Government:    { Consumer: 0.000, Customer: 0.200, Technology: 0.367, Government: 0.0,   Environmental: 0.405, Competitive: 0.000 },
  Environmental: { Consumer: 0.050, Customer: 0.118, Technology: 0.266, Government: 0.432, Environmental: 0.0,   Competitive: 0.000 },
  Competitive:   { Consumer: 0.050, Customer: 0.087, Technology: 0.000, Government: 0.000, Environmental: 0.000, Competitive: 0.0   },
};

/**
 * CALIBRATED within-force overlap, v3.1 April 2026.
 *
 * How much do trends WITHIN the same force share mechanism?
 * Used to dampen the raw sum across trends in the same force.
 *
 * Applied as:
 *   dampened_sum = raw_sum × (1 − W[f] × (n_active − 1) / n_active)
 */
export const DEFAULT_WITHIN_FORCE_OVERLAP: Record<ForceName, number> = {
  Consumer:      0.100,
  Customer:      0.157,
  Technology:    0.232,
  Government:    0.426,
  Environmental: 0.269,
  Competitive:   0.100,
};

/**
 * Per-force effective attenuation. v3.2: returns the calibrated value
 * directly from DEFAULT_PER_FORCE_ATTENUATION — no `base × (1 − overlap)`
 * derivation, no scalar fallback.
 *
 * Calibrated values (frozen from 95-trend v3.4 recalibration (April 2026), April 2026):
 *   Consumer      0.495  (v3.1 0.482)
 *   Customer      0.402  (v3.1 0.418)
 *   Technology    0.432  (v3.1 0.435)
 *   Government    0.397  (v3.1 0.403)
 *   Environmental 0.416  (v3.1 0.413)
 *   Competitive   0.479  (v3.1 0.486)
 *
 *  v3.4 recalibration on 95-trend base (+13 trends since v3.1):
 *  J₀ shifted 0.4846 → 0.4592 as structural variety increased.
 *  Trend-weighted mean attenuation: 0.4492 (v3.1 ≈ 0.446).
 *
 * @param force  One of the six force names.
 * @param overrides  Optional per-force overrides (e.g. when the backend
 *   has shipped admin-overridden values via GET /config). When omitted
 *   the calibrated defaults are used.
 */
export function effectiveAttenuation(
  force: ForceName,
  overrides?: Partial<Record<ForceName, number>>,
): number {
  const v = overrides?.[force];
  if (typeof v === 'number') return v;
  return DEFAULT_PER_FORCE_ATTENUATION[force];
}

/**
 * Within-force dampening factor for a group of n_active trends all
 * belonging to the same force. 1.0 when n_active ≤ 1.
 */
export function withinForceDampening(force: ForceName, nActive: number): number {
  if (nActive <= 1) return 1.0;
  const w = DEFAULT_WITHIN_FORCE_OVERLAP[force] ?? 0;
  return 1 - w * ((nActive - 1) / nActive);
}
