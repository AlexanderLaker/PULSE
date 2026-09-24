"""The persisted run as the dashboard receives it.

A run is written by scripts/run_production.py as one results bundle. This
module checks that the newest run carries every part of that contract and
shapes it for GET /api/v1/simulation.
"""
from datetime import timezone
from typing import Iterable, Optional

from prism.config import CATEGORIES, DEFAULT_PATH_YEARS, FORCES, REGIONS, VC_STAGES
from prism.input_drift import changed_drivers, driver_fingerprint, incomplete_entries
from prism.numbers import finite_number

#: Parts of a results bundle the dashboard reads.
REQUIRED_KEYS = (
    "shift_matrix", "regional_shift_matrix", "decompositions", "totals",
    "cell_weights_used", "category_weights_used", "region_weights_used", "cell_weights_source",
    "mc_standard_error", "integrity_events", "seed_stability", "meta",
)

#: Run metadata passed through to the dashboard's run information.
META_KEYS = (
    "seed", "chain_seeds", "chains", "model_version", "engine_name", "numerics_backend",
    "driver_count", "overlap_correction_source",
)


#: The years the dashboard lays out (lib/format.ts YEARS), as stored run keys.
YEARS = tuple(str(y) for y in DEFAULT_PATH_YEARS)
QUANTILES = ("p10", "median", "p90")
#: The columns of each attribution lens (the Shift Matrix's lens columns).
LENS_COLUMNS = {"force": FORCES, "vc": VC_STAGES, "region": REGIONS}


def _bands_complete(bands) -> bool:
    """Whether a year -> distribution map holds P10, median and P90 in every path year."""
    return isinstance(bands, dict) and all(
        isinstance(bands.get(y), dict) and all(q in bands[y] for q in QUANTILES) for y in YEARS)


def _paths_complete(cells: Iterable) -> bool:
    """Whether every cell carries a path with P10, median and P90 in every path year."""
    return all(isinstance(cell, dict) and _bands_complete(cell.get("path")) for cell in cells)


def _grid(value, rows, columns) -> Iterable:
    """value[row][column] for every row and column, None where one is missing."""
    for row in rows:
        inner = value.get(row) if isinstance(value, dict) else None
        for column in columns:
            yield inner.get(column) if isinstance(inner, dict) else None


def incomplete_parts(results: dict) -> list:
    """The parts of the run the dashboard indexes by category, region, lens
    column and year that do not cover all of them: a run on another horizon or
    taxonomy (made before a deploy that changed either) is not served until
    the next production run."""
    out = []
    span = f"{YEARS[0]} to {YEARS[-1]}"
    shift = results.get("shift_matrix")
    if not _paths_complete(shift.get(c) if isinstance(shift, dict) else None for c in CATEGORIES):
        out.append(f"a shift path of every category over {span}")
    regional = results.get("regional_shift_matrix")
    if not _paths_complete(_grid(regional, CATEGORIES, REGIONS)):
        out.append(f"a shift path of every category and region over {span}")
    decompositions = results.get("decompositions")
    for lens, columns in LENS_COLUMNS.items():
        grid = decompositions.get(lens) if isinstance(decompositions, dict) else None
        if not all(isinstance(part, dict) and all(finite_number(part.get(column)) for column in columns)
                   for part in _grid(grid, YEARS, CATEGORIES)):
            out.append(f"the {lens} attribution of every category over {span}")
    totals = results.get("totals")
    if not (isinstance(totals, dict) and _bands_complete(totals.get("portfolio"))
            and all(v is not None for v in _grid(totals.get("category_path"), CATEGORIES, YEARS))):
        out.append(f"the portfolio band and every category's total over {span}")
    categories, regions = results.get("category_weights_used"), results.get("region_weights_used")
    if not (all(finite_number(w) for w in _grid(results.get("cell_weights_used"), CATEGORIES, REGIONS))
            and isinstance(categories, dict) and all(finite_number(categories.get(c)) for c in CATEGORIES)
            and isinstance(regions, dict) and all(finite_number(regions.get(r)) for r in REGIONS)):
        out.append("the gross-profit share of every category and region")
    return out


def missing_keys(results) -> list:
    """The parts of the contract a stored results bundle lacks: the parts
    above, each over every category, region and path year (incomplete_parts),
    the run metadata and a complete fingerprint of the drivers, which the
    next run and inputs_since_run compare with. Stored results that are not
    a JSON object (a list, or text that is not JSON) lack everything, and a
    meta that is not one lacks every key."""
    if not isinstance(results, dict):
        return ["a results object"]
    missing = [k for k in REQUIRED_KEYS if k not in results]
    if not missing:
        missing += incomplete_parts(results)
    meta = results.get("meta")
    meta = meta if isinstance(meta, dict) else {}
    missing += [f"meta.{k}" for k in META_KEYS + ("driver_fingerprint",) if k not in meta]
    if "driver_fingerprint" in meta and incomplete_entries(meta["driver_fingerprint"]):
        missing.append("a complete meta.driver_fingerprint")
    return missing


def run_status(run: Optional[dict]) -> dict:
    """Whether a run can be served: reason is "ok", "no_rows" or "malformed"."""
    if run is None:
        return {"has": False, "reason": "no_rows", "error": None, "latest_run_id": None}
    missing = missing_keys(run["results"])
    if missing:
        return {"has": False, "reason": "malformed", "latest_run_id": run["id"],
                "error": f"run {run['id']} lacks {', '.join(missing)}; re-run scripts/run_production.py"}
    return {"has": True, "reason": "ok", "error": None, "latest_run_id": run["id"]}


def inputs_since_run(run: dict, drivers) -> dict:
    """How the current drivers differ from the ones the run was computed on.

    {"changed", "added", "removed"} as lists of driver ids, all empty while
    the run still reflects the drivers. The dashboard uses it to say that an
    edit made since the run shows only after the next production run.
    """
    return changed_drivers(driver_fingerprint(drivers), run["results"]["meta"]["driver_fingerprint"])


def simulation_payload(run: dict, drivers) -> dict:
    """GET /api/v1/simulation body for a run that passed run_status, compared
    with the current ``drivers`` (``inputs_since_run``)."""
    results = run["results"]
    meta = results["meta"]
    run_date = run["run_date"]
    if hasattr(run_date, "isoformat"):
        # Stored without a zone, in UTC (CURRENT_TIMESTAMP on the database
        # server); said explicitly so the dashboard shows the right local time.
        run_date = (run_date if run_date.tzinfo else run_date.replace(tzinfo=timezone.utc)).isoformat()
    payload = {k: results[k] for k in REQUIRED_KEYS if k != "meta"}
    payload["run_meta"] = {
        "run_id": run["id"],
        "run_date": run_date,
        "iterations": run["iterations"],
        **{k: meta[k] for k in META_KEYS},
    }
    payload["inputs_since_run"] = inputs_since_run(run, drivers)
    return payload
