#!/usr/bin/env python3
"""
Carry the Driver vocabulary (owner ruling O15, 2026-09-16) into a database's
authored content. Archive-first, idempotent, one run per database, by the owner.

    python3 scripts/apply_driver_vocabulary.py --dry-run     # report only, no writes
    python3 scripts/apply_driver_vocabulary.py               # local SQLite
    python3 scripts/apply_driver_vocabulary.py --postgres    # REQUIRED to touch Neon

Why a script: the interface copy ships with the code, but two kinds of
authored text live in the database and would otherwise keep saying "trend"
where they mean a modelled driver:

  1. the Consumer Journey server copy (the latest `journey_content` row takes
     precedence over data/consumerJourney.ts): the 26 phrases of
     JOURNEY_EDITS (30 places in the seed). Most are the "... trend left the
     model in the September 2026 review" line of the 2026-09-10 re-basing;
     two reword text that would now read as the product term ("a profit-pool
     driver", "an expansion trend");
  2. four driver texts from the September review (DRIVER_EDITS: C-03, C-27,
     C-35, G-15).

What it does, in order, and nothing else:
  1. Refuses to run against Postgres without --postgres (the same near-miss
     guard as scripts/replace_trend_base.py), and refuses --postgres when the
     connection is not Postgres (no POSTGRES_URL / DATABASE_URL, or psycopg2
     missing, which silently falls back to SQLite). A dry run never writes
     and never creates a database file.
  2. Reads the latest journey_content row (id and content in one query) and
     the four driver texts, and prints how many phrases will change, how many
     have already changed, and each phrase it cannot find (an admin may have
     reworded it: reported, never forced). Each phrase is exact, so nothing
     outside the listed sentences can change, and admin edits made since the
     last content write survive. It also lists every place where the word
     "trend" is still left in the server copy, for review.
  3. Archives the current values to
     data/archive/driver_vocabulary_<mode>_<stamp>.json and reads the archive
     back before anything is written.
  4. Writes in ONE transaction: the edited journey blob as a new
     journey_content row (append-only store; earlier rows stay for rollback),
     an UPDATE of only the `description` / `strategic_implication` column of
     the drivers concerned, and the audit-log entry. Both content writes are
     compare-and-swap: if the latest journey row or a driver text changed
     after it was read, everything is rolled back. The journey table is
     locked while the write runs (SHARE ROW EXCLUSIVE on Postgres, BEGIN
     IMMEDIATE on SQLite), so an admin save cannot land between the check and
     the insert; it waits and lands after. No score, exposure, source,
     provenance flag or expert proposal is touched, so the next production
     run reports no input drift.
  5. Re-reads both and verifies that no applied old phrase is left and every
     new phrase is present.

Exit codes: 0 done, or nothing to change · 2 cannot read the tables, or no
database file · 3 archive failed (nothing changed) · 4 Postgres without
--postgres, or --postgres on a connection that is not Postgres ·
5 problems after the write: the database no longer shows all of the change,
or the commit did not confirm (run --dry-run to see; running the script again
is safe) · 6 write failed, lock timeout, or the content changed while the
script ran (rolled back, nothing changed; re-run).

On a machine whose .env names the Neon database, blank the URLs to work on the
local SQLite copy: DATABASE_URL= POSTGRES_URL= python3 scripts/apply_driver_vocabulary.py

Run it right before the production deploy that ships O15, and run --dry-run
once more after the deploy. Old text can come back in two ways: until the
deploy replaces them, warm API instances keep serving the old driver texts and
write them back when an admin next saves one of those drivers; and a Drivers or
Consumer Journey page opened before the deploy keeps the old text in the
browser and saves it back with its next edit, even after the deploy. So after
the deploy, ask admins to reload any open PRISM page before they edit. The
second dry run shows anything saved up to then: expect 0 phrases to change and
"done" for the four driver texts; if it reports anything to change, run the
script again.
"""
from __future__ import annotations

import argparse
import datetime
import json
import os
import re
import sys
from urllib.parse import urlsplit

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, REPO)
import pulse.env_loader  # noqa: F401,E402  (loads .env; shell wins, M17)
from pulse.database import (  # noqa: E402
    POSTGRES_URL, USE_POSTGRES, get_db_connection, placeholder, ph,
    _get_sqlite_path, _row_to_dict, _safe_dumps,
)

