# Operations

How to develop, test, run, deploy and look after PRISM.

## Environments

| | Production | Development |
|---|---|---|
| Dashboard and API | Vercel project `prism-profit-pool`, https://prism-hcb.vercel.app | `npm run dev` and uvicorn on your machine |
| Database | Neon PostgreSQL | a Neon development branch (the dashboard's role table needs Neon); the API, the migration and the production run (with `--allow-sqlite`) can also use a local SQLite file; `scripts/promote_admin.py` needs PostgreSQL |
| Sign-in | Clerk production instance | Clerk development instance (test keys) |
| Source | the GitHub repository connected to the Vercel project (Settings, Git), branch `main`; every push deploys | any branch |

The production run, the generators and the migrations run on a developer
machine with the full Python environment. The scripts that touch a database
act on the one in `POSTGRES_URL` or, when that is not set, `DATABASE_URL`, and
print which one that is; read it before you go on.

## Local development

```bash
npm install
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
```

Fill in `.env` (README.md lists every variable). Then, in two terminals:

```bash
uvicorn prism.api.app:app --reload --port 8000
npm run dev
```

and open http://localhost:3000. The Next.js dev server sends `/api/v1` to the
API (`PRISM_LOCAL_API_URL` changes the target). On first use the API creates
its tables and seeds the drivers. For a Shift Analysis to look at, write a
short run:

```bash
python3 scripts/run_production.py --iterations 2000
```

Keep the virtual environment active whenever you run Python: `npm run
test:py` and `npm run verify` call `python3`, and outside the environment that
is the system Python without pytest.

To keep the API and the production run on SQLite while the dashboard uses
Neon, blank both URLs for them only: `POSTGRES_URL= DATABASE_URL= uvicorn ...`
(a variable set in the shell, even empty, wins over `.env`); the production
run then also needs `--allow-sqlite`.

### Roles on a development machine

The Clerk webhook that adds new users to `user_roles` cannot reach
localhost, so a user who signs up locally has no row and is a viewer. Either
point the development instance's webhook at a tunnel to port 3000 (for
example `ngrok http 3000`, then the webhook URL
`https://<tunnel>/api/webhooks/clerk`), or add your row by hand in the
development database:

```sql
INSERT INTO user_roles (clerk_user_id, email, role) VALUES ('<your Clerk user id>', '<your email>', 'admin');
```

The Clerk user id is in the Clerk dashboard under Users.

## Tests and checks

| Command | Checks |
|---|---|
| `npm run verify` | everything below except the generator checks, in the order CI runs it (CI also runs `npm run build`) |
| `npm run typecheck` | TypeScript (`tsconfig.check.json`) |
| `npm run lint` | ESLint with no warnings allowed, then `scripts/check_single_source.sh`, which keeps the Shift Matrix arithmetic in `lib/shiftMatrix.ts` |
| `npm test` | the dashboard suite (Vitest, `tests/frontend/`) |
| `ruff check .` | Python lint |
| `python3 -m pytest -n auto` | the Python suite (`tests/`) |

The Python suite runs on a throwaway SQLite file: `tests/conftest.py` blanks
the database URLs before anything is imported, so a production URL in
`.env` never reaches a test. Set `PRISM_TEST_POSTGRES_URL` to a PostgreSQL
database the tests may create and drop schemas in, and the migration, the
database layer and the admin script are also tested on PostgreSQL:

```bash
PRISM_TEST_POSTGRES_URL="postgresql://prism:prism@localhost:5432/prism_test?sslmode=disable" python3 -m pytest -n auto
```

The generated files each have a check that regenerates them in memory and
compares:

```bash
python3 scripts/generate_seed.py --check               # prism/seed_drivers.py, data/driverCodeMap.ts
python3 scripts/build_cell_weights.py --check          # the cell-weight record, lib/cellWeightProvenance.ts, prism/cell_weight_estimate.py
python3 scripts/compute_overlap_correction.py --check  # the overlap-correction record, prism/overlap_correction.py
python3 scripts/build_driver_analysis.py --check       # the attribution record, the PRISM Analysis texts (prism/analysis_texts.py), the parity fixture
```

CI (`.github/workflows/ci.yml`) runs two jobs on every push to `main` and on
every pull request: the dashboard checks and a production build, and the
Python lint, suite (with a PostgreSQL service) and the four generator checks.
The build prerenders pages inside ClerkProvider, which needs a publishable
key of the right form, so CI sets one that names no real Clerk instance.

A few rules the suite holds:

