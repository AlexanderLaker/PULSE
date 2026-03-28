"""
Semantic Scholar (S2) API Integration Module

Provides deep academic intelligence for PULSE trend detection and validation:
  1. Paper search with citation velocity analysis → emerging technology signals
  2. Recommendation engine → "papers like this" for trend expansion
  3. Author influence tracking → key researchers signaling field shifts
  4. TLDR summaries → auto-summarize research relevance
  5. Citation context → how papers cite each other (support vs. contrast)

S2 complements OpenAlex: while OpenAlex provides breadth (200M+ papers),
S2 provides depth (semantic understanding, recommendations, TLDRs).

API Documentation: https://api.semanticscholar.org/api-docs/
Rate Limit: 1 request/second with API key (enforced via built-in throttle).
"""

import os
import time
import logging
from typing import Optional, Dict, List, Any
from datetime import datetime
import requests
from requests.exceptions import RequestException, Timeout, ConnectionError

logger = logging.getLogger(__name__)


class SemanticScholarClient:
    """Client for Semantic Scholar API with FMCG-focused academic intelligence."""

    BASE_URL = "https://api.semanticscholar.org"
    GRAPH_URL = f"{BASE_URL}/graph/v1"
    RECS_URL = f"{BASE_URL}/recommendations/v1"
    DEFAULT_TIMEOUT = 12

    # ── FMCG-relevant search domains ─────────────────────────────────

    # Curated keyword sets per PULSE force — these drive the scanner
    FORCE_QUERIES: Dict[str, List[str]] = {
        "Technology": [
            "cosmetic formulation innovation",
            "enzyme-based detergent technology",
            "biotechnology hair care",
            "sustainable surfactant synthesis",
            "waterless beauty formulation",
            "cold-water laundry detergent enzyme",
            "AI personalization cosmetics",
            "microencapsulation fragrance delivery",
        ],
        "Environmental": [
            "microplastics cosmetics environmental impact",
            "biodegradable surfactant",
            "sustainable packaging circular economy",
            "carbon footprint personal care products",
            "water scarcity FMCG impact",
            "PFAS-free household products",
            "refill reuse consumer goods packaging",
        ],
        "Government": [
            "EU cosmetics regulation REACH",
            "detergent regulation environmental policy",
            "biocide regulation EU BPR",
            "chemical safety assessment cosmetics",
            "endocrine disruptor regulation",
            "volatile organic compound VOC regulation",
        ],
        "Consumer": [
            "consumer behavior clean beauty",
            "natural ingredients demand personal care",
            "premiumization beauty market",
            "Gen Z beauty purchasing behavior",
            "scalp care consumer trend",
            "probiotic skincare microbiome",
        ],
        "Competitive": [
            "FMCG market consolidation acquisition",
            "private label beauty growth",
            "direct-to-consumer cosmetics disruption",
            "emerging market personal care growth",
        ],
        "Customer": [
            "e-commerce beauty channel shift",
            "retailer private label strategy",
            "supply chain resilience FMCG",
            "omnichannel retail personal care",
        ],
    }

    # Map S2 field-of-study categories to PULSE categories
    CATEGORY_MAPPING: Dict[str, Dict[str, int]] = {
        "cosmetics": {"Hair: Color": 3, "Hair: Care": 4, "Hair: Styling": 2, "Hair: Body": 3},
        "hair": {"Hair: Color": 4, "Hair: Care": 5, "Hair: Styling": 3, "Hair: Body": 2},
        "surfactant": {"LHC: FCN": 4, "LHC: FCA": 3, "LHC: ADW": 3, "LHC: HDW": 2},
        "detergent": {"LHC: FCN": 5, "LHC: LAD": 4, "LHC: FCA": 3},
        "laundry": {"LHC: FCN": 4, "LHC: LAD": 5, "LHC: FCA": 3},
        "dishwash": {"LHC: HDW": 5, "LHC: ADW": 4},
        "insect": {"LHC: IC": 5},
        "packaging": {"Hair: Care": 2, "LHC: FCN": 3, "LHC: FFI": 2},
        "fragrance": {"LHC: FCA": 4, "Hair: Styling": 2, "LHC: HSC": 3},
        "soap": {"LHC: HSC": 5, "Hair: Body": 3},
        "cleaning": {"LHC: FFI": 4, "LHC: FCN": 3, "LHC: HDW": 2},
        "skincare": {"Hair: Body": 3, "Hair: Care": 2},
        "microplastic": {"LHC: FCN": 3, "Hair: Care": 3, "Hair: Styling": 2},
        "biocide": {"LHC: IC": 5, "LHC: FFI": 3},
        "enzyme": {"LHC: FCN": 4, "LHC: LAD": 4, "LHC: HDW": 3, "LHC: ADW": 3},
    }

    # ── Initialization ─────────────────────────────────────────────────

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Semantic Scholar client.

        Args:
            api_key: S2 API key. Falls back to S2_API_KEY env var.
                     Required for elevated rate limits (1 req/sec vs 100 req/5min).
        """
        self.api_key = api_key or os.environ.get("S2_API_KEY", "")
        self.session = requests.Session()
        self._last_request_time = 0.0

        headers = {"User-Agent": "PULSE Profit Pool Engine/2.1"}
        if self.api_key:
            headers["x-api-key"] = self.api_key
        self.session.headers.update(headers)

    # ── Rate Limiting ──────────────────────────────────────────────────

    def _throttle(self):
        """Enforce 1 request/second rate limit."""
        now = time.time()
        elapsed = now - self._last_request_time
        if elapsed < 1.05:  # 1.05s for safety margin
            time.sleep(1.05 - elapsed)
        self._last_request_time = time.time()

    # ── Core HTTP ──────────────────────────────────────────────────────

    def _get(
        self,
        url: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Rate-limited GET request to S2 API.

        Returns parsed JSON or None on error.
        """
        self._throttle()
        try:
            resp = self.session.get(url, params=params, timeout=self.DEFAULT_TIMEOUT)
            if resp.status_code == 429:
                logger.warning("S2 rate limit hit — backing off 2s")
                time.sleep(2)
                resp = self.session.get(url, params=params, timeout=self.DEFAULT_TIMEOUT)
            resp.raise_for_status()
            return resp.json()
        except Timeout:
            logger.error(f"S2 request timeout: {url}")
            return None
        except ConnectionError as e:
            logger.error(f"S2 connection error: {e}")
            return None
        except RequestException as e:
            logger.error(f"S2 request error: {e}")
            return None
        except ValueError:
            logger.error(f"S2 JSON parse error for {url}")
            return None

    def _post(
        self,
        url: str,
        json_body: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """Rate-limited POST request to S2 API."""
        self._throttle()
        try:
            resp = self.session.post(url, json=json_body, timeout=self.DEFAULT_TIMEOUT)
            if resp.status_code == 429:
                logger.warning("S2 rate limit hit — backing off 2s")
                time.sleep(2)
                resp = self.session.post(url, json=json_body, timeout=self.DEFAULT_TIMEOUT)
            resp.raise_for_status()
            return resp.json()
        except (Timeout, ConnectionError, RequestException, ValueError) as e:
            logger.error(f"S2 POST error: {e}")
            return None

    # ── 1. Paper Search ────────────────────────────────────────────────

    def search_papers(
        self,
        query: str,
        year_from: int = 2023,
        limit: int = 20,
        fields: str = "paperId,title,abstract,year,citationCount,influentialCitationCount,"
                      "authors,fieldsOfStudy,publicationTypes,tldr,externalIds,url,"
                      "openAccessPdf,publicationDate",
    ) -> List[Dict[str, Any]]:
        """
        Search for papers by keyword with FMCG-relevant enrichment.

        The S2 search API returns papers ranked by relevance.
        We enrich each result with citation velocity and PULSE force/category mapping.

        Args:
            query: Search query (e.g., "enzyme-based cold water detergent")
            year_from: Filter papers published from this year onward
            limit: Max results (max 100 per S2 API)
            fields: Comma-separated paper fields to return

        Returns:
            List of enriched paper dicts with PULSE metadata.
        """
        url = f"{self.GRAPH_URL}/paper/search"
        params = {
            "query": query,
            "year": f"{year_from}-",
            "limit": min(limit, 100),
            "fields": fields,
        }

        data = self._get(url, params)
        if not data or "data" not in data:
            logger.warning(f"S2 search returned no results for '{query}'")
            return []

        papers = []
        for paper in data.get("data", []):
            try:
                enriched = self._enrich_paper(paper, query)
                if enriched:
                    papers.append(enriched)
            except Exception as e:
                logger.warning(f"Error enriching S2 paper: {e}")
                continue

        logger.info(f"S2 search found {len(papers)} papers for '{query}'")
        return papers

    def _enrich_paper(self, paper: Dict, query: str) -> Optional[Dict[str, Any]]:
        """
        Enrich raw S2 paper with PULSE-relevant metadata.

        Computes: citation velocity, influence score, PULSE force mapping,
        category exposure, and formats for scanner integration.
        """
        paper_id = paper.get("paperId", "")
        title = paper.get("title", "")
        if not title:
            return None

        year = paper.get("year") or 2025
        citations = paper.get("citationCount", 0)
        influential = paper.get("influentialCitationCount", 0)
        years_since = max(1, 2026 - year)

        # Citation velocity: citations per year (key signal for emerging trends)
        citation_velocity = citations / years_since

        # Influence ratio: what fraction of citations are "influential"
        # (S2's definition: citations that significantly impacted the citing paper)
        influence_ratio = influential / max(1, citations)

        # TLDR (AI-generated 1-sentence summary from S2)
        tldr = paper.get("tldr", {})
        tldr_text = tldr.get("text", "") if isinstance(tldr, dict) else ""

        # Abstract
        abstract = paper.get("abstract", "") or ""

        # Authors (first 5)
        authors = [
            a.get("name", "Unknown")
            for a in (paper.get("authors") or [])[:5]
        ]

        # External IDs
        ext_ids = paper.get("externalIds") or {}
        doi = ext_ids.get("DOI", "")
        arxiv_id = ext_ids.get("ArXiv", "")

        # Open access PDF
        oa_pdf = paper.get("openAccessPdf") or {}
        pdf_url = oa_pdf.get("url", "")

        # S2 URL
        s2_url = paper.get("url", f"https://www.semanticscholar.org/paper/{paper_id}")

        # Fields of study
        fields = paper.get("fieldsOfStudy") or []

        # ── Map to PULSE categories ────────────────────────
        category_exposure = self._map_to_categories(title, abstract, fields)

        # ── Map to PULSE force ─────────────────────────────
        force = self._infer_force(query, title, abstract)

        # ── Determine direction ────────────────────────────
        direction = self._infer_direction(title, abstract, force)

        # ── Compute relevance score (0-100) ────────────────
        relevance = min(100, int(
            (citation_velocity * 3) +         # High citation velocity = strong signal
            (influence_ratio * 30) +           # Influential citations = paradigm-shifting
            (20 if tldr_text else 0) +         # Has TLDR = better indexed paper
            (15 if year >= 2025 else 5) +      # Very recent = higher relevance
            (10 if pdf_url else 0)              # Open access = more impactful
        ))

        # ── Compute suggested impact/probability ───────────
        suggested_impact = min(5, max(1, int(citation_velocity / 3) + 1))
        suggested_probability = min(5, max(2, 3 + int(influence_ratio * 3)))

        return {
            "paper_id": paper_id,
            "title": title,
            "abstract": abstract[:500] if abstract else "",
            "tldr": tldr_text,
            "authors": authors,
            "year": year,
            "publication_date": paper.get("publicationDate", ""),
            "citation_count": citations,
            "influential_citation_count": influential,
            "citation_velocity": round(citation_velocity, 1),
            "influence_ratio": round(influence_ratio, 3),
            "fields_of_study": fields,
            "doi": doi,
            "arxiv_id": arxiv_id,
            "pdf_url": pdf_url,
            "s2_url": s2_url,
            # PULSE metadata
            "force": force,
            "direction": direction,
            "category_exposure": category_exposure,
            "suggested_impact": suggested_impact,
            "suggested_probability": suggested_probability,
            "relevance_score": relevance,
            "source": "semantic_scholar",
        }

    # ── 2. Paper Recommendations ───────────────────────────────────────

    def get_recommendations(
        self,
        paper_id: str,
        limit: int = 10,
        fields: str = "paperId,title,abstract,year,citationCount,influentialCitationCount,"
                      "authors,fieldsOfStudy,tldr,externalIds,url",
    ) -> List[Dict[str, Any]]:
        """
        Get paper recommendations based on a seed paper.

        This is S2's unique capability: "Find me more papers like this one."
        Useful for trend expansion — once you find one signal paper, find related work.

        Args:
            paper_id: S2 paper ID (e.g., "649def34f8be52c8b66281af98ae884c09aef38b")
            limit: Max recommendations (max 500)
            fields: Paper fields to return

        Returns:
            List of recommended paper dicts.
        """
        url = f"{self.RECS_URL}/papers/forpaper/{paper_id}"
        params = {"limit": min(limit, 100), "fields": fields}

        data = self._get(url, params)
        if not data or "recommendedPapers" not in data:
            logger.warning(f"S2 recommendations returned nothing for paper {paper_id}")
            return []

        papers = []
        for paper in data.get("recommendedPapers", []):
            enriched = self._enrich_paper(paper, "recommendation")
            if enriched:
                papers.append(enriched)

        logger.info(f"S2 recommendations: {len(papers)} papers for seed {paper_id[:12]}")
        return papers

    def get_batch_recommendations(
        self,
        paper_ids: List[str],
        limit: int = 10,
        fields: str = "paperId,title,abstract,year,citationCount,influentialCitationCount,"
                      "authors,fieldsOfStudy,tldr,externalIds,url",
    ) -> List[Dict[str, Any]]:
        """
        Get recommendations based on multiple seed papers (more targeted).

        Uses S2's batch recommendation endpoint for better results
        when you have multiple signal papers defining a research direction.

        Args:
            paper_ids: List of S2 paper IDs (positive examples)
            limit: Max recommendations
            fields: Paper fields to return

        Returns:
            List of recommended papers.
        """
        url = f"{self.RECS_URL}/papers/"
        body = {
            "positivePaperIds": paper_ids[:5],  # S2 allows up to 5 positive
            "negativePaperIds": [],
        }
        params = {"limit": min(limit, 100), "fields": fields}

        data = self._post(f"{url}?{self._encode_params(params)}", body)
        if not data or "recommendedPapers" not in data:
            return []

        papers = []
        for paper in data.get("recommendedPapers", []):
            enriched = self._enrich_paper(paper, "batch_recommendation")
            if enriched:
                papers.append(enriched)

        return papers

    # ── 3. Author Influence Tracking ───────────────────────────────────

    def get_author_papers(
        self,
        author_id: str,
        limit: int = 10,
        fields: str = "paperId,title,year,citationCount,influentialCitationCount,fieldsOfStudy,tldr",
    ) -> List[Dict[str, Any]]:
        """
        Get recent papers by a specific author.

        Useful for tracking key researchers in FMCG-adjacent fields
        (cosmetic chemistry, surfactant science, packaging innovation).

        Args:
            author_id: S2 author ID
            limit: Max papers
            fields: Paper fields to return

        Returns:
            List of author's recent papers.
        """
        url = f"{self.GRAPH_URL}/author/{author_id}/papers"
        params = {"limit": min(limit, 100), "fields": fields}

        data = self._get(url, params)
        if not data or "data" not in data:
            return []

        return [
            self._enrich_paper(p, "author_tracking")
            for p in data.get("data", [])
            if self._enrich_paper(p, "author_tracking")
        ]

    def search_authors(
        self,
        query: str,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Search for authors by name or research area.

        Args:
            query: Author name or research topic
            limit: Max results

        Returns:
            List of author dicts with name, affiliation, paper count, citation count.
        """
        url = f"{self.GRAPH_URL}/author/search"
        params = {
            "query": query,
            "limit": min(limit, 20),
            "fields": "name,affiliations,paperCount,citationCount,hIndex",
        }

        data = self._get(url, params)
        if not data or "data" not in data:
            return []

        return [
            {
                "author_id": a.get("authorId", ""),
                "name": a.get("name", ""),
                "affiliations": a.get("affiliations", []),
                "paper_count": a.get("paperCount", 0),
                "citation_count": a.get("citationCount", 0),
                "h_index": a.get("hIndex", 0),
            }
            for a in data.get("data", [])
        ]

    # ── 4. PULSE Scanner Integration ───────────────────────────────────

    def scan_for_trends(
        self,
        forces: Optional[List[str]] = None,
        max_papers_per_query: int = 5,
        max_queries_per_force: int = 2,
    ) -> List[Dict[str, Any]]:
        """
        Full PULSE-integrated scan: search S2 for emerging FMCG research trends.

        For each force, runs curated queries, enriches results with PULSE metadata,
        and returns scanner-compatible trend dicts ready for the Emerging Trends panel.

        Args:
            forces: Which PULSE forces to scan (default: all 6)
            max_papers_per_query: Papers per search query (rate-limit aware)
            max_queries_per_force: Queries per force (rate-limit aware)

        Returns:
            List of trend dicts in PULSE scanner format.
        """
        target_forces = forces or list(self.FORCE_QUERIES.keys())
        trends = []

        for force in target_forces:
            queries = self.FORCE_QUERIES.get(force, [])[:max_queries_per_force]

            for query in queries:
                papers = self.search_papers(query, year_from=2024, limit=max_papers_per_query)

                for paper in papers:
                    if paper.get("relevance_score", 0) < 25:
                        continue  # Skip low-relevance papers

                    # Build trend dict compatible with scanner pipeline
                    trend = {
                        "id": f"s2_{paper['paper_id'][:16]}",
                        "name": paper["title"][:100],
                        "description": (
                            paper.get("tldr") or
                            paper.get("abstract", "")[:300] or
                            f"Research paper: {paper['title']}"
                        ),
                        "force": paper["force"],
                        "direction": paper["direction"],
                        "suggested_impact": paper["suggested_impact"],
                        "suggested_probability": paper["suggested_probability"],
                        "relevance_score": paper["relevance_score"],
                        "category_mapping": paper["category_exposure"],
                        "reasoning": (
                            f"Semantic Scholar detected high-impact research "
                            f"({paper['citation_count']} citations, "
                            f"{paper['citation_velocity']} cites/yr, "
                            f"{paper['influential_citation_count']} influential). "
                            f"Published {paper['year']}. "
                            f"Authors: {', '.join(paper['authors'][:3])}. "
                            f"{'TLDR: ' + paper['tldr'][:150] if paper.get('tldr') else ''}"
                        ),
                        "sources": [
                            {
                                "title": paper["title"][:80],
                                "api": "semantic_scholar",
                                "url": paper.get("doi") and f"https://doi.org/{paper['doi']}" or paper["s2_url"],
                            }
                        ],
                        "detected_date": datetime.utcnow().isoformat(),
                        "confidence": self._velocity_to_confidence(paper["citation_velocity"]),
                        # S2-specific enrichment (not in other sources)
                        "s2_paper_id": paper["paper_id"],
                        "citation_velocity": paper["citation_velocity"],
                        "influence_ratio": paper["influence_ratio"],
                        "has_tldr": bool(paper.get("tldr")),
                        "pdf_available": bool(paper.get("pdf_url")),
                    }
                    trends.append(trend)

        # Deduplicate by paper_id
        seen = set()
        unique = []
        for t in trends:
            pid = t.get("s2_paper_id", t["id"])
            if pid not in seen:
                seen.add(pid)
                unique.append(t)

        # Sort by relevance
        unique.sort(key=lambda t: t.get("relevance_score", 0), reverse=True)

        logger.info(f"S2 scan_for_trends: {len(unique)} trends across {len(target_forces)} forces")
        return unique

    def _search_sync(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Synchronous search that returns scanner-compatible dicts.
        Called from async wrapper via run_in_executor.
        """
        papers = self.search_papers(query, year_from=2024, limit=min(limit, 15))

        results = []
        for p in papers:
            results.append({
                "title": p["title"],
                "description": p.get("tldr") or p.get("abstract", "")[:200],
                "url": p.get("doi") and f"https://doi.org/{p['doi']}" or p["s2_url"],
                "doi": p.get("doi", ""),
                "source": "semantic_scholar",
                "published": p.get("publication_date", ""),
                "citation_count": p["citation_count"],
                "citation_velocity": p["citation_velocity"],
                "influence_ratio": p["influence_ratio"],
                "force": p["force"],
                "direction": p["direction"],
                "category_exposure": p["category_exposure"],
                "relevance_score": p["relevance_score"],
                "authors": p["authors"],
            })
        return results

    async def search(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Async search wrapper for scanner pipeline integration.

        Runs the synchronous S2 API calls in a thread executor to avoid
        blocking the event loop (S2 uses time.sleep for rate limiting).
        """
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self._search_sync(query, limit),
        )

    # ── Internal: Category Mapping ─────────────────────────────────────

    def _map_to_categories(
        self,
        title: str,
        abstract: str,
        fields: List[str],
    ) -> Dict[str, int]:
        """
        Map a paper to PULSE categories based on content keywords.

        Scans title + abstract for domain-specific terms and builds
        a category exposure dict {category_name: exposure_score}.
        """
        combined = f"{title} {abstract}".lower()
        exposure: Dict[str, int] = {}

        for keyword, mapping in self.CATEGORY_MAPPING.items():
            if keyword in combined:
                for cat, score in mapping.items():
                    exposure[cat] = max(exposure.get(cat, 0), score)

        # Default if nothing matched
        if not exposure:
            # Check fields of study as fallback
            fields_lower = " ".join(f.lower() for f in fields)
            if "chemistry" in fields_lower or "materials" in fields_lower:
                exposure = {"LHC: FCN": 2, "Hair: Care": 2}
            elif "biology" in fields_lower or "medicine" in fields_lower:
                exposure = {"Hair: Care": 2, "Hair: Body": 2}
            elif "environmental" in fields_lower:
                exposure = {"LHC: FCN": 2, "Hair: Care": 2}
            else:
                exposure = {"Hair: Care": 1, "LHC: FCN": 1}

        return exposure

    # ── Internal: Force Mapping ────────────────────────────────────────

    def _infer_force(self, query: str, title: str, abstract: str) -> str:
        """Infer PULSE force from paper content and query context."""
        combined = f"{query} {title} {abstract}".lower()

        force_signals = {
            "Government": ["regulation", "policy", "legislation", "ban", "compliance",
                          "directive", "restriction", "safety assessment", "BPR", "REACH",
                          "EU regulation", "biocide"],
            "Environmental": ["sustainability", "biodegradable", "carbon footprint",
                            "microplastic", "circular economy", "water scarcity", "PFAS",
                            "environmental impact", "green chemistry", "eco-friendly"],
            "Technology": ["innovation", "formulation", "enzyme", "biotechnology",
                          "encapsulation", "AI", "machine learning", "novel", "synthesis",
                          "nanoparticle", "biotech", "cold-water", "smart"],
            "Consumer": ["consumer", "purchase", "preference", "behavior", "perception",
                        "willingness to pay", "brand", "Gen Z", "millennial", "demand",
                        "clean beauty", "natural ingredients"],
            "Competitive": ["market share", "acquisition", "private label", "disruption",
                          "competitive advantage", "first-mover", "consolidation"],
            "Customer": ["e-commerce", "retail", "channel", "supply chain", "omnichannel",
                        "distribution", "shelf space"],
        }

        scores = {}
        for force, keywords in force_signals.items():
            scores[force] = sum(1 for kw in keywords if kw in combined)

        best_force = max(scores, key=scores.get)
        return best_force if scores[best_force] > 0 else "Technology"

    # ── Internal: Direction Inference ──────────────────────────────────

    def _infer_direction(self, title: str, abstract: str, force: str) -> str:
        """
        Infer whether the research signals market expansion or contraction.

        Most research signals expansion (innovation enables growth), except:
        - Regulatory papers often signal contraction (cost/complexity increase)
        - Environmental risk papers signal contraction (reformulation cost)
        """
        combined = f"{title} {abstract}".lower()

        contraction_signals = [
            "ban", "restrict", "toxic", "harmful", "contamination",
            "phase-out", "decline", "risk", "negative impact",
            "endocrine disruptor", "carcinogen", "pollution",
        ]
        expansion_signals = [
            "innovation", "novel", "improve", "enhance", "growth",
            "opportunity", "sustainable alternative", "efficient",
            "breakthrough", "advance", "promising",
        ]

        contraction_score = sum(1 for s in contraction_signals if s in combined)
        expansion_score = sum(1 for s in expansion_signals if s in combined)

        # Government and some Environmental papers lean contraction
        if force in ("Government",) and contraction_score >= expansion_score:
            return "Contraction"

        return "Contraction" if contraction_score > expansion_score + 1 else "Expansion"

    # ── Internal: Confidence ───────────────────────────────────────────

    @staticmethod
    def _velocity_to_confidence(velocity: float) -> str:
        """Convert citation velocity to confidence level."""
        if velocity >= 15:
            return "High"
        elif velocity >= 5:
            return "Medium"
        else:
            return "Low"

    @staticmethod
    def _encode_params(params: Dict[str, Any]) -> str:
        """URL-encode parameters."""
        from urllib.parse import urlencode
        return urlencode(params)

    # ── Cleanup ────────────────────────────────────────────────────────

    def close(self):
        if self.session:
            self.session.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
