# 01 — PRISM Strategy Review & Model Validation — Full Report

**Engagement:** consulting-grade strategy review + SR 11-7-spirit model validation · **Mode: FULL (all 8 passes)** · June 2026
**Object:** PRISM v3.3/v3.5-calibration, engine 2.5.0, 99 trends × 12 categories × 2026–2035, as implemented in this repo.
**Assumptions declared:** §0 of the brief was left unfilled → REPO_PATH = this repository; DOCS = in-repo documentation; MODE = FULL. The brief's §3 "claimed spec" describes a ~3-versions-old PRISM; this review audits the spec **as documented in CLAUDE.md v3.3 and as coded**, and logs the brief-vs-reality gaps as findings (Fact Sheet §8).
**Companion documents:** `00_EXEC_SUMMARY.md` (verdict in one page) · `02_FINDINGS_REGISTER.md` (F-01…F-25, S-01…S-06) · `03_REMEDIATION_ROADMAP.md` · `04_MODEL_FACT_SHEET.md` (ground truth) · `05_HARDEST_QUESTIONS.md` · `verification/` (10 numeric experiments, all reproducible).

---

## The answer first

**PRISM is a serious, unusually well-engineered structured-judgment engine whose core math does what it claims — but it is not yet an instrument whose numbers can carry a leadership decision, because its flagship analytics layer is broken in ways nobody has noticed, its absolute scale is a free-parameter artifact, and it has never been validated against a single realized outcome.** The verified strengths are real and rare for an internal tool: bit-identical reproducibility, exact internal reconciliation, disciplined sourcing with hard credibility gates, honest uncertainty machinery. The defects are equally real: the default dependence structure is mathematically invalid and silently rescaled (F-01), Sobol/CVaR/tipping endpoints produce NaN, mis-aggregated, or crashing results (F-02/04/05), validator-legal parameters can flip a category's sign (F-07), and the € bridge multiplies the wrong margin stack by an unanchored index (F-06). **Verdict: Internal decision-support only — use it to structure and stress leadership discussion (its category *ranking* is robust, Spearman 0.98+ against any reasonable simplification), do not put its absolute numbers in front of the board until the Now/Next roadmap items close.**

---

## Pass 1 — Strategic methodology: the trajectory-first ambition is right; the Bain-standard plumbing underneath it is missing

### 1.1 The pool boundary is implicit, and it shifts between layers
A profit-pool number is meaningless without an explicit boundary (category scope × geography × value-chain position). PRISM never states one; worse, different layers assume different ones. The engine's atom (`gp1_pct_affected`) is defined against **category GP1/CM1** (`seed_trends.py:80-100`); the Profit-Pool Explorer sizes pools as **global end-consumer revenue × industry EBIT margin** (`lib/profitPoolData.ts:14-23`); the VC dataset uses **GP1 margins by value-chain tier across the whole industry chain** (`profitPoolData.ts:394-455`). Manufacturer-GP1, industry-EBIT and through-chain-GP1 are three different pools. Each is individually defensible; undeclared mixing is not (F-06). *So-what: the first question a Bain reviewer asks — "which pool, whose pool, measured where?" — currently has three inconsistent answers.*

### 1.2 € denomination exists only in a disclaimed Beta mock-up — the live product outputs index points
The live Shift Matrix outputs normalized shifts (−6%…−3% medians). € pools per cell exist (`PROFIT_POOL_DATA`, 12 categories, tier-graded sources A–D — genuinely good triangulation discipline) but only inside the Beta "Profit Pool Explorer" that fires a "mock-up on unvalidated data" disclaimer on every visit (UX review §1). The official €-lens doctrine ("Power BI applies shifts to €M financials; PRISM never sees absolute figures", CLAUDE.md §Design-Philosophy-7) is already contradicted by the repo (D12). **A large shift on a small pool can outrank a small shift on a huge pool in every live exhibit** — e.g. LHC:ADW (deepest contraction, −6.2% @2030) sits on a dishwashing-adjacent pool a fraction the size of Hair Care's €38bn; nothing on screen says so. H5 **confirmed** for the live product. *So-what: decisions allocate €; PRISM currently ranks percentages.*

### 1.3 Trajectory is genuinely the core output — the one Bain-standard element PRISM gets right by design
Where the classic pool map is a snapshot, PRISM's native object is the 10-year path with percentile bands, velocity computed correctly per-iteration (S-02), per-trend diffusion curves, and a defensible materialization grammar. This is ahead of standard practice (S-06) and should be defended as such. The caveat: the *level* of every path is bear-tilted (all 12 categories contract in all years — F-21), so the credible claim today is "relative headwind intensity and timing", not "the pool will shrink x%".

