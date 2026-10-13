"""Migration 0001: move a PRISM database from the previous schema to the driver schema.

Run it once per database, right after deploying the code that expects the
driver schema; README.md in this folder is the runbook. Everything happens in
one transaction, so the database ends either fully migrated or unchanged.
While it runs it holds exclusive locks on the tables it touches (PostgreSQL)
or the write lock (SQLite), so nothing can write in between.

1. Every driver is checked first. The driver schema stores only drivers the
   engine can simulate: every score present and on its scale, a start year and
   a peak year after the onset, a known force, curve, confidence and value-chain
   stage, and at least one category and one region above 0. The previous
   engine simulated a driver without any regional exposure as present in every
   region; the driver schema has no such rule, and the problem says so. While
   any driver fails a check the migration changes nothing and lists every
   problem, to be corrected in the previous release's dashboard (a force, a
   start year or a confidence, which that dashboard cannot edit, with SQL).
   The newest Consumer Journey content is checked at the same time (step 5).
2. The driver tables are created and filled from the previous ones:
     trends                    -> drivers      (ai_suggestion -> baseline,
                                                user_override -> scores_edited;
                                                strategic_implication, the
                                                PRISM Analysis, is not carried
                                                over: the readings ship with
                                                the code)
     trend_category_exposure, trend_regional_exposure
                               -> driver_category_exposure, driver_regional_exposure
     trend_vc_exposure         -> drivers.vc_epicentre (the stage the stored
                                                         profile centres on)
     trend_sources             -> driver_sources (source_type -> published: the
                                                  publication date where the old
                                                  value read "<kind> (<date>)",
                                                  else the old text; a tier outside
                                                  the scale becomes unrated; a link
                                                  that is not an http(s) address
                                                  becomes the title where there is
                                                  none; a source with neither a
                                                  title nor a link is skipped)
     trend_score_proposals     -> driver_score_proposals (without user_role, which
                                                         held "viewer" for everyone)
   The previous schema stored a value chain as eight 0-5 scores, the editor's
   rendering of one chosen stage (5 there, 3 next to it, 1 two away). The
   driver schema stores the stage itself. A driver's stage, a proposal's and
   the one in a baseline are read from the stored scores with the rule the
   previous engine and dashboard used (epicentre_of), so each keeps the stage
   it was shown with.
   An exposure map keeps the taxonomy's names only, and a name it lacks gets
   0; the previous engine read both as 0, so no number changes, and the
   report lists every name dropped or set. A baseline holds every score: a
   driver without a readable baseline takes its current scores, a baseline
   field left empty the current score, and the report names both.
   An expert proposal is a draft: a score the API would refuse today (a GP1
   share of 0, a peak year at or before the onset, a value off its scale, a
   name outside the taxonomy) is cleared, and the report names it.
   The previous editor saved a driver's source list as JSON in trends.data_source
   while the sources table kept the rows the driver was created with. Where
   data_source holds such a list, that list (the one the admin last saved)
   becomes the driver's sources; the report names those drivers. The one-line
   data_source summary itself is not carried over: the dashboard derives it
   from the sources. Rows of the child tables whose driver no longer exists are
   not copied and are counted in the report (the archive keeps them).
3. Tables the driver schema does not have are dropped (the trend tables,
   config_snapshots, triggers, ai_suggestions, session_snapshots, and older
   leftovers where a database still has them), and so is every column of
   simulation_runs beyond id, run_date, iterations and results. Nothing is
   dropped with CASCADE: if a table this migration does not know depends on
   one it drops, the migration stops and changes nothing. Tables it does not
   know, such as user_roles, are never touched.
   The three tables both schemas have (simulation_runs, journey_content and
   audit_log) are held to the current definitions: every run has its
   iteration count and results, every journey version its author and every
   audit entry its entity and actor, and no column keeps a default a writer
   could lean on. A run without its results or iteration count cannot be
   served, so it is archived and removed. A journey version or audit entry
   written without a value gets the previous schema's default for the column
   where it had one (an empty author, "system" as the actor) and an empty
   entity otherwise; the archive lists the rows that got one. A kept table
   that lacks a column of the driver schema, or a journey_content or
   audit_log column the driver schema does not have, stops the migration.
4. The keys of the stored runs follow the new names: meta.trend_count ->
   meta.driver_count, meta.trend_fingerprint -> meta.driver_fingerprint,
   meta.attenuation_source -> meta.overlap_correction_source, and trend_ids /
   unscored_trend_ids -> driver_ids / unscored_driver_ids in the integrity
   events; decompositions.dimensions, which only listed the taxonomies and
   which a current run does not carry, is removed. Each driver fingerprint
   gains every field the previous one did not record: the onset years, and
   None (compares as changed) for a field that cannot be known; its
   value-chain stage is stored by name, and its exposure maps move onto the
   taxonomy's names as the drivers' do, so the next production run compares
   like with like. No number changes.
5. The content is brought up to date. A previously shipped text is one that
   any version since release 2.11.0 (the first on the 51-driver base) shipped:
     - a description that still holds a previously shipped text gets the current
       one (descriptions.json); an edited description is left alone and reported;
     - the newest Consumer Journey content gets the key driverCodes instead of
       trendCodes, loses any code that is not a driver of the base, gets the
       current tile texts and stage labels where one still holds a previously
       shipped text (journey_edits.json), has escaped paragraph breaks written
       out and loses every key outside the tile shape of prism/journey.py (the
       author in a tile's provenance, and the direction of its pool impact,
       which the tile's side gives); it is saved as a new version. A tile the
       previous editor still marks as an AI suggestion pending review, or
       content the API would refuse, stops the migration before anything
       changes, as a driver that needs correcting does.
6. The migration is recorded in schema_migrations and in the audit log.

Before the commit, every dropped row and column is written to a local archive,
migrations/0001_driver_schema/archive/<database>-<time>.json (readable by the
owner only, never committed), except password columns, which are not
archived. The audit log keeps every entry.

    python3 migrations/0001_driver_schema/migrate.py --dry-run      report what would change, change nothing
    python3 migrations/0001_driver_schema/migrate.py --postgres     migrate the PostgreSQL database in .env
    python3 migrations/0001_driver_schema/migrate.py --sqlite PATH  migrate a SQLite file

Without --sqlite the target is POSTGRES_URL or DATABASE_URL (from the shell or
.env), else the local SQLite file (PRISM_DB_PATH or data/prism.db). A run that
changes a PostgreSQL database needs --postgres; a dry run does not.

Exit codes: 0 migrated, previewed by a dry run, or already migrated; 1 refused
(no suitable database, not the previous schema, --postgres missing, or drivers,
journey content or columns that need correcting); 2 failed and rolled back.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(REPO))

import prism.env_loader  # noqa: E402,F401  (loads .env; shell variables win)
from prism.config import (BASE_YEAR, CATEGORIES, DEFAULT_PATH_YEARS, REGIONS,  # noqa: E402
                          VALID_DIFFUSION_CURVES, VC_STAGES)
from prism.database import describe_error, postgres_connect_options, schema  # noqa: E402
from prism.drivers import (CONFIDENCE_LEVELS, SCORE_FIELDS, SOURCE_TIERS,  # noqa: E402
                           SOURCE_URL_PATTERN, Driver, simulation_problems)
from prism.input_drift import FINGERPRINT_KEYS  # noqa: E402
from prism.journey import (DRIVER_CODES, JOURNEYS, OPTIONAL_TILE_KEYS, POOL_IMPACT_KEYS,  # noqa: E402
                           PROVENANCE_KEYS, SIDES, STAGE_KEYS, TILE_KEYS, content_problem, unknown_keys)
from prism.numbers import finite_number, whole_in_range  # noqa: E402

MIGRATION = "0001_driver_schema"
ARCHIVE_DIR = HERE / "archive"
#: The current descriptions, with the SHA-256 of each text shipped before them.
DESCRIPTIONS_FILE = HERE / "descriptions.json"
#: The current journey tile texts, with the SHA-256 of each text shipped before them.
JOURNEY_EDITS_FILE = HERE / "journey_edits.json"

#: Previous tables this migration removes, every table before the tables it
#: references (delphi_rounds references trends and delphi_sessions,
#: delphi_calibration references delphi_sessions). Only these are dropped; any
#: other table in the database is left alone.
DROP_TABLES = (
    "trend_score_proposals", "trend_sources", "trend_category_exposure", "trend_vc_exposure",
    "trend_regional_exposure", "trend_journey_exposure", "delphi_rounds", "delphi_calibration",
    "delphi_sessions", "trends", "config_snapshots", "triggers", "ai_suggestions", "session_snapshots",
    "scanned_trends", "backtest_results", "causal_edges", "competitors", "users",
)
#: The children of trends whose rows are copied into the driver tables.
CHILD_TABLES = ("trend_category_exposure", "trend_vc_exposure", "trend_regional_exposure",
                "trend_sources", "trend_score_proposals")
#: The tables both schemas have, with the columns the driver schema gives them.
#: Any other column of simulation_runs is archived and dropped (older databases
#: also carry scenario, causal_decomposition and others; dropping
#: config_snapshot_id also removes its foreign key to config_snapshots).
KEPT_COLUMNS = {
    "simulation_runs": ("id", "run_date", "iterations", "results"),
    "journey_content": ("id", "content", "updated_by", "updated_at"),
    "audit_log": ("id", "timestamp", "action", "entity_type", "entity_id", "old_value", "new_value", "reason",
                  "user_id"),
}
#: What a missing author, entity or actor becomes before its column turns NOT
#: NULL: the previous schema's default where it had one (updated_by '',
#: user_id 'system'), else an empty string.
FILL_VALUES = {("audit_log", "entity_type"): "", ("audit_log", "entity_id"): "",
               ("audit_log", "user_id"): "system", ("journey_content", "updated_by"): ""}
#: Tables locked for the whole transaction besides DROP_TABLES.
LOCKED_TABLES = ("simulation_runs", "journey_content", "audit_log")
LOCK_TIMEOUT = "10s"
RUN_META_RENAMES = {"trend_count": "driver_count", "trend_fingerprint": "driver_fingerprint",
                    "attenuation_source": "overlap_correction_source"}
EVENT_DETAIL_RENAMES = {"trend_ids": "driver_ids", "unscored_trend_ids": "unscored_driver_ids"}
SOURCE_KINDS = ("primary source", "analyst report", "trade press", "primary_source", "analyst_report", "trade_press")
#: A source link as the API accepts it.
WEB_ADDRESS = re.compile(SOURCE_URL_PATTERN)


def sha256(text) -> str:
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


def published_from(old: str) -> str:
    """When a source was published, from its previous source_type value."""
    text = (old or "").strip()
    m = re.fullmatch(r"(?:%s)\s*\((.+)\)" % "|".join(re.escape(k) for k in SOURCE_KINDS), text, re.I)
    if m:
        return m.group(1).strip()
    return "" if text.lower() in SOURCE_KINDS else text


def _stage_key(name) -> str:
    """A stage name as the previous rule compared it: lower case, spaces as underscores."""
    return str(name).lower().replace(" ", "_")


def epicentre_of(profile):
    """The value-chain stage a stored eight-step profile centres on, or None.

    The previous engine and dashboard read a profile this way, so every driver
    keeps the stage it was shown with. Names are compared in lower case with
    spaces as underscores ("supply_chain" is Supply Chain). The stage is the
    highest score; a tie goes to the stage nearest the score-weighted centre
    of the profile, and an exact tie in distance to the earlier stage. A
    profile that scores nothing (none stored, all zero, or only names outside
    VC_STAGES) has no stage; a value that is not a number counts as 0.
    """
    if not isinstance(profile, dict):
        return None
    by_key = {}
    for name, value in profile.items():
        try:
            by_key[_stage_key(name)] = float(value or 0)
        except (TypeError, ValueError):
            by_key[_stage_key(name)] = 0.0
    scores = [by_key.get(_stage_key(stage), 0.0) for stage in VC_STAGES]
    total = sum(scores)
    if total <= 0:
        return None
    top = max(scores)
    centre = sum(v * (i + 1) for i, v in enumerate(scores)) / total
    best = None
    for i, v in enumerate(scores):
        if v == top and (best is None or abs(i + 1 - centre) < abs(best - centre)):
            best = i + 1
    return VC_STAGES[best - 1]


def editor_sources(data_source):
    """The source list the previous editor saved as JSON in data_source, else None.

    That editor sent a driver's whole source list with every save and the
    previous API stored it in data_source as JSON, while the sources table kept
    the rows the driver was created with. Such a list is the one the admin
    last saved. Entries with neither a title nor a URL are skipped; the old
    "data" field becomes the publication date the way published_from reads it.
    """
    if not isinstance(data_source, str) or not data_source.lstrip().startswith("["):
        return None
    try:
        parsed = json.loads(data_source)
    except ValueError:
        return None
    if not isinstance(parsed, list) or not parsed or not all(isinstance(s, dict) for s in parsed):
        return None
    out = []
    for s in parsed:
        title, url = str(s.get("title") or ""), str(s.get("url") or "")
        if not (title.strip() or url.strip()):
            continue
        kind = s.get("data") if s.get("data") is not None else s.get("source_type")
        out.append({"title": title, "url": url, "tier": str(s.get("tier") or ""), "published": published_from(kind)})
    return out or None


def update_run_keys(results: dict) -> bool:
    """Give the keys of one stored results bundle their current names, in place,
    and remove decompositions.dimensions, which a current run does not carry
    (it only listed the taxonomies); True if anything changed."""
    changed = False
    meta = results.get("meta")
    if isinstance(meta, dict):
        for old, new in RUN_META_RENAMES.items():
            if old in meta and new not in meta:
                meta[new] = meta.pop(old)
                changed = True
    decompositions = results.get("decompositions")
    if isinstance(decompositions, dict) and "dimensions" in decompositions:
        del decompositions["dimensions"]
        changed = True
    for event in results.get("integrity_events") or []:
        detail = event.get("detail") if isinstance(event, dict) else None
        if isinstance(detail, dict):
            for old, new in EVENT_DETAIL_RENAMES.items():
                if old in detail and new not in detail:
                    detail[new] = detail.pop(old)
                    changed = True
    return changed


def complete_fingerprint(results: dict, start_years: dict) -> bool:
    """Bring a stored run's driver fingerprint to what a run records now; True if it changed.

    The next production run and the served run's comparison with the current
    drivers read every field of the stored fingerprint (prism/input_drift.py,
    FINGERPRINT_KEYS), so every entry gets each field it lacks. The onset
    year ("s") of a driver still in the database is the one the run was
    computed on, since the previous release could not edit it; any other
    missing field is None, which compares as changed. A driver's exposure
    maps ("ce", "re") move onto the taxonomy's names, as the migration puts
    the drivers' own: a missing name 0, the value the previous engine read
    for it, and a name outside the taxonomy dropped. The value-chain
    epicentre ("ve"), which the previous release stored as the stage's place
    in the chain (1 to 8) and older releases as the eight-step profile,
    becomes the stage's name; anything else None.
    """
    fingerprint = (results.get("meta") or {}).get("driver_fingerprint")
    changed = False
    if not isinstance(fingerprint, dict):
        return changed
    for driver_id, entry in fingerprint.items():
        if not isinstance(entry, dict):
            continue
        for key in FINGERPRINT_KEYS:
            if key not in entry:
                entry[key] = int(start_years[driver_id]) if key == "s" and driver_id in start_years else None
                changed = True
        stage = entry["ve"]
        if stage is not None and stage not in VC_STAGES:
            place = isinstance(stage, int) and not isinstance(stage, bool) and 1 <= stage <= len(VC_STAGES)
            entry["ve"] = (VC_STAGES[stage - 1] if place
                           else epicentre_of(stage) if isinstance(stage, dict) else None)
            changed = True
        if driver_id not in start_years:
            continue
        for key, names in (("ce", CATEGORIES), ("re", REGIONS)):
            stored = entry.get(key)
            if isinstance(stored, dict):
                on_taxonomy = {name: round(float(stored.get(name) or 0), 4) for name in sorted(names)}
                if on_taxonomy != stored:
                    entry[key] = on_taxonomy
                    changed = True
    return changed


class Database:
    """The connection and the few dialect differences the migration needs."""

    def __init__(self, sqlite_file=None):
        url = None if sqlite_file else (os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL"))
        self.postgres = bool(url)
        if self.postgres:
            # Here, not at the top: a SQLite target needs no PostgreSQL driver
            # (prism/database.py imports it only for PostgreSQL too).
            import psycopg2
            import psycopg2.extras
            self.conn = psycopg2.connect(url, **postgres_connect_options(url))
            self.conn.autocommit = False
            self.conn.cursor_factory = psycopg2.extras.RealDictCursor
            self.label = f"postgres-{urlparse(url).hostname}"
            self.where = f"PostgreSQL at {urlparse(url).hostname}"
        else:
            path = Path(sqlite_file or os.environ.get("PRISM_DB_PATH") or REPO / "data" / "prism.db")
            if not path.exists():
                raise FileNotFoundError(f"no SQLite database at {path}")
            self.conn = sqlite3.connect(str(path), isolation_level=None)
            self.conn.row_factory = sqlite3.Row
            # Foreign keys are checked once, at the end (foreign_key_check), rather
            # than per statement, which the rebuild of simulation_runs needs.
            self.conn.execute("PRAGMA foreign_keys = OFF")
            self.label = f"sqlite-{path.stem}"
            self.where = f"SQLite at {path}"
        self.cur = self.conn.cursor()
        self.p = "%s" if self.postgres else "?"

    def begin(self):
        if not self.postgres:
            # IMMEDIATE takes the write lock now, so no other connection can
            # write between the archive and the commit.
            self.cur.execute("BEGIN IMMEDIATE")

    def commit(self):
        self.conn.commit() if self.postgres else self.cur.execute("COMMIT")

    def rollback(self):
        try:
            self.conn.rollback() if self.postgres else self.cur.execute("ROLLBACK")
        except Exception:  # noqa: BLE001 (nothing to roll back)
            pass

    def execute(self, sql: str, params=()):
        self.cur.execute(sql, params)
        return self.cur

    def rows(self, sql: str, params=()) -> list:
        self.cur.execute(sql, params)
        return [dict(r) for r in self.cur.fetchall()]

    def tables(self) -> set:
        if self.postgres:
            return {r["name"] for r in self.rows(
                "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = current_schema()")}
        return {r["name"] for r in self.rows("SELECT name FROM sqlite_master WHERE type = 'table'")}

    def columns(self, table: str) -> list:
        if self.postgres:
            return [r["name"] for r in self.rows(
                "SELECT column_name AS name FROM information_schema.columns "
                "WHERE table_schema = current_schema() AND table_name = %s ORDER BY ordinal_position", (table,))]
        return [r["name"] for r in self.rows(f"PRAGMA table_info({table})")]


def jsonable(value):
    return value.isoformat() if isinstance(value, datetime) else value


def json_text(value):
    """A JSON column's value as text: a JSONB column arrives decoded, a TEXT column as text."""
    if value is None or isinstance(value, str):
        return value
    return json.dumps(value)


