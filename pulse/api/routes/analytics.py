"""Advanced analytics API routes — CVaR, Sobol, Tipping Points, Reverse Stress."""
import logging
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import numpy as np

from pulse.api.auth import require_auth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["advanced_analytics"])


# ── Pydantic request/response models ────────────────────────────────────

class CVaRRequest(BaseModel):
    confidence_level: float = 0.95
    compute_decomposition: bool = False


class SobolRequest(BaseModel):
    n_samples: int = 1024
    analysis_type: str = "forces"  # "forces" or "trends"


class TippingPointRequest(BaseModel):
    acceleration_threshold: float = 0.005
    thresholds: Optional[List[Dict[str, Any]]] = None


class ReverseStressRequest(BaseModel):
    target_category: str
    target_shift: float


class MultiStressRequest(BaseModel):
    targets: Dict[str, float]


class ThresholdDefRequest(BaseModel):
    """Define business thresholds for breach detection."""
    level: float
    label: str = ""
    action: str = ""


# ── Helper to extract from global state (module uses module-level injection) ────

def get_state_snapshot() -> Dict[str, Any]:
    """Get current PRISM state snapshot for analytics."""
    from pulse.api.app import _state
    return {
        "db": _state.get("db"),
        "config": _state.get("config"),
        "dag": _state.get("dag"),
        "mc_result": _state.get("mc_result"),
    }


# ── CVaR Endpoints ─────────────────────────────────────────────────────

@router.post("/cvar")
async def compute_cvar(request: CVaRRequest, user: dict = Depends(require_auth)):
    """
    Compute Conditional Value-at-Risk for all categories.

    CVaR (Expected Shortfall) answers: "Given we're in the worst X% of outcomes,
    what's the average shift?" More robust than VaR for tail risk assessment.
    """
    state = get_state_snapshot()
    mc_result = state.get("mc_result")

    if not mc_result:
        raise HTTPException(404, "No simulation results. Run a simulation first.")

    try:
        from pulse.simulation.cvar import CVaRAnalyzer

        analyzer = CVaRAnalyzer(confidence_level=request.confidence_level)

        # Extract samples from shift_matrix percentiles
        # shift_matrix structure: {category: {year: {percentile: value}}}
        shift_matrix = mc_result.get("shift_matrix", {})
        raw_samples = mc_result.get("raw_samples")  # (iterations, categories, years)

        if raw_samples is None or len(raw_samples) == 0:
            return {
                "error": "No raw samples available in simulation result",
                "note": "Run simulation with sufficient iterations"
            }

        # D2/F-04 (June 2026): CVaR is computed on the TERMINAL-YEAR samples,
        # consistent with the shift matrix shown on screen. The previous
        # mean-over-years aggregation understated tails by up to ~20%.
        categories = list(shift_matrix.keys())
        all_samples = {}
        for cat_idx, cat in enumerate(categories):
            cat_samples = raw_samples[:, cat_idx, -1]  # terminal year
            all_samples[cat] = cat_samples

        # Compute portfolio CVaR
        result = analyzer.compute_portfolio_cvar(all_samples)

        # Generate report
        report = analyzer.generate_cvar_report(result)

        return {
            "status": "success",
            "confidence_level": request.confidence_level,
            # Worst five by CVaR (ascending = most negative first) — was list-order
            "category_cvar": {cat: result["category_cvar"][cat]
                              for cat in sorted(categories,
                                                key=lambda c: result["category_cvar"][c]["cvar"])[:5]},
            "portfolio_cvar": result["portfolio_cvar"],
            "risk_contributions": result["risk_contributions"],
            "diversification_ratio": result["diversification_ratio"],
            "interpretation": result["interpretation"],
            "report": report,
        }

    except ImportError:
        raise HTTPException(500, "CVaR module not available. Ensure dependencies installed.")
    except Exception as e:
        logger.error(f"CVaR computation failed: {e}")
        raise HTTPException(500, f"CVaR computation failed: {str(e)}")


