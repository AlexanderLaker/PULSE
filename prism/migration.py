"""What the migrations under migrations/ share: the connection they run on and
the archive they write before a commit.

A migration opens the configured database itself rather than through
prism.database, whose backend is fixed when it is imported, so that one
process can migrate a SQLite file named on the command line while .env names
a PostgreSQL database.
"""
from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from prism.database import postgres_connect_options, sqlite_path


class Database:
    """The connection and the few dialect differences a migration needs.

    The target is the SQLite file given, else POSTGRES_URL or DATABASE_URL
    (from the shell or .env), else the local SQLite file (PRISM_DB_PATH or
    data/prism.db).
    """

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
            path = Path(sqlite_file) if sqlite_file else sqlite_path()
            if not path.exists():
                raise FileNotFoundError(f"no SQLite database at {path}")
            self.conn = sqlite3.connect(str(path), isolation_level=None)
            self.conn.row_factory = sqlite3.Row
            # Foreign keys are checked once, at the end (foreign_key_check), rather
            # than per statement, which a rebuild of a table needs.
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

    def has_run(self, migration: str) -> bool:
        """Whether schema_migrations records this migration."""
        return "schema_migrations" in self.tables() and bool(self.rows(
            f"SELECT 1 AS x FROM schema_migrations WHERE version = {self.p}", (migration,)))


def write_archive(directory: Path, label: str, archive: dict) -> Path:
    """Write a migration's archive as a new file readable by the owner only; returns its path.

    The archive is written before the commit, so a failure here leaves the
    database unchanged.
    """
    directory.mkdir(mode=0o700, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")
    path = directory / f"{label}-{stamp}.json"
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(json.dumps(archive, indent=1, default=str))
    return path
