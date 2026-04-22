"""Database persistence for PRISM — dual-mode Postgres (Vercel) / SQLite (local).

When POSTGRES_URL is set (Vercel Postgres / Neon), uses psycopg2.
Otherwise falls back to SQLite for local development.

Implements all tables from the CLAUDE.md specification:
- trends, trend_category_exposure, trend_vc_exposure
- config_snapshots, simulation_runs, delphi_rounds
- triggers, ai_suggestions, audit_log
- users (auth), delphi_sessions, delphi_calibration

NOTE: causal_edges, competitors, and backtest_results tables were removed in v2.4
as the underlying modules (causal DAG, game theory, backtesting) were not implemented.

CRITICAL: No financial data (€M values) stored anywhere.
All monetary values are relative (percentages, weights, shifts).
"""

import json
import logging
import os
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional, Any
from contextlib import contextmanager

from pulse.ingestion.models import Trend

logger = logging.getLogger(__name__)


# ── JSON serialization helpers ───────────────────────────────────────
# NumPy / SciPy produce np.bool_, np.int64, np.float64, etc., which the
# stdlib json encoder rejects with "Object of type bool is not JSON
# serializable". Route everything through this helper so the simulation
# engine's diagnostic dicts (convergence, force attribution, etc.) can
# round-trip into Postgres JSONB columns.
def _json_default(o):
    try:
        import numpy as _np  # local import — avoid circular at module load
        if isinstance(o, _np.bool_):
            return bool(o)
        if isinstance(o, _np.integer):
            return int(o)
        if isinstance(o, _np.floating):
            return float(o)
        if isinstance(o, _np.ndarray):
            return o.tolist()
    except ImportError:
        pass
    if isinstance(o, (set, frozenset)):
        return list(o)
    if isinstance(o, datetime):
        return o.isoformat()
    raise TypeError(f"Object of type {type(o).__name__} is not JSON serializable")


def _safe_dumps(obj) -> str:
    """json.dumps wrapper that handles numpy scalars, ndarrays, sets, datetimes."""
    return json.dumps(obj, default=_json_default)

# ── Detect database mode ─────────────────────────────────────────────
POSTGRES_URL = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL")
USE_POSTGRES = bool(POSTGRES_URL)

if USE_POSTGRES:
    try:
        import psycopg2
        import psycopg2.extras
        logger.info("Database mode: PostgreSQL (Vercel Postgres / Neon)")
    except ImportError:
        logger.warning("psycopg2 not installed — falling back to SQLite")
        USE_POSTGRES = False

if not USE_POSTGRES:
    import sqlite3
    logger.info("Database mode: SQLite (local development)")


# ── Connection helpers ────────────────────────────────────────────────

def _get_sqlite_path() -> Path:
    """Get SQLite database file path."""
    _is_vercel = bool(os.environ.get("VERCEL") or os.environ.get("VERCEL_ENV"))
    default = "/tmp/prism.db" if _is_vercel else "data/prism.db"
    db_path = os.environ.get("PRISM_DB_PATH", default)
    return Path(db_path)


def _pg_connect():
    """Create a new PostgreSQL connection."""
    conn = psycopg2.connect(POSTGRES_URL, sslmode="require")
    conn.autocommit = False
    return conn


def _sqlite_connect():
    """Create a new SQLite connection."""
    db_path = _get_sqlite_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


