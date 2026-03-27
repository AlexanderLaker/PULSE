# PULSE — Profit Pool Unified Landscape Simulation Engine

## Project Specification & Architecture — v2.1

---

## 1. EXECUTIVE SUMMARY

### What This Is
PULSE is an **AI-augmented profit pool simulation engine** that transforms a static Excel-based strategic force assessment (currently V12) into a living, probabilistic, causally-structured, AI-enhanced strategic decision platform for enterprise deployment within Henkel's cloud infrastructure.

### The Core Innovation
PULSE operates on a **probabilistic profit pool shifting architecture**: the entire simulation, AI, and optimization layer works with directional scores, percentage shifts, causal propagation weights, and market intelligence to produce a **Shift Matrix** — a table of percentage impacts by category × force × time path. Users apply these shifts to their financial models in Excel or consume them directly through Power BI integration.

### What Changed in v2.0 (vs. v1.2)
This specification was elevated based on ten critical feedback dimensions that a Bain Quant team or McKinsey QuantumBlack would demand:

1. **Bayesian Hierarchical Models** replace simplistic triangular distributions — posteriors update as evidence arrives
2. **Copula-Based Dependency Structures** replace flat correlation coefficients — tail risk is modeled properly
3. **Backtesting moved to Phase 0** — the model earns credibility before it makes predictions
4. **Causal DAG** replaces independent force channels — shocks propagate through directed causal paths
5. **Game Theory Layer** models competitive responses — profit pools shift partly because competitors act
6. **Resource Allocation Optimizer** turns analysis into decision support — "here's where to invest"
7. **Organizational Embedding Framework** — RACI, decision rights, planning cycle integration
8. **Continuous Path Modeling** replaces 2 discrete time horizons — velocity matters, early-warning triggers included
9. **Formal Delphi Expert Elicitation Protocol** — structured scoring with calibration and debiasing
10. **War Room UX** replaces 8 separate pages — one screen tells the story, drill-down on demand

### Design Philosophy
1. **Enterprise-grade security** — deployed within Henkel's corporate cloud environment with standard enterprise security controls
2. **AI augments human judgment, never replaces it** — every AI suggestion requires human review
3. **Excel as interface, Python as engine** — meet users where they are
4. **Bayesian > point estimates** — learn uncertainty from data, don't assume it
5. **Causal > correlational** — model how forces propagate, not just that they're correlated
6. **Incrementally valuable** — each phase delivers standalone value
7. **Analysis → Decision** — every output answers "so what should we do?"
8. **LLM-provider agnostic** — MVP uses Claude API for fastest iteration. Production deployment swaps to Azure OpenAI inside Henkel's Microsoft tenant via config change — zero additional InfoSec approval (rides on existing Copilot approval). The provider-agnostic interface (LLMProvider ABC) ensures switching is a one-line config change, not a code change.
9. **Power BI as financial lens** — PULSE outputs relative shifts only. Power BI consumes the Shift Matrix and applies it to actual financials. One-directional data flow. PULSE never sees €M figures. The React dashboard serves the strategy team (relative %, interactive, broad access). The Power BI dashboard serves ExCo/Finance (€M denomination, restricted access). Same truth, two lenses.

---

## 2. CLOUD DEPLOYMENT & INTEGRATION

### Hosting Architecture
PULSE is deployed within Henkel's corporate cloud environment with standard enterprise security, identity management, and data governance controls. All data processing, storage, and API services operate under Henkel's information security policies.

### The Shift Matrix Interface

PULSE outputs a primary artifact — the **Shift Matrix** — a JSON/CSV table with **continuous path data**:

```json
{
  "generated": "2026-03-26T14:30:00",
  "scenario": "Base Case",
  "confidence": "80% CI",
  "model_version": "bayesian_copula_v1",
  "backtesting_accuracy": 0.73,
  "shifts": {
    "Hair: Color": {
      "path": {
        "2026": { "median": -0.003, "p10": -0.001, "p25": -0.002, "p75": -0.005, "p90": -0.008 },
        "2027": { "median": -0.008, "p10": -0.003, "p25": -0.005, "p75": -0.013, "p90": -0.019 },
        "2028": { "median": -0.014, "p10": -0.006, "p25": -0.009, "p75": -0.022, "p90": -0.031 },
        "2029": { "median": -0.023, "p10": -0.010, "p25": -0.015, "p75": -0.035, "p90": -0.048 },
        "2030": { "median": -0.032, "p10": -0.015, "p25": -0.022, "p75": -0.048, "p90": -0.065 }
      },
      "velocity": { "2027": -0.005, "2028": -0.006, "2029": -0.009, "2030": -0.009 },
      "triggers": [
        { "condition": "shift_exceeds_-0.02_by_2027", "alert": "Initiate Color portfolio review" }
      ]
    }
  },
  "causal_decomposition": {
    "Hair: Color": {
      "direct_effects": { "Consumer": -0.018, "Government": -0.008, "Technology": 0.005 },
      "propagated_effects": { "Government→Technology": -0.004, "Consumer→Customer": -0.007 }
    }
  },
  "allocation_recommendation": {
    "invest_more": ["Hair: Care", "LHC: ADW"],
    "defend": ["LHC: FCN", "Hair: Color"],
    "harvest": ["LHC: IC"],
    "rationale": "Shift defensive R&D budget from IC (+2.1% pool growth) to FCN (-4.8% contraction)..."
  }
}
```

Users apply these shifts to their financial models:
```
GP1_projected = GP1_actual × (1 + shift_median)
GP1_bear_case = GP1_actual × (1 + shift_p90)
GP1_bull_case = GP1_actual × (1 + shift_p10)
```

### Power BI Integration

PULSE's Shift Matrix integrates with Power BI for financial impact visualization. The Shift Matrix contains category names, scenario labels, time horizons, and percentage values (typically -1.0 to +1.0). Power BI applies these shifts to actual financial data using DAX formulas: `GP1_Projected = [GP1_Actual] * (1 + [shift_median])`

The React War Room dashboard serves the strategy team with interactive, relative-percentage analysis. The Power BI dashboard serves ExCo and Finance with absolute financial impact (€M) analysis. Both consume the same underlying Shift Matrix, presenting the same truth through different analytical lenses.

---

## 3. SYSTEM ARCHITECTURE

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    USER'S LOCAL MACHINE                                   │
│                                                                           │
│  ┌──────────────┐     ┌───────────────────────────────────────────────┐  │
│  │  Excel V12+  │◄────┤  SHIFT MATRIX (CSV/JSON)                      │  │
│  │  (Financials │     │  % shifts by category × force × year path     │  │
│  │   stay here) │     │  + causal decomposition                       │  │
│  └──────────────┘     │  + allocation recommendations                 │  │
│                        └────────────────────┬──────────────────────────┘  │
│                                             │                             │
│  ┌──────────────────────────────────────────┴──────────────────────────┐  │
│  │              PULSE ENGINE (Python, runs locally)                     │  │
│  │                                                                      │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────┐  ┌─────────────┐  │  │
│  │  │  INGESTION   │  │  SIMULATION  │  │  CAUSAL  │  │   AI LAYER  │  │  │
│  │  │  MODULE      │  │  ENGINE      │  │  DAG     │  │  (Optional) │  │  │
│  │  │              │  │              │  │          │  │             │  │  │
│  │  │ • Read V12   │  │ • Bayesian   │  │ • Force  │  │ • Scanner   │  │  │
│  │  │ • Parse      │  │   Hierarchic │  │   inter- │  │ • Calibrate │  │  │
│  │  │ • Validate   │  │ • Copula MC  │  │   depend │  │ • Narrate   │  │  │
│  │  │ • Backtest   │  │ • Continuous │  │ • Shock  │  │ • NL Chat   │  │  │
│  │  │   data       │  │   paths      │  │   propag │  │ • Delphi    │  │  │
│  │  └──────┬───────┘  └──────┬───────┘  └────┬─────┘  └──────┬──────┘  │  │
│  │         │                 │                │               │         │  │
│  │         ▼                 ▼                ▼               ▼         │  │
│  │  ┌──────────────────────────────────────────────────────────────┐   │  │
│  │  │         ┌─────────────┐     ┌──────────────┐                │   │  │
│  │  │         │  OPTIMIZER  │     │  GAME THEORY │                │   │  │
│  │  │         │  Resource   │     │  Competitive │                │   │  │
│  │  │         │  Allocation │     │  Response    │                │   │  │
│  │  │         └──────┬──────┘     └──────┬───────┘                │   │  │
│  │  │                │                   │                         │   │  │
│  │  │  ┌─────────────┴───────────────────┴─────────────────────┐  │   │  │
│  │  │  │              LOCAL DATA STORE (SQLite)                 │  │   │  │
│  │  │  │  trends, scores, simulations, causal weights, backtest│  │   │  │
│  │  │  │  Schema-enforced data validation and integrity         │  │   │  │
│  │  │  └───────────────────────────────────────────────────────┘  │   │  │
│  │  └──────────────────────────────────────────────────────────────┘   │  │
│  │                                                                      │  │
│  │  ┌──────────────────────────────────────────────────────────────┐   │  │
│  │  │              WAR ROOM DASHBOARD (React)                      │   │  │
│  │  │  Single unified view with contextual drill-down              │   │  │
│  │  │  Served locally: http://localhost:3000                       │   │  │
│  │  └──────────────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

**Additional Architecture Notes (v2.1):**
- AI Layer uses provider-agnostic LLMProvider interface: MVP → Claude API, Production → Azure OpenAI (Henkel tenant)
- Power BI consumes Shift Matrix downstream (one-way, read-only) for €M financial application
- Two-audience model: React dashboard (strategy team, relative %) + Power BI (ExCo/Finance, €M)

### 3.2 Module Breakdown

#### Module 1: INGESTION (`pulse/ingestion/`)
**Purpose:** Read V12 Excel, extract force assessment data, validate, and structure. Ingest historical versions for backtesting.

**Key Design Decisions:**
- Reads sheets: `1_Consumer` through `6_Competitive`, `Config`, `Helper`, `EM_Input` (market-level data)
- Parses and validates force assessments, trend scores, category exposures
- Integrates historical versions (V1-V11) for backtesting and parameter calibration
- Outputs a structured `TrendDatabase` object with all trends and metadata

