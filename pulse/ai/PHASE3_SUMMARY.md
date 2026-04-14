# PRISM Phase 3: AI Intelligence Layer

Complete AI intelligence layer for the PRISM simulation engine. All components are production-ready with async support, comprehensive error handling, and Financial Data Firewall integration.

## Architecture Overview

The AI layer provides:
- **LLM Provider Abstraction** — Support for Claude, Azure OpenAI, and Ollama
- **Trend Scanning** — Automated market trend detection from news sources
- **Score Calibration** — Validation of simulation scores against external data
- **Narrative Generation** — Executive-ready scenario descriptions (% only, no €M)
- **Natural Language Chat** — Question-answer interface to simulation results

All components enforce strict financial data isolation through the FinancialDataFirewall.

## Files

### `__init__.py`
Package initialization. Minimal module metadata.

### `config.py`
**AI Configuration Management**
- `LLMProvider` enum: CLAUDE, AZURE_OPENAI, OLLAMA_LOCAL
- `ProviderConfig` dataclass: API keys, endpoints, model names, temperature
- `SecurityConfig` dataclass: Firewall settings, logging, retention policies
- `AI_CONFIG` dataclass: Complete configuration with provider settings
- Helper functions: `get_ai_config()`, `set_ai_config()`

**Key Security Settings:**
- `max_numeric_value_in_prompt = 5`
- `log_all_api_calls = True`
- `require_firewall_check = True`
- `blocked_fields`: GP1, GP2, NES, revenue, profit, margin, etc.

### `provider.py`
**LLM Provider Abstraction & Implementations**

Abstract base: `LLMProvider`
- `async complete(system_prompt, user_prompt) -> str`
- `async complete_structured(system_prompt, user_prompt, schema) -> dict`
- All prompts checked through `FinancialDataFirewall` before sending

Concrete Implementations:
- **`ClaudeProvider`** — Uses Anthropic SDK (graceful fallback if not installed)
- **`AzureOpenAIProvider`** — Azure OpenAI with endpoint + API version config
- **`OllamaProvider`** — Local Ollama via HTTP (localhost:11434)

Audit Logging:
- `APICall` dataclass: logs provider, model, tokens, errors
- `AuditLogger`: maintains call history, supports querying recent calls

Factory Function:
- `get_provider(config_override=None) -> LLMProvider`

**All API calls logged to `AuditLogger` regardless of outcome.**

### `scanner.py`
**Trend Scanner — Automated Market Intelligence**

`TrendScanner` class:
- `async scan_news_sources(forces, categories, max_articles_per_source) -> list[TrendSuggestion]`
- `async scan_web_page(url, forces) -> list[TrendSuggestion]`

**Data Sources:**
- Reuters RSS feed
- Bloomberg RSS feed
- Google News RSS
- Industry Week
- Cosmetics & Toiletries magazine

**Workflow:**
1. Fetches articles from RSS feeds (async)
2. LLM analyzes each article for FMCG relevance
3. Classifies trends by force (Consumer, Customer, Technology, Government, Environmental, Competitive)
4. Assigns direction (positive/negative) and impact level
5. Returns deduplicated suggestions with confidence scores

**`TrendSuggestion` dataclass:**
- `name`: Trend name
- `force`: Force classification
- `direction`: "positive" or "negative"
- `estimated_impact`: "low", "medium", "high"
- `confidence`: 0.0–1.0
- `source_url`: Where trend was found
- `evidence_text`: Why this trend was detected

### `calibrator.py`
**Score Calibrator — Validation Against External Signals**

`ScoreCalibrator` class:
- `async calibrate_scores(trends, market_intel) -> list[CalibrationSuggestion]`
- `async get_calibration_confidence(trend, current_score) -> float`

**Features:**
- Compares simulation scores against external market data
- Detects systematic over/under-scoring
- Provides confidence levels for each adjustment

**`CalibrationSuggestion` dataclass:**
- `trend_id`: Which trend to adjust
- `field`: Which field ("score", "probability", etc.)
- `current_value`: Current score
- `suggested_value`: Recommended adjustment
- `confidence`: 0.0–1.0 confidence in recommendation
- `reasoning`: Explanation of adjustment
- `data_sources`: Where data came from

### `narrator.py`
**Scenario Narrator — Executive Communication**

`ScenarioNarrator` class:
- `async narrate_scenario(scenario, simulation_result, config) -> str`
- `async generate_executive_summary(simulation_result, allocation) -> str`
- `async generate_force_briefing(force, trends, shifts) -> str`

**Critical Principle:**
- **NEVER includes absolute financial values (€M, revenue, profit)**
- **Uses ONLY percentages, relative terms, qualitative descriptions**
- Example: "increases by 15%" not "increases by €5M"

**Output Examples:**
- Scenario narratives: 1,000–2,000 words, C-level language
- Executive summaries: 2–3 paragraphs
- Force briefings: Strategic implications of specific market forces

**Safety Features:**
- `_sanitize_narrative()` removes any leaked financial data
- Fallback narrative generation if LLM fails
- Configurable narrative style (executive, technical, detailed)

### `chat.py`
**PrismChat — Natural Language Interface**

