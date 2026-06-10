"""v4_cvar_quality.py — H10: CVaR estimator quality (SE, iteration sensitivity) and the
endpoint's mean-over-years aggregation vs terminal-year. Found: v4_cvar_quality_out.txt."""
import sys, numpy as np
sys.dont_write_bytecode=True; sys.path.insert(0, sys.argv[1])
from pulse.config import ModelConfig, CATEGORIES
from pulse.ingestion.models import TrendDatabase
from pulse.seed_trends import get_report_trends
from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine
from pulse.simulation.cvar import CVaRAnalyzer

cfg=ModelConfig(); db=TrendDatabase(trends=get_report_trends(), categories=list(CATEGORIES))
an=CVaRAnalyzer(0.95); cat="LHC: ADW"; ci=list(CATEGORIES).index(cat)

# (a) CVaR across iteration counts + bootstrap SE
print(f"{'iters':>7s} {'CVaR(term yr)':>14s} {'bootstrap SE':>13s}")
for iters in (1000, 10000, 50000):
    r=BayesianMonteCarloEngine(cfg, seed=42).run(db, iterations=iters)
    s=r["raw_samples"][:,ci,-1]
    cv=an.compute_cvar(s)["cvar"]
    boots=[an.compute_cvar(np.random.default_rng(k).choice(s,len(s),replace=True))["cvar"] for k in range(200)]
    print(f"{iters:7d} {cv:+14.4f} {np.std(boots):13.5f}")

# (b) endpoint aggregation: mean-over-years vs terminal year (analytics.py:96-99)
r=BayesianMonteCarloEngine(cfg, seed=42).run(db, iterations=10000)
raw=r["raw_samples"]
print(f"\n{'category':14s} {'CVaR mean-yrs (endpoint)':>25s} {'CVaR 2035 (true tail)':>22s} {'understated by':>15s}")
for c in ["Hair: Color","LHC: ADW","LHC: HSC"]:
    k=list(CATEGORIES).index(c)
    cv_ep=an.compute_cvar(raw[:,k,:].mean(axis=1))["cvar"]
    cv_term=an.compute_cvar(raw[:,k,-1])["cvar"]
    print(f"{c:14s} {cv_ep:+25.4f} {cv_term:+22.4f} {abs(cv_term)-abs(cv_ep):+15.4f}")

# (c) df sensitivity of CVaR (tail param) at terminal year, portfolio
for df in (3,8,30):
    rr=BayesianMonteCarloEngine(cfg.copy_with(t_copula_df=df), seed=42).run(db, iterations=10000)
    port=rr["raw_samples"][:,:,-1].mean(axis=1)
    print(f"df={df:>2}: portfolio CVaR5% = {an.compute_cvar(port)['cvar']:+.4f}")

# (d) VaR index convention at small n
s=np.sort(np.arange(1,1001)/1000.0)  # uniform grid
res=an.compute_cvar(s)
print(f"\nindex convention check (n=1000, alpha=.95): var_index={int(0.05*1000)} -> VaR={res['var']:.3f} "
      f"(P5 would be 0.050); n_tail={res['n_tail_samples']}")