# ── Diagnostics helper ────────────────────────────────────────────────
# Used by the FastAPI /api/v1/diagnostics endpoint. Returns a structured
# view of "what is this process actually seeing" — DB mode, host
# (credentials stripped), row count, latest run id, and any error — so
# dashboard users can distinguish "backend cannot reach Neon" from
# "Neon is reachable but empty" from "rows exist but latest is malformed".
# Never raises — always returns a dict with an "error" key on failure.
def diagnose_connection() -> Dict[str, Any]:
    """Return a structured diagnostic snapshot of the DB layer.

    Shape::

        {
          "db_mode": "postgres" | "sqlite",
          "db_host": "ep-xxx.neon.tech" | "<sqlite:/path>",
          "db_url_env": "POSTGRES_URL" | "DATABASE_URL" | None,
          "db_reachable": bool,
          "simulation_run_count": int,
          "latest_run_id": int | None,
          "latest_run_date": str | None,
          "latest_iterations": int | None,
          "latest_has_shift_matrix": bool,
          "latest_has_decompositions": bool,
          "latest_has_totals": bool,
          "latest_has_vc_decomposition": bool,
          "error": str | None,
        }
    """
    from urllib.parse import urlparse

    which_env = None
    if os.environ.get("POSTGRES_URL"):
        which_env = "POSTGRES_URL"
    elif os.environ.get("DATABASE_URL"):
        which_env = "DATABASE_URL"

    out: Dict[str, Any] = {
        "db_mode": "postgres" if USE_POSTGRES else "sqlite",
        "db_host": None,
        "db_url_env": which_env,
        "db_reachable": False,
        "simulation_run_count": 0,
        "latest_run_id": None,
        "latest_run_date": None,
        "latest_iterations": None,
        "latest_has_shift_matrix": False,
        "latest_has_decompositions": False,
        "latest_has_totals": False,
        "latest_has_vc_decomposition": False,
        "error": None,
    }

    # resolve host (credential-free)
    if USE_POSTGRES and POSTGRES_URL:
        try:
            out["db_host"] = urlparse(POSTGRES_URL).hostname or "unknown"
        except Exception:
            out["db_host"] = "unparseable"
    else:
        try:
            out["db_host"] = f"<sqlite:{_get_sqlite_path()}>"
        except Exception:
            out["db_host"] = "<sqlite>"

    # probe DB
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            # count rows
            cur.execute("SELECT COUNT(*) AS n FROM simulation_runs")
            row = cur.fetchone()
            n = row["n"] if isinstance(row, dict) else row[0]
            out["db_reachable"] = True
            out["simulation_run_count"] = int(n or 0)

            if out["simulation_run_count"] > 0:
                cur.execute(
                    "SELECT id, run_date, iterations, results "
                    "FROM simulation_runs ORDER BY run_date DESC LIMIT 1"
                )
                raw = cur.fetchone()
                row = _row_to_dict(raw) if raw is not None else None
                if row:
                    out["latest_run_id"] = int(row["id"])
                    run_date = row["run_date"]
                    out["latest_run_date"] = (
                        run_date.isoformat() if hasattr(run_date, "isoformat")
                        else str(run_date) if run_date is not None else None
                    )
                    out["latest_iterations"] = int(row["iterations"]) if row["iterations"] is not None else None
                    results = row["results"]
                    if isinstance(results, str):
                        try:
                            results = json.loads(results)
                        except Exception:
                            results = {}
                    if isinstance(results, dict):
                        out["latest_has_shift_matrix"] = "shift_matrix" in results
                        out["latest_has_decompositions"] = "decompositions" in results
                        out["latest_has_totals"] = "totals" in results
                        out["latest_has_vc_decomposition"] = "vc_decomposition" in results
    except Exception as e:
        out["error"] = f"{type(e).__name__}: {e}"
        logger.warning("diagnose_connection: DB probe failed: %s", out["error"])

    return out


@contextmanager
def get_db_connection():
    """
    Context manager for database connections with auto-commit.
    Includes retry logic for cold-start connection failures (Neon/Postgres).

    Returns a connection + a dict-like row factory regardless of backend.
    Uses %s placeholders for Postgres, ? for SQLite — callers should use
    the sql() helper or write backend-aware queries.

    Usage:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(...)
            conn.commit()
    """
    max_retries = 3
    last_error = None
    conn = None

    for attempt in range(max_retries):
        try:
            if USE_POSTGRES:
                conn = _pg_connect()
                conn.cursor_factory = psycopg2.extras.RealDictCursor
            else:
                conn = _sqlite_connect()
            break
        except Exception as e:
            last_error = e
            if attempt < max_retries - 1:
                import time
                wait = 0.5 * (2 ** attempt)
                logger.warning(
                    f"DB connection attempt {attempt + 1}/{max_retries} failed: {e}. "
                    f"Retrying in {wait:.1f}s..."
                )
                time.sleep(wait)
            else:
                logger.error(f"All {max_retries} DB connection attempts failed: {e}")

    if conn is None:
        raise RuntimeError(
            f"Failed to connect to database after {max_retries} attempts: {last_error}"
        )

    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Database error: {e}")
        raise
    finally:
        conn.close()


def placeholder() -> str:
    """Return the correct SQL placeholder for the current backend."""
    return "%s" if USE_POSTGRES else "?"


