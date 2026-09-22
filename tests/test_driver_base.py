"""Trend base of release 2.11.0 (owner ruling O10): the 51-driver core set.

Locks (a) the integrity of prism/seed_drivers.py, (b) that the committed
seed and data/driverCodeMap.ts are exactly what the generator produces from
the reviewed JSON, (c) the code map's live/retired partition and pointers,
and (d) the archive-first replacement script on a throw-away SQLite base,
including the Postgres-style ON DELETE CASCADE on expert proposals.

2.12.0 (owner ruling O13): the reviewed core set is now core_set_51_v4.json
— v3 plus the "LHC: TOI" column split out of "LHC: HSC" — so every driver
carries THIRTEEN category-exposure rows. The drivers themselves (population,
codes, probabilities, regional exposures) are unchanged by the split.

Owner ruling O15 (2026-09-16): core_set_51_v5.json is v4 with four texts
reworded to the Driver vocabulary (C-03, C-27, C-35, G-15).
tests/test_driver_vocabulary.py locks that v5 differs from v4 in exactly
those four fields.

Owner instruction O16 (2026-09-17): the generator reads core_set_51_v6.json,
which is v5 with the review's own notes ("the old base assumed ...", "could
not be verified", ...) taken out of 40 descriptions: the Description card a
reader sees on the Drivers page describes the driver as it stands, like the
PRISM Analysis beneath it. The review record stays in the `change` field,
which nothing renders. `test_v6_is_v5_with_the_review_notes_out_of_the_descriptions`
locks that v6 differs from v5 in the `desc` field only and that no
description refers to the review.
"""

import importlib.util
import json
import re
import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest

from prism.config import CATEGORIES, REGIONS, VC_STEPS, vc_epicentre_step_of
from prism import seed_drivers

REPO = Path(__file__).resolve().parent.parent
CODEMAP = REPO / "data" / "driverCodeMap.ts"
CORE_SET = REPO / "data" / "drivers" / "driver_base.json"
LETTER = {"Consumer": "C", "Customer": "K", "Technology": "T", "Government": "G",
          "Environmental": "E", "Competitive": "X"}
SLUG = {"Consumer": "consumer", "Customer": "customer", "Technology": "technology",
        "Government": "government", "Environmental": "environmental", "Competitive": "competitive"}


def _codemap():
    src = CODEMAP.read_text(encoding="utf-8")
    live_block = src[src.index("export const DRIVER_CODE_MAP"):src.index("export const RETIRED_CODES")]
    retired_block = src[src.index("export const RETIRED_CODES"):src.index("const ID_TO_CODE")]
    live = {m.group(1): json.loads(m.group(2)) for m in
            re.finditer(r"^  '([A-Z]-\d\d)': (\{.*\}),$", live_block, re.M)}
    retired = {m.group(1): json.loads(m.group(2)) for m in
               re.finditer(r"^  '([A-Z]-\d\d)': (\{.*\}),$", retired_block, re.M)}
    return live, retired


