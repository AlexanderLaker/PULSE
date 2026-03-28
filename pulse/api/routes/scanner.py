"""
Scanner route — triggers full API scan across all integrations.

Admin-only endpoint that queries all available APIs and returns consolidated trend data.
Handles heterogeneous integration clients with different method signatures.
"""

import asyncio
import logging
import traceback
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/scanner", tags=["scanner"])


# ─── Track scan state across requests ─────────────────────────────────────
_scan_state = {
    "running": False,
    "last_run": None,
    "last_results": None,
    "progress": {},
    "errors": [],
}


# ─── Pydantic models ──────────────────────────────────────────────────────
class ScanRequest(BaseModel):
    """Request model for triggering a scan."""
    sources: Optional[List[str]] = None  # None = all sources
    force_filter: Optional[str] = None   # Filter by force (Consumer, Government, etc.)
    limit_per_source: int = Field(50, ge=10, le=200)


class ScanStatus(BaseModel):
    """Current scan status."""
    running: bool
    last_run: Optional[str]
    progress: Dict[str, str]
    errors: List[str]
    result_count: int


class ScanResult(BaseModel):
    """Results from a completed scan."""
    trends: List[Dict[str, Any]]
    raw: Dict[str, List[Dict[str, Any]]]
    meta: Dict[str, Any]


# ─── BROAD search queries by force ─────────────────────────────────────────
# DESIGN: Phase 1 casts a WIDE NET with general industry terms.
# The AI filter (Opus, Phase 3) handles relevance scoring for Henkel.
# Overly specific queries miss emerging trends — let them surface organically.
# KEY METRIC: anything that could impact consumer goods profitability.
FORCE_QUERIES = {
    "Consumer": [
        "consumer goods trends",
        "beauty personal care market",
        "household products consumer behavior",
        "FMCG industry outlook",
        "consumer spending habits",
        "premiumization OR trading down consumer products",
        "private label market share growth",
        "emerging consumer trends",
        "hair care market",
        "laundry home care market",
    ],
    "Government": [
        "consumer products regulation",
        "EU regulation cosmetics chemicals",
        "packaging regulation Europe",
        "ingredient ban restriction consumer goods",
        "sustainability regulation FMCG",
        "chemical regulation consumer safety",
        "environmental compliance consumer products",
        "labeling regulation household products",
    ],
    "Technology": [
        "consumer goods innovation",
        "packaging innovation sustainability",
        "beauty technology trends",
        "formulation innovation consumer products",
        "manufacturing technology FMCG",
        "digital transformation consumer goods",
        "biotechnology consumer products",
        "e-commerce technology retail",
    ],
    "Environmental": [
        "sustainability consumer goods",
        "supply chain disruption FMCG",
        "raw material cost consumer products",
        "climate impact consumer goods industry",
        "circular economy packaging",
        "carbon footprint consumer products",
        "water scarcity impact industry",
    ],
    "Competitive": [
        "consumer goods company strategy",
        "FMCG acquisition merger divestiture",
        "beauty company earnings results",
        "household products market share",
        "consumer goods industry consolidation",
        "private label retailer brand competitive",
        "FMCG company performance",
        "consumer goods CEO strategy",
    ],
    "Customer": [
        "retail industry trends",
        "e-commerce consumer goods growth",
        "retail media network advertising",
        "grocery retail market dynamics",
        "discount retail market share Europe",
        "social commerce consumer products",
        "retail channel shift consumer goods",
        "retailer margin pressure FMCG",
    ],
}


# ─── Scan coordinator ──────────────────────────────────────────────────────
async def _scan_source(
    source_name: str,
    query: str,
    limit: int,
) -> tuple[str, List[Dict[str, Any]], Optional[str]]:
    """
    Attempt to scan a single source with timeout (25 seconds max per source).

    Returns: (source_name, results, error_message)
    All failures return empty results + error message, never raise.
    """
    try:
        # Wrap entire source scan with timeout to prevent Vercel 300s overrun
        async def _source_logic():
            return await _scan_source_inner(source_name, query, limit)

        result = await asyncio.wait_for(_source_logic(), timeout=25.0)
        return result
    except asyncio.TimeoutError:
        error_msg = f"Timeout: exceeded 25s limit"
        logger.warning(f"Source {source_name} scan timed out: {error_msg}")
        return source_name, [], error_msg
    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)[:150]}"
        logger.warning(f"Source {source_name} scan failed: {error_msg}")
        return source_name, [], error_msg


