# PRISM Model Architecture Review
## A First-Principles Redesign Assessment

**Perspective:** Bain Consumer Practice Senior Partner × Goldman Sachs Quantitative Strategies Managing Director

**Date:** March 29, 2026

**Classification:** Strategic — For Internal Use

---

## Executive Summary

PRISM v2.1 is already significantly more sophisticated than 95% of profit pool models in FMCG. The `gp1_pct_affected` economic anchoring, Bayesian copula engine, and causal DAG put it ahead of what most consulting firms deliver. However, when we stress-test the architecture against how profit pools *actually* shift in Consumer Goods — and how Goldman's quant desk would model correlated economic systems — there are **six structural design choices we would change** if rebuilding from scratch.

**Bottom line:** The current model is *good enough to deploy*. The changes below are v3.0 improvements that would make it *best-in-class*. None of them invalidate the current implementation — they extend it.

---

## What the Current Model Gets Right

Before criticizing, let's acknowledge what's genuinely strong:

**1. The `gp1_pct_affected` economic anchoring** — This is the single most important improvement made. Without it, the model was intellectually dishonest: a 5/5 trend couldn't realistically touch 100% of GP1. The current calibration (2-25% range) is well-reasoned and economically grounded. This alone elevates PRISM above most consulting models.

**2. Multiplicative compounding** — Correct intuition. Forces interact multiplicatively, not additively. A regulatory shock AND a consumer shift create a compounded impact, not a linear sum. This is how real markets work.

**3. Copula-based tail dependence** — The t-copula with df=4 correctly captures the "things go wrong together" effect. In the 2022 cost-of-living crisis, Consumer (trading down), Customer (private label push), and Competitive (price war) were simultaneously activated. A Gaussian copula would have underestimated the joint probability of this scenario by 40-60%.

**4. Causal DAG with lag structure** — Modeling Government→Technology with a 1-year lag is structurally correct. PFAS regulation in 2024 is driving reformulation R&D spend in 2025-2026. This is observable and calibratable.

**5. Materialization S-curve** — The insight that a -5% shift arriving gradually is strategically different from a -5% step function is important and correctly implemented.

---

## Six Structural Changes for a v3.0 Redesign

### Change 1: Replace "Force Averaging" with Weighted Aggregation by Trend Materiality

**Current design flaw:**
```python
# deterministic.py, line 57-58
avg_score = total_score / count  # Simple average across trends in a force
```

The model averages all trends within a force equally. A "Digital Product Passport" trend (gp1_pct_affected=0.02, impact=3) gets the same averaging weight as "Private Label Structural Penetration" (gp1_pct_affected=0.25, impact=5). The economic significance is 50x different, but both contribute equally to the force average.

**Redesign:**
Weight each trend's contribution to the force score by its economic materiality — specifically, by `gp1_pct_affected × abs(normalized_score)`:

```python
# Weight by economic significance, not equal weight
weight_j = trend.gp1_pct_affected * abs(trend.normalized_score)
total_weight = sum(weights)
force_score = sum(trend.normalized_score * exposure_frac * weight_j) / total_weight
```

**Why this matters:** In Hair Color, the model currently treats "PFAS Restriction" (which touches 12% of GP1 via reformulation) and "Clean Beauty" (which touches 18% via premiumization) as equally important inputs to the Consumer force. They're not. Economic materiality should drive aggregation weight.

**Goldman perspective:** In factor models, you don't equal-weight factors. You weight by information ratio (expected return per unit risk). The analogue here is economic materiality per trend.

**Estimated impact:** Moderate. Categories with a mix of high-impact and low-impact trends (like LHC: FCN) would see 15-25% shift in their force contributions.

---

### Change 2: Introduce Category-Level Correlation Structure (Not Just Trend-Level)

**Current design flaw:**
The copula models correlation between *trends* (within-force ρ=0.3, cross-force ρ from DAG). But the output investors actually care about — *category-level shifts* — has no explicit correlation structure. The category correlation is an emergent property of shared trend exposures, which is fine for the median, but underestimates tail risk at the portfolio level.

**Why it matters for PRISM specifically:**
Hair: Color and Hair: Care share ~60% of their Consumer trends. If the Consumer force is shocked, both categories move together. But the current model doesn't directly model this — it infers it from shared trend loadings. The problem: in tail scenarios, the effective category correlation is much higher than what shared loadings imply (this is the classic "correlation goes to 1 in a crisis" phenomenon).

