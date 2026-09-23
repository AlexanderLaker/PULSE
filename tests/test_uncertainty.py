"""The uncertainty score: one 0-5 score per driver sets its Beta-prior concentration and peak-year jitter.

UNCERTAINTY_KAPPA gives the concentration kappa = alpha + beta (24/16/10/6/4/3)
with the mean p/6 unchanged; UNCERTAINTY_PEAK_JITTER gives the jitter width
(0/1/1/2/3/4 years). Every driver needs a score: a driver without one cannot
be simulated.
"""
import copy
import re
from pathlib import Path

import numpy as np
import pytest

from prism.config import UNCERTAINTY_KAPPA, UNCERTAINTY_PEAK_JITTER, beta_prior_for, peak_jitter_for
from prism.drivers import Driver, DriverSet, InvalidDriversError, simulation_problems
from prism.input_drift import compute_input_drift_event, driver_fingerprint
from prism.engine import MonteCarloEngine
from support import category_map, region_map


class TestPriorMapping:
    def test_concentration_follows_table_and_mean_is_preserved(self):
        for p in range(1, 6):
            for u in range(6):
                a, b = beta_prior_for(p, u)
                assert a + b == pytest.approx(UNCERTAINTY_KAPPA[u]), (p, u)
                assert a / (a + b) == pytest.approx(p / 6.0), (p, u)
                assert a >= 0.5 and b >= 0.5

    def test_score_3_gives_p_and_6_minus_p(self):
        for p in range(1, 6):
            assert beta_prior_for(p, 3) == pytest.approx((p, 6 - p))

    @pytest.mark.parametrize("probability, uncertainty", [(4, 9), (4, -2), (0, 3), (6, 3), (None, 3), (4, None)])
    def test_a_score_off_its_scale_is_refused(self, probability, uncertainty):
        with pytest.raises(ValueError, match="outside its scale"):
            beta_prior_for(probability, uncertainty)

    def test_the_dashboard_copies_of_the_tables_match(self):
        """lib/uncertainty.ts carries the two tables for the editor, the drill-down and the About
        this model section (tests/frontend/shiftAnalysis.test.tsx reads them there)."""
        src = (Path(__file__).resolve().parent.parent / "lib" / "uncertainty.ts").read_text(encoding="utf-8")

        def ts_array(name):
            match = re.search(rf"export const {name}: readonly number\[\] = \[([^\]]*)\];", src)
            assert match, name
            return [int(v) for v in match.group(1).split(",")]

        assert ts_array("UNCERTAINTY_KAPPA") == [UNCERTAINTY_KAPPA[u] for u in range(6)]
        assert ts_array("UNCERTAINTY_PEAK_JITTER") == [UNCERTAINTY_PEAK_JITTER[u] for u in range(6)]

    def test_jitter_table(self):
        assert [peak_jitter_for(u, True) for u in range(6)] == [0, 1, 1, 2, 3, 4]
        assert UNCERTAINTY_PEAK_JITTER[5] == 4

    def test_the_switch_off_silences_every_driver(self):
        """config.peak_year_jitter off means no timing jitter for any driver, whatever its score."""
        assert all(peak_jitter_for(u, False) == 0 for u in range(6))


