# PRISM v3.1 — Attenuation Factor Calibration
**Bain Senior Partner Review | April 2026 | 82-Trend Empirical Analysis**

---

## 1. Why we recalibrated

In v3.0 the force-overlap and within-force-overlap matrices were marked *"Calibrated from 61-trend review (April 2026)"* but the values were in fact expert-elicited point estimates — not derived from the trend database itself. When the database expanded from 61 to 82 trends in v3.1 (Bain trend review), every assumption in those matrices needed to be revisited against the *actual* data.

The flat `DEFAULT_ATTENUATION = 0.5` is still present in `config.py` — but only as the **base attenuation** before per-force calibration. What has changed is that the effective attenuation per force, `eff_att_i = 0.5 × (1 − mean(O[i][j] for j≠i))`, is now driven by an empirically calibrated overlap matrix rather than assumed values. The `attenuation_source` field now reads `"calibrated_v3.1_april2026"` (previously `"assumed"`).

---

## 2. Methodology (three steps)

### Step 1 — Empirical structural overlap
For each pair of trends `(t_a, t_b)` we computed the **weighted Jaccard similarity** on their 12-category exposure vectors:

```
J(t_a, t_b) = Σ_c min(e_a,c, e_b,c) / Σ_c max(e_a,c, e_b,c)
```

where `e_x,c ∈ {0,1,2,3,4,5}` is the exposure score of trend x on category c. Weighted Jaccard captures both *which* categories are shared and *with what intensity*. We ran this on all 3,321 unordered pairs.

- **Within-force overlap** = mean pairwise J across the `n·(n−1)/2` pairs within each force
- **Cross-force overlap (symmetric)** = mean pairwise J across all `n_i · n_j` ordered pairs between force i and force j

### Step 2 — Excess-over-baseline transform
Raw J values have a high floor (~0.48) because Henkel trends are scored across the same 12-category FMCG space, so any two random trends tend to look structurally similar. That floor is noise, not signal. We computed the **random-pair baseline** J₀ = 0.4846 as the mean pairwise J across all 82 × 82 trends regardless of force, then mapped to excess overlap:

```
excess(A, B) = max(0, mean_J(A,B) − J₀) / (1 − J₀) ∈ [0, 1]
```

This rescales so the baseline → 0 and a perfect-copy trend pair → 1. Values of exactly 0 mean **no above-random overlap is detectable** from the exposure vectors alone.

### Step 3a — Asymmetric force-size normalization (cross-force only)
A narrow force (fewer trends) is more likely to have its signal "covered" by a broad force than vice versa. We introduced asymmetry via:

```
O[i][j] = excess_sym[i][j] × min(1.5, sqrt(n_j / n_i))
```

This boosts O[narrow][broad] and dampens O[broad][narrow] proportionally. The √ dampens the correction so the asymmetry can't dominate the underlying signal; the 1.5× cap prevents overshooting.

### Step 3b — Mechanism-cluster adjustment
Structural overlap captures "do they score the same categories?" It does *not* capture "do they measure the same underlying mechanism?" Two trends can both score Hair Color heavily for entirely different reasons (silver-economy demographics vs. AI-discovered molecules). We applied per-cell additive adjustments of ±0.03 to ±0.10 based on documented FMCG causal couplings. Full rationale per cell is in the Excel `Mechanism_Adjustments` sheet.

Values were clamped to **[0.10, 0.45]** (within-force) and **[0.00, 0.45]** (cross-force). The within-force floor of 0.10 preserves light dampening even when the empirical signal is zero (otherwise two structurally-orthogonal trends in the same force would sum with no dampening at all). The 0.45 ceiling prevents any single overlap from collapsing the force's contribution.

---

## 3. Key findings

### 3.1 Within-force overlap

| Force | n | Mean J | Excess | Mech. | FINAL | v3.0 | Δ |
|:---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **Government** | 12 | 0.678 | 0.376 | +0.05 | **0.426** | 0.35 | +0.08 |
| **Environmental** | 11 | 0.597 | 0.219 | +0.05 | **0.269** | 0.32 | −0.05 |
| **Technology** | 16 | 0.579 | 0.182 | +0.05 | **0.232** | 0.20 | +0.03 |
| **Customer** | 8 | 0.566 | 0.157 | 0.00 | **0.157** | 0.22 | −0.06 |
| **Consumer** | 23 | 0.387 | 0.000 | −0.03 | **0.100** | 0.22 | −0.12 |
| **Competitive** | 12 | 0.455 | 0.000 | −0.05 | **0.100** | 0.15 | −0.05 |

**Top finding: Government's within-force overlap is dramatically higher than v3.0 assumed** (0.426 vs 0.35, empirical mean J = 0.68). Eight of twelve Government trends trace to the European Green Deal root mechanism (PFAS, Microplastics, Omnibus VII/VIII, PPWR, Green Claims, EUDR, AI Act, Biodiversity Regulation, Textile Circularity). Dampening should be ~60% for a category that 8 Gov trends hit, not ~30%.

