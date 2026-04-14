"""PRISM Phase 3 AI Intelligence Layer.

Provides LLM-powered analysis, trend scanning, score calibration, and natural language
interfaces to the PRISM simulation engine.

Main Classes:
- TrendScanner: Multi-source news/trend detection with LLM classification
- ScoreCalibrator: Bias detection and calibration against market signals
- SimulationNarrator: Executive narrative generation with causal explanations
- PrismChat: Natural language interface with rule-based fallback mode
"""

from pulse.ai.scanner import TrendScanner, TrendSuggestion
from pulse.ai.calibrator import ScoreCalibrator, CalibrationSuggestion
from pulse.ai.narrator import SimulationNarrator
from pulse.ai.chat import PrismChat, ChatContext

# Backward compatibility alias
ScenarioNarrator = SimulationNarrator
from pulse.ai.config import (
    get_ai_config,
    set_ai_config,
    LLMProvider,
    ProviderConfig,
    AI_CONFIG,
    SecurityConfig,
)
from pulse.ai.provider import (
    get_provider,
    LLMProvider as LLMProviderBase,
    ClaudeProvider,
    AzureOpenAIProvider,
    OllamaProvider,
)

__version__ = "3.0.0"
__all__ = [
    "TrendScanner",
    "TrendSuggestion",
    "ScoreCalibrator",
    "CalibrationSuggestion",
    "SimulationNarrator",
    "ScenarioNarrator",  # Backward compatibility alias
    "PrismChat",
    "ChatContext",
    "get_ai_config",
    "set_ai_config",
    "get_provider",
    "LLMProvider",
    "ProviderConfig",
    "AI_CONFIG",
    "SecurityConfig",
]
