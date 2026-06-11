# PRISM — Profit Pool Simulation Platform

PRISM (formerly PULSE) is a profit-pool simulation and trend-intelligence platform
for FMCG category strategy. It combines a Bayesian Monte-Carlo simulation engine
(Python) with an interactive analysis dashboard (Next.js) deployed on Vercel.

## Architecture

```
Browser ──▶ Next.js 16 (App Router)            ──  UI, auth, role gating
              │   Clerk        → identity (sign-in/up, sessions)
              │   lib/roles.ts → authorization (admin/viewer, Neon Postgres)
              │   fetch('/api/v1/…')
              ▼
            Vercel rewrite (vercel.json)
              ▼
            api/index.py  ──▶  pulse/ (FastAPI engine — READ-ONLY in prod, F2)
                                ├─ simulation/   Bayesian MC, Gaussian copula (scipy)
                                ├─ audit/        input-drift telemetry, audit log
                                └─ api/app.py    REST endpoints (/api/v1/*)
```

Auth bridge: Next.js API routes verify the Clerk session, then mint a short-lived
HS256 JWT (`lib/prismJwt.ts`, signed with `PRISM_JWT_SECRET`). The Python engine
verifies that JWT (`pulse/api/auth.py`) and enforces admin gates on mutating
endpoints. The engine has no user store of its own.

## Repository layout

| Path | Purpose |
|------|---------|
| `app/` | Next.js pages + API routes (BFF: auth bridge, user/role admin) |
| `components/dashboard/` | Dashboard views (Trends, Consumer Journey, Profit Pool, Innovation) |
| `hooks/usePrism.ts` | Central data hook — single source of truth for engine state |
| `api/client.ts` | Typed API client for all `/api/v1/*` calls |
| `lib/` | Server-side helpers: roles, db, Clerk→PRISM JWT bridge, formatting |
| `types/` | Shared TypeScript types |
| `api/index.py` | Vercel serverless adapter wrapping the FastAPI app |
| `pulse/` | Python simulation engine + FastAPI app |
| `data/` | Seed/calibration data; `innovations.ts` (static innovation content) |
| `tests/` | pytest suite for the engine |
| `scripts/` | Build helpers (`download-images.mjs`) + one-off migrations |
| `DOCUMENTATION/` | Deep-dive docs (methodology, modules, audits) |

## Prerequisites

- **Node.js 22.x** (see `package.json` engines)
- **Python 3.10+**
- Accounts/keys: **Clerk** (auth), **Neon Postgres** (roles DB); optional: Resend, Unsplash, Anthropic

## Local setup

```bash
# 1. Install frontend deps
npm install

# 2. Install engine deps (virtualenv recommended)
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt        # full dev set (incl. scipy, pytest)
# (production/Vercel uses the slimmer api/requirements.txt)

# 3. Configure environment
cp .env.example .env                       # then fill in the values — see table below

# 4. Run both processes (two terminals)
python -m uvicorn pulse.api.app:app --reload --port 8000   # engine
npm run dev                                                 # frontend on :3000
```

`next.config.js` proxies `/api/v1/*` from :3000 to :8000 in dev. In production,
`vercel.json` rewrites `/api/v1/*` to the Python serverless function instead.

## Environment variables

| Variable | Required | Used by | Purpose |
|----------|----------|---------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | yes | frontend | Clerk publishable key (`pk_…`) |
| `CLERK_SECRET_KEY` | yes | Next server | Clerk secret key (`sk_…`) |
| `CLERK_WEBHOOK_SIGNING_SECRET` | yes (prod) | Next server | Verifies Clerk `user.*` webhooks (svix) |
| `DATABASE_URL` (or `POSTGRES_URL`) | yes | Next server + engine | Neon Postgres (roles, trends, audit) |
| `PRISM_JWT_SECRET` | yes | Next server + engine | Shared secret for the Clerk→engine JWT bridge (≥32 chars) |
| `NEXT_PUBLIC_SIGNUP_CODE` | recommended | frontend | Access code required on the sign-up page |
| `ADMIN_BOOTSTRAP_SECRET` | optional | Next server | Shared secret for `/api/admin/bootstrap` (first admin) |
| `BACKEND_URL` / `PRISM_BACKEND_URL` | dev only | Next server | Engine URL override (default `http://127.0.0.1:8000`) |
| `PRISM_DB_PATH` | optional | engine | SQLite path for local runs without Postgres |
| `UNSPLASH_ACCESS_KEY` | optional | build | Innovation images at build time (falls back to placeholders) |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | optional | engine | Transactional e-mail (currently unused after auth cleanup) |
| `ANTHROPIC_API_KEY` | optional | engine | AI narration/chat features (`pulse/ai/`) |
| `CORS_ORIGINS`, `PRISM_APP_URL` | optional | engine | CORS / absolute-URL overrides |

## Scripts & tests

```bash
npm run dev / build / start    # Next.js
npx tsc -p tsconfig.check.json --noEmit    # typecheck (CI gate)
pytest                          # engine test suite (simulation, API, properties)
```

Engine determinism: simulations use a fixed seed (42) via `np.random.default_rng`
— identical inputs produce identical results by design (reproducibility for
audits). Multi-chain convergence checks derive distinct seeds internally.

## Deployment (Vercel)

`vercel.json` drives the build: `node scripts/download-images.mjs && next build`,
plus the `/api/v1/*` → `api/index.py` rewrite. Set all required env vars in the
Vercel project settings. See `DEPLOY.md` for the step-by-step guide and
`CLERK_MIGRATION.md` for the auth setup history.

## Further documentation

Start with `HANDOVER.md` (takeover guide), then `CLAUDE.md` (developer
handbook) and `DOCUMENTATION/` — see `DOCUMENTATION/INDEX.md` for a table of
contents. Target-state concept for Henkel hosting + online AI:
`CONCEPT_PRISM_ONLINE_AI.md`.

Strategy decks, management reports and historical audits are NOT part of this
repository.