def json_value(value):
    """A JSON column's value decoded, whether the column is TEXT or JSONB."""
    return json.loads(value) if isinstance(value, str) else value


class NeedsCorrection(ValueError):
    """Drivers or journey content the driver schema cannot store as they are; the
    message lists every problem."""

    def __init__(self, problems: list):
        self.problems = list(problems)
        super().__init__("\n  ".join(["these need correcting before the migration can run:"] + self.problems))


def exposure_on_taxonomy(stored, names) -> tuple:
    """``(map, dropped, filled)``: a stored exposure map on the taxonomy's names.

    A name outside the taxonomy is dropped and a missing name gets 0. The
    previous engine read both as 0, so neither changes a number.
    """
    stored = stored if isinstance(stored, dict) else {}
    dropped = sorted(k for k in stored if k not in names)
    filled = [k for k in names if k not in stored]
    return {k: stored.get(k, 0) for k in names}, dropped, filled


def baseline_of(ai_suggestion, scores: dict) -> tuple:
    """``(baseline, source, filled)``: a driver's baseline from the previous ai_suggestion.

    The baseline holds every score of the driver schema (SCORE_FIELDS). The
    stored value-chain profile becomes its stage (epicentre_of), and its
    exposure maps are put on the taxonomy's names like the driver's own. A
    driver without a readable suggestion takes its current scores (source
    "scores"); a field the suggestion lacks or leaves empty takes the current
    score and is listed in ``filled``.
    """
    text = json_text(ai_suggestion)
    try:
        snapshot = json.loads(text) if text else None
    except ValueError:
        snapshot = None
    if not isinstance(snapshot, dict):
        return dict(scores), "scores", []
    if "vc_exposure" in snapshot:
        snapshot.setdefault("vc_epicentre", epicentre_of(snapshot.pop("vc_exposure")))
    baseline, filled = {}, []
    for name in SCORE_FIELDS:
        value = snapshot.get(name)
        if value is None or value == {}:
            baseline[name] = scores[name]
            filled.append(name)
        elif name in ("category_exposure", "regional_exposure"):
            baseline[name] = exposure_on_taxonomy(value, CATEGORIES if name == "category_exposure" else REGIONS)[0]
        else:
            baseline[name] = value
    return baseline, "suggestion", filled


