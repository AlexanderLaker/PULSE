# PRISM — Deployment Guide

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

### Pushing from your Mac

```bash
cd "/path/to/PROFIT_POOL_ENGINE"
git add -A
git commit -m "<change>"
git push origin main
```

### Pushing from Cowork / sandbox

Cowork has its own helper that bypasses the OneDrive `.git/index.lock` issue:

```bash
bash scripts/cowork-deploy.sh "<commit subject>" path1 path2 ...
```

Requires `.env.deploy` at repo root with `GITHUB_TOKEN=<fine-grained PAT>` (gitignored, never committed).

## Environment variables

All secrets live in **Vercel project settings**, never in this repo.
https://vercel.com/lakeralexander-8859s-projects/prism-profit-pool/settings/environment-variables

### Required for production

| Variable | Purpose |
|----------|---------|
| `POSTGRES_URL` | Neon serverless Postgres connection string (production database) |
| `JWT_SECRET` | Next.js JWT signing secret (≥32 chars; see `DEPLOYMENT_NOTES.md`) |
| `PRISM_JWT_SECRET` | FastAPI JWT signing secret — **must equal `JWT_SECRET`** |
| `CLERK_SECRET_KEY` | Clerk backend API key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend publishable key (use `pk_live_...` for production) |
| `CLERK_WEBHOOK_SECRET` | svix signing secret for `/api/webhooks/clerk` |
| `ANTHROPIC_API_KEY` | Claude API for AI scanner / chat / narrator (provider-agnostic) |

### Optional / scaffold

The following keys appear in older docs and `.env.example` but are **not currently called by live code**. They were planned research-enrichment integrations that were never wired into the production engine. They can be left unset on Vercel without affecting any production behavior:

- `BEAUTYFEEDS_API_KEY` — beautyfeeds.io (real-time beauty news)
- `OPENALEX_API_KEY` — api.openalex.org (academic research)
- `NEWSAPI_API_KEY` — newsapi.org (news aggregation)
- `NCBI_API_KEY` — eutils.ncbi.nlm.nih.gov (PubMed)
- `EUROMONITOR_API_KEY`, `STATISTA_API_KEY`, `EPO_API_KEY`, Reddit creds — same status

If/when any of these is wired into the live ingestion path, add it here and document the path.

### Image pipeline (build-time)

- `UNSPLASH_ACCESS_KEY` — used by `scripts/download-images.mjs` at Vercel build time to fetch Innovation Explorer photography. If unset, the build falls back to hand-picked photo IDs (no broken builds).

## Architecture

Production is a **Next.js 14 + Python FastAPI** hybrid on Vercel:

```
Vercel project: prism-profit-pool
├── app/                          ← Next.js 14 routes (Clerk-gated dashboard)
├── components/dashboard/         ← 29+ War Room components (TS/React)
├── lib/                          ← auth, calibration, format, db helpers
├── api/index.py                  ← Python serverless adapter (cold-start retry)
│   └── pulse/api/app.py          ← FastAPI app, 30+ endpoints
├── pulse/                        ← Simulation engine + trend DB (Python)
│   ├── seed_trends.py            ← 99 calibrated trends (v3.3 + Gemini)
│   ├── simulation/bayesian_mc.py ← Bayesian MC + copula engine
│   ├── ingestion/                ← Trend models
│   ├── optimizer/                ← Allocation / mean-variance
│   └── ai/                       ← Claude / Azure / Ollama provider abstraction
├── public/                       ← Static images (innovation photos, favicon)
└── vercel.json                   ← Routes /api/v1/* → api/index.py, rest → Next.js
```

Routing rules (`vercel.json`):
- `/api/v1/*` and `/api/py/*` → Python FastAPI (`api/index.py`)
- everything else → Next.js
- `/images/*` cached `max-age=31536000, immutable`

Auth: Clerk middleware (`middleware.ts`) gates everything except `/sign-in`, `/sign-up`, Clerk webhook routes, the bootstrap-admin endpoint, and `/api/v1/*` (which the Python adapter then auth-checks via JWT Bearer).

## Local development

### Backend (FastAPI on :8000)

```bash
cd PROFIT_POOL_ENGINE
pip install -r api/requirements.txt
python -m uvicorn pulse.api.app:app --reload --port 8000
# Health: http://localhost:8000/api/v1/health
```

### Frontend (Next.js on :3000)

```bash
npm install
npm run dev
# Dashboard: http://localhost:3000
```

The Next.js `next.config.js` proxies `/api/v1/*` to `http://127.0.0.1:8000` in dev so the dashboard's same-origin fetches resolve to the local FastAPI.

### Required local `.env`

Copy `.env.example` and fill in: `POSTGRES_URL` (or set `PULSE_DB_PATH=data/prism.db` for SQLite local mode), `JWT_SECRET`, `PRISM_JWT_SECRET`, Clerk keys, optional `ANTHROPIC_API_KEY`.

## Production simulation (50k canonical run)

The dashboard's interactive `/simulate` runs at 5k–10k iterations. The canonical production batch runs at 50k × 3 chains:

```bash
python3 scripts/run_50k_prod.py
# Loads 99 trends from prod Neon, runs Bayesian MC at 50k×3,
# persists shift_matrix + allocation + convergence to Neon,
# writes a QA Excel alongside repo root.
```

Convergence target: `r̂ < 1.01`, ESS > 1k per category. At production scale, ESS lands ~150k (essentially the full sample, near-zero autocorrelation).

## Smoke test after deploy

```bash
# 1. Health
curl -s https://prism-hcb.vercel.app/api/v1/health | jq '.status, .trend_count, .categories'
# Expected: "ok"  99  12

# 2. Trends endpoint shape
curl -s https://prism-hcb.vercel.app/api/v1/trends -H "Authorization: Bearer $JWT" | jq 'length'
# Expected: 99 (auth required — get JWT from Clerk session)

# 3. (Authenticated) hit /api/v1/simulate, verify shift_matrix has 12 categories × 10 path years
```

## Rollback

```bash
git revert <bad-sha>
git push origin main
# Vercel auto-deploys the revert in ~2 min
```

Or roll back via the Vercel dashboard: Deployments → click prior healthy deploy → "Promote to Production".

## Reference docs

- `DEPLOYMENT_NOTES.md` — JWT secret synchronization between Next.js and FastAPI
- `CLERK_MIGRATION.md` — Clerk auth setup
- `CLAUDE.md` — full project specification (v3.3, MODEL_VERSION 2.5.0)
- `PRISM_PreDeployment_Audit_2026-05-04.md` — most recent audit
