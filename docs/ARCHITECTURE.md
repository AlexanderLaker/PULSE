# Architecture

PRISM has three moving parts and one database. The production run computes
offline and writes its result to the database; the API serves that result and
the drivers; the dashboard shows them. Nothing on the web side ever runs the
simulation.

```
                      offline, on a machine with scipy
 ┌──────────────────────────────────────────────────────────────┐
 │ scripts/run_production.py                                    │
 │   load drivers → check correlations → 3 chains x 50,000      │
 │   → compare with the previous run → write run → QA workbook  │
 └──────────────────────────────┬───────────────────────────────┘
                                │ one results bundle per run
                                ▼
 ┌──────────────────────────────────────────────────────────────┐
 │ PostgreSQL (Neon)                                            │
 │   drivers and their exposures, sources and expert proposals, │
 │   simulation runs, journey content, audit log, user roles    │
 └───────────────┬──────────────────────────────┬───────────────┘
                 │                              │ user_roles
                 ▼                              ▼
 ┌───────────────────────────────┐   ┌──────────────────────────┐
 │ PRISM API (prism/api)         │   │ Dashboard server routes  │
 │ Vercel Python function        │◀──│ (app/api): roles, admin  │
 │ /api/v1: the run, drivers,    │   │ writes, viewer cookie,   │
 │ configuration, journey        │   │ Clerk webhook            │
 └───────────────▲───────────────┘   └────────────▲─────────────┘
                 │ reads (viewer cookie)          │
                 └──────────── Browser ───────────┘
                          Next.js dashboard, Clerk sign-in
```

## The production run

`scripts/run_production.py` is the only place a simulation runs for the
dashboard. It needs the full Python environment (`requirements-dev.txt`, with
scipy) and the database URL, and it:

1. loads the drivers ordered by id (the copula pairs draws with drivers by
   position, so the order is part of reproducibility);
2. checks that the configured correlations give a positive definite matrix on
   this driver mix, and refuses to run otherwise (`--allow-nonpsd` overrides);
3. runs three chains of 50,000 iterations with seeds derived from master seed
   42 and pools them;
4. compares the drivers' scoring state with the fingerprint stored with the
   previous run and records the difference as an integrity event;
5. stores the results bundle as a new row of `simulation_runs` (earlier rows
   stay);
6. writes a QA workbook to `runs/` (git-ignored).

Without `--cell-weights FILE` the run weights its cells with the estimated
HCB mix of `prism/config.py`; with it, with the finance shares in the file.
docs/OPERATIONS.md has the command, the file format and the exit codes.

### The results bundle

Every run stores one JSON document. The API refuses to serve a run that lacks
any of these keys (`prism/api/runs.py`).

| Key | Content |
|---|---|
| `shift_matrix` | Per category: `path` (per year the P10, P25, median, P75, P90, mean and standard deviation of the shift) and `velocity` (the distribution of the year-on-year change) |
| `regional_shift_matrix` | The same per category and region |
| `decompositions` | The force, value-chain and region attribution of every category's median, per year |
| `totals` | `category_path`, each category's median per year (the row total of every lens), and `portfolio`, the joint percentile path of the portfolio shift; the dashboard computes the column totals from the run's category shares |
| `cell_weights_used`, `category_weights_used`, `region_weights_used`, `cell_weights_source` | The gross-profit shares the run applied and where they came from |
| `mc_standard_error` | Bootstrap standard error of each category's terminal-year median, P10 and P90 |
| `seed_stability` | The terminal-year portfolio median of each chain and their spread |
| `integrity_events` | Everything the run repaired, assumed or noticed, including the input drift |
| `meta` | Master seed, chain seeds and chain count, model version, engine, numerics backend (scipy and numpy versions), driver count, overlap-correction source, time of storage, and the drivers' fingerprint for the next run |

docs/MODEL.md explains each quantity.

## The API

`prism/api` is a FastAPI application. On Vercel it runs as the Python function
`api/index.py`, and `vercel.json` rewrites every `/api/v1/*` request to it, so
the browser reaches it on the dashboard's own origin. Locally it runs under
uvicorn, loading the repository's `.env` first (`prism/env_loader.py`;
variables set in the shell win), and the Next.js dev server rewrites `/api/v1`
to it (`next.config.js`). The function installs only `api/requirements.txt`
(FastAPI, pydantic, psycopg2): it has no numpy or scipy and never imports the
engine.

