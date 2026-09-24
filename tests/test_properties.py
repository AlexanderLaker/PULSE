"""Property-based checks (hypothesis) on the full driver base and the engine's arithmetic.

Whatever the seed: percentiles are ordered, every output is finite, a seed
reproduces its run, ModelConfig.copy_with never mutates the original, and a
uniformly stronger attenuation never shrinks the headline. Whatever the
drivers of a force: adding one moves the force's total at the means its own
way once it has materialised as far as the others.
"""
import dataclasses
import math
from types import SimpleNamespace

import numpy as np
import pytest
from hypothesis import given, settings, strategies as st, HealthCheck

from prism.config import FORCES, ModelConfig
from prism.drivers import DriverSet
from prism.seed_drivers import get_seed_drivers
from prism.engine import MonteCarloEngine


@pytest.fixture(scope="module")
def seed_driver_set():
    return DriverSet(drivers=get_seed_drivers())


# ── Invariant 1: percentile ordering ────────────────────────────────

@settings(deadline=None, max_examples=5,
          suppress_health_check=[HealthCheck.function_scoped_fixture])
@given(seed=st.integers(min_value=0, max_value=10_000))
def test_percentiles_are_monotone(seed_driver_set, seed):
    r = MonteCarloEngine(ModelConfig(), seed=seed).run(seed_driver_set, iterations=300)
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
def test_output_is_finite(seed_driver_set, seed):
    r = MonteCarloEngine(ModelConfig(), seed=seed).run(seed_driver_set, iterations=300)
    for cat, cd in r["shift_matrix"].items():
        for year, pct in cd["path"].items():
            for k, v in pct.items():
                assert math.isfinite(v), f"Non-finite value at {cat}/{year}/{k}: {v}"


# ── Invariant 3: seed determinism ───────────────────────────────────

@settings(deadline=None, max_examples=3,
          suppress_health_check=[HealthCheck.function_scoped_fixture])
@given(seed=st.integers(min_value=0, max_value=10_000))
def test_seed_reproducibility(seed_driver_set, seed):
    a = MonteCarloEngine(ModelConfig(), seed=seed).run(seed_driver_set, iterations=250)
    b = MonteCarloEngine(ModelConfig(), seed=seed).run(seed_driver_set, iterations=250)
    for cat in a["shift_matrix"]:
        for year in a["shift_matrix"][cat]["path"]:
            ma = a["shift_matrix"][cat]["path"][year]["median"]
            mb = b["shift_matrix"][cat]["path"][year]["median"]
            assert ma == mb, f"Non-deterministic seed at {cat}/{year}: {ma} vs {mb}"


# ── Invariant 4: ModelConfig.copy_with is pure ──────────────────────

@settings(deadline=None, max_examples=20)
@given(att=st.floats(min_value=0.1, max_value=0.9, allow_nan=False),
       rho=st.floats(min_value=0.0, max_value=0.5, allow_nan=False))
def test_copy_with_is_pure(att, rho):
    base = ModelConfig()
    original_pfa = dict(base.per_force_attenuation)
    original_rho = base.within_force_rho
    new_pfa = {f: att for f in FORCES}
    clone = base.copy_with(per_force_attenuation=new_pfa, within_force_rho=rho)
    assert clone.per_force_attenuation == new_pfa
    assert clone.within_force_rho == rho
    # Base is untouched
    assert base.per_force_attenuation == original_pfa
    assert base.within_force_rho == original_rho
    # Frozen: cannot mutate
    with pytest.raises(dataclasses.FrozenInstanceError):
        base.per_force_attenuation = {f: 0.1 for f in FORCES}  # type: ignore[misc]


# ── Invariant 5: attenuation monotonicity of |headline| ─────────────
# Every per-force attenuation is scaled by one factor; under a fixed seed the
# magnitude of the headline (the terminal-year portfolio median) must not
# fall as the factor rises (the base is net contraction, so a larger
# pass-through amplifies it).

@pytest.mark.parametrize("seed", [1, 7, 42])
def test_attenuation_monotonic_in_headline(seed_driver_set, seed):
    base_pfa = ModelConfig().per_force_attenuation

    def headline(factor):
        scaled = {f: max(0.0, min(1.0, base_pfa[f] * factor)) for f in FORCES}
        cfg = ModelConfig().copy_with(per_force_attenuation=scaled,
                                      overlap_correction_source=f"test: attenuation x {factor}")
        r = MonteCarloEngine(cfg, seed=seed).run(seed_driver_set, iterations=400)
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


# ── Invariant 6: adding a driver moves its force's total its own way ─
# docs/MODEL.md (step 5) and ADR 0006: the within-force dampening is set from
# the score means, the same in every year. With every overlap below 0.5,
# adding a driver moves the force's total in a cell at the means in the
# driver's own direction in any year in which it has materialised at least as
# far as each of the force's other drivers; in an earlier year it can move the
# total the other way.

def _force_total(overlap: float, effects: list, exposure: list, materialised: list) -> float:
    """One force's total in one cell at the means, with the engine's own dampening: the dampening times
    the sum of expected effect x exposure x materialised share."""
    config = ModelConfig().copy_with(within_force_overlap={f: overlap for f in FORCES})
    drivers = [SimpleNamespace(force="Consumer", expected_effect=e) for e in effects]
    dampening, _ = MonteCarloEngine(config).within_force_dampening(drivers, np.array(exposure)[:, np.newaxis])
    return float(dampening[FORCES.index("Consumer"), 0]) * sum(
        e * x * m for e, x, m in zip(effects, exposure, materialised))


_effect = st.floats(min_value=-0.2, max_value=0.2, allow_nan=False)
_exposure = st.integers(min_value=0, max_value=5).map(lambda score: score / 5)


@settings(deadline=None, max_examples=300)
@given(overlap=st.floats(min_value=0.0, max_value=0.499),
       others=st.lists(st.tuples(_effect, _exposure, st.floats(min_value=0.0, max_value=1.0)),
                       min_size=1, max_size=8),
       added=st.tuples(_effect.filter(lambda e: abs(e) >= 1e-4), _exposure),
       lead=st.floats(min_value=0.0, max_value=1.0))
def test_adding_a_driver_moves_its_force_total_its_own_way(overlap, others, added, lead):
    effects, exposure, materialised = (list(column) for column in zip(*others))
    # the added driver has materialised at least as far as every other driver of the force
    ahead = max(materialised) + lead * (1.0 - max(materialised))
    before = _force_total(overlap, effects, exposure, materialised)
    after = _force_total(overlap, effects + [added[0]], exposure + [added[1]], materialised + [ahead])
    assert (after - before) * math.copysign(1.0, added[0]) >= -1e-12


def test_a_driver_not_yet_materialised_can_move_the_total_the_other_way():
    """The documented limit: before the added headwind materialises it already counts in n_eff, so the
    two headwinds acting are dampened more and the force's total headwind shrinks."""
    before = _force_total(0.1, [-0.05, -0.05], [1.0, 1.0], [1.0, 1.0])
    after = _force_total(0.1, [-0.05, -0.05, -0.02], [1.0, 1.0, 1.0], [1.0, 1.0, 0.0])
    assert before < after < 0
