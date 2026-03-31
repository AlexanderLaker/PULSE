"""
PRISM seed data: 47 trends from the Trend Intelligence Report (March 2026).

This module lives inside the pulse package so it's importable on Vercel serverless.
"""

from pulse.ingestion.models import Trend
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
    # ═══════════════════════════════════════════════════════════════════
    # gp1_pct_affected RATIONALE:
    # This parameter answers: "If this trend fully materializes at
    # maximum severity, what % of the category's GP1 is exposed?"
    #
    # Calibration logic:
    # - Market structure shifts (PL penetration, channel shifts): 15-25%
    #   because they affect pricing power across broad volume
    # - Regulatory (reformulation, packaging): 5-15%
    #   because they affect COGS, not the whole margin stack
    # - Consumer behavioral (premiumization, trading down): 8-20%
    #   because they shift willingness-to-pay for a segment
    # - Technology (new formats, AI): 3-10%
    #   because they affect efficiency or niche segments
    # - Category creation (scalp care, hair loss): 3-8%
    #   because they're additive pools, not existing pool shifts
    # - Competitive (specific moves): 5-15%
    #   because they affect share in overlapping segments
    #
    # Values are AI-preset based on evidence in the description.
    # Experts can override via the dashboard or Delphi rounds.
    # ═══════════════════════════════════════════════════════════════════

    # ── C-01 ──
    Trend(
        id="consumer_r01", force="Consumer", sub_category="Market Structure",
        name="Private Label Structural Penetration in Europe",
        description="Private label crossed 42% value share in EU6 (Circana Dec 2025), up from 40% earlier in the year. Netherlands leads at 55%, Spain at 51%, Germany at 42%. Circana reports €317B in PL sales. Structural, not cyclical — retailer brands invested in quality, packaging, and premium tiers. Aldi rebranding entire PL portfolio under its namesake. Branded-to-PL price gap narrowed to 15-20%.",
        direction="Contraction", probability=5, start_year=2025,
        # 25%: PL directly competes for ~40-50% of volume but branded margin
        # defense limits GP1 exposure to the price-gap erosion portion
        gp1_pct_affected=0.25,
        strategic_implication="Defend through demonstrable superiority, not price. Invest in innovation that justifies the premium gap.",
        category_exposure=cat(3,3,2,3, 5,5,4,5,4,4,3,4),
        vc_exposure=vc(1,1,1,1,1,4,5,5),
        regional_exposure=reg(5,3,2,2),
        data_source="Circana EU6 Private Label Monitor Dec 2025; NIQ European Private Label Monitor 2025", source_type="analyst_report",
        confidence="High",
    ),
    # ── C-02 ──
    Trend(
        id="consumer_r02", force="Consumer", sub_category="Behavioral",
        name="GLP-1 Drugs Reshape Consumer Spending Patterns",
        description="12.4% of US adults on GLP-1 receptor agonists. Consumer spending data shows reduced impulse purchasing but increased premium self-care investment. European adoption 18-24 months behind US but accelerating.",
        direction="Expansion", probability=4, start_year=2025,
        # 5%: Indirect effect via spending reallocation; affects premium
        # tier only, EU adoption still early — small pool exposure
        gp1_pct_affected=0.05,
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
        direction="Expansion", probability=5, start_year=2024,
        # 18%: Premium tier is ~25-30% of Hair GP1 but growing; affects
        # mix/margin improvement across the portfolio
        gp1_pct_affected=0.18,
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
        direction="Expansion", probability=4, start_year=2025,
        # 10%: Affects the ~30% of consumers who actively select on
        # clean/clinical criteria, translating to ~10% GP1 exposure
        gp1_pct_affected=0.10,
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
        direction="Expansion", probability=5, start_year=2025,
        # 12%: 65+ already ~20% of buyers; incremental growth in Color
        # (gray coverage) and gentle formulation segments
        gp1_pct_affected=0.12,
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
        direction="Contraction", probability=4, start_year=2024,
        # 22%: Broad-based macro effect; 70% of consumers trading down
        # Latest ECB data shows mortgage resets continuing through 2027
        gp1_pct_affected=0.22,
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
        direction="Expansion", probability=4, start_year=2025,
        # 6%: New adjacent pool — additive, not substitutive;
        # captures incremental occasions, currently small base
        gp1_pct_affected=0.06,
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
        direction="Expansion", probability=4, start_year=2025,
        # 8%: Males ~15-20% of Hair buyers; under-penetrated segment
        # growth adds to pool but from small base
        gp1_pct_affected=0.08,
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
        direction="Expansion", probability=4, start_year=2025,
        # 10%: Fragrance premiumization creates new margin layer but
        # only for ~20% of LHC volume that goes premium
        gp1_pct_affected=0.10,
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
        direction="Expansion", probability=4, start_year=2025,
        # 5%: New adjacent pool with small overlap to existing Care;
        # additive but niche relative to total Hair GP1
        gp1_pct_affected=0.05,
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
        direction="Contraction", probability=5, start_year=2024,
        # 12%: Gen Z ~20% of category spend; dupe-seeking erodes
        # branded price premium for ~60% of that cohort
        gp1_pct_affected=0.12,
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
        direction="Expansion", probability=4, start_year=2022,
        # 7%: Elevated baseline already mostly priced in; incremental
        # GP1 exposure limited to frequency-driven volume lift
        gp1_pct_affected=0.07,
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
        description="EU's proposed universal restriction on ~10,000 PFAS substances. RAC adopted final opinion March 2, 2026. SEAC agreed draft opinion March 10, 2026 — 60-day public consultation open until May 25, 2026. ECHA supports broad restriction with targeted derogations. Cosmetics sector: alternatives already exist, no supply shortages. Affects surface treatments, water-repellent coatings, stain resistance. Phased 2027-2032.",
        direction="Contraction", probability=4, start_year=2027,
        # 12%: Reformulation cost + temporary delisting risk for affected
        # SKUs; ~20-30% of LHC formulations contain PFAS-adjacent chemistry
        gp1_pct_affected=0.12,
        strategic_implication="Proactive reformulation as competitive advantage. AI-driven formulation (T-01) reduces reformulation cost and time.",
        category_exposure=cat(2,2,3,2, 4,5,3,4,3,4,4,5),
        vc_exposure=vc(5,5,3,2,3,2,2,1),
        regional_exposure=reg(5,3,2,2),
        data_source="ECHA PFAS Restriction Proposal 2023; RAC Final Opinion Mar 2026; SEAC Draft Opinion Mar 2026", source_type="analyst_report",
        confidence="High",
    ),
    # ── G-02 ──
    Trend(
        id="government_r02", force="Government", sub_category="Chemical Regulation",
        name="EU Microplastics Ban — Phase 2 Implementation",
        description="Phase 2 (2027-2029) targets leave-on cosmetics and detergent capsule coatings. PVA film in laundry/dishwasher pods under scrutiny. Bio-based alternatives technically immature at scale.",
        direction="Contraction", probability=5, start_year=2027,
        # 10%: Pod/capsule formats are ~15-20% of LAD/ADW volume;
        # reformulation + potential format disruption
        gp1_pct_affected=0.10,
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
        direction="Contraction", probability=4, start_year=2026,
        # 15%: Hair dye reformulation among hardest in consumer chemistry;
        # Color portfolio disproportionately exposed (colorant restrictions)
        gp1_pct_affected=0.15,
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
        description="PPWR 2025/40 entered into force Feb 11, 2025. Generally applies from August 12, 2026. Mandates 30% recycled content by 2030, 65% by 2040. PFAS banned in packaging from August 2026. DRS expansion. Reuse/refill targets. Affects every Henkel SKU.",
        direction="Contraction", probability=5, start_year=2026,
        # 6%: COGS increase from PCR resin premium (~10-15% packaging cost
        # uplift); packaging is ~8-12% of COGS
        gp1_pct_affected=0.06,
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
        direction="Contraction", probability=5, start_year=2026,
        # 8%: Restricts a marketing lever, not the product itself;
        # mainly affects the sustainability-premium pricing delta
        gp1_pct_affected=0.08,
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
        direction="Contraction", probability=4, start_year=2026,
        # 5%: Supply chain compliance cost; palm-derived surfactants are
        # ~15% of raw material cost, traceability adds ~2-3% to that
        gp1_pct_affected=0.05,
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
        direction="Contraction", probability=4, start_year=2027,
        # 2%: Pure IT/compliance cost; no impact on demand or pricing
        gp1_pct_affected=0.02,
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
        direction="Expansion", probability=4, start_year=2025,
        # 8%: COGS efficiency + speed-to-market advantage; affects R&D
        # cost structure (~5% of revenue) and innovation hit rate
        gp1_pct_affected=0.08,
        description="ML-driven predictive formulation reduces concept-to-formula from 18mo to 3-6mo. AI predicts ingredient interactions, stability, sensory profiles. P&G/L'Oreal furthest ahead; Henkel fast follower.",
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
        direction="Expansion", probability=3, start_year=2026,
        # 10%: Turns regulatory compliance cost into margin advantage;
        # affects raw material cost (~25% of COGS) for reformulated products
        gp1_pct_affected=0.10,
        description="Enzymatic cleaning (cold-water effective), bio-surfactants from fermentation, biodegradable polymers. Novozymes/dsm-firmenich scaling enzyme laundry at 20°C. Cost parity potential by 2028-2029.",
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
        direction="Expansion", probability=4, start_year=2025,
        # 7%: Improves per-use margin but from niche base; affects
        # ~10% of volume currently transitioning to new formats
        gp1_pct_affected=0.07,
        description="Refill concentrates, solid bars, laundry sheets, ultra-concentrated detergents moving niche to mainstream. Consumer acceptance crossed early-adopter threshold in Western Europe.",
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
        direction="Expansion", probability=3, start_year=2025,
        # 4%: Nascent science, small addressable market within Care;
        # additive pool but early-stage
        gp1_pct_affected=0.04,
        description="Microbiome cosmetics market: $875M in 2025, 14.6% CAGR. P&G put microbiome balance front-of-pack. Scalp microbiome searches up 120%. Probiotic shampoos, postbiotic serums emerging.",
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
        direction="Expansion", probability=4, start_year=2025,
        # 6%: COGS efficiency across entire portfolio; 20-30% inventory
        # reduction translates to ~2-3pp margin improvement on ~30% of ops
        gp1_pct_affected=0.06,
        description="AI manufacturing reduces inventory 20-30%, logistics 5-20%, procurement 5-15%. Predictive maintenance cuts downtime 40%. Global AI in FMCG reaching $57.7B by 2033.",
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
        direction="Contraction", probability=5, start_year=2024,
        # 12%: Retail media is a margin extraction layer; retail media spend
        # hit $184B globally and FMCG allocates 39% of ad spend
        gp1_pct_affected=0.12,
        description="Retail media projected $200B globally by 2027. Hit $184B in 2025 with FMCG at 39% of ad spend. Precision targeting at point of purchase but another margin extraction layer. Shifts from Mental Availability (TV) to Physical Availability.",
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
        direction="Expansion", probability=3, start_year=2026,
        # 3%: Still nascent; affects niche DTC/premium segment only
        gp1_pct_affected=0.03,
        description="AI personalization moving from DTC niche toward mass feasibility. AI diagnostics, customized formulations, adaptive recommendations. L'Oreal Modiface is benchmark. Still nascent.",
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
        direction="Expansion", probability=3, start_year=2025,
        # 5%: Auto-dosing affects per-cycle volume (-23%) but creates
        # platform lock-in; net GP1 effect limited to smart washer owners
        gp1_pct_affected=0.05,
        description="Smart connected washing machine market reached $9.8B in 2024, projected $34.6B by 2033 at 14.3% CAGR (IMARC). Auto-dosing becoming standard in high-end models — cutting detergent use 23% per cycle. Henkel launched Smartwash at CES 2025: AI-enabled, cartridge-based dosing for washers and dishwashers. Hoover H-Wash 350 with Eco Doser launched Jul 2025. First-mover on dosing platform captures disproportionate value.",
        strategic_implication="Henkel Smartwash is the most differentiated LHC play. First-mover on dosing platform captures disproportionate value.",
        category_exposure=cat(0,0,0,0, 3,4,0,5,2,4,0,0),
        vc_exposure=vc(2,5,4,4,2,3,4,4),
        regional_exposure=reg(5,4,4,1),
        data_source="IMARC Smart Washing Machine Market 2024; Henkel Smartwash CES 2025; Mordor Intelligence", source_type="analyst_report",
        confidence="Medium",
    ),

    # ═══════════════════════════════════════════════════════════════════
    # FORCE 4: ENVIRONMENTAL (6 trends incl. S-01)
    # ═══════════════════════════════════════════════════════════════════

    # ── E-01 ──
    Trend(
        id="environmental_r01", force="Environmental", sub_category="Supply Chain",
        name="Palm Oil Supply Chain Disruption (Indonesia B50)",
        direction="Contraction", probability=4, start_year=2025,
        # 12%: Palm-derived surfactants are ~15-20% of raw material input;
        # B50 diverts supply, driving 20-40% price spikes on oleochemicals
        gp1_pct_affected=0.12,
        description="Indonesia B50 mandate (50% palm biodiesel blend) diverts massive volumes from oleochemicals to fuel. Indonesia = 60% of global palm oil. Oleochemical supply for FMCG surfactants directly threatened.",
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
        direction="Expansion", probability=4, start_year=2025,
        # 6%: Creates demand for new formats (dry shampoo, cold-wash)
        # but from small base; additive pool opportunity
        gp1_pct_affected=0.06,
        description="Water stress affects 40% of global population, intensifying in Southern Europe, MENA, Asia. Accelerates cold-wash, dry shampoo, waterless cleaning demand.",
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
        direction="Contraction", probability=4, start_year=2026,
        # 4%: CBAM adds ~1-3% to imported raw material costs;
        # Scope 3 reporting is compliance cost, not margin destruction
        gp1_pct_affected=0.04,
        description="EU CBAM phases in 2026-2034. CSRD Scope 3 mandatory reporting creates cost pressure through supply chain.",
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
        direction="Contraction", probability=5, start_year=2025,
        # 4%: EPR fees are ~1-2% of packaging cost; eco-modulation
        # penalties can 2-5x for non-compliant materials, but small base
        gp1_pct_affected=0.04,
        description="EPR fees escalating with eco-modulation penalties (2-5x for hard-to-recycle packaging). France CITEO is template. Multi-material packaging incurs highest penalties.",
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
        direction="Expansion", probability=4, start_year=2024,
        # 8%: Directly expands FFI addressable market by geographic
        # and seasonal expansion; concentrated effect on one category
        gp1_pct_affected=0.08,
        description="Climate warming expands geographic range of disease-carrying insects. Tiger mosquitoes established in Southern Germany/France. Longer warm seasons increase demand windows.",
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
        direction="Contraction", probability=4, start_year=2024,
        # 5%: Short-term COGS uplift from dual-sourcing premium;
        # affects raw material + logistics costs
        gp1_pct_affected=0.05,
        description="Post-COVID and geopolitical tension driving FMCG supply chain diversification. Nearshoring chemical production from Asia to Europe/Turkey. Dual-sourcing mandates increasing.",
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
        direction="Expansion", probability=4, start_year=2025,
        # 10%: Share capture opportunity in overlapping LHC categories;
        # Reckitt transition creates ~2-3 year window in ~30% of EU LHC shelf
        gp1_pct_affected=0.10,
        description="Reckitt completed divestment of Essential Home to Advent International on December 31, 2025. 70% stake sold for up to $4.8B, Reckitt retains 30% minority interest. Portfolio includes Air Wick, Calgon, Woolite, Cillit Bang, Resolve, Sole, Easy-Off plus ~75 other brands across 70+ markets. Six manufacturing facilities transferred. PE ownership = cost-cutting focus, brand neglect risk = share opportunity for Henkel.",
        strategic_implication="Capture shelf space and share during competitor transition period.",
        category_exposure=cat(0,0,0,0, 4,3,3,4,3,3,4,3),
        vc_exposure=vc(0,1,1,0,1,4,5,4),
        regional_exposure=reg(5,3,2,4),
        data_source="Reckitt Official Completion Announcement Dec 2025; Advent International Deal Terms", source_type="analyst_report",
        confidence="High",
    ),
    # ── X-02 ──
    Trend(
        id="competitive_r02", force="Competitive", sub_category="Strategy",
        name="Unilever Beauty and Wellbeing Pivot",
        direction="Contraction", probability=5, start_year=2024,
        # 15%: Direct competitive overlap in Hair Care/Body; Unilever's
        # €50B war chest intensifies fight for ~30% of Hair shelf
        gp1_pct_affected=0.15,
        description="Unilever targeting 66% revenue from Beauty & Wellbeing by 2030. FY2025: B&W underlying sales grew +4.3% (2.2% volume, 2.1% price). Wellbeing brands (Nutrafol, Liquid I.V., OLLY) delivered double-digit growth. Dove and Vaseline delivered double-digit Q1 2025 growth via premium innovation. CEO Fernandez scaling B&W to two-thirds of firm's sales. €50.5B revenue, massive budgets intensifying Hair competitive overlap.",
        strategic_implication="Accelerate Schwarzkopf premiumization before Unilever saturates the space. Care is the primary battleground.",
        category_exposure=cat(3,5,3,4, 1,1,0,1,0,0,0,0),
        vc_exposure=vc(1,3,1,1,1,5,5,4),
        regional_exposure=reg(5,5,5,5),
        data_source="Unilever FY2025 Results; Capital Markets Day 2025; CosmeticsDesign-Europe Feb 2026", source_type="analyst_report",
        confidence="High",
    ),
    # ── X-03 ──
    Trend(
        id="competitive_r03", force="Competitive", sub_category="Strategy",
        name="P&G Superiority Framework and Innovation Fortress",
        direction="Contraction", probability=5, start_year=2024,
        # 12%: P&G directly overlaps in LAD, ADW; their innovation
        # pace pressures GP1 via price/quality competition in ~40% of LHC
        gp1_pct_affected=0.12,
        description="P&G irresistible superiority framework drives disproportionate R&D and media investment. Ariel, Fairy, Pantene, H&S set category innovation bar.",
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
        direction="Contraction", probability=4, start_year=2023,
        # 8%: Indie brands capture premium sub-segments (~15% of Hair
        # premium) but limited mass-market GP1 exposure
        gp1_pct_affected=0.08,
        description="Function of Beauty, Olaplex, K18, Virtue Labs capture fastest-growing Hair sub-segments. Collectively erode premiumization growth that legacy brands need.",
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
        direction="Contraction", probability=3, start_year=2025,
        # 3%: Early-warning stage; <2% EU market share today;
        # potential future threat but current GP1 exposure minimal
        gp1_pct_affected=0.03,
        description="Florasis, Perfect Diary entering Europe via TikTok Shop/Temu. Extreme value positioning, digital-native marketing. Early-warning signal — trajectory mirrors Shein disruption.",
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
        direction="Expansion", probability=4, start_year=2024,
        # 12%: IMEA = ~15-20% of total revenue but fastest-growing;
        # structural growth driver for portfolio diversification
        gp1_pct_affected=0.12,
        description="Henkel IMEA delivered 12.1% organic growth FY2025 vs 0.9% group average. India, Middle East, Africa are structural growth drivers. Henkel investing in India manufacturing.",
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
        direction="Contraction", probability=5, start_year=2024,
        # 10%: L'Oreal's €1.7B R&D directly threatens Henkel Hair
        # Color innovation leadership; affects ~25% of premium Hair
        gp1_pct_affected=0.10,
        description="L'Oreal building beauty tech platform: AI diagnostics (Modiface), microbiome science, custom formulations. €43B revenue, 4% R&D spend (€1.7B). Redefining innovation in Hair from chemistry to tech-beauty.",
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
        direction="Contraction", probability=5, start_year=2024,
        # 20%: Discount = 25-35% of grocery; every share point to
        # discount erodes branded margin by ~3-5pp on that volume
        gp1_pct_affected=0.20,
        description="Aldi/Lidl hold 25-35% grocery share in Germany, UK, Benelux — still growing. Expanding beauty/personal care shelf, launching premium PL. Every share point to discount = lower branded economics.",
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
        direction="Contraction", probability=4, start_year=2024,
        # 8%: E-com is 12-15% of sales; pay-to-play economics erode
        # ~2-3pp margin vs offline, affecting that volume slice
        gp1_pct_affected=0.08,
        description="FMCG e-com stabilized at 12-15% in Western Europe. Pay-to-play economics converging with offline. Amazon Subscribe & Save capturing habitual replenishment.",
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
        direction="Contraction", probability=4, start_year=2024,
        # 15%: Top 10 grocers = 40-50% of sales; listing fee and
        # promotional pressure erodes ~2-4pp on the negotiated volume
        gp1_pct_affected=0.15,
        description="Top 10 European grocers control 40-50% of sales. Schwarz Group, Aldi, Carrefour, Tesco wield increasing negotiating power. Rising listing fees, promotional demands.",
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
        direction="Expansion", probability=3, start_year=2024,
        # 3%: Still <3% of FMCG sales; additive channel opportunity
        # but small current pool exposure
        gp1_pct_affected=0.03,
        description="TikTok Shop, Instagram Shopping bypassing traditional retail. Beauty is #1 TikTok Shop category. Viral products generate €10M+ in weeks.",
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
        direction="Contraction", probability=3, start_year=2024,
        # 2%: Marginal channel; ~1-2% of total FMCG sales after
        # consolidation, limited GP1 impact
        gp1_pct_affected=0.02,
        description="European q-commerce ~$64B after consolidation. Surviving players integrating with traditional retail. Groceries 44% of q-commerce.",
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
        direction="Contraction", probability=4, start_year=2024,
        # 5%: Subscription lock-in affects ~10% of volume in LAD/ADW
        # with ~2pp margin erosion from platform economics
        gp1_pct_affected=0.05,
        description="Amazon Subscribe & Save, retailer loyalty programs creating switching-cost barriers in FMCG. Subscription locks consumers into replenishment cycles.",
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
        direction="Expansion", probability=4, start_year=2025,
        # 10%: Salon-to-retail crossover creates new profit pool for
        # premium Hair; B2C = 63% of $23.4B market, growing at 4.6% CAGR
        gp1_pct_affected=0.10,
        description="Professional hair care market $23.4B in 2025, $38.3B by 2036 at 4.6% CAGR. Salon-to-retail crossover accelerating. B2C now 63% of industry share. Schwarzkopf Professional's defining moment.",
        strategic_implication="Deploy Schwarzkopf Professional expertise into consumer retail channel. Color and Care are the profit pools.",
        category_exposure=cat(5,5,4,2, 0,0,0,0,0,0,0,0),
        vc_exposure=vc(2,3,2,3,3,5,5,5),
        regional_exposure=reg(4,5,4,2),
        data_source="Future Market Insights Professional Hair Care 2025", source_type="analyst_report",
        confidence="High",
    ),

    # ═══════════════════════════════════════════════════════════════════
    # NEW TRENDS — Added March 2026 Source Audit
    # ═══════════════════════════════════════════════════════════════════

    # ── M-01: Generative AI Disrupts Product Discovery ──
    Trend(
        id="technology_r09", force="Technology", sub_category="Digital",
        name="Generative AI Disrupts Product Discovery (GEO vs. SEO)",
        direction="Contraction", probability=4, start_year=2025,
        gp1_pct_affected=0.08,
        description="35% of US consumers use AI at the product discovery stage vs. 13.6% using search engines. Google search CTR declined 3.6pp (paid) and 1.2pp (organic) in 2025. Traffic from generative AI platforms to e-commerce surged 4,700% YoY. Brand scale no longer guarantees AI visibility. 67% of organizations adopted LLMs, 63% of marketers prioritizing GEO. Fundamentally disrupts FMCG marketing ROI and Byron Sharp's Mental Availability investment model.",
        strategic_implication="Invest in Generative Engine Optimization for Schwarzkopf and Persil. Brands not cited by LLMs lose consideration before the shopper reaches the shelf. Complement SEO with structured authority content.",
        category_exposure=cat(3,3,3,3, 3,3,2,3,2,3,2,2),
        vc_exposure=vc(0,0,0,0,0,5,5,5),
        regional_exposure=reg(4,5,4,2),
        data_source="eMarketer 2026; Similarweb Gen AI Report 2025; Marketing Dive 2026", source_type="research_report",
        confidence="Medium",
    ),
    # ── M-02: Tariffs, Trade Wars, and Deglobalization ──
    Trend(
        id="government_r08", force="Government", sub_category="Trade Policy",
        name="Tariffs, Trade Wars, and Deglobalization (US-EU-China)",
        direction="Contraction", probability=4, start_year=2025,
        gp1_pct_affected=0.08,
        description="US tariff escalation (25%+ on select goods), retaliatory EU measures, and China-EU trade friction create COGS volatility and sourcing complexity. Cross-border raw material costs rising 5-15% due to tariff pass-through. Distinct from nearshoring (E-06) — this captures the macro-policy driver and demand-side pricing implications for global FMCG supply chains.",
        strategic_implication="Diversify sourcing away from single-country dependency. Model tariff dynamics into annual procurement planning. Build buffer stock for critical raw materials.",
        category_exposure=cat(2,2,2,2, 3,3,2,3,2,3,2,3),
        vc_exposure=vc(5,2,2,3,5,1,1,1),
        regional_exposure=reg(4,5,5,4),
        data_source="WTO Trade Monitoring 2025; Peterson Institute; Deloitte 2026 CPG Outlook", source_type="research_report",
        confidence="Medium",
    ),
    # ── M-03: Energy Cost Volatility and European Manufacturing ──
    Trend(
        id="environmental_r07", force="Environmental", sub_category="Cost Structure",
        name="Energy Cost Volatility and European Manufacturing Competitiveness",
        direction="Contraction", probability=4, start_year=2024,
        gp1_pct_affected=0.06,
        description="European energy costs remain 2-3x US levels despite normalization from 2022 peaks. Gas price volatility, nuclear phase-out in Germany, and green transition costs create structural COGS disadvantage for European FMCG manufacturers vs. US and Asian competitors. Energy is 8-15% of manufacturing COGS. Directly affects Henkel's European production base.",
        strategic_implication="Accelerate energy efficiency programs in European plants. Evaluate manufacturing footprint optimization. Long-term PPAs for renewable energy as hedge.",
        category_exposure=cat(2,2,2,2, 3,3,3,3,3,3,3,3),
        vc_exposure=vc(2,2,5,2,3,0,0,0),
        regional_exposure=reg(5,1,2,2),
        data_source="IEA World Energy Outlook 2025; CEFIC European Chemical Industry 2025; VCI Reports", source_type="research_report",
        confidence="High",
    ),
    # ── M-04: Generative AI Marketing Efficiency ──
    Trend(
        id="technology_r10", force="Technology", sub_category="Operations",
        name="Generative AI Content and Marketing Efficiency Revolution",
        direction="Expansion", probability=5, start_year=2025,
        gp1_pct_affected=0.05,
        description="Gen AI enables 40-60% cost reduction in FMCG content production. Automated ad creative, localization, personalization at near-zero marginal cost. P&G reduced agency spend, Unilever deploying AI content at scale. 67% of organizations worldwide adopted LLMs by 2025. Partially offsets Retail Media margin extraction (T-06).",
        strategic_implication="Deploy Gen AI for creative production, copy generation, and asset localization. Reinvest efficiency savings into reach extension. Maintain human oversight for brand safety.",
        category_exposure=cat(3,3,3,3, 3,3,2,3,2,3,2,2),
        vc_exposure=vc(0,0,0,0,0,5,4,3),
        regional_exposure=reg(4,5,4,2),
        data_source="Deloitte 2026 CPG Outlook; McKinsey Gen AI Economic Potential; Bain AI in CP 2025", source_type="research_report",
        confidence="High",
    ),
    # ── M-05: Refill and Reuse Economy in Household Care ──
    Trend(
        id="consumer_r13", force="Consumer", sub_category="Behavioral",
        name="Refill and Reuse Economy in Household Care",
        direction="Expansion", probability=3, start_year=2025,
        gp1_pct_affected=0.07,
        description="PPWR mandates reuse/refill targets from 2030. Consumer demand for refillable cleaning products growing at 12%+ CAGR from small base. Refill station pilots expanding in European retail (dm, Rossmann, Carrefour). Fundamentally changes unit economics — lower per-use cost but potentially higher margin per use-occasion. Concentrated refills reduce logistics cost 40-60%.",
        strategic_implication="Develop Persil and Pril refill formats for dm/Rossmann. Concentrated refills align with PPWR and sustainability narrative. Test subscription-refill DTC model.",
        category_exposure=cat(0,1,0,1, 4,4,0,5,3,3,2,1),
        vc_exposure=vc(1,3,2,5,3,3,3,4),
        regional_exposure=reg(5,3,2,2),
        data_source="Ellen MacArthur Foundation Reuse Report; PPWR reuse targets; dm/Rossmann refill announcements", source_type="research_report",
        confidence="Low",
    ),
    # ── CJ-01 integrated: Between-Wash Fabric Care ──
    Trend(
        id="consumer_r14", force="Consumer", sub_category="Category Creation",
        name="Between-Wash Fabric Care as Standalone Consumption Occasion",
        direction="Expansion", probability=4, start_year=2024,
        gp1_pct_affected=0.06,
        description="Fabric refresh sprays, garment steamers, and between-wash care products growing at 8-10% CAGR. Febreze alone is a $1B+ brand. Garment steamer adoption replacing traditional ironing. Sustainability-driven 'outfit repeating' reduces wash frequency but expands between-wash care demand. Henkel has zero presence in this growing consumption occasion.",
        strategic_implication="Evaluate fabric refresh product line under Vernel or new brand. The White Spot score (0.82) confirms this is the #1 strategic gap in the consumer journey. Test in Germany/UK first.",
        category_exposure=cat(0,0,0,0, 4,5,0,3,0,0,0,0),
        vc_exposure=vc(2,4,2,3,2,4,3,5),
        regional_exposure=reg(4,5,3,2),
        data_source="P&G Febreze brand data; Euromonitor Fabric Care 2025; Consumer journey white spot analysis", source_type="market_report",
        confidence="Medium",
    ),
    # ── CJ-02 integrated: Textile Longevity ──
    Trend(
        id="environmental_r08", force="Environmental", sub_category="Sustainability",
        name="Textile Longevity and Garment Life Extension Economy",
        direction="Expansion", probability=3, start_year=2025,
        gp1_pct_affected=0.04,
        description="EU Strategy for Sustainable and Circular Textiles mandates durability standards. Growing consumer awareness of garment lifespan — mending, garment protection, gentle washing all growing. Creates demand for fabric protection products, enzyme-based pilling removers, color-restore treatments. Market for garment longevity products est. $2-3B globally.",
        strategic_implication="Position Persil and Vernel as 'garment longevity partners' — washing products that demonstrably extend textile life. Innovation opportunity in fabric protection and color-restore.",
        category_exposure=cat(1,1,0,0, 4,5,0,4,0,0,0,0),
        vc_exposure=vc(2,4,2,2,1,4,3,5),
        regional_exposure=reg(5,3,2,2),
        data_source="EU Circular Textiles Strategy; Ellen MacArthur Foundation; Euromonitor Fabric Care 2025", source_type="regulation",
        confidence="Low",
    ),
    # ── CJ-03 integrated: Hair Styling Between Washes ──
    Trend(
        id="consumer_r15", force="Consumer", sub_category="Category Creation",
        name="Hair Styling and Maintenance Between Washes",
        direction="Expansion", probability=4, start_year=2024,
        gp1_pct_affected=0.05,
        description="Dry shampoo market growing at 7%+ CAGR. Texture sprays, overnight treatments, next-day products are the fastest-growing Hair sub-segments. Batiste (Church & Dwight) dominates with 40%+ share. got2b has presence but underleveraged. Distinct from scalp care (C-07) — this is about styling convenience and wash frequency reduction.",
        strategic_implication="Expand got2b dry shampoo and texture spray range. Leverage Schwarzkopf salon expertise for premium between-wash products. Fastest path to incremental Hair occasions.",
        category_exposure=cat(0,2,5,1, 0,0,0,0,0,0,0,0),
        vc_exposure=vc(2,4,2,3,2,5,4,5),
        regional_exposure=reg(4,5,3,2),
        data_source="Euromonitor Hair Styling 2025; Church & Dwight Batiste data; Spate trend data", source_type="market_report",
        confidence="Medium",
    ),
]


