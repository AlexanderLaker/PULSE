# PRISM

PRISM (Profit Pool Risk & Intelligence Simulation Model) estimates how the
external drivers of Henkel Consumer Brands' business shift the gross profit
(GP1) of its categories between 2026 and 2035. Experts score 51 Profit Pool
Drivers; a Monte Carlo engine turns the scores into relative shifts per
category, region and year, each with a P10 to P90 band, and splits each
category's median shift across the forces, value-chain stages and regions
behind it; a dashboard shows the latest production run next to the drivers
behind it.

The numbers are relative shifts, never amounts: a reader applies them to their
own figures, `GP1_2035 = GP1_today x (1 + shift)`. They hold strategy
constant, so a negative total reads as exposure if nobody acts, not as a
forecast. The gross-profit mix the engine weights its cells with is, until
finance provides the real one, an estimate built from public reporting and
not Henkel P&L.

## How it fits together

```
scripts/run_production.py        offline, on a machine with scipy
  reads the drivers, runs 3 x 50,000 iterations,
  writes the run and a QA workbook
        |
        v
PostgreSQL (Neon)                drivers, runs, journey content, audit log, user roles
        ^
        |  reads; driver edits, expert proposals and journey saves write back
PRISM API (prism/api, FastAPI)   serves the latest run; never simulates
        ^
        |  /api/v1 on the same origin
Dashboard (Next.js)              Clerk sign-in, roles, four views
```

The dashboard has four views: **Drivers** (the scored drivers, their sources
and the PRISM Analysis of each), **Consumer Journey** (strategist hypotheses:
consumer moments and the drivers behind them), **Profit Pool Shift Analysis**
(the Shift Matrix with its drill-downs) and the **Profit Pool Explorer**
(beta: sourced views of the industry profit pools).

## Quick start

Prerequisites: Node.js 22 and Python 3.12 (the version in `.python-version`,
which Vercel and CI use; 3.11 works too). The dashboard also needs a Clerk
application (test keys are enough) and a Neon database for development; the
API, the engine and both test suites run without either. Never develop
against the production database.

```bash
npm ci
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
```

`npm ci` installs exactly what `package-lock.json` pins; fill in `.env` as
Configuration describes. Then start the API in one terminal:

```bash
uvicorn prism.api.app:app --reload --port 8000
```

and the dashboard, on http://localhost:3000, in a second:

```bash
npm run dev
```

The dashboard proxies `/api/v1` to the API (next.config.js). On first use the
API creates the tables and seeds the drivers. The Shift Analysis stays empty
until a run exists; a short one on the development database takes seconds
(`--allow-test-size`, because a run stored in PostgreSQL is served at once):

```bash
python3 scripts/run_production.py --iterations 2000 --allow-test-size
```

### Without Clerk or Neon

Everything but the dashboard runs without either. On a fresh clone without a
`.env` (or with both database URLs blanked in the shell, `POSTGRES_URL=
DATABASE_URL=`), these run the Python suite on throwaway SQLite files, the
full production run on `data/prism.db` (a minute or two) and the API serving
that run:

```bash
python3 -m pytest -n auto
python3 scripts/run_production.py --allow-sqlite
uvicorn prism.api.app:app --port 8000
```

