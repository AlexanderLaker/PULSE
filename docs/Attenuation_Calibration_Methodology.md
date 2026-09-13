# PRISM v3.1 — Attenuation Factor Calibration
**Bain Senior Partner Review | April 2026 | 82-Trend Empirical Analysis**

> **Current generation: v3.12** (release 2.12.0, owner ruling O13, 11 September 2026), sections 19 to 26, computed on the 51-driver core set over the 13-category taxonomy. The earlier generations are the historical record, correct when written and kept unchanged: v3.1 (sections 1 to 6, 82 trends), v3.5 (sections 7 to 11, 99 trends), v3.11 (sections 12 to 18, 51 drivers over 12 categories).

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

---

---

# PRISM v3.5 — Recalibration on 99-Trend Base
**Bain Senior Partner Review | April 2026 | 99-Trend Empirical Analysis**

Sections 1–6 above document the v3.1 calibration on the 82-trend base and remain the authoritative reference for the methodology (weighted Jaccard, excess-over-baseline, asymmetric force-size normalization, mechanism adjustments, clamps). Sections 7–11 below document the **v3.5 recalibration on the 99-trend base** — the live production calibration as of the April 2026 deploy. **Methodology is unchanged — only inputs and outputs differ.**

> **Note on v3.4**: an interim v3.4 calibration was computed on the 95-trend base as a working draft. It was never shipped — four additional trends (three Gemini-review additions plus a regulatory trend on PVA unit-dose films) were identified before the v3.4 Excel and code constants were committed. The v3.5 calibration documented below is the first 99-trend calibration and the first to reach production. The v3.4 numbers are documented in `/tmp/attenuation_calibration_v3_4.json` for reproducibility but are not authoritative.

---

## 7. Why we recalibrated again (v3.1 → v3.5)

Between the v3.1 review and the v3.5 review the trend database was expanded by seventeen additional trends — thirteen from the v3.3 strategic trend review (filling under-represented Customer and Environmental segments plus targeted additions elsewhere) and four from the Gemini external review (Ultra-Fast-Fashion Beauty, Neuro-Scents, AfCFTA Pan-African integration, PVA unit-dose film biodegradability reclassification). The expanded footprint is:

| Force | v3.1 count | v3.5 count | Δ |
|:---|---:|---:|---:|
| Consumer | 30 | 32 | +2 |
| Customer | 6 | 10 | +4 |
| Technology | 16 | 18 | +2 |
| Government | 12 | 14 | +2 |
| Environmental | 7 | 11 | +4 |
| Competitive | 11 | 14 | +3 |
| **Total** | **82** | **99** | **+17** |

A +21% expansion of the base is material enough that the within- and cross-force overlap matrices had to be re-computed end-to-end. The expansion disproportionately added *structural variety* — especially in Customer and Environmental, which had been under-represented in v3.1 — and crucially adds `government_r14` (PVA unit-dose film reclassification, 18% of GP1 affected), which is the largest single-trend GP1 exposure in the database and had been an explicit gap under `government_r02` (PFAS / persistent-pollutant regulation explicitly exempted "biodegradable" polymers).

The methodology (weighted Jaccard on 12-category exposure vectors, excess-over-baseline transform, asymmetric force-size normalization, mechanism adjustment, clamps [0.10, 0.45]) is **unchanged from v3.1**. All six numerical steps in §2 execute identically — only the trend set they consume is different.

---

## 8. What shifted at the matrix level

### 8.1 Random-pair baseline J₀

```
v3.1  J₀ = 0.4846   (82 trends, 3,321 pairs)
v3.5  J₀ = 0.4525   (99 trends, 4,851 pairs)
         Δ = −0.0321
```

The baseline dropped ~6.6% because the added trends expanded the structural space — pairs drawn at random now overlap less on average. The **excess-overlap signal is noticeably cleaner** in v3.5 (more headroom above the noise floor) and per-force cohesion numbers separate more cleanly. This is especially visible in Government and Environmental, where the within-force excess now sits well above 0.25 (previously ~0.15).

### 8.2 Trend-weighted mean attenuation

```
v3.1  mean(eff_att) = 0.4462   (weighted by trend count)
v3.5  mean(eff_att) = 0.4523
         Δ = +0.0061
```

Upward drift of ~1.4%. The engine is marginally *less* dampening on average — the added trends are on balance more structurally independent from their force-mates (higher eff_att), pulling the mean up. Consumer is the main contributor (+0.013 eff_att) as the consumer-taste force keeps fragmenting along orthogonal axes.