def read_previous_drivers(db: Database, tables: set) -> list:
    """Every driver of the previous schema as the driver schema will store it.

    One dict per trends row: the row, its value-chain stage, its exposure
    maps on the taxonomy's names (with the names dropped and filled), its
    baseline, and the problems that keep it out of the driver schema. The
    driver schema stores only drivers the engine can simulate, so a driver
    with a problem stops the migration until it is corrected.
    """
    owned = "trend_id IN (SELECT id FROM trends)"
    children: dict = {"trend_vc_exposure": {}, "trend_category_exposure": {}, "trend_regional_exposure": {}}
    for table, key in (("trend_vc_exposure", "vc_step"), ("trend_category_exposure", "category"),
                       ("trend_regional_exposure", "region")):
        if table in tables:
            for r in db.rows(f"SELECT trend_id, {key} AS k, exposure_score FROM {table} WHERE {owned}"):
                children[table].setdefault(r["trend_id"], {})[r["k"]] = r["exposure_score"]
    out = []
    for r in db.rows("SELECT * FROM trends ORDER BY id"):
        stage = epicentre_of(children["trend_vc_exposure"].get(r["id"]))
        category, dropped_c, filled_c = exposure_on_taxonomy(
            children["trend_category_exposure"].get(r["id"]), CATEGORIES)
        region, dropped_r, filled_r = exposure_on_taxonomy(children["trend_regional_exposure"].get(r["id"]), REGIONS)
        driver = Driver(id=r["id"], force=r["force"], name=r["name"], direction=r.get("direction"),
                        probability=r.get("probability"), start_year=r.get("start_year"),
                        gp1_pct_affected=r.get("gp1_pct_affected"), peak_year=r.get("peak_year"),
                        diffusion_curve=r.get("diffusion_curve"), uncertainty=r.get("uncertainty"),
                        vc_epicentre=stage, category_exposure=category, regional_exposure=region)
        problems = [line.split(": ", 1)[1] for line in simulation_problems([driver])]
        if stage is None:
            problems = [line for line in problems if not line.startswith("value-chain epicentre")]
            problems.append("no value chain is stored (its eight scores are missing or all 0); set its epicentre")
        if r.get("confidence") not in CONFIDENCE_LEVELS:
            problems.append(f"confidence {r.get('confidence')!r} is not one of {', '.join(CONFIDENCE_LEVELS)}")
        if not any(region.values()):
            problems = [line for line in problems if not line.startswith("regional_exposure is 0 for every region")]
            problems.append("no regional exposure is stored; the previous engine simulated such a driver as present "
                            "in every region, the driver schema does not: set its regions")
        baseline, source, baseline_filled = baseline_of(r.get("ai_suggestion"), driver.scores())
        out.append({"row": r, "stage": stage, "category": category, "region": region,
                    "dropped": dropped_c + dropped_r, "filled": filled_c + filled_r,
                    "baseline": baseline, "baseline_from": source, "baseline_filled": baseline_filled,
                    "problems": problems})
    return out


