# PRISM — Profit Pool Risk & Intelligence Simulation Model

## Project Specification & Architecture — v3.0

---

## 1. EXECUTIVE SUMMARY

### What This Is
PRISM is an **AI-augmented profit pool simulation engine** that transforms a static Excel-based strategic force assessment into a living, probabilistic, AI-enhanced strategic decision platform. It is deployed as a **Vercel-hosted Next.js web application** backed by a **Python FastAPI simulation engine**, with dual-mode data persistence (PostgreSQL in production, SQLite locally).

### The Core Innovation
PRISM operates on a **probabilistic profit pool shifting architecture**: the simulation, AI, and optimization layer works with directional scores, percentage shifts, copula-modeled dependencies, and market intelligence to produce a **Shift Matrix** — a table of percentage impacts by category × force × time path (2026–2030). Users apply these shifts to their financial models in Excel or consume them through Power BI integration.

### What Changed in v3.0 (vs. v2.3.1)
This specification was rewritten from the ground up to reflect the **actual production codebase** as of April 2026:

1. **Next.js 14 production frontend** — The War Room dashboard is now a full Next.js 14 app with TypeScript, deployed on Vercel, replacing the original Vite-only design
2. **Dual-mode database** — PostgreSQL (Neon serverless) in production + SQLite for local development, replacing the SQLite-only spec
3. **Authentication system** — JWT-based auth with user management, admin roles, bcrypt password hashing
4. **Advanced analytics suite** — CVaR (Conditional Value-at-Risk), Sobol global sensitivity indices, reverse stress testing, and tipping point detection — all fully implemented
5. **61 seeded trends** — 55 global + 6 regional trends with full metadata, category/VC/regional exposures, and diffusion curves
6. **5 MECE diffusion curve types** — s_curve, linear, front_loaded, back_loaded, step_function (replacing the simplistic force-based materialization overrides)
7. **Professional export center** — PowerPoint (6-slide deck), Excel (Shift Matrix + allocation), Power BI (flat JSON/CSV), all with Henkel branding
8. **Vercel serverless deployment** — Cold-start retry logic, graceful degradation, serverless-optimized dependency set
9. **Real data only** — Dashboard wired directly to API; shows proper empty/error states instead of fake data
10. **File structure cleanup** — All documentation (55 files) moved to `DOCUMENTATION/`, root contains only active code

### What Remains from v2.3.1
All previous improvements carry forward:
- **Trend Database at 61 trends** (55 global + 6 regional) with Source Credibility Tier System (S through E)
- **Economic Anchoring via `gp1_pct_affected`** — each trend's maximum economic scope is capped
- **Two-dimensional scoring** — `probability` (1-5) × `gp1_pct_affected` (0.0-1.0), no redundant impact variable
- **Admin-configurable model parameters** — attenuation, force weights, copula parameters, iterations

### Implementation Status (April 2026)

| Module | Status | Notes |
|--------|--------|-------|
| Bayesian Monte Carlo with copulas | **Production** | Gaussian copula + t-copula tails, Beta priors |
| Continuous path modeling | **Production** | 5 diffusion curve types, velocity/acceleration tracking |
| CVaR / Sobol / Reverse stress / Tipping points | **Production** | Full advanced analytics suite |
| Resource allocation optimizer | **Production** | Mean-variance optimization with efficient frontier |
| Delphi expert elicitation | **Production** | Multi-round with DB persistence |
| AI layer (scanner, narrator, calibrator, chat) | **Production** | Provider-agnostic (Claude / Azure OpenAI / Ollama) |
| Excel / PowerPoint / Power BI export | **Production** | Professional Henkel-branded outputs |
| War Room dashboard (Next.js) | **Production** | 29+ components, auth, dark mode |
| REST API (FastAPI) | **Production** | 20+ endpoints with auth/admin controls |
| Sensitivity analysis (tornado, breakeven) | **Stub** | Methods defined but raise NotImplementedError |
| Causal DAG module | **Not implemented** | Designed in v2.0 spec, never built; DB tables removed |
| Game theory / competitive response | **Not implemented** | Designed in v2.0 spec, never built; DB tables removed |
| Backtesting engine | **Not implemented** | Designed in v2.0 spec, never built; DB tables removed |

### Design Philosophy
1. **Vercel-deployed, enterprise-ready** — Production on Vercel with Neon PostgreSQL; local development with SQLite
2. **AI augments human judgment, never replaces it** — every AI suggestion requires human review
3. **Bayesian > point estimates** — Beta-distributed priors with copula dependencies, not assumed distributions
4. **Incrementally valuable** — each module delivers standalone value; unimplemented modules degrade gracefully
5. **Analysis → Decision** — every output answers "so what should we do?" via allocation recommendations
6. **LLM-provider agnostic** — provider.py abstracts Claude, Azure OpenAI, and Ollama behind a single ABC interface
7. **Power BI as financial lens** — PRISM outputs relative shifts only. Power BI applies them to €M financials. One-directional flow. PRISM never sees absolute figures.
8. **Honest data only** — Dashboard displays only real simulation results from the API; no mock/fake data fallback. Clear empty states when backend is unavailable or no simulation has been run.
9. **Two-audience model** — React War Room (strategy team, relative %, interactive) + Power BI (ExCo/Finance, €M, governance)

---

## 2. SYSTEM ARCHITECTURE