### 8.3 Within-force cohesion (after mechanism adjustment)

| Force | v3.1 within | v3.5 within | Δ |
|:---|---:|---:|---:|
| Consumer | 0.100 (clamped) | 0.100 (clamped) | 0.000 |
| Customer | 0.157 | 0.242 | +0.085 |
| Technology | 0.232 | 0.206 | −0.026 |
| Government | 0.426 | 0.312 | −0.114 |
| Environmental | 0.269 | 0.314 | +0.045 |
| Competitive | 0.100 (clamped) | 0.100 (clamped) | 0.000 |

**Customer cohesion up +0.085** — the added Customer trends (retailer consolidation, marketplace behaviour, channel integration) all share exposure on the retail-channel category, tightening internal coupling.

**Government cohesion down −0.114** — the force now spans a broader regulatory surface (PFAS, PVA pods, extended producer responsibility, MoCRA, digital advertising rules). Average pairwise overlap within the force dropped because some new trends (`government_r14` PVA, `government_r13` MoCRA/US-state cosmetics) target different category vectors than the classic packaging-and-ingredient bloc.

**Environmental cohesion up +0.045** — the added environmental trends cluster on water stewardship and carbon accounting, reinforcing the existing climate-regulation cluster.

### 8.4 Cross-force matrix row means (→ eff_att)

| Force | v3.1 row mean | v3.5 row mean | eff_att v3.1 | eff_att v3.5 | Δ eff_att |
|:---|---:|---:|---:|---:|---:|
| Consumer | 0.036 | 0.010 | 0.482 | 0.495 | **+0.013** |
| Customer | 0.164 | 0.198 | 0.418 | 0.401 | **−0.017** |
| Technology | 0.130 | 0.132 | 0.435 | 0.434 | −0.001 |
| Government | 0.194 | 0.170 | 0.403 | 0.415 | **+0.012** |
| Environmental | 0.174 | 0.164 | 0.413 | 0.418 | +0.005 |
| Competitive | 0.028 | 0.042 | 0.486 | 0.479 | −0.007 |

The identity `eff_att_i = 0.5 × (1 − mean(O[i][j] for j≠i))` is applied as before — these are direct outputs of the updated cross-force overlap matrix, not re-derived.

Top 5 cross-force couplings in v3.5 (all unchanged direction from v3.1, magnitudes re-weighted):

1. Environmental → Government  0.364  (climate-reg ↔ sustainability-reg cluster)
2. Customer → Government  0.333  (retail-channel regulation — EPR, marketplace liability)
3. Customer → Technology  0.326  (retail-tech: AI merchandising, programmatic buying)
4. Government → Environmental  0.296  (regulatory reach into sustainability metrics)
5. Government → Technology  0.282  (AI-rule / data-rule regulation footprint)

---

## 9. Where it lands in code

The engine consumes `DEFAULT_PER_FORCE_ATTENUATION` directly — there is no base × (1−overlap) derivation at runtime. The six v3.5 values replace the six v3.1 values across three authoritative locations:

| Location | Constant | v3.5 value |
|:---|:---|:---|
| `pulse/config.py` | `DEFAULT_PER_FORCE_ATTENUATION` | {Consumer:0.495, Customer:0.401, Technology:0.434, Government:0.415, Environmental:0.418, Competitive:0.479} |
| `lib/calibration.ts` | `DEFAULT_PER_FORCE_ATTENUATION` | same six values (Δ vs v3.1 commented inline) |
| `data/attenuation_calibration_v3_5.json` | `per_force_eff_att` | same six values (API/audit export) |

The `attenuation_source` field is a three-way enum:

```
"calibrated_v3.5_april2026"   (default — live)
"calibrated_v3.1_april2026"   (legacy — still valid for reproduction runs)
"admin_override"              (manual experimentation)
```

Validator (`pulse/config_validation.py`), TypeScript union types (`types/config.ts`), Bayesian MC fallback (`pulse/simulation/bayesian_mc.py`), test fixtures (`tests/conftest.py`), and the SettingsModal UI all enforce this enum.

---

## 10. Sensitivity — what this means for the headline number

Trend-weighted mean attenuation moved +0.006 (0.446 → 0.452). Mechanically this means the engine applies ~1.4% less dampening to cross-force signal propagation on average. The *shape* of the shift matters more than the scalar:

