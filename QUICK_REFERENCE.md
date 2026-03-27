# PULSE Backend Implementation — Quick Reference

## Task 1: Competitor Profiles
**File:** `pulse/game_theory/competitive.py`

```python
from pulse.game_theory.competitive import DEFAULT_COMPETITORS

# 6 competitors now available
competitors = DEFAULT_COMPETITORS
for cid, comp in competitors.items():
    print(f"{comp.name} ({comp.archetype})")
    # Output: P&G, Unilever, Reckitt, L'Oréal, Kao, Church & Dwight
```

**New competitors:** L'Oréal, Kao, Church & Dwight  
**New response effects:** 8 (acquire_and_integrate, sustainability_investment, etc.)

---

## Task 2: Config Validation
**File:** `pulse/config_validation.py`

```python
from pulse.config_validation import validate_model_config
from pulse.config import ModelConfig

config = ModelConfig()
validated = validate_model_config(config.__dict__)
# Validates 12 constraints: weights sum, attenuation in [0,1], etc.
```

**Constraints enforced:**
- force_weights & vc_weights sum to 1.0
- attenuation ∈ [0, 1]
- iterations ≥ 100
- materialization monotonically increasing

---

## Task 3: Environment Configuration
**Files:** `.env.example`, `pulse/env_loader.py`

```python
from pulse.env_loader import get_config, is_api_configured

config = get_config()  # Singleton
print(config.ai_provider)          # "claude" | "azure" | "ollama" | "none"

if is_api_configured("anthropic"):
    llm_cfg = config.get_llm_config()
```

**Setup:**
```bash
cp .env.example .env
# Edit .env with your API keys
```

**Supported APIs:** Anthropic, Azure OpenAI, GNews, Currents, FRED, Reddit, YouTube, EPO, Power BI

---

## Task 4: Database Persistence
**File:** `pulse/database.py`

```python
from pulse.database import init_db, save_trends, load_trends, log_audit

# Initialize database (one-time)
init_db()  # Creates data/pulse.db

# Save trends
save_trends([trend1, trend2, ...])

# Load trends
trends = load_trends()

# Audit log
log_audit("UPDATE", "trend", "c1", old_value="3", new_value="4", 
          reason="Delphi consensus", user_id="analyst_1")
```

**12 tables:** trends, causal_edges, simulation_runs, audit_log, etc.  
**Security:** No financial data stored (firewall by schema design)

---

## File Locations
```
pulse/game_theory/competitive.py    (UPDATED — 6 competitors, 23 effects)
pulse/config_validation.py          (NEW — Pydantic v2 validators)
pulse/env_loader.py                 (NEW — Environment configuration)
pulse/database.py                   (NEW — SQLite persistence, 12 tables)
.env.example                        (NEW — API key template)
data/pulse.db                       (AUTO-CREATED on init_db())
requirements.txt                    (UPDATED — added python-dotenv)
```

---

## Quick Start
```bash
# 1. Install dependencies
pip install python-dotenv pydantic

# 2. Copy environment template
cp .env.example .env

# 3. Add your API credentials to .env
# (Edit ANTHROPIC_API_KEY, AZURE_OPENAI_*, etc.)

# 4. Initialize database
python -m pulse.database

# 5. Ready to use
from pulse.database import init_db, load_trends
from pulse.env_loader import get_config
from pulse.config_validation import validate_model_config
```

---

## All Tests Pass ✓
- 6 competitors, 23 response effects
- 12 constraint validators
- 103-line env template, 9+ API checks
- 12 database tables, full persistence

**Ready for Phase 1-3 implementation.**