**Redesign:**
Add a second-stage copula at the category level:

```
Stage 1: Trend-level copula (current) → generates per-trend samples
Stage 2: Category aggregation → produces category-level shift samples
Stage 3: Category-level t-copula → adjusts joint tail behavior
```

The category correlation matrix would be:
- Hair sub-categories: ρ=0.5-0.7 (shared consumer base, shared channels)
- LHC sub-categories: ρ=0.4-0.6 (shared manufacturing, shared retailers)
- Cross-division (Hair vs. LHC): ρ=0.15-0.25 (macro only: GDP, input costs)

**Goldman perspective:** This is standard practice in portfolio risk. You don't just model individual asset returns and hope the portfolio distribution emerges correctly. You explicitly model the portfolio-level copula because the tails behave differently at the portfolio level than at the asset level.

**Estimated impact:** Significant for scenario analysis. The "Perfect Storm" scenario (t-copula at 1st percentile) would produce ~30% wider confidence intervals at the total-portfolio level.

---

### Change 3: Separate "Pool Size Shift" from "Pool Share Shift"

**Current design flaw:**
The model conflates two fundamentally different phenomena into a single "GP1 shift %":

1. **Pool Size Shift** — The total category profit pool grows or shrinks (e.g., premiumization expands the Hair Care pool, cost-of-living shrinks it)
2. **Pool Share Shift** — Henkel's share of the pool changes (e.g., Private Label gains share, competitive innovation captures share)

These are governed by different forces and have different strategic responses:
- Pool shrinking → you can't fix this with better execution. You need portfolio reallocation.
- Share loss in a growing pool → this is an execution/innovation problem. Fix the brand, fix the shelf.

**Redesign:**
Each trend should carry two separate impact dimensions:

```python
@dataclass
class Trend:
    # ... existing fields ...
    pool_size_impact: int = 3       # 1-5: how much does this change total pool?
    pool_share_impact: int = 3      # 1-5: how much does this change our share?
    pool_size_direction: str = "Expansion"
    pool_share_direction: str = "Expansion"
```

The Shift Matrix output becomes:

```json
{
  "Hair: Color": {
    "2030": {
      "pool_size_shift": { "median": -0.02, "p10": -0.01, "p90": -0.04 },
      "pool_share_shift": { "median": -0.01, "p10": 0.00, "p90": -0.03 },
      "net_gp1_shift": { "median": -0.03, "p10": -0.01, "p90": -0.07 }
    }
  }
}
```

Where: `net_gp1_shift ≈ (1 + pool_size_shift) × (1 + pool_share_shift) - 1`

**Why this is the most strategically valuable change:**
An ExCo member looking at "Hair: Color = -3.2%" needs to know: "Is the pool shrinking, or are we losing share?" Because the strategic response is completely different. Currently they can't tell.

**Bain perspective:** Every profit pool study we've done for consumer goods separates pool dynamics from share dynamics. They're different muscles — one is category management, the other is brand/execution. Conflating them leads to wrong resource allocation decisions.

**Estimated impact:** Transformational for strategy utility. Doesn't change the math much but doubles the actionability of the output.

---

### Change 4: Replace Linear Materialization with Trend-Specific Adoption Curves

**Current design flaw:**
All trends within a force share the same materialization S-curve. A PFAS ban (regulatory step function — near-zero until enforcement, then rapid compliance) and "premiumization in Hair Care" (gradual consumer behavior shift) both use the same curve.

The force-level overrides help (Government = front-loaded, Technology = back-loaded), but within each force, all trends still share the same curve.

**Redesign:**
Each trend carries its own materialization curve type:

```python
class MaterializationCurve:
    """Trend-specific materialization profile."""

    PROFILES = {
        "regulatory_step":    {2026: 0.05, 2027: 0.10, 2028: 0.70, 2029: 0.95, 2030: 1.00},
        "gradual_behavioral": {2026: 0.12, 2027: 0.28, 2028: 0.50, 2029: 0.75, 2030: 1.00},
        "tech_adoption":      {2026: 0.03, 2027: 0.08, 2028: 0.25, 2029: 0.55, 2030: 1.00},
        "structural_shift":   {2026: 0.15, 2027: 0.30, 2028: 0.50, 2029: 0.70, 2030: 0.85},
        "crisis_triggered":   {2026: 0.40, 2027: 0.65, 2028: 0.80, 2029: 0.90, 2030: 1.00},
        "already_underway":   {2026: 0.25, 2027: 0.45, 2028: 0.65, 2029: 0.82, 2030: 1.00},
    }
```

