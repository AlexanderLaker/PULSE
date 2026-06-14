"""SQLite backup & restore utility for the local PRISM database (F2).

The local PRISM database is the system of record for trends, scores,
simulation runs, audit log entries, and config snapshots.
A corrupt or accidentally-deleted file in `data/prism.db` is therefore a
serious incident — months of expert scoring can vanish.

This module provides:

  - `backup_database(...)`: take a consistent online backup using
    sqlite3's native `Connection.backup()` API. This works while the
    database is open and in use; no need to stop the server.
  - `restore_database(...)`: replace the live database with a previous
    backup, after first backing up the current state to a safety file
    (so a botched restore can itself be undone).
  - `list_backups(...)`: enumerate available backups by timestamp.
  - `prune_backups(...)`: keep the N most recent backups, delete older ones.

CLI:
    python -m pulse.backup create
    python -m pulse.backup list
    python -m pulse.backup restore <backup_filename>
    python -m pulse.backup prune --keep 30

The Postgres deployment (Vercel) is not in scope here — Postgres has
its own backup story (managed snapshots, pg_dump, etc.). This utility
only operates on the local SQLite file used by single-user installs
and the development environment.
"""

from __future__ import annotations

import argparse
import logging
import os
import shutil
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)


# ── Paths ─────────────────────────────────────────────────────────────

def _resolve_db_path() -> Path:
    """Resolve the live SQLite database path the same way pulse.database does."""
    is_vercel = bool(os.environ.get("VERCEL"))
    default = "/tmp/prism.db" if is_vercel else "data/prism.db"
    db_path = os.environ.get("PRISM_DB_PATH", default)
    return Path(db_path).resolve()


def _resolve_backup_dir() -> Path:
    """Resolve the directory backups live in. Override via PRISM_BACKUP_DIR."""
    default = "data/backups"
    backup_dir = os.environ.get("PRISM_BACKUP_DIR", default)
    p = Path(backup_dir).resolve()
    p.mkdir(parents=True, exist_ok=True)
    return p


# ── Operations ────────────────────────────────────────────────────────

def backup_database(
    db_path: Optional[Path] = None,
    backup_dir: Optional[Path] = None,
    label: str = "",
) -> Path:
    """Take a consistent online backup of the live SQLite database.

    Uses sqlite3.Connection.backup(), which holds a read lock on the
    source while it streams pages to the destination — safe to run
    while the API server is up.

    Args:
        db_path: source DB (defaults to the resolved live DB)
        backup_dir: destination directory (defaults to PRISM_BACKUP_DIR)
        label: optional human label appended to the filename

    Returns:
        Path to the new backup file.
    """
    src = db_path or _resolve_db_path()
    if not src.exists():
        raise FileNotFoundError(
            f"Source database does not exist: {src}. Nothing to back up."
        )

    dest_dir = backup_dir or _resolve_backup_dir()
    timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    safe_label = "".join(c if c.isalnum() or c in "-_" else "_" for c in label)
    suffix = f"_{safe_label}" if safe_label else ""
    dest = dest_dir / f"prism_{timestamp}{suffix}.db"

    src_conn = sqlite3.connect(str(src))
    try:
        dst_conn = sqlite3.connect(str(dest))
        try:
            with dst_conn:
                src_conn.backup(dst_conn)
        finally:
            dst_conn.close()
    finally:
        src_conn.close()

    size_kb = dest.stat().st_size / 1024
    logger.info(f"Database backup written: {dest} ({size_kb:.1f} KB)")
    return dest


def list_backups(backup_dir: Optional[Path] = None) -> List[Path]:
    """Return all backup files in the backup directory, newest first."""
    d = backup_dir or _resolve_backup_dir()
    files = sorted(d.glob("prism_*.db"), key=lambda p: p.stat().st_mtime, reverse=True)
    return files


