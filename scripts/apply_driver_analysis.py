#!/usr/bin/env python3
"""
Move a database's PRISM Analysis texts onto the committed readings, and its
driver descriptions onto the base file that carries no review notes (owner
instruction of 2026-09-17, O16). Archive-first, idempotent, one run per
database, by the owner.

    python3 scripts/apply_driver_analysis.py --dry-run     # report only, no writes
    python3 scripts/apply_driver_analysis.py               # local SQLite
    python3 scripts/apply_driver_analysis.py --postgres    # REQUIRED to touch Neon

Why a script: the database copy of a driver (the `trends` table) takes
precedence over the seed, so neither the seed's new `strategic_implication`
nor its cleaned `description` reaches a page on its own. The readings live in
data/trend_base_2026-09/driver_analysis_v1.json, rendered from the
attribution record by scripts/build_driver_analysis.py; the descriptions are
those of core_set_51_v6.json, which is v5 with the review's own notes ("the
old base assumed ...") taken out of 34 descriptions. This script writes the
rendered reading, verbatim, into `trends.strategic_implication` for every
driver of the base, moves a description that still reads as v5 onto v6, and
changes nothing else.

What it does, in order, and nothing else:
  1. Refuses to run against Postgres without --postgres (the same near-miss
     guard as scripts/replace_trend_base.py and apply_driver_vocabulary.py),
     and refuses --postgres when the connection is not Postgres. A dry run
     never writes and never creates a database file.
  2. Verifies that every committed text is the rendering of its template on
     the committed attribution record (the same renderer, no engine), so a
     stale file cannot be written into a database.
  3. Reads every driver of the base from the database and prints how many
     readings will change, how many already carry the reading, and, for the
     descriptions, how many still read as v5 (moved), as v6 (done) or as
     something else (an admin reworded it: reported, never forced). A driver
     of the base that the database does not have stops the run (exit 8):
     the readings describe the 51-driver base and nothing else. A driver
     whose scoring inputs in the database differ from the seed's (the D19
     fingerprint plus the onset year) stops the run too (exit 9), because a
     reading written on the seed's scores would describe scores the live
     model does not have: a database ahead of the seed (an admin re-score)
     gets the re-score carried into the base file and the readings
     regenerated first; one behind the seed (every driver differing in
     category exposure means the Toilet Care column of O13 never reached it)
     is brought onto the seed first; --allow-drift writes anyway with the
     drift listed.
  4. Archives the current texts and descriptions to
     data/archive/driver_analysis_<mode>_<stamp>.json and reads the archive
     back before anything is written.
  5. Writes in ONE transaction: an UPDATE of `strategic_implication` and, where
     it still reads as v5, of `description` per driver, compare-and-swap on
     the text that was read (an admin write in between rolls the whole run
     back), and the audit-log entry. No score, exposure, source, provenance
     flag or expert proposal is touched, so the next production run reports
     no input drift.
  6. Re-reads and verifies that every written driver now carries its reading
     and its description.

Both gates also check the seed against the record: the readings are rendered
from the committed attribution record, whose reference run is stamped with a
digest of the seed's scoring state and the configuration, so a re-scored seed
cannot carry readings reconciled to a median it does not produce
(scripts/build_driver_analysis.py refuses to build on it and --check fails).

Exit codes: 0 done, or nothing to change · 2 cannot read the table, or no
database file · 3 archive failed (nothing changed) · 4 Postgres without
--postgres, or --postgres on a connection that is not Postgres · 5 problems
after the write, or the commit did not confirm (run --dry-run to see; running
the script again is safe) · 6 write failed, lock timeout, or a text changed
while the script ran (rolled back, nothing changed; re-run) · 7 the committed
readings are stale (regenerate with scripts/build_driver_analysis.py first) ·
8 a driver of the base is not in this database (nothing written) · 9 a
driver's scoring inputs differ from the seed's (nothing written; --allow-drift
overrides). A dry run returns 8 and 9 too, so that the report is not mistaken
for a clean one.

Run scripts/apply_driver_vocabulary.py (O15) before this script on a database
not yet moved by it: three of the descriptions this script expects to find in
their v5 wording are the ones that script rewords.

On a machine whose .env names the Neon database, blank the URLs to work on the
local SQLite copy: DATABASE_URL= POSTGRES_URL= python3 scripts/apply_driver_analysis.py

Run it right before the production deploy that ships the readings, redeploy
(or restart the API) right after it, ask admins to reload any open Drivers
page before they edit, and run --dry-run once more after the deploy. The old
texts come back through two vectors. The API keeps the driver list in memory
per instance (`pulse/api/state.py`), serves it from there, and an admin edit
writes every column of the cached driver back through `save_trends`, the old
reading and the old description included, until every warm instance has been
replaced. And the Drivers editor sends the description it loaded with the
page on every save (the reading it never sends), so a page opened before this
script ran writes the old description back even against a fresh instance. The
second dry run must report 0 to change and 0 to move.
"""
from __future__ import annotations

