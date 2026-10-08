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
from app.models.decision_recommendation import DecisionRecommendation
from app.models.decision_approval import DecisionApproval
from app.models.decision_outcome import DecisionOutcome
from app.models.decision_learning_signal import DecisionLearningSignal
from app.models.decision_execution import DecisionExecution
from app.models.ml_analysis import MLAnalysis
from app.models.scenario import Scenario
from app.services.decision_portfolio_service import DecisionPortfolioService

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
def capacity_setup(db: Session):
    """Setup Project A (with various lifecycle decisions) and Project B (for isolation)."""
    ws = Workspace(id=str(uuid.uuid4()), name=f"WS_{uuid.uuid4().hex[:6]}")
    db.add(ws)
    db.flush()

    # Project A
    proj_a = Project(id=str(uuid.uuid4()), workspace_id=ws.id, name=f"ProjA_{uuid.uuid4().hex[:6]}")
    # Project B (for isolation)
    proj_b = Project(id=str(uuid.uuid4()), workspace_id=ws.id, name=f"ProjB_{uuid.uuid4().hex[:6]}")
    db.add_all([proj_a, proj_b])
    db.flush()

    # Datasets for Project A
    ds1 = Dataset(
        id=str(uuid.uuid4()),
        project_id=proj_a.id,
        name="patient_flow_v1.csv",
        version=1,
        row_count=100,
        column_count=5,
    )
    ds2 = Dataset(
        id=str(uuid.uuid4()),
        project_id=proj_a.id,
        name="staffing_v1.csv",
        version=1,
        row_count=80,
        column_count=4,
    )
    # Dataset for Project B
    ds_b = Dataset(
        id=str(uuid.uuid4()),
        project_id=proj_b.id,
        name="project_b_data.csv",
        version=1,
        row_count=50,
        column_count=3,
    )
    db.add_all([ds1, ds2, ds_b])
    db.flush()

    # Explicit ML analysis on ds1
    ml1 = MLAnalysis(
        id=str(uuid.uuid4()),
        dataset_id=ds1.id,
        task_type="regression",
        model_name="RandomForestRegressor",
        status="completed",
        target_column="operating_cost",
    )
    db.add(ml1)
    db.flush()

    # Explicit Scenario on ds1
    sc1 = Scenario(
        id=str(uuid.uuid4()),
        dataset_id=ds1.id,
        name="Bed Expansion 20%",
        target_column="operating_cost",
        feature_changes={"expansion": 0.20},
    )
    db.add(sc1)
    db.flush()

    # D1: Pending Approval, metric="operating_cost", ds=ds1, scenario=sc1, ml=ml1
    d1_id = f"DEC_CAP_1_{uuid.uuid4().hex[:6]}"
    app1 = DecisionApproval(
        id=str(uuid.uuid4()),
        dataset_id=ds1.id,
        decision_id=d1_id,
        recommendation_id=d1_id,
        status="WAITING_FOR_APPROVAL",
        actor_id="Dr. Alice",
        created_at=utc_now() - timedelta(days=10),
    )
    out1_placeholder = DecisionOutcome(
        id=str(uuid.uuid4()),
        project_id=proj_a.id,
        dataset_id=ds1.id,
        decision_id=d1_id,
        recommendation_id=d1_id,
        expected_metric="operating_cost",
        expected_value=100.0,
        outcome_status="PENDING",
        scenario_id=sc1.id,
        ml_analysis_id=ml1.id,
    )
    db.add_all([app1, out1_placeholder])

    # D2: Approved, Execution=PENDING_CONFIRMATION, metric="operating_cost", ds=ds1, scenario=sc1, ml=ml1
    d2_id = f"DEC_CAP_2_{uuid.uuid4().hex[:6]}"
    app2 = DecisionApproval(
        id=str(uuid.uuid4()),
        dataset_id=ds1.id,
        decision_id=d2_id,
        recommendation_id=d2_id,
        status="APPROVED",
        actor_id="Dr. Bob",
        created_at=utc_now() - timedelta(days=8),
        decided_at=utc_now() - timedelta(days=7),
    )
    exc2 = DecisionExecution(
        id=str(uuid.uuid4()),
        project_id=proj_a.id,
        dataset_id=ds1.id,
        decision_id=d2_id,
        recommendation_id=d2_id,
        approval_id=app2.id,
        status="PENDING_CONFIRMATION",
        created_at=utc_now() - timedelta(days=6),
    )
    out2_placeholder = DecisionOutcome(
        id=str(uuid.uuid4()),
        project_id=proj_a.id,
        dataset_id=ds1.id,
        decision_id=d2_id,
        recommendation_id=d2_id,
        expected_metric="operating_cost",
        expected_value=100.0,
        outcome_status="PENDING",
        scenario_id=sc1.id,
        ml_analysis_id=ml1.id,
    )
    db.add_all([app2, exc2, out2_placeholder])

    # D3: Approved, Execution=EXECUTING, metric="patient_visits", ds=ds2 (NO scenario, NO ml)
    d3_id = f"DEC_CAP_3_{uuid.uuid4().hex[:6]}"
    app3 = DecisionApproval(
        id=str(uuid.uuid4()),
        dataset_id=ds2.id,
        decision_id=d3_id,
        recommendation_id=d3_id,
        status="APPROVED",
        actor_id="Dr. Carol",
        created_at=utc_now() - timedelta(days=5),
        decided_at=utc_now() - timedelta(days=4),
    )
    exc3 = DecisionExecution(
        id=str(uuid.uuid4()),
        project_id=proj_a.id,
        dataset_id=ds2.id,
        decision_id=d3_id,
        recommendation_id=d3_id,
        approval_id=app3.id,
        status="EXECUTING",
        started_at=utc_now() - timedelta(hours=2),
        created_at=utc_now() - timedelta(days=4),
    )
    out3_placeholder = DecisionOutcome(
        id=str(uuid.uuid4()),
        project_id=proj_a.id,
        dataset_id=ds2.id,
        decision_id=d3_id,
        recommendation_id=d3_id,
        expected_metric="patient_visits",
        expected_value=100.0,
        outcome_status="PENDING",
    )
    db.add_all([app3, exc3, out3_placeholder])

    # D4: Approved, Execution=OUTCOME_MONITORING, metric="patient_visits", ds=ds2
    d4_id = f"DEC_CAP_4_{uuid.uuid4().hex[:6]}"
    app4 = DecisionApproval(
        id=str(uuid.uuid4()),
        dataset_id=ds2.id,
        decision_id=d4_id,
        recommendation_id=d4_id,
        status="APPROVED",
        actor_id="Dr. Dave",
        created_at=utc_now() - timedelta(days=4),
    )
    exc4 = DecisionExecution(
        id=str(uuid.uuid4()),
        project_id=proj_a.id,
        dataset_id=ds2.id,
        decision_id=d4_id,
        recommendation_id=d4_id,
        approval_id=app4.id,
        status="OUTCOME_MONITORING",
        created_at=utc_now() - timedelta(days=3),
    )
    out4 = DecisionOutcome(
        id=str(uuid.uuid4()),
        project_id=proj_a.id,
        dataset_id=ds2.id,
        decision_id=d4_id,
        recommendation_id=d4_id,
        expected_metric="patient_visits",
        expected_value=100.0,
        outcome_status="PENDING",
    )
    db.add_all([app4, exc4, out4])

    # D5: Approved, Execution=EXECUTION_FAILED, metric="revenue", ds=ds1
    d5_id = f"DEC_CAP_5_{uuid.uuid4().hex[:6]}"
    app5 = DecisionApproval(
        id=str(uuid.uuid4()),
        dataset_id=ds1.id,
        decision_id=d5_id,
        recommendation_id=d5_id,
        status="APPROVED",
        actor_id="Dr. Eve",
        created_at=utc_now() - timedelta(days=3),
    )
    exc5 = DecisionExecution(
        id=str(uuid.uuid4()),
        project_id=proj_a.id,
        dataset_id=ds1.id,
        decision_id=d5_id,
        recommendation_id=d5_id,
        approval_id=app5.id,
        status="EXECUTION_FAILED",
        failure_reason="Timeout communicating with EHR connector",
        created_at=utc_now() - timedelta(days=2),
    )
    out5_placeholder = DecisionOutcome(
        id=str(uuid.uuid4()),
        project_id=proj_a.id,
        dataset_id=ds1.id,
        decision_id=d5_id,
        recommendation_id=d5_id,
        expected_metric="revenue",
        expected_value=100.0,
        outcome_status="PENDING",
    )
    db.add_all([app5, exc5, out5_placeholder])


    # D6: Approved, Execution=EXECUTED (duration 80s), Outcome=MATERIALLY_DIFFERED, metric="revenue", ds=ds1
    d6_id = f"DEC_CAP_6_{uuid.uuid4().hex[:6]}"
    app6 = DecisionApproval(
        id=str(uuid.uuid4()),
        dataset_id=ds1.id,
        decision_id=d6_id,
        recommendation_id=d6_id,
        status="APPROVED",
        actor_id="Dr. Frank",
        created_at=utc_now() - timedelta(days=2),
    )
    t_start = utc_now() - timedelta(minutes=5)
    t_end = t_start + timedelta(seconds=80)
    exc6 = DecisionExecution(
        id=str(uuid.uuid4()),
        project_id=proj_a.id,
        dataset_id=ds1.id,
        decision_id=d6_id,
        recommendation_id=d6_id,
        approval_id=app6.id,
        status="EXECUTED",
        started_at=t_start,
        completed_at=t_end,
        created_at=utc_now() - timedelta(days=1),
    )
    out6 = DecisionOutcome(
        id=str(uuid.uuid4()),
        project_id=proj_a.id,
        dataset_id=ds1.id,
        decision_id=d6_id,
        recommendation_id=d6_id,
        expected_metric="revenue",
        expected_value=1000.0,
        actual_metric="revenue",
        actual_value=1500.0,
        absolute_delta=500.0,
        relative_delta=0.50,
        outcome_status="MATERIALLY_DIFFERED",
        recorded_at=utc_now() - timedelta(hours=1),
    )
    db.add_all([app6, exc6, out6])

    # Signals in Project A:
    # Active Signal (NEW) linked to D6
    sig_active = DecisionLearningSignal(
        id=str(uuid.uuid4()),
        project_id=proj_a.id,
        signal_type="MATERIAL_DEVIATION",
        severity="HIGH",
        status="NEW",
        metric_name="revenue",
        source_decision_ids=[d6_id],
        title="High material deviation on revenue",
        description="High material deviation on revenue",
        fingerprint=uuid.uuid4().hex,
    )
    # Inactive Signal (RESOLVED) linked to D5
    sig_inactive = DecisionLearningSignal(
        id=str(uuid.uuid4()),
        project_id=proj_a.id,
        signal_type="EXECUTION_STALL",
        severity="INFO",
        status="RESOLVED",
        metric_name="revenue",
        source_decision_ids=[d5_id],
        title="Resolved timeout issue",
        description="Resolved timeout issue",
        fingerprint=uuid.uuid4().hex,
    )
    db.add_all([sig_active, sig_inactive])


    # Project B data (for isolation verification)
    d_b_id = f"DEC_PROJ_B_{uuid.uuid4().hex[:6]}"
    app_b = DecisionApproval(
        id=str(uuid.uuid4()),
        dataset_id=ds_b.id,
        decision_id=d_b_id,
        recommendation_id=d_b_id,
        status="APPROVED",
        actor_id="External User",
        created_at=utc_now() - timedelta(days=1),
    )
    exc_b = DecisionExecution(
        id=str(uuid.uuid4()),
        project_id=proj_b.id,
        dataset_id=ds_b.id,
        decision_id=d_b_id,
        recommendation_id=d_b_id,
        approval_id=app_b.id,
        status="EXECUTING",
        created_at=utc_now(),
    )
    out_b = DecisionOutcome(
        id=str(uuid.uuid4()),
        project_id=proj_b.id,
        dataset_id=ds_b.id,
        decision_id=d_b_id,
        recommendation_id=d_b_id,
        expected_metric="project_b_metric",
        expected_value=100.0,
        outcome_status="PENDING",
    )
    db.add_all([app_b, exc_b, out_b])


    db.commit()

    return {
        "project_a": proj_a,
        "project_b": proj_b,
        "ds1": ds1,
        "ds2": ds2,
        "ds_b": ds_b,
        "sc1": sc1,
        "ml1": ml1,
        "d1_id": d1_id,
        "d2_id": d2_id,
        "d3_id": d3_id,
        "d4_id": d4_id,
        "d5_id": d5_id,
        "d6_id": d6_id,
        "d_b_id": d_b_id,
    }


