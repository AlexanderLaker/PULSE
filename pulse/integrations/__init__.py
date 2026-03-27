"""External API integrations for PULSE trend intelligence.

Free-first architecture: all APIs are free tier or open source.
€0 running cost with multi-source redundancy.

Available integrations:
- GDELT Project: global news events, sentiment, volume baseline
- GNews: curated quality news feed
- CurrentsAPI: sentiment analysis, topic coverage
- FRED: economic data (commodity prices, PPI, etc.)
- Google Trends: consumer search behavior
- RSS Feeds: 12 curated FMCG industry sources
- World Bank: macroeconomic data
- SEC EDGAR: public company filings
- ECHA: EU chemical regulations
- EUR-Lex: EU legislation
- Reddit: consumer sentiment and discussions
- YouTube: trend video validation
- EPO Patents: innovation tracking
- Open-Meteo: climate and weather data
"""

import logging
from typing import Dict, List, Any, Optional
import asyncio

logger = logging.getLogger(__name__)


class IntegrationManager:
    """Unified manager for all external API integrations.

    Provides:
    - Centralized initialization of all clients
    - Rate limiting and caching
    - Fallback and redundancy logic
    - Multi-source waterfall queries
    """

    def __init__(self):
        """Initialize all available integrations."""
        self.clients = {}
        self._initialize_clients()

    def _initialize_clients(self) -> None:
        """Lazy-load integration clients on demand."""
        # Clients are initialized on first use to avoid API key errors at startup
        pass

    async def scan_all_sources(
        self,
        query: str,
        sources: Optional[List[str]] = None,
        limit: int = 50,
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Run a query across multiple sources with intelligent waterfall.

        Args:
            query: Search query (e.g., "sustainable beauty" or "detergent innovation")
            sources: List of sources to query. If None, uses intelligent priority order.
            limit: Max results per source

        Returns:
            Dictionary mapping source name to list of results
        """
        if sources is None:
            sources = ["gdelt", "gnews", "fred", "google_trends", "rss_feeds"]

        results = {}

        # Query with waterfall logic: fast sources first, then slower sources
        for source in sources:
            try:
                if source == "gdelt":
                    from pulse.integrations.gdelt import GDELTClient
                    client = GDELTClient()
                    results["gdelt"] = await client.fetch_articles(query, limit=limit)

                elif source == "gnews":
                    from pulse.integrations.gnews import GNewsClient
                    client = GNewsClient()
                    results["gnews"] = await client.search(query, limit=limit)

                elif source == "currentsapi":
                    from pulse.integrations.currentsapi import CurrentsAPIClient
                    client = CurrentsAPIClient()
                    results["currentsapi"] = await client.search(query, limit=limit)

                elif source == "fred":
                    from pulse.integrations.fred_api import FREDClient
                    client = FREDClient()
                    results["fred"] = await client.fetch_series(query, limit=limit)

                elif source == "google_trends":
                    from pulse.integrations.google_trends import GoogleTrendsClient
                    client = GoogleTrendsClient()
                    results["google_trends"] = await client.fetch_interest(query)

                elif source == "rss_feeds":
                    from pulse.integrations.rss_feeds import RSSFeedClient
                    client = RSSFeedClient()
                    results["rss_feeds"] = await client.fetch_all(query, limit=limit)

                elif source == "world_bank":
                    from pulse.integrations.world_bank import WorldBankClient
                    client = WorldBankClient()
                    results["world_bank"] = await client.fetch_indicators(query, limit=limit)

                elif source == "sec_edgar":
                    from pulse.integrations.sec_edgar import SECEdgarClient
                    client = SECEdgarClient()
                    results["sec_edgar"] = await client.fetch_filings(query, limit=limit)

                elif source == "reddit":
                    from pulse.integrations.reddit_api import RedditClient
                    client = RedditClient()
                    results["reddit"] = await client.search_subreddits(query, limit=limit)

            except Exception as e:
                logger.warning(f"Integration {source} failed: {e}")
                results[source] = []

        return results

    async def scan_fmcg_trends(self, force: str = None) -> Dict[str, List[Dict[str, Any]]]:
        """Specialized scan for FMCG industry trends by force.

        Args:
            force: Force category (Consumer, Government, Technology, Environmental, etc.)
                   If None, scans all

        Returns:
            Dictionary mapping source to trend articles/data
        """
        force_queries = {
            "Consumer": ["natural beauty", "sustainable personal care", "premiumization", "wellness trends"],
            "Government": ["EU cosmetics regulation", "detergent labeling", "microplastics ban", "ingredient restrictions"],
            "Technology": ["green chemistry innovation", "biotechnology", "waterless formulations", "AI personalization"],
            "Environmental": ["climate impact", "water scarcity", "biodiversity", "circular economy"],
            "Competitive": ["P&G strategy", "Unilever sustainability", "Reckitt performance", "market consolidation"],
            "Customer": ["e-commerce growth", "retailer margins", "DTC models", "supply chain"],
        }

        if force and force in force_queries:
            queries = force_queries[force]
        else:
            queries = [q for qs in force_queries.values() for q in qs]

        all_results = {}
        for query in queries:
            results = await self.scan_all_sources(query, limit=30)
            for source, articles in results.items():
                if source not in all_results:
                    all_results[source] = []
                all_results[source].extend(articles)

        return all_results

    def get_client(self, service_name: str):
        """Get a client for a specific service.

        Args:
            service_name: Name of the service (gdelt, gnews, fred, etc.)

        Returns:
            Client instance for the service
        """
        if service_name == "gdelt":
            from pulse.integrations.gdelt import GDELTClient
            return GDELTClient()
        elif service_name == "gnews":
            from pulse.integrations.gnews import GNewsClient
            return GNewsClient()
        elif service_name == "currentsapi":
            from pulse.integrations.currentsapi import CurrentsAPIClient
            return CurrentsAPIClient()
        elif service_name == "fred":
            from pulse.integrations.fred_api import FREDClient
            return FREDClient()
        elif service_name == "google_trends":
            from pulse.integrations.google_trends import GoogleTrendsClient
            return GoogleTrendsClient()
        elif service_name == "rss_feeds":
            from pulse.integrations.rss_feeds import RSSFeedClient
            return RSSFeedClient()
        elif service_name == "world_bank":
            from pulse.integrations.world_bank import WorldBankClient
            return WorldBankClient()
        elif service_name == "sec_edgar":
            from pulse.integrations.sec_edgar import SECEdgarClient
            return SECEdgarClient()
        elif service_name == "reddit":
            from pulse.integrations.reddit_api import RedditClient
            return RedditClient()
        elif service_name == "youtube":
            from pulse.integrations.youtube_api import YouTubeClient
            return YouTubeClient()
        elif service_name == "echa":
            from pulse.integrations.echa import ECHAClient
            return ECHAClient()
        elif service_name == "eurlex":
            from pulse.integrations.eurlex import EURLexClient
            return EURLexClient()
        elif service_name == "epo_patents":
            from pulse.integrations.epo_patents import EPOPatentClient
            return EPOPatentClient()
        elif service_name == "open_meteo":
            from pulse.integrations.open_meteo import OpenMeteoClient
            return OpenMeteoClient()
        else:
            raise ValueError(f"Unknown service: {service_name}")
