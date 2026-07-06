"""Golden-pipeline regression pins for the Bayesian MC engine.

Re-established June 2026 (the original test_golden_pipeline.py was deleted
in 96809a4 when category mappings changed, and never re-pinned — leaving
the engine without an end-to-end reproducibility lock).

Four layers of protection:
  1. Determinism: same seed → bit-identical results.
  2. Golden pins: seed=42 on the conftest fixture DB must reproduce the
     exact values below — including the joint portfolio band the dashboard
     headline reads (L29, July 2026 review). D13: scipy is a hard engine
     requirement, so the pins run unconditionally (exact numerics only).
  3. Structural identities: decompositions reconcile row-by-row to the MC
     median (PPA2's lenses depend on this invariant).
  4. Version discipline: package version == MODEL_VERSION == package.json,
     and the D1 invariant that NO repair fires on default config.

If a deliberate model change breaks the pins: regenerate them (run the
engine on the fixtures with seed=42 / 500 iterations and print
median/p10/p90 at the terminal year), bump MODEL_VERSION in
bayesian_mc.py, and update the pins in the SAME commit — never regenerate
just to make CI green (HANDOVER.md §6.5).
"""

import json
from pathlib import Path

import pytest

import pulse
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

    def test_trend_order_does_not_change_results(self, mock_model_config, mock_trends_database):
        """C2 (July 2026 review): reproducibility must not depend on the
        physical order trends arrive from the database. The engine is fed
        id-ordered trends (ORDER BY id in load_trends); this test locks the
        engine-level truth that a re-ordered trend list with the same seed
        yields a DIFFERENT sample pairing — which is exactly why the load
        order is pinned upstream. If this test ever passes with a shuffled
        list, the copula assignment logic changed and C2 should be revisited.
        """
        import dataclasses
        from pulse.ingestion.models import TrendDatabase
        db1 = mock_trends_database
        db2 = TrendDatabase(
            trends=list(reversed(db1.trends)),
            categories=db1.categories,
            forces=db1.forces,
            source_file=db1.source_file,
        )
        r1 = _run(mock_model_config, db1)
        r2 = _run(mock_model_config, db2)
        cat = next(iter(r1["shift_matrix"]))
        last = max(r1["shift_matrix"][cat]["path"].keys())
        m1 = r1["shift_matrix"][cat]["path"][last]["median"]
        m2 = r2["shift_matrix"][cat]["path"][last]["median"]
        assert m1 != m2, (
            "Trend order no longer affects the sample pairing — the ORDER BY "
            "contract (C2) may be obsolete; review before removing it."
        )

    def test_multichain_same_seed_reproduces(self, mock_model_config, mock_trends_database):
        e1 = BayesianMonteCarloEngine(mock_model_config, seed=SEED)
        e2 = BayesianMonteCarloEngine(mock_model_config, seed=SEED)
        r1 = e1.run_multichain(mock_trends_database, n_chains=2, iterations=200)
        r2 = e2.run_multichain(mock_trends_database, n_chains=2, iterations=200)
        assert r1["chain_seeds"] == r2["chain_seeds"]
        cat = next(iter(r1["shift_matrix"]))
        assert r1["shift_matrix"][cat] == r2["shift_matrix"][cat]