# ==============================================================================
# 18 TARGETED TESTS FOR PHASE 12
# ==============================================================================

def test_01_empty_portfolio(db: Session):
    """Test 1: Empty project portfolio returns valid zero-count structures with no crashes."""
    ws = Workspace(id=str(uuid.uuid4()), name=f"WS_{uuid.uuid4().hex[:6]}")
    db.add(ws)
    db.flush()
    empty_proj = Project(id=str(uuid.uuid4()), workspace_id=ws.id, name="Empty Proj")
    db.add(empty_proj)
    db.commit()

    res = client.get(f"/api/v1/projects/{empty_proj.id}/decision-portfolio/capacity")
    assert res.status_code == 200
    data = res.json()

    assert data["project_id"] == empty_proj.id
    assert data["operations"]["pending_approval"] == 0
    assert data["operations"]["pending_confirmation"] == 0
    assert data["operations"]["executing"] == 0
    assert data["operations"]["outcome_monitoring"] == 0
    assert data["operations"]["execution_failed"] == 0
    assert data["operations"]["pending_outcomes"] == 0
    assert data["operations"]["active_learning_signals"] == 0
    assert data["capacity_indicators"]["avg_execution_duration_seconds"] is None
    assert data["dependencies"] == []


def test_02_operations_summary(capacity_setup):
    """Test 2: Operations summary aggregates all factual lifecycle counts."""
    proj_id = capacity_setup["project_a"].id
    res = client.get(f"/api/v1/projects/{proj_id}/decision-portfolio/capacity")
    assert res.status_code == 200
    ops = res.json()["operations"]

    assert ops["pending_approval"] == 1
    assert ops["pending_confirmation"] == 1
    assert ops["executing"] == 1
    assert ops["outcome_monitoring"] == 1
    assert ops["execution_failed"] == 1
    assert ops["pending_outcomes"] == 5
    assert ops["active_learning_signals"] == 1


