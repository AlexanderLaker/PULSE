"""PRISM CLI — Main entry point for the Profit Pool Simulation Engine.

Usage:
    python -m pulse --input v12.xlsx --output shift_matrix.xlsx
    python -m pulse --input v12.xlsx --mode deterministic
    python -m pulse --input v12.xlsx --serve
    python -m pulse --validate v12.xlsx
"""

import argparse
import json
import logging
import sys
from pathlib import Path
from datetime import datetime

from pulse import __version__
from pulse.config import ModelConfig
from pulse.ingestion.excel_reader import ExcelReader
from pulse.simulation.deterministic import DeterministicEngine
from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine
from pulse.simulation.sensitivity import SensitivityEngine
from pulse.simulation.paths import PathAnalyzer
from pulse.causal.dag import CausalDAG
from pulse.game_theory.competitive import CompetitiveResponseModel
from pulse.optimizer.allocation import AllocationOptimizer
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
    parser.add_argument("--input", "-i", help="Path to V12 Excel file")
    parser.add_argument("--output", "-o", help="Output path for Shift Matrix Excel",
                        default="shift_matrix.xlsx")
    parser.add_argument("--mode", choices=["bayesian", "deterministic"],
                        default="bayesian", help="Simulation mode")
    parser.add_argument("--iterations", type=int, default=None,
                        help="Number of Monte Carlo iterations")
    parser.add_argument("--no-causal", action="store_true",
                        help="Disable causal DAG propagation")
    parser.add_argument("--no-competitive", action="store_true",
                        help="Disable competitive response modeling")
    parser.add_argument("--no-allocation", action="store_true",
                        help="Disable allocation optimization")
    parser.add_argument("--risk-aversion", type=float, default=1.0,
                        help="Risk aversion for allocation optimizer (0-3)")
    parser.add_argument("--serve", action="store_true",
                        help="Launch War Room dashboard")
    parser.add_argument("--validate", action="store_true",
                        help="Validate V12 parity only")
    parser.add_argument("--sensitivity", action="store_true",
                        help="Run sensitivity analysis (tornado, breakeven)")
    parser.add_argument("--audit", action="store_true",
                        help="Show audit trail")
    parser.add_argument("--ai", choices=["claude", "azure", "ollama", "none"],
                        default="none", help="AI provider (claude=Claude API, azure=Azure OpenAI, ollama=local)")
    parser.add_argument("--export-powerbi", action="store_true",
                        help="Export flat JSON shift matrix for Power BI")
    parser.add_argument("--powerbi-path",
                        help="SharePoint/OneDrive folder for Power BI auto-push")
    parser.add_argument("--backtest", action="store_true",
                        help="Run backtesting with historical data")
    parser.add_argument("--history-dir", help="Directory containing historical V1-V11 files")
    parser.add_argument("--verbose", "-v", action="store_true")
    return parser


