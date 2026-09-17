"""Owner ruling O15 (2026-09-16): "Profit Pool Drivers" replaces "trends".

The interface is locked by tests/frontend/driverVocabulary.test.tsx. This
file locks the parts that live outside the interface code:

  (a) the authored content that ships in the repository says driver where it
      means a modelled item: the Consumer Journey seed carries every new
      phrase of scripts/apply_driver_vocabulary.py (and none of the old
      ones); core_set_51_v5.json is core_set_51_v4.json with exactly the four
      DRIVER_EDITS applied; the seed generated from it has no "trend" left in
      any driver name, description or strategic implication;
  (b) the text the engine, the input-drift audit, the credibility gate, the
      QA workbook and the API hand to people (integrity events, HTTP error
      details, stale reasons, audit reasons, workbook notes) never says trend:
      a static sweep of the literals, plus runtime checks that run the engine
      and the driver endpoints, so a message assembled in a variable is caught
      too;
  (c) the archive-first content script that carries (a) into a database's
      server copy, on a throw-away SQLite base: dry run, apply, idempotence,
      reworded phrases, every exit code, the all-or-nothing write, and its
      compare-and-swap against saves before, during and right after the read
      and the write.

What deliberately keeps the word: code identifiers, API routes, database
tables and contract keys (no contract or schema change), log lines, and the
ordinary English "trend" or the foresight tiers (Megatrend ...) in authored
prose.
"""

import ast
import copy
import datetime
import hashlib
import importlib.util
import json
import os
import re
import sqlite3
import subprocess
import sys
import threading
from contextlib import contextmanager
from pathlib import Path

import pytest

from pulse import seed_trends

REPO = Path(__file__).resolve().parent.parent
BASE = REPO / "data" / "trend_base_2026-09"
WORD = re.compile(r"\btrends?\b", re.I)