def proposal_scores(r: dict, start_year: int) -> tuple:
    """``(values, cleared)``: a previous proposal's scores as the driver schema stores them.

    A proposal is a draft, so a score the API would refuse today (a GP1 share
    of 0, a peak year at or before the driver's onset or beyond the horizon, a
    value off its scale or a name outside the taxonomy) is cleared rather than
    stopping the migration; ``cleared`` names what was, and the expert can
    score it again. The value-chain profile becomes its stage.
    """
    first_peak = max(BASE_YEAR, int(start_year)) + 1
    cleared = []

    def keep(name, ok):
        value = r.get(name)
        if value is not None and not ok(value):
            cleared.append(name)
            return None
        return value

    values = {
        "probability": keep("probability", lambda v: whole_in_range(v, 1, 5)),
        "gp1_pct_affected": keep("gp1_pct_affected", lambda v: finite_number(v) and 0 < v <= 1),
        "peak_year": keep("peak_year", lambda v: whole_in_range(v, first_peak, DEFAULT_PATH_YEARS[-1])),
        "diffusion_curve": keep("diffusion_curve", lambda v: v in VALID_DIFFUSION_CURVES),
        "uncertainty": keep("uncertainty", lambda v: whole_in_range(v, 0, 5)),
    }
    for name, names in (("category_exposure", CATEGORIES), ("regional_exposure", REGIONS)):
        try:
            stored = json_value(r.get(name))
        except ValueError:
            stored = None
        stored = stored if isinstance(stored, dict) else {}
        kept = {k: int(v) for k, v in stored.items() if k in names and whole_in_range(v, 0, 5)}
        if len(kept) < len(stored):
            cleared.append(name if not kept else f"{name} ({len(stored) - len(kept)} of {len(stored)} cells)")
        values[name] = kept or None
    try:
        profile = json_value(r.get("vc_exposure"))
    except ValueError:
        profile = "unreadable"
    values["vc_epicentre"] = epicentre_of(profile)
    if values["vc_epicentre"] is None and profile not in (None, {}) and not _scores_nothing(profile):
        cleared.append("vc_epicentre")   # a stored vote that names no stage of the chain
    return values, cleared


