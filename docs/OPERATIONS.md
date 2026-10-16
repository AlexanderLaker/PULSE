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

**Previews.** Every branch other than `main` gets a preview deployment, built
with the variables set for Preview. Give Preview values of its own: a Neon
branch rather than production's database URL, its own `PRISM_JWT_SECRET` and
a Clerk development instance. With production's values a preview reads and
writes production data and mints tokens the production API accepts. Previews
sit behind Vercel Authentication (Settings, Deployment Protection); keep it
on, so only members of the Vercel team can open them.

**Regions.** The functions run in Vercel's `iad1` region (Washington, D.C.)
and the database in Neon's AWS `us-east-1`, next to each other, both in the
United States. A move to EU regions moves both: the function region (the
project settings, or `"regions"` in `vercel.json`) and the database (a new
Neon project in the EU, restored from a dump as under Backups and restore).

## Local development

```bash
npm ci
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
```

Fill in `.env` (README.md lists every variable), with the keys of your own
Clerk development instance: without them, `npm run dev` starts Clerk's
keyless mode, which creates a temporary instance over the internet and
writes its keys to `.clerk/` (git-ignored, and never part of a handover).
Then, in two terminals:

```bash
uvicorn prism.api.app:app --reload --port 8000
npm run dev
```

and open http://localhost:3000. The Next.js dev server sends `/api/v1` to the
API (`PRISM_LOCAL_API_URL` changes the target). On first use the API creates
its tables and seeds the drivers. For a Shift Analysis to look at, write a
short run (`--allow-test-size`: a run stored in PostgreSQL is served at
once, so a size other than the production one needs saying so):

```bash
python3 scripts/run_production.py --iterations 2000 --allow-test-size
```

Keep the virtual environment active whenever you run Python: `npm run
test:py` and `npm run verify` call `python3`, and outside the environment that
is the system Python without pytest.

To keep the API and the production run on SQLite while the dashboard uses
Neon, blank both URLs for them only: `POSTGRES_URL= DATABASE_URL= uvicorn ...`
(a variable set in the shell, even empty, wins over `.env`); the production
run then also needs `--allow-sqlite`.

### Roles on a development machine

A user who signs up has no row in `user_roles` and sees only the waiting page
until an admin approves them, and a new development database has no admin.
Make yourself the first: sign up, then add your row by hand in the
development database,

```sql
INSERT INTO user_roles (clerk_user_id, email, role) VALUES ('<your Clerk user id>', '<your email>', 'admin');
```

(the Clerk user id is in the Clerk dashboard under Users), or call the
bootstrap route on `http://localhost:3000` as under Roles and users, with
`ADMIN_BOOTSTRAP_SECRET` and `ADMIN_BOOTSTRAP_EMAIL` in `.env` and the dev
server restarted. Approve anyone else in Settings. The Clerk webhook, which
keeps the emails current and removes deleted users, cannot reach localhost;
if you need it, point the development instance's webhook at a tunnel to port
3000 (for example `ngrok http 3000`, then the webhook URL
`https://<tunnel>/api/webhooks/clerk`).

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

Two more variables belong to the suite alone: `PRISM_TEST_ALLOW_POSTGRES`
and `PRISM_TEST_DATABASE_ON_POSTGRES` are set by the tests for the
subprocesses they start against the test database. Never set them by hand:
the first lifts the guard that keeps the database in `.env` away from the
tests.

The generated files each have a check that regenerates them in memory and
compares:

| Command | Files it checks |
|---|---|
| `python3 scripts/generate_seed.py --check` | `prism/seed_drivers.py`, `data/driverCodeMap.ts` |
| `python3 scripts/build_cell_weights.py --check` | the cell-weight record, `lib/cellWeightProvenance.ts`, `prism/cell_weight_estimate.py` |
| `python3 scripts/compute_overlap_correction.py --check` | the overlap-correction record, `prism/overlap_correction.py` |
| `python3 scripts/build_driver_analysis.py --check` | the attribution record, the PRISM Analysis texts (`prism/analysis_texts.py`), the parity fixture |
| `python3 scripts/build_content.py --check` | the Consumer Journey and Profit Pool Explorer content the API serves (`prism/journey_content.py`, `prism/explorer_content.py`, from `data/content/*.json`) |