### 2.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         VERCEL (Production)                          │
│                                                                      │
│  ┌──────────────────────────────┐  ┌─────────────────────────────┐  │
│  │   NEXT.JS 14 FRONTEND        │  │  PYTHON SERVERLESS ADAPTER  │  │
│  │                               │  │  api/index.py               │  │
│  │  app/          → Pages        │  │                             │  │
│  │  components/   → War Room UI  │  │  Cold-start retry logic     │  │
│  │  hooks/        → State mgmt   │  │  Graceful degradation       │  │
│  │  lib/          → Auth, DB     │  │  ↓                          │  │
│  │  types/        → TypeScript   │  │  pulse/api/app.py (FastAPI) │  │
│  │  data/mockData → Fallback     │  │                             │  │
│  └──────────────────────────────┘  └──────────┬──────────────────┘  │
│                                                │                     │
│                                    ┌───────────▼──────────────────┐  │
│                                    │   NEON POSTGRESQL             │  │
│                                    │   (Serverless, auto-scaling)  │  │
│                                    └──────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                      LOCAL DEVELOPMENT                                │
│                                                                      │
│  python -m pulse --serve                                             │
│  ├── FastAPI at http://localhost:8000                                 │
│  ├── React dashboard (Vite) at http://localhost:5173                 │
│  └── SQLite at data/prism.db                                         │
│                                                                      │
│  npm run dev                                                          │
│  └── Next.js at http://localhost:3000 (connects to FastAPI backend)  │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 The Shift Matrix Interface

PRISM's primary output — the **Shift Matrix** — is a JSON/CSV table with continuous path data:

```json
{
  "generated": "2026-04-14T14:30:00",
  "scenario": "Base Case",
  "confidence": "80% CI",
  "model_version": "bayesian_copula_v2.4",
  "shifts": {
    "Hair: Color": {
      "path": {
        "2026": { "median": -0.003, "p10": -0.001, "p25": -0.002, "p75": -0.005, "p90": -0.008 },
        "2027": { "median": -0.008, "p10": -0.003, "p25": -0.005, "p75": -0.013, "p90": -0.019 },
        "2028": { "median": -0.014, "p10": -0.006, "p25": -0.009, "p75": -0.022, "p90": -0.031 },
        "2029": { "median": -0.023, "p10": -0.010, "p25": -0.015, "p75": -0.035, "p90": -0.048 },
        "2030": { "median": -0.032, "p10": -0.015, "p25": -0.022, "p75": -0.048, "p90": -0.065 }
      },
      "velocity": { "2027": -0.005, "2028": -0.006, "2029": -0.009, "2030": -0.009 }
    }
  },
  "allocation_recommendation": {
    "invest_more": ["Hair: Care", "LHC: ADW"],
    "defend": ["LHC: FCN", "Hair: Color"],
    "harvest": ["LHC: IC"]
  }
}
```

Users apply shifts: `GP1_projected = GP1_actual × (1 + shift_median)`

---

## 3. MODULE BREAKDOWN

### Module 1: SIMULATION ENGINE (`pulse/simulation/`)

**bayesian_mc.py** — Bayesian Monte Carlo with copula dependencies (PRODUCTION)
- Beta-distributed priors per trend (α, β from expert scores or backtesting)
- Gaussian copula with t-copula tails for dependency modeling (via scipy.linalg.cholesky)
- Within-force correlation (default ρ=0.3), cross-force correlation from config
- 10,000 iterations default (configurable to 100,000)
- Continuous annual paths (2026–2030) with 5 percentile bands (p10, p25, median, p75, p90)
- Integrity event tracking for runtime repairs
- Model version: 2.4.0

**paths.py** — Continuous path modeling (PRODUCTION)
- 5 MECE diffusion curve types: s_curve, linear, front_loaded, back_loaded, step_function
- Per-trend peak year and diffusion curve assignment
- Velocity (year-over-year Δ) and acceleration (Δ of velocity) computation
- TriggerCondition / TriggerAlert system for early-warning evaluation
- PathAnalyzer classifies path shapes for strategic interpretation

**sensitivity.py** — Tornado, breakeven, force elimination (STUB)
- All 5 methods defined but raise `NotImplementedError`
- Designed to integrate with BayesianMonteCarloEngine but not yet connected
- **Gap: this is the only unimplemented simulation module**

**cvar.py** — Conditional Value-at-Risk (PRODUCTION)
- Portfolio-level CVaR (Expected Shortfall) across all categories
- Risk contribution decomposition per category
- Answers: "in the worst X% of outcomes, what's the average loss?"

**sobol.py** — Global sensitivity analysis (PRODUCTION)
- SALib Saltelli sampling for first-order (S1), total-order (ST), and second-order (S2) indices
- Identifies which trend parameters drive the most output variance
- Graceful degradation if SALib not installed

**reverse_stress.py** — Reverse stress testing (PRODUCTION)
- Uses scipy.optimize.differential_evolution
- Finds minimum parameter perturbations to achieve target adverse outcomes
- Returns ranked stress configurations with parameter change details

**tipping_points.py** — Structural inflection detection (PRODUCTION)
- Second-derivative acceleration analysis (d²shift/dt²)
- Sign reversal detection (contraction ↔ expansion boundaries)
- Threshold breach and regime change detection

### Module 2: RESOURCE ALLOCATION OPTIMIZER (`pulse/optimizer/`)

**allocation.py** — Mean-variance portfolio optimization (PRODUCTION)
- Extracts returns (median shift) and risk (std deviation) from MC results
- Empirical covariance from raw MC samples (falls back to heuristic correlation)
- Efficient frontier computation
- Defense ranking by category (invest_more / defend / harvest)
- Outputs relative weights (sum to 1.0), never absolute €M

### Module 3: DELPHI EXPERT ELICITATION (`pulse/elicitation/`)

