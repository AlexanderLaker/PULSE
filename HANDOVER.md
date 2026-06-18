# PRISM — Developer Handover (Henkel DX)

**Audience:** the full-stack developer taking over hosting, operations and further development of PRISM.
**Status:** v3.7 · MODEL_VERSION 2.8.0 · June 2026
**Reading order:** this file → `CLAUDE.md` (the developer handbook and single source of truth) → `README.md` (local setup) → `CONCEPT_PRISM_ONLINE_AI.md` (target state for the Henkel-hosted, AI-enabled version).

---

## 1. What you are taking over

PRISM is a profit-pool simulation platform for Henkel Consumer Brands category strategy: 99 scored external trends → Bayesian Monte-Carlo engine (Beta priors, Gaussian copula, scipy) → a **Shift Matrix** of relative percentage impacts per category × force × year (2026–2035), rendered in a Next.js 16 "War Room" dashboard.

Three things it deliberately is **not** (these are owner decisions, not gaps):

1. **Not a forecaster.** It is positioned as *structured judgment*; there is no hindcast/validation claim, and none may be added to UI copy (decision D9/F-08).
2. **Not a € calculator.** The engine outputs relative shifts only; users apply them to their own financials. The GP1-only Beta explorer is the single sanctioned exception (D5).
3. **Not an autopilot.** Everything is ceteris paribus — no management response modeled (D16). AI-suggested content is never auto-applied; provenance chips track review state (D7).

`CLAUDE.md` explains every such decision (D1–D21). Read its §1 fully before changing model code.

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
| Frontend | Next.js 16.2 / React 19 / TS 5.7 / Tailwind / D3 + Recharts | `app/`, `components/dashboard/` (13 production components + 2 arriving with the WIP branch, §7), `hooks/usePrism.ts` (single data provider), `lib/shiftMatrix.ts` (single source for shift-matrix math, lint-enforced) |
| Auth | Clerk (identity) + short-lived HS256 JWT bridge to the engine | `app/sign-in`, `lib/prismJwt.ts`, `pulse/api/auth.py`, `proxy.ts` (Next 16 middleware replacement) |
| API | FastAPI, assembled in `pulse/api/app.py` from routers | `pulse/api/routers/{system,trends,simulation,config,competitors,misc,journey}.py`; live route table in `CLAUDE.md` §7 |
| Engine | Python 3.10+, numpy + **scipy (hard req)** | `pulse/simulation/bayesian_mc.py` (MODEL_VERSION 2.8.0), `paths.py`, `pulse/audit/input_drift.py` |
| Persistence | Neon Postgres (prod) / SQLite (local) — dual-mode | `pulse/database.py`; schema in `CLAUDE.md` §6 |
| Exports | QA Excel written by the CLI run | `pulse/excel_bridge/writer.py` (PPTX/Power BI modules exist ad-hoc, no live route) |
| AI layer | **Dormant** — provider abstraction (Claude/Azure/Ollama), scanner, narrator, calibrator | `pulse/ai/`, docs: `AI_QUICKSTART.md`, `docs/SCANNER_API.md` — see concept doc |
| CI | GitHub Actions: frontend (typecheck/lint/vitest) + engine (pytest with scipy) | `.github/workflows/ci.yml` |

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
- Without Postgres, the engine falls back to SQLite. `pulse/env_loader.py` defaults to `data/pulse.db`; the convention used everywhere else is `data/prism.db` — set `PRISM_DB_PATH=data/prism.db` explicitly in `.env`.
- `npm run lint` includes `scripts/check_shiftmatrix_single_source.sh` — it fails the build if shift-matrix aggregation math appears anywhere except `lib/shiftMatrix.ts`. That is intentional (F1).

## 5. Operations runbook

