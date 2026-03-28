"""
Unit tests for scanner API routes.

Tests cover:
- Scanner status endpoint
- Scan triggering (sync and async)
- Result retrieval
- Force query templates
- Error handling and resilience
"""

import pytest
import asyncio
import json
from datetime import datetime
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient

from pulse.api.routes.scanner import (
    _scan_source,
    _run_full_scan,
    FORCE_QUERIES,
    _scan_state,
)


class TestScannerState:
    """Test scanner state management."""

    def test_initial_state(self):
        """Verify initial scan state."""
        assert _scan_state["running"] is False
        assert _scan_state["last_run"] is None or isinstance(_scan_state["last_run"], str)
        assert isinstance(_scan_state["progress"], dict)
        assert isinstance(_scan_state["errors"], list)

    def test_force_queries_exist(self):
        """Verify all 6 forces have query templates."""
        expected_forces = {"Consumer", "Government", "Technology", "Environmental", "Competitive", "Customer"}
        assert set(FORCE_QUERIES.keys()) == expected_forces

    def test_force_queries_content(self):
        """Verify each force has multiple queries."""
        for force, queries in FORCE_QUERIES.items():
            assert isinstance(queries, list)
            assert len(queries) >= 3, f"Force {force} has only {len(queries)} queries"
            for query in queries:
                assert isinstance(query, str)
                assert len(query) > 0


class TestScanSource:
    """Test _scan_source() function with various integrations."""

    @pytest.mark.asyncio
    async def test_scan_source_unknown(self):
        """Test handling of unknown source."""
        source, results, error = await _scan_source("unknown_source", "test query", 50)
        assert source == "unknown_source"
        assert results == []
        assert error is not None
        assert "Unknown source" in error

    @pytest.mark.asyncio
    async def test_scan_source_gdelt_success(self):
        """Test GDELT scan with mocked client."""
        with patch("pulse.integrations.gdelt.GDELTClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.fetch_articles = AsyncMock(return_value=[
                {"title": "Test Article", "source": "GDELT"}
            ])
            mock_client_class.return_value = mock_client

            source, results, error = await _scan_source("gdelt", "test query", 50)

            assert source == "gdelt"
            assert len(results) == 1
            assert error is None
            mock_client.fetch_articles.assert_called_once()

    @pytest.mark.asyncio
    async def test_scan_source_error_handling(self):
        """Test graceful error handling in scan source."""
        with patch("pulse.integrations.gdelt.GDELTClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.fetch_articles = AsyncMock(side_effect=Exception("API Error"))
            mock_client_class.return_value = mock_client

            source, results, error = await _scan_source("gdelt", "test query", 50)

            assert source == "gdelt"
            assert results == []
            assert error is not None
            assert "API Error" in error or "Exception" in error


class TestScanExecution:
    """Test full scan execution."""

    @pytest.mark.asyncio
    async def test_run_full_scan_basic(self):
        """Test basic scan execution."""
        # This is an integration test; mock all sources to avoid real API calls
        with patch("pulse.api.routes.scanner._scan_source", new_callable=AsyncMock) as mock_scan:
            mock_scan.return_value = ("mock_source", [{"title": "Test"}], None)

            results = await _run_full_scan(
                sources=["gdelt", "gnews"],
                force_filter=None,
                limit_per_source=10,
            )

            assert "trends" in results
            assert "raw" in results
            assert "meta" in results
            assert results["meta"]["started"] is not None

    @pytest.mark.asyncio
    async def test_run_full_scan_with_force_filter(self):
        """Test scan with force filtering."""
        with patch("pulse.api.routes.scanner._scan_source", new_callable=AsyncMock) as mock_scan:
            mock_scan.return_value = ("mock_source", [], None)

            results = await _run_full_scan(
                sources=["gdelt"],
                force_filter="Consumer",
                limit_per_source=10,
            )

            assert results["meta"]["force_filter"] == "Consumer"

    @pytest.mark.asyncio
    async def test_run_full_scan_deduplication(self):
        """Test that duplicate trends are deduplicated by title."""
        with patch("pulse.api.routes.scanner._scan_source", new_callable=AsyncMock) as mock_scan:
            # Return same trend from multiple sources
            duplicate_trend = {"title": "Duplicate Trend", "source": "mock"}
            mock_scan.return_value = ("mock_source", [duplicate_trend, duplicate_trend], None)

            results = await _run_full_scan(
                sources=["gdelt", "gnews"],
                force_filter=None,
                limit_per_source=10,
            )

            # Count occurrences of title in results
            duplicate_count = sum(1 for t in results["trends"] if t.get("title") == "Duplicate Trend")
            assert duplicate_count == 1, "Duplicates should be removed"

    @pytest.mark.asyncio
    async def test_scan_prevents_concurrent_runs(self):
        """Test that concurrent scans are prevented."""
        # Set state to running
        _scan_state["running"] = True

        try:
            with pytest.raises(Exception):  # Should raise HTTPException
                await _run_full_scan()
        finally:
            # Reset state
            _scan_state["running"] = False


class TestScannerEndpoints:
    """Test scanner API endpoints (requires FastAPI test client)."""

    @pytest.mark.asyncio
    async def test_status_endpoint(self):
        """Test /scanner/status endpoint."""
        from fastapi.testclient import TestClient
        from pulse.api.app import app

        with TestClient(app) as client:
            response = client.get("/api/v1/scanner/status")
            assert response.status_code == 200
            data = response.json()
            assert "running" in data
            assert "last_run" in data
            assert "progress" in data
            assert "errors" in data
            assert "result_count" in data

    @pytest.mark.asyncio
    async def test_forces_endpoint(self):
        """Test /scanner/forces endpoint."""
        from fastapi.testclient import TestClient
        from pulse.api.app import app

        with TestClient(app) as client:
            response = client.get("/api/v1/scanner/forces")
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, dict)
            for force, queries in data.items():
                assert isinstance(queries, list)
                assert len(queries) > 0

    @pytest.mark.asyncio
    async def test_health_endpoint(self):
        """Test /scanner/health endpoint."""
        from fastapi.testclient import TestClient
        from pulse.api.app import app

        with TestClient(app) as client:
            response = client.get("/api/v1/scanner/health")
            assert response.status_code == 200
            data = response.json()
            assert "scanner" in data
            assert "integrations_available" in data
            assert isinstance(data["integrations_available"], list)
            assert len(data["integrations_available"]) > 15

    @pytest.mark.asyncio
    async def test_run_scan_endpoint_validation(self):
        """Test request validation for /scanner/run endpoint."""
        from fastapi.testclient import TestClient
        from pulse.api.app import app

        with TestClient(app) as client:
            # Test invalid limit_per_source
            response = client.post(
                "/api/v1/scanner/run",
                json={"limit_per_source": 5},  # Too low (< 10)
            )
            assert response.status_code == 422  # Validation error

            # Test valid request structure
            response = client.post(
                "/api/v1/scanner/run",
                json={
                    "sources": ["gdelt"],
                    "force_filter": "Consumer",
                    "limit_per_source": 30,
                },
            )
            # Response should be either 200 or 409 depending on state
            assert response.status_code in [200, 409]


