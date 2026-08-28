"""PRISM CLI — Main entry point for the Profit Pool Simulation Engine.

Usage:
    python -m pulse --output shift_matrix.xlsx
    python -m pulse --serve
"""

import argparse
import json
import logging
import sys
from pathlib import Path
from datetime import datetime

from pulse import __version__
from pulse.config import ModelConfig
from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine
from pulse.simulation.paths import PathAnalyzer
from pulse.excel_bridge.writer import ShiftMatrixWriter
from pulse.audit.logger import AuditLogger

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("pulse")


def create_parser():
    parser = argparse.ArgumentParser(
        prog="pulse",
        description="PRISM — Profit Pool Risk & Intelligence Simulation Model v" + __version__
    )
    parser.add_argument("--output", "-o", help="Output path for Shift Matrix Excel",
                        default="shift_matrix.xlsx")
    parser.add_argument("--iterations", type=int, default=None,
                        help="Number of Monte Carlo iterations")
    parser.add_argument("--serve", action="store_true",
                        help="Launch the local FastAPI backend (dev server on :8000)")
    parser.add_argument("--audit", action="store_true",
                        help="Show audit trail")
    # (--ai flag removed 2026-07-06 with the pulse/ai layer — it was dead:
    #  create_app() never read it.)
    # B6: RNG seed exposure. --seed for reproducibility, --seeds for wobble.
    parser.add_argument("--seed", type=int, default=42,
                        help="RNG seed for reproducibility (default 42)")
    parser.add_argument("--seeds", type=int, nargs="+", default=None,
                        help="Run multiple seeds and report seed-wobble (e.g. --seeds 1 2 3)")
    parser.add_argument("--verbose", "-v", action="store_true")
    return parser


