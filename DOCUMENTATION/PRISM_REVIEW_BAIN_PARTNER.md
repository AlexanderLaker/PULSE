# PRISM Review — Bain Senior Partner Rigor Assessment

**Reviewer perspective:** Bain & Company Senior Partner, 20 years profit pool analysis, FMCG strategy  
**Date:** April 14, 2026  
**Application:** prism-war-room.vercel.app  
**Codebase version:** v2.4.0 (bayesian_copula engine)

---

## EXECUTIVE SUMMARY

**PRISM is analytically credible at its core but structurally over-promises relative to what's actually built — and that gap is the single biggest risk for your presentation.** The Bayesian Monte Carlo engine with t-copula dependency modeling is genuinely well-implemented and defensible to a quant audience. However, the spec (CLAUDE.md) promises a Causal DAG, Game Theory layer, and Backtesting engine — none of which exist in the codebase. If a CMO or CFO reads the documentation and then asks "show me the causal propagation" or "what's your backtested accuracy," you will be exposed. **Fix the narrative before the presentation: reframe what PRISM *is* (a probabilistic profit pool shift simulator with expert-calibrated Bayesian priors) rather than what it *aspires to be*.**

---

## 1. ANALYTICAL INTEGRITY

### 1.1 Monte Carlo Simulation — Solid Foundation

🟢 **The t-copula implementation is correct and defensible.**
- Location: `pulse/simulation/bayesian_mc.py`
- Beta priors per trend, Cholesky decomposition of the correlation matrix, t-copula for tail dependence (df=8), multiplicative compounding across forces. This is textbook quantitative finance methodology applied correctly.
- Positive-definiteness repair via eigenvalue shifting is properly implemented with integrity event logging.
- The `direction_sign × probability × gp1_pct_affected` formulation is clean and avoids the double-counting that plagued v2.2 (where `impact` and `gp1_pct_affected` overlapped).

🟡 **Convergence diagnostics are honest but need labeling clarity.**
- Location: `bayesian_mc.py` lines 559-598
- Single-chain split-R̂ is explicitly flagged as "approximate" (`method: "single_chain_split_rhat_approximate"`). Multi-chain mode (3 chains, Vehtari 2021) is the default for production. Good.
- **Issue:** The HeadlineKPI component (`HeadlineKPI.tsx` line 189) displays a hardcoded fallback `'1.03'` when `r_hat` is null. A quant will ask: "Is that the actual R̂ or a placeholder?" Fix: show "—" or "N/A" when no convergence data exists.
- **Why it matters:** A CFO who sees "R̂ 1.03" and asks "how many chains?" deserves an honest answer. The code supports it — the UI should too.

🔴 **The "73% backtested accuracy" displayed in the UI is fabricated.**
- Location: `HeadlineKPI.tsx` line 191 — `const backtestAccuracy = convergence?.backtestingAccuracy ?? 0.73`
- The backtesting module was **never implemented**. The `backtest_results` table was removed from the database schema. The `0.73` is a hardcoded fallback that displays as if it's a real metric.
- **Fix:** Remove the backtesting accuracy display entirely, or replace it with "Not yet calibrated — assumed priors." Do NOT show a number that implies empirical validation when none exists.
- **Why it matters:** This is the single most dangerous number in the tool. If the CFO asks "How did you get 73%?" and the answer is "it's a default," your credibility is destroyed. A Bain partner would never present an uncalibrated metric as if it were backtested.

### 1.2 CVaR — Correctly Implemented

🟢 **CVaR (Expected Shortfall) is textbook correct.**
- Location: `pulse/simulation/cvar.py`
- Sorts samples, identifies the tail at `(1-α)` percentile, computes the conditional mean. Portfolio-level aggregation with risk contribution decomposition and diversification ratio.
- The only note: CVaR at 95% confidence on a 10,000-iteration MC means you're averaging 500 tail samples — sufficient for a stable estimate.

