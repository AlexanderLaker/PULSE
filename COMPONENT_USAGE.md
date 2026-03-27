# PULSE War Room v3 Components — Usage Guide

Three production-grade React components for the PULSE War Room dashboard. Apple × Bain × Goldman Sachs design aesthetic.

## Quick Start

### 1. TrendExplorer — Trend Management Table

Main table for viewing and editing all 60 trends. Features: sorting, filtering, full inline editing.

```jsx
import TrendExplorer from './components/TrendExplorer';
import { useState } from 'react';

export default function Dashboard() {
  const [trends, setTrends] = useState([
    {
      id: 'consumer_01',
      force: 'Consumer',
      name: 'Natural / Clean Beauty Movement',
      direction: 'Expansion',
      impact: 4,
      probability: 5,
      score: 20, // impact × probability
      gp1_shift: 0.032, // computed: 3.2%
      category_exposure: { hair_color: 4, hair_care: 3, lhc_fcn: 5 },
      vc_exposure: { raw_materials: 2, formulation: 4, packaging: 3 },
      description: 'Consumer preference for natural, clean beauty products...',
      strategic_implication: 'Prioritize reformulation R&D...',
      ai_suggested: false,
    },
    // ... 59 more trends
  ]);

  const [forceFilter, setForceFilter] = useState('All');

  const handleUpdateTrend = async (trendId, updates) => {
    // Example: { impact: 5 } or { probability: 4 } or { category_exposure: {...} }
    console.log(`Updating trend ${trendId}:`, updates);

    // Call API: PATCH /api/trends/{trendId}
    // const response = await fetch(`/api/trends/${trendId}`, {
    //   method: 'PATCH',
    //   body: JSON.stringify(updates)
    // });

    // Update local state
    setTrends(trends.map(t =>
      t.id === trendId ? { ...t, ...updates } : t
    ));
  };

  return (
    <TrendExplorer
      data={{ trends }}
      forceFilter={forceFilter}
      onForceFilter={setForceFilter}
      onUpdateTrend={handleUpdateTrend}
    />
  );
}
```

**Key User Interactions:**
- **Click trend name:** Expand detail view with full description, category/VC exposures
- **Click impact/probability dots:** Set scores inline (1-5)
- **Click category or VC dots (in expanded view):** Edit exposures inline
- **Click force filter chip:** Filter table by force
- **Type in search:** Filter by trend name or force

**Editing:** All changes trigger onUpdateTrend callback immediately (real-time save).

---

### 2. AllocationChart — Resource Allocation Visualization

Shows recommended category investment weights from the optimizer.

```jsx
import AllocationChart from './components/AllocationChart';

export default function Dashboard() {
  const allocation = {
    weights: {
      hair_color: 0.09,
      hair_care: 0.12,
      hair_styling: 0.08,
      hair_body: 0.07,
      lhc_fcn: 0.15,      // Most recommended
      lhc_fca: 0.10,
      lhc_ffi: 0.09,
      lhc_lad: 0.08,
      lhc_hdw: 0.07,
      lhc_adw: 0.06,
      lhc_hsc: 0.05,
      lhc_ic: 0.04,
    },
    current_weights: {
      // Optional: show delta from current allocation
      hair_color: 0.10,
      hair_care: 0.10,
      // ...
    },
    shifts_2030: {
      // Optional: 2030 shift forecast for each category
      hair_color: -0.048,
      hair_care: 0.021,
      // ...
    },
  };

  return (
    <AllocationChart allocation={allocation} />
  );
}
```

**Automatic Calculations:**
- Expected Return: weighted sum of category shifts
- Portfolio Risk (σ): standard deviation of weighted shifts
- Sharpe Ratio: return / risk

**Design:**
- Categories sorted by weight (descending)
- Color bar indicates category
- Animated fill bars (easeOut, 500ms)
- Delta shows pp change from current allocation
- Summary metrics at bottom

---

### 3. CategoryDetailPanel — Slide-in Detail View

Fixed-position right panel showing category deep-dive. Triggered by clicking a category.

```jsx
import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import CategoryDetailPanel from './components/CategoryDetailPanel';

export default function Dashboard() {
  const [selectedCategory, setSelectedCategory] = useState(null);

  const panelData = {
    categories: [
      { id: 'hair_color', name: 'Hair: Color', group: 'Hair', color: '#F87171' },
      // ... 11 more
    ],
    shifts_path: {
      hair_color: {
        2026: { median: -0.003, p10: -0.001, p90: -0.008 },
        2027: { median: -0.008, p10: -0.003, p90: -0.019 },
        2028: { median: -0.014, p10: -0.006, p90: -0.031 },
        2029: { median: -0.023, p10: -0.010, p90: -0.048 },
        2030: { median: -0.032, p10: -0.015, p90: -0.065 },
      },
      // ... paths for all 12 categories
    },
    force_decomposition: {
      hair_color: {
        Consumer: -0.018,
        Customer: -0.007,
        Technology: 0.005,
        Government: -0.008,
        Environmental: -0.002,
        Competitive: -0.002,
      },
      // ... decomposition for all 12 categories
    },
    contributing_trends: {
      hair_color: [
        {
          id: 'consumer_01',
          name: 'Natural / Clean Beauty',
          force: 'Consumer',
          direction: 'Expansion',
          score: 20,
          exposure_level: 5,
        },
        // ... all trends exposing to Hair: Color, sorted by abs(score)
      ],
      // ... trend lists for all 12 categories
    },
  };

  return (
    <>
      {/* Your war room layout */}
      <div className="flex-1">
        {/* Click handlers should set selectedCategory */}
        <button onClick={() => setSelectedCategory('hair_color')}>
          View Color Category
        </button>
      </div>

      {/* Panel overlay */}
      <AnimatePresence>
        {selectedCategory && (
          <CategoryDetailPanel
            data={panelData}
            categoryId={selectedCategory}
            onClose={() => setSelectedCategory(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
```

