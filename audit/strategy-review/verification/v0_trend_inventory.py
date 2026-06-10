"""v0_trend_inventory.py — Pass 0/2/4 evidence: ground-truth inventory of the seeded trend database.

Tests: what is actually in pulse/seed_trends.py (counts, scores, exposures, provenance fields).
Found: see v0_trend_inventory_out.txt (committed next to this script).
Usage: python3 v0_trend_inventory.py <repo_root>
"""
import sys, os, json, collections
import numpy as np

repo = sys.argv[1] if len(sys.argv) > 1 else "."
sys.path.insert(0, repo)
os.environ["PYTHONDONTWRITEBYTECODE"] = "1"
sys.dont_write_bytecode = True

from pulse.seed_trends import get_report_trends  # noqa: E402
from pulse.config import CATEGORIES, FORCES, VC_STEPS, REGIONS  # noqa: E402

trends = get_report_trends()
print(f"TOTAL TRENDS: {len(trends)}")

by_force = collections.Counter(t.force for t in trends)
by_dir = collections.Counter(t.direction for t in trends)
print("BY FORCE:", dict(by_force))
print("BY DIRECTION:", dict(by_dir))

probs = np.array([t.probability for t in trends])
gp1 = np.array([t.gp1_pct_affected if t.gp1_pct_affected is not None else np.nan for t in trends])
ns = np.array([t.normalized_score for t in trends])
print(f"PROBABILITY 1-5: counts={dict(collections.Counter(probs.tolist()))}")
print(f"GP1_PCT: n_missing={np.isnan(gp1).sum()}, min={np.nanmin(gp1):.3f}, "
      f"p25={np.nanpercentile(gp1,25):.3f}, median={np.nanmedian(gp1):.3f}, "
      f"p75={np.nanpercentile(gp1,75):.3f}, max={np.nanmax(gp1):.3f}")
print(f"NORMALIZED_SCORE: min={ns.min():+.4f}, median={np.median(ns):+.4f}, max={ns.max():+.4f}, "
      f"sum={ns.sum():+.4f}, mean={ns.mean():+.4f}")

# Peak years & curves
peaks = collections.Counter(getattr(t, "peak_year", 0) for t in trends)
curves = collections.Counter(getattr(t, "diffusion_curve", "") for t in trends)
print("PEAK YEARS:", dict(sorted(peaks.items())))
print("DIFFUSION CURVES:", dict(curves))

# Exposure stats
exp_counts = []
exp_vals = []
cat_cov = collections.Counter()
for t in trends:
    ce = t.category_exposure or {}
    nz = [(c, v) for c, v in ce.items() if v and v > 0]
    exp_counts.append(len(nz))
    for c, v in nz:
        exp_vals.append(v)
        cat_cov[c] += 1
print(f"CATEGORY EXPOSURE: trends touch median {np.median(exp_counts):.0f} cats "
      f"(min {min(exp_counts)}, max {max(exp_counts)}); exposure values dist: "
      f"{dict(collections.Counter(exp_vals))}")
print("CATEGORY COVERAGE (n trends touching):")
for c in CATEGORIES:
    print(f"  {c:18s} {cat_cov.get(c, 0)}")
unknown_cats = {c for c in cat_cov if c not in CATEGORIES}
print("EXPOSURE KEYS NOT IN CATEGORIES:", sorted(unknown_cats))

# VC / regional exposure presence
vc_n = sum(1 for t in trends if any((t.vc_exposure or {}).values()))
rg_n = sum(1 for t in trends if any((t.regional_exposure or {}).values()))
print(f"TRENDS WITH VC EXPOSURE: {vc_n}/{len(trends)}; WITH REGIONAL: {rg_n}/{len(trends)}")

# Provenance fields
src_type = collections.Counter(t.source_type for t in trends)
conf = collections.Counter(t.confidence for t in trends)
print("SOURCE_TYPE:", dict(src_type))
print("CONFIDENCE:", dict(conf))
no_source = [t.id for t in trends if not (t.data_source or "").strip()]
print(f"TRENDS WITHOUT data_source: {len(no_source)} {no_source[:10]}")

# Net signed exposure-weighted score per category (deterministic proxy)
print("\nDETERMINISTIC NET SCORE PER CATEGORY (sum normalized_score*exposure/5):")
for c in CATEGORIES:
    s = sum(t.normalized_score * min(t.category_exposure.get(c, 0), 5) / 5.0 for t in trends)
    print(f"  {c:18s} {s:+.4f}")

# Top 10 trends by |normalized_score|
print("\nTOP 10 TRENDS BY |normalized_score|:")
for t in sorted(trends, key=lambda x: abs(x.normalized_score), reverse=True)[:10]:
    print(f"  {t.id:18s} {t.direction:11s} p={t.probability} gp1={t.gp1_pct_affected} "
          f"ns={t.normalized_score:+.3f} peak={t.peak_year} {t.name[:48]}")

# Sample of 18 trends across forces for the Pass-2 trend review
print("\nSAMPLE (first 3 per force):")
seen = collections.Counter()
for t in trends:
    if seen[t.force] < 3:
        seen[t.force] += 1
        print(f"  [{t.force}] {t.id}: {t.name} | dir={t.direction} p={t.probability} "
              f"gp1={t.gp1_pct_affected} conf={t.confidence} src_type={t.source_type}")
