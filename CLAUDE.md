# PRISM — Profit Pool Risk & Intelligence Simulation Model

## Project Specification & Architecture — v3.12

---

## 1. EXECUTIVE SUMMARY

### What This Is
PRISM is an **AI-augmented profit pool simulation engine** that transforms a static Excel-based strategic force assessment into a living, probabilistic strategic-decision platform. It is deployed as a **Vercel-hosted Next.js 16 web application** backed by a **Python FastAPI service**, with dual-mode persistence (Neon PostgreSQL in production, SQLite locally).

### The Core Innovation
PRISM operates on a **probabilistic profit pool shifting architecture**: directional driver scores, percentage shifts and copula-modeled dependencies produce a **Shift Matrix** — a table of percentage impacts by category × force × time path (**2026–2035**, 10-year horizon). PRISM outputs **relative shifts only**; users apply them to their own financials.

### The Operating Model (F2/F3, June 2026 — read this first)
- **Production simulation runs are CLI-only**: `python3 scripts/run_50k_prod.py` (scipy engine, 50k × 3 chains) computes offline and persists to Neon.
- **The deployed service never simulates.** It is a read-only renderer of the latest persisted run; `POST /api/v1/simulate` refuses (409) on any runtime without scipy. Every data endpoint authenticates (httpOnly viewer cookie or Bearer JWT); `/health` and `/diagnostics` stay anonymous by design.
- **Exact numerics only (D13)**: scipy is a hard engine requirement; the engine module refuses to import without it. There is no approximation fallback anywhere. Every result and persisted run carries `numerics_backend` (exact scipy/numpy versions) for the audit trail.

### Vocabulary: Profit Pool Drivers (owner ruling O15, 2026-09-16, no version bump)

