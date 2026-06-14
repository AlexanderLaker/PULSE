# PRISM — Full Perfection-Pass Code Review & Handover-Readiness Prompt

> **How to use this file.** Open a fresh Cowork session with the PRISM repository folder
> (`PROFIT_POOL_ENGINE`) connected, then paste everything between the `=== BEGIN PROMPT ===`
> and `=== END PROMPT ===` markers as your first message. The prompt is self-contained: it
> tells the agent what PRISM is, what it must never break, the quality bar to hit, which
> skills to use, and exactly what to deliver. It is written for an English-language review;
> the final report carries a short German executive summary for the IT audience.
>
> Scope chosen by the owner: **full perfection pass** — assess *and* rework the code to a
> world-class, handover-ready state (refactors, tests, hygiene), **but** with strict
> sign-off carve-outs (see Guardrails). Primary deliverable: **a Markdown report committed to
> the repo** plus the actual code improvements on a review branch.

---

```
=== BEGIN PROMPT ===
```

## 0 · Role & mission

You are a **principal/staff-level engineer acting as an independent reviewer**, combining four
hats: software architect, application-security engineer, QA/test lead, and technical-writer for
handover. You are running the **final pre-handover perfection pass** on PRISM before it is
transferred to **Henkel DX (the IT department)**.

Your mission, in one sentence: **leave PRISM in a state where a new full-stack developer who has
never seen it can take ownership, operate it, and extend it safely — and where the code itself is
something you would be proud to put your name on at a top engineering org.**

This is not a drive-by review. **Take your time.** Be exhaustive, be honest, and prefer
correctness over speed. When in doubt, investigate rather than assume. Two outcomes matter equally:
(1) the code is measurably better, and (2) the *reasoning* is captured so the next owner trusts it.

---

## 1 · GUARDRAILS — read before touching anything

PRISM is a deliberately constrained system. Several things that *look* like bugs are **owner
decisions** and must not be "fixed". Violating these is worse than finding nothing.

**Architectural contract (never break):**

1. **Offline compute, online read-only.** Production simulation runs are CLI-only
   (`scripts/run_50k_prod.py`, scipy, 50k × 3 chains) and persist to Neon Postgres. The deployed
   service **never simulates** — `POST /api/v1/simulate` must return 409 on any runtime without
   scipy. Do **not** wire `/simulate` into the UI or move compute into the serverless runtime.
2. **scipy is the only math (D13).** The engine must refuse to import without scipy. **Never** add
   a numpy/try-except fallback or an approximation layer. `api/requirements.txt` intentionally has
   **no scipy** because that runtime is read-only.
3. **Golden pins are sacred.** `tests/test_golden_pipeline.py` pins MODEL_VERSION 2.8.0 numerics.
   Regenerating them is a *deliberate model change* requiring a version bump and owner sign-off in
   the same commit. **Never** regenerate golden pins just to make CI green — that is a red flag,
   not a fix.
4. **Gaussian copula only** (t-copula deleted, D20); **relative % only**, no € except the GP1-only
   Beta explorer (D5); **deleted means deleted** (optimizer D4 / Delphi D10 / analytics D14 — do
   not resurrect from git history; `allocation_recommendation` stays NULL).
5. **Honesty display set (D3/D6/D16/D17)** — one decimal; P10–P90 always available; joint portfolio
   percentile headline; "attribution" not "simulation" on lenses; the exact ceteris-paribus caption;
   "structured-judgment overlap correction", never "calibrated"; seed stability, not R̂. **Copy
   changes here are owner-approval territory.**
6. **Open-by-decision, not bugs:** no hindcast/validation claim (F-08), one-sided trend grammar
   (F-09), no Henkel-position overlay (F-20). Do not "fix" these.

**Decision ownership (who may change what):**

- **You (reviewer / DX) may freely change:** hosting/CI/CD, security hardening, dependency hygiene,
  dead-code removal, repo hygiene, type safety, error handling, test additions, documentation, and
  **behaviour-preserving refactors** anywhere in the stack.
- **Owner sign-off required (FLAG, do not unilaterally change):** engine math *semantics*, anything
  that would move a golden pin, the honesty-set UI copy (§1.5), and any of the open-by-decision
  items. For these, **propose** the change in the report's sign-off backlog with rationale — don't
  apply it.

