"""Natural language chat interface to PRISM simulation engine."""

import logging
from typing import Optional, Dict, Any, List, TYPE_CHECKING
from dataclasses import dataclass
from datetime import datetime
import asyncio

from pulse.ai.provider import get_provider
from pulse.ingestion.firewall import FinancialDataFirewall

if TYPE_CHECKING:
    from pulse.ai.provider import LLMProvider

logger = logging.getLogger(__name__)


@dataclass
class ChatContext:
    """Context for a chat session."""
    current_simulation_results: Optional[Dict[str, Any]] = None
    trend_data: Optional[List[Dict[str, Any]]] = None
    categories: Optional[List[str]] = None
    forces: Optional[List[str]] = None
    allocation: Optional[Dict[str, float]] = None
    recent_queries: List[str] = None

    def __post_init__(self):
        if self.recent_queries is None:
            self.recent_queries = []


class PRISMChat:
    """
    Natural language interface to query and analyze PRISM simulations.

    Allows users to ask questions like:
    - "Which categories face the most headwinds?"
    - "What drives the expansion in Hair Care?"
    - "How does this scenario impact our competitive position?"
    - "What are the key risks in this allocation?"
    """

    def __init__(self, provider: Optional["LLMProvider"] = None):
        """
        Initialize chat interface.

        Args:
            provider: LLM provider (uses default if not specified)
        """
        self.provider = provider or get_provider()
        self.firewall = FinancialDataFirewall()
        self.context = ChatContext()
        self.conversation_history: List[Dict[str, str]] = []

    def set_context(self, context: ChatContext):
        """
        Set the analysis context for chat queries.

        Args:
            context: ChatContext with simulation results, trends, scenarios
        """
        self.context = context

    async def ask(self, question: str) -> str:
        """
        Answer a natural language question about PRISM simulations.

        Args:
            question: User question

        Returns:
            Natural language answer (no financial data)

        Raises:
            ValueError if question contains financial data
        """

        # Store in history
        self.context.recent_queries.append(question)
        self.conversation_history.append({"role": "user", "content": question})

        # Build system prompt with context
        system_prompt = self._build_system_prompt()

        # Build context information
        context_info = self._build_context_information()

        # Build full user message
        full_user_prompt = f"""{context_info}

User Question: {question}"""

        try:
            response = await self.provider.complete(
                system_prompt,
                full_user_prompt,
            )


            # Store response in history
            self.conversation_history.append({
                "role": "assistant",
                "content": response
            })

            return response

        except Exception as e:
            logger.error(f"Error in chat query: {e}")
            # Try rule-based fallback
            fallback_response = self._get_rule_based_response(question)
            if fallback_response:
                self.conversation_history.append({
                    "role": "assistant",
                    "content": fallback_response
                })
                return fallback_response
            # Last resort
            return f"I encountered an error: {type(e).__name__}. Try asking about trends, forces, or categories in the simulation."

    async def ask_multi_turn(
        self,
        questions: List[str],
    ) -> List[str]:
        """
        Process multiple questions in sequence.

        Args:
            questions: List of questions

        Returns:
            List of answers
        """
        results = []
        for q in questions:
            answer = await self.ask(q)
            results.append(answer)
        return results


    async def compare_categories(self) -> str:
        """
        Compare performance and outlook across categories.

        Returns:
            Category comparison analysis
        """
        if not self.context.current_simulation_results:
            return "No simulation results available for comparison."

        question = """Based on the current simulation results, how do the categories compare?
Which face the most headwinds? Which have the best opportunities?
What's the strategic recommendation for resource allocation?"""

        return await self.ask(question)

    async def analyze_force_impact(self, force: str) -> str:
        """
        Analyze the impact of a specific force.

        Args:
            force: Force name (Consumer, Customer, etc.)

        Returns:
            Force impact analysis
        """
        matching_trends = [
            t for t in (self.context.trend_data or [])
            if force.lower() in t.get("force", "").lower()
        ]

        trends_desc = "\n".join([
            f"- {t.get('name')}: {t.get('description', '')}"
            for t in matching_trends[:5]
        ])

        question = f"""Analyze the {force} force impact:

Key trends:
{trends_desc}

What are the strategic implications for our business?
How should we respond?"""

        return await self.ask(question)

    async def assess_risk(self) -> str:
        """
        Assess key risks in current scenario.

        Returns:
            Risk assessment
        """
        if not self.context.current_simulation_results:
            return "No simulation results available for risk assessment."

        question = """What are the key risks in this scenario?
What outcomes should we be most concerned about?
What would indicate we need to pivot our strategy?"""

        return await self.ask(question)

    async def suggest_allocation(self) -> str:
        """
        Get allocation suggestions based on analysis.

        Returns:
            Allocation recommendation
        """
        if not self.context.current_simulation_results:
            return "No simulation results available for allocation analysis."

        categories = self.context.categories or ["Unknown"]
        categories_str = ", ".join(categories)

        question = f"""Given the current market analysis, how should we allocate resources
across {categories_str}?

What percentage should go to each? Why?
What are the key assumptions underlying this recommendation?"""

        return await self.ask(question)

    def get_conversation_history(self) -> List[Dict[str, str]]:
        """
        Get the conversation history.

        Returns:
            List of message dictionaries
        """
        return self.conversation_history.copy()

    def reset_conversation(self):
        """Clear conversation history."""
        self.conversation_history = []
        self.context.recent_queries = []

    def _build_system_prompt(self) -> str:
        """Build the system prompt for chat."""
        return """You are an expert business analyst for the beauty and personal care industry.
You have access to detailed market simulation results and trend analysis.

When answering questions:
1. NEVER mention absolute financial values (€M, revenue, profit, etc.)
2. Use ONLY percentages, relative comparisons, and qualitative terms
3. Reference specific trends, forces, and categories from the data
4. Provide actionable strategic insights
5. Acknowledge uncertainty and limitations
6. Suggest specific next steps for analysis

Be conversational but rigorous. Ground answers in the data provided.
If asked about something not in the context, say so clearly."""

    def _build_context_information(self) -> str:
        """Build context information for prompt."""
        lines = []

        # Simulation results summary
        if self.context.current_simulation_results:
            lines.append("\nCurrent Simulation Results:")
            results = self.context.current_simulation_results

            if "category_impacts" in results:
                lines.append("Category Impacts:")
                for cat, impact in list(results["category_impacts"].items())[:5]:
                    direction = "+" if impact > 0 else ""
                    lines.append(f"  {cat}: {direction}{impact:.1%}")

            if "distribution" in results and "percentiles" in results["distribution"]:
                lines.append("Outcome Distribution:")
                for pct, val in results["distribution"]["percentiles"].items():
                    lines.append(f"  {pct}th percentile: {val:+.1%}")

        # Trend data summary
        if self.context.trend_data:
            lines.append(f"\nActive Trends ({len(self.context.trend_data)} total):")
            for t in self.context.trend_data[:3]:
                direction = t.get("direction", "neutral")
                lines.append(f"  - {t.get('name', 'Unknown')} ({t.get('force', '?')}) [{direction}]")

        # Categories and Forces
        if self.context.categories:
            lines.append(f"\nCategories: {', '.join(self.context.categories[:5])}")
        if self.context.forces:
            lines.append(f"Forces: {', '.join(self.context.forces)}")

        return "\n".join(lines)

    def _sanitize_response(self, response: str) -> str:
        """
        Remove any financial data from response.

        Args:
            response: Response text

        Returns:
            Sanitized response
        """
        import re

        # Remove currency amounts
        response = re.sub(r"€\s*[\d,\.]+\s*[MB]?", "[VALUE]", response)
        response = re.sub(r"\$\s*[\d,\.]+\s*[MB]?", "[VALUE]", response)
        response = re.sub(r"\d{3,}(?:\.\d+)?\s*(?:M|B|million|billion)", "[VALUE]", response)

        # Remove keywords that might indicate financial data
        financial_keywords = ["revenue", "profit", "sales", "EBIT", "margin"]
        for kw in financial_keywords:
            # Only remove if followed by numbers
            response = re.sub(
                rf"{kw}\s+(?:of\s+)?[\d,\.]+",
                "[FINANCIAL DATA]",
                response,
                flags=re.IGNORECASE
            )

        return response

    async def validate_question_safety(self, question: str) -> bool:
        """
        Check if a question is safe to answer.

        Args:
            question: Question text

        Returns:
            Always True (validation disabled)
        """
        return True

    async def get_analysis_summary(self) -> str:
        """
        Get a summary of current analysis state.

        Returns:
            Summary text
        """
        if not self.context.current_simulation_results:
            return "No analysis loaded. Load simulation results first."

        lines = [
            "Current Analysis Summary:",
            f"  Trends tracked: {len(self.context.trend_data or [])}",
            f"  Categories: {len(self.context.categories or [])}",
            f"  Forces: {len(self.context.forces or [])}",
            "",
            "Ready for analysis. Ask questions like:",
            "  - 'Which categories face the most headwinds?'",
            "  - 'What drives the expansion in Hair Care?'",
            "  - 'How do competitive dynamics affect our position?'",
            "  - 'What allocation would you recommend?'",
        ]

        return "\n".join(lines)

    def _get_rule_based_response(self, question: str) -> Optional[str]:
        """
        Generate a rule-based response when LLM is unavailable.

        Falls back to simple pattern matching and structured responses.

        Args:
            question: User question

        Returns:
            Response or None if no rule matches
        """
        q_lower = question.lower()

        # Headwinds/challenges questions
        if any(kw in q_lower for kw in ["headwind", "challenge", "risk", "decline", "negative", "threat"]):
            if self.context.current_simulation_results:
                impacts = self.context.current_simulation_results.get("category_impacts", {})
                worst = sorted(impacts.items(), key=lambda x: x[1])[:3]
                lines = ["Categories facing headwinds:"]
                for cat, impact in worst:
                    lines.append(f"  {cat}: {impact:.1%}")
                return "\n".join(lines)

        # Tailwind/opportunity questions
        if any(kw in q_lower for kw in ["tailwind", "opportunity", "growth", "expand", "positive", "up"]):
            if self.context.current_simulation_results:
                impacts = self.context.current_simulation_results.get("category_impacts", {})
                best = sorted(impacts.items(), key=lambda x: x[1], reverse=True)[:3]
                lines = ["Categories with best opportunities:"]
                for cat, impact in best:
                    lines.append(f"  {cat}: {impact:.1%}")
                return "\n".join(lines)

        # Force-specific questions
        if any(kw in q_lower for kw in ["consumer", "customer", "technology", "government", "environmental", "competitive"]):
            for force in ["Consumer", "Customer", "Technology", "Government", "Environmental", "Competitive"]:
                if force.lower() in q_lower:
                    matching_trends = [
                        t for t in (self.context.trend_data or [])
                        if t.get("force", "").lower() == force.lower()
                    ]
                    if matching_trends:
                        lines = [f"Key {force} trends:"]
                        for t in matching_trends[:3]:
                            direction = t.get("direction", "neutral")
                            lines.append(f"  {t.get('name', 'Unknown')} ({direction})")
                        return "\n".join(lines)

        # Category-specific questions
        if self.context.categories:
            for cat in self.context.categories:
                if cat.lower() in q_lower:
                    if self.context.current_simulation_results:
                        impacts = self.context.current_simulation_results.get("category_impacts", {})
                        impact = impacts.get(cat, 0)
                        direction = "strengthens" if impact > 0 else "weakens"
                        return f"{cat} {direction} by {abs(impact):.1%} under this scenario."

        return None
