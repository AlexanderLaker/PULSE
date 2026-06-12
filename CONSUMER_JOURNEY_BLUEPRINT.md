# Consumer Journey Integration Blueprint

## PRISM v2.4 — Implementation Architecture

**Status:** Blueprint (no code changes yet)
**Author:** Strategy × Technology Partnership
**Date:** March 30, 2026

---

## Context

The internal FMCG team produced a "Value Chain Overview" that maps the full laundry consumer journey across 13 touchpoints — from Sorting through In Between Washes. This is fundamentally different from PRISM's current value chain exposure (Raw Materials → Consumer), which is a supply-side lens.

This blueprint defines how to integrate the demand-side consumer journey into PRISM across two workstreams:

1. **Journey Stage Exposure** — a new scoring dimension on each trend
2. **Extended Competitive Model** — journey-stage-specific competitor sets

Each workstream maps to specific files, database tables, API endpoints, and dashboard components in the existing codebase.

---

## Workstream 1: Consumer Journey Stage Exposure

### What It Is

A third exposure dimension on every trend — alongside `category_exposure` (12 categories) and `vc_exposure` (8 supply-side steps). Each trend gets scored 0-5 against each of the 13 consumer journey stages.

### Why It Matters

A trend like "smart home adoption" currently scores high on Technology force and hits categories like LHC: LAD and LHC: ADW. But it doesn't tell you *where in the consumer's life* the impact lands. With journey stage exposure, we can see it hits stages 5-6 (Select Wash Settings, Washing Cycle) — which means the profit is migrating toward machine manufacturers and app ecosystems, not toward detergent brands. That's a fundamentally different strategic signal.

### Taxonomy (from the team's image)

```python
# pulse/config.py — new constant

JOURNEY_STAGES = [
    "Sorting",              # Smart sorting apps, garment care labels, QR scanning
    "Pre-Treating",         # Stain removers, odor neutralizers, fabric protectors
    "Loading",              # Drum accessories, microfibre filters, load sensors
    "Add Products",         # Detergents, finishers, additives, home-made detergents
    "Select Wash Settings", # Smart home apps, auto-dosing, program advisors
    "Washing Cycle",        # Machines (standard/smart/auto-dose), water softening, subscriptions
    "Unloading",            # Anti-mustiness, smart reminders, anti-wrinkle spray
    "Drying",               # Tumble/heat pump dryers, drying racks, dryer sheets, dehumidifiers
    "Ironing",              # Irons, steamers, ironing boards, anti-wrinkle sprays, wrinkle-release tech
    "Folding & Storing",    # Storage systems, anti-moth, fabric perfumes, smart wardrobe apps
    "Taking Out",           # On-the-go refresh sprays, deodorizing mists, fragrance boosters
    "Wearing",              # Anti-stain tech, garment protection, textile softeners, repair kits
    "Between Washes",       # Fabric refresh sprays, garment steamers, UV sanitizers, dry shampoo for clothes
]
```

Note: The team's image shows this for Laundry only. Hair categories would need a parallel journey (Purchase → Open → Wet Hair → Apply → Wait → Rinse → Dry → Style → Maintain). For now, we implement Laundry first and add Hair in a subsequent iteration.

### Data Model Changes

```python
# pulse/ingestion/models.py — add to Trend dataclass

journey_exposure: dict = field(default_factory=dict)  # {stage: 0-5}
```

This follows the exact same pattern as the existing `category_exposure`, `vc_exposure`, and `regional_exposure` fields. The Trend dataclass already supports arbitrary dict-based exposure dimensions — this is just a fourth one.

### Database Schema Addition

```sql
-- New table, mirrors trend_category_exposure and trend_vc_exposure

CREATE TABLE trend_journey_exposure (
    trend_id TEXT REFERENCES trends(id),
    journey_stage TEXT NOT NULL,
    exposure_score INTEGER CHECK(exposure_score BETWEEN 0 AND 5),
    PRIMARY KEY (trend_id, journey_stage)
);
```