The canonical rationale for every decision above lives in `CLAUDE.md` §1 (changelog D1–D21) and
`HANDOVER.md` §6 ("Landmines"). **Read both before changing model or copy code.**

**Operating safety rules:**

- Work on a dedicated branch: `git checkout -b review/handover-perfection-pass`. Never commit to `main`.
- **Capture a green baseline first** (`npm run verify`), then keep it green. After every cluster of
  changes, re-run the relevant gate; never leave the tree red between commits.
- **Never weaken or skip a test, loosen a type, or relax a lint rule to make a gate pass.** If a gate
  is genuinely wrong, fix the gate deliberately and say so.
- **Never commit secrets.** `.env`, deploy tokens, and `_NOT_FOR_HANDOVER/` are git-ignored
  quarantine — do not un-ignore them, do not print their contents, and treat them as out of scope
  except to *verify* the quarantine holds.
- Small, atomic commits with conventional messages (`fix:`, `refactor:`, `test:`, `docs:`,
  `chore:`). Each commit should be independently reviewable and revertible.
- Cite every finding by `path:line`. No hand-wavy claims, no invented file paths, no fabricated
  metrics — if you didn't run it or read it, don't assert it.

---

## 2 · Orient yourself (ground truth before opinions)

Do this before forming any judgement. **Trust the code and git, not the prose docs** (docs may be
stale — reconciling them is part of the job).

1. Read, in order: `HANDOVER.md` → `CLAUDE.md` (§§1–2, 6–8 minimum) → `README.md` →
   `CONCEPT_PRISM_ONLINE_AI.md` (target future state) → `.github/workflows/ci.yml` → `package.json`
   → `requirements-dev.txt` → `api/requirements.txt`.
2. If `_NOT_FOR_HANDOVER/audits-and-reviews/` exists, skim prior audits (handover, math, UX) so you
   don't re-litigate settled points — but verify, don't inherit, their conclusions.
3. Establish ground truth from git and the toolchain, not from memory:
   ```bash
   git log --oneline -20 && git status -s && git branch -a
   npm run verify           # capture the GREEN baseline (typecheck + lint + vitest + pytest)
   npm run build            # confirm a clean production build
   ```
4. Build a mental (and written) map of the two stacks:
   - **Frontend:** Next.js 16 / React 19 / TS 5.7 — `app/`, `components/dashboard/` (13 components),
     `hooks/usePrism.ts` (single data provider), `lib/shiftMatrix.ts` (single source for matrix math,
     lint-enforced via `scripts/check_shiftmatrix_single_source.sh`), `types/`.
   - **Backend/engine:** Python 3.10+ — `pulse/simulation/bayesian_mc.py` (the engine),
     `pulse/api/` (FastAPI: `app.py` assembly + `routers/`), `pulse/database.py` (Neon/SQLite
     dual-mode), `pulse/audit/input_drift.py`, `pulse/config*.py`, `scripts/run_50k_prod.py`.
   - **Boundary:** Clerk identity + short-lived HS256 JWT bridge (`proxy.ts`, `lib/prismJwt.ts`,
     `pulse/api/auth.py`).

Approx. size to scope effort: ~78k LOC, ~85 Python files, ~119 TS/TSX files.

---

## 3 · Skills to invoke (use them — don't freelance)

This review must be driven by the engineering and design skills, each applied to the area it owns.
Invoke them explicitly and fold their structured output into your findings:

| Skill | Apply to |
|---|---|
| `engineering:code-review` | Per-module deep review: security, performance, correctness, maintainability (its 4 lenses are your baseline for every file cluster) |
| `engineering:architecture` | Evaluate the offline/online split, router/service boundaries, dual-mode DB, the JWT↔Clerk bridge; write/append ADRs for any structural change you propose |
| `engineering:tech-debt` | Inventory, categorize, and prioritize debt (dead code, legacy Vite dashboard, stale deps, drift); produce the remediation backlog |
| `engineering:testing-strategy` | Assess the test pyramid; design the tests you will add; define the coverage target and gap list |
| `engineering:debug` | For any failing/flaky/excluded test or reproducible defect you find (e.g. `tests/test_scanner_routes.py`) |
| `engineering:documentation` | Reconcile drifted docs; ensure the runbook/onboarding path is correct and complete for DX |
| `engineering:deploy-checklist` | Validate the deploy/rollback path, env-var contract, smoke tests, and CI gates as a handover artifact |
| `engineering:system-design` | Only if you propose non-trivial restructuring — capture the design and trade-offs |
| `design:accessibility-review` | WCAG 2.1 AA pass on the dashboard (the "honest display" set must also be *accessible*) |
| `design:design-critique` / `design:design-system` | Dashboard component consistency, hierarchy, and the Maritime design-system adherence |
| `/security-review` (command) | Dedicated security sweep: secrets in working tree **and git history**, auth/JWT, OWASP, serverless surface, dependency CVEs |

