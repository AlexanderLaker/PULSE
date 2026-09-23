# 0011. The PRISM Analysis: attribution at the score means

Status: accepted

## Context

The Drivers page shows every score, but not what a driver does to the
dashboard's headline. Explaining that needs figures from the model and prose
that interprets them; prose with typed numbers goes stale as soon as a score
or a weight changes.

## Decision

- The figures are an expected-value decomposition of the engine's own
  arithmetic at the score means, driver by driver and cell by cell, scaled by
  one factor to the reference run's median (`prism/attribution.py`, written by
  `scripts/build_driver_analysis.py`).
- Each reading is an authored template whose every model figure is a
  placeholder, rendered from the record. Rules (no restated scores, no
  history, no management response, no hand-typed model figure) are held by
  tests where a machine can check them.
- The record carries the reference run and a digest of its inputs; `--check`
  fails when the inputs change or the reference stops reproducing the recorded
  production run.
- The Shift Analysis uses a TypeScript port of the same decomposition, held
  to the Python one by a parity fixture: the category drill-down ranks its
  drivers with it and the Time Path's impact filter splits the median with
  it.

## Consequences

A re-scored base, a recalibration or new cell weights require regenerating
the readings and reviewing their comparative claims (docs/DRIVER_ANALYSIS.md).
The card is labelled attribution and is read-only.
