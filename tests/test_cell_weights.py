"""Cell-level gross-profit weights (2.11.0, owner ruling O6).

The 48 composite cells (12 categories × 4 regions) are rolled up with a
12 × 4 matrix of HCB gross-profit SHARES (config.cell_weights):

    category shift[c] = Σ_r W[c, r] · cell[c, r] / Σ_r W[c, r]
    portfolio         = Σ_c Σ_r W[c, r] · cell[c, r]

Four locks:
  1. REGRESSION vs 2.10.0: with the separable Group-split matrix (the 2.10.0
     region_weights × equal category_weights) the 2.11.0 engine reproduces
     the 2.10.0 fixture run — category cells, portfolio band, velocity bands
     (jitter ON, so the per-trend inverse-CDF jitter draw is proven
     bit-compatible with the 2.10.0 rng.choice stream) and the region lens.
     The reference values below were generated on the 2.10.0 code
     (commit 9fac233, seed 42, 500 iterations, conftest fixtures).
  2. ALGEBRA: equal weights = plain mean over regions; a cell with share 0
     contributes nothing however large its mechanism score; the portfolio is
     the row-sum-weighted mean of the category shifts per iteration.
  3. CONTRACT: cell_weights_used / category_weights_used / region_weights_used
     (column sums) / cell_weights_source are present and consistent.
  4. CONFIG: validator rules, legacy outer-product construction, consistency
     rejection, zero-row integrity event.
"""

import json

import numpy as np
import pytest

from pulse.config import (ModelConfig, CATEGORIES, REGIONS, cell_weights_outer,
                          cell_weight_marginals, DEFAULT_CELL_WEIGHTS)
from pulse.config_validation import validate_model_config
from pulse.ingestion.models import Trend, TrendDatabase
from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine

SEED, ITER = 42, 500
GROUP_SPLIT_2_10_0 = {"Europe": 0.38, "North America": 0.26, "Asia": 0.17, "High Growth": 0.19}
# The 2.10.0 code defaults the reference was generated with. 2.11.0 ships the
# v3.11 calibration on the 51-driver base (O11), so the regression pins the
# calibration the 2.10.0 run used: the v3.5 per-force attenuation and the
# within-force overlap values that stood in config.py at 2.10.0.
CALIBRATION_2_10_0 = dict(
    per_force_attenuation={"Consumer": 0.495, "Customer": 0.401, "Technology": 0.434,
                           "Government": 0.415, "Environmental": 0.418, "Competitive": 0.479},
    within_force_overlap={"Consumer": 0.100, "Customer": 0.157, "Technology": 0.232,
                          "Government": 0.426, "Environmental": 0.269, "Competitive": 0.100},
    attenuation_source="calibrated_v3.5_april2026",
)


def _cfg_2_10_0(mock_model_config, **overrides):
    return mock_model_config.copy_with(**CALIBRATION_2_10_0).copy_with(**overrides)

