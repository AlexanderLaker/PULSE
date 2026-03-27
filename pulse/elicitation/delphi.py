"""Delphi expert elicitation protocol — structured scoring with calibration.

Replaces unstructured 1-5 scoring with formal process:
- Calibration exercises to detect scorer bias
- Inter-rater reliability measurement (Krippendorff's alpha)
- Anchoring and optimism debiasing
- Documented rationale per score
- Iterative convergence through multiple rounds

Database persistence: Saves all rounds, sessions, and calibration results to SQLite.
"""

import logging
import json
import uuid
from dataclasses import dataclass, field
from typing import Optional, Dict, List, Any
from datetime import datetime

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class ScoringRound:
    """A single round of Delphi scoring."""
    round_number: int
    trend_id: str
    scorer_id: str
    impact_score: int
    probability_score: int
    rationale: str = ""
    calibration_factor: float = 1.0      # Applied after bias detection
    bias_flags: list = field(default_factory=list)


@dataclass
class CalibrationExercise:
    """A historical question used to calibrate scorer accuracy."""
    question: str                         # "In 2020, how would you score e-commerce acceleration?"
    known_outcome_impact: int             # What actually happened (1-5)
    known_outcome_probability: int
    scorer_responses: dict = field(default_factory=dict)  # {scorer_id: (impact, prob)}


@dataclass
class DelphiSession:
    """A Delphi elicitation session groups multiple rounds for a set of trends."""
    id: str
    name: str
    description: str = ""
    status: str = "active"  # "active", "round_1", "round_2", "round_3", "completed"
    current_round: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    trend_ids: List[str] = field(default_factory=list)
    scorer_ids: List[str] = field(default_factory=list)