**Data Model:**
```python
@dataclass
class Trend:
    id: str                          # e.g., "consumer_01"
    force: str                       # e.g., "Consumer"
    sub_category: str                # e.g., "Trends"
    name: str                        # e.g., "Natural / Clean Beauty Movement"
    description: str                 # Evidence text
    direction: str                   # "Expansion" | "Contraction"
    impact: int                      # 1-5 (expert-scored via Delphi)
    probability: int                 # 1-5 (expert-scored via Delphi)
    start_year: int                  # Year effect begins
    weighted_score: float            # impact × probability × direction_sign
    normalized_score: float          # weighted_score / 25
    strategic_implication: str       # Action text
    category_exposure: dict[str, int]  # {"Color": 3, "Care": 3, ...}
    vc_exposure: dict[str, int]      # {"Raw Materials": 2, ...}
    data_source: str
    source_type: str
    confidence: str                  # "High" | "Medium" | "Low"
    last_updated: datetime
    ai_suggested: bool
    user_override: bool
    # Delphi metadata
    scorer_count: int                # Number of experts who scored
    score_variance: float            # Inter-rater variance
    debiasing_applied: bool          # Whether anchoring correction was applied
    # Bayesian posterior
    impact_posterior: tuple           # (alpha, beta) for Beta distribution
    probability_posterior: tuple      # (alpha, beta) for Beta distribution

@dataclass
class ModelConfig:
    region: str
    aggregation_method: str          # "Multiplicative"
    attenuation: float               # Empirically derived from backtesting (default 0.5, calibrated)
    neutral_threshold: float         # 0.001
    base_year: int                   # 2025
    path_years: list[int]            # [2026, 2027, 2028, 2029, 2030]
    maturity_schedule: dict          # Year → materialization fraction
    force_weights: dict[str, float]  # 6 forces → weights summing to 1.0
    vc_weights: dict[str, float]     # 8 VC steps → weights summing to 1.0
    category_names: list[str]        # 13 category names
    backtesting_accuracy: float      # Derived from Phase 0 calibration

@dataclass
class CausalEdge:
    source_force: str                # e.g., "Government"
    target_force: str                # e.g., "Technology"
    propagation_weight: float        # 0.0 to 1.0
    lag_years: int                   # 0, 1, or 2
    mechanism: str                   # e.g., "Regulation triggers reformulation R&D"
    evidence_strength: str           # "Strong" | "Moderate" | "Weak"
```

#### Module 2: SIMULATION ENGINE (`pulse/simulation/`)
**Purpose:** Run probabilistic simulations using Bayesian hierarchical models with copula dependencies and causal propagation.

**2a. Deterministic Engine** (V12 parity — trust anchor)
- Reproduces V12 multiplicative compounding exactly: `GP1_shift% = Π(1 + F_i% × attenuation) - 1`
- Validates against V12 output to ensure parity
- Users can verify PULSE matches their Excel before trusting probabilistic outputs

**2b. Bayesian Monte Carlo Engine** (the core upgrade)

The fundamental shift from v1.2: instead of assuming distribution shapes (triangular), we **learn** them.

**Prior specification:**
```python
# Each trend's impact/probability has a prior, updated with evidence
# Prior: Beta(α₀, β₀) where α₀, β₀ are set from historical calibration
# When backtesting data exists: posterior = Beta(α₀ + successes, β₀ + failures)
# When no backtesting data: weakly informative prior Beta(2, 2)

class BayesianTrendModel:
    def __init__(self, trend, backtest_data=None):
        if backtest_data:
            # Empirically calibrated from historical prediction accuracy
            self.impact_dist = Beta(
                alpha=backtest_data.impact_hits + 2,
                beta=backtest_data.impact_misses + 2
            )
            self.prob_dist = Beta(
                alpha=backtest_data.prob_hits + 2,
                beta=backtest_data.prob_misses + 2
            )
        else:
            # Weakly informative prior centered on expert score
            self.impact_dist = Beta(
                alpha=trend.impact,
                beta=5 - trend.impact + 1
            )
            self.prob_dist = Beta(
                alpha=trend.probability,
                beta=5 - trend.probability + 1
            )
```

**Copula-based dependency structure:**
Instead of flat correlation coefficients (ρ=0.3 within-force), use a **Gaussian copula with t-copula tails**:

```python
# Why copulas matter: linear correlation underestimates tail dependence.
# When things go wrong, they go wrong together — a t-copula with low
# degrees of freedom captures this "crisis correlation" effect.

class CopulaDependencyModel:
    """
    Models joint distribution of trend impacts using copulas.

    Within-force: Gaussian copula (normal times correlation)
    Cross-force: t-copula with ν=4 df (captures tail dependence in crises)

    The correlation matrix is structured:
    - Within-force pairs: ρ calibrated from backtest (default 0.3)
    - Cross-force pairs connected by causal DAG: ρ from DAG weight
    - Cross-force pairs without causal link: ρ = 0.05 (residual macro)
    """
    def __init__(self, causal_dag, backtest_calibration=None):
        self.within_force_rho = backtest_calibration.within_rho if backtest_calibration else 0.3
        self.t_copula_df = 4  # Low df = heavier tails = crisis correlation
        self.causal_dag = causal_dag

    def build_correlation_matrix(self, trends):
        """Build correlation matrix from causal DAG + backtest data."""
        n = len(trends)
        R = np.eye(n)
        for i, j in combinations(range(n), 2):
            if trends[i].force == trends[j].force:
                R[i, j] = R[j, i] = self.within_force_rho
            else:
                dag_weight = self.causal_dag.get_propagation_weight(
                    trends[i].force, trends[j].force
                )
                R[i, j] = R[j, i] = max(dag_weight * 0.5, 0.05)
        return R
```

**Simulation parameters:**
- Default: 10,000 iterations (configurable to 50,000 for final runs)
- Output: posterior predictive distribution of GP1 shift % per category per year
- Convergence: Gelman-Rubin R̂ < 1.05 for all parameters
- **Continuous paths**: interpolates between annual points using S-curve materialization

**2c. Continuous Path Engine**

Instead of two discrete points (2028, 2030), model the **trajectory**:

```python
class ContinuousPathModel:
    """
    Models shift paths from base_year to long_term_year with annual granularity.

    Key insight: a -5% shift over 4 years gradually is strategically different
    from -5% in a single year due to regulatory shock. Path dynamics enable:
    - Velocity tracking (rate of change)
    - Acceleration detection (change in rate of change)
    - Early-warning triggers ("if shift exceeds X by year Y, alert")
    - Path-dependent strategy (different responses to fast vs slow shifts)
    """

    def __init__(self, config):
        self.base_year = config.base_year  # 2025
        self.path_years = config.path_years  # [2026..2030]

        # Materialization schedule: what fraction of the full impact
        # has materialized by each year (S-curve by default)
        self.materialization = {
            2026: 0.10,  # Early signal only
            2027: 0.25,  # Building momentum
            2028: 0.50,  # V12's "mid-term" — half materialized
            2029: 0.75,  # Approaching full
            2030: 1.00,  # V12's "long-term" — full effect
        }

    def compute_path(self, trend, mc_sample):
        """Given a single MC draw, compute the full path."""
        full_effect = mc_sample  # The sampled total impact at 2030
        path = {}
        for year in self.path_years:
            frac = self.materialization[year]
            # Trend-specific acceleration: regulatory trends front-load,
            # technology trends back-load
            if trend.force == "Government":
                frac = self._regulatory_curve(frac)  # Step-function-like
            elif trend.force == "Technology":
                frac = self._tech_adoption_curve(frac)  # S-curve
            path[year] = full_effect * frac
        return path

    def compute_velocity(self, path):
        """Year-over-year rate of change."""
        years = sorted(path.keys())
        return {y: path[y] - path[years[i-1]] for i, y in enumerate(years) if i > 0}

    def check_triggers(self, path, triggers):
        """Evaluate early-warning trigger conditions against path."""
        alerts = []
        for trigger in triggers:
            year_val = path.get(trigger.year)
            if year_val and abs(year_val) >= abs(trigger.threshold):
                alerts.append(TriggerAlert(trigger, year_val))
        return alerts
```

**2d. Scenario Engine**

Pre-defined scenarios now use **causal propagation** instead of independent force shocks:

- **Base Case**: Current scores, causal DAG active, no external shocks
- **Green Squeeze**: Initial shock to Environmental force → propagates via DAG to Government (+reformulation costs), Technology (+capex), Customer (+shelf price), Consumer (+willingness to pay premium)
- **Tech Disruption**: Initial shock to Technology force → propagates to Consumer (adoption curve), Competitive (first-mover advantage), Customer (channel shift)
- **Price War**: Initial shock to Competitive force → propagates to Customer (margin pressure), Consumer (trading down)
- **Regulatory Cascade**: Initial shock to Government → propagates through DAG with proper lag structure
- **Perfect Storm**: Correlated tail event — t-copula at 1st percentile (much more realistic than "all forces at +1σ")
- Custom scenario builder: user shocks specific force, DAG propagates the rest

**2e. Sensitivity Engine**
- Tornado: which trend has highest leverage on total shift?
- Break-even: what score change makes a category neutral?
- Force elimination: what happens if we remove an entire force?
- Causal path sensitivity: which DAG edge matters most?
- Attenuation sensitivity: backtested vs. assumed values
- Copula sensitivity: how much does tail dependence change the p90?

#### Module 3: CAUSAL DAG (`pulse/causal/`)
**Purpose:** Model directed causal relationships between forces, enabling shock propagation and structural scenario analysis.

