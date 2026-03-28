# PULSE Trend Intelligence Report — v2.0

**Prepared for:** Henkel Consumer Brands — Global Category Strategy
**Date:** March 28, 2026
**Classification:** Confidential — Internal Use Only
**Methodology:** Multi-source intelligence scan across 6 strategic forces, scored using PULSE schema
**Format:** Database-ready — every trend includes all fields required for direct import into PULSE

---

## Executive Summary

This report identifies and scores **47 strategic trends** across all six PULSE forces with material implications for Henkel Consumer Brands' profit pool trajectory through 2030. Each trend is scored with the complete PULSE data model: Impact (1-5), Probability (1-5), Direction, Relevance (0-100), plus full mappings for **12 categories**, **8 value chain steps**, and **4 regions** — ready for direct database import.

**Structural assessment:** 22 of 47 trends carry a Contraction direction. 15 are Expansion. 10 are Mixed. The HCB profit pool is under systemic pressure from regulatory, competitive, and channel forces. The strongest Expansion signals — Hair Premiumization (C-03), Professional Salon Crossover (S-10), Bio-Based Chemistry (T-02), Scalp Care (C-07), Hair Loss Treatments (S-06), Fragrance Premiumization (S-02), and Henkel Smartwash (S-08) — represent Henkel's primary strategic paths to offset the compression. Hair is offense. LHC is defense through innovation, not price.

**Three dominant dynamics:**

1. **Private label has reached 40% market share in Europe** (€291B). This is structural, not cyclical — retailer brands have invested in quality parity. LHC profit pools are compressing from both ends: retailer power from above, private label from below.

2. **The EU regulatory cascade** (PFAS, microplastics Phase 2, Omnibus VII/VIII, Green Claims, EUDR, Digital Product Passport, PPWR) is the most intensive reformulation/compliance burden in the history of European FMCG. Front-loaded capex, uncertain consumer acceptance, and first-mover risk define the next 3 years.

3. **The "skinification" of Hair** and emergence of Scalp Care as a standalone category are creating the largest white-space profit pool expansion in HCB. Schwarzkopf's professional heritage is the moat. But Unilever's beauty pivot (66% revenue target) and indie brand disruption are closing the window.

---

## Scoring Schema — Complete PULSE Data Model

Every trend below maps to these exact database fields:

| Field | Values | Database Table |
|-------|--------|---------------|
| **Force** | Consumer, Customer, Technology, Government, Environmental, Competitive | `trends.force` |
| **Direction** | Expansion, Contraction | `trends.direction` |
| **Impact** | 1-5 (magnitude of profit pool shift) | `trends.impact` |
| **Probability** | 1-5 (likelihood of materialization by 2030) | `trends.probability` |
| **Relevance** | 0-100 (directness of HCB impact) | custom field |
| **Category Exposure** (0-5 each) | Hair: Color, Care, Styling, Body; LHC: FCN, FCA, FFI, LAD, HDW, ADW, HSC, IC | `trend_category_exposure` |
| **Value Chain Exposure** (0-5 each) | Raw Materials, Formulation, Manufacturing, Packaging, Supply Chain, Marketing, Commercial, Consumer | `trend_vc_exposure` |
| **Regional Exposure** (0-5 each) | Europe, North America, Asia, High Growth | `trend_regional_exposure` |

---

## FORCE 1: CONSUMER (8 Trends)

### C-01 | Private Label Structural Penetration in Europe

| Field | Value |
|-------|-------|
| **Direction** | Contraction |
| **Impact** | 5 | **Probability** | 5 | **Relevance** | 95 |

**Description:** Private label has crossed 40% market share in European FMCG (€291B, NIQ 2025). This is no longer inflation-driven trading down — retailer brands have invested in quality, packaging, and premium tiers. In Germany/Benelux, private label laundry share exceeds 45%. The branded-to-PL price gap has narrowed to 15-20% in key categories, below the ~30% threshold where brand premium is defensible without demonstrated superiority.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 3 | 3 | 2 | 3 | 5 | 5 | 4 | 5 | 4 | 4 | 3 | 4 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 1 | 1 | 1 | 1 | 1 | 4 | 5 | 5 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 5 | 3 | 2 | 2 |

**Reasoning:** LHC categories bear highest exposure — laundry/cleaning are the epicenter of PL substitution (lowest perceived differentiation). Hair has more brand equity protection. VC impact concentrated in Commercial (shelf negotiation, trade terms) and Consumer (switching behavior). Marketing increases because brands must spend more to justify premium. Europe is ground zero; NA/Asia have lower PL penetration but growing.

---

### C-02 | GLP-1 Drugs Reshape Consumer Spending Patterns

| Field | Value |
|-------|-------|
| **Direction** | Mixed | **Impact** | 3 | **Probability** | 4 | **Relevance** | 65 |

**Description:** 12.4% of US adults on GLP-1 receptor agonists. Consumer spending data shows reduced impulse purchasing but increased premium self-care investment. Weight-loss consumers invest more in hair care, skin care, and grooming. European adoption 18-24 months behind US but accelerating.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 2 | 3 | 2 | 3 | 1 | 1 | 0 | 2 | 0 | 0 | 0 | 0 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 0 | 1 | 0 | 0 | 0 | 3 | 2 | 4 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 3 | 5 | 2 | 1 |

**Reasoning:** Consumer-end phenomenon. NA leads (highest GLP-1 penetration). Hair premium benefits from self-care spending reallocation. LHC sees reduced grocery basket frequency but marginal impact.

---

### C-03 | Premiumization Acceleration in Hair Care

| Field | Value |
|-------|-------|
| **Direction** | Expansion | **Impact** | 4 | **Probability** | 5 | **Relevance** | 90 |

**Description:** Global premium hair care growing at 2-3x mass market rate. "Skinification" logic applied to hair — ingredient-conscious, multi-step routines, professional-grade products at home. Salon-to-retail crossover is the fastest-growing white space. Henkel Hair grew +3.2% organic FY2025.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 4 | 5 | 4 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 3 | 5 | 3 | 4 | 2 | 5 | 4 | 5 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 5 | 5 | 4 | 3 |

**Reasoning:** Henkel's strongest profit pool expansion opportunity. Schwarzkopf Professional heritage is a DBA that competitors cannot replicate. Touches entire VC — premium ingredients (Raw Mat), advanced formulation, premium packaging, brand-building Marketing, retailer negotiations (Commercial), and consumer willingness to pay. Global phenomenon, strongest in mature markets.

---

### C-04 | Conscious Consumption and "Cleanical" Beauty

| Field | Value |
|-------|-------|
| **Direction** | Mixed | **Impact** | 3 | **Probability** | 4 | **Relevance** | 75 |

**Description:** Consumers simultaneously demand "clean" (no harmful chemicals, transparent) and "clinical" (proven efficacy, dermatologist-tested). Requires reformulation investment but rewards brands delivering both with pricing power. Reinforced by EU Green Claims Directive enforcement (September 2026).

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 3 | 4 | 2 | 4 | 3 | 3 | 2 | 2 | 2 | 2 | 1 | 1 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 4 | 5 | 2 | 3 | 2 | 4 | 3 | 5 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 5 | 4 | 3 | 2 |

**Reasoning:** Heavy Formulation and Raw Materials impact (reformulation capex). Marketing impact (substantiation claims). Consumer pull is strong. Europe leads due to regulatory reinforcement. Mixed because short-term capex (Contraction) enables long-term premiumization (Expansion).

---

### C-05 | Silver Economy — Aging Population Shifts Category Demand

| Field | Value |
|-------|-------|
| **Direction** | Mixed | **Impact** | 3 | **Probability** | 5 | **Relevance** | 60 |