def _load_script(name: str):
    spec = importlib.util.spec_from_file_location(name, REPO / "scripts" / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def vocab():
    return _load_script("apply_driver_vocabulary")


@pytest.fixture
def sqlite_db(monkeypatch, tmp_path):
    """pulse.database on a throw-away SQLite file, whatever the environment
    says. These tests save, update and delete drivers, and loading a script
    loads .env, so a DATABASE_URL there (or in the shell) must never let them
    reach Postgres."""
    import pulse.database as dbm
    monkeypatch.setattr(dbm, "USE_POSTGRES", False)
    monkeypatch.setattr(dbm, "sqlite3", sqlite3, raising=False)  # not imported when the module chose Postgres
    monkeypatch.setenv("PRISM_DB_PATH", str(tmp_path / "vocab.db"))
    return dbm


# ── (a) authored content in the repository ──────────────────────────────────

#: Table entries that only correct a claim (the owner follow-up of 2026-09-17)
#: and were never a vocabulary edit.
CORRECTION_ONLY = frozenset({
    "In the September 2026 review the conscious-consumption part of C-04 left the model and neurocosmetics moved to the watch list.",
    "(since the September 2026 review, C-04 covers only clinical-efficacy premiumisation, and neurocosmetics is on the watch list)",
    "In the September 2026 review the conscious-consumption part of C-04 left the model and neurocosmetic sensory science moved to the watch list, so this moment carries no modelled driver.",
    "(T-08's connected-appliance part left the base: T-08 is narrowed to auto-dosing and replenishment)",
    "(T-08's connected-appliance part and E-02 left the base: T-08 is narrowed to auto-dosing and replenishment, E-02 merged into T-03)",
    "(regulators forcing water efficiency) left the model in the September 2026 review; no mandate carries this tile",
    "because it binds apparel, not fabric care.",
    "(bathroom and laundry-room IoT, the longevity economy's home-hygiene dimension) left the model in the September 2026 review.",
    "the longevity home-hygiene driver adopted in its place left the model in the September 2026 review.",
    "AI personalisation as a standalone driver left the model in the September 2026 review",
    "(C-04's conscious-consumption part left the base: C-04 is narrowed to clinical-efficacy premiumisation)",
    "(G-01 EU PFAS restriction left the base for laundry, and C-04's conscious-consumption part left the base)",
    "(T-08 now covers only auto-dosing and replenishment)",
    "(T-08 connected appliances left the base for hair: T-08 is narrowed to auto-dosing and replenishment in laundry and home care)",
    "(T-08) is modelled only as auto-dosing and replenishment in laundry and home care since the September 2026 review",
    "(connected appliances left the base for hair: T-08 covers only auto-dosing and replenishment in laundry and home care)",
    "since T-08 is modelled only as auto-dosing and replenishment in laundry and home care after the September 2026 review",
    "(the EU PFAS restriction is modelled for cosmetics only, G-03)",
    "and the EU PFAS rules, which the September 2026 review kept only inside the cosmetics stack (G-03)",
    "(G-01 EU PFAS restriction left the base for laundry: kept only inside the cosmetics stack G-03)",
    "(the EU PFAS restriction is kept only inside the cosmetics stack, G-03)",
    "(the EU PFAS restriction now sits inside the cosmetics ingredient-restriction stack G-03)",
    "the old second leg of this tile, left the model in the September 2026 review; the moat",
    "Platform vertical integration left the model in the September 2026 review; the modelled mechanism",
    "The AI Act left the model in the September 2026 review (FMCG tools are not high-risk and the high-risk provisions were delayed)",
    "align with the regulatory squeeze on PFCs and chlorine (G-02 microplastics; the EU PFAS rules are the strategist's read here, since G-03 models them for cosmetics only)",
    "driven by G-02 (microplastics restriction) and, as the strategist's read, the EU PFAS rules (modelled for cosmetics only, G-03) and a conscious-consumption preference",
    "connected-appliance water sensing and replenishment (the strategist's read, since T-08 is not modelled for hair) make generic chelation obsolete",
    "connected-water diagnostics and AI-guided personalisation (T-01) make hard-water effects visible",
    "chemical supply-base erosion (which replaced the old nearshoring vector)",
    "and the EU universal PFAS restriction is advancing through the ECHA process",
    "and the EU universal PFAS restriction from 2029, which the September 2026 review models for cosmetics only (G-03)",
})

#: The corrected claims, as the seed states them.
CORRECTED = (
    "(merged into T-03; only the format-shift mechanism survives there)",
    "The tile also cited E-02, but that was the water-scarcity driver, which the September 2026 review merged into T-03; the energy case rests on E-07.",
    "No modelled driver carries the standards escalation, so it is the strategist's read;",
    "(T-08 now covers only auto-dosing and replenishment, and water scarcity was merged into T-03 as format-shift context)",
    "(C-04 now covers only clinical-efficacy premiumisation)",
    "neurocosmetics moved to the watch list",
    "(T-08's connected-appliance part left the base: T-08 is narrowed to auto-dosing and replenishment)",
    "(regulators forcing water efficiency) left the model in the September 2026 review; no mandate carries this tile",
    "(C-04's conscious-consumption part left the base: C-04 is narrowed to clinical-efficacy premiumisation)",
    "and C-04's conscious-consumption part left the base)",
    "(T-08 now covers only auto-dosing and replenishment)",
    "auto-dosing and replenishment in laundry and home care",
    "(the EU PFAS restriction is modelled for cosmetics only, G-03)",
    "(G-01 EU PFAS restriction left the base for laundry: kept only inside the cosmetics stack G-03)",
    "and the EU PFAS rules, which the September 2026 review kept only inside the cosmetics stack (G-03)",
    "(the EU PFAS restriction is kept only inside the cosmetics stack, G-03)",
    "(the EU PFAS restriction now sits inside the cosmetics ingredient-restriction stack G-03)",
    "the old second leg of this tile, left the model in the September 2026 review; the moat",
    "Platform vertical integration left the model in the September 2026 review; the modelled mechanism",
    "The AI Act left the model in the September 2026 review (FMCG tools are not high-risk",
    "(G-02 microplastics; the EU PFAS rules are the strategist's read here, since G-03 models them for cosmetics only)",
    "the EU PFAS rules (modelled for cosmetics only, G-03)",
    "(the strategist's read, since T-08 is not modelled for hair)",
    "personalisation (T-01) make hard-water effects visible",
    "(which replaced the old nearshoring vector)",
    "and the EU universal PFAS restriction",
)

#: What the first O15 table (commit 5813c33) wrote for the entries the corrections
#: changed, copied from that commit's seed: the script must map each to its
#: corrected phrase. Kept here, apart from the script, so a dropped mapping fails.
WORDING_2026_09_16 = {
    "the conscious-consumption part of C-04 behind that read left the model in the September 2026 review (C-04 now covers only clinical-efficacy premiumisation).":
        "the conscious-consumption driver behind that read left the model in the September 2026 review (watch list).",
    "the water-scarcity driver (E-02) that carried that read left the model in the September 2026 review (merged into T-03; only the format-shift mechanism survives there).":
        "the water-scarcity driver (E-02) that carried that read left the model in the September 2026 review (watch list).",
    "The tile also cited E-02, but that was the water-scarcity driver, which the September 2026 review merged into T-03; the energy case rests on E-07.":
        "The energy-efficiency driver (E-02) that the tile also cited left the model in the September 2026 review (watch list).",
    "The water-scarcity driver (E-02) cited for reduced softener demand left the model in the September 2026 review (merged into T-03; only the format-shift mechanism survives there).":
        "The water-scarcity driver (E-02) cited for reduced softener demand left the model in the September 2026 review (watch list).",
    "the water-scarcity driver (E-02) behind it left the model in the September 2026 review (merged into T-03; only the format-shift mechanism survives there).":
        "the water-scarcity driver (E-02) behind it left the model in the September 2026 review (watch list).",
    "The conscious-consumption part of C-04 that the tile also cited left the model in the September 2026 review (C-04 now covers only clinical-efficacy premiumisation).":
        "The conscious-consumption driver the tile also cited left the model in the September 2026 review (watch list).",
    "No modelled driver carries the standards escalation, so it is the strategist's read; E-02, once cited for it, was the water-scarcity driver, which the September 2026 review merged into T-03.":
        "The energy-efficiency driver (E-02) that carried the standards escalation and the sales projection left the model in the September 2026 review (watch list).",
    "Since the September 2026 review neither cited driver carries this tile (T-08 now covers only auto-dosing and replenishment, and water scarcity was merged into T-03 as format-shift context).":
        "Since the September 2026 review neither cited driver carries this tile (connected appliances now only auto-dosing; water scarcity watch-listed).",
    "even though the conscious-consumption part of C-04 left the model in the September 2026 review (C-04 now covers only clinical-efficacy premiumisation),":
        "even though the conscious-consumption driver left the model in the September 2026 review (watch list),",
    "the connected-appliance part of T-08 once cited for steamers left the model in the September 2026 review)":
        "the connected-appliance part of T-08 once cited for steamers left the model in the September 2026 review, watch list)",
    "single-use gimmick formats (strategist's read; the conscious-consumption part of C-04 left the model":
        "single-use gimmick formats (strategist's read; the conscious-consumption driver left the model",
}

#: Claims the review record contradicts: items the review folded into live
#: drivers (E-10 into T-03, G-12 into C-29, T-18 into T-08, C-30 into C-05, T-07
#: and G-10 into T-01, X-10 into C-01, X-13 into C-01 and K-01) described as
#: watch-listed, C-04 described as gone (these were written without a code, so
#: the per-sentence checks below cannot see them), T-08 described without its
#: replenishment half, the PFAS restriction said to be modelled for cosmetics
#: only without naming it the EU one, G-03 credited on laundry tiles and T-08 on
#: a hair tile, and E-07 said to hold the nearshoring thesis it replaced.
STALE = (
    "(regulators forcing water efficiency) left the model in the September 2026 review (watch list)",
    "not fabric care (watch list)",
    "home-hygiene dimension) left the model in the September 2026 review (watch list)",
    "adopted in its place left the model in the September 2026 review (watch list)",
    "AI personalisation as a standalone driver left the model in the September 2026 review (watch list)",
    "C-04 conscious consumption left the base",
    "watch-listed",
    "(T-08 now covers only auto-dosing)",
    "laundry auto-dosing",
    "the PFAS restriction is",
    "the PFAS restriction now",
    "G-01 PFAS restriction",
    "the PFAS rules, which",
    "(watch list); the moat",
    "(watch list); the modelled mechanism",
    "(watch list: FMCG tools",
    "(G-03 ingredient restrictions",
    "driven by G-03",
    "(T-08) make generic chelation",
    "(T-01, T-08)",
    "where the old nearshoring vector now sits",
    "and the universal PFAS restriction",
)

class TestRepositoryContent:
    def test_journey_seed_carries_every_new_phrase_and_no_old_one(self, vocab):
        seed = (REPO / "data" / "consumerJourney.ts").read_text(encoding="utf-8")
        assert len(vocab.JOURNEY_EDITS) == 58
        for old, new in vocab.JOURNEY_EDITS:
            assert not WORD.search(new), new
            if new not in CORRECTION_ONLY:
                # a trend -> driver rewrite (some extended by a correction), or a
                # wording that would now read as the product term
                assert WORD.search(old) or "driver" in old, old
            assert old not in seed, old
            assert new in seed, new
        assert sum(seed.count(new) for _old, new in vocab.JOURNEY_EDITS) == 70
        assert "export const JOURNEY_CONTENT_VERSION = '2026-09-17';" in seed

    def test_the_corrected_claims_stay_corrected(self):
        # Owner follow-up of 2026-09-17: what the September 2026 review record
        # (verdicts_99_v1.json, trendCodeMap.ts) contradicts must not come back.
        text = (REPO / "data" / "consumerJourney.ts").read_text(encoding="utf-8")
        seed = text[text.index("export const LHC_JOURNEY"):]  # the content, not the header comment
        for phrase in CORRECTED:
            assert phrase in seed, phrase
        for phrase in STALE:
            assert phrase not in seed, phrase
        for sentence in re.split(r"(?<=[.;])\s+|\\\\n", seed):
            if "E-02" in sentence:  # merged into T-03, and it is water scarcity
                assert "watch" not in sentence and "energy-efficien" not in sentence, sentence
            if "T-08" in sentence:  # still live, narrowed to auto-dosing and replenishment
                assert "watch" not in sentence and "T-08 connected appliances left the base:" not in sentence, sentence
            if re.search(r"conscious[- ]consumption", sentence, re.I) and "watch" in sentence:
                # C-04 was kept and narrowed; only neurocosmetics went to the watch list
                assert re.search(r"neurocosmetic\w*( sensory science)? (moved to|is on) the watch list", sentence), sentence
            if "T-08" in sentence and "auto-dosing" in sentence and re.search(r"\bonly\b|narrowed", sentence):
                # T-08 covers auto-dosing and replenishment, across laundry and home care
                assert "replenishment" in sentence, sentence
            if re.search(r"\b(?:the|G-01)(?: universal)? PFAS (?:restriction|rules)\b", sentence, re.I):
                # G-03 carries the EU restriction only; G-13 carries US state bans on cleaning products
                assert not re.search(r"cosmetics|G-03|left the base", sentence), sentence

        # A driver that scores zero in every category of a journey is not credited there
        # without saying so: G-03, K-04 and K-07 have no laundry and home care exposure,
        # and T-08 has no hair exposure.
        cut = {name: text.index(f"export const {name}") for name in ("LHC_JOURNEY", "HAIR_JOURNEY", "LHC_CTX", "HAIR_CTX")}
        journeys = {
            "LHC": text[cut["LHC_JOURNEY"]:cut["HAIR_JOURNEY"]] + text[cut["LHC_CTX"]:cut["HAIR_CTX"]],
            "Hair": text[cut["HAIR_JOURNEY"]:cut["LHC_CTX"]] + text[cut["HAIR_CTX"]:],
        }
        scoped = {"LHC": (("G-03", "K-04", "K-07"), r"hair|cosmetic"), "Hair": (("T-08",), r"hair|laundry and home care")}
        exposure = {d["code"]: d["category_exposure"] for d in json.loads((BASE / "core_set_51_v5.json").read_text(encoding="utf-8"))}
        for journey, (codes, marker) in scoped.items():
            for code in codes:  # the premise, from the base file
                assert not any(v for k, v in exposure[code].items() if k.startswith(journey + ":")), code
            for literal in re.findall(r'"((?:[^"\\]|\\.)*)"', journeys[journey]):
                for sentence in re.split(r"(?<=[.;])\s+|\\\\n", literal):
                    if any(re.search(rf"\b{code}\b", sentence) for code in codes):
                        assert re.search(marker, sentence), (journey, sentence)

    def test_journey_phrases_are_plain_text_and_independent(self, vocab):
        olds = [o for o, _ in vocab.JOURNEY_EDITS]
        assert len(set(olds)) == len(olds)
        for o in olds:
            # the same phrase must match the TS seed and the parsed server blob
            assert not any(ch in o for ch in '"\\\n'), o
            assert not any(o != other and o in other for other in olds), o

    def test_the_edits_do_not_depend_on_their_order(self, vocab):
        # Rebuild the pre-O15 text of the seed from the table, then apply the
        # table forwards and backwards: both must give the shipped seed, so no
        # two phrases overlap where they occur.
        seed = (REPO / "data" / "consumerJourney.ts").read_text(encoding="utf-8")
        before = seed
        for old, new in vocab.JOURNEY_EDITS:
            before = before.replace(new, old)
        for order in (vocab.JOURNEY_EDITS, list(reversed(vocab.JOURNEY_EDITS))):
            text = before
            for old, new in order:
                text = text.replace(old, new)
            assert text == seed
        news = [n for _, n in vocab.JOURNEY_EDITS]
        assert not any(n != other and n in other for n in news for other in news)
        for phrase in CORRECTED:  # a correction only in the seed would never reach a database
            assert phrase not in before, phrase
        # ... and so would any other edit made only in the seed: undoing the table must
        # give back the Consumer Journey content of 37ae35c (the 2026-09-10 go-live)
        # exactly. A later content change that is not part of O15 needs its own
        # script and its own record, and then moves this pin.
        content = before[before.index("export const LHC_JOURNEY"):]
        assert hashlib.sha256(content.encode("utf-8")).hexdigest() == \
            "fe35305847418ea99566ec4ebdf51d3b5a80651d12f9634c43d804a1ffca31ee"

    def test_ordinary_trend_prose_is_left_alone(self):
        seed = (REPO / "data" / "consumerJourney.ts").read_text(encoding="utf-8")
        for kept in ("pronounced premiumisation trend in colour",
                     "should own TikTok-native trend content",
                     "Trend-led inspiration collections",
                     "valuing the trend for future positioning"):
            assert kept in seed, kept

    def test_v5_is_v4_with_exactly_the_four_driver_edits(self, vocab):
        v4_raw = (BASE / "core_set_51_v4.json").read_text(encoding="utf-8")
        v5_raw = (BASE / "core_set_51_v5.json").read_text(encoding="utf-8")
        expected = v4_raw
        for _tid, _col, old, new in vocab.DRIVER_EDITS:
            assert expected.count(old) == 1, old
            expected = expected.replace(old, new)
        assert v5_raw == expected

        v4, v5 = json.loads(v4_raw), json.loads(v5_raw)
        changed = []

        def walk(a, b, where):
            if isinstance(a, dict):
                assert a.keys() == b.keys(), where
                for k in a:
                    walk(a[k], b[k], f"{where}.{k}")
            elif isinstance(a, list):
                assert len(a) == len(b), where
                for i, (x, y) in enumerate(zip(a, b)):
                    walk(x, y, f"{where}[{i}]")
            elif a != b:
                changed.append(where)

        walk(v4, v5, "")
        codes = [v5[int(re.match(r"\[(\d+)\]", w).group(1))]["code"] for w in changed]
        assert sorted(zip(codes, changed)) == [
            ("C-03", "[7].desc"), ("C-27", "[13].param_notes.exp_note"),
            ("C-35", "[17].desc"), ("G-15", "[45].desc")]

    def test_generated_seed_carries_the_driver_edits_and_no_trend(self, vocab):
        drivers = seed_trends.get_report_trends()
        by_id = {t.id: t for t in drivers}
        for tid, col, old, new in vocab.DRIVER_EDITS:
            text = getattr(by_id[tid], col)
            assert new in text and old not in text, (tid, col)
        left = [(t.id, f) for t in drivers for f in ("name", "description", "strategic_implication")
                if WORD.search(getattr(t, f) or "")]
        assert left == []
        assert "core_set_51_v5.json" in (REPO / "pulse" / "seed_trends.py").read_text(encoding="utf-8")


# ── (b) generated text handed to people ─────────────────────────────────────

_ERROR_CALLS = {"HTTPException", "ValueError", "TierEGateError"}
_OUTPUT_KWARGS = {"reason", "old_value", "new_value"}


def _strings(node) -> list:
    return [sub.value for sub in ast.walk(node) if isinstance(sub, ast.Constant) and isinstance(sub.value, str)]


def _docstring_ids(tree) -> set:
    ids = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            body = node.body
            if body and isinstance(body[0], ast.Expr) and isinstance(getattr(body[0], "value", None), ast.Constant) \
                    and isinstance(body[0].value.value, str):
                ids.add(id(body[0].value))
    return ids


def _user_facing_strings(path: Path, whole_module: bool = False) -> list:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    if whole_module:
        docs = _docstring_ids(tree)
        return [n.value for n in ast.walk(tree)
                if isinstance(n, ast.Constant) and isinstance(n.value, str) and id(n) not in docs]
    found = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            name = getattr(node.func, "id", None) or getattr(node.func, "attr", None)
            if name in _ERROR_CALLS:  # every string anywhere in the call, detail={...} included
                found += _strings(node)
            for kw in node.keywords:
                if kw.arg in _OUTPUT_KWARGS:
                    found += _strings(kw.value)
        elif isinstance(node, ast.Dict):
            for k, v in zip(node.keys, node.values):
                if isinstance(k, ast.Constant) and k.value == "message":
                    found += _strings(v)
        elif isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Subscript) and isinstance(target.slice, ast.Constant) \
                        and target.slice.value == "stale_reason":
                    found += _strings(node.value)
    return found