UPDATED_BY = "scripts/apply_driver_vocabulary.py (O15)"
WORD = re.compile(r"\btrends?\b", re.I)

#: (old phrase, new phrase). Exact, case-sensitive substrings of the
#: Strategist Reads and driver notes. data/consumerJourney.ts carries the new
#: phrases since 2026-09-16; tests/test_driver_vocabulary.py locks the seed to
#: this table so the bundled seed and the server copy cannot drift apart.
#: Deliberately NOT listed: "trend" in its ordinary sense (a premiumisation
#: trend, TikTok-native trend content, trend velocity, speed-to-trend) and the
#: foresight tiers (Megatrend, Macrotrend, Mesotrend, Microtrend).
JOURNEY_EDITS: list[tuple[str, str]] = [
    ("The cleaning-fluency trend left the model", "The cleaning-fluency driver left the model"),
    ("the DB split this trend out from generic premiumisation", "the DB split this driver out from generic premiumisation"),
    ("The trend itself remains the model's largest distribution threat", "T-11 itself remains the model's largest distribution threat"),
    ("The neuro-scent trend left the model", "The neuro-scent driver left the model"),
    ("the conscious-consumption trend behind that read left the model", "the conscious-consumption driver behind that read left the model"),
    ("the water-scarcity trend (E-02) that carried that read left the model", "the water-scarcity driver (E-02) that carried that read left the model"),
    ("The energy-efficiency trend (E-02) that the tile also cited left the model", "The energy-efficiency driver (E-02) that the tile also cited left the model"),
    ("The water-scarcity trend (E-02) cited for reduced softener demand", "The water-scarcity driver (E-02) cited for reduced softener demand"),
    ("the water-scarcity trend (E-02) behind it left the model", "the water-scarcity driver (E-02) behind it left the model"),
    ("The conscious-consumption trend the tile also cited left the model", "The conscious-consumption driver the tile also cited left the model"),
    ("The energy-efficiency trend (E-02) that carried the standards escalation", "The energy-efficiency driver (E-02) that carried the standards escalation"),
    ("Both cited trends left the model in the September 2026 review",
     "Since the September 2026 review neither cited driver carries this tile"),
    ("even though the conscious-consumption trend left the model", "even though the conscious-consumption driver left the model"),
    # T-08 is still a live driver (narrowed to OEM auto-dosing): what left is its
    # connected-appliance part, so these must not say that a driver left.
    ("the connected-appliance trend once cited here left the model",
     "the connected-appliance part of T-08 that this tile cited left the model"),
    ("the connected-appliance trend once cited for steamers left the model",
     "the connected-appliance part of T-08 once cited for steamers left the model"),
    ("that trend (E-05) left the model", "that driver (E-05) left the model"),
    ("the between-wash styling trend left the model", "the between-wash styling driver left the model"),
    ("The trend itself left the model in the September 2026 review (watch list); this is the strategist's read, not a modelled driver.",
     "The Gen Alpha driver left the model in the September 2026 review (watch list), so no modelled driver stands behind this read."),
    ("C-10 hair-thinning demand medicalises (core trend)", "C-10 hair-thinning demand medicalises (core driver)"),
    ("C-03 hair-care premiumisation (colour, core trend)", "C-03 hair-care premiumisation (colour, core driver)"),
    ("single-use gimmick formats (strategist's read; the trend left the model",
     "single-use gimmick formats (strategist's read; the conscious-consumption driver left the model"),
    ("rather than a modelled driver (the conscious-consumption trend left the model", "rather than a modelled driver (it left the model"),
    ("as the climate-driven pest trend left the model", "as E-05 (climate-driven pest shifts) left the model"),
    ("the trend left the model in the September 2026 review as immaterial",
     "the driver behind it (C-15) left the model in the September 2026 review as immaterial"),
    # Not "trend" but a wording that would now read as the product term.
    ("a silent pool contraction masquerading as an expansion trend.", "a silent pool contraction masquerading as growth."),
    ("makes dermatological credibility a profit-pool driver", "makes dermatological credibility a profit-pool lever"),
]