```python
# The 6 forces are NOT independent channels — they're causally linked.
# EU regulation (Government) → reformulation costs (Technology) →
# shelf price change (Customer) → consumer behavior shift (Consumer)

CAUSAL_DAG = {
    "edges": [
        # Government → others
        {"from": "Government", "to": "Technology",
         "weight": 0.6, "lag": 1, "mechanism": "Regulation triggers reformulation R&D spend"},
        {"from": "Government", "to": "Customer",
         "weight": 0.4, "lag": 1, "mechanism": "Compliance costs pass through to shelf price"},
        {"from": "Government", "to": "Environmental",
         "weight": 0.3, "lag": 0, "mechanism": "Environmental regulation codifies green trends"},

        # Consumer → others
        {"from": "Consumer", "to": "Customer",
         "weight": 0.5, "lag": 0, "mechanism": "Demand shifts force channel adaptation"},
        {"from": "Consumer", "to": "Competitive",
         "weight": 0.4, "lag": 1, "mechanism": "Consumer preferences drive competitive positioning"},
        {"from": "Consumer", "to": "Technology",
         "weight": 0.3, "lag": 1, "mechanism": "Consumer demand pulls innovation investment"},

        # Technology → others
        {"from": "Technology", "to": "Consumer",
         "weight": 0.4, "lag": 1, "mechanism": "New tech enables new consumer behaviors"},
        {"from": "Technology", "to": "Competitive",
         "weight": 0.5, "lag": 1, "mechanism": "Tech adoption creates competitive gaps"},
        {"from": "Technology", "to": "Customer",
         "weight": 0.3, "lag": 0, "mechanism": "Tech changes channel economics"},

        # Environmental → others
        {"from": "Environmental", "to": "Government",
         "weight": 0.6, "lag": 1, "mechanism": "Environmental crises accelerate regulation"},
        {"from": "Environmental", "to": "Consumer",
         "weight": 0.4, "lag": 0, "mechanism": "Climate awareness shifts purchase behavior"},
        {"from": "Environmental", "to": "Technology",
         "weight": 0.3, "lag": 1, "mechanism": "Environmental pressure drives green innovation"},

        # Customer → others
        {"from": "Customer", "to": "Competitive",
         "weight": 0.5, "lag": 0, "mechanism": "Channel power shifts competitive dynamics"},
        {"from": "Customer", "to": "Consumer",
         "weight": 0.3, "lag": 0, "mechanism": "Channel availability shapes consumer access"},

        # Competitive → others
        {"from": "Competitive", "to": "Customer",
         "weight": 0.4, "lag": 0, "mechanism": "Competitive moves change channel bargaining"},
        {"from": "Competitive", "to": "Consumer",
         "weight": 0.3, "lag": 1, "mechanism": "Competitive innovation shapes consumer expectations"},
    ]
}

class CausalDAG:
    """
    Directed Acyclic Graph modeling causal propagation between forces.

    Key capability: Instead of "wiggle all inputs and combine," we can
    "shock one node and watch it propagate." A regulatory shock has a
    specific propagation signature different from a technology shock.
    """

    def __init__(self, edges, lag_handling="cumulative"):
        self.edges = edges
        self.adjacency = self._build_adjacency()

    def propagate_shock(self, shocked_force, shock_magnitude, years_forward=5):
        """
        Propagate a shock through the DAG with lag structure.
        Returns: dict of {force: {year: propagated_impact}}
        """
        impacts = {f: {y: 0.0 for y in range(years_forward)} for f in FORCES}
        impacts[shocked_force][0] = shock_magnitude

        for year in range(years_forward):
            for edge in self.edges:
                source_impact = impacts[edge["from"]].get(year - edge["lag"], 0)
                if source_impact != 0:
                    propagated = source_impact * edge["weight"]
                    impacts[edge["to"]][year] += propagated

        return impacts

    def get_propagation_signature(self, shocked_force):
        """
        What does the propagation pattern look like when this force is shocked?
        Returns a normalized signature useful for scenario fingerprinting.
        """
        raw = self.propagate_shock(shocked_force, 1.0)
        total = sum(abs(v) for f in raw for v in raw[f].values())
        return {f: sum(raw[f].values()) / total for f in raw}
```

#### Module 4: GAME THEORY LAYER (`pulse/game_theory/`)
**Purpose:** Model competitive responses to profit pool shifts.

```python
class CompetitiveResponseModel:
    """
    Simplified game-theoretic layer modeling top competitor responses.

    For top 3-5 competitors: what are their likely strategic responses
    to each scenario, and how does that second-order effect change the pool?

    This is the difference between "the market shifts" and "our position
    within the shifting market."

    All inputs are relative (market intelligence, public strategy signals).
    NO competitor financials enter the model.
    """

    COMPETITORS = {
        "pg": {
            "name": "P&G",
            "archetype": "premium_defender",
            "hair_exposure": 0.8,
            "lhc_exposure": 0.9,
            "response_speed": "fast",
            "typical_responses": {
                "price_war": "defend_with_innovation",
                "regulation": "lobby_and_comply_early",
                "tech_disruption": "fast_follower",
                "private_label": "premiumize_further",
            }
        },
        "unilever": {
            "name": "Unilever",
            "archetype": "sustainability_leader",
            "hair_exposure": 0.7,
            "lhc_exposure": 0.8,
            "response_speed": "medium",
            "typical_responses": {
                "price_war": "portfolio_rationalization",
                "regulation": "lead_compliance",
                "tech_disruption": "acquire",
                "private_label": "value_tier_launch",
            }
        },
        "reckitt": {
            "name": "Reckitt",
            "archetype": "hygiene_specialist",
            "hair_exposure": 0.2,
            "lhc_exposure": 0.9,
            "response_speed": "medium",
            "typical_responses": {
                "price_war": "defend_core_categories",
                "regulation": "comply_minimum",
                "tech_disruption": "selective_adoption",
                "private_label": "innovation_premiumization",
            }
        }
    }

    def estimate_competitive_response(self, scenario, category):
        """
        Given a scenario's shift profile, estimate how competitors react
        and what the second-order impact is on the profit pool.

        Returns: additional % shift from competitive dynamics (relative only)
        """
        # Response archetypes affect pool differently:
        # "premiumize_further" → pool expands (everyone trades up)
        # "price_war" → pool contracts (margin destruction)
        # "value_tier_launch" → mixed (volume up, margin down)
        pass

    def competitive_equilibrium(self, base_shifts, iterations=100):
        """
        Iterative Nash-like equilibrium: each competitor responds to
        the current shift profile, their responses change the profile,
        repeat until stable.

        Returns: equilibrium shift profile (converges in ~5-10 iterations)
        """
        pass
```

#### Module 5: RESOURCE ALLOCATION OPTIMIZER (`pulse/optimizer/`)
**Purpose:** Turn shift analysis into actionable investment recommendations.

```python
class ResourceAllocationOptimizer:
    """
    Given projected pool shifts across 13 categories, optimize the
    relative category investment mix to maximize risk-adjusted pool capture.

    CRITICAL: Works entirely in relative terms — "invest X% more in Care
    vs. Color" — never in absolute €M. The user applies the relative
    weights to their actual budget in Excel.

    Optimization objective:
        max Σ_c (w_c × expected_pool_shift_c) - λ × Σ_c (w_c² × variance_c)

    Subject to:
        Σ w_c = 1 (weights sum to 100%)
        w_c_min ≤ w_c ≤ w_c_max (min/max allocation constraints)
        turnover ≤ T (can't shift >T% from current allocation in one cycle)

    Where:
        w_c = allocation weight for category c
        λ = risk aversion parameter (user-configurable)
        expected_pool_shift_c = median shift from Monte Carlo
        variance_c = shift variance from Monte Carlo
    """

    def optimize(self, shift_matrix, constraints, risk_aversion=1.0):
        """
        Returns relative allocation weights (sum to 1.0).
        NOT absolute €M — just proportional recommendations.
        """
        from scipy.optimize import minimize

        categories = list(shift_matrix.keys())
        n = len(categories)

        # Expected returns (median shifts)
        mu = np.array([shift_matrix[c]["2030"]["median"] for c in categories])

        # Covariance from MC samples
        cov = self._compute_covariance_from_mc(shift_matrix)

        def neg_utility(w):
            ret = w @ mu
            risk = risk_aversion * w @ cov @ w
            return -(ret - risk)

        # Constraints
        cons = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}]
        bounds = [(constraints.get(c, {}).get("min", 0.02),
                   constraints.get(c, {}).get("max", 0.25)) for c in categories]

        result = minimize(neg_utility, np.ones(n)/n, bounds=bounds, constraints=cons)
        return {c: result.x[i] for i, c in enumerate(categories)}
```

#### Module 6: BACKTESTING ENGINE (`pulse/backtesting/`)
**Purpose:** Calibrate model parameters from historical data. This is Phase 0 — runs before any prediction is made.

```python
class BacktestingEngine:
    """
    Phase 0: The model earns credibility before it makes predictions.

    If V1 through V11 exist with historical assessments, and we know
    actual category-level market evolution (public Euromonitor data or
    EM_Input from those periods), we can ask:

    "If we'd run PULSE with 2020's assessments, would it have predicted
    the market shifts we actually saw by 2024?"

    This calibration determines:
    1. The attenuation factor (currently assumed 0.5 — should be derived)
    2. The correct distribution shapes (not assumed triangular)
    3. The correlation structure (not assumed flat)
    4. The causal DAG weights (not assumed — fitted to data)
    5. Overall model accuracy score (for ExCo credibility)

    NOTE: Backtesting uses ONLY relative market-level data (total market
    growth rates from EM_Input or public sources). Never company financials.
    """

    def __init__(self, historical_versions, actual_market_shifts):
        self.versions = historical_versions  # V1-V11 trend scores
        self.actuals = actual_market_shifts   # Public market data

    def calibrate_attenuation(self):
        """
        Find the attenuation factor that minimizes prediction error
        across all historical versions.

        Returns: optimal attenuation (float) and confidence interval
        """
        pass

    def calibrate_distributions(self):
        """
        Determine which distribution family best fits historical
        prediction errors (Beta, LogNormal, Truncated Normal, etc.)

        Returns: distribution family + fitted parameters per force
        """
        pass

    def calibrate_dag_weights(self):
        """
        Fit causal propagation weights to historical data using
        Granger-causality-like tests on force-level shift time series.
        """
        pass

    def compute_accuracy_score(self):
        """
        Overall model accuracy: weighted average of per-category
        prediction accuracy across all historical periods.

        Reported as: "PULSE predicted X% of historical shifts within
        the 80% confidence interval."
        """
        pass

    def generate_calibration_report(self):
        """
        Markdown report suitable for ExCo presentation showing:
        - Historical prediction accuracy
        - Calibrated vs. assumed parameters
        - Confidence in current predictions based on track record
        """
        pass
```

