"""Build the per-driver attribution record and render the PRISM Analysis texts from it.

    python3 scripts/build_driver_analysis.py                  record, parity fixture and texts
    python3 scripts/build_driver_analysis.py --reference      also re-run the 3 x 50,000 reference run
    python3 scripts/build_driver_analysis.py --check          CI: the committed files match this code
    python3 scripts/build_driver_analysis.py --workbook FILE   record which production run is reproduced

Files
  data/drivers/driver_attribution.json   the figures (generated)
  data/drivers/driver_analysis.json      one hand-written template per driver and the text
                                         rendered from it (generated)
  tests/frontend/fixtures/driverAttribution.fixture.json
                                         parity fixture for lib/driverAttribution.ts, the
                                         port of the decomposition the category drill-down uses

The files are built on the default cell weights, the estimated gross-profit
mix, and the templates are written for it: several name the estimate and
compare shares of it in words. There is deliberately no option to render them
on other shares; readings on the finance shares need templates written for
those shares first (docs/DRIVER_ANALYSIS.md, "On the finance shares").

The figures come from prism/attribution.py (the method is described there and
in docs/DRIVER_ANALYSIS.md) and the texts from prism/readings.py.
`--check` fails when a committed file differs from what the code produces
from the driver base and the configuration, when the reference run was made
on other inputs (their digest), or when it does not reproduce the production
run recorded with --workbook.

After a re-scoring: run scripts/run_production.py, then this script with
--reference --workbook FILE, review the re-rendered texts, run
scripts/generate_seed.py and scripts/sync_analysis.py.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, REPO)

# The record is a function of the driver base and the configuration, never of
# a database: blank the URLs before prism.env_loader can read .env.
os.environ["DATABASE_URL"] = ""
os.environ["POSTGRES_URL"] = ""

from prism import attribution  # noqa: E402
from prism.attribution import TERMINAL_YEAR  # noqa: E402
from prism.config import PRODUCTION_CHAINS, PRODUCTION_ITERATIONS, PRODUCTION_SEED, ModelConfig  # noqa: E402
from prism.driver_base import base_drivers  # noqa: E402
from prism.readings import render_all  # noqa: E402
from prism.workbook import read_workbook  # noqa: E402

DATA_DIR = os.path.join(REPO, "data", "drivers")
ATTRIBUTION_PATH = os.path.join(DATA_DIR, "driver_attribution.json")
ANALYSIS_PATH = os.path.join(DATA_DIR, "driver_analysis.json")
#: Parity fixture for lib/driverAttribution.ts (the Shift Analysis uses the
#: same decomposition): the inputs and the unscaled expected outputs.
FIXTURE_PATH = os.path.join(REPO, "tests", "frontend", "fixtures", "driverAttribution.fixture.json")


def _load_json(path: str) -> dict:
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def _dump_json(path: str, obj: dict) -> None:
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=1, ensure_ascii=False)
        fh.write("\n")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="verify the committed record and texts, write nothing")
    ap.add_argument("--reference", action="store_true", help="rerun the reference run (the production recipe)")
    ap.add_argument("--chains", type=int, default=PRODUCTION_CHAINS)
    ap.add_argument("--iterations", type=int, default=PRODUCTION_ITERATIONS)
    ap.add_argument("--workbook", default=None,
                    help="the QA workbook of the production run the reference should reproduce")
    args = ap.parse_args(argv)

    drivers = base_drivers()   # ordered by id, as the production run loads them
    config = ModelConfig()

    committed = _load_json(ATTRIBUTION_PATH) if os.path.exists(ATTRIBUTION_PATH) else None
    current_hash = attribution.inputs_hash(config, drivers)
    if args.reference or committed is None:
        print(f"reference run: {args.chains} x {args.iterations} iterations, seed {PRODUCTION_SEED} ...", flush=True)
        reference = attribution.reference_run(config, drivers, args.chains, args.iterations)
        print(f"  terminal-year portfolio median {reference['portfolio_terminal']['median']*100:+.3f} pp "
              f"[{reference['portfolio_terminal']['p10']*100:+.3f}, {reference['portfolio_terminal']['p90']*100:+.3f}]")
    else:
        reference = committed["reference_run"]
        if reference.get("inputs_hash") != current_hash and not args.check:
            print("REFUSING: the drivers' scoring state or the configuration changed since the recorded reference "
                  "run, so its median is not the current model's. Re-run with --reference --workbook FILE after "
                  "the production run.")
            return 1

    persisted = read_workbook(args.workbook, TERMINAL_YEAR) if args.workbook else (committed or {}).get("persisted_run")
    record = attribution.build_record(config, drivers, reference, persisted)
    fixture = attribution.build_fixture(config, drivers, attribution.decompose(config, drivers))
    analysis = _load_json(ANALYSIS_PATH) if os.path.exists(ANALYSIS_PATH) else {"drivers": {}}
    texts = render_all(record, analysis) if analysis.get("drivers") else {}

    if args.check:
        problems = []
        if committed is None:
            problems.append(f"{os.path.relpath(ATTRIBUTION_PATH, REPO)} is missing")
        elif not attribution.records_match(attribution.strip_volatile(committed), attribution.strip_volatile(record), attribution.RECORD_ATOL):
            problems.append(f"{os.path.relpath(ATTRIBUTION_PATH, REPO)} differs from the recomputed record "
                            f"(regenerate: python3 scripts/build_driver_analysis.py)")
        if committed is not None and committed["reference_run"].get("inputs_hash") != current_hash:
            problems.append("the drivers' scoring state or the configuration changed since the committed reference "
                            "run (its inputs digest differs): re-run with --reference --workbook FILE")
        if persisted:
            for line in attribution.reference_reproduces(reference, persisted):
                problems.append(f"the reference run does not reproduce production run {persisted.get('id')}: {line}")
        for code, entry in analysis.get("drivers", {}).items():
            driver_id = next((i for i, d in record["drivers"].items() if d["code"] == code), None)
            if driver_id and entry.get("text") != texts.get(driver_id):
                problems.append(f"{code}: rendered text differs from the committed one (regenerate)")
        if not os.path.exists(FIXTURE_PATH):
            problems.append(f"{os.path.relpath(FIXTURE_PATH, REPO)} is missing")
        elif not attribution.records_match(_load_json(FIXTURE_PATH), json.loads(json.dumps(fixture)), attribution.FIXTURE_ATOL, attribution.FIXTURE_RTOL):
            problems.append(f"{os.path.relpath(FIXTURE_PATH, REPO)} differs from the recomputed fixture (regenerate)")
        if problems:
            print("driver analysis check FAILED:")
            for p in problems:
                print("  -", p)
            return 1
        print("driver analysis check OK: record, fixture and texts match the driver base and the configuration.")
        return 0

    if persisted:
        mismatch = attribution.reference_reproduces(reference, persisted)
        if mismatch:
            print(f"WARNING: the reference run does not reproduce production run {persisted.get('id')} "
                  f"({len(mismatch)} quantile(s) differ, first: {mismatch[0]}). Either the drivers or the "
                  f"configuration changed since that run, or the workbook is not this run's: record the "
                  f"new production run with --workbook, or run run_production.py first.")
        else:
            print(f"reference run reproduces persisted run {persisted.get('id')} ({persisted.get('generated')}) "
                  f"at every terminal-year category quantile")
    _dump_json(ATTRIBUTION_PATH, record)
    print(f"wrote {os.path.relpath(ATTRIBUTION_PATH, REPO)} "
          f"({len(record['drivers'])} drivers, factor {record['reconciliation']['factor']:.4f})")
    _dump_json(FIXTURE_PATH, fixture)
    print(f"wrote {os.path.relpath(FIXTURE_PATH, REPO)} (parity fixture for lib/driverAttribution.ts)")
    if texts:
        for code, entry in analysis["drivers"].items():
            driver_id = next(i for i, d in record["drivers"].items() if d["code"] == code)
            entry["text"] = texts[driver_id]
        _dump_json(ANALYSIS_PATH, analysis)
        print(f"wrote {os.path.relpath(ANALYSIS_PATH, REPO)} ({len(texts)} rendered texts)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
