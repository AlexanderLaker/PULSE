# PRISM — Profit Pool Risk & Intelligence Simulation Model

## Project Specification & Architecture — v3.9

---

## 1. EXECUTIVE SUMMARY

### What This Is
PRISM is an **AI-augmented profit pool simulation engine** that transforms a static Excel-based strategic force assessment into a living, probabilistic strategic-decision platform. It is deployed as a **Vercel-hosted Next.js 16 web application** backed by a **Python FastAPI service**, with dual-mode persistence (Neon PostgreSQL in production, SQLite locally).

### The Core Innovation
PRISM operates on a **probabilistic profit pool shifting architecture**: directional trend scores, percentage shifts and copula-modeled dependencies produce a **Shift Matrix** — a table of percentage impacts by category × force × time path (**2026–2035**, 10-year horizon). PRISM outputs **relative shifts only**; users apply them to their own financials.

### The Operating Model (F2/F3, June 2026 — read this first)
- **Production simulation runs are CLI-only**: `python3 scripts/run_50k_prod.py` (scipy engine, 50k × 3 chains) computes offline and persists to Neon.
- **The deployed service never simulates.** It is a read-only renderer of the latest persisted run; `POST /api/v1/simulate` refuses (409) on any runtime without scipy. Every data endpoint authenticates (httpOnly viewer cookie or Bearer JWT); `/health` and `/diagnostics` stay anonymous by design.
- **Exact numerics only (D13)**: scipy is a hard engine requirement; the engine module refuses to import without it. There is no approximation fallback anywhere. Every result and persisted run carries `numerics_backend` (exact scipy/numpy versions) for the audit trail.

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
   (C/T/G/K/E/X-rNN, 99 live codes; `RETIRED_CODES` C-12/K-05/T-09 must never
   render as live drivers); evidence cards drill through to the live trend DB
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

### Earlier release notes (condensed, still accurate)

- **v3.6 (June 2026, audit remediation D1–D11):** PSD-valid correlations + spectral config gate; optimizer + Delphi deleted; analytics fixed-then-(v3.7)-deleted; attribution relabels; one-decimal display; provenance chips; GP1-only explorer; MODEL_VERSION 2.7.0. Full record: `docs/governance/DECISION_LOG.md` Part E. Block 8 of this round (Consumer Journey de-blackboxing) is documented in its own section above.
- **Platform line (June 2026):** Next.js 14.2 → **16.2**, React 18 → **19**; Clerk-based auth pages (`app/sign-in`, `app/sign-up`) alongside JWT viewer cookies; repository handover cleanup; CI (GitHub Actions: frontend typecheck/lint/vitest + scipy engine pytest); F1 single source of truth for shift-matrix math (`lib/shiftMatrix.ts`); F4 split of the `app.py` monolith into routers + service + state; F2 read-only online service; F3 authenticated reads; F6 dead-endpoint removal; F10 dynamic-import Beta tabs; Maritime design-system unification.
- **v3.5 (April 2026):** 99-trend base; attenuation + overlap matrices re-derived from the 99-trend exposure space (structured-judgment overlap correction); per-force attenuation replaces every scalar.
- **v3.3 (April 2026):** 14 new trends, 8 re-scorings, 1 consolidation after the MECE coverage review.
- **v3.1 (April 2026):** Bain trend review — 82 trends; horizon extended; later trimmed to 2035 (10-year, post-audit).
- **v3.2 (April 2026):** dead-code cleanup — SensitivityEngine stub, backtesting, Causal DAG / Game Theory references removed; scalar attenuation retired.
- **v3.0:** Production rewrite — Next.js frontend, dual-mode DB, auth, exports.

### Trend Database Composition (v3.5 base, verified June 2026)

**Total: 99 active trends.**

| Force | Count |
|-------|:---:|
| Consumer | 32 |
| Technology | 18 |
| Government | 14 |
| Competitive | 14 |
| Environmental | 11 |
| Customer | 10 |

**Direction split:** 52 Contraction / 47 Expansion — the model preserves its honest bear tilt; under the D16 ceteris-paribus framing, totals read as *exposure if nobody acts*.

### Implementation Status (June 2026, v3.7)

| Module | Status | Notes |
|--------|--------|-------|
| Bayesian Monte Carlo with Gaussian copula | **Production** | Beta priors; Gaussian copula (t-copula deleted, D20); scipy-only (D13); 2.8.1 correctness batch (R1); 2.9.0 VC-epicentre partition (O5) |
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
6. **Ceteris paribus by design** — the simulation propagates external trends only and deliberately excludes management response; a negative total means "headwind to today's business if nothing changes", not "this pool will shrink" (D16).
7. **Structured judgment, not validated forecasting** — no hindcast exists (D9 open); positioning language must never claim predictive validity (F-08).
8. **Delete what isn't needed** — inert dials, unexposed endpoints, approximation layers and stub modules are removed, not maintained (D4/D10/D13/D14/D20).

