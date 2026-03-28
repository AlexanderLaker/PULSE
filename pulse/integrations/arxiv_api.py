"""arXiv API integration — Open preprint repository for science.

FREE API, completely open, no authentication required. 2M+ papers in physics,
materials science, chemistry, computer science (AI/ML), and quantitative biology.

API: http://export.arxiv.org/api/query
Returns Atom XML format. No rate limits (but respectful access recommended).

Key relevance to PULSE:
- Materials science: polymers, surfactants, sustainable materials
- Chemistry: molecular dynamics, green chemistry, formulation optimization
- AI/ML: AI applied to chemical formulation, process optimization, materials discovery
- Quantitative biology: biotech, enzyme engineering, protein design
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import requests
from requests.exceptions import RequestException, Timeout, ConnectionError
import feedparser
import re

logger = logging.getLogger(__name__)


class ArxivClient:
    """Client for arXiv preprint API.

    Searches cutting-edge preprints in:
    - Materials science (polymers, bio-surfactants, sustainable materials)
    - Chemistry (molecular dynamics, green/sustainable chemistry, catalysis)
    - Quantitative biology (enzyme engineering, protein design, biotech)
    - AI/ML applied to chemistry (molecular modeling, inverse design, optimization)

    All preprints are open access and intended for public dissemination.
    No confidential or proprietary data accessed.
    """

    BASE_URL = "http://export.arxiv.org/api/query"
    DEFAULT_TIMEOUT = 15

    # arXiv category mappings to research areas
    RELEVANT_CATEGORIES = {
        "cond-mat": "Condensed Matter Physics (materials)",
        "cond-mat.mtrl-sci": "Materials Science",
        "cond-mat.soft": "Soft Matter Physics",
        "physics.chem-ph": "Chemical Physics",
        "cs.LG": "Machine Learning",
        "cs.AI": "Artificial Intelligence",
        "q-bio.CB": "Cell Biology & Biotech",
        "q-bio.PE": "Populations & Evolution",
    }

    # Pre-configured search queries
    SEARCH_QUERIES = {
        "materials_science": {
            "search_term": "sustainable materials OR bio-surfactants OR biodegradable polymers",
            "categories": ["cond-mat.mtrl-sci"],
            "force": "Technology",
            "direction": "Expansion",
            "category_map": {"Hair: Care": 3, "LHC: FCN": 4},
        },
        "polymer_chemistry": {
            "search_term": "polymer chemistry OR molecular dynamics OR molecular simulation",
            "categories": ["cond-mat.soft", "physics.chem-ph"],
            "force": "Technology",
            "direction": "Expansion",
            "category_map": {"Hair: Styling": 3, "Hair: Care": 2},
        },
        "green_chemistry": {
            "search_term": "green chemistry OR sustainable synthesis OR catalysis OR biodegradation",
            "categories": ["physics.chem-ph"],
            "force": "Environmental",
            "direction": "Expansion",
            "category_map": {"LHC: FCN": 4},
        },
        "ai_formulation": {
            "search_term": "machine learning chemistry OR AI formulation OR neural network molecular OR deep learning materials",
            "categories": ["cs.LG", "cs.AI"],
            "force": "Technology",
            "direction": "Expansion",
            "category_map": {"Hair: Care": 3, "LHC: FCN": 3},
        },
        "enzyme_engineering": {
            "search_term": "enzyme engineering OR enzyme design OR protein engineering OR biocatalysis",
            "categories": ["q-bio.CB"],
            "force": "Technology",
            "direction": "Expansion",
            "category_map": {"LHC: FCN": 4},
        },
        "biotech_proteins": {
            "search_term": "protein design OR biotech OR recombinant protein OR enzyme optimization",
            "categories": ["q-bio.CB"],
            "force": "Technology",
            "direction": "Expansion",
            "category_map": {"Hair: Care": 3},
        },
    }

    def __init__(self):
        """Initialize arXiv client."""
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "PULSE Profit Pool Engine (https://henkel.com)"
        })

    def _make_request(
        self,
        params: Dict[str, Any],
    ) -> Optional[feedparser.FeedParserDict]:
        """Make HTTP request to arXiv API and parse Atom XML.

        Args:
            params: Query parameters (search_query, start, max_results, sortBy, sortOrder)

        Returns:
            Parsed Atom feed or None on error.
        """
        try:
            response = self.session.get(
                self.BASE_URL,
                params=params,
                timeout=self.DEFAULT_TIMEOUT,
            )
            response.raise_for_status()

            # Parse Atom XML with feedparser
            feed = feedparser.parse(response.content)
            return feed

        except Timeout:
            logger.error("arXiv API request timeout")
            return None
        except ConnectionError as e:
            logger.error(f"arXiv connection error: {e}")
            return None
        except RequestException as e:
            logger.error(f"arXiv request error: {e}")
            return None
        except Exception as e:
            logger.error(f"arXiv parsing error: {e}")
            return None

    def search(
        self,
        query: str,
        max_results: int = 20,
        sort_by: str = "submittedDate",
        sort_order: str = "descending",
    ) -> List[Dict[str, Any]]:
        """Search arXiv for papers matching query.

        Args:
            query: Search query (arXiv query syntax: 'all:keyword' searches all fields)
            max_results: Max papers to return (default 20, reasonable limit 50-100)
            sort_by: Sort order ('submittedDate' or 'relevance')
            sort_order: 'ascending' or 'descending' (most recent first is typical)

        Returns:
            List of paper dicts with arxiv_id, title, authors, abstract, published, pdf_url
        """
        params = {
            "search_query": query,
            "start": 0,
            "max_results": min(max_results, 1000),
            "sortBy": sort_by,
            "sortOrder": sort_order,
        }

        feed = self._make_request(params)
        if not feed or not feed.entries:
            logger.warning(f"arXiv search returned no results for: {query}")
            return []

        papers = []
        for entry in feed.entries[:max_results]:
            try:
                # Extract arxiv_id from URL
                arxiv_id = entry.id.split("/abs/")[-1]
                title = entry.title
                summary = entry.summary.replace("\n", " ").strip()
                authors = [author.name for author in entry.authors] if entry.authors else []
                published = entry.published
                pdf_url = entry.id.replace("abs", "pdf") + ".pdf"

                # Extract categories
                categories = []
                if hasattr(entry, "arxiv_primary_category"):
                    categories.append(entry.arxiv_primary_category.get("term", ""))
                if hasattr(entry, "tags"):
                    categories.extend([tag.get("term", "") for tag in entry.tags])

                papers.append({
                    "arxiv_id": arxiv_id,
                    "title": title,
                    "authors": authors,
                    "abstract": summary,
                    "published": published,
                    "categories": list(set(categories)),  # Remove duplicates
                    "pdf_url": pdf_url,
                    "source": "arXiv",
                    "url": entry.id,
                })

            except (KeyError, AttributeError, IndexError) as e:
                logger.warning(f"Error parsing arXiv entry: {e}")
                continue

        logger.info(f"arXiv: fetched {len(papers)} papers for '{query}'")
        return papers

    def search_materials_science(self, max_results: int = 10) -> List[Dict[str, Any]]:
        """Search for materials science papers relevant to FMCG.

        Focuses on sustainable materials, bio-surfactants, polymers, green materials.

        Args:
            max_results: Max papers per search query

        Returns:
            List of paper dicts
        """
        queries = [
            "cat:cond-mat.mtrl-sci AND (sustainable OR biodegradable OR eco-friendly)",
            "cat:cond-mat.soft AND (surfactant OR amphiphilic OR polymer)",
            "all:bio-based materials OR bio-surfactants OR green polymers",
            "all:circular economy materials OR recyclable polymers OR sustainable packaging",
        ]

        all_papers = []
        for query in queries:
            try:
                papers = self.search(query, max_results=max_results)
                all_papers.extend(papers)
            except Exception as e:
                logger.warning(f"Error searching materials science: {e}")
                continue

        # Deduplicate by arxiv_id
        seen = set()
        unique_papers = []
        for paper in all_papers:
            arxiv_id = paper.get("arxiv_id", "")
            if arxiv_id not in seen:
                seen.add(arxiv_id)
                unique_papers.append(paper)

        logger.info(f"arXiv materials_science found {len(unique_papers)} papers")
        return unique_papers

    def search_ai_formulation(self, max_results: int = 10) -> List[Dict[str, Any]]:
        """Search for AI/ML applied to chemical formulation and materials discovery.

        Focuses on machine learning for chemistry, molecular design, optimization.

        Args:
            max_results: Max papers per search query

        Returns:
            List of paper dicts
        """
        queries = [
            'cat:cs.LG AND (chemistry OR molecular OR formulation OR "materials discovery")',
            'cat:cs.AI AND (chemical OR molecular OR optimization OR drug discovery)',
            'all:"machine learning" chemistry OR "deep learning" materials OR "neural networks" molecules',
            'all:"inverse design" OR "molecular modeling" AND machine learning',
            'all:graph neural networks chemistry OR molecular simulation',
        ]

        all_papers = []
        for query in queries:
            try:
                papers = self.search(query, max_results=max_results)
                all_papers.extend(papers)
            except Exception as e:
                logger.warning(f"Error searching AI formulation: {e}")
                continue

        # Deduplicate by arxiv_id
        seen = set()
        unique_papers = []
        for paper in all_papers:
            arxiv_id = paper.get("arxiv_id", "")
            if arxiv_id not in seen:
                seen.add(arxiv_id)
                unique_papers.append(paper)

        logger.info(f"arXiv ai_formulation found {len(unique_papers)} papers")
        return unique_papers

    def scan_for_trends(self) -> List[Dict[str, Any]]:
        """Scan arXiv for emerging research trends in materials & AI.

        Identifies rapidly-advancing research areas (indicated by recent high-velocity
        papers) that signal technological shifts affecting FMCG markets.

        Returns:
            List of trend dicts in PULSE format
        """
        trends = []

        for search_key, search_config in self.SEARCH_QUERIES.items():
            try:
                search_term = search_config["search_term"]
                # Format for arXiv query syntax
                query = f"all:({search_term})"

                papers = self.search(
                    query=query,
                    max_results=3,  # Top 3 most recent papers
                    sort_by="submittedDate",
                    sort_order="descending",
                )

                for paper in papers:
                    try:
                        arxiv_id = paper.get("arxiv_id", "")
                        title = paper.get("title", "")
                        abstract = paper.get("abstract", "")[:400]
                        published = paper.get("published", "")
                        authors = paper.get("authors", [])

                        # Calculate publication recency as trend signal
                        try:
                            pub_date = datetime.fromisoformat(published.replace("Z", "+00:00"))
                            days_old = (datetime.utcnow() - pub_date.replace(tzinfo=None)).days
                            # Recent papers = stronger signal
                            recency_factor = max(0.5, 1.0 - (days_old / 365))
                        except (ValueError, TypeError):
                            recency_factor = 0.7
                            days_old = 0

                        suggested_impact = min(5, max(1, int(2 + recency_factor * 2)))
                        suggested_probability = 4  # Preprints = moderately high probability

                        trend_dict = {
                            "id": f"arxiv_{arxiv_id.replace('/', '_')}",
                            "name": title[:100],
                            "description": abstract,
                            "force": search_config["force"],
                            "direction": search_config["direction"],
                            "suggested_impact": suggested_impact,
                            "suggested_probability": suggested_probability,
                            "relevance_score": min(100, int(50 + recency_factor * 40)),
                            "category_mapping": search_config["category_map"],
                            "sources": [
                                {
                                    "api": "arxiv",
                                    "title": title,
                                    "url": paper.get("url", ""),
                                    "snippet": abstract,
                                    "published": published,
                                }
                            ],
                            "ai_reasoning": (
                                f"arXiv detected recent research in {search_key} "
                                f"(published {days_old} days ago) indicating active advancement "
                                f"in {search_config['force'].lower()} technologies. "
                                f"Authors: {', '.join(authors[:2] if authors else ['Unknown'])}. "
                                f"Categories: {', '.join(paper.get('categories', [])[:2])}."
                            ),
                            "detected_date": datetime.utcnow().isoformat(),
                            "confidence": "High" if recency_factor > 0.7 else "Medium",
                            "status": "new",
                        }
                        trends.append(trend_dict)

                    except (KeyError, ValueError, IndexError) as e:
                        logger.warning(f"Error processing arXiv paper {arxiv_id}: {e}")
                        continue

            except Exception as e:
                logger.warning(f"Error scanning arXiv for '{search_key}': {e}")
                continue

        logger.info(f"arXiv scan_for_trends detected {len(trends)} research trends")
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
