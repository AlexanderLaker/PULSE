> **⚠ OBSOLETE (June 2026):** the capability documented in this file was **removed** from PRISM (advanced analytics: D14 + Sobol rider · Delphi: D10 — see `audit/strategy-review/06_DECISION_LOG_AND_WORK_ORDER.md`). Kept for historical reference only.

# Advanced Analytics Modules - Quick Reference Card

## Module Overview

| Module | Purpose | Key Class | Primary Method | Output |
|--------|---------|-----------|-----------------|--------|
| **CVaR** | Tail risk quantification | `CVaRAnalyzer` | `compute_cvar()` | VaR, CVaR, tail stats |
| **Sobol** | Global sensitivity | `SobolAnalyzer` | `analyze_force_sensitivity()` | S1, ST, rankings |
| **Reverse Stress** | Scenario discovery | `ReverseStressTester` | `find_stress_scenario()` | Parameters, drivers |
| **Tipping Points** | Path dynamics | `TippingPointDetector` | `detect_from_path()` | Events, severity, year |

---

## Quick Start Examples

### CVaR Analysis
```python
from pulse.simulation.cvar import CVaRAnalyzer
import numpy as np

# Single distribution
analyzer = CVaRAnalyzer(confidence_level=0.95)
samples = np.random.normal(-0.05, 0.03, 5000)
result = analyzer.compute_cvar(samples)
print(f"CVaR: {result['cvar']:.4f}")  # Worst 5% average loss

# Portfolio
portfolio = analyzer.compute_portfolio_cvar({
    "Hair: Color": color_samples,
    "Hair: Care": care_samples
})
print(f"Diversification: {portfolio['diversification_ratio']:.2f}x")
```

### Sobol Sensitivity
```python
from pulse.simulation.sobol import SobolAnalyzer

analyzer = SobolAnalyzer(n_samples=1024)

def my_model(weights):
    return sum(weights.values()) * 0.05

result = analyzer.analyze_force_sensitivity(
    my_model, ["Consumer", "Customer", "Technology"]
)

for rank in result['ranking']:
    print(f"{rank['force']}: S1={rank['S1']:.3f}")
```

### Reverse Stress Testing
```python
from pulse.simulation.reverse_stress import ReverseStressTester

tester = ReverseStressTester()

def model(params):
    return {"Hair: Color": -0.01 * params["Impact"]}

stress = tester.find_stress_scenario(
    model,
    target_category="Hair: Color",
    target_shift=-0.10,
    param_names=["Impact"]
)

print(f"Target achieved: {stress['target_reached']}")
print(f"Top driver: {stress['top_drivers'][0]['param']}")
```

### Tipping Point Detection
```python
from pulse.simulation.tipping_points import TippingPointDetector

detector = TippingPointDetector()

shift_matrix = {
    "Hair: Color": {
        2026: -0.01, 2027: -0.025, 2028: -0.050,
        2029: -0.080, 2030: -0.110
    }
}

result = detector.detect_all_categories(shift_matrix)

for point in result['tipping_points'][:3]:
    print(f"{point['year']}: {point['description']}")
```

---

## Method Quick Reference

### CVaRAnalyzer

| Method | Input | Output | Use Case |
|--------|-------|--------|----------|
| `compute_cvar()` | samples, alpha | var, cvar, tail_stats | Single category risk |
| `compute_portfolio_cvar()` | {cat: samples}, weights | portfolio_cvar, contributions | Multi-category risk |
| `cvar_stress_decomposition()` | samples, force_attributions | force_decomposition | What drives tail risk? |
| `cvar_by_scenario()` | {scenario: {cat: samples}} | ranking | Worst scenario? |
| `generate_cvar_report()` | portfolio_cvar | markdown | Executive summary |

### SobolAnalyzer

