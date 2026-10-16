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
from support import JOURNEY_CONTENT, bundled_journey, load_module

REPO = Path(__file__).resolve().parent.parent
BASE = REPO / "data" / "drivers" / "driver_base.json"
CODEMAP = REPO / "data" / "driverCodeMap.ts"
NUMBERING = json.loads(BASE.read_text(encoding="utf-8"))["numbering"]
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
            assert d.name and d.description
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
        validate(drivers, NUMBERING)
        bad = copy.deepcopy(drivers)
        bad[0].update(change)
        with pytest.raises(InvalidBaseError):
            validate(bad, NUMBERING)

    def test_a_missing_category_is_refused(self):
        bad = copy.deepcopy(json.loads(BASE.read_text(encoding="utf-8"))["drivers"])
        del bad[0]["category_exposure"]["LHC: TOI"]
        with pytest.raises(InvalidBaseError, match="category_exposure has no score for LHC: TOI"):
            validate(bad, NUMBERING)

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
            validate(bad, NUMBERING)

    def test_an_exposure_that_is_not_a_whole_score_is_refused(self):
        bad = copy.deepcopy(json.loads(BASE.read_text(encoding="utf-8"))["drivers"])
        bad[0]["regional_exposure"]["Asia"] = 2.5
        with pytest.raises(InvalidBaseError, match="is not a whole number from 0 to 5"):
            validate(bad, NUMBERING)

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
            validate(bad, NUMBERING)

    @pytest.mark.parametrize("change, words", [
        ({"short_name": " "}, "C-01: no short name"),
        ({"short_name": "Private Label Share Gain Now"[:27] + "ss"}, "short name longer than 28 characters"),
        ({"long_name": "Private label takes share from brands in every channel now"},
         "long name longer than 55 characters"),
        ({"descriptor": "Private label is at record grocery share in Europe and adds premium tiers that compete "
                        "with brands now."}, "descriptor longer than 100 characters"),
        ({"descriptor": "Private label is at record grocery share in Europe"},
         "descriptor does not end with a full stop"),
        ({"long_name": "Private label takes share from brands."}, "long name ends with a full stop"),
        ({"short_name": "Private Label  Share Gain"}, "has spaces at its ends or doubled"),
        ({"boundary": "Counted in other drivers: a driver that left the base (C-99)."},
         "cites C-99, which is not a driver of the base"),
        ({"boundary": "Counted in other drivers: its own premium tiers (C-01)."}, "cites the driver itself"),
        ({"boundary": "See K-01 for the discount channel's price ceiling."}, "does not open with"),
        ({"boundary": "Counted in other drivers: the discount channel's price ceiling, K-01."},
         "must cite each other driver by its code in brackets"),
        ({"boundary": "Counted in other drivers: " + "a neighbouring effect (K-01), " * 8 + "and dupes (C-11)."},
         "boundary longer than 240 characters"),
    ])
    def test_names_the_dashboard_could_not_show_are_refused(self, change, words):
        """The short name, long name, descriptor and boundary sentence fit their place on the page
        (NAME_LIMITS), and a boundary sentence cites only other drivers of the base."""
        bad = copy.deepcopy(json.loads(BASE.read_text(encoding="utf-8"))["drivers"])
        assert bad[0]["code"] == "C-01"
        bad[0].update(change)
        with pytest.raises(InvalidBaseError, match=words):
            validate(bad, NUMBERING)

    @pytest.mark.parametrize("field", ["short_name", "long_name", "descriptor"])
    def test_a_driver_without_one_of_its_names_is_refused(self, field):
        bad = copy.deepcopy(json.loads(BASE.read_text(encoding="utf-8"))["drivers"])
        del bad[0][field]
        with pytest.raises(InvalidBaseError, match=f"C-01: no {field}"):
            validate(bad, NUMBERING)

    @pytest.mark.parametrize("field, words", [("short_name", "two drivers have the short name"),
                                              ("long_name", "two drivers have the long name")])
    def test_two_drivers_never_share_a_name(self, field, words):
        bad = copy.deepcopy(json.loads(BASE.read_text(encoding="utf-8"))["drivers"])
        bad[1][field] = bad[0][field].upper()
        with pytest.raises(InvalidBaseError, match=words):
            validate(bad, NUMBERING)

    def test_a_driver_without_a_boundary_sentence_is_accepted(self):
        drivers = copy.deepcopy(json.loads(BASE.read_text(encoding="utf-8"))["drivers"])
        assert sum("boundary" in d for d in drivers) > 0
        for d in drivers:
            d.pop("boundary", None)
        validate(drivers, NUMBERING)

    def test_a_number_is_never_given_to_a_second_driver(self):
        """Every number up to a force's highest is a driver's or retired, and none is above it: a new driver
        can take only the next number and raises the highest, and a driver that leaves must retire its number,
        the driver with the highest number too."""
        drivers = copy.deepcopy(json.loads(BASE.read_text(encoding="utf-8"))["drivers"])
        technology = next(d for d in drivers if d["force"] == "Technology")

        def added(number: int) -> list:
            new = copy.deepcopy(technology)
            # a new driver brings names of its own: two drivers never share one
            new.update(id=f"technology_r{number}", code=f"T-{number}", short_name=f"Test Driver {number}",
                       long_name=f"A test driver numbered {number}")
            return drivers + [new]

        def numbering(force: str, **record) -> dict:
            return {**NUMBERING, force: {**NUMBERING[force], **record}}
        assert NUMBERING["Technology"]["highest"] == 19
        with pytest.raises(InvalidBaseError, match="Technology number 14 belongs to a driver that left the base; "
                                                   "a new driver takes 20"):
            validate(added(14), NUMBERING)
        with pytest.raises(InvalidBaseError, match="Technology number 20 is above the highest number given, 19"):
            validate(added(20), NUMBERING)
        with pytest.raises(InvalidBaseError, match="Technology number 20 is neither a driver's nor retired"):
            validate(added(21), numbering("Technology", highest=21))
        validate(added(20), numbering("Technology", highest=20))
        leaving = [d for d in drivers if d is not technology]
        number = int(technology["id"][-2:])
        with pytest.raises(InvalidBaseError, match=f"Technology number {number} is neither a driver's nor retired"):
            validate(leaving, NUMBERING)
        validate(leaving, numbering("Technology", retired=sorted(NUMBERING["Technology"]["retired"] + [number])))
        # The driver with a force's highest number leaves: without the recorded highest, nothing would show it.
        top = max((d for d in drivers if d["force"] == "Consumer"), key=lambda d: d["id"])
        assert top["id"] == f"consumer_r{NUMBERING['Consumer']['highest']}"
        with pytest.raises(InvalidBaseError, match=f"Consumer number {NUMBERING['Consumer']['highest']} is neither"):
            validate([d for d in drivers if d is not top], NUMBERING)
        with pytest.raises(InvalidBaseError, match="numbering has no highest number and list of retired numbers "
                                                   "for Technology"):
            validate(drivers, {f: n for f, n in NUMBERING.items() if f != "Technology"})
        with pytest.raises(InvalidBaseError, match="numbering has no highest number and list of retired numbers "
                                                   "for Technology"):
            validate(drivers, numbering("Technology", highest=None))

    def test_an_unrated_source_is_accepted_beside_a_graded_one(self):
        drivers = copy.deepcopy(json.loads(BASE.read_text(encoding="utf-8"))["drivers"])
        drivers[0]["sources"].append({"title": "Trade note", "url": "", "tier": "", "published": ""})
        with pytest.raises(InvalidBaseError, match="its link is not an http"):
            validate(drivers, NUMBERING)
        drivers[0]["sources"][-1]["url"] = "https://example.org/note"
        validate(drivers, NUMBERING)


