"""Causal Directed Acyclic Graph — models force interdependencies.

Forces are NOT independent channels. EU regulation (Government) triggers
reformulation costs (Technology), which changes shelf price (Customer),
which shifts consumer behavior (Consumer).

The DAG enables:
- Shock propagation: shock one force, watch effects cascade
- Propagation signatures: different forces create different cascade patterns
- Lag structure: effects take 0-2 years to propagate
- Structural shock analysis: shocks defined by initial impulses, propagated through DAG
"""

import logging
from typing import Optional

import numpy as np

from pulse.config import FORCES
from pulse.ingestion.models import CausalEdge

logger = logging.getLogger(__name__)

# ── Default causal edges (expert-defined, refinable via backtesting) ──

DEFAULT_CAUSAL_EDGES = [
    # Government → others
    CausalEdge("Government", "Technology", 0.6, 1,
               "Regulation triggers reformulation R&D spend", "Strong"),
    CausalEdge("Government", "Customer", 0.4, 1,
               "Compliance costs pass through to shelf price", "Moderate"),
    CausalEdge("Government", "Environmental", 0.3, 0,
               "Environmental regulation codifies green trends", "Moderate"),

    # Consumer → others
    CausalEdge("Consumer", "Customer", 0.5, 0,
               "Demand shifts force channel adaptation", "Strong"),
    CausalEdge("Consumer", "Competitive", 0.4, 1,
               "Consumer preferences drive competitive positioning", "Moderate"),
    CausalEdge("Consumer", "Technology", 0.3, 1,
               "Consumer demand pulls innovation investment", "Moderate"),

    # Technology → others
    CausalEdge("Technology", "Consumer", 0.4, 1,
               "New tech enables new consumer behaviors", "Moderate"),
    CausalEdge("Technology", "Competitive", 0.5, 1,
               "Tech adoption creates competitive gaps", "Strong"),
    CausalEdge("Technology", "Customer", 0.3, 0,
               "Tech changes channel economics", "Moderate"),

    # Environmental → others
    CausalEdge("Environmental", "Government", 0.6, 1,
               "Environmental crises accelerate regulation", "Strong"),
    CausalEdge("Environmental", "Consumer", 0.4, 0,
               "Climate awareness shifts purchase behavior", "Moderate"),
    CausalEdge("Environmental", "Technology", 0.3, 1,
               "Environmental pressure drives green innovation", "Moderate"),

    # Customer → others
    CausalEdge("Customer", "Competitive", 0.5, 0,
               "Channel power shifts competitive dynamics", "Strong"),
    CausalEdge("Customer", "Consumer", 0.3, 0,
               "Channel availability shapes consumer access", "Weak"),

    # Competitive → others
    CausalEdge("Competitive", "Customer", 0.4, 0,
               "Competitive moves change channel bargaining", "Moderate"),
    CausalEdge("Competitive", "Consumer", 0.3, 1,
               "Competitive innovation shapes consumer expectations", "Moderate"),
]


