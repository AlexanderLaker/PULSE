"""Delphi expert elicitation API routes.

Endpoints for managing Delphi sessions, scoring, calibration, and consensus building.
"""

import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/delphi", tags=["delphi_elicitation"])


# ── Pydantic request/response models ────────────────────────────────────

class CreateSessionRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    trend_ids: Optional[List[str]] = None
    scorer_ids: Optional[List[str]] = None


class SubmitScoreRequest(BaseModel):
    scorer_id: str
    trend_id: str
    impact_score: int
    probability_score: int
    rationale: Optional[str] = ""


class CalibrationRequest(BaseModel):
    scorer_id: str
    responses: Dict[int, tuple]  # {exercise_idx: (impact, probability)}


class CalibrateExerciseResponse(BaseModel):
    exercise_idx: int
    impact_response: int
    probability_response: int


# ── Helper to extract PULSE state ──────────────────────────────────────

def get_delphi():
    """Get Delphi protocol instance from app state."""
    from pulse.api.app import _state
    if "delphi" not in _state:
        from pulse.elicitation.delphi import DelphiProtocol
        _state["delphi"] = DelphiProtocol()
    return _state["delphi"]


def get_trend_db():
    """Get TrendDatabase from app state."""
    from pulse.api.app import _state
    return _state.get("db")


# ── Session Management Endpoints ────────────────────────────────────────

@router.post("/sessions")
async def create_session(req: CreateSessionRequest) -> Dict[str, Any]:
    """
    Create a new Delphi session.

    Args:
        name: Session name
        description: Optional description
        trend_ids: Trend IDs to include
        scorer_ids: Scorer IDs to invite

    Returns:
        Session details with ID
    """
    try:
        delphi = get_delphi()
        session_id = delphi.create_session(
            name=req.name,
            description=req.description,
            trend_ids=req.trend_ids,
            scorer_ids=req.scorer_ids,
        )
        logger.info(f"Created Delphi session {session_id}")
        return {
            "status": "created",
            "session_id": session_id,
            "name": req.name,
        }
    except Exception as e:
        logger.error(f"Failed to create session: {e}")
        raise HTTPException(500, f"Failed to create session: {str(e)}")


@router.get("/sessions")
async def list_sessions() -> Dict[str, Any]:
    """
    List all Delphi sessions.

    Returns:
        List of session summaries
    """
    try:
        delphi = get_delphi()
        sessions = delphi.get_sessions()
        return {"sessions": sessions, "count": len(sessions)}
    except Exception as e:
        logger.error(f"Failed to list sessions: {e}")
        raise HTTPException(500, f"Failed to list sessions: {str(e)}")


@router.get("/sessions/{session_id}")
async def get_session_detail(session_id: str) -> Dict[str, Any]:
    """
    Get detailed session information including all rounds and scores.

    Args:
        session_id: Session ID

    Returns:
        Complete session details with rounds and statistics
    """
    try:
        delphi = get_delphi()
        session = delphi.get_session(session_id)
        if not session:
            raise HTTPException(404, f"Session {session_id} not found")
        return session
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get session detail: {e}")
        raise HTTPException(500, f"Failed to get session: {str(e)}")


@router.post("/sessions/{session_id}/advance")
async def advance_round(session_id: str) -> Dict[str, Any]:
    """
    Advance session to next round and return anonymized distributions for sharing.

    Args:
        session_id: Session ID

    Returns:
        Round summary with anonymized score distributions
    """
    try:
        delphi = get_delphi()
        result = delphi.advance_session_round(session_id)
        if "error" in result:
            raise HTTPException(404, result["error"])
        logger.info(f"Advanced session {session_id} to next round")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to advance round: {e}")
        raise HTTPException(500, f"Failed to advance round: {str(e)}")