def restore_database(
    backup_file: Path,
    db_path: Optional[Path] = None,
    safety_label: str = "pre_restore",
) -> Path:
    """Replace the live DB with a backup, after taking a safety snapshot.

    The safety snapshot is critical: a restore that turns out to be
    the wrong file should itself be undoable.

    Args:
        backup_file: the backup to restore from
        db_path: target live DB path (defaults to resolved live DB)
        safety_label: label for the pre-restore safety backup

    Returns:
        Path to the safety backup, so the caller can roll back if needed.
    """
    backup_file = Path(backup_file).resolve()
    if not backup_file.exists():
        raise FileNotFoundError(f"Backup file does not exist: {backup_file}")

    target = (db_path or _resolve_db_path()).resolve()

    # Take a safety snapshot of the current live DB *before* overwriting
    safety_path: Optional[Path] = None
    if target.exists():
        safety_path = backup_database(db_path=target, label=safety_label)
        logger.info(f"Pre-restore safety backup: {safety_path}")
    else:
        target.parent.mkdir(parents=True, exist_ok=True)

    # Stream the backup into a fresh DB at the target path so we don't
    # corrupt the file if a writer is currently holding it open
    tmp_target = target.with_suffix(target.suffix + ".restoring")
    if tmp_target.exists():
        tmp_target.unlink()

    src_conn = sqlite3.connect(str(backup_file))
    try:
        dst_conn = sqlite3.connect(str(tmp_target))
        try:
            with dst_conn:
                src_conn.backup(dst_conn)
        finally:
            dst_conn.close()
    finally:
        src_conn.close()

    # Atomic-ish replace
    shutil.move(str(tmp_target), str(target))
    logger.info(f"Database restored from {backup_file} → {target}")
    return safety_path or target


def prune_backups(
    keep: int = 30,
    backup_dir: Optional[Path] = None,
) -> List[Path]:
    """Delete all but the `keep` most recent backups.

    Returns the list of files that were deleted.
    """
    if keep < 1:
        raise ValueError("keep must be >= 1")

    files = list_backups(backup_dir)
    to_delete = files[keep:]
    for f in to_delete:
        try:
            f.unlink()
            logger.info(f"Pruned old backup: {f.name}")
        except OSError as e:
            logger.warning(f"Could not delete {f}: {e}")
    return to_delete


# ── CLI ──────────────────────────────────────────────────────────────

def _main(argv: Optional[List[str]] = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    parser = argparse.ArgumentParser(
        prog="python -m pulse.backup",
        description="SQLite backup & restore for the local PRISM database.",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_create = sub.add_parser("create", help="Take a backup of the live DB")
    p_create.add_argument("--label", default="", help="Optional label appended to filename")

    sub.add_parser("list", help="List existing backups")

    p_restore = sub.add_parser("restore", help="Restore the live DB from a backup")
    p_restore.add_argument("backup", help="Backup filename or absolute path")

    p_prune = sub.add_parser("prune", help="Delete old backups, keep N newest")
    p_prune.add_argument("--keep", type=int, default=30)

    args = parser.parse_args(argv)

    if args.cmd == "create":
        path = backup_database(label=args.label)
        print(f"Backup created: {path}")
        return 0

    if args.cmd == "list":
        files = list_backups()
        if not files:
            print("(no backups found)")
            return 0
        for f in files:
            mtime = datetime.fromtimestamp(f.stat().st_mtime).isoformat(timespec="seconds")
            size_kb = f.stat().st_size / 1024
            print(f"  {mtime}  {size_kb:8.1f} KB  {f.name}")
        return 0

    if args.cmd == "restore":
        backup_arg = Path(args.backup)
        if not backup_arg.is_absolute():
            backup_arg = _resolve_backup_dir() / backup_arg
        safety = restore_database(backup_arg)
        print(f"Restored. Pre-restore snapshot kept at: {safety}")
        return 0

    if args.cmd == "prune":
        deleted = prune_backups(keep=args.keep)
        print(f"Pruned {len(deleted)} old backup(s).")
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(_main())
