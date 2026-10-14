"""The figures the documents quote are the code's.

A reader takes a parameter, a table, a count or a tolerance from the documents
without checking it against the code, so each such figure is computed here
from the code, the driver base or a generated record, and the document must
say it as written; the same holds for the design tokens docs/DESIGN.md lists.
A change to any of them fails here until the documents say the same. The
reference run's headline that docs/MODEL.md quotes is held in
tests/test_driver_analysis.py, next to the record it comes from.
"""
import collections
import dataclasses
import json
import math
import re
from pathlib import Path

import numpy as np
import pytest

from prism import attribution, engine, readings
from prism.config import (BASE_YEAR, BETA_PRIOR_FLOOR, CATEGORIES, DEFAULT_CELL_WEIGHTS, DEFAULT_FORCE_CORRELATIONS,
                          DEFAULT_FORCE_OVERLAP_MATRIX, DEFAULT_FORCE_WEIGHTS, DEFAULT_PATH_YEARS,
                          DEFAULT_PER_FORCE_ATTENUATION, DEFAULT_WITHIN_FORCE_OVERLAP, DEFAULT_WITHIN_FORCE_RHO,
                          FORCES, POSITIVE_DEFINITE_FLOOR, PRODUCTION_CHAINS, PRODUCTION_ITERATIONS,
                          PRODUCTION_SEED, REGIONS,
                          RUN_CHAINS_RANGE, RUN_ITERATIONS_RANGE, UNCERTAINTY_KAPPA, UNCERTAINTY_PEAK_JITTER,
                          VALID_DIFFUSION_CURVES, ModelConfig, beta_prior_for, cell_weight_marginals,
                          compute_materialization_schedule)
from prism.config_validation import SUM_TOLERANCE, model_config_problems
from prism.driver_base import load_base
from prism.drivers import DriverSet
from prism.input_drift import WARNING_CHANGES
from prism.seed_drivers import get_seed_drivers
from support import load_module

REPO = Path(__file__).resolve().parents[1]
FIRST, LAST = DEFAULT_PATH_YEARS[0], DEFAULT_PATH_YEARS[-1]
CELLS = len(CATEGORIES) * len(REGIONS)
WORDS = {1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine",
         10: "ten", 11: "eleven", 12: "twelve", 30: "thirty"}


def sci(x: float) -> str:
    """A small number as the documents write it: 1e-12, 1.5e-6."""
    return re.sub(r"e-0*(\d)", r"e-\1", f"{x:g}")


def doc(relative: str) -> str:
    """A document with its line breaks folded into spaces, so that a phrase can run across lines."""
    return " ".join((REPO / relative).read_text(encoding="utf-8").split())


def source(relative: str) -> str:
    return (REPO / relative).read_text(encoding="utf-8")


def category_labels() -> dict:
    """The label the dashboard shows for each category (lib/format.ts)."""
    return dict(re.findall(r"\{ name: '([^']+)',\s+label: '([^']+)'", source("lib/format.ts")))


def assert_quotes(relative: str, *phrases: str) -> None:
    text = doc(relative)
    for phrase in phrases:
        assert phrase in text, f"{relative} should say: {phrase}"


# ── the driver base ─────────────────────────────────────────────────────────

def test_the_driver_counts():
    base = load_base()
    n = len(base)
    by_force = collections.Counter(d["force"] for d in base)
    by_direction = collections.Counter(d["direction"] for d in base)
    assert_quotes("README.md", f"Experts score {n} Profit Pool Drivers")
    assert_quotes("CLAUDE.md", f"estimates how {n} scored Profit Pool Drivers")
    assert_quotes("docs/DRIVERS.md", f"The base has {n} of them",
                  f"{by_direction['Contraction']} drivers contract the pool and {by_direction['Expansion']} expand it")
    assert_quotes("docs/DRIVER_ANALYSIS.md", f"The {n} contributions then add up")
    assert_quotes("migrations/0001_driver_schema/README.md", f"`copied` to show {n} drivers",
                  f'`"driver_count": {n}`')
    table = re.findall(r"^\| (\w+)[^|\n]*\| [A-Z] \| (\d+) \|$", source("docs/DRIVERS.md"), re.M)
    assert {force: int(count) for force, count in table} == dict(by_force)


