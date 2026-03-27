"""
OpenAlex.org API Integration Module

Provides access to open scholarly data for research trend detection in cosmetics,
detergents, and materials science. Successor to Microsoft Academic Graph.

API Documentation: https://docs.openalex.org/
"""

import os
import logging
from typing import Optional, Dict, List, Any
from datetime import datetime
import requests
from requests.exceptions import RequestException, Timeout, ConnectionError

logger = logging.getLogger(__name__)


class OpenAlexClient:
    """Client for OpenAlex API integration."""

    BASE_URL = "https://api.openalex.org"
    DEFAULT_TIMEOUT = 10
    DEFAULT_EMAIL = "pulse@henkel.com"

    # OpenAlex concept IDs (obtained from OpenAlex.org/concepts)
    RELEVANT_CONCEPTS = {
        "cosmetics": "C71924100",
        "surfactants": "C2781050795",
        "detergents": "C154248944",
        "polymers": "C82214229",
        "sustainability": "C129506788",
        "packaging": "C151730666",
        "hair_care": "C206968874",
        "microplastics": "C2781870949",
        "circular_economy": "C127988934",
        "green_chemistry": "C2750649355",
    }

    # Mapping research topics to PULSE forces
    FORCE_MAPPING = {
        "consumer_behavior": "Consumer",
        "market_analysis": "Customer",
        "innovation_technology": "Technology",
        "sustainability": "Environmental",
        "regulation": "Government",
        "competitive_advantage": "Competitive",
    }

    # Mapping OpenAlex concepts to PULSE categories
    CATEGORY_MAPPING = {
        "hair_care": ["Hair: Care", "Hair: Color"],
        "surfactants": ["Hair: Care", "LHC: FCN"],
        "detergents": ["LHC: FCN", "LHC: FCA"],
        "packaging": ["Hair: Color", "Hair: Care", "LHC: FCN"],
        "sustainability": ["Hair: Care", "LHC: FCN"],
        "green_chemistry": ["LHC: FCN", "LHC: ADW"],
    }

    def __init__(self, api_key: Optional[str] = None, email: str = DEFAULT_EMAIL):
        """
        Initialize OpenAlexClient.

        Args:
            api_key: API key for OpenAlex. If None, reads from OPENALEX_API_KEY env var.
                    OpenAlex allows unauthenticated requests but prefers auth for rate limiting.
            email: Polite pool email for rate limiting (default: pulse@henkel.com)
        """
        self.api_key = api_key or os.environ.get("OPENALEX_API_KEY")
        self.email = email
        self.session = requests.Session()

        # Set up headers with polite pool email (required by OpenAlex)
        headers = {"User-Agent": f"PULSE Profit Pool Engine ({self.email})"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        self.session.headers.update(headers)

    def _make_request(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Make HTTP request to OpenAlex API.

        Args:
            endpoint: API endpoint (relative to BASE_URL)
            params: Query parameters

        Returns:
            Response JSON or None on error.
        """
        url = f"{self.BASE_URL}/{endpoint}"
        if params is None:
            params = {}

        # Always include email for polite pool
        params["mailto"] = self.email

        try:
            response = self.session.get(
                url,
                params=params,
                timeout=self.DEFAULT_TIMEOUT,
            )
            response.raise_for_status()
            return response.json()
        except Timeout:
            logger.error(f"OpenAlex request timeout: {endpoint}")
            return None
        except ConnectionError as e:
            logger.error(f"OpenAlex connection error: {e}")
            return None
        except RequestException as e:
            logger.error(f"OpenAlex request error on {endpoint}: {e}")
            return None
        except ValueError as e:
            logger.error(f"OpenAlex response parsing error: {e}")
            return None

    def search_works(
        self,
        query: str,
        filter_year_from: int = 2024,
        limit: int = 25,
    ) -> List[Dict[str, Any]]:
        """
        Search for academic papers/works by keyword.

        Args:
            query: Search query (e.g., "cosmetic formulation", "surfactant biodegradability")
            filter_year_from: Only include papers from this year onwards (default 2024)
            limit: Max results (default 25, max 100 per OpenAlex rate limits)

        Returns:
            List of work dicts (id, title, authors, publication_year, cited_by_count, url),
            empty list on error.
        """
        # Construct filter for publication year
        filter_str = f"publication_year:>{filter_year_from - 1}"

        params = {
            "search": query,
            "filter": filter_str,
            "per_page": min(limit, 100),
            "sort": "cited_by_count:desc",
        }

        result = self._make_request("works", params=params)
        if not result or "results" not in result:
            logger.warning(f"OpenAlex search_works returned no results for '{query}'")
            return []

        works = []
        for work in result.get("results", []):
            try:
                works.append({
                    "id": work.get("id", ""),
                    "title": work.get("title", "Unknown"),
                    "authors": [a.get("author", {}).get("display_name") for a in work.get("authorships", [])],
                    "publication_year": work.get("publication_year"),
                    "cited_by_count": work.get("cited_by_count", 0),
                    "url": work.get("primary_location", {}).get("pdf_url") or work.get("ids", {}).get("doi"),
                    "concepts": [c.get("display_name") for c in work.get("concepts", [])[:5]],
                })
            except (KeyError, ValueError) as e:
                logger.warning(f"Error processing OpenAlex work: {e}")
                continue

        logger.info(f"OpenAlex search_works found {len(works)} works for '{query}'")
        return works

    def get_trending_concepts(
        self,
        field: str = "chemistry",
        subfield: Optional[str] = None,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        Get trending concepts (research areas) in a field.

        Args:
            field: Field of study (e.g., "chemistry", "environmental science")
            subfield: Optional subfield filter
            limit: Max concepts to return (default 10)

        Returns:
            List of concept dicts (name, citations_per_year, growth_rate),
            empty list on error.
        """
        # Filter by field display name
        filter_str = f"field.display_name.search:{field.lower()}"
        if subfield:
            filter_str += f",subfield.display_name.search:{subfield.lower()}"

        params = {
            "filter": filter_str,
            "per_page": min(limit, 50),
            "sort": "cited_by_count:desc",
        }

        result = self._make_request("concepts", params=params)
        if not result or "results" not in result:
            logger.warning(f"OpenAlex get_trending_concepts returned no data for {field}")
            return []

        concepts = []
        for concept in result.get("results", [])[:limit]:
            try:
                concepts.append({
                    "name": concept.get("display_name", "Unknown"),
                    "id": concept.get("id", ""),
                    "cited_by_count": concept.get("cited_by_count", 0),
                    "works_count": concept.get("works_count", 0),
                    "level": concept.get("level"),  # Hierarchy level (0=most general)
                })
            except (KeyError, ValueError) as e:
                logger.warning(f"Error processing OpenAlex concept: {e}")
                continue

        logger.info(f"OpenAlex get_trending_concepts found {len(concepts)} trending concepts")
        return concepts

    def search_cosmetics_research(self, topic: str, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Search for cosmetics and personal care research papers.

        Args:
            topic: Specific topic (e.g., "color-safe", "natural ingredients", "sustainable packaging")
            limit: Max results (default 20)

        Returns:
            List of relevant research papers, empty list on error.
        """
        # Build query combining cosmetics with topic
        query = f"cosmetics {topic}"

        # Filter to papers with "cosmetics" concept
        filter_str = f"concepts.id:{self.RELEVANT_CONCEPTS.get('cosmetics', 'C71924100')},publication_year:>2023"

        params = {
            "search": query,
            "filter": filter_str,
            "per_page": min(limit, 100),
            "sort": "cited_by_count:desc",
        }

        result = self._make_request("works", params=params)
        if not result or "results" not in result:
            logger.warning(f"OpenAlex search_cosmetics_research returned no results for '{topic}'")
            return []

        papers = []
        for work in result.get("results", []):
            try:
                papers.append({
                    "title": work.get("title", "Unknown"),
                    "authors": [a.get("author", {}).get("display_name") for a in work.get("authorships", [])[:3]],
                    "publication_year": work.get("publication_year"),
                    "cited_by_count": work.get("cited_by_count", 0),
                    "doi": work.get("ids", {}).get("doi"),
                    "concepts": [c.get("display_name") for c in work.get("concepts", [])[:5]],
                })
            except (KeyError, ValueError) as e:
                logger.warning(f"Error processing cosmetics paper: {e}")
                continue

        logger.info(f"OpenAlex search_cosmetics_research found {len(papers)} papers for '{topic}'")
        return papers

    def search_surfactant_innovation(self, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Search for surfactant and detergent innovation research.

        This is a pre-configured search focusing on green chemistry, biodegradable,
        and sustainable surfactants relevant to LHC categories.

        Args:
            limit: Max results (default 20)

        Returns:
            List of relevant surfactant research papers, empty list on error.
        """
        # Multi-concept search: surfactants + green chemistry
        filter_str = (
            f"concepts.id:{self.RELEVANT_CONCEPTS.get('surfactants', 'C2781050795')},"
            f"publication_year:>2023"
        )

        params = {
            "search": "surfactant biodegradable sustainable green chemistry",
            "filter": filter_str,
            "per_page": min(limit, 100),
            "sort": "cited_by_count:desc",
        }

        result = self._make_request("works", params=params)
        if not result or "results" not in result:
            logger.warning("OpenAlex search_surfactant_innovation returned no results")
            return []

        papers = []
        for work in result.get("results", []):
            try:
                papers.append({
                    "title": work.get("title", "Unknown"),
                    "authors": [a.get("author", {}).get("display_name") for a in work.get("authorships", [])[:3]],
                    "publication_year": work.get("publication_year"),
                    "cited_by_count": work.get("cited_by_count", 0),
                    "doi": work.get("ids", {}).get("doi"),
                    "concepts": [c.get("display_name") for c in work.get("concepts", [])[:8]],
                })
            except (KeyError, ValueError) as e:
                logger.warning(f"Error processing surfactant paper: {e}")
                continue

        logger.info(f"OpenAlex search_surfactant_innovation found {len(papers)} papers")
        return papers

    def scan_for_trends(self, categories: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """
        Scan OpenAlex for emerging research trends relevant to PULSE categories.

        Looks for rapidly-cited papers in cosmetics, surfactants, and sustainability
        research that signal technological or scientific shifts affecting FMCG markets.

        Args:
            categories: List of PULSE categories to scan (optional).
                       If None, scan all relevant categories.

        Returns:
            List of trend dicts in PULSE format, empty list on error.
        """
        if not self.api_key:
            logger.debug("OpenAlex API key not configured, proceeding with unauthenticated access")

        trends = []

        # Scan each relevant research area
        search_queries = [
            ("cosmetics", "cosmetics innovation formulation"),
            ("surfactants", "surfactant green chemistry biodegradable"),
            ("sustainability", "sustainable packaging circular economy"),
            ("microplastics", "microplastics ban regulation cosmetics"),
        ]

        for concept_key, search_term in search_queries:
            try:
                # Search for recently published, highly-cited works
                concept_id = self.RELEVANT_CONCEPTS.get(concept_key)
                if not concept_id:
                    continue

                filter_str = f"concepts.id:{concept_id},publication_year:>2023"
                params = {
                    "search": search_term,
                    "filter": filter_str,
                    "per_page": 10,
                    "sort": "cited_by_count:desc",
                }

                result = self._make_request("works", params=params)
                if not result or "results" not in result:
                    continue

                for work in result.get("results", [])[:3]:  # Top 3 papers per category
                    try:
                        # Use citation velocity as a signal of trend emergence
                        # (papers cited frequently in short time = emerging trend)
                        cited_by_count = work.get("cited_by_count", 0)
                        pub_year = work.get("publication_year", 2024)
                        years_since_pub = max(1, 2026 - pub_year)
                        citation_velocity = cited_by_count / years_since_pub

                        # Map to PULSE force
                        if "sustainable" in search_term.lower() or "circular" in search_term.lower():
                            pulse_force = "Environmental"
                        elif "regulation" in search_term.lower() or "ban" in search_term.lower():
                            pulse_force = "Government"
                        else:
                            pulse_force = "Technology"

                        # Determine direction
                        direction = "Expansion"  # Research growth = market opportunity

                        # Map to PULSE categories
                        category_mapping = {}
                        for cat_key, pulse_cats in self.CATEGORY_MAPPING.items():
                            if cat_key in concept_key or concept_key in cat_key:
                                for pulse_cat in pulse_cats:
                                    category_mapping[pulse_cat] = 3

                        if not category_mapping:
                            # Default mapping for cosmetics/detergent research
                            category_mapping = {
                                "Hair: Care": 2,
                                "LHC: FCN": 3,
                            }

                        # Derive impact/probability from citation velocity
                        suggested_impact = min(5, max(1, int(citation_velocity / 2)))
                        suggested_probability = 3  # Research papers = medium probability

                        trend_dict = {
                            "id": f"openalex_{work.get('id', concept_key).split('/')[-1]}",
                            "name": work.get("title", f"Research in {concept_key}")[:80],
                            "description": (
                                f"High-impact research ({cited_by_count} citations, "
                                f"{citation_velocity:.1f} cites/year) on {concept_key}"
                            ),
                            "force": pulse_force,
                            "suggested_impact": suggested_impact,
                            "suggested_probability": suggested_probability,
                            "direction": direction,
                            "relevance_score": min(100, int(citation_velocity * 5)),
                            "category_mapping": category_mapping,
                            "sources": [
                                {
                                    "name": "OpenAlex (Scholarly Data)",
                                    "api": "openalex",
                                    "url": work.get("ids", {}).get("doi") or work.get("id", ""),
                                }
                            ],
                            "ai_reasoning": (
                                f"OpenAlex detected rapidly-cited research ({citation_velocity:.1f} citations/year) "
                                f"in {concept_key} suggesting emerging {pulse_force.lower()} force impact. "
                                f"Authors: {', '.join([a.get('author', {}).get('display_name') for a in work.get('authorships', [])[:2]])}."
                            ),
                            "detected_date": datetime.utcnow().isoformat(),
                            "confidence": self._score_to_confidence(citation_velocity / 10),
                        }
                        trends.append(trend_dict)
                    except (KeyError, ValueError) as e:
                        logger.warning(f"Error processing OpenAlex paper: {e}")
                        continue
            except Exception as e:
                logger.warning(f"Error scanning OpenAlex for '{concept_key}': {e}")
                continue

        logger.info(f"OpenAlex scan_for_trends detected {len(trends)} relevant research trends")
        return trends

    @staticmethod
    def _score_to_confidence(score: float) -> str:
        """Convert numeric confidence score (0-1 range) to string confidence level."""
        if score >= 0.75:
            return "High"
        elif score >= 0.4:
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
