"""AI layer configuration — provider settings, security, logging."""

from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from enum import Enum


class LLMProvider(str, Enum):
    """Supported LLM providers."""
    CLAUDE = "claude"
    AZURE_OPENAI = "azure_openai"
    OLLAMA_LOCAL = "ollama_local"


@dataclass
class ProviderConfig:
    """Configuration for a specific LLM provider."""
    provider: str
    api_key: Optional[str] = None
    api_base: Optional[str] = None
    api_version: Optional[str] = None
    model: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 2048
    timeout_seconds: int = 30


@dataclass
class SecurityConfig:
    """Security and compliance settings for AI layer."""
    blocked_fields: list = field(default_factory=lambda: [
        "GP1", "GP2", "NES", "revenue", "profit", "margin", "turnover",
        "EBIT", "EBITDA", "net_income", "sales", "cost_of_goods_sold"
    ])
    max_numeric_value_in_prompt: int = 5
    log_all_api_calls: bool = True
    mask_financial_data: bool = True
    require_firewall_check: bool = True
    audit_retention_days: int = 90


@dataclass
class AI_CONFIG:
    """Complete AI layer configuration."""

    # Provider configurations
    providers: Dict[str, ProviderConfig] = field(default_factory=lambda: {
        LLMProvider.CLAUDE: ProviderConfig(
            provider=LLMProvider.CLAUDE,
            model="claude-3-5-sonnet-20241022",
            temperature=0.7,
            max_tokens=2048,
        ),
        LLMProvider.AZURE_OPENAI: ProviderConfig(
            provider=LLMProvider.AZURE_OPENAI,
            api_base="https://your-resource.openai.azure.com/",
            api_version="2024-02-15-preview",
            model="gpt-4-turbo",
            temperature=0.7,
            max_tokens=2048,
        ),
        LLMProvider.OLLAMA_LOCAL: ProviderConfig(
            provider=LLMProvider.OLLAMA_LOCAL,
            api_base="http://localhost:11434",
            model="llama2",
            temperature=0.7,
            max_tokens=2048,
        ),
    })

    # Security settings
    security: SecurityConfig = field(default_factory=SecurityConfig)

    # Default provider to use
    default_provider: str = LLMProvider.CLAUDE

    # News scanning configuration
    news_sources: list = field(default_factory=lambda: [
        "https://feeds.reuters.com/reuters/businessNews",
        "https://feeds.bloomberg.com/markets/news.rss",
        "https://news.google.com/rss?hl=en&gl=US&ceid=US:en",
        "https://feeds.industryweek.com/rss",
        "https://www.cosmeticsandtoiletries.com/feed",
    ])

    # Trend categories to scan for
    trend_categories: list = field(default_factory=lambda: [
        "Beauty & Personal Care",
        "Consumer Trends",
        "Sustainability",
        "Innovation",
        "Market Dynamics",
        "Regulatory Changes",
    ])

    # Cache settings
    enable_response_cache: bool = True
    cache_ttl_seconds: int = 3600

    # Narrative settings
    narrative_style: str = "executive"  # "executive" | "technical" | "detailed"
    use_percentages_only: bool = True
    hide_absolute_values: bool = True
    max_narrative_length: int = 2000


# Global configuration instance
_ai_config = AI_CONFIG()


def get_ai_config() -> AI_CONFIG:
    """Get the global AI configuration."""
    return _ai_config


def set_ai_config(config: AI_CONFIG):
    """Set the global AI configuration."""
    global _ai_config
    _ai_config = config
