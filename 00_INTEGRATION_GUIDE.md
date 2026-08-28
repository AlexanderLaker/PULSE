# PRISM — Integration Guide

**For:** the technical lead scoping the integration of PRISM into Henkel infrastructure.
**Purpose:** read this folder in 10 minutes. What the system is, where everything lives, where the integration work actually sits, and which documents to trust.
**Prepared:** 2026-08-24 · against `MODEL_VERSION 2.10.0` / `package.json` 2.10.0.

---

## 1. What you are looking at

PRISM is a profit-pool simulation platform for consumer-brands category strategy. 99 scored external trends feed a Bayesian Monte-Carlo engine (Beta priors, Gaussian copula, scipy) which produces a **Shift Matrix**: relative percentage impacts per category × region × force × year (2026–2035). A Next.js dashboard renders it.

**The one architectural fact that shapes every integration decision:**

```
OFFLINE  (operator machine today, a scheduled job tomorrow)
  python3 scripts/run_50k_prod.py
    → loads 99 trends from Postgres
    → Bayesian MC, 3 chains × 50k, scipy
    → persists ONE results row to the database
    → writes a QA Excel

ONLINE  (Vercel today, Henkel-hosted tomorrow)  — READ-ONLY
  Next.js 16 frontend + Python serverless adapter (api/index.py)
    → renders the LATEST persisted run
    → never simulates: POST /api/v1/simulate returns 409 without scipy
    → api/requirements.txt deliberately contains NO scipy
```

The compute tier and the serving tier are separate on purpose. `scipy` is a hard requirement of the engine — the module refuses to import without it, and there is no numeric fallback anywhere. When you relocate the compute, it may go anywhere that has scipy; it must never go into a runtime that would silently approximate the math.

Two more framing points, so you scope the right thing:

- The engine emits **relative shifts only**, never currency. Users apply the percentages to their own financials.
- Nothing is auto-applied. Config changes are admin-only, validated, and reason-logged.

---

## 2. Folder map

Everything below is the live product unless the last column says otherwise.

| Path | What it is | Matters for integration |
|---|---|---|
| `app/` | Next.js 16 App Router. Dashboard page, Clerk sign-in/sign-up, and **9 server API routes** under `app/api/` that act as the BFF: they verify the Clerk session and mint the short-lived JWT the Python engine accepts. | **Yes — auth seam** |
| `components/dashboard/` | 12 React components. The heavy ones are `ProfitPoolAnalysis2.tsx` (Shift Matrix + lenses), `Trends2.tsx` (trend explorer/editor), `ConsumerJourney2.tsx`, `ProfitPoolExplorer.tsx`, `CategoryDetailPanel.tsx`, `SettingsModal.tsx`. | Presentation only |
| `hooks/usePrism.ts` | The single data provider for the whole dashboard. One place to look for client state. | Useful |
| `api/client.ts` | Typed client for every `/api/v1/*` call (20 s timeout per request). | Useful |
| `api/index.py` | Vercel serverless adapter — imports the FastAPI app, with cold-start retry. **The hosting seam.** | **Yes — hosting** |
| `api/requirements.txt` | Serverless runtime deps: fastapi, pydantic, numpy, psycopg2-binary. No scipy, by design. | **Yes** |
| `pulse/` | The Python engine and FastAPI app. `simulation/bayesian_mc.py` is the model; `api/routers/` holds the **7 routers**; `database.py` is dual-mode Postgres/SQLite; `audit/` is drift telemetry and the audit log; `excel_bridge/writer.py` is the only export. | **Yes — the product** |
| `lib/` | Server helpers (`roles.ts`, `db.ts`, `prismJwt.ts`) plus the lint-enforced single sources for shift math (`shiftMatrix.ts`) and display (`format.ts`). | **Yes — auth + DB** |
| `types/` | Shared TypeScript types, including the simulation result contract. | Useful |
| `data/` | Static front-end content (`consumerJourney.ts`, `trendCodeMap.ts`), the attenuation calibration JSON/XLSX, and `prism.db` — a **local SQLite fallback only**, never production. | Read the note |
| `scripts/` | `run_50k_prod.py` (the canonical production run), two one-shot DB migrations, `promote_admin.py`, the shift-matrix lint guard, and `package_handover.sh`. `scripts/archive/` holds spent migrations. | **Yes — the job** |
| `tests/` | 7 pytest modules + `conftest.py` (engine, API, ops, golden pins) and 10 vitest specs under `tests/frontend/`. | **Yes — your safety net** |
| `docs/` | Engineering docs plus `docs/governance/` — the decision log and findings register. Code comments cite these by finding ID. | Yes, see §5 |
| `.github/workflows/ci.yml` | Two CI jobs: frontend (typecheck + lint + vitest) and engine (pytest **with** scipy). | **Yes — CI** |
| `proxy.ts` | Next.js 16's replacement for `middleware.ts`. Clerk session gate; declares which routes are public. | **Yes — auth** |
| `vercel.json` | The current deploy contract: `next build`, and the rewrite `/api/v1/*` → `api/index.py`. Replace this when you move off Vercel. | **Yes — hosting** |
| `next.config.js` | Dev-only proxy of `/api/v1/*` to the local FastAPI on :8000. Inert in production. | Useful |
| `_NOT_FOR_HANDOVER/` | Quarantine. Decks, internal audits, mockups, old run outputs, secrets helpers. Git-ignored, never deployed, and structurally excluded from the handover package. **Not part of the system.** | No — ignore |