def test_the_sec_filings_graded_s():
    """docs/DRIVERS.md: the base grades the results exhibits of SEC 8-K filings S, and names how many."""
    cited = [s for d in load_base() for s in d["sources"] if "8-K" in s["title"]]
    assert {s["tier"] for s in cited} == {"S"}
    assert {s["title"].split()[0] for s in cited} == {"Amazon", "P&G"}
    assert_quotes("docs/DRIVERS.md", f"cites from SEC 8-K filings (Amazon and P&G, {WORDS[len(cited)]} citations) S")


# ── the taxonomy, the horizon and the production recipe ─────────────────────

def test_the_taxonomy_and_the_horizon():
    cells = f"{CELLS} composite cells, {len(CATEGORIES)} categories times {len(REGIONS)} regions"
    assert_quotes("docs/MODEL.md", cells, f"each year from {FIRST} to {LAST}", f"(the {CELLS} shares sum to 1)",
                  f"each of the {CELLS} cells", f"{len(CATEGORIES)}-category exposure vectors")
    assert_quotes("docs/adr/0005-regional-cells-and-cell-weights.md", cells)
    assert_quotes("docs/DRIVER_ANALYSIS.md", f"over all {CELLS} cells", f"the sum over the {CELLS} cells",
                  f"each of the {len(CATEGORIES)} categories")
    assert_quotes("CLAUDE.md", f"{len(CATEGORIES)} categories in {len(REGIONS)} regions, {FIRST} to {LAST}")
    assert_quotes("README.md", f"between {FIRST} and {LAST}", f"`GP1_{LAST} = GP1_today x (1 + shift)`")
    assert_quotes("docs/MODEL.md", f"`GP1_{LAST} = GP1_today x (1 + shift)`")
    assert_quotes("docs/OPERATIONS.md", f"whenever the served {LAST} median differs")
    assert_quotes("docs/DRIVERS.md",
                  f"| `start_year` | {BASE_YEAR} to {LAST - 1} |", f"after the onset, at most {LAST}",
                  f"each of the {len(CATEGORIES)} categories", f"each of the {WORDS[len(REGIONS)]} regions",
                  f"The {len(CATEGORIES)} categories, in the engine's order",
                  f"The {WORDS[len(REGIONS)]} regions are {', '.join(REGIONS[:-1])} and {REGIONS[-1]}")
    table = re.findall(r"^\| `([^`]+)` \| ([^|]+) \|", source("docs/DRIVERS.md"), re.M)
    labels = category_labels()
    assert [(key, label.strip()) for key, label in table if key in labels] == [(c, labels[c]) for c in CATEGORIES]


def test_the_production_recipe():
    chains, iterations, seed = PRODUCTION_CHAINS, f"{PRODUCTION_ITERATIONS:,}", PRODUCTION_SEED
    assert_quotes("CLAUDE.md", f"{chains} chains x {iterations} iterations, master seed {seed}")
    assert_quotes("README.md", f"runs {chains} x {iterations} iterations")
    assert_quotes("docs/ARCHITECTURE.md", f"{chains} chains x {iterations}",
                  f"runs {WORDS[chains]} chains of {iterations} iterations with seeds derived from master seed {seed}")
    assert_quotes("docs/MODEL.md", f"| Iterations | {chains} chains x {iterations} in production, master seed {seed} |",
                  f"At {chains} x {iterations} iterations", f"Production runs {WORDS[chains]} chains with seeds",
                  f"of the {WORDS[chains]} chains' terminal-year portfolio medians")
    assert_quotes("docs/OPERATIONS.md", f"at the default {chains} x {iterations} iterations")
    assert_quotes("docs/DRIVER_ANALYSIS.md", f"({chains} x {iterations} iterations, seed {seed})",
                  f"the production recipe ({chains} x {iterations} iterations, seed {seed})")


def test_the_run_sizes_and_the_cell_weights_file():
    """docs/OPERATIONS.md: what the production run accepts on its command line and in the finance file."""
    (low_i, high_i), (low_c, high_c) = RUN_ITERATIONS_RANGE, RUN_CHAINS_RANGE
    assert_quotes("docs/OPERATIONS.md",
                  f"iterations per chain (default {PRODUCTION_ITERATIONS:,}; {low_i:,} to {high_i:,}) and chains "
                  f"(default {PRODUCTION_CHAINS}; {low_c} to {high_c})",
                  f"the {CELLS} shares must add up to 1 within {SUM_TOLERANCE:g}")


# ── the model's parameters and its arithmetic ───────────────────────────────