**delphi.py** — Structured scoring protocol (PRODUCTION)
- Multi-round scoring: Round 1 (blind) → Round 2 (shared distribution) → Round 3 (outlier discussion)
- ScoringRound and CalibrationExercise dataclasses
- Inter-rater reliability (Krippendorff's alpha)
- Bias detection: anchoring, optimism, recency
- Full database persistence (Postgres/SQLite dual-mode)

### Module 4: AI LAYER (`pulse/ai/`)

**provider.py** — LLM provider abstraction (PRODUCTION)
- Abstract base class with concrete implementations: Claude, Azure OpenAI, Ollama
- APICall audit logging with token/cost tracking
- Provider swap via config, zero code changes

**scanner.py** — Trend intelligence scanner (PRODUCTION)
- LLM-powered analysis of market trends against PRISM's trend database
- Strategic research questions approach (Bain Partner-grade rigor)
- TrendSuggestion dataclass with force/category classification
- Conditional feedparser/requests handling

**narrator.py** — Executive narrative generator (PRODUCTION)
- Converts Shift Matrix to executive narrative using LLM
- Forces-aware, percentage-only language (never €M)
- Causal explanation of "why" not just "what"

**calibrator.py** — Score calibration (PRODUCTION)
- Cross-validates expert scores against external market signals
- CalibrationSuggestion output with recommended adjustments
- Detects systematic over/under-scoring

**chat.py** — Natural language interface (PRODUCTION)
- Conversational queries about model results
- ChatContext with conversation history
- Financial data filtering (prevents absolute value exposure)

### Module 5: EXCEL & EXPORT (`pulse/excel_bridge/`)

**writer.py** — Excel Shift Matrix export (PRODUCTION)
- Multi-sheet workbook: Shift Matrix (percentiles), Velocity & Triggers, Allocation, Metadata
- Professional Henkel-branded styling with color-coded expansion/contraction

**export_center.py** — PowerPoint/PDF generation (PRODUCTION)
- 6-slide executive deck: Title, Heatmap, Allocation, Path Timeline, Methodology, Appendix
- Color-coded visualization (green=expansion, red=contraction)
- PDF report generation

**powerbi_export.py** — Power BI adapter (PRODUCTION)
- Flat JSON/CSV with one row per category × year
- Includes velocity, force attribution, percentiles
- Designed for Power BI semantic model ingestion

### Module 6: DATA LAYER

**ingestion/models.py** — Trend and TrendDatabase dataclasses (PRODUCTION)
- Trend dataclass: probability, gp1_pct_affected, direction, diffusion_curve, peak_year
- Category/VC/regional exposure mappings
- Bayesian posterior tracking (alpha, beta)
- normalized_score = prob_mean × gp1_pct_affected × direction_sign

**database.py** — Dual-mode persistence (PRODUCTION)
- PostgreSQL via @neondatabase/serverless (production on Vercel)
- SQLite via stdlib sqlite3 (local development)
- Connection pooling with cold-start retry logic
- Tables: trends, trend_category_exposure, trend_vc_exposure, simulation_runs, config_snapshots, delphi_rounds, triggers, ai_suggestions, audit_log, users

**seed_trends.py** — Trend seeding (PRODUCTION)
- 61 fully specified trends (55 global + 6 regional)
- Each trend has: gp1_pct_affected with rationale, category/VC/regional exposures, diffusion_curve, peak_year
- April 2026 market intelligence snapshot

**config.py** — Model configuration (PRODUCTION)
- 6 forces, 12 categories (Hair: Color, Care, Styling, Body; LHC: FCN=Fabric Cleaning, FCA=Fabric Care, FFI=Fabric Finisher, LAD=Laundry Additives, HDW=Hand Dish Wash, ADW=Automatic Dish Wash, HSC=Hard Surface Cleaner, IC=Insect Control), 8 VC steps, 4 regions
- Default parameters: attenuation=0.5, iterations=10K, base_year=2025, path_years=[2026-2030]
- 5 MECE diffusion curve types with materialization schedule computation
- Force-specific materialization overrides (legacy fallback)
- Force overlap and correlation matrices

### Module 7: API LAYER (`pulse/api/`)

**app.py** — FastAPI application (PRODUCTION)
- CORS middleware for cross-origin dashboard access
- Model version tracking
- Convergence summarization for frontend consumption
- Static file serving for embedded React dashboard
- NumPy type sanitization in responses

**routes/analytics.py** — Advanced analytics endpoints (PRODUCTION)
- `POST /analytics/cvar` — CVaR computation
- `POST /analytics/sobol` — Sobol sensitivity indices
- `POST /analytics/tipping-points` — Tipping point detection
- `POST /analytics/reverse-stress` — Reverse stress testing

**routes/delphi.py** — Delphi protocol endpoints (PRODUCTION)
- `POST /delphi/sessions` — Create Delphi sessions
- `POST /delphi/score` — Submit expert scores
- `GET /delphi/calibration` — Calibration exercises

**routes/auth.py** — Authentication (PRODUCTION)
- `POST /auth/register`, `/auth/login`
- `POST /auth/request-reset`, `/auth/confirm-reset`
- `GET /auth/me`, `/auth/users`
- JWT token handling, admin role checks

**routes/scanner.py** — AI scanner endpoints (PRODUCTION)
- `POST /scanner/scan` — Trigger trend scanning
- `GET /scanner/status` — Check scan progress
- Background task support for long-running scans

### Module 8: AUDIT & GOVERNANCE (`pulse/audit/`)

**logger.py** — Audit logging (PRODUCTION)
- AuditLogger with transaction context manager
- Atomic domain write + audit log entry (no race conditions)
- Tracks: action, entity_type, entity_id, old_value, new_value, reason, user_id

---

## 4. FRONTEND ARCHITECTURE

### Next.js 14 Application (Production Frontend)

**Pages (`app/`):**
- `page.tsx` — Root: auth check, redirects to /dashboard or /login
- `dashboard/page.tsx` — Main War Room with ErrorBoundary and auth flow
- `login/page.tsx` — Login form
- `register/page.tsx` — Registration form
- `api/auth/` — Server-side auth routes (login, register, logout, refresh, check)

**Dashboard Components (`components/dashboard/`, 29 components):**

| Component | Purpose |
|-----------|---------|
| `ProfitPoolShiftModel.tsx` | Main War Room orchestrator |
| `HeadlineKPI.tsx` | Top-line metrics (net shift, confidence, velocity) |
| `Heatmap.tsx` | Force × Category heatmap with color-coded shifts |
| `PathTimeline.tsx` | 2026-2030 continuous path with confidence bands |
| `TrendExplorer.tsx` | Drill-down into individual trends |
| `CategoryDetailPanel.tsx` | Category-level analysis with allocation |
| `ForceWaterfall.tsx` | Force contribution waterfall chart |
| `ForceRadar.tsx` | Radar chart for force comparison |
| `ForceWeightSliders.tsx` | Interactive weight adjustment |
| `DelphiPanel.tsx` | Delphi scoring interface |
| `DelphiScoreCard.tsx` | Individual trend score card |
| `DelphiDistribution.tsx` | Score distribution visualization |
| `AIInsightsBar.tsx` | Bottom notification bar for AI suggestions |
| `AIChatPanel.tsx` | Natural language query panel |
| `AllocationChart.tsx` | Resource allocation visualization |
| `CausalFlow.tsx` | Force interaction flow diagram |
| `CompetitivePanel.tsx` | Competitive landscape view |
| `ConnectionStatus.tsx` | Backend connectivity indicator |
| `ConvergenceBadge.tsx` | MC convergence status display |
| `ScenarioSelector.tsx` / `ScenarioSelectorPanel.tsx` | Scenario switching |
| `SettingsPanel.tsx` | Admin configuration |
| `ErrorBoundary.tsx` | React error boundary wrapper |
| `LoadingSkeleton.tsx` | Loading state animations |
| `OnboardingTooltips.tsx` | First-use guided tour |
| `analytics/CVaRDisplay.tsx` | CVaR visualization |
| `analytics/SobolChart.tsx` | Sobol sensitivity chart |
| `analytics/ReverseStressPanel.tsx` | Reverse stress results |
| `analytics/TippingPointsPanel.tsx` | Tipping point visualization |

**State Management (`hooks/usePrism.ts`):**
- Central state hook (single source of truth for the dashboard)
- Connects to FastAPI backend for live data
- Graceful fallback to `data/mockData.ts` when backend is unavailable
- Manages: simulation results, trends, analytics, Delphi state

**Supporting Libraries (`lib/`):**
- `auth.ts` — JWT creation/verification (Jose), bcrypt password hashing, access (1h) + refresh (7d) tokens
- `db.ts` — Neon serverless PostgreSQL client, user CRUD operations
- `users.ts` — User management utilities
- `format.ts` — Formatting helpers, constants (CATEGORIES, YEARS, FORCES)

**Type System (`types/`):**
- `index.ts` — Central type exports
- `api.ts` — API request/response types
- `analytics.ts` — CVaR, Sobol, tipping point types
- `simulation.ts` — Shift matrix, path, scenario types
- `trends.ts` — Trend, force, category types
- `config.ts` — Configuration types
- `delphi.ts` — Delphi protocol types

### Embedded Vite Dashboard (`pulse/dashboard/`)
A secondary React dashboard built with Vite, served by FastAPI for local development. Contains 45+ components mirroring the Next.js dashboard but optimized for the `python -m pulse --serve` workflow.

### Mock Data System (`data/mockData.ts`) — DEPRECATED
Legacy mock data generator. No longer imported by any active component. The dashboard now displays only real data from the API. When the backend is unavailable, the dashboard shows a clear "Backend Unavailable" state with a reconnect button. When connected but no simulation has been run yet, it shows a "No Simulation Data" prompt with a button to trigger a run. This file is retained for reference but can be safely deleted.

---

## 5. TECH STACK

### Frontend
```
Next.js 14.2.20          # SSR/SSG framework (production)
React 18.3.1             # UI library
TypeScript 5.7.3         # Type safety
Tailwind CSS 3.4.17      # Utility-first styling
D3.js 7.9.0              # Custom visualizations (heatmaps, DAG, paths)
Recharts 2.12.7          # Standard React charts
Framer Motion 11.15.0    # Animations (panel transitions, hover states)
Lucide React 0.462.0     # Icon system
Jose 5.9.6               # JWT token handling
Bcryptjs 2.4.3           # Password hashing
@neondatabase/serverless  # PostgreSQL (Vercel production)
```

### Backend (Python)
```
fastapi >= 0.110         # REST API
uvicorn >= 0.27          # ASGI server (local dev)
pydantic >= 2.6          # Data validation
numpy >= 1.26            # Numerical computing
scipy >= 1.12            # Distributions, optimization, copulas
pandas >= 2.2            # Data manipulation (dev only, stripped from serverless)
networkx >= 3.2          # Graph operations
SALib >= 1.4             # Sobol sensitivity analysis
statsmodels >= 0.14      # Statistical modeling
arviz >= 0.17            # Bayesian diagnostics
anthropic >= 0.40        # Claude API (LLM provider)
openpyxl >= 3.1          # Excel read/write
python-pptx >= 0.6       # PowerPoint generation
reportlab >= 4.1         # PDF generation
jinja2 >= 3.1            # Report templates
python-dotenv >= 1.0     # Environment variables
feedparser >= 6.0        # RSS parsing
aiohttp >= 3.9           # Async HTTP
pytest >= 8.0            # Testing
hypothesis >= 6.98       # Property-based testing
```

### Serverless Runtime (Vercel, `api/requirements.txt`)
Stripped for <250MB: fastapi, pydantic, numpy, psycopg2-binary, aiohttp, feedparser, requests. scipy and pandas excluded.

### Database
```
PostgreSQL (Neon serverless)  # Production (Vercel)
SQLite (stdlib)               # Local development
```

---

## 6. DATABASE SCHEMA

```sql
-- Core trend data (NO financial columns)
CREATE TABLE trends (
    id TEXT PRIMARY KEY,
    force TEXT NOT NULL,
    sub_category TEXT,
    name TEXT NOT NULL,
    description TEXT,
    direction TEXT CHECK(direction IN ('Expansion', 'Contraction')),
    probability INTEGER CHECK(probability BETWEEN 1 AND 5),
    gp1_pct_affected REAL CHECK(gp1_pct_affected BETWEEN 0.0 AND 1.0),
    start_year INTEGER,
    normalized_score REAL,
    strategic_implication TEXT,
    data_source TEXT,
    source_type TEXT,
    confidence TEXT DEFAULT 'Medium',
    ai_suggested BOOLEAN DEFAULT FALSE,
    user_override BOOLEAN DEFAULT FALSE,
    scorer_count INTEGER DEFAULT 1,
    score_variance REAL DEFAULT 0.0,
    debiasing_applied BOOLEAN DEFAULT FALSE,
    probability_posterior TEXT,  -- JSON: {"alpha": 4, "beta": 2}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trend_category_exposure (
    trend_id TEXT REFERENCES trends(id),
    category TEXT NOT NULL,
    exposure_score INTEGER CHECK(exposure_score BETWEEN 0 AND 5),
    PRIMARY KEY (trend_id, category)
);

CREATE TABLE trend_vc_exposure (
    trend_id TEXT REFERENCES trends(id),
    vc_step TEXT NOT NULL,
    exposure_score INTEGER CHECK(exposure_score BETWEEN 0 AND 5),
    PRIMARY KEY (trend_id, vc_step)
);

CREATE TABLE simulation_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    scenario TEXT,
    iterations INTEGER,
    model_type TEXT,
    config_snapshot_id INTEGER REFERENCES config_snapshots(id),
    results TEXT,                    -- JSON: shift matrix
    allocation_recommendation TEXT,  -- JSON: category weights
    convergence_diagnostics TEXT     -- JSON: R-hat, ESS, etc.
);

CREATE TABLE config_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    region TEXT,
    attenuation REAL,
    attenuation_source TEXT,
    force_weights TEXT,
    vc_weights TEXT,
    category_names TEXT,
    path_years TEXT,
    materialization_schedule TEXT,
    backtesting_accuracy REAL
);

CREATE TABLE delphi_rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    round_number INTEGER,
    round_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trend_id TEXT REFERENCES trends(id),
    scorer_id TEXT,
    probability_score INTEGER,
    gp1_pct_affected_score REAL,
    rationale TEXT,
    calibration_factor REAL DEFAULT 1.0,
    bias_flags TEXT
);

CREATE TABLE triggers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    condition_type TEXT,
    threshold REAL,
    target_year INTEGER,
    action_text TEXT,
    status TEXT DEFAULT 'active',
    fired_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    suggestion_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    suggestion_type TEXT,
    content TEXT,
    source_urls TEXT,
    status TEXT DEFAULT 'pending',
    user_decision_date TIMESTAMP,
    user_notes TEXT
);

CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    user_id TEXT DEFAULT 'system'
);

-- Auth (Neon PostgreSQL only)
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'viewer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Note:** The v2.0 spec included `causal_edges`, `competitors`, and `backtest_results` tables. These were removed in v2.4 as the underlying modules (Causal DAG, Game Theory, Backtesting) were never implemented. They remain in the architectural vision for future development.

---

## 7. REST API

```
Base URL: /api/v1  (proxied through Vercel serverless → FastAPI)

# Health
GET  /health                          → { status, version, db_stats }

# Trends
GET  /trends                          → List all trends (filterable by force, direction)
GET  /trends/{id}                     → Single trend with posterior
PUT  /trends/{id}                     → Update trend (triggers re-simulation)
POST /trends                          → Add new trend

# Simulation
POST /simulate                        → Run Bayesian MC with continuous paths

# Analytics
POST /analytics/cvar                  → Conditional Value-at-Risk
POST /analytics/sobol                 → Sobol global sensitivity indices
POST /analytics/tipping-points        → Tipping point detection
POST /analytics/reverse-stress        → Reverse stress testing

# Delphi
POST /delphi/sessions                 → Create scoring session
POST /delphi/score                    → Submit expert score
GET  /delphi/calibration              → Calibration exercise data

# AI
POST /scanner/scan                    → Trigger trend scanning
GET  /scanner/status                  → Scan progress

# Auth
POST /auth/register                   → Create account
POST /auth/login                      → Authenticate
POST /auth/logout                     → Invalidate session
POST /auth/refresh                    → Refresh JWT token
GET  /auth/me                         → Current user info
GET  /auth/users                      → List users (admin only)

# Config
GET  /config                          → Current model configuration
PUT  /config                          → Update parameters (admin, triggers cache invalidation)

# Export
POST /export/excel                    → Shift Matrix Excel
POST /export/pptx                     → PowerPoint summary deck
POST /export/shift-matrix             → Raw JSON/CSV for Power BI

# Audit
GET  /audit/log                       → Full audit trail
```

---

## 8. DEPLOYMENT

### Production (Vercel)
```bash
# Vercel auto-deploys from git. Configuration:
# vercel.json — routes, serverless function config
# api/index.py — Python serverless adapter with cold-start retry
# api/requirements.txt — stripped dependencies for <250MB
# .vercelignore — excludes pulse/dashboard, tests, docs

# Environment variables (Vercel dashboard):
DATABASE_URL=postgresql://...@neon.tech/prism
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=...
```

### Local Development
```bash
# Backend
cd PROFIT_POOL_ENGINE
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
python -m pulse --serve                    # FastAPI at :8000

# Frontend
npm install
npm run dev                                # Next.js at :3000

# CLI
python -m pulse --output "shift_matrix.xlsx"
python -m pulse --iterations 50000
python -m pulse --seed 42                  # Reproducible run
python -m pulse --serve --ai claude        # With AI layer
python -m pulse --serve --ai azure         # Azure OpenAI
python -m pulse --serve --ai ollama        # Local LLM
python -m pulse --serve --ai none          # No AI
```

---

## 9. VISUAL DESIGN SYSTEM

**Color Palette (Dark Professional):**
```css
--bg-primary: #0F172A;         /* Deep navy */
--bg-secondary: #1E293B;       /* Elevated surface */
--bg-glass: rgba(30, 41, 59, 0.8);  /* Glassmorphism */
--accent-blue: #3B82F6;        /* Primary interactive */
--accent-gold: #D4A847;        /* Premium highlight */
--expansion: #22C55E;          /* Green — positive */
--contraction: #EF4444;        /* Red — negative */
--causal: #8B5CF6;             /* Purple — propagation */
--text-primary: #F8FAFC;
--text-secondary: #94A3B8;
```

**Typography:** Inter (UI), JetBrains Mono (data)

**Force colors:** Consumer=#3B82F6, Customer=#8B5CF6, Technology=#06B6D4, Government=#F59E0B, Environmental=#22C55E, Competitive=#EF4444

**Category colors & brand mapping (Hair):**
- Color=#F87171 — Hair Color (Schwarzkopf Keratin Color, got2b Color, Palette, Igora, BlondMe, Diadem)
- Care=#FB923C — Hair Care (Schwarzkopf, Gliss, Schauma, Syoss, Olaplex, Joico, Kenra, Alterna)
- Styling=#FBBF24 — Hair Styling (got2b, Taft, Schwarzkopf, Osis+, Sexy Hair)
- Body=#A3E635 — Body Care (Fa, Dial, Barnängen, La Toja)

**Category colors & brand mapping (LHC):**
- FCN=#34D399 — Fabric Cleaning / Laundry Detergent (Persil, All, Purex, Weißer Riese, Dixan, Le Chat, Sun)
- FCA=#2DD4BF — Fabric Care / Specialty Delicates (Perwoll)
- FFI=#22D3EE — Fabric Finisher / Softener (Vernel, Silan, Snuggle, Purex Softener)
- LAD=#60A5FA — Laundry Additives (Snuggle Scent Boosters, Purex Fragrance Boosters, Purex Dryer Sheets)
- HDW=#818CF8 — Hand Dish Wash (Pril, Pur, Nelsen)
- ADW=#A78BFA — Automatic Dish Wash (Somat, Pril Automatic, Top Shelf)
- HSC=#C084FC — Hard Surface Cleaner (Bref, WC Frisch, Sonasol, Blue Star, Soft Scrub, DAC)
- IC=#E879F9 — Insect Control (Catch, Home Mat & Home Keeper)

---

## 10. TESTING

### Test Suite (`tests/`, 11 files)
```
conftest.py                          # Pytest fixtures
test_bayesian_mc.py                  # MC engine convergence, copula behavior
test_cvar.py                         # CVaR computation correctness
test_sobol.py                        # Sobol index validation
test_reverse_stress.py               # Reverse stress optimizer
test_tipping_points.py               # Tipping point detection
test_optimizer.py                    # Allocation optimizer constraints
test_api.py                          # FastAPI endpoint integration
test_scanner_routes.py               # AI scanner API routes
test_properties.py                   # Hypothesis property-based tests
test_advanced_analytics_integration.py  # End-to-end analytics pipeline
```

---

## 11. FILE STRUCTURE

```
PROFIT_POOL_ENGINE/
├── claude.md                          # This specification (v3.0)
├── package.json                       # Next.js dependencies
├── package-lock.json
├── next.config.js                     # Next.js configuration
├── tailwind.config.js                 # Tailwind CSS config
├── postcss.config.js                  # PostCSS config
├── tsconfig.json                      # TypeScript config
├── vercel.json                        # Vercel deployment config
├── deploy.sh                          # Deployment script
├── requirements-dev.txt               # Python dev dependencies (full)
├── .env                               # Environment variables (not committed)
├── .env.example                       # Environment template
├── .gitignore
├── .vercelignore
│
├── app/                               # Next.js App Router
│   ├── layout.tsx                     # Root layout
│   ├── page.tsx                       # Home (auth redirect)
│   ├── globals.css                    # Global styles
│   ├── login/page.tsx                 # Login page
│   ├── register/page.tsx              # Registration page
│   ├── dashboard/page.tsx             # War Room dashboard
│   └── api/auth/                      # Server-side auth routes
│       ├── check/route.ts
│       ├── login/route.ts
│       ├── logout/route.ts
│       ├── refresh/route.ts
│       └── register/route.ts
│
├── components/dashboard/              # React War Room components (29)
│   ├── ProfitPoolShiftModel.tsx       # Main orchestrator
│   ├── HeadlineKPI.tsx
│   ├── Heatmap.tsx
│   ├── PathTimeline.tsx
│   ├── TrendExplorer.tsx
│   ├── CategoryDetailPanel.tsx
│   ├── ForceWaterfall.tsx
│   ├── ForceRadar.tsx
│   ├── ForceWeightSliders.tsx
│   ├── DelphiPanel.tsx
│   ├── DelphiScoreCard.tsx
│   ├── DelphiDistribution.tsx
│   ├── AIInsightsBar.tsx
│   ├── AIChatPanel.tsx
│   ├── AllocationChart.tsx
│   ├── CausalFlow.tsx
│   ├── CompetitivePanel.tsx
│   ├── ConnectionStatus.tsx
│   ├── ConvergenceBadge.tsx
│   ├── ScenarioSelector.tsx
│   ├── ScenarioSelectorPanel.tsx
│   ├── SettingsPanel.tsx
│   ├── ErrorBoundary.tsx
│   ├── LoadingSkeleton.tsx
│   ├── OnboardingTooltips.tsx
│   └── analytics/
│       ├── CVaRDisplay.tsx
│       ├── SobolChart.tsx
│       ├── ReverseStressPanel.tsx
│       └── TippingPointsPanel.tsx
│
├── hooks/
│   └── usePrism.ts                    # Central state hook (backend + mock fallback)
│
├── lib/
│   ├── auth.ts                        # JWT + bcrypt auth utilities
│   ├── db.ts                          # Neon PostgreSQL client
│   ├── users.ts                       # User management
│   └── format.ts                      # Formatting helpers, constants
│
├── types/
│   ├── index.ts                       # Central type exports
│   ├── api.ts
│   ├── analytics.ts
│   ├── simulation.ts
│   ├── trends.ts
│   ├── config.ts
│   └── delphi.ts
│
├── data/
│   ├── mockData.ts                    # Offline/demo mode data generator
│   └── prism.db                       # SQLite database (local dev)
│
├── api/                               # Vercel serverless adapter
│   ├── index.py                       # Python handler with cold-start retry
│   ├── client.ts                      # TypeScript API client
│   ├── requirements.txt               # Serverless-optimized dependencies
│   └── public/                        # Built React assets
│
├── pulse/                             # Python simulation engine
│   ├── __init__.py
│   ├── __main__.py                    # Entry: python -m pulse
│   ├── main.py                        # CLI with argparse
│   ├── config.py                      # Model parameters, taxonomies
│   ├── config_validation.py           # Config validation
│   ├── database.py                    # Dual-mode DB (Postgres/SQLite)
│   ├── env_loader.py                  # Environment variable loading
│   ├── backup.py                      # Database backup utilities
│   ├── seed_trends.py                 # 61 trend definitions
│   │
│   ├── simulation/
│   │   ├── bayesian_mc.py             # Bayesian MC with copulas (PRODUCTION)
│   │   ├── paths.py                   # Continuous path modeling (PRODUCTION)
│   │   ├── sensitivity.py             # Tornado/breakeven (STUB)
│   │   ├── cvar.py                    # Conditional Value-at-Risk (PRODUCTION)
│   │   ├── sobol.py                   # Sobol sensitivity (PRODUCTION)
│   │   ├── reverse_stress.py          # Reverse stress testing (PRODUCTION)
│   │   └── tipping_points.py          # Tipping point detection (PRODUCTION)
│   │
│   ├── optimizer/
│   │   └── allocation.py              # Mean-variance optimizer (PRODUCTION)
│   │
│   ├── elicitation/
│   │   └── delphi.py                  # Delphi protocol (PRODUCTION)
│   │
│   ├── ai/
│   │   ├── provider.py                # LLM abstraction (Claude/Azure/Ollama)
│   │   ├── scanner.py                 # Trend intelligence scanner
│   │   ├── narrator.py                # Executive narrative generator
│   │   ├── calibrator.py              # Score calibration
│   │   ├── chat.py                    # Natural language interface
│   │   └── config.py                  # AI configuration
│   │
│   ├── excel_bridge/
│   │   ├── writer.py                  # Excel Shift Matrix export
│   │   ├── export_center.py           # PPTX/PDF generation
│   │   └── powerbi_export.py          # Power BI flat export
│   │
│   ├── ingestion/
│   │   └── models.py                  # Trend, TrendDatabase dataclasses
│   │
│   ├── common/
│   │   └── shape_compat.py            # Array shape compatibility utils
│   │
│   ├── integrations/
│   │   └── __init__.py                # Extension point (APIs not yet wired)
│   │
│   ├── audit/
│   │   └── logger.py                  # Audit logging with transactions
│   │
│   ├── api/
│   │   ├── app.py                     # FastAPI application
│   │   ├── auth.py                    # API authentication
│   │   ├── export_pptx.py             # PPTX export endpoint
│   │   ├── seed_data.py               # Seed data endpoint
│   │   ├── routes/
│   │   │   ├── analytics.py           # CVaR, Sobol, tipping, stress
│   │   │   ├── auth.py                # Auth endpoints
│   │   │   ├── delphi.py              # Delphi protocol
│   │   │   └── scanner.py             # AI scanner
│   │   └── public/                    # Built dashboard assets
│   │
│   └── dashboard/                     # Embedded Vite React dashboard
│       ├── src/                       # 45+ components (mirrors Next.js)
│       ├── package.json
│       ├── vite.config.ts
│       └── dist/                      # Built assets
│
├── tests/                             # Python test suite (11 files)
│   ├── conftest.py
│   ├── test_bayesian_mc.py
│   ├── test_cvar.py
│   ├── test_sobol.py
│   ├── test_reverse_stress.py
│   ├── test_tipping_points.py
│   ├── test_optimizer.py
│   ├── test_api.py
│   ├── test_scanner_routes.py
│   ├── test_properties.py
│   └── test_advanced_analytics_integration.py
│
├── assets/                            # Static images
├── public/                            # Built frontend assets
│
└── DOCUMENTATION/                     # All docs, decks, reports (55 files)
    ├── *.md                           # Technical guides, references
    ├── *.docx                         # Audit reports, methodology docs
    ├── *.pptx                         # CEO decks, strategy presentations
    └── *.pdf                          # PDF exports
```

---

## 12. ARCHITECTURAL VISION (Not Yet Implemented)

The following modules were designed in v2.0 but have not been built. They remain part of the long-term roadmap:

### Causal DAG (`pulse/causal/dag.py`)
Directed Acyclic Graph modeling causal relationships between the 6 forces. Would enable shock propagation ("a regulatory event triggers reformulation costs triggers shelf price changes triggers consumer behavior shift") with lag structures and propagation weights. Current workaround: force correlation matrix in config.py provides simplified dependency modeling.

### Game Theory Layer (`pulse/game_theory/competitive.py`)
Would model competitive responses from P&G, Unilever, Reckitt, and others. Response archetypes (premium_defender, sustainability_leader, etc.) would generate second-order profit pool impacts. Currently, competitive intelligence is represented as static trends in the trend database.

### Backtesting Engine (`pulse/backtesting/engine.py`)
Would calibrate model parameters from historical V1-V11 assessments against actual market shifts. Would derive the attenuation factor empirically (currently assumed at 0.5), calibrate distribution shapes, and compute a model accuracy score for ExCo credibility. Prerequisite: historical version data.

### External API Integrations (`pulse/integrations/`)
The integration module exists as a stub. 19 free-tier APIs were mapped in v2.0 (GDELT, GNews, CurrentsAPI, ECHA, EUR-Lex, SEC EDGAR, Google Trends, Reddit, FRED, etc.). The AI scanner currently uses the LLM provider for trend intelligence rather than direct API integration.

### Sensitivity Analysis (`pulse/simulation/sensitivity.py`)
Tornado analysis, breakeven analysis, force elimination, weight sensitivity, and attenuation sensitivity methods are defined but raise NotImplementedError. Designed to integrate with the Bayesian MC engine.

---

## 13. ORGANIZATIONAL EMBEDDING FRAMEWORK

### RACI Matrix

| Activity | Strategy VP | Category Leads | Data/Analytics | AI/Tech |
|----------|:-----------:|:--------------:|:--------------:|:-------:|
| Trend scoring (Delphi rounds) | A | R | C | I |
| Score override authority | A | R | C | I |
| Scenario definition | A | R | C | I |
| Shift Matrix sign-off | A | R | C | I |
| AI suggestion accept/reject | I | R | C | A |
| Model calibration | I | C | A | R |
| Annual parameter review | A | C | R | C |
| Dashboard access provisioning | I | I | A | R |

### Annual Planning Cycle Integration

**Q1 (Jan-Mar):** Annual calibration — parameter review, Delphi Round 1
**Q2 (Apr-Jun):** Strategic planning input — full MC run (50K iterations), allocation optimizer, Shift Matrix delivery
**Q3 (Jul-Sep):** Mid-year review — AI scanner refresh, trigger check, velocity review
**Q4 (Oct-Dec):** Budget integration — final Shift Matrix, competitive update, ExCo presentation, version archive

---

## 14. RISK REGISTER

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Vercel cold-start latency | Medium | Medium | Retry logic in api/index.py, graceful degradation |
| Mock data diverges from API schema | Medium | Medium | Shared TypeScript types, integration tests |
| Neon PostgreSQL connection limits | Low | High | Connection pooling, SQLite fallback |
| Sensitivity analysis remains stub | High | Medium | CVaR/Sobol provide alternative sensitivity insights |
| AI hallucinations in scanner/narrator | Medium | Medium | Human-in-the-loop, never auto-applied |
| Causal DAG never implemented | Medium | Medium | Force correlation matrix provides simplified alternative |
| No backtesting data for calibration | High | Medium | Priors clearly labeled "assumed, not calibrated" |
| Serverless dependency size limit | Low | High | Stripped requirements in api/requirements.txt |
| JWT secret exposure | Low | Critical | Environment variables, never in code |

---

## 15. SUCCESS METRICS

### Current (Achieved)
- [x] Bayesian MC completes 10,000 iterations reliably
- [x] Dashboard wired to real API data with proper empty/error states
- [x] 61 trends seeded with full metadata
- [x] Auth system with JWT + role-based access
- [x] Advanced analytics (CVaR, Sobol, reverse stress, tipping points) working
- [x] Professional Excel/PPTX/Power BI export
- [x] 11 test files covering simulation, analytics, API, and properties

### Target (Next Milestones)
- [ ] Implement sensitivity.py (tornado, breakeven, force elimination)
- [ ] Build Causal DAG module for shock propagation
- [ ] Wire external API integrations (GDELT, ECHA, etc.)
- [ ] Backtesting against historical versions (V1-V11)
- [ ] Game theory layer for competitive response modeling
- [ ] Power BI automated sync scheduler
- [ ] Increase test coverage to >80%

---

*Document Version: 3.0 — April 2026*
*Author: Strategy × Technology × Quant Partnership*
*Classification: CONFIDENTIAL — Internal Use Only*
*Methodology: Bayesian hierarchical + copula dependencies + mean-variance optimization + Delphi elicitation + advanced risk analytics*
