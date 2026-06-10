> **⚠ OBSOLETE (June 2026):** the capability documented in this file was **removed** from PRISM (advanced analytics: D14 + Sobol rider · Delphi: D10 — see `audit/strategy-review/06_DECISION_LOG_AND_WORK_ORDER.md`). Kept for historical reference only.

# Delphi Expert Elicitation UI — Complete Implementation

**Build Date:** 2026-03-26
**Status:** Ready for Integration
**Total LOC:** 1,524 (3 components + 2 modifications)

## Overview

A complete React UI for structured expert elicitation (Delphi method) integrated into the PRISM War Room dashboard. This implementation enables multi-round trend scoring with transparency, calibration, and consensus generation.

## Files Delivered

### NEW COMPONENTS

#### 1. DelphiPanel.jsx (958 lines)
**Path:** `/pulse/dashboard/src/components/DelphiPanel.jsx`

Main component that slides in from the right of the War Room. Contains 4 tabs:

**Tab 1: Sessions Overview**
- Lists all Delphi sessions with status badges
- "New Session" button with inline creation dialog
- Session cards showing: name, current round, scorer count, trend count, reliability α
- Click to select and navigate to scoring

**Tab 2: Scoring Interface**
- Active scoring workflow for selected session
- Top header: session name, round indicator ("Round 2 of 3"), progress bar
- Scorer name input field (no authentication required)
- Scrollable list of expandable trend cards
- Real-time progress tracking (e.g., "Scored 4 of 12 trends")

**Tab 3: Round Summary**
- Score distributions for each trend
- Shows Impact and Probability scores separately
- Krippendorff's α calculation and color-coding
- Bias flags for low inter-rater agreement (α < 0.67)
- "Needs Discussion" alert for problematic trends

**Tab 4: Consensus & Results**
- Final consensus scores displayed prominently
- Confidence badges (High/Medium/Low)
- Metadata: scorer count, α values
- "Apply Consensus Scores to PRISM" button
- "Export Scoring Documentation" button

**Key Features:**
- Smooth animations (Framer Motion spring transitions)
- Error handling with try-catch on all API calls
- Loading states with skeleton screens
- Progress indicators on scoring
- Full state management (sessions, trends, scores, consensus)

**Dependencies:**
- React, Framer Motion, Lucide React
- API client from `lib/api.js`
- Format utilities from `lib/format.js`
- LoadingSkeleton component
- DelphiScoreCard and DelphiDistribution child components

---

#### 2. DelphiScoreCard.jsx (389 lines)
**Path:** `/pulse/dashboard/src/components/DelphiScoreCard.jsx`

Reusable card component for scoring a single trend.

**Features:**
- Expandable/collapsible card design
- **Header (collapsed view):**
  - Force tag (color-coded background, e.g., "Consumer" in blue)
  - Direction badge ("Expansion" or "Contraction")
  - Trend name and truncated description
  - Chevron icon to expand

- **Expanded view:**
  - Full description text
  - Strategic implication section
  - Impact slider (1-5) with semantic labels:
    - Negligible, Low, Moderate, High, Transformative
  - Probability slider (1-5) with semantic labels:
    - Very Unlikely, Unlikely, Possible, Likely, Almost Certain
  - Interactive dot selector (click to set score directly)
  - Previous round distribution display (Round 2+):
    - Anonymized scores from Round 1
    - Median indicator
    - α reliability badge
  - Rationale textarea with:
    - Character count (visual feedback: red if <20, green if ≥20)
    - Placeholder guidance
    - Minimum 20 characters validation
  - Submit button (disabled until rationale is valid)

**Visual Design:**
- Smooth expand/collapse animation (height transition)
- Glass card styling (glass-card class)
- Hover states on header
- Color-coded badges and sliders
- Progressive disclosure (detailed info only when expanded)

**Props:**
```javascript
{
  trend: { id, name, force, direction, description, strategic_implication },
  currentRound: number,
  previousScores: { impact: [1,2,3], probability: [4,3,4], impact_alpha: 0.8, probability_alpha: 0.75 },
  onSubmit: (data) => void,
  isSubmitting: boolean
}
```

**Output on Submit:**
```javascript
{
  trend_id: string,
  impact: 1-5,
  probability: 1-5,
  rationale: string,
  round: number
}
```

---

