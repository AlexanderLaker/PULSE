# Phase 3 AI Modules — Quick Start Guide

## Installation

All modules are ready to use. No additional dependencies required for basic operation.

```bash
cd /sessions/quirky-epic-sagan/mnt/PROFIT_POOL_ENGINE
```

## Optional: Install LLM Providers

For Claude API (MVP):
```bash
pip install anthropic
export ANTHROPIC_API_KEY="your-key-here"
```

For Azure OpenAI (Production):
```bash
pip install openai
export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com/"
export AZURE_OPENAI_KEY="your-key-here"
```

For local Ollama:
```bash
pip install ollama
# Ensure Ollama running at http://localhost:11434
```

For trend scanning (optional):
```bash
pip install feedparser requests beautifulsoup4
```

## Usage Examples

### 1. Trend Scanning

```python
import asyncio
from pulse.ai import TrendScanner

async def scan_for_trends():
    scanner = TrendScanner()

    # Scan RSS feeds for FMCG trends
    suggestions = await scanner.scan_news_sources(
        forces=["Consumer", "Technology"],
        max_articles_per_source=5
    )

    for sugg in suggestions:
        print(f"Trend: {sugg.name}")
        print(f"  Force: {sugg.force}")
        print(f"  Direction: {sugg.direction}")
        print(f"  Confidence: {sugg.confidence:.0%}")
        print(f"  Source: {sugg.source_url}")

asyncio.run(scan_for_trends())
```

### 2. Score Calibration

```python
import asyncio
from pulse.ai import ScoreCalibrator

async def calibrate_scores():
    calibrator = ScoreCalibrator()

    # Mock trend data
    trends = [
        {"id": "1", "name": "Gen Z Sustainability", "force": "Consumer",
         "direction": "Expansion", "score": 4.5},
        {"id": "2", "name": "Regulation", "force": "Government",
         "direction": "Contraction", "score": 2.5},
    ]

    # Detect biases
    biases = await calibrator.detect_bias_patterns(trends)
    print(f"Optimism bias detected: {biases['optimism']['detected']}")
    print(f"  Magnitude: {biases['optimism']['magnitude']:.2f}")

    # Get calibration suggestions
    suggestions = await calibrator.calibrate_scores(trends)
    for sugg in suggestions:
        print(f"Adjust {sugg.trend_id}: {sugg.current_value:.1f} → {sugg.suggested_value:.1f}")

asyncio.run(calibrate_scores())
```

### 3. Scenario Narratives

```python
import asyncio
from pulse.ai import ScenarioNarrator

async def generate_narrative():
    narrator = ScenarioNarrator()

    scenario = {
        "name": "Green Squeeze",
        "description": "Regulation + consumer sustainability",
    }

    results = {
        "distribution": {
            "percentiles": {
                "10": -0.05, "50": -0.02, "90": 0.005
            }
        },
        "category_impacts": {
            "Hair: Color": -0.032,
            "Hair: Care": 0.015,
        }
    }

    narrative = await narrator.narrate_scenario(scenario, results)
    print(narrative)

asyncio.run(generate_narrative())
```

### 4. Natural Language Chat

```python
import asyncio
from pulse.ai import PrismChat, ChatContext

async def chat():
    chat = PrismChat()

    # Set context
    context = ChatContext(
        current_simulation_results={
            "category_impacts": {
                "Hair: Color": -0.032,
                "Hair: Care": 0.015,
            }
        },
        categories=["Hair: Color", "Hair: Care", "LHC: FCN"],
        forces=["Consumer", "Government", "Technology"],
    )
    chat.set_context(context)

    # Ask questions
    answer = await chat.ask("Which categories face the most headwinds?")
    print(answer)

    answer = await chat.ask("How does the Consumer force impact our portfolio?")
    print(answer)

asyncio.run(chat())
```

## Configuration

### Change LLM Provider

```python
from pulse.ai import get_ai_config, set_ai_config, LLMProvider

ai_config = get_ai_config()
ai_config.default_provider = LLMProvider.AZURE_OPENAI  # or CLAUDE, OLLAMA_LOCAL
set_ai_config(ai_config)
```

### Disable Firewall (Testing Only)

```python
from pulse.ai import get_ai_config

ai_config = get_ai_config()
ai_config.security.require_firewall_check = False  # ⚠️ NOT RECOMMENDED
set_ai_config(ai_config)
```

### Adjust Narrative Style

```python
from pulse.ai import get_ai_config

ai_config = get_ai_config()
ai_config.narrative_style = "technical"  # "executive" | "technical" | "detailed"
ai_config.max_narrative_length = 3000
set_ai_config(ai_config)
```

## Running Tests

```bash
# Full test suite with all modules
python3 test_ai_modules.py

# This will:
# ✓ Test all 4 modules
# ✓ Verify fallback modes
# ✓ Check firewall functionality
# ✓ Confirm no API keys required
# ✓ Display comprehensive results
```

## Common Patterns

### Pattern 1: Detect and fix scoring bias

