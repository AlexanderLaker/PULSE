"""The dashboard's copies of the model's taxonomies and horizon, of the driver request shapes and of
the Consumer Journey tile shape.

The dashboard reads and writes forces, categories, regions, value-chain
stages, directions, confidence levels, diffusion curves and source tiers by
name, and the API refuses a name that is not the model's; it lays out the
matrix by the path years, and its editor checks a source's link and lengths as
the API will. Its copies (lib/format.ts, lib/valueChain.ts, types/index.ts,
components/dashboard/drivers/shared.ts) must therefore hold the values of
prism/config.py and prism/drivers.py, in the same order. The PRISM Analysis
names the categories with the labels the page shows (prism/readings.py). The
driver types (types/drivers.ts) name the fields of the scores and of the two
request bodies the API accepts (prism/api/schemas.py). The estimate's label,
the earliest peak year and the token secret's minimum length are decided on
both sides. Likewise the journey tile map the dashboard renders and saves
(data/consumerJourney.ts) must be the shape the API stores (prism/journey.py),
and the Explorer's view ids, kinds, grades and denominations
(lib/profitPoolData.ts) the ones the content generator checks
(prism/explorer.py).
"""
import re
from pathlib import Path

from prism.config import (BASE_YEAR, CATEGORIES, DEFAULT_PATH_YEARS, FORCES, REGIONS, VALID_DIFFUSION_CURVES,
                          VC_STAGES, first_peak_year)
from prism.drivers import CONFIDENCE_LEVELS, DIRECTIONS, SOURCE_FIELD_LIMITS, SOURCE_TIERS, SOURCE_URL_PATTERN
from prism.explorer import (DENOMINATIONS, GRADES, GROUPS, ITEM_KEYS, KINDS, OPTIONAL_ITEM_KEYS, OPTIONAL_SOURCE_KEYS,
                            SOURCE_KEYS, VIEW_IDS, VIEW_KEYS)
from prism.journey import (CONTEXT_KEYS, INTENSITIES, JOURNEYS, OPTIONAL_TILE_KEYS, POOL_IMPACT_GRADES,
                           POOL_IMPACT_KEYS, PROVENANCE_GRADES, PROVENANCE_KEYS, STAGE_KEYS, TILE_KEYS, TILE_TYPES)
from prism.readings import CATEGORY_SHORT, CURVE_NAMES

REPO = Path(__file__).resolve().parents[1]
FORMAT = (REPO / "lib" / "format.ts").read_text(encoding="utf-8")
VALUE_CHAIN = (REPO / "lib" / "valueChain.ts").read_text(encoding="utf-8")
JOURNEY = (REPO / "data" / "consumerJourney.ts").read_text(encoding="utf-8")
POOLS = (REPO / "lib" / "profitPoolData.ts").read_text(encoding="utf-8")
TYPES = (REPO / "types" / "index.ts").read_text(encoding="utf-8")
DRIVER_PARTS = (REPO / "components" / "dashboard" / "drivers" / "shared.ts").read_text(encoding="utf-8")


def quoted(source: str, declaration: str) -> list:
    """The quoted strings of one array declaration, in order."""
    match = re.search(re.escape(declaration) + r"\s*\[(.*?)\]", source, re.S)
    assert match, declaration
    return re.findall(r"'([^']+)'", match.group(1))


def test_forces():
    assert quoted(FORMAT, "export const FORCES: ForceName[] =") == FORCES


def test_categories():
    block = re.search(r"export const CATEGORIES: CategoryDefinition\[\] = \[(.*?)\n\];", FORMAT, re.S)
    assert block
    assert re.findall(r"\{ name: '([^']+)'", block.group(1)) == CATEGORIES


def test_regions():
    assert quoted(FORMAT, "export const REGIONS: string[] =") == REGIONS


