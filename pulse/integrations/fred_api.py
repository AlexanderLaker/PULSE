"""FRED API integration — Federal Reserve Economic Data.

FREE API, no key required. Over 400,000 economic time series.
Key series: Commodity prices, PPI by sector, employment, etc.

Docs: https://fred.stlouisfed.org/docs/api/
"""

import logging
import os
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import aiohttp

logger = logging.getLogger(__name__)


class FREDClient:
    """Client for FRED API.

    Tracks macroeconomic indicators affecting FMCG demand:
    - Commodity prices (palm oil, crude oil)
    - Producer Price Index (detergent, cosmetics)
    - Consumer price index
    - Employment and income
    """

    BASE_URL = "https://api.stlouisfed.org/fred"

    # Key series IDs for FMCG analysis
    KEY_SERIES = {
        "palm_oil": "PALMOILD",  # Palm Oil Price
        "crude_oil": "WTEXCUSD",  # Crude Oil Price
        "ppi_detergent": "WPS02452",  # PPI: Soap & Detergents
        "ppi_cosmetics": "WPS054400",  # PPI: Cosmetics & Toiletries
        "cpi_personal_care": "CPIAASL",  # CPI: Personal Care
        "employment": "PAYEMS",  # Total Nonfarm Payroll
        "real_income": "REALINCMEASX",  # Real Income
        "water_usage": "WATRCONWUS",  # Water Consumption
    }

    def __init__(self, api_key: Optional[str] = None):
        """Initialize FRED client.

        Args:
            api_key: FRED API key. If None, reads from FRED_API_KEY env var.
        """
        self.api_key = api_key or os.getenv("FRED_API_KEY")
        if not self.api_key:
            logger.warning("FRED API key not set (FRED_API_KEY env var)")
        self.timeout = aiohttp.ClientTimeout(total=30)

    async def fetch_series(
        self,
        series_id: str,
        days_back: int = 365,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Fetch time series data from FRED.

        Args:
            series_id: FRED series ID (e.g., "PALMOILD")
            days_back: Look back period in days
            limit: Max data points

        Returns:
            List of observations with date and value
        """
        if not self.api_key:
            logger.warning("FRED: API key not configured")
            return []

        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            try:
                url = f"{self.BASE_URL}/series/observations"
                start_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")

                params = {
                    "series_id": series_id,
                    "api_key": self.api_key,
                    "file_type": "json",
                    "limit": limit,
                    "observation_start": start_date,
                }

                async with session.get(url, params=params) as response:
                    if response.status != 200:
                        logger.warning(f"FRED error: {response.status} for {series_id}")
                        return []

                    data = await response.json()
                    observations = data.get("observations", [])

                    results = []
                    for obs in observations:
                        value = obs.get("value")
                        # FRED uses "." for missing values
                        if value and value != ".":
                            results.append({
                                "date": obs.get("date"),
                                "value": float(value),
                            })

                    logger.info(f"FRED: fetched {len(results)} observations for {series_id}")
                    return results

            except asyncio.TimeoutError:
                logger.warning("FRED API timeout")
                return []
            except Exception as e:
                logger.error(f"FRED error: {e}")
                return []

    async def fetch_key_indicators(
        self,
        days_back: int = 365,
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Fetch all key FMCG-relevant indicators.

        Args:
            days_back: Look back period

        Returns:
            Dictionary mapping indicator name to time series
        """
        results = {}

        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            for name, series_id in self.KEY_SERIES.items():
                try:
                    observations = await self.fetch_series(series_id, days_back=days_back)
                    results[name] = observations
                except Exception as e:
                    logger.debug(f"FRED {name} error: {e}")
                    results[name] = []

        return results

    async def calculate_trend(
        self,
        series_id: str,
        days_back: int = 365,
    ) -> Optional[Dict[str, Any]]:
        """Calculate trend for a series (direction, velocity, acceleration).

        Args:
            series_id: FRED series ID
            days_back: Look back period

        Returns:
            Dictionary with trend metrics or None if insufficient data
        """
        observations = await self.fetch_series(series_id, days_back=days_back)

        if len(observations) < 3:
            return None

        # Most recent and oldest values
        latest = observations[-1]["value"]
        oldest = observations[0]["value"]

        # Calculate direction and velocity
        change = latest - oldest
        pct_change = (change / oldest * 100) if oldest != 0 else 0

        return {
            "series_id": series_id,
            "latest_value": latest,
            "oldest_value": oldest,
            "absolute_change": change,
            "percent_change": pct_change,
            "direction": "Up" if change > 0 else "Down",
            "volatility": self._calculate_volatility(observations),
        }

    def _calculate_volatility(self, observations: List[Dict[str, float]]) -> float:
        """Calculate simple volatility (std dev) of values.

        Args:
            observations: List of {date, value} observations

        Returns:
            Volatility score (0-1 range approximate)
        """
        if len(observations) < 2:
            return 0.0

        values = [obs["value"] for obs in observations]
        mean = sum(values) / len(values)

        variance = sum((v - mean) ** 2 for v in values) / len(values)
        std_dev = variance ** 0.5

        # Normalize by mean to get coefficient of variation
        if mean != 0:
            return min(std_dev / abs(mean), 1.0)
        return 0.0
