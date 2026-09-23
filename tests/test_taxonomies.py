"""The dashboard's copies of the model's taxonomies and horizon.

The dashboard reads and writes forces, categories, regions, value-chain
stages and source tiers by name, and the API refuses a name that is not the
model's; it lays out the matrix by the path years. Its lists (lib/format.ts,
lib/valueChain.ts) must therefore hold the values of prism/config.py and
prism/drivers.py, in the same order.
"""
import re
from pathlib import Path

from prism.config import CATEGORIES, DEFAULT_BASE_YEAR, DEFAULT_PATH_YEARS, FORCES, REGIONS, VC_STAGES
from prism.drivers import SOURCE_TIERS

LIB = Path(__file__).resolve().parents[1] / "lib"
FORMAT = (LIB / "format.ts").read_text(encoding="utf-8")
VALUE_CHAIN = (LIB / "valueChain.ts").read_text(encoding="utf-8")


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