@router.post("/sessions/{session_id}/complete")
async def complete_session(session_id: str) -> Dict[str, Any]:
    """
    Finalize session and compute consensus scores.

    Args:
        session_id: Session ID

    Returns:
        Completed session with consensus scores
    """
    try:
        delphi = get_delphi()
        result = delphi.complete_session(session_id)
        if "error" in result:
            raise HTTPException(404, result["error"])
        logger.info(f"Completed Delphi session {session_id}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to complete session: {e}")
        raise HTTPException(500, f"Failed to complete session: {str(e)}")


# ── Scoring Endpoints ────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/score")
async def submit_score(session_id: str, req: SubmitScoreRequest) -> Dict[str, Any]:
    """
    Submit a score for a trend in a session.
    Auto-creates session if it was lost due to Vercel cold start.

    Args:
        session_id: Session ID
        scorer_id: Scorer identifier
        trend_id: Trend ID being scored
        impact_score: Impact score (1-5)
        probability_score: Probability score (1-5)
        rationale: Optional explanation

    Returns:
        Confirmation and current round status
    """
    try:
        if not (1 <= req.impact_score <= 5):
            raise ValueError("impact_score must be between 1 and 5")
        if not (1 <= req.probability_score <= 5):
            raise ValueError("probability_score must be between 1 and 5")

        delphi = get_delphi()
        session = delphi.get_session(session_id)
        if not session:
            # Auto-create session on Vercel cold start recovery
            logger.warning(f"Session {session_id} not found, auto-creating for cold-start resilience")
            new_id = delphi.create_session(
                name="Auto-recovered Session",
                trend_ids=[],
                scorer_ids=[],
            )
            session = delphi.get_session(new_id)
            session_id = new_id
            if not session:
                raise HTTPException(500, "Failed to auto-create session")

        from pulse.elicitation.delphi import ScoringRound
        round_data = ScoringRound(
            round_number=session["current_round"],
            trend_id=req.trend_id,
            scorer_id=req.scorer_id,
            impact_score=req.impact_score,
            probability_score=req.probability_score,
            rationale=req.rationale,
        )

        delphi.submit_round(round_data, session_id=session_id)
        logger.info(
            f"Recorded score from {req.scorer_id} for trend {req.trend_id} "
            f"in session {session_id}"
        )

        return {
            "status": "recorded",
            "session_id": session_id,
            "trend_id": req.trend_id,
            "scorer_id": req.scorer_id,
            "round": session["current_round"],
        }
    except ValueError as e:
        raise HTTPException(400, str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to submit score: {e}")
        raise HTTPException(500, f"Failed to submit score: {str(e)}")


@router.get("/sessions/{session_id}/scores")
async def get_session_scores(
    session_id: str,
    round_number: Optional[int] = None,
    trend_id: Optional[str] = None,
    scorer_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Get all scores for a session with optional filtering.

    Args:
        session_id: Session ID
        round_number: Filter by round (optional)
        trend_id: Filter by trend (optional)
        scorer_id: Filter by scorer (optional)

    Returns:
        Filtered scores
    """
    try:
        delphi = get_delphi()
        session = delphi.get_session(session_id)
        if not session:
            raise HTTPException(404, f"Session {session_id} not found")

        # Apply filters
        scores = []
        for t_id, rounds in session.get("round_data", {}).items():
            if trend_id and t_id != trend_id:
                continue
            for round_data in rounds:
                if round_number and round_data["round_number"] != round_number:
                    continue
                if scorer_id and round_data["scorer_id"] != scorer_id:
                    continue
                scores.append({
                    "trend_id": t_id,
                    "round_number": round_data["round_number"],
                    "scorer_id": round_data["scorer_id"],
                    "impact_score": round_data["impact_score"],
                    "probability_score": round_data["probability_score"],
                    "rationale": round_data["rationale"],
                    "calibration_factor": round_data["calibration_factor"],
                })

        return {"scores": scores, "count": len(scores)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get scores: {e}")
        raise HTTPException(500, f"Failed to get scores: {str(e)}")


# ── Calibration Endpoints ──────────────────────────────────────────────

@router.post("/sessions/{session_id}/calibrate")
async def calibrate_scorer(session_id: str, req: CalibrationRequest) -> Dict[str, Any]:
    """
    Run calibration exercise for a scorer.

    Args:
        session_id: Session ID
        scorer_id: Scorer to calibrate
        responses: {exercise_idx: (impact, probability)}

    Returns:
        Calibration results with bias flags
    """
    try:
        delphi = get_delphi()

        # Convert tuple responses to dict
        responses_dict = {}
        for idx, (impact, prob) in req.responses.items():
            responses_dict[int(idx)] = (int(impact), int(prob))

        result = delphi.run_calibration(req.scorer_id, responses_dict)
        logger.info(f"Calibrated scorer {req.scorer_id} in session {session_id}")
        return {
            "scorer_id": req.scorer_id,
            "session_id": session_id,
            "calibration_result": result,
        }
    except Exception as e:
        logger.error(f"Failed to calibrate scorer: {e}")
        raise HTTPException(500, f"Failed to calibrate: {str(e)}")


@router.get("/sessions/{session_id}/calibration")
async def get_session_calibration(session_id: str) -> Dict[str, Any]:
    """
    Get calibration results for all scorers in a session.

    Args:
        session_id: Session ID

    Returns:
        Calibration data for all scorers
    """
    try:
        delphi = get_delphi()
        session = delphi.get_session(session_id)
        if not session:
            raise HTTPException(404, f"Session {session_id} not found")

        calibration_data = {}
        for scorer_id in session.get("scorer_ids", []):
            history = delphi.get_scorer_history(scorer_id)
            if history["calibration"]:
                calibration_data[scorer_id] = history["calibration"]

        return {
            "session_id": session_id,
            "calibrations": calibration_data,
            "calibrated_scorers": len(calibration_data),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get calibration: {e}")
        raise HTTPException(500, f"Failed to get calibration: {str(e)}")


# ── Analysis & Transparency Endpoints ──────────────────────────────────

@router.get("/sessions/{session_id}/summary")
async def get_session_summary(session_id: str) -> Dict[str, Any]:
    """
    Get round summary with anonymized distributions for sharing with scorers.

    Args:
        session_id: Session ID

    Returns:
        Anonymized score distributions (no scorer IDs)
    """
    try:
        delphi = get_delphi()
        session = delphi.get_session(session_id)
        if not session:
            raise HTTPException(404, f"Session {session_id} not found")

        return delphi.get_round_summary(session_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get round summary: {e}")
        raise HTTPException(500, f"Failed to get summary: {str(e)}")


@router.get("/sessions/{session_id}/consensus")
async def get_consensus_scores(session_id: str) -> Dict[str, Any]:
    """
    Get current consensus scores for all trends in session.

    Args:
        session_id: Session ID

    Returns:
        Consensus scores with reliability metrics
    """
    try:
        delphi = get_delphi()
        session = delphi.get_session(session_id)
        if not session:
            raise HTTPException(404, f"Session {session_id} not found")

        consensus = {}
        for trend_id in session.get("trend_ids", []):
            consensus[trend_id] = delphi.consensus_score(trend_id)

        return {
            "session_id": session_id,
            "consensus_scores": consensus,
            "trend_count": len(consensus),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get consensus: {e}")
        raise HTTPException(500, f"Failed to get consensus: {str(e)}")


@router.get("/sessions/{session_id}/scorers")
async def get_scorers_analysis(session_id: str) -> Dict[str, Any]:
    """
    Get per-scorer analysis including calibration and bias detection.

    Args:
        session_id: Session ID

    Returns:
        Analysis of each scorer's performance
    """
    try:
        delphi = get_delphi()
        session = delphi.get_session(session_id)
        if not session:
            raise HTTPException(404, f"Session {session_id} not found")

        scorers_analysis = {}
        for scorer_id in session.get("scorer_ids", []):
            history = delphi.get_scorer_history(scorer_id)
            scorers_analysis[scorer_id] = {
                "score_count": history["score_count"],
                "calibration": history["calibration"],
                "recent_scores": history["scores"][:5],  # Latest 5 scores
            }

        return {
            "session_id": session_id,
            "scorers": scorers_analysis,
            "total_scorers": len(scorers_analysis),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get scorers analysis: {e}")
        raise HTTPException(500, f"Failed to get scorers: {str(e)}")


@router.get("/sessions/{session_id}/audit")
async def get_session_audit(session_id: str) -> Dict[str, Any]:
    """
    Get full audit trail for a session.

    Args:
        session_id: Session ID

    Returns:
        Complete audit log with all changes
    """
    try:
        from pulse.database import get_db_connection, placeholder, _row_to_dict
        p = placeholder()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT * FROM audit_log
                WHERE entity_type = 'delphi' AND entity_id = {p}
                ORDER BY timestamp DESC
                """,
                (session_id,),
            )
            audit_entries = [
                {
                    "timestamp": _row_to_dict(row)["timestamp"],
                    "action": _row_to_dict(row)["action"],
                    "old_value": _row_to_dict(row)["old_value"],
                    "new_value": _row_to_dict(row)["new_value"],
                    "reason": _row_to_dict(row)["reason"],
                    "user_id": _row_to_dict(row)["user_id"],
                }
                for row in cursor.fetchall()
            ]
            return {
                "session_id": session_id,
                "audit_log": audit_entries,
                "entry_count": len(audit_entries),
            }
    except Exception as e:
        logger.error(f"Failed to get audit log: {e}")
        raise HTTPException(500, f"Failed to get audit: {str(e)}")


# ── Scorer-Specific View Endpoints ─────────────────────────────────────

@router.get("/sessions/{session_id}/scorer/{scorer_id}/view")
async def get_scorer_view(session_id: str, scorer_id: str) -> Dict[str, Any]:
    """
    Get the view a scorer sees when opening the scoring interface.

    Args:
        session_id: Session ID
        scorer_id: Scorer ID

    Returns:
        Trends to score, current round, own past scores, and group distributions
    """
    try:
        delphi = get_delphi()
        session = delphi.get_session(session_id)
        if not session:
            raise HTTPException(404, f"Session {session_id} not found")

        if scorer_id not in session.get("scorer_ids", []):
            raise HTTPException(403, f"Scorer {scorer_id} not in this session")

        # Get scorer's own history
        scorer_history = delphi.get_scorer_history(scorer_id)

        # Get trends to score
        trend_db = get_trend_db()
        trends_to_score = []
        for trend_id in session.get("trend_ids", []):
            trend = None
            if trend_db:
                trend = trend_db.get_trend_by_id(trend_id)
            trends_to_score.append({
                "id": trend_id,
                "name": trend.name if trend else trend_id,
                "description": trend.description if trend else "",
                "force": trend.force if trend else "",
                "current_impact": trend.impact if trend else None,
                "current_probability": trend.probability if trend else None,
            })

        # Get anonymized group distributions for current round
        round_summary = delphi.get_round_summary(session_id)

        return {
            "session_id": session_id,
            "scorer_id": scorer_id,
            "session_status": session["status"],
            "current_round": session["current_round"],
            "trends_to_score": trends_to_score,
            "scorer_own_scores": [
                {
                    "trend_id": s["trend_id"],
                    "round": s["round_number"],
                    "impact": s["impact_score"],
                    "probability": s["probability_score"],
                }
                for s in scorer_history["scores"][:10]
            ],
            "group_distributions": round_summary.get("trend_distributions", {}),
            "scorer_calibration": scorer_history["calibration"],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get scorer view: {e}")
        raise HTTPException(500, f"Failed to get view: {str(e)}")