async def _scan_source_inner(
    source_name: str,
    query: str,
    limit: int,
) -> tuple[str, List[Dict[str, Any]], Optional[str]]:
    """
    Inner scan logic (now separated for timeout wrapping).
    """
    import asyncio as _aio

    def _run_sync(fn):
        """Helper: run a synchronous function in thread executor."""
        loop = _aio.get_event_loop()
        return loop.run_in_executor(None, fn)

    try:
        # ── Async sources (use aiohttp — can be awaited directly) ──────
        if source_name == "gdelt":
            from pulse.integrations.gdelt import GDELTClient
            client = GDELTClient()
            results = await client.fetch_articles(query, limit=limit)
            return source_name, results, None

        elif source_name == "gnews":
            from pulse.integrations.gnews import GNewsClient
            client = GNewsClient()
            results = await client.search(query, limit=limit)
            return source_name, results, None

        elif source_name == "currentsapi":
            from pulse.integrations.currentsapi import CurrentsAPIClient
            client = CurrentsAPIClient()
            results = await client.search(query, limit=limit)
            return source_name, results, None

        elif source_name == "rss_feeds":
            from pulse.integrations.rss_feeds import RSSFeedClient
            client = RSSFeedClient()
            results = await client.fetch_all(query, limit=limit)
            return source_name, results, None

        elif source_name == "fred":
            from pulse.integrations.fred_api import FREDClient
            client = FREDClient()
            results = await client.fetch_series(query, limit=limit)
            return source_name, results, None

        elif source_name == "google_trends":
            from pulse.integrations.google_trends import GoogleTrendsClient
            client = GoogleTrendsClient()
            keywords = query.split() if isinstance(query, str) else [query]
            results = await client.fetch_interest(keywords[:5])
            return source_name, [results] if results else [], None

        elif source_name == "world_bank":
            from pulse.integrations.world_bank import WorldBankClient
            client = WorldBankClient()
            results = await client.fetch_indicator("NY.GDP.PCAP.CD", limit=limit)
            return source_name, results, None

        elif source_name == "sec_edgar":
            from pulse.integrations.sec_edgar import SECEdgarClient
            client = SECEdgarClient()
            results = await client.search_filings(query, limit=limit)
            return source_name, results, None

        elif source_name == "open_meteo":
            from pulse.integrations.open_meteo import OpenMeteoClient
            client = OpenMeteoClient()
            results = await client.fetch_weather(50.8503, 4.3517, days_back=30)
            return source_name, [results] if results else [], None

        elif source_name == "reddit":
            from pulse.integrations.reddit_api import RedditClient
            client = RedditClient()
            results = await client.search_subreddits(query, limit=limit)
            return source_name, results, None

        elif source_name == "youtube":
            from pulse.integrations.youtube_api import YouTubeClient
            client = YouTubeClient()
            results = await client.search_videos(query, limit=limit)
            return source_name, results, None

        # ── Sync sources (use requests — must run in executor) ─────────

        elif source_name == "openalex":
            from pulse.integrations.openalex import OpenAlexClient
            client = OpenAlexClient()
            results = await _run_sync(lambda: client.search_works(query, limit=limit))
            return source_name, results, None

        elif source_name == "semantic_scholar":
            from pulse.integrations.semantic_scholar import SemanticScholarClient
            client = SemanticScholarClient()
            # S2 search() already wraps sync calls in run_in_executor
            results = await client.search(query, limit=min(limit, 10))
            return source_name, results, None

        elif source_name == "echa":
            from pulse.integrations.echa import ECHAClient
            client = ECHAClient()
            # ECHA uses scan_for_trends() — sync, returns PULSE-formatted trends
            results = await _run_sync(lambda: client.scan_for_trends())
            return source_name, results, None

        elif source_name == "eurlex":
            from pulse.integrations.eurlex import EurLexClient
            client = EurLexClient()
            # EUR-Lex uses scan_for_trends() — sync, returns PULSE-formatted trends
            results = await _run_sync(lambda: client.scan_for_trends())
            return source_name, results, None

        elif source_name == "epo_patents":
            from pulse.integrations.epo_patents import EPOPatentClient
            client = EPOPatentClient()
            # EPO uses scan_for_trends() — sync, returns PULSE-formatted trends
            results = await _run_sync(lambda: client.scan_for_trends())
            return source_name, results, None

        elif source_name == "beautyfeeds":
            from pulse.integrations.beautyfeeds import BeautyFeedsClient
            client = BeautyFeedsClient()
            # BeautyFeeds uses scan_for_trends() — sync, returns PULSE-formatted trends
            results = await _run_sync(lambda: client.scan_for_trends())
            return source_name, results, None

        elif source_name == "newsapi":
            from pulse.integrations.newsapi import NewsAPIClient
            client = NewsAPIClient()
            # NewsAPI uses scan_for_trends() — sync, returns PULSE-formatted trends
            results = await _run_sync(lambda: client.scan_for_trends())
            return source_name, results, None

        elif source_name == "ncbi_pubmed":
            from pulse.integrations.ncbi_pubmed import NCBIPubMedClient
            client = NCBIPubMedClient()
            # PubMed uses scan_for_trends() — sync, returns PULSE-formatted trends
            results = await _run_sync(lambda: client.scan_for_trends())
            return source_name, results, None

        elif source_name == "arxiv":
            from pulse.integrations.arxiv_api import ArxivClient
            client = ArxivClient()
            # arXiv uses scan_for_trends() — sync, returns PULSE-formatted trends
            results = await _run_sync(lambda: client.scan_for_trends())
            return source_name, results, None

        else:
            return source_name, [], f"Unknown source: {source_name}"

    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)[:150]}"
        logger.warning(f"Source {source_name} scan failed: {error_msg}")
        return source_name, [], error_msg


