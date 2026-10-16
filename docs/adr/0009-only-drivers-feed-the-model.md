# 0009. Only the drivers feed the Shift Matrix

Status: accepted

## Context

The dashboard has two views besides the drivers and the Shift Analysis: the
Consumer Journey, an authored map of consumer moments, and the Profit Pool
Explorer, sourced views of industry pools. Feeding either into the simulation
would mix authored narrative or third-party market data into a model built on
scored drivers.

## Decision

- The Shift Matrix is computed from the drivers and the model configuration
  only.
- The Consumer Journey is qualitative: its tiles are authored, carry their
  provenance and an evidence grade, cite drivers by code and say that nothing
  in them is simulated.
- The Profit Pool Explorer has its own graded data (`data/content/profit_pools.json`,
  served by `GET /api/v1/explorer`; the arithmetic is `lib/profitPoolData.ts`)
  and does not read or write the simulation.

## Consequences

The journey and the explorer can be edited without a production run, and a
change to them never moves a published shift.
