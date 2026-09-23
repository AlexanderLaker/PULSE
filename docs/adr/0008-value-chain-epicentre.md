# 0008. The value chain as one epicentre stage

Status: accepted

## Context

Experts place a driver's impact at one stage of the value chain. Spreading it
across stages with a kernel would present an assumption as a measurement, and
the model does not describe how an effect propagates up or down the chain.

## Decision

- Each driver has one epicentre stage. The stored eight-step profile is the
  editor's 5/3/1 serialisation of that choice; reading it back takes the
  highest stage, ties resolved towards the exposure-weighted centroid.
- The value-chain lens gives each driver's share of a category wholly to its
  epicentre stage. The value chain never changes a shift.
- The rule exists in Python (`prism/config.py`) and TypeScript
  (`lib/valueChain.ts`); both are tested against one fixture table.

## Consequences

The lens shows where drivers act, not how effects travel. A driver without an
epicentre is left out of the lens and reported in the run's integrity events.
