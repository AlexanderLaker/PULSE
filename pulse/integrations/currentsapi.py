"""CurrentsAPI integration — Real-time news with sentiment analysis.

FREE tier: 200 req/day, perfect for multiple topic monitoring.
Native sentiment scoring (positive/neutral/negative).

Docs: https://currentsapi.services/
"""

import logging
import os
import asyncio
from typing import List, Dict, Any, Optional
import aiohttp

logger = logging.getLogger(__name__)


class CurrentsAPIClient:
    """Client for CurrentsAPI.

    Real-time news with native sentiment analysis.
    Covers global sources, supports multiple languages.
    """

    BASE_URL = "https://api.currentsapi.services/v1"

    def __init__(self, api_key: Optional[str] = None):
        """Initialize CurrentsAPI client.

        Args:
            api_key: API key. If None, reads from CURRENTSAPI_KEY env var.
        """
        self.api_key = api_key or os.getenv("CURRENTSAPI_KEY")
        if not self.api_key:
            logger.warning("CurrentsAPI key not set (CURRENTSAPI_KEY env var)")
        self.timeout = aiohttp.ClientTimeout(total=30)

    async def search(
        self,
        query: str,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Search for articles matching query.

        Args:
            query: Search query
            limit: Max articles to return

        Returns:
            List of article dictionaries with sentiment
        """
        if not self.api_key:
            logger.warning("CurrentsAPI: API key not configured")
            return []

        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            try:
                url = f"{self.BASE_URL}/search"
                params = {
                    "keywords": query,
                    "limit": min(limit, 100),
                    "apikey": self.api_key,
                }

                async with session.get(url, params=params) as response:
                    if response.status != 200:
                        logger.warning(f"CurrentsAPI error: {response.status}")
                        return []

                    data = await response.json()
                    news = data.get("news", [])

                    results = []
                    for article in news[:limit]:
                        results.append({
                            "source": "CurrentsAPI",
                            "title": article.get("title", ""),
                            "url": article.get("url", ""),
                            "published": article.get("published", ""),
                            "source_name": article.get("source", ""),
                            "description": article.get("description", "")[:200],
                            "sentiment": article.get("sentiment", "neutral"),
                            "category": article.get("category", []),
                        })

                    logger.info(f"CurrentsAPI: fetched {len(results)} articles for '{query}'")
                    return results

            except asyncio.TimeoutError:
                logger.warning("CurrentsAPI timeout")
                return []
            except Exception as e:
                logger.error(f"CurrentsAPI error: {e}")
                return []

    async def search_by_category(
        self,
        category: str,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Search by news category.

        Args:
            category: Category (business, technology, health, etc.)
            limit: Max articles

        Returns:
            List of articles in category
        """
        if not self.api_key:
            return []

        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            try:
                url = f"{self.BASE_URL}/latest"
                params = {
                    "category": category,
                    "limit": min(limit, 100),
                    "apikey": self.api_key,
                }

                async with session.get(url, params=params) as response:
                    if response.status != 200:
                        return []

                    data = await response.json()
                    news = data.get("news", [])

                    return [
                        {
                            "title": article.get("title", ""),
                            "url": article.get("url", ""),
                            "published": article.get("published", ""),
                            "source": article.get("source", ""),
                            "sentiment": article.get("sentiment", "neutral"),
                        }
                        for article in news[:limit]
                    ]

            except Exception as e:
                logger.error(f"CurrentsAPI category search error: {e}")
                return []

    async def get_sentiment_summary(
        self,
        query: str,
        limit: int = 100,
    ) -> Dict[str, float]:
        """Get sentiment distribution for a query.

        Args:
            query: Search query
            limit: Max articles to analyze

        Returns:
            Dictionary with sentiment counts (positive, negative, neutral)
        """
        articles = await self.search(query, limit=limit)

        if not articles:
            return {"positive": 0, "negative": 0, "neutral": 0}

        sentiments = {"positive": 0, "negative": 0, "neutral": 0}
        for article in articles:
            sentiment = article.get("sentiment", "neutral").lower()
            if sentiment in sentiments:
                sentiments[sentiment] += 1

        # Convert to percentages
        total = sum(sentiments.values())
        if total > 0:
            sentiments = {k: v / total for k, v in sentiments.items()}

        return sentiments
