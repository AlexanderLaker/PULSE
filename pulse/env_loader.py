"""Environment variable loader for PRISM configuration.

Loads settings from .env file using python-dotenv and provides
a clean interface for accessing credentials and configuration.

Usage:
    from pulse.env_loader import get_env, EnvConfig

    api_key = get_env("ANTHROPIC_API_KEY")
    config = EnvConfig()
    db_path = config.db_path
    ai_provider = config.ai_provider
"""

import os
import logging
from pathlib import Path
from typing import Optional

try:
    from dotenv import load_dotenv
except ImportError:
    raise ImportError(
        "python-dotenv is required. Install with: pip install python-dotenv"
    )

logger = logging.getLogger(__name__)

# ── Load .env file ──────────────────────────────────────────────────────
# Load from project root, or from .env.example if .env doesn't exist
PROJECT_ROOT = Path(__file__).parent.parent
ENV_FILE = PROJECT_ROOT / ".env"
ENV_EXAMPLE = PROJECT_ROOT / ".env.example"

if ENV_FILE.exists():
    load_dotenv(ENV_FILE, override=True)
    logger.info(f"Loaded environment from {ENV_FILE}")
elif ENV_EXAMPLE.exists():
    logger.warning(
        f".env not found. Using defaults. Copy {ENV_EXAMPLE} to .env and fill in credentials."
    )
else:
    logger.warning(
        f"Neither .env nor .env.example found in {PROJECT_ROOT}. "
        f"All API calls will fail without credentials."
    )


def get_env(key: str, default: Optional[str] = None) -> Optional[str]:
    """
    Get environment variable with logging.

    Args:
        key: Environment variable name
        default: Default value if not set

    Returns:
        Environment variable value or default

    Example:
        api_key = get_env("ANTHROPIC_API_KEY")
        db_path = get_env("PRISM_DB_PATH", default="data/pulse.db")
    """
    value = os.getenv(key, default)

    if value is None and key not in (
        "ANTHROPIC_API_KEY",
        "AZURE_OPENAI_ENDPOINT",
        "GNEWS_API_KEY",
        "CURRENTSAPI_KEY",
    ):
        # Optional keys — don't warn
        pass
    elif value is None:
        # Required key is missing
        logger.debug(f"Environment variable {key} not set (will use default if available)")

    return value


def is_api_configured(api_name: str) -> bool:
    """
    Check if an API has been configured with credentials.

    Args:
        api_name: Name of API ("anthropic", "azure", "gnews", etc.)

    Returns:
        True if API appears to be configured

    Examples:
        if is_api_configured("anthropic"):
            # Can use Claude API
        if is_api_configured("azure"):
            # Can use Azure OpenAI
    """
    api_checks = {
        "anthropic": ["ANTHROPIC_API_KEY"],
        "azure": ["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_KEY"],
        "gnews": ["GNEWS_API_KEY"],
        "currents": ["CURRENTSAPI_KEY"],
        "reddit": ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"],
        "youtube": ["YOUTUBE_API_KEY"],
        "fred": ["FRED_API_KEY"],
        "epo": ["EPO_API_KEY", "EPO_API_SECRET"],
        "powerbi": [
            "POWERBI_TENANT_ID",
            "POWERBI_SERVICE_PRINCIPAL_ID",
            "POWERBI_SERVICE_PRINCIPAL_SECRET",
        ],
    }

    if api_name.lower() not in api_checks:
        logger.warning(f"Unknown API: {api_name}")
        return False

    required_keys = api_checks[api_name.lower()]
    return all(os.getenv(key) for key in required_keys)