Directories you can ignore entirely: `node_modules/`, `.venv/`, `.next/`, `.vercel/`, `.clerk/`, `.claude/`. Standard local artifacts, all git-ignored.

---

## 3. Where the integration work actually is

Five seams. Everything else is application code that travels unchanged.

**1. Identity — Clerk.**
Clerk owns sign-in, sign-up and sessions. The Next.js layer verifies the Clerk session and mints a short-lived HS256 JWT (`lib/prismJwt.ts`) which the Python engine verifies (`pulse/api/auth.py`). The engine has **no user store of its own**. Roles (admin/viewer) live in a Next-managed Postgres table via `lib/roles.ts`. Replacing Clerk with Henkel SSO means replacing the front half of that bridge; the JWT contract and the engine side can stay as they are.

**2. Database — Neon Postgres.**
`pulse/database.py` runs dual-mode: Postgres in production, SQLite locally. You will receive a `pg_dump`, not credentials. The schema is documented in `CLAUDE.md` §6. Two one-shot legacy-cleanup migrations in `scripts/` are still pending against production — see the backlog in `HANDOVER.md` §7.

**3. Hosting — currently Vercel.**
Two artifacts define it: `vercel.json` (build + the `/api/v1/*` rewrite) and `api/index.py` (the ASGI adapter). Moving to containers means replacing both with your own ingress and an ASGI server in front of `pulse.api.app:app`. Nothing in `pulse/` knows it is on Vercel.

**4. The offline compute job.**
`scripts/run_50k_prod.py` is the only thing that writes a simulation run. Today a person runs it. The target state is a scheduled job on infrastructure that has scipy. Exit codes are meaningful: `0` ok · `1` no DB URL · `2` no trends · `3` persist failed · `4` wrong DB mode · `5` non-PSD correlation matrix. Runtime is roughly 2–6 minutes.

**5. Secrets and configuration.**
`.env.example` is the template; `README.md` has the full variable table. All credentials are rotated at handover. The one that trips people up: `PRISM_JWT_SECRET` is a **single shared secret** read by both the Next.js side and the FastAPI side — a mismatch produces 401s on every data call and nothing else. See `docs/DEPLOYMENT_NOTES.md`.

---

## 4. Standing it up locally

```bash
# prerequisites: Node 22.x, Python 3.10+

npm install
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt      # full dev set, includes scipy and pytest
cp .env.example .env                     # fill in — variable table in README.md

# two terminals
python -m uvicorn pulse.api.app:app --reload --port 8000    # engine  (python -m pulse --serve also works)
npm run dev                                                  # dashboard on :3000
```

