# PRISM — Developer Handover (Henkel DX)

**Audience:** the full-stack developer taking over hosting, operations and further development of PRISM.
**Status:** v3.10 · MODEL_VERSION 2.10.0 · reconciled against the tree 2026-08-25
**Reading order:** `00_INTEGRATION_GUIDE.md` (folder map, 10 minutes) → this file → `CLAUDE.md` (the developer handbook and single source of truth) → `README.md` (local setup) → `docs/governance/` (why the system is the way it is) → `CONCEPT_PRISM_ONLINE_AI.md` (target state for the Henkel-hosted, AI-enabled version).

---

## 1. What you are taking over

PRISM is a profit-pool simulation platform for Henkel Consumer Brands category strategy: 51 scored external drivers (the **Profit Pool Drivers**, "Drivers" in the app; the code still calls them trends, see §6.14) → Bayesian Monte-Carlo engine (Beta priors, Gaussian copula, scipy) → a **Shift Matrix** of relative percentage impacts per category × **region** × force × year (2026–2035), rendered in a Next.js 16 "War Room" dashboard.

Since 2.10.0 the shift is genuinely three-dimensional: the engine solves 52 composite cells (13 categories × 4 regions — 13 categories since 2.12.0 split Toilet Care out of Hard-Surface Cleaner, owner ruling O13) and each driver's contribution to a cell is weighted by **both** its category exposure and its regional exposure. The category and portfolio numbers you see are the region-GP1-share-weighted roll-up of that tensor. A driver that is globally present reproduces the old, non-regional category number exactly — only *regional concentration* moves the numbers.

Three things it deliberately is **not** (these are owner decisions, not gaps):

1. **Not a forecaster.** It is positioned as *structured judgment*; there is no hindcast/validation claim, and none may be added to UI copy (decision D9/F-08).
2. **Not a € calculator.** The engine outputs relative shifts only; users apply them to their own financials. The GP1-only Beta explorer is the single sanctioned exception (D5).
3. **Not an autopilot.** Everything is ceteris paribus — no management response modeled (D16). AI-suggested content is never auto-applied; provenance chips track review state (D7).

`CLAUDE.md` explains every such decision (D1–D21, R1–R4, O1–O15). Read its §1 fully before changing model code; the full decision log lives in `docs/governance/`.

## 2. The operating model — the one mental model you need

```
┌── OFFLINE (operator machine / future: scheduled job) ─────────────┐
│  python3 scripts/run_50k_prod.py                                  │
│  → loads the 51 drivers from Postgres (Neon), ORDER BY id (O10)   │
│  → pre-flight spectral gate on the LOADED mix (F6; exit 5)        │
│  → optional --cell-weights FILE (gross-profit shares, O6)         │
│  → BayesianMonteCarloEngine.run_multichain(3 × 50k, scipy)        │
│    chains are POOLED for the published percentiles (F7)           │
│  → input-drift diff vs previous run                               │
│  → persists results bundle as a simulation_runs row               │
│  → writes QA Excel to repo root                                   │
└───────────────────────────────────────────────────────────────────┘
                       │  persisted run (relative % only)
┌── VERCEL (production) ── READ-ONLY ───────────────────────────────┐
│  Next.js 16 frontend + Python serverless adapter (api/index.py)   │
│  Renders the LATEST persisted run. It never simulates:            │
│  POST /api/v1/simulate → 409 on any runtime without scipy (F2)    │
│  api/requirements.txt has NO scipy — by design (D13)              │
└───────────────────────────────────────────────────────────────────┘
```

Why it is built this way: exact scipy numerics are a hard requirement (D13 — the engine module refuses to import without scipy; there is no approximation fallback). Vercel's Python serverless runtime doesn't carry scipy here, so computation happens offline and the deployed service is a read-only renderer of persisted runs. **If you move the app to Henkel infrastructure, you may relocate the compute — but never into a runtime without scipy, and never as silently-approximated math.** The concept document describes the intended future: same engine, containerized, job-triggered.

Consequence for operations: after every engine-version bump, re-run the CLI so the persisted run matches `MODEL_VERSION` (the run ribbon in the dashboard shows the mismatch).