#: (driver id, column, old phrase, new phrase). The same four edits turn
#: data/trend_base_2026-09/core_set_51_v4.json into core_set_51_v5.json.
DRIVER_EDITS: list[tuple[str, str, str, str]] = [
    ("consumer_r03", "description",
     "so the trend is both a direct tailwind and an integration exposure",
     "so premiumisation is both a direct tailwind and an integration exposure"),
    ("consumer_r27", "strategic_implication",
     "(the trend is modelled as expansion,", "(the driver is modelled as expansion,"),
    ("consumer_r35", "description",
     "as PRISM's one-sided trend grammar requires", "as PRISM's one-sided driver grammar requires"),
    ("government_r15", "description",
     "The old base modelled North America only through channel trends.",
     "The old base modelled North America only through channel drivers."),
]
_DRIVER_COLUMNS = ("description", "strategic_implication")


class _Conflict(RuntimeError):
    """The database changed between the read and the write."""


class _CommitUnconfirmed(RuntimeError):
    """The commit raised: the transaction may or may not have been applied."""


def _describe(e: BaseException) -> str:
    """'Type: message' on one line (psycopg2 messages end in a newline)."""
    return f"{type(e).__name__}: {' '.join(str(e).split())}"


def _utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def _replace_in_strings(node, old: str, new: str) -> tuple[object, int]:
    """Replace `old` by `new` in every string value of a JSON-like tree.
    Returns the new tree and the number of replacements (keys are left alone)."""
    if isinstance(node, str):
        n = node.count(old)
        return (node.replace(old, new), n) if n else (node, 0)
    if isinstance(node, list):
        out, total = [], 0
        for item in node:
            v, n = _replace_in_strings(item, old, new)
            out.append(v)
            total += n
        return out, total
    if isinstance(node, dict):
        out, total = {}, 0
        for k, item in node.items():
            v, n = _replace_in_strings(item, old, new)
            out[k] = v
            total += n
        return out, total
    return node, 0


def _count_in_strings(node, phrase: str) -> int:
    return _replace_in_strings(node, phrase, phrase)[1]


def remaining_mentions(journey) -> list[str]:
    """Every place where the word trend is still left in a journey blob, as
    'tile name / field: ...snippet...' (or the JSON path outside a tile). Ids
    are identifiers and are skipped. Informational only: most mentions are
    ordinary English and stay."""
    found: list[str] = []

    def walk(node, path: str, tile: str | None) -> None:
        if isinstance(node, dict):
            name = node.get("name") if isinstance(node.get("name"), str) else None
            for k, v in node.items():
                if k != "id":
                    walk(v, f"{path}.{k}" if path else str(k), name or tile)
        elif isinstance(node, list):
            for i, v in enumerate(node):
                walk(v, f"{path}[{i}]", tile)
        elif isinstance(node, str):
            where = f"{tile} / {path.rsplit('.', 1)[-1]}" if tile else path
            for m in WORD.finditer(node):
                snippet = node[max(0, m.start() - 45): m.end() + 30].replace("\n", " ")
                found.append(f"{where}: ...{snippet}...")

    walk(journey, "", None)
    return found


def _latest_journey_id(cur) -> int | None:
    cur.execute("SELECT id FROM journey_content ORDER BY id DESC LIMIT 1")
    row = cur.fetchone()
    return _row_to_dict(row)["id"] if row else None


def _read_state() -> tuple[int | None, dict | None, dict]:
    """(latest journey row id, its content or None, the four driver texts).
    The id and the content come from ONE query, so the compare-and-swap in
    _write compares against the row whose content was actually read."""
    p = placeholder()
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, content FROM journey_content ORDER BY id DESC LIMIT 1")
        row = cur.fetchone()
        journey_id, journey = None, None
        if row:
            r = _row_to_dict(row)
            journey_id, content = r["id"], r.get("content")
            if content is not None:  # same reading as pulse.database.load_journey_content
                journey = json.loads(content) if isinstance(content, str) else content
        texts = {}
        for tid in sorted({d[0] for d in DRIVER_EDITS}):
            cur.execute(f"SELECT id, description, strategic_implication FROM trends WHERE id = {p}", (tid,))
            found = cur.fetchone()
            texts[tid] = _row_to_dict(found) if found else None
    return journey_id, journey, texts