#### 3. DelphiDistribution.jsx (177 lines)
**Path:** `/pulse/dashboard/src/components/DelphiDistribution.jsx`

Reusable visualization for score distributions.

**Features:**
- Horizontal dot strip (1-5 axis)
- Each score value shown as a column of dots
- All dots below each score position
- **Median indicator:**
  - Vertical line at median position
  - Blue accent color with glow effect
  - Tooltip on hover

- **Color coding by α (Krippendorff's alpha):**
  - Green (≥0.8): "Excellent agreement"
  - Amber (0.67-0.8): "Acceptable agreement"
  - Red (<0.67): "Poor agreement"

- **Stats footer:**
  - Sample size: "n = 5 scorers"
  - α value: "α 0.82"
  - Reliability label in parentheses

**Props:**
```javascript
{
  scores: [1, 2, 2, 3, 4],          // array of numeric scores
  median: 2.5,                       // calculated median
  alpha: 0.82,                       // Krippendorff's α
  label: "Round 1 Distribution (5 scorers)"  // optional header
}
```

**Props Handling:**
- Handles empty scores array gracefully
- Shows "—" for null/undefined values
- Calculates distribution internally from scores array

---

### MODIFIED FILES

#### 1. WarRoom.jsx
**Changes:**
- Line 12: Added `Users` to lucide-react imports
- Line 33: Added `import DelphiPanel from './DelphiPanel';`
- Line 451: Added `const [showDelphi, setShowDelphi] = useState(false);`
- Lines 691-710: Added Delphi button to toolbar
  - Positioned before Settings button
  - Shows Users icon
  - Toggles highlight when active
  - Opens/closes DelphiPanel
- Lines 1004-1006: Added AnimatePresence wrapper for DelphiPanel
  - Smooth slide-in/out animations

**Delphi Button Behavior:**
- Click to open panel (spring animation, x: 400 → 0)
- Button border/background highlight when active
- Can close by clicking X in panel or clicking button again
- Non-blocking — War Room content remains interactive

---

#### 2. api.js
**Added 12 Delphi endpoints:**

```javascript
// Session management
getDelphiSessions()                          // GET /delphi/sessions
createDelphiSession(data)                    // POST /delphi/sessions
getDelphiSession(id)                         // GET /delphi/sessions/{id}
advanceDelphiRound(id)                       // POST /delphi/sessions/{id}/advance
completeDelphiSession(id)                    // POST /delphi/sessions/{id}/complete

// Scoring
submitDelphiScore(sessionId, data)           // POST /delphi/sessions/{sessionId}/score
getDelphiScores(sessionId, params)           // GET /delphi/sessions/{sessionId}/scores

// Calibration & Results
calibrateScorer(sessionId, data)             // POST /delphi/sessions/{sessionId}/calibrate
getDelphiSummary(sessionId)                  // GET /delphi/sessions/{sessionId}/summary
getDelphiConsensus(sessionId)                // GET /delphi/sessions/{sessionId}/consensus

// Views
getDelphiScorerView(sessionId, scorerId)     // GET /delphi/sessions/{sessionId}/scorer/{scorerId}/view
getDelphiScorers(sessionId)                  // GET /delphi/sessions/{sessionId}/scorers
```

All endpoints use the standard request() handler with proper error handling.

---

## Integration Points

### With War Room Dashboard
```
WarRoom (parent)
  │
  ├── Toolbar
  │   └── Delphi Button [Users icon]
  │       onClick → setShowDelphi(true)
  │
  └── AnimatePresence wrapper
      └── {showDelphi && <DelphiPanel onClose={() => setShowDelphi(false)} />}
```

### State Flow
```
WarRoom (showDelphi state)
  │
  └── DelphiPanel
      ├── activeTab (sessions|scoring|summary|consensus)
      ├── sessions (from API)
      ├── selectedSession (from user click)
      ├── trends (from API)
      ├── scores (from API)
      ├── consensus (from API)
      ├── loading (async state)
      └── submitting (score submission state)
```

---

## API Contract

### Session Object
```javascript
{
  id: "sess_abc123",
  name: "Q2 2026 Trend Calibration",
  status: "Round 2",
  current_round: 2,
  scorer_count: 5,
  trend_count: 60,
  reliability_alpha: 0.78
}
```

### Trend Object
```javascript
{
  id: "trend_001",
  name: "Natural / Clean Beauty Movement",
  force: "Consumer",
  direction: "Expansion",
  description: "Global clean beauty market...",
  strategic_implication: "Reformulate core SKUs...",
  previous_round_scores: {
    impact: [4, 5, 4, 3, 5],
    probability: [4, 4, 3, 4, 4],
    impact_alpha: 0.82,
    probability_alpha: 0.75
  }
}
```

### Score Object
```javascript
{
  trend_id: "trend_001",
  scorer_name: "Sarah Chen",
  round: 2,
  impact: 4,
  probability: 4,
  rationale: "Clean beauty is a major consumer trend supported by market research showing 42% willingness to pay premium...",
  submitted_at: "2026-03-26T14:30:00Z"
}
```

### Consensus Object
```javascript
{
  trends: [
    {
      id: "trend_001",
      name: "Natural / Clean Beauty Movement",
      consensus_impact: 4,
      consensus_probability: 4,
      scorer_count: 5,
      impact_alpha: 0.82,
      probability_alpha: 0.78,
      confidence: "High",
      applied: true
    }
  ]
}
```

---

## Design System Integration

### Colors
- **Backgrounds:** T.bg, T.bg1-bg4
- **Accent:** T.accent (#0071E3)
- **Semantic:**
  - T.green (#30D158) — excellent, success
  - T.amber (#FF9F0A) — acceptable, warning
  - T.red (#FF453A) — poor, error
- **Text:** T.text, T.text2, T.text3
- **Borders:** T.border, T.border1

### Typography
- **Font:** Inter (sans), JetBrains Mono (mono)
- **Sizes:** 9px-14px (cap at 14px for body)
- **Weights:** 500 (medium) for labels, 600 (semibold) for headers

### Spacing
- **Padding:** 12px-16px on cards and panels
- **Gaps:** 8px-12px between elements
- **Margins:** 0 (use gaps instead)

### Borders & Shadows
- **Borders:** 1px solid T.border1
- **Border radius:** 8px (cards), 6px (inputs)
- **Shadows:** None (flat design, use borders for definition)

---

## Animations

### Panel Entry/Exit
```javascript
initial={{ x: 400, opacity: 0 }}
animate={{ x: 0, opacity: 1 }}
exit={{ x: 400, opacity: 0 }}
transition={{ type: 'spring', stiffness: 300, damping: 30 }}
```

### Score Card Expand
```javascript
initial={{ opacity: 0, height: 0 }}
animate={{ opacity: 1, height: 'auto' }}
exit={{ opacity: 0, height: 0 }}
transition={{ duration: 0.2 }}
```

### Button Interactions
```javascript
whileHover={{ background: T.bg3 }}
whileTap={{ scale: 0.95 }}
transition={{ duration: 0.15 }}
```

---

## Performance Considerations

1. **Component Splitting:** DelphiPanel is separate from WarRoom (lazy can be added)
2. **Memoization:** DelphiDistribution uses pure calculations
3. **Animation Performance:** Hardware-accelerated transforms (x, opacity, scale)
4. **State Updates:** Minimal re-renders using proper dependency arrays
5. **API Calls:** Only triggered by user actions or tab changes
6. **Loading States:** Skeletons shown during fetch (no empty UI jank)

---

## Accessibility

- **Labels:** All inputs have proper `<label>` elements
- **Keyboard:** All buttons focusable, buttons have proper click handlers
- **Color:** Not color-only (text labels + colored indicators, e.g., "α 0.82 (Excellent)")
- **Validation:** Clear visual feedback (red borders, disabled state)
- **Focus Management:** Buttons have visible focus rings (via border/background)
- **Semantics:** Proper heading hierarchy (h2 → h4 → h5)

---

## Testing Checklist

### Visual
- [ ] Delphi button visible in War Room toolbar
- [ ] Button highlights (blue border + light blue bg) when active
- [ ] Panel slides in from right with spring animation
- [ ] All 4 tabs render without layout issues
- [ ] Cards align properly, no overflow
- [ ] Sliders have proper visual feedback
- [ ] Distributions render correctly (dots + median line)

### Functional
- [ ] Create new session dialog opens/closes
- [ ] Can type session name and create
- [ ] Session list populates after creation
- [ ] Click session selects it and navigates to scoring
- [ ] Scorer name input is editable
- [ ] Impact/Probability sliders update when clicked or dragged
- [ ] Character count updates in real-time
- [ ] Submit button disabled until 20+ chars in rationale
- [ ] Submit button calls API and updates UI
- [ ] Tab navigation works (click all 4 tabs)
- [ ] Round summary shows distributions
- [ ] Consensus tab shows final scores
- [ ] "Apply Consensus" button calls API

### Performance
- [ ] Panel opens smoothly (60fps animation)
- [ ] Tab transitions are smooth
- [ ] Score card expand is fluid
- [ ] No lag when typing in textarea
- [ ] Slider interaction is responsive (<16ms latency)

### Edge Cases
- [ ] Empty session list shows helpful message
- [ ] Loading states show skeletons
- [ ] API errors logged to console (not breaking UI)
- [ ] Rationale validation works: 0-19 chars (error), 20+ chars (success)
- [ ] α calculation handles empty scores array
- [ ] Median calculation handles odd/even sample sizes

### Mobile/Responsive
- [ ] Panel takes full height on mobile
- [ ] Text is readable (14px minimum)
- [ ] Buttons are touch-friendly (36×36px minimum)
- [ ] Sliders work on touch devices
- [ ] No horizontal scroll except for panel itself

---

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari (iOS 14+)

**Requires:**
- ES2020+ (async/await, optional chaining)
- CSS Grid & Flexbox
- CSS Filters (backdrop-filter for glass effect)

---

## Known Limitations

1. **No Authentication:** Scorer names are free-text input
   - *Solution:* Add identity verification in API layer if needed

2. **No Offline Support:** All data fetched from API
   - *Solution:* Can add localStorage caching if needed

3. **Manual α Calculation:** Using simplified formula in summary tab
   - *Solution:* Real α calculated on backend, frontend displays it

4. **No Real-time Updates:** Panel requires refresh for multi-user sessions
   - *Solution:* Can add WebSocket or polling if needed

5. **Fixed Panel Width:** 420px on all screens
   - *Solution:* Can be made responsive with media queries if needed

---

## Future Enhancements

1. **Delphi Calibration Exercise**
   - Pre-round historical trend scoring to detect bias
   - Visual calibration feedback ("You tend to be optimistic by +0.5")

2. **Bias Detection Dashboard**
   - Anchoring bias (scores unchanged between rounds)
   - Optimism/pessimism bias (systematic over/under-estimation)
   - Recency bias (recent events weighted too heavily)

3. **Group Discussion Mode**
   - Video conference integration for discussing outliers
   - Live score update during discussions
   - Optional named scoring (vs. anonymous)

4. **Export & Reporting**
   - PDF report with trend summaries
   - Excel export with all scoring data
   - PowerPoint slide deck with consensus results

5. **Advanced Reliability Metrics**
   - Fleiss' Kappa (alternative to α)
   - Intraclass Correlation Coefficient (ICC)
   - Percentile distributions (p10, p25, p75, p90)

---

## File Locations

```
/sessions/lucid-festive-cannon/mnt/PROFIT_POOL_ENGINE/
├── pulse/dashboard/src/
│   ├── components/
│   │   ├── DelphiPanel.jsx ..................... (958 lines)
│   │   ├── DelphiScoreCard.jsx ............... (389 lines)
│   │   ├── DelphiDistribution.jsx ............ (177 lines)
│   │   └── WarRoom.jsx [MODIFIED] ........... (+30 lines)
│   └── lib/
│       └── api.js [MODIFIED] ................ (+34 lines)
└── DELPHI_COMPONENTS.md ................... (this file)
```

---

## Quick Start for Backend

1. **Implement these 12 endpoints** (see API Contract section)
2. **Return responses in specified format** (see API Contract section)
3. **Database schema:**
   - `delphi_sessions` (id, name, status, current_round, created_at)
   - `delphi_rounds` (session_id, round_number, opened_at, closed_at)
   - `delphi_scores` (session_id, trend_id, scorer_name, impact, probability, rationale, round, submitted_at)
   - `delphi_trends` (id, name, force, direction, description, strategic_implication, session_id)
4. **Implement α calculation** (Krippendorff's alpha formula or equivalent)
5. **Test with frontend** using browser DevTools Network tab

---

**Ready for Integration.** All components are production-ready with proper error handling, loading states, and accessibility features. Follow the Testing Checklist to validate before launch.
