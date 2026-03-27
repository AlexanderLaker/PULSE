"""
BeautyFeeds.io API Integration Module

Provides real-time beauty market data including product pricing, ratings, availability,
and emerging trend signals relevant to PULSE hair care and LHC categories.

API Documentation: https://docs.beautyfeeds.io/
"""

import os
import logging
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
import requests
from requests.exceptions import RequestException, Timeout, ConnectionError

logger = logging.getLogger(__name__)


class BeautyFeedsClient:
    """Client for BeautyFeeds.io API integration."""

    BASE_URL = "https://api.beautyfeeds.io/v1"
    DEFAULT_TIMEOUT = 10
    DEFAULT_PAGE_SIZE = 50

    # Mapping BeautyFeeds categories to PULSE categories
    CATEGORY_MAPPING = {
        "hair_color": "Hair: Color",
        "hair_care": "Hair: Care",
        "hair_styling": "Hair: Styling",
        "body_care": "Hair: Body",
        "face_care": "Hair: Care",  # May apply
        "deodorant": "Hair: Body",
    }

    # Mapping BeautyFeeds insights to PULSE forces
    FORCE_MAPPING = {
        "consumer_demand": "Consumer",
        "pricing_trend": "Customer",
        "innovation": "Technology",
        "sustainability": "Environmental",
        "regulatory": "Government",
        "competitive_action": "Competitive",
    }

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize BeautyFeedsClient.

        Args:
            api_key: API key for BeautyFeeds. If None, reads from BEAUTYFEEDS_API_KEY env var.
        """
        self.api_key = api_key or os.environ.get("BEAUTYFEEDS_API_KEY")
        if not self.api_key:
            logger.warning("BeautyFeeds API key not provided and BEAUTYFEEDS_API_KEY not set")
        self.session = requests.Session()
        self.session.headers.update({"Authorization": f"Bearer {self.api_key}"})

    def _make_request(
        self,
        endpoint: str,
        method: str = "GET",
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Make HTTP request to BeautyFeeds API.

        Args:
            endpoint: API endpoint (relative to BASE_URL)
            method: HTTP method (GET, POST, etc.)
            params: Query parameters
            json_data: JSON body for POST/PUT requests

        Returns:
            Response JSON or None on error.
        """
        url = f"{self.BASE_URL}/{endpoint}"
        try:
            response = self.session.request(
                method=method,
                url=url,
                params=params,
                json=json_data,
                timeout=self.DEFAULT_TIMEOUT,
            )
            response.raise_for_status()
            return response.json()
        except Timeout:
            logger.error(f"BeautyFeeds request timeout: {endpoint}")
            return None
        except ConnectionError as e:
            logger.error(f"BeautyFeeds connection error: {e}")
            return None
        except RequestException as e:
            logger.error(f"BeautyFeeds request error on {endpoint}: {e}")
            return None
        except ValueError as e:
            logger.error(f"BeautyFeeds response parsing error: {e}")
            return None

    def search_products(
        self,
        query: str,
        category: Optional[str] = None,
        brand: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """
        Search for beauty products.

        Args:
            query: Search query (e.g., "color-safe shampoo", "sustainable deodorant")
            category: Filter by category (e.g., "hair_care", "body_care")
            brand: Filter by brand
            limit: Max results (default 50)

        Returns:
            List of product results, empty list on error.
        """
        params = {"q": query, "limit": min(limit, 100)}
        if category:
            params["category"] = category
        if brand:
            params["brand"] = brand

        result = self._make_request("products/search", params=params)
        if result and "products" in result:
            return result["products"]
        logger.warning(f"BeautyFeeds search_products returned no results for '{query}'")
        return []

    def get_price_trends(
        self,
        product_category: str,
        market: str = "DE",
        days: int = 90,
    ) -> Dict[str, Any]:
        """
        Get price trend data for a product category.

        Args:
            product_category: PULSE-style category (e.g., "Hair: Color", "Hair: Care")
            market: Market code (DE, FR, UK, IT, etc.)
            days: Lookback period in days (default 90)

        Returns:
            Dict with price trend analysis, empty dict on error.
        """
        # Map PULSE category to BeautyFeeds category
        bf_category = None
        for bf_cat, pulse_cat in self.CATEGORY_MAPPING.items():
            if pulse_cat == product_category:
                bf_category = bf_cat
                break

        if not bf_category:
            logger.warning(f"Unknown category mapping: {product_category}")
            return {}

        params = {
            "category": bf_category,
            "market": market,
            "days": days,
        }

        result = self._make_request("pricing/trends", params=params)
        if result:
            return result
        logger.warning(f"BeautyFeeds get_price_trends returned no data")
        return {}

    def get_market_intelligence(self, category: str) -> Dict[str, Any]:
        """
        Get market-level intelligence for a category.

        Args:
            category: PULSE-style category

        Returns:
            Dict with market data (size, growth, leading brands), empty dict on error.
        """
        # Map PULSE category to BeautyFeeds category
        bf_category = None
        for bf_cat, pulse_cat in self.CATEGORY_MAPPING.items():
            if pulse_cat == category:
                bf_category = bf_cat
                break

        if not bf_category:
            logger.warning(f"Unknown category mapping: {category}")
            return {}

        result = self._make_request(f"market/intelligence/{bf_category}")
        if result:
            return result
        logger.warning(f"BeautyFeeds get_market_intelligence returned no data for {category}")
        return {}

    def scan_for_trends(self, categories: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """
        Scan BeautyFeeds for emerging trends relevant to PULSE categories.

        Args:
            categories: List of PULSE categories to scan (e.g., ["Hair: Color", "Hair: Care"]).
                       If None, scan all mapped categories.

        Returns:
            List of trend dicts in PULSE format, empty list on error.
        """
        if not self.api_key:
            logger.warning("BeautyFeeds API key not configured, skipping scan")
            return []

        # Default to all PULSE-mapped categories if not specified
        if not categories:
            categories = list(set(self.CATEGORY_MAPPING.values()))

        trends = []

        # Scan for emerging trends endpoint
        result = self._make_request("trends/emerging", params={"limit": 20})
        if not result or "trends" not in result:
            logger.warning("BeautyFeeds scan_for_trends returned no data")
            return []

        for idx, trend_data in enumerate(result.get("trends", [])):
            try:
                # Extract category relevance
                category_mapping = {}
                for affected_category in trend_data.get("affected_categories", []):
                    pulse_category = self.CATEGORY_MAPPING.get(
                        affected_category.lower(), None
                    )
                    if pulse_category:
                        category_mapping[pulse_category] = 4  # High relevance default

                if not category_mapping:
                    continue  # Skip trends not relevant to PULSE categories

                # Map to PULSE force
                signal_type = trend_data.get("signal_type", "consumer_demand").lower()
                pulse_force = self.FORCE_MAPPING.get(signal_type, "Consumer")

                # Infer direction from trend
                momentum = trend_data.get("momentum", "neutral")
                direction = "Expansion" if momentum in ["positive", "accelerating"] else "Contraction"

                # Calculate impact/probability from available signals
                relevance_score = trend_data.get("relevance_score", 50)  # 0-100
                suggested_impact = min(5, max(1, int((relevance_score / 20))))
                suggested_probability = min(5, max(1, int(trend_data.get("adoption_pace", 2))))

                trend_dict = {
                    "id": f"beautyfeeds_{trend_data.get('id', idx)}",
                    "name": trend_data.get("name", f"Unknown trend {idx}"),
                    "description": trend_data.get("description", ""),
                    "force": pulse_force,
                    "suggested_impact": suggested_impact,
                    "suggested_probability": suggested_probability,
                    "direction": direction,
                    "relevance_score": relevance_score,
                    "category_mapping": category_mapping,
                    "sources": [
                        {
                            "name": "BeautyFeeds.io",
                            "api": "beautyfeeds",
                            "url": trend_data.get("source_url", "https://beautyfeeds.io"),
                        }
                    ],
                    "ai_reasoning": (
                        f"BeautyFeeds detected {trend_data.get('signal_type', 'consumer trend')} "
                        f"in {', '.join(category_mapping.keys())} with "
                        f"{momentum} momentum and {relevance_score}% relevance."
                    ),
                    "detected_date": datetime.utcnow().isoformat(),
                    "confidence": self._score_to_confidence(trend_data.get("confidence_score", 0.5)),
                }
                trends.append(trend_dict)
            except (KeyError, ValueError) as e:
                logger.warning(f"Error processing BeautyFeeds trend: {e}")
                continue

        logger.info(f"BeautyFeeds scan_for_trends detected {len(trends)} relevant trends")
        return trends

    @staticmethod
    def _score_to_confidence(score: float) -> str:
        """Convert numeric confidence score (0-1) to string confidence level."""
        if score >= 0.75:
            return "High"
        elif score >= 0.5:
            return "Medium"
        else:
            return "Low"

    def close(self):
        """Close the session."""
        if self.session:
            self.session.close()

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()
