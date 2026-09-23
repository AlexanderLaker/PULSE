"""The PRISM Analysis of the Drivers page (docs/DRIVER_ANALYSIS.md).

  (a) the decomposition in scripts/build_driver_analysis.py is the engine's
      own arithmetic: with the draws pinned to the Beta means and the peak
      jitter off, the engine's cell shifts equal the decomposition's to
      floating-point precision; the drivers of every cell add up to the cell
      shift; the jitter expectation is the engine's schedule table averaged;
  (b) the committed record, the parity fixture and the rendered texts are
      what the code produces from the driver base and the configuration, and
      the seed carries the rendered texts;
  (c) every reading follows the rules: the four labelled paragraphs and the
      basis line, every model figure a placeholder, no restated score, no
      history of the base, no management response, no dash or filler, the
      driver vocabulary.
Writing the texts into a database is scripts/sync_analysis.py (test_operations.py).
"""
from __future__ import annotations

import copy
import importlib.util
import json
import re
from pathlib import Path

import numpy as np
import pytest

from prism import seed_drivers
from prism.config import FORCES, ModelConfig
from prism.drivers import DriverSet
from prism.simulation.bayesian_mc import BayesianMonteCarloEngine

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "data" / "drivers"
ANALYSIS = DATA / "driver_analysis.json"
ATTRIBUTION = DATA / "driver_attribution.json"
FIXTURE = REPO / "tests" / "frontend" / "fixtures" / "driverAttribution.fixture.json"
LABELS = ("Weight in the answer", "Where it lands", "When it lands", "What the band hinges on")