@router.get("/cvar/by-category")
async def get_cvar_by_category(category: Optional[str] = None, confidence: float = 0.95, user: dict = Depends(require_auth)):
    """Get CVaR for specific category or all."""
    state = get_state_snapshot()
    mc_result = state.get("mc_result")

    if not mc_result:
        raise HTTPException(404, "No simulation results")

    try:
        from pulse.simulation.cvar import CVaRAnalyzer

        analyzer = CVaRAnalyzer(confidence_level=confidence)
        raw_samples = mc_result.get("raw_samples")

        if raw_samples is None:
            return {"error": "No raw samples"}

        categories = list(mc_result.get("shift_matrix", {}).keys())
        if category and category in categories:
            categories = [category]

        result = {}
        for i, cat in enumerate(categories):
            cat_samples = np.mean(raw_samples[:, i, :], axis=1)
            result[cat] = analyzer.compute_cvar(cat_samples)

        return {"cvar_by_category": result}

    except Exception as e:
        raise HTTPException(500, f"Error: {str(e)}")


# ── Sobol Sensitivity Endpoints ────────────────────────────────────────

@router.post("/sobol")
async def compute_sobol(request: SobolRequest, user: dict = Depends(require_auth)):
    """
    Compute Sobol sensitivity indices (global variance-based sensitivity).

    Sobol indices reveal which inputs drive output variance:
    - S1: direct effect of each input
    - ST: total effect (direct + interactions)
    - S2: pairwise interactions

    More comprehensive than tornado analysis (which tests one-at-a-time).
    """
    state = get_state_snapshot()
    db = state.get("db")
    config = state.get("config")

    if not db or not config:
        raise HTTPException(404, "No model loaded")

    try:
        from pulse.simulation.sobol import SobolAnalyzer
        from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine

        # Use config iterations for analytics, capped for inner-loop performance
        analytics_iters = min(config.iterations, 2000)

        if request.analysis_type == "forces":
            # Sensitivity to force weight variations
            analyzer = SobolAnalyzer(n_samples=request.n_samples)

            # Create wrapper model that takes force weights and returns portfolio shift
            def force_model(weights_dict):
                # Simulate with these force weights (B4: frozen — clone, don't mutate)
                _cfg = config.copy_with(force_weights=dict(weights_dict))
                # F-02 fix: fixed seed (common random numbers across Saltelli
                # samples); second positional arg used to receive a non-seed.
                mc = BayesianMonteCarloEngine(_cfg, seed=42)
                result = mc.run(db, iterations=analytics_iters)
                shift_matrix = result.get("shift_matrix", {})
                # F-02 fix: v2.5 result shape is {cat: {"path": {year: {"median": ...}}}};
                # the old accessor [cat][2030][0.5] always returned 0 -> NaN indices.
                last_year = max(int(y) for cd in shift_matrix.values() for y in cd.get("path", {}))
                total_shift = sum(
                    cd.get("path", {}).get(last_year, {}).get("median", 0.0)
                    for cd in shift_matrix.values()
                )
                return total_shift

            sobol_result = analyzer.analyze_force_sensitivity(
                force_model,
                list(config.force_weights.keys()),
                bounds={f: (0.05, 0.40) for f in config.force_weights.keys()}
            )

            return {
                "status": "success",
                "analysis_type": "forces",
                "first_order": sobol_result.get("first_order", {}),
                "total_order": sobol_result.get("total_order", {}),
                "ranking": sobol_result.get("ranking", []),
                "top_interactions": sobol_result.get("top_interactions", []),
                "interpretation": sobol_result.get("interpretation", ""),
                "n_evaluations": sobol_result.get("n_evaluations", 0),
            }

        elif request.analysis_type == "trends":
            # Sensitivity to individual trend score variations
            analyzer = SobolAnalyzer(n_samples=request.n_samples)

            # Wrapper for trend scores
            def trend_model(score_dict):
                # F-22 fix: sweep a deep copy — the live trend DB must never
                # be mutated by an analytics request.
                import copy as _copy
                _db = _copy.deepcopy(db)
                for trend in _db.trends:
                    if trend.id in score_dict:
                        trend.probability = max(1, min(5, int(score_dict[trend.id])))
                        trend.__post_init__()

                mc = BayesianMonteCarloEngine(config, seed=42)
                result = mc.run(_db, iterations=analytics_iters)
                shift_matrix = result.get("shift_matrix", {})
                last_year = max(int(y) for cd in shift_matrix.values() for y in cd.get("path", {}))
                total_shift = sum(
                    cd.get("path", {}).get(last_year, {}).get("median", 0.0)
                    for cd in shift_matrix.values()
                )
                return total_shift

            # Top 10 trends by current normalized score
            top_trends = sorted(db.trends, key=lambda t: abs(t.normalized_score), reverse=True)[:10]
            trend_names = [t.id for t in top_trends]

            sobol_result = analyzer.analyze_trend_sensitivity(
                trend_model,
                trend_names,
                score_bounds=(1, 5)
            )

            return {
                "status": "success",
                "analysis_type": "trends",
                "first_order": sobol_result.get("first_order", {}),
                "total_order": sobol_result.get("total_order", {}),
                "ranking": sobol_result.get("ranking", []),
                "top_trends": sobol_result.get("top_trends", []),
                "interpretation": sobol_result.get("interpretation", ""),
                "n_evaluations": sobol_result.get("n_evaluations", 0),
            }

    except ImportError:
        raise HTTPException(500, "Sobol module not available. Install SALib: pip install SALib")
    except Exception as e:
        logger.error(f"Sobol analysis failed: {e}")
        raise HTTPException(500, f"Sobol analysis failed: {str(e)}")