Without a Postgres URL the engine falls back to SQLite at `data/prism.db`. Real shell environment variables win over `.env`, so you can redirect a single run from the command line.

**The gate that tells you the checkout is healthy:**

```bash
npm run verify    # typecheck + eslint + single-source guard + vitest + pytest
```

CI runs exactly these. Two things about it are deliberate and will look like defects if nobody warns you:

- `npm run lint` includes `scripts/check_shiftmatrix_single_source.sh`, which **fails the build** if shift-matrix aggregation math appears anywhere except `lib/shiftMatrix.ts`. Intentional.
- `tests/test_golden_pipeline.py` carries golden pins. They regenerate only as a deliberate model change, in the same commit, with a version bump. Never regenerate them to make CI green.

---

## 5. Which documents to trust

Read in this order:

1. **`CLAUDE.md`** — the specification and single source of truth. Currently **v3.10 / MODEL_VERSION 2.10.0**, and the most current document in the folder. §1 is the changelog, §2 architecture, §6 database schema, §7 the live API route table.
2. **`README.md`** — setup, repository layout, the full environment-variable table. Current.
3. **`HANDOVER.md`** — the takeover guide: operating model, runbook, and a section 6 titled *"Landmines — decisions you must not accidentally undo."* Read section 6 before changing anything in the model. ⚠️ **Its header still says v3.8 / MODEL_VERSION 2.8.1** — two engine versions behind. The operational content holds; the version stamps do not.
4. **`DEPLOY.md`** — the deploy runbook. Accurate on mechanics, ⚠️ **stale in a few places**: it shows a `pulse/ai/` package in the architecture tree (deleted July 2026), it lists `ANTHROPIC_API_KEY` under required production variables (the AI layer is gone), and it mentions an `/api/py/*` route alias that was removed from both `next.config.js` and `vercel.json`.
5. **`CONCEPT_PRISM_ONLINE_AI.md`** — the target-state concept for Henkel hosting and a future AI layer. Roadmap, not current state.
6. **`docs/`** — `TESTING.md`, `DESIGN.md`, `CLERK_MIGRATION.md`, `DEPLOYMENT_NOTES.md`, `CONNECTION_STATUS_GUIDE.md`, `SEED_DATA_README.md`, plus two provenance docs cited from live code. `docs/INDEX.md` lists them.
7. **`docs/governance/`** — the decision log (D1–D21, O1–O5) and findings register. This is where "why is it like this?" is answered. Several open items are **open by decision, not by defect**; the register says which.

**On conflict, `CLAUDE.md` wins.** When a document and the code disagree, the code wins — and it is worth telling Alex, because the docs are otherwise well maintained.

---

## 6. What is deliberately not in this folder

`_NOT_FOR_HANDOVER/` holds everything that is not the product: strategy decks and management presentations, internal audit reports, competitor research, design mockups, local simulation outputs, credential helpers, and superseded documentation. It is git-ignored, excluded from deploys, and `scripts/package_handover.sh` fails the build if it ever ends up in a package. `_NOT_FOR_HANDOVER/MANIFEST.md` records what was moved and from where, in case something turns out to be needed.

Three things are handed over separately, not in this folder: the database (`pg_dump`), rotated credentials, and access to the hosting, auth and database accounts.

---

## 7. Two known items worth pricing in

Both are documented, neither is a surprise:

- **The persisted run lags the engine.** The database currently holds a pre-2.10.0 run, so the dashboard renders the older non-regional numbers and honestly labels them as such. The first `run_50k_prod.py` execution after deployment fixes it — and the numbers will move, by design.
- **Two legacy database migrations are pending** against production (`scripts/migrate_drop_delphi.py`, `scripts/migrate_drop_legacy.py`). Both are archive-first, idempotent, and already run against the local database. Both refuse a Postgres target without an explicit `--postgres` flag.

Questions that look like bugs are usually decisions. Check `CLAUDE.md` §1 and `docs/governance/` first, then ask Alex.