class TestGoldenPins:
    """Exact expected output for seed=42 / 500 iterations on the fixture DB.

    Engine: bayesian_copula MODEL_VERSION 2.8.1. Regenerate pins ONLY for
    deliberate model changes, in the same commit as the change.

    Regenerated 2026-07-06 (2.8.1, owner-approved July review batch): the
    copula-uniform clip moved to float-safety (L3), compounding factors are
    floored at 0 with an integrity event (L4), and the conftest fixture was
    differentiated (Hair: Color ≠ Hair: Care exposure) + given a per-trend
    materialization schedule so no two pins are identical and the schedule
    path is pinned (L29).

    Prior regenerations: June 2026 v3.7/D20 (t-copula deleted → Gaussian),
    June 2026 v3.6/D1 (PSD-valid default correlations, F-01).
    """

    PINS = {
        # cat:          (median,            p10,                p90)
        "Hair: Color": (-0.005123402183, -0.007827267324, -0.002184655835),
        "Hair: Care":  (-0.006658914451, -0.009184228794, -0.003627384381),
        "LHC: FCN":    (-0.008226331487, -0.010567677496, -0.005100180189),
    }

    # L29: the joint portfolio band (totals.portfolio) is what the dashboard
    # headline shows (D3) — pin it too, not only per-category cells.
    PORTFOLIO_PIN = (-0.007155337354, -0.009448349364, -0.004241665228)

    def test_engine_identity(self, mock_model_config, mock_trends_database):
        r = _run(mock_model_config, mock_trends_database)
        assert r["model_version"] == "2.8.1"
        assert r["engine_name"] == "bayesian_copula"
        assert r["seed"] == SEED
        assert r["numerics_backend"].startswith("scipy ")  # D13

    def test_version_single_source(self):
        """M15 (July 2026 review): one authoritative version everywhere —
        the API/package version, the engine MODEL_VERSION, and package.json
        must agree, so the live API can never again advertise a version
        three releases stale."""
        assert pulse.__version__ == BayesianMonteCarloEngine.MODEL_VERSION
        pkg = json.loads((Path(__file__).resolve().parents[1] / "package.json").read_text())
        assert pkg["version"] == BayesianMonteCarloEngine.MODEL_VERSION

    def test_golden_values_seed42(self, mock_model_config, mock_trends_database):
        r = _run(mock_model_config, mock_trends_database)
        sm = r["shift_matrix"]
        last_year = max(sm["Hair: Color"]["path"].keys())
        assert last_year == 2030  # fixture horizon (prod runs use the config horizon)
        for cat, (median, p10, p90) in self.PINS.items():
            cell = sm[cat]["path"][last_year]
            assert cell["median"] == pytest.approx(median, rel=1e-6), cat
            assert cell["p10"] == pytest.approx(p10, rel=1e-6), cat
            assert cell["p90"] == pytest.approx(p90, rel=1e-6), cat

    def test_golden_pins_differ_across_categories(self):
        """L29: identical pins can't catch a category mixup — keep them distinct."""
        values = list(self.PINS.values())
        assert len(set(values)) == len(values), "golden pins must be pairwise distinct"

    def test_portfolio_band_pin(self, mock_model_config, mock_trends_database):
        r = _run(mock_model_config, mock_trends_database)
        last_year = max(r["shift_matrix"]["Hair: Color"]["path"].keys())
        cell = r["totals"]["portfolio"][int(last_year)]
        median, p10, p90 = self.PORTFOLIO_PIN
        assert cell["median"] == pytest.approx(median, rel=1e-6)
        assert cell["p10"] == pytest.approx(p10, rel=1e-6)
        assert cell["p90"] == pytest.approx(p90, rel=1e-6)

    def test_no_integrity_events_on_defaults(self, mock_model_config, mock_trends_database):
        """D1 regression lock (L29): default correlations are PSD-valid as
        entered — if any repair (PSD shift, Cholesky clip, compounding floor)
        fires on the default config + fixture, that is a model regression,
        not noise."""
        r = _run(mock_model_config, mock_trends_database)
        assert r["integrity_events"] == []


class TestMultichainContract:
    """run_multichain result contract: master seed + seed stability (M2/L8)."""

    def test_master_seed_and_chain_seeds_persisted(self, mock_model_config, mock_trends_database):
        e = BayesianMonteCarloEngine(mock_model_config, seed=SEED)
        r = e.run_multichain(mock_trends_database, n_chains=3, iterations=200)
        assert r["master_seed"] == SEED
        assert r["seed"] == SEED  # the reproducible input, not a derived chain seed
        assert len(r["chain_seeds"]) == 3
        assert r["chain_seeds"][0] == SEED  # first chain runs the master seed

    def test_seed_stability_block(self, mock_model_config, mock_trends_database):
        e = BayesianMonteCarloEngine(mock_model_config, seed=SEED)
        r = e.run_multichain(mock_trends_database, n_chains=3, iterations=200)
        ss = r["seed_stability"]
        assert ss["metric"] == "terminal_year_portfolio_median"
        assert ss["n_chains"] == 3
        assert ss["iterations_per_chain"] == 200
        assert len(ss["per_chain_medians"]) == 3
        # spread is max-min in percentage points — non-negative by construction
        assert ss["spread_pp"] >= 0.0
        assert ss["spread_pp"] == pytest.approx(
            (max(ss["per_chain_medians"]) - min(ss["per_chain_medians"])) * 100.0
        )
        # chain_summaries mirror the same quantity
        summaries = r["chain_summaries"]
        assert [s["median_terminal"] for s in summaries] == ss["per_chain_medians"]
        assert all(s["terminal_year"] == ss["terminal_year"] for s in summaries)


class TestStructuralIdentities:
    """Invariants that must hold in EVERY environment."""

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

    def test_journey_decomposition_reconciles_to_terminal_median(
        self, mock_model_config, mock_trends_database,
    ):
        """L29: the documented journey invariant ("per-category stage sums
        reconcile with the terminal-year median exactly") was asserted in
        prose but never in a test."""
        r = _run(mock_model_config, mock_trends_database)
        sm = r["shift_matrix"]
        last_year = max(sm["Hair: Color"]["path"].keys())
        for cat, stages in r["journey_decomposition"].items():
            med = sm[cat]["path"][last_year]["median"]
            assert sum(stages.values()) == pytest.approx(med, rel=1e-9, abs=1e-12), cat

    def test_all_lenses_present(self, mock_model_config, mock_trends_database):
        r = _run(mock_model_config, mock_trends_database)
        for lens in ("force", "vc", "region"):
            assert lens in r["decompositions"], lens
