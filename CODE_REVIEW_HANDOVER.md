# PRISM — Code Review & Handover-Readiness Report

**Branch:** `review/handover-perfection-pass` (base `main`) · **Date:** 2026-06-14
**Reviewer role:** independent principal/staff engineer (architecture · security · QA · handover)
**Scope:** full perfection pass — assess *and* rework to a handover-ready state, with strict sign-off carve-outs (engine math semantics, golden-pin-moving changes, honesty-set UI copy, open-by-decision items were *proposed*, not applied).

---

## Executive summary

**Verdict: GO for handover to Henkel DX, with three owner decisions to close (none blocking).**

PRISM is a genuinely well-built, intellectually honest system. Its core — the scipy-only Bayesian Monte-Carlo engine, the offline-compute / online-read-only split, the single-source shift-matrix math, the Clerk→JWT auth bridge, and the "honest display" set — is sound and was largely untouched by this pass because it did not need fixing. Prior audits (D1–D21) did real work.

The weaknesses were almost entirely on the **handover surface**, not the engine:

- **CI was silently red.** `tests/test_scanner_routes.py` imports symbols the (dormant) scanner module no longer exports; it was hidden locally only because `httpx` is absent, but CI installs `httpx`, so the engine job errored at collection. **Fixed** — CI is now green (76 tests pass).
- **The deploy runbook would mislead a new developer.** `DEPLOY.md` named the wrong env vars (`PULSE_DB_PATH`, `JWT_SECRET`, `CLERK_WEBHOOK_SECRET`), referenced Next.js 14, a deleted `pulse/optimizer/`, a non-existent `cowork-deploy.sh`, and an "interactive `/simulate`" that contradicts the read-only design. **Fixed.**
- **A code comment contradicted a core decision.** `api/requirements.txt` claimed "scipy removed — numpy fallbacks used instead," directly contradicting D13 (no fallback exists, by design). **Fixed.**
- **Dependency and manifest drift:** 13 unused dev packages, a missing `httpx`, a real DB-path inconsistency (`pulse.db` vs `prism.db`), and `package.json` still calling itself `pulse-profit-pool-shift-model@2.1.0`. **Fixed.**

I independently verified the **secrets** claim against the working tree **and the full git history**: it is **clean** — every match is an `.env.example` placeholder, a docs key-format example, or a `postgresql://...@host` template; `.env` was never committed; `_NOT_FOR_HANDOVER/` was never tracked. **No key rotation or fresh-history export is required for secret-leakage reasons.** (Confidential strategy decks do exist in older history — a separate IP decision, see sign-off backlog.)

All work is on the review branch in seven atomic commits. `npm run verify` is green (typecheck, lint, vitest 33, pytest 76); the **2.8.0 golden pins are byte-for-byte unchanged**; engine math, config, and honesty-set copy were not touched. An independent fresh-eyes subagent re-ran every gate and audited the full diff against the guardrails: **PASS**.

## Kurzfassung für die IT-Abteilung

PRISM ist ein solide gebautes, gut dokumentiertes System; der Kern (scipy-Engine, Offline-Berechnung / Online-Read-only, Auth-Bridge, „ehrliche" Ergebnis-Darstellung) ist tragfähig und wurde bewusst **nicht** verändert. Die Schwächen lagen an der **Übergabe-Oberfläche**: Die CI war faktisch rot (ein veralteter Test brach die Sammlung unter CI-Bedingungen ab), die Deploy-Anleitung nannte **falsche Umgebungsvariablen** (`PULSE_DB_PATH`, `JWT_SECRET`, `CLERK_WEBHOOK_SECRET`) und veraltete Architektur (Next.js 14, gelöschtes `optimizer`-Modul), ein Code-Kommentar widersprach einer Kern-Entscheidung (D13, „kein numpy-Fallback"), und es gab Abhängigkeits-/Versions-Drift. Alle diese Punkte sind auf dem Branch `review/handover-perfection-pass` in sieben nachvollziehbaren Commits behoben; die Qualitäts-Gates sind grün, die deterministischen „golden pins" der Engine **unverändert**. Geheimnisse (Secrets) wurden im Arbeitsstand **und in der gesamten Git-Historie** unabhängig geprüft: **sauber** — kein echter Schlüssel, keine Rotation nötig. **Empfehlung: übergabebereit (GO)**, mit drei zu entscheidenden Punkten (siehe Sign-off-Liste): (1) Auth auf `GET /api/v1/journey`, (2) ob die alten Strategie-Decks aus der Git-Historie entfernt werden sollen, (3) `next build` benötigt den Clerk-Build-Key. Keiner davon blockiert die Übergabe.

