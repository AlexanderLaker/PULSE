# PULSE Scanner API Documentation

## Overview

The Scanner API provides comprehensive endpoints for triggering full-scale trend intelligence scans across all 19 PULSE integrations. The scanner queries multiple external APIs in parallel, aggregates results, and returns consolidated trend data suitable for PULSE analysis.

## Features

- **Multi-source scanning**: Query 19 integrations simultaneously
- **Force-based queries**: Pre-configured FMCG queries aligned with PULSE forces
- **Robust error handling**: Graceful degradation if individual APIs fail
- **Real-time progress tracking**: Monitor scan progress via status endpoint
- **Result deduplication**: Eliminate duplicate trends by title
- **Async execution**: Non-blocking background scans available
- **State management**: Prevent concurrent scans, cache last results

## API Endpoints

### POST /api/v1/scanner/run

Trigger a synchronous (blocking) scan across all integrations.

**Request:**
```json
{
  "sources": null,  // Optional: list of sources to scan. Null = all.
  "force_filter": null,  // Optional: filter to specific force (Consumer, Government, etc.)
  "limit_per_source": 50  // Max results per source (10-200, default 50)
}
```

**Response (200 OK):**
```json
{
  "trends": [
    {
      "source": "GDELT",
      "title": "EU Cosmetics Regulation Amendment Proposed",
      "url": "https://...",
      "published": "2026-03-26T10:30:00",
      "source_name": "Euractiv",
      "description": "..."
    }
  ],
  "raw": {
    "gdelt": [...],
    "gnews": [...],
    "rss_feeds": [...]
  },
  "meta": {
    "started": "2026-03-26T14:00:00",
    "completed": "2026-03-26T14:02:15",
    "sources_queried": ["gdelt", "gnews", ...],
    "force_filter": null,
    "total_trends": 145,
    "sources_succeeded": 18,
    "sources_failed": 1
  }
}
```

**Response (409 Conflict):**
```json
{
  "detail": "Scan already in progress. Check /scanner/status for status."
}
```

**Runtime:** 30-60 seconds depending on API health

---

### POST /api/v1/scanner/run-background

Trigger an asynchronous (non-blocking) scan in the background.

**Request:** Same as `/run`

**Response (200 OK):**
```json
{
  "status": "started",
  "message": "Scan queued. Check /scanner/status for progress."
}
```

**Benefits:** Returns immediately; use `/status` endpoint to poll progress

---

### GET /api/v1/scanner/status

Get current scan status and real-time progress.

**Response (200 OK):**
```json
{
  "running": true,
  "last_run": "2026-03-26T13:58:30",
  "progress": {
    "gdelt": "ok (87 results)",
    "gnews": "querying...",
    "rss_feeds": "ok (45 results)",
    "fred": "error: API timeout"
  },
  "errors": [
    "fred: API timeout after 30 seconds",
    "youtube: API key not configured"
  ],
  "result_count": 178
}
```

**Polling behavior:** Check every 2-5 seconds for status updates

---

### GET /api/v1/scanner/results

Retrieve full results from the last completed scan.

**Response (200 OK):** Same structure as `/run` response above

**Response (404 Not Found):**
```json
{
  "detail": "No scan results available. Run a scan first."
}
```

---

### GET /api/v1/scanner/forces

Get available force query templates.

**Response (200 OK):**
```json
{
  "Consumer": [
    "natural beauty trends",
    "sustainable personal care",
    "premiumization wellness",
    "clean beauty movement",
    "direct-to-consumer beauty"
  ],
  "Government": [
    "EU cosmetics regulation",
    "detergent labeling restrictions",
    "microplastics ban",
    "chemical ingredient restrictions",
    "SVHC authorization"
  ],
  ...
}
```

**Use case:** Display force options to frontend/UI for user selection

---

### GET /api/v1/scanner/health

Health check for scanner subsystem.

**Response (200 OK):**
```json
{
  "scanner": "healthy",
  "last_scan": "2026-03-26T13:58:30",
  "scan_running": false,
  "integrations_available": [
    "gdelt", "gnews", "currentsapi", "rss_feeds", "fred", "google_trends",
    "world_bank", "open_meteo", "sec_edgar", "reddit", "youtube",
    "echa", "eurlex", "epo_patents", "openalex", "newsapi",
    "ncbi_pubmed", "arxiv", "beautyfeeds"
  ]
}
```

---

### POST /api/v1/scanner/cancel

Cancel the currently running scan (if any).

**Response (200 OK) — Scan was running:**
```json
{
  "status": "cancel requested"
}
```

**Response (200 OK) — No scan running:**
```json
{
  "status": "no scan running"
}
```

**Note:** Cancel is best-effort; ongoing API requests will continue, but no new sources will be queried.

---

## Integration Sources (19 total)

### News & Trend Intelligence (5)
- **GDELT Project**: Global events, sentiment, volume baseline
- **GNews**: Curated quality news (100 req/day free)
- **CurrentsAPI**: Real-time news + sentiment (200 req/day free)
- **RSS Feeds**: 12 curated FMCG industry sources
- **NewsAPI**: Breaking news across 150+ sources

### Economic Data (3)
- **FRED**: Commodity prices, PPI, employment (Federal Reserve)
- **World Bank**: GDP, urbanization, water stress indicators
- **Open-Meteo**: Climate and weather data (no API key needed)

### Competitive Intelligence (2)
- **SEC EDGAR**: Public company filings (P&G, Unilever, Reckitt, etc.)
- **EPO Patents**: European patent filings (IPC classes A61K, A61Q, C11D, etc.)