def ph(count: int = 1) -> str:
    """Return comma-separated placeholders. ph(3) → '%s, %s, %s' or '?, ?, ?'"""
    p = placeholder()
    return ", ".join([p] * count)


# ── Schema initialization ─────────────────────────────────────────────

def _serial_pk() -> str:
    """Return the correct auto-increment primary key syntax."""
    return "SERIAL PRIMARY KEY" if USE_POSTGRES else "INTEGER PRIMARY KEY AUTOINCREMENT"


def init_db() -> None:
    """
    Initialize database schema.

    Creates all tables if they don't exist. Safe to call multiple times.
    Works for both Postgres and SQLite.
    """
    serial = _serial_pk()
    p = placeholder()

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # ── Core trends table ────────────────────────────────────────
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS trends (
                id TEXT PRIMARY KEY,
                force TEXT NOT NULL,
                sub_category TEXT,
                name TEXT NOT NULL,
                description TEXT,
                direction TEXT,
                probability INTEGER,
                start_year INTEGER,
                normalized_score REAL,
                strategic_implication TEXT,
                data_source TEXT,
                source_type TEXT,
                confidence TEXT DEFAULT 'Medium',
                ai_suggested BOOLEAN DEFAULT FALSE,
                user_override BOOLEAN DEFAULT FALSE,
                scorer_count INTEGER DEFAULT 1,
                score_variance REAL DEFAULT 0.0,
                debiasing_applied BOOLEAN DEFAULT FALSE,
                probability_posterior TEXT,
                gp1_pct_affected REAL DEFAULT 0.10,
                peak_year INTEGER DEFAULT 0,
                diffusion_curve TEXT DEFAULT 's_curve',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Migration: add columns if missing (for existing DBs)
        for col_sql in [
            "ALTER TABLE trends ADD COLUMN gp1_pct_affected REAL DEFAULT 0.10",
            "ALTER TABLE trends ADD COLUMN peak_year INTEGER DEFAULT 0",
            "ALTER TABLE trends ADD COLUMN diffusion_curve TEXT DEFAULT 's_curve'",
            "ALTER TABLE trend_sources ADD COLUMN tier TEXT DEFAULT ''",
        ]:
            try:
                if POSTGRES_URL:
                    cursor.execute("SAVEPOINT sp_migrate_col")
                cursor.execute(col_sql)
                conn.commit()
            except Exception:
                if POSTGRES_URL:
                    cursor.execute("ROLLBACK TO SAVEPOINT sp_migrate_col")
                pass  # Column already exists

        # ── Category exposure ────────────────────────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS trend_category_exposure (
                trend_id TEXT REFERENCES trends(id) ON DELETE CASCADE,
                category TEXT NOT NULL,
                exposure_score INTEGER,
                PRIMARY KEY (trend_id, category)
            )
        """)

        # ── Value chain exposure ─────────────────────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS trend_vc_exposure (
                trend_id TEXT REFERENCES trends(id) ON DELETE CASCADE,
                vc_step TEXT NOT NULL,
                exposure_score INTEGER,
                PRIMARY KEY (trend_id, vc_step)
            )
        """)

        # ── Regional exposure ──────────────────────────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS trend_regional_exposure (
                trend_id TEXT REFERENCES trends(id) ON DELETE CASCADE,
                region TEXT NOT NULL,
                exposure_score INTEGER,
                PRIMARY KEY (trend_id, region)
            )
        """)

        # ── Trend sources (evidence URLs) ────────────────────────────
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS trend_sources (
                id {serial},
                trend_id TEXT REFERENCES trends(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                source_type TEXT DEFAULT '',
                tier TEXT DEFAULT ''
            )
        """)

        # NOTE: causal_edges and competitors tables removed in v2.4
        # (underlying modules not implemented)

        # ── Model configuration snapshots ────────────────────────────
        # `config_json` + `label` capture the AuditLogger.save_snapshot()
        # payload (a single serialised blob of the full config + an
        # operator-supplied label). The structured columns alongside
        # them are retained for queries that need to filter snapshots
        # without parsing the JSON blob.
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS config_snapshots (
                id {serial},
                snapshot_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                region TEXT,
                attenuation REAL,
                attenuation_source TEXT,
                force_weights TEXT,
                vc_weights TEXT,
                category_names TEXT,
                path_years TEXT,
                materialization_schedule TEXT,
                config_json TEXT,
                label TEXT
            )
        """)

        # v3.3 migration: databases created before the config_json/label
        # columns were added need idempotent ALTERs so AuditLogger.save_snapshot()
        # does not fail with "no column named config_json". Follows the
        # same pattern as the causal_decomposition → force_attribution
        # migration a few lines below.
        for col_ddl in ("config_json TEXT", "label TEXT"):
            try:
                if POSTGRES_URL:
                    cursor.execute("SAVEPOINT sp_add_col")
                cursor.execute(f"ALTER TABLE config_snapshots ADD COLUMN {col_ddl}")
                if POSTGRES_URL:
                    cursor.execute("RELEASE SAVEPOINT sp_add_col")
            except Exception:
                if POSTGRES_URL:
                    cursor.execute("ROLLBACK TO SAVEPOINT sp_add_col")
                pass  # column already exists

        # ── Simulation runs ──────────────────────────────────────────
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS simulation_runs (
                id {serial},
                run_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                iterations INTEGER,
                model_type TEXT,
                config_snapshot_id INTEGER,
                results TEXT,
                force_attribution TEXT,
                allocation_recommendation TEXT,
                convergence_diagnostics TEXT
            )
        """)

        # A6: historical databases had this column named causal_decomposition.
        # The field was never actually causal — it was always a static force
        # attribution. Migrate idempotently so old databases keep working.
        try:
            if POSTGRES_URL:
                cursor.execute("SAVEPOINT sp_rename_col")
            cursor.execute("ALTER TABLE simulation_runs RENAME COLUMN causal_decomposition TO force_attribution")
            if POSTGRES_URL:
                cursor.execute("RELEASE SAVEPOINT sp_rename_col")
        except Exception:
            if POSTGRES_URL:
                cursor.execute("ROLLBACK TO SAVEPOINT sp_rename_col")
            pass  # column already renamed or never existed under old name

        # NOTE: backtest_results table removed in v2.4
        # (backtesting module not implemented)

        # ── Delphi elicitation rounds ────────────────────────────────
        # gp1_pct_affected_score is the per-scorer estimate of the
        # economic-scope variable (E3). It's elicited alongside the
        # probability score so the Delphi consensus can produce both
        # values via the same calibration-weighted process.
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS delphi_rounds (
                id {serial},
                session_id TEXT,
                round_number INTEGER,
                round_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                trend_id TEXT,
                scorer_id TEXT,
                probability_score INTEGER,
                gp1_pct_affected_score REAL,
                rationale TEXT,
                calibration_factor REAL DEFAULT 1.0,
                bias_flags TEXT
            )
        """)
        # Backfill column on pre-existing tables (idempotent best-effort)
        try:
            if POSTGRES_URL:
                cursor.execute("SAVEPOINT sp_delphi_col")
            cursor.execute("ALTER TABLE delphi_rounds ADD COLUMN gp1_pct_affected_score REAL")
            if POSTGRES_URL:
                cursor.execute("RELEASE SAVEPOINT sp_delphi_col")
        except Exception:
            if POSTGRES_URL:
                cursor.execute("ROLLBACK TO SAVEPOINT sp_delphi_col")
            pass  # column already exists

        # ── Delphi sessions ─────────────────────────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS delphi_sessions (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                status TEXT DEFAULT 'active',
                current_round INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                trend_ids TEXT,
                scorer_ids TEXT
            )
        """)

        # ── Delphi calibration ───────────────────────────────────────
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS delphi_calibration (
                id {serial},
                session_id TEXT,
                scorer_id TEXT NOT NULL,
                calibration_factor REAL DEFAULT 1.0,
                bias_flags TEXT,
                mean_impact_error REAL DEFAULT 0,
                mean_prob_error REAL DEFAULT 0,
                calibrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ── Early-warning triggers ───────────────────────────────────
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS triggers (
                id {serial},
                category TEXT NOT NULL,
                condition_type TEXT,
                threshold REAL,
                target_year INTEGER,
                action_text TEXT,
                status TEXT DEFAULT 'active',
                fired_date TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ── AI suggestions queue ─────────────────────────────────────
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS ai_suggestions (
                id {serial},
                suggestion_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                suggestion_type TEXT,
                content TEXT,
                source_urls TEXT,
                status TEXT DEFAULT 'pending',
                user_decision_date TIMESTAMP,
                user_notes TEXT
            )
        """)

        # ── Audit log ────────────────────────────────────────────────
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS audit_log (
                id {serial},
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                action TEXT NOT NULL,
                entity_type TEXT,
                entity_id TEXT,
                old_value TEXT,
                new_value TEXT,
                reason TEXT,
                user_id TEXT DEFAULT 'system'
            )
        """)

        # ── Users (auth) ────────────────────────────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                password_salt TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'analyst',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            )
        """)

        # ── Session snapshots (permanent history) ────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS session_snapshots (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                shifts TEXT NOT NULL,
                trends TEXT,
                trend_count INTEGER DEFAULT 0,
                net_shift REAL DEFAULT 0,
                notes TEXT,
                created_by TEXT DEFAULT 'system',
                model_version TEXT,
                iterations INTEGER
            )
        """)

        # ── Scanned trends (emerging trends persistence) ──────────
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS scanned_trends (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                force TEXT,
                direction TEXT DEFAULT 'Expansion',
                suggested_gp1_pct_affected REAL DEFAULT 0.10,
                suggested_probability INTEGER DEFAULT 3,
                relevance_score INTEGER DEFAULT 65,
                category_mapping TEXT,
                sources TEXT,
                discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reasoning TEXT,
                status TEXT DEFAULT 'new',
                scan_session TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ── Indexes ──────────────────────────────────────────────────
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_trends_force ON trends(force)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_simulation_runs_date ON simulation_runs(run_date)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_delphi_rounds_session ON delphi_rounds(session_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_session_snapshots_created_at ON session_snapshots(created_at)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_scanned_trends_status ON scanned_trends(status)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_scanned_trends_force ON scanned_trends(force)")

        conn.commit()
        logger.info(f"Database initialized (mode: {'postgres' if USE_POSTGRES else 'sqlite'})")


# ── TRENDS ──────────────────────────────────────────────────────────────

def save_trends(trends: List[Trend]) -> None:
    """Save trends to database, replacing any existing trends with same IDs."""
    p = placeholder()
    with get_db_connection() as conn:
        cursor = conn.cursor()

        for trend in trends:
            cursor.execute(f"DELETE FROM trend_sources WHERE trend_id = {p}", (trend.id,))
            cursor.execute(f"DELETE FROM trend_category_exposure WHERE trend_id = {p}", (trend.id,))
            cursor.execute(f"DELETE FROM trend_vc_exposure WHERE trend_id = {p}", (trend.id,))
            cursor.execute(f"DELETE FROM trend_regional_exposure WHERE trend_id = {p}", (trend.id,))
            cursor.execute(f"DELETE FROM trends WHERE id = {p}", (trend.id,))

            cursor.execute(
                f"""
                INSERT INTO trends (
                    id, force, sub_category, name, description, direction,
                    probability, start_year, normalized_score,
                    strategic_implication, data_source, source_type, confidence,
                    ai_suggested, user_override, scorer_count, score_variance,
                    debiasing_applied, probability_posterior,
                    gp1_pct_affected, peak_year, diffusion_curve
                ) VALUES ({ph(22)})
                """,
                (
                    trend.id, trend.force, trend.sub_category, trend.name,
                    trend.description, trend.direction,
                    trend.probability, trend.start_year, trend.normalized_score,
                    trend.strategic_implication, trend.data_source, trend.source_type,
                    trend.confidence, trend.ai_suggested, trend.user_override,
                    trend.scorer_count, trend.score_variance, trend.debiasing_applied,
                    json.dumps(trend.probability_posterior) if trend.probability_posterior else None,
                    getattr(trend, 'gp1_pct_affected', 0.10),
                    getattr(trend, 'peak_year', 0),
                    getattr(trend, 'diffusion_curve', 's_curve'),
                ),
            )

            for category, score in trend.category_exposure.items():
                cursor.execute(
                    f"INSERT INTO trend_category_exposure (trend_id, category, exposure_score) VALUES ({ph(3)})",
                    (trend.id, category, score),
                )

            for vc_step, score in trend.vc_exposure.items():
                cursor.execute(
                    f"INSERT INTO trend_vc_exposure (trend_id, vc_step, exposure_score) VALUES ({ph(3)})",
                    (trend.id, vc_step, score),
                )

            for region, score in trend.regional_exposure.items():
                cursor.execute(
                    f"INSERT INTO trend_regional_exposure (trend_id, region, exposure_score) VALUES ({ph(3)})",
                    (trend.id, region, score),
                )

            # Save source URLs if available
            sources = getattr(trend, 'sources', None) or []
            for src in sources:
                cursor.execute(
                    f"INSERT INTO trend_sources (trend_id, title, url, source_type, tier) VALUES ({ph(5)})",
                    (trend.id, src.get("title", ""), src.get("url", ""), src.get("source_type", src.get("data", "")), src.get("tier", "")),
                )

        conn.commit()
        logger.info(f"Saved {len(trends)} trends to database")


def _row_to_dict(row) -> dict:
    """Convert a database row to a plain dict (works for both backends)."""
    if isinstance(row, dict):
        return row
    # sqlite3.Row
    return dict(row)


def load_trends() -> List[Trend]:
    """Load all trends from database."""
    p = placeholder()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM trends")
        trend_rows = cursor.fetchall()

        trends = []
        for raw_row in trend_rows:
            row = _row_to_dict(raw_row)

            cursor.execute(
                f"SELECT category, exposure_score FROM trend_category_exposure WHERE trend_id = {p}",
                (row["id"],),
            )
            cat_exposures = {_row_to_dict(r)["category"]: _row_to_dict(r)["exposure_score"] for r in cursor.fetchall()}

            cursor.execute(
                f"SELECT vc_step, exposure_score FROM trend_vc_exposure WHERE trend_id = {p}",
                (row["id"],),
            )
            vc_exposures = {_row_to_dict(r)["vc_step"]: _row_to_dict(r)["exposure_score"] for r in cursor.fetchall()}

            cursor.execute(
                f"SELECT region, exposure_score FROM trend_regional_exposure WHERE trend_id = {p}",
                (row["id"],),
            )
            regional_exposures = {_row_to_dict(r)["region"]: _row_to_dict(r)["exposure_score"] for r in cursor.fetchall()}

            prob_posterior = (
                tuple(json.loads(row["probability_posterior"]))
                if row.get("probability_posterior")
                else None
            )

            # Load source URLs
            try:
                cursor.execute(
                    f"SELECT title, url, source_type, tier FROM trend_sources WHERE trend_id = {p}",
                    (row["id"],),
                )
                sources = [
                    {"title": _row_to_dict(r)["title"], "url": _row_to_dict(r)["url"], "data": _row_to_dict(r).get("source_type", ""), "tier": _row_to_dict(r).get("tier", "")}
                    for r in cursor.fetchall()
                ]
            except Exception:
                sources = []

            trend = Trend(
                id=row["id"],
                force=row["force"],
                sub_category=row.get("sub_category"),
                name=row["name"],
                description=row.get("description"),
                direction=row.get("direction"),
                probability=row.get("probability"),
                start_year=row.get("start_year"),
                normalized_score=row.get("normalized_score"),
                strategic_implication=row.get("strategic_implication"),
                category_exposure=cat_exposures,
                vc_exposure=vc_exposures,
                regional_exposure=regional_exposures,
                data_source=row.get("data_source"),
                source_type=row.get("source_type"),
                confidence=row.get("confidence", "Medium"),
                last_updated=row["updated_at"] if isinstance(row.get("updated_at"), datetime) else (datetime.fromisoformat(row["updated_at"]) if row.get("updated_at") else datetime.utcnow()),
                ai_suggested=row.get("ai_suggested", False),
                user_override=row.get("user_override", False),
                scorer_count=row.get("scorer_count", 1),
                score_variance=row.get("score_variance", 0.0),
                debiasing_applied=row.get("debiasing_applied", False),
                gp1_pct_affected=row.get("gp1_pct_affected", 0.10) or 0.10,
                peak_year=row.get("peak_year", 0) or 0,
                diffusion_curve=row.get("diffusion_curve", "s_curve") or "s_curve",
                probability_posterior=prob_posterior,
            )
            # Attach sources as transient attribute (not in dataclass)
            trend.sources = sources
            trends.append(trend)

        logger.info(f"Loaded {len(trends)} trends from database")
        return trends


def get_trend_by_id(trend_id: str) -> Optional[Trend]:
    """Load a single trend by ID."""
    p = placeholder()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f"SELECT * FROM trends WHERE id = {p}", (trend_id,))
        raw_row = cursor.fetchone()

        if not raw_row:
            return None

        row = _row_to_dict(raw_row)

        cursor.execute(
            f"SELECT category, exposure_score FROM trend_category_exposure WHERE trend_id = {p}",
            (trend_id,),
        )
        cat_exposures = {_row_to_dict(r)["category"]: _row_to_dict(r)["exposure_score"] for r in cursor.fetchall()}

        cursor.execute(
            f"SELECT vc_step, exposure_score FROM trend_vc_exposure WHERE trend_id = {p}",
            (trend_id,),
        )
        vc_exposures = {_row_to_dict(r)["vc_step"]: _row_to_dict(r)["exposure_score"] for r in cursor.fetchall()}

        cursor.execute(
            f"SELECT region, exposure_score FROM trend_regional_exposure WHERE trend_id = {p}",
            (trend_id,),
        )
        regional_exposures = {_row_to_dict(r)["region"]: _row_to_dict(r)["exposure_score"] for r in cursor.fetchall()}

        prob_posterior = (
            tuple(json.loads(row["probability_posterior"]))
            if row.get("probability_posterior")
            else None
        )

        return Trend(
            id=row["id"],
            force=row["force"],
            sub_category=row.get("sub_category"),
            name=row["name"],
            description=row.get("description"),
            direction=row.get("direction"),
            probability=row.get("probability"),
            start_year=row.get("start_year"),
            normalized_score=row.get("normalized_score"),
            strategic_implication=row.get("strategic_implication"),
            category_exposure=cat_exposures,
            vc_exposure=vc_exposures,
            regional_exposure=regional_exposures,
            data_source=row.get("data_source"),
            source_type=row.get("source_type"),
            confidence=row.get("confidence", "Medium"),
            last_updated=row["updated_at"] if isinstance(row.get("updated_at"), datetime) else (datetime.fromisoformat(row["updated_at"]) if row.get("updated_at") else datetime.utcnow()),
            ai_suggested=row.get("ai_suggested", False),
            user_override=row.get("user_override", False),
            scorer_count=row.get("scorer_count", 1),
            score_variance=row.get("score_variance", 0.0),
            debiasing_applied=row.get("debiasing_applied", False),
            probability_posterior=prob_posterior,
        )


# ── CAUSAL EDGES ────────────────────────────────────────────────────────

# ── SIMULATION RUNS ────────────────────────────────────────────────────

def save_simulation_run(
    iterations: int,
    model_type: str,
    results: dict,
    force_attribution: Optional[dict] = None,
    allocation_recommendation: Optional[dict] = None,
    convergence_diagnostics: Optional[dict] = None,
    config_snapshot_id: Optional[int] = None,
    # A6 backward-compat alias — old callers can still pass causal_decomposition
    causal_decomposition: Optional[dict] = None,
) -> int:
    """Save a simulation run result to database."""
    # A6: accept the old kwarg name as an alias for one release cycle
    if force_attribution is None and causal_decomposition is not None:
        logger.warning(
            "causal_decomposition parameter is deprecated — use force_attribution instead"
        )
        force_attribution = causal_decomposition

    p = placeholder()
    with get_db_connection() as conn:
        cursor = conn.cursor()

        if USE_POSTGRES:
            cursor.execute(
                f"""
                INSERT INTO simulation_runs (
                    iterations, model_type, results,
                    force_attribution, allocation_recommendation,
                    convergence_diagnostics, config_snapshot_id
                ) VALUES ({ph(7)}) RETURNING id
                """,
                (
                    iterations, model_type, _safe_dumps(results),
                    _safe_dumps(force_attribution) if force_attribution else None,
                    _safe_dumps(allocation_recommendation) if allocation_recommendation else None,
                    _safe_dumps(convergence_diagnostics) if convergence_diagnostics else None,
                    config_snapshot_id,
                ),
            )
            run_id = cursor.fetchone()["id"]
        else:
            cursor.execute(
                f"""
                INSERT INTO simulation_runs (
                    iterations, model_type, results,
                    force_attribution, allocation_recommendation,
                    convergence_diagnostics, config_snapshot_id
                ) VALUES ({ph(7)})
                """,
                (
                    iterations, model_type, _safe_dumps(results),
                    _safe_dumps(force_attribution) if force_attribution else None,
                    _safe_dumps(allocation_recommendation) if allocation_recommendation else None,
                    _safe_dumps(convergence_diagnostics) if convergence_diagnostics else None,
                    config_snapshot_id,
                ),
            )
            run_id = cursor.lastrowid

        conn.commit()
        logger.info(f"Saved simulation run {run_id}: ({iterations} iterations)")
        return run_id


def load_simulation_runs(
    limit: int = 100
) -> List[Dict[str, Any]]:
    """Load simulation runs from database."""
    p = placeholder()
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            f"""
            SELECT id, run_date, iterations, model_type,
                   results, force_attribution, allocation_recommendation,
                   convergence_diagnostics
            FROM simulation_runs
            ORDER BY run_date DESC
            LIMIT {p}
            """,
            (limit,),
        )

        runs = []
        for raw_row in cursor.fetchall():
            row = _row_to_dict(raw_row)
            run_date = row["run_date"]
            if isinstance(run_date, str):
                run_date = datetime.fromisoformat(run_date)

            def _safe_json(val):
                """Parse JSON string or return dict as-is (Postgres returns dicts for JSONB)."""
                if val is None:
                    return None
                if isinstance(val, (dict, list)):
                    return val
                try:
                    return json.loads(val)
                except (json.JSONDecodeError, TypeError):
                    return {}

            run = {
                "id": row["id"],
                "run_date": run_date,
                "iterations": row["iterations"],
                "model_type": row["model_type"],
                "results": _safe_json(row["results"]) or {},
                "force_attribution": _safe_json(row.get("force_attribution")),
                "allocation_recommendation": _safe_json(row.get("allocation_recommendation")),
                "convergence_diagnostics": _safe_json(row.get("convergence_diagnostics")),
            }
            runs.append(run)

        logger.info(f"Loaded {len(runs)} simulation runs from database")
        return runs