class TestRobustness:
    """Test robustness and error recovery."""

    @pytest.mark.asyncio
    async def test_partial_source_failures(self):
        """Test that scan continues even if some sources fail."""
        async def mock_scan_with_failure(source, query, limit):
            if source == "failing_source":
                return source, [], "Simulated failure"
            else:
                return source, [{"title": f"Result from {source}"}], None

        with patch("pulse.api.routes.scanner._scan_source", side_effect=mock_scan_with_failure):
            results = await _run_full_scan(
                sources=["gdelt", "failing_source", "gnews"],
                force_filter=None,
                limit_per_source=10,
            )

            # Should have results from successful sources
            assert len(results["trends"]) > 0
            # Should have error from failing source
            assert len(results["meta"]["sources_failed"]) > 0

    @pytest.mark.asyncio
    async def test_timeout_handling(self):
        """Test that timeouts don't crash the scan."""
        async def mock_scan_with_timeout(source, query, limit):
            if source == "slow_source":
                await asyncio.sleep(0.1)  # Simulate slow response
                return source, [{"title": "Slow Result"}], None
            return source, [], None

        with patch("pulse.api.routes.scanner._scan_source", side_effect=mock_scan_with_timeout):
            results = await _run_full_scan(
                sources=["gdelt", "slow_source", "gnews"],
                force_filter=None,
                limit_per_source=10,
            )

            # Scan should complete
            assert results["meta"]["completed"] is not None


if __name__ == "__main__":
    # Run with: pytest tests/test_scanner_routes.py -v
    pytest.main([__file__, "-v"])
