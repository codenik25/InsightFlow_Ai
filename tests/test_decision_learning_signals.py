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
from app.models.decision_learning_signal import DecisionLearningSignal
from app.services.decision_performance_service import DecisionPerformanceService
from app.services.learning_signal_service import LearningSignalService
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
        name="logistics_performance.csv",
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
        model_name="GradientBoostingCostModel",
        status="COMPLETED",
    )
    db.add(ml)
    db.flush()

    scen = Scenario(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        ml_analysis_id=ml.id,
        name="Route Optimization Strategy",
        target_column="operating_cost",
        base_value=5000.0,
        predicted_outcome=4200.0,
    )
    db.add(scen)
    db.flush()

    opt = DecisionOptimization(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        ml_analysis_id=ml.id,
        target_column="operating_cost",
        objective="minimize",
        baseline_prediction=5000.0,
        recommended_prediction=4200.0,
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


def _create_decision_and_outcome(
    db: Session,
    project: Project,
    dataset: Dataset,
    expected_metric: str = "operating_cost",
    expected_value: float = 100.0,
    actual_metric: str = "operating_cost",
    actual_value: float = 100.0,
    outcome_status: str = "MATCHED",
    learning_signal: str = "PREDICTION_ACCURACY",
    ml_id: str = None,
    scenario_id: str = None,
    opt_id: str = None,
    relative_delta: float = 0.0,
    threshold_used: float = 0.05,
    source_dataset_version: int = 1,
) -> tuple[DecisionApproval, DecisionOutcome]:
    dec_id = f"DEC_{uuid.uuid4().hex[:8]}"
    rec_id = f"REC_{uuid.uuid4().hex[:8]}"

    appr = DecisionApproval(
        id=str(uuid.uuid4()),
        decision_id=dec_id,
        recommendation_id=rec_id,
        dataset_id=dataset.id,
        status="APPROVED",
    )
    db.add(appr)
    db.flush()

    abs_delta = actual_value - expected_value if actual_value is not None else None

    out = DecisionOutcome(
        id=str(uuid.uuid4()),
        project_id=project.id,
        decision_id=dec_id,
        dataset_id=dataset.id,
        recommendation_id=rec_id,
        optimization_id=opt_id,
        scenario_id=scenario_id,
        ml_analysis_id=ml_id,
        expected_metric=expected_metric,
        expected_value=expected_value,
        actual_metric=actual_metric,
        actual_value=actual_value,
        absolute_delta=abs_delta,
        relative_delta=relative_delta,
        objective="minimize",
        outcome_status=outcome_status,
        threshold_used=threshold_used,
        learning_signal=learning_signal,
        source_dataset_id=dataset.id,
        source_dataset_version=source_dataset_version,
    )
    db.add(out)
    db.flush()
    db.commit()

    return appr, out


# =====================================================================
# 1. No signals with no decisions
# =====================================================================
def test_no_signals_with_no_decisions(db: Session, project_setup):
    proj_id = project_setup["project"].id
    res = client.get(f"/api/v1/projects/{proj_id}/learning-signals")
    assert res.status_code == 200
    data = res.json()
    assert data["project_id"] == proj_id
    assert data["total_signals"] == 0
    assert data["signals"] == []


# =====================================================================
# 2. No signals with insufficient observations
# =====================================================================
def test_no_signals_with_insufficient_observations(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    # Record 2 observations (default min_observations is 3)
    _create_decision_and_outcome(
        db, proj, ds, expected_value=100.0, actual_value=120.0,
        outcome_status="MATERIALLY_DIFFERED", learning_signal="OUTCOME_DEVIATION", relative_delta=0.20
    )
    _create_decision_and_outcome(
        db, proj, ds, expected_value=100.0, actual_value=125.0,
        outcome_status="MATERIALLY_DIFFERED", learning_signal="OUTCOME_DEVIATION", relative_delta=0.25
    )

    # With min_observations=3, no repeated deviation signals should exist
    res = client.get(f"/api/v1/projects/{proj.id}/learning-signals?min_observations=3")
    assert res.status_code == 200
    data = res.json()
    deviation_signals = [s for s in data["signals"] if s["signal_type"] in ["PREDICTION_DEVIATION", "OUTCOME_DEVIATION"]]
    assert len(deviation_signals) == 0


# =====================================================================
# 3. Prediction deviation signal
# =====================================================================
def test_prediction_deviation_signal(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]
    ml = project_setup["ml"]
    opt = project_setup["optimization"]

    # 4 outcomes, 3 with material deviations on operating_cost, explicitly linked to model/optimization
    for i in range(4):
        actual = 130.0 if i < 3 else 100.5
        stat = "MATERIALLY_DIFFERED" if i < 3 else "MATCHED"
        sig = "OUTCOME_DEVIATION" if i < 3 else "PREDICTION_ACCURACY"
        r_delta = 0.30 if i < 3 else 0.005
        _create_decision_and_outcome(
            db, proj, ds, expected_value=100.0, actual_value=actual,
            outcome_status=stat, learning_signal=sig, relative_delta=r_delta,
            ml_id=ml.id, opt_id=opt.id, expected_metric="operating_cost", actual_metric="operating_cost"
        )

    res = client.get(f"/api/v1/projects/{proj.id}/learning-signals")
    assert res.status_code == 200
    data = res.json()

    pred_signals = [s for s in data["signals"] if s["signal_type"] == "PREDICTION_DEVIATION"]
    assert len(pred_signals) >= 1
    sig = pred_signals[0]
    assert sig["metric_name"] == "operating_cost"
    assert sig["severity"] in ["HIGH", "REVIEW"]
    assert sig["status"] == "NEW"
    assert sig["observed_count"] >= 3
    assert len(sig["source_outcome_ids"]) >= 3


# =====================================================================
# 4. Outcome deviation signal
# =====================================================================
def test_outcome_deviation_signal(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    # 4 outcomes on turnaround_time without predictive model
    for i in range(4):
        actual = 50.0 if i < 3 else 20.0
        stat = "MATERIALLY_DIFFERED" if i < 3 else "MATCHED"
        sig = "OUTCOME_DEVIATION" if i < 3 else "PREDICTION_ACCURACY"
        r_delta = 1.5 if i < 3 else 0.0
        _create_decision_and_outcome(
            db, proj, ds, expected_value=20.0, actual_value=actual,
            outcome_status=stat, learning_signal=sig, relative_delta=r_delta,
            expected_metric="turnaround_time", actual_metric="turnaround_time",
            ml_id=None, opt_id=None
        )

    res = client.get(f"/api/v1/projects/{proj.id}/learning-signals")
    assert res.status_code == 200
    data = res.json()

    out_signals = [s for s in data["signals"] if s["signal_type"] == "OUTCOME_DEVIATION"]
    assert len(out_signals) >= 1
    assert out_signals[0]["metric_name"] == "turnaround_time"
    assert out_signals[0]["status"] == "NEW"


# =====================================================================
# 5. Scenario deviation signal
# =====================================================================
def test_scenario_deviation_signal(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]
    scen = project_setup["scenario"]

    # 3 outcomes linked to scenario with material deviations
    for i in range(3):
        _create_decision_and_outcome(
            db, proj, ds, expected_value=4200.0, actual_value=5500.0,
            outcome_status="MATERIALLY_DIFFERED", learning_signal="SCENARIO_DEVIATION",
            relative_delta=0.31, scenario_id=scen.id, expected_metric="operating_cost", actual_metric="operating_cost"
        )

    res = client.get(f"/api/v1/projects/{proj.id}/learning-signals")
    assert res.status_code == 200
    data = res.json()

    scen_signals = [s for s in data["signals"] if s["signal_type"] == "SCENARIO_DEVIATION"]
    assert len(scen_signals) >= 1
    assert "Route Optimization Strategy" in scen_signals[0]["title"]


# =====================================================================
# 6. Outcome coverage gap
# =====================================================================
def test_outcome_coverage_gap(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    # 5 decisions in total, but only 1 with actual outcome (coverage = 20% < 60%)
    _create_decision_and_outcome(db, proj, ds, expected_value=100.0, actual_value=100.0, outcome_status="MATCHED")
    for _ in range(4):
        _create_decision_and_outcome(
            db, proj, ds, expected_value=100.0, actual_value=None,
            outcome_status="PENDING", learning_signal="UNAVAILABLE"
        )

    res = client.get(f"/api/v1/projects/{proj.id}/learning-signals")
    assert res.status_code == 200
    data = res.json()

    cov_signals = [s for s in data["signals"] if s["signal_type"] == "OUTCOME_COVERAGE_GAP"]
    assert len(cov_signals) >= 1
    sig = cov_signals[0]
    assert sig["severity"] == "REVIEW"
    assert "coverage is" in sig["description"].lower() or "incomplete" in sig["description"].lower()


# =====================================================================
# 7. Model signal requires explicit ml_analysis_id
# =====================================================================
def test_model_signal_requires_explicit_ml_analysis_id(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    # Outcomes have recurring deviations on cost, but ml_id is explicitly NULL
    for _ in range(4):
        _create_decision_and_outcome(
            db, proj, ds, expected_value=100.0, actual_value=150.0,
            outcome_status="MATERIALLY_DIFFERED", relative_delta=0.5,
            ml_id=None
        )

    res = client.get(f"/api/v1/projects/{proj.id}/learning-signals")
    assert res.status_code == 200
    data = res.json()

    # Must NEVER emit MODEL_PERFORMANCE_VARIANCE when ml_id is None
    model_signals = [s for s in data["signals"] if s["signal_type"] == "MODEL_PERFORMANCE_VARIANCE"]
    assert len(model_signals) == 0


# =====================================================================
# 8. No fabricated data-drift signal
# =====================================================================
def test_no_fabricated_data_drift_signal(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    # Create standard deviations without explicit DATA_DRIFT_RELEVANT signal
    for _ in range(3):
        _create_decision_and_outcome(
            db, proj, ds, expected_value=100.0, actual_value=120.0,
            outcome_status="MATERIALLY_DIFFERED", learning_signal="OUTCOME_DEVIATION"
        )

    res = client.get(f"/api/v1/projects/{proj.id}/learning-signals")
    assert res.status_code == 200
    data = res.json()

    drift_signals = [s for s in data["signals"] if s["signal_type"] == "DATA_DRIFT_RELEVANT"]
    assert len(drift_signals) == 0


# =====================================================================
# 9. Assumption change requires explicit evidence
# =====================================================================
def test_assumption_change_requires_explicit_evidence(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    # Initially no assumption changes
    res1 = client.get(f"/api/v1/projects/{proj.id}/learning-signals")
    assert len([s for s in res1.json()["signals"] if s["signal_type"] == "ASSUMPTION_CHANGE"]) == 0

    # Add explicit ASSUMPTION_CHANGE outcome
    _create_decision_and_outcome(
        db, proj, ds, expected_value=100.0, actual_value=115.0,
        outcome_status="MATERIALLY_DIFFERED", learning_signal="ASSUMPTION_CHANGE"
    )

    res2 = client.get(f"/api/v1/projects/{proj.id}/learning-signals")
    assert res2.status_code == 200
    data2 = res2.json()
    assump_signals = [s for s in data2["signals"] if s["signal_type"] == "ASSUMPTION_CHANGE"]
    assert len(assump_signals) >= 1
    assert "Operational Assumption Change" in assump_signals[0]["title"]


# =====================================================================
# 10. Minimum sample protection
# =====================================================================
def test_minimum_sample_protection(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    # Only 2 observations with material deviations on metric 'speed'
    _create_decision_and_outcome(
        db, proj, ds, expected_metric="speed", actual_metric="speed",
        expected_value=60.0, actual_value=85.0, outcome_status="MATERIALLY_DIFFERED", relative_delta=0.41
    )
    _create_decision_and_outcome(
        db, proj, ds, expected_metric="speed", actual_metric="speed",
        expected_value=60.0, actual_value=90.0, outcome_status="MATERIALLY_DIFFERED", relative_delta=0.50
    )

    # With default min_observations=3, speed cannot emit repeated deviation signal
    res = client.get(f"/api/v1/projects/{proj.id}/learning-signals?min_observations=3")
    data = res.json()
    speed_signals = [s for s in data["signals"] if s.get("metric_name") == "speed"]
    assert len(speed_signals) == 0

    # If min_observations is lowered to 2, it generates the signal
    res2 = client.get(f"/api/v1/projects/{proj.id}/learning-signals?min_observations=2")
    data2 = res2.json()
    speed_signals2 = [s for s in data2["signals"] if s.get("metric_name") == "speed"]
    assert len(speed_signals2) >= 1


# =====================================================================
# 11. Signal fingerprint deduplication
# =====================================================================
def test_signal_fingerprint_deduplication(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    for _ in range(4):
        _create_decision_and_outcome(
            db, proj, ds, expected_value=100.0, actual_value=140.0,
            outcome_status="MATERIALLY_DIFFERED", relative_delta=0.40
        )

    # First fetch syncs and creates signals in DB
    res1 = client.get(f"/api/v1/projects/{proj.id}/learning-signals")
    count1 = len(res1.json()["signals"])

    # Second fetch must NOT duplicate rows
    res2 = client.get(f"/api/v1/projects/{proj.id}/learning-signals")
    count2 = len(res2.json()["signals"])

    assert count1 == count2
    # Verify in DB directly
    db_signals = db.scalars(select(DecisionLearningSignal).where(DecisionLearningSignal.project_id == proj.id)).all()
    assert len(db_signals) == count1


# =====================================================================
# 12. Source outcome traceability
# =====================================================================
def test_source_outcome_traceability(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    created_outcome_ids = []
    for _ in range(3):
        _, o = _create_decision_and_outcome(
            db, proj, ds, expected_value=100.0, actual_value=135.0,
            outcome_status="MATERIALLY_DIFFERED", relative_delta=0.35
        )
        created_outcome_ids.append(o.id)

    res = client.get(f"/api/v1/projects/{proj.id}/learning-signals")
    data = res.json()
    assert len(data["signals"]) >= 1
    sig = data["signals"][0]

    # Signal must contain source outcome IDs
    for oid in created_outcome_ids:
        assert oid in sig["source_outcome_ids"]


# =====================================================================
# 13. Source decision traceability
# =====================================================================
def test_source_decision_traceability(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    created_decision_ids = []
    for _ in range(3):
        appr, _ = _create_decision_and_outcome(
            db, proj, ds, expected_value=100.0, actual_value=135.0,
            outcome_status="MATERIALLY_DIFFERED", relative_delta=0.35
        )
        created_decision_ids.append(appr.decision_id)

    res = client.get(f"/api/v1/projects/{proj.id}/learning-signals")
    data = res.json()
    assert len(data["signals"]) >= 1
    sig = data["signals"][0]

    for did in created_decision_ids:
        assert did in sig["source_decision_ids"]


# =====================================================================
# 14. Project isolation
# =====================================================================
def test_project_isolation(db: Session, project_setup):
    proj_a = project_setup["project"]
    ds_a = project_setup["dataset"]

    # Create Project B
    proj_b = Project(id=str(uuid.uuid4()), workspace_id=project_setup["workspace"].id, name="Project_B")
    db.add(proj_b)
    db.flush()
    ds_b = Dataset(id=str(uuid.uuid4()), project_id=proj_b.id, name="b.csv", version=1, is_processed=True, status="PROCESSED")
    db.add(ds_b)
    db.flush()
    db.commit()

    # Project A has 3 deviations
    for _ in range(3):
        _create_decision_and_outcome(
            db, proj_a, ds_a, expected_value=100.0, actual_value=135.0,
            outcome_status="MATERIALLY_DIFFERED", relative_delta=0.35
        )

    # Sync Project A
    res_a = client.get(f"/api/v1/projects/{proj_a.id}/learning-signals")
    signals_a = res_a.json()["signals"]
    assert len(signals_a) >= 1
    sig_id_a = signals_a[0]["id"]

    # Project B must see 0 signals
    res_b = client.get(f"/api/v1/projects/{proj_b.id}/learning-signals")
    assert res_b.json()["total_signals"] == 0

    # Project B cannot access Project A's signal directly
    res_leak = client.get(f"/api/v1/projects/{proj_b.id}/learning-signals/{sig_id_a}")
    assert res_leak.status_code == 404


# =====================================================================
# 15. Dataset lineage isolation
# =====================================================================
def test_dataset_lineage_isolation(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    for _ in range(3):
        _create_decision_and_outcome(
            db, proj, ds, expected_value=100.0, actual_value=130.0,
            outcome_status="MATERIALLY_DIFFERED", relative_delta=0.30, source_dataset_version=3
        )

    res = client.get(f"/api/v1/projects/{proj.id}/learning-signals")
    assert res.status_code == 200
    data = res.json()
    signals_with_version = [s for s in data["signals"] if 3 in s.get("source_dataset_versions", [])]
    assert len(signals_with_version) >= 1


# =====================================================================
# 16. Signal retrieval
# =====================================================================
def test_signal_retrieval(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    for _ in range(3):
        _create_decision_and_outcome(
            db, proj, ds, expected_value=100.0, actual_value=130.0,
            outcome_status="MATERIALLY_DIFFERED"
        )

    res_list = client.get(f"/api/v1/projects/{proj.id}/learning-signals")
    sig = res_list.json()["signals"][0]

    # Fetch individual signal by ID
    res_single = client.get(f"/api/v1/projects/{proj.id}/learning-signals/{sig['id']}")
    assert res_single.status_code == 200
    data_single = res_single.json()
    assert data_single["id"] == sig["id"]
    assert data_single["title"] == sig["title"]
    assert data_single["evidence_summary"] is not None


# =====================================================================
# 17. Acknowledge workflow
# =====================================================================
def test_acknowledge_workflow(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    for _ in range(3):
        _create_decision_and_outcome(db, proj, ds, expected_value=100.0, actual_value=130.0, outcome_status="MATERIALLY_DIFFERED")

    sig = client.get(f"/api/v1/projects/{proj.id}/learning-signals").json()["signals"][0]

    res = client.patch(
        f"/api/v1/projects/{proj.id}/learning-signals/{sig['id']}",
        json={"status": "ACKNOWLEDGED", "reviewed_by": "Ops Analyst"}
    )
    assert res.status_code == 200
    updated = res.json()
    assert updated["status"] == "ACKNOWLEDGED"
    assert updated["reviewed_by"] == "Ops Analyst"


# =====================================================================
# 18. Investigating workflow
# =====================================================================
def test_investigating_workflow(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    for _ in range(3):
        _create_decision_and_outcome(db, proj, ds, expected_value=100.0, actual_value=130.0, outcome_status="MATERIALLY_DIFFERED")

    sig = client.get(f"/api/v1/projects/{proj.id}/learning-signals").json()["signals"][0]

    res = client.patch(
        f"/api/v1/projects/{proj.id}/learning-signals/{sig['id']}",
        json={"status": "INVESTIGATING", "review_notes": "Cross-verifying with logistics sensors"}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "INVESTIGATING"
    assert "logistics sensors" in res.json()["review_notes"]


# =====================================================================
# 19. Resolve workflow
# =====================================================================
def test_resolve_workflow(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    for _ in range(3):
        _create_decision_and_outcome(db, proj, ds, expected_value=100.0, actual_value=130.0, outcome_status="MATERIALLY_DIFFERED")

    sig = client.get(f"/api/v1/projects/{proj.id}/learning-signals").json()["signals"][0]

    res = client.patch(
        f"/api/v1/projects/{proj.id}/learning-signals/{sig['id']}",
        json={"status": "RESOLVED", "review_notes": "Variance explained by seasonal weather disruption"}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "RESOLVED"
    assert "seasonal weather" in res.json()["review_notes"]


# =====================================================================
# 20. Dismiss workflow
# =====================================================================
def test_dismiss_workflow(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    for _ in range(3):
        _create_decision_and_outcome(db, proj, ds, expected_value=100.0, actual_value=130.0, outcome_status="MATERIALLY_DIFFERED")

    sig = client.get(f"/api/v1/projects/{proj.id}/learning-signals").json()["signals"][0]

    res = client.patch(
        f"/api/v1/projects/{proj.id}/learning-signals/{sig['id']}",
        json={"status": "DISMISSED", "review_notes": "Transient anomaly in external test dataset"}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "DISMISSED"


# =====================================================================
# 21. Historical evidence immutable
# =====================================================================
def test_historical_evidence_immutable(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    saved_outcome = None
    for _ in range(3):
        _, o = _create_decision_and_outcome(
            db, proj, ds, expected_value=100.0, actual_value=140.0,
            outcome_status="MATERIALLY_DIFFERED", relative_delta=0.40
        )
        saved_outcome = o

    original_val = saved_outcome.actual_value
    original_stat = saved_outcome.outcome_status

    # Get signals and resolve one
    signals = client.get(f"/api/v1/projects/{proj.id}/learning-signals").json()["signals"]
    assert len(signals) >= 1
    sig_id = signals[0]["id"]
    client.patch(
        f"/api/v1/projects/{proj.id}/learning-signals/{sig_id}",
        json={"status": "RESOLVED", "review_notes": "Investigation complete"}
    )

    # Re-fetch outcome from DB: must NOT be altered
    db.expire_all()
    outcome_after = db.scalar(select(DecisionOutcome).where(DecisionOutcome.id == saved_outcome.id))
    assert outcome_after.actual_value == original_val
    assert outcome_after.outcome_status == original_stat


# =====================================================================
# 22. Phase 7 behavior unchanged
# =====================================================================
def test_phase7_behavior_unchanged(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    _create_decision_and_outcome(
        db, proj, ds, expected_value=100.0, actual_value=100.0, outcome_status="MATCHED"
    )

    res = client.get(f"/api/v1/projects/{proj.id}/decision-performance")
    assert res.status_code == 200
    data = res.json()
    assert "summary" in data
    assert "metrics" in data
    assert "trends" in data
    assert "signals" in data
    assert data["summary"]["matched_outcomes"] >= 1


# =====================================================================
# 23. Phase 6 behavior unchanged
# =====================================================================
def test_phase6_behavior_unchanged(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    # Verify Phase 6 evaluation math directly
    eval_res = DecisionOutcomeService.evaluate_decision_outcome_math(
        expected_value=100.0, actual_value=100.5, threshold=0.05
    )
    assert eval_res["outcome_status"] == "MATCHED"
    assert eval_res["learning_signal"] == "PREDICTION_ACCURACY"


# =====================================================================
# 24. Phase 5 evidence behavior unchanged
# =====================================================================
def test_phase5_evidence_behavior_unchanged(db: Session, project_setup):
    proj = project_setup["project"]
    ds = project_setup["dataset"]

    # Verify Phase 5 evidence node query still operates cleanly
    graph = EvidenceService.get_dataset_evidence_graph(db=db, dataset_id=ds.id)
    assert graph.project_id == proj.id
    assert graph.nodes is not None