| Method | Input | Output | Use Case |
|--------|-------|--------|----------|
| `analyze_force_sensitivity()` | model_func, forces | first_order, total_order, ranking | Which forces matter? |
| `analyze_trend_sensitivity()` | model_func, trends | S1, ST, ranking | Which trends matter? |
| `analyze_category_sensitivity()` | model_func, categories | per_category indices | Category-specific drivers |
| `compute_sobol_indices_dict()` | Si array, names | S1, ST as dict | Utility method |

### ReverseStressTester

| Method | Input | Output | Use Case |
|--------|-------|--------|----------|
| `find_stress_scenario()` | model_func, target_category, shift | stress_params, top_drivers | Single scenario |
| `find_multi_category_stress()` | model_func, targets | multi-target params | Multiple categories |
| `sensitivity_to_target()` | model_func, target_range | sensitivity_curve | Feasibility analysis |
| `generate_reverse_stress_report()` | results | markdown | Summary |

### TippingPointDetector

| Method | Input | Output | Use Case |
|--------|-------|--------|----------|
| `detect_from_path()` | path, category | points with type/severity | Single category path |
| `detect_all_categories()` | shift_matrix | tipping_points, systemic_years | Portfolio analysis |
| `detect_threshold_breach()` | path, thresholds | breaches with direction | Business rule alerts |
| `generate_tipping_point_report()` | detection_result | markdown | Summary |

---

## Common Patterns

### Pattern 1: Risk → Drivers → Causes
```python
# Step 1: What's the risk?
cvar = CVaRAnalyzer()
risk = cvar.compute_portfolio_cvar(mc_samples)
worst_case = risk['portfolio_cvar']['cvar']

# Step 2: What drives it?
sobol = SobolAnalyzer()
drivers = sobol.analyze_force_sensitivity(model_fn, forces)
top_force = drivers['ranking'][0]['force']

# Step 3: How to achieve it?
tester = ReverseStressTester()
scenario = tester.find_stress_scenario(model_fn, "Hair: Color", worst_case, params)
causes = scenario['top_drivers']
```

### Pattern 2: Path Dynamics
```python
# Continuous path from MC runs
path = {2026: -0.01, 2027: -0.025, 2028: -0.050, ...}

detector = TippingPointDetector()

# When does it accelerate?
tipping = detector.detect_from_path(path)
acceleration_years = [p['year'] for p in tipping if p['type'] == 'acceleration']

# When do we breach thresholds?
breaches = detector.detect_threshold_breach(
    path,
    [{"level": -0.05, "label": "Major contraction"}]
)

# When is it systemic?
matrix = {"Cat1": path1, "Cat2": path2, ...}
systemic = detector.detect_all_categories(matrix)
warning_years = list(systemic['systemic_years'].keys())
```

### Pattern 3: Scenario Comparison
```python
# Compare Base vs. Stress
cvar = CVaRAnalyzer()

scenarios = {
    "Base Case": {"Cat1": base_samples1, "Cat2": base_samples2},
    "Stress": {"Cat1": stress_samples1, "Cat2": stress_samples2},
}

comparison = cvar.cvar_by_scenario(scenarios)

print(f"Most risky: {comparison['most_risky']}")
print(f"Least risky: {comparison['least_risky']}")
```

---

## Output Formats

### CVaR Output
```python
{
    'var': float,              # Threshold value (percentile)
    'cvar': float,             # Mean of tail (expected shortfall)
    'confidence_level': float, # Alpha (0.95 = 5% tail)
    'n_tail_samples': int,     # Count of tail samples
    'tail_mean': float,        # Average of tail
    'tail_std': float,         # Std of tail
    'tail_min': float,         # Worst in tail
    'tail_max': float,         # Best in tail
}
```

### Sobol Output
```python
{
    'first_order': {force: s1_value},      # Direct effect
    'total_order': {force: st_value},      # Direct + interactions
    'ranking': [{force, S1, rank}],        # Ranked by importance
    'second_order': {pair: s2_value},      # Pairwise interactions
    'interpretation': str,                 # Human explanation
}
```

