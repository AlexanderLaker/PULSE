#!/usr/bin/env python3
"""Run the canonical production Monte Carlo against prod Neon and persist results.

Usage (from the operator machine, repo root):
    python3 scripts/run_50k_prod.py                 # canonical: 3 × 50k vs Neon
    python3 scripts/run_50k_prod.py --iterations 5000 --allow-sqlite   # local dry run

Requirements:
    - .env contains POSTGRES_URL or DATABASE_URL pointing at Neon prod
    - Python 3.10+ with requirements-dev.txt installed (numpy, scipy,
      psycopg2-binary, openpyxl, python-dotenv)

What it does:
    1. Loads the trend base from prod Neon via pulse.database.load_trends
    2. Runs BayesianMonteCarloEngine.run_multichain (3 × 50k, master seed 42)
    3. Computes the input-drift integrity event vs the previous run (D19)
    4. Persists the results bundle as a NEW simulation_runs row
    5. Writes a QA Excel to the repo root

Exit codes (H2, July 2026 review — cron/operators must see failures):
    0  success (run persisted; Excel best-effort)
    1  no database URL configured
    2  no trends loaded
    3  simulation succeeded but PERSIST FAILED — the dashboard will still
       show the previous run; nothing was written
    4  wrong database mode (Postgres URL set but SQLite fallback active —
       usually a missing psycopg2; H1) and --allow-sqlite not passed
"""

from __future__ import annotations

import argparse
import os
import sys
import logging
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

# Importing env_loader loads the .env file at module scope — no call needed.
import pulse.env_loader  # noqa: F401  (import-for-side-effect)

from pulse.config import ModelConfig, CATEGORIES, FORCES
from pulse.database import USE_POSTGRES, load_trends, save_simulation_run
from pulse.ingestion.models import TrendDatabase
from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine
from pulse.excel_bridge.writer import ShiftMatrixWriter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("run_50k_prod")

