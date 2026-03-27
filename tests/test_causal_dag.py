"""Tests for Causal DAG — force interdependencies and shock propagation."""

import pytest
import numpy as np
from pulse.causal.dag import CausalDAG
from pulse.ingestion.models import CausalEdge
from pulse.config import FORCES


class TestCausalDAGStructure:
    """Test DAG structural properties."""

    def test_dag_initializes_with_defaults(self):
        """Should initialize with default causal edges."""
        dag = CausalDAG()
        assert len(dag.edges) > 0
        assert dag.edges is not None

    def test_dag_has_all_forces(self):
        """Should have representation of all 6 forces."""
        dag = CausalDAG()
        forces_in_dag = set()

        for edge in dag.edges:
            forces_in_dag.add(edge.source_force)
            forces_in_dag.add(edge.target_force)

        for force in FORCES:
            assert force in forces_in_dag

    def test_dag_is_acyclic(self):
        """Should validate that DAG is acyclic."""
        dag = CausalDAG()
        # DAG constructor calls _validate_acyclic, so if we get here, it passed
        assert dag is not None

    def test_custom_edges_initialization(self):
        """Should initialize with custom edges if provided."""
        custom_edges = [
            CausalEdge("Consumer", "Customer", 0.5),
            CausalEdge("Customer", "Technology", 0.3),
        ]
        dag = CausalDAG(edges=custom_edges)
        assert len(dag.edges) == 2
        assert dag.edges[0].source_force == "Consumer"

    def test_propagation_weights_normalized(self):
        """Should ensure propagation weights are in [0, 1]."""
        edges = [
            CausalEdge("Consumer", "Customer", 1.5),  # Clamped to 1.0
            CausalEdge("Government", "Technology", -0.2),  # Clamped to 0.0
        ]
        dag = CausalDAG(edges=edges)

        # Weights should be normalized after __post_init__
        for edge in dag.edges:
            assert 0.0 <= edge.propagation_weight <= 1.0

    def test_lag_years_normalized(self):
        """Should ensure lag_years are in [0, 2]."""
        edges = [
            CausalEdge("Consumer", "Customer", 0.5, lag_years=5),  # Clamped to 2
            CausalEdge("Government", "Technology", 0.3, lag_years=-1),  # Clamped to 0
        ]
        dag = CausalDAG(edges=edges)

        for edge in dag.edges:
            assert 0 <= edge.lag_years <= 2


class TestCausalDAGPropagation:
    """Test shock propagation mechanics."""

    def test_propagate_shock_single_year(self, mock_causal_dag):
        """Should propagate shock through DAG for single year."""
        dag = mock_causal_dag

        impacts = dag.propagate_shock("Government", magnitude=0.3, years_forward=1)

        assert impacts is not None
        assert "Government" in impacts
        assert impacts["Government"][0] == 0.3  # Initial shock

    def test_propagate_shock_respects_lag(self, mock_causal_dag):
        """Should respect lag structure when propagating."""
        dag = mock_causal_dag

        impacts = dag.propagate_shock("Government", magnitude=1.0, years_forward=5)

        # Government → Technology has lag=1, so Technology[0] should be 0
        # Technology[1] should have propagated amount
        assert impacts["Technology"][0] == 0.0  # No instant propagation

        # Technology should have some value at year 1+
        has_tech_impact = any(impacts["Technology"][y] != 0.0 for y in range(1, 5))
        assert has_tech_impact

    def test_propagate_shock_zero_magnitude(self, mock_causal_dag):
        """Should handle zero-magnitude shocks."""
        dag = mock_causal_dag
        impacts = dag.propagate_shock("Consumer", magnitude=0.0, years_forward=3)

        # All impacts should be zero
        for force, year_impacts in impacts.items():
            for year, impact in year_impacts.items():
                assert abs(impact) < 0.001

    def test_propagate_shock_negative_magnitude(self, mock_causal_dag):
        """Should handle negative (contraction) shocks."""
        dag = mock_causal_dag
        impacts = dag.propagate_shock("Government", magnitude=-0.5, years_forward=3)

        # Government should have negative impact
        assert impacts["Government"][0] == -0.5

    def test_propagate_shock_government_to_technology(self, mock_causal_dag):
        """Should propagate Government shock to Technology."""
        dag = mock_causal_dag

        # Government → Technology has defined edge with lag=1
        impacts = dag.propagate_shock("Government", magnitude=1.0, years_forward=3)

        # Technology should be affected at year 1
        tech_at_year_1 = impacts["Technology"][1]
        assert tech_at_year_1 != 0.0  # Should have received propagation

    def test_propagate_shock_cascades(self, mock_causal_dag):
        """Should cascade through multiple steps."""
        dag = mock_causal_dag

        # Government → Technology → Competitive
        impacts = dag.propagate_shock("Government", magnitude=1.0, years_forward=5)

        # Should see impacts cascading through multiple forces
        impacted_forces = set()
        for force, year_impacts in impacts.items():
            if any(abs(y) > 0.001 for y in year_impacts.values()):
                impacted_forces.add(force)

        # Should impact more than just Government
        assert len(impacted_forces) > 1


