"""Score calibrator — compares simulation scores against external market signals."""

import logging
from dataclasses import dataclass
from typing import Optional, List, Dict, Any, TYPE_CHECKING
from datetime import datetime
import asyncio

from pulse.ai.provider import get_provider

if TYPE_CHECKING:
    from pulse.ai.provider import LLMProvider

logger = logging.getLogger(__name__)


@dataclass
class CalibrationSuggestion:
    """Suggested calibration for a trend score."""
    trend_id: str
    field: str  # Which field to adjust (e.g., "score", "probability", "impact")
    current_value: float
    suggested_value: float
    confidence: float  # 0.0 to 1.0
    reasoning: str
    data_sources: List[str] = None


class ScoreCalibrator:
    """
    Calibrates trend scores against external market signals and intelligence.

    Detects potential under/over-scoring by comparing simulation scores
    against external data sources like:
    - Market research reports
    - Industry indices
    - Social listening signals
    - Expert opinions
    """

    def __init__(self, provider: Optional["LLMProvider"] = None):
        """
        Initialize score calibrator.

        Args:
            provider: LLM provider (uses default if not specified)
        """
        self.provider = provider or get_provider()

    async def calibrate_scores(
        self,
        trends: List[Dict[str, Any]],
        market_intel: Optional[Dict[str, Any]] = None,
    ) -> List[CalibrationSuggestion]:
        """
        Calibrate trend scores against external market intelligence.

        Args:
            trends: List of trend dictionaries with id, name, current_score, etc.
            market_intel: External market intelligence data (optional)

        Returns:
            List of calibration suggestions for potential adjustments
        """
        if not trends:
            return []

        suggestions = []

        for trend in trends:
            try:
                suggestion = await self._calibrate_single_trend(
                    trend,
                    market_intel,
                )
                if suggestion:
                    suggestions.append(suggestion)
            except Exception as e:
                logger.warning(
                    f"Error calibrating trend {trend.get('id', 'unknown')}: {e}"
                )

        logger.info(
            f"Score calibration complete: {len(suggestions)} suggestions generated"
        )
        return suggestions

    async def _calibrate_single_trend(
        self,
        trend: Dict[str, Any],
        market_intel: Optional[Dict[str, Any]] = None,
    ) -> Optional[CalibrationSuggestion]:
        """
        Calibrate a single trend score.

        Args:
            trend: Trend dictionary
            market_intel: Market intelligence context

        Returns:
            CalibrationSuggestion if adjustment needed, None otherwise
        """
        trend_id = trend.get("id", "unknown")
        trend_name = trend.get("name", "Unknown")
        current_score = trend.get("score", 0.0)

        # Build context
        trend_context = f"""
Trend: {trend_name}
Current Score: {current_score:.2f}
Force: {trend.get('force', 'Unknown')}
Category: {trend.get('category', 'Unknown')}
Description: {trend.get('description', '')}
"""

        market_context = ""
        if market_intel:
            market_context = f"""
External Market Signals:
{self._format_market_intel(market_intel)}
"""

        system_prompt = """You are an expert market analyst for the beauty and personal care industry.
Your task is to review a trend score and compare it against external market signals.

Determine if the current score is well-calibrated or if it should be adjusted.
Consider:
- Industry reports and data
- Competitive actions
- Consumer sentiment
- Regulatory environment
- Technology adoption rates

Return a JSON object with:
- needs_adjustment: boolean
- suggested_value: float (only if needs_adjustment is true)
- confidence: 0.0 to 1.0 (confidence in the suggestion)
- reasoning: brief explanation of reasoning
- data_sources: list of sources used

If the current score appears well-calibrated, return needs_adjustment=false."""

        user_prompt = f"""{trend_context}{market_context}

Based on the current score and external market signals, should this trend score be adjusted?
Provide your calibration assessment."""

        try:
            result = await self.provider.complete_structured(
                system_prompt,
                user_prompt,
                {
                    "type": "object",
                    "properties": {
                        "needs_adjustment": {"type": "boolean"},
                        "suggested_value": {"type": "number"},
                        "confidence": {"type": "number"},
                        "reasoning": {"type": "string"},
                        "data_sources": {
                            "type": "array",
                            "items": {"type": "string"}
                        },
                    },
                    "required": [
                        "needs_adjustment", "confidence", "reasoning", "data_sources"
                    ]
                }
            )

            if not result.get("needs_adjustment", False):
                return None

            return CalibrationSuggestion(
                trend_id=trend_id,
                field="score",
                current_value=current_score,
                suggested_value=float(result.get("suggested_value", current_score)),
                confidence=float(result.get("confidence", 0.5)),
                reasoning=result.get("reasoning", ""),
                data_sources=result.get("data_sources", []),
            )

        except Exception as e:
            logger.error(f"Error in LLM calibration: {e}")
            return None

    def _format_market_intel(self, intel: Dict[str, Any]) -> str:
        """Format market intelligence for prompt inclusion."""
        lines = []
        for key, value in intel.items():
            if isinstance(value, dict):
                lines.append(f"\n{key}:")
                for k2, v2 in value.items():
                    lines.append(f"  {k2}: {v2}")
            elif isinstance(value, list):
                lines.append(f"\n{key}:")
                for item in value:
                    lines.append(f"  - {item}")
            else:
                lines.append(f"{key}: {value}")
        return "\n".join(lines)

    async def get_calibration_confidence(
        self,
        trend: Dict[str, Any],
        current_score: float,
    ) -> float:
        """
        Get confidence level for a trend score.

        Args:
            trend: Trend dictionary
            current_score: Current score value

        Returns:
            Confidence level 0.0 to 1.0
        """
        system_prompt = """You are assessing the confidence level of a trend score.
Return a JSON object with:
- confidence: float from 0.0 to 1.0
- factors: list of factors affecting confidence"""

        user_prompt = f"""Assess confidence in this trend score:
{trend.get('name', 'Unknown')}
Score: {current_score}
Force: {trend.get('force', 'Unknown')}
"""

        try:
            result = await self.provider.complete_structured(
                system_prompt,
                user_prompt,
                {
                    "type": "object",
                    "properties": {
                        "confidence": {"type": "number"},
                        "factors": {"type": "array", "items": {"type": "string"}},
                    }
                }
            )
            return float(result.get("confidence", 0.5))
        except Exception as e:
            logger.warning(f"Error calculating confidence: {e}")
            return 0.5

    async def detect_bias_patterns(
        self,
        trends: List[Dict[str, Any]],
        historical_rounds: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Detect systematic biases in trend scoring across multiple experts.

        Detects:
        - Optimism bias: consistent overscoring of expansion trends
        - Anchoring bias: scores clustering near initial values
        - Recency bias: recent trends disproportionately weighted

        Args:
            trends: List of current trends with scores
            historical_rounds: Previous scoring rounds for comparison

        Returns:
            Dictionary with detected biases and recommendations
        """
        biases = {
            "optimism": {"detected": False, "magnitude": 0.0},
            "anchoring": {"detected": False, "magnitude": 0.0},
            "recency": {"detected": False, "magnitude": 0.0},
        }

        # Optimism bias detection
        expansion_scores = [t.get("score", 0) for t in trends if t.get("direction") == "Expansion"]
        contraction_scores = [t.get("score", 0) for t in trends if t.get("direction") == "Contraction"]

        if expansion_scores and contraction_scores:
            avg_expansion = sum(expansion_scores) / len(expansion_scores)
            avg_contraction = sum(contraction_scores) / len(contraction_scores)
            bias_magnitude = (avg_expansion - avg_contraction) / 5.0  # normalized to 0-1
            if bias_magnitude > 0.15:  # Threshold
                biases["optimism"]["detected"] = True
                biases["optimism"]["magnitude"] = bias_magnitude

        # Anchoring bias detection (would need historical data)
        if historical_rounds:
            score_variance = self._calculate_score_stability(
                trends,
                historical_rounds
            )
            if score_variance < 0.1:  # Very stable = anchored
                biases["anchoring"]["detected"] = True
                biases["anchoring"]["magnitude"] = 1.0 - score_variance

        # Recency bias (trends with recent updates scored higher)
        recent_trend_scores = [
            t.get("score", 0) for t in trends
            if t.get("last_updated") and self._is_recent(t.get("last_updated"))
        ]
        if recent_trend_scores and len(recent_trend_scores) > 2:
            avg_recent = sum(recent_trend_scores) / len(recent_trend_scores)
            older_scores = [
                t.get("score", 0) for t in trends
                if not t.get("last_updated") or not self._is_recent(t.get("last_updated"))
            ]
            if older_scores:
                avg_older = sum(older_scores) / len(older_scores)
                recency_bias = (avg_recent - avg_older) / 5.0
                if recency_bias > 0.1:
                    biases["recency"]["detected"] = True
                    biases["recency"]["magnitude"] = recency_bias

        return biases

    def _calculate_score_stability(
        self,
        current_trends: List[Dict[str, Any]],
        historical_rounds: List[Dict[str, Any]],
    ) -> float:
        """Calculate stability of scores across rounds (0.0 = high stability/anchoring)."""
        if not historical_rounds:
            return 0.5
        total_variance = 0.0
        count = 0
        for trend in current_trends:
            tid = trend.get("id")
            historical_scores = [
                r.get("score", 0) for r in historical_rounds
                if r.get("trend_id") == tid
            ]
            if historical_scores:
                variance = sum(abs(s - trend.get("score", 0)) for s in historical_scores) / len(historical_scores)
                total_variance += variance
                count += 1
        return total_variance / count if count > 0 else 0.5

    @staticmethod
    def _is_recent(timestamp_str: str, days_threshold: int = 30) -> bool:
        """Check if timestamp is recent (within N days)."""
        from datetime import datetime, timedelta
        try:
            timestamp = datetime.fromisoformat(timestamp_str)
            return (datetime.now() - timestamp).days <= days_threshold
        except (ValueError, TypeError):
            return False
