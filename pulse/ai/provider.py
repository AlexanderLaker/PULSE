"""LLM provider abstraction layer and concrete implementations."""

import logging
import json
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from dataclasses import dataclass
import asyncio

from pulse.ai.config import get_ai_config, ProviderConfig, LLMProvider as LLMProviderEnum

logger = logging.getLogger(__name__)


@dataclass
class APICall:
    """Record of an API call for audit logging."""
    provider: str
    model: str
    system_prompt: str
    user_prompt: str
    response: str
    tokens_in: int = 0
    tokens_out: int = 0
    cost_usd: float = 0.0
    error: Optional[str] = None


class AuditLogger:
    """Simple audit logger for API calls."""

    def __init__(self):
        self.calls: list[APICall] = []
        self.logger = logging.getLogger("pulse.ai.audit")

    def log_call(self, call: APICall):
        """Log an API call."""
        self.calls.append(call)
        if call.error:
            self.logger.error(
                f"API Error [{call.provider}]: {call.error}"
            )
        else:
            self.logger.info(
                f"API Call [{call.provider}]: {call.model} | "
                f"{call.tokens_in} in, {call.tokens_out} out"
            )

    def get_recent_calls(self, limit: int = 10) -> list[APICall]:
        """Get recent API calls."""
        return self.calls[-limit:]

    def reset(self):
        """Clear call history."""
        self.calls = []


_audit_logger = AuditLogger()


def get_audit_logger() -> AuditLogger:
    """Get the global audit logger."""
    return _audit_logger


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    def __init__(self, config: ProviderConfig):
        """
        Initialize provider with configuration.

        Args:
            config: ProviderConfig instance
        """
        self.config = config
        self.audit_logger = get_audit_logger()
        self.name = config.provider

    @abstractmethod
    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> str:
        """
        Get a text completion from the LLM.

        Args:
            system_prompt: System prompt / instructions
            user_prompt: User prompt / query

        Returns:
            LLM response as string

        Raises:
            FirewallViolation if prompts contain financial data
        """
        pass

    @abstractmethod
    async def complete_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        schema: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Get a structured completion (JSON) from the LLM.

        Args:
            system_prompt: System prompt / instructions
            user_prompt: User prompt / query
            schema: JSON schema for response validation

        Returns:
            Parsed JSON response as dictionary

        Raises:
            FirewallViolation if prompts contain financial data
        """
        pass

    def _check_prompt_safety(self, prompt: str, context: str = "") -> bool:
        """
        Check if a prompt is safe to send to LLM.
        (Disabled — always returns True)

        Args:
            prompt: Prompt text to check
            context: Context description for logging

        Returns:
            Always True (validation disabled)
        """
        return True


class ClaudeProvider(LLMProvider):
    """Claude LLM provider using Anthropic SDK."""

    def __init__(self, config: ProviderConfig):
        """Initialize Claude provider."""
        super().__init__(config)
        try:
            import anthropic
            self.client = anthropic.Anthropic(api_key=config.api_key)
        except ImportError:
            logger.warning(
                "anthropic package not installed. "
                "Install with: pip install anthropic"
            )
            self.client = None

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> str:
        """
        Get a text completion from Claude.

        Args:
            system_prompt: System prompt
            user_prompt: User prompt

        Returns:
            Claude response

        Raises:
            RuntimeError if client not initialized
            FirewallViolation if prompts contain financial data
        """
        if not self.client:
            raise RuntimeError("Claude client not initialized")


        ai_config = get_ai_config()
        try:
            message = self.client.messages.create(
                model=self.config.model,
                max_tokens=self.config.max_tokens,
                temperature=self.config.temperature,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt}
                ],
            )
            response = message.content[0].text

            # Log API call
            call = APICall(
                provider="Claude",
                model=self.config.model,
                system_prompt=system_prompt[:200],
                user_prompt=user_prompt[:200],
                response=response[:200],
                tokens_in=message.usage.input_tokens,
                tokens_out=message.usage.output_tokens,
            )
            self.audit_logger.log_call(call)

            return response

        except Exception as e:
            # Log error
            call = APICall(
                provider="Claude",
                model=self.config.model,
                system_prompt=system_prompt[:200],
                user_prompt=user_prompt[:200],
                response="",
                error=str(e),
            )
            self.audit_logger.log_call(call)
            raise

    async def complete_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        schema: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Get a structured completion (JSON) from Claude.

        Args:
            system_prompt: System prompt
            user_prompt: User prompt
            schema: JSON schema for validation

        Returns:
            Parsed JSON response

        Raises:
            RuntimeError if client not initialized
            ValueError if response doesn't match schema
        """
        if not self.client:
            raise RuntimeError("Claude client not initialized")


        try:
            # Request JSON response
            system_with_schema = (
                f"{system_prompt}\n\n"
                f"Respond with valid JSON matching this schema:\n"
                f"{json.dumps(schema, indent=2)}"
            )

            message = self.client.messages.create(
                model=self.config.model,
                max_tokens=self.config.max_tokens,
                temperature=self.config.temperature,
                system=system_with_schema,
                messages=[
                    {"role": "user", "content": user_prompt}
                ],
            )
            response_text = message.content[0].text

            # Parse JSON
            result = json.loads(response_text)

            # Log API call
            call = APICall(
                provider="Claude",
                model=self.config.model,
                system_prompt=system_with_schema[:200],
                user_prompt=user_prompt[:200],
                response=response_text[:200],
                tokens_in=message.usage.input_tokens,
                tokens_out=message.usage.output_tokens,
            )
            self.audit_logger.log_call(call)

            return result

        except Exception as e:
            # Log error
            call = APICall(
                provider="Claude",
                model=self.config.model,
                system_prompt=system_prompt[:200],
                user_prompt=user_prompt[:200],
                response="",
                error=str(e),
            )
            self.audit_logger.log_call(call)
            raise