### 1.4 Share overlay and endogeneity: both absent — the model is an exogenous-weather report
`henkelShare` data exists per category but no live view computes pool × share × growth (the strategic-priority overlay; F-20). HCB's own moves and competitor reactions are exogenous by construction: the Competitive force contains 14 *descriptive* competitor trends, all one-signed, no reaction function, no game layer (the v2-era Game Theory sketches were purged in v3.2 — rightly, they never shipped). H6 **confirmed**. A price war, a Persil premium push, a divestiture — none can feed back into the pool. *So-what: PRISM can say "where the weather is worsening"; it cannot say "what happens if we act" — and must stop implying otherwise (the allocation optimizer does imply it, F-17).*

### 1.5 Decision linkage: three real decisions it could inform this year — each currently requiring off-tool work
The brief demands naming them; here they are, with the gap in parentheses:
1. **LHC portfolio triage (Germany-weighted):** ADW/FCN/LAD carry the deepest, most-confident headwinds (pairwise P(worse) up to 1.00, `v5_naive_baseline_out.txt`) — informs defend-vs-harvest stance and PL-defense investment (gap: needs € pools + Henkel share overlay to size the stake).
2. **Hair premiumization timing:** Hair:Care is the least-bad category and the premium trend (consumer_r03, +0.167 the largest single expansion signal) peaks 2030 with s-curve build — informs Schwarzkopf professional-to-consumer crossover sequencing (gap: shift is category-level; premium-tier sub-pool not carved out, §2.3).
3. **Regulatory-cliff readiness:** Government force carries the largest one-sided net signal (net −5.2, `v3b` addendum) concentrated 2027–2029 via the EU Green-Deal cluster — informs reformulation/compliance capex phasing (gap: tipping/early-warning layer is the broken one, F-05).
H-level: the *rankings* feeding these are robust; the *sizing* is not. Pass 1 score input: decision linkage exists but every path to action exits the tool.

### 1.6 Sharp-check: no loyalty-first smuggling — but premiumization deserves an Ehrenberg-Bass caveat
The trend texts reason in penetration, channel power, and category-entry-point terms more than loyalty myths (e.g. consumer_r01 explicitly prices PL as price-gap erosion, not "loyalty defense"; consumer_r02 frames GLP-1 via CEP ownership — `seed_trends.py`). Two soft spots: consumer_r03 leans on "premium ceiling not reached" (L'Oréal +15%) without the double-jeopardy reminder that premium niches buy *reach* dearly — fine as a pool statement, risky as a brand-growth implication; and hair "brand loyalty" is cited as a PL barrier (~30% penetration) where Sharp would say weak physical-availability economics of PL in color do the work. Neither distorts scores materially. **H-sharp: pass with notes.**

---

## Pass 2 — Framework architecture: a pragmatic, documented taxonomy whose scoring grammar quietly caps what the model can ever say

### 2.1 The 6 forces are MECE-by-bookkeeping, not by mechanism — and the model knows it
Forces are Consumer/Customer/Technology/Government/Environmental/Competitive (`config.py:8`) — the brief's "Input Cost & Supply Chain" and "Macro & Geopolitical" forces don't exist; their content is filed inside other forces (palm oil → Environmental; tariffs → Government; cost-of-living → Consumer). Overlaps are real (PFAS is Government *and* Environmental; PL growth is Customer *and* Competitive *and* Consumer) and the architecture's answer is not re-drawing boundaries but **two overlap-correction layers** (cross-force attenuation, within-force dampening) plus a correlation matrix. That is a defensible engineering answer with three costs: the corrections are judgment-calibrated on a proxy (F-19), force *assignment* now moves results (a PFAS trend filed under Environmental vs Government changes its dampening by the att_f/wfo_f spread — ⚡est ±10-15% of that trend's contribution, from the 0.401–0.495 att and 0.10–0.426 wfo ranges), and the whole correction stack is invisible on screen. **H-MECE: overlaps managed, not eliminated; assignment-sensitivity undisclosed.**

