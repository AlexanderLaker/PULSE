"""Shared fixtures for PRISM test suite."""

import pytest
import numpy as np
from datetime import datetime

from pulse.config import ModelConfig, CATEGORIES, FORCES, VC_STEPS
from pulse.ingestion.models import Trend, TrendDatabase


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
    # Populate category and VC exposures
    for cat in CATEGORIES:
        trend.category_exposure[cat] = 2 if "Hair" in cat else 1
    for vc in VC_STEPS:
        trend.vc_exposure[vc] = 2
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
    for vc in VC_STEPS:
        consumer_trend.vc_exposure[vc] = 2
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
    for vc in VC_STEPS:
        gov_trend.vc_exposure[vc] = 3
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
    for vc in VC_STEPS:
        tech_trend.vc_exposure[vc] = 2
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
    for vc in VC_STEPS:
        env_trend.vc_exposure[vc] = 3
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
    for vc in VC_STEPS:
        comp_trend.vc_exposure[vc] = 1
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
    )
    return config


# (The former `deterministic_shift_matrix` and `shift_matrix_with_percentiles`
#  fixtures were removed in the July 2026 handover review — their only
#  consumer was the deleted allocation-optimizer suite (D4).)