---

## 2. SYSTEM ARCHITECTURE

```
┌────────────────────────────────────────────────────────────────────┐
│ OFFLINE (owner's machine)                                          │
│   python3 scripts/run_50k_prod.py                                  │
│   ├── loads 99 trends from Neon                                    │
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

`results` bundle: `shift_matrix` (per-category `path` {year: {p10,p25,median/p50,p75,p90,mean,std}} + per-iteration `velocity` bands), `decompositions` (force/vc/region attribution per year — the vc lens is an **epicentre partition** since 2.9.0), `totals` (row/column/grand + **`portfolio`** joint percentiles), `integrity_events`, `seed_stability` (2.8.1+; null on older runs), `meta` (`engine_fidelity`, `numerics_backend`, `seed` (master), `chain_seeds`, `chains`, `model_version`, `engine_name`, `vc_attribution_basis` (2.9.0+; "epicentre"), `persisted_at_utc`, **`trend_fingerprint`** for the next run's drift diff).

Users apply shifts: `GP1_projected = GP1_actual × (1 + shift_median)`.

---

## 3. PYTHON ENGINE (`pulse/`)

**simulation/bayesian_mc.py** — the engine (PRODUCTION, MODEL_VERSION **2.9.0**)
- Beta-distributed priors per trend (α, β from `probability_posterior`)
- **Gaussian copula** over a trend-level correlation matrix built from `within_force_rho` + `force_correlation_matrix` (PSD-valid as entered, D1; repair events surface as integrity events and must NOT fire on defaults)
- Hard scipy requirement; `NUMERICS_BACKEND` constant recorded in every result (D13)
- Per-trend materialization schedules (peak_year × diffusion_curve), multiplicative compounding with per-force attenuation + within-force overlap dampening (zero-trend guard, D21)
- Quantile convention: `np.percentile` linear interpolation, engine-wide (D21)
- `totals.portfolio` joint band (D3); `run_multichain` adds `seed_stability` (M2, owner re-ruling 2026-07-06) + `master_seed`/`chain_seeds` (L8)
- **VC lens = categorical epicentre partition (2.9.0, O5):** one share computation (reused by `decompositions.vc` and the terminal-year `vc_decomposition`); each trend assigned wholly to `vc_epicentre_step_of(vc_exposure)`; no vc_weights; `vc_epicentre_coverage`/`vc_attribution_fallback` integrity events; result carries `vc_attribution_basis`
- 10,000 iterations default; 50,000 × 3 chains in production runs

**simulation/paths.py** — diffusion curves, velocity/acceleration, trigger primitives (PRODUCTION)

**audit/input_drift.py** — D19 fingerprint + drift-event computation (PRODUCTION); **audit/logger.py** — transactional audit log

**config.py / config_validation.py** — taxonomies (6 forces, 12 categories, 8 VC steps, 4 regions), **`vc_epicentre_of`/`vc_epicentre_step_of`** (2.9.0 — engine-side twin of the frontend's `epicentreOf`, parity-pinned), defaults (`DEFAULT_PER_FORCE_ATTENUATION` v3.5, overlap matrices, `DEFAULT_FORCE_CORRELATIONS` v3.6 PSD-valid; `DEFAULT_VC_WEIGHTS` deleted 2.9.0), frozen `ModelConfig` dataclass with tolerant `from_json`; pydantic validator covering **every** engine-consumed layer + `correlation_lambda_min` population spectral gate (D1/D21)

**database.py** — dual-mode (Neon psycopg2 / SQLite); deterministic `ORDER BY id` trend loads (C2); no invented gp1 defaults at any layer (M1); **seed_trends.py** — 99-trend seed; **ingestion/models.py** — Trend dataclasses (`ai_suggested`, `user_override` drive D7 chips). Legacy-schema cleanup: `scripts/migrate_drop_delphi.py` (O1) + `scripts/migrate_drop_legacy.py` (O3/O4), both `--postgres`-gated

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
| `Trends2.tsx` | Trend explorer + admin editor; D7 provenance chips |
| `CategoryDetailPanel.tsx` | Category drill-down drawer (percentile fan, force decomposition, contributing-trend attribution) |
| `ConsumerJourney2.tsx` | Consumer-journey overlay (Laundry 13 / Hair 8 stages from `data/consumerJourney.ts`): "Strategist Read" authored analyses with provenance + grade chips, live trend evidence cards with Trends drill-through, computed stage-attribution chips (`journey_decomposition`, honest empty state), admin tile editing → `/api/journey` |
| `ProfitPoolExplorer.tsx` | Beta, GP1-only pool views (D5). v2 (2026-06-11): arrows = pool development (revenue × GP1 drift, FY2025→2030, derived in `lib/profitPoolData.ts`); Laundry/Hair toggle + view pills; click drill-down decomposes pool CAGR into revenue CAGR + GP1 drift with € pools; all sources clickable URLs verified vs. FY2025 filings, graded ✅ reported / ⚡ derived / ⚠️ estimate. **v3 (2026-07-02): category views rebuilt on the Euromonitor Passport taxonomy** (Hair: 8 Passport categories incl. Salon Professional; Home Care: all 8 categories — Toilet Care & Home Insecticides finally have pool rows); sizes are public triangulations at RSP (Passport internal not shareable — licence), derivation recipes viewer-visible in the source-chip hovers; source ladder EMI → Kline (pro hair, salon-mfr level) → Circana/NIQ (scanner-POS) → filings (MSP) → tier-2; `SourceRef.denomination` guards mixed-basis sums. Audit: `docs/PROFIT_POOL_EXPLORER_SOURCES_AUDIT_2026-07-02.md` (+ the validation worklist xlsx, retained offline by the owner) for eventual Passport confirmation |
| `SettingsModal.tsx` | Config sheet (read-only attenuation/overlap with D17 source tags; D8), auth & sessions. **v2 (2026-07-03): sheet aligned to the real GET/PUT contract** — dead dials deleted (Region select, neutral threshold, base year, residual cross-ρ: never returned by GET, silently dropped by PUT), base year now served read-only by GET; between-force overlap + force correlation matrices rendered read-only (6×6, D17/D1 wording); editable force/region/category weight grids with live Σ badges (backend rejects ≠1.0 ±0.01, no renormalization — the VC weight grid was deleted with the 2.9.0 epicentre partition, O5); diff-only PUT so the audit log records only actual changes; modal scroll fixed (grid row `minmax(0,1fr)`). `neutral_threshold` deleted end-to-end same day (engine-inert since v1; ModelConfig field, validator, defaults, router call, test fixture, TS type — `from_json` tolerates it in old snapshots) |
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

Tables: `trends`, `trend_category_exposure`, `trend_vc_exposure`, `trend_regional_exposure`, `trend_sources`, `trend_score_proposals` (multi-expert proposals layer, June 2026), `journey_content` (versioned admin tile-map blobs), `simulation_runs` (results bundle incl. integrity events, seed stability + fingerprint), `config_snapshots`, `triggers`, `ai_suggestions`, `audit_log`, `session_snapshots` (capped per M12). Removed 2026-07-07 (O3/O4, via `scripts/migrate_drop_legacy.py` — run once per database): `trend_journey_exposure`, `users` (engine-side legacy; identity is Clerk, roles live in the Next-managed `user_roles` table), `scanned_trends`, and the `simulation_runs.allocation_recommendation` column. `delphi_rounds` **and** the delphi-era `trends` columns (`scorer_count/score_variance/debiasing_applied`) are **dropped** by `scripts/migrate_drop_delphi.py` (archives JSON first; extended per owner ruling O1, 2026-07-07 — run it once per database). `users.password_hash/password_salt` remains as a harmless non-delphi legacy pair nothing reads or writes (dropping it is a DX-scheduled migration — HANDOVER.md §7).

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
GET|PUT       /api/v1/config                              (PUT: admin; full-layer validation + spectral gate)
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

# Production run (owner machine; .env carries the Neon URL)
python3 scripts/run_50k_prod.py    # persists a NEW run row (previous rows kept for diff)

# Deploy: Vercel preview first, then production. The dashboard renders the
# latest persisted run; re-run the CLI after engine-version bumps so the
# persisted run matches MODEL_VERSION (expect small median changes across
# version bumps — D1/D20 honesty corrections, version-stamped).
```

