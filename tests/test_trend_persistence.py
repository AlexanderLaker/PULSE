"""F-29 (September 2026): an admin edit must persist AND keep expert proposals.

`trend_score_proposals.trend_id` references `trends(id)` with ON DELETE
CASCADE. Until 2.11.0 `save_trends` deleted the trend row and re-inserted it,
so every admin edit (PUT /api/v1/trends/{id}, Review & Endorse, sync, reseed,
revert) silently destroyed that trend's expert proposals on Postgres. SQLite
does not enforce foreign keys by default, which is why it never showed
locally; these tests therefore run with `PRAGMA foreign_keys = ON` so the
SQLite path behaves exactly like Neon.

Locked here: an edit writes every field and keeps the proposals; the derived
exposure and source rows are still fully replaced; a genuine deletion still
cascades the proposals away.
"""
import pytest

from pulse.config import CATEGORIES, REGIONS, VC_STEPS
from pulse.ingestion.models import Trend


def _trend(tid="consumer_r01", **kw):
    base = dict(
        id=tid, force="Consumer", name="original name", description="original description",
        direction="Contraction", probability=3, gp1_pct_affected=0.10, start_year=2025,
        peak_year=2030, diffusion_curve="linear", confidence="Medium", uncertainty=2,
        category_exposure={c: 1 for c in CATEGORIES},
        regional_exposure={r: 1 for r in REGIONS},
        vc_exposure={v: 1 for v in VC_STEPS},
    )
    base.update(kw)
    t = Trend(**base)
    t.sources = [{"title": "original source", "url": "https://example.org/a", "tier": "A"}]
    return t


@pytest.fixture
def fk_db(monkeypatch, tmp_path):
    """A throw-away SQLite base with foreign keys ENFORCED (the Neon path),
    holding one trend with two expert proposals on it."""
    monkeypatch.setenv("PRISM_DB_PATH", str(tmp_path / "prism.db"))
    import pulse.database as dbm
    real_connect = dbm._sqlite_connect

    def fk_connect():
        conn = real_connect()
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    monkeypatch.setattr(dbm, "_sqlite_connect", fk_connect)
    dbm.init_db()
    dbm.save_trends([_trend()])
    dbm.upsert_trend_proposal("consumer_r01", "expert-a",
                              {"probability": 2, "uncertainty": 4, "comment": "keep me"}, "Expert A", "expert")
    dbm.upsert_trend_proposal("consumer_r01", "expert-b",
                              {"gp1_pct_affected": 0.30}, "Expert B", "expert")
    assert len(dbm.load_trend_proposals("consumer_r01")) == 2
    return dbm