## 3. System map

| Layer | Tech | Where |
|---|---|---|
| Frontend | Next.js 16.2 / React 19.2 / TS 5.7 / Tailwind 3.4 / Recharts 2.15 | `app/`, `components/dashboard/` (12 files — the four tab views, the category drill-down drawer, the config modal, plus shell and shared cells), `hooks/usePrism.ts` (single data provider), `lib/shiftMatrix.ts` + `lib/format.ts` (lint-enforced single sources for shift math and shift display) |
| Auth | Clerk (identity) + short-lived HS256 JWT bridge to the engine | `app/sign-in`, `lib/prismJwt.ts`, `pulse/api/auth.py`, `proxy.ts` (Next 16 middleware replacement) |
| API | FastAPI, assembled in `pulse/api/app.py` from 7 routers | `pulse/api/routers/{system,trends,simulation,config,competitors,misc,journey}.py`; live route table in `CLAUDE.md` §7 |
| Engine | Python 3.10+, numpy + **scipy (hard req)** | `pulse/simulation/bayesian_mc.py` (MODEL_VERSION **2.10.0**), `paths.py`, `pulse/audit/input_drift.py` |
| Persistence | Neon Postgres (prod) / SQLite (local) — dual-mode | `pulse/database.py`; schema in `CLAUDE.md` §6 |
| Exports | QA Excel written by the CLI run (round-trip-tested, M10) | `pulse/excel_bridge/writer.py` — the only artifact export |
| AI layer | **Removed** (owner decision R2, 2026-07-06: broken import, no live route, open security findings) | Future AI = fresh build per `CONCEPT_PRISM_ONLINE_AI.md`; the suggest-only governance (D7 chips) carries over unchanged |
| CI | GitHub Actions: frontend (typecheck/lint/vitest) + engine (pytest, installed from requirements-dev.txt) | `.github/workflows/ci.yml` |

Current production (to be migrated): Vercel project `prism-profit-pool` (org `lakeralexander-8859s-projects`), URL `https://prism-hcb.vercel.app`, GitHub `AlexanderLaker/PRISM` (renamed from `PULSE` on 2026-08-28 — GitHub redirects the old URL), DB Neon, auth Clerk. All four are personal accounts of the current owner — migration targets are in the concept document.

## 4. Day 1 — local environment

```bash
# prerequisites: Node 22.x, Python 3.10+
npm install
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt          # full dev set incl. scipy, pytest
cp .env.example .env                         # fill in (table in README.md)

# run (two terminals)
python -m uvicorn pulse.api.app:app --reload --port 8000   # engine (SQLite fallback)
npm run dev                                                 # frontend :3000

# quality gates — run before every push; CI runs the same
npm run verify   # typecheck + eslint + single-source check + vitest + pytest
```

Local quirks worth knowing on day 1:

- **`PRISM_JWT_SECRET` is one shared secret, read by both sides of the bridge** — the Next.js proxy (`lib/prismJwt.ts`) signs with it and the FastAPI engine (`pulse/api/auth.py`) verifies with it. It must be ≥32 characters. If the two processes see different values you get 401s on every data call and nothing else. There is no separate `JWT_SECRET`; earlier docs referred to one, but no such variable is read anywhere in the tree.
- **Activate the virtualenv before `npm run verify`.** `npm run test:py` calls plain `python3`; without the venv active that resolves to your system Python, which has no pytest, and the run fails with a misleading "No module named pytest".
- Without Postgres, the engine falls back to SQLite at `data/prism.db` (`PRISM_DB_PATH` overrides). Either `DATABASE_URL` or `POSTGRES_URL` selects Postgres mode — `POSTGRES_URL` wins if both are set. Real shell environment variables win over `.env` (M17), so you can redirect a single run from the command line.
- `npm run lint` includes `scripts/check_shiftmatrix_single_source.sh` — it fails the build if shift-matrix aggregation math (any declaration style, or a raw category-weights lookup) appears anywhere except `lib/shiftMatrix.ts`. That is intentional (F1/M5).

## 5. Operations runbook

