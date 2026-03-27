"""Scenario engine — causal scenario propagation through the DAG.

Instead of independently shocking all forces, scenarios shock a primary force
and let the causal DAG propagate the effects. This means a regulatory shock
has a different propagation signature than a technology shock.
"""

import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np

from pulse.config import FORCES, ModelConfig
from pulse.causal.dag import CausalDAG

logger = logging.getLogger(__name__)


@dataclass
class Scenario:
    """A scenario definition with primary shocks and DAG propagation."""
    id: str
    name: str
    description: str = ""
    primary_shocks: dict = field(default_factory=dict)  # {force: magnitude}
    propagate_via_dag: bool = True
    probability_weight: float = 0.0  # User-assigned scenario probability

    def get_effective_overrides(self, dag: Optional[CausalDAG] = None) -> dict:
        """
        Compute effective force overrides including DAG propagation.

        If propagate_via_dag is True and a DAG is provided, shocks propagate
        through causal edges. Otherwise, only direct shocks apply.
        """
        if not self.propagate_via_dag or dag is None:
            return dict(self.primary_shocks)

        effective = dict(self.primary_shocks)

        for shocked_force, magnitude in self.primary_shocks.items():
            propagated = dag.propagate_shock_to_forces(shocked_force, magnitude)
            for target_force, prop_magnitude in propagated.items():
                if target_force not in self.primary_shocks:
                    effective[target_force] = effective.get(target_force, 0) + prop_magnitude

        return effective


# ── Pre-defined scenarios ───────────────────────────────────────────

BASE_CASE = Scenario(
    id="base",
    name="Base Case",
    description="Current scores, causal DAG active, no external shocks",
    primary_shocks={},
    propagate_via_dag=True,
)

GREEN_SQUEEZE = Scenario(
    id="green_squeeze",
    name="Green Squeeze",
    description="Environmental regulation accelerates → propagates to reformulation costs, "
                "shelf prices, and consumer willingness to pay",
    primary_shocks={"Environmental": 0.3, "Government": 0.2},
    propagate_via_dag=True,
)

TECH_DISRUPTION = Scenario(
    id="tech_disruption",
    name="Tech Disruption",
    description="Technology force accelerates → propagates to consumer adoption, "
                "competitive gaps, and channel economics",
    primary_shocks={"Technology": 0.4},
    propagate_via_dag=True,
)

PRICE_WAR = Scenario(
    id="price_war",
    name="Price War",
    description="Competitive intensity spikes → propagates to margin pressure, "
                "trading down, and channel power shift",
    primary_shocks={"Competitive": 0.35, "Customer": 0.15},
    propagate_via_dag=True,
)

REGULATORY_CASCADE = Scenario(
    id="regulatory_cascade",
    name="Regulatory Cascade",
    description="Government/regulatory force shocks → cascades through "
                "technology (reformulation), customer (compliance costs), "
                "and environmental (codified green standards)",
    primary_shocks={"Government": 0.5},
    propagate_via_dag=True,
)

REGULATORY_RELIEF = Scenario(
    id="regulatory_relief",
    name="Regulatory Relief",
    description="Government/regulatory pressure eases → less reformulation cost, "
                "more pricing flexibility",
    primary_shocks={"Government": -0.3},
    propagate_via_dag=True,
)

PERFECT_STORM = Scenario(
    id="perfect_storm",
    name="Perfect Storm",
    description="Correlated tail event — all contraction forces at extreme levels. "
                "Uses t-copula tail dependence to model crisis correlation.",
    primary_shocks={f: 0.3 for f in FORCES},  # All forces shocked
    propagate_via_dag=False,  # Direct shock, not propagated (it IS the tail)
)

BLUE_SKY = Scenario(
    id="blue_sky",
    name="Blue Sky",
    description="All expansion forces at +1σ — best-case scenario",
    primary_shocks={f: -0.2 for f in FORCES},  # Negative = less contraction
    propagate_via_dag=False,
)

BUILTIN_SCENARIOS = {
    s.id: s for s in [BASE_CASE, GREEN_SQUEEZE, TECH_DISRUPTION, PRICE_WAR,
                       REGULATORY_CASCADE, REGULATORY_RELIEF, PERFECT_STORM, BLUE_SKY]
}


class ScenarioEngine:
    """Manages scenarios and runs comparative analysis."""

    def __init__(self, config: ModelConfig, dag: Optional[CausalDAG] = None):
        self.config = config
        self.dag = dag
        self.scenarios = dict(BUILTIN_SCENARIOS)
        self.custom_scenarios = {}

    def add_custom_scenario(self, scenario: Scenario):
        self.custom_scenarios[scenario.id] = scenario
        self.scenarios[scenario.id] = scenario

    def get_scenario(self, scenario_id: str) -> Optional[Scenario]:
        return self.scenarios.get(scenario_id)

    def get_all_scenarios(self) -> dict:
        return dict(self.scenarios)

    def compare_scenarios(self, scenario_ids: list, mc_results: dict) -> dict:
        """
        Compare multiple scenario results side-by-side.

        Args:
            scenario_ids: list of scenario IDs to compare
            mc_results: {scenario_id: mc_result_dict} from BayesianMC runs

        Returns:
            Comparison table with deltas between scenarios
        """
        comparison = {}
        base_id = "base"

        for cat in self.config.category_names:
            comparison[cat] = {}
            base_median = self._get_final_median(mc_results.get(base_id, {}), cat)

            for sid in scenario_ids:
                if sid not in mc_results:
                    continue
                scenario_median = self._get_final_median(mc_results[sid], cat)
                comparison[cat][sid] = {
                    "median": scenario_median,
                    "delta_vs_base": scenario_median - base_median if base_median else 0,
                }

        return comparison

    def _get_final_median(self, mc_result: dict, category: str) -> float:
        """Extract final year median from MC result."""
        sm = mc_result.get("shift_matrix", {})
        cat_data = sm.get(category, {})
        path = cat_data.get("path", {})
        if not path:
            return 0.0
        final_year = max(path.keys())
        return path[final_year].get("median", 0.0)