def test_03_pending_approval_count(capacity_setup):
    """Test 3: Pending approval count strictly matches WAITING_FOR_APPROVAL decisions."""
    proj_id = capacity_setup["project_a"].id
    res = client.get(f"/api/v1/projects/{proj_id}/decision-portfolio/capacity")
    assert res.status_code == 200
    assert res.json()["operations"]["pending_approval"] == 1


def test_04_pending_confirmation_count(capacity_setup):
    """Test 4: Pending confirmation count strictly matches PENDING_CONFIRMATION executions."""
    proj_id = capacity_setup["project_a"].id
    res = client.get(f"/api/v1/projects/{proj_id}/decision-portfolio/capacity")
    assert res.status_code == 200
    assert res.json()["operations"]["pending_confirmation"] == 1
    assert res.json()["capacity_indicators"]["pending_confirmations"] == 1


def test_05_executing_count(capacity_setup):
    """Test 5: Executing count strictly matches currently EXECUTING executions."""
    proj_id = capacity_setup["project_a"].id
    res = client.get(f"/api/v1/projects/{proj_id}/decision-portfolio/capacity")
    assert res.status_code == 200
    assert res.json()["operations"]["executing"] == 1
    assert res.json()["capacity_indicators"]["currently_executing"] == 1


def test_06_outcome_monitoring_count(capacity_setup):
    """Test 6: Outcome monitoring count strictly matches OUTCOME_MONITORING executions."""
    proj_id = capacity_setup["project_a"].id
    res = client.get(f"/api/v1/projects/{proj_id}/decision-portfolio/capacity")
    assert res.status_code == 200
    assert res.json()["operations"]["outcome_monitoring"] == 1
    assert res.json()["capacity_indicators"]["outcome_monitoring"] == 1


