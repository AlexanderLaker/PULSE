"""Pydantic request models — extracted from pulse/api/app.py (June 2026 split, review F4).
Behavior-identical move; see app.py for assembly.
"""
from typing import Optional, Any

from pydantic import BaseModel, Field, field_validator

from pulse.config import FORCES, CATEGORIES

class SimulationRequest(BaseModel):
    iterations: int = Field(5000, ge=1, le=100000)  # 1 to 100k iterations
    include_sensitivity: bool = False
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
    # F3: Attenuation sensitivity band — flex the attenuation factor by
    # ±`attenuation_band_pct` and attach a headline band so ExCo sees
    # the single biggest model-assumption lever as a range not a point.
    include_attenuation_band: bool = Field(False,
        description="If True, also run the engine at attenuation × (1 ± pct) "
                    "and attach an 'attenuation_band' dict to the result.")
    attenuation_band_pct: float = Field(0.30, ge=0.05, le=0.90,
        description="Fractional flex applied to the attenuation factor for "
                    "the sensitivity band. Default ±30%.")

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

class ShockRequest(BaseModel):
    shocked_force: str
    magnitude: float = Field(0.3)
    years: int = Field(5, ge=1, le=10)


class ConfigUpdate(BaseModel):
    attenuation_source: Optional[str] = Field(None,
        description="'assumed' | 'admin_override'")
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
    t_copula_df: Optional[int] = Field(None, ge=2, le=30)
    dry_run: Optional[bool] = Field(False,
        description="If true, validate the proposed config and return the "
                    "diff without applying it. Useful for previewing admin "
                    "changes before commit.")


class SnapshotCreate(BaseModel):
    name: str
    shifts: dict
    trends: list = []
    trend_count: int = 0
    net_shift: float = 0.0
    notes: Optional[str] = None
