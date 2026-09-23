"""The driver base: data/drivers/driver_base.json, read and checked.

The base is the reviewed source of every driver's scores, exposures and
sources. scripts/generate_seed.py writes the seed module and the code map from
it, and the calibration and the PRISM Analysis are computed from it (never
from a database), so they describe the same drivers the seed carries.
"""
from __future__ import annotations

import collections
import json
import re
from pathlib import Path

from prism.config import (CATEGORIES, DEFAULT_BASE_YEAR, DEFAULT_PATH_YEARS, FORCES, REGIONS,
                          VALID_DIFFUSION_CURVES, VC_STEPS, display_code)
from prism.drivers import CONFIDENCE_LEVELS, DIRECTIONS, Driver

BASE_PATH = Path(__file__).resolve().parents[1] / "data" / "drivers" / "driver_base.json"
#: The tiers of which every driver needs at least one source.
SOURCE_TIERS = ("S", "A", "B")


class InvalidBaseError(ValueError):
    """The base holds an entry the engine or the dashboard could not use."""


def validate(entries: list) -> None:
    """Raise InvalidBaseError listing every problem of the base's entries."""
    problems = []
    ids, codes = collections.Counter(d["id"] for d in entries), collections.Counter(d["code"] for d in entries)
    problems += [f"duplicate id {i}" for i, n in ids.items() if n > 1]
    problems += [f"duplicate code {c}" for c, n in codes.items() if n > 1]
    for d in entries:
        tag = d.get("code", d.get("id"))
        m = re.fullmatch(r"([a-z]+)_r(\d{2})", d["id"])
        if d["force"] not in FORCES:
            problems.append(f"{tag}: unknown force {d['force']!r}")
        elif not m or m.group(1) != d["force"].lower() or d["code"] != display_code(d["id"], d["force"]):
            problems.append(f"{tag}: id {d['id']!r} and code {d['code']!r} do not follow force + number")
        if d["direction"] not in DIRECTIONS:
            problems.append(f"{tag}: direction {d['direction']!r}")
        if not 1 <= d["probability"] <= 5 or not 0 <= d["uncertainty"] <= 5:
            problems.append(f"{tag}: probability or uncertainty out of range")
        if not 0 < d["gp1_pct_affected"] <= 1:
            problems.append(f"{tag}: gp1_pct_affected {d['gp1_pct_affected']} outside (0, 1]")
        if not DEFAULT_BASE_YEAR <= d["start_year"] < d["peak_year"] <= DEFAULT_PATH_YEARS[-1]:
            problems.append(f"{tag}: onset {d['start_year']} and peak {d['peak_year']} out of order or range "
                            "(the peak comes after the onset)")
        if d["diffusion_curve"] not in VALID_DIFFUSION_CURVES:
            problems.append(f"{tag}: diffusion curve {d['diffusion_curve']!r}")
        if d["confidence"] not in CONFIDENCE_LEVELS:
            problems.append(f"{tag}: confidence {d['confidence']!r}")
        if set(d["category_exposure"]) != set(CATEGORIES) or set(d["regional_exposure"]) != set(REGIONS):
            problems.append(f"{tag}: category or regional exposure keys differ from the taxonomy")
        if any(not 0 <= v <= 5 for v in list(d["category_exposure"].values()) + list(d["regional_exposure"].values())):
            problems.append(f"{tag}: an exposure score outside 0-5")
        if d["vc_epicentre"] not in VC_STEPS:
            problems.append(f"{tag}: value-chain epicentre {d['vc_epicentre']!r}")
        if not any(s.get("tier") in SOURCE_TIERS for s in d["sources"]):
            problems.append(f"{tag}: no source of tier {'/'.join(SOURCE_TIERS)}")
        for s in d["sources"]:
            if not str(s.get("url", "")).startswith("http") or not s.get("title"):
                problems.append(f"{tag}: a source without a title or an http(s) URL")
    if problems:
        raise InvalidBaseError("driver base is not valid:\n  " + "\n  ".join(problems))


def load_base(path: Path = BASE_PATH) -> list:
    """The base's entries as stored, after validate()."""
    entries = json.loads(path.read_text(encoding="utf-8"))["drivers"]
    validate(entries)
    return entries


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
