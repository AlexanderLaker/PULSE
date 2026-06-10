#!/usr/bin/env python3
"""Run a 50K-iteration Bayesian MC against PROD Neon and persist results.

Usage (from your Mac, from repo root):
    python3 scripts/run_50k_prod.py

Requirements:
    - PROFIT_POOL_ENGINE/.env contains POSTGRES_URL or DATABASE_URL
      pointing at Neon prod
    - Python 3.10+ with: python-dotenv, psycopg2-binary, numpy, scipy,
      openpyxl, arviz  (arviz optional — used only for R̂ diagnostics)

What it does:
    1. Loads the 99 v3.5 trends from prod Neon via pulse.database.load_trends
    2. Runs BayesianMonteCarloEngine.run_multichain(n_chains=3, iterations=50_000)
    3. Persists the shift matrix + convergence to prod Neon
    4. Writes a QA Excel alongside the repo root
"""

from __future__ import annotations

import os
import sys
import logging
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

# Importing env_loader auto-loads the .env file at module scope — no function call needed.
import pulse.env_loader  # noqa: F401  (import-for-side-effect)

from pulse.config import ModelConfig, CATEGORIES, FORCES
from pulse.database import load_trends, save_simulation_run
from pulse.ingestion.models import TrendDatabase
from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine
from pulse.excel_bridge.writer import ShiftMatrixWriter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("run_50k_prod")


def main() -> int:
    db_url = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")
    if not db_url:
        log.error("No POSTGRES_URL / DATABASE_URL in environment — aborting.")
        log.error("Put POSTGRES_URL=postgres://… in .env and retry.")
        return 1
    if "neon.tech" not in db_url:
        log.warning("DB URL does not look like Neon — double-check this is prod.")

    log.info("=" * 60)
    log.info("PRISM v3.5 — 50K Production Monte Carlo")
    log.info("=" * 60)

    # ── 1) Load trends from prod Neon ────────────────────────────────
    log.info("[1/5] Loading trends from prod Neon…")
    trends = load_trends()
    if not trends:
        log.error("No trends returned from DB — aborting.")
        return 2
    trend_db = TrendDatabase(
        trends=trends,
        categories=CATEGORIES,
        forces=FORCES,
        source_file="neon_prod",
    )
    log.info(
        "      %d trends, %d categories, %d forces",
        len(trend_db.trends), len(trend_db.categories), len(trend_db.forces),
    )
    if len(trend_db.trends) != 99:
        log.warning("Expected 99 trends (v3.5), found %d", len(trend_db.trends))

    # ── 2) Configure for 50K multichain ──────────────────────────────
    config = ModelConfig().copy_with(iterations=50_000)
    log.info(
        "[2/5] Config: %d iterations × 3 chains = %d samples per category",
        config.iterations, config.iterations * 3,
    )
    log.info("      Horizon: %s – %s", config.path_years[0], config.path_years[-1])

    # ── 3) Run multichain MC ─────────────────────────────────────────
    log.info("[3/5] Running Bayesian Monte Carlo (2–6 minutes)…")
    t0 = datetime.now()
    mc = BayesianMonteCarloEngine(config, seed=42)
    result = mc.run_multichain(trend_db, n_chains=3, iterations=config.iterations)
    elapsed = (datetime.now() - t0).total_seconds()
    log.info("      Done in %.1fs", elapsed)

    converged = sum(1 for v in result["convergence"].values() if v.get("converged"))
    total_cats = len(result["convergence"])
    log.info("      Convergence: %d/%d categories R̂ < 1.05", converged, total_cats)

    # ── 4) Allocation optimizer removed (D4, June 2026) ─────────────
    allocation = None

    # ── 5) Persist to prod Neon ──────────────────────────────────────
    # Save the full results bundle (shift_matrix + decompositions + totals +
    # vc_decomposition) so the dashboard's "Trends 2" and
    # "Profit Pool Analysis 2" views hydrate correctly on cold start. Must
    # match the bundle shape the FastAPI /api/v1/simulation endpoint expects.
    log.info("[5/5] Persisting to Neon PROD…")
    try:
        results_bundle = {
            "shift_matrix": result.get("shift_matrix"),
            "decompositions": result.get("decompositions"),
            "totals": result.get("totals"),
            "vc_decomposition": result.get("vc_decomposition"),
        }
        run_id = save_simulation_run(
            iterations=config.iterations,
            model_type="bayesian_copula_multichain",
            results=results_bundle,
            force_attribution=result.get("force_attribution"),
            allocation_recommendation=None,
            convergence_diagnostics=result.get("convergence"),
        )
        log.info("      Saved simulation_run id=%s", run_id)
    except Exception as e:
        log.error("PERSIST FAILED: %s", e)
        log.error("(Continuing so you still get the Excel QA export)")
        run_id = None

    # Excel export for QA
    out_path = REPO / f"shift_matrix_50k_{datetime.now():%Y%m%d_%H%M}.xlsx"
    try:
        writer = ShiftMatrixWriter(config)
        writer.write(
            str(out_path),
            result,
            allocation=None,
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
    cats_with_data = [c for c in config.category_names if c in sm]
    if cats_with_data:
        headline = sum(
            sm[c]["path"][last_year]["median"] for c in cats_with_data
        ) / len(cats_with_data)
        log.info("")
        log.info("═" * 60)
        log.info("  Headline %d median shift: %+.3f%%", last_year, headline * 100)
        log.info("═" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
