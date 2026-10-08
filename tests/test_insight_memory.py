import io
import uuid
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
from app.models.insight_memory import InsightMemory
from app.models.decision_recommendation_evaluation import DecisionRecommendationEvaluation
from app.services.insight_memory_service import InsightMemoryService
from app.services.insight_service import InsightService

client = TestClient(app)

CSV_V1 = b"""patient_id,age,cost,readmitted,stay_days,department
1,65,1200.0,1,4,Cardiology
2,45,800.0,0,2,Cardiology
3,72,2100.0,1,7,Cardiology
4,55,1400.0,0,3,Cardiology
5,61,1900.0,1,5,Cardiology
6,38,600.0,0,1,Cardiology
7,80,3200.0,1,9,Cardiology
8,49,1100.0,0,3,Cardiology
9,58,1650.0,1,6,Cardiology
10,67,2300.0,1,8,Cardiology
"""

# CSV_V2 has cost slightly higher (strengthening correlation or average)
CSV_V2 = b"""patient_id,age,cost,readmitted,stay_days,department
1,65,1300.0,1,4,Cardiology
2,45,850.0,0,2,Cardiology
3,72,2250.0,1,7,Cardiology
4,55,1450.0,0,3,Cardiology
5,61,2000.0,1,5,Cardiology
6,38,650.0,0,1,Cardiology
7,80,3400.0,1,9,Cardiology
8,49,1150.0,0,3,Cardiology
9,58,1750.0,1,6,Cardiology
10,67,2450.0,1,8,Cardiology
"""

CSV_OTHER_LINEAGE = b"""equipment_id,cost,maintenance_hours,facility
101,5000.0,12,North
102,12000.0,40,South
103,3000.0,8,East
104,8000.0,24,West
"""


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def test_workspace_and_project(db_session: Session):
    ws = Workspace(
        id=str(uuid.uuid4()),
        name=f"Phase4 Workspace {uuid.uuid4().hex[:6]}",
        description="Testing Insight Memory and Impact Tracking",
    )
    db_session.add(ws)
    db_session.flush()

    proj = Project(
        id=str(uuid.uuid4()),
        workspace_id=ws.id,
        name=f"Phase4 Project {uuid.uuid4().hex[:6]}",
        description="Testing Insight Memory Phase 4",
    )
    db_session.add(proj)
    db_session.commit()
    db_session.refresh(proj)
    return ws, proj


@pytest.fixture
def upload_hospital_v1(test_workspace_and_project):
    ws, proj = test_workspace_and_project
    resp = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("hospital_data.csv", io.BytesIO(CSV_V1), "text/csv")},
        data={"project_id": proj.id},
    )
    assert resp.status_code == 201, resp.text
    raw_id = resp.json()["dataset_id"]

    # Process child
    plan = {"dataset_id": raw_id, "operations": [{"type": "remove_duplicates"}]}
    apply_resp = client.post(f"/api/v1/datasets/{raw_id}/clean/apply", json=plan)
    assert apply_resp.status_code == 200, apply_resp.text
    proc_id = apply_resp.json()["output_dataset_id"]

    return proj, raw_id, proc_id


@pytest.fixture
def upload_hospital_v2(test_workspace_and_project):
    ws, proj = test_workspace_and_project
    resp = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("hospital_data.csv", io.BytesIO(CSV_V2), "text/csv")},
        data={"project_id": proj.id},
    )
    assert resp.status_code == 201, resp.text
    raw_id = resp.json()["dataset_id"]

    plan = {"dataset_id": raw_id, "operations": [{"type": "remove_duplicates"}]}
    apply_resp = client.post(f"/api/v1/datasets/{raw_id}/clean/apply", json=plan)
    assert apply_resp.status_code == 200, apply_resp.text
    proc_id = apply_resp.json()["output_dataset_id"]

    return proj, raw_id, proc_id


# ==============================================================================
# TEST CASES
# ==============================================================================

def test_new_insight_detection_on_first_run(db_session: Session, upload_hospital_v1):
    """Req 1: First analysis run detects new insights and stores them with status NEW."""
    proj, raw_id, proc_id = upload_hospital_v1

    # Generate insights via endpoint
    resp = client.get(f"/api/v1/datasets/{proc_id}/insights")
    assert resp.status_code == 200, resp.text
    insights_data = resp.json()
    assert len(insights_data.get("insights", [])) > 0

    # Query InsightMemory table
    memories = db_session.query(InsightMemory).filter(
        InsightMemory.project_id == proj.id
    ).all()
    assert len(memories) > 0

    for m in memories:
        assert m.status == "NEW"
        assert m.first_seen_version == 1
        assert m.latest_seen_version == 1
        assert m.first_seen_run_id is not None
        assert m.latest_run_id is not None
        assert m.insight_fingerprint is not None
        assert len(m.insight_fingerprint) == 16


