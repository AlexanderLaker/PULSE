# PRISM: instructions for working in this repository

PRISM (Profit Pool Risk & Intelligence Simulation Model) estimates how 51
scored Profit Pool Drivers shift the gross profit (GP1) of Henkel Consumer
Brands' 13 categories in 4 regions, 2026 to 2035. A Monte Carlo engine
(Python, scipy) computes offline; a read-only FastAPI service and a Next.js
dashboard on Vercel show the latest stored run. Start with README.md; the
documents in `docs/` explain everything below in full.

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
  with a five-minute admin token (`lib/backend.ts`).
- The numbers are relative shifts, ceteris paribus (no management response),
  presented as structured judgment, never as a validated forecast.

## Rules that hold everywhere

- **Exact numerics only.** scipy is a hard requirement of the engine. Never
  add an approximate fallback or a try/except around the scipy import.
- **Numbers move only deliberately.** A change to any number the model
  produces bumps `MODEL_VERSION` (and `prism.__version__` and `package.json`),
  regenerates the golden pins in `tests/test_golden_pipeline.py` in the same
  commit, and needs a new production run after the deploy. A change to the
  fixture drivers the pins are computed on also regenerates them, without a
  new version. Never regenerate pins to make a test pass.
- **Generated files are never edited by hand**: `prism/seed_drivers.py`,
  `data/driverCodeMap.ts`, `data/calibration/*.json`,
  `lib/cellWeightProvenance.ts`, `data/drivers/driver_attribution.json`, the
  rendered texts in `data/drivers/driver_analysis.json` and
  `tests/frontend/fixtures/driverAttribution.fixture.json`. Change the input
  and run the generator; every generator has `--check`.
- **The cell weights are an estimate.** Until finance provides the real
  shares, the default is an estimate from public reporting, not Henkel P&L.
  Say so wherever a number built on it is quoted.
- **The model configuration is code** (`prism/config.py`); the dashboard shows
  it read-only.
- **Honest display.** One decimal for shifts and shares (docs/DESIGN.md
  names the three exceptions); the portfolio band is the joint percentile; the
  lenses are labelled attribution; sampling quality is the Monte Carlo
  standard error and seed stability; a shift always carries its sign.
  docs/adr/0007 has the reasons.
- **Only the drivers feed the Shift Matrix.** The Consumer Journey and the
  Profit Pool Explorer never read or write the simulation.
- **Parity.** The taxonomies (`prism/config.py` and `lib/format.ts`,
  `lib/valueChain.ts`), the uncertainty tables (`prism/config.py` and
  `lib/uncertainty.ts`) and the per-driver attribution
  (`scripts/build_driver_analysis.py` and `lib/driverAttribution.ts`) exist
  twice and are tested against each other; change both or neither.
- **Shift Matrix arithmetic** lives in `lib/shiftMatrix.ts`;
  `scripts/check_single_source.sh` (part of `npm run lint`) fails on a copy.
- **Design tokens.** Colours, shadows and fonts come from `lib/theme.ts` (the
  force and category palettes from `lib/format.ts`, which also builds the
  shift colours on the theme's pair); Tailwind reads the same tokens
  (`tailwind.config.ts`). A literal colour elsewhere in the dashboard's code,
  a named colour or a class of Tailwind's own palette (`bg-white`,
  `text-slate-500`) included, fails `tests/test_repository.py`.
  docs/DESIGN.md has the system.
- **Scripts are entry points.** Code that more than one script, or a script
  and the package, needs lives in `prism/` (the driver base, the readings
  renderer, the workbook reader); no script imports another.
- **Database changes are migrations** under `migrations/`, following
  `0001_driver_schema`: one transaction, a dry run, `--postgres` to touch
  PostgreSQL, an archive of everything dropped, a runbook, tests on SQLite
  and PostgreSQL.
- **Never run anything against the production database** without the owner
  asking for it. The scripts read `DATABASE_URL` from `.env`, which may be
  production. Never print or copy `.env`.

## Words

- The modelled items are **Profit Pool Drivers**, "Drivers" in menus and
  headers. Code, API, database and texts say driver. "Trend" appears only in
  its ordinary sense or in a foresight tier (Megatrend, Macrotrend).
- No em dash anywhere: not in code, comments, copy, content or documents
  (`tests/frontend/interfaceCopy.test.tsx` and `tests/test_repository.py`
  enforce it). Write plain, concrete English, British in interface copy and
  documents (materialisation, colour); identifiers keep their spelling.
- Documents and comments describe the system as it is. The history of how it
  got here lives in git, not in the tree.

## Commands

```bash
uvicorn prism.api.app:app --reload --port 8000   # the API
npm run dev                                      # the dashboard
npm run verify                                   # types, lint, both test suites
python3 -m pytest -n auto                        # the Python suite
python3 scripts/generate_seed.py --check         # and the other three generators
python3 scripts/run_production.py                # the production run (database in .env)
```

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
| `prism/readings.py`, `prism/workbook.py` | the PRISM Analysis renderer; the QA workbook, written and read back |
| `prism/api/` | the API: routers, auth, the stored-run contract (`runs.py`) |
| `scripts/` | production run, generators, `sync_analysis.py`, `promote_admin.py`, handover packaging |
| `data/drivers/` | the driver base and the PRISM Analysis sources |
| `components/dashboard/` | the views: each page in one file, its parts in a folder of its own (`drivers/`, `shift/`, `journey/`, `explorer/`, `settings/`), and the pieces several views share |
| `lib/`, `hooks/`, `types/` | shared dashboard logic and the API client, the store, the types |
| `docs/` | ARCHITECTURE, MODEL, DRIVERS, DRIVER_ANALYSIS, OPERATIONS, DESIGN, EXPLORER, `adr/` |
