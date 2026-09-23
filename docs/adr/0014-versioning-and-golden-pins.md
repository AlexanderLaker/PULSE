# 0014. One version, golden pins and a new run for every model change

Status: accepted

## Context

A run stored under one model and read under another is misleading, and a
change to the numbers that slips in with a refactor is worse. The package,
the API and the dashboard also need to agree on which model they describe.

## Decision

- One version: `prism.__version__`, the engine's `MODEL_VERSION` and
  `package.json` agree, and a test checks it.
- A change to any number the model produces is a deliberate model change: a
  new version, the golden pins of `tests/test_golden_pipeline.py`
  regenerated in the same commit, and a new production run after the deploy.
- A result key the dashboard needs is listed in `prism/api/runs.py`; the API
  refuses to serve a run without it, so an incompatible run is reported
  instead of rendered wrongly.

## Consequences

A failing golden pin means the numbers moved; it is never regenerated just to
make CI pass. Every run records the model version it was computed with.
