"""Phase 14: Decision Knowledge & Operating Memory Tests.

20 targeted tests verifying persistent human-recorded operating memory,
dynamically synthesized system-derived observations, search, filtering,
immutability boundaries, project isolation, and zero mutation on existing records.
"""

import uuid
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import SessionLocal
from app.models.workspace import Workspace
from app.models.project import Project
from app.models.dataset import Dataset
from app.models.analysis_run import AnalysisRun
from app.models.decision_recommendation import DecisionRecommendation
from app.models.decision_outcome import DecisionOutcome
from app.models.decision_learning_signal import DecisionLearningSignal
from app.models.decision_knowledge import DecisionKnowledgeEntry
from app.models.insight_memory import InsightMemory
from app.services.decision_knowledge_service import DecisionKnowledgeService

client = TestClient(app)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def knowledge_setup(db: Session):
    """Setup multi-tenant test harness with Project A, Project B, decisions, outcomes, signals, and insight memory."""
    ws = Workspace(id=str(uuid.uuid4()), name=f"WS_{uuid.uuid4().hex[:6]}")
    db.add(ws)
    db.flush()

    proj_a = Project(id=str(uuid.uuid4()), workspace_id=ws.id, name=f"ProjA_{uuid.uuid4().hex[:6]}")
    proj_b = Project(id=str(uuid.uuid4()), workspace_id=ws.id, name=f"ProjB_{uuid.uuid4().hex[:6]}")
    db.add_all([proj_a, proj_b])
    db.flush()

    ds_a = Dataset(
        id=str(uuid.uuid4()),
        project_id=proj_a.id,
        name="patient_flow_v1.csv",
        version=1,
        row_count=100,
        column_count=5,
    )
    ds_b = Dataset(
        id=str(uuid.uuid4()),
        project_id=proj_b.id,
        name="logistics_v1.csv",
        version=1,
        row_count=100,
        column_count=5,
    )
    db.add_all([ds_a, ds_b])
    db.flush()

    # Decision 1 in Proj A
    rec_a1 = DecisionRecommendation(
        id=str(uuid.uuid4()),
        dataset_id=ds_a.id,
        title="Discharge Optimization Protocol",
        recommendation_type="RESOURCE_ALLOCATION",
        impact_level="high",
        expected_impact="Bed turnover improvement +15%",
        action_items=["Shift early discharge forward by 2h"],
        evidence_traceability={"target_metric": "bed_turnover", "projected_value": 15.0},
    )
    # Decision 2 in Proj A
    rec_a2 = DecisionRecommendation(
        id=str(uuid.uuid4()),
        dataset_id=ds_a.id,
        title="Weekend Nurse Staffing Buffer",
        recommendation_type="RESOURCE_ALLOCATION",
        impact_level="medium",
        expected_impact="Nurse ratio balanced at 1.2",
        action_items=["Add 2 float nurses"],
        evidence_traceability={"target_metric": "nurse_ratio", "projected_value": 1.2},
    )
    # Decision 1 in Proj B
    rec_b1 = DecisionRecommendation(
        id=str(uuid.uuid4()),
        dataset_id=ds_b.id,
        title="Route Optimization B",
        recommendation_type="EFFICIENCY",
        impact_level="low",
        expected_impact="Delivery fuel cost reduced to $450",
        action_items=["Re-route warehouse deliveries"],
        evidence_traceability={"target_metric": "fuel_cost", "projected_value": 450.0},
    )
    db.add_all([rec_a1, rec_a2, rec_b1])
    db.flush()

    # Outcome for rec_a1 in Proj A (material deviation +20%)
    outcome_a1 = DecisionOutcome(
        id=str(uuid.uuid4()),
        project_id=proj_a.id,
        dataset_id=ds_a.id,
        decision_id=rec_a1.id,
        recommendation_id=rec_a1.id,
        expected_metric="bed_turnover",
        expected_value=15.0,
        actual_metric="bed_turnover",
        actual_value=18.0,
        relative_delta=0.20,
        percentage_error=20.0,
        outcome_status="OBSERVED",
        recorded_at=utc_now() - timedelta(days=2),
    )
    db.add(outcome_a1)
    db.flush()

    # Learning Signal for rec_a1 in Proj A
    signal_a1 = DecisionLearningSignal(
        id=str(uuid.uuid4()),
        project_id=proj_a.id,
        signal_type="DRIFT_DETECTED",
        severity="MEDIUM",
        title="Bed turnover seasonal acceleration",
        description="Observed bed turnover accelerated beyond projection during winter months.",
        source_decision_ids=[rec_a1.id],
        status="ACTIVE",
        fingerprint="fp_drift_turnover_winter",
        created_at=utc_now() - timedelta(days=1),
    )
    db.add(signal_a1)
    db.flush()


    # Phase 4 Insight Memory item for Proj A to verify zero mutation
    run_a = AnalysisRun(
        id=str(uuid.uuid4()),
        project_id=proj_a.id,
        dataset_id=ds_a.id,
        run_type="EDA",
        status="SUCCESS",
    )
    db.add(run_a)
    db.flush()

    im_a = InsightMemory(
        id=str(uuid.uuid4()),
        project_id=proj_a.id,
        dataset_lineage="patient_flow_v1.csv",
        insight_fingerprint="fp_insight_morning_triage_corr",
        first_seen_run_id=run_a.id,
        latest_run_id=run_a.id,
        first_seen_version=1,
        latest_seen_version=1,
        title="Turnover correlates with morning triage",
        category="CORRELATION",
        status="STRENGTHENED",
        created_at=utc_now(),
    )
    db.add(im_a)
    db.commit()


    return {
        "workspace_id": ws.id,
        "proj_a": proj_a,
        "proj_b": proj_b,
        "ds_a": ds_a,
        "ds_b": ds_b,
        "rec_a1": rec_a1,
        "rec_a2": rec_a2,
        "rec_b1": rec_b1,
        "outcome_a1": outcome_a1,
        "signal_a1": signal_a1,
        "insight_memory_a": im_a,
    }


