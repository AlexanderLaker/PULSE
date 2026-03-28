# PULSE Emerging Trends — API Research Pipeline Guide

## How the Trend Research System Works

PULSE scans 19 free APIs in parallel to discover emerging trends relevant to Henkel Consumer Brands (HCB). Every trend visible in the "Emerging Trends" section comes exclusively from live API data — there is no mock or static fallback data.

---

## 1. The Scan Pipeline

When a user clicks **"Scan All Sources"** in the Emerging Trends section, the following happens:

### Step 1: Frontend triggers background scan
The React dashboard sends a POST to `/api/v1/scanner/run-background`, which queues an asynchronous scan. The frontend then polls `/api/v1/scanner/status` every second for progress updates.

### Step 2: Scanner queries all 19 APIs in parallel
The backend (`pulse/api/routes/scanner.py`) fires `asyncio.gather()` across all integration clients simultaneously. Each source receives up to 3 queries from the FORCE_QUERIES dictionary (see below), with a limit of 50 results per source.

### Step 3: Results are normalized and deduplicated
Raw API responses (articles, papers, patents, regulatory documents, economic data) are collected per-source, then deduplicated by title. The final result set caps at 200 trends.

### Step 4: Frontend maps results to trend cards
The `mapApiResultsToTrends()` function normalizes heterogeneous API responses into a uniform `EmergingTrend` structure with: name, description, force classification, direction, suggested impact/probability scores, relevance score, category mapping, and source citations.

### Step 5: Force classification via `inferForce()`
Each trend is classified into one of the 6 strategic forces using keyword matching on the title and description:

| Force | Trigger Keywords |
|-------|-----------------|
| Government | regulat, EU, directive, ban, restrict, compli |
| Consumer | consumer, demand, preference, trend, wellness, beauty |
| Customer | retail, channel, store, e-commerce, amazon, shelf |
| Technology | innovat, biotech, AI, patent, enzyme, formul |
| Environmental | climate, carbon, water, sustainab, palm, deforest |
| Competitive | P&G, Unilever, Reckitt, compet, market share, M&A |

---

## 2. The 19 API Sources

### Group A: News & Trend Intelligence (Volume Backbone)

| # | Source | What It Provides | API Key Required | Rate Limit |
|---|--------|-----------------|------------------|------------|
| A1 | **GDELT Project** | Global news events, sentiment, volume baseline across 100+ languages | No | Unlimited |
| A2 | **GNews** | Curated quality news feed with structured metadata | Yes (`GNEWS_API_KEY`) | 100 req/day |
| A3 | **CurrentsAPI** | News with native sentiment scoring | Yes (`CURRENTSAPI_KEY`) | 200 req/day |
| A4 | **RSS Feeds** | 12 curated FMCG industry feeds (CosmeticsDesign, RetailDive, GroceryDive, PackagingDive, HAPPI, GCI, ChemicalWatch, etc.) | No | Unlimited |
| A5 | **NewsAPI** | Broad news aggregation with category filtering | Yes (`NEWSAPI_API_KEY`) | 100 req/day |
| A6 | **BeautyFeeds** | Specialized beauty industry news aggregation | Yes (`BEAUTYFEEDS_API_KEY`) | TBD |

### Group B: Regulatory & Government Intelligence

| # | Source | What It Provides | API Key Required | Rate Limit |
|---|--------|-----------------|------------------|------------|
| B1 | **ECHA CHEM** | EU REACH database, SVHC candidate list, cosmetics/detergent ingredient restrictions | No | Reasonable use |
| B2 | **EUR-Lex** | All EU legislation (Regulations, Directives, Decisions) via REST/SPARQL | No | Unlimited |
| B3 | **EPO Patents** | European patent filings in IPC classes A61K (cosmetics), A61Q (hair care), C11D (detergents), B65D (packaging) | No | Reasonable use |

### Group C: Consumer & Social Intelligence

| # | Source | What It Provides | API Key Required | Rate Limit |
|---|--------|-----------------|------------------|------------|
| C1 | **Google Trends** | Consumer search behavior as honest intent signal (via pytrends) | No | Rate-limited |
| C2 | **Reddit** | Unfiltered product discussions, sentiment, emerging concerns | Yes (`REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`) | 60 req/min |
| C3 | **YouTube** | Beauty/care trend validation via video metadata and view counts | Yes (`YOUTUBE_API_KEY`) | 10,000 units/day |

### Group D: Economic & Commodity Data

| # | Source | What It Provides | API Key Required | Rate Limit |
|---|--------|-----------------|------------------|------------|
| D1 | **FRED** | Palm oil futures, crude oil, PPI detergent, commodity prices | Optional (`FRED_API_KEY`) | 120 req/min |
| D2 | **World Bank** | GDP per capita, urbanization rates, water stress indicators | No | Unlimited |
| D3 | **Open-Meteo** | Climate data for insecticide/seasonal demand correlation | No | Unlimited |

### Group E: Academic & Scientific Research