# ═══════════════════════════════════════════════════════════════════════
# SOURCE URLs — Working links to original evidence
# ═══════════════════════════════════════════════════════════════════════

SOURCE_URLS = {
    # ═══ CONSUMER ═══
    "consumer_r01": [  # Private Label Structural Penetration in Europe
        {"title": "NIQ: Private Label Power in Western Europe", "url": "https://nielseniq.com/global/en/insights/analysis/2025/private-label-power-in-western-europe-confidence-value-and-innovation-drive-growth/", "source_type": "market_report", "tier": "A"},
        {"title": "Circana: CPG Private Label Value Share Climbs to 42% Across EU6", "url": "https://www.circana.com/post/cpg-private-label-value-share-climbs-to-42-across-eu6-rising-to-44-in-supermarkets-reports-circ", "source_type": "market_report", "tier": "A"},
        {"title": "PLMA International: European Private Label at €291B and 40% Share", "url": "https://www.esmmagazine.com/private-label/european-private-label-business-reaches-e291bn-and-40-market-share-302480", "source_type": "market_report", "tier": "B"},
        {"title": "Flipflow: Analysis of Private Brands in Europe 2025", "url": "https://www.flipflow.io/en/blog-en/analysis-of-private-brands-in-europe-2025/", "source_type": "market_report", "tier": "B+"},
    ],
    "consumer_r02": [  # GLP-1 Drugs Reshape Consumer Spending
        {"title": "McKinsey: Future of Wellness Trends 2025", "url": "https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights/future-of-wellness-trends", "source_type": "research_report", "tier": "A"},
        {"title": "Harvard Business Review: How GLP-1 Medications Are Changing Consumer Behavior", "url": "https://hbr.org/2025/10/how-glp-1-medications-are-changing-consumer-behavior", "source_type": "research_report", "tier": "A"},
        {"title": "WGSN/CosmeticsDesign-Europe: How GLP-1 Drugs Are Reshaping Beauty Innovation", "url": "https://www.cosmeticsdesign-europe.com/Article/2026/03/20/how-glp1-drugs-are-reshaping-beauty-and-wellness-innovation/", "source_type": "trade_press", "tier": "B"},
        {"title": "JP Morgan: How Supply and Demand for Weight Loss Drugs is Playing Out in 2026", "url": "https://www.jpmorgan.com/insights/global-research/current-events/obesity-drugs", "source_type": "research_report", "tier": "A-"},
    ],
    "consumer_r03": [  # Premiumization Acceleration in Hair Care
        {"title": "Euromonitor: Premiumisation in Hair Care", "url": "https://www.euromonitor.com/premiumisation-in-hair-care/report", "source_type": "market_report", "tier": "A"},
        {"title": "Mordor Intelligence: Premium Hair Care Market Size & Trends 2030", "url": "https://www.mordorintelligence.com/industry-reports/global-premium-hair-care-market", "source_type": "market_report", "tier": "B+"},
        {"title": "Business of Fashion: The Next Big Beauty Boom — Hair", "url": "https://www.businessoffashion.com/articles/beauty/best-of-bof-beauty-hair-2025/", "source_type": "trade_press", "tier": "B"},
        {"title": "Kline Group: Scalp Care Boom & Professional Hair Care Trends", "url": "https://klinegroup.com/beauty-and-wellbeing/professional-hair-care/the-scalp-care-boom-are-brands-unlocking-growth-from-the-root-up/", "source_type": "market_report", "tier": "B+"},
    ],
    "consumer_r04": [  # Conscious Consumption and Cleanical Beauty
        {"title": "Mintel: Global Beauty & Personal Care Trends 2025", "url": "https://www.mintel.com/press-centre/mintel-announces-global-beauty-and-personal-care-trends-for-2025/", "source_type": "research_report", "tier": "A"},
        {"title": "CosmeticsDesign-Europe: Clean Beauty Category Tracker", "url": "https://www.cosmeticsdesign-europe.com/", "source_type": "trade_press", "tier": "B"},
        {"title": "Beauty Independent: What Will Be In and Out For Haircare in 2026", "url": "https://www.beautyindependent.com/what-will-be-in-out-haircare-2026/", "source_type": "trade_press", "tier": "B"},
        {"title": "EU Green Claims Directive COM/2023/166 — Cross-reference G-05", "url": "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex:52023PC0166", "source_type": "regulation", "tier": "S"},
    ],
    "consumer_r05": [  # Silver Economy — Aging Population
        {"title": "Eurostat: Ageing Europe — Statistics on Population Developments", "url": "https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Ageing_Europe_-_statistics_on_population_developments", "source_type": "government_data", "tier": "S"},
        {"title": "UN World Population Prospects 2024 Revision", "url": "https://population.un.org/wpp/", "source_type": "government_data", "tier": "S"},
        {"title": "WHO: Decade of Healthy Ageing 2021-2030", "url": "https://www.who.int/initiatives/decade-of-healthy-ageing", "source_type": "government_data", "tier": "S"},
        {"title": "OECD Health Statistics 2025", "url": "https://www.oecd.org/health/health-data.htm", "source_type": "government_data", "tier": "S"},
    ],
    "consumer_r06": [  # Cost-of-Living Squeeze and Trading Down
        {"title": "Euromonitor: Affordability, Value & Cost of Living", "url": "https://www.euromonitor.com/affordability-value-and-the-cost-of-living/report", "source_type": "market_report", "tier": "A"},
        {"title": "ECB Consumer Expectations Survey", "url": "https://www.ecb.europa.eu/stats/ecb_surveys/consumer_exp_survey/html/index.en.html", "source_type": "government_data", "tier": "S"},
        {"title": "GfK Consumer Climate Index Germany", "url": "https://www.gfk.com/en/insights/press-release/gfk-consumer-climate", "source_type": "market_report", "tier": "A"},
        {"title": "NIQ: State of the Consumer 2026", "url": "https://nielseniq.com/global/en/news-center/2025/niqs-global-report-reveals-challenges-and-opportunities-for-private-label-and-branded-product-growth/", "source_type": "market_report", "tier": "A"},
    ],
    "consumer_r07": [  # Scalp Care Emerges as Standalone Category
        {"title": "Grand View Research: Scalp Care Market Size Report", "url": "https://www.grandviewresearch.com/industry-analysis/scalp-care-market-report", "source_type": "market_report", "tier": "B+"},
        {"title": "Kline Group: The Scalp Care Boom — Unlocking Growth from the Root Up", "url": "https://klinegroup.com/beauty-and-wellbeing/professional-hair-care/the-scalp-care-boom-are-brands-unlocking-growth-from-the-root-up/", "source_type": "market_report", "tier": "B+"},
        {"title": "GlobeNewsWire: North America Hair Care 2025-2030 — Skinification of Hair", "url": "https://www.globenewswire.com/news-release/2025/06/12/3098168/28124/en/North-America-Hair-Care-Market-Competition-and-Forecasts-2025-2030-Rise-of-Scalp-Care-and-Skinification-of-Hair.html", "source_type": "market_report", "tier": "B+"},
        {"title": "Spate: Real-Time Consumer Search Trend Data — Scalp Care", "url": "https://www.spate.nyc/", "source_type": "data_tool", "tier": "B+"},
    ],
    "consumer_r08": [  # Male Grooming Structural Growth
        {"title": "Statista Consumer Market Outlook 2026", "url": "https://www.statista.com/outlook/cmo/beauty-personal-care/worldwide", "source_type": "market_forecast", "tier": "D"},
        {"title": "Euromonitor: Men's Grooming Global Overview 2025", "url": "https://www.euromonitor.com/mens-grooming-in-the-us/report", "source_type": "market_report", "tier": "A"},
        {"title": "Allied Market Research: Men's Personal Care Market", "url": "https://www.alliedmarketresearch.com/mens-personal-care-market", "source_type": "market_report", "tier": "D"},
        {"title": "Mintel: Men's Grooming & Haircare 2025", "url": "https://store.mintel.com/report/us-mens-grooming-market-report", "source_type": "market_report", "tier": "A"},
    ],
    "consumer_r09": [  # Fragrance and Sensory Premiumization in Home Care
        {"title": "McKinsey: Trends Defining the $1.8T Global Wellness Market", "url": "https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights/the-trends-defining-the-1-point-8-trillion-dollar-global-wellness-market-in-2024", "source_type": "research_report", "tier": "A"},
        {"title": "Euromonitor: Home Care — Fabric Softeners & Scent Boosters 2025", "url": "https://www.euromonitor.com/home-care", "source_type": "market_report", "tier": "A"},
        {"title": "IFF Annual Report 2025 — Fragrance Demand Growth", "url": "https://www.iff.com/investors", "source_type": "annual_report", "tier": "B-"},
        {"title": "Kantar: Premiumization in Laundry Panel Data", "url": "https://www.kantar.com/", "source_type": "market_report", "tier": "A"},
    ],
    "consumer_r10": [  # Hair Loss and Thinning Treatments
        {"title": "Coherent Market Insights: Hair Loss Treatment Market 2025-2032", "url": "https://www.coherentmarketinsights.com/market-insight/hair-loss-treatment-market-4374", "source_type": "market_report", "tier": "B+"},
        {"title": "Grand View Research: Hair Loss Treatment Market 2025", "url": "https://www.grandviewresearch.com/industry-analysis/hair-loss-treatment-market", "source_type": "market_report", "tier": "B+"},
        {"title": "American Academy of Dermatology: Clinical Statistics", "url": "https://www.aad.org/media/stats-hair-loss", "source_type": "research_report", "tier": "S"},
        {"title": "Fortune Business Insights: Hair Care Market 2034", "url": "https://www.fortunebusinessinsights.com/hair-care-market-102555", "source_type": "market_report", "tier": "B+"},
    ],
    "consumer_r11": [  # Gen Z Dupe Culture and Ingredient Literacy
        {"title": "Mintel: US Gen Z Beauty Consumer Report", "url": "https://store.mintel.com/report/us-gen-z-beauty-consumer-market-report", "source_type": "market_report", "tier": "A"},
        {"title": "Beauty Independent: What Will Be In and Out For Haircare in 2026", "url": "https://www.beautyindependent.com/what-will-be-in-out-haircare-2026/", "source_type": "trade_press", "tier": "B"},
        {"title": "Attest: Gen Z Beauty Consumer Report 2025", "url": "https://www.askattest.com/", "source_type": "research_report", "tier": "B+"},
        {"title": "eMarketer: How GEO and AI Will Change Discovery in 2026", "url": "https://www.emarketer.com/content/how-experts-say-geo--ai-will-change-discovery-2026", "source_type": "research_report", "tier": "A"},
    ],
    "consumer_r12": [  # Post-COVID Hygiene Habits Persistence
        {"title": "Allied Market Research: Surface Disinfectant Market 2025", "url": "https://www.alliedmarketresearch.com/surface-disinfectant-market", "source_type": "market_report", "tier": "D"},
        {"title": "Euromonitor: Home Care 2025 — Hygiene Sub-segment", "url": "https://www.euromonitor.com/home-care", "source_type": "market_report", "tier": "A"},
        {"title": "NIQ: Household Care Panel Data 2025", "url": "https://nielseniq.com/global/en/", "source_type": "market_report", "tier": "A"},
        {"title": "WHO: Global Hygiene Guidelines Updates", "url": "https://www.who.int/health-topics/hygiene", "source_type": "government_data", "tier": "S"},
    ],

    # ═══ GOVERNMENT ═══
    "government_r01": [  # EU PFAS Universal Restriction
        {"title": "ECHA: Universal PFAS Restriction Proposal", "url": "https://echa.europa.eu/hot-topics/perfluoroalkyl-chemicals-pfas", "source_type": "regulation", "tier": "S"},
        {"title": "ECHA: Supports PFAS Restriction with Targeted Derogations (Mar 2026)", "url": "https://echa.europa.eu/-/echa-supports-pfas-restriction-with-targeted-derogations", "source_type": "regulation", "tier": "S"},
        {"title": "Ricardo: The Evolving European PFAS Restriction — Where We Stand in 2025", "url": "https://www.ricardo.com/en/news-and-insights/industry-insights/the-evolving-european-pfas-restriction-proposal-where-we-stand-in-2025", "source_type": "research_report", "tier": "B+"},
        {"title": "EEB: ECHA Experts Back EU-Wide Restriction of PFAS Forever Chemicals (Mar 2026)", "url": "https://meta.eeb.org/2026/03/26/echa-experts-back-eu-wide-restriction-of-pfas-forever-chemicals/", "source_type": "news", "tier": "B"},
    ],
    "government_r02": [  # EU Microplastics Ban Phase 2
        {"title": "ECHA: Microplastics Restriction", "url": "https://echa.europa.eu/hot-topics/microplastics", "source_type": "regulation", "tier": "S"},
        {"title": "REACH24H: EU Microplastics Restriction Key Deadlines", "url": "https://en.reach24h.com/news/insights/chemical/eu-microplastics-spm-restriction-deadline", "source_type": "research_report", "tier": "B+"},
        {"title": "Certivo: EU Microplastics Ban 2026 — Reporting and Reformulation Requirements", "url": "https://www.certivo.com/blog-details/eu-microplastics-ban-2026-mandatory-reporting-and-reformulation-requirements-under-reach-annex-xvii", "source_type": "research_report", "tier": "B+"},
        {"title": "Freshfields: EU Regulations on Microplastics — Big Steps Against Small Particles", "url": "https://sustainability.freshfields.com/post/102l6lb/eu-regulations-on-microplastics-big-steps-against-small-particles", "source_type": "research_report", "tier": "A"},
    ],
    "government_r03": [  # EU Cosmetics Regulation Omnibus VII/VIII
        {"title": "EUR-Lex: EC 1223/2009 Cosmetics Regulation", "url": "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32009R1223", "source_type": "regulation", "tier": "S"},
        {"title": "COSlaw.eu: EU Cosmetics Regulatory Change Tracker", "url": "https://coslaw.eu/", "source_type": "regulation", "tier": "B+"},
        {"title": "SCCS: Scientific Committee on Consumer Safety Opinions", "url": "https://health.ec.europa.eu/scientific-committees/scientific-committee-consumer-safety-sccs_en", "source_type": "regulation", "tier": "S"},
        {"title": "Cosmetics Europe: Industry Position on Annex Amendments", "url": "https://cosmeticseurope.eu/", "source_type": "trade_press", "tier": "B"},
    ],
    "government_r04": [  # EU PPWR — Packaging Waste Regulation
        {"title": "EC: Packaging and Packaging Waste Regulation", "url": "https://environment.ec.europa.eu/topics/waste-and-recycling/packaging-waste/packaging-packaging-waste-regulation_en", "source_type": "regulation", "tier": "S"},
        {"title": "Gleiss Lutz: New EU Packaging Regulation — Key Requirements from August 2026", "url": "https://www.gleisslutz.com/en/know-how/new-eu-packaging-regulation-key-requirements-august-2026", "source_type": "research_report", "tier": "A"},
        {"title": "Circularise: PPWR Guide to Compliance, Timelines, and Mass Balance", "url": "https://www.circularise.com/blogs/ppwr-guide-to-compliance-timelines-and-mass-balance-solutions", "source_type": "research_report", "tier": "B+"},
        {"title": "EUR-Lex: Packaging and Packaging Waste from 2026 — Legal Summary", "url": "https://eur-lex.europa.eu/EN/legal-content/summary/packaging-and-packaging-waste-from-2026.html", "source_type": "regulation", "tier": "S"},
    ],
    "government_r05": [  # EU Green Claims Directive / EmpCo
        {"title": "EUR-Lex: Green Claims Directive COM/2023/166", "url": "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex:52023PC0166", "source_type": "regulation", "tier": "S"},
        {"title": "BEUC: European Consumer Organisation — Green Claims Position", "url": "https://www.beuc.eu/", "source_type": "research_report", "tier": "B+"},
        {"title": "CMA UK: Green Claims Code Enforcement Cases", "url": "https://www.gov.uk/government/publications/green-claims-code", "source_type": "regulation", "tier": "S"},
        {"title": "Ecoact: Green Claims Substantiation Methodology", "url": "https://eco-act.com/", "source_type": "research_report", "tier": "B+"},
    ],
    "government_r06": [  # EU Deforestation Regulation (EUDR)
        {"title": "EC: Regulation on Deforestation-free Products", "url": "https://environment.ec.europa.eu/topics/forests/deforestation/regulation-deforestation-free-products_en", "source_type": "regulation", "tier": "S"},
        {"title": "RSPO: EUDR Compliance Guidance for Palm Oil", "url": "https://rspo.org/", "source_type": "regulation", "tier": "B+"},
        {"title": "Proforest: Palm Oil Traceability for EUDR Compliance", "url": "https://www.proforest.net/", "source_type": "research_report", "tier": "B+"},
        {"title": "Deloitte: EUDR Compliance Readiness for FMCG", "url": "https://www.deloitte.com/", "source_type": "research_report", "tier": "A"},
    ],
    "government_r07": [  # EU Digital Product Passport (DPP)
        {"title": "EU Digital Product Passport Initiative", "url": "https://data.europa.eu/en/news-events/news/eus-digital-product-passport-advancing-transparency-and-sustainability", "source_type": "regulation", "tier": "S"},
        {"title": "GS1: Digital Product Passport Technical Standards", "url": "https://www.gs1.org/standards/digital-product-passport", "source_type": "research_report", "tier": "B+"},
        {"title": "CIRPASS: EU DPP Pilot Project Results", "url": "https://cirpassproject.eu/", "source_type": "research_report", "tier": "B+"},
        {"title": "EC ESPR: Delegated Acts Timeline for Detergents", "url": "https://single-market-economy.ec.europa.eu/sectors/sustainability/espr_en", "source_type": "regulation", "tier": "S"},
    ],

    # ═══ TECHNOLOGY ═══
    "technology_r01": [  # AI-Driven Formulation and Speed-to-Market
        {"title": "Deloitte: AI in Manufacturing & Formulation", "url": "https://www2.deloitte.com/us/en/insights/industry/manufacturing/ai-in-manufacturing.html", "source_type": "research_report", "tier": "A"},
        {"title": "BCG: Unlocking AI Value in Manufacturing 2025", "url": "https://www.bcg.com/publications/2025/ai-in-manufacturing", "source_type": "research_report", "tier": "A"},
        {"title": "Deloitte: 2026 Consumer Products Outlook", "url": "https://www.deloitte.com/us/en/insights/industry/consumer-products/consumer-products-industry-outlook.html", "source_type": "research_report", "tier": "A"},
        {"title": "P&G Investor Day: AI R&D Investment Disclosures", "url": "https://us.pg.com/annualreport2024/", "source_type": "annual_report", "tier": "B-"},
    ],
    "technology_r02": [  # Bio-Based and Green Chemistry Alternatives
        {"title": "Novozymes: Enzyme Solutions for Laundry", "url": "https://www.novozymes.com/en/solutions/household-care/laundry", "source_type": "company_page", "tier": "B-"},
        {"title": "dsm-firmenich: Enzyme/Biotech Platform — Annual Report 2025", "url": "https://www.dsm-firmenich.com/corporate/investors.html", "source_type": "annual_report", "tier": "B-"},
        {"title": "EC: Chemical Strategy for Sustainability Progress", "url": "https://environment.ec.europa.eu/strategy/chemicals-strategy_en", "source_type": "regulation", "tier": "S"},
        {"title": "BASF: Bio-Surfactant Platform Announcements", "url": "https://www.basf.com/global/en/who-we-are/sustainability/we-produce-safely-and-efficiently/responsible-care.html", "source_type": "company_page", "tier": "B-"},
    ],
    "technology_r03": [  # Concentrated and Solid Formats Innovation
        {"title": "Unilever: Concentrated Refill Systems", "url": "https://www.unilever.com/news/press-and-media/press-releases/2024/unilever-to-roll-out-refill-and-reuse-solutions/", "source_type": "company_page", "tier": "B-"},
        {"title": "Euromonitor: Concentrated Laundry Detergent Penetration", "url": "https://www.euromonitor.com/laundry-care", "source_type": "market_report", "tier": "A"},
        {"title": "WRAP UK: Concentrated Product Environmental Impact Assessment", "url": "https://wrap.org.uk/", "source_type": "research_report", "tier": "B+"},
        {"title": "Henkel FY2025: Persil Concentrated Format Sales Data", "url": "https://www.henkel.com/investors-and-analysts/financial-reports", "source_type": "annual_report", "tier": "B-"},
    ],
    "technology_r04": [  # Microbiome Science for Hair and Skin
        {"title": "Grand View Research: Microbiome Skincare Market", "url": "https://www.grandviewresearch.com/industry-analysis/microbiome-skincare-market-report", "source_type": "market_report", "tier": "B+"},
        {"title": "Verified Market Research: Microbiome Cosmetics Market 2025", "url": "https://www.verifiedmarketresearch.com/", "source_type": "market_report", "tier": "B+"},
        {"title": "P&G: Head & Shoulders Microbiome Messaging Launch", "url": "https://us.pg.com/", "source_type": "company_page", "tier": "B-"},
        {"title": "Kline Group: Microbiome-Positioned Beauty Products Retail Audit", "url": "https://klinegroup.com/", "source_type": "market_report", "tier": "B+"},
    ],
    "technology_r05": [  # Manufacturing Automation and Industry 4.0
        {"title": "Deloitte: Manufacturing Outlook 2026", "url": "https://www2.deloitte.com/us/en/insights/industry/manufacturing/manufacturing-industry-outlook.html", "source_type": "research_report", "tier": "A"},
        {"title": "WEF: Global Lighthouse Network — FMCG Factory Case Studies", "url": "https://www.weforum.org/communities/global-lighthouse-network/", "source_type": "research_report", "tier": "A"},
        {"title": "McKinsey: The Future of Manufacturing 2025", "url": "https://www.mckinsey.com/capabilities/operations/our-insights", "source_type": "research_report", "tier": "A"},
        {"title": "Capgemini: Smart Factory at Scale — FMCG Benchmarks", "url": "https://www.capgemini.com/insights/research-library/smart-factories/", "source_type": "research_report", "tier": "A"},
    ],
    "technology_r06": [  # Retail Media Networks as Primary FMCG Channel
        {"title": "eMarketer: Retail Media Forecast 2025", "url": "https://www.emarketer.com/content/global-retail-media-ad-spending-forecast-2025", "source_type": "market_report", "tier": "A"},
        {"title": "Adtelligent: Retail Media Market Outlook 2026 — $184B Global", "url": "https://adtelligent.com/blog/retail-media-market-outlook/", "source_type": "market_report", "tier": "B+"},
        {"title": "Mordor Intelligence: Retail Media Networks Market Size 2031", "url": "https://www.mordorintelligence.com/industry-reports/retail-media-networks-market", "source_type": "market_report", "tier": "B+"},
        {"title": "Nielsen: The Future of Retail Media 2025", "url": "https://www.nielsen.com/insights/2025/future-retail-media/", "source_type": "market_report", "tier": "A"},
    ],
    "technology_r07": [  # AI-Powered Personalization at Scale
        {"title": "Perfect Corp: AI-Powered Beauty Personalization", "url": "https://www.perfectcorp.com/business", "source_type": "company_page", "tier": "B-"},
        {"title": "CB Insights: Beauty Tech Funding Landscape 2025", "url": "https://www.cbinsights.com/research/beauty-tech/", "source_type": "research_report", "tier": "A"},
        {"title": "Similarweb: AI Beauty App Traffic and Engagement", "url": "https://www.similarweb.com/", "source_type": "data_tool", "tier": "B+"},
        {"title": "L'Oreal: Modiface AI Platform — Annual Report 2025", "url": "https://www.loreal.com/en/group/about-loreal/strategy/", "source_type": "annual_report", "tier": "B-"},
    ],
    "technology_r08": [  # Connected Appliances and Auto-Dosing
        {"title": "Henkel: Smart Home & Connected Solutions", "url": "https://www.henkel.com/innovation", "source_type": "company_page", "tier": "B-"},
        {"title": "IMARC: Smart Connected Washing Machine Market — $9.8B to $34.6B by 2033", "url": "https://www.imarcgroup.com/smart-connected-washing-machine-market", "source_type": "market_report", "tier": "B+"},
        {"title": "Mordor Intelligence: Smart Washing Machine Market — $11.7B to $25.9B by 2030", "url": "https://www.mordorintelligence.com/industry-reports/smart-washing-machine-market", "source_type": "market_report", "tier": "B+"},
        {"title": "Fortune Business Insights: Fully Automatic Washing Machine Market — $38B to $80B by 2034", "url": "https://www.fortunebusinessinsights.com/fully-automatic-washing-machine-market-113037", "source_type": "market_report", "tier": "B+"},
    ],

    # ═══ ENVIRONMENTAL ═══
    "environmental_r01": [  # Palm Oil Supply Chain Disruption (Indonesia B50)
        {"title": "Reuters: Indonesia B50 Biodiesel Mandate Impact", "url": "https://www.reuters.com/business/energy/indonesia-launches-b50-biodiesel-programme-2025-02-13/", "source_type": "news", "tier": "C"},
        {"title": "S&P Global: Indonesia Keeps 2026 Biodiesel Quota Flat — Doubts over B50", "url": "https://www.spglobal.com/energy/en/news-research/latest-news/agriculture/122325-indonesia-keeps-2026-biodiesel-quota-flat-raising-doubts-over-b50-target", "source_type": "research_report", "tier": "A"},
        {"title": "USDA FAS: Indonesia Biofuels Annual Report", "url": "https://apps.fas.usda.gov/newgainapi/api/Report/DownloadReportByFileName?fileName=Biofuels+Annual_Jakarta_Indonesia_ID2024-0018.pdf", "source_type": "government_data", "tier": "S"},
        {"title": "ChemTradeAsia: Oleic Acid Supply Chains Realign Under Indonesia B60", "url": "https://www.chemtradeasia.co.id/market-insights/oleic-acid-supply-chain-indonesia-b60-digitisation", "source_type": "trade_press", "tier": "B"},
    ],
    "environmental_r02": [  # Water Scarcity Drives Low-Water Formulations
        {"title": "WRI: Aqueduct Water Risk Atlas", "url": "https://www.wri.org/applications/aqueduct/water-risk-atlas/", "source_type": "data_tool", "tier": "A"},
        {"title": "UN-Water: World Water Development Report 2025", "url": "https://www.unwater.org/publications/un-world-water-development-report-2025", "source_type": "government_data", "tier": "S"},
        {"title": "IPCC AR6: Water Scarcity Projections for Southern Europe", "url": "https://www.ipcc.ch/report/ar6/syr/", "source_type": "research_report", "tier": "S"},
        {"title": "CDP Water Security: Corporate Water Risk Disclosure Data", "url": "https://www.cdp.net/en/water", "source_type": "data_tool", "tier": "A"},
    ],
    "environmental_r03": [  # Carbon Border Adjustment and Scope 3 Reporting
        {"title": "EC: Carbon Border Adjustment Mechanism (CBAM)", "url": "https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en", "source_type": "regulation", "tier": "S"},
        {"title": "PwC: CSRD Scope 3 Implementation Guide for Consumer Goods", "url": "https://www.pwc.com/gx/en/services/audit-assurance/corporate-reporting/csrd.html", "source_type": "research_report", "tier": "A"},
        {"title": "CDP Supply Chain: Scope 3 Disclosure Rates in FMCG", "url": "https://www.cdp.net/en/supply-chain", "source_type": "data_tool", "tier": "A"},
        {"title": "EC: CBAM Implementation Progress Reports 2025-2026", "url": "https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en", "source_type": "regulation", "tier": "S"},
    ],
    "environmental_r04": [  # EPR Fee Escalation and Eco-Modulation
        {"title": "CITEO France: EPR Fee Schedule and Eco-Modulation", "url": "https://www.citeo.com/en", "source_type": "regulation", "tier": "S"},
        {"title": "EUROPEN: EPR Fee Comparison Across EU Member States", "url": "https://europen-packaging.eu/", "source_type": "research_report", "tier": "B+"},
        {"title": "Der Grüne Punkt/DSD Germany: Fee Schedule and Eco-Modulation", "url": "https://www.gruener-punkt.de/en", "source_type": "regulation", "tier": "S"},
        {"title": "Ellen MacArthur Foundation: EPR for Packaging Global Benchmarking", "url": "https://www.ellenmacarthurfoundation.org/topics/policy/extended-producer-responsibility", "source_type": "research_report", "tier": "A"},
    ],
    "environmental_r05": [  # Climate-Driven Pest Pattern Shifts
        {"title": "ECDC: Vector-borne Disease Surveillance", "url": "https://www.ecdc.europa.eu/en/disease-vectors/surveillance-and-disease-data", "source_type": "government_data", "tier": "S"},
        {"title": "WHO: Vector-Borne Disease Risk Maps — Climate Scenarios", "url": "https://www.who.int/news-room/fact-sheets/detail/vector-borne-diseases", "source_type": "government_data", "tier": "S"},
        {"title": "ECDC: Aedes Albopictus Distribution Maps 2025", "url": "https://www.ecdc.europa.eu/en/disease-vectors/surveillance-and-disease-data/mosquito-maps", "source_type": "government_data", "tier": "S"},
        {"title": "German Federal Environment Agency (UBA): Vector Monitoring", "url": "https://www.umweltbundesamt.de/en", "source_type": "government_data", "tier": "S"},
    ],
    "environmental_r06": [  # Supply Chain Nearshoring and Geopolitical Diversification
        {"title": "McKinsey: Supply Chain Resilience Report 2025", "url": "https://www.mckinsey.com/capabilities/operations/our-insights/supply-chains-to-build-resilience-manage-proactively", "source_type": "research_report", "tier": "A"},
        {"title": "Kearney: Annual Reshoring Index 2025", "url": "https://www.kearney.com/service/operations-performance/reshoring-index", "source_type": "research_report", "tier": "A"},
        {"title": "CEFIC: European Chemical Production Data 2025", "url": "https://cefic.org/", "source_type": "research_report", "tier": "B+"},
        {"title": "BCG: Global Supply Chain Risk Assessment 2025", "url": "https://www.bcg.com/capabilities/operations/supply-chain-management", "source_type": "research_report", "tier": "A"},
    ],

    # ═══ COMPETITIVE ═══
    "competitive_r01": [  # Reckitt Essential Home Divestiture
        {"title": "Reckitt: Strategic Review and Investor Update", "url": "https://www.reckitt.com/investors/", "source_type": "earnings_report", "tier": "B-"},
        {"title": "Reckitt: Completes Divestment of Essential Home (Dec 2025)", "url": "https://www.reckitt.com/media-landing/press-releases/2025/reckitt-completes-divestment-of-essential-home/", "source_type": "company_page", "tier": "B-"},
        {"title": "Advent International Acquires Reckitt Essential Home — $4.8B Deal", "url": "https://www.corpdev.org/2025/07/22/private-equity-giant-advent-acquires-reckitts-essential-home-in-4-8-billion-strategic-carve-out/", "source_type": "news", "tier": "C"},
        {"title": "Consumer Goods Technology: Reckitt Divestiture Industry Analysis", "url": "https://consumergoods.com/reckitt-divest-essential-home-business", "source_type": "trade_press", "tier": "B"},
    ],
    "competitive_r02": [  # Unilever Beauty and Wellbeing Pivot
        {"title": "Unilever: Growth Action Plan and Strategy", "url": "https://www.unilever.com/our-company/strategy/", "source_type": "strategy_document", "tier": "B-"},
        {"title": "CosmeticsDesign-Europe: Premium Innovation Drives Unilever B&W Gains (Feb 2026)", "url": "https://www.cosmeticsdesign-europe.com/Article/2026/02/13/premium-innovation-drives-unilevers-gains-in-beauty-wellbeing/", "source_type": "trade_press", "tier": "B"},
        {"title": "BeautyMatter: Unilever H1 2025 — B&W Now Core Growth Engine", "url": "https://beautymatter.com/articles/unilever-h1-2025-beauty-and-wellbeing-now-core-growth-engine", "source_type": "trade_press", "tier": "B"},
        {"title": "Unilever: FY2025 Results — B&W Underlying Sales +4.3%", "url": "https://www.unilever.com/news/news-search/2026/whats-behind-unilevers-2025-full-year-results/", "source_type": "annual_report", "tier": "B-"},
    ],
    "competitive_r03": [  # P&G Superiority Framework and Innovation Fortress
        {"title": "P&G: Annual Report and Investor Presentation 2024", "url": "https://us.pg.com/annualreport2024/", "source_type": "annual_report", "tier": "B-"},
        {"title": "Kantar BrandZ: P&G Brand Equity Tracking — Ariel, Fairy, H&S", "url": "https://www.kantar.com/campaigns/brandz", "source_type": "market_report", "tier": "A"},
        {"title": "P&G FY2025 Earnings Call Transcript", "url": "https://us.pg.com/investor-relations/", "source_type": "earnings_report", "tier": "B-"},
        {"title": "AlixPartners: FMCG Innovation Benchmark — P&G vs Peers", "url": "https://www.alixpartners.com/", "source_type": "research_report", "tier": "A"},
    ],
    "competitive_r04": [  # DTC and Indie Brand Disruption in Hair
        {"title": "Euromonitor: Hair Care — DTC and Indie Brand Disruption", "url": "https://www.euromonitor.com/hair-care", "source_type": "market_report", "tier": "A"},
        {"title": "CB Insights: Beauty Tech and DTC Brand Funding Tracker 2025", "url": "https://www.cbinsights.com/research/beauty-tech/", "source_type": "research_report", "tier": "A"},
        {"title": "Piper Sandler: Taking Stock with Teens — Beauty Brand Rankings", "url": "https://www.pipersandler.com/teens", "source_type": "research_report", "tier": "A-"},
        {"title": "Spate: Indie Hair Brand Search Momentum Data", "url": "https://www.spate.nyc/", "source_type": "data_tool", "tier": "B+"},
    ],
    "competitive_r05": [  # Chinese FMCG Brands Enter European Market
        {"title": "Technavio: FMCG Market Growth Forecast 2025-2029", "url": "https://www.technavio.com/report/fmcg-market-industry-analysis", "source_type": "market_report", "tier": "D"},
        {"title": "Marketplace Pulse: TikTok Shop EU Seller Analytics", "url": "https://www.marketplacepulse.com/", "source_type": "data_tool", "tier": "B+"},
        {"title": "Sensor Tower: Temu European Market Penetration Data", "url": "https://sensortower.com/", "source_type": "data_tool", "tier": "B+"},
        {"title": "CosmeticsDesign-Europe: Florasis/Perfect Diary EU Launch Tracking", "url": "https://www.cosmeticsdesign-europe.com/", "source_type": "trade_press", "tier": "B"},
    ],
    "competitive_r06": [  # Emerging Markets Growth Divergence — IMEA Leads
        {"title": "Henkel FY2025 Annual Report — IMEA Segment", "url": "https://www.henkel.com/investors-and-analysts/financial-reports", "source_type": "annual_report", "tier": "B-"},
        {"title": "Henkel FY2025 Press Release: Organic Growth +0.9%, IMEA Outperformance", "url": "https://www.henkel.com/press-and-media/press-releases-and-kits/2026-03-11-henkel-delivers-organic-growth-in-2025-and-increases-profitability-through-innovation-and-more-efficiency-2131952", "source_type": "annual_report", "tier": "B-"},
        {"title": "Euromonitor: IMEA Beauty & Home Care Market Sizing", "url": "https://www.euromonitor.com/", "source_type": "market_report", "tier": "A"},
        {"title": "World Bank: GDP Growth Rates — India, ME, Africa", "url": "https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG", "source_type": "government_data", "tier": "S"},
    ],
    "competitive_r07": [  # L'Oreal Tech-Beauty Platform Strategy
        {"title": "L'Oreal: Annual Report and Beauty Tech Strategy", "url": "https://www.loreal.com/en/group/about-loreal/strategy/", "source_type": "strategy_document", "tier": "B-"},
        {"title": "BeautyMatter: L'Oreal Beauty Tech Platform Analysis", "url": "https://beautymatter.com/", "source_type": "trade_press", "tier": "B"},
        {"title": "L'Oreal FY2025 Annual Report — R&D €1.7B Disclosure", "url": "https://www.loreal-finance.com/en/annual-report/", "source_type": "annual_report", "tier": "B-"},
        {"title": "EPO/USPTO: L'Oreal Beauty Tech Patent Filings Analysis", "url": "https://worldwide.espacenet.com/", "source_type": "data_tool", "tier": "S"},
    ],

    # ═══ CUSTOMER ═══
    "customer_r01": [  # Discount Retail Channel Expansion in Europe
        {"title": "ESM: Lidl Reports Double-Digit Turnover Growth", "url": "https://www.esmmagazine.com/retail/lidl-gb-reports-double-digit-turnover-growth-in-fy-2024-277606", "source_type": "news", "tier": "B"},
        {"title": "Discount Retail Consulting: New Retail Moves of Aldi & Lidl", "url": "https://www.discountretailconsulting.com/post/global-the-new-retail-moves-of-aldi-lidl-can-suppliers-still-make-a-profit", "source_type": "research_report", "tier": "B+"},
        {"title": "Retail Tech Innovation Hub: Discounters Lead Global Grocery Growth (Mar 2026)", "url": "https://retailtechinnovationhub.com/home/2026/3/19/discounters-lead-global-grocery-sector-growth-as-they-tap-emerging-retail-technologies", "source_type": "trade_press", "tier": "B"},
        {"title": "Savills: European Grocery Market Insight", "url": "https://www.savills.us/research_articles/256536/364620-0", "source_type": "research_report", "tier": "A"},
    ],
    "customer_r02": [  # E-Commerce Profit Pool Maturation
        {"title": "eMarketer: FMCG E-Commerce Penetration Forecast", "url": "https://www.emarketer.com/content/global-ecommerce-forecast-2025", "source_type": "market_report", "tier": "A"},
        {"title": "Euromonitor: Digital Commerce in FMCG 2025", "url": "https://www.euromonitor.com/digital-commerce", "source_type": "market_report", "tier": "A"},
        {"title": "Amazon 10-K: Subscribe & Save Penetration Data", "url": "https://ir.aboutamazon.com/sec-filings/default.aspx", "source_type": "annual_report", "tier": "B-"},
        {"title": "Bain/Google: Future of Retail — FMCG E-Com Economics", "url": "https://www.bain.com/insights/topics/retail/", "source_type": "research_report", "tier": "A"},
    ],
    "customer_r03": [  # Retailer Consolidation and Power Concentration
        {"title": "NIQ: Channel Strategy Report 2025", "url": "https://nielseniq.com/global/en/insights/report/2025/on-premise-channel-strategy-report-2025/", "source_type": "market_report", "tier": "A"},
        {"title": "Deloitte: Global Powers of Retailing 2025/2026", "url": "https://www.deloitte.com/global/en/Industries/consumer/analysis/global-powers-of-retailing.html", "source_type": "research_report", "tier": "A"},
        {"title": "Edge by Ascential: European Grocery Power Rankings", "url": "https://www.ascentialedge.com/", "source_type": "market_report", "tier": "A"},
        {"title": "OECD: Competition in Grocery Retail Markets", "url": "https://www.oecd.org/competition/", "source_type": "government_data", "tier": "S"},
    ],
    "customer_r04": [  # Social Commerce and TikTok Shop Emergence
        {"title": "Euromonitor: Top Retail Trends 2025 — Social Commerce", "url": "https://www.euromonitor.com/article/top-retail-trends-in-2025-discount-formats-and-social-commerce-drive-growth", "source_type": "market_report", "tier": "A"},
        {"title": "eMarketer: Social Commerce Forecast 2025-2027", "url": "https://www.emarketer.com/content/social-commerce", "source_type": "market_report", "tier": "A"},
        {"title": "Accenture: Why Shopping's Set for a Social Revolution", "url": "https://www.accenture.com/", "source_type": "research_report", "tier": "A"},
        {"title": "Similarweb: TikTok Shop Traffic by Category — Beauty #1", "url": "https://www.similarweb.com/", "source_type": "data_tool", "tier": "B+"},
    ],
    "customer_r05": [  # Quick Commerce Consolidation
        {"title": "Statista: Quick Commerce Market Forecast", "url": "https://www.statista.com/outlook/emo/online-food-delivery/grocery-delivery/quick-commerce/worldwide", "source_type": "market_forecast", "tier": "D"},
        {"title": "Euromonitor: Quick Commerce Post-Consolidation Assessment", "url": "https://www.euromonitor.com/", "source_type": "market_report", "tier": "A"},
        {"title": "McKinsey: Quick Commerce — Where It's Headed (2025 Update)", "url": "https://www.mckinsey.com/industries/retail/our-insights", "source_type": "research_report", "tier": "A"},
        {"title": "Delivery Hero: Financial Reports — Flink Integration", "url": "https://ir.deliveryhero.com/", "source_type": "annual_report", "tier": "B-"},
    ],
    "customer_r06": [  # FMCG Subscription and Loyalty Ecosystem Lock-in
        {"title": "NIQ: Retail Media's Billion-Euro Mirage", "url": "https://nielseniq.com/global/en/insights/analysis/2025/retail-medias-billion-euro-mirage/", "source_type": "market_analysis", "tier": "A"},
        {"title": "Amazon 10-K: Subscribe & Save Metrics", "url": "https://ir.aboutamazon.com/sec-filings/default.aspx", "source_type": "annual_report", "tier": "B-"},
        {"title": "BCG: The New Rules of Consumer Loyalty 2025", "url": "https://www.bcg.com/publications", "source_type": "research_report", "tier": "A"},
        {"title": "Tesco Clubcard / Lidl Plus: Loyalty Penetration Data", "url": "https://www.tescoplc.com/", "source_type": "annual_report", "tier": "B-"},
    ],
    "customer_r07": [  # Professional Salon Channel to Consumer Crossover
        {"title": "FMI: Professional Hair Care Products Market", "url": "https://www.futuremarketinsights.com/reports/global-professional-hair-care-products-market", "source_type": "market_report", "tier": "B+"},
        {"title": "Kline Group: Professional Hair Care 2025 — B2C Crossover", "url": "https://klinegroup.com/beauty-and-wellbeing/professional-hair-care/", "source_type": "market_report", "tier": "B+"},
        {"title": "BeautyMatter: Professional-to-Consumer Brand Crossover Analysis", "url": "https://beautymatter.com/", "source_type": "trade_press", "tier": "B"},
        {"title": "Olaplex SEC Filings: Retail vs Salon Revenue Split", "url": "https://ir.olaplex.com/", "source_type": "annual_report", "tier": "B-"},
    ],

    # ═══ NEW TRENDS ═══
    "technology_r09": [  # Generative AI Disrupts Product Discovery
        {"title": "eMarketer: How GEO and AI Will Change Discovery in 2026", "url": "https://www.emarketer.com/content/how-experts-say-geo--ai-will-change-discovery-2026", "source_type": "research_report", "tier": "A"},
        {"title": "Similarweb: 2025 Generative AI Report — AI Discovery Surges", "url": "https://www.similarweb.com/blog/marketing/geo/gen-ai-stats/", "source_type": "data_tool", "tier": "B+"},
        {"title": "Marketing Dive: GEO and Accessibility — 3 Forces Defining 2026 Marketing", "url": "https://www.marketingdive.com/spons/aeo-geo-and-accessibility-the-3-forces-that-will-define-2026-marketing/806738/", "source_type": "trade_press", "tier": "B"},
        {"title": "CB Insights: GEO Companies Winning the AI Search Arms Race", "url": "https://www.cbinsights.com/research/geo-companies-winning-ai-search/", "source_type": "research_report", "tier": "A"},
    ],
    "government_r08": [  # Tariffs and Deglobalization
        {"title": "WTO: Trade Monitoring Report 2025", "url": "https://www.wto.org/english/news_e/news_e.htm", "source_type": "government_data", "tier": "S"},
        {"title": "Peterson Institute: US Tariff Impact Analysis", "url": "https://www.piie.com/research/trade-and-investment", "source_type": "research_report", "tier": "A"},
        {"title": "Deloitte: 2026 Consumer Products Outlook — Trade Policy Section", "url": "https://www.deloitte.com/us/en/insights/industry/consumer-products/consumer-products-industry-outlook.html", "source_type": "research_report", "tier": "A"},
        {"title": "Henkel FY2025: Supply Chain Risk Discussion", "url": "https://www.henkel.com/investors-and-analysts/financial-reports", "source_type": "annual_report", "tier": "B-"},
    ],
    "environmental_r07": [  # Energy Cost Volatility
        {"title": "IEA: World Energy Outlook 2025", "url": "https://www.iea.org/reports/world-energy-outlook-2025", "source_type": "government_data", "tier": "S"},
        {"title": "CEFIC: European Chemical Industry Facts & Figures 2025", "url": "https://cefic.org/a-pillar-of-the-european-economy/facts-and-figures-of-the-european-chemical-industry/", "source_type": "research_report", "tier": "B+"},
        {"title": "Eurostat: Energy Statistics — Industrial Prices", "url": "https://ec.europa.eu/eurostat/web/energy/database", "source_type": "government_data", "tier": "S"},
        {"title": "VCI: German Chemical Industry Energy Report", "url": "https://www.vci.de/english/", "source_type": "research_report", "tier": "B+"},
    ],
    "technology_r10": [  # Gen AI Marketing Efficiency
        {"title": "Deloitte: 2026 Consumer Products Outlook — AI Section", "url": "https://www.deloitte.com/us/en/insights/industry/consumer-products/consumer-products-industry-outlook.html", "source_type": "research_report", "tier": "A"},
        {"title": "McKinsey: Economic Potential of Generative AI Update", "url": "https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights/the-economic-potential-of-generative-ai-the-next-productivity-frontier", "source_type": "research_report", "tier": "A"},
        {"title": "Bain: AI in Consumer Products 2025", "url": "https://www.bain.com/insights/topics/artificial-intelligence/", "source_type": "research_report", "tier": "A"},
        {"title": "Similarweb: Generative AI Statistics for 2026", "url": "https://www.similarweb.com/blog/marketing/geo/gen-ai-stats/", "source_type": "data_tool", "tier": "B+"},
    ],
    "consumer_r13": [  # Refill and Reuse Economy
        {"title": "Ellen MacArthur Foundation: Reuse — Rethinking Packaging", "url": "https://www.ellenmacarthurfoundation.org/topics/packaging/reuse", "source_type": "research_report", "tier": "A"},
        {"title": "PPWR: Reuse and Refill Targets (2025/40)", "url": "https://eur-lex.europa.eu/EN/legal-content/summary/packaging-and-packaging-waste-from-2026.html", "source_type": "regulation", "tier": "S"},
        {"title": "Unilever: Refill and Reuse Solutions Rollout", "url": "https://www.unilever.com/news/press-and-media/press-releases/2024/unilever-to-roll-out-refill-and-reuse-solutions/", "source_type": "company_page", "tier": "B-"},
        {"title": "dm Drogeriemarkt: Refill Station Program", "url": "https://www.dm.de/", "source_type": "company_page", "tier": "B-"},
    ],
    "consumer_r14": [  # Between-Wash Fabric Care
        {"title": "Euromonitor: Fabric Care — Fresheners and Sanitizers 2025", "url": "https://www.euromonitor.com/fabric-care", "source_type": "market_report", "tier": "A"},
        {"title": "P&G: Febreze Brand Performance Data", "url": "https://us.pg.com/brands/febreze/", "source_type": "company_page", "tier": "B-"},
        {"title": "Statista: Air Freshener and Fabric Refresh Market", "url": "https://www.statista.com/outlook/cmo/household-care/worldwide", "source_type": "market_forecast", "tier": "D"},
        {"title": "PRISM White Spot Analysis: Consumer Journey Gap Assessment", "url": "#internal", "source_type": "internal_analysis", "tier": "B+"},
    ],
    "environmental_r08": [  # Textile Longevity
        {"title": "EU Strategy for Sustainable and Circular Textiles", "url": "https://environment.ec.europa.eu/strategy/textiles-strategy_en", "source_type": "regulation", "tier": "S"},
        {"title": "Ellen MacArthur Foundation: Circular Economy for Fashion", "url": "https://www.ellenmacarthurfoundation.org/topics/fashion/overview", "source_type": "research_report", "tier": "A"},
        {"title": "Euromonitor: Fabric Care — Garment Protection Segment 2025", "url": "https://www.euromonitor.com/fabric-care", "source_type": "market_report", "tier": "A"},
        {"title": "WRAP: Love Your Clothes Campaign Impact Data", "url": "https://wrap.org.uk/taking-action/textiles", "source_type": "research_report", "tier": "B+"},
    ],
    "consumer_r15": [  # Hair Styling Between Washes
        {"title": "Euromonitor: Hair Styling Products 2025", "url": "https://www.euromonitor.com/hair-styling", "source_type": "market_report", "tier": "A"},
        {"title": "Church & Dwight: Batiste Dry Shampoo Market Leadership", "url": "https://churchdwight.com/brands/batiste/", "source_type": "company_page", "tier": "B-"},
        {"title": "Spate: Dry Shampoo and Texture Spray Search Trends", "url": "https://www.spate.nyc/", "source_type": "data_tool", "tier": "B+"},
        {"title": "Mintel: Hair Styling and Finishing Products 2025", "url": "https://store.mintel.com/", "source_type": "market_report", "tier": "A"},
    ],
}


