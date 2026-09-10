# PRISM Testing Guide

Reconciled to the tree on 2026-09-10 (release 2.11.0). CI runs the same gates (`.github/workflows/ci.yml`): frontend typecheck, lint, vitest; scipy engine pytest.

## Quick start

```bash
npm run verify          # typecheck + lint (incl. the shift-matrix single-source guard) + vitest + pytest
python3 -m pytest tests -q          # engine, API, ops, base, calibration (scipy required, D13)
npx vitest run                      # frontend
python3 scripts/generate_seed_from_core_set.py --check   # committed seed + code map == generator output
```

## Python suite (`tests/`, 189 tests)

| File | Tests | Locks |
|------|:---:|-------|
| `conftest.py` | – | Fixture DB (five differentiated trends with canonical VC profiles, L29) and `mock_model_config` (defaults, 1,000 iterations, 2026–2030, jitter OFF) |
| `test_bayesian_mc.py` | 30 | Engine behaviour: priors, copula, materialisation, dampening, velocity, peak-year jitter (F4), multichain pooling |
| `test_golden_pipeline.py` | 17 | Determinism; **golden pins** (seed 42, 500 iterations, regenerated only with deliberate model changes in the same commit — last 2026-09-10 for 2.11.0); joint portfolio band pin; no repair fires on defaults (D1); one version everywhere (M15); VC structural locks (2.9.0) |
| `test_cell_weights.py` | 17 | **O6**: the 2.11.0 engine with the separable Group-split matrix and the 2.10.0 calibration reproduces the 2.10.0 fixture run to 1e-12 (category cells, portfolio band, velocity bands with jitter on, region lens); roll-up algebra; contract keys; validator and config construction |
| `test_uncertainty.py` | 19 | **O7**: prior table and floors, unscored = 2.10.0, `peak_year_jitter = 0` as the off switch, per-trend jitter widths drawn by the engine's own sampler, the onset clamp (an early draw never becomes the latest arrival), multichain event dedupe, reproducibility, drift key `"u"`, SQLite and proposals round trip |
| `test_trend_base_2026_09.py` | 13 | **O10**: seed integrity (51 drivers, ranges, sources, scores, no provenance label, snapshot), generator `--check`, code map partition and pointers, journey citations, the replacement script (dry run without schema writes, live run with the Postgres-style cascade, second-run refusal unless `--force`, Postgres refusal) |
| `test_calibration_v3_11.py` | 11 | **O11 / F-28**: defaults == calibration record, record == script output, eff_att identity, copula PSD margin on the 51 mix, validator source tags |
| `test_vc_epicentre.py` | 13 | Parity fixture table with `tests/frontend/vcEpicentre.test.ts` (Python `vc_epicentre_of` == TS `epicentreOf`); drift semantics |
| `test_input_drift.py` | 5 | D19 fingerprint and drift events |
| `test_properties.py` | 7 | Hypothesis property tests |
| `test_api.py` | 50 | Endpoint behaviour incl. the F2 409 guard, F3 read authentication, D13 backend tag, the 2.11.0 config contract (cell weights only, derived marginals, grid validation), the uncertainty field (range, round trip, explicit-null clearing) and the reseed/sync base-replacement guard |
| `test_ops.py` | 7 | M10: prod entrypoint import, `EXPECTED_TREND_COUNT` (51), H1 wrong-DB-mode exit, CLI parser, Excel writer round trip, diagnostics outage |

## Frontend suite (`tests/frontend/`, vitest, 71 tests)

| File | Locks |
|------|-------|
| `normalizeSimulation.test.ts` | Shape adapter incl. the 2.11.0 cell-weight block |
| `shiftMatrix.test.ts` | Category-weighted aggregation (single source, F1) |
| `cellWeights.test.ts` | 12 × 4 matrix marginals, sum badge, equal placeholder, row shares (O6) |
| `trendCodeMap.test.ts` | 51 live codes derived from ids, 65 retired codes with live pointers, `liveCodeFor`, journey citations (O10) |
| `vcEpicentre.test.ts` | Parity with the Python epicentre rule |
| `format.test.ts` | Display-honesty pins (one decimal, sign always visible) |
| `authRoutes.test.ts`, `prismCookie.test.ts` | Auth seam |
| `consumerJourneyDialog.test.tsx`, `homeGate.test.tsx`, `tabSmoke.test.tsx`, `usePrism.test.tsx` | Component smoke tests |

## Rules

- **Golden pins** move only with a deliberate model change and are regenerated in the same commit, with the reason in the test docstring and the decision log.
- **Reproduction locks** stay: `test_cell_weights.py` must keep reproducing the 2.10.0 numbers, so a change that breaks it is a model change, not a refactor.
- **Generated files** (`pulse/seed_trends.py`, `data/trendCodeMap.ts`, `data/attenuation_calibration_v3_11.json`) are never hand-edited; the tests compare them to their generators.
- The scipy engine is a hard requirement; there is no approximate test path.

## Useful invocations

```bash
python3 -m pytest tests/test_golden_pipeline.py -q                 # pins only
python3 -m pytest tests -q -x                                      # stop at the first failure
python3 -m pytest tests -q --durations=10                          # slowest tests
npx vitest run tests/frontend/trendCodeMap.test.ts                 # one frontend file
PRISM_DB_PATH=/tmp/x.db python3 scripts/replace_trend_base.py --dry-run   # replacement report on any SQLite copy
```
