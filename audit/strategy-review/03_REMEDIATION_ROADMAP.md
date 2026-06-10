# 03 — Remediation Roadmap

Sequenced by **credibility impact per unit effort**, mapped to register IDs. Sizing: S ≤ 2 days · M ≤ 2 weeks · L = quarter-scale. Owner column left for the model owner to assign — per F-08/Q10, every P1 needs an owner and a date before any leadership-facing use.

## NOW (≤ 2 weeks) — kill the indefensibles
| # | Action | Findings | Size | Credibility payoff |
|---|---|---|---|---|
| N1 | **Validate & fix the dependence layer**: PSD check at config save (reject + suggest nearest-PSD); recalibrate default 6×6 + ρ so the default is valid as-entered; surface configured-vs-effective in the run ribbon | F-01, F-23 | M | Closes the single worst hostile question (Q2) |
| N2 | **Fix the analytics endpoints**: Sobol accessor/seed/DB-copy; CVaR terminal-year + bootstrap SE + real top-5; tipping-point shape + conditional inflection | F-02, F-04, F-05, F-22, F-25 | S–M | "Production analytics suite" claim becomes true-or-silent |
| N3 | **Honest-by-default display**: ranges on by default; one decimal everywhere; replace R̂ chip with MC-SE + seed-stability line; joint portfolio percentile for the headline (raw_samples already persisted per run — else label "indicative band") | F-13, F-16, H11 | S–M | The screen stops over-claiming what the engine under-claims |
| N4 | **Retire/relabel over-claiming exhibits**: allocation optimizer → "shift-resilience ranking"; Region/VC lenses → "attribution"; kill €bn deltas outside Power BI; delete orphaned scenario panel + stale spec text (horizon, I×P/25) | F-17, F-11, F-06, F-24 | S | No exhibit left that dies to one question |
| N5 | **Disclosure chip**: any non-default parameter → visible "modified parameters (n)" badge on screen and in every export | F-07 | S | Converts the manipulation surface into a governed feature |

## NEXT (≤ 1 quarter) — buy the right to leadership exposure
| # | Action | Findings | Size | Payoff |
|---|---|---|---|---|
| X1 | **Minimal viable hindcast** (2015→2025, 3 categories, 2 independent scorers; pass bar: rank-corr ≥ 0.6) — publish the error whatever it is | F-08, F-21, H9 | M–L | The first validated claim; converts "judgment engine" into "calibrated judgment engine" |
| X2 | **€ semantics, decided once**: calibrate the index to "expected % of category GP1 pool", validate on 2–3 hand-built cases, explicit GP1→EBIT leverage factor, then (and only then) re-enable € exhibits incl. pool × share × growth overlay | F-06, F-20, F-17, H5 | M | Outputs become allocable; the Bain-standard overlay finally exists |
| X3 | **Sensitivity, rebuilt**: per-trend-cluster Shapley effects under the copula ("uncertainty drivers") + labeled knob-sensitivity sweeps; ship the attenuation ±30% band and a force-weight band on the main screen | F-03, F-19, F-07 | M | The "what drives this" story becomes defensible |
| X4 | **Rank-confidence view**: pairwise P(worse) matrix / "rank stability" chip per category — the MC layer's actual unique value, surfaced | H12 | S–M | Answers Q1 positively instead of defensively |
| X5 | **Delphi mechanics repair**: median consensus, real dispersion stat, herding (not consistency) detection, Brier ledger for resolving forecasts; staleness display per trend | F-14, F-09 | M | Elicitation claims survive a methodologist |
| X6 | **Input-integrity telemetry**: score-distribution drift, direction-flip alerts, force-balance deltas in the integrity drawer; env-parity golden test (scipy vs prod path) | F-15, F-12 | M | Garbage-in stops being silent |
| X7 | **Export that carries the truth**: 1-page brief (hero number + band + top movers + parameters-modified chip + run stamp) replacing the screenshot path | F-16/UX S3 | M | The version reaching the board is the honest one |

## LATER — earn "model" status
| # | Action | Findings | Size |
|---|---|---|---|
| L1 | Two-sided trend magnitudes (asymmetric up/down gp1) + probability-scale re-anchoring with base rates; revisit one-signedness | F-09, H3 | L |
| L2 | Tier-split Hair:Care and LHC:FCN (premium vs mass cells); regionalized exposures×pools if the region lens is to mean anything | §2.3, F-11 | L |
| L3 | Simplify what the data can't identify: Gaussian copula if df stays inert post-N1; merge double-listed trends instead of damping them; revisit the 0.5 attenuation base against hindcast evidence | F-10, F-19, §2.2c | M–L |
| L4 | Standing validation regime: quarterly top-20 re-score panel, annual hindcast extension, resolved-forecast Brier tracking; second pair of hands (bus-factor) | F-08, §4.4 | L |
| L5 | Endogeneity, honestly scoped: war-gaming module as *separate* what-if layer (the existing wargaming concept), never merged into the exogenous baseline | F-20, H6 | L |

**Sequencing logic:** N1–N5 are ~2 engineer-weeks total and remove every "does not survive today" red-team answer (Q2/Q5/Q6/Q7/Q9). X1+X2 are the two items that move the verdict rung to "conditionally board-ready" — nothing on the Later list does, which is why it's later.