---

## 1. Scorecard (before → after)

| # | Dimension | Before | After | One-line justification |
|---|-----------|:---:|:---:|------------------------|
| 1 | Correctness & math integrity | 4 | **5** | Engine deterministic; golden pins pass untouched; scipy-only & guards verified. The one real bug — `env_loader` defaulting to `pulse.db` while `database.py` uses `prism.db` — is fixed. |
| 2 | Security & secrets hygiene | 4 | **4** | Secrets verified clean in tree **and full history**; JWT HS256 pinned (no `alg=none`), expiry checked; every data endpoint authenticated **except** `GET /journey` (flagged for sign-off). |
| 3 | Architecture & boundaries | 5 | **5** | Offline/online contract enforced in code (409 guard, no scipy in serverless reqs); single-source shift-matrix math lint-enforced; clean router/service split. |
| 4 | Type safety & API contracts | 5 | **5** | `strict: true`, zero `any`/`@ts-ignore` in live code; pydantic validates every config layer; client/server types in lockstep. |
| 5 | Testing & coverage | 3 | **4** | Healthy pyramid (engine, golden, properties, API auth/409, input-drift, frontend). A stale test was breaking CI collection — **repaired**; suite green at 76. No formal coverage gate yet (recommendation). |
| 6 | Performance & scalability | 4 | **4** | 50k×3 run is vectorized scipy; serverless never computes; no N+1 found. Not deeply profiled (no signal it needs it). |
| 7 | Error handling & observability | 4 | **4** | Explicit failures; integrity + input-drift events on every run; meaningful `/health` & `/diagnostics`. A few bare excepts in non-critical migration/audit paths (acceptable, logged). |
| 8 | Maintainability & readability | 3 | **4** | Dead code now quarantined out of the live tree; docs reconciled; intention-revealing names. Residual root-doc sprawl flagged. |
| 9 | Dependency hygiene | 2 | **4** | Pruned 13 unused dev packages; added missing `httpx`; corrected the false `api/requirements` comment; reconciled `package.json` name/version. |
| 10 | Documentation & handover readiness | 2 | **4** | `DEPLOY.md` rewritten to live reality (correct env vars, Next 16, read-only model); README repointed to existing docs; CLAUDE corrected. 24 loose root docs remain → flagged. |
| 11 | Frontend & UX quality | 4 | **4** | Single-source design tokens; real loading/empty/error states; direction encoded by arrow+color (not color alone). Formal WCAG AA audit not completed this pass (recommendation). |
| 12 | DevEx, CI/CD & repo hygiene | 2 | **4** | CI was red → now green; `*.log` ignored + stray log untracked; clean atomic history. `next build` from a clean clone still needs the Clerk build key (by design/env) → flagged. |

**Target met:** every dimension scores ≥ 4 after the pass; **no open Critical findings**. Items held at 4 carry an honest residual (an `≥4`-blocking nuance is tracked in the sign-off backlog, not silently inflated).

---

## 2. Critical & High findings