async def _run_full_scan(
    sources: Optional[List[str]] = None,
    force_filter: Optional[str] = None,
    limit_per_source: int = 50,
) -> Dict[str, Any]:
    """
    Execute a full scan across all integrations.

    Args:
        sources: List of source names to scan. If None, scans all.
        force_filter: If specified, only use queries for this force.
        limit_per_source: Max results per source.

    Returns:
        Dictionary with consolidated results.
    """
    _scan_state["running"] = True
    _scan_state["progress"] = {}
    _scan_state["errors"] = []

    all_sources = [
        "gdelt", "gnews", "currentsapi", "rss_feeds",
        "fred", "google_trends", "world_bank", "open_meteo",
        "sec_edgar", "reddit", "youtube",
        "echa", "eurlex", "epo_patents",
        "openalex", "semantic_scholar",
        "newsapi", "ncbi_pubmed", "arxiv",
        "beautyfeeds",
    ]

    sources_to_scan = sources or all_sources

    # ALWAYS include academic sources (OpenAlex + Semantic Scholar) even if
    # the user specified a subset — they provide the highest-quality trend signals
    for required_source in ("openalex", "semantic_scholar"):
        if required_source not in sources_to_scan:
            sources_to_scan.append(required_source)
    results = {
        "trends": [],
        "raw": {},
        "meta": {
            "started": datetime.now().isoformat(),
            "sources_queried": sources_to_scan,
            "force_filter": force_filter,
        },
    }

    # Determine queries
    if force_filter and force_filter in FORCE_QUERIES:
        queries = FORCE_QUERIES[force_filter]
    else:
        # Flatten all force queries into one list
        queries = [q for qs in FORCE_QUERIES.values() for q in qs]

    logger.info(f"Starting scan: {len(sources_to_scan)} sources, {len(queries)} queries")

    # Create scan tasks: distribute queries across sources intelligently
    # Each source gets queries from ALL forces for comprehensive coverage
    tasks = []

    # Limit queries per source based on source type to manage API rate limits
    QUERIES_PER_SOURCE = {
        "gdelt": 6, "gnews": 4, "currentsapi": 4, "rss_feeds": 3,
        "reddit": 3, "youtube": 3, "google_trends": 2,
        "sec_edgar": 3, "echa": 1, "eurlex": 1, "epo_patents": 1,
        "beautyfeeds": 1, "newsapi": 3, "ncbi_pubmed": 2, "arxiv": 2,
        "openalex": 3, "semantic_scholar": 3,
        "fred": 1, "world_bank": 1, "open_meteo": 1,
    }

    for source in sources_to_scan:
        max_q = QUERIES_PER_SOURCE.get(source, 2)
        source_queries = queries[:max_q]
        for query in source_queries:
            _scan_state["progress"][f"{source}:{query[:30]}"] = "queued"
            tasks.append(_scan_source(source, query, limit_per_source))

    # Execute all scans concurrently
    scan_results = await asyncio.gather(*tasks, return_exceptions=True)

    # Aggregate results
    for result in scan_results:
        if isinstance(result, Exception):
            logger.error(f"Task failed with exception: {result}")
            _scan_state["errors"].append(str(result)[:200])
            continue

        source_name, articles, error = result

        if error:
            _scan_state["progress"][source_name] = f"error: {error[:80]}"
            _scan_state["errors"].append(f"{source_name}: {error}")
        else:
            _scan_state["progress"][source_name] = f"ok ({len(articles)} results)"

        if source_name not in results["raw"]:
            results["raw"][source_name] = []

        results["raw"][source_name].extend(articles)
        results["trends"].extend(articles)

    # ── Cross-source deduplication (S2 + OpenAlex + others) ──────────
    # Deduplicate by: 1) DOI (exact), 2) normalized title (fuzzy)
    seen_dois = set()
    seen_titles = set()
    deduplicated = []

    def _normalize_title(t: str) -> str:
        """Strip punctuation & lowercase for fuzzy title matching."""
        return "".join(c for c in t.lower() if c.isalnum() or c == " ").strip()

    # Prefer S2 results over OpenAlex when both have the same paper,
    # because S2 provides TLDR summaries and citation velocity enrichment
    academic_first = sorted(
        results["trends"],
        key=lambda t: (
            1 if t.get("source") == "semantic_scholar" else
            2 if t.get("source") == "openalex" else
            0  # Non-academic sources always pass through
        ),
    )

    for trend in academic_first:
        # Check DOI dedup (exact match — most reliable)
        doi = (
            trend.get("doi") or
            trend.get("url", "").replace("https://doi.org/", "") if "doi.org" in trend.get("url", "") else ""
        )
        if doi and doi in seen_dois:
            continue
        if doi:
            seen_dois.add(doi)

        # Check title dedup (normalized fuzzy match)
        title = trend.get("title", "")
        norm = _normalize_title(title)
        if norm and len(norm) > 20 and norm in seen_titles:
            continue
        if norm:
            seen_titles.add(norm)

        deduplicated.append(trend)

    # ── AI-POWERED RELEVANCE & QUALITY FILTER (Bain-grade) ──────────
    # Use Claude Opus to analyze each raw trend for strategic relevance
    # to Henkel Consumer Brands profitability
    try:
        from pulse.ai.provider import get_provider
        from pulse.ai.config import get_ai_config, ProviderConfig, LLMProvider as LLMProviderEnum
        import json as _json

        ai_config = get_ai_config()
        # Force Opus model for deep analysis
        opus_config = ProviderConfig(
            provider=LLMProviderEnum.CLAUDE,
            api_key=ai_config.providers[LLMProviderEnum.CLAUDE].api_key,
            model="claude-opus-4-0-20250514",
            temperature=0.3,
            max_tokens=8192,
            timeout_seconds=120,
        )
        from pulse.ai.provider import ClaudeProvider
        provider = ClaudeProvider(opus_config)

        # Batch raw trends into chunks for efficient processing
        raw_trends = deduplicated[:200]
        BATCH_SIZE = 15
        analyzed_trends = []

        for batch_start in range(0, len(raw_trends), BATCH_SIZE):
            batch = raw_trends[batch_start:batch_start + BATCH_SIZE]

            # Build batch description
            batch_descriptions = []
            for i, t in enumerate(batch):
                title = t.get("title", t.get("name", "Untitled"))
                desc = t.get("description", t.get("snippet", t.get("abstract", "")))[:300]
                source = t.get("source", t.get("api", "unknown"))
                url = t.get("url", "")
                batch_descriptions.append(
                    f"[{i}] SOURCE: {source} | TITLE: {title}\nSNIPPET: {desc}\nURL: {url}"
                )

            system_prompt = """You are a Senior Partner at Bain & Company's Consumer Products practice, specializing in FMCG profit pool analysis for Henkel Consumer Brands.

Your task: Evaluate each trend signal below for its STRATEGIC RELEVANCE to Henkel's category profitability. Henkel operates in:
- HAIR: Color, Care, Styling, Body (brands: Schwarzkopf, Syoss, Gliss, Schauma, got2b)
- LAUNDRY & HOME CARE: Fabric Care (Persil, all, Purex), Dish (Pril, Somat), Home Care (Bref), Insect Control

QUALITY CRITERIA — Only accept trends that meet ALL of these:
1. MATERIAL IMPACT: Could shift category profit pools by ≥1% within 3-5 years
2. EVIDENCE-BASED: Has concrete data points, regulatory filings, market research, or executive statements — not speculation
3. ACTIONABLE: Henkel can respond strategically (invest, defend, pivot, harvest)
4. SPECIFIC: About a real, identifiable market force — not a generic buzzword
5. SOURCE QUALITY: Prioritize consultancy reports, regulatory filings, financial filings (10-K/annual reports), peer-reviewed research, industry-specific trade press. Deprioritize social media noise, clickbait, and generic news.

REJECT trends that are:
- Generic industry news with no Henkel category relevance
- Duplicate angles on the same underlying trend
- Pure product launches without strategic market impact
- Too narrow (single-SKU level) or too broad ("the economy")
- From low-credibility or irrelevant sources

For each ACCEPTED trend, provide:
- name: Clear, specific trend name (e.g., "EU PFAS Restriction Impact on Fabric Care Formulations" not "Regulation Changes")
- description: 2-3 sentences with specific evidence/data points
- force: Consumer | Customer | Technology | Government | Environmental | Competitive
- direction: Expansion (positive for category profit) or Contraction (negative)
- suggested_impact: 1-5 (how much could this shift the profit pool?)
- suggested_probability: 1-5 (how likely is this to materialize at scale?)
- relevance_score: 0-100 (overall strategic relevance to Henkel)
- reasoning: Why this matters for Henkel's profit pools specifically
- category_mapping: Which Henkel categories are exposed and how much (0-5)?
  Categories: hair_color, hair_care, hair_styling, body, fcn (fabric care near), fca (fabric care away), ffi (fabric freshness/ironing), lad (laundry additives), hdw (hand dish wash), adw (auto dish wash), hsc (home surface care), ic (insect control)
- source_quality: "high" (consultancy/regulatory/financial filing), "medium" (trade press/academic), "low" (social media/blog/generic news)

Return a JSON array of accepted trends only. Empty array if none pass the quality bar.
IMPORTANT: Be HIGHLY selective. It's better to return 3 excellent trends than 15 mediocre ones."""

            user_prompt = f"""Analyze these {len(batch)} trend signals for Henkel Consumer Brands strategic relevance:

{chr(10).join(batch_descriptions)}

Return ONLY the trends that pass all quality criteria as a JSON array."""

            try:
                ai_result = await provider.complete_structured(
                    system_prompt,
                    user_prompt,
                    {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "description": {"type": "string"},
                                "force": {"type": "string"},
                                "direction": {"type": "string"},
                                "suggested_impact": {"type": "number"},
                                "suggested_probability": {"type": "number"},
                                "relevance_score": {"type": "number"},
                                "reasoning": {"type": "string"},
                                "category_mapping": {"type": "object"},
                                "source_quality": {"type": "string"},
                            },
                            "required": ["name", "force", "direction", "suggested_impact",
                                         "suggested_probability", "relevance_score", "reasoning"]
                        }
                    }
                )

                # Enrich accepted trends with original source info
                for trend_data in ai_result:
                    # Find the best matching original source
                    best_source = batch[0] if batch else {}
                    for orig in batch:
                        orig_title = (orig.get("title", "") + orig.get("name", "")).lower()
                        if any(w in orig_title for w in trend_data.get("name", "").lower().split()[:3]):
                            best_source = orig
                            break

                    trend_data["id"] = f"ai_{datetime.now().strftime('%Y%m%d%H%M%S')}_{len(analyzed_trends)}"
                    trend_data["sources"] = [{
                        "api": best_source.get("source", best_source.get("api", "AI Analysis")),
                        "title": best_source.get("title", best_source.get("name", trend_data["name"])),
                        "url": best_source.get("url", ""),
                        "snippet": best_source.get("description", best_source.get("snippet", ""))[:200],
                    }]
                    trend_data["discovered_at"] = datetime.now().isoformat()
                    trend_data["status"] = "new"

                    # Default category mapping if not provided
                    if "category_mapping" not in trend_data or not trend_data["category_mapping"]:
                        trend_data["category_mapping"] = {}

                    analyzed_trends.append(trend_data)

            except Exception as ai_err:
                logger.warning(f"AI analysis failed for batch: {ai_err}")
                # Fall through — raw trends will be used as fallback

        if analyzed_trends:
            # Replace raw trends with AI-analyzed ones
            results["trends"] = analyzed_trends
            results["meta"]["ai_filtered"] = True
            results["meta"]["ai_model"] = "claude-opus-4-0-20250514"
            results["meta"]["trends_before_filter"] = len(deduplicated)
            results["meta"]["trends_after_filter"] = len(analyzed_trends)
            logger.info(f"AI filter: {len(deduplicated)} raw → {len(analyzed_trends)} quality trends")
        else:
            logger.warning("AI filter returned no results — using raw trends as fallback")
            results["trends"] = deduplicated[:200]

    except Exception as e:
        logger.error(f"AI relevance filter failed entirely: {e}")
        # Fallback: use raw deduplicated trends
        results["trends"] = deduplicated[:200]

    results["meta"]["completed"] = datetime.now().isoformat()
    results["meta"]["total_trends"] = len(results["trends"])
    results["meta"]["sources_succeeded"] = len([p for p in _scan_state["progress"].values() if "ok" in p])
    results["meta"]["sources_failed"] = len(_scan_state["errors"])

    _scan_state["running"] = False
    _scan_state["last_run"] = datetime.now().isoformat()
    _scan_state["last_results"] = results

    logger.info(
        f"Scan completed: {len(results['trends'])} total trends, "
        f"{results['meta']['sources_succeeded']} sources ok, "
        f"{results['meta']['sources_failed']} errors"
    )

    return results


