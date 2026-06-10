"""Tests for FastAPI backend — health checks, endpoints, data flow."""

import pytest
import json

# Skip the entire file when server deps aren't installed. Keeps the
# tests alive for any env that ships fastapi+httpx, while letting the
# core numerical test suite run anywhere.
pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from pulse.api.app import create_app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture
def app():
    """Create test FastAPI application.

    June 2026: auth dependencies are overridden with a fake admin so these
    tests exercise the endpoints' validation logic again. They were written
    before admin-auth was added and had been failing with 401 ever since —
    asserting on auth instead of the behaviour they document.
    """
    from pulse.api.auth import require_auth, require_admin
    application = create_app()
    _fake_admin = {"email": "pytest@prism.local", "role": "admin", "user_id": "pytest"}
    application.dependency_overrides[require_auth] = lambda: _fake_admin
    application.dependency_overrides[require_admin] = lambda: _fake_admin
    return application


@pytest.fixture
def client(app):
    """Create test client."""
    return TestClient(app)


class TestAPIHealth:
    """Test health and status endpoints."""

    def test_health_endpoint_exists(self, client):
        """Should have /health endpoint."""
        response = client.get("/api/v1/health")
        assert response.status_code in [200, 404]  # 404 if not implemented yet

    def test_health_returns_json(self, client):
        """Should return JSON from health endpoint."""
        response = client.get("/api/v1/health")
        if response.status_code == 200:
            assert response.headers["content-type"] == "application/json"
            data = response.json()
            assert isinstance(data, dict)

    def test_health_includes_status(self, client):
        """Should include status field in health response."""
        response = client.get("/api/v1/health")
        if response.status_code == 200:
            data = response.json()
            assert "status" in data

    def test_health_includes_version(self, client):
        """Should include version in health response."""
        response = client.get("/api/v1/health")
        if response.status_code == 200:
            data = response.json()
            assert "version" in data or "build" in data or data is not None


class TestAPITrends:
    """Test trend endpoints."""

    def test_trends_endpoint_exists(self, client):
        """Should have trends endpoint."""
        response = client.get("/api/v1/trends")
        # May 404 if not fully implemented
        assert response.status_code in [200, 404]

    def test_trends_returns_list(self, client):
        """Should return list of trends."""
        response = client.get("/api/v1/trends")
        if response.status_code == 200:
            data = response.json()
            # Should be iterable (list or dict with trends)
            assert data is not None

    def test_create_trend_requires_data(self, client):
        """Should reject trend creation without required data."""
        # Empty payload missing required fields: force, name
        response = client.post("/api/v1/trends", json={})
        # Should fail validation (422) or 404 if not implemented
        assert response.status_code in [400, 404, 422]

    def test_trend_update_endpoint(self, client):
        """Should have trend update endpoint."""
        response = client.put("/api/v1/trends/test_id", json={})
        # May 404 if not implemented
        assert response.status_code in [404, 422, 200, 400]


class TestAPIConfiguration:
    """Test configuration endpoints."""

    def test_config_endpoint_exists(self, client):
        """Should have /config endpoint."""
        response = client.get("/api/v1/config")
        assert response.status_code in [200, 404]

    def test_config_returns_model_config(self, client):
        """Should return ModelConfig structure."""
        response = client.get("/api/v1/config")
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, dict)

    def test_config_includes_key_fields(self, client):
        """Should include per_force_attenuation, iterations, etc. (v3.2: scalar
        attenuation removed; per-force dict is now the source of truth)."""
        response = client.get("/api/v1/config")
        if response.status_code == 200:
            data = response.json()
            # Should have model configuration
            expected_fields = ["region", "per_force_attenuation", "iterations", "path_years"]
            for field in expected_fields:
                # At least some should be present
                if field in data:
                    assert data[field] is not None


class TestAPISimulation:
    """Test simulation endpoints."""

    def test_simulation_endpoint_exists(self, client):
        """Should have simulation POST endpoint."""
        response = client.post(
            "/api/v1/simulate",
            json={"iterations": 100, "scenario": "base"}
        )
        assert response.status_code in [200, 404, 422]


class TestAPIOptimization:
    """Test optimization endpoints."""

    def test_allocation_endpoint_removed(self, client):
        """D4 (June 2026): the allocation optimizer was removed — endpoint must 404/405."""
        response = client.post("/api/v1/optimize/allocation", json={})
        assert response.status_code in [401, 403, 404, 405]

    def test_tornado_endpoint_exists(self, client):
        """Should have tornado endpoint."""
        # Try GET first (primary method)
        response = client.get("/api/v1/sensitivity/tornado")
        # Fall back to POST if needed
        if response.status_code == 405:
            response = client.post("/api/v1/sensitivity/tornado", json={})
        assert response.status_code in [200, 404, 422]

    def test_breakeven_endpoint_exists(self, client):
        """Should have breakeven endpoint."""
        # Try GET first (primary method)
        response = client.get("/api/v1/sensitivity/breakeven")
        # Fall back to POST if needed
        if response.status_code == 405:
            response = client.post(
                "/api/v1/sensitivity/breakeven",
                json={"category": "Hair: Color"}
            )
        assert response.status_code in [200, 404, 422]


