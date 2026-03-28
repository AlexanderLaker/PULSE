#!/usr/bin/env python3
"""Import 47 trends from the PULSE Trend Intelligence Report (March 2026) into the database.

Usage:
    python scripts/import_report_trends.py

Each trend maps to the exact PULSE data model:
- trends table: id, force, name, description, direction, impact, probability
- trend_category_exposure: 12 HCB categories (0-5)
- trend_vc_exposure: 8 value chain steps (0-5)
- trend_regional_exposure: 4 regions (0-5)
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pulse.ingestion.models import Trend
from pulse.database import save_trends, init_db
from pulse.config import CATEGORIES, VC_STEPS, REGIONS

# ── Helper to build category/vc/region dicts from ordered lists ──────
CAT_KEYS = list(CATEGORIES)  # 12 categories in order
VC_KEYS = list(VC_STEPS)     # 8 VC steps in order
REG_KEYS = list(REGIONS)     # 4 regions in order

def cat(color, care, styling, body, fcn, fca, ffi, lad, hdw, adw, hsc, ic):
    return dict(zip(CAT_KEYS, [color, care, styling, body, fcn, fca, ffi, lad, hdw, adw, hsc, ic]))

def vc(raw, form, mfg, pkg, sc, mkt, comm, cons):
    return dict(zip(VC_KEYS, [raw, form, mfg, pkg, sc, mkt, comm, cons]))

def reg(eu, na, asia, hg):
    return dict(zip(REG_KEYS, [eu, na, asia, hg]))


# ═══════════════════════════════════════════════════════════════════════
# FORCE 1: CONSUMER (12 trends incl. S-02, S-06, S-07, S-09)
# ═══════════════════════════════════════════════════════════════════════

TRENDS = [
    # ── C-01 ──
    Trend(
        id="consumer_r01", force="Consumer", sub_category="Market Structure",
        name="Private Label Structural Penetration in Europe",
        description="Private label crossed 40% market share in European FMCG (€291B, NIQ 2025). Structural, not cyclical — retailer brands invested in quality, packaging, and premium tiers. In Germany/Benelux, PL laundry share exceeds 45%. Branded-to-PL price gap narrowed to 15-20%.",
        direction="Contraction", impact=5, probability=5, start_year=2025,
        strategic_implication="Defend through demonstrable superiority, not price. Invest in innovation that justifies the premium gap.",
        category_exposure=cat(3,3,2,3, 5,5,4,5,4,4,3,4),
        vc_exposure=vc(1,1,1,1,1,4,5,5),
        regional_exposure=reg(5,3,2,2),
        data_source="NIQ European Private Label Monitor 2025", source_type="analyst_report",
        confidence="High",
    ),
    # ── C-02 ──
    Trend(
        id="consumer_r02", force="Consumer", sub_category="Behavioral",
        name="GLP-1 Drugs Reshape Consumer Spending Patterns",
        description="12.4% of US adults on GLP-1 receptor agonists. Consumer spending data shows reduced impulse purchasing but increased premium self-care investment. European adoption 18-24 months behind US but accelerating.",
        direction="Expansion", impact=3, probability=4, start_year=2025,
        strategic_implication="Position Hair premium portfolio for the self-care spending reallocation. Monitor LHC basket size impact.",
        category_exposure=cat(2,3,2,3, 1,1,0,2,0,0,0,0),
        vc_exposure=vc(0,1,0,0,0,3,2,4),
        regional_exposure=reg(3,5,2,1),
        data_source="McKinsey Consumer Health Survey 2025", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── C-03 ──
    Trend(
        id="consumer_r03", force="Consumer", sub_category="Premiumization",
        name="Premiumization Acceleration in Hair Care",
        description="Global premium hair care growing at 2-3x mass market rate. Skinification logic applied to hair — ingredient-conscious, multi-step routines, professional-grade at home. Henkel Hair grew +3.2% organic FY2025.",
        direction="Expansion", impact=4, probability=5, start_year=2024,
        strategic_implication="Invest disproportionately in Schwarzkopf premiumization. Salon-to-retail crossover is the fastest white space.",
        category_exposure=cat(4,5,4,3, 0,0,0,0,0,0,0,0),
        vc_exposure=vc(3,5,3,4,2,5,4,5),
        regional_exposure=reg(5,5,4,3),
        data_source="Henkel FY2025 Annual Report; Euromonitor Hair Care 2025", source_type="analyst_report",
        confidence="High",
    ),
    # ── C-04 ──
    Trend(
        id="consumer_r04", force="Consumer", sub_category="Behavioral",
        name="Conscious Consumption and Cleanical Beauty",
        description="Consumers simultaneously demand clean (no harmful chemicals) and clinical (proven efficacy). Cleanical convergence requires reformulation investment but rewards brands delivering both. Reinforced by EU Green Claims Directive.",
        direction="Expansion", impact=3, probability=4, start_year=2025,
        strategic_implication="Lead on formulation transparency and ingredient storytelling. Use Schwarzkopf R&D depth as credibility anchor.",
        category_exposure=cat(3,4,2,4, 3,3,2,2,2,2,1,1),
        vc_exposure=vc(4,5,2,3,2,4,3,5),
        regional_exposure=reg(5,4,3,2),
        data_source="CosmeticsDesign-Europe; BCG Consumer Sentiment 2025", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── C-05 ──
    Trend(
        id="consumer_r05", force="Consumer", sub_category="Demographics",
        name="Silver Economy — Aging Population Shifts Category Demand",
        description="Europe 65+ population exceeds 25% by 2030. Gray coverage is the #1 CEP in hair color. Aging consumers need gentler formulations, ease-of-use packaging, different cleaning patterns.",
        direction="Expansion", impact=3, probability=5, start_year=2025,
        strategic_implication="Strengthen Color portfolio around gray coverage CEP. Adapt packaging for ease of use.",
        category_exposure=cat(5,3,1,2, 2,2,1,2,2,1,1,1),
        vc_exposure=vc(1,3,1,3,1,4,3,5),
        regional_exposure=reg(5,4,4,2),
        data_source="Eurostat Demographic Projections 2025", source_type="analyst_report",
        confidence="High",
    ),
    # ── C-06 ──
    Trend(
        id="consumer_r06", force="Consumer", sub_category="Macroeconomic",
        name="Cost-of-Living Squeeze and Persistent Trading Down",
        description="70%+ of European consumers continue trading down on everyday essentials. ECB mortgage resets shave up to 1pp off consumption growth through 2030. Structural affordability squeeze beyond inflation.",
        direction="Contraction", impact=4, probability=4, start_year=2024,
        strategic_implication="Protect price-value perception. Avoid pure price defense — innovate in value formats (concentrated, refill).",
        category_exposure=cat(3,3,3,3, 4,4,3,5,3,3,2,2),
        vc_exposure=vc(1,1,1,2,1,4,5,5),
        regional_exposure=reg(5,3,2,4),
        data_source="BCG/McKinsey European Consumer Surveys 2026", source_type="analyst_report",
        confidence="High",
    ),
    # ── C-07 ──
    Trend(
        id="consumer_r07", force="Consumer", sub_category="Category Creation",
        name="Scalp Care Emerges as Standalone Category",
        description="Fastest-growing Hair sub-segment. Scalp health growing at 2x prestige hair care rate. Google searches for scalp+microbiome up 120%. Hair-and-scalp market projected $175.8B by 2032.",
        direction="Expansion", impact=3, probability=4, start_year=2025,
        strategic_implication="Launch Schwarzkopf scalp care line leveraging professional expertise. New profit pool, not cannibalization.",
        category_exposure=cat(2,5,1,2, 0,0,0,0,0,0,0,0),
        vc_exposure=vc(3,5,2,3,1,5,4,5),
        regional_exposure=reg(4,5,5,2),
        data_source="Grand View Research; Spate Trend Data 2025", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── C-08 ──
    Trend(
        id="consumer_r08", force="Consumer", sub_category="Demographics",
        name="Male Grooming Structural Growth",
        description="European male grooming market: $23.6B in 2025, growing at 7.65% CAGR. Germany projected $5.3B by 2026. Under-penetrated in Hair relative to female segments.",
        direction="Expansion", impact=3, probability=4, start_year=2025,
        strategic_implication="Expand got2b male positioning. Develop male-specific Care and Styling lines.",
        category_exposure=cat(2,3,4,4, 0,0,0,0,0,0,0,0),
        vc_exposure=vc(2,3,2,3,1,5,4,5),
        regional_exposure=reg(5,4,4,3),
        data_source="Statista Consumer Market Outlook 2026", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── S-02 (Consumer) ──
    Trend(
        id="consumer_r09", force="Consumer", sub_category="Premiumization",
        name="Fragrance and Sensory Premiumization in Home Care",
        description="Luxury fragrance entering mainstream home care. Laundry perfume products growing 15%+ in Southern Europe and Asia. Creates a premiumization path for LHC categories that historically lacked pricing power.",
        direction="Expansion", impact=3, probability=4, start_year=2025,
        strategic_implication="Invest in fragrance chemistry for Persil and Vernel. Premium sensory experience justifies branded price premium vs PL.",
        category_exposure=cat(0,0,0,1, 4,5,0,5,3,2,3,1),
        vc_exposure=vc(4,5,2,4,1,5,3,5),
        regional_exposure=reg(4,3,5,3),
        data_source="Euromonitor Home Care 2025; Trade press analysis", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── S-06 (Consumer) ──
    Trend(
        id="consumer_r10", force="Consumer", sub_category="Category Creation",
        name="Hair Loss and Thinning Treatments Enter Consumer Mainstream",
        description="Hair loss treatment market: $2.93B in 2025, 7.77% CAGR. Minoxidil market $6.6B. OTC availability expanding, destigmatization accelerating. 80M Americans affected by hereditary hair loss.",
        direction="Expansion", impact=3, probability=4, start_year=2025,
        strategic_implication="Launch clinical-grade Schwarzkopf hair loss treatment line. Professional credibility maps to clinical positioning.",
        category_exposure=cat(1,5,1,1, 0,0,0,0,0,0,0,0),
        vc_exposure=vc(3,5,2,2,1,5,4,5),
        regional_exposure=reg(4,5,5,3),
        data_source="Fortune Business Insights; Mordor Intelligence 2025", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── S-07 (Consumer) ──
    Trend(
        id="consumer_r11", force="Consumer", sub_category="Behavioral",
        name="Gen Z Dupe Culture and Ingredient Literacy",
        description="32% of consumers actively seek high-quality dupes over branded products. Gen Z decodes INCI lists on TikTok, compares formulations across price tiers. Minimalist routines (3-5 steps) reduce consumption occasions.",
        direction="Contraction", impact=3, probability=5, start_year=2024,
        strategic_implication="Counter with formulation transparency and ingredient storytelling. Schwarzkopf R&D depth is the defense.",
        category_exposure=cat(3,4,4,4, 2,2,0,2,1,1,1,0),
        vc_exposure=vc(1,3,0,2,0,5,3,5),
        regional_exposure=reg(4,5,4,2),
        data_source="Attest Gen Z Beauty Report 2025; FMCG Gurus", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── S-09 (Consumer) ──
    Trend(
        id="consumer_r12", force="Consumer", sub_category="Behavioral",
        name="Post-COVID Hygiene Habits Persistence in Home Care",
        description="Surface disinfectant market: $8.1B in 2025, 7.8% CAGR. Elevated hygiene consciousness persists — daily surface disinfection routine. Baseline cleaning frequency 20-30% above pre-COVID.",
        direction="Expansion", impact=2, probability=4, start_year=2022,
        strategic_implication="Maintain hygiene product portfolio strength. Leverage elevated demand for HSC and IC categories.",
        category_exposure=cat(0,0,0,1, 3,2,0,1,4,1,5,4),
        vc_exposure=vc(2,3,2,2,1,3,2,5),
        regional_exposure=reg(4,4,4,3),
        data_source="Allied Market Research Surface Disinfectant 2025", source_type="analyst_report",
        confidence="Medium",
    ),

    # ═══════════════════════════════════════════════════════════════════
    # FORCE 2: GOVERNMENT (7 trends)
    # ═══════════════════════════════════════════════════════════════════

    # ── G-01 ──
    Trend(
        id="government_r01", force="Government", sub_category="Chemical Regulation",
        name="EU PFAS Universal Restriction",
        description="EU's proposed universal restriction on ~10,000 PFAS substances. ECHA received 5,642 consultation comments. Affects surface treatments, water-repellent coatings, stain resistance, industrial cleaning. Phased 2027-2030.",
        direction="Contraction", impact=5, probability=4, start_year=2027,
        strategic_implication="Proactive reformulation as competitive advantage. AI-driven formulation (T-01) reduces reformulation cost and time.",
        category_exposure=cat(2,2,3,2, 4,5,3,4,3,4,4,5),
        vc_exposure=vc(5,5,3,2,3,2,2,1),
        regional_exposure=reg(5,3,2,2),
        data_source="ECHA PFAS Restriction Proposal 2023; Regulatory tracking", source_type="analyst_report",
        confidence="High",
    ),
    # ── G-02 ──
    Trend(
        id="government_r02", force="Government", sub_category="Chemical Regulation",
        name="EU Microplastics Ban — Phase 2 Implementation",
        description="Phase 2 (2027-2029) targets leave-on cosmetics and detergent capsule coatings. PVA film in laundry/dishwasher pods under scrutiny. Bio-based alternatives technically immature at scale.",
        direction="Contraction", impact=4, probability=5, start_year=2027,
        strategic_implication="Accelerate bio-based capsule film R&D (T-02). Persil Discs and Somat capsules are core platforms at risk.",
        category_exposure=cat(2,3,4,3, 4,4,2,5,3,5,2,3),
        vc_exposure=vc(4,5,4,5,2,2,2,2),
        regional_exposure=reg(5,2,2,1),
        data_source="ECHA Microplastics Restriction 2023; Phase 2 timeline", source_type="analyst_report",
        confidence="High",
    ),
    # ── G-03 ──
    Trend(
        id="government_r03", force="Government", sub_category="Cosmetics Regulation",
        name="EU Cosmetics Regulation Omnibus VII/VIII Revision",
        description="Rolling restriction of UV filters, preservatives, fragrances, colorants under EC 1223/2009 amendments. SCCS opinions driving restrictions on widely-used ingredients.",
        direction="Contraction", impact=4, probability=4, start_year=2026,
        strategic_implication="Color portfolio most at risk — hair dye reformulation is among hardest in consumer chemistry.",
        category_exposure=cat(5,4,3,4, 2,2,1,1,1,1,1,0),
        vc_exposure=vc(5,5,2,1,2,2,2,2),
        regional_exposure=reg(5,2,3,2),
        data_source="EUR-Lex EC 1223/2009 amendments; SCCS opinions", source_type="analyst_report",
        confidence="High",
    ),
    # ── G-04 ──
    Trend(
        id="government_r04", force="Government", sub_category="Packaging",
        name="EU PPWR — Packaging and Packaging Waste Regulation",
        description="Mandates 30% recycled content by 2030, 65% by 2040. DRS expansion. Reuse/refill targets. Applies from August 2026. Affects every Henkel SKU.",
        direction="Contraction", impact=3, probability=5, start_year=2026,
        strategic_implication="Front-load packaging redesign investment. PCR resin sourcing as strategic priority.",
        category_exposure=cat(3,3,3,3, 3,3,3,3,3,3,3,3),
        vc_exposure=vc(3,0,3,5,3,2,2,2),
        regional_exposure=reg(5,2,2,1),
        data_source="EUR-Lex PPWR Regulation 2024", source_type="analyst_report",
        confidence="High",
    ),
    # ── G-05 ──
    Trend(
        id="government_r05", force="Government", sub_category="Sustainability Claims",
        name="EU Green Claims Directive / EmpCo Enforcement",
        description="Empowering Consumers Directive applies September 2026. Bans generic green claims without robust substantiation. Restricts sustainability marketing — a key premiumization lever.",
        direction="Contraction", impact=3, probability=5, start_year=2026,
        strategic_implication="Invest in substantiation infrastructure. Turn compliance into credibility advantage for brands with genuine sustainability credentials.",
        category_exposure=cat(3,3,2,3, 3,3,2,3,2,3,2,2),
        vc_exposure=vc(1,1,1,2,2,5,3,3),
        regional_exposure=reg(5,2,1,1),
        data_source="EU Directive 2024/825 (EmpCo); Green Claims Directive proposal", source_type="analyst_report",
        confidence="High",
    ),
    # ── G-06 ──
    Trend(
        id="government_r06", force="Government", sub_category="Supply Chain",
        name="EU Deforestation Regulation (EUDR)",
        description="Applies December 2026 for large companies. Covers palm oil and derivatives. Requires geolocation-level traceability back to plantation, proving no deforestation after Dec 31 2020.",
        direction="Contraction", impact=3, probability=4, start_year=2026,
        strategic_implication="Palm-derived surfactant supply chain must achieve full traceability. Supplier qualification as strategic investment.",
        category_exposure=cat(1,3,2,3, 3,3,2,4,2,3,2,3),
        vc_exposure=vc(5,2,1,2,5,1,1,1),
        regional_exposure=reg(5,2,3,3),
        data_source="EU Regulation 2023/1115 (EUDR)", source_type="analyst_report",
        confidence="High",
    ),
    # ── G-07 ──
    Trend(
        id="government_r07", force="Government", sub_category="Digital Compliance",
        name="EU Digital Product Passport (DPP)",
        description="Under ESPR, DPPs required for detergents ~2027-2028, broader goods through 2030. Digital record of composition, lifecycle, sustainability data via QR code.",
        direction="Contraction", impact=2, probability=4, start_year=2027,
        strategic_implication="Compliance/IT cost — not a fundamental business model change. Detergents in first wave.",
        category_exposure=cat(2,2,2,2, 3,3,2,3,2,3,2,3),
        vc_exposure=vc(2,2,2,4,3,1,2,2),
        regional_exposure=reg(5,1,1,1),
        data_source="EU ESPR Regulation 2024; DPP standards timeline", source_type="analyst_report",
        confidence="Medium",
    ),

    # ═══════════════════════════════════════════════════════════════════
    # FORCE 3: TECHNOLOGY (8 trends incl. S-03, S-08)
    # ═══════════════════════════════════════════════════════════════════

    # ── T-01 ──
    Trend(
        id="technology_r01", force="Technology", sub_category="R&D",
        name="AI-Driven Formulation and Speed-to-Market",
        description="ML-driven predictive formulation reduces concept-to-formula from 18mo to 3-6mo. AI predicts ingredient interactions, stability, sensory profiles. P&G/L'Oreal furthest ahead; Henkel fast follower.",
        direction="Expansion", impact=4, probability=4, start_year=2025,
        strategic_implication="Deploy AI formulation to reduce regulatory compliance cost (G-01 to G-03) and accelerate innovation cycles.",
        category_exposure=cat(5,4,3,3, 4,3,3,4,3,4,3,3),
        vc_exposure=vc(3,5,3,1,1,1,2,1),
        regional_exposure=reg(4,5,4,2),
        data_source="Deloitte Manufacturing Outlook 2026; Trade press", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── T-02 ──
    Trend(
        id="technology_r02", force="Technology", sub_category="Green Chemistry",
        name="Bio-Based and Green Chemistry Alternatives",
        description="Enzymatic cleaning (cold-water effective), bio-surfactants from fermentation, biodegradable polymers. Novozymes/dsm-firmenich scaling enzyme laundry at 20°C. Cost parity potential by 2028-2029.",
        direction="Expansion", impact=4, probability=3, start_year=2026,
        strategic_implication="The Persil cold-wash enzyme platform is the LHC proof point. First-mover turns regulatory cost into competitive advantage.",
        category_exposure=cat(2,3,2,3, 4,4,3,5,3,4,4,4),
        vc_exposure=vc(5,5,3,2,3,3,2,3),
        regional_exposure=reg(5,4,3,3),
        data_source="BASF/Novozymes enzyme platforms; Regulatory compliance analysis", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── T-03 ──
    Trend(
        id="technology_r03", force="Technology", sub_category="Format Innovation",
        name="Concentrated and Solid Formats Innovation",
        description="Refill concentrates, solid bars, laundry sheets, ultra-concentrated detergents moving niche to mainstream. Consumer acceptance crossed early-adopter threshold in Western Europe.",
        direction="Expansion", impact=3, probability=4, start_year=2025,
        strategic_implication="Per-use margins improve even at lower shelf prices. Aligns with PPWR compliance.",
        category_exposure=cat(1,4,2,3, 3,4,2,4,3,3,3,2),
        vc_exposure=vc(3,4,4,5,4,3,3,4),
        regional_exposure=reg(5,4,3,2),
        data_source="Unilever/Blueland refill systems; Category analysis", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── T-04 ──
    Trend(
        id="technology_r04", force="Technology", sub_category="Biotech",
        name="Microbiome Science for Hair and Skin",
        description="Microbiome cosmetics market: $875M in 2025, 14.6% CAGR. P&G put microbiome balance front-of-pack. Scalp microbiome searches up 120%. Probiotic shampoos, postbiotic serums emerging.",
        direction="Expansion", impact=3, probability=3, start_year=2025,
        strategic_implication="Formulation investment in microbiome-friendly actives. Care and Body are the categories.",
        category_exposure=cat(1,5,1,4, 1,2,0,1,0,0,1,0),
        vc_exposure=vc(4,5,3,2,2,4,3,4),
        regional_exposure=reg(4,5,5,2),
        data_source="BeautyMatter; Data Insights Market microbiome report 2025", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── T-05 ──
    Trend(
        id="technology_r05", force="Technology", sub_category="Operations",
        name="Manufacturing Automation and Industry 4.0",
        description="AI manufacturing reduces inventory 20-30%, logistics 5-20%, procurement 5-15%. Predictive maintenance cuts downtime 40%. Global AI in FMCG reaching $57.7B by 2033.",
        direction="Expansion", impact=3, probability=4, start_year=2025,
        strategic_implication="COGS reduction flows to margin — critical when pricing power constrained by PL.",
        category_exposure=cat(3,3,3,3, 3,3,3,3,3,3,3,3),
        vc_exposure=vc(2,2,5,3,5,1,1,0),
        regional_exposure=reg(4,4,4,3),
        data_source="Deloitte Manufacturing Outlook 2026", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── T-06 ──
    Trend(
        id="technology_r06", force="Technology", sub_category="Digital",
        name="Retail Media Networks as Primary FMCG Channel",
        description="Retail media projected $200B globally by 2027. Precision targeting at point of purchase but another margin extraction layer. Shifts from Mental Availability (TV) to Physical Availability.",
        direction="Contraction", impact=3, probability=5, start_year=2024,
        strategic_implication="From Byron Sharp perspective: over-indexing on retail media erodes long-term Mental Availability. Balance is critical.",
        category_exposure=cat(3,3,3,3, 3,3,3,3,3,3,2,2),
        vc_exposure=vc(0,0,0,0,0,5,5,4),
        regional_exposure=reg(4,5,4,2),
        data_source="eMarketer Retail Media Forecast 2025", source_type="analyst_report",
        confidence="High",
    ),
    # ── S-03 (Technology) ──
    Trend(
        id="technology_r07", force="Technology", sub_category="Digital",
        name="AI-Powered Personalization at Scale",
        description="AI personalization moving from DTC niche toward mass feasibility. AI diagnostics, customized formulations, adaptive recommendations. L'Oreal Modiface is benchmark. Still nascent.",
        direction="Expansion", impact=3, probability=3, start_year=2026,
        strategic_implication="Color shade matching is natural AI use case. Schwarzkopf Professional digital tools as platform.",
        category_exposure=cat(4,4,3,3, 1,1,0,1,0,0,0,0),
        vc_exposure=vc(1,4,3,2,1,4,3,5),
        regional_exposure=reg(3,5,5,1),
        data_source="L'Oreal Modiface; Function of Beauty; Industry analysis", source_type="analyst_report",
        confidence="Low",
    ),
    # ── S-08 (Technology) ──
    Trend(
        id="technology_r08", force="Technology", sub_category="Smart Home",
        name="Connected Appliances and Auto-Dosing Transform Detergent Economics",
        description="62% of new smart washers include auto-dosing, cutting detergent 23% per cycle. Smart washer market $24B, 17.3% CAGR. Henkel launched Smartwash 2025 — individual actives dispensed per load.",
        direction="Expansion", impact=3, probability=3, start_year=2025,
        strategic_implication="Henkel Smartwash is the most differentiated LHC play. First-mover on dosing platform captures disproportionate value.",
        category_exposure=cat(0,0,0,0, 3,4,0,5,2,4,0,0),
        vc_exposure=vc(2,5,4,4,2,3,4,4),
        regional_exposure=reg(5,4,4,1),
        data_source="Henkel Smartwash launch 2025; Smart washer market data", source_type="analyst_report",
        confidence="Medium",
    ),

    # ═══════════════════════════════════════════════════════════════════
    # FORCE 4: ENVIRONMENTAL (6 trends incl. S-01)
    # ═══════════════════════════════════════════════════════════════════

    # ── E-01 ──
    Trend(
        id="environmental_r01", force="Environmental", sub_category="Supply Chain",
        name="Palm Oil Supply Chain Disruption (Indonesia B50)",
        description="Indonesia B50 mandate (50% palm biodiesel blend) diverts massive volumes from oleochemicals to fuel. Indonesia = 60% of global palm oil. Oleochemical supply for FMCG surfactants directly threatened.",
        direction="Contraction", impact=4, probability=4, start_year=2025,
        strategic_implication="Diversify away from palm-derived surfactants. Bio-based alternatives (T-02) become strategic imperative.",
        category_exposure=cat(2,4,3,4, 4,4,3,5,3,4,3,4),
        vc_exposure=vc(5,3,2,1,4,0,2,1),
        regional_exposure=reg(4,4,5,4),
        data_source="Indonesia B50 mandate analysis; FMCG supply chain reports", source_type="analyst_report",
        confidence="High",
    ),
    # ── E-02 ──
    Trend(
        id="environmental_r02", force="Environmental", sub_category="Resource",
        name="Water Scarcity Drives Low-Water Formulations",
        description="Water stress affects 40% of global population, intensifying in Southern Europe, MENA, Asia. Accelerates cold-wash, dry shampoo, waterless cleaning demand.",
        direction="Expansion", impact=3, probability=4, start_year=2025,
        strategic_implication="Cold-wash Persil at 20°C innovation. Styling benefits from dry shampoo growth.",
        category_exposure=cat(1,3,4,2, 3,3,2,4,3,3,3,2),
        vc_exposure=vc(2,4,3,3,2,3,2,4),
        regional_exposure=reg(4,3,4,5),
        data_source="UN Water Scarcity Report; Open-Meteo climate data", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── E-03 ──
    Trend(
        id="environmental_r03", force="Environmental", sub_category="Carbon",
        name="Carbon Border Adjustment and Scope 3 Reporting",
        description="EU CBAM phases in 2026-2034. CSRD Scope 3 mandatory reporting creates cost pressure through supply chain.",
        direction="Contraction", impact=3, probability=4, start_year=2026,
        strategic_implication="Optimize supply chain carbon intensity. Front-load compliance to avoid future cost spikes.",
        category_exposure=cat(2,2,2,2, 3,3,2,3,2,2,2,3),
        vc_exposure=vc(4,2,4,3,4,1,1,0),
        regional_exposure=reg(5,2,3,3),
        data_source="EU CBAM Regulation; CSRD requirements", source_type="analyst_report",
        confidence="High",
    ),
    # ── E-04 ──
    Trend(
        id="environmental_r04", force="Environmental", sub_category="Packaging",
        name="EPR Fee Escalation and Eco-Modulation",
        description="EPR fees escalating with eco-modulation penalties (2-5x for hard-to-recycle packaging). France CITEO is template. Multi-material packaging incurs highest penalties.",
        direction="Contraction", impact=3, probability=5, start_year=2025,
        strategic_implication="Packaging redesign for mono-material where possible. Reduce eco-modulation penalties.",
        category_exposure=cat(3,2,3,2, 3,3,2,3,2,2,2,3),
        vc_exposure=vc(1,0,1,5,2,0,2,0),
        regional_exposure=reg(5,2,1,1),
        data_source="CITEO France; CONAI Italy; EPR fee schedules", source_type="analyst_report",
        confidence="High",
    ),
    # ── E-05 ──
    Trend(
        id="environmental_r05", force="Environmental", sub_category="Climate",
        name="Climate-Driven Pest Pattern Shifts (Insecticide Demand)",
        description="Climate warming expands geographic range of disease-carrying insects. Tiger mosquitoes established in Southern Germany/France. Longer warm seasons increase demand windows.",
        direction="Expansion", impact=2, probability=4, start_year=2024,
        strategic_implication="FFI category benefits from geographic and seasonal expansion.",
        category_exposure=cat(0,0,0,0, 0,0,5,0,0,0,0,0),
        vc_exposure=vc(3,3,2,1,1,3,3,4),
        regional_exposure=reg(4,3,4,5),
        data_source="ECDC vector surveillance; Open-Meteo climate trends", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── S-01 (Environmental) ──
    Trend(
        id="environmental_r06", force="Environmental", sub_category="Supply Chain",
        name="Supply Chain Nearshoring and Geopolitical Diversification",
        description="Post-COVID and geopolitical tension driving FMCG supply chain diversification. Nearshoring chemical production from Asia to Europe/Turkey. Dual-sourcing mandates increasing.",
        direction="Contraction", impact=3, probability=4, start_year=2024,
        strategic_implication="Short-term cost increase but long-term resilience. Invest in European/Turkish chemical sourcing.",
        category_exposure=cat(3,3,3,3, 3,3,2,3,3,3,2,3),
        vc_exposure=vc(4,1,3,2,5,0,1,0),
        regional_exposure=reg(4,4,5,4),
        data_source="McKinsey Supply Chain Resilience Report 2025", source_type="analyst_report",
        confidence="Medium",
    ),

    # ═══════════════════════════════════════════════════════════════════
    # FORCE 5: COMPETITIVE (7 trends incl. S-04)
    # ═══════════════════════════════════════════════════════════════════

    # ── X-01 ──
    Trend(
        id="competitive_r01", force="Competitive", sub_category="Restructuring",
        name="Reckitt Essential Home Divestiture",
        description="Reckitt divesting Essential Home portfolio. PE acquisition likely = cost-cutting, brand neglect = share opportunity for Henkel in overlapping European/EM LHC markets.",
        direction="Expansion", impact=4, probability=4, start_year=2025,
        strategic_implication="Capture shelf space and share during competitor transition period.",
        category_exposure=cat(0,0,0,0, 4,3,3,4,3,3,4,3),
        vc_exposure=vc(0,1,1,0,1,4,5,4),
        regional_exposure=reg(5,3,2,4),
        data_source="Reckitt strategic review announcement; Analyst coverage", source_type="analyst_report",
        confidence="High",
    ),
    # ── X-02 ──
    Trend(
        id="competitive_r02", force="Competitive", sub_category="Strategy",
        name="Unilever Beauty and Wellbeing Pivot",
        description="Unilever targeting 66% revenue from Beauty & Wellbeing by 2030. €50.5B revenue, massive budgets. Doubling down on Henkel Hair competitive overlap. Dove, TRESemmé intensifying.",
        direction="Contraction", impact=4, probability=5, start_year=2024,
        strategic_implication="Accelerate Schwarzkopf premiumization before Unilever saturates the space. Care is the primary battleground.",
        category_exposure=cat(3,5,3,4, 1,1,0,1,0,0,0,0),
        vc_exposure=vc(1,3,1,1,1,5,5,4),
        regional_exposure=reg(5,5,5,5),
        data_source="Unilever Capital Markets Day 2025; Annual Report", source_type="analyst_report",
        confidence="High",
    ),
    # ── X-03 ──
    Trend(
        id="competitive_r03", force="Competitive", sub_category="Strategy",
        name="P&G Superiority Framework and Innovation Fortress",
        description="P&G irresistible superiority framework drives disproportionate R&D and media investment. Ariel, Fairy, Pantene, H&S set category innovation bar.",
        direction="Contraction", impact=3, probability=5, start_year=2024,
        strategic_implication="Match P&G innovation pace in LAD (Persil vs Ariel) and ADW (Somat vs Fairy).",
        category_exposure=cat(2,3,2,2, 4,3,3,4,3,4,2,2),
        vc_exposure=vc(1,4,2,2,1,5,4,3),
        regional_exposure=reg(5,5,4,4),
        data_source="P&G FY2025 earnings; Investor presentation", source_type="analyst_report",
        confidence="High",
    ),
    # ── X-04 ──
    Trend(
        id="competitive_r04", force="Competitive", sub_category="Disruption",
        name="DTC and Indie Brand Disruption in Hair",
        description="Function of Beauty, Olaplex, K18, Virtue Labs capture fastest-growing Hair sub-segments. Collectively erode premiumization growth that legacy brands need.",
        direction="Contraction", impact=3, probability=4, start_year=2023,
        strategic_implication="Acquire or out-innovate. Schwarzkopf Professional credibility is the counter-positioning.",
        category_exposure=cat(3,5,3,2, 0,0,0,0,0,0,0,0),
        vc_exposure=vc(1,3,0,2,1,4,3,5),
        regional_exposure=reg(4,5,3,2),
        data_source="DTC brand tracking; Euromonitor Hair Care 2025", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── X-05 ──
    Trend(
        id="competitive_r05", force="Competitive", sub_category="Disruption",
        name="Chinese FMCG Brands Enter European Market",
        description="Florasis, Perfect Diary entering Europe via TikTok Shop/Temu. Extreme value positioning, digital-native marketing. Early-warning signal — trajectory mirrors Shein disruption.",
        direction="Contraction", impact=2, probability=3, start_year=2025,
        strategic_implication="Monitor trigger: if TikTok Shop hair care from Chinese brands exceeds 5% in any EU market, escalate response.",
        category_exposure=cat(2,2,2,3, 2,1,1,2,1,1,1,0),
        vc_exposure=vc(0,1,0,0,0,3,3,4),
        regional_exposure=reg(4,3,2,3),
        data_source="TikTok Shop analytics; Temu EU expansion data", source_type="analyst_report",
        confidence="Low",
    ),
    # ── X-06 ──
    Trend(
        id="competitive_r06", force="Competitive", sub_category="Growth",
        name="Emerging Markets Growth Divergence — IMEA Leads",
        description="Henkel IMEA delivered 12.1% organic growth FY2025 vs 0.9% group average. India, Middle East, Africa are structural growth drivers. Henkel investing in India manufacturing.",
        direction="Expansion", impact=3, probability=4, start_year=2024,
        strategic_implication="Allocate disproportionate investment to High Growth markets. Portfolio diversification reduces European concentration risk.",
        category_exposure=cat(3,4,2,4, 3,3,3,4,2,2,2,2),
        vc_exposure=vc(2,3,4,3,4,4,4,5),
        regional_exposure=reg(1,1,4,5),
        data_source="Henkel FY2025 Annual Report; IMEA segment data", source_type="analyst_report",
        confidence="High",
    ),
    # ── S-04 (Competitive) ──
    Trend(
        id="competitive_r07", force="Competitive", sub_category="Strategy",
        name="L'Oreal Tech-Beauty Platform Strategy",
        description="L'Oreal building beauty tech platform: AI diagnostics (Modiface), microbiome science, custom formulations. €43B revenue, 4% R&D spend (€1.7B). Redefining innovation in Hair from chemistry to tech-beauty.",
        direction="Contraction", impact=3, probability=5, start_year=2024,
        strategic_implication="Match L'Oreal tech investment in Color (shade matching) and Care (diagnostics). R&D partnership strategy.",
        category_exposure=cat(5,4,3,3, 0,0,0,0,0,0,0,0),
        vc_exposure=vc(1,4,1,1,0,5,4,4),
        regional_exposure=reg(5,5,5,3),
        data_source="L'Oreal Annual Report 2025; Modiface platform", source_type="analyst_report",
        confidence="High",
    ),

    # ═══════════════════════════════════════════════════════════════════
    # FORCE 6: CUSTOMER (7 trends incl. S-05, S-10)
    # ═══════════════════════════════════════════════════════════════════

    # ── K-01 ──
    Trend(
        id="customer_r01", force="Customer", sub_category="Channel Shift",
        name="Discount Retail Channel Expansion in Europe",
        description="Aldi/Lidl hold 25-35% grocery share in Germany, UK, Benelux — still growing. Expanding beauty/personal care shelf, launching premium PL. Every share point to discount = lower branded economics.",
        direction="Contraction", impact=4, probability=5, start_year=2024,
        strategic_implication="Secure branded shelf space in discount with exclusive value formats. Cannot ignore 30%+ of market.",
        category_exposure=cat(3,3,2,3, 5,4,3,5,3,4,2,2),
        vc_exposure=vc(0,0,0,1,2,3,5,5),
        regional_exposure=reg(5,2,1,2),
        data_source="NIQ Retail Panel; Aldi/Lidl expansion data", source_type="analyst_report",
        confidence="High",
    ),
    # ── K-02 ──
    Trend(
        id="customer_r02", force="Customer", sub_category="E-Commerce",
        name="E-Commerce Profit Pool Maturation",
        description="FMCG e-com stabilized at 12-15% in Western Europe. Pay-to-play economics converging with offline. Amazon Subscribe & Save capturing habitual replenishment.",
        direction="Contraction", impact=3, probability=4, start_year=2024,
        strategic_implication="Optimize retail media ROI. Build subscription models for LAD/ADW. Balance online vs offline profitability.",
        category_exposure=cat(3,3,3,3, 2,2,2,3,2,2,1,1),
        vc_exposure=vc(0,0,0,2,3,4,4,4),
        regional_exposure=reg(4,5,5,2),
        data_source="eMarketer; Amazon FMCG data", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── K-03 ──
    Trend(
        id="customer_r03", force="Customer", sub_category="Market Structure",
        name="Retailer Consolidation and Power Concentration",
        description="Top 10 European grocers control 40-50% of sales. Schwarz Group, Aldi, Carrefour, Tesco wield increasing negotiating power. Rising listing fees, promotional demands.",
        direction="Contraction", impact=3, probability=4, start_year=2024,
        strategic_implication="Brand strength (Mental Availability) is the only leverage against concentrated buyer power. Invest in DBAs.",
        category_exposure=cat(3,3,2,3, 4,4,3,4,3,3,2,2),
        vc_exposure=vc(0,0,0,0,1,2,5,3),
        regional_exposure=reg(5,3,2,2),
        data_source="Planet Retail; European grocery consolidation data", source_type="analyst_report",
        confidence="High",
    ),
    # ── K-04 ──
    Trend(
        id="customer_r04", force="Customer", sub_category="Channel Shift",
        name="Social Commerce and TikTok Shop Emergence",
        description="TikTok Shop, Instagram Shopping bypassing traditional retail. Beauty is #1 TikTok Shop category. Viral products generate €10M+ in weeks.",
        direction="Expansion", impact=2, probability=3, start_year=2024,
        strategic_implication="Build got2b and Schwarzkopf social-first content capabilities. Partner with creators.",
        category_exposure=cat(3,4,4,3, 1,1,0,1,0,0,0,0),
        vc_exposure=vc(0,0,0,1,2,5,4,5),
        regional_exposure=reg(3,4,5,3),
        data_source="TikTok Shop analytics; Social commerce reports", source_type="analyst_report",
        confidence="Low",
    ),
    # ── K-05 ──
    Trend(
        id="customer_r05", force="Customer", sub_category="Channel Shift",
        name="Quick Commerce Consolidation and FMCG Integration",
        description="European q-commerce ~$64B after consolidation. Surviving players integrating with traditional retail. Groceries 44% of q-commerce.",
        direction="Contraction", impact=2, probability=3, start_year=2024,
        strategic_implication="Monitor but don't over-invest. Q-commerce is a channel to manage, not a strategic priority.",
        category_exposure=cat(1,2,1,2, 2,2,1,3,2,2,1,0),
        vc_exposure=vc(0,0,0,1,3,2,4,4),
        regional_exposure=reg(4,3,4,2),
        data_source="Statista q-commerce; Flink/Deliveroo data", source_type="analyst_report",
        confidence="Low",
    ),
    # ── S-05 (Customer) ──
    Trend(
        id="customer_r06", force="Customer", sub_category="Business Model",
        name="FMCG Subscription and Loyalty Ecosystem Lock-in",
        description="Amazon Subscribe & Save, retailer loyalty programs creating switching-cost barriers in FMCG. Subscription locks consumers into replenishment cycles.",
        direction="Contraction", impact=2, probability=4, start_year=2024,
        strategic_implication="Ensure Henkel brands are well-positioned within subscription platforms. Build own DTC subscription where viable.",
        category_exposure=cat(2,2,1,2, 3,3,1,4,2,3,1,1),
        vc_exposure=vc(0,0,0,1,2,3,4,5),
        regional_exposure=reg(4,5,3,1),
        data_source="Amazon S&S data; Retailer loyalty program analysis", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── S-10 (Customer) ──
    Trend(
        id="customer_r07", force="Customer", sub_category="Channel Creation",
        name="Professional Salon Channel to Consumer Crossover",
        description="Professional hair care market $23.4B in 2025, $38.3B by 2036 at 4.6% CAGR. Salon-to-retail crossover accelerating. B2C now 63% of industry share. Schwarzkopf Professional's defining moment.",
        direction="Expansion", impact=3, probability=4, start_year=2025,
        strategic_implication="Deploy Schwarzkopf Professional expertise into consumer retail channel. Color and Care are the profit pools.",
        category_exposure=cat(5,5,4,2, 0,0,0,0,0,0,0,0),
        vc_exposure=vc(2,3,2,3,3,5,5,5),
        regional_exposure=reg(4,5,4,2),
        data_source="Future Market Insights Professional Hair Care 2025", source_type="analyst_report",
        confidence="High",
    ),
]


# ═══════════════════════════════════════════════════════════════════════
# SOURCE URLs — Working links to original evidence
# ═══════════════════════════════════════════════════════════════════════

SOURCE_URLS = {
    "consumer_r01": [
        {"title": "NIQ: Private Label Power in Western Europe", "url": "https://nielseniq.com/global/en/insights/analysis/2025/private-label-power-in-western-europe-confidence-value-and-innovation-drive-growth/", "source_type": "market_report"},
    ],
    "consumer_r02": [
        {"title": "McKinsey: Future of Wellness Trends 2025", "url": "https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights/future-of-wellness-trends", "source_type": "research_report"},
    ],
    "consumer_r03": [
        {"title": "Euromonitor: Premiumisation in Hair Care", "url": "https://www.euromonitor.com/premiumisation-in-hair-care/report", "source_type": "market_report"},
    ],
    "consumer_r04": [
        {"title": "Mintel: Global Beauty & Personal Care Trends 2025", "url": "https://www.mintel.com/press-centre/mintel-announces-global-beauty-and-personal-care-trends-for-2025/", "source_type": "research_report"},
    ],
    "consumer_r05": [
        {"title": "Euromonitor: Men's Grooming Market Report", "url": "https://www.euromonitor.com/mens-grooming-in-the-us/report", "source_type": "market_report"},
    ],
    "consumer_r06": [
        {"title": "Circana: US Beauty Industry Sales Report", "url": "https://www.circana.com/post/us-beauty-industry-sales-accelerate-in-q3-circana-reports", "source_type": "market_report"},
    ],
    "consumer_r07": [
        {"title": "Grand View Research: Microbiome Skincare Market", "url": "https://www.grandviewresearch.com/industry-analysis/microbiome-skincare-market-report", "source_type": "market_report"},
    ],
    "consumer_r08": [
        {"title": "Euromonitor: Affordability, Value & Cost of Living", "url": "https://www.euromonitor.com/affordability-value-and-the-cost-of-living/report", "source_type": "market_report"},
    ],
    "consumer_r09": [
        {"title": "McKinsey: Trends Defining the $1.8T Global Wellness Market", "url": "https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights/the-trends-defining-the-1-point-8-trillion-dollar-global-wellness-market-in-2024", "source_type": "research_report"},
    ],
    "consumer_r10": [
        {"title": "Hair Loss Treatment Market Size & Forecast 2025-2032", "url": "https://www.coherentmarketinsights.com/market-insight/hair-loss-treatment-market-4374", "source_type": "market_report"},
    ],
    "consumer_r11": [
        {"title": "Mintel: US Gen Z Beauty Consumer Report", "url": "https://store.mintel.com/report/us-gen-z-beauty-consumer-market-report", "source_type": "market_report"},
    ],
    "consumer_r12": [
        {"title": "FMI: Professional Hair Care Products Market", "url": "https://www.futuremarketinsights.com/reports/global-professional-hair-care-products-market", "source_type": "market_report"},
    ],
    "government_r01": [
        {"title": "EUR-Lex: Green Claims Directive COM/2023/166", "url": "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex:52023PC0166", "source_type": "regulation"},
    ],
    "government_r02": [
        {"title": "EC: REACH Chemical Restrictions", "url": "https://single-market-economy.ec.europa.eu/sectors/chemicals/reach/restrictions_en", "source_type": "regulation"},
    ],
    "government_r03": [
        {"title": "EU Digital Product Passport Initiative", "url": "https://data.europa.eu/en/news-events/news/eus-digital-product-passport-advancing-transparency-and-sustainability", "source_type": "regulation"},
    ],
    "government_r04": [
        {"title": "EC: Regulation on Deforestation-free Products", "url": "https://environment.ec.europa.eu/topics/forests/deforestation/regulation-deforestation-free-products_en", "source_type": "regulation"},
    ],
    "government_r05": [
        {"title": "EC: Packaging and Packaging Waste Regulation", "url": "https://environment.ec.europa.eu/topics/waste-and-recycling/packaging-waste/packaging-packaging-waste-regulation_en", "source_type": "regulation"},
    ],
    "government_r06": [
        {"title": "Understanding GB Standards for Product Compliance in China", "url": "https://ecqa.com/gb-standards-product-compliance-china/", "source_type": "standards"},
    ],
    "government_r07": [
        {"title": "EC: EU Taxonomy for Sustainable Activities", "url": "https://finance.ec.europa.eu/sustainable-finance/tools-and-standards/eu-taxonomy-sustainable-activities_en", "source_type": "regulation"},
    ],
    "technology_r01": [
        {"title": "Perfect Corp: AI-Powered Beauty Personalization", "url": "https://www.perfectcorp.com/business", "source_type": "company_page"},
    ],
    "technology_r02": [
        {"title": "Evonik: Eco-Friendly Cosmetic Solutions", "url": "https://www.evonik.com/en/products-and-solutions/personal-care", "source_type": "company_page"},
    ],
    "technology_r03": [
        {"title": "McKinsey: Digital & AI Transformation in CPG", "url": "https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights/fortune-or-fiction-the-real-value-of-a-digital-and-ai-transformation-in-cpg", "source_type": "research_report"},
    ],
    "technology_r04": [
        {"title": "BCG: Unlocking AI Value in Manufacturing", "url": "https://www.bcg.com/publications/2025/ai-in-manufacturing", "source_type": "research_report"},
    ],
    "technology_r05": [
        {"title": "ScienceDirect: Sustainable Life Cycle for Cosmetics", "url": "https://www.sciencedirect.com/science/article/pii/S2352554123002127", "source_type": "research_article"},
    ],
    "technology_r06": [
        {"title": "McKinsey: E-Commerce Growth in CPG", "url": "https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights", "source_type": "research_report"},
    ],
    "technology_r07": [
        {"title": "IFF: Bioscience Solutions for Innovation", "url": "https://www.iff.com/science/bioscience/", "source_type": "company_page"},
    ],
    "technology_r08": [
        {"title": "Henkel: Smart Home & Connected Solutions", "url": "https://www.henkel.com/innovation", "source_type": "company_page"},
    ],
    "environmental_r01": [
        {"title": "CDP: Supply Chain Report — Strengthening the Chain", "url": "https://www.cdp.net/en/insights/strengthening-the-chain", "source_type": "research_report"},
    ],
    "environmental_r02": [
        {"title": "Ellen MacArthur Foundation: Circular Economy", "url": "https://www.ellenmacarthurfoundation.org", "source_type": "organization"},
        {"title": "EC: Packaging and Packaging Waste Regulation", "url": "https://environment.ec.europa.eu/topics/waste-and-recycling/packaging-waste/packaging-packaging-waste-regulation_en", "source_type": "regulation"},
    ],
    "environmental_r03": [
        {"title": "WRI: Aqueduct Water Risk Atlas", "url": "https://www.wri.org/applications/aqueduct/water-risk-atlas/", "source_type": "data_tool"},
    ],
    "environmental_r04": [
        {"title": "IPCC: Sixth Assessment Report (AR6)", "url": "https://www.ipcc.ch/report/sixth-assessment-report-cycle/", "source_type": "research_report"},
    ],
    "environmental_r05": [
        {"title": "Euromonitor: Top Global Consumer Trends 2025", "url": "https://www.euromonitor.com/press/press-releases/november-2024/euromonitor-international-reveals-top-global-consumer-trends-for-2025", "source_type": "market_report"},
    ],
    "environmental_r06": [
        {"title": "UNEP: Global Chemicals Outlook", "url": "https://www.unep.org/topics/chemicals-and-pollution-action/chemicals-management/global-chemicals-outlook", "source_type": "organization"},
    ],
    "competitive_r01": [
        {"title": "P&G: Annual Report 2024", "url": "https://us.pg.com/annualreport2024/", "source_type": "annual_report"},
    ],
    "competitive_r02": [
        {"title": "Reckitt: Full Year Results 2025", "url": "https://www.reckitt.com/investors/", "source_type": "earnings_report"},
    ],
    "competitive_r03": [
        {"title": "Unilever: Growth Action Plan", "url": "https://www.unilever.com/our-company/strategy/", "source_type": "strategy_document"},
    ],
    "competitive_r04": [
        {"title": "Church & Dwight: Investor Relations", "url": "https://www.churchdwight.com/investors/", "source_type": "annual_report"},
    ],
    "competitive_r05": [
        {"title": "Technavio: FMCG Market Growth Forecast 2025-2029", "url": "https://www.technavio.com/report/fmcg-market-industry-analysis", "source_type": "market_report"},
    ],
    "competitive_r06": [
        {"title": "Amazon Private Label Brands — Complete Guide", "url": "https://www.pattern.com/blog/amazons-private-label-brands-complete-guide", "source_type": "market_analysis"},
    ],
    "competitive_r07": [
        {"title": "BCG: 2025 M&A Report — Brave New World of Dealmaking", "url": "https://www.bcg.com/publications/2025/the-brave-new-world-of-dealmaking-in-the-global-market", "source_type": "research_report"},
    ],
    "customer_r01": [
        {"title": "NIQ: Channel Strategy Report 2025", "url": "https://nielseniq.com/global/en/insights/report/2025/on-premise-channel-strategy-report-2025/", "source_type": "market_report"},
    ],
    "customer_r02": [
        {"title": "Statista: Quick Commerce Market Forecast", "url": "https://www.statista.com/outlook/emo/online-food-delivery/grocery-delivery/quick-commerce/worldwide", "source_type": "market_forecast"},
    ],
    "customer_r03": [
        {"title": "ESM: Lidl Reports Double-Digit Turnover Growth", "url": "https://www.esmmagazine.com/retail/lidl-gb-reports-double-digit-turnover-growth-in-fy-2024-277606", "source_type": "news"},
    ],
    "customer_r04": [
        {"title": "Amazon Beauty: Prime Day 2025 Report", "url": "https://www.prnewswire.com/news-releases/market-defenses-annual-amazon-prime-day-2025-beauty-report-unpacks-four-days-of-record-breaking-beauty-trends-302515096.html", "source_type": "market_report"},
    ],
    "customer_r05": [
        {"title": "NIQ: Retail Media's Billion-Euro Mirage", "url": "https://nielseniq.com/global/en/insights/analysis/2025/retail-medias-billion-euro-mirage/", "source_type": "market_analysis"},
    ],
    "customer_r06": [
        {"title": "NIQ: Category Management That Delivers", "url": "https://nielseniq.com/global/en/insights/webinar/2026/category-management-that-delivers/", "source_type": "market_report"},
    ],
    "customer_r07": [
        {"title": "Euromonitor: Top Retail Trends 2025", "url": "https://www.euromonitor.com/article/top-retail-trends-in-2025-discount-formats-and-social-commerce-drive-growth", "source_type": "market_report"},
    ],
}


def get_report_trends():
    """Return the list of 47 report trends with source URLs attached."""
    trends = list(TRENDS)
    for t in trends:
        t.sources = SOURCE_URLS.get(t.id, [])
    return trends


def main():
    print(f"Initializing database...")
    init_db()

    print(f"Importing {len(TRENDS)} trends from Intelligence Report...")

    # Validate before saving
    for t in TRENDS:
        assert t.force in ["Consumer", "Customer", "Technology", "Government", "Environmental", "Competitive"], f"Invalid force: {t.force} for {t.id}"
        assert t.direction in ["Expansion", "Contraction"], f"Invalid direction: {t.direction} for {t.id}"
        assert 1 <= t.impact <= 5, f"Invalid impact: {t.impact} for {t.id}"
        assert 1 <= t.probability <= 5, f"Invalid probability: {t.probability} for {t.id}"
        for k, v in t.category_exposure.items():
            assert k in CATEGORIES, f"Invalid category: {k} for {t.id}"
            assert 0 <= v <= 5, f"Invalid category exposure: {v} for {k} in {t.id}"
        for k, v in t.vc_exposure.items():
            assert k in VC_STEPS, f"Invalid VC step: {k} for {t.id}"
            assert 0 <= v <= 5, f"Invalid VC exposure: {v} for {k} in {t.id}"
        for k, v in t.regional_exposure.items():
            assert k in REGIONS, f"Invalid region: {k} for {t.id}"
            assert 0 <= v <= 5, f"Invalid regional exposure: {v} for {k} in {t.id}"

    # Attach source URLs before saving
    for t in TRENDS:
        t.sources = SOURCE_URLS.get(t.id, [])

    save_trends(TRENDS)

    # Verify
    from pulse.database import load_trends
    trends_list = load_trends()
    print(f"\nVerification: {len(trends_list)} trends in database")
    from collections import Counter
    force_counts = Counter(t.force for t in trends_list)
    print(f"  Forces: {', '.join(f'{f}: {force_counts.get(f, 0)}' for f in ['Consumer','Government','Technology','Environmental','Competitive','Customer'])}")
    print(f"  Expansion: {sum(1 for t in trends_list if t.direction == 'Expansion')}")
    print(f"  Contraction: {sum(1 for t in trends_list if t.direction == 'Contraction')}")
    print(f"\nDone. Trends ready for simulation.")


if __name__ == "__main__":
    main()
