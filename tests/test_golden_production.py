"""The production golden pin (tests/golden_production.py): the engine on the 51
drivers of the driver base, the production configuration and seed, three
chains of 2,000 iterations, held to tests/golden_production.json.

The tolerance (1e-9 relative, 1e-12 absolute) passes the last-digit
differences between numpy and scipy builds and fails any change to how the
engine draws or combines its numbers: drawing the peak-year offsets before
the copula, for example, moves these values by about 1e-5.
"""
import json

import pytest

from golden_production import ITERATIONS, PINS_FILE, pinned_values, production_drivers, production_result
from prism.engine import MonteCarloEngine

PINS = json.loads(PINS_FILE.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def result():
    return production_result()


def test_the_pins_belong_to_this_model_and_base():
    """A new MODEL_VERSION or a changed driver base regenerates the pins in the same commit."""
    assert PINS["model_version"] == MonteCarloEngine.MODEL_VERSION
    assert PINS["iterations"] == ITERATIONS
    assert PINS["driver_count"] == len(production_drivers())


def test_the_run_has_no_integrity_events(result):
    """The production configuration is positive definite as entered and floors nothing."""
    assert result["integrity_events"] == []


def test_every_pinned_value(result):
    values = pinned_values(result)
    assert set(values) == set(PINS["values"])
    moved = {key: (values[key], pinned) for key, pinned in PINS["values"].items()
             if values[key] != pytest.approx(pinned, rel=1e-9, abs=1e-12)}
    assert moved == {}, f"{len(moved)} of {len(values)} values moved, for example {sorted(moved.items())[:3]}"


def test_the_pins_are_distinct():
    """Repeated values could not catch two categories or two cells swapped."""
    medians = [v for k, v in PINS["values"].items() if k.startswith("category/") and k.endswith("/2035/median")]
    assert len(set(medians)) == len(medians)
