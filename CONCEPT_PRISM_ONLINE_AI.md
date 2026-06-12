# PRISM Online — Operating Concept for the Henkel-Hosted, AI-Enabled Platform

**Version:** 1.0 · 2026-06-11 · Author: Alex (Operational Excellence & Category Strategy, HCB)
**Audience:** Henkel DX (architecture + the developer taking over), HCB sponsors
**Companions:** `HANDOVER.md` (takeover guide) · `CLAUDE.md` (system spec, v3.7)

---

## 0. Executive summary

PRISM today is production-grade but **operator-bound**: simulations run as a CLI job on the owner's machine, AI capabilities exist in the codebase but are dormant, and hosting (Vercel/Neon/Clerk/GitHub) sits in personal accounts. The proposal: **lift the platform into Henkel Azure unchanged, turn the offline CLI run into a containerized Azure job, and activate the existing AI layer** (trend scanner, score calibrator, run narrator) behind the platform's established human-in-the-loop governance.

Three design commitments make this safe: (1) **numeric quality is preserved exactly** — the same scipy engine, version-pinned in a container, gated by the existing golden-pin test suite; the web plane still never computes; (2) **AI suggests, humans decide** — nothing AI-generated reaches the model without review, extending the provenance-chip governance already in production; (3) **provider-agnostic LLM access** — Claude via Microsoft Foundry as primary, Azure OpenAI as fallback, Gemini optional — no architectural lock-in.

Four phases, roughly 8–13 dev-weeks to the full living loop.

---

## 1. Starting point

What exists and works (detail: `CLAUDE.md` §§1–2):

- **Engine:** Bayesian MC, Gaussian copula, scipy-exact (D13), deterministic (seed 42), 50k × 3 chains, golden-pin regression suite, integrity events incl. input-drift telemetry (D19).
- **Operating split (F2):** offline CLI computes and persists to Postgres; the deployed app is a read-only renderer. `POST /simulate` deliberately refuses (409) on the web runtime.
- **Governance:** AI-suggestion provenance chips (D7), admin-only audited config writes with spectral validation, RACI for trend scoring, honest-display rules (D3/D6/D16).
- **Dormant AI layer (`pulse/ai/`)** — built, tested ad-hoc, unmounted:
  - `provider.py` — LLM provider abstraction (Claude / Azure OpenAI / Ollama) with an **audit logger and a financial-data firewall** (`SecurityConfig`: blocks GP1/EBIT/revenue-type fields from ever entering prompts, masks numerics, logs every call).
  - `scanner.py` — RSS/news ingestion + LLM classification into `TrendSuggestion` (force, direction, impact, confidence, source URL, evidence text).
  - `calibrator.py` — compares existing trend scores against fresh external signals → `CalibrationSuggestion` (field, current vs suggested value, reasoning).
  - `narrator.py` — executive narratives over run results, relative-% only by construction.
  - `ai_suggestions` table + `ai_suggested`/`user_override` flags already in the schema and UI.

What is missing for "dynamic online": Henkel hosting, compute-as-a-service, scheduling/triggering, a suggestion-review inbox, a Gemini provider class, current model strings (the dormant config still pins `claude-opus-4-0-20250514` / `gpt-4-turbo` / API version `2024-02-15-preview` — all stale), and SSO.

## 2. Target operating model — the living loop

```
        ┌──────────────── SCAN (weekly, automated) ─────────────────┐
        │ curated sources (trade press, regulatory feeds, GDELT,    │
        │ RSS) → scanner job → LLM classify + draft scoring         │
        │ → ai_suggestions (with evidence URL, confidence)          │
        └──────────────────────────┬────────────────────────────────┘
                                   ▼
        ┌──────────────── REVIEW (human, on demand) ────────────────┐
        │ Suggestion inbox in Trends2: accept / edit / reject       │
        │ Category Leads (R), Strategy VP (A) — unchanged RACI      │
        │ accepted → trend with ai_suggested chip until reviewed    │
        │ quarterly: calibrator suggestions on the existing 99      │
        └──────────────────────────┬────────────────────────────────┘
                                   ▼
        ┌─────────────── RECALCULATE (job, minutes) ────────────────┐
        │ admin "Run simulation" or auto-trigger on accepted batch  │
        │ → queue → container job (scipy, pinned, golden-checked)   │
        │ → input-drift event ("N scores changed…") → persisted run │
        └──────────────────────────┬────────────────────────────────┘
                                   ▼
        ┌──────────────── READ (continuous) ────────────────────────┐
        │ dashboard renders latest run; integrity chip shows drift; │
        │ narrator writes "what changed vs last run" (labeled AI);  │
        │ adjustments (config/scores) via existing admin UI → loop  │
        └────────────────────────────────────────────────────────────┘
```