class TestCodeMap:
    def test_one_code_per_driver(self):
        """The map ships in the dashboard's public bundle, so it carries the driver id and the force of
        each code and nothing else: no name, direction or text (those come from the drivers API)."""
        live = _codemap()
        drivers = {d.id: d for d in seed_drivers.DRIVERS}
        assert len(live) == 51 and {v["driverId"] for v in live.values()} == set(drivers)
        for code, info in live.items():
            d = drivers[info["driverId"]]
            letter, number = code.split("-")
            assert letter == LETTER[d.force] and d.id.endswith(f"_r{number}"), code
            assert info == {"driverId": d.id, "force": d.force}, code
        source = CODEMAP.read_text(encoding="utf-8")
        assert not any(d.name in source or d.description[:60] in source for d in drivers.values())
        base = json.loads(BASE.read_text(encoding="utf-8"))["drivers"]
        assert not any(d["short_name"] in source or d["long_name"] in source for d in base)

    def test_the_names_module_carries_each_drivers_names(self):
        """The API serves a driver's short name, long name, descriptor and boundary sentence from the
        generated module, so each must be there exactly as the base holds it."""
        from prism.driver_names import NAMES
        base = {d["id"]: d for d in json.loads(BASE.read_text(encoding="utf-8"))["drivers"]}
        assert set(NAMES) == set(base)
        for driver_id, names in NAMES.items():
            d = base[driver_id]
            assert names == {"short_name": d["short_name"], "long_name": d["long_name"],
                             "descriptor": d["descriptor"], "boundary": d.get("boundary", "")}, driver_id
        assert sum(bool(n["boundary"]) for n in NAMES.values()) == sum("boundary" in d for d in base.values()) > 0

    def test_the_names_stay_out_of_the_seed(self):
        """The seed module, and so the database, carry only the technical scope (name)."""
        src = (REPO / "prism" / "seed_drivers.py").read_text(encoding="utf-8")
        assert all(word not in src for word in ("short_name", "long_name", "descriptor", "boundary"))

    def test_display_codes_come_from_the_id_and_the_force(self):
        assert display_code("consumer_r01", "Consumer") == "C-01"
        assert display_code("customer_r13", "Customer") == "K-13"
        assert display_code("competitive_r15", "Competitive") == "X-15"
        with pytest.raises(ValueError):
            display_code("consumer_new", "Consumer")
        assert {display_code(d.id, d.force) for d in seed_drivers.DRIVERS} == set(_codemap())

    def test_the_journey_cites_live_drivers_only(self):
        """Every code a tile cites, and every code the content mentions anywhere (a driver note, a read, a
        context), is a driver of the base."""
        live = _codemap()
        cited = {code for journey in bundled_journey().values() for stage in journey
                 for side in ("benefiting", "negativelyImpacted") for tile in stage[side]
                 for code in tile["driverCodes"]}
        assert cited and cited <= set(live), sorted(cited - set(live))
        mentioned = set(re.findall(r"\b([CKTGEX]-\d\d)\b", JOURNEY_CONTENT.read_text(encoding="utf-8")))
        assert cited <= mentioned <= set(live), sorted(mentioned - set(live))