The modelled items are **Profit Pool Drivers**; menus, headers and overviews say **Drivers** (owner wording: "Long word 'Profit Pool Drivers' but in menus, headers, overviews drivers is sufficient"). Everything a person reads says driver: the interface (top nav, entry gate, the Drivers page and its editor, drill-down, Consumer Journey, Config sheet, welcome dialog), the error details, messages, stale reasons and audit texts of the Next admin proxy and the API, the engine's integrity events and the input-drift message, the credibility gate, the QA workbook notes, the production CLI's log lines, and the authored content: 70 places in the Consumer Journey seed (`JOURNEY_CONTENT_VERSION` 2026-09-17, including the content corrections the owner approved that day, where a read put a kept or folded-in item on the watch list, said a live driver left, understated what one covers or credited one where it scores zero: E-02 merged into T-03, C-04 narrowed to clinical-efficacy premiumisation, only T-08's connected-appliance part gone while T-08 still covers replenishment, the cosmetics-only PFAS restriction named as the EU one, G-03 no longer credited on laundry tiles or T-08 on hair tiles) and four driver texts (`data/trend_base_2026-09/core_set_51_v5.json` is v4 plus exactly those edits; the generator reads v5). The database copies of that content are moved by `scripts/apply_driver_vocabulary.py` (archive-first, exact phrases, one locked compare-and-swap transaction; run it right before the production deploy; after the deploy, admins reload open pages and it gets a second `--dry-run`). **Code keeps `trend` on purpose:** the `Trend` types, `Trends2.tsx`, the `trends-2` pane id, `/api/v1/trends`, the `trends*` tables, the contract keys (`trend_count`, `trend_fingerprint`), audit action names and script names, so no contract, schema or number moves. The word also stays where it is ordinary English (a premiumisation trend) or a foresight tier (Megatrend, Macrotrend, Mesotrend, Microtrend). Older uses of "driver" that would now read as the product term were reworded (the copula note's latent Gaussian variables, the probability card, the Explorer's "Rationale" tooltips, one Strategist Read); ordinary business uses such as "growth drivers" stay. Locks: `tests/frontend/driverVocabulary.test.tsx` (static sweep of every interface string, render checks) and `tests/test_driver_vocabulary.py`. In the release notes below and in code-level descriptions, "trend" is the pre-O15 name of the same object. Record: `docs/governance/DECISION_LOG.md` Part K.

### What Changed in v3.12 (vs. v3.11) — Toilet Care Split, 13-Category Taxonomy, Recalibration, Estimated HCB Mix

One release, **two owner rulings of 2026-09-11 — O13 and O14** (full text `docs/governance/DECISION_LOG.md` Parts I and J). MODEL_VERSION bumped to **2.12.0**. **Numbers move for three reasons** — the taxonomy, the recalibration it forces, and the new default cell-weight matrix — each version-stamped and each isolated by its own test; golden pins were regenerated for each, in the same commit as the change that moved them. **O13 does not move the headline:** like for like on the equal grid, the 13-category run on the 51-driver base gives a terminal-year portfolio of **−4.34% [−4.80, −3.80]** against −4.35% [−4.81, −3.80] on the 12-category equal-1/48 basis — the split does not change the answer, it **resolves a blend**. **O14 does move it:** on the estimated HCB gross-profit mix that is now the default, the same base reads **−5.58% [−6.16, −4.89]**, because the estimate puts about half the pool in Europe, the most exposed region, where the equal grid put a quarter. That estimate is built from public reporting, **not Henkel P&L**, and it does not replace the finance figures — those still arrive as a file and still override it (O6, unchanged).

1. **O13 — Toilet Care is its own category.** `"LHC: TOI"` sits between `"LHC: HSC"` and `"LHC: IC"` in `pulse.config.CATEGORIES`, so the taxonomy is **13 categories** and the cell grid is **13 × 4 = 52 composite cells** (the default shares in those cells are O14, item 4). HSC keeps surface, bathroom, kitchen, floor and glass cleaning plus bleach and polishes (Bref surface, Biff, Sidolin, Danklorix); TOI is toilet cleaners, rim blocks and balls, and toilet gels (WC-Frisch, Bref WC Duo-Aktiv, Bref WC Power-Aktiv). Engine and frontend each read one ordered list (`pulse/config.py` `CATEGORIES` ↔ `lib/format.ts` `CATEGORIES`), so the Shift Matrix, the Config sheet's cell grid, the drill-downs and the QA Excel follow the split without per-view changes.
2. **Every driver of the 51-driver base gained a TOI exposure.** The base file is now `data/trend_base_2026-09/core_set_51_v4.json` (v3 plus one column; the generator read v4 until O15 moved it to v5): **37 of the 51 inherit their HSC score unchanged, 14 deviate with a written reason** recorded with the ruling. The exposure grid per driver is therefore **13 categories × 51 drivers = 663 scores** (was 612). `pulse/seed_trends.py` and `data/trendCodeMap.ts` are regenerated from it (`scripts/generate_seed_from_core_set.py --check` in CI); the population, the ids and the 51-live / 65-retired code partition are unchanged.
3. **v3.12 recalibration — forced by the taxonomy, not by a method change.** The overlap correction is a **function of the category exposure space** (weighted Jaccard over the drivers' category exposure vectors), so a taxonomy change changes its input space and leaving v3.11 in place would mislabel the provenance (the F-28 failure mode). `scripts/compute_attenuation_v3_12.py` → `data/attenuation_calibration_v3_12.json`; **method and mechanism adjustments identical to v3.11 — only the input space changed.** Per-force attenuation Consumer 0.487 / Customer 0.417 / Technology 0.412 / Government 0.446 / Environmental 0.378 / Competitive 0.479 (trend-weighted mean 0.4520 → **0.4514**; per-force moves of at most 3 basis points); within-force overlap Consumer 0.100 / Customer 0.221 / Technology 0.384 / Government 0.123 / Environmental 0.401 / Competitive 0.100 (at most 12 basis points); `DEFAULT_ATTENUATION_SOURCE = "calibrated_v3.12_september2026"`. `DEFAULT_FORCE_CORRELATIONS` kept (minimum eigenvalue +0.41 on the 51 mix). Locked by `tests/test_calibration_v3_12.py` (renamed from `test_calibration_v3_11.py`).
4. **O14 — the default cell-weight matrix is an estimate of the HCB mix, no longer the equal 1/52 placeholder.** `pulse.config.DEFAULT_CELL_WEIGHTS` is the estimated 13 × 4 gross-profit mix; the flat grid survives as `EQUAL_CELL_WEIGHTS` / `EQUAL_CELL_WEIGHTS_SOURCE`, so the pre-O14 basis stays selectable and reproducible. **O6 is untouched:** the real finance shares still arrive as a file kept outside git (`run_50k_prod.py --cell-weights FILE`) and that file still overrides everything here — only the fallback changed. The reasoning: a flat grid is not a neutral choice, it asserts a quarter of the pool in each region and thirteen equally large categories, and both are false in the direction that matters, because Europe is at once the largest slice and the most exposed. The estimate is **generated, not hand-typed**: `scripts/build_estimated_cell_weights.py` writes the record `data/cell_weights_estimated_v1.json` and the generated `lib/cellWeightProvenance.ts`, emits the literal for `pulse/config.py`, and `--check` gates both committed outputs in CI. Construction: share = (the category's share of its block × the block's share of HCB) × GP1 margin index × that category's **own** regional mix, normalised to 1 — deliberately **not separable**, so the category numbers move when the mix does. Every input carries a grade — **B** public reporting supports it, **E** defensible but unverified, **G** low-confidence guess. Marginals: categories Colour 17.1, Care 13.0, Styling 7.1, Body 8.0, FCN 24.1, FCA 4.3, FFI 6.7, LAD 2.6, HDW 3.4, ADW 6.5, HSC 4.1, TOI 2.5, IC 0.6 percent; regions Europe 51.4, North America 23.2, Asia 5.6, High Growth 19.8 percent. Visibility is half the ruling: the Config sheet gains a three-state basis badge (estimated mix / equal placeholder / custom), a second reset button and a collapsible block rendering the whole derivation with every grade; the About footer of every run names the basis; the QA workbook's "Cell Weights" sheet carries the same graded derivation; and the `cell_weights_source` stamped on every persisted run opens with "ESTIMATE, not Henkel P&L". **Standing caveat, to be repeated wherever the number is quoted:** this is an estimate from public reporting, not Henkel P&L, and it does not replace the finance figures.
5. **Test locks.** Golden pins in `tests/test_golden_pipeline.py` were regenerated for each of these deliberate model changes, each time in the same commit, with both reasons in the test docstring (the fixture portfolio pin deepens from −0.00433 to −0.00572 under O14, about a third). The **2.10.0 reproduction lock still passes** (3.47e-18): `tests/test_cell_weights.py` now pins an explicit 12-category taxonomy `CATEGORIES_2_10_0` for that test, because the run it reproduces lived in the 12-category world. New `tests/test_trend_persistence.py` (8 tests) locks the F-29 / **O12** `save_trends` upsert — an admin edit of a driver no longer cascades that driver's expert score proposals away. New `tests/test_cell_weights.py::TestEstimatedMixProvenance` (7 tests) ties the constants to the record, the record to the generator and the source string to all three, asserts every input is graded, re-derives the 52 cells from the published inputs and fails if the matrix ever becomes effectively separable; two new tests in `tests/test_ops.py` assert the workbook's graded block appears under the estimate and is absent under any other matrix; the frontend suite covers the basis badge, both resets and the two provenance labels. Suite totals: **pytest 208**, **vitest 84**.

**Contract (2.12.0):** no new result keys — `cell_weights_used` / `category_weights_used` and every category-keyed block carry one row more (13 × 4), and `meta.attenuation_source` reads `calibrated_v3.12_september2026`. One new config-contract key: **`cell_weights_source_equal`** beside `cell_weights_source_default` (O14), so the Config sheet's "reset to equal" labels the flat grid with its own provenance instead of stamping the estimate's onto it; a service that does not serve the key leaves the existing source text alone rather than writing the wrong one.

### What Changed in v3.11 (vs. v3.10) — September 2026 Trend-Base Review, Cell Weights, Uncertainty, Recalibration

Executed against the senior-partner trend-base review of 2/3 September 2026 and the owner rulings **O6–O11** (2026-09-03 / 2026-09-10; full text `docs/governance/DECISION_LOG.md` Part H). MODEL_VERSION bumped to **2.11.0**. **Numbers move for three reasons at once** — the base, the calibration and the weights — each version-stamped and each isolated by its own test; golden pins regenerated in the same commit. **Operator sequence after deploying: `scripts/replace_trend_base.py` (SQLite, then `--postgres`), then `scripts/run_50k_prod.py`.**

1. **O6 — cell-level gross-profit weights.** The roll-up from the 52 composite cells to the category and portfolio numbers uses ONE 13 × 4 matrix of HCB gross-profit **shares** (`config.cell_weights`, sum 1; 13 categories since the 2.12.0 Toilet Care split, O13): category shift = share-weighted mean of the category's row, portfolio = Σ share × cell, region-lens shares from the matrix. `region_weights` / `category_weights` are **derived marginals** (read-only; `PUT /config` rejects them; a legacy vector still builds the separable outer product, which reproduces 2.10.0 to 1e-12 — locked). Default: the **estimated HCB mix** of O14 since 2.12.0 (the equal 1/52 placeholder it replaced is still selectable as `EQUAL_CELL_WEIGHTS`) until the actual P&L shares are loaded via `run_50k_prod.py --cell-weights FILE` (JSON, shares or absolute figures normalised to shares before the engine is built; euro never enters or persists) — **the file still overrides the default; O14 changed the fallback, not O6**. Presence in a region enters through these shares, not through the exposures (**O9**: category and regional exposures are independent, mechanism-only). New contract keys `cell_weights_used`, `category_weights_used`, `cell_weights_source` (the engine applies the shares normalised to their total inside the ±0.01 tolerance and reports the applied shares); Config sheet grid with marginals and reset; About footer, drill-down row shares, Excel "Cell Weights" sheet. A jittered peak that lands at or before the onset now saturates at "peaks the year after onset" (a latent 2.10.0 defect that mapped the earliest draw to the horizon; reachable for more drivers with the O7 widths — the 2.10.0 reproduction lock is unaffected because no fixture trend triggers it).
2. **O7 — one uncertainty score per driver** (`Trend.uncertainty` 0–5, optional; both DB tables, API, proposals aggregate, drift fingerprint key `"u"`, editor + Review & Endorse, AI snapshot). Sets the Beta concentration κ = 24/16/10/6/4/3 (mean p/6 unchanged — the F5 score→prior table stands) and the per-driver peak-year jitter width 0/1/1/2/3/4 years (inverse-CDF draw, bit-identical to the 2.10.0 `rng.choice` stream when unscored). `config.peak_year_jitter = 0` stays the engine-wide off switch. An unscored trend behaves exactly as in 2.10.0.
3. **O10 — the 51-driver base** replaces the 99 trends. `pulse/seed_trends.py` and `data/trendCodeMap.ts` are **generated** by `scripts/generate_seed_from_core_set.py` from `data/trend_base_2026-09/` (`--check` in CI). Kept drivers keep their ids; two force moves get new ids (T-06 → K-13 `customer_r13`, X-06 → C-37 `consumer_r37`); the 65 retired codes carry merged-into / residue pointers or the review's reason, and journey evidence cards resolve through them. No provenance label on the reviewed base (`ai_suggested=False`, `user_override=False`; the chip renders only for AI-suggested or admin-edited trends). `EXPECTED_TREND_COUNT` 51. Replacement is archive-first by the owner (`scripts/replace_trend_base.py`; restores the kept ids' expert proposals across the Postgres cascade, F-29). The first 2.11.0 run reports the mass replacement as a critical input-drift event by design (D19).
4. **O11 — v3.11 recalibration on the 51 drivers** (`scripts/compute_attenuation_v3_11.py` → `data/attenuation_calibration_v3_11.json`; mechanism adjustments re-judged per cell with reasons). Per-force attenuation Consumer 0.487 / Customer 0.418 / Technology 0.415 / Government 0.446 / Environmental 0.379 / Competitive 0.480 (trend-weighted mean 0.4520); within-force overlap Consumer 0.100 / Customer 0.223 / Technology 0.373 / Government 0.126 / Environmental 0.389 / Competitive 0.100; `DEFAULT_ATTENUATION_SOURCE = "calibrated_v3.11_september2026"`. `DEFAULT_FORCE_CORRELATIONS` kept (min eigenvalue +0.41 on the 51 mix). **F-28 corrected:** all three calibration layers now come from one generated record, locked by `tests/test_calibration_v3_11.py` (before 2.11.0 the within-force overlap and the matrix were v3.1 numbers labelled v3.5). **Superseded by the v3.12 recalibration (2.12.0 / O13)** — same method on the 13-category exposure space; the lock moved with it to `tests/test_calibration_v3_12.py`.
5. **O8** Türkiye sits in High Growth (applied in the reviewed exposures).

**Contract additions (2.11.0):** `cell_weights_used`, `category_weights_used`, `cell_weights_source`, `meta.trend_count`, `meta.attenuation_source`; `Trend.uncertainty`. New config: `cell_weights`, `cell_weights_source`; `region_weights` / `category_weights` derived. Schema: `trends.uncertainty`, `trend_score_proposals.uncertainty` (added by `init_db` / the replacement script).

### What Changed in v3.10 (vs. v3.9) — Mathematical Review Remediation, July 2026

Executed against the owner-approved remediation of the 11-finding independent mathematical review (`PRISM_Model_Review_2026-07-11.docx`; decisions 2026-07-13). MODEL_VERSION bumped to **2.10.0**. **Numbers move** — golden pins regenerated in the same commit; **run the 50k CLI after deploying** so the persisted run matches 2.10.0.

1. **F1 — the shift math is now REGIONAL (3D).** The engine solves a category × region × year tensor: each trend's contribution to a `(category, region)` cell is weighted by **both** `category_exposure/5` **and** `regional_exposure/5` (implemented as 48 composite cells = 12 categories × 4 regions at 2.10.0 — 52 = 13 × 4 since the 2.12.0 Toilet Care split, O13 — so the existing force-compounding machinery runs unchanged). Category/portfolio numbers are the **region-GP1-share-weighted roll-up** (`config.region_weights`). A globally-present trend (region exposure full everywhere) reproduces the pre-2.10 category number exactly — **only regional concentration moves the numbers** (regionally-concentrated headwinds/tailwinds are correctly diluted to their regions' slice of the pool). New `regional_shift_matrix` in the result contract; the Region lens is now **shift-based**, not attribution-only, with a category×region drill-down in `CategoryDetailPanel`. `region_weights` are now **load-bearing** and default to the **Henkel Group FY2025 regional sales split** (Europe 0.38 / North America 0.26 / Asia 0.17 / High Growth 0.19) as a documented, admin-editable proxy for the HCB GP1 mix (`DEFAULT_REGION_WEIGHTS` + `DEFAULT_REGION_WEIGHTS_SOURCE`). A region-less trend is treated as globally present with a `regional_exposure_coverage` integrity event. F1(i) documentation: the structural scale chain (force weight 1/6 × attenuation ≈ 7% pass-through) is on the record in the About-footer, the Config sheet, the model card and the QA Excel.
2. **F2 — monotonic within-force dampening.** The count-based overlap dampening (`1 − ov·(n−1)/n`) is replaced by a magnitude-weighted **effective number** `n_eff = (Σm)²/Σm²` (participation ratio) over the deterministic mean contributions per (force, cell). Adding a negligible trend no longer worsens the outlook (the demonstrated dominance violation is fixed).
3. **F4 — peak-year jitter.** Each iteration draws a per-trend peak-year offset (±1yr symmetric triangular, `config.peak_year_jitter`, default 1) so velocity/timing bands carry real "arrives a year earlier/later" content. Reproducible under seed.
4. **F7 — chains pooled + MC standard error.** `run_multichain` now **pools** the 3 chains for the published percentiles (√3 noise cut); the vacuous i.i.d. split-R̂/ESS block is **deleted** and replaced by a per-quantile **`mc_standard_error`** (bootstrap, in pp). Seed stability keeps its per-chain terminal-year portfolio medians.
5. **F9 — `force_attribution.direct_effects` deleted end-to-end** (engine block, persist call, API service/router carry-through, `api/client.ts`, `types/simulation.ts`). Dormant, numerically unstable near cancellation (±1,000× blow-ups), consumed by nothing. Old runs rehydrate tolerantly.
6. **F10 — `totals.grand` deleted** (raw sum of 12 category medians, ≈12× the headline, unused; "sum of medians ≠ median of sum"). The portfolio band is the real portfolio quantity.
7. **F11 — `start_year` wired + trigger sign + rename.** `start_year` now gates the materialization onset (0 before it; the diffusion curve ramps from `max(base_year, start_year)` to `peak_year`). The early-warning trigger comparison is **signed** (a positive overshoot no longer fires a contraction trigger). `probability_posterior` renamed **`probability_prior`** (there is no Bayesian update from data, T7) with a deprecated read-only alias; DB column name unchanged (no migration).
8. **F6 — CLI pre-flight spectral gate.** `run_50k_prod.py` computes `correlation_lambda_min` on the **loaded** trend mix and refuses to run (exit 5) if non-PSD, unless `--allow-nonpsd`. Population-dependent validity can no longer slide past the PUT /config gate.
9. **F3/F5/F8 — honesty documentation (no numbers move).** F3: P10–P90 comes from the Monte Carlo (fixed Beta concentration α+β=6); Confidence is AI-scored **display-only** metadata, not a band input (owner clarification — the mapping to band width was **not** adopted). F5: the score→Beta-prior table (1→0.17 … 5→0.83) is published in the Trends editor tooltip and the model card. F8: correlations documented as **latent-scale**; the [0,1] restriction (no negative dependence) recorded as a known limit.

**Contract additions (2.10.0):** `regional_shift_matrix`, `region_weights_used`, `mc_standard_error`. **Removed:** `force_attribution`/`direct_effects`, `totals.grand`, the R̂/ESS `convergence` block. New config: `peak_year_jitter`, sourced `DEFAULT_REGION_WEIGHTS`.

### What Changed in v3.9 (vs. v3.8) — VC Epicentre Attribution, July 2026

Executed against owner ruling **O5** (2026-07-10; full text `docs/governance/DECISION_LOG.md` Part G). MODEL_VERSION bumped to **2.9.0**. Context: the July 2026 Trends-editor redesign made the value chain a **single epicentre stage per trend** (slider; the stored 8-step 0–5 profile is a canonical 5/3/1 serialization, categorical votes in Review & Endorse) — but the engine still consumed the expanded profile, so the VC lens smeared each trend across steps through a UI kernel constant × `vc_weights`: pseudo-measured attribution (the D3/D17/F-19 failure mode).

1. **VC lens = categorical epicentre partition.** Each trend's relevance (|normalized_score| × cat_exposure/5) is assigned wholly to its epicentre stage — structurally parallel to the force lens; shares sum to 1, so the Σ-over-steps == MC-median identity holds unchanged. `pulse.config.vc_epicentre_of/vc_epicentre_step_of` is the engine-side twin of the frontend's `epicentreOf`, parity-pinned to the same fixture table (`tests/test_vc_epicentre.py` ↔ `tests/frontend/vcEpicentre.test.ts`); legacy profiles collapse identically on both sides — **no data migration**. Propagation up/down the chain is deliberately not modelled (D16 ceteris paribus).
2. **`vc_weights` deleted end-to-end** (defaults, ModelConfig, validator, ConfigUpdate, GET/PUT /config, SettingsModal grid, TS types — inert at equal defaults, meaningless over categorical votes; `from_json` tolerates old snapshots; the never-written `config_snapshots.vc_weights` column stays inert on the DX backlog).
3. **Honesty events:** unscored trends → `vc_epicentre_coverage` warning (pre-2.9 they silently vanished from the lens while still driving the shift); a category with zero epicentre-scored contributors → `vc_attribution_fallback` warning for its uniform 1/8 spread (degenerate guard; never fires on the 99-trend base).
4. **Drift telemetry:** the fingerprint's `"ve"` component is now the derived stage — an epicentre flip is drift, a representation rewrite (legacy grid → canonical slider profile, same stage) is not; pre-2.9 dict-format fingerprints are collapsed before diffing (no false drift wall on the first 2.9.0 run).
5. **Labels:** lens reads "Value chain **epicentre** attribution" (assign-wholly + no-propagation caption); About-footer shows the run's basis from persisted `meta.vc_attribution_basis` ("epicentre partition" vs "profile-weighted (pre-2.9 run)"); Excel metadata carries a VC ATTRIBUTION note; Trends-editor copy no longer claims the engine consumes the 8-step expansion.
6. **Contract mechanics:** shift-matrix numbers untouched (`vc_exposure` never fed the shift math) — golden shift/portfolio pins deliberately NOT regenerated and pass unchanged on 2.9.0; only `decompositions.vc`/`vc_decomposition` values move (terminal-year block now reuses the same shares — single source). New structural locks: VC reconciliation, categorical-partition leak test, coverage event. **Run the 50k CLI after deploying** so the persisted run matches 2.9.0 (until then the footer honestly labels the old run "profile-weighted").

### What Changed in v3.8 (vs. v3.7) — Handover Review, July 2026

Executed against the July 1 code review (2 critical / 6 high / 17 medium / 29 low findings) and owner decisions **R1–R4** (ruled 2026-07-06). Full per-finding dispositions with commits: `docs/governance/REMEDIATION_2026-07-06.md`. MODEL_VERSION bumped to **2.8.1**; golden pins regenerated in the same commit. Highlights:

1. **R1 — engine correctness (numbers move slightly, version-stamped):** deterministic trend load order (`ORDER BY id`, C2 — "same inputs + seed → same result" had been silently order-dependent); a missing `gp1_pct_affected` now hard-fails at every layer instead of silently becoming 10% (M1); copula uniforms clip at float-safety 1e-12 instead of 0.001, removing an inward std/mean bias (L3); compounding factors are floored at 0 = −100% with an integrity-event counter (L4). **Run the 50k CLI after deploying** so the persisted run matches 2.8.1.
2. **R2 — the dormant AI layer is deleted** (`pulse/ai/`, its docs, env vars and deps): no live route, a broken import, and open injection/fake-firewall findings. Any future AI layer is a fresh build per `CONCEPT_PRISM_ONLINE_AI.md`.
3. **R3 — save integrity + honest display:** expert edits can no longer vanish on row collapse (pending autosaves flush on unmount, H6); saves are always attempted and fail loudly instead of showing a false "✓" (M6); reconnect reloads data, with request-ordering epochs (M7); **seed stability is back** (owner re-ruling of the June T18 removal): the terminal-year portfolio-median spread across independently-seeded chains, persisted per run and shown in the About-this-model footer — honestly framed as MC sampling noise only (M2); the never-rendered "Strength" bar and its phantom `impact`/`score` type fields are gone (M8).
4. **Security/ops:** `full-reseed` is admin-only POST — it was an unauthenticated GET that replaced the production trend base (C1); audit entries carry the verified-JWT identity, never "system" (M3); `/diagnostics` no longer crashes on the DB outage it exists to explain (M4); the prod run refuses the wrong DB mode (exit 4) and exits non-zero when the persist fails (H1/H2); snapshots are capped at 512 KB and newest-50-per-creator (M12); drift fingerprints now cover exposures/peak-year/curve, and mass add/remove escalates severity (L6/L7); the master seed is persisted alongside chain seeds (L8).
5. **One version everywhere:** `pulse.__version__` == `MODEL_VERSION` == package.json == **2.8.1**, test-locked — the live API had been advertising 6.0.0 (M15).
6. **Hygiene:** the 11 legacy-auth tombstone stubs are deleted (Clerk owns auth end-to-end); dead dependencies pruned (d3, aiohttp, feedparser, requests, anthropic, python-pptx, reportlab); CI installs from requirements-dev.txt (M9); new operational tests — prod-entrypoint import, wrong-DB-mode exit, Excel round-trip, diagnostics outage (M10); dead config removed (`/api/py` rewrites, phantom tsconfig excludes); a11y batch — real in-cell drill-down buttons replace `tr[role="button"]`, matrix cells carry P10–P90 aria-labels, dot ratings are valid radio groups (L16/L18).
7. **Governance travels with the code:** the decision log, findings register, the July review and this round's remediation record live in `docs/governance/` (H5); `scripts/package_handover.sh` builds the fresh-history handover package (H4).