**Canonical production run** (currently from the operator's machine; `.env` must contain the prod database URL):

```bash
python3 scripts/run_50k_prod.py [--cell-weights FILE]
# 51 drivers from prod DB → pre-flight spectral gate → 3 × 50k multichain
# (pooled) → input-drift event → persists a NEW simulation_runs row →
# QA Excel at repo root (~2–6 min)
# Exit codes (H2): 0 ok · 1 no DB URL · 2 no drivers · 3 PERSIST FAILED ·
# 4 wrong DB mode (Postgres URL set but SQLite active — H1) ·
# 5 correlation matrix not PSD on the loaded driver mix (F6) ·
# 6 cell-weights file rejected (O6).
# --iterations/--chains for test runs; --allow-sqlite for a LOCAL test;
# --allow-nonpsd to override the spectral gate deliberately.
# --cell-weights FILE: the actual HCB gross-profit shares per category x
#   region (JSON: {"source": "...", "basis": "gp1_share" | "gp1_absolute",
#   "cells": {category: {region: value}}}); absolute figures are normalised
#   to shares before the engine is built and are never persisted. Keep the
#   file OUTSIDE the repository. Without it the run falls back to the O14
#   ESTIMATED HCB mix — 13 × 4 = 52 cells, built from public reporting and
#   graded B/E/G, NOT Henkel P&L. The file always overrides the default; O14
#   changed only the fallback. The flat grid is pulse.config.EQUAL_CELL_WEIGHTS.
```

**Do this once after deploying 2.11.0, in this order:**

1. `python3 scripts/replace_trend_base.py --dry-run` (local SQLite), then
   `python3 scripts/replace_trend_base.py`, then the same against Neon with
   `--postgres`. Archive-first (trends, exposures, sources and expert
   proposals to `data/archive/`), deletes the retired ids, writes the 51
   reviewed drivers, restores the kept ids' proposals, verifies, writes an
   audit-log entry. The archive is the rollback. Until this runs the CLI
   warns loudly that the base has 99 drivers instead of 51.
2. `python3 scripts/run_50k_prod.py` (add `--cell-weights FILE` once the P&L
   shares exist). The first 2.11.0 run reports the mass replacement as a
   critical input-drift event by design (D19). **Expect the numbers to move
   for three stamped reasons** — the 51-driver base, the v3.11 calibration
   and the equal 1/48 cell weights; the acceptance-run delta table in the
   release summary separates them.

Until both steps are done the dashboard renders the older run and labels it
honestly (no cell-weight block in the About footer; footer totals fall back
to the config's derived category weights).

**After the 2.12.0 bump (O13 + O14, 2026-09-11)** no base replacement is due —
the base is still the same 51 drivers — but re-run `scripts/run_50k_prod.py` so
the persisted run matches `MODEL_VERSION`. Its numbers move for three stamped
reasons: the 13-category taxonomy, the v3.12 recalibration the taxonomy change
forces (the overlap correction is computed from the drivers' category exposure
vectors, so a new category changes its input space), and the O14 estimated HCB
cell-weight default. The first two leave the headline where it was — −4.34%
[−4.80, −3.80] against −4.35% [−4.81, −3.80] on the 12-category equal-1/48
basis; the split resolves a blend. The third moves it: **expect a terminal-year
portfolio of about −5.58% [−6.16, −4.89]**, not −4.34%, because the estimate
puts 51.4% of the pool in Europe (−7.11%) against the equal grid's 25%. Roughly
four fifths of the gap is the regional mix, not the category mix. The mix is an
ESTIMATE from public reporting, not Henkel P&L, and it does not replace the
finance figures — pass `--cell-weights FILE` the moment they exist.

Previous run rows are kept — the input-drift telemetry (D19) diffs each run against the previous run's driver fingerprint (`trend_fingerprint`) and surfaces "N driver score(s) changed" in the run-integrity list of the About-this-model footer.

**Deploy:** push to `main` → Vercel auto-builds (~2 min). Preview deploys for branches. Rollback: `git revert` + push, or promote a prior deployment in the Vercel dashboard.

**Smoke test after deploy:**

```bash
curl -s https://prism-hcb.vercel.app/api/v1/health | jq '.status, .trend_count'   # "ok", 51 (99 until the base is replaced)
# /api/v1/simulation requires auth (viewer cookie or Bearer JWT) — verify via the dashboard
```

**Other ops scripts** (`scripts/`): `replace_trend_base.py` (O10 — archive-first move of a database onto the 51-driver base, see above), `generate_seed_from_core_set.py` (regenerates `pulse/seed_trends.py` + `data/trendCodeMap.ts` from `data/trend_base_2026-09/`; `--check` in CI), `build_estimated_cell_weights.py` (O14 — writes `data/cell_weights_estimated_v1.json` and the generated `lib/cellWeightProvenance.ts`, emits the literal for `pulse/config.py`; `--check` in CI gates both committed outputs), `compute_attenuation_v3_12.py` + `build_attenuation_xlsx.py v3_12` (O13 calibration record and workbook — re-run whenever the category taxonomy changes, because the overlap correction is derived from the drivers' category exposure vectors; the v3_11 pair that preceded it is kept as the 2.11.0 record), `migrate_drop_delphi.py` (O1 — archives-then-drops the `delphi_*` tables + delphi-era trend columns) and `migrate_drop_legacy.py` (O3/O4 — archives-then-drops `trend_journey_exposure`, the legacy `users` and `scanned_trends` tables and the `allocation_recommendation` column). The migration and replacement scripts REFUSE a Postgres target without an explicit `--postgres` flag; run each once against prod, only AFTER deploying this code. The exception is `apply_driver_vocabulary.py` (O15: archive-first move of a database's authored content, the Consumer Journey server copy and four driver texts, onto the Driver vocabulary; one compare-and-swap transaction, idempotent, `--postgres` required for Neon), which runs right BEFORE the production deploy that ships O15; after the deploy, admins reload any open PRISM page before they edit, and a `--dry-run` must report nothing to change (DEPLOY.md). `promote_admin.py` (role promotion).

## 6. Landmines — decisions you must not accidentally undo

Each of these looks like a "fix" waiting to happen. It isn't. The full rationale is in `CLAUDE.md` §1 (changelog) and §11–12; the decision log is in `docs/governance/`.

1. **No scipy → no math.** Never add a numpy fallback or try/except around the scipy import. Environments without scipy must refuse to compute (409), not approximate (D13).
2. **The deployed service never simulates** (F2). Don't wire `/simulate` back into the UI; recomputation belongs to the offline/job path.
3. **Correlation defaults must stay PSD-valid as entered** (D1). `PUT /api/v1/config` spectrally rejects invalid matrices, and the CLI re-checks against the *loaded* driver mix (F6) because validity is population-dependent. The engine's repair must never fire on defaults — if it does, that's a regression, and golden pins will catch it.
4. **Gaussian copula only.** The t-copula was deleted because its df dial had no observable output effect (D20); `ModelConfig.from_json` tolerates the retired field in old snapshots — keep that tolerance. The same applies to `vc_weights` and `neutral_threshold`, both deleted end-to-end.
5. **Golden pins** (`tests/test_golden_pipeline.py`): regenerating them is a *deliberate model change* — same commit, version bump, owner sign-off. Never regenerate to make CI green.
6. **Honest display set** (D3/D6/D16/D17 + M2): one decimal; P10–P90 always reachable (hover tooltip, drill-down fan chart, cell aria-labels); the headline band is the true joint portfolio percentile (`totals.portfolio`); "attribution", never "simulation", on the lenses; the exact ceteris-paribus caption; "structured-judgment overlap correction" — never "calibrated"; seed stability (honestly framed as MC sampling noise) in the About-this-model footer. The vacuous split-R̂/ESS block was deleted in 2.10.0 and replaced by a per-quantile `mc_standard_error` — do not reintroduce R̂ on i.i.d. Monte-Carlo draws. Copy changes here are owner-approval territory.
7. **The value-chain lens is a categorical epicentre partition** (2.9.0, ruling O5). Each driver is assigned wholly to one epicentre stage; the engine does not consume the 8-step profile and does not model propagation up or down the chain. `pulse.config.vc_epicentre_of` and the frontend's `epicentreOf` are parity-pinned to the same fixture table — if you change one, change both, or `tests/test_vc_epicentre.py` ↔ `tests/frontend/vcEpicentre.test.ts` will diverge.
8. **`region_weights` are load-bearing since 2.10.0.** They default to the Henkel Group FY2025 regional sales split as a documented, admin-editable proxy for the HCB GP1 mix (`DEFAULT_REGION_WEIGHTS` + `DEFAULT_REGION_WEIGHTS_SOURCE`). They are no longer an inert dial — changing them changes every published category and portfolio number.
9. **Within-force dampening uses a magnitude-weighted effective count** (`n_eff`, participation ratio — F2 of the mathematical review). The old count-based rule let a negligible driver worsen the outlook. Do not "simplify" it back.
10. **Deleted means deleted** (D4 optimizer, D10 Delphi, D14 analytics, R2 AI layer): don't resurrect from git history; the legacy `allocation_recommendation` column stays NULL.
11. **Relative % only.** No € figures anywhere except the GP1-only Beta explorer (D5).
12. **AI is suggest-only** (D7): `ai_suggested` / `user_override` drive provenance chips; nothing auto-applies. This governance carries into the online concept unchanged.
13. **Open-by-decision, not bugs:** no hindcast (F-08), one-sided driver grammar (F-09), no Henkel-position overlay (F-20), correlations restricted to [0,1] on the latent scale (F8). Don't "fix" without the owner.
14. **The product says driver, the code says trend** (owner ruling O15, 2026-09-16). The modelled items are Profit Pool Drivers, "Drivers" in menus, headers and overviews. Every string a person reads says driver; the `Trend` types, `Trends2.tsx`, the `trends-2` pane id, `/api/v1/trends`, the `trends*` tables and the contract keys (`trend_count`, `trend_fingerprint`) keep `trend` on purpose, because renaming them is a contract and schema migration with no user benefit. Don't let "trend" back into copy: `tests/frontend/driverVocabulary.test.tsx` and `tests/test_driver_vocabulary.py` fail on it in interface code, in engine and API messages, the credibility gate and the QA workbook, in every driver name and text of the generated seed, and on the 26 listed Consumer Journey phrases. Other Strategist Read prose in `data/consumerJourney.ts` is not swept, and neither is text edited in the database, so read new content with this rule in mind. Don't rename the identifiers without a migration plan.

## 7. State at handover

Five review rounds have been executed and closed since the June 2026 baseline, followed by one vocabulary ruling:

- **v3.8 (2026-07-06) — full code review remediated.** An external-style review (July 1: 2 critical / 6 high / 17 medium / 29 low findings) was remediated end-to-end: security (the unauthenticated full-reseed closed), reproducibility (deterministic trend order), ops integrity (prod runs fail loudly), the save-integrity UI bugs, honest-display and a11y batches, dead code/deps/config removed. Per-finding dispositions with commits: `docs/governance/REMEDIATION_2026-07-06.md`.
- **v3.9 (owner ruling O5, 2026-07-10) — VC epicentre attribution.** The value-chain lens became a categorical epicentre partition; `vc_weights` deleted end-to-end. Shift-matrix numbers were untouched, so the golden pins were deliberately *not* regenerated and passed unchanged.
- **v3.10 (decisions 2026-07-13) — mathematical review remediation.** Executed against an 11-finding independent mathematical review. The shift math became regional (3D), within-force dampening became monotonic, per-trend peak-year jitter was added, the chains are now pooled with a reported MC standard error, and three dead result fields were removed. **Numbers move**; golden pins were regenerated in the same commit.
- **v3.11 (owner rulings O6–O11, 2026-09-03 / 2026-09-10) — September 2026 trend-base review.** The 99-trend base became 51 reviewed drivers (generated seed, archive-first replacement script), the roll-up now uses a 12 × 4 matrix of gross-profit shares per category × region (equal 1/48 until the P&L shares are loaded via the CLI), every driver carries one uncertainty score that sets its band width and timing jitter, and the overlap correction was recalibrated on the new population (v3.11; a pre-existing provenance drift, F-28, was corrected in the process). **Numbers move**; golden pins regenerated in the same commit; the 2.10.0 numbers stay reproducible under test.
- **v3.12 (owner rulings O13 and O14, 2026-09-11) — Toilet Care split out of Hard-Surface Cleaner, and an estimated HCB mix as the default cell weights.** Two rulings, one release. **O13:** the taxonomy became 13 categories (`"LHC: TOI"` between HSC and IC), so the roll-up matrix is 13 × 4 = 52 cells; every driver of the 51-driver base gained a TOI exposure (base file `core_set_51_v4.json` — 37 of the 51 inherit their HSC score unchanged, 14 deviate with a written reason, 663 category scores in total), and the overlap correction was recalibrated on the new exposure space (v3.12 — the calibration is a function of the category exposure vectors, so a taxonomy change forces it; method and mechanism adjustments unchanged from v3.11, the resulting shifts are a few basis points). **Numbers move, the headline does not**: terminal-year portfolio −4.34% [−4.80, −3.80] against −4.35% [−4.81, −3.80] on the 12-category basis — the split resolves a blend rather than changing the answer. **O14:** `pulse.config.DEFAULT_CELL_WEIGHTS` is no longer the equal 1/52 placeholder but an ESTIMATE of the HCB gross-profit mix per category × region, built from public reporting and category knowledge and generated — not hand-typed — by `scripts/build_estimated_cell_weights.py` into the record `data/cell_weights_estimated_v1.json` and the generated `lib/cellWeightProvenance.ts` (`--check` gates both in CI); every input carries a grade (B public reporting supports it / E defensible but unverified / G low-confidence guess), and the flat grid stays selectable and reproducible as `EQUAL_CELL_WEIGHTS`. **O6 is untouched**: the finance shares still arrive as a file kept outside git (`--cell-weights FILE`) and still override the default — only the fallback changed. **Here the headline does move**: −5.58% [−6.16, −4.89] against −4.34% [−4.80, −3.80] on the equal grid, roughly four fifths of it the regional mix rather than the category mix (Europe −7.11% at 51.4% of the pool against High Growth −3.04% at 19.8%). It is an estimate from public reporting, **not Henkel P&L**, and it does not replace the finance figures. Golden pins regenerated for each ruling, in the same commit as the change (the fixture portfolio pin −0.00433 → −0.00572 under O14); the 2.10.0 numbers stay reproducible under test, which is why `tests/test_cell_weights.py` now pins the 12-category taxonomy of that release explicitly.
- **Driver vocabulary (owner ruling O15, 2026-09-16), no version bump.** "Trends" became **Profit Pool Drivers** ("Drivers" in menus, headers and overviews) in everything a person reads: the interface, API messages and errors, integrity events, the QA workbook, the production CLI's output, and the authored content (30 places in the Consumer Journey seed, four driver texts in `core_set_51_v5.json`, carried into a database by `scripts/apply_driver_vocabulary.py`). Identifiers, routes, tables and contract keys keep `trend` (§6.14). No number moves. Record: `docs/governance/DECISION_LOG.md` Part K.

Engine is **2.12.0**, and one version number is enforced everywhere: `pulse.__version__` == `MODEL_VERSION` == `package.json` == 2.12.0, test-locked (M15).

- **Repo tracks only the live product + docs.** Strategy decks, management reports, internal audits, mockups and working files live outside the tree in the git-ignored `_NOT_FOR_HANDOVER/` quarantine (inventory: `_NOT_FOR_HANDOVER/MANIFEST.md`). Spent one-time migrations stay archived under `scripts/archive/`.
- **The handover package** is produced by `bash scripts/package_handover.sh`: a fresh-history export (single-commit git repo) that structurally cannot contain `.env`, local DBs, the quarantine folder, or secret-shaped strings (the build fails if it ever would). The old personal-GitHub history is archived privately by the owner and is NOT part of the handover (H4).
- **Docs.** Root carries `00_INTEGRATION_GUIDE.md` (the folder map for the incoming team) plus the five canonical docs (`README`, `HANDOVER`, `CLAUDE`, `DEPLOY`, `CONCEPT_PRISM_ONLINE_AI`); deep-dives under `docs/` (index: `docs/INDEX.md`); the governance record under `docs/governance/`. All reconciled to the tree on 2026-08-25; on any conflict this file + `CLAUDE.md` win.
- **Quality gates green at this pass (2026-09-17):** typecheck clean · eslint clean (react-compiler advisories kept visible as warnings on purpose) · **vitest 90** · **pytest 267** (incl. golden pins, the 2.10.0 reproduction locks, uncertainty, driver base, calibration, operational tests and the O15 vocabulary locks) · single-source guard OK · generator `--check` OK · `next build` OK.
- **Dependencies audited and patched (2026-08-28).** `package-lock.json` had drifted out of sync with `package.json` (root version, and `@types/node` pinned a major behind), which made `npm ci` — and therefore the CI frontend job — fail; it is resynced. The August 2026 advisories against `next`, `postcss`, `sharp` and `nanoid` were then closed with an in-range `npm audit fix`: **`npm audit` reports 0 vulnerabilities** as of this handover. Full `npm run verify` passed after both changes. Re-audit on your first checkout — new advisories land continuously.
- **Database:** you will receive a `pg_dump` (schema in `CLAUDE.md` §6), not credentials.
- **Secrets:** every credential (Clerk, DB, JWT secret, signup code) is rotated at handover; the package builder verifies nothing secret-shaped ships.

**DX backlog (known and deliberate — not regressions):**

1. Load the actual cell weights (`--cell-weights FILE`, §5) when finance provides the category × region gross-profit shares — 13 × 4 = 52 shares since the O13 Toilet Care split. **Until then the graded estimate of O14 is in force — a better default than the equal 1/52 placeholder it replaced, but still an estimate**: every 2.12.0 run carries it and says so in its source line, which opens with "ESTIMATE, not Henkel P&L". It does not replace the finance figures, and the file still overrides it. The trend-base replacement and the first 2.11.0 production run are DONE (2026-09-10: Neon on the 51 drivers, run #98).
2. Consider splitting the largest dashboard components (`Trends2.tsx` is the biggest) — deliberately NOT done pre-handover (behavior risk without a regression window; the pure math already lives in `lib/`, shared UI in small components).

Closed on 2026-09-10/11, listed so nobody re-opens them: the two legacy-cleanup migrations ran against Neon (`migrate_drop_delphi.py` earlier, `migrate_drop_legacy.py` on 2026-09-11 — extended first to also drop the v3.2 leftovers `backtest_results` and `causal_edges`; archives in `data/archive/`), which also removed the `users` table and with it the dead `password_hash` / `password_salt` pair; the react-compiler warning backlog is at zero and the rules stay on as a ratchet; and the three retired tombstone stubs in `lib/` are deleted.

## 8. Who decides what

| Concern | Owner |
|---|---|
| Hosting, platform, CI/CD, security hardening | DX (you) |
| Model methodology, engine math, golden-pin regeneration, UI copy on the honesty set (§6.6) | Alex (product owner) — do not change without sign-off |
| Driver scoring & score overrides | Category Leads (R), Strategy VP (A) — admin editor on the Drivers page, audited |
| Config changes (correlations, weights, region weights) | Admin-only via `PUT /api/v1/config`, reason-logged, spectrally validated |

## 9. Suggested first two weeks

Week 1: local env running; read `CLAUDE.md` §§1–2, 6–8 and skim `docs/governance/REMEDIATION_2026-07-06.md`; click through every dashboard tab against `https://prism-hcb.vercel.app`; run `npm run verify`; execute one 50k run against a **copy** of the DB (`--allow-sqlite --iterations 5000` for a dry run) and watch the run ribbon, integrity chip and seed-stability line update. Week 2: work the §7 backlog items 1–2; restore the `pg_dump` into a Henkel-managed Postgres and point a preview deployment at it; then start on the migration plan in `CONCEPT_PRISM_ONLINE_AI.md`.

Questions that look like bugs are usually decisions — check `CLAUDE.md` §1 first, then ask Alex (laker.alexander@gmail.com / Henkel contact to be added at handover).