| Route | Access | Answer |
|---|---|---|
| `GET /api/v1/health` | anonymous | Status, version, driver count, whether a run exists and its id; when the database cannot be used, status `degraded` and the reason (`migration_pending`, `no_database` or `db_error`) |
| `GET /api/v1/diagnostics` | anonymous | What this instance sees of the database (host name only) and whether the latest run can be served |
| `GET /api/v1/drivers` | signed in | Every driver with its scores, sources, PRISM Analysis, baseline and a summary of the expert proposals |
| `PUT /api/v1/drivers/{id}` | admin | An edit of the fields sent, made on the driver revision the request names (409 when the driver changed since); an exposure map changes only the cells it names; every changed field goes to the audit log. Name, force and onset are not edited here, and a peak year must fall after the onset |
| `GET /api/v1/drivers/{id}/proposals` | signed in | The caller's own proposal, the aggregate across experts and who scored what |
| `PUT /api/v1/drivers/{id}/proposals` | signed in | Merges the fields sent into the caller's own proposal (a field sent as null is cleared); never changes the driver |
| `GET /api/v1/simulation` | signed in | The latest run (the bundle above, with `meta` as `run_meta` plus the run's id, date and iteration count) and `inputs_since_run`, the drivers changed, added or removed since the run; 404 when there is none to serve |
| `GET /api/v1/config` | signed in | The model configuration the production run uses, read-only |
| `GET /api/v1/journey` | signed in | `{version, content}`: the newest stored Consumer Journey tile map, or version 0 and no content while the dashboard's bundled content applies |
| `PUT /api/v1/journey` | admin | Stores a new version of the whole tile map, edited from the version the request names (409 when another save came in between) |

A body the API cannot accept is answered 422 with the reason, and a write
made on an outdated revision or version 409; the dashboard shows both
messages as they come. While the database cannot be used the routes that read
or write it answer 503: with the migration to run when the schema is older
than the code, with the missing setting when no database is configured, and
with "try again in a moment" when the database cannot be reached after three
attempts (the details go to the log, never to the browser).

Each instance keeps the drivers and the latest run in memory
(`prism/api/state.py`) and checks on every request whether the database moved
on: the drivers are reloaded when their stamp changes (the row count and the
sum of the row revisions, raised by every saved driver row), the run when a
newer id appears. A production run, a script or an edit made through another
instance is therefore visible on the next request.

On an empty database the API creates the tables and seeds the driver base
(`prism/seed_drivers.py`). On a database that still needs a migration it
creates nothing and answers 503 naming the migration
(`migrations/0001_driver_schema`, run with its README as the runbook); on
Vercel without a database URL it answers 503 too, rather than writing to a
SQLite file that would vanish with the instance.

## Authentication and roles

Clerk owns identity (sign-up, sign-in, sessions). PRISM owns the role, in the
`user_roles` table: the Clerk webhook (`app/api/webhooks/clerk`) adds a row
when a user signs up, the first user ever as admin and everyone after that as
viewer. Admins change roles in Settings.

The API never sees a Clerk session. It verifies HS256 tokens signed with
`PRISM_JWT_SECRET`, which the dashboard's server routes issue for the
signed-in user (`lib/prismJwt.ts`, verified in `prism/api/auth.py`):

- **Reads and proposals.** On load the dashboard calls `/api/prism-cookie`,
  which sets an httpOnly cookie scoped to `/api/v1` holding a 12-hour token
  with the viewer role, for admins too. The browser's `/api/v1` requests carry
  it. It authorises reads and the user's own expert proposals, nothing else.
  When an `/api/v1` request is answered 401 (the token expired), the client
  asks for a new cookie once and repeats the request (`lib/apiClient.ts`).
- **Admin writes.** A driver edit or a journey save goes to a dashboard route
  (`/api/drivers/{id}`, `/api/journey`). The route checks the user's role in
  `user_roles`, then forwards the request to the API (on `PRISM_API_ORIGIN`
  when that is set, else on the origin the request came in on) with a
  five-minute admin token that carries the user's identity
  (`lib/backend.ts`). The API writes that identity to the audit log.

Both tokens carry the user's Clerk id, email, role and, when Clerk has one,
their full name, which the proposals list shows next to each expert's scores
(the email's local part when there is no name).

`proxy.ts` requires a Clerk session for every page and dashboard route except
the sign-in and sign-up pages, the webhook (which checks its Svix signature)
and the admin bootstrap route (which checks a shared secret). `/api/v1` is
left to the API's own checks.

The dashboard's server routes (`app/api`):

| Route | Access | Does |
|---|---|---|
| `GET /api/prism-cookie` | signed in | Sets the viewer cookie for `/api/v1` |
| `GET /api/me` | signed in | The user's Clerk id, email and role |
| `PUT /api/drivers/{id}` | admin | Forwards a driver edit to the API with an admin token |
| `PUT /api/journey` | admin | Forwards a journey save to the API with an admin token |
| `GET /api/users` | admin | Every Clerk user with their role, for the user list in Settings |
| `PATCH /api/users/{userId}/role` | admin | Changes a role (never the caller's own) and writes it to the audit log where possible; a failed audit write does not undo the change |
| `POST /api/webhooks/clerk` | Svix signature | Adds, updates or removes a user's row in `user_roles` |
| `POST /api/admin/bootstrap` | shared secret | Makes a signed-up user admin; exists only while `ADMIN_BOOTSTRAP_SECRET` is set |

## The dashboard

Next.js with the App Router, React and TypeScript. `app/dashboard/page.tsx`
holds the top navigation and mounts `PrismProvider` (`hooks/usePrism.ts`),
which loads the drivers, the configuration and the latest run and shares them
with every view. It asks `/api/v1/health` every minute (every 30 seconds while
the service is unreachable or degraded) and reloads when the service recovers
or a newer run appears, so an open dashboard shows a new production run
within about a minute. The views are in `components/dashboard/`, each page in
one file and its parts in a folder of its own:

| View | File | What it shows |
|---|---|---|
| Entry gate | `HomeGate.tsx` | The four views and what each is for |
| Drivers | `Drivers.tsx`, `drivers/` | The drivers with their scores, sources and PRISM Analysis; Expert Rating, where every signed-in user can propose scores; for admins the editor and Review & Endorse, which sets the expert aggregate against the driver's scores. `Drivers.tsx` is the table; `drivers/` holds the row, the three panels, the PRISM Analysis card and the scales and cards they share |
| Consumer Journey | `ConsumerJourney.tsx`, `journey/` | Consumer moments per journey stage with the drivers behind them; admins edit the tiles. `journey/` holds the tile parts, the tile dialog, its why-chain and the tile editor |
| Profit Pool Shift Analysis | `ShiftAnalysis.tsx`, `shift/` | The Shift Matrix through the four lenses, the portfolio band and the drill-down per category (`shift/CategoryDetailPanel.tsx`); `shift/` also holds the matrix model, the toolbar, the state without a run and the "About this model" footer |
| Profit Pool Explorer (beta) | `ProfitPoolExplorer.tsx`, `explorer/` | Sourced profit pool views of the Hair and Laundry & Home Care industries |
| Settings | `SettingsModal.tsx`, `settings/` | Profile, password and sessions (from Clerk); the model configuration, read-only: the code's parameters and the cell weights the served run used; the user list for admins |

`Chip.tsx`, `SectionCard.tsx` and `ShiftValue.tsx` are the pieces several
views share: one look for a label, for a boxed section and for a signed shift.

Shared logic lives in `lib/`: `apiClient.ts` (every request the dashboard
makes), `format.ts` (the one way a shift is displayed, the taxonomies),
`shiftMatrix.ts` (the category-weighted totals; a lint step keeps them from
being reimplemented in a component), `cellWeights.ts`, `valueChain.ts`,
`uncertainty.ts` (what an uncertainty score does in the engine),
`driverAttribution.ts` (the per-driver decomposition the drill-down ranks
with) and `theme.ts` (the design tokens, which Tailwind reads too); the server
side has `db.ts`, `roles.ts`, `prismJwt.ts` and `backend.ts`. The types in
`types/` mirror the API's JSON.

The Consumer Journey content ships with the dashboard (`data/consumerJourney.ts`);
once an admin saves an edit, the newest stored version replaces the bundled
tiles. The Profit Pool Explorer's data is `lib/profitPoolData.ts`
(docs/EXPLORER.md). Neither feeds the simulation.

## The database

PostgreSQL in production; on a development machine the API and the scripts
fall back to a SQLite file (`PRISM_DB_PATH`, default `data/prism.db`) when no
database URL is set, and on Vercel they refuse to. All SQL is written once for
both (`prism/database.py`). The database holds scores, shares and percentage
shifts, never an amount of money.

| Table | Written by | Content |
|---|---|---|
| `drivers` | seed, admin edits, `sync_analysis.py` | One row per driver: scores, texts, the baseline it was seeded with, whether an admin changed a model field, a revision counter |
| `driver_category_exposure`, `driver_regional_exposure`, `driver_vc_exposure` | as above | Exposure scores 0 to 5 per category, region and value-chain stage |
| `driver_sources` | as above | The evidence behind each driver: title, link, credibility tier and a note |
| `driver_score_proposals` | experts | One partial proposal per driver and expert |
| `simulation_runs` | production run | One results bundle per run |
| `journey_content` | admins | Versions of the Consumer Journey tile map; the newest wins |
| `audit_log` | API, dashboard, scripts | Every driver edit, journey save, role change, analysis sync and migration, with the acting identity |
| `schema_migrations` | API, migrations | The migrations the schema already contains |
| `user_roles` | dashboard | Clerk user id, email and role |

A driver row is upserted, never deleted and re-inserted, because the expert
proposals reference it with `ON DELETE CASCADE`.

## Deployment

Vercel builds the Next.js app (`next build`) and the Python function from the
same repository; pushing to `main` deploys to production. `.vercelignore`
keeps the tests, scripts, migrations, documentation and generator inputs out
of the deployment. The production run, the generators and the migrations run
on a developer machine with the full Python environment. docs/OPERATIONS.md
has the procedures.