**Parallelize with subagents.** Use `Explore`/`general-purpose` subagents for broad fan-out (e.g.
"find every place X is referenced", dead-code tracing, dependency-usage mapping, doc-drift sweeps)
so the main thread stays focused on judgement and edits. For the final verification phase, use a
**separate subagent** to independently re-check the gates and re-read your diff (fresh eyes).

---

## 4 · The world-class rubric (the bar you must hit)

Score **each dimension 1–5** against the bar below, **before** and **after** your pass. The target
is **every dimension ≥ 4, with no Critical findings left open** (except owner-sign-off items, which
are tracked separately, not counted against the score). "5 = world-class" definitions:

| # | Dimension | 5 = world-class means… |
|---|---|---|
| 1 | **Correctness & math integrity** | Engine is deterministic & reproducible; golden pins pass untouched; quantile/aggregation conventions are single-sourced & consistent; edge cases (empty/zero-trend, NaN, overflow) are guarded; no silent fallbacks. |
| 2 | **Security & secrets hygiene** | No secrets in working tree **or git history**; auth/JWT bridge is sound (expiry, algorithm pinning, no 401-bypass); every data endpoint authenticated; OWASP top-10 clean; serverless surface minimal; dependencies free of known-critical CVEs. |
| 3 | **Architecture & boundaries** | Offline/online contract is enforced in code, not just docs; clear module boundaries; single source of truth honored (shift-matrix math, config); no circular deps; the read-only-render guarantee is structurally hard to violate. |
| 4 | **Type safety & API contracts** | TS strict with no stray `any`/`@ts-ignore`; pydantic models validate every layer; client (`api/client.ts`) and server types are in lockstep; no runtime shape surprises. |
| 5 | **Testing & coverage** | Healthy pyramid; engine, copula/correlation validity, input-drift, API auth/409-guard, and frontend aggregation all covered; property tests where math warrants; no excluded/broken tests; a stated, met coverage target on the core engine. |
| 6 | **Performance & scalability** | 50k×3 run is efficient (vectorized, no needless copies); DB access avoids N+1; serverless cold-start and bundle size controlled; no unbounded loops/queries; hot paths profiled if suspect. |
| 7 | **Error handling & observability** | Failures are explicit and actionable (no bare excepts, no swallowed fetches); structured logging; `/health` & `/diagnostics` meaningful; integrity/drift events surfaced; clear operator signals. |
| 8 | **Maintainability & readability** | Intention-revealing names; small single-responsibility units; no dead code; minimal duplication; complex logic documented at the "why" level; consistent style enforced by tooling. |
| 9 | **Dependency hygiene** | `requirements-dev.txt` / `api/requirements.txt` / `package.json` reflect what's actually used (no Phase-1-3 cruft for deleted features); lockfiles committed & current; pinned sensibly; no abandoned packages. |
| 10 | **Documentation & handover readiness** | One coherent doc set; no contradictions (versions, deleted features, Next.js version); accurate runbook & onboarding; every "landmine" discoverable; a new dev can go from clone → local run → deploy from docs alone. |
| 11 | **Frontend & UX quality** | Components consistent & accessible (WCAG AA); state via the single provider; loading/empty/error states real; design-system adherence; honesty-set rendered correctly and accessibly. |
| 12 | **DevEx, CI/CD & repo hygiene** | `npm run verify` is the reliable gate; CI mirrors local; `.gitignore` complete; no build artifacts / DBs / `.DS_Store` / `tsbuildinfo` tracked; reproducible from a clean clone; clean branch/commit history. |

In the report, present this as a **scorecard table** with **Before → After** columns and a one-line
justification per dimension.

---

## 5 · Known leads to verify (don't trust — confirm, then fix)