class TestGeneratedText:
    @pytest.mark.parametrize("rel", [
        "pulse/simulation/bayesian_mc.py",
        "pulse/seed_trends.py",
        "pulse/api/routers/trends.py",
        "pulse/api/routers/simulation.py",
        "pulse/api/routers/system.py",
        "pulse/api/routers/config.py",
        "pulse/api/routers/misc.py",
        "pulse/api/routers/journey.py",
    ])
    def test_messages_errors_and_audit_text_say_driver(self, rel):
        offenders = [s for s in _user_facing_strings(REPO / rel) if WORD.search(s)]
        assert offenders == [], (rel, offenders)

    @pytest.mark.parametrize("rel", ["pulse/excel_bridge/writer.py", "pulse/audit/input_drift.py"])
    def test_whole_modules_whose_strings_all_reach_people(self, rel):
        strings = _user_facing_strings(REPO / rel, whole_module=True)
        assert strings, f"{rel} parsed to no strings"
        offenders = [s for s in strings if WORD.search(s)]
        assert offenders == [], (rel, offenders)

    def test_the_lock_sees_what_it_guards(self):
        engine = _user_facing_strings(REPO / "pulse/simulation/bayesian_mc.py")
        assert any("carry no regional exposure" in s for s in engine)
        assert any("on the Drivers page" in s for s in engine)
        router = _user_facing_strings(REPO / "pulse/api/routers/trends.py")
        assert any(s.startswith("Driver ") for s in router)  # the 404 detail
        assert any("before the driver can be added to the model" in s for s in router)  # detail={...}
        gate = _user_facing_strings(REPO / "pulse/seed_trends.py")
        assert any("has no sources attached" in s for s in gate)

    def test_credibility_gate_message(self):
        with pytest.raises(seed_trends.TierEGateError) as err:
            seed_trends.assert_trend_credible("Refill stations", [])
        assert str(err.value).startswith("Driver 'Refill stations' has no sources attached")
        assert not WORD.search(str(err.value))

    def test_input_drift_messages(self):
        from pulse.audit.input_drift import compute_input_drift_event
        fp = {"t1": {"p": 3, "g": 0.1, "d": 1}}
        same = compute_input_drift_event(fp, dict(fp), previous_run_id=1)
        assert "driver inputs identical" in same["message"]
        current = {"t1": {"p": 4, "g": 0.1, "d": 1}, "t2": {"p": 2, "g": 0.1, "d": -1}}
        changed = compute_input_drift_event(current, fp, previous_run_id=1)
        assert "1 driver score(s) changed" in changed["message"]
        assert "1 driver(s) added, 0 removed" in changed["message"]
        assert not WORD.search(same["message"] + changed["message"])