def test_empty_project_knowledge(knowledge_setup):
    """1. Empty project returns 0 total entries without system-derived or when empty."""
    proj_b = knowledge_setup["proj_b"]
    res = client.get(f"/api/v1/projects/{proj_b.id}/knowledge?include_system_derived=false")
    assert res.status_code == 200
    data = res.json()
    assert data["project_id"] == proj_b.id
    assert data["total_entries"] == 0
    assert data["total_human_recorded"] == 0
    assert data["total_system_derived"] == 0
    assert data["entries"] == []


def test_create_human_knowledge(knowledge_setup):
    """2. Create human-recorded knowledge entry with full attribution."""
    proj_a = knowledge_setup["proj_a"]
    rec_a1 = knowledge_setup["rec_a1"]

    payload = {
        "title": "Staffing buffer requires weekend lead time",
        "content": "Float nurses must be confirmed at least 24 hours prior to weekend shifts.",
        "category": "OPERATIONAL_NOTE",
        "source_type": "DECISION",
        "source_id": rec_a1.id,
        "decision_id": rec_a1.id,
        "created_by": "Nurse Manager Sarah",
    }
    res = client.post(f"/api/v1/projects/{proj_a.id}/knowledge", json=payload)
    assert res.status_code == 201
    entry = res.json()
    assert entry["id"] is not None
    assert entry["project_id"] == proj_a.id
    assert entry["title"] == payload["title"]
    assert entry["content"] == payload["content"]
    assert entry["category"] == "OPERATIONAL_NOTE"
    assert entry["entry_type"] == "HUMAN_RECORDED"
    assert entry["created_by"] == "Nurse Manager Sarah"
    assert entry["is_archived"] is False
    assert entry["decision_id"] == rec_a1.id


def test_retrieve_knowledge_entry(knowledge_setup):
    """3. Retrieve created human entry by ID and verify exact fields."""
    proj_a = knowledge_setup["proj_a"]
    payload = {
        "title": "Discharge protocol bottleneck observation",
        "content": "Physician rounds finish at 11am creating pharmacy dispatch delays.",
        "category": "OBSERVATION",
        "source_type": "MANUAL",
        "created_by": "Operations Lead",
    }
    create_res = client.post(f"/api/v1/projects/{proj_a.id}/knowledge", json=payload)
    assert create_res.status_code == 201
    created_id = create_res.json()["id"]

    get_res = client.get(f"/api/v1/knowledge/{created_id}")
    assert get_res.status_code == 200
    entry = get_res.json()
    assert entry["id"] == created_id
    assert entry["title"] == payload["title"]
    assert entry["content"] == payload["content"]
    assert entry["category"] == "OBSERVATION"
    assert entry["entry_type"] == "HUMAN_RECORDED"


def test_update_human_knowledge(knowledge_setup):
    """4. Update title, content, or category of a human entry."""
    proj_a = knowledge_setup["proj_a"]
    payload = {
        "title": "Initial Assumption",
        "content": "Turnover rate is unaffected by weather.",
        "category": "ASSUMPTION",
        "source_type": "MANUAL",
        "created_by": "Analyst",
    }
    create_res = client.post(f"/api/v1/projects/{proj_a.id}/knowledge", json=payload)
    created_id = create_res.json()["id"]

    patch_payload = {
        "title": "Refined Assumption: Cold Snap Impact",
        "content": "Turnover drops 15% during severe snow alerts.",
        "category": "DECISION_LESSON",
    }
    patch_res = client.patch(f"/api/v1/knowledge/{created_id}", json=patch_payload)
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["title"] == patch_payload["title"]
    assert updated["content"] == patch_payload["content"]
    assert updated["category"] == "DECISION_LESSON"


def test_archive_delete_behavior(knowledge_setup):
    """5. Soft-archive via DELETE; entry excluded from default listing."""
    proj_a = knowledge_setup["proj_a"]
    payload = {
        "title": "Temporary constraint to be archived",
        "content": "Elevator maintenance limits step-down transfers.",
        "category": "CONSTRAINT",
        "source_type": "MANUAL",
    }
    create_res = client.post(f"/api/v1/projects/{proj_a.id}/knowledge", json=payload)
    entry_id = create_res.json()["id"]

    # Delete (soft-archive)
    del_res = client.delete(f"/api/v1/knowledge/{entry_id}")
    assert del_res.status_code == 200
    assert del_res.json()["is_archived"] is True

    # Listing excludes it
    list_res = client.get(f"/api/v1/projects/{proj_a.id}/knowledge?include_system_derived=false")
    ids = [e["id"] for e in list_res.json()["entries"]]
    assert entry_id not in ids


def test_category_filtering(knowledge_setup):
    """6. Filtering by category strictly returns matching categories."""
    proj_a = knowledge_setup["proj_a"]
    for cat, title in [
        ("ASSUMPTION", "Demand elasticity assumption"),
        ("CONSTRAINT", "ICU bed licensing limit"),
        ("OPERATIONAL_NOTE", "Night shift protocol note"),
    ]:
        client.post(
            f"/api/v1/projects/{proj_a.id}/knowledge",
            json={"title": title, "content": f"Details for {title}", "category": cat, "source_type": "MANUAL"},
        )

    res_assump = client.get(f"/api/v1/projects/{proj_a.id}/knowledge?category=ASSUMPTION&include_system_derived=false")
    assert res_assump.status_code == 200
    for e in res_assump.json()["entries"]:
        assert e["category"] == "ASSUMPTION"

    res_constr = client.get(f"/api/v1/projects/{proj_a.id}/knowledge?category=CONSTRAINT&include_system_derived=false")
    assert res_constr.status_code == 200
    for e in res_constr.json()["entries"]:
        assert e["category"] == "CONSTRAINT"


def test_source_filtering(knowledge_setup):
    """7. Filtering by source_type (DECISION vs MANUAL)."""
    proj_a = knowledge_setup["proj_a"]
    rec_a1 = knowledge_setup["rec_a1"]

    client.post(
        f"/api/v1/projects/{proj_a.id}/knowledge",
        json={
            "title": "Decision source entry",
            "content": "Linked directly to formal decision recommendation",
            "category": "DECISION_LESSON",
            "source_type": "DECISION",
            "source_id": rec_a1.id,
            "decision_id": rec_a1.id,
        },
    )
    client.post(
        f"/api/v1/projects/{proj_a.id}/knowledge",
        json={
            "title": "Manual source entry",
            "content": "Not tied to any specific automated pipeline artifact",
            "category": "OPERATIONAL_NOTE",
            "source_type": "MANUAL",
        },
    )

    dec_res = client.get(f"/api/v1/projects/{proj_a.id}/knowledge?source_type=DECISION&include_system_derived=false")
    assert dec_res.status_code == 200
    for e in dec_res.json()["entries"]:
        assert e["source_type"] == "DECISION"

    man_res = client.get(f"/api/v1/projects/{proj_a.id}/knowledge?source_type=MANUAL&include_system_derived=false")
    assert man_res.status_code == 200
    for e in man_res.json()["entries"]:
        assert e["source_type"] == "MANUAL"


def test_decision_filtering(knowledge_setup):
    """8. Filtering by decision_id returns only items linked to that decision."""
    proj_a = knowledge_setup["proj_a"]
    rec_a1 = knowledge_setup["rec_a1"]
    rec_a2 = knowledge_setup["rec_a2"]

    client.post(
        f"/api/v1/projects/{proj_a.id}/knowledge",
        json={
            "title": "Linked to Rec A1",
            "content": "Specific insight for A1",
            "category": "DECISION_LESSON",
            "source_type": "DECISION",
            "decision_id": rec_a1.id,
        },
    )
    client.post(
        f"/api/v1/projects/{proj_a.id}/knowledge",
        json={
            "title": "Linked to Rec A2",
            "content": "Specific insight for A2",
            "category": "DECISION_LESSON",
            "source_type": "DECISION",
            "decision_id": rec_a2.id,
        },
    )

    res = client.get(f"/api/v1/projects/{proj_a.id}/knowledge?decision_id={rec_a1.id}&include_system_derived=false")
    assert res.status_code == 200
    entries = res.json()["entries"]
    assert len(entries) >= 1
    for e in entries:
        assert e["decision_id"] == rec_a1.id


def test_text_search_case_insensitive(knowledge_setup):
    """9. Case-insensitive text search across title and content."""
    proj_a = knowledge_setup["proj_a"]
    client.post(
        f"/api/v1/projects/{proj_a.id}/knowledge",
        json={
            "title": "Cardiology Overcrowding Incident",
            "content": "Telemetries exceeded safe ceiling during morning transfer spike.",
            "category": "OBSERVATION",
            "source_type": "MANUAL",
        },
    )

    # Search lowercase
    res_lower = client.get(f"/api/v1/projects/{proj_a.id}/knowledge?search=cardiology&include_system_derived=false")
    assert res_lower.status_code == 200
    assert any("Cardiology" in e["title"] for e in res_lower.json()["entries"])

    # Search uppercase content
    res_upper = client.get(f"/api/v1/projects/{proj_a.id}/knowledge?search=TELEMETRIES&include_system_derived=false")
    assert res_upper.status_code == 200
    assert any("Telemetries" in e["content"] for e in res_upper.json()["entries"])

    # Search nonsense
    res_none = client.get(f"/api/v1/projects/{proj_a.id}/knowledge?search=zz_nonexistent_token_99&include_system_derived=false")
    assert res_none.status_code == 200
    assert len(res_none.json()["entries"]) == 0


def test_date_filtering(knowledge_setup, db: Session):
    """10. Filter by date_from and date_to boundaries."""
    proj_a = knowledge_setup["proj_a"]
    now = utc_now()

    # Create old entry directly with backdated timestamp
    old_entry = DecisionKnowledgeEntry(
        project_id=proj_a.id,
        title="Historical 2024 operating lesson",
        content="Old process from 6 months ago.",
        category="OPERATIONAL_NOTE",
        source_type="MANUAL",
        entry_type="HUMAN_RECORDED",
        created_by="Archivist",
        is_archived=False,
        created_at=now - timedelta(days=180),
        updated_at=now - timedelta(days=180),
    )
    db.add(old_entry)
    db.commit()

    # Query with date_from = 7 days ago
    date_from_iso = (now - timedelta(days=7)).isoformat()
    res = client.get(f"/api/v1/projects/{proj_a.id}/knowledge?date_from={date_from_iso}&include_system_derived=false")
    assert res.status_code == 200
    ids = [e["id"] for e in res.json()["entries"]]
    assert old_entry.id not in ids


def test_project_isolation(knowledge_setup):
    """11. Project A knowledge entries are never leaked to Project B."""
    proj_a = knowledge_setup["proj_a"]
    proj_b = knowledge_setup["proj_b"]

    client.post(
        f"/api/v1/projects/{proj_a.id}/knowledge",
        json={
            "title": "Confidential Proj A insight",
            "content": "Proprietary patient data pattern",
            "category": "DECISION_LESSON",
            "source_type": "MANUAL",
        },
    )

    res_b = client.get(f"/api/v1/projects/{proj_b.id}/knowledge?include_system_derived=false")
    assert res_b.status_code == 200
    titles_b = [e["title"] for e in res_b.json()["entries"]]
    assert "Confidential Proj A insight" not in titles_b

    # 404 on nonexistent project
    res_fake = client.get("/api/v1/projects/fake-project-id-9999/knowledge")
    assert res_fake.status_code == 404


