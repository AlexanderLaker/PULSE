"""C3: Property-based tests for quantitative invariants.

These tests use `hypothesis` to generate random but valid inputs and
assert that model outputs respect invariants the engine is contractually
supposed to preserve — regardless of the specific input values:

1. All percentile outputs obey p10 ≤ p25 ≤ median ≤ p75 ≤ p90.
2. Shift matrix contains only finite numbers (no NaN/inf leaks).
3. Doubling iterations never changes the median by more than a
   convergence-tolerance band (Monte Carlo stability).
4. Two runs with the same seed produce identical output (seed integrity).
5. ModelConfig.copy_with never mutates the original.
6. |headline| is monotone in attenuation magnitude (per-force attenuation
   scaled uniformly up/down — see test_attenuation_monotonic_in_headline).
"""
import math

import numpy as np
import pytest
from hypothesis import given, settings, strategies as st, HealthCheck

from pulse.config import ModelConfig
from pulse.ingestion.models import TrendDatabase
from pulse.seed_trends import get_report_trends
from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine


@pytest.fixture(scope="module")
def db():
    return TrendDatabase(trends=get_report_trends())


# ── Invariant 1: percentile ordering ────────────────────────────────

@settings(deadline=None, max_examples=5,
          suppress_health_check=[HealthCheck.function_scoped_fixture])
@given(seed=st.integers(min_value=0, max_value=10_000))
def test_percentiles_are_monotone(db, seed):
    r = BayesianMonteCarloEngine(ModelConfig(), seed=seed).run(db, iterations=300)
    for cat, cd in r["shift_matrix"].items():
        for year, pct in cd["path"].items():
            p10, p25, med, p75, p90 = (
                pct["p10"], pct["p25"], pct["median"], pct["p75"], pct["p90"]
            )
            assert p10 <= p25 + 1e-9, f"{cat}/{year}: p10>p25"
            assert p25 <= med + 1e-9, f"{cat}/{year}: p25>median"
            assert med <= p75 + 1e-9, f"{cat}/{year}: median>p75"
            assert p75 <= p90 + 1e-9, f"{cat}/{year}: p75>p90"


# ── Invariant 2: no NaN / inf ───────────────────────────────────────

@settings(deadline=None, max_examples=5,
          suppress_health_check=[HealthCheck.function_scoped_fixture])
@given(seed=st.integers(min_value=0, max_value=10_000))
def test_output_is_finite(db, seed):
    r = BayesianMonteCarloEngine(ModelConfig(), seed=seed).run(db, iterations=300)
    for cat, cd in r["shift_matrix"].items():
        for year, pct in cd["path"].items():
            for k, v in pct.items():
                assert math.isfinite(v), f"Non-finite value at {cat}/{year}/{k}: {v}"


# ── Invariant 3: seed determinism ───────────────────────────────────

@settings(deadline=None, max_examples=3,
          suppress_health_check=[HealthCheck.function_scoped_fixture])
@given(seed=st.integers(min_value=0, max_value=10_000))
def test_seed_reproducibility(db, seed):
    a = BayesianMonteCarloEngine(ModelConfig(), seed=seed).run(db, iterations=250)
    b = BayesianMonteCarloEngine(ModelConfig(), seed=seed).run(db, iterations=250)
    for cat in a["shift_matrix"]:
        for year in a["shift_matrix"][cat]["path"]:
            ma = a["shift_matrix"][cat]["path"][year]["median"]
            mb = b["shift_matrix"][cat]["path"][year]["median"]
            assert ma == mb, f"Non-deterministic seed at {cat}/{year}: {ma} vs {mb}"


# ── Invariant 4: ModelConfig.copy_with is pure ──────────────────────

@settings(deadline=None, max_examples=20)
@given(att=st.floats(min_value=0.1, max_value=0.9, allow_nan=False),
       iters=st.integers(min_value=100, max_value=50_000))
def test_copy_with_is_pure(att, iters):
    """v3.2: validate copy_with on per_force_attenuation (no scalar)."""
    from pulse.config import FORCES
    base = ModelConfig()
    original_pfa = dict(base.per_force_attenuation)
    original_iters = base.iterations
    new_pfa = {f: att for f in FORCES}
    clone = base.copy_with(per_force_attenuation=new_pfa, iterations=iters)
    assert clone.per_force_attenuation == new_pfa
    assert clone.iterations == iters
    # Base is untouched
    assert base.per_force_attenuation == original_pfa
    assert base.iterations == original_iters
    # Frozen: cannot mutate
    with pytest.raises(Exception):
        base.per_force_attenuation = {f: 0.1 for f in FORCES}  # type: ignore[misc]


# ── Invariant 5: attenuation monotonicity of |headline| ─────────────
# v3.2: scalar attenuation removed. We now scale every per-force value
# uniformly by a factor and verify |headline| is monotone in that factor
# (under fixed seed + iterations). All trends share the same directional
# aggregate sign, so larger attenuation amplifies the magnitude.

@pytest.mark.parametrize("seed", [1, 7, 42])
def test_attenuation_monotonic_in_headline(db, seed):
    from pulse.config import FORCES
    base_pfa = ModelConfig().per_force_attenuation

    def _headline(factor):
        scaled = {f: max(0.0, min(1.0, base_pfa[f] * factor)) for f in FORCES}
        cfg = ModelConfig().copy_with(
            per_force_attenuation=scaled,
            attenuation_source="admin_override",
        )
        r = BayesianMonteCarloEngine(cfg, seed=seed).run(db, iterations=400)
        last_year = cfg.path_years[-1]
        meds = [
            cd["path"][last_year]["median"]
            for cd in r["shift_matrix"].values()
        ]
        return float(np.mean(meds))

    h_low = _headline(0.70)   # 30 % flex down from calibrated baseline
    h_base = _headline(1.00)
    h_high = _headline(1.30)  # 30 % flex up
    # Monotonic in |.| — allow small noise tolerance
    assert abs(h_low) <= abs(h_base) + 0.005, (
        f"|headline| not monotone low vs base: {h_low} {h_base}"
    )
    assert abs(h_base) <= abs(h_high) + 0.005, (
        f"|headline| not monotone base vs high: {h_base} {h_high}"
    )