# ─── API endpoints ────────────────────────────────────────────────────────

@router.get("/status", response_model=ScanStatus)
async def scan_status() -> ScanStatus:
    """Get current scan status.

    Returns:
        Current scan state: running flag, progress by source, errors, result count.
    """
    return ScanStatus(
        running=_scan_state["running"],
        last_run=_scan_state["last_run"],
        progress=_scan_state["progress"],
        errors=_scan_state["errors"],
        result_count=len(_scan_state["last_results"]["trends"]) if _scan_state["last_results"] else 0,
    )


@router.get("/results", response_model=ScanResult)
async def scan_results() -> ScanResult:
    """Get results from the last completed scan.

    Returns:
        Consolidated trend data from all sources.

    Raises:
        HTTPException 404: If no scan has been run yet.
    """
    if not _scan_state["last_results"]:
        raise HTTPException(404, "No scan results available. Run a scan first.")

    results = _scan_state["last_results"]
    return ScanResult(
        trends=results["trends"],
        raw=results["raw"],
        meta=results["meta"],
    )


@router.post("/run", response_model=Dict[str, Any])
async def run_scan(req: ScanRequest = ScanRequest()) -> Dict[str, Any]:
    """Trigger a full API scan across all integrations.

    Queries all available APIs in parallel, collects results, and returns
    consolidated trend data. Takes ~30-60 seconds depending on source health.

    Args:
        req: Scan request with optional source list and force filter.

    Returns:
        Scan results with metadata (or 409 if scan already running).

    Raises:
        HTTPException 409: If another scan is already in progress.
    """
    if _scan_state["running"]:
        raise HTTPException(
            status_code=409,
            detail="Scan already in progress. Check /scanner/status for status.",
        )

    # Run scan asynchronously
    results = await _run_full_scan(
        sources=req.sources,
        force_filter=req.force_filter,
        limit_per_source=req.limit_per_source,
    )

    return results


