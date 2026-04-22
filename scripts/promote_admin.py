#!/usr/bin/env python3
"""
promote_admin.py — promote a user to admin by email.

Bypasses the app entirely and talks directly to Neon. Use this from a
machine with outbound DNS to Neon (a laptop, a dev container with
network access) when the Vercel bootstrap endpoint isn't available
(e.g. secret not set yet) or when you just want a clean local record
of the change.

Usage:
    # Uses POSTGRES_URL from .env (auto-loaded) or from the environment.
    python3 scripts/promote_admin.py laker.alexander@gmail.com

    # Demote instead:
    python3 scripts/promote_admin.py laker.alexander@gmail.com --role viewer

Requires: psycopg2-binary (or psycopg2). Install with:
    pip install psycopg2-binary
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    sys.stderr.write(
        "ERROR: psycopg2 is not installed.\n"
        "       pip install psycopg2-binary\n"
    )
    sys.exit(1)


def load_env_file(path: Path) -> None:
    """Minimal .env loader. Only sets vars that aren't already in os.environ."""
    if not path.exists():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("email", help="User email to promote")
    parser.add_argument(
        "--role",
        choices=("admin", "viewer"),
        default="admin",
        help="Target role (default: admin)",
    )
    parser.add_argument(
        "--dsn",
        default=None,
        help="Postgres DSN (defaults to $POSTGRES_URL / .env)",
    )
    args = parser.parse_args()

    # Load .env from repo root so POSTGRES_URL is available.
    repo_root = Path(__file__).resolve().parent.parent
    load_env_file(repo_root / ".env")

    dsn = args.dsn or os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL")
    if not dsn:
        sys.stderr.write(
            "ERROR: no DSN — set POSTGRES_URL in .env or pass --dsn.\n"
        )
        return 2

    email = args.email.strip().lower()

    with psycopg2.connect(dsn) as conn:
        conn.autocommit = False
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Create table if it doesn't exist (matches lib/roles.ts).
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS user_roles (
                    clerk_user_id TEXT PRIMARY KEY,
                    email         TEXT NOT NULL,
                    role          TEXT NOT NULL DEFAULT 'viewer'
                                  CHECK (role IN ('admin', 'viewer')),
                    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
                )
                """
            )

            cur.execute(
                """
                SELECT clerk_user_id, role
                  FROM user_roles
                 WHERE lower(email) = %s
                 LIMIT 1
                """,
                (email,),
            )
            row = cur.fetchone()
            if not row:
                sys.stderr.write(
                    f"No user with email {email} in user_roles.\n"
                    "Has this user actually signed into the Vercel app yet?\n"
                )
                return 3

            clerk_user_id = row["clerk_user_id"]
            previous = row["role"]

            if previous == args.role:
                print(f"No-op: {email} ({clerk_user_id}) is already {args.role}")
                return 0

            cur.execute(
                """
                UPDATE user_roles
                   SET role = %s, updated_at = NOW()
                 WHERE clerk_user_id = %s
                """,
                (args.role, clerk_user_id),
            )

            try:
                cur.execute(
                    """
                    INSERT INTO audit_log
                        (action, entity_type, entity_id, old_value, new_value, reason, user_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        "role_change",
                        "user",
                        clerk_user_id,
                        previous,
                        args.role,
                        "via scripts/promote_admin.py",
                        "bootstrap-cli",
                    ),
                )
            except psycopg2.Error as exc:
                sys.stderr.write(f"Warning: audit log write failed: {exc}\n")

        conn.commit()

    print(
        f"Updated {email} ({clerk_user_id}): {previous} -> {args.role}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
