"""End-to-end locks on the engine: determinism, golden values and the identities the dashboard relies on.

The golden values are the engine's output for seed 42 and 500 iterations on
the conftest drivers. They change only with a deliberate change to the model
(then MODEL_VERSION goes up with them) or to those fixture drivers, and the new
values are committed together with that change.
"""
import copy
import json
from pathlib import Path

import pytest

import prism
from prism.drivers import DriverSet
from prism.engine import MonteCarloEngine

ITER = 500
SEED = 42


def _run(config, driver_set, seed=SEED, iterations=ITER):
    return MonteCarloEngine(config, seed=seed).run(driver_set, iterations=iterations)


class TestDeterminism:
    def test_same_seed_reproduces_exactly(self, mock_model_config, mock_driver_set):
        r1 = _run(mock_model_config, mock_driver_set)
        r2 = _run(mock_model_config, mock_driver_set)
        assert r1["shift_matrix"] == r2["shift_matrix"]
        assert r1["totals"]["portfolio"] == r2["totals"]["portfolio"]

    def test_different_seed_diverges(self, mock_model_config, mock_driver_set):
        r1 = _run(mock_model_config, mock_driver_set, seed=42)
        r2 = _run(mock_model_config, mock_driver_set, seed=43)
        assert r1["shift_matrix"]["Hair: Color"]["path"][2030]["median"] != \
            r2["shift_matrix"]["Hair: Color"]["path"][2030]["median"]

    def test_driver_order_matters_to_the_draws(self, mock_model_config, mock_driver_set):
        """The copula pairs draws with drivers by position, so the same seed on a
        reordered driver list gives different numbers. That is why the database
        always returns drivers ordered by id; if this ever stops holding, the
        ordering contract in prism.database.load_drivers can be revisited."""
        reordered = DriverSet(drivers=list(reversed(mock_driver_set.drivers)))
        r1 = _run(mock_model_config, mock_driver_set)
        r2 = _run(mock_model_config, reordered)
        assert r1["shift_matrix"]["Hair: Color"]["path"][2030]["median"] != \
            r2["shift_matrix"]["Hair: Color"]["path"][2030]["median"]

    def test_multichain_same_seed_reproduces(self, mock_model_config, mock_driver_set):
        r1 = MonteCarloEngine(mock_model_config, seed=SEED).run(mock_driver_set, chains=2, iterations=200)
        r2 = MonteCarloEngine(mock_model_config, seed=SEED).run(mock_driver_set, chains=2, iterations=200)
        assert r1["chain_seeds"] == r2["chain_seeds"]
        assert r1["shift_matrix"] == r2["shift_matrix"]


class TestGoldenValues:
    """Seed 42, 500 iterations, terminal year 2030 of the fixture path."""

    PINS = {
        # category:    (median,          p10,             p90)
        "Hair: Color": (-0.003779976872, -0.005804170322, -0.001819783075),
        "Hair: Care":  (-0.004825253038, -0.006435612853, -0.003157892180),
        "LHC: FCN":    (-0.006979070921, -0.008556546145, -0.005248480889),
    }
    #: The joint portfolio band, the number the dashboard headline shows.
    PORTFOLIO_PIN = (-0.005715456934, -0.007413341000, -0.004009810673)

    def test_engine_identity(self, mock_model_config, mock_driver_set):
        r = _run(mock_model_config, mock_driver_set)
        assert r["model_version"] == "2.13.0"
        assert r["engine_name"] == "beta_copula"
        assert r["seed"] == SEED
        assert r["numerics_backend"].startswith("scipy ")

    def test_one_version_everywhere(self):
        """The package, the engine, package.json and its lock carry the same version."""
        assert prism.__version__ == MonteCarloEngine.MODEL_VERSION
        repo = Path(__file__).resolve().parents[1]
        pkg = json.loads((repo / "package.json").read_text())
        lock = json.loads((repo / "package-lock.json").read_text())
        assert pkg["version"] == lock["version"] == lock["packages"][""]["version"] == MonteCarloEngine.MODEL_VERSION
        assert pkg["name"] == lock["name"] == lock["packages"][""]["name"]

    def test_category_values(self, mock_model_config, mock_driver_set):
        sm = _run(mock_model_config, mock_driver_set)["shift_matrix"]
        assert max(sm["Hair: Color"]["path"]) == 2030
        for cat, (median, p10, p90) in self.PINS.items():
            cell = sm[cat]["path"][2030]
            assert cell["median"] == pytest.approx(median, rel=1e-6), cat
            assert cell["p10"] == pytest.approx(p10, rel=1e-6), cat
            assert cell["p90"] == pytest.approx(p90, rel=1e-6), cat

    def test_pins_are_distinct(self):
        """Identical pins could not catch two categories being swapped."""
        assert len(set(self.PINS.values())) == len(self.PINS)

    def test_portfolio_band(self, mock_model_config, mock_driver_set):
        cell = _run(mock_model_config, mock_driver_set)["totals"]["portfolio"][2030]
        median, p10, p90 = self.PORTFOLIO_PIN
        assert cell["median"] == pytest.approx(median, rel=1e-6)
        assert cell["p10"] == pytest.approx(p10, rel=1e-6)
        assert cell["p90"] == pytest.approx(p90, rel=1e-6)

    def test_no_integrity_events_on_the_defaults(self, mock_model_config, mock_driver_set):
        """The default correlations are positive definite as entered: any repair,
        clip or floor on the defaults is a regression."""
        assert _run(mock_model_config, mock_driver_set)["integrity_events"] == []


