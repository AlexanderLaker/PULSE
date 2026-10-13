# 0004. A Gaussian copula with correlations valid as entered

Status: accepted

## Context

Drivers of the same force, and some force pairs, tend to materialise
together. A dependence structure is needed; it has to be a valid correlation
matrix, or the engine must repair it and silently use correlations different
from the configured ones. A Student-t copula would add a tail parameter. On
the 51-driver base with the production configuration (3 x 20,000 iterations,
seed 42), 4 to 30 degrees of freedom move the 2035 portfolio median by less
than 0.02 points and narrow its P10 to P90 band by less than 3 percent
(`tests/test_reference_run.py` repeats the comparison when the full run is
asked for): complexity without a visible effect.

## Decision

- The draws are correlated through a Gaussian copula: 0.3 within a force and
  a 6 x 6 force-pair matrix across forces, on the latent scale, restricted to
  [0, 1].
- The defaults are positive definite as entered on the current driver base,
  so the engine's repair never runs on them. The production run checks the
  matrix on the loaded drivers before it starts and refuses a matrix that is
  not (`--allow-nonpsd` overrides and the repair is then recorded).

## Consequences

The model has no tail dependence and no negative dependence between drivers;
both are stated limits. A change to the correlations or to the driver mix is
checked before any run uses it.
