# PRISM AI Layer — Quick Start Guide

## File Locations
All files created in: `/sessions/determined-blissful-fermi/mnt/Working Files/PROFIT_POOL_ENGINE/pulse/ai/`

## Files & Responsibilities

| File | Lines | Purpose |
|------|-------|---------|
| `__init__.py` | 7 | Package metadata |
| `config.py` | 119 | AI configuration, provider settings, security |
| `provider.py` | 646 | LLM abstraction, Claude/Azure/Ollama, audit logging |
| `scanner.py` | 330 | Trend scanner, RSS parsing, LLM analysis |
| `calibrator.py` | 323 | Score validation, backtesting calibration |
| `narrator.py` | 344 | Narrative generation (% only, no financial values) |
| `chat.py` | 385 | Natural language Q&A interface |
| **Total** | **2,154** | Complete Phase 3 AI intelligence layer |

## Key Features

### Security
- All LLM calls pass through `FinancialDataFirewall`
- Input/output sanitization removes financial data
- `max_numeric_value_in_prompt = 5` prevents large numbers
- All API calls logged for audit trails

### Async/Await Throughout
```python
async def example():
    provider = get_provider()
    response = await provider.complete(system, user)
```

### Three Providers Supported
```python
from pulse.ai.config import LLMProvider
# Claude, Azure OpenAI, Ollama (local)
```

## Core Classes & Methods

### 1. Provider (`provider.py`)
```python
provider = get_provider()  # Get default (Claude)
response = await provider.complete(system, user)
data = await provider.complete_structured(system, user, schema)
```

### 2. TrendScanner (`scanner.py`)
```python
scanner = TrendScanner()
trends = await scanner.scan_news_sources(
    forces=["Consumer", "Technology"],
    categories=["Hair Care"]
)
```

### 3. ScoreCalibrator (`calibrator.py`)
```python
calibrator = ScoreCalibrator()
suggestions = await calibrator.calibrate_scores(trends, market_intel)
```

### 4. ScenarioNarrator (`narrator.py`)
```python
narrator = ScenarioNarrator()
narrative = await narrator.narrate_scenario(scenario, results)
summary = await narrator.generate_executive_summary(results)
briefing = await narrator.generate_force_briefing("Consumer", trends)
```

### 5. PulseChat (`chat.py`)
```python
chat = PulseChat()
chat.set_context(ChatContext(
    current_simulation_results=results,
    trend_data=trends,
    scenarios=scenarios,
))

answer = await chat.ask("Which categories face the most headwinds?")
risks = await chat.assess_risk()
allocation = await chat.suggest_allocation()
```

## Configuration

### Set Provider
```python
from pulse.ai.config import AI_CONFIG, LLMProvider, ProviderConfig

# Use Azure instead of Claude
custom = AI_CONFIG.providers[LLMProvider.AZURE_OPENAI]
custom.api_key = "your-key"
provider = get_provider(custom)
```

### Adjust Security Settings
```python
from pulse.ai.config import get_ai_config

config = get_ai_config()
config.security.log_all_api_calls = True
config.security.audit_retention_days = 90
```

## Data Structures

### TrendSuggestion
```python
@dataclass
class TrendSuggestion:
    name: str  # "Gen Z Sustainability Preferences"
    force: str  # "Consumer"
    direction: str  # "positive" or "negative"
    estimated_impact: str  # "low", "medium", "high"
    confidence: float  # 0.0 to 1.0
    source_url: str
    evidence_text: str
```

### CalibrationSuggestion
```python
@dataclass
class CalibrationSuggestion:
    trend_id: str
    field: str  # "score"
    current_value: float
    suggested_value: float
    confidence: float
    reasoning: str
    data_sources: List[str]
```

### ChatContext
```python
@dataclass
class ChatContext:
    current_simulation_results: Dict[str, Any]
    trend_data: List[Dict[str, Any]]
    scenarios: List[Dict[str, Any]]
    categories: List[str]
    forces: List[str]
    allocation: Dict[str, float]
    recent_queries: List[str]
```

## Critical Design Principles

1. **No Financial Data in Narratives**
   - Never include €M, revenue, profit, or absolute values
   - Use percentages only: "increases by 15%"

2. **Firewall on All AI Calls**
   - Every prompt validated before sending
   - Every response sanitized before returning

3. **Async First**
   - All LLM calls are async
   - Thread pool for blocking I/O (RSS, web scraping)

4. **Graceful Degradation**
   - Missing optional dependencies (anthropic, ollama) logged but don't crash
   - Fallback narratives if LLM fails
   - Default values if data missing

## Testing

All files pass Python syntax validation:
```bash
python3 -m py_compile __init__.py config.py provider.py \
  scanner.py calibrator.py narrator.py chat.py
```

## Integration with PRISM

The AI layer integrates seamlessly with existing PRISM components:
- Uses `pulse.config.FORCES`, `pulse.config.CATEGORIES`
- Respects `FinancialDataFirewall` from `pulse.ingestion.firewall`
- Compatible with `ModelConfig` structures
- Follows same taxonomy as core engine

## Next Steps

1. Set API keys for your chosen provider
2. Create a TrendScanner to identify market trends
3. Run simulations and calibrate against market intel
4. Generate executive narratives for scenarios
5. Use PulseChat for ad-hoc analysis questions

## Support

For errors related to:
- **Missing dependencies**: Install anthropic, openai, ollama, feedparser, requests
- **API failures**: Check API keys and network connectivity
- **Firewall blocks**: Review FinancialDataFirewall violations log
- **Narrative quality**: Adjust narrative_style in AI_CONFIG