class CausalDAG:
    """
    Directed Acyclic Graph for causal force propagation.

    Instead of "wiggle all inputs and combine," we can "shock one node and
    watch it propagate." A regulatory shock has a specific propagation
    signature different from a technology shock.
    """

    def __init__(self, edges: Optional[list] = None):
        self.edges = edges or list(DEFAULT_CAUSAL_EDGES)
        self._adjacency = {}
        self._build_adjacency()
        self._validate_acyclic()

    def _build_adjacency(self):
        """Build adjacency list from edges."""
        self._adjacency = {f: [] for f in FORCES}
        for edge in self.edges:
            self._adjacency[edge.source_force].append(edge)

    def _validate_acyclic(self):
        """Verify the graph is acyclic (topological sort test)."""
        visited = set()
        rec_stack = set()

        def _has_cycle(node):
            visited.add(node)
            rec_stack.add(node)
            for edge in self._adjacency.get(node, []):
                if edge.target_force not in visited:
                    if _has_cycle(edge.target_force):
                        return True
                elif edge.target_force in rec_stack:
                    # Cycles are ok if they have lag > 0 (feedback loops)
                    if edge.lag_years == 0:
                        logger.warning(f"Potential instant cycle: "
                                       f"{node} → {edge.target_force}")
            rec_stack.discard(node)
            return False

        for force in FORCES:
            if force not in visited:
                _has_cycle(force)

    def get_propagation_weight(self, source: str, target: str) -> float:
        """Get direct propagation weight between two forces."""
        for edge in self.edges:
            if edge.source_force == source and edge.target_force == target:
                return edge.propagation_weight
        return 0.0

    def propagate_shock(self, shocked_force: str, magnitude: float,
                        years_forward: int = 5) -> dict:
        """
        Propagate a shock through the DAG with lag structure.

        Args:
            shocked_force: which force receives the initial shock
            magnitude: shock magnitude (e.g., 0.3 for +30% increase in force score)
            years_forward: how many years to propagate

        Returns:
            {force: {year: cumulative_impact}} — impact at each force over time
        """
        impacts = {f: {y: 0.0 for y in range(years_forward)} for f in FORCES}
        impacts[shocked_force][0] = magnitude

        for year in range(years_forward):
            for edge in self.edges:
                source_year = year - edge.lag_years
                if source_year < 0:
                    continue
                source_impact = impacts[edge.source_force].get(source_year, 0)
                if abs(source_impact) > 0.001:
                    propagated = source_impact * edge.propagation_weight
                    impacts[edge.target_force][year] += propagated

        return impacts

    def propagate_shock_to_forces(self, shocked_force: str,
                                   magnitude: float) -> dict:
        """
        Simplified: propagate shock and return total cumulative effect on each force.
        Used by scenario engine for override computation.
        """
        propagation = self.propagate_shock(shocked_force, magnitude, years_forward=3)
        result = {}
        for force, year_impacts in propagation.items():
            if force == shocked_force:
                continue  # Don't double-count the source
            total = sum(year_impacts.values())
            if abs(total) > 0.001:
                result[force] = total
        return result

    def propagate_to_force_contributions(self, source_force: str,
                                          source_contribution: float,
                                          all_contributions: dict) -> dict:
        """
        For MC engine: compute how one force's contribution propagates to others.
        Returns additional contributions from causal propagation.
        """
        propagated = {}
        for edge in self._adjacency.get(source_force, []):
            if edge.lag_years == 0:  # Only same-year propagation in single MC step
                amount = source_contribution * edge.propagation_weight * 0.3  # Damping
                propagated[edge.target_force] = amount
        return propagated

    def get_propagation_signature(self, shocked_force: str) -> dict:
        """
        What does the propagation pattern look like when this force is shocked?
        Returns a normalized signature useful for scenario fingerprinting.
        """
        raw = self.propagate_shock(shocked_force, 1.0, years_forward=5)
        # Sum absolute effects across all years per force
        totals = {f: sum(abs(v) for v in year_data.values())
                  for f, year_data in raw.items()}
        grand_total = sum(totals.values())
        if grand_total == 0:
            return {f: 0.0 for f in FORCES}
        return {f: totals[f] / grand_total for f in FORCES}

    def get_edges_from(self, force: str) -> list:
        return self._adjacency.get(force, [])

    def get_edges_to(self, force: str) -> list:
        return [e for e in self.edges if e.target_force == force]

    def to_dict(self) -> dict:
        """Serialize DAG for API/dashboard."""
        return {
            "nodes": FORCES,
            "edges": [
                {
                    "from": e.source_force,
                    "to": e.target_force,
                    "weight": e.propagation_weight,
                    "lag": e.lag_years,
                    "mechanism": e.mechanism,
                    "strength": e.evidence_strength,
                }
                for e in self.edges
            ]
        }
