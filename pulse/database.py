"""SQLite database persistence for PULSE trends, simulations, and metadata.

Implements all tables from the schema in CLAUDE.md:
- trends: Strategic trends with scoring and Bayesian posteriors
- trend_category_exposure: Exposure matrix for trends
- trend_vc_exposure: Value chain exposure
- causal_edges: Causal DAG edges between forces
- competitors: Competitive profiles (public intelligence only)
- config_snapshots: Configuration parameter snapshots
- simulation_runs: Results from Bayesian MC and sensitivity runs
- backtest_results: Historical prediction accuracy
- delphi_rounds: Expert elicitation scoring
- triggers: Early-warning trigger definitions and status
- ai_suggestions: AI scanning results pending human review
- audit_log: Change tracking with user/timestamp/reason

CRITICAL: No financial data (€M values) stored anywhere.
All monetary values are relative (percentages, weights, shifts).
"""

import sqlite3
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional, Tuple, Any
from contextlib import contextmanager

from pulse.ingestion.models import Trend, CausalEdge
from pulse.env_loader import get_config

logger = logging.getLogger(__name__)

# Get database path from environment or use default
config = get_config()
DB_PATH = Path(config.db_path)


def get_db_path() -> Path:
    """Get the database path."""
    return DB_PATH


def ensure_db_directory() -> None:
    """Ensure the database directory exists."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)


@contextmanager
def get_db_connection():
    """
    Context manager for database connections with auto-commit.

    Usage:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(...)
            conn.commit()
    """
    ensure_db_directory()
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row  # Return rows as dict-like objects
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Database error: {e}")
        raise
    finally:
        conn.close()


def init_db() -> None:
    """
    Initialize database schema from CLAUDE.md specification.

    Creates all tables if they don't exist. Safe to call multiple times
    (existing tables are not dropped).
    """
    ensure_db_directory()

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # ── Core trends table ────────────────────────────────────────────

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS trends (
                id TEXT PRIMARY KEY,
                force TEXT NOT NULL,
                sub_category TEXT,
                name TEXT NOT NULL,
                description TEXT,
                direction TEXT CHECK(direction IN ('Expansion', 'Contraction')),
                impact INTEGER CHECK(impact BETWEEN 1 AND 5),
                probability INTEGER CHECK(probability BETWEEN 1 AND 5),
                start_year INTEGER,
                normalized_score REAL,
                strategic_implication TEXT,
                data_source TEXT,
                source_type TEXT,
                confidence TEXT DEFAULT 'Medium',
                ai_suggested BOOLEAN DEFAULT FALSE,
                user_override BOOLEAN DEFAULT FALSE,
                -- Delphi metadata
                scorer_count INTEGER DEFAULT 1,
                score_variance REAL DEFAULT 0.0,
                debiasing_applied BOOLEAN DEFAULT FALSE,
                -- Bayesian posteriors (JSON: {alpha, beta})
                impact_posterior TEXT,
                probability_posterior TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ── Category exposure ────────────────────────────────────────────

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS trend_category_exposure (
                trend_id TEXT REFERENCES trends(id) ON DELETE CASCADE,
                category TEXT NOT NULL,
                exposure_score INTEGER CHECK(exposure_score BETWEEN 0 AND 5),
                PRIMARY KEY (trend_id, category)
            )
        """)

        # ── Value chain exposure ─────────────────────────────────────────

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS trend_vc_exposure (
                trend_id TEXT REFERENCES trends(id) ON DELETE CASCADE,
                vc_step TEXT NOT NULL,
                exposure_score INTEGER CHECK(exposure_score BETWEEN 0 AND 5),
                PRIMARY KEY (trend_id, vc_step)
            )
        """)

        # ── Causal DAG edges ─────────────────────────────────────────────

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS causal_edges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_force TEXT NOT NULL,
                target_force TEXT NOT NULL,
                propagation_weight REAL CHECK(propagation_weight BETWEEN 0 AND 1),
                lag_years INTEGER DEFAULT 0,
                mechanism TEXT,
                evidence_strength TEXT DEFAULT 'Moderate',
                calibrated_from_backtest BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ── Competitor profiles ──────────────────────────────────────────

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS competitors (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                archetype TEXT,
                response_patterns TEXT,     -- JSON
                category_exposure TEXT,     -- JSON: {category: exposure_level}
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ── Model configuration snapshots ────────────────────────────────

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS config_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                snapshot_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                region TEXT,
                attenuation REAL,
                attenuation_source TEXT,   -- "assumed" | "backtested"
                force_weights TEXT,         -- JSON
                vc_weights TEXT,            -- JSON
                category_names TEXT,        -- JSON
                path_years TEXT,            -- JSON
                materialization_schedule TEXT,  -- JSON
                backtesting_accuracy REAL
            )
        """)

        # ── Simulation runs ──────────────────────────────────────────────

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS simulation_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                scenario TEXT,
                iterations INTEGER,
                model_type TEXT,            -- "deterministic" | "bayesian_mc" | "copula_mc"
                config_snapshot_id INTEGER REFERENCES config_snapshots(id),
                results TEXT,               -- JSON: {category: {year: {percentile: shift%}}}
                causal_decomposition TEXT,  -- JSON: {category: {force: direct_%, propagated_%}}
                allocation_recommendation TEXT,  -- JSON: {category: weight}
                convergence_diagnostics TEXT    -- JSON: {r_hat, ess, etc.}
            )
        """)

        # ── Backtesting results ──────────────────────────────────────────

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS backtest_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                backtest_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                historical_version TEXT,    -- "V5", "V8", etc.
                prediction_year INTEGER,
                actual_shifts TEXT,         -- JSON: public market-level shifts
                predicted_shifts TEXT,      -- JSON: what PULSE would have predicted
                accuracy_score REAL,
                calibration_params TEXT     -- JSON: derived attenuation, distributions, etc.
            )
        """)

        # ── Delphi elicitation rounds ────────────────────────────────────

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS delphi_rounds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                round_number INTEGER,
                round_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                trend_id TEXT REFERENCES trends(id),
                scorer_id TEXT,
                impact_score INTEGER,
                probability_score INTEGER,
                rationale TEXT,
                calibration_factor REAL DEFAULT 1.0,
                bias_flags TEXT             -- JSON: ["anchoring", "optimism", etc.]
            )
        """)

        # ── Early-warning triggers ───────────────────────────────────────

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS triggers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                condition_type TEXT,        -- "shift_exceeds" | "velocity_exceeds" | etc.
                threshold REAL,
                target_year INTEGER,
                action_text TEXT,
                status TEXT DEFAULT 'active',  -- "active" | "fired" | "dismissed"
                fired_date TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ── AI suggestions queue ─────────────────────────────────────────

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ai_suggestions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                suggestion_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                suggestion_type TEXT,
                content TEXT,
                source_urls TEXT,
                status TEXT DEFAULT 'pending',
                user_decision_date TIMESTAMP,
                user_notes TEXT
            )
        """)

        # ── Audit log ────────────────────────────────────────────────────

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
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

        # ── Create indexes for common queries ────────────────────────────

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_trends_force ON trends(force)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_causal_edges_source ON causal_edges(source_force)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_causal_edges_target ON causal_edges(target_force)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_simulation_runs_date ON simulation_runs(run_date)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp)
        """)

        conn.commit()
        logger.info(f"Database initialized at {DB_PATH}")


# ── TRENDS ──────────────────────────────────────────────────────────────

def save_trends(trends: List[Trend]) -> None:
    """
    Save trends to database, replacing any existing trends with same IDs.

    Args:
        trends: List of Trend objects

    Example:
        trends = [Trend(id="c1", name="Green Beauty", ...), ...]
        save_trends(trends)
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        for trend in trends:
            # Delete existing if present
            cursor.execute("DELETE FROM trend_category_exposure WHERE trend_id = ?", (trend.id,))
            cursor.execute("DELETE FROM trend_vc_exposure WHERE trend_id = ?", (trend.id,))
            cursor.execute("DELETE FROM trends WHERE id = ?", (trend.id,))

            # Insert trend
            cursor.execute(
                """
                INSERT INTO trends (
                    id, force, sub_category, name, description, direction,
                    impact, probability, start_year, normalized_score,
                    strategic_implication, data_source, source_type, confidence,
                    ai_suggested, user_override, scorer_count, score_variance,
                    debiasing_applied, impact_posterior, probability_posterior
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    trend.id,
                    trend.force,
                    trend.sub_category,
                    trend.name,
                    trend.description,
                    trend.direction,
                    trend.impact,
                    trend.probability,
                    trend.start_year,
                    trend.normalized_score,
                    trend.strategic_implication,
                    trend.data_source,
                    trend.source_type,
                    trend.confidence,
                    trend.ai_suggested,
                    trend.user_override,
                    trend.scorer_count,
                    trend.score_variance,
                    trend.debiasing_applied,
                    json.dumps(trend.impact_posterior) if trend.impact_posterior else None,
                    json.dumps(trend.probability_posterior) if trend.probability_posterior else None,
                ),
            )

            # Insert category exposures
            for category, score in trend.category_exposure.items():
                cursor.execute(
                    """
                    INSERT INTO trend_category_exposure (trend_id, category, exposure_score)
                    VALUES (?, ?, ?)
                    """,
                    (trend.id, category, score),
                )

            # Insert VC exposures
            for vc_step, score in trend.vc_exposure.items():
                cursor.execute(
                    """
                    INSERT INTO trend_vc_exposure (trend_id, vc_step, exposure_score)
                    VALUES (?, ?, ?)
                    """,
                    (trend.id, vc_step, score),
                )

            logger.debug(f"Saved trend: {trend.id}")

        conn.commit()
        logger.info(f"Saved {len(trends)} trends to database")


def load_trends() -> List[Trend]:
    """
    Load all trends from database.

    Returns:
        List of Trend objects with all exposures populated

    Example:
        trends = load_trends()
        for t in trends:
            print(f"{t.name}: {t.impact}x{t.probability}")
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Load all trends
        cursor.execute("SELECT * FROM trends")
        trend_rows = cursor.fetchall()

        trends = []
        for row in trend_rows:
            # Load category exposures
            cursor.execute(
                "SELECT category, exposure_score FROM trend_category_exposure WHERE trend_id = ?",
                (row["id"],),
            )
            cat_exposures = {r["category"]: r["exposure_score"] for r in cursor.fetchall()}

            # Load VC exposures
            cursor.execute(
                "SELECT vc_step, exposure_score FROM trend_vc_exposure WHERE trend_id = ?",
                (row["id"],),
            )
            vc_exposures = {r["vc_step"]: r["exposure_score"] for r in cursor.fetchall()}

            # Parse posteriors
            impact_posterior = (
                tuple(json.loads(row["impact_posterior"]))
                if row["impact_posterior"]
                else None
            )
            prob_posterior = (
                tuple(json.loads(row["probability_posterior"]))
                if row["probability_posterior"]
                else None
            )

            trend = Trend(
                id=row["id"],
                force=row["force"],
                sub_category=row["sub_category"],
                name=row["name"],
                description=row["description"],
                direction=row["direction"],
                impact=row["impact"],
                probability=row["probability"],
                start_year=row["start_year"],
                normalized_score=row["normalized_score"],
                strategic_implication=row["strategic_implication"],
                category_exposure=cat_exposures,
                vc_exposure=vc_exposures,
                data_source=row["data_source"],
                source_type=row["source_type"],
                confidence=row["confidence"],
                last_updated=datetime.fromisoformat(row["updated_at"]),
                ai_suggested=row["ai_suggested"],
                user_override=row["user_override"],
                scorer_count=row["scorer_count"],
                score_variance=row["score_variance"],
                debiasing_applied=row["debiasing_applied"],
                impact_posterior=impact_posterior,
                probability_posterior=prob_posterior,
            )
            trends.append(trend)

        logger.info(f"Loaded {len(trends)} trends from database")
        return trends


def get_trend_by_id(trend_id: str) -> Optional[Trend]:
    """
    Load a single trend by ID.

    Args:
        trend_id: Trend identifier

    Returns:
        Trend object or None if not found
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM trends WHERE id = ?", (trend_id,))
        row = cursor.fetchone()

        if not row:
            return None

        # Load exposures
        cursor.execute(
            "SELECT category, exposure_score FROM trend_category_exposure WHERE trend_id = ?",
            (trend_id,),
        )
        cat_exposures = {r["category"]: r["exposure_score"] for r in cursor.fetchall()}

        cursor.execute(
            "SELECT vc_step, exposure_score FROM trend_vc_exposure WHERE trend_id = ?",
            (trend_id,),
        )
        vc_exposures = {r["vc_step"]: r["exposure_score"] for r in cursor.fetchall()}

        impact_posterior = (
            tuple(json.loads(row["impact_posterior"]))
            if row["impact_posterior"]
            else None
        )
        prob_posterior = (
            tuple(json.loads(row["probability_posterior"]))
            if row["probability_posterior"]
            else None
        )

        return Trend(
            id=row["id"],
            force=row["force"],
            sub_category=row["sub_category"],
            name=row["name"],
            description=row["description"],
            direction=row["direction"],
            impact=row["impact"],
            probability=row["probability"],
            start_year=row["start_year"],
            normalized_score=row["normalized_score"],
            strategic_implication=row["strategic_implication"],
            category_exposure=cat_exposures,
            vc_exposure=vc_exposures,
            data_source=row["data_source"],
            source_type=row["source_type"],
            confidence=row["confidence"],
            last_updated=datetime.fromisoformat(row["updated_at"]),
            ai_suggested=row["ai_suggested"],
            user_override=row["user_override"],
            scorer_count=row["scorer_count"],
            score_variance=row["score_variance"],
            debiasing_applied=row["debiasing_applied"],
            impact_posterior=impact_posterior,
            probability_posterior=prob_posterior,
        )


# ── CAUSAL EDGES ────────────────────────────────────────────────────────

def save_causal_edges(edges: List[CausalEdge]) -> None:
    """
    Save causal DAG edges to database.

    Args:
        edges: List of CausalEdge objects

    Example:
        edges = [
            CausalEdge(source_force="Government", target_force="Technology",
                       propagation_weight=0.6, mechanism="..."),
            ...
        ]
        save_causal_edges(edges)
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Clear existing edges
        cursor.execute("DELETE FROM causal_edges")

        for edge in edges:
            cursor.execute(
                """
                INSERT INTO causal_edges (
                    source_force, target_force, propagation_weight,
                    lag_years, mechanism, evidence_strength, calibrated_from_backtest
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    edge.source_force,
                    edge.target_force,
                    edge.propagation_weight,
                    edge.lag_years,
                    edge.mechanism,
                    edge.evidence_strength,
                    edge.calibrated_from_backtest,
                ),
            )

        conn.commit()
        logger.info(f"Saved {len(edges)} causal edges to database")


def load_causal_edges() -> List[CausalEdge]:
    """
    Load all causal DAG edges from database.

    Returns:
        List of CausalEdge objects

    Example:
        edges = load_causal_edges()
        dag = CausalDAG(edges)
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT source_force, target_force, propagation_weight,
                   lag_years, mechanism, evidence_strength, calibrated_from_backtest
            FROM causal_edges
        """)

        edges = [
            CausalEdge(
                source_force=row["source_force"],
                target_force=row["target_force"],
                propagation_weight=row["propagation_weight"],
                lag_years=row["lag_years"],
                mechanism=row["mechanism"],
                evidence_strength=row["evidence_strength"],
                calibrated_from_backtest=row["calibrated_from_backtest"],
            )
            for row in cursor.fetchall()
        ]

        logger.info(f"Loaded {len(edges)} causal edges from database")
        return edges


# ── SIMULATION RUNS ────────────────────────────────────────────────────

def save_simulation_run(
    scenario: str,
    iterations: int,
    model_type: str,
    results: dict,
    causal_decomposition: Optional[dict] = None,
    allocation_recommendation: Optional[dict] = None,
    convergence_diagnostics: Optional[dict] = None,
    config_snapshot_id: Optional[int] = None,
) -> int:
    """
    Save a simulation run result to database.

    Args:
        scenario: Scenario name (e.g., "Base Case", "Green Squeeze")
        iterations: Number of MC iterations
        model_type: "deterministic", "bayesian_mc", or "copula_mc"
        results: Dict of {category: {year: {percentile: shift%}}}
        causal_decomposition: Optional causal breakdown
        allocation_recommendation: Optional optimal weights
        convergence_diagnostics: Optional R̂, ESS, etc.
        config_snapshot_id: Reference to config snapshot

    Returns:
        ID of the saved simulation run

    Example:
        run_id = save_simulation_run(
            scenario="Base Case",
            iterations=10000,
            model_type="bayesian_mc",
            results={...},
            convergence_diagnostics={"r_hat": 1.02}
        )
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            """
            INSERT INTO simulation_runs (
                scenario, iterations, model_type, results,
                causal_decomposition, allocation_recommendation,
                convergence_diagnostics, config_snapshot_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                scenario,
                iterations,
                model_type,
                json.dumps(results),
                json.dumps(causal_decomposition) if causal_decomposition else None,
                json.dumps(allocation_recommendation) if allocation_recommendation else None,
                json.dumps(convergence_diagnostics) if convergence_diagnostics else None,
                config_snapshot_id,
            ),
        )

        run_id = cursor.lastrowid
        conn.commit()
        logger.info(f"Saved simulation run {run_id}: {scenario} ({iterations} iterations)")

        return run_id


def load_simulation_runs(
    limit: int = 100, scenario: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Load simulation runs from database.

    Args:
        limit: Maximum number of runs to return
        scenario: Filter by scenario name (optional)

    Returns:
        List of simulation run records

    Example:
        runs = load_simulation_runs(limit=50)
        latest = load_simulation_runs(scenario="Base Case", limit=1)
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        if scenario:
            cursor.execute(
                """
                SELECT id, run_date, scenario, iterations, model_type,
                       results, causal_decomposition, allocation_recommendation,
                       convergence_diagnostics
                FROM simulation_runs
                WHERE scenario = ?
                ORDER BY run_date DESC
                LIMIT ?
                """,
                (scenario, limit),
            )
        else:
            cursor.execute(
                """
                SELECT id, run_date, scenario, iterations, model_type,
                       results, causal_decomposition, allocation_recommendation,
                       convergence_diagnostics
                FROM simulation_runs
                ORDER BY run_date DESC
                LIMIT ?
                """,
                (limit,),
            )

        runs = []
        for row in cursor.fetchall():
            run = {
                "id": row["id"],
                "run_date": datetime.fromisoformat(row["run_date"]),
                "scenario": row["scenario"],
                "iterations": row["iterations"],
                "model_type": row["model_type"],
                "results": json.loads(row["results"]) if row["results"] else {},
                "causal_decomposition": (
                    json.loads(row["causal_decomposition"])
                    if row["causal_decomposition"]
                    else None
                ),
                "allocation_recommendation": (
                    json.loads(row["allocation_recommendation"])
                    if row["allocation_recommendation"]
                    else None
                ),
                "convergence_diagnostics": (
                    json.loads(row["convergence_diagnostics"])
                    if row["convergence_diagnostics"]
                    else None
                ),
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
    """
    Log an action to the audit trail.

    Args:
        action: Action name (e.g., "CREATE", "UPDATE", "DELETE")
        entity_type: Entity being modified (e.g., "trend", "config")
        entity_id: ID of entity
        old_value: Previous value (optional)
        new_value: New value (optional)
        reason: Why this change was made (optional)
        user_id: User who made the change (default: "system")

    Example:
        log_audit("UPDATE", "trend", "c1", old_value="5", new_value="4",
                  reason="Delphi consensus", user_id="john_doe")
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            """
            INSERT INTO audit_log (
                action, entity_type, entity_id, old_value, new_value, reason, user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (action, entity_type, entity_id, old_value, new_value, reason, user_id),
        )

        conn.commit()


def get_audit_log(
    limit: int = 100, entity_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Get audit log entries.

    Args:
        limit: Maximum entries to return
        entity_type: Filter by entity type (optional)

    Returns:
        List of audit log records

    Example:
        logs = get_audit_log(limit=50)
        trend_logs = get_audit_log(entity_type="trend")
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        if entity_type:
            cursor.execute(
                """
                SELECT id, timestamp, action, entity_type, entity_id,
                       old_value, new_value, reason, user_id
                FROM audit_log
                WHERE entity_type = ?
                ORDER BY timestamp DESC
                LIMIT ?
                """,
                (entity_type, limit),
            )
        else:
            cursor.execute(
                """
                SELECT id, timestamp, action, entity_type, entity_id,
                       old_value, new_value, reason, user_id
                FROM audit_log
                ORDER BY timestamp DESC
                LIMIT ?
                """,
                (limit,),
            )

        logs = [
            {
                "id": row["id"],
                "timestamp": datetime.fromisoformat(row["timestamp"]),
                "action": row["action"],
                "entity_type": row["entity_type"],
                "entity_id": row["entity_id"],
                "old_value": row["old_value"],
                "new_value": row["new_value"],
                "reason": row["reason"],
                "user_id": row["user_id"],
            }
            for row in cursor.fetchall()
        ]

        return logs


# ── Database Health & Stats ────────────────────────────────────────────

def get_db_stats() -> Dict[str, int]:
    """
    Get database statistics (record counts per table).

    Returns:
        Dict of {table_name: record_count}

    Example:
        stats = get_db_stats()
        print(f"Database has {stats['trends']} trends")
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        tables = [
            "trends",
            "causal_edges",
            "competitors",
            "simulation_runs",
            "backtest_results",
            "delphi_rounds",
            "triggers",
            "ai_suggestions",
            "audit_log",
        ]

        stats = {}
        for table in tables:
            cursor.execute(f"SELECT COUNT(*) as count FROM {table}")
            stats[table] = cursor.fetchone()["count"]

        return stats


if __name__ == "__main__":
    # Quick test
    init_db()
    stats = get_db_stats()
    print("Database statistics:")
    for table, count in stats.items():
        print(f"  {table}: {count}")
