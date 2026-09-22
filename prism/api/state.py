"""Shared application state — extracted from prism/api/app.py (June 2026 split, review F4).
Behavior-identical move; see app.py for assembly.
"""
import asyncio
import logging

from prism.config import ModelConfig, CATEGORIES, FORCES
from prism.drivers import Driver, DriverSet

logger = logging.getLogger(__name__)

_state = {
    "db": None,
    "config": None,
    "mc_result": None,
    "audit": None,
}
_state_lock = asyncio.Lock()  # Protect concurrent mutations


def _load_driver_set() -> DriverSet:
    """Load trends from the Postgres/SQLite database into a TrendDatabase object.

    Only auto-seeds if the database is completely empty (first run).
    Use POST /api/v1/drivers/sync to explicitly add missing trends.
    """
    from prism.database import load_drivers, save_drivers
    db_drivers = load_drivers()

    if not db_drivers:
        logger.info("Database empty — seeding with Intelligence Report trends...")
        try:
            from prism.seed_drivers import get_seed_drivers
            seed_drivers = get_seed_drivers()
            save_drivers(seed_drivers)
            db_drivers = load_drivers()
            logger.info(f"Seeded {len(db_drivers)} trends from Intelligence Report")
        except Exception as e:
            logger.error(f"Auto-seed failed: {e}")

    logger.info(f"Loaded {len(db_drivers)} trends from database")
    return DriverSet(
        drivers=db_drivers,
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
    for driver in db.drivers:
        if getattr(driver, 'peak_year', 0) not in (0, None):
            continue  # already set by user
        curve, peak = force_defaults.get(driver.force, ("s_curve", 2030))
        # Override: step_function for hard regulatory deadlines
        desc_lower = (driver.description or "").lower() + (driver.name or "").lower()
        if any(kw in desc_lower for kw in step_keywords):
            curve = "step_function"
            peak = 2028
        # Override: high-probability trends peak sooner
        if driver.probability >= 5 and peak > 2028:
            peak = peak - 1
        driver.peak_year = peak
        driver.diffusion_curve = curve
        changed.append(driver)

    if changed:
        try:
            from prism.database import save_drivers
            save_drivers(changed)
            logger.info(f"Backfilled peak_year/diffusion_curve for {len(changed)} trends")
        except Exception as e:
            logger.warning(f"Failed to backfill diffusion fields: {e}")


def get_state_snapshot() -> dict:
    """Read-only snapshot accessor for routers (analytics, etc.).

    Replaces the former circular `from prism.api.app import _state`
    pattern — import from prism.api.state instead.
    """
    return {
        "db": _state.get("db"),
        "config": _state.get("config"),
        "dag": _state.get("dag"),
        "mc_result": _state.get("mc_result"),
    }
