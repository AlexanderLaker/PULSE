"""The Profit Pool Driver, the checks it must pass to be simulated, and the driver set."""

import copy
from collections import Counter
from dataclasses import dataclass, field
from typing import Optional

from prism.numbers import finite_number, whole_in_range

#: The scores experts can propose; a driver's baseline records the same fields.
SCORE_FIELDS = ("probability", "gp1_pct_affected", "peak_year", "diffusion_curve", "uncertainty",
                "category_exposure", "regional_exposure", "vc_epicentre")

#: Every editable field that feeds the model: the scores plus the direction.
#: An admin edit to any of them sets ``scores_edited``.
MODEL_FIELDS = ("direction",) + SCORE_FIELDS

#: The two directions of a driver's effect on gross profit.
DIRECTIONS = ("Expansion", "Contraction")
#: How well a driver's present state is evidenced; shown, never simulated.
CONFIDENCE_LEVELS = ("High", "Medium", "Low")
#: The credibility tiers of a source, strongest first (docs/DRIVERS.md,
#: Sources); lib/format.ts SOURCE_TIERS holds the same list. A source may be
#: unrated ("").
SOURCE_TIERS = ("S", "A", "A-", "B+", "B", "B-", "C", "D", "E")
#: A source's link, when it has one: an http(s) address without spaces, which
#: the dashboard renders as a link. The API, the driver base and the migration
#: hold every link to it.
SOURCE_URL_PATTERN = r"https?://\S+"
#: The most characters a source's title, link and publication note may hold.
SOURCE_FIELD_LIMITS = {"title": 500, "url": 2000, "published": 500}


@dataclass
class Driver:
    """One external driver of the HCB profit pool, with its scores.

    No score has a default: a driver that misses one cannot be simulated
    (simulation_problems says which), and the database stores none without
    all of them. ``probability_prior`` and ``expected_effect`` are derived
    from the scores and cannot be passed in; call ``recompute()`` after
    changing a score.
    """
    id: str                           # e.g. "consumer_r01"; the display code is "C-01"
    force: str                        # one of config.FORCES
    name: str = ""
    description: str = ""
    direction: Optional[str] = None   # "Expansion" | "Contraction"
    probability: Optional[int] = None  # 1-5; the Beta prior's mean is probability / 6
    # Onset: no effect up to and including this year, or the base year when that is later.
    start_year: Optional[int] = None
    category_exposure: dict = field(default_factory=dict)  # {category: 0-5}, every category
    regional_exposure: dict = field(default_factory=dict)  # {region: 0-5}, every region
    vc_epicentre: Optional[str] = None  # the value-chain stage where the impact centres (config.VC_STAGES)
    sources: list = field(default_factory=list)           # [{title, url, tier, published}]
    # High, Medium or Low: how well the present state is evidenced (display only).
    confidence: Optional[str] = None
    # Share of the category's gross profit the driver can move at full
    # materialisation, in (0, 1]. There is no default: a driver without it
    # cannot be simulated.
    gp1_pct_affected: Optional[float] = None
    # Year by which the full effect has materialised: after the onset.
    peak_year: Optional[int] = None
    diffusion_curve: Optional[str] = None  # one of config.VALID_DIFFUSION_CURVES
    uncertainty: Optional[int] = None  # 0-5, see config.UNCERTAINTY_KAPPA
    # The scores the driver was seeded with (see scores()): the reference the
    # Drivers page compares expert proposals and later edits against.
    baseline: Optional[dict] = None
    scores_edited: bool = False       # an admin has changed a MODEL_FIELDS value since seeding
    # The stored row's revision when the driver was loaded (0 before it is
    # stored); an admin edit must name it, so a concurrent edit is refused.
    revision: int = 0
    probability_prior: Optional[tuple] = field(init=False, default=None)
    expected_effect: Optional[float] = field(init=False, default=None)

    def __post_init__(self):
        self.recompute()

    def recompute(self) -> None:
        """Refresh the Beta prior and the expected signed effect from the scores.

        expected_effect = E[p] x gp1_pct_affected x direction, the
        deterministic counterpart of what the engine samples per iteration.
        While a score they need is missing or off its scale (the probability
        and uncertainty for the prior; those, the GP1 share and the direction
        for the effect), they are None: such a driver can still be built and
        checked (simulation_problems), but it has no prior and no effect.
        """
        from prism.config import beta_prior_for
        try:
            self.probability_prior = beta_prior_for(self.probability, self.uncertainty)
        except (TypeError, ValueError):
            self.probability_prior = None
        gp1 = self.gp1_pct_affected
        if (self.probability_prior is None or not (finite_number(gp1) and 0 < gp1 <= 1)
                or self.direction not in DIRECTIONS):
            self.expected_effect = None
            return
        a, b = self.probability_prior
        self.expected_effect = a / (a + b) * float(gp1) * self.direction_sign

    def scores(self) -> dict:
        """A copy of the driver's SCORE_FIELDS."""
        return {name: copy.deepcopy(getattr(self, name)) for name in SCORE_FIELDS}

    @property
    def direction_sign(self) -> int:
        """+1 for an expansion, -1 for a contraction; a driver with neither has no sign (KeyError)."""
        return {"Expansion": 1, "Contraction": -1}[self.direction]


