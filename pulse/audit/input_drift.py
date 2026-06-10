"""Input-drift telemetry (D19, June 2026 — audit F-15).

The garbage-in test (F-15) showed PRISM produces identically-shaped,
confident-looking output from a vandalized trend database. Nothing
distinguishes a curated input set from a corrupted one except human review.

This module gives every run a memory of the previous accepted run's inputs:
a compact per-trend fingerprint is persisted with each simulation, and the
next run diffs itself against it. The diff is emitted as an integrity event
("N scores changed vs previous accepted run (M direction flips; per-force
balance delta …)") and surfaced wherever integrity events are shown.

It is telemetry, not a gate: drift is often legitimate (a quarterly
re-scoring SHOULD drift). The point is that drift is *visible* — a vandalized
or fat-fingered database can no longer slide into a board exhibit silently.
"""
from __future__ import annotations

from typing import Optional


def trend_fingerprint(trends) -> dict:
    """Compact, JSON-stable fingerprint of the scoring state of a trend set.

    Captures exactly the fields whose drift changes simulation output:
    probability, gp1_pct_affected, direction, and force membership.
    """
    fp = {}
    for t in trends:
        fp[str(t.id)] = {
            "p": int(t.probability) if t.probability is not None else None,
            "g": round(float(t.gp1_pct_affected), 6) if t.gp1_pct_affected is not None else None,
            "d": str(t.direction),
            "f": str(t.force),
        }
    return fp


def _force_balance(fp: dict) -> dict:
    """Per-force net direction balance: (#Expansion − #Contraction)."""
    bal: dict = {}
    for rec in fp.values():
        f = rec.get("f") or "?"
        sign = 1 if rec.get("d") == "Expansion" else -1
        bal[f] = bal.get(f, 0) + sign
    return bal


def compute_input_drift_event(
    current_fp: dict,
    previous_fp: Optional[dict],
    previous_run_id=None,
    previous_run_date=None,
) -> Optional[dict]:
    """Diff two trend fingerprints into an integrity event (or None).

    Returns None when there is no previous fingerprint to compare against
    (first run, or the previous run predates fingerprint persistence).
    Returns a zero-drift confirmation event when nothing changed — the
    absence of drift is itself audit-relevant information.
    """
    if not previous_fp:
        return None

    prev_ids, curr_ids = set(previous_fp), set(current_fp)
    added = sorted(curr_ids - prev_ids)
    removed = sorted(prev_ids - curr_ids)

    prob_changes, gp1_changes, direction_flips = [], [], []
    for tid in sorted(curr_ids & prev_ids):
        a, b = previous_fp[tid], current_fp[tid]
        if a.get("p") != b.get("p"):
            prob_changes.append(tid)
        if a.get("g") != b.get("g"):
            gp1_changes.append(tid)
        if a.get("d") != b.get("d"):
            direction_flips.append(tid)

    scores_changed = sorted(set(prob_changes) | set(gp1_changes))

    prev_bal = _force_balance(previous_fp)
    curr_bal = _force_balance(current_fp)
    balance_delta = {
        f: curr_bal.get(f, 0) - prev_bal.get(f, 0)
        for f in sorted(set(prev_bal) | set(curr_bal))
        if curr_bal.get(f, 0) - prev_bal.get(f, 0) != 0
    }

    ref = f"run #{previous_run_id}" if previous_run_id is not None else "previous accepted run"
    if previous_run_date:
        ref += f", {previous_run_date}"

    n_changed = len(scores_changed)
    if not (scores_changed or direction_flips or added or removed):
        return {
            "type": "input_drift",
            "severity": "info",
            "message": f"Input drift vs {ref}: no score changes — "
                       f"trend inputs identical to the previous accepted run.",
            "detail": {"previous_run_id": previous_run_id, "scores_changed": 0,
                       "direction_flips": 0, "added": 0, "removed": 0,
                       "per_force_balance_delta": {}},
        }

    bal_txt = (
        "; per-force balance delta: "
        + ", ".join(f"{f} {d:+d}" for f, d in balance_delta.items())
    ) if balance_delta else ""
    add_rm_txt = ""
    if added or removed:
        add_rm_txt = f"; {len(added)} trend(s) added, {len(removed)} removed"

    return {
        "type": "input_drift",
        "severity": "warning" if (direction_flips or len(scores_changed) > 10) else "info",
        "message": (
            f"Input drift vs {ref}: {n_changed} trend score(s) changed "
            f"({len(prob_changes)} probability, {len(gp1_changes)} gp1) "
            f"({len(direction_flips)} direction flip(s){add_rm_txt}{bal_txt})."
        ),
        "detail": {
            "previous_run_id": previous_run_id,
            "scores_changed": n_changed,
            "probability_changes": prob_changes[:25],
            "gp1_changes": gp1_changes[:25],
            "direction_flips": direction_flips[:25],
            "added": added[:25],
            "removed": removed[:25],
            "per_force_balance_delta": balance_delta,
        },
    }


def previous_fingerprint_from_runs(runs: list) -> tuple:
    """Extract (fingerprint, run_id, run_date) from the newest persisted run.

    ``runs`` is the output of ``pulse.database.load_simulation_runs(limit=1)``.
    Tolerates legacy rows without a fingerprint (returns (None, id, date)).
    """
    import json
    if not runs:
        return None, None, None
    latest = runs[0]
    results = latest.get("results")
    if isinstance(results, str):
        try:
            results = json.loads(results)
        except Exception:
            results = {}
    meta = (results or {}).get("meta") or {}
    run_date = latest.get("run_date")
    run_date = str(run_date)[:19] if run_date else None
    return meta.get("trend_fingerprint"), latest.get("id"), run_date
