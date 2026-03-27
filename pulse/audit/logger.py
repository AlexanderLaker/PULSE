"""Audit logger — tracks all changes for governance and reproducibility."""

import json
import logging
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class AuditLogger:
    """Logs all model changes, AI decisions, and configuration updates."""

    def __init__(self, db_path: str = None):
        if db_path is None:
            # Use temp dir that supports SQLite (mounted FS may not)
            import tempfile, os
            base = os.environ.get("PULSE_DATA_DIR", tempfile.gettempdir())
            db_dir = os.path.join(base, "pulse_data")
            os.makedirs(db_dir, exist_ok=True)
            self.db_path = os.path.join(db_dir, "pulse.db")
        else:
            self.db_path = db_path
        self._ensure_db()

    def _ensure_db(self):
        """Create audit tables if they don't exist."""
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT DEFAULT (datetime('now')),
                action TEXT NOT NULL,
                entity_type TEXT,
                entity_id TEXT,
                old_value TEXT,
                new_value TEXT,
                reason TEXT,
                user_id TEXT DEFAULT 'system'
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS config_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                snapshot_date TEXT DEFAULT (datetime('now')),
                config_json TEXT,
                label TEXT
            )
        """)
        conn.commit()
        conn.close()

    def log(self, action: str, entity_type: str = "", entity_id: str = "",
            old_value: str = "", new_value: str = "", reason: str = "",
            user_id: str = "system"):
        """Log an audit event."""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.execute(
                "INSERT INTO audit_log (action, entity_type, entity_id, "
                "old_value, new_value, reason, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (action, entity_type, entity_id, old_value, new_value, reason, user_id)
            )
            conn.commit()
            conn.close()
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

    def log_delphi_round(self, trend_id: str, round_num: int, scorer_id: str, scores: dict):
        self.log("delphi_round", "elicitation", trend_id,
                 new_value=json.dumps({"round": round_num, "scorer": scorer_id, **scores}))

    def save_snapshot(self, config_json: str, label: str = ""):
        """Save a configuration snapshot for reproducibility."""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.execute(
                "INSERT INTO config_snapshots (config_json, label) VALUES (?, ?)",
                (config_json, label)
            )
            conn.commit()
            conn.close()
            self.log("snapshot_created", "config", reason=label)
        except Exception as e:
            logger.error(f"Failed to save snapshot: {e}")

    def get_log(self, limit: int = 100, entity_type: str = None) -> list:
        """Retrieve audit log entries."""
        conn = sqlite3.connect(self.db_path)
        if entity_type:
            rows = conn.execute(
                "SELECT * FROM audit_log WHERE entity_type = ? ORDER BY id DESC LIMIT ?",
                (entity_type, limit)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
        conn.close()

        return [
            {"id": r[0], "timestamp": r[1], "action": r[2], "entity_type": r[3],
             "entity_id": r[4], "old_value": r[5], "new_value": r[6],
             "reason": r[7], "user_id": r[8]}
            for r in rows
        ]

    def get_report(self) -> str:
        """Generate human-readable audit report."""
        entries = self.get_log(limit=50)
        if not entries:
            return "No audit entries recorded yet."

        lines = ["═══ PULSE AUDIT LOG ═══", ""]
        for e in entries:
            lines.append(f"[{e['timestamp']}] {e['action']} — {e['entity_type']}: "
                         f"{e['entity_id']} — {e['reason'] or e['new_value'][:60]}")
        return "\n".join(lines)
