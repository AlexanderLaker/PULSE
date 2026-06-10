"""D19 (June 2026): input-drift telemetry unit tests."""
from pulse.audit.input_drift import (
    trend_fingerprint, compute_input_drift_event, previous_fingerprint_from_runs,
)


class _T:
    def __init__(self, id, p=3, g=0.1, d="Expansion", f="Consumer"):
        self.id, self.probability, self.gp1_pct_affected, self.direction, self.force = id, p, g, d, f


def _fp(*trends):
    return trend_fingerprint(list(trends))


def test_no_previous_returns_none():
    assert compute_input_drift_event(_fp(_T("a")), None) is None


def test_zero_drift_is_info_confirmation():
    fp = _fp(_T("a"), _T("b", f="Government", d="Contraction"))
    ev = compute_input_drift_event(fp, fp, previous_run_id=7)
    assert ev["type"] == "input_drift"
    assert ev["severity"] == "info"
    assert "no score changes" in ev["message"]


def test_score_change_and_direction_flip_counted():
    prev = _fp(_T("a", p=3, g=0.10), _T("b", d="Contraction", f="Government"))
    curr = _fp(_T("a", p=4, g=0.12), _T("b", d="Expansion", f="Government"))
    ev = compute_input_drift_event(curr, prev, previous_run_id=7)
    assert ev["severity"] == "warning"          # direction flip escalates
    assert "1 trend score(s) changed" in ev["message"]
    assert "(1 probability, 1 gp1)" in ev["message"]
    assert "1 direction flip" in ev["message"]
    assert ev["detail"]["direction_flips"] == ["b"]
    # b flipped Contraction->Expansion in Government: balance moves -1 -> +1 = +2
    assert ev["detail"]["per_force_balance_delta"] == {"Government": 2}


def test_added_and_removed_trends():
    prev = _fp(_T("a"))
    curr = _fp(_T("a"), _T("c", f="Technology"))
    ev = compute_input_drift_event(curr, prev)
    assert "1 trend(s) added, 0 removed" in ev["message"]
    assert ev["detail"]["added"] == ["c"]


def test_previous_fingerprint_extraction_tolerates_legacy_rows():
    fp, rid, rdate = previous_fingerprint_from_runs(
        [{"id": 9, "run_date": "2026-06-10 10:00:00", "results": "{\"shift_matrix\": {}}"}]
    )
    assert fp is None and rid == 9 and rdate.startswith("2026-06-10")
    fp2, rid2, _ = previous_fingerprint_from_runs(
        [{"id": 10, "results": {"meta": {"trend_fingerprint": {"x": {"p": 3}}}}}]
    )
    assert fp2 == {"x": {"p": 3}} and rid2 == 10
