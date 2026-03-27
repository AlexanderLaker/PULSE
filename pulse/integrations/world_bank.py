"""World Bank API integration — macroeconomic indicators.

FREE API. Over 10,000 economic indicators including:
- GDP and growth rates
- Urbanization and demographics
- Water stress and environmental indicators
- Income and poverty
"""

import logging
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime
import aiohttp

logger = logging.getLogger(__name__)


class WorldBankClient:
    """Client for World Bank API.

    Tracks macro indicators affecting FMCG growth:
    - GDP growth (national, regional)
    - Urbanization rates
    - Water stress index
    - Environmental indicators
    - Income per capita
    - Population demographics
    """

    BASE_URL = "https://api.worldbank.org/v2"

    # Key indicators for FMCG analysis
    KEY_INDICATORS = {
        "gdp_growth": "NY.GDP.MKTP.KD.ZG",  # GDP growth (annual %)
        "gdp_per_capita": "NY.GDP.PCAP.CD",  # GDP per capita (current US$)
        "urbanization": "SP.URB.TOTL.IN.ZS",  # Urban population (% of total)
        "water_stress": "ER.H2O.FWTL.K3",  # Freshwater withdrawal (% of internal resources)
        "population": "SP.POP.TOTL",  # Total population
        "co2_emissions": "EN.ATM.CO2E.KT",  # CO2 emissions (kt)
    }

    def __init__(self):
        """Initialize World Bank client."""
        self.timeout = aiohttp.ClientTimeout(total=30)

    async def fetch_indicator(
        self,
        indicator_id: str,
        country_code: str = "US",
        years_back: int = 5,
    ) -> List[Dict[str, Any]]:
        """Fetch a specific economic indicator for a country.

        Args:
            indicator_id: World Bank indicator ID (e.g., "NY.GDP.MKTP.KD.ZG")
            country_code: ISO country code (default: US)
            years_back: How many years of history to fetch

        Returns:
            List of observations with year and value
        """
        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            try:
                # Get current year for calculation
                current_year = datetime.now().year
                start_year = current_year - years_back

                url = f"{self.BASE_URL}/country/{country_code}/indicator/{indicator_id}"
                params = {
                    "format": "json",
                    "date": f"{start_year}:{current_year}",
                    "per_page": 100,
                }

                async with session.get(url, params=params) as response:
                    if response.status != 200:
                        logger.warning(f"World Bank error: {response.status}")
                        return []

                    data = await response.json()

                    # Response is [metadata, [observations]]
                    if len(data) < 2:
                        return []

                    observations = data[1]
                    if not observations:
                        return []

                    results = []
                    for obs in observations:
                        value = obs.get("value")
                        if value is not None and value != "":
                            results.append({
                                "year": int(obs.get("date", 0)),
                                "value": float(value),
                                "country": country_code,
                            })

                    logger.info(f"World Bank: fetched {len(results)} observations for {indicator_id}")
                    return results

            except asyncio.TimeoutError:
                logger.warning("World Bank API timeout")
                return []
            except Exception as e:
                logger.error(f"World Bank error: {e}")
                return []

    async def fetch_key_indicators(
        self,
        country_code: str = "US",
        years_back: int = 5,
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Fetch all key FMCG-relevant indicators for a country.

        Args:
            country_code: ISO country code
            years_back: Years of history

        Returns:
            Dictionary mapping indicator name to time series
        """
        results = {}

        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            for name, indicator_id in self.KEY_INDICATORS.items():
                try:
                    obs = await self.fetch_indicator(
                        indicator_id,
                        country_code=country_code,
                        years_back=years_back,
                    )
                    results[name] = obs
                except Exception as e:
                    logger.debug(f"World Bank {name} error: {e}")
                    results[name] = []

        return results

    async def compare_countries(
        self,
        indicator_id: str,
        country_codes: List[str],
        years_back: int = 3,
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Compare an indicator across multiple countries.

        Args:
            indicator_id: Indicator to compare
            country_codes: List of ISO country codes
            years_back: Years of history

        Returns:
            Dictionary mapping country code to time series
        """
        results = {}

        for country in country_codes:
            try:
                obs = await self.fetch_indicator(
                    indicator_id,
                    country_code=country,
                    years_back=years_back,
                )
                results[country] = obs
            except Exception as e:
                logger.debug(f"Compare {country} error: {e}")
                results[country] = []

        return results

    async def fetch_regional_trends(
        self,
        region: str = "EAS",  # East Asia & Pacific
        indicator_id: str = "NY.GDP.MKTP.KD.ZG",
    ) -> List[Dict[str, Any]]:
        """Fetch indicator for an entire region.

        Args:
            region: World Bank region code (EAS, ECS, LCR, MNA, SAR, SSF)
            indicator_id: Indicator ID

        Returns:
            Time series for the region
        """
        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            try:
                url = f"{self.BASE_URL}/region/{region}/indicator/{indicator_id}"
                params = {
                    "format": "json",
                    "per_page": 100,
                }

                async with session.get(url, params=params) as response:
                    if response.status != 200:
                        return []

                    data = await response.json()
                    if len(data) < 2:
                        return []

                    observations = data[1]
                    results = []

                    for obs in observations:
                        value = obs.get("value")
                        if value is not None and value != "":
                            results.append({
                                "year": int(obs.get("date", 0)),
                                "value": float(value),
                                "region": region,
                            })

                    return results

            except Exception as e:
                logger.error(f"Regional trends error: {e}")
                return []
