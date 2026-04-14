# Advanced Analytics Modules — PRISM v2.1

## Overview

Four new advanced analytics modules extend PRISM's simulation engine with enterprise-grade risk assessment, sensitivity analysis, tipping point detection, and inverse scenario planning.

**Installation**: All modules are installed with core PRISM dependencies. SALib is required for Sobol analysis:
```bash
pip install SALib>=1.4
```

---

## Module 1: CVaR (Conditional Value-at-Risk) Analysis

**File**: `/pulse/simulation/cvar.py`
**Class**: `CVaRAnalyzer`

### Purpose
Computes Conditional Value-at-Risk (Expected Shortfall) for profit pool shift distributions. CVaR answers: *"Given we're in the worst X% of outcomes, what's the average loss?"*

More robust than simple percentiles because it considers the entire tail, not just the threshold.

### Key Methods

#### `compute_cvar(samples, confidence_level)`
Compute VaR and CVaR from Monte Carlo samples for a single category.

**Returns:**
```python
{
    "var": float,              # Value at Risk percentile threshold
    "cvar": float,             # Conditional Value at Risk (tail mean)
    "confidence_level": 0.95,  # (e.g., 5% tail)
    "n_tail_samples": int,     # Count of samples in tail
    "tail_mean": float,
    "tail_std": float,
    "tail_min": float,         # Worst case in tail
    "tail_max": float,         # Best case in tail
}
```

#### `compute_portfolio_cvar(all_samples, weights)`
Portfolio-level CVaR across all categories with risk contributions.

**Returns:**
```python
{
    "category_cvar": {category: {var, cvar, ...}},
    "portfolio_cvar": {...},
    "risk_contributions": {category: tail_loss_contribution},
    "diversification_ratio": 1.45,  # >1 = benefit from diversification
    "interpretation": "..."
}
```

#### `cvar_stress_decomposition(all_samples, force_attributions)`
Decompose CVaR by force to identify which forces drive worst-case outcomes.

**Returns:**
```python
{
    "category_force_decomposition": {
        category: {
            force: {"tail_mean": -0.025, "tail_std": 0.012}
        }
    },
    "dominant_forces_in_tail": {force: avg_impact}
}
```

### API Endpoint

```http
POST /api/v1/analytics/cvar
Content-Type: application/json

{
    "confidence_level": 0.95,
    "scenario": "base",
    "compute_decomposition": true
}
```

**Response:**
```json
{
    "portfolio_cvar": {
        "var": -0.0523,
        "cvar": -0.0841,
        "n_tail_samples": 500,
        "tail_mean": -0.0841,
        "tail_std": 0.0156
    },
    "diversification_ratio": 1.42,
    "risk_contributions": {
        "Hair:Color": -0.0234,
        "Hair:Care": 0.0012,
        ...
    }
}
```

### Use Cases

1. **Risk Assessment**: "What's the average loss in the worst 5% of scenarios?"
2. **Tail Risk**: Identify categories exposed to catastrophic downside
3. **Portfolio Resilience**: Measure diversification benefit
4. **Board Reporting**: Communicate downside risk in plain language

---

## Module 2: Sobol Sensitivity Analysis

**File**: `/pulse/simulation/sobol.py`
**Class**: `SobolAnalyzer`

### Purpose
Global variance-based sensitivity analysis using Sobol indices. Answers: *"Which inputs drive output variance, considering all their interactions?"*

Unlike tornado analysis (one-at-a-time), Sobol captures how variables interact when they vary together.

### Key Concepts

- **S1 (First-Order)**: Direct effect of each input on output variance
- **ST (Total-Order)**: Direct effect + all interactions involving that input
- **S2 (Second-Order)**: Pairwise interaction effects
- **Interpretation**: ST > S1 indicates strong interaction effects

### Key Methods

#### `analyze_force_sensitivity(model_func, force_names, bounds)`
Sobol sensitivity for force weight variations.

**Parameters:**
- `model_func`: Function `(weights_dict) -> shift_scalar`
- `force_names`: List of force names to vary
- `bounds`: {force: (min, max)} parameter bounds

**Returns:**
```python
{
    "first_order": {force: S1_value},
    "total_order": {force: ST_value},
    "first_order_conf": {force: confidence_interval},
    "total_order_conf": {force: confidence_interval},
    "second_order": {"force1×force2": S2_value},
    "ranking": [
        {"force": "Consumer", "S1": 0.34, "rank": 1},
        ...
    ],
    "n_evaluations": 2048,
    "interpretation": "Consumer is the dominant driver..."
}
```

