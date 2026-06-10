# 04 — PRISM Model Fact Sheet (Ground Truth, as implemented)

**Audit pass 0 · 2026-06-09 · Source: code + seed data in this repo, not documentation.**
Every formula below was read from the implementation and is cited `file:line`. Where documentation disagrees with code, code wins and the divergence is logged in §8.

---

## 1. Identity

| | |
|---|---|
| Product | PRISM (formerly PULSE) — profit-pool *shift* simulation platform for HCB |
| Engine | `pulse/` Python FastAPI; `BayesianMonteCarloEngine` MODEL_VERSION **2.5.0**, engine `bayesian_copula` (`pulse/simulation/bayesian_mc.py:45-46`) |
| Frontend | Next.js 14 (App Router), Vercel; main leadership view `ProfitPoolAnalysis2` (default tab, `app/dashboard/page.tsx:99,328`) |
| Trend base | **99 active trends** (v3.3 base 95 + 4 Gemini-review additions, `pulse/seed_trends.py:1-28`) |
| Categories | **12** (not 13): 4 Hair + 8 LHC (`pulse/config.py:11-15`) |
| Horizon | base_year **2025**, path 2026–**2035** (10 years) (`pulse/config.py:58-59`) |
| Determinism | seeded `np.random.default_rng(seed=42)` default (`bayesian_mc.py:48-51`); multi-seed "seed-wobble" and 3-chain convergence run via `/api/v1/simulate` (`pulse/api/app*.py:1489-1540`) |

## 2. Pipeline (as implemented)

```
99 Trends (seed_trends.py: probability 1-5, gp1_pct_affected 0-1, direction ±,
           peak_year + diffusion curve, exposures: 12 cat × 8 VC × 4 region, sources+tier gate)
   │  Trend.__post_init__ (ingestion/models.py:58-73):
   │    probability_posterior = Beta(α=p, β=6−p)
   │    normalized_score = (p/6)·gp1·dir       ← deterministic mean
   ▼
t-copula sampler (bayesian_mc.py:179-258)
   │  R: within-force ρ=0.3, cross-force from 6×6 matrix (config.py:327-334)
   │  → PSD repair if needed (silently rescales ρ! see §7)
   │  Z~N(0,R) → T=Z·√(df/χ²df) → U=t_cdf(T) → prob=BetaPPF(U;α,β)
   │  sample score_j = prob_j · gp1_j · dir_j         (one-signed per trend!)
   ▼
Aggregation per category×year (bayesian_mc.py:415-456)
   │  per force f: S_f = Σ_j score_j·(exposure_jc/5)·mat_j(year)
   │               × overlap dampening [1 − wf_f·(n_active−1)/n_active]
   │  shift_cy = Π_f (1 + w_f · att_f · S_f) − 1     (w_f: force weights, att_f: per-force attenuation)
   ▼
Outputs: percentile paths (p10/25/50/75/90), velocity (per-iteration deltas),
   force/VC/region decompositions = static |score|-weighted shares × MC median
   (bayesian_mc.py:603-734), convergence R̂/ESS, CVaR & Sobol & tipping endpoints
   (pulse/api/routes/analytics.py), mean-variance allocation (optimizer/allocation.py)
   ▼
Frontend: Shift-Matrix views (lib/shiftMatrix.ts: category-weighted column averages),
   € Profit-Pool Explorer (lib/profitPoolData.ts: revenueBn × ebitMargin,
   shiftedProfitBn = pool·(1+shift), lines 305-390)
```

## 3. Formulas as implemented

