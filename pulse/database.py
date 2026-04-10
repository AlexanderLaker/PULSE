"""Database persistence for PRISM — dual-mode Postgres (Vercel) / SQLite (local).

When POSTGRES_URL is set (Vercel Postgres / Neon), uses psycopg2.
Otherwise falls back to SQLite for local development.

Implements all tables from the CLAUDE.md specification:
- trends, trend_category_exposure, trend_vc_exposure
- causal_edges, competitors, config_snapshots
- simulation_runs, backtest_results, delphi_rounds
- triggers, ai_suggestions, audit_log
- users (auth), delphi_sessions, delphi_calibration

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

        # ── Causal DAG edges ─────────────────────────────────────────
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS causal_edges (
                id {serial},
                source_force TEXT NOT NULL,
                target_force TEXT NOT NULL,
                propagation_weight REAL,
                lag_years INTEGER DEFAULT 0,
                mechanism TEXT,
                evidence_strength TEXT DEFAULT 'Moderate',
                calibrated_from_backtest BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ── Competitor profiles ──────────────────────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS competitors (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                archetype TEXT,
                response_patterns TEXT,
                category_exposure TEXT,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ── Model configuration snapshots ────────────────────────────
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
                backtesting_accuracy REAL
            )
        """)

        # ── Simulation runs ──────────────────────────────────────────
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS simulation_runs (
                id {serial},
                run_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                iterations INTEGER,
                model_type TEXT,
                config_snapshot_id INTEGER,
                results TEXT,
                causal_decomposition TEXT,
                allocation_recommendation TEXT,
                convergence_diagnostics TEXT
            )
        """)

        # ── Backtesting results ──────────────────────────────────────
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS backtest_results (
                id {serial},
                backtest_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                historical_version TEXT,
                prediction_year INTEGER,
                actual_shifts TEXT,
                predicted_shifts TEXT,
                accuracy_score REAL,
                calibration_params TEXT
            )
        """)

        # ── Delphi elicitation rounds ────────────────────────────────
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS delphi_rounds (
                id {serial},
                session_id TEXT,
                round_number INTEGER,
                round_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                trend_id TEXT,
                scorer_id TEXT,
                probability_score INTEGER,
                rationale TEXT,
                calibration_factor REAL DEFAULT 1.0,
                bias_flags TEXT
            )
        """)

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
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_causal_edges_source ON causal_edges(source_force)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_causal_edges_target ON causal_edges(target_force)")
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

def save_causal_edges(edges: List[Dict[str, Any]]) -> None:
    """Save causal DAG edges to database.

    Args:
        edges: List of dicts with keys: source_force, target_force, propagation_weight,
               lag_years, mechanism, evidence_strength, calibrated_from_backtest
    """
    p = placeholder()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM causal_edges")

        for edge in edges:
            cursor.execute(
                f"""
                INSERT INTO causal_edges (
                    source_force, target_force, propagation_weight,
                    lag_years, mechanism, evidence_strength, calibrated_from_backtest
                ) VALUES ({ph(7)})
                """,
                (
                    edge.get("source_force"), edge.get("target_force"), edge.get("propagation_weight"),
                    edge.get("lag_years", 0), edge.get("mechanism"), edge.get("evidence_strength", "Moderate"),
                    edge.get("calibrated_from_backtest", False),
                ),
            )

        conn.commit()
        logger.info(f"Saved {len(edges)} causal edges to database")


def load_causal_edges() -> List[Dict[str, Any]]:
    """Load all causal DAG edges from database.

    Returns:
        List of dicts with keys: source_force, target_force, propagation_weight,
        lag_years, mechanism, evidence_strength, calibrated_from_backtest
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT source_force, target_force, propagation_weight,
                   lag_years, mechanism, evidence_strength, calibrated_from_backtest
            FROM causal_edges
        """)

        edges = [
            _row_to_dict(row)
            for row in cursor.fetchall()
        ]

        logger.info(f"Loaded {len(edges)} causal edges from database")
        return edges


# ── SIMULATION RUNS ────────────────────────────────────────────────────

def save_simulation_run(
    iterations: int,
    model_type: str,
    results: dict,
    causal_decomposition: Optional[dict] = None,
    allocation_recommendation: Optional[dict] = None,
    convergence_diagnostics: Optional[dict] = None,
    config_snapshot_id: Optional[int] = None,
) -> int:
    """Save a simulation run result to database."""
    p = placeholder()
    with get_db_connection() as conn:
        cursor = conn.cursor()

        if USE_POSTGRES:
            cursor.execute(
                f"""
                INSERT INTO simulation_runs (
                    iterations, model_type, results,
                    causal_decomposition, allocation_recommendation,
                    convergence_diagnostics, config_snapshot_id
                ) VALUES ({ph(7)}) RETURNING id
                """,
                (
                    iterations, model_type, json.dumps(results),
                    json.dumps(causal_decomposition) if causal_decomposition else None,
                    json.dumps(allocation_recommendation) if allocation_recommendation else None,
                    json.dumps(convergence_diagnostics) if convergence_diagnostics else None,
                    config_snapshot_id,
                ),
            )
            run_id = cursor.fetchone()["id"]
        else:
            cursor.execute(
                f"""
                INSERT INTO simulation_runs (
                    iterations, model_type, results,
                    causal_decomposition, allocation_recommendation,
                    convergence_diagnostics, config_snapshot_id
                ) VALUES ({ph(7)})
                """,
                (
                    iterations, model_type, json.dumps(results),
                    json.dumps(causal_decomposition) if causal_decomposition else None,
                    json.dumps(allocation_recommendation) if allocation_recommendation else None,
                    json.dumps(convergence_diagnostics) if convergence_diagnostics else None,
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
                   results, causal_decomposition, allocation_recommendation,
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
                "causal_decomposition": _safe_json(row.get("causal_decomposition")),
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
            "trends", "causal_edges", "competitors", "simulation_runs",
            "backtest_results", "delphi_rounds", "triggers", "ai_suggestions",
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