def _scores_nothing(profile) -> bool:
    """True for a value-chain profile that holds no positive score (the expert left it unscored)."""
    if not isinstance(profile, dict):
        return False
    for value in profile.values():
        try:
            if float(value or 0) > 0:
                return False
        except (TypeError, ValueError):
            return False
    return True


def migrate(db: Database) -> dict:
    """Apply the migration inside the open transaction; returns the report and the archive."""
    report: dict = {"database": db.where}
    archive: dict = {"migration": MIGRATION, "database": db.where, "tables": {}, "simulation_runs_columns": {}}
    tables = db.tables()
    p = db.p

    if db.postgres:
        # Everything this transaction reads or changes is locked until the
        # commit; a lock that cannot be had within the timeout fails the run.
        db.execute(f"SET LOCAL lock_timeout = '{LOCK_TIMEOUT}'")
        locked = [t for t in DROP_TABLES + LOCKED_TABLES if t in tables]
        db.execute(f"LOCK TABLE {', '.join(locked)} IN ACCESS EXCLUSIVE MODE")

    # ── the drivers and the journey content, checked before anything changes ─
    drivers = read_previous_drivers(db, tables)
    problems = [f"{d['row']['id']}: {line}" for d in drivers for line in d["problems"]]
    journey, journey_report, journey_problems = updated_journey(db)
    problems += journey_problems
    for table, kept in KEPT_COLUMNS.items():
        if table in tables:
            columns = db.columns(table)
            missing = [c for c in kept if c not in columns]
            if missing:
                problems.append(f"{table} lacks columns the driver schema has: {', '.join(missing)}")
            unknown = [c for c in columns if c not in kept]
            if unknown and table != "simulation_runs":   # a run's other columns are archived and dropped
                problems.append(f"{table} has columns the driver schema does not know: {', '.join(unknown)}")
    if problems:
        raise NeedsCorrection(problems)

    # ── what is dropped, archived first ─────────────────────────────────────
    for table in DROP_TABLES:
        if table in tables:
            keep = [c for c in db.columns(table) if "password" not in c.lower()]
            archive["tables"][table] = [{k: jsonable(v) for k, v in r.items()}
                                        for r in db.rows(f"SELECT {', '.join(keep)} FROM {table}")]
    drop_columns = [c for c in db.columns("simulation_runs") if c not in KEPT_COLUMNS["simulation_runs"]]
    for column in drop_columns:
        archive["simulation_runs_columns"][column] = {
            str(r["id"]): jsonable(r["v"]) for r in db.rows(
                f"SELECT id, {column} AS v FROM simulation_runs WHERE {column} IS NOT NULL")}

    # ── the driver tables ───────────────────────────────────────────────────
    # The current schema, as a new database gets it. The three tables both
    # schemas have already exist here, so their statements create nothing;
    # hold_kept_tables brings them to these definitions.
    for statement in schema(db.postgres):
        db.execute(statement)

    from_editor: dict = {}
    for d in drivers:
        r = d["row"]
        db.execute(
            "INSERT INTO drivers (id, force, name, description, direction, probability, start_year, peak_year, "
            "diffusion_curve, gp1_pct_affected, uncertainty, vc_epicentre, confidence, baseline, "
            f"scores_edited, created_at, updated_at) VALUES ({', '.join([p] * 17)})",
            (r["id"], r["force"], r["name"], r.get("description") or "", r["direction"], r["probability"],
             r["start_year"], r["peak_year"], r["diffusion_curve"], r["gp1_pct_affected"], r["uncertainty"],
             d["stage"], r["confidence"], json.dumps(d["baseline"]),
             bool(r.get("user_override")), r.get("created_at"), r.get("updated_at")))
        for table, key, values in (("driver_category_exposure", "category", d["category"]),
                                   ("driver_regional_exposure", "region", d["region"])):
            for name, score in values.items():
                db.execute(f"INSERT INTO {table} (driver_id, {key}, exposure_score) VALUES ({p}, {p}, {p})",
                           (r["id"], name, int(score)))
        saved = editor_sources(r.get("data_source"))
        if saved is not None:
            from_editor[r["id"]] = saved
    # Child rows are copied only where their driver exists; SQLite does not
    # enforce the previous foreign keys, so a database can hold orphans.
    owned = "trend_id IN (SELECT id FROM trends)"
    orphans = {}
    for child in CHILD_TABLES:
        if child in tables:
            n = db.rows(f"SELECT COUNT(*) AS n FROM {child} WHERE trend_id IS NULL OR NOT ({owned})")[0]["n"]
            if n:
                orphans[child] = int(n)
    report["exposures"] = {
        "names_outside_the_taxonomy_dropped": {d["row"]["id"]: d["dropped"] for d in drivers if d["dropped"]},
        "missing_names_set_to_0": {d["row"]["id"]: d["filled"] for d in drivers if d["filled"]},
    }
    report["baselines"] = {
        "from_the_current_scores": [d["row"]["id"] for d in drivers if d["baseline_from"] == "scores"],
        "fields_from_the_current_scores": {d["row"]["id"]: d["baseline_filled"] for d in drivers
                                           if d["baseline_filled"]},
    }

    table_sources: dict = {}
    if "trend_sources" in tables:
        for r in db.rows(f"SELECT * FROM trend_sources WHERE {owned} ORDER BY id"):
            table_sources.setdefault(r["trend_id"], []).append(
                {"title": r["title"], "url": r["url"], "tier": r.get("tier") or "",
                 "published": published_from(r.get("source_type"))})
    source_count, unrated, unlinked, empty = 0, {}, {}, {}
    for driver_id in sorted(set(table_sources) | set(from_editor)):
        for src in from_editor.get(driver_id, table_sources.get(driver_id, [])):
            tier = src["tier"].strip()
            if tier not in SOURCE_TIERS:
                if tier:
                    unrated.setdefault(driver_id, []).append(tier)
                tier = ""
            # A link is an http(s) address, as the API accepts it; any other text
            # is kept as the title where the source has none.
            title, url = src["title"], src["url"].strip()
            if url and not WEB_ADDRESS.fullmatch(url):
                unlinked.setdefault(driver_id, []).append(url)
                title, url = title if title.strip() else url, ""
            if not (title.strip() or url):
                empty[driver_id] = empty.get(driver_id, 0) + 1
                continue
            db.execute(f"INSERT INTO driver_sources (driver_id, title, url, tier, published) "
                       f"VALUES ({p}, {p}, {p}, {p}, {p})",
                       (driver_id, title, url, tier, src["published"]))
            source_count += 1
    report["sources_from_editor"] = {
        driver_id: {"saved_in_editor": len(saved), "table_rows": len(table_sources.get(driver_id, []))}
        for driver_id, saved in sorted(from_editor.items())}
    report["source_tiers_outside_the_scale"] = unrated
    report["source_links_that_are_not_web_addresses"] = unlinked
    report["sources_without_title_or_link_skipped"] = empty

    proposals, cleared = [], {}
    if "trend_score_proposals" in tables:
        start_years = {d["row"]["id"]: d["row"]["start_year"] for d in drivers}
        for r in db.rows(f"SELECT * FROM trend_score_proposals WHERE {owned} ORDER BY id"):
            values, dropped_fields = proposal_scores(r, start_years[r["trend_id"]])
            if dropped_fields:
                cleared[f"{r['trend_id']}/{r['user_id']}"] = dropped_fields
            proposals.append(values)
            db.execute(
                "INSERT INTO driver_score_proposals (driver_id, user_id, user_name, probability, gp1_pct_affected, "
                "peak_year, diffusion_curve, uncertainty, category_exposure, regional_exposure, vc_epicentre, "
                f"comment, updated_at) VALUES ({', '.join([p] * 13)})",
                (r["trend_id"], r["user_id"], r.get("user_name") or "", values["probability"],
                 values["gp1_pct_affected"], values["peak_year"], values["diffusion_curve"], values["uncertainty"],
                 json.dumps(values["category_exposure"]) if values["category_exposure"] else None,
                 json.dumps(values["regional_exposure"]) if values["regional_exposure"] else None,
                 values["vc_epicentre"], r.get("comment"), r.get("updated_at")))
    report["copied"] = {"drivers": len(drivers), "sources": source_count, "proposals": len(proposals)}
    report["proposals"] = {
        "with_a_value_chain_stage": sum(v["vc_epicentre"] is not None for v in proposals),
        "scores_cleared": cleared,
    }
    report["orphans_skipped"] = orphans

    # ── drop what nothing uses, hold the kept tables to the schema ──────────
    report["kept_tables"] = hold_kept_tables(db, archive, drop_columns)
    dropped = [t for t in DROP_TABLES if t in tables]
    for table in dropped:
        db.execute(f"DROP TABLE {table}")
    report["dropped_tables"] = dropped
    report["dropped_simulation_run_columns"] = drop_columns

    # ── stored runs ─────────────────────────────────────────────────────────
    start_years = {d["row"]["id"]: d["row"]["start_year"] for d in drivers}
    renamed_runs = completed_runs = 0
    for row in db.rows("SELECT id FROM simulation_runs ORDER BY id"):
        raw = db.rows(f"SELECT results FROM simulation_runs WHERE id = {p}", (row["id"],))[0]["results"]
        try:
            results = json_value(raw)
        except ValueError:
            continue
        if not isinstance(results, dict):
            continue
        renamed = update_run_keys(results)
        completed = complete_fingerprint(results, start_years)
        if renamed or completed:
            db.execute(f"UPDATE simulation_runs SET results = {p} WHERE id = {p}", (json.dumps(results), row["id"]))
        renamed_runs += renamed
        completed_runs += completed
    report["runs"] = {"with_renamed_keys": renamed_runs, "with_the_fingerprint_completed": completed_runs}

    # ── content ─────────────────────────────────────────────────────────────
    present = {r["id"]: r for r in db.rows("SELECT id, description FROM drivers")}
    descriptions = json.loads(DESCRIPTIONS_FILE.read_text(encoding="utf-8"))["descriptions"]
    moved, current, edited = [], [], []
    for driver_id, entry in descriptions.items():
        if driver_id not in present:
            continue
        stored = present[driver_id]["description"]
        if stored == entry["text"]:
            current.append(driver_id)
        elif sha256(stored) in entry["previous_sha256"]:
            db.execute(f"UPDATE drivers SET description = {p}, revision = revision + 1, "
                       f"updated_at = CURRENT_TIMESTAMP WHERE id = {p}",
                       (entry["text"], driver_id))
            moved.append(driver_id)
        else:
            edited.append(driver_id)
    report["descriptions"] = {"updated": len(moved), "already_current": len(current), "edited_left_alone": edited}

    if journey is not None:
        db.execute(f"INSERT INTO journey_content (content, updated_by) VALUES ({p}, {p})",
                   (json.dumps(journey), f"migration {MIGRATION}"))
    report["journey"] = journey_report

    db.execute(f"INSERT INTO schema_migrations (version) VALUES ({p})", (MIGRATION,))
    summary = (f"{len(drivers)} drivers, {source_count} sources, {len(proposals)} proposals copied; "
               f"{len(dropped)} tables dropped; {renamed_runs} runs renamed")
    db.execute("INSERT INTO audit_log (action, entity_type, entity_id, new_value, reason, user_id) "
               f"VALUES ('schema_migrated', 'database', {p}, {p}, {p}, 'migration-0001')",
               (MIGRATION, summary, "Moved to the driver schema by migrations/0001_driver_schema/migrate.py"))

    if not db.postgres:
        problems = db.rows("PRAGMA foreign_key_check")
        if problems:
            raise RuntimeError(f"foreign key check failed after the copy: {problems[:5]}")
    return {"report": report, "archive": archive}