### 1.3 Sobol Sensitivity — Correctly Structured but SALib Dependency Risk

🟡 **Sobol implementation is methodologically correct but has a deployment dependency issue.**
- Location: `pulse/simulation/sobol.py`
- Uses SALib's Saltelli sampling scheme. First-order (S1), total-order (ST), and second-order (S2) indices are computed correctly with confidence intervals.
- **Issue:** SALib import is wrapped in try/except with fallback to `{"error": "SALib not installed"}`. On Vercel serverless, SALib may not be reliably available. Verify SALib is in `requirements.txt` and the Vercel build installs it.
- **Issue:** The `analyze_force_sensitivity` method normalizes force weights to sum to 1.0 before evaluating — this is correct for Sobol but means the indices measure *relative weight sensitivity*, not absolute force impact. Label this clearly in the UI.

### 1.4 Profit Pool Logic — The Core Question

🟡 **The model is a weighted scoring matrix with probabilistic dressing — and that's OK, but be honest about it.**
- The shift formula is: `GP1_shift% = Π_forces(1 + Σ_trends(prob × gp1_pct × direction × exposure × materialization × attenuation × force_weight)) - 1`
- This is **not** a causal model. It's a multiplicative scoring model with uncertainty quantification. The copula adds realistic tail correlation, the Beta priors add learning capacity, and the materialization curves add temporal dynamics. These are genuine upgrades over a static Excel matrix.
- **But:** The spec (CLAUDE.md) promises "Causal DAG replaces independent force channels — shocks propagate through directed causal paths." This module was **never built** (removed in v2.4). The `force_correlation_matrix` in `config.py` (lines 142-149) is a static cross-force correlation table, not a propagation mechanism.
- **Fix:** In your presentation, describe PRISM as a "probabilistic profit pool shift simulator with expert-calibrated Bayesian priors and copula-based tail risk modeling." Do NOT say "causal." If pressed, explain the force correlation matrix captures co-movement but not directional causation.
- **Why it matters:** Any McKinsey QuantumBlack or Bain GAMMA analyst will immediately ask: "Where's the DAG? How do shocks propagate?" If you can't show it, don't claim it.

### 1.5 Attenuation Factor — The Elephant in the Room

🔴 **The attenuation factor (default 0.5) is the single largest assumption in the model and it's "assumed, not calibrated."**
- Location: `config.py` line 27 — `DEFAULT_ATTENUATION = 0.5`
- Every force contribution is multiplied by 0.5 before compounding. This means the model systematically halves all predicted shifts. Why 0.5? Because the V12 Excel used 0.5. There is no empirical basis.
- The `attenuation_source` field tracks whether it's `"assumed"`, `"backtested"`, or `"admin_override"` — but backtesting was never built, so it's always "assumed."
- The `attenuation_sensitivity_band` method (lines 686-768) is an excellent mitigation — it re-runs at ±30% and shows the headline as a range. **Make sure this is prominently displayed.**
- **Fix:** In the presentation, lead with: "The attenuation factor is our most important assumption. Here's what happens when we flex it ±30%." This shows intellectual honesty and positions PRISM as a framework for structured thinking, not false precision.
- **Why it matters:** A CFO will ask "Why 0.5 and not 0.3 or 0.7?" If you can show the sensitivity band and say "that's exactly why we built the flex analysis," you turn a weakness into a strength.

### 1.6 Double-Counting Risk

🟡 **Residual double-counting risk between overlapping trends within the same force.**
- Example: `consumer_r01` (Private Label Penetration) and `consumer_r06` (Silver Economy) both affect Hair Care and LHC categories via the Consumer force. The within-force correlation (ρ=0.3) partially captures this overlap, but it doesn't prevent both trends from independently shifting the same pool segment.
- The `gp1_pct_affected` parameter (0.0-1.0) was designed to address this — it caps the maximum exposure per trend. But within a force, if three trends each claim 20% of GP1, the effective exposure could exceed 100%.
- **Mitigation:** The multiplicative compounding formula naturally compresses extreme shifts (1.05 × 1.05 = 1.1025, not 1.10). Combined with the 0.5 attenuation, the practical risk of >100% exposure is low. But document this limitation.