class TestRuntimeText:
    """The sweep above reads literals. These run the code, so a message built
    in a variable, a helper or an f-string fragment cannot slip past."""

    def test_engine_integrity_events(self, mock_trends_database, mock_model_config):
        from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine
        db = copy.deepcopy(mock_trends_database)
        db.trends[0].regional_exposure = {}  # region-less: the engine must say so
        db.trends[1].vc_exposure = {}        # no value-chain epicentre: likewise
        result = BayesianMonteCarloEngine(mock_model_config).run(db, iterations=200)
        events = result["integrity_events"]
        assert {"regional_exposure_coverage", "vc_epicentre_coverage"} <= {e["type"] for e in events}
        offenders = [e["message"] for e in events if WORD.search(e["message"])]
        assert offenders == []

    def test_driver_endpoints_errors_audit_and_stale_reasons(self, sqlite_db, monkeypatch):
        pytest.importorskip("fastapi")
        pytest.importorskip("httpx")
        from fastapi.testclient import TestClient
        from pulse.api import state
        from pulse.api.app import create_app
        from pulse.api.auth import require_admin, require_auth
        from pulse.audit.logger import AuditLogger
        from pulse.config import CATEGORIES, FORCES, ModelConfig
        from pulse.ingestion.models import TrendDatabase

        dbm = sqlite_db
        dbm.init_db()
        dbm.save_trends([copy.deepcopy(t) for t in seed_trends.get_report_trends()[:3]])
        loaded = TrendDatabase(trends=dbm.load_trends(), categories=CATEGORIES, forces=FORCES,
                               source_file="database")
        for key, value in (("db", loaded), ("audit", AuditLogger()), ("config", ModelConfig()),
                           ("simulation_stale", False), ("stale_reason", None)):
            monkeypatch.setitem(state._state, key, value)
        app = create_app()
        admin = {"email": "pytest@prism.local", "role": "admin", "user_id": "pytest"}
        app.dependency_overrides[require_auth] = lambda: admin
        app.dependency_overrides[require_admin] = lambda: admin
        client = TestClient(app)
        first, second = loaded.trends[0].id, loaded.trends[1].id
        seen = []

        def call(method, path, status, **kwargs):
            r = getattr(client, method)(path, **kwargs)
            assert r.status_code == status, (method, path, r.text)
            seen.append(r.text)
            seen.append(str(state._state.get("stale_reason") or ""))
            return r

        for method, kwargs in (("get", {}), ("put", {"json": {"probability": 3}}), ("delete", {})):
            r = call(method, "/api/v1/trends/no_such_driver", 404, **kwargs)
            assert r.json()["detail"] == "Driver no_such_driver not found"
        r = call("post", "/api/v1/trends", 422, json={"force": "Consumer", "name": "Refill stations"})
        assert "before the driver can be added to the model" in r.text
        call("post", "/api/v1/trends", 200, json={"force": "Consumer", "name": "Refill stations",
                                                  "sources": [{"title": "Retail audit", "url": "https://example.org", "tier": "A"}]})
        assert state._state["stale_reason"] == "New driver 'Refill stations' was added"
        call("put", f"/api/v1/trends/{first}", 200, json={"probability": 4, "gp1_pct_affected": 0.2})
        assert state._state["stale_reason"] == f"Driver '{first}' was updated"
        call("delete", f"/api/v1/trends/{second}", 200)
        assert state._state["stale_reason"] == f"Driver '{second}' was deleted"

        audit = dbm.get_audit_log(limit=50)
        assert {"score_change", "trend_added", "trend_deleted"} <= {e["action"] for e in audit}
        # action and entity_type are identifiers and keep the code name
        seen += [str(e.get(k) or "") for e in audit for k in ("old_value", "new_value", "reason")]
        offenders = [text for text in seen if WORD.search(text)]
        assert offenders == []


# ── (c) the content script on a throw-away SQLite base ──────────────────────

REAL_WORLD = "Brazil shows a pronounced premiumisation trend in colour."


def _journey_blob(vocab, drop: str | None = None) -> dict:
    olds = [o for o, _ in vocab.JOURNEY_EDITS if o != drop]
    tile = {"name": "Probe tile", "trendCodes": ["C-03"], "driverNote": "C-03 hair-care premiumisation (colour, core trend)",
            "analysis": " ".join(olds) + " " + REAL_WORLD, "intensity": 2}
    return {"lhc": [{"id": "s1", "label": "Sorting", "benefiting": [tile], "negativelyImpacted": []}],
            "hair": [{"id": "h1", "label": "Inspire", "benefiting": [], "negativelyImpacted": [
                {"name": "Second tile", "trendCodes": [], "driverNote": "n/a",
                 "analysis": ("the connected-appliance trend once cited here left the model in the September 2026 review; "
                              "it makes dermatological credibility a profit-pool driver, and makes dermatological "
                              "credibility a profit-pool driver again"),  # one phrase twice in one string
                 "intensity": 1}]}]}


@pytest.fixture
def db(monkeypatch, tmp_path, vocab, sqlite_db):
    monkeypatch.setattr(vocab, "USE_POSTGRES", False)
    monkeypatch.chdir(tmp_path)
    dbm = sqlite_db
    real_connect = dbm._sqlite_connect

    def fk_connect():
        conn = real_connect()
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    monkeypatch.setattr(dbm, "_sqlite_connect", fk_connect)
    dbm.init_db()
    # deep copies: get_report_trends() hands out the module's own Trend objects
    seed = {t.id: copy.deepcopy(t) for t in seed_trends.get_report_trends()}
    rows = []
    for tid in ("consumer_r03", "consumer_r27", "consumer_r35", "government_r15", "consumer_r01"):
        t = seed[tid]
        for etid, col, old, new in vocab.DRIVER_EDITS:  # put the database on the pre-O15 text
            if etid == tid:
                setattr(t, col, getattr(t, col).replace(new, old))
        rows.append(t)
    rows[2].user_override = True  # an expert-reviewed driver must stay expert-reviewed
    dbm.save_trends(rows)
    dbm.upsert_trend_proposal("consumer_r27", "expert-a", {"probability": 2, "comment": "keep me"}, "A", "expert")
    return dbm