@router.post("/run-background")
async def run_scan_background(
    req: ScanRequest = ScanRequest(),
    background_tasks: BackgroundTasks = BackgroundTasks(),
) -> Dict[str, str]:
    """Trigger a scan in the background (non-blocking).

    Returns immediately with a status message. Monitor progress via /scanner/status.

    Args:
        req: Scan request.
        background_tasks: FastAPI background task queue.

    Returns:
        Message indicating scan has started.

    Raises:
        HTTPException 409: If another scan is already in progress.
    """
    if _scan_state["running"]:
        raise HTTPException(
            status_code=409,
            detail="Scan already in progress. Check /scanner/status for status.",
        )

    background_tasks.add_task(
        _run_full_scan,
        sources=req.sources,
        force_filter=req.force_filter,
        limit_per_source=req.limit_per_source,
    )

    return {
        "status": "started",
        "message": "Scan queued. Check /scanner/status for progress.",
    }


@router.get("/health")
async def scanner_health() -> Dict[str, Any]:
    """Health check for scanner integration.

    Returns:
        Health status of key integrations.
    """
    health = {
        "scanner": "healthy",
        "last_scan": _scan_state["last_run"],
        "scan_running": _scan_state["running"],
        "integrations_available": [
            "gdelt", "gnews", "currentsapi", "rss_feeds",
            "fred", "google_trends", "world_bank", "open_meteo",
            "sec_edgar", "reddit", "youtube",
            "echa", "eurlex", "epo_patents",
            "openalex", "semantic_scholar",
            "newsapi", "ncbi_pubmed", "arxiv",
            "beautyfeeds",
        ],
    }
    return health


