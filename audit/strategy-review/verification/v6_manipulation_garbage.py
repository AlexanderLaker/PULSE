"""v6_manipulation_garbage.py — H7 (manipulation surface), garbage-in laundering, adversarial params.
Found: v6_manipulation_garbage_out.txt."""
import sys, numpy as np, itertools
sys.dont_write_bytecode=True; sys.path.insert(0, sys.argv[1])
from pulse.config import ModelConfig, CATEGORIES, FORCE_MATERIALIZATION_OVERRIDES, compute_materialization_schedule
from pulse.ingestion.models import TrendDatabase
from pulse.seed_trends import get_report_trends
from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine
FORCES=["Consumer","Customer","Technology","Government","Environmental","Competitive"]
cfg=ModelConfig(); trends=get_report_trends(); YEAR=2030

def det_shift(c, fw, att, wfo_scale=1.0):
    fsum={f:0.0 for f in FORCES}; n_act={f:0 for f in FORCES}
    for t in trends:
        e=t.category_exposure.get(c,0)
        if e>0:
            pk=getattr(t,'peak_year',0) or 0; dc=getattr(t,'diffusion_curve','') or ''
            mat=(compute_materialization_schedule(pk,dc,cfg.path_years,cfg.base_year).get(YEAR,1.0)
                 if pk>0 and dc else FORCE_MATERIALIZATION_OVERRIDES.get(t.force,{}).get(YEAR, cfg.materialization.get(YEAR,1.0)))
            fsum[t.force]+=t.normalized_score*(min(e,5)/5)*mat; n_act[t.force]+=1
    prod=1.0
    for f in FORCES:
        wfo=cfg.within_force_overlap.get(f,0)*wfo_scale
        damp=1-wfo*(n_act[f]-1)/n_act[f] if n_act[f]>1 and wfo>0 else 1.0
        prod*=(1+fw[f]*att[f]*fsum[f]*damp)
    return prod-1

att_def=dict(cfg.per_force_attenuation)
fw_def=dict(cfg.force_weights)
base={c:det_shift(c,fw_def,att_def) for c in CATEGORIES}

# (1) Manipulation: legal extreme weight configs (sum=1, >=0 — validator-compliant) + attenuation in [0,1]
target="Hair: Color"
print(f"(1) MANIPULATION SURFACE — target {target} @2030 (default {base[target]:+.4f})")
results=[]
for w_combo in itertools.product([0.0, 0.5, 1.0], repeat=6):
    s=sum(w_combo)
    if s==0: continue
    fw={f:w/s for f,w in zip(FORCES,w_combo)}
    for att_scale in (0.0, 1.0):  # attenuation each force in [0,1]: use 0 or 1 extremes selectively
        att={f:(1.0 if att_scale else 0.05) for f in FORCES}
        results.append((det_shift(target,fw,att), fw, att_scale))
vals=[v for v,_,_ in results]
best=max(results,key=lambda x:x[0]); worst=min(results,key=lambda x:x[0])
print(f"  achievable range with VALIDATOR-LEGAL weights+attenuation: {min(vals):+.4f} .. {max(vals):+.4f}")
print(f"  most favourable: fw={ {f:round(w,2) for f,w in best[1].items() if w>0} }, att={'1.0' if best[2] else '0.05'} -> {best[0]:+.4f}")
print(f"  most damaging:  fw={ {f:round(w,2) for f,w in worst[1].items() if w>0} }, att={'1.0' if worst[2] else '0.05'} -> {worst[0]:+.4f}")

# (1b) Ranking flip with innocuous-looking weights: make Hair:Color look BETTER than LHC:HSC (default: Color much worse)
fw_x={"Consumer":0.40,"Customer":0.02,"Technology":0.30,"Government":0.02,"Environmental":0.16,"Competitive":0.10}
a=det_shift("Hair: Color",fw_x,att_def); b=det_shift("LHC: HSC",fw_x,att_def)
print(f"  'plausible-looking' fw {fw_x}:")
print(f"   Hair: Color {a:+.4f} vs LHC: HSC {b:+.4f}  -> flipped={a>b} (default: {base['Hair: Color']:+.4f} vs {base['LHC: HSC']:+.4f})")

# (2) GARBAGE-IN: shuffle probabilities + flip 30% of directions, run full MC — does output LOOK any less confident?
rng=np.random.default_rng(7)
import copy
trends_g=copy.deepcopy(trends)
probs=[t.probability for t in trends_g]; rng.shuffle(probs)
for t,p in zip(trends_g,probs): t.probability=p
flip_idx=rng.choice(len(trends_g), size=int(0.3*len(trends_g)), replace=False)
for k in flip_idx: trends_g[k].direction = "Expansion" if trends_g[k].direction=="Contraction" else "Contraction"
for t in trends_g: t.__post_init__()
db_g=TrendDatabase(trends=trends_g, categories=list(CATEGORIES))
db_o=TrendDatabase(trends=trends, categories=list(CATEGORIES))
r_o=BayesianMonteCarloEngine(cfg, seed=42).run(db_o, iterations=10000)
r_g=BayesianMonteCarloEngine(cfg, seed=42).run(db_g, iterations=10000)
def width(r,c): p=r["shift_matrix"][c]["path"][YEAR]; return p["p90"]-p["p10"]
c="Hair: Color"
po=r_o["shift_matrix"][c]["path"][YEAR]; pg=r_g["shift_matrix"][c]["path"][YEAR]
print(f"\n(2) GARBAGE-IN (shuffled probs, 30% directions flipped) — {c} @2030:")
print(f"  real data:    med={po['median']:+.4f}  band width={width(r_o,c):.4f}")
print(f"  garbage data: med={pg['median']:+.4f}  band width={width(r_g,c):.4f}")
print(f"  integrity_events on garbage run: {[e['type'] for e in r_g['integrity_events']]}")
print("  -> output formats identically 'confident'; nothing flags the corrupted inputs")

# (3) ADVERSARIAL LEGAL PARAMS: rho=0.9, df=2, attenuation=1.0, overlap=0
cfg_a=cfg.copy_with(within_force_rho=0.9, t_copula_df=2,
                    per_force_attenuation={f:1.0 for f in FORCES},
                    within_force_overlap={f:0.0 for f in FORCES})
r_a=BayesianMonteCarloEngine(cfg_a, seed=42).run(db_o, iterations=10000)
pa=r_a["shift_matrix"][c]["path"][YEAR]
print(f"\n(3) ADVERSARIAL (rho=.9, df=2, att=1.0, overlap=0) — {c} @2030: med={pa['median']:+.4f} "
      f"p10={pa['p10']:+.4f} p90={pa['p90']:+.4f}")
print(f"  vs default med={po['median']:+.4f} -> headline x{pa['median']/po['median']:.1f}")
print(f"  integrity_events: {[e['type'] for e in r_a['integrity_events']]}")
g=lambda rr: sum(rr['shift_matrix'][cc]['path'][YEAR]['median'] for cc in CATEGORIES)
print(f"  grand 2030 total: default {g(r_o):+.3f} vs adversarial {g(r_a):+.3f}")
