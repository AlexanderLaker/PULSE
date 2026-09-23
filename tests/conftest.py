"""Shared fixtures: a small, deliberately varied driver set and a fast configuration."""
import os

# The suite runs on a throwaway SQLite file. prism.database fixes its backend
# when it is first imported, and scripts under test load .env, so the database
# URLs are blanked before any prism import: a production URL in .env can never
# reach a test that writes. PRISM_TEST_ALLOW_POSTGRES=1 opts out on purpose.
if os.environ.get("PRISM_TEST_ALLOW_POSTGRES") != "1":
    os.environ["DATABASE_URL"] = ""
    os.environ["POSTGRES_URL"] = ""
    if not os.environ.get("PRISM_DB_PATH"):
        import tempfile
        os.environ["PRISM_DB_PATH"] = os.path.join(tempfile.mkdtemp(prefix="prism-tests-"), "prism.db")

import pytest  # noqa: E402

from prism.config import CATEGORIES, REGIONS, ModelConfig  # noqa: E402
from prism.drivers import Driver, DriverSet  # noqa: E402


def regions(europe: int, north_america: int, asia: int, high_growth: int) -> dict:
    """A regional exposure profile (0-5 per region) in REGIONS order."""
    return dict(zip(REGIONS, (europe, north_america, asia, high_growth)))


@pytest.fixture
def mock_driver() -> Driver:
    """One fully scored driver."""
    driver = Driver(
        id="test_driver_01", force="Consumer", name="Test natural movement",
        description="A test driver about natural products", direction="Expansion",
        gp1_pct_affected=0.15, probability=4, start_year=2025, peak_year=2029, diffusion_curve="linear",
        uncertainty=2, confidence="High", vc_epicentre="Packaging",
    )
    driver.category_exposure = {c: (2 if "Hair" in c else 1) for c in CATEGORIES}
    driver.regional_exposure = regions(5, 3, 2, 2)
    return driver


@pytest.fixture
def mock_driver_set() -> DriverSet:
    """Five drivers, one per force except Customer, built so the golden pins can
    tell categories, regions, schedules and value-chain stages apart.

    - No two pinned categories are numerically identical ("Hair: Color" and
      "Hair: Care" carry different exposures), so a category mix-up fails.
    - Each driver has its own onset, peak year and diffusion curve (all five
      curves appear) and its own uncertainty score, so the pins exercise every
      curve of compute_materialization_schedule and several prior
      concentrations.
    - Every driver has a distinct regional profile, so the region roll-up and
      the region lens are exercised.
    - The value-chain epicentres are distinct except Technology and Competitive,
      which share Commercial, so the attribution lens groups a stage. The value
      chain feeds only that lens, never the shift.
    """
    consumer = Driver(id="consumer_01", force="Consumer", name="Natural/Clean Beauty",
                      description="Growing demand for natural products", direction="Expansion",
                      gp1_pct_affected=0.20, probability=4, start_year=2025, peak_year=2029,
                      diffusion_curve="front_loaded", uncertainty=2)
    consumer.category_exposure = {c: (3 if c == "Hair: Color" else 2 if "Hair" in c else 1) for c in CATEGORIES}
    consumer.vc_epicentre = "Marketing"
    consumer.regional_exposure = regions(5, 3, 2, 2)  # Europe-heavy

    government = Driver(id="government_01", force="Government", name="Microplastics Ban",
                        description="Regulatory restrictions on microplastics", direction="Contraction",
                        gp1_pct_affected=0.25, probability=4, start_year=2026, peak_year=2028,
                        diffusion_curve="s_curve", uncertainty=1)
    government.category_exposure = {c: (2 if "Body" in c or "Styling" in c else 3) for c in CATEGORIES}
    government.vc_epicentre = "Formulation"
    government.regional_exposure = regions(5, 4, 1, 2)  # EU regulation, low Asia

    technology = Driver(id="technology_01", force="Technology", name="AI Personalization",
                        description="AI-driven personalised beauty recommendations", direction="Expansion",
                        gp1_pct_affected=0.12, probability=3, start_year=2026, peak_year=2030,
                        diffusion_curve="back_loaded", uncertainty=3)
    technology.category_exposure = {c: 2 for c in CATEGORIES}
    technology.vc_epicentre = "Commercial"
    technology.regional_exposure = regions(3, 5, 4, 2)  # North America and Asia led

    environmental = Driver(id="environmental_01", force="Environmental", name="Water Scarcity",
                           description="Water stress affects manufacturing", direction="Contraction",
                           gp1_pct_affected=0.08, probability=3, start_year=2027, peak_year=2030,
                           diffusion_curve="linear", uncertainty=4)
    environmental.category_exposure = {c: 2 for c in CATEGORIES}
    environmental.vc_epicentre = "Manufacturing"
    environmental.regional_exposure = regions(4, 3, 3, 4)  # broad, High Growth tilt

    competitive = Driver(id="competitive_01", force="Competitive", name="Private Label Growth",
                         description="Rising private label competition", direction="Contraction",
                         gp1_pct_affected=0.15, probability=4, start_year=2025, peak_year=2027,
                         diffusion_curve="step_function", uncertainty=2)
    competitive.category_exposure = {c: 3 for c in CATEGORIES}
    competitive.vc_epicentre = "Commercial"  # shared with Technology
    competitive.regional_exposure = regions(5, 2, 2, 1)  # European private label

    for d in (consumer, government, technology, environmental, competitive):
        d.recompute()
    return DriverSet(drivers=[consumer, government, technology, environmental, competitive])


@pytest.fixture
def mock_model_config() -> ModelConfig:
    """The default configuration on a five-year path.

    Peak-year jitter is off, so the golden pins are the deterministic-schedule
    result and stay stable across numpy versions; the jitter has its own tests.
    """
    return ModelConfig(path_years=[2026, 2027, 2028, 2029, 2030], peak_year_jitter=False)