def _journey_rows(dbm) -> int:
    with dbm.get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) AS n FROM journey_content")
        return dbm._row_to_dict(cur.fetchone())["n"]


def _texts(dbm) -> dict:
    return {t.id: (t.description, t.strategic_implication) for t in dbm.load_trends()}


def _journey_log(dbm) -> list:
    """updated_by of every journey_content row, oldest first."""
    with dbm.get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, updated_by FROM journey_content ORDER BY id")
        return [dbm._row_to_dict(r)["updated_by"] for r in cur.fetchall()]


def _audit_rows(dbm) -> list:
    return [e for e in dbm.get_audit_log(limit=20) if e["action"] == "driver_vocabulary_applied"]


class _CursorSpy:
    """A real cursor that calls hook(sql) after every fetchone."""

    def __init__(self, cur, hook):
        self._cur, self._hook, self._sql = cur, hook, ""

    def execute(self, sql, *args):
        self._sql = sql
        return self._cur.execute(sql, *args)

    def fetchone(self):
        row = self._cur.fetchone()
        self._hook(self._sql)
        return row

    def __getattr__(self, name):
        return getattr(self._cur, name)


class _ConnectionSpy:
    def __init__(self, conn, hook):
        self._conn, self._hook = conn, hook

    def cursor(self, *args, **kwargs):
        return _CursorSpy(self._conn.cursor(*args, **kwargs), self._hook)

    def __getattr__(self, name):
        return getattr(self._conn, name)


