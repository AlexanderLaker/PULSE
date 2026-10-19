# Migration 0002: the rescored C-05

Release 2.13.0 rescored C-05 (Ageing Consumers, `consumer_r05`) in the driver
base: its GP1 share, uncertainty, confidence, category and regional
exposures, technical scope, description and sources changed (`c05.json`
holds both versions). A new database is seeded with these values. An existing database keeps its own
drivers, and nothing but a migration writes a driver's technical scope or
its baseline (docs/DRIVERS.md), so the production database still holds the
previous C-05 until this migration has run.

`migrate.py` brings the stored C-05 to the base's values in one transaction,
so that it equals the C-05 of a new database. What it changes is listed in
its docstring; in short:

- each field of the stored C-05 is compared with the value release 2.12.0
  shipped and with the current one (`c05.json`). A field at the previous
  value gets the current one; a field that already holds the current value
  (entered by hand on the Drivers page) stays;
- a score, the force, the direction, the start year, the confidence, an
  exposure map or the source list that holds neither value was edited by an admin. The migration then
  changes nothing and names each such field (see If the migration refuses);
- the technical scope and the description, when an admin or an SQL statement
  changed them, are left alone and reported;
- the baseline becomes the new scores and the driver is no longer marked as
  edited, so the Drivers page shows no Edited chip and compares expert
  proposals with the new values. Expert proposals are kept;
- the revision rises by one, so every running instance of the API reloads
  the driver, and every changed field is written to the audit log as an
  admin edit is, with `migration-0002` as the actor;
- the previous C-05 is written to a local archive before the commit
  (`archive/`, readable by the owner only, never committed).

The migration is listed in `SCHEMA_MIGRATIONS` (`prism/database.py`): a new
database records it as done, and the release that contains it refuses a
database that has not run it (the API answers 503 naming it, the production
run exits with code 1). The release before it ignores the record. So the
migration runs **before** the release is merged, and the dashboard stays
available throughout.

## Production (Neon): the runbook

You need a clean checkout of this release's branch, the Python environment
from `requirements-dev.txt` and a `.env` whose `POSTGRES_URL` (or, when that
is not set, `DATABASE_URL`) is the Neon production database. While that
`.env` points at production, every script in the checkout writes there: run
the commands of this runbook only. CI must have passed on the branch's pull
request; do not merge it yet.

Ask the admins not to edit C-05 from step 1 until step 4, and run steps 3 to
6 in one sitting. Between step 3 and step 5 the live release shows the new
scores of C-05 next to its previous PRISM Analysis text, and until step 6
the Shift Matrix shows the previous run, with C-05 marked as changed since
that run.

1. **Back up.** In the Neon console, create a branch of the production
   branch (Branches, Create branch, from the current state). It is an
   instant point-in-time copy and your rollback.

2. **Preview.** The dry run performs the migration and rolls it back:

   ```bash
   git status                     # clean, on this release's branch
   python3 migrations/0002_c05_rescore/migrate.py --dry-run
   ```

   It prints a report and "Dry run: rolled back, nothing changed." On the
   production database as release 2.12.0 left it, the report reads:

   - `updated`: the fields that change, among them `gp1_pct_affected`,
     `uncertainty`, `confidence`, `category_exposure`, `regional_exposure`,
     `sources`, `name`, `description` and `baseline`;
   - `edited_replaced` and `edited_left_alone`: empty;
   - `revision`: from the driver's current revision to the next one.

   A name or description listed under `edited_left_alone` was changed after
   release 2.12.0 and keeps that text; set it on the Drivers page afterwards
   (the description) or with the statement under Rollback (the technical
   scope) if the base's text should replace it. If the dry run refuses, see
   below.

3. **Migrate.**

   ```bash
   python3 migrations/0002_c05_rescore/migrate.py --postgres
   ```

   It prints the same report and "Migrated." with the path of the archive.
   Keep the archive file until the release has been live for a week.

4. **Check.** Reload the dashboard's Drivers page and open C-05: GP1 3%,
   uncertainty 4, confidence Medium, no Edited chip, the 10 sources, and the
   new technical scope as its heading (the release still live has no short
   and long names; they arrive with step 5).

