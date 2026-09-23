# 0010. Generated files and their checks

Status: accepted

## Context

Several committed files derive from others: the seed from the driver base,
the overlap correction and the cell-weight estimate from their inputs, the
PRISM Analysis from the attribution record. A number typed by hand into one of
them drifts silently from its source.

## Decision

- Four generators write these files: `generate_seed.py`,
  `compute_overlap_correction.py`, `build_cell_weights.py` and
  `build_driver_analysis.py`. A generated source file says so in its header,
  a generated JSON record in its `generated_by` field (the PRISM Analysis file,
  which holds the hand-written templates next to the rendered texts, in its
  `about` field), and none is edited by hand.
- Each generator has `--check`, which regenerates in memory and fails on any
  difference; CI runs all four.
- What the code needs from a generated record reaches it through a Python
  module the same generator writes (`prism/overlap_correction.py` and
  `prism/cell_weight_estimate.py`, which `prism/config.py` reads, and
  `prism/analysis_texts.py`, which the API serves), never through a copy made
  by hand.

## Consequences

Changing an input means running its generator and committing the result.
A stale file cannot reach `main` unnoticed.