---

## 9. VISUAL DESIGN SYSTEM

Maritime light editorial system (June 2026 unification): light surfaces, deep-navy primary `#00345E`, expansion `#1f7a3d` / contraction `#9f403d` (muted semantic pair, exec-audience recalibration June 2026 — single source: `lib/format.ts` `EXPANSION`/`CONTRACTION` (+ `*_RGB` tokens for custom alphas, L10); every shift number renders via `components/dashboard/ShiftValue.tsx` or `shiftColor()` with a visible sign/arrow so direction never relies on colour alone), Inter body + tabular numerals for data. Force colors (ONE palette, `lib/format.ts` `FORCE_COLORS` — the bright legacy palette was retired with L11): Consumer `#005db5`, Customer `#6b4fc4`, Technology `#0e8aa8`, Government `#b07d2b`, Environmental `#2f8f4e`, Competitive `#b0504a`. Category/brand mapping unchanged (Hair: Color/Care/Styling/Body; LHC: FCN/FCA/FFI/LAD/HDW/ADW/HSC/IC — Schwarzkopf, Gliss, Taft, Fa, Persil, Perwoll, Silan, Pril, Somat, Bref, …).

---

## 10. TESTING

`tests/`: `conftest.py` (fixture differentiated per L29 — golden-pinned categories are pairwise distinct, one trend carries a per-trend materialization schedule, and the five DB trends carry canonical VC profiles with distinct epicentres + one deliberate collision, 2.9.0), `test_bayesian_mc.py`, `test_golden_pipeline.py` (determinism + golden pins (2.8.1 values, passing unchanged on 2.9.0 — the VC rework never touched shift math) incl. the joint portfolio band + no-repair-on-defaults + version sync + **2.9.0 VC structural locks**: reconciliation, categorical-partition leak test, coverage event, basis tag; pins regenerate ONLY with deliberate model changes, same commit), `test_vc_epicentre.py` (**parity fixture table with `tests/frontend/vcEpicentre.test.ts`** — Python `vc_epicentre_of` and TS `epicentreOf` must never drift; plus drift-"ve" semantics), `test_properties.py` (hypothesis), `test_api.py` (endpoint behavior incl. F2 409-guard + D13 backend tag), `test_input_drift.py` (D19), `test_ops.py` (M10: prod-entrypoint import, H1 wrong-DB-mode exit, CLI parser, Excel writer round-trip, M4 diagnostics-outage). Frontend: `tests/frontend/` via vitest (`normalizeSimulation`, shift-matrix math, format/display-honesty pins, auth-seam, journey dialog, tab smoke, vcEpicentre parity).

