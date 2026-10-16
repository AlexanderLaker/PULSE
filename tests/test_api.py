"""The API: routes, authentication and the role re-check, the served run, the drivers editor, proposals,
config, journey and explorer."""
import base64
import copy
import hashlib
import hmac
import json
import os
import re
import subprocess
import sys
import time
import types
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from prism.api import state
from prism.api.app import create_app
from prism.config import CATEGORIES
from support import bundled_journey, database_awaiting_a_migration, load_module

REPO = Path(__file__).resolve().parents[1]
SECRET = "pytest-secret-" + "x" * 40


def token(role="viewer", sub="user-1", email="ana@example.com", exp_offset=300, secret=SECRET, **claims) -> str:
    def b64(raw: bytes) -> str:
        return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()
    header = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = b64(json.dumps({"sub": sub, "email": email, "role": role,
                              "exp": int(time.time()) + exp_offset, **claims}).encode())
    signature = b64(hmac.new(secret.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest())
    return f"{header}.{payload}.{signature}"


def bearer(role="viewer", **kw) -> dict:
    return {"Authorization": f"Bearer {token(role, **kw)}"}


def ready_for_a_run() -> None:
    """What the production job finds or makes before it stores a run: the schema, and drivers (it seeds
    an empty SQLite file with the driver base)."""
    from prism.database import drivers_stamp, init_db, insert_drivers
    from prism.seed_drivers import get_seed_drivers
    init_db()
    if drivers_stamp()[0] == 0:
        insert_drivers(get_seed_drivers())


def persist(results: dict, iterations: int = 200) -> int:
    """Store a run the way the production job does."""
    from prism.database import save_simulation_run
    ready_for_a_run()
    return save_simulation_run(iterations, results)


def persist_text(results: str) -> int:
    """Store a run whose results column holds this text, which no production job writes."""
    from prism.database import get_db_connection
    ready_for_a_run()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO simulation_runs (iterations, results) VALUES (200, ?)", (results,))
        return cursor.lastrowid


@pytest.fixture
def api(monkeypatch, tmp_path):
    """A client on a fresh SQLite database, with a real token secret."""
    monkeypatch.setenv("PRISM_DB_PATH", str(tmp_path / "prism.db"))
    monkeypatch.setenv("PRISM_JWT_SECRET", SECRET)
    state.reset()
    yield TestClient(create_app())
    state.reset()


@pytest.fixture
def valid_run(mock_model_config, mock_driver_set):
    """A results bundle exactly as the production run persists it, over the model's horizon."""
    from prism.config import DEFAULT_PATH_YEARS
    from prism.input_drift import driver_fingerprint
    from prism.engine import MonteCarloEngine
    production = load_module("scripts/run_production.py")
    config = mock_model_config.copy_with(path_years=list(DEFAULT_PATH_YEARS))
    result = MonteCarloEngine(config, seed=42).run(mock_driver_set, chains=2, iterations=200)
    return production.results_bundle(result, config, 5, driver_fingerprint(mock_driver_set.drivers))


class TestRoutes:
    def test_the_route_table(self, api):
        routes = {(method.upper(), path) for path, operations in api.app.openapi()["paths"].items()
                  for method in operations}
        assert routes == {
            ("GET", "/api/v1/health"), ("GET", "/api/v1/diagnostics"), ("GET", "/api/v1/simulation"),
            ("GET", "/api/v1/drivers"), ("PUT", "/api/v1/drivers/{driver_id}"),
            ("GET", "/api/v1/drivers/{driver_id}/proposals"), ("PUT", "/api/v1/drivers/{driver_id}/proposals"),
            ("GET", "/api/v1/config"), ("GET", "/api/v1/journey"), ("PUT", "/api/v1/journey"),
            ("GET", "/api/v1/explorer"),
        }

    def test_the_interactive_documentation_is_served_only_when_asked_for(self, monkeypatch, tmp_path):
        """Off by default, so a deployment on any host describes no route; PRISM_API_DOCS=1 turns it on
        on a development machine, never on Vercel."""
        monkeypatch.setenv("PRISM_DB_PATH", str(tmp_path / "prism.db"))
        for name in ("VERCEL", "VERCEL_ENV", "PRISM_API_DOCS"):
            monkeypatch.delenv(name, raising=False)

        def served(path: str) -> bool:
            return TestClient(create_app()).get(path).status_code == 200

        assert not any(served(path) for path in ("/docs", "/redoc", "/openapi.json"))
        monkeypatch.setenv("PRISM_API_DOCS", "1")
        assert all(served(path) for path in ("/docs", "/redoc", "/openapi.json"))
        for name in ("VERCEL", "VERCEL_ENV"):
            monkeypatch.setenv(name, "1" if name == "VERCEL" else "production")
            assert not any(served(path) for path in ("/docs", "/redoc", "/openapi.json")), name
            monkeypatch.delenv(name)

    def test_the_vercel_entry_point_serves_the_same_app(self):
        import logging
        module = load_module("api/index.py", "vercel_index")
        assert module.app.title == "PRISM API"
        # PRISM's own messages from INFO up reach the function's log.
        assert logging.getLogger("prism").getEffectiveLevel() == logging.INFO

    def test_the_api_needs_neither_numpy_nor_scipy(self, api, valid_run):
        """The Vercel function installs api/requirements.txt only, so every route,
        including the served run, must work with the engine libraries blocked."""
        persist(valid_run)
        script = (
            "import sys, os\n"
            "sys.modules['numpy'] = None\n"
            "sys.modules['scipy'] = None\n"
            "from fastapi.testclient import TestClient\n"
            "from prism.api.app import create_app\n"
            "client = TestClient(create_app())\n"
            "headers = {'Authorization': 'Bearer ' + os.environ['TEST_TOKEN']}\n"
            "for path in ['/api/v1/health', '/api/v1/diagnostics', '/api/v1/drivers', '/api/v1/simulation',\n"
            "             '/api/v1/config', '/api/v1/drivers/consumer_r01/proposals', '/api/v1/journey',\n"
            "             '/api/v1/explorer']:\n"
            "    assert client.get(path, headers=headers).status_code == 200, path\n"
            "body = {'revision': 1, 'probability': 3}\n"
            "assert client.put('/api/v1/drivers/consumer_r01', headers=headers, json=body).status_code == 200\n"
            "body = {'base_version': 0, 'content': {'lhc': [], 'hair': []}}\n"
            "assert client.put('/api/v1/journey', headers=headers, json=body).status_code == 200\n"
        )
        env = {**os.environ, "TEST_TOKEN": token("admin")}
        result = subprocess.run([sys.executable, "-c", script], cwd=REPO, env=env, capture_output=True, text=True,
                                timeout=120)
        assert result.returncode == 0, result.stderr[-2000:]

    def test_the_function_requirements_are_what_the_api_imports(self):
        """The function declares only what the API imports (api/requirements.in); api/requirements.txt pins
        them with their own dependencies, and never numpy or scipy."""
        def names(path):
            lines = (REPO / "api" / path).read_text(encoding="utf-8").splitlines()
            return {re.split(r"[<>=; ]", line)[0] for line in lines
                    if line.strip() and not line.lstrip().startswith("#")}
        assert names("requirements.in") == {"fastapi", "pydantic", "psycopg2-binary"}
        assert names("requirements.in") <= names("requirements.txt")
        assert not {"numpy", "scipy"} & names("requirements.txt")


class TestAuthentication:
    READS = ["/api/v1/drivers", "/api/v1/simulation", "/api/v1/config", "/api/v1/journey", "/api/v1/explorer",
             "/api/v1/drivers/consumer_r01/proposals"]

    def test_reads_need_a_token(self, api):
        for path in self.READS:
            assert api.get(path).status_code == 401, path

    def test_the_viewer_cookie_and_a_bearer_token_are_accepted(self, api):
        assert api.get("/api/v1/config", headers=bearer()).status_code == 200
        api.cookies.set("prism-token", token())
        assert api.get("/api/v1/drivers").status_code == 200

    @pytest.mark.parametrize("bad", ["not-a-token", "a.b.c", token(exp_offset=-10), token(secret="z" * 40),
                                     token(exp=float("nan")), token(exp=True), token(exp="9999999999")],
                             ids=["garbage", "malformed", "expired", "wrong-secret",
                                  "expiry-nan", "expiry-bool", "expiry-text"])
    def test_an_invalid_token_is_refused(self, api, bad):
        assert api.get("/api/v1/drivers", headers={"Authorization": f"Bearer {bad}"}).status_code == 401

    def test_without_a_usable_secret_every_token_is_refused(self, api, monkeypatch):
        monkeypatch.setenv("PRISM_JWT_SECRET", "short")
        assert api.get("/api/v1/drivers", headers=bearer(secret="short")).status_code == 401

    def test_a_viewer_cannot_write(self, api):
        """A 403 body carries the reason as `detail` and a `code` the dashboard reads."""
        edit = {"revision": 1, "probability": 2}
        response = api.put("/api/v1/drivers/consumer_r01", json=edit, headers=bearer())
        assert response.status_code == 403
        assert response.json() == {"detail": "Admin access is required.", "code": "not_admin"}
        save = {"base_version": 0, "content": {"lhc": [], "hair": []}}
        assert api.put("/api/v1/journey", json=save, headers=bearer()).status_code == 403

    def test_health_and_diagnostics_are_anonymous(self, api):
        assert api.get("/api/v1/health").status_code == 200
        assert api.get("/api/v1/diagnostics").status_code == 200


class TestRoleRecheck:
    """On PostgreSQL every authenticated request looks the token's `sub` up in user_roles; a token alone no
    longer reads once the role is gone. The suite runs on SQLite, where the check is off, so both paths run
    here with the switch set and the lookup monkeypatched."""

    @pytest.fixture
    def roles(self, api, monkeypatch):
        """The check switched on, with the stored roles in a dict the test fills; the lookups are recorded."""
        import prism.database as dbm
        from prism.api import auth
        stored, looked_up = {}, []

        def load_user_role(clerk_user_id):
            looked_up.append(clerk_user_id)
            return stored.get(clerk_user_id)
        monkeypatch.setattr(auth, "CHECK_STORED_ROLE", True)
        monkeypatch.setattr(dbm, "load_user_role", load_user_role)
        return types.SimpleNamespace(stored=stored, looked_up=looked_up)

    def test_the_switch_follows_the_backend(self):
        """On SQLite (the suite, development) there is no user_roles table, so the check is off; on
        PostgreSQL it is on, and on Vercel it is on whatever the database setting, so a deployment that
        lost its database URL answers 503 rather than reading for an unchecked token."""
        import prism.database as dbm
        from prism.api import auth
        assert dbm.USE_POSTGRES is False and not dbm.on_vercel() and auth.CHECK_STORED_ROLE is False
        source = Path(auth.__file__).read_text(encoding="utf-8")
        assert "CHECK_STORED_ROLE = database.USE_POSTGRES or database.on_vercel()" in source

    def test_on_sqlite_the_stored_role_is_not_looked_up(self, api, monkeypatch):
        import prism.database as dbm

        def never(clerk_user_id):
            raise AssertionError("the role was looked up on SQLite")
        monkeypatch.setattr(dbm, "load_user_role", never)
        assert api.get("/api/v1/config", headers=bearer()).status_code == 200
        assert api.put("/api/v1/journey", headers=bearer("admin"),
                       json={"base_version": 0, "content": {"lhc": [], "hair": []}}).status_code == 200

    def test_a_user_without_a_role_is_refused_on_every_authenticated_route(self, api, roles):
        """No row (pending, or set back to pending): 403 with the code the dashboard leaves on, by the cookie
        and by a bearer token alike; the lookup is by the token's sub."""
        refused = {"detail": "Your access to PRISM has been removed or not yet granted.", "code": "no_role"}
        for path in TestAuthentication.READS:
            response = api.get(path, headers=bearer(sub="user-gone"))
            assert response.status_code == 403 and response.json() == refused, path
        api.cookies.set("prism-token", token(sub="user-gone"))
        response = api.get("/api/v1/drivers")
        assert response.status_code == 403 and response.json() == refused
        api.cookies.clear()
        for path, body in (("/api/v1/drivers/consumer_r01", {"revision": 1, "probability": 2}),
                           ("/api/v1/journey", {"base_version": 0, "content": {"lhc": [], "hair": []}}),
                           ("/api/v1/drivers/consumer_r01/proposals", {"probability": 2})):
            response = api.put(path, json=body, headers=bearer("admin", sub="user-gone"))
            assert response.status_code == 403 and response.json() == refused, path
        assert set(roles.looked_up) == {"user-gone"}

    def test_a_stored_role_lets_the_token_through(self, api, roles):
        roles.stored.update({"viewer-1": "viewer", "admin-1": "admin"})
        assert api.get("/api/v1/config", headers=bearer(sub="viewer-1")).status_code == 200
        assert api.get("/api/v1/explorer", headers=bearer(sub="admin-1")).status_code == 200
        response = api.put("/api/v1/drivers/consumer_r01", json={"revision": 1, "probability": 2},
                           headers=bearer("admin", sub="admin-1"))
        assert response.status_code == 200
        assert roles.looked_up == ["viewer-1", "admin-1", "admin-1"]

    def test_an_admin_token_of_a_demoted_user_is_refused(self, api, roles):
        """The stored role is viewer now: the five-minute admin token no longer writes, nor reads."""
        roles.stored["demoted"] = "viewer"
        refused = {"detail": "Admin access is required.", "code": "not_admin"}
        response = api.put("/api/v1/drivers/consumer_r01", json={"revision": 1, "probability": 2},
                           headers=bearer("admin", sub="demoted"))
        assert response.status_code == 403 and response.json() == refused
        response = api.get("/api/v1/drivers", headers=bearer("admin", sub="demoted"))
        assert response.status_code == 403 and response.json() == refused
        # the same user's viewer cookie still reads
        assert api.get("/api/v1/drivers", headers=bearer("viewer", sub="demoted")).status_code == 200

    def test_the_stored_role_never_upgrades_a_token(self, api, roles):
        """An admin's viewer cookie stays a viewer: it reads, and an admin write under it is refused."""
        roles.stored["admin-1"] = "admin"
        assert api.get("/api/v1/drivers", headers=bearer("viewer", sub="admin-1")).status_code == 200
        response = api.put("/api/v1/drivers/consumer_r01", json={"revision": 1, "probability": 2},
                           headers=bearer("viewer", sub="admin-1"))
        assert response.status_code == 403 and response.json()["code"] == "not_admin"
        # and the identity the audit log and the proposals get is the token's
        response = api.put("/api/v1/drivers/consumer_r01/proposals", json={"probability": 2},
                           headers=bearer("viewer", sub="admin-1", name="Ana"))
        assert response.status_code == 200
        proposals = api.get("/api/v1/drivers/consumer_r01/proposals", headers=bearer("viewer", sub="admin-1")).json()
        assert [(s["user_id"], s["name"]) for s in proposals["scorers"]] == [("admin-1", "Ana")]

    def test_a_token_without_a_subject_has_no_role(self, api, roles):
        """The dashboard signs every token with the user's Clerk id; one without is refused unlooked-up."""
        roles.stored[""] = "admin"
        for sub in (None, ""):
            response = api.get("/api/v1/config", headers={"Authorization": f"Bearer {token(sub=sub)}"})
            assert response.status_code == 403 and response.json()["code"] == "no_role"
        assert roles.looked_up == []

    def test_health_and_diagnostics_stay_anonymous(self, api, roles):
        assert api.get("/api/v1/health").status_code == 200
        assert api.get("/api/v1/diagnostics").status_code == 200
        assert roles.looked_up == []

    def test_a_database_out_of_reach_during_the_lookup_is_a_503(self, api, monkeypatch):
        """As for the data routes: the 503 that names nothing about the database, never a 403 or a 500."""
        import prism.database as dbm
        from prism.api import auth
        monkeypatch.setattr(auth, "CHECK_STORED_ROLE", True)

        def unreachable(clerk_user_id):
            raise dbm.DatabaseUnavailableError("Failed to connect to the database after 3 attempts")
        monkeypatch.setattr(dbm, "load_user_role", unreachable)
        response = api.get("/api/v1/config", headers=bearer())
        assert response.status_code == 503
        assert response.json() == {"detail": "The database cannot be reached right now; try again in a moment."}

    def test_an_invalid_or_missing_token_is_answered_before_the_lookup(self, api, roles):
        assert api.get("/api/v1/config").status_code == 401
        assert api.get("/api/v1/config", headers={"Authorization": "Bearer not-a-token"}).status_code == 401
        assert roles.looked_up == []


class TestHealthAndDiagnostics:
    def test_a_new_database_is_seeded(self, api):
        body = api.get("/api/v1/health").json()
        assert body == {"status": "ok", "version": "2.12.0", "commit": None, "driver_count": 51,
                        "has_simulation": False, "simulation_reason": "no_rows", "latest_run_id": None}

    def test_health_names_the_deployed_commit(self, api, monkeypatch):
        monkeypatch.setenv("VERCEL_GIT_COMMIT_SHA", "0123456789abcdef0123456789abcdef01234567")
        assert api.get("/api/v1/health").json()["commit"] == "0123456789ab"

    def test_two_instances_seeding_a_new_database_at_once(self, api, monkeypatch):
        """The instance that loses the race keeps the drivers the other stored."""
        import prism.database as dbm
        store = dbm.insert_drivers

        def the_other_instance_first(drivers):
            store(drivers)   # the other instance
            store(drivers)   # this one: refused as a whole on the duplicate ids
        monkeypatch.setattr(dbm, "insert_drivers", the_other_instance_first)
        state.reset()
        assert state.driver_set().driver_count == 51 and len(dbm.load_drivers()) == 51

    def test_a_database_that_lost_its_drivers_is_not_reseeded(self, api, valid_run):
        """A stored run shows that the database once held drivers: an empty drivers table there is lost
        data, restored from the backup, never replaced by the driver base."""
        import prism.database as dbm
        assert api.get("/api/v1/health").json()["driver_count"] == 51
        persist(valid_run)
        with dbm.get_db_connection() as conn:
            for table in ("driver_sources", "driver_regional_exposure", "driver_category_exposure", "drivers"):
                conn.cursor().execute(f"DELETE FROM {table}")
        state.reset()
        response = api.get("/api/v1/drivers", headers=bearer())
        assert response.status_code == 503 and "restore it from its backup" in response.json()["detail"]
        health = api.get("/api/v1/health").json()
        assert health["status"] == "degraded" and health["simulation_reason"] == "drivers_missing"
        # The uptime check reads /diagnostics and alerts on any reason but "ok", so it must say so too,
        # although the run itself is intact.
        diag = api.get("/api/v1/diagnostics").json()
        assert diag["simulation_reason"] == "drivers_missing" and "restore it from its backup" in diag["error"]
        assert diag["db_reachable"] is True and diag["latest_run_id"] is not None
        assert dbm.load_drivers() == []
        # No write lands in a database that is about to be restored: a Journey save is refused too, while
        # the configuration and the stored Journey stay readable.
        save = {"base_version": 0, "content": {"lhc": [], "hair": []}}
        response = api.put("/api/v1/journey", json=save, headers=bearer("admin"))
        assert response.status_code == 503 and "restore it from its backup" in response.json()["detail"]
        assert api.get("/api/v1/journey", headers=bearer()).status_code == 200
        assert api.get("/api/v1/config", headers=bearer()).status_code == 200
        assert dbm.load_journey_content()["version"] == 0

    @pytest.mark.parametrize("new_instance", [False, True], ids=["running-instance", "new-instance"])
    def test_a_dropped_drivers_table_is_lost_drivers_too(self, api, valid_run, new_instance):
        """Dropped instead of emptied: an instance that set the schema up before and one that starts now
        both say drivers_missing, in /health and in /diagnostics, which the uptime check reads."""
        import prism.database as dbm
        assert api.get("/api/v1/health").json()["driver_count"] == 51
        persist(valid_run)
        with dbm.get_db_connection() as conn:
            cursor = conn.cursor()
            for table in ("driver_sources", "driver_regional_exposure", "driver_category_exposure"):
                cursor.execute(f"DELETE FROM {table}")
            cursor.execute("DROP TABLE drivers")
        if new_instance:
            state.reset()
        health = api.get("/api/v1/health").json()
        assert health["status"] == "degraded" and health["simulation_reason"] == "drivers_missing"
        diag = api.get("/api/v1/diagnostics").json()
        assert diag["simulation_reason"] == "drivers_missing" and "restore it from its backup" in diag["error"]
        response = api.get("/api/v1/drivers", headers=bearer())
        assert response.status_code == 503 and "restore it from its backup" in response.json()["detail"]

    @pytest.mark.parametrize("failure", ["unreachable", "dropped-mid-query"])
    def test_only_a_missing_table_is_probed_for_lost_drivers(self, api, monkeypatch, failure):
        """A database out of reach, or a connection lost in the middle of the query, is db_error at once: no
        second connection, with its own retries, to look for a dropped table."""
        import prism.database as dbm
        assert api.get("/api/v1/health").json()["status"] == "ok"

        def fails():
            if failure == "unreachable":
                raise dbm.DatabaseUnavailableError("Failed to connect to the database after 3 attempts")
            raise RuntimeError("server closed the connection unexpectedly")

        probes = []
        monkeypatch.setattr(dbm, "drivers_stamp", fails)
        monkeypatch.setattr(dbm, "drivers_table_lost", lambda: probes.append(1) or False)
        body = api.get("/api/v1/health").json()
        assert body["status"] == "degraded" and body["simulation_reason"] == "db_error"
        assert probes == []

    def test_after_an_outage_requests_are_answered_at_once(self, api, monkeypatch):
        """Requests that queued behind a failed attempt to reach the database answer 503 at once for a few
        seconds instead of each trying again; after that the next request tries."""
        import prism.database as dbm
        assert api.get("/api/v1/health").json()["status"] == "ok"
        clock, tries = [1000.0], []

        def unreachable():
            tries.append(clock[0])
            raise dbm.DatabaseUnavailableError("Failed to connect to the database after 2 attempts")
        summaries = []

        def no_summary():
            summaries.append(clock[0])
            raise dbm.DatabaseUnavailableError("Failed to connect to the database after 2 attempts")
        monkeypatch.setattr(dbm, "drivers_stamp", unreachable)
        monkeypatch.setattr(dbm, "latest_run_summary", no_summary)
        monkeypatch.setattr(state, "time", types.SimpleNamespace(monotonic=lambda: clock[0]))
        assert api.get("/api/v1/drivers", headers=bearer()).status_code == 503 and len(tries) == 1
        assert api.get("/api/v1/drivers", headers=bearer()).status_code == 503 and len(tries) == 1
        assert api.get("/api/v1/simulation", headers=bearer()).status_code == 503 and summaries == []
        body = api.get("/api/v1/health").json()
        assert body["simulation_reason"] == "db_error" and len(tries) == 1
        clock[0] += state.UNREACHABLE_GRACE_SECONDS
        assert api.get("/api/v1/drivers", headers=bearer()).status_code == 503 and len(tries) == 2
        clock[0] += state.UNREACHABLE_GRACE_SECONDS
        assert api.get("/api/v1/simulation", headers=bearer()).status_code == 503 and len(summaries) == 1

    def test_requests_queued_behind_a_failure_answer_at_once(self, api, monkeypatch):
        """The grace is checked inside the lock: of three requests that arrive while an attempt to reach the
        database is failing, only that one reaches it; the other two answer as soon as it has failed."""
        import threading

        import prism.database as dbm
        assert api.get("/api/v1/health").json()["status"] == "ok"
        calls, failed, entered = [], [], threading.Event()

        def slow_and_unreachable():
            calls.append(1)
            entered.set()
            time.sleep(0.3)
            raise dbm.DatabaseUnavailableError("Failed to connect to the database after 2 attempts")
        monkeypatch.setattr(dbm, "drivers_stamp", slow_and_unreachable)

        def read_the_drivers():
            try:
                state.driver_set()
            except dbm.DatabaseUnavailableError:
                failed.append(1)
        first = threading.Thread(target=read_the_drivers)
        first.start()
        assert entered.wait(5)
        queued = [threading.Thread(target=read_the_drivers) for _ in range(2)]
        for thread in queued:
            thread.start()
        for thread in (first, *queued):
            thread.join(10)
        assert len(calls) == 1 and len(failed) == 3

    @pytest.mark.parametrize("entity_type, seeded", [("driver", False), ("user", True)])
    def test_of_the_audit_log_only_a_driver_edit_counts_as_history(self, api, entity_type, seeded):
        """A role change can precede the first driver request on a new database; it says nothing
        about the drivers, so the database is still seeded."""
        import prism.database as dbm
        dbm.init_db()
        with dbm.get_db_connection() as conn:
            dbm.insert_audit(conn.cursor(), [dbm.AuditEntry("an_action", entity_type, "an_id", "someone")])
        state.reset()
        assert dbm.holds_history() is not seeded
        assert api.get("/api/v1/health").json()["driver_count"] == (51 if seeded else 0)

    def test_a_persisted_run_is_reported(self, api, valid_run):
        run_id = persist(valid_run)
        body = api.get("/api/v1/health").json()
        assert body["has_simulation"] is True and body["latest_run_id"] == run_id
        diag = api.get("/api/v1/diagnostics").json()
        assert diag["db_reachable"] is True and diag["simulation_reason"] == "ok"
        assert diag["latest_run_id"] == run_id and diag["simulation_run_count"] == 1

    def test_a_malformed_run_is_explained(self, api, valid_run):
        broken = {k: v for k, v in valid_run.items() if k != "seed_stability"}
        run_id = persist(broken)
        diag = api.get("/api/v1/diagnostics").json()
        assert diag["simulation_reason"] == "malformed" and "seed_stability" in diag["error"]
        response = api.get("/api/v1/simulation", headers=bearer())
        assert response.status_code == 404
        assert response.json()["detail"]["reason"] == "malformed" and str(run_id) in response.json()["detail"]["error"]

    def test_an_outage_is_reported_not_raised(self, api, monkeypatch):
        import prism.database as dbm
        monkeypatch.setattr(dbm, "_connect", lambda: (_ for _ in ()).throw(RuntimeError("no route to host")))
        monkeypatch.setattr(dbm.time, "sleep", lambda s: None)
        assert api.get("/api/v1/health").json()["status"] == "degraded"
        diag = api.get("/api/v1/diagnostics").json()
        assert diag["db_reachable"] is False and diag["simulation_reason"] == "db_error"
        assert diag["error"] == "database error (RuntimeError)"   # the raw message stays in the log

    def test_the_data_routes_answer_503_while_the_database_cannot_be_reached(self, api, monkeypatch):
        import prism.database as dbm
        monkeypatch.setattr(dbm, "_connect", lambda: (_ for _ in ()).throw(
            RuntimeError('could not connect to server at "ep-secret.neon.tech" as "owner"')))
        monkeypatch.setattr(dbm.time, "sleep", lambda s: None)
        state.reset()
        response = api.get("/api/v1/drivers", headers=bearer())
        assert response.status_code == 503
        assert response.json() == {"detail": "The database cannot be reached right now; try again in a moment."}

    def test_a_database_awaiting_a_migration_asks_for_it(self, api, monkeypatch, tmp_path):
        awaiting = tmp_path / "awaiting.db"
        database_awaiting_a_migration(awaiting)
        monkeypatch.setenv("PRISM_DB_PATH", str(awaiting))
        state.reset()
        response = api.get("/api/v1/drivers", headers=bearer())
        assert response.status_code == 503 and "migrations/0001_driver_schema" in response.json()["detail"]
        health = api.get("/api/v1/health").json()
        assert health["status"] == "degraded" and health["simulation_reason"] == "migration_pending"
        diag = api.get("/api/v1/diagnostics").json()
        assert diag["simulation_reason"] == "migration_pending" and "migrate.py" in diag["error"]

    def test_on_vercel_a_missing_database_url_is_named(self, api, monkeypatch):
        monkeypatch.setenv("VERCEL", "1")
        state.reset()
        health = api.get("/api/v1/health").json()
        assert health["status"] == "degraded" and health["simulation_reason"] == "no_database"
        assert api.get("/api/v1/diagnostics").json()["simulation_reason"] == "no_database"
        response = api.get("/api/v1/drivers", headers=bearer())
        assert response.status_code == 503 and "DATABASE_URL" in response.json()["detail"]


class TestSimulation:
    def test_no_run_yet(self, api):
        response = api.get("/api/v1/simulation", headers=bearer())
        assert response.status_code == 404 and response.json()["detail"]["reason"] == "no_rows"

    def test_the_newest_run_is_served(self, api, valid_run):
        from prism.api.runs import META_KEYS, REQUIRED_KEYS
        persist(valid_run, 100)
        newest = persist(valid_run, 200)
        body = api.get("/api/v1/simulation", headers=bearer()).json()
        assert set(body) == (set(REQUIRED_KEYS) - {"meta"}) | {"run_meta", "inputs_since_run"}
        meta = body["run_meta"]
        assert meta["run_id"] == newest and meta["iterations"] == 200
        assert meta["run_date"].endswith("+00:00")   # stored in UTC, said so
        assert set(META_KEYS) <= set(meta) and meta["driver_count"] == 5
        assert "driver_fingerprint" not in meta
        assert body["totals"]["portfolio"]["2030"]["median"] == pytest.approx(
            valid_run["totals"]["portfolio"][2030]["median"])

    def test_edits_since_the_run_are_named(self, api, valid_run):
        from prism.input_drift import driver_fingerprint
        from prism.seed_drivers import get_seed_drivers
        persist({**valid_run, "meta": {**valid_run["meta"], "driver_fingerprint": driver_fingerprint(
            get_seed_drivers())}})
        path = "/api/v1/simulation"
        assert api.get(path, headers=bearer()).json()["inputs_since_run"] == {"changed": [], "added": [], "removed": []}
        api.put("/api/v1/drivers/technology_r01", headers=bearer("admin"), json={"revision": 1, "probability": 1})
        api.put("/api/v1/drivers/consumer_r01", headers=bearer("admin"),
                json={"revision": 1, "description": "text only"})
        assert api.get(path, headers=bearer()).json()["inputs_since_run"] == {
            "changed": ["technology_r01"], "added": [], "removed": []}

    @pytest.mark.parametrize("key", ["driver_fingerprint", "model_version", "chain_seeds"])
    def test_a_run_without_its_metadata_is_not_served(self, api, valid_run, key):
        """The metadata is part of the contract: the run information shows it, and the next run and
        inputs_since_run compare with the fingerprint."""
        persist({**valid_run, "meta": {k: v for k, v in valid_run["meta"].items() if k != key}})
        response = api.get("/api/v1/simulation", headers=bearer())
        assert response.status_code == 404 and response.json()["detail"]["reason"] == "malformed"
        assert f"meta.{key}" in response.json()["detail"]["error"]

    @pytest.mark.parametrize("meta", [5, ["driver_fingerprint"], "driver_fingerprint"],
                             ids=["a-number", "a-list", "text"])
    def test_metadata_that_is_not_an_object_is_reported_not_raised(self, api, valid_run, meta):
        """A stored meta that is not a JSON object lacks every key: the run is refused with the reason,
        never with a server error."""
        persist({**valid_run, "meta": meta})
        response = api.get("/api/v1/simulation", headers=bearer())
        assert response.status_code == 404 and response.json()["detail"]["reason"] == "malformed"
        assert "meta.model_version" in response.json()["detail"]["error"]
        assert api.get("/api/v1/diagnostics").json()["simulation_reason"] == "malformed"

    @pytest.mark.parametrize("remove, part", [
        (lambda r: r["shift_matrix"]["LHC: TOI"]["path"].pop("2035"), "a shift path of every category"),
        (lambda r: r["regional_shift_matrix"]["Hair: Care"].pop("Asia"), "every category and region"),
        (lambda r: r["decompositions"]["region"].pop("2031"), "the region attribution of every category"),
        (lambda r: r["decompositions"]["vc"]["2030"]["LHC: FCN"].pop("Packaging"),
         "the vc attribution of every category"),
        (lambda r: r["totals"]["portfolio"]["2035"].pop("p90"), "the portfolio band"),
        (lambda r: r["cell_weights_used"]["LHC: IC"].pop("Asia"), "the gross-profit share of every category"),
        (lambda r: r["category_weights_used"].pop("Hair: Body"), "the gross-profit share of every category"),
        (lambda r: r["region_weights_used"].pop("Asia"), "the gross-profit share of every category"),
    ])
    def test_a_run_that_does_not_cover_every_category_region_and_year_is_not_served(
            self, api, valid_run, remove, part):
        """The dashboard indexes the run by category, region, lens column and year; a run with a gap is
        refused, never half drawn."""
        run = json.loads(json.dumps(valid_run, default=float))
        remove(run)
        persist(run)
        response = api.get("/api/v1/simulation", headers=bearer())
        assert response.status_code == 404 and response.json()["detail"]["reason"] == "malformed"
        assert part in response.json()["detail"]["error"]

    def test_a_run_on_another_horizon_is_not_served(self, api, mock_model_config, mock_driver_set):
        """A run made before a deploy that changed the horizon waits for the next production run."""
        from prism.engine import MonteCarloEngine
        from prism.input_drift import driver_fingerprint
        production = load_module("scripts/run_production.py")
        result = MonteCarloEngine(mock_model_config, seed=42).run(mock_driver_set, chains=1, iterations=100)
        persist(production.results_bundle(result, mock_model_config, 5, driver_fingerprint(mock_driver_set.drivers)))
        detail = api.get("/api/v1/simulation", headers=bearer()).json()["detail"]
        assert detail["reason"] == "malformed" and "over 2026 to 2035" in detail["error"]

    def test_a_run_with_an_incomplete_fingerprint_is_not_served(self, api, valid_run):
        """A fingerprint entry without every field could not be compared with; served, it would fail
        the comparison with the current drivers."""
        fingerprint = copy.deepcopy(valid_run["meta"]["driver_fingerprint"])
        del fingerprint[next(iter(fingerprint))]["u"]
        persist({**valid_run, "meta": {**valid_run["meta"], "driver_fingerprint": fingerprint}})
        response = api.get("/api/v1/simulation", headers=bearer())
        assert response.status_code == 404 and response.json()["detail"]["reason"] == "malformed"
        assert "a complete meta.driver_fingerprint" in response.json()["detail"]["error"]
        assert api.get("/api/v1/diagnostics").json()["simulation_reason"] == "malformed"

    @pytest.mark.parametrize("stored", ["[1, 2]", "{not json"], ids=["a-json-list", "text-that-is-not-json"])
    def test_results_that_are_not_a_json_object_are_reported_not_raised(self, api, stored):
        """A newest run whose stored results are not a JSON object is malformed, like a run with a gap:
        refused with the reason, and never a database error."""
        run_id = persist_text(stored)
        response = api.get("/api/v1/simulation", headers=bearer())
        assert response.status_code == 404 and response.json()["detail"]["reason"] == "malformed"
        assert f"run {run_id} lacks a results object" in response.json()["detail"]["error"]
        diag = api.get("/api/v1/diagnostics").json()
        assert diag["db_reachable"] is True and diag["simulation_reason"] == "malformed"


class TestDrivers:
    def test_the_requests_carry_the_fields_the_database_writes(self):
        """An admin edit sends the editable fields and its revision, a proposal the scores and a
        comment: the request bodies and the database's field lists describe the same fields."""
        from prism.api.schemas import DriverUpdate, ProposalUpdate
        from prism.database import EDITABLE_FIELDS
        from prism.drivers import SCORE_FIELDS
        assert set(DriverUpdate.model_fields) == {"revision"} | EDITABLE_FIELDS
        assert set(ProposalUpdate.model_fields) == set(SCORE_FIELDS) | {"comment"}

    def test_the_list(self, api):
        drivers = api.get("/api/v1/drivers", headers=bearer()).json()
        assert len(drivers) == 51 and [d["id"] for d in drivers] == sorted(d["id"] for d in drivers)
        first = drivers[0]
        assert set(first) == {
            "id", "force", "name", "description", "direction", "probability", "start_year", "peak_year",
            "diffusion_curve", "gp1_pct_affected", "uncertainty", "confidence", "expected_effect",
            "category_exposure", "regional_exposure", "vc_epicentre", "analysis", "sources",
            "baseline", "scores_edited", "revision", "proposal_summary"}
        assert first["baseline"]["probability"] == first["probability"] and first["scores_edited"] is False
        assert first["revision"] == 1
        assert first["proposal_summary"]["count"] == 0
        from prism.analysis_texts import TEXTS
        assert first["analysis"] == TEXTS[first["id"]] and first["analysis"].startswith("Weight in the answer:")

    def test_a_driver_the_base_does_not_know_has_no_analysis(self, api):
        """The readings ship with the code, by driver id; nothing stores them."""
        from prism.database import insert_drivers
        from prism.seed_drivers import get_seed_drivers
        api.get("/api/v1/drivers", headers=bearer())   # seeds the base
        extra = get_seed_drivers()[0]
        extra.id = "consumer_r99"
        insert_drivers([extra])
        listed = {d["id"]: d for d in api.get("/api/v1/drivers", headers=bearer()).json()}
        assert listed["consumer_r99"]["analysis"] == "" and listed["consumer_r01"]["analysis"]

    def test_an_admin_edit(self, api):
        from prism.database import get_db_connection
        response = api.put("/api/v1/drivers/consumer_r01", headers=bearer("admin"),
                           json={"revision": 1, "probability": 4, "uncertainty": 3, "description": "Edited."})
        assert response.status_code == 200
        assert response.json() == {"status": "updated", "driver_id": "consumer_r01",
                                   "changed": ["description", "probability", "uncertainty"], "revision": 2}
        edited = next(d for d in api.get("/api/v1/drivers", headers=bearer()).json() if d["id"] == "consumer_r01")
        assert (edited["probability"], edited["uncertainty"], edited["description"]) == (4, 3, "Edited.")
        assert edited["scores_edited"] is True and edited["baseline"]["probability"] == 5
        assert edited["expected_effect"] == pytest.approx(-4 / 6 * 0.22)
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT reason, old_value, new_value, user_id FROM audit_log "
                           "WHERE action = 'driver_updated' ORDER BY id")
            rows = [tuple(r) for r in cursor.fetchall()]
        assert rows[0][0] == "description" and rows[0][2:] == (json.dumps("Edited."), "user-1")
        assert rows[1:] == [("probability", "5", "4", "user-1"), ("uncertainty", "2", "3", "user-1")]

    def test_the_value_chain_is_edited_as_one_stage(self, api):
        response = api.put("/api/v1/drivers/consumer_r01", headers=bearer("admin"),
                           json={"revision": 1, "vc_epicentre": "Marketing"})
        assert response.status_code == 200 and response.json()["changed"] == ["vc_epicentre"]
        driver = next(d for d in api.get("/api/v1/drivers", headers=bearer()).json() if d["id"] == "consumer_r01")
        assert driver["vc_epicentre"] == "Marketing" and driver["scores_edited"] is True
        assert driver["baseline"]["vc_epicentre"] == "Commercial"

    def test_text_edits_do_not_mark_the_scores_as_edited(self, api):
        sources = [{"title": "Circana, April 2026", "url": "https://example.org/c", "tier": "A",
                    "published": "Apr 2026"}]
        response = api.put("/api/v1/drivers/consumer_r02", headers=bearer("admin"),
                           json={"revision": 1, "description": "New text.", "confidence": "Low", "sources": sources})
        assert response.status_code == 200
        driver = next(d for d in api.get("/api/v1/drivers", headers=bearer()).json() if d["id"] == "consumer_r02")
        assert driver["description"] == "New text." and driver["confidence"] == "Low"
        assert driver["sources"] == sources and driver["scores_edited"] is False

    def test_an_unchanged_edit_writes_nothing(self, api):
        response = api.put("/api/v1/drivers/consumer_r01", headers=bearer("admin"),
                           json={"revision": 1, "probability": 5})
        assert response.json() == {"status": "unchanged", "driver_id": "consumer_r01", "revision": 1}

    def test_an_edit_made_on_an_older_revision_is_refused(self, api):
        """Two admins open the same driver: the first save lands, the second is refused and writes nothing."""
        first = api.put("/api/v1/drivers/consumer_r01", headers=bearer("admin"), json={"revision": 1, "probability": 4})
        assert first.status_code == 200 and first.json()["revision"] == 2
        second = api.put("/api/v1/drivers/consumer_r01", headers=bearer("admin"),
                         json={"revision": 1, "probability": 2, "description": "Overwritten?"})
        assert second.status_code == 409 and "Reload" in second.json()["detail"]
        driver = next(d for d in api.get("/api/v1/drivers", headers=bearer()).json() if d["id"] == "consumer_r01")
        assert (driver["probability"], driver["revision"]) == (4, 2) and driver["description"] != "Overwritten?"

    def test_a_concurrent_save_between_the_check_and_the_write_is_refused(self, api, monkeypatch):
        """The revision check in the API passes, but another save lands before the write: the database refuses."""
        from prism.database import load_drivers
        import prism.database as dbm
        original = dbm.save_driver_edit

        def someone_else_first(driver, expected, changed, audit):
            other = next(d for d in load_drivers() if d.id == "consumer_r01")
            other.description = "saved in between"
            original(other, other.revision, {"description"})
            return original(driver, expected, changed, audit)
        monkeypatch.setattr(dbm, "save_driver_edit", someone_else_first)
        response = api.put("/api/v1/drivers/consumer_r01", headers=bearer("admin"),
                           json={"revision": 1, "probability": 4})
        assert response.status_code == 409
        driver = next(d for d in load_drivers() if d.id == "consumer_r01")
        assert (driver.description, driver.probability) == ("saved in between", 5)
        with dbm.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'driver_updated'")
            assert cursor.fetchone()[0] == 0   # the refused edit left no audit entry

    def test_an_edit_needs_the_revision(self, api):
        response = api.put("/api/v1/drivers/consumer_r01", headers=bearer("admin"), json={"probability": 4})
        assert response.status_code == 422

    @pytest.mark.parametrize("body", [
        {"probability": 9}, {"uncertainty": 6}, {"uncertainty": None}, {"peak_year": None},
        {"gp1_pct_affected": 0}, {"direction": "Sideways"},
        {"diffusion_curve": "exponential"}, {"description": None}, {"analysis": "typed by hand"},
        {"name": "Renamed"}, {"force": "Customer"}, {"start_year": 2026}, {"peak_year": 2025},
        {"category_exposure": {"Hair: Care": "high"}}, {"category_exposure": {"Hair: Colour": 3}},
        {"regional_exposure": {"Latin America": 2}}, {"vc_epicentre": "Retail"}, {"vc_epicentre": None},
        {"value_chain": {"Marketing": 5}},
        {"sources": [{"title": "", "url": ""}]}, {"sources": [{"title": "x", "tier": "Z"}]},
        {"sources": [{"title": "x", "url": "javascript:alert(1)"}]}, {"sources": [{"url": "example.org/a"}]},
        {"probability": True}, {"probability": 4.0}, {"uncertainty": False}, {"gp1_pct_affected": True},
        {"peak_year": "2031"},
    ])
    def test_invalid_edits_are_refused(self, api, body):
        response = api.put("/api/v1/drivers/consumer_r01", headers=bearer("admin"), json={"revision": 1, **body})
        assert response.status_code == 422

    @pytest.mark.parametrize("score", [9, -2, 2.5, "3", True, 10**400])   # the last: an int no float holds
    def test_an_exposure_score_is_a_whole_number_from_0_to_5(self, api, score):
        response = api.put("/api/v1/drivers/consumer_r01", headers=bearer("admin"),
                           json={"revision": 1, "category_exposure": {"Hair: Care": score}})
        assert response.status_code == 422

    def test_an_exposure_map_changes_only_the_cells_sent(self, api):
        before = next(d for d in api.get("/api/v1/drivers", headers=bearer()).json() if d["id"] == "consumer_r01")
        api.put("/api/v1/drivers/consumer_r01", headers=bearer("admin"),
                json={"revision": 1, "category_exposure": {"Hair: Care": 5, "Hair: Color": 4.0}})
        driver = next(d for d in api.get("/api/v1/drivers", headers=bearer()).json() if d["id"] == "consumer_r01")
        assert driver["category_exposure"] == before["category_exposure"] | {"Hair: Care": 5, "Hair: Color": 4}
        assert set(driver["category_exposure"]) == set(CATEGORIES)

    def test_a_peak_year_must_come_after_the_onset(self, api):
        """A driver whose onset lies after the base year cannot peak before it."""
        driver = next(d for d in api.get("/api/v1/drivers", headers=bearer()).json() if d["start_year"] >= 2027)
        onset = driver["start_year"]
        path = f"/api/v1/drivers/{driver['id']}"
        refused = api.put(path, headers=bearer("admin"), json={"revision": 1, "peak_year": onset})
        assert refused.status_code == 422 and "after the driver's onset" in refused.json()["detail"]
        assert api.put(path, headers=bearer("admin"), json={"revision": 1, "peak_year": onset + 1}).status_code == 200

    def test_an_unknown_driver_is_404(self, api):
        response = api.put("/api/v1/drivers/nope", headers=bearer("admin"), json={"revision": 1, "probability": 3})
        assert response.status_code == 404

    def test_a_change_made_elsewhere_reaches_the_next_request(self, api):
        """Another server instance or a script writes the database; the cached drivers follow."""
        from prism.database import load_drivers, save_driver_edit
        api.get("/api/v1/drivers", headers=bearer())
        driver = next(d for d in load_drivers() if d.id == "technology_r01")
        driver.description = "Described by a script"
        save_driver_edit(driver, driver.revision, {"description"})
        texts = {d["id"]: d["description"] for d in api.get("/api/v1/drivers", headers=bearer()).json()}
        assert texts["technology_r01"] == "Described by a script"


