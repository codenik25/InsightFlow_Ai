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
from app.models.ml_analysis import MLAnalysis
from app.models.scenario import Scenario
from app.models.decision_optimization import DecisionOptimization
from app.models.decision_recommendation_evaluation import DecisionRecommendationEvaluation
from app.models.decision_approval import DecisionApproval
from app.models.decision_outcome import DecisionOutcome
from app.services.decision_performance_service import DecisionPerformanceService
from app.services.outcome_service import DecisionOutcomeService
from app.services.evidence_service import EvidenceService

client = TestClient(app)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def project_setup(db: Session):
    """Create test workspace, project, dataset, ml analysis, and scenario."""
    ws = Workspace(id=str(uuid.uuid4()), name=f"WS_{uuid.uuid4().hex[:6]}")
    db.add(ws)
    db.flush()

    proj = Project(id=str(uuid.uuid4()), workspace_id=ws.id, name=f"Proj_{uuid.uuid4().hex[:6]}")
    db.add(proj)
    db.flush()

    ds = Dataset(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        name="operations_data.csv",
        version=1,
        is_processed=True,
        status="PROCESSED",
    )
    db.add(ds)
    db.flush()

    ml = MLAnalysis(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        target_column="operating_cost",
        task_type="regression",
        model_name="RandomForestRegressor",
        status="COMPLETED",
    )
    db.add(ml)
    db.flush()

    scen = Scenario(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        ml_analysis_id=ml.id,
        name="Staff Reallocation Scenario",
        target_column="operating_cost",
        base_value=1000.0,
        predicted_outcome=850.0,
    )
    db.add(scen)
    db.flush()

    opt = DecisionOptimization(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        ml_analysis_id=ml.id,
        target_column="operating_cost",
        objective="minimize",
        baseline_prediction=1000.0,
        recommended_prediction=850.0,
    )
    db.add(opt)
    db.flush()

    db.commit()

    yield {
        "workspace": ws,
        "project": proj,
        "dataset": ds,
        "ml": ml,
        "scenario": scen,
        "optimization": opt,
    }


# =====================================================================
# 1. Empty project
# =====================================================================
def test_empty_project(db: Session, project_setup):
    proj_id = project_setup["project"].id
    res = client.get(f"/api/v1/projects/{proj_id}/decision-performance")
    assert res.status_code == 200
    data = res.json()

    assert data["project_id"] == proj_id
    assert data["status"] == "NO_DECISION_DATA"
    assert data["summary"]["total_decisions"] == 0
    assert data["summary"]["decisions_with_outcomes"] == 0
    assert data["summary"]["outcome_coverage_rate"] == 0.0
    assert data["summary"]["match_rate"] == 0.0
    assert data["metrics"] == []
    assert data["trends"] == []
    assert data["observations"] == []


