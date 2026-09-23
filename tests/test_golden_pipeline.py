"""End-to-end locks on the engine: determinism, golden values and the identities the dashboard relies on.

The golden values are the engine's output for seed 42 and 500 iterations on
the conftest drivers. They change only with a deliberate model change; then
regenerate them, bump MODEL_VERSION and commit both together.
"""
import copy
import json
from pathlib import Path

import pytest

import prism
from prism.config import vc_epicentre_step_of
from prism.drivers import DriverSet
from prism.simulation.engine import MonteCarloEngine

ITER = 500
SEED = 42


def _run(config, db, seed=SEED, iterations=ITER):
    return MonteCarloEngine(config, seed=seed).run(db, iterations=iterations)


class TestDeterminism:
    def test_same_seed_reproduces_exactly(self, mock_model_config, mock_drivers_database):
        r1 = _run(mock_model_config, mock_drivers_database)
        r2 = _run(mock_model_config, mock_drivers_database)
        assert r1["shift_matrix"] == r2["shift_matrix"]
        assert r1["totals"]["portfolio"] == r2["totals"]["portfolio"]

    def test_different_seed_diverges(self, mock_model_config, mock_drivers_database):
        r1 = _run(mock_model_config, mock_drivers_database, seed=42)
        r2 = _run(mock_model_config, mock_drivers_database, seed=43)
        assert r1["shift_matrix"]["Hair: Color"]["path"][2030]["median"] != \
            r2["shift_matrix"]["Hair: Color"]["path"][2030]["median"]

    def test_driver_order_matters_to_the_draws(self, mock_model_config, mock_drivers_database):
        """The copula pairs draws with drivers by position, so the same seed on a
        reordered driver list gives different numbers. That is why the database
        always returns drivers ordered by id; if this ever stops holding, the
        ordering contract in prism.database.load_drivers can be revisited."""
        reordered = DriverSet(drivers=list(reversed(mock_drivers_database.drivers)))
        r1 = _run(mock_model_config, mock_drivers_database)
        r2 = _run(mock_model_config, reordered)
        assert r1["shift_matrix"]["Hair: Color"]["path"][2030]["median"] != \
            r2["shift_matrix"]["Hair: Color"]["path"][2030]["median"]

    def test_multichain_same_seed_reproduces(self, mock_model_config, mock_drivers_database):
        r1 = MonteCarloEngine(mock_model_config, seed=SEED).run_multichain(
            mock_drivers_database, n_chains=2, iterations=200)
        r2 = MonteCarloEngine(mock_model_config, seed=SEED).run_multichain(
            mock_drivers_database, n_chains=2, iterations=200)
        assert r1["chain_seeds"] == r2["chain_seeds"]
        assert r1["shift_matrix"] == r2["shift_matrix"]


class TestGoldenValues:
    """Seed 42, 500 iterations, terminal year 2030 of the fixture path."""

    PINS = {
        # category:    (median,          p10,             p90)
        "Hair: Color": (-0.004382824607, -0.006560453979, -0.001985604025),
        "Hair: Care":  (-0.004954295760, -0.006740405373, -0.002756923533),
        "LHC: FCN":    (-0.006774214440, -0.008688186306, -0.004155012017),
    }
    #: The joint portfolio band, the number the dashboard headline shows.
    PORTFOLIO_PIN = (-0.005718585254, -0.007619757232, -0.003235896735)

    def test_engine_identity(self, mock_model_config, mock_drivers_database):
        r = _run(mock_model_config, mock_drivers_database)
        assert r["model_version"] == "2.12.0"
        assert r["engine_name"] == "beta_copula"
        assert r["seed"] == SEED
        assert r["numerics_backend"].startswith("scipy ")

    def test_one_version_everywhere(self):
        """The package, the engine and package.json carry the same version."""
        assert prism.__version__ == MonteCarloEngine.MODEL_VERSION
        pkg = json.loads((Path(__file__).resolve().parents[1] / "package.json").read_text())
        assert pkg["version"] == MonteCarloEngine.MODEL_VERSION

    def test_category_values(self, mock_model_config, mock_drivers_database):
        sm = _run(mock_model_config, mock_drivers_database)["shift_matrix"]
        assert max(sm["Hair: Color"]["path"]) == 2030
        for cat, (median, p10, p90) in self.PINS.items():
            cell = sm[cat]["path"][2030]
            assert cell["median"] == pytest.approx(median, rel=1e-6), cat
            assert cell["p10"] == pytest.approx(p10, rel=1e-6), cat
            assert cell["p90"] == pytest.approx(p90, rel=1e-6), cat

    def test_pins_are_distinct(self):
        """Identical pins could not catch two categories being swapped."""
        assert len(set(self.PINS.values())) == len(self.PINS)

    def test_portfolio_band(self, mock_model_config, mock_drivers_database):
        cell = _run(mock_model_config, mock_drivers_database)["totals"]["portfolio"][2030]
        median, p10, p90 = self.PORTFOLIO_PIN
        assert cell["median"] == pytest.approx(median, rel=1e-6)
        assert cell["p10"] == pytest.approx(p10, rel=1e-6)
        assert cell["p90"] == pytest.approx(p90, rel=1e-6)

    def test_no_integrity_events_on_the_defaults(self, mock_model_config, mock_drivers_database):
        """The default correlations are positive definite as entered: any repair,
        clip or floor on the defaults is a regression."""
        assert _run(mock_model_config, mock_drivers_database)["integrity_events"] == []


