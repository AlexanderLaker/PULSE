> **⚠ OBSOLETE (June 2026):** the capability documented in this file was **removed** from PRISM (advanced analytics: D14 + Sobol rider · Delphi: D10 — see `audit/strategy-review/06_DECISION_LOG_AND_WORK_ORDER.md`). Kept for historical reference only.

# Advanced Analytics Modules — Quick Start Guide

## Installation

All modules are production-ready. Just run:

```bash
pip install -r requirements.txt
```

SALib is now included for Sobol analysis.

---

## Four New Capabilities

### 1. CVaR (Risk Analysis)
**Question**: "What's the average loss in worst-case scenarios?"

```bash
curl -X POST http://localhost:8000/api/v1/analytics/cvar \
  -H "Content-Type: application/json" \
  -d '{"confidence_level": 0.95}'
```

**Returns**: Portfolio CVaR, category risk contributions, diversification ratio

---

### 2. Sobol (Sensitivity)
**Question**: "Which forces/trends truly drive output variance?"

```bash
curl -X POST http://localhost:8000/api/v1/analytics/sobol \
  -H "Content-Type: application/json" \
  -d '{"n_samples": 1024, "analysis_type": "forces"}'
```

**Returns**: First-order (S1) and total-order (ST) Sobol indices, ranking

---

### 3. Tipping Points (Early Warning)
**Question**: "Where are the critical inflection points in shift paths?"

```bash
curl -X POST http://localhost:8000/api/v1/analytics/tipping-points \
  -H "Content-Type: application/json" \
  -d '{"acceleration_threshold": 0.005}'
```

**Returns**: Acceleration points, sign reversals, systemic years, severity ranking

---

### 4. Reverse Stress (Inverse Analysis)
**Question**: "What would need to happen for outcome X?"

```bash
curl -X POST http://localhost:8000/api/v1/analytics/reverse-stress \
  -H "Content-Type: application/json" \
  -d '{"target_category": "Hair:Color", "target_shift": -0.10}'
```

**Returns**: Parameter changes needed, top drivers, perturbation distance

---

## Programmatic Usage

```python
from pulse.simulation.cvar import CVaRAnalyzer
from pulse.simulation.tipping_points import TippingPointDetector
import numpy as np

# Sample data from MC run
samples = {"Hair:Color": np.random.normal(-0.05, 0.08, 1000)}

# CVaR
cvar = CVaRAnalyzer(confidence_level=0.95)
result = cvar.compute_cvar(samples["Hair:Color"])
print(f"CVaR: {result['cvar']:+.2%}")

# Tipping Points
path = {2026: -0.005, 2027: -0.015, 2028: -0.035}
detector = TippingPointDetector()
tips = detector.detect_from_path(path, "Hair:Color")
print(f"Found {len(tips)} tipping points")
```

---

## Module Overview

| Module | Purpose | Time | Key Input |
|--------|---------|------|-----------|
| **CVaR** | Tail risk assessment | <100ms | MC samples |
| **Sobol** | Global sensitivity | 5-30s | Model function |
| **Tipping Points** | Early warning | <50ms | Shift path |
| **Reverse Stress** | Scenario discovery | 30-120s | Target outcome |

---

## When to Use Each

### Use CVaR When...
- Presenting risk to board/ExCo
- Comparing portfolio safety across scenarios
- Identifying categories with tail risk exposure

### Use Sobol When...
- Need to identify true drivers (not just correlations)
- Detecting interactions between forces
- Prioritizing which inputs to refine

### Use Tipping Points When...
- Setting up early warning system
- Identifying critical business thresholds
- Planning strategic inflection points

### Use Reverse Stress When...
- Exploring "what breaks this category?"
- Finding dangerous parameter combinations
- Assessing category fragility

---

## API Response Examples

### CVaR Response
```json
{
  "portfolio_cvar": {
    "var": -0.0523,
    "cvar": -0.0841,
    "tail_mean": -0.0841,
    "tail_std": 0.0156
  },
  "diversification_ratio": 1.42,
  "risk_contributions": {
    "Hair:Color": -0.0234,
    "Hair:Care": 0.0012
  }
}
```

### Sobol Response
```json
{
  "first_order": {"Consumer": 0.34, "Technology": 0.15},
  "total_order": {"Consumer": 0.42, "Technology": 0.28},
  "ranking": [
    {"force": "Consumer", "S1": 0.34, "rank": 1},
    {"force": "Technology", "S1": 0.15, "rank": 2}
  ]
}
```

### Tipping Points Response
```json
{
  "tipping_points": [
    {
      "type": "acceleration",
      "category": "Hair:Color",
      "year": 2028,
      "severity": "critical",
      "description": "..."
    }
  ],
  "total_detected": 8,
  "systemic_years": {2028: 4}
}
```

### Reverse Stress Response
```json
{
  "result": {
    "target_shift": -0.10,
    "achieved_shift": -0.099,
    "target_reached": true,
    "top_drivers": [
      {
        "param": "natural_clean_beauty",
        "change": 0.85,
        "pct_change": 26.6
      }
    ],
    "total_perturbation": 0.327
  }
}
```

---

## Configuration

No configuration needed. Use defaults:

```python
CVaRAnalyzer(confidence_level=0.95)           # 5% tail
SobolAnalyzer(n_samples=1024)                 # 4096 evals
TippingPointDetector(acceleration_threshold=0.005)
ReverseStressTester(max_iterations=300)
```

Override if needed for specific analysis.

---

## Files Created

```
pulse/simulation/cvar.py              (CVaR analysis)
pulse/simulation/sobol.py             (Sobol indices)
pulse/simulation/tipping_points.py    (Tipping point detection)
pulse/simulation/reverse_stress.py    (Reverse stress testing)
pulse/api/routes/analytics.py         (API endpoints)

ANALYTICS_MODULES.md                  (Full documentation)
IMPLEMENTATION_SUMMARY.md             (Implementation details)
ANALYTICS_QUICKSTART.md               (This file)
```

---

## Testing

All modules verified and tested:

```bash
✓ CVaR Analyzer
✓ Sobol Analyzer
✓ Tipping Point Detector
✓ Reverse Stress Tester
✓ All 7 API endpoints operational
```

---

## Documentation

- **Full Reference**: See `ANALYTICS_MODULES.md`
- **Implementation Details**: See `IMPLEMENTATION_SUMMARY.md`
- **API Docs**: Run `python -m pulse --serve` → http://localhost:8000/docs

---

## Support

Each module is fully documented with:
- Inline docstrings
- Type hints
- Examples in docstrings
- Error handling with logging

For detailed information, see `ANALYTICS_MODULES.md`.

---

**Version**: 2.1
**Status**: Production-ready ✅