#### Module 7: DELPHI EXPERT ELICITATION (`pulse/elicitation/`)
**Purpose:** Structured scoring protocol with calibration and debiasing.

```python
class DelphiProtocol:
    """
    Formal expert elicitation process replacing unstructured 1-5 scoring.

    The Delphi method ensures:
    1. Structured scoring workshops with calibration exercises
    2. Inter-rater reliability measurement
    3. Anchoring/debiasing protocols
    4. Documented rationale per score
    5. Convergence through iterative rounds

    Flow:
    Round 1: Independent scoring (blind) → collect scores + rationale
    Round 2: Share anonymized distribution → re-score with group context
    Round 3: Discussion of outliers → final scores

    Between rounds: calibration questions to detect systematic biases
    """

    def __init__(self, trends, scorers):
        self.trends = trends
        self.scorers = scorers
        self.rounds = []

    def calibration_exercise(self, scorer):
        """
        Present known-outcome historical trends to detect bias.
        E.g., "In 2020, how would you have scored 'E-commerce acceleration'?"
        Compare their score to what actually happened → calibration factor.
        """
        pass

    def detect_anchoring_bias(self, scores_round1, scores_round2):
        """
        If scores barely move between rounds despite new information,
        anchoring bias is present. Flag for discussion.
        """
        pass

    def detect_optimism_bias(self, scorer_history):
        """
        If a scorer systematically underestimates contraction forces
        and overestimates expansion, apply correction factor.
        """
        pass

    def inter_rater_reliability(self, round_scores):
        """
        Krippendorff's alpha across all scorers.
        α > 0.8: excellent agreement
        α 0.67-0.8: acceptable
        α < 0.67: poor — needs another round
        """
        pass

    def consensus_score(self, all_round_scores):
        """
        Final score = weighted median of final-round scores,
        weighted by each scorer's calibration accuracy.
        """
        pass
```

#### Module 8: WEB DASHBOARD — WAR ROOM (`pulse/dashboard/`)
**Purpose:** Single unified analytical view with contextual drill-down. Apple-sleek, executive-grade.

**Tech stack:** React 18 + Vite + Recharts/D3 + TailwindCSS + Framer Motion
**Served at:** `http://localhost:3000`

**UX Philosophy: The War Room**

McKinsey's best digital tools converge on a "single war room view" — one screen that tells the story. You drill into depth only when needed. Eight separate tabs forces executive users to navigate and mentally stitch together a narrative. Instead:

**THE WAR ROOM (Single Page Application with Contextual Panels)**

```
┌──────────────────────────────────────────────────────────────────┐
│  PULSE War Room                              [Settings] [Export] │
│                                                                  │
│  ┌─── HEADLINE KPI ─────────────────────────────────────────┐   │
│  │  Net Pool Shift: -3.1%  (80% CI: -1.5% to -5.5%)       │   │
│  │  Model Accuracy: 73% (backtested V1-V11)                │   │
│  │  Path Velocity: Accelerating ↓                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─── LEFT: FORCE × CATEGORY HEATMAP ────────────────────────┐ │
│  │                                                             │ │
│  │  13 categories × 6 forces, color-coded by shift magnitude  │ │
│  │  Click any cell → right panel shows detail                  │ │
│  │  Animated causal flow lines show DAG propagation            │ │
│  │                                                             │ │
│  │  [Toggle: Direct Effects | With Propagation | Competitive] │ │
│  │                                                             │ │
│  ├─── BOTTOM: PATH TIMELINE ─────────────────────────────────┤ │
│  │                                                             │ │
│  │  2025 ──── 2026 ──── 2027 ──── 2028 ──── 2029 ──── 2030  │ │
│  │  Shift path with confidence bands for selected category     │ │
│  │  Velocity indicator + trigger markers                       │ │
│  │  [Scenario toggle: Base | Green | Tech | Custom]           │ │
│  │                                                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─── RIGHT: CONTEXTUAL PANEL (slides in) ──────────────────┐  │
│  │  Content changes based on what user clicks:                │  │
│  │  • Cell click → Trend drill-down with Bayesian posterior   │  │
│  │  • Force click → Causal propagation waterfall              │  │
│  │  • Category click → Allocation recommendation              │  │
│  │  • KPI click → Monte Carlo distribution + tornado          │  │
│  │  • Path click → Velocity analysis + trigger status         │  │
│  │  [Pin] [Fullscreen] [Export]                               │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─── BOTTOM BAR: AI INSIGHTS ──────────────────────────────┐  │
│  │  "3 new signals detected" | "FCN trigger breached" | Chat │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Contextual Drill-Down Panels (replace separate pages):**

1. **Monte Carlo Panel**: Appears when clicking KPI headline — violin plots, convergence, posterior distributions
2. **Sensitivity Panel**: Appears when clicking any force — interactive tornado, weight sliders, attenuation dial
3. **Scenario Panel**: Appears when toggling scenario — side-by-side comparison, causal propagation waterfall, competitive response overlay
4. **Trend Panel**: Appears when clicking a heatmap cell — all trends for that force×category intersection, AI suggestions, Delphi scores
5. **Allocation Panel**: Appears when clicking a category header — optimizer recommendation, current vs. recommended weights, risk-return frontier
6. **Causal Panel**: Appears when clicking a force header — DAG visualization, shock propagation animation, lag timeline
7. **AI Chat**: Slide-up panel from bottom bar — natural language queries about the model
8. **Export Center**: Settings gear → export Shift Matrix, PowerPoint, PDF, Excel

**Apple-Like Design Principles:**
- **Hierarchy through space, not borders** — generous whitespace, no heavy dividers
- **Motion with purpose** — Framer Motion for panel transitions, hover reveals, path animations
- **Progressive disclosure** — show the story first, details on demand
- **Dark mode default** with option for light — `#0F172A` base
- **SF Pro-inspired typography** — Inter for UI, JetBrains Mono for data
- **60fps animations** — all transitions butter-smooth
- **Glassmorphism panels** — subtle blur backgrounds for overlays
- **Micro-interactions** — hover states, focus rings, loading shimmer

#### Module 9: EXCEL BRIDGE (`pulse/excel_bridge/`)
**Purpose:** Bidirectional integration between PULSE and Excel for trend input and output.

**9a. Import from Excel** (`reader.py`)
- Reads V12.xlsx sheets (trends, scores, category/VC exposures)
- Validates data structure and score ranges
- Detects structural changes and adapts
- Import report: "Imported 60 trends, 13 categories, 6 forces. ✓ Complete."

**9b. Export to Excel** (`writer.py`)
- Writes Shift Matrix with continuous paths to Excel
- Format: Category × Year × Percentile (all in % shifts)
- Includes formulas referencing user's financial cells:
  ```excel
  =Input!D22 * (1 + ShiftMatrix!B2)   // GP1_today × (1 + shift%)
  ```
- User only needs to point the formula to their actual GP1 cell
- **New in v2.0**: Allocation recommendation sheet (relative weights only)
- **New in v2.0**: Causal decomposition sheet (which forces drive which categories)

**9c. Template Generator** (`template.py`)
- PULSE Output Excel template with:
  - Shift Matrix sheet (continuous paths, all percentiles)
  - Application sheet (user enters their GP1, formulas auto-calculate)
  - Allocation sheet (relative investment weights per category)
  - Scenario comparison sheet
  - Causal decomposition sheet
  - Dashboard sheet (charts auto-generated from applied shifts)

#### Module 10: AI LAYER (`pulse/ai/`)
**Purpose:** AI-augmented trend intelligence and narrative generation.

**Provider-Agnostic Architecture:**

```python
from abc import ABC, abstractmethod

class LLMProvider(ABC):
    """Abstract interface for LLM providers — ensures zero code changes when swapping providers."""

    @abstractmethod
    def score_trend(self, trend_description: str) -> dict:
        """Suggest impact & probability scores for a trend."""
        pass

    @abstractmethod
    def generate_narrative(self, shift_matrix: dict) -> str:
        """Convert Shift Matrix (% only) to executive summary."""
        pass

    @abstractmethod
    def calibrate_debiases(self, scores: list[int], round_num: int) -> list[int]:
        """Apply debiasing logic (anchoring correction, recency adjustment)."""
        pass

class ClaudeProvider(LLMProvider):
    """MVP: Cloud-based Claude API via Anthropic."""
    def __init__(self, api_key: str):
        from anthropic import Anthropic
        self.client = Anthropic(api_key=api_key)

    def score_trend(self, trend_description: str) -> dict:
        prompt = f"Rate this trend (1-5 impact, 1-5 probability):\n{trend_description}"
        response = self.client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}]
        )
        # Parse and return {impact: int, probability: int}
        pass

class AzureOpenAIProvider(LLMProvider):
    """Production: Azure OpenAI inside Henkel's Microsoft tenant."""
    def __init__(self, endpoint: str, api_key: str, deployment_id: str):
        from openai import AzureOpenAI
        self.client = AzureOpenAI(
            api_version="2024-02-15-preview",
            azure_endpoint=endpoint,
            api_key=api_key
        )
        self.deployment_id = deployment_id

    def score_trend(self, trend_description: str) -> dict:
        prompt = f"Rate this trend (1-5 impact, 1-5 probability):\n{trend_description}"
        response = self.client.chat.completions.create(
            deployment_id=self.deployment_id,
            model="gpt-4-turbo",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}]
        )
        # Parse and return {impact: int, probability: int}
        pass

# Configuration (loaded from environment or config file)
AI_CONFIG = {
    "provider": "azure",  # or "claude" for MVP
    "claude": {
        "api_key": "${ANTHROPIC_API_KEY}",  # environment variable
    },
    "azure": {
        "endpoint": "${AZURE_OPENAI_ENDPOINT}",
        "api_key": "${AZURE_OPENAI_KEY}",
        "deployment_id": "pulse-gpt4",
    }
}

# Factory function
def get_llm_provider() -> LLMProvider:
    if AI_CONFIG["provider"] == "claude":
        return ClaudeProvider(api_key=AI_CONFIG["claude"]["api_key"])
    elif AI_CONFIG["provider"] == "azure":
        return AzureOpenAIProvider(
            endpoint=AI_CONFIG["azure"]["endpoint"],
            api_key=AI_CONFIG["azure"]["api_key"],
            deployment_id=AI_CONFIG["azure"]["deployment_id"]
        )
    else:
        raise ValueError(f"Unknown provider: {AI_CONFIG['provider']}")
```