`PrismChat` class:
- `async ask(question) -> str`
- `async ask_multi_turn(questions) -> list[str]`
- `async explain_scenario(scenario_name) -> str`
- `async compare_categories() -> str`
- `async analyze_force_impact(force) -> str`
- `async assess_risk() -> str`
- `async suggest_allocation() -> str`

**`ChatContext` dataclass:**
- Current simulation results
- Trend data
- Scenarios
- Categories and forces
- Allocation percentages
- Query history

**Features:**
- Multi-turn conversation with history
- Context-aware answering
- Firewall check on all inputs/outputs
- Specific convenience methods for common queries
- Response sanitization to remove financial data

**Example Questions Supported:**
- "Which categories face the most headwinds?"
- "What drives the expansion in Hair Care?"
- "How does this scenario impact our competitive position?"
- "What are the key risks in this allocation?"

## Integration Points

### With FinancialDataFirewall
All components check prompts and outputs through `FinancialDataFirewall`:
- `scan_text_block()` before sending to LLM
- Validates no currency patterns or financial keywords leak through
- Logs violations but allows execution to continue with flagged data masked

### With Existing PRISM Config
- Reads `pulse.config.FORCES`, `pulse.config.CATEGORIES`, `pulse.config.VC_STEPS`
- Compatible with `ModelConfig` data structures
- Uses same force and category taxonomies

### Async/Await Throughout
- All LLM calls are async (`await provider.complete(...)`)
- News scanning runs in thread pool to avoid blocking
- Supports concurrent requests
- Compatible with async event loops

## Security Model

### Three Layers of Protection

1. **Input Validation:**
   - All prompts checked through FinancialDataFirewall before sending
   - Questions in chat blocked if they reference financial data
   - News articles skipped if they contain financial data

2. **Configuration:**
   - `max_numeric_value_in_prompt = 5` prevents large numbers in prompts
   - `blocked_fields` list prevents specific terms
   - All LLM calls logged for audit trails

3. **Output Sanitization:**
   - Narratives and chat responses scanned for leaked financial data
   - Regex removal of currency patterns, €M figures, large numbers
   - Fallback narratives generated if primary response violates firewall

## Usage Examples

### Initialize a Provider
```python
from pulse.ai.provider import get_provider
from pulse.ai.config import AI_CONFIG, ProviderConfig, LLMProvider

provider = get_provider()  # Uses default (Claude)
# or with override:
custom_config = AI_CONFIG.providers[LLMProvider.OLLAMA_LOCAL]
provider = get_provider(custom_config)
```

### Scan Trends
```python
from pulse.ai.scanner import TrendScanner

scanner = TrendScanner()
trends = await scanner.scan_news_sources(
    forces=["Consumer", "Technology"],
    categories=["Hair Care"]
)
```

### Calibrate Scores
```python
from pulse.ai.calibrator import ScoreCalibrator

calibrator = ScoreCalibrator()
suggestions = await calibrator.calibrate_scores(trends, market_intel)
for sugg in suggestions:
    print(f"{sugg.trend_id}: {sugg.current_value} -> {sugg.suggested_value}")
```

### Generate Narratives
```python
from pulse.ai.narrator import ScenarioNarrator

narrator = ScenarioNarrator()
narrative = await narrator.narrate_scenario(scenario, results)
summary = await narrator.generate_executive_summary(results, allocation)
briefing = await narrator.generate_force_briefing("Consumer", trends)
```

### Chat Interface
```python
from pulse.ai.chat import PrismChat, ChatContext

chat = PrismChat()
chat.set_context(ChatContext(
    current_simulation_results=results,
    trend_data=trends,
    scenarios=scenarios,
    categories=categories,
))

answer = await chat.ask("Which categories face the most headwinds?")
answer = await chat.ask("What drives the expansion in Hair Care?")
risks = await chat.assess_risk()
allocation = await chat.suggest_allocation()
```

## Dependencies

### Required
- Python 3.9+
- asyncio (stdlib)
- json (stdlib)
- logging (stdlib)
- dataclasses (stdlib)
- typing (stdlib)

### Optional (gracefully handled)
- `anthropic` — Claude provider
- `openai` — Azure OpenAI provider
- `ollama` — Ollama local provider
- `feedparser` — RSS feed parsing for trend scanner
- `requests` — HTTP requests for web scraping

All optional dependencies are imported with try/except. Missing dependencies log warnings but don't crash.

## Testing Checklist

- [ ] All modules import without errors
- [ ] `get_provider()` returns correct instance for each provider type
- [ ] Firewall blocks financial keywords in prompts
- [ ] Audit logger records all API calls
- [ ] TrendScanner fetches and parses RSS feeds
- [ ] LLM responses are sanitized for financial data
- [ ] Chat maintains conversation history
- [ ] Narratives contain no absolute financial values
- [ ] Calibration suggestions are reasonable
- [ ] All async functions work in event loops

## Future Enhancements

- RAG (Retrieval-Augmented Generation) for trend sourcing
- Fine-tuned models for FMCG domain
- Streaming responses for long narratives
- Caching of API responses
- Multi-language support
- Custom financial data masking patterns
- Integration with vector databases for trend matching
