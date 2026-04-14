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
        consumer_trend.category_exposure[cat] = 3 if "Hair" in cat else 1
    for vc in VC_STEPS:
        consumer_trend.vc_exposure[vc] = 2
    trends.append(consumer_trend)

    # Government force
    gov_trend = Trend(
        id="government_01",
        force="Government",
        name="Microplastics Ban",
        description="Regulatory restrictions on microplastics",
        direction="Contraction",
        gp1_pct_affected=0.25,
        probability=4,
        start_year=2026,
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
    """Create a mock ModelConfig with default parameters."""
    config = ModelConfig(
        region="Global",
        aggregation_method="Multiplicative",
        attenuation=0.5,
        attenuation_source="assumed",
        neutral_threshold=0.001,
        base_year=2025,
        path_years=[2026, 2027, 2028, 2029, 2030],
        iterations=1000,
    )
    return config


@pytest.fixture
def deterministic_shift_matrix() -> dict:
    """Create a sample deterministic shift matrix for testing optimizer."""
    return {
        "Hair: Color": {
            "path": {
                2026: {"median": -0.001},
                2027: {"median": -0.003},
                2028: {"median": -0.005},
                2029: {"median": -0.008},
                2030: {"median": -0.010},
            }
        },
        "Hair: Care": {
            "path": {
                2026: {"median": 0.002},
                2027: {"median": 0.005},
                2028: {"median": 0.008},
                2029: {"median": 0.010},
                2030: {"median": 0.012},
            }
        },
        "Hair: Styling": {
            "path": {
                2026: {"median": 0.000},
                2027: {"median": 0.001},
                2028: {"median": 0.001},
                2029: {"median": 0.002},
                2030: {"median": 0.002},
            }
        },
        "Hair: Body": {
            "path": {
                2026: {"median": 0.001},
                2027: {"median": 0.002},
                2028: {"median": 0.003},
                2029: {"median": 0.003},
                2030: {"median": 0.004},
            }
        },
        "LHC: FCN": {
            "path": {
                2026: {"median": 0.005},
                2027: {"median": 0.010},
                2028: {"median": 0.015},
                2029: {"median": 0.020},
                2030: {"median": 0.025},
            }
        },
        "LHC: FCA": {
            "path": {
                2026: {"median": -0.001},
                2027: {"median": -0.002},
                2028: {"median": -0.004},
                2029: {"median": -0.005},
                2030: {"median": -0.006},
            }
        },
        "LHC: FFI": {
            "path": {
                2026: {"median": 0.003},
                2027: {"median": 0.006},
                2028: {"median": 0.009},
                2029: {"median": 0.012},
                2030: {"median": 0.015},
            }
        },
        "LHC: LAD": {
            "path": {
                2026: {"median": 0.002},
                2027: {"median": 0.004},
                2028: {"median": 0.006},
                2029: {"median": 0.008},
                2030: {"median": 0.010},
            }
        },
        "LHC: HDW": {
            "path": {
                2026: {"median": 0.001},
                2027: {"median": 0.002},
                2028: {"median": 0.003},
                2029: {"median": 0.004},
                2030: {"median": 0.005},
            }
        },
        "LHC: ADW": {
            "path": {
                2026: {"median": 0.004},
                2027: {"median": 0.008},
                2028: {"median": 0.012},
                2029: {"median": 0.016},
                2030: {"median": 0.020},
            }
        },
        "LHC: HSC": {
            "path": {
                2026: {"median": -0.002},
                2027: {"median": -0.004},
                2028: {"median": -0.006},
                2029: {"median": -0.008},
                2030: {"median": -0.010},
            }
        },
        "LHC: IC": {
            "path": {
                2026: {"median": 0.000},
                2027: {"median": 0.000},
                2028: {"median": 0.001},
                2029: {"median": 0.001},
                2030: {"median": 0.001},
            }
        },
    }


@pytest.fixture
def shift_matrix_with_percentiles() -> dict:
    """Create a shift matrix with full percentile distribution."""
    return {
        "Hair: Color": {
            2030: {
                "p10": -0.020,
                "p25": -0.015,
                "median": -0.010,
                "p75": -0.005,
                "p90": -0.001,
                "std": 0.007,
            }
        },
        "Hair: Care": {
            2030: {
                "p10": 0.005,
                "p25": 0.010,
                "median": 0.015,
                "p75": 0.020,
                "p90": 0.025,
                "std": 0.007,
            }
        },
    }
