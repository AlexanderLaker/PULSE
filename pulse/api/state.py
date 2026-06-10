"""Shared application state — extracted from pulse/api/app.py (June 2026 split, review F4).
Behavior-identical move; see app.py for assembly.
"""
import asyncio
import logging

from pulse.config import ModelConfig, CATEGORIES, FORCES
from pulse.ingestion.models import Trend, TrendDatabase

logger = logging.getLogger(__name__)

_state = {
    "db": None,
    "config": None,
    "mc_result": None,
    "audit": None,
}
_state_lock = asyncio.Lock()  # Protect concurrent mutations


def _load_trend_database() -> TrendDatabase:
    """Load trends from the Postgres/SQLite database into a TrendDatabase object.

    Only auto-seeds if the database is completely empty (first run).
    Use POST /api/v1/trends/sync to explicitly add missing trends.
    """
    from pulse.database import load_trends, save_trends
    db_trends = load_trends()

    if not db_trends:
        logger.info("Database empty — seeding with Intelligence Report trends...")
        try:
            from pulse.seed_trends import get_report_trends
            seed_trends = get_report_trends()
            save_trends(seed_trends)
            db_trends = load_trends()
            logger.info(f"Seeded {len(db_trends)} trends from Intelligence Report")
        except Exception as e:
            logger.error(f"Auto-seed failed: {e}")

    logger.info(f"Loaded {len(db_trends)} trends from database")
    return TrendDatabase(
        trends=db_trends,
        categories=CATEGORIES,
        forces=FORCES,
        source_file="database",
    )


def _backfill_diffusion_fields(db) -> None:
    """
    One-time migration: assign logical peak_year and diffusion_curve to
    existing trends that still have the default (0 / 's_curve').

    Heuristics by force type:
      Government  → front_loaded, peak 2028 (regulation kicks in fast)
      Technology  → back_loaded, peak 2030 (slow adoption then scale)
      Consumer    → s_curve, peak 2029 (classic diffusion of preferences)
      Customer    → linear, peak 2030 (gradual channel evolution)
      Environmental → s_curve, peak 2030 (awareness tipping point)
      Competitive → front_loaded, peak 2029 (competitors react within 1-2 years)

    Trends with keywords like "ban", "phase-out", "regulation" get step_function.
    Already-set trends (peak_year != 0) are left untouched.
    """
    changed = []
    step_keywords = ["ban", "phase-out", "phase out", "prohibition", "deadline", "effective date", "mandatory"]
    force_defaults = {
        "Government":    ("front_loaded", 2028),
        "Technology":    ("back_loaded",  2030),
        "Consumer":      ("s_curve",      2029),
        "Customer":      ("linear",       2030),
        "Environmental": ("s_curve",      2030),
        "Competitive":   ("front_loaded", 2029),
    }
    for trend in db.trends:
        if getattr(trend, 'peak_year', 0) not in (0, None):
            continue  # already set by user
        curve, peak = force_defaults.get(trend.force, ("s_curve", 2030))
        # Override: step_function for hard regulatory deadlines
        desc_lower = (trend.description or "").lower() + (trend.name or "").lower()
        if any(kw in desc_lower for kw in step_keywords):
            curve = "step_function"
            peak = 2028
        # Override: high-probability trends peak sooner
        if trend.probability >= 5 and peak > 2028:
            peak = peak - 1
        trend.peak_year = peak
        trend.diffusion_curve = curve
        changed.append(trend)

    if changed:
        try:
            from pulse.database import save_trends
            save_trends(changed)
            logger.info(f"Backfilled peak_year/diffusion_curve for {len(changed)} trends")
        except Exception as e:
            logger.warning(f"Failed to backfill diffusion fields: {e}")


def get_state_snapshot() -> dict:
    """Read-only snapshot accessor for routers (analytics, etc.).

    Replaces the former circular `from pulse.api.app import _state`
    pattern — import from pulse.api.state instead.
    """
    return {
        "db": _state.get("db"),
        "config": _state.get("config"),
        "dag": _state.get("dag"),
        "mc_result": _state.get("mc_result"),
    }