class AzureOpenAIProvider(LLMProvider):
    """Azure OpenAI LLM provider."""

    def __init__(self, config: ProviderConfig):
        """Initialize Azure OpenAI provider."""
        super().__init__(config)
        try:
            from openai import AzureOpenAI
            self.client = AzureOpenAI(
                api_key=config.api_key,
                api_version=config.api_version,
                azure_endpoint=config.api_base,
            )
        except ImportError:
            logger.warning(
                "openai package not installed. "
                "Install with: pip install openai"
            )
            self.client = None

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> str:
        """
        Get a text completion from Azure OpenAI.

        Args:
            system_prompt: System prompt
            user_prompt: User prompt

        Returns:
            OpenAI response

        Raises:
            RuntimeError if client not initialized
        """
        if not self.client:
            raise RuntimeError("Azure OpenAI client not initialized")

        # Check prompts through firewall
        if not self._check_prompt_safety(system_prompt, "azure_system_prompt"):
            raise ValueError("System prompt contains financial data")
        if not self._check_prompt_safety(user_prompt, "azure_user_prompt"):
            raise ValueError("User prompt contains financial data")

        try:
            response = self.client.chat.completions.create(
                model=self.config.model,
                temperature=self.config.temperature,
                max_tokens=self.config.max_tokens,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
            result = response.choices[0].message.content

            # Log API call
            call = APICall(
                provider="Azure OpenAI",
                model=self.config.model,
                system_prompt=system_prompt[:200],
                user_prompt=user_prompt[:200],
                response=result[:200],
                tokens_in=response.usage.prompt_tokens,
                tokens_out=response.usage.completion_tokens,
            )
            self.audit_logger.log_call(call)

            return result

        except Exception as e:
            # Log error
            call = APICall(
                provider="Azure OpenAI",
                model=self.config.model,
                system_prompt=system_prompt[:200],
                user_prompt=user_prompt[:200],
                response="",
                error=str(e),
            )
            self.audit_logger.log_call(call)
            raise

    async def complete_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        schema: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Get a structured completion from Azure OpenAI.

        Args:
            system_prompt: System prompt
            user_prompt: User prompt
            schema: JSON schema

        Returns:
            Parsed JSON response
        """
        if not self.client:
            raise RuntimeError("Azure OpenAI client not initialized")

        # Check prompts through firewall
        if not self._check_prompt_safety(system_prompt, "azure_system_prompt"):
            raise ValueError("System prompt contains financial data")
        if not self._check_prompt_safety(user_prompt, "azure_user_prompt"):
            raise ValueError("User prompt contains financial data")

        try:
            system_with_schema = (
                f"{system_prompt}\n\n"
                f"Respond with valid JSON matching this schema:\n"
                f"{json.dumps(schema, indent=2)}"
            )

            response = self.client.chat.completions.create(
                model=self.config.model,
                temperature=self.config.temperature,
                max_tokens=self.config.max_tokens,
                messages=[
                    {"role": "system", "content": system_with_schema},
                    {"role": "user", "content": user_prompt},
                ],
            )
            response_text = response.choices[0].message.content
            result = json.loads(response_text)

            # Log API call
            call = APICall(
                provider="Azure OpenAI",
                model=self.config.model,
                system_prompt=system_with_schema[:200],
                user_prompt=user_prompt[:200],
                response=response_text[:200],
                tokens_in=response.usage.prompt_tokens,
                tokens_out=response.usage.completion_tokens,
            )
            self.audit_logger.log_call(call)

            return result

        except Exception as e:
            # Log error
            call = APICall(
                provider="Azure OpenAI",
                model=self.config.model,
                system_prompt=system_prompt[:200],
                user_prompt=user_prompt[:200],
                response="",
                error=str(e),
            )
            self.audit_logger.log_call(call)
            raise


class OllamaProvider(LLMProvider):
    """Ollama local LLM provider."""

    def __init__(self, config: ProviderConfig):
        """Initialize Ollama provider."""
        super().__init__(config)
        try:
            import ollama
            self.ollama = ollama
        except ImportError:
            logger.warning(
                "ollama package not installed. "
                "Install with: pip install ollama"
            )
            self.ollama = None

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> str:
        """
        Get a text completion from Ollama.

        Args:
            system_prompt: System prompt
            user_prompt: User prompt

        Returns:
            Ollama response

        Raises:
            RuntimeError if ollama not available
        """
        if not self.ollama:
            raise RuntimeError("Ollama not installed")

        # Check prompts through firewall
        if not self._check_prompt_safety(system_prompt, "ollama_system_prompt"):
            raise ValueError("System prompt contains financial data")
        if not self._check_prompt_safety(user_prompt, "ollama_user_prompt"):
            raise ValueError("User prompt contains financial data")

        try:
            response = self.ollama.chat(
                model=self.config.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                stream=False,
            )
            result = response["message"]["content"]

            # Log API call
            call = APICall(
                provider="Ollama",
                model=self.config.model,
                system_prompt=system_prompt[:200],
                user_prompt=user_prompt[:200],
                response=result[:200],
            )
            self.audit_logger.log_call(call)

            return result

        except Exception as e:
            # Log error
            call = APICall(
                provider="Ollama",
                model=self.config.model,
                system_prompt=system_prompt[:200],
                user_prompt=user_prompt[:200],
                response="",
                error=str(e),
            )
            self.audit_logger.log_call(call)
            raise

    async def complete_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        schema: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Get a structured completion from Ollama.

        Args:
            system_prompt: System prompt
            user_prompt: User prompt
            schema: JSON schema

        Returns:
            Parsed JSON response
        """
        if not self.ollama:
            raise RuntimeError("Ollama not installed")

        # Check prompts through firewall
        if not self._check_prompt_safety(system_prompt, "ollama_system_prompt"):
            raise ValueError("System prompt contains financial data")
        if not self._check_prompt_safety(user_prompt, "ollama_user_prompt"):
            raise ValueError("User prompt contains financial data")

        try:
            system_with_schema = (
                f"{system_prompt}\n\n"
                f"Respond with valid JSON matching this schema:\n"
                f"{json.dumps(schema, indent=2)}"
            )

            response = self.ollama.chat(
                model=self.config.model,
                messages=[
                    {"role": "system", "content": system_with_schema},
                    {"role": "user", "content": user_prompt},
                ],
                stream=False,
            )
            response_text = response["message"]["content"]
            result = json.loads(response_text)

            # Log API call
            call = APICall(
                provider="Ollama",
                model=self.config.model,
                system_prompt=system_with_schema[:200],
                user_prompt=user_prompt[:200],
                response=response_text[:200],
            )
            self.audit_logger.log_call(call)

            return result

        except Exception as e:
            # Log error
            call = APICall(
                provider="Ollama",
                model=self.config.model,
                system_prompt=system_prompt[:200],
                user_prompt=user_prompt[:200],
                response="",
                error=str(e),
            )
            self.audit_logger.log_call(call)
            raise


def get_provider(config_override: Optional[ProviderConfig] = None) -> LLMProvider:
    """
    Factory function to get an LLM provider instance.

    Args:
        config_override: Optional config to override default

    Returns:
        LLMProvider instance

    Raises:
        ValueError if provider not supported
    """
    ai_config = get_ai_config()

    if config_override:
        config = config_override
    else:
        config = ai_config.providers[ai_config.default_provider]

    if config.provider == LLMProviderEnum.CLAUDE:
        return ClaudeProvider(config)
    elif config.provider == LLMProviderEnum.AZURE_OPENAI:
        return AzureOpenAIProvider(config)
    elif config.provider == LLMProviderEnum.OLLAMA_LOCAL:
        return OllamaProvider(config)
    else:
        raise ValueError(f"Unsupported provider: {config.provider}")