def test_the_parameter_table():
    """docs/MODEL.md, Parameters: every value as prism/config.py holds it."""
    assert set(DEFAULT_FORCE_WEIGHTS.values()) == {1 / len(FORCES)}
    cross = [DEFAULT_FORCE_CORRELATIONS[a][b] for i, a in enumerate(FORCES) for b in FORCES[i + 1:]]
    assert_quotes(
        "docs/MODEL.md",
        f"| Force weights | 1/{len(FORCES)} for each of the {WORDS[len(FORCES)]} forces |",
        "| Attenuation per force | "
        + ", ".join(f"{f} {DEFAULT_PER_FORCE_ATTENUATION[f]:.3f}" for f in FORCES) + " |",
        "| Within-force overlap | "
        + ", ".join(f"{f} {DEFAULT_WITHIN_FORCE_OVERLAP[f]:.3f}" for f in FORCES) + " |",
        f"| Correlation within a force | {DEFAULT_WITHIN_FORCE_RHO:g} |",
        f"| Correlation across forces | a {len(FORCES)} x {len(FORCES)} matrix, values {min(cross):.2f} to "
        f"{max(cross):.2f} |",
        f"| Cell weights | the estimated HCB gross-profit mix, {len(CATEGORIES)} x {len(REGIONS)} |",
        f"| Base year, path | {BASE_YEAR}; {FIRST} to {LAST} |",
        f"product over the {WORDS[len(FORCES)]} forces",
    )
    assert_quotes("docs/adr/0004-gaussian-copula.md", f"{DEFAULT_WITHIN_FORCE_RHO:g} within a force",
                  f"a {len(FORCES)} x {len(FORCES)} force-pair matrix")


def test_the_correlations_are_restricted_to_the_unit_interval():
    """docs/MODEL.md and ADR 0004: the configured correlations lie in [0, 1], within a force and across
    forces alike; the check refuses others."""
    for rho in (-0.01, 1.01):
        assert any("within_force_rho" in p for p in model_config_problems(ModelConfig(within_force_rho=rho)))
    assert not model_config_problems(ModelConfig(within_force_rho=0.0))
    for value in (-0.01, 1.01):
        matrix = {f: dict(DEFAULT_FORCE_CORRELATIONS[f]) for f in FORCES}
        matrix["Consumer"]["Customer"] = matrix["Customer"]["Consumer"] = value
        assert any("is outside [0, 1]" in p
                   for p in model_config_problems(ModelConfig(force_correlation_matrix=matrix)))
    assert_quotes("docs/MODEL.md", "the correlations are restricted to [0, 1] on the latent scale")
    assert_quotes("docs/adr/0004-gaussian-copula.md", "on the latent scale, restricted to [0, 1]")


def test_the_uncertainty_tables_and_the_prior_means():
    kappa = [UNCERTAINTY_KAPPA[u] for u in range(6)]
    jitter = [UNCERTAINTY_PEAK_JITTER[u] for u in range(6)]
    means = [f"{p / 6:.2f}" for p in range(1, 6)]
    assert_quotes(
        "docs/MODEL.md",
        "| Concentration `kappa` | " + " | ".join(map(str, kappa)) + " |",
        "| Peak-year jitter, years | " + " | ".join(map(str, jitter)) + " |",
        f"The prior means by probability score are {', '.join(means[:-1])} and {means[-1]}.",
    )
    assert_quotes("docs/adr/0003-beta-priors-and-uncertainty.md",
                  f"({', '.join(map(str, kappa))})", f"({', '.join(map(str, jitter))} years)")


def test_the_probability_draw():
    """docs/MODEL.md, step 1: the Beta prior's parameters and the clip of the copula's uniforms."""
    for p in range(1, 6):
        for u in range(6):
            alpha = max(BETA_PRIOR_FLOOR, UNCERTAINTY_KAPPA[u] * p / 6)
            assert beta_prior_for(p, u) == pytest.approx((alpha, max(BETA_PRIOR_FLOOR, UNCERTAINTY_KAPPA[u] - alpha)))
    clip = engine.UNIFORM_CLIP
    assert_quotes("docs/MODEL.md",
                  f"alpha = max({BETA_PRIOR_FLOOR:g}, kappa x p / 6) beta = max({BETA_PRIOR_FLOOR:g}, kappa - alpha)",
                  f"clipped to [{sci(clip)}, 1 - {sci(clip)}]",
                  f"smallest eigenvalue lies above {sci(POSITIVE_DEFINITE_FLOOR)} (`POSITIVE_DEFINITE_FLOOR`)")


