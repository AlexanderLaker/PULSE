"""GNews API integration — curated quality news feed.

FREE tier: 100 req/day, perfect for daily trend monitoring.
Covers 40+ sources with focus on business, industry news.

Docs: https://gnews.io/
"""

import logging
import os
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime
import aiohttp

logger = logging.getLogger(__name__)


class GNewsClient:
    """Client for GNews API.

    High-quality curated news for FMCG, beauty, sustainability, regulation.
    Daily digest suitable for scheduled scans.
    """

    BASE_URL = "https://gnews.io/api/v4"
    DEFAULT_SOURCES = [
        "cosmeticsbusiness.com",
        "cosmeticsdesign-europe.com",
        "retaildive.com",
        "grocerydive.com",
        "packagingdive.com",
    ]

    def __init__(self, api_key: Optional[str] = None):
        """Initialize GNews client.

        Args:
            api_key: GNews API key. If None, reads from GNEWS_API_KEY env var.
        """
        self.api_key = api_key or os.getenv("GNEWS_API_KEY")
        if not self.api_key:
            logger.warning("GNews API key not set (GNEWS_API_KEY env var)")
        self.timeout = aiohttp.ClientTimeout(total=30)

    async def search(
        self,
        query: str,
        limit: int = 50,
        sort: str = "publishedAt",
    ) -> List[Dict[str, Any]]:
        """Search for articles matching query.

        Args:
            query: Search query (e.g., "sustainable beauty" or "detergent innovation")
            limit: Max articles to return (max 100)
            sort: Sort order ("publishedAt" or "relevance")

        Returns:
            List of article dictionaries
        """
        if not self.api_key:
            logger.warning("GNews: API key not configured")
            return []

        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            try:
                url = f"{self.BASE_URL}/search"
                params = {
                    "q": query,
                    "max": min(limit, 100),
                    "sortby": sort,
                    "apikey": self.api_key,
                }

                async with session.get(url, params=params) as response:
                    if response.status != 200:
                        logger.warning(f"GNews API error: {response.status}")
                        return []

                    data = await response.json()
                    articles = data.get("articles", [])

                    results = []
                    for article in articles[:limit]:
                        results.append({
                            "source": "GNews",
                            "title": article.get("title", ""),
                            "url": article.get("url", ""),
                            "published": article.get("publishedAt", ""),
                            "source_name": article.get("source", {}).get("name", ""),
                            "description": article.get("description", "")[:200],
                            "image": article.get("image", ""),
                        })

                    logger.info(f"GNews: fetched {len(results)} articles for '{query}'")
                    return results

            except asyncio.TimeoutError:
                logger.warning("GNews API timeout")
                return []
            except Exception as e:
                logger.error(f"GNews error: {e}")
                return []

    async def search_by_source(
        self,
        query: str,
        sources: Optional[List[str]] = None,
        limit: int = 50,
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Search by specific sources (e.g., CosmeticsDesign, RetailDive).

        Args:
            query: Search query
            sources: List of source names. If None, uses FMCG defaults.
            limit: Max per source

        Returns:
            Dictionary mapping source to articles
        """
        if not self.api_key:
            return {}

        if sources is None:
            sources = self.DEFAULT_SOURCES

        results = {}

        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            for source in sources:
                try:
                    url = f"{self.BASE_URL}/search"
                    params = {
                        "q": query,
                        "sources": source,
                        "max": min(limit, 100),
                        "apikey": self.api_key,
                    }

                    async with session.get(url, params=params) as response:
                        if response.status == 200:
                            data = await response.json()
                            articles = data.get("articles", [])

                            results[source] = [
                                {
                                    "title": article.get("title", ""),
                                    "url": article.get("url", ""),
                                    "published": article.get("publishedAt", ""),
                                    "description": article.get("description", "")[:200],
                                }
                                for article in articles[:limit]
                            ]

                except Exception as e:
                    logger.debug(f"GNews source {source} error: {e}")
                    results[source] = []

        return results

    async def get_top_stories(
        self,
        category: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Get top stories by category.

        Args:
            category: Category filter (business, technology, etc.). If None, all.
            limit: Max stories

        Returns:
            List of top stories
        """
        if not self.api_key:
            return []

        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            try:
                url = f"{self.BASE_URL}/top"
                params = {
                    "max": min(limit, 100),
                    "apikey": self.api_key,
                }

                if category:
                    params["category"] = category

                async with session.get(url, params=params) as response:
                    if response.status != 200:
                        return []

                    data = await response.json()
                    articles = data.get("articles", [])

                    return [
                        {
                            "title": article.get("title", ""),
                            "url": article.get("url", ""),
                            "published": article.get("publishedAt", ""),
                            "source_name": article.get("source", {}).get("name", ""),
                        }
                        for article in articles[:limit]
                    ]

            except Exception as e:
                logger.error(f"GNews top stories error: {e}")
                return []