import argparse
import datetime
import json
import os
import sys
from urllib.parse import urlsplit

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, REPO)
import pulse.env_loader  # noqa: F401,E402  (loads .env; shell wins, M17)
from pulse.database import (  # noqa: E402
    POSTGRES_URL, USE_POSTGRES, get_db_connection, placeholder, ph,
    _get_sqlite_path, _row_to_dict,
)
from pulse.audit.input_drift import trend_fingerprint  # noqa: E402
from scripts.driver_analysis_render import render_all  # noqa: E402

UPDATED_BY = "scripts/apply_driver_analysis.py"
BASE_DIR = os.path.join(REPO, "data", "trend_base_2026-09")
ANALYSIS_PATH = os.path.join(BASE_DIR, "driver_analysis_v1.json")
ATTRIBUTION_PATH = os.path.join(BASE_DIR, "driver_attribution_v1.json")
#: The descriptions this script writes (v6) and the ones a database carries
#: before it (v5, the O15 wording). An untouched database is on v5 once the
#: vocabulary script has run.
DESCRIPTIONS_NEW = os.path.join(BASE_DIR, "core_set_51_v6.json")
DESCRIPTIONS_PREVIOUS = os.path.join(BASE_DIR, "core_set_51_v5.json")
#: The wording before the O15 vocabulary script (v4): a description still on
#: it means that script has not run on this database yet.
DESCRIPTIONS_BEFORE_O15 = os.path.join(BASE_DIR, "core_set_51_v4.json")
#: The scoring inputs a reading is written on: the D19 fingerprint keys plus
#: the onset year (which the fingerprint does not carry).
SCORING_KEYS = {"p": "probability", "g": "GP1 share", "d": "direction", "f": "force",
                "ce": "category exposure", "ve": "value-chain epicentre", "re": "regional exposure",
                "pk": "peak year", "dc": "diffusion curve", "u": "uncertainty score"}


class _Conflict(RuntimeError):
    """The database changed between the read and the write."""


class _CommitUnconfirmed(RuntimeError):
    """The commit raised: the transaction may or may not have been applied."""


class _Stale(RuntimeError):
    """The committed readings are not the rendering of their templates."""


def _describe(e: BaseException) -> str:
    return f"{type(e).__name__}: {' '.join(str(e).split())}"


def _utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def load_readings() -> dict:
    """{trend id: text}, verified against the attribution record."""
    with open(ANALYSIS_PATH, encoding="utf-8") as fh:
        analysis = json.load(fh)
    with open(ATTRIBUTION_PATH, encoding="utf-8") as fh:
        record = json.load(fh)
    rendered = render_all(record, analysis)
    id_of = {d["code"]: tid for tid, d in record["drivers"].items()}
    out = {}
    for code, entry in analysis["drivers"].items():
        tid = id_of[code]
        if entry.get("text") != rendered[tid]:
            raise _Stale(f"{code}: the committed text is not the rendering of its template on the "
                         f"committed record; run scripts/build_driver_analysis.py")
        out[tid] = rendered[tid]
    return out


def load_descriptions() -> dict:
    """{trend id: (previous description, new description)} from the base files,
    keyed by the ids the generator assigns, and verified against the seed."""
    from pulse.seed_trends import get_report_trends
    seed = {t.id: t for t in get_report_trends()}
    with open(DESCRIPTIONS_NEW, encoding="utf-8") as fh:
        new = {d["code"]: d["desc"] for d in json.load(fh)}
    with open(DESCRIPTIONS_PREVIOUS, encoding="utf-8") as fh:
        old = {d["code"]: d["desc"] for d in json.load(fh)}
    with open(DESCRIPTIONS_BEFORE_O15, encoding="utf-8") as fh:
        before_o15 = {d["code"]: d["desc"] for d in json.load(fh)}
    with open(ATTRIBUTION_PATH, encoding="utf-8") as fh:
        record = json.load(fh)
    # the record's codes are display codes; the base files key by review code
    # (two drivers moved force in the review: T-06 -> K-13, X-06 -> C-37)
    review_code = {"K-13": "T-06", "C-37": "X-06"}
    out = {}
    for tid, d in record["drivers"].items():
        code = review_code.get(d["code"], d["code"])
        if seed[tid].description != new[code]:
            raise _Stale(f"{d['code']}: the seed's description is not the base file's (v6); "
                         f"run scripts/generate_seed_from_core_set.py")
        out[tid] = (old[code], new[code], before_o15[code])
    return out


