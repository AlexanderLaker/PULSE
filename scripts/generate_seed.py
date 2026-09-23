"""Generate the seed module and the display-code map from the driver base.

Inputs
  data/drivers/driver_base.json      the drivers: scores, exposures, sources
  data/drivers/driver_analysis.json  the PRISM Analysis text of every driver,
                                     rendered on data/drivers/driver_attribution.json
                                     by scripts/build_driver_analysis.py

Outputs (committed, never edited by hand)
  prism/seed_drivers.py              the drivers a new database is seeded with
  data/driverCodeMap.ts              display code <-> driver id for the dashboard

The generator validates the base before writing: every taxonomy key present,
scores in range, onset before peak, the value-chain epicentre a known stage,
and at least one source of tier S, A or B behind every driver. The value
chain is written as the editor's canonical 5/3/1 profile around the
epicentre, which is the only part of it the engine reads.

    python3 scripts/generate_seed.py            write both files
    python3 scripts/generate_seed.py --check    exit 1 if a committed file differs
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

from prism.config import (CATEGORIES, DEFAULT_BASE_YEAR, DEFAULT_PATH_YEARS, FORCES, REGIONS,  # noqa: E402
                          VALID_DIFFUSION_CURVES, VC_STEPS, canonical_vc_profile, display_code,
                          vc_epicentre_step_of)

BASE = ROOT / "data" / "drivers" / "driver_base.json"
ANALYSIS = ROOT / "data" / "drivers" / "driver_analysis.json"
ATTRIBUTION = ROOT / "data" / "drivers" / "driver_attribution.json"
SEED_OUT = ROOT / "prism" / "seed_drivers.py"
CODEMAP_OUT = ROOT / "data" / "driverCodeMap.ts"

#: Order of the forces in the generated files (largest first, then related).
FORCE_ORDER = ["Consumer", "Customer", "Competitive", "Technology", "Government", "Environmental"]
SOURCE_TIERS = ("S", "A", "B")


def q(s) -> str:
    """A double-quoted Python string literal (JSON escapes are valid Python)."""
    return json.dumps("" if s is None else str(s), ensure_ascii=False)


def first_sentence(text: str, cap: int = 220) -> str:
    """The description's first sentence, capped. A sentence ends at . ! or ?
    after a lowercase letter, a digit or a closing mark, so an initialism
    ("P.L. 119-21", "U.S.") does not end one."""
    text = (text or "").strip()
    m = re.search(r"(?<=[a-z0-9%)\]\"'’”][.!?])\s+(?=[A-Z0-9])", text)
    first = text[: m.start()] if m else text
    return first if len(first) <= cap else first[: cap - 1].rstrip() + "…"


def epicentre_profile(epicentre: str) -> dict:
    """The stored profile of the base's epicentre stage (prism.config.canonical_vc_profile)."""
    return canonical_vc_profile(VC_STEPS.index(epicentre) + 1)


def validate(drivers: list) -> None:
    """Refuse a base the engine or the dashboard could not use."""
    problems = []
    ids, codes = collections.Counter(d["id"] for d in drivers), collections.Counter(d["code"] for d in drivers)
    problems += [f"duplicate id {i}" for i, n in ids.items() if n > 1]
    problems += [f"duplicate code {c}" for c, n in codes.items() if n > 1]
    for d in drivers:
        tag = d.get("code", d.get("id"))
        m = re.fullmatch(r"([a-z]+)_r(\d{2})", d["id"])
        if d["force"] not in FORCES:
            problems.append(f"{tag}: unknown force {d['force']!r}")
        elif not m or m.group(1) != d["force"].lower() or d["code"] != display_code(d["id"], d["force"]):
            problems.append(f"{tag}: id {d['id']!r} and code {d['code']!r} do not follow force + number")
        if d["direction"] not in ("Expansion", "Contraction"):
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
        if d["confidence"] not in ("High", "Medium", "Low"):
            problems.append(f"{tag}: confidence {d['confidence']!r}")
        if set(d["category_exposure"]) != set(CATEGORIES) or set(d["regional_exposure"]) != set(REGIONS):
            problems.append(f"{tag}: category or regional exposure keys differ from the taxonomy")
        if any(not 0 <= v <= 5 for v in list(d["category_exposure"].values()) + list(d["regional_exposure"].values())):
            problems.append(f"{tag}: an exposure score outside 0-5")
        if d["vc_epicentre"] not in VC_STEPS:
            problems.append(f"{tag}: value-chain epicentre {d['vc_epicentre']!r}")
        elif vc_epicentre_step_of(epicentre_profile(d["vc_epicentre"])) != d["vc_epicentre"]:
            problems.append(f"{tag}: the canonical profile does not reproduce its epicentre")
        if not any(s.get("tier") in SOURCE_TIERS for s in d["sources"]):
            problems.append(f"{tag}: no source of tier {'/'.join(SOURCE_TIERS)}")
        for s in d["sources"]:
            if not str(s.get("url", "")).startswith("http") or not s.get("title"):
                problems.append(f"{tag}: a source without a title or an http(s) URL")
    if problems:
        raise SystemExit("driver base is not valid:\n  " + "\n  ".join(problems))