def hold_kept_tables(db: Database, archive: dict, drop_columns: list) -> dict:
    """Bring simulation_runs, journey_content and audit_log to the definitions
    of the driver schema (step 3 of the module docstring); returns the report.

    SQLite can neither add NOT NULL to a column nor drop a default or a column
    that takes part in a foreign key (older databases have config_snapshot_id
    REFERENCES config_snapshots), so there each table is created again from
    the current definition and its rows copied with their ids, and the
    autoincrement counter keeps its place.
    """
    p = db.p
    removed = db.rows("SELECT * FROM simulation_runs WHERE iterations IS NULL OR results IS NULL ORDER BY id")
    if removed:
        archive["simulation_runs_removed"] = [{k: jsonable(v) for k, v in r.items()} for r in removed]
        db.execute("DELETE FROM simulation_runs WHERE iterations IS NULL OR results IS NULL")
    filled = {}
    for (table, column), value in FILL_VALUES.items():
        ids = [r["id"] for r in db.rows(f"SELECT id FROM {table} WHERE {column} IS NULL ORDER BY id")]
        if ids:
            db.execute(f"UPDATE {table} SET {column} = {p} WHERE {column} IS NULL", (value,))
            filled[f"{table}.{column}"] = len(ids)
            # the archive tells a filled value from one that was stored
            archive.setdefault("missing_values_filled", {})[f"{table}.{column}"] = ids
    if db.postgres:
        for column in drop_columns:
            db.execute(f"ALTER TABLE simulation_runs DROP COLUMN {column}")
        db.execute("ALTER TABLE simulation_runs ALTER COLUMN iterations SET NOT NULL, "
                   "ALTER COLUMN results SET NOT NULL")
        db.execute("ALTER TABLE journey_content ALTER COLUMN updated_by SET NOT NULL, "
                   "ALTER COLUMN updated_by DROP DEFAULT")
        db.execute("ALTER TABLE audit_log ALTER COLUMN entity_type SET NOT NULL, "
                   "ALTER COLUMN entity_id SET NOT NULL, ALTER COLUMN user_id SET NOT NULL, "
                   "ALTER COLUMN user_id DROP DEFAULT")
    else:
        for table in KEPT_COLUMNS:
            _rebuild_sqlite_table(db, table)
    return {"runs_removed_without_results_or_iterations": [r["id"] for r in removed],
            "missing_values_filled": filled}


