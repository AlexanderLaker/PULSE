"""
Scanner route — Bain Senior Partner-grade strategic trend intelligence.

DESIGN PHILOSOPHY (v3 — Curated Intelligence):
Instead of casting a wide net across 20+ APIs and hoping the AI filter catches
the signal in the noise, we apply the same rigor a Bain Senior Partner would:

1. STRATEGIC QUESTIONS FIRST: Define the specific strategic questions that
   matter for Henkel's profit pools — not broad keyword searches
2. DEEP RESEARCH via LLM: Use Claude as a strategic analyst who researches
   each question with the depth and rigor of a $500K consulting engagement
3. EVIDENCE STANDARD: Every trend must have a named source, specific data point,
   and clear profit pool impact mechanism
4. RELEVANCE GATE: Only trends that would survive a Bain Partner review session
   make it through — no generic buzzwords, no noise

The result: 5-15 highly relevant, deeply researched emerging trends per scan
instead of 200 semi-relevant API scraps.
"""

import asyncio
import logging
import traceback
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel, Field

from pulse.api.auth import require_auth, require_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/scanner", tags=["scanner"])


# ─── Track scan state across requests ─────────────────────────────────────
_scan_state = {
    "running": False,
    "last_run": None,
    "last_results": None,
    "progress": {},
    "errors": [],
}


# ─── Pydantic models ──────────────────────────────────────────────────────
class ScanRequest(BaseModel):
    """Request model for triggering a scan."""
    sources: Optional[List[str]] = None  # Kept for API compat (ignored in v3)
    force_filter: Optional[str] = None   # Filter by force
    limit_per_source: int = Field(50, ge=10, le=200)


class ScanStatus(BaseModel):
    """Current scan status."""
    running: bool
    last_run: Optional[str]
    progress: Dict[str, str]
    errors: List[str]
    result_count: int


class ScanResult(BaseModel):
    """Results from a completed scan."""
    trends: List[Dict[str, Any]]
    raw: Dict[str, List[Dict[str, Any]]]
    meta: Dict[str, Any]


# ═══════════════════════════════════════════════════════════════════════════
# STRATEGIC RESEARCH QUESTIONS — The Bain Partner's Issue Tree
# ═══════════════════════════════════════════════════════════════════════════
#
# These are NOT search keywords. These are the strategic questions a Senior
# Partner would ask their team to research for a Henkel strategy engagement.
# Each question targets a specific profit pool mechanism.

STRATEGIC_QUESTIONS = {
    "Consumer": [
        {
            "question": "What consumer behavioral shifts in the last 6 months could structurally change demand patterns in European hair care or laundry/home care — beyond existing trends like premiumization and private label?",
            "focus": "New demand signals, emerging consumer segments, behavioral breaks from trend",
            "evidence_bar": "Requires survey data, panel data, or retailer sell-through evidence",
        },
        {
            "question": "Are there new health, wellness, or lifestyle movements gaining traction that could create new category entry points or destroy existing ones for Henkel's categories?",
            "focus": "GLP-1 adjacencies, microbiome awareness, longevity culture, ingredient activism",
            "evidence_bar": "Google Trends acceleration, clinical trial data, regulatory pipeline",
        },
    ],
    "Government": [
        {
            "question": "What regulatory developments in the last 6 months — EU, US, or Asian — could force reformulation, packaging redesign, or marketing restrictions for FMCG hair care or home care products?",
            "focus": "PFAS updates, cosmetics omnibus amendments, PPWR implementation, DPP timelines, green claims enforcement",
            "evidence_bar": "Official gazette publications, ECHA updates, parliamentary proceedings",
        },
        {
            "question": "Are there new ingredient restrictions, testing bans, or labeling requirements moving through the regulatory pipeline that could affect Henkel's formulation costs or speed-to-market?",
            "focus": "SCCS opinions, REACH updates, biocide regulation, detergent regulation revision",
            "evidence_bar": "Named regulatory body, specific substance or product category, timeline",
        },
    ],
    "Technology": [
        {
            "question": "What technology breakthroughs in formulation science, manufacturing, packaging, or digital consumer engagement could shift competitive advantage in FMCG within 2-5 years?",
            "focus": "AI formulation, enzyme/biotech advances, smart packaging, waterless/concentrated formats at scale",
            "evidence_bar": "Patent filings, pilot results, cost-parity projections, adoption data",
        },
        {
            "question": "Are there new digital platform shifts, AI capabilities, or retail technology changes that could restructure how FMCG brands reach consumers or manage trade spend?",
            "focus": "Retail media evolution, AI-driven personalization at scale, social commerce maturation",
            "evidence_bar": "Platform data, advertiser spend shifts, conversion metrics",
        },
    ],
    "Environmental": [
        {
            "question": "What supply chain, raw material, or environmental developments could disrupt Henkel's input cost structure or sustainability positioning in the next 12-24 months?",
            "focus": "Palm oil derivatives, petrochemical feedstocks, water stress, carbon pricing implementation",
            "evidence_bar": "Commodity price data, supply disruption events, policy implementation dates",
        },
    ],
    "Competitive": [
        {
            "question": "What strategic moves by P&G, Unilever, L'Oréal, Reckitt, Church & Dwight, or emerging competitors in the last 6 months could shift profit pools in categories where Henkel competes?",
            "focus": "M&A, divestitures, category entry/exit, innovation launches, pricing moves, market entry",
            "evidence_bar": "Earnings calls, press releases, SEC/Companies House filings, trade press",
        },
        {
            "question": "Are there new competitive threats from outside traditional FMCG — DTC brands scaling, Chinese brands entering Europe, retailer private label innovation, or platform brands — that could erode Henkel's profit pools?",
            "focus": "TikTok Shop traction, Temu/Shein adjacencies, Aldi/Lidl premium PL, Amazon brands",
            "evidence_bar": "Market share data, shelf audits, e-commerce sales rankings",
        },
    ],
    "Customer": [
        {
            "question": "What channel shifts, retailer strategy changes, or trade dynamics in the last 6 months could alter Henkel's route-to-market economics or shelf access in key European markets?",
            "focus": "Discount expansion, retailer consolidation, listing fee escalation, retail media mandates",
            "evidence_bar": "Retailer financial results, channel share data, trade press",
        },
    ],
}