---

## 11. AUDIT TRAIL & GOVERNANCE

- **Governance record (in-repo since v3.8, H5/R4):** `docs/governance/` — `DECISION_LOG.md` (D1–D21 + Sobol rider + O1–O5, full text + execution records; Part G = the 2026-07-10 VC-epicentre ruling), `FINDINGS_REGISTER.md` (open-by-decision: F-08 (D9), F-09 (D15), F-20 (D18); resolved-by-deletion: F-02..05/F-10/F-12/F-17/F-18/F-22; resolved: F-01 (D1), F-13/F-16 (D3), F-15 (D19), F-19 (D17), F-21 (D16 positioning), F-23/F-25 (D21), F-26 (files re-verified), F-27 (D8)), `CODE_REVIEW_2026-07-01_DECISIONS.md` and `REMEDIATION_2026-07-06.md` (R1–R4 + full disposition table).
- **Verification artifacts** (incl. `v8_d20_tcopula_df_out.txt`, D20 evidence) are retained offline by the owner; available on request.
- Every persisted run carries: master seed + chain seeds, chains, model version, engine fidelity, numerics backend, trend fingerprint, integrity events (incl. input drift), seed stability (2.8.1+).

### RACI (unchanged)
Trend scoring & score overrides: Category Leads (R) / Strategy VP (A). Config changes: admin-only, audited, reason-logged. AI suggestions: never auto-applied (D7 chips until reviewed).

---

## 12. RISK REGISTER (v3.8 live items)

| Risk | Mitigation |
|------|------------|
| Persisted run lags engine version after a bump — **live right now: the persisted run is pre-2.9.0 until the next 50k CLI run** | Run ribbon shows model_version; re-run CLI after deploys (gate); until then the footer reads "profile-weighted (pre-2.9 run)" for the VC basis (and "not recorded" for seed stability if the run also predates 2.8.1) |
| No predictive validation (accepted, D9) | Position as structured judgment; revisit at first board citation |
| One-sided trend grammar understates uncertainty (accepted, D15) | Disclosed; bands labeled as listed-trend magnitude uncertainty |
| Neon connection limits / cold starts | Pooled connections, lazy init retry, SQLite locally |
| JWT secret exposure | Env vars only; rotate ALL credentials at handover (packaging checklist) |
| Legacy DB columns (`users.password_*`, delphi-era trend columns) | Inert — nothing reads/writes them; drop via DX-scheduled migration |

---

*Document Version: 3.9 — July 2026 (VC epicentre attribution O5; MODEL_VERSION 2.9.0)*
*Author: Strategy × Technology × Quant Partnership*
*Classification: CONFIDENTIAL — Internal Use Only*
*Methodology: Beta-shaped structured-judgment priors (set from analyst 1–5 scores — magnitude-uncertainty only, NOT updated from data; T7 June 2026) + Gaussian copula dependencies + structured-judgment overlap correction + input-drift telemetry. Ceteris paribus: the engine holds strategy constant; strategic response belongs to the reader.*
