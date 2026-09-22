"""The Profit Pool Driver and the set of drivers a simulation runs on."""

import copy
from dataclasses import dataclass, field
from typing import Optional

#: The scores experts can propose; a driver's baseline records the same fields.
SCORE_FIELDS = ("probability", "gp1_pct_affected", "peak_year", "diffusion_curve", "uncertainty",
                "category_exposure", "regional_exposure", "vc_exposure")

#: Every editable field that feeds the model: the scores plus the direction.
#: An admin edit to any of them sets ``scores_edited``.
MODEL_FIELDS = ("direction",) + SCORE_FIELDS


@dataclass
class Driver:
    """One external driver of the HCB profit pool, with its scores.

    ``probability_prior`` and ``normalized_score`` are derived from the scores
    and cannot be passed in; call ``recompute()`` after changing a score.
    """
    id: str                           # e.g. "consumer_r01"; the display code is "C-01"
    force: str                        # one of config.FORCES
    name: str = ""
    description: str = ""
    direction: str = "Expansion"      # "Expansion" | "Contraction"
    probability: int = 3              # 1-5; the Beta prior's mean is probability / 6
    start_year: int = 2028            # onset: no effect up to this year
    analysis: str = ""                # the PRISM Analysis reading (generated, read-only)
    category_exposure: dict = field(default_factory=dict)  # {category: 0-5}
    vc_exposure: dict = field(default_factory=dict)        # {value-chain step: 0-5}
    regional_exposure: dict = field(default_factory=dict)  # {region: 0-5}
    data_source: str = ""             # one-line summary of the evidence
    sources: list = field(default_factory=list)           # [{title, url, tier, note}]
    confidence: str = "Medium"        # how well the present state is evidenced (display only)
    # Share of the category's gross profit the driver can move at full
    # materialisation, in (0, 1]. There is no default: a driver without it
    # cannot be simulated.
    gp1_pct_affected: Optional[float] = None
    # Year by which the full effect has materialised; 0 means "not scored",
    # in which case the force's default schedule applies.
    peak_year: int = 0
    diffusion_curve: str = "s_curve"  # one of config.VALID_DIFFUSION_CURVES
    uncertainty: Optional[int] = None  # 0-5, see config.UNCERTAINTY_KAPPA; None = not scored
    # The scores the driver was seeded with (see scores()): the reference the
    # Drivers page compares expert proposals and later edits against.
    baseline: Optional[dict] = None
    scores_edited: bool = False       # an admin has changed a MODEL_FIELDS value since seeding
    probability_prior: tuple = field(init=False, default=(3, 3))
    normalized_score: float = field(init=False, default=0.0)

    def __post_init__(self):
        self.recompute()

    def recompute(self) -> None:
        """Refresh the Beta prior and the expected signed score from the scores.

        normalized_score = E[p] x gp1_pct_affected x direction, the
        deterministic counterpart of what the engine samples per iteration.
        """
        from prism.config import beta_prior_for
        if self.uncertainty is not None:
            self.uncertainty = max(0, min(5, int(self.uncertainty)))
        self.probability_prior = beta_prior_for(self.probability, self.uncertainty)
        a, b = self.probability_prior
        gp1 = self.gp1_pct_affected if self.gp1_pct_affected is not None else 0.0
        self.normalized_score = a / (a + b) * gp1 * self.direction_sign

    def scores(self) -> dict:
        """A copy of the driver's SCORE_FIELDS."""
        return {name: copy.deepcopy(getattr(self, name)) for name in SCORE_FIELDS}

    @property
    def direction_sign(self) -> int:
        return 1 if self.direction == "Expansion" else -1


@dataclass
class DriverSet:
    """The drivers a simulation runs on, with the taxonomy they are scored in."""
    drivers: list = field(default_factory=list)       # [Driver]
    categories: list = field(default_factory=list)
    forces: list = field(default_factory=list)

    @property
    def driver_count(self) -> int:
        return len(self.drivers)

    def get_driver_by_id(self, driver_id: str) -> Optional[Driver]:
        for d in self.drivers:
            if d.id == driver_id:
                return d
        return None
