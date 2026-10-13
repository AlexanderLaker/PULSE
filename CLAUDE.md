# PRISM: instructions for working in this repository

PRISM (Profit Pool Risk & Intelligence Simulation Model) estimates how 51
scored Profit Pool Drivers shift the gross profit (GP1) of Henkel Consumer
Brands' 13 categories in 4 regions, 2026 to 2035. A Monte Carlo engine
(Python, scipy) computes offline; a FastAPI service that never simulates and
a Next.js dashboard on Vercel show the latest stored run. Start with
README.md; the documents in `docs/` explain everything below in full.

## How the system works

- `scripts/run_production.py` is the only place the simulation runs for the
  dashboard: 3 chains x 50,000 iterations, master seed 42, stored as a row of
  `simulation_runs` in Neon PostgreSQL, plus a QA workbook in `runs/`.
- The API (`prism/api`, Vercel function `api/index.py`) serves the newest run,
  the drivers, the read-only model configuration and the Consumer Journey
  content. It never simulates and never imports the engine; its runtime has
  no numpy or scipy.
- The dashboard (`app/`, `components/dashboard/`) authenticates with Clerk.
  Roles live in `user_roles`. Reads use a viewer cookie scoped to `/api/v1`;
  admin writes go through the dashboard's server routes, which forward them
  with a five-minute admin token (`lib/adminWrite.ts`).
- The numbers are relative shifts, ceteris paribus (no management response),
  presented as structured judgment, never as a validated forecast.

## Rules that hold everywhere

- **Exact numerics only.** scipy is a hard requirement of the engine. Never
  add an approximate fallback or a try/except around the scipy import.
- **Numbers move only deliberately.** A change to any number the model
  produces bumps `MODEL_VERSION` (with `prism.__version__`, `package.json`
  and its lock) and, in the same commit, regenerates the golden pins (the
  fixture pins in `tests/test_golden_pipeline.py` and the production pin,
  `python3 tests/golden_production.py --write`) and the PRISM Analysis
  record, rebuilt from a production run of the new code
  (docs/DRIVER_ANALYSIS.md); that run therefore comes before the commit and
  the deploy. A change to the fixture drivers or to the driver base also
  regenerates the pins computed on them, without a new version. Never
  regenerate pins to make a test pass.
- **Generated files are never edited by hand**: `prism/seed_drivers.py`,
  `prism/analysis_texts.py`, `prism/overlap_correction.py`,
  `prism/cell_weight_estimate.py`, `data/driverCodeMap.ts`,
  `data/parameters/*.json`, `lib/cellWeightProvenance.ts`,
  `data/drivers/driver_attribution.json` and
  `tests/frontend/fixtures/driverAttribution.fixture.json`. Change the input
  and run the generator; every generator has `--check`.
- **The cell weights are an estimate.** Until finance provides the real
  shares, the default is an estimate from public reporting, not Henkel P&L.
  Say so wherever a number built on it is quoted.
- **The model configuration is code** (`prism/config.py`); the dashboard shows
  it read-only.
- **A driver is complete or refused.** Every score present and on its scale,
  every category and region scored (at least one of each above 0), the peak
  after the onset: the engine and the database writes run the same check
  (`simulation_problems` in `prism/drivers.py`), the API validates every
  edit, and the schema's constraints hold each score and name on its scale or
  in its taxonomy. The engine has no defaults and no fallbacks for a driver's
  inputs; never add one.
- **Honest display.** One decimal for shifts and shares (docs/DESIGN.md
  names the three exceptions); the portfolio band is the joint percentile; the
  lenses are labelled attribution; sampling quality is the Monte Carlo
  standard error and seed stability; a shift always carries its sign.
  `docs/adr/0007-honest-display.md` has the reasons.
- **Only the drivers feed the Shift Matrix.** The Consumer Journey and the
  Profit Pool Explorer never read or write the simulation.
- **Parity.** The taxonomies (forces, categories, regions, value-chain stages,
  directions, confidence levels, diffusion curves), the horizon, the source
  tiers and a source's link and length rules (`prism/config.py`,
  `prism/drivers.py` and `lib/format.ts`, `lib/valueChain.ts`,
  `types/index.ts`, `components/dashboard/drivers/shared.ts`), the category
  names the PRISM Analysis uses (`prism/readings.py` and the category labels
  in `lib/format.ts`), the uncertainty tables (`prism/config.py` and
  `lib/uncertainty.ts`), the per-driver attribution (`prism/attribution.py`
  and `lib/driverAttribution.ts`), the PRISM Analysis labels
  (`prism/readings.py` and `components/dashboard/drivers/PrismAnalysis.tsx`),
  the driver request shapes (`prism/api/schemas.py` and `types/drivers.ts`),
  the estimate's label, the earliest peak year and the token secret's
  minimum length (`prism/config.py`, `prism/api/auth.py` and
  `lib/cellWeights.ts`, `lib/format.ts`, `lib/prismJwt.ts`) and the Consumer
  Journey tile shape (`prism/journey.py` and `data/consumerJourney.ts`) exist
  twice and are tested against each other; change both or neither.
