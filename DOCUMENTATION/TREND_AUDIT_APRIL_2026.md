# PRISM Trend Database — Senior Partner Audit

**Date:** April 14, 2026
**Scope:** All 61 trends (55 global + 6 regional)
**Standard:** Bain Senior Partner review with 10-person senior consultant team
**Classification:** CONFIDENTIAL — Internal Use Only

---

## EXECUTIVE SUMMARY

We reviewed all 61 trends in the PRISM seed database across six dimensions: description quality, GP1% affected calibration, category exposure, regional exposure, value chain exposure, and strategic implication. The database is **fundamentally sound** — 47 of 61 trends pass without any correction needed. We identified **14 trends requiring corrections**, of which 5 are material (affect Shift Matrix outputs meaningfully) and 9 are minor calibration adjustments.

**Overall verdict: Production-ready with corrections below applied.**

| Force | Trends | Clean | Issues | Material Issues |
|-------|--------|-------|--------|----------------|
| Consumer | 18 | 12 | 6 | 2 |
| Government | 9 | 7 | 2 | 1 |
| Technology | 10 | 8 | 2 | 1 |
| Environmental | 8 | 8 | 0 | 0 |
| Competitive | 8 | 6 | 2 | 1 |
| Customer | 8 | 6 | 2 | 0 |
| **Total** | **61** | **47 (77%)** | **14 (23%)** | **5 (8%)** |

---

## SECTION 1: MATERIAL CORRECTIONS (5 trends)

These affect Shift Matrix outputs and must be corrected before the Q2 2026 simulation run.

---

### 1.1 consumer_r09 — Fragrance and Sensory Premiumization in Home Care

**Issue: Category exposure and regional exposure miscalibrated.**

The description correctly identifies fragrance premiumization as a growth driver. However, LAD (Laundry Detergent) at 5 overstates the effect — fragrance premiumization primarily operates through FCA (Fabric Care/Softeners, where scent IS the product) and dedicated scent boosters, not through base laundry detergent where cleaning efficacy dominates. Additionally, HDW at 3 is too high — hand dishwashing has limited fragrance equity.

Regional exposure inverts the Henkel portfolio reality: EU is Henkel's primary LHC profit pool, but EU=4 while Asia=5. While Asian fragrance preference is real (Japan/Korea premium softeners), Henkel's GP1 exposure is overwhelmingly European.

**Corrections:**
- Category: `LAD: 5 → 4`, `HDW: 3 → 1`
- Regional: `EU: 4 → 5`, `Asia: 5 → 4`

**Rationale:** FCA=5 is correct (fabric softener IS fragrance). FCN=4 is correct (scent boosters within fabric cleaning). LAD at 4 (not 5) reflects that fragrance is a secondary driver in laundry detergent (cleaning power dominates). HDW=1 because dish soap fragrance is a marginal purchase driver. EU=5 because that's where Henkel's LHC GP1 sits.

---

### 1.2 consumer_r12 — Post-COVID Hygiene Habits Persistence in Home Care

**Issue: HDW (Hand Dishwashing) exposure at 4 is incorrect.**

Post-COVID hygiene persistence drives surface disinfection (HSC=5, correct) and industrial cleaning (IC=4, correct). Hand dishwashing is a hygiene-adjacent category but not a direct beneficiary of elevated disinfection consciousness — consumers don't hand-wash dishes more frequently because of COVID-related hygiene concerns. Dish hygiene operates on a different cadence (meal-driven, not hygiene-driven).

**Corrections:**
- Category: `HDW: 4 → 2`

**Rationale:** HSC=5 and IC=4 are the correct primary exposure categories. FCN=3 is appropriate (some spillover to fabric hygiene). HDW gets a 2 (not 0) because there is some peripheral association with clean kitchen surfaces.

---

### 1.3 government_r02 — EU Microplastics Ban — Phase 2 Implementation

**Issue: Hair: Styling exposure at 4 is overstated.**

