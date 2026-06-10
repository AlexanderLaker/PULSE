"""Independent numerical verification of the 8 review claims against HEAD."""
import sys, copy
import numpy as np

sys.path.insert(0, "/sessions/dazzling-sharp-goldberg/mnt/PROFIT_POOL_ENGINE")

from pulse.config import ModelConfig, FORCES, DEFAULT_FORCE_CORRELATIONS, DEFAULT_PER_FORCE_ATTENUATION
from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine
from pulse.simulation import _scipy_compat as sc
from pulse.ingestion.models import TrendDatabase
import pulse.seed_trends as st

print("=" * 72)
print("0. TREND POPULATION")
print("=" * 72)
# Build trend DB from seed data
names = [n for n in dir(st) if not n.startswith("_")]
trends = None
if hasattr(st, "get_seed_trends"):
    trends = st.get_seed_trends()
elif hasattr(st, "build_trends"):
    trends = st.build_trends()
else:
    trends = list(st.get_report_trends()) if hasattr(st, "get_report_trends") else list(st.TRENDS)

forces_count = {}
for t in trends:
    forces_count[t.force] = forces_count.get(t.force, 0) + 1
print(f"n_trends={len(trends)}  by force: {forces_count}")
missing_gp1 = [t.id for t in trends if not t.gp1_pct_affected]
print(f"trends missing gp1_pct_affected: {len(missing_gp1)}")
db = TrendDatabase(trends=trends)

print()
print("=" * 72)
print("1. CLAIM 2 — CORRELATION MATRIX PSD (old v3.5 vs current v3.6 defaults)")
print("=" * 72)
cfg = ModelConfig()

def build_R(fcm, rho, trends):
    n = len(trends)
    R = np.eye(n)
    for i in range(n):
        for j in range(i + 1, n):
            if trends[i].force == trends[j].force:
                r = rho
            else:
                r = fcm.get(trends[i].force, {}).get(trends[j].force, 0.05)
            R[i, j] = R[j, i] = r
    return R

OLD_FCM = {
    "Consumer": {"Consumer": 1.0, "Customer": 0.25, "Technology": 0.15, "Government": 0.05, "Environmental": 0.20, "Competitive": 0.20},
    "Customer": {"Consumer": 0.25, "Customer": 1.0, "Technology": 0.15, "Government": 0.20, "Environmental": 0.05, "Competitive": 0.25},
    "Technology": {"Consumer": 0.15, "Customer": 0.15, "Technology": 1.0, "Government": 0.30, "Environmental": 0.15, "Competitive": 0.25},
    "Government": {"Consumer": 0.05, "Customer": 0.20, "Technology": 0.30, "Government": 1.0, "Environmental": 0.30, "Competitive": 0.05},
    "Environmental": {"Consumer": 0.20, "Customer": 0.05, "Technology": 0.15, "Government": 0.30, "Environmental": 1.0, "Competitive": 0.05},
    "Competitive": {"Consumer": 0.20, "Customer": 0.25, "Technology": 0.25, "Government": 0.05, "Environmental": 0.05, "Competitive": 1.0},
}

for label, fcm in [("OLD v3.5 (pre-June-2026)", OLD_FCM), ("CURRENT v3.6 default", DEFAULT_FORCE_CORRELATIONS)]:
    R = build_R(fcm, cfg.within_force_rho, trends)
    lam = np.linalg.eigvalsh(R)
    lam_min = lam.min()
    print(f"{label}: shape={R.shape}, min eig = {lam_min:.4f}", "-> non-PSD, repair fires" if lam_min < 0 else "-> PSD, no repair")
    if lam_min < 0:
        shrink = 1.0 / (1.0 + abs(lam_min) + 0.01)
        print(f"   repair shrink factor = {shrink:.4f} (within-force 0.3 -> {0.3*shrink:.3f}; shrink = {1/shrink:.2f}x)")

# Does the engine's integrity log fire on current defaults?
eng = BayesianMonteCarloEngine(cfg, seed=42)
R_eng = eng._build_correlation_matrix(trends)
print(f"engine on CURRENT defaults: integrity_events = {eng._integrity_events}")
print(f"engine R within-force sample value (t0,t1 same force?) check: "
      f"forces {trends[0].force},{trends[1].force} -> R[0,1]={R_eng[0,1]:.3f}")