def _rebuild_sqlite_table(db: Database, table: str) -> None:
    """Create a SQLite table again from the driver schema's definition, with its rows and ids."""
    columns = ", ".join(KEPT_COLUMNS[table])
    create = next(st for st in schema(False) if f"CREATE TABLE IF NOT EXISTS {table} (" in st)
    counter = (db.rows("SELECT seq FROM sqlite_sequence WHERE name = ?", (table,))
               if "sqlite_sequence" in db.tables() else [])
    db.execute(create.replace(f"CREATE TABLE IF NOT EXISTS {table} (", f"CREATE TABLE {table}_rebuilt ("))
    db.execute(f"INSERT INTO {table}_rebuilt ({columns}) SELECT {columns} FROM {table} ORDER BY id")
    db.execute(f"DROP TABLE {table}")
    db.execute(f"ALTER TABLE {table}_rebuilt RENAME TO {table}")
    if counter:
        db.execute("UPDATE sqlite_sequence SET seq = MAX(seq, ?) WHERE name = ?", (counter[0]["seq"], table))
    for index in (st for st in schema(False) if st.startswith("CREATE INDEX") and f" ON {table}(" in st):
        db.execute(index)


def updated_journey(db: Database) -> tuple:
    """The newest stored journey content brought up to date, without writing it.

    Per tile: trendCodes becomes driverCodes (an empty list where a tile has
    neither); a code that is not a driver of the driver base is removed, since
    the dashboard resolves every code to one; a text that still holds a
    previously shipped version gets the current one (journey_edits.json, which
    lists stage labels the same way); escaped paragraph breaks ("\\n") in a
    text an admin saved are written out; and every key outside the tile shape
    of prism/journey.py is removed (the author in a tile's provenance, the
    direction of its pool impact, which its side gives). A tile the previous
    editor still marked as an AI suggestion pending review cannot be stored as
    it is, since every tile now reads as strategist-authored, and neither can
    content the API would refuse; both come back as problems.

    Returns (the content to save as a new version, or None when nothing
    changed; the report; the problems).
    """
    rows = db.rows("SELECT id, content FROM journey_content ORDER BY id DESC LIMIT 1")
    if not rows:
        return None, {"stored_content": False}, []
    content = json_value(rows[0]["content"])
    if not isinstance(content, dict):
        return None, {"stored_content": True}, ["journey content: the newest version is not a tile map"]
    edits = json.loads(JOURNEY_EDITS_FILE.read_text(encoding="utf-8"))["edits"]
    by_id: dict = {}
    for e in edits:
        by_id.setdefault(e.get("tile") or e["stage"], []).append(e)
    renamed = applied = unescaped = 0
    already, edited, removed, pending = [], [], {}, []
    keys_removed: dict = {}

    def apply_edits(item: dict) -> None:
        nonlocal applied
        for e in by_id.get(item.get("id"), []):
            stored = item.get(e["field"])
            if stored == e["text"]:
                already.append(f"{item['id']}.{e['field']}")
            elif sha256(stored) in e["previous_sha256"]:
                item[e["field"]] = e["text"]
                applied += 1
            else:
                edited.append(f"{item['id']}.{e['field']}")

    def remove_unknown(item, allowed: tuple, prefix: str) -> None:
        if isinstance(item, dict):
            for key in unknown_keys(item, allowed):
                del item[key]
                keys_removed[prefix + key] = keys_removed.get(prefix + key, 0) + 1

    remove_unknown(content, JOURNEYS, "")
    for journey in JOURNEYS:
        for stage in content.get(journey) or []:
            if not isinstance(stage, dict):
                continue
            remove_unknown(stage, STAGE_KEYS, "stage.")
            apply_edits(stage)
            for side in SIDES:
                tiles = stage.get(side) if isinstance(stage.get(side), list) else []
                for i, tile in enumerate(tiles):
                    if not isinstance(tile, dict):
                        continue
                    if "driverCodes" not in tile:
                        tile = {("driverCodes" if k == "trendCodes" else k): v for k, v in tile.items()}
                        tile.setdefault("driverCodes", [])
                        tiles[i] = tile
                        renamed += 1
                    if isinstance(tile["driverCodes"], list):
                        unknown = [c for c in tile["driverCodes"] if c not in DRIVER_CODES]
                        if unknown:
                            tile["driverCodes"] = [c for c in tile["driverCodes"] if c in DRIVER_CODES]
                            removed[tile.get("id")] = unknown
                    provenance = tile.get("provenance")
                    if isinstance(provenance, dict) and provenance.get("author") == "ai":
                        pending.append(tile.get("id"))
                    remove_unknown(provenance, PROVENANCE_KEYS, "provenance.")
                    remove_unknown(tile.get("poolImpact"), POOL_IMPACT_KEYS, "poolImpact.")
                    remove_unknown(tile, TILE_KEYS + OPTIONAL_TILE_KEYS, "tile.")
                    apply_edits(tile)
                    for field in ("analysis", "driverNote"):
                        if isinstance(tile.get(field), str) and "\\n" in tile[field]:
                            tile[field] = tile[field].replace("\\n", "\n")
                            unescaped += 1
    problems = [f"journey tile {tile_id}: an AI suggestion still pending review; accept or delete it"
                for tile_id in pending]
    problem = content_problem(content)
    if problem:
        problems.append(f"journey content: {problem}")
    changed = bool(renamed or applied or unescaped or removed or keys_removed)
    report = {"stored_content": True, "tiles_renamed": renamed, "texts_updated": applied,
              "texts_already_current": len(already), "texts_edited_left_alone": edited,
              "texts_with_breaks_written_out": unescaped, "codes_removed": removed,
              "keys_removed": keys_removed, "new_version_saved": changed}
    return (content if changed else None), report, problems