### 3.1 Trend score (the atom)
- Per-trend prior/“posterior”: `Beta(α=max(p,1), β=max(6−p,1))`, p ∈ {1..5} → mean p/6 (`pulse/ingestion/models.py:63`). **No evidence-updating exists anywhere; the “Bayesian posterior” is a reparameterized Likert score.**
- Deterministic score: `normalized_score = (p/6) · gp1_pct_affected · direction_sign` (`models.py:70-73`). Range observed in seed data: −0.208…+0.167.
- MC sample: `score = BetaPPF(U) · gp1 · dir` (`bayesian_mc.py:237-256`). gp1 ∈ (0,1] hard-validated; missing gp1 refuses to run (`bayesian_mc.py:245-252`).
- **Impact (1–5) no longer exists.** The claimed `I×P×D/25` formula is v2-era; replaced by `probability × gp1_pct_affected × direction` (CLAUDE.md “Two-dimensional scoring”, code as above).
- Direction is binary ±1 ⇒ a sampled trend never changes sign across iterations (`models.py:59,76-77`; `bayesian_mc.py:256`).

### 3.2 Dependence structure
- Trend-level correlation matrix R (n=99): within-force `ρ=0.3`; cross-force per 6×6 `DEFAULT_FORCE_CORRELATIONS` (0.05–0.30, “DAG weights × 0.5”, `config.py:324-334`); else residual 0.05 (`bayesian_mc.py:135-161`).
- t-copula: common χ²(df=8) mixing per iteration (`bayesian_mc.py:220-228`), U clipped to [0.001, 0.999].
- **PSD repair**: if min eigenvalue < 0 → `R += (|λmin|+0.01)·I`, renormalized (`bayesian_mc.py:162-177`). With the DEFAULT config this fires on every run (λmin = −1.68 measured, `verification/v0_engine_run_out.txt`) and **rescales every correlation by ≈ 1/(1+1.69) ≈ 0.37** — effective within-force ρ ≈ 0.11, not 0.30.
- Production caveat: on Vercel, scipy is absent → `t_cdf` is a scaled-normal approximation and `beta_ppf` a clipped normal approximation (`pulse/simulation/_scipy_compat.py:28-59`) ⇒ **different marginals (and tails) in production vs. local/tests**.

### 3.3 Aggregation
For category c, year y, iteration i (`bayesian_mc.py:415-456`, scalar reference 260-338):
```
S_f = Σ_{j∈f} score_ij · min(exp_jc,5)/5 · mat_j(y)            (raw force sum)
S_f ← S_f · [1 − wfo_f · (n_active−1)/n_active]                 (within-force overlap dampening, clip ≥0.1)
shift_icy = Π_f (1 + w_f · att_f · S_f) − 1                     (multiplicative compounding)
```
- `mat_j(y)`: per-trend schedule from `peak_year` + diffusion curve (5 MECE shapes, `config.py:99-168`), else force-level/global S-curve fallback (`config.py:62-93`).
- `w_f`: force weights, default 1/6 each (`config.py:171`).
- `att_f`: calibrated per-force attenuation 0.401–0.495 = 0.5 × (1 − mean cross-force Jaccard overlap) (`config.py:27-55`); **the 0.5 base is inherited from the legacy flat attenuation, not calibrated**.
- `wfo_f`: within-force overlap 0.10–0.426 from Jaccard-excess calibration (`config.py:283-322`, `data/attenuation_calibration_v3_5.json`).
- Net effective multiplier on a force sum at defaults: w_f·att_f ≈ 0.067–0.082 ⇒ terms are small ⇒ Π(1+x)−1 ≈ Σx (quasi-additive in practice).

### 3.4 Decomposition lenses (Force / VC / Region)
- Static shares per category: share_dim ∝ Σ_j |normalized_score_j| · (exp_jc/5) · (dim_exposure_j/5) · dim_weight (`bayesian_mc.py:626-671`), then **share × MC-median** per (cat, year) so each lens sums exactly to the median (`bayesian_mc.py:678-690`).
- ⇒ Region and VC weights/exposures **never enter the simulation** — they are post-hoc allocation of an already-computed number. Force attribution likewise static, rescaled to the MC median (`bayesian_mc.py:527-552`).
- Frontend portfolio totals: category-weighted average via `config.category_weights` (`lib/shiftMatrix.ts:46-87`).

