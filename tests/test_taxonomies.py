"""The dashboard's copies of the model's taxonomies and horizon, and of the Consumer Journey tile shape.

The dashboard reads and writes forces, categories, regions, value-chain
stages and source tiers by name, and the API refuses a name that is not the
model's; it lays out the matrix by the path years, and its editor checks a
source's link and lengths as the API will. Its copies (lib/format.ts,
lib/valueChain.ts) must therefore hold the values of prism/config.py and
prism/drivers.py, in the same order. Likewise the journey tile map the
dashboard renders and saves (data/consumerJourney.ts) must be the shape the
API stores (prism/journey.py).
"""
import re
from pathlib import Path

from prism.config import CATEGORIES, DEFAULT_BASE_YEAR, DEFAULT_PATH_YEARS, FORCES, REGIONS, VC_STAGES
from prism.drivers import SOURCE_FIELD_LIMITS, SOURCE_TIERS, SOURCE_URL_PATTERN
from prism.journey import (INTENSITIES, JOURNEYS, OPTIONAL_TILE_KEYS, POOL_IMPACT_GRADES, POOL_IMPACT_KEYS,
                           PROVENANCE_GRADES, PROVENANCE_KEYS, STAGE_KEYS, TILE_KEYS, TILE_TYPES)

REPO = Path(__file__).resolve().parents[1]
FORMAT = (REPO / "lib" / "format.ts").read_text(encoding="utf-8")
VALUE_CHAIN = (REPO / "lib" / "valueChain.ts").read_text(encoding="utf-8")
JOURNEY = (REPO / "data" / "consumerJourney.ts").read_text(encoding="utf-8")


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


def test_value_chain_stages():
    assert quoted(VALUE_CHAIN, "export const VC_STAGES =") == VC_STAGES
    assert len(quoted(VALUE_CHAIN, "export const VC_SHORT_LABELS =")) == len(VC_STAGES)


def test_horizon():
    assert re.search(r"export const BASE_YEAR = (\d{4});", FORMAT).group(1) == str(DEFAULT_BASE_YEAR)
    years = re.search(r"export const YEARS: number\[\] = \[([^\]]*)\];", FORMAT).group(1)
    assert [int(y) for y in years.split(",")] == list(DEFAULT_PATH_YEARS)


def test_source_tiers():
    assert tuple(quoted(FORMAT, "export const SOURCE_TIERS =")) == SOURCE_TIERS


def test_source_rules():
    pattern = re.search(r"export const SOURCE_URL = /\^(.+)\$/;", FORMAT).group(1)
    assert pattern.replace("\\/", "/") == SOURCE_URL_PATTERN
    limits = re.search(r"export const SOURCE_FIELD_LIMITS = \{([^}]*)\}", FORMAT).group(1)
    assert {k: int(v) for k, v in re.findall(r"(\w+): (\d+)", limits)} == SOURCE_FIELD_LIMITS


def union(source: str, name: str) -> tuple:
    """The quoted members of one union type, in order."""
    match = re.search(rf"export type {name} = ([^;]+);", source)
    assert match, name
    return tuple(re.findall(r"'([^']+)'", match.group(1)))


def fields(source: str, interface: str, optional: bool | None = None) -> tuple:
    """The field names of one interface, in order: all of them, or only the
    optional (True) or the required ones (False)."""
    match = re.search(rf"export interface {interface} \{{(.*?)\n\}}", source, re.S)
    assert match, interface
    body = re.sub(r"/\*.*?\*/", "", match.group(1), flags=re.S)
    return tuple(name for name, mark in re.findall(r"^\s*(\w+)(\??):", body, re.M)
                 if optional is None or (mark == "?") == optional)


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
