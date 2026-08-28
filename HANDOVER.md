# PRISM — Developer Handover (Henkel DX)

**Audience:** the full-stack developer taking over hosting, operations and further development of PRISM.
**Status:** v3.10 · MODEL_VERSION 2.10.0 · reconciled against the tree 2026-08-25
**Reading order:** `00_INTEGRATION_GUIDE.md` (folder map, 10 minutes) → this file → `CLAUDE.md` (the developer handbook and single source of truth) → `README.md` (local setup) → `docs/governance/` (why the system is the way it is) → `CONCEPT_PRISM_ONLINE_AI.md` (target state for the Henkel-hosted, AI-enabled version).

---

## 1. What you are taking over

PRISM is a profit-pool simulation platform for Henkel Consumer Brands category strategy: 99 scored external trends → Bayesian Monte-Carlo engine (Beta priors, Gaussian copula, scipy) → a **Shift Matrix** of relative percentage impacts per category × **region** × force × year (2026–2035), rendered in a Next.js 16 "War Room" dashboard.

Since 2.10.0 the shift is genuinely three-dimensional: the engine solves 48 composite cells (12 categories × 4 regions) and each trend's contribution to a cell is weighted by **both** its category exposure and its regional exposure. The category and portfolio numbers you see are the region-GP1-share-weighted roll-up of that tensor. A trend that is globally present reproduces the old, non-regional category number exactly — only *regional concentration* moves the numbers.

Three things it deliberately is **not** (these are owner decisions, not gaps):

1. **Not a forecaster.** It is positioned as *structured judgment*; there is no hindcast/validation claim, and none may be added to UI copy (decision D9/F-08).
2. **Not a € calculator.** The engine outputs relative shifts only; users apply them to their own financials. The GP1-only Beta explorer is the single sanctioned exception (D5).
3. **Not an autopilot.** Everything is ceteris paribus — no management response modeled (D16). AI-suggested content is never auto-applied; provenance chips track review state (D7).

`CLAUDE.md` explains every such decision (D1–D21, R1–R4, O1–O5). Read its §1 fully before changing model code; the full decision log lives in `docs/governance/`.

## 2. The operating model — the one mental model you need