# ═══════════════════════════════════════════════════════════════════════════
# THE STRATEGIC RESEARCH ENGINE
# ═══════════════════════════════════════════════════════════════════════════

SYSTEM_PROMPT = """You are a Senior Partner at Bain & Company's Consumer Products practice, conducting strategic trend intelligence for Henkel Consumer Brands (HCB).

Henkel operates two divisions within HCB:
- HAIR: Color (Schwarzkopf), Care, Styling, Body — brands: Schwarzkopf, Syoss, Gliss, Schauma, got2b
- LAUNDRY & HOME CARE: Fabric Care Nearwash (Persil), Fabric Care Awaywash, Fabric Freshness, Laundry Additives, Hand Dishwash (Pril), Auto Dishwash (Somat), Home Surface Care (Bref), Insect Control

YOUR TASK: Research the strategic question below and identify 2-5 GENUINELY NEW emerging trends that are NOT already captured in Henkel's existing trend database.

EXISTING TRENDS ALREADY TRACKED (do NOT repeat these):
- Private label structural penetration in Europe
- GLP-1 drugs reshaping consumer spending
- Premiumization acceleration in hair care
- Cleanical beauty convergence
- Silver economy / aging population
- Cost-of-living squeeze and trading down
- Scalp care as standalone category
- Male grooming structural growth
- Fragrance premiumization in home care
- Hair loss treatments mainstreaming
- Gen Z dupe culture and ingredient literacy
- Post-COVID hygiene persistence
- EU PFAS restriction, Microplastics ban Phase 2
- EU Cosmetics Regulation omnibus revision
- PPWR packaging regulation, Green Claims Directive
- EUDR deforestation regulation, Digital Product Passport
- AI-driven formulation, Bio-based green chemistry
- Concentrated/solid formats innovation
- Microbiome science for hair/skin
- Manufacturing automation / Industry 4.0
- Retail media networks as FMCG channel
- AI-powered personalization, Connected appliances auto-dosing
- Palm oil B50 disruption, Water scarcity
- Carbon border adjustment / Scope 3, EPR fee escalation
- Climate-driven pest patterns, Supply chain nearshoring
- Reckitt Essential Home divestiture
- Unilever Beauty & Wellbeing pivot
- P&G Superiority Framework
- DTC/indie brand disruption in hair
- Chinese FMCG brands entering Europe
- Emerging markets IMEA growth divergence
- L'Oreal tech-beauty platform
- Discount retail expansion in Europe
- E-commerce profit pool maturation
- Retailer consolidation and power concentration
- Social commerce / TikTok Shop
- Quick commerce consolidation
- Subscription / loyalty lock-in
- Professional salon-to-consumer crossover

QUALITY STANDARD — Every trend you identify MUST pass ALL of these gates:
1. MATERIAL: Could shift a Henkel category profit pool by ≥1% within 3-5 years
2. EVIDENCED: Has at least one specific, named data point (not "experts say" or "growing trend")
3. NEW: Not a restatement of any existing trend above — must be genuinely incremental
4. ACTIONABLE: Henkel can respond strategically (invest, defend, pivot, harvest)
5. SPECIFIC: Names specific companies, regulations, technologies, or market data — not vague

If fewer than 2 trends meet this bar, return fewer. Quality over quantity. A Bain Senior Partner would rather present 2 bulletproof insights than 10 generic ones.

RESPOND IN THIS EXACT JSON FORMAT:
{
  "trends": [
    {
      "name": "Short, specific trend title (max 10 words)",
      "description": "2-3 sentences with specific data points. Name sources, numbers, dates.",
      "force": "Consumer|Government|Technology|Environmental|Competitive|Customer",
      "direction": "Expansion|Contraction",
      "suggested_gp1_pct_affected": 0.0-1.0,
      "suggested_probability": 1-5,
      "relevance_score": 0-100,
      "reasoning": "Why this matters for Henkel's profit pools specifically. Which categories? What's the mechanism?",
      "category_mapping": {
        "hair_color": 0-5, "hair_care": 0-5, "hair_styling": 0-5, "body": 0-5,
        "fcn": 0-5, "fca": 0-5, "ffi": 0-5, "lad": 0-5,
        "hdw": 0-5, "adw": 0-5, "hsc": 0-5, "ic": 0-5
      },
      "source_quality": "high|medium|low",
      "evidence_sources": ["Named source 1", "Named source 2"]
    }
  ]
}

If no trends meet the quality bar, return: {"trends": []}"""


