/**
 * What a driver's uncertainty score (0 to 5) does in the engine: the
 * concentration of its Beta prior and the width of its peak-year jitter
 * (prism/config.py UNCERTAINTY_KAPPA and UNCERTAINTY_PEAK_JITTER, indexed by
 * the score; tests/test_uncertainty.py holds these copies to them). An
 * unscored driver takes concentration 6 and the model-wide jitter.
 */

/** Beta-prior concentration (alpha + beta) by score; the mean stays probability / 6. */
export const UNCERTAINTY_KAPPA: readonly number[] = [24, 16, 10, 6, 4, 3];

/** Peak-year jitter width in years by score. */
export const UNCERTAINTY_PEAK_JITTER: readonly number[] = [0, 1, 1, 2, 3, 4];

/** Short names of the six scores, for the pickers and the comparisons. */
export const UNCERTAINTY_LABELS: readonly string[] = [
  'Fixed', 'Tight', 'Evidenced', 'Half–double', 'Near zero–2×', 'Sign open',
];