@router.post("/cancel")
async def cancel_scan() -> Dict[str, str]:
    """Cancel the currently running scan (if any).

    Note: This sets the flag, but ongoing API requests will continue.
    Cancel is not immediate.

    Returns:
        Status message.
    """
    if not _scan_state["running"]:
        return {"status": "no scan running"}

    _scan_state["running"] = False
    return {"status": "cancel requested"}


@router.get("/saved-trends")
async def get_saved_trends() -> Dict[str, Any]:
    """Load previously saved scanned trends from database.

    Returns:
        List of saved scanned trends with their status.
    """
    try:
        from pulse.database import get_db_connection, _row_to_dict, placeholder, init_db
        init_db()

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM scanned_trends ORDER BY discovered_at DESC LIMIT 200"
            )
            rows = cursor.fetchall()
            trends = []
            for r in rows:
                row = _row_to_dict(r)
                # Parse JSON fields
                import json as _json
                row["category_mapping"] = _json.loads(row.get("category_mapping") or "{}")
                row["sources"] = _json.loads(row.get("sources") or "[]")
                trends.append(row)
            return {"trends": trends, "count": len(trends)}
    except Exception as e:
        logger.error(f"Failed to load saved trends: {e}")
        return {"trends": [], "count": 0, "error": str(e)[:200]}


