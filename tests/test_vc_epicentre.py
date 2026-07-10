"""VC epicentre invariants — Python twin of tests/frontend/vcEpicentre.test.ts.

2.9.0 (July 2026 VC-epicentre attribution): the engine consumes the value
chain as ONE categorical epicentre stage per trend, derived from the stored
8-step profile by ``pulse.config.vc_epicentre_of``. That function and the
frontend's ``epicentreOf`` (components/dashboard/Trends2.tsx) MUST stay
behaviourally identical — this file pins the Python side against the SAME
fixture table the vitest suite pins the TS side against. If one side
changes, change both files in the same commit.

Also pinned here: the input-drift "ve" semantics (an epicentre flip is
drift; a representation rewrite with the same epicentre is not) and the
pre-2.9 dict-format back-compat path.
"""

import pytest

from pulse.config import VC_STEPS, vc_epicentre_of, vc_epicentre_step_of
from pulse.audit.input_drift import trend_fingerprint, compute_input_drift_event


def _canonical(stage: int) -> dict:
    """5/3/1 falloff profile — mirror of Trends2.tsx canonicalVcProfile."""
    falloff = [5, 3, 1]
    return {
        s: (falloff[abs(i + 1 - stage)] if abs(i + 1 - stage) < len(falloff) else 0)
        for i, s in enumerate(VC_STEPS)
    }


class TestCanonicalProfileShape:
    """The serialization contract this module must be able to read back."""

    def test_canonical_profile_stage_6(self):
        # Same literal expectation as the vitest case for stage 6.
        assert _canonical(6) == {
            "Raw Materials": 0, "Formulation": 0, "Manufacturing": 0,
            "Packaging": 1, "Supply Chain": 3, "Marketing": 5,
            "Commercial": 3, "Consumer": 1,
        }

    def test_canonical_profile_clips_at_ends(self):
        assert _canonical(1) == {
            "Raw Materials": 5, "Formulation": 3, "Manufacturing": 1,
            "Packaging": 0, "Supply Chain": 0, "Marketing": 0,
            "Commercial": 0, "Consumer": 0,
        }
        assert _canonical(8) == {
            "Raw Materials": 0, "Formulation": 0, "Manufacturing": 0,
            "Packaging": 0, "Supply Chain": 0, "Marketing": 1,
            "Commercial": 3, "Consumer": 5,
        }


class TestEpicentreOf:
    """Parity fixture table — mirror of describe('epicentreOf') in vitest."""

    def test_round_trips_canonical_profiles_for_every_stage(self):
        for stage in range(1, 9):
            assert vc_epicentre_of(_canonical(stage)) == stage, stage

    def test_none_for_unscored_or_all_zero(self):
        assert vc_epicentre_of(None) is None
        assert vc_epicentre_of({}) is None
        assert vc_epicentre_of({"Marketing": 0, "Consumer": 0}) is None

    def test_picks_max_of_arbitrary_legacy_profile(self):
        assert vc_epicentre_of({
            "Manufacturing": 1, "Packaging": 1, "Supply Chain": 2,
            "Marketing": 4, "Commercial": 5, "Consumer": 4,
        }) == VC_STEPS.index("Commercial") + 1

    def test_ties_resolve_toward_exposure_weighted_centroid(self):
        # Max 3 at Raw Materials and Consumer; the Commercial weight pulls
        # the centroid downstream → Consumer (8) wins the tie.
        assert vc_epicentre_of({"Raw Materials": 3, "Commercial": 2, "Consumer": 3}) == 8

    def test_reads_snake_case_fallback_keys(self):
        assert vc_epicentre_of({"supply_chain": 5, "manufacturing": 2}) == 5

    def test_flat_profile_resolves_to_centroid_stage(self):
        # Legacy flat grids (every step equal) tie at all 8 stages; the
        # centroid of a uniform profile is 4.5 and the first equally-near
        # stage wins (TS `<` comparison) → stage 4, "Packaging". Pinned so
        # legacy databases collapse identically on both sides.
        assert vc_epicentre_of({s: 2 for s in VC_STEPS}) == 4

    def test_step_name_helper(self):
        assert vc_epicentre_step_of(_canonical(6)) == "Marketing"
        assert vc_epicentre_step_of({}) is None


class _T:
    """Minimal trend stub for fingerprint tests (mirrors test_input_drift)."""

    def __init__(self, id, vc=None, p=3, g=0.1, d="Expansion", f="Consumer"):
        self.id, self.probability, self.gp1_pct_affected = id, p, g
        self.direction, self.force = d, f
        if vc is not None:
            self.vc_exposure = vc


class TestDriftVeSemantics:
    """2.9.0: "ve" fingerprints the DERIVED stage, not the raw profile."""

    def test_fingerprint_stores_stage_not_profile(self):
        fp = trend_fingerprint([_T("a", vc=_canonical(6))])
        assert fp["a"]["ve"] == 6
        fp_unscored = trend_fingerprint([_T("b", vc={})])
        assert fp_unscored["b"]["ve"] is None

    def test_epicentre_flip_is_structural_drift(self):
        prev = trend_fingerprint([_T("a", vc=_canonical(6))])
        curr = trend_fingerprint([_T("a", vc=_canonical(2))])
        ev = compute_input_drift_event(curr, prev, previous_run_id=1)
        assert ev["detail"]["structure_changes"] == ["a"]

    def test_representation_rewrite_is_not_drift(self):
        # A legacy arbitrary profile and the canonical slider profile with
        # the SAME epicentre must not read as drift — only the stage feeds
        # the attribution, and the stage did not move.
        legacy = {"Supply Chain": 2, "Marketing": 4, "Commercial": 1}   # epicentre 6
        prev = trend_fingerprint([_T("a", vc=legacy)])
        curr = trend_fingerprint([_T("a", vc=_canonical(6))])
        ev = compute_input_drift_event(curr, prev, previous_run_id=1)
        # Zero-drift confirmation event — the rewrite is invisible, as designed.
        assert "no score changes" in ev["message"]

    def test_pre29_dict_format_fingerprint_diffs_cleanly(self):
        # A pre-2.9 persisted fingerprint carries the raw profile dict for
        # "ve". The comparison collapses it to a stage first — same stage →
        # no false structural drift on the first post-upgrade run.
        curr = trend_fingerprint([_T("a", vc=_canonical(6))])
        prev = {"a": dict(curr["a"], ve={"Marketing": 4.0, "Supply Chain": 2.0})}  # epicentre 6
        ev = compute_input_drift_event(curr, prev, previous_run_id=1)
        assert "no score changes" in ev["message"]
        # …and a genuinely moved stage in old format IS drift.
        prev_moved = {"a": dict(curr["a"], ve={"Formulation": 5.0})}    # epicentre 2
        ev2 = compute_input_drift_event(curr, prev_moved, previous_run_id=1)
        assert ev2["detail"]["structure_changes"] == ["a"]