#### `analyze_trend_sensitivity(model_func, trend_names, score_bounds)`
Sobol sensitivity for individual trend scores.

**Returns:** Per-trend Sobol indices with ranking by total-order impact.

### API Endpoint

```http
POST /api/v1/analytics/sobol
Content-Type: application/json

{
    "n_samples": 1024,
    "analysis_type": "forces",
    "scenario": "base"
}
```

**Responses for "forces":**
```json
{
    "analysis_type": "forces",
    "first_order": {
        "Consumer": 0.34,
        "Technology": 0.15,
        "Government": 0.08
    },
    "total_order": {
        "Consumer": 0.42,
        "Technology": 0.28,
        "Government": 0.15
    },
    "ranking": [
        {"force": "Consumer", "S1": 0.34, "rank": 1},
        ...
    ],
    "interpretation": "Consumer is the dominant driver (S1=0.340)..."
}
```

### Use Cases

1. **Identify Drivers**: Which trends/forces matter most?
2. **Detect Interactions**: Do certain trends interact strongly?
3. **Confidence**: Prioritize which inputs to refine/calibrate
4. **Model Simplification**: Drop insignificant inputs

---

## Module 3: Tipping Point Detection

**File**: `/pulse/simulation/tipping_points.py`
**Class**: `TippingPointDetector`

### Purpose
Detects structural inflection points in shift paths where the rate of change accelerates — indicating a tipping point or regime shift in the profit pool.

### Detection Types

1. **Acceleration Points** (d²shift/dt² exceeds threshold)
   - Contraction accelerating → market deteriorating faster
   - Expansion accelerating → opportunity widening

2. **Sign Reversals** (expansion ↔ contraction)
   - Fundamental direction change in category trajectory
   - Highest severity events

3. **Inflection Points** (maximum rate of change)
   - Year where shift velocity is highest
   - Signals peak transition moment

4. **Threshold Breaches** (crossing business-defined levels)
   - -5% contraction = "critical" level
   - User-defined thresholds and actions

### Key Methods

#### `detect_from_path(path, category)`
Detect tipping points in a single category's path.

**Parameters:**
- `path`: {year: shift_value} continuous path
- `category`: Category name for labeling

**Returns:**
```python
[
    {
        "type": "acceleration",
        "category": "Hair:Color",
        "year": 2028,
        "acceleration": -0.0087,  # d²shift/dt²
        "velocity_before": -0.012,
        "velocity_after": -0.020,
        "shift_at_point": -0.035,
        "severity": "critical",
        "direction": "accelerating_contraction",
        "description": "Hair:Color (2028): accelerating_contraction detected..."
    },
    ...
]
```

#### `detect_all_categories(shift_matrix)`
Detect tipping points across all categories with systemic analysis.

**Returns:**
```python
{
    "tipping_points": [...],  # All tipping points ranked by severity
    "by_category": {category: [tipping_points]},
    "systemic_years": {2028: 5},  # Years when 3+ categories have events
    "total_detected": 12,
    "critical_count": 2,
    "high_count": 4,
    "medium_count": 6,
}
```

#### `detect_threshold_breach(path, thresholds, category)`
Check if path crosses user-defined business thresholds.

**Threshold format:**
```python
[
    {
        "level": -0.05,
        "label": "Critical contraction",
        "action": "Initiate portfolio review"
    },
    {
        "level": -0.02,
        "label": "Elevated risk",
        "action": "Monitor category"
    }
]
```

### API Endpoint

```http
POST /api/v1/analytics/tipping-points
Content-Type: application/json

{
    "acceleration_threshold": 0.005,
    "scenario": "base",
    "thresholds": [
        {
            "level": -0.05,
            "label": "Critical contraction",
            "action": "Escalate to ExCo"
        }
    ]
}
```

**Response:**
```json
{
    "tipping_points": [
        {
            "type": "sign_reversal",
            "category": "Hair:Color",
            "year": 2029,
            "from_value": 0.012,
            "to_value": -0.005,
            "severity": "high",
            "direction": "expansion_to_contraction"
        },
        ...
    ],
    "total_detected": 8,
    "by_severity": {
        "critical": 1,
        "high": 3,
        "medium": 4
    },
    "systemic_years": {2028: 4, 2029: 5}
}
```

### Use Cases

1. **Early Warning**: Detect accelerating contractions before they become critical
2. **Strategic Inflection**: Identify when categories enter new regimes
3. **Scenario Planning**: "What years are most critical?"
4. **Trigger-Based Actions**: Automate escalation when thresholds breach

---

## Module 4: Reverse Stress Testing

