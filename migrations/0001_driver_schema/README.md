# Migration 0001: the driver schema

A database that PRISM ran on before this release has the previous schema: the
drivers sit in a table called `trends`, next to tables nothing reads any more.
The API and the production run of this release refuse such a database (the
API answers 503 with a message naming this migration, the production run
exits with code 1) and write nothing to it. The dashboard's role table,
`user_roles`, is not part of the migration and keeps working throughout.
`migrate.py` moves a database onto the current schema in one transaction.
What it changes is listed in its docstring; in short:

- the driver tables are created and filled from the previous ones, every row
  and every expert proposal included. Where an admin saved a driver's source
  list in the previous editor, that saved list becomes the driver's sources.
  Rows of the previous child tables whose driver no longer exists are not
  copied;
- the tables and `simulation_runs` columns nothing reads are dropped, after
  their rows are written to a local archive file. Nothing is dropped with
  `CASCADE`: if a table the migration does not know depends on one it drops,
  it stops and changes nothing;
- the stored runs get the current key names (`meta.driver_count`,
  `meta.driver_fingerprint`); no number changes;
- each driver gets its current PRISM Analysis text, and descriptions and
  Consumer Journey tile texts that still hold a previously shipped text get the
  current one. A text an admin has edited is left alone and listed in the
  report.

A new, empty database needs no migration: the API creates the schema on first
use and seeds the driver base.

## Production (Neon): the runbook

The order matters. The current code must be live before the migration runs,
because the previous code would recreate its own tables next to the migrated
ones. The dashboard is unavailable from the deploy (step 4) until the
migration has committed (step 5): plan a few quiet minutes.

You need the repository at the commit you are deploying, the Python
environment from `requirements-dev.txt` and a `.env` whose `DATABASE_URL` (or
`POSTGRES_URL`) is the Neon production database.

1. **Back up.** In the Neon console, create a branch of the production branch
   (Branches, Create branch, from the current state). It is an instant
   point-in-time copy and your rollback.

2. **Rehearse on a copy.** Create a second branch the same way (for example
   `migration-rehearsal`) and run the real migration against it. Set its
   connection string in the shell for both variables: a shell variable wins
   over `.env`, and `POSTGRES_URL` wins over `DATABASE_URL`:

   ```bash
   export REHEARSAL='<the rehearsal branch connection string>'
   POSTGRES_URL="$REHEARSAL" DATABASE_URL="$REHEARSAL" python3 migrations/0001_driver_schema/migrate.py --dry-run
   POSTGRES_URL="$REHEARSAL" DATABASE_URL="$REHEARSAL" python3 migrations/0001_driver_schema/migrate.py --postgres
   ```

   The report opens with the database host: check in the dry run that it is
   the rehearsal branch's endpoint, not production's. The second command
   commits on that branch, so every step, including the archive, runs once
   for real on production data without touching production; run it again and
   it must answer that the database is already migrated. Delete the
   rehearsal branch and its archive file afterwards (the archive holds user
   emails).

3. **Preview.** Run the dry run against Neon. It performs the whole migration
   inside a transaction, prints the report and rolls back:

   ```bash
   python3 migrations/0001_driver_schema/migrate.py --dry-run
   ```

   The report opens with the database host, production's this time. Expect
   `copied` to show 51 drivers with their sources and proposals, the previous
   tables in `dropped_tables`, and 51 in `analysis_updated`. Then read:

   - `sources_from_editor`: the drivers whose source list an admin saved in
     the previous editor. That list becomes their sources; each entry shows
     how many rows it has and how many rows the old sources table held;
   - `orphans_skipped`: per previous child table, the rows whose driver no
     longer exists. They are not copied; the archive keeps them;
   - `descriptions.edited_left_alone` and `journey.texts_edited_left_alone`:
     each entry is a text an admin changed, which the migration keeps as it
     is.

   The migration locks the tables it changes for its whole transaction, so
   while the dry run runs the live dashboard's database reads wait. Run it at
   a quiet moment; it takes about a minute.

4. **Deploy.** Merge the release into `main` and push. Vercel builds and
   promotes it in about two minutes (watch it in the Vercel dashboard). From
   now until step 5 the dashboard reports that PRISM is being updated.

5. **Migrate** as soon as the deployment is live:

   ```bash
   python3 migrations/0001_driver_schema/migrate.py --postgres
   ```

   The script prints the same report as the dry run and ends with
   `Migrated. Archive of everything dropped: <path>`. Keep that file: it holds
   every dropped row and column (it is git-ignored and must never be
   committed). If the script fails it rolls back by itself, exits with code 2
   and the database is unchanged; see Rollback. It waits at most ten seconds
   for its locks: if a long request of the live service holds one, it stops
   the same way, and running it again is safe.

6. **Check.** `https://prism-hcb.vercel.app/api/v1/health` answers
   `"status": "ok"` with `"driver_count": 51` and `"has_simulation": true`.
   Open the dashboard: the Shift Analysis shows the persisted run with its
   2035 portfolio median of -5.6 percent.

7. **Write a fresh run** so the served run carries the current labels (the
   numbers stay the same, and its input-drift event reports no changes):

   ```bash
   python3 scripts/run_production.py
   ```

A second `migrate.py --dry-run` now answers that the database is already on
the driver schema.

## The local SQLite copy

`--sqlite PATH` migrates a SQLite file and ignores any database URL in `.env`:

```bash
python3 migrations/0001_driver_schema/migrate.py --sqlite data/prism.db --dry-run
python3 migrations/0001_driver_schema/migrate.py --sqlite data/prism.db
```

A local copy can also be deleted instead: the API creates a new one on its
next start.

## Rollback

- **The migration failed** (exit code 2): nothing changed in the database.
  Restore service by promoting the previous production deployment in Vercel
  (Deployments, the previous one, Promote to Production), then look at the
  error the script printed.
- **A problem shows after the migration committed:** promote the previous
  production deployment and restore the Neon branch from step 1 (in Neon,
  restore the production branch from the backup branch, or point
  `DATABASE_URL` at the backup branch). The archive file of step 5 holds the
  dropped rows as well.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | migrated, or the database was already migrated |
| 1 | refused: no database, not a database of the previous schema, or `--postgres` missing for a PostgreSQL target |
| 2 | failed and rolled back; the database is unchanged |

## Files

| File | Content |
|---|---|
| `migrate.py` | the migration |
| `descriptions.json` | the current driver descriptions, each with the SHA-256 of the texts shipped before it |
| `journey_edits.json` | the current Consumer Journey tile texts, each with the SHA-256 of the texts shipped before it |
| `previous_names.txt` | the names of the previous schema and code; `tests/test_repository.py` fails when one appears outside this folder and the migration's tests |
| `archive/` | written by a live run: the dropped rows (git-ignored) |

`tests/test_migration.py` runs the migration on SQLite and on PostgreSQL (with
`TEXT` and `JSONB` columns) and checks that the result equals a database the
current code creates, that a second run changes nothing and that a failure
leaves the database untouched.
