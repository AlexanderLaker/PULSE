"""Uncertainty score per trend (2.11.0, owner ruling O7).

One score per trend on a 0–5 scale sets (a) the Beta-prior concentration
κ = α + β via UNCERTAINTY_KAPPA (24/16/10/6/4/3) with the mean p/6 unchanged,
and (b) the per-trend peak-year jitter width via UNCERTAINTY_PEAK_JITTER
(0/1/1/2/3/4 years). A trend WITHOUT a score behaves exactly as in 2.10.0:
prior (p, 6 − p) and the global config.peak_year_jitter. The bit-identity of
the no-score jitter stream with 2.10.0 is locked in tests/test_cell_weights.py.
"""

import numpy as np
import pytest

from pulse.config import (beta_prior_for, peak_jitter_for, UNCERTAINTY_KAPPA,
                          UNCERTAINTY_PEAK_JITTER, CATEGORIES)
from pulse.ingestion.models import Trend, TrendDatabase
from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine
from pulse.audit.input_drift import trend_fingerprint, compute_input_drift_event


class TestPriorMapping:
    def test_no_score_is_legacy_prior(self):
        for p in range(1, 6):
            assert beta_prior_for(p, None) == (p, 6 - p)

    def test_concentration_follows_table_and_mean_is_preserved(self):
        for p in range(1, 6):
            for u in range(6):
                a, b = beta_prior_for(p, u)
                assert a + b == pytest.approx(UNCERTAINTY_KAPPA[u]), (p, u)
                assert a / (a + b) == pytest.approx(p / 6.0), (p, u)
                assert a >= 0.5 and b >= 0.5

    def test_score_3_equals_legacy(self):
        for p in range(1, 6):
            assert beta_prior_for(p, 3) == pytest.approx(beta_prior_for(p, None))

    def test_out_of_range_scores_are_clamped(self):
        assert beta_prior_for(4, 9) == beta_prior_for(4, 5)
        assert beta_prior_for(4, -2) == beta_prior_for(4, 0)

    def test_jitter_table(self):
        assert [peak_jitter_for(u, 1) for u in range(6)] == [0, 1, 1, 2, 3, 4]
        assert peak_jitter_for(None, 1) == 1
        assert peak_jitter_for(None, 2) == 2
        assert UNCERTAINTY_PEAK_JITTER[5] == 4

    def test_global_zero_is_the_engine_wide_off_switch(self):
        # config.peak_year_jitter = 0 keeps its 2.10.0 meaning: no timing
        # jitter for anyone, scored or not (golden fixture, diagnostics).
        assert peak_jitter_for(None, 0) == 0
        assert all(peak_jitter_for(u, 0) == 0 for u in range(6))


class TestTrendModel:
    def test_trend_prior_uses_score_and_recomputes_on_post_init(self):
        t = Trend(id="u1", force="Consumer", probability=5, gp1_pct_affected=0.2)
        assert t.probability_prior == (5, 1)
        assert t.uncertainty is None
        t.uncertainty = 1
        t.__post_init__()
        a, b = t.probability_prior
        assert a + b == pytest.approx(16)
        assert t.normalized_score == pytest.approx(5 / 6 * 0.2)  # mean unchanged
        t.uncertainty = 7
        t.__post_init__()
        assert t.uncertainty == 5  # clamped

    def test_fingerprint_carries_score_and_diffs_it(self):
        base = Trend(id="u1", force="Consumer", probability=4, gp1_pct_affected=0.1,
                     category_exposure={"Hair: Care": 3}, regional_exposure={"Europe": 5},
                     vc_exposure={"Marketing": 5}, peak_year=2029, diffusion_curve="linear")
        fp0 = trend_fingerprint([base])
        assert fp0["u1"]["u"] is None
        base.uncertainty = 4
        base.__post_init__()
        fp1 = trend_fingerprint([base])
        assert fp1["u1"]["u"] == 4
        ev = compute_input_drift_event(fp1, fp0, previous_run_id=1)
        assert ev is not None and "u1" in (ev.get("detail", {}).get("structure_changes") or [])

    def test_pre_2_11_fingerprint_without_u_diffs_cleanly(self):
        t = Trend(id="u1", force="Consumer", probability=4, gp1_pct_affected=0.1,
                  category_exposure={"Hair: Care": 3}, regional_exposure={"Europe": 5},
                  vc_exposure={"Marketing": 5}, uncertainty=2)
        cur = trend_fingerprint([t])
        prev = {"u1": {k: v for k, v in cur["u1"].items() if k != "u"}}  # pre-2.11 shape
        ev = compute_input_drift_event(cur, prev, previous_run_id=1)
        assert ev is not None
        assert not (ev.get("detail", {}).get("structure_changes") or [])