REF_2_10_0_JITTER0 = {
    "Hair: Color": (-3.365458543531549e-03, -5.207021041695161e-03, -1.350259624656636e-03),
    "Hair: Care": (-4.405135395128336e-03, -6.105482349282381e-03, -2.398520911810419e-03),
    "Hair: Styling": (-2.721488124924469e-03, -4.073395952958414e-03, -1.274776967913083e-03),
    "Hair: Body": (-2.721488124924469e-03, -4.073395952958414e-03, -1.274776967913083e-03),
    "LHC: FCN": (-5.469456519491303e-03, -7.019692993929625e-03, -3.314337205341307e-03),
    "LHC: FCA": (-5.469456519491303e-03, -7.019692993929625e-03, -3.314337205341307e-03),
    "LHC: FFI": (-5.469456519491303e-03, -7.019692993929625e-03, -3.314337205341307e-03),
    "LHC: LAD": (-5.469456519491303e-03, -7.019692993929625e-03, -3.314337205341307e-03),
    "LHC: HDW": (-5.469456519491303e-03, -7.019692993929625e-03, -3.314337205341307e-03),
    "LHC: ADW": (-5.469456519491303e-03, -7.019692993929625e-03, -3.314337205341307e-03),
    "LHC: HSC": (-5.469456519491303e-03, -7.019692993929625e-03, -3.314337205341307e-03),
    "LHC: IC": (-5.469456519491303e-03, -7.019692993929625e-03, -3.314337205341307e-03),
}
REF_2_10_0_PORTFOLIO_JITTER0 = (-4.730794485593501e-03, -6.328294549429530e-03, -2.752637701027296e-03)
REF_2_10_0_VELOCITY_HAIR_COLOR_JITTER1 = {
    2027: (-2.101834222456705e-03, -4.922323121143297e-03, -1.759152263054388e-04),
    2028: (-2.113514913933242e-03, -3.729543741751812e-03, 3.205209281568727e-04),
    2029: (2.872177009751219e-04, -2.657768360376410e-04, 6.019030586755661e-04),
    2030: (3.463737252919650e-04, 5.888376735593933e-05, 5.855245597150231e-04),
}
REF_2_10_0_REGION_LENS_LAST_JITTER0 = {
    "Hair: Color": {"Europe": -1.819337244846342e-03, "North America": -8.646582304532884e-04, "Asia": -3.192297545125120e-04, "High Growth": -3.622333137194064e-04},
    "Hair: Care": {"Europe": -2.372794745001396e-03, "North America": -1.144723243766574e-03, "Asia": -4.154259909194007e-04, "High Growth": -4.721914154409653e-04},
    "Hair: Styling": {"Europe": -1.463415075425156e-03, "North America": -6.907184342994297e-04, "Asia": -2.763666754917925e-04, "High Growth": -2.909879397080908e-04},
    "Hair: Body": {"Europe": -1.463415075425156e-03, "North America": -6.907184342994297e-04, "Asia": -2.763666754917925e-04, "High Growth": -2.909879397080908e-04},
    "LHC: FCN": {"Europe": -2.932877448147535e-03, "North America": -1.441224985675859e-03, "Asia": -5.120698550201151e-04, "High Growth": -5.832842306477953e-04},
    "LHC: FCA": {"Europe": -2.932877448147535e-03, "North America": -1.441224985675859e-03, "Asia": -5.120698550201151e-04, "High Growth": -5.832842306477953e-04},
    "LHC: FFI": {"Europe": -2.932877448147535e-03, "North America": -1.441224985675859e-03, "Asia": -5.120698550201151e-04, "High Growth": -5.832842306477953e-04},
    "LHC: LAD": {"Europe": -2.932877448147535e-03, "North America": -1.441224985675859e-03, "Asia": -5.120698550201151e-04, "High Growth": -5.832842306477953e-04},
    "LHC: HDW": {"Europe": -2.932877448147535e-03, "North America": -1.441224985675859e-03, "Asia": -5.120698550201151e-04, "High Growth": -5.832842306477953e-04},
    "LHC: ADW": {"Europe": -2.932877448147535e-03, "North America": -1.441224985675859e-03, "Asia": -5.120698550201151e-04, "High Growth": -5.832842306477953e-04},
    "LHC: HSC": {"Europe": -2.932877448147535e-03, "North America": -1.441224985675859e-03, "Asia": -5.120698550201151e-04, "High Growth": -5.832842306477953e-04},
    "LHC: IC": {"Europe": -2.932877448147535e-03, "North America": -1.441224985675859e-03, "Asia": -5.120698550201151e-04, "High Growth": -5.832842306477953e-04},
}


def _run(cfg, db, iterations=ITER, seed=SEED):
    return BayesianMonteCarloEngine(cfg, seed=seed).run(db, iterations=iterations)


def _equal_matrix():
    return {c: {r: 1.0 / 48 for r in REGIONS} for c in CATEGORIES}