```python
async def fix_scoring_bias():
    from pulse.ai import ScoreCalibrator

    calibrator = ScoreCalibrator()

    # Your trends from database
    trends = get_current_trends()

    # Detect biases
    biases = await calibrator.detect_bias_patterns(trends)

    if biases['optimism']['detected']:
        print(f"WARNING: Optimism bias detected (magnitude: {biases['optimism']['magnitude']:.2f})")
        print("Consider downweighting expansion-direction trends by 10-15%")
```

### Pattern 2: Generate executive briefing

```python
async def create_executive_briefing():
    from pulse.ai import ScenarioNarrator

    narrator = ScenarioNarrator()

    # Your simulation results
    sim_results = run_simulation(scenario="base_case")

    # Generate summary
    summary = await narrator.generate_executive_summary(sim_results)

    # Generate force briefings
    for force in ["Consumer", "Government", "Technology"]:
        trends = get_trends_by_force(force)
        briefing = await narrator.generate_force_briefing(force, trends)
        print(f"\n{force} Briefing:\n{briefing}")
```

### Pattern 3: Multi-turn analysis conversation

```python
async def interactive_analysis():
    from pulse.ai import PrismChat

    chat = PrismChat()

    # Questions to ask in sequence
    questions = [
        "Which categories face headwinds?",
        "What's driving the decline?",
        "What should we do about it?",
    ]

    # Get answers one by one
    for question in questions:
        answer = await chat.ask(question)
        print(f"Q: {question}\nA: {answer}\n")
```

### Pattern 4: Complete analysis pipeline

```python
async def full_analysis_pipeline():
    from pulse.ai import TrendScanner, ScoreCalibrator, ScenarioNarrator, PrismChat

    # Step 1: Scan for new trends
    scanner = TrendScanner()
    new_trends = await scanner.scan_news_sources()
    print(f"Found {len(new_trends)} new trends")

    # Step 2: Calibrate all scores
    calibrator = ScoreCalibrator()
    current_trends = get_current_trends()
    calibration = await calibrator.calibrate_scores(current_trends)
    print(f"Calibration suggestions: {len(calibration)}")

    # Step 3: Generate narrative
    narrator = ScenarioNarrator()
    results = run_simulation()
    narrative = await narrator.generate_executive_summary(results)
    print(f"Executive summary:\n{narrative}")

    # Step 4: Answer strategic questions
    chat = PrismChat()
    chat.set_context(build_chat_context())
    strategic_question = "What's our allocation recommendation?"
    recommendation = await chat.ask(strategic_question)
    print(f"Recommendation:\n{recommendation}")
```

## Troubleshooting

### "Claude client not initialized" Warning

**Expected behavior** — means API key not set. Modules work in fallback mode.

**Solution**: Set API key or accept fallback responses.

```bash
export ANTHROPIC_API_KEY="sk-..."
```

### "feedparser not installed" When Scanning

**Expected behavior** — RSS scanning unavailable, returns empty.

**Solution**: Install optional dependency.

```bash
pip install feedparser
```

### Financial Data in Response

**Will not happen** — firewall prevents it. If warning appears, data is automatically sanitized.

### Slow Responses

**Check**:
1. Is LLM available? (Check API key)
2. Is network connection working?
3. Try rule-based fallback mode (no network needed)

## API Reference

### TrendScanner
```python
scanner.scan()                      # Main method
scanner.scan_news_sources()        # RSS feeds
scanner.scan_web_page()            # Single page
scanner.get_pending_suggestions()  # Retrieve suggestions
```

### ScoreCalibrator
```python
calibrator.calibrate_scores()      # LLM-based calibration
calibrator.detect_bias_patterns()  # Statistical bias detection
calibrator.calibrate_with_backtesting()  # Historical calibration
calibrator.get_calibration_confidence()  # Confidence score
```

### ScenarioNarrator
```python
narrator.narrate_scenario()        # Full narrative with causal
narrator.generate_executive_summary()  # 2-3 paragraph brief
narrator.generate_force_briefing()   # Single force analysis
```

### PrismChat
```python
chat.ask()                          # Single question
chat.ask_multi_turn()              # Multiple questions
chat.explain_scenario()             # Scenario explanation
chat.compare_categories()           # Category analysis
chat.analyze_force_impact()         # Force deep dive
chat.assess_risk()                  # Risk assessment
chat.suggest_allocation()           # Budget recommendation
chat.set_context()                  # Load simulation context
chat.get_conversation_history()     # Retrieve chat history
```

## Next Steps

1. **Run the tests**: `python3 test_ai_modules.py`
2. **Review the code**: Look at `pulse/ai/` directory
3. **Integrate with War Room**: Use modules in dashboard
4. **Set up scheduling**: Weekly trend scanning with cron
5. **Configure production**: Azure Key Vault + Power BI export

## Support

See `PHASE_3_AI_COMPLETION.md` for comprehensive documentation.

---

**Last Updated**: 2026-03-26
**Status**: Production Ready (with fallback modes)
**Version**: 3.0.0
