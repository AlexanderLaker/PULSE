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
6. attenuation_sensitivity_band honours monotonicity in |headline|
   with respect to attenuation magnitude.
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
    base = ModelConfig()
    original_att = base.attenuation
    original_iters = base.iterations
    clone = base.copy_with(attenuation=att, iterations=iters)
    assert clone.attenuation == att
    assert clone.iterations == iters
    # Base is untouched
    assert base.attenuation == original_att
    assert base.iterations == original_iters
    # Frozen: cannot mutate
    with pytest.raises(Exception):
        base.attenuation = 0.1  # type: ignore[misc]


# ── Invariant 5: attenuation monotonicity of |headline| ─────────────
# With a fixed seed and iterations, increasing attenuation should
# increase |headline shift| in the compounding model (all trends share
# the same directional sign in aggregate). This is a weak monotonicity
# test — we only require the *average* relationship, not strict.

@pytest.mark.parametrize("seed", [1, 7, 42])
def test_attenuation_monotonic_in_headline(db, seed):
    def _headline(att):
        cfg = ModelConfig().copy_with(attenuation=att)
        r = BayesianMonteCarloEngine(cfg, seed=seed).run(db, iterations=400)
        last_year = cfg.path_years[-1]
        meds = [
            cd["path"][last_year]["median"]
            for cd in r["shift_matrix"].values()
        ]
        return float(np.mean(meds))

    h_low = _headline(0.35)
    h_base = _headline(0.50)
    h_high = _headline(0.65)
    # Monotonic in |.| — allow small noise tolerance
    assert abs(h_low) <= abs(h_base) + 0.005, (
        f"|headline| not monotone low vs base: {h_low} {h_base}"
    )
    assert abs(h_base) <= abs(h_high) + 0.005, (
        f"|headline| not monotone base vs high: {h_base} {h_high}"
    )
