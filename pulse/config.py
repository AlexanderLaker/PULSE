"""Global configuration for PRISM engine."""

from dataclasses import dataclass, field
from typing import Optional
import json

# ── Force taxonomy ──────────────────────────────────────────────────
FORCES = ["Consumer", "Customer", "Technology", "Government", "Environmental", "Competitive"]

# ── Category taxonomy ───────────────────────────────────────────────
CATEGORIES = [
    "Hair: Color", "Hair: Care", "Hair: Styling", "Hair: Body",
    "LHC: FCN", "LHC: FCA", "LHC: FFI", "LHC: LAD",
    "LHC: HDW", "LHC: ADW", "LHC: HSC", "LHC: IC",
]

# ── Value chain steps ───────────────────────────────────────────────
VC_STEPS = [
    "Raw Materials", "Formulation", "Manufacturing", "Packaging",
    "Supply Chain", "Marketing", "Commercial", "Consumer"
]


def vc_epicentre_of(vc_exposure: Optional[dict]) -> Optional[int]:
    """1-based value-chain epicentre stage of a vc_exposure profile, or None.

    2.9.0 (July 2026 VC-epicentre redesign): experts score the value chain
    as a SINGLE epicentre stage (the Trends editor's slider); the stored
    8-step 0–5 profile is a serialization format, not eight independent
    judgments. This function is the engine-side twin of ``epicentreOf`` in
    components/dashboard/Trends2.tsx and MUST stay behaviourally identical —
    both are pinned against the same fixture table
    (tests/test_vc_epicentre.py ↔ tests/frontend/vcEpicentre.test.ts):

      • read each VC_STEPS entry case-/snake_case-tolerantly (old payloads
        stored keys like "supply_chain"),
      • None when the profile is missing / empty / all-zero (unscored),
      • otherwise the max-scoring stage; ties resolve toward the
        exposure-weighted centroid (deterministic; first stage wins an
        exact-distance tie, matching the TS `<` comparison).

    Legacy arbitrary profiles (pre-slider expert grids) collapse through the
    same rule, so no data migration is needed and engine and UI can never
    disagree about a trend's stage.
    """
    if not vc_exposure:
        return None
    # Case-/snake_case-insensitive lookup (mirror of the TS readVCExposure).
    norm_map = {str(k).lower().replace(" ", "_"): float(v or 0.0)
                for k, v in vc_exposure.items()}
    vs = [norm_map.get(s.lower().replace(" ", "_"), 0.0) for s in VC_STEPS]
    total = sum(vs)
    if total <= 0:
        return None
    mx = max(vs)
    centroid = sum(v * (i + 1) for i, v in enumerate(vs)) / total
    best: Optional[int] = None
    for i, v in enumerate(vs):
        if v != mx:
            continue
        if best is None or abs(i + 1 - centroid) < abs(best - centroid):
            best = i + 1
    return best


def vc_epicentre_step_of(vc_exposure: Optional[dict]) -> Optional[str]:
    """Canonical VC_STEPS name of a profile's epicentre stage, or None."""
    stage = vc_epicentre_of(vc_exposure)
    return VC_STEPS[stage - 1] if stage is not None else None

# ── Regional taxonomy ──────────────────────────────────────────────
REGIONS = ["Europe", "North America", "Asia", "High Growth"]

# ── Consumer-journey taxonomy (v3.6 journey layer) ──────────────────
# Stage ids are the single source of truth shared with the frontend
# journey content module (data/consumerJourney.ts) and the
# trend_journey_exposure table. Exposure keys are namespaced
# "<journey>:<stage_id>" (e.g. "lhc:add_products", "hair:diagnose").
# The LHC journey is usage-stage (laundry; Home Care journey pending),
# the Hair journey is hybrid (includes pre-purchase decision stages).
# (The consumer-journey stage taxonomy — LHC_JOURNEY_STAGES / HAIR_JOURNEY_STAGES /
# JOURNEY_STAGES / CATEGORY_JOURNEY — was removed 2026-07-07, owner ruling O3,
# together with the quantitative journey_exposure layer. The qualitative journey
# UI keeps its own stage definitions in data/consumerJourney.ts.)