def scoring_drift(db_trends: dict) -> dict:
    """{trend id: [field names]} where the database's scoring inputs differ
    from the seed's. Empty when the readings describe the live scores."""
    from pulse.seed_trends import get_report_trends
    seed = {t.id: t for t in get_report_trends()}
    ours = trend_fingerprint(list(seed.values()))
    theirs = trend_fingerprint([t for tid, t in db_trends.items() if tid in seed])
    out = {}
    for tid in ours:
        if tid not in theirs:
            continue
        fields = [SCORING_KEYS[k] for k in ours[tid] if ours[tid].get(k) != theirs[tid].get(k)]
        if (seed[tid].start_year or None) != (db_trends[tid].start_year or None):
            fields.append("onset year")
        if fields:
            out[tid] = fields
    return out


def _read_state(ids: list[str]) -> dict:
    """{trend id: (current strategic_implication, current description)} or
    None for a driver the database does not have."""
    p = placeholder()
    out = {}
    with get_db_connection() as conn:
        cur = conn.cursor()
        for tid in ids:
            cur.execute(f"SELECT id, strategic_implication, description FROM trends WHERE id = {p}", (tid,))
            row = cur.fetchone()
            if row:
                d = _row_to_dict(row)
                out[tid] = (d.get("strategic_implication") or "", d.get("description") or "")
            else:
                out[tid] = None
    return out


def plan(readings: dict, current: dict, descriptions: dict | None = None) -> list[dict]:
    """Pure. Per driver: the reading's status, 'apply' (text differs), 'done'
    (identical) or 'no-such-driver'; and the description's, 'apply' (still
    the previous wording), 'done' (already the new one) or 'reworded' (neither:
    an admin edited it, reported and left alone)."""
    items = []
    for tid, text in readings.items():
        cur = current.get(tid)
        if cur is None:
            items.append({"id": tid, "status": "no-such-driver", "new": text, "current": None,
                          "desc_status": "no-such-driver", "desc_new": None, "desc_current": None})
            continue
        cur_text, cur_desc = cur
        status = "done" if cur_text == text else "apply"
        desc_status, desc_new = "done", None
        if descriptions and tid in descriptions:
            prev, new, before_o15 = descriptions[tid][:3]
            if cur_desc == new:
                desc_status = "done"
            elif cur_desc == prev:
                desc_status, desc_new = "apply", new
            elif cur_desc == before_o15 and before_o15 != prev:
                desc_status = "before-O15"
            else:
                desc_status = "reworded"
        items.append({"id": tid, "status": status, "new": text, "current": cur_text,
                      "desc_status": desc_status, "desc_new": desc_new, "desc_current": cur_desc})
    return items


def _target() -> str:
    if not USE_POSTGRES:
        return f"sqlite ({_get_sqlite_path()})"
    url = POSTGRES_URL or ""
    try:
        if "://" in url:
            parts = urlsplit(url)
            where = f"{parts.hostname or '?'}{parts.path or ''}"
        else:
            kv = dict(item.split("=", 1) for item in url.split() if "=" in item)
            where = f"{kv.get('host', '?')}/{kv.get('dbname', '?')}"
    except ValueError:
        where = "?"
    return f"postgres ({where})"