def _db(uncertainties):
    trends = []
    for i, u in enumerate(uncertainties):
        trends.append(Trend(
            id=f"t{i}", force="Consumer", name=f"t{i}", direction="Contraction",
            probability=4, start_year=2025, gp1_pct_affected=0.20, peak_year=2029,
            diffusion_curve="linear", category_exposure={"Hair: Care": 5},
            regional_exposure={"Europe": 5}, vc_exposure={"Marketing": 5},
            uncertainty=u,
        ))
    return TrendDatabase(trends=trends, categories=list(CATEGORIES), forces=["Consumer"])


def _velocity_width(r, cat="Hair: Care"):
    vel = r["shift_matrix"][cat]["velocity"]
    return sum(abs(v["p90"] - v["p10"]) for v in vel.values())


def _terminal_band(r, cat="Hair: Care"):
    path = r["shift_matrix"][cat]["path"]
    ly = max(path.keys())
    return path[ly]["p90"] - path[ly]["p10"]


class TestEngine:
    def test_score_0_disables_jitter_and_score_5_widens_it(self, mock_model_config):
        cfg = mock_model_config.copy_with(iterations=3000, peak_year_jitter=1)
        r_u0_off = BayesianMonteCarloEngine(cfg.copy_with(peak_year_jitter=0), seed=11).run(_db([0]))
        r_u0 = BayesianMonteCarloEngine(cfg, seed=11).run(_db([0]))
        r_u3 = BayesianMonteCarloEngine(cfg, seed=11).run(_db([3]))
        r_u5 = BayesianMonteCarloEngine(cfg, seed=11).run(_db([5]))
        # Score 0 = no timing jitter for that trend: with the global switch on
        # it produces exactly the same result as with the switch off (same
        # prior, same copula stream; the jitter block consumes no randomness
        # when the only offset is 0).
        assert r_u0["shift_matrix"] == r_u0_off["shift_matrix"]
        w0, w3, w5 = (_velocity_width(x) for x in (r_u0, r_u3, r_u5))
        assert w3 > w0
        assert w5 > w3

    def test_global_switch_off_silences_scored_trends_too(self, mock_model_config):
        cfg = mock_model_config.copy_with(iterations=2000, peak_year_jitter=0)
        # With the global switch off a U5 trend draws no offset at all;
        # switching it on makes the ±4 offsets live and widens the timing
        # bands. (The exact legacy identity for U3 under the switch-off is
        # locked in test_low_score_narrows_terminal_band_high_score_widens_it.)
        r_u5_off = BayesianMonteCarloEngine(cfg, seed=2).run(_db([5]))
        r_u5_on = BayesianMonteCarloEngine(cfg.copy_with(peak_year_jitter=1), seed=2).run(_db([5]))
        assert r_u5_off["shift_matrix"] != r_u5_on["shift_matrix"]
        assert _velocity_width(r_u5_on) > _velocity_width(r_u5_off)

    def test_low_score_narrows_terminal_band_high_score_widens_it(self, mock_model_config):
        cfg = mock_model_config.copy_with(iterations=4000, peak_year_jitter=0)
        bands = {}
        for u in (0, 3, 5):
            r = BayesianMonteCarloEngine(cfg, seed=5).run(_db([u]))
            bands[u] = _terminal_band(r)
        r_none = BayesianMonteCarloEngine(cfg, seed=5).run(_db([None]))
        assert bands[0] < bands[3] < bands[5]
        assert bands[3] == pytest.approx(_terminal_band(r_none), rel=1e-12)  # score 3 == legacy κ 6

    def test_mixed_scores_reproducible_under_seed(self, mock_model_config):
        cfg = mock_model_config.copy_with(iterations=2000, peak_year_jitter=1)
        db = _db([None, 0, 2, 5])
        a = BayesianMonteCarloEngine(cfg, seed=3).run(db)
        b = BayesianMonteCarloEngine(cfg, seed=3).run(db)
        assert a["shift_matrix"] == b["shift_matrix"]
        c = BayesianMonteCarloEngine(cfg, seed=4).run(db)
        assert a["shift_matrix"] != c["shift_matrix"]

    def test_mixed_scores_keep_each_trends_own_offset_range(self, mock_model_config):
        """Directly inspect the offset draw: a U0 trend never moves its peak,
        a U5 trend uses offsets up to ±4, an unscored trend stays inside the
        global ±1."""
        cfg = mock_model_config.copy_with(iterations=5000, peak_year_jitter=1)
        db = _db([None, 0, 5])
        eng = BayesianMonteCarloEngine(cfg, seed=8)
        # Re-create the offset draw the engine performs (same RNG consumption
        # order as _compute_all_paths_vectorized): copula draws first.
        trends = db.trends
        R = eng._build_correlation_matrix(trends)
        eng._generate_copula_samples(trends, R, 5000)
        from pulse.config import peak_jitter_for as pj
        widths = [pj(getattr(t, "uncertainty", None), 1) for t in trends]
        assert widths == [1, 0, 4]
        jmax = max(widths)
        offsets = list(range(-jmax, jmax + 1))
        P = np.zeros((3, len(offsets)))
        for j, w in enumerate(widths):
            if w == 0:
                P[j, offsets.index(0)] = 1.0
            else:
                raw = np.array([max(0, w + 1 - abs(o)) if abs(o) <= w else 0 for o in offsets], float)
                P[j] = raw / raw.sum()
        cdf = np.cumsum(P, axis=1); cdf = cdf / cdf[:, -1:]
        u = eng.rng.random((5000, 3))
        idx = (u[:, :, None] >= cdf[None, :, :]).sum(axis=2)
        off = np.array(offsets)[idx]
        assert set(np.unique(off[:, 1])) == {0}
        assert set(np.unique(off[:, 0])) <= {-1, 0, 1} and len(set(np.unique(off[:, 0]))) == 3
        assert off[:, 2].min() == -4 and off[:, 2].max() == 4