# ── Default model parameters ────────────────────────────────────────
# v3.5 recalibration (April 2026, 99-trend base). Each value equals what the
# cross-force overlap matrix yields for that force via the identity
#   eff_att_i = 0.5 × (1 − mean(O[i][j] for j≠i))
# so the runtime engine consumes them directly — there is no base × (1−overlap)
# step anywhere. The six values span 0.40–0.50 and reflect the spread between
# tightly-coupled Customer signal (0.401) and loosely-coupled Consumer (0.495)
# / Competitive (0.479) signal in the expanded Henkel trend-space.
#
# Provenance per force (v3.5 — delta vs v3.1 in parens):
#   force            cross-force row mean   eff_att_NEW   (Δ v3.1)
#   Consumer                       0.010        0.495      (+0.013)
#   Customer                       0.198        0.401      (-0.017)
#   Technology                     0.132        0.434      (-0.001)
#   Government                     0.170        0.415      (+0.012)
#   Environmental                  0.164        0.418      (+0.005)
#   Competitive                    0.042        0.479      (-0.007)
#
# Trend-weighted mean across the 99 trends = 0.4523 (v3.1 sanity ~= 0.446).
# J0 random-pair baseline = 0.4525 (v3.1 was 0.4846).
# Source: data/Attenuation_Calibration_v3_5.xlsx (Summary sheet).
DEFAULT_PER_FORCE_ATTENUATION = {
    "Consumer":      0.495,
    "Customer":      0.401,
    "Technology":    0.434,
    "Government":    0.415,
    "Environmental": 0.418,
    "Competitive":   0.479,
}
DEFAULT_ATTENUATION_SOURCE = "calibrated_v3.5_april2026"  # valid sources: "calibrated_v3.5_april2026" | "calibrated_v3.1_april2026" (legacy) | "admin_override"
# DEFAULT_NEUTRAL_THRESHOLD deleted (July 2026): defined + validated since v1
# but consumed nowhere in the engine — an inert dial, removed per design
# philosophy #8 (like scalar attenuation v3.2 and t_copula_df D20). Old
# config snapshots carrying it are tolerated by ModelConfig.from_json.
DEFAULT_ITERATIONS = 10_000
DEFAULT_BASE_YEAR = 2025
DEFAULT_PATH_YEARS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035]

# Materialization schedule: S-curve for how much of total impact has materialized
DEFAULT_MATERIALIZATION = {
    2026: 0.08,
    2027: 0.18,
    2028: 0.32,
    2029: 0.48,
    2030: 0.62,
    2031: 0.74,
    2032: 0.84,
    2033: 0.91,
    2034: 0.96,
    2035: 1.00,
}

# Force-specific materialization overrides (legacy — used when trend has no diffusion_curve)
REGULATORY_MATERIALIZATION = {
    2026: 0.05, 2027: 0.15, 2028: 0.40, 2029: 0.60, 2030: 0.75,
    2031: 0.85, 2032: 0.92, 2033: 0.97, 2034: 0.99, 2035: 1.00,
}
TECHNOLOGY_MATERIALIZATION = {
    2026: 0.04, 2027: 0.10, 2028: 0.22, 2029: 0.40, 2030: 0.58,
    2031: 0.72, 2032: 0.83, 2033: 0.91, 2034: 0.98, 2035: 1.00,
}
CONSUMER_MATERIALIZATION = {
    2026: 0.10, 2027: 0.22, 2028: 0.38, 2029: 0.54, 2030: 0.68,
    2031: 0.79, 2032: 0.87, 2033: 0.93, 2034: 0.98, 2035: 1.00,
}

FORCE_MATERIALIZATION_OVERRIDES = {
    "Government": REGULATORY_MATERIALIZATION,
    "Technology": TECHNOLOGY_MATERIALIZATION,
    "Consumer": CONSUMER_MATERIALIZATION,
}

# ── MECE Diffusion Curve Types ──────────────────────────────────────
# Each curve maps a normalized progress (0→1) to a materialization fraction.
VALID_DIFFUSION_CURVES = ["s_curve", "linear", "front_loaded", "back_loaded", "step_function"]