- **Shift Matrix arithmetic** lives in `lib/shiftMatrix.ts`;
  `scripts/check_single_source.sh` (part of `npm run lint`) fails on a copy.
- **Design tokens.** Colours, shadows and fonts come from `lib/theme.ts` (the
  force and category palettes from `lib/format.ts`, which also builds the
  shift colours on the theme's pair); Tailwind reads the same tokens
  (`tailwind.config.ts`). A literal colour elsewhere in the dashboard's code
  (a hex or `rgb()` value, `white` or `black` as a style value, a class of
  Tailwind's own palette such as `bg-white`) fails `tests/test_repository.py`;
  three views keep a palette of their own, which that test lists.
  docs/DESIGN.md has the system.
- **Scripts are entry points.** Code that more than one script, or a script
  and the package, needs lives in `prism/` (the driver base, the attribution,
  the readings renderer, the workbook reader); no script imports another.
- **Database changes are migrations** under `migrations/`, following
  `0001_driver_schema`: one transaction, a dry run, `--postgres` to touch
  PostgreSQL, an archive of everything dropped, a runbook, tests on SQLite
  and PostgreSQL, and an entry in `SCHEMA_MIGRATIONS` (`prism/database.py`).
  A migration builds on the current code, so once every database has run it,
  it is retired before any change that would alter what it produces; its
  README says how.
- **Never run anything against the production database** without the owner
  asking for it. The scripts and the migration read `POSTGRES_URL`, else
  `DATABASE_URL`, from the shell or from `.env`, which may be production; to
  point one at another database, set both in the shell. Never print or copy
  `.env`.

## Words

- The modelled items are **Profit Pool Drivers**, "Drivers" in menus and
  headers. Code, API, database and texts say driver. "Trend" appears only in
  its ordinary sense or in a foresight tier (Megatrend, Macrotrend).
- No em dash anywhere: not in code, comments, copy, content or documents
  (`tests/frontend/interfaceCopy.test.tsx` and `tests/test_repository.py`
  enforce it).
- Write plain, concrete English, British in interface copy, content and
  documents (materialisation, colour, towards; judgment); identifiers, names
  and the titles of sources keep their spelling. `tests/spelling.json` lists
  the forms to avoid and the names that keep theirs; the same two test files
  enforce it.
- Documents and comments describe the system as it is. The history of how it
  got here lives in git, not in the tree. The figures a document takes from
  the model and its records (parameters, tables, counts, tolerances), the
  design tokens and the security and session settings are checked by
  `tests/test_documents.py`; update both, and add a check for a figure a
  document starts to quote.

## Commands

| Command | What it does |
|---|---|
| `uvicorn prism.api.app:app --reload --port 8000` | the API |
| `npm run dev` | the dashboard |
| `npm run verify` | types, lint, both test suites |
| `python3 -m pytest -n auto` | the Python suite |
| `python3 scripts/generate_seed.py --check` | one of the four generator checks (docs/OPERATIONS.md lists them) |
| `python3 scripts/run_production.py` | the production run (database in `.env`) |

With `PRISM_TEST_POSTGRES_URL` set, the migration and the database layer are
also tested on PostgreSQL. The Python suite never touches the database in
`.env` (`tests/conftest.py`).

## Where things are

| Path | Content |
|---|---|
| `prism/engine.py` | the engine |
| `prism/config.py` | taxonomies and every model parameter |
| `prism/drivers.py`, `prism/driver_base.py` | the driver and the checks it must pass; the driver base, read and checked |
| `prism/database.py` | persistence, PostgreSQL and SQLite |
| `prism/attribution.py`, `prism/readings.py` | the per-driver attribution behind the PRISM Analysis; its renderer |
| `prism/workbook.py` | the QA workbook, written and read back |
| `prism/api/` | the API: routers, auth, the stored-run contract (`runs.py`) |
| `scripts/` | production run, generators, `promote_admin.py`, handover packaging |
| `data/drivers/` | the driver base and the PRISM Analysis sources |
| `components/dashboard/` | the views: each page in one file, its parts in a folder of its own (`drivers/`, `shift/`, `journey/`, `explorer/`, `settings/`), and the pieces several views share |
| `lib/`, `hooks/`, `types/` | shared dashboard logic and the API client; the store and the behaviour every overlay shares; the types |
| `docs/` | ARCHITECTURE, MODEL, DRIVERS, DRIVER_ANALYSIS, OPERATIONS, DESIGN, EXPLORER, `adr/` |
