"""SEC EDGAR integration — public company filings.

FREE API. Track competitive moves via public filings.
Companies: P&G, Colgate-Palmolive, Church & Dwight, Reckitt, etc.
"""

import logging
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import aiohttp

logger = logging.getLogger(__name__)


class SECEdgarClient:
    """Client for SEC EDGAR API.

    Tracks competitive moves and strategic announcements via:
    - 10-K annual reports
    - 10-Q quarterly reports
    - 8-K current reports
    - DEF 14A proxy statements
    """

    BASE_URL = "https://data.sec.gov"

    # Key FMCG competitors' CIK numbers
    COMPANIES = {
        "PG": "0000080424",  # Procter & Gamble
        "Colgate": "0000021665",  # Colgate-Palmolive
        "CHD": "0000315293",  # Church & Dwight
        "Reckitt": "0001024341",  # Reckitt
        "Henkel": "0000062996",  # Henkel AG (if available)
    }

    def __init__(self):
        """Initialize SEC EDGAR client."""
        self.timeout = aiohttp.ClientTimeout(total=30)

    async def search_filings(
        self,
        query: str,
        limit: int = 50,
        days_back: int = 90,
    ) -> List[Dict[str, Any]]:
        """Search SEC filings for a company or keyword.

        Note: SEC EDGAR full-text search is limited. This queries by company CIK.

        Args:
            query: Company name or query term
            limit: Max results
            days_back: Only recent filings

        Returns:
            List of filing summaries
        """
        # For now, return empty as SEC EDGAR requires specific company CIK
        # In production, would use full-text search or specific company lookups
        logger.debug("SEC EDGAR search: would require specific company CIK")
        return []

    async def fetch_company_filings(
        self,
        company_cik: str,
        form_types: Optional[List[str]] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Fetch filings for a specific company by CIK.

        Args:
            company_cik: SEC CIK number (e.g., "0000080424" for P&G)
            form_types: Filter to specific forms (10-K, 10-Q, 8-K, etc.)
            limit: Max filings to return

        Returns:
            List of filings with metadata
        """
        if form_types is None:
            form_types = ["10-K", "10-Q", "8-K", "DEF 14A"]

        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            try:
                # CIK JSON endpoint
                url = f"{self.BASE_URL}/submissions/CIK{company_cik}.json"

                async with session.get(url) as response:
                    if response.status != 200:
                        logger.warning(f"SEC EDGAR error: {response.status}")
                        return []

                    data = await response.json()
                    filings = data.get("filings", {}).get("recent", {})

                    # Aggregate form details
                    results = []
                    form = filings.get("form", [])
                    accession = filings.get("accessionNumber", [])
                    filing_date = filings.get("filingDate", [])
                    report_date = filings.get("reportDate", [])

                    for idx, form_type in enumerate(form[:limit]):
                        if form_type in form_types:
                            results.append({
                                "company_cik": company_cik,
                                "form_type": form_type,
                                "accession_number": accession[idx] if idx < len(accession) else "",
                                "filing_date": filing_date[idx] if idx < len(filing_date) else "",
                                "report_date": report_date[idx] if idx < len(report_date) else "",
                            })

                    logger.info(f"SEC EDGAR: fetched {len(results)} filings for CIK {company_cik}")
                    return results

            except asyncio.TimeoutError:
                logger.warning("SEC EDGAR timeout")
                return []
            except Exception as e:
                logger.error(f"SEC EDGAR error: {e}")
                return []

    async def fetch_10k_highlights(
        self,
        company_cik: str,
    ) -> Dict[str, Any]:
        """Extract key highlights from most recent 10-K.

        Args:
            company_cik: SEC CIK number

        Returns:
            Dictionary with 10-K highlights
        """
        filings = await self.fetch_company_filings(
            company_cik,
            form_types=["10-K"],
            limit=1
        )

        if not filings:
            return {}

        latest_10k = filings[0]

        # In production, would parse the actual 10-K HTML for:
        # - Business segments and revenue
        # - Risk factors
        # - Management discussion
        # - R&D investments

        return {
            "company_cik": company_cik,
            "form": latest_10k["form_type"],
            "filing_date": latest_10k["filing_date"],
            "accession": latest_10k["accession_number"],
            "note": "Full 10-K text would require parsing HTML document",
        }

    async def track_competitor_activity(
        self,
        days_back: int = 90,
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Track recent filings from key competitors.

        Args:
            days_back: Look back period

        Returns:
            Dictionary mapping company name to recent filings
        """
        results = {}

        for company_name, cik in self.COMPANIES.items():
            try:
                filings = await self.fetch_company_filings(
                    cik,
                    limit=5,
                )
                results[company_name] = filings
            except Exception as e:
                logger.debug(f"Competitor {company_name} error: {e}")
                results[company_name] = []

        return results
