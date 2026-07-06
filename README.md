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
| `app/` | Next.js pages + API routes (BFF: Clerk→engine auth bridge, user/role admin) |
| `components/dashboard/` | Dashboard views (Trends, Consumer Journey, Profit Pool Shift Analysis, Profit Pool Explorer) |
| `hooks/usePrism.ts` | Central data hook — single source of truth for engine state |
| `api/client.ts` | Typed API client for all `/api/v1/*` calls (20 s timeout on every request) |
| `lib/` | Server-side helpers (roles, db, Clerk→PRISM JWT bridge) + pure display/math modules (`format.ts`, `shiftMatrix.ts` — lint-guarded single sources) |
| `types/` | Shared TypeScript types |
| `api/index.py` | Vercel serverless adapter wrapping the FastAPI app |
| `pulse/` | Python simulation engine + FastAPI app |
| `data/` | Static front-end content (consumer journey tiles, trend code map) + attenuation calibration JSON |
| `tests/` | pytest suite (engine, API, ops) + `tests/frontend/` vitest suite |
| `scripts/` | Production run, ops helpers, `package_handover.sh` (`scripts/archive/` holds spent one-off migrations) |
| `docs/` | Deep-dive docs incl. `docs/governance/` (decision log, findings register, remediation records) — see `docs/INDEX.md` |
| `*.md` (repo root) | The five canonical docs: README, HANDOVER, CLAUDE, DEPLOY, CONCEPT_PRISM_ONLINE_AI |

## Prerequisites

- **Node.js 22.x** (see `package.json` engines)
- **Python 3.10+**
- Accounts/keys: **Clerk** (auth), **Neon Postgres** (roles DB); optional: Resend, Anthropic

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
| `CORS_ORIGINS` | optional | engine | CORS override |

Note (M17, July 2026): real shell environment variables **win** over `.env`
values — you can redirect a single run with `DATABASE_URL=… python3 …`.
(The former AI-layer and transactional-email variables were removed with
their features.)

## Scripts & tests

```bash
npm run dev / build / start    # Next.js
npm run verify                 # the full local gate: typecheck + eslint +
                               # single-source guard + vitest + pytest
                               # (CI runs the same two jobs)
```

Engine determinism: simulations use a fixed master seed (42) via
`np.random.default_rng`; trends load in a fixed order (`ORDER BY id`, C2) —
identical inputs produce identical results by design (reproducibility for
audits). Multi-chain runs derive distinct chain seeds from the master and
persist both; the cross-seed spread is reported as `seed_stability`.

## Deployment (Vercel)

`vercel.json` drives the build: `next build`,
plus the `/api/v1/*` → `api/index.py` rewrite. Set all required env vars in the
Vercel project settings. See `DEPLOY.md` for the step-by-step guide and
`docs/CLERK_MIGRATION.md` for the auth setup history.

## Further documentation

Start with `HANDOVER.md` (takeover guide), then `CLAUDE.md` (full developer
handbook / spec). Deep-dive docs (methodology, brand/category mapping, trend
audits, testing, design system) live under `docs/` — see `docs/INDEX.md`.
The governance record (decision log, findings register, review remediation)
is committed under `docs/governance/` — code comments cite it by finding ID.
Target-state concept for Henkel hosting + online AI: `CONCEPT_PRISM_ONLINE_AI.md`.

Strategy decks, management reports and personal working files are NOT part
of this repository. The handover package is built by
`bash scripts/package_handover.sh` (fresh-history export, secret-checked).