### 3.5 Risk / analytics layer
- **CVaR** (`pulse/simulation/cvar.py:25-65`): sort samples; VaR = sorted[int((1−α)n)]; CVaR = mean of tail. No standard error, no convergence diagnostic. API endpoint computes it on **mean-over-years** samples, not terminal year (`pulse/api/routes/analytics.py:96-99`).
- **Sobol** (`pulse/simulation/sobol.py`): SALib Saltelli, assumes independent uniform inputs. Force-mode samples weights in [0.05,0.40] then **normalizes to sum 1** inside the wrapper (sobol.py:87-89) — indices measure entangled relative-weight effects. Endpoint wiring defects: engine constructed as `BayesianMonteCarloEngine(_cfg, state.get("dag"))` → second positional arg is the **seed** (`analytics.py:191-193,229-231`); reads `shift_matrix[cat][2030][0.5]` which does not exist in the v2.5 result shape → returns 0 (`analytics.py:198-202`); trends-mode mutates `db.trends` without restore (`analytics.py:233-239`).
- **Tipping points** (`pulse/simulation/tipping_points.py`): second difference of the median path vs. threshold 0.005; sign reversals; “inflection” = max |velocity| (fires for every category by construction, lines 123-136). Endpoint passes the new `{year: {percentile dict}}` path into a detector expecting `{year: float}` (`analytics.py:298-311`) ⇒ runtime failure path.
- **Reverse stress** (`pulse/simulation/reverse_stress.py`): SLSQP-style search for minimal parameter perturbation to hit a target shift.
- **Allocation** (`pulse/optimizer/allocation.py:34-233`): Markowitz on (median terminal shift, std) with empirical MC covariance; all-same-sign case → relative returns `mu − min(mu)`. Returns weights, frontier, "sharpe_proxy". **No € pool sizes enter.**

### 3.6 Delphi (`pulse/elicitation/delphi.py`)
- Multi-round sessions, DB-persisted; consensus = **calibration-weighted mean** (docstring says median, code is mean, lines 309-371); reliability “Krippendorff’s alpha” is actually 1 − coefficient-of-variation (lines 451-469); anchoring flag = unchanged score between rounds (lines 226-237); calibration = 4 hindsight questions adjusting weight ±10% (lines 139-164, 480-535).

### 3.7 € bridge (frontend only)
- `PROFIT_POOL_DATA`: 12 categories × {revenueBn (RSP basis), ebitMargin (industry), henkelShare, CAGRs, source tiers A–D} (`lib/profitPoolData.ts:85-301`).
- `shiftedProfitBn = revenueBn · ebitMargin · (1 + shift_median)` (`lib/profitPoolData.ts:383-390`) — **the dimensionless MC shift is applied 1:1 as a relative € EBIT-pool change.** Engine-side gp1 semantics are GP1/CM1-based (`seed_trends.py:80-100`); the Explorer pool is EBIT-margin-based — two different margin stacks.

## 4. Parameter inventory (free parameters an admin can set)

| Parameter | Default | Validated range | Enters simulation? |
|---|---|---|---|
| force_weights (6) | 1/6 each | sum≈1, ≥0 (`config_validation.py:189-231`) | **Yes** — multiplies force sums |
| per_force_attenuation (6) | 0.401–0.495 | [0,1] each (`config_validation.py:95-132`) | **Yes** — multiplies force sums |
| within_force_overlap (6) | 0.10–0.426 | **not validated** | **Yes** — dampens force sums |
| within_force_rho | 0.3 | [0,1] | **Yes** (pre-repair) |
| force_correlation_matrix (15 pairs) | 0.05–0.30 | **not validated (no PSD/symmetry check)** | **Yes** (pre-repair) |
| t_copula_df | 8 | >0, ≤100 | **Yes** |
| iterations | 10,000 | 100–1,000,000 | Yes |
| materialization schedule | S-curve table | monotone, [0,1] | Yes (fallback only) |
| category_weights (12) | 1/12 | **not validated** | Frontend aggregation only |
| region_weights (4) | 1/4 | **not validated** | **No** — display decomposition only |
| vc_weights (8) | 1/8 | sum≈1 | **No** — display decomposition only |
| per-trend: probability, gp1, direction, exposures (12+8+4), peak_year, curve | seed values | CRUD-validated | **Yes** (99 × ~27 values) |