class TestProposals:
    def test_propose_merge_and_aggregate(self, api):
        path = "/api/v1/drivers/consumer_r01/proposals"
        assert api.get(path, headers=bearer()).json() == {
            "driver_id": "consumer_r01", "my": None, "scorers": [],
            "aggregate": {"probability": None, "gp1_pct_affected": None, "peak_year": None, "uncertainty": None,
                          "diffusion_curve": None, "vc_epicentre": None, "category_exposure": {},
                          "regional_exposure": {}}}
        api.put(path, headers=bearer(sub="ana", name="Ana"),
                json={"probability": 4, "uncertainty": 4, "comment": "  looks high  "})
        body = api.put(path, headers=bearer(sub="ana", name="Ana"), json={"peak_year": 2031}).json()
        my = body["my"]
        assert my["probability"] == 4 and my["peak_year"] == 2031 and my["comment"] == "looks high"
        api.put(path, headers=bearer(sub="ben", email="ben@example.com"),
                json={"probability": 2, "uncertainty": 3, "category_exposure": {"Hair: Care": 4}})
        body = api.get(path, headers=bearer(sub="ben", email="ben@example.com")).json()
        assert body["aggregate"]["probability"] == {"avg": 3.0, "count": 2}
        assert body["aggregate"]["uncertainty"] == {"median": 4, "count": 2}   # 3.5, rounded half up
        assert body["aggregate"]["category_exposure"] == {"Hair: Care": {"avg": 4.0, "count": 1}}
        assert [s["name"] for s in body["scorers"]] == ["Ana", "ben"]
        assert "role" not in body["scorers"][0]
        assert body["my"]["probability"] == 2
        summary = next(d for d in api.get("/api/v1/drivers", headers=bearer()).json()
                       if d["id"] == "consumer_r01")["proposal_summary"]
        assert summary["count"] == 2 and summary["probability"] == {"avg": 3.0, "count": 2}

    def test_the_value_chain_is_proposed_as_one_stage(self, api):
        path = "/api/v1/drivers/consumer_r01/proposals"
        api.put(path, headers=bearer(sub="ana", name="Ana"), json={"vc_epicentre": "Marketing"})
        api.put(path, headers=bearer(sub="ben", name="Ben"), json={"vc_epicentre": "Marketing"})
        body = api.put(path, headers=bearer(sub="cy", name="Cy"), json={"vc_epicentre": "Consumer"}).json()
        assert body["aggregate"]["vc_epicentre"] == {
            "mode": "Marketing", "distribution": {"Marketing": 2, "Consumer": 1}, "count": 3}
        assert [(s["name"], s["vc_epicentre"]) for s in body["scorers"]] == [
            ("Ana", "Marketing"), ("Ben", "Marketing"), ("Cy", "Consumer")]
        assert body["my"]["vc_epicentre"] == "Consumer"
        assert api.put(path, headers=bearer(sub="cy"), json={"vc_epicentre": "Retail"}).status_code == 422
        assert api.put(path, headers=bearer(sub="cy", name="Cy"), json={"vc_epicentre": None}).json()["my"][
            "vc_epicentre"] is None

    def test_a_field_is_cleared_with_null_and_a_map_with_null_or_empty(self, api):
        path = "/api/v1/drivers/consumer_r01/proposals"
        api.put(path, headers=bearer(sub="ana"), json={"probability": 4, "peak_year": 2030,
                                                       "category_exposure": {"Hair: Care": 4},
                                                       "regional_exposure": {"Europe": 5}})
        body = api.put(path, headers=bearer(sub="ana"), json={"probability": None, "category_exposure": {},
                                                              "regional_exposure": None}).json()
        assert body["my"]["probability"] is None and body["my"]["peak_year"] == 2030
        assert body["my"]["category_exposure"] is None and body["my"]["regional_exposure"] is None

    def test_a_proposal_survives_an_admin_edit(self, api):
        path = "/api/v1/drivers/consumer_r01/proposals"
        api.put(path, headers=bearer(sub="ana"), json={"probability": 4})
        api.put("/api/v1/drivers/consumer_r01", headers=bearer("admin"), json={"revision": 1, "probability": 4})
        assert len(api.get(path, headers=bearer()).json()["scorers"]) == 1

    def test_a_tie_has_no_majority(self, api):
        """Categorical votes are counted, never averaged; a tie leaves the choice with the admin."""
        path = "/api/v1/drivers/consumer_r01/proposals"
        for sub, stage, curve in (("ana", "Marketing", "linear"), ("ben", "Consumer", "s_curve")):
            api.put(path, headers=bearer(sub=sub), json={"vc_epicentre": stage, "diffusion_curve": curve})
        aggregate = api.get(path, headers=bearer()).json()["aggregate"]
        assert aggregate["vc_epicentre"] == {"mode": None, "distribution": {"Marketing": 1, "Consumer": 1}, "count": 2}
        assert aggregate["diffusion_curve"]["mode"] is None

    def test_invalid_proposals(self, api):
        path = "/api/v1/drivers/consumer_r01/proposals"
        assert api.put(path, headers=bearer(), json={"diffusion_curve": "exponential"}).status_code == 422
        assert api.put(path, headers=bearer(), json={"category_exposure": {"Hair: Care": 7}}).status_code == 422
        assert api.put(path, headers=bearer(), json={"category_exposure": {"Hair: Care": 10**400}}).status_code == 422
        assert api.put(path, headers=bearer(), json={"regional_exposure": {"Mars": 2}}).status_code == 422
        assert api.put(path, headers=bearer(), json={"probability": 0}).status_code == 422
        assert api.put(path, headers=bearer(), json={"gp1_pct_affected": 0}).status_code == 422
        assert api.put(path, headers=bearer(), json={"peak_year": 2025}).status_code == 422   # not after the onset
        assert api.put(path, headers=bearer(), json={"user_id": "someone-else"}).status_code == 422
        for boolean in ({"probability": True}, {"uncertainty": False}, {"gp1_pct_affected": True}):
            assert api.put(path, headers=bearer(), json=boolean).status_code == 422, boolean
        assert api.put("/api/v1/drivers/nope/proposals", headers=bearer(), json={"probability": 3}).status_code == 404