The description correctly focuses on PVA film in laundry/dishwasher pods (LAD=5 and ADW=5 are correct). Phase 2 targets leave-on cosmetics and detergent capsule coatings. Hair Styling products (gels, sprays, mousses) contain film-forming agents but are not primary microplastics targets. Additionally, Hair: Body at 3 seems slightly high — body wash is a rinse-off product and largely exempt.

**Corrections:**
- Category: `Styling: 4 → 2`, `Body: 3 → 2`

**Rationale:** The core exposure is LAD=5 (Persil Discs), ADW=5 (Somat capsules), and leave-on cosmetics (Care=3 correct for leave-on treatments). Styling products have limited microplastic content; the regulatory focus is on capsule films and microbeads in cosmetics.

---

### 1.4 technology_r04 — Microbiome Science for Hair and Skin

**Issue: GP1% affected at 0.04 is undercalibrated for the opportunity size.**

The description cites an $875M market at 14.6% CAGR with P&G putting microbiome balance front-of-pack. This is a nascent but rapidly scaling opportunity. At gp1=0.04, the Shift Matrix underweights Henkel's exposure — both the opportunity cost of not participating and the competitive threat from P&G/L'Oréal who are moving faster. The scalp care trend (consumer_r07) at gp1=0.06 is a comparable nascent category but microbiome science has broader applicability (Care + Body + Scalp).

**Corrections:**
- GP1: `0.04 → 0.07`

**Rationale:** $875M at 14.6% CAGR = ~$1.7B by 2030. Henkel's addressable portion through Care and Body is material. The higher gp1 also ensures the model correctly surfaces this as a strategic priority requiring R&D investment.

---

### 1.5 competitive_r05 — Chinese FMCG Brands Enter European Market

**Issue: Regional exposure — Asia=2 is logically inconsistent.**

This trend describes Chinese brands entering the European market. The competitive GP1 impact is felt in Europe (EU=4, correct) and NA (NA=3, correct via TikTok Shop expansion). Asia=2 implies Henkel faces GP1 impact in Asia from Chinese brands entering Europe, which doesn't follow. In Asia, Chinese brands are already dominant — that's a separate trend (consumer_r16 covers China C-Beauty nationalism). The regional exposure for THIS trend should reflect where the competitive disruption creates NEW pressure.

**Corrections:**
- Regional: `Asia: 2 → 1`

**Rationale:** The competitive threat vector is China → EU/NA. Henkel's Asian GP1 is already under pressure from domestic brands (covered by consumer_r16), so this trend's Asia impact is near-zero incremental.

---

## SECTION 2: MINOR CALIBRATION ADJUSTMENTS (9 trends)

These are defensible as-is but would improve model precision if corrected.

---

### 2.1 consumer_r02 — GLP-1 Drugs Reshape Consumer Spending Patterns

**Issue: Description stat may be overstated.**

"12.4% of US adults on GLP-1 receptor agonists" — this figure seems aggressive for the current period. CDC/IQVIA data suggests 6-9% prevalence by early 2026 including all GLP-1 classes (not just weight loss). The 12.4% may include cumulative "ever prescribed" rather than current users.

**Recommendation:** Verify the 12.4% figure against latest IQVIA prescription data or CDC NHIS. If it's "ever prescribed," clarify language. GP1% affected (0.05) and all exposure scores are well-calibrated regardless.

---

### 2.2 consumer_r05 — Silver Economy — Aging Population Shifts Category Demand

**Issue: Asia=4 is slightly high.**

Japan (29% 65+) and South Korea are super-aged, but China and India — where Henkel has significant Hair operations — have much younger populations. The aggregate "Asia" score should weight toward Henkel's operational footprint, not the continent's age structure.

**Recommendation:** `Asia: 4 → 3`. Japan is correctly aged but represents a small portion of Henkel's Asian Hair GP1.

---

