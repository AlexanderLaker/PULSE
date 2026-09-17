"""Trend base of release 2.11.0 (owner ruling O10): the 51-driver core set.

Locks (a) the integrity of pulse/seed_trends.py, (b) that the committed
seed and data/trendCodeMap.ts are exactly what the generator produces from
the reviewed JSON, (c) the code map's live/retired partition and pointers,
and (d) the archive-first replacement script on a throw-away SQLite base,
including the Postgres-style ON DELETE CASCADE on expert proposals.

2.12.0 (owner ruling O13): the reviewed core set is now core_set_51_v4.json
— v3 plus the "LHC: TOI" column split out of "LHC: HSC" — so every driver
carries THIRTEEN category-exposure rows. The drivers themselves (population,
codes, probabilities, regional exposures) are unchanged by the split.

Owner ruling O15 (2026-09-16): the generator reads core_set_51_v5.json, which
is v4 with four texts reworded to the Driver vocabulary (C-03, C-27, C-35,
G-15). tests/test_driver_vocabulary.py locks that v5 differs from v4 in exactly
those four fields.
"""

import importlib.util
import json
import re
import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest

from pulse.config import CATEGORIES, REGIONS, VC_STEPS, vc_epicentre_step_of
from pulse import seed_trends

REPO = Path(__file__).resolve().parent.parent
CODEMAP = REPO / "data" / "trendCodeMap.ts"
CORE_SET = REPO / "data" / "trend_base_2026-09" / "core_set_51_v5.json"
LETTER = {"Consumer": "C", "Customer": "K", "Technology": "T", "Government": "G",
          "Environmental": "E", "Competitive": "X"}
SLUG = {"Consumer": "consumer", "Customer": "customer", "Technology": "technology",
        "Government": "government", "Environmental": "environmental", "Competitive": "competitive"}


def _codemap():
    src = CODEMAP.read_text(encoding="utf-8")
    live_block = src[src.index("export const TREND_CODE_MAP"):src.index("export const RETIRED_CODES")]
    retired_block = src[src.index("export const RETIRED_CODES"):src.index("const ID_TO_CODE")]
    live = {m.group(1): json.loads(m.group(2)) for m in
            re.finditer(r"^  '([A-Z]-\d\d)': (\{.*\}),$", live_block, re.M)}
    retired = {m.group(1): json.loads(m.group(2)) for m in
               re.finditer(r"^  '([A-Z]-\d\d)': (\{.*\}),$", retired_block, re.M)}
    return live, retired


class TestSeedIntegrity:
    def test_population(self):
        trends = seed_trends.get_report_trends()
        assert len(trends) == 51
        assert len({t.id for t in trends}) == 51
        forces = {}
        for t in trends:
            forces[t.force] = forces.get(t.force, 0) + 1
        assert forces == {"Consumer": 20, "Customer": 7, "Competitive": 4, "Technology": 6,
                          "Government": 10, "Environmental": 4}
        assert sum(1 for t in trends if t.direction == "Contraction") == 33

    def test_every_driver_is_complete_and_in_range(self):
        for t in seed_trends.get_report_trends():
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
            assert t.name and t.description and t.strategic_implication
            assert t.sources, t.id
            for s in t.sources:
                assert s["url"].startswith("http") and s["tier"] in seed_trends.ACCEPTABLE_TIERS, (t.id, s)

    def test_no_provenance_label_and_snapshot_with_uncertainty(self):
        for t in seed_trends.get_report_trends():
            assert t.ai_suggested is False and t.user_override is False, t.id
            assert t.ai_suggestion["uncertainty"] == t.uncertainty
            assert t.ai_suggestion["probability"] == t.probability
            assert t.ai_suggestion["vc_exposure"] == t.vc_exposure

    def test_seed_values_equal_the_reviewed_json(self):
        gen = _load_script("generate_seed_from_core_set")
        core = json.loads(CORE_SET.read_text(encoding="utf-8"))
        by_id = {r["id"]: r for r in gen.assign_identities(core)}
        assert by_id["customer_r13"]["review_code"] == "T-06" and by_id["consumer_r37"]["review_code"] == "X-06"
        for t in seed_trends.get_report_trends():
            review = by_id[t.id]
            # canonical 5/3/1 profile around the reviewed epicentre
            assert vc_epicentre_step_of(t.vc_exposure) == review["vc_epicentre"], t.id
            assert sorted(t.vc_exposure.values(), reverse=True)[:1] == [5]
            assert t.probability == review["prob"] and t.gp1_pct_affected == review["gp1"]
            assert t.uncertainty == review["uncertainty"]["score"]
            assert len(review["category_exposure"]) == 13, t.id  # the v4 column
            assert t.category_exposure == review["category_exposure"]
            assert t.regional_exposure == review["regional_exposure"]

    def test_committed_outputs_match_the_generator(self):
        r = subprocess.run([sys.executable, str(REPO / "scripts" / "generate_seed_from_core_set.py"), "--check"],
                           cwd=REPO, capture_output=True, text=True, timeout=120)
        assert r.returncode == 0, r.stdout + r.stderr