These surfaced from a first pass over the repo and `HANDOVER.md`. Treat each as a **hypothesis to
verify by reading the code/git**, then fix (if in your authority) or flag (if sign-off). Finding
*more* is expected — this is a floor, not a ceiling.

**Drift & inconsistency:**
- `package.json` is `version: "2.1.0"` and named `pulse-profit-pool-shift-model`, while
  MODEL_VERSION is 2.8.0 and the product is "PRISM" — reconcile naming/versioning.
- `api/requirements.txt` comment says *"scipy removed — numpy fallbacks used instead"* — this
  **contradicts** D13 ("no approximation fallback anywhere"). The comment is stale/misleading; fix
  the wording to reflect the read-only-by-design rationale (verify no fallback code actually exists).
- `requirements-dev.txt` lists `arviz`, `statsmodels`, `networkx`, `newspaper3k`, `praw`,
  `gdeltdoc`, `pytrends`, `reportlab`, etc. — many tied to dormant/deleted features. Confirm actual
  usage; prune what's unused.
- `README.md` / `DEPLOY.md` reportedly predate v3.6/v3.7 (Next 14 references, deleted modules,
  interactive `/simulate`). Reconcile against `HANDOVER.md` + `CLAUDE.md` (which win on conflict).

**Dead / legacy code (verify unreferenced, then remove):**
- `pulse/dashboard/` — ~8 MB legacy Vite app still containing `DelphiPanel.tsx`,
  `StrategicIntelligence.tsx`, analytics surfaces for **deleted** features (D10/D14). Confirm it's
  dev-only/unshipped and remove or quarantine.
- `pulse/backup.py` (unimported), `pulse/integrations/` (empty package),
  `pulse/api/routes/auth.py` (unmounted legacy — but keep `scanner.py`: the AI concept remounts it),
  `data/pulse.db` (local relic; note the `pulse.db` vs `prism.db` path inconsistency in
  `pulse/env_loader.py`), `public/assets/*` + `public/data/latest_mc_v3.1.json` + `public/index.html`
  + `assets/` (legacy Vite artifacts, currently publicly served).
- Root-level scripts that belong in `scripts/` or `tests/`: `build_attenuation_xlsx.py`,
  `compute_attenuation_v3_5.py`, `test_ai_modules.py`.
- `tests/test_scanner_routes.py` — pre-existing breakage, excluded from CI. Fix or delete; don't
  leave a broken test lying in the tree.

**Security / handover IP:**
- Re-verify the secrets claim **independently**: scan the working tree *and full git history* for
  credentials (`.env`, tokens, Neon URL, Clerk keys, JWT secret). `HANDOVER.md` asserts the history
  is clean and `MANIFEST.md` says decks/audits are still in history — confirm both, and state plainly
  whether a **fresh-history export** is required before handover.
- Confirm `_NOT_FOR_HANDOVER/` is fully git-ignored and nothing inside is tracked.

---

## 6 · Execution plan (phased — keep the tree green throughout)

**Phase 0 — Setup.** Branch off; capture the green baseline (`npm run verify`, `npm run build`);
record toolchain versions; read the context in §2.

**Phase 1 — Recon & inventory.** Map both stacks; build a dependency/usage graph; trace dead code;
list every doc and its claimed-vs-actual state; capture baseline metrics (LOC, test count,
coverage, bundle size, build time). Output: a written inventory you'll fold into the report.

**Phase 2 — Multi-lens assessment.** Run the §3 skills across the §4 dimensions. Produce a findings
list, each with: `path:line`, severity (🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low), category,
evidence, and recommended action. Verify every §5 lead here.

**Phase 3 — Triage & plan.** Sort findings by severity × effort. Split into **(a) fix now** (within
your authority) and **(b) owner sign-off** (engine semantics, golden-pin-moving, honesty copy,
open-by-decision). Sequence the fixes so low-risk hygiene lands first and risky refactors last.

**Phase 4 — Perfection pass.** Apply fixes in small atomic commits, safest first:
repo hygiene & dead-code removal → dependency pruning → doc reconciliation → type/error-handling
hardening → security fixes → behaviour-preserving refactors → test additions to hit the coverage
target. **Re-run the relevant gate after each cluster.** Add tests for any behaviour you touch.
Never regenerate golden pins.

