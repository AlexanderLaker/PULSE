"""Audit logger — tracks all changes for governance and reproducibility.

Uses the shared pulse.database module for Postgres/SQLite dual-mode persistence.
"""

import json
import logging
from contextlib import contextmanager
from datetime import datetime
from typing import Iterator, Optional

from pulse.database import get_db_connection, placeholder, ph, _row_to_dict, init_db

logger = logging.getLogger(__name__)


class AuditLogger:
    """Logs all model changes, AI decisions, and configuration updates."""

    def __init__(self):
        """Initialize audit logger. Tables are created by init_db()."""
        try:
            init_db()
        except Exception as e:
            logger.debug(f"AuditLogger init_db: {e}")

    @contextmanager
    def transaction(
        self,
        action: str,
        entity_type: str = "",
        entity_id: str = "",
        old_value: str = "",
        new_value: str = "",
        reason: str = "",
        user_id: str = "system",
    ) -> Iterator:
        """Atomically commit a domain write and its audit log entry.

        Yields a database cursor inside a single transaction. The caller
        executes their domain write(s) against the cursor; on successful
        exit, the audit_log row is inserted and both are committed
        together. On any exception, BOTH the domain change and the audit
        entry are rolled back.

        This eliminates the prior race where a domain write could succeed
        while the audit log silently failed (or vice versa), leaving the
        governance trail inconsistent with the actual database state.

        Example:
            with audit.transaction("score_change", "trend", trend_id,
                                   old_value=str(old), new_value=str(new),
                                   reason="Delphi round 2") as cur:
                cur.execute(
                    f"UPDATE trends SET probability = {ph(1)} WHERE id = {ph(1)}",
                    (new, trend_id),
                )
        """
        conn = None
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                try:
                    yield cursor
                    cursor.execute(
                        f"""INSERT INTO audit_log (action, entity_type, entity_id,
                            old_value, new_value, reason, user_id)
                            VALUES ({ph(7)})""",
                        (action, entity_type, entity_id,
                         old_value, new_value, reason, user_id),
                    )
                    conn.commit()
                except Exception:
                    try:
                        conn.rollback()
                    except Exception as rb_err:
                        logger.error(f"Audit transaction rollback failed: {rb_err}")
                    raise
        except Exception as e:
            logger.error(
                f"Audit transaction failed (action={action}, "
                f"entity={entity_type}/{entity_id}): {e}"
            )
            raise

    def log(self, action: str, entity_type: str = "", entity_id: str = "",
            old_value: str = "", new_value: str = "", reason: str = "",
            user_id: str = "system"):
        """Log an audit event."""
        p = placeholder()
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""INSERT INTO audit_log (action, entity_type, entity_id,
                        old_value, new_value, reason, user_id) VALUES ({ph(7)})""",
                    (action, entity_type, entity_id, old_value, new_value, reason, user_id)
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to write audit log: {e}")

    def log_score_change(self, trend_id: str, field: str,
                         old_val, new_val, reason: str = ""):
        self.log("score_change", "trend", trend_id,
                 str(old_val), str(new_val), reason)

    def log_trend_add(self, trend_id: str, trend_name: str, source: str = ""):
        self.log("trend_add", "trend", trend_id, "", trend_name, source)

    def log_trend_remove(self, trend_id: str, reason: str = ""):
        self.log("trend_remove", "trend", trend_id, reason=reason)

    def log_config_change(self, param: str, old_val, new_val, reason: str = ""):
        self.log("config_change", "config", param,
                 str(old_val), str(new_val), reason)

    def log_ai_suggestion(self, suggestion_id: str, action: str, details: str = ""):
        self.log(f"ai_{action}", "ai_suggestion", suggestion_id, new_value=details)

    def log_simulation_run(self, scenario: str, iterations: int, model_type: str):
        self.log("simulation_run", "simulation", scenario,
                 new_value=json.dumps({"iterations": iterations, "model": model_type}))

    def save_snapshot(self, config_json: str, label: str = ""):
        """Save a configuration snapshot for reproducibility."""
        p = placeholder()
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"INSERT INTO config_snapshots (config_json, label) VALUES ({ph(2)})",
                    (config_json, label)
                )
                conn.commit()
            self.log("snapshot_created", "config", reason=label)
        except Exception as e:
            logger.error(f"Failed to save snapshot: {e}")

    def get_log(self, limit: int = 100, entity_type: str = None) -> list:
        """Retrieve audit log entries."""
        p = placeholder()
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                if entity_type:
                    cursor.execute(
                        f"SELECT * FROM audit_log WHERE entity_type = {p} ORDER BY id DESC LIMIT {p}",
                        (entity_type, limit)
                    )
                else:
                    cursor.execute(
                        f"SELECT * FROM audit_log ORDER BY id DESC LIMIT {p}", (limit,)
                    )

                return [
                    {
                        "id": _row_to_dict(r).get("id"),
                        "timestamp": _row_to_dict(r).get("timestamp"),
                        "action": _row_to_dict(r).get("action"),
                        "entity_type": _row_to_dict(r).get("entity_type"),
                        "entity_id": _row_to_dict(r).get("entity_id"),
                        "old_value": _row_to_dict(r).get("old_value"),
                        "new_value": _row_to_dict(r).get("new_value"),
                        "reason": _row_to_dict(r).get("reason"),
                        "user_id": _row_to_dict(r).get("user_id"),
                    }
                    for r in cursor.fetchall()
                ]
        except Exception as e:
            logger.error(f"Failed to get audit log: {e}")
            return []

    def get_report(self) -> str:
        """Generate human-readable audit report."""
        entries = self.get_log(limit=50)
        if not entries:
            return "No audit entries recorded yet."

        lines = ["=== PRISM AUDIT LOG ===", ""]
        for e in entries:
            lines.append(f"[{e['timestamp']}] {e['action']} -- {e['entity_type']}: "
                         f"{e['entity_id']} -- {e.get('reason') or str(e.get('new_value', ''))[:60]}")
        return "\n".join(lines)