def driver_from_base(d: dict, analysis: str = ""):
    """The Driver object a base entry becomes; the generated module builds the same."""
    from prism.drivers import Driver
    return Driver(
        id=d["id"], force=d["force"], name=d["name"], description=d["description"],
        direction=d["direction"], probability=d["probability"], start_year=d["start_year"],
        gp1_pct_affected=float(d["gp1_pct_affected"]), peak_year=d["peak_year"],
        diffusion_curve=d["diffusion_curve"], uncertainty=d["uncertainty"], confidence=d["confidence"],
        category_exposure={c: d["category_exposure"][c] for c in CATEGORIES},
        vc_exposure=epicentre_profile(d["vc_epicentre"]),
        regional_exposure={r: d["regional_exposure"][r] for r in REGIONS},
        sources=[{"title": s["title"], "url": s["url"], "tier": s["tier"], "note": s.get("published", "")}
                 for s in d["sources"]],
        analysis=analysis,
    )


def base_drivers() -> list:
    """The drivers of the base as Driver objects, ordered by id as the database returns them.

    scripts/build_driver_analysis.py computes the attribution from these, so the
    record never depends on the generated module it feeds.
    """
    drivers = json.loads(BASE.read_text(encoding="utf-8"))["drivers"]
    validate(drivers)
    return [driver_from_base(d) for d in sorted(drivers, key=lambda d: d["id"])]


def load_analysis() -> dict:
    """{code: PRISM Analysis text}, each verified to be its template rendered on the record.

    A template edited without re-rendering, or a record rebuilt without
    re-rendering the texts, stops the generator here instead of shipping a
    stale text.
    """
    from scripts.driver_analysis_render import render_all
    analysis = json.loads(ANALYSIS.read_text(encoding="utf-8"))
    record = json.loads(ATTRIBUTION.read_text(encoding="utf-8"))
    rendered = render_all(record, analysis)
    code_to_id = {d["code"]: driver_id for driver_id, d in record["drivers"].items()}
    texts = {}
    for code, entry in analysis["drivers"].items():
        if entry.get("text") != rendered[code_to_id[code]]:
            raise SystemExit(f"{ANALYSIS.relative_to(ROOT)}: the text of {code} is not its template rendered on "
                             f"{ATTRIBUTION.relative_to(ROOT)}; run scripts/build_driver_analysis.py")
        texts[code] = entry["text"]
    return texts


def render_seed(drivers: list, texts: dict) -> str:
    by_force = collections.Counter(d["force"] for d in drivers)
    by_dir = collections.Counter(d["direction"] for d in drivers)
    lines = []
    a = lines.append
    a('"""The Profit Pool Drivers a new database is seeded with.')
    a("")
    a("Generated by scripts/generate_seed.py from data/drivers/driver_base.json and")
    a("the PRISM Analysis texts in data/drivers/driver_analysis.json. Do not edit")
    a("this file: change the JSON and re-run the generator.")
    a("")
    a(f"{len(drivers)} drivers: " + ", ".join(f"{f} {by_force.get(f, 0)}" for f in FORCE_ORDER) + ";")
    a(f"{by_dir.get('Contraction', 0)} Contraction, {by_dir.get('Expansion', 0)} Expansion.")
    a('"""')
    a("import copy")
    a("")
    a("from prism.config import CATEGORIES, REGIONS, VC_STEPS")
    a("from prism.drivers import Driver")
    a("")
    a("")
    a("def _categories(*scores):")
    a("    return dict(zip(CATEGORIES, scores))")
    a("")
    a("")
    a("def _value_chain(*scores):")
    a("    return dict(zip(VC_STEPS, scores))")
    a("")
    a("")
    a("def _regions(*scores):")
    a("    return dict(zip(REGIONS, scores))")
    a("")
    a("")
    a("DRIVERS = [")
    force = None
    for d in drivers:
        if d["force"] != force:
            force = d["force"]
            a(f"    # ── {force} ({by_force[force]}) " + "─" * max(0, 60 - len(force)))
        a(f"    # {d['code']} · {d['theme']} · {d['foresight_tier']}, {d['scope']} · "
          f"megatrend: {d['megatrend']} · first observed {d['first_observed']}")
        cat, reg = d["category_exposure"], d["regional_exposure"]
        vc = epicentre_profile(d["vc_epicentre"])
        a("    Driver(")
        a(f"        id={q(d['id'])}, force={q(d['force'])},")
        a(f"        name={q(d['name'])},")
        a(f"        description={q(d['description'])},")
        a(f"        direction={q(d['direction'])}, probability={d['probability']}, start_year={d['start_year']},")
        a(f"        gp1_pct_affected={float(d['gp1_pct_affected'])!r}, peak_year={d['peak_year']}, "
          f"diffusion_curve={q(d['diffusion_curve'])}, uncertainty={d['uncertainty']},")
        a(f"        confidence={q(d['confidence'])},")
        a("        category_exposure=_categories(" + ", ".join(str(cat[c]) for c in CATEGORIES) + "),")
        a("        vc_exposure=_value_chain(" + ", ".join(str(vc[s]) for s in VC_STEPS)
          + f"),  # epicentre {d['vc_epicentre']}")
        a("        regional_exposure=_regions(" + ", ".join(str(reg[r]) for r in REGIONS) + "),")
        a("        sources=[")
        for s in d["sources"]:
            a(f"            {{\"title\": {q(s['title'])}, \"url\": {q(s['url'])}, "
              f"\"tier\": {q(s['tier'])}, \"note\": {q(s.get('published', ''))}}},")
        a("        ],")
        try:
            a(f"        analysis={q(texts[d['code']])},")
        except KeyError:
            raise SystemExit(f"{ANALYSIS.relative_to(ROOT)}: no PRISM Analysis for driver {d['code']}") from None
        a("    ),")
    a("]")
    a("")
    a("")
    a("def get_seed_drivers() -> list:")
    a('    """Fresh copies of the seed drivers, each with its baseline recorded."""')
    a("    drivers = copy.deepcopy(DRIVERS)")
    a("    for d in drivers:")
    a("        d.baseline = d.scores()")
    a("    return drivers")
    return "\n".join(lines) + "\n"


