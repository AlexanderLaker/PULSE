"""v5_naive_baseline.py — H12: does the MC machinery change decisions vs a deterministic
scorecard on the same inputs? Compares 3 layers: (A) full MC median, (B) deterministic
replica (attenuation+overlap+compounding, no MC), (C) Excel-grade scorecard
(sum of score x exposure x materialization, nothing else). Found: v5_naive_baseline_out.txt."""
import sys, numpy as np
sys.dont_write_bytecode=True; sys.path.insert(0, sys.argv[1])
from scipy.stats import spearmanr
from pulse.config import ModelConfig, CATEGORIES, FORCE_MATERIALIZATION_OVERRIDES, compute_materialization_schedule
from pulse.ingestion.models import TrendDatabase
from pulse.seed_trends import get_report_trends
from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine

cfg=ModelConfig(); trends=get_report_trends()
db=TrendDatabase(trends=trends, categories=list(CATEGORIES))
FORCES=["Consumer","Customer","Technology","Government","Environmental","Competitive"]
YEAR=2030

r=BayesianMonteCarloEngine(cfg, seed=42).run(db, iterations=20000)
A={c: r["shift_matrix"][c]["path"][YEAR]["median"] for c in CATEGORIES}

def mat_of(t):
    pk=getattr(t,'peak_year',0) or 0; dc=getattr(t,'diffusion_curve','') or ''
    if pk>0 and dc: return compute_materialization_schedule(pk,dc,cfg.path_years,cfg.base_year).get(YEAR,1.0)
    return FORCE_MATERIALIZATION_OVERRIDES.get(t.force,{}).get(YEAR, cfg.materialization.get(YEAR,1.0))

B={}
for c in CATEGORIES:
    fsum={f:0.0 for f in FORCES}; n_act={f:0 for f in FORCES}
    for t in trends:
        e=t.category_exposure.get(c,0)
        if e>0: fsum[t.force]+=t.normalized_score*(min(e,5)/5)*mat_of(t); n_act[t.force]+=1
    prod=1.0
    for f in FORCES:
        wfo=cfg.within_force_overlap.get(f,0)
        damp=1-wfo*(n_act[f]-1)/n_act[f] if n_act[f]>1 and wfo>0 else 1.0
        prod*=(1+cfg.force_weights[f]*cfg.per_force_attenuation[f]*fsum[f]*damp)
    B[c]=prod-1

C={c: sum(t.normalized_score*(min(t.category_exposure.get(c,0),5)/5)*mat_of(t) for t in trends
          if t.category_exposure.get(c,0)>0) for c in CATEGORIES}

rank=lambda d: [c for c,_ in sorted(d.items(), key=lambda kv: kv[1])]
print(f"{'category':14s} {'A: MC median':>13s} {'B: determ.':>11s} {'C: Excel raw':>13s}")
for c in CATEGORIES: print(f"{c:14s} {A[c]:+13.4f} {B[c]:+11.4f} {C[c]:+13.4f}")
sAB=spearmanr(list(A.values()), list(B.values())).statistic
sAC=spearmanr(list(A.values()), list(C.values())).statistic
print(f"\nSpearman rank corr: MC vs deterministic replica = {sAB:.4f}; MC vs Excel-raw = {sAC:.4f}")
print("rank (worst→best):")
print("  A MC    :", " > ".join(rank(A)))
print("  B determ:", " > ".join(rank(B)))
print("  C excel :", " > ".join(rank(C)))

# What the MC uniquely adds: do uncertainty bands overlap enough to flip adjacent ranks?
print("\nBand-overlap (p10..p90) between adjacent-ranked categories at 2030 (MC):")
sm=r["shift_matrix"]; ranked=rank(A)
for i in range(len(ranked)-1):
    c1,c2=ranked[i],ranked[i+1]
    p1=sm[c1]["path"][YEAR]; p2=sm[c2]["path"][YEAR]
    overlap = min(p1["p90"],p2["p90"]) - max(p1["p10"],p2["p10"])
    # P(c1 worse than c2) from raw samples
    i1,i2=list(CATEGORIES).index(c1), list(CATEGORIES).index(c2)
    yidx=cfg.path_years.index(YEAR)
    pr = float((r["raw_samples"][:,i1,yidx] < r["raw_samples"][:,i2,yidx]).mean())
    print(f"  {c1:14s} vs {c2:14s}: band overlap={overlap:+.4f}  P(worse)={pr:.2f}")
