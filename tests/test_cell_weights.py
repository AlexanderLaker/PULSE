"""The gross-profit cell weights: the roll-up algebra, the result contract and the estimated default.

The 52 composite cells (13 categories x 4 regions) roll up with a matrix W of
HCB gross-profit shares:

    category shift[c] = sum_r W[c, r] * cell[c, r] / sum_r W[c, r]
    portfolio         = sum_c sum_r W[c, r] * cell[c, r]

The default W is an estimate built from public reporting
(data/calibration/cell_weights_estimate.json); the finance shares replace it
at run time.
"""
import json
import pathlib
import subprocess
import sys

import numpy as np
import pytest

from prism.config import (CATEGORIES, DEFAULT_CELL_WEIGHTS, DEFAULT_CELL_WEIGHTS_SOURCE, REGIONS, ModelConfig,
                          cell_weight_marginals)
from prism.config_validation import validate_model_config
from prism.drivers import Driver, DriverSet
from prism.simulation.bayesian_mc import BayesianMonteCarloEngine

REPO = pathlib.Path(__file__).resolve().parents[1]
RECORD = json.loads((REPO / "data" / "calibration" / "cell_weights_estimate.json").read_text(encoding="utf-8"))
SEED, ITER = 42, 500


def _run(cfg, db, iterations=ITER):
    return BayesianMonteCarloEngine(cfg, seed=SEED).run(db, iterations=iterations)


def _equal_matrix():
    return {c: {r: 1.0 / 52 for r in REGIONS} for c in CATEGORIES}


def _outer(category_weights: dict, region_weights: dict) -> dict:
    total = sum(category_weights.values()) * sum(region_weights.values())
    return {c: {r: category_weights[c] * region_weights[r] / total for r in REGIONS} for c in CATEGORIES}


def _europe_driver(**overrides) -> DriverSet:
    kwargs = dict(id="eu_only", force="Consumer", name="EU only", direction="Contraction", probability=5,
                  start_year=2025, gp1_pct_affected=0.30, peak_year=2028, diffusion_curve="linear",
                  category_exposure={"Hair: Color": 5}, regional_exposure={"Europe": 5},
                  vc_exposure={"Marketing": 5})
    kwargs.update(overrides)
    return DriverSet(drivers=[Driver(**kwargs)])