### 2.2 The 99 trends: disciplined, sourced, current — with granularity mixing and a saturated exposure grid
Sampled 18 trends across all six forces (`v0_trend_inventory_out.txt` sample + direct reads). Quality is high: named sources with tiers (hard gate ≥B−), April-2026 data points (Circana EU6 42% PL share; JP Morgan $116bn GLP-1 by 2030), explicit gp1 rationale, peak-year + curve per trend. Three architectural weaknesses: **(a) granularity mixing** — mega-trends ("Cost-of-Living Squeeze", gp1 0.20) sit beside micro-trends ("Neuro-Scents", "Laundry scent boosters") with the same formal weight grammar; the overlap machinery partially compensates, the optics don't. **(b) Exposure saturation** — the median trend touches **12 of 12 categories** (94% of the 99×12 grid is non-zero): exposure has stopped being a structural discriminator and become a second magnitude dial; it also inflates the Jaccard baseline the attenuation calibration rests on (J₀=0.45, F-19). **(c) Double-listing pressure at the seams** — e.g. retail-media appears as customer_r08 (US networks, gp1 0.20) *and* technology_r06 (RMN as primary channel, gp1 0.14); acknowledged overlaps (technology_r17 vs r19) are "retained as distinct" by reviewer fiat (`seed_trends.py:21-24`). The within-force dampening explicitly exists to absorb this — i.e., **the architecture pays for double-listing with a judgment constant** instead of merging trends.

### 2.3 The 12 categories carve the portfolio at Henkel's joints — but two are too aggregated for the decisions they'll be asked to carry
4 Hair + 8 LHC mirrors HCB's operating structure (D2: the brief's "13" is stale). Decision-relevance check: Hair:Care (€38bn pool) contains mass and premium tiers whose *opposite* dynamics are the actual strategic story (consumer_r03 vs r06 fight inside one cell — the net hides the divergence the model itself scores); LHC:FCN (full-caps laundry) similarly blends premium pods vs price-tier powder where the PL attack concentrates. "Aggregates lie" applies: the two biggest decisions (premiumization, PL defense) happen one level below the model's resolution. *Recommendation carried to roadmap: tier-split Hair:Care and FCN before the next leadership readout.*

### 2.4 The scoring atom is better than the brief feared and weaker than the docs claim
The dreaded `Impact×Probability/25` ordinal multiplication is gone (D3): today's atom is `Beta-mean(probability) × gp1_pct_affected × direction` — economically anchored (gp1 = % of category GP1 exposed, with documented calibration bands), which mostly **answers H3's pseudo-precision charge at the atom level**. What remains confirmed from H3: **(a) direction ±1 is binary** — no asymmetric upside/downside, no direction uncertainty; a "Contraction" trend cannot help you in any of 50,000 draws (`models.py:59`, F-09). **(b) The probability scale is ordinal-consumed-as-ratio** — p∈{1..5} → mean p/6; the inter-step ratios are an artifact of the 6−p prior; and in practice the scale is degenerate (only 3/4/5 used). **(c) The "Bayesian" label oversells**: `probability_posterior = Beta(p, 6−p)` is a fixed reparameterization of the Likert score; no evidence ever updates it (the AI "calibrator" module proposes score changes for human review — that is editorial, not Bayesian updating). **H3: partially confirmed** — atom semantics sound, uncertainty grammar crippled, branding inflated.

### 2.5 Attenuation: a defensible idea on an indefensible base constant
What multiplicative decay represents is now well-documented (cross-force mechanism double-count correction); the *functional form* (linear dampening of force sums, then Π(1+·)) is fine because terms are small (quasi-additive). The problem is the **0.5**: `eff_att = 0.5 × (1 − mean overlap)` inherits the legacy flat attenuation as an uncalibrated multiplier on *everything* — the calibration only modulates ±10% around it (`config.py:27-46`; methodology doc §1 admits v3.0 values were "expert-elicited point estimates"). Since absolute outputs scale ~linearly in att_f (v6), **half of every headline number is one inherited constant**. H-attenuation: form defensible, level arbitrary, disclosure absent (the ±30% flex band exists in the API — ship it on screen, F-19/S-05).

### 2.6 The weight system is not identifiable — and the model's own outputs prove it
35 model-level parameters (Fact Sheet §4) sit between scores and screen. Force weights, attenuation, overlap, ρ, df: no joint identification strategy exists or is possible without outcome data (none exists, F-08). Demonstrated consequence: validator-legal settings move Hair:Color 2030 across a 57-point range *including a sign flip*, and a plausible-looking weight vector reverses category rankings (`v6_manipulation_garbage_out.txt`). H7 **confirmed** — see Pass 6 for the governance answer.