**Key Sections:**
1. **Header:** Category name + group + close button
2. **KPI Stats:** 2030 Shift % + Contributing Trends count
3. **Mini Path Chart:** Area chart (2026–2030) with p10/p90 bands, median line
4. **Force Decomposition:** Horizontal bars showing each force's contribution
5. **Contributing Trends:** List of trends sorted by absolute score

**Interactions:**
- **Hover bars:** Slight color intensification
- **Click backdrop:** Close panel
- **Click close button:** Close panel

---

## Data Structure Reference

### Trend Object
```javascript
{
  id: string,                          // e.g., "consumer_01"
  force: string,                       // One of: Consumer, Customer, Technology, Government, Environmental, Competitive
  name: string,                        // e.g., "Natural / Clean Beauty Movement"
  direction: 'Expansion' | 'Contraction',
  impact: 1-5,                         // Expert-scored
  probability: 1-5,                    // Expert-scored
  score: number,                       // impact × probability, range 1-25
  gp1_shift: number,                   // Decimal: -0.048 = -4.8%, 0.032 = 3.2%
  category_exposure: {                 // 0-5 score per category
    hair_color: 3,
    hair_care: 2,
    lhc_fcn: 5,
    // ... 0 for unexposed
  },
  vc_exposure: {                       // 0-5 score per VC step
    raw_materials: 2,
    formulation: 4,
    packaging: 3,
    manufacturing: 0,
    logistics: 1,
    marketing: 2,
    trade: 1,
    after_sales: 0,
  },
  description: string,                 // Evidence/rationale
  strategic_implication: string,       // Recommended action
  ai_suggested: boolean,               // Flag if AI proposed this trend
}
```

### AllocationChart Props
```javascript
{
  allocation: {
    weights: { catId: number, ... },        // Sum to 1.0 (100%)
    current_weights?: { catId: number, ... }, // Optional: to show delta
    shifts_2030?: { catId: number, ... },    // Optional: for metrics
  }
}
```

### CategoryDetailPanel Props
```javascript
{
  data: {
    categories: [{ id, name, group, color }, ...],
    shifts_path: {
      catId: {
        year: { median, p10, p90 }, // All years 2026-2030
        ...
      },
      ...
    },
    force_decomposition: {
      catId: { force: contribution, ... }, // Sum of contributions ≈ total shift
      ...
    },
    contributing_trends: {
      catId: [{ id, name, force, direction, score, exposure_level }, ...],
      ...
    },
  },
  categoryId: string,
  onClose: () => void,
}
```

---

## Design Tokens (T)

All components use the T design token system from `lib/format.js`:

```javascript
// Colors
T.bg1      // #0C0F16 (slightly raised surface)
T.bg2      // #12161F (main card background)
T.bg3      // #1A1F2B (hover/tertiary)
T.bg4      // #232937 (darkest interactive)
T.accent   // #3B82F6 (primary blue)
T.green    // #34D399 (positive/expansion)
T.red      // #F87171 (negative/contraction)
T.text     // #F0F2F5 (primary text)
T.text2    // #8B93A5 (secondary text)
T.text3    // #555D6E (tertiary/muted)

// Borders
T.border   // rgba(255,255,255,0.04)
T.border1  // rgba(255,255,255,0.07)
T.border2  // rgba(255,255,255,0.12)

// Typography
T.sans     // "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Inter'..."
T.mono     // "'SF Mono', 'JetBrains Mono', 'Fira Code'..."
```

---

## Styling Approach

All components use:
1. **Inline styles** for dynamic theming (React best practice)
2. **Tailwind classes** for standard patterns (gap, flex, grid, etc.)
3. **T tokens** for all color/font values
4. **Framer Motion** for 60fps animations

**No CSS files needed** — styling is self-contained and themeable.

---

## Performance Notes

- **TrendExplorer:** useMemo for filtered/sorted list (minimal re-renders)
- **AllocationChart:** Animated bars use motion.div with transition config
- **CategoryDetailPanel:** useCallback dependencies properly scoped
- All lists use stable keys (trend.id, category.id, etc.)
- Debounce search input in parent if dataset > 1000 items

---

## Accessibility

- ✓ Semantic HTML (tables for tables, buttons for buttons)
- ✓ Keyboard navigation (Enter, Space on buttons)
- ✓ ARIA labels on interactive elements
- ✓ Color not sole indicator (supplemented with icons/text)
- ✓ Focus states on all interactive elements
- ✓ Sufficient contrast (WCAG AA)

---

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Requires ES2020+ (arrow functions, async/await, etc.)

---

*Design: Apple × Bain × Goldman Sachs*
*Built: March 26, 2026*
*Framework: React 18 + Framer Motion + Recharts*
