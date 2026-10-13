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
   stay), with the commit its code came from and whether tracked files had
   uncommitted changes;
6. writes a QA workbook to `runs/` (git-ignored).

On PostgreSQL a stored run is served at once, so only the production size
runs there unless `--allow-test-size` is given; a new local SQLite file
(`--allow-sqlite`) is seeded with the driver base first, and one that lost
its drivers is not.

Without `--cell-weights FILE` the run weights its cells with the estimated
HCB mix of `prism/config.py`; with it, with the finance shares in the file.
docs/OPERATIONS.md has the command, the file format and the exit codes.

### The results bundle

Every run stores one JSON document. The API serves a run only when it
carries every key below, covers every category, region and year the
dashboard lays out, holds a gross-profit share for every cell and category,
and has its run metadata and a complete driver fingerprint
(`prism/api/runs.py`); it refuses any other run, so a run made before a
change to the taxonomy or the horizon is reported rather than shown.

| Key | Content |
|---|---|
| `shift_matrix` | Per category: `path` (per year the P10, P25, median, P75, P90, mean and standard deviation of the shift) and `velocity` (the distribution of the year-on-year change) |
| `regional_shift_matrix` | Per category and region: `path` as above, and `velocity` with the median, P10 and P90 of the year-on-year change |
| `decompositions` | The force, value-chain and region attribution of every category's median, per year (the median only; cells and bands are not attributed) |
| `totals` | `category_path`, each category's median per year (the row total of every lens), and `portfolio`, the joint percentile path of the portfolio shift; the dashboard computes the column totals from the run's category shares |
| `cell_weights_used`, `category_weights_used`, `region_weights_used`, `cell_weights_source` | The gross-profit shares the run applied and where they came from |
| `mc_standard_error` | Bootstrap standard error of each category's terminal-year median, P10 and P90 |
| `seed_stability` | The terminal-year portfolio median of each chain and their spread |
| `integrity_events` | Everything the run repaired or clipped, and the input drift |
| `meta` | Master seed, chain seeds and chain count, model version, engine, numerics backend (scipy and numpy versions), driver count, overlap-correction source, the drivers' fingerprint for the next run, and `source`, the commit of the code and whether tracked files had uncommitted changes (both null outside a git checkout) |

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
| `GET /api/v1/health` | anonymous | Status, version, the commit the deployment was built from, driver count, whether a run exists and its id; when the database cannot be used, status `degraded` and the reason (`migration_pending`, `no_database`, `drivers_missing` or `db_error`) |
| `GET /api/v1/diagnostics` | anonymous | Whether this instance reaches the database, how many runs it holds and whether the latest can be served, with the same reasons as `/health` when the database cannot be used; it names nothing about the database itself |
| `GET /api/v1/drivers` | signed in | Every driver with its scores, sources, PRISM Analysis (from `prism/analysis_texts.py`, which ships with the code), baseline and a summary of the expert proposals |
| `PUT /api/v1/drivers/{id}` | admin | An edit of the fields sent, made on the driver revision the request names (409 when the driver changed since); an exposure map changes only the cells it names; every changed field goes to the audit log. Name, force and onset are not edited here, and a peak year must fall after the onset |
| `GET /api/v1/drivers/{id}/proposals` | signed in | The caller's own proposal, the aggregate across experts and who scored what |
| `PUT /api/v1/drivers/{id}/proposals` | signed in | Merges the fields sent into the caller's own proposal (a field sent as null is cleared); never changes the driver |
| `GET /api/v1/simulation` | signed in | The latest run: the bundle above, with `run_meta` in place of `meta` (the run's id, date and iterations per chain, and from `meta` the seeds, chain count, model version, engine, numerics backend, driver count and overlap-correction source), and `inputs_since_run`, the drivers changed, added or removed since the run; 404 when there is none to serve |
| `GET /api/v1/config` | signed in | The model configuration the production run uses, read-only |
| `GET /api/v1/journey` | signed in | `{version, content}`: the newest stored Consumer Journey tile map, or version 0 and no content while the dashboard's bundled content applies |
| `PUT /api/v1/journey` | admin | Stores a new version of the whole tile map, edited from the version the request names (409 when another save came in between); a map the dashboard could not render, or one citing a code that is not a driver, is refused (`prism/journey.py`) |

A body the API cannot accept is answered 422 with the reason, which the
dashboard shows as it comes (its own server routes answer 400 to a body they
refuse before forwarding it). A write made on an outdated revision or version
is answered 409, and the editor says in its own words that someone saved in
between and how to get the current version. A write that gets no answer from
the API (a timeout, a lost connection, a 502 or 504 from the gateway or from
the dashboard's route) may still have been stored: the editors say so and ask
for the stored version before the next save. While the database cannot be used
the routes that read or write it answer 503: with the migration to run when
the schema is older than the code, with the missing setting when no database
is configured, and with "try again in a moment" when the database cannot be
reached after three attempts, each of which waits at most ten seconds for
the server (the details go to the log, never to the browser). `/health` and `/diagnostics` answer 200 even then and say what is
wrong (`/health` with status `degraded`, both with the reason). Any other
database error is logged and answered 500.

Each instance keeps the drivers and the latest run in memory
(`prism/api/state.py`). A request that reads them first checks whether the
database moved on (the driver routes, the run and `/health` read the
drivers; the run and `/diagnostics` read the run): the drivers are reloaded
when their stamp changes (the row count and the sum of the row revisions,
raised by every saved driver row), the run when the newest run's id is no
longer the one held. A production run, a migration or an edit made through
another instance is therefore visible on the next such request.

On an empty database the API creates the tables and seeds the driver base
(`prism/seed_drivers.py`). It seeds only a new database: one that stores a
run or an audited driver edit but no drivers has lost them, so the API
answers 503 for the drivers, the run and every write (`drivers_missing` in
`/health` and `/diagnostics`) until it is restored from its backup, never
filling it with the base; the configuration and the stored Journey stay
readable. On a database that still needs a
migration it creates nothing and answers 503 naming the migration
(`migrations/0001_driver_schema`, run with its README as the runbook); on
Vercel without a database URL it answers 503 too, rather than writing to a
SQLite file that would vanish with the instance.

## Authentication and roles

Clerk owns identity (sign-up, sign-in, sessions). PRISM owns the role, in the
`user_roles` table: the Clerk webhook (`app/api/webhooks/clerk`) adds a row
when a user signs up, as admin when the table is empty (the first user) and
as viewer otherwise. Admins change other users' roles in Settings, never
their own.

The API never sees a Clerk session. It verifies HS256 tokens signed with
`PRISM_JWT_SECRET`, which the dashboard's server routes issue for the
signed-in user (`lib/prismJwt.ts`, verified in `prism/api/auth.py`):

- **Reads and proposals.** On load the dashboard calls `/api/prism-cookie`,
  which sets an httpOnly cookie scoped to `/api/v1` holding a 30-minute token
  with the viewer role, for admins too. The browser's `/api/v1` requests carry
  it. It authorises reads and the user's own expert proposals, nothing else.
  When an `/api/v1` request is answered 401 (the token expired), the client
  asks for a new cookie once and repeats the request (`lib/apiClient.ts`).
  The cookie is not tied to the Clerk session, so the dashboard expires it
  (`DELETE /api/prism-cookie`) before signing out and when the session ends,
  and in place of a cookie it cannot renew. Signing out first sends the
  expert proposal edits still held back or on their way and waits up to five
  seconds for them, while the cookie still authorises them
  (`lib/session.ts`).
- **Admin writes.** A driver edit or a journey save goes to a dashboard route
  (`/api/drivers/{id}`, `/api/journey`). The route checks the user's role in
  `user_roles`, then forwards the request to the API (on `PRISM_API_ORIGIN`
  when that is set, else on the origin the request came in on) with a
  five-minute admin token that carries the user's identity
  (`lib/adminWrite.ts`). The API writes that identity to the audit log.

Both tokens carry the user's Clerk id, email, role and, when Clerk has one,
their full name, which the proposals list shows next to each expert's scores
(the email's local part when there is no name).

`proxy.ts` requires a Clerk session for every page and dashboard route except
the sign-in and sign-up pages, the webhook (which checks its Svix signature),
the admin bootstrap route (which checks a shared secret) and
`DELETE /api/prism-cookie`, which only expires the cookie. `/api/v1` is left to
the API's own checks.

The dashboard's server routes (`app/api`):

| Route | Access | Does |
|---|---|---|
| `GET /api/prism-cookie` | signed in | Sets the viewer cookie for `/api/v1`; 503 while `PRISM_JWT_SECRET` is missing or shorter than 32 characters |
| `DELETE /api/prism-cookie` | anyone | Expires the viewer cookie |
| `GET /api/me` | signed in | The user's Clerk id, email and role |
| `PUT /api/drivers/{id}` | admin | Forwards a driver edit to the API with an admin token |
| `PUT /api/journey` | admin | Forwards a journey save to the API with an admin token |
| `GET /api/users` | admin | The Clerk users (up to 500, newest first) with their roles, for the user list in Settings |
| `PATCH /api/users/{userId}/role` | admin | Changes a role (never the caller's own) and writes it to the audit log where possible; a failed audit write does not undo the change. A user the webhook has not added yet gets their row first, with the email Clerk holds (409 while it holds none, as the webhook skips such a user) |
| `POST /api/webhooks/clerk` | Svix signature | Adds, updates or removes a user's row in `user_roles` |
| `POST /api/admin/bootstrap` | shared secret | Makes a signed-up user admin while no admin exists; exists only while `ADMIN_BOOTSTRAP_SECRET` is set |

## The dashboard

Next.js with the App Router, React and TypeScript. `app/dashboard/page.tsx`
holds the top navigation and mounts `PrismProvider` (`hooks/usePrism.tsx`),
which loads the drivers, the configuration and the latest run and shares them
with every view. It asks `/api/v1/health` every minute (every 30 seconds while
the service is unreachable or degraded) and reloads when the service recovers
or a newer run appears, so an open dashboard shows a new production run
within about a minute. While the database cannot be used, the views keep what
they last loaded and a notice under the navigation says why. The views are in
`components/dashboard/`, each page in one file and its parts in a folder of
its own:

| View | File | What it shows |
|---|---|---|
| Entry gate | `HomeGate.tsx` | The four views and what each is for |
| Drivers | `Drivers.tsx`, `drivers/` | The drivers with their scores, sources and PRISM Analysis; Expert Rating, where every signed-in user can propose scores; for admins the editor and Review & Endorse, which sets the expert aggregate against the baseline and endorses the chosen values as an ordinary edit. `Drivers.tsx` is the table; `drivers/` holds the row, the three panels, the PRISM Analysis card and the scales and cards they share |
| Consumer Journey | `ConsumerJourney.tsx`, `journey/` | Consumer moments per journey stage with the drivers behind them; admins edit the tiles. `journey/` holds the tile parts, the tile dialog, its why-chain and the tile editor |
| Profit Pool Shift Analysis | `ShiftAnalysis.tsx`, `shift/` | The Shift Matrix through the four lenses, the portfolio band and the drill-down per category (`shift/CategoryDetailPanel.tsx`). The page attributes the run to the drivers once, at the score means: the drill-down ranks its drivers with it and the Time Path's Expansion and Contraction filters split the median with it. `shift/` also holds the matrix model, the toolbar, the state without a run and the "About this model" footer |
| Profit Pool Explorer (beta) | `ProfitPoolExplorer.tsx`, `explorer/` | Sourced profit pool views of the Hair and Laundry & Home Care industries |
| Settings | `SettingsModal.tsx`, `settings/` | Profile, password and sessions (from Clerk); the model configuration, read-only: the code's parameters and the cell weights the served run used; the user list for admins |

`Chip.tsx` and `SectionCard.tsx` are the pieces several views share: one look
for a label and one for a boxed section. The shell around the views is
`WelcomeModal.tsx` (the orientation shown once per sign-in),
`ServiceNotice.tsx` (the banner while the database cannot be used),
`ErrorBoundary.tsx` and `LoadingSkeleton.tsx`.

Shared logic lives in `lib/`: `apiClient.ts` (every request the dashboard
makes), `apiError.ts` (one readable line from an error answer, for the client
and the server routes alike), `format.ts` (the one way a shift is displayed,
the taxonomies), `shiftMatrix.ts` (the category-weighted totals; a lint step
keeps them from being reimplemented in a component), `cellWeights.ts`,
`valueChain.ts`, `uncertainty.ts` (what an uncertainty score does in the
engine), `driverAttribution.ts` (the per-driver decomposition behind the
drill-down and the impact filter), `proposalSaves.ts` (the expert proposals'
save queue, one per driver), `session.ts` (signing out) and `theme.ts` (the
design tokens, which Tailwind reads too); the server side has `db.ts`,
`roles.ts`, `audit.ts` (the role-change entries of the audit log),
`prismJwt.ts` and `adminWrite.ts`. The types in `types/` mirror the API's
JSON.

The Consumer Journey content ships with the dashboard
(`data/consumerJourney.ts`, which also defines its shape); once an admin saves
an edit, the newest stored version replaces the bundled tiles. The Profit Pool
Explorer's data is `lib/profitPoolData.ts` (docs/EXPLORER.md). Neither feeds
the simulation.

## The database

PostgreSQL in production. On a development machine with no database URL set,
the API and the migration fall back to a SQLite file (`PRISM_DB_PATH`,
default `data/prism.db`); the production run does so only with
`--allow-sqlite`, `scripts/promote_admin.py` needs PostgreSQL, and on Vercel
the API refuses to. All SQL is written once for both (`prism/database.py`).
The database holds scores, shares and percentage shifts, never an HCB
financial figure; texts (driver descriptions and sources, the Consumer
Journey content) may quote public market figures as evidence.

| Table | Written by | Content |
|---|---|---|
| `drivers` | seed, admin edits, migrations | One row per driver: scores (the value-chain epicentre among them), name, description, the baseline it was seeded with, whether an admin changed a model field, a revision counter |
| `driver_category_exposure`, `driver_regional_exposure` | as above | An exposure score 0 to 5 for every category and every region of every driver |
| `driver_sources` | as above | The evidence behind each driver: title, link, credibility tier and publication date |
| `driver_score_proposals` | experts, migrations | One partial proposal per driver and expert |
| `simulation_runs` | production run, migrations | One results bundle per run |
| `journey_content` | admins, migrations | Versions of the Consumer Journey tile map; the newest wins |
| `audit_log` | API, dashboard, migrations, `scripts/promote_admin.py` | Driver edits (one row per changed field, the field named in `reason`, old and new value as JSON), journey saves, role changes where the entry can be written and migrations, each with the acting identity |
| `schema_migrations` | API, migrations | The migrations the schema already contains |
| `user_roles` | dashboard, `scripts/promote_admin.py` | Clerk user id, email and role |

A stored driver can always be simulated. The constraints of the schema,
generated from the taxonomies in `prism/config.py`, require every field the
engine reads, hold each score and share on its scale and refuse a force,
curve, stage or exposure key outside the taxonomy. The functions that write
drivers (`insert_drivers`, `save_driver_edit`) run the engine's own check,
`simulation_problems`, before anything is written, which adds what the
constraints leave out: the onset and peak years, the peak after the onset
(a rule that depends on the model's base year) and a score for every
category and every region. An edit updates the driver row in place; the
expert proposals reference it with `ON DELETE CASCADE`, so they go only with
a deleted driver.

## Deployment

Vercel builds the Next.js app (`next build`) and the Python function from the
same repository; pushing to `main` deploys to production. `.vercelignore`
keeps the tests, scripts, migrations, documentation, the driver base and the
generated records (`data/drivers/`, `data/parameters/`) out of the
deployment. `vercel.json` sets security headers on every response, the
API's included: no page may be framed (`frame-ancestors 'none'`,
`X-Frame-Options: DENY`), no response is sniffed for another content type,
the referrer leaves the site as its origin only, the camera, microphone and
location are switched off, and search engines are asked not to index. The
API serves its interactive documentation (`/docs`, `/redoc`,
`/openapi.json`) only where `PRISM_API_DOCS=1` asks for it, on a development
machine, and never on Vercel. The production run, the generators and the
migrations run on a developer machine with the full Python environment.
docs/OPERATIONS.md has the procedures.
