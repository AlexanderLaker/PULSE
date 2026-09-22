"""The overlap correction: prism/config.py equals the generated record, and the record is reproducible.

All three layers (per-force attenuation, within-force overlap, cross-force
matrix) come from one record, data/calibration/attenuation.json, written by
scripts/compute_attenuation.py from the driver base. The correction depends
on the category exposure space, so a taxonomy or exposure change must be
followed by a re-run; these tests fail until it is.
"""
import importlib.util
import json
from pathlib import Path

import numpy as np
import pytest

from prism import config as C
from prism.config_validation import validate_model_config

REPO = Path(__file__).resolve().parent.parent
RECORD = REPO / "data" / "calibration" / "attenuation.json"


@pytest.fixture(scope="module")
def record():
    return json.loads(RECORD.read_text(encoding="utf-8"))


def _script():
    spec = importlib.util.spec_from_file_location("compute_attenuation", REPO / "scripts" / "compute_attenuation.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class TestConfigEqualsTheRecord:
    def test_source_label(self, record):
        assert C.DEFAULT_ATTENUATION_SOURCE == record["calibration_version"]

    def test_per_force_attenuation(self, record):
        assert C.DEFAULT_PER_FORCE_ATTENUATION == record["per_force_effective_attenuation"]

    def test_within_force_overlap(self, record):
        assert C.DEFAULT_WITHIN_FORCE_OVERLAP == record["within_force_final"]

    def test_cross_force_matrix(self, record):
        for i in C.FORCES:
            for j in C.FORCES:
                expected = 0.0 if i == j else record["cross_force_final"][i][j]
                assert C.DEFAULT_FORCE_OVERLAP_MATRIX[i][j] == pytest.approx(expected, abs=1e-12), (i, j)

    def test_config_holds_the_printed_blocks_verbatim(self, record):
        """The script prints the three constants as they appear in prism/config.py."""
        source = (REPO / "prism" / "config.py").read_text(encoding="utf-8")
        for block in _script().config_literals(record).split("\n\n"):
            assert block.strip() in source, block.splitlines()[0]

    def test_attenuation_follows_from_the_matrix(self):
        for i in C.FORCES:
            row = [C.DEFAULT_FORCE_OVERLAP_MATRIX[i][j] for j in C.FORCES if j != i]
            assert C.DEFAULT_PER_FORCE_ATTENUATION[i] == pytest.approx(round(0.5 * (1 - sum(row) / len(row)), 3))

    def test_bounds(self, record):
        assert record["n_drivers"] == 51
        for f in C.FORCES:
            assert 0.10 <= C.DEFAULT_WITHIN_FORCE_OVERLAP[f] <= 0.45
            assert 0.0 < C.DEFAULT_PER_FORCE_ATTENUATION[f] <= 0.5
            assert all(0.0 <= v <= 0.45 for v in C.DEFAULT_FORCE_OVERLAP_MATRIX[f].values())

    def test_every_mechanism_adjustment_has_a_reason(self, record):
        for f in C.FORCES:
            assert record["within_force_mechanism_reason"][f]
        for i in C.FORCES:
            for j in C.FORCES:
                if i != j and record["cross_force_mechanism_adj"][i][j]:
                    assert record["cross_force_mechanism_reason"][f"{i}->{j}"], (i, j)
                    assert abs(record["cross_force_mechanism_adj"][i][j]) <= 0.10


class TestReproducible:
    def test_the_script_regenerates_the_record(self, record, tmp_path):
        out = tmp_path / "attenuation.json"
        _script().compute(out_json=out, verbose=False)
        assert json.loads(out.read_text(encoding="utf-8")) == record

    def test_the_check_passes_and_catches_a_stale_config(self, monkeypatch, tmp_path, capsys):
        script = _script()
        assert script.main(["--check"]) == 0
        stale = tmp_path / "attenuation.json"
        stale.write_text("{}", encoding="utf-8")
        monkeypatch.setattr(script, "OUT_JSON", stale)
        monkeypatch.setattr(script, "REPO", tmp_path)
        (tmp_path / "prism").mkdir()
        (tmp_path / "prism" / "config.py").write_text("# no blocks", encoding="utf-8")
        assert script.main(["--check"]) == 1
        out = capsys.readouterr().out
        assert "differs from the derivation" in out and "does not hold the three blocks" in out


class TestCopula:
    def test_default_correlations_are_positive_definite_on_the_driver_base(self, record):
        from prism.seed_drivers import DRIVERS
        R = C.build_driver_correlation_matrix([d.force for d in DRIVERS], C.DEFAULT_WITHIN_FORCE_RHO,
                                              C.DEFAULT_FORCE_CORRELATIONS)
        lam = float(np.linalg.eigvalsh(np.asarray(R)).min())
        assert lam > 0.0
        assert lam == pytest.approx(record["correlation_lambda_min"], abs=1e-6)

    def test_the_default_configuration_validates(self):
        validate_model_config(C.ModelConfig())
