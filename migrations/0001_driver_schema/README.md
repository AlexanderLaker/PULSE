# Migration 0001: the driver schema

A database of the previous schema keeps the drivers in a table called
`trends`, next to tables the driver schema does not have. The API and the
production run refuse such a database (the API answers 503 with a message
naming this migration, the production run exits with code 1) and write
nothing to it. The dashboard's role table, `user_roles`, is not part of the
migration and keeps working throughout. `migrate.py` moves a database onto
the current schema in one transaction. What it changes is listed in its
docstring; in short:

- every driver is checked first. The driver schema stores only drivers the
  engine can simulate: a known force, direction, curve, confidence and
  value-chain stage, every score present and on its scale, a peak year after
  the onset, and at least one category and one region with an exposure above
  0. While a driver fails a check the migration changes nothing and lists every
  problem (see step 2 of the runbook). The newest Consumer Journey content is
  checked at the same time (the last point below);
- the driver tables are created and filled from the previous ones, every row
  and every expert proposal included. Where an admin saved a driver's source
  list in the previous editor, that saved list becomes the driver's sources.
  An exposure map keeps the taxonomy's names, and a name it lacks gets 0, the
  value the previous engine read for it. An expert proposal is a draft: a
  score the API would refuse today is cleared. Rows of the previous child
  tables whose driver no longer exists are not copied;
- the value chain becomes one stage per driver. The previous schema stored it
  as eight scores drawn around the stage an expert chose; the migration keeps
  the stage those scores centre on, the one the dashboard showed, for every
  driver, every expert proposal and every baseline;
- the tables and `simulation_runs` columns the driver schema does not have
  are dropped, after their rows are written to a local archive file. Nothing
  is dropped with `CASCADE`: if a table the migration does not know depends on
  one it drops, it stops and changes nothing;
- the three tables both schemas have end on the driver schema's definitions:
  every run has its iteration count and results, every journey version its
  author and every audit entry its entity and actor. A run without results
  or an iteration count cannot be served and is archived and removed. A
  journey version or audit entry written without a value gets the previous
  schema's default for the column where it had one (an empty author,
  `system` as the actor) and an empty entity otherwise; the archive lists
  the rows that got one;
- the stored runs get the current key names (`meta.driver_count`,
  `meta.driver_fingerprint`, `meta.overlap_correction_source`) and lose
  `decompositions.dimensions`, which only listed the taxonomies; each driver
  fingerprint gains the fields it lacks (the onset years; None, which
  compares as changed, for anything that cannot be known), names its
  value-chain epicentre by the stage and holds its exposure maps on the
  taxonomy's names, so the next production run compares like with like; no
  number changes;