#: Trend-base size the operator expects (v3.5 base). A different count is not
#: fatal (the drift event reports adds/removes) but is warned loudly.
EXPECTED_TREND_COUNT = 99


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--iterations", type=int, default=50_000,
                        help="MC iterations per chain (default 50000)")
    parser.add_argument("--chains", type=int, default=3,
                        help="independent chains (default 3)")
    parser.add_argument("--allow-sqlite", action="store_true",
                        help="permit running against the local SQLite fallback "
                             "(testing only — NEVER for a production run)")
    args = parser.parse_args(argv)

    db_url = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")
    if not db_url and not args.allow_sqlite:
        log.error("No POSTGRES_URL / DATABASE_URL in environment — aborting.")
        log.error("Put POSTGRES_URL=postgres://… in .env and retry.")
        return 1

    # H1 (July 2026 review): a missing psycopg2 used to fall back to a local
    # SQLite file SILENTLY — the run said "saved" and exited 0, but nothing
    # reached Neon. Refuse to run in the wrong database mode.
    if db_url and not USE_POSTGRES and not args.allow_sqlite:
        log.error("A Postgres URL is configured but the SQLite fallback is "
                  "active (psycopg2 missing or connection refused at import).")
        log.error("Install psycopg2-binary (requirements-dev.txt) and retry, "
                  "or pass --allow-sqlite for a LOCAL TEST run.")
        return 4
    if db_url and "neon.tech" not in db_url:
        log.warning("DB URL does not look like Neon — double-check this is prod.")

    banner = (f"PRISM — production Monte Carlo · engine "
              f"{BayesianMonteCarloEngine.MODEL_VERSION} "
              f"({args.chains} × {args.iterations:,} iterations)")
    log.info("=" * 60)
    log.info(banner)
    log.info("=" * 60)
    if args.allow_sqlite and not USE_POSTGRES:
        log.warning("SQLite mode (--allow-sqlite): this is a TEST run, "
                    "results will not reach production.")

    # ── 1) Load trends ───────────────────────────────────────────────
    log.info("[1/5] Loading trends (%s)…", "Neon prod" if USE_POSTGRES else "SQLite")
    trends = load_trends()
    if not trends:
        log.error("No trends returned from DB — aborting.")
        return 2
    trend_db = TrendDatabase(
        trends=trends,
        categories=CATEGORIES,
        forces=FORCES,
        source_file="neon_prod" if USE_POSTGRES else "sqlite_local",
    )
    log.info(
        "      %d trends, %d categories, %d forces",
        len(trend_db.trends), len(trend_db.categories), len(trend_db.forces),
    )
    if len(trend_db.trends) != EXPECTED_TREND_COUNT:
        log.warning("Expected %d trends, found %d — the input-drift event "
                    "will report the delta.", EXPECTED_TREND_COUNT, len(trend_db.trends))

    # ── 2) Configure ─────────────────────────────────────────────────
    config = ModelConfig().copy_with(iterations=args.iterations)
    log.info(
        "[2/5] Config: %d iterations × %d chains = %d samples per category",
        config.iterations, args.chains, config.iterations * args.chains,
    )
    log.info("      Horizon: %s – %s", config.path_years[0], config.path_years[-1])

    # ── 3) Run multichain MC ─────────────────────────────────────────
    log.info("[3/5] Running Bayesian Monte Carlo (2–6 minutes at 3 × 50k)…")
    t0 = datetime.now()
    mc = BayesianMonteCarloEngine(config, seed=42)
    result = mc.run_multichain(trend_db, n_chains=args.chains,
                               iterations=config.iterations)
    elapsed = (datetime.now() - t0).total_seconds()
    log.info("      Done in %.1fs", elapsed)

    converged = sum(1 for v in result["convergence"].values() if v.get("converged"))
    total_cats = len(result["convergence"])
    log.info("      Convergence: %d/%d categories R̂ < 1.05", converged, total_cats)
    stability = result.get("seed_stability") or {}
    if stability:
        log.info("      Seed stability: terminal-year portfolio median spread "
                 "%.4f pp across %d chains", stability.get("spread_pp", 0.0),
                 stability.get("n_chains", args.chains))

    # ── 4) Input-drift integrity event (D19) ─────────────────────────
    # Diff this run's trend scoring state against the previous accepted
    # run's persisted fingerprint; the event lands in integrity_events and
    # is persisted with the run so the dashboard surfaces it.
    from pulse.audit.input_drift import (
        trend_fingerprint, compute_input_drift_event, previous_fingerprint_from_runs,
    )
    current_fp = trend_fingerprint(trend_db.trends)
    try:
        from pulse.database import load_simulation_runs
        prev_fp, prev_id, prev_date = previous_fingerprint_from_runs(load_simulation_runs(limit=1))
        drift_event = compute_input_drift_event(current_fp, prev_fp, prev_id, prev_date)
        if drift_event:
            result.setdefault("integrity_events", []).append(drift_event)
            log.info("      %s", drift_event["message"])
        elif prev_id is not None:
            log.info("      Input drift: previous run #%s has no fingerprint (pre-D19) — baseline starts now.", prev_id)
    except Exception as e:
        log.warning("Input-drift check skipped: %s", e)

    # ── 5) Persist ───────────────────────────────────────────────────
    # Save the full results bundle (shift_matrix + decompositions + totals +
    # journey/vc decompositions + integrity + seed stability) in the shape
    # the FastAPI /api/v1/simulation endpoint rehydrates.
    log.info("[5/5] Persisting to %s…", "Neon PROD" if USE_POSTGRES else "SQLite (test)")
    persist_failed = False
    run_id = None
    try:
        results_bundle = {
            "shift_matrix": result.get("shift_matrix"),
            "decompositions": result.get("decompositions"),
            "totals": result.get("totals"),
            "vc_decomposition": result.get("vc_decomposition"),
            "journey_decomposition": result.get("journey_decomposition"),
            # D19: integrity events (incl. input drift) + seed stability
            # persist with the run so the read-only dashboard can show them.
            "integrity_events": result.get("integrity_events", []),
            "seed_stability": result.get("seed_stability"),
            # F2: every persisted run carries its engine fidelity. D13: the
            # engine itself is scipy-only (it refuses to import without
            # scipy), so reaching this line implies exact numerics; the
            # numerics_backend records the exact versions for the audit trail.
            "meta": {
                "engine_fidelity": "scipy",
                "numerics_backend": result.get("numerics_backend"),
                # L8: master seed (reproduces the run) + derived chain seeds.
                "seed": result.get("master_seed", result.get("seed")),
                "chain_seeds": result.get("chain_seeds"),
                "chains": args.chains,
                "model_version": result.get("model_version"),
                "engine_name": result.get("engine_name"),
                "persisted_at_utc": datetime.now(timezone.utc).isoformat(),
                # D19: fingerprint of THIS run's inputs — next run diffs itself
                # against it.
                "trend_fingerprint": current_fp,
            },
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
        # H2: record the failure but continue to the Excel export so the
        # operator still gets the QA artifact — then exit non-zero below.
        log.error("PERSIST FAILED: %s", e)
        persist_failed = True

    # Excel export for QA (best-effort; failure is warned, not fatal)
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

    # Headline — the same number the dashboard headline shows: the joint
    # portfolio (category-weighted) median at the terminal year (D3), not a
    # plain across-category average (L13, July 2026 review).
    last_year = int(config.path_years[-1])
    portfolio = (result.get("totals") or {}).get("portfolio") or {}
    cell = portfolio.get(last_year) or portfolio.get(str(last_year)) or {}
    if cell:
        log.info("")
        log.info("═" * 60)
        log.info("  Portfolio %d median shift: %+.1f%%  (P10 %+.1f%% · P90 %+.1f%%)",
                 last_year, cell["median"] * 100, cell["p10"] * 100, cell["p90"] * 100)
        log.info("═" * 60)

    if persist_failed:
        log.error("Run NOT persisted — fix the database issue and re-run. "
                  "(The dashboard still serves the previous run.)")
        return 3
    return 0


if __name__ == "__main__":
    sys.exit(main())
