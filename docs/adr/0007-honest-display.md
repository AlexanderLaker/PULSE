# 0007. What the numbers on screen may claim

Status: accepted

## Context

A dashboard can make a structured-judgment model look more precise and more
validated than it is, or simply misstate it: many decimals, a portfolio band
that is an average of category bands rather than the portfolio's own,
attributions presented as if simulated, convergence statistics that are
meaningless for independent draws.

## Decision

- Shifts and shares show at most one decimal. The exceptions are stated
  where they occur: contributions in points with two decimals in the PRISM
  Analysis, so that close drivers can be told apart; the cell weights with
  two decimals in Settings, because several cells hold less than 0.1 percent;
  and the sampling noise to three decimals of a point (docs/DESIGN.md).
- The portfolio band is the joint percentile of the per-iteration portfolio
  shift, never an average of category bands.
- The force, value-chain and region lenses are labelled attribution: they
  split one simulated median and add up to it.
- Sampling quality is shown as the largest bootstrap standard error of a
  category median and as seed stability (the spread of the chains' portfolio
  medians), both framed as Monte Carlo noise only; every run stores the
  standard errors of each category's median, P10 and P90. No convergence statistic that is
  meaningless for independent draws is shown.
- Every run records what it repaired, assumed or clipped, and how the driver
  scores changed since the previous run (input drift). The dashboard lists
  these next to the run.
- When the drivers changed after the served run, or the run comes from
  another model version than the service's, the Shift Analysis says so above
  the matrix and names the drivers, instead of letting the matrix pass for
  the current state.
- Direction never rests on colour alone: a shift carries its sign.

## Consequences

The screen claims no more than the model supports. Changes to this wording
are product decisions, not copy edits.