This requires additions to `pulse/database.py`:
- Add `CREATE TABLE` in `init_db()`
- Add `save_trend_journey_exposure()` and `load_trend_journey_exposure()` methods
- Extend `save_trend()` and `load_trends()` to include journey exposure
- Follow the exact pattern already used for `trend_vc_exposure` and `trend_regional_exposure`

### Seed Data

Each of the 60 existing trends in `pulse/seed_trends.py` needs a `journey_exposure` dict. Example for a few representative trends:

```python
# consumer_01: Natural / Clean Beauty Movement
journey_exposure={
    "Add Products": 5,       # Direct hit — clean ingredients in detergents
    "Pre-Treating": 3,       # Natural pre-treatment alternatives
    "Between Washes": 3,     # Natural fabric refresh products
    "Wearing": 2,            # Garment protection with clean chemistry
}

# technology_03: Smart Home / IoT Integration
journey_exposure={
    "Select Wash Settings": 5,  # Auto-dosing, smart program selection
    "Washing Cycle": 4,         # Connected machines
    "Sorting": 3,               # AI fabric recognition
    "Loading": 3,               # Load sensors
    "Drying": 2,                # Smart dryer programs
    "Folding & Storing": 2,     # Smart wardrobe management
}

# government_02: EU Chemical Regulation (REACH)
journey_exposure={
    "Add Products": 5,       # Direct reformulation impact
    "Pre-Treating": 4,       # Chemical restrictions on stain removers
    "Between Washes": 2,     # Fragrance regulation on refresh sprays
}
```

The key insight: most Government and Consumer trends concentrate on stages 3-4 (Add Products, Pre-Treating) — Henkel's current stronghold. Technology trends spread across stages 1-6 and 10-13, which is where profit is migrating *away* from product brands.

### Simulation Engine Integration

The Bayesian MC engine (`pulse/simulation/bayesian_mc.py`) currently computes:
- `shift_matrix`: category × year × percentile
- `vc_decomposition`: category × vc_step

Add a parallel decomposition:

```python
# New output key in the run() return dict

"journey_decomposition": {
    "LHC: FCN": {
        "Add Products": -0.018,      # Most shift impact here
        "Select Wash Settings": -0.005,
        "Between Washes": -0.003,
        # ... other stages
    }
}
```

**Computation logic:** For each category, the journey decomposition shows how much of the total shift is attributable to each journey stage. This uses the same weighted-average approach as `vc_decomposition`:

```
journey_contribution[stage] = Σ_trends (trend.normalized_score × trend.journey_exposure[stage] / max_exposure)
```

Normalized so that `Σ journey_contribution = total_category_shift`.

### API Endpoints

```
GET  /trends/{id}                   → Include journey_exposure in response
PUT  /trends/{id}                   → Accept journey_exposure updates
POST /simulate                      → Include journey_decomposition in results
GET  /config/journey-stages         → Return JOURNEY_STAGES taxonomy
```

### Dashboard Integration

**Primary: Heatmap toggle.** The existing `ForceShiftMatrix` component (force × category heatmap) gets a toggle button:

```
[Forces × Categories]  |  [Forces × Journey Stages]  |  [Categories × Journey Stages]
```

The third view is the most novel: it shows which journey stages are most impacted for each category. This is where the strategic insight lives — "LHC: FCN is contracting, and the contraction is concentrated in Add Products and Pre-Treating stages."

**Secondary: Journey decomposition in CategoryDetailPanel.** When you click a category in the heatmap, the slide-in panel already shows force decomposition. Add a second tab showing journey stage decomposition — a horizontal bar chart showing which stages drive the shift.

**Tertiary: Journey stage filter in TrendExplorer.** The TrendExplorer component already filters by force, category, and region. Add a journey stage dropdown filter: "Show me all trends that score ≥3 on Between Washes."

### Effort Estimate