### 2.7 The VC decomposition can claim attribution, not migration
Post-hoc |score|-weighted allocation of the category median across 8 VC steps (`bayesian_mc.py:640-654`): legitimate as "which chain steps do the driving trends touch", illegitimate as "value will migrate from retail to brand owner" (no inter-step flow exists; signs are erased by abs(); weights never enter simulation — F-11, H6 confirmed). The ConsumerJourney2 narrative view built on it is honest *because* it is hand-authored narrative; the matrix-lens labels are the risk.

---

## Pass 3 — Statistical engine: the core is correct and reproducible; the analytics shell around it is broken; the sophistication is largely inert

*(All claims below re-runnable: `verification/*.py`, outputs committed.)*

### 3.1 Input distributions: documented, consistent — and narrower than reality
Deterministic score = MC expectation by construction (verified: MC mean ≡ independent deterministic replica to 4 decimals, `v2`). The Beta marginals are sane for "degree of materialization", but note the semantic slide: probability is *elicited* as event likelihood (1–5) and *consumed* as a continuous severity fraction — every trend partially materializes in every iteration; nothing ever simply fails to happen. Combined with one-signed directions and the degenerate 3–5 scale use, the simulated uncertainty is **magnitude-only jitter around a fixed story** (F-09). Portfolio P5–P95 at 2035: ±0.9pp around −4.5% — ten-year certainty no FMCG strategist would sign.

### 3.2 t-copula: textbook sampler, invalid default matrix, inert tail knob
The sampling procedure is correct (Cholesky → common-χ² scaling → t-CDF → Beta PPF; one χ² per iteration is the proper t-copula construction). Three findings stack on top:
- **F-01 (P0):** the default 99×99 matrix assembled from ρ=0.3 within-force + the 6×6 cross-force block is **not PSD** (λmin = −1.68). The engine repairs it silently: `R += (|λmin|+0.01)I`, renormalized — every correlation shrinks ×0.37 (effective within-ρ 0.11). An integrity event fires, but configured-vs-effective is disclosed nowhere users look. The PUT /config validator never checks the matrix at all (`config_validation.py` — fields absent).
- **Band impact is modest** (valid-matrix rerun widens portfolio band ×1.08, `v1`) — this is an integrity P0, not a magnitude P0.
- **F-10:** df 3→30 moves band width <2% and CVaR by 2e-4. The "crisis correlation / heavy tails" feature — the most-marketed piece of the engine — has no observable output effect. Carry Gaussian-copula simplification as an option once F-01 lands.
- **F-12:** production (Vercel, scipy-free) substitutes approximations for both transforms; marginal distortion is real (Beta(5,1) 1st percentile off by +0.11), headline effect measured ≤0.09pp. Different math per environment, same seed.

### 3.3 H2 adjudicated: overlap dampening and ρ are *not* double-counting — they act on different moments
Controlled 2-trend experiment (`v2`): overlap moves the **mean** exactly as analytic (−0.2667 → −0.2267 at 0.3), ρ moves the **spread** only (σ 0.050→0.064), composition multiplicative, no interaction artifact. **H2 refuted in the strict double-discounting sense; partially confirmed at the meta level:** both knobs answer "my trends are redundant" with two parameters calibrated from one Jaccard analysis plus judgment — the honest fix for content redundancy is merging trends, not damping sums *and* correlating draws (ties to §2.2c).

### 3.4 H1 adjudicated: the Sobol layer is broken in implementation and misconceived in design
- **Implementation (F-02):** endpoint objective reads `shift_matrix[cat][2030][0.5]` — that path does not exist (correct: `["path"][2030]["median"]`) → Y ≡ 0 → SALib returns **all-NaN indices** (reproduced, `v3`). Engine inner runs are unseeded (`state.get("dag")` passed as seed) and trends-mode mutates the live DB (F-22).
- **Design (F-03):** weight-mode Sobol at PRISM's own n=1024 on a corrected objective yields S1 ≈ (att·net-signed-force-sum)², corr 0.92 (`v3b`): it ranks forces by **one-sidedness of their trend sets**, not by uncertainty contribution — Technology (large, offsetting, genuinely uncertain) scores S1=0.001 and would be read as "doesn't matter". Sum S1 = 1.000: the model is additive in weights; the advertised "interaction" story is empty. Trend-mode treats inputs as independent while the engine's own copula correlates them — precisely the case where Sobol' indices lose interpretability and **Shapley effects / Kucherenko indices** are the standard remedy (Iooss & Prieur 2019, arXiv:1707.01334; reliability-oriented extension: Sci. Direct S1364815221001584). **H1 confirmed** (with the sharpening that today's indices aren't even biased — they're NaN).