def compute_materialization_schedule(
    peak_year: int,
    diffusion_curve: str,
    path_years: list[int] | None = None,
    base_year: int = DEFAULT_BASE_YEAR,
) -> dict[int, float]:
    """
    Compute a year→fraction materialization schedule for a single trend.

    Args:
        peak_year: year when 100% impact materializes (0 = use last path year)
        diffusion_curve: one of VALID_DIFFUSION_CURVES
        path_years: list of years to compute fractions for
        base_year: start year (fraction = 0.0)

    Returns:
        dict mapping each path year to a fraction in [0.0, 1.0]
    """
    import math
    years = path_years or DEFAULT_PATH_YEARS
    py = peak_year if peak_year and peak_year > base_year else years[-1]

    schedule = {}
    for year in years:
        if year >= py:
            schedule[year] = 1.0
            continue
        # t = normalized progress from base_year to peak_year: 0.0 → 1.0
        span = max(py - base_year, 1)
        t = max(0.0, min(1.0, (year - base_year) / span))

        if diffusion_curve == "linear":
            frac = t
        elif diffusion_curve == "front_loaded":
            # Concave: sqrt curve — fast early, flattens
            frac = math.sqrt(t)
        elif diffusion_curve == "back_loaded":
            # Convex: quadratic — slow early, accelerates
            frac = t * t
        elif diffusion_curve == "step_function":
            # Near-zero until 80% of the way, then jumps
            frac = 0.05 if t < 0.8 else (0.05 + (t - 0.8) / 0.2 * 0.95)
        else:  # s_curve (default)
            # Logistic S-curve centered at t=0.5
            frac = 1.0 / (1.0 + math.exp(-12 * (t - 0.5)))
            # Normalize so frac(0)≈0 and frac(1)≈1
            f0 = 1.0 / (1.0 + math.exp(-12 * (0 - 0.5)))
            f1 = 1.0 / (1.0 + math.exp(-12 * (1 - 0.5)))
            frac = (frac - f0) / (f1 - f0)

        schedule[year] = round(max(0.0, min(1.0, frac)), 4)

    # Defensive monotonicity guarantee. Every supported curve is mathematically
    # non-decreasing across [0, 1], but rounding and any future curve definition
    # could in principle break that — and a non-monotonic materialization
    # schedule would silently produce nonsensical paths (a category "un-shifting"
    # year-over-year). Enforce it at the source.
    sorted_years = sorted(schedule.keys())
    for i in range(1, len(sorted_years)):
        prev_year, curr_year = sorted_years[i - 1], sorted_years[i]
        if schedule[curr_year] < schedule[prev_year]:
            raise ValueError(
                f"compute_materialization_schedule produced a non-monotonic "
                f"schedule for diffusion_curve='{diffusion_curve}', peak_year="
                f"{peak_year}: year {curr_year} ({schedule[curr_year]}) is "
                f"less than year {prev_year} ({schedule[prev_year]}). This is "
                f"a model bug — please report it."
            )

    return schedule

# ── Default weights ─────────────────────────────────────────────────
# DEFAULT_VC_WEIGHTS deleted (2.9.0, July 2026): with the VC lens computed
# as a categorical epicentre partition, a per-step weight has no defensible
# meaning (it would silently re-weight expert stage votes). At its equal
# default it cancelled in the share normalization — an inert dial, removed
# per design philosophy #8 (like neutral_threshold and t_copula_df).
# ModelConfig.from_json tolerates it in old snapshots.
DEFAULT_FORCE_WEIGHTS = {f: 1.0 / len(FORCES) for f in FORCES}  # Equal: ~16.7%
DEFAULT_REGION_WEIGHTS = {r: 1.0 / len(REGIONS) for r in REGIONS}  # Equal: 25%
DEFAULT_CATEGORY_WEIGHTS = {c: 1.0 / len(CATEGORIES) for c in CATEGORIES}  # Equal: ~8.3%

# ── Copula parameters ──────────────────────────────────────────────
# D20 (June 2026): DEFAULT_T_COPULA_DF deleted with the t-copula tail layer.
# Post-D1 re-test showed the df dial inert (<2% portfolio band effect across
# df 4 → ∞); the engine runs a Gaussian copula. See
# audit/strategy-review/verification/v8_d20_tcopula_df_out.txt.
DEFAULT_WITHIN_FORCE_RHO = 0.3
DEFAULT_RESIDUAL_CROSS_RHO = 0.05


