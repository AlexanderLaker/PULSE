"""GDELT Project integration — Global Event, Language & Tone database.

FREE API, no key required. Covers 200+ countries, 40+ languages, near real-time.
Primary source for event volume baseline and sentiment trends.

API: https://api.gdeltproject.org/api/v2/
"""

import logging
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import aiohttp

logger = logging.getLogger(__name__)


class GDELTClient:
    """Client for GDELT Project API.

    Fetches global news events with sentiment, impact, and tone metrics.
    Primary use: baseline event volume and sentiment trends for market forces.
    """

    BASE_URL = "https://api.gdeltproject.org/api/v2"

    def __init__(self):
        """Initialize GDELT client."""
        self.timeout = aiohttp.ClientTimeout(total=30)

    async def fetch_articles(
        self,
        query: str,
        limit: int = 100,
        days_back: int = 7,
    ) -> List[Dict[str, Any]]:
        """Fetch articles matching query from GDELT.

        Args:
            query: Search query (e.g., "beauty innovation" or "EU regulation detergent")
            limit: Max number of articles to return
            days_back: Look back this many days (default 7)

        Returns:
            List of article dictionaries with title, source, tone, etc.
        """
        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            try:
                # Build GDELT query
                start_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y%m%d")
                end_date = datetime.now().strftime("%Y%m%d")

                # GDELT Search API
                url = f"{self.BASE_URL}/doc/doc"
                params = {
                    "query": query,
                    "startdatetime": f"{start_date}000000",
                    "enddatetime": f"{end_date}235959",
                    "maxrecords": limit,
                    "format": "json",
                }

                async with session.get(url, params=params) as response:
                    if response.status != 200:
                        logger.warning(f"GDELT API error: {response.status}")
                        return []

                    data = await response.json()
                    articles = data.get("articles", [])

                    # Normalize to PULSE format
                    results = []
                    for article in articles[:limit]:
                        results.append({
                            "source": "GDELT",
                            "title": article.get("title", ""),
                            "url": article.get("url", ""),
                            "published": article.get("publishdate", ""),
                            "source_name": article.get("sourcecountry", ""),
                            "tone": self._extract_tone(article.get("tone", 0)),
                            "relevance": article.get("seodescription", "")[:100],
                        })

                    logger.info(f"GDELT: fetched {len(results)} articles for '{query}'")
                    return results

            except asyncio.TimeoutError:
                logger.warning("GDELT API timeout")
                return []
            except Exception as e:
                logger.error(f"GDELT error: {e}")
                return []

    async def fetch_sentiment_timeline(
        self,
        query: str,
        days_back: int = 30,
    ) -> Dict[str, float]:
        """Fetch sentiment timeline for a query.

        Args:
            query: Search query
            days_back: Number of days to look back

        Returns:
            Dictionary mapping date (YYYY-MM-DD) to average sentiment score
        """
        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            try:
                start_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y%m%d")
                end_date = datetime.now().strftime("%Y%m%d")

                url = f"{self.BASE_URL}/doc/doc"
                params = {
                    "query": query,
                    "startdatetime": f"{start_date}000000",
                    "enddatetime": f"{end_date}235959",
                    "timelinesmooth": 1,
                    "format": "json",
                }

                async with session.get(url, params=params) as response:
                    if response.status != 200:
                        return {}

                    data = await response.json()
                    timeline = data.get("timeline", [])

                    # Convert to date-keyed dictionary
                    sentiment_timeline = {}
                    for entry in timeline:
                        date_str = entry.get("date", "")
                        if date_str:
                            tone = self._extract_tone(entry.get("tone", 0))
                            # Format YYYYMMDD to YYYY-MM-DD
                            date_obj = datetime.strptime(date_str[:8], "%Y%m%d")
                            sentiment_timeline[date_obj.strftime("%Y-%m-%d")] = tone

                    return sentiment_timeline

            except Exception as e:
                logger.error(f"GDELT sentiment timeline error: {e}")
                return {}

    async def fetch_themes(
        self,
        query: str,
        limit: int = 10,
        days_back: int = 7,
    ) -> List[Dict[str, Any]]:
        """Fetch GDELT themes (topics) for a query.

        Themes are GDELT's semantic categorization of events.

        Args:
            query: Search query
            limit: Max themes to return
            days_back: Look back period

        Returns:
            List of theme dictionaries
        """
        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            try:
                start_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y%m%d")
                end_date = datetime.now().strftime("%Y%m%d")

                url = f"{self.BASE_URL}/doc/doc"
                params = {
                    "query": query,
                    "mode": "timelinecomp",
                    "startdatetime": f"{start_date}000000",
                    "enddatetime": f"{end_date}235959",
                    "maxrecords": limit,
                    "format": "json",
                }

                async with session.get(url, params=params) as response:
                    if response.status != 200:
                        return []

                    data = await response.json()
                    values = data.get("values", [])

                    # Normalize
                    results = []
                    for theme in values[:limit]:
                        results.append({
                            "theme": theme.get("name", ""),
                            "count": theme.get("value", 0),
                            "frequency": "Rising" if theme.get("value", 0) > 0 else "Stable",
                        })

                    return results

            except Exception as e:
                logger.error(f"GDELT themes error: {e}")
                return []

    def _extract_tone(self, tone_value: Any) -> str:
        """Convert GDELT tone score (-10 to +10) to qualitative label.

        Args:
            tone_value: Numeric tone value from GDELT

        Returns:
            Qualitative tone label (Positive, Neutral, Negative, etc.)
        """
        try:
            tone = float(tone_value)
            if tone > 2:
                return "Positive"
            elif tone < -2:
                return "Negative"
            else:
                return "Neutral"
        except (ValueError, TypeError):
            return "Unknown"
