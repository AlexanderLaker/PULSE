"""Run the production simulation and persist it as the run the dashboard serves.

    python3 scripts/run_production.py                              3 x 50,000 iterations against the database in .env
    python3 scripts/run_production.py --cell-weights FILE          the same, on the finance cell weights
    python3 scripts/run_production.py --iterations 2000 --allow-sqlite   a quick local test run (no database URL set)

The database comes from POSTGRES_URL or DATABASE_URL (the repository's .env
is loaded; shell variables win). Without one the script refuses to run
unless --allow-sqlite is passed, which uses the local SQLite file instead
and seeds it with the driver base when it holds no drivers. On PostgreSQL a
run is served as soon as it is stored, so only the production size runs
there unless --allow-test-size is passed (a development database).

Every run records where its code came from: the commit and whether the
working tree had uncommitted changes (git's view, tracked files only).

Steps: load the drivers, check that every driver can be simulated and that
the copula correlations are positive definite on this driver mix, run three
independently seeded chains (master seed 42) and pool them, compare the
drivers' scoring state with the previous run's (the input-drift integrity
event), persist the results bundle as a new simulation run and write the QA
workbook to runs/.

--cell-weights FILE is a JSON object, kept outside the repository:
    {"source": "<label shown with the run>",
     "basis": "gp1_share" | "gp1_absolute",
     "cells": {"<category>": {"<region>": value, ...}, ...}}
with every category and region of prism.config. Shares must add up to 1
(within 0.01); absolute figures are divided by their total here, so neither
the engine nor the database ever sees an amount.

Exit codes
    0  the run is persisted (the QA workbook is best effort)
    1  no usable database: none configured (and no --allow-sqlite), unreachable,
       or still awaiting a migration (the message names it)
    2  the PostgreSQL database holds no drivers; also argparse's code for a
       command line it cannot read
    3  the simulation ran but persisting it failed; the dashboard keeps the previous run
    4  the correlation matrix is not positive definite on this driver mix (--allow-nonpsd overrides)
    5  the run size or the configuration is invalid: --iterations or --chains
       outside their range (prism.config RUN_*_RANGE), a size other than the
       production one on PostgreSQL without --allow-test-size, or the
       --cell-weights file missing or invalid
    6  a driver cannot be simulated (prism.drivers.simulation_problems: an
       unknown force, direction, curve or value-chain stage, a missing score, a
       score outside its scale, a peak year not after the onset, a category or
       region without an exposure score, an exposure on a name outside the
       taxonomy, a duplicate id); every problem is listed. PRISM stores no such
       driver, so this points at a change made to the database outside PRISM;
       a start year or a force corrected there needs its revision raised as
       well, so the service reloads the driver
Any other error stops the run with a traceback and Python's exit code 1.
"""
from __future__ import annotations

import argparse
import json
import logging
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

import prism.env_loader  # noqa: E402,F401  (loads .env before prism.database reads the URL)
from prism.config import (CATEGORIES, ESTIMATE_SOURCE_PREFIX, POSITIVE_DEFINITE_FLOOR, PRODUCTION_CHAINS,  # noqa: E402
                          PRODUCTION_ITERATIONS, PRODUCTION_SEED, REGIONS, ModelConfig, cell_weight_marginals)
from prism.config_validation import correlation_lambda_min, validate_model_config, validate_run_size  # noqa: E402
from prism.database import (POSTGRES_URL, USE_POSTGRES, MigrationPendingError, describe_error,  # noqa: E402
                            holds_history, init_db, insert_drivers, load_drivers, load_latest_run,
                            save_simulation_run)
from prism.drivers import DriverSet, simulation_problems  # noqa: E402
from prism.engine import MonteCarloEngine  # noqa: E402
from prism.input_drift import compare_with_run, driver_fingerprint, not_compared_event  # noqa: E402
from prism.numbers import finite_number  # noqa: E402
from prism.seed_drivers import DRIVERS as BASE_DRIVERS, get_seed_drivers  # noqa: E402
from prism.workbook import write_workbook  # noqa: E402

log = logging.getLogger("run_production")

