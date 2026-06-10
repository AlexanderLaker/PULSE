"""v2_h2_overlap_vs_rho.py — H2: do within-force overlap dampening (deterministic) and
within-force rho (stochastic) discount the same co-movement twice?
Design: 2-trend controlled engine runs; isolate effect of each mechanism on mean and spread.
Found: see v2_h2_overlap_vs_rho_out.txt."""
import sys, numpy as np
sys.dont_write_bytecode = True; sys.path.insert(0, sys.argv[1])
from pulse.config import ModelConfig, CATEGORIES
from pulse.ingestion.models import Trend, TrendDatabase
from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine

def mk_trend(i):
    return Trend(id=f"t{i}", force="Consumer", name=f"T{i}", direction="Contraction",
                 probability=4, gp1_pct_affected=0.20, peak_year=2030, diffusion_curve="linear",
                 category_exposure={"Hair: Color": 5}, vc_exposure={}, regional_exposure={})

db = TrendDatabase(trends=[mk_trend(1), mk_trend(2)], categories=list(CATEGORIES))
base = ModelConfig(force_weights={f: (1.0 if f=="Consumer" else 0.0) for f in
        ["Consumer","Customer","Technology","Government","Environmental","Competitive"]},
        per_force_attenuation={f:1.0 for f in ["Consumer","Customer","Technology","Government","Environmental","Competitive"]})

def run(overlap, rho, seed=42, iters=40000):
    cfg = base.copy_with(within_force_overlap={"Consumer": overlap, "Customer":0,"Technology":0,"Government":0,"Environmental":0,"Competitive":0},
                         within_force_rho=rho)
    r = BayesianMonteCarloEngine(cfg, seed=seed).run(db, iterations=iters)
    s = r["raw_samples"][:, list(CATEGORIES).index("Hair: Color"), -1]
    return s.mean(), s.std(), np.percentile(s,5), np.percentile(s,95)

print("2 identical Contraction trends (p=4, gp1=0.2, exp=5) in ONE force; force weight=1, attenuation=1")
print(f"{'config':38s} {'mean':>8s} {'std':>7s} {'p5':>8s} {'p95':>8s}")
for ov, rho, label in [(0.0,0.0,"no overlap, rho=0 (independent)"),
                       (0.3,0.0,"overlap=0.3, rho=0 (determ. only)"),
                       (0.0,0.6,"overlap=0,  rho=0.6 (stoch. only)"),
                       (0.3,0.6,"overlap=0.3, rho=0.6 (both)"),
                       (1.0,0.0,"overlap=1.0, rho=0   (max determ.)")]:
    m,s,p5,p95 = run(ov,rho)
    print(f"{label:38s} {m:+8.4f} {s:7.4f} {p5:+8.4f} {p95:+8.4f}")

# theoretical deterministic expectation: E[score]=(4/6)*0.2 per trend; sum=2*0.1333*... exposure 5/5, mat(2030 linear from 2025 peak2030)=1.0
# with overlap o: dampen = 1 - o*(1/2) ; mean shift = -(dampened sum)  [single force, w=1, att=1, product = 1+x]
exp_nodamp = -(2*(4/6)*0.2)
print(f"\nanalytic mean (no dampening): {exp_nodamp:+.4f}; with overlap 0.3: {exp_nodamp*(1-0.15):+.4f}; with 1.0: {exp_nodamp*0.5:+.4f}")
print("=> overlap moves the MEAN, rho moves the SPREAD — verify in table above.")

# Cross-check: does MC mean equal deterministic normalized_score aggregation? (full 99-trend run)
from pulse.seed_trends import get_report_trends
db99 = TrendDatabase(trends=get_report_trends(), categories=list(CATEGORIES))
cfg_def = ModelConfig()
r = BayesianMonteCarloEngine(cfg_def, seed=42).run(db99, iterations=20000)
import collections
FORCES = ["Consumer","Customer","Technology","Government","Environmental","Competitive"]
def deterministic_shift(cat, year=2035):
    from pulse.config import FORCE_MATERIALIZATION_OVERRIDES, compute_materialization_schedule
    fsum = {f:0.0 for f in FORCES}; n_act = {f:0 for f in FORCES}
    for t in db99.trends:
        e = t.category_exposure.get(cat,0)
        if e>0:
            pk = getattr(t,'peak_year',0) or 0; dc = getattr(t,'diffusion_curve','') or ''
            if pk>0 and dc: mat = compute_materialization_schedule(pk, dc, cfg_def.path_years, cfg_def.base_year).get(year,1.0)
            else:
                fm = FORCE_MATERIALIZATION_OVERRIDES.get(t.force, {})
                mat = fm.get(year, cfg_def.materialization.get(year,1.0))
            fsum[t.force] += t.normalized_score*(min(e,5)/5)*mat; n_act[t.force]+=1
    prod = 1.0
    for f in FORCES:
        wf = cfg_def.within_force_overlap.get(f,0)
        damp = 1 - wf*(n_act[f]-1)/n_act[f] if n_act[f]>1 and wf>0 else 1.0
        prod *= (1 + cfg_def.force_weights[f]*cfg_def.per_force_attenuation[f]*fsum[f]*damp)
    return prod-1
print("\nDeterministic replica vs MC mean (2035):")
for c in ["Hair: Color","LHC: ADW","LHC: HSC"]:
    det = deterministic_shift(c)
    mc_mean = r["shift_matrix"][c]["path"][2035]["mean"]
    print(f"  {c:14s} deterministic={det:+.4f}  MC mean={mc_mean:+.4f}  delta={mc_mean-det:+.5f}")
