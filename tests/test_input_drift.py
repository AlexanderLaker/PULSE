"""Input-drift telemetry: every run compares the driver scores with the previous run's."""
from prism.config import CATEGORIES, REGIONS, VC_STAGES
from prism.drivers import Driver
from prism.input_drift import compare_with_run, compute_input_drift_event, driver_fingerprint, incomplete_entries


def _driver(id_, probability=3, gp1=0.1, direction="Expansion", force="Consumer", vc_epicentre=VC_STAGES[5], **kw):
    scores = dict(start_year=2025, uncertainty=2)
    scores.update(kw)
    return Driver(id=id_, force=force, probability=probability, gp1_pct_affected=gp1, direction=direction,
                  category_exposure={c: 3 if c == "Hair: Care" else 0 for c in CATEGORIES},
                  regional_exposure={r: 5 if r == "Europe" else 0 for r in REGIONS},
                  vc_epicentre=vc_epicentre, peak_year=2030, diffusion_curve="s_curve", **scores)


def _fp(*drivers):
    return driver_fingerprint(list(drivers))


def test_the_first_run_has_nothing_to_compare():
    assert compute_input_drift_event(_fp(_driver("a")), None) is None


def test_no_change_is_recorded_too():
    fp = _fp(_driver("a"), _driver("b", force="Government", direction="Contraction"))
    event = compute_input_drift_event(fp, fp, previous_run_id=7, previous_run_date="2026-09-13 23:04:39")
    assert event["type"] == "input_drift" and event["severity"] == "info"
    assert event["message"] == ("Input drift vs run #7, 2026-09-13 23:04:39: no changes; "
                                "the driver inputs are identical to that run's.")
    assert event["detail"]["scores_changed"] == 0 and event["detail"]["added"] == []


def test_score_changes_and_a_direction_flip():
    previous = _fp(_driver("a", probability=3, gp1=0.10), _driver("b", direction="Contraction", force="Government"))
    current = _fp(_driver("a", probability=4, gp1=0.12), _driver("b", direction="Expansion", force="Government"))
    event = compute_input_drift_event(current, previous, previous_run_id=7)
    assert event["severity"] == "warning"
    assert event["message"] == ("Input drift vs run #7: 1 driver score(s) changed (1 probability, 1 GP1 share), "
                                "1 direction flip(s); per-force balance change: Government +2.")
    assert event["detail"]["direction_flips"] == ["b"]
    assert event["detail"]["per_force_balance_delta"] == {"Government": 2}


def test_structural_changes_are_counted_separately():
    previous = _fp(_driver("a"))
    current = _fp(_driver("a", uncertainty=4))
    event = compute_input_drift_event(current, previous)
    assert event["severity"] == "info" and event["detail"]["structure_changes"] == ["a"]
    assert "1 structural change(s)" in event["message"]


def test_the_onset_year_is_structural():
    event = compute_input_drift_event(_fp(_driver("a", start_year=2029)), _fp(_driver("a", start_year=2027)))
    assert event["detail"]["structure_changes"] == ["a"]
    assert "(force, exposures, value-chain epicentre, onset, peak year, curve or uncertainty)" in event["message"]


def test_a_move_to_another_force_is_structural():
    event = compute_input_drift_event(_fp(_driver("a", force="Customer")), _fp(_driver("a", force="Consumer")))
    assert event["detail"]["structure_changes"] == ["a"]
    assert event["detail"]["per_force_balance_delta"]


def test_every_field_that_moves_the_simulation_is_fingerprinted():
    assert set(_fp(_driver("a"))["a"]) == {"p", "g", "d", "f", "ce", "ve", "re", "s", "pk", "dc", "u"}


def test_the_value_chain_stage_is_fingerprinted_by_its_place_in_the_chain():
    """"ve" is the epicentre's position in VC_STAGES, 1 to 8, the value the stored
    runs carry; moving the stage is drift."""
    assert _fp(_driver("a"))["a"]["ve"] == 6
    moved = _fp(_driver("a", vc_epicentre=VC_STAGES[1]))
    assert compute_input_drift_event(moved, _fp(_driver("a")))["detail"]["structure_changes"] == ["a"]


def test_adding_a_driver_is_a_warning():
    event = compute_input_drift_event(_fp(_driver("a"), _driver("c", force="Technology")), _fp(_driver("a")))
    assert event["severity"] == "warning" and event["detail"]["added"] == ["c"]
    assert "1 driver(s) added, 0 removed" in event["message"]


def _run(fingerprint, run_id=12):
    return {"id": run_id, "run_date": "2026-03-02 10:15:00.500000",
            "results": {"meta": {"driver_fingerprint": fingerprint}}}


def test_a_new_run_is_compared_with_the_newest_stored_run():
    assert compare_with_run(_fp(_driver("a")), None) is None   # the first run
    event = compare_with_run(_fp(_driver("a", probability=4)), _run(_fp(_driver("a"))))
    assert event["message"].startswith("Input drift vs run #12, 2026-03-02 10:15:00: 1 driver score(s) changed")


def test_a_run_that_cannot_be_compared_with_says_so():
    """A stored run without a complete fingerprint gives a warning, never the silence of a first run."""
    complete = _fp(_driver("a"))
    partial = {"a": {k: v for k, v in complete["a"].items() if k != "u"}}
    assert incomplete_entries(complete) == [] and incomplete_entries(partial) == ["a"]
    assert incomplete_entries(["not", "a", "map"]) == ["(not a map)"]
    for stored, reason in ((None, "it stored no driver fingerprint"),
                           (["a"], "its driver fingerprint is not a map of drivers"),
                           (partial, "its driver fingerprint is incomplete for 1 driver")):
        event = compare_with_run(complete, _run(stored))
        assert event["severity"] == "warning" and event["detail"] == {
            "previous_run_id": 12, "compared": False, "reason": reason}
        assert event["message"] == f"Input drift was not compared with run #12, 2026-03-02 10:15:00: {reason}."
