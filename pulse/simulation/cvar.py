"""CVaR (Conditional Value-at-Risk) analysis for profit pool shifts."""
import numpy as np
from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)


class CVaRAnalyzer:
    """
    Computes CVaR (Expected Shortfall) for each category's shift distribution.
    CVaR answers: "Given we're in the worst X% of outcomes, what's the average loss?"

    This is more robust than VaR alone because it considers the entire tail,
    not just the threshold. Useful for risk assessment and conservative planning.
    """

    def __init__(self, confidence_level: float = 0.95):
        """
        Args:
            confidence_level: Confidence level (0.95 = 5% tail = worst 5%)
        """
        self.confidence_level = confidence_level

    def compute_cvar(self, samples: np.ndarray, confidence_level: Optional[float] = None) -> Dict[str, Any]:
        """
        Compute VaR and CVaR from MC samples for a single distribution.

        Args:
            samples: 1D array of MC shift samples for one category/scenario
            confidence_level: Override default confidence (e.g. 0.95 = 5% tail)

        Returns:
            {
                "var": float,           # Value at Risk (percentile threshold)
                "cvar": float,          # Conditional Value at Risk (mean of tail)
                "confidence_level": float,
                "n_tail_samples": int,  # Number of samples in tail
                "tail_mean": float,     # Mean of tail samples
                "tail_std": float,      # Std of tail samples
                "tail_min": float,      # Worst case
                "tail_max": float,      # Best case in tail
            }
        """
        alpha = confidence_level or self.confidence_level
        sorted_samples = np.sort(samples)

        # VaR: the percentile value
        var_index = int((1 - alpha) * len(sorted_samples))
        var_value = sorted_samples[var_index]

        # CVaR: mean of the tail (all values <= VaR)
        tail_samples = sorted_samples[:var_index + 1]
        cvar_value = tail_samples.mean()

        return {
            "var": float(var_value),
            "cvar": float(cvar_value),
            "confidence_level": float(alpha),
            "n_tail_samples": int(var_index + 1),
            "tail_mean": float(tail_samples.mean()),
            "tail_std": float(tail_samples.std()),
            # Asymptotic standard error of the CVaR estimate (tail std / sqrt(n));
            # bootstrap-verified to be a good approximation for these bounded,
            # narrow distributions (audit verification/v4_cvar_quality_out.txt).
            "cvar_se": float(tail_samples.std() / max(len(tail_samples), 1) ** 0.5),
            "tail_min": float(tail_samples.min()),
            "tail_max": float(tail_samples.max()),
        }

    def compute_portfolio_cvar(self, all_samples: Dict[str, np.ndarray],
                                weights: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
        """
        Compute portfolio-level CVaR across all categories.

        Args:
            all_samples: {category_name: np.array of MC samples}
            weights: Optional allocation weights (equal weight if None)

        Returns:
            {
                "category_cvar": {category: {var, cvar, ...}},
                "portfolio_cvar": {var, cvar, ...},
                "risk_contributions": {category: contribution_to_tail_loss},
                "weights_used": {category: weight},
                "diversification_ratio": ratio of weighted individual risks to portfolio risk,
            }
        """
        categories = list(all_samples.keys())
        n = len(categories)
        if weights is None:
            weights = {c: 1.0/n for c in categories}

        # Per-category CVaR
        category_cvar = {}
        for cat in categories:
            category_cvar[cat] = self.compute_cvar(all_samples[cat])

        # Portfolio-level: weighted sum of samples
        n_samples = len(next(iter(all_samples.values())))
        portfolio_samples = np.zeros(n_samples)
        for cat in categories:
            portfolio_samples += weights.get(cat, 1.0/n) * all_samples[cat]

        portfolio_result = self.compute_cvar(portfolio_samples)

        # Risk contribution: marginal CVaR (what portion of portfolio tail loss is each category?)
        sorted_idx = np.argsort(portfolio_samples)
        tail_size = int((1 - self.confidence_level) * n_samples)
        tail_indices = sorted_idx[:tail_size + 1]

        risk_contributions = {}
        total_tail_exposure = 0
        for cat in categories:
            contrib = np.mean(all_samples[cat][tail_indices])
            risk_contributions[cat] = float(contrib)
            total_tail_exposure += abs(contrib)

        # Diversification ratio: weighted avg individual CVaR vs portfolio CVaR
        weighted_individual_cvar = sum(
            weights.get(cat, 1.0/n) * category_cvar[cat]["cvar"]
            for cat in categories
        )
        diversification_ratio = weighted_individual_cvar / portfolio_result["cvar"] if portfolio_result["cvar"] != 0 else 1.0

        return {
            "category_cvar": category_cvar,
            "portfolio_cvar": portfolio_result,
            "risk_contributions": risk_contributions,
            "weights_used": weights,
            "diversification_ratio": float(diversification_ratio),
            "interpretation": f"Portfolio CVaR ({self.confidence_level:.0%} confidence): "
                            f"{portfolio_result['cvar']:+.4f}. "
                            f"Diversification ratio: {diversification_ratio:.2f}x "
                            f"(>1 indicates benefit from diversification)"
        }

    def cvar_stress_decomposition(self, all_samples: Dict[str, np.ndarray],
                                    force_attributions: Optional[Dict[str, Dict[str, np.ndarray]]] = None
                                    ) -> Dict[str, Any]:
        """
        Decompose CVaR by force attribution in tail scenarios.
        Which forces drive the worst outcomes?

        Args:
            all_samples: {category: MC samples}
            force_attributions: {category: {force: MC samples of that force's contribution}}

        Returns:
            {
                "category_force_decomposition": {
                    category: {
                        force: {mean_contribution_in_tail, rank}
                    }
                },
                "dominant_forces_in_tail": ranking of which forces matter most in worst cases
            }
        """
        if not force_attributions:
            return {"error": "Force attributions required for decomposition"}

        result = {}
        force_rankings = {}

        for cat, samples in all_samples.items():
            sorted_idx = np.argsort(samples)
            tail_size = int((1 - self.confidence_level) * len(samples))
            tail_indices = sorted_idx[:tail_size + 1]

            if cat in force_attributions:
                force_tail = {}
                for force, force_samples in force_attributions[cat].items():
                    force_tail[force] = {
                        "tail_mean": float(np.mean(force_samples[tail_indices])),
                        "tail_std": float(np.std(force_samples[tail_indices])),
                    }
                    # Track global force importance
                    if force not in force_rankings:
                        force_rankings[force] = []
                    force_rankings[force].append(abs(force_tail[force]["tail_mean"]))

                result[cat] = force_tail

        # Rank forces by average importance across categories
        dominant_forces = {}
        for force, values in force_rankings.items():
            dominant_forces[force] = float(np.mean(values))

        dominant_forces = dict(sorted(dominant_forces.items(), key=lambda x: abs(x[1]), reverse=True))

        return {
            "category_force_decomposition": result,
            "dominant_forces_in_tail": dominant_forces,
            "interpretation": f"In worst {(1-self.confidence_level):.0%} of scenarios: "
                            f"force ranking (by avg impact magnitude): {list(dominant_forces.keys())}"
        }

    def cvar_by_scenario(self, scenario_samples: Dict[str, Dict[str, np.ndarray]]) -> Dict[str, Any]:
        """
        Compare CVaR across multiple scenarios.

        Args:
            scenario_samples: {scenario_name: {category: samples}}

        Returns:
            Cross-scenario CVaR comparison keyed by ``by_scenario`` / ``ranking``.
        """
        result = {}

        for scenario_name, category_dict in scenario_samples.items():
            portfolio_result = self.compute_portfolio_cvar(category_dict)
            result[scenario_name] = portfolio_result

        # Rank scenarios by CVaR severity
        scenario_rankings = sorted(
            [(s, result[s]["portfolio_cvar"]["cvar"]) for s in result.keys()],
            key=lambda x: x[1]
        )

        return {
            "by_scenario": result,
            "ranking": [{"scenario": s, "cvar": v} for s, v in scenario_rankings],
            "most_risky": scenario_rankings[0][0] if scenario_rankings else None,
            "least_risky": scenario_rankings[-1][0] if scenario_rankings else None,
        }

    def generate_cvar_report(self, portfolio_cvar: Dict[str, Any]) -> str:
        """Generate a human-readable CVaR report."""
        lines = ["# CVaR Risk Analysis Report\n"]

        pc = portfolio_cvar.get("portfolio_cvar", {})
        lines.append(f"**Confidence Level:** {portfolio_cvar.get('weights_used', {})}")
        lines.append(f"**Portfolio CVaR (Expected Shortfall):** {pc.get('cvar', 0):+.2%}")
        lines.append(f"**Portfolio VaR (Threshold):** {pc.get('var', 0):+.2%}")
        lines.append(f"**Tail Size:** {pc.get('n_tail_samples', 0)} samples")
        lines.append(f"**Diversification Ratio:** {portfolio_cvar.get('diversification_ratio', 1):.2f}x")
        lines.append("")

        lines.append("## Category-Level Risk Contributions (in tail scenarios)")
        lines.append("")

        contrib = portfolio_cvar.get("risk_contributions", {})
        for cat in sorted(contrib.keys(), key=lambda c: abs(contrib[c]), reverse=True):
            lines.append(f"- **{cat}:** {contrib[cat]:+.2%}")

        return "\n".join(lines)
