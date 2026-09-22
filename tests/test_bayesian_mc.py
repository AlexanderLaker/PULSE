"""The Monte Carlo engine: result shape, statistics and the model mechanics."""
import numpy as np
import pytest

from prism.config import CATEGORIES, FORCES, REGIONS
from prism.drivers import Driver, DriverSet
from prism.simulation.bayesian_mc import BayesianMonteCarloEngine


def _single_driver_db(regional, cat="Hair: Color", cat_exp=5, prob=4, gp1=0.10, direction="Contraction",
                      peak_year=2026, curve="linear", start_year=2025):
    d = Driver(id="d1", force="Consumer", direction=direction, gp1_pct_affected=gp1, probability=prob,
               peak_year=peak_year, diffusion_curve=curve, start_year=start_year)
    d.category_exposure = {cat: cat_exp}
    d.regional_exposure = dict(zip(REGIONS, regional))
    return DriverSet(drivers=[d], categories=list(CATEGORIES), forces=list(FORCES))


def _global_driver(id_, direction, gp1, probability, exposure=5):
    d = Driver(id=id_, force="Consumer", direction=direction, gp1_pct_affected=gp1, probability=probability,
               peak_year=2028, diffusion_curve="s_curve", start_year=2025)
    d.category_exposure = {"Hair: Color": exposure}
    d.regional_exposure = dict(zip(REGIONS, [5, 5, 5, 5]))
    return d


class TestResultShape:
    def test_every_category_year_and_percentile(self, mock_model_config, mock_drivers_database):
        cfg = mock_model_config.copy_with(iterations=200)
        sm = BayesianMonteCarloEngine(cfg).run(mock_drivers_database)["shift_matrix"]
        assert list(sm) == list(CATEGORIES)
        for cat in CATEGORIES:
            for year in cfg.path_years:
                cell = sm[cat]["path"][year]
                for key in ("p10", "p25", "p50", "median", "p75", "p90", "mean", "std"):
                    assert key in cell, (cat, year, key)

    def test_percentiles_are_ordered(self, mock_model_config, mock_drivers_database):
        cfg = mock_model_config.copy_with(iterations=500)
        sm = BayesianMonteCarloEngine(cfg).run(mock_drivers_database)["shift_matrix"]
        for cat in CATEGORIES:
            for year in cfg.path_years:
                c = sm[cat]["path"][year]
                assert c["p10"] <= c["p25"] <= c["p50"] <= c["p75"] <= c["p90"], (cat, year)
                assert c["std"] >= 0

    def test_raw_samples(self, mock_model_config, mock_drivers_database):
        cfg = mock_model_config.copy_with(iterations=100)
        r = BayesianMonteCarloEngine(cfg).run(mock_drivers_database)
        assert r["raw_samples"].shape == (100, len(CATEGORIES), len(cfg.path_years))

    def test_iterations_override(self, mock_model_config, mock_drivers_database):
        engine = BayesianMonteCarloEngine(mock_model_config.copy_with(iterations=100))
        assert engine.run(mock_drivers_database, iterations=50)["iterations"] == 50
        assert engine.run(mock_drivers_database, iterations=200)["iterations"] == 200

    def test_empty_and_single_driver_sets(self, mock_model_config, mock_driver):
        cfg = mock_model_config.copy_with(iterations=100)
        empty = BayesianMonteCarloEngine(cfg).run(DriverSet(categories=list(CATEGORIES)))
        assert all(empty["shift_matrix"][c]["path"][2030]["median"] == 0.0 for c in CATEGORIES)
        single = BayesianMonteCarloEngine(cfg).run(
            DriverSet(drivers=[mock_driver], categories=list(CATEGORIES), forces=["Consumer"]))
        assert set(single["shift_matrix"]) == set(CATEGORIES)