class TestEditKeepsProposals:
    def test_editing_a_trend_keeps_every_expert_proposal(self, fk_db):
        """The regression itself: a save of an existing trend must not cascade."""
        fk_db.save_trends([_trend(probability=5, name="edited name")])

        rows = {r["user_id"]: r for r in fk_db.load_trend_proposals("consumer_r01")}
        assert set(rows) == {"expert-a", "expert-b"}
        assert rows["expert-a"]["probability"] == 2
        assert rows["expert-a"]["uncertainty"] == 4
        assert rows["expert-a"]["comment"] == "keep me"
        assert rows["expert-b"]["gp1_pct_affected"] == pytest.approx(0.30)

    def test_repeated_edits_keep_them(self, fk_db):
        """Endorsing the same trend several times must stay non-destructive."""
        for p in (1, 2, 3, 4, 5):
            fk_db.save_trends([_trend(probability=p, user_override=True)])
        assert len(fk_db.load_trend_proposals("consumer_r01")) == 2

    def test_edit_persists_every_field(self, fk_db):
        """The other half of the requirement: the change is actually saved."""
        edited = _trend(
            name="edited name", description="edited description", direction="Expansion",
            probability=5, gp1_pct_affected=0.42, start_year=2027, peak_year=2033,
            diffusion_curve="front_loaded", confidence="High", uncertainty=5,
            user_override=True, sub_category="Premiumisation",
            strategic_implication="edited implication",
            category_exposure={c: (5 if c == "Hair: Care" else 0) for c in CATEGORIES},
            regional_exposure={r: (4 if r == "Europe" else 0) for r in REGIONS},
            vc_exposure={v: (3 if v == VC_STEPS[0] else 0) for v in VC_STEPS},
        )
        edited.sources = [{"title": "new source", "url": "https://example.org/b", "tier": "S"}]
        fk_db.save_trends([edited])

        loaded = {t.id: t for t in fk_db.load_trends()}["consumer_r01"]
        assert loaded.name == "edited name"
        assert loaded.description == "edited description"
        assert loaded.direction == "Expansion"
        assert loaded.probability == 5
        assert loaded.gp1_pct_affected == pytest.approx(0.42)
        assert loaded.start_year == 2027
        assert loaded.peak_year == 2033
        assert loaded.diffusion_curve == "front_loaded"
        assert loaded.confidence == "High"
        assert loaded.uncertainty == 5
        assert bool(loaded.user_override)  # SQLite hands booleans back as 0/1, Postgres as bool
        assert loaded.sub_category == "Premiumisation"
        assert loaded.strategic_implication == "edited implication"
        assert loaded.category_exposure["Hair: Care"] == 5
        assert loaded.regional_exposure["Europe"] == 4

    def test_exposures_and_sources_are_replaced_not_merged(self, fk_db):
        """The derived child rows keep their delete-then-insert semantics."""
        edited = _trend(category_exposure={"Hair: Care": 5},
                        regional_exposure={"Europe": 5},
                        vc_exposure={VC_STEPS[0]: 5})
        edited.sources = [{"title": "only source", "url": "https://example.org/only", "tier": "B"}]
        fk_db.save_trends([edited])

        with fk_db.get_db_connection() as conn:
            cur = conn.cursor()
            counts = {}
            for table in ("trend_category_exposure", "trend_vc_exposure",
                          "trend_regional_exposure", "trend_sources"):
                cur.execute(f"SELECT COUNT(*) FROM {table} WHERE trend_id = 'consumer_r01'")
                counts[table] = cur.fetchone()[0]
        assert counts == {"trend_category_exposure": 1, "trend_vc_exposure": 1,
                          "trend_regional_exposure": 1, "trend_sources": 1}

    def test_created_at_survives_an_edit(self, fk_db):
        """The row is updated in place, so its creation stamp is not reset."""
        with fk_db.get_db_connection() as conn:
            cur = conn.cursor()
            # backdate it, otherwise a re-insert within the same second is
            # indistinguishable from an in-place update
            cur.execute("UPDATE trends SET created_at = '2020-01-01 00:00:00' WHERE id = 'consumer_r01'")
            conn.commit()
            cur.execute("SELECT created_at FROM trends WHERE id = 'consumer_r01'")
            before = cur.fetchone()[0]
        assert str(before).startswith("2020-01-01")
        fk_db.save_trends([_trend(probability=4)])
        with fk_db.get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT created_at FROM trends WHERE id = 'consumer_r01'")
            after = cur.fetchone()[0]
        assert after == before

    def test_a_new_trend_is_still_inserted(self, fk_db):
        """The upsert must not turn a create into a no-op."""
        fk_db.save_trends([_trend(tid="technology_r01", force="Technology", name="brand new")])
        loaded = {t.id: t for t in fk_db.load_trends()}
        assert loaded["technology_r01"].name == "brand new"
        assert len(loaded) == 2

    def test_deleting_a_trend_still_removes_its_proposals(self, fk_db):
        """Proposals belong to the driver: a genuine deletion still cascades."""
        with fk_db.get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM trends WHERE id = 'consumer_r01'")
            conn.commit()
        assert fk_db.load_trend_proposals("consumer_r01") == []


class TestEditKeepsProposalsThroughTheAPI:
    """The same guarantee where the owner meets it: PUT /trends/{id} then the
    proposals endpoint still shows the experts."""

    def test_put_trend_persists_and_proposals_stay_visible(self, fk_db):
        pytest.importorskip("fastapi")
        pytest.importorskip("httpx")
        from fastapi.testclient import TestClient
        from pulse.api.app import create_app
        from pulse.api.auth import require_auth, require_admin

        app = create_app()
        fake_admin = {"email": "pytest@prism.local", "role": "admin", "user_id": "pytest"}
        app.dependency_overrides[require_auth] = lambda: fake_admin
        app.dependency_overrides[require_admin] = lambda: fake_admin
        client = TestClient(app)

        r = client.put("/api/v1/trends/consumer_r01", json={"probability": 5, "uncertainty": 1})
        assert r.status_code == 200, r.text

        rows = {p["user_id"]: p for p in fk_db.load_trend_proposals("consumer_r01")}
        assert set(rows) == {"expert-a", "expert-b"}

        got = client.get("/api/v1/trends/consumer_r01/proposals")
        assert got.status_code == 200, got.text
        scorers = {s.get("user_id") or s.get("user_name") for s in got.json()["scorers"]}
        assert {"expert-a", "expert-b"} & scorers or len(got.json()["scorers"]) == 2

        loaded = {t.id: t for t in fk_db.load_trends()}["consumer_r01"]
        assert loaded.probability == 5
        assert loaded.uncertainty == 1
