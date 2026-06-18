# PRISM — Profit Pool Risk & Intelligence Simulation Model

## Project Specification & Architecture — v3.7

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

### What Changed in v3.7 (vs. v3.6) — Second Ruling Round, June 2026

Executed against owner decisions **D12–D21** (ruled 2026-06-10; recorded with full text in `audit/strategy-review/06_DECISION_LOG_AND_WORK_ORDER.md`, Part A addendum). MODEL_VERSION bumped to **2.8.0**. One changelog block covering the full D1–D21 remediation:

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
18. **D20 (F-10) — t-copula deleted; Gaussian copula.** Post-D1 re-test (`audit/strategy-review/verification/v8_d20_tcopula_df_out.txt`): df 4 → ∞ moves the portfolio P10–P90 band <2% on PSD-valid defaults — the tail dial was marketed complexity with no observable output effect. The engine now runs a Gaussian copula; the `t_copula_df` parameter is gone from config/validator/API/UI/docs. (`ModelConfig.from_json` tolerates the retired field in old snapshots.)
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
   chips ✍️ strategist-authored / ✨ AI-suggested (46 tiles, pending review)
   with evidence grades ✅/⚡/⚠️; scope banner: the qualitative overlay does
   not feed the Shift Matrix.
2. **Content out of code** — 300 tiles + stage contexts live in
   `data/consumerJourney.ts` (`JOURNEY_CONTENT_VERSION`); admin edits persist
   via `GET|PUT /api/v1/journey` (Next proxy `/api/journey`) into the
   versioned `journey_content` table.
3. **Real trend linkage** — canonical code↔ID map `data/trendCodeMap.ts`
   (C/T/G/K/E/X-rNN, 99 live codes; `RETIRED_CODES` C-12/K-05/T-09 must never
   render as live drivers); evidence cards drill through to the live trend DB
   (`Trends2` `initialSearch`).
4. **Quantitative layer** — `journey_exposure` (99 trends × 260 stage scores,
   `trend_journey_exposure`; seed `pulse/seed_journey_exposure.py`, derived
   from tile intensities {1→2, 2→3, 3→5}; stage keys `"<journey>:<stage_id>"`
   per `JOURNEY_STAGES` in `pulse/config.py`: LHC 13 / Hair 8) and
   **`journey_decomposition`** in the engine — terminal-year MC-median per
   category redistributed across its journey's stages (same construction as
   `vc_decomposition`; per-category stage sums reconcile with the
   terminal-year median exactly; redistributes, never changes totals). No
   MODEL_VERSION bump: an additive attribution lens; 2.8.0 golden pins
   unaffected.

Activation requires `scripts/backfill_journey_exposure.py` (non-destructive)
against prod, then a fresh `scripts/run_50k_prod.py` — until then the journey
attribution chips show their honest empty states.
Open backlog (owner-gated): strategist review of the 46 ✨ tiles + 260
exposure scores; internal validation of Henkel claims in stage contexts; Home
Care journey (tab honestly reads "Laundry" until then); optional per-year
journey decomposition.

### Earlier release notes (condensed, still accurate)

- **v3.6 (June 2026, audit remediation D1–D11):** PSD-valid correlations + spectral config gate; optimizer + Delphi deleted; analytics fixed-then-(v3.7)-deleted; attribution relabels; one-decimal display; provenance chips; GP1-only explorer; MODEL_VERSION 2.7.0. Full record: `audit/strategy-review/06` Part E. Block 8 of this round (Consumer Journey de-blackboxing) is documented in its own section above.
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
| Bayesian Monte Carlo with Gaussian copula | **Production** | Beta priors; Gaussian copula (t-copula deleted, D20); scipy-only (D13) |
| Continuous path modeling | **Production** | 5 MECE diffusion curves, 2026–2035, velocity per iteration |
| Joint portfolio band + seed stability | **Production** | `totals.portfolio` + `seed_stability` (D3) |
| Input-drift telemetry | **Production** | `pulse/audit/input_drift.py` (D19) |
| Consumer-journey decomposition + content store | **Production** | `journey_decomposition` (engine) + `journey_content` admin store; v3.6 block 8, restored 2026-06-10 |
| AI layer (scanner, narrator, calibrator) | **Dormant** | Modules exist; scanner routes unmounted, chat endpoint removed |
| Excel export (Shift Matrix QA workbook) | **Production** | Written by `run_50k_prod.py`; D16/D17 wording included |
| PPTX / Power BI export modules | **Ad-hoc only** | No live API route; callable from Python directly |
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
│  │            competitors / misc                                   │
│  ├── F2: never simulates (409 without scipy); F3: auth on reads    │
│  └── NEON POSTGRES (trends, simulation_runs, config, users, audit) │
└────────────────────────────────────────────────────────────────────┘