### Reverse Stress Output
```python
{
    'target_shift': float,                 # Target we aimed for
    'achieved_shift': float,               # What we achieved
    'target_reached': bool,                # Did we succeed?
    'stress_parameters': {param: value},   # Solution
    'top_drivers': [{param, change, from, to, pct_change}],
    'total_perturbation': float,           # Distance from baseline
    'interpretation': str,                 # Human explanation
}
```

### Tipping Point Output
```python
{
    'type': 'acceleration|sign_reversal|inflection',
    'year': int,
    'severity': 'critical|high|medium',
    'acceleration': float,      # d²shift/dt² (if acceleration)
    'velocity': float,          # dshift/dt
    'direction': str,           # e.g., "worsening_contraction"
    'description': str,         # Human explanation
}
```

---

## Computational Complexity

| Module | Complexity | Typical Time | Notes |
|--------|------------|--------------|-------|
| CVaR | O(n log n) | <100ms | Sorting + percentile computation |
| Sobol | O(d × n × evaluations) | 1-5s | Depends on SALib availability |
| Reverse Stress | O(iterations × d) | 2-10s | Differential evolution iterations |
| Tipping Points | O(c × y) | <50ms | Linear in categories × years |

---

## Configuration & Customization

### CVaRAnalyzer
```python
CVaRAnalyzer(
    confidence_level=0.95  # 5% tail risk (default)
)
```

### SobolAnalyzer
```python
SobolAnalyzer(
    n_samples=1024  # Base samples for Saltelli scheme
)
```

### ReverseStressTester
```python
ReverseStressTester(
    max_iterations=300,    # DE iterations
    tolerance=1e-7,        # Convergence tolerance
    optimization_seed=42   # Reproducibility
)
```

### TippingPointDetector
```python
TippingPointDetector(
    acceleration_threshold=0.005,  # |d²shift/dt²| to trigger
    regime_window=2                # Years for regime detection
)
```

---

## Dependencies

| Module | Required | Optional | Notes |
|--------|----------|----------|-------|
| CVaR | NumPy, SciPy | — | Fully self-contained |
| Sobol | NumPy, SciPy | SALib | SALib provides Saltelli sampling |
| Reverse Stress | NumPy, SciPy | — | Uses scipy.optimize.differential_evolution |
| Tipping Points | NumPy | — | Fully self-contained |

---

## Error Handling

### Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `SALib not installed` | Sobol tried but SALib missing | `pip install SALib` or use without |
| Target unreachable | Stress target impossible | Expand param_bounds or relax target |
| No tipping points | Path too flat or threshold too high | Lower acceleration_threshold |
| NaN in results | Bad input data | Check for NaN/infinite values |

---

## Testing & Validation

### Run All Tests
```bash
pytest tests/test_cvar.py tests/test_sobol.py \
       tests/test_reverse_stress.py tests/test_tipping_points.py \
       tests/test_advanced_analytics_integration.py -v
```

### Quick Smoke Test
```python
from pulse.simulation.cvar import CVaRAnalyzer
from pulse.simulation.sobol import SobolAnalyzer
from pulse.simulation.reverse_stress import ReverseStressTester
from pulse.simulation.tipping_points import TippingPointDetector

print("✓ All modules import successfully")

# Verify each works
c = CVaRAnalyzer()
s = SobolAnalyzer()
r = ReverseStressTester()
t = TippingPointDetector()

print("✓ All classes instantiate successfully")
```

---

## Next Steps

1. **Integration with War Room:** Wire outputs to dashboard
2. **API Endpoints:** Create REST endpoints for each method
3. **Batch Processing:** Run across all scenarios automatically
4. **Real-time Monitoring:** Check triggers as new data arrives
5. **Executive Reporting:** Generate daily/weekly summaries

---

## Support & Documentation

- **Full Guide:** `ADVANCED_ANALYTICS_SUMMARY.md`
- **Docstrings:** Each module has detailed docstrings
- **Tests:** See `tests/` for usage examples
- **Code:** All modules in `pulse/simulation/`

**Status:** All modules fully functional and production-ready ✓