class TestConfig:
    def test_the_configuration_is_read_only(self, api):
        from prism.config import DEFAULT_FORCE_OVERLAP_MATRIX, DEFAULT_PER_FORCE_ATTENUATION
        body = api.get("/api/v1/config", headers=bearer()).json()
        assert body["per_force_attenuation"] == DEFAULT_PER_FORCE_ATTENUATION
        assert body["force_overlap_matrix"] == DEFAULT_FORCE_OVERLAP_MATRIX
        # a run's size and its cell weights belong to the run, which reports them
        assert not {"iterations", "cell_weights", "cell_weights_source"} & set(body)
        assert body["path_years"] == list(range(2026, 2036)) and "base_year" not in body
        assert api.put("/api/v1/config", headers=bearer("admin"), json={}).status_code == 405


#: A tile the dashboard can render.
JOURNEY_TILE = {"id": "lhc.sorting.exp.test", "name": "AI stain recognition", "type": "tech", "driverCodes": ["T-01"],
                "driverNote": "T-01", "intensity": 2, "analysis": None,
                "provenance": {"date": "2026-09", "grade": "estimate"}}


def journey_with(*changes) -> dict:
    """A tile map of one Laundry stage holding one tile per change: JOURNEY_TILE with the change
    applied (a field set to ... is left out)."""
    tiles = [{k: v for k, v in {**JOURNEY_TILE, **change}.items() if v is not ...} for change in changes]
    return {"lhc": [{"id": "s", "label": "S", "benefiting": tiles, "negativelyImpacted": []}], "hair": []}