def test_the_diffusion_curves():
    """docs/MODEL.md, step 3: each curve as compute_materialization_schedule draws it, for a driver whose
    onset is the base year and whose peak is the horizon (t runs from 0.1 to 1)."""
    ts = [(y - BASE_YEAR) / (LAST - BASE_YEAR) for y in DEFAULT_PATH_YEARS]
    step_share, step_from, slope = 0.05, 0.8, 12

    def logistic(t):
        return 1 / (1 + math.exp(-slope * (t - 0.5)))

    shapes = {
        "linear": lambda t: t,
        "front_loaded": math.sqrt,
        "back_loaded": lambda t: t * t,
        "step_function": lambda t: (step_share if t < step_from
                                    else step_share + (t - step_from) / (1 - step_from) * (1 - step_share)),
        "s_curve": lambda t: (logistic(t) - logistic(0)) / (logistic(1) - logistic(0)),
    }
    assert set(shapes) == set(VALID_DIFFUSION_CURVES)
    for curve, shape in shapes.items():
        schedule = compute_materialization_schedule(LAST, curve, BASE_YEAR, DEFAULT_PATH_YEARS)
        # the schedule is stored to four decimals
        assert [schedule[y] for y in DEFAULT_PATH_YEARS] == pytest.approx([shape(t) for t in ts], abs=5e-5), curve
    assert_quotes("docs/MODEL.md", "| `linear` | `t` |", "| `front_loaded` | `sqrt(t)` |", "| `back_loaded` | `t^2` |",
                  f"| `step_function` | {step_share * 100:g} percent until `t = {step_from:g}`, then a linear rise "
                  f"to 100 percent |",
                  f"| `s_curve` | a logistic with slope {slope} centred at `t = 0.5`, rescaled to run from 0 to 1 |")


def test_the_peak_year_jitter_weights():
    """docs/MODEL.md, step 3: an offset k between -w and +w, drawn with weights w + 1 - |k|."""
    drivers = [dataclasses.replace(d, uncertainty=u) for u, d in zip(range(6), get_seed_drivers())]
    model = engine.MonteCarloEngine(ModelConfig(), seed=PRODUCTION_SEED)
    _, offsets, probabilities = model.peak_schedule_table(drivers)
    for j, d in enumerate(drivers):
        w = UNCERTAINTY_PEAK_JITTER[d.uncertainty]
        weights = [max(0, w + 1 - abs(k)) for k in offsets]
        assert list(probabilities[j]) == pytest.approx([x / sum(weights) for x in weights]), d.uncertainty
    assert_quotes("docs/MODEL.md", "between `-w` and `+w`, drawn with weights `w + 1 - |k|`")


def test_the_within_force_dampening():
    assert_quotes("docs/MODEL.md",
                  f"D_fcr = clip(1 - ov_f x (n_eff - 1) / n_eff, {engine.DAMPENING_FLOOR:g}, 1)")


def test_the_pass_through():
    pass_through = sorted((DEFAULT_FORCE_WEIGHTS[f] * DEFAULT_PER_FORCE_ATTENUATION[f], f) for f in FORCES)
    (low, low_force), (high, high_force) = pass_through[0], pass_through[-1]
    assert_quotes("docs/MODEL.md", f"is the force's pass-through: {low * 100:.1f} percent ({low_force}) to "
                                   f"{high * 100:.1f} percent ({high_force})")


def test_the_published_distribution():
    """docs/MODEL.md and docs/ARCHITECTURE.md name what every path carries per year."""
    assert list(engine.distribution(np.arange(10.0))) == ["p10", "p25", "median", "p75", "p90", "mean", "std"]
    assert_quotes("docs/MODEL.md", "the P10, P25, median, P75, P90, mean and standard deviation per year")
    assert_quotes("docs/ARCHITECTURE.md", "the P10, P25, median, P75, P90, mean and standard deviation of the shift")