### 3.5 H10 adjudicated: CVaR is statistically sound and operationally wrong
The estimator converges beautifully on this narrow, bounded distribution — bootstrap SE ≤ 0.0006 even at 1,000 iterations (`v4`): the "tail numbers are noise" worry is **refuted**. What's wrong is everything around it: the endpoint averages each iteration **across all ten years** before taking the tail (understates the ADW 2035 tail by 21%; direction of bias varies by category — F-04); no SE is reported anywhere; "Top 5 categories" is the first five by list order; `raw_samples` don't survive serverless cold starts so the endpoint is usually dead in production (F-18); and the PSD-unvalidated matrix feeds it (F-01). Also: with all-negative one-signed inputs, CVaR ≈ median − 1.3σ — it adds little beyond the band already shown (df-invariance, `v4c`).

### 3.6 Convergence and reproducibility: the strongest and the silliest part, side by side
Bit-identical reruns, 1e-4 cross-seed wobble, seed-wobble API, 3-chain production runs (50k × 3, `run_50k_prod.py:82-93`) — top-decile reproducibility (S-01). And then the UI pins an "R̂ converged" badge on i.i.d. samples — a diagnostic that *cannot fail* here (F-13). Replace theater with the true story: "MC standard error < 0.1pp; results bit-stable across seeds."

### 3.7 H4 adjudicated: the contradiction was real and is already gone
Scenario re-scoring (Base/Up/Down matrices) was removed in v3.2; the placebo scenario selector was removed from the dashboard between Jun-05 and Jun-09 (UX review §3). Today one engine produces one distribution; deterministic frontend lenses are anchored to the MC median by construction (S-02). **H4: refuted as of the current build** — historical risk, correctly engineered away. Residual cousin: the headline band is a weighted average of category bands, not a joint percentile (F-16).

### 3.8 Tipping points: threshold heuristics that currently cannot run
Second-difference vs 0.005 on the median path + sign reversals + an unconditional "max velocity" event per category, fed by an endpoint that passes the wrong data shape (F-05). No noise robustness needed at current MC precision (1e-4), but the unconditional event guarantees 12+ "tipping points" per run — alert inflation that would teach leadership to ignore the one real cliff (the 2027–2029 regulatory cluster, §1.5-3).

---

## Pass 4 — Data, elicitation & calibration: excellent sourcing hygiene feeding an unvalidated machine

### 4.1 Provenance: top-quartile for an internal tool — graded per cluster
[hard] All 99 trends carry named, dated sources; tier gate refuses D/E-only sourcing at seed time (`seed_trends.py:2693-2734`); a 100-page source audit (Mar-2026) triangulates per trend with named Tier-A/B alternatives. Grading the clusters: regulatory trends = **hard data** (EU acts, dates); market-structure trends (PL, discounter, retail media) = **hard data on history, estimate on trajectory**; behavioral/technology trends = **estimate**; longevity/neuro/agentic clusters = **hypothesis with sources**. That mix is normal; what's missing is the grade *on screen* (the data exists in `confidence` + tiers; no live view shows it next to the number).

### 4.2 Elicitation: machinery present, methodology naive (H8 partially confirmed)
The Delphi module is real (sessions, rounds, DB persistence — more than most corporates ever build), but: consensus = weighted **mean** mislabeled median; "Krippendorff's alpha" = 1−CV; anchoring flag fires on *consistency*; calibration = four hindsight questions worth ±10% weight (F-14). Fatigue is unaddressed: a scorer covering the full base faces 99 × (1 prob + 1 gp1 + 24 exposures) ≈ **2,600 judgments**; the degenerate 3–5 probability usage (F-09) is exactly the scale-compression signature you'd predict. No Brier-style resolution of *current* forecasts exists (nothing has resolved yet — see 4.3).

### 4.3 Backtesting: none, ever (H9 confirmed) — and the cheapest credibility upgrade available
The v3.2 cleanup honestly deleted the never-implemented backtesting module; older docs still cite "backtesting accuracy" gains (F-08). Minimal viable hindcast, designed for ≤3 analyst-weeks: (1) freeze a 2015 trend set for Hair:Color, Hair:Care, LHC:FCN from period sources (Euromonitor/Nielsen archives, ~25 trends); (2) score with today's grammar by two independent scorers; (3) run the engine backward over 2015→2025; (4) compare predicted shift *ranking and sign timing* against realized GP1-pool proxies (Henkel segment GP1, Euromonitor category margins); (5) publish the error honestly as the model's first calibration point. Pass/fail bar: rank correlation of realized vs predicted category ordering ≥0.6 earns "directionally validated" language; below that, the tool stays "judgment-structuring".