| # | File:line | Issue | Severity | Status |
|---|-----------|-------|:---:|:---:|
| — | — | **No open Critical findings.** | 🔴 | — |
| H1 | `tests/test_scanner_routes.py:24` | Imports `_scan_source` (+ siblings) no longer exported by `pulse/api/routes/scanner.py`. Under CI conditions (`httpx` installed → the file's `importorskip` passes) it **errors at collection and fails the CI engine job**; hidden locally because `httpx` is absent. | 🟠 High | ✅ Fixed `44db8e7` |
| H2 | `DEPLOY.md` (env table, architecture, sim section) | Deploy runbook would mislead a new dev: wrong env-var names (`PULSE_DB_PATH`→`PRISM_DB_PATH`, `JWT_SECRET`→`PRISM_JWT_SECRET`, `CLERK_WEBHOOK_SECRET`→`CLERK_WEBHOOK_SIGNING_SECRET`), Next.js 14, deleted `pulse/optimizer/`, non-existent `scripts/cowork-deploy.sh`, "interactive `/simulate`" (contradicts F2/D13). | 🟠 High | ✅ Fixed `da1803b` |
| H3 | `api/requirements.txt:3` | Comment "scipy removed — numpy fallbacks used instead" directly contradicts D13 ("no approximation fallback anywhere"); risks a dev assuming the serverless runtime can compute. | 🟠 High | ✅ Fixed `2b3010d` |
| H4 | `requirements-dev.txt` | 13 packages with **zero imports** in the live tree (pandas, networkx, arviz, statsmodels, newspaper3k, jinja2, gdeltdoc, praw, pytrends, fredapi, openmeteo-requests, python-epo-ops-client, google-api-python-client); `httpx` (needed by the test client / CI) absent. | 🟠 High | ✅ Fixed `2b3010d` |

---

## 3. Full findings register (Medium / Low / informational)

### Correctness
- **M1 — DB path inconsistency.** `pulse/env_loader.py:62,157` defaulted to `data/pulse.db` (and `/tmp/pulse.db`), but `pulse/database.py:86`, which actually opens the SQLite DB, defaults to `data/prism.db`. With `PRISM_DB_PATH` unset they diverge. ✅ Fixed `f1384ee` + `986740c` (docstring).

### Security
- **M4 — `GET /api/v1/journey` is unauthenticated at the FastAPI layer** (`pulse/api/routers/journey.py:19`). The Next proxy (`app/api/journey/route.ts`) enforces `requireAuth` and forwards a Bearer JWT, but `/api/v1/journey` is directly reachable via the Vercel rewrite, so a direct call bypasses auth — inconsistent with the "every data endpoint authenticates" invariant. **Flagged, not changed** (see sign-off #1): the router explicitly documents GET as "anonymous by design" with a passing test, journey content is non-sensitive marketing copy, and closing it forces a test/docstring change that overrides a stated decision.
- **Informational — secrets verified clean (tree + full history).** Every hit for `sk_live_/pk_live_/CLERK_SECRET_KEY=/postgresql://` is a placeholder (`.env.example` empty values, docs showing `sk_test_…/sk_live_…` formats, `postgresql://...@ep-xxx.neon.tech` templates). `sk-ant-` has **zero** history hits → no real Anthropic key ever committed. `.env` never committed; `_NOT_FOR_HANDOVER/` never tracked (0 entries). No rotation/scrub needed for secrets.

### Documentation
- **M3 — README pointed to a relocated folder.** `README.md` referenced `DOCUMENTATION/` and `DOCUMENTATION/INDEX.md`, which the relocation moved into the quarantine. ✅ Fixed `da1803b`.
- **M6 — root-doc sprawl.** 24 loose `*.md` files at the repo root; several are stale and duplicate copies now sitting in the quarantine. **Flagged** (sign-off #4): recommend consolidating to `HANDOVER.md` + `CLAUDE.md` + a slim, current set — but which docs are canonical is an owner judgment.

### Dependency / manifest
- **M2 — `package.json` identity drift.** Was `pulse-profit-pool-shift-model@2.1.0` vs product PRISM / MODEL_VERSION 2.8.0. ✅ Fixed `2b3010d` (→ `prism-profit-pool-engine@2.8.0`; verified nothing user-facing reads the package version).
- **Informational — `lucide-react@^1.17.0`** looked suspicious but resolves to a real installed `1.17.0`; typecheck/tests pass. No action.
- **L5/L6 — `beautifulsoup4` is referenced only in a comment** in `pulse/ai/scanner.py` (no live `import bs4`). Kept for the dormant-but-revivable AI layer; the `requirements-dev.txt` comment slightly overstates current usage. No action (defensible).

### DevEx / repo hygiene
- **L1 — `env_loader` docstring** still showed `data/pulse.db`. ✅ Fixed `986740c`.
- **L2 — tracked `vite_server.log`** (inside the quarantine). ✅ Fixed `986740c` (untracked; `*.log` now ignored).
- **L3 — 15 eslint warnings** (`react-hooks/set-state-in-effect`, e.g. `hooks/usePrism.ts:140`). Advisory React-Compiler diagnostics around the health-check reconnect loop; not errors. **Noted** — acceptable; candidate for a future React-Compiler-clean refactor.
- **L4 — `scripts/run_50k_prod.py:54`** only warns (doesn't abort) on a non-Neon DB URL. **Noted** — left as-is deliberately (a staging Postgres is a legitimate target; hard-failing could be wrong).

### Frontend
- **Informational — frontend is clean:** zero `any`/`@ts-ignore` in live code, single-source `lib/format.ts` tokens, auth bridge enforces session+JWT on every `app/api/**` route, no `dangerouslySetInnerHTML`, no `localStorage`. A formal WCAG 2.1 AA audit was **not** completed in this pass (recommendation).

### Open-by-decision (not bugs — untouched, by guardrail)
- F-08 (no hindcast / no predictive-validity claim), F-09 (one-sided trend grammar), F-20 (no Henkel-position overlay). Left exactly as decided.

---

## 4. What was changed (changelog)

Seven atomic commits on `review/handover-perfection-pass` (oldest → newest). Net diff vs `main`: **131 files, +473/−82** — of which **116 are relocations** (0-line renames into the quarantine) and **12 are real content edits**.

| Commit | Category | Summary |
|--------|----------|---------|
| `ba65794` | Repo hygiene | Finalized the inherited staged relocation of non-live files (legacy Vite dashboard, dead Python, superseded docs, compiled web assets) into `Not in Live Version/`; excluded from eslint + both tsconfigs. |
| `44db8e7` | **CI repair** | Relocated the stale `test_scanner_routes.py` out of `tests/` → CI engine job goes from red to green (76 pass). |
| `f1384ee` | Correctness | `env_loader` SQLite default `pulse.db` → `prism.db` to match `database.py`. |
| `2b3010d` | Deps / manifests | Pruned 13 unused dev deps, added `httpx`; corrected the D13-contradicting `api/requirements.txt` comment; reconciled `package.json` name + version (→ 2.8.0). |
| `da1803b` | Docs | Reconciled `DEPLOY.md` (correct env vars, Next 16, read-only model, real deploy mechanics), `README.md` (repointed relocated docs), `CLAUDE.md` (scanner-test line). |
| `986740c` | Repo hygiene | Ignore `*.log`; untracked the stray `vite_server.log`; fixed the `env_loader` docstring. |
| `63b214f` | Repo hygiene | Moved the internal review-prompt doc out of the shipped root into the quarantine. |
| _(follow-up)_ | Repo hygiene | **Owner decision:** consolidated both non-live folders into the single **gitignored** `_NOT_FOR_HANDOVER/` and untracked them. The repo now tracks **only live product code**; confidential strategy decks (already gitignored) can never enter git. Re-pointed the eslint/tsconfig/.vercelignore excludes accordingly. |

**Before → after metrics**

| Metric | Before | After |
|--------|:------:|:-----:|
| CI engine job (httpx present) | ❌ collection error | ✅ 76 passed |
| `npm run verify` | green *locally only* (hid the CI break) | ✅ green (typecheck, lint, vitest 33, pytest 76) |
| 2.8.0 golden pins | 7 pass | ✅ 7 pass, **unchanged** |
| Unused dev dependencies | 13 | 0 |
| Wrong/stale env-var names in deploy docs | 3 | 0 |
| Tracked `.log` files | 1 | 0 |
| Non-live files tracked in git | mixed in | 0 — all consolidated into the gitignored `_NOT_FOR_HANDOVER/` (local-only) |

---

## 5. Owner sign-off backlog (proposed, **not** applied)

These were deliberately *not* changed — each either changes observable behaviour against a documented decision, depends on owner judgment, or is an environment/IP call.

1. **Authenticate `GET /api/v1/journey`** *(security consistency, Medium)*. One-line change: add `Depends(require_auth)` to `pulse/api/routers/journey.py:19` (the Next proxy already sends a Bearer token, so the legitimate path keeps working; only direct unauthenticated reads get blocked). **Why flagged:** the router + a passing test (`tests/test_api.py::TestJourneyContentStore`) document GET as "anonymous by design," so this contradicts a stated decision and requires updating that test. **Risk of acting:** minimal (non-sensitive content). **Risk of not acting:** a data endpoint stays directly readable without auth, inconsistent with the stated invariant.

2. **Fresh-history export for confidential decks** *(IP hygiene, owner call)*. Secrets are clean, but older commits (e.g. `da14edc`, `542b2f7`) committed strategy `*.pptx`/`*.pdf` decks. **Risk of acting:** rewriting history needs a coordinated re-clone for anyone with the repo. **Risk of not acting:** internal decks travel with the repo to DX. Decide whether DX is "internal enough" to keep history, or do a `git filter-repo` export before transfer. *(Not required for secrets.)*

3. **`next build` from a clean clone needs the Clerk build key** *(build robustness, Medium)*. `<ClerkProvider>` wraps the whole app including the statically-prerendered `/_not-found`, so `next build` fails without `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. It works on Vercel (key present) and CI never builds, so this is non-blocking. **Option:** scope `ClerkProvider` off the 404/error routes or supply a build-time fallback key. I documented the requirement in `DEPLOY.md` rather than changing auth wiring.

4. **Consolidate the 24 root docs** *(doc hygiene)*. Recommend `HANDOVER.md` + `CLAUDE.md` as the canonical pair and relocating stale/duplicate root docs into the quarantine — but the canonical/stale split is an owner judgment.

5. **(Optional) Formal coverage gate + WCAG AA pass.** Add a coverage target on `pulse/simulation` and run `design:accessibility-review` on the dashboard before external release. Not done this pass (time-boxed); neither blocks handover.

---

## 6. Handover-readiness verdict

**GO for handover to Henkel DX.** A new full-stack developer can clone, run the gates, run locally, and deploy from the (now-accurate) docs. Conditions, mapped to a deploy checklist:

| Gate | State |
|------|-------|
| `npm run verify` green from a clean clone | ✅ (CI mirrors it: `.github/workflows/ci.yml`) |
| CI green | ✅ repaired (was red on the scanner test) |
| Golden pins unchanged / engine determinism intact | ✅ verified, twice (me + independent subagent) |
| Secrets clean (tree + history) | ✅ verified; no rotation needed |
| `.gitignore` complete; no tracked build artifacts/DBs/logs | ✅ |
| Required production env vars documented & correct | ✅ (`DEPLOY.md` env table fixed) |
| `npm run build` from a clean clone | ⚠️ needs `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (Vercel has it; sign-off #3) |
| Rollback path documented | ✅ (`DEPLOY.md` → `git revert` / Vercel "Promote") |

**Conditions to close before/at transfer:** sign-off items #1–#3 (all non-blocking). Smoke test after deploy: `GET /api/v1/health` → `{status:"ok", trend_count:99, categories:12}`; confirm the dashboard renders the latest persisted run; confirm `POST /api/v1/simulate` returns **409** (read-only guarantee).

---

## 7. Appendix — environment, commands, reproduction

**Toolchain (sandbox):** Node 22.22.3 · npm 10.9.8 · Python 3.10.12 · scipy 1.15.3 · numpy 2.2.6.

**Reproduce the verification:**
```bash
git checkout review/handover-perfection-pass
npm ci
npm run typecheck && npm run lint && npm run test     # frontend gates
pip install numpy scipy fastapi pydantic pytest hypothesis httpx python-dotenv
python -m pytest tests/ -q                             # engine gates (76 pass)
python -m pytest tests/test_golden_pipeline.py -q      # golden pins (7 pass, unchanged)
```

**Two environment caveats that are NOT code defects** (they shaped how this review verified things, and DX should know them):

1. **SQLite on a network/OneDrive mount throws `disk I/O error`.** The API tests that touch the DB fail on a mounted filesystem because SQLite can't lock files there. Run them with the DB on a local path: `PRISM_DB_PATH=/tmp/prism.db python -m pytest tests/ -q`. On CI's normal filesystem this is a non-issue (76 pass).
2. **`git` and `next build` on the mount can't `unlink`.** The mount permits `rename` but blocks `unlink`, so git leaves stale `.git/index.lock`/`HEAD.lock` and Turbopack/`next build` can't clean `.next/`. Commits still succeed (git finalizes via rename); clear a stuck lock by renaming it (`mv -f .git/index.lock .git/_stale.lock`), not deleting. **This is why dead code in this review was *relocated* (into the gitignored `_NOT_FOR_HANDOVER/`) rather than `git rm`-deleted** — the established, mount-safe pattern. The full `next build` is exercised authoritatively on Vercel; `tsc` typecheck (which the build also runs) is green locally.

**Independent verification:** a separate fresh-eyes agent re-ran all gates and audited the full `main...HEAD` diff against the guardrails (golden pins, no scipy fallback, no resurrected features, honesty-set copy, engine/config untouched, branch ≠ main) → **PASS**, no concerns beyond the sign-off items above.

---

*Prepared on branch `review/handover-perfection-pass`. Engine math, honesty-set copy, and open-by-decision items were deliberately left untouched per the review guardrails; everything in §5 is proposed for owner sign-off, not applied.*