def _load_script(name: str):
    spec = importlib.util.spec_from_file_location(name, REPO / "scripts" / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def build():
    return _load_script("build_driver_analysis")


@pytest.fixture(scope="module")
def render():
    return _load_script("driver_analysis_render")


@pytest.fixture(scope="module")
def record() -> dict:
    return json.loads(ATTRIBUTION.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def analysis() -> dict:
    return json.loads(ANALYSIS.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def drivers(build):
    return build.load_drivers()


# ── (a) the decomposition is the engine ───────────────────────────────────────

class TestDecomposition:
    def test_cell_shifts_equal_the_engine_at_the_means_with_jitter_off(self, build, drivers):
        config = ModelConfig().copy_with(peak_year_jitter=0)
        dec = build.decompose(config, drivers)
        means = np.array([t.normalized_score for t in drivers])
        # the engine's vectorised core, fed the Beta means as its "draws"
        eng = BayesianMonteCarloEngine(config, seed=1)
        n_cats, n_reg, n_years = len(config.category_names), 4, len(config.path_years)
        cells = eng._compute_all_paths_vectorized(drivers, np.tile(means, (3, 1)), 3, n_cats, n_reg, n_years)
        assert cells.shape == (3, n_cats * n_reg, n_years)
        np.testing.assert_allclose(cells[0], dec["cell_shift"], rtol=0, atol=1e-12)
        np.testing.assert_allclose(cells[2], dec["cell_shift"], rtol=0, atol=1e-12)

    def test_the_drivers_of_a_cell_add_up_to_the_cell_shift(self, build, drivers):
        dec = build.decompose(ModelConfig(), drivers)
        np.testing.assert_allclose(dec["A_cell"].sum(axis=0), dec["cell_shift"], rtol=0, atol=1e-14)
        # and the portfolio roll-up of the drivers is the roll-up of the cells
        W = dec["W"].reshape(-1)
        np.testing.assert_allclose(dec["port"].sum(axis=0), (dec["cell_shift"] * W[:, None]).sum(axis=0),
                                   rtol=0, atol=1e-14)

    def test_the_jitter_expectation_is_the_engine_schedule_table_averaged(self, build, drivers):
        config = ModelConfig()
        dec = build.decompose(config, drivers)
        eng = BayesianMonteCarloEngine(config, seed=1)
        sched, offsets, probs = eng._peak_schedule_table(drivers)
        expected = np.einsum("jk,jky->jy", probs, sched)
        np.testing.assert_allclose(dec["e_mat"], expected, rtol=0, atol=1e-15)
        # monotone in the year, and 1 at the horizon for every driver whose
        # peak cannot slip past it
        assert np.all(np.diff(dec["e_mat"], axis=1) >= -1e-12)
        for j, t in enumerate(drivers):
            if t.peak_year + 4 <= 2035:
                assert dec["e_mat"][j, -1] == pytest.approx(1.0)

    def test_a_short_reference_run_reconciles_within_the_stated_tolerance(self, build, drivers):
        config = ModelConfig()
        dec = build.decompose(config, drivers)
        det = float(dec["port"][:, -1].sum())
        db = DriverSet(drivers=list(drivers), categories=list(config.category_names), forces=list(FORCES))
        res = BayesianMonteCarloEngine(config, seed=42).run(db, iterations=4000)
        median = res["totals"]["portfolio"][2035]["median"]
        # the sum at the means sits within a few per cent of the MC median
        assert abs(median / det - 1) < 0.03


# ── the rules the readings and the templates are held to ─────────────────────

FORBIDDEN = [
    (re.compile(r"\b[0-5] of 5\b"), "a restated score"),
    (re.compile(r"\bprobability [0-5]\b", re.I), "a restated probability"),
    (re.compile(r"\buncertainty [0-5]\b", re.I), "a restated uncertainty score"),
    (re.compile(r"\bexposure(?: score)? [0-5]\b", re.I), "a restated exposure score"),
    (re.compile(r"\bGP1 (?:share )?(?:of )?0\.\d+"), "a restated GP1 share"),
    # examples of a score restated in words ("a small GP1
    # share", "a likely probability"), and the scoring vocabulary itself
    (re.compile(r"\bGP1 share\b|\bprobabilit(?:y|ies)\b|\buncertainty score\b|\bconfidence\b|"
                r"\bbalanced (?:case|rather)\b|\blikely (?:probability|case)\b|\bscored\b|\bscores\b|"
                r"\balmost certain\b|\bvery unlikely\b|\b(?:one|two) in (?:three|four|five|six) chance\b|"
                r"\bchance of\b|\bthe odds\b", re.I),
     "a score restated in words"),
    (re.compile(r"September 2026 review|the (?:2026 )?review\b|old base|earlier base|previous base|prior base|"
                r"was corrected|was deleted|were wrong|was wrong|report mill|could not be verified|unverified|"
                r"unsourced|watch list|merged into|folded into|\brenamed\b|\bretired\b", re.I),
     "a reference to the history of the base"),
    (re.compile(r"\b(?:Henkel|HCB) (?:should|must|needs to|has to|ought to|could|would need to|can offset)\b|"
                r"\blevers?\b|\bmitigat|\bhedge\b|\bcountermeasure", re.I),
     "a management response"),
    (re.compile("[\u2014\u2013]"), "a dash"),
    (re.compile(r"\b(?:genuinely|honestly|straightforward|crucially|it is worth noting|importantly)\b", re.I), "filler"),
    (re.compile(r"\btrends?\b", re.I), "the word trend"),
    (re.compile(r"\{\w+\}"), "an unfilled placeholder"),
]

# Shapes a model figure takes in the prose. In a TEMPLATE such a figure may
# only be a placeholder in braces, so a digit in one of these shapes is a
# hand-typed model figure (the facts a template may type, dates and source
# figures, do not take these shapes).
HAND_TYPED_MODEL_FIGURE = [
    (re.compile(r"\d[\d.]* percent of (?:the|that|its|a|this) (?:pool|effect|total|contraction|cell|headwind|tailwind|"
                r"portfolio|terminal|net|estimated mix|mix|gross headwind|gross tailwind|net exposure|"
                r"(?:Consumer|Customer|Technology|Government|Environmental|Competitive)(?: force's)? (?:headwind|tailwind))\b", re.I),
     "a typed share of the pool, effect, cell or headline"),
    (re.compile(r"\d[\d.]* (?:of the (?:net|gross)|points? of (?:the|net|gross))\b|\bof the \d[\d.]* points\b|"
                r"\d[\d.]*-point (?:tailwind|headwind)", re.I), "a typed contribution in points"),
    (re.compile(r"\b(?:half-way point (?:is|falls in|in) (?:only )?20\d\d|complete by 20\d\d|the whole of it by 20\d\d)", re.I),
     "a typed materialisation year"),
    (re.compile(r"\bpass-through (?:is|of|\() ?\d", re.I), "a typed pass-through"),
    (re.compile(r"\breaches (?:only )?\d", re.I), "a typed reach"),
    (re.compile(r"\b(?:ranked|the) \d+(?:st|nd|rd|th) (?:largest|contribution|tailwind|headwind)\b", re.I), "a typed rank"),
]

# Where a typed copy of a rendered model figure would sit in the prose: the
# number followed by one of these. Source facts take other shapes ("percent
# of households", "share points", "basis points", "USD ... per tonne").
_TYPED_FIGURE_CONTEXT = re.compile(
    r"(?<![\d.{{])(?<!minus )(?<!plus )\b(?P<value>\d+(?:\.\d+)?)\b(?![\d.}}])(?: percent(?: of (?:the|that|its|a|this)\b|"
    r" European| North American| in (?:Europe|North America|Asia|High Growth)| by 20\d\d|$)| points\b(?! of hair)|"
    r" of (?:the|its) (?:5\.6|7\.3|1\.7)\b)")


# ── (b) the committed artefacts are what the code produces ───────────────────

class TestCommittedArtefacts:
    def test_record_and_fixture_are_the_recomputation(self, build, drivers, record):
        # Same tolerances as `--check`: a rounding-boundary flip between
        # platforms is not drift, anything a reader could notice is.
        config = ModelConfig()
        rebuilt = build.build_record(config, drivers, record["reference_run"], record.get("persisted_run"))
        assert build.records_match(build._strip_volatile(rebuilt), build._strip_volatile(record), build.RECORD_ATOL)
        fixture = build.build_fixture(config, drivers, build.decompose(config, drivers))
        assert build.records_match(json.loads(FIXTURE.read_text(encoding="utf-8")), json.loads(json.dumps(fixture)),
                                   build.FIXTURE_ATOL, build.FIXTURE_RTOL)

    def test_records_match_admits_rounding_flips_and_nothing_a_reader_could_notice(self, build):
        base = {"a": [0.9129, {"b": 1, "c": "x", "d": True}], "e": 0.5}
        flipped = {"a": [0.913, {"b": 1, "c": "x", "d": True}], "e": 0.5}
        moved = {"a": [0.9131, {"b": 1, "c": "x", "d": True}], "e": 0.5}
        assert build.records_match(base, flipped, build.RECORD_ATOL)
        assert not build.records_match(base, moved, build.RECORD_ATOL)
        assert not build.records_match(base, {**base, "e": 0.6}, build.RECORD_ATOL)
        assert not build.records_match(base, {"a": base["a"]}, build.RECORD_ATOL)
        assert not build.records_match({"d": True}, {"d": 1}, build.RECORD_ATOL)
        assert not build.records_match({"c": "x"}, {"c": "y"}, build.RECORD_ATOL)

    def test_record_basis_and_reconciliation(self, record, drivers):
        assert record["basis"]["drivers"] == 51 == len(drivers)
        assert record["basis"]["cell_weights_source"].startswith("ESTIMATE, not Henkel P&L")
        rec = record["reconciliation"]
        assert rec["factor"] == pytest.approx(rec["reference_median_pp"] / rec["deterministic_total_pp"], rel=1e-4)
        assert 0.97 < rec["factor"] < 1.03
        tot = record["totals"]
        assert tot["headwinds"] + tot["tailwinds"] == 51
        assert tot["gross_headwind_pp"] + tot["gross_tailwind_pp"] == pytest.approx(tot["net_pp"], abs=1e-3)
        contributions = sum(d["portfolio_pp"]["2035"] for d in record["drivers"].values())
        assert contributions == pytest.approx(tot["net_pp"], abs=1e-2)
        shares = sum(d["band"]["band_share"] for d in record["drivers"].values())
        assert shares == pytest.approx(1.0, abs=1e-3)
        assert sum(tot["pool_region_shares"].values()) == pytest.approx(1.0, abs=1e-3)

    def test_rendered_texts_and_seed_agree(self, render, record, analysis):
        rendered = render.render_all(record, analysis)
        by_code = {d["code"]: tid for tid, d in record["drivers"].items()}
        seed = {t.id: t for t in seed_drivers.DRIVERS}
        assert set(analysis["drivers"]) == set(by_code)
        for code, entry in analysis["drivers"].items():
            tid = by_code[code]
            assert entry["text"] == rendered[tid], code
            assert seed[tid].analysis == entry["text"], code

    def test_every_placeholder_is_a_field_and_the_key_ones_are_used(self, render, record, analysis):
        by_code = {d["code"]: d for d in record["drivers"].values()}
        for code, entry in analysis["drivers"].items():
            fields = render.render_fields(record, by_code[code])
            placeholders = set(re.findall(r"\{(\w+)\}", entry["template"]))
            assert placeholders, code
            assert placeholders <= set(fields), (code, placeholders - set(fields))
            assert "pp" in placeholders and "reach" in placeholders, code

    @pytest.mark.parametrize("pattern, what", HAND_TYPED_MODEL_FIGURE, ids=[w for _, w in HAND_TYPED_MODEL_FIGURE])
    def test_no_model_figure_is_typed_by_hand_in_a_template(self, analysis, pattern, what):
        """Numbers a template types by hand are facts of the driver (dates,
        source figures); every figure the model produces comes through a
        placeholder, which is what keeps a re-scored base from leaving a
        stale number in a text. The lock reads the TEMPLATES, where a model
        figure can only appear as a brace, and fails on the shapes a model
        figure takes in the prose (a share of the pool, of the effect, of a
        cell or of the headline; a contribution in points; a materialisation
        share; a half-way year)."""
        offenders = [(code, m.group(0)) for code, e in analysis["drivers"].items()
                     for m in pattern.finditer(e["template"])]
        assert offenders == [], what

    def test_no_rendered_model_figure_is_typed_in_its_own_template(self, render, record, analysis):
        """The complement of the shape lock above: for every driver, render
        the fields and fail if any rendered value appears in the template as
        a bare number in a model-figure context (a typed copy of a current
        model figure passes the shape lock only when it is on a shape the
        lock does not know)."""
        by_code = {d["code"]: d for d in record["drivers"].values()}
        offenders = []
        for code, entry in analysis["drivers"].items():
            values = {v for v in render.render_fields(record, by_code[code]).values() if re.fullmatch(r"\d+(?:\.\d+)?", v)}
            for m in _TYPED_FIGURE_CONTEXT.finditer(entry["template"]):
                if m.group("value") in values and m.group("value") not in {"2035", "2026"}:
                    offenders.append((code, m.group(0)))
        assert offenders == []

    def test_no_template_types_its_drivers_peak_year(self, analysis, record):
        """The peak year is a score the page shows and a re-score moves it; a
        template names it only through {peak_year}. The lock reads the
        timing paragraph for "to / at / until <the driver's peak year>"."""
        seed = {t.id: t for t in seed_drivers.DRIVERS}
        by_code = {d["code"]: tid for tid, d in record["drivers"].items()}
        offenders = []
        for code, entry in analysis["drivers"].items():
            peak = seed[by_code[code]].peak_year
            timing = next((p for p in entry["template"].split("\n\n") if p.startswith("When it lands:")), "")
            if re.search(rf"\b(?:to|until|at|towards|peaking in|peaks in) {peak}\b", timing):
                offenders.append((code, peak))
        assert offenders == []
        assert sum("{peak_year}" in e["template"] for e in analysis["drivers"].values()) >= 30

    def test_inputs_hash_follows_the_scoring_state_and_check_refuses_a_stale_reference(self, build, drivers, record, tmp_path, monkeypatch, capsys):
        """The reference run is stamped with a digest of the seed's scoring
        state and the configuration; a re-scored seed (or a changed
        configuration) must fail --check and must be refused by a build
        without --reference, so the readings can never be reconciled to a
        median the current model does not produce."""
        config = ModelConfig()
        assert record["reference_run"]["inputs_hash"] == build.inputs_hash(config, drivers)
        rescored = [copy.deepcopy(t) for t in drivers]
        rescored[0].probability = max(1, rescored[0].probability - 1)
        assert build.inputs_hash(config, rescored) != record["reference_run"]["inputs_hash"]
        moved = config.copy_with(force_weights={f: (0.17 if f == "Consumer" else v) for f, v in config.force_weights.items()})
        assert build.inputs_hash(moved, drivers) != record["reference_run"]["inputs_hash"]
        # --check on a record whose reference carries another hash
        stale = json.loads(ATTRIBUTION.read_text(encoding="utf-8"))
        stale["reference_run"]["inputs_hash"] = "0" * 64
        p = tmp_path / "stale.json"
        p.write_text(json.dumps(stale), encoding="utf-8")
        monkeypatch.setattr(build, "ATTRIBUTION_PATH", str(p))
        assert build.main(["--check"]) == 1
        out = capsys.readouterr().out
        assert "inputs digest differs" in out
        # a build without --reference refuses instead of reconciling to the old median
        assert build.main([]) == 1
        assert "REFUSING" in capsys.readouterr().out

    def test_the_reference_run_reproduces_the_persisted_production_run(self, build, record):
        """The readings describe the run the dashboard shows: the record
        carries that run's id and its 13 terminal-year category quantiles
        from the QA workbook run_production.py wrote, and the reference run
        must reproduce them exactly (same seed, chains, iterations, drivers
        and configuration)."""
        persisted = record["persisted_run"]
        assert persisted and persisted["id"] and persisted["model_version"] == record["basis"]["model_version"]
        assert len(persisted["categories_terminal"]) == 13
        assert build.reference_reproduces(record["reference_run"], persisted) == []
        # the published headline is the reference run's, to the displayed decimals
        term = record["reference_run"]["portfolio_terminal"]
        assert (round(term["median"] * 100, 2), round(term["p10"] * 100, 2), round(term["p90"] * 100, 2)) == (-5.58, -6.16, -4.89)


# ── (c) the readings follow the rules ────────────────────────────────────────

class TestReadings:
    def test_structure(self, render, analysis, record):
        for code, entry in analysis["drivers"].items():
            parts = render.split_paragraphs(entry["text"])
            assert [p[0] for p in parts] == [*LABELS, render.BASIS_LABEL], code
            words = len(entry["text"].split())
            assert 200 <= words <= 600, (code, words)
            assert render.basis_line(record) in entry["text"], code

    @pytest.mark.parametrize("pattern, what", FORBIDDEN, ids=[w for _, w in FORBIDDEN])
    def test_forbidden_content(self, analysis, pattern, what):
        offenders = [(code, m.group(0)) for code, e in analysis["drivers"].items()
                     for m in pattern.finditer(e["text"])]
        assert offenders == [], what

    def test_headwinds_and_tailwinds_are_worded_by_direction(self, analysis, record):
        for code, entry in analysis["drivers"].items():
            drv = next(d for d in record["drivers"].values() if d["code"] == code)
            first = entry["text"].split("\n\n")[0]
            if drv["direction"] == "Contraction":
                assert "carries" in first or "carry" in first, code
            else:
                assert "offset" in first, code

    def test_a_reading_names_its_cells_and_watch_items(self, analysis):
        for code, entry in analysis["drivers"].items():
            text = entry["text"]
            assert re.search(r"\bpercent of the pool\b", text), code
            band = text.split("What the band hinges on:")[1]
            assert re.search(r"observable|to watch|to follow", band, re.I), code