def build_trend_correlation_matrix(trend_forces, within_force_rho, force_correlation_matrix):
    """Raw N×N trend-level correlation matrix (NO positive-definite repair).

    Single source of truth (T16, June 2026) for the matrix implied by
    (within_force_rho, force_correlation_matrix) over a trend population given
    by ``trend_forces`` (a list of force names, one per trend). Same-force pairs
    take ``within_force_rho``; cross-force pairs take the configured pairwise
    value or ``DEFAULT_RESIDUAL_CROSS_RHO``.

    Used by BOTH the engine (``_build_correlation_matrix``, which then applies
    PSD repair) and the config validator's spectral gate
    (``correlation_lambda_min``) so the two can never drift apart.
    """
    import numpy as np
    n = len(trend_forces)
    if n == 0:
        return np.eye(0)
    R = np.eye(n)
    fcm = force_correlation_matrix or {}
    for i in range(n):
        fi = trend_forces[i]
        row = fcm.get(fi, {})
        for j in range(i + 1, n):
            if fi == trend_forces[j]:
                rho = within_force_rho
            else:
                rho = row.get(trend_forces[j], DEFAULT_RESIDUAL_CROSS_RHO)
            R[i, j] = R[j, i] = rho
    return R

# ── Force Overlap Matrix (replaces flat attenuation) ────────────────
# Cross-force mechanism overlap: O[i][j] = fraction of force i's signal
# that is already captured by force j. Asymmetric — "Government captures
# 40% of Environmental's signal" ≠ "Environmental captures 40% of
# Government's signal."
#
# Purpose: When compounding forces multiplicatively, forces that share
# underlying mechanisms (e.g., PFAS regulation = both Government AND
# Environmental) double-count impact. The overlap matrix replaces the
# blunt 0.5 flat attenuation with a principled per-force dampening.
#
# Effective attenuation per force i:
#   eff_att_i = base_attenuation × (1 - mean(O[i][j] for j ≠ i))
#
# Example: Government overlaps 40% with Environmental, 20% with Technology,
#   15% with Customer, 10% with Consumer, 5% with Competitive →
#   mean overlap = 0.18 → eff_att = 0.5 × (1 - 0.18) = 0.41
#
# Rationale per pair (FMCG/Henkel context):
#   Gov ↔ Env 0.40/0.35: PFAS ban, DPP, PPWR are both regulatory AND
#     environmental; strongest overlap in the model
#   Consumer ↔ Env 0.20/0.25: sustainability preference = consumer behavior
#     AND environmental pressure; moderate overlap
#   Consumer ↔ Competitive 0.20/0.15: consumer shifts drive competitive
#     repositioning; cause-and-effect, not same mechanism
#   Gov ↔ Tech 0.20/0.15: regulation triggers reformulation R&D; distinct
#     mechanisms but linked spending
#   Customer ↔ Competitive 0.25/0.20: channel power and competitive dynamics
#     intertwined (PL, discounter strategy)
#   Tech ↔ Competitive 0.15/0.20: tech creates competitive gaps; moderate
#   Consumer ↔ Customer 0.15/0.20: consumer demand shapes channel; moderate
#   Other pairs: ≤0.10 (largely independent mechanisms)