5. **Merge and deploy.** Merge the pull request into `main`. Once Vercel
   shows the production deployment as Ready, check
   `curl -s https://prism-hcb.vercel.app/api/v1/health`: it names the merged
   commit and its status is `ok` (a database that still awaits this
   migration reads `degraded`, with `simulation_reason` `migration_pending`).

6. **Run production.** Pull `main` and store a run on the new C-05:

   ```bash
   git switch main && git pull --ff-only
   python3 scripts/run_production.py
   ```

   The PRISM Analysis record of release 2.13.0 was built from a run of these
   drivers, so the dashboard's figures and its readings agree again.

If step 5 comes before step 3 by mistake, the API answers 503 naming this
migration until step 3 has run; nothing is lost.

## If the migration refuses

Exit code 1 with lines such as `consumer_r05 probability was edited: it
holds 3, neither the previous nor the current value, 4` means an admin
changed that field on the Drivers page after release 2.12.0. Nothing has
changed. Decide for each field named:

- the admin's value should give way to the rescore: run the dry run and the
  migration again with `--replace-edited`, which writes the current values
  over every edited field; the archive keeps the admin's values;
- the admin's value should stay: run the migration with `--replace-edited`
  and then enter that value again on the Drivers page, where it shows as an
  edit of the new baseline. The force and the start year cannot be edited
  there: set one of them back by SQL as under Rollback.

A `baseline` line means the baseline was changed by SQL; `--replace-edited`
sets it to the new scores.

## The local SQLite copy

```bash
python3 migrations/0002_c05_rescore/migrate.py --sqlite data/prism.db --dry-run
python3 migrations/0002_c05_rescore/migrate.py --sqlite data/prism.db
```

A local file created by this release needs nothing; the migration says so.

## Rollback

- **The migration failed** (exit code 2): nothing changed in the database.
  Look at the error the script printed and run it again.
- **A problem shows after the migration committed:** restore the production
  branch from the backup branch of step 1 in Neon. Before step 5 nothing
  else is needed: the live release does not need this migration. After step
  5, roll back to the previous production deployment in Vercel as well
  (Instant Rollback; docs/OPERATIONS.md, Deploying).

The archive holds the previous row, its exposures and its sources. A single
value (a technical scope, a force, a start year) can also be set back by SQL, raising the revision by one so the
service reloads the driver (docs/DRIVERS.md), for example the technical
scope:

```sql
UPDATE drivers SET name = '<text>', revision = revision + 1 WHERE id = 'consumer_r05';
```

## Retiring this migration

`c05.json` holds the values the migration writes, and
`tests/test_migration_0002.py` fails when they no longer equal C-05 in the
driver base. Once every database has run the migration (production and any
local copy anyone keeps), retire it before C-05 changes again:

- delete this folder and `tests/test_migration_0002.py`;
- keep `0002_c05_rescore` in `SCHEMA_MIGRATIONS`, so a new database still
  records it as done;
- remove its row from the documents table of README.md, and the sentences
  of docs/OPERATIONS.md (Deploying) and docs/DRIVERS.md that name it;
- in `tests/test_migration.py`, end the schema check after migration 0001
  with the pending-migration error instead of running this one.

A database found later before this migration is migrated from the last
commit that has this folder.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | migrated, previewed by a dry run, or the migration had already run (a new database records it when it is created) |
| 1 | refused, nothing changed: the database cannot be opened, it is not on the driver schema with migration 0001 recorded, it holds no C-05, `--postgres` is missing for a PostgreSQL target, or fields an admin edited (listed) |
| 2 | failed and rolled back; the database is unchanged |

## Files

| File | Content |
|---|---|
| `migrate.py` | the migration |
| `c05.json` | C-05 as release 2.12.0 shipped it (`previous`, its description as the SHA-256 of every text shipped for it since release 2.11.0) and as the driver base holds it (`current`) |
| `archive/` | written by a live run: the previous C-05 (git-ignored) |

`tests/test_migration_0002.py` runs the migration on SQLite and on PostgreSQL
and checks that the result equals a database the current code creates, that
only C-05 changes, that a second run and a dry run change nothing, that
edited fields stop it and that a failure leaves the database untouched.
