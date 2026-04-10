"""Narrative generator — creates executive-ready scenario narratives and briefings."""

import logging
from typing import Optional, Dict, Any, List, TYPE_CHECKING
from datetime import datetime
import asyncio

from pulse.ai.provider import get_provider
from pulse.ingestion.firewall import FinancialDataFirewall

if TYPE_CHECKING:
    from pulse.ai.provider import LLMProvider

logger = logging.getLogger(__name__)


class SimulationNarrator:
    """
    Generates executive-ready narrative text for simulations and analysis.

    Key principle: Never includes absolute financial values (€M).
    Uses only percentages, relative terms, and qualitative descriptions.
    """

    def __init__(self, provider: Optional["LLMProvider"] = None):
        """
        Initialize narrator.

        Args:
            provider: LLM provider (uses default if not specified)
        """
        self.provider = provider or get_provider()
        self.firewall = FinancialDataFirewall()

    async def narrate_simulation(
        self,
        simulation_result: Dict[str, Any],
        config: Optional[Dict[str, Any]] = None,
        causal_decomposition: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Generate a narrative for simulation results.

        Args:
            simulation_result: Results from simulation with distribution data
            config: Optional narrative configuration
            causal_decomposition: Optional causal decomposition of effects

        Returns:
            Executive narrative as string (no financial data)
        """
        if config is None:
            config = {}

        style = config.get("style", "executive")
        max_length = config.get("max_length", 2000)

        # Build context ensuring no absolute values
        results_context = self._prepare_results_context(simulation_result)
        causal_context = ""
        if causal_decomposition:
            causal_context = self._prepare_causal_context(causal_decomposition)

        system_prompt = f"""You are an executive communications specialist.
Write a compelling, clear narrative about business simulation results and their potential impact.

CRITICAL REQUIREMENTS:
1. NEVER mention absolute financial values (€M, dollars, revenue, profit, etc.)
2. Use ONLY relative language: "increases by X%", "gains", "declines", "outpaces", etc.
3. Use percentile language: "25th percentile", "median outcome", "95th percentile"
4. Style: {style}
5. Maximum length: {max_length} words
6. If causal decomposition provided, explain HOW forces propagate through the system

Focus on:
- Market dynamics and competitive position
- Relative performance across segments
- Probability of different outcomes
- Key drivers of success/risk
- Causal mechanisms (e.g., regulation → reformulation costs → shelf price)

Write for C-level executives (CEO, CFO, CMO)."""

        user_prompt = f"""Based on these simulation results, write a narrative:

SIMULATION RESULTS:
{results_context}
{causal_context}

Create a compelling narrative that helps executives understand the business implications."""

        try:
            narrative = await self.provider.complete(
                system_prompt,
                user_prompt,
            )


            return narrative

        except Exception as e:
            logger.error(f"Error generating narrative: {e}")
            return self._generate_fallback_narrative(simulation_result)

    async def generate_executive_summary(
        self,
        simulation_result: Dict[str, Any],
        allocation: Optional[Dict[str, float]] = None,
    ) -> str:
        """
        Generate a brief executive summary of simulation results.

        Args:
            simulation_result: Simulation results with distribution data
            allocation: Optional budget allocation percentages

        Returns:
            Executive summary (2-3 paragraphs, no financial data)
        """
        results_context = self._prepare_results_context(simulation_result)
        allocation_context = ""

        if allocation:
            allocation_context = "\n\nBudget Allocation:\n"
            for item, pct in allocation.items():
                allocation_context += f"  {item}: {pct:.1%}\n"

        system_prompt = """Write a 2-3 paragraph executive summary of business simulation results.

REQUIREMENTS:
1. NO absolute financial values - use percentages and relative terms only
2. Highlight key insights and surprises
3. Use clear, confident language
4. Focus on implications for decision-making
5. Mention key risks and opportunities"""

        user_prompt = f"""Summarize these simulation results:

{results_context}
{allocation_context}

Write a brief, punchy executive summary."""

        try:
            summary = await self.provider.complete(
                system_prompt,
                user_prompt,
            )
            return summary
        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            return "Unable to generate summary at this time."

    async def generate_force_briefing(
        self,
        force: str,
        trends: List[Dict[str, Any]],
        shifts: Optional[Dict[str, float]] = None,
    ) -> str:
        """
        Generate a briefing on a specific force and its trends.

        Args:
            force: Force name (Consumer, Customer, Technology, etc.)
            trends: List of trends affecting this force
            shifts: Optional shift values by category

        Returns:
            Force briefing narrative
        """
        trends_context = "\n".join([
            f"- {t.get('name', 'Unknown')}: {t.get('description', '')} "
            f"(Impact: {t.get('direction', 'neutral')})"
            for t in trends
        ])

        shifts_context = ""
        if shifts:
            shifts_context = "\nCategory Shifts:\n"
            for cat, shift in shifts.items():
                direction = "+" if shift > 0 else ""
                shifts_context += f"  {cat}: {direction}{shift:.1%}\n"

        system_prompt = f"""You are a market strategist briefing executives on {force} dynamics.

Write a compelling briefing covering:
1. Current state of {force} in beauty/personal care
2. Key trends and their implications
3. Strategic recommendations
4. Expected impacts on business

REQUIREMENTS:
- NO financial values or absolute numbers
- Use percentages, probabilities, and relative terms
- Focus on strategic implications
- Keep professional but engaging tone"""

        user_prompt = f"""Provide a briefing on {force} trends:

Trends:
{trends_context}
{shifts_context}

Write a strategic briefing for executives."""

        try:
            briefing = await self.provider.complete(
                system_prompt,
                user_prompt,
            )
            return briefing
        except Exception as e:
            logger.error(f"Error generating briefing: {e}")
            return f"Unable to generate {force} briefing at this time."

    def _prepare_scenario_context(self, scenario: Dict[str, Any]) -> str:
        """
        Prepare scenario context for narrative (no absolute values).

        Args:
            scenario: Scenario dictionary

        Returns:
            Formatted context string
        """
        lines = []
        lines.append(f"Scenario: {scenario.get('name', 'Unnamed')}")
        lines.append(f"Description: {scenario.get('description', '')}")

        # Include force weights as percentages
        if "force_weights" in scenario:
            lines.append("\nForce Emphasis:")
            for force, weight in scenario["force_weights"].items():
                lines.append(f"  {force}: {weight:.1%}")

        # Include materialization as percentages
        if "materialization" in scenario:
            lines.append("\nImpact Timeline:")
            for year, mat in scenario["materialization"].items():
                lines.append(f"  {year}: {mat:.1%} materialized")

        return "\n".join(lines)

    def _prepare_results_context(self, results: Dict[str, Any]) -> str:
        """
        Prepare results context for narrative (only percentages/relative).

        Args:
            results: Simulation results

        Returns:
            Formatted context string
        """
        lines = []

        # Distribution summary
        if "distribution" in results:
            dist = results["distribution"]
            if "percentiles" in dist:
                lines.append("Expected Outcomes (Percentiles):")
                for pct, value in dist["percentiles"].items():
                    lines.append(f"  {pct}th: {value:+.1%}")

        # Category impacts
        if "category_impacts" in results:
            lines.append("\nCategory Relative Impacts:")
            for cat, impact in results["category_impacts"].items():
                direction = "+" if impact > 0 else ""
                lines.append(f"  {cat}: {direction}{impact:.1%}")

        # Force contributions
        if "force_contributions" in results:
            lines.append("\nForce Contributions:")
            for force, contrib in results["force_contributions"].items():
                lines.append(f"  {force}: {contrib:+.1%}")

        # Probabilities
        if "probabilities" in results:
            lines.append("\nOutcome Probabilities:")
            for outcome, prob in results["probabilities"].items():
                lines.append(f"  {outcome}: {prob:.1%}")

        return "\n".join(lines)

    def _prepare_causal_context(self, causal_decomposition: Dict[str, Any]) -> str:
        """
        Prepare causal decomposition for narrative.

        Shows how forces propagate through system to create impacts.

        Args:
            causal_decomposition: Causal decomposition data

        Returns:
            Formatted context string
        """
        lines = ["\nCAUSAL MECHANISMS:"]

        for category, effects in causal_decomposition.items():
            lines.append(f"\n{category}:")

            if isinstance(effects, dict):
                if "direct_effects" in effects:
                    lines.append("  Direct Effects:")
                    for force, impact in effects["direct_effects"].items():
                        direction = "+" if impact > 0 else ""
                        lines.append(f"    {force}: {direction}{impact:.1%}")

                if "propagated_effects" in effects:
                    lines.append("  Propagated Effects (through DAG):")
                    for path, impact in effects["propagated_effects"].items():
                        direction = "+" if impact > 0 else ""
                        lines.append(f"    {path}: {direction}{impact:.1%}")

        return "\n".join(lines)

    def _sanitize_narrative(self, narrative: str) -> str:
        """
        Remove any financial data that leaked into narrative.

        Args:
            narrative: Raw narrative text

        Returns:
            Sanitized narrative
        """
        import re

        # Remove currency amounts
        narrative = re.sub(r"€\s*[\d,\.]+\s*[MB]?", "[AMOUNT]", narrative)
        narrative = re.sub(r"\$\s*[\d,\.]+\s*[MB]?", "[AMOUNT]", narrative)

        # Remove large absolute numbers that look financial
        narrative = re.sub(r"\b\d{3,}(?:\.\d+)?\s*(?:M|B|million|billion)\b", "[VALUE]", narrative)

        return narrative

    def _generate_fallback_narrative(
        self,
        scenario: Dict[str, Any],
        results: Dict[str, Any],
    ) -> str:
        """
        Generate a simple fallback narrative if LLM fails.

        Args:
            scenario: Scenario configuration
            results: Simulation results

        Returns:
            Fallback narrative
        """
        scenario_name = scenario.get("name", "This Scenario")
        category_impacts = results.get("category_impacts", {})

        lines = [
            f"{scenario_name} presents a complex market dynamic.",
            "",
            "Key category impacts vary across the portfolio:",
        ]

        for cat, impact in list(category_impacts.items())[:5]:
            direction = "strengthens" if impact > 0 else "weakens"
            magnitude = "significantly" if abs(impact) > 0.1 else "moderately"
            lines.append(f"  {cat} {direction} {magnitude} ({impact:+.1%})")

        lines.extend([
            "",
            "Success in this scenario depends on:",
            "  - Accurate market assessment",
            "  - Proactive competitive response",
            "  - Flexible resource allocation",
            "",
            "Further analysis recommended before strategic commitment.",
        ])

        return "\n".join(lines)
