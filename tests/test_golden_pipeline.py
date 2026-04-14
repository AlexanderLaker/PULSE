"""C1: End-to-end golden-file test.

Pins the median shift path produced by the Bayesian MC engine for a
fixed (seed, iterations, trend database) triple. Any change to the
numerical pipeline — sampling, copula, compounding, attenuation,
materialization schedules, trend database — will break this test and
force a deliberate golden-file update.

The tolerance is deliberately tight (0.5pp absolute on medians). If
the engine drifts beyond that, *something* changed that downstream
consumers (Power BI, Excel, dashboard) will also see — and the team
has to decide whether to accept the new number as the new truth.

To regenerate after an intentional model change:

    python -c "
    import json
    from pulse.config import ModelConfig
    from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine
    from pulse.seed_trends import get_report_trends
    from pulse.ingestion.models import TrendDatabase
    db = TrendDatabase(trends=get_report_trends())
    r = BayesianMonteCarloEngine(ModelConfig(), seed=42).run(db, iterations=1000)
    golden = {cat: {str(y): round(float(v['median']), 6)
                    for y, v in cd['path'].items()}
              for cat, cd in r['shift_matrix'].items()}
    json.dump({'seed': 42, 'iterations': 1000,
               'model_version': r['model_version'],
               'shift_median_by_cat_year': golden},
              open('tests/golden/shift_matrix_v12_reference.json', 'w'),
              indent=2, sort_keys=True)
    "
"""
import json
from pathlib import Path

import pytest

from pulse.config import ModelConfig
from pulse.ingestion.models import TrendDatabase
from pulse.seed_trends import get_report_trends
from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine

GOLDEN_PATH = Path(__file__).parent / "golden" / "shift_matrix_v12_reference.json"
ABS_TOLERANCE = 0.005  # 0.5 percentage points


@pytest.fixture(scope="module")
def golden():
    assert GOLDEN_PATH.exists(), f"Golden file missing at {GOLDEN_PATH}"
    with open(GOLDEN_PATH) as f:
        return json.load(f)


@pytest.fixture(scope="module")
def fresh_result(golden):
    db = TrendDatabase(trends=get_report_trends())
    cfg = ModelConfig()
    engine = BayesianMonteCarloEngine(cfg, seed=golden["seed"])
    return engine.run(db, iterations=golden["iterations"])


def test_golden_model_version_matches(golden, fresh_result):
    """Model version stamp must match — if this fails, someone bumped
    the engine version without updating the golden file."""
    assert fresh_result.get("model_version") == golden["model_version"], (
        f"Engine model_version={fresh_result.get('model_version')} does not "
        f"match golden file model_version={golden['model_version']}. "
        "Regenerate the golden file if this change is intentional."
    )


def test_golden_category_set_matches(golden, fresh_result):
    expected = set(golden["shift_median_by_cat_year"].keys())
    actual = set(fresh_result["shift_matrix"].keys())
    assert actual == expected, (
        f"Category set drifted. Added={actual - expected}, "
        f"Removed={expected - actual}"
    )


def test_golden_shift_medians_within_tolerance(golden, fresh_result):
    """Every (category, year) median must be within ABS_TOLERANCE of the
    golden value. This is the core numerical-pipeline regression guard."""
    expected = golden["shift_median_by_cat_year"]
    diffs = []
    for cat, yrs in expected.items():
        cat_data = fresh_result["shift_matrix"][cat]
        path = cat_data["path"]
        for y_str, exp_med in yrs.items():
            year = int(y_str)
            actual = path[year]
            actual_med = float(actual["median"] if isinstance(actual, dict) else actual)
            delta = abs(actual_med - exp_med)
            if delta > ABS_TOLERANCE:
                diffs.append((cat, year, exp_med, actual_med, delta))
    assert not diffs, (
        "Golden-file regression: "
        + "; ".join(
            f"{cat}/{y}: expected={e:+.4f}, actual={a:+.4f}, Δ={d:.4f}"
            for cat, y, e, a, d in diffs
        )
    )


def test_golden_velocity_shape_is_dict(fresh_result):
    """D5 contract: velocity[year] must be a dict of percentiles, not a
    scalar. This guards against a regression that reverts to the old
    median-of-medians velocity."""
    first_cat = next(iter(fresh_result["shift_matrix"].values()))
    velocity = first_cat.get("velocity", {})
    assert velocity, "velocity field must be populated"
    sample_year = next(iter(velocity.values()))
    assert isinstance(sample_year, dict), (
        f"velocity[year] must be a dict per D5, got {type(sample_year).__name__}"
    )
    required_keys = {"median", "p10", "p90", "mean", "std"}
    assert required_keys.issubset(sample_year.keys()), (
        f"velocity dict missing required keys: {required_keys - sample_year.keys()}"
    )