| Component | Files Changed | New Files | Complexity |
|-----------|--------------|-----------|------------|
| Config taxonomy | `config.py` | — | Trivial |
| Trend model | `models.py` | — | Trivial |
| Database | `database.py` | — | Low (copy vc_exposure pattern) |
| Seed data | `seed_trends.py` | — | Medium (60 trends × 13 stages) |
| MC engine | `bayesian_mc.py` | — | Low (copy vc_decomposition) |
| API | `app.py`, routes | — | Low |
| Dashboard heatmap toggle | `ForceShiftMatrix.tsx` | — | Medium |
| Dashboard detail panel | `CategoryDetailPanel.tsx` | — | Low |
| Dashboard trend filter | `TrendExplorer.tsx` | — | Low |

**Total: ~3-4 days of development.** The architecture is designed to be additive — no existing logic changes, just a new parallel dimension.

---

## Workstream 2: Extended Competitive Model

### What It Is

An extension of the existing `CompetitiveResponseModel` in `pulse/game_theory/competitive.py` that adds journey-stage-specific competitor sets. The current model assumes the same 6 FMCG competitors (P&G, Unilever, Reckitt, L'Oréal, Kao, Church & Dwight) across every category. The consumer journey map reveals that the real competitive threat at stages like Drying, Ironing, Folding, and Between Washes comes from entirely different player types.

### Why It Matters

When PRISM models "competitive response to Green Squeeze scenario," it asks: "How will P&G and Unilever react?" But at journey stage "Select Wash Settings," the relevant competitors are Samsung, LG, and Bosch (smart machines). At "Between Washes," it's D2C startups like Febreze (P&G), The Laundress, and new entrants like fabric refresh subscription services. The competitive equilibrium is different when your opponent is a tech company vs. another FMCG brand.

### New Competitor Archetypes

The current model has 6 archetypes: `premium_defender`, `sustainability_leader`, `hygiene_specialist`, `beauty_innovator`, `technology_leader`, `value_optimizer`.

Add three new archetypes for non-FMCG competitors:

```python
# New archetypes for journey-stage competitors

"appliance_manufacturer"    # Samsung, LG, Bosch, Dyson, Miele
"tech_platform"             # Google Home, Amazon Alexa, Apple Home
"dtc_insurgent"             # The Laundress, Blueland, subscription services
```

These archetypes have fundamentally different response patterns:
- **Appliance manufacturers** respond to FMCG trends by embedding chemistry into hardware (auto-dosing, steam refresh) — pulling profit from the product into the machine
- **Tech platforms** respond by aggregating consumer data and owning the decision point (which detergent gets auto-ordered) — pulling profit into the platform
- **D2C insurgents** respond by fragmenting the journey into micro-occasions (refresh sprays, garment wipes) — pulling profit from big wash cycles into between-wash moments

### Data Model Extension

```python
# pulse/ingestion/models.py — extend CompetitorProfile

@dataclass
class CompetitorProfile:
    id: str
    name: str
    archetype: str = "balanced"
    hair_exposure: float = 0.5
    lhc_exposure: float = 0.5
    response_speed: str = "medium"
    typical_responses: dict = field(default_factory=dict)
    category_exposure: dict = field(default_factory=dict)
    # NEW: journey stage exposure
    journey_stage_exposure: dict = field(default_factory=dict)  # {stage: 0-1}
    # NEW: competitor class
    competitor_class: str = "fmcg"  # "fmcg" | "appliance" | "tech" | "dtc" | "service"
```

### New Competitor Profiles

```python
# pulse/game_theory/competitive.py — add to DEFAULT_COMPETITORS

"samsung_lg": CompetitorProfile(
    id="samsung_lg", name="Samsung / LG (Appliances)",
    archetype="appliance_manufacturer",
    competitor_class="appliance",
    hair_exposure=0.0, lhc_exposure=0.4,
    response_speed="medium",
    typical_responses={
        "pool_contraction": "embed_chemistry_in_hardware",
        "tech_disruption": "lead_smart_appliance",
        "regulation": "comply_via_engineering",
        "green_squeeze": "energy_efficiency_push",
    },
    category_exposure={
        "LHC: LAD": 0.3, "LHC: FCN": 0.2, "LHC: ADW": 0.3,
    },
    journey_stage_exposure={
        "Select Wash Settings": 0.9,
        "Washing Cycle": 0.95,
        "Drying": 0.8,
        "Ironing": 0.6,
        "Loading": 0.5,
        "Sorting": 0.3,
    },
),

"smart_home_platforms": CompetitorProfile(
    id="smart_home_platforms", name="Smart Home Ecosystems",
    archetype="tech_platform",
    competitor_class="tech",
    hair_exposure=0.0, lhc_exposure=0.2,
    response_speed="fast",
    typical_responses={
        "pool_contraction": "aggregate_consumer_data",
        "tech_disruption": "own_decision_point",
        "regulation": "data_privacy_adaptation",
        "green_squeeze": "sustainability_scoring",
    },
    category_exposure={
        "LHC: LAD": 0.2, "LHC: ADW": 0.2,
    },
    journey_stage_exposure={
        "Select Wash Settings": 0.8,
        "Sorting": 0.5,
        "Folding & Storing": 0.4,
    },
),

"dtc_fabric_care": CompetitorProfile(
    id="dtc_fabric_care", name="D2C Fabric Care Insurgents",
    archetype="dtc_insurgent",
    competitor_class="dtc",
    hair_exposure=0.0, lhc_exposure=0.3,
    response_speed="fast",
    typical_responses={
        "pool_contraction": "fragment_occasions",
        "tech_disruption": "subscription_model",
        "regulation": "clean_chemistry_positioning",
        "green_squeeze": "refill_circular_model",
        "private_label_growth": "premium_niche_defense",
    },
    category_exposure={
        "LHC: FCN": 0.3, "LHC: FCA": 0.2,
    },
    journey_stage_exposure={
        "Between Washes": 0.9,
        "Taking Out": 0.8,
        "Wearing": 0.7,
        "Pre-Treating": 0.5,
        "Folding & Storing": 0.4,
    },
),

"laundry_services": CompetitorProfile(
    id="laundry_services", name="Laundry Service Platforms",
    archetype="dtc_insurgent",
    competitor_class="service",
    hair_exposure=0.0, lhc_exposure=0.3,
    response_speed="medium",
    typical_responses={
        "pool_contraction": "subscription_growth",
        "tech_disruption": "platform_aggregation",
        "regulation": "professional_compliance",
        "green_squeeze": "bulk_efficiency_positioning",
    },
    category_exposure={
        "LHC: LAD": 0.4, "LHC: FCN": 0.3, "LHC: FCA": 0.2,
    },
    journey_stage_exposure={
        "Add Products": 0.6,
        "Washing Cycle": 0.7,
        "Drying": 0.5,
        "Ironing": 0.6,
    },
),
```

### New Response Pool Effects

```python
# Additional response types for non-FMCG competitors

RESPONSE_POOL_EFFECTS.update({
    "embed_chemistry_in_hardware": -0.008,    # Pulls profit from product to machine
    "lead_smart_appliance": -0.006,           # Auto-dosing reduces product margin
    "comply_via_engineering": -0.002,          # Engineering fixes bypass chemistry
    "energy_efficiency_push": -0.004,          # Cold wash = less product needed
    "aggregate_consumer_data": -0.005,         # Platform owns the consumer relationship
    "own_decision_point": -0.010,             # Auto-reorder = brand commoditization
    "data_privacy_adaptation": 0.001,
    "sustainability_scoring": -0.003,          # Platform scores products, not brands
    "fragment_occasions": -0.007,              # Micro-occasions cannibalize big wash
    "subscription_model": -0.006,              # Lock-in reduces switching
    "clean_chemistry_positioning": -0.003,
    "refill_circular_model": -0.004,           # Refill = lower margin per use
    "platform_aggregation": -0.008,            # Service replaces home laundry
    "subscription_growth": -0.006,
    "professional_compliance": 0.001,
    "bulk_efficiency_positioning": -0.005,
})
```

Note the pattern: non-FMCG competitor responses are almost universally negative for the product profit pool. This is the critical insight — the traditional FMCG competitive model (where P&G premiumizing *grows* the pool) doesn't apply when the competitor is pulling profit into hardware, platforms, or services.

### Modified Competitive Equilibrium

The key change to `competitive_equilibrium()` is **journey-stage-weighted competitor relevance**. Currently, competitors are weighted by `category_exposure` only. With journey stages:

```python
def estimate_competitive_response(self, scenario_trigger, category, journey_context=None):
    """
    Extended: if journey_context is provided, weight competitors
    by their journey_stage_exposure rather than just category_exposure.
    """
    total_effect = 0.0
    total_weight = 0.0

    for comp_id, comp in self.competitors.items():
        if journey_context:
            # Weight by average journey stage exposure across active stages
            stage_exposures = [
                comp.journey_stage_exposure.get(stage, 0.0)
                for stage in journey_context
            ]
            exposure = sum(stage_exposures) / len(stage_exposures) if stage_exposures else 0.0
        else:
            exposure = comp.category_exposure.get(category, 0.0)

        if exposure < 0.1:
            continue

        response = comp.typical_responses.get(scenario_trigger, "defend_core_categories")
        pool_effect = RESPONSE_POOL_EFFECTS.get(response, 0.0)
        speed_factor = {"fast": 1.0, "medium": 0.7, "slow": 0.4}
        weight = exposure * speed_factor.get(comp.response_speed, 0.7)

        total_effect += pool_effect * weight
        total_weight += weight

    if total_weight > 0:
        return total_effect / total_weight
    return 0.0
```

The `journey_context` parameter is optional — when omitted, the model behaves exactly as before (backward compatible). When provided, it shifts competitor weighting from "who plays in this category" to "who plays at these journey stages."

### API Changes

```
POST /competitive/response
  Body: {
    scenario_trigger: "tech_disruption",
    category: "LHC: FCN",
    journey_stages: ["Select Wash Settings", "Washing Cycle"]  // NEW optional
  }

POST /competitive/equilibrium
  Body: {
    base_shifts: {...},
    force_shocks: {...},
    journey_context: ["Between Washes", "Wearing"]  // NEW optional
  }
```

### Dashboard Integration

**Competitive panel enhancement.** When the user clicks a journey stage (from Workstream 1's heatmap toggle), the contextual panel shows:

```
┌──────────────────────────────────────────────────────────┐
│  COMPETITIVE LANDSCAPE: Between Washes                    │
│                                                          │
│  ┌─── FMCG Competitors ─────────────────────────────┐   │
│  │  P&G (Febreze): 0.7 exposure | premiumize_further│   │
│  │  Reckitt (Air Wick): 0.3 | brand_equity           │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─── Non-FMCG Competitors (journey-specific) ──────┐   │
│  │  D2C Insurgents: 0.9 exposure | fragment_occasions│   │
│  │  ↳ Pool effect: -0.7% (pulls profit to micro-     │   │
│  │    occasions)                                      │   │
│  │  Smart Home: 0.4 | sustainability_scoring         │   │
│  │  ↳ Pool effect: -0.3% (platform commoditizes)     │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  NET COMPETITIVE ADJUSTMENT: -0.6%                       │
│  (vs. -0.2% using FMCG-only model)                     │
│                                                          │
│  ⚠ Non-FMCG competitors account for 67% of the          │
│    competitive pressure at this journey stage            │
└──────────────────────────────────────────────────────────┘
```

The key insight visualized: at certain journey stages, the FMCG-only competitive model *underestimates* pool pressure by 2-3x because it misses the non-FMCG competitors.

### Effort Estimate

| Component | Files Changed | New Files | Complexity |
|-----------|--------------|-----------|------------|
| CompetitorProfile model | `models.py` | — | Trivial |
| New competitor profiles | `competitive.py` | — | Medium |
| New response effects | `competitive.py` | — | Low |
| Journey-weighted equilibrium | `competitive.py` | — | Medium |
| Database (competitor schema) | `database.py` | — | Low |
| API endpoints | routes | — | Low |
| Competitive panel (enhanced) | `CompetitivePanel.tsx` | — | Medium |

**Total: ~4-5 days of development.** Most complexity is in calibrating the new competitor response effects — the code changes are straightforward.

---

## Integration: How the Two Workstreams Connect

The two workstreams are designed to be built sequentially but to create compounding value:

```
Workstream 1                Workstream 2
(Journey Exposure)    →     (Extended Competition)

Each trend gets             Journey-specific
journey_exposure            competitor sets
scores (0-5 per stage)      change the equilibrium
        ↓                          ↓
Journey decomposition       Adjusted competitive
in shift matrix             response per stage
        ↓                          ↓
Heatmap toggle              Enhanced competitive
in War Room                 panel with non-FMCG
        ↓                          ↓
        └────────────┬────────────┘
                     ↓
        ┌──────────────────────────────┐
        │   COMBINED STRATEGIC VIEW    │
        │                              │
        │  "Between Washes is a HIGH   │
        │   profit-migration stage     │
        │   with D2C insurgents as     │
        │   primary competitive threat │
        │   — FMCG-only model misses   │
        │   67% of pool pressure here" │
        └──────────────────────────────┘
```

### War Room Toggle States

After both workstreams, the War Room heatmap supports these toggle combinations:

1. **Forces × Categories** (existing) — the default strategic force assessment
2. **Forces × Journey Stages** (new) — which forces hit which consumer moments
3. **Categories × Journey Stages** (new) — where does each category's shift land in the journey
4. **Competitive Landscape** (enhanced) — journey-stage-specific competitor sets overlay

### The "Laundry Services" Question

The team's image has "Laundry services" noted at the bottom left — suggesting an entire service economy layer. This doesn't fit neatly into any current PRISM category (LHC: LAD, FCN, etc. are all product categories). Two options:

**Option A (recommended for now):** Model laundry services as a competitor, not a category. The `laundry_services` CompetitorProfile in Workstream 2 captures the competitive pressure from services on product categories. This is simpler and doesn't require restructuring the 12-category taxonomy.

**Option B (future consideration):** Add "Laundry Services" as a 13th category in the LHC portfolio. This is structurally cleaner but requires significant model recalibration (all force weights, exposure scores, and simulation parameters assume 12 categories). Park this for the annual model review.

### The Hair Journey

This blueprint focuses on Laundry because that's what the team's image covers. A parallel Hair journey would look something like:

```
Purchase → Open → Wet Hair → Apply Shampoo → Wait/Massage →
Rinse → Apply Conditioner → Wait → Rinse → Towel Dry →
Apply Treatment → Blow Dry → Style → Touch Up → Next Day
```

The architecture supports this — `JOURNEY_STAGES` can be extended to `JOURNEY_STAGES_LHC` and `JOURNEY_STAGES_HAIR`, with each trend's `journey_exposure` scoped to the relevant journey. Implementation deferred to a future sprint after validating the Laundry journey with the team.

---

## Implementation Sequence

| Week | Workstream | Milestone |
|------|-----------|-----------|
| 1 | WS1: Config + Model + DB | Journey stage taxonomy live, trends scored |
| 1 | WS1: Seed data | All 60 trends get journey_exposure scores |
| 2 | WS1: MC engine + API | Journey decomposition in simulation output |
| 2 | WS1: Dashboard | Heatmap toggle, detail panel, trend filter |
| 3 | WS2: Competitor profiles | 4 non-FMCG competitors added |
| 3 | WS2: Equilibrium + Dashboard | Journey-weighted competitive panel |
| 4 | Integration + Testing | Combined view, end-to-end validation |

**Total: ~4 weeks, parallelizable to ~3 weeks with two developers.**

---

## Open Questions for the Team

1. **Journey stage profit sizing:** Do we have any data (even directional estimates) on relative profit pool size per journey stage? Without this, journey decomposition uses trend-driven migration as a proxy — good enough for direction, but not for magnitude.

2. **Hair journey definition:** Has the Hair team done a similar consumer journey mapping? If so, we should integrate both simultaneously rather than retrofitting.

3. **Non-FMCG competitor calibration:** The response pool effects for appliance manufacturers and tech platforms are estimated from market observation. Should we run a mini-Delphi with the Category Leads to calibrate these?

---

*Blueprint Version: 1.0 — March 2026*
*Classification: Internal — Strategy & Technology*
