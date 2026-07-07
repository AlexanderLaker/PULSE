"""Pydantic request models — extracted from pulse/api/app.py (June 2026 split, review F4).
Behavior-identical move; see app.py for assembly.
"""
from typing import Optional, Any

from pydantic import BaseModel, Field, field_validator

from pulse.config import FORCES, CATEGORIES

class SimulationRequest(BaseModel):
    # The response/results bundle is dict-shaped (not pydantic-modeled); since
    # (the journey_decomposition key was removed 2026-07-07, O3) alongside
    # shift_matrix / decompositions / totals / vc_decomposition.
    iterations: int = Field(5000, ge=1, le=100000)  # 1 to 100k iterations
    # D21 sweep: `include_sensitivity` removed — the SensitivityEngine it
    # toggled was deleted in v3.2; the flag has been a silent no-op since.
    # B6: RNG seed control. `seed` runs once with that seed (reproducible).
    # `seeds` runs the engine once per seed and reports seed-wobble (the
    # spread of the headline shift across runs) so leadership can see how
    # much of any single headline number is real signal vs RNG luck.
    seed: Optional[int] = Field(None, ge=0, le=2**32 - 1,
        description="RNG seed for reproducibility. If omitted and `seeds` is "
                    "also omitted, defaults to 42.")
    seeds: Optional[list[int]] = Field(None,
        description="Run the engine multiple times (one per seed) and report "
                    "seed-wobble (median + spread). For ExCo headlines.")
    # A5: Multi-chain convergence diagnostics. Default is 3 chains for proper
    # split-R̂ (Vehtari 2021) + integrated-autocorrelation ESS. Set to 1 for
    # legacy single-chain mode (not recommended for production).
    n_chains: int = Field(3, ge=1, le=8,
        description="Number of independent MCMC chains for convergence "
                    "diagnostics. Default 3 for rigorous split-R̂ (Vehtari 2021). "
                    "Set to 1 for legacy single-chain mode.")
    # T2 (June 2026): the attenuation sensitivity-band request flags were
    # removed — the deployed service is read-only (F2) and the spec positions
    # the model as carrying no live sensitivity exhibit.

    @field_validator("iterations")
    @classmethod
    def validate_iterations(cls, v):
        if v < 1:
            raise ValueError("iterations must be positive")
        return v

    @field_validator("seeds")
    @classmethod
    def validate_seeds(cls, v):
        if v is None:
            return v
        if len(v) < 1 or len(v) > 10:
            raise ValueError("seeds list must have between 1 and 10 entries")
        if any(s < 0 or s >= 2**32 for s in v):
            raise ValueError("each seed must be a uint32")
        return v

class TrendCreate(BaseModel):
    """Create a new trend (from scanner 'Add to Model' or manual entry)."""
    force: str
    name: str
    description: str = ""
    direction: str = "Expansion"
    probability: int = Field(3, ge=1, le=5)
    category_exposure: Optional[dict] = None   # {"Hair: Color": 3, ...}
    vc_exposure: Optional[dict] = None
    regional_exposure: Optional[dict] = None
    strategic_implication: str = ""
    data_source: str = ""
    confidence: str = "Medium"
    ai_suggested: bool = True
    gp1_pct_affected: Optional[float] = Field(None, ge=0.0, le=1.0, description="Fraction of category GP1 exposed (0.0-1.0)")
    peak_year: Optional[int] = Field(None, ge=2025, le=2035)
    diffusion_curve: Optional[str] = None
    sources: Optional[list] = Field(None,
        description="List of {title, url, source_type, tier} dicts. "
                    "At least one source rated B- or better is required "
                    "before the trend will pass the credibility gate.")

class TrendUpdate(BaseModel):
    probability: Optional[int] = Field(None, ge=1, le=5)
    direction: Optional[str] = None
    gp1_pct_affected: Optional[float] = Field(None, ge=0.0, le=1.0,
        description="Fraction of category GP1 exposed to this trend (0.0-1.0)")
    category_exposure: Optional[dict] = None
    vc_exposure: Optional[dict] = None
    regional_exposure: Optional[dict] = None
    name: Optional[str] = None
    description: Optional[str] = None
    strategic_implication: Optional[str] = None
    sources: Optional[list] = None
    peak_year: Optional[int] = Field(None, ge=2025, le=2035,
        description="Year when 100% of trend impact materializes (0 = default 2030)")
    diffusion_curve: Optional[str] = Field(None,
        description="Materialization shape: s_curve, linear, front_loaded, back_loaded, step_function")

class ProposalUpdate(BaseModel):
    """Partial multi-expert score proposal (PUT /trends/{id}/proposals).

    Every field is optional: the body carries only what the caller is
    changing. The handler merges the SET fields into the caller's own row
    via `model_fields_set` so an absent field is never confused with an
    explicit null. Identity (user_id/name/role) comes from the auth
    dependency, NOT from the body.
    """
    probability: Optional[int] = Field(None, ge=1, le=5)
    gp1_pct_affected: Optional[float] = Field(None, ge=0.0, le=1.0)
    peak_year: Optional[int] = Field(None, ge=2025, le=2035)
    diffusion_curve: Optional[str] = None
    category_exposure: Optional[dict] = None   # {"Hair: Color": 0-5, ...}
    regional_exposure: Optional[dict] = None   # {"Europe": 0-5, ...}
    vc_exposure: Optional[dict] = None          # {"Packaging": 0-5, ...}
    comment: Optional[str] = None               # free-text expert note


class ShockRequest(BaseModel):
    shocked_force: str
    magnitude: float = Field(0.3)
    years: int = Field(5, ge=1, le=10)


class ConfigUpdate(BaseModel):
    attenuation_source: Optional[str] = Field(None,
        description="'calibrated_v3.5_april2026' | 'calibrated_v3.1_april2026' "
                    "(legacy) | 'admin_override'. ('assumed' was retired with "
                    "the v3.5 structured-judgment overlap correction.)")
    force_weights: Optional[dict] = None
    vc_weights: Optional[dict] = None
    region_weights: Optional[dict] = None
    category_weights: Optional[dict] = None
    force_correlation_matrix: Optional[dict] = Field(None,
        description="6×6 force correlation matrix for copula. "
                    "Each force maps to a dict with all 6 forces. "
                    "Diagonal must be 1.0, off-diagonal in [0,1].")
    force_overlap_matrix: Optional[dict] = Field(None,
        description="6×6 cross-force overlap matrix for attenuation. "
                    "Asymmetric by design (narrow forces are 'covered' by "
                    "broad forces more than vice versa). Off-diagonal in "
                    "[0, 0.45].")
    within_force_overlap: Optional[dict] = Field(None,
        description="Per-force within-force cohesion scalar. "
                    "Dict mapping each of the 6 forces to a float in [0, 0.5].")
    iterations: Optional[int] = Field(None, ge=1000, le=100000)
    within_force_rho: Optional[float] = Field(None, ge=0.0, le=0.9)
    # D20 (June 2026): t_copula_df removed — Gaussian copula only.
    dry_run: Optional[bool] = Field(False,
        description="If true, validate the proposed config and return the "
                    "diff without applying it. Useful for previewing admin "
                    "changes before commit.")


class SnapshotCreate(BaseModel):
    # M12 (July 2026 review, tightened after adversarial re-review): the
    # free-text fields are length-bounded at the schema so the payload cap in
    # the router can't be bypassed through `name`/`notes`.
    name: str = Field(..., min_length=1, max_length=200)
    shifts: dict
    trends: list = []
    trend_count: int = 0
    net_shift: float = 0.0
    notes: Optional[str] = Field(None, max_length=4000)