---

## 2. DATA QUALITY & SOURCES

### 2.1 Trend Data — High Quality, Well-Sourced

🟢 **61 trends (55 global + 6 regional) are well-researched with specific, cited sources.**
- Location: `pulse/seed_trends.py`
- Each trend includes a `data_source` field with named reports (e.g., "Circana EU6 Private Label Monitor Dec 2025," "McKinsey Consumer Health Survey 2025"). The `gp1_pct_affected` rationale is documented in the file header (lines 33-51) with clear calibration logic by trend type.
- Source credibility tiers (S through E) are specified in the database schema but **not displayed in the frontend**. This is a missed opportunity.

🟡 **Source credibility badges are specified but not visible.**
- Location: The spec (v2.3.1 item 15) promises "color-coded badges with hover tooltips." The `tier` field exists in the `trend_sources` table, but no frontend component renders it.
- **Fix:** Add credibility tier badges to the Trend Explorer. Even a simple letter badge (A, B, C) next to each source adds transparency. This is exactly what an exec asks: "Where does this come from? How reliable is it?"

🔴 **Market size data is not surfaced — exec will ask "how big is this pool?"**
- PRISM works entirely in relative percentages (by design — this is correct). But the presentation context requires pool sizing. An SVP will ask: "OK, Hair Care is shifting -3.2%. How many euros is that?"
- **Fix:** Either add a reference table showing public market sizes (Euromonitor data: Hair ~€85B, Laundry ~€140B global) or clearly state in the first slide: "PRISM models relative shifts. Apply to your actual GP1 in Excel or Power BI for €M impact."

### 2.2 Hardcoded Values That Should Be Dynamic

🟡 **Force weights are equal by default (16.7% each) with no empirical justification.**
- Location: `config.py` line 129 — `DEFAULT_FORCE_WEIGHTS = {f: 1.0 / len(FORCES) for f in FORCES}`
- Equal weighting is a defensible null hypothesis, but a Henkel exec will ask: "Shouldn't Government be weighted higher given the EU regulatory environment?" The admin config API allows overrides, and the Sobol analysis measures weight sensitivity — highlight this.

🟡 **Cross-force correlation matrix is static and unjustified.**
- Location: `config.py` lines 142-149
- Values like Consumer↔Customer = 0.25, Government↔Technology = 0.30 look reasonable but are labeled as "from DAG weights × 0.5" — referring to a DAG that doesn't exist. These should be labeled as "expert-assumed" or "literature-informed."

---

## 3. UX / PRESENTATION FOR C-SUITE

### 3.1 Story Flow

🟡 **The War Room needs a guided narrative mode for presentations.**
- The dashboard is designed for exploration (click anywhere, drill down). This is excellent for analysts but disorienting for an exec seeing it for the first time.
- **Fix:** Add a "Presentation Mode" button that steps through: (1) Headline KPI → (2) Heatmap overview → (3) Top 3 risk categories → (4) Allocation recommendation → (5) "What should we do?" Each step should have a scripted insight sentence.
- **Why it matters:** A CMO has 3 minutes of attention. If the first 30 seconds don't land a clear "so what," you've lost them.

### 3.2 Visual Design

🟢 **Dark mode, glassmorphism, and typography choices are Apple-grade.** The design language (Inter font, monospace data, color-coded shifts) is genuinely executive-quality. The Framer Motion animations add polish without being distracting.

🟡 **Font sizes on KPI cards may be too small at presentation distance.**
- The label text is 10px (`fontSize: 10` in HeadlineKPI.tsx line 69). At 2-3 meters (typical conference room), this is unreadable.
- **Fix:** For presentation mode, scale labels to 14px minimum. The big value numbers (28px) are fine.

### 3.3 Executive Narrative

