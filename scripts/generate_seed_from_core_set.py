#!/usr/bin/env python3
"""
Generate the trend base of release 2.11.0 from the reviewed core set.

Inputs (both in the repository so the base is reproducible):
  data/trend_base_2026-09/core_set_51_v5.json   the 51 reviewed drivers
                                                (senior-partner review,
                                                2/3 September 2026, v3;
                                                v4 added the TOI column,
                                                O13; v5 rewords four
                                                texts to the Driver
                                                vocabulary, O15)
  data/trend_base_2026-09/verdicts_99_v1.json   the disposition of every
                                                code of the 99-trend base
                                                (KEEP / MERGE INTO /
                                                SUBSTITUTE / DELETE / NEW)

Outputs (committed, never hand-edited):
  pulse/seed_trends.py      the seed module (Trend rows + SOURCE_URLS +
                            the unchanged credibility gate and CLI)
  data/trendCodeMap.ts      the display-code map of the journey layer
                            (51 live codes + the retired codes with their
                            merged-into pointers and one-line reasons)

Identity rules (implementation plan v2, section WS2):
  * a kept driver keeps its id (consumer_r01 stays consumer_r01), so audit
    history, proposals and journey links survive;
  * a new driver takes the number of its review code (C-34 -> consumer_r34);
  * a driver whose FORCE changed in the review gets an id in the new force
    (the code map derives the force letter from the id): T-06 retail media
    (Technology -> Customer) becomes customer_r13 / K-13 and X-06 growth
    markets (Competitive -> Consumer) becomes consumer_r37 / C-37; the old
    code retires with a pointer to the new one;
  * every driver is seeded with ai_suggested=False and user_override=False
    (owner decision 2026-09-10: no provenance label on the reviewed base)
    and carries its AI-baseline snapshot (incl. the uncertainty score) so
    the proposals layer has a reference;
  * the value-chain profile is written in the editor's canonical 5/3/1
    serialisation around the reviewed epicentre, which is also the
    epicentre of the reviewed 8-step profile (asserted).

Usage:
  python3 scripts/generate_seed_from_core_set.py            # write both files
  python3 scripts/generate_seed_from_core_set.py --check    # exit 1 if the
                                                            # committed files
                                                            # differ from the
                                                            # generator output
"""
from __future__ import annotations

import argparse
import collections
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from pulse.config import CATEGORIES, REGIONS, VC_STEPS, vc_epicentre_step_of  # noqa: E402

CORE_SET = ROOT / "data" / "trend_base_2026-09" / "core_set_51_v5.json"
VERDICTS = ROOT / "data" / "trend_base_2026-09" / "verdicts_99_v1.json"
SEED_OUT = ROOT / "pulse" / "seed_trends.py"
CODEMAP_OUT = ROOT / "data" / "trendCodeMap.ts"

LETTER_TO_FORCE = {"C": "Consumer", "K": "Customer", "T": "Technology",
                   "G": "Government", "E": "Environmental", "X": "Competitive"}
FORCE_TO_LETTER = {v: k for k, v in LETTER_TO_FORCE.items()}
FORCE_TO_SLUG = {"Consumer": "consumer", "Customer": "customer", "Technology": "technology",
                 "Government": "government", "Environmental": "environmental",
                 "Competitive": "competitive"}
FORCE_ORDER = ["Consumer", "Customer", "Competitive", "Technology", "Government", "Environmental"]

# Review evidence grades -> the editor's tier ladder and a readable type.
GRADE_TYPE = {"S": "primary source", "A": "analyst report", "B": "trade press"}

# Retired before this review (kept verbatim from the June 2026 code map).
LEGACY_RETIRED = {
    "C-12": ("Post-COVID Hygiene Habits Persistence", "retired v3.1 (normalised)", "v3.1"),
    "K-05": ("Quick Commerce Consolidation", "retired v3.1 (structurally failed)", "v3.1"),
    "T-09": ("Generic ML formulation / GEO discovery v1", "retired v3.3 (superseded by T-13)", "v3.3"),
}

CODE_RE = re.compile(r"\b([CKTGEX]-\d{2})\b")


# ── helpers ────────────────────────────────────────────────────────────

def q(s) -> str:
    """Double-quoted Python string literal (JSON escapes are valid Python)."""
    return json.dumps("" if s is None else str(s), ensure_ascii=False)


def sentence(s: str) -> str:
    s = (s or "").strip()
    if s and s[-1] not in ".!?":
        s += "."
    return s


def first_sentence(text: str, cap: int = 220) -> str:
    text = (text or "").strip()
    m = re.search(r"(?<=[.!?])\s+(?=[A-Z0-9])", text)
    first = text[: m.start()] if m else text
    if len(first) > cap:
        first = first[: cap - 1].rstrip() + "…"
    return first


def normalise_force(force: str) -> str:
    """'Customer (reassigned from Technology)' -> 'Customer'."""
    base = force.split("(")[0].strip()
    if base not in FORCE_TO_SLUG:
        raise ValueError(f"unknown force {force!r}")
    return base


def canonical_vc_profile(epicentre: str) -> dict:
    """The editor's 5/3/1 serialisation around an epicentre stage."""
    stage = VC_STEPS.index(epicentre) + 1
    falloff = [5, 3, 1]
    out = {}
    for i, step in enumerate(VC_STEPS):
        d = abs(i + 1 - stage)
        out[step] = falloff[d] if d < len(falloff) else 0
    return out


def score_note(prefix: str, note: str) -> str:
    """'5: the shift is observed ...' -> 'Probability 5 of 5: the shift ...'."""
    m = re.match(r"^\s*(\d)\s*[:\-–]\s*(.*)$", note or "", re.S)
    if m:
        return sentence(f"{prefix} {m.group(1)} of 5: {m.group(2).strip()}")
    return sentence(f"{prefix}: {note.strip()}") if note else ""


def implication_text(r: dict) -> str:
    n = r.get("param_notes") or {}
    parts = [
        sentence(f"Mechanism: {r['mech']}"),
        score_note("Probability", n.get("prob_note", "")),
        sentence(f"Exposure: {n.get('exp_note', '')}") if n.get("exp_note") else "",
        sentence(f"Timing: {n.get('time_note', '')}") if n.get("time_note") else "",
        score_note("Uncertainty", n.get("unc_note", "")),
        sentence(f"What changed in the September 2026 review: {r['change']}") if r.get("change") else "",
    ]
    return " ".join(p for p in parts if p)


def data_source_text(r: dict) -> str:
    """Short publisher list for the data_source chip (first three sources)."""
    pubs = []
    for title, _url, _grade, date in r["sources"][:3]:
        pub = title.split(":")[0].strip()
        pub = pub if len(pub) <= 48 else pub[:47].rstrip() + "…"
        pubs.append(f"{pub} ({date})" if date else pub)
    return "; ".join(pubs)


def majority_source_type(r: dict) -> str:
    c = collections.Counter(GRADE_TYPE[s[2]] for s in r["sources"])
    return c.most_common(1)[0][0].replace(" ", "_") if c else ""


# ── identity assignment ────────────────────────────────────────────────

def assign_identities(core: list[dict]) -> list[dict]:
    """Attach id, code (display), letter, force and a note to every record."""
    max_num = collections.defaultdict(int)
    for r in core:
        letter, num = r["code"].split("-")
        max_num[LETTER_TO_FORCE[letter]] = max(max_num[LETTER_TO_FORCE[letter]], int(num))
    # base maxima of the 99-trend seed (ids are never reused)
    for force, n in {"Consumer": 33, "Customer": 11, "Technology": 19, "Government": 14,
                     "Environmental": 11, "Competitive": 14}.items():
        max_num[force] = max(max_num[force], n)

    out = []
    for r in core:
        rec = dict(r)
        force = normalise_force(r["force"])
        letter, num = r["code"].split("-")
        rec["force"] = force
        rec["review_code"] = r["code"]
        if LETTER_TO_FORCE[letter] == force:
            rec["code"] = r["code"]
            rec["id"] = f"{FORCE_TO_SLUG[force]}_r{int(num):02d}"
            rec["force_moved_from"] = None
        else:
            max_num[force] += 1
            rec["code"] = f"{FORCE_TO_LETTER[force]}-{max_num[force]:02d}"
            rec["id"] = f"{FORCE_TO_SLUG[force]}_r{max_num[force]:02d}"
            rec["force_moved_from"] = r["code"]
        out.append(rec)
    ids = [x["id"] for x in out]
    codes = [x["code"] for x in out]
    assert len(set(ids)) == len(ids), "duplicate ids"
    assert len(set(codes)) == len(codes), "duplicate codes"
    return out


def status_note(rec: dict, verdicts: dict) -> str:
    v = verdicts.get(rec["review_code"], {})
    absorbed = [o for o in rec.get("old", []) if o != rec["review_code"]]
    if rec["force_moved_from"]:
        note = f"was {rec['force_moved_from']}, force moved to {rec['force']}"
    elif v.get("verdict") == "NEW":
        note = "new in the September 2026 review"
    elif v.get("verdict") == "KEEP":
        note = "kept"
    else:
        note = v.get("verdict", "").lower() or "reviewed"
    if absorbed:
        note += "; absorbs " + ", ".join(absorbed)
    return note


# ── seed module rendering ──────────────────────────────────────────────

SEED_TAIL = '''

# ── Source credibility gate (E1) ────────────────────────────────────
# Tier ladder: S > A > A- > B+ > B > B- > C > D > E
# E = social media / unverified — explicitly a "weak signal only" tier.
# A trend whose evidence base is *exclusively* tier-E (or has no sources
# at all) is not strong enough to drive a probability/gp1 score. The
# scoring layer must refuse it until at least one B-or-better source
# corroborates the signal.
WEAK_TIERS = {"E", "D"}
ACCEPTABLE_TIERS = {"S", "A", "A-", "B+", "B", "B-", "C"}


class TierEGateError(ValueError):
    """Raised when a trend's source credibility is too weak to score."""


def assert_trend_credible(trend_id: str, sources: list) -> None:
    """Hard gate: refuse to score a trend with no usable sources.

    Rules:
      - At least one source must be present.
      - At least one source must be in ACCEPTABLE_TIERS (B- or better,
        plus C for low-but-not-weak signals).
      - Trends with only D/E sources are rejected — they need
        corroboration before they earn a probability score.

    Raises:
        TierEGateError if the gate fails. Callers should not catch this
        silently — a failing gate is a data-quality bug, not a runtime
        condition to recover from.
    """
    if not sources:
        raise TierEGateError(
            f"Driver '{trend_id}' has no sources attached. Cannot score "
            f"a driver with zero evidence base."
        )

    tiers = [str(s.get("tier", "")).strip() for s in sources if isinstance(s, dict)]
    strong = [t for t in tiers if t in ACCEPTABLE_TIERS]

    if not strong:
        raise TierEGateError(
            f"Driver '{trend_id}' has only weak-signal sources "
            f"(tiers={tiers}). At least one source rated B- or better "
            f"is required before this driver can be scored. Tier E "
            f"(social media / unverified) is permitted only as a "
            f"corroborating signal alongside a B-tier-or-higher source."
        )


def get_report_trends():
    """Return all active trends with source URLs attached.

    The active count is dynamic (51 drivers since the September 2026
    review, release 2.11.0). Applies the E1 source-credibility gate to
    every trend before returning. A trend with no sources, or only
    D/E-tier sources, raises TierEGateError — refusing to seed the
    database with a trend whose evidence is too weak to support scoring.
    """
    trends = list(TRENDS)
    for t in trends:
        t.sources = SOURCE_URLS.get(t.id, [])
        # AI baseline snapshot (June 2026 multi-expert proposals layer):
        # only set it if a trend doesn't already carry one, so a re-seed
        # never clobbers a deliberately-curated baseline.
        if getattr(t, "ai_suggestion", None) is None:
            t.ai_suggestion = _ai_snapshot(t)
        assert_trend_credible(t.id, t.sources)
    return trends


def main():
    """CLI entry point for seeding the database directly."""
    from pulse.database import init_db, save_trends, load_trends

    print("Initializing database...")
    init_db()

    print(f"Importing {len(TRENDS)} trends from the September 2026 core set...")

    # Validate before saving
    for t in TRENDS:
        assert t.force in ["Consumer", "Customer", "Technology", "Government", "Environmental", "Competitive"], f"Invalid force: {t.force} for {t.id}"
        assert t.direction in ["Expansion", "Contraction"], f"Invalid direction: {t.direction} for {t.id}"
        assert 1 <= t.probability <= 5, f"Invalid probability: {t.probability} for {t.id}"
        for k, v in t.category_exposure.items():
            assert k in CATEGORIES, f"Invalid category: {k} for {t.id}"
            assert 0 <= v <= 5, f"Invalid category exposure: {v} for {k} in {t.id}"
        for k, v in t.vc_exposure.items():
            assert k in VC_STEPS, f"Invalid VC step: {k} for {t.id}"
            assert 0 <= v <= 5, f"Invalid VC exposure: {v} for {k} in {t.id}"
        for k, v in t.regional_exposure.items():
            assert k in REGIONS, f"Invalid region: {k} for {t.id}"
            assert 0 <= v <= 5, f"Invalid regional exposure: {v} for {k} in {t.id}"

    # Attach source URLs before saving
    trends = get_report_trends()
    save_trends(trends)

    # Verify
    trends_list = load_trends()
    print(f"\\nVerification: {len(trends_list)} trends in database")
    from collections import Counter
    force_counts = Counter(t.force for t in trends_list)
    print(f"  Forces: {', '.join(f'{f}: {force_counts.get(f, 0)}' for f in ['Consumer','Government','Technology','Environmental','Competitive','Customer'])}")
    print(f"  Expansion: {sum(1 for t in trends_list if t.direction == 'Expansion')}")
    print(f"  Contraction: {sum(1 for t in trends_list if t.direction == 'Contraction')}")
    print("\\nDone. Trends ready for simulation.")


if __name__ == "__main__":
    main()
'''


def render_seed(recs: list[dict], verdicts: dict) -> str:
    by_force = collections.Counter(r["force"] for r in recs)
    by_dir = collections.Counter(r["direction"] for r in recs)
    kept = sum(1 for r in recs if verdicts.get(r["review_code"], {}).get("verdict") == "KEEP")
    new = sum(1 for r in recs if verdicts.get(r["review_code"], {}).get("verdict") == "NEW")
    moved = [r for r in recs if r["force_moved_from"]]
    absorbed = sorted({o for r in recs for o in r.get("old", []) if o != r["review_code"]})
    deleted = sorted(c for c, v in verdicts.items() if v.get("verdict") == "DELETE" and c not in absorbed)

    lines = []
    a = lines.append
    a('"""')
    a("PRISM seed data: 51 drivers (release 2.11.0 trend base, September 2026).")
    a("")
    a("GENERATED by scripts/generate_seed_from_core_set.py from")
    a("data/trend_base_2026-09/core_set_51_v5.json (the reviewed core set of the")
    a("senior-partner trend-base review, 2/3 September 2026, v3) and")
    a("data/trend_base_2026-09/verdicts_99_v1.json (the disposition of every code")
    a("of the 99-trend base). Do not hand-edit: change the JSON, re-run the")
    a("generator, and regenerate data/trendCodeMap.ts with it (same script).")
    a("")
    a("Composition (owner ruling O10):")
    a("  " + ", ".join(f"{f} {by_force.get(f, 0)}" for f in FORCE_ORDER) + f"  = {len(recs)} drivers")
    a(f"  {by_dir.get('Contraction', 0)} Contraction / {by_dir.get('Expansion', 0)} Expansion")
    a(f"  {kept} kept from the 99-trend base, {new} new, {len(absorbed)} base codes absorbed")
    a(f"  into a driver, {len(deleted)} base codes deleted (watch list); force moves:")
    for r in moved:
        a(f"    {r['force_moved_from']} -> {r['code']} ({r['id']}, now {r['force']})")
    a("")
    a("What every row carries (2.11.0):")
    a("  * reviewed probability, GP1 share, onset, peak, curve and confidence;")
    a("  * category, regional and value-chain exposures as reviewed (the VC")
    a("    profile is the editor's canonical 5/3/1 serialisation around the")
    a("    reviewed epicentre);")
    a("  * the uncertainty score 0-5 (owner ruling O7) that sets the Beta-prior")
    a("    concentration and the per-trend peak-year jitter;")
    a("  * graded sources (S primary / A analyst / B trade press) with dates;")
    a("  * ai_suggested=False, user_override=False (no provenance label on the")
    a("    reviewed base, owner decision 2026-09-10) and the AI-baseline")
    a("    snapshot incl. the uncertainty score for the proposals layer.")
    a("")
    a("Earlier bases (April 2026 v3.1/v3.3/v3.5 and the Gemini review) are")
    a("archived by scripts/replace_trend_base.py before the replacement and are")
    a("summarised per code in data/trendCodeMap.ts (RETIRED_CODES).")
    a("")
    a("This module lives inside the pulse package so it's importable on Vercel serverless.")
    a('"""')
    a("")
    a("from pulse.ingestion.models import Trend")
    a("from pulse.config import CATEGORIES, VC_STEPS, REGIONS")
    a("")
    a("# ── Helper to build category/vc/region dicts from ordered lists ──────")
    a("CAT_KEYS = list(CATEGORIES)  # 13 categories in order")
    a("VC_KEYS = list(VC_STEPS)     # 8 VC steps in order")
    a("REG_KEYS = list(REGIONS)     # 4 regions in order")
    a("")
    a("def cat(color, care, styling, body, fcn, fca, ffi, lad, hdw, adw, hsc, toi, ic):")
    a("    # 2.12.0 (O13): `toi` = Toilet Care, split out of Hard-Surface Cleaner.")
    a("    return dict(zip(CAT_KEYS, [color, care, styling, body, fcn, fca, ffi, lad, hdw, adw, hsc, toi, ic]))")
    a("")
    a("def vc(raw, form, mfg, pkg, sc, mkt, comm, cons):")
    a("    return dict(zip(VC_KEYS, [raw, form, mfg, pkg, sc, mkt, comm, cons]))")
    a("")
    a("def reg(eu, na, asia, hg):")
    a("    return dict(zip(REG_KEYS, [eu, na, asia, hg]))")
    a("")
    a("")
    a("def _ai_snapshot(t):")
    a('    """Immutable AI baseline snapshot of a trend\'s scoreable fields.')
    a("")
    a("    Captured at seed time (June 2026 multi-expert proposals layer) so the")
    a('    "AI suggestion" reference shown alongside human proposals always reflects')
    a("    the originally-seeded values, even after admin edits or endorsements.")
    a("    2.11.0 (O7): includes the uncertainty score.")
    a('    """')
    a("    return {")
    a('        "probability": t.probability,')
    a('        "gp1_pct_affected": t.gp1_pct_affected,')
    a('        "peak_year": t.peak_year,')
    a('        "diffusion_curve": t.diffusion_curve,')
    a('        "uncertainty": getattr(t, "uncertainty", None),')
    a('        "category_exposure": dict(t.category_exposure or {}),')
    a('        "regional_exposure": dict(t.regional_exposure or {}),')
    a('        "vc_exposure": dict(t.vc_exposure or {}),')
    a("    }")
    a("")
    a("")
    a("# ═══════════════════════════════════════════════════════════════════════")
    a("# gp1_pct_affected: the share of the category's 2025-35 GP1 pool that the")
    a("# driver can move at full materialisation (incremental, not installed")
    a("# base); reviewed per driver against the calibration bands of the April")
    a("# 2026 base (market structure 15-25 %, regulatory 5-15 %, behavioural")
    a("# 8-20 %, technology 3-10 %, category creation 3-8 %, competitive 5-15 %).")
    a("# ═══════════════════════════════════════════════════════════════════════")
    a("")
    a("TRENDS = [")

    current_force = None
    for r in recs:
        if r["force"] != current_force:
            current_force = r["force"]
            a("")
            a("    # ═══════════════════════════════════════════════════════════════════")
            a(f"    # FORCE: {current_force.upper()} ({by_force[current_force]} drivers)")
            a("    # ═══════════════════════════════════════════════════════════════════")
        note = status_note(r, verdicts)
        a(f"    # ── {r['code']} · {note} ──")
        a(f"    # {r['tier']} · {r['scope']} · megatrend: {r['megatrend']} · first observed {r.get('first_observed')}")
        c = r["category_exposure"]
        g = r["regional_exposure"]
        v = canonical_vc_profile(r["vc_epicentre"])
        a("    Trend(")
        a(f"        id={q(r['id'])}, force={q(r['force'])}, sub_category={q(r['sub'])},")
        a(f"        name={q(r['title'])},")
        a(f"        description={q(r['desc'])},")
        a(f"        direction={q(r['direction'])}, probability={int(r['prob'])}, start_year={int(r['start'])},")
        a(f"        gp1_pct_affected={float(r['gp1'])!r}, peak_year={int(r['peak'])}, diffusion_curve={q(r['curve'])},")
        a(f"        uncertainty={int(r['uncertainty']['score'])},")
        a(f"        strategic_implication={q(implication_text(r))},")
        a("        category_exposure=cat(" + ", ".join(str(int(c[k])) for k in CATEGORIES) + "),")
        a(f"        vc_exposure=vc(" + ", ".join(str(int(v[k])) for k in VC_STEPS) + f"),  # epicentre {r['vc_epicentre']}")
        a("        regional_exposure=reg(" + ", ".join(str(int(g[k])) for k in REGIONS) + "),")
        a(f"        data_source={q(data_source_text(r))}, source_type={q(majority_source_type(r))},")
        a(f"        confidence={q(r['conf'])},")
        a("        ai_suggested=False, user_override=False,")
        a("    ),")
    a("]")
    a("")
    a("")
    a("# ── Source URLs with credibility tier (S primary / A analyst / B trade press) ──")
    a("SOURCE_URLS = {")
    current_force = None
    for r in recs:
        if r["force"] != current_force:
            current_force = r["force"]
            a(f"    # ═══ {current_force.upper()} ═══")
        a(f"    {q(r['id'])}: [  # {r['code']} {r['title'][:70]}")
        for title, url, grade, date in r["sources"]:
            stype = GRADE_TYPE[grade] + (f" ({date})" if date else "")
            a(f"        {{\"title\": {q(title)}, \"url\": {q(url)}, \"source_type\": {q(stype)}, \"tier\": {q(grade)}}},")
        a("    ],")
    a("}")
    return "\n".join(lines) + SEED_TAIL


# ── code map rendering ─────────────────────────────────────────────────

def build_retired(recs: list[dict], verdicts: dict) -> dict:
    """Retired display codes -> info (name, note, mergedInto / residueIn)."""
    by_review_code = {r["review_code"]: r for r in recs}
    live_codes = {r["code"] for r in recs}
    retired: dict[str, dict] = {}
    for code, (name, note, since) in LEGACY_RETIRED.items():
        retired[code] = {"name": name, "note": note, "retiredIn": since}

    def live_target(c: str) -> str | None:
        rec = by_review_code.get(c)
        return rec["code"] if rec else (c if c in live_codes else None)

    for code, v in sorted(verdicts.items()):
        verdict = v.get("verdict")
        if verdict in ("KEEP", "NEW"):
            continue
        targets = [live_target(t) for t in CODE_RE.findall(v.get("target", ""))]
        targets = [t for t in targets if t]
        info = {"name": v.get("base_name", code), "note": first_sentence(v.get("rationale", ""), 260),
                "retiredIn": "v3.11"}
        if verdict in ("MERGE INTO", "SUBSTITUTE"):
            if not targets:
                raise ValueError(f"{code}: {verdict} without a live target ({v.get('target')!r})")
            info["mergedInto"] = targets
        elif verdict == "DELETE":
            if targets:
                info["residueIn"] = targets
        else:
            raise ValueError(f"{code}: unknown verdict {verdict!r}")
        retired[code] = info
    # force moves: the old code points at the new one
    for r in recs:
        if r["force_moved_from"]:
            old = r["force_moved_from"]
            retired[old] = {"name": verdicts.get(old, {}).get("base_name", old),
                            "note": f"force reassigned to {r['force']} in the September 2026 review; now {r['code']}",
                            "retiredIn": "v3.11", "mergedInto": [r["code"]]}
    for code, info in retired.items():
        assert code not in live_codes, f"{code} is both live and retired"
        for t in info.get("mergedInto", []) + info.get("residueIn", []):
            assert t in live_codes, f"{code} points at {t}, which is not live"
    return dict(sorted(retired.items()))