async def _research_question(question_data: Dict[str, str], force: str) -> List[Dict[str, Any]]:
    """
    Use Claude to research a single strategic question with Bain-grade rigor.

    Returns list of curated trend objects (typically 1-4 per question).
    """
    try:
        from pulse.ai.provider import get_provider

        provider = get_provider()
        if not provider:
            logger.warning("No AI provider available — cannot run strategic research")
            return []

        user_prompt = f"""STRATEGIC QUESTION ({force} force):
{question_data['question']}

RESEARCH FOCUS: {question_data['focus']}
EVIDENCE BAR: {question_data['evidence_bar']}

Based on your knowledge of the FMCG industry through early 2026, identify genuinely new trends that meet the quality standard. Focus on developments from the last 6-12 months that represent NEW signals, not continuations of known trends."""

        # Use structured output for reliable parsing
        response = await provider.complete_structured(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            schema={
                "type": "object",
                "properties": {
                    "trends": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "description": {"type": "string"},
                                "force": {"type": "string"},
                                "direction": {"type": "string"},
                                "suggested_gp1_pct_affected": {"type": "number"},
                                "suggested_probability": {"type": "number"},
                                "relevance_score": {"type": "number"},
                                "reasoning": {"type": "string"},
                                "category_mapping": {"type": "object"},
                                "source_quality": {"type": "string"},
                                "evidence_sources": {"type": "array", "items": {"type": "string"}},
                            },
                            "required": ["name", "force", "direction", "suggested_gp1_pct_affected",
                                         "suggested_probability", "relevance_score", "reasoning"],
                        },
                    },
                },
                "required": ["trends"],
            },
        )

        trends = response.get("trends", []) if isinstance(response, dict) else []

        # Tag each trend with metadata
        for t in trends:
            t["force"] = force  # Ensure force matches the question
            t["discovered_at"] = datetime.now().isoformat()
            t["status"] = "new"
            t["scan_method"] = "strategic_research"
            # Generate stable ID from name
            import hashlib
            name_hash = hashlib.md5(t.get("name", "").encode()).hexdigest()[:8]
            t["id"] = f"scan_{force.lower()}_{name_hash}"
            # Build sources array from evidence_sources
            t["sources"] = [
                {"title": src, "url": "", "source_type": "ai_research"}
                for src in t.get("evidence_sources", [])
            ]

        return trends

    except Exception as e:
        logger.error(f"Strategic research failed for {force}: {e}\n{traceback.format_exc()}")
        return []


