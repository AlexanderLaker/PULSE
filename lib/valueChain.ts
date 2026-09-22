/**
 * The value chain: its eight stages and a driver's epicentre.
 *
 * Experts score a driver's value chain as one stage, the epicentre of its
 * impact. The API stores the editor's canonical profile around that stage (5
 * at the epicentre, 3 one stage away, 1 two stages away, 0 elsewhere), and
 * reading a profile back takes its highest-scoring stage: a tie goes to the
 * stage nearest the exposure-weighted centroid, an exact tie in distance to
 * the earlier stage. The engine applies the same rule (prism/config.py
 * vc_epicentre_of); tests/frontend/vcEpicentre.test.ts and
 * tests/test_vc_epicentre.py pin both to one table.
 */

/** The stages in chain order; the keys of a driver's vc_exposure. */
export const VC_STEPS = [
  'Raw Materials', 'Formulation', 'Manufacturing', 'Packaging',
  'Supply Chain', 'Marketing', 'Commercial', 'Consumer',
] as const;

/** Short stage labels for the rail and tight tables, in VC_STEPS order. */
export const VC_SHORT_LABELS = ['Raw', 'Form', 'Mfg', 'Pack', 'Supply', 'Mktg', 'Comm', 'Cons'];

/** The 1-based epicentre stage of a profile, or null when it scores nothing. */
export function epicentreOf(exposures: Record<string, number> | null | undefined): number | null {
  const scores = VC_STEPS.map((step) => Number(exposures?.[step]) || 0);
  const total = scores.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  const max = Math.max(...scores);
  const centroid = scores.reduce((a, v, i) => a + v * (i + 1), 0) / total;
  let best: number | null = null;
  scores.forEach((v, i) => {
    if (v === max && (best == null || Math.abs(i + 1 - centroid) < Math.abs(best - centroid))) best = i + 1;
  });
  return best;
}

/** The canonical profile the editor writes for an epicentre stage (1 to 8). */
export function canonicalVcProfile(stage: number): Record<string, number> {
  const falloff = [5, 3, 1];
  return Object.fromEntries(VC_STEPS.map((step, i) => {
    const distance = Math.abs(i + 1 - stage);
    return [step, distance < falloff.length ? falloff[distance] : 0];
  }));
}