class TestRollUpAlgebra:
    def test_equal_weights_give_the_plain_mean_of_the_regions(self, mock_model_config, mock_drivers_database):
        eng = BayesianMonteCarloEngine(mock_model_config.copy_with(cell_weights=_equal_matrix()), seed=SEED)
        cat_s, reg_s = eng._simulate_samples(mock_drivers_database, ITER)
        assert np.allclose(cat_s, reg_s.mean(axis=2), atol=1e-15)

    def test_a_separable_matrix_gives_the_region_weighted_mean(self, mock_model_config, mock_drivers_database):
        """With W = category weights x region weights, every category is the
        region-weighted mean of its cells, iteration by iteration."""
        rw = {"Europe": 0.38, "North America": 0.26, "Asia": 0.17, "High Growth": 0.19}
        W = _outer({c: 1.0 for c in CATEGORIES}, rw)
        eng = BayesianMonteCarloEngine(mock_model_config.copy_with(cell_weights=W), seed=SEED)
        cat_s, reg_s = eng._simulate_samples(mock_drivers_database, ITER)
        weights = np.array([rw[r] for r in REGIONS])
        assert np.allclose(cat_s, (reg_s * weights[None, None, :, None]).sum(axis=2), atol=1e-15)

    def test_the_estimate_actually_weights(self, mock_model_config, mock_drivers_database):
        cat_s, reg_s = BayesianMonteCarloEngine(mock_model_config, seed=SEED)._simulate_samples(
            mock_drivers_database, ITER)
        assert not np.allclose(cat_s, reg_s.mean(axis=2), atol=1e-9)

    def test_a_zero_share_cell_contributes_nothing(self, mock_model_config):
        """A Europe-only driver in a category whose European share is zero moves
        neither the category nor the portfolio, although its cell moves."""
        W = _equal_matrix()
        W["Hair: Color"]["Europe"] = 0.0
        W["Hair: Color"]["North America"] = 2.0 / 52
        r = _run(mock_model_config.copy_with(cell_weights=W), _europe_driver(), iterations=300)
        assert r["shift_matrix"]["Hair: Color"]["path"][2030]["median"] == 0.0
        assert r["totals"]["portfolio"][2030]["median"] == 0.0
        assert r["regional_shift_matrix"]["Hair: Color"]["Europe"]["path"][2030]["median"] < 0

    def test_a_category_held_in_one_region_is_that_cell(self, mock_model_config):
        W = {c: {r: 0.0 for r in REGIONS} for c in CATEGORIES}
        W["Hair: Color"]["Europe"] = 0.6
        W["Hair: Care"]["Asia"] = 0.4
        db = _europe_driver(probability=4, gp1_pct_affected=0.20, regional_exposure={"Europe": 5, "Asia": 3})
        r = _run(mock_model_config.copy_with(cell_weights=W), db, iterations=300)
        category = r["shift_matrix"]["Hair: Color"]["path"][2030]
        cell = r["regional_shift_matrix"]["Hair: Color"]["Europe"]["path"][2030]
        assert category["median"] == pytest.approx(cell["median"], abs=1e-15)
        assert category["p10"] == pytest.approx(cell["p10"], abs=1e-15)
        assert r["category_weights_used"]["Hair: Color"] == pytest.approx(0.6)
        assert r["totals"]["portfolio"][2030]["median"] == pytest.approx(0.6 * category["median"], abs=1e-15)
        zero_rows = [e for e in r["integrity_events"] if e["type"] == "cell_weight_zero_row"]
        assert len(zero_rows) == 1 and "Hair: Styling" in zero_rows[0]["detail"]["categories"]

    def test_marginals_are_row_and_column_sums(self, mock_model_config, mock_drivers_database):
        W = _equal_matrix()
        W["Hair: Color"].update({"Europe": 3.0 / 52, "Asia": 0.0, "High Growth": 0.0})
        r = _run(mock_model_config.copy_with(cell_weights=W), mock_drivers_database, iterations=200)
        rw, cw = cell_weight_marginals(W)
        for region in REGIONS:
            assert r["region_weights_used"][region] == pytest.approx(rw[region])
        for cat in CATEGORIES:
            assert r["category_weights_used"][cat] == pytest.approx(cw[cat])


class TestContract:
    def test_the_result_carries_the_weights_it_used(self, mock_model_config, mock_drivers_database):
        r = _run(mock_model_config, mock_drivers_database, iterations=200)
        assert set(r["cell_weights_used"]) == set(CATEGORIES)
        assert all(set(row) == set(REGIONS) for row in r["cell_weights_used"].values())
        assert sum(sum(row.values()) for row in r["cell_weights_used"].values()) == pytest.approx(1.0)
        assert r["cell_weights_source"] == DEFAULT_CELL_WEIGHTS_SOURCE

    def test_multichain_carries_them_too(self, mock_model_config, mock_drivers_database):
        r = BayesianMonteCarloEngine(mock_model_config, seed=SEED).run_multichain(
            mock_drivers_database, n_chains=2, iterations=150)
        assert r["cell_weights_used"]["LHC: IC"]["High Growth"] == pytest.approx(RECORD["cells"]["LHC: IC"]["High Growth"])
        assert r["category_weights_used"]["LHC: IC"] == pytest.approx(RECORD["marginals"]["category"]["LHC: IC"])


class TestModelConfig:
    def test_the_default_is_the_estimate(self):
        cfg = ModelConfig()
        assert cfg.cell_weights == DEFAULT_CELL_WEIGHTS
        for region in REGIONS:
            assert cfg.region_weights[region] == pytest.approx(RECORD["marginals"]["region"][region])
        for cat in CATEGORIES:
            assert cfg.category_weights[cat] == pytest.approx(RECORD["marginals"]["category"][cat])

    def test_marginals_follow_a_new_matrix(self):
        W = _equal_matrix()
        W["LHC: FCN"].update({"Europe": 5.0 / 52, "Asia": 0.0, "High Growth": 0.0})
        W["Hair: Color"].update({"Europe": 0.0, "Asia": 0.0})
        cfg = ModelConfig().copy_with(cell_weights=W)
        assert cfg.category_weights["LHC: FCN"] == pytest.approx(6.0 / 52)
        assert cfg.region_weights["Europe"] == pytest.approx(sum(W[c]["Europe"] for c in CATEGORIES))

    def test_marginals_cannot_be_set_directly(self):
        with pytest.raises(TypeError):
            ModelConfig(region_weights={"Europe": 1.0})
        with pytest.raises(TypeError):
            ModelConfig().copy_with(category_weights={})

    def test_the_validator_rejects_bad_grids(self):
        validate_model_config(ModelConfig())
        bad_grids = [
            {c: {r: 0.0 for r in REGIONS} for c in CATEGORIES},              # sums to 0
            {c: {r: 1.0 / 48 for r in REGIONS} for c in CATEGORIES[:-1]},    # a category missing
            {**_equal_matrix(), "Hair: Color": {**_equal_matrix()["Hair: Color"], "Europe": -0.01}},
            {**_equal_matrix(), "Hair: Color": {**_equal_matrix()["Hair: Color"], "Mars": 0.0}},
        ]
        for grid in bad_grids:
            with pytest.raises(ValueError):
                validate_model_config(ModelConfig().copy_with(cell_weights=grid))