print()
print("=" * 72)
print("2. CLAIM 3 — SCIPY-FALLBACK ACCURACY (prod path vs scipy)")
print("=" * 72)
from scipy import stats as ss

# Force fallback implementations regardless of installed scipy
import importlib
def fallback_beta_ppf(q, a, b):
    mu = a / (a + b); var = (a * b) / ((a + b) ** 2 * (a + b + 1)); std = np.sqrt(var)
    return np.clip(mu + std * sc._norm_ppf(np.asarray(q, dtype=float)), 0.001, 0.999)

def fallback_t_cdf(x, df):
    return sc._norm_cdf(np.asarray(x, dtype=float) * (1 - 1 / (4 * df)))

# Beta(5,1) — the prior for probability=5 trends
qs = np.array([0.5, 0.9, 0.95, 0.99])
true_b = ss.beta.ppf(qs, 5, 1)
appr_b = fallback_beta_ppf(qs, 5, 1)
print("Beta(5,1) ppf   q:", qs)
print("  scipy (dev):    ", np.round(true_b, 4))
print("  fallback (prod):", np.round(appr_b, 4))
mass_at_clip = 1 - ss.norm.cdf((0.999 - 5/6) / np.sqrt(5/252))
print(f"  fraction of draws piling at 0.999 clip in prod: {mass_at_clip:.1%}")

# Beta(3,3) — the prior for probability=3 trends
true_b3 = ss.beta.ppf(qs, 3, 3); appr_b3 = fallback_beta_ppf(qs, 3, 3)
print("Beta(3,3) ppf  scipy:", np.round(true_b3, 4), " fallback:", np.round(appr_b3, 4))

# t-CDF df=8 (DEFAULT_T_COPULA_DF=8)
df = cfg.t_copula_df
for x in [-3.0, -4.0]:
    t_true = ss.t.cdf(x, df)
    t_appr = float(fallback_t_cdf(np.array([x]), df)[0])
    print(f"t_cdf({x}, df={df}): scipy={t_true:.6f}  fallback={t_appr:.6f}  tail mispricing={t_true/t_appr:.2f}x")

# Same seed, dev vs prod result divergence — run engine with both code paths
res_dev = BayesianMonteCarloEngine(cfg, seed=42).run(db, iterations=4000)
sc.HAS_SCIPY = False  # simulate Vercel
res_prod = BayesianMonteCarloEngine(cfg, seed=42).run(db, iterations=4000)
sc.HAS_SCIPY = True
ly = cfg.path_years[-1]
dev_meds = np.array([res_dev["shift_matrix"][c]["path"][ly]["median"] for c in cfg.category_names])
prod_meds = np.array([res_prod["shift_matrix"][c]["path"][ly]["median"] for c in cfg.category_names])
dev_p90 = np.array([res_dev["shift_matrix"][c]["path"][ly]["p90"] for c in cfg.category_names])
prod_p90 = np.array([res_prod["shift_matrix"][c]["path"][ly]["p90"] for c in cfg.category_names])
print(f"same seed, {ly} medians: max |dev-prod| diff = {np.abs(dev_meds-prod_meds).max():.5f} "
      f"({np.abs((dev_meds-prod_meds)/np.where(dev_meds==0,1,dev_meds)).max():.1%} rel)")
print(f"same seed, {ly} p90:     max |dev-prod| diff = {np.abs(dev_p90-prod_p90).max():.5f}")
print(f"result dict records scipy path? keys with 'scipy': "
      f"{[k for k in res_dev.keys() if 'scipy' in k.lower()]}; integrity_events={res_dev['integrity_events']}")

print()
print("=" * 72)
print("3. CLAIM 1 — FRACTIONAL vs BERNOULLI (event-mode) BANDS, same copula")
print("=" * 72)

