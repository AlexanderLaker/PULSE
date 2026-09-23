# 0005. Regional cells rolled up with gross-profit shares

Status: accepted

## Context

Many drivers act in some regions and not others, and HCB's business is not
spread evenly: Europe holds about half of the estimated gross profit and is
also the most exposed region. A category number that ignored where the
business is would weight a growth-market driver like a European one. An equal
grid is not neutral either: it asserts a quarter of the pool in every region.

## Decision

- The engine computes 52 composite cells, 13 categories times 4 regions. A
  driver reaches a cell with its category exposure times its regional
  exposure.
- Exposure describes the mechanism only. Whether HCB has business in a cell
  enters through the cell weights: each cell's share of HCB gross profit.
  Categories are the share-weighted mean of their row, the portfolio the
  share-weighted sum.
- Until finance provides the real shares, the default is an estimate built
  from public reporting (`scripts/build_cell_weights.py`), each input graded,
  deliberately not separable into a region vector times a category vector.
  It is labelled as an estimate, not Henkel P&L, on the Shift Analysis, in
  Settings, in the QA workbook and in the basis line of every PRISM Analysis.
  The finance file replaces it at run time and is never committed.

## Consequences

The headline depends on the estimate until the finance shares are loaded, and
every run records the weights it used and their source. Loading the finance
file needs no code change.
