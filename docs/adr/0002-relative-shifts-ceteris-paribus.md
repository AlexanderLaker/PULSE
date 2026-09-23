# 0002. Relative shifts, ceteris paribus, structured judgment

Status: accepted

## Context

PRISM informs category strategy. Absolute euro figures belong to finance's
systems, and a model that moved amounts around would invite being read as a
budget. The drivers describe what happens to today's business if nobody
reacts; management response is exactly what the reader is meant to decide.
There is no history of PRISM outputs to validate the method against.

## Decision

- The engine outputs relative shifts of gross profit only, and no HCB
  financial figure is stored (driver descriptions and sources may quote
  public market figures as evidence). A finance cell-weights file with
  absolute figures is divided by its total before the engine sees it.
- The simulation holds strategy constant: no pricing, innovation or
  competitive response by anyone. Every view that shows totals says so, and a
  negative total reads as exposure if nobody acts.
- PRISM is presented as structured judgment. No text in the product or the
  documentation claims predictive validity.
- The Profit Pool Explorer, a separate beta view of industry pools, is the
  one place that shows euro figures (docs/EXPLORER.md).

## Consequences

Readers apply the shifts to their own figures. All-negative totals are
correct under this design, not a defect. A hindcast would be needed before
the numbers could be called a forecast.