class BernoulliEngine(BayesianMonteCarloEngine):
    """Identical copula; trend either fully materializes (w.p. prob) or not."""
    def _generate_copula_samples(self, trends, R, n_iter):
        n_trends = len(trends)
        eigvals = np.linalg.eigvalsh(R)
        if eigvals.min() < 0:
            R = R + (abs(eigvals.min()) + 0.01) * np.eye(n_trends)
            d = np.sqrt(np.diag(R)); R = R / np.outer(d, d)
        from pulse.simulation._scipy_compat import cholesky, beta_ppf, t_cdf
        df = self.config.t_copula_df
        L = cholesky(R, lower=True)
        Z = self.rng.standard_normal((n_iter, n_trends))
        Zc = Z @ L.T
        chi2 = self.rng.chisquare(df, size=(n_iter, 1))
        T = Zc * np.sqrt(df / chi2)
        U = np.clip(t_cdf(T, df=df), 0.001, 0.999)
        samples = np.zeros((n_iter, n_trends))
        V = self.rng.uniform(size=(n_iter, n_trends))  # independent event draws
        for j, trend in enumerate(trends):
            a_p, b_p = trend.probability_posterior
            prob_01 = beta_ppf(U[:, j], a_p, b_p)
            event = (V[:, j] < prob_01).astype(float)
            samples[:, j] = event * trend.gp1_pct_affected * trend.direction_sign
        return samples

N = 10000
frac = BayesianMonteCarloEngine(cfg, seed=42).run(db, iterations=N)
bern = BernoulliEngine(cfg, seed=42).run(db, iterations=N)

def portfolio(res):
    return res["raw_samples"][:, :, -1].mean(axis=1)  # equal-weight portfolio terminal shift

pf, pb = portfolio(frac), portfolio(bern)
for nm, p in [("fractional (current)", pf), ("bernoulli (event)", pb)]:
    print(f"{nm:22s} P5={np.percentile(p,5):+.4f} p10={np.percentile(p,10):+.4f} "
          f"median={np.percentile(p,50):+.4f} p90={np.percentile(p,90):+.4f} "
          f"band(p10-p90)={np.percentile(p,90)-np.percentile(p,10):.4f}")
bw_f = np.percentile(pf, 90) - np.percentile(pf, 10)
bw_b = np.percentile(pb, 90) - np.percentile(pb, 10)
print(f"band ratio bernoulli/fractional = {bw_b/bw_f:.2f}x  (claim: ~2.7x)")
cat_ratios = []
for ci, c in enumerate(cfg.category_names):
    f_ = frac["raw_samples"][:, ci, -1]; b_ = bern["raw_samples"][:, ci, -1]
    cat_ratios.append((np.percentile(b_,90)-np.percentile(b_,10)) / max(np.percentile(f_,90)-np.percentile(f_,10), 1e-12))
print(f"per-category band ratio: min={min(cat_ratios):.2f}x median={np.median(cat_ratios):.2f}x max={max(cat_ratios):.2f}x")

print()
print("=" * 72)
print("4. CLAIM 8 — R-HAT / ESS ON IID DRAWS")
print("=" * 72)
conv = frac["convergence"]
rhats = [v["r_hat"] for v in conv.values()]; esss = [v["ess"] for v in conv.values()]
print(f"single-chain: r_hat range [{min(rhats):.4f}, {max(rhats):.4f}]  "
      f"converged: {all(v['converged'] for v in conv.values())}  ess range [{min(esss)}, {max(esss)}] of {N}")
mc3 = BayesianMonteCarloEngine(cfg, seed=42).run_multichain(db, n_chains=3, iterations=3000)
conv3 = mc3["convergence"]
rh3 = [v["r_hat"] for v in conv3.values()]
print(f"multi-chain(3): r_hat range [{min(rh3):.4f}, {max(rh3):.4f}]  "
      f"converged: {all(v['converged'] for v in conv3.values())}")
# What a real diagnostic would say: MC standard error of median / p10
cat0 = frac["raw_samples"][:, 0, -1]
se_med = 1.2533 * cat0.std() / np.sqrt(N)  # asymptotic SE of mean ~ for median use 1.2533/sqrt(n)*sd approx
print(f"example MCSE on {cfg.category_names[0]} terminal median ≈ {se_med:.5f} "
      f"(vs median {np.median(cat0):+.4f})")

print()
print("=" * 72)
print("5. CLAIM 6 — HIDDEN INTENSITY PARAMETER")
print("=" * 72)
fw = 1.0 / len(FORCES)
att = np.array(list(DEFAULT_PER_FORCE_ATTENUATION.values()))
print(f"force weight = {fw:.4f}, per-force attenuation mean = {att.mean():.4f}")
print(f"effective intensity multiplier (weight x attenuation) = {fw*att.mean():.4f}  (claim: ~0.075)")

print()
print("DONE")