class TestDatabaseRoundTrip:
    def test_uncertainty_persists_in_sqlite(self, monkeypatch, tmp_path):
        monkeypatch.setenv("PRISM_DB_PATH", str(tmp_path / "unc.db"))
        import importlib
        import pulse.database as dbm
        importlib.reload(dbm)
        dbm.init_db()
        t = Trend(id="unc_1", force="Consumer", name="x", direction="Contraction",
                  probability=4, start_year=2025, gp1_pct_affected=0.2, peak_year=2029,
                  diffusion_curve="linear", category_exposure={"Hair: Care": 5},
                  regional_exposure={"Europe": 5}, vc_exposure={"Marketing": 5}, uncertainty=2)
        t2 = Trend(id="unc_2", force="Consumer", name="y", direction="Expansion",
                   probability=3, start_year=2025, gp1_pct_affected=0.1, peak_year=2030,
                   diffusion_curve="linear", category_exposure={"Hair: Care": 5},
                   regional_exposure={"Europe": 5}, vc_exposure={"Marketing": 5})
        dbm.save_trends([t, t2])
        loaded = {x.id: x for x in dbm.load_trends()}
        assert loaded["unc_1"].uncertainty == 2
        assert loaded["unc_1"].probability_prior == pytest.approx(beta_prior_for(4, 2))
        assert loaded["unc_2"].uncertainty is None
        assert loaded["unc_2"].probability_prior == (3, 3)
        # proposals carry the field too
        row = dbm.upsert_trend_proposal("unc_1", "expert-a", {"uncertainty": 4, "probability": 3}, "A", "expert")
        assert row["uncertainty"] == 4
        rows = dbm.load_trend_proposals("unc_1")
        assert rows[0]["uncertainty"] == 4
        from pulse.api.proposals import aggregate_proposals, build_proposal_summary
        agg = aggregate_proposals(rows)
        assert agg["uncertainty"] == {"median": 4, "count": 1}
        summ = build_proposal_summary(rows, "expert-a")
        assert summ["uncertainty"]["median"] == 4 and summ["my"]["uncertainty"] == 4