def simulation_problems(drivers) -> list:
    """Why these drivers cannot be simulated, one line per problem; empty when they can.

    The engine reads every score as it is and guesses none, so every score
    must be there and on its scale: a known force, direction, diffusion curve
    and value-chain epicentre; a GP1 share in (0, 1]; a probability from 1 to
    5 and an uncertainty from 0 to 5; a start year and a peak year after the
    onset; and a whole-number score from 0 to 5 for every category and every
    region, under the taxonomy's names only. Duplicate ids are refused as
    well.
    """
    from prism.config import CATEGORIES, FORCES, REGIONS, VALID_DIFFUSION_CURVES, VC_STAGES, first_peak_year
    problems = [f"driver id {i!r} appears {n} times" for i, n in Counter(d.id for d in drivers).items() if n > 1]
    for d in drivers:
        where = f"driver {d.id}"
        if d.force not in FORCES:
            problems.append(f"{where}: unknown force {d.force!r}")
        if d.direction not in DIRECTIONS:
            problems.append(f"{where}: direction {d.direction!r} is neither Expansion nor Contraction")
        if not whole_in_range(d.probability, 1, 5):
            problems.append(f"{where}: probability {d.probability!r} is not a whole number from 1 to 5")
        gp1 = d.gp1_pct_affected
        if not (finite_number(gp1) and 0 < gp1 <= 1):
            problems.append(f"{where}: gp1_pct_affected {gp1!r} is not a share in (0, 1]")
        if not whole_in_range(d.uncertainty, 0, 5):
            problems.append(f"{where}: uncertainty {d.uncertainty!r} is not a whole number from 0 to 5")
        if d.diffusion_curve not in VALID_DIFFUSION_CURVES:
            problems.append(f"{where}: diffusion curve {d.diffusion_curve!r} is not one of {VALID_DIFFUSION_CURVES}")
        if not whole_in_range(d.start_year, 2000, 2100):
            problems.append(f"{where}: start year {d.start_year!r} is not a year")
        elif not whole_in_range(d.peak_year, first_peak_year(d.start_year), 2100):
            problems.append(f"{where}: peak year {d.peak_year!r} is not a year after the onset "
                            f"(from {first_peak_year(d.start_year)})")
        if d.vc_epicentre not in VC_STAGES:
            problems.append(f"{where}: value-chain epicentre {d.vc_epicentre!r} is not one of {VC_STAGES}")
        for name, exposure, keys in (("category_exposure", d.category_exposure, CATEGORIES),
                                     ("regional_exposure", d.regional_exposure, REGIONS)):
            exposure = exposure if isinstance(exposure, dict) else {}
            missing = [k for k in keys if k not in exposure]
            if missing:
                problems.append(f"{where}: {name} has no score for {', '.join(missing)}")
            for key, score in exposure.items():
                if key not in keys:
                    problems.append(f"{where}: {name} names {key!r}, which is not in the taxonomy")
                elif not whole_in_range(score, 0, 5):
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