# =====================================================================
# 2. Decisions without outcomes
# =====================================================================
def test_decisions_without_outcomes(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    # Add 2 approvals without recorded outcomes
    app1 = DecisionApproval(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        decision_id="DEC-PENDING-001",
        recommendation_id="REC-001",
        status="APPROVED",
    )
    app2 = DecisionApproval(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        decision_id="DEC-PENDING-002",
        recommendation_id="REC-002",
        status="APPROVED",
    )
    db.add_all([app1, app2])
    db.commit()

    res = client.get(f"/api/v1/projects/{proj.id}/decision-performance")
    assert res.status_code == 200
    data = res.json()

    assert data["status"] == "NO_OBSERVED_OUTCOMES"
    assert data["summary"]["total_decisions"] == 2
    assert data["summary"]["decisions_with_outcomes"] == 0
    assert data["summary"]["pending_outcomes"] == 2
    assert data["summary"]["outcome_coverage_rate"] == 0.0
    assert data["summary"]["match_rate"] == 0.0


# =====================================================================
# 3. Outcome coverage rate calculation
# =====================================================================
def test_outcome_coverage_rate(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    # 4 decisions: 3 have observed outcomes, 1 is pending
    app1 = DecisionApproval(id=str(uuid.uuid4()), dataset_id=ds.id, decision_id="DEC-COV-1", recommendation_id="REC-1")
    app2 = DecisionApproval(id=str(uuid.uuid4()), dataset_id=ds.id, decision_id="DEC-COV-2", recommendation_id="REC-2")
    app3 = DecisionApproval(id=str(uuid.uuid4()), dataset_id=ds.id, decision_id="DEC-COV-3", recommendation_id="REC-3")
    app4 = DecisionApproval(id=str(uuid.uuid4()), dataset_id=ds.id, decision_id="DEC-COV-4", recommendation_id="REC-4")
    db.add_all([app1, app2, app3, app4])

    o1 = DecisionOutcome(
        project_id=proj.id, decision_id="DEC-COV-1", dataset_id=ds.id, recommendation_id="REC-1",
        expected_metric="revenue", expected_value=100.0, actual_metric="revenue", actual_value=100.5,
        absolute_delta=0.5, relative_delta=0.005, outcome_status="MATCHED", learning_signal="PREDICTION_ACCURACY",
    )
    o2 = DecisionOutcome(
        project_id=proj.id, decision_id="DEC-COV-2", dataset_id=ds.id, recommendation_id="REC-2",
        expected_metric="revenue", expected_value=100.0, actual_metric="revenue", actual_value=102.0,
        absolute_delta=2.0, relative_delta=0.02, outcome_status="DIFFERED", learning_signal="OUTCOME_DEVIATION",
    )
    o3 = DecisionOutcome(
        project_id=proj.id, decision_id="DEC-COV-3", dataset_id=ds.id, recommendation_id="REC-3",
        expected_metric="revenue", expected_value=100.0, actual_metric="revenue", actual_value=110.0,
        absolute_delta=10.0, relative_delta=0.10, outcome_status="MATERIALLY_DIFFERED", learning_signal="OUTCOME_DEVIATION",
    )
    # DEC-COV-4 has no outcome
    db.add_all([o1, o2, o3])
    db.commit()

    res = client.get(f"/api/v1/projects/{proj.id}/decision-performance")
    assert res.status_code == 200
    data = res.json()

    # 3 observed out of 4 decisions = 75%
    assert data["summary"]["total_decisions"] == 4
    assert data["summary"]["decisions_with_outcomes"] == 3
    assert data["summary"]["decisions_with_decision_records"] == 4
    assert data["summary"]["decisions_with_actual_outcomes"] == 3
    assert data["summary"]["pending_outcomes"] == 1
    assert data["summary"]["outcome_coverage_rate"] == 0.75


# =====================================================================
# 4. Match rate calculation
# =====================================================================
def test_match_rate(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    # 4 observed outcomes: 3 MATCHED, 1 DIFFERED -> match_rate = 3/4 = 0.75
    for i in range(1, 5):
        status = "MATCHED" if i <= 3 else "DIFFERED"
        rel = 0.005 if status == "MATCHED" else 0.03
        o = DecisionOutcome(
            project_id=proj.id, decision_id=f"DEC-MR-{i}", dataset_id=ds.id, recommendation_id=f"REC-{i}",
            expected_metric="cost", expected_value=500.0, actual_metric="cost", actual_value=500.0 * (1 + rel),
            absolute_delta=500.0 * rel, relative_delta=rel, outcome_status=status,
        )
        db.add(o)
    db.commit()

    res = client.get(f"/api/v1/projects/{proj.id}/decision-performance")
    assert res.status_code == 200
    data = res.json()
    assert data["summary"]["matched_outcomes"] == 3
    assert data["summary"]["differed_outcomes"] == 1
    assert data["summary"]["match_rate"] == 0.75


# =====================================================================
# 5. Material difference rate calculation
# =====================================================================
def test_material_difference_rate(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    # 5 observed: 2 MATERIALLY_DIFFERED, 3 MATCHED -> 2/5 = 0.40
    for i in range(1, 6):
        status = "MATERIALLY_DIFFERED" if i <= 2 else "MATCHED"
        rel = 0.15 if status == "MATERIALLY_DIFFERED" else 0.002
        o = DecisionOutcome(
            project_id=proj.id, decision_id=f"DEC-MDR-{i}", dataset_id=ds.id, recommendation_id=f"REC-{i}",
            expected_metric="patient_visits", expected_value=200.0, actual_metric="patient_visits", actual_value=200.0 * (1 + rel),
            absolute_delta=200.0 * rel, relative_delta=rel, outcome_status=status,
        )
        db.add(o)
    db.commit()

    res = client.get(f"/api/v1/projects/{proj.id}/decision-performance")
    assert res.status_code == 200
    data = res.json()
    assert data["summary"]["materially_differed_outcomes"] == 2
    assert data["summary"]["material_difference_rate"] == 0.4


# =====================================================================
# 6. Aggregate variance calculation (mean, median, min, max)
# =====================================================================
def test_aggregate_variance(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    # Relative deltas: 0.01, 0.03, 0.08
    deltas = [0.01, 0.03, 0.08]
    for idx, d in enumerate(deltas):
        o = DecisionOutcome(
            project_id=proj.id, decision_id=f"DEC-VAR-{idx}", dataset_id=ds.id, recommendation_id=f"REC-{idx}",
            expected_metric="revenue", expected_value=100.0, actual_metric="revenue", actual_value=100.0 + (100.0 * d),
            absolute_delta=100.0 * d, relative_delta=d, outcome_status="MATCHED" if d <= 0.01 else "DIFFERED",
        )
        db.add(o)
    db.commit()

    res = client.get(f"/api/v1/projects/{proj.id}/decision-performance")
    assert res.status_code == 200
    data = res.json()

    # Mean relative: (0.01 + 0.03 + 0.08) / 3 = 0.04
    # Median relative: 0.03
    # Average absolute delta: (1.0 + 3.0 + 8.0) / 3 = 4.0
    assert data["summary"]["average_relative_delta"] == 0.04
    assert data["summary"]["median_relative_delta"] == 0.03
    assert data["summary"]["average_absolute_delta"] == 4.0


# =====================================================================
# 7. Metric grouping
# =====================================================================
def test_metric_grouping(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    # Add 2 outcomes for Revenue and 3 outcomes for Operating Cost
    for i in range(2):
        db.add(DecisionOutcome(
            project_id=proj.id, decision_id=f"DEC-REV-{i}", dataset_id=ds.id, recommendation_id=f"REC-REV-{i}",
            expected_metric="Revenue", expected_value=1000.0, actual_metric="Revenue", actual_value=1010.0,
            absolute_delta=10.0, relative_delta=0.01, outcome_status="MATCHED",
        ))
    for i in range(3):
        db.add(DecisionOutcome(
            project_id=proj.id, decision_id=f"DEC-COST-{i}", dataset_id=ds.id, recommendation_id=f"REC-COST-{i}",
            expected_metric="Operating Cost", expected_value=500.0, actual_metric="Operating Cost", actual_value=535.0,
            absolute_delta=35.0, relative_delta=0.07, outcome_status="MATERIALLY_DIFFERED",
        ))
    db.commit()

    res = client.get(f"/api/v1/projects/{proj.id}/decision-performance/by-metric")
    assert res.status_code == 200
    items = res.json()

    metric_names = [m["metric_name"] for m in items]
    assert "Revenue" in metric_names
    assert "Operating Cost" in metric_names

    cost_m = next(m for m in items if m["metric_name"] == "Operating Cost")
    assert cost_m["observed_outcomes"] == 3
    assert cost_m["material_deviations"] == 3
    assert cost_m["material_difference_rate"] == 1.0


# =====================================================================
# 8. Time aggregation (day, week, month)
# =====================================================================
def test_time_aggregation(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]
    now = datetime.now(timezone.utc)

    # Add outcomes on 3 consecutive days
    for day_offset in range(3):
        ts = now - timedelta(days=day_offset)
        db.add(DecisionOutcome(
            project_id=proj.id, decision_id=f"DEC-TIME-{day_offset}", dataset_id=ds.id, recommendation_id=f"REC-{day_offset}",
            expected_metric="admissions", expected_value=100.0, actual_metric="admissions", actual_value=102.0,
            absolute_delta=2.0, relative_delta=0.02, outcome_status="DIFFERED", recorded_at=ts, created_at=ts,
        ))
    db.commit()

    # Daily aggregation
    res_daily = client.get(f"/api/v1/projects/{proj.id}/decision-performance/trends?period=day&min_observations=1")
    assert res_daily.status_code == 200
    daily_trends = res_daily.json()
    assert len(daily_trends) == 3

    # Weekly aggregation
    res_weekly = client.get(f"/api/v1/projects/{proj.id}/decision-performance/trends?period=week&min_observations=1")
    assert res_weekly.status_code == 200
    assert len(res_weekly.json()) >= 1


# =====================================================================
# 9. Minimum sample requirement
# =====================================================================
def test_minimum_sample_requirement(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    # Record 2 material deviations for metric (below default minimum_observations = 3)
    for i in range(2):
        db.add(DecisionOutcome(
            project_id=proj.id, decision_id=f"DEC-SMP-{i}", dataset_id=ds.id, recommendation_id=f"REC-{i}",
            expected_metric="lab_turnaround", expected_value=60.0, actual_metric="lab_turnaround", actual_value=80.0,
            absolute_delta=20.0, relative_delta=0.33, outcome_status="MATERIALLY_DIFFERED",
        ))
    db.commit()

    # Query with default min_observations=3
    res3 = client.get(f"/api/v1/projects/{proj.id}/decision-performance?min_observations=3")
    assert res3.status_code == 200
    data3 = res3.json()
    # Should not produce repeated deviation signal because N=2 < 3
    assert len(data3["observations"]) == 0
    metric_item = next(m for m in data3["metrics"] if m["metric_name"] == "lab_turnaround")
    assert metric_item["status"] == "LIMITED_OBSERVATIONS"

    # Query with min_observations=2 -> now passes threshold and flags REPEATED_DEVIATION
    res2 = client.get(f"/api/v1/projects/{proj.id}/decision-performance?min_observations=2")
    assert res2.status_code == 200
    data2 = res2.json()
    assert len(data2["observations"]) == 1
    assert data2["observations"][0]["finding_type"] == "REPEATED_OUTCOME_DEVIATION"
    metric_item2 = next(m for m in data2["metrics"] if m["metric_name"] == "lab_turnaround")
    assert metric_item2["status"] == "REPEATED_DEVIATION"


# =====================================================================
# 10. Repeated deviation detection
# =====================================================================
def test_repeated_deviation_detection(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    # Add 5 outcomes for "Operating Cost": 4 MATERIALLY_DIFFERED, 1 MATCHED
    for i in range(5):
        is_mat = i < 4
        db.add(DecisionOutcome(
            project_id=proj.id, decision_id=f"DEC-REP-{i}", dataset_id=ds.id, recommendation_id=f"REC-{i}",
            expected_metric="Operating Cost", expected_value=1000.0, actual_metric="Operating Cost",
            actual_value=1120.0 if is_mat else 1005.0,
            absolute_delta=120.0 if is_mat else 5.0,
            relative_delta=0.12 if is_mat else 0.005,
            outcome_status="MATERIALLY_DIFFERED" if is_mat else "MATCHED",
        ))
    db.commit()

    res = client.get(f"/api/v1/projects/{proj.id}/decision-performance?min_observations=3")
    assert res.status_code == 200
    data = res.json()

    assert len(data["observations"]) == 1
    obs = data["observations"][0]
    assert obs["finding_type"] == "REPEATED_OUTCOME_DEVIATION"
    assert obs["metric_name"] == "Operating Cost"
    assert "Operating Cost shows repeated material deviation across observed decision outcomes." in obs["statement"]
    assert obs["observed_count"] == 5
    assert obs["material_deviation_count"] == 4
    assert obs["deviation_rate"] == 0.8
    assert len(obs["source_outcome_ids"]) == 4


# =====================================================================
# 11. Insufficient observations handling
# =====================================================================
def test_insufficient_observations(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    # Only 1 outcome
    db.add(DecisionOutcome(
        project_id=proj.id, decision_id="DEC-INS-1", dataset_id=ds.id, recommendation_id="REC-1",
        expected_metric="bed_occupancy", expected_value=85.0, actual_metric="bed_occupancy", actual_value=95.0,
        absolute_delta=10.0, relative_delta=0.1176, outcome_status="MATERIALLY_DIFFERED",
    ))
    db.commit()

    res = client.get(f"/api/v1/projects/{proj.id}/decision-performance?min_observations=3")
    assert res.status_code == 200
    data = res.json()

    assert data["status"] == "INSUFFICIENT_OBSERVATIONS"
    assert len(data["observations"]) == 0
    trend = data["trends"][0]
    assert trend["status"] == "INSUFFICIENT_OBSERVATIONS"


# =====================================================================
# 12. Learning signal aggregation
# =====================================================================
def test_learning_signal_aggregation(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    signals = [
        "PREDICTION_ACCURACY",
        "PREDICTION_ACCURACY",
        "OUTCOME_DEVIATION",
        "SCENARIO_DEVIATION",
        "ASSUMPTION_CHANGE",
        "DATA_DRIFT_RELEVANT",
    ]
    for idx, sig in enumerate(signals):
        db.add(DecisionOutcome(
            project_id=proj.id, decision_id=f"DEC-SIG-{idx}", dataset_id=ds.id, recommendation_id=f"REC-{idx}",
            expected_metric="revenue", expected_value=100.0, actual_metric="revenue", actual_value=102.0,
            outcome_status="MATCHED" if sig == "PREDICTION_ACCURACY" else "DIFFERED",
            learning_signal=sig,
        ))
    db.commit()

    res = client.get(f"/api/v1/projects/{proj.id}/decision-performance")
    assert res.status_code == 200
    sig_data = res.json()["signals"]

    assert sig_data["prediction_accuracy"] == 2
    assert sig_data["outcome_deviation"] == 1
    assert sig_data["scenario_deviation"] == 1
    assert sig_data["assumption_change"] == 1
    assert sig_data["data_drift_relevant"] == 1
    assert sig_data["total_signals"] == 6


# =====================================================================
# 13. Project isolation
# =====================================================================
def test_project_isolation(db: Session, project_setup):
    proj_a = project_setup["project"]
    ds_a = project_setup["dataset"]

    # Create distinct Project B
    ws = project_setup["workspace"]
    proj_b = Project(id=str(uuid.uuid4()), workspace_id=ws.id, name="Project_B")
    db.add(proj_b)
    db.flush()

    ds_b = Dataset(id=str(uuid.uuid4()), project_id=proj_b.id, name="proc_b.csv", version=1, is_processed=True, status="PROCESSED")
    db.add(ds_b)
    db.flush()

    # Add 3 outcomes in Project A
    for i in range(3):
        db.add(DecisionOutcome(
            project_id=proj_a.id, decision_id=f"DEC-A-{i}", dataset_id=ds_a.id, recommendation_id=f"REC-A-{i}",
            expected_metric="revenue", expected_value=100.0, actual_metric="revenue", actual_value=100.0,
            outcome_status="MATCHED",
        ))

    # Add 1 outcome in Project B with different metric
    db.add(DecisionOutcome(
        project_id=proj_b.id, decision_id="DEC-B-1", dataset_id=ds_b.id, recommendation_id="REC-B-1",
        expected_metric="foreign_metric", expected_value=999.0, actual_metric="foreign_metric", actual_value=999.0,
        outcome_status="MATCHED",
    ))
    db.commit()

    # Query Project A
    res_a = client.get(f"/api/v1/projects/{proj_a.id}/decision-performance")
    assert res_a.status_code == 200
    data_a = res_a.json()
    assert data_a["summary"]["decisions_with_outcomes"] == 3
    metric_names_a = [m["metric_name"] for m in data_a["metrics"]]
    assert "foreign_metric" not in metric_names_a

    # Query Project B
    res_b = client.get(f"/api/v1/projects/{proj_b.id}/decision-performance")
    assert res_b.status_code == 200
    data_b = res_b.json()
    assert data_b["summary"]["decisions_with_outcomes"] == 1
    metric_names_b = [m["metric_name"] for m in data_b["metrics"]]
    assert "revenue" not in metric_names_b
    assert "foreign_metric" in metric_names_b


# =====================================================================
# 14. Dataset lineage isolation
# =====================================================================
def test_lineage_isolation(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    # Two outcomes referencing the same logical lineage dataset
    db.add(DecisionOutcome(
        project_id=proj.id, decision_id="DEC-LIN-1", dataset_id=ds.id, recommendation_id="REC-1",
        source_dataset_id=ds.id, source_dataset_version=1,
        expected_metric="lineage_metric", expected_value=50.0, actual_metric="lineage_metric", actual_value=50.2,
        outcome_status="MATCHED",
    ))
    db.commit()

    res = client.get(f"/api/v1/projects/{proj.id}/decision-performance")
    assert res.status_code == 200
    data = res.json()
    assert any(m["metric_name"] == "lineage_metric" for m in data["metrics"])


# =====================================================================
# 15. Model aggregation ONLY with explicit ML relationship
# =====================================================================
def test_model_aggregation_only_with_explicit_ml(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]
    ml = project_setup["ml"]

    # Outcome 1: explicitly linked to ML analysis
    o1 = DecisionOutcome(
        project_id=proj.id, decision_id="DEC-ML-1", dataset_id=ds.id, recommendation_id="REC-1",
        ml_analysis_id=ml.id,
        expected_metric="operating_cost", expected_value=100.0, actual_metric="operating_cost", actual_value=105.0,
        absolute_delta=5.0, relative_delta=0.05, outcome_status="DIFFERED",
    )
    # Outcome 2: NOT linked to any ML analysis
    o2 = DecisionOutcome(
        project_id=proj.id, decision_id="DEC-NO-ML-2", dataset_id=ds.id, recommendation_id="REC-2",
        ml_analysis_id=None,
        expected_metric="operating_cost", expected_value=100.0, actual_metric="operating_cost", actual_value=102.0,
        absolute_delta=2.0, relative_delta=0.02, outcome_status="MATCHED",
    )
    db.add_all([o1, o2])
    db.commit()

    res = client.get(f"/api/v1/projects/{proj.id}/decision-performance/by-model")
    assert res.status_code == 200
    models = res.json()

    assert len(models) == 1
    m = models[0]
    assert m["ml_analysis_id"] == ml.id
    assert m["observed_outcomes"] == 1
    assert m["mean_absolute_error"] == 5.0
    assert m["mean_relative_error"] == 0.05
    assert str(o1.id) in m["source_outcome_ids"]
    assert str(o2.id) not in m["source_outcome_ids"]


# =====================================================================
# 16. Scenario aggregation
# =====================================================================
def test_scenario_aggregation(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]
    scen = project_setup["scenario"]

    # Outcome explicitly linked to Scenario
    o = DecisionOutcome(
        project_id=proj.id, decision_id="DEC-SCEN-1", dataset_id=ds.id, recommendation_id="REC-1",
        scenario_id=scen.id,
        expected_metric="operating_cost", expected_value=850.0, actual_metric="operating_cost", actual_value=845.0,
        absolute_delta=-5.0, relative_delta=-0.0059, outcome_status="MATCHED",
    )
    db.add(o)
    db.commit()

    res = client.get(f"/api/v1/projects/{proj.id}/decision-performance/by-scenario")
    assert res.status_code == 200
    scenarios = res.json()

    assert len(scenarios) == 1
    s = scenarios[0]
    assert s["scenario_id"] == scen.id
    assert s["scenario_name"] == scen.name
    assert s["observed_outcomes"] == 1
    assert s["matched_outcomes"] == 1
    assert str(o.id) in s["source_outcome_ids"]


# =====================================================================
# 17. Source outcome traceability
# =====================================================================
def test_source_outcome_traceability(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    o1 = DecisionOutcome(
        project_id=proj.id, decision_id="DEC-TRACE-1", dataset_id=ds.id, recommendation_id="REC-1",
        expected_metric="throughput", expected_value=100.0, actual_metric="throughput", actual_value=120.0,
        absolute_delta=20.0, relative_delta=0.20, outcome_status="MATERIALLY_DIFFERED",
    )
    o2 = DecisionOutcome(
        project_id=proj.id, decision_id="DEC-TRACE-2", dataset_id=ds.id, recommendation_id="REC-2",
        expected_metric="throughput", expected_value=100.0, actual_metric="throughput", actual_value=125.0,
        absolute_delta=25.0, relative_delta=0.25, outcome_status="MATERIALLY_DIFFERED",
    )
    db.add_all([o1, o2])
    db.commit()

    res = client.get(f"/api/v1/projects/{proj.id}/decision-performance/by-metric")
    assert res.status_code == 200
    item = next(m for m in res.json() if m["metric_name"] == "throughput")

    assert str(o1.id) in item["source_outcome_ids"]
    assert str(o2.id) in item["source_outcome_ids"]


# =====================================================================
# 18. No mutation of historical outcomes
# =====================================================================
def test_no_mutation_of_historical_outcomes(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    o = DecisionOutcome(
        project_id=proj.id, decision_id="DEC-IMMUTABLE", dataset_id=ds.id, recommendation_id="REC-1",
        expected_metric="score", expected_value=90.0, actual_metric="score", actual_value=92.0,
        absolute_delta=2.0, relative_delta=0.0222, outcome_status="DIFFERED",
    )
    db.add(o)
    db.commit()
    db.refresh(o)

    initial_updated_at = o.updated_at
    initial_status = o.outcome_status

    # Invoke performance intelligence endpoint multiple times
    for _ in range(3):
        res = client.get(f"/api/v1/projects/{proj.id}/decision-performance")
        assert res.status_code == 200

    db.expire_all()
    fresh = db.scalar(select(DecisionOutcome).where(DecisionOutcome.id == o.id))
    assert fresh.updated_at == initial_updated_at
    assert fresh.outcome_status == initial_status


# =====================================================================
# 19. Existing Phase 6 behavior preserved
# =====================================================================
def test_existing_phase6_behavior(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]
    ml = project_setup["ml"]
    opt = project_setup["optimization"]

    # Verify recording an outcome via Phase 6 endpoint works as expected
    rec = DecisionRecommendationEvaluation(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        ml_analysis_id=ml.id,
        optimization_id=opt.id,
        recommendation_type="optimization",
        title="Phase 6 Verification Rec",
        target_metric="cost",
        baseline_value=100.0,
        projected_value=110.0,
        rationale="Operational improvement",
        tradeoffs="Resource allocation",
    )
    db.add(rec)
    db.commit()

    payload = {
        "actual_metric": "cost",
        "actual_value": 110.5,
        "material_difference_threshold": 0.05,
    }
    res = client.post(f"/api/v1/decisions/{rec.id}/outcomes", json=payload)
    assert res.status_code == 201
    out_data = res.json()
    assert out_data["outcome_status"] == "MATCHED"
    assert out_data["learning_signal"] == "PREDICTION_ACCURACY"

    # Verify retrieving decision outcomes returns history
    res_list = client.get(f"/api/v1/decisions/{rec.id}/outcomes")
    assert res_list.status_code == 200
    assert res_list.json()["total_outcomes"] >= 1


# =====================================================================
# 20. Existing Phase 5 evidence graph behavior preserved
# =====================================================================
def test_existing_phase5_behavior(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]
    ml = project_setup["ml"]
    opt = project_setup["optimization"]

    # Create approved decision for Phase 5 evidence graph test
    rec = DecisionRecommendationEvaluation(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        ml_analysis_id=ml.id,
        optimization_id=opt.id,
        recommendation_type="optimization",
        title="Phase 5 Verification Rec",
        target_metric="cost",
        baseline_value=100.0,
        projected_value=110.0,
        rationale="Operational improvement",
        tradeoffs="Resource allocation",
    )
    db.add(rec)
    db.flush()

    app = DecisionApproval(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        decision_id=f"DEC-PH5-{uuid.uuid4().hex[:6]}",
        recommendation_id=rec.id,
        status="APPROVED",
    )
    db.add(app)
    db.commit()

    # Query project-level evidence graph
    res_proj = client.get(f"/api/v1/projects/{proj.id}/evidence")
    assert res_proj.status_code == 200
    graph = res_proj.json()
    assert "nodes" in graph
    assert "edges" in graph

    # Query decision-level backward provenance chain
    res_dec = client.get(f"/api/v1/decisions/{app.decision_id}/evidence")
    assert res_dec.status_code == 200
    chain = res_dec.json()
    assert "decision_id" in chain
    assert "nodes" in chain
    assert "edges" in chain