def get_report_trends():
    """Return the list of 47 report trends with source URLs attached."""
    trends = list(TRENDS)
    for t in trends:
        t.sources = SOURCE_URLS.get(t.id, [])
    return trends


def main():
    """CLI entry point for seeding the database directly."""
    from pulse.database import init_db, save_trends, load_trends

    print("Initializing database...")
    init_db()

    print(f"Importing {len(TRENDS)} trends from Intelligence Report...")

    # Validate before saving
    for t in TRENDS:
        assert t.force in ["Consumer", "Customer", "Technology", "Government", "Environmental", "Competitive"], f"Invalid force: {t.force} for {t.id}"
        assert t.direction in ["Expansion", "Contraction"], f"Invalid direction: {t.direction} for {t.id}"
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
    trends = get_report_trends()
    save_trends(trends)

    # Verify
    trends_list = load_trends()
    print(f"\nVerification: {len(trends_list)} trends in database")
    from collections import Counter
    force_counts = Counter(t.force for t in trends_list)
    print(f"  Forces: {', '.join(f'{f}: {force_counts.get(f, 0)}' for f in ['Consumer','Government','Technology','Environmental','Competitive','Customer'])}")
    print(f"  Expansion: {sum(1 for t in trends_list if t.direction == 'Expansion')}")
    print(f"  Contraction: {sum(1 for t in trends_list if t.direction == 'Contraction')}")
    print("\nDone. Trends ready for simulation.")


if __name__ == "__main__":
    main()