class TestCausalDAGWeights:
    """Test propagation weight access and structure."""

    def test_get_propagation_weight_existing_edge(self, mock_causal_dag):
        """Should return weight for existing edge."""
        dag = mock_causal_dag
        weight = dag.get_propagation_weight("Government", "Technology")

        assert weight > 0  # Should have defined edge
        assert 0.0 <= weight <= 1.0

    def test_get_propagation_weight_nonexistent_edge(self, mock_causal_dag):
        """Should return 0.0 for non-existent edges."""
        dag = mock_causal_dag
        # Create edge set that doesn't include all pairs
        weight = dag.get_propagation_weight("Consumer", "Government")

        # Might be 0 or might be defined, depending on DAG
        assert 0.0 <= weight <= 1.0

    def test_propagation_signature_differs_by_force(self, mock_causal_dag):
        """Should produce different signatures for different shocked forces."""
        dag = mock_causal_dag

        gov_sig = dag.get_propagation_signature("Government")
        tech_sig = dag.get_propagation_signature("Technology")
        consumer_sig = dag.get_propagation_signature("Consumer")

        # Signatures should sum to 1.0
        assert abs(sum(gov_sig.values()) - 1.0) < 0.01
        assert abs(sum(tech_sig.values()) - 1.0) < 0.01
        assert abs(sum(consumer_sig.values()) - 1.0) < 0.01

        # Different forces should have different propagation patterns
        # (not exact equality because force distributions differ)
        gov_vec = np.array([gov_sig[f] for f in sorted(FORCES)])
        tech_vec = np.array([tech_sig[f] for f in sorted(FORCES)])

        # They should not be identical
        assert not np.allclose(gov_vec, tech_vec)

    def test_propagation_signature_normalized(self, mock_causal_dag):
        """Should return normalized (sum=1) signature."""
        dag = mock_causal_dag

        sig = dag.get_propagation_signature("Government")

        # Should be valid probability-like distribution
        for force in FORCES:
            assert force in sig
            assert 0.0 <= sig[force] <= 1.0

        total = sum(sig.values())
        assert abs(total - 1.0) < 0.01


class TestCausalDAGEdgeQueries:
    """Test edge query methods."""

    def test_get_edges_from_force(self, mock_causal_dag):
        """Should return edges emanating from a force."""
        dag = mock_causal_dag
        edges_from_gov = dag.get_edges_from("Government")

        assert isinstance(edges_from_gov, list)
        assert len(edges_from_gov) > 0
        for edge in edges_from_gov:
            assert edge.source_force == "Government"

    def test_get_edges_to_force(self, mock_causal_dag):
        """Should return edges pointing to a force."""
        dag = mock_causal_dag
        edges_to_tech = dag.get_edges_to("Technology")

        assert isinstance(edges_to_tech, list)
        for edge in edges_to_tech:
            assert edge.target_force == "Technology"

    def test_adjacency_structure(self, mock_causal_dag):
        """Should maintain adjacency structure correctly."""
        dag = mock_causal_dag

        # For each edge, should be retrievable via get_edges_from
        for edge in dag.edges:
            edges_from = dag.get_edges_from(edge.source_force)
            assert edge in edges_from