### 4.4 Freshness: reviewed Mar–Apr 2026 (Bain, Gemini, source audits), scores ≤2 months old, but cadence is heroics, not process
Five review waves in four months, all by the model owner. No scheduled re-score trigger, no staleness display per trend on screen (`last_updated` exists in the schema). One-person bus factor on a 2,600-judgment database is itself a model risk (⚡est: a quarterly 2-hour panel re-scoring the top-20 |score| trends would cover ~70% of output variance — from the score concentration in `v0`).

### 4.5 Top-10 assumption sensitivity (replacing the broken Sobol with verified arithmetic)
Because outputs are quasi-additive (sum S1=1.0, `v3b`), contribution ≈ w·att·|net signal|. The ten assumptions the 2030 conclusions are most sensitive to: (1) per-force attenuation level (×0.40–0.50 on everything — judgment, F-19); (2) force weights = 1/6 (convention, undisclosed); (3) consumer_r01 PL gp1=0.25 (largest single trend; hard-data history, estimated trajectory); (4) Government within-force overlap 0.426 (halves the regulatory cluster; Jaccard+judgment); (5) customer_r01 discounter gp1=0.20; (6) customer_r08 retail-media gp1=0.20 (US-derived, applied globally); (7) direction one-signedness of the 52 contraction trends (grammar, F-09); (8) exposure saturation (94% — second magnitude dial, §2.2b); (9) materialization curves (s-curve defaults; regulatory front-loading hard-data-ish); (10) probability scale use (3–5 only). Items 1/2/7/8/10 are **model grammar**, not market evidence — they should be on one disclosed page wherever results travel.

---

## Pass 5 — Outputs & decision-usefulness: honest-on-demand, deterministic-at-a-glance, and the boardroom path strips the honesty

*(Source: live-screen walk per UX review 2026-06-09 — verified against components where readable — plus export code.)*

- **Main screen (Shift Matrix, 4 lenses):** a senior reader meets 120 signed-% cells, medians only (`showRanges` default false), 1–2 decimal precision, red/green hue encoding. What a board member could misread: *medians as forecasts* (no visible bands), *the weighted "P10–P90" headline as the portfolio's real range* (it's a band-average, F-16), *Region/VC columns as simulations* (they're attributions, F-11), *"R̂ Converged ✓" as model validity* (it's an i.i.d. tautology, F-13). The one-sentence plain-language headline and the glossary are genuinely good.
- **CategoryDetailPanel** is the best leadership artifact in the product (fan chart with bands, force decomposition, ranked trend contributions, auto Strategic Read) — and it's one click deep, undiscoverable (UX S4/QW7).
- **CVaR/Sobol/tipping:** no live UI surface — which currently *protects* leadership from F-02/04/05; the risk is the API/Excel/claims layer ("fully implemented, Production" — CLAUDE.md) reaching a deck unaudited.
- **Exports:** Excel carries full percentile paths (good, `excel_bridge/writer.py:82-119`); the 6-slide PPTX carries exec summary + heatmap + top trends (medians; no bands on the heatmap) — and **no UI button reaches either**; the de-facto export is a screenshot of the most deterministic-looking view (UX S3). *The path to the boardroom systematically deletes the uncertainty the engine computes.*
- **Action test per category:** from a category row to a resource-allocation implication requires: shift → (mentally) × pool size → (mentally) × Henkel position → action. Two of three steps live outside the tool (F-20). For 4 of 12 categories (ADW, FCN, LAD, Care) the Strategic Read text gets a user to an implication in ≤2 steps; for the rest the reads are descriptive. **Benchmark vs the Bain output standard:** pool map ✓ (Beta mock-up only); position overlay ✗; shift-arrow trajectory ✓ (best-in-class); one-line so-whats ✓ (drill-down only); data-grade appendix ✗ (data exists, not surfaced). 

---

## Pass 6 — Red team: what breaks, what survives

*(The ten hardest questions with full answers: `05_HARDEST_QUESTIONS.md`. Summary of the live-fire results:)*

