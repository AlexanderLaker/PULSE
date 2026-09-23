"""The Monte Carlo engine: result shape, statistics and the model mechanics."""
import numpy as np
import pytest

from prism.config import CATEGORIES, REGIONS
from prism.drivers import Driver, DriverSet
from prism.simulation.bayesian_mc import BayesianMonteCarloEngine


def _single_driver_db(regional, cat="Hair: Color", cat_exp=5, prob=4, gp1=0.10, direction="Contraction",
                      peak_year=2026, curve="linear", start_year=2025):
    d = Driver(id="d1", force="Consumer", direction=direction, gp1_pct_affected=gp1, probability=prob,
               peak_year=peak_year, diffusion_curve=curve, start_year=start_year)
    d.category_exposure = {cat: cat_exp}
    d.regional_exposure = dict(zip(REGIONS, regional))
    return DriverSet(drivers=[d])


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
                assert set(cell) == {"p10", "p25", "median", "p75", "p90", "mean", "std"}, (cat, year)

    def test_percentiles_are_ordered(self, mock_model_config, mock_drivers_database):
        cfg = mock_model_config.copy_with(iterations=500)
        sm = BayesianMonteCarloEngine(cfg).run(mock_drivers_database)["shift_matrix"]
        for cat in CATEGORIES:
            for year in cfg.path_years:
                c = sm[cat]["path"][year]
                assert c["p10"] <= c["p25"] <= c["median"] <= c["p75"] <= c["p90"], (cat, year)
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
        empty = BayesianMonteCarloEngine(cfg).run(DriverSet())
        assert all(empty["shift_matrix"][c]["path"][2030]["median"] == 0.0 for c in CATEGORIES)
        single = BayesianMonteCarloEngine(cfg).run(
            DriverSet(drivers=[mock_driver]))
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

    def test_the_region_lens_counts_a_driver_without_regions_everywhere(self, mock_model_config):
        """The lens follows the shift: present in every region, so the category's
        attribution splits by the category's own regional gross-profit mix."""
        r = BayesianMonteCarloEngine(self._cfg(mock_model_config)).run(_single_driver_db([0, 0, 0, 0]))
        row = r["cell_weights_used"]["Hair: Color"]
        lens = r["decompositions"]["region"][2030]["Hair: Color"]
        median = r["shift_matrix"]["Hair: Color"]["path"][2030]["median"]
        for region in REGIONS:
            assert lens[region] == pytest.approx(median * row[region] / sum(row.values()), rel=1e-9)


class TestDriverChecks:
    """A driver the engine would read with a silent default is refused before any draw."""

    @pytest.mark.parametrize("change, words", [
        ({"force": "Weather"}, "unknown force"),
        ({"direction": "Sideways"}, "neither Expansion nor Contraction"),
        ({"gp1_pct_affected": None}, "gp1_pct_affected None"),
        ({"gp1_pct_affected": float("nan")}, "gp1_pct_affected nan"),
        ({"gp1_pct_affected": 1.5}, "gp1_pct_affected 1.5"),
        ({"probability": 6}, "probability 6"),
        ({"probability": None}, "probability None"),
        ({"uncertainty": 9}, "uncertainty 9"),
        ({"diffusion_curve": "exponential"}, "unknown diffusion curve"),
        ({"category_exposure": {"Hair: Colour": 3}}, "not in the taxonomy"),
        ({"regional_exposure": {"Europe": 7}}, "is not a whole number from 0 to 5"),
    ])
    def test_the_engine_refuses_it(self, mock_model_config, change, words):
        from prism.drivers import InvalidDriversError
        db = _single_driver_db([5, 3, 2, 2])
        for name, value in change.items():
            setattr(db.drivers[0], name, value)
        with pytest.raises(InvalidDriversError, match=words):
            BayesianMonteCarloEngine(mock_model_config).run(db)

    def test_every_problem_is_listed(self):
        from prism.drivers import simulation_problems
        a = Driver(id="a", force="Weather", direction="Up", probability=0, gp1_pct_affected=0)
        b = Driver(id="a", force="Consumer", gp1_pct_affected=0.1)
        problems = simulation_problems([a, b])
        assert problems[0] == "driver id 'a' appears 2 times" and len(problems) == 5

    def test_the_driver_base_passes(self):
        from prism.drivers import simulation_problems
        from prism.seed_drivers import get_seed_drivers
        assert simulation_problems(get_seed_drivers()) == []


class TestOverlapDampening:
    def test_a_small_tailwind_never_worsens_the_outlook(self, mock_model_config):
        """The within-force dampening uses the magnitude-weighted effective number
        of drivers, so adding a negligible favourable driver cannot lower the shift."""
        cfg = mock_model_config.copy_with(iterations=20000, peak_year_jitter=0)
        big = _global_driver("big", "Expansion", 0.20, 4)
        tiny = _global_driver("tiny", "Expansion", 0.005, 5, exposure=1)
        alone = BayesianMonteCarloEngine(cfg, seed=42).run(
            DriverSet(drivers=[big]))
        both = BayesianMonteCarloEngine(cfg, seed=42).run(
            DriverSet(drivers=[big, tiny]))
        m1 = alone["shift_matrix"]["Hair: Color"]["path"][2030]["median"]
        m2 = both["shift_matrix"]["Hair: Color"]["path"][2030]["median"]
        assert m2 >= m1 - 1e-9, (m1, m2)


class TestTiming:
    def _db(self):
        return DriverSet(drivers=[_global_driver("j", "Contraction", 0.20, 4)])

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
    def test_floored_factors_are_counted_over_every_chain(self, mock_model_config):
        """The count depends on the draws, so the pooled run reports the sum over its chains."""
        # Three strong Consumer headwinds, undamped by attenuation or force weight,
        # remove more than a whole cell in a varying share of the draws.
        cfg = mock_model_config.copy_with(per_force_attenuation={f: 1.0 for f in mock_model_config.per_force_attenuation},
                                          force_weights={f: (1.0 if f == "Consumer" else 0.0)
                                                         for f in mock_model_config.force_weights})
        db = DriverSet(drivers=[_global_driver(f"d{i}", "Contraction", 0.40, 5) for i in range(3)])
        for d in db.drivers:
            d.peak_year, d.diffusion_curve = 2026, "linear"
        seeds = [7, 8, 9]
        counts = []
        for seed in seeds:
            engine = BayesianMonteCarloEngine(cfg, seed=seed)
            engine._simulate_samples(db, 300)
            counts.append(engine._floored_factor_cells)
        assert min(counts) > 0 and len(set(counts)) > 1
        pooled = BayesianMonteCarloEngine(cfg, seed=7).run_multichain(db, n_chains=3, iterations=300, seeds=seeds)
        [event] = [e for e in pooled["integrity_events"] if e["type"] == "compounding_floor"]
        assert event["detail"]["count"] == sum(counts)
        single = BayesianMonteCarloEngine(cfg, seed=7).run(db, iterations=300)
        [event] = [e for e in single["integrity_events"] if e["type"] == "compounding_floor"]
        assert event["detail"]["count"] == counts[0]

    def test_chains_are_pooled(self, mock_model_config, mock_drivers_database):
        r = BayesianMonteCarloEngine(mock_model_config, seed=42).run_multichain(
            mock_drivers_database, n_chains=3, iterations=400)
        assert r["seed_stability"]["pooled_iterations"] == 1200
        assert r["iterations"] == 1200
        assert r["mc_standard_error"]["Hair: Color"]["n"] == 1200
        assert "regional_shift_matrix" in r and "cell_weights_used" in r