def test_07_execution_failure_count(capacity_setup):
    """Test 7: Execution failure count strictly matches EXECUTION_FAILED executions."""
    proj_id = capacity_setup["project_a"].id
    res = client.get(f"/api/v1/projects/{proj_id}/decision-portfolio/capacity")
    assert res.status_code == 200
    assert res.json()["operations"]["execution_failed"] == 1
    assert res.json()["capacity_indicators"]["execution_failures"] == 1


def test_08_pending_outcome_count(capacity_setup):
    """Test 8: Pending outcome count reflects decisions awaiting observed measurements."""
    proj_id = capacity_setup["project_a"].id
    res = client.get(f"/api/v1/projects/{proj_id}/decision-portfolio/capacity")
    assert res.status_code == 200
    assert res.json()["operations"]["pending_outcomes"] == 5
    assert res.json()["exposure_indicators"]["decisions_awaiting_outcomes"] == 5


def test_09_active_learning_signal_count(capacity_setup):
    """Test 9: Active signal count includes NEW/ACKNOWLEDGED/INVESTIGATING and excludes RESOLVED."""
    proj_id = capacity_setup["project_a"].id
    res = client.get(f"/api/v1/projects/{proj_id}/decision-portfolio/capacity")
    assert res.status_code == 200
    # 1 active (NEW), 1 inactive (RESOLVED)
    assert res.json()["operations"]["active_learning_signals"] == 1
    assert res.json()["exposure_indicators"]["decisions_with_active_learning_signals"] == 1