class TestMultichain:
    def test_seeds(self, mock_model_config, mock_drivers_database):
        r = MonteCarloEngine(mock_model_config, seed=SEED).run_multichain(
            mock_drivers_database, n_chains=3, iterations=200)
        assert r["seed"] == SEED
        assert r["n_chains"] == 3
        assert len(r["chain_seeds"]) == 3 and r["chain_seeds"][0] == SEED

    def test_seed_stability(self, mock_model_config, mock_drivers_database):
        r = MonteCarloEngine(mock_model_config, seed=SEED).run_multichain(
            mock_drivers_database, n_chains=3, iterations=200)
        ss = r["seed_stability"]
        assert ss["metric"] == "terminal_year_portfolio_median"
        assert ss["n_chains"] == 3 and ss["iterations_per_chain"] == 200 and ss["pooled_iterations"] == 600
        assert len(ss["per_chain_medians"]) == 3
        assert ss["spread_pp"] == pytest.approx((max(ss["per_chain_medians"]) - min(ss["per_chain_medians"])) * 100.0)


class TestAttributionIdentities:
    """Each lens partitions the median, so the lens rows add up to the Shift Matrix."""

    @pytest.mark.parametrize("lens", ["force", "vc", "region"])
    def test_lens_reconciles_to_the_median(self, lens, mock_model_config, mock_drivers_database):
        r = _run(mock_model_config, mock_drivers_database)
        for year, by_cat in r["decompositions"][lens].items():
            for cat, row in by_cat.items():
                median = r["shift_matrix"][cat]["path"][int(year)]["median"]
                assert sum(row.values()) == pytest.approx(median, rel=1e-9, abs=1e-12), (lens, cat, year)

    def test_value_chain_lens_is_a_partition_by_epicentre(self, mock_model_config, mock_drivers_database):
        """Each driver's contribution sits wholly on its epicentre stage; every other stage carries 0."""
        r = _run(mock_model_config, mock_drivers_database)
        stages = {vc_epicentre_step_of(d.vc_exposure) for d in mock_drivers_database.drivers}
        assert stages == {"Formulation", "Manufacturing", "Marketing", "Commercial"}
        for year, by_cat in r["decompositions"]["vc"].items():
            for cat, row in by_cat.items():
                median = r["shift_matrix"][cat]["path"][int(year)]["median"]
                for step, value in row.items():
                    if step not in stages:
                        assert value == 0.0, (cat, year, step)
                    elif abs(median) > 1e-15:
                        assert value != 0.0, (cat, year, step)

    def test_unscored_value_chain_is_reported(self, mock_model_config, mock_drivers_database):
        db = copy.deepcopy(mock_drivers_database)
        db.drivers[0].vc_exposure = {}
        r = _run(mock_model_config, db)
        events = [e for e in r["integrity_events"] if e["type"] == "vc_epicentre_coverage"]
        assert len(events) == 1 and events[0]["severity"] == "warning"
        assert db.drivers[0].id in events[0]["message"]
        assert events[0]["detail"]["unscored_driver_ids"] == [db.drivers[0].id]
        for year, by_cat in r["decompositions"]["vc"].items():
            for cat, row in by_cat.items():
                assert sum(row.values()) == pytest.approx(
                    r["shift_matrix"][cat]["path"][int(year)]["median"], rel=1e-9, abs=1e-12)