class TestEstimatedMix:
    """The literal in prism/config.py, the record and the generator are three copies of one thing."""

    def test_the_literal_matches_the_record(self):
        assert set(DEFAULT_CELL_WEIGHTS) == set(CATEGORIES)
        for c in CATEGORIES:
            for r in REGIONS:
                assert DEFAULT_CELL_WEIGHTS[c][r] == pytest.approx(RECORD["cells"][c][r], abs=1e-12), (c, r)

    def test_the_source_text_is_the_records(self):
        assert DEFAULT_CELL_WEIGHTS_SOURCE == RECORD["source"]
        assert DEFAULT_CELL_WEIGHTS_SOURCE.startswith("ESTIMATE, not Henkel P&L")

    def test_the_generator_reproduces_both_outputs(self):
        out = subprocess.run([sys.executable, str(REPO / "scripts" / "build_cell_weights.py"), "--check"],
                             capture_output=True, text=True, cwd=str(REPO))
        assert out.returncode == 0, out.stdout + out.stderr

    def test_config_holds_the_generated_literal(self):
        out = subprocess.run([sys.executable, str(REPO / "scripts" / "build_cell_weights.py"), "--emit-python"],
                             capture_output=True, text=True, cwd=str(REPO), check=True)
        assert out.stdout.strip() in (REPO / "prism" / "config.py").read_text(encoding="utf-8")

    def test_shares_add_up_to_one(self):
        values = [v for row in DEFAULT_CELL_WEIGHTS.values() for v in row.values()]
        assert sum(values) == pytest.approx(1.0, abs=1e-9) and min(values) >= 0

    def test_the_matrix_is_not_separable(self):
        """Each category has its own regional mix. If the matrix ever equals the
        product of its marginals, the regional mix has been flattened."""
        rw, cw = cell_weight_marginals(DEFAULT_CELL_WEIGHTS)
        outer = _outer(cw, rw)
        assert max(abs(DEFAULT_CELL_WEIGHTS[c][r] - outer[c][r]) for c in CATEGORIES for r in REGIONS) > 1e-3

    def test_every_input_is_graded(self):
        inputs, grades = RECORD["inputs"], set(RECORD["grade_legend"])
        assert grades == {"B", "E", "G"} and inputs["block_split"]["grade"] in grades
        for c in CATEGORIES:
            assert inputs["category_mix"][c]["grade"] in grades and inputs["category_mix"][c]["note"].strip()
            assert inputs["margin_index"][c]["grade"] in grades
            assert inputs["region_mix"][c]["grade"] in grades and inputs["region_mix"][c]["note"].strip()

    def test_the_published_inputs_reproduce_the_cells(self):
        """The derivation shown on the dashboard is the one that produced the numbers."""
        inputs = RECORD["inputs"]
        blocks = {"LHC": inputs["block_split"]["LHC"], "Hair & Body": inputs["block_split"]["Hair & Body"]}
        raw = {}
        for c in CATEGORIES:
            mix = inputs["category_mix"][c]
            gp = mix["share_of_block"] * blocks[mix["block"]] * inputs["margin_index"][c]["index"]
            raw[c] = {r: gp * inputs["region_mix"][c]["mix"][r] for r in REGIONS}
        total = sum(v for row in raw.values() for v in row.values())
        for c in CATEGORIES:
            for r in REGIONS:
                assert raw[c][r] / total == pytest.approx(DEFAULT_CELL_WEIGHTS[c][r], abs=1e-8), (c, r)