class TestCodeMap:
    def test_live_codes_match_the_seed(self):
        live, retired = _codemap()
        trends = {t.id: t for t in seed_trends.get_report_trends()}
        assert len(live) == 51
        assert {v["trendId"] for v in live.values()} == set(trends)
        for code, info in live.items():
            t = trends[info["trendId"]]
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
        assert retired["T-06"]["mergedInto"] == ["K-13"] and live["K-13"]["trendId"] == "customer_r13"
        assert retired["X-06"]["mergedInto"] == ["C-37"] and live["C-37"]["trendId"] == "consumer_r37"
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
        for block in re.findall(r'"trendCodes":\s*\[([^\]]*)\]', src, re.S):
            cited |= set(re.findall(r'"([A-Z]-\d\d)"', block))
        unknown = sorted(c for c in cited if c not in live and c not in retired)
        assert unknown == [], unknown


def _load_script(name: str):
    spec = importlib.util.spec_from_file_location(name, REPO / "scripts" / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class TestReplacementScript:
    @pytest.fixture
    def old_base(self, monkeypatch, tmp_path):
        """A throw-away SQLite base: 2 kept ids, 3 retired ids (X-01 is
        substituted by X-17, T-06 moves to K-13, C-15 is deleted), expert
        proposals on both kinds; foreign keys ENFORCED so the SQLite run
        exercises the Postgres ON DELETE CASCADE path."""
        monkeypatch.setenv("PRISM_DB_PATH", str(tmp_path / "old.db"))
        monkeypatch.chdir(tmp_path)  # data/archive lands in the temp dir
        import pulse.database as dbm
        real_connect = dbm._sqlite_connect

        def fk_connect():
            conn = real_connect()
            conn.execute("PRAGMA foreign_keys = ON")
            return conn

        monkeypatch.setattr(dbm, "_sqlite_connect", fk_connect)
        dbm.init_db()
        from pulse.ingestion.models import Trend
        old = []
        for tid in ("consumer_r01", "government_r02", "technology_r06", "competitive_r01", "consumer_r15"):
            old.append(Trend(id=tid, force=tid.split("_")[0].capitalize(), name="old " + tid,
                             direction="Contraction", probability=3, gp1_pct_affected=0.1,
                             start_year=2025, peak_year=2030, diffusion_curve="linear",
                             category_exposure={c: 1 for c in CATEGORIES},
                             regional_exposure={r: 1 for r in REGIONS},
                             vc_exposure={v: 1 for v in VC_STEPS}))
        for t in old:
            t.sources = [{"title": "x", "url": "https://example.org", "tier": "A"}]
        dbm.save_trends(old)
        dbm.upsert_trend_proposal("consumer_r01", "expert-a", {"probability": 2, "uncertainty": 4, "comment": "keep me"}, "A", "expert")
        dbm.upsert_trend_proposal("government_r02", "expert-b", {"gp1_pct_affected": 0.3}, "B", "expert")
        dbm.upsert_trend_proposal("technology_r06", "expert-a", {"probability": 1}, "A", "expert")  # retired id (T-06 -> K-13)
        return dbm

    def test_dry_run_writes_nothing(self, old_base, capsys):
        mod = _load_script("replace_trend_base")
        assert mod.main(dry_run=True, allow_postgres=False) == 0
        out = capsys.readouterr().out
        assert "kept ids: 2" in out and "retired ids: 3" in out and "new ids: 49" in out
        assert len(old_base.load_trends()) == 5
        assert not list(Path("data/archive").glob("*.json")) if Path("data/archive").exists() else True

    def test_replacement_archives_replaces_and_restores_kept_proposals(self, old_base, capsys):
        mod = _load_script("replace_trend_base")
        assert mod.main(dry_run=False, allow_postgres=False, archive_dir="data/archive") == 0
        out = capsys.readouterr().out
        archives = sorted(Path("data/archive").glob("trend_base_sqlite_*.json"))
        assert len(archives) == 1
        arch = json.loads(archives[0].read_text(encoding="utf-8"))
        assert len(arch["tables"]["trends"]) == 5
        assert len(arch["tables"]["trend_score_proposals"]) == 3
        trends = {t.id: t for t in old_base.load_trends()}
        assert len(trends) == 51 and "technology_r06" not in trends and "customer_r13" in trends
        assert trends["consumer_r01"].name != "old consumer_r01"  # replaced by the reviewed driver
        assert trends["consumer_r01"].uncertainty is not None
        # Since F-29 the write no longer deletes the trend rows, so the kept
        # ids' proposals survive the replacement and the script's restore step
        # finds nothing to re-insert. It stays as the safety net for a base
        # written by pre-2.11.0 code, where the cascade did fire.
        assert "2 snapshot, 0 re-inserted after the cascade" in out
        props = old_base.load_all_trend_proposals()
        assert set(props) == {"consumer_r01", "government_r02"}  # the retired id's proposal is gone
        assert props["consumer_r01"][0]["uncertainty"] == 4 and props["consumer_r01"][0]["comment"] == "keep me"
        report = json.loads(sorted(Path("data/archive").glob("trend_base_replacement_*.json"))[0].read_text())
        assert report["problems"] == [] and report["trend_count"] == 51
        assert report["proposals_restored"] == 0 and report["proposals_archived_only"] == 1

    def test_second_run_is_refused_unless_forced(self, old_base, capsys):
        mod = _load_script("replace_trend_base")
        assert mod.main(dry_run=False, allow_postgres=False, archive_dir="data/archive") == 0
        # an admin edit after the replacement must survive a careless re-run
        t = {x.id: x for x in old_base.load_trends()}["consumer_r01"]
        t.probability = 2
        t.user_override = True
        old_base.save_trends([t])
        capsys.readouterr()
        assert mod.main(dry_run=False, allow_postgres=False, archive_dir="data/archive") == 7
        out = capsys.readouterr().out
        assert "already on the 51-driver base" in out and "REFUSING" in out
        assert {x.id: x for x in old_base.load_trends()}["consumer_r01"].probability == 2
        # --force resets to the seed, deliberately
        assert mod.main(dry_run=False, allow_postgres=False, force=True, archive_dir="data/archive") == 0
        assert {x.id: x for x in old_base.load_trends()}["consumer_r01"].probability != 2

    def test_dry_run_applies_no_schema_change(self, old_base, monkeypatch, tmp_path):
        """A dry run must not even ALTER the schema (it runs against Neon
        without --postgres): drop the 2.11.0 column first and check it is
        still absent afterwards."""
        import sqlite3
        db_path = Path(str(old_base._get_sqlite_path()))
        con = sqlite3.connect(db_path)
        con.execute("ALTER TABLE trends DROP COLUMN uncertainty")
        con.commit(); con.close()
        mod = _load_script("replace_trend_base")
        assert mod.main(dry_run=True, allow_postgres=False) == 0
        con = sqlite3.connect(db_path)
        cols = {r[1] for r in con.execute("PRAGMA table_info(trends)")}
        con.close()
        assert "uncertainty" not in cols

    def test_refuses_postgres_without_flag(self, old_base, monkeypatch):
        mod = _load_script("replace_trend_base")
        monkeypatch.setattr(mod, "USE_POSTGRES", True)
        assert mod.main(dry_run=False, allow_postgres=False) == 4
        assert len(old_base.load_trends()) == 5