- **Golden pins** (`tests/test_golden_pipeline.py`) fix the engine's output on
  a small driver set. They change only with a deliberate change of the model
  (with a new `MODEL_VERSION`, docs/adr/0014-versioning-and-golden-pins.md) or
  of those drivers, in the same commit.
- **One version**: `prism.__version__`, the engine's `MODEL_VERSION`,
  `package.json` and `package-lock.json` must agree.
- **Generated files** are never edited by hand.
- **Parity**: the taxonomies (the names of forces, categories, regions and
  value-chain stages), the source tiers and a source's link and length rules,
  the uncertainty tables, the per-driver attribution, the PRISM Analysis
  labels and the Consumer Journey tile shape exist in Python and TypeScript;
  tests keep each pair identical.
- **Colours** come from `lib/theme.ts` (the force and category palettes
  from `lib/format.ts`): a literal colour anywhere else in the dashboard's
  code, a named one or a class of Tailwind's own palette included, fails
  `tests/test_repository.py`, apart from three palettes that belong to one
  view each (the entry doors, the source grades, the Explorer's bars).
- **Scripts are entry points**: code two scripts share lives in `prism/`, and
  no script or migration imports a script.
- **Configuration**: the table in README.md and `.env.example` name the same
  variables, and every variable the code reads is one of them.

## The production run

```bash
python3 scripts/run_production.py
python3 scripts/run_production.py --cell-weights /path/outside/the/repo/cell_weights.json
```

The run reads the database in `POSTGRES_URL` or `DATABASE_URL`, refuses to
start without one unless `--allow-sqlite` is given, and takes a few minutes
at the default 3 x 50,000 iterations (`PRODUCTION_*` in `prism/config.py`). It
writes a new row to `simulation_runs`; the API serves the newest row from its
next request on, an open dashboard shows it within about a minute, and
earlier rows stay for the drift comparison. It also writes the QA
workbook to `runs/` (git-ignored): the Shift Matrix with its percentiles, the
regional medians, the cell weights (with the graded derivation when the
estimate was used), the velocities and the run's metadata.

| Option | Effect |
|---|---|
| `--cell-weights FILE` | the finance cell weights instead of the estimate |
| `--iterations N`, `--chains N` | iterations per chain (default 50,000; 100 to 1,000,000) and chains (default 3; 1 to 10) |
| `--allow-sqlite` | use the local SQLite file when no database URL is set |
| `--allow-nonpsd` | run although the correlation matrix is not positive definite on this driver mix; the engine repairs it and records an integrity event |

The cell-weights file is JSON, kept outside the repository:

```json
{
  "source": "HCB finance, gross profit FY2025",
  "basis": "gp1_share",
  "cells": {
    "Hair: Color": {"Europe": 0.094, "North America": 0.026, "Asia": 0.010, "High Growth": 0.041},
    "...": {}
  }
}
```

`cells` must name every category and region of `prism/config.py`. With
`"basis": "gp1_share"` the 52 shares must add up to 1 within 0.01; with
`"gp1_absolute"` the values are divided by their total before the engine sees
them, and none of them is stored. The `source` text is stored with the
run and shown next to it; a text that opens like the estimate's label
("ESTIMATE, not Henkel P&L") is refused, so a finance run can never be
mistaken for the estimate.

| Exit code | Meaning |
|---|---|
| 0 | the run is persisted (the workbook is best effort) |
| 1 | no usable database: none configured (without `--allow-sqlite`), unreachable, or awaiting a migration (the message names it) |
| 2 | the database holds no drivers (2 is also the code for a command line the script cannot read) |
| 3 | the simulation ran but storing it failed; the dashboard keeps serving the previous run |
| 4 | the correlation matrix is not positive definite on this driver mix |
| 5 | the run size is outside its range, the configuration in `prism/config.py` is invalid, or the cell-weights file is missing or invalid |
| 6 | a driver cannot be simulated (an unknown force, direction, curve or value-chain stage, a missing score, a score outside its scale, a peak year not after the onset, a category or region without an exposure score, an exposure on a name outside the taxonomy, a duplicate id); every problem is listed. PRISM stores no such driver, so this points at a change made to the database outside PRISM; a start year or a force corrected there needs the driver's revision raised by one as well, so the service reloads it |

Any other error stops the run with a traceback and exit code 1.

After a run, the Shift Analysis's "About this model" footer shows the new
run's id, date, master seed, numerics, Monte Carlo standard error, seed
stability and integrity events, including the input drift against the
previous run.

When scores or model parameters changed, regenerate the PRISM Analysis
readings after the run as docs/DRIVER_ANALYSIS.md describes. A run on the
finance file leaves the readings on the estimate, and a card says that its
figures come from another run whenever the served 2035 median differs, at one
decimal, from the one its basis line names; readings on the finance shares
need rewritten templates first (the same document, "On the finance shares").

## Deploying

Push to `main`: Vercel builds the dashboard and the Python function and
promotes the build to production in about two minutes. Other branches get
preview deployments. The environment variables live in the Vercel project
settings (Production and Preview). Vercel applies a change to any of them
only to deployments made after it, so redeploy after every change
(Deployments, the latest deployment, Redeploy);
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SIGNUP_CODE` are also
built into the dashboard's code. `PRISM_API_ORIGIN`, if used, belongs to
Production only: set for Preview as well, a preview deployment's admin
writes would go to the production API. A database that still needs
migration 0001 (the API answers 503 and names it) is moved in the order that
migration's runbook gives, the deploy first
(`migrations/0001_driver_schema/README.md`).

After a deploy:

```bash
curl -s https://prism-hcb.vercel.app/api/v1/health
```

must answer `"status": "ok"` with the driver count and `"has_simulation":
true`. Then open the dashboard and check that the Shift Analysis shows the
expected run. `/api/v1/diagnostics` explains a problem (see Troubleshooting).

A deploy never needs a restart for data to appear: each API instance checks
the database on every request that reads the drivers or the run, and reloads
them when the drivers' stamp or the newest run's id has changed. A deploy
also brings the PRISM Analysis texts, which ship with the code.

**Rollback**: in the Vercel dashboard, promote the previous production
deployment (Deployments, the deployment, Promote to Production), or revert
the commit and push. A deploy that came with a database migration is rolled
back as that migration's runbook says.

## The database

- **Backups.** Before any change to production data (a migration, a script
  that writes), create a Neon branch of the production branch. It is instant
  and it is the rollback.
- **Migrations.** A change to the schema or to existing data is a folder
  under `migrations/`, numbered, with the script and a runbook. The pattern
  of `0001_driver_schema`: everything in one transaction; a `--dry-run` that
  performs the migration and rolls back; `--postgres` required to change a
  PostgreSQL database; every dropped row written to a local archive before
  the commit; the migration recorded in `schema_migrations` and the audit
  log; texts an admin edited reported and left alone; tests on SQLite and
  PostgreSQL. A new migration is added to `SCHEMA_MIGRATIONS` in
  `prism/database.py`, whose schema then contains its result: a new database
  records it as done, and the API and the production run refuse a database
  that has not recorded it (503 and exit code 1, naming the migration).
- **The cell-weight estimate** is changed in `scripts/build_cell_weights.py`
  (its inputs and grades) with a new `VERSION`. Run it: it writes the record,
  `lib/cellWeightProvenance.ts` and `prism/cell_weight_estimate.py`, which
  `prism/config.py` reads. The new weights move the category and portfolio
  numbers: the change carries a new `MODEL_VERSION`, golden pins and a PRISM
  Analysis record rebuilt from a production run of the new code, all in one
  commit (docs/DRIVER_ANALYSIS.md, "Regeneration").
- **The audit log** records every driver edit (one row per changed field),
  journey save and migration in the same transaction as the change, with the
  acting identity. Role changes are recorded where the entry can be written:
  `scripts/promote_admin.py` writes it in the same transaction when the
  database has an audit log, and the dashboard's routes write it after the
  change, so a failed entry there does not undo the change. Nothing deletes
  from it.

## Roles and users

A user becomes admin at sign-up when `user_roles` is empty (the first user);
everyone else starts as viewer. Admins change other users' roles in
Settings, under User management, never their own. Two ways exist to set a
role without an admin session:

- `python3 scripts/promote_admin.py someone@example.com` (or `--role viewer`)
  with database access. It can change any role, the last admin's included;
- `POST /api/admin/bootstrap` with the header `x-bootstrap-secret` equal to
  `ADMIN_BOOTSTRAP_SECRET` and the body `{"email": "..."}` makes the user
  admin; it never takes a role away. The route exists only while the
  variable is set, and works only with a secret of at least 32 characters:
  set it, redeploy, call the route, then remove it and redeploy again.

Both need the user's row in `user_roles`, which the Clerk webhook adds at
sign-up.

## Setting up Clerk for a new environment

1. Create a Clerk application with email sign-in (and any SSO provider
   wanted).
2. Copy the publishable and secret keys into `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   and `CLERK_SECRET_KEY`.
3. Add a webhook endpoint `https://<domain>/api/webhooks/clerk` for the
   events `user.created`, `user.updated` and `user.deleted`, and copy its
   signing secret into `CLERK_WEBHOOK_SIGNING_SECRET`. The route rejects any
   request without a valid signature.
4. Restrict who may sign up, in the Clerk dashboard: the Restricted sign-up
   mode (users join by invitation) or an allowlist of email addresses or
   domains. The access code the sign-up page asks for
   (`NEXT_PUBLIC_SIGNUP_CODE`) is fixed at build time and readable in the
   browser, so it only keeps casual visitors out.
5. Deploy, sign up, and check that `user_roles` holds your row with the
   admin role.

## Troubleshooting

| Symptom | Cause and remedy |
|---|---|
| Every data request answers 401 | The dashboard and the API see different `PRISM_JWT_SECRET` values, or the value is shorter than 32 characters. Set the same value everywhere and redeploy |
| The dashboard says the service is unavailable, or a notice under the navigation says the data cannot be loaded | Check `/api/v1/health` and `/api/v1/diagnostics`. `simulation_reason` names the cause: `migration_pending` (the database needs a migration; the `error` field names it), `no_database` (neither `DATABASE_URL` nor `POSTGRES_URL` is set in this Vercel deployment) or `db_error` (the API cannot reach the database or a query failed; the `error` field says why) |
| The Shift Analysis is empty | `simulation_reason` in `/api/v1/diagnostics` is `no_rows` (write a run) or `malformed` (the newest run lacks a part the dashboard needs, such as a key, a category, region or year, a gross-profit share, its run metadata or a complete driver fingerprint; the `error` field lists them; write a new run) |
| Nobody is admin | The webhook did not reach the dashboard: check its deliveries in the Clerk dashboard, then set the role as described under Roles |
| The production run exits with 4 | The correlation settings are not positive definite on the current driver mix; lower the cross-force correlations in `prism/config.py` |

## Handover

`bash scripts/package_handover.sh` builds `PRISM_HANDOVER_<date>.zip`: a git
repository with a single commit of the tracked tree at `HEAD`. It refuses a
dirty working tree and fails if the exported tree holds a `.env` file other
than `.env.example`, a `runs/` or `archive/` folder, a database file or a
workbook anywhere, Clerk's local folder or a local working folder (a leading
underscore) at the root, or a string that looks like a secret. Three things
travel separately:

