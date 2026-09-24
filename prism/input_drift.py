"""Input-drift telemetry: how the driver scores moved since the previous run.

The engine produces equally confident-looking output from a curated driver
base and from a careless or damaged one. To make the difference visible, each
persisted run stores a compact fingerprint of the scoring state, and the next
run compares itself against it. The comparison becomes an integrity event
("N driver score(s) changed ...") that is stored with the run and shown next
to it.

This is telemetry, not a gate: a planned re-scoring should drift. The point is
that drift never goes unnoticed.
"""
from __future__ import annotations

#: Fingerprint fields beyond probability, GP1 share and direction: a driver
#: moved to another force, its exposures, value-chain epicentre, onset, peak
#: year, curve or uncertainty.
STRUCTURE_KEYS = ("f", "ce", "ve", "re", "s", "pk", "dc", "u")
#: Every field of a driver's fingerprint entry.
FINGERPRINT_KEYS = ("p", "g", "d") + STRUCTURE_KEYS


def _rounded_map(m: dict) -> dict:
    """JSON-stable, rounded copy of an exposure dict (sorted keys)."""
    return {str(k): round(float(v), 4) for k, v in sorted(m.items())}


def driver_fingerprint(drivers) -> dict:
    """Compact, JSON-stable fingerprint of every field that moves the simulation.

    Keys per driver: p probability, g GP1 share, d direction, f force,
    ce / re category and regional exposure, ve the value-chain epicentre, s
    onset year, pk peak year, dc diffusion curve, u uncertainty.
    """
    return {
        str(d.id): {
            "p": int(d.probability),
            "g": round(float(d.gp1_pct_affected), 6),
            "d": str(d.direction),
            "f": str(d.force),
            "ce": _rounded_map(d.category_exposure),
            "ve": str(d.vc_epicentre),
            "re": _rounded_map(d.regional_exposure),
            "s": int(d.start_year),
            "pk": int(d.peak_year),
            "dc": str(d.diffusion_curve),
            "u": int(d.uncertainty),
        }
        for d in drivers
    }


def incomplete_entries(fp) -> list:
    """The driver ids whose entry in a stored fingerprint is not a complete
    entry (every FINGERPRINT_KEYS field); ["(not a map)"] for a fingerprint
    that is not a dictionary. A run with such a fingerprint cannot be compared
    with, so it is not served (prism/api/runs.py)."""
    if not isinstance(fp, dict):
        return ["(not a map)"]
    return sorted(str(i) for i, entry in fp.items()
                  if not isinstance(entry, dict) or not set(FINGERPRINT_KEYS) <= set(entry))


def _differs(a: dict, b: dict) -> bool:
    """Whether two drivers' fingerprints differ in anything that moves the simulation."""
    return any(a[k] != b[k] for k in FINGERPRINT_KEYS)


def changed_drivers(current_fp: dict, previous_fp: dict) -> dict:
    """{"changed", "added", "removed"}: the driver ids that differ between two fingerprints."""
    common = sorted(set(current_fp) & set(previous_fp))
    return {
        "changed": [i for i in common if _differs(previous_fp[i], current_fp[i])],
        "added": sorted(set(current_fp) - set(previous_fp)),
        "removed": sorted(set(previous_fp) - set(current_fp)),
    }


def _force_balance(fp: dict) -> dict:
    """Per-force net direction: number of expansion minus contraction drivers."""
    bal: dict = {}
    for rec in fp.values():
        bal[rec["f"]] = bal.get(rec["f"], 0) + (1 if rec["d"] == "Expansion" else -1)
    return bal


