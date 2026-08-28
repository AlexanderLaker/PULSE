"""Shared fixtures for PRISM test suite."""

import pytest
import numpy as np
from datetime import datetime

from pulse.config import ModelConfig, CATEGORIES, FORCES, VC_STEPS, REGIONS
from pulse.ingestion.models import Trend, TrendDatabase


def _reg(europe: int, na: int, asia: int, high_growth: int) -> dict:
    """Regional exposure profile (0–5 per region), REGIONS order (2.10.0, F1).

    The engine's shift math is now 3D (category × region × year): a trend hits
    a (category, region) cell weighted by region_exposure/5. The fixture trends
    carry DISTINCT regional profiles so the golden pins exercise the region
    roll-up (and no ``regional_exposure_coverage`` integrity event fires).
    """
    return dict(zip(REGIONS, (europe, na, asia, high_growth)))


def _canonical_vc(stage: int) -> dict:
    """Canonical 5/3/1 epicentre profile for a 1-based stage.

    Mirror of ``canonicalVcProfile`` in components/dashboard/Trends2.tsx —
    the serialization the epicentre slider writes. Used so the fixture
    trends carry realistic 2.9.0-era VC profiles with DISTINCT epicentres
    (the engine's VC lens is a categorical partition; identical epicentres
    couldn't catch a stage-mixup regression).
    """
    falloff = [5, 3, 1]
    return {
        s: (falloff[abs(i + 1 - stage)] if abs(i + 1 - stage) < len(falloff) else 0)
        for i, s in enumerate(VC_STEPS)
    }


@pytest.fixture
def mock_trend() -> Trend:
    """Create a single mock trend for basic testing."""
    trend = Trend(
        id="test_trend_01",
        force="Consumer",
        sub_category="Trends",
        name="Test Natural Movement",
        description="Test trend about natural products",
        direction="Expansion",
        gp1_pct_affected=0.15,
        probability=4,
        start_year=2025,
        data_source="test",
        source_type="test",
        confidence="High",
    )
    # Populate category and VC exposures. The VC profile is deliberately a
    # LEGACY-shaped flat grid (pre-slider expert scoring): 2.9.0 collapses
    # it through vc_epicentre_of — flat profiles tie at every stage and
    # resolve toward the exposure-weighted centroid (stage 4, "Packaging"),
    # exercising the legacy-collapse path.
    for cat in CATEGORIES:
        trend.category_exposure[cat] = 2 if "Hair" in cat else 1
    for vc in VC_STEPS:
        trend.vc_exposure[vc] = 2
    trend.regional_exposure = _reg(5, 3, 2, 2)
    return trend