class TestDriverModel:
    def test_driver_prior_uses_score_and_recomputes(self):
        d = Driver(id="u1", force="Consumer", direction="Expansion", probability=5, gp1_pct_affected=0.2,
                   uncertainty=3)
        assert d.probability_prior == pytest.approx((5, 1))
        d.uncertainty = 1
        d.recompute()
        a, b = d.probability_prior
        assert a + b == pytest.approx(16)
        assert d.expected_effect == pytest.approx(5 / 6 * 0.2)  # mean unchanged
        d.uncertainty = 7
        d.recompute()
        assert d.uncertainty == 7                              # never rewritten silently
        assert d.probability_prior == (3, 3)                   # neutral, so the driver can be built and checked
        assert any("uncertainty 7" in line for line in simulation_problems([d]))   # and a run refuses it

    def test_a_driver_without_a_score_cannot_be_simulated(self):
        d = Driver(id="u2", force="Consumer", probability=4, gp1_pct_affected=0.2)
        assert d.uncertainty is None and d.probability_prior == (3, 3)
        assert any("uncertainty None" in line for line in simulation_problems([d]))

    def test_fingerprint_carries_score_and_diffs_it(self):
        base = Driver(id="u1", force="Consumer", direction="Expansion", probability=4, gp1_pct_affected=0.1,
                     category_exposure=category_map({"Hair: Care": 3}), regional_exposure=region_map({"Europe": 5}),
                     vc_epicentre="Marketing", start_year=2025, peak_year=2029, diffusion_curve="linear",
                     uncertainty=2)
        fp0 = driver_fingerprint([base])
        assert fp0["u1"]["u"] == 2
        base.uncertainty = 4
        base.recompute()
        fp1 = driver_fingerprint([base])
        assert fp1["u1"]["u"] == 4
        ev = compute_input_drift_event(fp1, fp0, previous_run_id=1)
        assert ev is not None and "u1" in (ev.get("detail", {}).get("structure_changes") or [])


def _driver_set(uncertainties):
    drivers = []
    for i, u in enumerate(uncertainties):
        drivers.append(Driver(
            id=f"t{i}", force="Consumer", name=f"t{i}", direction="Contraction",
            probability=4, start_year=2025, gp1_pct_affected=0.20, peak_year=2029,
            diffusion_curve="linear", category_exposure=category_map({"Hair: Care": 5}),
            regional_exposure=region_map({"Europe": 5}), vc_epicentre="Marketing",
            uncertainty=u,
        ))
    return DriverSet(drivers=drivers)


def _velocity_width(r, cat="Hair: Care"):
    vel = r["shift_matrix"][cat]["velocity"]
    return sum(abs(v["p90"] - v["p10"]) for v in vel.values())


def _terminal_band(r, cat="Hair: Care"):
    path = r["shift_matrix"][cat]["path"]
    ly = max(path.keys())
    return path[ly]["p90"] - path[ly]["p10"]