**Description:** Europe 65+ population exceeds 25% by 2030. Aging consumers: gray coverage (the #1 CEP in hair color), gentler formulations, ease-of-use packaging, different cleaning patterns. Pension-constrained budgets in some segments vs. premium willingness in affluent retirees.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 5 | 3 | 1 | 2 | 2 | 2 | 1 | 2 | 2 | 1 | 1 | 1 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 1 | 3 | 1 | 3 | 1 | 4 | 3 | 5 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 5 | 4 | 4 | 2 |

**Reasoning:** Color is the standout beneficiary — gray coverage is the largest single CEP. Packaging needs adaptation (ease of use). Marketing must shift messaging for older demographics. Europe/NA/Japan most affected. High Growth markets have younger demographics.

---

### C-06 | Cost-of-Living Squeeze and Persistent Trading Down

| Field | Value |
|-------|-------|
| **Direction** | Contraction | **Impact** | 4 | **Probability** | 4 | **Relevance** | 80 |

**Description:** 70%+ of European consumers continue trading down on everyday essentials (BCG/McKinsey 2026). ECB warns mortgage resets will shave up to 1pp off consumption growth through 2030. Discretionary headroom narrowed in Q1 2026 despite headline inflation falling below 2%. This is not just an inflation story — it is a structural affordability squeeze.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 3 | 3 | 3 | 3 | 4 | 4 | 3 | 5 | 3 | 3 | 2 | 2 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 1 | 1 | 1 | 2 | 1 | 4 | 5 | 5 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 5 | 3 | 2 | 4 |

**Reasoning:** Directly compresses the branded profit pool through downtrading to PL and value tiers. LAD most exposed (highest frequency, most substitutable). Commercial VC step heavily impacted (trade term pressure). Europe and High Growth markets most affected; NA more resilient.

---

### C-07 | Scalp Care Emerges as Standalone Category

| Field | Value |
|-------|-------|
| **Direction** | Expansion | **Impact** | 3 | **Probability** | 4 | **Relevance** | 80 |

**Description:** Scalp care is the fastest-growing sub-segment in hair care. Olaplex reports scalp health growing at 2x prestige hair care rate in Q1 2025. Google searches for "scalp + microbiome" up 120%. Hair-and-scalp care market projected to reach $175.8B by 2032 (CAGR 6.8%). This creates a new profit pool adjacent to existing Hair categories.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 2 | 5 | 1 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 3 | 5 | 2 | 3 | 1 | 5 | 4 | 5 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 4 | 5 | 5 | 2 |

**Reasoning:** White space for Schwarzkopf — professional scalp expertise translates directly. Heavy Formulation investment needed (microbiome-friendly actives, probiotic ingredients). Marketing-intensive category creation. Asia is a lead market (K-beauty scalp routines). Expansion because it creates a new profit pool that didn't previously exist at scale.

---

### C-08 | Male Grooming Structural Growth

| Field | Value |
|-------|-------|
| **Direction** | Expansion | **Impact** | 3 | **Probability** | 4 | **Relevance** | 65 |

**Description:** European male grooming market: $23.6B in 2025, growing at 7.65% CAGR. Germany alone projected at $5.3B by 2026. Driven by growing social acceptance of male personal care routines, premium/natural product demand, and skinification extending to men. Under-penetrated in Hair (styling, color) relative to female segments.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 2 | 3 | 4 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 2 | 3 | 2 | 3 | 1 | 5 | 4 | 5 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 5 | 4 | 4 | 3 |

**Reasoning:** Styling leads (got2b is already positioned). Body care benefits from expanded male grooming routines. Marketing-intensive (different channels, different messaging for male consumers). Packaging needs masculine design cues. Europe is the lead market by size.

---

## FORCE 2: GOVERNMENT (7 Trends)

### G-01 | EU PFAS Universal Restriction

| Field | Value |
|-------|-------|
| **Direction** | Contraction | **Impact** | 5 | **Probability** | 4 | **Relevance** | 90 |

**Description:** EU's proposed universal restriction on ~10,000 PFAS substances. ECHA received 5,642 consultation comments. Affects surface treatments, water-repellent coatings, stain resistance, and industrial cleaning agents. Phased implementation expected 2027-2030.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 2 | 2 | 3 | 2 | 4 | 5 | 3 | 4 | 3 | 4 | 4 | 5 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 5 | 5 | 3 | 2 | 3 | 2 | 2 | 1 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 5 | 3 | 2 | 2 |

**Reasoning:** Raw Materials and Formulation bear the brunt — entire ingredient families must be replaced. Manufacturing needs retooling for new chemistries. IC and FCA most exposed (fluorinated cleaning agents, stain-resistant fabric care). Europe-first regulation but will cascade globally.

---

### G-02 | EU Microplastics Ban — Phase 2 Implementation

| Field | Value |
|-------|-------|
| **Direction** | Contraction | **Impact** | 4 | **Probability** | 5 | **Relevance** | 85 |

**Description:** Phase 2 (2027-2029) targets leave-on cosmetics and detergent capsule coatings. PVA film in laundry/dishwasher pods under scrutiny. Bio-based film alternatives technically immature at scale. Regulation adopted — implementation timeline locked.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 2 | 3 | 4 | 3 | 4 | 4 | 2 | 5 | 3 | 5 | 2 | 3 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 4 | 5 | 4 | 5 | 2 | 2 | 2 | 2 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 5 | 2 | 2 | 1 |

**Reasoning:** Packaging and Manufacturing heavily impacted — capsule/pod format may need fundamental redesign. LAD (Persil Discs) and ADW (Somat capsules) are core innovation platforms at risk. Formulation must find microplastic-free film-forming alternatives. Europe-only regulation currently.

---

### G-03 | EU Cosmetics Regulation Omnibus VII/VIII Revision

| Field | Value |
|-------|-------|
| **Direction** | Contraction | **Impact** | 4 | **Probability** | 4 | **Relevance** | 80 |

**Description:** Rolling restriction of UV filters, preservatives, fragrances, and colorants under EC 1223/2009 Omnibus amendments. SCCS opinions driving restrictions on widely-used ingredients. Creates continuous reformulation obligation for Hair and Body portfolios.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 5 | 4 | 3 | 4 | 2 | 2 | 1 | 1 | 1 | 1 | 1 | 0 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 5 | 5 | 2 | 1 | 2 | 2 | 2 | 2 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 5 | 2 | 3 | 2 |

**Reasoning:** Color most exposed — hair dye ingredient reformulation is among the hardest challenges in consumer chemistry. Raw Materials and Formulation are the impacted VC steps. Asia has moderate exposure (J-beauty/K-beauty regulatory convergence with EU).

---

### G-04 | EU PPWR — Packaging and Packaging Waste Regulation

| Field | Value |
|-------|-------|
| **Direction** | Contraction | **Impact** | 3 | **Probability** | 5 | **Relevance** | 75 |

**Description:** Mandates 30% recycled content by 2030, 65% by 2040. DRS expansion. Reuse/refill targets. Applies from August 2026. Affects every Henkel SKU. Front-loaded tooling and PCR resin costs.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 3 | 0 | 3 | 5 | 3 | 2 | 2 | 2 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 5 | 2 | 2 | 1 |

**Reasoning:** Universal category exposure (every product has packaging). Packaging VC step takes the direct hit. Manufacturing retooling for PCR materials. Supply Chain affected by PCR resin sourcing.

---

### G-05 | EU Green Claims Directive / EmpCo Enforcement

| Field | Value |
|-------|-------|
| **Direction** | Contraction | **Impact** | 3 | **Probability** | 5 | **Relevance** | 75 |

**Description:** The Empowering Consumers for the Green Transition (EmpCo) Directive applies from September 2026. Bans generic green claims ("eco-friendly," "planet-safe," "climate neutral") without robust substantiation. Comparative environmental claims require disclosed methodology. This directly restricts sustainability marketing — a key premiumization lever.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 3 | 3 | 2 | 3 | 3 | 3 | 2 | 3 | 2 | 3 | 2 | 2 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 1 | 1 | 1 | 2 | 2 | 5 | 3 | 3 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 5 | 2 | 1 | 1 |

**Reasoning:** Marketing VC step is the primary impact — every sustainability claim on packaging, advertising, and digital must be substantiated or removed. Commercial impact through retailer sustainability certification requirements. Brands that have invested in real sustainability credentials benefit; those relying on vague "green" messaging lose a positioning tool. EU-first but sets global standard.

---

### G-06 | EU Deforestation Regulation (EUDR)

| Field | Value |
|-------|-------|
| **Direction** | Contraction | **Impact** | 3 | **Probability** | 4 | **Relevance** | 70 |

**Description:** EUDR applies from December 2026 for large companies. Covers palm oil, soy, cattle, cocoa, coffee, rubber, timber — and derivatives. Soap made from palm oil may be added via Delegated Regulation (April 2026 draft expected). Requires geolocation-level traceability for every palm-derived ingredient back to the plantation, proving no deforestation after December 31, 2020.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 1 | 3 | 2 | 3 | 3 | 3 | 2 | 4 | 2 | 3 | 2 | 3 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 5 | 2 | 1 | 2 | 5 | 1 | 1 | 1 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 5 | 2 | 3 | 3 |

**Reasoning:** Raw Materials and Supply Chain are the impacted VC steps — palm-derived surfactants and fatty alcohols require end-to-end traceability. LAD most exposed (highest volume of palm-derived surfactants). Asia/High Growth impacted as sourcing origins. Compliance cost is significant but manageable for large companies like Henkel; the risk is supply chain disruption from non-compliant sub-suppliers.

---

### G-07 | EU Digital Product Passport (DPP)

| Field | Value |
|-------|-------|
| **Direction** | Contraction | **Impact** | 2 | **Probability** | 4 | **Relevance** | 55 |

**Description:** Under ESPR, DPPs will be required for detergents starting ~2027-2028, with broader consumer goods following through 2030. Each product must carry a digital record of composition, lifecycle, health/safety, and sustainability data accessible via QR code. Infrastructure standards finalized by July 2026.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 2 | 2 | 2 | 2 | 3 | 3 | 2 | 3 | 2 | 3 | 2 | 3 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 2 | 2 | 2 | 4 | 3 | 1 | 2 | 2 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 5 | 1 | 1 | 1 |

**Reasoning:** Packaging (QR/NFC integration) and Supply Chain (data infrastructure) are primary VC impacts. Detergents are in the first wave of mandatory DPP categories. Impact is low-to-moderate because it's primarily a compliance/IT cost, not a fundamental business model change. Europe-only for now.

---

## FORCE 3: TECHNOLOGY (6 Trends)

### T-01 | AI-Driven Formulation and Speed-to-Market

| Field | Value |
|-------|-------|
| **Direction** | Expansion | **Impact** | 4 | **Probability** | 4 | **Relevance** | 80 |

**Description:** ML-driven predictive formulation reduces concept-to-formula time from 18 months to 3-6 months. AI predicts ingredient interactions, stability, and sensory profiles. P&G and L'Oreal are furthest ahead; Henkel is a fast follower with announced AI R&D partnerships.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 5 | 4 | 3 | 3 | 4 | 3 | 3 | 4 | 3 | 4 | 3 | 3 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 3 | 5 | 3 | 1 | 1 | 1 | 2 | 1 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 4 | 5 | 4 | 2 |

**Reasoning:** Formulation VC step is the primary beneficiary — AI directly accelerates the step that regulatory trends (G-01 to G-03) make more expensive. Color benefits most (complex chemistry). Manufacturing benefits from AI-optimized production processes. NA leads in AI adoption.

---

### T-02 | Bio-Based and Green Chemistry Alternatives

| Field | Value |
|-------|-------|
| **Direction** | Expansion | **Impact** | 4 | **Probability** | 3 | **Relevance** | 85 |

**Description:** Enzymatic cleaning solutions (cold-water effective), bio-based surfactants from fermentation, biodegradable polymers. Novozymes/dsm-firmenich and BASF scaling enzyme-based laundry at 20°C. If cost parity reached by 2028-2029, enables step-change in LHC formulation and regulatory compliance simultaneously.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 2 | 3 | 2 | 3 | 4 | 4 | 3 | 5 | 3 | 4 | 4 | 4 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 5 | 5 | 3 | 2 | 3 | 3 | 2 | 3 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 5 | 4 | 3 | 3 |

**Reasoning:** Transforms Raw Materials (new feedstocks) and Formulation (new chemistry platforms) VC steps. LAD leads (enzyme systems for cold-wash Persil). Turns regulatory compliance costs into competitive advantage. Marketing benefits from credible sustainability claims. Europe drives demand due to regulatory pressure.

---

### T-03 | Concentrated and Solid Formats Innovation

| Field | Value |
|-------|-------|
| **Direction** | Expansion | **Impact** | 3 | **Probability** | 4 | **Relevance** | 75 |

**Description:** Refill concentrates, solid shampoo bars, laundry sheets, ultra-concentrated detergents moving from niche to mainstream. Consumer acceptance crossed early-adopter threshold. Formats reduce packaging, shipping weight, storage — aligning with PPWR compliance.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 1 | 4 | 2 | 3 | 3 | 4 | 2 | 4 | 3 | 3 | 3 | 2 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 3 | 4 | 4 | 5 | 4 | 3 | 3 | 4 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 5 | 4 | 3 | 2 |

**Reasoning:** Touches the entire VC — new formulation (removing water), new manufacturing (different processes), radically different packaging, lower supply chain costs (lighter, smaller), and new consumer usage occasions. Packaging is the most impacted step (complete redesign). Expansion because per-use margins improve even if shelf prices drop.

---

### T-04 | Microbiome Science for Hair and Skin

| Field | Value |
|-------|-------|
| **Direction** | Expansion | **Impact** | 3 | **Probability** | 3 | **Relevance** | 70 |

**Description:** Microbiome cosmetics market: $875M in 2025, growing at 14.6% CAGR. P&G put "microbiome balance" front-of-pack on shampoo lines. Google searches for "scalp microbiome" up 120%. Probiotic shampoos, postbiotic serums, microbiome-friendly conditioners. At-home scalp microbiome mapping kits emerging.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 1 | 5 | 1 | 4 | 1 | 2 | 0 | 1 | 0 | 0 | 1 | 0 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 4 | 5 | 3 | 2 | 2 | 4 | 3 | 4 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 4 | 5 | 5 | 2 |

**Reasoning:** Formulation is the primary VC impact (novel active ingredients, preservation challenges for live cultures). Raw Materials (sourcing probiotics/postbiotics at scale). Marketing (science-backed claims, clinical data). Care and Body are the categories — scalp health is a Care sub-segment, skin microbiome is Body. Asia co-leads with NA (K-beauty innovation).

---

### T-05 | Manufacturing Automation and Industry 4.0

| Field | Value |
|-------|-------|
| **Direction** | Expansion | **Impact** | 3 | **Probability** | 4 | **Relevance** | 65 |

**Description:** AI-driven manufacturing reduces inventory 20-30%, logistics costs 5-20%, procurement spend 5-15%. 80% of manufacturing executives plan to invest 20%+ of improvement budgets in smart manufacturing. Predictive maintenance cuts downtime 40%. Global AI in FMCG reaching $57.7B by 2033.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 2 | 2 | 5 | 3 | 5 | 1 | 1 | 0 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 4 | 4 | 4 | 3 |

**Reasoning:** Universal category exposure (all products are manufactured). Manufacturing and Supply Chain VC steps are the direct beneficiaries. Expansion through COGS reduction that flows to margin — critical when pricing power is constrained by PL competition. Global phenomenon.

---

### T-06 | Retail Media Networks as Primary FMCG Channel

| Field | Value |
|-------|-------|
| **Direction** | Mixed | **Impact** | 3 | **Probability** | 5 | **Relevance** | 70 |

**Description:** Retail media projected at $200B globally by 2027. Precision targeting at point of purchase but another margin extraction layer by retailers. Shifts brand-building from Mental Availability (TV) to Physical Availability (search ranking, sponsored listings). Fundamental change in FMCG marketing economics.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 2 | 2 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 0 | 0 | 0 | 0 | 0 | 5 | 5 | 4 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 4 | 5 | 4 | 2 |

**Reasoning:** Marketing and Commercial VC steps bear full impact — media budgets must shift, trade terms now include retail media commitments. From a Byron Sharp perspective, over-indexing on retail media (Physical Availability) at the expense of Mental Availability erodes long-term brand health. NA leads; Europe following.

---

## FORCE 4: ENVIRONMENTAL (5 Trends)

### E-01 | Palm Oil Supply Chain Disruption (Indonesia B50)

| Field | Value |
|-------|-------|
| **Direction** | Contraction | **Impact** | 4 | **Probability** | 4 | **Relevance** | 85 |

**Description:** Indonesia B50 mandate (50% palm biodiesel blend) diverts massive volumes from oleochemicals to fuel. Indonesia = 60% of global palm oil. Oleochemical supply for FMCG surfactants directly threatened. Palm kernel oil derivatives are foundational to both Hair (fatty alcohols) and LHC (surfactants).

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 2 | 4 | 3 | 4 | 4 | 4 | 3 | 5 | 3 | 4 | 3 | 4 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 5 | 3 | 2 | 1 | 4 | 0 | 2 | 1 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 4 | 4 | 5 | 4 |

**Reasoning:** Raw Materials and Supply Chain VC steps directly impacted. LAD is the highest-volume consumer of palm-derived surfactants. Asia most affected as sourcing origin. Cost inflation cannot be fully passed through due to PL price sensitivity. Structural, not cyclical.

---

### E-02 | Water Scarcity Drives Low-Water Formulations

| Field | Value |
|-------|-------|
| **Direction** | Mixed | **Impact** | 3 | **Probability** | 4 | **Relevance** | 70 |

**Description:** Water stress affects 40% of global population, intensifying in Southern Europe, MENA, Asia. Accelerates demand for cold-wash detergents, dry shampoo, leave-in treatments, waterless cleaning. Regulatory proposals emerging for water-use labeling in Mediterranean EU states.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 1 | 3 | 4 | 2 | 3 | 3 | 2 | 4 | 3 | 3 | 3 | 2 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 2 | 4 | 3 | 3 | 2 | 3 | 2 | 4 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 4 | 3 | 4 | 5 |

**Reasoning:** Formulation and Consumer VC steps — new formulation science for waterless/low-water products plus changing consumer behavior. Styling benefits (dry shampoo growth). LAD benefits from cold-wash Persil innovation. High Growth markets most affected (water scarcity severe in MENA, India, sub-Saharan Africa).

---

### E-03 | Carbon Border Adjustment and Scope 3 Reporting

| Field | Value |
|-------|-------|
| **Direction** | Contraction | **Impact** | 3 | **Probability** | 4 | **Relevance** | 60 |

**Description:** EU CBAM phases in 2026-2034, initially targeting energy-intensive materials. CSRD Scope 3 mandatory reporting creates cost pressure through supply chain. Chemical feedstocks, packaging, logistics all affected.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 2 | 2 | 2 | 2 | 3 | 3 | 2 | 3 | 2 | 2 | 2 | 3 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 4 | 2 | 4 | 3 | 4 | 1 | 1 | 0 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 5 | 2 | 3 | 3 |

**Reasoning:** Raw Materials, Manufacturing, and Supply Chain VC steps carry the carbon cost burden. LHC more exposed due to higher material intensity per SKU. CBAM phase-in is gradual.

---

### E-04 | EPR Fee Escalation and Eco-Modulation

| Field | Value |
|-------|-------|
| **Direction** | Contraction | **Impact** | 3 | **Probability** | 5 | **Relevance** | 70 |

**Description:** EPR fees across EU escalating with eco-modulation penalties (2-5x multiplier for hard-to-recycle packaging). France CITEO system is template. Multi-material packaging (common in Hair/LHC) incurs highest penalties.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 3 | 2 | 3 | 2 | 3 | 3 | 2 | 3 | 2 | 2 | 2 | 3 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 1 | 0 | 1 | 5 | 2 | 0 | 2 | 0 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 5 | 2 | 1 | 1 |

**Reasoning:** Packaging VC step takes the direct cost hit. Color sachets, Styling aerosols, LAD trigger sprays, IC concentrates have highest eco-modulation penalties. Europe-only.

---

### E-05 | Climate-Driven Pest Pattern Shifts (Insecticide Demand)

| Field | Value |
|-------|-------|
| **Direction** | Expansion | **Impact** | 2 | **Probability** | 4 | **Relevance** | 45 |

**Description:** Climate warming expands the geographic range of disease-carrying insects (tiger mosquitoes now established in Southern Germany/France). Longer warm seasons increase insecticide demand windows. Pest control becoming year-round in previously seasonal markets.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 0 | 0 | 0 | 0 | 0 | 0 | 5 | 0 | 0 | 0 | 0 | 0 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 3 | 3 | 2 | 1 | 1 | 3 | 3 | 4 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 4 | 3 | 4 | 5 |

**Reasoning:** Highly concentrated in FFI (Fly & Insecticide) category. Consumer demand expansion through geographic and seasonal extension. High Growth markets (tropical/subtropical) have highest pest exposure. Formulation needs (new active ingredients) and Marketing (awareness campaigns) are key VC steps.

---

## FORCE 5: COMPETITIVE (6 Trends)

### X-01 | Reckitt Essential Home Divestiture

| Field | Value |
|-------|-------|
| **Direction** | Expansion | **Impact** | 4 | **Probability** | 4 | **Relevance** | 80 |

**Description:** Reckitt divesting Essential Home portfolio. Creates competitive restructuring in LHC landscape. PE acquisition likely = cost-cutting, brand neglect = share opportunity for Henkel. Divested brands overlap with Henkel LHC in key European and EM markets.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 0 | 0 | 0 | 0 | 4 | 3 | 3 | 4 | 3 | 3 | 4 | 3 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 0 | 1 | 1 | 0 | 1 | 4 | 5 | 4 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 5 | 3 | 2 | 4 |

**Reasoning:** Commercial and Marketing VC steps — shelf space capture, share gain during transition. Consumer switching opportunity. Europe and High Growth (Reckitt has strong EM presence in cleaning). LHC only — Reckitt has no meaningful Hair portfolio.

---

### X-02 | Unilever's Beauty & Wellbeing Pivot

| Field | Value |
|-------|-------|
| **Direction** | Contraction | **Impact** | 4 | **Probability** | 5 | **Relevance** | 85 |

**Description:** Unilever targeting 66% revenue from Beauty & Wellbeing/Personal Care by 2030 (from ~50%). €50.5B revenue, massive media/R&D budgets. Doubling down on exactly the categories where Henkel Hair competes. Dove, TRESemmé, and new premium acquisitions intensify competition.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 3 | 5 | 3 | 4 | 1 | 1 | 0 | 1 | 0 | 0 | 0 | 0 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 1 | 3 | 1 | 1 | 1 | 5 | 5 | 4 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 5 | 5 | 5 | 5 |

**Reasoning:** Marketing and Commercial VC steps — direct competition for media share-of-voice, shelf space, and innovation credibility. Care most exposed (Dove is the world's largest hair care brand). Global threat across all regions. Contraction through increased competitive intensity.

---

### X-03 | P&G Superiority Framework and Innovation Fortress

| Field | Value |
|-------|-------|
| **Direction** | Contraction | **Impact** | 3 | **Probability** | 5 | **Relevance** | 75 |

**Description:** P&G's "irresistible superiority" framework drives disproportionate R&D and media investment. Increasing AI-driven formulation investment. In Hair (Pantene, H&S) and LHC (Ariel, Fairy), P&G sets the category innovation bar.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 2 | 3 | 2 | 2 | 4 | 3 | 3 | 4 | 3 | 4 | 2 | 2 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 1 | 4 | 2 | 2 | 1 | 5 | 4 | 3 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 5 | 5 | 4 | 4 |

**Reasoning:** Formulation (innovation arms race) and Marketing (media spend escalation) VC steps impacted. LAD most exposed (Persil vs. Ariel is the defining competitive battle in European laundry). Global threat.

---

### X-04 | DTC and Indie Brand Disruption in Hair

| Field | Value |
|-------|-------|
| **Direction** | Contraction | **Impact** | 3 | **Probability** | 4 | **Relevance** | 70 |

**Description:** Function of Beauty (personalization), Olaplex (bond repair), K18 (salon-grade), Virtue Labs (biotech) capture fastest-growing Hair sub-segments. Collectively erode the premiumization growth that legacy brands need.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 3 | 5 | 3 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 1 | 3 | 0 | 2 | 1 | 4 | 3 | 5 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 4 | 5 | 3 | 2 |

**Reasoning:** Consumer switching (Consumer VC step) and Marketing (competing for digital share of voice) are primary impacts. NA leads (DTC ecosystem most mature). Care is primary battleground — treatment products are where indie brands concentrate.

---

### X-05 | Chinese FMCG Brands Enter European Market

| Field | Value |
|-------|-------|
| **Direction** | Contraction | **Impact** | 2 | **Probability** | 3 | **Relevance** | 55 |

**Description:** Florasis, Perfect Diary, and Chinese home care brands entering Europe via TikTok Shop and Temu. Extreme value positioning, digital-native marketing. Threat currently small but trajectory mirrors Shein disruption of fast fashion.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 2 | 2 | 2 | 3 | 2 | 1 | 1 | 2 | 1 | 1 | 1 | 0 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 0 | 1 | 0 | 0 | 0 | 3 | 3 | 4 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 4 | 3 | 2 | 3 |

**Reasoning:** Early-warning signal. Marketing/Commercial/Consumer VC steps — digital channel competition. Europe is the primary target market for Chinese brand expansion. Body most exposed (Chinese beauty strongest in body/skin care).

---

### X-06 | Emerging Markets Growth Divergence — IMEA Leads

| Field | Value |
|-------|-------|
| **Direction** | Expansion | **Impact** | 3 | **Probability** | 4 | **Relevance** | 70 |

**Description:** Henkel IMEA delivered 12.1% organic growth in FY2025 vs. 0.9% group average. India, Middle East, Africa are structural growth drivers. Population growth, urbanization, rising middle class, and category penetration expansion create fundamentally different profit pool dynamics than mature markets. Henkel investing in India manufacturing (Kurkumbh site).

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 3 | 4 | 2 | 4 | 3 | 3 | 3 | 4 | 2 | 2 | 2 | 2 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 2 | 3 | 4 | 3 | 4 | 4 | 4 | 5 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 1 | 1 | 4 | 5 |

**Reasoning:** Consumer penetration expansion drives the entire VC from Manufacturing (local plants) through Commercial (distribution build-out) to Consumer (category adoption). Hair Care and Body lead in EM (rising personal care adoption). LAD benefits from urbanization (machine wash penetration). High Growth is the primary region; Asia co-benefits.

---

## FORCE 6: CUSTOMER (5 Trends)

### K-01 | Discount Retail Channel Expansion in Europe

| Field | Value |
|-------|-------|
| **Direction** | Contraction | **Impact** | 4 | **Probability** | 5 | **Relevance** | 85 |

**Description:** Aldi/Lidl hold 25-35% grocery share in Germany, UK, Benelux — still growing. Expanding beauty/personal care shelf space, upgrading store formats, launching premium PL. Every share point to discount = lower revenue per unit, less branded shelf space, less promotional flexibility.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 3 | 3 | 2 | 3 | 5 | 4 | 3 | 5 | 3 | 4 | 2 | 2 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 0 | 0 | 0 | 1 | 2 | 3 | 5 | 5 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 5 | 2 | 1 | 2 |

**Reasoning:** Commercial (trade terms, shelf negotiation) and Consumer (switching behavior) VC steps. LAD/FCN most exposed (high-frequency categories in discount channel). Europe is ground zero. Marketing impacted because discount channel offers fewer brand-building opportunities.

---

### K-02 | E-Commerce Profit Pool Maturation

| Field | Value |
|-------|-------|
| **Direction** | Mixed | **Impact** | 3 | **Probability** | 4 | **Relevance** | 65 |

**Description:** FMCG e-commerce stabilized at 12-15% in Western Europe. "Pay to play" economics (retail media + fulfillment costs) converging with offline margins. Amazon Subscribe & Save capturing habitual replenishment for household products. Subscription model locks consumers into brands but compresses margins.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 3 | 3 | 3 | 3 | 2 | 2 | 2 | 3 | 2 | 2 | 1 | 1 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 0 | 0 | 0 | 2 | 3 | 4 | 4 | 4 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 4 | 5 | 5 | 2 |

**Reasoning:** Marketing (retail media spend), Commercial (Amazon trade terms), and Consumer (subscription lock-in) VC steps. Hair has higher e-com relevance (beauty online). LHC has subscription potential (replenishment model). Asia co-leads with NA in e-commerce penetration.

---

### K-03 | Retailer Consolidation and Power Concentration

| Field | Value |
|-------|-------|
| **Direction** | Contraction | **Impact** | 3 | **Probability** | 4 | **Relevance** | 70 |

**Description:** Top 10 European grocers control 40-50% of sales. Schwarz Group, Aldi, Carrefour, Tesco wield increasing negotiating power. Manifests as: tougher annual negotiations, rising listing fees, promotional contribution demands, preferential PL shelf placement.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 3 | 3 | 2 | 3 | 4 | 4 | 3 | 4 | 3 | 3 | 2 | 2 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 0 | 0 | 0 | 0 | 1 | 2 | 5 | 3 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 5 | 3 | 2 | 2 |

**Reasoning:** Commercial VC step is the primary impact — trade negotiations, listing fees, promotional budgets. Structural shift of margin from manufacturer to retailer. LHC most exposed (commoditized, highest volume). Europe is the epicenter of grocery consolidation.

---

### K-04 | Social Commerce and TikTok Shop Emergence

| Field | Value |
|-------|-------|
| **Direction** | Mixed | **Impact** | 2 | **Probability** | 3 | **Relevance** | 55 |

**Description:** TikTok Shop, Instagram Shopping creating channels bypassing traditional retail. Beauty/personal care is #1 TikTok Shop category. Viral products generate €10M+ in weeks. Favors digitally-native brands over traditional FMCG.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 3 | 4 | 4 | 3 | 1 | 1 | 0 | 1 | 0 | 0 | 0 | 0 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 0 | 0 | 0 | 1 | 2 | 5 | 4 | 5 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 3 | 4 | 5 | 3 |

**Reasoning:** Marketing (social-first content creation) and Consumer (discovery-driven purchase) VC steps. Hair is the primary arena — got2b and Schwarzkopf have social-friendly assets. Asia leads (TikTok Shop most mature in Southeast Asia/China). LHC minimal social commerce relevance.

---

### K-05 | Quick Commerce Consolidation and FMCG Integration

| Field | Value |
|-------|-------|
| **Direction** | Mixed | **Impact** | 2 | **Probability** | 3 | **Relevance** | 50 |

**Description:** European quick commerce market at ~$64B in 2026 after major consolidation (Getir exited Germany/UK/Netherlands, Gorillas closed). Surviving players (Flink, Deliveroo, Uber Eats grocery) integrating with traditional retail. Groceries represent 44% of quick commerce. Model shifting from pure-play to retail-integrated.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 1 | 2 | 1 | 2 | 2 | 2 | 1 | 3 | 2 | 2 | 1 | 0 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 0 | 0 | 0 | 1 | 3 | 2 | 4 | 4 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 4 | 3 | 4 | 2 |

**Reasoning:** Commercial (another channel to manage, listing dynamics) and Supply Chain (micro-fulfillment requirements) VC steps. LAD most relevant (household replenishment = q-commerce use case). Lower impact due to consolidation reducing the channel's disruptive force. Urban-concentrated.

---

## CROSS-FORCE STRUCTURAL TRENDS (5 Trends)

These trends span multiple forces but are classified by their primary driver.

### S-01 | Supply Chain Nearshoring and Geopolitical Diversification

| Field | Value |
|-------|-------|
| **Force** | Environmental | **Direction** | Mixed | **Impact** | 3 | **Probability** | 4 | **Relevance** | 65 |

**Description:** Post-COVID and geopolitical tension (US-China decoupling, Red Sea disruption, Ukraine conflict) are driving FMCG supply chain diversification. Nearshoring of chemical production from Asia to Europe/Turkey. Dual-sourcing mandates increasing. Short-term cost increase (new supplier qualification, higher unit costs) but long-term resilience reduces tail risk. Henkel's global supply chain spans 30+ countries.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 3 | 3 | 3 | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 2 | 3 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 4 | 1 | 3 | 2 | 5 | 0 | 1 | 0 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 4 | 4 | 5 | 4 |

**Reasoning:** Supply Chain is the primary VC step — restructuring sourcing networks, qualifying new suppliers, building inventory buffers. Raw Materials impacted through supplier diversification. Manufacturing impacted through nearshoring production. Universal category exposure. Asia most impacted as primary sourcing origin being diversified away from.

---

### S-02 | Fragrance and Sensory Premiumization in Home Care

| Field | Value |
|-------|-------|
| **Force** | Consumer | **Direction** | Expansion | **Impact** | 3 | **Probability** | 4 | **Relevance** | 70 |

**Description:** Luxury fragrance is entering mainstream home care — consumers treating laundry products and home cleaners as sensory experiences. "Laundry perfume" products growing at 15%+ in Southern Europe and Asia. Instagram/TikTok content around "clean home aesthetic" drives aspirational cleaning product usage. This creates a premiumization path for LHC categories that historically lacked pricing power.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 0 | 0 | 0 | 1 | 4 | 5 | 0 | 5 | 3 | 2 | 3 | 1 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 4 | 5 | 2 | 4 | 1 | 5 | 3 | 5 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 4 | 3 | 5 | 3 |

**Reasoning:** One of the few LHC Expansion trends — critical for the "defend through innovation" strategy. Formulation (fragrance chemistry) and Raw Materials (premium fragrance oils) are key VC steps. Packaging must convey premium (visual design, materials). Marketing is essential (sensory brand building). FCA and LAD most exposed. Asia leads (Korean/Japanese laundry fragrance culture).

---

### S-03 | AI-Powered Personalization at Scale

| Field | Value |
|-------|-------|
| **Force** | Technology | **Direction** | Expansion | **Impact** | 3 | **Probability** | 3 | **Relevance** | 60 |

**Description:** AI-enabled personalization moving from DTC niche (Function of Beauty) toward mass-market feasibility. AI skin/hair diagnostics, customized formulations, and adaptive product recommendations. L'Oreal's AI beauty tech (Modiface acquisition) is the benchmark. Henkel exploring via Schwarzkopf Professional digital tools. Still nascent but trajectory is clear.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 4 | 4 | 3 | 3 | 1 | 1 | 0 | 1 | 0 | 0 | 0 | 0 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 1 | 4 | 3 | 2 | 1 | 4 | 3 | 5 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 3 | 5 | 5 | 1 |

**Reasoning:** Consumer (diagnostic + recommendation) and Formulation (customized product) VC steps. Marketing (data-driven targeting). Color benefits strongly (shade matching is a natural AI use case). Hair categories primary; LHC has limited personalization potential. NA and Asia lead in tech adoption.

---

### S-04 | L'Oreal's Tech-Beauty Platform Strategy

| Field | Value |
|-------|-------|
| **Force** | Competitive | **Direction** | Contraction | **Impact** | 3 | **Probability** | 5 | **Relevance** | 70 |

**Description:** L'Oreal is building a "beauty tech" platform combining AI diagnostics (Modiface), microbiome science, custom formulations, and digital try-on across its portfolio. With €43B revenue and 4% R&D spend (€1.7B), L'Oreal's innovation investment dwarfs Henkel's Hair R&D budget. L'Oreal is redefining what "innovation" means in Hair — from chemistry advancement to tech-beauty convergence. This raises the competitive bar for Schwarzkopf.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 5 | 4 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 1 | 4 | 1 | 1 | 0 | 5 | 4 | 4 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 5 | 5 | 5 | 3 |

**Reasoning:** L'Oreal is the most important competitive threat in Hair after Unilever. Color most exposed (L'Oreal is the global color leader). Formulation and Marketing VC steps — innovation arms race and media investment. Global threat. The difference vs. X-02 (Unilever): L'Oreal competes on tech-innovation superiority, Unilever competes on brand-scale superiority. Henkel must match both.

---

### S-05 | FMCG Subscription and Loyalty Ecosystem Lock-in

| Field | Value |
|-------|-------|
| **Force** | Customer | **Direction** | Mixed | **Impact** | 2 | **Probability** | 4 | **Relevance** | 55 |

**Description:** Amazon Subscribe & Save, retailer loyalty programs (Tesco Clubcard, Lidl Plus), and brand-owned subscription models are creating switching-cost barriers in FMCG — a category historically defined by low switching costs. Subscription models lock consumers into replenishment cycles, reducing brand-switching opportunities. For incumbents this is positive (customer retention); for challengers it's negative (harder to gain trial).

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 2 | 2 | 1 | 2 | 3 | 3 | 1 | 4 | 2 | 3 | 1 | 1 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 0 | 0 | 0 | 1 | 2 | 3 | 4 | 5 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 4 | 5 | 3 | 1 |

**Reasoning:** Consumer (habit lock-in) and Commercial (subscription channel management) VC steps. LAD most relevant (highest replenishment frequency). Mixed because Henkel brands with strong positions benefit from lock-in, but brands trying to gain share in new segments face higher barriers. NA leads (Amazon S&S most mature).

---

### S-06 | Hair Loss and Thinning Treatments Enter Consumer Mainstream

| Field | Value |
|-------|-------|
| **Force** | Consumer | **Direction** | Expansion | **Impact** | 3 | **Probability** | 4 | **Relevance** | 75 |

**Description:** The global hair loss treatment products market: $2.93B in 2025, growing to $4.26B by 2030 at 7.77% CAGR. Minoxidil market alone: $6.6B in 2025. OTC availability expanding, destigmatization accelerating (especially among Gen Z men), and e-commerce making treatment discreet and accessible. 80 million Americans affected by hereditary hair loss. This creates a new adjacency for Hair Care brands to capture — clinical-grade treatment products at consumer price points.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 1 | 5 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 3 | 5 | 2 | 2 | 1 | 5 | 4 | 5 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 4 | 5 | 5 | 3 |

**Reasoning:** Care is the sole high-exposure category — hair loss treatment is a Care sub-segment. Formulation is the critical VC step (active ingredients: minoxidil, biotin, caffeine, peptides). Marketing is essential for destigmatization and claims substantiation. White space for Schwarzkopf — professional credibility maps directly to "clinical-grade" positioning. NA and Asia lead in consumer adoption.

---

### S-07 | Gen Z "Dupe Culture" and Ingredient Literacy

| Field | Value |
|-------|-------|
| **Force** | Consumer | **Direction** | Contraction | **Impact** | 3 | **Probability** | 5 | **Relevance** | 70 |

**Description:** 32% of consumers now actively seek high-quality dupes over branded products. Gen Z has unprecedented ingredient literacy — they decode INCI lists on TikTok, compare formulations across price tiers, and reject brand premium that isn't backed by demonstrable ingredient superiority. "Dupe culture" threatens the brand premium at the core of FMCG profitability. Minimalist routines (3-5 steps replacing 10-step) reduce category consumption occasions.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 3 | 4 | 4 | 4 | 2 | 2 | 0 | 2 | 1 | 1 | 1 | 0 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 1 | 3 | 0 | 2 | 0 | 5 | 3 | 5 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 4 | 5 | 4 | 2 |

**Reasoning:** Marketing is the most impacted VC step — traditional brand-building is less effective when consumers compare ingredient lists and choose dupes. Consumer behavior fundamentally shifts from "brand trust" to "ingredient verification." Hair categories are most exposed (beauty is the #1 dupe category). Contraction because it compresses the brand premium that funds profit pools. For Henkel, the counter-strategy is formulation transparency and ingredient storytelling — Schwarzkopf's R&D depth becomes the defense.

---

### S-08 | Connected Appliances and Auto-Dosing Transform Detergent Economics

| Field | Value |
|-------|-------|
| **Force** | Technology | **Direction** | Mixed | **Impact** | 3 | **Probability** | 3 | **Relevance** | 75 |

**Description:** 62% of newly launched smart washers include auto-dosing, cutting detergent waste by 23% per cycle. Smart washing machine market: $24B in 2025, growing at 17.3% CAGR. Henkel launched "Smartwash" in 2025 — individual active ingredients dispensed separately, with the machine tailoring the formula per load. Bosch i-Dos saves 38% detergent per wash. This fundamentally changes detergent economics: per-load consumption drops but per-load value can increase if brands control the dosing system.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 0 | 0 | 0 | 0 | 3 | 4 | 0 | 5 | 2 | 4 | 0 | 0 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 2 | 5 | 4 | 4 | 2 | 3 | 4 | 4 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 5 | 4 | 4 | 1 |

**Reasoning:** LAD and ADW are the primary categories (machine-dosing applies to laundry and dishwashing). Formulation VC step is transformed (individual active ingredients rather than all-in-one). Manufacturing and Packaging fundamentally change (cartridge/pod/refill systems for smart machines). Commercial changes (appliance manufacturer becomes a channel partner, not just a retailer). Mixed direction: volume per load drops 23-38% (Contraction) BUT Henkel Smartwash positions them as the system integrator, capturing disproportionate value if they lock in the dosing platform (Expansion). First-mover advantage is critical — this is Henkel's most differentiated LHC play.

---

### S-09 | Post-COVID Hygiene Habits Persistence in Home Care

| Field | Value |
|-------|-------|
| **Force** | Consumer | **Direction** | Expansion | **Impact** | 2 | **Probability** | 4 | **Relevance** | 60 |

**Description:** Surface disinfectant market: $8.1B in 2025, growing at 7.8% CAGR. Hand sanitizer: $6.1B in 2026, 5.9% CAGR. Post-COVID, elevated hygiene consciousness has persisted — households incorporate surface disinfection into daily routines, not just during illness. Professional cleaning standards have permanently ratcheted upward. The "new normal" baseline for cleaning frequency is 20-30% above pre-COVID levels.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 0 | 0 | 0 | 1 | 3 | 2 | 0 | 1 | 4 | 1 | 5 | 4 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 2 | 3 | 2 | 2 | 1 | 3 | 2 | 5 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 4 | 4 | 4 | 3 |

**Reasoning:** HSC (hard surface cleaners) and IC (industrial cleaners) are primary beneficiaries — elevated cleaning frequency directly grows usage occasions. HDW (hand dish wash) benefits from hand hygiene persistence. Consumer VC step is the driver (behavioral change). Formulation benefits from demand for anti-bacterial/anti-viral claims. Expansion because it increases the frequency of purchase occasions in categories that were previously declining pre-COVID.

---

### S-10 | Professional Salon Channel to Consumer Crossover

| Field | Value |
|-------|-------|
| **Force** | Customer | **Direction** | Expansion | **Impact** | 3 | **Probability** | 4 | **Relevance** | 80 |

**Description:** Professional hair care market: $23.4B in 2025, projected to $38.3B by 2036 at 4.6% CAGR. The salon-to-retail crossover is accelerating — professional brands (including Schwarzkopf Professional) are expanding DTC and retail distribution. Ulta Beauty's largest-ever hair care exclusive launch in April 2025 demonstrates the channel's appetite. B2B channel holds 40% of market but B2C now at 63% of industry share. This is Schwarzkopf Professional's defining strategic moment.

**Category Exposure:**
| Color | Care | Styling | Body | FCN | FCA | FFI | LAD | HDW | ADW | HSC | IC |
|:-----:|:----:|:-------:|:----:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|
| 5 | 5 | 4 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

**Value Chain Exposure:**
| Raw Mat. | Formulation | Manufacturing | Packaging | Supply Chain | Marketing | Commercial | Consumer |
|:--------:|:-----------:|:-------------:|:---------:|:------------:|:---------:|:----------:|:--------:|
| 2 | 3 | 2 | 3 | 3 | 5 | 5 | 5 |

**Regional Exposure:**
| Europe | North America | Asia | High Growth |
|:------:|:-------------:|:----:|:----------:|
| 4 | 5 | 4 | 2 |

**Reasoning:** Commercial (channel expansion — new retail/DTC partnerships), Marketing (salon credibility as brand asset in consumer channel), and Consumer (professional-grade results at home) are the key VC steps. Color and Care are the primary categories — professional color at home is the largest untapped Hair profit pool. This is Henkel's most unique asset: Schwarzkopf Professional's salon relationships and technical expertise, deployed into the consumer channel. Expansion because it opens a new profit pool that is additive to existing consumer Hair sales. NA leads (Ulta/Sephora ecosystem).

---

## CONSOLIDATED SCORING MATRIX

### Top 20 Trends by Weighted Score (Impact x Probability x Relevance/100)

| Rank | ID | Trend | Force | Dir. | Imp. | Prob. | Rel. | W.Score |
|:----:|:--:|-------|-------|:----:|:----:|:-----:|:----:|:-------:|
| 1 | C-01 | Private Label 40% Europe | Consumer | Contr. | 5 | 5 | 95 | 23.75 |
| 2 | G-01 | EU PFAS Restriction | Government | Contr. | 5 | 4 | 90 | 18.00 |
| 3 | C-03 | Hair Premiumization | Consumer | Exp. | 4 | 5 | 90 | 18.00 |
| 4 | G-02 | Microplastics Phase 2 | Government | Contr. | 4 | 5 | 85 | 17.00 |
| 5 | X-02 | Unilever Beauty Pivot | Competitive | Contr. | 4 | 5 | 85 | 17.00 |
| 6 | K-01 | Discount Retail Expansion | Customer | Contr. | 4 | 5 | 85 | 17.00 |
| 7 | E-01 | Palm Oil B50 Supply Shock | Environmental | Contr. | 4 | 4 | 85 | 13.60 |
| 8 | C-06 | Cost-of-Living Squeeze | Consumer | Contr. | 4 | 4 | 80 | 12.80 |
| 9 | G-03 | Cosmetics Omnibus VII/VIII | Government | Contr. | 4 | 4 | 80 | 12.80 |
| 10 | X-01 | Reckitt Divestiture | Competitive | Exp. | 4 | 4 | 80 | 12.80 |
| 11 | T-01 | AI-Driven Formulation | Technology | Exp. | 4 | 4 | 80 | 12.80 |
| 12 | G-04 | EU PPWR Packaging | Government | Contr. | 3 | 5 | 75 | 11.25 |
| 13 | X-03 | P&G Superiority Framework | Competitive | Contr. | 3 | 5 | 75 | 11.25 |
| 14 | G-05 | Green Claims / EmpCo | Government | Contr. | 3 | 5 | 75 | 11.25 |
| 15 | S-04 | L'Oreal Tech-Beauty Platform | Competitive | Contr. | 3 | 5 | 70 | 10.50 |
| 16 | T-02 | Bio-Based Chemistry | Technology | Exp. | 4 | 3 | 85 | 10.20 |
| 17 | E-04 | EPR Fee Eco-Modulation | Environmental | Contr. | 3 | 5 | 70 | 10.50 |
| 18 | C-07 | Scalp Care Emergence | Consumer | Exp. | 3 | 4 | 80 | 9.60 |
| 19 | S-02 | Fragrance Premiumization LHC | Consumer | Exp. | 3 | 4 | 70 | 8.40 |
| 20 | X-06 | EM Growth Divergence (IMEA) | Competitive | Exp. | 3 | 4 | 70 | 8.40 |

### Force Balance

| Force | Trends | Expansion | Mixed | Contraction | Dominant Dynamic |
|-------|:------:|:---------:|:-----:|:-----------:|-----------------|
| Consumer | 12 | 6 | 3 | 3 | PL compression + dupe culture vs. premiumization + scalp care + hair loss + fragrance |
| Government | 7 | 0 | 0 | 7 | Unprecedented regulatory cascade across entire portfolio |
| Technology | 8 | 5 | 2 | 0 | Innovation offsets regulatory costs — Smartwash is the LHC differentiator |
| Environmental | 6 | 1 | 2 | 3 | Supply chain cost inflation, geopolitical diversification |
| Competitive | 7 | 2 | 0 | 5 | Intensifying from all directions; Reckitt exit is the one bright spot |
| Customer | 7 | 1 | 4 | 2 | Channel power shifting; salon crossover is the Hair opportunity |
| **Total** | **47** | **15** | **10** | **22** | **Net Contraction — offset requires strategic action** |

*Note: S-trends classified by primary force — S-01 (Nearshoring) → Environmental; S-02 (Fragrance) → Consumer; S-03 (Personalization) → Technology; S-04 (L'Oreal) → Competitive; S-05 (Subscription) → Customer; S-06 (Hair Loss) → Consumer; S-07 (Gen Z Dupes) → Consumer; S-08 (Smartwash) → Technology; S-09 (Hygiene Persistence) → Consumer; S-10 (Salon Crossover) → Customer.*

### Value Chain Impact Heatmap (aggregated across all 42 trends)

| VC Step | Avg Exposure | Top Contributing Trends |
|---------|:----------:|------------------------|
| **Formulation** | 2.7 | G-01, G-02, G-03, T-01, T-02 |
| **Marketing** | 2.6 | C-01, X-02, X-03, T-06, K-01 |
| **Consumer** | 2.5 | C-01, C-06, K-01, C-03, X-02 |
| **Commercial** | 2.4 | C-01, K-01, K-03, X-01, X-02 |
| **Packaging** | 2.1 | G-04, E-04, G-02, T-03 |
| **Raw Materials** | 2.0 | E-01, G-01, T-02, G-06 |
| **Supply Chain** | 1.8 | E-01, G-06, T-05, E-03 |
| **Manufacturing** | 1.7 | T-05, G-02, T-03, E-03 |

**Insight:** Formulation and Marketing are the two most impacted VC steps across all trends. Formulation carries the regulatory burden (reformulation cascade) while Marketing carries the competitive/channel burden (PL defense, media inflation, retail media shift). The strategic implication: Henkel's R&D and Marketing functions are the primary battlegrounds for profit pool defense and expansion.

### Regional Exposure Summary

| Region | Avg Exposure | Key Dynamics |
|--------|:----------:|-------------|
| **Europe** | 4.2 | Regulatory epicenter (all G-trends), PL/discount concentration, competitive intensity |
| **North America** | 3.2 | GLP-1 consumer shift, AI/tech leadership, e-commerce maturity, DTC disruption |
| **Asia** | 2.9 | Scalp care innovation lead (K-beauty), e-commerce maturity, palm oil sourcing origin |
| **High Growth** | 2.4 | Category penetration expansion (12.1% Henkel growth), water scarcity, palm oil origin |

---

## STRATEGIC IMPLICATIONS

### 1. Hair: Accelerate (Offense)
Convergence of C-03, C-07, C-08, T-04, and C-02 creates a structural tailwind. Schwarzkopf Professional heritage is a moat. Invest disproportionately while the pool expands — particularly in Care (highest margin) and Scalp Care (new pool).

### 2. LHC: Defend Through Innovation (Defense)
Five-front assault: C-01, K-01, G-01/G-02, E-01, K-03. Defense through price = death spiral. Defense through bio-based formulation (T-02), concentrated formats (T-03), manufacturing efficiency (T-05), and demonstrable superiority is the only path.

### 3. Regulatory Compliance as Competitive Advantage (Reframing)
G-01 through G-07 are unanimously Contraction — unless Henkel leads. AI formulation (T-01) + bio-based chemistry (T-02) = proactive reformulation = 18 months of superiority claims before competitors catch up. The investment frame should shift from "compliance cost" to "competitive moat."

### 4. Emerging Markets as Growth Engine (Portfolio Diversification)
X-06 shows IMEA growing at 12.1% while Europe stagnates. Portfolio diversification toward High Growth markets reduces concentration risk in the regulatory-heavy, PL-compressed European profit pool.

### 5. Value Chain Priority: Formulation + Marketing
These are the two most impacted VC steps. R&D budget (Formulation) and media budget (Marketing) are the primary levers for profit pool defense and expansion.

---

## APPENDIX: DATABASE IMPORT SPECIFICATION

Each of the 47 trends (C-01 to C-08, G-01 to G-07, T-01 to T-06, E-01 to E-05, X-01 to X-06, K-01 to K-05, S-01 to S-10) is structured for direct import using:

```
trends table: id, force, name, description, direction, impact, probability, confidence="Medium", ai_suggested=false, source_type="analyst_report"
trend_category_exposure table: trend_id, category (from CATEGORIES), exposure_score (0-5)
trend_vc_exposure table: trend_id, vc_step (from VC_STEPS), exposure_score (0-5)
trend_regional_exposure table: trend_id, region (from REGIONS), exposure_score (0-5)
```

**Unique IDs:** Use `{force_initial}_{sequential}` format — e.g., `consumer_r01`, `government_r01`, etc. (prefix `r` to distinguish from V12-sourced trends).

**Recommended import sequence:** Load all 42 trends → run deterministic simulation to establish baseline → run Bayesian MC to generate shift distributions → present Shift Matrix to Delphi panel for calibration scoring.

---

*Report Version: 2.0 — March 28, 2026*
*Sources: ECHA regulatory filings, Henkel FY2025 annual report (March 2026), NIQ European Private Label Monitor, P&G/Unilever/Reckitt public filings and earnings calls, Euromonitor category data, McKinsey/BCG European consumer sentiment surveys, GDELT/GNews media analysis, CosmeticsDesign-Europe, RetailDive, GroceryDive, ChemicalWatch, BeautyMatter, Grand View Research, Fortune Business Insights, Mayer Brown/CMS Law regulatory analysis, Deloitte Manufacturing Outlook 2026.*
*All scores represent analyst assessment as of March 2026. No company-confidential financial data was used.*