def test_source_traceability(knowledge_setup):
    """12. Verify every knowledge entry preserves source_type and source_id."""
    proj_a = knowledge_setup["proj_a"]
    rec_a1 = knowledge_setup["rec_a1"]

    create_res = client.post(
        f"/api/v1/projects/{proj_a.id}/knowledge",
        json={
            "title": "Traceable Lesson",
            "content": "Fully attributed decision insight",
            "category": "DECISION_LESSON",
            "source_type": "DECISION",
            "source_id": rec_a1.id,
            "decision_id": rec_a1.id,
        },
    )
    assert create_res.status_code == 201
    entry = create_res.json()
    assert entry["source_type"] == "DECISION"
    assert entry["source_id"] == rec_a1.id


def test_system_derived_attribution(knowledge_setup):
    """13. System-derived entries have entry_type='SYSTEM_DERIVED' and cannot be edited/deleted."""
    proj_a = knowledge_setup["proj_a"]

    # Query project A with system-derived enabled
    res = client.get(f"/api/v1/projects/{proj_a.id}/knowledge?include_system_derived=true")
    assert res.status_code == 200
    data = res.json()
    assert data["total_system_derived"] >= 2  # outcome_a1 and signal_a1

    sys_entries = [e for e in data["entries"] if e["entry_type"] == "SYSTEM_DERIVED"]
    assert len(sys_entries) >= 2
    for s in sys_entries:
        assert s["created_by"] == "InsightFlow Decision Engine"
        assert s["id"].startswith("sys-")

    # Attempt to retrieve a system entry by ID
    first_sys = sys_entries[0]
    get_sys = client.get(f"/api/v1/knowledge/{first_sys['id']}")
    assert get_sys.status_code == 200
    assert get_sys.json()["entry_type"] == "SYSTEM_DERIVED"

    # Attempt to PATCH system-derived entry -> 400 Bad Request
    patch_sys = client.patch(f"/api/v1/knowledge/{first_sys['id']}", json={"title": "Hacked Title"})
    assert patch_sys.status_code == 400
    assert "cannot be directly modified" in patch_sys.json()["detail"]

    # Attempt to DELETE system-derived entry -> 400 Bad Request
    del_sys = client.delete(f"/api/v1/knowledge/{first_sys['id']}")
    assert del_sys.status_code == 400
    assert "cannot be deleted" in del_sys.json()["detail"]


def test_human_recorded_attribution(knowledge_setup):
    """14. Human-recorded entries have entry_type='HUMAN_RECORDED' and preserve author name."""
    proj_a = knowledge_setup["proj_a"]
    create_res = client.post(
        f"/api/v1/projects/{proj_a.id}/knowledge",
        json={
            "title": "Staff scheduling bottleneck",
            "content": "Weekend coverage is thin in triage.",
            "category": "OPERATIONAL_NOTE",
            "source_type": "MANUAL",
            "created_by": "Dr. Marcus Vance",
        },
    )
    assert create_res.status_code == 201
    entry = create_res.json()
    assert entry["entry_type"] == "HUMAN_RECORDED"
    assert entry["created_by"] == "Dr. Marcus Vance"


def test_unknown_source_handling(knowledge_setup):
    """15. Unknown or arbitrary source_type strings are accepted and preserved without crashing."""
    proj_a = knowledge_setup["proj_a"]
    create_res = client.post(
        f"/api/v1/projects/{proj_a.id}/knowledge",
        json={
            "title": "Custom Integration Note",
            "content": "Derived from custom telemetry system.",
            "category": "OBSERVATION",
            "source_type": "CUSTOM_IOT_STREAM",
            "source_id": "sensor-device-984",
        },
    )
    assert create_res.status_code == 201
    entry = create_res.json()
    assert entry["source_type"] == "CUSTOM_IOT_STREAM"
    assert entry["source_id"] == "sensor-device-984"