def test_10_metric_concentration(capacity_setup):
    """Test 10: Metric concentration provides neutral factual distributions across metrics."""
    proj_id = capacity_setup["project_a"].id
    res = client.get(f"/api/v1/projects/{proj_id}/decision-portfolio/capacity")
    assert res.status_code == 200
    by_metric = res.json()["concentration"]["by_metric"]

    metric_map = {item["key"]: item["decision_count"] for item in by_metric}
    assert metric_map["operating_cost"] == 2
    assert metric_map["patient_visits"] == 2
    assert metric_map["revenue"] == 2


def test_11_dataset_concentration(capacity_setup):
    """Test 11: Dataset concentration provides factual decision counts per dataset."""
    proj_id = capacity_setup["project_a"].id
    ds1_id = capacity_setup["ds1"].id
    ds2_id = capacity_setup["ds2"].id

    res = client.get(f"/api/v1/projects/{proj_id}/decision-portfolio/capacity")
    assert res.status_code == 200
    by_dataset = res.json()["concentration"]["by_dataset"]

    ds_map = {item["key"]: item["decision_count"] for item in by_dataset}
    assert ds_map[ds1_id] == 4  # D1, D2, D5, D6
    assert ds_map[ds2_id] == 2  # D3, D4


def test_12_scenario_dependency_concentration(capacity_setup):
    """Test 12: Scenario dependency concentration identifies shared scenarios with factual advisories."""
    proj_id = capacity_setup["project_a"].id
    sc1_id = capacity_setup["sc1"].id

    res = client.get(f"/api/v1/projects/{proj_id}/decision-portfolio/capacity")
    assert res.status_code == 200
    deps = res.json()["dependencies"]

    sc_deps = [d for d in deps if d["dependency_type"] == "SCENARIO" and d["dependency_id"] == sc1_id]
    assert len(sc_deps) == 1
    assert sc_deps[0]["decision_count"] == 2
    assert "2 decisions share Scenario" in sc_deps[0]["advisory"]