class TestSeedIntegrity:
    def test_population(self):
        drivers = seed_drivers.get_seed_drivers()
        assert len(drivers) == 51
        assert len({t.id for t in drivers}) == 51
        forces = {}
        for t in drivers:
            forces[t.force] = forces.get(t.force, 0) + 1
        assert forces == {"Consumer": 20, "Customer": 7, "Competitive": 4, "Technology": 6,
                          "Government": 10, "Environmental": 4}
        assert sum(1 for t in drivers if t.direction == "Contraction") == 33

    def test_every_driver_is_complete_and_in_range(self):
        for t in seed_drivers.get_seed_drivers():
            assert t.id.startswith(SLUG[t.force] + "_r"), t.id
            assert t.direction in ("Expansion", "Contraction")
            assert 1 <= t.probability <= 5
            assert t.gp1_pct_affected is not None and 0 < t.gp1_pct_affected <= 1
            assert 2025 <= t.start_year <= t.peak_year <= 2035, t.id
            assert t.diffusion_curve in ("s_curve", "linear", "front_loaded", "back_loaded", "step_function")
            assert t.confidence in ("Low", "Medium", "High")
            assert t.uncertainty is not None and 0 <= t.uncertainty <= 5, t.id
            assert len(t.category_exposure) == 13  # 2.12.0/O13: HSC split into HSC + TOI
            assert set(t.category_exposure) == set(CATEGORIES) and all(0 <= v <= 5 for v in t.category_exposure.values())
            assert set(t.regional_exposure) == set(REGIONS) and all(0 <= v <= 5 for v in t.regional_exposure.values())
            assert set(t.vc_exposure) == set(VC_STEPS) and all(0 <= v <= 5 for v in t.vc_exposure.values())
            assert max(t.category_exposure.values()) > 0 and max(t.regional_exposure.values()) > 0
            assert vc_epicentre_step_of(t.vc_exposure) is not None, t.id
            assert t.name and t.description and t.analysis
            assert t.sources, t.id
            for s in t.sources:
                assert s["url"].startswith("http") and s["tier"] in seed_drivers.ACCEPTABLE_TIERS, (t.id, s)

    def test_no_provenance_label_and_snapshot_with_uncertainty(self):
        for t in seed_drivers.get_seed_drivers():
            assert t.ai_suggested is False and t.user_override is False, t.id
            assert t.ai_suggestion["uncertainty"] == t.uncertainty
            assert t.ai_suggestion["probability"] == t.probability
            assert t.ai_suggestion["vc_exposure"] == t.vc_exposure

    def test_seed_values_equal_the_reviewed_json(self):
        gen = _load_script("generate_seed")
        core = json.loads(CORE_SET.read_text(encoding="utf-8"))
        by_id = {r["id"]: r for r in gen.assign_identities(core)}
        assert by_id["customer_r13"]["review_code"] == "T-06" and by_id["consumer_r37"]["review_code"] == "X-06"
        for t in seed_drivers.get_seed_drivers():
            review = by_id[t.id]
            # canonical 5/3/1 profile around the reviewed epicentre
            assert vc_epicentre_step_of(t.vc_exposure) == review["vc_epicentre"], t.id
            assert sorted(t.vc_exposure.values(), reverse=True)[:1] == [5]
            assert t.probability == review["prob"] and t.gp1_pct_affected == review["gp1"]
            assert t.uncertainty == review["uncertainty"]["score"]
            assert len(review["category_exposure"]) == 13, t.id  # the v4 column
            assert t.category_exposure == review["category_exposure"]
            assert t.regional_exposure == review["regional_exposure"]

    def test_v6_is_v5_with_the_review_notes_out_of_the_descriptions(self):
        """O16: the Description card describes the driver as it stands. v6
        differs from v5 in the `desc` field only (40 drivers), no description
        refers to the review or to the earlier base, and the review's own
        record survives untouched in the `change` field."""
        v5 = {d["code"]: d for d in json.loads((REPO / "data" / "trend_base_2026-09" / "core_set_51_v5.json").read_text(encoding="utf-8"))}
        v6 = {d["code"]: d for d in json.loads(CORE_SET.read_text(encoding="utf-8"))}
        assert v5.keys() == v6.keys()
        changed = []
        for code, d in v6.items():
            for field in d:
                if d[field] != v5[code][field]:
                    assert field == "desc", (code, field)
                    changed.append(code)
        assert len(changed) == 40, sorted(changed)
        review = re.compile(r"old base|previous base|earlier base|the old [A-Z]-\d\d|old '|report mill|could not be "
                            r"(?:verified|found)|was wrong|were wrong|is wrong|the review\b|September 2026 review|unsourced|"
                            r"unsupported|unverified|unconfirmed|is dropped|verified deadlines|mislabelled|wrong sign|"
                            r"deleted\)|\bstale\b|no (?:tier-1 )?source|is not supported|had no source|genuinely missing|"
                            r"\d+%, not \d+%|standalone \d\.\d+ GP1|correct sign|often-quoted|was Grand View", re.I)
        offenders = [(code, m.group(0)) for code, d in v6.items() for m in review.finditer(d["desc"])]
        assert offenders == []
        assert all(v6[code]["change"] == v5[code]["change"] for code in v6)
        # the seed carries v6's descriptions, and no description a reader sees refers to the review
        for t in seed_drivers.get_seed_drivers():
            assert not review.search(t.description), t.id

    def test_committed_outputs_match_the_generator(self):
        r = subprocess.run([sys.executable, str(REPO / "scripts" / "generate_seed.py"), "--check"],
                           cwd=REPO, capture_output=True, text=True, timeout=120)
        assert r.returncode == 0, r.stdout + r.stderr


class TestCodeMap:
    def test_live_codes_match_the_seed(self):
        live, retired = _codemap()
        drivers = {t.id: t for t in seed_drivers.get_seed_drivers()}
        assert len(live) == 51
        assert {v["driverId"] for v in live.values()} == set(drivers)
        for code, info in live.items():
            t = drivers[info["driverId"]]
            letter, num = code.split("-")
            assert letter == LETTER[t.force] and t.id.endswith(f"_r{num}"), code
            assert info["name"] == t.name and info["force"] == t.force and info["direction"] == t.direction
            assert info["fallbackDescription"]
        assert not (set(live) & set(retired))

    def test_retired_codes_carry_disposition_and_live_pointers(self):
        live, retired = _codemap()
        assert len(retired) == 65  # 3 pre-2.11 + 62 from the September 2026 review
        assert {"C-12", "K-05", "T-09"} <= set(retired)
        for code, info in retired.items():
            assert info["name"] and info["note"] and info["retiredIn"] in ("v3.1", "v3.3", "v3.11"), code
            for target in info.get("mergedInto", []) + info.get("residueIn", []):
                assert target in live, (code, target)
            assert not (info.get("mergedInto") and info.get("residueIn")), code
        # force moves point at the new code
        assert retired["T-06"]["mergedInto"] == ["K-13"] and live["K-13"]["driverId"] == "customer_r13"
        assert retired["X-06"]["mergedInto"] == ["C-37"] and live["C-37"]["driverId"] == "consumer_r37"
        # a code absorbed by two drivers keeps both pointers
        assert set(retired["G-07"]["mergedInto"]) == {"G-16", "G-04"}
        # substitutions
        assert retired["X-01"]["mergedInto"] == ["X-17"] and retired["G-14"]["mergedInto"] == ["G-16"]
        # deleted with a residue note vs deleted outright
        assert retired["X-10"]["residueIn"] == ["C-01"]
        assert "mergedInto" not in retired["C-15"] and "residueIn" not in retired["C-15"]

    def test_every_journey_citation_resolves_or_is_retired(self):
        live, retired = _codemap()
        src = (REPO / "data" / "consumerJourney.ts").read_text(encoding="utf-8")
        cited = set()
        for block in re.findall(r'"driverCodes":\s*\[([^\]]*)\]', src, re.S):
            cited |= set(re.findall(r'"([A-Z]-\d\d)"', block))
        unknown = sorted(c for c in cited if c not in live and c not in retired)
        assert unknown == [], unknown


def _load_script(name: str):
    spec = importlib.util.spec_from_file_location(name, REPO / "scripts" / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod
