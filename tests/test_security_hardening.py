"""Phase 15: Platform Hardening, Security & Observability Test Suite.

Verifies:
1. CORS production configuration
2. Required environment validation
3. Safe health response (no secret leakage)
4. Readiness database check
5. Project isolation enforcement
6. Cross-project dataset rejection
7. Cross-project decision rejection
8. Cross-project execution rejection
9. Cross-project knowledge rejection
10. Invalid UUID handling
11. Invalid input validation
12. Safe API error response
13. Upload filename and path traversal safety
14. Upload size and type validation
15. No secret leakage in errors/logging
16. Append-only audit behavior
17. Transaction rollback behavior
18. Idempotent protected operations
19. API timing & security headers presence
20. Phase 13 critical enterprise reporting behavior unchanged
"""

import io
import uuid
import pytest
from unittest.mock import patch
from pydantic import ValidationError

from app.core.config import Settings
from app.services.health_service import HealthService
from app.services.storage_service import sanitize_filename
from app.models.project import Project
from app.models.dataset import Dataset
from app.models.decision_recommendation import DecisionRecommendation
from app.models.decision_knowledge import DecisionKnowledgeEntry
from app.models.evidence_edge import EvidenceEdge
from app.services.evidence_service import EvidenceService



# ---------------------------------------------------------------------------
# 1. CORS Production Configuration
# ---------------------------------------------------------------------------
def test_cors_production_disallows_wildcard():
    """Verify that wildcard CORS origins raise validation errors in production."""
    with pytest.raises(ValidationError):
        Settings(
            ENVIRONMENT="production",
            BACKEND_CORS_ORIGINS=["*"],
        )


# ---------------------------------------------------------------------------
# 2. Required Environment Validation
# ---------------------------------------------------------------------------
def test_production_environment_defaults_debug_false():
    """Verify that DEBUG defaults to False in production mode."""
    s = Settings(ENVIRONMENT="production")
    assert s.DEBUG is False
    assert s.is_production is True


def test_supabase_requires_credentials_when_active():
    """Verify that missing Supabase credentials raise ValidationError when storage backend is supabase."""
    with pytest.raises(ValidationError):
        Settings(
            STORAGE_BACKEND="supabase",
            SUPABASE_URL=None,
            SUPABASE_SERVICE_KEY=None,
        )


# ---------------------------------------------------------------------------
# 3. Safe Health Response
# ---------------------------------------------------------------------------
def test_safe_health_response(client):
    """Verify that GET /health and /api/health return expected schema without secret leakage."""
    for path in ["/health", "/api/health", "/api/v1/health"]:
        response = client.get(path)
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "version" in data
        assert "environment" in data
        assert "database_connected" in data
        # Ensure no passwords, URLs or connection strings are leaked
        serialized = response.text.lower()
        assert "password" not in serialized
        assert "psycopg" not in serialized
        assert "postgresql://" not in serialized


# ---------------------------------------------------------------------------
# 4. Readiness Database Check
# ---------------------------------------------------------------------------
def test_readiness_database_check_healthy(client):
    """Verify that GET /health/ready returns 200 with status 'ready' when DB is accessible."""
    for path in ["/health/ready", "/api/health/ready", "/api/v1/health/ready"]:
        response = client.get(path)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ready"
        assert data["database_connected"] is True
        assert "PostgreSQL" in data["details"] or "operational" in data["details"]


def test_readiness_database_check_unhealthy(client):
    """Verify that readiness endpoint returns 503 when database probe fails, with safe message."""
    with patch.object(HealthService, "check_readiness", return_value=(False, {
        "status": "not_ready",
        "project_name": "InsightFlow AI",
        "version": "0.1.0",
        "environment": "testing",
        "database_connected": False,
        "timestamp": "2026-09-22T00:00:00Z",
        "details": "Database service unreachable or not ready to accept queries.",
    })):
        response = client.get("/api/health/ready")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "not_ready"
        assert data["database_connected"] is False
        assert "password" not in response.text.lower()


# ---------------------------------------------------------------------------
# 5. Project Isolation Enforcement
# ---------------------------------------------------------------------------
def test_project_isolation_listing(client, db_session):
    """Verify that listing datasets filtered by project_id only returns datasets for that project."""
    p1 = Project(id=str(uuid.uuid4()), name="Project Alpha", workspace_id="ws-default")
    p2 = Project(id=str(uuid.uuid4()), name="Project Beta", workspace_id="ws-default")
    db_session.add_all([p1, p2])
    db_session.commit()

    ds1 = Dataset(id=str(uuid.uuid4()), project_id=p1.id, name="alpha_data.csv", is_processed=False)
    ds2 = Dataset(id=str(uuid.uuid4()), project_id=p2.id, name="beta_data.csv", is_processed=False)
    db_session.add_all([ds1, ds2])
    db_session.commit()

    res1 = client.get(f"/api/v1/datasets?project_id={p1.id}")
    assert res1.status_code == 200
    ids1 = [item["id"] for item in res1.json()["items"]]
    assert ds1.id in ids1
    assert ds2.id not in ids1


# ---------------------------------------------------------------------------
# 6. Cross-Project Dataset Rejection
# ---------------------------------------------------------------------------
def test_cross_project_dataset_rejection(client, db_session):
    """Verify that requesting a dataset with a mismatched project_id query parameter returns 404."""
    p1 = Project(id=str(uuid.uuid4()), name="Project 1", workspace_id="ws-default")
    p2 = Project(id=str(uuid.uuid4()), name="Project 2", workspace_id="ws-default")
    db_session.add_all([p1, p2])
    db_session.commit()

    ds = Dataset(id=str(uuid.uuid4()), project_id=p1.id, name="isolated.csv", is_processed=False)
    db_session.add(ds)
    db_session.commit()

    # Accessing with correct project succeeds
    ok_res = client.get(f"/api/v1/datasets/{ds.id}?project_id={p1.id}")
    assert ok_res.status_code == 200

    # Cross-project access is rejected with 404
    bad_res = client.get(f"/api/v1/datasets/{ds.id}?project_id={p2.id}")
    assert bad_res.status_code == 404


# ---------------------------------------------------------------------------
# 7. Cross-Project Decision Rejection
# ---------------------------------------------------------------------------
def test_cross_project_decision_report_rejection(client, db_session):
    """Verify that requesting an individual decision report with a mismatched project_id returns 404."""
    p1 = Project(id=str(uuid.uuid4()), name="Project Alpha", workspace_id="ws-default")
    p2 = Project(id=str(uuid.uuid4()), name="Project Beta", workspace_id="ws-default")
    db_session.add_all([p1, p2])
    db_session.commit()

    ds1 = Dataset(id=str(uuid.uuid4()), project_id=p1.id, name="alpha_data.csv", is_processed=True)
    db_session.add(ds1)
    db_session.commit()

    rec_id = str(uuid.uuid4())
    rec = DecisionRecommendation(
        id=rec_id,
        dataset_id=ds1.id,
        title="Optimize Beds",
        expected_impact="High impact",
    )
    db_session.add(rec)
    db_session.commit()

    # Access under correct project succeeds
    ok_res = client.get(f"/api/v1/decisions/{rec_id}/report?project_id={p1.id}")
    assert ok_res.status_code == 200

    # Rejection under mismatched project
    res = client.get(f"/api/v1/decisions/{rec_id}/report?project_id={p2.id}")
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# 8. Cross-Project Execution Rejection
# ---------------------------------------------------------------------------
def test_cross_project_execution_rejection(client, db_session):
    """Verify that requesting decision execution with a mismatched project_id returns 404."""
    p1 = Project(id=str(uuid.uuid4()), name="Project One", workspace_id="ws-default")
    p2 = Project(id=str(uuid.uuid4()), name="Project Two", workspace_id="ws-default")
    db_session.add_all([p1, p2])
    db_session.commit()

    ds1 = Dataset(id=str(uuid.uuid4()), project_id=p1.id, name="one_data.csv", is_processed=True)
    db_session.add(ds1)
    db_session.commit()

    rec_id = str(uuid.uuid4())
    rec = DecisionRecommendation(
        id=rec_id,
        dataset_id=ds1.id,
        title="Execution Target",
        expected_impact="Operational efficiency",
    )
    db_session.add(rec)
    db_session.commit()

    # Access under correct project succeeds
    ok_res = client.get(f"/api/v1/decisions/{rec_id}/execution?project_id={p1.id}")
    assert ok_res.status_code == 200

    res = client.get(f"/api/v1/decisions/{rec_id}/execution?project_id={p2.id}")
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# 9. Cross-Project Knowledge Rejection
# ---------------------------------------------------------------------------
def test_cross_project_knowledge_rejection(client, db_session):
    """Verify that retrieving a knowledge entry with mismatched project_id returns 404."""
    p1 = Project(id=str(uuid.uuid4()), name="Project Knowledge 1", workspace_id="ws-default")
    p2 = Project(id=str(uuid.uuid4()), name="Project Knowledge 2", workspace_id="ws-default")
    db_session.add_all([p1, p2])
    db_session.commit()

    k_id = str(uuid.uuid4())
    k_entry = DecisionKnowledgeEntry(
        id=k_id,
        project_id=p1.id,
        title="Bed Management Protocol",
        content="Keep 10% buffer",
        category="DECISION_LESSON",
        source_type="MANUAL",
        source_id="user-1",
        entry_type="HUMAN_RECORDED",
    )
    db_session.add(k_entry)
    db_session.commit()


    # Correct project access
    ok_res = client.get(f"/api/v1/knowledge/{k_id}?project_id={p1.id}")
    assert ok_res.status_code == 200

    # Cross-project access returns 404
    bad_res = client.get(f"/api/v1/knowledge/{k_id}?project_id={p2.id}")
    assert bad_res.status_code == 404


# ---------------------------------------------------------------------------
# 10. Invalid UUID Handling
# ---------------------------------------------------------------------------
def test_invalid_uuid_handling(client):
    """Verify that passing malformed UUIDs returns clean 404 instead of unhandled 500."""
    res1 = client.get("/api/v1/datasets/invalid-uuid-format-12345")
    assert res1.status_code == 404

    res2 = client.get("/api/v1/projects/not-a-valid-uuid/datasets")
    assert res2.status_code == 404


# ---------------------------------------------------------------------------
# 11. Invalid Input Validation
# ---------------------------------------------------------------------------
def test_invalid_input_validation(client):
    """Verify that invalid payloads return HTTP 422 with structured validation details."""
    response = client.post(
        "/api/v1/projects",
        json={"name": ""},  # empty name
    )
    assert response.status_code == 422
    data = response.json()
    assert "detail" in data


# ---------------------------------------------------------------------------
# 12. Safe API Error Response
# ---------------------------------------------------------------------------
def test_safe_api_error_response():
    """Verify that unhandled exceptions do not return raw tracebacks or sensitive server details."""
    from starlette.testclient import TestClient
    from app.main import app

    safe_client = TestClient(app, raise_server_exceptions=False)
    with patch("app.api.v1.endpoints.projects.ProjectService.list_projects", side_effect=Exception("Database connection timeout at 192.168.1.100")):
        response = safe_client.get("/api/v1/projects")
        assert response.status_code == 500
        data = response.json()
        assert data["error"] == "Internal Server Error"
        assert "192.168.1.100" not in response.text
        assert "Traceback" not in response.text


# ---------------------------------------------------------------------------
# 13. Upload Filename and Path Traversal Safety
# ---------------------------------------------------------------------------
def test_upload_filename_sanitization():
    """Verify that sanitize_filename prevents directory traversal across Windows and POSIX formats."""
    assert sanitize_filename("../../../etc/passwd") == "passwd"
    assert sanitize_filename("..\\..\\windows\\system32\\cmd.exe") == "cmd.exe"
    assert sanitize_filename("normal_dataset.csv") == "normal_dataset.csv"
    assert sanitize_filename("my data (2024) #1.csv") == "my_data__2024___1.csv"
    assert sanitize_filename("") == "uploaded_file.csv"


# ---------------------------------------------------------------------------
# 14. Upload Size and Type Validation
# ---------------------------------------------------------------------------
def test_upload_rejects_non_csv(client):
    """Verify that uploading a non-CSV file returns HTTP 400."""
    fake_file = io.BytesIO(b"Hello world")
    response = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("test.txt", fake_file, "text/plain")},
    )
    assert response.status_code == 400
    assert "Only CSV files" in response.json()["detail"]


def test_upload_rejects_empty_file(client):
    """Verify that uploading an empty file returns HTTP 400."""
    fake_file = io.BytesIO(b"")
    response = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("empty.csv", fake_file, "text/csv")},
    )
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# 15. No Secret Leakage in Errors/Logging
# ---------------------------------------------------------------------------
def test_no_secret_leakage_in_health_service(db_session):
    """Verify that DB probe failures do not leak connection strings in HealthService details."""
    with patch.object(db_session, "execute", side_effect=Exception("postgresql://user:secretpass@host:5432/db connection refused")):
        resp = HealthService.check_health(db=db_session)
        assert resp.status == "degraded"
        assert "secretpass" not in resp.details
        assert "postgresql://" not in resp.details


# ---------------------------------------------------------------------------
# 16. Append-Only Audit Behavior
# ---------------------------------------------------------------------------
def test_append_only_evidence_edge_integrity(db_session):
    """Verify that recording an evidence edge appends an immutable record."""
    proj_id = str(uuid.uuid4())
    e = EvidenceService.record_edge(
        db=db_session,
        project_id=proj_id,
        source_type="ANALYSIS_RUN",
        source_id="run-1",
        target_type="INSIGHT",
        target_id="ins-1",
        relationship_type="PRODUCED",
    )
    assert e.id is not None
    assert e.project_id == proj_id

    # Verify edge exists in database
    edge_in_db = db_session.get(EvidenceEdge, e.id)
    assert edge_in_db is not None
    assert edge_in_db.relationship_type == "PRODUCED"


# ---------------------------------------------------------------------------
# 17. Transaction Rollback Behavior
# ---------------------------------------------------------------------------
def test_transaction_rollback_on_failure(db_session):
    """Verify that transactional operations roll back state upon database error."""
    proj = Project(id=str(uuid.uuid4()), name="Rollback Test", workspace_id="ws-default")
    db_session.add(proj)
    db_session.commit()

    initial_count = len(db_session.query(Project).all())

    # Simulate failing transaction with nested savepoint
    try:
        with db_session.begin_nested():
            dup = Project(id=proj.id, name="Duplicate PK", workspace_id="ws-default")
            db_session.add(dup)
            db_session.flush()
    except Exception:
        pass

    assert len(db_session.query(Project).all()) == initial_count


# ---------------------------------------------------------------------------
# 18. Idempotent Protected Operations
# ---------------------------------------------------------------------------
def test_idempotent_protected_operations(db_session):
    """Verify that recording an evidence edge multiple times is idempotent and deduplicated."""
    proj_id = str(uuid.uuid4())
    e1 = EvidenceService.record_edge(
        db=db_session,
        project_id=proj_id,
        source_type="DECISION",
        source_id="dec-1",
        target_type="OUTCOME",
        target_id="out-1",
        relationship_type="EVALUATED_AGAINST",
    )
    e2 = EvidenceService.record_edge(
        db=db_session,
        project_id=proj_id,
        source_type="DECISION",
        source_id="dec-1",
        target_type="OUTCOME",
        target_id="out-1",
        relationship_type="EVALUATED_AGAINST",
    )
    assert e1.id == e2.id



# ---------------------------------------------------------------------------
# 19. API Timing & Security Headers
# ---------------------------------------------------------------------------
def test_security_headers_and_timing(client):
    """Verify that standard security headers and timing header are injected on responses."""
    response = client.get("/api/v1/projects")
    assert response.status_code == 200
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert response.headers.get("X-XSS-Protection") == "1; mode=block"
    assert "X-Response-Time-Ms" in response.headers
    assert float(response.headers["X-Response-Time-Ms"]) >= 0.0


# ---------------------------------------------------------------------------
# 20. Phase 13 Enterprise Reporting Unchanged
# ---------------------------------------------------------------------------
def test_phase13_enterprise_report_functional(client, db_session):
    """Verify that Phase 13 project decision report generation remains fully functional."""
    proj = Project(id=str(uuid.uuid4()), name="Enterprise Hospital", workspace_id="ws-default")
    db_session.add(proj)
    db_session.commit()

    response = client.get(f"/api/v1/projects/{proj.id}/decision-report")
    assert response.status_code == 200
    data = response.json()
    assert data["metadata"]["project_id"] == proj.id
    assert "project_summary" in data
    assert "portfolio_distributions" in data
    assert "operations_and_capacity" in data
    assert "decision_inventory" in data