- **Manipulation surface (H7 confirmed):** −33.9%…+23.9% legal range on one category's headline incl. sign flip; ranking reversal with innocuous weights; zero on-screen disclosure of non-default parameters (`v6`). Guardrails needed: locked calibrated defaults + override-with-reason (the `attenuation_source` pattern, half-built), a non-default-parameters chip on every exhibit, and a standing parameter-band exhibit (the attenuation flex band generalized).
- **Garbage-in (confirmed):** shuffled probabilities + 30% direction flips → indistinguishable output confidence, no flag (`v6`). PRISM launders noise. Needed: input-drift telemetry in the integrity drawer.
- **Naive-baseline (H12 substantively confirmed):** full MC vs deterministic replica vs Excel-grade raw scorecard — Spearman 0.993 / 0.979, identical top-3 and bottom-3 (`v5`). The headline *ranking* needs no Monte Carlo. The MC layer's defensible unique value exists but is unexposed: **pairwise rank-confidence** (P(ADW worse than FCN) = 0.99; IC vs FFI = a coin flip) — exactly the calibration leadership needs and no screen shows. Either surface tail/rank-risk insight or accept that the stochastic layer is currently analytical theater on top of a sound scorecard.
- **Adversarial-legal settings (confirmed):** ρ=0.9/df=2/att=1.0 → headline ×3.3, grand total −1.77, **zero integrity events** (`v6`). Degradation is numerically graceful and epistemically silent.
- **What survives:** seeded reproducibility under any tested setting; exact lens reconciliation; the category ranking under every perturbation tried (rank stability is PRISM's one genuinely hostile-review-proof claim); and the honesty infrastructure (integrity events, seed wobble, attenuation band) — unused but real.

---

## Hypothesis adjudication (all 12)

| # | Hypothesis (abridged) | Verdict | Decisive evidence |
|---|---|---|---|
| H1 | Sobol invalid under copula dependence | **Confirmed — and worse: currently NaN** | `v3`, `v3b`; analytics.py:191-239; F-02/03 |
| H2 | Attenuation + ρ double-discount the same co-movement | **Refuted (strict)** — different moments; **partially confirmed (meta)**: one evidence source, two knobs | `v2`; F-19 |
| H3 | Ordinal-as-ratio scoring atom, symmetric ±1 | **Partially confirmed** — atom re-engineered (gp1 anchoring) since the brief; binary direction & degenerate scale use stand | `models.py:58-77`; `v0`; F-09 |
| H4 | Scenarios contradict MC on-screen | **Refuted as of current build** — scenario engine & placebo selector removed | CLAUDE.md v3.2; UX §3 |
| H5 | No € pools per cell; big-shift-on-small-pool wins | **Confirmed for the live product** (€ exists only as disclaimed Beta + broken-semantics bridge) | F-06/F-20; profitPoolData.ts |
| H6 | Implicit boundary; exogenous own-moves; VC post-hoc | **Confirmed** (all three) | §1.1/1.4/2.7 |
| H7 | Parameter space under-identified → tunable conclusions | **Confirmed** — sign-flip within validator-legal space | `v6`; F-07 |
| H8 | Delphi lacks calibration & bias control | **Partially confirmed** — machinery exists, methodology naive (mean-as-median, 1−CV alpha, anti-consistency flag, hindsight calibration) | delphi.py; F-14 |
| H9 | No backtest → no demonstrated predictive validity | **Confirmed** — and docs occasionally imply otherwise | F-08 |
| H10 | CVaR unstable / matrix not PSD-validated | **Split**: CVaR sampling-stable (refuted half) — bootstrap SE ≤6e-4; PSD never validated, default invalid (confirmed half, elevated to F-01) | `v4`, `v1` |
| H11 | Outputs radiate false precision | **Confirmed** — medians-only default, 2-dp tooltips, band-average headline, R̂ theater; mitigations exist behind toggles/clicks | UX review; F-13/16 |
| H12 | MC doesn't change decisions vs deterministic scorecard | **Substantively confirmed** — rankings identical (ρ≥0.98); unique MC value (rank-confidence, tail) real but unexposed | `v5`; F-10 |

## Scorecard

| Dimension | Score | One-line justification |
|---|:-:|---|
| 1. Decision linkage & strategic relevance | **4/10** | Three nameable decisions, robust ranking — but €-sizing, position overlay and action bridge all live outside the tool (F-06/17/20). |
| 2. Methodological soundness (profit-pool standard) | **4/10** | Trajectory-first design is ahead of standard; boundary/€/share/endogeneity all unmet (H5/H6). |
| 3. Framework architecture | **5/10** | Documented, pragmatic taxonomy and a genuinely improved scoring atom; saturated exposures, granularity mixing, judgment-constant load-bearing (F-19/21). |
| 4. Statistical validity & implementation | **4/10** | Core engine verified correct & reproducible (rare); default matrix invalid, flagship analytics broken/NaN, inert complexity, env-dependent math (F-01/02/04/05/10/12). |
| 5. Data, elicitation & calibration | **5/10** | Top-quartile sourcing discipline and review cadence; zero outcome validation, naive Delphi mechanics, degenerate scale use (F-08/09/14). |
| 6. Output, communication & explainability | **5/10** | Honest machinery exists everywhere (bands, glossary, integrity events) but defaults, headline construction and the screenshot path all favor false certainty (F-16, H11). |
| 7. Governance, reproducibility & manipulation resistance | **4/10** | World-class reproducibility (S-01) undermined by sign-flip-grade parameter freedom with no disclosure layer (F-07/15). |

**Weighted read:** a 4–5 profile with verified 8–9 components inside it. The gap between PRISM's engineering floor (high) and its validation ceiling (absent) is the defining feature.

## Verdict

**Internal decision-support only** (per the §8 ladder). Not "Not ready": the core engine is correct, reproducible, and its ranking output is robust — used as a structured-judgment triage of where headwinds concentrate, with parameters at locked defaults and limits stated, it is defensible in front of senior stakeholders *today as analysis, not as a number-producing oracle*. Not "Conditionally board-ready": F-01 (invalid default dependence), F-02/04/05 (broken flagship analytics still claimed as production), F-06/07 (unanchored € scale + sign-flip parameter freedom) and F-08 (zero validation) each independently fail the hostile-question test, and none yet has an owner/fix/date. The roadmap (`03_REMEDIATION_ROADMAP.md`) sequences the shortest credible path: **Now** kills the indefensibles (≈2 engineer-weeks), **Next** buys the right to leadership exposure (hindcast + € semantics + disclosure layer, ≈1 quarter), **Later** earns "model" status (validation regime, asymmetric directions, tier-split categories).

### The mission question, answered in one paragraph
Is PRISM methodologically sound and decision-useful enough to responsibly inform HCB resource-allocation discussions at leadership level? **As a ranking-and-reasoning instrument, yes — with locked defaults, disclosed limits, and a facilitator who knows where the bodies are buried; as a source of absolute numbers (€ deltas, tail metrics, sensitivity charts), no, not yet.** The category triage it produces (ADW/FCN/LAD most exposed; Hair:Care/HSC most resilient; regulatory cluster 2027–2029 as the timing cliff) is robust to every perturbation this audit threw at it and is grounded in a transparently sourced trend base — that is leadership-grade *input*. The absolute magnitudes are functions of an inherited 0.5, equal sixths, and a repaired matrix; the flagship analytics are broken or inert; and nothing has ever been validated against a realized outcome. Fix the Now items, run the hindcast, ship the disclosure layer — then this review's verdict moves one rung, honestly.

---

## Declared 80/20 cuts and residual access limits

Consciously not deepened, with reasons (per the working rules):
- **AI layer** (`pulse/ai/`: scanner, narrator, calibrator, chat) — reviewed for whether it silently changes scores (it does not: AI suggestions are human-gated, `ai_suggested`/`user_override` flags exist); content quality of AI narration not audited. Reason: no autonomous effect on model results; high effort, low decision relevance.
- **Reverse-stress module** — signatures and optimizer pattern reviewed, full numeric verification skipped. Reason: same engine path as verified core; not leadership-facing today.
- **Auth/security/roles, Excel/PPTX rendering fidelity, UI component code style** — out of scope per brief (separate code-audit track), except where results-affecting (none found beyond F-18).
- **Delphi session *content*** — mechanics audited (F-14); no live session data existed to audit. Brier-style evaluation impossible until forecasts resolve (X5).
- **Web verification** — done for the Sobol-under-dependence claim (the one external methodological dispute material to a finding); CVaR estimator practice verified numerically instead (bootstrap, `v4`), copula sampling verified against textbook construction in code review.
- **Residual access limits (F-26):** four files were unreadable due to OneDrive dehydration (`pulse/api/app.py`, `hooks/usePrism.ts`, `components/dashboard/ProfitPoolAnalysis2.tsx`, `api/client.ts`). Mitigations used: same-repo sync-conflict copy of app.py (2,258 lines, June 2026), the extracted-verbatim math module `lib/shiftMatrix.ts`, and the June-09 UX review's file-cited screen walk. Residual risk is limited to recent UI-side drift in those four files; no model-math conclusion depends on them. Graded P2 (register), deviating from the brief's "blockers as P1" because no pass was prevented — calibration over literalism, stated openly.