@router.post("/save-trends")
async def save_scanned_trends(body: Dict[str, Any]) -> Dict[str, Any]:
    """Save scanned trends to database for persistence.

    Args:
        body: { "trends": [...] } — list of emerging trend objects

    Returns:
        Count of saved trends.
    """
    try:
        from pulse.database import get_db_connection, placeholder, ph, init_db, USE_POSTGRES
        import json as _json
        init_db()

        trends = body.get("trends", [])
        if not trends:
            return {"saved": 0}

        p = placeholder()
        session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        saved = 0

        with get_db_connection() as conn:
            cursor = conn.cursor()
            for t in trends:
                trend_id = t.get("id", f"scan_{session_id}_{saved}")
                name = t.get("name", "Untitled")

                # Upsert: update if exists, insert if new
                if USE_POSTGRES:
                    cursor.execute(
                        f"""INSERT INTO scanned_trends
                            (id, name, description, force, direction, suggested_impact,
                             suggested_probability, relevance_score, category_mapping,
                             sources, discovered_at, reasoning, status, scan_session, updated_at)
                            VALUES ({ph(15)})
                            ON CONFLICT (id) DO UPDATE SET
                                description = EXCLUDED.description,
                                relevance_score = EXCLUDED.relevance_score,
                                sources = EXCLUDED.sources,
                                status = CASE
                                    WHEN scanned_trends.status IN ('added', 'dismissed') THEN scanned_trends.status
                                    ELSE 'reviewed'
                                END,
                                updated_at = EXCLUDED.updated_at""",
                        (
                            trend_id, name,
                            t.get("description", ""),
                            t.get("force", "Consumer"),
                            t.get("direction", "Expansion"),
                            t.get("suggested_impact", 3),
                            t.get("suggested_probability", 3),
                            t.get("relevance_score", 65),
                            _json.dumps(t.get("category_mapping", {})),
                            _json.dumps(t.get("sources", [])),
                            t.get("discovered_at", datetime.now().isoformat()),
                            t.get("reasoning", ""),
                            t.get("status", "new"),
                            session_id,
                            datetime.now().isoformat(),
                        ),
                    )
                else:
                    cursor.execute(
                        f"""INSERT OR REPLACE INTO scanned_trends
                            (id, name, description, force, direction, suggested_impact,
                             suggested_probability, relevance_score, category_mapping,
                             sources, discovered_at, reasoning, status, scan_session, updated_at)
                            VALUES ({ph(15)})""",
                        (
                            trend_id, name,
                            t.get("description", ""),
                            t.get("force", "Consumer"),
                            t.get("direction", "Expansion"),
                            t.get("suggested_impact", 3),
                            t.get("suggested_probability", 3),
                            t.get("relevance_score", 65),
                            _json.dumps(t.get("category_mapping", {})),
                            _json.dumps(t.get("sources", [])),
                            t.get("discovered_at", datetime.now().isoformat()),
                            t.get("reasoning", ""),
                            t.get("status", "new"),
                            session_id,
                            datetime.now().isoformat(),
                        ),
                    )
                saved += 1

            conn.commit()

        return {"saved": saved, "session_id": session_id}
    except Exception as e:
        logger.error(f"Failed to save trends: {e}")
        raise HTTPException(500, f"Failed to save: {str(e)[:200]}")


