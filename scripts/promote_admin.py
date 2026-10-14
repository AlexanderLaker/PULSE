"""Give a user the admin role (or take it away) directly in the database.

Roles live in the user_roles table (lib/roles.ts). A user who signs up has no
row: they are pending until an admin approves them in Settings (User
management), which adds it. This script changes the role of a user who has a
row and needs nothing but database access. The first admin of a new database
comes from the in-app route /api/admin/bootstrap instead (docs/OPERATIONS.md).

    python3 scripts/promote_admin.py someone@example.com
    python3 scripts/promote_admin.py someone@example.com --role viewer

The database is POSTGRES_URL or DATABASE_URL from the environment or .env,
or --dsn. The change is written to the audit log when the database has one
(the API creates it on first use); without it the change stands and
the script says it was not logged.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import prism.env_loader  # noqa: F401  (loads .env)
from prism.database import describe_error, postgres_connect_options

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    sys.exit("psycopg2 is not installed: pip install -r requirements-dev.txt")


def main(argv: list | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("email", help="the user's sign-in email")
    parser.add_argument("--role", choices=("admin", "viewer"), default="admin", help="the new role (default admin)")
    parser.add_argument("--dsn", default=None, help="database URL (default: POSTGRES_URL or DATABASE_URL)")
    args = parser.parse_args(argv)

    dsn = args.dsn or os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL")
    if not dsn:
        print("No database URL: set POSTGRES_URL in .env or pass --dsn.", file=sys.stderr)
        return 2
    email = args.email.strip().lower()
    print(f"Database: {urlparse(dsn).hostname}")

    # TLS and a connection timeout, as for the API, unless the URL sets them
    # (prism.database.postgres_connect_options).
    # A failed connection is reported by its category: the driver's own message
    # can quote part of the URL, password included.
    try:
        conn = psycopg2.connect(dsn, **postgres_connect_options(dsn))
    except psycopg2.Error as e:
        print(f"Cannot connect: {describe_error(e)}", file=sys.stderr)
        return 1
    try:
        return _set_role(conn, email, args.role)
    finally:
        conn.close()


def _set_role(conn, email: str, role: str) -> int:
    """Change the role in one transaction; the exit code of main()."""
    with conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT to_regclass('user_roles') IS NOT NULL AS present")
        if not cur.fetchone()["present"]:
            print("There is no user_roles table yet: sign in to the dashboard once, then retry.", file=sys.stderr)
            return 3
        cur.execute("SELECT clerk_user_id, role FROM user_roles WHERE lower(email) = %s LIMIT 1", (email,))
        row = cur.fetchone()
        if row is None:
            print(f"No user with the email {email} has a role: a user who signs up is pending until an admin "
                  "approves them in Settings (User management), and the first admin of a new database comes "
                  "from /api/admin/bootstrap (docs/OPERATIONS.md).", file=sys.stderr)
            return 3
        if row["role"] == role:
            print(f"{email} is already {role}; nothing changed.")
            return 0
        cur.execute("UPDATE user_roles SET role = %s, updated_at = NOW() WHERE clerk_user_id = %s",
                    (role, row["clerk_user_id"]))
        # The audit log is the API's table: a database the API has not used
        # yet has none, and the role change stands without the entry.
        cur.execute("SELECT to_regclass('audit_log') IS NOT NULL AS present")
        audited = cur.fetchone()["present"]
        if audited:
            cur.execute("INSERT INTO audit_log (action, entity_type, entity_id, old_value, new_value, reason, user_id) "
                        "VALUES ('role_change', 'user', %s, %s, %s, %s, 'promote-admin-cli')",
                        (row["clerk_user_id"], row["role"], role, "via scripts/promote_admin.py"))
    print(f"{email}: {row['role']} -> {role}" + ("" if audited else " (no audit log yet, so not logged)"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
