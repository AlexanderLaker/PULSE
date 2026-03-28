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


# ─── FMCG-focused search queries by force ──────────────────────────────────
FORCE_QUERIES = {
    "Consumer": [
        "natural beauty trends",
        "sustainable personal care",
        "premiumization wellness",
        "clean beauty movement",
        "direct-to-consumer beauty",
    ],
    "Government": [
        "EU cosmetics regulation",
        "detergent labeling restrictions",
        "microplastics ban",
        "chemical ingredient restrictions",
        "SVHC authorization",
    ],
    "Technology": [
        "green chemistry innovation",
        "biotechnology cosmetics",
        "waterless formulations",
        "AI personalization beauty",
        "sustainable surfactants",
    ],
    "Environmental": [
        "climate impact carbon footprint",
        "water scarcity",
        "biodiversity conservation",
        "circular economy packaging",
        "PFAS contamination",
    ],
    "Competitive": [
        "P&G strategy acquisition",
        "Unilever sustainability",
        "Reckitt performance",
        "market consolidation",
        "competitive innovation",
    ],
    "Customer": [
        "e-commerce growth beauty",
        "retailer margins pressure",
        "DTC direct-to-consumer",
        "supply chain disruption",
        "channel shift online",
    ],
}


# ─── Scan coordinator ──────────────────────────────────────────────────────
async def _scan_source(
    source_name: str,
    query: str,
    limit: int,
) -> tuple[str, List[Dict[str, Any]], Optional[str]]:
    """
    Attempt to scan a single source with timeout (10 seconds max per source).

    Returns: (source_name, results, error_message)
    All failures return empty results + error message, never raise.
    """
    try:
        # Wrap entire source scan with timeout to prevent Vercel 300s overrun
        async def _source_logic():
            return await _scan_source_inner(source_name, query, limit)

        result = await asyncio.wait_for(_source_logic(), timeout=10.0)
        return result
    except asyncio.TimeoutError:
        error_msg = f"Timeout: exceeded 10s limit"
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
    try:
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
            # FRED requires series_id, use query as ID
            results = await client.fetch_series(query, limit=limit)
            return source_name, results, None

        elif source_name == "google_trends":
            from pulse.integrations.google_trends import GoogleTrendsClient
            client = GoogleTrendsClient()
            # Google Trends takes list of keywords
            keywords = query.split() if isinstance(query, str) else [query]
            results = await client.fetch_interest(keywords[:5])
            return source_name, [results] if results else [], None

        elif source_name == "world_bank":
            from pulse.integrations.world_bank import WorldBankClient
            client = WorldBankClient()
            # World Bank works with specific indicator IDs, not free-text query
            # Use a default indicator for FMCG-relevant data
            results = await client.fetch_indicator("NY.GDP.PCAP.CD", limit=limit)
            return source_name, results, None

        elif source_name == "sec_edgar":
            from pulse.integrations.sec_edgar import SECEdgarClient
            client = SECEdgarClient()
            # SEC Edgar requires company CIK, search returns empty for free-text
            results = await client.search_filings(query, limit=limit)
            return source_name, results, None

        elif source_name == "open_meteo":
            from pulse.integrations.open_meteo import OpenMeteoClient
            client = OpenMeteoClient()
            # Open-Meteo requires latitude/longitude, use default (Brussels for EU/Henkel)
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

        elif source_name == "openalex":
            from pulse.integrations.openalex import OpenAlexClient
            client = OpenAlexClient()
            # OpenAlex uses search_works() method
            results = await client.search_works(query, limit=limit)
            return source_name, results, None

        elif source_name == "echa":
            from pulse.integrations.echa import ECHAClient
            client = ECHAClient()
            # ECHA uses search_svhcs() or search_restrictions()
            results = await client.search_svhcs(query, limit=limit)
            return source_name, results, None

        elif source_name == "eurlex":
            from pulse.integrations.eurlex import EurLexClient
            client = EurLexClient()
            # EUR-Lex uses search() method
            results = await client.search(query, limit=limit)
            return source_name, results, None

        elif source_name == "epo_patents":
            from pulse.integrations.epo_patents import EPOPatentClient
            client = EPOPatentClient()
            # EPO uses search_patents() method
            results = await client.search_patents(query, limit=limit)
            return source_name, results, None

        elif source_name == "beautyfeeds":
            from pulse.integrations.beautyfeeds import BeautyFeedsClient
            client = BeautyFeedsClient()
            results = await client.fetch_all(query, limit=limit)
            return source_name, results, None

        elif source_name == "newsapi":
            from pulse.integrations.newsapi import NewsAPIClient
            client = NewsAPIClient()
            results = await client.search(query, limit=limit)
            return source_name, results, None

        elif source_name == "ncbi_pubmed":
            from pulse.integrations.ncbi_pubmed import NCBIPubMedClient
            client = NCBIPubMedClient()
            results = await client.search(query, limit=limit)
            return source_name, results, None

        elif source_name == "arxiv":
            from pulse.integrations.arxiv_api import ArxivClient
            client = ArxivClient()
            results = await client.search(query, limit=limit)
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
        "openalex", "newsapi", "ncbi_pubmed", "arxiv",
        "beautyfeeds",
    ]

    sources_to_scan = sources or all_sources
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

    # Create scan tasks: for each source × query pair
    tasks = []
    for source in sources_to_scan:
        for query in queries[:1]:  # Limit to 1 query per source to fit within Vercel 300s timeout
            _scan_state["progress"][f"{source}:{query[:20]}"] = "queued"
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

    # Deduplicate trends by title
    seen_titles = set()
    deduplicated = []
    for trend in results["trends"]:
        title = trend.get("title", "")
        if title and title not in seen_titles:
            seen_titles.add(title)
            deduplicated.append(trend)

    results["trends"] = deduplicated[:200]  # Limit total results
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
            "openalex", "newsapi", "ncbi_pubmed", "arxiv",
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


@router.get("/forces")
async def get_force_queries() -> Dict[str, List[str]]:
    """Get available force query templates.

    Returns:
        Dictionary mapping force names to example queries.
    """
    return FORCE_QUERIES
