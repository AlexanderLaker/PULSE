"""Request bodies of the write endpoints."""
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SourceRef(BaseModel):
    """One piece of evidence behind a driver: a title, a link, or both."""
    model_config = ConfigDict(extra="forbid")

    title: str = Field("", max_length=500)
    url: str = Field("", max_length=2000)
    tier: str = Field("", pattern="^(|S|A|A-|B\\+|B|B-|C|D|E)$")
    note: str = Field("", max_length=500)

    @model_validator(mode="after")
    def _title_or_url(self):
        if not (self.title.strip() or self.url.strip()):
            raise ValueError("a source needs a title or a URL")
        return self


class DriverUpdate(BaseModel):
    """Admin edit of a driver (PUT /api/v1/drivers/{id}).

    ``revision`` is the driver revision the edit was made on (from GET
    /api/v1/drivers); the edit is refused if the driver has changed since.
    Every other field is optional and only the fields sent change;
    ``uncertainty`` may be sent as null to clear the score, and an exposure
    map may name only the cells that change. The name, the force and the
    onset (start year) come from the driver base and are not edited here; a
    peak year must come after the onset.
    """
    model_config = ConfigDict(extra="forbid")

    revision: int = Field(..., ge=1)
    description: Optional[str] = Field(None, max_length=20000)
    direction: Optional[str] = Field(None, pattern="^(Expansion|Contraction)$")
    probability: Optional[int] = Field(None, ge=1, le=5)
    gp1_pct_affected: Optional[float] = Field(None, gt=0.0, le=1.0)
    peak_year: Optional[int] = Field(None, ge=2025, le=2035)
    diffusion_curve: Optional[str] = None
    uncertainty: Optional[int] = Field(None, ge=0, le=5)
    confidence: Optional[str] = Field(None, pattern="^(High|Medium|Low)$")
    category_exposure: Optional[dict] = None
    vc_exposure: Optional[dict] = None
    regional_exposure: Optional[dict] = None
    sources: Optional[list[SourceRef]] = None


class ProposalUpdate(BaseModel):
    """An expert's partial score proposal (PUT /api/v1/drivers/{id}/proposals).

    Only the fields sent are merged into the caller's own proposal; a field
    sent as null is cleared. The caller's identity comes from the verified
    token, never from the body.
    """
    model_config = ConfigDict(extra="forbid")

    probability: Optional[int] = Field(None, ge=1, le=5)
    gp1_pct_affected: Optional[float] = Field(None, ge=0.0, le=1.0)
    peak_year: Optional[int] = Field(None, ge=2025, le=2035)
    diffusion_curve: Optional[str] = None
    uncertainty: Optional[int] = Field(None, ge=0, le=5)
    category_exposure: Optional[dict] = None
    regional_exposure: Optional[dict] = None
    vc_exposure: Optional[dict] = None
    comment: Optional[str] = None