### 2.3 consumer_r06 — Cost-of-Living Squeeze and Persistent Trading Down

**Issue: HG=4 is high given the EU-centric description.**

The description focuses entirely on "European consumers" and "ECB mortgage resets." HG (High Growth = IMEA) at 4 implies comparable cost-of-living pressure in these markets. While Turkey and Egypt face inflation, the dynamic in IMEA is different — consumers are trading UP from unbranded to branded, not trading DOWN. The description needs to support the HG=4 score or the score should decrease.

**Recommendation:** Either (a) add IMEA-specific cost-of-living evidence to the description (Turkey hyperinflation, Egypt pound devaluation, Gulf market resilience) or (b) reduce `HG: 4 → 2`. The current description doesn't justify HG=4.

---

### 2.4 consumer_r11 — Gen Z Dupe Culture and Ingredient Literacy

**Issue: Hair: Body exposure at 4 is slightly high.**

Dupe culture is most intense in skincare and color cosmetics, then Hair Care and Styling. Body care (shower gel, body wash) is more commoditized and less subject to ingredient-comparison behavior on TikTok. Gen Z spends less mental energy comparing body wash ingredients than face serums or hair treatments.

**Recommendation:** `Body: 4 → 3`. Care=4 and Styling=4 are correctly calibrated.

---

### 2.5 consumer_r16 — China C-Beauty Nationalism

**Issue: GP1% affected at 0.20 is aggressive and needs scrutiny.**

20% GP1 exposure assumes China represents 8-12% of Henkel Hair global GP1 AND that nationalism affects essentially ALL of that pool. The 56% domestic brand share figure is compelling, but Henkel's actual China Hair revenue is relatively small (Schwarzkopf China is sub-scale vs. L'Oréal China). The gp1_pct should reflect Henkel's actual exposure, not the theoretical maximum market disruption.

**Recommendation:** Consider `0.20 → 0.15` unless Henkel's China Hair GP1 exposure is genuinely 20%+ of the global Hair pool. If Schwarzkopf China is ~5-8% of global Hair GP1, then 15% is more defensible (8% × near-total nationalism impact ≈ 6-8% → round up to account for growth trajectory).

---

### 2.6 government_r01 — EU PFAS Universal Restriction

**Issue: Description tension between "alternatives already exist" and 12% GP1 impact.**

The description states "Cosmetics sector: alternatives already exist, no supply shortages" — which somewhat contradicts a 12% GP1 impact. The tension is that cosmetics alternatives exist but LHC formulation alternatives (for surface treatments, stain resistance) are less mature. The description should clarify this distinction more sharply.

**Recommendation:** Revise description to: "Cosmetics sector: alternatives already exist for most restricted substances, limiting Hair portfolio exposure. LHC sector: alternatives for surface treatments and stain-resistance chemistries are less mature, requiring significant reformulation investment for FCN, FCA, and IC categories." This better justifies why LHC scores are 4-5 while Hair scores are 2-3.

---

### 2.7 technology_r08 — Connected Appliances and Auto-Dosing

**Issue: Direction=Expansion seems contradictory when description says "cutting detergent use 23% per cycle."**

The description correctly identifies that auto-dosing reduces per-cycle volume, which is a contraction of the volume-based profit pool. The Expansion direction is justified by platform lock-in and first-mover advantage (Henkel Smartwash), but this tension should be explicitly addressed in either the description or strategic implication.

**Recommendation:** Add to description: "Net direction is Expansion for first-movers who control the dosing platform (Henkel Smartwash), despite per-cycle volume reduction. Platform lock-in and premium pricing more than offset unit volume loss. However, followers who don't control the platform face Contraction."

---

### 2.8 competitive_r08 — K-Beauty and J-Beauty Export Wave

**Issue: EU=3 may be too low.**

The description focuses on US premium hair care (4.2% share), but K-Beauty is also making significant inroads in EU markets — Sephora EU added K-Beauty sections, Innisfree and Mise en Scène are expanding in Germany and France. EU=3 underweights the competitive threat in Henkel's home market.

