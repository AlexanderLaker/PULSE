"""The value-chain epicentre: Python twin of tests/frontend/vcEpicentre.test.ts.

The engine reads the value chain as one epicentre stage per driver, derived
from the stored eight-step profile by prism.config.vc_epicentre_of. The
dashboard's epicentreOf (lib/valueChain.ts) must behave identically, so both
suites pin the same fixture table; change them together.
"""
from prism.config import VC_STEPS, vc_epicentre_of, vc_epicentre_step_of
from prism.drivers import Driver
from prism.input_drift import compute_input_drift_event, driver_fingerprint


def _canonical(stage: int) -> dict:
    """The 5/3/1 profile the editor writes (canonicalVcProfile in lib/valueChain.ts)."""
    falloff = [5, 3, 1]
    return {
        s: (falloff[abs(i + 1 - stage)] if abs(i + 1 - stage) < len(falloff) else 0)
        for i, s in enumerate(VC_STEPS)
    }


class TestCanonicalProfileShape:
    """The profile shape the editor writes and the engine reads back."""

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
    """The parity table, mirrored by describe('epicentreOf') in the vitest suite."""

    def test_round_trips_canonical_profiles_for_every_stage(self):
        for stage in range(1, 9):
            assert vc_epicentre_of(_canonical(stage)) == stage, stage

    def test_none_for_unscored_or_all_zero(self):
        assert vc_epicentre_of(None) is None
        assert vc_epicentre_of({}) is None
        assert vc_epicentre_of({"Marketing": 0, "Consumer": 0}) is None

    def test_picks_the_highest_stage_of_any_profile(self):
        assert vc_epicentre_of({
            "Manufacturing": 1, "Packaging": 1, "Supply Chain": 2,
            "Marketing": 4, "Commercial": 5, "Consumer": 4,
        }) == VC_STEPS.index("Commercial") + 1

    def test_ties_resolve_toward_exposure_weighted_centroid(self):
        # Max 3 at Raw Materials and Consumer; the Commercial weight pulls the
        # centroid downstream, so Consumer (8) wins the tie.
        assert vc_epicentre_of({"Raw Materials": 3, "Commercial": 2, "Consumer": 3}) == 8

    def test_a_flat_profile_resolves_to_the_earlier_central_stage(self):
        # A flat profile ties at all eight stages; its centroid is 4.5 and the
        # earlier of the two equally near stages wins: stage 4, Packaging.
        assert vc_epicentre_of({s: 2 for s in VC_STEPS}) == 4

    def test_keys_outside_the_eight_stages_are_ignored(self):
        assert vc_epicentre_of({"supply_chain": 5, "Manufacturing": 2}) == VC_STEPS.index("Manufacturing") + 1

    def test_step_name_helper(self):
        assert vc_epicentre_step_of(_canonical(6)) == "Marketing"
        assert vc_epicentre_step_of({}) is None


def _driver(vc) -> Driver:
    return Driver(id="a", force="Consumer", probability=3, gp1_pct_affected=0.1, vc_exposure=vc)


class TestDriftFollowsTheStage:
    """The drift fingerprint stores the derived stage, not the stored profile."""

    def test_the_fingerprint_stores_the_stage(self):
        assert driver_fingerprint([_driver(_canonical(6))])["a"]["ve"] == 6
        assert driver_fingerprint([_driver({})])["a"]["ve"] is None

    def test_moving_the_stage_is_drift(self):
        event = compute_input_drift_event(driver_fingerprint([_driver(_canonical(2))]),
                                          driver_fingerprint([_driver(_canonical(6))]), previous_run_id=1)
        assert event["detail"]["structure_changes"] == ["a"]

    def test_rewriting_the_profile_around_the_same_stage_is_not(self):
        before = driver_fingerprint([_driver({"Supply Chain": 2, "Marketing": 4, "Commercial": 1})])
        after = driver_fingerprint([_driver(_canonical(6))])
        assert compute_input_drift_event(after, before, previous_run_id=1)["detail"]["structure_changes"] == []