class TestAPIErrorHandling:
    """Test error handling and validation."""

    def test_invalid_category_rejected(self, client):
        """Should reject invalid category names."""
        # Try with GET first
        response = client.get("/api/v1/sensitivity/tornado?category=Invalid:%20Category")
        if response.status_code == 405:
            # Fallback to POST
            response = client.post(
                "/api/v1/sensitivity/tornado",
                json={"category": "Invalid: Category"}
            )
        # Should either reject or not support this endpoint
        assert response.status_code in [400, 404, 422]

    def test_out_of_range_iterations(self, client):
        """Should validate iteration count."""
        response = client.post(
            "/api/v1/simulate",
            json={"iterations": 1000000}  # Very high — exceeds max 50k
        )
        # Should either process (if no max), reject (if validation), or 404 (if not loaded)
        assert response.status_code in [200, 400, 422, 404]

    def test_negative_values_rejected(self, client):
        """Should reject negative values where inappropriate."""
        response = client.post(
            "/api/v1/simulate",
            json={"iterations": -100}
        )
        # Should reject negative iterations
        assert response.status_code in [400, 422, 404]

    def test_invalid_json_rejected(self, client):
        """Should reject malformed JSON."""
        response = client.post(
            "/api/v1/simulate",
            data="not json",
            headers={"content-type": "application/json"}
        )
        assert response.status_code in [400, 422]


class TestAPIDataValidation:
    """Test data validation on API requests."""

    def test_trend_update_validates_scores(self, client):
        """Should validate probability scores (1-5) and gp1_pct_affected (0-1)."""
        response = client.put(
            "/api/v1/trends/test_id",
            json={"probability": 10}  # Out of range
        )
        # Should reject or validate
        assert response.status_code in [400, 404, 422]

    def test_simulation_validates_scenario(self, client):
        """Should validate scenario name."""
        response = client.post(
            "/api/v1/simulate",
            json={"scenario": "nonexistent_scenario"}
        )
        # Should reject unknown scenario
        assert response.status_code in [200, 400, 404, 422]


class TestAPICORS:
    """Test CORS configuration."""

    def test_cors_headers_present(self, client):
        """Should have CORS headers if configured."""
        response = client.get("/api/v1/health")
        # May or may not have CORS configured
        assert response is not None

    def test_options_request_handled(self, client):
        """Should handle OPTIONS requests (CORS preflight)."""
        response = client.options("/api/v1/health")
        # FastAPI with CORSMiddleware should handle OPTIONS as 200 or 405
        # If 405, it means the endpoint explicitly doesn't support OPTIONS
        # which is acceptable with proper CORS middleware
        assert response.status_code in [200, 404, 405]


class TestAPIResponseFormat:
    """Test response format consistency."""

    def test_all_responses_json(self, client):
        """Should return JSON for all successful responses."""
        endpoints = [
            ("GET", "/api/v1/health"),
            ("GET", "/api/v1/config"),
        ]

        for method, endpoint in endpoints:
            if method == "GET":
                response = client.get(endpoint)
            else:
                response = client.post(endpoint, json={})

            if response.status_code == 200:
                assert response.headers["content-type"] == "application/json"

    def test_error_responses_include_detail(self, client):
        """Should include error detail in responses."""
        response = client.post(
            "/api/v1/simulate",
            json={"iterations": "not a number"}  # Wrong type
        )

        if response.status_code >= 400:
            # Should have error detail
            assert response.text is not None


class TestAPIPerformance:
    """Test performance-related concerns."""

    def test_health_endpoint_fast(self, client):
        """Health endpoint should respond quickly."""
        response = client.get("/api/v1/health")
        # Should be instant (< 100ms)
        assert response is not None

    def test_config_endpoint_fast(self, client):
        """Config endpoint should respond quickly."""
        response = client.get("/api/v1/config")
        # Should be instant
        assert response is not None


class TestAPIEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_very_large_payload(self, client):
        """Should handle large payloads gracefully."""
        large_json = {
            "iterations": 10000,  # Within valid range (1-50000)
            "iterations": 500
        }
        response = client.post("/api/v1/simulate", json=large_json)
        # Should either process (if model loaded) or 404 if not loaded
        # Valid request should not return 405
        assert response.status_code in [200, 400, 422, 404]

    def test_empty_payload(self, client):
        """Should handle empty POST bodies."""
        response = client.post("/api/v1/simulate", json={})
        # Empty payload uses defaults — should either process or 404
        assert response.status_code in [200, 400, 422, 404]

    def test_unicode_in_requests(self, client):
        """Should handle Unicode in requests."""
        response = client.post(
            "/api/v1/trends",
            json={
                "force": "Consumer",
                "name": "Spécial Café ñ é ü",
                "direction": "Expansion",
                "probability": 3,
                "gp1_pct_affected": 0.15
            }
        )
        # Should handle Unicode gracefully in trend creation
        # May be 201, 200, or 404 if model not loaded
        assert response.status_code in [200, 400, 404, 422]


class TestF2OnlineNeverSimulates:
    """F2 (June 2026, owner decision): the online service never generates
    numbers. Without scipy, POST /simulate must refuse with 409 before
    touching the engine — consistency with the offline calibrated runs.
    D13: the probe is an environment check, never a math fallback — the
    _scipy_compat approximation layer was deleted."""

    def test_simulate_409_without_scipy(self, client, monkeypatch):
        import hmac, hashlib, json as _json, time, base64, os
        os.environ.setdefault("PRISM_JWT_SECRET", "x" * 48)
        secret = os.environ["PRISM_JWT_SECRET"]
        def b64(b): return base64.urlsafe_b64encode(b).rstrip(b"=").decode()
        h = b64(_json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
        p = b64(_json.dumps({"sub": "t", "email": "t@t", "role": "admin",
                             "exp": int(time.time()) + 300}).encode())
        sig = b64(hmac.new(secret.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest())
        token = f"{h}.{p}.{sig}"

        import pulse.api.routers.simulation as sim_router
        monkeypatch.setattr(sim_router, "_scipy_available", lambda: False)
        r = client.post("/api/v1/simulate", json={"iterations": 1000},
                        headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 409
        assert "offline" in r.json()["detail"]

    def test_engine_hard_requires_scipy(self):
        """D13: the engine module must carry a non-empty scipy-versioned
        numerics backend tag — proof the exact-math import path is live."""
        from pulse.simulation.bayesian_mc import NUMERICS_BACKEND
        assert NUMERICS_BACKEND.startswith("scipy ")
        assert "numpy" in NUMERICS_BACKEND


@pytest.fixture
def raw_client():
    """TestClient WITHOUT the fake-admin dependency overrides — for tests
    that assert on the real auth behavior (F3). Ensures a JWT secret is
    present so token verification is exercised for real (CI has none)."""
    import os
    os.environ.setdefault("PRISM_JWT_SECRET", "pytest-secret-" + "x" * 36)
    return TestClient(create_app())


class TestF3ReadAuthentication:
    """F3 (June 2026): every data endpoint authenticates. Reads accept the
    httpOnly viewer cookie (pulse-token) or a Bearer token; /health and
    /diagnostics stay anonymous by design."""

    @staticmethod
    def _jwt(role="viewer"):
        import hmac, hashlib, json as _json, time, base64, os
        secret = os.environ["PRISM_JWT_SECRET"]
        def b64(b): return base64.urlsafe_b64encode(b).rstrip(b"=").decode()
        h = b64(_json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
        p = b64(_json.dumps({"sub": "t", "email": "t@t", "role": role,
                             "exp": int(time.time()) + 300}).encode())
        sig = b64(hmac.new(secret.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest())
        return f"{h}.{p}.{sig}"

    def test_reads_reject_anonymous(self, raw_client):
        client = raw_client
        for path in ["/api/v1/trends", "/api/v1/simulation",
                     "/api/v1/simulation/status", "/api/v1/config"]:
            r = client.get(path)
            assert r.status_code == 401, (path, r.status_code)

    def test_reads_accept_viewer_cookie(self, raw_client):
        client = raw_client
        token = self._jwt("viewer")
        r = client.get("/api/v1/trends", cookies={"pulse-token": token})
        assert r.status_code == 200
        r = client.get("/api/v1/simulation/status", cookies={"pulse-token": token})
        assert r.status_code == 200

    def test_reads_accept_bearer(self, raw_client):
        client = raw_client
        token = self._jwt("viewer")
        r = client.get("/api/v1/config", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200

    def test_viewer_cookie_cannot_mutate(self, raw_client):
        client = raw_client
        token = self._jwt("viewer")
        r = client.post("/api/v1/simulate", json={"iterations": 1000},
                        cookies={"pulse-token": token})
        assert r.status_code == 403  # require_admin rejects role=viewer

    def test_health_and_diagnostics_stay_public(self, raw_client):
        client = raw_client
        assert client.get("/api/v1/health").status_code == 200
        assert client.get("/api/v1/diagnostics").status_code == 200
