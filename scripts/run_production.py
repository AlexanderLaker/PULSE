#!/usr/bin/env python3
"""Run the production simulation and persist it as the run the dashboard serves.

    python3 scripts/run_production.py                              3 x 50,000 iterations against the database in .env
    python3 scripts/run_production.py --cell-weights FILE          the same, on the finance cell weights
    python3 scripts/run_production.py --iterations 2000 --allow-sqlite   a quick local test run

The database comes from POSTGRES_URL or DATABASE_URL (the repository's .env
is loaded; shell variables win). Without one the script refuses to run
unless --allow-sqlite is passed, which uses the local SQLite file instead.

Steps: load the drivers, check that the copula correlations are positive
definite on this driver mix, run three independently seeded chains (master
seed 42) and pool them, compare the drivers' scoring state with the previous
run's (the input-drift integrity event), persist the results bundle as a new
simulation run and write the QA workbook to runs/.

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
       or still on the previous schema (run migrations/0001_driver_schema first)
    2  the database holds no drivers
    3  the simulation ran but persisting it failed; the dashboard keeps the previous run
    4  the correlation matrix is not positive definite on this driver mix (--allow-nonpsd overrides)
    5  the --cell-weights file is missing or invalid
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

import prism.env_loader  # noqa: E402,F401  (loads .env before prism.database reads the URL)
from prism.config import CATEGORIES, FORCES, REGIONS, ModelConfig  # noqa: E402
from prism.config_validation import correlation_lambda_min, validate_model_config  # noqa: E402
from prism.database import (POSTGRES_URL, USE_POSTGRES, LegacySchemaError, init_db, load_drivers,  # noqa: E402
                            load_latest_run, save_simulation_run)
from prism.drivers import DriverSet  # noqa: E402
from prism.input_drift import compute_input_drift_event, driver_fingerprint, previous_fingerprint  # noqa: E402
from prism.simulation.bayesian_mc import BayesianMonteCarloEngine  # noqa: E402
from prism.workbook import write_workbook  # noqa: E402

log = logging.getLogger("run_production")

MASTER_SEED = 42
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
            if isinstance(v, bool) or not isinstance(v, (int, float)) or v != v or v < 0:
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
    if basis == "gp1_absolute":
        source += " (absolute gross profit divided by its total at run time; no amount is stored)"
    return shares, source


def results_bundle(result: dict, config: ModelConfig, driver_count: int, fingerprint: dict) -> dict:
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
            "chains": result["n_chains"],
            "model_version": result["model_version"],
            "engine_name": result["engine_name"],
            "numerics_backend": result["numerics_backend"],
            "driver_count": driver_count,
            "attenuation_source": config.attenuation_source,
            "persisted_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            # The next run compares its drivers with this fingerprint.
            "driver_fingerprint": fingerprint,
        },
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--iterations", type=int, default=50_000, help="iterations per chain (default 50000)")
    parser.add_argument("--chains", type=int, default=3, help="independent chains (default 3)")
    parser.add_argument("--cell-weights", metavar="FILE", default=None,
                        help="finance cell weights (see above); without it the run uses the estimated HCB mix")
    parser.add_argument("--allow-sqlite", action="store_true",
                        help="run against the local SQLite file when no database is configured (tests only)")
    parser.add_argument("--allow-nonpsd", action="store_true",
                        help="run even if the correlation matrix is not positive definite on this driver mix; "
                             "the engine then repairs it and records an integrity event")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s", datefmt="%H:%M:%S")

    if not USE_POSTGRES and not args.allow_sqlite:
        log.error("No POSTGRES_URL or DATABASE_URL is set; put the database URL in .env "
                  "(or pass --allow-sqlite for a local test run).")
        return 1
    where = f"PostgreSQL at {urlparse(POSTGRES_URL).hostname}" if USE_POSTGRES else "the local SQLite file (test run)"
    log.info("PRISM production run, engine %s, %d x %s iterations, database: %s",
             BayesianMonteCarloEngine.MODEL_VERSION, args.chains, f"{args.iterations:,}", where)

    try:
        init_db()
        drivers = load_drivers()
    except LegacySchemaError as e:
        log.error("%s", e)
        return 1
    except Exception as e:  # noqa: BLE001 (reported with exit code 1)
        log.error("Cannot read the database: %s", e)
        return 1
    if not drivers:
        log.error("The database holds no drivers.")
        return 2
    from prism.seed_drivers import DRIVERS as SEED
    if len(drivers) != len(SEED):
        log.warning("The database holds %d drivers, the driver base %d; the input-drift event will show the "
                    "difference.", len(drivers), len(SEED))
    driver_set = DriverSet(drivers=drivers, categories=list(CATEGORIES), forces=list(FORCES))

    config = ModelConfig().copy_with(iterations=args.iterations)
    if args.cell_weights:
        try:
            shares, source = load_cell_weights_file(Path(args.cell_weights))
            config = config.copy_with(cell_weights=shares, cell_weights_source=source)
            validate_model_config(config)
        except (OSError, ValueError) as e:
            log.error("--cell-weights rejected: %s", e)
            return 5
    log.info("Cell weights: %s", config.cell_weights_source)
    log.info("  regions: %s", ", ".join(f"{r} {config.region_weights[r] * 100:.1f}%" for r in REGIONS))

    lam_min = correlation_lambda_min(config.force_correlation_matrix, config.within_force_rho,
                                     [d.force for d in drivers])
    log.info("Copula correlations on these %d drivers: minimum eigenvalue %+.4f", len(drivers), lam_min)
    if lam_min < 0 and not args.allow_nonpsd:
        log.error("The correlation matrix is not positive definite on this driver mix. The engine would "
                  "have to repair it, so the correlations it uses would differ from the configured ones. "
                  "Lower the cross-force correlations in prism/config.py, or pass --allow-nonpsd.")
        return 4

    log.info("Simulating (a few minutes at 3 x 50,000)...")
    started = datetime.now()
    result = BayesianMonteCarloEngine(config, seed=MASTER_SEED).run_multichain(
        driver_set, n_chains=args.chains, iterations=config.iterations)
    log.info("  done in %.0f s; seed stability %.4f pp across %d chains",
             (datetime.now() - started).total_seconds(), result["seed_stability"]["spread_pp"], args.chains)

    fingerprint = driver_fingerprint(drivers)
    try:
        previous = previous_fingerprint(load_latest_run())
        drift = compute_input_drift_event(fingerprint, *previous)
        if drift:
            result["integrity_events"].append(drift)
            log.info("  %s", drift["message"])
    except Exception as e:  # noqa: BLE001 (the run is still valid without the comparison)
        log.warning("Input-drift comparison skipped: %s", e)

    run_id = None
    try:
        run_id = save_simulation_run(config.iterations, results_bundle(result, config, len(drivers), fingerprint))
        log.info("Persisted as simulation run %s", run_id)
    except Exception as e:  # noqa: BLE001 (reported with exit code 3 after the workbook)
        log.error("PERSIST FAILED: %s", e)

    RUNS_DIR.mkdir(exist_ok=True)
    workbook = RUNS_DIR / f"prism_run_{run_id or 'unsaved'}_{datetime.now():%Y%m%d_%H%M}.xlsx"
    try:
        write_workbook(str(workbook), result, config, run_id=run_id, driver_count=len(drivers))
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
