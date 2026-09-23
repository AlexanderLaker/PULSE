"""The driver base: data/drivers/driver_base.json, read and checked.

The base is the reviewed source of every driver's scores, exposures and
sources. scripts/generate_seed.py writes the seed module and the code map from
it, and the overlap correction and the PRISM Analysis are computed from it
(never from a database), so they describe the same drivers the seed carries.
"""
from __future__ import annotations

import collections
import json
import re
from pathlib import Path

from prism.config import CATEGORIES, DEFAULT_BASE_YEAR, DEFAULT_PATH_YEARS, FORCES, REGIONS, display_code
from prism.drivers import (CONFIDENCE_LEVELS, SOURCE_FIELD_LIMITS, SOURCE_TIERS, SOURCE_URL_PATTERN, Driver,
                           simulation_problems)

BASE_PATH = Path(__file__).resolve().parents[1] / "data" / "drivers" / "driver_base.json"
#: Every driver of the base has at least one source of these tiers.
REQUIRED_SOURCE_TIERS = ("S", "A", "B")


class InvalidBaseError(ValueError):
    """The base holds an entry the engine or the dashboard could not use."""


#: The fields every entry of the base carries (it may carry more, such as its theme).
ENTRY_FIELDS = ("id", "code", "force", "name", "description", "direction", "probability", "start_year",
                "peak_year", "gp1_pct_affected", "diffusion_curve", "uncertainty", "confidence",
                "category_exposure", "regional_exposure", "vc_epicentre", "sources")


def validate(entries: list, retired_numbers: dict) -> None:
    """Raise InvalidBaseError listing every problem of the base's entries.

    The model inputs are held to the engine's own rules
    (prism.drivers.simulation_problems); on top of those an entry must follow
    the id and code pattern, lie inside the horizon, carry a known confidence
    and have sources the API would accept back from the editor, each with a
    title and an http(s) link, at least one of them of tier S, A or B.

    ``retired_numbers`` lists, per force, the numbers of drivers that left the
    base. Stored runs, proposals, the audit log and the journey content refer
    to drivers by id or code, so a number is never given to a second driver:
    every number up to a force's highest must be a driver's or retired, and
    none may be both. A new driver therefore takes the next number, and a
    driver that leaves moves its number to the list.
    """
    problems = [f"duplicate code {c}" for c, n in collections.Counter(d.get("code") for d in entries).items() if n > 1]
    complete = []
    for d in entries:
        tag = d.get("code") or d.get("id")
        missing = [k for k in ENTRY_FIELDS if k not in d]
        if missing:
            problems.append(f"{tag}: no {', '.join(missing)}")
            continue
        complete.append(d)
        m = re.fullmatch(r"([a-z]+)_r(\d{2})", str(d["id"]))
        if d["force"] in FORCES and (not m or m.group(1) != d["force"].lower()
                                     or d["code"] != display_code(d["id"], d["force"])):
            problems.append(f"{tag}: id {d['id']!r} and code {d['code']!r} do not follow force + number")
        if isinstance(d["start_year"], int) and d["start_year"] < DEFAULT_BASE_YEAR:
            problems.append(f"{tag}: onset {d['start_year']} before the base year {DEFAULT_BASE_YEAR}")
        if isinstance(d["peak_year"], int) and d["peak_year"] > DEFAULT_PATH_YEARS[-1]:
            problems.append(f"{tag}: peak {d['peak_year']} after the horizon {DEFAULT_PATH_YEARS[-1]}")
        if d["confidence"] not in CONFIDENCE_LEVELS:
            problems.append(f"{tag}: confidence {d['confidence']!r}")
        if not any(s.get("tier") in REQUIRED_SOURCE_TIERS for s in d["sources"]):
            problems.append(f"{tag}: no source of tier {'/'.join(REQUIRED_SOURCE_TIERS)}")
        for s in d["sources"]:
            problems += [f"{tag}: source {s.get('title') or s.get('url')!r}: {p}" for p in _source_problems(s)]
    problems += _numbering_problems(complete, retired_numbers)
    problems += simulation_problems([_entry_driver(d) for d in complete])
    if problems:
        raise InvalidBaseError("driver base is not valid:\n  " + "\n  ".join(problems))