def main():
    parser = create_parser()
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    print(f"\n{'═' * 60}")
    print(f"  PRISM v{__version__} — Profit Pool Simulation Engine")
    print(f"  Bayesian MC · Copula Dependencies")
    print(f"{'═' * 60}\n")

    # Audit trail
    audit = AuditLogger()

    if args.audit:
        print(audit.get_report())
        return

    if args.serve:
        _launch_api_server(args)
        return

    # ── Step 1: Load Trend Database ─────────────────────────────────
    print("[1/5] Loading trend database...")
    try:
        # Load from the DB; if empty (fresh local SQLite), seed the 99-trend base.
        from pulse.database import load_trends, init_db, save_trends
        from pulse.config import CATEGORIES, FORCES
        from pulse.ingestion.models import TrendDatabase
        trends = load_trends()
        if not trends:
            from pulse.seed_trends import TRENDS
            init_db(); save_trends(TRENDS)
            trends = load_trends()
        db = TrendDatabase(trends=trends, categories=CATEGORIES, forces=FORCES)
        print(f"      {len(db.trends)} trends, {len(db.categories)} categories, {len(db.forces)} forces")
    except Exception as e:
        print(f"ERROR loading trend database: {e}")
        sys.exit(1)

    # ── Step 2: Configure ───────────────────────────────────────────
    # B4: ModelConfig is frozen — build via copy_with(), never mutate
    _cfg_overrides = {}
    if db.categories:
        _cfg_overrides["category_names"] = db.categories
    if args.iterations:
        _cfg_overrides["iterations"] = args.iterations
    config = ModelConfig().copy_with(**_cfg_overrides) if _cfg_overrides else ModelConfig()

    # ── Step 3: Simulate ────────────────────────────────────────────
    # B6 & A5: Default to multichain (n_chains=3) for robust convergence diagnostics.
    # If --seeds is provided (multiple seeds), run wobble analysis instead.
    if args.seeds and len(args.seeds) > 1:
        import numpy as _np
        print(f"[2/5] Running Bayesian Monte Carlo across {len(args.seeds)} seeds "
              f"({config.iterations:,} iterations each) for seed-wobble analysis...")
        headlines = []
        last_result = None
        for s in args.seeds:
            _mc = BayesianMonteCarloEngine(config, seed=s)
            _r = _mc.run(db)
            last_result = _r
            sm = _r["shift_matrix"]
            # L1 (July 2026 review): category cells are {"path": {...},
            # "velocity": {...}} — the old code iterated cat.keys() (the
            # words "path"/"velocity") as years and crashed on int("path").
            last_year = max(
                int(y) for cat in sm.values() for y in cat.get("path", {})
            )
            headline = float(_np.mean([
                cat["path"][last_year]["median"] for cat in sm.values()
                if last_year in cat.get("path", {})
            ]))
            headlines.append(headline)
            print(f"      seed={s}: headline shift {headline:+.4f}")
        mean_h, std_h = float(_np.mean(headlines)), float(_np.std(headlines))
        print(f"      WOBBLE: mean={mean_h:+.4f}  std={std_h:.4f}  "
              f"min={min(headlines):+.4f}  max={max(headlines):+.4f}")
        mc_result = last_result
        mc_result["seed"] = args.seeds[-1]
        mc_result["seed_wobble"] = {
            "seeds": list(args.seeds),
            "headline_mean": mean_h, "headline_std": std_h,
            "headline_min": float(min(headlines)),
            "headline_max": float(max(headlines)),
        }
    else:
        # Default: use multichain with n_chains=3 for proper convergence diagnostics
        print(f"[2/5] Running Bayesian Monte Carlo (multichain: 3 chains, "
              f"{config.iterations:,} iterations each, seed={args.seed})...")
        mc_engine = BayesianMonteCarloEngine(config, seed=args.seed)
        mc_result = mc_engine.run_multichain(db, n_chains=3, iterations=config.iterations)
        mc_result["seed"] = args.seed

    # F7 (2.10.0): the vacuous R̂/ESS convergence block was removed — report the
    # honest MC standard error + seed stability instead.
    mc_se = mc_result.get("mc_standard_error") or {}
    if mc_se:
        worst = max((v.get("median_se_pp", 0.0) for v in mc_se.values()), default=0.0)
        print(f"      MC standard error (terminal-year median): worst-category {worst:.4f} pp "
              f"across {len(mc_se)} categories")
    ss = mc_result.get("seed_stability") or {}
    if ss:
        print(f"      Seed stability: {ss.get('spread_pp', 0.0):.4f} pp across "
              f"{ss.get('n_chains', '?')} chains (pooled {ss.get('pooled_iterations', '?')} iters)")

    allocation = None  # optimizer removed (D4, June 2026)

    # ── Step 5: Path analysis & triggers ────────────────────────────
    print("[4/5] Analyzing paths and triggers...")
    path_analyzer = PathAnalyzer(config)
    triggers = path_analyzer.generate_default_triggers(mc_result["shift_matrix"])

    # Evaluate triggers
    alerts = []
    for cat, data in mc_result["shift_matrix"].items():
        cat_alerts = path_analyzer.evaluate_triggers(cat, data.get("path", {}))
        alerts.extend(cat_alerts)

    if alerts:
        print(f"\n  ⚠ {len(alerts)} EARLY-WARNING TRIGGERS FIRED:")
        for a in alerts[:5]:
            print(f"    {a.message}")

    # ── Write output ────────────────────────────────────────────────
    print(f"[5/5] Writing Shift Matrix to {args.output}...")
    writer = ShiftMatrixWriter(config)
    writer.write(
        args.output,
        mc_result,
        allocation=allocation,
        metadata={
            "model_version": mc_result.get("model_version", "unknown"),
            "engine_name": mc_result.get("engine_name", "unknown"),
            "seed": mc_result.get("seed"),
        }
    )

    # Audit — L1 (July 2026 review): this call passed 2 args to a 3-arg
    # method and TypeError'd at the end of every CLI run.
    audit.log_simulation_run("cli", config.iterations,
                             mc_result.get("model_type", "bayesian_copula"))
    audit.save_snapshot(config.to_json(), f"Run {datetime.now().strftime('%Y-%m-%d %H:%M')}")

    # ── Summary ─────────────────────────────────────────────────────
    print(f"\n{'═' * 60}")
    print("  PRISM SIMULATION COMPLETE")
    print(f"{'═' * 60}")
    print(f"  Mode:       {mc_result.get('model_type', 'bayesian_mc')}")
    print(f"  Iterations: {mc_result.get('iterations', 1):,}")
    print(f"  Output:     {args.output}")
    print()

    # Top-level summary — terminal year from config (L15: no hardcoded 2030)
    sm = mc_result["shift_matrix"]
    terminal_year = config.path_years[-1]
    print(f"  Category Shifts ({terminal_year} median):")
    for cat in config.category_names:
        cat_data = sm.get(cat, {})
        path = cat_data.get("path", {})
        final = path.get(terminal_year, {})
        median = final.get("median", 0.0) if isinstance(final, dict) else final
        bar = "█" * int(abs(median) * 200)
        sign = "▲" if median > 0 else "▼" if median < 0 else "─"
        print(f"    {cat:20s} {sign} {median:+.2%}  {bar}")

    print(f"\n  All outputs contain relative % shifts.\n")


def _launch_api_server(args):
    """Launch the local FastAPI backend for development (uvicorn on :8000).

    The frontend is the Next.js app (`npm run dev`, :3000); this only serves
    the read-only data plane the dashboard fetches from.
    """
    try:
        import uvicorn
        from pulse.api.app import create_app

        app = create_app(args)
        print("  Launching PRISM local API (FastAPI)...")
        print("  API:       http://localhost:8000")
        print("  Frontend:  run `npm run dev` (Next.js on :3000)")
        print("  Press Ctrl+C to stop.\n")
        uvicorn.run(app, host="0.0.0.0", port=8000)
    except ImportError:
        print("  The local API requires FastAPI + uvicorn.")
        print("  Install: pip install -r requirements-dev.txt")
        sys.exit(1)


if __name__ == "__main__":
    main()