### Consumer Sentiment (2)
- **Reddit**: Discussions in beauty/skincare subreddits
- **YouTube**: Video trends in beauty, skincare, sustainability

### Regulatory (2)
- **ECHA**: EU Chemicals Agency (SVHC, restrictions, REACH)
- **EUR-Lex**: EU legislation (Cosmetics 1223/2009, Detergent 648/2004)

### Scientific (3)
- **OpenAlex**: Scholarly research papers (2M+ papers)
- **NCBI PubMed**: Biomedical literature (36M+ records)
- **arXiv**: Preprints in materials science, chemistry, AI (2M+ papers)

### Industry RSS (2)
- **BeautyFeeds**: Beauty industry RSS aggregator
- **Custom RSS**: CosmeticsDesign, RetailDive, PackagingDive, etc.

---

## Query Examples by Force

### Consumer Force
```bash
curl -X POST "http://localhost:8000/api/v1/scanner/run" \
  -H "Content-Type: application/json" \
  -d '{
    "force_filter": "Consumer",
    "limit_per_source": 30
  }'
```
Queries: natural beauty trends, premiumization, clean beauty, DTC

### Government Force
```bash
curl -X POST "http://localhost:8000/api/v1/scanner/run" \
  -H "Content-Type: application/json" \
  -d '{
    "force_filter": "Government",
    "limit_per_source": 40
  }'
```
Queries: regulations, restrictions, ingredient bans, SVHC, labeling

### Technology Force
```bash
curl -X POST "http://localhost:8000/api/v1/scanner/run" \
  -H "Content-Type: application/json" \
  -d '{
    "force_filter": "Technology",
    "limit_per_source": 35
  }'
```
Queries: green chemistry, biotech, waterless formulations, AI personalization

### Environmental Force
```bash
curl -X POST "http://localhost:8000/api/v1/scanner/run" \
  -H "Content-Type: application/json" \
  -d '{
    "force_filter": "Environmental",
    "limit_per_source": 40
  }'
```
Queries: climate impact, water scarcity, biodiversity, circular economy, PFAS

---

## Error Handling

### Partial Failures (Graceful Degradation)
If one or more APIs fail, the scan continues with remaining sources:
- Success count: 18/19 sources succeeded
- Error details: Array of per-source errors
- Partial results: Consolidated trends from successful sources

### API Key Configuration
Some integrations require API keys (GNews, YouTube, Reddit, etc.). If not configured:
- Integration skipped gracefully (returns empty results)
- Error logged: "API key not configured"
- Scan continues with other sources

### Timeouts
- Per-source timeout: 30 seconds (aiohttp.ClientTimeout)
- If source times out: marked as failed, scan continues
- Error: "API timeout after 30 seconds"

---

## Performance Characteristics

| Metric | Value |
|--------|-------|
| Typical scan time | 30-60 seconds |
| Parallel sources | 19 APIs simultaneously |
| Max trends per source | Configurable (10-200) |
| Total trends returned | ~200 (deduplicated) |
| Concurrent scan limit | 1 (409 if another running) |

---

## Integration with PULSE Architecture

### Workflow: Scanner → Ingestion → Simulation

1. **Admin triggers scan**: `POST /api/v1/scanner/run`
2. **Scanner queries all APIs**: 19 integrations in parallel
3. **Results deduplicated**: Remove duplicate titles
4. **Trends ready for review**: Stored in `_scan_state["last_results"]`
5. **User accepts/rejects**: AI suggestions queue → Delphi scoring
6. **Trends added to TrendDatabase**: Via `POST /api/v1/trends`
7. **Simulation runs**: `POST /api/v1/simulate` with updated trends

---

## Testing

Run unit tests:
```bash
pytest tests/test_scanner_routes.py -v
```

Key test coverage:
- ✓ State management (no concurrent scans)
- ✓ Force query templates exist
- ✓ Error handling per source
- ✓ Deduplication by title
- ✓ Partial failure resilience
- ✓ Endpoint validation

---

## Troubleshooting

### "Scan already in progress"
- **Cause**: Concurrent scan attempt
- **Solution**: Wait for current scan to complete (~60s) or call `POST /scanner/cancel`

### "No scan results available"
- **Cause**: No scan has been run yet
- **Solution**: Call `POST /scanner/run` first

### Empty results / "0 trends"
- **Cause**: All sources failed (likely API key issues)
- **Solution**: Check `/scanner/health` and error logs; configure API keys

### Slow scan (~120 seconds)
- **Cause**: One or more sources timing out
- **Solution**: Check `/scanner/status` for failing sources; consider reduced limit_per_source

---

## Configuration

All API integrations read credentials from environment variables:
```bash
GNEWS_API_KEY=your_key
REDDIT_CLIENT_ID=your_id
REDDIT_CLIENT_SECRET=your_secret
YOUTUBE_API_KEY=your_key
FRED_API_KEY=your_key  # Optional
CURRENTSAPI_KEY=your_key
OPENALEX_API_KEY=your_key  # Optional
```

Missing keys result in graceful skipping of that integration.

---

## Security

- **No authentication required** (assumes internal Henkel network)
- **No financial data scanned** (PULSE works with relative shifts only)
- **All external data** (articles, papers, regulations) are public
- **Rate limiting**: Handled by individual API clients (respect free tier limits)

---

## Support

For issues:
1. Check `/api/v1/scanner/health` endpoint
2. Review `/api/v1/scanner/status` for per-source errors
3. Check application logs for detailed error messages
4. Verify API keys are configured (env vars)
5. Test with reduced `limit_per_source` to isolate slow sources

---

*Document Version: 1.0 (March 2026)*
*Last Updated: March 26, 2026*