def _numbering_problems(entries: list, retired_numbers: dict) -> list:
    """Numbers given twice, or numbers neither a driver's nor retired (see validate)."""
    problems = []
    live = collections.defaultdict(set)
    for d in entries:
        m = re.fullmatch(r"[a-z]+_r(\d{2})", str(d["id"]))
        if m and d["force"] in FORCES:
            live[d["force"]].add(int(m.group(1)))
    for force in FORCES:
        retired = retired_numbers.get(force)
        whole = isinstance(retired, list) and all(isinstance(n, int) and not isinstance(n, bool) and n >= 1
                                                   for n in retired)
        if not whole:
            problems.append(f"retired_numbers has no list of whole numbers for {force}")
            continue
        used = live[force] | set(retired)
        following = max(used, default=0) + 1
        for n in sorted(live[force] & set(retired)):
            problems.append(f"{force} number {n} belongs to a driver that left the base; a new driver takes "
                            f"{following}")
        for n in sorted(set(range(1, following)) - used):
            problems.append(f"{force} number {n} is neither a driver's nor retired: a new driver takes the next "
                            f"number, and a driver that leaves moves its number to retired_numbers")
    return problems


def _source_problems(source: dict) -> list:
    """What keeps a source of the base from being stored and saved again from the editor."""
    out = []
    if not str(source.get("title") or "").strip():
        out.append("no title")
    if not re.fullmatch(SOURCE_URL_PATTERN, str(source.get("url") or "")):
        out.append("its link is not an http(s) address")
    if source.get("tier") not in ("",) + SOURCE_TIERS:
        out.append(f"tier {source.get('tier')!r} is not on the scale")
    if not isinstance(source.get("published"), str):
        out.append("no publication note")
    out += [f"{name} longer than {limit} characters" for name, limit in SOURCE_FIELD_LIMITS.items()
            if len(str(source.get(name) or "")) > limit]
    return out


def _entry_driver(d: dict) -> Driver:
    """A base entry as a Driver with its exposure maps as written, for the checks."""
    return Driver(id=d["id"], force=d["force"], direction=d["direction"], probability=d["probability"],
                  start_year=d["start_year"], gp1_pct_affected=d["gp1_pct_affected"], peak_year=d["peak_year"],
                  diffusion_curve=d["diffusion_curve"], uncertainty=d["uncertainty"],
                  category_exposure=d["category_exposure"], regional_exposure=d["regional_exposure"],
                  vc_epicentre=d["vc_epicentre"])


def load_base(path: Path = BASE_PATH) -> list:
    """The base's entries as stored, after validate()."""
    base = json.loads(path.read_text(encoding="utf-8"))
    validate(base["drivers"], base["retired_numbers"])
    return base["drivers"]


def driver_from_base(d: dict, analysis: str = "") -> Driver:
    """The Driver a base entry becomes; the generated seed module builds the same."""
    return Driver(
        id=d["id"], force=d["force"], name=d["name"], description=d["description"],
        direction=d["direction"], probability=d["probability"], start_year=d["start_year"],
        gp1_pct_affected=float(d["gp1_pct_affected"]), peak_year=d["peak_year"],
        diffusion_curve=d["diffusion_curve"], uncertainty=d["uncertainty"], confidence=d["confidence"],
        category_exposure={c: d["category_exposure"][c] for c in CATEGORIES},
        regional_exposure={r: d["regional_exposure"][r] for r in REGIONS},
        vc_epicentre=d["vc_epicentre"],
        sources=[{"title": s["title"], "url": s["url"], "tier": s["tier"], "published": s["published"]}
                 for s in d["sources"]],
        analysis=analysis,
    )


def base_drivers() -> list:
    """The drivers of the base, ordered by id as the database returns them."""
    return [driver_from_base(d) for d in sorted(load_base(), key=lambda d: d["id"])]
