# PRISM — Deployment Guide

> Reconciled 2026-06-14 (handover review) against the live code. On any
> conflict, `HANDOVER.md` and `CLAUDE.md` remain the source of truth.
> Key facts: the deployed service is **read-only** (F2/D13 — it never
> simulates); the canonical simulation runs **offline** via
> `scripts/run_50k_prod.py`; auth is one shared secret (`PRISM_JWT_SECRET`)
> used by both the Next.js proxy and the FastAPI backend.

## Live deployment

**Production URL:** https://prism-hcb.vercel.app

**Aliases (also production):**
- `https://prism-profit-pool-lakeralexander-8859s-projects.vercel.app` (auto)
- `https://prism-profit-pool-git-main-lakeralexander-8859s-projects.vercel.app` (auto, latest main)

**Health check:**

```bash
curl https://prism-hcb.vercel.app/api/v1/health
# Expected: {"status":"ok","model_loaded":true,"trend_count":99,"categories":12,...}
```

## Repository & deploy mechanism

GitHub: [`AlexanderLaker/PULSE`](https://github.com/AlexanderLaker/PULSE) (branch `main`)
Vercel project: `prism-profit-pool` (org: `lakeralexander-8859s-projects`)

Pushing to `main` auto-triggers a Vercel build (~2 min). Monitor at https://vercel.com/dashboard.
There is **no `next build` in CI** — the build runs only on Vercel (where the
Clerk/Neon env vars are present). CI runs the `npm run verify` gates instead
(typecheck + lint + vitest + pytest); see `.github/workflows/ci.yml`.

### Pushing from your Mac

```bash
cd "/path/to/PROFIT_POOL_ENGINE"
git add -A
git commit -m "<change>"
git push origin main
```

### Pushing from Cowork / a sandbox

The folder is often mounted from OneDrive/iCloud, whose `.git` can refuse
`unlink` and leave stale `.git/index.lock` / `.git/HEAD.lock` files
("Another git process seems to be running"). If `git` errors that way and no
git process is actually running, clear the stale locks by **renaming** them
(rename is permitted even when delete is not), then retry:

```bash
[ -e .git/index.lock ] && mv -f .git/index.lock .git/_stale_index.lock
[ -e .git/HEAD.lock ]  && mv -f .git/HEAD.lock  .git/_stale_HEAD.lock
git commit -m "<change>" && git push origin main
```

## Environment variables

All secrets live in **Vercel project settings**, never in this repo.
https://vercel.com/lakeralexander-8859s-projects/prism-profit-pool/settings/environment-variables

### Required for production

| Variable | Purpose |
|----------|---------|
| `POSTGRES_URL` | Neon serverless Postgres connection string (production database) |
| `PRISM_JWT_SECRET` | Shared HS256 signing secret (≥32 chars). **The same value is read by the Next.js proxy (`lib/prismJwt.ts`) and the FastAPI backend (`pulse/api/auth.py`)** — there is only one secret. See `docs/DEPLOYMENT_NOTES.md`. |
| `CLERK_SECRET_KEY` | Clerk backend API key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend publishable key (use `pk_live_...` for production). **Required at build time** — `next build` prerenders pages through `<ClerkProvider>` and fails without it. |
| `CLERK_WEBHOOK_SIGNING_SECRET` | svix signing secret for `/api/webhooks/clerk` |
| `ANTHROPIC_API_KEY` | Claude API for the (currently dormant) AI scanner / narrator. Unset is fine in production — the AI layer is not mounted. |

> Earlier docs referenced a separate `JWT_SECRET` that had to "equal"
> `PRISM_JWT_SECRET`. The live code reads `PRISM_JWT_SECRET` on both sides;
> `JWT_SECRET` is not used. Set `PRISM_JWT_SECRET` only.

### Optional / scaffold

The following keys appear in older docs and `.env.example` but are **not currently called by live code**. They were planned research-enrichment integrations that were never wired into the production engine. They can be left unset on Vercel without affecting any production behavior:

- `BEAUTYFEEDS_API_KEY` — beautyfeeds.io (real-time beauty news)
- `OPENALEX_API_KEY` — api.openalex.org (academic research)
- `NEWSAPI_API_KEY` — newsapi.org (news aggregation)
- `NCBI_API_KEY` — eutils.ncbi.nlm.nih.gov (PubMed)
- `EUROMONITOR_API_KEY`, `STATISTA_API_KEY`, `EPO_API_KEY`, Reddit creds — same status

If/when any of these is wired into the live ingestion path, add it here and document the path.

## Architecture

Production is a **Next.js 16 + Python FastAPI** hybrid on Vercel:

```
Vercel project: prism-profit-pool
├── app/                          ← Next.js 16 routes (Clerk-gated dashboard) + /api proxy routes
├── components/dashboard/         ← 10 dashboard components (TS/React)
├── lib/                          ← auth bridge (prismJwt, roles), shiftMatrix, format, helpers
├── api/index.py                  ← Python serverless adapter (cold-start retry)
│   └── pulse/api/app.py          ← FastAPI app (read-only data plane + admin writes)
├── pulse/                        ← Simulation engine + trend DB (Python)
│   ├── seed_trends.py            ← 99 trends (v3.5 base)
│   ├── simulation/bayesian_mc.py ← Bayesian MC + Gaussian copula engine (scipy-only, D13/D20)
│   ├── ingestion/                ← Trend models
│   └── ai/                       ← Claude / Azure / Ollama provider abstraction (dormant; not mounted)
├── public/                       ← Static assets (favicon, etc.)
└── vercel.json                   ← Routes /api/v1/* → api/index.py, rest → Next.js
```

Routing rules (`vercel.json`):
- `/api/v1/*` and `/api/py/*` → Python FastAPI (`api/index.py`)
- everything else → Next.js
- `/images/*` cached `max-age=31536000, immutable`

Auth: Clerk gates the app via `proxy.ts` (Next.js 16's Clerk integration; replaced the old `middleware.ts`) for everything except `/sign-in`, `/sign-up`, the Clerk webhook route, the bootstrap-admin endpoint, and `/api/v1/*` (which the Python adapter auth-checks itself via JWT Bearer / viewer cookie).

## Local development

### Backend (FastAPI on :8000)

```bash
cd PROFIT_POOL_ENGINE
pip install -r requirements-dev.txt   # full engine + API + tests (scipy required, D13)
python -m uvicorn pulse.api.app:app --reload --port 8000
# Health: http://localhost:8000/api/v1/health
```

> `api/requirements.txt` is the *serverless* runtime set (no scipy by design).
> For local dev and running the engine, use `requirements-dev.txt`.

### Frontend (Next.js on :3000)

```bash
npm install
npm run dev
# Dashboard: http://localhost:3000
```

The Next.js `next.config.js` proxies `/api/v1/*` to `http://127.0.0.1:8000` in dev so the dashboard's same-origin fetches resolve to the local FastAPI.

### Required local `.env`

Copy `.env.example` and fill in: `POSTGRES_URL` (or set `PRISM_DB_PATH=data/prism.db` for SQLite local mode), `PRISM_JWT_SECRET`, Clerk keys, optional `ANTHROPIC_API_KEY`.

## Production simulation (50k canonical run)

The deployed service **never simulates** — `POST /api/v1/simulate` returns **409** on any runtime without scipy (F2/D13), and the dashboard only renders the latest persisted run. The canonical production batch runs **offline on a machine with scipy**:

```bash
python3 scripts/run_50k_prod.py
# Loads 99 trends from prod Neon, runs Bayesian MC at 50k × 3 chains,
# persists the results bundle (shift_matrix + decompositions + totals.portfolio
# + integrity_events + seed_stability + trend_fingerprint) to Neon,
# and writes a QA Excel alongside the repo root.
```

Quality signal (internal, not exposed in the UI): **seed stability** — the
headline spread across independently-seeded chains (D3 replaced the R̂ badge,
which is ≈1.0 by construction on i.i.d. Monte-Carlo draws).

After an engine-version bump, re-run the CLI so the persisted run matches
`MODEL_VERSION`; the dashboard renders whatever run is persisted.

## Smoke test after deploy

```bash
# 1. Health
curl -s https://prism-hcb.vercel.app/api/v1/health | jq '.status, .trend_count, .categories'
# Expected: "ok"  99  12

# 2. Trends endpoint shape (auth required — get a JWT from a Clerk session)
curl -s https://prism-hcb.vercel.app/api/v1/trends -H "Authorization: Bearer $JWT" | jq 'length'
# Expected: 99

# 3. Persisted run (read-only): verify the shift matrix is 12 categories × 10 path years
curl -s https://prism-hcb.vercel.app/api/v1/simulation -H "Authorization: Bearer $JWT" \
  | jq '.results.shift_matrix | keys | length'
# Expected: 12   (NOT /api/v1/simulate — that returns 409 by design on serverless)
```

## Rollback

```bash
git revert <bad-sha>
git push origin main
# Vercel auto-deploys the revert in ~2 min
```

Or roll back via the Vercel dashboard: Deployments → click prior healthy deploy → "Promote to Production".

## Reference docs

- `HANDOVER.md` — primary handover entry point (operate, deploy, landmines)
- `docs/DEPLOYMENT_NOTES.md` — JWT secret synchronization between Next.js and FastAPI
- `docs/CLERK_MIGRATION.md` — Clerk auth setup
- `CLAUDE.md` — full project specification (v3.7, MODEL_VERSION 2.8.0)
