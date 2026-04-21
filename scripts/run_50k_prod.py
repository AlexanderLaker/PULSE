#!/usr/bin/env python3
"""Run a 50K-iteration Bayesian MC against PROD Neon and persist results.

Usage (from your Mac, after `source .env`):
    python3 scripts/run_50k_prod.py

Requirements:
    - PROFIT_POOL_ENGINE/.env contains POSTGRES_URL or DATABASE_URL
    - Python 3.10+ with: pip install -r requirements-dev.txt

What it does:
    1. Loads the trend database from prod Neon (should be 82 v3.1 trends)
    2. Runs BayesianMonteCarloEngine.run_multichain(n_chains=3, iterations=50_000)
    3. Writes a simulation_runs row to prod with full shift_matrix,
       allocation, and convergence diagnostics
    4. Prints headline metrics + path to the Excel export
"""

from __future__ import annotations

import os
import sys
import json
import logging
from datetime import datetime
from pathlib import Path

# Ensure we can import the pulse package when running from repo root
REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

from pulse.env_loader import load_env  # type: ignore
from pulse.config import ModelConfig
from pulse.database import Database
from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine
from pulse.optimizer.allocation import AllocationOptimizer
from pulse.excel_bridge.writer import ShiftMatrixWriter
from pulse.seed_trends import load_trend_database

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("run_50k_prod")


def main() -> int:
    load_env()  # reads .env if present

    db_url = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")
    if not db_url:
        log.error("No POSTGRES_URL / DATABASE_URL set — aborting.")
        return 1
    if "neon.tech" not in db_url and "postgres" not in db_url:
        log.warning("DB URL does not look like Postgres/Neon. Continuing anyway.")

    log.info("=" * 60)
    log.info("PRISM v3.2 — 50K Production Monte Carlo")
    log.info("=" * 60)

    # 1) Load trend database (prefers DB, falls back to seed file)
    log.info("[1/5] Loading trend database…")
    trend_db = load_trend_database()
    log.info(
        "      %d trends, %d categories, %d forces",
        len(trend_db.trends), len(trend_db.categories), len(trend_db.forces),
    )
    if len(trend_db.trends) != 82:
        log.warning("Expected 82 trends (v3.1), found %d", len(trend_db.trends))

    # 2) Configure for 50K multichain
    config = ModelConfig().copy_with(
        iterations=50_000,
        category_names=trend_db.categories or None,
    )
    log.info(
        "[2/5] Config: %d iterations × 3 chains = %d total samples per category",
        config.iterations, config.iterations * 3,
    )
    log.info("      Horizon: %s – %s", config.path_years[0], config.path_years[-1])

    # 3) Run multichain MC
    log.info("[3/5] Running Bayesian Monte Carlo (this takes 2–6 minutes)…")
    t0 = datetime.now()
    mc = BayesianMonteCarloEngine(config, seed=42)
    result = mc.run_multichain(trend_db, n_chains=3, iterations=config.iterations)
    elapsed = (datetime.now() - t0).total_seconds()
    log.info("      Done in %.1fs", elapsed)

    converged = sum(1 for v in result["convergence"].values() if v.get("converged"))
    total_cats = len(result["convergence"])
    log.info("      Convergence: %d/%d categories R̂ < 1.05", converged, total_cats)

    # 4) Optimizer
    log.info("[4/5] Running allocation optimizer…")
    optimizer = AllocationOptimizer(config)
    allocation = optimizer.optimize(
        result["shift_matrix"],
        risk_aversion=1.0,
        raw_samples=result.get("raw_samples"),
        category_order=config.category_names,
    )

    # 5) Persist to prod DB
    log.info("[5/5] Persisting to Neon PROD…")
    db = Database(db_url=db_url)
    snapshot_id = db.save_config_snapshot(config.to_json())
    run_id = db.save_simulation_run(
        scenario="50K v3.2 production baseline",
        iterations=config.iterations,
        model_type="bayesian_mc_multichain",
        config_snapshot_id=snapshot_id,
        results=result,
        allocation=allocation,
        convergence=result["convergence"],
    )
    log.info("      Saved simulation_run id=%s, config_snapshot id=%s", run_id, snapshot_id)

    # Optional: Excel export for quick QA
    out_path = REPO / f"shift_matrix_50k_{datetime.now():%Y%m%d_%H%M}.xlsx"
    try:
        writer = ShiftMatrixWriter(config)
        writer.write(
            str(out_path),
            result,
            allocation=allocation,
            metadata={
                "model_version": result.get("model_version"),
                "engine_name": result.get("engine_name"),
                "iterations": config.iterations,
                "simulation_run_id": run_id,
            },
        )
        log.info("      Excel: %s", out_path)
    except Exception as e:
        log.warning("Excel export skipped: %s", e)

    # Headline
    sm = result["shift_matrix"]
    last_year = config.path_years[-1]
    headline = sum(
        sm[c]["path"][last_year]["median"]
        for c in config.category_names if c in sm
    ) / max(1, len(config.category_names))
    log.info("")
    log.info("═" * 60)
    log.info("  Headline %d median shift: %+.3f%%", last_year, headline * 100)
    log.info("═" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