async def _run_full_scan(
    sources: Optional[List[str]] = None,
    force_filter: Optional[str] = None,
    limit_per_source: int = 50,
) -> Dict[str, Any]:
    """
    Run the strategic research scan — Bain Senior Partner grade.

    Instead of querying 20 APIs with broad keywords, we ask Claude to
    research specific strategic questions with rigorous evidence standards.
    """
    _scan_state["running"] = True
    _scan_state["progress"] = {}
    _scan_state["errors"] = []

    results = {
        "trends": [],
        "raw": {},
        "meta": {
            "started": datetime.now().isoformat(),
            "method": "strategic_research_v3",
            "force_filter": force_filter,
        },
    }

    # Determine which forces to research
    if force_filter and force_filter in STRATEGIC_QUESTIONS:
        forces_to_research = {force_filter: STRATEGIC_QUESTIONS[force_filter]}
    else:
        forces_to_research = STRATEGIC_QUESTIONS

    # Research each force's questions concurrently
    tasks = []
    for force, questions in forces_to_research.items():
        for i, q in enumerate(questions):
            task_key = f"{force}:Q{i+1}"
            _scan_state["progress"][task_key] = "researching"
            tasks.append((force, q, task_key))

    # Run all research questions in parallel (but limit concurrency to avoid rate limits)
    semaphore = asyncio.Semaphore(3)  # Max 3 concurrent LLM calls

    async def _bounded_research(force, question, task_key):
        async with semaphore:
            try:
                trends = await _research_question(question, force)
                _scan_state["progress"][task_key] = f"ok ({len(trends)} trends)"
                return trends
            except Exception as e:
                _scan_state["progress"][task_key] = f"error: {str(e)[:80]}"
                _scan_state["errors"].append(f"{task_key}: {str(e)[:150]}")
                return []

    all_results = await asyncio.gather(
        *[_bounded_research(f, q, tk) for f, q, tk in tasks],
        return_exceptions=True,
    )

    # Flatten results
    all_trends = []
    for result in all_results:
        if isinstance(result, Exception):
            _scan_state["errors"].append(str(result)[:200])
            continue
        if isinstance(result, list):
            all_trends.extend(result)

    # ── Deduplication by name similarity ──────────────────────────────
    seen_names = set()
    deduplicated = []
    for t in all_trends:
        name_key = "".join(c for c in t.get("name", "").lower() if c.isalnum())
        if name_key not in seen_names and len(name_key) > 5:
            seen_names.add(name_key)
            deduplicated.append(t)

    # ── Sort by relevance score (highest first) ──────────────────────
    deduplicated.sort(key=lambda t: t.get("relevance_score", 0), reverse=True)

    results["trends"] = deduplicated
    results["raw"]["strategic_research"] = all_trends
    results["meta"]["completed"] = datetime.now().isoformat()
    results["meta"]["total_trends"] = len(deduplicated)
    results["meta"]["questions_asked"] = len(tasks)
    results["meta"]["ai_model"] = "claude-opus-4-0-20250514"
    results["meta"]["ai_filtered"] = True

    _scan_state["running"] = False
    _scan_state["last_run"] = datetime.now().isoformat()
    _scan_state["last_results"] = results

    logger.info(f"Strategic scan completed: {len(deduplicated)} curated trends from {len(tasks)} questions")

    return results


# ═══════════════════════════════════════════════════════════════════════════
# API ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/status", response_model=ScanStatus)
async def scan_status(user: dict = Depends(require_auth)) -> ScanStatus:
    """Get current scan status."""
    return ScanStatus(
        running=_scan_state["running"],
        last_run=_scan_state["last_run"],
        progress=_scan_state["progress"],
        errors=_scan_state["errors"],
        result_count=len(_scan_state["last_results"]["trends"]) if _scan_state["last_results"] else 0,
    )


@router.get("/results", response_model=ScanResult)
async def scan_results(user: dict = Depends(require_auth)) -> ScanResult:
    """Get results from the last completed scan."""
    if not _scan_state["last_results"]:
        raise HTTPException(404, "No scan results available. Run a scan first.")

    results = _scan_state["last_results"]
    return ScanResult(
        trends=results["trends"],
        raw=results["raw"],
        meta=results["meta"],
    )