def test_category_names_in_the_readings():
    """The PRISM Analysis names a category with the page's label in lower case, a hair category in
    full, as categoryFullName in lib/format.ts does."""
    block = re.search(r"export const CATEGORIES: CategoryDefinition\[\] = \[(.*?)\n\];", FORMAT, re.S).group(1)
    labels = dict(re.findall(r"\{ name: '([^']+)',\s+label: '([^']+)'", block))
    assert list(CATEGORY_SHORT) == CATEGORIES == list(labels)
    for name, label in labels.items():
        full = label if name.startswith("LHC") else ("Body care" if label == "Body" else f"Hair {label}")
        assert CATEGORY_SHORT[name] == full.lower(), name
    rule = re.search(r"export function categoryFullName\(name: string\): string \{(.*?)\n\}", FORMAT, re.S).group(1)
    assert "if (group === 'LHC') return label;" in rule
    assert "return label === 'Body' ? 'Body Care' : `Hair ${label}`;" in rule


def test_directions_and_confidence_levels():
    assert tuple(quoted(FORMAT, "export const DIRECTIONS: Direction[] =")) == DIRECTIONS == union(TYPES, "Direction")
    assert (tuple(quoted(FORMAT, "export const CONFIDENCE_LEVELS: Confidence[] ="))
            == CONFIDENCE_LEVELS == union(TYPES, "Confidence"))


def test_diffusion_curves():
    """The editor offers the curves the engine knows (the keys of DIFFUSION_LABELS), and the readings name each."""
    block = re.search(r"export const DIFFUSION_LABELS[^=]*= \{(.*?)\n\};", DRIVER_PARTS, re.S).group(1)
    assert re.findall(r"^\s*(\w+):", block, re.M) == VALID_DIFFUSION_CURVES
    assert set(CURVE_NAMES) == set(VALID_DIFFUSION_CURVES)


def test_value_chain_stages():
    assert quoted(VALUE_CHAIN, "export const VC_STAGES =") == VC_STAGES
    assert len(quoted(VALUE_CHAIN, "export const VC_SHORT_LABELS =")) == len(VC_STAGES)


def test_horizon():
    assert re.search(r"export const BASE_YEAR = (\d{4});", FORMAT).group(1) == str(BASE_YEAR)
    years = re.search(r"export const YEARS: number\[\] = \[([^\]]*)\];", FORMAT).group(1)
    assert [int(y) for y in years.split(",")] == list(DEFAULT_PATH_YEARS)


def test_the_rules_both_sides_apply():
    """The estimate's label, the earliest peak year and the token secret's minimum length: the
    dashboard and the API decide these the same way."""
    from prism.api.auth import MIN_SECRET_LENGTH
    from prism.config import ESTIMATE_SOURCE_PREFIX
    cell_weights = (REPO / "lib" / "cellWeights.ts").read_text(encoding="utf-8")
    prefix = re.search(r"export const ESTIMATE_SOURCE_PREFIX = '([^']+)';", cell_weights).group(1)
    assert prefix == ESTIMATE_SOURCE_PREFIX
    # prism/config.py first_peak_year: the year after the later of the base year and the onset
    assert "return Math.max(BASE_YEAR, startYear) + 1;" in FORMAT
    assert [first_peak_year(y) for y in (2020, BASE_YEAR, 2030)] == [
        BASE_YEAR + 1, BASE_YEAR + 1, 2031]
    jwt = (REPO / "lib" / "prismJwt.ts").read_text(encoding="utf-8")
    assert int(re.search(r"export const MIN_SECRET_LENGTH = (\d+);", jwt).group(1)) == MIN_SECRET_LENGTH


def test_source_tiers():
    assert tuple(quoted(FORMAT, "export const SOURCE_TIERS =")) == SOURCE_TIERS


def test_source_rules():
    pattern = re.search(r"export const SOURCE_URL = /\^(.+)\$/;", FORMAT).group(1)
    assert pattern.replace("\\/", "/") == SOURCE_URL_PATTERN
    limits = re.search(r"export const SOURCE_FIELD_LIMITS = \{([^}]*)\}", FORMAT).group(1)
    assert {k: int(v) for k, v in re.findall(r"(\w+): (\d+)", limits)} == SOURCE_FIELD_LIMITS


def union(source: str, name: str) -> tuple:
    """The quoted members of one union type, in order."""
    match = re.search(rf"export type {name} =\s*([^;]+);", source)
    assert match, name
    return tuple(re.findall(r"'([^']+)'", match.group(1)))