def render_codemap(drivers: list) -> str:
    lines = []
    a = lines.append
    a("/**")
    a(" * Display codes of the drivers (C-01, K-13, ...) and what each one stands for.")
    a(" *")
    a(" * Generated by scripts/generate_seed.py from data/drivers/driver_base.json;")
    a(" * do not edit. A code is the force letter (C Consumer, K Customer, T")
    a(" * Technology, G Government, E Environmental, X Competitive) and the number")
    a(" * of the driver id: 'C-01' is consumer_r01. The Consumer Journey content")
    a(" * cites drivers by these codes.")
    a(" */")
    a("")
    a("import type { Direction, ForceName } from '@/types';")
    a("")
    a("export interface DriverCodeInfo {")
    a("  driverId: string;")
    a("  name: string;")
    a("  force: ForceName;")
    a("  direction: Direction;")
    a("  /** First sentence of the description, shown until the drivers API has answered. */")
    a("  fallbackDescription: string;")
    a("}")
    a("")
    a("export const DRIVER_CODE_MAP: Record<string, DriverCodeInfo> = {")
    for d in sorted(drivers, key=lambda x: x["code"]):
        info = {"driverId": d["id"], "name": d["name"], "force": d["force"],
                "direction": d["direction"], "fallbackDescription": first_sentence(d["description"])}
        a(f"  '{d['code']}': {json.dumps(info, ensure_ascii=False)},")
    a("};")
    a("")
    a("const ID_TO_CODE: Record<string, string> = Object.fromEntries(")
    a("  Object.entries(DRIVER_CODE_MAP).map(([code, v]) => [v.driverId, code]),")
    a(");")
    a("")
    a("export const codeForDriverId = (driverId: string): string | undefined => ID_TO_CODE[driverId];")
    return "\n".join(lines) + "\n"


def generate() -> tuple:
    drivers = json.loads(BASE.read_text(encoding="utf-8"))["drivers"]
    validate(drivers)
    order = {f: i for i, f in enumerate(FORCE_ORDER)}
    drivers = sorted(drivers, key=lambda d: (order[d["force"]], d["id"]))
    return render_seed(drivers, load_analysis()), render_codemap(drivers), drivers


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="compare with the committed files; write nothing")
    args = ap.parse_args(argv)
    seed_src, codemap_src, drivers = generate()
    if args.check:
        stale = [p for p, src in ((SEED_OUT, seed_src), (CODEMAP_OUT, codemap_src))
                 if not p.exists() or p.read_text(encoding="utf-8") != src]
        for p in stale:
            print(f"STALE: {p.relative_to(ROOT)} differs from the generator output")
        print("Re-run scripts/generate_seed.py" if stale else "OK: the committed files match the generator")
        return 1 if stale else 0
    SEED_OUT.write_text(seed_src, encoding="utf-8")
    CODEMAP_OUT.write_text(codemap_src, encoding="utf-8")
    counts = collections.Counter(d["force"] for d in drivers)
    print(f"wrote {SEED_OUT.relative_to(ROOT)} and {CODEMAP_OUT.relative_to(ROOT)}: {len(drivers)} drivers ("
          + ", ".join(f"{f} {counts[f]}" for f in FORCE_ORDER) + ")")
    return 0


if __name__ == "__main__":
    sys.exit(main())