# ── Tipping Point Detection Endpoints ───────────────────────────────────

@router.post("/tipping-points")
async def detect_tipping_points(request: TippingPointRequest, user: dict = Depends(require_auth)):
    """
    Detect tipping points and inflection points in shift paths.

    Detects:
    1. Acceleration points: d²shift/dt² exceeds threshold
    2. Sign reversals: expansion ↔ contraction transitions
    3. Threshold breaches: crossing user-defined business thresholds
    4. Inflection points: maximum rate of change
    """
    state = get_state_snapshot()
    mc_result = state.get("mc_result")

    if not mc_result:
        raise HTTPException(404, "No simulation results")

    try:
        from pulse.simulation.tipping_points import TippingPointDetector

        detector = TippingPointDetector(
            acceleration_threshold=request.acceleration_threshold,
            regime_window=2
        )

        # Extract median shift path from shift_matrix
        shift_matrix = mc_result.get("shift_matrix", {})
        median_paths = {}
        for cat, data in shift_matrix.items():
            if isinstance(data, dict) and "path" in data:
                # F-05 fix: extract scalar medians — the detector expects
                # {year: float}, not {year: {percentile: value}}.
                median_paths[cat] = {
                    int(y): (v.get("median", 0.0) if isinstance(v, dict) else float(v))
                    for y, v in data["path"].items()
                }
            else:
                # Legacy format: {year: {percentile: value}}
                median_paths[cat] = {
                    year: values.get(0.5, 0) if isinstance(values, dict) else values
                    for year, values in data.items()
                }

        # Detect tipping points across all categories
        result = detector.detect_all_categories(median_paths)

        # Add threshold breach detection if thresholds provided
        if request.thresholds:
            for cat, path in median_paths.items():
                breaches = detector.detect_threshold_breach(
                    path, request.thresholds, cat
                )
                if breaches:
                    result["tipping_points"].extend(breaches)

        # Generate report
        report = detector.generate_tipping_point_report(result)

        return {
            "status": "success",
            "tipping_points": result["tipping_points"][:20],  # Top 20
            "total_detected": result["total_detected"],
            "by_severity": {
                "critical": result["critical_count"],
                "high": result["high_count"],
                "medium": result["medium_count"],
            },
            "systemic_years": result["systemic_years"],
            "report": report,
        }

    except Exception as e:
        logger.error(f"Tipping point detection failed: {e}")
        raise HTTPException(500, f"Detection failed: {str(e)}")


# ── Reverse Stress Test Endpoints ──────────────────────────────────────