def render_codemap(recs: list[dict], retired: dict) -> str:
    lines = []
    a = lines.append
    a("/**")
    a(" * trendCodeMap.ts — canonical display-code ↔ trend-ID mapping.")
    a(" *")
    a(" * GENERATED by scripts/generate_seed_from_core_set.py from the same JSON")
    a(" * as pulse/seed_trends.py (September 2026 core set, release 2.11.0).")
    a(" * Single source of truth for the short trend codes used across the")
    a(" * Consumer Journey layer:")
    a(" *   code  = force letter (C/T/G/K/E/X) + the rNN number of the seed trend id")
    a(" *   e.g.  'C-01' ↔ consumer_r01, 'X-15' ↔ competitive_r15.")
    a(" * Names/forces/directions are verbatim from the seed — do NOT hand-edit;")
    a(" * regenerate when the trend base changes.")
    a(" *")
    a(" * RETIRED_CODES: display codes whose trends left the base. Since the")
    a(" * September 2026 review each entry says what happened to the code:")
    a(" *   mergedInto  the driver(s) that carry its content now (merge,")
    a(" *               substitution or force move) — evidence cards resolve")
    a(" *               through it to the live driver;")
    a(" *   residueIn   a deleted driver whose one fact or watch note lives")
    a(" *               inside another driver (still retired, no live link);")
    a(" *   neither     deleted outright (watch list) with the review's reason.")
    a(" */")
    a("")
    a("export type TrendDirection = 'Expansion' | 'Contraction';")
    a("")
    a("export interface TrendCodeInfo {")
    a("  trendId: string;")
    a("  name: string;")
    a("  force: string;")
    a("  direction: TrendDirection;")
    a("  /** First sentence of the seed description — offline fallback only;")
    a("   *  the live description should come from the trends API. */")
    a("  fallbackDescription: string;")
    a("}")
    a("")
    a("export interface RetiredCodeInfo {")
    a("  /** Name the code carried in the base it was retired from. */")
    a("  name: string;")
    a("  /** One-line reason from the review that retired it. */")
    a("  note: string;")
    a("  /** Base version that retired the code. */")
    a("  retiredIn: 'v3.1' | 'v3.3' | 'v3.11';")
    a("  /** Live code(s) that carry this driver's content now. */")
    a("  mergedInto?: string[];")
    a("  /** Live code(s) that keep a fact or watch note from this deleted driver. */")
    a("  residueIn?: string[];")
    a("}")
    a("")
    a("export const TREND_CODE_MAP: Record<string, TrendCodeInfo> = {")
    for r in sorted(recs, key=lambda x: x["code"]):
        info = {"trendId": r["id"], "name": r["title"], "force": r["force"],
                "direction": r["direction"], "fallbackDescription": first_sentence(r["desc"])}
        a(f"  '{r['code']}': {json.dumps(info, ensure_ascii=False)},")
    a("};")
    a("")
    a("/** Codes that left the base: v3.1 (C-12, K-05), v3.3 (T-09) and the")
    a(f" *  September 2026 review ({sum(1 for v in retired.values() if v['retiredIn'] == 'v3.11')} codes, release 2.11.0). */")
    a("export const RETIRED_CODES: Record<string, RetiredCodeInfo> = {")
    for code, info in retired.items():
        a(f"  '{code}': {json.dumps(info, ensure_ascii=False)},")
    a("};")
    a("")
    a("const ID_TO_CODE: Record<string, string> = Object.fromEntries(")
    a("  Object.entries(TREND_CODE_MAP).map(([code, v]) => [v.trendId, code]),")
    a(");")
    a("")
    a("export const trendIdForCode = (code: string): string | undefined => TREND_CODE_MAP[code]?.trendId;")
    a("export const codeForTrendId = (trendId: string): string | undefined => ID_TO_CODE[trendId];")
    a("")
    a("/** The live code a citation resolves to: itself when live, the first")
    a(" *  merged-into target when the code was absorbed, undefined when the")
    a(" *  driver was deleted (a residue note is not a live driver). */")
    a("export const liveCodeFor = (code: string): string | undefined => {")
    a("  if (TREND_CODE_MAP[code]) return code;")
    a("  const target = RETIRED_CODES[code]?.mergedInto?.[0];")
    a("  return target && TREND_CODE_MAP[target] ? target : undefined;")
    a("};")
    a("")
    return "\n".join(lines)