def main():
    parser = create_parser()
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    print(f"\n{'═' * 60}")
    print(f"  PRISM v{__version__} — Profit Pool Simulation Engine")
    print(f"  Bayesian MC · Causal DAG · Copula Dependencies")
    print(f"{'═' * 60}\n")

    # Audit trail
    audit = AuditLogger()

    if args.audit:
        print(audit.get_report())
        return

    if args.serve:
        _launch_dashboard(args)
        return

    if not args.input:
        print("ERROR: --input required. Provide path to V12 Excel file.")
        print("  Example: python -m pulse --input v12.xlsx --output shift_matrix.xlsx")
        sys.exit(1)

    # ── Step 1: Ingest ──────────────────────────────────────────────
    print(f"[1/6] Ingesting {Path(args.input).name}...")
    reader = ExcelReader(args.input)
    db = reader.read()
    print(f"      {db.trend_count} trends, {len(db.categories)} categories, {len(db.forces)} forces")

    # ── Step 2: Configure ───────────────────────────────────────────
    config = ModelConfig()
    if db.categories:
        config.category_names = db.categories
    if args.iterations:
        config.iterations = args.iterations

    # ── Step 3: Causal DAG ──────────────────────────────────────────
    dag = None
    if not args.no_causal:
        print("[2/6] Building Causal DAG...")
        dag = CausalDAG()
        print(f"      {len(dag.edges)} causal edges across 6 forces")
    else:
        print("[2/6] Causal DAG: DISABLED")

    # ── Step 4: Simulate ────────────────────────────────────────────
    deterministic_result = None
    mc_result = None

    # Always run deterministic for reference
    print("[3/6] Running deterministic engine (V12 parity)...")
    det_engine = DeterministicEngine(config)
    deterministic_result = det_engine.run(db)

    if args.validate:
        print("\n  V12 PARITY VALIDATION:")
        for cat, years in deterministic_result.items():
            final = years.get(2030, 0.0)
            print(f"    {cat:20s}: {final:+.4f} ({final*100:+.2f}%)")
        return

    if args.mode == "bayesian":
        print(f"[4/6] Running Bayesian Monte Carlo ({config.iterations:,} iterations)...")
        mc_engine = BayesianMonteCarloEngine(config, dag)
        mc_result = mc_engine.run(db)

        # Convergence report
        converged = sum(1 for v in mc_result["convergence"].values() if v["converged"])
        total = len(mc_result["convergence"])
        print(f"      Convergence: {converged}/{total} categories (R̂ < 1.05)")
    else:
        print("[4/6] Deterministic mode — using V12 logic")
        mc_result = {
            "shift_matrix": {
                cat: {"path": {y: {"median": v,
                                    "p10": min(v * 0.7, v * 1.3),
                                    "p25": min(v * 0.85, v * 1.15),
                                    "p50": v,
                                    "p75": max(v * 0.85, v * 1.15),
                                    "p90": max(v * 0.7, v * 1.3),
                                    "mean": v, "std": abs(v) * 0.15}
                               for y, v in years.items()},
                       "velocity": {}}
                for cat, years in deterministic_result.items()
            },
            "convergence": {},
            "iterations": 1,
            "model_type": "deterministic",
        }

    # ── Step 5: Competitive + Optimizer ─────────────────────────────
    competitive_adj = None
    allocation = None

    if not args.no_competitive:
        print("[5/6] Computing competitive response dynamics...")
        comp_model = CompetitiveResponseModel()
        competitive_adj = comp_model.compute_all_competitive_adjustments({})

    if not args.no_allocation:
        print("[5/6] Running allocation optimizer...")
        optimizer = AllocationOptimizer(config)
        allocation = optimizer.optimize(
            mc_result["shift_matrix"],
            risk_aversion=args.risk_aversion
        )
        print(f"      Sharpe proxy: {allocation.get('sharpe_proxy', 'N/A')}")

    # ── Step 6: Path analysis & triggers ────────────────────────────
    print("[6/6] Analyzing paths and triggers...")
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
    print(f"\nWriting Shift Matrix to {args.output}...")
    writer = ShiftMatrixWriter(config)
    writer.write(
        args.output,
        mc_result,
        deterministic_result=deterministic_result,
        allocation=allocation,
        competitive_adjustments=competitive_adj,
        metadata={
            "causal_dag": "enabled" if dag else "disabled",
            "competitive": "enabled" if competitive_adj else "disabled",
            "backtesting_accuracy": config.backtesting_accuracy or "N/A (no historical data)",
        }
    )

    # ── Power BI Export ──────────────────────────────────────────
    if args.export_powerbi:
        print("\nExporting flat JSON for Power BI...")
        try:
            from pulse.excel_bridge.powerbi_export import PowerBIExporter
            exporter = PowerBIExporter(config)
            pbi_path = args.powerbi_path or str(Path(args.output).parent / "shift_matrix_powerbi.json")
            exporter.export_shift_matrix(
                mc_result=mc_result,
                output_path=pbi_path,
            )
            print(f"  Power BI JSON: {pbi_path}")
            if args.powerbi_path:
                print(f"  Auto-pushed to: {args.powerbi_path}")
        except Exception as e:
            print(f"  ⚠ Power BI export failed: {e}")

    # Audit
    audit.log_simulation_run(config.iterations, args.mode)
    audit.save_snapshot(config.to_json(), f"Run {datetime.now().strftime('%Y-%m-%d %H:%M')}")

    # ── Summary ─────────────────────────────────────────────────────
    print(f"\n{'═' * 60}")
    print("  PRISM SIMULATION COMPLETE")
    print(f"{'═' * 60}")
    print(f"  Mode:       {mc_result.get('model_type', args.mode)}")
    print(f"  Iterations: {mc_result.get('iterations', 1):,}")
    print(f"  Output:     {args.output}")
    print()

    # Top-level summary
    sm = mc_result["shift_matrix"]
    print("  Category Shifts (2030 median):")
    for cat in config.category_names:
        cat_data = sm.get(cat, {})
        path = cat_data.get("path", {})
        final = path.get(2030, {})
        median = final.get("median", 0.0) if isinstance(final, dict) else final
        bar = "█" * int(abs(median) * 200)
        sign = "▲" if median > 0 else "▼" if median < 0 else "─"
        print(f"    {cat:20s} {sign} {median:+.2%}  {bar}")

    if allocation:
        print("\n  Allocation Recommendations:")
        for cat in sorted(allocation.get("weights", {}),
                          key=lambda c: allocation["weights"][c], reverse=True)[:5]:
            w = allocation["weights"][cat]
            print(f"    {cat:20s} → {w:.1%} weight")

    print(f"\n  All outputs contain relative % shifts.\n")


def _launch_dashboard(args):
    """Launch the War Room dashboard (Phase 2)."""
    try:
        import uvicorn
        from pulse.api.app import create_app

        app = create_app(args)
        print("  Launching War Room Dashboard...")
        print("  Dashboard: http://localhost:3000")
        print("  API:       http://localhost:8000")
        print("  Press Ctrl+C to stop.\n")
        uvicorn.run(app, host="0.0.0.0", port=8000)
    except ImportError:
        print("  Dashboard requires Phase 2 dependencies (FastAPI, React).")
        print("  Install: pip install fastapi uvicorn")
        print("  Then: cd pulse/dashboard && npm install")
        sys.exit(1)


if __name__ == "__main__":
    main()