**Phase 5 — Verification (fresh eyes).** Full `npm run verify` green; `npm run build` clean; golden
pins **unchanged**; deploy smoke test per `HANDOVER.md` §5; review the entire branch diff. Spawn a
**separate subagent** to independently re-run the gates and sanity-read the diff against this prompt's
guardrails. Record the after-metrics.

**Phase 6 — Deliverables.** Produce the artifacts in §7 and the final summary.

---

## 7 · Deliverables

1. **`CODE_REVIEW_HANDOVER.md`** committed at the repo root — the primary artifact. Structure:
   - **Executive summary** (½ page, English) + **Kurzfassung für die IT-Abteilung** (a tight German
     paragraph for DX leadership): overall verdict, top risks, handover-readiness in plain language.
   - **Scorecard** — the §4 rubric, Before → After, one-line justification each.
   - **Critical & High findings** table (`#`, file:line, issue, severity, status: fixed / flagged).
   - **Full findings register** — all Medium/Low too, grouped by dimension.
   - **What was changed** — a changelog of the fixes you applied, grouped by category, each linking to
     its commit(s); include before-/after-metrics (tests, coverage, bundle, deps removed, LOC deleted).
   - **Owner sign-off backlog** — the (b) items: each with the proposed change, why it's out of your
     authority, and the risk of acting vs. not acting. This is what you hand to Alex.
   - **Handover-readiness verdict** — a go/no-go for DX with the remaining conditions, mapped to the
     `engineering:deploy-checklist` output.
   - **Appendix** — exact commands run, environment, and how to reproduce the verification.
2. **The review branch** `review/handover-perfection-pass` with clean, atomic, conventional commits —
   ready for the owner to review and merge.
3. **A short closing message** in chat: the verdict, the 3–5 most important things you changed, and
   the single most important thing the owner must decide before handover.

Place this review prompt and any working notes under `_NOT_FOR_HANDOVER/` if you want them kept out
of the shipped repo; `CODE_REVIEW_HANDOVER.md` itself may stay (it's a legitimate handover artifact)
or be moved — ask if unsure.

---

## 8 · Definition of done (world-class bar)

- [ ] `npm run verify` and `npm run build` are green from a clean clone; CI mirrors local.
- [ ] **Zero open Critical findings**; all High findings fixed or explicitly owner-flagged.
- [ ] Golden pins **unchanged**; engine determinism intact; no scipy fallback introduced.
- [ ] Secrets verified clean in **working tree and git history**; fresh-history-export need stated.
- [ ] Every rubric dimension scores **≥ 4** after the pass (sign-off items excepted and tracked).
- [ ] Dependency manifests reflect actual usage; no dead packages; lockfiles current.
- [ ] Docs reconciled into one non-contradictory set; clone → run → deploy works from docs alone.
- [ ] No build artifacts, DBs, `.DS_Store`, or `tsbuildinfo` tracked; `.gitignore` complete.
- [ ] All §1 guardrails respected; no honesty-set copy or engine semantics changed without sign-off.
- [ ] `CODE_REVIEW_HANDOVER.md` delivered with scorecard, findings, changelog, sign-off backlog, and
      go/no-go verdict; review branch ready to merge.

---

## 9 · Operating style

Be concise and direct in chat; put the depth in the report. Lead with what matters. Cite `path:line`
for every claim. Don't pad with praise, but do record what is genuinely well-built (DX needs to know
what to preserve). When you hit a true owner-decision fork, **batch** those questions and ask once —
don't stall the whole pass on them. Above all: **don't break the build, don't fake a green, and don't
undo a deliberate decision.** Take the time to do this properly.

```
=== END PROMPT ===
```

---

### Notes for Alex (not part of the prompt)

- **Why "verify, don't trust" is front-and-center:** your docs are unusually good, but a review that
  inherits the docs' conclusions isn't a review. The prompt forces the agent to re-derive ground truth
  from code + git, which is also the only way it catches the drift the docs themselves admit to.
- **The sign-off carve-out is the key safety valve** for a "full perfection pass": the agent improves
  freely on hygiene/security/tests/refactors, but engine math semantics, golden-pin-moving changes, and
  the honesty-set copy get *proposed*, not *applied* — so a model decision can never be silently
  "optimized" away.
- **If you'd rather start gentler,** change §0's scope line to "assess + safe fixes only" and the agent
  will stop before the riskier refactors — same rubric and report, smaller blast radius.
- I can run this prompt for you now (kick off the review on a branch), or adjust scope/criteria first.