class TestJourney:
    CONTENT = {"lhc": [{"id": "sorting", "label": "Sorting", "benefiting": [JOURNEY_TILE], "negativelyImpacted": []}],
               "hair": []}

    def test_the_base_content_applies_until_an_admin_saves(self, api):
        """Version 0 and the generated base map, with the stage contexts: the dashboard shows nothing of
        the content before this answer, and the first save names base_version 0."""
        from prism.journey_content import CONTEXTS, TILES
        body = api.get("/api/v1/journey", headers=bearer()).json()
        assert body == {"version": 0, "source": "base", "content": TILES, "contexts": CONTEXTS}
        assert body["content"] == bundled_journey()
        assert set(body["contexts"]) == {"lhc", "hair"}
        assert set(body["contexts"]["lhc"]) == {stage["id"] for stage in body["content"]["lhc"]}
        assert set(body["contexts"]["lhc"]["sorting"]) == {"henkelBrands", "competitors", "opportunity"}

    def test_save_and_read(self, api):
        from prism.journey_content import CONTEXTS
        response = api.put("/api/v1/journey", headers=bearer("admin"),
                           json={"base_version": 0, "content": self.CONTENT})
        assert response.status_code == 200
        saved = response.json()
        assert saved["status"] == "saved" and saved["tiles"] == 1 and saved["version"] >= 1
        assert api.get("/api/v1/journey", headers=bearer()).json() == {
            "version": saved["version"], "source": "stored", "content": self.CONTENT, "contexts": CONTEXTS}

    def test_a_save_from_an_older_version_is_refused(self, api):
        """Two admins open the journey: the first save lands, the second is refused and writes nothing."""
        first = api.put("/api/v1/journey", headers=bearer("admin"), json={"base_version": 0, "content": self.CONTENT})
        second = api.put("/api/v1/journey", headers=bearer("admin"),
                         json={"base_version": 0, "content": {"lhc": [], "hair": []}})
        assert second.status_code == 409 and "Reload" in second.json()["detail"]
        assert api.get("/api/v1/journey", headers=bearer()).json()["version"] == first.json()["version"]
        third = api.put("/api/v1/journey", headers=bearer("admin"),
                        json={"base_version": first.json()["version"], "content": {"lhc": [], "hair": []}})
        assert third.status_code == 200

    @pytest.mark.parametrize("content, reason", [
        ({"lhc": "x", "hair": []}, "must be a list of stages"),
        ({"lhc": []}, "exactly the journeys"),
        ({"lhc": [], "hair": [], "extra": []}, "exactly the journeys"),
        ({"lhc": [{"id": "s", "label": "S", "benefiting": [{"name": "no id"}], "negativelyImpacted": []}], "hair": []},
         "string id and name"),
        ({"lhc": [{"id": "s", "label": "S", "benefiting": [], "negativelyImpacted": "none"}], "hair": []},
         "must be a list of tiles"),
        (journey_with({"id": "t"}, {"id": "t", "name": "b"}), "appears twice"),
        (journey_with({"name": "x" * 2_100_000}), "larger than"),
        (journey_with({"driverCodes": ...}), "driver codes"),
        (journey_with({"driverCodes": ["C-99"]}), "C-99, which are not drivers"),
        (journey_with({"type": "gadget"}), "type must be one of product, tech, service"),
        (journey_with({"intensity": 4}), "intensity must be 1, 2 or 3"),
        (journey_with({"intensity": True}), "intensity must be 1, 2 or 3"),
        (journey_with({"provenance": {"date": "2026-09", "grade": "Verified"}}), "provenance must hold"),
        (journey_with({"provenance": {"date": "September", "grade": "estimate"}}), "provenance must hold"),
        (journey_with({"provenance": {"author": "ai", "date": "2026-09", "grade": "estimate"}}),
         "provenance must hold"),
        (journey_with({"provenance": ...}), "provenance must hold"),
        (journey_with({"driverNote": None}), "driverNote must be text"),
        (journey_with({"analysis": ["not", "text"]}), "analysis must be text or null"),
        (journey_with({"analysis": ...}), "analysis must be text or null"),
        (journey_with({"poolImpact": {"grade": "Huge"}}), "poolImpact must hold"),
        (journey_with({"poolImpact": {"grade": "Med", "direction": "tailwind"}}), "poolImpact must hold"),
        (journey_with({"pending": True}), "holds pending, which a tile does not have"),
        ({"lhc": [{"id": "s", "label": "S", "icon": "x", "benefiting": [], "negativelyImpacted": []}], "hair": []},
         "lhc[0] holds icon, which a stage does not have"),
    ])
    def test_a_malformed_body_is_refused(self, api, content, reason):
        """The shape the dashboard renders, and nothing it does not read; a tile it could not render is
        refused with its id and the reason."""
        response = api.put("/api/v1/journey", headers=bearer("admin"), json={"base_version": 0, "content": content})
        assert response.status_code == 422
        assert reason in response.json()["detail"]

    def test_the_base_content_can_be_saved(self, api):
        """The base content is the shape the API stores: an admin's first save is the base content with
        the edit."""
        content = bundled_journey()
        response = api.put("/api/v1/journey", headers=bearer("admin"), json={"base_version": 0, "content": content})
        assert response.status_code == 200 and response.json()["tiles"] == 300
        body = api.get("/api/v1/journey", headers=bearer()).json()
        assert body["source"] == "stored" and body["content"] == content and body["version"] >= 1

    def test_the_body_needs_the_base_version(self, api):
        assert api.put("/api/v1/journey", headers=bearer("admin"), json={"content": self.CONTENT}).status_code == 422
        assert api.put("/api/v1/journey", headers=bearer("admin"), json=self.CONTENT).status_code == 422