class TestRegressionAgainst2_10_0:
    """The separable Group-split matrix must reproduce the 2.10.0 numbers."""

    def test_separable_matrix_reproduces_2_10_0_cells_and_portfolio(self, mock_model_config, mock_trends_database):
        cfg = _cfg_2_10_0(mock_model_config, region_weights=dict(GROUP_SPLIT_2_10_0))
        assert cfg.cell_weights["Hair: Color"]["Europe"] == pytest.approx(0.38 / 12)
        r = _run(cfg, mock_trends_database)
        ly = max(r["shift_matrix"]["Hair: Color"]["path"].keys())
        for cat, (med, p10, p90) in REF_2_10_0_JITTER0.items():
            cell = r["shift_matrix"][cat]["path"][ly]
            assert cell["median"] == pytest.approx(med, abs=1e-12), cat
            assert cell["p10"] == pytest.approx(p10, abs=1e-12), cat
            assert cell["p90"] == pytest.approx(p90, abs=1e-12), cat
        port = r["totals"]["portfolio"][int(ly)]
        med, p10, p90 = REF_2_10_0_PORTFOLIO_JITTER0
        assert port["median"] == pytest.approx(med, abs=1e-12)
        assert port["p10"] == pytest.approx(p10, abs=1e-12)
        assert port["p90"] == pytest.approx(p90, abs=1e-12)
        assert r["integrity_events"] == []

    def test_separable_matrix_reproduces_2_10_0_region_lens(self, mock_model_config, mock_trends_database):
        cfg = _cfg_2_10_0(mock_model_config, region_weights=dict(GROUP_SPLIT_2_10_0))
        r = _run(cfg, mock_trends_database)
        ly = max(r["shift_matrix"]["Hair: Color"]["path"].keys())
        for cat, row in REF_2_10_0_REGION_LENS_LAST_JITTER0.items():
            for region, v in row.items():
                assert r["decompositions"]["region"][int(ly)][cat][region] == pytest.approx(v, abs=1e-12), (cat, region)

    def test_jitter_stream_matches_2_10_0(self, mock_model_config, mock_trends_database):
        """No fixture trend carries an uncertainty score, so the per-trend
        inverse-CDF draw must reproduce the 2.10.0 rng.choice draw bit for
        bit (velocity bands are the jitter-sensitive quantity)."""
        cfg = _cfg_2_10_0(mock_model_config, peak_year_jitter=1).copy_with(region_weights=dict(GROUP_SPLIT_2_10_0))
        r = _run(cfg, mock_trends_database)
        vel = r["shift_matrix"]["Hair: Color"]["velocity"]
        for year, (med, p10, p90) in REF_2_10_0_VELOCITY_HAIR_COLOR_JITTER1.items():
            assert vel[year]["median"] == pytest.approx(med, abs=1e-12), year
            assert vel[year]["p10"] == pytest.approx(p10, abs=1e-12), year
            assert vel[year]["p90"] == pytest.approx(p90, abs=1e-12), year