def _refusal(dry_run: bool, allow_postgres: bool) -> str | None:
    if USE_POSTGRES and not allow_postgres and not dry_run:
        return ("this connection resolves to Postgres. If you really mean the production database, "
                "re-run with --postgres. To work on the local SQLite copy instead, blank the URLs: "
                "DATABASE_URL= POSTGRES_URL= python3 scripts/apply_driver_analysis.py")
    if allow_postgres and not USE_POSTGRES:
        why = ("POSTGRES_URL / DATABASE_URL is set, but psycopg2 is not installed, so the connection "
               "fell back to SQLite (pip install -r requirements-dev.txt)"
               if (os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL"))
               else "neither POSTGRES_URL nor DATABASE_URL is set")
        return f"--postgres was given, but this connection is not Postgres: {why}. Nothing was read or written."
    return None


def _write(apply: list[dict], audit: tuple) -> None:
    """One transaction, compare-and-swap on every text that was read."""
    p = placeholder()
    committing, commit_error = False, None
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            try:
                if USE_POSTGRES:
                    cur.execute("SET LOCAL lock_timeout = '15s'")
                else:
                    conn.execute("BEGIN IMMEDIATE")
                for i in apply:
                    if i["status"] == "apply":
                        cur.execute(
                            f"UPDATE trends SET strategic_implication = {p}, updated_at = CURRENT_TIMESTAMP "
                            f"WHERE id = {p} AND COALESCE(strategic_implication, '') = {p}",
                            (i["new"], i["id"], i["current"]),
                        )
                        if cur.rowcount != 1:
                            raise _Conflict(f"driver {i['id']} changed after the read")
                    if i["desc_status"] == "apply":
                        cur.execute(
                            f"UPDATE trends SET description = {p}, updated_at = CURRENT_TIMESTAMP "
                            f"WHERE id = {p} AND COALESCE(description, '') = {p}",
                            (i["desc_new"], i["id"], i["desc_current"]),
                        )
                        if cur.rowcount != 1:
                            raise _Conflict(f"driver {i['id']} (description) changed after the read")
                cur.execute(
                    "INSERT INTO audit_log (action, entity_type, entity_id, old_value, new_value, reason, user_id) "
                    f"VALUES ({ph(7)})",
                    audit,
                )
            except Exception:
                conn.rollback()
                raise
            committing = True
            try:
                conn.commit()
            except Exception as e:
                commit_error = e
                raise
    except Exception as e:
        if committing:
            cause = commit_error or e
            raise _CommitUnconfirmed(_describe(cause)) from cause
        raise


def main(dry_run: bool, allow_postgres: bool, archive_dir: str | None = None, allow_drift: bool = False) -> int:
    mode = "postgres" if USE_POSTGRES else "sqlite"
    now = _utc_now()
    stamp = now.strftime("%Y%m%d_%H%M%S_%f")
    print(f"target database mode: {_target()}")
    refusal = _refusal(dry_run, allow_postgres)
    if refusal:
        print("REFUSING: " + refusal)
        return 4
    if not USE_POSTGRES and not _get_sqlite_path().is_file():
        print(f"ABORT: no SQLite database at {_get_sqlite_path()}; nothing was created. "
              "Set PRISM_DB_PATH to the database file.")
        return 2

    try:
        readings = load_readings()
        descriptions = load_descriptions()
    except _Stale as e:
        print(f"ABORT: {e}")
        return 7
    try:
        current = _read_state(list(readings))
        from pulse.database import load_trends
        db_trends = {t.id: t for t in load_trends()}
    except Exception as e:
        print(f"ABORT: cannot read the trends table ({_describe(e)})")
        return 2

    items = plan(readings, current, descriptions)
    missing = [i for i in items if i["status"] == "no-such-driver"]
    to_write = [i for i in items if i["status"] == "apply" or i["desc_status"] == "apply"]
    n_text = sum(1 for i in items if i["status"] == "apply")
    n_desc = sum(1 for i in items if i["desc_status"] == "apply")
    done = [i for i in items if i["status"] == "done"]
    reworded = [i for i in items if i["desc_status"] == "reworded"]
    before_o15 = [i for i in items if i["desc_status"] == "before-O15"]
    desc_done = sum(1 for i in items if i["desc_status"] == "done")
    print(f"readings: {len(readings)}; to change: {n_text}; already current: {len(done)}; "
          f"not in this database: {len(missing)}")
    print(f"descriptions: to move onto v6: {n_desc}; already v6: {desc_done}; reworded by an admin, "
          f"left alone: {len(reworded)}; still on the pre-O15 wording: {len(before_o15)}")
    for i in before_o15:
        print(f"  description of {i['id']} is still on its pre-O15 wording: run scripts/apply_driver_vocabulary.py "
              "first, then this script again")
    for i in reworded:
        print(f"  description of {i['id']} is neither the v5 nor the v6 text; read it by hand")
    for i in missing:
        print(f"  no such driver in the database: {i['id']}")
    if missing:
        print(f"ABORT: {len(missing)} driver(s) of the base are not in this database (is it on the 51-driver "
              "base? scripts/replace_trend_base.py); nothing written.")
        return 8
    drift = scoring_drift(db_trends)
    for tid, fields in sorted(drift.items()):
        print(f"  scoring drift: {tid} differs from the seed in {', '.join(fields)}")
    if drift and not allow_drift:
        print(f"ABORT: {len(drift)} driver(s) carry scoring inputs that differ from the seed the readings "
              "were written on, so a reading would describe scores the live model does not have. If the "
              "database is ahead of the seed (an admin re-score), carry the re-score into "
              "data/trend_base_2026-09/core_set_51_v6.json and regenerate (scripts/build_driver_analysis.py "
              "--reference, scripts/generate_seed_from_core_set.py); if it is behind the seed (every driver "
              "differs in category exposure: the Toilet Care column of O13 never reached it), bring it onto "
              "the seed first (POST /api/v1/trends/sync, or scripts/replace_trend_base.py --force, archive-first); "
              "or re-run with --allow-drift to write anyway. Nothing written.")
        return 9
    if drift:
        print(f"WARNING: writing with --allow-drift; the readings of the {len(drift)} driver(s) above describe "
              "the seed's scores, not this database's.")
    if dry_run:
        for i in to_write:
            what = " and ".join(w for w, on in (("reading", i["status"] == "apply"),
                                                 ("description", i["desc_status"] == "apply")) if on)
            print(f"  would update {i['id']} ({what})")
        print("dry-run complete: nothing written.")
        return 0
    if not to_write:
        print("nothing to change: this database already carries the readings and the v6 descriptions.")
        return 0
    apply = to_write

    archive_dir = archive_dir or os.path.join(REPO, "data", "archive")
    try:
        os.makedirs(archive_dir, exist_ok=True)
        archive_path = os.path.join(archive_dir, f"driver_analysis_{mode}_{stamp}.json")
        payload = {
            "archived_at_utc": now.isoformat(), "mode": mode, "target": _target(),
            "instruction": "owner instruction 2026-09-17 (O16): PRISM Analysis rebuilt on the model attribution; "
                           "descriptions without the review's notes",
            "drivers": {i["id"]: i["current"] for i in apply},
            "descriptions": {i["id"]: i["desc_current"] for i in apply if i["desc_status"] == "apply"},
        }
        with open(archive_path, "x", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=1, default=str, ensure_ascii=False)
        with open(archive_path, encoding="utf-8") as fh:
            json.load(fh)
    except Exception as e:
        print(f"ABORT: archive failed ({_describe(e)}); nothing changed")
        return 3
    print(f"archived current values -> {archive_path}")

    audit = (
        "driver_analysis_applied", "trend", "all",
        f"archive {os.path.basename(archive_path)}",
        f"strategic_implication rewritten for {n_text} driver(s); description moved onto v6 for {n_desc} driver(s)",
        "Owner instruction 2026-09-17: the PRISM Analysis is rebuilt on the model's attribution "
        "(docs/DRIVER_ANALYSIS_CONCEPT.md); readings rendered by scripts/build_driver_analysis.py",
        "owner-cli",
    )
    try:
        _write(apply, audit)
    except _CommitUnconfirmed as e:
        print(f"PROBLEMS: the commit did not confirm ({e}), so the change may or may not be in the "
              "database. Run --dry-run to see; running the script again is safe either way.")
        return 5
    except Exception as e:
        print(f"ABORT: the write was rolled back, nothing changed ({_describe(e)}). Re-run the script; "
              "the archive above is informational.")
        return 6
    print(f"drivers: {n_text} PRISM Analysis text(s) updated, {n_desc} description(s) moved onto v6")

    try:
        after = _read_state([i["id"] for i in apply])
    except Exception as e:
        print(f"PROBLEMS: the change is committed, but it could not be read back ({_describe(e)}). "
              "Run --dry-run to see the current state.")
        return 5
    problems = [i["id"] for i in apply
                if (after.get(i["id"]) or (None, None))[0] != i["new"]
                or (i["desc_status"] == "apply" and (after.get(i["id"]) or (None, None))[1] != i["desc_new"])]
    if problems:
        print("PROBLEMS: the change is committed and audited, but the database no longer shows all of it "
              "(most likely a save landed right after it): " + ", ".join(problems))
        print("Run --dry-run to see the current state and run the script again if it reports anything to "
              "change. The archive above holds the values from before this run.")
        return 5
    print("done.")
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--postgres", action="store_true", help="acknowledge that the target is the production database")
    ap.add_argument("--archive-dir", default=None, help="where to write the archive (default data/archive under the repo)")
    ap.add_argument("--allow-drift", action="store_true",
                    help="write even where a driver's scoring inputs differ from the seed's (the drift is listed)")
    a = ap.parse_args()
    if not os.environ.get("PRISM_DB_PATH"):
        os.environ["PRISM_DB_PATH"] = os.path.join(REPO, "data", "prism.db")
    sys.exit(main(dry_run=a.dry_run, allow_postgres=a.postgres, archive_dir=a.archive_dir, allow_drift=a.allow_drift))