class TestExplorer:
    def test_the_views_are_served_to_a_role(self, api):
        from prism.explorer_content import VIEWS
        body = api.get("/api/v1/explorer", headers=bearer()).json()
        assert body == {"views": VIEWS}
        assert [v["id"] for v in body["views"]] == ["hair_value_chain", "laundry_value_chain", "hair_categories",
                                                    "hair_core_adjacent", "home_care_categories",
                                                    "laundry_core_adjacent"]
        assert api.get("/api/v1/explorer", headers=bearer("admin")).status_code == 200

    def test_the_views_are_the_content_file(self, api):
        from support import POOLS_CONTENT
        views = json.loads(POOLS_CONTENT.read_text(encoding="utf-8"))["views"]
        assert api.get("/api/v1/explorer", headers=bearer()).json()["views"] == views

    def test_the_views_need_no_database(self, api, monkeypatch):
        """The content ships with the code: a database out of reach does not take the Explorer down."""
        import prism.database as dbm
        monkeypatch.setattr(dbm, "_connect", lambda: (_ for _ in ()).throw(RuntimeError("no route to host")))
        monkeypatch.setattr(dbm.time, "sleep", lambda s: None)
        state.reset()
        assert api.get("/api/v1/explorer", headers=bearer()).status_code == 200

    def test_the_views_are_read_only(self, api):
        assert api.put("/api/v1/explorer", headers=bearer("admin"), json={}).status_code == 405
