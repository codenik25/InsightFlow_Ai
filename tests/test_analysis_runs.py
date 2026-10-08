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
from app.services.analysis_run_service import AnalysisRunService
from app.services.eda_service import EDAService
from app.services.insight_service import InsightService
from app.services.ml_task_service import MLTaskService
from app.services.optimization_service import OptimizationService
from app.services.recommendation_service import RecommendationService
from app.services.decision_service import DecisionService
from app.services.guardrail_service import DecisionGuardrailService
from app.schemas.optimization import OptimizationRequest, OptimizationObjective
from app.schemas.decision import ScenarioCreateRequest

client = TestClient(app)

SAMPLE_CSV = b"""patient_id,age,cost,readmitted,stay_days
1,65,1200.5,1,4
2,45,850.0,0,2
3,72,2100.0,1,7
4,55,1400.0,0,3
5,61,1900.0,1,5
6,38,600.0,0,1
7,80,3200.0,1,9
8,49,1100.0,0,3
9,58,1650.0,1,6
10,67,2300.0,1,8
"""

SAMPLE_CSV_V2 = b"""patient_id,age,cost,readmitted,stay_days
1,65,1250.0,1,4
2,45,900.0,0,2
3,72,2200.0,1,7
4,55,1450.0,0,3
5,61,1950.0,1,5
6,38,650.0,0,1
7,80,3300.0,1,9
8,49,1150.0,0,3
9,58,1700.0,1,6
10,67,2400.0,1,8
11,53,1300.0,0,3
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
        name=f"Run Test Workspace {uuid.uuid4().hex[:6]}",
        description="Workspace for analysis run testing",
    )
    db_session.add(ws)
    db_session.flush()

    proj = Project(
        id=str(uuid.uuid4()),
        workspace_id=ws.id,
        name=f"Run Test Project {uuid.uuid4().hex[:6]}",
        description="Testing analysis runs and reproducibility",
    )
    db_session.add(proj)
    db_session.commit()
    db_session.refresh(proj)
    return ws, proj


@pytest.fixture
def uploaded_dataset_with_child(test_workspace_and_project):
    """Uploads a raw CSV dataset and creates a processed child dataset."""
    ws, proj = test_workspace_and_project

    # 1. Upload raw dataset
    resp = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("hospital_data.csv", io.BytesIO(SAMPLE_CSV), "text/csv")},
        data={"project_id": proj.id},
    )
    assert resp.status_code == 201, resp.text
    raw_id = resp.json()["dataset_id"]

    # 2. Apply cleaning to produce processed child dataset
    plan_payload = {
        "dataset_id": raw_id,
        "operations": [
            {"type": "remove_duplicates"},
        ]
    }
    apply_resp = client.post(f"/api/v1/datasets/{raw_id}/clean/apply", json=plan_payload)
    assert apply_resp.status_code == 200, apply_resp.text
    processed_id = apply_resp.json()["output_dataset_id"]

    return proj, raw_id, processed_id


def test_analysis_run_created_on_analysis_execution(db_session: Session, uploaded_dataset_with_child):
    """Req 1: Executing an analysis creates an AnalysisRun record."""
    proj, raw_id, proc_id = uploaded_dataset_with_child

    resp = client.post(f"/api/v1/datasets/{proc_id}/eda")
    assert resp.status_code == 200, resp.text

    runs = db_session.query(AnalysisRun).filter(AnalysisRun.project_id == proj.id).all()
    assert len(runs) >= 1
    eda_run = [r for r in runs if r.run_type == "EDA"]
    assert len(eda_run) == 1
    assert eda_run[0].status == "COMPLETED"


def test_analysis_run_links_exact_dataset_version(db_session: Session, uploaded_dataset_with_child):
    """Req 2: Analysis run stores the exact raw dataset version (v1)."""
    proj, raw_id, proc_id = uploaded_dataset_with_child

    client.post(f"/api/v1/datasets/{proc_id}/eda")

    run = db_session.query(AnalysisRun).filter(
        AnalysisRun.project_id == proj.id,
        AnalysisRun.run_type == "EDA"
    ).first()
    assert run is not None
    assert run.dataset_id == raw_id
    assert run.dataset_version == 1


def test_analysis_run_links_processed_dataset_child(db_session: Session, uploaded_dataset_with_child):
    """Req 3: Analysis run correctly records processed_dataset_id when run on a child dataset."""
    proj, raw_id, proc_id = uploaded_dataset_with_child

    client.post(f"/api/v1/datasets/{proc_id}/eda")

    run = db_session.query(AnalysisRun).filter(
        AnalysisRun.project_id == proj.id,
        AnalysisRun.run_type == "EDA"
    ).first()
    assert run is not None
    assert run.processed_dataset_id == proc_id


def test_analysis_run_captures_run_type(db_session: Session, uploaded_dataset_with_child):
    """Req 4: Captures run_type correctly (e.g. EDA, INSIGHTS, PREDICTION)."""
    proj, raw_id, proc_id = uploaded_dataset_with_child

    # Run EDA
    client.post(f"/api/v1/datasets/{proc_id}/eda")
    # Run Insights
    client.post(f"/api/v1/datasets/{proc_id}/insights/generate")

    runs = db_session.query(AnalysisRun).filter(AnalysisRun.project_id == proj.id).all()
    types = {r.run_type for r in runs}
    assert "EDA" in types
    assert "INSIGHTS" in types


def test_analysis_run_captures_configuration(db_session: Session, uploaded_dataset_with_child):
    """Req 5: Run record captures configuration parameters."""
    proj, raw_id, proc_id = uploaded_dataset_with_child

    # Run ML analysis with specific parameters
    ml_resp = client.post(
        f"/api/v1/datasets/{proc_id}/ml/analyze",
        json={"task_type": "regression", "target_column": "cost"}
    )
    assert ml_resp.status_code == 200, ml_resp.text

    run = db_session.query(AnalysisRun).filter(
        AnalysisRun.project_id == proj.id,
        AnalysisRun.run_type == "PREDICTION"
    ).order_by(AnalysisRun.created_at.desc()).first()

    assert run is not None
    assert run.configuration is not None
    assert run.configuration.get("task_type") == "regression"
    assert run.configuration.get("target_column") == "cost"


def test_analysis_run_captures_output_artifacts(db_session: Session, uploaded_dataset_with_child):
    """Req 6: Run record captures output artifacts and discovered metrics."""
    proj, raw_id, proc_id = uploaded_dataset_with_child

    client.post(f"/api/v1/datasets/{proc_id}/eda")

    run = db_session.query(AnalysisRun).filter(
        AnalysisRun.project_id == proj.id,
        AnalysisRun.run_type == "EDA"
    ).first()

    assert run is not None
    assert run.output_artifacts is not None
    assert "eda_id" in run.output_artifacts
    assert "discovered_kpis_count" in run.output_artifacts


def test_analysis_run_captures_duration_and_timestamps(db_session: Session, uploaded_dataset_with_child):
    """Req 7: started_at, completed_at, and non-negative duration_ms are stored."""
    proj, raw_id, proc_id = uploaded_dataset_with_child

    client.post(f"/api/v1/datasets/{proc_id}/eda")

    run = db_session.query(AnalysisRun).filter(
        AnalysisRun.project_id == proj.id,
        AnalysisRun.run_type == "EDA"
    ).first()

    assert run is not None
    assert run.started_at is not None
    assert run.completed_at is not None
    assert run.duration_ms is not None
    assert run.duration_ms >= 0


def test_analysis_run_captures_failed_state_on_error(db_session: Session, uploaded_dataset_with_child):
    """Req 8: When execution fails, status is FAILED and error_message is captured."""
    proj, raw_id, proc_id = uploaded_dataset_with_child

    # Start a run manually and fail it via AnalysisRunService to verify lifecycle
    run = AnalysisRunService.start_run(
        db=db_session,
        dataset_id=proc_id,
        run_type="PREDICTION",
        configuration={"test": True}
    )
    assert run.status == "RUNNING"

    failed_run = AnalysisRunService.fail_run(
        db=db_session,
        run_id=run.id,
        error_message="Simulated analysis failure for verification"
    )
    assert failed_run is not None
    assert failed_run.status == "FAILED"
    assert failed_run.error_message == "Simulated analysis failure for verification"
    assert failed_run.completed_at is not None
    assert failed_run.duration_ms is not None


def test_project_runs_endpoint_lists_runs(uploaded_dataset_with_child):
    """Req 9: GET /api/v1/projects/{project_id}/runs lists runs for the project."""
    proj, raw_id, proc_id = uploaded_dataset_with_child

    client.post(f"/api/v1/datasets/{proc_id}/eda")

    resp = client.get(f"/api/v1/projects/{proj.id}/runs")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "runs" in data
    assert "total" in data
    assert data["total"] >= 1
    assert data["runs"][0]["project_id"] == proj.id


def test_dataset_runs_endpoint_lists_runs(uploaded_dataset_with_child):
    """Req 10: GET /api/v1/datasets/{dataset_id}/runs lists runs for the dataset."""
    proj, raw_id, proc_id = uploaded_dataset_with_child

    client.post(f"/api/v1/datasets/{proc_id}/eda")

    # Should be accessible via processed dataset
    resp_proc = client.get(f"/api/v1/datasets/{proc_id}/runs")
    assert resp_proc.status_code == 200, resp_proc.text
    assert resp_proc.json()["total"] >= 1

    # Should also be accessible via raw parent dataset
    resp_raw = client.get(f"/api/v1/datasets/{raw_id}/runs")
    assert resp_raw.status_code == 200, resp_raw.text
    assert resp_raw.json()["total"] >= 1


def test_get_run_by_id_endpoint(uploaded_dataset_with_child):
    """Req 11: GET /api/v1/runs/{run_id} returns the full run details."""
    proj, raw_id, proc_id = uploaded_dataset_with_child

    client.post(f"/api/v1/datasets/{proc_id}/eda")

    list_resp = client.get(f"/api/v1/projects/{proj.id}/runs")
    run_id = list_resp.json()["runs"][0]["id"]

    run_resp = client.get(f"/api/v1/runs/{run_id}")
    assert run_resp.status_code == 200, run_resp.text
    run_data = run_resp.json()
    assert run_data["id"] == run_id
    assert run_data["run_type"] == "EDA"
    assert run_data["dataset_id"] == raw_id
    assert run_data["dataset_version"] == 1


def test_runs_filter_by_run_type(uploaded_dataset_with_child):
    """Req 12: Query parameter run_type filters runs accurately."""
    proj, raw_id, proc_id = uploaded_dataset_with_child

    client.post(f"/api/v1/datasets/{proc_id}/eda")
    client.post(f"/api/v1/datasets/{proc_id}/insights/generate")

    eda_resp = client.get(f"/api/v1/projects/{proj.id}/runs?run_type=EDA")
    assert eda_resp.status_code == 200
    assert all(r["run_type"] == "EDA" for r in eda_resp.json()["runs"])

    ins_resp = client.get(f"/api/v1/projects/{proj.id}/runs?run_type=INSIGHTS")
    assert ins_resp.status_code == 200
    assert all(r["run_type"] == "INSIGHTS" for r in ins_resp.json()["runs"])


def test_runs_filter_by_status(db_session: Session, uploaded_dataset_with_child):
    """Req 13: Query parameter status filters runs accurately."""
    proj, raw_id, proc_id = uploaded_dataset_with_child

    client.post(f"/api/v1/datasets/{proc_id}/eda")

    # Create a failed run
    run = AnalysisRunService.start_run(db=db_session, dataset_id=proc_id, run_type="PREDICTION")
    AnalysisRunService.fail_run(db=db_session, run_id=run.id, error_message="test failure")

    completed_resp = client.get(f"/api/v1/projects/{proj.id}/runs?status=COMPLETED")
    assert completed_resp.status_code == 200
    assert all(r["status"] == "COMPLETED" for r in completed_resp.json()["runs"])

    failed_resp = client.get(f"/api/v1/projects/{proj.id}/runs?status=FAILED")
    assert failed_resp.status_code == 200
    assert all(r["status"] == "FAILED" for r in failed_resp.json()["runs"])
    assert failed_resp.json()["total"] >= 1


def test_runs_filter_by_version(uploaded_dataset_with_child):
    """Req 14: Query parameter dataset_version filters runs accurately."""
    proj, raw_id, proc_id = uploaded_dataset_with_child

    client.post(f"/api/v1/datasets/{proc_id}/eda")

    v1_resp = client.get(f"/api/v1/projects/{proj.id}/runs?dataset_version=1")
    assert v1_resp.status_code == 200
    assert all(r["dataset_version"] == 1 for r in v1_resp.json()["runs"])

    v99_resp = client.get(f"/api/v1/projects/{proj.id}/runs?dataset_version=99")
    assert v99_resp.status_code == 200
    assert v99_resp.json()["total"] == 0


def test_analysis_runs_isolated_by_project_boundary(db_session: Session, uploaded_dataset_with_child):
    """Req 15: Cross-project access is strictly isolated."""
    proj1, raw_id, proc_id = uploaded_dataset_with_child
    
    ws2 = Workspace(id=str(uuid.uuid4()), name=f"Boundary WS {uuid.uuid4().hex[:6]}")
    db_session.add(ws2)
    proj2 = Project(id=str(uuid.uuid4()), workspace_id=ws2.id, name=f"Boundary Proj {uuid.uuid4().hex[:6]}")
    db_session.add(proj2)
    db_session.commit()

    # Generate a run in project 1
    client.post(f"/api/v1/datasets/{proc_id}/eda")
    list1 = client.get(f"/api/v1/projects/{proj1.id}/runs").json()
    run_id = list1["runs"][0]["id"]

    # Project 2 run list must not contain Project 1's run
    list2 = client.get(f"/api/v1/projects/{proj2.id}/runs").json()
    assert list2["total"] == 0

    # Direct run fetch with mismatched project_id check returns 404
    mismatch_resp = client.get(f"/api/v1/runs/{run_id}?project_id={proj2.id}")
    assert mismatch_resp.status_code == 404


def test_all_seven_analysis_types_generate_runs(db_session: Session, uploaded_dataset_with_child):
    """
    Req 16: All 7 analytical engines generate runs:
    1. EDA
    2. INSIGHTS
    3. PREDICTION
    4. OPTIMIZATION
    5. RECOMMENDATION
    6. DECISION
    7. GUARDRAIL
    """
    proj, raw_id, proc_id = uploaded_dataset_with_child

    # 1. EDA
    eda_resp = client.post(f"/api/v1/datasets/{proc_id}/eda")
    assert eda_resp.status_code == 200

    # 2. INSIGHTS
    ins_resp = client.post(f"/api/v1/datasets/{proc_id}/insights/generate")
    assert ins_resp.status_code == 200

    # 3. PREDICTION
    ml_resp = client.post(
        f"/api/v1/datasets/{proc_id}/ml/analyze",
        json={"task_type": "regression", "target_column": "cost"}
    )
    assert ml_resp.status_code == 200
    ml_analysis_id = ml_resp.json()["id"]

    # 4. OPTIMIZATION
    opt_resp = client.post(
        f"/api/v1/datasets/{proc_id}/decision/optimize",
        json={
            "objective": "minimize",
            "max_scenarios": 5
        }
    )
    assert opt_resp.status_code == 200, opt_resp.text
    opt_id = opt_resp.json()["optimization_id"]

    # 5. RECOMMENDATION
    rec_resp = client.post(
        f"/api/v1/datasets/{proc_id}/decision/optimize/recommendations",
        json={"optimization_id": opt_id, "max_recommendations": 3}
    )
    assert rec_resp.status_code == 201, rec_resp.text

    # 6. DECISION (Scenario Simulation)
    scen_resp = client.post(
        f"/api/v1/datasets/{proc_id}/decision/scenarios",
        json={
            "name": "Cost Reduction What-If",
            "feature_changes": {"stay_days": 2.0}
        }
    )
    assert scen_resp.status_code == 200, scen_resp.text

    # 7. GUARDRAIL
    guard_resp = client.post(f"/api/v1/datasets/{proc_id}/decision/guardrails")
    assert guard_resp.status_code == 201, guard_resp.text

    # Verify all 7 run types in DB
    runs = db_session.query(AnalysisRun).filter(AnalysisRun.project_id == proj.id).all()
    recorded_types = {r.run_type for r in runs}

    expected_types = {
        "EDA",
        "INSIGHTS",
        "PREDICTION",
        "OPTIMIZATION",
        "RECOMMENDATION",
        "DECISION",
        "GUARDRAIL",
    }
    assert expected_types.issubset(recorded_types), f"Missing: {expected_types - recorded_types}"


def test_dataset_version_increment_links_new_runs_to_new_version(uploaded_dataset_with_child):
    """
    Req 17: Uploading a new version of the same dataset (v2) links new analyses to v2,
    preserving v1 runs linked to v1.
    """
    proj, raw_id, proc_id = uploaded_dataset_with_child

    # Run EDA on v1
    client.post(f"/api/v1/datasets/{proc_id}/eda")

    # Upload v2 with same filename to same project
    resp2 = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("hospital_data.csv", io.BytesIO(SAMPLE_CSV_V2), "text/csv")},
        data={"project_id": proj.id},
    )
    assert resp2.status_code == 201
    raw_v2_id = resp2.json()["dataset_id"]
    ds_v2 = client.get(f"/api/v1/datasets/{raw_v2_id}").json()
    assert ds_v2["version"] == 2

    # Clean v2 to get proc_v2
    plan_payload = {
        "dataset_id": raw_v2_id,
        "operations": [
            {"type": "remove_duplicates"},
        ]
    }
    apply_resp = client.post(f"/api/v1/datasets/{raw_v2_id}/clean/apply", json=plan_payload)
    assert apply_resp.status_code == 200, apply_resp.text
    proc_v2_id = apply_resp.json()["output_dataset_id"]

    # Run EDA on v2
    client.post(f"/api/v1/datasets/{proc_v2_id}/eda")

    # Query v1 runs
    v1_runs = client.get(f"/api/v1/projects/{proj.id}/runs?dataset_version=1").json()
    assert v1_runs["total"] == 1
    assert v1_runs["runs"][0]["dataset_id"] == raw_id
    assert v1_runs["runs"][0]["dataset_version"] == 1

    # Query v2 runs
    v2_runs = client.get(f"/api/v1/projects/{proj.id}/runs?dataset_version=2").json()
    assert v2_runs["total"] == 1
    assert v2_runs["runs"][0]["dataset_id"] == raw_v2_id
    assert v2_runs["runs"][0]["dataset_version"] == 2