🟢 **The auto-generated executive insight (HeadlineKPI lines 199-214) is well-written.** It adapts dynamically: direction, magnitude, top expansion/contraction, and a concrete recommendation. This is what makes the tool feel like a strategy partner, not just a chart generator.

---

## 4. BUGS & TECHNICAL ISSUES

🔴 **Vercel serverless cold start may timeout on first simulation.**
- Location: `vercel.json` — max duration 300s, memory 1GB.
- A 3-chain × 5,000-iteration simulation on 61 trends takes significant compute. On a cold Vercel serverless start, this could timeout. The lazy init (app.py lines 464-583) handles this with retry logic, but the first user to hit the app after a cold start may see an error.
- **Fix:** Pre-warm the function before the presentation. Hit `/api/v1/health` 5 minutes before to trigger lazy init. Better: persist the latest simulation in Postgres so cold starts load cached results (this is already implemented — verify it works).

🟡 **CORS configuration allows all origins in non-production mode.**
- Location: `app.py` line 436 — `cors_origins = os.environ.get('CORS_ORIGINS', 'http://localhost:3000,...').split(',')`
- If `ENV` is not set to `production`, CORS allows localhost origins. On Vercel, this may not be correctly restricted. Not a presentation blocker but a security issue.

🟡 **Two parallel frontend codebases exist.**
- `/app/` (Next.js 14) and `/pulse/dashboard/src/` (Vite React) contain overlapping components. The Next.js version is deployed to Vercel. The Vite version appears to be legacy/parallel.
- **Risk:** A bug fix applied to one may not be applied to the other. Clean up post-presentation.

---

## 5. LOGICAL / STRUCTURAL PROBLEMS

### 5.1 Is This Actually a Profit Pool Shift Model?

🟡 **It's a trend-weighted scoring model with Monte Carlo uncertainty — call it that.**
- A "profit pool shift model" implies you're modeling where profit moves between players, segments, and value chain steps. PRISM models directional trend impacts on category-level GP1 percentages. It doesn't model competitive profit capture, margin dynamics, or value chain restructuring.
- **Fix:** Position PRISM as a "Strategic Force Assessment Engine with Probabilistic Shift Estimation." The profit pool framing comes when users apply the Shift Matrix to their actual financials in Excel/Power BI.

### 5.2 Spec-Reality Gap — The Biggest Presentation Risk

🔴 **Four major modules promised in the spec do not exist in the codebase:**

| Module | Spec Status | Code Status | Risk |
|--------|-------------|-------------|------|
| Causal DAG | "replaces independent force channels" | Removed in v2.4, replaced with correlation matrix | High — if exec asks "show me causal propagation" |
| Game Theory | "models competitive responses" | Never built | Medium — competitive force exists as trends, not as response model |
| Backtesting | "Phase 0 — model earns credibility before predictions" | Never built, tables removed | Critical — the "73% accuracy" number is fake |
| External API Scanner | "multi-source waterfall: GDELT + GNews + CurrentsAPI" | Routes disabled, code exists but not called | Low — trends are manually curated, which is arguably better |

- **Fix before presentation:** Remove or clearly caveat any reference to these modules. The spec should match reality. If someone reads CLAUDE.md and then looks at the code, they'll find the gap.

### 5.3 Time Horizons

🟢 **5-year horizon (2026-2030) is appropriate for FMCG.** Consumer trends materialize over 3-5 years. The S-curve materialization model with force-specific overrides (regulatory = front-loaded, technology = back-loaded) is well-designed and empirically grounded.

---

## 6. STRATEGIC POSITIONING

### 6.1 Does This Justify a Strategic AI Unit?

🟡 **It justifies a "Strategic Intelligence" unit, not an "AI" unit — and that framing matters.**
- The AI layer (LLM-based trend scoring, narrative generation, chat) is Phase 3 and largely scaffolding. The core value is the probabilistic simulation engine, the expert elicitation protocol (Delphi), and the shift matrix output. These are quantitative strategy tools, not AI tools.
- **Fix:** Position PRISM as a "quantitative strategy platform" that uses AI selectively for intelligence augmentation. This is more credible and less likely to trigger the "so it's just ChatGPT?" reaction.