- descriptions, Consumer Journey tile texts and stage labels that still hold
  a text shipped before (any version since release 2.11.0, the first on the
  51-driver base) get the current one. A text an admin has edited is left
  alone and listed in the report. The journey tiles cite drivers under
  `driverCodes`, and a code that is not a driver of the base is removed.
  Keys outside the tile shape (`prism/journey.py`) are removed: the author
  in a tile's provenance (every tile reads as strategist-authored) and the
  direction of its pool impact (the tile's side gives it). A tile the
  previous editor still marks as an AI suggestion pending review stops the
  migration until it is accepted or deleted, and so does content the API
  would refuse. The previous PRISM Analysis column is not carried over: the
  readings ship with the code.

A new, empty database needs no migration: the API creates the schema on first
use and seeds the driver base.

## Production (Neon): the runbook

The order matters. The current code must be live before the migration runs,
because the previous code would recreate its own tables next to the migrated
ones. The dashboard is unavailable from the deploy (step 4) until the
migration has committed (step 5): plan a few quiet minutes.

You need a clean checkout of the commit you are deploying, best a fresh
clone (`git status` says the working tree is clean; a checkout that still
holds changed or untracked files of an earlier release stops the switch to
the release, so put them aside first with `git stash --include-untracked`),
the Python environment from `requirements-dev.txt` and a `.env` whose
`POSTGRES_URL` (or, when that is not set, `DATABASE_URL`) is the Neon
production database. Vercel deploys `main` to production (Settings, Git). While that `.env` points
at production, every script in the checkout writes there: run the commands
of this runbook only, not the development ones of README.md (a run with
`--allow-test-size` would be stored in production and served at once).

CI must have passed on that commit on GitHub before the day. First check
that the Vercel project's Preview variables are values of their own, not
production's (docs/OPERATIONS.md, Environments, Previews): the push builds a
preview deployment with them. Then push the release's branch and open a
pull request into `main`, but do not merge it there: step 4 merges it
locally with `--ff-only`, so that `main` gets the very commit CI checked and
the commit `/api/v1/health` names matches your checkout. CI runs both jobs
on the commit, and the project's Deployment Checks can then be set before
step 4 (docs/OPERATIONS.md, Deploying).

Ask the admins and experts not to edit from step 1 until step 6: an edit made
after the backup of step 1 would be lost if you roll back to it. The
corrections steps 2 and 5 may ask for are the exception: take step 1 again
after them. Set a limit for steps 4 to 6 before you start, half an hour for
example: if step 6 has not confirmed the migrated service by then, roll back
as Rollback describes and try again another day.

0. **Compare the settings.** The Vercel project's environment variables
   (Production) must be the ones README.md's table lists. Delete any that
   this release no longer reads, such as `BACKEND_URL`, `PRISM_BACKEND_URL`
   and `FORCE_DEV_PROXY`; the database URLs, `PRISM_JWT_SECRET` and the Clerk
   keys keep their names. In the Clerk dashboard, check that sign-up is
   restricted (Access mode: Invite-only, or an allowlist of the company's
   email domain; docs/OPERATIONS.md, Setting up Clerk): every signed-in user
   can read PRISM and propose scores, and the sign-up page's access code is
   readable in the browser, so it keeps nobody out.

1. **Back up.** In the Neon console, create a branch of the production branch
   (Branches, Create branch, from the current state). It is an instant
   point-in-time copy and your rollback. Take a `pg_dump` of production as
   well and keep it outside Neon (docs/OPERATIONS.md, Backups and restore):
   the branch lives in the same account.

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

   If a driver or the journey content fails a check, the dry run prints
   `nothing changed`, exits with code 1 and changes nothing. It lists every
   problem of every driver and every journey tile still marked as an AI
   suggestion, one line each. Of anything else wrong with the journey
   content it names the first problem it finds, in a line that opens with
   `journey content:` (for a tile, its id and what is wrong with it), so a
   second one can show once the first is corrected. Correct each problem in
   production, in the dashboard that is still deployed: a driver's scores in
   its editor, and a journey tile in the Consumer Journey editor. A force, a
   start year or a confidence, which that dashboard cannot edit, is
   corrected with SQL. Then take step 1 again, delete the rehearsal branch
   and start this step again from a fresh one.

   The dry run also refuses a column of `journey_content` or `audit_log`
   that the driver schema does not know (no release has had one), since only
   the owner can say whether its values matter. Copy them out and drop the
   column in production, then take step 1 again and start this step again
   (a kept table that lacks one of its columns is refused too; every release
   has had them all, so such a database was changed by hand and needs the
   owner's look first):

   ```bash
   export PRODUCTION='<the production branch connection string>'
   psql "$PRODUCTION" -c "\copy (SELECT id, <column> FROM <table>) TO '<table>-<column>.csv' CSV HEADER"
   psql "$PRODUCTION" -c "ALTER TABLE <table> DROP COLUMN <column>"
   ```

3. **Preview.** Run the dry run against Neon. It performs the whole migration
   inside a transaction, prints the report and rolls back:

   ```bash
   python3 migrations/0001_driver_schema/migrate.py --dry-run
   ```

   The report opens with the database host, production's this time. Expect
   `copied` to show 51 drivers with their sources and proposals and the
   previous tables in `dropped_tables`. Then read:

   - `exposures`: per driver, the names outside the taxonomy that were
     dropped and the missing names that were set to 0;
   - `baselines`: the drivers whose baseline, or a field of it, was taken
     from their current scores because none was stored;
   - `sources_from_editor`: the drivers whose source list an admin saved in
     the previous editor. That list becomes their sources; each entry shows
     how many rows it has and how many rows the old sources table held;
   - `source_tiers_outside_the_scale`: per driver, the source tiers that are
     not on the scale; those sources are stored unrated;
   - `source_links_that_are_not_web_addresses`: per driver, the source links
     that are not http(s) addresses (the API accepts no other); each is
     stored without a link, as the title where the source had none;
   - `sources_without_title_or_link_skipped`: per driver, how many sources
     had neither a title nor a link and were not copied;
   - `proposals`: how many proposals got a value-chain stage, and per
     proposal the scores cleared because the API would refuse them now (the
     expert can score them again);
   - `orphans_skipped`: per previous child table, the rows whose driver no
     longer exists. They are not copied; the archive keeps them;
   - `runs`: how many stored runs got the current key names and a
     completed driver fingerprint;
   - `kept_tables`: the stored runs removed because they had no results or
     no iteration count (expect none; the archive keeps them), and per
     column how many journey versions or audit entries got a value in place
     of a missing one (the archive lists their ids);
   - `descriptions.edited_left_alone` and `journey.texts_edited_left_alone`:
     each entry is a text an admin changed, which the migration keeps as it
     is; `journey.codes_removed` lists, per tile, the codes that are not
     drivers of the base, and `journey.keys_removed` counts the keys removed
     from the tile map (expect `provenance.author` on every tile, and
     `poolImpact.direction` on every tile that has a pool impact).

   The migration locks the tables it changes for its whole transaction, so
   while the dry run runs the live dashboard's database reads wait. Run it at
   a quiet moment; it takes about a minute.

4. **Deploy.** Merge the release into `main` in your checkout and push it:
   `git switch main`, `git merge --ff-only <the release's branch>` and
   `git push origin main` (not the pull request's merge button, which would
   make a new commit). Vercel builds and promotes it in about two minutes, or
   once CI has passed where the project's Deployment Checks ask for that
   (docs/OPERATIONS.md, Deploying); watch it in the Vercel dashboard. From now until step 5 the dashboard reports that
   PRISM is being updated, and `/api/v1/health` answers `"status": "degraded"`
   with `"simulation_reason": "migration_pending"` and the release's commit in
   `commit`, its first 12 characters (`git rev-parse --short=12 HEAD` in the
   checkout prints the same): the release is live and waits for the migration.

5. **Migrate** as soon as the deployment is live:

   ```bash
   python3 migrations/0001_driver_schema/migrate.py --postgres
   ```

   The script prints the same report as the dry run and ends with
   `Migrated. Archive of everything dropped: <path>`. Keep that file: it holds
   every dropped row and column except password columns, which are not
   archived (it is git-ignored and must never be committed). If the script
   fails it rolls back by itself, exits with code 2 and the database is
   unchanged; see Rollback. It waits at most ten seconds for its locks: if a
   long request of the live service holds one, it stops the same way, and
   running it again is safe.

   If it exits with code 1, nothing changed either, and the message says
   why. When it lists drivers or journey content to correct, something was
   changed after the preview: promote the previous production deployment in
   Vercel, correct the listed problems in its dashboard as in step 2, take
   step 1 again and run step 3 again; then promote the release's deployment
   again (Deployments, the release's deployment, Promote to Production) and
   run this step again. When it cannot open the database, check the
   connection string and the network, and run this step again.

6. **Check.** `https://prism-hcb.vercel.app/api/v1/health` answers
   `"status": "ok"` with `"driver_count": 51`, `"has_simulation": true` and
   the release's commit.
   Open the dashboard: the Shift Analysis shows the persisted run with its
   2035 portfolio median of -5.6 percent. Ask everyone who had the dashboard
   open to reload it: a page loaded before the deploy still runs the
   previous dashboard, whose reads and saves the current service refuses.

7. **Write a fresh run** so the served run carries the current names and
   labels. With the drivers unchanged since the last run, the numbers stay
   the same and its input-drift event reports no changes:

   ```bash
   python3 scripts/run_production.py
   ```

   The log names the release's commit without uncommitted changes, and so
   does the Code row of the run's workbook. The runs stored before the
   migration keep their earlier labels (their overlap-correction and
   cell-weight sources, for example): the migration renames keys, not
   values. They stay for the drift comparison and are no longer served once
   this run exists.

8. **Retire the previous checkout.** Any checkout of the previous release
   with a `.env` that points at production can still write there in the
   previous schema (its production run, its scripts). Remove the database
   URLs from that `.env`, or delete the checkout, so that only this release's
   checkout reaches production.

A second `migrate.py --dry-run` now answers that the database is already on
the driver schema.

## The local SQLite copy

`--sqlite PATH` migrates a SQLite file and ignores any database URL in `.env`:

```bash
python3 migrations/0001_driver_schema/migrate.py --sqlite data/prism.db --dry-run
python3 migrations/0001_driver_schema/migrate.py --sqlite data/prism.db
```

A local copy can also be deleted instead: the API creates a new one, seeded
with the driver base, the first time a request needs the database.

## Rollback

- **The migration failed** (exit code 2): nothing changed in the database.
  Restore service by promoting the previous production deployment in Vercel
  (Deployments, the previous one, Promote to Production), then look at the
  error the script printed.
- **A problem shows after the migration committed:** go back to the state
  of step 1. Either restore the production branch from the backup branch in
  Neon and promote the previous production deployment in Vercel, or point
  every database URL the Vercel project sets (`POSTGRES_URL` and
  `DATABASE_URL`; the first wins where both are set) at the backup branch
  and redeploy the previous release: a deployment keeps the settings it was
  built with. The archive file of step 5 holds the dropped rows as well.

## When a shipped text changes

Until this migration has run on every database, it is what carries a
changed driver description, Consumer Journey tile text or stage label to
them. The new text becomes the `text` of the entry in `descriptions.json`
(an entry is added where the driver has none) or in `journey_edits.json`,
and the SHA-256 of the text it replaces joins the entry's `previous_sha256`.
`tests/test_migration.py` checks that every entry ends on the text the code
ships: a description on the driver base's, a journey text on
`data/consumerJourney.ts`.

## Retiring this migration

`migrate.py` builds on the current code: it creates the schema of
`prism/database.py` (`schema`) and imports the taxonomies, the driver checks
and the journey tile shape, and its tests compare what it produces with a
database the current code creates. It stays correct only while those match
the schema it was written for. Once every database has run it, retire it
before any change that would alter what it produces (another category, a new
driver field, a new tile shape):

- delete this folder and `tests/test_migration.py`;
- keep `0001_driver_schema` in `SCHEMA_MIGRATIONS`, so a new database still
  records it as done;
- move `previous_names.txt` to `tests/previous_names.txt` and, in
  `tests/test_repository.py`, point `_NAMES_FILE` at it and let
  `MAY_NAME_THE_PREVIOUS_RELEASE` name that file alone, so the test keeps
  refusing the previous names everywhere else.

A database found later on the previous schema is migrated from the last
commit that has this folder, then by the migrations after it.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | migrated, previewed by a dry run, or the database was already migrated |
| 1 | refused, nothing changed: the database cannot be opened, it is not a database of the previous schema, `--postgres` is missing for a PostgreSQL target, or drivers, journey content or columns need correcting (listed) |
| 2 | failed and rolled back; the database is unchanged |

## Files

| File | Content |
|---|---|
| `migrate.py` | the migration |
| `descriptions.json` | the current driver descriptions, each with the SHA-256 of the texts shipped before it since release 2.11.0 |
| `journey_edits.json` | the current Consumer Journey tile texts and stage labels, each with the SHA-256 of the texts shipped before it since release 2.11.0 |
| `previous_names.txt` | the names of the previous schema and code; `tests/test_repository.py` fails when one appears outside this folder and the migration's tests |
| `archive/` | written by a live run: the dropped rows (git-ignored) |

`tests/test_migration.py` runs the migration on SQLite and on PostgreSQL (with
`TEXT` and `JSONB` columns) and checks that the result equals a database the
current code creates, that a second run changes nothing and that a failure
leaves the database untouched.