```
┌── OFFLINE (operator machine / future: scheduled job) ─────────────┐
│  python3 scripts/run_50k_prod.py                                  │
│  → loads 99 trends from Postgres (Neon), ORDER BY id              │
│  → pre-flight spectral gate on the LOADED mix (F6; exit 5)        │
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

Current production (to be migrated): Vercel project `prism-profit-pool` (org `lakeralexander-8859s-projects`), URL `https://prism-hcb.vercel.app`, GitHub `AlexanderLaker/PULSE`, DB Neon, auth Clerk. All four are personal accounts of the current owner — migration targets are in the concept document.

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
python3 scripts/run_50k_prod.py
# 99 trends from prod DB → pre-flight spectral gate → 3 × 50k multichain
# (pooled) → input-drift event → persists a NEW simulation_runs row →
# QA Excel at repo root (~2–6 min)
# Exit codes (H2): 0 ok · 1 no DB URL · 2 no trends · 3 PERSIST FAILED ·
# 4 wrong DB mode (Postgres URL set but SQLite active — H1) ·
# 5 correlation matrix not PSD on the loaded trend mix (F6).
# --iterations/--chains for test runs; --allow-sqlite for a LOCAL test;
# --allow-nonpsd to override the spectral gate deliberately.
```

**Do this once after deploying this version**: the persisted run predates engine
2.10.0 — re-run the CLI so the ribbon matches MODEL_VERSION. Until then the
dashboard renders the pre-2.10 run and labels it honestly: the region
drill-down shows "pre-2.10 run — re-run the engine", category numbers are the
old non-regional values, and `mc_standard_error` is absent. **Expect the
numbers to move** on the first 2.10.0 run — the regional roll-up dilutes
regionally-concentrated trends, which is the point of the change.

Previous run rows are kept — the input-drift telemetry (D19) diffs each run against the previous run's trend fingerprint and surfaces "N trend score(s) changed" in the dashboard's integrity chip.

**Deploy:** push to `main` → Vercel auto-builds (~2 min). Preview deploys for branches. Rollback: `git revert` + push, or promote a prior deployment in the Vercel dashboard.

**Smoke test after deploy:**

```bash
curl -s https://prism-hcb.vercel.app/api/v1/health | jq '.status, .trend_count'   # "ok", 99
# /api/v1/simulation requires auth (viewer cookie or Bearer JWT) — verify via the dashboard
```

**Other ops scripts** (`scripts/`): `migrate_drop_delphi.py` (O1 — archives-then-drops the `delphi_*` tables + delphi-era trend columns) and `migrate_drop_legacy.py` (O3/O4 — archives-then-drops `trend_journey_exposure`, the legacy `users` and `scanned_trends` tables and the `allocation_recommendation` column). Both REFUSE a Postgres target without an explicit `--postgres` flag; run each once against prod, only AFTER deploying this code. `promote_admin.py` (role promotion).

## 6. Landmines — decisions you must not accidentally undo

Each of these looks like a "fix" waiting to happen. It isn't. The full rationale is in `CLAUDE.md` §1 (changelog) and §11–12; the decision log is in `docs/governance/`.

1. **No scipy → no math.** Never add a numpy fallback or try/except around the scipy import. Environments without scipy must refuse to compute (409), not approximate (D13).
2. **The deployed service never simulates** (F2). Don't wire `/simulate` back into the UI; recomputation belongs to the offline/job path.
3. **Correlation defaults must stay PSD-valid as entered** (D1). `PUT /api/v1/config` spectrally rejects invalid matrices, and the CLI re-checks against the *loaded* trend mix (F6) because validity is population-dependent. The engine's repair must never fire on defaults — if it does, that's a regression, and golden pins will catch it.
4. **Gaussian copula only.** The t-copula was deleted because its df dial had no observable output effect (D20); `ModelConfig.from_json` tolerates the retired field in old snapshots — keep that tolerance. The same applies to `vc_weights` and `neutral_threshold`, both deleted end-to-end.
5. **Golden pins** (`tests/test_golden_pipeline.py`): regenerating them is a *deliberate model change* — same commit, version bump, owner sign-off. Never regenerate to make CI green.
6. **Honest display set** (D3/D6/D16/D17 + M2): one decimal; P10–P90 always reachable (hover tooltip, drill-down fan chart, cell aria-labels); the headline band is the true joint portfolio percentile (`totals.portfolio`); "attribution", never "simulation", on the lenses; the exact ceteris-paribus caption; "structured-judgment overlap correction" — never "calibrated"; seed stability (honestly framed as MC sampling noise) in the About-this-model footer. The vacuous split-R̂/ESS block was deleted in 2.10.0 and replaced by a per-quantile `mc_standard_error` — do not reintroduce R̂ on i.i.d. Monte-Carlo draws. Copy changes here are owner-approval territory.
7. **The value-chain lens is a categorical epicentre partition** (2.9.0, ruling O5). Each trend is assigned wholly to one epicentre stage; the engine does not consume the 8-step profile and does not model propagation up or down the chain. `pulse.config.vc_epicentre_of` and the frontend's `epicentreOf` are parity-pinned to the same fixture table — if you change one, change both, or `tests/test_vc_epicentre.py` ↔ `tests/frontend/vcEpicentre.test.ts` will diverge.
8. **`region_weights` are load-bearing since 2.10.0.** They default to the Henkel Group FY2025 regional sales split as a documented, admin-editable proxy for the HCB GP1 mix (`DEFAULT_REGION_WEIGHTS` + `DEFAULT_REGION_WEIGHTS_SOURCE`). They are no longer an inert dial — changing them changes every published category and portfolio number.
9. **Within-force dampening uses a magnitude-weighted effective count** (`n_eff`, participation ratio — F2 of the mathematical review). The old count-based rule let a negligible trend worsen the outlook. Do not "simplify" it back.
10. **Deleted means deleted** (D4 optimizer, D10 Delphi, D14 analytics, R2 AI layer): don't resurrect from git history; the legacy `allocation_recommendation` column stays NULL.
11. **Relative % only.** No € figures anywhere except the GP1-only Beta explorer (D5).
12. **AI is suggest-only** (D7): `ai_suggested` / `user_override` drive provenance chips; nothing auto-applies. This governance carries into the online concept unchanged.
13. **Open-by-decision, not bugs:** no hindcast (F-08), one-sided trend grammar (F-09), no Henkel-position overlay (F-20), correlations restricted to [0,1] on the latent scale (F8). Don't "fix" without the owner.

## 7. State at handover

Three review rounds have been executed and closed since the June 2026 baseline:

- **v3.8 (2026-07-06) — full code review remediated.** An external-style review (July 1: 2 critical / 6 high / 17 medium / 29 low findings) was remediated end-to-end: security (the unauthenticated full-reseed closed), reproducibility (deterministic trend order), ops integrity (prod runs fail loudly), the save-integrity UI bugs, honest-display and a11y batches, dead code/deps/config removed. Per-finding dispositions with commits: `docs/governance/REMEDIATION_2026-07-06.md`.
- **v3.9 (owner ruling O5, 2026-07-10) — VC epicentre attribution.** The value-chain lens became a categorical epicentre partition; `vc_weights` deleted end-to-end. Shift-matrix numbers were untouched, so the golden pins were deliberately *not* regenerated and passed unchanged.
- **v3.10 (decisions 2026-07-13) — mathematical review remediation.** Executed against an 11-finding independent mathematical review. The shift math became regional (3D), within-force dampening became monotonic, per-trend peak-year jitter was added, the chains are now pooled with a reported MC standard error, and three dead result fields were removed. **Numbers move**; golden pins were regenerated in the same commit.

Engine is **2.10.0**, and one version number is enforced everywhere: `pulse.__version__` == `MODEL_VERSION` == `package.json` == 2.10.0, test-locked (M15).

- **Repo tracks only the live product + docs.** Strategy decks, management reports, internal audits, mockups and working files live outside the tree in the git-ignored `_NOT_FOR_HANDOVER/` quarantine (inventory: `_NOT_FOR_HANDOVER/MANIFEST.md`). Spent one-time migrations stay archived under `scripts/archive/`.
- **The handover package** is produced by `bash scripts/package_handover.sh`: a fresh-history export (single-commit git repo) that structurally cannot contain `.env`, local DBs, the quarantine folder, or secret-shaped strings (the build fails if it ever would). The old personal-GitHub history is archived privately by the owner and is NOT part of the handover (H4).
- **Docs.** Root carries `00_INTEGRATION_GUIDE.md` (the folder map for the incoming team) plus the five canonical docs (`README`, `HANDOVER`, `CLAUDE`, `DEPLOY`, `CONCEPT_PRISM_ONLINE_AI`); deep-dives under `docs/` (index: `docs/INDEX.md`); the governance record under `docs/governance/`. All reconciled to the tree on 2026-08-25; on any conflict this file + `CLAUDE.md` win.
- **Quality gates green at this pass:** typecheck clean · eslint clean (react-compiler advisories kept visible as warnings on purpose) · **vitest 59** · **pytest 121** (incl. golden pins, joint-portfolio-band pin, VC parity, operational tests) · single-source guard OK.
- **Database:** you will receive a `pg_dump` (schema in `CLAUDE.md` §6), not credentials.
- **Secrets:** every credential (Clerk, DB, JWT secret, signup code) is rotated at handover; the package builder verifies nothing secret-shaped ships.

**DX backlog (known and deliberate — not regressions):**

1. Run the first 2.10.0 production run (§5) — until then the dashboard serves the last pre-2.10 run, honestly labeled.
2. Run the two legacy-cleanup migrations once against prod, AFTER the first deploy of this code: `python3 scripts/migrate_drop_delphi.py --postgres` (O1) and `python3 scripts/migrate_drop_legacy.py --postgres` (O3/O4). Both are archive-first, idempotent, and already executed against the local DB.
3. Burn down the react-compiler advisory warnings (`eslint.config.mjs` keeps them visible as warnings on purpose).
4. Consider splitting the largest dashboard components (`Trends2.tsx` is the biggest) — deliberately NOT done pre-handover (behavior risk without a regression window; the pure math already lives in `lib/`, shared UI in small components).
5. Three retired tombstone stubs remain in `lib/` (`auth.ts`, `calibration.ts`, `users.ts` — each a one-line `export {}`). Harmless; delete when convenient.
6. `users.password_hash` / `password_salt` remain as a legacy pair nothing reads or writes; dropping them is a DX-scheduled migration.

## 8. Who decides what

| Concern | Owner |
|---|---|
| Hosting, platform, CI/CD, security hardening | DX (you) |
| Model methodology, engine math, golden-pin regeneration, UI copy on the honesty set (§6.6) | Alex (product owner) — do not change without sign-off |
| Trend scoring & score overrides | Category Leads (R), Strategy VP (A) — admin Trend editor, audited |
| Config changes (correlations, weights, region weights) | Admin-only via `PUT /api/v1/config`, reason-logged, spectrally validated |

## 9. Suggested first two weeks

Week 1: local env running; read `CLAUDE.md` §§1–2, 6–8 and skim `docs/governance/REMEDIATION_2026-07-06.md`; click through every dashboard tab against `https://prism-hcb.vercel.app`; run `npm run verify`; execute one 50k run against a **copy** of the DB (`--allow-sqlite --iterations 5000` for a dry run) and watch the run ribbon, integrity chip and seed-stability line update. Week 2: work the §7 backlog items 1–2; restore the `pg_dump` into a Henkel-managed Postgres and point a preview deployment at it; then start on the migration plan in `CONCEPT_PRISM_ONLINE_AI.md`.

Questions that look like bugs are usually decisions — check `CLAUDE.md` §1 first, then ask Alex (laker.alexander@gmail.com / Henkel contact to be added at handover).