- **Consumer got less dampening** (eff_att 0.482 → 0.495, Δ +0.013) — the added Consumer trends plus the expansion of sibling forces makes Consumer look *more* structurally independent. Consumer taste shifts don't pull other forces as much as v3.1 suggested.
- **Customer got more dampening** (eff_att 0.418 → 0.401, Δ −0.017) — Customer-force trends (retailer consolidation, marketplace shifts, TikTok Shop-native omnichannel) now look structurally more entangled with Technology and Government than v3.1 assumed. This is intuitive: omnichannel, D2C, and marketplace-regulatory trends genuinely spill over.
- **Government got less dampening** (eff_att 0.403 → 0.415, Δ +0.012) — a counter-intuitive but correct outcome of the cohesion drop. With Government now spanning a more diverse regulatory surface (packaging + cosmetics + digital + pan-African trade), each Government trend's cross-force reach is on average smaller than in v3.1.
- **Competitive got slightly more dampening** (eff_att 0.486 → 0.479, Δ −0.007) — consistent with the added competitive trends (`competitive_r04` TikTok Shop pivot, `competitive_r14` AfCFTA) which share structure with Technology (platform-native commerce) and Government (trade policy).
- **Technology effectively unchanged** (eff_att 0.435 → 0.434, Δ −0.001) — the Neuro-Scents trend plus the broader technology set net out to essentially the v3.1 coupling profile.

A full Monte Carlo re-run is required to translate these per-force shifts into profit-pool mean/median/p-band deltas — see §11 deliverables.

---

## 11. v3.5 deliverables

| File | Purpose |
|:---|:---|
| `pulse/config.py` | Live model configuration — v3.5 values deployed |
| `lib/calibration.ts` | TypeScript mirror for dashboard — v3.5 values deployed |
| `data/Attenuation_Calibration_v3_5.xlsx` | 6-sheet companion workbook: Summary, Within-Force, Cross-Force, Empirical Computation, Mechanism Adjustments, Trend Census (99 trends) |
| `data/attenuation_calibration_v3_5.json` | Raw calibration output (API/audit) |
| `compute_attenuation_v3_5.py` | Reproducible computation script for v3.5 |
| `build_attenuation_xlsx.py` | Excel build script that consumes the JSON |
| `Attenuation_Calibration_Methodology.md` | This document (v3.1 + v3.5 combined reference) |

**To re-run the v3.5 calibration** (after future trend-database updates):
```bash
python3 compute_attenuation_v3_5.py   # recomputes matrices on current trend DB
python3 build_attenuation_xlsx.py     # regenerates companion Excel
python3 scripts/recalc.py data/Attenuation_Calibration_v3_5.xlsx   # recalculates formulas
```

**To re-run the simulation with v3.5 attenuation** (required for profit-pool number refresh):
```bash
# Dashboard Monte Carlo auto-picks up new values from lib/calibration.ts
# Python simulation (prod Neon, 50K iterations × 3 chains):
python3 scripts/run_50k_prod.py
```

---

*v3.5 calibration date: April 24, 2026*
*Methodology: unchanged from v3.1 — weighted Jaccard + excess-over-baseline + force-size asymmetry + mechanism adjustment, clamps [0.10, 0.45]*
*Input: 99 trends × 12 categories = 1,188 exposure scores*
*Pairs evaluated: 4,851 unordered pairs (within + across forces)*
*Baseline J₀ shift: 0.4846 → 0.4525 (−0.0321)*
*Trend-weighted mean eff_att shift: 0.4462 → 0.4523 (+0.0061)*

---

# PRISM v3.11 — Recalibration on the 51-Driver Base (release 2.11.0)

Owner ruling O11 (10 September 2026). The September 2026 senior-partner review replaced the 99-trend base with 51 drivers (O10). Every population-dependent quantity of the overlap correction is re-derived on that population with the method of sections 2 and 7 unchanged: weighted Jaccard on the 12-category exposure vectors, excess over the random-pair baseline, asymmetric force-size factor, per-cell mechanism adjustments, clamps [0.10, 0.45] within and [0.00, 0.45] across, and the identity eff_att = 0.5 x (1 - mean cross-force row overlap). The mechanism adjustments were re-judged cell by cell for the new population (owner decision 2026-09-10); every non-zero cell carries its reason in `data/attenuation_calibration_v3_11.json` and on the Mechanism Adjustments sheet of the workbook.

## 12. What the population change did to the inputs

