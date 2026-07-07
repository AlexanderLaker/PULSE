# PRISM — Developer Handover (Henkel DX)

**Audience:** the full-stack developer taking over hosting, operations and further development of PRISM.
**Status:** v3.8 · MODEL_VERSION 2.8.1 · July 2026
**Reading order:** this file → `CLAUDE.md` (the developer handbook and single source of truth) → `README.md` (local setup) → `docs/governance/` (why the system is the way it is) → `CONCEPT_PRISM_ONLINE_AI.md` (target state for the Henkel-hosted, AI-enabled version).

---

## 1. What you are taking over

PRISM is a profit-pool simulation platform for Henkel Consumer Brands category strategy: 99 scored external trends → Bayesian Monte-Carlo engine (Beta priors, Gaussian copula, scipy) → a **Shift Matrix** of relative percentage impacts per category × force × year (2026–2035), rendered in a Next.js 16 "War Room" dashboard.

Three things it deliberately is **not** (these are owner decisions, not gaps):

1. **Not a forecaster.** It is positioned as *structured judgment*; there is no hindcast/validation claim, and none may be added to UI copy (decision D9/F-08).
2. **Not a € calculator.** The engine outputs relative shifts only; users apply them to their own financials. The GP1-only Beta explorer is the single sanctioned exception (D5).
3. **Not an autopilot.** Everything is ceteris paribus — no management response modeled (D16). AI-suggested content is never auto-applied; provenance chips track review state (D7).

`CLAUDE.md` explains every such decision (D1–D21, R1–R4). Read its §1 fully before changing model code; the full decision log lives in `docs/governance/`.

## 2. The operating model — the one mental model you need

