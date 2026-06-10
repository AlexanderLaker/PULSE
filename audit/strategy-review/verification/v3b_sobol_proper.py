"""v3b_sobol_proper.py — H1 follow-up: Sobol at PRISM's own default n_samples=1024 on the
deterministic surrogate; shows (a) what a FIXED endpoint would report, (b) that indices on
weights reflect force-sum magnitudes (knob sensitivity), not real-world uncertainty.
Found: v3b_sobol_proper_out.txt."""
import sys, warnings, numpy as np
sys.dont_write_bytecode = True; sys.path.insert(0, sys.argv[1]); warnings.filterwarnings("ignore")
from pulse.config import ModelConfig, CATEGORIES, FORCE_MATERIALIZATION_OVERRIDES, compute_materialization_schedule
from pulse.ingestion.models import TrendDatabase
from pulse.seed_trends import get_report_trends
from SALib.sample import saltelli
from SALib.analyze import sobol
cfg = ModelConfig(); trends = get_report_trends()
FORCES = ["Consumer","Customer","Technology","Government","Environmental","Competitive"]
def det_portfolio(force_weights, year=2030):
    tot=0.0
    for c in CATEGORIES:
        fsum={f:0.0 for f in FORCES}; n_act={f:0 for f in FORCES}
        for t in trends:
            e=t.category_exposure.get(c,0)
            if e>0:
                pk=getattr(t,'peak_year',0) or 0; dc=getattr(t,'diffusion_curve','') or ''
                mat=(compute_materialization_schedule(pk,dc,cfg.path_years,cfg.base_year).get(year,1.0)
                     if pk>0 and dc else FORCE_MATERIALIZATION_OVERRIDES.get(t.force,{}).get(year, cfg.materialization.get(year,1.0)))
                fsum[t.force]+=t.normalized_score*(min(e,5)/5)*mat; n_act[t.force]+=1
        prod=1.0
        for f in FORCES:
            wfo=cfg.within_force_overlap.get(f,0)
            damp=1-wfo*(n_act[f]-1)/n_act[f] if n_act[f]>1 and wfo>0 else 1.0
            prod*=(1+force_weights.get(f,1/6)*cfg.per_force_attenuation[f]*fsum[f]*damp)
        tot+=prod-1
    return tot
# force-sum magnitudes (the trivial answer Sobol-on-weights must mirror)
mag={f:0.0 for f in FORCES}
for c in CATEGORIES:
    for t in trends:
        e=t.category_exposure.get(c,0)
        if e>0: mag[t.force]+=abs(t.normalized_score)*(min(e,5)/5)
print("aggregate |signal| per force (the trivial driver of weight-sensitivity):")
print("  " + ", ".join(f"{f}={v:.2f}" for f,v in sorted(mag.items(), key=lambda kv:-kv[1])))
problem={"num_vars":6,"names":FORCES,"bounds":[(0.05,0.40)]*6}
X=saltelli.sample(problem,1024,calc_second_order=False)
Y=np.array([det_portfolio({FORCES[k]:x[k] for k in range(6)}) for x in X])
Si=sobol.analyze(problem,Y,calc_second_order=False)
print(f"\nSobol (n=1024 base, {len(Y)} evals) on raw weights, deterministic surrogate:")
order=np.argsort(-Si["S1"])
for i in order:
    print(f"  {FORCES[i]:14s} S1={Si['S1'][i]:+.3f}±{Si['S1_conf'][i]:.3f}  ST={Si['ST'][i]:+.3f}")
print(f"  sum S1={Si['S1'].sum():.3f} (≈1 => near-additive model; interactions negligible)")
r=np.corrcoef([mag[f] for f in FORCES],[Si["S1"][i] for i in range(6)])[0,1]
print(f"corr(aggregate |signal| per force, S1) = {r:.3f}  => weight-Sobol ≈ force-sum magnitude ranking")