The `start_year` field already exists on trends — combine it with the curve type to auto-compute the materialization profile. A trend with `start_year=2028` and `curve_type="regulatory_step"` would show near-zero impact through 2027, then rapid jump in 2028-2029.

**Goldman perspective:** In fixed income, you don't apply a single yield curve shift to all instruments. Curve steepeners affect the 10Y differently than the 2Y. Same principle: different trends "mature" along different paths.

**Estimated impact:** Moderate for aggregate shifts, significant for velocity/trigger analysis. Early-warning triggers become much more precise when the materialization curve matches the actual adoption dynamics.

---

### Change 5: Add "Trend Interaction Effects" (Beyond Force-Level Propagation)

**Current design flaw:**
The causal DAG operates at the force level: Government→Technology, Consumer→Customer. But some of the most powerful profit pool shifts come from *trend-level* interactions that the force-level DAG misses.

**Example:** "GLP-1 drugs reducing beauty spending" (Consumer trend, C-02) + "Premiumization in Hair Care" (Consumer trend, C-03) are *both* Consumer force, so they get correlated via the within-force copula (ρ=0.3). But they actually work in *opposite directions* and should have negative correlation. GLP-1 reduces volume at the low end; premiumization increases value at the high end. The net effect on Hair Care is ambiguous, but the current model treats them as mildly positively correlated.

**Redesign:**
Allow explicit trend-level interaction overrides:

```python
@dataclass
class TrendInteraction:
    trend_a: str           # e.g., "consumer_r02"  (GLP-1)
    trend_b: str           # e.g., "consumer_r03"  (Premiumization)
    correlation_override: float  # -0.4 (they partially cancel)
    mechanism: str         # "GLP-1 reduces volume; premiumization increases value"

    # Optional: amplification effect
    # When both trends are strong, the combined effect is > or < sum
    amplification: float = 1.0  # >1 = amplifying, <1 = dampening
```

These overrides would patch the copula correlation matrix at specific (i,j) entries, without disrupting the broader force-level structure.

**Why this is feasible:** You don't need to specify all N×N interactions. Focus on the top 10-15 pairs where expert judgment says the force-level correlation is misleading. The Delphi process can identify these: "Which trends reinforce or counteract each other?"

**Estimated impact:** Moderate. Improves accuracy in categories where opposing trends coexist within the same force (common in Consumer and Competitive forces).

---

### Change 6: Regime-Switching for Macro Environments

**Current design flaw:**
The model assumes a single probability distribution for each trend across all macro environments. But a "cost-of-living crisis" regime fundamentally changes which trends dominate. In a recession, Consumer trends related to trading down accelerate while premiumization stalls. In a growth regime, the opposite occurs.

The current scenario engine partially addresses this (you can run "Price War" or "Green Squeeze" scenarios), but scenarios are one-off analyses. In reality, the macro regime should shift the *baseline* probability distributions, not just add scenario overlays.

**Redesign:**
Define 3-4 macro regimes and allow the model to weight them:

```python
MACRO_REGIMES = {
    "growth": {
        "probability": 0.35,
        "trend_adjustments": {
            "premiumization": {"probability_shift": +1},
            "cost_of_living": {"probability_shift": -1},
            "innovation_adoption": {"probability_shift": +1},
        }
    },
    "stagnation": {
        "probability": 0.40,
        "trend_adjustments": {}  # baseline
    },
    "recession": {
        "probability": 0.20,
        "trend_adjustments": {
            "premiumization": {"probability_shift": -1},
            "cost_of_living": {"probability_shift": +1},
            "private_label": {"probability_shift": +1},
        }
    },
    "disruption": {
        "probability": 0.05,
        "trend_adjustments": {
            "tech_disruption": {"impact_shift": +1},
            "regulatory": {"probability_shift": +1},
        }
    }
}
```

The Monte Carlo would run as a mixture model: each iteration first draws a regime (from the regime probability distribution), then adjusts trend priors according to that regime, then runs the standard copula sampling. The output is a regime-weighted mixture of distributions.

