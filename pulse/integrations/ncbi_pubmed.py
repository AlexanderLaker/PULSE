"""NCBI PubMed integration — National Center for Biotechnology Information.

FREE API, no key required. 36+ million biomedical literature records.
Focus: cosmetics formulation, surfactant science, toxicology, regulatory trends.

API: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/
Rate limit: 10 req/sec with API key, 3/sec without. Free tier sufficient for weekly scans.
"""

import logging
import os
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import requests
from requests.exceptions import RequestException, Timeout, ConnectionError
import xml.etree.ElementTree as ET
import re

logger = logging.getLogger(__name__)


class NCBIPubMedClient:
    """Client for NCBI PubMed E-utilities API.

    Searches biomedical literature for trends in:
    - Cosmetic formulation chemistry
    - Surfactant biodegradability and sustainability
    - Hair/skin care ingredients and mechanisms
    - Laundry enzyme innovations
    - PFAS and microplastics in cosmetics
    - Scalp microbiome research
    - Biotechnology applications (keratin, biotech ingredients)

    All data are journal citations and abstracts (public domain).
    No confidential or company-specific data accessed.
    """

    BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    DEFAULT_TIMEOUT = 15
    DEFAULT_RETTYPE = "json"

    # Pre-configured search queries aligned with PULSE forces
    SEARCH_QUERIES = {
        "cosmetics_formulation": {
            "term": '("cosmetics"[Title/Abstract] OR "cosmetic formulation"[Title/Abstract]) AND (innovation OR technology OR chemistry)',
            "force": "Technology",
            "category_map": {"Hair: Care": 3, "Hair: Color": 2},
        },
        "surfactant_biodegradability": {
            "term": '("surfactant"[Title/Abstract] OR "surfactants"[Title/Abstract]) AND (biodegradable OR biodegradability OR sustainable OR green)',
            "force": "Environmental",
            "category_map": {"LHC: FCN": 4, "LHC: FCA": 3},
        },
        "hair_care_peptide": {
            "term": '("hair care"[Title/Abstract] OR "hair treatment"[Title/Abstract]) AND (peptide OR protein OR bioactive OR mechanism)',
            "force": "Technology",
            "category_map": {"Hair: Care": 4},
        },
        "laundry_enzyme": {
            "term": '("laundry detergent"[Title/Abstract] OR "wash detergent"[Title/Abstract]) AND (enzyme OR enzymatic OR protease OR lipase)',
            "force": "Technology",
            "category_map": {"LHC: FCN": 4},
        },
        "pfas_cosmetics": {
            "term": '("PFAS"[Title/Abstract] OR "PFOA"[Title/Abstract] OR "PFOS"[Title/Abstract] OR "per- and polyfluoroalkyl"[Title/Abstract]) AND (cosmetic OR skincare OR makeup)',
            "force": "Government",
            "category_map": {"Hair: Care": 3, "Hair: Color": 3},
        },
        "microplastics_detergent": {
            "term": '("microplastic"[Title/Abstract] OR "microbeads"[Title/Abstract]) AND (detergent OR cosmetic OR personal care)',
            "force": "Government",
            "category_map": {"LHC: FCN": 3},
        },
        "scalp_microbiome": {
            "term": '("scalp microbiome"[Title/Abstract] OR "scalp microbiota"[Title/Abstract] OR "hair microbiome"[Title/Abstract])',
            "force": "Consumer",
            "category_map": {"Hair: Care": 4},
        },
        "biotech_keratin": {
            "term": '("biotech"[Title/Abstract] OR "biotechnology"[Title/Abstract] OR "engineered"[Title/Abstract]) AND (keratin OR collagen OR elastin OR protein)',
            "force": "Technology",
            "category_map": {"Hair: Care": 4, "Hair: Styling": 2},
        },
    }

    def __init__(self, api_key: Optional[str] = None, email: Optional[str] = None):
        """Initialize NCBI PubMed client.

        Args:
            api_key: NCBI API key (improves rate limits). If None, reads from NCBI_API_KEY env var.
            email: Email for NCBI polite use. If None, reads from NCBI_EMAIL env var or uses default.
        """
        self.api_key = api_key or os.getenv("NCBI_API_KEY")
        self.email = email or os.getenv("NCBI_EMAIL", "pulse@henkel.com")
        self.session = requests.Session()

    def _make_request(
        self,
        tool: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Make HTTP request to NCBI E-utilities API.

        Args:
            tool: E-utility tool name (esearch, efetch, esummary, elink)
            params: Query parameters

        Returns:
            Parsed response (JSON) or None on error.
        """
        if params is None:
            params = {}

        # Add required parameters
        params["tool"] = "PULSE_ProfitPoolEngine"
        params["email"] = self.email
        if self.api_key:
            params["api_key"] = self.api_key
        params["retmode"] = "json"

        url = f"{self.BASE_URL}/{tool}.fcgi"

        try:
            response = self.session.get(url, params=params, timeout=self.DEFAULT_TIMEOUT)
            response.raise_for_status()
            return response.json()
        except Timeout:
            logger.error(f"NCBI {tool} request timeout")
            return None
        except ConnectionError as e:
            logger.error(f"NCBI connection error: {e}")
            return None
        except RequestException as e:
            logger.error(f"NCBI request error on {tool}: {e}")
            return None
        except ValueError as e:
            logger.error(f"NCBI response parsing error: {e}")
            return None

    def search(
        self,
        query: str,
        max_results: int = 20,
        min_date: Optional[str] = None,
        sort: str = "relevance",
    ) -> List[Dict[str, Any]]:
        """Search PubMed for articles matching query.

        Args:
            query: Search query (standard PubMed syntax)
            max_results: Max articles to return (1-10000, default 20)
            min_date: Minimum publication date (YYYY/MM/DD format). If None, searches all.
            sort: Sort order ('relevance' or 'pub_date')

        Returns:
            List of article dicts with pmid, title, authors, journal, pub_date, abstract.
        """
        # Step 1: esearch to get PMIDs
        search_params = {
            "db": "pubmed",
            "term": query,
            "retmax": min(max_results, 10000),
            "sort": sort,
        }
        if min_date:
            search_params["mindate"] = min_date

        search_result = self._make_request("esearch", search_params)
        if not search_result or "esearchresult" not in search_result:
            logger.warning(f"PubMed search returned no results for query: {query}")
            return []

        pmids = search_result.get("esearchresult", {}).get("idlist", [])
        if not pmids:
            logger.debug(f"PubMed search: no PMIDs found for '{query}'")
            return []

        logger.debug(f"PubMed search found {len(pmids)} articles for '{query}'")

        # Step 2: esummary to get article details
        fetch_params = {
            "db": "pubmed",
            "id": ",".join(pmids[:max_results]),
        }

        fetch_result = self._make_request("esummary", fetch_params)
        if not fetch_result or "result" not in fetch_result:
            logger.warning("PubMed esummary returned no results")
            return []

        articles = []
        result = fetch_result.get("result", {})
        uids = result.get("uids", [])

        for uid in uids:
            try:
                article = result.get(uid, {})
                if not article:
                    continue

                # Extract key fields
                pmid = article.get("uid", "")
                title = article.get("title", "")
                authors = article.get("authors", [])
                author_names = [a.get("name", "") for a in authors[:3]] if authors else []
                journal = article.get("source", "")
                pub_date = article.get("pubdate", "")
                abstract = article.get("abstract", "")

                articles.append({
                    "pmid": pmid,
                    "title": title,
                    "authors": author_names,
                    "journal": journal,
                    "pub_date": pub_date,
                    "abstract": abstract,
                    "source": "PubMed",
                    "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                })
            except (KeyError, ValueError) as e:
                logger.warning(f"Error parsing PubMed article: {e}")
                continue

        logger.info(f"PubMed: fetched {len(articles)} articles for '{query}'")
        return articles

    def search_cosmetics_research(
        self,
        keywords: Optional[List[str]] = None,
        max_results: int = 10,
        recent_years: int = 2,
    ) -> List[Dict[str, Any]]:
        """Search for cosmetics research using pre-configured queries.

        Args:
            keywords: Optional additional keywords to include in search.
            max_results: Max articles per search query
            recent_years: Only include articles from last N years

        Returns:
            List of article dicts
        """
        all_articles = []
        min_date = (datetime.now() - timedelta(days=recent_years * 365)).strftime("%Y/%m/%d")

        for search_key, search_config in self.SEARCH_QUERIES.items():
            try:
                query = search_config["term"]
                if keywords:
                    query += " AND (" + " OR ".join(keywords) + ")"

                articles = self.search(
                    query=query,
                    max_results=max_results,
                    min_date=min_date,
                )
                all_articles.extend(articles)

            except Exception as e:
                logger.warning(f"Error searching cosmetics research '{search_key}': {e}")
                continue

        logger.info(f"PubMed cosmetics_research found {len(all_articles)} total articles")
        return all_articles

    def search_regulatory_toxicology(
        self,
        max_results: int = 15,
    ) -> List[Dict[str, Any]]:
        """Search for substance safety and toxicology papers relevant to FMCG.

        Focuses on regulatory toxicology, ingredient safety, environmental impact.

        Args:
            max_results: Max articles per search

        Returns:
            List of article dicts
        """
        queries = [
            '("toxicology"[Title/Abstract] OR "toxicity"[Title/Abstract]) AND (cosmetic OR detergent OR "personal care")',
            '("safety assessment"[Title/Abstract] OR "hazard assessment"[Title/Abstract]) AND (ingredient OR chemical)',
            '("dermal absorption"[Title/Abstract] OR "percutaneous absorption"[Title/Abstract]) AND (cosmetic OR skincare)',
            '("allergic contact dermatitis"[Title/Abstract] OR "sensitization"[Title/Abstract]) AND (ingredient OR allergen)',
            '("environmental impact"[Title/Abstract] OR "environmental assessment"[Title/Abstract]) AND (cosmetic OR detergent)',
        ]

        all_articles = []
        min_date = (datetime.now() - timedelta(days=3 * 365)).strftime("%Y/%m/%d")

        for query in queries:
            try:
                articles = self.search(
                    query=query,
                    max_results=max_results,
                    min_date=min_date,
                )
                all_articles.extend(articles)
            except Exception as e:
                logger.warning(f"Error searching regulatory toxicology: {e}")
                continue

        logger.info(f"PubMed regulatory_toxicology found {len(all_articles)} articles")
        return all_articles

    def get_citation_count(self, pmid: str) -> int:
        """Fetch citation count for a specific article.

        Uses elink to find PubMed Central citations (conservative estimate).

        Args:
            pmid: PubMed ID

        Returns:
            Citation count (0 if error or not found)
        """
        try:
            params = {
                "dbfrom": "pubmed",
                "id": pmid,
                "linkname": "pubmed_pubmed_cited",
                "rettype": "json",
            }

            result = self._make_request("elink", params)
            if not result or "linksets" not in result:
                return 0

            linksets = result.get("linksets", [])
            if not linksets or "linksetdbs" not in linksets[0]:
                return 0

            linksetdbs = linksets[0].get("linksetdbs", [])
            if not linksetdbs or "links" not in linksetdbs[0]:
                return 0

            links = linksetdbs[0].get("links", [])
            return len(links)

        except Exception as e:
            logger.warning(f"Error fetching citation count for PMID {pmid}: {e}")
            return 0

    def scan_for_trends(self) -> List[Dict[str, Any]]:
        """Scan PubMed for emerging research trends in cosmetics/FMCG.

        Identifies rapidly-emerging topics in cosmetics science that signal
        technological shifts affecting product development and market forces.

        Returns:
            List of trend dicts in PULSE format
        """
        trends = []
        min_date = (datetime.now() - timedelta(days=2 * 365)).strftime("%Y/%m/%d")

        for search_key, search_config in self.SEARCH_QUERIES.items():
            try:
                query = search_config["term"]
                articles = self.search(
                    query=query,
                    max_results=5,
                    min_date=min_date,
                    sort="pub_date",  # Recent first
                )

                # Top 2 most recent articles per search query
                for article in articles[:2]:
                    try:
                        pmid = article.get("pmid", "")
                        title = article.get("title", "")
                        abstract = article.get("abstract", "")[:300]
                        pub_date = article.get("pub_date", "")
                        journal = article.get("journal", "")

                        # Citation velocity as trend signal
                        citation_count = self.get_citation_count(pmid)

                        # Estimate publication year for citation velocity calculation
                        try:
                            pub_year = int(pub_date.split()[0]) if pub_date else 2024
                        except (ValueError, IndexError):
                            pub_year = 2024

                        years_since_pub = max(1, datetime.now().year - pub_year)
                        citation_velocity = citation_count / years_since_pub

                        # High citation velocity = emerging trend
                        suggested_impact = min(5, max(1, int(1 + citation_velocity / 3)))
                        suggested_probability = 3  # Research papers = moderate probability

                        trend_dict = {
                            "id": f"ncbi_{pmid}",
                            "name": title[:100],
                            "description": abstract,
                            "force": search_config["force"],
                            "direction": "Expansion",  # Research growth = opportunity
                            "suggested_impact": suggested_impact,
                            "suggested_probability": suggested_probability,
                            "relevance_score": min(100, int(20 + citation_velocity * 5)),
                            "category_mapping": search_config["category_map"],
                            "sources": [
                                {
                                    "api": "ncbi_pubmed",
                                    "title": title,
                                    "url": article.get("url", ""),
                                    "snippet": abstract,
                                    "published": pub_date,
                                }
                            ],
                            "ai_reasoning": (
                                f"PubMed detected high-impact research in {search_key} "
                                f"({citation_count} citations, {citation_velocity:.1f} cites/year) "
                                f"published in {journal}. "
                                f"Authors: {', '.join(article.get('authors', [])[:2])}. "
                                f"Mapped to {search_config['force']} force."
                            ),
                            "detected_date": datetime.utcnow().isoformat(),
                            "confidence": "High" if citation_velocity > 2 else "Medium",
                            "status": "new",
                        }
                        trends.append(trend_dict)

                    except (KeyError, ValueError, IndexError) as e:
                        logger.warning(f"Error processing PubMed article {pmid}: {e}")
                        continue

            except Exception as e:
                logger.warning(f"Error scanning PubMed for '{search_key}': {e}")
                continue

        logger.info(f"PubMed scan_for_trends detected {len(trends)} research trends")
        return trends

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