**10a. Trend Scanner** (`scanner.py`)
- Multi-source waterfall: GDELT → GNews → CurrentsAPI → RSS feeds → regulatory APIs
- Processing: Raw Article → Relevance Filter → Category Mapping → Impact Assessment → Score Suggestion → Human Review Queue
- **Staleness Detection**: flags trends whose evidence base has materially changed

**10b. Score Calibrator** (`calibrator.py`)
- Cross-validates scores for internal consistency
- Benchmarks against Google Trends trajectory
- Detects scoring biases: optimism, anchoring, recency
- Integrates with Delphi Protocol for structured re-scoring

**10c. Scenario Narrator** (`narrator.py`)
- Takes Shift Matrix (percentages only) → generates executive narrative
- **New in v2.0**: Includes causal narrative — "Government regulation is driving 40% of the FCN contraction through its propagated effect on Technology (reformulation costs) and Customer (compliance pass-through)"
- Uses ONLY percentages and relative terms, never €M

**10d. Natural Language Interface** (`chat.py`)
- Conversational queries about the model
- Queries requiring financials get a redirect: "I work with relative shifts only."

#### Module 11: AUDIT & GOVERNANCE (`pulse/audit/`)
- Change log with timestamp, user, reason
- Version snapshots for reproducibility
- AI audit trail
- Data classification checks
- **Delphi round documentation** (new in v2.0)
- **Backtesting accuracy log** (new in v2.0)

---

## 4. ORGANIZATIONAL EMBEDDING FRAMEWORK

### Why This Matters
Tools that don't embed into decision processes become shelfware within 18 months. This section ensures PULSE changes decisions, not just produces analysis.

### RACI Matrix

| Activity | Strategy VP | Category Leads | Data/Analytics | AI/Tech |
|----------|:-----------:|:--------------:|:--------------:|:-------:|
| Trend scoring (Delphi rounds) | A | R | C | I |
| Score override authority | A | R | C | I |
| Causal DAG weight approval | R | C | A | C |
| Scenario definition | A | R | C | I |
| Shift Matrix sign-off | A | R | C | I |
| AI suggestion accept/reject | I | R | C | A |
| Model calibration/backtest | I | C | A | R |
| Annual parameter review | A | C | R | C |
| Dashboard access provisioning | I | I | A | R |

R = Responsible, A = Accountable, C = Consulted, I = Informed

### Annual Planning Cycle Integration

```
Q1 (Jan-Mar): ANNUAL CALIBRATION
├── Backtesting review: compare last year's predictions vs. actuals
├── Attenuation factor recalibration
├── Causal DAG weight review
├── Delphi Round 1: independent scoring
└── PULSE model parameter update

Q2 (Apr-Jun): STRATEGIC PLANNING INPUT
├── Delphi Round 2: calibrated scoring with AI suggestions
├── Monte Carlo full run (50,000 iterations)
├── Scenario analysis for strategy week
├── Allocation optimizer run
└── Shift Matrix delivery to category teams

Q3 (Jul-Sep): MID-YEAR REVIEW
├── AI scanner: quarterly trend update
├── Quick-refresh simulation (10,000 iterations)
├── Trigger check: has any early-warning fired?
├── Path velocity review: are shifts tracking as expected?
└── Strategy adjustment recommendations

Q4 (Oct-Dec): BUDGET INTEGRATION
├── Final Shift Matrix for annual budget
├── Competitive response update (post-earnings season)
├── Category allocation recommendations for next year
├── ExCo presentation of pool outlook
└── Version snapshot: annual archive
```

### Decision Rights Framework

| Decision | Authority | When PULSE Disagrees with GM |
|----------|-----------|------------------------------|
| Trend scores | Delphi consensus (no single person) | Present data, document disagreement, Delphi score stands |
| Category allocation | Strategy VP (informed by optimizer) | Optimizer recommendation is advisory, VP decides |
| Scenario selection | ExCo | Present all scenarios with probabilities, ExCo picks planning scenario |
| Override AI suggestion | Category Lead + Data Analytics | Documented override with rationale (audit trail) |
| Model parameters | Data/Analytics team (annual review) | Parameters are empirically derived, not negotiable |

### Incentive Alignment
- Category Leads who participate in Delphi scoring get recognized in ExCo materials
- Prediction accuracy of individual scorers tracked over time (gamification potential)
- Teams whose early-warning triggers fire correctly get strategic credit
- Annual "Best Prediction" award for the scorer with highest calibration accuracy

---

## 5. TECH STACK SPECIFICATION

### Backend (Python)
```
Python 3.11+
├── Core
│   ├── pandas >= 2.2          # Data manipulation
│   ├── numpy >= 1.26          # Numerical computing
│   ├── scipy >= 1.12          # Distributions, optimization, copulas
│   ├── openpyxl >= 3.1        # Excel read/write
│   ├── sqlite3 (stdlib)       # Local database
│   └── networkx >= 3.2        # Causal DAG operations
│
├── Bayesian / Statistical
│   ├── arviz >= 0.17          # Bayesian diagnostics (convergence, R̂)
│   └── statsmodels >= 0.14    # Granger causality, time series
│
├── API Server
│   ├── FastAPI >= 0.110       # REST API for dashboard
│   ├── uvicorn >= 0.27        # ASGI server
│   └── pydantic >= 2.6        # Data validation
│
├── AI Layer
│   ├── anthropic >= 0.40      # Claude API (MVP cloud option)
│   ├── openai >= 1.5          # Azure OpenAI (production option)
│   ├── ollama >= 0.3          # Local LLM (privacy option)
│   ├── feedparser >= 6.0      # RSS parsing
│   ├── newspaper3k >= 0.2     # Article extraction
│   └── beautifulsoup4 >= 4.12 # Web scraping
│
├── Export
│   ├── python-pptx >= 0.6     # PowerPoint
│   ├── reportlab >= 4.1       # PDF
│   └── jinja2 >= 3.1          # Report templates
│
└── Testing
    ├── pytest >= 8.0
    ├── pytest-cov >= 4.1
    └── hypothesis >= 6.98      # Property-based testing
```

### Frontend (React)
```
Node.js 20 LTS
├── Framework
│   ├── React 18               # UI framework
│   ├── Vite 5                 # Build tool
│   └── React Router 6         # Client-side routing
│
├── Visualization
│   ├── Recharts               # Standard charts
│   ├── D3.js                  # Custom: heatmaps, DAG, tornado, paths
│   └── visx                   # React-native D3 bindings
│
├── UI
│   ├── TailwindCSS 3          # Utility-first CSS
│   ├── Headless UI            # Accessible components
│   ├── Lucide React           # Icons
│   └── Framer Motion          # Butter-smooth animations
│
└── State & Data
    ├── TanStack Query          # Server state management
    ├── Zustand                 # Client state
    └── Zod                     # Runtime type validation
```

### Database Schema (SQLite)
```sql
-- Core trend data (NO financial columns)
CREATE TABLE trends (
    id TEXT PRIMARY KEY,
    force TEXT NOT NULL,
    sub_category TEXT,
    name TEXT NOT NULL,
    description TEXT,
    direction TEXT CHECK(direction IN ('Expansion', 'Contraction')),
    impact INTEGER CHECK(impact BETWEEN 1 AND 5),
    probability INTEGER CHECK(probability BETWEEN 1 AND 5),
    start_year INTEGER,
    normalized_score REAL,
    strategic_implication TEXT,
    data_source TEXT,
    source_type TEXT,
    confidence TEXT DEFAULT 'Medium',
    ai_suggested BOOLEAN DEFAULT FALSE,
    user_override BOOLEAN DEFAULT FALSE,
    -- Delphi metadata
    scorer_count INTEGER DEFAULT 1,
    score_variance REAL DEFAULT 0.0,
    debiasing_applied BOOLEAN DEFAULT FALSE,
    -- Bayesian posteriors (JSON)
    impact_posterior TEXT,       -- {"alpha": 3, "beta": 3}
    probability_posterior TEXT,  -- {"alpha": 4, "beta": 2}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Category exposure
CREATE TABLE trend_category_exposure (
    trend_id TEXT REFERENCES trends(id),
    category TEXT NOT NULL,
    exposure_score INTEGER CHECK(exposure_score BETWEEN 0 AND 5),
    PRIMARY KEY (trend_id, category)
);

-- Value chain exposure
CREATE TABLE trend_vc_exposure (
    trend_id TEXT REFERENCES trends(id),
    vc_step TEXT NOT NULL,
    exposure_score INTEGER CHECK(exposure_score BETWEEN 0 AND 5),
    PRIMARY KEY (trend_id, vc_step)
);

-- Causal DAG edges
CREATE TABLE causal_edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_force TEXT NOT NULL,
    target_force TEXT NOT NULL,
    propagation_weight REAL CHECK(propagation_weight BETWEEN 0 AND 1),
    lag_years INTEGER DEFAULT 0,
    mechanism TEXT,
    evidence_strength TEXT DEFAULT 'Moderate',
    calibrated_from_backtest BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Competitor profiles (public intelligence only)
CREATE TABLE competitors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    archetype TEXT,
    response_patterns TEXT,     -- JSON
    category_exposure TEXT,     -- JSON: {category: exposure_level}
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Model configuration snapshots
CREATE TABLE config_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    region TEXT,
    attenuation REAL,
    attenuation_source TEXT,   -- "assumed" | "backtested"
    force_weights TEXT,         -- JSON
    vc_weights TEXT,            -- JSON
    category_names TEXT,        -- JSON
    path_years TEXT,            -- JSON
    materialization_schedule TEXT,  -- JSON
    backtesting_accuracy REAL
);

-- Simulation runs (continuous paths, percentages only)
CREATE TABLE simulation_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    scenario TEXT,
    iterations INTEGER,
    model_type TEXT,            -- "deterministic" | "bayesian_mc" | "copula_mc"
    config_snapshot_id INTEGER REFERENCES config_snapshots(id),
    results TEXT,               -- JSON: {category: {year: {percentile: shift%}}}
    causal_decomposition TEXT,  -- JSON: {category: {force: direct_%, propagated_%}}
    allocation_recommendation TEXT,  -- JSON: {category: weight}
    convergence_diagnostics TEXT    -- JSON: {r_hat, ess, etc.}
);

-- Backtesting results
CREATE TABLE backtest_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backtest_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    historical_version TEXT,    -- "V5", "V8", etc.
    prediction_year INTEGER,
    actual_shifts TEXT,         -- JSON: public market-level shifts
    predicted_shifts TEXT,      -- JSON: what PULSE would have predicted
    accuracy_score REAL,
    calibration_params TEXT     -- JSON: derived attenuation, distributions, etc.
);

-- Delphi elicitation rounds
CREATE TABLE delphi_rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    round_number INTEGER,
    round_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trend_id TEXT REFERENCES trends(id),
    scorer_id TEXT,
    impact_score INTEGER,
    probability_score INTEGER,
    rationale TEXT,
    calibration_factor REAL DEFAULT 1.0,
    bias_flags TEXT             -- JSON: ["anchoring", "optimism", etc.]
);

-- Early-warning triggers
CREATE TABLE triggers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    condition_type TEXT,        -- "shift_exceeds" | "velocity_exceeds" | "trend_score_change"
    threshold REAL,
    target_year INTEGER,
    action_text TEXT,
    status TEXT DEFAULT 'active',  -- "active" | "fired" | "dismissed"
    fired_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI suggestions queue
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

-- Audit log
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
```