The loop preserves every invariant the platform's credibility rests on: AI never writes to the model directly, every input change is fingerprinted and surfaced, every run carries seed/versions/backend, ceteris-paribus framing stays, and the web plane still never computes — the **job** computes.

"Do adjustments" needs no new machinery: trend scoring and config editing (with spectral PSD gates) are already online admin capabilities. What's new is that a recalculation is available minutes after an adjustment instead of waiting for the operator's laptop.

## 3. Target architecture on Azure

```
                    Entra ID (SSO, group→role mapping)
                                   │
Internet ── Front Door/WAF ── App Service (container): Next.js 16 UI + BFF
                                   │ /api/v1/* (JWT bridge unchanged)
                              App Service / Container Apps (container):
                              FastAPI data plane — READ-ONLY (F2 kept)
                                   │
            Azure Database for PostgreSQL (Flexible Server)
              trends · simulation_runs · config_snapshots ·
              journey_content · ai_suggestions · audit_log
                                   ▲
     Service Bus / Storage Queue ──┤ (run requests)
                                   │
        Azure Container Apps JOBS (event + schedule triggered):
        ① simulation worker — same repo, same engine, scipy pinned
        ② scanner worker   — weekly news scan → ai_suggestions
        ③ calibrator worker — quarterly score-review suggestions
                                   │
        Microsoft Foundry (LLM): Claude (primary) / Azure OpenAI
        (fallback)  ·  [optional: Gemini via Google Vertex AI]
                                   │
        Key Vault (secrets, managed identities) · ACR (images) ·
        App Insights + Log Analytics (alerts: job failures,
        integrity events) · GitHub Actions or Azure DevOps (CI/CD)
```

Component decisions and why (trade-offs explicit):

| Decision | Recommendation | Trade-off considered |
|---|---|---|
| Web hosting | **App Service for Containers** (one for Next.js, one for FastAPI) | Static Web Apps is cheaper but awkward for Next 16 SSR + Python sidecar; AKS is overkill for one app |
| Compute for simulations | **Container Apps Jobs** (manual + event + cron triggers) | Azure Functions hit memory/duration ceilings and cold-start scipy imports; AKS CronJobs add cluster ops. A 50k×3 run is 2–6 min on one beefy container — a job, not a service |
| Queue | Storage Queue (simple) or Service Bus (if DX standard) | Either works; volume is tiny (runs/week, not msgs/sec) |
| Database | **Azure Database for PostgreSQL Flexible Server**, restore from `pg_dump` | Schema is plain Postgres — engine side (psycopg2) ports unchanged. The Next.js side currently uses the Neon serverless driver (`@neondatabase/serverless`), which only speaks to Neon's proxy → swap to `pg`/node-postgres (small, contained change in `lib/`) |
| Auth | **Entra ID SSO** replacing Clerk; keep the internal Clerk→engine JWT bridge mechanism (`PRISM_JWT_SECRET`) so `pulse/api/auth.py` is untouched | Keeping Clerk short-term is possible (fastest migration) but leaves an external US SaaS user store inside a Henkel tool; signup codes become obsolete under SSO |
| Repo/CI | Henkel GitHub Enterprise or Azure DevOps; carry over `ci.yml` (frontend + scipy engine jobs) + add image build & golden-pin gate | — |

### 3.1 "Same quality as scipy" — answered precisely

The quality of PRISM's numbers is a property of **code + library versions + seed**, not of the machine they run on. The engine refuses to import without scipy (D13); there is no approximation path to accidentally fall into. Therefore:

1. The simulation worker uses the **same repository, same engine module, same entry logic** as today's `scripts/run_50k_prod.py` — wrapped as a job, not rewritten.
2. The container image **pins exact numpy/scipy versions**; every persisted run already records `numerics_backend` (exact versions) for the audit trail.
3. The **golden-pin suite** (`tests/test_golden_pipeline.py`, MODEL_VERSION 2.8.0) runs in CI on every image build — a container that would produce different numbers cannot ship. Optionally the job runs the pin check as a pre-flight before each production run.
4. Determinism: seed 42 multichain → a job-produced run is **bit-identical** to a laptop run on the same versions. Phase 2's exit criterion is exactly that comparison.
5. Seed-stability (3 independently-seeded chains) and integrity events persist with every run, unchanged.

This is strictly *better* than today's quality story: the runtime becomes reproducible infrastructure-as-code instead of "the owner's Mac".

## 4. The AI layer in production

### 4.1 Find new trends (scanner — weekly job)