DEFAULT_FORCE_OVERLAP_MATRIX = {
    # ── CALIBRATED from 99-trend empirical analysis (April 2026, v3.5) ──
    # Methodology: excess-overlap-above-baseline + force-size asymmetry + mechanism adjustment
    #
    # Step 1 (empirical): Computed mean pairwise weighted Jaccard between each
    #   pair of trends across every cross-force combination in the 99-trend db.
    #   Converted to "excess overlap": max(0, mean_J - J₀) / (1 - J₀) where
    #   J₀ = 0.453 is the random-pair baseline across all trends. This removes
    #   the structural-overlap floor (baseline FMCG scorecell similarity) and
    #   isolates the signal.
    # Step 2 (asymmetry): Multiplied by sqrt(n_j / n_i) capped at 1.5× to
    #   reflect that a narrow force is more likely "covered" by a broad one.
    # Step 3 (mechanism): Additive adjustment ±0.05-0.10 per cell based on
    #   documented FMCG causal couplings (see mechanism notes inline below).
    #
    # Top calibrated couplings (from 0 to 0.432):
    #   Environmental→Government  0.432  (PFAS, PPWR, EUDR, DPP: regulatory+ESG)
    #   Government→Environmental  0.405  (same, reverse direction)
    #   Government→Technology     0.367  (regulation triggers reformulation R&D)
    #   Customer→Government       0.300  (retailer compliance burden scales w/ reg)
    #   Customer→Technology       0.266  (retail media / agentic = customer tech)
    #   Environmental→Technology  0.266  (supply constraints drive bio-chem)
    #   Technology→Government     0.237  (AI Act, DPP digital mandates)
    #   Customer→Government       0.200  (PPWR, CSRD impact retailers)
    #   Technology→Customer       0.183  (digital commerce infrastructure)
    #
    # Consumer and Competitive rows ≈ 0 for most cells because Consumer has 23
    # highly diverse trends (including 6 geo-regional trends that are structurally
    # unlike all other forces) and Competitive has 12 competitor-specific trends
    # that are each mechanistically independent. Only mechanism-coupling floors
    # preserve non-zero values: Consumer→Competitive (0.08) via dupe↔indie, and
    # a handful of small cross-links.
    #
    # See also: attenuation_source = "calibrated_v3.5_april2026"
    # Exported matrix: data/Attenuation_Calibration.xlsx (Cross-Force_Matrix sheet)
    "Consumer":      {"Consumer": 0.0,  "Customer": 0.050, "Technology": 0.000, "Government": 0.000, "Environmental": 0.050, "Competitive": 0.080},
    "Customer":      {"Consumer": 0.000, "Customer": 0.0,  "Technology": 0.266, "Government": 0.300, "Environmental": 0.163, "Competitive": 0.090},
    "Technology":    {"Consumer": 0.000, "Customer": 0.183, "Technology": 0.0,  "Government": 0.237, "Environmental": 0.148, "Competitive": 0.080},
    "Government":    {"Consumer": 0.000, "Customer": 0.200, "Technology": 0.367, "Government": 0.0,  "Environmental": 0.405, "Competitive": 0.000},
    "Environmental": {"Consumer": 0.050, "Customer": 0.118, "Technology": 0.266, "Government": 0.432, "Environmental": 0.0,  "Competitive": 0.000},
    "Competitive":   {"Consumer": 0.050, "Customer": 0.087, "Technology": 0.000, "Government": 0.000, "Environmental": 0.000, "Competitive": 0.0},
}

# ── Within-Force Overlap ───────────────────────────────────────────
# How much do trends WITHIN the same force overlap in mechanism?
# When 15 Consumer trends score a category, many capture overlapping
# phenomena (clean beauty ≈ conscious consumption ≈ premiumization).
# The within-force overlap dampens the sum of trend scores within a
# force to avoid over-counting.
#
# Applied as: dampened_sum = raw_sum × (1 - overlap × (n_active - 1) / n_active)
# Where n_active = number of trends with non-zero exposure for that category.
#
# Example: Consumer has 15 trends, 8 expose Hair Color, overlap = 0.25
#   dampening = 1 - 0.25 × (8-1)/8 = 1 - 0.219 = 0.781
#   So the raw sum is reduced by ~22%
#
# Rationale:
#   Consumer 0.25: many trends overlap (clean beauty, sustainability pref,
#     premiumization, silver economy all share "willingness to pay more")
#   Government 0.30: EU legislative push creates correlated regulatory trends
#     (PFAS, DPP, PPWR, Green Claims all stem from European Green Deal)
#   Environmental 0.30: interconnected (PFAS, water stress, climate, circular
#     economy all stem from planetary boundaries framework)
#   Technology 0.15: more distinct mechanisms (biotech ≠ AI ≠ concentrated)
#   Customer 0.20: channel trends moderately overlap (discounter growth,
#     PL penetration, retail media all about retailer power)
#   Competitive 0.15: competitor-specific trends are more independent