def test_13_model_dependency_concentration_only_when_explicit(capacity_setup):
    """Test 13: Model dependency concentration occurs strictly when ML model is explicitly linked."""
    proj_id = capacity_setup["project_a"].id
    ml1_id = capacity_setup["ml1"].id

    res = client.get(f"/api/v1/projects/{proj_id}/decision-portfolio/capacity")
    assert res.status_code == 200
    deps = res.json()["dependencies"]

    ml_deps = [d for d in deps if d["dependency_type"] == "ML_MODEL"]
    assert len(ml_deps) == 1
    assert ml_deps[0]["dependency_id"] == ml1_id
    assert ml_deps[0]["decision_count"] == 2
    assert "2 decisions share Predictive Model" in ml_deps[0]["advisory"]


def test_14_shared_dependency_source_ids(capacity_setup):
    """Test 14: Shared dependency items include exact affected decision IDs."""
    proj_id = capacity_setup["project_a"].id
    d1_id = capacity_setup["d1_id"]
    d2_id = capacity_setup["d2_id"]

    res = client.get(f"/api/v1/projects/{proj_id}/decision-portfolio/capacity")
    assert res.status_code == 200
    deps = res.json()["dependencies"]

    sc_dep = next(d for d in deps if d["dependency_type"] == "SCENARIO")
    assert d1_id in sc_dep["decision_ids"]
    assert d2_id in sc_dep["decision_ids"]


def test_15_no_fabricated_dependency(capacity_setup):
    """Test 15: No fabricated dependency is generated for unlinked decisions."""
    proj_id = capacity_setup["project_a"].id
    d3_id = capacity_setup["d3_id"]
    d4_id = capacity_setup["d4_id"]

    res = client.get(f"/api/v1/projects/{proj_id}/decision-portfolio/capacity")
    assert res.status_code == 200
    deps = res.json()["dependencies"]

    # D3 and D4 share metric and dataset, but have NO scenario or ML model
    for d in deps:
        if d["dependency_type"] in ("SCENARIO", "ML_MODEL"):
            assert d3_id not in d["decision_ids"]
            assert d4_id not in d["decision_ids"]


def test_16_project_isolation(capacity_setup):
    """Test 16: Project A never leaks Project B decisions or dependencies and vice versa."""
    proj_a_id = capacity_setup["project_a"].id
    proj_b_id = capacity_setup["project_b"].id
    d_b_id = capacity_setup["d_b_id"]

    # Check Project A
    res_a = client.get(f"/api/v1/projects/{proj_a_id}/decision-portfolio/capacity")
    assert res_a.status_code == 200
    data_a = res_a.json()
    all_dec_ids_a = []
    for dep in data_a["dependencies"]:
        all_dec_ids_a.extend(dep["decision_ids"])
    assert d_b_id not in all_dec_ids_a

    # Check Project B
    res_b = client.get(f"/api/v1/projects/{proj_b_id}/decision-portfolio/capacity")
    assert res_b.status_code == 200
    data_b = res_b.json()
    assert data_b["operations"]["pending_approval"] == 0
    assert data_b["operations"]["executing"] == 1  # only D_B
    assert data_b["dependencies"] == []  # only 1 decision in B, no shared dependencies!


def test_17_no_mutation(db: Session, capacity_setup):
    """Test 17: Portfolio capacity querying is strictly read-only and causes zero mutations."""
    proj_id = capacity_setup["project_a"].id
    d5_id = capacity_setup["d5_id"]

    exc_before = db.scalar(select(DecisionExecution).where(DecisionExecution.decision_id == d5_id))
    status_before = exc_before.status
    updated_before = exc_before.updated_at

    res = client.get(f"/api/v1/projects/{proj_id}/decision-portfolio/capacity")
    assert res.status_code == 200

    db.refresh(exc_before)
    assert exc_before.status == status_before
    assert exc_before.updated_at == updated_before


def test_18_no_synthetic_risk_score(capacity_setup):
    """Test 18: Verify absence of synthetic risk scores or subjective decision rankings."""
    proj_id = capacity_setup["project_a"].id
    res = client.get(f"/api/v1/projects/{proj_id}/decision-portfolio/capacity")
    assert res.status_code == 200
    data = res.json()

    # Response must not contain subjective/fabricated score keys
    assert "risk_score" not in data
    assert "score" not in data
    assert "rank" not in data
    assert "criticality" not in data
    assert "priority" not in data