---

## 6. PHASED IMPLEMENTATION PLAN

### PHASE 0: "Historical Calibration" (embedded in Phase 1)
**Purpose:** Build credibility before making predictions.

If historical versions (V1-V11) and corresponding market-level actuals are available:
- Run backtesting to empirically derive attenuation factor
- Calibrate distribution shapes from prediction errors
- Fit causal DAG weights from historical force co-movements
- Compute model accuracy score for ExCo presentation

If historical data is unavailable:
- Use weakly informative priors (Beta(2,2))
- Default attenuation at 0.5 (clearly labeled "assumed, not calibrated")
- Default DAG weights from literature and expert judgment
- Report "No backtesting data available — predictions are prior-driven"

### PHASE 1: "Bayesian Monte Carlo + Causal Engine" (CLI)
**Deliverable:** Python CLI that reads V12, runs Bayesian MC with causal DAG, writes continuous-path Shift Matrix.

**What the user gets:**
- `python -m pulse --input v12.xlsx --output shift_matrix.xlsx`
- Continuous shift paths (2026-2030) with percentile distributions
- Causal decomposition: which forces drive which categories, and through which paths
- Velocity tracking and early-warning trigger evaluation
- Deterministic mode for V12 parity validation
- Allocation recommendations (relative weights)
- Backtesting report (if historical data provided)

**Modules built:**
- `pulse/ingestion/` — Excel reader and trend data parser
- `pulse/simulation/deterministic.py` — V12 parity replica
- `pulse/simulation/bayesian_mc.py` — Bayesian Monte Carlo with copula dependencies
- `pulse/simulation/paths.py` — Continuous path modeling
- `pulse/simulation/scenarios.py` — Causal scenario propagation
- `pulse/simulation/sensitivity.py` — Tornado, breakeven, causal path sensitivity
- `pulse/causal/dag.py` — Causal DAG with shock propagation
- `pulse/game_theory/competitive.py` — Competitive response model
- `pulse/optimizer/allocation.py` — Resource allocation optimizer
- `pulse/backtesting/engine.py` — Historical calibration
- `pulse/elicitation/delphi.py` — Delphi protocol scaffolding
- `pulse/excel_bridge/` — Reader, writer, template generator
- `pulse/audit/logger.py` — Change tracking

**Validation criteria:**
- Deterministic mode matches V12 Dashboard within 0.01pp
- Bayesian MC median converges to deterministic result (±0.5pp)
- Gelman-Rubin R̂ < 1.05 for all parameters
- Shift Matrix contains only percentage values
- Causal propagation produces different results than independent forces
- Allocation optimizer produces feasible, diversified weights

### PHASE 2: "War Room Dashboard" (React + FastAPI)
**Deliverable:** Single-view war room with contextual drill-down, Apple-sleek design.

**What the user gets:**
- `python -m pulse --serve` → War Room at `http://localhost:3000`
- Unified view: headline KPI + heatmap + path timeline + contextual panels
- Click any element → contextual detail slides in
- Animated causal flow visualization
- Real-time re-simulation on score changes
- Export center: Shift Matrix, PowerPoint, PDF, Excel

**UX requirements:**
- Single page, no tab navigation needed for core workflow
- 60fps animations via Framer Motion
- Dark mode default with light mode option
- Every interaction under 200ms perceived latency
- Glassmorphism panels, generous whitespace
- Mobile-responsive (iPad usable for ExCo presentations)

### PHASE 3: "AI-Augmented Intelligence + Power BI Export"
**Deliverable:** AI scanning, calibration, narration, natural language interface, and automated Power BI integration.

**What the user gets:**
- AI scans news sources for relevant FMCG trends (Claude API in MVP, Azure OpenAI in production via single config change)
- Weekly digest: "3 new developments may affect your assessment"
- Score calibration: "Your Government force may be understated by ~15%"
- Causal narratives: explains propagation paths in executive language
- Chat interface: natural language queries
- Delphi workflow: structured scoring rounds with AI-assisted calibration
- Automated Power BI export: `python -m pulse --export-powerbi` → Shift Matrix pushed to Power BI semantic model
- Monthly reconciliation workflow: Power BI dashboard reflects latest Shift Matrix, ExCo sees €M impact without touching PULSE
- Provider-agnostic AI: one `--ai` config flag switches from Claude (MVP) to Azure OpenAI (production) with zero code change

---

## 7. DESIGN SPECIFICATIONS

### Visual Design System — Apple-Grade

**Color Palette (Dark Professional):**
```css
/* Base */
--bg-primary: #0F172A;        /* Deep navy — main background */
--bg-secondary: #1E293B;      /* Elevated surface */
--bg-tertiary: #334155;       /* Hover, active states */
--bg-glass: rgba(30, 41, 59, 0.8);  /* Glassmorphism panels */
--border: rgba(71, 85, 105, 0.5);   /* Subtle borders */
--border-hover: rgba(71, 85, 105, 0.8);

/* Accent */
--accent-blue: #3B82F6;       /* Primary interactive */
--accent-blue-hover: #60A5FA;
--accent-gold: #D4A847;       /* Premium highlight */

/* Semantic */
--expansion: #22C55E;          /* Green — positive */
--contraction: #EF4444;        /* Red — negative */
--neutral: #94A3B8;
--warning: #EAB308;
--causal: #8B5CF6;            /* Purple — causal propagation */

/* Text */
--text-primary: #F8FAFC;
--text-secondary: #94A3B8;
--text-muted: #64748B;
```

**Typography:**
```css
--font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* Scale */
--text-xs: 0.75rem;     /* 12px — labels, badges */
--text-sm: 0.875rem;    /* 14px — secondary */
--text-base: 1rem;      /* 16px — body */
--text-lg: 1.125rem;    /* 18px — section headers */
--text-xl: 1.25rem;     /* 20px — sub-headers */
--text-2xl: 1.5rem;     /* 24px — page headers */
--text-3xl: 2rem;       /* 32px — headline KPI */

/* Weight */
--font-light: 300;      /* KPI numbers */
--font-normal: 400;
--font-medium: 500;     /* Labels */
--font-semibold: 600;   /* Headers */
```

**Motion (Framer Motion):**
```javascript
// Panel slide-in
{ initial: { x: 300, opacity: 0 }, animate: { x: 0, opacity: 1 },
  transition: { type: "spring", stiffness: 300, damping: 30 } }

// Hover scale
{ whileHover: { scale: 1.02 }, transition: { duration: 0.15 } }

// Path animation (shift timeline)
{ pathLength: [0, 1], transition: { duration: 1.5, ease: "easeInOut" } }

// Causal flow particles
{ repeat: Infinity, duration: 2, ease: "linear" }
```

**Chart Colors:**
```
Forces: Consumer=#3B82F6, Customer=#8B5CF6, Technology=#06B6D4,
        Government=#F59E0B, Environmental=#22C55E, Competitive=#EF4444

Causal propagation: #8B5CF6 (purple glow effect)

Categories (Hair): Color=#F87171, Care=#FB923C, Styling=#FBBF24, Body=#A3E635
Categories (LHC): FCN=#34D399, FCA=#2DD4BF, FFI=#22D3EE, LAD=#60A5FA,
                  HDW=#818CF8, ADW=#A78BFA, HSC=#C084FC, IC=#E879F9

Confidence bands: fill with gradient from median color to transparent
Path lines: solid for median, dashed for p10/p90
```

### React ↔ Power BI Visual Consistency (v2.1)

**Same Truth, Two Lenses:**
- **React War Room** (Strategy): relative %, interactive, drillable, designed for exploration
- **Power BI Dashboard** (ExCo/Finance): €M applied shifts, static charts for governance, designed for reporting

**Visual Alignment:**
```
Dimension                React (War Room)              Power BI (€M Dashboard)
─────────────────────────────────────────────────────────────────────────────
Category heatmap         Shift % (-50% to +50%)       Actual €M change, same color palette
Timeline (2026-2030)     Percentile bands, animated   Bar chart with trend line, static
Forces breakdown         Sankey (% contribution)      Stacked bar (€M contribution)
Allocation recommendation Relative weights (%)         Budget allocation ($€M per category)
Confidence/risk          Median ± p10/p90             Scenario tabs (base/bear/bull)
Audience interaction     Drag to change scores        View-only (read-only dashboard)

Color consistency: Both use same force/category colors (see Chart Colors above).
Axes: React uses %, Power BI uses €M, but same directional red/green semantics.
```