- 51 drivers: Consumer 20, Government 10, Customer 7, Technology 6, Competitive 4, Environmental 4 (99 before: 32/14/10/18/14/11).
- Unique pairs: 1,275 (4,851 before).
- Random-pair baseline J0: 0.4265 (0.4525 before). The reviewed exposure vectors are more differentiated, so the structural floor is lower and the excess transform bites earlier.
- Trend-weighted mean effective attenuation: 0.4520 (0.4523 before). The headline pass-through is unchanged within rounding; the redistribution between forces is what moves.

## 13. Within-force overlap (raw J, excess, mechanism, final)

| Force | n | raw J | excess | mech | v3.11 final | v3.5 record | in config at 2.10.0 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Consumer | 20 | 0.3576 | 0.0000 | +0.00 | **0.100** | 0.100 | 0.100 |
| Customer | 7 | 0.5255 | 0.1726 | +0.05 | **0.223** | 0.242 | 0.157 |
| Technology | 6 | 0.6116 | 0.3227 | +0.05 | **0.373** | 0.206 | 0.232 |
| Government | 10 | 0.4700 | 0.0759 | +0.05 | **0.126** | 0.312 | 0.426 |
| Environmental | 4 | 0.6207 | 0.3386 | +0.05 | **0.389** | 0.314 | 0.269 |
| Competitive | 4 | 0.2876 | 0.0000 | +0.00 | **0.100** | 0.100 | 0.100 |

Reasons for the mechanism adjustments (re-judged for the 51 drivers):

- Consumer (+0.00): 20 drivers, one mechanism each after the review (duplicated regional lines, GLP-1 shedding, longevity claims consolidated); residual premium-hair (C-03/C-04/C-07/C-02), value (C-01/C-06/C-11/C-35) and demographic (C-05/C-25/C-18/C-34) clusters act on different P&L lines or regions; empirical excess 0, floor 0.10 applies, no adjustment.
- Customer (+0.05): K-01 discounters, K-12 drugstores, K-03 buyer power and K-13 retail media all compress the same European trade margin on the same LHC volume; kept separate because the channels differ, but the P&L line is one.
- Technology (+0.05): T-11 AI agents, T-13 generative search and T-08 platform replenishment are one digital-intermediation cluster (three of six drivers); the high raw overlap also reflects category-broad vectors, so the adjustment stays at the v3.5 level.
- Government (+0.05): six of ten drivers come out of one legislative programme (microplastics, PPWR/EPR, EmpCo, EUDR/CSDDD, Detergents Regulation, UWWTD) and G-04, G-16 and G-17 stack compliance cost on the same detergent SKUs; the review removed the triple count of the packaging stack, the cluster remains.
- Environmental (+0.05): four COGS-side cost drivers on the same European manufactured volume; E-07 energy, E-12 oil feedstock and E-03 carbon move with the same 2026 energy shock.
- Competitive (+0.00): four drivers with distinct actors and mechanisms (scale leaders, challengers, share windows, salon channel); empirical excess 0, floor 0.10 applies, no adjustment.

The Government value is the largest move (0.426 in the 2.10.0 configuration, 0.312 in the v3.5 record, 0.126 now): the review differentiated the regulatory exposures (cosmetics rules against hair, detergent rules against LHC, packaging against all, US instruments against North America) and merged the packaging and DPP lines that used to triple-count one cost stack, so the drivers of that force no longer overlap in exposure space the way the April base did. Technology (0.373) and Environmental (0.389) rise because their few remaining drivers are category-broad and share the digital-intermediation and the 2026 energy-shock mechanisms respectively.

## 14. Cross-force overlap matrix (final; rows = how much of the row force is covered by the column force)

| | Consumer | Customer | Technology | Government | Environmental | Competitive |
|---|---:|---:|---:|---:|---:|---:|
| **Consumer** | - | 0.051 | 0.000 | 0.030 | 0.000 | 0.050 |
| **Customer** | 0.052 | - | 0.239 | 0.208 | 0.220 | 0.104 |
| **Technology** | 0.000 | 0.266 | - | 0.223 | 0.333 | 0.030 |
| **Government** | 0.030 | 0.155 | 0.154 | - | 0.199 | 0.000 |
| **Environmental** | 0.000 | 0.363 | 0.450 | 0.402 | - | 0.000 |
| **Competitive** | 0.050 | 0.123 | 0.030 | 0.000 | 0.000 | - |

Mechanism adjustments per cell (symmetric; the empirical layers are in the JSON):