class TestOnsetClamp:
    """2.11.0 review fix: an "arrives earlier" draw whose jittered peak lands
    at or before the onset must saturate at "peaks the year after onset",
    never fall into the schedule's "peak ≤ onset ⇒ ramp to the horizon"
    branch (which turned the earliest draw into the latest arrival)."""

    def _trend(self, u):
        return Trend(id="clamp", force="Consumer", name="c", direction="Contraction", probability=5,
                     start_year=2025, gp1_pct_affected=0.2, peak_year=2027, diffusion_curve="linear",
                     category_exposure={"Hair: Care": 5}, regional_exposure={"Europe": 5},
                     vc_exposure={"Marketing": 5}, uncertainty=u)

    def test_schedule_table_is_monotone_earlier_for_negative_offsets(self, mock_model_config):
        cfg = mock_model_config.copy_with(peak_year_jitter=1,
                                          path_years=[2026, 2027, 2028, 2029, 2030])
        eng = BayesianMonteCarloEngine(cfg, seed=1)
        # start 2025, peak 2027, U3 → ±2: offsets −2/−1 land at/before the onset
        sched, offsets, probs = eng._peak_schedule_table([self._trend(3)])
        assert offsets == [-2, -1, 0, 1, 2]
        first = {o: sched[0, k, 0] for k, o in enumerate(offsets)}   # 2026 materialisation
        for o1, o2 in zip(offsets[:-1], offsets[1:]):
            assert first[o1] >= first[o2] - 1e-12, (o1, o2, first)
        assert first[-2] == pytest.approx(1.0) and first[-1] == pytest.approx(1.0)
        assert first[0] == pytest.approx(0.5)       # linear ramp 2025 → 2027
        assert 0 < first[2] < first[0]              # later peak, less in by 2026
        assert probs[0].sum() == pytest.approx(1.0) and probs[0][2] == pytest.approx(3 / 9)

    def test_offset_draw_uses_each_trends_own_width(self, mock_model_config):
        """The engine's own draw (not a re-implementation): a U0 trend never
        moves, an unscored trend stays inside the global ±1, a U5 trend uses
        offsets up to ±4."""
        cfg = mock_model_config.copy_with(peak_year_jitter=1)
        eng = BayesianMonteCarloEngine(cfg, seed=8)
        trends = _db([None, 0, 5]).trends
        _sched, offsets, probs = eng._peak_schedule_table(trends)
        idx = eng._draw_peak_offsets(probs, 6000)
        off = np.array(offsets)[idx]
        assert set(np.unique(off[:, 1])) == {0}
        assert set(np.unique(off[:, 0])) == {-1, 0, 1}
        assert off[:, 2].min() == -4 and off[:, 2].max() == 4
        # a single-offset grid consumes no randomness
        eng2 = BayesianMonteCarloEngine(cfg.copy_with(peak_year_jitter=0), seed=8)
        _s, o2, p2 = eng2._peak_schedule_table(trends)
        assert o2 == [0] and eng2._draw_peak_offsets(p2, 10).sum() == 0
        assert eng2.rng.random() == BayesianMonteCarloEngine(cfg, seed=8).rng.random()

    def test_run_result_reflects_the_clamp(self, mock_model_config):
        """With U3 on a start-2025 / peak-2027 driver 3 of 9 draws are fully in
        by 2026 and none is pushed to the horizon: the 2026 median must sit
        ABOVE the no-jitter 2026 level in magnitude, not far below it as the
        broken mapping produced."""
        cfg = mock_model_config.copy_with(iterations=4000, path_years=[2026, 2027, 2028, 2029, 2030])
        db = TrendDatabase(trends=[self._trend(3)], categories=list(CATEGORIES), forces=["Consumer"])
        r_on = BayesianMonteCarloEngine(cfg.copy_with(peak_year_jitter=1), seed=3).run(db)
        r_off = BayesianMonteCarloEngine(cfg.copy_with(peak_year_jitter=0), seed=3).run(db)
        m_on = r_on["shift_matrix"]["Hair: Care"]["path"][2026]["median"]
        m_off = r_off["shift_matrix"]["Hair: Care"]["path"][2026]["median"]
        assert m_on < 0 and m_off < 0
        assert abs(m_on) > abs(m_off) * 0.95


class TestMultichainEvents:
    def test_zero_row_event_listed_once_in_multichain(self, mock_model_config, mock_trends_database):
        from pulse.config import CATEGORIES as CATS, REGIONS
        W = {c: {r: 1.0 / (len(CATS) * len(REGIONS)) for r in REGIONS} for c in CATS}
        gone = CATS[0]
        freed = sum(W[gone].values())
        W[gone] = {r: 0.0 for r in REGIONS}
        W[CATS[1]] = {r: v + freed / len(REGIONS) for r, v in W[CATS[1]].items()}
        cfg = mock_model_config.copy_with(cell_weights=W, iterations=200)
        r = BayesianMonteCarloEngine(cfg, seed=1).run_multichain(mock_trends_database, n_chains=2, iterations=200)
        zero = [e for e in r["integrity_events"] if e.get("type") == "cell_weight_zero_row"]
        assert len(zero) == 1