```
┌── OFFLINE (operator machine / future: scheduled job) ─────────────┐
│  python3 scripts/run_50k_prod.py                                  │
│  → loads 99 trends from Postgres (Neon)                           │
│  → BayesianMonteCarloEngine.run_multichain(3 × 50k, scipy)        │
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

Consequence for operations: after every engine-version bump, re-run the CLI so the persisted run matches `MODEL_VERSION` (run ribbon in the dashboard shows the mismatch).

## 3. System map

| Layer | Tech | Where |
|---|---|---|
| Frontend | Next.js 16.2 / React 19 / TS 5.7 / Tailwind / Recharts | `app/`, `components/dashboard/` (10 production components), `hooks/usePrism.ts` (single data provider), `lib/shiftMatrix.ts` + `lib/format.ts` (lint-enforced single sources for shift math and shift display) |
| Auth | Clerk (identity) + short-lived HS256 JWT bridge to the engine | `app/sign-in`, `lib/prismJwt.ts`, `pulse/api/auth.py`, `proxy.ts` (Next 16 middleware replacement) |
| API | FastAPI, assembled in `pulse/api/app.py` from routers | `pulse/api/routers/{system,trends,simulation,config,competitors,misc,journey}.py`; live route table in `CLAUDE.md` §7 |
| Engine | Python 3.10+, numpy + **scipy (hard req)** | `pulse/simulation/bayesian_mc.py` (MODEL_VERSION 2.8.1), `paths.py`, `pulse/audit/input_drift.py` |
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

- **`JWT_SECRET` must equal `PRISM_JWT_SECRET`** (Next.js side and FastAPI side of the same bridge — mismatch yields 401s on every data call).
- Without Postgres, the engine falls back to SQLite at `data/prism.db` (`PRISM_DB_PATH` overrides). Real shell environment variables win over `.env` (M17) — you can redirect a single run from the command line.
- `npm run lint` includes `scripts/check_shiftmatrix_single_source.sh` — it fails the build if shift-matrix aggregation math (any declaration style, or a raw category-weights lookup) appears anywhere except `lib/shiftMatrix.ts`. That is intentional (F1/M5).

## 5. Operations runbook

**Canonical production run** (currently from the operator's machine; `.env` must contain the prod `DATABASE_URL`):

```bash
python3 scripts/run_50k_prod.py
# 99 trends from prod DB → 3 × 50k multichain → input-drift event →
# persists a NEW simulation_runs row → QA Excel at repo root (~2–6 min)
# Exit codes (H2): 0 ok · 1 no DB URL · 2 no trends · 3 PERSIST FAILED ·
# 4 wrong DB mode (Postgres URL set but SQLite active — H1).
# --iterations/--chains for test runs; --allow-sqlite for a LOCAL test.
```

**Do this once after deploying v3.8**: the persisted run predates engine
2.8.1 — re-run the CLI so the ribbon matches MODEL_VERSION. Expect small
median changes (L3/L4 honesty corrections, version-stamped) and the first
populated seed-stability line.

Previous run rows are kept — the input-drift telemetry (D19) diffs each run against the previous run's trend fingerprint and surfaces "N trend score(s) changed" in the dashboard's integrity chip.

**Deploy:** push to `main` → Vercel auto-builds (~2 min). Preview deploys for branches. Rollback: `git revert` + push, or promote a prior deployment in the Vercel dashboard.

**Smoke test after deploy:**

```bash
curl -s https://prism-hcb.vercel.app/api/v1/health | jq '.status, .trend_count'   # "ok", 99
# /api/v1/simulation requires auth (viewer cookie or Bearer JWT) — verify via the dashboard
```

**Other ops scripts** (`scripts/`): `migrate_drop_delphi.py` (O1 — archives-then-drops the `delphi_*` tables + delphi-era trend columns) and `migrate_drop_legacy.py` (O3/O4 — archives-then-drops `trend_journey_exposure`, the legacy `users` and `scanned_trends` tables and the `allocation_recommendation` column). Both REFUSE a Postgres target without an explicit `--postgres` flag; run each once against prod, only AFTER deploying this code. `promote_admin.py` (role promotion).

## 6. Landmines — decisions you must not accidentally undo

Each of these looks like a "fix" waiting to happen. It isn't. The full rationale is in `CLAUDE.md` §1 (changelog) and §11–12; the original decision log is retained offline by the owner.

1. **No scipy → no math.** Never add a numpy fallback or try/except around the scipy import. Environments without scipy must refuse to compute (409), not approximate (D13).
2. **The deployed service never simulates** (F2). Don't wire `/simulate` back into the UI; recomputation belongs to the offline/job path.
3. **Correlation defaults must stay PSD-valid as entered** (D1). `PUT /api/v1/config` spectrally rejects invalid matrices; the engine's repair must never fire on defaults — if it does, that's a regression, and golden pins will catch it.
4. **Gaussian copula only.** The t-copula was deleted because its df dial had no observable output effect (D20); `ModelConfig.from_json` tolerates the retired field in old snapshots — keep that tolerance.
5. **Golden pins** (`tests/test_golden_pipeline.py`, 2.8.1): regenerating them is a *deliberate model change* — same commit, version bump, owner sign-off. Never regenerate to make CI green.
6. **Honest display set** (D3/D6/D16/D17 + M2): one decimal; P10–P90 always reachable (hover tooltip, drill-down fan chart, cell aria-labels); the headline band is the true joint portfolio percentile (`totals.portfolio`); "attribution", never "simulation", on the lenses; the exact ceteris-paribus caption; "structured-judgment overlap correction" — never "calibrated"; seed stability (honestly framed as MC sampling noise), never R̂, in the run footer. Copy changes here are owner-approval territory.
7. **Deleted means deleted** (D4 optimizer, D10 Delphi, D14 analytics): don't resurrect from git history; the legacy `allocation_recommendation` column stays NULL.
8. **Relative % only.** No € figures anywhere except the GP1-only Beta explorer (D5).
9. **AI is suggest-only** (D7): `ai_suggested` / `user_override` drive provenance chips; nothing auto-applies. This governance carries into the online concept unchanged.
10. **Open-by-decision, not bugs:** no hindcast (F-08), one-sided trend grammar (F-09), no Henkel-position overlay (F-20). Don't "fix" without the owner.

## 7. State at handover (2026-07-06)

- **Full review remediated.** An external-style code review (July 1: 2 critical / 6 high / 17 medium / 29 low findings) was remediated end-to-end on 2026-07-06 — security (the unauthenticated full-reseed closed), reproducibility (deterministic trend order), ops integrity (prod runs fail loudly), the save-integrity UI bugs, honest-display and a11y batches, dead code/deps/config removed. Per-finding dispositions with commits: `docs/governance/REMEDIATION_2026-07-06.md`. Engine is **2.8.1** with regenerated golden pins.
- **Repo tracks only the live product + docs.** The June 23 cleanup items remain done (legacy Vite dashboard, `pulse/backup.py`, `pulse/integrations/` etc. removed). This round additionally deleted the AI layer (`pulse/ai/`) and the legacy `routes/` package (owner decision R2 — broken import, no live route, open security findings) and the 11 legacy-auth tombstone stubs (Clerk owns auth end-to-end). Spent one-time migrations stay archived under `scripts/archive/`.
- **The handover package** is produced by `bash scripts/package_handover.sh`: a fresh-history export (single-commit git repo) that structurally cannot contain `.env`, local DBs, the quarantine folder, or secret-shaped strings (the build fails if it ever would). The old personal-GitHub history is archived privately by the owner and is NOT part of the handover (H4).
- **Docs.** Root carries five canonical docs (`README`, `HANDOVER`, `CLAUDE`, `DEPLOY`, `CONCEPT_PRISM_ONLINE_AI`); deep-dives under `docs/` (index: `docs/INDEX.md`); the governance record under `docs/governance/`. All reconciled to the tree on 2026-07-06 (M14); on any conflict this file + `CLAUDE.md` win.
- **Quality gates green at this pass:** typecheck clean · eslint 0 errors (18 known react-compiler advisories, see backlog) · vitest 44 · pytest 90 (incl. 2.8.1 golden pins, joint-portfolio-band pin, operational tests) · single-source guard OK.
- **Database:** you will receive a `pg_dump` (schema in `CLAUDE.md` §6), not credentials.
- **Secrets:** every credential (Clerk, DB, JWT secret, signup code) is rotated at handover; the package builder verifies nothing secret-shaped ships.

**DX backlog (known and deliberate — not regressions):**

1. Run the first 2.8.1 production run (§5) — until then the dashboard serves the last 2.8.0 run, honestly labeled (seed stability reads "not recorded").
2. Run the two legacy-cleanup migrations once against prod, AFTER the first deploy of this code: `python3 scripts/migrate_drop_delphi.py --postgres` (O1) and `python3 scripts/migrate_drop_legacy.py --postgres` (O3/O4). Both are archive-first, idempotent, and already executed against the local DB. Nothing legacy remains after them.
3. Burn down the 18 react-compiler advisory warnings (`eslint.config.mjs` keeps them visible as warnings on purpose).
4. Consider splitting the largest dashboard components (Trends2 ≈ 2.8k lines) — deliberately NOT done pre-handover (behavior risk without a regression window; the pure math already lives in `lib/`, shared UI in small components).
5. ~~Strategist review of the AI-suggested journey tiles + exposure scores~~ — **closed by owner rulings O2/O3 (2026-07-07)**: tiles bulk-accepted; the quantitative exposure layer deleted outright. Remaining content backlog: Henkel-claims validation in stage contexts, Home Care journey.

## 8. Who decides what

| Concern | Owner |
|---|---|
| Hosting, platform, CI/CD, security hardening | DX (you) |
| Model methodology, engine math, golden-pin regeneration, UI copy on the honesty set (§6.6) | Alex (product owner) — do not change without sign-off |
| Trend scoring & score overrides | Category Leads (R), Strategy VP (A) — admin Trend editor, audited |
| Config changes (correlations, weights) | Admin-only via `PUT /api/v1/config`, reason-logged, spectrally validated |

## 9. Suggested first two weeks

Week 1: local env running; read `CLAUDE.md` §§1–2, 6–8 and skim `docs/governance/REMEDIATION_2026-07-06.md`; click through every dashboard tab against `https://prism-hcb.vercel.app`; run `npm run verify`; execute one 50k run against a **copy** of the DB (`--allow-sqlite --iterations 5000` for a dry run) and watch the run ribbon/integrity chip/seed-stability line update. Week 2: work the §7 backlog items 1–2; restore the `pg_dump` into a Henkel-managed Postgres and point a preview deployment at it; then start on the migration plan in `CONCEPT_PRISM_ONLINE_AI.md`.

Questions that look like bugs are usually decisions — check `CLAUDE.md` §1 first, then ask Alex (laker.alexander@gmail.com / Henkel contact to be added at handover).
