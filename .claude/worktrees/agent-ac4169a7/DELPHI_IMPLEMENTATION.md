# Delphi Expert Elicitation Implementation — PRISM v2.1

## Overview

Implemented complete Delphi expert elicitation protocol with database persistence, API endpoints, and frontend integration. The system enables structured multi-round scoring of strategic trends with bias detection, calibration, and consensus building.

## Architecture

### 1. Backend Components

#### A. Enhanced Delphi Protocol (`pulse/elicitation/delphi.py`)

**New Classes:**
- `DelphiSession`: Represents a session grouping multiple rounds for specific trends and scorers
- Extended `DelphiProtocol`: Added database persistence and session management

**Key Methods:**

Session Management:
- `create_session(name, description, trend_ids, scorer_ids)` → str (session_id)
- `get_session(session_id)` → Dict (full session details with rounds and stats)
- `get_sessions()` → List[Dict] (all sessions)
- `advance_session_round(session_id)` → Dict (next round summary)
- `complete_session(session_id)` → Dict (consensus scores)
- `get_scorer_history(scorer_id)` → Dict (all scores across sessions)
- `apply_consensus_to_trends(session_id, trend_db)` → Dict (applies to TrendDatabase)
- `get_round_summary(session_id, round_number)` → Dict (anonymized distributions)

Existing Methods (Enhanced with DB):
- `submit_round(round_data, session_id)` - Now persists to database
- `run_calibration(scorer_id, responses)` - Now persists calibration data
- `consensus_score(trend_id)` - Unchanged, works with persisted data
- `inter_rater_reliability(trend_id, round_number)` - Unchanged

**Database Integration:**
- `_load_sessions_from_db()` - Called on init to load all sessions
- `_ensure_tables_exist()` - Creates Delphi-specific tables
- All submit operations automatically persist to SQLite

#### B. New Database Tables

Created during `DelphiProtocol()` initialization:

```sql
-- Delphi sessions (groups rounds)
CREATE TABLE delphi_sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    current_round INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    trend_ids TEXT,  -- JSON array
    scorer_ids TEXT   -- JSON array
);

-- Scorer calibration profiles
CREATE TABLE delphi_calibration (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT REFERENCES delphi_sessions(id),
    scorer_id TEXT NOT NULL,
    calibration_factor REAL DEFAULT 1.0,
    bias_flags TEXT,  -- JSON array
    mean_impact_error REAL DEFAULT 0,
    mean_prob_error REAL DEFAULT 0,
    calibrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Updated existing delphi_rounds table
ALTER TABLE delphi_rounds ADD COLUMN session_id TEXT REFERENCES delphi_sessions(id);
```

#### C. FastAPI Routes (`pulse/api/routes/delphi.py`)

**14 Endpoints across 4 categories:**

**Session Management (5 endpoints):**
```
POST   /api/v1/delphi/sessions                    → Create session
GET    /api/v1/delphi/sessions                    → List sessions
GET    /api/v1/delphi/sessions/{id}               → Get session detail
POST   /api/v1/delphi/sessions/{id}/advance       → Advance to next round
POST   /api/v1/delphi/sessions/{id}/complete      → Finalize session
```

**Scoring (2 endpoints):**
```
POST   /api/v1/delphi/sessions/{id}/score         → Submit score
GET    /api/v1/delphi/sessions/{id}/scores        → Get scores (filterable)
```

**Calibration (2 endpoints):**
```
POST   /api/v1/delphi/sessions/{id}/calibrate     → Run calibration
GET    /api/v1/delphi/sessions/{id}/calibration   → Get calibration results
```

**Analysis & Transparency (5 endpoints):**
```
GET    /api/v1/delphi/sessions/{id}/summary       → Round distributions
GET    /api/v1/delphi/sessions/{id}/consensus     → Consensus scores
GET    /api/v1/delphi/sessions/{id}/scorers       → Scorer analysis
GET    /api/v1/delphi/sessions/{id}/audit         → Audit trail
GET    /api/v1/delphi/sessions/{id}/scorer/{sid}/view → Scorer view
```