LOCAL DEV: python -m pulse --serve (FastAPI :8000, SQLite data/prism.db)
           npm run dev (Next.js :3000)
```

### The Shift Matrix contract (per persisted run)

`results` bundle: `shift_matrix` (per-category `path` {year: {p10,p25,median/p50,p75,p90,mean,std}} + per-iteration `velocity` bands), `decompositions` (force/vc/region attribution per year), `journey_decomposition` (terminal-year journey-stage attribution per category, v3.6 block 8), `totals` (row/column/grand + **`portfolio`** joint percentiles), `integrity_events`, `seed_stability`, `meta` (`engine_fidelity`, `numerics_backend`, `seed`, `chains`, `model_version`, `engine_name`, `persisted_at_utc`, **`trend_fingerprint`** for the next run's drift diff).

Users apply shifts: `GP1_projected = GP1_actual × (1 + shift_median)`.

---

## 3. PYTHON ENGINE (`pulse/`)

**simulation/bayesian_mc.py** — the engine (PRODUCTION, MODEL_VERSION **2.8.0**)
- Beta-distributed priors per trend (α, β from `probability_posterior`)
- **Gaussian copula** over a trend-level correlation matrix built from `within_force_rho` + `force_correlation_matrix` (PSD-valid as entered, D1; repair events surface as integrity events and must NOT fire on defaults)
- Hard scipy requirement; `NUMERICS_BACKEND` constant recorded in every result (D13)
- Per-trend materialization schedules (peak_year × diffusion_curve), multiplicative compounding with per-force attenuation + within-force overlap dampening (zero-trend guard, D21)
- Quantile convention: `np.percentile` linear interpolation, engine-wide (D21)
- `totals.portfolio` joint band (D3); `run_multichain` adds `seed_stability` (D3)
- 10,000 iterations default; 50,000 × 3 chains in production runs

**simulation/paths.py** — diffusion curves, velocity/acceleration, trigger primitives (PRODUCTION)

**audit/input_drift.py** — D19 fingerprint + drift-event computation (PRODUCTION); **audit/logger.py** — transactional audit log

**config.py / config_validation.py** — taxonomies (6 forces, 12 categories, 8 VC steps, 4 regions), defaults (`DEFAULT_PER_FORCE_ATTENUATION` v3.5, overlap matrices, `DEFAULT_FORCE_CORRELATIONS` v3.6 PSD-valid), frozen `ModelConfig` dataclass with tolerant `from_json`; pydantic validator covering **every** engine-consumed layer + `correlation_lambda_min` population spectral gate (D1/D21)

**database.py** — dual-mode (Neon psycopg2 / SQLite); **seed_trends.py** — 99-trend seed; **ingestion/models.py** — Trend dataclasses (`ai_suggested`, `user_override` drive D7 chips)

**ai/** — provider abstraction (Claude/Azure/Ollama), scanner, narrator, calibrator (dormant: not mounted in the live API)

**excel_bridge/** — `writer.py` (QA workbook with D16 READING NOTE + D17 provenance wording + D13 numerics backend; allocation sheet removed), `export_center.py` / `powerbi_export.py` + `api/export_pptx.py` (ad-hoc, no live route)

**api/** — `app.py` (assembly only), `state.py`, `serialization.py`, `models.py`, `services/simulation_service.py` (single rehydration implementation incl. integrity events, seed stability + journey decomposition), `auth.py` (JWT dependencies), `routers/{system,trends,simulation,config,competitors,misc,journey}.py` (journey mounted since the 2026-06-10 restore: GET/PUT `/api/v1/journey` content store), `routes/{auth,scanner}.py` (legacy, unmounted)

---

## 4. FRONTEND (Next.js 16 / React 19 / TS 5.7)

**Pages (`app/`):** dashboard, login/register + Clerk sign-in/sign-up, forgot/reset-password, `api/` proxy routes.

**Dashboard components (`components/dashboard/`, 10):**

| Component | Purpose |
|-----------|---------|
| `ProfitPoolAnalysis2.tsx` | Shift Matrix, four lenses; lean KPI strip above the matrix (portfolio shift + least/most contracting category; P10–P90 on hover only — owner declutter 2026-06-11, replaces the hero block); short D16 caption under the section intro; run provenance, seed stability + integrity events (D19) rendered flat inside the About-this-model footer (header ribbon/popovers removed) |
| `Trends2.tsx` | Trend explorer + admin editor; D7 provenance chips |
| `CategoryDetailPanel.tsx` | Category drill-down drawer (percentile fan, force decomposition, contributing-trend attribution) |
| `ConsumerJourney2.tsx` | Consumer-journey overlay (Laundry 13 / Hair 8 stages from `data/consumerJourney.ts`): "Strategist Read" authored analyses with provenance + grade chips, live trend evidence cards with Trends drill-through, computed stage-attribution chips (`journey_decomposition`, honest empty state), admin tile editing → `/api/journey` |
| `ProfitPoolExplorer.tsx` | Beta, GP1-only pool views (D5). v2 (2026-06-11): arrows = pool development (revenue × GP1 drift, FY2025→2030, derived in `lib/profitPoolData.ts`); Laundry/Hair toggle + view pills; click drill-down decomposes pool CAGR into revenue CAGR + GP1 drift with € pools; all sources clickable URLs verified vs. FY2025 filings, graded ✅ reported / ⚡ derived / ⚠️ estimate |
| `SettingsModal.tsx` | Config sheet (read-only attenuation/overlap with D17 source tags; D8), auth & sessions |
| `WelcomeModal.tsx`, `ErrorBoundary.tsx`, `LoadingSkeleton.tsx` | Shell |

**State:** `hooks/usePrism.ts` — single provider; renders the latest persisted run; no in-app simulate. **API client:** `api/client.ts` (typed; `normalizeSimulation` unit-tested). **Math:** `lib/shiftMatrix.ts` is the single source of truth for category-weighted aggregation (F1; enforced by `scripts/check_shiftmatrix_single_source.sh` in `npm run lint`).

**Types (`types/`):** index, trends, simulation (incl. `TotalsMatrix.portfolio`, `IntegrityEvent`, `SeedStability`, `RunMeta.numerics_backend`), config, api. (`analytics.ts` and `delphi.ts` deleted.)

**Legacy Vite dashboard (`pulse/dashboard/`):** dev-only relic served by `python -m pulse --serve`; excluded from deploys; analytics/Delphi surfaces removed.

---

## 5. TECH STACK

Frontend: Next.js 16.2 · React 19.2 · TypeScript 5.7 · Tailwind 3.4 · D3 7.9 · Recharts 2.15 · Framer Motion 12 · Clerk · Neon serverless driver · vitest 4.
Backend: fastapi · pydantic v2 · numpy · **scipy (hard requirement, D13)** · openpyxl · python-pptx (ad-hoc) · psycopg2-binary · pytest/hypothesis. SALib removed (D14).
Serverless (`api/requirements.txt`): fastapi, pydantic, numpy, psycopg2-binary, aiohttp, feedparser, requests — **no scipy by design**: that runtime is read-only (F2/D13).

---

## 6. DATABASE SCHEMA (production truth)

Tables: `trends`, `trend_category_exposure`, `trend_vc_exposure`, `trend_journey_exposure`, `journey_content` (versioned admin tile-map blobs), `simulation_runs` (results bundle incl. integrity events + fingerprint; `allocation_recommendation` column legacy-NULL), `config_snapshots`, `triggers`, `ai_suggestions`, `audit_log`, `users`, `session_snapshots`. `delphi_rounds` is **dropped** by `scripts/migrate_drop_delphi.py` (archives JSON first); `trends.scorer_count/score_variance/debiasing_applied` remain as harmless legacy columns nothing writes.

---

## 7. REST API (live route table, verified June 2026)

```
GET           /api/v1/health, /api/v1/diagnostics        (anonymous)
GET           /api/v1/simulation, /api/v1/simulation/status
POST          /api/v1/simulate                            (admin; 409 without scipy — F2/D13)
GET|POST|PUT|DELETE /api/v1/trends[/{id}|/sync|/full-reseed|/revert-to-seed]
GET|PUT       /api/v1/config                              (PUT: admin; full-layer validation + spectral gate)
GET|PUT       /api/v1/journey                            (GET via authed Next proxy /api/journey; PUT admin — journey content store)
GET           /api/v1/forces, /api/v1/audit/log
GET           /api/v1/competitors[/intelligence|/{id}]
GET|POST      /api/v1/snapshots[/{id}]
POST          /api/v1/seed
```
Removed vs. earlier specs: `/analytics/*` (D14), `/delphi/*` (D10), `/optimize/allocation` (D4), `/scanner/*` (unmounted), `/chat` (owner decision), `/sensitivity/*` (v3.2), `/export/*` (F6 — exports are produced by the CLI run).

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

Maritime light editorial system (June 2026 unification): light surfaces, deep-navy primary `#00345E`, expansion `#1f7a3d` / contraction `#9f403d` (muted semantic pair, exec-audience recalibration June 2026 — single source: `lib/format.ts` `EXPANSION`/`CONTRACTION`; every shift number renders via `components/dashboard/ShiftValue.tsx` with a ▲/▼ arrow so direction never relies on colour alone), Inter body + tabular numerals for data. Force colors: Consumer `#3B82F6`, Customer `#8B5CF6`, Technology `#06B6D4`, Government `#F59E0B`, Environmental `#22C55E`, Competitive `#EF4444`. Category/brand mapping unchanged (Hair: Color/Care/Styling/Body; LHC: FCN/FCA/FFI/LAD/HDW/ADW/HSC/IC — Schwarzkopf, Gliss, Taft, Fa, Persil, Perwoll, Silan, Pril, Somat, Bref, …).

---

## 10. TESTING

`tests/`: `conftest.py`, `test_bayesian_mc.py`, `test_golden_pipeline.py` (determinism + **2.8.0 golden pins** + structural identities; pins regenerate ONLY with deliberate model changes, same commit), `test_properties.py` (hypothesis), `test_api.py` (endpoint behavior incl. F2 409-guard + D13 backend tag), `test_input_drift.py` (D19), `test_scanner_routes.py` was relocated to the non-live quarantine (2026-06-14) — it imported scanner symbols that no longer exist and broke pytest collection under CI conditions (httpx present); rewrite it against the current scanner API when the AI layer is revived. Frontend: `tests/frontend/` via vitest (`normalizeSimulation`, shift-matrix math).

---

## 11. AUDIT TRAIL & GOVERNANCE

- **Decision log:** `audit/strategy-review/06_DECISION_LOG_AND_WORK_ORDER.md` — D1–D11 (Part A), **D12–D21 + Sobol rider (Part A addendum)**, execution records (Part E).
- **Findings register:** `audit/strategy-review/02_FINDINGS_REGISTER.md` — open-by-decision: F-08 (D9), F-09 (D15), F-20 (D18); resolved-by-deletion: F-02..05/F-10/F-12/F-17/F-18/F-22; resolved: F-01 (D1), F-13/F-16 (D3), F-15 (D19), F-19 (D17), F-21 (D16 positioning), F-23/F-25 (D21), F-26 (files re-verified), F-27 (D8).
- **Verification artifacts:** `audit/strategy-review/verification/` incl. `v8_d20_tcopula_df_out.txt` (D20 evidence).
- Every persisted run carries: seed, chains, model version, engine fidelity, numerics backend, trend fingerprint, integrity events (incl. input drift), seed stability.

### RACI (unchanged)
Trend scoring & score overrides: Category Leads (R) / Strategy VP (A). Config changes: admin-only, audited, reason-logged. AI suggestions: never auto-applied (D7 chips until reviewed).

---

## 12. RISK REGISTER (v3.7 live items)

| Risk | Mitigation |
|------|------------|
| Persisted run lags engine version after a bump | Run ribbon shows model_version; re-run CLI after deploys (gate) |
| AI hallucinations in dormant scanner/narrator if re-enabled | Human-in-the-loop, provenance chips, never auto-applied |
| No predictive validation (accepted, D9) | Position as structured judgment; revisit at first board citation |
| One-sided trend grammar understates uncertainty (accepted, D15) | Disclosed; bands labeled as listed-trend magnitude uncertainty |
| Neon connection limits / cold starts | Pooled connections, lazy init retry, SQLite locally |
| JWT secret exposure | Env vars only |

---

*Document Version: 3.7 — June 2026 (second ruling round D12–D21; MODEL_VERSION 2.8.0)*
*Author: Strategy × Technology × Quant Partnership*
*Classification: CONFIDENTIAL — Internal Use Only*
*Methodology: Bayesian hierarchical priors + Gaussian copula dependencies + structured-judgment overlap correction + input-drift telemetry. Ceteris paribus: the engine holds strategy constant; strategic response belongs to the reader.*
