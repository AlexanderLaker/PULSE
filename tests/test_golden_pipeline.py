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

    Engine: bayesian_copula MODEL_VERSION 2.10.0.

    REGENERATED 2026-07-13 (2.10.0, owner-directed mathematical-review batch —
    numbers MOVE by design): the shift math is now regional (F1, 3D category ×
    region × year rolled up by the region GP1-share weights), the within-force
    dampening uses the magnitude-weighted n_eff (F2), and start_year gates the
    materialization onset (F11). The fixture now carries per-trend regional
    exposure and pins with peak-year jitter OFF (F4 has its own test). The
    magnitudes shrank vs the 2.8.1 pins because the fixture trends are Europe-
    weighted, so the regional roll-up correctly dilutes their category impact.
    Regenerate pins ONLY for deliberate model changes, in the same commit.

    Prior regenerations: 2026-07-06 v3.8/2.8.1 (L3 clip, L4 floor, fixture
    differentiation); June 2026 v3.7/D20 (t-copula deleted → Gaussian);
    June 2026 v3.6/D1 (PSD-valid default correlations, F-01).
    """

    PINS = {
        # cat:          (median,            p10,                p90)
        "Hair: Color": (-0.003365458544, -0.005207021042, -0.001350259625),
        "Hair: Care":  (-0.004405135395, -0.006105482349, -0.002398520912),
        "LHC: FCN":    (-0.005469456519, -0.007019692994, -0.003314337205),
    }

    # L29: the joint portfolio band (totals.portfolio) is what the dashboard
    # headline shows (D3) — pin it too, not only per-category cells.
    PORTFOLIO_PIN = (-0.004730794486, -0.006328294549, -0.002752637701)

    def test_engine_identity(self, mock_model_config, mock_trends_database):
        r = _run(mock_model_config, mock_trends_database)
        assert r["model_version"] == "2.10.0"
        assert r["engine_name"] == "bayesian_copula"
        assert r["seed"] == SEED
        assert r["numerics_backend"].startswith("scipy ")  # D13
        assert r["vc_attribution_basis"] == "epicentre"    # 2.9.0 partition tag

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

    def test_vc_decomposition_reconciles_to_median(
        self, mock_model_config, mock_trends_database,
    ):
        """2.9.0: the epicentre partition stays exhaustive — Σ over VC steps
        of decomp[vc][year][cat] == MC median for every (cat, year), the
        same identity the force lens carries. Shares sum to 1 per category
        by construction of the partition."""
        r = _run(mock_model_config, mock_trends_database)
        sm, dec = r["shift_matrix"], r["decompositions"]["vc"]
        for ykey, by_cat in dec.items():
            for cat, row in by_cat.items():
                med = sm[cat]["path"][int(ykey)]["median"]
                assert sum(row.values()) == pytest.approx(med, rel=1e-9, abs=1e-12), (cat, ykey)

    def test_vc_attribution_is_categorical_partition(
        self, mock_model_config, mock_trends_database,
    ):
        """2.9.0: the VC lens is a hard partition by epicentre stage.

        The fixture's five trends carry epicentres {Marketing(6),
        Formulation(2), Commercial(7)×2, Manufacturing(3)} and every trend
        exposes every category — so for EVERY category, exactly the stages
        {Formulation, Manufacturing, Marketing, Commercial} carry non-zero
        attribution and the other four stages carry exactly 0.0 (no kernel
        smear, no uniform residue). Also locks the terminal-year
        vc_decomposition to the per-year block's terminal slice (single
        source of shares)."""
        from pulse.config import vc_epicentre_step_of
        r = _run(mock_model_config, mock_trends_database)
        expected_steps = {
            vc_epicentre_step_of(t.vc_exposure)
            for t in mock_trends_database.trends
        }
        assert expected_steps == {"Formulation", "Manufacturing", "Marketing", "Commercial"}

        dec = r["decompositions"]["vc"]
        last_year = max(int(y) for y in dec.keys())
        for ykey, by_cat in dec.items():
            for cat, row in by_cat.items():
                med = r["shift_matrix"][cat]["path"][int(ykey)]["median"]
                for step, val in row.items():
                    if step in expected_steps:
                        # Non-zero whenever the category actually shifted.
                        if abs(med) > 1e-15:
                            assert abs(val) > 0.0, (cat, ykey, step)
                    else:
                        assert val == 0.0, (
                            f"{cat}/{ykey}/{step}: non-epicentre stage carries "
                            f"attribution {val} — the partition leaked."
                        )
        # Terminal-year back-compat block == terminal slice of the per-year block.
        for cat, row in r["vc_decomposition"].items():
            assert row == pytest.approx(dec[last_year][cat]), cat

    def test_vc_coverage_integrity_event_on_unscored_trend(
        self, mock_model_config, mock_trends_database,
    ):
        """A trend without a VC epicentre must surface as an integrity event
        (the lens silently ignoring contributors was the pre-2.9 behavior),
        while the partition identity still holds on the scored subset."""
        import copy
        db = copy.deepcopy(mock_trends_database)
        db.trends[0].vc_exposure = {}   # unscore one contributor
        r = _run(mock_model_config, db)
        events = [e for e in r["integrity_events"] if e["type"] == "vc_epicentre_coverage"]
        assert len(events) == 1
        assert events[0]["severity"] == "warning"
        assert db.trends[0].id in events[0]["message"]
        # Identity survives: shares renormalize over the scored subset.
        sm, dec = r["shift_matrix"], r["decompositions"]["vc"]
        for ykey, by_cat in dec.items():
            for cat, row in by_cat.items():
                med = sm[cat]["path"][int(ykey)]["median"]
                assert sum(row.values()) == pytest.approx(med, rel=1e-9, abs=1e-12), (cat, ykey)

    # (The journey-decomposition reconciliation test was removed with the
    #  quantitative journey layer, owner ruling O3 2026-07-07 — the negative
    #  contract lock lives in test_bayesian_mc.TestJourneyLayerRemoved.)

    def test_all_lenses_present(self, mock_model_config, mock_trends_database):
        r = _run(mock_model_config, mock_trends_database)
        for lens in ("force", "vc", "region"):
            assert lens in r["decompositions"], lens
