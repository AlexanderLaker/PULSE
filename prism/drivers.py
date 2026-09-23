"""The Profit Pool Driver, the checks it must pass to be simulated, and the driver set."""

import copy
import math
from collections import Counter
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
    # The stored row's revision when the driver was loaded (0 before it is
    # stored); an admin edit must name it, so a concurrent edit is refused.
    revision: int = 0
    probability_prior: tuple = field(init=False, default=(3, 3))
    normalized_score: float = field(init=False, default=0.0)

    def __post_init__(self):
        self.recompute()

    def recompute(self) -> None:
        """Refresh the Beta prior and the expected signed score from the scores.

        normalized_score = E[p] x gp1_pct_affected x direction, the
        deterministic counterpart of what the engine samples per iteration.
        A score simulation_problems() reports (a missing probability, say)
        gives neutral values here instead of an exception, so the driver can
        still be listed and corrected; the engine refuses to simulate it.
        """
        from prism.config import beta_prior_for
        try:
            self.probability_prior = beta_prior_for(self.probability, self.uncertainty)
        except (TypeError, ValueError):
            self.probability_prior = (3, 3)
        a, b = self.probability_prior
        gp1 = self.gp1_pct_affected
        gp1 = float(gp1) if isinstance(gp1, (int, float)) and math.isfinite(gp1) else 0.0
        self.normalized_score = a / (a + b) * gp1 * self.direction_sign

    def scores(self) -> dict:
        """A copy of the driver's SCORE_FIELDS."""
        return {name: copy.deepcopy(getattr(self, name)) for name in SCORE_FIELDS}

    @property
    def direction_sign(self) -> int:
        return 1 if self.direction == "Expansion" else -1


def _score_in_range(value, low: int, high: int) -> bool:
    """A whole number (int or integral float, never a bool) from low to high."""
    return (not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(value)
            and value == int(value) and low <= value <= high)


def simulation_problems(drivers) -> list:
    """Why these drivers cannot be simulated, one line per problem; empty when they can.

    Every check guards against a value the engine would otherwise read with a
    silent default and turn into confident numbers: an unknown force (it
    would count as Consumer), an unknown direction (as Contraction), an
    unknown diffusion curve (as the S-curve), a missing or impossible GP1
    share (NaN everywhere), a probability or uncertainty outside its scale,
    and exposure scores outside 0-5 or on a name outside the taxonomy (never
    read). Duplicate ids are refused as well.
    """
    from prism.config import CATEGORIES, FORCES, REGIONS, VALID_DIFFUSION_CURVES, VC_STEPS
    problems = [f"driver id {i!r} appears {n} times" for i, n in Counter(d.id for d in drivers).items() if n > 1]
    for d in drivers:
        where = f"driver {d.id}"
        if d.force not in FORCES:
            problems.append(f"{where}: unknown force {d.force!r}")
        if d.direction not in ("Expansion", "Contraction"):
            problems.append(f"{where}: direction {d.direction!r} is neither Expansion nor Contraction")
        if not _score_in_range(d.probability, 1, 5):
            problems.append(f"{where}: probability {d.probability!r} is not a whole number from 1 to 5")
        gp1 = d.gp1_pct_affected
        if isinstance(gp1, bool) or not isinstance(gp1, (int, float)) or not (0 < gp1 <= 1):
            problems.append(f"{where}: gp1_pct_affected {gp1!r} is not a share in (0, 1]")
        if d.uncertainty is not None and not _score_in_range(d.uncertainty, 0, 5):
            problems.append(f"{where}: uncertainty {d.uncertainty!r} is not a whole number from 0 to 5")
        if d.diffusion_curve and d.diffusion_curve not in VALID_DIFFUSION_CURVES:
            problems.append(f"{where}: unknown diffusion curve {d.diffusion_curve!r}")
        for name, exposure, keys in (("category_exposure", d.category_exposure, CATEGORIES),
                                     ("regional_exposure", d.regional_exposure, REGIONS),
                                     ("vc_exposure", d.vc_exposure, VC_STEPS)):
            for key, score in (exposure or {}).items():
                if key not in keys:
                    problems.append(f"{where}: {name} names {key!r}, which is not in the taxonomy")
                elif not _score_in_range(score, 0, 5):
                    problems.append(f"{where}: {name}[{key!r}] = {score!r} is not a whole number from 0 to 5")
    return problems


class InvalidDriversError(ValueError):
    """Drivers that cannot be simulated; the message lists every problem."""

    def __init__(self, problems: list):
        self.problems = list(problems)
        shown = self.problems[:20]
        more = f"\n  ... and {len(self.problems) - 20} more" if len(self.problems) > 20 else ""
        super().__init__("the drivers cannot be simulated:\n  " + "\n  ".join(shown) + more)


@dataclass
class DriverSet:
    """The drivers a simulation runs on."""
    drivers: list = field(default_factory=list)       # [Driver]

    @property
    def driver_count(self) -> int:
        return len(self.drivers)

    def get_driver_by_id(self, driver_id: str) -> Optional[Driver]:
        for d in self.drivers:
            if d.id == driver_id:
                return d
        return None