**Data Integrity Check:**
- Every night: PULSE exports Shift Matrix (% values)
- Power BI semantic model consumes via API
- DAX formula applies: `€M_shift = €M_actual × (1 + shift_median)`
- One-way flow: PULSE → Power BI. Never reverse.
- Audit log tracks every export & sync timestamp

### Dashboard Export Center & Power BI Integration (Page 8)

The Export Center is a dedicated page within the War Room accessible via a floating action button (bottom-right, persistent).

**Export Destinations:**
1. **Shift Matrix (CSV/JSON)** — Raw output for Power BI ingestion
2. **Power BI Auto-Push** — One-click refresh to Henkel's Power BI semantic model
3. **Excel (Scenario + Allocation)** — User applies shifts to their financials locally
4. **PowerPoint Narrative** — Executive summary with causal explanation
5. **PDF Report** — Full backtesting + methodology for audit trail

**Power BI Export Workflow:**
```
[War Room Dashboard]
         ↓
   [Export Center]
         ↓
   [Select Power BI Mode]
         ↓
   [Authenticate to Azure tenant]
         ↓
   [Upload Shift Matrix to Semantic Model]
         ↓
   [Power BI: Apply shifts via DAX]
         ↓
   [€M impact visible in ExCo dashboard]
         ↓
   [Monthly reconciliation: PULSE updates trigger PBI refresh]
```

**Key Features:**
- **One-click export:** Button triggers Shift Matrix → JSON → Power BI API
- **Monthly scheduler:** Automates weekly PULSE runs + Power BI push (Phase 3)
- **Version tracking:** Each export tagged with scenario, model version, backtesting accuracy
- **Audit log:** Export timestamp, user, destination, file hash
- **Two-audience UI:**
  - Strategy team (React): relative %, interactive drills, broad access
  - ExCo/Finance (Power BI): €M denomination, restricted access, historical comparison

---

## 8. REST API SPECIFICATION

```
Base URL: http://localhost:8000/api/v1

# Health & Status
GET  /health                        → { status, version, db_stats, backtest_accuracy }

# Trends
GET  /trends                        → List all trends (filterable)
GET  /trends/{id}                   → Single trend with Bayesian posterior
PUT  /trends/{id}                   → Update trend (triggers re-simulation)
POST /trends                        → Add new trend
DELETE /trends/{id}                 → Remove trend

# Causal DAG
GET  /causal/dag                    → Full DAG with edge weights
PUT  /causal/edges/{id}             → Update edge weight
POST /causal/propagate              → Simulate shock propagation
  Body: { shocked_force, magnitude, years }

# Simulation
POST /simulate                      → Run Bayesian MC with continuous paths
  Body: { iterations, scenario, include_sensitivity, include_allocation }
  Returns: { shift_matrix, paths, causal_decomposition, allocation, convergence }

POST /simulate/deterministic        → V12-matching deterministic
POST /simulate/compare              → Compare scenarios
  Body: { scenarios: ["base", "green_squeeze", "custom_1"] }

# Scenarios
GET  /scenarios                     → List all scenarios
POST /scenarios                     → Create custom (user defines shock, DAG propagates)

# Game Theory
POST /competitive/response          → Estimate competitive reactions to scenario
POST /competitive/equilibrium       → Run iterative equilibrium

# Optimizer
POST /optimize/allocation           → Resource allocation optimization
  Body: { risk_aversion, constraints }
  Returns: { category_weights, risk_return_frontier }

# Sensitivity
POST /sensitivity/tornado           → Trend leverage ranking
POST /sensitivity/causal            → Which DAG edge matters most?
POST /sensitivity/attenuation       → Backtest-calibrated vs. assumed

# Backtesting
GET  /backtest/results              → Historical accuracy scores
POST /backtest/run                  → Run backtesting against historical data

# Triggers
GET  /triggers                      → All active triggers
POST /triggers                      → Create early-warning trigger
GET  /triggers/status               → Which triggers have fired?

# AI (Phase 3)
GET  /ai/suggestions                → Pending AI suggestions
POST /ai/scan                       → Manual trend scan
POST /ai/calibrate                  → Score calibration check
POST /ai/narrate                    → Scenario narrative (with causal explanation)
POST /ai/chat                       → Natural language query

# Delphi
POST /delphi/round                  → Start new scoring round
GET  /delphi/scores                 → Current round scores
POST /delphi/calibration            → Run calibration exercise
GET  /delphi/reliability            → Inter-rater reliability

# Export
POST /export/excel                  → Shift Matrix + allocation Excel
POST /export/pptx                   → PowerPoint summary
POST /export/pdf                    → PDF report
POST /export/shift-matrix           → Raw Shift Matrix (CSV/JSON) for Power BI
POST /export/powerbi                → Push Shift Matrix to Power BI semantic model
  Body: { tenant_id, workspace_id, dataset_id, auth_token }
  Returns: { status, upload_timestamp, record_count, next_sync_scheduled }
POST /export/powerbi/schedule       → Automate weekly PULSE → Power BI sync
  Body: { day_of_week, time_utc, enabled }

# Config
GET  /config                        → Current configuration
PUT  /config                        → Update configuration

# Audit
GET  /audit/log                     → Full audit trail
POST /audit/snapshot                → Manual snapshot
```

---

## 9. TESTING STRATEGY

### Data Validation Tests
```python
def test_shift_matrix_contains_only_percentages()
def test_allocation_outputs_are_relative_weights_only()
def test_trend_scores_in_valid_range()
def test_category_exposure_validation()
def test_causal_dag_edge_weights_in_bounds()
```

### Parity Tests (V12 validation)
```python
def test_deterministic_matches_v12_dashboard()  # ±0.01pp
def test_deterministic_matches_v12_force_scores()
def test_deterministic_matches_v12_vc_scores()
```

### Statistical Tests
```python
def test_bayesian_mc_converges()  # R̂ < 1.05
def test_bayesian_mc_median_near_deterministic()  # ±0.5pp
def test_copula_captures_tail_dependence()
def test_causal_propagation_differs_from_independent()
def test_continuous_paths_monotonic_materialization()
def test_optimizer_produces_feasible_weights()
```

### Causal Tests
```python
def test_shock_propagation_respects_lag()
def test_dag_is_acyclic()
def test_regulatory_shock_signature_differs_from_tech_shock()
def test_competitive_equilibrium_converges()
```

### Integration Tests
```python
def test_excel_roundtrip()
def test_api_endpoints()
def test_dashboard_loads()
def test_full_pipeline_end_to_end()
```

### Power BI Integration Tests (v2.1)
```python
def test_shift_matrix_to_powerbi_format()  # JSON structure, percentage validation
def test_powerbi_export_push_to_semantic_model()  # Azure authentication, API call
def test_powerbi_dag_join_key_consistency()  # category_name match rate 100%
def test_powerbi_monthly_scheduler()  # Cron job triggers, timestamp recorded
def test_powerbi_sync_audit_trail()  # Each push logged with version & user
```

### Provider Swap Tests (v2.1)
```python
def test_claude_api_provider_scoring()  # Mock Claude API, validate score format
def test_azure_openai_provider_scoring()  # Mock Azure OpenAI, validate score format
def test_provider_config_swap_zero_code_change()  # Switch via config file only
def test_provider_fallback_to_local_mode()  # If API unavailable, use priors
def test_narrative_generation_consistent_across_providers()  # Same input, similar narrative quality
```

---

## 10. DEPLOYMENT & USAGE

### Installation
```bash
cd PROFIT_POOL_ENGINE
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd pulse/dashboard && npm install && cd ../..
python -m pulse.init_db
```

### Usage
```bash
# Phase 1: CLI
python -m pulse --input "v12.xlsx" --output "shift_matrix.xlsx"
python -m pulse --input "v12.xlsx" --output "shift_matrix.xlsx" --iterations 50000
python -m pulse --input "v12.xlsx" --scenario "green_squeeze"
python -m pulse --input "v12.xlsx" --mode deterministic  # V12 match

# Phase 2: War Room
python -m pulse --serve
# Opens http://localhost:3000 (War Room) + http://localhost:8000 (API)

# Phase 3: AI-augmented (v2.1)
python -m pulse --serve --ai claude       # MVP: Claude API
python -m pulse --serve --ai azure        # Production: Azure OpenAI (Henkel tenant)
python -m pulse --serve --ai ollama       # Local: privacy option
python -m pulse --serve --ai none         # No AI suggestions

# Power BI Export (v2.1)
python -m pulse --input "v12.xlsx" --export-powerbi
  # Exports Shift Matrix → Power BI semantic model (requires Azure credentials)
python -m pulse --export-powerbi-schedule --day "monday" --time "09:00"
  # Schedules weekly automatic sync

# Backtesting
python -m pulse --backtest --history-dir ./historical/

# Monthly Workflow (v2.1)
## Step 1: Update V12, run simulation, push to Power BI
python -m pulse --input "v12_new.xlsx" --export-powerbi

## Step 2: Monitor Power BI dashboard for €M impact (ExCo/Finance)
## Step 3: Strategy team uses War Room for relative %, interactive drills

# Utilities
python -m pulse --validate "v12.xlsx"
python -m pulse --audit
python -m pulse --export-template
python -m pulse --ai-config  # View current LLM provider config
```

---

## 11. SUCCESS METRICS

### Phase 1
- [ ] Deterministic matches V12 within 0.01pp for all 13 categories
- [ ] Bayesian MC completes 10,000 iterations in <60 seconds
- [ ] Causal propagation produces measurably different results from independent model
- [ ] Zero financial data in any output
- [ ] Continuous paths cover 5 annual points (2026-2030)
- [ ] Allocation optimizer produces meaningful differentiation across categories

### Phase 2
- [ ] War Room loads in <3 seconds
- [ ] Score changes trigger re-simulation in <2 seconds
- [ ] Causal flow animation renders at 60fps
- [ ] All contextual panels slide in under 200ms
- [ ] Export produces presentation-ready materials
- [ ] NPS > 40 from initial user testing