@router.post("/run", response_model=Dict[str, Any])
async def run_scan(req: ScanRequest = ScanRequest(), user: dict = Depends(require_admin)) -> Dict[str, Any]:
    """Run strategic trend intelligence scan (Bain Senior Partner grade).

    Researches specific strategic questions with rigorous evidence standards.
    Returns 5-15 deeply curated emerging trends.

    Takes ~30-90 seconds depending on AI provider latency.
    """
    if _scan_state["running"]:
        raise HTTPException(
            status_code=409,
            detail="Scan already in progress. Check /scanner/status for status.",
        )

    try:
        result = await _run_full_scan(
            sources=req.sources,
            force_filter=req.force_filter,
            limit_per_source=req.limit_per_source,
        )
        return result
    except Exception as e:
        _scan_state["running"] = False
        logger.error(f"Scan failed: {e}\n{traceback.format_exc()}")
        raise HTTPException(500, f"Scan failed: {str(e)[:200]}")


@router.post("/run-background", response_model=Dict[str, str])
async def run_scan_background(
    req: ScanRequest = ScanRequest(),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user: dict = Depends(require_admin),
) -> Dict[str, str]:
    """Trigger a scan in the background (non-blocking)."""
    if _scan_state["running"]:
        raise HTTPException(409, "Scan already in progress.")

    background_tasks.add_task(
        _run_full_scan,
        sources=req.sources,
        force_filter=req.force_filter,
        limit_per_source=req.limit_per_source,
    )

    return {"status": "started", "message": "Strategic research scan queued."}


@router.get("/health")
async def scanner_health() -> Dict[str, Any]:
    """Health check for scanner."""
    return {
        "scanner": "healthy",
        "method": "strategic_research_v3",
        "last_scan": _scan_state["last_run"],
        "scan_running": _scan_state["running"],
        "questions_available": sum(len(qs) for qs in STRATEGIC_QUESTIONS.values()),
    }


@router.post("/cancel")
async def cancel_scan(user: dict = Depends(require_admin)) -> Dict[str, str]:
    """Cancel the currently running scan (if any)."""
    if not _scan_state["running"]:
        return {"status": "no scan running"}
    _scan_state["running"] = False
    return {"status": "cancel requested"}


@router.get("/saved-trends")
async def get_saved_trends(user: dict = Depends(require_auth)) -> Dict[str, Any]:
    """Load previously saved scanned trends from database."""
    try:
        from pulse.database import get_db_connection, _row_to_dict, placeholder, init_db
        init_db()

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM scanned_trends ORDER BY relevance_score DESC, discovered_at DESC LIMIT 200"
            )
            rows = cursor.fetchall()
            trends = []
            for r in rows:
                row = _row_to_dict(r)
                import json as _json
                row["category_mapping"] = _json.loads(row.get("category_mapping") or "{}")
                row["sources"] = _json.loads(row.get("sources") or "[]")
                trends.append(row)
            return {"trends": trends, "count": len(trends)}
    except Exception as e:
        logger.error(f"Failed to load saved trends: {e}")
        return {"trends": [], "count": 0, "error": str(e)[:200]}