class TestSampling:
    def test_band_is_a_population_quantity(self, mock_model_config, mock_drivers_database):
        """More iterations estimate the P10-P90 band more precisely; they do not
        narrow it. Two estimates must agree loosely and neither may be degenerate."""
        c100 = BayesianMonteCarloEngine(mock_model_config.copy_with(iterations=100)).run(
            mock_drivers_database)["shift_matrix"]["Hair: Color"]["path"][2030]
        c500 = BayesianMonteCarloEngine(mock_model_config.copy_with(iterations=500)).run(
            mock_drivers_database)["shift_matrix"]["Hair: Color"]["path"][2030]
        w100, w500 = c100["p90"] - c100["p10"], c500["p90"] - c500["p10"]
        assert w100 > 0 and w500 > 0
        assert 0.5 < w500 / w100 < 2.0

    def test_monte_carlo_standard_error(self, mock_model_config, mock_drivers_database):
        r = BayesianMonteCarloEngine(mock_model_config.copy_with(iterations=500)).run(mock_drivers_database)
        for cat in CATEGORIES:
            se = r["mc_standard_error"][cat]
            assert min(se["median_se_pp"], se["p10_se_pp"], se["p90_se_pp"]) >= 0.0
            assert se["method"] == "bootstrap_terminal_year" and se["n"] == 500

    def test_correlation_matrix_is_a_valid_correlation_matrix(self, mock_model_config, mock_drivers_database):
        R = BayesianMonteCarloEngine(mock_model_config)._build_correlation_matrix(mock_drivers_database.drivers)
        assert np.allclose(R, R.T)
        assert np.allclose(np.diag(R), 1.0)
        assert np.linalg.eigvalsh(R).min() > 0

    def test_priors_come_from_the_scores(self, mock_drivers_database):
        """probability_prior is set from the 1-5 score (mean p/6); nothing updates it from data."""
        for d in mock_drivers_database.drivers:
            a, b = d.probability_prior
            assert a / (a + b) == pytest.approx(d.probability / 6)


class TestRegionalShift:
    """The shift is solved per (category, region) cell and rolled up with the cell weights."""

    def _cfg(self, mock_model_config):
        return mock_model_config.copy_with(iterations=4000, peak_year_jitter=0)

    def test_weights_used(self, mock_model_config, mock_drivers_database):
        r = BayesianMonteCarloEngine(self._cfg(mock_model_config)).run(mock_drivers_database)
        assert set(r["region_weights_used"]) == set(REGIONS)
        assert sum(r["region_weights_used"].values()) == pytest.approx(1.0, abs=1e-9)
        for cat in CATEGORIES:
            assert set(r["regional_shift_matrix"][cat]) == set(REGIONS)
            assert 2030 in r["regional_shift_matrix"][cat]["Europe"]["path"]

    def test_a_global_driver_moves_every_region_alike(self, mock_model_config):
        """Full regional exposure everywhere gives identical cells, so the
        category roll-up equals that common value whatever the weights."""
        r = BayesianMonteCarloEngine(self._cfg(mock_model_config)).run(_single_driver_db([5, 5, 5, 5]))
        rsm = r["regional_shift_matrix"]["Hair: Color"]
        europe = rsm["Europe"]["path"][2030]["median"]
        for region in REGIONS:
            assert rsm[region]["path"][2030]["median"] == pytest.approx(europe, rel=1e-9)
        assert r["shift_matrix"]["Hair: Color"]["path"][2030]["median"] == pytest.approx(europe, rel=1e-9)

    def test_a_regional_driver_scales_by_its_share_of_the_row(self, mock_model_config):
        """A Europe-only driver moves only Europe's cell, and the category moves by
        Europe's share of that category's row (not the portfolio-wide Europe share:
        each category has its own regional mix)."""
        r = BayesianMonteCarloEngine(self._cfg(mock_model_config)).run(_single_driver_db([5, 0, 0, 0]))
        rsm = r["regional_shift_matrix"]["Hair: Color"]
        assert rsm["Asia"]["path"][2030]["median"] == pytest.approx(0.0, abs=1e-12)
        row = r["cell_weights_used"]["Hair: Color"]
        share = row["Europe"] / sum(row.values())
        assert r["shift_matrix"]["Hair: Color"]["path"][2030]["median"] == pytest.approx(
            share * rsm["Europe"]["path"][2030]["median"], rel=1e-9)

    def test_only_the_scored_category_moves(self, mock_model_config):
        sm = BayesianMonteCarloEngine(self._cfg(mock_model_config)).run(_single_driver_db([5, 3, 2, 2]))["shift_matrix"]
        assert sm["Hair: Color"]["path"][2030]["median"] != 0.0
        for cat in CATEGORIES:
            if cat != "Hair: Color":
                assert sm[cat]["path"][2030]["median"] == pytest.approx(0.0, abs=1e-12)

    def test_a_driver_without_regions_is_global_and_reported(self, mock_model_config):
        r = BayesianMonteCarloEngine(self._cfg(mock_model_config)).run(_single_driver_db([0, 0, 0, 0]))
        events = [e for e in r["integrity_events"] if e["type"] == "regional_exposure_coverage"]
        assert len(events) == 1 and events[0]["severity"] == "warning"
        assert events[0]["detail"]["driver_ids"] == ["d1"]