DEFAULT_WITHIN_FORCE_OVERLAP = {
    # ── CALIBRATED from 99-trend empirical analysis (April 2026, v3.5) ──
    # Methodology: mean pairwise weighted Jaccard over 12-category exposure
    # vectors WITHIN each force, converted to excess-overlap above the
    # 99-trend random-pair baseline J₀ = 0.453, then adjusted ±0.03-0.10
    # for mechanism-cluster density vs. diversity.
    #
    # Empirical signal per force (raw mean J → excess → final):
    #   Government     0.678 → 0.376 → 0.426   [8 of 12 trends from EU Green Deal]
    #   Environmental  0.597 → 0.219 → 0.269   [tight climate→water→palm→energy web]
    #   Technology     0.579 → 0.182 → 0.232   [AI cluster (8) + bio-chem cluster (5)]
    #   Customer       0.566 → 0.157 → 0.157   [channel power cluster + digital cluster]
    #   Consumer       0.387 → 0.000 → 0.100   [23 diverse trends, floor-clamped]
    #   Competitive    0.455 → 0.000 → 0.100   [competitor-specific independent; floor]
    #
    # Rationale for top-of-range Government (0.426):
    #   government_r01-r07 + r10-r12 all stem from European Green Deal: PFAS, micro-
    #   plastics, Omnibus VII/VIII, PPWR, Green Claims, EUDR, DPP, AI Act, biodiv,
    #   textile circularity. Shared regulatory DNA = genuine mechanism redundancy.
    #
    # Rationale for floor-clamped Consumer (0.100):
    #   23 trends span premiumization (r03, r09, r21), sustainability (r04, r13),
    #   demographics (r05, r08, r24), occasions (r07, r14, r15), geographic (r17-
    #   r20), value trading (r01, r06, r11, r22). Mean J = 0.387, same as baseline.
    #   Empirical signal of excess = 0, clamped at 0.10 to preserve light dampening.
    #
    # Rationale for floor-clamped Competitive (0.100):
    #   competitive_r01-r12 are each about a DIFFERENT competitor (Reckitt, P&G,
    #   Unilever, L'Oreal, K-beauty, C-beauty, Chinese brands, Amazon, DTC wave,
    #   NVIDIA partnership, IMEA growth divergence). Genuinely independent
    #   strategies, no mechanism redundancy. Empirical excess = 0.
    #
    # See also: data/Attenuation_Calibration.xlsx (Within-Force_Overlap sheet)
    "Consumer":      0.100,  # was 0.22 | empirical excess 0.00, floor-clamped
    "Customer":      0.157,  # was 0.22 | empirical excess 0.16
    "Technology":    0.232,  # was 0.20 | empirical excess 0.18 + mech +0.05
    "Government":    0.426,  # was 0.35 | empirical excess 0.38 + mech +0.05 (top)
    "Environmental": 0.269,  # was 0.32 | empirical excess 0.22 + mech +0.05
    "Competitive":   0.100,  # was 0.15 | empirical excess 0.00, floor-clamped
}

# ── Force correlation matrix (cross-force correlations for copula) ──────
# v3.6 RECALIBRATION (June 2026, audit finding F-01): the previous matrix
# (off-diagonals 0.05-0.30, "DAG weights × 0.5") was NOT positive semi-
# definite once expanded to the 99-trend population with within-force
# rho = 0.3 (min eigenvalue -1.68). The engine silently repaired it on every
# run, rescaling ALL correlations to ~0.37x their configured values — so the
# configured dependence was never the effective dependence.
# Fix: the same relative coupling structure scaled by 0.73 (the largest
# uniform scale keeping the implied 99-trend matrix comfortably PSD,
# min eigenvalue ~0.14). These values are now valid AS ENTERED: the engine's
# PSD repair no longer fires on defaults, and PUT /api/v1/config rejects
# settings that would make the implied matrix invalid (spectral gate).
DEFAULT_FORCE_CORRELATIONS = {
    "Consumer":      {"Consumer": 1.0,  "Customer": 0.18, "Technology": 0.11, "Government": 0.04, "Environmental": 0.15, "Competitive": 0.15},
    "Customer":      {"Consumer": 0.18, "Customer": 1.0,  "Technology": 0.11, "Government": 0.15, "Environmental": 0.04, "Competitive": 0.18},
    "Technology":    {"Consumer": 0.11, "Customer": 0.11, "Technology": 1.0,  "Government": 0.22, "Environmental": 0.11, "Competitive": 0.18},
    "Government":    {"Consumer": 0.04, "Customer": 0.15, "Technology": 0.22, "Government": 1.0,  "Environmental": 0.22, "Competitive": 0.04},
    "Environmental": {"Consumer": 0.15, "Customer": 0.04, "Technology": 0.11, "Government": 0.22, "Environmental": 1.0,  "Competitive": 0.04},
    "Competitive":   {"Consumer": 0.15, "Customer": 0.18, "Technology": 0.18, "Government": 0.04, "Environmental": 0.04, "Competitive": 1.0},
}

