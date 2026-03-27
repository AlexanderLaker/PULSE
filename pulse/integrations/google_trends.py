"""Google Trends integration — consumer search behavior.

FREE API via pytrends (unofficial). No key required.
Honest signal of consumer intent and emerging interest.

Docs: https://github.com/GeneralMills/pytrends
"""

import logging
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

try:
    from pytrends.request import TrendReq
except ImportError:
    TrendReq = None
    logger.warning("pytrends not installed. Install with: pip install pytrends")


class GoogleTrendsClient:
    """Client for Google Trends.

    Tracks search volume trends for FMCG topics:
    - Natural/clean beauty keywords
    - Sustainable product terms
    - Specific product categories
    - Regional interest variations
    """

    def __init__(self, hl: str = "en-US", tz: int = -360):
        """Initialize Google Trends client.

        Args:
            hl: Language/region (e.g., "en-US")
            tz: Timezone offset in minutes
        """
        if TrendReq is None:
            logger.warning("Google Trends client initialized but pytrends not available")
            self.pytrends = None
        else:
            self.pytrends = TrendReq(hl=hl, tz=tz)

    async def fetch_interest(
        self,
        keywords: List[str],
        timeframe: str = "today 1-m",
    ) -> Dict[str, Any]:
        """Fetch interest over time for keywords.

        Args:
            keywords: List of search terms (max 5)
            timeframe: Google Trends timeframe (default: "today 1-m" = last month)
                      Other: "today 3-m", "today 1-y", "2004-01-01 2025-03-26"

        Returns:
            Dictionary with interest timeline and related keywords
        """
        if not self.pytrends:
            logger.warning("Google Trends: pytrends not available")
            return {}

        try:
            # Google Trends API call is synchronous, run in thread pool
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                self._fetch_interest_sync,
                keywords,
                timeframe,
            )
            return result

        except Exception as e:
            logger.error(f"Google Trends error: {e}")
            return {}

    def _fetch_interest_sync(
        self,
        keywords: List[str],
        timeframe: str,
    ) -> Dict[str, Any]:
        """Synchronous version of fetch_interest.

        Args:
            keywords: List of search terms
            timeframe: Timeframe string

        Returns:
            Dictionary with interest data
        """
        try:
            # Ensure we have max 5 keywords for GT API
            keywords = keywords[:5]

            self.pytrends.build_payload(keywords, timeframe=timeframe)

            # Get interest over time
            interest_df = self.pytrends.interest_over_time()

            # Get related queries
            related_queries = self.pytrends.related_queries()

            # Get related topics
            related_topics = self.pytrends.related_topics()

            # Convert to dict
            result = {
                "keywords": keywords,
                "timeframe": timeframe,
                "interest_timeline": self._convert_dataframe(interest_df),
                "related_queries": related_queries,
                "related_topics": related_topics,
            }

            logger.info(f"Google Trends: fetched interest for {len(keywords)} keywords")
            return result

        except Exception as e:
            logger.error(f"Google Trends sync error: {e}")
            return {}

    async def fetch_trending_searches(
        self,
        country: str = "US",
    ) -> List[Dict[str, Any]]:
        """Fetch real-time trending searches in a country.

        Args:
            country: Two-letter country code (US, GB, DE, etc.)

        Returns:
            List of trending search terms
        """
        if not self.pytrends:
            return []

        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                self._fetch_trending_sync,
                country,
            )
            return result

        except Exception as e:
            logger.error(f"Google Trends trending error: {e}")
            return []

    def _fetch_trending_sync(self, country: str) -> List[Dict[str, Any]]:
        """Synchronous trending searches fetch."""
        try:
            trending_df = self.pytrends.trending_searches(pn=country)

            results = [
                {
                    "rank": idx + 1,
                    "term": row[0],
                    "query_volume": "High",  # GT doesn't provide actual volume
                }
                for idx, row in enumerate(trending_df.head(10).itertuples())
            ]

            return results

        except Exception as e:
            logger.debug(f"Trending searches error: {e}")
            return []

    async def category_comparison(
        self,
        keywords: List[str],
        timeframe: str = "today 1-m",
    ) -> Dict[str, float]:
        """Compare search volume across keywords (relative).

        Args:
            keywords: List of keywords to compare
            timeframe: Timeframe

        Returns:
            Dictionary with relative search volume (0-100 scale)
        """
        if not self.pytrends:
            return {}

        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                self._compare_sync,
                keywords,
                timeframe,
            )
            return result

        except Exception as e:
            logger.error(f"Category comparison error: {e}")
            return {}

    def _compare_sync(
        self,
        keywords: List[str],
        timeframe: str,
    ) -> Dict[str, float]:
        """Synchronous comparison."""
        try:
            keywords = keywords[:5]
            self.pytrends.build_payload(keywords, timeframe=timeframe)

            interest_df = self.pytrends.interest_over_time()

            # Get latest values
            latest_values = interest_df.iloc[-1]

            result = {
                kw: float(latest_values.get(kw, 0))
                for kw in keywords
            }

            return result

        except Exception as e:
            logger.debug(f"Compare sync error: {e}")
            return {}

    def _convert_dataframe(self, df) -> List[Dict[str, Any]]:
        """Convert pandas DataFrame to list of dicts.

        Args:
            df: DataFrame from pytrends

        Returns:
            List of dictionaries
        """
        try:
            result = []
            for idx, row in enumerate(df.itertuples()):
                entry = {
                    "date": str(row[0]),
                    "values": {}
                }
                # Skip the date column (index 0)
                for col_idx, col_name in enumerate(df.columns):
                    entry["values"][col_name] = float(row[col_idx + 1])
                result.append(entry)
            return result
        except Exception as e:
            logger.debug(f"DataFrame conversion error: {e}")
            return []
