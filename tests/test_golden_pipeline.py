"""Golden-pipeline regression pins for the Bayesian MC engine.

Re-established June 2026 (the original test_golden_pipeline.py was deleted
in 96809a4 when category mappings changed, and never re-pinned — leaving
the engine without an end-to-end reproducibility lock).

Three layers of protection:
  1. Determinism: same seed → bit-identical results (any environment).
  2. Golden pins: seed=42 on the conftest fixture DB must reproduce the
     exact values below. Pinned WITH scipy — skipped when scipy is absent
     because _scipy_compat falls back to a normal approximation of the
     Beta ppf and produces (deliberately) different numbers. See
     review finding 7 / pulse/simulation/_scipy_compat.py.
  3. Structural identities that hold in every environment: the Layer-B
     force decomposition must reconcile row-by-row to the MC median
     (PPA2's lenses depend on this invariant).

If a deliberate model change breaks the pins: re-generate them with the
snippet in this file's docstring history (run engine on the fixtures,
print medians), bump MODEL_VERSION in bayesian_mc.py, and update the
pinned values in the same commit.
"""

import pytest

from pulse.simulation._scipy_compat import HAS_SCIPY
from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine

ITER = 500
SEED = 42


def _run(config, db, seed=SEED, iterations=ITER):
    return BayesianMonteCarloEngine(config, seed=seed).run(db, iterations=iterations)


class TestDeterminism:
    """Same seed → identical output; different seed → different output."""

    def test_same_seed_reproduces_exactly(self, mock_model_config, mock_trends_database):
        r1 = _run(mock_model_config, mock_trends_database)
        r2 = _run(mock_model_config, mock_trends_database)
        sm1, sm2 = r1["shift_matrix"], r2["shift_matrix"]
        assert sm1.keys() == sm2.keys()
        for cat in sm1:
            for year, cell in sm1[cat]["path"].items():
                for k, v in cell.items():
                    assert sm2[cat]["path"][year][k] == v, (cat, year, k)

    def test_different_seed_diverges(self, mock_model_config, mock_trends_database):
        r1 = _run(mock_model_config, mock_trends_database, seed=42)
        r2 = _run(mock_model_config, mock_trends_database, seed=43)
        cat = next(iter(r1["shift_matrix"]))
        path1 = r1["shift_matrix"][cat]["path"]
        path2 = r2["shift_matrix"][cat]["path"]
        last = max(path1.keys())
        assert path1[last]["median"] != path2[last]["median"]

    def test_multichain_same_seed_reproduces(self, mock_model_config, mock_trends_database):
        e1 = BayesianMonteCarloEngine(mock_model_config, seed=SEED)
        e2 = BayesianMonteCarloEngine(mock_model_config, seed=SEED)
        r1 = e1.run_multichain(mock_trends_database, n_chains=2, iterations=200)
        r2 = e2.run_multichain(mock_trends_database, n_chains=2, iterations=200)
        assert r1["chain_seeds"] == r2["chain_seeds"]
        cat = next(iter(r1["shift_matrix"]))
        assert r1["shift_matrix"][cat] == r2["shift_matrix"][cat]


@pytest.mark.skipif(not HAS_SCIPY, reason=(
    "Golden pins are valid only with scipy. Without scipy, _scipy_compat "
    "approximates the Beta ppf (normal approximation) and produces "
    "different numbers by design — see review finding 7."
))
class TestGoldenPins:
    """Exact expected output for seed=42 / 500 iterations on the fixture DB.

    Engine: bayesian_copula MODEL_VERSION 2.7.0. Regenerate pins ONLY for
    deliberate model changes, in the same commit as the change.

    Regenerated June 2026 (v3.6 / D1): DEFAULT_FORCE_CORRELATIONS were
    recalibrated to be PSD-valid as entered (audit finding F-01 — the old
    defaults were silently repaired and rescaled by the engine on every
    run). Same seed, same fixtures, honestly-valid dependence structure.
    """

    PINS = {
        # cat:               (median,            p10,                p90)
        "Hair: Color": (-0.003428643176, -0.005758534704, -0.000906596942),
        "Hair: Care":  (-0.003428643176, -0.005758534704, -0.000906596942),
        "LHC: FCN":    (-0.006407636941, -0.008252814110, -0.004017618504),
    }

    def test_engine_identity(self, mock_model_config, mock_trends_database):
        r = _run(mock_model_config, mock_trends_database)
        assert r["model_version"] == "2.7.0"
        assert r["engine_name"] == "bayesian_copula"
        assert r["seed"] == SEED

    def test_golden_values_seed42(self, mock_model_config, mock_trends_database):
        r = _run(mock_model_config, mock_trends_database)
        sm = r["shift_matrix"]
        last_year = max(sm["Hair: Color"]["path"].keys())
        assert last_year == 2030
        for cat, (median, p10, p90) in self.PINS.items():
            cell = sm[cat]["path"][last_year]
            assert cell["median"] == pytest.approx(median, rel=1e-6), cat
            assert cell["p10"] == pytest.approx(p10, rel=1e-6), cat
            assert cell["p90"] == pytest.approx(p90, rel=1e-6), cat


class TestStructuralIdentities:
    """Invariants that must hold in EVERY environment (scipy or fallback)."""

    def test_force_decomposition_reconciles_to_median(
        self, mock_model_config, mock_trends_database,
    ):
        """Σ_force decomp[force][year][cat] == MC median for (cat, year).

        PPA2's Force/VC/Region lenses anchor row totals to the Time-Path
        median and rely on the decomposition being exhaustive (shares sum
        to 1). If this breaks, the dashboard's lenses stop reconciling.
        """
        r = _run(mock_model_config, mock_trends_database)
        sm, dec = r["shift_matrix"], r["decompositions"]["force"]
        for ykey, by_cat in dec.items():
            for cat, row in by_cat.items():
                med = sm[cat]["path"][int(ykey)]["median"]
                assert sum(row.values()) == pytest.approx(med, rel=1e-9, abs=1e-12), (cat, ykey)

    def test_all_lenses_present(self, mock_model_config, mock_trends_database):
        r = _run(mock_model_config, mock_trends_database)
        for lens in ("force", "vc", "region"):
            assert lens in r["decompositions"], lens