# ── AUDIT LOG ───────────────────────────────────────────────────────────

def log_audit(
    action: str,
    entity_type: str,
    entity_id: str,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    reason: Optional[str] = None,
    user_id: str = "system",
) -> None:
    """Log an action to the audit trail."""
    p = placeholder()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            f"""
            INSERT INTO audit_log (
                action, entity_type, entity_id, old_value, new_value, reason, user_id
            ) VALUES ({ph(7)})
            """,
            (action, entity_type, entity_id, old_value, new_value, reason, user_id),
        )
        conn.commit()


def get_audit_log(
    limit: int = 100, entity_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get audit log entries."""
    p = placeholder()
    with get_db_connection() as conn:
        cursor = conn.cursor()

        if entity_type:
            cursor.execute(
                f"""
                SELECT id, timestamp, action, entity_type, entity_id,
                       old_value, new_value, reason, user_id
                FROM audit_log
                WHERE entity_type = {p}
                ORDER BY timestamp DESC
                LIMIT {p}
                """,
                (entity_type, limit),
            )
        else:
            cursor.execute(
                f"""
                SELECT id, timestamp, action, entity_type, entity_id,
                       old_value, new_value, reason, user_id
                FROM audit_log
                ORDER BY timestamp DESC
                LIMIT {p}
                """,
                (limit,),
            )

        logs = []
        for raw_row in cursor.fetchall():
            row = _row_to_dict(raw_row)
            ts = row["timestamp"]
            if isinstance(ts, str):
                ts = datetime.fromisoformat(ts)
            logs.append({
                "id": row["id"],
                "timestamp": ts,
                "action": row["action"],
                "entity_type": row["entity_type"],
                "entity_id": row["entity_id"],
                "old_value": row["old_value"],
                "new_value": row["new_value"],
                "reason": row["reason"],
                "user_id": row["user_id"],
            })

        return logs


# ── Database Health & Stats ────────────────────────────────────────────

def get_db_stats() -> Dict[str, int]:
    """Get database statistics (record counts per table)."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        tables = [
            "trends", "simulation_runs",
            "delphi_rounds", "triggers", "ai_suggestions",
            "audit_log", "users", "delphi_sessions", "session_snapshots",
        ]

        stats = {}
        for table in tables:
            try:
                cursor.execute(f"SELECT COUNT(*) as count FROM {table}")
                row = _row_to_dict(cursor.fetchone())
                stats[table] = row["count"]
            except Exception:
                stats[table] = 0

        return stats


if __name__ == "__main__":
    init_db()
    stats = get_db_stats()
    print(f"Database mode: {'PostgreSQL' if USE_POSTGRES else 'SQLite'}")
    print("Database statistics:")
    for table, count in stats.items():
        print(f"  {table}: {count}")
