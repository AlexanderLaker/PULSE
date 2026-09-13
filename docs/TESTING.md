# PRISM Testing Guide

Reconciled to the tree on 2026-09-11 (release 2.12.0). CI runs the same gates (`.github/workflows/ci.yml`): frontend typecheck, lint, vitest; scipy engine pytest.

## Quick start

```bash
npm run verify          # typecheck + lint (incl. the shift-matrix single-source guard) + vitest + pytest
python3 -m pytest tests -q          # engine, API, ops, base, calibration, persistence (scipy required, D13)
npx vitest run                      # frontend
python3 scripts/generate_seed_from_core_set.py --check   # committed seed + code map == generator output
python3 scripts/build_estimated_cell_weights.py --check  # committed cell-weight record + lib/cellWeightProvenance.ts == generator output (O14)
```

## Python suite (`tests/`, 208 tests)

| File | Tests | Locks |
|------|:---:|-------|
| `conftest.py` | – | Fixture DB (five differentiated trends with canonical VC profiles, L29) and `mock_model_config` (defaults, 1,000 iterations, 2026–2030, jitter OFF) |
| `test_bayesian_mc.py` | 30 | Engine behaviour: priors, copula, materialisation, dampening, velocity, peak-year jitter (F4), multichain pooling |
| `test_golden_pipeline.py` | 17 | Determinism; **golden pins** (seed 42, 500 iterations, regenerated only with deliberate model changes in the same commit — last 2026-09-11 for 2.12.0, twice: the O13 Toilet Care split, then the O14 estimated HCB cell-weight default, which is the large move of the release and deepens the fixture portfolio pin from −0.00433 to −0.00572); joint portfolio band pin; no repair fires on defaults (D1); one version everywhere (M15); VC structural locks (2.9.0) |
| `test_cell_weights.py` | 26 | **O6**: the 2.12.0 engine with the separable Group-split matrix, the 2.10.0 calibration and the explicitly pinned 12-category taxonomy `CATEGORIES_2_10_0` reproduces the 2.10.0 fixture run to 1e-12 — 3.47e-18 on the 2.12.0 code (category cells, portfolio band, velocity bands with jitter on, region lens); roll-up algebra over the 13 × 4 grid; contract keys; validator and config construction. **O14** (`TestEstimatedMixProvenance`, 7): the constants match `data/cell_weights_estimated_v1.json`, the record matches the generator (`build_estimated_cell_weights.py --check`, which also covers `lib/cellWeightProvenance.ts`), the source string is the record's own, every input carries a B/E/G grade, the published inputs re-derive the 52 cells, and the matrix must never become effectively separable |
| `test_uncertainty.py` | 19 | **O7**: prior table and floors, unscored = 2.10.0, `peak_year_jitter = 0` as the off switch, per-trend jitter widths drawn by the engine's own sampler, the onset clamp (an early draw never becomes the latest arrival), multichain event dedupe, reproducibility, drift key `"u"`, SQLite and proposals round trip |
| `test_trend_base_2026_09.py` | 13 | **O10 / O13**: seed integrity (51 drivers generated from `core_set_51_v4.json`, 13-category exposures, ranges, sources, scores, no provenance label, snapshot), generator `--check`, code map partition and pointers, journey citations, the replacement script (dry run without schema writes, live run with the Postgres-style cascade, second-run refusal unless `--force`, Postgres refusal) |
| `test_calibration_v3_12.py` | 11 | **O11 / O13 / F-28**: defaults == calibration record, record == script output, eff_att identity, copula PSD margin on the 51 mix, validator source tags. Recomputed for 2.12.0 because the overlap correction is a function of the category exposure space, so the Toilet Care split changes its input (renamed from `test_calibration_v3_11.py`) |
| `test_trend_persistence.py` | 8 | **O12 / F-29**: the `save_trends` upsert — an admin edit of a driver no longer cascades that driver's expert score proposals away (run with foreign keys enforced so the SQLite path behaves like Neon) |
| `test_vc_epicentre.py` | 13 | Parity fixture table with `tests/frontend/vcEpicentre.test.ts` (Python `vc_epicentre_of` == TS `epicentreOf`); drift semantics |
| `test_input_drift.py` | 5 | D19 fingerprint and drift events |
| `test_properties.py` | 7 | Hypothesis property tests |
| `test_api.py` | 50 | Endpoint behaviour incl. the F2 409 guard, F3 read authentication, D13 backend tag, the 2.12.0 config contract (cell weights only, derived marginals, 13 × 4 grid validation), the uncertainty field (range, round trip, explicit-null clearing) and the reseed/sync base-replacement guard |
| `test_ops.py` | 9 | M10: prod entrypoint import, `EXPECTED_TREND_COUNT` (51), H1 wrong-DB-mode exit, CLI parser, Excel writer round trip, diagnostics outage; **O14**: the QA workbook's "Cell Weights" sheet carries the graded derivation under the estimated mix and omits it under any other matrix |