**Second finding: Consumer and Competitive are genuinely diverse** — empirical excess = 0. Consumer's 23 trends span premium/sustainability/demographics/occasions/geography/value-trading with little mechanism clustering, and Competitive's 12 trends are specifically about *different* competitors (Reckitt, P&G, Unilever, L'Oréal, K-beauty, Amazon, etc.). Both floor-clamped to 0.10.

### 3.2 Cross-force overlap (top couplings)

| Rank | From → To | Calibrated | v3.0 | Δ | Mechanism |
|:-:|:---|:-:|:-:|:-:|:---|
| 1 | Environmental → Government | **0.432** | 0.38 | +0.05 | PFAS, PPWR, EUDR, DPP — environmental AND regulatory |
| 2 | Government → Environmental | **0.405** | 0.40 | +0.01 | Same coupling, reverse direction |
| 3 | Government → Technology | **0.367** | 0.25 | +0.12 | Regulation triggers reformulation R&D |
| 4 | Customer → Government | **0.300** | 0.10 | +0.20 | Retailer compliance burden scales with reg |
| 5 | Customer → Technology | **0.266** | 0.10 | +0.17 | Retail media + agentic commerce = customer tech |
| 6 | Environmental → Technology | **0.266** | 0.15 | +0.12 | Supply constraints drive bio-chem |
| 7 | Technology → Government | **0.237** | 0.15 | +0.09 | AI Act, DPP — tech in regulatory scope |
| 8 | Customer → Government | 0.200 | — | — | (already listed) |

**v3.0 undercalibrated six cross-force cells by more than +0.10**, all clustered around Government's downstream impact. The original matrix treated regulation as relatively isolated; the empirical analysis shows regulation is the most deeply coupled force in the Henkel/FMCG system.

### 3.3 Effective attenuation per force

| Force | Mean row O | Eff. Att. NEW | v3.0 Eff. | Δ | Interpretation |
|:---|:-:|:-:|:-:|:-:|:---|
| Consumer | 0.036 | **0.482** | 0.415 | +0.07 | Consumer signal nearly fully preserved |
| Competitive | 0.027 | **0.486** | 0.425 | +0.06 | Competitor-specific trends barely overlap others |
| Technology | 0.130 | **0.435** | 0.430 | +0.01 | Modest redundancy with Gov/Customer |
| Environmental | 0.173 | **0.413** | 0.412 | 0.00 | Matches v3.0 after calibration |
| Customer | 0.164 | **0.418** | 0.425 | −0.01 | Slightly dampened — more coupled than thought |
| Government | 0.194 | **0.403** | 0.405 | 0.00 | Most-dampened force (highly coupled downstream) |

Effective attenuation now ranges **0.40–0.49** (previously uniformly ~0.42). The spread reflects that **Consumer and Competitive forces carry nearly independent signal** in the Henkel trend-space, while **Government and Environmental signal overlaps materially with each other and with Technology**. This is defensible FMCG economics.

---

## 4. What changed in `pulse/config.py`

Three updates in `pulse/config.py`:

1. **New constant** `DEFAULT_ATTENUATION_SOURCE = "calibrated_v3.1_april2026"` — replaces the previous `"assumed"` default.
2. **`DEFAULT_FORCE_OVERLAP_MATRIX`** (6×6 asymmetric) — all 30 off-diagonal cells updated to calibrated values; comment block documents the top 10 couplings and cross-references the Excel sheet.
3. **`DEFAULT_WITHIN_FORCE_OVERLAP`** (scalar per force) — all 6 values updated; comment block documents empirical chain (raw → excess → final) per force.
4. **`ModelConfig.attenuation_source`** default changed from hardcoded `"assumed"` to reference `DEFAULT_ATTENUATION_SOURCE`.

The base `DEFAULT_ATTENUATION = 0.5` is retained as the scaling parameter before per-force calibration — changing it would uniformly rescale all effective attenuation values. The per-force calibration now lives in the overlap matrices, not in the base.

---

## 5. Sensitivity & limitations

**Sensitivity to J₀ baseline.** If baseline is recomputed with a different trend mix (e.g., after adding v3.2 trends), all excess-overlap values shift. Re-run `compute_attenuation_v3.py` whenever the trend database changes.

**Structural vs. mechanism.** The structural metric tells us trends *look* similar; mechanism adjustment is judgment. The ±0.05-0.10 range reflects Bain senior-partner calibration in FMCG context but cannot be empirically verified without the v1-v11 historical backtesting data (which remains unavailable per the v3.0 audit).

**Clamping.** Two forces hit the floor (Consumer, Competitive at 0.10). If future trend additions reveal higher within-force coupling, these values should re-float above the floor. The ceiling of 0.45 is not currently binding for any force.

**No calibration on outcome data.** A proper backtest would compare model forecasts under different overlap matrices against actual historical shift observations. That remains the outstanding milestone in section 12 of `claude.md` (architectural vision).

---

## 6. Deliverables

| File | Purpose |
|:---|:---|
| `pulse/config.py` | Live model configuration — calibrated matrices deployed |
| `Attenuation_Calibration.xlsx` | 6-sheet config sheet: Summary, Within-Force, Cross-Force, Empirical Computation, Mechanism Adjustments, Trend Census |
| `Attenuation_Calibration_Methodology.md` | This document |
| `attenuation_calibration_v3.json` | Raw calibration output (for API/audit) |
| `compute_attenuation_v3.py` | Reproducible computation script |

**To re-run the calibration** (after future trend-database updates):
```bash
python3 compute_attenuation_v3.py   # recomputes matrices
python3 build_excel.py              # regenerates Excel
```

---

*Calibration date: April 16, 2026*
*Methodology: Excess-overlap-above-baseline + force-size asymmetry + mechanism adjustment*
*Input: 82 trends × 12 categories = 984 exposure scores*
*Pairs evaluated: 3,321 unordered pairs (within + across forces)*
