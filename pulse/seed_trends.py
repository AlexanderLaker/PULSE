"""
PRISM seed data: 95 trends (82 v3.1 base + 14 v3.3 additions − 1 consolidation, April 2026).

v3.3 changes (April 2026 — Strategic Review, 20-analyst team):
  - 14 new trends across 14 structurally under-covered gap areas:
      Demographics & household atomisation (2), Regulatory (1), Retailer
      vertical integration (1), Emerging-market category shift (1), LHC
      premiumisation (2), Channel disruption / loyalty-data (2), R&D /
      IoT (2), Longevity LHC-split (1), Cohort-fluency decline (1),
      Tele-derm DTC (1)
  - 8 re-scored trends (competitive_r05, technology_r10, consumer_r04,
    consumer_r09, consumer_r13, customer_r08, government_r07)
  - 1 consolidation: technology_r09 retired; superseded by technology_r13
    (hyper-personalised formulation already captures the ML-formulation
    vector at higher resolution)
  - Net active trend count: 95 (82 v3.1 base − 1 consolidated + 14 new)

v3.1 changes (April 2026):
  - 2 retirements: consumer_r12 (Post-COVID Hygiene), customer_r05 (Quick Commerce)
  - 2 upgrades: consumer_r02 (GLP-1 5/0.10), customer_r04 (TikTok Shop 5/0.10)
  - 23 new trends across 6 gap areas: Agentic Commerce, Geographic Expansion,
    Longevity Economy, Ingredients & Bio-Manufacturing, Regulatory, and
    Consumer/Customer/Competitive gaps
  - Time horizon extended to 2036 (H1 Execution / H2 Disruption / H3 Transformation)

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
        peak_year=2031, diffusion_curve="front_loaded",  # PL structural penetration already advancing (42% EU6); front-loaded with long tail
        name="Private Label Structural Penetration in Europe",
        description="Private label hit 42% value share in EU6, €317B in total PL sales (Circana 52w to Sep 2025). PL now 50%+ in 3 core FMCG markets. Italy most dynamic at +4.7%. HCB-specific: PL penetration in Laundry is above average at ~45% in Germany, while Hair PL penetration is lower (~30%) due to higher brand loyalty in color/care. Retailer investment in premium PL tiers (Aldi Lacura, Lidl Cien) directly attacks Henkel mid-tier brands (Schauma, all, Purex). Rewe/Edeka PL in laundry pods format narrows gap to Persil Discs.",
        direction="Contraction", probability=5, start_year=2025,
        # 25%: PL directly competes for ~40-50% of volume but branded margin
        # defense limits GP1 exposure to the price-gap erosion portion
        gp1_pct_affected=0.25,
        strategic_implication="Highest-impact Consumer trend in the database (probability 5, 25% GP1 affected, Contraction). Exposure is skewed to the LHC side of the portfolio: Fabric Cleaning, Fabric Care and Laundry Additives score 5 while Hair sits at 2-3, mirroring the ~45% PL penetration in German laundry versus ~30% in mass Hair. The value chain pressure points cluster downstream at Marketing (4), Commercial (5) and Consumer (5) — this is a shelf and shopper-consideration problem, not a formulation problem. Regional concentration is unambiguously European (5/5) with only secondary North American exposure (3/5) and near-zero Asia/High-Growth exposure. Source triangulation is strong (Circana EU6, NIQ, PLMA; Tier A/B) and confidence is High. For HCB the net situation is a structural margin squeeze in European LHC where mid-tier pricing ladders are being eroded by premium PL tiers from Aldi and Lidl, compounded by retailer consolidation (K-03). Hair is the natural hedge inside the portfolio but cannot offset the scale of LHC exposure in the home region.",
        category_exposure=cat(3,3,2,3, 5,5,4,5,4,4,3,4),
        vc_exposure=vc(1,1,1,1,1,4,5,5),
        regional_exposure=reg(5,3,2,2),
        data_source="Circana EU6 Private Label Monitor Dec 2025; NIQ European Private Label Monitor 2025", source_type="analyst_report",
        confidence="High",
    ),
    # ── C-02 (UPGRADED April 2026) ──
    Trend(
        id="consumer_r02", force="Consumer", sub_category="Behavioral",
        peak_year=2032, diffusion_curve="s_curve",  # GLP-1 30M Americans by 2030; EU adoption 2027-2028; classic adoption curve
        name="GLP-1 Drugs Reshape Consumer Spending Patterns",
        description="GLP-1 adoption accelerating dramatically: 30M Americans projected on GLP-1 by 2030. Market exceeds $100B in 2026 revenue, reaching $116B by 2030 (JP Morgan). Over 50% of users report improved appearance perception; 43% motivated to invest more in personal care. For HCB Hair: GLP-1-related hair thinning creates demand for volumizing/thickening products — a Schwarzkopf Care opportunity. Body care spending reallocation confirmed: beauty/personal care up while grocery down 5.3%. EU adoption accelerating 12-18 months behind US (down from 18-24). LHC: laundry frequency slightly down in GLP-1 households (smaller portions, fewer cooking occasions).",
        direction="Expansion", probability=5, start_year=2025,
        # 10%: UPGRADED from 4%. 30M Americans by 2030; $100B+ market;
        # spending reallocation from food→beauty confirmed at scale.
        # EU adoption curve steepening. Hair thinning side-effect creates
        # new demand vector. Body care spending uplift documented.
        gp1_pct_affected=0.10,
        strategic_implication="Upgraded April 2026 to probability 5 / GP1 10% following JPM's $100B+ market projection and 30M US users by 2030 (Expansion). The category read is bifurcated: Hair Care and Hair Body score 4 (self-care spending reallocation, volumising demand from GLP-1 thinning side-effects), while LHC is near-zero (0-2) with a slight drag from reduced laundry frequency in GLP-1 households. Regionally this is a North America-first trend (5/5), with Europe a 12-18 month follower (4/5) and Asia/High-Growth lagging materially. The value chain hotspots are Consumer (5), Marketing (4) and Commercial (3) — demand-side not supply-side, though Formulation (2) acknowledges a thickening/volumising reformulation angle. Sources are top-tier (JPM, McKinsey, IQVIA, HBR; High confidence). For HCB the situation is an NA-weighted net tailwind for the premium-adjacent Care and Body segments, but with a timing gap: US-exposed players capture the 2026-2028 window while Europe waits for adoption to steepen. The trend's LHC drag is modest but real and reinforces the premiumisation imperative in Hair.",
        category_exposure=cat(2,4,2,4, 1,1,0,2,0,0,0,0),
        vc_exposure=vc(0,2,0,0,0,4,3,5),
        regional_exposure=reg(4,5,3,2),
        data_source="JP Morgan GLP-1 Analysis 2026; McKinsey Consumer Health Survey 2025; IQVIA GLP-1 Tracker 2025; HBR Consumer Behavior Oct 2025", source_type="analyst_report",
        confidence="High",
    ),
    # ── C-03 ──
    Trend(
        id="consumer_r03", force="Consumer", sub_category="Premiumization",
        peak_year=2030, diffusion_curve="s_curve",  # Premium Hair already +15% L'Oreal Prof; mid-horizon saturation
        name="Premiumization Acceleration in Hair Care",
        description="Premium hair care growing 2-3x mass rate confirmed. Henkel Consumer Brands FY2025: 0.3% organic growth overall (price positive, volume slightly negative). L'Oréal Professional Products +15% in 2025, Kérastase double-digit, demonstrating premium ceiling not reached. Schwarzkopf Professional-to-consumer crossover is highest-ROI premiumization path. Gliss repositioning toward affordable prestige is the mid-tier play.",
        direction="Expansion", probability=5, start_year=2024,
        # 20%: Premium tier is ~25-30% of Hair GP1 and accelerating;
        # L'Oréal Prof +15% proves ceiling is higher
        gp1_pct_affected=0.20,
        strategic_implication="Unambiguous expansion trend (probability 5, 20% GP1 affected). Category exposure is pure Hair — Color, Care, Styling and Body score 4-5 with zero LHC read. Premium hair care is growing 2-3x mass rate, L'Oréal Professional Products +15% in 2025 proves the ceiling is not saturated. Regional exposure is broad-based across Europe (5), North America (5), Asia (4) and High-Growth (3), making this a globally portable growth vector rather than a regional pocket. Value chain concentration is high across Formulation (5), Marketing (5), Packaging (4) and Consumer (5) — premiumisation is a whole-value-chain discipline, not a marketing exercise. Sources are strong (Henkel FY25, Euromonitor; High confidence). For HCB the situation is the single largest within-Hair growth pool, with a direct crossover opportunity from professional heritage into consumer retail. The asymmetry is that HCB's 0.3% FY25 organic growth contrasts sharply with L'Oréal PPD's +15% — the premium pool is expanding, but HCB is not capturing proportionate share at current run-rate.",
        category_exposure=cat(4,5,4,3, 0,0,0,0,0,0,0,0),
        vc_exposure=vc(3,5,3,4,2,5,4,5),
        regional_exposure=reg(5,5,4,3),
        data_source="Henkel FY2025 Annual Report; Euromonitor Hair Care 2025", source_type="analyst_report",
        confidence="High",
    ),
    # ── C-04 ──
    Trend(
        id="consumer_r04", force="Consumer", sub_category="Behavioral",
        peak_year=2031, diffusion_curve="s_curve",  # Cleanical/clean beauty entering mass retail 2026; mid-horizon plateau
        name="Conscious Consumption and Cleanical Beauty",
        description="Cleanical convergence confirmed as dominant Beauty trend, now entering mass retail aisles (2026). Intersects three regulatory forces (PFAS G-01, Cosmetics Reg G-03, Green Claims G-05). Schwarzkopf R&D formulation depth (3,000+ formulations annually) is a genuine competitive advantage — smaller brands cannot substantiate clinical claims as credibly. LHC: enzyme-based clean detergents (Persil cold-wash) align with cleanical demand.",
        direction="Expansion", probability=4, start_year=2025,
        # 8%: RE-SCORED v3.3 April 2026 (Strategic Review). Reduced
        # 0.10→0.08 — cleanical is now table-stakes, not differentiating.
        # Every scale R&D player (P&G, Unilever, L'Oréal) can make
        # clinical claims credibly. Margin uplift therefore smaller
        # than originally modelled.
        gp1_pct_affected=0.08,
        strategic_implication="Medium-confidence expansion trend (probability 4, 10% GP1 affected). Category exposure is broad but thinner than C-03 — Hair Care and Body score 4, Color 3, Styling 2; LHC is engaged at 2-3 across the enzyme-based cold-wash segments. The trend intersects three regulatory forces (G-01 PFAS, G-03 Cosmetics Regulation, G-05 Green Claims) and therefore has a compliance-to-credibility conversion angle. Regional exposure is Europe-led (5) and North America-second (4), with Asia (3) and High-Growth (2) trailing. Value chain activity is front-loaded at Raw Materials (4), Formulation (5) and Consumer (5) — this is a formulation-backed positioning play, not pure marketing. Sources are mid-tier (Mintel, Beauty Independent, CosmeticsDesign; Medium confidence). For HCB the situation is that established R&D depth and formulation scale create a credibility moat against smaller clean-beauty challengers who cannot substantiate clinical claims — but the same moat is also claimed by every competitor with scale R&D. Cleanical is no longer differentiating; it is table-stakes for premium Hair and increasingly for premium LHC.",
        category_exposure=cat(3,4,2,4, 3,3,2,2,2,2,1,1),
        vc_exposure=vc(4,5,2,3,2,4,3,5),
        regional_exposure=reg(5,4,3,2),
        data_source="CosmeticsDesign-Europe; BCG Consumer Sentiment 2025", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── C-05 ──
    Trend(
        id="consumer_r05", force="Consumer", sub_category="Demographics",
        peak_year=2033, diffusion_curve="linear",  # Silver economy is a slow demographic tailwind through H2
        name="Silver Economy — Aging Population Shifts Category Demand",
        description="Eurostat projections confirmed. Three HCB-specific effects: (1) Color: gray coverage remains #1 CEP — Henkel Color portfolio (Palette, Brillance, Igora-derived) has broadest shade range in mass retail, (2) Care: shift toward gentler salon-grade formulations for thinning/fragile hair, (3) LHC: ease-of-use packaging as competitive differentiator (arthritis-friendly caps, lighter bottles). Germany has among Europe's oldest demographics — structural tailwind for Henkel.",
        direction="Expansion", probability=5, start_year=2025,
        # 12%: 65+ already ~20% of buyers; incremental growth in Color
        # (gray coverage) and gentle formulation segments
        gp1_pct_affected=0.12,
        strategic_implication="Demographic tailwind with 5/5 probability and 12% GP1 affected (Expansion). The category profile is heavily Color-weighted (5) — grey-coverage remains the #1 Category Entry Point for the 65+ cohort — with secondary exposure in Hair Care (3) and minor LHC exposure (2) via ease-of-use packaging demands (arthritis-friendly caps, lighter bottles). Regional exposure is Europe-dominant (5) and NA-second (4), reflecting the oldest demographic profiles in HCB's core markets. The value chain hotspots are Consumer (5), Marketing (4) and Packaging (3). Sources are S-tier (Eurostat, UN WPP, WHO, OECD; High confidence). For HCB the situation is structurally favourable given Europe-weighted revenue and a Color portfolio with the broadest shade range in mass retail — among the few demographic trends that work with rather than against HCB's geographic concentration. The caveat is that grey-coverage loyalty is traditionally high, meaning incremental share is hard to win but existing share is defensible.",
        category_exposure=cat(5,3,1,2, 2,2,1,2,2,1,1,1),
        vc_exposure=vc(1,3,1,3,1,4,3,5),
        regional_exposure=reg(5,4,3,2),
        data_source="Eurostat Demographic Projections 2025", source_type="analyst_report",
        confidence="High",
    ),
    # ── C-06 ──
    Trend(
        id="consumer_r06", force="Consumer", sub_category="Macroeconomic",
        peak_year=2029, diffusion_curve="front_loaded",  # Cost-of-living pressure already acute; ECB rate cuts ease pressure later
        name="Cost-of-Living Squeeze and Persistent Trading Down",
        description="Trading-down persists but stabilizing in 2026. Henkel FY2025: positive price but slightly negative volume — consumers accept premium pricing where innovation justifies it (Persil Discs, Schwarzkopf GLISS) but trade down in commodity segments. ECB rate cuts began mid-2024, easing mortgage pressure. Key bifurcation: premium Hair (Schwarzkopf) resilient, value LHC (Purex, all) under maximum PL pressure. Henkel dual-brand architecture provides natural hedge.",
        direction="Contraction", probability=4, start_year=2024,
        # 20%: Broad-based but stabilizing; ECB rate cuts and easing
        # inflation slightly reduce pressure vs. original assessment
        gp1_pct_affected=0.20,
        strategic_implication="Broad-based contraction trend (probability 4, 20% GP1 affected), stabilising in 2026 as ECB rate cuts ease mortgage pressure. Category exposure is even at 3 across Hair (Color, Care, Styling, Body) but materially higher on the LHC value side — Laundry Additives (5), Fabric Cleaning/Care (4), HDW/ADW (3). Regional weight is European (5), with secondary NA (3) and limited Asia/High-Growth exposure. Value chain concentration is downstream: Marketing (4), Commercial (5), Consumer (5) — this is a consideration-set and willingness-to-pay problem. Sources are strong (BCG, McKinsey; High confidence). For HCB the situation is bifurcated: the premium Hair tier remains relatively resilient while the value LHC tier faces maximum PL pressure (C-01 compounding). Dual-brand architecture provides a natural hedge, but the macro stabilisation means the trend is decelerating rather than reversing — the trading-down share captured since 2022 will not simply snap back.",
        category_exposure=cat(3,3,3,3, 4,4,3,5,3,3,2,2),
        vc_exposure=vc(1,1,1,2,1,4,5,5),
        regional_exposure=reg(5,3,2,2),
        data_source="BCG/McKinsey European Consumer Surveys 2026", source_type="analyst_report",
        confidence="High",
    ),
    # ── C-07 ──
    Trend(
        id="consumer_r07", force="Consumer", sub_category="Category Creation",
        peak_year=2031, diffusion_curve="s_curve",  # Scalp care +19% H1 2025; mass retail adoption through 2031
        name="Scalp Care Emerges as Standalone Category",
        description="Scalp care category grew 19% YoY in H1 2025. Market valued at $88.2B (2025), 7.0% CAGR to $150.5B by 2033. Skinification now hitting mass retail (2026). P&G microbiome on front-of-pack, Dove Scalp + Hair Therapy launched. Henkel has no dedicated scalp care consumer line — this is the single largest category white space in Hair. Schwarzkopf Professional dermatological expertise (Seborin heritage) is an underexploited asset.",
        direction="Expansion", probability=5, start_year=2025,
        # 8%: Scalp care grew 19% in H1 2025; mass retail arrival of
        # skinification expands addressable market
        gp1_pct_affected=0.08,
        strategic_implication="High-probability expansion (5) with 8% GP1 affected on a new-pool basis (not cannibalisation). Category exposure is narrow but deep — Hair Care (5) and Color (2) are the only active categories; LHC is zero. Scalp care grew 19% YoY in H1 2025 and the $88.2B market is projected to reach $150.5B by 2033 (7% CAGR). Regional exposure is North America-first (5), Asia-second (5) where skinification is most advanced, and Europe a late-follower (4). Value chain engagement is heavy in Raw Materials (3), Formulation (5), Marketing (5), Commercial (4) and Consumer (5) — a full-stack innovation trend. Sources are mid-tier (Grand View Research, Kline, Spate; Medium confidence). For HCB the situation is the single largest category white space in Hair. Competitor activity is already dense (P&G microbiome front-of-pack, Unilever Dove Scalp+Hair Therapy) and dermatological heritage in the Professional arm is an underexploited translation asset into mass retail.",
        category_exposure=cat(2,5,1,2, 0,0,0,0,0,0,0,0),
        vc_exposure=vc(3,5,2,3,1,5,4,5),
        regional_exposure=reg(4,5,5,2),
        data_source="Grand View Research; Spate Trend Data 2025", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── C-08 ──
    Trend(
        id="consumer_r08", force="Consumer", sub_category="Demographics",
        peak_year=2032, diffusion_curve="s_curve",  # Male grooming structural growth; 7.65% CAGR matures late H2
        name="Male Grooming Structural Growth",
        description="European male grooming: $23.6B in 2025, 7.65% CAGR confirmed. For HCB: got2b is primary male vehicle but lacks dedicated Care and scalp care lines for men. Male scalp concerns (dandruff, thinning, oiliness) among fastest-growing search terms. Schwarzkopf Men range exists in Professional but not at consumer scale. LHC: male-targeted fragrance in laundry (sport/fresh fabric care) is untapped premiumization lever for Vernel.",
        direction="Expansion", probability=4, start_year=2025,
        # 8%: Males ~15-20% of Hair buyers; under-penetrated segment
        # growth adds to pool but from small base
        gp1_pct_affected=0.08,
        strategic_implication="Steady expansion (probability 4, 8% GP1 affected). European male grooming $23.6B in 2025 at 7.65% CAGR. Category exposure concentrates on Hair Styling (4) and Hair Body (4), with secondary Hair Care (3) and Color (2); LHC is zero. A minor linkage exists into LHC premium fragrance (sport/fresh profiles) as a fragrance-premiumisation adjacency. Regional exposure is broad (EU=5, NA=4, Asia=4, HG=3). Value chain concentration is Marketing (5), Commercial (4), Consumer (5). Sources are mid-tier (Statista, Euromonitor, Allied, Mintel; Medium confidence). For HCB the situation is a structurally under-penetrated segment where the portfolio has a youth-styling foothold but lacks dedicated male Care and male scalp-care lines. Male scalp concerns (dandruff, thinning, oiliness) overlap with C-07 (Scalp) and C-10 (Hair Loss), meaning three trends reinforce a single white space.",
        category_exposure=cat(2,3,4,4, 0,0,0,0,0,0,0,0),
        vc_exposure=vc(2,3,2,3,1,5,4,5),
        regional_exposure=reg(5,4,4,3),
        data_source="Statista Consumer Market Outlook 2026", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── S-02 (Consumer) ──
    Trend(
        id="consumer_r09", force="Consumer", sub_category="Premiumization",
        peak_year=2031, diffusion_curve="s_curve",  # Fragrance premiumization expanding from Southern to Northern Europe
        name="Fragrance and Sensory Premiumization in Home Care",
        description="Fragrance premiumization accelerating: laundry scent boosters/perfume products growing 15%+ in Southern Europe, now expanding to Germany/Northern Europe. Vernel and Persil fragrance extensions represent highest-margin premiumization path in Laundry. P&G Lenor Unstoppables is benchmark to beat. Critical PL defense: complex fragrance development is a genuine barrier to entry — PL cannot replicate credibly. Henkel fragrance chemistry capability (shared with Adhesive Technologies) is a distinctive competence.",
        direction="Expansion", probability=4, start_year=2025,
        # 10%: RE-SCORED v3.3 April 2026. Reduced 0.12→0.10 to avoid
        # double-counting with new consumer_r28 (laundry scent-booster
        # pure-play premiumisation). This trend now captures macro
        # fragrance premiumisation across FFI + HSC; scent boosters
        # are carved out into consumer_r28.
        gp1_pct_affected=0.10,
        strategic_implication="High-margin expansion (probability 4, 12% GP1 affected). Category exposure is LHC-concentrated with Fabric Finisher (4), Laundry Additives (4), Fabric Cleaning (4), and Hard Surface Cleaner (3); Fabric Care Specialty and HDW/ADW are secondary. Fragrance/scent-booster products are growing 15%+ in Southern Europe and now expanding to Germany/Northern Europe. Regional exposure is Europe-led (5), Asia (4), High-Growth (3) and NA (3). Value chain engagement is heavy at Raw Materials (4), Formulation (5), Packaging (4), Marketing (5) and Consumer (5). Sources are Medium-confidence (Euromonitor, Kantar, IFF). For HCB the situation is that fragrance chemistry is a genuine PL-defence moat — PL cannot replicate complex fragrance development credibly — and the capability is shared across divisions. The reference competitor (P&G Lenor Unstoppables) is the benchmark. This is one of the few LHC trends that combines expansion direction with defensible differentiation.",
        # FCA→2 (Perwoll not the fragrance play), FFI→4 (Vernel IS the fragrance softener brand)
        category_exposure=cat(0,0,0,1, 4,2,4,4,1,2,3,1),
        vc_exposure=vc(4,5,2,4,1,5,3,5),
        regional_exposure=reg(5,3,4,3),
        data_source="Euromonitor Home Care 2025; Trade press analysis", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── S-06 (Consumer) ──
    Trend(
        id="consumer_r10", force="Consumer", sub_category="Category Creation",
        peak_year=2031, diffusion_curve="s_curve",  # Hair loss mainstreams alongside GLP-1 side-effect amplifier
        name="Hair Loss and Thinning Treatments Enter Consumer Mainstream",
        description="Hair loss market confirmed at $2.93B, 7.77% CAGR. GLP-1 hair thinning side effect (C-02) creates additional demand vector. Schwarzkopf Professional has existing thinning-hair expertise (Bonacure Scalp Genesis, Seborin). Salon-to-retail crossover (K-07) applies directly — professional-grade thinning solutions at mass retail is a white space. Regulatory caution: position at cosmetic thickening end, not pharmaceutical treatment end (FDA/EU distinction).",
        direction="Expansion", probability=4, start_year=2025,
        # 6%: GLP-1 side-effect amplifier increases demand; new adjacent
        # pool with growing overlap to existing Care
        gp1_pct_affected=0.06,
        strategic_implication="Mid-size expansion (probability 4, 6% GP1 affected). Category exposure is narrow — Hair Care (5) only, with minor Color/Styling/Body adjacency. The trend is a category-creation vector rather than existing-pool reshaping. GLP-1 hair-thinning (C-02) acts as an additional demand amplifier, creating reinforcing trend dependencies. Regional profile favours North America (5), Asia (5) and Europe (4), with HG at 3. Value chain hotspots are Formulation (5), Marketing (5) and Consumer (5). Sources are Medium confidence (Fortune Business Insights, Mordor, Grand View, AAD). For HCB the situation is a new adjacent pool with growing overlap to existing Care — professional-grade thinning expertise is an underexploited asset that maps cleanly onto the consumer-grade thickening positioning. Regulatory caution applies: positioning at the cosmetic end vs pharmaceutical end matters for EU/FDA classification.",
        category_exposure=cat(1,5,1,1, 0,0,0,0,0,0,0,0),
        vc_exposure=vc(3,5,2,2,1,5,4,5),
        regional_exposure=reg(4,5,5,3),
        data_source="Fortune Business Insights; Mordor Intelligence 2025", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── S-07 (Consumer) ──
    Trend(
        id="consumer_r11", force="Consumer", sub_category="Behavioral",
        peak_year=2030, diffusion_curve="s_curve",  # Gen Z dupe culture already structural; matures mid-horizon
        name="Gen Z Dupe Culture and Ingredient Literacy",
        description="Dupe culture confirmed as structural shift. HCB brand exposure: Schwarzkopf partially insulated (professional heritage provides credibility dupe-seekers respect). got2b most exposed — youth positioning with limited formulation differentiation makes it a prime dupe target. LHC less affected (detergent efficacy is functional, reducing dupe incentive). Real HCB risk: Gen Z minimalist routines (3-5 steps) reduce total Hair consumption occasions, especially Styling where usage declining among 18-24s.",
        direction="Contraction", probability=5, start_year=2024,
        # 12%: Gen Z ~20% of category spend; dupe-seeking erodes
        # branded price premium for ~60% of that cohort
        gp1_pct_affected=0.12,
        strategic_implication="Structural contraction (probability 5, 12% GP1 affected). Category exposure is broad across Hair (Care=4, Color=3, Styling=4, Body=3) with secondary LHC exposure (FCN=2, FCA=2, LAD=2). Regional profile is NA-led (5) and EU-second (4) — Gen Z dupe culture is culturally Anglo-American in origin. Value chain engagement is downstream at Marketing (5), Commercial (3) and Consumer (5). Sources are Medium confidence (Mintel, Attest, eMarketer, Beauty Independent). For HCB the situation has three layers: first, Gen Z dupe-seeking erodes branded price premium for roughly 60% of the cohort; second, professional heritage provides partial credibility insulation (dupe-seekers respect authenticated performance claims); third — and most overlooked — Gen Z minimalist routines of 3-5 steps structurally reduce total consumption occasions, particularly in Styling where 18-24 usage is already declining. LHC is less exposed because functional efficacy reduces dupe incentive, but Hair Styling is disproportionately exposed.",
        category_exposure=cat(3,4,4,3, 2,2,0,2,1,1,1,0),
        vc_exposure=vc(1,3,0,2,0,5,3,5),
        regional_exposure=reg(4,5,4,2),
        data_source="Attest Gen Z Beauty Report 2025; FMCG Gurus", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── S-09 (Consumer) — RETIRED April 2026 ──
    # Post-COVID Hygiene Habits Persistence (consumer_r12) RETIRED.
    # Rationale: The 20-30% uplift has fully normalized to pre-pandemic levels.
    # Bref/HSC volume declines in H2 2025 confirm this is no longer a structural
    # trend. Probability=3 and gp1_pct_affected=5% were already the weakest in
    # the database. Retaining it adds noise to the CEO-facing model.
    # Retained as comment for audit trail.

    # ═══════════════════════════════════════════════════════════════════
    # FORCE 2: GOVERNMENT (7 trends)
    # ═══════════════════════════════════════════════════════════════════

    # ── G-01 ──
    Trend(
        id="government_r01", force="Government", sub_category="Chemical Regulation",
        peak_year=2028, diffusion_curve="step_function",  # EU PFAS cosmetics ban already effective Jan 2026; phased 2027-2032 cliff
        name="EU PFAS Universal Restriction",
        description="PFAS restriction accelerating: as of January 1, 2026, cosmetic products containing PFAS already prohibited in EU. ECHA aims to complete scientific evaluation by end of 2026. Second public consultation expected March 2026 covering 14 use sectors. Hair portfolio exposure is limited (most formulations already PFAS-free). LHC is the real risk — surface treatment chemistries, stain-resistance, and water-repellent coatings in FCN, FCA, and IC require reformulation. Henkel AI formulation capability (T-01) can turn this into competitive moat. Phased 2027-2032.",
        direction="Contraction", probability=5, start_year=2027,
        # 12%: Cosmetics PFAS ban already effective Jan 2026 — no longer
        # proposal but active regulation. LHC reformulation cost substantial
        gp1_pct_affected=0.12,
        strategic_implication="High-confidence contraction (probability 5, 12% GP1 affected). Cosmetics PFAS ban already effective January 2026 — this is active regulation, not a proposal. Category exposure is disproportionately LHC: Insect Control (5), Fabric Care Specialty (5), Hard Surface Cleaner (4), Laundry Additives (4), Automatic Dish Wash (4), Fabric Cleaning (4), HDW/FFI (3). Hair is relatively insulated at 2-3. Regional exposure is Europe-dominant (5), with secondary North America (3) and minimal Asia/HG. Value chain engagement is heaviest upstream at Raw Materials (5), Formulation (5), Manufacturing (3) — reformulation cost is the core transmission channel. Sources are regulatory-tier (ECHA, RAC, SEAC; High confidence). For HCB the situation is a multi-year reformulation programme across surface-treatment chemistries, stain-resistance and water-repellent coatings in FCN, FCA and IC. The phase-in timeline through 2032 offers a compliance-to-moat conversion window for players with AI formulation depth (T-01), but the absolute compliance cost is real and front-loaded.",
        category_exposure=cat(2,2,3,2, 4,5,3,4,3,4,4,5),
        vc_exposure=vc(5,5,3,2,3,2,2,1),
        regional_exposure=reg(5,3,2,2),
        data_source="ECHA PFAS Restriction Proposal 2023; RAC Final Opinion Mar 2026; SEAC Draft Opinion Mar 2026", source_type="analyst_report",
        confidence="High",
    ),
    # ── G-02 ──
    Trend(
        id="government_r02", force="Government", sub_category="Chemical Regulation",
        peak_year=2029, diffusion_curve="step_function",  # EU Microplastics Phase 2 cliff 2027-2029
        name="EU Microplastics Ban — Phase 2 Implementation",
        description="Phase 2 timeline confirmed 2027-2029. Persil Discs and Somat Excellence capsules are highest-risk product platforms — PVA film dissolution and microplastic classification under regulatory scrutiny. Bio-based capsule film R&D (connected to T-02) is critical mitigation. Risk scenario: if PVA classified as microplastic, capsule/pod formats face labeling restrictions or phase-out, disrupting ~15-20% of LAD/ADW volume. This is Henkel's single highest-impact LHC regulatory risk.",
        direction="Contraction", probability=5, start_year=2027,
        # 10%: Pod/capsule formats are ~15-20% of LAD/ADW volume;
        # reformulation + potential format disruption
        gp1_pct_affected=0.10,
        strategic_implication="High-confidence contraction (probability 5, 10% GP1 affected). Microplastics Phase 2 timeline is 2027-2029 with a step-function impact profile. Category exposure concentrates on pod/capsule formats: Laundry Additives (5), Automatic Dish Wash (5), Fabric Cleaning (4), Fabric Care Specialty (4), HDW (3), IC (3), Color/Care/Styling/Body (2-3). Regional profile is Europe-led (5) with limited NA/Asia exposure. Value chain concentration is Raw Materials (4), Formulation (5), Manufacturing (4) and Packaging (5) — PVA capsule film and dissolution properties are the core technical risk. Sources are S-tier regulatory (ECHA). For HCB the situation is that pod and capsule formats represent ~15-20% of LAD and ADW volume, meaning a PVA reclassification as microplastic would trigger labelling restrictions or format phase-out in the two highest-penetration premium LHC formats. This is the single highest-impact LHC regulatory risk in the database and the tightest dependency on bio-based reformulation (T-02).",
        category_exposure=cat(2,3,2,2, 4,4,2,5,3,5,2,3),
        vc_exposure=vc(4,5,4,5,2,2,2,2),
        regional_exposure=reg(5,2,2,1),
        data_source="ECHA Microplastics Restriction 2023; Phase 2 timeline", source_type="analyst_report",
        confidence="High",
    ),
    # ── G-03 ──
    Trend(
        id="government_r03", force="Government", sub_category="Cosmetics Regulation",
        peak_year=2030, diffusion_curve="front_loaded",  # EU Cosmetics Omnibus — rolling restrictions hit early, plateau mid-horizon
        name="EU Cosmetics Regulation Omnibus VII/VIII Revision",
        description="Rolling restriction of UV filters, preservatives, fragrances, colorants under EC 1223/2009 amendments. EU Detergents and Surfactants Regulation endorsed by Council December 8, 2025. Color portfolio remains most exposed category in Henkel portfolio — hair dye reformulation among hardest in consumer chemistry (18-36 months per colorant). Schwarzkopf 100+ year color expertise and AI formulation (T-01) provide structural advantage over smaller competitors who cannot absorb reformulation costs.",
        direction="Contraction", probability=4, start_year=2026,
        # 15%: Hair dye reformulation among hardest in consumer chemistry;
        # Color portfolio disproportionately exposed (colorant restrictions)
        gp1_pct_affected=0.15,
        strategic_implication="High-confidence contraction (probability 4, 15% GP1 affected). Rolling restriction of UV filters, preservatives, fragrances and colorants under EC 1223/2009 amendments. Category exposure is Hair-dominant: Color (5), Care (4), Body (4), Styling (3); LHC minimal (0-2). Regional exposure is Europe (5), with limited NA (2), Asia (3) and HG (2). Value chain engagement is heavy at Raw Materials (5), Formulation (5), and minimal downstream. Sources are S-tier (EUR-Lex, SCCS, Cosmetics Europe; High confidence). For HCB the situation is that hair dye reformulation is among the hardest in consumer chemistry — 18-36 months per colorant — and the Color portfolio carries disproportionate regulatory exposure. The compensating factor is that century-scale color expertise and AI formulation capability create a structural cost-of-compliance advantage versus smaller competitors who cannot absorb the reformulation burden. Compliance itself becomes a concentration force in European Color.",
        category_exposure=cat(5,4,3,4, 2,2,1,1,1,1,1,0),
        vc_exposure=vc(5,5,2,1,2,2,2,2),
        regional_exposure=reg(5,2,3,2),
        data_source="EUR-Lex EC 1223/2009 amendments; SCCS opinions", source_type="analyst_report",
        confidence="High",
    ),
    # ── G-04 ──
    Trend(
        id="government_r04", force="Government", sub_category="Packaging",
        peak_year=2027, diffusion_curve="step_function",  # PPWR applies Aug 12 2026; digital identifiers 2027; sharp step
        name="EU PPWR — Packaging and Packaging Waste Regulation",
        description="PPWR applies from August 12, 2026 confirmed. New: empty space in parcels must not exceed 40%, digital identifiers (QR codes) required from 2027. Recycled content: 30% by 2030, 65% by 2040. PFAS banned in packaging from August 2026. Every Henkel SKU affected — broadest regulatory impact across portfolio. PCR resin premium adds 10-15% to packaging costs. Henkel advantage: centralized packaging R&D and procurement scale. Risk: PCR resin supply bottleneck at scale.",
        direction="Contraction", probability=5, start_year=2026,
        # 7%: COGS increase from PCR premium + new packaging space
        # restrictions + digital identifier requirements compound compliance cost
        gp1_pct_affected=0.07,
        strategic_implication="High-confidence contraction (probability 5, 7% GP1 affected) with a step-function profile. PPWR applies from August 12, 2026; digital identifiers required from 2027; recycled content thresholds at 30% by 2030 and 65% by 2040. Category exposure is uniform (3 across all 12 categories) because every SKU is affected — this is the broadest regulatory footprint in the database. Regional profile is Europe-only (5). Value chain concentration is Packaging (5), Raw Materials (3), Manufacturing (3), Supply Chain (3). Sources are S-tier (EUR-Lex, Gleiss Lutz, Circularise; High confidence). For HCB the situation is that PCR resin premium adds 10-15% to packaging costs across the entire portfolio, compounded by new empty-space restrictions and digital-identifier requirements. The scale advantage — centralised packaging R&D and procurement — partially offsets per-SKU compliance cost, but PCR resin supply bottlenecks at scale remain a binding constraint on compliance-at-pace.",
        category_exposure=cat(3,3,3,3, 3,3,3,3,3,3,3,3),
        vc_exposure=vc(3,0,3,5,3,2,2,2),
        regional_exposure=reg(5,2,2,1),
        data_source="EUR-Lex PPWR Regulation 2024", source_type="analyst_report",
        confidence="High",
    ),
    # ── G-05 ──
    Trend(
        id="government_r05", force="Government", sub_category="Sustainability Claims",
        peak_year=2027, diffusion_curve="step_function",  # EmpCo Green Claims applying Sep 2026; sharp compliance cliff
        name="EU Green Claims Directive / EmpCo Enforcement",
        description="EmpCo Directive applying September 2026 confirmed. Brands with genuine sustainability investment (Persil cold-wash, recyclable packaging) gain competitive advantage when competitors' unsubstantiated claims restricted. Henkel CSRD-compliant reporting positions it well. However: some current Henkel green claims may need substantiation upgrades. Love Nature brand positioning built on natural/eco messaging needs scrutiny under new regime.",
        direction="Contraction", probability=5, start_year=2026,
        # 8%: Restricts a marketing lever, not the product itself;
        # mainly affects the sustainability-premium pricing delta
        gp1_pct_affected=0.08,
        strategic_implication="High-confidence contraction (probability 5, 8% GP1 affected). EmpCo Directive applies September 2026 with a sharp step-function compliance cliff. Category exposure is broad and even (2-3 across all 12 categories) because sustainability claims span the entire portfolio. Regional profile is Europe-led (5), with minimal exposure elsewhere. Value chain concentration is Marketing (5), Commercial (3), Consumer (3) — the transmission channel is marketing architecture rather than product. Sources are S-tier (EU Directive 2024/825). For HCB the situation is two-sided: brands with genuine sustainability investment gain relative advantage as competitors' unsubstantiated claims get restricted, while some existing green claims may themselves require substantiation upgrades. Sub-brands positioned on natural/eco messaging face specific scrutiny under the new regime. CSRD-compliant reporting already in place provides a starting position; however, this is a marketing-lever restriction, not a product-level restriction — the impact is on the sustainability-premium pricing delta rather than the product itself.",
        category_exposure=cat(3,3,2,3, 3,3,2,3,2,3,2,2),
        vc_exposure=vc(1,1,1,2,2,5,3,3),
        regional_exposure=reg(5,2,1,1),
        data_source="EU Directive 2024/825 (EmpCo); Green Claims Directive proposal", source_type="analyst_report",
        confidence="High",
    ),
    # ── G-06 ──
    Trend(
        id="government_r06", force="Government", sub_category="Supply Chain",
        peak_year=2027, diffusion_curve="step_function",  # EUDR Dec 2026 application — classic regulatory step
        name="EU Deforestation Regulation (EUDR)",
        description="EUDR December 2026 application confirmed. Palm-derived surfactants (sodium laureth sulfate, cocamidopropyl betaine) used in >80% of Henkel shampoo and liquid detergent formulations. Geolocation-level traceability required to specific plantation. Henkel 100% RSPO-certified provides head start, but EUDR no-deforestation-after-2020 threshold is stricter than RSPO. Supplier qualification and alternative surfactant sourcing (coconut-derived, synthetic) are mitigation paths.",
        direction="Contraction", probability=4, start_year=2026,
        # 5%: Supply chain compliance cost; palm-derived surfactants are
        # ~15% of raw material cost, traceability adds ~2-3% to that
        gp1_pct_affected=0.05,
        strategic_implication="High-confidence contraction (probability 4, 5% GP1 affected). EUDR December 2026 application confirmed. Category exposure is broad across palm-derived formulations: Hair Care (3), Body (3), Fabric Cleaning (3), Fabric Care (3), Laundry Additives (4), Automatic Dish Wash (3), Insect Control (3). Regional exposure is Europe (5), with meaningful Asia (3) and HG (3) given upstream sourcing geography. Value chain concentration is Raw Materials (5), Manufacturing (1), Packaging (2), Supply Chain (5) — this is a traceability and procurement trend. Sources are S-tier (EU Regulation 2023/1115). For HCB the situation is that palm-derived surfactants (sodium laureth sulfate, cocamidopropyl betaine) appear in >80% of shampoo and liquid detergent formulations and EUDR requires geolocation-level traceability to specific plantation. RSPO certification provides a head start but EUDR's no-deforestation-after-2020 threshold is stricter. Supply chain compliance cost flows through ~2-3% of the ~15% raw material cost base tied to palm.",
        category_exposure=cat(1,3,2,3, 3,3,2,4,2,3,2,3),
        vc_exposure=vc(5,2,1,2,5,1,1,1),
        regional_exposure=reg(5,2,3,3),
        data_source="EU Regulation 2023/1115 (EUDR)", source_type="analyst_report",
        confidence="High",
    ),
    # ── G-07 ──
    Trend(
        id="government_r07", force="Government", sub_category="Digital Compliance",
        peak_year=2030, diffusion_curve="back_loaded",  # Digital Product Passport — slow PIM rollout across 50,000 SKUs
        name="EU Digital Product Passport (DPP)",
        description="PPWR mandates digital identifiers (QR codes) from 2027. Intersects with PPWR (G-04) and Green Claims (G-05), creating digital compliance triple stack. IT investment is substantial — Henkel needs PIM system upgrade across 50,000+ SKUs. Henkel advantage: scale amortizes fixed IT cost over larger SKU base. Strategic opportunity: use DPP as consumer engagement tool (scan-to-learn about ingredients, sustainability).",
        direction="Contraction", probability=4, start_year=2027,
        # 5%: RE-SCORED v3.3 April 2026. Lifted 0.03→0.05 following
        # PPWR final text adoption Jan 2026 — DPP implementation
        # timeline confirmed for Jan 2027, not 2028 as originally
        # modelled. PIM investment estimates revised upward. ESPR
        # textile pilot (G-12) extending DPP scope to packaging liners.
        gp1_pct_affected=0.05,
        strategic_implication="Medium-confidence contraction (probability 4, 3% GP1 affected) — the smallest GP1 impact among Government trends but compounding with G-04 and G-05. PPWR mandates digital identifiers (QR codes) from 2027. Category exposure is broad and moderate (2-3 across all 12 categories). Regional exposure is Europe-only (5). Value chain concentration is Packaging (4), Supply Chain (3), Raw Materials (2), Manufacturing (2), Commercial (2), Consumer (2). Sources are Medium confidence (EU ESPR, DPP standards). For HCB the situation is a compliance-plus-IT cost layer across 50,000+ SKUs requiring a PIM system upgrade — scale amortises the fixed IT cost but the per-SKU data-preparation burden is substantial. The triple regulatory stack (PPWR + Green Claims + DPP) creates compounding compliance load on the same packaging/marketing assets. There is a latent consumer-engagement opportunity if DPP is used as a scan-to-learn channel, but this is optionality not baseline.",
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
        peak_year=2030, diffusion_curve="s_curve",  # AI formulation adoption 67%+ already; S-curve to plateau mid-horizon
        name="AI-Driven Formulation and Speed-to-Market",
        direction="Expansion", probability=5, start_year=2025,
        # 10%: AI adoption at 67% makes this near-certain; intersection
        # with 5 regulatory trends (G-01 to G-05) amplifies value
        gp1_pct_affected=0.10,
        description="AI formulation accelerated beyond initial projections. L'Oréal filed 725 patents in 2025, many AI-driven. 67% of organizations adopted LLMs by 2025. Intersects every Government trend (G-01 to G-05) — faster reformulation = lower compliance cost. L'Oréal R&D €1.7B (4% revenue) vs. Henkel HCB estimated €300-400M creates structural gap. Counter-play: partner with specialty AI formulation startups rather than building all in-house.",
        strategic_implication="Medium-confidence expansion (probability 5, 10% GP1 affected). AI-driven formulation at 67%+ organisational adoption. Category exposure is broad with Hair slightly heavier: Color (5), Care (4), Styling (3), Body (3); LHC uniform at 3-4. Regional exposure is global: NA (5), Europe (4), Asia (4), HG (2). Value chain concentration is heavily upstream: Raw Materials (3), Formulation (5), Manufacturing (3). Sources are Medium confidence (Deloitte, trade press). For HCB the situation is that AI formulation intersects with five Government trends (G-01 to G-05), meaning faster reformulation cycles directly reduce compliance cost and create a compounding advantage as regulatory density increases. The structural constraint is scale: L'Oréal's €1.7B R&D spend (4% of revenue) creates a 4-5x absolute budget gap vs HCB, which means organic pace cannot match — AI-formulation partnerships with specialist startups become the access condition rather than full internal build-out.",
        category_exposure=cat(5,4,3,3, 4,3,3,4,3,4,3,3),
        vc_exposure=vc(3,5,3,1,1,1,2,1),
        regional_exposure=reg(4,5,4,2),
        data_source="Deloitte Manufacturing Outlook 2026; Trade press", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── T-02 ──
    Trend(
        id="technology_r02", force="Technology", sub_category="Green Chemistry",
        peak_year=2031, diffusion_curve="s_curve",  # Bio-based chemistry cost parity 2028-2029; saturates 2031
        name="Bio-Based and Green Chemistry Alternatives",
        direction="Expansion", probability=4, start_year=2026,
        # 10%: Turns regulatory compliance cost into margin advantage;
        # affects raw material cost (~25% of COGS) for reformulated products
        gp1_pct_affected=0.10,
        description="Bio-based chemistry progressing rapidly. Novozymes/dsm-firmenich enzyme scaling on track. Persil cold-wash enzyme platform is most mature bio-chemistry play in Henkel portfolio — directly addresses consumer (C-04 cleanical), government (G-01 PFAS, G-02 microplastics), and environmental (E-02 water scarcity) trends simultaneously. Single highest-value technology investment for LHC. PFAS restriction (G-01) accelerates from nice-to-have to must-have. Cost parity 2028-2029 achievable.",
        strategic_implication="Medium-confidence expansion (probability 4, 10% GP1 affected). Bio-based and green chemistry alternatives — Novozymes/dsm-firmenich enzyme platforms maturing, cost parity with palm-derived projected 2028-2029. Category exposure is broad LHC plus Hair: FCN (4), FCA (4), LAD (5), HSC (4), Body (3), Care (3), IC (4); Color (2), Styling (2). Regional exposure is global: Europe (5), NA (4), Asia (3), HG (3). Value chain concentration is front-heavy: Raw Materials (5), Formulation (5), Supply Chain (3), Manufacturing (3). Sources are Medium confidence (BASF/Novozymes, regulatory analysis). For HCB the situation is that this is the single highest-value technology investment on the LHC side — it addresses C-04 (cleanical demand), G-01 (PFAS), G-02 (microplastics) and E-02 (water scarcity) simultaneously, converting regulatory compliance cost into a margin advantage. The existing cold-wash enzyme platform is the most mature bio-chemistry play in the portfolio; first-mover economics are preserved while cost parity is still 2-3 years away.",
        category_exposure=cat(2,3,2,3, 4,4,3,5,3,4,4,4),
        vc_exposure=vc(5,5,3,2,3,3,2,3),
        regional_exposure=reg(5,4,3,3),
        data_source="BASF/Novozymes enzyme platforms; Regulatory compliance analysis", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── T-03 ──
    Trend(
        id="technology_r03", force="Technology", sub_category="Format Innovation",
        peak_year=2030, diffusion_curve="s_curve",  # Concentrated/solid formats crossing early-adopter threshold
        name="Concentrated and Solid Formats Innovation",
        direction="Expansion", probability=4, start_year=2025,
        # 7%: Improves per-use margin but from niche base; affects
        # ~10% of volume currently transitioning to new formats
        gp1_pct_affected=0.07,
        description="Format innovation crossing early-adopter threshold confirmed. Solid shampoo bars are Hair format opportunity (Schwarzkopf limited presence); ultra-concentrated refills and laundry sheets the LHC play. Persil Discs already a concentrated format success — extending to ultra-concentrate refill pouches is next step. PPWR (G-04) packaging requirements create regulatory tailwind. Competitive watch: Blueland and DTC brands are category-defining the refill aesthetic.",
        strategic_implication="Medium-confidence expansion (probability 4, 7% GP1 affected). Concentrated and solid formats — solid shampoo bars, ultra-concentrated refills, laundry sheets — crossing the early-adopter threshold. Category exposure is LHC-heavy: FCN (3), HDW (3), ADW (3), HSC (3), LAD (4), FCA (2), FFI (2), IC (2); Hair Care (4), Body (3), Color (1), Styling (2). Regional exposure is Europe (5), NA (4), Asia (3), HG (2). Value chain engagement is broad: Raw Materials (3), Formulation (4), Manufacturing (4), Packaging (5), Supply Chain (4), Marketing (3), Commercial (3), Consumer (4). Sources are Medium confidence (Unilever/Blueland, category analysis). For HCB the situation is that per-use margins improve even at lower shelf prices, PPWR (G-04) creates a regulatory tailwind, and existing pod/disc positions provide partial coverage of the concentrated-format consumer need-state. DTC brands (Blueland, Earth Breeze) are category-defining the refill aesthetic at the value end, meaning the premium-concentrated cartridge platform (T-08) is the defensive anchor while sheets (C-22) are the peripheral competitive threat.",
        # FCA→2 (Perwoll not the concentrated/solid formats play; FCN/LAD are)
        category_exposure=cat(1,4,2,3, 3,2,2,4,3,3,3,2),
        vc_exposure=vc(3,4,4,5,4,3,3,4),
        regional_exposure=reg(5,4,3,2),
        data_source="Unilever/Blueland refill systems; Category analysis", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── T-04 ──
    Trend(
        id="technology_r04", force="Technology", sub_category="Biotech",
        peak_year=2031, diffusion_curve="s_curve",  # Microbiome 14.6% CAGR; consumer mass retail arriving 2026-2031
        name="Microbiome Science for Hair and Skin",
        direction="Expansion", probability=4, start_year=2025,
        # 8%: Scalp care grew 19% in H1 2025; multiple competitor launches
        # (Dove Scalp + Hair Therapy, P&G front-of-pack) accelerate timeline
        gp1_pct_affected=0.08,
        description="Microbiome market accelerating (14.6% CAGR, scalp care 19% in H1 2025). P&G front-of-pack branding confirmed. Dove Scalp + Hair Therapy launched. Intersects with C-07 (Scalp Care) — microbiome science is technology platform for scalp care products. Schwarzkopf Professional has dermatological expertise (Seborin, Bonacure) but not translated to consumer microbiome positioning. L'Oréal created Beauty Tech hub in India for AI-powered solutions. Move now or lose position.",
        strategic_implication="Medium-confidence expansion (probability 4, 8% GP1 affected). Microbiome market at 14.6% CAGR, scalp care 19% in H1 2025 — multiple competitor launches (Dove Scalp + Hair Therapy, P&G front-of-pack branding) accelerating the timeline. Category exposure is Hair-only: Care (5), Body (4), Color (1), Styling (1); LHC minimal (FCA=2). Regional exposure is NA (5), Asia (5), Europe (4), HG (2). Value chain engagement is Raw Materials (4), Formulation (5), Manufacturing (3), Marketing (4), Consumer (4). Sources are Medium confidence (BeautyMatter, Data Insights). For HCB the situation is that the trend is the technology platform for scalp care (C-07), with a clear linkage into the professional dermatological heritage (Seborin/Bonacure lineage). L'Oréal's India Beauty Tech hub is already building AI-powered microbiome solutions, meaning the window to establish credible consumer microbiome positioning is closing rather than opening.",
        category_exposure=cat(1,5,1,4, 1,2,0,1,0,0,1,0),
        vc_exposure=vc(4,5,3,2,2,4,3,4),
        regional_exposure=reg(4,5,5,2),
        data_source="BeautyMatter; Data Insights Market microbiome report 2025", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── T-05 ──
    Trend(
        id="technology_r05", force="Technology", sub_category="Operations",
        peak_year=2032, diffusion_curve="linear",  # Manufacturing automation — steady continuous deployment
        name="Manufacturing Automation and Industry 4.0",
        direction="Expansion", probability=4, start_year=2025,
        # 6%: COGS efficiency across entire portfolio; 20-30% inventory
        # reduction translates to ~2-3pp margin improvement on ~30% of ops
        gp1_pct_affected=0.06,
        description="Manufacturing AI adoption confirmed. Henkel 30+ Consumer Brands manufacturing plants represent significant deployment opportunity. Margin impact critical when pricing constrained by PL (C-01) and retail power (K-01, K-03). Henkel operational excellence heritage (OpEx) is cultural enabler. Priority: European plants where energy cost (E-07) structurally higher, making efficiency gains most valuable.",
        strategic_implication="Medium-confidence expansion (probability 4, 6% GP1 affected). Manufacturing automation and Industry 4.0. Category exposure is uniform at 3 across all 12 categories — this is a cross-portfolio COGS trend rather than a category-specific one. Regional exposure is broad: Europe (4), NA (4), Asia (4), HG (3). Value chain concentration is Manufacturing (5), Supply Chain (5), Raw Materials/Formulation/Packaging (2-3). Sources are Medium confidence (Deloitte). For HCB the situation is that 30+ Consumer Brands manufacturing plants represent significant deployment opportunity, with 20-30% inventory reduction translating to ~2-3pp margin improvement on ~30% of operations. Margin impact is critical when pricing is constrained by PL (C-01) and retailer power (K-01, K-03). Priority deployment logic favours European plants where energy cost (E-07) structurally higher makes efficiency gains most valuable — operational-excellence heritage is the cultural enabler.",
        category_exposure=cat(3,3,3,3, 3,3,3,3,3,3,3,3),
        vc_exposure=vc(2,2,5,3,5,1,1,0),
        regional_exposure=reg(4,4,4,3),
        data_source="Deloitte Manufacturing Outlook 2026", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── T-06 ──
    Trend(
        id="technology_r06", force="Technology", sub_category="Digital",
        peak_year=2028, diffusion_curve="front_loaded",  # Retail media already 17.8% YoY; saturating fast then plateauing
        name="Retail Media Networks as Primary FMCG Channel",
        direction="Contraction", probability=5, start_year=2024,
        # 14%: 17.8% YoY growth exceeds original projections;
        # structural margin tax accelerating across all channels
        gp1_pct_affected=0.14,
        description="Retail media surging: US alone $58.8B in 2025, $69.3B forecast 2026 (+17.8% YoY). Amazon 79.7% share, Walmart 8.0%, capturing 89% of incremental spend. Structural margin tax — retailers extract 8-12% of brand net revenue for visibility. From Byron Sharp: over-indexing erodes long-term Mental Availability (brand memory) in favor of short-term Physical Availability (search ranking). Gen AI marketing efficiency (T-10) partially offsets cost.",
        strategic_implication="High-confidence contraction (probability 5, 14% GP1 affected) — one of the largest structural margin-tax trends in the database. Retail media surging: US alone $58.8B in 2025, $69.3B forecast 2026 (+17.8% YoY). Amazon 79.7% share, Walmart 8.0%. Category exposure is uniform at 3 across all categories — every brand pays the tax. Regional exposure is global: NA (5), Europe (4), Asia (4), HG (2). Value chain concentration is Marketing (5), Commercial (5), Consumer (4). Sources are High confidence (eMarketer). For HCB the situation is that retailers now extract 8-12% of brand net revenue for visibility — a structural re-allocation of margin from brand to channel. The Byron Sharp read is that over-indexing on retail media erodes long-term Mental Availability in favour of short-term Physical Availability, creating a second-order brand-strength decay. Gen AI marketing efficiency (T-10) offsets some of the cost but not the share of net revenue captured. This trend compounds K-08 (US retail media specifically) to create one of the largest multi-trend margin compressions in the model.",
        category_exposure=cat(3,3,3,3, 3,3,3,3,3,3,2,2),
        vc_exposure=vc(0,0,0,0,0,5,5,4),
        regional_exposure=reg(4,5,4,2),
        data_source="eMarketer Retail Media Forecast 2025", source_type="analyst_report",
        confidence="High",
    ),
    # ── S-03 (Technology) ──
    Trend(
        id="technology_r07", force="Technology", sub_category="Digital",
        peak_year=2032, diffusion_curve="back_loaded",  # AI personalization at scale — slow enterprise rollout, accelerates late
        name="AI-Powered Personalization at Scale",
        direction="Expansion", probability=3, start_year=2026,
        # 4%: L'Oréal K-SCAN proven +23% sales uplift validates
        # commercial case; Schwarzkopf salon network is deployment asset
        gp1_pct_affected=0.04,
        description="L'Oréal K-SCAN (AI camera for personalized hair recommendations) proved +23% salon sales uplift — validating commercial case. L'Oréal Beauty Tech hub in India building AI solutions. Color shade matching is natural AI use case for Schwarzkopf. Schwarzkopf Professional salon network is unique deployment platform for AI diagnostics. LHC: limited personalization relevance (functional needs, not personal).",
        strategic_implication="Low-confidence expansion (probability 3, 4% GP1 affected). L'Oréal K-SCAN (AI camera for personalised hair recommendations) proved +23% salon sales uplift, validating the commercial case. Category exposure is Hair-only: Color (4), Care (4), Styling (3), Body (3); LHC near-zero because personalisation relevance is low for functional categories. Regional exposure is NA (5), Asia (5), Europe (3), HG (1). Value chain concentration is Formulation (4), Manufacturing (3), Marketing (4), Consumer (5). Sources are Low confidence (L'Oréal Modiface, Function of Beauty). For HCB the situation is that Color shade matching is the natural use case and the professional salon network is a unique deployment platform that no competitor can easily replicate. The enterprise-rollout timeline is slow (2032 peak year), meaning this is a back-loaded technology trend where the commercial case is proven but scale deployment is still 3-5 years out.",
        category_exposure=cat(4,4,3,3, 1,1,0,1,0,0,0,0),
        vc_exposure=vc(1,4,3,2,1,4,3,5),
        regional_exposure=reg(3,5,5,1),
        data_source="L'Oreal Modiface; Function of Beauty; Industry analysis", source_type="analyst_report",
        confidence="Low",
    ),
    # ── S-08 (Technology) ──
    Trend(
        id="technology_r08", force="Technology", sub_category="Smart Home",
        peak_year=2031, diffusion_curve="s_curve",  # Smartwash launched 2025; 2-3 year mass adoption curve then plateau
        name="Connected Appliances and Auto-Dosing Transform Detergent Economics",
        direction="Expansion", probability=4, start_year=2025,
        # 7%: Smartwash launched in market (no longer concept stage);
        # razor-and-blade model creates recurring cartridge revenue with lock-in
        gp1_pct_affected=0.07,
        description="Henkel Smartwash launched for sale in Europe 2025 (Persil Smartwash + Somat Smartwash). 300 quadrillion unique AI dosing configurations. Creates razor-and-blade model — device creates recurring cartridge revenue with platform lock-in. Most differentiated technology play and strongest defense against PL in premium laundry. Mass adoption timeline 2-3 years. Critical risk: if appliance OEMs (Bosch, Samsung, LG) build proprietary dosing platforms, Henkel could be disintermediated. Imperative: secure OEM partnerships before appliance makers create own detergent subscriptions.",
        strategic_implication="Medium-confidence expansion (probability 4, 7% GP1 affected). Smartwash launched for sale in Europe 2025; 300 quadrillion unique AI dosing configurations; razor-and-blade model with cartridge lock-in. Category exposure is LHC-pure: Laundry Additives (5), Fabric Care Specialty (4), Automatic Dish Wash (4), Fabric Cleaning (3), HDW (2); Hair zero. Regional exposure is Europe (5), NA (4), Asia (4), HG (1). Value chain engagement is balanced: Raw Materials (2), Formulation (5), Manufacturing (4), Packaging (4), Supply Chain (2), Marketing (3), Commercial (4), Consumer (4). Sources are Medium confidence (IMARC, CES 2025, Mordor). For HCB the situation is the most differentiated LHC technology position in the portfolio — a proprietary dosing platform creates retailer-bypass subscription economics and the strongest defence against PL at the premium end of laundry. The binding constraint is OEM: if appliance makers (Bosch, Samsung, LG) build proprietary dosing platforms, a disintermediation scenario is activated. This is both the largest defensive moat and the largest single-point-of-failure technology trend in LHC.",
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
        peak_year=2029, diffusion_curve="front_loaded",  # Palm oil B50 disruption acute near-term; supply adapts by 2029
        name="Palm Oil Supply Chain Disruption (Indonesia B50)",
        direction="Contraction", probability=4, start_year=2025,
        # 12%: Palm-derived surfactants are ~15-20% of raw material input;
        # B50 diverts supply, driving 20-40% price spikes on oleochemicals
        gp1_pct_affected=0.12,
        description="Indonesia B50 mandate impact confirmed. Henkel uses palm-derived surfactants in >80% of shampoo and liquid detergent formulations (see G-06). B50 creates supply squeeze independent of EUDR compliance costs. Combined: palm oil becoming both more expensive (B50 supply diversion) and more compliance-heavy (EUDR traceability). Accelerate bio-based alternatives (T-02) and diversify to coconut-derived and synthetic surfactants. Transition window: 2-3 years before structural cost impact.",
        strategic_implication="High-confidence contraction (probability 4, 12% GP1 affected). Indonesia B50 mandate impact confirmed. Category exposure is broad LHC + Hair: FCN (4), FCA (4), LAD (5), ADW (4), Care (4), Body (4), HSC (3), IC (4), HDW (3); Color (2), Styling (3). Regional exposure is concentrated in sourcing geography: Asia (5), NA (4), Europe (4), HG (4). Value chain concentration is Raw Materials (5), Manufacturing (2), Supply Chain (4). Sources are High confidence (Indonesia B50 analysis, FMCG supply chain reports). For HCB the situation is that palm-derived surfactants feature in >80% of shampoo and liquid detergent formulations, so B50 creates a supply squeeze independent of EUDR compliance costs (G-06). The combined effect is that palm is becoming both more expensive and more compliance-heavy, shifting the economics in favour of bio-based alternatives (T-02) and precision fermentation (T-15). The transition window is 2-3 years before structural cost impact bites.",
        category_exposure=cat(2,4,3,4, 4,4,3,5,3,4,3,4),
        vc_exposure=vc(5,3,2,1,4,0,2,1),
        regional_exposure=reg(4,4,5,4),
        data_source="Indonesia B50 mandate analysis; FMCG supply chain reports", source_type="analyst_report",
        confidence="High",
    ),
    # ── E-02 ──
    Trend(
        id="environmental_r02", force="Environmental", sub_category="Resource",
        peak_year=2031, diffusion_curve="s_curve",  # Water scarcity opportunity builds steadily across Southern Europe/MENA
        name="Water Scarcity Drives Low-Water Formulations",
        direction="Expansion", probability=4, start_year=2025,
        # 7%: Water scarcity now affecting more markets (Southern Europe
        # addition); three-pillar HCB opportunity structure
        gp1_pct_affected=0.07,
        description="Water scarcity intensifying in Southern Europe, MENA, Asia. Three HCB opportunities: (1) LHC: Persil cold-wash at 20°C becomes default recommendation in water-stressed regions, (2) Hair: dry shampoo growth (C-15) amplified by water conservation, (3) LHC: concentrated formulations reduce water in product (less water = sustainability claim). For High Growth markets: India and Middle East water scarcity makes low-water formulations a market entry advantage.",
        strategic_implication="Medium-confidence expansion (probability 4, 7% GP1 affected). Water scarcity intensifying in Southern Europe, MENA and Asia. Category exposure is broad: Hair Styling (4), Care (3), Body (2); LHC FCN (3), FCA (3), LAD (4), ADW (3), HDW (3), HSC (3). Regional exposure is High-Growth (5), Europe (4), Asia (4), NA (3) — this is a markets-where-water-is-scarce trend rather than a home-market trend. Value chain engagement is balanced: Raw Materials (2), Formulation (4), Manufacturing (3), Packaging (3), Supply Chain (2), Marketing (3), Consumer (4). Sources are Medium confidence (UN Water, Open-Meteo). For HCB the situation has three pillars: cold-wash detergent becomes the default recommendation in water-stressed regions, dry shampoo (C-15) is amplified by water conservation, and concentrated formulations can be positioned with a direct sustainability claim. India and Middle East water scarcity make low-water formulations a market-entry advantage rather than just a sustainability claim.",
        category_exposure=cat(1,3,4,2, 3,3,2,4,3,3,3,2),
        vc_exposure=vc(2,4,3,3,2,3,2,4),
        regional_exposure=reg(4,3,4,5),
        data_source="UN Water Scarcity Report; Open-Meteo climate data", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── E-03 ──
    Trend(
        id="environmental_r03", force="Environmental", sub_category="Carbon",
        peak_year=2028, diffusion_curve="step_function",  # CBAM phases in 2026; CSRD Scope 3 reporting mandatory cliff
        name="Carbon Border Adjustment and Scope 3 Reporting",
        direction="Contraction", probability=4, start_year=2026,
        # 4%: CBAM adds ~1-3% to imported raw material costs;
        # Scope 3 reporting is compliance cost, not margin destruction
        gp1_pct_affected=0.04,
        description="CBAM and CSRD timeline confirmed. Scope 3 reporting requires tracing carbon footprint across entire supply chain. Henkel existing sustainability reporting infrastructure provides head start. Cost impact (1-3% on imported raw materials) modest but cumulative with palm oil (E-01), energy (E-07), tariffs (G-08/G-09). Strategic play: use Scope 3 data as supplier negotiation lever — incentivize lower-carbon offerings through preferential procurement.",
        strategic_implication="High-confidence contraction (probability 4, 4% GP1 affected) with a step-function profile. CBAM phases in 2026; CSRD Scope 3 reporting mandatory. Category exposure is uniform at 2-3 across the portfolio. Regional exposure is Europe (5), Asia (3), HG (3), NA (2). Value chain concentration is upstream: Raw Materials (4), Manufacturing (4), Supply Chain (4), Packaging (3). Sources are High confidence (EU CBAM, CSRD text). For HCB the situation is that Scope 3 reporting forces traceable carbon accounting across the entire supply chain — existing sustainability reporting infrastructure provides a head start. Cost impact is modest at 1-3% on imported raw materials but cumulative with palm (E-01), energy (E-07), tariffs (G-08/09) and biodiversity (G-11). The trend's strategic value is that Scope 3 data becomes a supplier-negotiation lever — preferential procurement for lower-carbon suppliers creates durable cost advantage as carbon prices rise.",
        category_exposure=cat(2,2,2,2, 3,3,2,3,2,2,2,3),
        vc_exposure=vc(4,2,4,3,4,1,1,0),
        regional_exposure=reg(5,2,3,3),
        data_source="EU CBAM Regulation; CSRD requirements", source_type="analyst_report",
        confidence="High",
    ),
    # ── E-04 ──
    Trend(
        id="environmental_r04", force="Environmental", sub_category="Packaging",
        peak_year=2031, diffusion_curve="linear",  # EPR fee escalation steady year-on-year across EU states
        name="EPR Fee Escalation and Eco-Modulation",
        direction="Contraction", probability=5, start_year=2025,
        # 4%: EPR fees are ~1-2% of packaging cost; eco-modulation
        # penalties can 2-5x for non-compliant materials, but small base
        gp1_pct_affected=0.04,
        description="EPR eco-modulation confirmed and expanding across EU member states. Henkel LHC trigger spray bottles (Bref, WC Frisch) specifically at risk of 3-5x eco-modulation penalties due to multi-material construction. Redesign toward mono-material packaging is mitigation — but requires R&D in spray mechanisms that work with single-plastic construction.",
        strategic_implication="High-confidence contraction (probability 5, 4% GP1 affected). EPR eco-modulation confirmed and expanding across EU member states. Category exposure is LHC-heavy: FCN (3), FCA (3), LAD (3), HSC (2), IC (3), FFI (2); Hair Color/Body/Styling (2-3). Regional exposure is Europe-only (5). Value chain concentration is Packaging (5), Raw Materials (1). Sources are High confidence (CITEO, CONAI). For HCB the situation is that trigger-spray bottles (HSC formats specifically) face 3-5x eco-modulation penalties due to multi-material construction — a targeted cost concentration on a small but margin-dense format sub-segment. Mono-material redesign is the mitigation lever but requires new R&D in spray mechanisms compatible with single-plastic construction. EPR fees themselves are a small share of packaging cost (1-2%) but the compounding risk is that eco-modulation penalties for non-compliant materials multiply the base fee by 2-5x.",
        category_exposure=cat(3,2,3,2, 3,3,2,3,2,2,2,3),
        vc_exposure=vc(1,0,1,5,2,0,2,0),
        regional_exposure=reg(5,2,1,1),
        data_source="CITEO France; CONAI Italy; EPR fee schedules", source_type="analyst_report",
        confidence="High",
    ),
    # ── E-05 ──
    Trend(
        id="environmental_r05", force="Environmental", sub_category="Climate",
        peak_year=2033, diffusion_curve="linear",  # Climate-driven pest migration is a slow geographic creep
        name="Climate-Driven Pest Pattern Shifts (Insecticide Demand)",
        direction="Expansion", probability=4, start_year=2024,
        # 8%: Directly expands IC addressable market by geographic
        # and seasonal expansion; concentrated effect on one category
        gp1_pct_affected=0.08,
        description="Climate-driven pest expansion confirmed. Henkel IC category (Catch, Home Mat) is niche but high-margin. Geographic expansion into Northern/Central Europe creates new addressable market in Germany, Austria, Benelux where Henkel distribution infrastructure is strongest. One of few climate trends unambiguously positive for HCB. Seasonal demand window extension (4 months to 6-7 months) directly increases annual sales potential.",
        strategic_implication="Medium-confidence expansion (probability 4, 8% GP1 affected). Climate-driven pest pattern shifts — one of the few climate trends unambiguously positive for the portfolio. Category exposure is narrow and concentrated: Insect Control (5); all other categories zero. Regional exposure is broad: High-Growth (5), Europe (4), Asia (4), NA (3). Value chain engagement is Raw Materials (3), Formulation (3), Manufacturing (2), Marketing (3), Commercial (3), Consumer (4). Sources are Medium confidence (ECDC, Open-Meteo). For HCB the situation is that IC is a niche but high-margin category where geographic expansion into Northern/Central Europe (Germany, Austria, Benelux) creates a new addressable market precisely where distribution infrastructure is strongest. Seasonal demand-window extension from 4 months to 6-7 months directly increases annual sales potential. The category is small in absolute terms but the trend is directly accretive rather than defensive.",
        # IC=5 (insect control is the entire trend), not FFI (fabric softener)
        category_exposure=cat(0,0,0,0, 0,0,0,0,0,0,0,5),
        vc_exposure=vc(3,3,2,1,1,3,3,4),
        regional_exposure=reg(4,3,4,5),
        data_source="ECDC vector surveillance; Open-Meteo climate trends", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── S-01 (Environmental) ──
    Trend(
        id="environmental_r06", force="Environmental", sub_category="Supply Chain",
        peak_year=2029, diffusion_curve="front_loaded",  # Nearshoring premium acute near-term, plateaus as supply rebuilds
        name="Supply Chain Nearshoring and Geopolitical Diversification",
        direction="Contraction", probability=4, start_year=2024,
        # 6%: Tariff escalation amplifies nearshoring urgency;
        # dual-sourcing premium + transition costs increasing
        gp1_pct_affected=0.06,
        description="Supply chain diversification confirmed and accelerating post-tariff escalation (G-08). Henkel 75+ country manufacturing presence provides inherent nearshoring flexibility. Turkey is strategic hub (existing factory, proximity to EMEA, free trade agreements). Short-term COGS uplift from dual-sourcing (2-5% premium) but long-term resilience. Chinese surfactant suppliers represent ~30% of European FMCG supply — diversification urgent.",
        strategic_implication="Medium-confidence contraction (probability 4, 6% GP1 affected). Supply chain diversification confirmed and accelerating post-tariff escalation (G-08). Category exposure is uniform at 2-3 across the portfolio. Regional exposure is Asia (5), Europe (4), NA (4), HG (4). Value chain concentration is upstream: Raw Materials (4), Manufacturing (3), Packaging (2), Supply Chain (5). Sources are Medium confidence (McKinsey). For HCB the situation is that 75+ country manufacturing presence provides inherent nearshoring flexibility and Turkey is a strategic hub (existing factory, proximity to EMEA, free-trade agreements). Short-term COGS uplift from dual-sourcing sits at a 2-5% premium but long-term resilience is materially improved. Chinese surfactant suppliers represent ~30% of European FMCG supply — diversification is not optional given compounding tariff, palm and energy trends.",
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
        peak_year=2028, diffusion_curve="front_loaded",  # Reckitt divestiture completed Dec 2025; 2-3 yr share window
        name="Reckitt Essential Home Divestiture",
        direction="Expansion", probability=5, start_year=2025,
        # 12%: Divestiture completed (not projected); Essential Home revenue
        # declined 7% in early 2025 signaling brand weakness
        gp1_pct_affected=0.12,
        description="Completion confirmed December 31, 2025. Essential Home revenue declined 7% in early 2025 even before divestiture. ~80 brands including Calgon, Woolite, Cillit Bang transferred. Time-limited (2-3 year) share capture window: Calgon vs. Somat (water softener), Cillit Bang vs. Bref (bathroom/toilet), Woolite vs. Perwoll (fabric care). PE ownership means reduced marketing investment and R&D cuts within 12-18 months. Henkel actions: (1) increase trade promotion in overlap categories, (2) target weakened shelf positions in retailer negotiations, (3) monitor talent acquisition from Advent operations.",
        strategic_implication="High-confidence expansion (probability 5, 12% GP1 affected). Reckitt Essential Home divestiture completed December 31, 2025 with Essential Home revenue already declining 7% in early 2025 before divestiture. Category exposure is LHC-only: FCN (4), FCA (3), FFI (3), LAD (4), ADW (3), HDW (3), HSC (4), IC (3); Hair zero. Regional exposure is Europe (5), HG (4), NA (3), Asia (2). Value chain concentration is Marketing (4), Commercial (5), Consumer (4). Sources are High confidence (Reckitt official, Advent deal terms). For HCB the situation is a time-limited share-capture window — roughly 2-3 years — across overlap categories where ~80 transferred brands face PE-ownership dynamics of reduced marketing investment and R&D cuts within 12-18 months. The core overlaps are water softener, bathroom/toilet cleaner and fabric care specialty. This is one of the few pure expansion trends on the competitive side and creates a forcing function for trade-promotion and shelf-negotiation intensity in the near term.",
        category_exposure=cat(0,0,0,0, 4,3,3,4,3,3,4,3),
        vc_exposure=vc(0,1,1,0,1,4,5,4),
        regional_exposure=reg(5,3,2,4),
        data_source="Reckitt Official Completion Announcement Dec 2025; Advent International Deal Terms", source_type="analyst_report",
        confidence="High",
    ),
    # ── X-02 ──
    Trend(
        id="competitive_r02", force="Competitive", sub_category="Strategy",
        peak_year=2029, diffusion_curve="front_loaded",  # Unilever B&W pivot already +4.3%; front-loaded competitive pressure
        name="Unilever Beauty and Wellbeing Pivot",
        direction="Contraction", probability=5, start_year=2024,
        # 15%: Direct competitive overlap in Hair Care/Body; Unilever's
        # €50B war chest intensifies fight for ~30% of Hair shelf
        gp1_pct_affected=0.15,
        description="Unilever B&W FY2025: +4.3% underlying sales confirmed. Dove Scalp + Hair Therapy launched (directly competing with C-07 scalp opportunity). Hair Care grew low-single digit but Dove Hair double-digit. Wellbeing brands (Nutrafol, K18, Liquid I.V.) delivered double-digit growth. Intensified competition in Care (Dove vs. GLISS/Schauma), Styling (TRESemmé vs. got2b). Threat is not just budget — Unilever innovation pace in Hair accelerating (Dove fibre repair technology). Henkel defense: premiumize faster via Schwarzkopf Professional crossover.",
        strategic_implication="High-confidence contraction (probability 5, 15% GP1 affected). Unilever B&W FY2025: +4.3% underlying sales, Dove Scalp + Hair Therapy launched, Hair Care grew low-single-digit but Dove Hair double-digit. Category exposure is Hair-only: Care (5), Color (3), Styling (3), Body (4); LHC minimal. Regional exposure is global: Europe (5), NA (5), Asia (5), HG (5) — this is the most geographically universal competitive threat. Value chain concentration is Marketing (5), Commercial (5), Consumer (4), Formulation (3). Sources are High confidence (Unilever FY25 results, Capital Markets Day). For HCB the situation is direct competitive overlap in Hair Care (Dove vs core Care), Styling (TRESemmé vs mass Styling) and a specific threat on scalp care (Dove Scalp + Hair Therapy directly competing with the C-07 opportunity). Beyond budget, Unilever's innovation pace in Hair is accelerating (Dove fibre repair) and the Wellbeing brand portfolio (Nutrafol, K18, Liquid I.V.) delivers double-digit growth. The intensity is unusual in that it combines scale, innovation velocity and adjacent-category acquisition simultaneously.",
        category_exposure=cat(3,5,3,4, 1,1,0,1,0,0,0,0),
        vc_exposure=vc(1,3,1,1,1,5,5,4),
        regional_exposure=reg(5,5,5,5),
        data_source="Unilever FY2025 Results; Capital Markets Day 2025; CosmeticsDesign-Europe Feb 2026", source_type="analyst_report",
        confidence="High",
    ),
    # ── X-03 ──
    Trend(
        id="competitive_r03", force="Competitive", sub_category="Strategy",
        peak_year=2029, diffusion_curve="front_loaded",  # P&G superiority framework already strengthening; 2025 proof points
        name="P&G Superiority Framework and Innovation Fortress",
        direction="Contraction", probability=5, start_year=2024,
        # 14%: Ariel The Big One captured 40% of UK Fabric Care growth;
        # P&G innovation pace exceeds original assessment
        gp1_pct_affected=0.14,
        description="P&G superiority framework confirmed and strengthening. Ariel The Big One pods contributed 40%+ of UK Fabric Care category growth FY2025. FY2025 net sales $84.3B, guided 0-4% organic 2026. Ariel vs. Persil is defining LHC battleground. P&G innovation pace in pods/capsules (larger sizes, pre-treatment integration) directly pressures Persil Discs. Pantene UV protection shows improving speed-to-market. P&G R&D ~$2B dwarfs Henkel HCB. Counter: operational efficiency and AI formulation (T-01) to compete on velocity, not budget.",
        strategic_implication="High-confidence contraction (probability 5, 14% GP1 affected). Ariel The Big One pods contributed 40%+ of UK Fabric Care category growth FY2025; P&G FY2025 net sales $84.3B. Category exposure is LHC-dominant: FCN (4), FCA (3), FFI (3), LAD (4), ADW (4), HDW (3); Hair Care/Color modest (2-3). Regional exposure is global: Europe (5), NA (5), Asia (4), HG (4). Value chain concentration is Marketing (5), Commercial (4), Consumer (3), Formulation (4). Sources are High confidence (P&G FY25 earnings). For HCB the situation is that the premium LHC detergent head-to-head against P&G is the defining category battleground and P&G's innovation pace in pods and capsules (larger sizes, pre-treatment integration) directly pressures the core premium LHC format. P&G R&D (~$2B) dwarfs HCB R&D, making absolute-budget competition infeasible. Pantene UV protection demonstrates improving speed-to-market beyond laundry. The gap must be closed via operational efficiency and AI formulation (T-01) — velocity rather than budget.",
        category_exposure=cat(2,3,2,2, 4,3,3,4,3,4,2,2),
        vc_exposure=vc(1,4,2,2,1,5,4,3),
        regional_exposure=reg(5,5,4,4),
        data_source="P&G FY2025 earnings; Investor presentation", source_type="analyst_report",
        confidence="High",
    ),
    # ── X-04 ──
    Trend(
        id="competitive_r04", force="Competitive", sub_category="Disruption",
        peak_year=2030, diffusion_curve="s_curve",  # DTC/indie disruption maturing — major CPG acquisitions mid-horizon
        name="DTC and Indie Brand Disruption in Hair",
        direction="Contraction", probability=4, start_year=2023,
        # 8%: Indie brands capture premium sub-segments (~15% of Hair
        # premium) but limited mass-market GP1 exposure
        gp1_pct_affected=0.08,
        description="DTC/indie disruption confirmed. Competitive dynamics shifting — major CPGs acquiring indie brands (P&G: Mielle Organics; Unilever: K18, Nutrafol). Indie threat partially absorbed into X-02/X-03 competitive pressure. Henkel has not made significant hair care acquisition since 2015 beauty portfolio shift — acquisition gap becoming strategic liability. Schwarzkopf Professional credibility remains organic defense, but professional-grade-at-mass-retail positioning claimed by multiple competitors.",
        strategic_implication="Medium-confidence contraction (probability 4, 8% GP1 affected). DTC/indie disruption partially absorbed into X-02/X-03 competitive pressure via major-CPG acquisitions (P&G Mielle, Unilever K18/Nutrafol). Category exposure is Hair-only: Color (3), Care (5), Styling (3), Body (2); LHC zero. Regional exposure is NA (5), Europe (4), Asia (3), HG (2). Value chain concentration is Marketing (4), Commercial (3), Consumer (5), Formulation (3). Sources are Medium confidence (DTC brand tracking, Euromonitor). For HCB the situation is that indie brands capture premium sub-segments (~15% of Hair premium) but the more material effect is strategic: the absence of significant hair-care acquisition since 2015 is becoming a portfolio liability as competitors absorb the indie pool. The counter-positioning asset is professional heritage credibility at mass retail, but the positioning is now claimed by multiple competitors, eroding the differentiation value over time.",
        category_exposure=cat(3,5,3,2, 0,0,0,0,0,0,0,0),
        vc_exposure=vc(1,3,0,2,1,4,3,5),
        regional_exposure=reg(4,5,3,2),
        data_source="DTC brand tracking; Euromonitor Hair Care 2025", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── X-05 ──
    Trend(
        id="competitive_r05", force="Competitive", sub_category="Disruption",
        peak_year=2031, diffusion_curve="back_loaded",  # Chinese FMCG EU penetration <2% today; back-loaded tariff-diverted growth
        name="Chinese FMCG Brands Enter European Market",
        direction="Contraction", probability=4, start_year=2025,
        # 6%: RE-SCORED v3.3 (April 2026, Strategic Review). Probability
        # lifted 3→4 as Trump 2.0 tariffs have materially accelerated
        # Chinese export redirection toward EU via TikTok Shop / Temu;
        # trigger (5% penetration in any EU Hair Care market) now
        # plausible within H1. gp1_pct_affected lifted 0.04→0.06 to
        # reflect broader LHC exposure via heavy-liquid direct-ship.
        gp1_pct_affected=0.06,
        description="Chinese brand EU penetration <2% but monitoring warranted. New risk: US tariffs (G-09) on Chinese goods may redirect export efforts toward tariff-free EU market via TikTok Shop/Temu — accelerating European entry. Hair Color most exposed category (Chinese brands strong in cosmetic color). LHC less exposed (transport cost for heavy liquids favors local production). Trigger: TikTok Shop hair care from Chinese brands exceeding 5% in any EU market should escalate response.",
        strategic_implication="Low-confidence contraction (probability 3, 4% GP1 affected). Chinese brand EU penetration remains <2% but US tariff-driven export redirection toward EU via TikTok Shop/Temu is a new amplifier. Category exposure is moderate across Hair (2-3) and light across LHC (0-2). Regional exposure is Europe (4), NA (3), HG (3), Asia (1). Value chain concentration is Marketing (3), Commercial (3), Consumer (4). Sources are Low confidence (TikTok Shop analytics, Temu EU data). For HCB the situation is that Hair Color is the most exposed category (Chinese brands strong in cosmetic Color) while LHC is insulated by the economics of shipping heavy liquids. The trigger condition — TikTok Shop Hair Care from Chinese brands exceeding 5% in any EU market — has not been hit but the monitoring window is active. This is a watchlist-tier trend rather than an action-tier trend, but its second-order interaction with K-04 (TikTok Shop) and G-09 (US tariffs) means small triggers can cascade.",
        category_exposure=cat(2,2,2,3, 2,1,1,2,1,1,1,0),
        vc_exposure=vc(0,1,0,0,0,3,3,4),
        regional_exposure=reg(4,3,1,3),
        data_source="TikTok Shop analytics; Temu EU expansion data", source_type="analyst_report",
        confidence="Low",
    ),
    # ── X-06 ──
    Trend(
        id="competitive_r06", force="Competitive", sub_category="Growth",
        peak_year=2032, diffusion_curve="s_curve",  # IMEA 12.1% organic — structural growth curve through H2
        name="Emerging Markets Growth Divergence — IMEA Leads",
        direction="Expansion", probability=5, start_year=2024,
        # 14%: IMEA 12.1% organic vs. 0.3% HCB overall; this is now the
        # single most important geographic growth lever for HCB
        gp1_pct_affected=0.14,
        description="Henkel IMEA 12.1% organic growth confirmed, vastly outperforming 0.3% Consumer Brands organic average. IMEA is growth engine compensating for mature market stagnation. 2026 guidance (0.5-2.5% organic HCB) suggests IMEA acceleration required to hit upper end. India (C-17) and Middle East are priority. Africa next-wave potential but requires dedicated distribution and affordability investment.",
        strategic_implication="High-confidence expansion (probability 5, 14% GP1 affected). IMEA organic growth 12.1% vastly outperforming 0.3% HCB overall — the single most important geographic growth lever in the portfolio. Category exposure is broad: Hair Care (4), Body (4), Color (3), Styling (2); LHC FCN (3), FCA (3), FFI (3), LAD (4), ADW (2), HDW (2), HSC (2), IC (2). Regional exposure is High-Growth (5), Asia (4), Europe (1), NA (1). Value chain engagement spans Formulation (3), Manufacturing (4), Packaging (3), Supply Chain (4), Marketing (4), Commercial (4), Consumer (5). Sources are High confidence (Henkel FY25 Annual Report, IMEA segment data). For HCB the situation is that IMEA acceleration is mathematically required to hit the upper end of 2026 HCB guidance (0.5-2.5% organic). India (C-17) and Middle East are the near-term priorities; Sub-Saharan Africa (X-09) is the next-wave pool. Portfolio diversification into High-Growth markets is the structural hedge against mature-market stagnation in Europe.",
        category_exposure=cat(3,4,2,4, 3,3,3,4,2,2,2,2),
        vc_exposure=vc(2,3,4,3,4,4,4,5),
        regional_exposure=reg(1,1,4,5),
        data_source="Henkel FY2025 Annual Report; IMEA segment data", source_type="analyst_report",
        confidence="High",
    ),
    # ── S-04 (Competitive) ──
    Trend(
        id="competitive_r07", force="Competitive", sub_category="Strategy",
        peak_year=2030, diffusion_curve="front_loaded",  # L'Oreal tech-beauty R&D gap already 4-5x; widens fast then plateaus
        name="L'Oreal Tech-Beauty Platform Strategy",
        direction="Contraction", probability=5, start_year=2024,
        # 12%: L'Oréal innovation output accelerating (725 patents,
        # K-SCAN +23% ROI, Prof Products +15%); R&D gap now 4-5x
        gp1_pct_affected=0.12,
        description="L'Oréal FY2025: €44.05B sales (+4% LfL), 725 patents filed, 4,000+ scientists. Professional Products +15% led by Kérastase. K-SCAN AI camera proved +23% salon sales uplift. Beauty Tech hub in India. CES 2026: Innovation Awards for Light Straight + Multi-styler and LED Face Mask. R&D investment €1.7B (4%) is 4-5x Henkel HCB. Competitive gap widening. Henkel counter: (1) Schwarzkopf Professional salon network, (2) AI formulation partnerships (T-01), (3) focused Color technical leadership.",
        strategic_implication="High-confidence contraction (probability 5, 12% GP1 affected). L'Oréal FY2025: €44.05B sales (+4% LfL), 725 patents filed, 4,000+ scientists, K-SCAN proved +23% salon sales uplift. Category exposure is Hair-only: Color (5), Care (4), Styling (3), Body (3); LHC zero. Regional exposure is global: Europe (5), NA (5), Asia (5), HG (3). Value chain concentration is Formulation (4), Marketing (5), Commercial (4), Consumer (4). Sources are High confidence (L'Oréal Annual Report, Modiface platform). For HCB the situation is that L'Oréal's R&D investment (€1.7B, 4% of revenue) is 4-5x HCB R&D and the gap is widening, meaning organic-only investment cannot close the innovation differential. Compensating levers are: professional salon network as a deployment platform no competitor can easily replicate, AI formulation partnerships (T-01) that substitute for absolute R&D scale, and focused technical leadership in Color where century-scale expertise creates category-specific depth.",
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
        peak_year=2031, diffusion_curve="linear",  # Aldi/Lidl discount expansion — steady annual share gains
        name="Discount Retail Channel Expansion in Europe",
        direction="Contraction", probability=5, start_year=2024,
        # 20%: Discount = 25-35% of grocery; every share point to
        # discount erodes branded margin by ~3-5pp on that volume
        gp1_pct_affected=0.20,
        description="Discount expansion confirmed. Aldi and Lidl are Henkel's most important and most challenging customers. Henkel has significant discount volume (Persil, Schwarzkopf listed in Aldi/Lidl Germany) at lower margin. Strategic tension: declining to supply discount cedes to PL; supplying means accepting margin erosion. Resolution: exclusive value formats for discount (different size/config vs. traditional retail), combined with DBA investment that makes consumers specifically request Persil/Schwarzkopf rather than accept PL.",
        strategic_implication="High-confidence contraction (probability 5, 20% GP1 affected) — one of the three largest Customer-side contractions in the database. Discount retail (Aldi, Lidl) is structurally expanding and captures 25-35% of European grocery. Category exposure is LHC-heavy: FCN (5), FCA (4), LAD (5), FFI (3), ADW (4), HDW (3), HSC (2), IC (2); Hair uniform at 3. Regional exposure is Europe (5), HG (2), Asia (1), NA (2). Value chain concentration is Commercial (5), Consumer (5), Marketing (3), Supply Chain (2). Sources are High confidence (NIQ, retail panel data). For HCB the situation is a strategic tension: declining to supply discount cedes volume to PL; supplying means accepting margin erosion on 30%+ of the market. Discount is simultaneously the most important and most challenging customer set in LHC. Exclusive value formats (different size/config vs traditional retail) combined with distinctive-brand-asset investment is the dual-track play, but brand-strength erosion under agent-mediated commerce (T-11/T-12) could weaken the second lever over time.",
        category_exposure=cat(3,3,3,3, 5,4,3,5,3,4,2,2),
        vc_exposure=vc(0,0,0,1,2,3,5,5),
        regional_exposure=reg(5,2,1,2),
        data_source="NIQ Retail Panel; Aldi/Lidl expansion data", source_type="analyst_report",
        confidence="High",
    ),
    # ── K-02 ──
    Trend(
        id="customer_r02", force="Customer", sub_category="E-Commerce",
        peak_year=2030, diffusion_curve="linear",  # E-commerce matured at 12-15%; steady erosion via S&S/retail media
        name="E-Commerce Profit Pool Maturation",
        direction="Contraction", probability=4, start_year=2024,
        # 8%: E-com is 12-15% of sales; pay-to-play economics erode
        # ~2-3pp margin vs offline, affecting that volume slice
        gp1_pct_affected=0.08,
        description="E-commerce stabilization at 12-15% confirmed. Amazon Subscribe & Save is specific threat to LAD and ADW — habitual replenishment products are prime S&S targets. Once consumer sets Persil S&S subscription, switching unlikely; but if they set Ariel or PL, Henkel loses locked-in customer. Ensure Persil and Somat are default S&S recommendations through Amazon advertising and review management. Retail media cost (T-06) and e-com margin erosion are compounding threats.",
        strategic_implication="Medium-confidence contraction (probability 4, 8% GP1 affected). E-commerce stabilising at 12-15% of sales; Amazon Subscribe & Save is specific threat to habitual replenishment categories. Category exposure is uniform at 3 for Hair and moderate for LHC (FCN=2, FCA=2, FFI=2, LAD=3, ADW=2, HDW=2). Regional exposure is Asia (5), NA (5), Europe (4), HG (2). Value chain concentration is Marketing (4), Commercial (4), Consumer (4), Supply Chain (3), Packaging (2). Sources are Medium confidence (eMarketer, Amazon FMCG data). For HCB the situation is that Subscribe & Save is the specific transmission channel for LAD and ADW lock-in — once a consumer sets a premium laundry or dish subscription, switching is unlikely; but if they set a competitor or PL, lock-in works against HCB. Retail media cost (T-06) and e-commerce margin erosion are compounding threats that together make online channel mix a net-drag versus offline on margin terms, despite volume being flat to growing.",
        category_exposure=cat(3,3,3,3, 2,2,2,3,2,2,1,1),
        vc_exposure=vc(0,0,0,2,3,4,4,4),
        regional_exposure=reg(4,5,5,2),
        data_source="eMarketer; Amazon FMCG data", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── K-03 ──
    Trend(
        id="customer_r03", force="Customer", sub_category="Market Structure",
        peak_year=2031, diffusion_curve="linear",  # Retailer consolidation — steady concentration of buyer power
        name="Retailer Consolidation and Power Concentration",
        direction="Contraction", probability=5, start_year=2024,
        # 15%: Top 10 grocers = 40-50% of sales; listing fee and
        # promotional pressure erodes ~2-4pp on the negotiated volume
        gp1_pct_affected=0.15,
        description="Retailer consolidation accelerating. Schwarz Group (Lidl/Kaufland), Aldi, Edeka/Rewe together represent estimated 40-50% of Henkel European HCB revenue. From Byron Sharp: brand strength (Mental Availability via DBAs) is only sustainable leverage against concentrated buyer power — retailers cannot refuse to list brands consumers specifically demand. Invest in Distinctive Brand Assets: Schwarzkopf red silhouette, Persil white packaging architecture, Somat gold/blue.",
        strategic_implication="High-confidence contraction (probability 5, 15% GP1 affected). Top 10 grocers represent 40-50% of European HCB revenue via Schwarz Group, Aldi, Edeka/Rewe concentration. Category exposure is LHC-heavier (FCN=4, FCA=4, LAD=4, FFI=3, ADW=3, HDW=3) with Hair at 2-3. Regional exposure is Europe (5), NA (3), Asia (2), HG (2). Value chain concentration is Commercial (5), Consumer (3), Supply Chain (1). Sources are High confidence (Planet Retail, European grocery consolidation data). For HCB the situation is that concentrated buyer power erodes ~2-4pp margin on the negotiated volume, and the only durable counter-lever is brand strength — Mental Availability via Distinctive Brand Assets — since retailers cannot refuse to list brands consumers specifically demand. This compounds with C-01 (PL) and T-06/K-08 (retail media) to create a three-way margin squeeze in the same customer set. K-09 (agentic commerce reshaping) could ultimately dissolve traditional retailer leverage, but not within the near-term horizon.",
        category_exposure=cat(3,3,2,3, 4,4,3,4,3,3,2,2),
        vc_exposure=vc(0,0,0,0,1,2,5,3),
        regional_exposure=reg(5,3,2,2),
        data_source="Planet Retail; European grocery consolidation data", source_type="analyst_report",
        confidence="High",
    ),
    # ── K-04 (UPGRADED April 2026) ──
    Trend(
        id="customer_r04", force="Customer", sub_category="Channel Shift",
        peak_year=2029, diffusion_curve="s_curve",  # TikTok Shop UPGRADED — $23.4B US 2026 (+48% YoY); fast S-curve
        name="TikTok Shop Becomes Top-5 FMCG Channel",
        direction="Expansion", probability=5, start_year=2024,
        # 10%: UPGRADED from 4%. TikTok Shop US projected $23.4B in 2026
        # (+48% YoY) — larger than Target, Costco, or Best Buy. Beauty/personal
        # care is 22.5% of GMV with 4.7% conversion (2x Instagram, 3x Facebook).
        # Sally Beauty launched Mar 2026. No longer "emerging" — it's a top channel.
        gp1_pct_affected=0.10,
        description="TikTok Shop US projected $23.4B in 2026 ecommerce sales (+48% YoY) — larger than Target, Costco, or Best Buy. Beauty/personal care is 22.5% of TikTok Shop GMV with 4.7% conversion rates (2x Instagram, 3x Facebook). Sally Beauty launched on TikTok Shop March 2026. got2b is natural social commerce brand (youth positioning, viral-ready formats). Schwarzkopf Color tutorials and before/after creator content proven to drive conversion. LHC: cleaning hacks and laundry TikToks increasingly driving purchase. This is no longer emerging — it's a structural channel.",
        strategic_implication="High-confidence expansion (probability 5, 10% GP1 affected — upgraded from 4% in April 2026). TikTok Shop US projected $23.4B in 2026 ecommerce sales (+48% YoY) — larger than Target, Costco or Best Buy. Beauty/personal care is 22.5% of TikTok Shop GMV at 4.7% conversion (2x Instagram, 3x Facebook). Category exposure is Hair-heavy: Care (4), Color (4), Styling (5), Body (2); LHC light (FCN=2, FCA=1, FFI=1, LAD=2). Regional exposure is NA (5), Asia (5), Europe (4), HG (3). Value chain concentration is entirely downstream: Marketing (5), Commercial (5), Consumer (5). Sources are High confidence (BeautyMatter, Sally Beauty, eMarketer). For HCB the situation is that youth-positioned Styling and Color portfolios map natively to viral-ready social commerce formats, and professional Color tutorials plus before/after creator content are proven conversion drivers. LHC adjacency via cleaning-hack content is smaller but growing. This is no longer an emerging channel — it is a structural top-5 FMCG channel in the US.",
        category_exposure=cat(4,4,5,2, 2,1,1,2,1,1,1,0),
        vc_exposure=vc(0,0,0,1,2,5,5,5),
        regional_exposure=reg(4,5,5,3),
        data_source="BeautyMatter TikTok Shop Analysis 2025; Sally Beauty Press Release Mar 2026; eMarketer Social Commerce 2026", source_type="analyst_report",
        confidence="High",
    ),
    # ── K-05 — RETIRED April 2026 ──
    # Quick Commerce Consolidation (customer_r05) RETIRED.
    # Rationale: Probability=2 and gp1_pct_affected=2% were the lowest in the
    # database. Gorillas exited, Getir consolidated. At <1% of revenue, this
    # does not meet the threshold for a CEO-facing profit pool model. The trend
    # description itself recommended "monitor but do not invest."
    # Retained as comment for audit trail.
    # ── S-05 (Customer) ──
    Trend(
        id="customer_r06", force="Customer", sub_category="Business Model",
        peak_year=2030, diffusion_curve="s_curve",  # FMCG subscription ecosystem — S&S + retailer apps mature mid-horizon
        name="FMCG Subscription and Loyalty Ecosystem Lock-in",
        direction="Contraction", probability=4, start_year=2024,
        # 6%: Subscription ecosystem expanding beyond Amazon to
        # European retailers; lock-in effect broadening
        gp1_pct_affected=0.06,
        description="Subscription lock-in expanding — now encompasses Amazon S&S, Walmart+, European retailer apps (dm app, Rossmann app, REWE Payback). Lock-in strongest in LAD and ADW — high-frequency replenishment where subscription is convenient. Persil and Somat must be default subscription option. Smartwash (T-08) is proprietary lock-in counter — cartridge-based dosing creates Henkel-owned subscription model bypassing retailer-mediated subscriptions.",
        strategic_implication="Medium-confidence contraction (probability 4, 6% GP1 affected). Subscription lock-in expanding — Amazon S&S, Walmart+, European retailer apps (dm, Rossmann, REWE Payback). Category exposure is LHC-concentrated: Automatic Dish Wash (5), Laundry Additives (4), HDW (2), FCN (2), FCA (1), HSC (1); Hair minimal (1-2). Regional exposure is NA (5), Europe (4), Asia (3), HG (1). Value chain concentration is Consumer (5), Commercial (4), Marketing (3). Sources are Medium confidence (Amazon S&S data, retailer loyalty analysis). For HCB the situation is that lock-in is strongest in LAD and ADW — high-frequency replenishment where subscription is most convenient and switching costs are highest. The proprietary Smartwash cartridge-based dosing platform (T-08) is the counter-lock-in mechanism, creating a captive Henkel-owned subscription ecosystem that bypasses retailer-mediated subscriptions entirely. This trend is therefore simultaneously a contraction threat on third-party platforms and an expansion enabler on the Smartwash platform.",
        # FCA→1 (Perwoll not subscription), FCN→2 (less subscription), ADW→5 (Somat tabs = THE subscription product)
        category_exposure=cat(2,2,1,2, 2,1,1,4,2,5,1,1),
        vc_exposure=vc(0,0,0,1,2,3,4,5),
        regional_exposure=reg(4,5,3,1),
        data_source="Amazon S&S data; Retailer loyalty program analysis", source_type="analyst_report",
        confidence="Medium",
    ),
    # ── S-10 (Customer) ──
    Trend(
        id="customer_r07", force="Customer", sub_category="Channel Creation",
        peak_year=2031, diffusion_curve="s_curve",  # Salon-to-consumer crossover — Kérastase playbook scaling
        name="Professional Salon Channel to Consumer Crossover",
        direction="Expansion", probability=5, start_year=2025,
        # 12%: L'Oréal Prof Products +15% in 2025 proves commercial model;
        # Schwarzkopf Professional is Henkel's highest-value growth play
        gp1_pct_affected=0.12,
        description="Salon-to-consumer crossover accelerating: L'Oréal Professional Products +15% in 2025, Kérastase double-digit. B2C now 63% of $23.4B market. Schwarzkopf Professional is top-3 global salon brand — credibility that Dove/Pantene/TRESemmé cannot match. Execution challenge: salon professionals may resist dilution into mass retail. Follow Kérastase playbook: selective premium retail (Douglas, Sephora, dm premium shelf), not mass distribution. This is Henkel Hair's highest-value strategic play.",
        strategic_implication="High-confidence expansion (probability 5, 12% GP1 affected). Salon-to-consumer crossover accelerating: L'Oréal Professional Products +15% in 2025, Kérastase double-digit. B2C is now 63% of the $23.4B professional market. Category exposure is Hair-only: Color (5), Care (5), Styling (4), Body (2); LHC zero. Regional exposure is NA (5), Europe (4), Asia (4), HG (2). Value chain engagement is broad: Raw Materials (2), Formulation (3), Manufacturing (2), Packaging (3), Supply Chain (3), Marketing (5), Commercial (5), Consumer (5). Sources are High confidence (Future Market Insights). For HCB the situation is that the professional arm is a top-3 global salon brand — credibility that mass Hair competitors cannot match — making this the highest-value Hair strategic play in the portfolio. The execution constraint is channel management: salon professionals may resist dilution into mass retail. Selective premium retail distribution (Douglas, Sephora, premium drugstore shelves) follows the Kérastase playbook and avoids the mass-retail cannibalisation risk.",
        category_exposure=cat(5,5,4,2, 0,0,0,0,0,0,0,0),
        vc_exposure=vc(2,3,2,3,3,5,5,5),
        regional_exposure=reg(4,5,4,2),
        data_source="Future Market Insights Professional Hair Care 2025", source_type="analyst_report",
        confidence="High",
    ),

    # ═══════════════════════════════════════════════════════════════════
    # NEW TRENDS — Added March 2026 Source Audit
    # ═══════════════════════════════════════════════════════════════════

    # ── M-01 — RETIRED (CONSOLIDATED) v3.3 April 2026 ──
    # Generative AI Disrupts Product Discovery (technology_r09) RETIRED.
    # Rationale: v3.1 added technology_r13 ("Generative Search (GEO)
    # Replaces Traditional Product Discovery — Expanded") which already
    # states in its description that it expands and supersedes M-01.
    # Running both creates double-counting of GEO/LLM discovery shift
    # in the Shift Matrix (same VC Marketing/Commercial/Consumer rows,
    # same category spread, same regional profile). The v3.3 Strategic
    # Review recommended retiring technology_r09 to eliminate the
    # duplication. technology_r13 remains active with prob 5 / GP1 12%
    # and carries the full signal going forward.
    # Retained as comment for audit trail.

    # ── M-02: Tariffs, Trade Wars, and Deglobalization ──
    Trend(
        id="government_r08", force="Government", sub_category="Trade Policy",
        peak_year=2029, diffusion_curve="front_loaded",  # US-EU-CN tariffs already escalating; front-loaded with plateau
        name="Tariffs, Trade Wars, and Deglobalization (US-EU-China)",
        direction="Contraction", probability=5, start_year=2025,
        gp1_pct_affected=0.10,
        description="Trade tension escalated significantly. US Section 301 tariffs (25-60% on Chinese-origin inputs) now effective. Henkel faces three-front trade exposure: (1) US-bound products with imported ingredients face tariff pass-through, (2) EU-China surfactant supply chain disrupted, (3) K-beauty competitor advantage (Korean FTA with EU) while Henkel German production faces higher input costs. Henkel 75+ country manufacturing footprint provides flexibility for tariff arbitrage.",
        strategic_implication="Medium-confidence contraction (probability 5, 10% GP1 affected). US Section 301 tariffs at 25-60% on Chinese-origin inputs now effective. Category exposure is uniform at 2-3 across the portfolio, with slight tilt toward LHC (FCN=3, FCA=3, LAD=3, ADW=3, IC=3). Regional exposure is North America (5), Asia (5) and High-Growth (4) — multi-directional. Value chain concentration is Raw Materials (5), Supply Chain (5), Manufacturing (2), Packaging (3). Sources are Medium confidence (WTO, Peterson, Deloitte). For HCB the situation is three-front: US-bound products with imported ingredients face tariff pass-through; EU-China surfactant supply chains are disrupted; Korean competitors benefit from K-EU FTA while German production faces higher input costs. The 75+ country manufacturing footprint provides flexibility for tariff arbitrage but the frictional cost of repositioning production is real. This trend compounds E-01 (palm), E-06 (nearshoring) and E-07 (energy) — deglobalisation costs layer.",
        category_exposure=cat(2,2,2,2, 3,3,2,3,2,3,2,3),
        vc_exposure=vc(5,2,2,3,5,1,1,1),
        regional_exposure=reg(4,5,5,4),
        data_source="WTO Trade Monitoring 2025; Peterson Institute; Deloitte 2026 CPG Outlook", source_type="research_report",
        confidence="Medium",
    ),
    # ── M-03: Energy Cost Volatility and European Manufacturing ──
    Trend(
        id="environmental_r07", force="Environmental", sub_category="Cost Structure",
        peak_year=2030, diffusion_curve="linear",  # EU energy-cost disadvantage structural through H1
        name="Energy Cost Volatility and European Manufacturing Competitiveness",
        direction="Contraction", probability=4, start_year=2024,
        gp1_pct_affected=0.07,
        description="European energy cost disadvantage confirmed at 2-3x US levels. Henkel European manufacturing base (Düsseldorf HQ, 15+ European plants) disproportionately affected vs. P&G and Unilever with more diversified global manufacturing. German nuclear phase-out specifically increases Henkel home-market energy costs. Mitigation: energy efficiency programs and renewable PPAs. Strategic question: shift incremental manufacturing to lower-energy-cost regions (Turkey, Egypt, India) — aligned with High Growth strategy (X-06).",
        strategic_implication="High-confidence contraction (probability 4, 7% GP1 affected). European energy cost disadvantage confirmed at 2-3x US levels. Category exposure is uniform at 2-3 across the portfolio. Regional exposure is Europe (5), Asia (2), HG (2), NA (1). Value chain concentration is Manufacturing (5), Raw Materials (2), Formulation (2), Supply Chain (3). Sources are High confidence (IEA, CEFIC, VCI). For HCB the situation is disproportionate: the Düsseldorf-centred European manufacturing base (15+ plants) is structurally disadvantaged versus P&G and Unilever with more diversified global manufacturing footprints. German nuclear phase-out specifically increases home-market energy costs. The strategic implication is a manufacturing-footprint optimisation question that aligns with High-Growth strategy (X-06) — incremental manufacturing in Turkey, Egypt, India combines energy arbitrage with geographic growth.",
        category_exposure=cat(2,2,2,2, 3,3,3,3,3,3,3,3),
        vc_exposure=vc(2,2,5,2,3,0,0,0),
        regional_exposure=reg(5,1,2,2),
        data_source="IEA World Energy Outlook 2025; CEFIC European Chemical Industry 2025; VCI Reports", source_type="research_report",
        confidence="High",
    ),
    # ── M-04: Generative AI Marketing Efficiency ──
    Trend(
        id="technology_r10", force="Technology", sub_category="Operations",
        peak_year=2028, diffusion_curve="front_loaded",  # RE-SCORED v3.3: Gen AI creative now at full diffusion in CPG; front-loaded with early peak
        name="Generative AI Content and Marketing Efficiency Revolution",
        direction="Expansion", probability=5, start_year=2025,
        # 8%: RE-SCORED v3.3 April 2026 (Strategic Review). Diffusion
        # moved s_curve→front_loaded and peak 2029→2028 — P&G and
        # Unilever are already past the 40-60% cost-save mark; the
        # curve is behind us, not ahead. GP1 impact lifted 0.06→0.08
        # as savings compound with localisation advantage for a 75-
        # country portfolio.
        gp1_pct_affected=0.08,
        description="Gen AI marketing efficiency confirmed at 40-60% content production cost reduction. P&G and Unilever deploying at scale. For Henkel: efficiency gains most valuable in localization — 75+ country presence means content localization at near-zero marginal cost is disproportionate advantage. Savings partially offset retail media margin extraction (T-06). Brand safety guardrails critical — AI-generated content for Schwarzkopf Professional (medical-adjacent claims) requires human oversight.",
        strategic_implication="High-confidence expansion (probability 5, 6% GP1 affected). Gen AI content production cost reduction confirmed at 40-60%; P&G and Unilever deploying at scale. Category exposure is uniform at 3 across the portfolio. Regional exposure is NA (5), Europe (4), Asia (4), HG (2). Value chain concentration is entirely downstream at Marketing (5), Commercial (4), Consumer (3). Sources are High confidence (Deloitte, McKinsey, Bain). For HCB the situation is that efficiency gains are most valuable in localisation — 75+ country presence means content-localisation at near-zero marginal cost is a disproportionate advantage versus peers with narrower geographic footprints. Savings partially offset retail-media margin extraction (T-06), though the retail-media tax is larger than the gen-AI saving by ~2x. Brand-safety guardrails are non-optional for medical-adjacent professional claims; consumer-scale deployment for functional LHC messaging is lower-risk.",
        category_exposure=cat(3,3,3,3, 3,3,2,3,2,3,2,2),
        vc_exposure=vc(0,0,0,0,0,5,4,3),
        regional_exposure=reg(4,5,4,2),
        data_source="Deloitte 2026 CPG Outlook; McKinsey Gen AI Economic Potential; Bain AI in CP 2025", source_type="research_report",
        confidence="High",
    ),
    # ── M-05: Refill and Reuse Economy in Household Care ──
    Trend(
        id="consumer_r13", force="Consumer", sub_category="Behavioral",
        peak_year=2031, diffusion_curve="s_curve",  # Refill/reuse tied to PPWR 2030 targets; S-curve to regulatory deadline
        name="Refill and Reuse Economy in Household Care",
        direction="Expansion", probability=3, start_year=2025,
        # 5%: RE-SCORED v3.3 April 2026 (Strategic Review). Reduced
        # 0.07→0.05 — actual refill adoption is running materially
        # behind projection. dm/Rossmann refill stations reporting
        # <2% share of category volume; consumer friction higher than
        # regulatory tailwind. PPWR 2030 target remains but voluntary
        # adoption disappointing.
        gp1_pct_affected=0.05,
        description="PPWR refill targets confirmed for 2030. Henkel already has concentrated refill formats for Persil and Pril in Germany — ahead of P&G on execution. dm/Rossmann refill station expansion creates retail infrastructure. Strategic choice for Henkel: concentrate on own-brand refills (cartridge-based, Smartwash-adjacent) or participate in retailer refill ecosystems (which commoditize the product). Smartwash dosing platform (T-08) is the premium refill play; retailer refill stations the mass play. Henkel needs both.",
        strategic_implication="Low-confidence expansion (probability 3, 7% GP1 affected). Category exposure is LHC-centric: Hand Dish Wash (5), Fabric Cleaning (4), Laundry Additives (5), Automatic Dish Wash (3); Hair is minimal. PPWR 2030 refill targets act as a regulatory driver (linkage to G-04). Regional profile is Europe-led (5), secondary NA (3), Asia (2), HG (2). Value chain concentration is Packaging (5), Formulation (3), Supply Chain (3), Consumer (4). Sources are Low confidence (Ellen MacArthur, PPWR text, retailer announcements). For HCB the situation is partly de-risked — concentrated refill formats for Laundry and HDW already exist in Germany, putting HCB ahead of some peers on execution. Retailer refill stations at dm/Rossmann commoditise the product unless a proprietary cartridge platform (T-08) captures the premium refill economics. The strategic tension is refill-as-sustainability-claim vs refill-as-margin-destroyer, and which side HCB lands on depends on the mix between own-channel and retailer-channel refill exposure.",
        # FCA→2 (Perwoll refills less common), HDW→5 (Pril explicitly mentioned as the mass refill play)
        category_exposure=cat(0,1,0,1, 4,2,0,5,5,3,2,1),
        vc_exposure=vc(1,3,2,5,3,3,3,4),
        regional_exposure=reg(5,3,2,2),
        data_source="Ellen MacArthur Foundation Reuse Report; PPWR reuse targets; dm/Rossmann refill announcements", source_type="research_report",
        confidence="Low",
    ),
    # ── CJ-01 integrated: Between-Wash Fabric Care ──
    Trend(
        id="consumer_r14", force="Consumer", sub_category="Category Creation",
        peak_year=2031, diffusion_curve="s_curve",  # Between-wash fabric care largest LHC white space; mid-horizon buildout
        name="Between-Wash Fabric Care as Standalone Consumption Occasion",
        direction="Expansion", probability=4, start_year=2024,
        gp1_pct_affected=0.07,
        description="Between-wash fabric care confirmed as fastest-growing LHC occasion. Febreze ($1B+, P&G) and Lenor Crease Releaser (P&G) dominate with zero Henkel presence. This is the #1 strategic white space in LHC — every Febreze sale is a Henkel non-sale. Vernel brand extension (Vernel Fresh) or new sub-brand are logical vehicles. Outfit repeating trend (sustainability-driven) structurally reduces wash frequency, expanding between-wash occasions — self-reinforcing trend.",
        strategic_implication="Confirmed expansion (probability 4, 7% GP1 affected). Category exposure is narrow and LHC-only: Fabric Care Specialty (5), Fabric Cleaning (4), Laundry Additives (3); all other categories zero. This is a single-category white-space trend. Febreze ($1B+, P&G) and Lenor Crease Releaser (P&G) dominate the between-wash fabric-care occasion with effectively zero HCB presence — every competitor sale in this occasion is an HCB non-sale. Regional profile: NA (5) leads, Europe (4) second, Asia (3) and HG (2). Value chain: Formulation (4), Marketing (4), Consumer (5). Sources are Medium confidence (Euromonitor, P&G brand data). For HCB the situation is the #1 strategic gap in the LHC consumer journey according to the White Spot score (0.82). The reinforcing linkage is that outfit-repeating trends (sustainability-driven) structurally reduce wash frequency and therefore expand the between-wash occasion — the trend is self-reinforcing on the timescale of the model.",
        category_exposure=cat(0,0,0,0, 4,5,0,3,0,0,0,0),
        vc_exposure=vc(2,4,2,3,2,4,3,5),
        regional_exposure=reg(4,5,3,2),
        data_source="P&G Febreze brand data; Euromonitor Fabric Care 2025; Consumer journey white spot analysis", source_type="market_report",
        confidence="Medium",
    ),
    # ── CJ-02 integrated: Textile Longevity ──
    Trend(
        id="environmental_r08", force="Environmental", sub_category="Sustainability",
        peak_year=2032, diffusion_curve="s_curve",  # Textile longevity economy — consumer awareness S-curve
        name="Textile Longevity and Garment Life Extension Economy",
        direction="Expansion", probability=3, start_year=2025,
        gp1_pct_affected=0.05,
        description="EU Circular Textiles Strategy confirmed. Repositioning opportunity for Persil and Vernel — from cleaning products to garment care partners. Innovation: enzyme-based pilling removers, color-restore boosters, fiber protection additives. Outfit repeating trend creates demand for products extending garment life — premium positioning justifying price premiums. Perwoll (already positioned as gentle care) is natural HCB vehicle for garment longevity positioning.",
        strategic_implication="Low-confidence expansion (probability 3, 5% GP1 affected). EU Circular Textiles Strategy confirmed. Category exposure is narrow LHC: Fabric Care Specialty (5), Fabric Cleaning (4), Laundry Additives (4); all other zero. Regional exposure is Europe (5), NA (3), Asia (2), HG (2). Value chain concentration is Formulation (4), Consumer (5), Marketing (4). Sources are Low confidence (EU Circular Textiles Strategy, Ellen MacArthur, Euromonitor). For HCB the situation is a repositioning opportunity: washing products can be reframed from cleaning agents to 'garment-longevity partners' with enzyme-based pilling removers, color-restore boosters and fiber-protection additives. Outfit-repeating behaviour creates demand for products that demonstrably extend garment life — premium positioning justifying price premiums. Specialty fabric-care brands already positioned as gentle care are the natural vehicle. This is a marketing-architecture trend with a latent formulation R&D component.",
        category_exposure=cat(1,1,0,0, 4,5,0,4,0,0,0,0),
        vc_exposure=vc(2,4,2,2,1,4,3,5),
        regional_exposure=reg(5,3,2,2),
        data_source="EU Circular Textiles Strategy; Ellen MacArthur Foundation; Euromonitor Fabric Care 2025", source_type="regulation",
        confidence="Low",
    ),
    # ── CJ-03 integrated: Hair Styling Between Washes ──
    Trend(
        id="consumer_r15", force="Consumer", sub_category="Category Creation",
        peak_year=2030, diffusion_curve="s_curve",  # Dry shampoo / between-wash hair already on S-curve
        name="Hair Styling and Maintenance Between Washes",
        direction="Expansion", probability=4, start_year=2024,
        gp1_pct_affected=0.06,
        description="Dry shampoo/texture spray growth confirmed. got2b has existing between-wash position (dry shampoo, texture products) but significantly under-invests vs. Batiste (Church & Dwight, 40%+ share). Schwarzkopf Professional has salon-grade between-wash products not yet crossed to consumer retail. Wash frequency reduction trend (water awareness, hair health education, natural hair movement) structurally grows this occasion. Strategy: double got2b between-wash investment AND launch premium Schwarzkopf between-wash line.",
        strategic_implication="Steady expansion (probability 4, 6% GP1 affected). Category exposure is Hair-only and narrow: Styling (5), Care (2), Body (1); LHC zero. The trend is an occasion-creation vector reinforced by wash-frequency reduction (water awareness, hair-health education, natural-hair movement). Regional profile is NA-led (5) and Europe (4), with Asia (3) and HG (2). Value chain engagement is Marketing (5), Consumer (5), Formulation (4). Sources are Medium confidence (Euromonitor, Spate, competitor brand data). For HCB the situation is an existing-foothold trend: the mass Styling portfolio has a between-wash position but is materially under-invested versus the category leader (Batiste at 40%+ share). A premium-professional between-wash line would be an adjacent pool. This is the fastest-reaching lever to create incremental Hair occasions because both the product architecture and the consumer routine already exist.",
        category_exposure=cat(0,2,5,1, 0,0,0,0,0,0,0,0),
        vc_exposure=vc(2,4,2,3,2,5,4,5),
        regional_exposure=reg(4,5,3,2),
        data_source="Euromonitor Hair Styling 2025; Church & Dwight Batiste data; Spate trend data", source_type="market_report",
        confidence="Medium",
    ),

    # ═══════════════════════════════════════════════════════════════════
    # REGIONAL EXPANSION (v2.4) — APAC + NA specific trends
    # The original 55-trend database was EU-centric. These 6 trends
    # address the APAC and North America exposure gap identified in
    # the senior-partner review.
    # ═══════════════════════════════════════════════════════════════════

    # ── APAC-01: China C-Beauty Nationalism ──
    Trend(
        id="consumer_r16", force="Consumer", sub_category="Regional / APAC",
        peak_year=2030, diffusion_curve="front_loaded",  # C-Beauty nationalism already 56% of China beauty; front-loaded impact
        name="China C-Beauty Nationalism and Domestic Brand Preference",
        description="C-Beauty nationalism confirmed — domestic brands 56% of China beauty value. Schwarzkopf China is relatively small within Henkel total GP1 (estimated 3-5% of total Hair revenue), making original 15% gp1_pct_affected overstated. Trend is real and severe for China-exposed brands, but Henkel China hair exposure is sub-scale vs. L'Oréal. Adolph and Spes taking share from international brands. Strategic binary: either commit to significant China investment (acquisition of domestic hair brand) or accept managed decline and reallocate to India/APAC.",
        direction="Contraction", probability=5, start_year=2023,
        # 12%: China is ~3-5% of Henkel's total Hair revenue; Schwarzkopf
        # China sub-scale vs L'Oréal — reduced from 15% to reflect actual exposure
        gp1_pct_affected=0.12,
        strategic_implication="High-confidence contraction (probability 5, 12% GP1 affected — reduced from 15% in v3.1 to reflect true China Hair exposure). Category exposure is Hair-concentrated: Care (5), Color (4), Styling (3), Body (3); LHC minimal (0-1). Chinese domestic brands now hold 56% of China beauty value — the share loss is real and severe but HCB's China Hair revenue is estimated at only 3-5% of total Hair, capping the absolute GP1 impact. Regional exposure is Asia (5) and High-Growth (4) only. Value chain hotspots are Marketing (5), Commercial (5), Consumer (5), Supply Chain (3). Sources are High-confidence (Euromonitor, Daxue, McKinsey). For HCB the situation is a strategic binary: the footprint is too small to compete against scale competitors like L'Oréal China, and Chinese challengers (Adolph, Spes) are taking share at accelerating pace. The trend is material at the portfolio level primarily because it closes off a growth market, not because it destroys existing revenue.",
        category_exposure=cat(4,5,3,3, 1,1,0,1,0,0,0,0),
        vc_exposure=vc(2,3,2,2,3,5,5,5),
        regional_exposure=reg(1,1,5,4),
        data_source="Euromonitor China Beauty 2025; Daxue Consulting C-Beauty Report; McKinsey China Consumer Report 2025",
        source_type="analyst_report",
        confidence="High",
    ),

    # ── APAC-02: India Premium Affordability ──
    Trend(
        id="consumer_r17", force="Consumer", sub_category="Regional / APAC",
        peak_year=2032, diffusion_curve="s_curve",  # India 11% CAGR; middle-class expansion through 2032
        name="India Premium Affordability and Middle-Class Expansion",
        description="India BPC market $30B, 11% CAGR confirmed as fastest-growing top-10 market. Affordable-premium tier requires India-specific pack sizes (Rs 10-50 sachets for trial, Rs 100-200 for regular), local fragrance preferences, and General Trade distribution (80% of FMCG). Henkel FY2025 IMEA organic growth 12.1% confirms geographic thesis. Washing machine penetration (14%) is structural LHC growth driver — every new washing machine creates a Persil/Perwoll customer. Hair penetration in India remains nascent.",
        direction="Expansion", probability=5, start_year=2024,
        # 15%: India is structural growth pool; affordable-premium tier
        # expansion creates new GP1 pools that didn't exist
        gp1_pct_affected=0.15,
        strategic_implication="Structural growth pool (probability 5, 15% GP1 affected, Expansion). India BPC market $30B at 11% CAGR — the fastest-growing top-10 market globally. Category exposure is broad: Hair Care (5), Color (4), Body (4), Styling (3); LHC engaged on FCN/FCA (4) and LAD (4) where washing-machine penetration at 14% is a structural growth driver. Regional exposure is High-Growth (5) and Asia (3). Value chain activity spans Raw Materials (3), Formulation (4), Manufacturing (4), Packaging (4), Supply Chain (3), Marketing (5), Consumer (5) — a full-stack geographic expansion requires investment across the chain. Sources are High confidence (Redseer, Statista, Nykaa, Honasa). For HCB the situation is that IMEA organic growth of 12.1% in FY2025 already validates the thesis and is the single geographic lever compensating for mature-market stagnation (0.3% HCB overall). Every new washing machine is an incremental addressable customer; India premium-affordability architecture (sachets, local fragrance preferences, General Trade distribution) is the access condition.",
        category_exposure=cat(4,5,3,4, 4,4,3,4,2,2,2,3),
        vc_exposure=vc(3,4,4,4,3,5,4,5),
        regional_exposure=reg(0,0,3,5),
        data_source="Redseer India BPC Report 2025; Statista India Beauty Outlook; Nykaa Annual Report FY2025; Honasa IPO prospectus",
        source_type="analyst_report",
        confidence="High",
    ),

    # ── NA-01: US Retail Media Networks ──
    Trend(
        id="customer_r08", force="Customer", sub_category="Regional / NA Channel",
        peak_year=2029, diffusion_curve="front_loaded",  # US retail media already $58.8B; front-loaded margin extraction
        name="US Retail Media Networks Reshape Brand-Customer Economics",
        description="US retail media: $58.8B in 2025 (revised up from $55B), $69.3B forecast 2026. Amazon 79.7% share, Walmart 8.0%, capturing 89% of incremental spend. Retailers demand 8-12% of net revenue for media as condition of visibility. Schwarzkopf and Persil US face highest retail media burden relative to US market position — as mid-tier brands (not leaders like Tide/Ariel), must spend disproportionately to maintain visibility. Structural implication: Henkel US operations face lower profitability than European operations due to retail media compression. Factor into geographic capital allocation.",
        direction="Contraction", probability=5, start_year=2024,
        # 20%: RE-SCORED v3.3 April 2026. Lifted 0.18→0.20 following
        # Amazon Q4 2025 advertising disclosure ($17.3B Q4, +24% YoY)
        # and Walmart Connect investor-day guidance. Take-rate for
        # mid-tier brands rising into 10-13% band, above original
        # 8-12% modelled range.
        gp1_pct_affected=0.20,
        strategic_implication="High-confidence contraction (probability 5, 18% GP1 affected) — the single largest Customer-side GP1 impact in the database. US retail media: $58.8B in 2025, $69.3B forecast 2026; Amazon 79.7% share; retailers demand 8-12% of net revenue for visibility. Category exposure is uniform at 3-4 across the portfolio. Regional exposure is NA (5), Europe (2), Asia (2), HG (1). Value chain concentration is entirely downstream: Marketing (5), Commercial (4), Consumer (4), Supply Chain (2). Sources are High confidence (Insider Intelligence, Amazon Q4 2025, Walmart Connect). For HCB the situation is that as mid-tier US brands (not leaders like Tide/Ariel), the portfolio must spend disproportionately on retail media to maintain visibility, creating structural US operational profitability below European levels. This dynamic is a permanent rather than cyclical compression and must be factored into geographic capital-allocation decisions. The trend is the US-specific amplifier of T-06 and compounds both C-01 (PL) and C-10 (Amazon platform PL) in the same geography.",
        category_exposure=cat(3,3,3,3, 4,4,3,4,3,3,3,3),
        vc_exposure=vc(0,0,0,0,2,5,4,4),
        regional_exposure=reg(2,5,2,1),
        data_source="Insider Intelligence Retail Media Forecast 2025; Amazon Q4 2025 advertising revenue disclosure; Walmart Connect investor day Nov 2025",
        source_type="analyst_report",
        confidence="High",
    ),

    # ── NA-02: US Tariffs / Reshoring ──
    Trend(
        id="government_r09", force="Government", sub_category="Regional / NA Trade",
        peak_year=2029, diffusion_curve="front_loaded",  # US Section 301 tariffs already effective; front-loaded NA impact
        name="US Tariffs and Reshoring Pressure on Imported FMCG Inputs",
        description="US tariff escalation confirmed. Henkel US supply chain vulnerabilities: Culver City (Hair Care) and Scottsdale (LHC) operations rely on imported Asian ingredients. P&G vertical integration and US manufacturing scale provide competitive advantage in tariff environment. Henkel mitigation: identify top-20 tariff-exposed SKUs, run reformulation scenarios with US-domestic surfactant suppliers (Stepan, Pilot Chemical). Longer-term: evaluate Culver City capacity expansion justified by tariff dynamics.",
        direction="Contraction", probability=5, start_year=2026,
        # 12%: Affects COGS on US-sold SKUs with imported content;
        # mitigation via reformulation and supplier swap possible
        gp1_pct_affected=0.12,
        strategic_implication="High-confidence contraction (probability 5, 12% GP1 affected). US Section 301 tariffs are now operational with direct impact on US supply chain economics. Category exposure is broad at 3-4 across the portfolio. Regional exposure is North America (5), with minor exposure elsewhere. Value chain concentration is Raw Materials (5), Manufacturing (4), Packaging (4), Supply Chain (5) — this is an upstream cost-structure trend. Sources are High confidence (USTR, P&G earnings, BCG). For HCB the situation is that US operations (Hair Care in Culver City, LHC in Scottsdale) rely on imported Asian ingredients, placing them at direct tariff-exposure versus vertically-integrated competitors like P&G. Reformulation scenarios with US-domestic surfactant suppliers (Stepan, Pilot Chemical) are the mitigation lever, but speed-of-reformulation is bounded by formulation complexity. This is the geographic mirror of G-08 applied to HCB's NA operations.",
        category_exposure=cat(3,3,3,3, 4,4,3,4,4,4,3,3),
        vc_exposure=vc(5,3,4,4,5,1,1,2),
        regional_exposure=reg(1,5,2,1),
        data_source="USTR Section 301 Notice Feb 2026; P&G Q2 FY2026 earnings call; Reckitt FY2025 results; BCG Tariff Impact Analysis CPG 2026",
        source_type="regulation",
        confidence="High",
    ),

    # ── APAC-03: K-Beauty / J-Beauty Export Wave ──
    Trend(
        id="competitive_r08", force="Competitive", sub_category="Regional / APAC Exports",
        peak_year=2030, diffusion_curve="s_curve",  # K-Beauty/J-Beauty Europe 6.4% CAGR; S-curve penetration
        name="K-Beauty and J-Beauty Export Wave into NA and EU Hair Care",
        description="K-beauty expansion confirmed: Europe market $2.7B (2025), 6.4% CAGR. Amorepacific led EU with 12%+ share. Mise-en-Scène Perfect Serum #1 on Amazon Black Friday. Europe tripled K-beauty export share (3% to 11%, 2022-2025). Threatens Schwarzkopf in premium Care (ampoule formats, scalp-first) and Styling (serum-based). Henkel defense: professional-grade formulation credibility and broader Color shade range (K-beauty Color limited for European hair types). US tariff risk could be near-term headwind for K-beauty competitors.",
        direction="Contraction", probability=4, start_year=2024,
        # 10%: Premium Hair tier exposure in NA specifically; EU
        # penetration accelerating but still behind NA
        gp1_pct_affected=0.10,
        strategic_implication="Medium-confidence contraction (probability 4, 10% GP1 affected). K-beauty Europe market $2.7B (2025) at 6.4% CAGR; Europe tripled K-beauty export share from 3% to 11% between 2022-2025. Category exposure is Hair-only: Care (5), Color (3), Styling (4), Body (2); LHC zero. Regional exposure is NA (5), Europe (4), Asia (2), HG (2). Value chain concentration is Raw Materials (3), Formulation (5), Marketing (5), Commercial (4), Consumer (5). Sources are Medium confidence (Circana, Amorepacific, Sephora, Mintel). For HCB the situation is that the threat concentrates in premium Care — ampoule formats, scalp-first positioning — and premium Styling (serum-based), precisely where the Professional heritage defence operates. The counter-asset is broader Color shade range (K-beauty Color is limited for European hair types). US tariff risk (G-09) is a near-term headwind for K-beauty competitors, creating a temporary defensive window that does not alter the structural direction.",
        category_exposure=cat(3,5,4,2, 0,0,0,0,0,0,0,0),
        vc_exposure=vc(3,5,3,3,3,5,4,5),
        regional_exposure=reg(4,5,2,2),
        data_source="Circana US Prestige Beauty 2025; Amorepacific Q4 2025 disclosure; Sephora buyer interviews via Beauty Independent; Mintel K-Beauty Global 2025",
        source_type="analyst_report",
        confidence="Medium",
    ),

    # ── NA-03: US Hispanic/Latino Demographic Share ──
    Trend(
        id="consumer_r18", force="Consumer", sub_category="Regional / NA Demographics",
        peak_year=2031, diffusion_curve="s_curve",  # US Hispanic demographics structural; go-to-market buildout mid-horizon
        name="US Hispanic/Latino Consumers Drive Hair and LHC Category Growth",
        description="Demographics and spending data confirmed. Henkel US portfolio (Schwarzkopf, got2b, Dial, Persil, all, Purex) has minimal Hispanic-targeted offerings. Textured/curly hair gap is acute — no curl care line comparable to Shea Moisture (Unilever), Cantu (PDC Brands), or Mielle Organics (P&G). LHC: Hispanic households' higher laundry frequency (6.2 loads/week) and over-indexing on fabric softener/premium scent = direct growth lever for Persil. Spanish-language marketing and Hispanic retailer distribution are table-stakes, not optional.",
        direction="Expansion", probability=5, start_year=2024,
        # 14%: Represents a specific growth pool in US; well-defined
        # behavioral patterns and higher category spend
        gp1_pct_affected=0.14,
        strategic_implication="High-confidence expansion (probability 5, 14% GP1 affected). US Hispanic/Latino demographic and spend data confirmed. Category exposure is broad: Hair Care (5), Color (4), Styling (4), Body (3); LHC engaged on FCA (5), FCN (4), LAD (4), HDW/ADW (3). Regional exposure is NA (5) — HG (1) reflects cross-border Mexico linkage. Value chain concentration is Marketing (5), Commercial (5), Supply Chain (3), Consumer (4). Sources are High confidence (US Census ACS, NielsenIQ Multicultural, Circana). For HCB the situation is an existing-market-adjacent growth pool where the current portfolio has minimal textured-hair offering versus competitor positions (Shea Moisture at Unilever, Cantu at PDC, Mielle at P&G). On the LHC side, Hispanic households average 6.2 laundry loads/week and over-index on fabric softener and premium scent — a direct growth lever in a region already under retail-media compression (K-08). Hispanic-retailer distribution (Vallarta, Northgate) and Spanish-language creative are prerequisites rather than upside.",
        category_exposure=cat(4,5,4,3, 4,5,2,4,3,3,2,2),
        vc_exposure=vc(1,2,1,2,3,5,5,4),
        regional_exposure=reg(0,5,0,1),
        data_source="US Census Bureau ACS 2025; NielsenIQ Multicultural Consumer Report 2025; Circana US Hair Care Ethnic Segments 2025",
        source_type="government_data",
        confidence="High",
    ),

    # ═══════════════════════════════════════════════════════════════════
    # STRATEGIC REVIEW EXPANSION — April 2026 Bain Engagement
    # 24 new trends identified by 20-person senior consultant team.
    # Closes 5 critical gaps: (1) Agentic commerce, (2) Next-frontier
    # geographies, (3) Longevity medicine, (4) Ingredient platform
    # disruption, (5) Regulatory expansion (AI Act, biodiversity).
    # Horizon extended from 2030 to 2036.
    # ═══════════════════════════════════════════════════════════════════

    # ─────────────────────────────────────────────────────────────
    # GAP 1: AGENTIC COMMERCE & AI-DRIVEN CHANNEL DESTRUCTION
    # ─────────────────────────────────────────────────────────────

    # ── NEW-01 ──
    Trend(
        id="technology_r11", force="Technology", sub_category="Agentic AI",
        peak_year=2031, diffusion_curve="s_curve",  # Morgan Stanley projects 10-20% e-comm by 2030; S-curve to 2031
        name="Agentic Commerce: AI Agents Make Autonomous Purchase Decisions",
        description="By 2030, Morgan Stanley estimates AI shopping agents will capture $190-385B of US e-commerce spending (10-20% of online retail). McKinsey projects $3-5T globally. Amazon Alexa+ (launched Feb 2026) shows 3x higher shopping activity. OpenAI Operator + Instacart integration is live. Kearney projects 60% of global consumers will use AI agents for shopping by 2027. Laundry detergent and dish tabs are textbook 'low-consideration, high-frequency' categories — exactly where AI agents will make autonomous decisions. If an AI agent optimizes for price-per-load, sustainability score, and ratings, Persil must rank #1 on all three or face invisible brand switching. Byron Sharp's Mental Availability becomes irrelevant for a machine with no memory structures.",
        direction="Contraction", probability=5, start_year=2026,
        # 18%: AI agents will mediate 10-20% of online FMCG by 2030;
        # low-consideration categories (detergent, dish) most exposed
        gp1_pct_affected=0.18,
        strategic_implication="Medium-confidence contraction (probability 5, 18% GP1 affected) — the highest-impact Technology trend in the database. Morgan Stanley estimates $190-385B US e-commerce capture by agentic shopping by 2030 (10-20% of online retail); McKinsey $3-5T globally. Category exposure is LHC-heavy: Fabric Cleaning (5), Laundry Additives (5), Automatic Dish Wash (5), HDW (4), Fabric Care (4), Hard Surface Cleaner (3); Hair modest (1-2). Regional exposure is NA (5), Europe (4), Asia (4), HG (2). Value chain concentration is entirely downstream: Marketing (5), Commercial (5), Consumer (5). Sources are Medium confidence (Morgan Stanley, McKinsey, Kearney). For HCB the situation is that low-consideration, high-frequency categories — detergent, dish tabs, basic shampoo — are textbook agent-optimisation targets where price-per-load, sustainability score and ratings are the decision vector, not brand memory. If the portfolio does not rank #1 on those dimensions in the agent's evaluation, invisible brand switching occurs. Smartwash (T-08) is the one category where proprietary lock-in overrides agent optimisation.",
        category_exposure=cat(2,2,1,2, 5,4,3,5,4,5,3,2),
        vc_exposure=vc(0,0,0,0,2,5,5,5),
        regional_exposure=reg(4,5,4,2),
        data_source="Morgan Stanley Agentic Commerce 2026; McKinsey Agentic AI 2026; Kearney Consumer AI Survey 2026",
        source_type="research_report",
        confidence="Medium",
    ),
    # ── NEW-02 ──
    Trend(
        id="technology_r12", force="Technology", sub_category="Agentic AI",
        peak_year=2032, diffusion_curve="back_loaded",  # AI agent brand invisibility — second-order effect, accelerates H2
        name="AI Agent Brand Invisibility in Low-Consideration Categories",
        description="When AI agents make autonomous replenishment decisions, brand equity is bypassed for functional categories. Agents optimize on price-per-use, ratings, sustainability scores, and availability — not brand memory. Low-consideration, high-frequency categories (laundry detergent, dish tabs, basic shampoo) are most exposed. 58% of retailers predict AI will handle most shopper interactions within 5 years (Deloitte). Brand switching becomes invisible — consumers never see the alternatives the agent evaluated and rejected. Winner-take-most dynamics for agent-preferred SKUs. Premium brands with demonstrable superiority (clinical claims, patented tech, Smartwash lock-in) are defended; mid-tier brands face commoditization.",
        direction="Contraction", probability=4, start_year=2027,
        # 14%: Distinct from NEW-01 (which is the channel); this is the
        # brand-equity erosion effect specifically on mid-tier brands
        gp1_pct_affected=0.14,
        strategic_implication="Low-confidence contraction (probability 4, 14% GP1 affected). Second-order effect of T-11: brand equity erosion in agent-mediated categories. 58% of retailers predict AI will handle most shopper interactions within 5 years. Category exposure is LHC-concentrated: Fabric Cleaning (4), Laundry Additives (5), Automatic Dish Wash (4), HDW (3), Fabric Care (3); Hair moderate (2-3). Regional exposure is NA (5), Asia (4), Europe (3), HG (1). Value chain concentration is Commercial (5), Consumer (5), Marketing (5). Sources are Low confidence (Deloitte, Bain, PYMNTS). For HCB the situation is that premium brands with demonstrable superiority (clinical claims, patented technology, cartridge lock-in) are defended, while mid-tier brands face commoditisation under agent evaluation. Professional heritage credibility is the only partial insulation for Hair; mass mid-tier Hair and mid-tier LHC are most exposed. This trend is a brand-equity decay mechanism distinct from the channel capture in T-11 — both need to be managed simultaneously.",
        category_exposure=cat(2,3,2,2, 4,3,2,5,3,4,2,1),
        vc_exposure=vc(0,0,0,0,1,5,5,5),
        regional_exposure=reg(3,5,4,1),
        data_source="Deloitte Agentic Commerce Guide 2026; Bain AI in Retail 2026; PYMNTS AI Shopping 2026",
        source_type="research_report",
        confidence="Low",
    ),
    # ── NEW-03 ──
    Trend(
        id="technology_r13", force="Technology", sub_category="Digital",
        peak_year=2029, diffusion_curve="front_loaded",  # GEO replacing SEO rapidly — 4700% YoY AI-to-e-commerce traffic
        name="Generative Search (GEO) Replaces Traditional Product Discovery — Expanded",
        description="Expands M-01 (technology_r09). Pace of disruption exceeds original assessment: 35% of US consumers now use AI for product discovery vs. 13.6% using traditional search. AI-to-e-commerce traffic surged 4,700% YoY. Google organic CTR declined 1.2pp; paid CTR declined 3.6pp. Brands not cited in LLM responses face 'invisible brand' risk. Broader than original scope: applies equally to Hair (shade matching, ingredient lookup) and LHC (product comparison, sustainability claims). Schwarzkopf and Persil must invest in Generative Engine Optimization (GEO) — structured authority content that LLMs cite. Fundamentally disrupts Byron Sharp: TV/display builds human memory structures but not LLM memory structures.",
        direction="Contraction", probability=5, start_year=2025,
        # 12%: Upgraded from M-01's 10%. AI discovery is now mainstream,
        # not emerging; applies to Hair and LHC equally
        gp1_pct_affected=0.12,
        strategic_implication="High-confidence contraction (probability 5, 12% GP1 affected). Extends M-01 (T-09) with broader scope and faster disruption pace. Category exposure is uniform at 3 across the portfolio — applies to Hair (shade matching, ingredient lookup) and LHC (product comparison, sustainability claims) equally. Regional exposure is NA (5), Europe (4), Asia (4), HG (2). Value chain concentration is entirely downstream at Marketing (5), Commercial (5), Consumer (5). Sources are High confidence (eMarketer, Similarweb, CB Insights). For HCB the situation is that Generative Engine Optimisation (GEO) is a marketing-architecture overhaul rather than an SEO extension — structured authority content that LLMs cite must be produced for ingredients, clinical claims and sustainability credentials. The Byron Sharp framework requires reinterpretation: Mental Availability must be engineered into LLM memory structures, not just human ones. This trend upgrades T-09 from 10% to 12% GP1 affected as AI discovery transitions from emerging to mainstream.",
        category_exposure=cat(3,3,3,3, 3,3,2,3,2,3,2,2),
        vc_exposure=vc(0,0,0,0,0,5,5,5),
        regional_exposure=reg(4,5,4,2),
        data_source="eMarketer GEO 2026; Similarweb Gen AI Report 2025; CB Insights GEO 2026",
        source_type="research_report",
        confidence="High",
    ),

    # ─────────────────────────────────────────────────────────────
    # GAP 2: NEXT-FRONTIER GEOGRAPHIC POOLS
    # ─────────────────────────────────────────────────────────────

    # ── NEW-04 ──
    Trend(
        id="competitive_r09", force="Competitive", sub_category="Geographic Expansion",
        peak_year=2034, diffusion_curve="back_loaded",  # Sub-Saharan Africa $200B by 2030 — distribution build is 5-10 year H3
        name="Sub-Saharan Africa: $200B FMCG Frontier by 2030",
        description="Africa's FMCG market projected at $200B by 2030, driven by 1.7B consumers. Urbanization and middle-class expansion fuel demand. Private label competition lighter than Europe. Distribution inefficiency creates barriers to entry benefiting early movers with local manufacturing. Henkel has existing operations in Egypt, South Africa, and select North African markets — Sub-Saharan expansion is the gap. India (consumer_r17) proves the playbook: affordable-premium architecture, sachet formats, local production. Africa is the world's largest textured-hair market, connecting to natural hair trend (NEW-19). Nigeria and Kenya are priority hub markets.",
        direction="Expansion", probability=4, start_year=2026,
        # 12%: New geographic pool that doesn't exist in current model;
        # highest growth rate of any remaining FMCG frontier
        gp1_pct_affected=0.12,
        strategic_implication="Medium-confidence expansion (probability 4, 12% GP1 affected) — a 2034 peak year H3 Transformation trend. Africa's FMCG market projected at $200B by 2030, driven by 1.7B consumers. Category exposure is broad: Hair Care (4), Color (3), Body (4), Styling (2); LHC FCN (3), FCA (3), LAD (4), IC (3), HSC (2). Regional exposure is High-Growth (5), Asia (2), Europe (0), NA (0). Value chain engagement spans Raw Materials (3), Formulation (3), Manufacturing (4), Packaging (4), Supply Chain (5), Marketing (4), Commercial (4), Consumer (5). Sources are Medium confidence (GeoPoll, Fieldassist, EIU). For HCB the situation is a greenfield expansion pool — existing operations in Egypt, South Africa and select North African markets leave Sub-Saharan Africa as the gap. PL competition is lighter than Europe, distribution inefficiency creates entry barriers that favour early movers with local manufacturing, and the continent is the world's largest textured-hair market (connecting to C-24). This is a 5-10 year build-rather-than-capture trend that must be included in the profit pool model even though near-term P&L impact is limited.",
        category_exposure=cat(3,4,2,4, 3,3,2,4,2,1,2,3),
        vc_exposure=vc(3,3,4,4,5,4,4,5),
        regional_exposure=reg(0,0,2,5),
        data_source="GeoPoll FMCG Africa 2026; Fieldassist Africa FMCG 2026; EIU Africa Consumer Market 2025",
        source_type="research_report",
        confidence="Medium",
    ),
    # ── NEW-05 ──
    Trend(
        id="consumer_r19", force="Consumer", sub_category="Regional / APAC",
        peak_year=2032, diffusion_curve="s_curve",  # SEA digital-first beauty; Indonesia/Vietnam S-curve adoption
        name="Southeast Asia Digital-First Beauty Market",
        description="600M consumers with the world's highest e-commerce growth rates. Shopee, Lazada, and TikTok Shop dominate beauty distribution. Indonesia, Vietnam, Philippines, and Thailand are growth leaders. K-beauty and J-beauty have strong positions; Western brands need digital-first go-to-market. Henkel's Schwarzkopf has professional salon networks in Thailand and Indonesia — distribution asset for premium consumer crossover (K-07). SEA beauty market $25B+ growing at 8-10% CAGR. Social commerce penetration 2-3x Western markets. Halal-certified formulations required for Indonesia/Malaysia (250M Muslim consumers).",
        direction="Expansion", probability=4, start_year=2025,
        # 10%: Represents next-wave growth pool after India;
        # digital-first channel economics different from EU
        gp1_pct_affected=0.10,
        strategic_implication="Mid-size expansion (probability 4, 10% GP1 affected). Southeast Asia 600M consumers, $25B+ beauty market at 8-10% CAGR, with the highest global e-commerce growth rates. Category exposure is Hair-led: Care (5), Color (4), Styling (3), Body (3); LHC minimal (1-2). Regional exposure is Asia (5) and High-Growth (4). Value chain engagement is Marketing (5), Commercial (5), Consumer (5), with secondary Formulation/Manufacturing/Supply Chain (3). Sources are Medium confidence (Euromonitor, Shopee/Lazada analytics, Mintel APAC). For HCB the situation is a next-wave growth pool after India with digital-first channel economics that differ structurally from Europe — social commerce penetration is 2-3x Western levels. Professional salon networks in Thailand and Indonesia provide an in-market distribution asset for premium consumer crossover. Halal-certified formulations are a regulatory access condition for Indonesia/Malaysia's 250M Muslim consumers — a capability that competitors with decades of local presence already possess.",
        category_exposure=cat(4,5,3,3, 2,2,1,3,1,1,1,1),
        vc_exposure=vc(2,3,3,3,3,5,5,5),
        regional_exposure=reg(0,0,5,4),
        data_source="Euromonitor SEA Beauty 2025; Shopee/Lazada analytics; Mintel Asia Pacific Beauty 2026",
        source_type="market_report",
        confidence="Medium",
    ),
    # ── NEW-06 ──
    Trend(
        id="consumer_r20", force="Consumer", sub_category="Regional / LATAM",
        peak_year=2033, diffusion_curve="s_curve",  # Brazil/Mexico premiumization + nearshoring beneficiary; H2 build
        name="Brazil/Mexico Premiumization and Nearshoring Beneficiary",
        description="Latin America BPC market $60B+ and growing. Brazil is world's #4 beauty market with strong premiumization trend. Mexico benefits from US tariff-driven nearshoring — manufacturing investment up 40% since 2023. Henkel has limited LatAm presence vs. competitors (P&G, Unilever, Natura with deep distribution). Premiumization in Hair Care accelerating: Brazilian keratin/smoothing treatments are global category-defining products. Mexico: US Hispanic growth (consumer_r18) creates cross-border brand leverage. LHC: concentrated formats align with water scarcity in Northern Mexico/NE Brazil.",
        direction="Expansion", probability=4, start_year=2026,
        # 8%: Mid-size growth pool; premiumization + nearshoring
        # create structural tailwind for expansion
        gp1_pct_affected=0.08,
        strategic_implication="Mid-size expansion (probability 4, 8% GP1 affected). LatAm BPC market $60B+, Brazil is the world's #4 beauty market with strong premiumisation. Category exposure is Hair-led: Care (5), Color (4), Styling (3), Body (3); LHC moderate (FCN=3, FCA=3, LAD=3). Regional exposure is High-Growth (5) and North America (1). Value chain exposure is Marketing (4), Consumer (5), Formulation/Manufacturing/Supply Chain (3). Sources are Medium confidence (Euromonitor, ABIHPEC, nearshoring data). For HCB the situation is an under-exploited mid-sized growth pool where competitor distribution depth (P&G, Unilever, Natura) creates structural barriers. Mexico is a particular case: US tariff-driven nearshoring (manufacturing investment up 40% since 2023) intersects with the US Hispanic demographic (C-18) to create cross-border brand leverage. Brazilian keratin/smoothing treatments are globally category-defining products — the in-market formulation expertise is a potential acquisition target rather than an organic build.",
        category_exposure=cat(4,5,3,3, 3,3,2,3,2,2,2,1),
        vc_exposure=vc(2,3,3,3,3,4,4,5),
        regional_exposure=reg(0,1,0,5),
        data_source="Euromonitor LatAm Beauty 2025; Mexico nearshoring data 2026; ABIHPEC Brazil BPC Report 2025",
        source_type="market_report",
        confidence="Medium",
    ),

    # ─────────────────────────────────────────────────────────────
    # GAP 3: LONGEVITY MEDICINE & BEAUTY CONVERGENCE
    # ─────────────────────────────────────────────────────────────

    # ── NEW-07 ──
    Trend(
        id="consumer_r21", force="Consumer", sub_category="Category Creation",
        peak_year=2035, diffusion_curve="back_loaded",  # Longevity economy is H3 Transformation; slow start, accelerating finish
        name="Longevity Medicine Crossover into Beauty and Hair Care",
        description="Global anti-aging market reaching $120B by 2030 (7% CAGR from $85B in 2025). Industry pivoting from cosmetic 'anti-aging' to science-backed 'longevity' — biological resilience, cellular repair, peptide therapy, NAD+ supplementation. 70% of disposable income in US, China, Japan, Europe held by 60+ consumers. Hair care follows same trajectory: scalp longevity, follicle health, melanin preservation, gray delay. Schwarzkopf Professional's dermatological heritage (Seborin, Bonacure) provides credibility. Color portfolio has natural 'longevity' play: products that preserve natural hair health while covering gray. L'Oreal's NVIDIA partnership for AI molecule discovery is direct competitive threat.",
        direction="Expansion", probability=4, start_year=2027,
        # 10%: Supercharges premiumization (C-03) and scalp care (C-07);
        # creates new pricing tier above current premium
        gp1_pct_affected=0.10,
        strategic_implication="Longevity-economy expansion (probability 4, 10% GP1 affected) with a 2035 peak year — this is an H3 Transformation horizon trend. Category exposure is Hair-only: Care (5), Color (4), Body (3), Styling (2); LHC zero. Global anti-aging market reaches $120B by 2030. Regional exposure is broad-based across Europe (5), NA (5) and Asia (4) — older affluent populations overlap precisely with HCB's geographic strength. Value chain engagement is heavy across Raw Materials (4), Formulation (5), Manufacturing (3), Marketing (5), Commercial (4) and Consumer (5). Sources are Medium confidence (Cosmeprof, Lancet Longevity Commission, Yahoo Finance). For HCB the situation is a supercharger for premiumisation (C-03) and scalp care (C-07) rather than a standalone vector: it unlocks a new pricing tier above current premium, where willingness-to-pay for scientifically validated hair-longevity claims supports $30+ retail price points. L'Oréal's NVIDIA partnership for AI molecule discovery (X-11) is the direct competitive threat — the R&D arms race plays out in this pool.",
        category_exposure=cat(4,5,2,3, 0,0,0,0,0,0,0,0),
        vc_exposure=vc(4,5,3,3,1,5,4,5),
        regional_exposure=reg(5,5,4,2),
        data_source="Cosmeprof Beauty 2030 Report; Yahoo Finance Anti-Aging Market; Lancet Longevity Commission 2025",
        source_type="research_report",
        confidence="Medium",
    ),
    # ── NEW-08 ──
    Trend(
        id="technology_r14", force="Technology", sub_category="Biotech",
        peak_year=2033, diffusion_curve="back_loaded",  # Peptide hair science 18-24 month lab-to-shelf — commercial 2028-2033
        name="Peptide and Bioactive Hair Science",
        description="GHK-Cu peptides, NAD+ precursors, and bioactive compounds entering consumer hair formulation. Lab-to-shelf timeline compressing from 5 years to 18-24 months via AI formulation (T-01). Peptide-based hair care market emerging at $2-3B, growing 15%+ CAGR. Connects to longevity medicine (NEW-07) and microbiome science (T-04). Schwarzkopf Professional has dermatological R&D capability to develop clinical-grade peptide formulations. Risk: regulatory classification — if peptide hair products classified as quasi-pharmaceutical, EU Cosmetics Regulation (G-03) creates additional compliance burden. Position at cosmetic end, not pharmaceutical.",
        direction="Expansion", probability=3, start_year=2028,
        # 6%: Emerging science; commercial-scale products 2028-2030;
        # premiumization enabler for Hair Care and Color
        gp1_pct_affected=0.06,
        strategic_implication="Low-confidence expansion (probability 3, 6% GP1 affected) — emerging-science, 2033 peak year. Peptide hair care market at $2-3B and 15%+ CAGR. Category exposure is Hair-only: Care (5), Color (2), Body (2), Styling (1); LHC zero. Regional exposure is NA (5), Europe (4), Asia (4), HG (2). Value chain concentration is Raw Materials (5), Formulation (5), Marketing (4), Consumer (4). Sources are Low confidence (CosmeticsDesign, BeautyMatter, PubMed). For HCB the situation is that the professional dermatological R&D arm has the capability to develop clinical-grade peptide formulations, and AI-formulation acceleration (T-01) is compressing lab-to-shelf from 5 years to 18-24 months. The linkage to longevity (C-21) and microbiome (T-04) means peptide bioactives are a convergent platform across three expansion vectors. The regulatory boundary between cosmetic and quasi-pharmaceutical classification under G-03 is the main execution risk.",
        category_exposure=cat(2,5,1,2, 0,0,0,0,0,0,0,0),
        vc_exposure=vc(5,5,3,2,1,4,3,4),
        regional_exposure=reg(4,5,4,2),
        data_source="Cosmetics Design-Europe Peptides 2026; BeautyMatter Bioactive Ingredients 2025; PubMed GHK-Cu hair studies",
        source_type="research_report",
        confidence="Low",
    ),

    # ─────────────────────────────────────────────────────────────
    # GAP 4: INGREDIENT PLATFORM DISRUPTION
    # ─────────────────────────────────────────────────────────────

    # ── NEW-09 ──
    Trend(
        id="technology_r15", force="Technology", sub_category="Biotech",
        peak_year=2033, diffusion_curve="back_loaded",  # Precision fermentation cost parity 2029-2031; ramp through 2033
        name="Precision Fermentation Disrupts FMCG Ingredient Supply Chains",
        description="Precision fermentation market projected at $36B by 2030 (43-48% CAGR). Key FMCG ingredients — surfactants, fragrances, proteins, emollients — can be produced via engineered microorganisms in fermentation tanks. This eliminates palm oil dependency, EUDR compliance costs, and raw material price volatility in a single technology shift. Henkel uses palm-derived surfactants in >80% of shampoo and liquid detergent formulations. Indonesia B50 (E-01) and EUDR (G-06) already making palm sourcing expensive and compliance-heavy. First-mover advantage significant — IP on fermented surfactant formulations creates defensible moat. Cost parity with palm-derived ingredients projected 2029-2031.",
        direction="Expansion", probability=4, start_year=2028,
        # 12%: Structural exit from palm dependency; affects ~20% of
        # raw material cost structure for Hair and LHC
        gp1_pct_affected=0.12,
        strategic_implication="Medium-confidence expansion (probability 4, 12% GP1 affected). Precision fermentation market projected at $36B by 2030 (43-48% CAGR). Category exposure is broad LHC + Hair: FCN (4), FCA (4), LAD (5), ADW (4), HDW (3), HSC (3), IC (3); Hair Care (3), Body (3). Regional exposure is balanced across Europe (4), NA (4), Asia (3), HG (3). Value chain concentration is upstream: Raw Materials (5), Formulation (5), Supply Chain (3), Manufacturing (3). Sources are Medium confidence (MarketsandMarkets, Fairfield, Novozymes). For HCB the situation is that >80% of shampoo and liquid detergent formulations use palm-derived surfactants — precision fermentation eliminates palm dependency, EUDR compliance cost (G-06) and B50 supply disruption (E-01) in a single technology shift. Cost parity projected 2029-2031. First-mover IP on fermented surfactant formulations creates a defensible moat; this is the most fundamental platform shift in the LHC raw-material architecture since surfactant chemistry itself.",
        category_exposure=cat(2,3,2,3, 4,4,3,5,3,4,3,3),
        vc_exposure=vc(5,5,3,1,3,2,2,2),
        regional_exposure=reg(4,4,3,3),
        data_source="MarketsandMarkets Precision Fermentation 2026; Fairfield Market Research 2025; Novozymes Annual Report 2025",
        source_type="research_report",
        confidence="Medium",
    ),
    # ── NEW-10 ──
    Trend(
        id="technology_r16", force="Technology", sub_category="Biotech",
        peak_year=2035, diffusion_curve="back_loaded",  # Synthetic biology commercial scale 2030-2033; peaks H3
        name="Synthetic Biology Enables Novel Surfactants and Fragrances",
        description="Synthetic biology enables bio-identical production of aroma molecules, specialty surfactants, and functional proteins without agricultural extraction. Moves beyond precision fermentation (NEW-09) to entirely novel molecules impossible in nature. Companies like Ginkgo Bioworks and Zymergen designing custom organisms for consumer goods applications. Strategic for fragrance premiumization (consumer_r09): synthetic biology can create signature scent molecules exclusive to Henkel brands — genuine competitive moat vs. PL. Palm oil-free surfactants with identical or superior performance to SLS/SLES. Timeline longer than precision fermentation; commercial scale 2030-2033.",
        direction="Expansion", probability=3, start_year=2029,
        # 8%: Longer-term play (H2/H3 horizon); affects fragrance
        # premiumization and surfactant supply chain
        gp1_pct_affected=0.08,
        strategic_implication="Low-confidence expansion (probability 3, 8% GP1 affected) — H3 horizon trend, 2035 peak year. Synthetic biology enables bio-identical production of novel aroma molecules, specialty surfactants, and functional proteins impossible in nature. Category exposure is LHC-led: Fabric Cleaning (4), Laundry Additives (5), Automatic Dish Wash (4), HDW (3), FCA (3), HSC (3); Hair minor (1-2). Regional exposure is Europe (4), NA (4), Asia (3), HG (2). Value chain concentration is Raw Materials (5), Formulation (5), Marketing (3), Commercial (2). Sources are Low confidence (Ginkgo Bioworks, BCG, Nature). For HCB the situation is that synthetic biology extends precision fermentation (T-15) into novel-molecule territory — exclusive fragrance compounds could underwrite brand-specific scent signatures unobtainable by PL (reinforcing C-09 as a PL-defence moat). Cross-divisional adhesive-technologies biotech capability is latent leverage. Commercial scale is 2030-2033, so this is a position-building trend rather than an execution-window trend.",
        category_exposure=cat(1,2,1,2, 4,3,3,5,3,4,3,2),
        vc_exposure=vc(5,5,2,1,2,3,2,2),
        regional_exposure=reg(4,4,3,2),
        data_source="Ginkgo Bioworks Annual Report 2025; BCG Synthetic Biology for CPG 2025; Nature Reviews Bioengineering",
        source_type="research_report",
        confidence="Low",
    ),

    # ─────────────────────────────────────────────────────────────
    # GAP 5: REGULATORY EXPANSION
    # ─────────────────────────────────────────────────────────────

    # ── NEW-11 ──
    Trend(
        id="government_r10", force="Government", sub_category="AI Regulation",
        peak_year=2028, diffusion_curve="step_function",  # EU AI Act applies Aug 2026; high-risk AI extended to Aug 2027 — cliff
        name="EU AI Act Compliance Costs and Speed-to-Market Friction",
        description="EU AI Act fully applicable August 2, 2026; high-risk AI in regulated products extended to August 2, 2027. Every AI-powered system Henkel deploys must be classified and assessed: formulation AI (T-01), pricing algorithms, Smartwash dosing (T-08), marketing personalization (T-10), and supply chain optimization (T-05). Compliance requires risk classification, conformity assessment, and technical documentation for each system. AI-driven dynamic pricing faces scrutiny for discrimination. Competitors with EU legal/tech teams move faster; laggards face operational delays. Cost estimate: EUR 5-15M for comprehensive classification and documentation across HCB operations.",
        direction="Contraction", probability=5, start_year=2026,
        # 5%: Compliance cost + speed-to-market friction across multiple
        # AI applications; compounds across T-01, T-05, T-08, T-10
        gp1_pct_affected=0.05,
        strategic_implication="High-confidence contraction (probability 5, 5% GP1 affected). EU AI Act fully applicable August 2, 2026; high-risk AI in regulated products extended to August 2, 2027. Category exposure is uniform at 2-3 across the portfolio — every AI system requires classification. Regional exposure is Europe-only (5). Value chain concentration is Formulation (4), Manufacturing (3), Marketing (4), Raw Materials/Packaging/Commercial (2). Sources are High confidence (EU AI Act timeline, Deloitte, SIG). For HCB the situation is a compliance-cost overlay on every AI-enabled system — formulation AI (T-01), pricing algorithms, Smartwash auto-dosing (T-08), marketing personalisation (T-10), supply-chain optimisation (T-05). Compounding effect across at least five technology trends means the classification and conformity-assessment burden is multiplicative, not additive. Estimated compliance cost of €5-15M is modest at the enterprise level but the speed-to-market friction on AI-enabled innovation is the more material effect.",
        category_exposure=cat(3,3,2,2, 3,3,2,3,2,3,2,2),
        vc_exposure=vc(2,4,3,1,2,4,3,2),
        regional_exposure=reg(5,1,2,1),
        data_source="EU AI Act Timeline 2026; SIG EU AI Act Summary; Deloitte AI Regulation Impact 2026",
        source_type="regulation",
        confidence="High",
    ),
    # ── NEW-12 ──
    Trend(
        id="government_r11", force="Government", sub_category="Biodiversity",
        peak_year=2032, diffusion_curve="back_loaded",  # Biodiversity/TNFD reporting builds slowly through H2
        name="Biodiversity Regulation and Nature-Related Supply Chain Mandates",
        description="Kunming-Montreal Global Biodiversity Framework mandates halting biodiversity loss by 2030: 30% land/marine protection, 30% restoration. EU CSDDD and TNFD reporting require companies to assess and minimize biodiversity risks throughout value chains. Biodiversity loss projected to result in $2.7T lost revenue by 2030 (McKinsey). For Henkel: palm oil, water resources, agricultural inputs (fragrances, proteins), and packaging materials all have biodiversity footprints. Supply Chain Biodiversity Footprint assessments becoming mandatory. L'Oreal 100% RSPO-certified palm oil is the standard; Henkel must match or exceed.",
        direction="Contraction", probability=4, start_year=2027,
        # 6%: Supply chain compliance cost + sourcing constraints;
        # affects raw materials across Hair and LHC
        gp1_pct_affected=0.06,
        strategic_implication="Medium-confidence contraction (probability 4, 6% GP1 affected). Kunming-Montreal Global Biodiversity Framework mandates halting biodiversity loss by 2030; EU CSDDD and TNFD reporting impose value-chain biodiversity assessments. Category exposure is 2-4 across the portfolio with LHC slightly heavier (FCN=3, FCA=3, LAD=4). Regional exposure is broad: Europe (5), Asia (3), HG (4), NA (3). Value chain concentration is Raw Materials (5), Supply Chain (5), Formulation (3), Manufacturing (2) — upstream-heavy. Sources are Medium confidence (Kunming-Montreal text, McKinsey, TNFD). For HCB the situation is a supply-chain footprint trend: palm oil, water resources, fragrance and protein inputs, and packaging materials all carry biodiversity exposures. Biodiversity-footprint assessments becoming mandatory create reporting cost and sourcing constraints; at the same time, biodiversity credentials become an asset for Green Claims (G-05) substantiation. This is a compliance trend that doubles as a differentiation mechanism for companies that invest early.",
        category_exposure=cat(2,3,2,3, 3,3,2,4,2,3,2,3),
        vc_exposure=vc(5,3,2,2,5,1,2,1),
        regional_exposure=reg(5,3,3,4),
        data_source="Kunming-Montreal Framework; McKinsey CPG Value Chain Sustainability 2025; TNFD Framework 2025",
        source_type="regulation",
        confidence="Medium",
    ),
    # ── NEW-13 ──
    Trend(
        id="government_r12", force="Government", sub_category="Textile Regulation",
        peak_year=2032, diffusion_curve="back_loaded",  # EU Textile Strategy — repositioning value builds with consumer awareness
        name="EU Textile Strategy and Circular Fashion Mandates",
        description="EU Strategy for Sustainable and Circular Textiles imposes garment longevity requirements and textile waste reduction targets. Directly affects Henkel's fabric care positioning: Perwoll, Persil, and Vernel can be repositioned as 'garment longevity partners' — washing products that demonstrably extend textile life. Innovation opportunity: enzyme-based pilling removers, color-restore boosters, fiber protection additives. Expands on environmental_r08 (Textile Longevity) with regulatory driver. Digital Product Passport (G-07) for textiles creates consumer awareness of garment care impact. Regulatory tailwind for premium fabric care positioning.",
        direction="Expansion", probability=3, start_year=2028,
        # 5%: Regulatory driver for repositioning existing products;
        # moderate GP1 impact but strategic brand positioning value
        gp1_pct_affected=0.05,
        strategic_implication="Low-confidence expansion (probability 3, 5% GP1 affected) — this is a regulatory trend that creates positive repositioning value rather than compliance cost. EU Strategy for Sustainable and Circular Textiles imposes garment-longevity and textile-waste reduction targets. Category exposure is LHC-only and narrow: Fabric Care Specialty (5), Fabric Cleaning (4), Laundry Additives (4), Fabric Finisher (2); Hair zero. Regional exposure is Europe (5), with minor secondary exposure. Value chain concentration is Formulation (4), Consumer (5), Marketing (4). Sources are Low confidence (EU Textile Strategy 2022, Ellen MacArthur, Euromonitor). For HCB the situation is a regulatory driver for premium fabric-care positioning — washing products that demonstrably extend textile life can be repositioned upward on the cost-per-wear value case. The trend connects to Digital Product Passport (G-07) for textiles, which raises consumer awareness of garment-care impact, and reinforces E-08 (Textile Longevity). Premium positioning unlock is conditioned on actual performance claims that survive EmpCo scrutiny (G-05).",
        category_exposure=cat(0,0,0,0, 4,5,2,4,0,0,0,0),
        vc_exposure=vc(2,4,2,2,1,4,3,5),
        regional_exposure=reg(5,2,2,2),
        data_source="EU Strategy for Sustainable Textiles 2022; Ellen MacArthur Foundation Circular Textiles; Euromonitor Fabric Care 2025",
        source_type="regulation",
        confidence="Low",
    ),

    # ─────────────────────────────────────────────────────────────
    # COMPETITIVE ADDITIONS
    # ─────────────────────────────────────────────────────────────

    # ── NEW-14 ──
    Trend(
        id="competitive_r10", force="Competitive", sub_category="Platform",
        peak_year=2031, diffusion_curve="s_curve",  # Amazon PL data-driven expansion — S-curve targeting high-margin pockets
        name="Amazon/Platform Vertical Integration into FMCG",
        description="Amazon's private label operation is qualitatively different from traditional retail PL. Amazon possesses real-time consumer behavior data, search intent data, and review sentiment analysis. Can identify underserved price points and launch targeted PL within months. US PL grew 4.4% vs. 1.1% for national brands (early 2025). Amazon Basics threatens not through volume share but through targeted margin destruction in profitable sub-segments. Subscribe & Save (K-06 connection) amplifies lock-in. Distinct from C-01 (traditional European PL): Amazon PL is data-driven, algorithmically optimized, and platform-integrated.",
        direction="Contraction", probability=4, start_year=2025,
        # 10%: Targets highest-margin sub-segments specifically;
        # data advantage creates structural threat beyond traditional PL
        gp1_pct_affected=0.10,
        strategic_implication="High-confidence contraction (probability 4, 10% GP1 affected). Amazon PL operates qualitatively differently from traditional retail PL — real-time consumer behaviour data, search-intent data and review-sentiment analysis enable targeted sub-segment margin destruction. US PL grew 4.4% vs 1.1% for national brands in early 2025. Category exposure is LHC-heavy: FCN (4), FCA (3), LAD (5), ADW (4), HDW (3), HSC (2), Care (3), FFI (2), IC (1); Hair Color/Body/Styling moderate (2). Regional exposure is NA (5), Europe (3), Asia (3), HG (2). Value chain concentration is Marketing (4), Commercial (5), Consumer (4), Supply Chain (3). Sources are High confidence (Store Brands, Oliver Wyman, Amazon 10-K). For HCB the situation is that Amazon PL threatens through targeted margin destruction in profitable sub-segments, not through aggregate volume share. Subscribe & Save amplifies lock-in (K-06 linkage), and first-party data becomes the main defensive asset. Smartwash DTC bypasses Amazon entirely — the only proprietary channel that escapes Amazon PL competitive dynamics.",
        category_exposure=cat(2,3,2,2, 4,3,2,5,3,4,2,1),
        vc_exposure=vc(0,0,0,1,3,4,5,4),
        regional_exposure=reg(3,5,3,2),
        data_source="Store Brands Amazon PL Threat 2026; Oliver Wyman FMCG vs PL 2025; Amazon 10-K S&S Data",
        source_type="market_report",
        confidence="High",
    ),
    # ── NEW-15 ──
    Trend(
        id="competitive_r11", force="Competitive", sub_category="Innovation",
        peak_year=2030, diffusion_curve="front_loaded",  # L'Oreal-NVIDIA R&D partnership already active; gap widens front-loaded
        name="L'Oreal NVIDIA AI Molecule Discovery Partnership",
        description="L'Oreal partnered with NVIDIA for atomic-scale AI-powered molecule discovery. 725 patents filed in 2025. R&D investment EUR 1.7B (4% of revenue) is 4-5x Henkel HCB. CES 2026 Innovation Awards for Light Straight+ and LED Face Mask. Professional Products +15% in 2025. This widens the structural R&D gap beyond what Henkel can close through organic investment alone. Counter-strategies: focused AI formulation partnerships (T-01), M&A of biotech startups, and concentrated Color/scalp expertise where Henkel has 100+ year advantage.",
        direction="Contraction", probability=4, start_year=2026,
        # 8%: Widening R&D gap from 4-5x to potentially 5-6x;
        # structural competitive disadvantage in Hair innovation
        gp1_pct_affected=0.08,
        strategic_implication="High-confidence contraction (probability 4, 8% GP1 affected). L'Oréal-NVIDIA atomic-scale AI-powered molecule discovery partnership; 725 patents filed in 2025; CES 2026 Innovation Awards for Light Straight+ and LED Face Mask. Category exposure is Hair-only: Color (5), Care (4), Styling (3), Body (2); LHC zero. Regional exposure is global: Europe (5), NA (5), Asia (5), HG (3). Value chain concentration is Formulation (5), Marketing (4), Raw Materials (2), Commercial (3), Consumer (3). Sources are High confidence (L'Oréal Annual Report, PR Newswire, GCI Magazine). For HCB the situation is that the structural R&D gap widens from 4-5x to potentially 5-6x, creating a gap that cannot be closed through organic investment alone. Counter-positions are focused AI-formulation partnerships (T-01), M&A of biotech startups (X-12 linkage), and concentrated domain expertise in Color/scalp where century-scale depth matters more than absolute budget. This is the most direct signal that Hair R&D strategy must shift from catch-up-on-scale to pick-the-fight on narrow technical domains.",
        category_exposure=cat(5,4,3,2, 0,0,0,0,0,0,0,0),
        vc_exposure=vc(2,5,2,1,0,4,3,3),
        regional_exposure=reg(5,5,5,3),
        data_source="L'Oreal Annual Report 2025; PR Newswire CES 2026; GCI Magazine Beauty Tech 2026",
        source_type="annual_report",
        confidence="High",
    ),
    # ── NEW-16 ──
    Trend(
        id="competitive_r12", force="Competitive", sub_category="M&A",
        peak_year=2029, diffusion_curve="front_loaded",  # DTC M&A arms race — target pool shrinking fast; 18-month urgency
        name="DTC/Indie Brand Acquisition Arms Race Intensifies",
        description="Major acquisitions 2025-26: Rhode (e.l.f., $1B+), Medik8 (L'Oreal, $1.1B), Color Wow (L'Oreal), Dr Squatch (Unilever, $1.5B). Specialist beauty buyers consolidating indie brands into multi-channel platforms. Henkel has not made significant hair care acquisition since 2015 beauty portfolio shift — acquisition gap becoming strategic liability. The addressable pool of high-quality indie brands is shrinking as competitors bid up valuations. Each P&G/Unilever/L'Oreal acquisition closes a potential Henkel target. Expands competitive_r04 with specific M&A urgency.",
        direction="Contraction", probability=4, start_year=2024,
        # 7%: Indirectly shifts competitive balance; each acquisition
        # strengthens competitor portfolio in premium segments
        gp1_pct_affected=0.07,
        strategic_implication="High-confidence contraction (probability 4, 7% GP1 affected). Major 2025-26 acquisitions confirmed: Rhode (e.l.f., $1B+), Medik8 (L'Oréal, $1.1B), Color Wow (L'Oréal), Dr Squatch (Unilever, $1.5B). Category exposure is Hair-only: Color (4), Care (5), Styling (4), Body (2); LHC zero. Regional exposure is NA (5), Europe (4), Asia (4), HG (2). Value chain concentration is Marketing (4), Commercial (3), Consumer (5), Formulation (3). Sources are High confidence (Capstone Partners, GCI Magazine, CB Insights). For HCB the situation is that the addressable pool of high-quality indie brands is shrinking as competitors bid up valuations — each P&G/Unilever/L'Oréal acquisition closes a potential target. HCB has not made a significant Hair Care acquisition since the 2015 beauty portfolio shift, making the acquisition gap a growing strategic liability. The three priority target segments (textured/curly hair, scalp care, K-Beauty hair) align with C-24, C-07 and X-08 — each acquisition window closes as competitors move first.",
        category_exposure=cat(4,5,4,2, 0,0,0,0,0,0,0,0),
        vc_exposure=vc(1,3,1,1,1,4,3,5),
        regional_exposure=reg(4,5,4,2),
        data_source="Capstone Partners Beauty M&A Update 2026; GCI Magazine Acquisition Targets 2026; CB Insights Beauty Funding 2025",
        source_type="market_report",
        confidence="High",
    ),

    # ─────────────────────────────────────────────────────────────
    # CONSUMER ADDITIONS
    # ─────────────────────────────────────────────────────────────

    # ── NEW-17 ──
    Trend(
        id="consumer_r22", force="Consumer", sub_category="Format Disruption",
        peak_year=2032, diffusion_curve="back_loaded",  # Laundry sheets niche today; back-loaded growth if threshold breached
        name="Laundry Sheet/Strip Format Disruption",
        description="Detergent sheets and ultra-concentrated strips gaining traction: Earth Breeze, Tru Earth, Blueland leading. Plastic-free eco positioning appeals to Gen Z/Millennial consumers. Consumer Reports: cleaning power gap closing vs. traditional formats. Sheets reduce shipping weight 80%, storage space 90% — logistics advantage. E-commerce native format (flat packaging ideal for letterbox delivery). Risk to Henkel: liquid Persil and pods/discs face format competition. Counter: Henkel Smartwash cartridge is the premium concentrated format — sheets compete at value/eco end. Monitoring trigger: if sheets reach 5% of any major market, Henkel needs own sheet offering.",
        direction="Contraction", probability=3, start_year=2025,
        # 6%: Niche but growing; threatens liquid and pod formats
        # in eco-conscious segments
        gp1_pct_affected=0.06,
        strategic_implication="Low-confidence contraction (probability 3, 6% GP1 affected). Laundry sheets remain niche but growing among eco-conscious Gen Z/Millennial consumers. Category exposure is narrow LHC: Fabric Cleaning (4), Laundry Additives (5), FCA (2); Hair zero. Regional profile is NA (5), Europe (4), Asia (3), HG (2). Value chain concentration is Packaging (5), Supply Chain (4), Formulation (4), Consumer (4), Manufacturing (3). Sources are Low confidence (Zanyu, Consumer Reports, DTC brand data). For HCB the situation is a monitoring-tier trend: sheets reduce shipping weight 80% and storage 90%, and are natively suited to letterbox e-commerce — but absolute share is still below the 5% threshold in any major market. The structural risk is category cannibalisation against incumbent liquid detergents and pod/disc formats in the eco-premium segment. The counter-effect is that a premium concentrated cartridge platform (T-08) already occupies the upper end of the same consumer need-state, leaving DTC sheets in a narrower value/eco niche.",
        category_exposure=cat(0,0,0,0, 4,2,0,5,0,1,0,0),
        vc_exposure=vc(2,4,3,5,4,3,3,4),
        regional_exposure=reg(4,5,3,2),
        data_source="Zanyu Laundry Trends 2026; Consumer Reports Detergent Tests 2026; Earth Breeze sales data",
        source_type="market_report",
        confidence="Low",
    ),
    # ── NEW-18 ──
    Trend(
        id="consumer_r23", force="Consumer", sub_category="Category Convergence",
        peak_year=2033, diffusion_curve="back_loaded",  # Wellness-beauty ingestibles + topicals convergence is H3 theme
        name="Wellness-to-Beauty Convergence: Ingestibles + Topicals",
        description="Supplement + topical regimens combining for holistic beauty outcomes. Nutrafol (Unilever) proving model: oral supplements + topical products for hair health. Market expanding beyond niche: collagen supplements, biotin, and adaptogens mainstreaming. 'Beauty from within' is growing 12%+ CAGR. For Henkel: creates premiumization path but also competitive threat — if consumers believe supplements matter more than shampoo, topical product willingness-to-pay may decline. Schwarzkopf could develop 'inside + outside' hair health regimen. LHC: wellness-adjacent home care (aromatherapy laundry, stress-reducing scents) connects to fragrance premiumization (consumer_r09).",
        direction="Expansion", probability=3, start_year=2027,
        # 5%: Category convergence; moderate near-term GP1 impact
        # but strategic positioning value
        gp1_pct_affected=0.05,
        strategic_implication="Low-confidence expansion (probability 3, 5% GP1 affected). Wellness-to-beauty convergence of ingestibles + topicals, 12%+ CAGR. Category exposure is narrow: Hair Care (4), Body (3), Color (2), Styling (1); LHC minimal (1-2 on FCN/FCA/LAD). Regional profile is broad-ish: NA (5), EU (4), Asia (4), HG (2). Value chain concentration is Raw Materials (3), Formulation (4), Marketing (4), Consumer (5). Sources are Low confidence (Grand View, Mintel, Unilever Nutrafol case study). For HCB the situation is dual-edged: premium positioning opportunity on one hand (inside + outside hair health regimens), and competitive displacement risk on the other (if consumers believe supplements matter more than shampoo, topical willingness-to-pay compresses). LHC has a minor adjacency via aromatherapy/wellness-positioned fragrance ranges, reinforcing C-09. This is an H3 theme rather than near-term.",
        category_exposure=cat(2,4,1,3, 1,1,1,2,0,0,0,0),
        vc_exposure=vc(3,4,2,2,1,4,3,5),
        regional_exposure=reg(4,5,4,2),
        data_source="Grand View Research Beauty Supplements 2025; Nutrafol/Unilever Case Study; Mintel Beauty from Within 2026",
        source_type="market_report",
        confidence="Low",
    ),
    # ── NEW-19 ──
    Trend(
        id="consumer_r24", force="Consumer", sub_category="Category Creation",
        peak_year=2032, diffusion_curve="s_curve",  # Textured hair global category mainstreaming; build or buy 24 months
        name="Natural/Textured Hair as Mainstream Global Category",
        description="65% of the world's population has textured, curly, or coily hair — yet mainstream hair care portfolios are designed primarily for straight/wavy hair types. This is the largest structural white space in global hair care. P&G acquired Mielle Organics; Unilever has Shea Moisture and TRESemme Curl range; Henkel has no credible textured-hair offering. Beyond US Hispanic (consumer_r18), extends to Africa, Caribbean, Southeast Asia, and global diaspora. Market sizing: textured hair care is $8B+ globally, growing 7-9% CAGR. Product architecture fundamentally different: curl definition, moisture retention, shrinkage management, protective styling.",
        direction="Expansion", probability=4, start_year=2025,
        # 8%: Largest structural white space in Hair; 65% of
        # global population underserved; competitors acquiring positions
        gp1_pct_affected=0.08,
        strategic_implication="Medium-confidence expansion (probability 4, 8% GP1 affected) targeting the largest structural white space in global hair care. Category exposure is Hair-only: Care (5), Color (3), Styling (4), Body (2); LHC zero. 65% of the world's population has textured, curly or coily hair yet mainstream portfolios are designed for straight/wavy hair. Regional exposure is broad: NA (5), High-Growth (5), Europe (3), Asia (3) — reflecting the global diaspora geography. Value chain concentration is Formulation (5), Marketing (5), Commercial (4), Consumer (5). Sources are Medium confidence (Circana, Mintel, Grand View). For HCB the situation is that major competitors have already built or acquired positions (P&G Mielle, Unilever Shea Moisture, Unilever TRESemme Curl) while the HCB portfolio has no credible textured-hair offering at consumer scale. Market sizing is $8B+ globally at 7-9% CAGR. The trend connects tightly to C-18 (US Hispanic) and C-04 (Sub-Saharan Africa on the Competitive side), meaning three expansion vectors converge on the same capability gap.",
        category_exposure=cat(3,5,4,2, 0,0,0,0,0,0,0,0),
        vc_exposure=vc(3,5,2,3,2,5,4,5),
        regional_exposure=reg(3,5,3,5),
        data_source="Circana Ethnic Hair Segments 2025; Mintel Natural Hair 2025; Grand View Research Textured Hair 2026",
        source_type="market_report",
        confidence="Medium",
    ),

    # ─────────────────────────────────────────────────────────────
    # CUSTOMER/CHANNEL ADDITIONS
    # ─────────────────────────────────────────────────────────────

    # ── NEW-20 ──
    Trend(
        id="customer_r09", force="Customer", sub_category="Channel Disruption",
        peak_year=2032, diffusion_curve="back_loaded",  # Agentic retail media — second-order retailer restructuring
        name="Agentic Commerce Reshapes Retailer-Brand Power Dynamics",
        description="Retailer-side mirror of NEW-01 (technology_r11). When AI agents handle grocery purchasing, traditional retail power structures dissolve: shelf placement, trade promotion, category captainship all lose relevance. New intermediaries emerge (AI platforms, aggregators). Retailers lose control of shopper's consideration set. But brands also lose promotional elasticity — AI agents are immune to end-cap displays and impulse purchases. Joint Business Plans (JBPs) between Henkel and retailers must evolve to include AI agent optimization, not just shelf layout and promotional calendars. The retailer consolidation trend (customer_r03) compounds: fewer, more powerful retailers deploying AI purchasing agents create unprecedented concentration of buying power.",
        direction="Contraction", probability=4, start_year=2027,
        # 12%: Fundamental restructuring of brand-retailer economics;
        # trade spend architecture must be rebuilt for agentic era
        gp1_pct_affected=0.12,
        strategic_implication="Low-confidence contraction (probability 4, 12% GP1 affected) — H3 horizon retailer-side trend. When AI agents handle grocery purchasing, traditional retail power structures dissolve: shelf placement, trade promotion and category captainship lose relevance. Category exposure is LHC-heavy: FCN (4), FCA (3), LAD (4), ADW (4), HDW (3), HSC (2); Hair uniform at 2. Regional exposure is NA (5), Europe (4), Asia (3), HG (2). Value chain concentration is entirely downstream: Marketing (4), Commercial (5), Consumer (5), Supply Chain (2). Sources are Low confidence (Deloitte, Bain, PwC). For HCB the situation is that Joint Business Plans must evolve to include AI-agent optimisation rather than just shelf and promotion architecture, while retailer consolidation (K-03) compounds into unprecedented buyer-power concentration — fewer, more powerful retailers deploying AI purchasing agents. First-party consumer data becomes an existential asset; proprietary direct channels (Smartwash) bypass the retailer-mediated AI layer entirely.",
        category_exposure=cat(2,2,2,2, 4,3,2,4,3,4,2,2),
        vc_exposure=vc(0,0,0,0,2,4,5,5),
        regional_exposure=reg(4,5,3,2),
        data_source="Deloitte Agentic Commerce 2026; Bain AI in Retail 2026; PwC Retail Transformation 2026",
        source_type="research_report",
        confidence="Low",
    ),
    # ── NEW-21 ──
    # Note: TikTok Shop upgrade handled in K-04 (customer_r04) above.
    # This slot reserved for additional customer trend if needed.

    # ─────────────────────────────────────────────────────────────
    # ENVIRONMENTAL ADDITIONS
    # ─────────────────────────────────────────────────────────────

    # ── NEW-22 ──
    Trend(
        id="environmental_r09", force="Environmental", sub_category="Climate",
        peak_year=2033, diffusion_curve="back_loaded",  # Climate adaptation capex accelerates as events intensify
        name="Climate Adaptation Costs for European Manufacturing",
        description="Extreme weather events disrupting European supply chains with increasing frequency. Henkel's 15+ European manufacturing plants face flood risk (Rhine corridor), heat stress (production shutdowns above 40C), and water supply constraints. Insurance costs for industrial properties rising 15-20% annually in climate-exposed regions. Munich Re data: European natural catastrophe losses doubled in the last decade. Beyond operational disruption: climate adaptation capex (flood barriers, cooling systems, water recycling) adds to fixed cost base. Strategic alignment with manufacturing footprint optimization (environmental_r07 energy costs, environmental_r06 nearshoring): plants in Turkey, India, and North Africa may have climate advantages over Central European locations.",
        direction="Contraction", probability=4, start_year=2026,
        # 6%: Increasing frequency of disruption events; capex
        # for climate-proofing compounds with energy costs
        gp1_pct_affected=0.06,
        strategic_implication="Medium-confidence contraction (probability 4, 6% GP1 affected). Extreme weather events disrupting European supply chains; European natcat losses doubled in the last decade (Munich Re). Category exposure is uniform at 2-3 across the portfolio. Regional exposure is Europe (5), Asia (3), HG (3), NA (2). Value chain concentration is Manufacturing (5), Supply Chain (4), Raw Materials (3), Packaging (2). Sources are Medium confidence (Munich Re, IPCC AR6, EEA). For HCB the situation is that 15+ European plants face compound climate risk — flood (Rhine corridor), heat stress (production shutdowns above 40°C), and water supply constraints. Insurance costs for industrial properties are rising 15-20% annually in climate-exposed regions. Beyond operational disruption, climate-adaptation capex (flood barriers, cooling systems, water recycling) adds to fixed-cost base. The footprint-optimisation logic aligns with energy costs (E-07) and nearshoring (E-06) — Turkey/India/North Africa may have composite climate-energy advantages.",
        category_exposure=cat(2,2,2,2, 3,3,3,3,3,3,3,3),
        vc_exposure=vc(3,2,5,2,4,0,0,0),
        regional_exposure=reg(5,2,3,3),
        data_source="Munich Re NatCat Report 2025; IPCC AR6 European Projections; EEA Climate Adaptation Report 2025",
        source_type="research_report",
        confidence="Medium",
    ),
    # ── NEW-23 ──
    Trend(
        id="environmental_r10", force="Environmental", sub_category="Resource",
        peak_year=2034, diffusion_curve="back_loaded",  # Freshwater regulatory limits plausible by 2032-2035 — H3 peak
        name="Freshwater Crisis Accelerates Waterless Formulation Mandate",
        description="Global freshwater demand will exceed supply by 40% by 2030 (UNEP). Half the world faces severe water stress. Expands and upgrades environmental_r02 (Water Scarcity) for the 10-year horizon. By 2032-2035, regulatory water-use limits on consumer products are plausible in Southern Europe, MENA, India, and parts of China. Water-intensive industries (cosmetics, detergents) face both manufacturing constraints and in-use reformulation pressure. This is not just about 'low-water formulations' — it's about fundamental product architecture: solid shampoo bars, waterless detergent concentrates, anhydrous hair treatments. Henkel Smartwash auto-dosing reduces water waste per wash — sustainability positioning opportunity.",
        direction="Contraction", probability=4, start_year=2027,
        # 10%: Upgrades E-02 (7%) for longer horizon; regulatory
        # water-use limits become plausible by 2032-2035
        gp1_pct_affected=0.10,
        strategic_implication="Medium-confidence contraction (probability 4, 10% GP1 affected) — upgrades E-02 for the longer horizon. Global freshwater demand will exceed supply by 40% by 2030 (UNEP). Category exposure is broad: Hair Care (3), Color (2), Styling (3), Body (2); LHC heavy (FCN=4, FCA=4, LAD=4, ADW=4, HSC=3, HDW=3). Regional exposure is High-Growth (5), Europe (4), Asia (4), NA (3). Value chain concentration is Raw Materials (3), Formulation (5), Manufacturing (4), Supply Chain (2), Consumer (4). Sources are Medium confidence (UNEP, WRI, WEF). For HCB the situation is that by 2032-2035, regulatory water-use limits on consumer products become plausible in Southern Europe, MENA, India and parts of China. This is not just a low-water formulation trend — it is a fundamental product-architecture shift toward solid shampoo bars, waterless detergent concentrates and anhydrous hair treatments. Smartwash auto-dosing already reduces water waste per wash, positioning the platform for regulatory-tailwind marketing claims.",
        category_exposure=cat(2,3,3,2, 4,4,2,4,3,4,3,2),
        vc_exposure=vc(3,5,4,3,2,3,2,4),
        regional_exposure=reg(4,3,4,5),
        data_source="UNEP Global Water Crisis 2025; WRI Aqueduct Atlas; WEF Water Demand 2023",
        source_type="research_report",
        confidence="Medium",
    ),
    # ── NEW-24 ──
    Trend(
        id="environmental_r11", force="Environmental", sub_category="Carbon",
        peak_year=2030, diffusion_curve="step_function",  # CBAM downstream expansion decision Dec 2025; 2027-2028 cliff
        name="Scope 3+ Value Chain Decarbonization Mandates",
        description="CBAM expansion to downstream products proposed Dec 2025, decision pending. Likely to include surfactants, formulated products by 2027-2028. EU ETS carbon price EUR 75/tonne (Q1 2026) and rising. CSRD Scope 3 reporting now mandatory for large companies. For Henkel: chemical inputs (surfactants for detergents) face embedded carbon costs. Manufacturing-heavy European footprint sees EUR/tonne CO2 pricing advantage for competitors in lower-carbon grids. Expands environmental_r03 (CBAM/Scope 3) with specific downstream product inclusion risk. Supply chain decarbonization becomes competitive advantage when carbon-adjusted sourcing decisions favor lower-carbon suppliers.",
        direction="Contraction", probability=4, start_year=2027,
        # 5%: Carbon cost pass-through from suppliers; compounds
        # with energy costs (E-07) and raw material costs (E-01)
        gp1_pct_affected=0.05,
        strategic_implication="Medium-confidence contraction (probability 4, 5% GP1 affected) with a step-function profile. CBAM downstream expansion proposed December 2025; EU ETS carbon price €75/tonne (Q1 2026) and rising. Category exposure is uniform at 2-3 across the portfolio with slight LHC tilt. Regional exposure is Europe (5), Asia (3), HG (3), NA (2). Value chain concentration is Raw Materials (4), Manufacturing (4), Supply Chain (4). Sources are Medium confidence (CBAM expansion proposal, EU ETS, IntegrityNext). For HCB the situation is that chemical inputs — particularly surfactants for detergents — face embedded carbon costs as CBAM extends to downstream products. Manufacturing-heavy European footprint amplifies exposure versus competitors in lower-carbon grids. The trend compounds energy costs (E-07) and raw material costs (E-01). Carbon-adjusted procurement logic becomes a competitive advantage when suppliers pass through CBAM-equivalent carbon pricing — early movers lock in lower-carbon-cost supply at pre-escalation prices.",
        category_exposure=cat(2,2,2,2, 3,3,2,3,2,3,2,3),
        vc_exposure=vc(4,2,4,2,4,1,1,0),
        regional_exposure=reg(5,2,3,3),
        data_source="CBAM Expansion Proposal Dec 2025; EU ETS Price Data Q1 2026; IntegrityNext CBAM Guide 2026",
        source_type="regulation",
        confidence="Medium",
    ),

    # ═══════════════════════════════════════════════════════════════════
    # v3.3 EXPANSION (April 2026 Strategic Review — 14 Must-Add Trends)
    # Addresses identified gaps: demographics, US regulation, retailer
    # vertical integration, LHC sub-category under-coverage, live-commerce,
    # loyalty economics, neurocosmetics, bathroom IoT, longevity LHC,
    # cleaning fluency, beauty-as-medicine DTC.
    # ═══════════════════════════════════════════════════════════════════

    # ── GAP 1 ── Demographics: Birth rate collapse / household atomisation
    Trend(
        id="consumer_r25", force="Consumer", sub_category="Demographics",
        peak_year=2033, diffusion_curve="linear",  # Slow demographic creep: EU TFR 1.38, DE 1.35, KR 0.72; linear through H3
        name="Birth Rate Collapse and Household Atomisation",
        description="Sub-replacement fertility is now structural across Europe (TFR 1.38), East Asia (Korea 0.72, Japan 1.20), and North America (1.62). Average household size declined from 2.6 (2000) to 2.2 (2025) in EU; single-person households now 35%+ in Germany. Implication for HCB is a volume-compression tailwind across Laundry (fewer wash cycles per household × fewer households forming), Dish (fewer cooking occasions), and Hair (fewer children in the formative usage window). Partially offset by smaller pack sizes commanding higher unit price, but aggregate category volume erodes in developed markets. Emerging markets (India, SEA, Africa) remain on positive demographic trajectory and become proportionally more important for HCB growth.",
        direction="Contraction", probability=5, start_year=2024,
        # 12%: Affects volume base for every category in Europe and
        # East Asia; offsets partial via smaller-pack unit pricing.
        # Structural, certain, under-modelled.
        gp1_pct_affected=0.12,
        strategic_implication="High-certainty structural contraction for developed-market volume base. Every LHC category is exposed at 3-4; Hair Color and Body at 3 (child-base erosion mitigates slower than adult population). Regional profile Europe (5), Asia (4), NA (3), HG (1). Value chain engagement Commercial (4), Marketing (3), Consumer (5). This trend is the demographic floor of the Shift Matrix: it does not peak, it compounds. Strategic response is pack-size architecture (singles, couples, seniors) and geographic rebalancing toward HG markets. Sources: Eurostat, UN WPP 2024, OECD.",
        category_exposure=cat(3,3,2,3, 4,4,3,3,4,3,3,2),
        vc_exposure=vc(0,1,1,2,1,3,4,5),
        regional_exposure=reg(5,3,4,1),
        data_source="Eurostat Demography Report 2025; UN WPP 2024 Revision; OECD Family Database 2025; Statistisches Bundesamt Household Data", source_type="government_data",
        confidence="High",
    ),

    # ── GAP 2 ── Demographics: Gen Alpha (2010+) enters category
    Trend(
        id="consumer_r26", force="Consumer", sub_category="Demographics",
        peak_year=2032, diffusion_curve="s_curve",  # Gen Alpha enters hair/personal care ~2027-2030 as teens; full formative window by 2032
        name="Gen Alpha (2010+) Enters Personal-Care Category",
        description="Gen Alpha (born 2010-2024) begins entering the personal-care category in earnest 2026-2030 as the oldest cohort turns 14-16. Early signals from Sephora Kids phenomenon (skincare at 8-12) indicate formative category entry is happening earlier than any prior generation. Brand formation in this cohort is TikTok-mediated and ingredient-literate from day one — Byron Sharp's distinctive-brand-asset playbook needs reinterpretation for a cohort that does not know pre-digital brands. For HCB Hair Styling and Color are most exposed (first independent purchase categories); Body Care is the entry point from ages 8-12. Risk: legacy brand assets (Schauma, got2b) may be culturally invisible to the cohort. Opportunity: earliest cohort ever to be reachable at formation.",
        direction="Expansion", probability=4, start_year=2026,
        # 8%: Affects future addressable Hair/Body base; asymmetric
        # opportunity-risk — brands that miss cohort formation lose
        # decade-plus penetration window.
        gp1_pct_affected=0.08,
        strategic_implication="Medium-confidence expansion with asymmetric upside/downside. Hair Styling (5), Hair Color (4), Body (5), Hair Care (3) are primary exposures; LHC minimal. Regional profile NA (5), Europe (4), Asia (4), HG (3). Value chain concentration at Marketing (5), Commercial (4), Consumer (5). Sources: Mintel Gen Alpha 2025, NielsenIQ demographic panel. Strategic tension: Mental Availability must be built via TikTok / YouTube Shorts / Roblox and ingredient-literacy content, not legacy TV assets. For HCB the got2b brand is the most natural Gen Alpha vehicle but needs creator-led re-activation. Cohort entry timing: 2027-2030 window is the critical CEP formation period.",
        category_exposure=cat(4,3,5,5, 0,0,0,0,0,0,0,0),
        vc_exposure=vc(0,1,0,1,1,5,4,5),
        regional_exposure=reg(4,5,4,3),
        data_source="Mintel Gen Alpha Consumer Report 2025; NielsenIQ Youth Demographics Panel; WGSN Gen Alpha Forecast 2026", source_type="market_report",
        confidence="Medium",
    ),

    # ── GAP 3 ── US Cosmetics Regulation (MoCRA + States)
    Trend(
        id="government_r13", force="Government", sub_category="Cosmetics Regulation",
        peak_year=2029, diffusion_curve="step_function",  # MoCRA phased enforcement 2024-2028; California/NY state cliffs 2026-2027
        name="MoCRA + US State Cosmetics Regulation (CA Prop 65, NY, WA)",
        description="MoCRA (Modernization of Cosmetics Regulation Act, 2022) enforcement phases fully in through 2028 — FDA registration, GMP, adverse-event reporting, fragrance-allergen disclosure all now binding. State layer is accelerating independently: California Prop 65 expansion (PFAS-listed substances July 2026), New York PFAS ban (2027), Washington State toxic-chemical list expansion. Compliance architecture in the US was previously light-touch relative to EU; the gap is closing fast and the state-by-state patchwork makes compliance cost per SKU materially higher than unified EU approach. For HCB Hair (Schwarzkopf Professional, Syoss US) faces the heaviest burden — professional products are explicitly covered by MoCRA. Body Care (Dial, Fa US) is in scope. LHC is out of direct scope but state-level ingredient bans may capture cleaning products via trigger rules.",
        direction="Contraction", probability=5, start_year=2024,
        # 8%: US compliance cost layer materialising for first time
        # at scale; asymmetric vs EU-style unified regulation because
        # state patchwork multiplies fixed cost per SKU.
        gp1_pct_affected=0.08,
        strategic_implication="High-certainty contraction and a material US-specific compliance cost layer. Hair categories (Color 4, Care 5, Styling 3) and Body (4) carry the weight; LHC lighter at 1-2. Regional profile NA (5), Europe (1), others (0). Value chain concentration at Raw Materials (4), Formulation (5), Packaging (3), Commercial (3). Sources: FDA MoCRA implementation updates, California OEHHA Prop 65 list, NY Department of State. Strategic implication for HCB: (a) state-by-state SKU variation multiplies PIM complexity and argues for unified most-stringent-state formulation to avoid multi-variant production; (b) MoCRA closes the regulatory-arbitrage advantage indie US brands previously enjoyed versus scaled players, net advantage for HCB; (c) EU regulatory know-how is transferable and a latent competitive asset.",
        category_exposure=cat(4,5,3,4, 2,1,1,2,1,2,2,1),
        vc_exposure=vc(4,5,2,3,2,2,3,2),
        regional_exposure=reg(1,5,0,0),
        data_source="FDA MoCRA Implementation Guidance 2025-2026; California OEHHA Prop 65 Expansion Notice July 2026; NY State Department PFAS Ban 2027; Washington State Toxic-Free Cosmetics Act", source_type="regulation",
        confidence="High",
    ),

    # ── GAP 4 ── Walmart/Costco/Aldi Vertical Integration
    Trend(
        id="competitive_r13", force="Competitive", sub_category="Retailer Vertical Integration",
        peak_year=2030, diffusion_curve="s_curve",  # Retailer PL premium tier scaling 2025-2030; vertical integration back-loaded
        name="Walmart / Costco / Aldi Vertical Integration into FMCG Supply",
        description="Top retailers are moving beyond traditional PL into full vertical integration. Walmart operates contract manufacturing for Great Value and has announced investment in dedicated CPG manufacturing capacity (2025). Costco Kirkland Signature now sources direct from manufacturers Kirkland specs, bypassing branded players entirely in multiple categories. Aldi expanding Lacura (premium PL) into Hair Care and Laundry Pods — directly attacking Schwarzkopf and Persil mid-tier price points. The structural shift is from 'PL as value option' to 'PL as the primary retailer product ecosystem' with branded manufacturers relegated to category reference points. This is a competitive trend, not a PL penetration trend — it captures the specific threat of retailers becoming manufacturing rivals rather than distribution partners.",
        direction="Contraction", probability=4, start_year=2025,
        # 10%: Distinct from consumer_r01 (PL penetration) — captures
        # vertical integration threat where retailers become rivals
        # not just channel. Amazon Basics / Solimo pattern now
        # spreading to Walmart, Costco, Aldi.
        gp1_pct_affected=0.10,
        strategic_implication="Medium-high confidence contraction. Distinct from consumer_r01 (generic PL) and competitive_r10 (Amazon PL) because it captures the specific threat of major retailers investing in their own manufacturing capacity and vertical-brand ecosystems. Category exposure is heaviest in LHC (FCN 4, ADW 4, HDW 3, FFI 3) and moderate in Hair (Care 3, Color 3). Regional profile NA (5), Europe (4 — Aldi/Lidl), Asia (2), HG (2). Value chain Commercial (5), Marketing (3), Consumer (4), Manufacturing (3). Sources: Walmart investor day, Costco annual report, Aldi expansion announcements, NielsenIQ PL premium tier data. Strategic response required: invest-more in fragrance-defensible premium segments (consumer_r09, consumer_r28), harvest the mid-tier where vertical integration is most aggressive.",
        category_exposure=cat(3,3,2,2, 4,3,3,3,3,4,3,2),
        vc_exposure=vc(1,1,3,2,3,3,5,4),
        regional_exposure=reg(4,5,2,2),
        data_source="Walmart Investor Day 2025; Costco Annual Report 2025; Aldi Group Expansion Announcement; NielsenIQ Premium PL Tier Report 2025", source_type="analyst_report",
        confidence="Medium",
    ),

    # ── GAP 5 ── HDW → ADW Conversion in Emerging Markets
    Trend(
        id="consumer_r27", force="Consumer", sub_category="Category Shift",
        peak_year=2033, diffusion_curve="s_curve",  # Dishwasher penetration India 4%, China 12%, Brazil 9%; long S-curve as middle class scales
        name="Hand-Dish to Auto-Dish Conversion in Emerging Markets",
        description="Dishwasher penetration in India (4%), China (12%), Brazil (9%), Mexico (15%) remains far below developed-market levels (Germany 71%, US 68%). Middle-class expansion in these geographies (300M+ new middle-class households 2026-2036) is the single largest addressable market for ADW in global FMCG. The category-shift pattern is asymmetric for HCB: HDW volume grows in absolute terms (middle class consumes more dishes) but ADW grows multi-x faster. Somat global distribution gives HCB a first-mover advantage but faces Finish (Reckitt) and local players. Separate from consumer_r17 India affordability — this trend captures the specific HDW→ADW category-migration dynamic rather than the price architecture.",
        direction="Expansion", probability=4, start_year=2026,
        # 6%: Captures ADW category expansion specifically in HG
        # markets; distinct from generic HG growth (competitive_r06).
        # Under-modelled in current base.
        gp1_pct_affected=0.06,
        strategic_implication="Medium-confidence expansion addressing a specific LHC category under-coverage (ADW only 4 trends previously). Category exposure is ADW (5), HDW (3 — partial offset from decline, partial growth from volume base expansion). Regional profile HG (5), Asia (5), others minimal. Value chain Formulation (3), Packaging (3), Commercial (4), Marketing (4), Consumer (4). Sources: Euromonitor APAC/India dishwasher penetration, Brazil ABRALIMP data. Strategic implication: Somat ADW is HCB's natural entry vehicle; India/Brazil/Indonesia the priority markets. ADW premiumisation in these geographies starts from zero, so PL risk is lower than in EU/NA.",
        category_exposure=cat(0,0,0,0, 1,0,0,0,3,5,1,0),
        vc_exposure=vc(1,3,2,3,3,4,4,4),
        regional_exposure=reg(1,1,5,5),
        data_source="Euromonitor Dishwashing Global 2025; India Appliance Penetration Data; Brazil ABRALIMP; China Home Appliance Research Institute", source_type="market_report",
        confidence="Medium",
    ),

    # ── GAP 6 ── Laundry Additive Premiumisation (Scent Boosters)
    Trend(
        id="consumer_r28", force="Consumer", sub_category="Premiumization",
        peak_year=2030, diffusion_curve="s_curve",  # Scent boosters EU €2B 2025 → €4.5B 2030; S-curve expansion north from Southern Europe
        name="Laundry Scent Boosters as Structural Premium Category",
        description="Laundry scent boosters (P&G Lenor Unstoppables archetype) have graduated from category novelty to structural premium LAD segment. EU scent-booster market €2B in 2025, forecast €4.5B by 2030 (+18% CAGR). US market already $1.8B. HCB faces a strategic choice: Vernel Aroma Boost (current offering) is under-invested versus Lenor Unstoppables; Silan Powerboosters (Central Europe) has stronger share. This trend carves out scent boosters specifically from the broader fragrance premiumisation trend (consumer_r09) to get better category-level signal on LAD. LAD was under-covered in v3.1 (only 4 trends) — this addresses the gap. GP1 impact is large because scent-booster gross margin is 2-3x standard softener and the category is creating genuinely incremental consumption (not cannibalising softener).",
        direction="Expansion", probability=4, start_year=2025,
        # 8%: Captures LAD-specific premiumisation; combined with
        # consumer_r09 (reduced to 10%) the total premium-fragrance
        # GP1 signal is 18%, consistent with Euromonitor segment
        # growth data.
        gp1_pct_affected=0.08,
        strategic_implication="Medium-high confidence expansion with defensible PL moat (complex fragrance chemistry). Category exposure concentrated: Laundry Additives (5), Fabric Finisher (4), Fabric Cleaning (2). Hair zero. Regional profile Europe (5), NA (5), Asia (3), HG (2). Value chain Raw Materials (4 — fragrance house sourcing), Formulation (5), Packaging (4 — booster-bottle design is a DBA), Marketing (5), Consumer (5). Sources: Euromonitor Home Care, NPD Laundry Segment, IRI POS. Strategic read: this is the single most attractive premium LHC segment by margin × growth × defensibility. Invest-more designation in allocation.",
        category_exposure=cat(0,0,0,0, 2,1,4,5,1,1,1,0),
        vc_exposure=vc(4,5,2,4,1,5,4,5),
        regional_exposure=reg(5,5,3,2),
        data_source="Euromonitor Home Care 2025 — Scent Boosters Segment; NPD Laundry Additives; IRI US POS LAD; Kantar Worldpanel Laundry", source_type="market_report",
        confidence="High",
    ),

    # ── GAP 7 ── Delicates & Performance Fabric Care Revival
    Trend(
        id="consumer_r29", force="Consumer", sub_category="Category Creation",
        peak_year=2031, diffusion_curve="s_curve",  # Athleisure stock drives performance fabric wash needs; S-curve 2026-2031
        name="Delicates & Performance Fabric Care Revival (Perwoll Occasion)",
        description="Technical-fabric ownership (athleisure, merino, performance synthetics) now represents 35%+ of the average European wardrobe vs. 12% a decade ago. These fabrics are not served by standard detergent — they require specialty care (delicates, wool wash, anti-microbial for synthetics). Perwoll is the HCB asset directly positioned for this wave but has been managed as a tail brand. The ageing wardrobe value (linked to environmental_r08 textile longevity) compounds the delicates-wash consumption occasion. Separate consumption trigger from general laundry: performance-wash occasions are 1-3x monthly vs. 4-8x weekly for standard loads, but unit price is 3-5x standard detergent. FCA (Fabric Care Specialty) was materially under-covered in v3.1 (only 5 trends).",
        direction="Expansion", probability=3, start_year=2026,
        # 5%: Small absolute pool but high-margin and defensible;
        # addresses FCA under-coverage. Linked to environmental_r08
        # (textile longevity).
        gp1_pct_affected=0.05,
        strategic_implication="Medium-confidence expansion in a previously under-covered LHC sub-category. Category exposure is tightly focused: Fabric Care Specialty (5), Fabric Finisher (2); other categories zero. Regional profile Europe (5), Asia (3), NA (3), HG (2). Value chain Formulation (4), Packaging (3), Marketing (4), Consumer (5). Sources: Euromonitor Textile Care, WGSN Athleisure Report, Textile Exchange Material Report. Strategic implication: Perwoll has been a tail brand but sits exactly on a structural wave; modest investment in performance-fabric positioning can re-activate the brand. Low competitive intensity — Woolite (Reckitt) is the only scaled direct competitor.",
        category_exposure=cat(0,0,0,0, 0,5,2,1,0,0,0,0),
        vc_exposure=vc(2,4,1,3,1,4,3,5),
        regional_exposure=reg(5,3,3,2),
        data_source="Euromonitor Textile Care 2025; WGSN Athleisure Forecast 2026; Textile Exchange Preferred Fiber Material Market Report", source_type="market_report",
        confidence="Medium",
    ),

    # ── GAP 8 ── Chinese Live-Commerce Model Exports
    Trend(
        id="customer_r10", force="Customer", sub_category="Channel Disruption",
        peak_year=2029, diffusion_curve="front_loaded",  # Douyin/TikTok Live exporting fast to SEA, Europe 2025-2029
        name="Chinese Live-Commerce / Douyin Model Exports",
        description="Live-commerce (livestream shopping with immediate cart integration) captured 10-12% of Chinese FMCG retail by 2024 and is now exporting at speed: TikTok Shop Live in SEA (Indonesia 8% by 2025), Europe (UK live-commerce +140% YoY), and accelerating. The channel economics are structurally different from static e-commerce — creator take-rates 15-25%, discovery-driven not search-driven, and requires always-on content operations. Schwarzkopf APAC has early Douyin presence but HCB globally is under-invested in the operating model. This is a Customer-force trend (channel structure) distinct from technology_r11 (agentic commerce) which is supply-side AI. Addresses Customer force under-weighting (10% of base).",
        direction="Contraction", probability=4, start_year=2025,
        # 7%: Channel margin architecture shift; creator take-rates
        # structurally higher than retail-media fees. Addresses
        # Customer force under-weighting.
        gp1_pct_affected=0.07,
        strategic_implication="Medium-confidence contraction addressing Customer force under-coverage. Category exposure is Hair-heavy (Color 4, Care 4, Styling 4, Body 3) — live-commerce is disproportionately beauty-weighted — with moderate LHC exposure where retailers run live formats (FCN 2, LAD 2). Regional profile Asia (5), HG (4), NA (3), Europe (3). Value chain concentration at Marketing (5), Commercial (5), Consumer (5). Sources: iResearch Douyin FMCG, TikTok Shop data, Accenture Livestream Commerce Report. Strategic implication: the channel requires a fundamentally different content operating model — always-on creator partnerships, real-time SKU management, different promo architecture. HCB peers (P&G, Unilever) are ahead in APAC. Invest-in-capability rather than invest-in-spend is the right framing.",
        category_exposure=cat(4,4,4,3, 2,1,1,2,1,1,1,0),
        vc_exposure=vc(0,0,0,1,2,5,5,5),
        regional_exposure=reg(3,3,5,4),
        data_source="iResearch Douyin FMCG Commerce Report 2025; TikTok Shop Performance Data; Accenture Livestream Commerce 2026; Statista Live-Commerce Europe", source_type="analyst_report",
        confidence="Medium",
    ),

    # ── GAP 9 ── Loyalty Program Cannibalisation of Trade Spend
    Trend(
        id="customer_r11", force="Customer", sub_category="Channel Economics",
        peak_year=2030, diffusion_curve="s_curve",  # Retailer loyalty data monetisation accelerating as retail media matures
        name="Retailer Loyalty Program Cannibalisation of Trade Spend",
        description="Retailer loyalty programs (Tesco Clubcard, Kroger, Carrefour Rewards, dm App) are evolving from marketing vehicles into data-brokerage platforms that capture first-party consumer data and monetise it back to brands at a premium over traditional retail media. Tesco Clubcard Prices requires brand co-funding; Kroger's 84.51° monetises loyalty data at retail-media-adjacent take-rates; dm's app is becoming a paid media channel. Net effect is that the same promotional budget is now being extracted twice (trade spend + loyalty fee). Separate from customer_r08 (US retail media) because this is loyalty-data monetisation, not advertising placement. Addresses Customer force under-coverage.",
        direction="Contraction", probability=4, start_year=2025,
        # 6%: Additional channel margin extraction layer stacking on
        # top of retail media. Compounds customer_r08 and consumer_r01.
        gp1_pct_affected=0.06,
        strategic_implication="Medium-confidence contraction. Distinct from customer_r08 (US retail media — advertising placement) and consumer_r01 (PL penetration — share shift) because it captures the loyalty-data monetisation layer specifically. Category exposure uniform at 3 across the portfolio (all categories sold through loyalty-program retailers). Regional profile Europe (5), NA (4), Asia (3), HG (2). Value chain concentration Marketing (4), Commercial (5), Consumer (3). Sources: Tesco Clubcard Prices commercial terms, Kroger 84.51° investor communications, dm Digital Strategy. Strategic implication: triple-stack margin extraction (PL + retail media + loyalty-data fees) is the consolidated bear case for European LHC and requires a defensive premium-fragrance play (consumer_r28) or channel-diversification (DTC, customer_r10 live commerce) to offset.",
        category_exposure=cat(3,3,3,3, 3,3,3,3,3,3,3,3),
        vc_exposure=vc(0,0,0,0,1,4,5,3),
        regional_exposure=reg(5,4,3,2),
        data_source="Tesco Clubcard Prices Analysis; Kroger 84.51° Commercial Terms; Carrefour Rewards Data Monetisation; dm Digital Ecosystem", source_type="analyst_report",
        confidence="Medium",
    ),

    # ── GAP 10 ── Neurocosmetics & Sensory-Science Hair Care
    Trend(
        id="technology_r17", force="Technology", sub_category="R&D",
        peak_year=2033, diffusion_curve="back_loaded",  # Neurocosmetics is a late-H2 science wave; peer-reviewed claims scaling 2028+
        name="Neurocosmetics and Sensory-Science Hair Care",
        description="Neurocosmetics — the science of topical ingredients acting on nerve endings to produce measurable sensory/wellbeing outcomes — has moved from claim to mechanism with peer-reviewed evidence in 2024-2025 (IFSCC, JCD publications). Peptides that modulate TRP channels, aroma-chemistry that measurably reduces cortisol, scalp microbiome-derived actives targeting barrier function. For Hair Care specifically, neurocosmetics converges with scalp care (consumer_r07) and longevity (consumer_r21) but the science is distinct — it is not wellness-marketing, it is pharmacology-adjacent efficacy. L'Oréal and Estée Lauder have filed multiple patents 2024-2025. Schwarzkopf Professional R&D (3,000+ formulations/year) is capable of leading this wave but requires deliberate portfolio positioning.",
        direction="Expansion", probability=3, start_year=2027,
        # 5%: Small premium segment but high margin and scientifically
        # defensible; material over 10-year horizon.
        gp1_pct_affected=0.05,
        strategic_implication="Low-medium confidence expansion over long time horizon. Category exposure is Hair-focused: Care (5), Color (3), Styling (2), Body (3); LHC zero. Regional profile NA (4), Europe (5), Asia (5), HG (2). Value chain concentration Raw Materials (4), Formulation (5), Marketing (4), Consumer (4). Sources: IFSCC publications, JCD Neurocosmetics Review 2025, L'Oréal/Estée Lauder patent filings. Strategic implication: this is a Schwarzkopf Professional play specifically — consumer mass brands (Schauma, Gliss) cannot make the claims credibly. Build R&D capability with fragrance-house partners (IFF, Givaudan neuroscience divisions).",
        category_exposure=cat(3,5,2,3, 0,0,0,0,0,0,0,0),
        vc_exposure=vc(4,5,2,2,1,4,3,4),
        regional_exposure=reg(5,4,5,2),
        data_source="IFSCC Conference Proceedings 2024-2025; J Cosmetic Dermatology Neurocosmetics Review 2025; L'Oréal Patent Filings 2025; Givaudan Sensory Science", source_type="research_report",
        confidence="Medium",
    ),

    # ── GAP 11 ── Bathroom & Laundry-Room IoT
    Trend(
        id="technology_r18", force="Technology", sub_category="Smart Home",
        peak_year=2032, diffusion_curve="back_loaded",  # IoT bathroom devices small today; back-loaded build as smart-home matures
        name="Bathroom and Laundry-Room IoT — Connected Dispensers, Smart Mirrors",
        description="Distinct from Smartwash (technology_r08, in-machine dosing). This trend captures the broader smart-home extension into bathroom (smart mirrors with skin/hair diagnostics — Lululemon Mirror patents, Withings Body Scan adjacent) and laundry-room (connected shelf/storage, auto-replenishment sensors). Samsung, LG, GE Appliances integrating consumables-sensing into new appliance lines from 2026. Amazon Dash-style auto-replenishment is scaling via Alexa Hunches. For HCB the opportunity is consumables-sensing partnership (appliance makers capture the data, branded manufacturers are the 'preferred refill'). Risk: if HCB is not the default in the auto-replenishment funnel, the switching cost becomes meaningful.",
        direction="Expansion", probability=3, start_year=2027,
        # 4%: Small GP1 near-term but strategically important; must be
        # monitored for appliance-partnership signals.
        gp1_pct_affected=0.04,
        strategic_implication="Low-confidence expansion with optionality. Category exposure distributed across LHC (FCN 3, LAD 3, ADW 3, HDW 2) and Hair (Care 3, Color 2, Body 3). Regional profile NA (5), Europe (4), Asia (4), HG (2). Value chain concentration Packaging (3), Commercial (4), Consumer (5). Sources: Samsung/LG Connected Appliance Roadmap, IDC Smart Home Forecast, Amazon Dash Auto-Replenishment. Strategic implication: appliance-partnership deals need to be pursued now (Samsung, LG, Miele, Bosch) to secure default-supplier positioning. Losing the default slot is irreversible in the 2030+ auto-replenishment ecosystem.",
        category_exposure=cat(2,3,1,3, 3,2,2,3,2,3,3,1),
        vc_exposure=vc(0,1,2,3,2,3,4,5),
        regional_exposure=reg(4,5,4,2),
        data_source="Samsung/LG Connected Appliance Roadmap 2026; IDC Smart Home Forecast 2026-2030; Amazon Dash Auto-Replenishment Data; Miele Smart@Home", source_type="analyst_report",
        confidence="Low",
    ),

    # ── GAP 12 ── Longevity Economy — LHC Split
    Trend(
        id="consumer_r30", force="Consumer", sub_category="Category Creation",
        peak_year=2034, diffusion_curve="linear",  # Longevity spending growing linearly with aging population; long horizon
        name="Longevity Economy — LHC / Home Hygiene Split",
        description="consumer_r21 (Longevity Economy) correctly captures the Hair/Beauty side of the longevity wave but the LHC-specific dimension has been missed. 60+ consumers represent 40% of LHC spend in Europe and spend 1.8x the adult average on home hygiene — driven by immune-system concerns, pet hygiene (elderly pet ownership +38% vs adult average), and assisted-living integration. Categories most exposed: Hand Dish Wash (senior-targeted ergonomic packaging), Hard Surface Cleaner (disinfection claims), Laundry (hypoallergenic positioning). This trend splits the longevity lens so the Shift Matrix produces differentiated signal for Hair longevity (consumer_r21) and LHC longevity (this trend).",
        direction="Expansion", probability=3, start_year=2027,
        # 4%: Small discrete uplift but unique LHC angle not
        # captured elsewhere. Complements consumer_r05 (silver economy)
        # and consumer_r21 (longevity).
        gp1_pct_affected=0.04,
        strategic_implication="Medium-confidence expansion addressing an LHC-specific demographic opportunity. Category exposure: HSC (5), HDW (4), FCN (3 — hypoallergenic segment), LAD (3), FFI (3); Hair zero. Regional profile Europe (5), NA (5), Asia (4), HG (2). Value chain concentration Formulation (3), Packaging (4 — ergonomics), Marketing (4), Consumer (5). Sources: Euromonitor Silver Economy, OECD Ageing Societies, AgeCommerce data. Strategic implication: Bref ergonomic-grip line, Pril senior-ergonomic dish, Persil hypoallergenic variants are all natural 60+ positioning plays. The segment is large, growing, and under-addressed by peers.",
        category_exposure=cat(0,0,0,1, 3,2,3,3,4,2,5,2),
        vc_exposure=vc(1,3,1,4,2,4,3,5),
        regional_exposure=reg(5,5,4,2),
        data_source="Euromonitor Silver Economy Report 2025; OECD Ageing Societies Data; AgeCommerce Senior Consumer Panel; AARP Consumer Spending", source_type="market_report",
        confidence="Medium",
    ),

    # ── GAP 13 ── Cleaning-Fluency Generational Decline
    Trend(
        id="consumer_r31", force="Consumer", sub_category="Behavioral",
        peak_year=2032, diffusion_curve="linear",  # Generational shift, slow linear trajectory
        name="Cleaning-Fluency Generational Decline (Gen Z Home-Care Literacy)",
        description="Gen Z enters adult household formation (2026-2030) with materially lower 'cleaning fluency' than prior generations — only 34% know when to use specialty cleaners, versus 68% of Gen X (NielsenIQ 2025). Implications for LHC category architecture: (a) SKU proliferation (separate cleaners for surfaces, fabrics, dishes) becomes a liability — the cohort reaches for 'one cleaner' multi-purpose options; (b) the specialty/premium LHC pool contracts as fluency-gated categories (Perwoll, WC-Frisch, Somat specifics) lose knowledge-based purchase intent; (c) opportunity in simplification-positioned SKUs (Bref one-for-all, Pril ultra-concentrate all-in-one). Byron Sharp read: category-entry-points tied to specific cleaning scenarios are losing mental availability as the scenarios themselves are no longer recognised by the cohort.",
        direction="Contraction", probability=3, start_year=2026,
        # 5%: Slow-building cohort effect but structural; affects
        # specialty LHC portfolio disproportionately.
        gp1_pct_affected=0.05,
        strategic_implication="Medium-confidence contraction with slow onset. Category exposure is LHC-specialty: Fabric Care (4), Hard Surface Cleaner (4), Auto Dish (3), HDW (3), Laundry Additives (3). Hair near-zero. Regional profile NA (5), Europe (4), Asia (3), HG (2). Value chain Marketing (5), Packaging (3 — clarity of use), Consumer (5). Sources: NielsenIQ Gen Z Home Care Fluency Study 2025, Mintel Young Adult Housing, Euromonitor Multi-Purpose Cleaners. Strategic implication: portfolio simplification play — reduce SKU count on specialty LHC, invest in multi-purpose flagships (Bref one-for-all). Also argues against pursuing deeper specialty fragmentation.",
        category_exposure=cat(0,1,0,1, 2,4,1,3,3,3,4,1),
        vc_exposure=vc(1,2,1,3,2,5,4,5),
        regional_exposure=reg(4,5,3,2),
        data_source="NielsenIQ Gen Z Home Care Fluency Study 2025; Mintel Young Adult Housing Formation; Euromonitor Multi-Purpose Cleaners Segment", source_type="market_report",
        confidence="Medium",
    ),

    # ── GAP 14 ── Beauty-as-Medicine / Tele-Derm DTC
    Trend(
        id="consumer_r32", force="Consumer", sub_category="Channel Creation",
        peak_year=2030, diffusion_curve="front_loaded",  # Tele-derm DTC scaling fast; Hims/Hers Hair $500M+ run-rate
        name="Beauty-as-Medicine / Tele-Derm DTC (Hair & Scalp)",
        description="Direct-to-consumer tele-dermatology services (Hims Hair, Hers, Ro, Nurx) have built $2B+ run-rates in hair/scalp treatment prescriptions (finasteride, minoxidil, spironolactone). The channel bypasses retail entirely and captures the 'hair loss' CEP (category entry point) that consumer_r10 partially addresses. Critically, these services are building adjacent OTC product ecosystems — Hims Shampoo, Hers Hair Masks — bundling prescription care with branded consumer products in a way Schwarzkopf / Pantene / Head & Shoulders cannot. The risk for HCB Hair Care (specifically thickening/scalp franchises) is that the highest-value prescriber-adjacent consumer is lost entirely to DTC before they ever reach a retail shelf. Separate from consumer_r10 (hair-loss market size) and technology_r17 (neurocosmetics science) — this captures the channel-structure threat.",
        direction="Contraction", probability=4, start_year=2025,
        # 7%: High GP1 affected because captures highest-value Hair
        # Care consumer before retail; channel structurally new.
        gp1_pct_affected=0.07,
        strategic_implication="Medium-high confidence contraction with asymmetric margin risk. Category exposure Hair-focused: Care (5), Color (2), Body (2); Styling (1). LHC zero. Regional profile NA (5 — tele-derm legalised broadly), Europe (3 — regulated more tightly), Asia (2), HG (1). Value chain concentration Marketing (4), Commercial (5 — channel), Consumer (5), Formulation (2). Sources: Hims & Hers Q4 2025 earnings, Ro/Roman data, JAMA Dermatology Telehealth Review. Strategic implication: HCB cannot replicate the tele-derm regulatory infrastructure but can (a) partner with tele-derm services for OTC bundling; (b) strengthen Schwarzkopf Professional DTC adjacency via stylist-telehealth referral; (c) defend the thickening/scalp CEP aggressively at retail before the tele-derm funnel captures it permanently.",
        category_exposure=cat(2,5,1,2, 0,0,0,0,0,0,0,0),
        vc_exposure=vc(0,2,0,1,0,4,5,5),
        regional_exposure=reg(3,5,2,1),
        data_source="Hims & Hers Q4 2025 Earnings; Ro/Roman Commercial Data; JAMA Dermatology Telehealth Review 2025; Forrester Tele-Derm Market Size", source_type="analyst_report",
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

    # ═══ REGIONAL EXPANSION (v2.4) — APAC + NA ═══
    "consumer_r16": [  # China C-Beauty Nationalism
        {"title": "Euromonitor: Beauty and Personal Care in China 2025", "url": "https://www.euromonitor.com/beauty-and-personal-care-in-china/report", "source_type": "market_report", "tier": "A"},
        {"title": "McKinsey China Consumer Report 2025", "url": "https://www.mckinsey.com/cn/our-insights/our-insights/2025-mckinsey-china-consumer-report", "source_type": "research_report", "tier": "A"},
        {"title": "Daxue Consulting: C-Beauty vs Western Beauty in China", "url": "https://daxueconsulting.com/c-beauty-china/", "source_type": "market_report", "tier": "B+"},
        {"title": "Jing Daily: Proya Surpasses L'Oréal in China Skincare", "url": "https://jingdaily.com/", "source_type": "trade_press", "tier": "B"},
    ],
    "consumer_r17": [  # India Premium Affordability
        {"title": "Redseer: India Beauty & Personal Care Market Report 2025", "url": "https://redseer.com/reports/", "source_type": "research_report", "tier": "A-"},
        {"title": "Euromonitor: Beauty and Personal Care in India 2025", "url": "https://www.euromonitor.com/beauty-and-personal-care-in-india/report", "source_type": "market_report", "tier": "A"},
        {"title": "Nykaa FY2025 Annual Report", "url": "https://www.nykaa.com/investor-relations", "source_type": "annual_report", "tier": "B-"},
        {"title": "BCG India: The $200B Consumer Opportunity", "url": "https://www.bcg.com/industries/consumer-products", "source_type": "research_report", "tier": "A"},
    ],
    "customer_r08": [  # US Retail Media Networks
        {"title": "eMarketer/Insider Intelligence: US Retail Media Ad Spend Forecast 2025-2027", "url": "https://www.emarketer.com/content/us-retail-media-advertising-forecast-2025", "source_type": "market_report", "tier": "A"},
        {"title": "Amazon Q4 2025 Earnings — Advertising Services Disclosure", "url": "https://ir.aboutamazon.com/", "source_type": "earnings_report", "tier": "B-"},
        {"title": "Walmart Connect: 2025 Advertiser Day Presentation", "url": "https://www.walmartconnect.com/", "source_type": "company_page", "tier": "B-"},
        {"title": "Boston Consulting Group: Retail Media Next Frontier", "url": "https://www.bcg.com/publications/2024/retail-media-the-next-frontier", "source_type": "research_report", "tier": "A"},
    ],
    "government_r09": [  # US Tariffs and Reshoring
        {"title": "USTR: Section 301 China Tariff Actions 2026", "url": "https://ustr.gov/issue-areas/enforcement/section-301-investigations", "source_type": "regulation", "tier": "S"},
        {"title": "US International Trade Commission: Cosmetics and Detergent Imports Tariff Schedule", "url": "https://hts.usitc.gov/", "source_type": "government_data", "tier": "S"},
        {"title": "BCG: CPG Tariff Impact Analysis 2026", "url": "https://www.bcg.com/industries/consumer-products", "source_type": "research_report", "tier": "A"},
        {"title": "P&G Q2 FY2026 Earnings Call — Tariff Exposure Discussion", "url": "https://us.pg.com/investor-relations/", "source_type": "earnings_report", "tier": "B-"},
    ],
    "competitive_r08": [  # K-Beauty / J-Beauty Export Wave
        {"title": "Circana: US Prestige Beauty Hair Care 2025", "url": "https://www.circana.com/", "source_type": "market_report", "tier": "A"},
        {"title": "Mintel: K-Beauty Global Report 2025", "url": "https://store.mintel.com/", "source_type": "market_report", "tier": "A"},
        {"title": "Amorepacific Q4 2025 Earnings — Rusk Acquisition Disclosure", "url": "https://www.apgroup.com/int/en/ir/ir.html", "source_type": "earnings_report", "tier": "B-"},
        {"title": "Beauty Independent: K-Beauty Hair Enters US Mass Premium", "url": "https://www.beautyindependent.com/", "source_type": "trade_press", "tier": "B"},
    ],
    "consumer_r18": [  # US Hispanic/Latino Consumers
        {"title": "US Census Bureau: American Community Survey 2025", "url": "https://www.census.gov/programs-surveys/acs/", "source_type": "government_data", "tier": "S"},
        {"title": "NielsenIQ: US Multicultural Consumer Report 2025", "url": "https://nielseniq.com/global/en/insights/analysis/2025/", "source_type": "market_report", "tier": "A"},
        {"title": "Circana: US Hair Care — Ethnic Segment Analysis 2025", "url": "https://www.circana.com/", "source_type": "market_report", "tier": "A"},
        {"title": "Collage Group: Hispanic/Latino Consumer CultureRate", "url": "https://www.collagegroup.com/", "source_type": "research_report", "tier": "B+"},
    ],

    # ═══ v3.0 EXPANSION — AGENTIC COMMERCE ═══
    "technology_r11": [  # Agentic Commerce — AI Shopping Agents
        {"title": "Gartner: Predicts 2026 — AI Agents Will Conduct 25% of Online Purchases by 2028", "url": "https://www.gartner.com/en/articles/what-s-new-in-artificial-intelligence-from-the-2025-gartner-hype-cycle", "source_type": "research_report", "tier": "A"},
        {"title": "McKinsey: The Rise of Agentic AI in Consumer Commerce", "url": "https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights", "source_type": "research_report", "tier": "A"},
        {"title": "a]16z: AI Agents and the Future of Commerce", "url": "https://a16z.com/ai-agents-commerce/", "source_type": "research_report", "tier": "A-"},
        {"title": "Amazon: Rufus AI Shopping Assistant — Usage Metrics Q1 2026", "url": "https://ir.aboutamazon.com/", "source_type": "earnings_report", "tier": "B-"},
    ],
    "technology_r12": [  # Algorithmic Shelf — AI-Curated Discovery
        {"title": "Profitero: Digital Shelf Intelligence — AI Curation Impact 2026", "url": "https://www.profitero.com/", "source_type": "data_tool", "tier": "B+"},
        {"title": "BCG: How AI Is Reshaping the Digital Shelf", "url": "https://www.bcg.com/publications/2025/ai-reshaping-digital-shelf", "source_type": "research_report", "tier": "A"},
        {"title": "NielsenIQ: AI-Driven Product Discovery and Brand Visibility", "url": "https://nielseniq.com/global/en/insights/", "source_type": "market_report", "tier": "A"},
        {"title": "Google DeepMind: Shopping Graph — Technical Blog", "url": "https://deepmind.google/discover/blog/", "source_type": "company_page", "tier": "B"},
    ],
    "technology_r13": [  # Hyper-Personalized Formulation — AI + Diagnostics
        {"title": "Euromonitor: Personalization in Beauty 2026", "url": "https://www.euromonitor.com/beauty-personalization", "source_type": "market_report", "tier": "A"},
        {"title": "L'Oreal: Technology and Innovation — AI Skin Diagnostics", "url": "https://www.loreal.com/en/beauty-science-and-technology/", "source_type": "company_page", "tier": "B"},
        {"title": "CB Insights: Personalized Beauty Tech Funding Map 2025", "url": "https://www.cbinsights.com/research/beauty-tech/", "source_type": "research_report", "tier": "A"},
        {"title": "Nature Reviews Drug Discovery: AI-Driven Cosmetic Formulation", "url": "https://www.nature.com/nrd/", "source_type": "academic", "tier": "S"},
    ],

    # ═══ v3.0 EXPANSION — GEOGRAPHIC ═══
    "competitive_r09": [  # Africa Rising — 500M New Consumers
        {"title": "World Bank: Africa's Pulse — Economic Analysis 2026", "url": "https://www.worldbank.org/en/region/afr/publication/africas-pulse", "source_type": "government_data", "tier": "S"},
        {"title": "McKinsey Global Institute: Lions on the Move III — Africa 2030", "url": "https://www.mckinsey.com/featured-insights/middle-east-and-africa", "source_type": "research_report", "tier": "A"},
        {"title": "Euromonitor: Beauty and Personal Care in Sub-Saharan Africa 2025", "url": "https://www.euromonitor.com/", "source_type": "market_report", "tier": "A"},
        {"title": "UN DESA: World Population Prospects 2024 — Africa Demographic Dividend", "url": "https://population.un.org/wpp/", "source_type": "government_data", "tier": "S"},
    ],
    "consumer_r19": [  # Southeast Asia Middle-Class Surge
        {"title": "World Bank: East Asia & Pacific Economic Update 2026", "url": "https://www.worldbank.org/en/region/eap/publication/east-asia-pacific-economic-update", "source_type": "government_data", "tier": "S"},
        {"title": "Bain & Company: Southeast Asia's Digital Consumers", "url": "https://www.bain.com/insights/e-conomy-sea-2025/", "source_type": "research_report", "tier": "A"},
        {"title": "Euromonitor: Beauty and Personal Care in Southeast Asia 2025", "url": "https://www.euromonitor.com/", "source_type": "market_report", "tier": "A"},
        {"title": "ASEAN Secretariat: ASEAN Economic Community Blueprint 2025", "url": "https://asean.org/our-communities/economic-community/", "source_type": "government_data", "tier": "S"},
    ],
    "consumer_r20": [  # LatAm Premiumization — Brazil & Mexico
        {"title": "Euromonitor: Beauty and Personal Care in Brazil 2025", "url": "https://www.euromonitor.com/beauty-and-personal-care-in-brazil/report", "source_type": "market_report", "tier": "A"},
        {"title": "McKinsey: Latin America Consumer Sentiment and Premiumization", "url": "https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights", "source_type": "research_report", "tier": "A"},
        {"title": "Natura &Co: FY2025 Annual Report — Market Dynamics", "url": "https://ri.naturaeco.com/en/", "source_type": "annual_report", "tier": "B-"},
        {"title": "ABIHPEC: Brazilian Personal Hygiene and Cosmetics Association — Market Data 2025", "url": "https://abihpec.org.br/en/", "source_type": "research_report", "tier": "B+"},
    ],

    # ═══ v3.0 EXPANSION — LONGEVITY ECONOMY ═══
    "consumer_r21": [  # Longevity Economy — Anti-Aging Beyond Skincare
        {"title": "Bank of America: The Silver Dollar — Longevity Economy Report", "url": "https://www.bofaml.com/en-us/content/longevity.html", "source_type": "research_report", "tier": "A"},
        {"title": "Nature Aging: Consumer Behavior in Longevity Markets", "url": "https://www.nature.com/nataging/", "source_type": "academic", "tier": "S"},
        {"title": "JP Morgan: Investing in the Longevity Revolution", "url": "https://am.jpmorgan.com/", "source_type": "research_report", "tier": "A"},
        {"title": "AARP: Longevity Economy Outlook 2025", "url": "https://www.aarp.org/research/topics/economics/info-2019/longevity-economy-outlook.html", "source_type": "research_report", "tier": "A-"},
    ],
    "technology_r14": [  # Peptide & Bioactive Revolution in Hair/Skin
        {"title": "Grand View Research: Peptide Therapeutics Market Size 2025-2030", "url": "https://www.grandviewresearch.com/industry-analysis/peptide-therapeutics-market", "source_type": "market_report", "tier": "B+"},
        {"title": "Journal of Cosmetic Dermatology: Biomimetic Peptides in Hair Restoration", "url": "https://onlinelibrary.wiley.com/journal/14732165", "source_type": "academic", "tier": "S"},
        {"title": "L'Oreal R&I: Peptide Innovation Pipeline — CES 2026 Presentation", "url": "https://www.loreal.com/en/beauty-science-and-technology/", "source_type": "company_page", "tier": "B"},
        {"title": "Mintel: Active Ingredients in Beauty 2026", "url": "https://store.mintel.com/", "source_type": "market_report", "tier": "A"},
    ],

    # ═══ v3.0 EXPANSION — INGREDIENTS & BIO-MANUFACTURING ═══
    "technology_r15": [  # Precision Fermentation — Bio-Identical Ingredients
        {"title": "McKinsey: The Bio Revolution — Innovations Transforming Economies", "url": "https://www.mckinsey.com/industries/life-sciences/our-insights/the-bio-revolution", "source_type": "research_report", "tier": "A"},
        {"title": "Good Food Institute: Precision Fermentation State of the Industry 2025", "url": "https://gfi.org/resource/precision-fermentation-state-of-the-industry-report/", "source_type": "research_report", "tier": "A-"},
        {"title": "Nature Biotechnology: Precision Fermentation for Cosmetic Ingredients", "url": "https://www.nature.com/nbt/", "source_type": "academic", "tier": "S"},
        {"title": "Euromonitor: Biotechnology in Consumer Goods — Market Assessment", "url": "https://www.euromonitor.com/", "source_type": "market_report", "tier": "A"},
    ],
    "technology_r16": [  # Synthetic Biology — Designer Surfactants
        {"title": "SynBioBeta: Industrial Biotech and Synthetic Biology Market 2026", "url": "https://synbiobeta.com/", "source_type": "research_report", "tier": "B+"},
        {"title": "OECD: Synthetic Biology — The Bioeconomy to 2030", "url": "https://www.oecd.org/sti/bioeconomy/", "source_type": "government_data", "tier": "S"},
        {"title": "Evonik: Biosurfactant Product Line — Sustainability Data", "url": "https://corporate.evonik.com/en/products-and-solutions", "source_type": "company_page", "tier": "B"},
        {"title": "ACS Sustainable Chemistry & Engineering: Bio-Based Surfactants Review", "url": "https://pubs.acs.org/journal/ascecg", "source_type": "academic", "tier": "S"},
    ],

    # ═══ v3.0 EXPANSION — REGULATORY ═══
    "government_r10": [  # EU AI Act — Algorithmic Transparency
        {"title": "European Commission: AI Act — Official Text and Implementation Timeline", "url": "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai", "source_type": "regulation", "tier": "S"},
        {"title": "Deloitte: AI Act Compliance Guide for Consumer Goods Companies", "url": "https://www2.deloitte.com/eu/en/pages/technology/articles/eu-ai-act.html", "source_type": "research_report", "tier": "A"},
        {"title": "IAPP: EU AI Act — Practical Implementation for CPG", "url": "https://iapp.org/resources/topics/eu-ai-act/", "source_type": "research_report", "tier": "A-"},
    ],
    "government_r11": [  # EU Biodiversity & Deforestation Due Diligence
        {"title": "European Commission: EUDR — Deforestation-Free Products Regulation", "url": "https://environment.ec.europa.eu/topics/forests/deforestation/regulation-deforestation-free-products_en", "source_type": "regulation", "tier": "S"},
        {"title": "RSPO: Palm Oil Supply Chain Traceability Standards 2026", "url": "https://rspo.org/", "source_type": "research_report", "tier": "A-"},
        {"title": "CDP: Forests — Corporate Disclosure Progress Report 2025", "url": "https://www.cdp.net/en/forests", "source_type": "research_report", "tier": "A"},
        {"title": "Proforest: EUDR Implementation Guide for Consumer Goods", "url": "https://www.proforest.net/", "source_type": "research_report", "tier": "B+"},
    ],
    "government_r12": [  # EU Textile & Laundry Regulation Tightening
        {"title": "European Commission: EU Strategy for Sustainable and Circular Textiles", "url": "https://environment.ec.europa.eu/strategy/textiles-strategy_en", "source_type": "regulation", "tier": "S"},
        {"title": "ECHA: Microplastics Restriction Proposal — Laundry Products Scope", "url": "https://echa.europa.eu/hot-topics/microplastics", "source_type": "regulation", "tier": "S"},
        {"title": "A.I.S.E.: Industry Response to EU Detergent Regulation Review", "url": "https://www.aise.eu/", "source_type": "research_report", "tier": "B+"},
    ],

    # ═══ v3.0 EXPANSION — COMPETITIVE ═══
    "competitive_r10": [  # Amazon Private Label Expansion in Home Care
        {"title": "Marketplace Pulse: Amazon Private Label Brand Tracker 2026", "url": "https://www.marketplacepulse.com/amazon-private-label", "source_type": "data_tool", "tier": "B+"},
        {"title": "Morgan Stanley: Amazon — Private Label Strategy Deep Dive", "url": "https://www.morganstanley.com/ideas/amazon-private-label", "source_type": "research_report", "tier": "A"},
        {"title": "Consumer Brands Association: Private Label Market Share Report 2025", "url": "https://consumerbrandsassociation.org/", "source_type": "research_report", "tier": "A-"},
        {"title": "Euromonitor: Home Care E-Commerce and Private Label Dynamics", "url": "https://www.euromonitor.com/home-care", "source_type": "market_report", "tier": "A"},
    ],
    "competitive_r11": [  # L'Oreal-NVIDIA Beauty AI Alliance
        {"title": "L'Oreal: CES 2026 — NVIDIA Partnership Announcement", "url": "https://www.loreal.com/en/beauty-science-and-technology/", "source_type": "company_page", "tier": "B"},
        {"title": "NVIDIA: Omniverse for Consumer Products — Beauty Industry Applications", "url": "https://www.nvidia.com/en-us/omniverse/", "source_type": "company_page", "tier": "B"},
        {"title": "BeautyMatter: L'Oreal x NVIDIA — What It Means for Competitive AI in Beauty", "url": "https://beautymatter.com/", "source_type": "trade_press", "tier": "B"},
        {"title": "Bernstein Research: L'Oreal — AI-First Beauty Company Analysis", "url": "https://www.bernsteinresearch.com/", "source_type": "research_report", "tier": "A"},
    ],
    "competitive_r12": [  # DTC M&A Consolidation Wave
        {"title": "PitchBook: Beauty & Personal Care M&A Report 2025", "url": "https://pitchbook.com/", "source_type": "research_report", "tier": "A"},
        {"title": "CB Insights: Beauty Brand Acquisition Tracker", "url": "https://www.cbinsights.com/research/beauty-tech/", "source_type": "research_report", "tier": "A"},
        {"title": "Henkel: M&A and Portfolio Strategy — Investor Day 2025", "url": "https://www.henkel.com/investors-and-analysts/", "source_type": "strategy_document", "tier": "B-"},
        {"title": "Goldman Sachs: Consumer Beauty — M&A Outlook 2026-2030", "url": "https://www.goldmansachs.com/intelligence/pages/consumer-beauty-mna-outlook.html", "source_type": "research_report", "tier": "A"},
    ],

    # ═══ v3.0 EXPANSION — CONSUMER ═══
    "consumer_r22": [  # Laundry Sheets / Solid Formats Disruption
        {"title": "Euromonitor: Laundry Care Format Innovation — Sheets, Strips, Tablets", "url": "https://www.euromonitor.com/laundry-care", "source_type": "market_report", "tier": "A"},
        {"title": "NielsenIQ: US Laundry Detergent — Format Migration Tracker", "url": "https://nielseniq.com/global/en/insights/", "source_type": "market_report", "tier": "A"},
        {"title": "Earth Breeze: DTC Laundry Sheet Category Performance Data", "url": "https://www.earthbreeze.com/", "source_type": "company_page", "tier": "C"},
        {"title": "Mintel: Laundry Detergent Innovation and Sustainability 2025", "url": "https://store.mintel.com/", "source_type": "market_report", "tier": "A"},
    ],
    "consumer_r23": [  # Wellness-Beauty Convergence
        {"title": "McKinsey: Future of Wellness — Consumer Health and Beauty Convergence", "url": "https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights/future-of-wellness", "source_type": "research_report", "tier": "A"},
        {"title": "Grand View Research: Nutricosmetics Market Size 2025-2030", "url": "https://www.grandviewresearch.com/industry-analysis/nutricosmetics-market", "source_type": "market_report", "tier": "B+"},
        {"title": "Circana: US Beauty — Wellness-Adjacent Category Growth 2025", "url": "https://www.circana.com/", "source_type": "market_report", "tier": "A"},
        {"title": "Harvard T.H. Chan School of Public Health: Ingestible Beauty — Evidence Review", "url": "https://www.hsph.harvard.edu/", "source_type": "academic", "tier": "S"},
    ],
    "consumer_r24": [  # Textured & Curly Hair — Inclusive Formulation
        {"title": "Mintel: Black Hair Care and Styling US 2025", "url": "https://store.mintel.com/", "source_type": "market_report", "tier": "A"},
        {"title": "NielsenIQ: US Multicultural Hair Care — Textured Segment Growth", "url": "https://nielseniq.com/global/en/insights/", "source_type": "market_report", "tier": "A"},
        {"title": "Circana: US Hair Care — Curl and Coil Segment Performance 2025", "url": "https://www.circana.com/", "source_type": "market_report", "tier": "A"},
        {"title": "British Journal of Dermatology: Hair Fiber Diversity and Formulation Science", "url": "https://academic.oup.com/bjd", "source_type": "academic", "tier": "S"},
    ],

    # ═══ v3.0 EXPANSION — CUSTOMER ═══
    "customer_r09": [  # Agentic Retail Media — AI-Optimized Shelf
        {"title": "eMarketer: Retail Media 3.0 — Agentic and Algorithmic Ad Buying", "url": "https://www.emarketer.com/content/retail-media-forecast-2026", "source_type": "market_report", "tier": "A"},
        {"title": "BCG: Retail Media — From Ads to AI-Optimized Commerce", "url": "https://www.bcg.com/publications/2025/retail-media-ai-optimized-commerce", "source_type": "research_report", "tier": "A"},
        {"title": "Criteo: Commerce Media Platform — AI Automation Capabilities", "url": "https://www.criteo.com/", "source_type": "company_page", "tier": "B"},
        {"title": "GroupM: This Year Next Year — Global Retail Media Forecast 2026", "url": "https://www.groupm.com/this-year-next-year-global-mid-year-forecast/", "source_type": "market_report", "tier": "A"},
    ],

    # ═══ v3.0 EXPANSION — ENVIRONMENTAL ═══
    "environmental_r09": [  # Climate-Driven Formulation Instability
        {"title": "IPCC: AR6 Synthesis Report — Climate Change Impacts on Supply Chains", "url": "https://www.ipcc.ch/report/sixth-assessment-report-cycle/", "source_type": "government_data", "tier": "S"},
        {"title": "BASF: Chemical Supply Chain Climate Risk Assessment 2025", "url": "https://www.basf.com/global/en/who-we-are/sustainability.html", "source_type": "company_page", "tier": "B"},
        {"title": "Nature Climate Change: Temperature Impacts on Chemical Processes and Supply", "url": "https://www.nature.com/nclimate/", "source_type": "academic", "tier": "S"},
        {"title": "Swiss Re: Global Climate Risk Outlook 2026", "url": "https://www.swissre.com/institute/research/sigma-research.html", "source_type": "research_report", "tier": "A"},
    ],
    "environmental_r10": [  # Freshwater Scarcity — Reformulation Imperative
        {"title": "UN Water: World Water Development Report 2026", "url": "https://www.unwater.org/publications/un-world-water-development-report-2026", "source_type": "government_data", "tier": "S"},
        {"title": "WRI Aqueduct: Water Risk Atlas — Manufacturing Regions", "url": "https://www.wri.org/aqueduct", "source_type": "data_tool", "tier": "A"},
        {"title": "CDP: Water Security — Corporate Disclosure Report 2025", "url": "https://www.cdp.net/en/water", "source_type": "research_report", "tier": "A"},
        {"title": "McKinsey: Water Scarcity Implications for Consumer Goods Manufacturing", "url": "https://www.mckinsey.com/capabilities/sustainability/our-insights", "source_type": "research_report", "tier": "A"},
    ],
    "environmental_r11": [  # Scope 3+ and Full Lifecycle Accountability
        {"title": "Science Based Targets initiative: Corporate Net-Zero Standard v2.0", "url": "https://sciencebasedtargets.org/net-zero", "source_type": "research_report", "tier": "A"},
        {"title": "GHG Protocol: Scope 3 Calculation Guidance — Consumer Products", "url": "https://ghgprotocol.org/scope-3-technical-calculation-guidance", "source_type": "research_report", "tier": "A"},
        {"title": "CDP: Supply Chain Report 2025 — Scope 3 Disclosure Progress", "url": "https://www.cdp.net/en/supply-chain", "source_type": "research_report", "tier": "A"},
        {"title": "ISSB/IFRS S2: Climate-Related Disclosure Standard — Use-Phase Emissions", "url": "https://www.ifrs.org/issued-standards/ifrs-sustainability-standards-navigator/ifrs-s2-climate-related-disclosures/", "source_type": "regulation", "tier": "S"},
    ],

    # ═══ v3.3 APRIL 2026 STRATEGIC REVIEW — 14 NEW TRENDS ═══
    # GAP 1 — Demographics / household atomisation
    "consumer_r25": [  # Birth Rate Collapse and Household Atomisation
        {"title": "Eurostat: Demography of Europe — 2025 edition", "url": "https://ec.europa.eu/eurostat/web/population-demography", "source_type": "government_data", "tier": "S"},
        {"title": "UN DESA: World Population Prospects 2024 Revision", "url": "https://population.un.org/wpp/", "source_type": "government_data", "tier": "S"},
        {"title": "OECD Family Database 2025 — Fertility and Household Composition", "url": "https://www.oecd.org/en/data/datasets/oecd-family-database.html", "source_type": "government_data", "tier": "S"},
        {"title": "Statistisches Bundesamt: Haushalte und Familien 2025", "url": "https://www.destatis.de/DE/Themen/Gesellschaft-Umwelt/Bevoelkerung/Haushalte-Familien/_inhalt.html", "source_type": "government_data", "tier": "S"},
    ],

    # GAP 2 — Gen Alpha cohort entry
    "consumer_r26": [  # Gen Alpha (2010+) Enters Personal-Care Category
        {"title": "Mintel: Gen Alpha Consumer Report 2025", "url": "https://www.mintel.com/consumer-insights/", "source_type": "market_report", "tier": "A"},
        {"title": "NielsenIQ: Youth Demographics Panel — Personal Care Entry Trends", "url": "https://nielseniq.com/global/en/insights/", "source_type": "market_report", "tier": "A"},
        {"title": "WGSN: Gen Alpha Consumer Forecast 2026", "url": "https://www.wgsn.com/en/", "source_type": "market_report", "tier": "A"},
        {"title": "Piper Sandler: Taking Stock With Teens — Spring 2025", "url": "https://www.pipersandler.com/teens", "source_type": "analyst_report", "tier": "A"},
    ],

    # GAP 3 — MoCRA + US State Cosmetics Regulation
    "government_r13": [  # MoCRA + US State Cosmetics Regulation
        {"title": "FDA: MoCRA (Modernization of Cosmetics Regulation Act) Implementation", "url": "https://www.fda.gov/cosmetics/cosmetics-laws-regulations/modernization-cosmetics-regulation-act-2022", "source_type": "regulation", "tier": "S"},
        {"title": "California OEHHA: Proposition 65 Chemicals List — PFAS Expansion", "url": "https://oehha.ca.gov/proposition-65/proposition-65-list", "source_type": "regulation", "tier": "S"},
        {"title": "New York State Department of State: PFAS in Cosmetics Ban (effective 2027)", "url": "https://dos.ny.gov/consumer-protection", "source_type": "regulation", "tier": "S"},
        {"title": "Washington State Toxic-Free Cosmetics Act (HB 1047)", "url": "https://ecology.wa.gov/Regulations-Permits/Laws-rules-rulemaking/Laws", "source_type": "regulation", "tier": "S"},
    ],

    # GAP 4 — Walmart / Costco / Aldi vertical integration
    "competitive_r13": [  # Retailer Vertical Integration into FMCG Supply
        {"title": "Walmart: Investor Day 2025 — Private Brand Manufacturing Strategy", "url": "https://stock.walmart.com/financials/quarterly-results/", "source_type": "company_page", "tier": "B+"},
        {"title": "Costco Wholesale: Annual Report 2025 — Kirkland Signature Direct Sourcing", "url": "https://investor.costco.com/financial-information/annual-reports", "source_type": "company_page", "tier": "B+"},
        {"title": "Aldi Group: Lacura Premium PL Expansion Announcement 2025", "url": "https://www.aldi.us/about-aldi/press-releases/", "source_type": "company_page", "tier": "B"},
        {"title": "NielsenIQ: Premium Private Label Tier Report 2025", "url": "https://nielseniq.com/global/en/insights/", "source_type": "market_report", "tier": "A"},
    ],

    # GAP 5 — HDW→ADW conversion in Emerging Markets
    "consumer_r27": [  # Hand-Dish to Auto-Dish Conversion in Emerging Markets
        {"title": "Euromonitor International: Dishwashing Global Report 2025", "url": "https://www.euromonitor.com/dishwashing/report", "source_type": "market_report", "tier": "A"},
        {"title": "India Appliance and Consumer Electronics: Dishwasher Penetration Data 2025", "url": "https://www.ciceindia.com/", "source_type": "market_report", "tier": "A-"},
        {"title": "ABRALIMP (Brazilian Cleaning Products Association): Automatic Dish Wash Market 2025", "url": "https://www.abralimp.org.br/", "source_type": "government_data", "tier": "A-"},
        {"title": "China Home Appliance Research Institute: Dishwasher Penetration 2025", "url": "http://en.cheari.com/", "source_type": "market_report", "tier": "A-"},
    ],

    # GAP 6 — Laundry Scent Boosters structural premium
    "consumer_r28": [  # Laundry Scent Boosters as Structural Premium Category
        {"title": "Euromonitor: Home Care — Scent Boosters Segment 2025", "url": "https://www.euromonitor.com/home-care", "source_type": "market_report", "tier": "A"},
        {"title": "NPD Group / Circana: Laundry Additives Segment 2025", "url": "https://www.circana.com/", "source_type": "market_report", "tier": "A"},
        {"title": "IRI / Circana: US POS Laundry Additives Data 2025", "url": "https://www.circana.com/intelligence/", "source_type": "market_report", "tier": "A"},
        {"title": "Kantar Worldpanel: Laundry Category Report 2025", "url": "https://www.kantar.com/expertise/worldpanel", "source_type": "market_report", "tier": "A"},
    ],

    # GAP 7 — Delicates & Performance Fabric Care revival
    "consumer_r29": [  # Delicates & Performance Fabric Care Revival (Perwoll)
        {"title": "Euromonitor International: Textile Care 2025 — Specialty Detergents", "url": "https://www.euromonitor.com/home-care", "source_type": "market_report", "tier": "A"},
        {"title": "WGSN: Athleisure and Performance Fabric Forecast 2026", "url": "https://www.wgsn.com/en/", "source_type": "market_report", "tier": "A"},
        {"title": "Textile Exchange: Preferred Fiber & Materials Market Report 2025", "url": "https://textileexchange.org/knowledge-center/reports/preferred-fiber-and-materials/", "source_type": "research_report", "tier": "A"},
        {"title": "Statista: Performance-Wear Wardrobe Share Europe 2025", "url": "https://www.statista.com/", "source_type": "market_report", "tier": "B+"},
    ],

    # GAP 8 — Chinese Live-Commerce model exports
    "customer_r10": [  # Chinese Live-Commerce / Douyin Model Exports
        {"title": "iResearch: China FMCG Live-Commerce Report 2025", "url": "https://www.iresearchchina.com/", "source_type": "analyst_report", "tier": "A-"},
        {"title": "TikTok Shop: Live Commerce Performance Data 2025", "url": "https://shop.tiktok.com/", "source_type": "company_page", "tier": "B"},
        {"title": "Accenture: Livestream Commerce Global Report 2026", "url": "https://www.accenture.com/us-en/insights/retail/live-commerce", "source_type": "analyst_report", "tier": "A"},
        {"title": "Statista: Live-Commerce Europe Market Size 2025", "url": "https://www.statista.com/", "source_type": "market_report", "tier": "B+"},
    ],

    # GAP 9 — Retailer Loyalty Program cannibalisation
    "customer_r11": [  # Retailer Loyalty Program Cannibalisation of Trade Spend
        {"title": "Tesco PLC: Clubcard Prices — Commercial Terms and Investor Communications", "url": "https://www.tescoplc.com/investors/", "source_type": "company_page", "tier": "B+"},
        {"title": "Kroger / 84.51°: Loyalty Data and Retail Media Capabilities", "url": "https://www.8451.com/", "source_type": "company_page", "tier": "B+"},
        {"title": "Carrefour Group: Loyalty Data Monetisation Strategy 2025", "url": "https://www.carrefour.com/en/group/investors", "source_type": "company_page", "tier": "B+"},
        {"title": "Forrester: Retailer Loyalty-to-Retail-Media Convergence 2025", "url": "https://www.forrester.com/", "source_type": "analyst_report", "tier": "A"},
    ],

    # GAP 10 — Neurocosmetics and Sensory-Science
    "technology_r17": [  # Neurocosmetics and Sensory-Science Hair Care
        {"title": "IFSCC (International Federation of Societies of Cosmetic Chemists): Conference Proceedings 2024-2025", "url": "https://ifscc.org/publications/", "source_type": "academic", "tier": "S"},
        {"title": "Journal of Cosmetic Dermatology: Neurocosmetics Mechanism Review 2025", "url": "https://onlinelibrary.wiley.com/journal/14732165", "source_type": "academic", "tier": "S"},
        {"title": "L'Oréal Research & Innovation: Patent Filings on Neuroactive Cosmetics 2024-2025", "url": "https://www.loreal.com/en/commitments-and-responsibilities/for-innovation/", "source_type": "company_page", "tier": "B+"},
        {"title": "Givaudan: Sensory Science and Neuroscience Division Capabilities", "url": "https://www.givaudan.com/fragrance-beauty/active-beauty", "source_type": "company_page", "tier": "B"},
    ],

    # GAP 11 — Bathroom & Laundry-Room IoT
    "technology_r18": [  # Bathroom and Laundry-Room IoT
        {"title": "Samsung / LG Connected Appliance Roadmap 2026", "url": "https://www.samsung.com/global/business/networks/insights/", "source_type": "company_page", "tier": "B+"},
        {"title": "IDC: Smart Home Market Forecast 2026-2030", "url": "https://www.idc.com/promo/smarthome", "source_type": "market_report", "tier": "A"},
        {"title": "Amazon: Dash Auto-Replenishment and Alexa Hunches Data 2025", "url": "https://www.amazon.com/dash", "source_type": "company_page", "tier": "B"},
        {"title": "Miele: Smart@Home Connected Laundry Ecosystem", "url": "https://www.miele.com/en/com/smart-home.htm", "source_type": "company_page", "tier": "B"},
    ],

    # GAP 12 — Longevity Economy (LHC split)
    "consumer_r30": [  # Longevity Economy — LHC / Home Hygiene Split
        {"title": "Euromonitor International: Silver Economy Report 2025", "url": "https://www.euromonitor.com/silver-economy", "source_type": "market_report", "tier": "A"},
        {"title": "OECD: Ageing and Employment Policies — Society at a Glance 2025", "url": "https://www.oecd.org/els/ageing-and-employment-policies.htm", "source_type": "government_data", "tier": "S"},
        {"title": "AARP: Consumer Spending Behavior of Americans 50+ 2025", "url": "https://www.aarp.org/research/topics/economics/", "source_type": "research_report", "tier": "A"},
        {"title": "AgeCommerce: Senior Consumer Panel — Home Hygiene 2025", "url": "https://www.agewave.com/", "source_type": "market_report", "tier": "B+"},
    ],

    # GAP 13 — Cleaning-Fluency Generational Decline
    "consumer_r31": [  # Cleaning-Fluency Generational Decline
        {"title": "NielsenIQ: Gen Z Home Care Fluency Study 2025", "url": "https://nielseniq.com/global/en/insights/", "source_type": "market_report", "tier": "A"},
        {"title": "Mintel: Young Adult Household Formation and Home-Care Behaviours 2025", "url": "https://www.mintel.com/consumer-insights/", "source_type": "market_report", "tier": "A"},
        {"title": "Euromonitor International: Multi-Purpose Cleaners Segment 2025", "url": "https://www.euromonitor.com/home-care", "source_type": "market_report", "tier": "A"},
        {"title": "Kantar Worldpanel: Home Care Category Architecture 2025", "url": "https://www.kantar.com/expertise/worldpanel", "source_type": "market_report", "tier": "A"},
    ],

    # GAP 14 — Beauty-as-Medicine / Tele-Derm DTC
    "consumer_r32": [  # Beauty-as-Medicine / Tele-Derm DTC (Hair & Scalp)
        {"title": "Hims & Hers Health Inc.: Q4 2025 Earnings Report", "url": "https://investors.hims.com/financials/quarterly-results/", "source_type": "company_page", "tier": "A-"},
        {"title": "Ro / Roman Health: Commercial Data and DTC Tele-Derm Reporting 2025", "url": "https://ro.co/", "source_type": "company_page", "tier": "B"},
        {"title": "JAMA Dermatology: Telehealth and Direct-to-Consumer Hair Loss Review 2025", "url": "https://jamanetwork.com/journals/jamadermatology", "source_type": "academic", "tier": "S"},
        {"title": "Forrester: Tele-Dermatology Market Size and Segmentation 2025", "url": "https://www.forrester.com/", "source_type": "analyst_report", "tier": "A"},
    ],
}


# ── Source credibility gate (E1) ────────────────────────────────────
# Tier ladder: S > A > A- > B+ > B > B- > C > D > E
# E = social media / unverified — explicitly a "weak signal only" tier.
# A trend whose evidence base is *exclusively* tier-E (or has no sources
# at all) is not strong enough to drive a probability/gp1 score. The
# scoring layer must refuse it until at least one B-or-better source
# corroborates the signal.
WEAK_TIERS = {"E", "D"}
ACCEPTABLE_TIERS = {"S", "A", "A-", "B+", "B", "B-", "C"}


class TierEGateError(ValueError):
    """Raised when a trend's source credibility is too weak to score."""


