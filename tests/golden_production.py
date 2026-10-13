"""The production golden pin: the engine on the production configuration.

tests/test_golden_pipeline.py pins the engine on five fixture drivers with the
peak-year jitter off. This pin runs the configuration a production run uses
(the 51 drivers of the driver base in id order, the default ModelConfig with
the estimated cell weights and the jitter on, the production seed and three
chains) at 2,000 iterations per chain, so any change to how the engine draws
or combines its numbers on the real base fails a test, not only a change the
fixture drivers can see.

The pinned values live in golden_production.json next to this file. They
change only together with MODEL_VERSION (a deliberate change of the model) or
with the driver base, in the same commit as that change:

    python3 tests/golden_production.py --write

Never rewrite them to make a test pass.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from prism.config import CATEGORIES, PRODUCTION_CHAINS, PRODUCTION_SEED, REGIONS, ModelConfig  # noqa: E402
from prism.drivers import DriverSet  # noqa: E402
from prism.engine import MonteCarloEngine  # noqa: E402
from prism.seed_drivers import get_seed_drivers  # noqa: E402

PINS_FILE = Path(__file__).with_name("golden_production.json")
ITERATIONS = 2_000
#: Years whose category bands are pinned (every year is pinned for the portfolio).
CATEGORY_YEARS = (2026, 2030, 2035)
STATISTICS = ("p10", "median", "p90")


def production_drivers() -> list:
    """The driver base as a production run loads it: ordered by id."""
    return sorted(get_seed_drivers(), key=lambda d: d.id)


def production_result(iterations: int = ITERATIONS, chains: int = PRODUCTION_CHAINS) -> dict:
    """The engine's result on the production configuration at this size."""
    engine = MonteCarloEngine(ModelConfig(), seed=PRODUCTION_SEED)
    return engine.run(DriverSet(drivers=production_drivers()), iterations=iterations, chains=chains)


def pinned_values(result: dict) -> dict:
    """The numbers the pin holds, keyed by where they come from."""
    values: dict = {}
    for year, band in result["totals"]["portfolio"].items():
        for stat in STATISTICS:
            values[f"portfolio/{year}/{stat}"] = band[stat]
    for category in CATEGORIES:
        path = result["shift_matrix"][category]["path"]
        for year in CATEGORY_YEARS:
            for stat in STATISTICS:
                values[f"category/{category}/{year}/{stat}"] = path[year][stat]
    last = max(result["shift_matrix"][CATEGORIES[0]]["path"])
    for category in CATEGORIES:
        for region in REGIONS:
            values[f"cell/{category}/{region}/{last}/median"] = \
                result["regional_shift_matrix"][category][region]["path"][last]["median"]
    for i, median in enumerate(result["seed_stability"]["per_chain_medians"]):
        values[f"chain/{i}/median"] = median
    return {key: float(value) for key, value in values.items()}


def write_pins() -> dict:
    result = production_result()
    pins = {
        "about": "The engine on the production configuration (tests/golden_production.py); regenerated only "
                 "with MODEL_VERSION or the driver base, never to make a test pass.",
        "model_version": result["model_version"],
        "seed": result["seed"],
        "chains": result["chains"],
        "iterations": ITERATIONS,
        "driver_count": len(production_drivers()),
        "values": pinned_values(result),
    }
    PINS_FILE.write_text(json.dumps(pins, indent=1, sort_keys=False) + "\n", encoding="utf-8")
    return pins


def main(argv: list | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--write", action="store_true", help=f"recompute and write {PINS_FILE.name}")
    args = parser.parse_args(argv)
    if not args.write:
        parser.print_help()
        return 2
    pins = write_pins()
    print(f"Wrote {len(pins['values'])} values to {PINS_FILE.relative_to(REPO)} (model {pins['model_version']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