class TestRollUpAlgebra:
    def test_equal_weights_equal_plain_mean(self, mock_model_config, mock_trends_database):
        r = _run(mock_model_config, mock_trends_database)
        samples = r["raw_samples"]  # (iter, cats, years) — the category roll-up
        # Recompute from the regional matrix medians is not exact (median of
        # mean ≠ mean of medians); check the engine's own identity instead:
        # category_samples must equal the plain mean of the 4 regional
        # samples under equal weights. Re-run the private step to get both.
        eng = BayesianMonteCarloEngine(mock_model_config, seed=SEED)
        cat_s, reg_s = eng._simulate_samples(mock_trends_database, ITER)
        assert np.allclose(cat_s, reg_s.mean(axis=2), atol=1e-15)

    def test_zero_share_cell_contributes_nothing(self, mock_model_config, mock_trend):
        """A Europe-only trend under a matrix that gives Europe zero share in
        the category it hits must move neither the category nor the portfolio."""
        t = Trend(id="eu_only", force="Consumer", name="EU only", direction="Contraction",
                  probability=5, start_year=2025, gp1_pct_affected=0.30, peak_year=2028,
                  diffusion_curve="linear", category_exposure={"Hair: Color": 5},
                  regional_exposure={"Europe": 5}, vc_exposure={"Marketing": 5})
        db = TrendDatabase(trends=[t], categories=list(CATEGORIES), forces=["Consumer"])
        W = _equal_matrix()
        W["Hair: Color"]["Europe"] = 0.0
        W["Hair: Color"]["North America"] = 2.0 / 48  # keep the row alive and the total at 1
        cfg = mock_model_config.copy_with(cell_weights=W)
        r = _run(cfg, db, iterations=300)
        ly = max(r["shift_matrix"]["Hair: Color"]["path"].keys())
        assert r["shift_matrix"]["Hair: Color"]["path"][ly]["median"] == 0.0
        assert r["totals"]["portfolio"][int(ly)]["median"] == 0.0
        assert r["regional_shift_matrix"]["Hair: Color"]["Europe"]["path"][ly]["median"] < 0  # the cell itself still moves

    def test_full_share_cell_equals_regional_cell(self, mock_model_config, mock_trend):
        """If a category's whole gross profit sits in one region, the category
        shift IS that cell's shift and the portfolio weight is the row sum."""
        t = Trend(id="eu_only", force="Consumer", name="EU only", direction="Contraction",
                  probability=4, start_year=2025, gp1_pct_affected=0.20, peak_year=2028,
                  diffusion_curve="linear", category_exposure={"Hair: Color": 5},
                  regional_exposure={"Europe": 5, "Asia": 3}, vc_exposure={"Marketing": 5})
        db = TrendDatabase(trends=[t], categories=list(CATEGORIES), forces=["Consumer"])
        W = {c: {r: 0.0 for r in REGIONS} for c in CATEGORIES}
        W["Hair: Color"]["Europe"] = 0.6
        W["Hair: Care"]["Asia"] = 0.4
        cfg = mock_model_config.copy_with(cell_weights=W)
        r = _run(cfg, db, iterations=300)
        ly = max(r["shift_matrix"]["Hair: Color"]["path"].keys())
        cat = r["shift_matrix"]["Hair: Color"]["path"][ly]
        cell = r["regional_shift_matrix"]["Hair: Color"]["Europe"]["path"][ly]
        assert cat["median"] == pytest.approx(cell["median"], abs=1e-15)
        assert cat["p10"] == pytest.approx(cell["p10"], abs=1e-15)
        assert r["category_weights_used"]["Hair: Color"] == pytest.approx(0.6)
        assert r["category_weights_used"]["Hair: Care"] == pytest.approx(0.4)
        # Portfolio per iteration = 0.6 × Hair: Color + 0.4 × Hair: Care; Hair: Care is 0 here.
        assert r["totals"]["portfolio"][int(ly)]["median"] == pytest.approx(0.6 * cat["median"], abs=1e-15)
        zero_rows = [e for e in r["integrity_events"] if e["type"] == "cell_weight_zero_row"]
        assert len(zero_rows) == 1 and "Hair: Styling" in zero_rows[0]["detail"]["categories"]

    def test_region_weights_used_are_column_sums(self, mock_model_config, mock_trends_database):
        W = _equal_matrix()
        W["Hair: Color"]["Europe"] = 3.0 / 48
        W["Hair: Color"]["Asia"] = 0.0
        W["Hair: Color"]["High Growth"] = 0.0
        cfg = mock_model_config.copy_with(cell_weights=W)
        r = _run(cfg, mock_trends_database, iterations=200)
        rw, cw = cell_weight_marginals(W)
        for region in REGIONS:
            assert r["region_weights_used"][region] == pytest.approx(rw[region])
        for cat in CATEGORIES:
            assert r["category_weights_used"][cat] == pytest.approx(cw[cat])
        assert r["cell_weights_used"]["Hair: Color"]["Europe"] == pytest.approx(3.0 / 48)
        assert sum(r["region_weights_used"].values()) == pytest.approx(1.0)
        assert sum(r["category_weights_used"].values()) == pytest.approx(1.0)


class TestContract:
    def test_result_carries_weight_block(self, mock_model_config, mock_trends_database):
        r = _run(mock_model_config, mock_trends_database, iterations=200)
        for key in ("cell_weights_used", "category_weights_used", "region_weights_used", "cell_weights_source"):
            assert key in r, key
        assert set(r["cell_weights_used"].keys()) == set(CATEGORIES)
        assert all(set(row.keys()) == set(REGIONS) for row in r["cell_weights_used"].values())
        assert sum(sum(row.values()) for row in r["cell_weights_used"].values()) == pytest.approx(1.0)
        assert "1/48" in r["cell_weights_source"]

    def test_multichain_carries_weight_block(self, mock_model_config, mock_trends_database):
        r = BayesianMonteCarloEngine(mock_model_config, seed=SEED).run_multichain(
            mock_trends_database, n_chains=2, iterations=150)
        assert r["cell_weights_used"]["LHC: IC"]["High Growth"] == pytest.approx(1.0 / 48)
        assert r["category_weights_used"]["LHC: IC"] == pytest.approx(1.0 / 12)