## Frontend suite (`tests/frontend/`, vitest, 84 tests)

| File | Locks |
|------|-------|
| `normalizeSimulation.test.ts` | Shape adapter incl. the 2.11.0 cell-weight block |
| `shiftMatrix.test.ts` | Category-weighted aggregation (single source, F1) |
| `cellWeights.test.ts` | 13 × 4 matrix marginals, sum badge, equal placeholder, row shares (O6); the O14 estimate — `matchesEstimate` against the generated matrix, and the `cellWeightProvenance` record re-deriving the matrix and its marginals from its own graded inputs |
| `settingsModalCellWeights.test.tsx` | **O14**: the Config sheet's two resets write different provenance labels — "reset to equal" writes `cell_weights_source_equal`, never the estimate's `cell_weights_source_default`, and on a service that does not serve the key it leaves the existing source text alone |
| `trendCodeMap.test.ts` | 51 live codes derived from ids, 65 retired codes with live pointers, `liveCodeFor`, journey citations (O10) |
| `vcEpicentre.test.ts` | Parity with the Python epicentre rule |
| `format.test.ts` | Display-honesty pins (one decimal, sign always visible) |
| `authRoutes.test.ts`, `prismCookie.test.ts` | Auth seam |
| `consumerJourneyDialog.test.tsx`, `homeGate.test.tsx`, `tabSmoke.test.tsx`, `usePrism.test.tsx` | Component smoke tests |

## Rules

- **Golden pins** move only with a deliberate model change and are regenerated in the same commit, with the reason in the test docstring and the decision log.
- **Reproduction locks** stay: `test_cell_weights.py` must keep reproducing the 2.10.0 numbers, so a change that breaks it is a model change, not a refactor. It pins the 12-category taxonomy of that release (`CATEGORIES_2_10_0`) explicitly, so the O13 Toilet Care split leaves the lock intact.
- **Generated files** (`pulse/seed_trends.py`, `data/trendCodeMap.ts`, `data/attenuation_calibration_v3_12.json`, `data/cell_weights_estimated_v1.json`, `lib/cellWeightProvenance.ts`) are never hand-edited; the tests compare them to their generators. The `DEFAULT_CELL_WEIGHTS` literal in `pulse/config.py` is emitted by the same generator (`--emit-python`) and locked against the record, so the constants, the record and the TypeScript copy cannot drift apart (F-28).
- The scipy engine is a hard requirement; there is no approximate test path.

## Useful invocations

```bash
python3 -m pytest tests/test_golden_pipeline.py -q                 # pins only
python3 -m pytest tests -q -x                                      # stop at the first failure
python3 -m pytest tests -q --durations=10                          # slowest tests
python3 -m pytest tests/test_cell_weights.py -q -k EstimatedMix    # the O14 provenance locks only
npx vitest run tests/frontend/trendCodeMap.test.ts                 # one frontend file
PRISM_DB_PATH=/tmp/x.db python3 scripts/replace_trend_base.py --dry-run   # replacement report on any SQLite copy
```