@router.post("/save-trends")
async def save_scanned_trends(body: Dict[str, Any], user: dict = Depends(require_admin)) -> Dict[str, Any]:
    """Save scanned trends to database for persistence."""
    try:
        from pulse.database import get_db_connection, placeholder, ph, init_db, USE_POSTGRES
        import json as _json
        init_db()

        trends = body.get("trends", [])
        if not trends:
            return {"saved": 0}

        p = placeholder()
        session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        saved = 0

        with get_db_connection() as conn:
            cursor = conn.cursor()
            for t in trends:
                trend_id = t.get("id", f"scan_{session_id}_{saved}")
                name = t.get("name", "Untitled")

                if USE_POSTGRES:
                    cursor.execute(
                        f"""INSERT INTO scanned_trends
                            (id, name, description, force, direction, suggested_gp1_pct_affected,
                             suggested_probability, relevance_score, category_mapping,
                             sources, discovered_at, reasoning, status, scan_session, updated_at)
                            VALUES ({ph(15)})
                            ON CONFLICT (id) DO UPDATE SET
                                description = EXCLUDED.description,
                                relevance_score = EXCLUDED.relevance_score,
                                sources = EXCLUDED.sources,
                                status = CASE
                                    WHEN scanned_trends.status IN ('added', 'dismissed') THEN scanned_trends.status
                                    ELSE 'reviewed'
                                END,
                                updated_at = EXCLUDED.updated_at""",
                        (
                            trend_id, name,
                            t.get("description", ""),
                            t.get("force", "Consumer"),
                            t.get("direction", "Expansion"),
                            t.get("suggested_gp1_pct_affected", 0.10),
                            t.get("suggested_probability", 3),
                            t.get("relevance_score", 65),
                            _json.dumps(t.get("category_mapping", {})),
                            _json.dumps(t.get("sources", [])),
                            t.get("discovered_at", datetime.now().isoformat()),
                            t.get("reasoning", ""),
                            t.get("status", "new"),
                            session_id,
                            datetime.now().isoformat(),
                        ),
                    )
                else:
                    cursor.execute(
                        f"""INSERT OR REPLACE INTO scanned_trends
                            (id, name, description, force, direction, suggested_gp1_pct_affected,
                             suggested_probability, relevance_score, category_mapping,
                             sources, discovered_at, reasoning, status, scan_session, updated_at)
                            VALUES ({ph(15)})""",
                        (
                            trend_id, name,
                            t.get("description", ""),
                            t.get("force", "Consumer"),
                            t.get("direction", "Expansion"),
                            t.get("suggested_gp1_pct_affected", 0.10),
                            t.get("suggested_probability", 3),
                            t.get("relevance_score", 65),
                            _json.dumps(t.get("category_mapping", {})),
                            _json.dumps(t.get("sources", [])),
                            t.get("discovered_at", datetime.now().isoformat()),
                            t.get("reasoning", ""),
                            t.get("status", "new"),
                            session_id,
                            datetime.now().isoformat(),
                        ),
                    )
                saved += 1

            conn.commit()

        return {"saved": saved, "session_id": session_id}
    except Exception as e:
        logger.error(f"Failed to save trends: {e}")
        raise HTTPException(500, f"Failed to save: {str(e)[:200]}")


@router.post("/update-trend-status")
async def update_trend_status(body: Dict[str, Any], user: dict = Depends(require_admin)) -> Dict[str, str]:
    """Update the status of a scanned trend (new/reviewed/added/dismissed)."""
    try:
        from pulse.database import get_db_connection, placeholder, init_db
        init_db()

        trend_id = body.get("id")
        new_status = body.get("status")
        if not trend_id or new_status not in ("new", "reviewed", "added", "dismissed"):
            raise HTTPException(400, "Invalid id or status")

        p = placeholder()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"UPDATE scanned_trends SET status = {p}, updated_at = {p} WHERE id = {p}",
                (new_status, datetime.now().isoformat(), trend_id),
            )
            conn.commit()
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e)[:200])


@router.delete("/trends/{trend_id}")
async def delete_scanned_trend(trend_id: str, user: dict = Depends(require_admin)) -> Dict[str, str]:
    """Permanently delete a single scanned trend from database."""
    try:
        from pulse.database import get_db_connection, placeholder, init_db
        init_db()
        p = placeholder()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"DELETE FROM scanned_trends WHERE id = {p}", (trend_id,))
            conn.commit()
        return {"status": "ok", "deleted": trend_id}
    except Exception as e:
        raise HTTPException(500, str(e)[:200])


@router.delete("/trends")
async def delete_scanned_trends(body: Dict[str, Any] = None, user: dict = Depends(require_admin)) -> Dict[str, Any]:
    """Delete scanned trends. If body contains 'ids', delete those. Otherwise delete ALL."""
    try:
        from pulse.database import get_db_connection, placeholder, init_db
        init_db()
        p = placeholder()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            if body and body.get("ids"):
                ids = body["ids"]
                placeholders = ", ".join([p] * len(ids))
                cursor.execute(f"DELETE FROM scanned_trends WHERE id IN ({placeholders})", tuple(ids))
                deleted = cursor.rowcount
            else:
                cursor.execute("DELETE FROM scanned_trends")
                deleted = cursor.rowcount
            conn.commit()
        return {"status": "ok", "deleted_count": deleted}
    except Exception as e:
        raise HTTPException(500, str(e)[:200])


@router.get("/forces")
async def get_force_queries(user: dict = Depends(require_auth)) -> Dict[str, Any]:
    """Get available strategic research questions by force."""
    return {
        force: [q["question"] for q in questions]
        for force, questions in STRATEGIC_QUESTIONS.items()
    }
