# PRISM Math Review — Independent Re-Verification at HEAD

**Date:** 2026-06-10 · **HEAD:** `dd76e3f` (post `c0a650d` "v3.6 remediation") · **Base:** 99-trend seed population, 10k iterations, seed 42
**Method:** full re-read of engine/API/UI at HEAD + independent numerical reproduction (script: `audit/strategy-review/verification/v8_head_reverify.py`, output: `v8_head_reverify_out.txt`).

Headline: of the 8 review claims, **5 are confirmed and still open, 2 are fixed at HEAD (one by removal), 1 is partially fixed.** The v3.6 commit fixed the PSD defect, the CVaR-POST aggregation, the Sobol objective, and deleted the € bridge — but the product-side wiring of the advanced-risk layer is still broken, and I found one new P1: **the config endpoint itself 500s on every update.**

---

## Claim-by-claim verdicts

### 1. Bands are uncertainty-of-the-mean, not outcome risk — CONFIRMED, OPEN
`bayesian_mc.py:256`: `samples = prob_01 × gp1 × direction` — sampled probability enters as a fractional multiplier; no event draw exists anywhere. Reproduced with a Bernoulli variant through the identical copula: portfolio p10–p90 band **2.48× wider** (per-category 2.13–2.68×), P5 −5.4% vs −6.7%, medians unchanged (−4.58% vs −4.61%) — fractional mode preserves the mean and suppresses outcome variance, exactly as claimed. Meanwhile the UI sells outcomes: `HeadlineKPI.tsx:348` ("percentiles … safe to use for strategic decisions"), `cvar.py:12` ("worst X% of outcomes"). Verdict: relabel now (S), event-mode toggle later (M).

### 2. Configured correlations don't run (non-PSD, ~2.7× shrink) — FIXED at HEAD, with caveats
Reproduced on the pre-v3.6 matrix: min eigenvalue **−1.6835**, repair shrink **2.69×**, within-force 0.30 → **0.111** — claim numbers exact. At HEAD: `DEFAULT_FORCE_CORRELATIONS` rescaled ×0.73 (`config.py:336`), 99-trend matrix min eigenvalue **+0.1428**, repair does not fire (engine integrity_events empty), and a spectral gate exists (`config_validation.py:387` `correlation_lambda_min`, wired at `app.py:1756`).
Caveats: (a) the gate is unreachable because PUT /config is broken end-to-end (see N-1); (b) the fix is a uniform rescale, not factor-model construction — PSD is verified for *this* trend population; a changed force mix can re-break it and the engine then auto-repairs at run time (integrity event, no hard fail); (c) effective dependence changed regime: within-force went 0.111 (effective) → 0.30 (true), cross-force to 0.73× of v3.5 values — **HEAD bands are not comparable to any previously published run.** Re-baseline and note in release docs.

### 3. Prod math ≠ documented math — CONFIRMED, OPEN (audit F-12)
`api/requirements.txt` excludes scipy ("numpy fallbacks used instead"); fallbacks at `_scipy_compat.py:36-59` are normal approximations. Reproduced: Beta(5,1) ppf for q ≥ 0.9 all clip at 0.999 — **12% of prod draws pile at the clip** (scipy: 0.979/0.990/0.998); t-CDF df=8 tail mispriced **4.67× at −3σ, 37× at −4σ**. Same seed, dev vs prod: terminal medians differ up to **1.8% relative**. Nothing records which path ran — `HAS_SCIPY` is referenced nowhere outside the module, no result key, no integrity event. Fix (M): ship scipy via layer or pin the fallback as the only path everywhere + golden-number parity test + record the math path in the result dict.

### 4. Advanced-risk layer non-functional in the product — PARTIALLY FIXED; still non-functional for users
Fixed server-side in v3.6: POST /cvar now terminal-year (`analytics.py:93-99`), Sobol objective reads `path[year]["median"]` + fixed seed + deep-copies the DB (F-02/F-22), tipping-point extraction fixed (F-05).
Still broken — users still get nothing:
- Both frontends **GET the POST-only routes** (`api/client.ts:178-184`, `pulse/dashboard/src/api/client.ts:158-164`) → 405, swallowed by `.catch(() => null)` → panels silently empty.
- Reverse-stress: calls **nonexistent** `find_stress_scenario` (`analytics.py:410`; class has `find_stress_configuration`, `reverse_stress.py:42`); still passes `dag` in the **seed** position (`analytics.py:394,458`); still **mutates the live trend DB** (389-392, 453-456); single-target objective returns a percentile **dict** where a float is expected (401); multi-target reads a key shape that is **always 0** (463).
- GET /cvar/by-category still averages across years (153) **and** indexes the wrong category when filtered (152) — new sub-finding.
- SALib is not in `api/requirements.txt` → prod Sobol returns `"status": "success"` with empty indices.
- `raw_samples` aren't restored from persisted runs (audit F-18) → on serverless, analytics need a fresh /simulate in the same warm instance.
- Attenuation band (`include_attenuation_band`) and seed-wobble (`seeds`) are implemented server-side; **zero UI consumers** send either flag — confirmed.
What users actually get today: p10–p90 + the R̂ badge (always green, see 8). Verdict unchanged: fix the 3-line GET→POST + CVaR persistence for the worthwhile parts; delete or rebuild reverse-stress.