class TestConfigAndValidator:
    def test_default_is_equal_placeholder(self):
        cfg = ModelConfig()
        assert cfg.cell_weights == DEFAULT_CELL_WEIGHTS
        assert all(v == pytest.approx(0.25) for v in cfg.region_weights.values())
        assert all(v == pytest.approx(1.0 / 12) for v in cfg.category_weights.values())

    def test_legacy_vectors_build_outer_product(self):
        cfg = ModelConfig(region_weights=dict(GROUP_SPLIT_2_10_0))
        assert cfg.cell_weights["LHC: IC"]["High Growth"] == pytest.approx(0.19 / 12)
        assert cfg.region_weights["Europe"] == pytest.approx(0.38)

    def test_from_json_pre_2_11_snapshot(self):
        snap = json.dumps({"region_weights": GROUP_SPLIT_2_10_0,
                           "category_weights": {c: 1.0 / 12 for c in CATEGORIES},
                           "t_copula_df": 4, "vc_weights": {}, "neutral_threshold": 0.1})
        cfg = ModelConfig.from_json(snap)
        assert cfg.cell_weights["Hair: Care"]["North America"] == pytest.approx(0.26 / 12)

    def test_from_json_round_trip_2_11_snapshot(self):
        W = _equal_matrix(); W["Hair: Color"]["Europe"] = 2.0 / 48; W["Hair: Color"]["Asia"] = 0.0
        cfg = ModelConfig(cell_weights=W)
        back = ModelConfig.from_json(cfg.to_json())
        assert back.cell_weights == cfg.cell_weights
        assert back.region_weights == pytest.approx(cfg.region_weights)

    def test_inconsistent_marginals_rejected(self):
        with pytest.raises(ValueError):
            ModelConfig(cell_weights=_equal_matrix(), region_weights={"Europe": 0.9, "North America": 0.1, "Asia": 0.0, "High Growth": 0.0})

    def test_copy_with_matrix_override_recomputes_marginals(self):
        cfg = ModelConfig()
        W = _equal_matrix(); W["LHC: FCN"]["Europe"] = 5.0 / 48; W["LHC: FCN"]["Asia"] = 0.0; W["LHC: FCN"]["High Growth"] = 0.0
        # keep the total at 1: 1/48 + 5/48 - 1/48 - 1/48 - 1/48 → +2/48 over; rebalance Hair: Color
        W["Hair: Color"]["Europe"] = 0.0; W["Hair: Color"]["Asia"] = 0.0
        new = cfg.copy_with(cell_weights=W)
        assert new.category_weights["LHC: FCN"] == pytest.approx(6.0 / 48)
        assert new.region_weights["Europe"] == pytest.approx(sum(W[c]["Europe"] for c in CATEGORIES))

    def test_validator_accepts_default_and_rejects_bad_grids(self):
        cfg = ModelConfig()
        validate_model_config(cfg.__dict__)
        bad = dict(cfg.__dict__); bad["cell_weights"] = {c: {r: 0.0 for r in REGIONS} for c in CATEGORIES}
        with pytest.raises(Exception):
            validate_model_config(bad)
        bad = dict(cfg.__dict__); bad["cell_weights"] = {c: {r: 1.0 / 48 for r in REGIONS} for c in CATEGORIES[:-1]}
        with pytest.raises(Exception):
            validate_model_config(bad)
        bad = dict(cfg.__dict__); W = _equal_matrix(); W["Hair: Color"]["Europe"] = -0.01; bad["cell_weights"] = W
        with pytest.raises(Exception):
            validate_model_config(bad)
        bad = dict(cfg.__dict__); W = _equal_matrix(); W["Hair: Color"]["Mars"] = 0.0; bad["cell_weights"] = W
        with pytest.raises(Exception):
            validate_model_config(bad)

    def test_outer_product_helper_normalises(self):
        W = cell_weights_outer({"Europe": 2, "North America": 2, "Asia": 0, "High Growth": 0}, {c: 1 for c in CATEGORIES})
        assert sum(sum(row.values()) for row in W.values()) == pytest.approx(1.0)
        assert W["Hair: Color"]["Europe"] == pytest.approx(0.5 / 12)