| # | Source | What It Provides | API Key Required | Rate Limit |
|---|--------|-----------------|------------------|------------|
| E1 | **OpenAlex** | 200M+ scholarly works, citation velocity, research fronts | Optional (`OPENALEX_API_KEY`) | Polite pool |
| E2 | **NCBI PubMed** | Biomedical/cosmeceutical research papers (E-utilities) | Yes (`NCBI_API_KEY`) | 10 req/sec with key |
| E3 | **arXiv** | Pre-prints in materials science, AI/ML, chemistry | No | Rate-limited |

### Group F: Competitive Intelligence

| # | Source | What It Provides | API Key Required | Rate Limit |
|---|--------|-----------------|------------------|------------|
| F1 | **SEC EDGAR** | Public filings for P&G, Church & Dwight, Colgate-Palmolive, Clorox | No | 10 req/sec |

**Total running cost: €0/year.** All APIs are free tier or fully open.

---

## 3. Search Queries by Strategic Force

The scanner uses pre-defined FMCG-focused queries organized by the 6 strategic forces. For each scan, 3 queries per force per source are executed:

### Consumer Force
- `natural beauty trends`
- `sustainable personal care`
- `premiumization wellness`
- `clean beauty movement`
- `direct-to-consumer beauty`

### Government Force
- `EU cosmetics regulation`
- `detergent labeling restrictions`
- `microplastics ban`
- `chemical ingredient restrictions`
- `SVHC authorization`

### Technology Force
- `green chemistry innovation`
- `biotechnology cosmetics`
- `waterless formulations`
- `AI personalization beauty`
- `sustainable surfactants`

### Environmental Force
- `climate impact carbon footprint`
- `water scarcity`
- `biodiversity conservation`
- `circular economy packaging`
- `PFAS contamination`

### Competitive Force
- `P&G strategy acquisition`
- `Unilever sustainability`
- `Reckitt performance`
- `market consolidation`
- `competitive innovation`

### Customer Force
- `e-commerce growth beauty`
- `retailer margins pressure`
- `DTC direct-to-consumer`
- `supply chain disruption`
- `channel shift online`

---

## 4. How Trends Link to HCB Business

### Category Mapping Logic

Every discovered trend is mapped to Henkel's 12 product categories with an exposure score (0-5):

**Hair Consumer Business:**
| Category ID | Category Name | Key Signals |
|-------------|--------------|-------------|
| `hair_color` | Hair Color | dye, pigment, ammonia-free, grey coverage, semi-permanent |
| `hair_care` | Hair Care | shampoo, conditioner, bond-building, scalp, keratin, peptide |
| `hair_styling` | Hair Styling | gel, wax, spray, mousse, heat protection |
| `hair_body` | Body Care | body wash, shower gel, soap, body lotion |

**Laundry & Home Care:**
| Category ID | Category Name | Key Signals |
|-------------|--------------|-------------|
| `lhc_fcn` | Fabric Cleaning (FCN) | laundry detergent, Persil, washing, stain removal |
| `lhc_fca` | Fabric Care (FCA) | softener, fabric conditioner, wrinkle release |
| `lhc_ffi` | Fabric Freshness & Ironing (FFI) | freshener, ironing aid, scent booster |
| `lhc_lad` | Laundry Additives (LAD) | bleach, stain remover, color catcher |
| `lhc_hdw` | Hand Dishwashing (HDW) | dish soap, hand dishwash |
| `lhc_adw` | Auto Dishwashing (ADW) | dishwasher tablets, rinse aid, Somat |
| `lhc_hsc` | Hard Surface Cleaners (HSC) | all-purpose cleaner, bathroom, kitchen |
| `lhc_ic` | Insecticides & Composts (IC) | insect repellent, pest control |

### Strategic Relevance Assessment

Each trend is scored for relevance (0-100%) based on:

1. **Direct category impact** — Does it affect a Henkel product category?
2. **Value chain exposure** — Does it affect raw materials, formulation, packaging, or distribution?
3. **Competitive implication** — Does it change the competitive landscape in categories where Henkel competes?
4. **Time horizon** — Is it near-term (2026-2027) or structural (2028-2030)?
5. **Profit pool direction** — Does it expand or contract the addressable profit pool?

---

## 5. Adjacent & White Space Categories

Beyond Henkel's current 12 categories, the scan pipeline monitors adjacent markets that represent potential expansion opportunities or competitive threats:

### High-Adjacency White Spots (Henkel has capabilities to enter)

| Adjacent Category | Why It Matters | HCB Capability Link | Market Size |
|-------------------|---------------|---------------------|-------------|
| **Professional Salon Products** | Premium margin, brand halo for consumer lines | Schwarzkopf Professional already exists; consumer-professional bridge | $16B globally |
| **Scalp Care / Trichology** | Fastest-growing hair sub-segment, medical-consumer hybrid | Natural extension of Hair Care; peptide/biotech innovation pipeline | $4B, growing 8% CAGR |
| **Men's Grooming** | Underserved by Henkel relative to P&G (Old Spice) and Unilever (Dove Men) | Hair/body infrastructure; brand equity in Taft/Schauma | $78B globally |
| **Skin Care** | Largest beauty category; Henkel under-indexed | Consumer brand awareness (Dial, Fa); limited but could be adjacency play | $180B globally |