**Canonical production run** (currently from the operator's machine; `.env` must contain the prod `DATABASE_URL`):

```bash
python3 scripts/run_50k_prod.py
# 99 trends from prod DB → 3 × 50k multichain → input-drift event →
# persists a NEW simulation_runs row → QA Excel at repo root (~2–6 min)
```

Previous run rows are kept — the input-drift telemetry (D19) diffs each run against the previous run's trend fingerprint and surfaces "N trend score(s) changed" in the dashboard's integrity chip.

**Deploy:** push to `main` → Vercel auto-builds (~2 min). Preview deploys for branches. Rollback: `git revert` + push, or promote a prior deployment in the Vercel dashboard.

**Smoke test after deploy:**

```bash
curl -s https://prism-hcb.vercel.app/api/v1/health | jq '.status, .trend_count'   # "ok", 99
# /api/v1/simulation requires auth (viewer cookie or Bearer JWT) — verify via the dashboard
```

**Other ops scripts** (`scripts/`): `backfill_journey_exposure.py` (non-destructive seed of the 99 × 260 journey-exposure scores — must run once against prod before journey attribution chips populate, then a fresh 50k run), `migrate_drop_delphi.py` (archives-then-drops legacy `delphi_*` tables), `promote_admin.py` (role promotion).

## 6. Landmines — decisions you must not accidentally undo

Each of these looks like a "fix" waiting to happen. It isn't. The full rationale is in `CLAUDE.md` §1 (changelog) and §11–12; the original decision log is retained offline by the owner.

1. **No scipy → no math.** Never add a numpy fallback or try/except around the scipy import. Environments without scipy must refuse to compute (409), not approximate (D13).
2. **The deployed service never simulates** (F2). Don't wire `/simulate` back into the UI; recomputation belongs to the offline/job path.
3. **Correlation defaults must stay PSD-valid as entered** (D1). `PUT /api/v1/config` spectrally rejects invalid matrices; the engine's repair must never fire on defaults — if it does, that's a regression, and golden pins will catch it.
4. **Gaussian copula only.** The t-copula was deleted because its df dial had no observable output effect (D20); `ModelConfig.from_json` tolerates the retired field in old snapshots — keep that tolerance.
5. **Golden pins** (`tests/test_golden_pipeline.py`, 2.8.0): regenerating them is a *deliberate model change* — same commit, version bump, owner sign-off. Never regenerate to make CI green.
6. **Honest display set** (D3/D6/D16/D17): one decimal; P10–P90 always visible; the headline band is the true joint portfolio percentile (`totals.portfolio`); "attribution", never "simulation", on the lenses; the exact ceteris-paribus caption; "structured-judgment overlap correction" — never "calibrated"; seed stability, never R̂, in the run popover. Copy changes here are owner-approval territory.
7. **Deleted means deleted** (D4 optimizer, D10 Delphi, D14 analytics): don't resurrect from git history; the legacy `allocation_recommendation` column stays NULL.
8. **Relative % only.** No € figures anywhere except the GP1-only Beta explorer (D5).
9. **AI is suggest-only** (D7): `ai_suggested` / `user_override` drive provenance chips; nothing auto-applies. This governance carries into the online concept unchanged.
10. **Open-by-decision, not bugs:** no hindcast (F-08), one-sided trend grammar (F-09), no Henkel-position overlay (F-20). Don't "fix" without the owner.

## 7. State at handover (2026-06-11)

- **WIP:** branch `feature/ui-exec-summary` carries uncommitted work (new `ExecutiveSummary.tsx` + `ShiftValue.tsx`, 12 modified files) — will be merged or handed over explicitly. `main` is the line of truth.
- **Docs drift:** `README.md` and `DEPLOY.md` carry banners where they predate v3.6/v3.7 (Next 14 references, deleted modules, interactive `/simulate`). This file + `CLAUDE.md` win on conflict. `DOCUMENTATION/INDEX.md` is current.
- **Day-one cleanup list** (recommended first PR; each item verified unreferenced — confirm with `npm run build` + `npm run verify`):
  `public/assets/*` + `public/data/latest_mc_v3.1.json` + `public/index.html` (legacy Vite artifacts, currently publicly served), `pulse/dashboard/` (8 MB legacy Vite app), `assets/` (Vite leftovers), `pulse/backup.py` (unimported), `pulse/integrations/` (empty package), `pulse/api/routes/auth.py` (unmounted legacy; keep `scanner.py` — the AI concept remounts it), `data/pulse.db` (local relic), `tests/test_scanner_routes.py` (pre-existing breakage, excluded from CI — fix or delete when the scanner revives).
- **Database:** you will receive a `pg_dump` (trends, simulation_runs, config_snapshots, journey_content, users, audit_log — schema in `CLAUDE.md` §6), not credentials. Journey activation: run `scripts/backfill_journey_exposure.py` once, then a fresh 50k run.
- **Secrets:** every credential (Clerk, DB, JWT secret, signup code, API keys) is rotated at handover; nothing in the repo or its history contains secrets (verified).

## 8. Who decides what

| Concern | Owner |
|---|---|
| Hosting, platform, CI/CD, security hardening | DX (you) |
| Model methodology, engine math, golden-pin regeneration, UI copy on the honesty set (§6.6) | Alex (product owner) — do not change without sign-off |
| Trend scoring & score overrides | Category Leads (R), Strategy VP (A) — admin Trend editor, audited |
| Config changes (correlations, weights) | Admin-only via `PUT /api/v1/config`, reason-logged, spectrally validated |

## 9. Suggested first two weeks

Week 1: local env running; read `CLAUDE.md` §§1–2, 6–8; click through every dashboard tab against `https://prism-hcb.vercel.app`; run the pytest + vitest suites; execute one 50k run against a **copy** of the DB and watch the run ribbon/integrity chip update. Week 2: day-one cleanup PR (§7); restore the `pg_dump` into a Henkel-managed Postgres and point a preview deployment at it; then start on the migration plan in `CONCEPT_PRISM_ONLINE_AI.md`.

Questions that look like bugs are usually decisions — check `CLAUDE.md` §1 first, then ask Alex (laker.alexander@gmail.com / Henkel contact to be added at handover).