@router.post("/update-trend-status")
async def update_trend_status(body: Dict[str, Any]) -> Dict[str, str]:
    """Update the status of a scanned trend (new/reviewed/added/dismissed).

    Args:
        body: { "id": "...", "status": "added"|"dismissed"|"reviewed" }
    """
    try:
        from pulse.database import get_db_connection, placeholder, init_db
        init_db()

        trend_id = body.get("id")
        new_status = body.get("status")
        if not trend_id or new_status not in ("new", "reviewed", "added", "dismissed"):
            raise HTTPException(400, "Invalid id or status")

        p = placeholder()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"UPDATE scanned_trends SET status = {p}, updated_at = {p} WHERE id = {p}",
                (new_status, datetime.now().isoformat(), trend_id),
            )
            conn.commit()
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e)[:200])


@router.delete("/trends/{trend_id}")
async def delete_scanned_trend(trend_id: str) -> Dict[str, str]:
    """Permanently delete a single scanned trend from database."""
    try:
        from pulse.database import get_db_connection, placeholder, init_db
        init_db()
        p = placeholder()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"DELETE FROM scanned_trends WHERE id = {p}", (trend_id,))
            conn.commit()
        return {"status": "ok", "deleted": trend_id}
    except Exception as e:
        raise HTTPException(500, str(e)[:200])


@router.delete("/trends")
async def delete_scanned_trends(body: Dict[str, Any] = None) -> Dict[str, Any]:
    """Delete scanned trends. If body contains 'ids', delete those. Otherwise delete ALL."""
    try:
        from pulse.database import get_db_connection, placeholder, init_db
        init_db()
        p = placeholder()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            if body and body.get("ids"):
                ids = body["ids"]
                placeholders = ", ".join([p] * len(ids))
                cursor.execute(f"DELETE FROM scanned_trends WHERE id IN ({placeholders})", tuple(ids))
                deleted = cursor.rowcount
            else:
                cursor.execute("DELETE FROM scanned_trends")
                deleted = cursor.rowcount
            conn.commit()
        return {"status": "ok", "deleted_count": deleted}
    except Exception as e:
        raise HTTPException(500, str(e)[:200])


@router.get("/forces")
async def get_force_queries() -> Dict[str, List[str]]:
    """Get available force query templates.

    Returns:
        Dictionary mapping force names to example queries.
    """
    return FORCE_QUERIES