@dataclass(frozen=True)
class ModelConfig:
    """Complete model configuration snapshot.

    B4: frozen=True. Instances are immutable. Any caller that wants to
    "change" a parameter must build a new instance via ``copy_with(**overrides)``.
    This eliminates the race condition where, e.g., sensitivity sweeps
    mutated ``self.config.attenuation`` mid-run while another request
    was reading it. It also keeps every simulation run tied to a single,
    hashable config identity which is useful for caching and audit.
    """
    region: str = "Global"
    aggregation_method: str = "Multiplicative"
    # v3.2: scalar ``attenuation`` removed. The engine consumes a per-force
    # dict directly. Source-of-truth is data/Attenuation_Calibration.xlsx.
    per_force_attenuation: dict = field(default_factory=lambda: dict(DEFAULT_PER_FORCE_ATTENUATION))
    attenuation_source: str = DEFAULT_ATTENUATION_SOURCE  # "calibrated_v3.5_april2026" | "calibrated_v3.1_april2026" (legacy) | "admin_override"
    base_year: int = DEFAULT_BASE_YEAR
    path_years: list = field(default_factory=lambda: list(DEFAULT_PATH_YEARS))
    materialization: dict = field(default_factory=lambda: dict(DEFAULT_MATERIALIZATION))
    force_weights: dict = field(default_factory=lambda: dict(DEFAULT_FORCE_WEIGHTS))
    # vc_weights deleted (2.9.0): the VC lens is an epicentre partition —
    # see DEFAULT_VC_WEIGHTS tombstone above. from_json drops the old key.
    region_weights: dict = field(default_factory=lambda: dict(DEFAULT_REGION_WEIGHTS))
    category_names: list = field(default_factory=lambda: list(CATEGORIES))
    category_weights: dict = field(default_factory=lambda: dict(DEFAULT_CATEGORY_WEIGHTS))
    iterations: int = DEFAULT_ITERATIONS
    within_force_rho: float = DEFAULT_WITHIN_FORCE_RHO
    force_correlation_matrix: dict = field(default_factory=lambda: dict(DEFAULT_FORCE_CORRELATIONS))
    force_overlap_matrix: dict = field(default_factory=lambda: dict(DEFAULT_FORCE_OVERLAP_MATRIX))
    within_force_overlap: dict = field(default_factory=lambda: dict(DEFAULT_WITHIN_FORCE_OVERLAP))

    def to_json(self) -> str:
        return json.dumps(self.__dict__, default=str)

    @classmethod
    def from_json(cls, s: str) -> "ModelConfig":
        """Reconstruct from a JSON snapshot, tolerating retired fields.

        Older config snapshots may carry fields the model no longer has
        (e.g. ``t_copula_df``, deleted in D20, the v3.2-retired scalar
        ``attenuation``, ``neutral_threshold``, deleted July 2026 as
        engine-inert, or ``vc_weights``, deleted in 2.9.0 with the VC
        epicentre partition). Unknown keys are dropped rather than crashing.
        """
        from dataclasses import fields as _fields
        data = json.loads(s)
        known = {f.name for f in _fields(cls)}
        return cls(**{k: v for k, v in data.items() if k in known})

    def copy_with(self, **overrides) -> "ModelConfig":
        """Return a new ModelConfig with the given fields replaced.

        Use this instead of mutating in place. Deep-copies dict/list fields
        that aren't in ``overrides`` so modifying the returned instance's
        mutable members does not bleed back into the original.
        """
        from dataclasses import fields as _fields
        import copy as _copy
        values = {}
        for f in _fields(self):
            if f.name in overrides:
                values[f.name] = overrides[f.name]
            else:
                v = getattr(self, f.name)
                if isinstance(v, (dict, list)):
                    values[f.name] = _copy.deepcopy(v)
                else:
                    values[f.name] = v
        return ModelConfig(**values)
