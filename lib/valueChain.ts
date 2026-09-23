/**
 * The value chain: its eight stages in order.
 *
 * A driver names one stage, its epicentre: the stage where its impact centres
 * (the API's vc_epicentre). The value-chain lens assigns the driver's whole
 * contribution to that stage. The names are the model's (prism/config.py
 * VC_STEPS; tests/test_taxonomies.py keeps the two lists equal).
 */

/** The stages in chain order. */
export const VC_STEPS = [
  'Raw Materials', 'Formulation', 'Manufacturing', 'Packaging',
  'Supply Chain', 'Marketing', 'Commercial', 'Consumer',
] as const;

export type VcStep = (typeof VC_STEPS)[number];

/** Short stage labels for the rail and tight tables, in VC_STEPS order. */
export const VC_SHORT_LABELS = ['Raw', 'Form', 'Mfg', 'Pack', 'Supply', 'Mktg', 'Comm', 'Cons'] as const;

/** A stage's place in the chain, 0 to 7; -1 for no stage or a name outside the chain. */
export const stageIndex = (step: string | null | undefined): number => VC_STEPS.indexOf(step as VcStep);

/** A stage's short label, or the name as given when it is not one of the eight. */
export const shortStage = (step: string): string => VC_SHORT_LABELS[stageIndex(step)] ?? step;
