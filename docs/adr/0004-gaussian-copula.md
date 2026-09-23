# 0004. A Gaussian copula with correlations valid as entered

Status: accepted

## Context

Drivers of the same force, and some force pairs, tend to materialise
together. A dependence structure is needed; it has to be a valid correlation
matrix, or the engine must repair it and silently use correlations different
from the configured ones. A Student-t copula was tried: across degrees of
freedom from 4 to infinity the portfolio band moved by less than 2 percent, so
the extra parameter added complexity without a visible effect.

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