### What Changed in v3.7 (vs. v3.6) — Second Ruling Round, June 2026

Executed against owner decisions **D12–D21** (ruled 2026-06-10; full text now in `docs/governance/DECISION_LOG.md`, Part A addendum). MODEL_VERSION bumped to **2.8.0**. One changelog block covering the full D1–D21 remediation:

1. **D1 (v3.6, F-01) — PSD-valid default correlations.** Defaults recalibrated to be valid as entered (min eigenvalue ≈ +0.14 on the 99-trend matrix); `PUT /api/v1/config` spectrally rejects invalid correlation settings; the engine's silent repair no longer fires on defaults. Golden pins regenerated.
2. **D2 (narrowed by D14) — analytics "Production" claims retired.** Superseded: the suite is deleted outright (see D14).
3. **D3 (F-13/F-16) — honest display.** One decimal everywhere; P10–P90 ranges always visible at the headline (owner update 2026-06-11: matrix cells show medians only — bands live in the cell hover tooltip and the drill-down fan chart, so the grid stays scannable); **the headline band is now the true joint portfolio percentile** (`totals.portfolio`, computed per-iteration from raw samples — not an average of per-category bands; pre-2.8 runs fall back, labeled); **the R̂ badge is gone** — the run popover shows **seed stability** (headline spread across independently-seeded chains) instead, because R̂ on i.i.d. MC draws is ≈1.0 by construction.
4. **D4 (v3.6) — allocation optimizer deleted** (module, endpoints, request flags, exports, types, UI). It ranked dimensionless shifts with no € pools or Henkel position.
5. **D5 (v3.6, owner-modified) — Profit Pool Explorer is GP1-only.** The EBIT-margin dataset and € conversion helpers were removed; the Beta explorer keeps its sourced GP1 slide views (absolute figures allowed there by owner decision); the Shift Analysis remains relative-% only.
6. **D6+D16 — attribution labels + ceteris-paribus wording.** Lenses read "Force / Value chain / Region **attribution**" with honest captions. New (D16, exact owner wording): the matrix/headline carries *"Ceteris paribus: assumes no management response — no pricing moves, innovation, or competitive reaction by Henkel or competitors. Totals read as exposure if nobody acts, not as forecast outcomes."* The About-this-model footer adds the "PRISM holds strategy constant…" paragraph; the Excel export carries the same READING NOTE. All-negative totals are **correct under this design assumption** — wording, not model changes (F-21 resolved by positioning).
7. **D7 (v3.6) — provenance chips.** Trend chips show "AI suggestion" / "AI suggestion · expert-reviewed" (admin edits set `user_override`).
8. **D8+D17 — attenuation visibility + honest provenance naming.** Config sheet shows per-force attenuation + within-force overlap read-only; the dead scalar attenuation field is gone (F-27). Source tags now read **"structured-judgment overlap correction (v3.5, Apr-2026)"** — never "calibrated" (F-19) — in SettingsModal, Excel metadata and Power BI export.
9. **D9 (skipped by owner) — no hindcast.** F-08 stays open: PRISM is positioned as *structured judgment*, never "validated forecaster". Revisit trigger: the first PRISM output cited in a board-level document.
10. **D10 (v3.6) — Delphi capability deleted** (module, routes, DDL, types, UI). Expert consensus is entered live via the admin Trend editor; `scripts/migrate_drop_delphi.py` archives-then-drops `delphi_*` tables.
11. **D11 (superseded for Sobol) — X3 on record.** If sensitivity is ever rebuilt: per-trend-cluster **Shapley effects** under the copula (06 Part C). No sensitivity exhibit exists today, and none is claimed.
12. **D12 — git reconciliation.** The platform line (Next 16/React 19, CI, handover cleanup) and the v3.6 model line were unified (`4c7070c`); main is the single line of truth. Backup tarball + safety anchor (`backup/pre-v3.7-anchor`) created before this round.
13. **D13 — exact scipy math is the ONLY math.** `_scipy_compat.py` (numpy approximation layer) deleted; the engine fails loudly without scipy; serverless surfaces never compute (F2); the scipy-less "engine-lite" CI job removed; `numerics_backend` recorded in `run_meta`. Resolves F-12 by deletion.
14. **D14 + Sobol rider — advanced analytics deleted end-to-end.** CVaR, Sobol, tipping-points and reverse-stress rendered nowhere in the live UI (fetches silently swallowed). Deleted: `pulse/simulation/{cvar,sobol,tipping_points,reverse_stress}.py`, `pulse/api/routes/analytics.py`, client functions, usePrism state, `types/analytics.ts`, legacy-dashboard panels, all five test files, SALib dependency. The Sobol "fix plumbing, keep unexposed" clause of D2/D11 is superseded by owner ruling: *"if we don't need it, delete it."*
15. **D15 (dismissed) — trend input grammar unchanged.** No two-sided magnitudes, no re-anchored probability scale. F-09 stays in the register as a known, accepted limitation (bands reflect magnitude uncertainty of listed trends only).
16. **D18 (dismissed) — no Henkel-position overlay** and no related caveat. F-20 stays open-by-decision.
17. **D19 (F-15) — input-drift integrity event.** Every run diffs its trend scoring state against the previous accepted run's persisted fingerprint and emits *"N trend score(s) changed (M direction flips; per-force balance delta …)"* into `integrity_events`, persisted with the run and surfaced in the dashboard's integrity chip next to the run ribbon. A vandalized or fat-fingered database can no longer slide into an exhibit silently.
18. **D20 (F-10) — t-copula deleted; Gaussian copula.** Post-D1 re-test (verification artifact `v8_d20_tcopula_df_out.txt`, retained offline by the owner): df 4 → ∞ moves the portfolio P10–P90 band <2% on PSD-valid defaults — the tail dial was marketed complexity with no observable output effect. The engine now runs a Gaussian copula; the `t_copula_df` parameter is gone from config/validator/API/UI/docs. (`ModelConfig.from_json` tolerates the retired field in old snapshots.)
19. **D21 (F-23/F-25) — hygiene batch, implemented thoroughly.** Every config layer the engine consumes is validated (`force_correlation_matrix` incl. symmetry + 6-level PSD, `force_overlap_matrix`, `within_force_overlap`, `category_weights` cross-checked against `category_names`, `region_weights`); fixed a latent **PUT /config 500** (the validator call read the v3.2-deleted `attenuation` attribute — every config save crashed); zero-trend division warning guarded; one quantile convention documented engine-wide (`np.percentile`, linear); drift sweep removed the dead `include_sensitivity` flag, stale "assumed" source description, duplicate response keys, and three-releases-stale hardcoded version strings in Excel/Power BI exports.

**Open-by-decision (explicitly not bugs):** D9/F-08 (no hindcast), D15/F-09 (one-sided trend grammar), D18/F-20 (no Henkel-position overlay).

### Consumer Journey layer (v3.6 block 8, restored & re-based 2026-06-10)

The Consumer Journey de-blackboxing (audit + same-day implementation:
`PRISM_Consumer_Journey_Audit_2026-06-10.md`, §7 addendum) was lost to a
sync/parallel-session race before it could be committed (uncommitted edits to
pre-existing files were wiped by a hard reset on the shared working tree; new
files survived) and was **re-implemented onto the v3.7 / MODEL_VERSION 2.8.0
architecture** the same day. Scope, unchanged from the audit ruling:

1. **Honest labelling** — authored tile analyses render as *"Strategist Read —
   authored, not simulated"* (never "PRISM Analysis"); per-tile provenance
   chips ✍️ strategist-authored / ✨ AI-suggested with evidence grades
   ✅/⚡/⚠️; scope banner: the qualitative overlay does not feed the Shift
   Matrix. (The once-46 ✨ tiles were folded into the 2026-06-29 seed
   reformulation and the remainder **bulk-accepted by owner ruling O2,
   2026-07-07** — the ✨/pending machinery stays live for FUTURE AI
   suggestions.)
2. **Content out of code** — 300 tiles + stage contexts live in
   `data/consumerJourney.ts` (`JOURNEY_CONTENT_VERSION`); admin edits persist
   via `GET|PUT /api/v1/journey` (Next proxy `/api/journey`) into the
   versioned `journey_content` table.
3. **Real trend linkage** — canonical code↔ID map `data/trendCodeMap.ts`
   (C/T/G/K/E/X-rNN; 51 live codes since 2.11.0 and 65 `RETIRED_CODES` with
   merged-into / residue pointers that must never render as live drivers —
   evidence cards resolve merged codes to the absorbing driver); evidence cards drill through to the live trend DB
   (`Trends2` `initialSearch`).
4. **Quantitative layer — REMOVED (O3, owner ruling 2026-07-07).** The
   `journey_exposure` score table (99 trends × 260 stage scores), its seed
   and backfill scripts, the engine's `journey_decomposition`, the stage
   taxonomy in `pulse/config.py`, and the per-stage exposure/attribution UI
   were deleted before ever being activated in production — the owner ruled
   the scores unnecessary. The journey overlay is deliberately QUALITATIVE
   (tiles, Strategist Reads, live-trend evidence); nothing in it feeds or
   reads the Shift Matrix. Removal is contract-symmetric with the June
   addition (ruled additive, no MODEL_VERSION bump): shift numbers and
   golden pins are untouched. `scripts/migrate_drop_legacy.py` drops the
   `trend_journey_exposure` table from existing databases.