Pipeline per cycle: pull curated sources (FMCG/beauty/home-care trade press, EU/regulatory feeds, GDELT/news APIs; the 19-integration catalogue in `docs/SCANNER_API.md` is the long-term roadmap — most external API keys were never wired and stay optional) → LLM pass 1: relevance + classification (force, direction, affected categories) → dedupe against the live 99 trends and prior suggestions (match against `data/trendCodeMap.ts` names + embeddings or LLM matching) → LLM pass 2: draft scoring suggestion (probability, impact magnitude, peak year, diffusion curve — **as a suggestion object, never a trend**) with mandatory source URL + evidence quote → write to `ai_suggestions`.

Review: a "Suggestion inbox" view in the existing Trends2 admin editor (accept / edit-then-accept / reject, with reason). Accepted items become trends flagged `ai_suggested` — the D7 chip stays visible until expert review marks them reviewed. The scanner can also flag **retirement candidates** (existing trend contradicted by evidence) — again, suggestion only. Every acceptance lands in `audit_log`, and the next run's input-drift event reports the score-state change by construction.

Volume control: weekly batch capped (e.g., max 10 suggestions/cycle, confidence-ranked) so review stays a 20-minute task, not a feed.

### 4.2 Re-score existing trends (calibrator — quarterly job)

For each of the 99 trends: gather fresh signals → compare against current probability/impact → emit `CalibrationSuggestion` (current vs suggested, confidence, reasoning) only where the delta is material. Reviewed in the same inbox. This gives the model a heartbeat — scores age explicitly instead of silently.

### 4.3 Narrate runs (narrator — on run completion)

