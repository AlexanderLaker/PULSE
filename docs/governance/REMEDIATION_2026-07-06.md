# Remediation Record — 2026-07-06 (pre-DX handover review)

**Scope:** full disposition of the July 1 code review
(`CODE_REVIEW_2026-07-01_DECISIONS.md`) plus a second file-quarantine pass,
executed on branch `handover/dx-2026-07-06` and merged to `main`.
**Engine:** MODEL_VERSION **2.8.0 → 2.8.1** (golden pins regenerated in the
same commit — deliberate, owner-approved model change).
**Operator note:** the persisted production run predates 2.8.1 — run
`python3 scripts/run_50k_prod.py` after deploying so the dashboard's run
ribbon matches the engine version. Expect small median changes (L3/L4
honesty corrections, version-stamped) and the first seed-stability block.

## Owner decisions taken this round (R1–R4, 2026-07-06)

| # | Question | Ruling |
|---|----------|--------|
| R1 | Engine correctness batch (C2, M1, L3, L4) — changes numbers, needs re-pin | **Fix all + regenerate pins** |
| R2 | Dormant AI layer (`pulse/ai/` — broken import, no live route, open security findings L27/L28) | **Delete it** (archived in the owner's quarantine; any future AI layer is a fresh build per `CONCEPT_PRISM_ONLINE_AI.md`) |
| R3 | UI fixes: H6/M6/M7 save-integrity, M2 seed stability, M8 strength bar | **All: fix the three save bugs; ADD the seed-stability number; REMOVE the dead Strength bar** |
| R4 | Handover packaging (H4 history, H5 governance record) | **Fresh-history export + governance docs committed under `docs/governance/`** |

## Disposition table

Severity/IDs per the July 1 review. Commits: `4cfe368` (quarantine),
`7260ead` (engine 2.8.1), `73cb8d6` (API/ops), `a888e6e` (UI/a11y),
plus the docs/packaging commits that follow this record.

### Critical
| ID | Disposition |
|----|-------------|
| C1 | **Fixed** — `/api/v1/trends/full-reseed` is admin-only + POST-only (was an unauthenticated GET that wiped and reseeded prod). |
| C2 | **Fixed** — `load_trends()` orders by id; reproducibility no longer depends on physical row order. Order-sensitivity lock test added. |

### High
| ID | Disposition |
|----|-------------|
| H1 | **Fixed** — the prod run refuses to run with a Postgres URL configured but the SQLite fallback active (exit 4; `--allow-sqlite` for explicit local tests). psycopg2-binary added to requirements-dev.txt. |
| H2 | **Fixed** — persist failure exits 3 (after writing the QA Excel); cron/operators see failures. |
| H3 | **Owner R2: deleted** — `pulse/ai/` removed from the repo (archived in quarantine); its docs, env vars and dependencies (anthropic, feedparser, beautifulsoup4) removed with it. L27/L28 are thereby closed. |
| H4 | **Owner R4** — handover ships as a fresh-history export (`scripts/package_handover.sh`); the personal GitHub remote with old confidential decks in history is archived privately, not transferred. |
| H5 | **Owner R4: done** — this directory. |
| H6 | **Fixed** — pending expert-rating autosaves are flushed (not cancelled) on unmount; dirty-flag prevents double-saves. |

### Medium
| ID | Disposition |
|----|-------------|
| M1 | **Fixed** — missing `gp1_pct_affected` passes through as None at every persistence layer and hard-fails in the engine (no silent 10%). Also fixed: `get_trend_by_id` silently dropped gp1/peak_year/diffusion_curve (found during remediation — could wipe fields on round-trip). |
| M2 | **Owner R3: re-added** — `seed_stability` (terminal-year portfolio-median spread across independently-seeded chains) computed, persisted, served, typed, and shown in the About-this-model footer. Honest framing: measures MC sampling noise only; ≈0 pp expected at 50k × 3. Pre-2.8.1 runs show "not recorded". |
| M3 | **Fixed** — audit entries carry the verified-JWT identity (`identity_from_user` in `pulse.api.auth`) on every mutating endpoint; snapshots record `created_by`. |
| M4 | **Fixed** — `/diagnostics` no longer crashes on the DB outage it exists to explain (missing JSONResponse import) + regression test. |
| M5 | **Fixed** — all category-weight resolution delegates to `lib/shiftMatrix.ts`; the single-source guard now also catches arrow-style re-declarations and raw weight-map lookups. |
| M6 | **Fixed** — `updateTrend` always attempts the write and rethrows on failure; no more false "✓ Endorsed" while offline. |
| M7 | **Fixed** — reconnect triggers a data reload; load epochs prevent an older response overwriting a newer one. |
| M8 | **Owner R3: removed** — the never-rendered Strength bar and the phantom `impact`/`score`/`weighted_score` type fields are gone; the drill-down tiebreak uses `normalized_score` (was a no-op). Contract locked by test. |
| M9 | **Fixed** — CI engine job installs `requirements-dev.txt` (cache keyed on it); upper bounds added to the requirements. |
| M10 | **Fixed** — `tests/test_ops.py`: prod-entrypoint import test, H1 wrong-db-mode exit test, CLI parser guard, Excel writer round-trip, M4 outage test. |
| M11 | **Fixed** — aiohttp/feedparser/requests removed from the serverless runtime (zero importers). |
| M12 | **Fixed** — snapshots: 512 KB payload cap + newest-50-per-creator retention + creator attribution. |
| M13 | **Already fixed** before this round (design-review r05 split the totals flags); verified. |
| M14 | **Fixed** — CLAUDE.md/README/HANDOVER reconciled to the actual tree (this round's doc commits). |
| M15 | **Fixed** — one authoritative version: `pulse.__version__` == `MODEL_VERSION` == package.json == 2.8.1, locked by test (the API had been advertising 6.0.0). |
| M16 | **Fixed** — attenuation provenance scripts are repo-relative and write their JSON into `data/` (tracked). |
| M17 | **Fixed** — `.env` no longer overrides real shell variables (`override=False`); the dead 270-line EnvConfig (deleted features only, zero importers) removed. |

### Low / hygiene
| ID | Disposition |
|----|-------------|
| L1 | **Fixed** — `--seeds` wobble crash (`int('path')`) in the CLI **and** the same latent defect in `POST /simulate`; end-of-run audit-call arity bug (TypeError after every CLI run); dead `--ai` flag removed. |
| L2 | **Fixed** — the redundant *silent* PSD repair was deleted; the two remaining repair paths both emit integrity events. |
| L3 | **Fixed (R1)** — copula uniforms clip at float-safety (1e-12), not 0.001; std/mean no longer biased inward. |
| L4 | **Fixed (R1)** — compounding factors floored at 0 (−100% is the semantic lower bound); affected cells counted in an integrity event. |
| L5 | **Fixed** — `fmtShift`/`fmtPct` never print "-0.0%"; format test suite added. |
| L6 | **Fixed** — drift fingerprint covers exposure maps, peak year and diffusion curve (backward-compatible: pre-2.8.1 fingerprints skip the new fields on first diff). |
| L7 | **Fixed** — drift severity escalates to warning on any trend add/remove. |
| L8 | **Fixed** — the master seed is persisted (`meta.seed`) alongside derived `chain_seeds`. |
| L9–L12 | **Fixed** — semantic shift colors in the Trends table; hex duplicates eliminated (RGB tokens for custom alphas); one force palette; missing GP1 renders "—" with an honest 0–100% bar. |
| L13 | **Fixed** — prod-run banner derives from MODEL_VERSION; the closing headline prints the portfolio median + band (the dashboard's number). |
| L14 | **Fixed** — engine docstring no longer claims tail dependence for a Gaussian copula. |
| L15 | **Fixed** — hardcoded "2030" log strings interpolate the real terminal year; `median_2030` → `median_terminal` (+ `terminal_year`). |
| L16 | **Fixed** — matrix cells carry full P10–P90 aria-labels (screen readers get the band in table navigation; keyboard users reach it via the row drill-down). KPI tiles already mirrored hover/focus. |
| L17 | **Already fixed** before this round (design-review r03 put all modals on `useOverlay`); verified. |
| L18 | **Fixed** — `tr[role="button"]` replaced by a real in-cell drill-down button; `aria-sort` misuse replaced by accessible names; dot ratings are valid single-checked radio groups. |
| L19 | **Fixed** — 34 root working files quarantined (`_NOT_FOR_HANDOVER/working-files-2026-06-24_07-03/`). |
| L20 | **Already resolved** (no `.bak` files remained). |
| L21 | **Fixed** — `git gc` run as part of the packaging step. |
| L22 | **Fixed** — secrets never ship: `.env`/`.clerk` are gitignored, the packaging script builds a fresh-history export and verifies no secret-bearing file is included. Rotation at handover remains on the owner checklist (HANDOVER.md). |
| L23 | **Fixed** — dead `/api/py` rewrites, dead `/images/` header, phantom tsconfig excludes, dead `_ARCHIVE` lint ignore; config comments in English. |
| L24 | **Fixed** — unused `d3` + `@types/d3` removed; `@types/node` aligned to Node 22. |
| L25 | **Fixed** — dead `runSimulation`/`SimulationParams` removed; 20 s request timeout on every API call. |
| L26 | **Fixed** — the 11 legacy-auth tombstone stubs (4 pages + 7 410-routes) deleted; Clerk owns auth end-to-end. The legacy `users` table's password columns remain in the SCHEMA only (nothing reads or writes them) — dropping prod columns is a DX-owned migration, listed in HANDOVER.md §7 backlog. |
| L27/L28 | **Closed by R2** (AI layer deleted). |
| L29 | **Fixed** — golden fixture differentiated (pins pairwise distinct + per-trend schedule coverage); portfolio-band pin; journey reconciliation test; no-repair-on-defaults test; the vacuous spread assertion replaced with real invariants; version-sync test. |

## Found during remediation (beyond the review)

1. `get_trend_by_id` dropped `gp1_pct_affected`, `peak_year`, `diffusion_curve` — a data-wipe risk on any future round-trip caller (fixed with M1).
2. `GET /api/v1/simulation` carried a third, already-drifted inline copy of the run-rehydration logic — consolidated into the F4 service function.
3. The CLI's end-of-run `log_simulation_run` call had the wrong arity (TypeError after every `python -m pulse` run) — fixed with L1.

## Explicitly NOT done (with reason)

- **No wholesale splitting of the large dashboard components** (Trends2 ≈ 2.8k lines etc.). They are working, tested, audited code days before handover; the pure math already lives in `lib/`, the shared UI in small components. A structural refactor is DX's call to make with time to regression-test — churning it now would trade real review-findings for cosmetic line counts at behavior risk.
- **No dropping of legacy DB columns** (`users.password_*`, `trends.scorer_count/score_variance/debiasing_applied`, `simulation_runs.allocation_recommendation`) — harmless, nothing writes them; dropping prod columns belongs in a DX-scheduled migration window.
- **Open-by-decision findings stay open** (F-08 no hindcast, F-09 one-sided grammar, F-20 no position overlay) — owner rulings, documented in `FINDINGS_REGISTER.md`.
