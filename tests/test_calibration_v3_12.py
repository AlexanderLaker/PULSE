"""v3.12 calibration (2.12.0, owner ruling O13): the engine defaults in
pulse/config.py must be exactly the values of the generated record
data/attenuation_calibration_v3_12.json, the record must be reproducible
from the seed by scripts/compute_attenuation_v3_12.py, the identity
eff_att = 0.5 x (1 - mean cross-force row overlap) must hold between the
matrix and the attenuation, and the default copula matrix must be PSD on
the 51-driver population (D1 / F6).

The calibration is a FUNCTION OF THE CATEGORY EXPOSURE SPACE (pairwise
weighted Jaccard over the category vectors), so splitting "LHC: TOI" out of
"LHC: HSC" — 12 columns to 13 — moves it. v3.12 is the same method and the
same mechanism adjustments as v3.11 re-run on the 13-column space; the v3.11
script and record stay in the repo as the superseded provenance.

Background (FINDINGS_REGISTER F-28): before 2.11.0 the within-force overlap
and the cross-force matrix in config.py were the v3.1 numbers labelled v3.5
while the per-force attenuation was v3.5 — three layers, two provenances.
This lock makes that drift impossible: one JSON, one script, one test.
"""

import importlib.util
import json
from pathlib import Path

import numpy as np
import pytest

from pulse import config as C
from pulse.config_validation import ModelConfigValidator, validate_model_config

REPO = Path(__file__).resolve().parent.parent
JSON_PATH = REPO / "data" / "attenuation_calibration_v3_12.json"


@pytest.fixture(scope="module")
def cal():
    return json.loads(JSON_PATH.read_text(encoding="utf-8"))


class TestDefaultsEqualTheRecord:
    def test_source_tag(self, cal):
        assert C.DEFAULT_ATTENUATION_SOURCE == cal["calibration_version"] == "calibrated_v3.12_september2026"

    def test_per_force_attenuation(self, cal):
        assert C.DEFAULT_PER_FORCE_ATTENUATION == cal["per_force_effective_attenuation"]

    def test_within_force_overlap(self, cal):
        assert C.DEFAULT_WITHIN_FORCE_OVERLAP == cal["within_force_final"]

    def test_cross_force_matrix(self, cal):
        for i in C.FORCES:
            for j in C.FORCES:
                expected = 0.0 if i == j else cal["cross_force_final"][i][j]
                assert C.DEFAULT_FORCE_OVERLAP_MATRIX[i][j] == pytest.approx(expected, abs=1e-12), (i, j)

    def test_identity_between_matrix_and_attenuation(self):
        for i in C.FORCES:
            row = [C.DEFAULT_FORCE_OVERLAP_MATRIX[i][j] for j in C.FORCES if j != i]
            assert C.DEFAULT_PER_FORCE_ATTENUATION[i] == pytest.approx(round(0.5 * (1 - sum(row) / len(row)), 3), abs=1e-9), i

    def test_population_and_bounds(self, cal):
        assert cal["n_trends"] == 51
        assert cal["force_counts"] == {"Consumer": 20, "Customer": 7, "Technology": 6,
                                       "Government": 10, "Environmental": 4, "Competitive": 4}
        for f in C.FORCES:
            assert 0.10 <= C.DEFAULT_WITHIN_FORCE_OVERLAP[f] <= 0.45
            assert 0.0 < C.DEFAULT_PER_FORCE_ATTENUATION[f] <= 0.5
            for g in C.FORCES:
                assert 0.0 <= C.DEFAULT_FORCE_OVERLAP_MATRIX[f][g] <= 0.45
        assert abs(cal["trend_weighted_mean_attenuation"] - 0.452) < 0.02  # sanity vs v3.1/v3.5 (~0.45)

    def test_every_mechanism_adjustment_has_a_reason(self, cal):
        for f in C.FORCES:
            assert cal["within_force_mechanism_reason"][f]
        for i in C.FORCES:
            for j in C.FORCES:
                if i != j and cal["cross_force_mechanism_adj"][i][j]:
                    assert f"{i}->{j}" in cal["cross_force_mechanism_reason"], (i, j)
                    assert abs(cal["cross_force_mechanism_adj"][i][j]) <= 0.10


class TestReproducible:
    def test_script_regenerates_the_record(self, cal, tmp_path):
        spec = importlib.util.spec_from_file_location("compute_attenuation_v3_12",
                                                      REPO / "scripts" / "compute_attenuation_v3_12.py")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        out = mod.main(out_json=tmp_path / "cal.json", verbose=False)
        regenerated = json.loads((tmp_path / "cal.json").read_text(encoding="utf-8"))
        assert regenerated == cal
        assert out["per_force_effective_attenuation"] == C.DEFAULT_PER_FORCE_ATTENUATION


class TestCopulaValidityOn51:
    def test_defaults_are_psd_on_the_seed_population(self, cal):
        from pulse.seed_trends import get_report_trends
        forces = [t.force for t in get_report_trends()]
        R = np.asarray(C.build_trend_correlation_matrix(forces, C.DEFAULT_WITHIN_FORCE_RHO,
                                                        C.DEFAULT_FORCE_CORRELATIONS), dtype=float)
        lam = float(np.linalg.eigvalsh(R).min())
        assert lam > 0.0
        assert lam == pytest.approx(cal["correlation_lambda_min_51"], abs=1e-6)
        assert cal["correlation_defaults_kept"] is True


class TestValidatorAcceptsTheTag:
    def test_default_config_validates(self):
        validate_model_config(C.ModelConfig().__dict__)

    def test_legacy_tags_still_accepted_and_unknown_rejected(self):
        base = ModelConfigValidator.model_validate(
            {k: v for k, v in C.ModelConfig().__dict__.items() if k in ModelConfigValidator.model_fields})
        assert base.attenuation_source == "calibrated_v3.12_september2026"
        data = base.model_dump()
        # A run persisted before the Toilet Care split carries the v3.11 tag,
        # and older ones the v3.5 tag: both must still load.
        for legacy in ("calibrated_v3.11_september2026", "calibrated_v3.5_april2026",
                       "calibrated_v3.1_april2026"):
            data["attenuation_source"] = legacy
            ModelConfigValidator.model_validate(data)
        data["attenuation_source"] = "calibrated_v9"
        with pytest.raises(Exception):
            ModelConfigValidator.model_validate(data)