Headline count: **6+6+6+1+15+1 = 35 model-level free parameters** plus ~2,700 trend-level scored values.

## 5. Trend database (measured, `verification/v0_trend_inventory_out.txt`)

- 99 trends. Force split: Consumer 32, Tech 18, Gov 14, Competitive 14, Env 11, Customer 10. Direction 52 Contraction / 47 Expansion.
- Probability uses only {3,4,5} (15/50/34) — **lower half of the scale unused**.
- gp1_pct_affected: min 0.04, median 0.08, max 0.25; documented calibration rationale per cluster (`seed_trends.py:80-100`).
- Exposure matrix is dense: median trend touches **12 of 12** categories; 94% of cells non-zero.
- Every trend has sources, tier-gated (≥ B− required, hard fail otherwise, `seed_trends.py:2693-2734`), VC + regional exposures, peak year, diffusion curve, strategic implication text.
- Deterministic net signed score is **negative for all 12 categories** (−0.65…−1.39 raw).

## 6. Reference run (defaults, seed 42, 10k iterations — `verification/v0_engine_run_out.txt`)

- 2030 medians: −3.4% (LHC:HSC) to −6.2% (LHC:ADW); all categories contract.
- 2035 medians: −2.9% to −7.1%; portfolio (equal-wt) 2035: mean −4.5%, p5/p95 = −5.4%/−3.6%.
- Integrity event on every default run: `correlation_pd_repair` (λmin = −1.68).
- r_hat ≈ 1.00, ESS = n (expected — samples are i.i.d.; these are MCMC diagnostics applied to plain MC).

## 7. Behaviors a reviewer must know (all verified)

1. **The default copula matrix is invalid and silently repaired**: effective correlations ≈ 0.37× the configured values on every default run. Bands are tighter than the documented dependence implies.
2. **Two parallel dampening systems coexist**: deterministic overlap dampening (within-force factor + cross-force attenuation) **and** stochastic correlation (ρ within force, 6×6 cross-force). Overlap shrinks the mean; correlation widens the spread. Conceptually distinct, but both calibrated from the *same* Jaccard-exposure analysis (within) or from sibling judgment matrices (cross), and the correlation half is then mostly destroyed by the PSD repair.
3. **One-signed trends**: direction never flips within the simulation; “uncertainty” is magnitude-only.
4. **Scenario engine does not exist** (removed v3.2). `/api/v1/simulate` accepts no scenario; frontend `ScenarioSelectorPanel.tsx` still lists six scenarios but is **not mounted** in the dashboard (no importer; `app/dashboard/page.tsx`).
5. **Sobol/CVaR/tipping endpoints are degraded**: Sobol objective reads a key that doesn’t exist (→0), seeds the engine with a non-seed, mutates the live trend DB; CVaR uses mean-over-years; tipping passes the wrong shape. Additionally `raw_samples` live only in process memory — on serverless cold start these endpoints have no data.
6. **Production ≠ test environment**: scipy-free approximations on Vercel change marginal distributions (clipped-normal Beta, scaled-normal t-CDF); the pytest suite runs with scipy.
7. **Region/VC lenses are allocation, not simulation** — they cannot change a category’s total, only repaint it.
8. **€ output exists in the frontend** (Profit-Pool Explorer; indicative triangulated data, tiers A–D) and multiplies EBIT pools by GP1-semantics shifts.

## 8. Claimed vs implemented (divergence log)

