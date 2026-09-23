# 0006. The overlap correction

Status: accepted

## Context

Some mechanisms are carried by more than one driver (three retail drivers can
describe one squeeze on the trade margin) or by more than one force (a
packaging levy is both a Government and an Environmental matter). Added up
naively, such a mechanism counts twice.

## Decision

- Per force, the compounded contribution is multiplied by an attenuation
  derived from the cross-force overlap: `0.5 x (1 - mean overlap of the
  force's row)`.
- Within a force, contributions to a cell are dampened by
  `1 - overlap x (n_eff - 1) / n_eff`, where `n_eff` is the magnitude-weighted
  effective number of contributing drivers. Unlike a plain count, it
  guarantees that adding a driver moves the total in the driver's own
  direction.
- The overlaps are structured judgment computed from the drivers' category
  exposure vectors (weighted Jaccard similarity, excess over the random-pair
  baseline, a force-size factor, per-pair mechanism adjustments with written
  reasons, clamps) by `scripts/compute_attenuation.py`, and called an overlap
  correction, never a calibration against outcomes.

## Consequences

The correction depends on the exposure space and is recomputed whenever the
categories or the base's exposures change; its `--check` fails until it is.
Its reasons are written next to the numbers.
