"""v3_sobol_defects.py — H1: Sobol endpoint validity. Three checks:
(1) endpoint objective reads a non-existent key -> always 0; (2) SALib on the resulting
constant Y -> degenerate indices; (3) even when fixed, MC noise + in-wrapper weight
normalization distort indices. Found: v3_sobol_defects_out.txt."""
import sys, warnings, numpy as np
sys.dont_write_bytecode = True; sys.path.insert(0, sys.argv[1])
warnings.filterwarnings("ignore")
from pulse.config import ModelConfig, CATEGORIES
from pulse.ingestion.models import TrendDatabase
from pulse.seed_trends import get_report_trends
from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine

cfg = ModelConfig(); db = TrendDatabase(trends=get_report_trends(), categories=list(CATEGORIES))
res = BayesianMonteCarloEngine(cfg, seed=42).run(db, iterations=2000)
sm = res["shift_matrix"]

# (1) replicate the endpoint's accessor (pulse/api/routes/analytics.py:198-201)
total_shift = sum(sm.get(cat, {}).get(2030, {}).get(0.5, 0) for cat in sm.keys())
print(f"(1) endpoint accessor sm[cat][2030][0.5] -> total_shift = {total_shift}  (true sum of 2030 medians = "
      f"{sum(sm[c]['path'][2030]['median'] for c in sm):+.4f})")

# (2) SALib with constant Y (what the endpoint produces)
from SALib.sample import saltelli
from SALib.analyze import sobol
problem = {"num_vars": 6, "names": list("ABCDEF"), "bounds": [(0.05,0.40)]*6}
X = saltelli.sample(problem, 64, calc_second_order=True)
Y = np.zeros(X.shape[0])
try:
    Si = sobol.analyze(problem, Y, calc_second_order=True)
    print(f"(2) SALib on constant Y: S1 = {np.round(Si['S1'],4)}  (nan/zero -> meaningless output served as 'sensitivity')")
except Exception as e:
    print(f"(2) SALib on constant Y raises: {type(e).__name__}: {e}")

# (3) normalization distortion: deterministic surrogate of the engine mean
FORCES = ["Consumer","Customer","Technology","Government","Environmental","Competitive"]
from pulse.config import FORCE_MATERIALIZATION_OVERRIDES, compute_materialization_schedule
trends = db.trends
def det_portfolio(force_weights: dict, year=2030):
    tot = 0.0
    for c in CATEGORIES:
        fsum = {f:0.0 for f in FORCES}; n_act={f:0 for f in FORCES}
        for t in trends:
            e=t.category_exposure.get(c,0)
            if e>0:
                pk=getattr(t,'peak_year',0) or 0; dc=getattr(t,'diffusion_curve','') or ''
                mat = (compute_materialization_schedule(pk,dc,cfg.path_years,cfg.base_year).get(year,1.0)
                       if pk>0 and dc else FORCE_MATERIALIZATION_OVERRIDES.get(t.force,{}).get(year, cfg.materialization.get(year,1.0)))
                fsum[t.force]+=t.normalized_score*(min(e,5)/5)*mat; n_act[t.force]+=1
        prod=1.0
        for f in FORCES:
            wfo=cfg.within_force_overlap.get(f,0)
            damp=1-wfo*(n_act[f]-1)/n_act[f] if n_act[f]>1 and wfo>0 else 1.0
            prod*=(1+force_weights.get(f,1/6)*cfg.per_force_attenuation[f]*fsum[f]*damp)
        tot += prod-1
    return tot

# correct Sobol on the deterministic surrogate WITH the endpoint's normalize-inside trick
def wrapped(params, normalize):
    w = {FORCES[k]: params[k] for k in range(6)}
    if normalize:
        s = sum(w.values()); w = {k: v/s for k,v in w.items()}
    return det_portfolio(w)
for normalize in (True, False):
    Y2 = np.array([wrapped(x, normalize) for x in X])
    Si2 = sobol.analyze(problem, Y2, calc_second_order=False)
    tag = "normalized-inside (endpoint behavior)" if normalize else "raw weights (proper)"
    print(f"(3) Sobol S1 on deterministic surrogate [{tag}]:")
    for f, s1, st_ in zip(FORCES, Si2["S1"], Si2["ST"]):
        print(f"    {f:14s} S1={s1:+.3f} ST={st_:+.3f}")
    print(f"    sum S1 = {Si2['S1'].sum():+.3f}")
print("NOTE: with normalization inside the wrapper, indices mix every force's effect into every");
print("input and S1 sum collapses; copula dependence is additionally ignored in trend-mode (analyzed in report).")