- the database, as a `pg_dump` of the Neon production branch;
- the finance cell-weights file, if one exists;
- the credentials, which are not handed over but rotated: the Clerk keys and
  webhook secret, the Neon password, `PRISM_JWT_SECRET` (the old tokens stop
  working, and an open dashboard fetches a new cookie on its next request, so
  nobody has to sign in again), `NEXT_PUBLIC_SIGNUP_CODE` and any
  `ADMIN_BOOTSTRAP_SECRET`. Each new value takes effect with the next
  deployment.

The services themselves belong to the owner's accounts today: the GitHub
repository, the Vercel project `prism-profit-pool`, the Neon project and the
Clerk application. Move each into an account the receiving organisation
controls, through the service's own transfer where it offers one, or by
creating it anew (a new Clerk application means new keys and a new webhook; a
new Neon project is restored from the dump). Rotate the credentials after the
move, and check the deployment against the list under Deploying.

## Hosting elsewhere

PRISM needs four things, which Vercel, Neon and Clerk provide today:

- a Node.js 22 host for the Next.js dashboard;
- a Python host for the ASGI app `prism.api.app:app`, reachable on the
  dashboard's origin under `/api/v1`: the browser's reads carry a cookie
  scoped to that path. The dashboard's admin routes call it on
  `PRISM_API_ORIGIN` when that is set, else on the same origin. It needs
  `api/requirements.txt` and an ASGI server such as uvicorn (Vercel brings
  its own);
- PostgreSQL. The dashboard reaches it through Neon's serverless driver
  (`lib/db.ts`); another PostgreSQL service means replacing that driver;
- an identity provider. Clerk is used in `lib/roles.ts`, `proxy.ts`,
  `app/layout.tsx` (the provider), the sign-in and sign-up pages, the webhook,
  the user list (`app/api/users`), the dashboard's user menu and the account
  and session parts of Settings; the API only verifies PRISM's own tokens.

The production run needs a machine or a job runner with the full Python
environment and access to the database. It must keep scipy: there is no
approximate engine.
