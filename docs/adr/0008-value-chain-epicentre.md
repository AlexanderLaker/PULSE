# 0008. The value chain as one epicentre stage

Status: accepted

## Context

Experts place a driver's impact at one stage of the value chain. Spreading it
across stages with a kernel would present an assumption as a measurement, and
the model does not describe how an effect propagates up or down the chain.

## Decision

- Each driver stores one stage, its epicentre (`vc_epicentre`, one of the
  eight stages in `prism/config.py`). Experts propose a stage and an admin
  endorses one; proposals are counted as votes, never averaged.
- The value-chain lens gives each driver's share of a category wholly to its
  epicentre stage. The value chain never changes a shift.

## Consequences

The lens shows where drivers act, not how effects travel. A driver without an
epicentre cannot be simulated: the production run refuses it, as it refuses
any driver with a missing score.