def test_the_band_wording():
    """The headline bands name what they cover, as docs/DESIGN.md and ADR 0007 say: P10 to P90 is 80% of the
    simulated outcomes, and the runs vary only each driver's size and timing."""
    page = source("components/dashboard/ShiftAnalysis.tsx")
    notes = re.findall(r'bandNote="([^"]+)"', page)
    band = engine.distribution(np.arange(101.0))   # the percentiles of 0 to 100 are their own ranks
    coverage = round(band["p90"] - band["p10"])
    category = f"{coverage}% of simulated outcomes (driver size and timing only)"
    assert notes == [f"{coverage}% of simulated outcomes (joint portfolio; driver size and timing only)", category]
    assert_quotes("docs/DESIGN.md", f'"{category}"')
    assert_quotes("docs/adr/0007-honest-display.md", f"{coverage}% of simulated outcomes, driver size and timing only")


def test_the_sampling_settings():
    """docs/MODEL.md: the bootstrap behind the Monte Carlo standard error and the chain seeds."""
    result = engine.MonteCarloEngine(ModelConfig(), seed=PRODUCTION_SEED).run(
        DriverSet(drivers=get_seed_drivers()), iterations=100, chains=2)
    assert result["chain_seeds"] == [PRODUCTION_SEED + i * engine.CHAIN_SEED_STRIDE for i in range(2)]
    assert_quotes("docs/MODEL.md", f"A bootstrap ({engine.BOOTSTRAP_RESAMPLES} resamples)",
                  f"`{PRODUCTION_SEED} + i x {engine.CHAIN_SEED_STRIDE:,}`")


def test_the_input_drift_warning():
    assert_quotes("docs/MODEL.md", f"when more than {WORDS[WARNING_CHANGES]} drivers change their scores or more "
                                   f"than {WORDS[WARNING_CHANGES]} change their structure")


# ── the generated records ───────────────────────────────────────────────────

def test_the_overlap_correction_method():
    script = load_module("scripts/compute_overlap_correction.py", "overlap_correction_script")
    assert_quotes(
        "docs/MODEL.md",
        f"`sqrt(n_j / n_i)`, capped at {script.ASYMMETRY_CAP:g}",
        f"clamps: within a force to [{script.WITHIN_FLOOR:.2f}, {script.WITHIN_CEIL:.2f}], across forces to "
        f"[{script.CROSS_FLOOR:.2f}, {script.CROSS_CEIL:.2f}]",
    )
    # adding a driver moves its force's total its own way only while every overlap stays below 0.5
    # (docs/MODEL.md, step 5; tests/test_properties.py holds the property)
    assert script.WITHIN_CEIL < 0.5


def test_the_attenuation_formula():
    """A force's attenuation is 0.5 x (1 - its mean overlap with the other forces), as the record holds it."""
    for f in FORCES:
        row = [DEFAULT_FORCE_OVERLAP_MATRIX[f][g] for g in FORCES if g != f]
        assert DEFAULT_PER_FORCE_ATTENUATION[f] == pytest.approx(round(0.5 * (1 - sum(row) / len(row)), 3), abs=1e-9)
    assert_quotes("docs/MODEL.md", "attenuation of a force is `0.5 x (1 - m)`",
                  f"over the {WORDS[len(FORCES) - 1]} other forces")
    from prism import overlap_correction
    layers = [name for name in vars(overlap_correction) if name.isupper() and name != "VERSION"]
    assert layers == ["PER_FORCE_ATTENUATION", "WITHIN_FORCE_OVERLAP", "FORCE_OVERLAP_MATRIX"]
    assert_quotes("docs/MODEL.md", f"the script also writes the {WORDS[len(layers)]} layers")
    assert_quotes("docs/adr/0006-overlap-correction.md",
                  f"`0.5 x (1 - the force's mean overlap with the {WORDS[len(FORCES) - 1]} other forces)`")


def test_the_cell_weight_estimate():
    record = json.loads(source("data/parameters/cell_weight_estimate.json"))
    split = record["inputs"]["block_split"]
    regions, categories = cell_weight_marginals(DEFAULT_CELL_WEIGHTS)
    labels = category_labels()
    assert_quotes(
        "docs/MODEL.md",
        f"the blocks Laundry & Home Care ({split['LHC'] * 100:.0f} percent) and Hair & Body "
        f"({split['Hair & Body'] * 100:.0f} percent)",
        "The estimate's marginals are: categories "
        + ", ".join(f"{labels[c]} {categories[c] * 100:.1f}" for c in CATEGORIES)
        + " percent; regions " + ", ".join(f"{r} {regions[r] * 100:.1f}" for r in REGIONS) + " percent.",
    )
    # "several cells hold less than 0.1 percent", the reason the Settings sheet shows two decimals
    assert sum(w < 0.001 for row in DEFAULT_CELL_WEIGHTS.values() for w in row.values()) >= 2
    assert_quotes("docs/DESIGN.md", "several cells hold less than 0.1 percent of the pool")
    assert_quotes("docs/adr/0007-honest-display.md", "several cells hold less than 0.1 percent")