The run seeds the file with the driver base, so its results are the
production model's: `PRISM_FULL_RUN=1 python3 -m pytest
tests/test_reference_run.py` checks them against the reference run behind
the PRISM Analysis, to six decimals, and the run's QA workbook in `runs/`
shows them. The API's data routes answer only with the token the dashboard
gives a user with a role, so without Clerk only `/api/v1/health` and
`/api/v1/diagnostics` answer; `PRISM_API_DOCS=1` in the shell adds the
interactive documentation at `/docs`. The dashboard needs Clerk for sign-in
and Neon for its role table.

A new account sees only a waiting page until an admin approves it, and a new
development database has no admin yet; docs/OPERATIONS.md (Roles on a
development machine) shows how to make yourself the first.

## Repository layout

| Path | Content |
|---|---|
| `app/` | Next.js pages and the dashboard's server routes (roles, admin writes, the viewer cookie, the Clerk webhook) |
| `components/dashboard/` | The views and their shared pieces |
| `hooks/`, `types/` | The data store, the behaviour every overlay shares (Escape, the scroll lock, focus), and the types that mirror the API's JSON |
| `lib/` | Shared logic: the API client, formatting, the Shift Matrix arithmetic, cell weights, the per-driver attribution, the Profit Pool Explorer's data, tokens, auth helpers |
| `data/` | Dashboard content (the Consumer Journey, the generated driver code map), the driver base and the PRISM Analysis templates (`drivers/`), and the generated records of the overlap correction, the cell-weight estimate and the attribution (`parameters/`, `drivers/driver_attribution.json`) |
| `prism/` | The Python package: the engine (`engine.py`), the model configuration, the driver base, persistence, the QA workbook and the API (`api/`) |
| `api/index.py` | The Vercel entry point of the API |
| `scripts/` | The production run, the generators and maintenance tools |
| `migrations/` | One-time database migrations, each with its runbook |
| `tests/` | The Python suite; `tests/frontend/` holds the dashboard suite |
| `docs/` | The documentation listed below |

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | The dashboard with hot reload (the API runs separately) |
| `npm run verify` | Types, lint and both test suites; CI also builds and runs the generator checks |
| `npm run typecheck`, `npm run lint`, `npm test` | The dashboard checks one by one |
| `python3 -m pytest -n auto` | The Python suite |
| `ruff check .` | The Python lint |
| `python3 scripts/run_production.py` | The production run against the database in `.env` |

Four generators keep committed files in step with their inputs; each takes
`--check` to verify them, and CI runs all four (docs/OPERATIONS.md):
`scripts/generate_seed.py`, `scripts/build_cell_weights.py`,
`scripts/compute_overlap_correction.py` and `scripts/build_driver_analysis.py`.

## Configuration

`.env.example` lists every variable; copy it to `.env` (never committed). On
Vercel the same variables are set in the project settings, and a change takes
effect with the next deployment.

| Variable | Needed by | Purpose |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | dashboard (also at build time) | Clerk publishable key |
| `CLERK_SECRET_KEY` | dashboard | Clerk secret key |
| `CLERK_WEBHOOK_SIGNING_SECRET` | dashboard | Verifies the Clerk webhook that keeps the emails in `user_roles` current and removes deleted users |
| `DATABASE_URL` | dashboard, API, scripts | The PostgreSQL database |
| `POSTGRES_URL` | dashboard, API, scripts | The same, under the name some Vercel integrations set; wins when both are set |
| `PRISM_JWT_SECRET` | dashboard, API | Signs the tokens between the dashboard and the API; at least 32 characters, the same value on both sides |
| `PRISM_ALLOWED_EMAIL_DOMAINS` | dashboard (optional) | Comma-separated email domains (such as `henkel.com`), matched exactly: an admin can approve only a pending user whose address is at one of them. Unset, any address can be approved; a user who has a role keeps it either way |
| `ADMIN_BOOTSTRAP_SECRET` | dashboard (only while setting up the first admin) | Enables `/api/admin/bootstrap` while set (at least 32 characters); remove it, and `ADMIN_BOOTSTRAP_EMAIL`, once an admin exists |
| `ADMIN_BOOTSTRAP_EMAIL` | dashboard (only while setting up the first admin) | The one address `/api/admin/bootstrap` can make the first admin |
| `NEXT_PUBLIC_PRISM_FEEDBACK_URL` | dashboard (optional, also at build time) | Where the Welcome dialog, the error states and the Help menu send feedback: a `mailto:` address or a link (a Teams channel, a form). Unset, they name the PRISM team without a link |
| `PRISM_API_ORIGIN` | dashboard (optional) | The origin the admin routes call the API on; without it, the host the request came in on. On Vercel set it for Production only, so a preview deployment never writes to the production API |
| `PRISM_LOCAL_API_URL` | local dashboard | Where the dev server sends `/api/v1` (default `http://127.0.0.1:8000`) |
| `PRISM_DB_PATH` | API, scripts | The SQLite file used when neither database URL is set (default `data/prism.db`); the production run uses it only with `--allow-sqlite` |
| `PRISM_API_DOCS` | local API | `1` serves the API's interactive documentation (`/docs`, `/redoc`, `/openapi.json`); unset, as on every deployment, it serves none, and on Vercel never |

Variables set in the shell take precedence over `.env`, so one command can be
pointed at another database. Set both URLs, because `POSTGRES_URL` wins when
`.env` holds it:

```bash
POSTGRES_URL=... DATABASE_URL=... python3 scripts/run_production.py
```

## Documentation

| Document | Read it for |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | The components, the data flow, the API, authentication and the database |
| [docs/MODEL.md](docs/MODEL.md) | The engine: what it computes, how, and its limits |
| [docs/DRIVERS.md](docs/DRIVERS.md) | The driver base: every field and how to change it |
| [docs/DRIVER_ANALYSIS.md](docs/DRIVER_ANALYSIS.md) | The PRISM Analysis on the Drivers page |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Running, testing, deploying and maintaining PRISM |
| [docs/DESIGN.md](docs/DESIGN.md) | The visual design system |
| [docs/EXPLORER.md](docs/EXPLORER.md) | The data behind the Profit Pool Explorer |
| [docs/adr/](docs/adr/README.md) | The design decisions and why they were taken |
| [migrations/0001_driver_schema/README.md](migrations/0001_driver_schema/README.md) | The one-time migration of a database to the driver schema, and its runbook |