class DelphiProtocol:
    """
    Formal Delphi expert elicitation for trend scoring with database persistence.

    Process:
    Round 1: Independent blind scoring → collect scores + rationale
    Round 2: Share anonymized distribution → re-score with group context
    Round 3 (if needed): Discussion of outliers → final scores

    Between rounds: calibration exercises to detect systematic biases

    All sessions, rounds, and calibrations are persisted to SQLite.
    """

    def __init__(self):
        self.rounds: list[ScoringRound] = []
        self.calibration_exercises: list[CalibrationExercise] = []
        self.scorer_calibration: dict = {}  # {scorer_id: calibration_factor}
        self.scorer_bias_profiles: dict = {}
        self.sessions: Dict[str, DelphiSession] = {}  # {session_id: DelphiSession}
        self._ensure_tables_exist()
        self._load_sessions_from_db()

    def _load_sessions_from_db(self):
        """Load all sessions from database on initialization."""
        try:
            from pulse.database import get_db_connection
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM delphi_sessions")
                for row in cursor.fetchall():
                    session = DelphiSession(
                        id=row["id"],
                        name=row["name"],
                        description=row["description"],
                        status=row["status"],
                        current_round=row["current_round"],
                        created_at=datetime.fromisoformat(row["created_at"]),
                        completed_at=(
                            datetime.fromisoformat(row["completed_at"])
                            if row["completed_at"]
                            else None
                        ),
                        trend_ids=json.loads(row["trend_ids"]) if row["trend_ids"] else [],
                        scorer_ids=json.loads(row["scorer_ids"]) if row["scorer_ids"] else [],
                    )
                    self.sessions[session.id] = session

                # Load calibration data
                cursor.execute("SELECT * FROM delphi_calibration")
                for row in cursor.fetchall():
                    scorer_id = row["scorer_id"]
                    self.scorer_calibration[scorer_id] = row["calibration_factor"]
                    bias_flags = json.loads(row["bias_flags"]) if row["bias_flags"] else []
                    self.scorer_bias_profiles[scorer_id] = bias_flags

                logger.info(f"Loaded {len(self.sessions)} Delphi sessions from database")
        except Exception as e:
            logger.debug(f"Could not load sessions from DB (may not exist yet): {e}")

    def _generate_default_calibration_exercises(self) -> List[CalibrationExercise]:
        """Generate default calibration questions for scorer calibration."""
        return [
            CalibrationExercise(
                question="In 2020, how would you have scored 'E-commerce acceleration' "
                         "(impact & probability)?",
                known_outcome_impact=4,
                known_outcome_probability=5,
            ),
            CalibrationExercise(
                question="In 2019, how would you have scored 'Private label growth in retailers'?",
                known_outcome_impact=3,
                known_outcome_probability=4,
            ),
            CalibrationExercise(
                question="In 2018, how would you have scored 'Sustainability regulation tightening'?",
                known_outcome_impact=2,
                known_outcome_probability=3,
            ),
            CalibrationExercise(
                question="In 2021, how would you have scored 'Direct-to-consumer channel disruption'?",
                known_outcome_impact=3,
                known_outcome_probability=4,
            ),
        ]

    # ── Scoring Methods (Core Workflow) ───────────────────────────────────

    def start_round(self, session_id: str, round_number: int, trend_ids: List[str],
                    scorer_ids: List[str]) -> Dict[str, Any]:
        """
        Start a new scoring round for a session.

        Args:
            session_id: Session ID
            round_number: Round number (1, 2, or 3)
            trend_ids: Trends to score in this round
            scorer_ids: Scorers participating in this round

        Returns:
            Round initialization data (e.g., calibration exercise if first round)
        """
        if session_id not in self.sessions:
            return {"error": "Session not found"}

        session = self.sessions[session_id]
        session.current_round = round_number

        try:
            from pulse.database import get_db_connection
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "UPDATE delphi_sessions SET current_round = ?, status = ? WHERE id = ?",
                    (round_number, f"round_{round_number}", session_id),
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to start round: {e}")

        # If first round, prepare calibration exercises
        if round_number == 1 and not self.calibration_exercises:
            # Pre-populate with standard calibration questions
            self.calibration_exercises = self._generate_default_calibration_exercises()

        return {
            "session_id": session_id,
            "round_number": round_number,
            "trend_ids": trend_ids,
            "scorer_ids": scorer_ids,
            "status": "ready",
            "calibration_required": round_number == 1
        }

    def submit_score(self, session_id: str, round_number: int, scorer_id: str,
                     trend_id: str, impact: int, probability: int, rationale: str = "") -> Dict[str, Any]:
        """
        Submit a score from a scorer for a trend in a round.

        Args:
            session_id: Session ID
            round_number: Round number
            scorer_id: Scorer's ID
            trend_id: Trend being scored
            impact: Impact score (1-5)
            probability: Probability score (1-5)
            rationale: Optional written rationale

        Returns:
            Confirmation with any detected biases
        """
        # Validate scores
        if not (1 <= impact <= 5 and 1 <= probability <= 5):
            return {"error": "Impact and probability must be between 1 and 5"}

        # Create score record
        score = ScoringRound(
            round_number=round_number,
            trend_id=trend_id,
            scorer_id=scorer_id,
            impact_score=impact,
            probability_score=probability,
            rationale=rationale,
            calibration_factor=self.scorer_calibration.get(scorer_id, 1.0),
        )

        self.rounds.append(score)

        # Detect anchoring bias (if second round)
        anchoring_detected = False
        if round_number > 1:
            prev_rounds = [r for r in self.rounds
                           if r.trend_id == trend_id and r.scorer_id == scorer_id
                           and r.round_number == round_number - 1]
            if prev_rounds:
                prev = prev_rounds[0]
                if (prev.impact_score == impact and prev.probability_score == probability):
                    anchoring_detected = True
                    score.bias_flags.append("anchoring")

        # Persist to database
        try:
            from pulse.database import get_db_connection
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO delphi_rounds (
                        session_id, round_number, trend_id, scorer_id,
                        impact_score, probability_score, rationale,
                        calibration_factor, bias_flags
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        session_id,
                        round_number,
                        trend_id,
                        scorer_id,
                        impact,
                        probability,
                        rationale,
                        score.calibration_factor,
                        json.dumps(score.bias_flags),
                    ),
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to persist score to database: {e}")

        return {
            "status": "submitted",
            "round_number": round_number,
            "trend_id": trend_id,
            "scorer_id": scorer_id,
            "anchoring_detected": anchoring_detected,
            "bias_flags": score.bias_flags
        }

    def get_round_scores(self, session_id: str, round_number: int) -> Dict[str, Any]:
        """
        Get all scores for a round (used internally and for consensus calculation).

        Args:
            session_id: Session ID
            round_number: Round number

        Returns:
            Dict of {trend_id: [(scorer_id, impact, probability, calibration_factor)]}
        """
        scores_by_trend = {}

        try:
            from pulse.database import get_db_connection
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT trend_id, scorer_id, impact_score, probability_score, calibration_factor
                    FROM delphi_rounds
                    WHERE session_id = ? AND round_number = ?
                    ORDER BY trend_id, scorer_id
                    """,
                    (session_id, round_number),
                )

                for row in cursor.fetchall():
                    trend_id = row["trend_id"]
                    if trend_id not in scores_by_trend:
                        scores_by_trend[trend_id] = []
                    scores_by_trend[trend_id].append({
                        "scorer_id": row["scorer_id"],
                        "impact": row["impact_score"],
                        "probability": row["probability_score"],
                        "calibration_factor": row["calibration_factor"]
                    })
        except Exception as e:
            logger.error(f"Failed to load round scores: {e}")

        return scores_by_trend

    def consensus_score(self, trend_id: str, session_id: str = None,
                       use_latest_round: bool = True) -> Dict[str, Any]:
        """
        Compute weighted consensus score for a trend using calibration-weighted median.

        Args:
            trend_id: Trend ID
            session_id: Session ID (optional, if not provided uses all rounds)
            use_latest_round: If True, only use the latest round for this trend

        Returns:
            Dict with impact, probability, variance, reliability_alpha, confidence, scorers
        """
        relevant = [r for r in self.rounds if r.trend_id == trend_id]

        if session_id:
            relevant = [r for r in relevant if hasattr(r, 'session_id') and r.session_id == session_id]

        if use_latest_round and relevant:
            max_round = max(r.round_number for r in relevant)
            relevant = [r for r in relevant if r.round_number == max_round]

        if not relevant:
            return {
                "impact": 3,
                "probability": 3,
                "impact_raw": 3.0,
                "probability_raw": 3.0,
                "variance": 0.0,
                "reliability_alpha": 0.0,
                "confidence": "Low",
                "scorers": 0,
            }

        # Weighted by calibration factor
        weights = [r.calibration_factor for r in relevant]
        total_weight = sum(weights)

        if total_weight <= 0:
            total_weight = 1.0
            weights = [1.0] * len(relevant)

        w_impact = sum(r.impact_score * w for r, w in zip(relevant, weights)) / total_weight
        w_prob = sum(r.probability_score * w for r, w in zip(relevant, weights)) / total_weight

        # Compute variance
        impact_scores = [r.impact_score for r in relevant]
        variance = float(np.var(impact_scores)) if impact_scores else 0.0

        # Reliability alpha
        alpha = self.inter_rater_reliability(trend_id)
        confidence = "High" if alpha > 0.8 else "Medium" if alpha > 0.67 else "Low"

        return {
            "impact": round(w_impact),
            "probability": round(w_prob),
            "impact_raw": round(w_impact, 2),
            "probability_raw": round(w_prob, 2),
            "variance": round(variance, 2),
            "reliability_alpha": alpha,
            "confidence": confidence,
            "scorers": len(relevant),
        }

    def detect_anchoring_bias(self, trend_id: str, scorer_id: str,
                              round1: int, round2: int) -> Dict[str, Any]:
        """
        Detect anchoring bias for a scorer on a trend across two rounds.

        Anchoring = no score change despite new information.

        Args:
            trend_id: Trend ID
            scorer_id: Scorer ID
            round1: First round number
            round2: Second round number

        Returns:
            Dict with anchoring_detected, impact_change, probability_change
        """
        r1_scores = [r for r in self.rounds
                     if r.trend_id == trend_id and r.scorer_id == scorer_id
                     and r.round_number == round1]
        r2_scores = [r for r in self.rounds
                     if r.trend_id == trend_id and r.scorer_id == scorer_id
                     and r.round_number == round2]

        if not r1_scores or not r2_scores:
            return {
                "anchoring_detected": False,
                "reason": "Missing scores in one or both rounds",
                "impact_change": None,
                "probability_change": None
            }

        r1 = r1_scores[0]
        r2 = r2_scores[0]

        impact_change = abs(r2.impact_score - r1.impact_score)
        prob_change = abs(r2.probability_score - r1.probability_score)

        # Anchoring = no change at all
        anchoring_detected = (impact_change == 0 and prob_change == 0)

        return {
            "anchoring_detected": anchoring_detected,
            "trend_id": trend_id,
            "scorer_id": scorer_id,
            "round1": round1,
            "round2": round2,
            "impact_change": impact_change,
            "probability_change": prob_change,
            "round1_impact": r1.impact_score,
            "round1_probability": r1.probability_score,
            "round2_impact": r2.impact_score,
            "round2_probability": r2.probability_score,
        }

    def detect_optimism_bias(self, scorer_id: str) -> Dict[str, Any]:
        """
        Detect optimism bias: scorer systematically overscores expansion forces
        and underscores contraction forces.

        Args:
            scorer_id: Scorer ID

        Returns:
            Dict with optimism_detected, correction_factor, explanation
        """
        scorer_rounds = [r for r in self.rounds if r.scorer_id == scorer_id]

        if not scorer_rounds:
            return {
                "optimism_detected": False,
                "reason": "No scores available for this scorer",
                "correction_factor": 1.0
            }

        # Try to get trend direction info (if available from database)
        expansion_scores = []
        contraction_scores = []

        try:
            from pulse.database import get_trend_by_id
            for sr in scorer_rounds:
                trend = get_trend_by_id(sr.trend_id)
                if trend:
                    avg_score = (sr.impact_score + sr.probability_score) / 2.0
                    if trend.direction == "Expansion":
                        expansion_scores.append(avg_score)
                    elif trend.direction == "Contraction":
                        contraction_scores.append(avg_score)
        except:
            # If no database access, use heuristic based on score distribution
            pass

        if not expansion_scores and not contraction_scores:
            # Fallback: check if scorer tends to score high
            all_scores = [(r.impact_score + r.probability_score) / 2.0 for r in scorer_rounds]
            mean_score = float(np.mean(all_scores)) if all_scores else 3.0
            optimism_detected = mean_score > 3.5
            correction_factor = 0.95 if optimism_detected else 1.0
        else:
            # Compare average scores
            mean_expansion = float(np.mean(expansion_scores)) if expansion_scores else 3.0
            mean_contraction = float(np.mean(contraction_scores)) if contraction_scores else 3.0

            # Optimism: expansion >> contraction
            diff = mean_expansion - mean_contraction
            optimism_detected = diff > 1.0

            correction_factor = 0.95 if optimism_detected else 1.0

        return {
            "optimism_detected": optimism_detected,
            "scorer_id": scorer_id,
            "correction_factor": round(correction_factor, 3),
            "mean_expansion_score": round(mean_expansion, 2) if expansion_scores else None,
            "mean_contraction_score": round(mean_contraction, 2) if contraction_scores else None,
            "bias_flags": ["optimism_bias"] if optimism_detected else []
        }

    def inter_rater_reliability(self, trend_id: str,
                                round_number: Optional[int] = None) -> float:
        """
        Compute Krippendorff's alpha for inter-rater reliability.

        α > 0.8: excellent agreement
        α 0.67-0.8: acceptable
        α < 0.67: poor — needs another round

        Simplified implementation using coefficient of variation.

        Args:
            trend_id: Trend ID
            round_number: Specific round (optional)

        Returns:
            float between 0.0 and 1.0
        """
        relevant = [r for r in self.rounds if r.trend_id == trend_id]
        if round_number:
            relevant = [r for r in relevant if r.round_number == round_number]

        if len(relevant) < 2:
            return 1.0  # Single scorer = perfect agreement with self

        impact_scores = [r.impact_score for r in relevant]
        prob_scores = [r.probability_score for r in relevant]

        # Use coefficient of variation as reliability proxy
        if np.std(impact_scores) == 0 and np.std(prob_scores) == 0:
            return 1.0  # Perfect agreement

        mean_impact = max(np.mean(impact_scores), 1)
        mean_prob = max(np.mean(prob_scores), 1)

        cv_impact = np.std(impact_scores) / mean_impact
        cv_prob = np.std(prob_scores) / mean_prob

        # Convert CV to alpha-like metric (lower CV = higher agreement)
        alpha = 1.0 - (cv_impact + cv_prob) / 2.0
        return round(max(0.0, min(1.0, alpha)), 3)

    def calibration_exercise(self, scorer_id: str, known_outcomes: Dict[str, tuple]) -> Dict[str, Any]:
        """
        Run calibration exercises for a scorer against known historical outcomes.

        Args:
            scorer_id: Scorer's ID
            known_outcomes: {exercise_idx: (known_impact, known_probability)}

        Returns:
            Calibration profile with correction factor and detected biases
        """
        if not self.calibration_exercises:
            return {
                "calibration_factor": 1.0,
                "biases": [],
                "mean_impact_error": 0.0,
                "mean_prob_error": 0.0,
                "note": "No calibration exercises available"
            }

        impact_errors = []
        prob_errors = []

        for idx, (impact_guess, prob_guess) in known_outcomes.items():
            if idx < len(self.calibration_exercises):
                ex = self.calibration_exercises[idx]
                impact_errors.append(impact_guess - ex.known_outcome_impact)
                prob_errors.append(prob_guess - ex.known_outcome_probability)

        biases = []
        calibration_factor = 1.0

        if impact_errors and prob_errors:
            mean_impact_error = float(np.mean(impact_errors))
            mean_prob_error = float(np.mean(prob_errors))

            # Optimism bias: systematically underestimate negative trends
            if mean_impact_error < -0.5:
                biases.append("optimism_bias")
                calibration_factor *= 1.1

            # Pessimism bias: overestimate negative trends
            if mean_impact_error > 0.5:
                biases.append("pessimism_bias")
                calibration_factor *= 0.9

            # Probability neglect: all probabilities scored similarly
            if prob_errors and len(set([round(e) for e in prob_errors])) <= 1:
                biases.append("probability_neglect")
                calibration_factor *= 1.05

        self.scorer_calibration[scorer_id] = calibration_factor
        self.scorer_bias_profiles[scorer_id] = biases

        # Persist to database
        try:
            from pulse.database import get_db_connection
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "DELETE FROM delphi_calibration WHERE scorer_id = ?",
                    (scorer_id,)
                )
                cursor.execute(
                    """
                    INSERT INTO delphi_calibration (
                        scorer_id, calibration_factor, bias_flags,
                        mean_impact_error, mean_prob_error
                    ) VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        scorer_id,
                        calibration_factor,
                        json.dumps(biases),
                        round(float(np.mean(impact_errors)), 2) if impact_errors else 0,
                        round(float(np.mean(prob_errors)), 2) if prob_errors else 0,
                    ),
                )
                conn.commit()
        except Exception as e:
            logger.debug(f"Could not persist calibration to database: {e}")

        return {
            "scorer_id": scorer_id,
            "calibration_factor": round(calibration_factor, 3),
            "biases": biases,
            "mean_impact_error": round(float(np.mean(impact_errors)), 2) if impact_errors else 0.0,
            "mean_prob_error": round(float(np.mean(prob_errors)), 2) if prob_errors else 0.0,
            "exercises_completed": len(impact_errors)
        }

    # ── Session Management ─────────────────────────────────────────────────

    def create_session(
        self, name: str, description: str = "", trend_ids: List[str] = None, scorer_ids: List[str] = None
    ) -> str:
        """
        Create a new Delphi session.

        Args:
            name: Session name (e.g., "Q2 2026 Strategic Planning")
            description: Optional description
            trend_ids: IDs of trends to score in this session
            scorer_ids: IDs of experts participating

        Returns:
            Session ID
        """
        session_id = str(uuid.uuid4())
        session = DelphiSession(
            id=session_id,
            name=name,
            description=description,
            trend_ids=trend_ids or [],
            scorer_ids=scorer_ids or [],
        )
        self.sessions[session_id] = session

        # Persist to database
        try:
            from pulse.database import get_db_connection
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO delphi_sessions (
                        id, name, description, status, current_round,
                        trend_ids, scorer_ids
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        session_id,
                        name,
                        description,
                        session.status,
                        session.current_round,
                        json.dumps(trend_ids or []),
                        json.dumps(scorer_ids or []),
                    ),
                )
                conn.commit()
                logger.info(f"Created Delphi session {session_id}: {name}")
        except Exception as e:
            logger.error(f"Failed to persist session to database: {e}")

        return session_id

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed session information including all rounds and scores.

        Args:
            session_id: Session ID

        Returns:
            Session details with rounds and statistics, or None if not found
        """
        if session_id not in self.sessions:
            return None

        session = self.sessions[session_id]

        # Load all rounds for this session from database
        try:
            from pulse.database import get_db_connection
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT * FROM delphi_rounds
                    WHERE session_id = ?
                    ORDER BY round_number, trend_id, scorer_id
                    """,
                    (session_id,),
                )

                rounds_by_trend = {}
                for row in cursor.fetchall():
                    trend_id = row["trend_id"]
                    if trend_id not in rounds_by_trend:
                        rounds_by_trend[trend_id] = []
                    rounds_by_trend[trend_id].append(
                        {
                            "round_number": row["round_number"],
                            "scorer_id": row["scorer_id"],
                            "impact_score": row["impact_score"],
                            "probability_score": row["probability_score"],
                            "rationale": row["rationale"],
                            "calibration_factor": row["calibration_factor"],
                            "bias_flags": json.loads(row["bias_flags"]) if row["bias_flags"] else [],
                        }
                    )

                # Compute per-trend statistics
                trend_stats = {}
                for trend_id, rounds in rounds_by_trend.items():
                    if rounds:
                        latest_round = max(r["round_number"] for r in rounds)
                        latest_scores = [r for r in rounds if r["round_number"] == latest_round]
                        impact_scores = [r["impact_score"] for r in latest_scores]
                        prob_scores = [r["probability_score"] for r in latest_scores]

                        trend_stats[trend_id] = {
                            "impact": {
                                "median": int(np.median(impact_scores)),
                                "mean": round(float(np.mean(impact_scores)), 2),
                                "std": round(float(np.std(impact_scores)), 2),
                                "min": int(np.min(impact_scores)),
                                "max": int(np.max(impact_scores)),
                            },
                            "probability": {
                                "median": int(np.median(prob_scores)),
                                "mean": round(float(np.mean(prob_scores)), 2),
                                "std": round(float(np.std(prob_scores)), 2),
                                "min": int(np.min(prob_scores)),
                                "max": int(np.max(prob_scores)),
                            },
                            "scorer_count": len(set(r["scorer_id"] for r in latest_scores)),
                            "agreement_alpha": self.inter_rater_reliability(trend_id),
                        }

                return {
                    "id": session.id,
                    "name": session.name,
                    "description": session.description,
                    "status": session.status,
                    "current_round": session.current_round,
                    "created_at": session.created_at.isoformat(),
                    "completed_at": session.completed_at.isoformat() if session.completed_at else None,
                    "trend_ids": session.trend_ids,
                    "scorer_ids": session.scorer_ids,
                    "trends": trend_stats,
                    "round_data": rounds_by_trend,
                }
        except Exception as e:
            logger.error(f"Failed to load session details: {e}")
            return None

    def get_sessions(self) -> List[Dict[str, Any]]:
        """
        Get list of all sessions.

        Returns:
            List of session summaries
        """
        return [
            {
                "id": s.id,
                "name": s.name,
                "description": s.description,
                "status": s.status,
                "current_round": s.current_round,
                "created_at": s.created_at.isoformat(),
                "completed_at": s.completed_at.isoformat() if s.completed_at else None,
                "trend_count": len(s.trend_ids),
                "scorer_count": len(s.scorer_ids),
            }
            for s in self.sessions.values()
        ]

    def get_scorer_history(self, scorer_id: str) -> Dict[str, Any]:
        """
        Get all scores for a scorer across all sessions.

        Args:
            scorer_id: Scorer identifier

        Returns:
            Scoring history and calibration profile
        """
        try:
            from pulse.database import get_db_connection
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT session_id, round_number, trend_id, impact_score,
                           probability_score, rationale, calibration_factor, bias_flags
                    FROM delphi_rounds
                    WHERE scorer_id = ?
                    ORDER BY session_id, round_number DESC
                    """,
                    (scorer_id,),
                )

                scores = []
                for row in cursor.fetchall():
                    scores.append(
                        {
                            "session_id": row["session_id"],
                            "round_number": row["round_number"],
                            "trend_id": row["trend_id"],
                            "impact_score": row["impact_score"],
                            "probability_score": row["probability_score"],
                            "rationale": row["rationale"],
                            "calibration_factor": row["calibration_factor"],
                            "bias_flags": json.loads(row["bias_flags"]) if row["bias_flags"] else [],
                        }
                    )

                # Get calibration data
                cursor.execute(
                    "SELECT * FROM delphi_calibration WHERE scorer_id = ?",
                    (scorer_id,),
                )
                calibration_row = cursor.fetchone()
                calibration = None
                if calibration_row:
                    calibration = {
                        "calibration_factor": calibration_row["calibration_factor"],
                        "bias_flags": json.loads(calibration_row["bias_flags"]) if calibration_row["bias_flags"] else [],
                        "mean_impact_error": calibration_row["mean_impact_error"],
                        "mean_prob_error": calibration_row["mean_prob_error"],
                        "calibrated_at": calibration_row["calibrated_at"],
                    }

                return {
                    "scorer_id": scorer_id,
                    "score_count": len(scores),
                    "scores": scores,
                    "calibration": calibration,
                }
        except Exception as e:
            logger.error(f"Failed to load scorer history: {e}")
            return {"scorer_id": scorer_id, "score_count": 0, "scores": [], "calibration": None}

    def advance_session_round(self, session_id: str) -> Dict[str, Any]:
        """
        Advance session to next round and return anonymized distribution for sharing.

        Args:
            session_id: Session ID

        Returns:
            Current round summary with anonymized score distributions
        """
        if session_id not in self.sessions:
            return {"error": "Session not found"}

        session = self.sessions[session_id]
        session.current_round += 1
        session.status = f"round_{session.current_round}"

        # Persist to database
        try:
            from pulse.database import get_db_connection
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "UPDATE delphi_sessions SET current_round = ?, status = ? WHERE id = ?",
                    (session.current_round, session.status, session_id),
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to update session: {e}")

        return self.get_round_summary(session_id, session.current_round - 1)

    def complete_session(self, session_id: str) -> Dict[str, Any]:
        """
        Finalize session, compute consensus scores, and optionally apply to trends.

        Args:
            session_id: Session ID

        Returns:
            Final consensus scores and metadata
        """
        if session_id not in self.sessions:
            return {"error": "Session not found"}

        session = self.sessions[session_id]
        session.status = "completed"
        session.completed_at = datetime.utcnow()

        # Persist to database
        try:
            from pulse.database import get_db_connection
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "UPDATE delphi_sessions SET status = ?, completed_at = ? WHERE id = ?",
                    (session.status, session.completed_at.isoformat(), session_id),
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to complete session: {e}")

        # Compute consensus for all trends
        consensus_scores = {}
        for trend_id in session.trend_ids:
            consensus_scores[trend_id] = self.consensus_score(trend_id)

        return {
            "session_id": session_id,
            "status": session.status,
            "completed_at": session.completed_at.isoformat(),
            "consensus_scores": consensus_scores,
        }

    def apply_consensus_to_trends(self, session_id: str, trend_db: Any = None) -> Dict[str, Any]:
        """
        Apply consensus scores from a completed session back to the trend database.

        Args:
            session_id: Session ID
            trend_db: TrendDatabase object to update (optional)

        Returns:
            Summary of applied changes
        """
        if session_id not in self.sessions:
            return {"error": "Session not found"}

        session = self.sessions[session_id]
        if session.status != "completed":
            return {"error": "Session not completed"}

        applied = {}
        try:
            from pulse.database import log_audit, get_trend_by_id, get_db_connection

            for trend_id in session.trend_ids:
                consensus = self.consensus_score(trend_id)

                if trend_db:
                    trend = trend_db.get_trend_by_id(trend_id)
                    if trend:
                        old_impact = trend.impact
                        old_prob = trend.probability
                        trend.impact = consensus["impact"]
                        trend.probability = consensus["probability"]
                        trend.scorer_count = consensus["scorers"]
                        trend.score_variance = consensus["variance"]
                        trend.debiasing_applied = True
                        trend.__post_init__()

                        log_audit(
                            "UPDATE",
                            "trend",
                            trend_id,
                            old_value=f"impact={old_impact}, prob={old_prob}",
                            new_value=f"impact={consensus['impact']}, prob={consensus['probability']}",
                            reason=f"Delphi consensus (session {session_id})",
                            user_id="delphi_protocol",
                        )

                        applied[trend_id] = {
                            "impact": consensus["impact"],
                            "probability": consensus["probability"],
                            "reliability_alpha": consensus["reliability_alpha"],
                        }

            # Also update in database if available
            with get_db_connection() as conn:
                cursor = conn.cursor()
                for trend_id, update in applied.items():
                    cursor.execute(
                        """
                        UPDATE trends
                        SET impact = ?, probability = ?, debiasing_applied = ?, updated_at = ?
                        WHERE id = ?
                        """,
                        (
                            update["impact"],
                            update["probability"],
                            True,
                            datetime.utcnow().isoformat(),
                            trend_id,
                        ),
                    )
                conn.commit()

            return {"status": "success", "applied": applied}
        except Exception as e:
            logger.error(f"Failed to apply consensus: {e}")
            return {"error": str(e)}

    def add_calibration_exercise(self, exercise: CalibrationExercise):
        """Add a historical calibration question."""
        self.calibration_exercises.append(exercise)

    def get_round_summary(self, session_id: str, round_number: int = None) -> Dict[str, Any]:
        """
        Get anonymized distribution summary for a round to share with scorers.

        Args:
            session_id: Session ID
            round_number: Round number (if None, uses current round)

        Returns:
            Anonymized distributions for all trends in the session
        """
        if session_id not in self.sessions:
            return {"error": "Session not found"}

        session = self.sessions[session_id]
        if round_number is None:
            round_number = max(session.current_round, 1)

        try:
            from pulse.database import get_db_connection
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT trend_id, impact_score, probability_score, calibration_factor
                    FROM delphi_rounds
                    WHERE session_id = ? AND round_number = ?
                    ORDER BY trend_id
                    """,
                    (session_id, round_number),
                )

                distributions = {}
                for row in cursor.fetchall():
                    trend_id = row["trend_id"]
                    if trend_id not in distributions:
                        distributions[trend_id] = {"impact": [], "probability": []}
                    distributions[trend_id]["impact"].append(row["impact_score"])
                    distributions[trend_id]["probability"].append(row["probability_score"])

                # Compute stats (anonymized, no scorer IDs)
                summary = {}
                for trend_id, scores in distributions.items():
                    impact_scores = scores["impact"]
                    prob_scores = scores["probability"]
                    summary[trend_id] = {
                        "impact": {
                            "median": int(np.median(impact_scores)),
                            "mean": round(float(np.mean(impact_scores)), 2),
                            "std": round(float(np.std(impact_scores)), 2),
                            "min": int(np.min(impact_scores)),
                            "max": int(np.max(impact_scores)),
                            "count": len(impact_scores),
                        },
                        "probability": {
                            "median": int(np.median(prob_scores)),
                            "mean": round(float(np.mean(prob_scores)), 2),
                            "std": round(float(np.std(prob_scores)), 2),
                            "min": int(np.min(prob_scores)),
                            "max": int(np.max(prob_scores)),
                            "count": len(prob_scores),
                        },
                    }

                return {
                    "session_id": session_id,
                    "round_number": round_number,
                    "trend_distributions": summary,
                    "note": "Scores are anonymized. No scorer IDs are included in this distribution.",
                }
        except Exception as e:
            logger.error(f"Failed to get round summary: {e}")
            return {"error": str(e)}

    def _ensure_tables_exist(self):
        """Ensure Delphi-specific database tables exist (called during init)."""
        try:
            from pulse.database import get_db_connection
            with get_db_connection() as conn:
                cursor = conn.cursor()

                # Create delphi_sessions table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS delphi_sessions (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        description TEXT DEFAULT '',
                        status TEXT DEFAULT 'active',
                        current_round INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        completed_at TIMESTAMP,
                        trend_ids TEXT,
                        scorer_ids TEXT
                    )
                """)

                # Create delphi_calibration table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS delphi_calibration (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        session_id TEXT REFERENCES delphi_sessions(id),
                        scorer_id TEXT NOT NULL,
                        calibration_factor REAL DEFAULT 1.0,
                        bias_flags TEXT,
                        mean_impact_error REAL DEFAULT 0,
                        mean_prob_error REAL DEFAULT 0,
                        calibrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)

                # Add session_id column to delphi_rounds if it doesn't exist
                cursor.execute("PRAGMA table_info(delphi_rounds)")
                columns = [col[1] for col in cursor.fetchall()]
                if "session_id" not in columns:
                    cursor.execute("""
                        ALTER TABLE delphi_rounds ADD COLUMN session_id TEXT REFERENCES delphi_sessions(id)
                    """)

                conn.commit()
                logger.info("Delphi database tables ensured")
        except Exception as e:
            logger.debug(f"Delphi tables may already exist: {e}")