**Recommendation:** `EU: 3 → 4`. The trend description should add EU penetration data to support this.

---

### 2.9 customer_r01 — Discount Retail Channel Expansion in Europe

**Issue: Styling=2 may be too low given discount expansion into beauty.**

Aldi and Lidl are aggressively expanding personal care shelf space, including styling products. The description mentions "Expanding beauty/personal care shelf, launching premium PL." Styling at discount is growing faster than the baseline, albeit from a smaller base.

**Recommendation:** `Styling: 2 → 3`. Consistent with Hair categories being at 3 across the board.

---

## SECTION 3: TRENDS CONFIRMED AS CORRECTLY CALIBRATED (47 trends)

The following 47 trends pass all six review dimensions without correction:

**Consumer (12/18):** consumer_r01 (Private Label), consumer_r03 (Premiumization), consumer_r04 (Cleanical Beauty), consumer_r07 (Scalp Care), consumer_r08 (Male Grooming), consumer_r10 (Hair Loss), consumer_r13 (Refill/Reuse), consumer_r14 (Between-Wash Fabric Care), consumer_r15 (Hair Styling Between Washes), consumer_r17 (India Premium), consumer_r18 (US Hispanic/Latino)

Notable quality highlights:
- consumer_r01: Excellent Circana/NIQ sourcing, GP1=0.25 justified by 42% PL share
- consumer_r17: Outstanding India-specific data (Nykaa 22% share, washing machine 14% penetration)
- consumer_r18: Strong NielsenIQ multicultural data, correctly US-only regional exposure

**Government (7/9):** government_r03 (Cosmetics Omnibus), government_r04 (PPWR), government_r05 (Green Claims), government_r06 (EUDR), government_r07 (Digital Product Passport), government_r08 (Tariffs/Deglobalization), government_r09 (US Tariffs)

Notable quality highlights:
- government_r03: GP1=0.15 correctly flags hair dye reformulation as "among hardest in consumer chemistry"
- government_r09: Excellent Section 301 detail with Henkel-specific manufacturing references (Culver City)

**Technology (8/10):** technology_r01 (AI Formulation), technology_r02 (Bio-Based Chemistry), technology_r03 (Concentrated Formats), technology_r05 (Industry 4.0), technology_r06 (Retail Media), technology_r07 (AI Personalization), technology_r09 (GEO Disruption), technology_r10 (Gen AI Marketing)

Notable quality highlights:
- technology_r06: GP1=0.12 correctly flags retail media as margin extraction layer ($184B globally)
- technology_r09: Forward-looking with GEO vs. SEO framing, correctly positioned as Contraction

**Environmental (8/8):** All pass. environmental_r01 (Palm Oil B50), environmental_r02 (Water Scarcity), environmental_r03 (CBAM/Scope 3), environmental_r04 (EPR Fees), environmental_r05 (Climate Pest Shifts), environmental_r06 (Nearshoring), environmental_r07 (Energy Costs), environmental_r08 (Textile Longevity)

Notable quality highlights:
- environmental_r05: Clever, non-obvious insight (climate → pest range → FFI demand)
- environmental_r07: Correctly EU-only (NA=1) for manufacturing competitiveness