After each persisted run: generate the executive readout ("portfolio band moved +0.4pp vs previous run; driver: 3 Government-force re-scorings; largest category delta: ADW") — relative % only, enforced twice (prompt firewall + the narrator's own no-absolute-values rule). Rendered in the dashboard with an explicit **"AI narrative — generated, not simulated"** label, consistent with the platform's honesty system. Optional: e-mail/Teams digest to subscribed users.

### 4.4 What deliberately stays out

No auto-applied scores or config (D7). No chat endpoint (owner-removed; stays removed). No absolute financials in any prompt (firewall) — the LLM never sees GP1/€ data, only trend text and relative shifts. Consumer-Journey tiles remain strategist-authored (separate provenance system). EU AI-Act / Henkel AI-policy classification is a DX/legal task, but the design keeps it easy: no personal data processed, no internal financials exposed, human review on every model-affecting output, full prompt/response audit log (`AuditLogger` exists).

### 4.5 LLM provider strategy (verified June 2026)

| | **Claude via Microsoft Foundry** | **Azure OpenAI (GPT-x in Foundry)** | **Gemini via Google Vertex AI** |
|---|---|---|---|
| Access path | Native in Microsoft Foundry catalogue (serverless deployment, Foundry billing/governance) | Native Azure service | Requires Google Cloud tenancy + DPA — a third cloud vendor |
| EU data residency | Inference currently Anthropic-managed even when EU regions are selected; **EU-native Azure processing publicly targeted for 2026** | Azure-native EU regions available today | EU multi-region endpoints available; newest models land in EU multi-region first, single-region (DE) lags |
| Fit for PRISM | Strongest fit for nuanced trend classification/scoring judgment; stays inside the Microsoft procurement umbrella | Zero new vendors; safest residency story today | Only worth it if Henkel already runs GCP workloads |

**Recommendation:** keep `pulse/ai/provider.py` provider-agnostic (that's its design) and configure **two** providers at launch — Claude-in-Foundry primary, Azure OpenAI fallback (automatic failover = resilience + procurement leverage). Add a `GeminiProvider` class only if a GCP relationship exists. Code changes either way: add a Foundry-endpoint variant of the Claude provider, add Gemini (optional), move model names/API versions from hardcoded defaults to environment configuration, refresh the stale model strings.

**Cost, order of magnitude** *(estimate — basis: token arithmetic at June-2026 list prices; DX to validate against Henkel EA rates)*: weekly scan ≈ 200 articles × ~2k tokens + 2 LLM passes → low single-digit € per cycle; narration per run negligible; **LLM total well under €100/month**. Infrastructure (App Service ×2, Postgres Flexible Server, Container Apps job-seconds, Front Door) ≈ €200–500/month depending on tiers. Simulation compute itself is minutes/month — irrelevant.

## 5. Governance — what transfers, what's added

Unchanged: trend scoring RACI (Category Leads R, Strategy VP A), admin-only audited config writes, provenance chips, integrity events, honest-display rules, open-by-decision register (no hindcast claims, F-08). Added: DX owns platform/SLA/security; a named **suggestion-review owner** per force or category (default: existing Category Leads); a monthly "model health" glance — drift events, suggestion acceptance rate, calibrator deltas — which the dashboard already mostly surfaces via the integrity chip.

## 6. Migration plan

| Phase | Scope | Exit criterion | Effort* |
|---|---|---|---|
| **0 — Prep** | Fresh-history repo transfer to Henkel org; secret rotation; `pg_dump` → Azure PG restore; CI green in Henkel org | CI (typecheck/lint/vitest/pytest incl. golden pins) green on Henkel infra | ~1 wk |
| **1 — Lift & host** | Containerize Next.js + FastAPI; App Service + Front Door; Key Vault + managed identities; Neon-driver → `pg` swap; Entra ID SSO replacing Clerk; App Insights | Dashboard renders the migrated run inside Henkel network; smoke tests pass; old stack frozen | 2–4 wks |
| **2 — Online compute** | Worker image (scipy pinned); Container Apps Job + queue; admin "Run simulation" → enqueue → status; monthly schedule; golden-pin pre-flight | Job-produced run **bit-identical** to a reference CLI run (same seed/versions); CLI demoted to break-glass | 2–3 wks |
| **3 — Living intelligence** | Scanner job + suggestion inbox in Trends2; calibrator quarterly job; narrator on run completion; dual-provider config + failover test; prompt/response audit surfacing | First AI-suggested trend accepted by a human reviewer, visible drift event, reflected in the next run's narrative | 4–6 wks |
| **4 — Backlog (owner-gated)** | Home-Care journey, per-year journey decomposition, PPTX export route, wider source integrations | — | as prioritized |

\* one full-stack developer + part-time DevOps; grades are estimates, not quotes.

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Claude-in-Foundry EU residency not yet Azure-native | If blocking for Henkel policy: launch with Azure OpenAI primary, flip to Claude when EU-native lands (abstraction makes this a config change) |
| LLM hallucination / junk suggestions | Mandatory source URL + evidence quote per suggestion; confidence ranking; weekly cap; human accept-gate; provenance chips; audit log |
| Scanner noise drowns reviewers | Curated source list + dedupe + cap; tune after first month against acceptance rate |
| Numeric drift across environments | Pinned image + golden-pin CI gate + pre-flight + `numerics_backend` per run + bit-identity test in Phase 2 |
| Clerk→Entra migration friction | Small user base; run both for one sprint behind a feature flag; JWT bridge to the engine unchanged |
| Stale model strings / API churn | Provider config from environment, not code; failover provider configured |
| Cost creep | Budget alerts on the resource group; LLM spend is metered and logged per call (`AuditLogger`) |
| Golden pins regenerated to "fix" CI | Same discipline as today, now enforced organizationally: pin regeneration requires owner sign-off (HANDOVER §6.5) |

## 8. Decisions requested from DX

1. Confirm Azure landing zone + Container Apps availability (else: AKS variant of the same design).
2. Entra ID at Phase 1 vs. keeping Clerk one more quarter.
3. GitHub Enterprise vs Azure DevOps for repo/CI.
4. Primary LLM provider per Henkel AI policy (recommendation: Claude-in-Foundry primary / Azure OpenAI fallback) and AI-policy/legal classification of the scanner use case.
5. Scan cadence + suggestion-review owner sign-off (proposal: weekly, capped at 10, Category Leads review).

---

### Sources (provider facts, verified 2026-06-11)

- [Deploy and use Claude models in Microsoft Foundry — Microsoft Learn](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/how-to/use-foundry-models-claude)
- [Claude in Microsoft Foundry — Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/claude-in-microsoft-foundry)
- [Introducing Anthropic's Claude models in Microsoft Foundry — Microsoft Azure Blog](https://azure.microsoft.com/en-us/blog/introducing-anthropics-claude-models-in-microsoft-foundry-bringing-frontier-intelligence-to-azure/)
- [Timeline for Claude in Microsoft Foundry on Azure EU infrastructure — Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/5867930/timeline-for-claude-in-microsoft-foundry-to-run-on)
- [Claude now available in Microsoft Foundry — Anthropic](https://www.anthropic.com/news/claude-in-microsoft-foundry)
- [Gemini/Vertex AI data residency — Google Cloud Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/data-residency)
- [Gemini Enterprise data residency locations — Google Cloud Documentation](https://docs.cloud.google.com/gemini/enterprise/docs/locations)

*Internal references: `CLAUDE.md` (v3.7 spec), `HANDOVER.md`, `pulse/ai/` source, `docs/SCANNER_API.md`, `AI_QUICKSTART.md`.*