| # | Claim (engagement brief §3 / older docs) | Implemented reality | Evidence |
|---|---|---|---|
| D1 | 6 forces incl. “Input Cost & Supply Chain”, “Macro & Geopolitical” | Forces are Consumer / Customer / Technology / Government / Environmental / Competitive; input-cost & macro live *inside* Environmental/Customer/Consumer trends | `config.py:8` |
| D2 | ~60 trends × 13 categories | 99 trends × 12 categories | `seed_trends.py:1-5`, `config.py:11` |
| D3 | Scoring = Impact(1–5)×Probability(1–5)×Direction/25 ∈ [−1,1] | probability(1–5)→Beta mean p/6 × gp1_pct_affected(0–1) × dir | `models.py:58-73` |
| D4 | Attenuation = configurable scalar ~0.2–1.0 decay for multi-trend pile-up | Two mechanisms: per-force attenuation (0.40–0.50, calibrated spread on an uncalibrated 0.5 base) + within-force overlap dampening; scalar removed in v3.2 | `config.py:27-55,257-322` |
| D5 | Scenarios = re-scored trend matrices (Base/Up/Down) | Scenario engine removed (v3.2); no scenario parameter in /simulate; UI selector orphaned | CLAUDE.md v3.2 §4, `app*.py:1473+` |
| D6 | Student-t copula with within-force ρ + 6×6 cross-force matrix + df | Implemented as claimed **but** default matrix non-PSD → silent ~0.37× rescale; production t_cdf is a normal approximation | `bayesian_mc.py:162-229`, `_scipy_compat.py:48-59` |
| D7 | Sobol variance decomposition as flagship sensitivity | Module exists; endpoint wiring broken (3 defects) → not currently producing valid indices | `analytics.py:188-239` |
| D8 | CVaR “mean of worst 5%” on shift distribution | Implemented, but endpoint computes it on mean-over-years, reports no SE | `cvar.py:45-65`, `analytics.py:96-99` |
| D9 | Delphi multi-round with debiasing + calibration | Exists incl. DB persistence; consensus is mean (not median), “alpha” is 1−CV, anchoring flag penalizes consistency, calibration = 4 hindsight questions | `delphi.py:139-535` |
| D10 | 1k–100k iterations | Validated 100–1,000,000; default 10,000 | `config_validation.py:292-308` |
| D11 | CLAUDE.md: horizon 2026–2036 (11y) | path_years 2026–2035 (10y) | `config.py:59` |
| D12 | CLAUDE.md: “PRISM outputs relative shifts only … never sees absolute figures” | Frontend now contains € pool data + €-conversion (`profitPoolData.ts`) | `profitPoolData.ts:85-390` |

## 9. Repo map (model-relevant)

| Concern | Location |
|---|---|
| Scoring atom & trend model | `pulse/ingestion/models.py` |
| Engine (copula, aggregation, decomposition, convergence, attenuation band) | `pulse/simulation/bayesian_mc.py` |
| Defaults & taxonomies | `pulse/config.py`; validation `pulse/config_validation.py` |
| Seed trends (99) + source tier gate | `pulse/seed_trends.py` |
| CVaR / Sobol / tipping / reverse stress | `pulse/simulation/{cvar,sobol,tipping_points,reverse_stress}.py`; API `pulse/api/routes/analytics.py` |
| Allocation optimizer | `pulse/optimizer/allocation.py` |
| Delphi | `pulse/elicitation/delphi.py` |
| REST app | `pulse/api/app.py` (only sync-conflict copy readable, see §10) |
| Frontend math | `lib/shiftMatrix.ts`, `lib/calibration.ts` |
| € pools | `lib/profitPoolData.ts` |
| Attenuation calibration data | `data/attenuation_calibration_v3_5.json`, `DOCUMENTATION/Attenuation_Calibration_Methodology.md` |
| Tests | `tests/` (pytest; frontend vitest for shiftMatrix) |

## 10. Access limitations during this audit

OneDrive cloud-dehydration blocked byte access to: `pulse/api/app.py` (audited via its same-repo sync-conflict copy `pulse/api/app-MacBook Air von Alexander.py`, 2,258 lines, June 2026), `hooks/usePrism.ts`, `hooks/usePulse.ts`, `components/dashboard/ProfitPoolAnalysis2.tsx` (audited via its extracted math module `lib/shiftMatrix.ts` + UX review docs), `api/client.ts`, `package.json`. None blocks the model-math conclusions; all four are logged as residual-risk items in the findings register.
