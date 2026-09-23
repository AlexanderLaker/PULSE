"""Property-based checks (hypothesis) on the full driver base.

Whatever the seed: percentiles are ordered, every output is finite, a seed
reproduces its run, ModelConfig.copy_with never mutates the original, and a
uniformly stronger attenuation never shrinks the headline.
"""
import dataclasses
import math

import pytest
from hypothesis import given, settings, strategies as st, HealthCheck

from prism.config import ModelConfig
from prism.drivers import DriverSet
from prism.seed_drivers import get_seed_drivers
from prism.simulation.engine import MonteCarloEngine


@pytest.fixture(scope="module")
def db():
    return DriverSet(drivers=get_seed_drivers())


# ── Invariant 1: percentile ordering ────────────────────────────────

@settings(deadline=None, max_examples=5,
          suppress_health_check=[HealthCheck.function_scoped_fixture])
@given(seed=st.integers(min_value=0, max_value=10_000))
def test_percentiles_are_monotone(db, seed):
    r = MonteCarloEngine(ModelConfig(), seed=seed).run(db, iterations=300)
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
    r = MonteCarloEngine(ModelConfig(), seed=seed).run(db, iterations=300)
    for cat, cd in r["shift_matrix"].items():
        for year, pct in cd["path"].items():
            for k, v in pct.items():
                assert math.isfinite(v), f"Non-finite value at {cat}/{year}/{k}: {v}"


# ── Invariant 3: seed determinism ───────────────────────────────────

@settings(deadline=None, max_examples=3,
          suppress_health_check=[HealthCheck.function_scoped_fixture])
@given(seed=st.integers(min_value=0, max_value=10_000))
def test_seed_reproducibility(db, seed):
    a = MonteCarloEngine(ModelConfig(), seed=seed).run(db, iterations=250)
    b = MonteCarloEngine(ModelConfig(), seed=seed).run(db, iterations=250)
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
    from prism.config import FORCES
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
    with pytest.raises(dataclasses.FrozenInstanceError):
        base.per_force_attenuation = {f: 0.1 for f in FORCES}  # type: ignore[misc]


# ── Invariant 5: attenuation monotonicity of |headline| ─────────────
# Every per-force attenuation is scaled by one factor; under a fixed seed the
# magnitude of the headline (the terminal-year portfolio median) must not
# fall as the factor rises (the base is net contraction, so a larger
# pass-through amplifies it).

@pytest.mark.parametrize("seed", [1, 7, 42])
def test_attenuation_monotonic_in_headline(db, seed):
    from prism.config import FORCES
    base_pfa = ModelConfig().per_force_attenuation

    def headline(factor):
        scaled = {f: max(0.0, min(1.0, base_pfa[f] * factor)) for f in FORCES}
        cfg = ModelConfig().copy_with(per_force_attenuation=scaled,
                                      attenuation_source=f"test: attenuation x {factor}")
        r = MonteCarloEngine(cfg, seed=seed).run(db, iterations=400)
        return float(r["totals"]["portfolio"][cfg.path_years[-1]]["median"])

    h_low = headline(0.70)   # 30 percent below the default
    h_base = headline(1.00)
    h_high = headline(1.30)  # 30 percent above
    # monotone in magnitude, with a small tolerance for sampling noise
    assert abs(h_low) <= abs(h_base) + 0.005, (
        f"|headline| not monotone low vs base: {h_low} {h_base}"
    )
    assert abs(h_base) <= abs(h_high) + 0.005, (
        f"|headline| not monotone base vs high: {h_base} {h_high}"
    )