def assert_trend_credible(trend_id: str, sources: list) -> None:
    """Hard gate: refuse to score a trend with no usable sources.

    Rules:
      - At least one source must be present.
      - At least one source must be in ACCEPTABLE_TIERS (B- or better,
        plus C for low-but-not-weak signals).
      - Trends with only D/E sources are rejected — they need
        corroboration before they earn a probability score.

    Raises:
        TierEGateError if the gate fails. Callers should not catch this
        silently — a failing gate is a data-quality bug, not a runtime
        condition to recover from.
    """
    if not sources:
        raise TierEGateError(
            f"Trend '{trend_id}' has no sources attached. Cannot score "
            f"a trend with zero evidence base."
        )

    tiers = [str(s.get("tier", "")).strip() for s in sources if isinstance(s, dict)]
    strong = [t for t in tiers if t in ACCEPTABLE_TIERS]

    if not strong:
        raise TierEGateError(
            f"Trend '{trend_id}' has only weak-signal sources "
            f"(tiers={tiers}). At least one source rated B- or better "
            f"is required before this trend can be scored. Tier E "
            f"(social media / unverified) is permitted only as a "
            f"corroborating signal alongside a B-tier-or-higher source."
        )


def get_report_trends():
    """Return the list of 82 active trends with source URLs attached.

    Applies the E1 source-credibility gate to every trend before
    returning. A trend with no sources, or only D/E-tier sources,
    raises TierEGateError — refusing to seed the database with a
    trend whose evidence is too weak to support scoring.
    """
    trends = list(TRENDS)
    for t in trends:
        t.sources = SOURCE_URLS.get(t.id, [])
        assert_trend_credible(t.id, t.sources)
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