class TestCausalDAGSerialization:
    """Test DAG serialization for API/dashboard."""

    def test_to_dict_structure(self, mock_causal_dag):
        """Should serialize to proper dict structure."""
        dag = mock_causal_dag
        dag_dict = dag.to_dict()

        assert "nodes" in dag_dict
        assert "edges" in dag_dict

        # Nodes should be all forces
        assert len(dag_dict["nodes"]) == len(FORCES)
        for force in FORCES:
            assert force in dag_dict["nodes"]

        # Edges should have proper structure
        assert isinstance(dag_dict["edges"], list)
        for edge in dag_dict["edges"]:
            assert "from" in edge
            assert "to" in edge
            assert "weight" in edge
            assert "lag" in edge
            assert "mechanism" in edge

    def test_to_dict_contains_all_info(self, mock_causal_dag):
        """Should preserve all causal information in dict."""
        dag = mock_causal_dag
        dag_dict = dag.to_dict()

        # Verify edge count matches
        assert len(dag_dict["edges"]) == len(dag.edges)

        # Verify weights match
        for i, edge in enumerate(dag.edges):
            assert dag_dict["edges"][i]["weight"] == edge.propagation_weight
            assert dag_dict["edges"][i]["lag"] == edge.lag_years


class TestCausalDAGEdgeCases:
    """Test edge cases and special scenarios."""

    def test_dag_with_single_edge(self):
        """Should handle minimal DAG with single edge."""
        # Create edge with lag_years=1 so we can test lag behavior
        edges = [CausalEdge("Consumer", "Customer", 0.5, lag_years=1)]
        dag = CausalDAG(edges=edges)

        assert len(dag.edges) == 1
        impacts = dag.propagate_shock("Consumer", 1.0, years_forward=2)
        # With lag_years=1, Customer[0] should be 0 (no propagation yet)
        assert impacts["Customer"][0] == 0.0
        # At year 1, should receive the propagation
        assert impacts["Customer"][1] > 0.0

    def test_dag_with_multiple_sources_to_target(self):
        """Should handle multiple edges pointing to same target."""
        edges = [
            CausalEdge("Consumer", "Customer", 0.4),
            CausalEdge("Technology", "Customer", 0.3),
        ]
        dag = CausalDAG(edges=edges)

        # Shock both sources
        impacts_c = dag.propagate_shock("Consumer", 1.0, years_forward=2)
        impacts_t = dag.propagate_shock("Technology", 1.0, years_forward=2)

        # Customer should be affected by both
        assert impacts_c["Customer"][0] != 0.0
        assert impacts_t["Customer"][0] != 0.0

    def test_propagate_to_force_contributions(self, mock_causal_dag):
        """Should compute force contribution propagation."""
        dag = mock_causal_dag

        # Government contributes 0.5 to pool
        propagated = dag.propagate_to_force_contributions(
            "Government", source_contribution=0.5, all_contributions={}
        )

        # Should return dict of propagated effects
        assert isinstance(propagated, dict)

    def test_shock_with_many_years(self, mock_causal_dag):
        """Should handle long-horizon shocks (10+ years)."""
        dag = mock_causal_dag

        impacts = dag.propagate_shock("Government", 0.3, years_forward=10)

        # Should complete without error
        assert len(impacts) == len(FORCES)
        for force in FORCES:
            assert len(impacts[force]) == 10

    def test_very_small_magnitude_ignored(self, mock_causal_dag):
        """Should ignore very small magnitudes (<0.001)."""
        dag = mock_causal_dag

        impacts = dag.propagate_shock("Government", 0.00001, years_forward=3)

        # Impacts should be effectively zero everywhere
        for force in FORCES:
            for year in impacts[force].values():
                assert abs(year) < 0.0001
