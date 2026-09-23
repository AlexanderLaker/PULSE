# 0013. The model configuration is code

Status: accepted

## Context

The parameters (force weights, the overlap correction, the correlations, the
cell weights) determine every published number. Editing them in the
dashboard would change the served numbers' meaning without a review and
without a new run.

## Decision

- The configuration lives in `prism/config.py` and the generators behind it.
  A change is a reviewed commit followed by a production run.
- The dashboard shows the configuration read-only to every signed-in user,
  together with the cell weights the served run used.
- The one input that arrives at run time is the finance cell-weights file,
  which is confidential and never committed; every run records the weights
  it applied and their source.

## Consequences

Every number on the dashboard traces back to a commit and a run. There is no
parameter state outside the repository and the runs.