RUNS_DIR = REPO / "runs"


def load_cell_weights_file(path: Path) -> tuple:
    """(shares, source label) from a finance cell-weights file; ValueError on any defect."""
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(raw, dict) or not isinstance(raw.get("cells"), dict):
        raise ValueError("the file must be a JSON object with a 'cells' object")
    basis = str(raw.get("basis", "gp1_share")).strip().lower()
    if basis not in ("gp1_share", "gp1_absolute"):
        raise ValueError(f"basis must be 'gp1_share' or 'gp1_absolute', not {basis!r}")
    cells = raw["cells"]
    missing, unknown = [c for c in CATEGORIES if c not in cells], [c for c in cells if c not in CATEGORIES]
    if missing or unknown:
        raise ValueError(f"cells: missing categories {missing}; unknown categories {unknown}")
    values = {}
    for cat in CATEGORIES:
        row = cells[cat]
        if not isinstance(row, dict):
            raise ValueError(f"cells['{cat}'] must map every region to a value")
        missing, unknown = [r for r in REGIONS if r not in row], [r for r in row if r not in REGIONS]
        if missing or unknown:
            raise ValueError(f"cells['{cat}']: missing regions {missing}; unknown regions {unknown}")
        for region in REGIONS:
            v = row[region]
            if not finite_number(v) or v < 0:
                raise ValueError(f"cells['{cat}']['{region}'] must be a non-negative number, not {v!r}")
        values[cat] = {r: float(row[r]) for r in REGIONS}
    total = sum(v for row in values.values() for v in row.values())
    if total <= 0:
        raise ValueError("the cells must contain at least one positive value")
    if basis == "gp1_share" and abs(total - 1.0) > 0.01:
        raise ValueError(f"basis 'gp1_share' needs the {len(CATEGORIES) * len(REGIONS)} cells to add up to 1 "
                         f"(within 0.01), not {total:.4f}")
    shares = {c: {r: v / total for r, v in row.items()} for c, row in values.items()}
    source = str(raw.get("source") or f"cell-weights file {Path(path).name}")
    if source.strip().upper().startswith(ESTIMATE_SOURCE_PREFIX.upper()):
        raise ValueError(f"the source label may not open with {ESTIMATE_SOURCE_PREFIX!r}: that marks the built-in "
                         "estimate, and the dashboard would show the file's weights as the estimate")
    if basis == "gp1_absolute":
        source += " (absolute gross profit divided by its total at run time; no amount is stored)"
    return shares, source


def source_state() -> dict:
    """The commit the code comes from and whether tracked files differ from it.

    Both are None when git or the repository's own history is not available:
    an exported copy of the tree, also one that sits inside another git work
    tree, whose commit would not be this code's. A run never fails for want
    of them.
    """
    def git(*args: str) -> str:
        return subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True, check=True,
                              timeout=30).stdout
    try:
        if Path(git("rev-parse", "--show-toplevel").strip()).resolve() != REPO.resolve():
            return {"commit": None, "dirty": None}
        commit = git("rev-parse", "HEAD").strip()
        dirty = bool(git("status", "--porcelain", "--untracked-files=no").strip())
    except (OSError, subprocess.SubprocessError):
        return {"commit": None, "dirty": None}
    return {"commit": commit, "dirty": dirty}


def describe_source(source: dict) -> str:
    if not source.get("commit"):
        return "not a git checkout"
    return source["commit"][:12] + (" with uncommitted changes" if source.get("dirty") else "")