**Goldman perspective:** This is standard in rates/credit quant modeling. You never price a 5-year derivative under a single vol regime. You use regime-switching models (Hamilton, Markov-switching) because the underlying dynamics fundamentally change between states. FMCG profit pools have the same property.

**Estimated impact:** Significant for tail analysis. The p90 estimates would become more realistic because they'd include the conditional probability of being in an adverse regime — which is where the real strategic risk lives.

---

## Priority Ranking

If I had to sequence these for implementation, the ranking based on **strategic value ÷ implementation effort**:

| Priority | Change | Strategic Value | Effort | Recommendation |
|----------|--------|-----------------|--------|----------------|
| **1** | Pool Size vs. Pool Share separation | Transformational | Medium | **Do this first.** It changes how ExCo reads the output. |
| **2** | Weighted trend aggregation (by materiality) | High | Low | Quick win. A few lines of code. |
| **3** | Trend-specific materialization curves | High | Low-Medium | Mostly data work (assigning curve types). |
| **4** | Category-level correlation structure | High | Medium | Matters most for scenario analysis quality. |
| **5** | Trend interaction effects | Medium | Medium | Targeted overrides for the top 15 pairs. |
| **6** | Regime-switching macro model | Medium-High | High | Most complex. Save for v3.1 after backtesting. |

---

## What I Would NOT Change

A few things that might seem tempting but would be mistakes:

**Don't switch to a factor model.** It's tempting (Goldman heritage) to decompose everything into orthogonal factors. But FMCG profit pools don't have clean factor structure. The 6 forces are interpretable and actionable precisely *because* they're not orthogonal. Executives can reason about "Government regulation is driving this." They can't reason about "Factor 3 explains 18% of variance."

**Don't add more forces.** Six is right. Any more creates cognitive overload for the strategy team. The taxonomy {Consumer, Customer, Technology, Government, Environmental, Competitive} maps directly to how FMCG strategists think. The urge to add "Macroeconomic" or "Internal Capabilities" should be resisted — macro effects should flow through the existing forces (macro → Consumer trading down), and internal capabilities are not market forces.

**Don't abandon the multiplicative compounding.** Additive models (just sum up all the shifts) are simpler but wrong. Forces interact. A simultaneous regulatory shock AND competitive price war creates compounded margin pressure, not additive pressure.

**Don't over-engineer the competitive response model.** Nash equilibrium in FMCG is a theoretical nicety, not a practical tool. P&G's response to a Henkel move depends on their CFO's mood that quarter, not on equilibrium calculus. Keep the game theory layer as directional intelligence, not predictive precision.

---

## Calibration Recommendations

Beyond structural changes, two calibration improvements:

**1. Attenuation should be category-specific, not global.**
The current global attenuation (0.5) assumes every category dampens external forces equally. But Hair: Color (fragmented, innovation-driven) responds differently to the same force than LHC: HDW (concentrated, commodity-like). Recommendation: fit category-specific attenuation factors from backtest data. Start with 3 groups: Hair categories (0.45-0.55), LHC premium (0.40-0.50), LHC commodity (0.55-0.65).

**2. The `gp1_pct_affected` values need annual review and backtesting.**
The initial calibration is well-reasoned but essentially expert opinion. After one year of running PRISM: compare predicted shifts to actual market evolution, and recalibrate `gp1_pct_affected` values where the prediction error is systematic (e.g., if Environmental trends consistently over-predict, the `gp1_pct_affected` values for that force are too high).

---

## Verdict

If I were presenting PRISM to a DAX-40 CEO Strategy Board today, I would present the current v2.1 with confidence, with the caveat that the pool-size vs. pool-share separation (Change 3) should be the immediate next sprint. It's the difference between a tool that says "Hair Color shrinks 3%" and a tool that says "The Hair Color pool shrinks 2%, and we lose 1% share — and here's what to do about each."

The weighted aggregation (Change 2) and trend-specific materialization (Change 4) are quick wins that should be bundled into the same sprint. Together, these three changes elevate PRISM from "sophisticated simulation engine" to "strategic decision platform" — which is what ExCo actually needs.

---

*Review conducted in the capacity of: Bain Consumer Practice Senior Partner × Goldman Sachs Quantitative Strategies MD*
*Model reviewed: PRISM v2.1 (Bayesian Copula + Causal DAG + gp1_pct_affected)*
