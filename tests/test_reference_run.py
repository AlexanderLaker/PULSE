"""The full production run against the reference run of the PRISM Analysis record,
and the copula comparison behind docs/adr/0004-gaussian-copula.md.

Opt-in, because it takes a few minutes:

    PRISM_FULL_RUN=1 python3 -m pytest tests/test_reference_run.py

It runs the production configuration at the production size (3 chains of
50,000 iterations, seed 42) and checks that the 2035 portfolio band and every
category's P10, median and P90 equal the reference run stored in
data/drivers/driver_attribution.json, which holds them to six decimals and
reproduces production run 99. Run it before a release and after any change
to the engine, the configuration or the numpy and scipy versions; CI runs it
when started by hand (.github/workflows/ci.yml, workflow_dispatch).

The second test swaps the engine's Gaussian copula for a Student-t one with 4,
10 and 30 degrees of freedom on the same configuration (3 x 20,000
iterations) and checks the figures ADR 0004 quotes: the 2035 portfolio median
moves by less than 0.02 points and the P10 to P90 band narrows by less than
3 percent.
"""
import json
import os
from pathlib import Path

import numpy as np
import pytest
from scipy.linalg import cholesky
from scipy.stats import beta as beta_dist, t as t_dist

from golden_production import production_result
from prism.config import PRODUCTION_CHAINS, PRODUCTION_ITERATIONS
from prism.engine import UNIFORM_CLIP, MonteCarloEngine

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


def test_a_student_t_copula_changes_nothing_visible(monkeypatch):
    gaussian = MonteCarloEngine.generate_copula_samples
    nu = {"value": None}

    def copula(self, drivers, R, n_iter):
        if nu["value"] is None:
            return gaussian(self, drivers, R, n_iter)
        z = self.rng.standard_normal((n_iter, len(drivers))) @ cholesky(R, lower=True).T
        w = self.rng.chisquare(nu["value"], size=(n_iter, 1))
        u = np.clip(t_dist.cdf(z / np.sqrt(w / nu["value"]), nu["value"]), UNIFORM_CLIP, 1 - UNIFORM_CLIP)
        return np.column_stack([beta_dist.ppf(u[:, j], *d.probability_prior) * d.gp1_pct_affected * d.direction_sign
                                for j, d in enumerate(drivers)])

    monkeypatch.setattr(MonteCarloEngine, "generate_copula_samples", copula)

    def band():
        p = production_result(iterations=20_000, chains=PRODUCTION_CHAINS)["totals"]["portfolio"][2035]
        return p["median"], p["p90"] - p["p10"]

    median, width = band()
    for degrees in (4.0, 10.0, 30.0):
        nu["value"] = degrees
        t_median, t_width = band()
        assert abs(t_median - median) < 0.0002, degrees          # 0.02 points
        assert abs(t_width - width) / width < 0.03, degrees      # 3 percent of the band