class TestMultichain:
    def test_seeds(self, mock_model_config, mock_driver_set):
        r = MonteCarloEngine(mock_model_config, seed=SEED).run(mock_driver_set, chains=3, iterations=200)
        assert r["seed"] == SEED
        assert r["chains"] == 3 and r["iterations"] == 200
        assert len(r["chain_seeds"]) == 3 and r["chain_seeds"][0] == SEED

    def test_seed_stability(self, mock_model_config, mock_driver_set):
        r = MonteCarloEngine(mock_model_config, seed=SEED).run(mock_driver_set, chains=3, iterations=200)
        ss = r["seed_stability"]
        assert ss["metric"] == "terminal_year_portfolio_median"
        assert ss["n_chains"] == 3 and ss["iterations_per_chain"] == 200 and ss["pooled_iterations"] == 600
        assert len(ss["per_chain_medians"]) == 3
        assert ss["spread_pp"] == pytest.approx((max(ss["per_chain_medians"]) - min(ss["per_chain_medians"])) * 100.0)


class TestAttributionIdentities:
    """Each lens partitions the median, so the lens rows add up to the Shift Matrix."""

    @pytest.mark.parametrize("lens", ["force", "vc", "region"])
    def test_lens_reconciles_to_the_median(self, lens, mock_model_config, mock_driver_set):
        r = _run(mock_model_config, mock_driver_set)
        for year, by_cat in r["decompositions"][lens].items():
            for cat, row in by_cat.items():
                median = r["shift_matrix"][cat]["path"][int(year)]["median"]
                assert sum(row.values()) == pytest.approx(median, rel=1e-9, abs=1e-12), (lens, cat, year)

    def test_value_chain_lens_is_a_partition_by_epicentre(self, mock_model_config, mock_driver_set):
        """Each driver's contribution sits wholly on its epicentre stage; every other stage carries 0."""
        r = _run(mock_model_config, mock_driver_set)
        stages = {d.vc_epicentre for d in mock_driver_set.drivers}
        assert stages == {"Formulation", "Manufacturing", "Marketing", "Commercial"}
        for year, by_cat in r["decompositions"]["vc"].items():
            for cat, row in by_cat.items():
                median = r["shift_matrix"][cat]["path"][int(year)]["median"]
                for stage, value in row.items():
                    if stage not in stages:
                        assert value == 0.0, (cat, year, stage)
                    elif abs(median) > 1e-15:
                        assert value != 0.0, (cat, year, stage)

    def test_a_category_no_driver_reaches_has_zero_in_every_lens(self, mock_model_config, mock_driver_set):
        """With no driver in a category, its median is exactly zero, and so is every lens value:
        the lenses still add up to the row total, and nothing is spread over stages no driver named."""
        driver_set = copy.deepcopy(mock_driver_set)
        for d in driver_set.drivers:
            d.category_exposure["LHC: IC"] = 0
        r = _run(mock_model_config, driver_set)
        for lens in ("force", "vc", "region"):
            for year, by_cat in r["decompositions"][lens].items():
                assert r["shift_matrix"]["LHC: IC"]["path"][int(year)]["median"] == 0.0
                assert set(by_cat["LHC: IC"].values()) == {0.0}, (lens, year)
        assert r["integrity_events"] == []
