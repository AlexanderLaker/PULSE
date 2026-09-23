# 0003. Beta priors from the scores; one uncertainty score per driver

Status: accepted

## Context

Experts score a driver's probability on a 1 to 5 scale. The simulation needs
a distribution for each driver's materialisation, and the width of the result
should reflect how sure the experts are about size and timing, which the
probability score does not say.

## Decision

- Each driver's materialisation probability has a Beta prior with mean
  `probability / 6`: a 5 means five in six, not certainty. The prior is
  structured judgment and is never updated from data.
- One uncertainty score per driver (0 to 5) sets the prior's concentration
  (24, 16, 10, 6, 4, 3) and the width of its peak-year jitter (0, 1, 1, 2, 3,
  4 years). A driver without a score gets concentration 6 and the global
  one-year jitter.
- Confidence (how well the present state is evidenced) is shown on the page
  and does not enter the simulation.
- A driver is scored in one direction. There are no two-sided magnitudes.

## Consequences

The bands reflect the magnitude and timing uncertainty of the listed drivers,
nothing else; the documentation says so wherever bands are explained. The
score-to-prior tables are published on the Drivers page and in docs/MODEL.md.
