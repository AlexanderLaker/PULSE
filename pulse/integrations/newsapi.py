"""
NewsAPI.org Integration Module

Provides access to news content for real-time market intelligence and trend detection
across FMCG, beauty, cleaning, and regulatory domains.

API Documentation: https://newsapi.org/docs
"""

import os
import logging
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
import requests
from requests.exceptions import RequestException, Timeout, ConnectionError

logger = logging.getLogger(__name__)


class NewsAPIClient:
    """Client for NewsAPI.org integration."""

    BASE_URL = "https://newsapi.org/v2"
    DEFAULT_TIMEOUT = 10

    # Pre-configured FMCG/beauty/cleaning relevant search terms
    FMCG_QUERIES = {
        "hair_care": "hair care innovation OR hair color technology OR salon industry OR Schwarzkopf OR L'Oreal hair",
        "laundry": "laundry detergent OR washing powder OR cleaning products OR home care OR sustainable packaging OR Persil OR Tide",
        "competitive": "P&G beauty OR Unilever home care OR Reckitt cleaning OR Henkel consumer OR beauty market",
        "regulatory": "EU cosmetics regulation OR REACH chemicals OR microplastics ban OR environmental regulation",
        "innovation": "beauty innovation OR sustainable formulation OR green chemistry OR biodegradable",
        "consumer_trends": "consumer preferences beauty OR clean beauty movement OR natural products OR sustainable living",
    }

    # Mapping news categories to PULSE forces
    FORCE_MAPPING = {
        "hair_care": "Consumer",
        "laundry": "Customer",
        "competitive": "Competitive",
        "regulatory": "Government",
        "innovation": "Technology",
        "consumer_trends": "Consumer",
    }

    # Mapping to PULSE categories
    CATEGORY_MAPPING = {
        "hair_care": ["Hair: Color", "Hair: Care", "Hair: Styling"],
        "laundry": ["LHC: FCN", "LHC: FCA"],
        "competitive": ["Hair: Color", "Hair: Care", "LHC: FCN"],
        "regulatory": ["Hair: Color", "Hair: Care", "LHC: FCN"],
        "innovation": ["Hair: Care", "Hair: Color", "LHC: FCN"],
        "consumer_trends": ["Hair: Care", "Hair: Color", "Hair: Body"],
    }

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize NewsAPIClient.

        Args:
            api_key: API key for NewsAPI. If None, reads from NEWSAPI_API_KEY env var.
        """
        self.api_key = api_key or os.environ.get("NEWSAPI_API_KEY")
        if not self.api_key:
            logger.warning("NewsAPI key not provided and NEWSAPI_API_KEY not set")
        self.session = requests.Session()

    def _make_request(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Make HTTP request to NewsAPI.

        Args:
            endpoint: API endpoint (relative to BASE_URL)
            params: Query parameters

        Returns:
            Response JSON or None on error.
        """
        url = f"{self.BASE_URL}/{endpoint}"
        if params is None:
            params = {}

        # Add API key to all requests
        if self.api_key:
            params["apiKey"] = self.api_key

        try:
            response = self.session.get(url, params=params, timeout=self.DEFAULT_TIMEOUT)
            response.raise_for_status()
            return response.json()
        except Timeout:
            logger.error(f"NewsAPI request timeout: {endpoint}")
            return None
        except ConnectionError as e:
            logger.error(f"NewsAPI connection error: {e}")
            return None
        except RequestException as e:
            logger.error(f"NewsAPI request error on {endpoint}: {e}")
            return None
        except ValueError as e:
            logger.error(f"NewsAPI response parsing error: {e}")
            return None

    def get_top_headlines(
        self,
        query: Optional[str] = None,
        category: str = "business",
        country: str = "de",
        page_size: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Get top headlines by category or search query.

        Args:
            query: Optional search query. If provided, category and country are ignored.
            category: Category code (e.g., "business", "technology", "health")
            country: Country code (e.g., "de", "us", "gb")
            page_size: Number of results (default 20, max 100)

        Returns:
            List of headline dicts, empty list on error.
        """
        params = {"pageSize": min(page_size, 100)}

        if query:
            params["q"] = query
        else:
            params["category"] = category
            params["country"] = country

        result = self._make_request("top-headlines", params=params)
        if not result or "articles" not in result:
            logger.warning(
                f"NewsAPI get_top_headlines returned no results "
                f"(query={query}, category={category}, country={country})"
            )
            return []

        articles = []
        for article in result.get("articles", []):
            try:
                articles.append({
                    "title": article.get("title", "Unknown"),
                    "description": article.get("description", ""),
                    "source": article.get("source", {}).get("name", "Unknown"),
                    "url": article.get("url", ""),
                    "published_at": article.get("publishedAt", ""),
                    "image": article.get("urlToImage", ""),
                    "content": article.get("content", "")[:500],  # Truncate for storage
                })
            except (KeyError, ValueError) as e:
                logger.warning(f"Error processing NewsAPI article: {e}")
                continue

        logger.info(f"NewsAPI get_top_headlines found {len(articles)} articles")
        return articles

    def search_everything(
        self,
        query: str,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        sort_by: str = "relevancy",
        page_size: int = 50,
    ) -> List[Dict[str, Any]]:
        """
        Search all news articles by keyword.

        Args:
            query: Search query (e.g., "microplastics cosmetics")
            from_date: Start date (YYYY-MM-DD format). Default: 30 days ago.
            to_date: End date (YYYY-MM-DD format). Default: today.
            sort_by: Sort order ("relevancy", "popularity", "publishedAt")
            page_size: Number of results (default 50, max 100)

        Returns:
            List of article dicts, empty list on error.
        """
        if not from_date:
            from_date = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
        if not to_date:
            to_date = datetime.utcnow().strftime("%Y-%m-%d")

        params = {
            "q": query,
            "from": from_date,
            "to": to_date,
            "sortBy": sort_by,
            "pageSize": min(page_size, 100),
        }

        result = self._make_request("everything", params=params)
        if not result or "articles" not in result:
            logger.warning(f"NewsAPI search_everything returned no results for '{query}'")
            return []

        articles = []
        for article in result.get("articles", []):
            try:
                articles.append({
                    "title": article.get("title", "Unknown"),
                    "description": article.get("description", ""),
                    "source": article.get("source", {}).get("name", "Unknown"),
                    "author": article.get("author", "Unknown"),
                    "url": article.get("url", ""),
                    "published_at": article.get("publishedAt", ""),
                    "image": article.get("urlToImage", ""),
                    "content": article.get("content", "")[:500],
                })
            except (KeyError, ValueError) as e:
                logger.warning(f"Error processing search article: {e}")
                continue

        logger.info(f"NewsAPI search_everything found {len(articles)} articles for '{query}'")
        return articles

    def search_fmcg_news(self, keywords: Optional[List[str]] = None) -> Dict[str, List[Dict[str, Any]]]:
        """
        Search for FMCG, beauty, and cleaning industry news using pre-configured queries.

        Args:
            keywords: Optional list of custom keywords to add to default searches.
                     (e.g., ["Schwarzkopf", "sustainable packaging"])

        Returns:
            Dict mapping query categories to lists of articles:
            {
                "hair_care": [...],
                "laundry": [...],
                "competitive": [...],
                "regulatory": [...],
                "innovation": [...],
                "consumer_trends": [...],
                "custom": [...]  # If keywords provided
            }
        """
        results = {}

        # Search each pre-configured category
        for category, query in self.FMCG_QUERIES.items():
            articles = self.search_everything(query, page_size=10)
            results[category] = articles
            logger.debug(f"NewsAPI search_fmcg_news found {len(articles)} articles for {category}")

        # Search custom keywords if provided
        if keywords:
            custom_articles = []
            for keyword in keywords:
                articles = self.search_everything(keyword, page_size=5)
                custom_articles.extend(articles)
            results["custom"] = custom_articles
            logger.debug(f"NewsAPI search_fmcg_news found {len(custom_articles)} articles for custom keywords")

        return results

    def scan_for_trends(self, categories: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """
        Scan NewsAPI for emerging trends relevant to PULSE categories.

        Looks for recent news patterns that indicate shifts in consumer demand,
        competitive action, regulation, or innovation.

        Args:
            categories: List of PULSE categories to scan (optional).

        Returns:
            List of trend dicts in PULSE format, empty list on error.
        """
        if not self.api_key:
            logger.warning("NewsAPI key not configured, skipping scan")
            return []

        trends = []

        # Search all FMCG news categories
        all_results = self.search_fmcg_news()

        # Process results by category
        for news_category, articles in all_results.items():
            if news_category == "custom":
                continue

            if not articles:
                logger.debug(f"No articles found for {news_category}")
                continue

            try:
                # Count articles as a signal of trend momentum
                article_count = len(articles)

                # Get most recent article date
                most_recent = articles[0].get("published_at", "")

                # Map to PULSE force
                pulse_force = self.FORCE_MAPPING.get(news_category, "Consumer")

                # Determine direction based on news sentiment (very simplified)
                # In production, integrate actual sentiment analysis
                descriptions = [a.get("description", "").lower() for a in articles[:5]]
                negative_words = ["ban", "decline", "loss", "crisis", "problem"]
                positive_words = ["growth", "innovation", "expansion", "launch"]

                negative_count = sum(1 for desc in descriptions for word in negative_words if word in desc)
                positive_count = sum(1 for desc in descriptions for word in positive_words if word in desc)

                direction = "Contraction" if negative_count > positive_count else "Expansion"

                # Map to PULSE categories
                category_mapping = {}
                for pulse_cat in self.CATEGORY_MAPPING.get(news_category, []):
                    category_mapping[pulse_cat] = 3

                # Derive impact/probability from article count
                # More articles = more confirmed signal
                suggested_impact = min(5, max(1, int(article_count / 3)))
                suggested_probability = min(5, max(1, int(article_count / 5) + 2))

                # Compile news summary from top articles
                headline_list = ", ".join([a.get("title", "")[:50] for a in articles[:3]])

                trend_dict = {
                    "id": f"newsapi_{news_category}_{datetime.utcnow().timestamp()}",
                    "name": f"{news_category.replace('_', ' ').title()} Trend",
                    "description": (
                        f"NewsAPI detected {article_count} recent articles on {news_category.replace('_', ' ')}. "
                        f"Recent headlines: {headline_list}"
                    ),
                    "force": pulse_force,
                    "suggested_impact": suggested_impact,
                    "suggested_probability": suggested_probability,
                    "direction": direction,
                    "relevance_score": min(100, article_count * 5),
                    "category_mapping": category_mapping,
                    "sources": [
                        {
                            "name": article.get("source", "NewsAPI"),
                            "api": "newsapi",
                            "url": article.get("url", "https://newsapi.org"),
                        }
                        for article in articles[:3]
                    ],
                    "ai_reasoning": (
                        f"NewsAPI detected {article_count} articles discussing {news_category.replace('_', ' ')} "
                        f"with {positive_count} positive and {negative_count} negative signals, "
                        f"suggesting {direction.lower()} pressure on {', '.join(category_mapping.keys())}."
                    ),
                    "detected_date": datetime.utcnow().isoformat(),
                    "confidence": self._score_to_confidence(min(1.0, article_count / 10)),
                }
                trends.append(trend_dict)
            except (KeyError, ValueError) as e:
                logger.warning(f"Error processing NewsAPI category '{news_category}': {e}")
                continue

        logger.info(f"NewsAPI scan_for_trends detected {len(trends)} relevant news trends")
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