### 6.2 What Would Make an SVP Say "I Need This Monthly"?

Three things are missing for indispensability:

1. **Trigger alerts.** The trigger system is defined in the schema but not wired to notifications. "Alert me when any category shift exceeds -5% by 2028" would make PRISM operationally essential.

2. **Quarter-over-quarter trend tracking.** Show how shifts have changed since last quarter's run. "FCN contraction accelerated from -2.1% to -3.8% since Q1" — this creates urgency and a review cadence.

3. **Integration with the planning cycle.** The spec's "Annual Planning Cycle Integration" section (Section 4) is excellent on paper. Connect PRISM's output to actual budget allocation meetings.

### 6.3 What's Missing for Indispensable vs. Interesting

🟡 **No "what would Bain charge for this?" benchmark.** A static Bain profit pool analysis for 12 categories across 6 forces would cost €500K-€1M as an engagement. PRISM provides a living, updatable version with uncertainty quantification. Frame this in the presentation: "This is a perpetual profit pool analysis that updates in real time as evidence changes."

---

## PRIORITY FIX LIST (Before Presentation)

| Priority | Issue | Fix | Time |
|----------|-------|-----|------|
| 🔴 P0 | Fake "73% backtested accuracy" | Remove or replace with "Priors — not yet calibrated" | 30 min |
| 🔴 P0 | Spec claims Causal DAG, Game Theory, Backtesting exist | Update CLAUDE.md to match reality; prepare talking points for "what's planned vs. built" | 2 hrs |
| 🔴 P0 | Cold start timeout risk | Pre-warm Vercel function; verify Postgres cached simulation loads | 30 min |
| 🟡 P1 | R̂ shows hardcoded "1.03" fallback | Show "—" when no convergence data | 15 min |
| 🟡 P1 | No presentation/guided mode | Add a 5-step scripted walkthrough overlay | 4 hrs |
| 🟡 P1 | Attenuation factor not prominently displayed as assumption | Add "Key Assumptions" panel showing attenuation + sensitivity band | 2 hrs |
| 🟡 P1 | Source credibility tiers not visible | Add tier badges to Trend Explorer | 2 hrs |
| 🟡 P1 | Force weights/correlations labeled as "from DAG" (which doesn't exist) | Relabel as "expert-assumed" | 30 min |
| 🟡 P1 | No market sizing context | Add reference table or slide with public market sizes | 1 hr |
| 🟢 P2 | Dual frontend codebase cleanup | Remove legacy Vite app | Post-presentation |
| 🟢 P2 | QoQ shift tracking | Add delta display vs. previous simulation run | Post-presentation |
| 🟢 P2 | Trigger notification system | Wire alerts to email/Slack | Post-presentation |

---

## BOTTOM LINE

PRISM's analytical engine is legitimately good — the Bayesian MC with t-copula, the materialization curve modeling, the resource allocation optimizer, and the Delphi protocol scaffolding are all well-implemented and defensible. The problem is the narrative envelope. The spec oversells, the UI displays one fabricated metric, and the "causal" framing doesn't match the implementation.

**For the presentation: lead with intellectual honesty.**

"PRISM is a probabilistic profit pool shift simulator. It takes 61 expert-scored strategic trends, runs 10,000 Monte Carlo simulations with copula-based tail risk, and produces a Shift Matrix that tells you — with quantified uncertainty — where each category's profit pool is headed over 5 years. It doesn't predict the future. It structures our uncertainty and makes our assumptions explicit and testable."

That positioning is defensible, impressive, and honest. It's what a Bain partner would say.

---

*Review compiled from full codebase analysis: 50+ Python modules (~18,100 LOC), 31 React components, 61 trend definitions, complete API surface, and deployment configuration.*