def test_the_attribution_figures():
    record = json.loads(source("data/drivers/driver_attribution.json"))
    assert_quotes("docs/DRIVER_ANALYSIS.md", readings.basis_line(record),
                  f"({record['reconciliation']['factor']:.3f} on the current base)",
                  f"over {attribution.BAND_DRAWS:,} draws",
                  f"the driver's {WORDS[attribution.TOP_CELLS]} largest cells",
                  f"up to {WORDS[attribution.TOP_PARTNERS]} drivers of the same force in the cell")
    median = record["reconciliation"]["reference_median_pp"]
    assert_quotes("migrations/0001_driver_schema/README.md", f"portfolio median of {median:.1f} percent")
    # docs/MODEL.md: the region that carries most of the headline holds about half of the estimated pool
    by_region, pool = record["totals"]["by_region_pp"], record["totals"]["pool_region_shares"]
    most_exposed = max(REGIONS, key=lambda r: abs(by_region[r]))
    assert most_exposed == "Europe" and 0.45 <= pool["Europe"] <= 0.55
    assert_quotes("docs/MODEL.md", "Europe, the most exposed region and half of the estimated pool")
    largest = max(abs(d["portfolio_pp"][str(LAST)]) for d in record["drivers"].values())
    assert_quotes("docs/DRIVER_ANALYSIS.md",
                  f'("{largest:.2f} of the {abs(record["totals"]["net_pp"]):.1f} points")',
                  f"The driver's own P10 to P90 range at {LAST}", f"its own P10 to P90 range at {LAST}",
                  f"peak can fall after {LAST}", f"When the {LAST} median of the run the dashboard shows")
    labels = WORDS[len(readings.LABELS)]
    assert_quotes("docs/DRIVER_ANALYSIS.md", f"in {labels} labelled paragraphs", f"renders the {labels} labels",
                  f"what a machine can check: the {labels} labels in order")
    # "the additive band is within X points of the run's band at both ends"
    stated = float(re.search(r"the additive band is within (\d+\.\d+) points of the run's band",
                             doc("docs/DRIVER_ANALYSIS.md")).group(1))
    band, additive = record["totals"]["band_p10_p90_pp"], record["totals"]["band_additive_sum"]
    assert max(abs(additive["p10_pp"] - band[0]), abs(additive["p90_pp"] - band[1])) <= stated


def test_the_attribution_rules():
    """docs/DRIVER_ANALYSIS.md: the reconciliation range (the record's and the drill-down's), the check's
    tolerances, a reading's length and the year most timing paragraphs name."""
    low, high = attribution.RECONCILIATION_RANGE
    drill_down = re.search(r"k >= ([\d.]+) && k <= ([\d.]+)", source("lib/driverAttribution.ts"))
    assert (float(drill_down.group(1)), float(drill_down.group(2))) == (low, high) == (0.5, 2.0)
    assert_quotes("docs/DRIVER_ANALYSIS.md", "a factor that is not positive or lies outside 1/2 to 2")
    assert round(attribution.RECORD_ATOL, 4) == 1e-4
    assert_quotes("docs/DRIVER_ANALYSIS.md", "by one unit in the fourth decimal",
                  f"by {sci(attribution.FIXTURE_ATOL)} plus {sci(attribution.FIXTURE_RTOL)} of the value",
                  f"by {sci(attribution.REFERENCE_ATOL)} per quantile")
    words_low, words_high = readings.WORD_RANGE
    assert_quotes("docs/DRIVER_ANALYSIS.md", f"A reading runs {words_low} to {words_high} words")
    templates = json.loads(source("data/drivers/driver_analysis.json"))["drivers"].values()
    by_year = collections.Counter(y for t in templates for y in set(re.findall(r"\{by(\d{4})\}", t["template"])))
    year, uses = by_year.most_common(1)[0]
    assert uses > len(templates) / 2
    assert_quotes("docs/DRIVER_ANALYSIS.md", f"by an early year of the path (most readings name {year})")


# ── the design tokens ───────────────────────────────────────────────────────

