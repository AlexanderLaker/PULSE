"""RSS Feed integration — 12 curated FMCG industry sources.

FREE. Includes:
- CosmeticsDesign, CosmeticsBusiness
- RetailDive, GroceryDive, PackagingDive
- HAPPI Magazine, GCI Magazine
- ChemicalWatch, RetailDetail, FoodBusinessNews, etc.
"""

import logging
import asyncio
from typing import List, Dict, Any, Optional
import feedparser
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class RSSFeedClient:
    """Client for FMCG industry RSS feeds.

    Curated list of 12+ high-quality industry sources covering:
    - Beauty and personal care trends
    - Retail dynamics and channel shifts
    - Regulatory and compliance updates
    - Sustainability and packaging innovation
    - Competitive moves and M&A
    """

    FEEDS = {
        "CosmeticsDesign": "https://www.cosmeticsdesign.com/rss/feed.xml",
        "CosmeticsBusiness": "https://www.cosmeticsbusiness.com/rss/all.xml",
        "RetailDive": "https://www.retaildive.com/feeds/news.xml",
        "GroceryDive": "https://www.grocerydive.com/feeds/news.xml",
        "PackagingDive": "https://www.packagingdive.com/feeds/news.xml",
        "HAPPI": "https://www.happi.com/feed",
        "GCI": "https://www.gcimagazine.com/feed",
        "ChemicalWatch": "https://chemicalwatch.com/rss",
        "FoodBusinessNews": "https://www.foodbusinessnews.net/feeds/",
        "SupplyChainBrain": "https://www.supplychainbrain.com/feed",
        "RetailDetail": "https://www.retaildetail.eu/en/rss",
        "PackagingStrategies": "https://www.packagingstrategies.com/feeds/",
    }

    def __init__(self, timeout: int = 10):
        """Initialize RSS Feed client.

        Args:
            timeout: HTTP timeout in seconds
        """
        self.timeout = timeout

    async def fetch_all(
        self,
        query: Optional[str] = None,
        limit: int = 50,
        days_back: int = 7,
    ) -> List[Dict[str, Any]]:
        """Fetch articles from all feeds, optionally filtered by query.

        Args:
            query: Optional search term to filter articles
            limit: Max articles total
            days_back: Only include articles from last N days

        Returns:
            List of articles from all feeds
        """
        all_articles = []
        cutoff_date = datetime.now() - timedelta(days=days_back)

        loop = asyncio.get_event_loop()

        for source_name, feed_url in self.FEEDS.items():
            try:
                articles = await loop.run_in_executor(
                    None,
                    self._fetch_feed_sync,
                    source_name,
                    feed_url,
                    query,
                    days_back,
                )
                all_articles.extend(articles)

            except Exception as e:
                logger.debug(f"RSS feed {source_name} error: {e}")
                continue

        # Sort by date (most recent first) and limit
        all_articles.sort(
            key=lambda x: x.get("published_date", ""),
            reverse=True
        )

        logger.info(f"RSS: fetched {len(all_articles[:limit])} articles across {len(self.FEEDS)} sources")
        return all_articles[:limit]

    def _fetch_feed_sync(
        self,
        source_name: str,
        feed_url: str,
        query: Optional[str] = None,
        days_back: int = 7,
    ) -> List[Dict[str, Any]]:
        """Synchronously fetch and parse a single RSS feed.

        Args:
            source_name: Human-readable source name
            feed_url: URL of the RSS feed
            query: Optional search term
            days_back: Filter by days

        Returns:
            List of articles from this feed
        """
        try:
            feed = feedparser.parse(feed_url)

            if feed.bozo:
                logger.debug(f"RSS feed parse warning for {source_name}: {feed.bozo_exception}")

            articles = []
            cutoff_date = datetime.now() - timedelta(days=days_back)

            for entry in feed.entries[:100]:  # Parse up to 100 per feed
                # Extract date
                published = None
                if hasattr(entry, "published"):
                    try:
                        published = entry.published
                    except:
                        pass

                # Check if article is recent enough
                if published:
                    try:
                        pub_date = datetime.fromisoformat(published.replace('Z', '+00:00'))
                        if pub_date < cutoff_date:
                            continue
                    except:
                        pass

                # Extract title and summary
                title = entry.get("title", "")
                summary = entry.get("summary", "")[:300]

                # Apply query filter if provided
                if query:
                    combined_text = (title + " " + summary).lower()
                    if query.lower() not in combined_text:
                        continue

                # Build article dict
                article = {
                    "source": "RSS Feeds",
                    "source_name": source_name,
                    "title": title,
                    "url": entry.get("link", ""),
                    "published": published or "",
                    "published_date": published or "",
                    "description": summary,
                    "author": entry.get("author", ""),
                }

                articles.append(article)

            return articles

        except Exception as e:
            logger.error(f"RSS feed {source_name} error: {e}")
            return []

    async def fetch_by_source(
        self,
        source_name: str,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Fetch articles from a specific source.

        Args:
            source_name: Key from FEEDS dict
            limit: Max articles

        Returns:
            List of articles
        """
        if source_name not in self.FEEDS:
            logger.warning(f"Unknown RSS source: {source_name}")
            return []

        feed_url = self.FEEDS[source_name]
        loop = asyncio.get_event_loop()

        try:
            articles = await loop.run_in_executor(
                None,
                self._fetch_feed_sync,
                source_name,
                feed_url,
                None,  # no query filter
                30,  # default days back
            )
            return articles[:limit]

        except Exception as e:
            logger.error(f"Fetch by source error: {e}")
            return []

    async def get_feed_status(self) -> Dict[str, bool]:
        """Check health of all feeds (can parse without error).

        Returns:
            Dictionary mapping source to status (True if accessible)
        """
        status = {}
        loop = asyncio.get_event_loop()

        for source_name, feed_url in self.FEEDS.items():
            try:
                feed = await loop.run_in_executor(
                    None,
                    feedparser.parse,
                    feed_url,
                )
                status[source_name] = not feed.bozo
            except Exception as e:
                logger.debug(f"Feed {source_name} status check failed: {e}")
                status[source_name] = False

        return status
