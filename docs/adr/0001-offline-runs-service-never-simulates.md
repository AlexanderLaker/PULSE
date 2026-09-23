# 0001. Offline production runs, a service that never simulates

Status: accepted

## Context

The engine needs scipy (the Beta and normal distributions of the copula) and a
few minutes of computation for a production run. Vercel's Python functions
have a size limit and a time limit, and a published number must be exactly
reproducible. An engine that quietly fell back to approximations wherever
scipy was missing would give different numbers on different hosts.

## Decision

- The published simulation runs only in `scripts/run_production.py`, on a
  machine with the full Python environment, and stores its result as a run.
  The PRISM Analysis build repeats that recipe as its reference run, to
  check that it reproduces the published run (docs/DRIVER_ANALYSIS.md).
- The API serves stored runs and never simulates. It writes only driver
  edits, expert proposals and Consumer Journey saves (and, on an empty
  database, the schema and the seed drivers). Its runtime installs only
  FastAPI, pydantic and psycopg2 and never imports the engine; a test runs
  the API with numpy and scipy blocked.
- scipy is a hard requirement of the engine: it refuses to import without it,
  and there is no approximate fallback. Every run records the scipy and numpy
  versions it used.

## Consequences

A change to the drivers or the model reaches the dashboard only with the next
production run, and someone has to run it. In exchange every published number
is exact, reproducible from its seed and stored with its provenance, and the
web tier stays small and fast.