### 5. € layer mixes bases — FIXED BY REMOVAL (v3.6, D5)
`profitPoolData.ts:4-8`: EBIT dataset (`revenueBn × ebitMargin × henkelShare`) and € conversion helpers deleted; Explorer is now a static, source-cited GP1 display with CAGR arrows and **no engine-shift application**; Shift Analysis stays relative-%. No GP1-on-EBIT math remains anywhere (components, lib, excel_bridge, pptx export checked). Residual: the product now quantifies no € impact at all — if € returns, the F-06 semantics (GP1 vs EBIT leverage, baseline growth, Henkel share) must be solved first, not re-imported.

### 6. Headline level is assumption-set — CONFIRMED, OPEN
Force weight 1/6 × mean per-force attenuation 0.4403 = **0.0734** hidden intensity multiplier (claim: ~0.075). The 0.5 anchor is the uncalibrated legacy base: `compute_attenuation_v3_5.py:207` `0.5 * (1 - row_mean)` — v3.5 legitimately differentiates *relative* dampening, the *level* is inherited guess. `pulse/backtesting/` contains only `__pycache__` (module deleted v3.2); no retrodiction exists anywhere. Verdict unchanged: disclose-and-relabel (S), hindcast per audit §4.4 (L).

### 7. Delphi variance discarded — CONFIRMED, OPEN (sharper at HEAD)
`models.py:63`: posterior = `(max(p,1), max(6−p,1))` → **α+β = 6 for every trend**, variance never enters. `score_variance` is stored and surfaced (`database.py:602`, `app.py:865`) but feeds nothing in the engine. At HEAD the entire Delphi elicitation layer was removed (June 2026: `_RETIRED_2026-06/`, `scripts/migrate_drop_delphi.py`) — so "Bayesian" is now a fixed-concentration prior read off a 5-point score with **no update mechanism at all**. Either wire real elicitation variance into per-trend concentration (M) or stop calling the engine Bayesian in docs/UI (S).

### 8. R̂/ESS on iid draws is theater — CONFIRMED, OPEN (audit F-13)
Reproduced: single-chain split-R̂ ∈ [0.9999, 1.0000], multichain(3) ∈ [0.9998, 1.0002], converged=True for all 12 categories, ESS ≈ N — by construction on iid draws; multichain default (A5) doesn't change that. The honest statistic — MC standard error on the terminal median ≈ **0.00008** (vs median −0.037) — is computed nowhere user-visible. Badge consumers confirmed: `ProfitPoolAnalysis2.tsx:1363-65` (R̂<1.05 n/12 chip), `HeadlineKPI.tsx:341-348` (calls percentiles "statistically reliable"); `usePulse.ts:40` even fabricates `converged: true, r_hat: 1.03` in the offline mock. Replace with MCSE ± seed-wobble (S).

---

## New findings from this review

**N-1 (P1) — PUT /api/v1/config 500s on every update.** `app.py:1784` reads `candidate.attenuation`; the field was removed from `ModelConfig` in v3.2 → `AttributeError` (only `ValidationError` is caught). Even if fixed, the validator call omits the required `per_force_attenuation` → guaranteed 400. Net effect: **no admin config change can commit**, the F-01 spectral gate is dead code in practice, and the SettingsModal scalar-attenuation no-op (F-27) is compounded. Fix is small: pass `per_force_attenuation=dict(candidate.per_force_attenuation)` and drop the dead kwarg; add one PUT round-trip test.

**N-2 (P2) — CVaR by-category returns the wrong category.** `analytics.py:152` enumerates the *filtered* list, so `?category=X` always reads index 0's samples ("Hair: Color") regardless of X — on top of the year-averaging.

**N-3 (P3) — Config is not persisted.** `_state["config"] = ModelConfig()` on every cold start (`app.py:324,518`); on serverless any committed config change silently reverts (moot today given N-1, real once N-1 is fixed).

**N-4 (info) — Comparability break.** Engine `MODEL_VERSION 2.7.0` + v3.6 correlation regime means all pre-June-2026 shift matrices/bands are not comparable to HEAD output. One release-note line and a re-baseline run avoid a future "why did the bands move" incident.

## What checked out clean
Aggregation core (exposure × materialization × weight × attenuation, Π(1+x)−1) matches docs; velocity now correctly per-iteration-then-percentile; materialization schedules monotonicity-enforced; missing `gp1_pct_affected` hard-fails instead of silently dropping trends; config object frozen (mutation race gone); v3.6 PSD fix is mathematically real for the shipped 99-trend base.

## Recommended order
1. **N-1** config endpoint (S) — unblocks all admin-side calibration, makes the spectral gate live.
2. **Claim 4 wiring** (S–M): GET→POST in both clients; fix or delete reverse-stress; decide SALib in prod; persist samples or compute analytics at run time.
3. **Claim 1 relabel** (S) + event-mode toggle (M).
4. **Claim 3** scipy parity + record math path (S–M).
5. **Claim 8** swap R̂ chip for MCSE + seed-wobble (S).
6. **Claims 6/7** disclosure relabels now (S); retrodiction and real elicitation as scheduled L-items.