def main(argv: list | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="run inside a transaction, report, then roll back")
    parser.add_argument("--postgres", action="store_true", help="confirm that a PostgreSQL database may be changed")
    parser.add_argument("--sqlite", metavar="PATH", help="migrate this SQLite file instead of the configured database")
    args = parser.parse_args(argv)

    try:
        db = Database(args.sqlite)
    except FileNotFoundError as e:
        print(f"Cannot open the database: {e}")
        return 1
    except Exception as e:  # noqa: BLE001 (reported by its category, never by its raw text)
        # A driver's message about a failed connection can quote part of the
        # URL, password included.
        print(f"Cannot open the database: {describe_error(e)}")
        return 1
    tables = db.tables()
    if "drivers" in tables:
        done = "schema_migrations" in tables and db.rows(
            f"SELECT 1 AS x FROM schema_migrations WHERE version = {db.p}", (MIGRATION,))
        if done:
            print(f"{db.where}: already on the driver schema; nothing to do.")
            return 0
        print(f"{db.where}: has a drivers table but no record of this migration; refusing to guess.")
        return 1
    if "trends" not in tables:
        print(f"{db.where}: no trends table, so this is not a database of the previous schema. "
              "A new database needs no migration: the API creates the schema on first use.")
        return 1
    if db.postgres and not args.dry_run and not args.postgres:
        print(f"{db.where}: pass --postgres to migrate a PostgreSQL database (or --dry-run to preview).")
        return 1

    db.begin()
    try:
        result = migrate(db)
    except NeedsCorrection as e:
        db.rollback()
        print(f"{db.where}: nothing changed; {e}")
        print("Correct drivers and journey content in the previous release's dashboard (after the deploy, "
              "roll back to the previous production deployment in Vercel first). For a column the driver schema "
              "does not know, or one a kept table lacks, see README.md, step 2. Then run the dry run again.")
        return 1
    except Exception as e:  # noqa: BLE001 (rolled back and reported)
        db.rollback()
        print(f"Migration FAILED and was rolled back; the database is unchanged.\n  {type(e).__name__}: {e}")
        return 2

    print(json.dumps(result["report"], indent=2, default=str))
    if args.dry_run:
        db.rollback()
        print("Dry run: rolled back, nothing changed.")
        return 0
    try:
        ARCHIVE_DIR.mkdir(mode=0o700, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        archive_file = ARCHIVE_DIR / f"{db.label}-{stamp}.json"
        # Owner-only: the archive holds user emails and the previous content.
        fd = os.open(archive_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(json.dumps(result["archive"], indent=1, default=str))
        db.commit()
    except Exception as e:  # noqa: BLE001 (rolled back and reported)
        db.rollback()
        print(f"Migration FAILED at the commit and was rolled back; the database is unchanged.\n  {e}")
        return 2
    print(f"Migrated. Archive of everything dropped: {archive_file}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
