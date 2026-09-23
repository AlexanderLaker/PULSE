"""The driver base: data/drivers/driver_base.json, the generated seed module and the code map."""
import copy
import json
import re
import subprocess
import sys
from pathlib import Path

import pytest

from prism import seed_drivers
from prism.config import CATEGORIES, REGIONS, VALID_DIFFUSION_CURVES, VC_STAGES, display_code
from prism.driver_base import InvalidBaseError, base_drivers, validate
from prism.drivers import SCORE_FIELDS
from support import load_module

REPO = Path(__file__).resolve().parent.parent
BASE = REPO / "data" / "drivers" / "driver_base.json"
CODEMAP = REPO / "data" / "driverCodeMap.ts"
HIGHEST = json.loads(BASE.read_text(encoding="utf-8"))["highest_numbers"]
LETTER = {"Consumer": "C", "Customer": "K", "Technology": "T", "Government": "G",
          "Environmental": "E", "Competitive": "X"}


def _generator():
    return load_module("scripts/generate_seed.py")


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
            assert d.vc_epicentre in VC_STAGES
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
        """The generated module builds the same drivers the attribution build reads from the JSON, in the
        order the database returns them (by id): the copula pairs draws with drivers by position."""
        from_base = {d.id: d for d in base_drivers()}
        assert [d.id for d in seed_drivers.DRIVERS] == list(from_base) == sorted(from_base)
        for d in seed_drivers.DRIVERS:
            b = from_base[d.id]
            for field in ("force", "name", "description", "direction", "probability", "start_year", "gp1_pct_affected",
                          "peak_year", "diffusion_curve", "uncertainty", "confidence", "category_exposure",
                          "regional_exposure", "vc_epicentre", "sources"):
                assert getattr(d, field) == getattr(b, field), (d.id, field)

    def test_the_committed_files_are_the_generator_output(self):
        r = subprocess.run([sys.executable, str(REPO / "scripts" / "generate_seed.py"), "--check"],
                           cwd=REPO, capture_output=True, text=True, timeout=120)
        assert r.returncode == 0, r.stdout + r.stderr


class TestBaseValidation:
    """A base the engine or the dashboard could not use is refused before anything is generated from it."""

    @pytest.mark.parametrize("change", [
        {"probability": 6},
        {"start_year": 2031, "peak_year": 2030},
        {"diffusion_curve": "exponential"},
        {"vc_epicentre": "Shelf"},
        {"code": "C-99"},
        {"sources": [{"title": "Blog", "url": "https://example.com", "tier": "E", "published": ""}]},
    ])
    def test_a_bad_entry_is_refused(self, change):
        drivers = json.loads(BASE.read_text(encoding="utf-8"))["drivers"]
        validate(drivers, HIGHEST)
        bad = copy.deepcopy(drivers)
        bad[0].update(change)
        with pytest.raises(InvalidBaseError):
            validate(bad, HIGHEST)

    def test_a_missing_category_is_refused(self):
        bad = copy.deepcopy(json.loads(BASE.read_text(encoding="utf-8"))["drivers"])
        del bad[0]["category_exposure"]["LHC: TOI"]
        with pytest.raises(InvalidBaseError, match="category_exposure has no score for LHC: TOI"):
            validate(bad, HIGHEST)

    @pytest.mark.parametrize("change, words", [
        ({"probability": 3.5}, "probability 3.5 is not a whole number from 1 to 5"),
        ({"uncertainty": True}, "uncertainty True is not a whole number from 0 to 5"),
        ({"start_year": 2024}, "onset 2024 before the base year"),
        ({"peak_year": 2036}, "peak 2036 after the horizon"),
    ])
    def test_the_base_is_held_to_the_engines_rules(self, change, words):
        """A score the database and the engine would refuse is refused in the base, before a seed is written."""
        bad = copy.deepcopy(json.loads(BASE.read_text(encoding="utf-8"))["drivers"])
        bad[0].update(change)
        with pytest.raises(InvalidBaseError, match=words):
            validate(bad, HIGHEST)

    def test_an_exposure_that_is_not_a_whole_score_is_refused(self):
        bad = copy.deepcopy(json.loads(BASE.read_text(encoding="utf-8"))["drivers"])
        bad[0]["regional_exposure"]["Asia"] = 2.5
        with pytest.raises(InvalidBaseError, match="is not a whole number from 0 to 5"):
            validate(bad, HIGHEST)

    @pytest.mark.parametrize("change, words", [
        ({"url": "www.example.org/report"}, "its link is not an http\\(s\\) address"),
        ({"url": "https://example.org/a report.pdf"}, "its link is not an http\\(s\\) address"),
        ({"title": " "}, "no title"),
        ({"tier": "A+"}, "tier 'A\\+' is not on the scale"),
        ({"published": None}, "no publication note"),
        ({"title": "x" * 501}, "title longer than 500 characters"),
    ])
    def test_a_source_the_api_would_refuse_is_refused(self, change, words):
        """A seeded source must be one the editor can save again (prism.drivers SOURCE_URL_PATTERN and
        SOURCE_FIELD_LIMITS, the rules of the API's SourceRef)."""
        bad = copy.deepcopy(json.loads(BASE.read_text(encoding="utf-8"))["drivers"])
        bad[0]["sources"][0].update(change)
        with pytest.raises(InvalidBaseError, match=words):
            validate(bad, HIGHEST)

    def test_a_number_is_never_given_to_a_second_driver(self):
        """A driver numbered above its force's highest recorded number is refused until the record is raised
        with it, so a new driver cannot take the number of one that left."""
        drivers = copy.deepcopy(json.loads(BASE.read_text(encoding="utf-8"))["drivers"])
        new = copy.deepcopy(drivers[0])
        new.update(id="consumer_r38", code="C-38")
        with pytest.raises(InvalidBaseError, match="number 38 is above the highest Consumer number the base records"):
            validate(drivers + [new], HIGHEST)
        validate(drivers + [new], {**HIGHEST, "Consumer": 38})
        with pytest.raises(InvalidBaseError, match="highest_numbers has no whole number for Technology"):
            validate(drivers, {f: n for f, n in HIGHEST.items() if f != "Technology"})

    def test_an_unrated_source_is_accepted_beside_a_graded_one(self):
        drivers = copy.deepcopy(json.loads(BASE.read_text(encoding="utf-8"))["drivers"])
        drivers[0]["sources"].append({"title": "Trade note", "url": "", "tier": "", "published": ""})
        with pytest.raises(InvalidBaseError, match="its link is not an http"):
            validate(drivers, HIGHEST)
        drivers[0]["sources"][-1]["url"] = "https://example.org/note"
        validate(drivers, HIGHEST)


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
        sentence = gen.first_sentence("P.L. 119-21 expanded the rules. States pay more.")
        assert sentence == "P.L. 119-21 expanded the rules."
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