- Consumer and Customer (+0.05): new: C-01 private label and K-01 discounters / K-12 drugstores are two faces of one shift (Aldi and Lidl growth is own-label growth); C-06 trading down feeds the same channels.
- Consumer and Government (+0.03): new: G-15 SNAP retrenchment and G-08 tariff pass-through hit the same low-income shopper as C-06; C-34 immigration reversal is a policy-driven demographic.
- Consumer and Competitive (+0.05): C-11 dupes and C-16 China domestic brands are the demand side of X-16 challenger fragmentation; C-35 mass unit decline is the demand side of X-15 scale-leader escalation.
- Customer and Technology (+0.08): raised from +0.05: retail media now sits in Customer (K-13) and is the same digital-shelf visibility tax that T-11 AI agents and T-13 generative search impose; K-02 marketplaces and T-08 platform replenishment are one channel mechanism.
- Customer and Government (+0.03): lowered from +0.05: the PVA retailer-reformulation link went with G-14; what remains is G-15 SNAP retrenchment acting on the discounter shopper of K-01 and retailer compliance under G-04/G-16 labels.
- Customer and Environmental (+0.03): new: E-01/E-12 cost pass-through is negotiated against K-03 buyer power; price recovery is the shared mechanism.
- Customer and Competitive (+0.08): new: K-07 pro brands crossing into retail and X-18 salon channel restructuring are one shift seen from the retail and the salon side; K-04 social commerce and X-16 social-commerce-native challengers share the channel.
- Technology and Government (+0.05): G-02 microplastics, G-03 ingredient restrictions and G-16 film criteria trigger the reformulation R&D of T-02 bio-based substitution and T-03 formats.
- Technology and Environmental (+0.05): E-01 palm/lauric cost drives T-02 bio-based substitution; T-03 compaction reduces the packaging-resin and freight exposure of E-12.
- Technology and Competitive (+0.03): new: AI productivity (T-01) accrues to the scale leaders of X-15 (the L'Oréal tech platform lines merged into X-15).
- Government and Environmental (+0.05): E-03 carbon pricing (ETS2, CBAM) is a regulatory instrument; E-01 palm cost sits with G-06 EUDR; the regulation-plus-ESG cost axis of v3.5 remains.
- Deliberately 0: Consumer and Environmental (C-06 and E-12 share the 2026 energy shock on different P&L lines, demand against COGS; the co-movement belongs to the copula, not to the overlap), Consumer and Technology, Government and Competitive, Environmental and Competitive.

## 15. Effective attenuation per force

| Force | row mean cross overlap | v3.11 eff_att | v3.5 eff_att | delta |
|---|---:|---:|---:|---:|
| Consumer | 0.0262 | **0.487** | 0.495 | -0.008 |
| Customer | 0.1646 | **0.418** | 0.401 | +0.017 |
| Technology | 0.1704 | **0.415** | 0.434 | -0.019 |
| Government | 0.1076 | **0.446** | 0.415 | +0.031 |
| Environmental | 0.2430 | **0.379** | 0.418 | -0.039 |
| Competitive | 0.0406 | **0.480** | 0.479 | +0.001 |

Environmental attenuates most (0.379): its four cost drivers are covered by Technology (substitution), Government (carbon and EPR instruments) and Customer (pass-through) at once. Government attenuates least of the coupled forces (0.446) because the review moved the retail-media and carbon-cost mechanisms out of its neighbourhood.

## 16. Copula validity on the new population

`DEFAULT_FORCE_CORRELATIONS` (v3.6, scaled 0.73 for positive semi-definiteness on the 99-trend population, minimum eigenvalue +0.14) was re-checked on the 51 drivers: the implied 51 x 51 matrix has minimum eigenvalue **+0.4135**, a wider margin because the force mix is less Consumer-heavy. The matrix is kept unchanged; the golden lock "no repair fires on defaults" passes on the 2.11.0 fixture and the CLI pre-flight gate (F6) re-checks the loaded mix on every production run.

## 17. Where it lands in code, and the F-28 correction

`pulse/config.py` carries all three layers from one generated record: `DEFAULT_PER_FORCE_ATTENUATION`, `DEFAULT_WITHIN_FORCE_OVERLAP` and `DEFAULT_FORCE_OVERLAP_MATRIX`, with `DEFAULT_ATTENUATION_SOURCE = "calibrated_v3.11_september2026"`. `tests/test_calibration_v3_11.py` locks the defaults to the JSON, the JSON to the script, the identity between the matrix and the attenuation, and the copula margin.

Before 2.11.0 the three layers had two provenances (finding F-28): `DEFAULT_PER_FORCE_ATTENUATION` held the v3.5 record's values, but `DEFAULT_WITHIN_FORCE_OVERLAP` (0.100/0.157/0.232/0.426/0.269/0.100) and the cross-force matrix were the v3.1 numbers with hand edits, labelled v3.5. The engine consumes the attenuation and the within-force overlap, so the 2.10.0 production runs used v3.5 attenuation with v3.1 within-force dampening. The 2.10.0 regression lock in `tests/test_cell_weights.py` pins exactly that combination so the 2.11.0 engine still reproduces the 2.10.0 numbers when asked to.

## 18. v3.11 deliverables

| File | Purpose |
|---|---|
| `scripts/compute_attenuation_v3_11.py` | Reproducible computation on the current seed; per-cell mechanism adjustments with reasons; copula check |
| `data/attenuation_calibration_v3_11.json` | The record: every layer, every reason, the previous version's values for comparison |
| `data/Attenuation_Calibration_v3_11.xlsx` | Companion workbook (`python3 scripts/build_attenuation_xlsx.py v3_11`); not tracked in git, regenerate from the JSON |
| `pulse/config.py` | Live defaults (all three layers) |
| `tests/test_calibration_v3_11.py` | Lock |

```bash
python3 scripts/compute_attenuation_v3_11.py        # recompute on the current seed
python3 scripts/build_attenuation_xlsx.py v3_11     # regenerate the workbook
python3 scripts/run_50k_prod.py                     # production run after deploying
```

*v3.11 calibration date: 10 September 2026*
*Input: 51 drivers x 12 categories = 612 exposure scores; 1,275 unordered pairs*
*Baseline J0 shift: 0.4525 to 0.4265; trend-weighted mean eff_att 0.4523 to 0.452*

---

# PRISM v3.12 — Recalibration on the 13-Category Taxonomy (release 2.12.0)

Owner ruling O13 (11 September 2026): Toilet Care becomes its own PRISM category, `"LHC: TOI"`, split out of Hard-Surface Cleaner, and the category taxonomy goes from 12 to 13. The overlap correction is computed from the weighted Jaccard overlap of the drivers' category exposure vectors, so the exposure space is the input, not a backdrop: a vector that gains a column is a different input, and every quantity derived from it has to be re-derived. Leaving v3.11 in place would have shipped an overlap correction calibrated on a taxonomy the engine no longer uses, which is the F-28 failure mode from the other side, a live layer carrying a provenance that no longer describes it. The method is unchanged from sections 2, 7 and 12: weighted Jaccard on the category exposure vectors, excess over the random-pair baseline J0, asymmetric force-size factor, per-cell mechanism adjustments, clamps [0.10, 0.45] within and [0.00, 0.45] across, and the identity eff_att = 0.5 x (1 - mean cross-force row overlap). The mechanism layer is unchanged as well: the same per-cell adjustments with the same reasons as v3.11 (sections 13 and 14), re-applied on the 13-column space. The population is the same 51 drivers with the same force counts. The thirteenth category is the only input that moved.

## 19. What the taxonomy change did to the inputs

- Exposure space: 13 categories (12 before). `"LHC: TOI"` sits between `"LHC: HSC"` and `"LHC: IC"`, so the LHC block still reads in shelf order.
- Exposure scores: 51 x 13 = 663 (612 before).
- Population unchanged: 51 drivers, Consumer 20, Government 10, Customer 7, Technology 6, Competitive 4, Environmental 4.
- Unique pairs: 1,275 (unchanged; the population did not move, only the width of its vectors).
- Scoring of the new column (`data/trend_base_2026-09/core_set_51_v4.json`): every driver keeps its HSC score unchanged and carries a separate TOI score. For 37 of the 51 drivers the toilet-care exposure equals the hard-surface score it was split from; 14 were differentiated, five upwards (G-04 packaging and EPR 4 to 5, G-02 microplastics 2 to 3, K-12 drugstore channel 3 to 4, X-06 growth markets 3 to 4, X-15 scale-leader escalation 2 to 3) and nine downwards (among them G-08 US tariffs 3 to 1, C-34 US household formation 3 to 1, C-18 2 to 1, T-08 2 to 1, G-13 2 to 1).
- Random-pair baseline J0: 0.4199 (0.4265 before). The thirteenth column separates drivers that used to be forced to share one hard-surface score, so two drivers drawn at random overlap slightly less and the excess transform bites marginally earlier.
- Trend-weighted mean effective attenuation: 0.4514 (0.4520 before).

## 20. Within-force overlap (raw J, excess, mechanism, final)

| Force | n | raw J | excess | mech | v3.12 final | v3.11 final | delta |
|---|---:|---:|---:|---:|---:|---:|---:|
| Consumer | 20 | 0.3495 | 0.0000 | +0.00 | **0.100** | 0.100 | 0.000 |
| Customer | 7 | 0.5192 | 0.1711 | +0.05 | **0.221** | 0.223 | -0.002 |
| Technology | 6 | 0.6139 | 0.3345 | +0.05 | **0.384** | 0.373 | +0.011 |
| Government | 10 | 0.4623 | 0.0730 | +0.05 | **0.123** | 0.126 | -0.003 |
| Environmental | 4 | 0.6234 | 0.3507 | +0.05 | **0.401** | 0.389 | +0.012 |
| Competitive | 4 | 0.2830 | 0.0000 | +0.00 | **0.100** | 0.100 | 0.000 |

The mechanism adjustments and their reasons are the v3.11 ones, unchanged cell by cell (section 13); they are carried in `data/attenuation_calibration_v3_12.json` in full so the record stands on its own.

The order of the forces is the same and the two floors still bind. The raw overlap moves both ways. It rises inside Technology (0.6116 to 0.6139) and Environmental (0.6207 to 0.6234), whose few drivers score the LHC block broadly and alike, so a thirteenth LHC column adds more shared mass than differentiation; it falls inside Consumer, Customer, Government and Competitive, whose drivers are less alike on toilet care than on their average category. Measured against a baseline that itself drops 0.0065, the two rises compound into the only visible moves (+0.011 and +0.012) while the falls nearly cancel against it (-0.002 and -0.003). Consumer and Competitive are unaffected either way: their empirical excess was zero before the split and is zero after it, and the floor of 0.10 sets both values.

## 21. Cross-force overlap matrix (final; rows = how much of the row force is covered by the column force)

| | Consumer | Customer | Technology | Government | Environmental | Competitive |
|---|---:|---:|---:|---:|---:|---:|
| **Consumer** | - | 0.050 | 0.000 | 0.030 | 0.000 | 0.050 |
| **Customer** | 0.050 | - | 0.245 | 0.206 | 0.223 | 0.110 |
| **Technology** | 0.000 | 0.272 | - | 0.232 | 0.345 | 0.030 |
| **Government** | 0.030 | 0.153 | 0.159 | - | 0.200 | 0.000 |
| **Environmental** | 0.000 | 0.367 | 0.450 | 0.405 | - | 0.000 |
| **Competitive** | 0.050 | 0.133 | 0.030 | 0.000 | 0.000 | - |

Per-cell mechanism adjustments and the eight deliberate zeroes are unchanged from section 14; the empirical layers (raw J, excess, asymmetry) are recomputed on the 13-column space and are in the JSON.

Fifteen of the thirty off-diagonal cells did not move at all, and no cell moved by more than 0.012 (Technology covered by Environmental, 0.333 to 0.345). The top ten couplings keep their order; the only re-orderings sit inside 0.006 of each other, Government covered by Technology now edging Government covered by Customer (0.159 against 0.153) and a shuffle inside the 0.050 tie band of the Consumer cells. Environmental covered by Technology is still clamped at the 0.45 ceiling (pre-clamp 0.493, from 0.474), which is the one place where the split is absorbed rather than shown.

## 22. Effective attenuation per force

| Force | row mean cross overlap | v3.12 eff_att | v3.11 eff_att | delta |
|---|---:|---:|---:|---:|
| Consumer | 0.0260 | **0.487** | 0.487 | 0.000 |
| Customer | 0.1668 | **0.417** | 0.418 | -0.001 |
| Technology | 0.1758 | **0.412** | 0.415 | -0.003 |
| Government | 0.1084 | **0.446** | 0.446 | 0.000 |
| Environmental | 0.2444 | **0.378** | 0.379 | -0.001 |
| Competitive | 0.0426 | **0.479** | 0.480 | -0.001 |

The reading of section 15 stands unchanged: Environmental attenuates most (0.378), covered at once by Technology, Government and Customer; Consumer and Competitive keep nearly all of their signal; Government attenuates least of the coupled forces (0.446). Technology is the only force that moves by as much as 0.003, and it moves because its row picks up the three cells the thirteenth column widened (covered by Environmental +0.012, by Government +0.009, by Customer +0.006).

## 23. How far it moved against v3.11

| Quantity | v3.11 | v3.12 | move |
|---|---:|---:|---:|
| Random-pair baseline J0 | 0.4265 | 0.4199 | -0.0065 |
| Trend-weighted mean attenuation | 0.4520 | 0.4514 | -0.0006 |
| Largest per-force effective attenuation move (Technology) | 0.415 | 0.412 | -0.003 |
| Largest within-force overlap move (Environmental) | 0.389 | 0.401 | +0.012 |
| Largest single cross-force cell move (Technology covered by Environmental) | 0.333 | 0.345 | +0.012 |
| Copula minimum eigenvalue on the 51 drivers | +0.4135 | +0.4135 | 0.000 |

No effective attenuation moves by more than 0.003, no within-force overlap by more than 0.012 and no single cross-force cell by more than 0.012. Two of the six within-force values, two of the six attenuations and fifteen of the thirty cross-force cells are identical to v3.11, and the force ordering of the within-force and attenuation layers is unchanged.

This is what a resolution change looks like: the split gives the same 51 drivers one more column to be different in, it does not re-estimate the mechanism. The mechanism layer is identical to v3.11 by construction and the population is identical, so the whole recalibration lands inside a move of 0.012 on any single number and 0.0006 on the headline, far inside the +/-0.03 to +/-0.10 judgment band of the mechanism adjustments themselves. v3.12 buys correct provenance, not a different view of the system.

## 24. Copula validity on the 13-category taxonomy

`DEFAULT_FORCE_CORRELATIONS` (v3.6, scaled 0.73 for positive semi-definiteness) was re-checked on the 51 drivers: the implied 51 x 51 matrix has minimum eigenvalue **+0.4135**, exactly the v3.11 value. That is expected and is a check, not a coincidence: `build_trend_correlation_matrix` reads the force label of each driver and nothing else, so a change to the category taxonomy cannot move the spectrum as long as the population and its force mix hold. The matrix is kept unchanged; the golden lock "no repair fires on defaults" passes on the 2.12.0 fixture and the CLI pre-flight gate (F6) re-checks the loaded mix on every production run.

## 25. Where it lands in code

`pulse/config.py` carries all three layers from the one generated record: `DEFAULT_PER_FORCE_ATTENUATION`, `DEFAULT_WITHIN_FORCE_OVERLAP` and `DEFAULT_FORCE_OVERLAP_MATRIX`, with `DEFAULT_ATTENUATION_SOURCE = "calibrated_v3.12_september2026"`. `calibrated_v3.11_september2026` joins v3.5 and v3.1 as a legacy value of the enum, valid for reproduction runs and rejected nowhere. `tests/test_calibration_v3_12.py` locks the defaults to the JSON, the JSON to the script, the identity between the matrix and the attenuation, and the copula margin, the same four locks v3.11 carried.

The 2.10.0 regression lock in `tests/test_cell_weights.py` is untouched by this: it pins the 2.10.0 taxonomy (twelve categories, 48 cells) and the v3.5 attenuation with v3.1 within-force dampening as literals, so the 2.12.0 engine still reproduces the 2.10.0 numbers when asked to, and the next taxonomy change cannot move that baseline either.

## 26. v3.12 deliverables

| File | Purpose |
|---|---|
| `scripts/compute_attenuation_v3_12.py` | Reproducible computation on the 13-category seed; mechanism adjustments unchanged from v3.11, with reasons; copula check |
| `data/attenuation_calibration_v3_12.json` | The record: every layer, every reason, the previous version's values for comparison |
| `data/Attenuation_Calibration_v3_12.xlsx` | Companion workbook (`python3 scripts/build_attenuation_xlsx.py v3_12`); not tracked in git, regenerate from the JSON |
| `pulse/config.py` | Live defaults (all three layers) |
| `tests/test_calibration_v3_12.py` | Lock |
| `scripts/compute_attenuation_v3_11.py`, `data/attenuation_calibration_v3_11.json` | Kept as the superseded provenance, not consumed by the engine |

```bash
python3 scripts/compute_attenuation_v3_12.py        # recompute on the current seed
python3 scripts/build_attenuation_xlsx.py v3_12     # regenerate the workbook
python3 scripts/run_50k_prod.py                     # production run after deploying
```

*v3.12 calibration date: 11 September 2026*
*Input: 51 drivers x 13 categories = 663 exposure scores; 1,275 unordered pairs*
*Baseline J0 shift: 0.4265 to 0.4199; trend-weighted mean eff_att 0.452 to 0.4514*