def fields(source: str, interface: str, optional: bool | None = None) -> tuple:
    """The field names of one interface, in order: all of them, or only the
    optional (True) or the required ones (False). The fields of a nested
    object type (indented further) are not the interface's own."""
    match = re.search(rf"export interface {interface}(?: extends \w+)? \{{(.*?)\n\}}", source, re.S)
    assert match, interface
    body = re.sub(r"/\*.*?\*/", "", match.group(1), flags=re.S)
    return tuple(name for name, mark in re.findall(r"^ {2}(\w+)(\??):", body, re.M)
                 if optional is None or (mark == "?") == optional)


def test_driver_request_shapes():
    """The dashboard's driver types (types/drivers.ts) name the fields the API reads and writes:
    the scores, an admin edit's body and an expert proposal's body."""
    from prism.api.schemas import DriverUpdate, ProposalUpdate
    from prism.drivers import SCORE_FIELDS
    drivers = (REPO / "types" / "drivers.ts").read_text(encoding="utf-8")
    assert fields(drivers, "DriverScores") == SCORE_FIELDS
    assert fields(drivers, "DriverUpdate") == tuple(DriverUpdate.model_fields)
    assert fields(drivers, "DriverProposal") == tuple(ProposalUpdate.model_fields)


def test_the_driver_type_names_what_the_api_serves():
    """Every field of a served driver (_driver_json in prism/api/routers/drivers.py) is a field of the
    dashboard's Driver type (types/drivers.ts, with the scores it extends), and the other way round, so a
    renamed field cannot leave the dashboard reading a key the API no longer sends."""
    import inspect
    from prism.api.routers import drivers as router
    source = inspect.getsource(router._driver_json)
    served = set(re.findall(r'^\s*"(\w+)":', source, re.M)) | set(router.NO_NAMES)
    ts = (REPO / "types" / "drivers.ts").read_text(encoding="utf-8")
    typed = set(fields(ts, "Driver")) | set(fields(ts, "DriverScores"))
    assert served == typed, (sorted(served - typed), sorted(typed - served))
    assert {"short_name", "long_name", "descriptor", "boundary", "analysis"} <= served


def test_journey_tile_shape():
    assert union(JOURNEY, "JourneyKey") == JOURNEYS
    assert fields(JOURNEY, "JourneyStageDef") == STAGE_KEYS
    assert fields(JOURNEY, "JourneyTile", optional=False) == TILE_KEYS
    assert fields(JOURNEY, "JourneyTile", optional=True) == OPTIONAL_TILE_KEYS
    assert fields(JOURNEY, "TileProvenance") == PROVENANCE_KEYS
    assert fields(JOURNEY, "PoolImpactInfo") == POOL_IMPACT_KEYS
    assert union(JOURNEY, "TileType") == TILE_TYPES
    assert union(JOURNEY, "ProvenanceGrade") == PROVENANCE_GRADES
    assert union(JOURNEY, "PoolImpactGrade") == POOL_IMPACT_GRADES
    intensity = re.search(r"^\s*intensity: ([\d |]+);", JOURNEY, re.M).group(1)
    assert tuple(int(n) for n in intensity.split("|")) == INTENSITIES
    assert fields(JOURNEY, "StageContext") == CONTEXT_KEYS


def test_explorer_view_shape():
    """The views the content generator accepts (prism/explorer.py) are the ones the Explorer renders
    (lib/profitPoolData.ts): the view ids, the groups and kinds, the grades and value bases of a source,
    and the fields of a view, a row and a source."""
    assert union(POOLS, "PoolViewId") == VIEW_IDS
    assert union(FORMAT, "CategoryGroup") == GROUPS
    assert union(POOLS, "PoolViewKind") == KINDS
    assert union(POOLS, "EvidenceGrade") == GRADES
    assert union(POOLS, "Denomination") == DENOMINATIONS
    assert fields(POOLS, "PoolView") == VIEW_KEYS
    assert fields(POOLS, "PoolItem", optional=False) == ITEM_KEYS
    assert fields(POOLS, "PoolItem", optional=True) == OPTIONAL_ITEM_KEYS
    assert fields(POOLS, "SourceRef", optional=False) == SOURCE_KEYS
    assert fields(POOLS, "SourceRef", optional=True) == OPTIONAL_SOURCE_KEYS
