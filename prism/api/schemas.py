"""Request bodies of the write endpoints."""
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, StrictInt, model_validator

from prism.config import BASE_YEAR, DEFAULT_PATH_YEARS, VALID_DIFFUSION_CURVES, VC_STAGES
from prism.drivers import CONFIDENCE_LEVELS, DIRECTIONS, SOURCE_FIELD_LIMITS, SOURCE_TIERS, SOURCE_URL_PATTERN

#: The years a peak year can take: after the base year, within the horizon.
#: The API also refuses a peak year at or before the driver's own onset.
FIRST_PEAK, LAST_PEAK = BASE_YEAR + 1, DEFAULT_PATH_YEARS[-1]


def one_of(values):
    """The type of a field that takes exactly one of the values; a refusal names them all."""
    return Literal[tuple(values)]


Direction = one_of(DIRECTIONS)
Confidence = one_of(CONFIDENCE_LEVELS)
Curve = one_of(VALID_DIFFUSION_CURVES)
Stage = one_of(VC_STAGES)
Tier = one_of(("",) + SOURCE_TIERS)


def _not_a_bool(value):
    if isinstance(value, bool):
        raise ValueError("a share is a number, not true or false")
    return value


#: A number that JSON's true and false do not pass for (the whole-number
#: scores are StrictInt for the same reason).
Share = Annotated[float, BeforeValidator(_not_a_bool)]


class SourceRef(BaseModel):
    """One piece of evidence behind a driver: a title, an http(s) link, or
    both; its credibility tier (empty when unrated) and when it was
    published."""
    model_config = ConfigDict(extra="forbid")

    title: str = Field("", max_length=SOURCE_FIELD_LIMITS["title"])
    url: str = Field("", max_length=SOURCE_FIELD_LIMITS["url"], pattern=f"^({SOURCE_URL_PATTERN})?$")
    tier: Tier = ""
    published: str = Field("", max_length=SOURCE_FIELD_LIMITS["published"])

    @model_validator(mode="after")
    def _title_or_url(self):
        if not (self.title.strip() or self.url.strip()):
            raise ValueError("a source needs a title or a URL")
        return self


class DriverUpdate(BaseModel):
    """Admin edit of a driver (PUT /api/v1/drivers/{id}).

    ``revision`` is the driver revision the edit was made on (from GET
    /api/v1/drivers); the edit is refused if the driver has changed since.
    Every other field is optional and only the fields sent change (none may
    be sent as null); an exposure map may name only the cells that change,
    and ``vc_epicentre`` names one value-chain stage. The name, the force and
    the onset (start year) come from the driver base and are not edited here;
    a peak year must come after the onset.
    """
    model_config = ConfigDict(extra="forbid")

    revision: StrictInt = Field(..., ge=1)
    description: str | None = Field(None, max_length=20000)
    direction: Direction | None = None
    probability: StrictInt | None = Field(None, ge=1, le=5)
    gp1_pct_affected: Share | None = Field(None, gt=0.0, le=1.0)
    peak_year: StrictInt | None = Field(None, ge=FIRST_PEAK, le=LAST_PEAK)
    diffusion_curve: Curve | None = None
    uncertainty: StrictInt | None = Field(None, ge=0, le=5)
    confidence: Confidence | None = None
    category_exposure: dict | None = None
    regional_exposure: dict | None = None
    vc_epicentre: Stage | None = None
    sources: list[SourceRef] | None = None


class ProposalUpdate(BaseModel):
    """An expert's partial score proposal (PUT /api/v1/drivers/{id}/proposals).

    Only the fields sent are merged into the caller's own proposal; a field
    sent as null is cleared. The caller's identity comes from the verified
    token, never from the body.
    """
    model_config = ConfigDict(extra="forbid")

    probability: StrictInt | None = Field(None, ge=1, le=5)
    gp1_pct_affected: Share | None = Field(None, gt=0.0, le=1.0)
    peak_year: StrictInt | None = Field(None, ge=FIRST_PEAK, le=LAST_PEAK)
    diffusion_curve: Curve | None = None
    uncertainty: StrictInt | None = Field(None, ge=0, le=5)
    category_exposure: dict | None = None
    regional_exposure: dict | None = None
    vc_epicentre: Stage | None = None
    comment: str | None = None