### Medium-Adjacency Monitoring Targets

| Adjacent Category | Why It Matters | Monitoring Signal |
|-------------------|---------------|------------------|
| **Industrial & Institutional Cleaning** | Henkel Adhesive Technologies already in B2B; LHC extension possible | SEC filings for Ecolab, Diversey; EUR-Lex for workplace hygiene regs |
| **Water Treatment (Consumer)** | Water scarcity drives home purification; links to sustainability narrative | World Bank water stress data; FRED commodity data; Open-Meteo drought index |
| **Personal Hygiene (Wipes, Sanitizers)** | Post-COVID structural shift; packaging innovation aligns with LHC | GDELT sentiment analysis; patent filings in B65D class |

### Low-Adjacency / Threat Monitoring

| Adjacent Category | Why Monitor |
|-------------------|------------|
| **Cosmeceuticals (Rx ↔ OTC blur)** | GLP-1 drugs creating new beauty sub-segments; biotech cosmetics overlap |
| **Smart Home (Connected Appliances)** | Washing machines with auto-dosing reduce detergent consumption |
| **Refill & Zero-Waste Retail** | Structural threat to single-use packaging; emerging format shift |
| **Synthetic Biology** | Lab-grown ingredients could displace natural/palm-based supply chains |
| **Personalized Nutrition → Beauty** | Nutricosmetics, ingestible beauty — adjacent consumer overlap |

---

## 6. Architecture Summary

```
User clicks "Scan All Sources"
           │
           ▼
POST /api/v1/scanner/run-background
           │
           ▼
┌─────────────────────────────────────┐
│  scanner.py: _run_full_scan()       │
│                                     │
│  For each source × query pair:      │
│    asyncio.gather(                  │
│      _scan_source("gdelt", q, 50), │
│      _scan_source("gnews", q, 50), │
│      _scan_source("echa", q, 50),  │
│      ... (19 sources × 3 queries)  │
│    )                                │
│                                     │
│  Aggregate → Deduplicate → Cap 200  │
└─────────────────────┬───────────────┘
                      │
                      ▼
Frontend polls /api/v1/scanner/status
           │
           ▼ (scan complete)
GET /api/v1/scanner/results
           │
           ▼
┌─────────────────────────────────────┐
│  EmergingTrends.tsx:                │
│    mapApiResultsToTrends()          │
│    inferForce()                     │
│    → Render up to 60 trend cards    │
│    → Multi-select → Bulk add to     │
│      Trend Explorer                 │
└─────────────────────────────────────┘
```

---

## 7. Enhancing Research Quality

### Current limitations and improvement paths:

1. **Force classification is keyword-based** — could be upgraded to LLM-based classification using the AI layer (Claude/Azure OpenAI) for much higher accuracy.

2. **Relevance scoring is default 65** — when the API doesn't provide a relevance score, a default is assigned. Future enhancement: LLM-based relevance assessment against Henkel's category portfolio.

3. **Category mapping is sparse from raw APIs** — most raw API results don't include category mappings. Enhancement: automated category exposure scoring via LLM or heuristic keyword matching against category-specific vocabularies.

4. **Search queries are static** — the FORCE_QUERIES dictionary is hardcoded. Enhancement: dynamic query generation based on current trend landscape and identified gaps.

5. **No deduplication across scan sessions** — repeated scans may surface the same trends. Enhancement: fingerprint-based dedup using title similarity or semantic embeddings.

### Recommended scan cadence:
- **Weekly**: Full 19-API scan during Q2 (strategic planning input) and Q4 (budget integration)
- **Monthly**: Full scan during Q1 (calibration) and Q3 (mid-year review)
- **Ad-hoc**: Before strategy workshops, ExCo presentations, or in response to market events

---

## 8. Environment Variables Required

```bash
# Required for full API coverage:
GNEWS_API_KEY=your_key_here          # https://gnews.io (free tier: 100 req/day)
CURRENTSAPI_KEY=your_key_here        # https://currentsapi.services (free: 200 req/day)
NEWSAPI_API_KEY=your_key_here        # https://newsapi.org (free: 100 req/day)
NCBI_API_KEY=75a7ab95426bd984590af6d681f4a8497008  # NCBI E-utilities
FRED_API_KEY=your_key_here           # https://fred.stlouisfed.org (optional, increases rate limit)
YOUTUBE_API_KEY=your_key_here        # Google Cloud Console (10,000 units/day free)
REDDIT_CLIENT_ID=your_id_here        # https://www.reddit.com/prefs/apps
REDDIT_CLIENT_SECRET=your_secret     # Reddit OAuth2

# No key needed:
# GDELT, RSS Feeds, ECHA, EUR-Lex, EPO Patents, Google Trends,
# World Bank, Open-Meteo, OpenAlex, arXiv, SEC EDGAR
```

---

*Document Version: 1.0 — March 2026*
*Part of PULSE — Profit Pool Unified Landscape Simulation Engine*