CI (`.github/workflows/ci.yml`) runs two jobs on every push to `main` and on
every pull request: the dashboard checks and a production build, and the
Python lint, suite (with a PostgreSQL service) and the five generator checks.
Started by hand (Actions, ci, Run workflow), it also runs the full production
run against the reference run.
The build prerenders pages inside ClerkProvider, which needs a publishable
key of the right form, so CI sets one that names no real Clerk instance.

A few rules the suite holds:

- **Golden pins** fix the engine's output: `tests/test_golden_pipeline.py`
  on a small driver set, and the production pin (`tests/golden_production.py`,
  values in `tests/golden_production.json`) on the driver base with the
  production configuration, seed and three chains at 2,000 iterations. They
  change only with a deliberate change of the model (with a new
  `MODEL_VERSION`, docs/adr/0014-versioning-and-golden-pins.md) or of the
  drivers they run on, in the same commit; `python3 tests/golden_production.py
  --write` regenerates the production pin.
- **The full run** at the production size is checked against the reference
  run of the PRISM Analysis record when asked for, because it takes a few
  minutes: `PRISM_FULL_RUN=1 python3 -m pytest tests/test_reference_run.py`
  (CI runs it when started by hand). Run it before a release and after any
  change to the engine, the configuration or the numpy and scipy versions.
- **One version**: `prism.__version__`, the engine's `MODEL_VERSION`,
  `package.json` and `package-lock.json` must agree.
- **Generated files** are never edited by hand.
- **Parity**: the taxonomies (the names of forces, categories, regions,
  value-chain stages, directions, confidence levels and diffusion curves),
  the horizon, the source tiers and a source's link and length rules, the
  category names the PRISM Analysis uses, the uncertainty tables, the
  per-driver attribution, the PRISM Analysis labels, the driver request
  shapes, the estimate's label, the earliest peak year, the token secret's
  minimum length, the Consumer Journey tile shape and the Explorer's view
  shape exist in Python and TypeScript; tests keep each pair identical.