def test_deterministic_fingerprinting_stability(db_session: Session):
    """Req 2: Fingerprint is 100% deterministic and independent of DB row IDs."""
    fp1 = InsightMemoryService.generate_fingerprint(
        category="CORRELATION",
        title="High correlation observed between Age and Cost",
        affected_columns=["cost", "age"],
        details={"dimension": "department", "measure": "cost"}
    )
    fp2 = InsightMemoryService.generate_fingerprint(
        category="CORRELATION",
        title="High correlation observed between Age and Cost",
        affected_columns=["age", "cost"],  # Column ordering does not matter
        details={"measure": "cost", "dimension": "department"}  # Key ordering does not matter
    )
    assert fp1 == fp2
    assert len(fp1) == 16


def test_cross_run_consistency_same_version(db_session: Session, upload_hospital_v1):
    """Req 3: Re-running insights on the same dataset version updates existing records, no duplicates."""
    proj, raw_id, proc_id = upload_hospital_v1

    # First run
    resp1 = client.get(f"/api/v1/datasets/{proc_id}/insights")
    assert resp1.status_code == 200
    count1 = db_session.query(InsightMemory).filter(InsightMemory.project_id == proj.id).count()
    assert count1 > 0

    # Second run
    resp2 = client.get(f"/api/v1/datasets/{proc_id}/insights")
    assert resp2.status_code == 200
    count2 = db_session.query(InsightMemory).filter(InsightMemory.project_id == proj.id).count()
    
    # Must NOT create duplicate records
    assert count1 == count2


def test_persisted_insight_detection(db_session: Session, upload_hospital_v1, upload_hospital_v2):
    """Req 4: Insights remaining consistent across v1 and v2 are marked as PERSISTED."""
    proj, raw_v1, proc_v1 = upload_hospital_v1
    _, raw_v2, proc_v2 = upload_hospital_v2

    # Run v1
    resp1 = client.get(f"/api/v1/datasets/{proc_v1}/insights")
    assert resp1.status_code == 200

    # Run v2
    resp2 = client.get(f"/api/v1/datasets/{proc_v2}/insights")
    assert resp2.status_code == 200

    # Verify memory
    memories = db_session.query(InsightMemory).filter(InsightMemory.project_id == proj.id).all()
    statuses = {m.status for m in memories}
    assert any(s in ["PERSISTED", "STRENGTHENED", "WEAKENED"] for s in statuses)

    # Check versions
    v2_memories = [m for m in memories if m.latest_seen_version == 2]
    assert len(v2_memories) > 0
    for m in v2_memories:
        assert m.first_seen_version == 1
        assert m.latest_seen_version == 2


def test_strengthened_and_weakened_thresholds():
    """Req 5: Numerical strength delta correctly categorizes STRENGTHENED and WEAKENED."""
    assert InsightMemoryService.calculate_status(0.50, 0.60, 2, 1) == "STRENGTHENED"
    assert InsightMemoryService.calculate_status(0.50, 0.40, 2, 1) == "WEAKENED"
    assert InsightMemoryService.calculate_status(0.50, 0.505, 2, 1) == "PERSISTED"  # |delta| <= 0.01
    assert InsightMemoryService.calculate_status(0.50, 0.495, 2, 1) == "PERSISTED"  # |delta| <= 0.01
    assert InsightMemoryService.calculate_status(0.50, 0.50, 1, 1) == "NEW"