@router.post("/reverse-stress")
async def reverse_stress_test(request: ReverseStressRequest, user: dict = Depends(require_auth)):
    """
    Find minimum parameter perturbation to achieve target shift.

    Inverse analysis: "What combination of force/trend changes would cause
    Hair:Color to contract by 15%?"

    Shows how fragile each category is and which parameters matter most.
    """
    state = get_state_snapshot()
    db = state.get("db")
    config = state.get("config")

    if not db or not config:
        raise HTTPException(404, "No model loaded")

    try:
        from pulse.simulation.reverse_stress import ReverseStressTester
        from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine

        # Use config iterations, capped for inner-loop performance
        stress_iters = min(config.iterations, 3000)
        tester = ReverseStressTester(max_iterations=300)

        # Model function: vary trend scores, return category shift
        def model(score_dict):
            for trend in db.trends:
                if trend.id in score_dict:
                    trend.probability = max(1, min(5, int(score_dict[trend.id])))
                    trend.__post_init__()

            mc = BayesianMonteCarloEngine(config, state.get("dag"))
            result = mc.run(db, iterations=stress_iters)
            shift_matrix = result.get("shift_matrix", {})

            # Return shift at 2030 for target category
            cat_shifts = shift_matrix.get(request.target_category, {})
            if isinstance(cat_shifts, dict) and "path" in cat_shifts:
                return {request.target_category: cat_shifts["path"].get(2030, 0)}
            else:
                return {request.target_category: cat_shifts.get(2030, 0)}

        # Get all trend IDs
        trend_names = [t.id for t in db.trends]
        param_bounds = {t: (1, 5) for t in trend_names}
        current_values = {t.id: t.probability for t in db.trends}

        stress_result = tester.find_stress_scenario(
            model,
            request.target_category,
            request.target_shift,
            trend_names,
            param_bounds,
            current_values,
        )

        return {
            "status": "success" if "error" not in stress_result else "error",
            "result": stress_result,
        }

    except Exception as e:
        logger.error(f"Reverse stress test failed: {e}")
        raise HTTPException(500, f"Reverse stress failed: {str(e)}")


@router.post("/reverse-stress/multi")
async def multi_category_stress(request: MultiStressRequest, user: dict = Depends(require_auth)):
    """
    Find scenario hitting multiple category targets simultaneously.

    Use case: "Find parameter changes that cause Color AND Care to both
    contract by 5%."
    """
    state = get_state_snapshot()
    db = state.get("db")
    config = state.get("config")

    if not db or not config:
        raise HTTPException(404, "No model loaded")

    try:
        from pulse.simulation.reverse_stress import ReverseStressTester
        from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine

        # Use config iterations, capped for inner-loop performance
        stress_iters = min(config.iterations, 3000)
        tester = ReverseStressTester(max_iterations=400)

        def model(score_dict):
            for trend in db.trends:
                if trend.id in score_dict:
                    trend.probability = max(1, min(5, int(score_dict[trend.id])))
                    trend.__post_init__()

            mc = BayesianMonteCarloEngine(config, state.get("dag"))
            result = mc.run(db, iterations=stress_iters)
            shift_matrix = result.get("shift_matrix", {})

            return {
                cat: shift_matrix.get(cat, {}).get(2030, 0)
                for cat in request.targets.keys()
            }

        trend_names = [t.id for t in db.trends]
        param_bounds = {t: (1, 5) for t in trend_names}
        current_values = {t.id: t.probability for t in db.trends}

        stress_result = tester.find_multi_category_stress(
            model,
            request.targets,
            trend_names,
            param_bounds,
            current_values,
        )

        return {
            "status": "success" if "error" not in stress_result else "error",
            "result": stress_result,
        }

    except Exception as e:
        logger.error(f"Multi-category reverse stress failed: {e}")
        raise HTTPException(500, f"Error: {str(e)}")


# ── Health check ────────────────────────────────────────────────────────

@router.get("/health")
async def analytics_health():
    """Check if analytics modules are available."""
    state = get_state_snapshot()
    mc_result = state.get("mc_result")

    modules = {
        "cvar": True,
        "sobol": True,
        "tipping_points": True,
        "reverse_stress": True,
    }

    # Check for SALib
    try:
        import SALib
        modules["sobol_salib"] = True
    except ImportError:
        modules["sobol_salib"] = False

    return {
        "status": "ok",
        "modules": modules,
        "simulation_available": mc_result is not None,
        "ready": all(modules.values()) and mc_result is not None,
    }
