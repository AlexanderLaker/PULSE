"""The driver base: data/drivers/driver_base.json, the generated seed module and the code map."""
import copy
import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path

import pytest

from prism import seed_drivers
from prism.config import CATEGORIES, REGIONS, VALID_DIFFUSION_CURVES, VC_STEPS, display_code, vc_epicentre_step_of
from prism.drivers import SCORE_FIELDS

REPO = Path(__file__).resolve().parent.parent
BASE = REPO / "data" / "drivers" / "driver_base.json"
CODEMAP = REPO / "data" / "driverCodeMap.ts"
LETTER = {"Consumer": "C", "Customer": "K", "Technology": "T", "Government": "G",
          "Environmental": "E", "Competitive": "X"}


def _generator():
    spec = importlib.util.spec_from_file_location("generate_seed", REPO / "scripts" / "generate_seed.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _codemap() -> dict:
    src = CODEMAP.read_text(encoding="utf-8")
    return {m.group(1): json.loads(m.group(2)) for m in re.finditer(r"^  '([A-Z]-\d\d)': (\{.*\}),$", src, re.M)}


class TestSeed:
    def test_population(self):
        drivers = seed_drivers.DRIVERS
        assert len(drivers) == len({d.id for d in drivers}) == 51
        counts = {}
        for d in drivers:
            counts[d.force] = counts.get(d.force, 0) + 1
        assert counts == {"Consumer": 20, "Customer": 7, "Competitive": 4, "Technology": 6,
                          "Government": 10, "Environmental": 4}
        assert sum(d.direction == "Contraction" for d in drivers) == 33

    def test_every_driver_is_complete_and_in_range(self):
        for d in seed_drivers.DRIVERS:
            assert d.id.startswith(d.force.lower() + "_r"), d.id
            assert d.direction in ("Expansion", "Contraction") and 1 <= d.probability <= 5
            assert 0 < d.gp1_pct_affected <= 1 and 2025 <= d.start_year <= d.peak_year <= 2035
            assert d.diffusion_curve in VALID_DIFFUSION_CURVES and d.confidence in ("Low", "Medium", "High")
            assert 0 <= d.uncertainty <= 5
            assert set(d.category_exposure) == set(CATEGORIES) and set(d.regional_exposure) == set(REGIONS)
            assert set(d.vc_exposure) == set(VC_STEPS) and vc_epicentre_step_of(d.vc_exposure) is not None
            assert max(d.category_exposure.values()) > 0 and max(d.regional_exposure.values()) > 0
            assert d.name and d.description and d.analysis
            assert d.sources and all(s["url"].startswith("http") and s["tier"] in ("S", "A", "B") for s in d.sources)
            assert d.baseline is None and d.scores_edited is False

    def test_seeding_records_the_baseline_on_copies(self):
        seeded = seed_drivers.get_seed_drivers()
        for d, original in zip(seeded, seed_drivers.DRIVERS):
            assert d is not original and original.baseline is None
            assert d.baseline == {name: getattr(original, name) for name in SCORE_FIELDS}

    def test_the_seed_equals_the_driver_base(self):
        """The generated module builds the same drivers the attribution build reads from the JSON."""
        from_base = {d.id: d for d in _generator().base_drivers()}
        assert set(from_base) == {d.id for d in seed_drivers.DRIVERS}
        for d in seed_drivers.DRIVERS:
            b = from_base[d.id]
            for field in ("force", "name", "description", "direction", "probability", "start_year", "gp1_pct_affected",
                          "peak_year", "diffusion_curve", "uncertainty", "confidence", "category_exposure",
                          "vc_exposure", "regional_exposure", "sources"):
                assert getattr(d, field) == getattr(b, field), (d.id, field)

    def test_the_committed_files_are_the_generator_output(self):
        r = subprocess.run([sys.executable, str(REPO / "scripts" / "generate_seed.py"), "--check"],
                           cwd=REPO, capture_output=True, text=True, timeout=120)
        assert r.returncode == 0, r.stdout + r.stderr


class TestBaseValidation:
    """The generator refuses a base the engine or the dashboard could not use."""

    @pytest.mark.parametrize("change", [
        {"probability": 6},
        {"start_year": 2031, "peak_year": 2030},
        {"diffusion_curve": "exponential"},
        {"vc_epicentre": "Shelf"},
        {"code": "C-99"},
        {"sources": [{"title": "Blog", "url": "https://example.com", "tier": "E", "published": ""}]},
    ])
    def test_a_bad_entry_is_refused(self, change):
        gen = _generator()
        drivers = json.loads(BASE.read_text(encoding="utf-8"))["drivers"]
        bad = copy.deepcopy(drivers)
        bad[0].update(change)
        with pytest.raises(SystemExit):
            gen.validate(bad)

    def test_a_missing_category_is_refused(self):
        gen = _generator()
        bad = copy.deepcopy(json.loads(BASE.read_text(encoding="utf-8"))["drivers"])
        del bad[0]["category_exposure"]["LHC: TOI"]
        with pytest.raises(SystemExit):
            gen.validate(bad)


class TestCodeMap:
    def test_one_code_per_driver(self):
        live = _codemap()
        drivers = {d.id: d for d in seed_drivers.DRIVERS}
        assert len(live) == 51 and {v["driverId"] for v in live.values()} == set(drivers)
        for code, info in live.items():
            d = drivers[info["driverId"]]
            letter, number = code.split("-")
            assert letter == LETTER[d.force] and d.id.endswith(f"_r{number}"), code
            assert (info["name"], info["force"], info["direction"]) == (d.name, d.force, d.direction)
            # a whole first sentence, not a fragment cut at an initialism
            assert len(info["fallbackDescription"]) >= 40, (code, info["fallbackDescription"])

    def test_an_initialism_does_not_end_the_first_sentence(self):
        gen = _generator()
        assert gen.first_sentence("P.L. 119-21 expanded the rules. States pay more.") == "P.L. 119-21 expanded the rules."
        assert gen.first_sentence("Demand in the U.S. falls by 3%. Prices hold.") == "Demand in the U.S. falls by 3%."
        assert gen.first_sentence("One sentence only") == "One sentence only"

    def test_display_codes_come_from_the_id_and_the_force(self):
        assert display_code("consumer_r01", "Consumer") == "C-01"
        assert display_code("customer_r13", "Customer") == "K-13"
        assert display_code("competitive_r15", "Competitive") == "X-15"
        with pytest.raises(ValueError):
            display_code("consumer_new", "Consumer")
        assert {display_code(d.id, d.force) for d in seed_drivers.DRIVERS} == set(_codemap())

    def test_the_journey_cites_live_drivers_only(self):
        live = _codemap()
        src = (REPO / "data" / "consumerJourney.ts").read_text(encoding="utf-8")
        cited = {code for block in re.findall(r'"driverCodes":\s*\[([^\]]*)\]', src, re.S)
                 for code in re.findall(r'"([A-Z]-\d\d)"', block)}
        assert cited and cited <= set(live), sorted(cited - set(live))
        mentioned = set(re.findall(r"\b([CKTGEX]-\d\d)\b", src))
        assert mentioned <= set(live), sorted(mentioned - set(live))
