"""Open-Meteo integration — climate and weather data.

FREE API, no key required. Weather and climate data for seasonal demand modeling.
Useful for insecticide, sunscreen, water usage patterns.
"""

import logging
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import aiohttp

logger = logging.getLogger(__name__)


class OpenMeteoClient:
    """Client for Open-Meteo weather/climate API.

    Tracks weather patterns affecting FMCG demand:
    - Temperature (sunscreen, seasonal skincare demand)
    - Precipitation (water availability, detergent usage)
    - UV index (sunscreen demand)
    - Humidity (cosmetics performance claims)
    """

    BASE_URL = "https://api.open-meteo.com/v1"

    def __init__(self):
        """Initialize Open-Meteo client."""
        self.timeout = aiohttp.ClientTimeout(total=30)

    async def fetch_weather(
        self,
        latitude: float,
        longitude: float,
        days_back: int = 30,
    ) -> Dict[str, Any]:
        """Fetch historical weather data for a location.

        Args:
            latitude: Location latitude
            longitude: Location longitude
            days_back: Historical period

        Returns:
            Weather data with temperature, precipitation, etc.
        """
        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            try:
                start_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")
                end_date = datetime.now().strftime("%Y-%m-%d")

                url = f"{self.BASE_URL}/archive"
                params = {
                    "latitude": latitude,
                    "longitude": longitude,
                    "start_date": start_date,
                    "end_date": end_date,
                    "hourly": "temperature_2m,precipitation,weather_code,uv_index",
                    "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,uv_index_max",
                    "timezone": "auto",
                }

                async with session.get(url, params=params) as response:
                    if response.status != 200:
                        logger.warning(f"Open-Meteo error: {response.status}")
                        return {}

                    data = await response.json()
                    logger.info(f"Open-Meteo: fetched weather for ({latitude}, {longitude})")
                    return data

            except asyncio.TimeoutError:
                logger.warning("Open-Meteo timeout")
                return {}
            except Exception as e:
                logger.error(f"Open-Meteo error: {e}")
                return {}

    async def fetch_climate_normals(
        self,
        latitude: float,
        longitude: float,
    ) -> Dict[str, Any]:
        """Fetch climate normals (30-year averages) for a location.

        Args:
            latitude: Location latitude
            longitude: Location longitude

        Returns:
            Climate normal data
        """
        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            try:
                url = f"{self.BASE_URL}/climate"
                params = {
                    "latitude": latitude,
                    "longitude": longitude,
                    "monthly": "temperature_2m_max,temperature_2m_min,precipitation_sum",
                }

                async with session.get(url, params=params) as response:
                    if response.status != 200:
                        return {}

                    data = await response.json()
                    logger.info("Open-Meteo: fetched climate normals")
                    return data

            except Exception as e:
                logger.error(f"Climate normals error: {e}")
                return {}

    async def analyze_seasonal_demand(
        self,
        latitude: float,
        longitude: float,
        product_category: str = "skincare",
    ) -> Dict[str, Any]:
        """Analyze seasonal demand pattern for a product based on climate.

        Args:
            latitude: Location latitude
            longitude: Location longitude
            product_category: Product type (sunscreen, moisturizer, detergent, insecticide)

        Returns:
            Seasonal analysis with demand predictions
        """
        climate = await self.fetch_climate_normals(latitude, longitude)

        if not climate:
            return {}

        # Simple seasonal analysis based on temperature
        monthly_data = climate.get("monthly", {})
        temps = monthly_data.get("temperature_2m_max", [])

        if not temps:
            return {}

        # Demand patterns (highly simplified)
        seasonal_demand = {
            "sunscreen": self._seasonal_sunscreen(temps),
            "moisturizer": self._seasonal_moisturizer(temps),
            "detergent": self._seasonal_detergent(monthly_data.get("precipitation_sum", [])),
            "insecticide": self._seasonal_insecticide(temps),
        }

        return {
            "location": (latitude, longitude),
            "category": product_category,
            "seasonal_pattern": seasonal_demand.get(product_category, {}),
        }

    def _seasonal_sunscreen(self, monthly_temps: List[float]) -> Dict[str, float]:
        """Estimate sunscreen demand seasonality based on temperature.

        Higher temps → higher demand.
        """
        return {
            "month": list(range(1, 13)),
            "demand_index": [temp / 35.0 for temp in monthly_temps],  # Normalize to 0-1
        }

    def _seasonal_moisturizer(self, monthly_temps: List[float]) -> Dict[str, float]:
        """Moisturizer demand inverse to temperature (higher in cold months)."""
        return {
            "month": list(range(1, 13)),
            "demand_index": [1 - (temp / 35.0) for temp in monthly_temps],
        }

    def _seasonal_detergent(self, monthly_precip: List[float]) -> Dict[str, float]:
        """Detergent demand somewhat correlated with rain/washing patterns."""
        max_precip = max(monthly_precip) if monthly_precip else 1.0
        return {
            "month": list(range(1, 13)),
            "demand_index": [p / max_precip if max_precip > 0 else 0.5 for p in monthly_precip],
        }

    def _seasonal_insecticide(self, monthly_temps: List[float]) -> Dict[str, float]:
        """Insecticide demand peaks in warm months."""
        return {
            "month": list(range(1, 13)),
            "demand_index": [(temp / 35.0) ** 2 for temp in monthly_temps],  # Quadratic for stronger seasonality
        }