class TestOverlapDampening:
    def test_a_small_tailwind_never_worsens_the_outlook(self, mock_model_config):
        """The within-force dampening uses the magnitude-weighted effective number
        of drivers, so adding a negligible favourable driver cannot lower the shift."""
        cfg = mock_model_config.copy_with(iterations=20000, peak_year_jitter=0)
        big = _global_driver("big", "Expansion", 0.20, 4)
        tiny = _global_driver("tiny", "Expansion", 0.005, 5, exposure=1)
        alone = BayesianMonteCarloEngine(cfg, seed=42).run(
            DriverSet(drivers=[big], categories=list(CATEGORIES), forces=list(FORCES)))
        both = BayesianMonteCarloEngine(cfg, seed=42).run(
            DriverSet(drivers=[big, tiny], categories=list(CATEGORIES), forces=list(FORCES)))
        m1 = alone["shift_matrix"]["Hair: Color"]["path"][2030]["median"]
        m2 = both["shift_matrix"]["Hair: Color"]["path"][2030]["median"]
        assert m2 >= m1 - 1e-9, (m1, m2)


class TestTiming:
    def _db(self):
        return DriverSet(drivers=[_global_driver("j", "Contraction", 0.20, 4)],
                         categories=list(CATEGORIES), forces=list(FORCES))

    def test_peak_year_jitter_widens_the_velocity_band(self, mock_model_config):
        base = mock_model_config.copy_with(iterations=20000)
        off = BayesianMonteCarloEngine(base.copy_with(peak_year_jitter=0), seed=7).run(self._db())
        on = BayesianMonteCarloEngine(base.copy_with(peak_year_jitter=1), seed=7).run(self._db())

        def width(r):
            v = r["shift_matrix"]["Hair: Color"]["velocity"][2029]
            return v["p90"] - v["p10"]
        assert width(on) > width(off)

    def test_jitter_is_reproducible_under_seed(self, mock_model_config):
        cfg = mock_model_config.copy_with(iterations=3000, peak_year_jitter=1)
        r1 = BayesianMonteCarloEngine(cfg, seed=11).run(self._db())
        r2 = BayesianMonteCarloEngine(cfg, seed=11).run(self._db())
        assert r1["shift_matrix"] == r2["shift_matrix"]

    def test_nothing_materialises_before_the_start_year(self, mock_model_config):
        cfg = mock_model_config.copy_with(iterations=2000, peak_year_jitter=0)
        db = _single_driver_db([5, 5, 5, 5], prob=5, gp1=0.20, peak_year=2030, start_year=2028)
        path = BayesianMonteCarloEngine(cfg, seed=1).run(db)["shift_matrix"]["Hair: Color"]["path"]
        for year in (2026, 2027, 2028):
            assert path[year]["median"] == pytest.approx(0.0, abs=1e-12)
        assert path[2030]["median"] < 0.0


class TestMultichainPooling:
    def test_chains_are_pooled(self, mock_model_config, mock_drivers_database):
        r = BayesianMonteCarloEngine(mock_model_config, seed=42).run_multichain(
            mock_drivers_database, n_chains=3, iterations=400)
        assert r["seed_stability"]["pooled_iterations"] == 1200
        assert r["iterations"] == 1200
        assert r["mc_standard_error"]["Hair: Color"]["n"] == 1200
        assert "regional_shift_matrix" in r and "cell_weights_used" in r