- **Colours** come from `lib/theme.ts` (the force and category palettes
  from `lib/format.ts`): a literal colour anywhere else in the dashboard's
  code, a named one or a class of Tailwind's own palette included, fails
  `tests/test_repository.py`, apart from three palettes that belong to one
  view each (the entry doors, the source grades, the Explorer's bars).
- **Scripts are entry points**: code two scripts share lives in `prism/`, and
  no script or migration imports a script.
- **Configuration**: the table in README.md and `.env.example` name the same
  variables, and every variable the code reads is one of them.
- **Documents**: the figures the documents take from the model and its
  records (a parameter, a table, a count, a tolerance), the design tokens and
  the security and session settings are computed in `tests/test_documents.py`,
  which fails until the document says the same.

## Dependencies

- **npm.** `package-lock.json` pins every package. Install with `npm ci`,
  which installs exactly the lock; `npm install` may rewrite it.
- **Python.** The ranges live in `requirements-dev.in` (the engine, the
  production run, the API and the tests) and `api/requirements.in` (what the
  Vercel function imports). `requirements-dev.txt` and `api/requirements.txt`
  pin the exact versions resolved from them, and they are what developers,
  CI and Vercel install. After changing a range, regenerate the pinned file
  with uv (`pip install uv`) and commit both:

  ```bash
  uv pip compile requirements-dev.in --universal --python-version 3.11 -o requirements-dev.txt
  uv pip compile api/requirements.in --python-version 3.12 -o api/requirements.txt
  ```

  `tests/test_repository.py` checks that every declared requirement is pinned
  inside its range, and that every package the function installs is pinned at
  the same version in `requirements-dev.txt`, so the API runs on the versions
  the suite tested. An update by hand therefore regenerates both files.
- **The Python version** is the one in `.python-version` (3.12): Vercel reads
  it for the function and CI installs it. The development pins also work on
  3.11 and later.
- **numpy and scipy** stay at the versions the golden pins and the reference
  run were computed with. They move only with a model release, which
  regenerates the pins and runs the full check (`PRISM_FULL_RUN=1`).
- **Updates and audits.** Dependabot proposes updates
  (`.github/dependabot.yml`), weekly for npm and Python and monthly for the CI
  workflow's actions, each checked by CI: for npm one pull request with the
  minor and patch updates (a major version is a piece of work of its own), for
  Python one per package, for both directories at once, numpy and scipy
  excluded. CI fails on a high or critical npm advisory in what the dashboard
  ships (`npm audit --omit=dev --audit-level=high`) and on any known
  vulnerability in the pinned Python packages (`pip-audit`). The remaining npm
  advisories sit in development tools: Tailwind 3, whose fix is the move to
  Tailwind 4, and eslint-config-next, for which npm offers only a downgrade.
  They ship nothing to the browser (`npm audit --omit=dev` finds none). The CI
  workflow's actions are pinned to releases written for Node 20, which
  GitHub's runners now run on Node 24; once a month Dependabot proposes their
  current major versions, in one pull request per action.

## The production run

```bash
python3 scripts/run_production.py
python3 scripts/run_production.py --cell-weights /path/outside/the/repo/cell_weights.json
```

The run reads the database in `POSTGRES_URL` or `DATABASE_URL`, refuses to
start without one unless `--allow-sqlite` is given, and takes a few minutes at
the default 3 x 50,000 iterations (`PRODUCTION_*` in `prism/config.py`). It
writes a new row to `simulation_runs`; the API serves the newest row from its
next request on, an open dashboard shows it within about a minute, and earlier
rows stay for the drift comparison. Because a stored run is served at once,
PostgreSQL takes only the production size unless `--allow-test-size` says
otherwise. Every run records where its code came from: the commit and whether
tracked files had uncommitted changes (`meta.source` in the stored bundle, the
Code row of the workbook's Metadata sheet; both say so when the tree is not a
git checkout). On PostgreSQL, uncommitted changes bring a warning, not a
refusal, because a release makes its production run before the commit that
carries it (docs/DRIVER_ANALYSIS.md, Regeneration): the run then records the
commit it started from, with changes on top, and the release commit follows.
It also writes the QA workbook to `runs/` (git-ignored): the Shift Matrix with
its percentiles, the regional medians, the cell weights (with the graded
derivation when the estimate was used), the velocities and the run's metadata.

| Option | Effect |
|---|---|
| `--cell-weights FILE` | the finance cell weights instead of the estimate |
| `--iterations N`, `--chains N` | iterations per chain (default 50,000; 100 to 1,000,000) and chains (default 3; 1 to 10) |
| `--allow-sqlite` | use the local SQLite file when no database URL is set; a new file is seeded with the driver base first |
| `--allow-test-size` | on PostgreSQL, accept a size other than the production one (a development database) |
| `--allow-nonpsd` | run although the correlation matrix is not positive definite on this driver mix; the engine repairs it and records an integrity event |

The cell-weights file is JSON, kept outside the repository (the shares
below are illustrative):

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
| 2 | the database holds no drivers: a new PostgreSQL database gets them when the API first uses it; one that lost them (it stores runs or driver edits) is restored from its backup, or, a local file, deleted to start afresh (2 is also the code for a command line the script cannot read) |
| 3 | the simulation ran but storing it failed; the dashboard keeps serving the previous run |
| 4 | the correlation matrix is not positive definite on this driver mix |
| 5 | the run size is outside its range, or other than the production one on PostgreSQL without `--allow-test-size`; the configuration in `prism/config.py` is invalid; or the cell-weights file is missing or invalid |
| 6 | a driver cannot be simulated (an unknown force, direction, curve or value-chain stage, a missing score, a score outside its scale, a peak year not after the onset, a category or region without an exposure score, exposure 0 in every category or every region, an exposure on a name outside the taxonomy, a duplicate id); every problem is listed. PRISM stores no such driver, so this points at a change made to the database outside PRISM; a start year or a force corrected there needs the driver's revision raised by one as well, so the service reloads it |

Any other error stops the run with a traceback and exit code 1.

After a run, the Shift Analysis's "About this model" footer shows the new
run's id, date, master and chain seeds, numerics, Monte Carlo standard
error, seed stability and integrity events, including the input drift
against the previous run.

**Withdrawing a run.** A run that should not be shown (a test run stored in
production by mistake, a run on wrong inputs) is removed from the database:
take a Neon branch of production first, then delete its row,
`DELETE FROM simulation_runs WHERE id = <id>;` (nothing else refers to it).
The API serves the newest remaining run from its next request, and the next
run's input-drift event compares with that one.

When scores or model parameters changed, regenerate the PRISM Analysis
readings after the run as docs/DRIVER_ANALYSIS.md describes. A run on the
finance file leaves the readings on the estimate, and a card says that its
figures come from another run whenever the served 2035 median differs, at one
decimal, from the one its basis line names; readings on the finance shares
need rewritten templates first (the same document, "On the finance shares").

## Deploying

Push to `main`: Vercel builds the dashboard and the Python function and
promotes the build to production in about two minutes, whether or not CI has
passed on that commit. To hold a build until it has, add the CI checks
`dashboard` and `python` under Deployment Checks in the project settings
(Build and Deployment, Add Checks, GitHub): Vercel then promotes it once both
pass, and Force Promote overrides that in an emergency. If Vercel does not
offer the two checks yet, let CI run on GitHub first, on a pull request for
example.

**Protecting `main`.** To refuse such a commit on GitHub as well, protect
`main` (Settings, Branches): require the status checks `dashboard` and
`python`, and tick "Do not allow bypassing the above settings", without which
the repository's admins are exempt. A push to `main` is then accepted only for
a commit whose checks have passed, on a pull request for example, so a local
`--ff-only` merge of a checked branch still works. A private repository on a
personal account needs GitHub Pro for this.

Other branches get preview deployments. The environment variables live in the
Vercel project settings (Production and Preview). Vercel applies a change to
any of them only to deployments made after it, so redeploy after every change
(Deployments, the latest deployment, Redeploy);
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is also built into the dashboard's code.
`PRISM_API_ORIGIN`, if used, belongs to Production only: set for Preview as
well, a preview deployment's admin writes would go to the production API. A
database that still needs migration 0001 (the API answers 503 and names it)
is moved in the order that migration's runbook gives, the deploy first
(`migrations/0001_driver_schema/README.md`).

After a deploy:

```bash
curl -s https://prism-hcb.vercel.app/api/v1/health
```

must answer `"status": "ok"` with the driver count and `"has_simulation":
true`, and `curl -sI https://prism-hcb.vercel.app/sign-in` must show the
security headers of `vercel.json` and the proxy's policy
(`content-security-policy: default-src 'self'; script-src 'self' 'nonce-`
and so on, or `content-security-policy-report-only` while
`PRISM_CSP_REPORT_ONLY=1` is set). Then open the sign-in page with the
browser console open (no `Refused to` line: Clerk's script carries the
nonce) and the dashboard, and check that the Shift Analysis shows the
expected run. `/api/v1/diagnostics` explains a problem (see
Troubleshooting).

**The first deployment of a changed policy.** Set `PRISM_CSP_REPORT_ONLY=1`
in the project's environment variables for that deployment, then open the
sign-in page, each view of the dashboard, a drill-down, a PNG export, a
print preview, Settings and a wrong address (the not-found page) with the
browser console open: a violation is reported there as
`Content-Security-Policy-Report-Only`. Fix what is
reported (`lib/csp.ts`), remove the variable, and the policy is enforced
from the next deployment.

A deploy never needs a restart for data to appear: each API instance checks
the database on every request that reads the drivers or the run, and reloads
them when the drivers' stamp or the newest run's id has changed. A deploy
also brings the PRISM Analysis texts, which ship with the code.

**Rollback**: in the Vercel dashboard, use Instant Rollback (on the project's
production deployment tile, or in the menu of a deployment under
Deployments); on the Hobby plan it goes back to the previous production
deployment only. Vercel then puts no new push live until the rollback is
undone: Undo Rollback, on the same tile, promotes the deployment you choose.
The other way is to revert the commit and push. A deploy that came with a
database migration is rolled back as that migration's runbook says.

## The database

- **Backups.** Before any change to production data (a migration, a script
  that writes), create a Neon branch of the production branch. It is instant
  and it is the rollback. The copy outside Neon and the restore are under
  Backups and restore.
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

## Backups and restore

A Neon branch is a copy inside the same Neon account; it protects against a
bad change, not against losing the account or the project. Keep a second copy
outside it:

```bash
export PRODUCTION='<the production branch connection string, direct (not pooled)>'
pg_dump --format=custom --no-owner --no-privileges "$PRODUCTION" --file "prism_$(date +%Y%m%d).dump"
```

Use the direct connection string (the Neon console offers both; the pooled one
goes through a connection pooler that `pg_dump` should not use) and a
`pg_dump` of the database's major version or newer; an older one stops with a
server version mismatch. On a Mac, Homebrew's `libpq` brings `pg_dump` without
a database server (`brew install libpq`), but not on the PATH: run
`export PATH="$(brew --prefix libpq)/bin:$PATH"` in that terminal first.
Store the file encrypted, outside Neon and outside this repository: it holds
users' email addresses and the audit log. Take one before every migration and
every script that writes to production, and once a night while experts and
admins are editing (the expert ratings exist nowhere else).

**Restore drill**, at least once a quarter and at every handover: restore the
newest dump into an empty database (a local one, as below, or an empty Neon
database) and check that it serves the same run. A local one needs a
PostgreSQL server of production's major version or newer, which libpq alone
does not bring (on a Mac, Homebrew's `postgresql@<version>`, started with
`brew services start postgresql@<version>`).

```bash
createdb prism_restore
pg_restore --no-owner --no-privileges --dbname postgresql://localhost/prism_restore "prism_<date>.dump"
POSTGRES_URL='postgresql://localhost/prism_restore?sslmode=disable' \
DATABASE_URL='postgresql://localhost/prism_restore?sslmode=disable' \
  uvicorn prism.api.app:app --port 8000
```

In a second terminal, `curl -s http://127.0.0.1:8000/api/v1/health` must show
the same `driver_count` and `latest_run_id` as production.

**Restoring production.** Restore the production branch to an earlier point in
Neon (within the history the plan keeps), or restore a branch from the backup
branch of step 1 of a change. From a dump, restore into an empty database,
such as a new Neon project (a branch of production already holds the tables,
and a restore into it fails on them):

```bash
pg_restore --no-owner --no-privileges --dbname "<its direct connection string>" "prism_<date>.dump"
```

It must end without an error. Then point both database URLs in the Vercel
project (Production) at it and redeploy: a deployment keeps the settings it was
built with. Ask everyone to reload the dashboard afterwards.

## Monitoring

Nothing in PRISM raises an alarm by itself. Set up two checks:

- an uptime monitor (the company's, or a service such as Better Stack or
  UptimeRobot) on `https://prism-hcb.vercel.app/api/v1/diagnostics` every five
  minutes, alerting the owner and the provider when the answer is not 200 or
  does not contain `"simulation_reason":"ok"`. `/api/v1/health` answers 200
  even when the database fails (with `"status": "degraded"`), so a check on
  the status code alone stays green. Give the check a timeout of 30 seconds:
  while the database cannot be reached, an answer takes about 10.5 seconds, or
  five seconds for each address of the database host if it has several;
- Vercel's notification of a failed deployment (Settings, Notifications).

PRISM's own messages reach the function's log from INFO up (a new database
seeded, a failed database connection, a run that cannot be read; `api/index.py`
sets the level). Vercel's runtime formats the lines; on a host that sets up no
logging, `api/index.py` gives each its level and source and lets the
libraries' messages through from WARNING up. In Vercel they are under the
project's Logs, the function `api/index.py`. Vercel keeps runtime logs for a
limited time that depends on the plan; a log drain keeps them longer.

## Credentials

None of these is in the repository; each lives in the Vercel project
(Production and Preview), and the database URL also in the `.env` of the
machine that runs the production run and the migrations. Rotate a credential
when someone with access leaves, when it may have leaked, and at a handover.
A new value takes effect with the next deployment.

| Credential | Where to rotate it | Then |
|---|---|---|
| Neon password | the Neon console: the production branch's roles, reset the password of PRISM's role | update `DATABASE_URL` and `POSTGRES_URL` in Vercel and in the run machine's `.env`; redeploy |
| `PRISM_JWT_SECRET` | generate one (`openssl rand -base64 48`) | set it in Vercel (a different value for Preview); redeploy. Old tokens stop working and an open dashboard fetches a new cookie, so nobody has to sign in again |
| `CLERK_SECRET_KEY` | the Clerk dashboard, API keys: create a new secret key, and delete the old one once the new deployment is live | update Vercel; redeploy |
| `CLERK_WEBHOOK_SIGNING_SECRET` | the Clerk dashboard, Webhooks, PRISM's endpoint: a new signing secret | update Vercel; redeploy |
| `ADMIN_BOOTSTRAP_SECRET` | | remove it, and `ADMIN_BOOTSTRAP_EMAIL`, whenever no first admin is being set up |

## Incidents

1. **See what is wrong.** `/api/v1/health` and `/api/v1/diagnostics` name the
   cause (Troubleshooting below); the Vercel project's Deployments and Logs
   show the latest deploy and the function's errors.
2. **Restore service first.** A deploy that broke something: roll back to
   the previous production deployment (Deploying, Rollback). A run that shows
   wrong numbers: withdraw it (The production run). Lost or damaged data:
   restore (Backups and restore). A credential that may have leaked: rotate
   it (Credentials) and read the audit log for what it was used for.
3. **Tell people.** The owner decides who hears what. Personal data that may
   have reached someone it should not (user emails, names, the audit log) is
   reported to the owner at once, who involves the company's data protection
   contact; the time limits for notifying an authority are short.
4. **Afterwards**, write down what happened, why, and what changes so it does
   not happen again.

## Roles and users

A user who signs up gets no row in `user_roles`: they are pending, and see
only the waiting page, until an admin gives them a role in Settings, under
User management, which lists pending users first. Choosing Viewer or Admin
for a pending user, and confirming, approves them. Choosing Pending for a
user, and confirming, takes their role away: from their next page load they
see the waiting page, and a dashboard they have open loses access within 30
minutes at the latest, when its viewer cookie runs out, and in practice at
its next request. On PostgreSQL the API re-checks the role in `user_roles`
on every request and refuses a user without one, on which the dashboard
leaves for the waiting page; on SQLite, a development machine, there is no
role table and the API does not re-check. An admin write is refused at once
either way, as the dashboard's route checks `user_roles` before forwarding
it and the API checks again. Admins never change their own
role, and a change is made only while the user's access is still what the
list shows and the admin is still admin, so two admins working at the same
moment cannot undo each other's changes unseen or leave PRISM without an
admin; a change refused for that reason loads the list again, which then
shows the current access. While `PRISM_ALLOWED_EMAIL_DOMAINS` is set
(comma-separated domains, such as `henkel.com`, matched exactly: list a
subdomain separately), only a pending user whose address is at one of them
can be approved; a user who has a role keeps it. A user whose address Clerk
has not verified cannot be approved at all. Every approval, change and
removal goes to the audit log.

**Adding a user** takes two steps while sign-up is invite-only. Invite the
address in the Clerk dashboard (Users, Invitations): the invitation leads to
Clerk's own sign-up page (the Account Portal), which sends the user on to
PRISM afterwards (Setting up Clerk, step 4), where they wait. Then approve
them in Settings.

**Review the accounts** at go-live and from time to time: Clerk keeps every
account that ever signed up, and Settings shows each with its access. Set
back to pending anyone who should no longer read PRISM, and delete in Clerk
(Users) any account nobody recognises; deleting it removes its row too.

Two ways exist to set a role without an admin session:

- `python3 scripts/promote_admin.py someone@example.com` (or `--role viewer`)
  with database access, for a user who has a role. It can change any role,
  the last admin's included;
- `POST /api/admin/bootstrap` sets up the first admin of a new database. It
  exists only while `ADMIN_BOOTSTRAP_SECRET` is set, works only with a secret
  of at least 32 characters, and makes only the address in
  `ADMIN_BOOTSTRAP_EMAIL` admin, once that address has signed up and Clerk
  has verified it. Once an admin exists, that address's own included, it
  answers 409 and changes nothing, and it never takes a role away. Set both
  variables and redeploy, invite the address in Clerk and sign up with it
  (the dashboard shows the waiting page), then call the route

  ```bash
  curl -X POST https://<domain>/api/admin/bootstrap -H 'x-bootstrap-secret: <secret>' \
    -H 'content-type: application/json' -d '{"email": "<the address>"}'
  ```

  and remove both variables and redeploy again.

## Setting up Clerk for a new environment

1. Create a Clerk application with email sign-in (and any SSO provider
   wanted).
2. Copy the publishable and secret keys into
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`. PRISM names
   its sign-in and sign-up pages to Clerk in code (`proxy.ts`,
   `app/layout.tsx`), so none of Clerk's URL variables is needed.
3. Add a webhook endpoint `https://<domain>/api/webhooks/clerk` for the
   events `user.updated` and `user.deleted` (`user.created` may be added; it
   changes nothing), and copy its signing secret into
   `CLERK_WEBHOOK_SIGNING_SECRET`. The route rejects any request without a
   valid signature.
4. Restrict who may sign up, in the Clerk dashboard (Access mode): the
   Invite-only sign-up mode (`restricted` in Clerk's API; users join by
   invitation) or an allowlist of email addresses or domains, which needs a
   paid Clerk plan in production. An invitation sent from the Clerk
   dashboard leads to the Account Portal's sign-up page; set the sign-up
   fallback under Account Portal, Redirects, to `https://<domain>/`, so that
   the user arrives at PRISM afterwards. An account opens nothing by itself:
   it is pending until an admin approves it, and
   `PRISM_ALLOWED_EMAIL_DOMAINS` limits whom an admin can approve.
5. Turn on multi-factor authentication if the Clerk plan includes it (a paid
   plan in production): on the Multi-factor page, switch on at least one
   method and Require multi-factor authentication.
6. Set up the first admin with the bootstrap route (Roles and users), then
   check that `user_roles` holds your row with the admin role and that the
   dashboard opens.

## Troubleshooting

| Symptom | Cause and remedy |
|---|---|
| Every data request answers 401 | The dashboard and the API see different `PRISM_JWT_SECRET` values, or the value is shorter than 32 characters. Set the same value everywhere and redeploy |
| The dashboard says the service is unavailable, or a notice under the navigation says the data cannot be loaded | Check `/api/v1/health` and `/api/v1/diagnostics`. `simulation_reason` names the cause: `migration_pending` (the database needs a migration; the `error` field of `/diagnostics` names it), `no_database` (neither `DATABASE_URL` nor `POSTGRES_URL` is set in this Vercel deployment), `drivers_missing` (the database stores runs or driver edits but no drivers, so they were lost: restore it as under Backups and restore; PRISM seeds only a new database) or `db_error` (the API cannot reach the database or a query failed; the `error` field of `/diagnostics` says why) |
| The Shift Analysis is empty | `simulation_reason` in `/api/v1/diagnostics` is `no_rows` (write a run) or `malformed` (the newest run lacks a part the dashboard needs, such as a key, a category, region or year, a gross-profit share, its run metadata or a complete driver fingerprint; the `error` field lists them; write a new run) |
| A user sees only the waiting page | They have no role yet: an admin approves them in Settings, User management. A waiting page that says their access could not be checked means the check itself failed: the dashboard could not read `user_roles` (`DATABASE_URL` or `POSTGRES_URL` in the Vercel project) or Clerk did not answer. The function log has the cause, on a line starting `[proxy] access check failed` or `[/pending] access check failed` |
| Nobody is admin | A new database has none: set up the first with the bootstrap route, as under Roles and users |
| The production run exits with 4 | The correlation settings are not positive definite on the current driver mix; lower the cross-force correlations in `prism/config.py` |

## Handover

`bash scripts/package_handover.sh` builds `PRISM_HANDOVER_<date>.zip`: a git
repository with a single commit of the tracked tree at `HEAD`. Hand that over,
not this repository with its history: the history before the clean build
holds documents and credentials of earlier applications that do not belong
with a service provider, and the owner keeps it. It refuses a
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
  nobody has to sign in again) and any `ADMIN_BOOTSTRAP_SECRET`. Each new
  value takes effect with the next deployment.