Content acceptance: the AI-derived tiles were **bulk-accepted by the owner
as working values (O2, 2026-07-07)** — no open item-level review; the
✨/pending machinery stays live for future AI suggestions. (The 260 exposure
scores accepted under O2 were then deleted outright under O3 the same day —
see block 4.) Remaining backlog: internal validation of Henkel claims in
stage contexts; Home Care journey (tab honestly reads "Laundry" until then).

5. **Re-based onto the 51-driver base (2026-09-10, under O10).** All 300
   tiles and 21 stage contexts cite live codes only: merged drivers are
   attributed to the absorbing driver, a driver that left the model is no
   longer claimed (the sentences read as the strategist's judgment plus one
   "left the model in the September 2026 review" sentence; 19 tiles keep no
   modelled driver and render an honest empty "Drivers behind this moment" step), drivers
   with zero exposure on the tile's journey are not cited, the tile's side is
   never flipped. Provenance date 2026-09, `JOURNEY_CONTENT_VERSION`
   2026-09-10 (2026-09-16 since the O15 vocabulary pass, 2026-09-17 since the content corrections that followed it). The profit-pool impact chip was re-graded by the tercile-delta
   rule documented in `data/consumerJourney.ts` (`PoolImpactInfo`) and
   `docs/governance/DECISION_LOG.md` Part H. The server copy
   (`journey_content`) takes precedence over the seed, so the re-based content
   is also written as a new row at go-live.

### Earlier release notes (condensed, still accurate)

- **v3.6 (June 2026, audit remediation D1–D11):** PSD-valid correlations + spectral config gate; optimizer + Delphi deleted; analytics fixed-then-(v3.7)-deleted; attribution relabels; one-decimal display; provenance chips; GP1-only explorer; MODEL_VERSION 2.7.0. Full record: `docs/governance/DECISION_LOG.md` Part E. Block 8 of this round (Consumer Journey de-blackboxing) is documented in its own section above.
- **Platform line (June 2026):** Next.js 14.2 → **16.2**, React 18 → **19**; Clerk-based auth pages (`app/sign-in`, `app/sign-up`) alongside JWT viewer cookies; repository handover cleanup; CI (GitHub Actions: frontend typecheck/lint/vitest + scipy engine pytest); F1 single source of truth for shift-matrix math (`lib/shiftMatrix.ts`); F4 split of the `app.py` monolith into routers + service + state; F2 read-only online service; F3 authenticated reads; F6 dead-endpoint removal; F10 dynamic-import Beta tabs; Maritime design-system unification.
- **v3.5 (April 2026):** 99-trend base; attenuation + overlap matrices re-derived from the 99-trend exposure space (structured-judgment overlap correction); per-force attenuation replaces every scalar.
- **v3.3 (April 2026):** 14 new trends, 8 re-scorings, 1 consolidation after the MECE coverage review.
- **v3.1 (April 2026):** Bain trend review — 82 trends; horizon extended; later trimmed to 2035 (10-year, post-audit).
- **v3.2 (April 2026):** dead-code cleanup — SensitivityEngine stub, backtesting, Causal DAG / Game Theory references removed; scalar attenuation retired.
- **v3.0:** Production rewrite — Next.js frontend, dual-mode DB, auth, exports.

### Driver Base Composition (2.12.0 base, September 2026 review — O10; TOI exposure O13)

**Total: 51 drivers** (generated seed; `docs/SEED_DATA_README.md`).

| Force | Count |
|-------|:---:|
| Consumer | 20 |
| Government | 10 |
| Customer | 7 |
| Technology | 6 |
| Competitive | 4 |
| Environmental | 4 |

**Direction split:** 33 Contraction / 18 Expansion — one mechanism per driver after the review; the base is more contraction-heavy by design and, under the D16 ceteris-paribus framing, totals read as *exposure if nobody acts*. Every driver carries an uncertainty score (O7) and graded sources (S/A/B), and — since 2.12.0 (O13) — a Toilet Care exposure alongside its Hard-Surface Cleaner one: 13 categories × 51 drivers = 663 category scores, of which 37 TOI scores were inherited from HSC unchanged and 14 were judged separately.

### Implementation Status (June 2026, v3.7)

| Module | Status | Notes |
|--------|--------|-------|
| Bayesian Monte Carlo with Gaussian copula | **Production** | Beta priors; Gaussian copula (t-copula deleted, D20); scipy-only (D13); 2.8.1 correctness batch (R1); 2.9.0 VC-epicentre partition (O5); 2.10.0 3D regional shift (F1), n_eff dampening (F2), peak-year jitter (F4), chain pooling + MC-SE (F7), start_year onset (F11); **2.11.0 cell gross-profit-share roll-up (O6), per-driver uncertainty (O7), 51-driver base (O10), v3.11 calibration (O11); 2.12.0 13-category taxonomy with the Toilet Care split and the v3.12 recalibration it forces (O13), estimated HCB cell-weight default (O14)** |
| Continuous path modeling | **Production** | 5 MECE diffusion curves, 2026–2035, velocity per iteration |
| Joint portfolio band + seed stability | **Production** | `totals.portfolio` (D3) + `seed_stability` (M2, re-added 2026-07-06 — populated from the first 2.8.1 run) |
| Input-drift telemetry | **Production** | `pulse/audit/input_drift.py` (D19; L6/L7 coverage + severity, 2.8.1) |
| Consumer-journey content store (qualitative) | **Production** | `journey_content` admin store + tile overlay. The quantitative decomposition/exposure layer was **removed (O3, 2026-07-07)** before activation |
| Multi-expert proposals layer | **Production** | `pulse/api/proposals.py` + `trend_score_proposals` table; per-expert drafts, aggregate + endorse flow (June 2026) |
| AI layer (scanner, narrator, calibrator, chat) | **Removed (R2, 2026-07-06)** | Broken import, no live route, open security findings; future AI = fresh build per `CONCEPT_PRISM_ONLINE_AI.md` |
| Excel export (Shift Matrix QA workbook) | **Production** | Written by `run_50k_prod.py`; D16/D17 wording included; round-trip-tested (M10) |
| PPTX / Power BI export modules | **Removed** | Deleted before v3.8 (orphaned deps pruned 2026-07-06); the QA Excel is the only artifact export |
| War Room dashboard (Next.js 16) | **Production** | 10 components; read-only over persisted runs |
| REST API (FastAPI) | **Production** | Read-only data plane + admin trend/config writes |
| Advanced analytics (CVaR/Sobol/tipping/reverse-stress) | **Removed (D14)** | — |
| Allocation optimizer | **Removed (D4)** | — |
| Delphi elicitation | **Removed (D10)** | — |
| Backtesting / Causal DAG / Game theory / Sensitivity stub | **Removed (v3.2)** | — |

### Design Philosophy
1. **Computation is offline and exact** — scipy CLI runs persist to Neon; the deployed app renders, it never computes; no approximated math anywhere (D13).
2. **AI augments human judgment, never replaces it** — every AI-suggested score carries a visible provenance chip until expert-reviewed (D7).
3. **Bayesian > point estimates** — Beta priors with a Gaussian copula dependency structure, valid as entered (D1, D20).
4. **Honest display beats impressive display** — joint portfolio bands, one decimal, attribution (not simulation) labels, seed stability (not R̂), integrity events incl. input drift on every run (D3/D6/D16/D19).
5. **PRISM never sees absolute figures** — relative shifts only; € belongs to finance's systems (the GP1-only Beta explorer is the one owner-sanctioned exception, D5).
6. **Ceteris paribus by design** — the simulation propagates external drivers only and deliberately excludes management response; a negative total means "headwind to today's business if nothing changes", not "this pool will shrink" (D16).
7. **Structured judgment, not validated forecasting** — no hindcast exists (D9 open); positioning language must never claim predictive validity (F-08).
8. **Delete what isn't needed** — inert dials, unexposed endpoints, approximation layers and stub modules are removed, not maintained (D4/D10/D13/D14/D20).

---

## 2. SYSTEM ARCHITECTURE

```
┌────────────────────────────────────────────────────────────────────┐
│ OFFLINE (owner's machine)                                          │
│   python3 scripts/run_50k_prod.py                                  │
│   ├── loads the 51 drivers from Neon (O10)                         │
│   ├── BayesianMonteCarloEngine.run_multichain(3 × 50k, scipy)      │
│   ├── input-drift diff vs previous run (D19)                       │
│   ├── persists results bundle → Neon (simulation_runs row)         │
│   └── writes QA Excel (Shift Matrix + Velocity + Metadata)         │
└────────────────────────────────────────────────────────────────────┘
                                │ persisted run (relative % only)
┌───────────────────────────────▼────────────────────────────────────┐
│ VERCEL (production, read-only)                                     │
│  Next.js 16 frontend (app/, components/, hooks/usePrism.ts)        │
│  Python serverless adapter api/index.py → pulse/api/app.py         │
│  ├── routers: system / trends / simulation / config /              │
│  │            competitors / misc / journey                         │
│  ├── F2: never simulates (409 without scipy); F3: auth on reads    │
│  └── NEON POSTGRES (trends, simulation_runs, config, users, audit) │
└────────────────────────────────────────────────────────────────────┘

LOCAL DEV: python -m pulse --serve (FastAPI :8000, SQLite data/prism.db)
           npm run dev (Next.js :3000)
```

### The Shift Matrix contract (per persisted run)