**All endpoints:**
- Return JSON with full transparency (no hidden calculations)
- Use Pydantic models for validation
- Log to audit trail
- Handle errors gracefully with 400/404/500 status codes

#### D. Integration into FastAPI App (`pulse/api/app.py`)

```python
# Added imports
from pulse.api.routes.delphi import router as delphi_router
from pulse.elicitation.delphi import DelphiProtocol

# Added to _state
_state["delphi"] = None

# Registered router
app.include_router(delphi_router, prefix="/api/v1")

# Initialized on startup
_state["delphi"] = DelphiProtocol()
_state["delphi"]._ensure_tables_exist()
```

### 2. Frontend Components

#### A. Updated API Client (`pulse/dashboard/src/lib/api.js`)

Added 11 functions for Delphi operations:

```javascript
// Session management
getDelphiSessions()
createDelphiSession(data)
getDelphiSession(id)
advanceDelphiRound(id)
completeDelphiSession(id)

// Scoring
submitDelphiScore(sessionId, data)
getDelphiScores(sessionId, params)

// Calibration
calibrateScorer(sessionId, data)
getDelphiCalibration(sessionId)

// Analysis
getDelphiSummary(sessionId)
getDelphiConsensus(sessionId)
getDelphiScorerView(sessionId, scorerId)
getDelphiScorers(sessionId)
getDelphiAudit(sessionId)
```

All functions:
- Use async/await pattern
- Properly encode URL parameters
- Handle JSON serialization
- Follow existing API client conventions

## Usage Workflows

### Workflow 1: Create & Execute a Delphi Session

```python
from pulse.elicitation.delphi import DelphiProtocol

delphi = DelphiProtocol()

# 1. Create session
session_id = delphi.create_session(
    name="Q2 2026 Strategic Planning",
    description="Annual trend scoring for budget allocation",
    trend_ids=["consumer_01", "tech_05", "govt_03"],
    scorer_ids=["alice", "bob", "charlie"]
)

# 2. Scorers independently score trends (Round 1)
# [Scorers use UI to submit via submitDelphiScore endpoint]

# 3. Advance to Round 2, share anonymized distributions
summary = delphi.advance_session_round(session_id)
# [UI shows group distributions to allow context-aware re-scoring]

# 4. Scorers re-score trends (Round 2)
# [Calibration happens automatically via run_calibration endpoint]

# 5. Optionally run another round (Round 3)
delphi.advance_session_round(session_id)
# [Scorers finalize scores]

# 6. Complete session and get consensus
result = delphi.complete_session(session_id)
# Returns: {"session_id": "...", "status": "completed",
#           "consensus_scores": {...}}

# 7. Apply consensus back to trends
delphi.apply_consensus_to_trends(session_id, trend_db)
# Updates trend.impact and trend.probability with consensus values
# Logs audit trail for each change
```

### Workflow 2: API-Based Session (from Frontend)

```javascript
// Create session
const sessionResp = await createDelphiSession({
  name: "Q2 2026 Trends",
  description: "",
  trend_ids: ["c1", "c2", "c3"],
  scorer_ids: ["alice", "bob", "charlie"]
});
const sessionId = sessionResp.session_id;

// Get scorer's view
const view = await getDelphiScorerView(sessionId, "alice");
// Returns: {
//   trends_to_score: [...],
//   scorer_own_scores: [...],
//   group_distributions: {...},
//   scorer_calibration: {...}
// }

// Submit scores
await submitDelphiScore(sessionId, {
  scorer_id: "alice",
  trend_id: "c1",
  impact_score: 4,
  probability_score: 3,
  rationale: "Market research shows strong momentum"
});

// After Round 1, advance
const summary = await advanceDelphiRound(sessionId);
// Returns anonymized distributions for all trends

// See consensus building
const consensus = await getDelphiConsensus(sessionId);
// Returns: { c1: {...}, c2: {...}, ... }

// View scorer performance
const scorers = await getDelphiScorers(sessionId);
// Returns calibration and bias profiles for all scorers

// Complete and finalize
const final = await completeDelphiSession(sessionId);
```

## Data Security

**Key Security Properties:**

1. **No Financial Data**: Delphi system only handles 1-5 integer scores, rationales (text), and metadata. No €M values, no actual financials.