class TestEngine:
    def test_score_0_disables_jitter_and_score_5_widens_it(self, mock_model_config):
        cfg = mock_model_config.copy_with(peak_year_jitter=True)
        r_u0_off = MonteCarloEngine(cfg.copy_with(peak_year_jitter=False), seed=11).run(_driver_set([0]), 3000)
        r_u0 = MonteCarloEngine(cfg, seed=11).run(_driver_set([0]), 3000)
        r_u3 = MonteCarloEngine(cfg, seed=11).run(_driver_set([3]), 3000)
        r_u5 = MonteCarloEngine(cfg, seed=11).run(_driver_set([5]), 3000)
        # Score 0 means no timing jitter for that driver: with the global switch
        # on it gives exactly the result of the switch off (same prior, same
        # copula stream; a grid with the single offset 0 draws no randomness).
        assert r_u0["shift_matrix"] == r_u0_off["shift_matrix"]
        w0, w3, w5 = (_velocity_width(x) for x in (r_u0, r_u3, r_u5))
        assert w3 > w0
        assert w5 > w3

    def test_global_switch_off_silences_scored_drivers_too(self, mock_model_config):
        cfg = mock_model_config.copy_with(peak_year_jitter=False)
        # With the switch off a score-5 driver draws no offset at all; switching
        # it on makes the +/-4 offsets live and widens the timing bands.
        r_u5_off = MonteCarloEngine(cfg, seed=2).run(_driver_set([5]), 2000)
        r_u5_on = MonteCarloEngine(cfg.copy_with(peak_year_jitter=True), seed=2).run(_driver_set([5]), 2000)
        assert r_u5_off["shift_matrix"] != r_u5_on["shift_matrix"]
        assert _velocity_width(r_u5_on) > _velocity_width(r_u5_off)

    def test_low_score_narrows_terminal_band_high_score_widens_it(self, mock_model_config):
        cfg = mock_model_config.copy_with(peak_year_jitter=False)
        bands = {}
        for u in (0, 3, 5):
            r = MonteCarloEngine(cfg, seed=5).run(_driver_set([u]), 4000)
            bands[u] = _terminal_band(r)
        assert bands[0] < bands[3] < bands[5]

    def test_mixed_scores_reproducible_under_seed(self, mock_model_config):
        cfg = mock_model_config.copy_with(peak_year_jitter=True)
        driver_set = _driver_set([1, 0, 2, 5])
        a = MonteCarloEngine(cfg, seed=3).run(driver_set, 2000)
        b = MonteCarloEngine(cfg, seed=3).run(driver_set, 2000)
        assert a["shift_matrix"] == b["shift_matrix"]
        c = MonteCarloEngine(cfg, seed=4).run(driver_set, 2000)
        assert a["shift_matrix"] != c["shift_matrix"]

    def test_mixed_scores_keep_each_drivers_own_offset_range(self, mock_model_config):
        """A score-0 driver never moves its peak, a score-2 driver stays inside
        +/-1, and a score-5 driver uses offsets up to +/-4."""
        cfg = mock_model_config.copy_with(peak_year_jitter=True)
        driver_set = _driver_set([2, 0, 5])
        eng = MonteCarloEngine(cfg, seed=8)
        # Re-create the offset draw the engine performs (same RNG consumption
        # order as _cell_shift_samples): copula draws first.
        drivers = driver_set.drivers
        R = eng.build_correlation_matrix(drivers)
        eng.generate_copula_samples(drivers, R, 5000)
        from prism.config import peak_jitter_for as pj
        widths = [pj(d.uncertainty, True) for d in drivers]
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
        import prism.database as dbm
        dbm.init_db()
        t = Driver(id="unc_1", force="Consumer", name="x", direction="Contraction",
                  probability=4, start_year=2025, gp1_pct_affected=0.2, peak_year=2029,
                  diffusion_curve="linear", category_exposure=category_map({"Hair: Care": 5}),
                  regional_exposure=region_map({"Europe": 5}), vc_epicentre="Marketing", uncertainty=2,
                  confidence="Medium")
        t.baseline = t.scores()
        dbm.insert_drivers([t])
        loaded = {x.id: x for x in dbm.load_drivers()}
        assert loaded["unc_1"].uncertainty == 2
        assert loaded["unc_1"].probability_prior == pytest.approx(beta_prior_for(4, 2))
        # the database stores no driver without a score
        unscored = copy.deepcopy(t)
        unscored.id, unscored.uncertainty = "unc_2", None
        with pytest.raises(InvalidDriversError, match="uncertainty None"):
            dbm.insert_drivers([unscored])
        assert [d.id for d in dbm.load_drivers()] == ["unc_1"]
        # proposals carry the field too
        row = dbm.upsert_driver_proposal("unc_1", "expert-a", {"uncertainty": 4, "probability": 3}, "A")
        assert row["uncertainty"] == 4
        rows = dbm.load_driver_proposals("unc_1")
        assert rows[0]["uncertainty"] == 4
        from prism.api.proposals import aggregate_proposals, build_proposal_summary
        agg = aggregate_proposals(rows)
        assert agg["uncertainty"] == {"median": 4, "count": 1}
        summ = build_proposal_summary(rows, "expert-a")
        assert summ["my"]["uncertainty"] == 4