@pytest.fixture
def mock_trends_database(mock_trend) -> TrendDatabase:
    """Create a mock TrendDatabase with 5 sample trends across different forces."""
    trends = []

    # Consumer force
    # L29 (July 2026 review): exposures deliberately DIFFER between
    # "Hair: Color" (3) and "Hair: Care" (2) so no two golden-pinned
    # categories are numerically identical — identical pins couldn't
    # distinguish a category-mixup regression from a pass.
    consumer_trend = Trend(
        id="consumer_01",
        force="Consumer",
        name="Natural/Clean Beauty",
        description="Growing demand for natural products",
        direction="Expansion",
        gp1_pct_affected=0.20,
        probability=4,
        start_year=2025,
        data_source="test",
    )
    for cat in CATEGORIES:
        if cat == "Hair: Color":
            consumer_trend.category_exposure[cat] = 3
        elif "Hair" in cat:
            consumer_trend.category_exposure[cat] = 2
        else:
            consumer_trend.category_exposure[cat] = 1
    # 2.9.0 VC-epicentre fixture profiles: canonical slider serializations
    # with DISTINCT stages (plus one deliberate collision, Technology +
    # Competitive both at Commercial, so the partition's grouping is
    # exercised). vc_exposure feeds ONLY the VC attribution lens — never
    # the shift math — so these assignments leave the golden pins intact.
    consumer_trend.vc_exposure = _canonical_vc(6)   # epicentre: Marketing
    consumer_trend.regional_exposure = _reg(5, 3, 2, 2)   # Europe-heavy
    trends.append(consumer_trend)

    # Government force — carries a per-trend materialization schedule
    # (peak_year + diffusion curve) so the golden pins exercise
    # compute_materialization_schedule, not only the force-level fallback.
    gov_trend = Trend(
        id="government_01",
        force="Government",
        name="Microplastics Ban",
        description="Regulatory restrictions on microplastics",
        direction="Contraction",
        gp1_pct_affected=0.25,
        probability=4,
        start_year=2026,
        peak_year=2028,
        diffusion_curve="s_curve",
        data_source="test",
    )
    for cat in CATEGORIES:
        gov_trend.category_exposure[cat] = 2 if "Body" in cat or "Styling" in cat else 3
    gov_trend.vc_exposure = _canonical_vc(2)        # epicentre: Formulation
    gov_trend.regional_exposure = _reg(5, 4, 1, 2)  # EU regulatory, low Asia
    trends.append(gov_trend)

    # Technology force
    tech_trend = Trend(
        id="technology_01",
        force="Technology",
        name="AI Personalization",
        description="AI-driven personalized beauty recommendations",
        direction="Expansion",
        gp1_pct_affected=0.12,
        probability=3,
        start_year=2026,
        data_source="test",
    )
    for cat in CATEGORIES:
        tech_trend.category_exposure[cat] = 2
    tech_trend.vc_exposure = _canonical_vc(7)       # epicentre: Commercial
    tech_trend.regional_exposure = _reg(3, 5, 4, 2)  # NA/Asia tech-led
    trends.append(tech_trend)

    # Environmental force
    env_trend = Trend(
        id="environmental_01",
        force="Environmental",
        name="Water Scarcity",
        description="Water stress impacts manufacturing",
        direction="Contraction",
        gp1_pct_affected=0.08,
        probability=3,
        start_year=2027,
        data_source="test",
    )
    for cat in CATEGORIES:
        env_trend.category_exposure[cat] = 2
    env_trend.vc_exposure = _canonical_vc(3)        # epicentre: Manufacturing
    env_trend.regional_exposure = _reg(4, 3, 3, 4)  # broad, High-Growth tilt
    trends.append(env_trend)

    # Competitive force
    comp_trend = Trend(
        id="competitive_01",
        force="Competitive",
        name="Private Label Growth",
        description="Rising private label competition",
        direction="Contraction",
        gp1_pct_affected=0.15,
        probability=4,
        start_year=2025,
        data_source="test",
    )
    for cat in CATEGORIES:
        comp_trend.category_exposure[cat] = 3
    comp_trend.vc_exposure = _canonical_vc(7)       # epicentre: Commercial (collides with tech)
    comp_trend.regional_exposure = _reg(5, 2, 2, 1)  # Europe PL pressure
    trends.append(comp_trend)

    db = TrendDatabase(
        trends=trends,
        categories=CATEGORIES,
        forces=FORCES,
        source_file="test.xlsx",
        financial_data_detected=False,
    )
    return db


@pytest.fixture
def mock_model_config() -> ModelConfig:
    """Create a mock ModelConfig with default parameters.

    v3.2: scalar `attenuation` removed. Uses the calibrated per-force
    dict that ships in DEFAULT_PER_FORCE_ATTENUATION.
    """
    config = ModelConfig(
        region="Global",
        aggregation_method="Multiplicative",
        # per_force_attenuation defaults to DEFAULT_PER_FORCE_ATTENUATION
        attenuation_source="calibrated_v3.5_april2026",
        base_year=2025,
        path_years=[2026, 2027, 2028, 2029, 2030],
        iterations=1000,
        # F4 (2.10.0): pin the golden fixture with jitter OFF so the pins are
        # the pure deterministic-schedule compounding result (stable across
        # numpy RNG versions). Peak-year jitter has its own dedicated test;
        # production runs use the ModelConfig default (peak_year_jitter=1).
        peak_year_jitter=0,
    )
    return config


# (The former `deterministic_shift_matrix` and `shift_matrix_with_percentiles`
#  fixtures were removed in the July 2026 handover review — their only
#  consumer was the deleted allocation-optimizer suite (D4).)