def plan(journey: dict | None, drivers: dict) -> dict:
    """Pure: what a run would change. Status per item: 'apply' (old phrase
    found), 'done' (only the new phrase found), 'missing' (neither), and for
    drivers 'no-such-driver'."""
    j_items = []
    if journey is not None:
        for old, new in JOURNEY_EDITS:
            n_old = _count_in_strings(journey, old)
            status = "apply" if n_old else ("done" if _count_in_strings(journey, new) else "missing")
            j_items.append({"old": old, "new": new, "count": n_old, "status": status})
    d_items = []
    for tid, col, old, new in DRIVER_EDITS:
        row = drivers.get(tid)
        text = (row or {}).get(col) or ""
        if row is None:
            status = "no-such-driver"
        elif old in text:
            status = "apply"
        elif new in text:
            status = "done"
        else:
            status = "missing"
        d_items.append({"id": tid, "column": col, "old": old, "new": new, "status": status})
    return {"journey": j_items, "drivers": d_items}


def _print_plan(p: dict, journey: dict | None) -> None:
    if journey is None:
        print("journey_content: no server copy in this database; the bundled seed "
              "(data/consumerJourney.ts) already carries the new wording")
    else:
        by = {s: [i for i in p["journey"] if i["status"] == s] for s in ("apply", "done", "missing")}
        print(f"journey_content: {len(by['apply'])} phrase(s) to change "
              f"({sum(i['count'] for i in by['apply'])} occurrence(s)), {len(by['done'])} already changed, "
              f"{len(by['missing'])} not found")
        for i in by["missing"]:
            print(f"  not found (reworded by an admin?): {i['old']!r}")
    for i in p["drivers"]:
        print(f"driver {i['id']}.{i['column']}: {i['status']}")


def _target() -> str:
    """The database this run works on, without credentials: the SQLite file, or
    the Postgres host and database name, so a staging and a production run (and
    their archives) can be told apart."""
    if not USE_POSTGRES:
        return f"sqlite ({_get_sqlite_path()})"
    url = POSTGRES_URL or ""
    try:
        if "://" in url:
            parts = urlsplit(url)
            where = f"{parts.hostname or '?'}{parts.path or ''}"
        else:  # key=value connection string
            kv = dict(item.split("=", 1) for item in url.split() if "=" in item)
            where = f"{kv.get('host', '?')}/{kv.get('dbname', '?')}"
    except ValueError:
        where = "?"
    return f"postgres ({where})"