class EnvConfig:
    """Typed configuration object with environment variables and defaults."""

    def __init__(self):
        """Initialize configuration from environment."""
        # ── LLM Providers ────────────────────────────────────────────────

        self.anthropic_api_key = get_env("ANTHROPIC_API_KEY")
        self.azure_openai_endpoint = get_env("AZURE_OPENAI_ENDPOINT")
        self.azure_openai_key = get_env("AZURE_OPENAI_KEY")
        self.azure_openai_deployment_id = get_env(
            "AZURE_OPENAI_DEPLOYMENT_ID", default="pulse-gpt4"
        )

        # ── News & Intelligence APIs ────────────────────────────────────

        self.gnews_api_key = get_env("GNEWS_API_KEY")
        self.currents_api_key = get_env("CURRENTSAPI_KEY")
        self.fred_api_key = get_env("FRED_API_KEY")
        self.reddit_client_id = get_env("REDDIT_CLIENT_ID")
        self.reddit_client_secret = get_env("REDDIT_CLIENT_SECRET")
        self.youtube_api_key = get_env("YOUTUBE_API_KEY")
        self.epo_api_key = get_env("EPO_API_KEY")
        self.epo_api_secret = get_env("EPO_API_SECRET")

        # ── Paid APIs ────────────────────────────────────────────────────

        self.euromonitor_api_key = get_env("EUROMONITOR_API_KEY")
        self.statista_api_key = get_env("STATISTA_API_KEY")

        # ── Database & Storage ───────────────────────────────────────────
        # Database mode is determined by pulse.database module:
        #   - If POSTGRES_URL is set → Postgres (Vercel Neon, persistent)
        #   - Otherwise → SQLite (local dev)
        # This path is only used for SQLite fallback.
        _is_vercel = bool(os.environ.get("VERCEL") or os.environ.get("VERCEL_ENV"))
        _default_db = "/tmp/pulse.db" if _is_vercel else "data/pulse.db"
        self.db_path = get_env("PRISM_DB_PATH", default=_default_db)

        # ── Application Settings ────────────────────────────────────────

        ai_provider_env = get_env("AI_PROVIDER", default="claude").lower()
        if ai_provider_env not in ("claude", "azure", "ollama", "none"):
            logger.warning(
                f"Unknown AI_PROVIDER: {ai_provider_env}. "
                f"Valid options: claude, azure, ollama, none. Using 'claude'."
            )
            ai_provider_env = "claude"
        self.ai_provider = ai_provider_env

        try:
            self.mc_iterations = int(get_env("MC_ITERATIONS", default="50000"))
        except ValueError:
            logger.warning("MC_ITERATIONS not a valid integer, using 50000")
            self.mc_iterations = 50000

        self.debug = get_env("DEBUG", default="false").lower() in ("true", "1", "yes")

        # ── Power BI Integration ─────────────────────────────────────────

        self.powerbi_tenant_id = get_env("POWERBI_TENANT_ID")
        self.powerbi_service_principal_id = get_env("POWERBI_SERVICE_PRINCIPAL_ID")
        self.powerbi_service_principal_secret = get_env(
            "POWERBI_SERVICE_PRINCIPAL_SECRET"
        )
        self.powerbi_workspace_id = get_env("POWERBI_WORKSPACE_ID")
        self.powerbi_dataset_id = get_env("POWERBI_DATASET_ID")

        # ── Development & Testing ────────────────────────────────────────

        self.test_mode = (
            get_env("TEST_MODE", default="false").lower() in ("true", "1", "yes")
        )

    def get_llm_config(self) -> dict:
        """
        Get LLM provider configuration based on AI_PROVIDER setting.

        Returns:
            Configuration dict for the selected LLM provider

        Example:
            config = EnvConfig()
            llm_cfg = config.get_llm_config()
            if config.ai_provider == "anthropic":
                client = Anthropic(api_key=llm_cfg["api_key"])
        """
        if self.ai_provider == "claude":
            return {
                "provider": "claude",
                "api_key": self.anthropic_api_key,
                "model": "claude-3-5-sonnet-20241022",
            }
        elif self.ai_provider == "azure":
            return {
                "provider": "azure",
                "endpoint": self.azure_openai_endpoint,
                "api_key": self.azure_openai_key,
                "deployment_id": self.azure_openai_deployment_id,
                "api_version": "2024-02-15-preview",
            }
        elif self.ai_provider == "ollama":
            return {
                "provider": "ollama",
                "endpoint": "http://localhost:11434",
                "model": "mistral",
            }
        else:
            return {"provider": "none", "disabled": True}

    def __repr__(self) -> str:
        """String representation of configuration (safe — no secrets)."""
        return (
            f"EnvConfig(\n"
            f"  ai_provider={self.ai_provider},\n"
            f"  mc_iterations={self.mc_iterations},\n"
            f"  db_path={self.db_path},\n"
            f"  debug={self.debug},\n"
            f"  apis_configured: "
            f"anthropic={is_api_configured('anthropic')}, "
            f"azure={is_api_configured('azure')}, "
            f"gnews={is_api_configured('gnews')}\n"
            f")"
        )


# ── Singleton instance for easy access ──────────────────────────────────
_config_instance: Optional[EnvConfig] = None


def get_config() -> EnvConfig:
    """
    Get singleton EnvConfig instance.

    Returns:
        Cached EnvConfig instance

    Example:
        config = get_config()
        print(config.ai_provider)
    """
    global _config_instance
    if _config_instance is None:
        _config_instance = EnvConfig()
    return _config_instance


def reset_config() -> None:
    """Reset singleton instance (mainly for testing)."""
    global _config_instance
    _config_instance = None