def test_the_design_tokens():
    """docs/DESIGN.md: every colour token it lists, the shift pair, the force palette and the flat threshold,
    as lib/theme.ts and lib/format.ts define them."""
    theme = source("lib/theme.ts")
    rgb = dict(re.findall(r"export const (\w+_RGB) = '([^']+)';", theme))
    block = re.search(r"export const S = \{(.*?)\n\} as const;", theme, re.S).group(1)
    tokens = {}
    for name, value in re.findall(r"^\s+(\w+):\s+['`]([^'`]+)['`],", block, re.M):
        tokens[name] = re.sub(r"\$\{(\w+)\}", lambda m: rgb[m.group(1)], value)
    rows = re.findall(r"^\| (`[^|]+`) \| (`[^|]+`) \|", source("docs/DESIGN.md"), re.M)
    assert rows
    for names, values in rows:
        names, values = re.findall(r"`([^`]+)`", names), re.findall(r"`([^`]+)`", values)
        assert len(names) == len(values), names
        for name, value in zip(names, values):
            assert tokens[name] == value, name
    assert_quotes("docs/DESIGN.md", f"green `{tokens['expansion']}` for expansion, red `{tokens['contraction']}` "
                                    f"for contraction")
    fmt = source("lib/format.ts")
    palette = re.search(r"export const FORCE_COLORS: Record<ForceName, string> = \{(.*?)\};", fmt, re.S).group(1)
    colours = dict(re.findall(r"(\w+): '(#[0-9a-f]{6})'", palette))
    assert list(colours) == FORCES
    assert_quotes("docs/DESIGN.md", "The six forces have one palette (`FORCE_COLORS`): "
                  + ", ".join(f"{f} `{colours[f]}`" for f in FORCES) + ".")
    flat = float(re.search(r"export const FLAT_EPS = ([\d.]+);", fmt).group(1))
    assert_quotes("docs/DESIGN.md", f"below {flat * 100:g} percent it counts as flat")


def test_the_shadows_and_the_heat_ramp():
    """docs/DESIGN.md: one shadow per kind of surface, the card's value, and the Shift Matrix's tint:
    saturated at the 95th percentile of the values in view, deepest where the cell text keeps 5:1."""
    theme = source("lib/theme.ts")
    rgb = dict(re.findall(r"export const (\w+_RGB) = '([^']+)';", theme))
    alpha = {"ink": rgb["INK_RGB"], "blue": rgb["PRIMARY_RGB"]}
    block = re.search(r"export const SHADOW = \{(.*?)\n\} as const;", theme, re.S).group(1)
    shadows = {name: re.sub(r"\$\{(\w+)\(([\d.]+)\)\}", lambda m: f"rgba({alpha[m.group(1)]}, {m.group(2)})", value)
               for name, value in re.findall(r"^\s+(\w+):\s+`([^`]+)`,", block, re.M)}
    sentence = re.search(r"There is one per kind of surface \(`SHADOW`\): (.*?) for the entry gate\.",
                         doc("docs/DESIGN.md")).group(1)
    assert set(re.findall(r"`([A-Za-z]+)`", sentence)) == set(shadows)
    assert_quotes("docs/DESIGN.md", f"`card` (`{shadows['card']}`)")

    fmt = source("lib/format.ts")
    percentile = float(re.search(r"Math\.floor\(magnitudes\.length \* ([\d.]+)\)", fmt).group(1))
    assert_quotes("docs/DESIGN.md", f"up to the {percentile * 100:g}th percentile of the values in view")
    low, span = (float(x) for x in re.search(r"const alpha = \(([\d.]+) \+ magnitude \* ([\d.]+)\)", fmt).groups())
    tokens = dict(re.findall(r"^\s+(\w+):\s+'(#[0-9a-f]{6})',", theme, re.M))

    def luminance(channels) -> float:
        linear = [c / 255 / 12.92 if c / 255 <= 0.03928 else ((c / 255 + 0.055) / 1.055) ** 2.4 for c in channels]
        return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]

    def hex_channels(value: str) -> list:
        return [int(value[i:i + 2], 16) for i in (1, 3, 5)]

    def weakest_contrast(tint: float) -> float:
        """The lower of the two hues' contrast between the cell text and a cell tinted this deep."""
        out = []
        for hue, ink in (("EXPANSION_RGB", "expansionInk"), ("CONTRACTION_RGB", "contractionInk")):
            fill = [tint * int(c) + (1 - tint) * w
                    for c, w in zip(rgb[hue].split(", "), hex_channels(tokens["surface"]))]
            light, dark = sorted((luminance(fill), luminance(hex_channels(tokens[ink]))), reverse=True)
            out.append((light + 0.05) / (dark + 0.05))
        return min(out)

    deepest = low + span
    assert weakest_contrast(deepest) >= 5.0 > weakest_contrast(deepest + 0.02)
    assert_quotes("docs/DESIGN.md", "the tint stops where the cell text would drop below 5:1 contrast")