**File**: `/pulse/simulation/reverse_stress.py`
**Class**: `ReverseStressTester`

### Purpose
Inverse analysis: instead of "what happens if X?", find "what would need to happen for outcome Y?"

Uses global optimization to find the *minimum* parameter perturbation that achieves a target adverse outcome. Shows how fragile each category is.

### Key Methods

#### `find_stress_scenario(model_func, target_category, target_shift, param_names, ...)`
Find minimum parameter perturbation to achieve target shift.

**Parameters:**
- `model_func`: Function `(params_dict) -> {category: shift}`
- `target_category`: Category to stress (e.g., "Hair:Color")
- `target_shift`: Target shift (e.g., -0.10 for -10% contraction)
- `param_names`: Parameters to perturb (trend IDs)
- `current_values`: Baseline parameter values

**Returns:**
```python
{
    "target_category": "Hair:Color",
    "target_shift": -0.10,
    "achieved_shift": -0.099,
    "target_reached": true,
    "stress_parameters": {param: new_value},
    "parameter_changes": {param: delta},
    "top_drivers": [
        {
            "param": "natural_clean_beauty",
            "change": 0.85,
            "from": 3.2,
            "to": 4.05,
            "pct_change": 26.6
        },
        ...
    ],
    "total_perturbation": 0.327,  # Euclidean distance from baseline
    "optimization_success": true,
    "interpretation": "To achieve Hair:Color = -10.0%, change natural_clean_beauty..."
}
```

#### `find_multi_category_stress(model_func, targets, param_names, ...)`
Find scenario where multiple categories simultaneously hit targets.

**Use case**: "Find parameter changes that cause Color AND Care to both contract by 5%."

**Returns:**
```python
{
    "targets": {"Hair:Color": -0.05, "Hair:Care": -0.05},
    "achieved_shifts": {"Hair:Color": -0.051, "Hair:Care": -0.048},
    "all_targets_reached": true,
    "stress_parameters": {...},
    "parameter_changes": {...}
}
```

#### `sensitivity_to_target(model_func, target_category, target_range, ...)`
How does minimum perturbation change as target varies?

**Answers**: "How much harder is achieving -10% vs -5%?"

### API Endpoints

```http
POST /api/v1/analytics/reverse-stress
Content-Type: application/json

{
    "target_category": "Hair:Color",
    "target_shift": -0.10,
    "scenario": "base"
}
```

**Response:**
```json
{
    "result": {
        "target_category": "Hair:Color",
        "target_shift": -0.10,
        "achieved_shift": -0.099,
        "target_reached": true,
        "top_drivers": [
            {
                "param": "natural_clean_beauty",
                "change": 0.85,
                "from": 3.2,
                "to": 4.05,
                "pct_change": 26.6
            }
        ],
        "total_perturbation": 0.327
    }
}
```

```http
POST /api/v1/analytics/reverse-stress/multi
Content-Type: application/json

{
    "targets": {
        "Hair:Color": -0.05,
        "Hair:Care": -0.05
    },
    "scenario": "base"
}
```

### Use Cases

1. **Fragility Testing**: "How much stress would break each category?"
2. **Scenario Discovery**: "What combination of trends causes this outcome?"
3. **Risk Calibration**: "Which parameters are most dangerous?"
4. **Robustness**: Categories requiring less perturbation are riskier

---

## Integration with PRISM Workflow

### Phase 2 (War Room Dashboard)

The analytics modules integrate via FastAPI routes:

```
FastAPI App
├── /api/v1/simulation         [Bayesian MC, deterministic]
├── /api/v1/sensitivity         [Tornado, attenuation]
├── /api/v1/optimize            [Allocation]
├── /api/v1/causal              [DAG propagation]
└── /api/v1/analytics           [NEW: Advanced Analytics]
    ├── /cvar                   [CVaR analysis]
    ├── /sobol                  [Sobol sensitivity]
    ├── /tipping-points         [Tipping point detection]
    ├── /reverse-stress         [Reverse stress testing]
    └── /health                 [Module health check]
```

### React Dashboard Integration

All endpoints are consumed by the War Room dashboard's contextual panels:

- **CVaR Panel**: Risk visualization in right-hand drill-down
- **Sobol Panel**: Force/trend sensitivity ranking
- **Tipping Points Panel**: Timeline with critical events flagged
- **Reverse Stress Panel**: "What would break this?" scenario builder

---

## Example Usage

### Programmatic