class TestOnsetClamp:
    """A jittered peak that lands at or before the onset saturates at "peaks
    the year after the onset", the earliest arrival a schedule allows, so the
    earliest draws arrive earliest."""

    def _driver(self, u):
        return Driver(id="clamp", force="Consumer", name="c", direction="Contraction", probability=5,
                     start_year=2025, gp1_pct_affected=0.2, peak_year=2027, diffusion_curve="linear",
                     category_exposure=category_map({"Hair: Care": 5}), regional_exposure=region_map({"Europe": 5}),
                     vc_epicentre="Marketing", uncertainty=u)

    def test_schedule_table_is_monotone_earlier_for_negative_offsets(self, mock_model_config):
        cfg = mock_model_config.copy_with(peak_year_jitter=True,
                                          path_years=[2026, 2027, 2028, 2029, 2030])
        eng = MonteCarloEngine(cfg, seed=1)
        # start 2025, peak 2027, score 3 gives +/-2: offsets -2 and -1 land at or before the onset
        sched, offsets, probs = eng.peak_schedule_table([self._driver(3)])
        assert offsets == [-2, -1, 0, 1, 2]
        first = {o: sched[0, k, 0] for k, o in enumerate(offsets)}   # 2026 materialisation
        for o1, o2 in zip(offsets[:-1], offsets[1:]):
            assert first[o1] >= first[o2] - 1e-12, (o1, o2, first)
        assert first[-2] == pytest.approx(1.0) and first[-1] == pytest.approx(1.0)
        assert first[0] == pytest.approx(0.5)       # linear ramp from 2025 to 2027
        assert 0 < first[2] < first[0]              # later peak, less in by 2026
        assert probs[0].sum() == pytest.approx(1.0) and probs[0][2] == pytest.approx(3 / 9)

    def test_offset_draw_uses_each_drivers_own_width(self, mock_model_config):
        """The engine's own draw: score 0 never moves, score 2 stays inside +/-1,
        score 5 uses offsets up to +/-4."""
        cfg = mock_model_config.copy_with(peak_year_jitter=True)
        eng = MonteCarloEngine(cfg, seed=8)
        drivers = _driver_set([2, 0, 5]).drivers
        _sched, offsets, probs = eng.peak_schedule_table(drivers)
        idx = eng.draw_peak_offsets(probs, 6000)
        off = np.array(offsets)[idx]
        assert set(np.unique(off[:, 1])) == {0}
        assert set(np.unique(off[:, 0])) == {-1, 0, 1}
        assert off[:, 2].min() == -4 and off[:, 2].max() == 4
        # a single-offset grid consumes no randomness
        eng2 = MonteCarloEngine(cfg.copy_with(peak_year_jitter=False), seed=8)
        _s, o2, p2 = eng2.peak_schedule_table(drivers)
        assert o2 == [0] and eng2.draw_peak_offsets(p2, 10).sum() == 0
        assert eng2.rng.random() == MonteCarloEngine(cfg, seed=8).rng.random()

    def test_run_result_reflects_the_clamp(self, mock_model_config):
        """With score 3 on a driver starting 2025 and peaking 2027, 3 of 9 draws
        are fully in by 2026 and none is pushed to the horizon, so the 2026
        median is at least the no-jitter level in magnitude."""
        cfg = mock_model_config.copy_with(path_years=[2026, 2027, 2028, 2029, 2030])
        driver_set = DriverSet(drivers=[self._driver(3)])
        r_on = MonteCarloEngine(cfg.copy_with(peak_year_jitter=True), seed=3).run(driver_set, 4000)
        r_off = MonteCarloEngine(cfg.copy_with(peak_year_jitter=False), seed=3).run(driver_set, 4000)
        m_on = r_on["shift_matrix"]["Hair: Care"]["path"][2026]["median"]
        m_off = r_off["shift_matrix"]["Hair: Care"]["path"][2026]["median"]
        assert m_on < 0 and m_off < 0
        assert abs(m_on) > abs(m_off) * 0.95


class TestMultichainEvents:
    def test_zero_row_event_listed_once_in_multichain(self, mock_model_config, mock_driver_set):
        from prism.config import CATEGORIES as CATS, REGIONS
        W = {c: {r: 1.0 / (len(CATS) * len(REGIONS)) for r in REGIONS} for c in CATS}
        gone = CATS[0]
        freed = sum(W[gone].values())
        W[gone] = {r: 0.0 for r in REGIONS}
        W[CATS[1]] = {r: v + freed / len(REGIONS) for r, v in W[CATS[1]].items()}
        cfg = mock_model_config.copy_with(cell_weights=W)
        r = MonteCarloEngine(cfg, seed=1).run_multichain(mock_driver_set, n_chains=2, iterations=200)
        zero = [e for e in r["integrity_events"] if e.get("type") == "cell_weight_zero_row"]
        assert len(zero) == 1