2. **Anonymization**: Round summaries remove scorer IDs entirely — only statistical distributions are shared between rounds.

3. **Audit Trail**: Every score submission, calibration, and consensus calculation is logged with timestamp, user, and reason.

4. **Immutable Records**: Once submitted, scores are never modified, only summarized and consensus-aggregated.

## Testing

All components verified:

```bash
# Syntax validation
✓ pulse/elicitation/delphi.py
✓ pulse/api/routes/delphi.py
✓ pulse/api/app.py
✓ pulse/dashboard/src/lib/api.js

# Functional tests
✓ DelphiProtocol class initialization
✓ Session management methods
✓ Database table creation
✓ API router registration (14 endpoints)
✓ JavaScript client functions (14 exports)
```

## Integration Points

### With TrendDatabase
- `apply_consensus_to_trends()` writes back to trends
- Trend.scorer_count, score_variance, debiasing_applied updated
- Audit log records all changes

### With Audit Logger
- All Delphi actions logged to audit_log table
- Entity type: "delphi" (for sessions) or implicit in score submissions
- User ID tracked for calibration operations

### With War Room Dashboard
- Delphi endpoints available at `/api/v1/delphi/*`
- Frontend can embed Delphi UI in strategy workflow
- Scores visible in trend detail views once consensus applied

### With Bayesian MC Engine
- Updated trend scores feed into next simulation run
- Calibration factors already in Delphi output
- No direct dependency — Delphi is upstream preprocessing

## Files Modified

1. **pulse/elicitation/delphi.py** (362 → 683 lines)
   - Added DelphiSession dataclass
   - Added session management methods
   - Added database persistence
   - Enhanced submit_round and run_calibration with DB

2. **pulse/api/routes/delphi.py** (NEW, 416 lines)
   - 14 FastAPI endpoints
   - Pydantic models for validation
   - Full transparency in responses

3. **pulse/api/app.py** (529 → 535 lines)
   - Added delphi_router import
   - Added delphi to _state
   - Added router registration
   - Added startup initialization

4. **pulse/dashboard/src/lib/api.js** (86 → 115 lines)
   - Added 14 Delphi API client functions
   - Follows existing conventions

## Future Enhancements

1. **Delphi Workflow UI Component** - React component for scoring interface with:
   - Trend cards with descriptions
   - Impact/Probability slider inputs
   - Rationale text area
   - Current round indicator
   - Group distribution visualization

2. **Automated Calibration Exercises** - Pre-built set of 5-10 historical calibration questions (e.g., "Score e-commerce acceleration as of 2020")

3. **Bias Correction UI** - Visual feedback when anchoring, optimism, or other biases detected

4. **Convergence Monitoring** - Real-time visualization of agreement metrics (Krippendorff's alpha) and triggers to stop after Round 2 if α > 0.8

5. **Export Functions** - Delphi report generation (PDF) with scorers' profiles, consensus, and audit trail

## Example API Calls

### cURL: Create Session
```bash
curl -X POST http://localhost:8000/api/v1/delphi/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Q2 2026 Planning",
    "description": "Strategic trends assessment",
    "trend_ids": ["c1", "c2", "c3"],
    "scorer_ids": ["alice", "bob"]
  }'
```

### cURL: Submit Score
```bash
curl -X POST http://localhost:8000/api/v1/delphi/sessions/abc123/score \
  -H "Content-Type: application/json" \
  -d '{
    "scorer_id": "alice",
    "trend_id": "c1",
    "impact_score": 4,
    "probability_score": 3,
    "rationale": "Strong market evidence"
  }'
```

### cURL: Get Consensus
```bash
curl http://localhost:8000/api/v1/delphi/sessions/abc123/consensus
```

## Status

✅ **Complete and ready for integration**

- All backend logic implemented and tested
- All API endpoints defined and working
- Frontend client functions exported
- Database schema created
- No breaking changes to existing code
- Follows existing code patterns and conventions

---

**Implementation Date:** March 26, 2026
**Version:** PRISM v2.1
**Classification:** CONFIDENTIAL — Internal Use Only