def results_bundle(result: dict, config: ModelConfig, driver_count: int, fingerprint: dict,
                   source: dict | None = None) -> dict:
    """The persisted form of a run: what GET /api/v1/simulation serves (prism/api/runs.py)."""
    return {
        "shift_matrix": result["shift_matrix"],
        "regional_shift_matrix": result["regional_shift_matrix"],
        "decompositions": result["decompositions"],
        "totals": result["totals"],
        "cell_weights_used": result["cell_weights_used"],
        "category_weights_used": result["category_weights_used"],
        "region_weights_used": result["region_weights_used"],
        "cell_weights_source": result["cell_weights_source"],
        "mc_standard_error": result["mc_standard_error"],
        "integrity_events": result["integrity_events"],
        "seed_stability": result["seed_stability"],
        "meta": {
            "seed": result["seed"],
            "chain_seeds": result["chain_seeds"],
            "chains": result["chains"],
            "model_version": result["model_version"],
            "engine_name": result["engine_name"],
            "numerics_backend": result["numerics_backend"],
            "driver_count": driver_count,
            "overlap_correction_source": config.overlap_correction_source,
            # The next run compares its drivers with this fingerprint.
            "driver_fingerprint": fingerprint,
            # Where the run's code came from (source_state).
            "source": source or {"commit": None, "dirty": None},
        },
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--iterations", type=int, default=PRODUCTION_ITERATIONS,
                        help=f"iterations per chain (default {PRODUCTION_ITERATIONS})")
    parser.add_argument("--chains", type=int, default=PRODUCTION_CHAINS,
                        help=f"independent chains (default {PRODUCTION_CHAINS})")
    parser.add_argument("--cell-weights", metavar="FILE", default=None,
                        help="finance cell weights (see above); without it the run uses the estimated HCB mix")
    parser.add_argument("--allow-sqlite", action="store_true",
                        help="run against the local SQLite file when no database is configured (local "
                             "development and tests)")
    parser.add_argument("--allow-test-size", action="store_true",
                        help="on PostgreSQL, accept a size other than the production one (a development "
                             "database; the run is served at once)")
    parser.add_argument("--allow-nonpsd", action="store_true",
                        help="run even if the correlation matrix is not positive definite on this driver mix; "
                             "the engine then repairs it and records an integrity event")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s", datefmt="%H:%M:%S")
    try:
        validate_run_size(args.iterations, args.chains)
    except ValueError as e:
        log.error("%s", e)
        return 5

    if not USE_POSTGRES and not args.allow_sqlite:
        log.error("No POSTGRES_URL or DATABASE_URL is set; put the database URL in .env "
                  "(or pass --allow-sqlite for a local test run).")
        return 1
    production_size = (args.iterations, args.chains) == (PRODUCTION_ITERATIONS, PRODUCTION_CHAINS)
    if USE_POSTGRES and not production_size and not args.allow_test_size:
        log.error("A run on PostgreSQL is served as soon as it is stored, so it runs at the production size "
                  "(%d x %s iterations). For a development database pass --allow-test-size; for a local test "
                  "run blank the database URLs and pass --allow-sqlite.", PRODUCTION_CHAINS,
                  f"{PRODUCTION_ITERATIONS:,}")
        return 5
    where = f"PostgreSQL at {urlparse(POSTGRES_URL).hostname}" if USE_POSTGRES else "the local SQLite file (test run)"
    log.info("PRISM production run, engine %s, %d x %s iterations, database: %s",
             MonteCarloEngine.MODEL_VERSION, args.chains, f"{args.iterations:,}", where)
    code_origin = source_state()
    log.info("Code: %s", describe_source(code_origin))
    if code_origin["dirty"] and USE_POSTGRES:
        log.warning("The working tree has uncommitted changes: the run records the commit and that it was "
                    "made with changes on top of it.")

    try:
        init_db()
        drivers = load_drivers()
    except MigrationPendingError as e:
        log.error("%s", e)
        return 1
    except Exception as e:  # noqa: BLE001 (reported with exit code 1)
        log.error("Cannot read the database: %s", e)
        return 1
    if not drivers and not USE_POSTGRES and not holds_history():
        # A new local file: seeded with the driver base, as the API would on first use.
        insert_drivers(get_seed_drivers())
        drivers = load_drivers()
        log.info("The new local SQLite file held no drivers; seeded it with the %d of the driver base.",
                 len(drivers))
    if not drivers:
        log.error("The database holds no drivers. PRISM seeds only a new database (the API on its first use, "
                  "this run for a new local file); a database that lost its drivers is restored from its "
                  "backup, and a local file can be deleted to start afresh.")
        return 2
    problems = simulation_problems(drivers)
    if problems:
        log.error("These drivers cannot be simulated:")
        for line in problems:
            log.error("  %s", line)
        log.error("Scores, timing and exposures can be corrected on the Drivers page; a start year or a force "
                  "needs a fix in the database, with the driver's revision raised by one so the service "
                  "reloads it.")
        return 6
    if len(drivers) != len(BASE_DRIVERS):
        log.warning("The database holds %d drivers, the driver base %d; the input-drift event will show the "
                    "difference.", len(drivers), len(BASE_DRIVERS))
    driver_set = DriverSet(drivers=drivers)

    config = ModelConfig()
    if args.cell_weights:
        try:
            shares, source = load_cell_weights_file(Path(args.cell_weights))
            config = config.copy_with(cell_weights=shares, cell_weights_source=source)
        except (OSError, ValueError) as e:
            log.error("--cell-weights rejected: %s", e)
            return 5
    try:
        validate_model_config(config)
    except ValueError as e:
        log.error("%s", e)
        return 5
    log.info("Cell weights: %s", config.cell_weights_source)
    region_shares, _ = cell_weight_marginals(config.cell_weights)
    log.info("  regions: %s", ", ".join(f"{r} {region_shares[r] * 100:.1f}%" for r in REGIONS))

    lam_min = correlation_lambda_min(config.force_correlation_matrix, config.within_force_rho,
                                     [d.force for d in drivers])
    log.info("Copula correlations on these %d drivers: minimum eigenvalue %+.4f", len(drivers), lam_min)
    if lam_min <= POSITIVE_DEFINITE_FLOOR and not args.allow_nonpsd:
        log.error("The correlation matrix is not positive definite on this driver mix. The engine would "
                  "have to repair it, so the correlations it uses would differ from the configured ones. "
                  "Lower the cross-force correlations in prism/config.py, or pass --allow-nonpsd.")
        return 4

    log.info("Simulating%s...", " (a few minutes at this size)" if args.chains * args.iterations >= 100_000 else "")
    started = datetime.now()
    result = MonteCarloEngine(config, seed=PRODUCTION_SEED).run(
        driver_set, iterations=args.iterations, chains=args.chains)
    log.info("  done in %.0f s; seed stability %.4f pp across %d chains",
             (datetime.now() - started).total_seconds(), result["seed_stability"]["spread_pp"], args.chains)

    fingerprint = driver_fingerprint(drivers)
    try:
        drift = compare_with_run(fingerprint, load_latest_run())
    except Exception as e:  # noqa: BLE001 (the run is still valid without the comparison, and says so)
        log.warning("The previous run could not be read: %s", e)
        drift = not_compared_event(f"the previous run could not be read ({describe_error(e)})")
    if drift:
        result["integrity_events"].append(drift)
        log.info("  %s", drift["message"])

    run_id = None
    try:
        run_id = save_simulation_run(args.iterations,
                                     results_bundle(result, config, len(drivers), fingerprint, code_origin))
        log.info("Persisted as simulation run %s", run_id)
    except Exception as e:  # noqa: BLE001 (reported with exit code 3 after the workbook)
        log.error("PERSIST FAILED: %s", e)

    RUNS_DIR.mkdir(exist_ok=True)
    workbook = RUNS_DIR / f"prism_run_{run_id or 'unsaved'}_{datetime.now():%Y%m%d_%H%M}.xlsx"
    try:
        write_workbook(str(workbook), result, config, run_id=run_id, driver_count=len(drivers),
                       source=describe_source(code_origin))
        log.info("QA workbook: %s", workbook)
    except Exception as e:  # noqa: BLE001 (the workbook is a by-product)
        log.warning("QA workbook not written: %s", e)

    year = config.path_years[-1]
    headline = result["totals"]["portfolio"][year]
    log.info("Portfolio %d median shift %+.1f%% (P10 %+.1f%%, P90 %+.1f%%)",
             year, headline["median"] * 100, headline["p10"] * 100, headline["p90"] * 100)
    if run_id is None:
        log.error("The run was NOT persisted; the dashboard still serves the previous run.")
        return 3
    return 0


if __name__ == "__main__":
    sys.exit(main())