# ── the security and session settings ───────────────────────────────────────

def test_the_security_and_session_settings():
    """The token secret's minimum length, the lifetimes of the two tokens (the viewer cookie's also bounds
    how long a user whose role was taken away keeps reading), and how long signing out waits for the
    expert's saves."""
    from prism.api.auth import MIN_SECRET_LENGTH as n
    assert_quotes("README.md", f"at least {n} characters, the same value on both sides", f"(at least {n} characters)")
    assert_quotes("docs/ARCHITECTURE.md", f"missing or shorter than {n} characters")
    assert_quotes("docs/OPERATIONS.md", f"works only with a secret of at least {n} characters",
                  f"the value is shorter than {n} characters")
    cookie = int(re.search(r"const TTL_SECONDS = (\d+) \* 60;", source("app/api/prism-cookie/route.ts")).group(1))
    assert_quotes("docs/ARCHITECTURE.md", f"holding a {cookie}-minute token", f"loses access within {cookie} minutes")
    assert_quotes("docs/OPERATIONS.md", f"loses access within {cookie} minutes")
    assert_quotes("docs/adr/0012-identity-roles-tokens.md", f"after {WORDS[cookie]} minutes for reads",
                  f"reads within {WORDS[cookie]} minutes")
    assert f"loses access within {cookie} minutes" in source("components/dashboard/settings/UsersSection.tsx")
    admin = int(re.search(r"ttlSeconds = (\d+)\)", source("lib/prismJwt.ts")).group(1))
    assert admin % 60 == 0
    for relative in ("CLAUDE.md", "docs/ARCHITECTURE.md", "docs/adr/0012-identity-roles-tokens.md"):
        assert_quotes(relative, f"{WORDS[admin // 60]}-minute admin token")
    wait = int(re.search(r"export const SAVE_WAIT_MS = (\d+)_000;", source("lib/session.ts")).group(1))
    assert_quotes("docs/ARCHITECTURE.md", f"waits up to {WORDS[wait]} seconds")


def test_the_database_connection_limits(monkeypatch):
    import types

    import prism.database as db
    from prism.api.state import UNREACHABLE_GRACE_SECONDS as grace
    budget, timeout = db.CONNECT_BUDGET_SECONDS, db.CONNECT_TIMEOUT_SECONDS
    # A server whose one address never answers costs each attempt the whole connect timeout: get_db_connection
    # itself, on a clock it reads, says when it gives up.
    clock = [0.0]

    def silent():
        clock[0] += timeout
        raise RuntimeError("timeout expired")
    monkeypatch.setattr(db, "_connect", silent)
    monkeypatch.setattr(db, "time", types.SimpleNamespace(
        monotonic=lambda: clock[0], sleep=lambda seconds: clock.__setitem__(0, clock[0] + seconds)))
    with pytest.raises(db.DatabaseUnavailableError):
        with db.get_db_connection():
            pass
    elapsed = clock[0]
    assert_quotes("docs/ARCHITECTURE.md", f"waits at most {WORDS[timeout]} seconds for each address of the server",
                  f"at {WORDS[timeout]} seconds more, it would end within {WORDS[budget]} seconds of the first",
                  f"given up after about {elapsed:g} seconds",
                  f"one with several addresses after {WORDS[timeout]} seconds for each",
                  f"For {WORDS[grace]} seconds after such a failure")
    assert_quotes("docs/OPERATIONS.md", f"an answer takes about {elapsed:g} seconds, or {WORDS[timeout]} seconds "
                                        "for each address of the database host")
    # The dashboard waits REQUEST_TIMEOUT_MS for an answer; from a server with one address, a request hears its
    # 503 before that.
    client = int(re.search(r"REQUEST_TIMEOUT_MS = (\d+)_000", source("lib/apiClient.ts")).group(1))
    assert elapsed < client
