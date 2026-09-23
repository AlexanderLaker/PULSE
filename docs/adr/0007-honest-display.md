# 0007. What the numbers on screen may claim

Status: accepted

## Context

A dashboard can make a structured-judgment model look more precise and more
validated than it is: many decimals, bands averaged into something too narrow,
attributions presented as if simulated, convergence statistics that are
meaningless for independent draws.

## Decision

- Percentages show at most one decimal.
- The portfolio band is the joint percentile of the per-iteration portfolio
  shift, never an average of category bands.
- The force, value-chain and region lenses are labelled attribution: they
  split one simulated median and add up to it.
- Sampling quality is shown as the bootstrap standard error of the
  percentiles and as seed stability (the spread of the chains' medians), both
  framed as Monte Carlo noise only. No convergence statistic that is
  meaningless for independent draws is shown.
- Every run records what it repaired, assumed or clipped, and how the driver
  scores changed since the previous run (input drift). The dashboard lists
  these next to the run.
- Direction never rests on colour alone: a shift carries its sign.

## Consequences

The screen claims no more than the model supports. Changes to this wording
are product decisions, not copy edits.
