"""v1_psd_and_copula.py — H10/H6: default correlation matrix validity, effective rho after repair,
impact on output bands; plus production (no-scipy) vs local (scipy) marginal parity.
Found: see v1_psd_and_copula_out.txt."""
import sys, numpy as np
sys.dont_write_bytecode = True; sys.path.insert(0, sys.argv[1])
from pulse.config import ModelConfig, CATEGORIES, FORCES
from pulse.ingestion.models import TrendDatabase
from pulse.seed_trends import get_report_trends
from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine

cfg = ModelConfig(); trends = get_report_trends()
db = TrendDatabase(trends=trends, categories=list(CATEGORIES))

# 1) Build R exactly as engine does, measure spectrum and effective correlations after repair
eng = BayesianMonteCarloEngine(cfg, seed=1)
R = eng._build_correlation_matrix(trends)   # includes repair
n = len(trends)
# Reconstruct the PRE-repair matrix to get lambda_min
R0 = np.eye(n)
fcm = cfg.force_correlation_matrix
for i in range(n):
    for j in range(i+1, n):
        if trends[i].force == trends[j].force: rho = cfg.within_force_rho
        else: rho = fcm.get(trends[i].force, {}).get(trends[j].force, 0.05)
        R0[i,j]=R0[j,i]=rho
lam0 = np.linalg.eigvalsh(R0)
print(f"PRE-REPAIR: lambda_min={lam0.min():.4f}, lambda_max={lam0.max():.2f}  (config rho_within=0.3)")
# effective correlations post-repair
same=[]; cross=[]
for i in range(0, n, 7):
    for j in range(i+1, n, 5):
        (same if trends[i].force==trends[j].force else cross).append(R[i,j])
print(f"POST-REPAIR effective rho: within-force mean={np.mean(same):.4f} (configured 0.30), "
      f"cross-force mean={np.mean(cross):.4f} (configured 0.05-0.30)")
shrink = np.mean(same)/0.30
print(f"=> dependence shrink factor ~{shrink:.2f}x")

# 2) Impact on bands: default (broken+repaired) vs a config that is PSD-valid by construction
#    (achieve rho_eff=0.30 within-force honestly: set cross-force = single residual 0.05 via empty fcm,
#    which yields a near-block-diagonal matrix - check PSD)
cfg_low_cross = cfg.copy_with(force_correlation_matrix={})
R1 = np.eye(n)
for i in range(n):
    for j in range(i+1, n):
        rho = 0.3 if trends[i].force==trends[j].force else 0.05
        R1[i,j]=R1[j,i]=rho
print(f"ALT (rho=0.3 within, flat 0.05 cross): lambda_min={np.linalg.eigvalsh(R1).min():.4f}")

def band(cfgx, seed=42, iters=10000):
    r = BayesianMonteCarloEngine(cfgx, seed=seed).run(db, iterations=iters)
    raw = r["raw_samples"]; port = raw[:,:,-1].mean(axis=1)
    return (np.percentile(port,5), np.percentile(port,50), np.percentile(port,95),
            r["integrity_events"])

p5,p50,p95,ev = band(cfg)
print(f"DEFAULT (repaired):   portfolio2035 p5={p5:+.4f} p50={p50:+.4f} p95={p95:+.4f} width={p95-p5:.4f} events={[e['type'] for e in ev]}")
p5b,p50b,p95b,evb = band(cfg_low_cross)
print(f"VALID rho=0.3 matrix: portfolio2035 p5={p5b:+.4f} p50={p50b:+.4f} p95={p95b:+.4f} width={p95b-p5b:.4f} events={[e['type'] for e in evb]}")
print(f"=> band width understated by repair: {(p95b-p5b)/(p95-p5):.2f}x")

# 3) df sensitivity (tail parameter)
for df in (3, 8, 30):
    c = cfg_low_cross.copy_with(t_copula_df=df)
    a5,a50,a95,_ = band(c)
    print(f"df={df:>2}: p5={a5:+.4f} p50={a50:+.4f} p95={a95:+.4f} width={a95-a5:.4f}")

# 4) Production parity: scipy vs no-scipy fallback marginals
import pulse.simulation._scipy_compat as sc
from scipy import stats as st
qs = np.array([0.01,0.05,0.25,0.5,0.75,0.95,0.99])
print("\nBeta PPF parity (a=5,b=1  i.e. probability=5):")
true = st.beta.ppf(qs,5,1)
mu, var = 5/6, (5*1)/((6**2)*7); std=var**0.5
approx = np.clip(mu + std*sc._norm_ppf(qs), 0.001, 0.999)
for q,t,a in zip(qs,true,approx): print(f"  q={q:.2f}: scipy={t:.4f} prod_fallback={a:.4f} err={a-t:+.4f}")
print("t CDF parity (df=8) at x=-4..-1:")
for x in (-4,-3,-2,-1):
    t_true = st.t.cdf(x, df=8); t_apx = sc._norm_cdf(x*(1-1/(4*8)))
    print(f"  x={x}: scipy={t_true:.5f} prod_fallback={t_apx:.5f} ratio={t_apx/t_true:.2f}")

# 5) Full-run parity: monkeypatch HAS_SCIPY=False
import pulse.simulation.bayesian_mc as bmc
r_local = BayesianMonteCarloEngine(cfg, seed=42).run(db, iterations=10000)
sc.HAS_SCIPY = False
r_prod = BayesianMonteCarloEngine(cfg, seed=42).run(db, iterations=10000)
sc.HAS_SCIPY = True
c = "Hair: Color"
ml = r_local["shift_matrix"][c]["path"][2030]; mp = r_prod["shift_matrix"][c]["path"][2030]
print(f"\nSAME SEED, Hair:Color 2030 — local(scipy): med={ml['median']:+.4f} p10={ml['p10']:+.4f} p90={ml['p90']:+.4f}")
print(f"                              prod(fallback): med={mp['median']:+.4f} p10={mp['p10']:+.4f} p90={mp['p90']:+.4f}")
dmed = [abs(r_local['shift_matrix'][cc]['path'][2030]['median']-r_prod['shift_matrix'][cc]['path'][2030]['median']) for cc in CATEGORIES]
print(f"max |median delta| across categories: {max(dmed):.4f}; mean: {np.mean(dmed):.4f}")
