"""Database persistence for PRISM — dual-mode Postgres (Vercel) / SQLite (local).

When POSTGRES_URL is set (Vercel Postgres / Neon), uses psycopg2.
Otherwise falls back to SQLite for local development.

Implements all tables from the CLAUDE.md specification:
- trends, trend_category_exposure, trend_vc_exposure, trend_journey_exposure
- journey_content (admin-managed Consumer Journey tile map, versioned blob)
- config_snapshots, simulation_runs
- triggers, ai_suggestions, audit_log
- users (auth)

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
                ai_suggestion TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Migration: add columns if missing (for existing DBs)
        for col_sql in [
            "ALTER TABLE trends ADD COLUMN gp1_pct_affected REAL DEFAULT 0.10",
            "ALTER TABLE trends ADD COLUMN peak_year INTEGER DEFAULT 0",
            "ALTER TABLE trends ADD COLUMN diffusion_curve TEXT DEFAULT 's_curve'",
            # Multi-expert proposals layer (June 2026): immutable AI baseline
            # snapshot of the originally-seeded scoreable fields, stored as a
            # JSON blob so the "AI suggestion" reference survives admin edits.
            "ALTER TABLE trends ADD COLUMN ai_suggestion TEXT",
            "ALTER TABLE trend_sources ADD COLUMN tier TEXT DEFAULT ''",
            # Free-text expert comment on a trend score proposal (June 2026).
            # On a fresh DB the proposals table doesn't exist yet at this point
            # (it is created with the column below); the failure is swallowed
            # and the CREATE TABLE adds the column. On an existing DB this adds
            # the column in place.
            "ALTER TABLE trend_score_proposals ADD COLUMN comment TEXT",
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

        # ── Consumer-journey exposure (v3.6 journey layer) ──────────────
        # journey_stage is namespaced "<journey>:<stage_id>"
        # (see pulse/config.py JOURNEY_STAGES / data/consumerJourney.ts).
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS trend_journey_exposure (
                trend_id TEXT REFERENCES trends(id) ON DELETE CASCADE,
                journey_stage TEXT NOT NULL,
                exposure_score INTEGER,
                PRIMARY KEY (trend_id, journey_stage)
            )
        """)

        # ── Multi-expert trend score proposals (June 2026) ──────────────
        # One row per (trend, user): any authenticated user proposes scores
        # for the 7 scoreable fields of a trend. Aggregates + a named
        # "who scored what" breakdown are served back via
        # GET /api/v1/trends/{id}/proposals. Endorsement is NOT a separate
        # action — the frontend reuses PUT /trends/{id} with chosen values.
        # Exposure maps are stored as JSON text (same approach as everywhere
        # else), nullable so a partial proposal never wipes unspecified
        # fields. UNIQUE(trend_id, user_id) enforces one row per scorer; the
        # PUT handler upserts/merges into it.
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS trend_score_proposals (
                id {serial},
                trend_id TEXT REFERENCES trends(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL,
                user_name TEXT,
                user_role TEXT,
                probability INTEGER,
                gp1_pct_affected REAL,
                peak_year INTEGER,
                diffusion_curve TEXT,
                category_exposure TEXT,
                regional_exposure TEXT,
                vc_exposure TEXT,
                comment TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (trend_id, user_id)
            )
        """)

        # ── Consumer-journey content store (admin tile map) ─────────────
        # Versioned single-blob store for the {lhc, hair} journey tile map
        # edited via the admin UI (PUT /api/v1/journey). The frontend falls
        # back to its bundled seed module (data/consumerJourney.ts) when no
        # server-managed content exists yet. Tile-level merging is done
        # client-side; every save appends a new version row.
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS journey_content (
                id {serial},
                content TEXT NOT NULL,
                updated_by TEXT DEFAULT '',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

        # ── Delphi tables removed (D10, June 2026) ──────────────────
        # The Delphi elicitation capability was retired; expert consensus
        # is entered live via the admin Trend editor (user_override=true).
        # Existing delphi_* tables are archived+dropped by
        # scripts/migrate_drop_delphi.py — no DDL is created here anymore.

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
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_session_snapshots_created_at ON session_snapshots(created_at)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_scanned_trends_status ON scanned_trends(status)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_scanned_trends_force ON scanned_trends(force)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_trend_score_proposals_trend ON trend_score_proposals(trend_id)")

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
            cursor.execute(f"DELETE FROM trend_journey_exposure WHERE trend_id = {p}", (trend.id,))
            cursor.execute(f"DELETE FROM trends WHERE id = {p}", (trend.id,))

            cursor.execute(
                f"""
                INSERT INTO trends (
                    id, force, sub_category, name, description, direction,
                    probability, start_year, normalized_score,
                    strategic_implication, data_source, source_type, confidence,
                    ai_suggested, user_override, scorer_count, score_variance,
                    debiasing_applied, probability_posterior,
                    gp1_pct_affected, peak_year, diffusion_curve, ai_suggestion
                ) VALUES ({ph(23)})
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
                    # ai_suggestion: immutable AI baseline snapshot (June 2026
                    # proposals layer). Carried through delete-then-insert so an
                    # admin edit or endorsement never erases the baseline. None
                    # for legacy trends until scripts/backfill_ai_suggestion.py runs.
                    (_safe_dumps(getattr(trend, 'ai_suggestion', None))
                     if getattr(trend, 'ai_suggestion', None) else None),
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

            for journey_stage, score in (getattr(trend, 'journey_exposure', None) or {}).items():
                cursor.execute(
                    f"INSERT INTO trend_journey_exposure (trend_id, journey_stage, exposure_score) VALUES ({ph(3)})",
                    (trend.id, journey_stage, score),
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


def _parse_json_blob(val):
    """Parse a JSON text column, or pass through dicts/lists.

    SQLite stores JSON as TEXT; Postgres may return native dict/list for
    JSONB-typed columns. Returns None for empty/None/invalid values.
    """
    if val is None:
        return None
    if isinstance(val, (dict, list)):
        return val
    try:
        return json.loads(val)
    except (json.JSONDecodeError, TypeError):
        return None


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

            cursor.execute(
                f"SELECT journey_stage, exposure_score FROM trend_journey_exposure WHERE trend_id = {p}",
                (row["id"],),
            )
            journey_exposures = {_row_to_dict(r)["journey_stage"]: _row_to_dict(r)["exposure_score"] for r in cursor.fetchall()}

            prob_posterior = (
                tuple(json.loads(row["probability_posterior"]))
                if row.get("probability_posterior")
                else None
            )

            ai_suggestion = _parse_json_blob(row.get("ai_suggestion"))

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
                journey_exposure=journey_exposures,
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
                ai_suggestion=ai_suggestion,
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

        cursor.execute(
            f"SELECT journey_stage, exposure_score FROM trend_journey_exposure WHERE trend_id = {p}",
            (trend_id,),
        )
        journey_exposures = {_row_to_dict(r)["journey_stage"]: _row_to_dict(r)["exposure_score"] for r in cursor.fetchall()}

        prob_posterior = (
            tuple(json.loads(row["probability_posterior"]))
            if row.get("probability_posterior")
            else None
        )

        ai_suggestion = _parse_json_blob(row.get("ai_suggestion"))

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
            journey_exposure=journey_exposures,
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
            ai_suggestion=ai_suggestion,
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


# ── CONSUMER JOURNEY CONTENT (admin-managed tile map) ───────────────────

def save_journey_content(content: dict, updated_by: str = "") -> None:
    """Persist the full journey content blob ({lhc, hair} tile map).

    Append-only versioning: every save inserts a new row; readers take the
    latest. Validation of the {lhc: [...], hair: [...]} shape happens in
    the API layer (pulse/api/routers/journey.py)."""
    p = placeholder()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            f"INSERT INTO journey_content (content, updated_by) VALUES ({ph(2)})",
            (_safe_dumps(content), updated_by or ""),
        )
        conn.commit()
        logger.info(f"Saved journey content version (by {updated_by or 'unknown'})")


def load_journey_content() -> Optional[dict]:
    """Load the latest admin-managed journey content blob, or None when no
    server-managed content exists yet (frontend then uses its bundled
    seed module data/consumerJourney.ts)."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT content FROM journey_content ORDER BY id DESC LIMIT 1"
        )
        row = cursor.fetchone()
        if not row:
            return None
        content = _row_to_dict(row).get("content")
        if content is None:
            return None
        return json.loads(content) if isinstance(content, str) else content


# ── TREND SCORE PROPOSALS (multi-expert) ────────────────────────────────
# One row per (trend, user). Exposure maps are stored as JSON text and
# read back as dicts. A proposal is PARTIAL: any subset of the 7 scoreable
# fields may be set; NULL/absent fields mean "this user did not score that".

_PROPOSAL_SCALAR_FIELDS = ("probability", "gp1_pct_affected", "peak_year", "diffusion_curve")
_PROPOSAL_MAP_FIELDS = ("category_exposure", "regional_exposure", "vc_exposure")
# Plain-text fields merged verbatim (no JSON encode, no numeric clamp).
_PROPOSAL_TEXT_FIELDS = ("comment",)


def _proposal_row_to_dict(raw) -> dict:
    """Normalize one trend_score_proposals row into a plain dict, decoding
    the JSON exposure-map columns."""
    row = _row_to_dict(raw)
    return {
        "user_id": row.get("user_id"),
        "user_name": row.get("user_name"),
        "user_role": row.get("user_role"),
        "probability": row.get("probability"),
        "gp1_pct_affected": row.get("gp1_pct_affected"),
        "peak_year": row.get("peak_year"),
        "diffusion_curve": row.get("diffusion_curve"),
        "category_exposure": _parse_json_blob(row.get("category_exposure")),
        "regional_exposure": _parse_json_blob(row.get("regional_exposure")),
        "vc_exposure": _parse_json_blob(row.get("vc_exposure")),
        "comment": row.get("comment"),
        "updated_at": row.get("updated_at"),
    }


def load_trend_proposals(trend_id: str) -> List[Dict[str, Any]]:
    """Load all score proposals for a trend, decoded into dicts.

    Returns [] if the table is empty for that trend. Never raises on a
    missing table — callers may run before init_db on a fresh DB.
    """
    p = placeholder()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute(
                f"""
                SELECT user_id, user_name, user_role, probability,
                       gp1_pct_affected, peak_year, diffusion_curve,
                       category_exposure, regional_exposure, vc_exposure,
                       comment, updated_at
                FROM trend_score_proposals
                WHERE trend_id = {p}
                ORDER BY updated_at ASC, user_id ASC
                """,
                (trend_id,),
            )
        except Exception as e:
            logger.warning(f"load_trend_proposals: query failed ({e}) — returning []")
            return []
        return [_proposal_row_to_dict(r) for r in cursor.fetchall()]


def load_all_trend_proposals() -> Dict[str, List[Dict[str, Any]]]:
    """Load every score proposal grouped by trend_id (one DB round-trip).

    Used to attach `proposal_summary` to the trend list cheaply. Returns
    {} on a missing table.
    """
    out: Dict[str, List[Dict[str, Any]]] = {}
    with get_db_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT trend_id, user_id, user_name, user_role, probability,
                       gp1_pct_affected, peak_year, diffusion_curve,
                       category_exposure, regional_exposure, vc_exposure,
                       comment, updated_at
                FROM trend_score_proposals
                ORDER BY updated_at ASC, user_id ASC
                """
            )
        except Exception as e:
            logger.warning(f"load_all_trend_proposals: query failed ({e}) — returning {{}}")
            return {}
        for raw in cursor.fetchall():
            row = _row_to_dict(raw)
            tid = row.get("trend_id")
            if tid is None:
                continue
            out.setdefault(tid, []).append(_proposal_row_to_dict(row))
    return out