### Phase 3
- [ ] AI scanner identifies ≥5 relevant trends per week
- [ ] Calibrator catches ≥2 inconsistencies per cycle
- [ ] Narratives include causal explanation (not just "what" but "why")
- [ ] Chat correctly answers 80%+ of queries
- [ ] Full audit trail with no gaps

### The Bain Senior Partner Test (v2.0)
> "Would a Bain or McKinsey Senior Partner present this tool to a DAX-40 CEO's
> Strategy Board as a state-of-the-art, causally-structured, backtested profit
> pool simulation capability — with resource allocation recommendations?
> Would the CFO trust the backtesting accuracy score? Would the CEO act on
> the allocation recommendations? Would QuantumBlack or GAMMA sign off on
> the statistical methodology?"
>
> The answer should be: **Yes.**

---

## 12. RISK REGISTER

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| V12 structure changes break ingestion | Medium | Medium | Flexible parser, version detection |
| Bayesian MC too slow | Medium | Medium | NumPy vectorization, caching, progressive render |
| Insufficient backtest data for calibration | High | Medium | Graceful degradation to priors, clearly labeled |
| Causal DAG weights poorly calibrated | Medium | Medium | Sensitivity analysis on DAG, literature defaults |
| AI hallucinations | Medium | Medium | Human-in-the-loop, never auto-applied |
| Executive adoption resistance | Medium | High | War Room UX, organizational embedding, champions |
| Competitive response model oversimplified | Medium | Low | Clearly labeled as directional, not predictive |
| Optimizer recommendations too concentrated | Low | Medium | Turnover and min-weight constraints |
| Delphi fatigue (too many scoring rounds) | Medium | Medium | Efficient protocol, AI pre-fills, max 3 rounds |
| Azure API key exposure (v2.1) | Low | Critical | Store in Azure Key Vault, never in config files, automated rotation |
| AI provider swap breaks production (v2.1) | Low | High | Provider abstraction via LLMProvider ABC, unit tests for each provider |
| Azure OpenAI provisioning delayed (v2.1) | Medium | Medium | Fallback to Claude API in MVP, timeline buffer in project plan |
| Power BI sync fails, stale data in ExCo dashboard (v2.1) | Medium | High | Audit log + retry logic, manual re-push button, sync status indicator |
| Strategy team/ExCo confusion over "two dashboards" (v2.1) | Medium | Medium | Clear communication: React (%, strategy) vs. Power BI (€M, finance), onboarding training |

---

## 13. EXTERNAL API INTEGRATION MAP — FREE-FIRST ARCHITECTURE

### Design Principle: €0 Running Cost
Every API is free tier or fully open. Paid APIs (Euromonitor, Statista) are placeholders only.

### GROUP A: NEWS & TREND INTELLIGENCE
Multi-source waterfall: GDELT (volume backbone) + GNews (curated quality) + CurrentsAPI (sentiment) + 12 FMCG RSS feeds. Replaces $450/month NewsAPI with superior coverage at €0.

- **A1. GDELT Project** ✅ FREE — Unlimited queries, global coverage, sentiment, 100+ languages. `pip install gdeltdoc`
- **A2. GNews API** ✅ FREE — 100 req/day, clean structured results. REST via `requests`
- **A3. CurrentsAPI** ✅ FREE — 200 req/day, native sentiment scoring. REST
- **A4. FMCG RSS Network** ✅ FREE — 12 curated feeds (CosmeticsDesign, RetailDive, GroceryDive, PackagingDive, HAPPI, GCI, ChemicalWatch, PackagingStrategies, SupplyChainBrain, JustFood, FoodBusinessNews, CosmeticsBusiness). `pip install feedparser`

### GROUP B: REGULATORY & GOVERNMENT
- **B1. ECHA CHEM** ✅ FREE — EU REACH, substance evaluations, cosmetics/detergent regulation
- **B2. EUR-Lex** ✅ FREE — All EU legislation, SPARQL endpoint
- **B3. EU Safety Gate** ✅ FREE — Product safety alerts for cosmetics/detergents

### GROUP C: COMPETITIVE INTELLIGENCE
- **C1. SEC EDGAR** ✅ FREE — Public filings for P&G, Church & Dwight, Colgate-Palmolive
- **C2. UK Companies House** ✅ FREE — Reckitt, Unilever PLC filings
- **C3. EPO Patents** ✅ FREE — Patent filings in IPC classes A61K, A61Q, C11D, A01N, B65D. `pip install python-epo-ops-client`

### GROUP D: CONSUMER BEHAVIOR
- **D1. Google Trends** ✅ FREE — Consumer search behavior as honest intent signal. `pip install pytrends`
- **D2. Reddit** ✅ FREE — Unfiltered product discussions. `pip install praw`
- **D3. YouTube Data** ✅ FREE — Beauty/care trend validation. `pip install google-api-python-client`

### GROUP E: MACROECONOMIC & COMMODITY
- **E1. World Bank** ✅ FREE — GDP, urbanization, water stress
- **E2. IMF** ✅ FREE — WEO, commodity prices
- **E3. FRED** ✅ FREE — Palm oil, crude oil, PPI detergent. `pip install fredapi`
- **E4. Open-Meteo** ✅ FREE — Climate data for insecticide demand. `pip install openmeteo-requests`

### GROUP F: ACADEMIC & INNOVATION
- **F1. Semantic Scholar** ✅ FREE — 200M+ papers, citation velocity
- **F2. OpenAlex** ✅ FREE — Broader chemistry/materials coverage

### GROUP G: PLACEHOLDERS (Paid)
- **G1. Euromonitor** 🔌 PLACEHOLDER — Activate with license
- **G2. Statista** 🔌 PLACEHOLDER — Activate with license

### COST SUMMARY
| Item | Cost |
|------|------|
| All 19 integrated APIs | **€0/year** |
| Free API key registrations | 7 (all <5 min) |
| **Total running cost** | **€0** |

---

## 14. FILE STRUCTURE

```
PROFIT_POOL_ENGINE/
├── claude.md                      # This specification
├── pulse/
│   ├── __init__.py
│   ├── main.py                    # CLI entry point
│   ├── config.py                  # Global configuration
│   ├── ingestion/
│   │   ├── __init__.py
│   │   ├── excel_reader.py        # V12 trend data reader
│   │   └── models.py              # Trend, ModelConfig, CausalEdge dataclasses
│   ├── simulation/
│   │   ├── __init__.py
│   │   ├── deterministic.py       # V12-matching calculation
│   │   ├── bayesian_mc.py         # Bayesian Monte Carlo with copulas
│   │   ├── paths.py               # Continuous path modeling
│   │   ├── scenarios.py           # Causal scenario propagation
│   │   └── sensitivity.py         # Tornado, breakeven, causal sensitivity
│   ├── causal/
│   │   ├── __init__.py
│   │   └── dag.py                 # Directed Acyclic Graph
│   ├── game_theory/
│   │   ├── __init__.py
│   │   └── competitive.py         # Competitive response model
│   ├── optimizer/
│   │   ├── __init__.py
│   │   └── allocation.py          # Resource allocation optimizer
│   ├── backtesting/
│   │   ├── __init__.py
│   │   └── engine.py              # Historical calibration
│   ├── elicitation/
│   │   ├── __init__.py
│   │   └── delphi.py              # Delphi expert elicitation protocol
│   ├── excel_bridge/
│   │   ├── __init__.py
│   │   ├── reader.py              # Import orchestration
│   │   ├── writer.py              # Shift Matrix export
│   │   └── template.py            # Application template generator
│   ├── api/
│   │   ├── __init__.py
│   │   ├── app.py                 # FastAPI application
│   │   └── routes/                # API route modules
│   ├── dashboard/                 # React War Room (Phase 2)
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── App.jsx
│   │   │   ├── components/
│   │   │   │   ├── WarRoom.jsx        # Main unified view
│   │   │   │   ├── Heatmap.jsx        # Force × Category heatmap
│   │   │   │   ├── PathTimeline.jsx   # Continuous path visualization
│   │   │   │   ├── CausalFlow.jsx     # DAG animation
│   │   │   │   ├── ContextPanel.jsx   # Slide-in detail panel
│   │   │   │   ├── HeadlineKPI.jsx    # Top-line metrics
│   │   │   │   ├── AIInsightsBar.jsx  # Bottom notification bar
│   │   │   │   └── ExportCenter.jsx   # Export modal
│   │   │   ├── hooks/
│   │   │   ├── stores/
│   │   │   └── styles/
│   │   └── vite.config.js
│   ├── ai/                        # Phase 3
│   │   ├── __init__.py
│   │   ├── scanner.py
│   │   ├── calibrator.py
│   │   ├── narrator.py
│   │   ├── chat.py
│   │   └── config.py
│   ├── integrations/              # External API modules
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── gdelt.py
│   │   ├── gnews.py
│   │   ├── currentsapi.py
│   │   ├── rss_feeds.py
│   │   ├── echa.py
│   │   ├── eurlex.py
│   │   ├── sec_edgar.py
│   │   ├── google_trends.py
│   │   ├── reddit_api.py
│   │   ├── youtube_api.py
│   │   ├── world_bank.py
│   │   ├── fred_api.py
│   │   ├── euromonitor.py         # Placeholder
│   │   └── statista.py            # Placeholder
│   └── audit/
│       ├── __init__.py
│       └── logger.py
├── tests/
│   ├── test_ingestion.py
│   ├── test_deterministic.py
│   ├── test_bayesian_mc.py
│   ├── test_causal_dag.py
│   ├── test_paths.py
│   ├── test_optimizer.py
│   ├── test_game_theory.py
│   ├── test_sensitivity.py
│   └── test_api.py
├── data/
│   └── pulse.db
├── requirements.txt
└── README.md
```

---

*Document Version: 2.0 — March 2026*
*Author: Strategy × Technology × Quant Partnership*
*Classification: CONFIDENTIAL — Internal Use Only*
*Methodology: Bayesian hierarchical + copula dependencies + causal DAG + game theory + Delphi elicitation*