def test_disappeared_insight_detection(db_session: Session, upload_hospital_v1):
    """Req 6: When an insight is not observed in a subsequent version, status updates to DISAPPEARED."""
    proj, raw_v1, proc_v1 = upload_hospital_v1

    # Run on v1
    resp1 = client.get(f"/api/v1/datasets/{proc_v1}/insights")
    assert resp1.status_code == 200

    memories_v1 = db_session.query(InsightMemory).filter(InsightMemory.project_id == proj.id).all()
    assert len(memories_v1) > 0
    target_fp = memories_v1[0].insight_fingerprint

    # Upload v2 with only 2 rows where correlations/groupings cannot be computed
    TINY_CSV = b"""patient_id,age,cost,readmitted,stay_days,department
1,65,1200.0,1,4,Cardiology
2,45,800.0,0,2,Cardiology
"""
    resp_up = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("hospital_data.csv", io.BytesIO(TINY_CSV), "text/csv")},
        data={"project_id": proj.id},
    )
    raw_v2 = resp_up.json()["dataset_id"]
    plan = {"dataset_id": raw_v2, "operations": [{"type": "remove_duplicates"}]}
    apply_resp = client.post(f"/api/v1/datasets/{raw_v2}/clean/apply", json=plan)
    proc_v2 = apply_resp.json()["output_dataset_id"]

    # Run on v2
    resp2 = client.get(f"/api/v1/datasets/{proc_v2}/insights")
    assert resp2.status_code == 200

    # Check that insights not present in v2 were marked as DISAPPEARED
    disappeared = db_session.query(InsightMemory).filter(
        InsightMemory.project_id == proj.id,
        InsightMemory.status == "DISAPPEARED"
    ).all()
    assert len(disappeared) > 0


def test_same_lineage_version_impact_comparison(upload_hospital_v1, upload_hospital_v2):
    """Req 7: Comparing v1 and v2 of same lineage returns structured impact report."""
    proj, raw_v1, proc_v1 = upload_hospital_v1
    _, raw_v2, proc_v2 = upload_hospital_v2

    # Run insights on both
    client.get(f"/api/v1/datasets/{proc_v1}/insights")
    client.get(f"/api/v1/datasets/{proc_v2}/insights")

    resp = client.get(f"/api/v1/datasets/{proc_v1}/insight-impact/{proc_v2}")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["project_id"] == proj.id
    assert data["base_version"] == 1
    assert data["comparison_version"] == 2
    assert "counters" in data
    assert "impacts" in data
    assert len(data["impacts"]) > 0


def test_cross_lineage_comparison_rejected(test_workspace_and_project, upload_hospital_v1):
    """Req 8: Comparing datasets across different lineages returns 400 Bad Request."""
    ws, proj = test_workspace_and_project
    _, raw_v1, proc_v1 = upload_hospital_v1

    # Upload independent dataset
    resp_other = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("equipment_data.csv", io.BytesIO(CSV_OTHER_LINEAGE), "text/csv")},
        data={"project_id": proj.id},
    )
    other_raw_id = resp_other.json()["dataset_id"]

    # Attempt cross-lineage comparison
    resp = client.get(f"/api/v1/datasets/{proc_v1}/insight-impact/{other_raw_id}")
    assert resp.status_code == 400
    assert "Cross-lineage" in resp.json()["detail"]


def test_cross_project_isolation(db_session: Session, upload_hospital_v1):
    """Req 9: Datasets in different projects cannot be compared (cross-project isolation)."""
    proj1, raw_v1, proc_v1 = upload_hospital_v1

    # Create second project
    proj2 = Project(
        id=str(uuid.uuid4()),
        workspace_id=proj1.workspace_id,
        name="Project 2",
        description="Isolated project",
    )
    db_session.add(proj2)
    db_session.commit()

    resp_up = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("hospital_data.csv", io.BytesIO(CSV_V2), "text/csv")},
        data={"project_id": proj2.id},
    )
    proc_p2 = resp_up.json()["dataset_id"]

    resp = client.get(f"/api/v1/datasets/{proc_v1}/insight-impact/{proc_p2}")
    assert resp.status_code == 400
    assert "Cross-project" in resp.json()["detail"]


def test_version_and_analysis_run_linkage(db_session: Session, upload_hospital_v1):
    """Req 10: InsightMemory properly links to first_seen_run_id, latest_run_id, first_seen_version, latest_seen_version."""
    proj, raw_id, proc_id = upload_hospital_v1

    client.get(f"/api/v1/datasets/{proc_id}/insights")

    memories = db_session.query(InsightMemory).filter(InsightMemory.project_id == proj.id).all()
    assert len(memories) > 0
    m = memories[0]

    # Verify run exists in DB
    first_run = db_session.query(AnalysisRun).filter(AnalysisRun.id == m.first_seen_run_id).first()
    assert first_run is not None
    assert first_run.run_type == "INSIGHTS"

    latest_run = db_session.query(AnalysisRun).filter(AnalysisRun.id == m.latest_run_id).first()
    assert latest_run is not None
    assert m.first_seen_version == 1
    assert m.latest_seen_version == 1


def test_empty_state_handling(test_workspace_and_project):
    """Req 11: Empty project returns 200 with 0 counters and empty items list."""
    ws, proj = test_workspace_and_project
    resp = client.get(f"/api/v1/projects/{proj.id}/insight-memory")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["counters"]["total"] == 0
    assert len(data["items"]) == 0
    assert len(data["timeline"]) == 0