class TestContentScript:
    def test_dry_run_writes_nothing(self, db, vocab, capsys, tmp_path):
        db.save_journey_content(_journey_blob(vocab), updated_by="seed")
        before = _texts(db)
        archive = tmp_path / "archive"
        assert vocab.main(dry_run=True, allow_postgres=False, archive_dir=str(archive)) == 0
        out = capsys.readouterr().out
        assert "58 phrase(s) to change (62 occurrence(s))" in out  # 58, the driver note and three in the second tile
        assert "driver consumer_r27.strategic_implication: apply" in out
        assert re.search(r"Probe tile / analysis: \.\.\..*pronounced premiumisation trend in colour", out)
        assert _journey_rows(db) == 1 and _texts(db) == before
        assert not archive.exists()

    def test_apply_archives_writes_a_new_row_and_touches_nothing_else(self, db, vocab, capsys):
        db.save_journey_content(_journey_blob(vocab), updated_by="seed")
        before = {t.id: t for t in db.load_trends()}
        assert vocab.main(dry_run=False, allow_postgres=False, archive_dir="data/archive") == 0

        assert _journey_rows(db) == 2  # append-only: the previous row stays for rollback
        text = json.dumps(db.load_journey_content(), ensure_ascii=False)
        for old, new in vocab.JOURNEY_EDITS:
            assert old not in text and new in text, old
        assert REAL_WORLD in text  # ordinary English is not touched

        after = {t.id: t for t in db.load_trends()}
        for tid, col, old, new in vocab.DRIVER_EDITS:
            assert new in getattr(after[tid], col) and old not in getattr(after[tid], col)
        for tid, t in after.items():  # scores, exposures, sources and flags are untouched
            b = before[tid]
            assert (t.probability, t.gp1_pct_affected, t.direction, t.uncertainty, t.user_override, t.name) == \
                   (b.probability, b.gp1_pct_affected, b.direction, b.uncertainty, b.user_override, b.name)
            assert t.category_exposure == b.category_exposure and t.regional_exposure == b.regional_exposure
            assert t.vc_exposure == b.vc_exposure and len(t.sources) == len(b.sources)
        assert bool(after["consumer_r35"].user_override)  # SQLite reads booleans back as 1
        assert after["consumer_r01"].description == before["consumer_r01"].description
        assert db.load_all_trend_proposals()["consumer_r27"][0]["comment"] == "keep me"

        archive = json.loads(next(Path("data/archive").glob("driver_vocabulary_sqlite_*.json")).read_text(encoding="utf-8"))
        assert archive["ruling"] == "O15"
        assert "(the trend is modelled as expansion," in archive["drivers"]["consumer_r27"]["strategic_implication"]
        assert "The cleaning-fluency trend left the model" in json.dumps(archive["journey_content_latest"]["content"])
        audit = _audit_rows(db)
        assert len(audit) == 1 and audit[0]["entity_id"] == "O15" and audit[0]["entity_type"] == "content"
        assert re.fullmatch(r"archive driver_vocabulary_sqlite_\d{8}_\d{6}_\d{6}\.json", audit[0]["old_value"])
        assert audit[0]["new_value"] == "journey phrases 58 (62 places), driver texts 4"
        assert audit[0]["reason"].startswith("Owner ruling O15 (2026-09-16)") and audit[0]["user_id"] == "owner-cli"

    def test_second_run_changes_nothing(self, db, vocab, capsys):
        db.save_journey_content(_journey_blob(vocab), updated_by="seed")
        assert vocab.main(dry_run=False, allow_postgres=False, archive_dir="data/archive") == 0
        capsys.readouterr()
        assert vocab.main(dry_run=False, allow_postgres=False, archive_dir="data/archive") == 0
        assert "nothing to change: this database already carries the Driver vocabulary" in capsys.readouterr().out
        assert _journey_rows(db) == 2

    def test_a_reworded_phrase_is_reported_not_forced(self, db, vocab, capsys):
        dropped = "The neuro-scent trend left the model"
        db.save_journey_content(_journey_blob(vocab, drop=dropped), updated_by="admin")
        assert vocab.main(dry_run=False, allow_postgres=False, archive_dir="data/archive") == 0
        out = capsys.readouterr().out
        assert f"not found (reworded by an admin?): {dropped!r}" in out
        assert "57 phrase(s) to change" in out and "need a look by hand" in out
        assert "The neuro-scent driver left the model" not in json.dumps(db.load_journey_content())

    def test_missing_items_are_not_reported_as_done(self, db, vocab, capsys):
        assert vocab.main(dry_run=False, allow_postgres=False, archive_dir="data/archive") == 0
        with db.get_db_connection() as conn:
            conn.cursor().execute("DELETE FROM trends WHERE id = 'government_r15'")
            conn.commit()
        capsys.readouterr()
        assert vocab.main(dry_run=False, allow_postgres=False, archive_dir="data/archive") == 0
        out = capsys.readouterr().out
        assert "driver government_r15.description: no-such-driver" in out
        assert "nothing written" in out and "this database already carries the Driver vocabulary" not in out

    def test_database_without_a_server_copy_updates_the_drivers_only(self, db, vocab, capsys):
        assert vocab.main(dry_run=False, allow_postgres=False, archive_dir="data/archive") == 0
        out = capsys.readouterr().out
        assert "no server copy in this database" in out
        assert _journey_rows(db) == 0
        assert "channel drivers." in {t.id: t for t in db.load_trends()}["government_r15"].description

    def test_a_failing_update_rolls_back_the_journey_row_too(self, db, vocab, capsys):
        db.save_journey_content(_journey_blob(vocab), updated_by="seed")
        before = _texts(db)
        with db.get_db_connection() as conn:
            conn.cursor().execute(
                "CREATE TRIGGER boom BEFORE UPDATE ON trends WHEN NEW.id = 'government_r15' "
                "BEGIN SELECT RAISE(ABORT, 'boom'); END")
            conn.commit()
        assert vocab.main(dry_run=False, allow_postgres=False, archive_dir="data/archive") == 6
        assert "rolled back, nothing changed" in capsys.readouterr().out
        assert _journey_rows(db) == 1 and _texts(db) == before
        assert not [e for e in db.get_audit_log(limit=10) if e["action"] == "driver_vocabulary_applied"]

    def test_a_concurrent_journey_write_aborts_everything(self, db, vocab, monkeypatch, capsys):
        db.save_journey_content(_journey_blob(vocab), updated_by="seed")
        before = _texts(db)
        real_write = vocab._write

        def admin_saves_first(*args, **kwargs):
            db.save_journey_content(_journey_blob(vocab), updated_by="admin, meanwhile")
            return real_write(*args, **kwargs)

        monkeypatch.setattr(vocab, "_write", admin_saves_first)
        assert vocab.main(dry_run=False, allow_postgres=False, archive_dir="data/archive") == 6
        assert "journey_content row was written after the read" in capsys.readouterr().out
        assert _journey_rows(db) == 2  # the admin's row only; nothing from the script
        assert _texts(db) == before

    def test_a_concurrent_driver_edit_aborts_everything(self, db, vocab, monkeypatch, capsys):
        db.save_journey_content(_journey_blob(vocab), updated_by="seed")
        real_write = vocab._write

        def admin_edits_first(*args, **kwargs):
            with db.get_db_connection() as conn:
                conn.cursor().execute(
                    "UPDATE trends SET description = 'edited by an admin' WHERE id = 'consumer_r35'")
                conn.commit()
            return real_write(*args, **kwargs)

        monkeypatch.setattr(vocab, "_write", admin_edits_first)
        assert vocab.main(dry_run=False, allow_postgres=False, archive_dir="data/archive") == 6
        assert "driver consumer_r35.description changed after the read" in capsys.readouterr().out
        assert _journey_rows(db) == 1
        assert {t.id: t for t in db.load_trends()}["consumer_r35"].description == "edited by an admin"

    def test_refuses_postgres_without_flag(self, db, vocab, monkeypatch):
        db.save_journey_content(_journey_blob(vocab), updated_by="seed")
        monkeypatch.setattr(vocab, "USE_POSTGRES", True)
        assert vocab.main(dry_run=False, allow_postgres=False) == 4
        assert _journey_rows(db) == 1
        assert "(the trend is modelled as expansion," in {t.id: t for t in db.load_trends()}["consumer_r27"].strategic_implication

    @pytest.mark.parametrize("use_pg, flag, dry, url, refused", [
        (True, True, False, None, None),                     # Neon, as documented
        (True, False, True, None, None),                     # a dry run may read Postgres without the flag
        (True, False, False, None, "resolves to Postgres"),
        (False, False, False, None, None),                   # local SQLite
        (False, True, False, None, "neither POSTGRES_URL nor DATABASE_URL"),
        (False, True, True, None, "neither POSTGRES_URL nor DATABASE_URL"),
        (False, True, False, "postgres://example.invalid/prod", "psycopg2 is not installed"),
    ])
    def test_the_database_mode_guard(self, vocab, monkeypatch, use_pg, flag, dry, url, refused):
        monkeypatch.setattr(vocab, "USE_POSTGRES", use_pg)
        monkeypatch.delenv("POSTGRES_URL", raising=False)
        monkeypatch.delenv("DATABASE_URL", raising=False)
        if url:
            monkeypatch.setenv("DATABASE_URL", url)
        reason = vocab._refusal(dry, flag)
        if refused is None:
            assert reason is None
        else:
            assert reason and refused in reason

    def test_postgres_flag_on_a_sqlite_connection_writes_nothing(self, db, vocab, capsys, tmp_path):
        # H1: psycopg2 missing makes pulse.database fall back to SQLite silently
        db.save_journey_content(_journey_blob(vocab), updated_by="seed")
        before = _texts(db)
        for dry in (True, False):
            assert vocab.main(dry_run=dry, allow_postgres=True, archive_dir=str(tmp_path / "archive")) == 4
        assert "--postgres was given, but this connection is not Postgres" in capsys.readouterr().out
        assert _journey_rows(db) == 1 and _texts(db) == before and _audit_rows(db) == []
        assert not (tmp_path / "archive").exists()

    def test_a_missing_database_file_is_reported_not_created(self, sqlite_db, vocab, monkeypatch, tmp_path, capsys):
        monkeypatch.setattr(vocab, "USE_POSTGRES", False)
        missing = tmp_path / "nowhere" / "prism.db"
        monkeypatch.setenv("PRISM_DB_PATH", str(missing))
        for dry in (True, False):
            assert vocab.main(dry_run=dry, allow_postgres=False, archive_dir=str(tmp_path / "archive")) == 2
        assert f"no SQLite database at {missing}" in capsys.readouterr().out
        assert not missing.parent.exists() and not (tmp_path / "archive").exists()

    def test_a_database_without_the_tables_exits_2(self, sqlite_db, vocab, monkeypatch, tmp_path, capsys):
        monkeypatch.setattr(vocab, "USE_POSTGRES", False)
        empty = tmp_path / "empty.db"
        sqlite3.connect(empty).close()
        monkeypatch.setenv("PRISM_DB_PATH", str(empty))
        assert vocab.main(dry_run=False, allow_postgres=False, archive_dir=str(tmp_path / "archive")) == 2
        assert "cannot read journey_content / trends" in capsys.readouterr().out
        assert not (tmp_path / "archive").exists()

    def test_the_command_line_anchors_the_default_database_on_the_repository(self, tmp_path):
        env = {k: v for k, v in os.environ.items() if k not in ("PRISM_DB_PATH", "POSTGRES_URL", "DATABASE_URL")}
        env.update({"PRISM_DB_PATH": "", "POSTGRES_URL": "", "DATABASE_URL": ""})  # empty = unset; the shell wins over .env
        run = subprocess.run([sys.executable, str(REPO / "scripts" / "apply_driver_vocabulary.py"), "--dry-run"],
                             cwd=tmp_path, env=env, capture_output=True, text=True, timeout=120)
        assert f"target database mode: sqlite ({REPO / 'data' / 'prism.db'})" in run.stdout, run.stdout + run.stderr
        assert run.returncode in (0, 2)  # 2 where the repository has no local database
        assert not (tmp_path / "data").exists()

    def test_the_suite_never_sees_a_database_url(self):
        # tests/conftest.py blanks both URLs before any pulse import, so a
        # production DATABASE_URL in .env cannot reach a test that loads a script
        if os.environ.get("PRISM_TEST_ALLOW_POSTGRES") != "1":
            import pulse.database as dbm
            assert os.environ.get("DATABASE_URL") == "" and os.environ.get("POSTGRES_URL") == ""
            assert not dbm.POSTGRES_URL  # and the module that picks the database saw them blank

    def test_importing_the_script_leaves_the_environment_alone(self, monkeypatch):
        import pulse.env_loader  # noqa: F401  (.env loads once per process; not what this test is about)
        monkeypatch.delenv("PRISM_DB_PATH", raising=False)
        _load_script("apply_driver_vocabulary")
        assert "PRISM_DB_PATH" not in os.environ

    def test_a_dry_run_leaves_the_default_archive_folder_alone(self, db, vocab, monkeypatch, tmp_path):
        db.save_journey_content(_journey_blob(vocab), updated_by="seed")
        monkeypatch.setattr(vocab, "REPO", str(tmp_path / "repo"))
        assert vocab.main(dry_run=True, allow_postgres=False) == 0
        assert not (tmp_path / "repo").exists()
        assert vocab.main(dry_run=False, allow_postgres=False) == 0  # the default is data/archive under the repository
        assert len(list((tmp_path / "repo" / "data" / "archive").glob("driver_vocabulary_sqlite_*.json"))) == 1

    def test_every_remaining_mention_is_listed(self, vocab):
        tiles = [{"name": f"Tile {i}", "id": f"lhc.stage.exp.trend-{i}", "analysis": f"a premiumisation trend, number {i}"}
                 for i in range(20)]
        blob = {"lhc": [{"id": "s1", "label": "Trend watch", "benefiting": tiles, "negativelyImpacted": []}], "hair": []}
        found = vocab.remaining_mentions(blob)
        assert len(found) == 21  # 20 tiles and the stage label; ids are identifiers and are not listed
        assert found[0] == "lhc[0].label: ...Trend watch..."
        assert found[-1] == "Tile 19 / analysis: ...a premiumisation trend, number 19..."

    def test_an_archive_that_cannot_be_written_stops_everything(self, db, vocab, tmp_path, capsys):
        db.save_journey_content(_journey_blob(vocab), updated_by="seed")
        before = _texts(db)
        blocker = tmp_path / "a_file_not_a_folder"
        blocker.write_text("x", encoding="utf-8")
        assert vocab.main(dry_run=False, allow_postgres=False, archive_dir=str(blocker)) == 3
        assert "archive failed" in capsys.readouterr().out
        assert _journey_rows(db) == 1 and _texts(db) == before and _audit_rows(db) == []

    def test_an_archive_that_does_not_read_back_stops_everything(self, db, vocab, monkeypatch, tmp_path, capsys):
        db.save_journey_content(_journey_blob(vocab), updated_by="seed")

        class HalfWrittenDump:  # a disk that filled up half-way through the archive
            def __getattr__(self, name):
                return getattr(json, name)

            @staticmethod
            def dump(obj, fh, **kwargs):
                fh.write(json.dumps(obj, default=str)[:100])

        monkeypatch.setattr(vocab, "json", HalfWrittenDump())
        assert vocab.main(dry_run=False, allow_postgres=False, archive_dir=str(tmp_path / "archive")) == 3
        assert "archive failed (JSONDecodeError" in capsys.readouterr().out
        assert _journey_rows(db) == 1 and _audit_rows(db) == []

    def test_an_earlier_archive_is_never_overwritten(self, db, vocab, monkeypatch, tmp_path):
        db.save_journey_content(_journey_blob(vocab), updated_by="seed")
        fixed = datetime.datetime(2026, 9, 16, 12, 0, 0, 123456, tzinfo=datetime.timezone.utc)
        monkeypatch.setattr(vocab, "_utc_now", lambda: fixed)
        archive = tmp_path / "archive"
        archive.mkdir()
        earlier = archive / "driver_vocabulary_sqlite_20260916_120000_123456.json"
        earlier.write_text('{"earlier": true}', encoding="utf-8")
        assert vocab.main(dry_run=False, allow_postgres=False, archive_dir=str(archive)) == 3
        assert earlier.read_text(encoding="utf-8") == '{"earlier": true}'
        assert _journey_rows(db) == 1 and _audit_rows(db) == []

    def test_a_failing_audit_entry_rolls_back_the_change(self, db, vocab, capsys):
        db.save_journey_content(_journey_blob(vocab), updated_by="seed")
        before = _texts(db)
        with db.get_db_connection() as conn:
            conn.cursor().execute(
                "CREATE TRIGGER no_audit BEFORE INSERT ON audit_log "
                "BEGIN SELECT RAISE(ABORT, 'audit store unavailable'); END")
            conn.commit()
        assert vocab.main(dry_run=False, allow_postgres=False, archive_dir="data/archive") == 6
        assert "audit store unavailable" in capsys.readouterr().out
        assert _journey_rows(db) == 1 and _texts(db) == before

    def test_a_save_during_the_read_cannot_pass_the_check(self, db, vocab, monkeypatch, capsys):
        # The id the compare-and-swap compares must be the id of the row whose
        # content was read: an admin save landing right after that read aborts.
        db.save_journey_content(_journey_blob(vocab), updated_by="seed")
        before = _texts(db)
        real_connection = db.get_db_connection
        fired = []

        def admin_saves(sql):
            if not fired and "content" in sql and "FROM journey_content" in sql:
                fired.append(sql)
                db.save_journey_content(_journey_blob(vocab), updated_by="admin, during the read")

        @contextmanager
        def spied_connection():
            with real_connection() as conn:
                yield _ConnectionSpy(conn, admin_saves)

        monkeypatch.setattr(db, "get_db_connection", spied_connection)
        monkeypatch.setattr(vocab, "get_db_connection", spied_connection)
        assert vocab.main(dry_run=False, allow_postgres=False, archive_dir="data/archive") == 6
        assert fired and "journey_content row was written after the read" in capsys.readouterr().out
        assert _journey_log(db) == ["seed", "admin, during the read"]
        assert _texts(db) == before and _audit_rows(db) == []

    def test_a_save_during_the_write_waits_and_lands_after(self, db, vocab, monkeypatch, capsys):
        # Between the compare-and-swap check and the insert, an admin save must
        # wait for the commit instead of landing underneath the new row.
        db.save_journey_content(_journey_blob(vocab), updated_by="seed")
        real_check, real_write = vocab._latest_journey_id, vocab._write
        admin = {}

        def check_then_admin_saves(cur):
            latest = real_check(cur)
            # an editor opened before the run saves the text it loaded: the old phrases
            thread = threading.Thread(target=db.save_journey_content, args=(_journey_blob(vocab),),
                                      kwargs={"updated_by": "admin, during the write"})
            thread.start()
            thread.join(timeout=0.5)  # without the lock the save commits right here
            admin["thread"] = thread
            return latest

        def write_then_let_the_admin_finish(*args, **kwargs):
            real_write(*args, **kwargs)
            admin["thread"].join(timeout=10)

        monkeypatch.setattr(vocab, "_latest_journey_id", check_then_admin_saves)
        monkeypatch.setattr(vocab, "_write", write_then_let_the_admin_finish)
        code = vocab.main(dry_run=False, allow_postgres=False, archive_dir="data/archive")
        assert not admin["thread"].is_alive()
        assert _journey_log(db) == ["seed", vocab.UPDATED_BY, "admin, during the write"]
        assert code == 5  # the verification reads the admin's later save, and says so
        out = capsys.readouterr().out
        assert "journey phrase not applied: 'The cleaning-fluency trend left the model' (apply)" in out
        assert "restore from it only if this run's own change is what went wrong" in out
        assert len(_audit_rows(db)) == 1  # committed with the change, so the trail survives

    def test_a_driver_text_written_back_after_the_commit_is_reported(self, db, vocab, monkeypatch, capsys):
        db.save_journey_content(_journey_blob(vocab), updated_by="seed")
        real_write = vocab._write
        _tid, _col, old, new = next(e for e in vocab.DRIVER_EDITS if e[0] == "consumer_r27")

        def warm_instance_saves_its_cached_copy(*args, **kwargs):
            real_write(*args, **kwargs)
            with db.get_db_connection() as conn:
                conn.cursor().execute(
                    "UPDATE trends SET strategic_implication = replace(strategic_implication, ?, ?) "
                    "WHERE id = 'consumer_r27'", (new, old))
                conn.commit()

        monkeypatch.setattr(vocab, "_write", warm_instance_saves_its_cached_copy)
        assert vocab.main(dry_run=False, allow_postgres=False, archive_dir="data/archive") == 5
        assert "driver text not applied: consumer_r27.strategic_implication (apply)" in capsys.readouterr().out
        assert len(_audit_rows(db)) == 1

    def test_a_read_back_that_fails_after_the_commit_is_reported(self, db, vocab, monkeypatch, capsys):
        db.save_journey_content(_journey_blob(vocab), updated_by="seed")
        real_read = vocab._read_state
        calls = []

        def read_then_fail(*args, **kwargs):
            calls.append(1)
            if len(calls) == 2:  # the verification read
                raise sqlite3.OperationalError("disk I/O error")
            return real_read(*args, **kwargs)

        monkeypatch.setattr(vocab, "_read_state", read_then_fail)
        assert vocab.main(dry_run=False, allow_postgres=False, archive_dir="data/archive") == 5
        assert "the change is committed, but it could not be read back" in capsys.readouterr().out
        assert len(_audit_rows(db)) == 1

    def test_a_commit_that_does_not_confirm_is_not_reported_as_rolled_back(self, db, vocab, monkeypatch, capsys):
        db.save_journey_content(_journey_blob(vocab), updated_by="seed")
        real_connection = vocab.get_db_connection

        class LostAcknowledgement(_ConnectionSpy):
            def commit(self):
                self._conn.commit()  # the server applies it, then the connection drops
                raise sqlite3.OperationalError("connection lost while confirming the commit\n")

        @contextmanager
        def flaky_connection():
            with real_connection() as conn:
                try:
                    yield LostAcknowledgement(conn, lambda sql: None)
                except sqlite3.OperationalError:  # and the connection's cleanup fails next, as psycopg2's does
                    raise sqlite3.InterfaceError("connection already closed")

        monkeypatch.setattr(vocab, "get_db_connection", flaky_connection)
        assert vocab.main(dry_run=False, allow_postgres=False, archive_dir="data/archive") == 5
        out = capsys.readouterr().out
        assert "the commit did not confirm (OperationalError: connection lost while confirming the commit), so" in out
        assert "nothing changed" not in out
        monkeypatch.setattr(vocab, "get_db_connection", real_connection)
        assert vocab.main(dry_run=True, allow_postgres=False) == 0  # here it did land
        assert "0 phrase(s) to change (0 occurrence(s)), 58 already changed" in capsys.readouterr().out

    def test_a_missing_privilege_is_named(self, db, vocab, capsys):
        db.save_journey_content(_journey_blob(vocab), updated_by="seed")
        with db.get_db_connection() as conn:
            conn.cursor().execute(
                "CREATE TRIGGER no_insert BEFORE INSERT ON journey_content "
                "BEGIN SELECT RAISE(ABORT, 'permission denied for table journey_content'); END")
            conn.commit()
        assert vocab.main(dry_run=False, allow_postgres=False, archive_dir="data/archive") == 6
        out = capsys.readouterr().out
        assert "The database role lacks a privilege the script needs" in out and "Grant it" in out
        assert "Re-run the script;" not in out

    def test_the_target_is_named_without_credentials(self, vocab, monkeypatch, tmp_path):
        monkeypatch.setattr(vocab, "USE_POSTGRES", False)
        monkeypatch.setenv("PRISM_DB_PATH", str(tmp_path / "local.db"))
        assert vocab._target() == f"sqlite ({tmp_path / 'local.db'})"
        monkeypatch.setattr(vocab, "USE_POSTGRES", True)
        monkeypatch.setattr(vocab, "POSTGRES_URL", "postgresql://owner:s3cret@ep-quiet-1.eu-central-1.aws.neon.tech/neondb?sslmode=require")
        assert vocab._target() == "postgres (ep-quiet-1.eu-central-1.aws.neon.tech/neondb)"
        monkeypatch.setattr(vocab, "POSTGRES_URL", "host=db.internal port=5432 dbname=prism_staging user=u password=s3cret")
        assert vocab._target() == "postgres (db.internal/prism_staging)"

    @pytest.mark.parametrize("journey_edits", [True, False])
    def test_the_postgres_write_locks_before_it_checks(self, vocab, monkeypatch, journey_edits):
        # The tests above run on SQLite; this one records the statements the
        # Postgres branch sends, in order, against a stand-in connection.
        import pulse.database as dbm
        log = []

        class Cursor:
            rowcount = 1

            def execute(self, sql, params=None):
                log.append(" ".join(sql.split()))

            def fetchone(self):
                return {"id": 7}

        class Connection:
            def cursor(self):
                return Cursor()

            def commit(self):
                log.append("COMMIT")

            def rollback(self):
                log.append("ROLLBACK")

        @contextmanager
        def connection():
            yield Connection()

        monkeypatch.setattr(vocab, "USE_POSTGRES", True)
        monkeypatch.setattr(dbm, "USE_POSTGRES", True)  # placeholder() and ph() read it
        monkeypatch.setattr(vocab, "get_db_connection", connection)
        old, new = vocab.JOURNEY_EDITS[0]
        j_apply = [{"old": old, "olds": [old], "new": new, "count": 1}] if journey_edits else []
        _tid, col, d_old, d_new = vocab.DRIVER_EDITS[1]
        drivers = {"consumer_r27": {col: f"text {d_old} text"}}
        d_apply = [{"id": "consumer_r27", "column": col, "old": d_old, "new": d_new}]
        vocab._write({"lhc": [{"analysis": old}], "hair": []}, 7, j_apply, drivers, d_apply, ("x",) * 7)

        expected = ["SET LOCAL lock_timeout = '15s'"]
        if journey_edits:
            expected += ["LOCK TABLE journey_content IN SHARE ROW EXCLUSIVE MODE",
                         "SELECT id FROM journey_content ORDER BY id DESC LIMIT 1",
                         "INSERT INTO journey_content (content, updated_by) VALUES (%s, %s)"]
        expected += [f"UPDATE trends SET {col} = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s AND {col} = %s",
                     "INSERT INTO audit_log (action, entity_type, entity_id, old_value, new_value, reason, user_id) "
                     "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                     "COMMIT"]
        assert log == expected

        if journey_edits:  # a newer row than the one read: roll back before any insert
            log.clear()
            with pytest.raises(vocab._Conflict):
                vocab._write({"lhc": [], "hair": []}, 6, j_apply, drivers, d_apply, ("x",) * 7)
            assert log[-1] == "ROLLBACK" and not any(line.startswith("INSERT") for line in log)

    def test_a_database_moved_by_the_first_o15_table_is_finished_too(self, db, vocab, capsys):
        # Commit 5813c33 shipped the table before the corrections of 2026-09-17. A
        # database it moved carries that table's wording; this run must take it to
        # the corrected text and report nothing as not found.
        blob = _journey_blob(vocab)
        for old, new in vocab.JOURNEY_EDITS:
            if new in CORRECTION_ONLY:
                continue  # the first table did not touch these
            blob, _ = vocab._replace_in_strings(blob, old, WORDING_2026_09_16.get(new, new))
        db.save_journey_content(blob, updated_by="moved by commit 5813c33")
        middle = len(WORDING_2026_09_16)
        assert vocab.main(dry_run=False, allow_postgres=False, archive_dir="data/archive") == 0
        out = capsys.readouterr().out
        changed = middle + len(CORRECTION_ONLY)
        assert (f"{changed} phrase(s) to change" in out and f"{len(vocab.JOURNEY_EDITS) - changed} already changed, 0 not found" in out
                and "not found (reworded" not in out)
        text = json.dumps(db.load_journey_content(), ensure_ascii=False)
        for old, new in vocab.JOURNEY_EDITS:
            assert old not in text and new in text, new
        for earlier in WORDING_2026_09_16.values():
            assert earlier not in text, earlier
        assert vocab.main(dry_run=True, allow_postgres=False) == 0
        assert f"0 phrase(s) to change (0 occurrence(s)), {len(vocab.JOURNEY_EDITS)} already changed, 0 not found" in capsys.readouterr().out

    def test_the_2026_09_16_wordings_cannot_collide(self, vocab):
        assert vocab.JOURNEY_EDITS_FROM_2026_09_16 == WORDING_2026_09_16
        olds = [o for o, _ in vocab.JOURNEY_EDITS]
        news = [n for _, n in vocab.JOURNEY_EDITS]
        for new, earlier in vocab.JOURNEY_EDITS_FROM_2026_09_16.items():
            assert new in news and earlier not in olds, earlier
            # never found inside a corrected phrase or another entry's old phrase
            assert not any(earlier in text for text in news + olds), earlier