def test_no_cross_project_leakage(knowledge_setup):
    """16. Querying Project B with Project A's decision_id returns 0 results."""
    proj_b = knowledge_setup["proj_b"]
    rec_a1 = knowledge_setup["rec_a1"]

    res = client.get(f"/api/v1/projects/{proj_b.id}/knowledge?decision_id={rec_a1.id}")
    assert res.status_code == 200
    assert res.json()["total_entries"] == 0
    assert res.json()["entries"] == []


def test_no_mutation_of_decision_records(knowledge_setup, db: Session):
    """17. Recording knowledge never modifies DecisionRecommendation records."""
    rec_a1 = knowledge_setup["rec_a1"]
    proj_a = knowledge_setup["proj_a"]

    orig_title = rec_a1.title
    orig_impact = rec_a1.impact_level

    # Perform create, update, and archive knowledge operations
    create_res = client.post(
        f"/api/v1/projects/{proj_a.id}/knowledge",
        json={
            "title": "Lesson on decision",
            "content": "Observations on rec A1",
            "category": "DECISION_LESSON",
            "source_type": "DECISION",
            "source_id": rec_a1.id,
            "decision_id": rec_a1.id,
        },
    )
    kid = create_res.json()["id"]
    client.patch(f"/api/v1/knowledge/{kid}", json={"title": "Updated lesson"})
    client.delete(f"/api/v1/knowledge/{kid}")

    # Verify decision recommendation row is unmodified
    db.expire_all()
    reloaded_rec = db.scalar(select(DecisionRecommendation).where(DecisionRecommendation.id == rec_a1.id))
    assert reloaded_rec.title == orig_title
    assert reloaded_rec.impact_level == orig_impact


def test_no_mutation_of_outcome_records(knowledge_setup, db: Session):
    """18. Knowledge operations never mutate DecisionOutcome records."""
    outcome_a1 = knowledge_setup["outcome_a1"]
    proj_a = knowledge_setup["proj_a"]

    orig_val = outcome_a1.actual_value
    orig_status = outcome_a1.outcome_status

    # Query project knowledge (which reads from outcomes to synthesize system-derived entries)
    client.get(f"/api/v1/projects/{proj_a.id}/knowledge?include_system_derived=true")

    db.expire_all()
    reloaded_out = db.scalar(select(DecisionOutcome).where(DecisionOutcome.id == outcome_a1.id))
    assert reloaded_out.actual_value == orig_val
    assert reloaded_out.outcome_status == orig_status


def test_no_mutation_of_learning_signals(knowledge_setup, db: Session):
    """19. Knowledge operations never mutate DecisionLearningSignal records."""
    signal_a1 = knowledge_setup["signal_a1"]
    proj_a = knowledge_setup["proj_a"]

    orig_severity = signal_a1.severity
    orig_status = signal_a1.status

    # Query project knowledge with search
    client.get(f"/api/v1/projects/{proj_a.id}/knowledge?search=acceleration")

    db.expire_all()
    reloaded_sig = db.scalar(select(DecisionLearningSignal).where(DecisionLearningSignal.id == signal_a1.id))
    assert reloaded_sig.severity == orig_severity
    assert reloaded_sig.status == orig_status


def test_phase4_insight_memory_behavior_unchanged(knowledge_setup, db: Session):
    """20. Phase 4 InsightMemory table and logic remain completely untouched and intact."""
    im_a = knowledge_setup["insight_memory_a"]
    proj_a = knowledge_setup["proj_a"]

    # Verify existing Phase 4 insight memory is queryable and intact
    db.expire_all()
    reloaded_im = db.scalar(select(InsightMemory).where(InsightMemory.id == im_a.id))
    assert reloaded_im is not None
    assert reloaded_im.title == "Turnover correlates with morning triage"
    assert reloaded_im.category == "CORRELATION"
    assert reloaded_im.status == "STRENGTHENED"

    # Add knowledge entry in Phase 14
    client.post(
        f"/api/v1/projects/{proj_a.id}/knowledge",
        json={
            "title": "Phase 14 Knowledge Entry",
            "content": "Independent knowledge layer",
            "category": "DECISION_LESSON",
            "source_type": "MANUAL",
        },
    )

    # InsightMemory row remains identical
    db.expire_all()
    reloaded_im2 = db.scalar(select(InsightMemory).where(InsightMemory.id == im_a.id))
    assert reloaded_im2.title == "Turnover correlates with morning triage"