def test_duplicate_prevention_unique_constraint(db_session: Session, upload_hospital_v1):
    """Req 12: Unique constraint guards against duplicate (project_id, dataset_lineage, insight_fingerprint)."""
    proj, raw_id, proc_id = upload_hospital_v1

    client.get(f"/api/v1/datasets/{proc_id}/insights")

    memories = db_session.query(InsightMemory).filter(InsightMemory.project_id == proj.id).all()
    first = memories[0]

    # Attempt manual insert with same project_id, lineage, fingerprint
    dup = InsightMemory(
        id=str(uuid.uuid4()),
        project_id=first.project_id,
        dataset_lineage=first.dataset_lineage,
        insight_fingerprint=first.insight_fingerprint,
        category=first.category,
        title=first.title,
        first_seen_run_id=first.first_seen_run_id,
        latest_run_id=first.latest_run_id,
        first_seen_version=first.first_seen_version,
        latest_seen_version=first.latest_seen_version,
        status="NEW",
    )
    db_session.add(dup)
    with pytest.raises(Exception):  # IntegrityError
        db_session.commit()
    db_session.rollback()


def test_project_level_insight_memory_endpoint(upload_hospital_v1):
    """Req 13: Project-level endpoint returns items, timeline, counters."""
    proj, raw_id, proc_id = upload_hospital_v1
    client.get(f"/api/v1/datasets/{proc_id}/insights")

    resp = client.get(f"/api/v1/projects/{proj.id}/insight-memory")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["project_id"] == proj.id
    assert data["counters"]["total"] > 0
    assert len(data["items"]) > 0
    assert len(data["timeline"]) > 0
    assert len(data["timeline"][0]["cells"]) > 0


def test_dataset_level_insight_memory_endpoint(upload_hospital_v1):
    """Req 14: Dataset-level endpoint returns memory scoped to that dataset's lineage and version."""
    proj, raw_id, proc_id = upload_hospital_v1
    client.get(f"/api/v1/datasets/{proc_id}/insights")

    resp = client.get(f"/api/v1/datasets/{proc_id}/insight-memory")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["dataset_lineage"] is not None
    assert len(data["items"]) > 0


def test_run_insights_endpoint(db_session: Session, upload_hospital_v1):
    """Req 15: GET /api/v1/runs/{run_id}/insights returns snapshot of insights from that run."""
    proj, raw_id, proc_id = upload_hospital_v1
    client.get(f"/api/v1/datasets/{proc_id}/insights")

    mem = db_session.query(InsightMemory).filter(InsightMemory.project_id == proj.id).first()
    assert mem is not None
    run_id = mem.latest_run_id

    resp = client.get(f"/api/v1/runs/{run_id}/insights")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) > 0


def test_downstream_decision_review_flagging(db_session: Session, upload_hospital_v1):
    """Req 16: Weakened or disappeared insights flag linked downstream recommendations."""
    from app.models.ml_analysis import MLAnalysis
    from app.models.decision_optimization import DecisionOptimization

    proj, raw_id, proc_id = upload_hospital_v1

    # Run insights
    client.get(f"/api/v1/datasets/{proc_id}/insights")
    memories = db_session.query(InsightMemory).filter(InsightMemory.project_id == proj.id).all()
    assert len(memories) > 0
    target_mem = memories[0]

    # Create parent MLAnalysis and DecisionOptimization to satisfy foreign keys
    ml_an = MLAnalysis(
        id=str(uuid.uuid4()),
        dataset_id=proc_id,
        task_type="regression",
        target_column="cost",
        feature_columns=["stay_days", "age"],
        model_name="RandomForestRegressor",
        metrics={"r2_score": 0.85},
    )
    db_session.add(ml_an)

    opt = DecisionOptimization(
        id=str(uuid.uuid4()),
        dataset_id=proc_id,
        ml_analysis_id=ml_an.id,
        objective="minimize",
        target_column="cost",
    )
    db_session.add(opt)
    db_session.commit()

    # Create a recommendation evaluation linking to this insight
    rec_eval = DecisionRecommendationEvaluation(
        id=str(uuid.uuid4()),
        dataset_id=proc_id,
        ml_analysis_id=ml_an.id,
        optimization_id=opt.id,
        recommendation_type="RESOURCE_ALLOCATION",
        priority=1,
        title="Cost Optimization Review",
        target_metric="cost",
        baseline_value=1500.0,
        projected_value=1200.0,
        absolute_delta=-300.0,
        percentage_delta=-20.0,
        changed_features={"stay_days": 3},
        rationale="Optimize stay days",
        tradeoffs="None",
        confidence="HIGH",
        evidence={"insight_ids": [target_mem.latest_insight_id or target_mem.insight_fingerprint, target_mem.insight_fingerprint]},
    )
    db_session.add(rec_eval)
    db_session.commit()

    # Query reviews via service
    reviews = InsightMemoryService.find_downstream_reviews(
        db=db_session,
        dataset_ids=[proc_id],
        changed_or_disappeared_ids={target_mem.insight_fingerprint},
    )
    assert len(reviews) > 0
    assert reviews[0].review_required is True
    assert "human review is advised" in reviews[0].reason.lower()


