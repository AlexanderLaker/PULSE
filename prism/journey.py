"""The Consumer Journey tile map, in the shape the dashboard renders.

data/consumerJourney.ts defines the shape and ships the content. Once an
admin saves an edit, the whole map is stored as a new version
(prism/api/routers/journey.py). Every stored version passes content_problem:
the API refuses a save that does not, and migration 0001 checks the version
it writes.
"""
import json
import re
from typing import Optional

from prism.config import display_code
from prism.seed_drivers import DRIVERS

#: The largest tile map accepted, as JSON text (the bundled content is about a third of this).
MAX_CONTENT_BYTES = 2_000_000
JOURNEYS = ("lhc", "hair")
SIDES = ("benefiting", "negativelyImpacted")
STAGE_KEYS = ("id", "label") + SIDES
#: The keys every tile carries; poolImpact is the one it may leave out.
TILE_KEYS = ("id", "name", "type", "driverCodes", "driverNote", "intensity", "provenance", "analysis")
OPTIONAL_TILE_KEYS = ("poolImpact",)
PROVENANCE_KEYS = ("date", "grade")
POOL_IMPACT_KEYS = ("grade",)
#: The display codes a tile may cite: the drivers of the driver base, the
#: codes data/driverCodeMap.ts resolves on the dashboard.
DRIVER_CODES = frozenset(display_code(d.id, d.force) for d in DRIVERS)
TILE_TYPES = ("product", "tech", "service")
INTENSITIES = (1, 2, 3)
PROVENANCE_GRADES = ("verified", "estimate", "hypothesis")
#: A tile's provenance date: the month of its last revision.
REVISION_MONTH = re.compile(r"\d{4}-(0[1-9]|1[0-2])")
POOL_IMPACT_GRADES = ("Low", "Med", "High")


def unknown_keys(item: dict, allowed: tuple) -> list:
    """The keys of ``item`` outside ``allowed``, sorted."""
    return sorted(set(item) - set(allowed))


def tile_problem(tile: dict) -> Optional[str]:
    """What in a tile the dashboard could not render, or None: its type,
    intensity, provenance, driver note, Strategist Read, pool impact and any
    key a tile does not have. Its id, name and codes are checked by
    content_problem."""
    intensity = tile.get("intensity")
    if tile.get("type") not in TILE_TYPES:
        return f"type must be one of {', '.join(TILE_TYPES)}"
    if isinstance(intensity, bool) or intensity not in INTENSITIES:
        return "intensity must be 1, 2 or 3"
    provenance = tile.get("provenance")
    if not isinstance(provenance, dict) or set(provenance) != set(PROVENANCE_KEYS) \
            or not isinstance(provenance["date"], str) or not REVISION_MONTH.fullmatch(provenance["date"]) \
            or provenance["grade"] not in PROVENANCE_GRADES:
        return (f"provenance must hold a date (YYYY-MM) and a grade ({', '.join(PROVENANCE_GRADES)}), "
                "and nothing else")
    if not isinstance(tile.get("driverNote"), str):
        return "driverNote must be text"
    if "analysis" not in tile or (tile["analysis"] is not None and not isinstance(tile["analysis"], str)):
        return "analysis must be text or null"
    pool = tile.get("poolImpact")
    if "poolImpact" in tile and (not isinstance(pool, dict) or set(pool) != set(POOL_IMPACT_KEYS)
                                 or pool["grade"] not in POOL_IMPACT_GRADES):
        return f"poolImpact must hold a grade ({', '.join(POOL_IMPACT_GRADES)}), and nothing else"
    unknown = unknown_keys(tile, TILE_KEYS + OPTIONAL_TILE_KEYS)
    if unknown:
        return f"holds {', '.join(unknown)}, which a tile does not have"
    return None


def content_problem(content: dict) -> Optional[str]:
    """Why a tile map cannot be stored, or None.

    The shape is what the dashboard renders: exactly the two journeys, each a
    list of stages with an id, a label and the two lists of tiles, every tile
    an object with a unique string id, a name, the list of driver codes it
    cites (each the code of a driver of the base) and the fields tile_problem
    checks, and nothing the dashboard does not read.
    """
    if not isinstance(content, dict) or set(content) != set(JOURNEYS):
        return "content must hold exactly the journeys lhc and hair"
    if len(json.dumps(content)) > MAX_CONTENT_BYTES:
        return f"content is larger than {MAX_CONTENT_BYTES:,} bytes of JSON"
    seen: set = set()
    for journey in JOURNEYS:
        stages = content[journey]
        if not isinstance(stages, list):
            return f"{journey} must be a list of stages"
        for i, stage in enumerate(stages):
            where = f"{journey}[{i}]"
            if not isinstance(stage, dict) or not isinstance(stage.get("id"), str) \
                    or not isinstance(stage.get("label"), str):
                return f"{where} must be a stage with a string id and label"
            unknown = unknown_keys(stage, STAGE_KEYS)
            if unknown:
                return f"{where} holds {', '.join(unknown)}, which a stage does not have"
            for side in SIDES:
                tiles = stage.get(side)
                if not isinstance(tiles, list):
                    return f"{where}.{side} must be a list of tiles"
                for j, tile in enumerate(tiles):
                    if not isinstance(tile, dict) or not isinstance(tile.get("id"), str) or not tile["id"] \
                            or not isinstance(tile.get("name"), str):
                        return f"{where}.{side}[{j}] must be a tile with a string id and name"
                    if tile["id"] in seen:
                        return f"tile id {tile['id']!r} appears twice"
                    seen.add(tile["id"])
                    codes = tile.get("driverCodes")
                    if not isinstance(codes, list) or not all(isinstance(c, str) for c in codes):
                        return f"tile {tile['id']!r} must list its driver codes in driverCodes"
                    unknown = sorted(set(codes) - DRIVER_CODES)
                    if unknown:
                        return f"tile {tile['id']!r} cites {', '.join(unknown)}, which are not drivers"
                    problem = tile_problem(tile)
                    if problem:
                        return f"tile {tile['id']!r}: {problem}"
    return None