# ── main ───────────────────────────────────────────────────────────────

def generate() -> tuple[str, str, list[dict], dict]:
    core = json.loads(CORE_SET.read_text(encoding="utf-8"))
    verdicts = json.loads(VERDICTS.read_text(encoding="utf-8"))
    recs = assign_identities(core)
    # structural checks on the reviewed set
    for r in recs:
        assert set(r["category_exposure"]) == set(CATEGORIES), r["code"]
        assert set(r["regional_exposure"]) == set(REGIONS), r["code"]
        assert set(r["vc_exposure"]) == set(VC_STEPS), r["code"]
        assert vc_epicentre_step_of(r["vc_exposure"]) == r["vc_epicentre"], (
            f"{r['code']}: reviewed profile epicentre {vc_epicentre_step_of(r['vc_exposure'])} "
            f"!= stated {r['vc_epicentre']}")
        assert 0 < float(r["gp1"]) <= 1 and 1 <= int(r["prob"]) <= 5, r["code"]
        assert 2025 <= int(r["start"]) <= int(r["peak"]) <= 2035, r["code"]
        assert 0 <= int(r["uncertainty"]["score"]) <= 5, r["code"]
        assert r["sources"], f"{r['code']}: no sources"
        for s in r["sources"]:
            assert s[1].startswith("http") and s[2] in GRADE_TYPE, (r["code"], s)
    order = {f: i for i, f in enumerate(FORCE_ORDER)}
    recs.sort(key=lambda r: (order[r["force"]], r["id"]))
    retired = build_retired(recs, verdicts)
    return render_seed(recs, verdicts), render_codemap(recs, retired), recs, retired


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="verify the committed outputs match; write nothing")
    args = ap.parse_args()
    seed_src, codemap_src, recs, retired = generate()
    if args.check:
        ok = True
        for path, src in ((SEED_OUT, seed_src), (CODEMAP_OUT, codemap_src)):
            if not path.exists() or path.read_text(encoding="utf-8") != src:
                print(f"STALE: {path.relative_to(ROOT)} differs from the generator output")
                ok = False
        print("OK: committed outputs match the generator" if ok else "Re-run the generator without --check")
        return 0 if ok else 1
    SEED_OUT.write_text(seed_src, encoding="utf-8")
    CODEMAP_OUT.write_text(codemap_src, encoding="utf-8")
    by_force = collections.Counter(r["force"] for r in recs)
    print(f"Wrote {SEED_OUT.relative_to(ROOT)}: {len(recs)} drivers "
          + ", ".join(f"{f} {by_force[f]}" for f in FORCE_ORDER))
    print(f"Wrote {CODEMAP_OUT.relative_to(ROOT)}: {len(recs)} live codes, {len(retired)} retired codes")
    for r in recs:
        if r["force_moved_from"]:
            print(f"  force move: {r['force_moved_from']} -> {r['code']} ({r['id']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
