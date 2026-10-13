# 0014. One version, golden pins and a new run for every model change

Status: accepted

## Context

A run stored under one model and read under another is misleading, and a
change to the numbers that slips in with a refactor is worse. The package,
the API and the dashboard also need to agree on which model they describe.

## Decision

- One version: `prism.__version__`, the engine's `MODEL_VERSION`,
  `package.json` and its lock agree, and a test checks it.
- A change to any number the model produces is a deliberate model change: a
  new version and, in the same commit, the golden pins regenerated and the
  PRISM Analysis record rebuilt from a production run of the new code
  (docs/DRIVER_ANALYSIS.md). That run is made before the commit and the
  deploy. There are two sets of pins: `tests/test_golden_pipeline.py` on five
  fixture drivers, and the production pin (`tests/golden_production.py`) on
  the 51 drivers of the driver base with the production configuration, seed
  and three chains at 2,000 iterations, which catches a change to how the
  engine draws its numbers that the fixture cannot see. The pins also move
  when the drivers they are computed on change; such a commit says so and
  keeps the version.
- Before a release, the full production run at 3 x 50,000 iterations is
  checked against the reference run of the PRISM Analysis record
  (`PRISM_FULL_RUN=1`, `tests/test_reference_run.py`).
- What the dashboard needs of a run is checked in `prism/api/runs.py`: every
  key it reads, every category, region and year, a gross-profit share for
  every cell and category, the run metadata and a complete driver
  fingerprint. The API refuses to serve a run that lacks any of them, so an
  incompatible run is reported instead of rendered wrongly.

## Consequences

A failing golden pin means the numbers moved; it is never regenerated to make
CI pass. Every run records the model version it was computed with, and the
Shift Analysis says so when that differs from the version the service runs:
between a model change's production run and its deploy, and after a deploy
that no run has followed yet.