`results` bundle: `shift_matrix` (category roll-up: per-category `path` {year: {p10,p25,median/p50,p75,p90,mean,std}} + per-iteration `velocity` bands), **`regional_shift_matrix`** (2.10.0/F1: the 3D category × region shift — per (category, region) a `path`+`velocity`), **`region_weights_used`** (since 2.11.0 the column sums of **`cell_weights_used`**, the 13 × 4 gross-profit-share matrix of the roll-up, O6, with **`category_weights_used`** and **`cell_weights_source`** — since 2.12.0 the default matrix is the O14 estimated HCB mix and the source string opens with "ESTIMATE, not Henkel P&L"; a finance file passed to the CLI overrides it and stamps its own source), `decompositions` (force/vc/region attribution per year — the vc lens is an **epicentre partition** since 2.9.0; region is also a real shift dimension since 2.10.0), `totals` (row/column + **`portfolio`** joint percentiles — **`grand` deleted, F10**), **`mc_standard_error`** (2.10.0/F7: per-quantile MC standard error, replaces the deleted R̂/ESS `convergence` block), `integrity_events`, `seed_stability` (2.8.1+; null on older runs; carries `pooled_iterations` since 2.10.0), `meta` (`engine_fidelity`, `numerics_backend`, `seed` (master), `chain_seeds`, `chains`, `model_version`, `engine_name`, `vc_attribution_basis` (2.9.0+; "epicentre"), `region_weights_used` (2.10.0+), `cell_weights_used` / `category_weights_used` / `cell_weights_source` / `trend_count` / `attenuation_source` (2.11.0+), `persisted_at_utc`, **`trend_fingerprint`** for the next run's drift diff). **`force_attribution` deleted end-to-end (F9).**

Users apply shifts: `GP1_projected = GP1_actual × (1 + shift_median)` — the shift is the cell-share-weighted roll-up (O6); apply per (category, region) with `regional_shift_matrix` when regional € pools are available.

---

## 3. PYTHON ENGINE (`pulse/`)

**simulation/bayesian_mc.py** — the engine (PRODUCTION, MODEL_VERSION **2.12.0**)
- Beta-distributed priors per trend (α, β from `probability_prior` — renamed from `probability_posterior`, F11; there is no data update, T7); **2.11.0 (O7): concentration from the uncertainty score (24/16/10/6/4/3), mean p/6 unchanged**
- **Gaussian copula** over a trend-level correlation matrix built from `within_force_rho` + `force_correlation_matrix` (PSD-valid as entered, D1; latent-scale, F8; repair events surface as integrity events and must NOT fire on defaults)
- Hard scipy requirement; `NUMERICS_BACKEND` constant recorded in every result (D13)
- **3D shift (F1, 2.10.0):** `_compute_all_paths_vectorized` solves 52 composite cells (13 categories × 4 regions); each trend weighted by `category_exposure/5 × regional_exposure/5`. `_simulate_samples` reshapes to (iter, cat, region, year) and rolls up to category with the row-normalised **cell gross-profit-share matrix** (`_row_normalised_cell_weights()`, O6) and to the portfolio with its row sums. `run()` attaches `regional_shift_matrix` + `cell_weights_used` / `category_weights_used` / `region_weights_used` / `cell_weights_source`; region-less trends → global + `regional_exposure_coverage` event; a zero-share row → `cell_weight_zero_row` event
- **Within-force dampening = magnitude-weighted `n_eff` participation ratio (F2)** (was count-based) — restores monotonicity; zero-cell guarded
- Per-trend materialization schedules (**start_year onset gate, F11**; peak_year × diffusion_curve; **per-iteration peak-year jitter, F4 — width per trend from the uncertainty score since 2.11.0, global ±1 for unscored trends, `peak_year_jitter = 0` switches it off**), multiplicative compounding with per-force attenuation, factor floor at −100%
- Quantile convention: `np.percentile` linear interpolation, engine-wide (D21)
- `totals.portfolio` joint band (D3); **`run_multichain` POOLS the 3 chains for published percentiles (F7)** + `seed_stability` (per-chain medians; `pooled_iterations`) + `master_seed`/`chain_seeds` (L8); **`mc_standard_error`** replaces the deleted R̂/ESS `convergence` block
- **`force_attribution.direct_effects` deleted (F9); `totals.grand` deleted (F10)**
- **VC lens = categorical epicentre partition (2.9.0, O5):** one share computation (reused by `decompositions.vc` and the terminal-year `vc_decomposition`); each trend assigned wholly to `vc_epicentre_step_of(vc_exposure)`; no vc_weights; `vc_epicentre_coverage`/`vc_attribution_fallback` integrity events; result carries `vc_attribution_basis`
- 10,000 iterations default; 50,000 × 3 chains (pooled → 150k) in production runs

**simulation/paths.py** — diffusion curves, velocity/acceleration, trigger primitives (PRODUCTION)

**audit/input_drift.py** — D19 fingerprint + drift-event computation (PRODUCTION); **audit/logger.py** — transactional audit log

**config.py / config_validation.py** — taxonomies (6 forces, 13 categories since the O13 Toilet Care split, 8 VC steps, 4 regions), **`cell_weights` (13 × 4 gross-profit shares, O6; `cell_weights_outer` / `cell_weight_marginals`), `beta_prior_for` / `peak_jitter_for` (O7 uncertainty tables)**, **`vc_epicentre_of`/`vc_epicentre_step_of`** (2.9.0 — engine-side twin of the frontend's `epicentreOf`, parity-pinned), `compute_materialization_schedule` (**start_year onset param, F11**), defaults (`DEFAULT_PER_FORCE_ATTENUATION`, `DEFAULT_WITHIN_FORCE_OVERLAP`, `DEFAULT_FORCE_OVERLAP_MATRIX` — all three from `data/attenuation_calibration_v3_12.json` since 2.12.0 (O13 — the calibration is a function of the category exposure space, so the taxonomy change forced a recompute; one generated record since 2.11.0, O11/F-28); `DEFAULT_FORCE_CORRELATIONS` v3.6 PSD-valid, re-checked on the 51 mix; **`DEFAULT_CELL_WEIGHTS` = the estimated 13 × 4 HCB gross-profit mix of O14 (2.12.0; generated by `scripts/build_estimated_cell_weights.py` from `data/cell_weights_estimated_v1.json`, `--check` in CI) + `DEFAULT_CELL_WEIGHTS_SOURCE`, with the flat grid kept as `EQUAL_CELL_WEIGHTS` / `EQUAL_CELL_WEIGHTS_SOURCE` (O6; the FY2025 regional split of 2.10.0 is gone; the finance file still overrides the default); `peak_year_jitter` F4**; `DEFAULT_VC_WEIGHTS` deleted 2.9.0), frozen `ModelConfig` dataclass with tolerant `from_json`; pydantic validator covering **every** engine-consumed layer + `correlation_lambda_min` population spectral gate (D1/D21; the CLI pre-flight gate in `run_50k_prod.py` runs it on the loaded trend mix, F6)

**database.py** — dual-mode (Neon psycopg2 / SQLite); deterministic `ORDER BY id` trend loads (C2); no invented gp1 defaults at any layer (M1); **seed_trends.py** — the 51-driver seed, GENERATED by `scripts/generate_seed_from_core_set.py` from `data/trend_base_2026-09/` (O10; never hand-edited; `scripts/replace_trend_base.py` moves a database onto it archive-first); **ingestion/models.py** — Trend dataclasses (`ai_suggested`, `user_override` drive D7 chips; `uncertainty` O7). Legacy-schema cleanup: `scripts/migrate_drop_delphi.py` (O1) + `scripts/migrate_drop_legacy.py` (O3/O4), both `--postgres`-gated

**env_loader.py** — loads the repo-root `.env` as an import side effect; shell variables win (`override=False`, M17)

**excel_bridge/** — `writer.py` only (QA workbook with D16 READING NOTE + D17 provenance wording + D13 numerics backend). The former `export_center.py` / `powerbi_export.py` / `api/export_pptx.py` ad-hoc modules are deleted.

**api/** — `app.py` (assembly only), `state.py`, `serialization.py`, `models.py`, `proposals.py` (multi-expert score proposals: per-expert drafts + aggregate, consumed by the trends router), `services/simulation_service.py` (THE single rehydration implementation incl. integrity events + seed stability — `GET /simulation` delegates here, F4), `auth.py` (JWT dependencies + `identity_from_user` for audit attribution, M3), `routers/{system,trends,simulation,config,competitors,misc,journey}.py` (journey mounted since the 2026-06-10 restore: GET/PUT `/api/v1/journey` content store). The legacy unmounted `routes/` package and the `ai/` package are deleted (R2).

---

## 4. FRONTEND (Next.js 16 / React 19 / TS 5.7)

**Pages (`app/`):** dashboard, login/register + Clerk sign-in/sign-up, forgot/reset-password, `api/` proxy routes.

**Dashboard components (`components/dashboard/`, 10):**

| Component | Purpose |
|-----------|---------|
| `ProfitPoolAnalysis2.tsx` | Shift Matrix, four lenses (VC lens reads "Value chain **epicentre** attribution" since 2.9.0 — assign-wholly caption, no modelled propagation); lean KPI strip above the matrix (portfolio shift + least/most contracting category; P10–P90 on hover only — owner declutter 2026-06-11, replaces the hero block); short D16 caption under the section intro; run provenance (incl. the 2.9.0 VC-basis row: "epicentre partition" vs "profile-weighted (pre-2.9 run)"), seed stability + integrity events (D19) rendered flat inside the About-this-model footer (header ribbon/popovers removed) |
| `Trends2.tsx` | The **Drivers** page: driver explorer + admin editor (the file keeps its code name, O15); D7 provenance chips |
| `CategoryDetailPanel.tsx` | Category drill-down drawer (percentile fan, force decomposition, contributing-driver attribution) |
| `ConsumerJourney2.tsx` | Consumer-journey overlay (Laundry 13 / Hair 8 stages from `data/consumerJourney.ts`): "Strategist Read" authored analyses with provenance + grade chips, live driver evidence cards with Drivers drill-through, computed stage-attribution chips (`journey_decomposition`, honest empty state), admin tile editing → `/api/journey` |
| `ProfitPoolExplorer.tsx` | Beta, GP1-only pool views (D5). v2 (2026-06-11): arrows = pool development (revenue × GP1 drift, FY2025→2030, derived in `lib/profitPoolData.ts`); Laundry/Hair toggle + view pills; click drill-down decomposes pool CAGR into revenue CAGR + GP1 drift with € pools; all sources clickable URLs verified vs. FY2025 filings, graded ✅ reported / ⚡ derived / ⚠️ estimate. **v3 (2026-07-02): category views rebuilt on the Euromonitor Passport taxonomy** (Hair: 8 Passport categories incl. Salon Professional; Home Care: all 8 categories — Toilet Care & Home Insecticides finally have pool rows); sizes are public triangulations at RSP (Passport internal not shareable — licence), derivation recipes viewer-visible in the source-chip hovers; source ladder EMI → Kline (pro hair, salon-mfr level) → Circana/NIQ (scanner-POS) → filings (MSP) → tier-2; `SourceRef.denomination` guards mixed-basis sums. Audit: `docs/PROFIT_POOL_EXPLORER_SOURCES_AUDIT_2026-07-02.md` (+ the validation worklist xlsx, retained offline by the owner) for eventual Passport confirmation |
| `SettingsModal.tsx` | Config sheet (read-only attenuation/overlap with D17 source tags; D8), auth & sessions. **v2 (2026-07-03): sheet aligned to the real GET/PUT contract** — dead dials deleted (Region select, neutral threshold, base year, residual cross-ρ: never returned by GET, silently dropped by PUT), base year now served read-only by GET; between-force overlap + force correlation matrices rendered read-only (6×6, D17/D1 wording); editable force weight grid with a live Σ badge (backend rejects ≠1.0 ±0.01) — since 2.11.0 the region/category grids are replaced by the cell-weight grid with derived marginals (O6; 13 × 4 since the 2.12.0 Toilet Care split, shares applied normalised to their total inside the tolerance; since O14 a three-state basis badge — estimated HCB mix / equal placeholder / custom — two resets writing their own provenance labels (`cell_weights_source_default` vs `cell_weights_source_equal`), and a collapsible read-only block rendering the whole graded derivation from `lib/cellWeightProvenance.ts`), the VC weight grid was deleted with the 2.9.0 epicentre partition (O5); diff-only PUT so the audit log records only actual changes; modal scroll fixed (grid row `minmax(0,1fr)`). `neutral_threshold` deleted end-to-end same day (engine-inert since v1; ModelConfig field, validator, defaults, router call, test fixture, TS type — `from_json` tolerates it in old snapshots) |
| `WelcomeModal.tsx`, `ErrorBoundary.tsx`, `LoadingSkeleton.tsx` | Shell |

**State:** `hooks/usePrism.ts` — single provider; renders the latest persisted run; no in-app simulate. **API client:** `api/client.ts` (typed; `normalizeSimulation` unit-tested). **Math:** `lib/shiftMatrix.ts` is the single source of truth for category-weighted aggregation (F1; enforced by `scripts/check_shiftmatrix_single_source.sh` in `npm run lint`).

**Types (`types/`):** index, trends, simulation (incl. `TotalsMatrix.portfolio`, `IntegrityEvent`, `SeedStability`, `RunMeta.numerics_backend`), config, api. (`analytics.ts` and `delphi.ts` deleted.)

---

## 5. TECH STACK

Frontend: Next.js 16.2 · React 19.2 · TypeScript 5.7 · Tailwind 3.4 · Recharts 2.15 · Framer Motion 12 · Clerk · Neon serverless driver · vitest 4. (d3 removed 2026-07-06 — it had zero imports.)
Backend: fastapi · pydantic v2 · numpy · **scipy (hard requirement, D13)** · openpyxl · psycopg2-binary · python-dotenv · pytest/hypothesis. SALib removed (D14); anthropic/feedparser/beautifulsoup4 removed with the AI layer (R2); python-pptx/reportlab removed as orphans (their ad-hoc export modules were already gone).
Serverless (`api/requirements.txt`): fastapi, pydantic, numpy, psycopg2-binary — **no scipy by design**: that runtime is read-only (F2/D13). (aiohttp/feedparser/requests pruned 2026-07-06, M11 — zero importers.)

---

## 6. DATABASE SCHEMA (production truth)

Tables: `trends` (+ `uncertainty` INTEGER since 2.11.0), `trend_category_exposure`, `trend_vc_exposure`, `trend_regional_exposure`, `trend_sources`, `trend_score_proposals` (multi-expert proposals layer, June 2026; + `uncertainty`), `journey_content` (versioned admin tile-map blobs), `simulation_runs` (results bundle incl. integrity events, seed stability + fingerprint), `config_snapshots`, `triggers`, `ai_suggestions`, `audit_log`, `session_snapshots` (capped per M12). Removed 2026-07-07 (O3/O4, via `scripts/migrate_drop_legacy.py` — run once per database): `trend_journey_exposure`, `users` (engine-side legacy; identity is Clerk, roles live in the Next-managed `user_roles` table), `scanned_trends`, and the `simulation_runs.allocation_recommendation` column. `delphi_rounds` **and** the delphi-era `trends` columns (`scorer_count/score_variance/debiasing_applied`) are **dropped** by `scripts/migrate_drop_delphi.py` (archives JSON first; extended per owner ruling O1, 2026-07-07 — run it once per database). `users.password_hash/password_salt` remains as a harmless non-delphi legacy pair nothing reads or writes (dropping it is a DX-scheduled migration — HANDOVER.md §7).

---

## 7. REST API (live route table, verified June 2026)

```
GET           /api/v1/health, /api/v1/diagnostics        (anonymous)
GET           /api/v1/simulation, /api/v1/simulation/status
POST          /api/v1/simulate                            (admin; 409 without scipy — F2/D13)
GET|POST|PUT|DELETE /api/v1/trends[/{id}]                 (mutations: admin)
POST          /api/v1/trends/sync, /api/v1/trends/full-reseed   (admin; full-reseed was C1)
GET|POST      /api/v1/trends/revert-to-seed               (admin)
GET|PUT       /api/v1/trends/{id}/proposals               (any authenticated expert: own proposal + aggregate)
GET|PUT       /api/v1/config                              (PUT: admin; full-layer validation + spectral gate; cell_weights only — region/category weights are derived, 400 if sent)
GET|PUT       /api/v1/journey                             (GET via authed Next proxy /api/journey; PUT admin — journey content store)
GET           /api/v1/forces, /api/v1/audit/log
GET           /api/v1/competitors[/intelligence|/{id}]
GET|POST      /api/v1/snapshots[/{id}]                    (POST: 512KB cap + newest-50-per-creator retention, M12)
POST          /api/v1/seed                                (admin)
```
Removed vs. earlier specs: `/analytics/*` (D14), `/delphi/*` (D10), `/optimize/allocation` (D4), `/scanner/*` (deleted with the AI layer, R2), `/chat` (owner decision), `/sensitivity/*` (v3.2), `/export/*` (F6 — exports are produced by the CLI run), the legacy custom-auth Next routes (`/api/auth/*`, L26 — Clerk owns auth).

---

## 8. DEPLOYMENT & VERIFICATION

```bash
# Local dev
python -m pulse --serve            # FastAPI :8000 + SQLite
npm run dev                        # Next.js :3000

# Quality gates (CI runs the same: .github/workflows/ci.yml — frontend + scipy engine)
npm run verify                     # typecheck + lint (incl. single-source check) + vitest + pytest
python3 scripts/generate_seed_from_core_set.py --check     # committed seed + code map == generator output
python3 scripts/build_estimated_cell_weights.py --check    # committed cell-weight record + lib/cellWeightProvenance.ts == generator output (O14)

# Production run (owner machine; .env carries the Neon URL)
python3 scripts/replace_trend_base.py --dry-run   # 2.11.0: move the DB onto the 51-driver base (then live; --postgres for Neon)
python3 scripts/apply_driver_vocabulary.py --dry-run   # O15: journey server copy + four driver texts onto the Driver vocabulary (then live; --postgres for Neon right before the production deploy; --dry-run again after it)
python3 scripts/run_50k_prod.py [--cell-weights FILE]   # persists a NEW run row (previous rows kept for diff)
# without --cell-weights the run falls back to the O14 estimated HCB mix (an
# ESTIMATE from public reporting, not Henkel P&L); the finance file overrides it

# Deploy: Vercel preview first, then production. The dashboard renders the
# latest persisted run; re-run the CLI after engine-version bumps so the
# persisted run matches MODEL_VERSION (expect small median changes across
# version bumps — D1/D20 honesty corrections, version-stamped).
```

---

## 9. VISUAL DESIGN SYSTEM

Maritime light editorial system (June 2026 unification): light surfaces, deep-navy primary `#00345E`, expansion `#1f7a3d` / contraction `#9f403d` (muted semantic pair, exec-audience recalibration June 2026 — single source: `lib/format.ts` `EXPANSION`/`CONTRACTION` (+ `*_RGB` tokens for custom alphas, L10); every shift number renders via `components/dashboard/ShiftValue.tsx` or `shiftColor()` with a visible sign/arrow so direction never relies on colour alone), Inter body + tabular numerals for data. Force colors (ONE palette, `lib/format.ts` `FORCE_COLORS` — the bright legacy palette was retired with L11): Consumer `#005db5`, Customer `#6b4fc4`, Technology `#0e8aa8`, Government `#b07d2b`, Environmental `#2f8f4e`, Competitive `#b0504a`. Category/brand mapping unchanged (Hair: Color/Care/Styling/Body; LHC: FCN/FCA/FFI/LAD/HDW/ADW/HSC/TOI/IC — TOI split out of HSC by O13 (2.12.0) — Schwarzkopf, Gliss, Taft, Fa, Persil, Perwoll, Silan, Pril, Somat, Bref, WC-Frisch, …).

---

## 10. TESTING

`tests/`: `conftest.py` (blanks `DATABASE_URL` / `POSTGRES_URL` before any import, so a database URL in `.env` never reaches a test; `PRISM_TEST_ALLOW_POSTGRES=1` opts out; O15; fixture differentiated per L29 — golden-pinned categories are pairwise distinct, one trend carries a per-trend materialization schedule, and the five DB trends carry canonical VC profiles with distinct epicentres + one deliberate collision, 2.9.0), `test_bayesian_mc.py`, `test_golden_pipeline.py` (determinism + golden pins (2.8.1 values, passing unchanged on 2.9.0 — the VC rework never touched shift math) incl. the joint portfolio band + no-repair-on-defaults + version sync + **2.9.0 VC structural locks**: reconciliation, categorical-partition leak test, coverage event, basis tag; pins regenerate ONLY with deliberate model changes, same commit), `test_vc_epicentre.py` (**parity fixture table with `tests/frontend/vcEpicentre.test.ts`** — Python `vc_epicentre_of` and TS `epicentreOf` must never drift; plus drift-"ve" semantics), `test_properties.py` (hypothesis), `test_api.py` (endpoint behavior incl. F2 409-guard + D13 backend tag), `test_input_drift.py` (D19), `test_ops.py` (M10: prod-entrypoint import, H1 wrong-DB-mode exit, CLI parser, Excel writer round-trip, M4 diagnostics-outage; O14: the QA workbook's graded cell-weight block appears under the estimate and is absent under any other matrix), **`test_cell_weights.py` (O6: 2.10.0 reproduction to 1e-12 with the separable matrix and the 2.10.0 calibration over the pinned 12-category `CATEGORIES_2_10_0` taxonomy, roll-up algebra, contract, validator; **O14: `TestEstimatedMixProvenance`** — constants ↔ record ↔ generator ↔ source string, every input graded, the 52 cells re-derived from the published inputs, and a non-separability guard), `test_uncertainty.py` (O7), `test_trend_base_2026_09.py` (O10/O13: seed integrity on `core_set_51_v5.json` (v4 plus the four O15 text edits), generator `--check`, code map, replacement script incl. the Postgres cascade), `test_driver_vocabulary.py` (O15: the repository content carries the Driver vocabulary; the engine/API/gate/workbook text never says trend, statically and at runtime; and the content script: dry run, apply, idempotence, every exit code, rollback, and the compare-and-swap under saves before, during and after the read and the write), `test_calibration_v3_12.py` (O11 / O13 / F-28 — renamed from `test_calibration_v3_11.py` with the v3.12 recalibration), `test_trend_persistence.py` (O12 / F-29: the `save_trends` upsert — an admin edit of a driver no longer cascades that driver's expert score proposals away)**. Frontend: `tests/frontend/` via vitest (`normalizeSimulation` incl. the cell-weight block, shift-matrix math, `cellWeights` helpers, `trendCodeMap` partition/pointers, format/display-honesty pins, auth-seam, journey dialog, tab smoke, vcEpicentre parity, and `settingsModalCellWeights` — the two Config-sheet resets must write their own provenance labels, O14; `driverVocabulary`: no user-facing "trend" in any interface string, plus render checks on the Drivers page and the entry gate, O15). Totals at this pass: **pytest 271**, **vitest 90** (2026-09-17, with the O15 locks).

---

## 11. AUDIT TRAIL & GOVERNANCE

- **Governance record (in-repo since v3.8, H5/R4):** `docs/governance/` — `DECISION_LOG.md` (D1–D21 + Sobol rider + O1–O15, full text + execution records; Part G = the 2026-07-10 VC-epicentre ruling, Part H = the September 2026 review, release 2.11.0 and its go-live, Part I = the 2026-09-11 Toilet Care split, Part J = the 2026-09-11 estimated HCB mix as the default — both in release 2.12.0, Part K = the 2026-09-16 Driver vocabulary, O15, no version bump), `FINDINGS_REGISTER.md` (open-by-decision: F-08 (D9), F-09 (D15), F-20 (D18); resolved-by-deletion: F-02..05/F-10/F-12/F-17/F-18/F-22; resolved: F-01 (D1), F-13/F-16 (D3), F-15 (D19), F-19 (D17), F-21 (D16 positioning), F-23/F-25 (D21), F-26 (files re-verified), F-27 (D8), F-28 (O11; the same failure mode recurred four times across the 2.12.0 work — twice under O13, twice under O14 — each caught before hand-back), F-29 (O12)), `CODE_REVIEW_2026-07-01_DECISIONS.md` and `REMEDIATION_2026-07-06.md` (R1–R4 + full disposition table).
- **Verification artifacts** (incl. `v8_d20_tcopula_df_out.txt`, D20 evidence) are retained offline by the owner; available on request.
- Every persisted run carries: master seed + chain seeds, chains, model version, engine fidelity, numerics backend, trend fingerprint, integrity events (incl. input drift), seed stability (2.8.1+).

### RACI (unchanged)
Driver scoring & score overrides: Category Leads (R) / Strategy VP (A). Config changes: admin-only, audited, reason-logged. AI suggestions: never auto-applied (D7 chips until reviewed).

---

## 12. RISK REGISTER (v3.8 live items)

| Risk | Mitigation |
|------|------------|
| Persisted run lags engine version after a bump — **closed for 2.11.0 on 2026-09-10**: production runs 2.11.0, Neon is on the 51-driver base and run #98 (3 × 50k) is the persisted exhibit | Run ribbon shows model_version; re-run the CLI after every deploy that bumps the engine (gate), otherwise the dashboard renders the older run and labels the mismatch. The 2.11.0 numbers moved for three stamped reasons (51-driver base, v3.11 calibration, equal 1/48 cell weights) — the acceptance-run delta table in the release summary separates them; run #98 carries the mass replacement as an input-drift event by design. **The same gate applies to the 2.12.0 bump (O13 + O14):** until the CLI is re-run the persisted run is the older one and the ribbon says so; the 2.12.0 numbers move for three stamped reasons — the 13-category taxonomy, the v3.12 recalibration it forces, and the O14 estimated HCB cell-weight default. The first two leave the headline where it was (−4.34% [−4.80, −3.80] against −4.35% [−4.81, −3.80]); the third moves it to **−5.58% [−6.16, −4.89]**, four fifths of that from the regional mix (Europe −7.11% at 51.4% of the pool against High Growth −3.04% at 19.8%). Anyone reading the old −4.34% after this deploy would think the run was broken. The mix is an estimate from public reporting, not Henkel P&L, and does not replace the finance figures |
| Live driver base and code out of step: the deployed 2.12.0 code expects 51 drivers, a database still on the 99 base shows a loud CLI warning (`EXPECTED_TREND_COUNT`) | Run `scripts/replace_trend_base.py` once per database (archive-first); the archive is the rollback. Done on 2026-09-10 for Neon and the local SQLite copy. The API caches the driver list per lambda instance, so redeploy after a replacement (DEPLOY.md) |
| Expert proposals cascade-deleted on Postgres by every admin edit (F-29, pre-existing) | **Fixed 2026-09-10 (O12):** `save_trends` upserts the trend row instead of deleting and re-inserting it, so a save never triggers the ON DELETE CASCADE on `trend_score_proposals`; only a genuine deletion does. Locked by `tests/test_trend_persistence.py` with foreign keys enforced |
| No predictive validation (accepted, D9) | Position as structured judgment; revisit at first board citation |
| One-sided driver grammar understates uncertainty (accepted, D15, recorded there as the trend input grammar) | Disclosed; bands labeled as listed-driver magnitude uncertainty |
| Neon connection limits / cold starts | Pooled connections, lazy init retry, SQLite locally |
| JWT secret exposure | Env vars only; rotate ALL credentials at handover (packaging checklist) |
| Legacy DB columns (`users.password_*`, delphi-era trend columns) | Inert — nothing reads/writes them; drop via DX-scheduled migration |

---

*Document Version: 3.12 — September 2026 (Toilet Care split O13: 13 categories, 52 composite cells, v3.12 calibration; estimated HCB gross-profit mix as the default cell-weight matrix O14, equal 1/52 grid kept selectable; MODEL_VERSION 2.12.0; Driver vocabulary O15, 2026-09-16, no version bump)*
*Author: Strategy × Technology × Quant Partnership*
*Classification: CONFIDENTIAL — Internal Use Only*
*Methodology: Beta-shaped structured-judgment priors (set from analyst 1–5 scores — magnitude-uncertainty only, NOT updated from data; T7 June 2026) + Gaussian copula dependencies + structured-judgment overlap correction + input-drift telemetry. Ceteris paribus: the engine holds strategy constant; strategic response belongs to the reader.*