def upsert_trend_proposal(
    trend_id: str,
    user_id: str,
    fields: Dict[str, Any],
    user_name: str = "",
    user_role: str = "",
) -> Dict[str, Any]:
    """Merge a partial proposal into this user's row (insert or update).

    `fields` carries only the keys the caller is changing. Scalar fields are
    written as-is; map fields (category/regional/vc exposure) are JSON-encoded.
    Keys NOT present in `fields` are LEFT UNTOUCHED on an existing row (never
    wiped). Returns the merged row as a dict.
    """
    p = placeholder()
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Load any existing row for this (trend, user) to merge into.
        cursor.execute(
            f"""
            SELECT user_id, user_name, user_role, probability, gp1_pct_affected,
                   peak_year, diffusion_curve, category_exposure,
                   regional_exposure, vc_exposure, comment, updated_at
            FROM trend_score_proposals
            WHERE trend_id = {p} AND user_id = {p}
            """,
            (trend_id, user_id),
        )
        existing = cursor.fetchone()
        merged = _proposal_row_to_dict(existing) if existing else {
            "probability": None, "gp1_pct_affected": None, "peak_year": None,
            "diffusion_curve": None, "category_exposure": None,
            "regional_exposure": None, "vc_exposure": None, "comment": None,
        }

        # Apply the partial update (only keys present in `fields`).
        for k in _PROPOSAL_SCALAR_FIELDS + _PROPOSAL_MAP_FIELDS + _PROPOSAL_TEXT_FIELDS:
            if k in fields:
                merged[k] = fields[k]

        def _enc(v):
            return _safe_dumps(v) if v is not None else None

        now = datetime.utcnow()
        if existing:
            cursor.execute(
                f"""
                UPDATE trend_score_proposals
                SET user_name = {p}, user_role = {p}, probability = {p},
                    gp1_pct_affected = {p}, peak_year = {p}, diffusion_curve = {p},
                    category_exposure = {p}, regional_exposure = {p},
                    vc_exposure = {p}, comment = {p}, updated_at = {p}
                WHERE trend_id = {p} AND user_id = {p}
                """,
                (
                    user_name or "", user_role or "",
                    merged.get("probability"), merged.get("gp1_pct_affected"),
                    merged.get("peak_year"), merged.get("diffusion_curve"),
                    _enc(merged.get("category_exposure")),
                    _enc(merged.get("regional_exposure")),
                    _enc(merged.get("vc_exposure")),
                    merged.get("comment"),
                    now, trend_id, user_id,
                ),
            )
        else:
            cursor.execute(
                f"""
                INSERT INTO trend_score_proposals (
                    trend_id, user_id, user_name, user_role, probability,
                    gp1_pct_affected, peak_year, diffusion_curve,
                    category_exposure, regional_exposure, vc_exposure,
                    comment, updated_at
                ) VALUES ({ph(13)})
                """,
                (
                    trend_id, user_id, user_name or "", user_role or "",
                    merged.get("probability"), merged.get("gp1_pct_affected"),
                    merged.get("peak_year"), merged.get("diffusion_curve"),
                    _enc(merged.get("category_exposure")),
                    _enc(merged.get("regional_exposure")),
                    _enc(merged.get("vc_exposure")),
                    merged.get("comment"),
                    now,
                ),
            )
        conn.commit()

    merged["user_id"] = user_id
    merged["user_name"] = user_name or ""
    merged["user_role"] = user_role or ""
    return merged


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
            "triggers", "ai_suggestions",
            "audit_log", "users", "session_snapshots",
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
