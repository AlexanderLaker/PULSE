"""The full production run against the reference run of the PRISM Analysis record.

Opt-in, because it takes about two minutes:

    PRISM_FULL_RUN=1 python3 -m pytest tests/test_reference_run.py

It runs the production configuration at the production size (3 chains of
50,000 iterations, seed 42) and checks that the 2035 portfolio band and every
category's P10, median and P90 equal the reference run stored in
data/drivers/driver_attribution.json, which holds them to six decimals and
reproduces production run 99. Run it before a release and after any change
to the engine, the configuration or the numpy and scipy versions; CI runs it
when started by hand (.github/workflows/ci.yml, workflow_dispatch).
"""
import json
import os
from pathlib import Path

import pytest

from golden_production import production_result
from prism.config import PRODUCTION_CHAINS, PRODUCTION_ITERATIONS
from prism.engine import MonteCarloEngine

RECORD = Path(__file__).resolve().parents[1] / "data" / "drivers" / "driver_attribution.json"
#: The record rounds to six decimals, so a value that reproduces lies within half a unit of the sixth.
ROUNDING = 5e-7 + 1e-12

pytestmark = pytest.mark.skipif(os.environ.get("PRISM_FULL_RUN") != "1",
                                reason="the full production run takes minutes; set PRISM_FULL_RUN=1")


def test_the_full_run_reproduces_the_reference_run():
    reference = json.loads(RECORD.read_text(encoding="utf-8"))["reference_run"]
    assert reference["model_version"] == MonteCarloEngine.MODEL_VERSION
    assert (reference["chains"], reference["iterations"]) == (PRODUCTION_CHAINS, PRODUCTION_ITERATIONS)
    result = production_result(iterations=PRODUCTION_ITERATIONS, chains=PRODUCTION_CHAINS)
    year = max(result["totals"]["portfolio"])
    moved = {}
    for stat, value in reference["portfolio_terminal"].items():
        got = result["totals"]["portfolio"][year][stat]
        if abs(got - value) > ROUNDING:
            moved[f"portfolio/{stat}"] = (got, value)
    for category, band in reference["categories_terminal"].items():
        for stat, value in band.items():
            got = result["shift_matrix"][category]["path"][year][stat]
            if abs(got - value) > ROUNDING:
                moved[f"{category}/{stat}"] = (got, value)
    assert moved == {}
