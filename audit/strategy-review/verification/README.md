# Verification scripts — PRISM strategy review (June 2026)

Each script is self-contained: `python3 <script> <repo_root>`. Outputs committed as `*_out.txt`.
Requires numpy/scipy/SALib (engine itself needs only numpy; scipy used for parity tests).

| Script | Tests | Headline result |
|---|---|---|
| v0_trend_inventory | Ground truth of the 99-trend seed DB | Probability scale only uses 3–5; median trend touches 12/12 categories; all 12 categories net-negative |
| v0_engine_run | End-to-end default run (seed 42, 10k) | All medians −3.4…−6.2% @2030; `correlation_pd_repair` fires on DEFAULT config; decompositions reconcile exactly |
| v1_psd_and_copula | H10/H6: default copula matrix validity; df sensitivity; prod-vs-local marginals | Default R has λmin=−1.68 → silent repair shrinks all correlations ×0.37; df 3→30 changes band width <2%; no-scipy production marginals distorted but headline delta ≤0.09pp |
| v2_h2_overlap_vs_rho | H2: overlap dampening vs within-force ρ | Overlap moves the MEAN (exactly analytic), ρ moves the SPREAD — different moments, no literal double-count; MC mean ≡ deterministic replica to 4 decimals |
| v3_sobol_defects | H1: endpoint validity | Endpoint objective reads non-existent key → Y≡0 → SALib returns all-NaN indices |
| v3b_sobol_proper | H1: what a fixed weight-mode Sobol would mean | S1 ≈ (att·net signed force sum)², corr 0.92 — ranks one-sidedness of trend sets, not real-world uncertainty; sum S1=1.00 (no interactions) |
| v4_cvar_quality | H10: CVaR estimator | Statistically stable (bootstrap SE ≤0.0006 even at 1k); endpoint's mean-over-years understates ADW tail by 1.4pp (21%); df has no effect on CVaR |
| v5_naive_baseline | H12: MC vs deterministic vs Excel-raw | Spearman 0.993 / 0.979 — identical top/bottom ranks; MC's unique add = pairwise rank-confidence (P(worse) 0.51–1.00), which no screen currently shows |
| v6_manipulation_garbage | H7 + garbage-in + adversarial | Validator-legal params move Hair:Color 2030 from −34% to +24% (sign flip incl.); plausible-looking weights flip rankings; garbage inputs produce equally confident output, no flag; adversarial legal config ×3.3 headline, zero integrity events |
| v7_repro_check | Reproducibility | Same seed → bit-identical; cross-seed median wobble ≈ 1e-4 (strength) |