def compute_input_drift_event(
    current_fp: dict,
    previous_fp: dict | None,
    previous_run_id=None,
    previous_run_date=None,
) -> dict | None:
    """Compare two fingerprints and describe the difference as an integrity event.

    Returns None when there is nothing to compare against (the first run).
    Returns an info event when nothing changed: the absence of drift is worth
    recording too.
    """
    if not previous_fp:
        return None

    prev_ids, curr_ids = set(previous_fp), set(current_fp)
    added = sorted(curr_ids - prev_ids)
    removed = sorted(prev_ids - curr_ids)

    prob_changes, gp1_changes, direction_flips, structure_changes = [], [], [], []
    for did in sorted(curr_ids & prev_ids):
        a, b = previous_fp[did], current_fp[did]
        if a["p"] != b["p"]:
            prob_changes.append(did)
        if a["g"] != b["g"]:
            gp1_changes.append(did)
        if a["d"] != b["d"]:
            direction_flips.append(did)
        if any(a[key] != b[key] for key in STRUCTURE_KEYS):
            structure_changes.append(did)

    scores_changed = sorted(set(prob_changes) | set(gp1_changes))
    prev_bal, curr_bal = _force_balance(previous_fp), _force_balance(current_fp)
    balance_delta = {
        f: curr_bal.get(f, 0) - prev_bal.get(f, 0)
        for f in sorted(set(prev_bal) | set(curr_bal))
        if curr_bal.get(f, 0) - prev_bal.get(f, 0) != 0
    }

    ref = _run_reference(previous_run_id, previous_run_date)

    detail = {
        "previous_run_id": previous_run_id,
        "scores_changed": len(scores_changed),
        "probability_changes": prob_changes[:25],
        "gp1_changes": gp1_changes[:25],
        "direction_flips": direction_flips[:25],
        "structure_changes": structure_changes[:25],
        "added": added[:25],
        "removed": removed[:25],
        "per_force_balance_delta": balance_delta,
    }
    if not (scores_changed or direction_flips or structure_changes or added or removed):
        return {
            "type": "input_drift",
            "severity": "info",
            "message": f"Input drift vs {ref}: no changes; the driver inputs are identical to that run's.",
            "detail": detail,
        }

    struct_txt = (f", {len(structure_changes)} structural change(s) "
                  f"(force, exposures, value-chain epicentre, onset, peak year, curve or uncertainty)"
                  if structure_changes else "")
    add_rm_txt = f", {len(added)} driver(s) added, {len(removed)} removed" if (added or removed) else ""
    bal_txt = ("; per-force balance change: " + ", ".join(f"{f} {d:+d}" for f, d in balance_delta.items())
               if balance_delta else "")

    # Adding or removing drivers reshapes the whole model, so it is never a
    # footnote.
    severity = "warning" if (
        direction_flips or len(scores_changed) > 10 or added or removed or len(structure_changes) > 10
    ) else "info"

    return {
        "type": "input_drift",
        "severity": severity,
        "message": (
            f"Input drift vs {ref}: {len(scores_changed)} driver score(s) changed "
            f"({len(prob_changes)} probability, {len(gp1_changes)} GP1 share), "
            f"{len(direction_flips)} direction flip(s){struct_txt}{add_rm_txt}{bal_txt}."
        ),
        "detail": detail,
    }


def _run_reference(run_id, run_date) -> str:
    ref = f"run #{run_id}" if run_id is not None else "the previous run"
    return f"{ref}, {run_date}" if run_date else ref


def not_compared_event(reason: str, previous_run_id=None, previous_run_date=None) -> dict:
    """The warning a run records when it could not be compared with the
    previous one, so a comparison that did not happen never reads like a
    first run."""
    return {
        "type": "input_drift",
        "severity": "warning",
        "message": f"Input drift was not compared with {_run_reference(previous_run_id, previous_run_date)}: "
                   f"{reason}.",
        "detail": {"previous_run_id": previous_run_id, "compared": False, "reason": reason},
    }


def compare_with_run(current_fp: dict, latest_run: dict | None) -> dict | None:
    """The input-drift event of a new run against the newest stored run
    (database.load_latest_run): None before the first run, a warning when
    that run's fingerprint is missing or incomplete."""
    if not latest_run:
        return None
    run_id, run_date = latest_run["id"], str(latest_run["run_date"])[:19]
    results = latest_run["results"]
    fingerprint = (results.get("meta") or {}).get("driver_fingerprint") if isinstance(results, dict) else None
    incomplete = len(incomplete_entries(fingerprint)) if isinstance(fingerprint, dict) else 0
    if fingerprint is None:
        reason = "it stored no driver fingerprint"
    elif not isinstance(fingerprint, dict):
        reason = "its driver fingerprint is not a map of drivers"
    elif incomplete:
        reason = f"its driver fingerprint is incomplete for {incomplete} driver{'s' if incomplete != 1 else ''}"
    else:
        return compute_input_drift_event(current_fp, fingerprint, run_id, run_date)
    return not_compared_event(reason, run_id, run_date)
