#!/usr/bin/env python3
"""Give a user the admin role (or take it away) directly in the database.

Roles live in the user_roles table that the dashboard creates when a user
first signs in (lib/roles.ts). The in-app route /api/admin/bootstrap does the
same job when ADMIN_BOOTSTRAP_SECRET is set; this script is the path that
needs nothing but database access.

    python3 scripts/promote_admin.py someone@example.com
    python3 scripts/promote_admin.py someone@example.com --role viewer

The database is POSTGRES_URL or DATABASE_URL from the environment or .env,
or --dsn. The change is written to the audit log.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import prism.env_loader  # noqa: E402,F401  (loads .env)

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    sys.exit("psycopg2 is not installed: pip install -r requirements-dev.txt")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("email", help="the user's sign-in email")
    parser.add_argument("--role", choices=("admin", "viewer"), default="admin", help="the new role (default admin)")
    parser.add_argument("--dsn", default=None, help="database URL (default: POSTGRES_URL or DATABASE_URL)")
    args = parser.parse_args()

    dsn = args.dsn or os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL")
    if not dsn:
        print("No database URL: set POSTGRES_URL in .env or pass --dsn.", file=sys.stderr)
        return 2
    email = args.email.strip().lower()

    with psycopg2.connect(dsn) as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT to_regclass('user_roles') IS NOT NULL AS present")
        if not cur.fetchone()["present"]:
            print("There is no user_roles table yet: sign in to the dashboard once, then retry.", file=sys.stderr)
            return 3
        cur.execute("SELECT clerk_user_id, role FROM user_roles WHERE lower(email) = %s LIMIT 1", (email,))
        row = cur.fetchone()
        if row is None:
            print(f"No user with the email {email}; the user has to sign in to the dashboard once first.",
                  file=sys.stderr)
            return 3
        if row["role"] == args.role:
            print(f"{email} is already {args.role}; nothing changed.")
            return 0
        cur.execute("UPDATE user_roles SET role = %s, updated_at = NOW() WHERE clerk_user_id = %s",
                    (args.role, row["clerk_user_id"]))
        cur.execute("INSERT INTO audit_log (action, entity_type, entity_id, old_value, new_value, reason, user_id) "
                    "VALUES ('role_change', 'user', %s, %s, %s, 'scripts/promote_admin.py', 'promote-admin-cli')",
                    (row["clerk_user_id"], row["role"], args.role))
    print(f"{email}: {row['role']} -> {args.role}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