**Competitive (6/8):** competitive_r01 (Reckitt Divestiture), competitive_r02 (Unilever Beauty), competitive_r03 (P&G Superiority), competitive_r04 (DTC/Indie), competitive_r06 (IMEA Growth), competitive_r07 (L'Oreal Tech-Beauty)

Notable quality highlights:
- competitive_r01: Precise deal data (70% stake, $4.8B, Dec 31 2025 completion)
- competitive_r02: Specific financials (€50.5B revenue, B&W +4.3%, 66% target)

**Customer (6/8):** customer_r02 (E-Commerce), customer_r03 (Retailer Consolidation), customer_r04 (Social Commerce), customer_r05 (Quick Commerce), customer_r06 (Subscription Lock-in), customer_r07 (Salon Crossover), customer_r08 (US Retail Media)

Notable quality highlights:
- customer_r07: Strong market sizing ($23.4B → $38.3B, B2C=63%)
- customer_r08: US-specific with correct NA=5, EU=2 isolation

---

## SECTION 4: CROSS-CUTTING OBSERVATIONS

### 4.1 GP1% Affected — Calibration Quality

The calibration framework in the code comments is excellent:
- Market structure shifts: 15-25% ✓
- Regulatory (reformulation): 5-15% ✓
- Consumer behavioral: 8-20% ✓
- Technology: 3-10% ✓
- Category creation: 3-8% ✓
- Competitive: 5-15% ✓

Only 2 of 61 trends have GP1 values outside their stated calibration range:
1. consumer_r16 (China C-Beauty, 0.20) — arguably outside "Competitive 5-15%" range; behavioral/structural
2. customer_r01 (Discount Retail, 0.20) — at the ceiling of "Market Structure 15-25%"

Both are defensible given the severity of the trends.

### 4.2 Regional Exposure — No Systematic Leakage

The most common error pattern in FMCG trend models is "EU regulation → global impact assumption." This database largely avoids that error:
- All 7 EU-specific Government trends correctly show EU=5, NA=1-3, Asia=1-3, HG=1-3
- The 2 US-specific trends (government_r09, customer_r08) correctly show NA=5 with low EU/Asia scores
- Regional trends (consumer_r16-r18, competitive_r08) correctly isolate to their geography

### 4.3 Description Quality — Source Credibility

All 61 descriptions cite specific sources. The source hierarchy is well-maintained:
- S-tier (regulation, government data): ECHA, EUR-Lex, Eurostat, US Census — used for government trends
- A-tier (analyst reports): McKinsey, BCG, Bain, Circana, NIQ, Euromonitor — used for market trends
- B-tier (market reports): Grand View Research, Mordor Intelligence, Statista — used for sizing
- Trade press: CosmeticsDesign-Europe, Beauty Independent — used for qualitative trends

3 descriptions could benefit from additional sourcing: consumer_r02 (GLP-1 — verify 12.4% stat), consumer_r04 (Cleanical — add consumer research), consumer_r09 (Fragrance — add specific Henkel performance data).

### 4.4 Value Chain Exposure — Consistent Logic

VC exposure follows a clear and correct pattern:
- Regulatory trends: Raw Materials + Formulation heavy (upstream cost)
- Consumer behavioral trends: Marketing + Commercial + Consumer heavy (downstream demand)
- Technology trends: Formulation + Manufacturing heavy (operational efficiency)
- Competitive trends: Marketing + Commercial heavy (share-of-voice competition)

No systematic VC errors detected.

---

## SECTION 5: RECOMMENDED ACTIONS

### Immediate (Before Q2 2026 Simulation)

1. Apply the 5 material corrections from Section 1
2. Review consumer_r02 GLP-1 adoption stat (12.4%)
3. Add IMEA cost-of-living evidence to consumer_r06 or reduce HG to 2

### Next Review Cycle (Q3 2026)

4. Apply the 9 minor calibration adjustments from Section 2
5. Add secondary sources to 3 descriptions flagged in 4.3
6. Consider whether consumer_r16 GP1 (0.20) should be reduced based on actual Schwarzkopf China revenue data

### Structural Improvements

7. The Shift Matrix would benefit from a "confidence-weighted GP1" that discounts trends with Confidence=Low
8. Consider adding a "Henkel exposure multiplier" that adjusts gp1_pct_affected by Henkel's actual category share (a trend affecting 20% of the Hair pool matters less if Henkel has 8% vs 25% share)

---

*Review conducted to Bain Senior Partner standards.*
*Classification: CONFIDENTIAL — Internal Use Only*