The services themselves belong to the owner's accounts today: the GitHub
repository, the Vercel project `prism-profit-pool`, the Neon project and the
Clerk application. The repository is not moved: the receiving organisation
creates a repository of its own from the archive, so the history stays with
the owner. Move the other three into accounts the receiving organisation
controls, through the service's own transfer where it offers one, or by
creating them anew (a new Clerk application means new keys and a new
webhook; a new Neon project is restored from the dump), and connect the
Vercel project to the new repository. A new Clerk application gives every
user a new id, so the restored `user_roles` rows match nobody and still hold
an admin, which keeps the bootstrap route refusing: empty the table
(`DELETE FROM user_roles;`, after the dump that keeps the old rows), set up
the first admin with the bootstrap route, then invite and approve everyone
again. Rotate the credentials after the move, and check the deployment
against the list under Deploying.

## Hosting elsewhere

PRISM needs four things, which Vercel, Neon and Clerk provide today:

- a Node.js 22 host for the Next.js dashboard;
- a Python host for the ASGI app `api.index:app`, the entry point Vercel
  uses (`uvicorn api.index:app`, started in the repository's root), reachable
  on the dashboard's origin under `/api/v1`: the browser's reads carry a
  cookie scoped to that path. The entry point sets up the log as Monitoring
  describes; `prism.api.app:app` is the same app without that. The
  dashboard's admin routes call it on `PRISM_API_ORIGIN` when that is set,
  else on the same origin. It needs `api/requirements.txt` and an ASGI
  server such as uvicorn (Vercel brings its own);
- PostgreSQL. The dashboard reaches it through Neon's serverless driver
  (`lib/db.ts`); another PostgreSQL service means replacing that driver;
- an identity provider. Clerk is used in `lib/roles.ts`, `proxy.ts`,
  `app/layout.tsx` (the provider), the sign-in, sign-up and waiting pages,
  the webhook, the user list and approvals (`app/api/users`), the bootstrap
  route, the dashboard's user menu and the account and session parts of
  Settings; the API only verifies PRISM's own tokens.

The production run needs a machine or a job runner with the full Python
environment and access to the database. It must keep scipy: there is no
approximate engine.

On another host, set the security headers of `vercel.json` (listed in
docs/ARCHITECTURE.md, Deployment) at its proxy or web server: Vercel applies
them today, and nothing else in PRISM does. The Content Security Policy
needs nothing of the host: `proxy.ts` sets it wherever Next.js runs. The API's interactive
documentation stays off there as on Vercel, since only `PRISM_API_DOCS=1`
turns it on.