def _refusal(dry_run: bool, allow_postgres: bool) -> str | None:
    """Why this run must not start, or None. Checked before anything is read."""
    if USE_POSTGRES and not allow_postgres and not dry_run:
        return ("this connection resolves to Postgres. If you really mean the "
                "production database, re-run with --postgres. To work on the local SQLite "
                "copy instead, blank the URLs: DATABASE_URL= POSTGRES_URL= python3 "
                "scripts/apply_driver_vocabulary.py")
    if allow_postgres and not USE_POSTGRES:
        why = ("POSTGRES_URL / DATABASE_URL is set, but psycopg2 is not installed, so the "
               "connection fell back to SQLite (pip install -r requirements-dev.txt)"
               if (os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL"))
               else "neither POSTGRES_URL nor DATABASE_URL is set")
        return f"--postgres was given, but this connection is not Postgres: {why}. Nothing was read or written."
    return None


def _begin_write(conn, cur, lock_journey: bool) -> None:
    """Open the write transaction with the locks the compare-and-swap needs."""
    if USE_POSTGRES:
        cur.execute("SET LOCAL lock_timeout = '15s'")  # a stuck lock aborts (exit 6) instead of hanging
        if lock_journey:
            # Conflicts with the ROW EXCLUSIVE lock every INSERT takes, not with
            # readers: an admin save waits until this transaction ends.
            cur.execute("LOCK TABLE journey_content IN SHARE ROW EXCLUSIVE MODE")
    else:
        # SQLite: take the database write lock before the first read, so no
        # other connection can commit between the check and the insert.
        conn.execute("BEGIN IMMEDIATE")


def _write(journey: dict | None, journey_id: int | None, j_apply: list, drivers: dict, d_apply: list,
           audit: tuple) -> None:
    """One transaction, compare-and-swap on everything that was read, the
    audit-log entry included: it is committed with the change or not at all."""
    p = placeholder()
    committing, commit_error = False, None
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            try:
                _write_statements(conn, cur, p, journey, journey_id, j_apply, drivers, d_apply, audit)
            except Exception:
                conn.rollback()
                raise
            committing = True
            try:
                conn.commit()
            except Exception as e:
                commit_error = e  # the connection's cleanup may fail next and hide this one
                raise
    except Exception as e:
        if committing:  # the server may have applied the transaction before the error
            cause = commit_error or e
            raise _CommitUnconfirmed(_describe(cause)) from cause
        raise


def _write_statements(conn, cur, p: str, journey: dict | None, journey_id: int | None, j_apply: list,
                      drivers: dict, d_apply: list, audit: tuple) -> None:
    """Everything _write executes before the commit, in order."""
    _begin_write(conn, cur, lock_journey=bool(j_apply))
    if j_apply:
        if _latest_journey_id(cur) != journey_id:
            raise _Conflict("a new journey_content row was written after the read")
        blob = journey
        for i in j_apply:
            blob, _ = _replace_in_strings(blob, i["old"], i["new"])
        cur.execute(
            f"INSERT INTO journey_content (content, updated_by) VALUES ({ph(2)})",
            (_safe_dumps(blob), UPDATED_BY),
        )
    for i in d_apply:
        col = i["column"]
        assert col in _DRIVER_COLUMNS  # column names are code constants, never input
        current = drivers[i["id"]][col]
        cur.execute(
            f"UPDATE trends SET {col} = {p}, updated_at = CURRENT_TIMESTAMP "
            f"WHERE id = {p} AND {col} = {p}",
            (current.replace(i["old"], i["new"]), i["id"], current),
        )
        if cur.rowcount != 1:
            raise _Conflict(f"driver {i['id']}.{col} changed after the read")
    # same row as pulse.database.log_audit, inside this transaction
    cur.execute(
        "INSERT INTO audit_log (action, entity_type, entity_id, old_value, new_value, reason, user_id) "
        f"VALUES ({ph(7)})",
        audit,
    )


def main(dry_run: bool, allow_postgres: bool, archive_dir: str | None = None) -> int:
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
        journey_id, journey, drivers = _read_state()
    except Exception as e:
        print(f"ABORT: cannot read journey_content / trends ({_describe(e)})")
        return 2

    p = plan(journey, drivers)
    _print_plan(p, journey)
    j_apply = [i for i in p["journey"] if i["status"] == "apply"]
    d_apply = [i for i in p["drivers"] if i["status"] == "apply"]
    unresolved = [i for i in p["journey"] + p["drivers"] if i["status"] in ("missing", "no-such-driver")]

    def _report_remaining(blob):
        left = remaining_mentions(blob)
        if left:
            print(f"'trend' still in the server copy, {len(left)} place(s) "
                  "(ordinary English stays; review anything else):")
            for line in left:
                print("  " + line)

    if dry_run:
        if j_apply:
            preview = journey
            for i in j_apply:
                preview, _ = _replace_in_strings(preview, i["old"], i["new"])
            _report_remaining(preview)
        else:
            _report_remaining(journey)
        print("dry-run complete: nothing written.")
        return 0
    if not j_apply and not d_apply:
        if unresolved:
            print(f"nothing written: no listed phrase is left to change; {len(unresolved)} item(s) "
                  "were not found (see above) and need a look by hand.")
        else:
            print("nothing to change: this database already carries the Driver vocabulary.")
        _report_remaining(journey)
        return 0

    # 3. archive first (data/archive/ is git-ignored; --archive-dir overrides)
    archive_dir = archive_dir or os.path.join(REPO, "data", "archive")
    try:
        os.makedirs(archive_dir, exist_ok=True)
        archive_path = os.path.join(archive_dir, f"driver_vocabulary_{mode}_{stamp}.json")
        payload = {
            "archived_at_utc": now.isoformat(), "mode": mode, "target": _target(), "ruling": "O15",
            "journey_content_latest": ({"id": journey_id, "content": journey} if journey is not None else None),
            "drivers": {i["id"]: drivers.get(i["id"]) for i in d_apply},
            "plan": p,
        }
        with open(archive_path, "x", encoding="utf-8") as fh:  # never overwrite an earlier archive
            json.dump(payload, fh, indent=1, default=str, ensure_ascii=False)
        with open(archive_path, encoding="utf-8") as fh:  # the archive must be loadable
            json.load(fh)
    except Exception as e:
        print(f"ABORT: archive failed ({_describe(e)}); nothing changed")
        return 3
    print(f"archived current values -> {archive_path}")

    # 4. write, all or nothing (the audit-log entry is part of the transaction)
    audit = (
        "driver_vocabulary_applied", "content", "O15",
        f"archive {os.path.basename(archive_path)}",
        f"journey phrases {len(j_apply)} ({sum(i['count'] for i in j_apply)} places), driver texts {len(d_apply)}",
        "Owner ruling O15 (2026-09-16): 'Profit Pool Drivers' replaces 'trends' in authored content",
        "owner-cli",
    )
    try:
        _write(journey, journey_id, j_apply, drivers, d_apply, audit)
    except _CommitUnconfirmed as e:
        print(f"PROBLEMS: the commit did not confirm ({e}), so the change may or may not be in the "
              "database. Run --dry-run to see; running the script again is safe either way.")
        return 5
    except Exception as e:
        if "permission denied" in str(e).lower():
            advice = ("The database role lacks a privilege the script needs: INSERT on journey_content and "
                      "audit_log, UPDATE on trends, and for the lock UPDATE, DELETE or TRUNCATE on "
                      "journey_content. Grant it (or run as a role that has it), then run the script again; "
                      "the archive above is informational.")
        else:
            advice = "Re-run the script; the archive above is informational."
        print(f"ABORT: the write was rolled back, nothing changed ({_describe(e)}). {advice}")
        return 6
    if j_apply:
        print(f"journey_content: new row written ({sum(i['count'] for i in j_apply)} occurrence(s) changed; "
              f"previous row {journey_id} kept for rollback)")
    if d_apply:
        print(f"drivers: {len(d_apply)} text column(s) updated")

    # 5. verify
    try:
        _id_after, journey_after, drivers_after = _read_state()
    except Exception as e:
        print(f"PROBLEMS: the change is committed, but it could not be read back ({_describe(e)}). "
              "Run --dry-run to see the current state.")
        return 5
    after = plan(journey_after, drivers_after)
    problems = []
    applied_j = {i["old"] for i in j_apply}
    for i in after["journey"]:
        if i["old"] in applied_j and i["status"] != "done":
            problems.append(f"journey phrase not applied: {i['old']!r} ({i['status']})")
    if j_apply and journey_after is None:
        problems.append("journey_content: the new row cannot be read back")
    applied_d = {(i["id"], i["column"]) for i in d_apply}
    for i in after["drivers"]:
        if (i["id"], i["column"]) in applied_d and i["status"] != "done":
            problems.append(f"driver text not applied: {i['id']}.{i['column']} ({i['status']})")
    if problems:
        print("PROBLEMS: the change is committed and audited, but the database no longer shows all of it "
              "(most likely a save landed right after it):")
        for line in problems:
            print("  - " + line)
        print("Run --dry-run to see the current state and run the script again if it reports anything to "
              "change. The archive above holds the values from before this run; restore from it only if this "
              "run's own change is what went wrong, because a restore would also undo any later save.")
        return 5
    _report_remaining(journey_after)
    if unresolved:
        print(f"note: {len(unresolved)} listed item(s) were not found (see above) and need a look by hand.")
    print("done.")
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--postgres", action="store_true", help="acknowledge that the target is the production database")
    ap.add_argument("--archive-dir", default=None, help="where to write the archive (default data/archive under the repo)")
    a = ap.parse_args()
    # A relative default would look for data/prism.db in whatever directory the
    # script is started from; anchor the SQLite fallback on the repository. An
    # empty PRISM_DB_PATH (as in .env.example) counts as unset. Set here, not
    # at import, so importing this module never changes the environment.
    if not os.environ.get("PRISM_DB_PATH"):
        os.environ["PRISM_DB_PATH"] = os.path.join(REPO, "data", "prism.db")
    sys.exit(main(dry_run=a.dry_run, allow_postgres=a.postgres, archive_dir=a.archive_dir))