def test_non_causal_language_in_impact_summary(upload_hospital_v1, upload_hospital_v2):
    """Req 17: Ensures strictly non-causal language in impact summaries."""
    proj, raw_v1, proc_v1 = upload_hospital_v1
    _, raw_v2, proc_v2 = upload_hospital_v2

    client.get(f"/api/v1/datasets/{proc_v1}/insights")
    client.get(f"/api/v1/datasets/{proc_v2}/insights")

    resp = client.get(f"/api/v1/datasets/{proc_v1}/insight-impact/{proc_v2}")
    assert resp.status_code == 200
    impacts = resp.json()["impacts"]

    forbidden_causal_words = ["caused by", "forces", "dictates", "because of your changes", "makes it"]
    for imp in impacts:
        summary = imp["explanation"].lower()
        for word in forbidden_causal_words:
            assert word not in summary, f"Found causal phrasing '{word}' in explanation: {summary}"


def test_filtering_by_status_and_category(upload_hospital_v1):
    """Req 18: Query parameters status and category filter project memory response."""
    proj, raw_id, proc_id = upload_hospital_v1
    client.get(f"/api/v1/datasets/{proc_id}/insights")

    # Filter by status=NEW
    resp_new = client.get(f"/api/v1/projects/{proj.id}/insight-memory?status=NEW")
    assert resp_new.status_code == 200
    data_new = resp_new.json()
    for it in data_new["items"]:
        assert it["status"] == "NEW"

    # Filter by non-existent status
    resp_empty = client.get(f"/api/v1/projects/{proj.id}/insight-memory?status=WEAKENED")
    assert resp_empty.status_code == 200
    assert len(resp_empty.json()["items"]) == 0


def test_delta_magnitude_mathematical_justification(db_session: Session, upload_hospital_v1):
    """Req 19: Delta magnitude is strictly |strength_latest - strength_baseline|."""
    proj, raw_id, proc_id = upload_hospital_v1
    client.get(f"/api/v1/datasets/{proc_id}/insights")

    memories = db_session.query(InsightMemory).filter(InsightMemory.project_id == proj.id).all()
    for m in memories:
        if m.strength_baseline is not None and m.strength_latest is not None:
            expected_delta = abs(m.strength_latest - m.strength_baseline)
            assert abs(m.delta_magnitude - expected_delta) < 1e-4


def test_processed_dataset_inherits_raw_version_in_memory(upload_hospital_v1):
    """Req 20: Processed child dataset records its raw dataset version (v1) in insight memory."""
    proj, raw_id, proc_id = upload_hospital_v1
    client.get(f"/api/v1/datasets/{proc_id}/insights")

    resp = client.get(f"/api/v1/datasets/{proc_id}/insight-memory")
    assert resp.status_code == 200
    data = resp.json()
    for item in data["items"]:
        assert item["first_seen_version"] == 1
        assert item["latest_seen_version"] == 1


def test_timeline_presence_matrix_structure(upload_hospital_v1, upload_hospital_v2):
    """Req 21: Timeline matrix contains an ordered cell for every known version in the lineage."""
    proj, raw_v1, proc_v1 = upload_hospital_v1
    _, raw_v2, proc_v2 = upload_hospital_v2

    client.get(f"/api/v1/datasets/{proc_v1}/insights")
    client.get(f"/api/v1/datasets/{proc_v2}/insights")

    resp = client.get(f"/api/v1/projects/{proj.id}/insight-memory")
    assert resp.status_code == 200
    data = resp.json()

    assert data["versions"] == [1, 2]
    for row in data["timeline"]:
        assert len(row["cells"]) == 2
        assert row["cells"][0]["version"] == 1
        assert row["cells"][1]["version"] == 2
