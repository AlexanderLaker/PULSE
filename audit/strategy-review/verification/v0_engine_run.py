"""v0_engine_run.py — Pass 0 evidence: run the real engine end-to-end (seed 42, defaults).
Tests: does the pipeline run, what magnitudes come out, do decompositions reconcile.
Found: see v0_engine_run_out.txt."""
import sys, os
sys.dont_write_bytecode = True
sys.path.insert(0, sys.argv[1])
import numpy as np
from pulse.config import ModelConfig, CATEGORIES
from pulse.ingestion.models import TrendDatabase
from pulse.seed_trends import get_report_trends
from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine

cfg = ModelConfig()
db = TrendDatabase(trends=get_report_trends(), categories=list(CATEGORIES))
eng = BayesianMonteCarloEngine(cfg, seed=42)
res = eng.run(db, iterations=10000)
sm = res["shift_matrix"]
print("MODEL", res["model_version"], res["engine_name"], "seed", res["seed"], "iters", res["iterations"])
print("integrity_events:", res["integrity_events"])
print(f"{'category':18s} {'2030 p10':>9s} {'2030 med':>9s} {'2030 p90':>9s} {'2035 med':>9s}")
for c in CATEGORIES:
    p30 = sm[c]["path"][2030]; p35 = sm[c]["path"][2035]
    print(f"{c:18s} {p30['p10']:+9.4f} {p30['median']:+9.4f} {p30['p90']:+9.4f} {p35['median']:+9.4f}")
g = res["totals"]["grand"]
print("grand totals (sum of cat medians):", {y: round(v,4) for y,v in list(g.items())[::3]})
# reconciliation check: force decomp sums to median
y, c = 2030, "Hair: Color"
fd = res["decompositions"]["force"][y][c]
print("force decomp sum vs median:", round(sum(fd.values()),6), "vs", round(sm[c]["path"][y]["median"],6))
# convergence block sample
print("convergence (Hair: Color):", res["convergence"]["Hair: Color"])
# raw sample stats at 2035, portfolio level
raw = res["raw_samples"]; port = raw[:,:,-1].mean(axis=1)
print(f"portfolio(equal-wt mean) 2035: mean={port.mean():+.4f} p5={np.percentile(port,5):+.4f} p95={np.percentile(port,95):+.4f}")
