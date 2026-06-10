# PRISM Strategy Review & Model Validation — Executive Summary
**Independent audit, June 2026 · Full mode (8 passes) · All claims verified in code or by committed numeric experiment (`verification/`)**

## Core message
**PRISM's core engine is verified correct, reproducible, and built on unusually disciplined data — but the model is not yet fit to put numbers in front of leadership: its default dependence structure is mathematically invalid and silently rescaled, its flagship analytics (Sobol/CVaR/tipping) are broken or mis-aggregated, validator-legal parameter settings can flip a category's sign, the € bridge multiplies the wrong margin stack by an unanchored index, and nothing has ever been validated against a realized outcome. Verdict: Internal decision-support only.** Its one hostile-review-proof output is the category *ranking* (ADW/FCN/LAD most exposed, Hair Care/HSC most resilient, regulatory cliff 2027–2029) — robust to every perturbation tested. A two-week "Now" package kills the indefensibles; a one-quarter "Next" package (hindcast + € semantics + disclosure layer) moves the verdict one rung, honestly. *(≈140 words)*

## Top-3 insights
1. **The sophistication is sound at the core and ornamental at the edges.** The MC mean equals an independent deterministic replica to 4 decimals; rankings match an Excel-grade scorecard at Spearman 0.98+; the t-copula's tail parameter changes outputs by <2%. The stochastic layer's real, unique value — rank-confidence (P(ADW worse than FCN)=0.99; IC vs FFI a coin flip) — is computed but shown nowhere.
2. **Configured ≠ effective, and nobody knew.** The default correlation matrix is non-PSD (λmin=−1.68); a silent repair shrinks every correlation to ~37% of its documented value on every run. Integrity-event plumbing exists and caught it — the disclosure layer to surface it doesn't.
3. **PRISM is currently a weather report without a € denominator or a Henkel overlay.** Pool × share × growth — the Bain-standard decision object — is not computable in any live view, while a legal two-slider move swings one category's 2030 headline from −34% to +24%.

## Verdict & scorecard
**Internal decision-support only** — sound enough to structure leadership thinking at locked defaults with stated limits; not sound enough to carry a board number. (Ladder: Not ready ▸ **Internal decision-support only** ▸ Conditionally board-ready ▸ Board-ready.)

| Dimension | /10 | | Dimension | /10 |
|---|:-:|---|---|:-:|
| Decision linkage | 4 | | Data, elicitation & calibration | 5 |
| Methodological soundness (pool standard) | 4 | | Output & communication | 5 |
| Framework architecture | 5 | | Governance & manipulation resistance | 4 |
| Statistical validity & implementation | 4 | | | |

## Top-5 findings (of 25 + 6 strengths — see `02_FINDINGS_REGISTER.md`)
| ID | Sev | Finding (one line) |
|---|---|---|
| F-01 | P0 | Default copula matrix invalid (λmin −1.68); silent repair rescales all correlations ×0.37 — documented dependence ≠ effective dependence |
| F-02 | P1 | Sobol endpoint returns NaN (dead key → Y≡0) + unseeded inner runs + mutates live DB; claimed "Production" |
| F-06 | P1 | € bridge applies a GP1-anchored, arbitrarily-scaled index 1:1 to EBIT pools — €bn deltas unusable |
| F-07 | P1 | Validator-legal parameters flip signs/rankings (−34%→+24%); no lock, no on-screen disclosure |
| F-08 | P1 | Zero backtests ever run; docs imply otherwise — no demonstrated predictive validity (positioning must say so) |

**Counterweight (strengths are findings too):** bit-identical reproducibility incl. seed-wobble exposure; exact lens reconciliation; tier-gated sourcing on all 99 trends with named reports; honest engineering culture (integrity events, ±30% attenuation band, self-deprecating code comments) — top-decile for an internal tool and the reason the roadmap is short.

## Immediate next step
Execute roadmap **Now-package N1–N5 (≈2 engineer-weeks)**: PSD validation + recalibrated defaults, analytics-endpoint fixes, honest-by-default display, retire/relabel over-claiming exhibits (allocation, €bn, Region/VC labels), non-default-parameter disclosure chip. Then commit a date for the 2015→2025 hindcast (X1) — the single cheapest credibility upgrade available. Until N1–N5 land: PRISM stays out of leadership rooms as a number source; the ranking + trend evidence base may be used today, presented as structured judgment.
