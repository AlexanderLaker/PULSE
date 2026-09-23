# 0010. Generated files and their checks

Status: accepted

## Context

Several committed files derive from others: the seed from the driver base,
the overlap correction and the cell-weight estimate from their inputs, the
PRISM Analysis from the attribution record. A number typed by hand into one of
them drifts silently from its source.

## Decision

- Four generators write these files: `generate_seed.py`,
  `compute_attenuation.py`, `build_cell_weights.py` and
  `build_driver_analysis.py`. The generated files say so in their header and
  are never edited by hand.
- Each generator has `--check`, which regenerates in memory and fails on any
  difference; CI runs all four.
- Constants in `prism/config.py` that come from a generator are held to the
  generator's record by tests.

## Consequences

Changing an input means running its generator and committing the result.
A stale file cannot reach `main` unnoticed.
