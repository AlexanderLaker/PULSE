"""Trend scanner — uses LLM to analyze news sources and detect market trends."""

import logging
from dataclasses import dataclass
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
import asyncio

from pulse.ai.provider import get_provider

if TYPE_CHECKING:
    from pulse.ai.provider import LLMProvider

logger = logging.getLogger(__name__)


@dataclass
class TrendSuggestion:
    """Suggested trend detected by scanner."""
    name: str
    force: str  # Consumer, Customer, Technology, Government, Environmental, Competitive
    direction: str  # "positive" or "negative"
    estimated_impact: str  # "low", "medium", "high"
    confidence: float  # 0.0 to 1.0
    source_url: str
    evidence_text: str
    detected_at: str = ""


class TrendScanner:
    """
    Scans news sources and web content to identify market trends.

    Uses feedparser for RSS feeds and requests for web scraping.
    Analyzes articles with LLM to classify trends by force and impact.
    """

    def __init__(self, provider: Optional["LLMProvider"] = None):
        """
        Initialize trend scanner.

        Args:
            provider: LLM provider (uses default if not specified)
        """
        self.provider = provider or get_provider()
        self._setup_dependencies()

    def _setup_dependencies(self):
        """Check and warn about missing optional dependencies."""
        try:
            import feedparser
            self.feedparser = feedparser
        except ImportError:
            logger.warning(
                "feedparser not installed. "
                "Install with: pip install feedparser"
            )
            self.feedparser = None

        try:
            import requests
            self.requests = requests
        except ImportError:
            logger.warning(
                "requests not installed. "
                "Install with: pip install requests"
            )
            self.requests = None

    async def scan_news_sources(
        self,
        forces: Optional[List[str]] = None,
        categories: Optional[List[str]] = None,
        max_articles_per_source: int = 5,
    ) -> List[TrendSuggestion]:
        """
        Scan news sources for trends relevant to FMCG.

        Args:
            forces: Forces to filter for (defaults to all)
            categories: Product categories to filter for
            max_articles_per_source: Max articles to analyze per RSS feed

        Returns:
            List of detected trend suggestions
        """
        from pulse.ai.config import get_ai_config

        if not self.feedparser:
            logger.error("feedparser not available - cannot scan RSS feeds")
            return []

        ai_config = get_ai_config()
        sources = ai_config.news_sources
        trend_categories = categories or ai_config.trend_categories

        all_suggestions = []

        for source_url in sources:
            try:
                logger.info(f"Scanning RSS feed: {source_url}")
                articles = await self._fetch_rss_articles(
                    source_url,
                    max_articles_per_source,
                )

                for article in articles:
                    try:
                        suggestions = await self._analyze_article(
                            article,
                            forces=forces,
                            categories=trend_categories,
                        )
                        all_suggestions.extend(suggestions)
                    except Exception as e:
                        logger.warning(
                            f"Error analyzing article from {source_url}: {e}"
                        )

            except Exception as e:
                logger.warning(f"Error scanning {source_url}: {e}")

        # Deduplicate suggestions by name and force
        seen = set()
        unique_suggestions = []
        for sugg in all_suggestions:
            key = (sugg.name.lower(), sugg.force.lower())
            if key not in seen:
                seen.add(key)
                unique_suggestions.append(sugg)

        logger.info(
            f"Trend scanning complete: {len(unique_suggestions)} unique trends detected"
        )
        return unique_suggestions

    async def scan(
        self,
        sources: Optional[List[str]] = None,
        forces: Optional[List[str]] = None,
        max_articles: int = 10,
    ) -> List[TrendSuggestion]:
        """
        Primary scan method — alias for scan_news_sources with source filtering.

        Args:
            sources: Specific sources to scan (defaults to config sources)
            forces: Forces to filter for
            max_articles: Max articles per source

        Returns:
            List of trend suggestions
        """
        # If specific sources provided, use them; otherwise use config
        if sources:
            original_sources = self.provider.config.get("news_sources", [])
            # Note: can't easily override config sources in current architecture
            logger.info(f"Scanning {len(sources)} sources")

        return await self.scan_news_sources(
            forces=forces,
            max_articles_per_source=max_articles
        )

    async def get_pending_suggestions(self) -> List[TrendSuggestion]:
        """
        Get pending trend suggestions awaiting review.

        Returns:
            List of pending suggestions (from database or memory)
        """
        # This would be populated by scan operations
        # In a full implementation, would query from database
        logger.info("Retrieving pending trend suggestions")
        return []

    async def _fetch_rss_articles(
        self,
        feed_url: str,
        max_articles: int = 5,
    ) -> List[dict]:
        """
        Fetch articles from an RSS feed.

        Args:
            feed_url: URL of RSS feed
            max_articles: Maximum articles to fetch

        Returns:
            List of article dictionaries with title, summary, link
        """
        def _fetch_sync():
            feed = self.feedparser.parse(feed_url)
            articles = []
            for entry in feed.entries[:max_articles]:
                articles.append({
                    "title": entry.get("title", ""),
                    "summary": entry.get("summary", ""),
                    "link": entry.get("link", ""),
                    "published": entry.get("published", ""),
                })
            return articles

        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _fetch_sync)

    async def _analyze_article(
        self,
        article: dict,
        forces: Optional[List[str]] = None,
        categories: Optional[List[str]] = None,
    ) -> List[TrendSuggestion]:
        """
        Analyze a single article for trends using LLM.

        Args:
            article: Article dict with title, summary, link
            forces: Forces to classify into
            categories: Product categories to mention

        Returns:
            List of trend suggestions from this article
        """

        forces_list = forces or [
            "Consumer", "Customer", "Technology",
            "Government", "Environmental", "Competitive"
        ]
        categories_str = ", ".join(categories) if categories else "FMCG products"

        system_prompt = f"""You are a market analyst for the beauty and personal care industry.
Analyze the provided news article and extract market trends relevant to {categories_str}.

Classify trends using one of these forces:
- Consumer: Customer preferences, behavior, demographics
- Customer: Retail, distribution, channel dynamics
- Technology: Innovation, automation, digital transformation
- Government: Regulation, policy, compliance
- Environmental: Sustainability, climate, ESG
- Competitive: Competitor actions, market consolidation

Return a JSON array of trends found. Each trend should have:
- name: Brief trend name (e.g., "Gen Z Sustainability Preferences")
- force: One of the forces above
- direction: "positive" (tailwind) or "negative" (headwind)
- estimated_impact: "low", "medium", or "high"
- confidence: 0.0 to 1.0 (how confident this trend is real)
- evidence_text: 1-2 sentences explaining the trend from the article

If no relevant trends found, return empty array []."""

        user_prompt = f"""Analyze this article:

Title: {article['title']}
Summary: {article['summary']}
URL: {article['link']}

Extract relevant market trends."""

        try:
            result = await self.provider.complete_structured(
                system_prompt,
                user_prompt,
                {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "force": {"type": "string"},
                            "direction": {"type": "string"},
                            "estimated_impact": {"type": "string"},
                            "confidence": {"type": "number"},
                            "evidence_text": {"type": "string"},
                        },
                        "required": [
                            "name", "force", "direction",
                            "estimated_impact", "confidence", "evidence_text"
                        ]
                    }
                }
            )

            suggestions = []
            for item in result:
                suggestion = TrendSuggestion(
                    name=item.get("name", "Unknown Trend"),
                    force=item.get("force", "Consumer"),
                    direction=item.get("direction", "neutral").lower(),
                    estimated_impact=item.get("estimated_impact", "medium").lower(),
                    confidence=float(item.get("confidence", 0.5)),
                    source_url=article["link"],
                    evidence_text=item.get("evidence_text", ""),
                    detected_at=datetime.now().isoformat(),
                )
                suggestions.append(suggestion)

            return suggestions

        except Exception as e:
            logger.error(f"Error analyzing article with LLM: {e}")
            return []

    async def scan_web_page(
        self,
        url: str,
        forces: Optional[List[str]] = None,
    ) -> List[TrendSuggestion]:
        """
        Scan a specific web page for trends.

        Args:
            url: URL to scan
            forces: Forces to classify into

        Returns:
            List of trend suggestions
        """
        if not self.requests:
            logger.error("requests library not available")
            return []

        try:
            def _fetch_page():
                response = self.requests.get(url, timeout=10)
                response.raise_for_status()
                return response.text

            loop = asyncio.get_event_loop()
            html = await loop.run_in_executor(None, _fetch_page)

            # Simple HTML text extraction (could use BeautifulSoup for better results)
            text = self._extract_text_from_html(html)

            # Treat as a single "article"
            article = {
                "title": url.split("/")[-1],
                "summary": text[:500],
                "link": url,
            }

            return await self._analyze_article(article, forces=forces)

        except Exception as e:
            logger.error(f"Error scanning web page {url}: {e}")
            return []

    @staticmethod
    def _extract_text_from_html(html: str) -> str:
        """Extract plain text from HTML (basic implementation)."""
        import re

        # Remove script and style elements
        html = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL)
        html = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.DOTALL)

        # Remove HTML tags
        html = re.sub(r"<[^>]+>", " ", html)

        # Remove extra whitespace
        text = re.sub(r"\s+", " ", html).strip()

        return text