```python
from pulse.simulation.cvar import CVaRAnalyzer
from pulse.simulation.sobol import SobolAnalyzer
from pulse.simulation.tipping_points import TippingPointDetector
from pulse.simulation.reverse_stress import ReverseStressTester

# Run simulation first
mc_result = bayesian_engine.run(db, iterations=10000)
raw_samples = mc_result["raw_samples"]  # (10000, 13, 5)

# CVaR analysis
cvar = CVaRAnalyzer(confidence_level=0.95)
portfolio_risk = cvar.compute_portfolio_cvar(all_samples)
print(f"Portfolio CVaR: {portfolio_risk['portfolio_cvar']['cvar']:+.2%}")

# Tipping point detection
detector = TippingPointDetector()
tips = detector.detect_all_categories(shift_matrix)
for tp in tips["tipping_points"][:5]:
    print(f"  {tp['year']}: {tp['description']}")

# Reverse stress
tester = ReverseStressTester()
stress = tester.find_stress_scenario(
    model_func, "Hair:Color", -0.10, trend_names
)
print(f"To achieve -10% shift, change {stress['top_drivers'][0]['param']}")
```

### HTTP API

```bash
# Get portfolio CVaR
curl -X POST http://localhost:8000/api/v1/analytics/cvar \
  -H "Content-Type: application/json" \
  -d '{"confidence_level": 0.95, "scenario": "base"}'

# Sobol sensitivity
curl -X POST http://localhost:8000/api/v1/analytics/sobol \
  -H "Content-Type: application/json" \
  -d '{"n_samples": 1024, "analysis_type": "forces"}'

# Detect tipping points
curl -X POST http://localhost:8000/api/v1/analytics/tipping-points \
  -H "Content-Type: application/json" \
  -d '{"acceleration_threshold": 0.005, "scenario": "base"}'

# Reverse stress test
curl -X POST http://localhost:8000/api/v1/analytics/reverse-stress \
  -H "Content-Type: application/json" \
  -d '{"target_category": "Hair:Color", "target_shift": -0.10}'
```

---

## Performance Notes

| Module | Typical Time | Iterations/Samples | Notes |
|--------|-------------|-------------------|-------|
| CVaR | <100ms | Uses existing MC | Fast on cached results |
| Sobol (forces) | 5-15s | 1024 base → 4096 evals | Dependent on model eval time |
| Sobol (trends) | 10-30s | 1024 base → 10k+ evals | O(D²) for D trends |
| Tipping Points | <50ms | Path analysis only | Very fast, no re-simulation |
| Reverse Stress (single) | 30-60s | 300 iterations × model evals | Global optimization |
| Reverse Stress (multi) | 60-120s | 400 iterations × model evals | More complex objective |

**Optimization Tips:**
- CVaR: Use existing simulation results, no re-run needed
- Sobol: Start with 512 samples, increase for refined results
- Tipping Points: Always fast, run on every simulation
- Reverse Stress: Warm-start with heuristic initial guess for speed

---

## Configuration

No special configuration required. All modules use default parameters suitable for most use cases:

```python
# Default confidence for CVaR
CVaRAnalyzer(confidence_level=0.95)  # 5% tail

# Default Sobol sampling
SobolAnalyzer(n_samples=1024)  # 4096 evaluations total

# Default tipping point sensitivity
TippingPointDetector(acceleration_threshold=0.005)

# Default reverse stress optimization
ReverseStressTester(max_iterations=300)
```

Override as needed for analysis-specific requirements.

---

## References

1. **CVaR**: Rockafellar & Uryasev (2000). "Optimization of conditional value-at-risk"
2. **Sobol Indices**: Sobol (2001). "Global sensitivity indices for nonlinear mathematical models"
3. **Tipping Points**: Scheffer et al. (2009). "Early-warning signals for critical transitions"
4. **Reverse Stress**: Strang et al. (2020). "From stress testing to scenario discovery"

---

## File Structure

```
pulse/simulation/
├── bayesian_mc.py           [Existing: Bayesian MC engine]
├── deterministic.py         [Existing: V12 deterministic]
├── scenarios.py             [Existing: Scenario engine]
├── sensitivity.py           [Existing: Tornado, attenuation]
├── paths.py                 [Existing: Continuous paths]
├── cvar.py                  [NEW: CVaR analysis]
├── sobol.py                 [NEW: Sobol sensitivity]
├── tipping_points.py        [NEW: Tipping point detection]
└── reverse_stress.py        [NEW: Reverse stress testing]

pulse/api/routes/
├── analytics.py             [NEW: Advanced analytics API routes]
└── [other routes...]
```

---

**Version**: 2.1
**Last Updated**: March 2026
**Status**: Production-ready
